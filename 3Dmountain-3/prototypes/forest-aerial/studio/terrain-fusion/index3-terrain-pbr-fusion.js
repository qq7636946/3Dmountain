/* terrain-pbr-fusion.js — SNAPSHOT (2026-11-24 ~13:50, fusion-10) of prototypes/valley-261124/terrain-pbr-261124.js (another AI's 261124.html; client:
   「261124.html俯視山谷 移過來 index1-5-canyon-forest-rise-ui.html」), relative paths rewritten for studio/terrain-fusion/, plus our KTX2 loading of
   the fusion maps (1024, 11 MB → about 3 MB; ?fusionKtx=0 = the WebP) and the forest's colour fetched only while canopyCover > 0. */
/* studio-terrain-pbr-layer.js — Standalone High-Detail Aerial Terrain PBR + Unified Dual-Normal Water
   + Alpine Canyon Sunlight, Real-Time Terrain Shadows & Volumetric Sunbeams (extending index1-5-canyon-forest.html)
   Used exclusively by index-topdown-studio-pbr.html (keeps index-topdown-studio.html, flow2-original-scene.js & flow2-scene-water.js 100% untouched):
   - No added 3D trees / ground props: terrain PBR and water share the existing draw path.
   - PBR maps: ambientCG grass, moss and rock, a shore scan, and spectral water normals:
       * Dual-scale (Macro + Micro rotated + domain-warped) anti-tiling Grass004 & Moss002 with deep canyon-emerald zoning & 2K NormalGL
       * WorldNormal.y slope-driven + ridge-crest auto cliff cutting with 1:1 isotropic Triplanar Rock051 Color + 2K NormalGL + Disp + AO
       * Wet gravel shelves and transparent shoals from a reprojected shore scan (see pbr-shore-credits.txt)
   - Unified Glacial Water Engine (Central Lake + 4 Core Rivers + 4 Outer Rivers + 9 Tributaries):
       * Depth gradient: clear turquoise shallows (refracted riverbed pebbles & caustics) -> deep glacial blue-teal lake center
       * Animated Dual-Layer Seamless FFT Water NormalGL advected downstream along river tangents + top-down wave slope lighting
       * Physically grounded Fresnel sky/bank reflection (oblique-weighted, zero top-down reflection smudges)
       * Live Holographic Light Curtain & Central LOGO ice-blue wave-broken specular & diffuse water glow bounce
       * Feathered shore edges + subtle narrow/bend whitewater streaks & delicate broken foam
   - Sunlight & Atmosphere extending index1-5-canyon-forest.html:
       * Low-raking warm golden-ivory daylight key + luminous periwinkle-slate sky fill + 5-tap real-time mountain self-shadows
       * Batched volumetric diagonal sunlight shafts aligned to live sun vector + alpine daylight sky dome with solar halo */
import * as THREE from 'three';
import { HIGHLAND_GLSL, packArrivalField } from '../index3-studio-highland-ecology.js?v=weather1-bank1-fast2';
import { createStudioClouds } from './studio-clouds-drift.js?v=d1';   /* 2026-11-24: the drifting copy (「雲要會漂過去」) */
import { createShoreCobbles } from '../studio-shore-cobbles.js?v=bank-toes1-falls1-redo2';
import { refineHeadwaterBanks, headwaterStones } from '../studio-headwater-detail.js?v=ridge-banks2';

const REFINE_HEADWATERS = new URLSearchParams(location.search).get('headwaters') !== '0';

/* OPT2 team B (2026-11-25, enter-round page only: html[data-rise-opt2], not ?opt2B=0 / ?opt2=0 / ?opt2Boff=sub): a medium or low start builds the
   extended relief grid's fine water-edge cells 2 × 2 (as coarse-pointer devices already do) instead of 3 × 3; the high tier keeps 3 × 3. 0 = no change. */
const opt2bGridSub = () => {
  try {
    const q = new URLSearchParams(location.search), start = window.__FLOW2_QUALITY__?.start;
    if (!document.documentElement.hasAttribute('data-rise-opt2') || q.get('opt2B') === '0' || q.get('opt2') === '0' || (q.get('opt2Boff') || '').split(',').includes('sub')) return 0;
    return start === 'medium' || start === 'low' ? 2 : 0;
  } catch (error) { return 0; }
};
const PBR_VER = 'pbr-20261119-09';
const SHORE_VER = 'shore-2';
const CORE_COLUMNS = 256, CORE_ROWS = 144;
const SHORE_ATLAS_GLSL = `
  // Both tiles have a periodic gutter equal to 1/16 of their width. Use the unwrapped
  // derivatives so a tile seam cannot select a coarse mip across the atlas.
  vec4 stTileGrad(sampler2D materialMap, vec2 uv, float tile, vec2 du, vec2 dv) {
    vec2 p=fract(uv)*0.875+0.0625;
    vec2 scale=vec2(0.4375,0.875);
    return textureGrad(materialMap,vec2((p.x+tile)*0.5,p.y),du*scale,dv*scale);
  }
  vec4 stMaterialTile(sampler2D materialMap, vec2 uv, float tile) {
    return stTileGrad(materialMap,uv,tile,dFdx(uv),dFdy(uv));
  }
  const mat2 stGravelAxes=mat2(0.9397,-0.3420,0.3420,0.9397);
  vec2 stGravelUV(vec2 p) {
    return stGravelAxes*p*3.35+0.25*sin(p.yx*vec2(1.3,1.7)+vec2(2.1,5.3));
  }
  vec2 stGravelSlope(vec2 normalXY) {
    vec2 n=normalXY*2.0-1.0;
    return transpose(stGravelAxes)*n/max(0.38,sqrt(max(0.0,1.0-dot(n,n))));
  }
`;

// The relief, normals, albedo and occlusion all come from the same shore scan.
// Trace the relief only where individual stones resolve to several pixels.
const GRAVEL_RELIEF_GLSL = `
  void stCobbleSurface(vec2 p, vec3 N, vec3 V, vec3 L, out vec4 color, out vec4 detail, out float contact) {
    vec2 uv=stGravelUV(p), du=dFdx(uv), dv=dFdy(uv);
    float footprint=max(length(du),length(dv))*672.0;
    float close=1.0-smoothstep(7.0,24.0,footprint);
    detail=stTileGrad(tRockNrm2,uv,1.0,du,dv);
    contact=1.0;
    if(close>0.01) {
      float facing=dot(V,N);
      vec2 ray=stGravelAxes*(V-N*facing).xz*(0.048*close/max(facing,0.36));
      vec2 hit=uv+ray*(detail.b-0.44);
      float h=stTileGrad(tRockNrm2,hit,1.0,du,dv).b;
      uv+=ray*(0.5*(h+detail.b)-0.44);
      detail=stTileGrad(tRockNrm2,uv,1.0,du,dv);
      float up=dot(L,N);
      vec2 towardSun=stGravelAxes*normalize((L-N*up).xz+vec2(0.00001));
      float blocker=stTileGrad(tRockNrm2,uv+towardSun*0.036,1.0,du,dv).b;
      contact-=close*0.58*smoothstep(0.025,0.34,blocker-detail.b-max(up,0.0)*0.36);
    }
    color=stTileGrad(tRockBasaltAlb,uv,1.0,du,dv);
  }
`;

export function sunVecFromAngles(azDeg, elDeg, out = new THREE.Vector3()) {
  const az = (azDeg || 0) * Math.PI / 180;
  const el = Math.max(6, Math.min(82, elDeg || 19)) * Math.PI / 180;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

export const DEFAULT_PBR_CONFIG = {
  style: 1.0,             /* 0 = original bake, 1 = full CC0 2K PBR matching index1-5-canyon-forest.html */
  /* 一、地形材質（深邃冷綠苔草＋大片風化層狀峽谷灰岩＋濕潤黑岩岸） */
  grassSat: 0.84,
  grassCoverage: 84,
  grassColor: '#346b5d',
  grassTipColor: '#829b79',
  grassMossColor: '#405a39',
  grassDryColor: '#ad9566',
  grassMossCoverage: 72,
  grassDryCoverage: 62,
  grassTipCoverage: 64,
  rockColor: '#56616a',
  rockLayerColor: '#adb0af',
  grassPbr: 1.18,
  rockSlope: 0.88,
  biomeContrast: 1.04,    /* 乾燥山脊／冷濕凹谷的生態色差 */
  cavityDepth: 0.48,      /* 相鄰高度場曲率的凹槽遮蔽強度 */
  strataStrength: 1.0,
  shoreWet: 1.12,         /* 河岸濕潤黑岩帶強度 */
  relief: 1.50,           /* 地形立體起伏（峽谷山脈感） */
  /* 二、河道與中央湖泊水體（細緻高空風紋＋順流河道激流／淺灘礫石／匯流羽流） */
  waterDeep: '#061829',   /* 深水區／湖心深冰川靛藍 */
  waterShallow: '#165266',/* 淺灘／岸邊清澈冰川青藍 */
  waterSpeed: 1.05,       /* 雙層水波流速 */
  waterWave: 1.0,         /* 高空比例波紋法線強度 */
  waterClear: 1.04,       /* 透過淺水看見礫石河床與水底焦散 */
  whitewater: 1.05,       /* 激流白浪與岸際細碎泡沫 */
  waterGlow: 0.88,        /* 全息光幕與 LOGO 水面反光光暈 */
  waveScale: 1.0,         /* 高空水波精細倍率（越小越細緻） */
  riverDetail: 1.0,       /* 河道順流絲紋、淺灘激流與匯流羽流細節 */
  /* 三、陽光光線與峽谷氛圍（對齊 index1-5-canyon-forest.html 清冷白陽＋鋼藍天空霧氣） */
  sunIntensity: 1.28,     /* 陽光強度 */
  sunShadow: 0.92,        /* 山脈真實陽光投射陰影 */
  sunRays: 0.42,
  sunAzimuth: 62,
  sunElevation: 24,
  mist: 0.36,             /* 遠景空氣透視，與低谷高度霧分開 */
  cloudStrength: 0.34,
  cloudShadow: 0,         /* 雲團投在地面的影子（0 = 無；rise 頁另設） */
  airWhite: 0,            /* 遠景霧白度（0 = 舊的藍灰） */
  mistColor: '#a8b8c7',   /* 谷底霧顏色（舊值） */
  valleyMist: 0.28,
  mistHeight: 0.64,       /* 水面以上的薄霧高度（場景單位） */
  contourOpacity: 0.07,
  contourInterval: 0.105,
  /* 四、材質細節融合（Magic Valley 森林樹冠/草坡細紋 + 山谷/textures 水文侵蝕法線/AO/岩紋 + 多色地貌） */
  detailFusion: 1.0,
  erosionRelief: 1.12,
  erosionAlbedo: 0.86,
  erosionAO: 0.88,
  canopyCover: 0.74,
  canopyRelief: 1.08,
  meadowGrain: 0.68,
  colorVariety: 1.0,
  alpineAccents: 1.0,
  layers: {
    tributaries: true,
    contours: true,
    terrainStyle: true,
    water: true,
    sunbeams: true,
    atmosphere: true,
    clouds: true,
    gulls: true
  }
};

/* ---------- Alpine sky: cool canyon fill with a warmer solar halo ---------- */
const SKY_DOME_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 wp = vec4(position + cameraPosition, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const SKY_DOME_VERT_OPT3 = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 wp = vec4(position + cameraPosition, 1.0);
    gl_Position = (projectionMatrix * viewMatrix * wp).xyww;
  }
`;

const ALPINE_SKY_GLSL = `
  float skHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float skNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(skHash(i), skHash(i + vec2(1.0, 0.0)), f.x), mix(skHash(i + vec2(0.0, 1.0)), skHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float skFbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * skNoise(p); p = mat2(0.8,-0.6,0.6,0.8) * p * 2.04 + vec2(7.3, 4.1); a *= 0.5; }
    return v;
  }

  vec3 stAlpineSky(vec3 d,float style,float clouds,float arrival) {
    if (uLattice > 0.45) return vec3(0.0025,0.0045,0.011);
    vec3 sunD = normalize(uSun);
    float h = clamp(d.y, 0.0, 1.0);

    /* Exact index1-5-canyon-forest.html steel-periwinkle alpine sky: #4e6c93 zenith -> #819cbe mid -> #c0cfe2 horizon */
    vec3 cZenith  = vec3(0.088, 0.165, 0.340);
    vec3 cMid     = vec3(0.245, 0.355, 0.545);
    vec3 cHorizon = vec3(0.545, 0.640, 0.770);
    vec3 cBelow   = vec3(0.265, 0.327, 0.401);

    vec3 sky = mix(cHorizon, cMid, smoothstep(0.0, 0.30, h));
    sky = mix(sky, cZenith, smoothstep(0.22, 0.85, h));

    /* Crisp bright cool-white alpine sun disc & luminous silver atmospheric halo (matching reference screenshot!) */
    float sunDot = max(dot(d, sunD), 0.0);
    float sunHalo = pow(sunDot, 4.0) * 0.28 + pow(sunDot, 22.0) * 0.52 + pow(sunDot, 260.0) * 2.10;
    sky += vec3(0.98, 0.97, 0.95) * sunHalo * clamp(uSunIntensity, 0.25, 1.8) * smoothstep(-0.08, 0.12, d.y);

    if (d.y > 0.01 && clouds > 0.0) {
      vec2 cuv = d.xz / (d.y + 0.22) * 0.85 + vec2(uTime * 0.002, -uTime * 0.001);
      float wisp = smoothstep(0.42, 0.78, skFbm(cuv * vec2(1.4, 2.4)) * 0.72 + skFbm(cuv * 3.8 + 2.4) * 0.28);
      float cMask = wisp * smoothstep(0.02, 0.18, d.y) * (1.0 - smoothstep(0.58, 0.95, d.y));
      vec3 cCol = mix(vec3(0.76, 0.82, 0.90), vec3(1.00, 0.99, 0.96), pow(sunDot, 2.0) * 0.78);
      sky = mix(sky, cCol, cMask * 0.64 * clouds);
    }

    sky = mix(cBelow, sky, smoothstep(-0.80, 0.015, d.y));
    sky = mix(vec3(0.005, 0.010, 0.015), sky, clamp(style, 0.0, 1.0));
    return mix(vec3(dot(sky,vec3(0.2126,0.7152,0.0722))),sky,smoothstep(0.12,0.93,arrival));
  }
`;

const SKY_DOME_FRAG = `
  uniform vec3 uSun;
  uniform float uTime,uSunIntensity,uLattice,uStyle,uCloudLayer,uArrival;
  varying vec3 vDir;
  ${ALPINE_SKY_GLSL}
  void main() {
    gl_FragColor=vec4(stAlpineSky(normalize(vDir),uStyle,uCloudLayer,uArrival),1.0);
    #include <colorspace_fragment>
  }
`;

/* ---------- Volumetric Alpine Sunlight Shafts (陽光光線 — visible dreamy golden-ivory shafts!) ---------- */
const SUNBEAM_VERT = `
  attribute vec4 aRay; /* x = seed, y = intensity, z = widthScale, w = layer */
  varying vec2 vUv;
  varying vec4 vRay;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vRay = aRay;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SUNBEAM_FRAG = `
  uniform float uTime, uRayStrength, uSunIntensity, uLattice;
  varying vec2 vUv;
  varying vec4 vRay;
  varying vec3 vWorld;
  varying vec3 vNormalW;

  float sbHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float sbNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sbHash(i), sbHash(i + vec2(1.0, 0.0)), f.x), mix(sbHash(i + vec2(0.0, 1.0)), sbHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    if (uRayStrength <= 0.002 || uLattice > 0.35) discard;
    float xEdge = sin(clamp(vUv.x, 0.0, 1.0) * 3.14159265);
    xEdge = xEdge * xEdge * xEdge;
    float yFade = smoothstep(0.0, 0.24, vUv.y) * pow(1.0 - vUv.y, 1.15);

    /* Distinct soft crepuscular sunlight streaks drifting slowly through alpine air */
    float seed = vRay.x;
    float drift = uTime * 0.028 + seed * 3.7;
    float nW = sbNoise(vec2(vUv.x * 5.2 + seed, drift * 0.35));
    float s1 = pow(0.5 + 0.5 * sin(vUv.x * 22.0 + drift + nW * 2.4), 2.4);
    float s2 = pow(0.5 + 0.5 * sin(vUv.x * 38.0 - drift * 0.65 + seed * 7.3), 3.0);
    float beams = 0.28 + 0.72 * (s1 * 0.65 + s2 * 0.35);

    vec3 V = normalize(cameraPosition - vWorld);
    float facing = abs(dot(normalize(vNormalW), V));
    float angleSoft = smoothstep(0.05, 0.48, facing);
    float groundSoft = smoothstep(0.10, 0.48, vWorld.y);

    /* Stronger warm shafts at oblique/low angles, delicate warm sunlit ray sweep from overhead */
    float obliqueBoost = mix(1.65, 1.05, smoothstep(0.45, 0.95, abs(V.y)));
    float alpha = xEdge * yFade * beams * angleSoft * groundSoft * vRay.y * uRayStrength * clamp(uSunIntensity, 0.35, 1.8) * obliqueBoost * 0.175;
    if (alpha < 0.001) discard;

    /* Crisp cool-silver-white alpine sunbeams matching index1-5-canyon-forest.html (zero heavy orange tint!) */
    vec3 rayCol = mix(vec3(0.76, 0.84, 0.94), vec3(1.00, 0.99, 0.94), 0.35 + 0.65 * vUv.y);
    gl_FragColor = vec4(rayCol * alpha, 1.0);
  }
`;


/* ---------- Adaptive High-Res Extended Relief Grid (37.0 x 30.84 World Units) ---------- */
function buildExtendedReliefGrid(width, depth, nx, nz, skirt, sn, water, sub) {
  /* Concentrate outer skirt mesh density in the visible mid-background (outDist 0..6) for crisp alpine ridges & gorge lips */
  const easeOut = t => (t * 0.54 + t * t * 0.46);
  const line = (n, size) => {
    const a = [];
    for (let i = 0; i < sn; i++) a.push(-size / 2 - skirt * easeOut((sn - i) / sn));
    for (let i = 0; i <= n; i++) a.push(-size / 2 + (size * i) / n);
    for (let i = 1; i <= sn; i++) a.push(size / 2 + skirt * easeOut(i / sn));
    return a;
  };
  const xs = line(nx, width), zs = line(nz, depth), cx = xs.length - 1, cz = zs.length - 1;
  const pos = [], idx = [];
  for (const z of zs) for (const x of xs) pos.push(x,0,z);
  // Spend vertices on the tributary banks. Coarse neighbours share the fine
  // edge vertices so a sloping bank stays closed even at a grazing angle.
  const fine = new Uint8Array(cx*cz), extra = new Map();
  if (water?.data) {
    for (let z=0;z<nz;z++) for (let x=0;x<nx;x++) {
      let low=255, high=0;
      for (const dz of [.12,.50,.88]) for (const dx of [.12,.50,.88]) {
        const px=Math.floor((x+dx)/nx*water.width), pz=Math.floor((z+dz)/nz*water.height);
        const cut=water.data[(pz*water.width+px)*4+3];
        low=Math.min(low,cut); high=Math.max(high,cut);
      }
      if (high-low>27 || (high>207 && high-low>12)) fine[(z+sn)*cx+x+sn]=1;
    }
  }
  const headwaterCells = REFINE_HEADWATERS ? refineHeadwaterBanks(fine,xs,zs,width,depth) : 0;
  function vertex(x,z) {
    const i=Math.floor(x/sub), j=Math.floor(z/sub), fx=x%sub, fz=z%sub;
    if (!fx && !fz) return j*(cx+1)+i;
    const key=z*(cx*sub+1)+x;
    if(extra.has(key)) return extra.get(key);
    const id=pos.length/3;
    pos.push(fx?THREE.MathUtils.lerp(xs[i],xs[i+1],fx/sub):xs[i],0,
             fz?THREE.MathUtils.lerp(zs[j],zs[j+1],fz/sub):zs[j]);
    extra.set(key,id);
    return id;
  }
  for (let j = 0; j < cz; j++) for (let i = 0; i < cx; i++) {
    const k=j*cx+i, x=i*sub, z=j*sub;
    if (fine[k]) {
      for(let dz=0;dz<sub;dz++) for(let dx=0;dx<sub;dx++) {
        const a=vertex(x+dx,z+dz), b=vertex(x+dx+1,z+dz);
        const c=vertex(x+dx,z+dz+1), d=vertex(x+dx+1,z+dz+1);
        idx.push(a,c,b,b,c,d);
      }
    } else {
      const a=j*(cx+1)+i, b=a+1, c=a+cx+1, d=c+1;
      const left=i>0 && fine[k-1], bottom=fine[k+cx], right=i<cx-1 && fine[k+1], top=fine[k-cx];
      if (!(left||bottom||right||top)) { idx.push(a,c,b,b,c,d); continue; }
      const loop=[a];
      if (left) for(let t=1;t<sub;t++) loop.push(vertex(x,z+t));
      loop.push(c);
      if (bottom) for(let t=1;t<sub;t++) loop.push(vertex(x+t,z+sub));
      loop.push(d);
      if (right) for(let t=sub-1;t>0;t--) loop.push(vertex(x+sub,z+t));
      loop.push(b);
      if (top) for(let t=sub-1;t>0;t--) loop.push(vertex(x+t,z));
      const centre=pos.length/3;
      pos.push((xs[i]+xs[i+1])*.5,0,(zs[j]+zs[j+1])*.5);
      for(let t=0;t<loop.length;t++) idx.push(centre,loop[t],loop[(t+1)%loop.length]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.userData.headwaterCells = headwaterCells;
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  const w = width + 2 * skirt, d = depth + 2 * skirt;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, 0), Math.hypot(w, d) / 2 + 3);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, 3.0, d / 2));
  return g;
}

const CORE_RIVER_PTS = [
  [-6.34,-3.65],[-5.85,-3.23],[-5.15,-3.21],[-4.55,-3.03],[-4.26,-2.59],[-3.51,-2.30],[-2.86,-1.99],[-2.64,-1.58],[-2.10,-1.39],[-1.39,-1.24],[-0.79,-0.83],
  [ 5.66,-3.76],[ 5.34,-3.23],[ 5.25,-2.80],[ 4.82,-2.57],[ 4.24,-2.49],[ 3.70,-2.26],[ 3.62,-1.91],[ 3.42,-1.46],[ 2.91,-1.31],[ 2.36,-1.20],[ 1.72,-1.19],[ 1.18,-0.88],
  [ 6.80, 3.78],[ 6.26, 3.14],[ 5.67, 2.78],[ 5.17, 2.68],[ 4.56, 2.41],[ 3.90, 2.30],[ 3.25, 2.33],[ 2.65, 2.17],[ 2.53, 1.60],[ 2.26, 1.15],[ 1.58, 0.91],[ 1.12, 0.58],
  [-6.98, 1.50],[-6.47, 1.38],[-6.00, 1.41],[-5.43, 1.27],[-4.95, 1.05],[-4.41, 0.70],[-4.04, 0.58],[-3.48, 0.53],[-2.98, 0.52],[-2.53, 0.50],[-2.27, 0.19],[-1.42, 0.06]
];
const CORE_RIVER_PT_GLSL = CORE_RIVER_PTS.map(([x, y]) => `vec2(${x.toFixed(2)},${y.toFixed(2)})`).join(',');
const WS_STREAMS = [
  [-6.26,-3.57,-0.76,-0.65,12.4,0.155,0.095,0.78,0.44,0.4],
  [ 5.58,-3.64, 0.50,-0.86,12.2,0.160,0.100,0.85,0.42,1.9],
  [-6.86, 1.47,-0.88, 0.47,12.0,0.155,0.095,0.74,0.46,3.1],
  [ 6.72, 3.68, 0.62, 0.78,12.0,0.165,0.105,0.82,0.40,5.2],
  [-8.20,-5.15,-0.22,-0.97, 8.8,0.130,0.048,0.62,0.68,1.1],
  [-9.65,-6.30,-0.98,-0.18, 8.2,0.120,0.048,0.56,0.74,2.6],
  [ 6.85,-5.65,-0.18,-0.98, 8.4,0.140,0.048,0.66,0.64,4.0],
  [ 7.65,-7.15, 0.88,-0.47, 8.8,0.130,0.048,0.58,0.70,0.7],
  [ 6.45,-4.95, 0.94,-0.34, 9.2,0.120,0.048,0.65,0.66,5.5],
  [-9.85, 3.05,-0.96,-0.26, 7.8,0.120,0.048,0.54,0.76,1.8],
  [-9.15, 2.85,-0.34, 0.94, 9.2,0.140,0.048,0.64,0.66,3.4],
  [ 7.55, 5.85,-0.26, 0.96, 8.8,0.140,0.050,0.64,0.64,2.2],
  [ 8.25, 7.25, 0.86, 0.51, 9.2,0.130,0.048,0.60,0.70,4.7]
];
const WS_A_GLSL = WS_STREAMS.map(([ox, oy, dx, dy]) => {
  const m = Math.hypot(dx, dy) || 1;
  return `vec4(${ox.toFixed(2)},${oy.toFixed(2)},${(dx / m).toFixed(6)},${(dy / m).toFixed(6)})`;
}).join(',');
const WS_B_GLSL = WS_STREAMS.map((s) => `vec4(${s[4]},${s[5]},${s[6]},${s[7]})`).join(',');
const WS_C_GLSL = WS_STREAMS.map((s) => `vec2(${s[8]},${s[9]})`).join(',');

/* RISE FALLS (team FT, 2026-11-23; docs/falls/BRIEF-20261123.md). Only where html[data-rise-falls] is set (the -ui page with ?falls=1): FALLS = the
   module falls/falls-shape.js, loaded by createStudioTerrainPbrLayer before the land is patched; everywhere else it stays null and every line
   below that reads it emits exactly the text of before. With it: the lake's basin becomes the gorge's rim (the land comes down to the water
   level all round it, the plateau water runs flat to the lip along the curtain's arc), the land inside the rim is not drawn (the gorge's own
   meshes stand there: falls/falls-gorge.js), and the fourth river's last reach is lowered in a smooth trough. */
let FALLS = null, FALLS_SINK = false;
const fallsLakeGlsl = noiseFn => `
    uniform vec2 uFallsSize;
    uniform float uFallsHeadland;
    ${FALLS.LIVE_GORGE_FIELD_GLSL}
    ${FALLS.LIP_GLSL}
    ${FALLS.BAND_GLSL}
    ${FALLS.LIVE_BAND_REACH_GLSL || FALLS.BAND_REACH_GLSL || 'float fallsBandReach(float t){ return fallsBand(t)*(0.15+0.36*max(0.0,sin(t))); }'}
    ${FALLS.LIVE_RIM_LIFT_GLSL}
    ${FALLS.LIVE_TROUGH_GLSL}
    float stFallsSd = 1.0;   /* the last point's distance to the rim (negative inside) */
    vec2 stFallsGF = vec2(1.0, 0.0);
    vec3 stCentralLakeBasin(vec2 p) {
      vec2 g = fallsGorgeField(p);
      stFallsSd = g.x;
      stFallsGF = g;
      float lip = fallsLip(g.y), band = fallsBand(g.y);
      float cragN = (${noiseFn}(p * 2.2 + vec2(-2.4, 5.1)) - 0.5) * 0.14
                  + (${noiseFn}(p * 5.8 + vec2(6.1, -3.3)) - 0.5) * 0.052;
      /* redo-s1: the plateau water runs flat and wide to the lip along the whole far arc (one horseshoe), narrower down the two side walls */
      float vary = ${noiseFn}(p * 0.72 + vec2(7.1, -3.4));
      float bay2 = ${noiseFn}(p * 1.45 + vec2(-5.3, 2.8));
      float reach = fallsBandReach(g.y) * (0.80 + 0.40 * vary + 0.22 * (bay2 - 0.5)) + 0.001;   /* redo-s2/s6: the shape's band width (falls-shape.js bandReachAt), with a ragged outer shore */
      float kerbW = 0.11 * (1.0 - lip);
      /* redo-s5: the two rivers' mouths follow their troughs (and so the opening sliders), not fixed rim angles */
      float mouth = clamp(max(fallsTrOut(p, g.x) / ${FALLS.FALLS_SHAPE.trough.drop.toFixed(4)}, fallsTrIn(p, g.x) / ${(FALLS.FALLS_SHAPE.inletTrough ? FALLS.FALLS_SHAPE.inletTrough.drop : 1).toFixed(4)}), 0.0, 1.0) * (1.0 - smoothstep(0.34, 0.74, g.x + cragN * 0.55));
      float wMask = max(band * smoothstep(kerbW * 0.45 - 0.001, kerbW + 0.001, g.x + cragN * 0.2) * (1.0 - smoothstep(reach * 0.30, reach * 0.80, g.x + cragN * 1.70)), mouth);   /* director fix2: under the falls' apron, never past it */
      /* ft-v9: gentle organic framing around the gorge; elevated dry headlands stay lush & sculpted above the waterfall notches */
      float shelf = mix(0.16 + 0.18 * vary, 0.02 + 0.14 * vary, lip) + reach * 0.72;
      float carve = 1.0 - smoothstep(shelf, shelf + mix(1.70 + 0.50 * vary, 1.05 + 0.65 * vary, lip), g.x + cragN * 2.1 + (vary - 0.5) * 0.34);   /* redo-s4: the dry rim's bank rises over a longer, gentler slope (no cut step) */
      float depth = max(band * 0.24 * (1.0 - smoothstep(0.0, reach * 1.15, g.x)), mouth * 0.30);   /* redo-s1: shallow, bright plateau water at the lip */
      return vec3(wMask, carve, depth);
    }
`;

/* Shared GLSL Watershed (exact geometry alignment with studio-light-curtain.js & studio-3d-lines.js) */
function makeWatershedGlsl(noiseFn, { omitMountain = false } = {}) {
  return `
    const vec2 ST_CR_PT[${CORE_RIVER_PTS.length}] = vec2[${CORE_RIVER_PTS.length}](${CORE_RIVER_PT_GLSL});
    const vec4 ST_WS_A[${WS_STREAMS.length}] = vec4[${WS_STREAMS.length}](${WS_A_GLSL});
    const vec4 ST_WS_B[${WS_STREAMS.length}] = vec4[${WS_STREAMS.length}](${WS_B_GLSL});
    const vec2 ST_WS_C[${WS_STREAMS.length}] = vec2[${WS_STREAMS.length}](${WS_C_GLSL});
    ${FALLS ? fallsLakeGlsl(noiseFn) : `float stLakeBasinR(vec2 p) {
      vec2 q = (p - vec2(0.122, -0.056)) / vec2(1.66, 1.42);
      float r = length(q);
      float ang = atan(q.y, q.x);
      float wobble = 0.085 * sin(ang * 3.0 + 0.7) + 0.055 * cos(ang * 5.0 - 1.2) + 0.035 * sin(ang * 7.0 + 2.4);
      float cove = (${noiseFn}(p * 1.45 + vec2(3.7, -2.1)) - 0.5) * 0.055;
      return r + wobble + cove;
    }
    vec3 stCentralLakeBasin(vec2 p) {
      float lr = stLakeBasinR(p);
      float cragN = (${noiseFn}(p * 3.1 + vec2(-2.4, 5.1)) - 0.5) * 0.095
                  + (${noiseFn}(p * 7.6 + vec2(6.1, -3.3)) - 0.5) * 0.036;
      float wMask = 1.0 - smoothstep(0.86, 1.00, lr + cragN * 0.45);
      /* Sheer jagged rocky canyon cliff precipice right outside waterline (ZERO flat beach apron!) */
      float carve = 1.0 - smoothstep(0.93, 1.17, lr + cragN);
      float depth = 1.0 - smoothstep(0.0, 1.02, lr);
      return vec3(wMask, carve, depth);
    }`}

    float stWsFbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 3; i++) {
        v += a * ${noiseFn}(p);
        p = mat2(0.80, -0.60, 0.60, 0.80) * p * 2.05 + vec2(9.3, 5.7);
        a *= 0.5;
      }
      return v;
    }

    float stSmax(float a, float b, float k) {
      float mn = min(a, b);
      if (mn <= 0.0) return max(a, b);
      float h = max(k - abs(a - b), 0.0) / k;
      return max(a, b) + h * h * min(mn, k * 0.25);
    }

    void stSegAcc(vec2 p, vec2 a, vec2 b, inout float minD, inout vec2 dirAcc) {
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      float d = length(pa - ba * h);
      minD = min(minD, d);
      /* C-infinity Gaussian tangent smoothing across river bends -> ZERO hard polyline seams! */
      dirAcc += normalize(ba) * exp(-d * 10.0);
    }

    vec3 stCoreRiversEx(vec2 p, out vec2 flowDir, out float outMinD) {
      flowDir = vec2(0.0);
      outMinD = 9.0;
      if (abs(p.x) > 7.55 || abs(p.y) > 4.45) return vec3(0.0);
      float minD = 9.0;
      vec2 bDir = vec2(0.0);

      /* Single data-driven loop (uniform-guarded trip count prevents ANGLE/FXC from unrolling 43 inline calls) */
      int s0 = 0, n0 = 0, s1 = 0, n1 = 0;
      if (p.x < 0.2) {
        if (p.y < 0.2)  { s0 = 0;  n0 = 10; }
        if (p.y > -0.4) { s1 = 35; n1 = 11; }
      } else if (p.x > 0.2) {
        if (p.y < 0.2)  { s0 = 11; n0 = 11; }
        if (p.y > -0.2) { s1 = 23; n1 = 11; }
      }
      int crTot = (uRelief > -1e4) ? (n0 + n1) : 0;
      for (int k = 0; k < crTot; k++) {
        int idx = k < n0 ? (s0 + k) : (s1 + (k - n0));
        stSegAcc(p, ST_CR_PT[idx], ST_CR_PT[idx + 1], minD, bDir);
      }

      outMinD = minD;
      if (minD > 1.2) return vec3(0.0);
      flowDir = length(bDir) > 1e-4 ? normalize(bDir) : vec2(0.0, 1.0);
      float bankRough = ${noiseFn}(p * 2.1 + vec2(4.2, -1.7));
      float nearLake = ${FALLS ? '1.0 - smoothstep(0.10, 1.25, stFallsSd)   /* RISE FALLS: the rivers widen toward the rim (stCentralLakeBasin ran on this point first) */' : '1.0 - smoothstep(1.3, 2.5, length(p - vec2(0.122, -0.056)))'};
      /* Generous continuous gorge floor strictly wider than water mask -> zero pinched rivers & zero water climbing cliffs! */
      float w = mix(0.124, 0.195, nearLake) * (0.86 + 0.28 * bankRough);
      float cragR = (${noiseFn}(p * 4.2 + vec2(1.9, -4.3)) - 0.5) * 0.030;
      float wmC = 1.0 - smoothstep(w * 0.56, w * 1.02, minD + cragR * 0.22);
      float shC = 1.0 - smoothstep(0.0, w * 1.02, minD);
      float carveC = 1.0 - smoothstep(w * 1.16, w * 1.88 + 0.08, minD + cragR);
      return vec3(wmC, carveC, shC);
    }

    vec3 stCoreRivers(vec2 p, out vec2 flowDir) {
      float tmpD;
      return stCoreRiversEx(p, flowDir, tmpD);
    }

    vec3 stStreamEx(vec2 p, vec2 o, vec2 d, float len, float w0, float w1, float amp, float freq, float ph, float bankRough, inout vec2 flowAcc, inout float flowW) {
      vec2 perp = vec2(-d.y, d.x);
      vec2 rel = p - o;
      float t = dot(rel, d);
      float s = dot(rel, perp);
      #ifdef STUDIO_HEADWATERS
      // Outside this bound the water, the rock bench and the broad valley
      // masks are all zero, even at maximum warp and channel width.
      float widest = max(w0, w1) * 1.62;
      float reachLimit = max(1.55 + 4.4 * widest, 0.68 + 6.4 * widest);
      if (t < -reachLimit || t > len + reachLimit || abs(s) > 1.36 * abs(amp) + reachLimit) return vec3(0.0);
      #endif
      float tc = clamp(t, 0.0, len);
      float u = tc / max(len, 0.001);
      float ramp = smoothstep(0.0, 1.35, tc);
      float meand = (sin(tc * freq + ph) + 0.36 * sin(tc * freq * 2.13 + ph * 1.7)) * amp * ramp;
      float dMeand = (cos(tc * freq + ph) * freq + 0.36 * cos(tc * freq * 2.13 + ph * 1.7) * freq * 2.13) * amp * ramp;
      float ds = abs(s - meand);
      float endD = max(0.0, max(-t, t - len));
      float dist = length(vec2(ds, endD));
      float wVar = 0.80 + 0.42 * bankRough;
      float w = mix(w0, w1, smoothstep(0.0, 1.0, u)) * wVar;
      #ifdef STUDIO_HEADWATERS
      // Alternate pools and narrow reaches. The first mouth remains aligned
      // with the existing main channel; inner bends retain a shallow shelf.
      float reach = smoothstep(0.12,1.45,tc);
      float bend = clamp(sin(tc*freq+ph)+0.65*sin(tc*freq*2.13+ph*1.7),-1.0,1.0);
      float bankSide = sign(s-meand);
      float pool = 0.5+0.5*sin(tc*1.34+ph*1.9)*sin(tc*.61+ph);
      w *= 1.0+reach*((pool-.5)*.34+bend*bankSide*.14);
      #endif
      /* Organic rocky shoreline irregularity (eliminates smooth geometric pipe look & sawtooth edges!) */
      float bankCrag = (${noiseFn}(p * 5.2 + vec2(2.7, -6.1)) - 0.5) * 0.026
                     + (${noiseFn}(p * 12.8 + vec2(-4.3, 3.9)) - 0.5) * 0.010;
      float wDist = max(0.0, dist + bankCrag * smoothstep(0.12, 0.85, tc));
      float wmS = 1.0 - smoothstep(w * 0.56, w * 1.04, wDist);
      float shS = 1.0 - smoothstep(0.0, w * 1.04, wDist);
      /* Flat valley riverbed floor strictly wider than water width -> outer river NEVER triggers triangle sawtooth zippers! */
      float flatFloor = max(w * 1.56, 0.16);
      float vSlope = 1.0 - smoothstep(flatFloor, w * 4.6 + 1.55, dist);
      float carve = pow(clamp(vSlope, 0.0, 1.0), 1.55);
      #ifdef STUDIO_HEADWATERS
      // Outside bend cuts rugged bedrock; inside bend opens into a gravel point-bar.
      // Wide flat floor toe ensures all water-overlapping vertices stay strictly at datum y=0.105!
      float cutSide = smoothstep(-0.70, 0.75, bend * bankSide);
      float gorgeBreak = (${noiseFn}(p * 2.5 + vec2(-5.4, 2.3)) - 0.5) * 0.24
                       + (${noiseFn}(p * 6.2 + vec2(3.1, 7.2)) - 0.5) * 0.10;
      float toe = w * mix(1.80, 1.54, cutSide);
      float debrisFan = smoothstep(0.36, 0.74, bankRough * 0.68 + pool * 0.32 + gorgeBreak * 0.45);
      float face = toe + (w * mix(1.88, 1.18, cutSide) + mix(0.11, 0.075, cutSide)) * (0.94 + 0.56 * debrisFan + gorgeBreak * 0.55);
      float channel = 1.0 - smoothstep(toe, face, dist + gorgeBreak * w * 0.42);
      float spur = cutSide * smoothstep(0.22, 0.76, bankRough * 0.65 + pool * 0.35);
      float benchEnd = face + (w + 0.08) * (0.28 + 1.20 * spur + gorgeBreak * 0.35);
      float shoulder = 1.0 - smoothstep(benchEnd, benchEnd + w * 1.35 + 0.11, dist);
      float valley = 1.0 - smoothstep(w * 2.2 + 0.08, w * 6.2 + 0.58, dist);
      float benchShare = 0.20 * spur;
      // Natural rugged cut-bank slopes with talus ramps (eliminates harsh vertical CNC trench step!)
      float wallShare = mix(0.40, 0.70, cutSide) * (1.0 - 0.24 * debrisFan);
      float carvedBank = channel * wallShare + shoulder * benchShare + valley * (1.0 - wallShare - benchShare);
      carve = mix(carve, carvedBank, reach * 0.92);
      /* Deeper glacial thalweg hugging steep cut-bank, shallower translucent point-bar on inside bend */
      shS *= mix(1.0, (0.58 + 0.38 * pool) * mix(0.80, 1.16, cutSide), reach);
      #endif
      if (wmS > 0.01) {
        vec2 downDir = -normalize(d + perp * clamp(dMeand, -1.2, 1.2));
        flowAcc += downDir * wmS;
        flowW += wmS;
      }
      return vec3(wmS, carve, shS);
    }

    vec3 stCombineStream(vec3 a, vec3 b) {
      return vec3(stSmax(a.x, b.x, 0.18), stSmax(a.y, b.y, 0.22), max(a.z, b.z));
    }

    vec3 stWatershedEx(vec2 p, float outD, out vec2 flowDir) {
      flowDir = vec2(0.0);
      float wRamp = smoothstep(0.0, 1.65, outD);
      vec2 warpMacro = vec2(stWsFbm(p * 0.26 + vec2(2.4, -3.8)), stWsFbm(p * 0.26 + vec2(-6.1, 4.9))) - 0.5;
      vec2 warpMicro = vec2(${noiseFn}(p * 1.45 + vec2(1.3, 8.2)), ${noiseFn}(p * 1.45 + vec2(-4.7, 2.1))) - 0.5;
      vec2 pw = p + (warpMacro * 2.15 + warpMicro * 0.34) * wRamp;
      float bankRough = ${noiseFn}(p * 0.95 + vec2(3.1, -5.2));

      vec3 r = vec3(0.0);
      vec2 fAcc = vec2(0.0);
      float fW = 0.0;

      /* Match core river mouth widths & exit tangents seamlessly via uniform-guarded loop (prevents 13x FXC inline blowup) */
      int wsCount = (uRelief > -1e4) ? ${WS_STREAMS.length} : 0;
      for (int i = 0; i < wsCount; i++) {
        vec4 sa = ST_WS_A[i];
        vec4 sb = ST_WS_B[i];
        vec2 sc = ST_WS_C[i];
        r = stCombineStream(r, stStreamEx(pw, sa.xy, sa.zw, sb.x, sb.y, sb.z, sb.w, sc.x, sc.y, bankRough, fAcc, fW));
      }

      flowDir = fW > 0.001 ? normalize(fAcc / fW) : vec2(0.0);
      return r;
    }

    vec3 stWatershed(vec2 p, float outD) {
      vec2 tmpF;
      return stWatershedEx(p, outD, tmpF);
    }

    float stDryShoulder(vec3 ws) {
      return (1.0-clamp(ws.y,0.0,1.0))*(1.0-smoothstep(0.04,0.36,ws.x));
    }${omitMountain ? '' : `
    float stAlpineMountainH(vec2 xz) {
      /* Domain-warped alpine massif with sharp branching spines, flank buttresses & eroded gullies (replaces smooth clay pillows!) */
      vec2 wWarp = vec2(
        ${noiseFn}(xz * 0.24 + vec2(3.7, -5.1)),
        ${noiseFn}(xz * 0.24 + vec2(-6.3, 2.9))
      ) - 0.5;
      vec2 xzw = xz + wWarp * 1.45;
      float v = 0.0, a = 0.50;
      vec2 p = xzw * 0.28 + vec2(4.1, -2.7);
      for (int i = 0; i < 4; i++) {
        float n = ${noiseFn}(p);
        v += a * mix(n, n * n * 1.42, 0.40);
        p = mat2(0.80, -0.60, 0.60, 0.80) * p * 2.06 + vec2(11.3, 6.7);
        a *= 0.48;
      }
      float crag1 = 1.0 - abs(${noiseFn}(xzw * 0.52 + vec2(-6.4, 3.9)) * 2.0 - 1.0);
      float crag2 = 1.0 - abs(${noiseFn}(mat2(0.80, -0.60, 0.60, 0.80) * xzw * 1.18 + vec2(5.1, -8.3)) * 2.0 - 1.0);
      float gully = 1.0 - abs(${noiseFn}(mat2(0.54, -0.84, 0.84, 0.54) * xzw * 2.15 + vec2(-3.4, 6.8)) * 2.0 - 1.0);
      float cragMix = crag1 * crag1 * 0.62 + crag2 * crag2 * 0.26 + gully * gully * 0.12;
      float mountain = 0.16 + v * 0.36 + cragMix * 0.22;
      #ifdef STUDIO_HEADWATERS
      vec2 strike = vec2(dot(xzw, vec2(0.87, 0.49)), dot(xzw, vec2(-0.49, 0.87)));
      float massif = smoothstep(0.14, 0.74, v);
      float foldAxis = ${noiseFn}(strike * vec2(0.33, 0.74) + vec2(2.7 + 1.35 * v, -5.6)) * 2.0 - 1.0;
      float fold = 1.0 - smoothstep(0.0, 0.92, abs(foldAxis));
      float rib1 = 1.0 - abs(${noiseFn}(strike * vec2(0.86, 1.72) + vec2(3.8, -7.2)) * 2.0 - 1.0);
      float rib2 = 1.0 - abs(${noiseFn}(strike * vec2(1.85, 3.30) + vec2(-7.1, 4.4)) * 2.0 - 1.0);
      float flank = 4.0 * fold * (1.0 - fold);
      mountain = 0.17 + massif * 0.44 + pow(fold, 1.55) * (0.11 + 0.24 * massif)
               + cragMix * (0.11 + 0.08 * massif)
               + flank * (rib1 * rib1 * 0.068 + rib2 * rib2 * 0.032) * (0.55 + 0.75 * massif);
      #endif
      return mountain;
    }

    float stOuterCarvedH(vec2 xz, vec3 ws) {
      float mH = stAlpineMountainH(xz);
      return 0.105 + (mH-0.105)*stDryShoulder(ws);
    }
    float stRockBankHeight(vec2 xz, float baseY, float carved, float relief) {
      float clearance = max(0.0, baseY-0.105);
      float lip = smoothstep(0.003,0.085,clearance) * (1.0-smoothstep(0.11,0.28,clearance));
      float brokenLip = 0.55 + 0.45*${noiseFn}(xz*2.8+vec2(3.7,-5.2));
      return 0.105 + (clearance+lip*0.068*relief*brokenLip)*pow(max(0.0,1.0-carved),0.58);
    }`}
  `;
}

/* ---------- OPT2 Zero-Loss GPU Bakes (Vertex Attributes + 2-Tile Grass Atlas + 1024x1024 Static Shadow & Hydro-Skip Field) ---------- */
function createOpt2GrassBiomeAtlas(renderer, grassWildAlb, mossAlb, maxAniso) {
  const tw = Math.min(1024, Math.max(256, grassWildAlb?.image?.width || mossAlb?.image?.width || 1024));
  const rt = new THREE.WebGLRenderTarget(tw * 2, tw, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    generateMipmaps: true,
    depthBuffer: false,
    stencilBuffer: false,
    colorSpace: THREE.NoColorSpace
  });
  rt.texture.anisotropy = maxAniso;
  rt.texture.name = 'OPT2 Grass Wild + Moss Guttered Atlas';
  const mat = new THREE.ShaderMaterial({
    uniforms: { tA: { value: grassWildAlb }, tB: { value: mossAlb } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      precision highp float;
      uniform sampler2D tA, tB;
      varying vec2 vUv;
      vec3 linToSrgb(vec3 c) {
        c = max(c, vec3(0.0));
        return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
      }
      void main() {
        bool second = vUv.x >= 0.5;
        vec2 p = vec2(second ? (vUv.x - 0.5) * 2.0 : vUv.x * 2.0, vUv.y);
        vec2 srcUv = (p - vec2(0.0625)) / 0.875;
        vec4 c = second ? texture2D(tB, srcUv) : texture2D(tA, srcUv);
        gl_FragColor = vec4(clamp(linToSrgb(c.rgb), 0.0, 1.0), c.a);
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  sc.add(quad);
  const prevRT = renderer.getRenderTarget(), prevTM = renderer.toneMapping, prevAC = renderer.autoClear, prevSc = renderer.getScissorTest();
  renderer.setScissorTest(false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = true;
  renderer.setRenderTarget(rt);
  renderer.render(sc, cam);
  renderer.setRenderTarget(prevRT);
  renderer.toneMapping = prevTM;
  renderer.autoClear = prevAC;
  renderer.setScissorTest(prevSc);
  quad.geometry.dispose();
  mat.dispose();
  return rt;
}

function createOpt2VertexBaker(renderer, atlas, studioUniforms) {
  if (!renderer.capabilities.isWebGL2 || !renderer.extensions.get('EXT_color_buffer_float')) return null;
  const mat = new THREE.ShaderMaterial({
    defines: { FOREST_RELIEF: 1, ...(REFINE_HEADWATERS ? { STUDIO_HEADWATERS: 1 } : {}) },
    uniforms: {
      tCanopy: atlas.uniforms.tCanopy,
      tWater: atlas.uniforms.tWater,
      uBounds: atlas.uniforms.uBounds,
      uYRange: atlas.uniforms.uYRange,
      uSkirt: atlas.uniforms.uSkirt,
      uCanopy: atlas.uniforms.uCanopy,
      uRelief: atlas.uniforms.uRelief,
      uTributaries: studioUniforms.uTributaries,
      uBakeDim: { value: new THREE.Vector2(1, 1) },
      uBakePass: { value: 0 }
    },
    vertexShader: `
      attribute float aBakeIdx;
      uniform sampler2D tCanopy, tWater;
      uniform vec4 uBounds, uSkirt;
      uniform vec2 uYRange, uBakeDim;
      uniform float uCanopy, uRelief, uTributaries, uBakePass;
      varying vec4 vBakeOut;
      vec2 forestMir(vec2 u){vec2 lo=uSkirt.xy,hi=1.-uSkirt.xy;u=mix(u,2.*hi-u,step(hi,u));return mix(u,2.*lo-u,step(u,lo));}
      float forestOut(vec2 u){return length(max(max(-u,u-1.),0.)/uBounds.zw);}
      float stVHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float stVNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(stVHash(i), stVHash(i + vec2(1.0, 0.0)), f.x),
                   mix(stVHash(i + vec2(0.0, 1.0)), stVHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      ${makeWatershedGlsl('stVNoise')}
      void main() {
        vec3 p = position;
        vec2 uvR = (p.xz - uBounds.xy) * uBounds.zw, uv = forestMir(uvR);
        vec4 c4 = texture2D(tCanopy, uv);
        vec3 c = c4.rgb;
        float ground = uYRange.x + c.r * uYRange.y;
        p.y = max(0.105 + (ground - 0.105) * uRelief + c.g * 0.12 * uCanopy, 0.105);
        vec3 outN = vec3(0.0, 1.0, 0.0);
        vec2 curv = vec2(0.0);
        float arr = c4.a;
        float stOutD = forestOut(uvR);
        vec3 stWS = (stOutD > 0.0005 || abs(p.x) > 4.2 || abs(p.z) > 2.2) ? stWatershed(p.xz, stOutD) : vec3(0.0);
        vec3 stLB = stCentralLakeBasin(p.xz);
        vec2 stVCRFlow;
        vec3 stVCR = stOutD <= 0.35 ? stCoreRivers(p.xz, stVCRFlow) : vec3(0.0);
        if (stOutD > 0.0005) {
          #ifdef STUDIO_HEADWATERS
          float mountain = stAlpineMountainH(p.xz);
          float bankLand = stDryShoulder(stWS);
          float carvedH = 0.105 + (mountain - 0.105) * bankLand * uRelief;
          #else
          float carvedH = 0.105 + (stOuterCarvedH(p.xz, stWS) - 0.105) * uRelief;
          #endif
          float blendO = smoothstep(0.0, 2.25, stOutD);
          float borderCarved = mix(p.y, 0.105, max(stWS.y, max(smoothstep(0.02, 0.30, stWS.x), stVCR.y)));
          float targetY = mix(borderCarved, carvedH, blendO);
          float rimEase = 1.0 - smoothstep(8.6, 11.4, stOutD) * 0.22;
          p.y = max(0.105, 0.105 + (targetY - 0.105) * rimEase);
          float epsO = 0.12;
          #ifdef STUDIO_HEADWATERS
          epsO = 0.055;
          #endif
          vec2 pxL = p.xz - vec2(epsO, 0.0), pxR = p.xz + vec2(epsO, 0.0);
          vec2 pzD = p.xz - vec2(0.0, epsO), pzU = p.xz + vec2(0.0, epsO);
          #ifdef STUDIO_HEADWATERS
          float ohL = stAlpineMountainH(pxL), ohR = stAlpineMountainH(pxR);
          float ohD = stAlpineMountainH(pzD), ohU = stAlpineMountainH(pzU);
          vec2 ridgeSlope = vec2(ohR - ohL, ohU - ohD) * (uRelief * rimEase / (2.0 * epsO));
          outN = vec3(-ridgeSlope.x, 1.0, -ridgeSlope.y) * max(0.001, (mountain - 0.105) * uRelief * rimEase);
          float centreH = mountain;
          #else
          float ohL = stOuterCarvedH(pxL, stWatershed(pxL, stOutD));
          float ohR = stOuterCarvedH(pxR, stWatershed(pxR, stOutD));
          float ohD = stOuterCarvedH(pzD, stWatershed(pzD, stOutD));
          float ohU = stOuterCarvedH(pzU, stWatershed(pzU, stOutD));
          outN = normalize(vec3(-(ohR - ohL) / (2.0 * epsO) * 2.35 * uRelief, 1.0, -(ohU - ohD) / (2.0 * epsO) * 2.35 * uRelief));
          float centreH = (carvedH - 0.105) / max(uRelief, 0.01) + 0.105;
          #endif
          float bend = ((ohL + ohR + ohD + ohU) * 0.25 - centreH) / epsO;
          curv = vec2(smoothstep(0.0025, 0.075, bend), smoothstep(0.0025, 0.068, -bend));
        } else {
          vec2 ec = vec2(0.16) * uBounds.zw;
          float hcL = texture2D(tCanopy, forestMir(uvR - vec2(ec.x, 0.0))).r;
          float hcR = texture2D(tCanopy, forestMir(uvR + vec2(ec.x, 0.0))).r;
          float hcD = texture2D(tCanopy, forestMir(uvR - vec2(0.0, ec.y))).r;
          float hcU = texture2D(tCanopy, forestMir(uvR + vec2(0.0, ec.y))).r;
          float bend = ((hcL + hcR + hcD + hcU) * 0.25 - c.r) * uYRange.y * uRelief / 0.16;
          curv = vec2(smoothstep(0.002, 0.052, bend), smoothstep(0.003, 0.060, -bend));
          float coreCarve = max(stLB.y, max(stVCR.y, max(stWS.y * smoothstep(2.4, 3.85, abs(p.z)), smoothstep(0.04, 0.42, stWS.x))));
          p.y = stRockBankHeight(p.xz, p.y, coreCarve, uRelief);
        }
        if (uTributaries > 0.5 && all(greaterThanEqual(uvR, vec2(0.0))) && all(lessThanEqual(uvR, vec2(1.0)))) {
          vec4 branch = texture2D(tWater, uvR);
          float bedY = 0.105 + branch.b * uYRange.y * uRelief;
          p.y = mix(p.y, min(p.y, bedY), branch.a);
        }
        vBakeOut = uBakePass < 0.5 ? vec4(p.y, outN) : vec4(curv, arr, 1.0);
        float row = floor((aBakeIdx + 0.25) / uBakeDim.x);
        float col = aBakeIdx - row * uBakeDim.x;
        gl_Position = vec4(((col + 0.5) / uBakeDim.x) * 2.0 - 1.0, ((row + 0.5) / uBakeDim.y) * 2.0 - 1.0, 0.0, 1.0);
        gl_PointSize = 1.0;
      }
    `,
    fragmentShader: 'precision highp float; varying vec4 vBakeOut; void main() { gl_FragColor = vBakeOut; }',
    depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending
  });
  let lastKey = '';
  return {
    bake(geometry) {
      if (!geometry) return;
      const key = `${atlas.uniforms.uRelief.value.toFixed(4)}|${studioUniforms.uTributaries.value > 0.5 ? 1 : 0}|${atlas.uniforms.uCanopy.value.toFixed(4)}`;
      if (key === lastKey && geometry.getAttribute('aStBake0')) return;
      lastKey = key;
      const pos = geometry.getAttribute('position');
      const N = pos.count;
      const W = Math.ceil(Math.sqrt(N)), H = Math.ceil(N / W);
      const rt = new THREE.WebGLRenderTarget(W, H, {
        format: THREE.RGBAFormat, type: THREE.FloatType,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        generateMipmaps: false, depthBuffer: false, stencilBuffer: false
      });
      const idxArr = new Float32Array(N);
      for (let i = 0; i < N; i++) idxArr[i] = i;
      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', pos);
      bGeo.setAttribute('aBakeIdx', new THREE.BufferAttribute(idxArr, 1));
      const pts = new THREE.Points(bGeo, mat);
      pts.frustumCulled = false;
      const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      sc.add(pts);
      mat.uniforms.uBakeDim.value.set(W, H);
      const buf0 = new Float32Array(W * H * 4), buf1 = new Float32Array(W * H * 4);
      const prevRT = renderer.getRenderTarget(), prevTM = renderer.toneMapping, prevAC = renderer.autoClear, prevSc = renderer.getScissorTest();
      renderer.setScissorTest(false);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.autoClear = true;
      renderer.setRenderTarget(rt);
      mat.uniforms.uBakePass.value = 0;
      renderer.render(sc, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf0);
      mat.uniforms.uBakePass.value = 1;
      renderer.render(sc, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf1);
      renderer.setRenderTarget(prevRT);
      renderer.toneMapping = prevTM;
      renderer.autoClear = prevAC;
      renderer.setScissorTest(prevSc);
      let a0 = geometry.getAttribute('aStBake0'), a1 = geometry.getAttribute('aStBake1');
      if (!a0 || a0.count !== N) {
        a0 = new THREE.BufferAttribute(new Float32Array(N * 4), 4);
        a1 = new THREE.BufferAttribute(new Float32Array(N * 4), 4);
        geometry.setAttribute('aStBake0', a0);
        geometry.setAttribute('aStBake1', a1);
      }
      a0.array.set(buf0.subarray(0, N * 4));
      a1.array.set(buf1.subarray(0, N * 4));
      a0.needsUpdate = true;
      a1.needsUpdate = true;
      bGeo.dispose();
      rt.dispose();
    },
    dispose() { mat.dispose(); }
  };
}

function createOpt2FieldBaker(renderer, atlas, studioUniforms, opt3Cloud = false) {
  const SIZE = 1024;
  const opts = {
    format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    generateMipmaps: false, depthBuffer: false, stencilBuffer: false,
    colorSpace: THREE.NoColorSpace
  };
  const rawRT = new THREE.WebGLRenderTarget(SIZE, SIZE, opts);
  const outRT = new THREE.WebGLRenderTarget(SIZE, SIZE, opts);
  outRT.texture.name = 'OPT2 Terrain Shadow + Hydro Reach Bake';

  const passAMat = new THREE.ShaderMaterial({
    defines: { ...(REFINE_HEADWATERS ? { STUDIO_HEADWATERS: 1 } : {}) },
    uniforms: {
      tCanopy: atlas.uniforms.tCanopy,
      tWater: atlas.uniforms.tWater,
      uBounds: atlas.uniforms.uBounds,
      uYRange: atlas.uniforms.uYRange,
      uSkirt: atlas.uniforms.uSkirt,
      uCanopy: atlas.uniforms.uCanopy,
      uRelief: atlas.uniforms.uRelief,
      uSun: atlas.uniforms.uSun,
      uTributaries: studioUniforms.uTributaries
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      precision highp float;
      uniform sampler2D tCanopy, tWater;
      uniform vec4 uBounds, uSkirt;
      uniform vec2 uYRange;
      uniform vec3 uSun;
      uniform float uCanopy, uRelief, uTributaries;
      varying vec2 vUv;
      vec2 forestMir(vec2 u){vec2 lo=uSkirt.xy,hi=1.-uSkirt.xy;u=mix(u,2.*hi-u,step(hi,u));return mix(u,2.*lo-u,step(u,lo));}
      float forestOut(vec2 u){return length(max(max(-u,u-1.),0.)/uBounds.zw);}
      float forestHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float forestNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(forestHash(i),forestHash(i+vec2(1.,0.)),f.x),mix(forestHash(i+vec2(0.,1.)),forestHash(i+vec2(1.)),f.x),f.y);}
      ${makeWatershedGlsl('forestNoise')}
      void main() {
        vec2 wp = vec2(-19.0, -16.0) + vUv * vec2(38.0, 32.0);
        vec2 uvR = (wp - uBounds.xy) * uBounds.zw, uv = forestMir(uvR);
        float outD = forestOut(uvR);
        vec3 c = texture2D(tCanopy, uv).rgb;
        float ground = uYRange.x + c.r * uYRange.y;
        float baseH = max(0.105 + (ground - 0.105) * uRelief + c.g * 0.12 * uCanopy, 0.105);
        vec2 wsFlow;
        vec3 ws = (outD > 0.0005 || abs(wp.x) > 4.2 || abs(wp.y) > 2.2) ? stWatershedEx(wp, outD, wsFlow) : vec3(0.0);
        vec3 lb = outD <= 0.12 ? stCentralLakeBasin(wp) : vec3(0.0);
        vec2 crFlow; float crMinD = 9.0;
        vec3 cr = outD <= 0.35 ? stCoreRiversEx(wp, crFlow, crMinD) : vec3(0.0);
        if (outD > 0.0005) {
          #ifdef STUDIO_HEADWATERS
          float mountain = stAlpineMountainH(wp);
          float carvedH = 0.105 + (mountain - 0.105) * stDryShoulder(ws) * uRelief;
          #else
          float carvedH = 0.105 + (stOuterCarvedH(wp, ws) - 0.105) * uRelief;
          #endif
          float blendO = smoothstep(0.0, 2.25, outD);
          float borderCarved = mix(baseH, 0.105, max(ws.y, max(smoothstep(0.02, 0.30, ws.x), cr.y)));
          float targetY = mix(borderCarved, carvedH, blendO);
          float rimEase = 1.0 - smoothstep(8.6, 11.4, outD) * 0.22;
          baseH = max(0.105, 0.105 + (targetY - 0.105) * rimEase);
        } else {
          float coreCarve = max(lb.y, max(cr.y, max(ws.y * smoothstep(2.4, 3.85, abs(wp.y)), smoothstep(0.04, 0.42, ws.x))));
          baseH = stRockBankHeight(wp, baseH, coreCarve, uRelief);
        }
        float branch = 0.0;
        if (uTributaries > 0.5 && all(greaterThanEqual(uvR, vec2(0.0))) && all(lessThanEqual(uvR, vec2(1.0)))) {
          vec4 br = texture2D(tWater, uvR);
          branch = br.a;
          baseH = mix(baseH, min(baseH, 0.105 + br.b * uYRange.y * uRelief), br.a);
        }
        /* Exact stTerrainSunShadow visibility (before uSunShadow mix) */
        vec3 sunDir = normalize(uSun);
        vec2 sunXZ = sunDir.xz / max(length(sunDir.xz), 0.001);
        float tanEl = sunDir.y / max(length(sunDir.xz), 0.001);
        float visCore = 1.0;
        if (outD < 1.15) {
          vec2 uv1 = forestMir((wp + sunXZ * 0.42 - uBounds.xy) * uBounds.zw);
          vec2 uv2 = forestMir((wp + sunXZ * 1.25 - uBounds.xy) * uBounds.zw);
          float h1 = max(0.105, 0.105 + (uYRange.x + texture2D(tCanopy, uv1).r * uYRange.y - 0.105) * uRelief);
          float h2 = max(0.105, 0.105 + (uYRange.x + texture2D(tCanopy, uv2).r * uYRange.y - 0.105) * uRelief);
          if (branch > 0.01) {
            vec4 b1 = texture2D(tWater, uv1), b2 = texture2D(tWater, uv2);
            h1 = mix(h1, min(h1, 0.105 + b1.b * uYRange.y * uRelief), b1.a);
            h2 = mix(h2, min(h2, 0.105 + b2.b * uYRange.y * uRelief), b2.a);
          }
          float o1 = smoothstep(-0.015, 0.095, h1 - (baseH + tanEl * 0.42));
          float o2 = smoothstep(-0.015, 0.145, h2 - (baseH + tanEl * 1.25));
          visCore = 1.0 - max(o1, o2) * 0.84;
        }
        float visOuter = 1.0;
        if (outD > 0.04 && outD < 10.6) {
          float rimFade = 1.0 - smoothstep(7.8, 10.6, outD);
          float rimEase = 1.0 - smoothstep(8.6, 11.4, outD) * 0.22;
          float oh1 = 0.105 + (stAlpineMountainH(wp + sunXZ * 0.52) - 0.105) * uRelief * rimEase;
          float oh2 = 0.105 + (stAlpineMountainH(wp + sunXZ * 1.38) - 0.105) * uRelief * rimEase;
          float oh3 = 0.105 + (stAlpineMountainH(wp + sunXZ * 2.55) - 0.105) * uRelief * rimEase;
          float oo1 = smoothstep(-0.012, 0.085, oh1 - (baseH + tanEl * 0.52));
          float oo2 = smoothstep(-0.015, 0.130, oh2 - (baseH + tanEl * 1.38));
          float oo3 = smoothstep(-0.018, 0.185, oh3 - (baseH + tanEl * 2.55));
          visOuter = 1.0 - max(oo1, max(oo2, oo3 * 0.88)) * 0.80 * rimFade;
        }
        float vis = mix(visCore, visOuter, smoothstep(0.04, 1.15, outD));
        float wsFlag = max(ws.x, max(ws.y, ws.z)) > 0.0001 ? 1.0 : 0.0;
        float crFlag = (outD <= 0.10 && crMinD < 1.24) ? 1.0 : 0.0;
        float lbFlag = (outD <= 0.10 && stLakeBasinR(wp) < 1.32) ? 1.0 : 0.0;
        ${opt3Cloud
          ? 'gl_FragColor = vec4(clamp(vis, 0.0, 1.0), wsFlag, max(crFlag, lbFlag), clamp((baseH - 0.105) * 0.25, 0.0, 1.0));'
          : 'gl_FragColor = vec4(clamp(vis, 0.0, 1.0), wsFlag, crFlag, lbFlag);'}
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending
  });

  /* Pass B: conservative 5x5 dilation (radius ~2 texels = ~0.075 world units) of reach flags so dFdx/dFdy & bilinear filter are 100% bit-exact */
  const passBMat = new THREE.ShaderMaterial({
    uniforms: { tRaw: { value: rawRT.texture }, uTexel: { value: new THREE.Vector2(1 / SIZE, 1 / SIZE) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      precision highp float;
      uniform sampler2D tRaw;
      uniform vec2 uTexel;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tRaw, vUv);
        vec3 m = c.gba;
        for (int dy = -2; dy <= 2; dy++) {
          for (int dx = -2; dx <= 2; dx++) {
            if (dx == 0 && dy == 0) continue;
            m = max(m, texture2D(tRaw, clamp(vUv + vec2(float(dx), float(dy)) * uTexel, vec2(0.0005), vec2(0.9995))).gba);
          }
        }
        ${opt3Cloud ? 'gl_FragColor = vec4(c.r, m.x, m.y, 1.0);' : 'gl_FragColor = vec4(c.r, m);'}
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending
  });

  /* OPT3 Cloud Shadow Bake: evaluates exact 16-bank stCloudVisibility3 at 512x512 (~0.2 ms every 120 ms)
     and writes it into outRT.a via colorMask(false,false,false,true), saving ~8.2 ms/frame on 2726x1533 terrain! */
  const cloudRT = opt3Cloud ? new THREE.WebGLRenderTarget(512, 512, opts) : null;
  const cloudMat = opt3Cloud ? new THREE.ShaderMaterial({
    uniforms: {
      tRaw: { value: rawRT.texture },
      uTime: atlas.uniforms.uTime,
      uBiomeContrast: studioUniforms.uBiomeContrast,
      uCavityDepth: studioUniforms.uCavityDepth,
      uCloudStrength: studioUniforms.uCloudStrength,
      uBankShadow: studioUniforms.uBankShadow,
      uMistColor: studioUniforms.uMistColor,
      uValleyMist: studioUniforms.uValleyMist,
      uMistHeight: studioUniforms.uMistHeight,
      uArrival: studioUniforms.uArrival,
      uArrivalMap: studioUniforms.uArrivalMap
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      precision highp float;
      uniform sampler2D tRaw;
      uniform float uTime;
      varying vec2 vUv;
      float forestHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float forestNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(forestHash(i),forestHash(i+vec2(1.,0.)),f.x),mix(forestHash(i+vec2(0.,1.)),forestHash(i+vec2(1.)),f.x),f.y);}
      float stFbm2(vec2 p){return forestNoise(p)*0.67+forestNoise(mat2(0.80,-0.60,0.60,0.80)*p*2.04+vec2(7.3,4.1))*0.33;}
      ${HIGHLAND_GLSL}
      void main() {
        vec2 wp = vec2(-19.0, -16.0) + vUv * vec2(38.0, 32.0);
        float baseH = 0.105 + texture2D(tRaw, vUv).a * 4.0;
        float v = clamp(stCloudVisibility3(vec3(wp.x, baseH, wp.y)), 0.0, 1.0);
        gl_FragColor = vec4(v, v, v, v);
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending
  }) : null;
  const alphaBlitMat = opt3Cloud ? new THREE.ShaderMaterial({
    uniforms: { tCloud: { value: cloudRT.texture } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'precision highp float; uniform sampler2D tCloud; varying vec2 vUv; void main(){ float v = texture2D(tCloud, vUv).r; gl_FragColor = vec4(0.0, 0.0, 0.0, v); }',
    depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending
  }) : null;

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quadA = new THREE.Mesh(quadGeo, passAMat); quadA.frustumCulled = false;
  const quadB = new THREE.Mesh(quadGeo, passBMat); quadB.frustumCulled = false;
  const scA = new THREE.Scene(); scA.add(quadA);
  const scB = new THREE.Scene(); scB.add(quadB);
  const scC = opt3Cloud ? (() => { const s = new THREE.Scene(); const q = new THREE.Mesh(quadGeo, cloudMat); q.frustumCulled = false; s.add(q); return s; })() : null;
  const scBlit = opt3Cloud ? (() => { const s = new THREE.Scene(); const q = new THREE.Mesh(quadGeo, alphaBlitMat); q.frustumCulled = false; s.add(q); return s; })() : null;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let lastKey = '', lastCloudAt = -1e9, lastCloudKey = '';
  const updateClouds = (force = false) => {
    if (!opt3Cloud || !lastKey) return;
    const now = performance.now();
    const bs = studioUniforms.uBankShadow.value;
    const cKey = `${bs.x.toFixed(3)}|${bs.y.toFixed(3)}|${bs.z.toFixed(3)}|${bs.w.toFixed(3)}|${studioUniforms.uCloudStrength.value.toFixed(3)}`;
    if (!force && cKey === lastCloudKey && now - lastCloudAt < 120) return;
    lastCloudAt = now;
    lastCloudKey = cKey;
    const gl = renderer.getContext();
    const prevRT = renderer.getRenderTarget(), prevTM = renderer.toneMapping, prevAC = renderer.autoClear, prevSc = renderer.getScissorTest();
    try {
      renderer.setScissorTest(false);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.autoClear = false;
      renderer.setRenderTarget(cloudRT);
      renderer.render(scC, cam);
      renderer.setRenderTarget(outRT);
      gl.colorMask(false, false, false, true);
      renderer.render(scBlit, cam);
    } finally {
      gl.colorMask(true, true, true, true);
      renderer.setRenderTarget(prevRT);
      renderer.toneMapping = prevTM;
      renderer.autoClear = prevAC;
      renderer.setScissorTest(prevSc);
    }
  };
  return {
    texture: outRT.texture,
    opt3Cloud,
    bake() {
      const s = atlas.uniforms.uSun.value;
      const key = `${s.x.toFixed(4)}|${s.y.toFixed(4)}|${s.z.toFixed(4)}|${atlas.uniforms.uRelief.value.toFixed(4)}|${studioUniforms.uTributaries.value > 0.5 ? 1 : 0}|${atlas.uniforms.uCanopy.value.toFixed(4)}`;
      if (key === lastKey) return;
      lastKey = key;
      const prevRT = renderer.getRenderTarget(), prevTM = renderer.toneMapping, prevAC = renderer.autoClear, prevSc = renderer.getScissorTest();
      renderer.setScissorTest(false);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.autoClear = true;
      renderer.setRenderTarget(rawRT);
      renderer.render(scA, cam);
      renderer.setRenderTarget(outRT);
      renderer.render(scB, cam);
      renderer.setRenderTarget(prevRT);
      renderer.toneMapping = prevTM;
      renderer.autoClear = prevAC;
      renderer.setScissorTest(prevSc);
      if (opt3Cloud) updateClouds(true);
    },
    updateClouds,
    dispose() {
      quadGeo.dispose(); passAMat.dispose(); passBMat.dispose(); rawRT.dispose(); outRT.dispose();
      cloudMat?.dispose(); alphaBlitMat?.dispose(); cloudRT?.dispose();
    }
  };
}

/* ---------- Patch Terrain + Unified Water Material (16/16 WebGL Texture Units!) ---------- */
function patchTerrainAndWater(atlas, pbrTex, studioUniforms, opt2Bake = null) {
  let patched = false;
  const seen = new Set();
  const useFieldBake = !!(opt2Bake && opt2Bake.fieldTex && opt2Bake.grassAtlasTex);
  const useOpt3Cloud = useFieldBake && !!(opt2Bake && opt2Bake.opt3Cloud);
  const useVertBake = !!(opt2Bake && opt2Bake.vertexBaked);

  if (atlas.uniforms?.uSkirt) atlas.uniforms.uSkirt.value.set(3.5 / 1494, 3.5 / 836, 0.0, 0.0);
  if (atlas.uniforms?.uSkirtAir) atlas.uniforms.uSkirtAir.value.set(99.0, 120.0);

  const coreW = atlas.uniforms?.uBounds ? (1.0 / atlas.uniforms.uBounds.value.z) : 14.0;
  const coreD = atlas.uniforms?.uBounds ? (1.0 / atlas.uniforms.uBounds.value.w) : 7.84;
  let reliefGrid;

  atlas.terrain.traverse(obj => {
    if (!obj.isMesh || !obj.material) return;
    if (obj.geometry && !obj.userData.pbrExtended) {
      const oldGeo = obj.geometry;
      reliefGrid ??= buildExtendedReliefGrid(coreW,coreD,CORE_COLUMNS,CORE_ROWS,11.5,112,
        atlas.uniforms.tWater.value.image,opt2bGridSub() || (matchMedia('(pointer: coarse)').matches?2:3));   /* OPT2 team B: see opt2bGridSub */
      obj.geometry = reliefGrid;
      obj.frustumCulled = false;
      obj.userData.pbrExtended = true;
      oldGeo.dispose?.();
    }
    if (opt2Bake && obj.geometry && obj.userData.pbrExtended) opt2Bake.grid = obj.geometry;

    if (seen.has(obj.material)) return;
    seen.add(obj.material);
    const mat = obj.material;
    if (!mat.fragmentShader || mat.fragmentShader.includes('uPbrStyle')) return;
    if (REFINE_HEADWATERS) mat.defines.STUDIO_HEADWATERS = 1;

    /* Free ALL unused native passes & samplers (only 3 native remain: tWater, tCanopy, tRefl; dead tPlate stripped!)
       -> 3 native + 9 CC0 PBR/Shore/Water + 4 Magic Valley / 山谷 Fusion = 16/16 WebGL texture units!
       When useFieldBake is active: tGrassWildAlb + tMossAlb pack into tGrassBiomeAtlas (1 unit) freeing unit #16 for tStFieldBake! */
    if (mat.defines) {
      delete mat.defines.FOREST_LOGO;
      delete mat.defines.FOREST_GROW;
      delete mat.defines.FOREST_LAKEVIDEO;
      delete mat.defines.FOREST_WATER3D;
      delete mat.defines.FOREST_RIVER;
      delete mat.defines.FOREST_WATER;
      delete mat.defines.FOREST_DETAIL;
      delete mat.defines.FOREST_LIGHT;
    }

    Object.assign(mat.uniforms, {
      tGrassAlb:      { value: pbrTex.grassAlb },
      ...(useFieldBake
        ? { tGrassBiomeAtlas: { value: opt2Bake.grassAtlasTex }, tStFieldBake: { value: opt2Bake.fieldTex } }
        : { tGrassWildAlb: { value: pbrTex.grassWildAlb }, tMossAlb: { value: pbrTex.mossAlb } }),
      tGrassNrm:      { value: pbrTex.grassNrm },
      tRockAlb:       { value: pbrTex.rockAlb },
      tRockBasaltAlb: { value: pbrTex.rockBasaltAlb },
      tRockNrm:       { value: pbrTex.rockNrm },
      tRockNrm2:      { value: pbrTex.rockNrm2 },
      tWaterNrm:      { value: pbrTex.waterNrm },
      tSgErosionAlb:  { value: pbrTex.sgErosionAlb },
      tSgErosionNrm:  { value: pbrTex.sgErosionNrm },
      tMvCanopyAlb:   { value: pbrTex.mvCanopyAlb },
      tMvCanopyNrm:   { value: pbrTex.mvCanopyNrm },
      uDetailFusion:  studioUniforms.uDetailFusion,
      uCanopyParams:  studioUniforms.uCanopyParams,
      uColorParams:   studioUniforms.uColorParams,
      uRiverDetail:   studioUniforms.uRiverDetail,
      uCanyonWater:   studioUniforms.uCanyonWater,
      uSatDrape:      studioUniforms.uSatDrape,
      uPbrStyle:     studioUniforms.uPbrStyle,
      uPbrTerrainOn: studioUniforms.uPbrTerrainOn,
      uGrassPbr: studioUniforms.uGrassPbr,
      uGrassSat: studioUniforms.uGrassSat,
      uMeadowBase: studioUniforms.uMeadowBase,
      uMeadowTips: studioUniforms.uMeadowTips,
      uMeadowMoss: studioUniforms.uMeadowMoss,
      uMeadowDry: studioUniforms.uMeadowDry,
      uMeadowLayerCover: studioUniforms.uMeadowLayerCover,
      uRockBaseGain: studioUniforms.uRockBaseGain,
      uRockLayerGain: studioUniforms.uRockLayerGain,
      uGrassCover: studioUniforms.uGrassCover,
      uRockSlope: studioUniforms.uRockSlope,
      uShoreWet: studioUniforms.uShoreWet,
      uSunIntensity: studioUniforms.uSunIntensity,
      uSunShadow: studioUniforms.uSunShadow,
      uStudioMist: studioUniforms.uStudioMist,
      uBiomeContrast: studioUniforms.uBiomeContrast,
      uCavityDepth: studioUniforms.uCavityDepth,
      uStrataStrength: studioUniforms.uStrataStrength,
      uCloudLayer: studioUniforms.uCloudLayer,
      uCloudStrength: studioUniforms.uCloudStrength,
      uAirWhite: studioUniforms.uAirWhite,
      uBankShadow: studioUniforms.uBankShadow,
      uMistColor: studioUniforms.uMistColor,
      uValleyMist: studioUniforms.uValleyMist,
      uMistHeight: studioUniforms.uMistHeight,
      uArrival: studioUniforms.uArrival,
      uArrivalMap: studioUniforms.uArrivalMap,
      uTributaries: studioUniforms.uTributaries,
      uTributaryTexel: studioUniforms.uTributaryTexel,
      uContours: studioUniforms.uContours,
      uContourInterval: studioUniforms.uContourInterval,
      uEntrySurvey: studioUniforms.uEntrySurvey,
      uWaterDeep: studioUniforms.uWaterDeep,
      uWaterShallow: studioUniforms.uWaterShallow,
      uWaterSpeed: studioUniforms.uWaterSpeed,
      uWaterWave: studioUniforms.uWaterWave,
      uWaterClear: studioUniforms.uWaterClear,
      uWhitewater: studioUniforms.uWhitewater,
      uWaterGlow: studioUniforms.uWaterGlow,
      uWaterOn: studioUniforms.uWaterOn,
      uCurtainGlow: studioUniforms.uCurtainGlow,
      uCurtainCol: studioUniforms.uCurtainCol,
      uCurtainContact: studioUniforms.uCurtainContact,
      uCurtainLogo: studioUniforms.uCurtainLogo,
      uFallsSize: studioUniforms.uFallsSize,
      uFallsHeadland: studioUniforms.uFallsHeadland,
      uFallsDrop: studioUniforms.uFallsDrop   /* redo-s5: the depth slider (falls-gorge.js keeps it current; 0 = the shape's default) */
    });

    if (mat.vertexShader && !mat.vertexShader.includes('stWatershed') && !mat.vertexShader.includes('aStBake0')) {
      if (useVertBake) {
        /* OPT2: static terrain displacement, outer normal, curvature & arrival pre-baked on GPU into aStBake0/aStBake1 (bit-exact, 0 VS noise/taps per frame!) */
        mat.vertexShader = `
          attribute vec4 aStBake0;
          attribute vec4 aStBake1;
          varying vec3 vForestWorld;
          varying vec3 vStOutN;
          varying vec2 vStCurvature;
          varying float vStArrival;
          void main() {
            vec3 p = vec3(position.x, aStBake0.x, position.z);
            vStOutN = aStBake0.yzw;
            vStCurvature = aStBake1.xy;
            vStArrival = aStBake1.z;
            vec4 w = modelMatrix * vec4(p, 1.0);
            vForestWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `;
      } else {
      const vFuncs = `
        uniform sampler2D tWater;
        uniform float uTributaries;
        varying vec3 vStOutN;
        varying vec2 vStCurvature;
        varying float vStArrival;${FALLS ? `
        varying float vStFallsLow;   /* RISE FALLS: how far this point is lowered by the fourth river's trough */` : ''}
        float stVHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float stVNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(stVHash(i), stVHash(i + vec2(1.0, 0.0)), f.x),
                     mix(stVHash(i + vec2(0.0, 1.0)), stVHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        ${makeWatershedGlsl('stVNoise')}
      `;
      const vInject = `
        vStOutN = vec3(0.0, 1.0, 0.0);
        vStCurvature = vec2(0.0);
        #ifdef FOREST_RELIEF
        vStArrival = texture2D(tCanopy, uv).a;
        float stOutD = forestOut(uvR);
        vec3 stWS = (stOutD > 0.0005 || abs(p.x) > 4.2 || abs(p.z) > 2.2) ? stWatershed(p.xz, stOutD) : vec3(0.0);
        vec3 stLB = stCentralLakeBasin(p.xz);
        vec2 stVCRFlow;
        vec3 stVCR = stOutD <= 0.35 ? stCoreRivers(p.xz, stVCRFlow) : vec3(0.0);
        if (stOutD > 0.0005) {
          #ifdef STUDIO_HEADWATERS
          float mountain = stAlpineMountainH(p.xz);
          float bankLand = stDryShoulder(stWS);
          float carvedH = 0.105 + (mountain - 0.105) * bankLand * uRelief;
          #else
          float carvedH = 0.105 + (stOuterCarvedH(p.xz, stWS) - 0.105) * uRelief;
          #endif
          float blendO = smoothstep(0.0, 2.25, stOutD);
          float borderCarved = mix(p.y, 0.105, max(stWS.y, max(smoothstep(0.02, 0.30, stWS.x), stVCR.y)));
          float targetY = mix(borderCarved, carvedH, blendO);
          float rimEase = 1.0 - smoothstep(8.6, 11.4, stOutD) * 0.22;
          p.y = max(0.105, 0.105 + (targetY - 0.105) * rimEase);
          /* Outer normal and curvature share the existing per-vertex height taps. */
          float epsO = 0.12;
          #ifdef STUDIO_HEADWATERS
          epsO=0.055;
          #endif
          vec2 pxL = p.xz - vec2(epsO, 0.0), pxR = p.xz + vec2(epsO, 0.0);
          vec2 pzD = p.xz - vec2(0.0, epsO), pzU = p.xz + vec2(0.0, epsO);
          #ifdef STUDIO_HEADWATERS
          // Only the ridge needs four height taps. Differentiate the river
          // incision from the fragment's existing field, not four more sets
          // of thirteen tributaries per vertex. Y carries uncut height.
          float ohL = stAlpineMountainH(pxL), ohR = stAlpineMountainH(pxR);
          float ohD = stAlpineMountainH(pzD), ohU = stAlpineMountainH(pzU);
          vec2 ridgeSlope = vec2(ohR-ohL, ohU-ohD) * (uRelief*rimEase/(2.0*epsO));
          vStOutN = vec3(-ridgeSlope.x, 1.0, -ridgeSlope.y) * max(0.001, (mountain-0.105)*uRelief*rimEase);
          float centreH = mountain;
          #else
          float ohL = stOuterCarvedH(pxL, stWatershed(pxL, stOutD));
          float ohR = stOuterCarvedH(pxR, stWatershed(pxR, stOutD));
          float ohD = stOuterCarvedH(pzD, stWatershed(pzD, stOutD));
          float ohU = stOuterCarvedH(pzU, stWatershed(pzU, stOutD));
          vStOutN = normalize(vec3(-(ohR - ohL) / (2.0 * epsO) * 2.35 * uRelief, 1.0, -(ohU - ohD) / (2.0 * epsO) * 2.35 * uRelief));
          float centreH = (carvedH - 0.105) / max(uRelief, 0.01) + 0.105;
          #endif
          float bend = ((ohL + ohR + ohD + ohU) * 0.25 - centreH) / epsO;
          vStCurvature = vec2(smoothstep(0.0025, 0.075, bend), smoothstep(0.0025, 0.068, -bend));
        } else {
          // Meso-scale curvature: four height taps per existing vertex.
          vec2 ec = vec2(0.16) * uBounds.zw;
          float hcL = texture2D(tCanopy, forestMir(uvR - vec2(ec.x, 0.0))).r;
          float hcR = texture2D(tCanopy, forestMir(uvR + vec2(ec.x, 0.0))).r;
          float hcD = texture2D(tCanopy, forestMir(uvR - vec2(0.0, ec.y))).r;
          float hcU = texture2D(tCanopy, forestMir(uvR + vec2(0.0, ec.y))).r;
          float bend = ((hcL + hcR + hcD + hcU) * 0.25 - c.r) * uYRange.y * uRelief / 0.16;
          vStCurvature = vec2(smoothstep(0.002, 0.052, bend), smoothstep(0.003, 0.060, -bend));
          ${FALLS ? `float riverCarve = max(stVCR.y, smoothstep(0.10, 0.55, stWS.x));
          p.y = stRockBankHeight(p.xz,p.y,riverCarve,uRelief);
          /* RISE FALLS (ft-v6): ease the gorge's outer basin gently down in an S-curve (no sheer circular cliff ring) */
          float fE = smoothstep(0.0, 1.0, stLB.y);
          p.y = mix(p.y, 0.105, fE * fE * (3.0 - 2.0 * fE) * 0.96 + fE * 0.04);
          /* director 2026-11-24: no flat pale shelf round the rim: past the band water's ragged edge the land rises as a low, uneven mossy bank */
          { float bR = fallsBandReach(stFallsGF.y), bn = stVNoise(p.xz * 6.3 + vec2(3.1, -1.7)) * 0.6 + stVNoise(p.xz * 17.0 + vec2(-4.2, 2.6)) * 0.4;
            float bE = stFallsGF.x - bR * (0.78 + 0.44 * bn) - 0.035;
            p.y += fE * smoothstep(-0.02, 0.30, bE) * (0.022 + 0.05 * bn) * (1.0 - smoothstep(0.0, 0.45, fallsTrough(p.xz))); }` : `float coreCarve = max(stLB.y, max(stVCR.y, max(stWS.y * smoothstep(2.4, 3.85, abs(p.z)), smoothstep(0.04, 0.42, stWS.x))));
          /* Sculpt sheer rocky cliff precipices right at the waterline (replaces flat sandy ramps with steep stepped rock bluffs!) */
          p.y = stRockBankHeight(p.xz,p.y,coreCarve,uRelief);`}
        }
        if (uTributaries > 0.5 && all(greaterThanEqual(uvR,vec2(0.0))) && all(lessThanEqual(uvR,vec2(1.0)))) {
          vec4 branch = texture2D(tWater,uvR);
          float bedY = 0.105 + branch.b * uYRange.y * uRelief;
          p.y = mix(p.y,min(p.y,bedY),branch.a);
        }${FALLS ? `
        vStFallsLow = fallsTrough(p.xz);   /* RISE FALLS: the land and the river sink together toward the outlet */
        p.y -= vStFallsLow;
        p.y += fallsRimLift(stFallsGF);   /* ft-v9: elevated mossy canyon headlands between the 3 waterfalls (watertight with falls-gorge rimY) */${FALLS_SINK ? `
        if (stFallsSd < 0.0) p.y = -1.9;   /* ?fallsSink=1 (cost study): inside the rim the land goes down under the pool instead of the discard */` : ''}` : ''}
        #endif
        vec4 w=modelMatrix*vec4(p,1.);
      `;
      mat.vertexShader = mat.vertexShader
        .replace('void main(){', vFuncs + '\nvoid main(){')
        .replace('vec4 w=modelMatrix*vec4(p,1.);', vInject);
      }
    }

    const decls = `
      varying vec3 vStOutN;
      varying vec2 vStCurvature;
      varying float vStArrival;${FALLS ? `
      varying float vStFallsLow;` : ''}
      uniform vec2 uYRange;
      uniform float uRelief;
      #ifdef FOREST_MIRROR
      uniform sampler2D tRefl;
      uniform mat4 uReflMat;
      uniform float uMirror;
      #endif
      ${useFieldBake
        ? 'uniform sampler2D tGrassAlb, tGrassBiomeAtlas, tStFieldBake, tGrassNrm;\n      vec3 stSrgbToLin(vec3 c) { return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878); }'
        : 'uniform sampler2D tGrassAlb, tGrassWildAlb, tMossAlb, tGrassNrm;'}
      uniform sampler2D tRockAlb, tRockBasaltAlb, tRockNrm, tRockNrm2, tWaterNrm;
      uniform sampler2D tSgErosionAlb, tSgErosionNrm, tMvCanopyAlb, tMvCanopyNrm;
      uniform vec4 uDetailFusion, uCanopyParams, uColorParams, uRiverDetail;
      uniform vec4 uCanyonWater;   /* CANYON WATER: amount on rivers · amount on the lake · - · - */
      uniform vec4 uSatDrape;      /* SATELLITE DRAPE: amount · patch scale · contrast · - */
      uniform float uPbrStyle, uPbrTerrainOn, uGrassPbr, uGrassSat, uRockSlope, uShoreWet, uGrassCover;
      uniform float uSunIntensity, uSunShadow, uStudioMist;
      uniform float uTributaries, uContours, uContourInterval, uEntrySurvey;
      uniform vec2 uTributaryTexel;
      uniform vec3 uWaterDeep, uWaterShallow, uCurtainCol, uCurtainContact;
      uniform float uWaterSpeed, uWaterWave, uWaterClear, uWaterGlow, uWaterOn, uCurtainGlow;
      uniform float uStrataStrength, uWhitewater, uCloudLayer;
      uniform float uAirWhite;
      uniform vec3 uRockBaseGain,uRockLayerGain;
      uniform vec4 uCurtainLogo;

      uniform vec3 uMeadowBase,uMeadowTips,uMeadowMoss,uMeadowDry;
      uniform vec3 uMeadowLayerCover; // moss, dry grass, blade tips
      vec3 stMeadowCover(vec3 habitat) {
        // Grow the footprint from favourable ground outwards. Zero clears
        // the whole layer, including the most favourable habitat.
        vec3 edge=mix(vec3(1.16),vec3(.28),uMeadowLayerCover);
        vec3 cover=smoothstep(edge-.14,edge+.14,clamp(habitat,0.0,1.0));
        cover.y*=1.0-.62*cover.x;
        cover.z*=1.0-.36*cover.y;
        return cover;
      }
      vec3 stMeadowDye(vec3 source,vec3 cover) {
        float value=dot(source,vec3(.2126,.7152,.0722));
        vec3 grain=clamp(source/max(.005,value),.63,1.45);
        vec3 pigment=mix(uMeadowBase/.12,uMeadowMoss/.11,cover.x);
        pigment=mix(pigment,uMeadowDry/.30,cover.y);
        pigment=mix(pigment,uMeadowTips/.29,cover.z);
        return value*pigment*mix(vec3(1.0),grain,.23);
      }
      vec3 stGrassAlbedo(vec4 scan) {
        return scan.r*scan.r*vec3(.94,1.037,.81);
      }
      vec3 stUnpackNrm(vec2 rg) {
        vec2 xy = rg * 2.0 - 1.0;
        return vec3(xy, sqrt(max(0.02, 1.0 - dot(xy, xy))));
      }
      vec3 stSat(vec3 c, float s) {
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        return max(vec3(0.0), mix(vec3(l), c, s));
      }
      float stGrassCover(float up,float rockExposure,float pocket) {
        float rooting=up-0.22*rockExposure+pocket+(0.88-uRockSlope)*0.30;
        float threshold=mix(1.32,0.14,uGrassCover);
        return smoothstep(threshold-0.112,threshold+0.122,rooting);
      }
      float stFbm2(vec2 p) {
        return forestNoise(p) * 0.67 + forestNoise(mat2(0.80, -0.60, 0.60, 0.80) * p * 2.04 + vec2(7.3, 4.1)) * 0.33;
      }
      vec2 stCreekCurrent(vec2 uv) {
        // Filter circular headings before converting back to a vector. Ordinary
        // byte interpolation reverses the current at the -pi / pi seam.
        vec2 grid=uv/uTributaryTexel-0.5;
        vec2 anchor=(floor(grid)+0.5)*uTributaryTexel, f=fract(grid);
        float h=texture2D(tCanopy,anchor).b;
        vec3 nearH=vec3(texture2D(tCanopy,anchor+vec2(uTributaryTexel.x,0.0)).b,
                        texture2D(tCanopy,anchor+vec2(0.0,uTributaryTexel.y)).b,
                        texture2D(tCanopy,anchor+uTributaryTexel).b);
        nearH=fract(nearH-h+0.5)-0.5;
        float turns=h+mix(nearH.x*f.x,mix(nearH.y,nearH.z,f.x),f.y);
        float angle=turns*6.2831853-3.14159265;
        return vec2(cos(angle),sin(angle));
      }
      ${HIGHLAND_GLSL}
      ${ALPINE_SKY_GLSL}
      ${SHORE_ATLAS_GLSL}
      ${GRAVEL_RELIEF_GLSL}
      ${makeWatershedGlsl('forestNoise', { omitMountain: useFieldBake })}

      ${useFieldBake ? '' : `/* Height-field self-shadows across BOTH core DEM valley AND outer alpine mountains & headwater gorges! */
      float stTerrainSunShadow(vec3 wPos, vec3 sunDir, float outD, float branch) {
        if (uSunShadow <= 0.005) return 1.0;
        vec2 sunXZ = sunDir.xz / max(length(sunDir.xz), 0.001);
        float tanEl = sunDir.y / max(length(sunDir.xz), 0.001);
        float baseH = max(wPos.y, 0.105);
        float visCore = 1.0;
        if (outD < 1.15) {
          vec2 uv1 = forestMir((wPos.xz + sunXZ * 0.42 - uBounds.xy) * uBounds.zw);
          vec2 uv2 = forestMir((wPos.xz + sunXZ * 1.25 - uBounds.xy) * uBounds.zw);
          float h1 = max(0.105, 0.105 + (uYRange.x + texture2D(tCanopy, uv1).r * uYRange.y - 0.105) * uRelief);
          float h2 = max(0.105, 0.105 + (uYRange.x + texture2D(tCanopy, uv2).r * uYRange.y - 0.105) * uRelief);
          if (branch > 0.01) {
            vec4 b1 = texture2D(tWater, uv1), b2 = texture2D(tWater, uv2);
            h1 = mix(h1, min(h1, 0.105 + b1.b * uYRange.y * uRelief), b1.a);
            h2 = mix(h2, min(h2, 0.105 + b2.b * uYRange.y * uRelief), b2.a);
          }
          float o1 = smoothstep(-0.015, 0.095, h1 - (baseH + tanEl * 0.42));
          float o2 = smoothstep(-0.015, 0.145, h2 - (baseH + tanEl * 1.25));
          visCore = 1.0 - max(o1, o2) * 0.84;
        }
        float visOuter = 1.0;
        if (outD > 0.04 && outD < 10.6) {
          float rimFade = 1.0 - smoothstep(7.8, 10.6, outD);
          float rimEase = 1.0 - smoothstep(8.6, 11.4, outD) * 0.22;
          float oh1 = 0.105 + (stAlpineMountainH(wPos.xz + sunXZ * 0.52) - 0.105) * uRelief * rimEase;
          float oh2 = 0.105 + (stAlpineMountainH(wPos.xz + sunXZ * 1.38) - 0.105) * uRelief * rimEase;
          float oh3 = 0.105 + (stAlpineMountainH(wPos.xz + sunXZ * 2.55) - 0.105) * uRelief * rimEase;
          float oo1 = smoothstep(-0.012, 0.085, oh1 - (baseH + tanEl * 0.52));
          float oo2 = smoothstep(-0.015, 0.130, oh2 - (baseH + tanEl * 1.38));
          float oo3 = smoothstep(-0.018, 0.185, oh3 - (baseH + tanEl * 2.55));
          visOuter = 1.0 - max(oo1, max(oo2, oo3 * 0.88)) * 0.80 * rimFade;
        }
        float vis = mix(visCore, visOuter, smoothstep(0.04, 1.15, outD));
        return mix(1.0, vis, clamp(uSunShadow, 0.0, 1.2));
      }`}
    `;

    const inject = `
      /* =============================================================================================
         STANDALONE CC0 2K PBR TERRAIN + UNIFIED DUAL-NORMAL GLACIAL WATER + CANYON-FOREST SUNLIGHT
         ============================================================================================= */
      if (uPbrTerrainOn > 0.001) {
        float stAmt = clamp(uPbrStyle, 0.0, 1.25) * uPbrTerrainOn;
        float pbrAmt = clamp(uGrassPbr, 0.0, 1.6) * uPbrTerrainOn;
        float outDist = forestOut(uvR);

        /* Shared world basis (GLSL ES 1.00 compatible: explicit transposes, shared across terrain & water!) */
        vec2 wp = vForestWorld.xz;
        mat2 rotP  = mat2(0.80, -0.60, 0.60, 0.80);
        mat2 rotPT = mat2(0.80,  0.60, -0.60, 0.80);
        mat2 rotQ  = mat2(0.54, -0.84, 0.84, 0.54);
        mat2 rotQT = mat2(0.54,  0.84, -0.84, 0.54);
        vec3 sunNS = normalize(uSun);
        vec3 viewV = normalize(cameraPosition - vForestWorld);

        /* Exact index1-5-canyon-forest.html daylight split: crisp luminous cool-ivory sun + moody steel-periwinkle shadow fill! */
        vec3 sunKeyCol  = vec3(2.12, 1.99, 1.72) * clamp(uSunIntensity, 0.25, 2.0);
        vec3 skyFillCol = vec3(0.16, 0.24, 0.35);
        vec3 bounceCol  = vec3(0.065, 0.077, 0.085);

        /* Ultra-fast planar reflection pass (uMirror > 0.5): 2 texture taps instead of 28 -> saves ~35% GPU frame time! */
        #ifdef FOREST_MIRROR
        if (uMirror > 0.5) {
          vec2 eM = 1.6 / PX;
          float mL = texture2D(tCanopy, uv - vec2(eM.x, 0.0)).r;
          float mR = texture2D(tCanopy, uv + vec2(eM.x, 0.0)).r;
          float mD = texture2D(tCanopy, uv - vec2(0.0, eM.y)).r;
          float mU = texture2D(tCanopy, uv + vec2(0.0, eM.y)).r;
          vec3 mN = normalize(vec3(-(mR - mL) * 14.0 * uRelief, 1.0, -(mU - mD) * 14.0 * uRelief));
          if (outDist > 0.0005) mN = normalize(mix(mN, normalize(vStOutN), smoothstep(0.0, 2.25, outDist)));
          vec4 mScan=texture2D(tGrassAlb,wp*.48);
          vec3 mGrass=stGrassAlbedo(mScan)*vec3(.40,.66,.48);
          float mUp=smoothstep(.12,.72,(vForestWorld.y-.105)/max(.25,(uYRange.x+uYRange.y-.105)*uRelief));
          float mFacing=smoothstep(-.38,.46,dot(mN.xz,normalize(sunNS.xz)));
          vec3 mHabitat=vec3(.22+.29*(1.0-mUp)+.18*(1.0-mFacing)+.20*vStCurvature.x+.23*mScan.g,
                             .13+.32*mUp+.20*mFacing+.18*vStCurvature.y+.20*(1.0-mScan.g),
                             .16+.43*mScan.g+.16*mFacing+.08*mScan.b);
          mGrass=stMeadowDye(mGrass,stMeadowCover(mHabitat));
          vec3 mRock  = texture2D(tRockAlb, wp * 1.15).rgb*uRockBaseGain;
          float mSlope = 1.0 - smoothstep(uRockSlope - 0.16, uRockSlope + 0.025, mN.y);
          float mirroredGrass=stGrassCover(mN.y,mSlope,0.0);
          vec3 mAlb = mix(mRock,stSat(mGrass,clamp(uGrassSat,0.2,2.0)),mirroredGrass);
          float mLit = smoothstep(0.02, 0.88, clamp(dot(mN, sunNS), 0.0, 1.0)) * ${useOpt3Cloud ? 'texture2D(tStFieldBake, stBakeUv).a' : 'stCloudVisibility(wp)'};
          vec3 mCol = mAlb * (skyFillCol * (0.45 + 0.55 * max(0.0, mN.y)) + sunKeyCol * mLit);
          mCol = mCol / (1.0 + mCol * 0.22);
          col = mix(col, mCol, clamp(stAmt, 0.0, 1.0));
        } else
        #endif
        {
        float pxW = max(length(fwidth(wp)), 1e-4);
        float nearDetail = 1.0 - smoothstep(0.012, 0.068, pxW);
        float headwaterMix=0.0;
        #ifdef STUDIO_HEADWATERS
        vec2 coreEdge=max(uBounds.xy-wp,wp-(uBounds.xy+1.0/uBounds.zw));
        headwaterMix=smoothstep(-.80,1.30,max(coreEdge.x,coreEdge.y));
        #endif

        /* Skip 13 outer watershed streams across the entire central valley, lake, AND far-from-stream outer slopes (bit-exact via dilated bake mask)! */
        vec2 wsFlow = vec2(0.0);
        vec3 ws = (${useFieldBake ? 'stBake.g > 0.004 && ' : ''}(outDist > 0.0005 || abs(wp.x) > 4.2 || abs(wp.y) > 2.2)) ? stWatershedEx(wp, outDist, wsFlow) : vec3(0.0);
        vec3 lb = stLB0;
        float wsFade = 1.0 - smoothstep(8.2, 10.8, outDist);
        float wsWm = ws.x * wsFade;
        /* RIVERS (2026-11-24): where a river leaves the plate, the outer stream starts as a wide flat sheet (the grey mouth with straight
           facets at the right edge); near the edge keep only its channel (ws.z = toward the channel's middle), widening back further out */
        wsWm *= mix(1.0, smoothstep(0.32, 0.64, ws.z), 1.0 - smoothstep(0.5, 2.4, outDist));

        /* Smooth border crossfade across outDist=0 -> eliminates pinched dark seam & sawtooth zipper above 上市櫃投資! */
        float outBlend = smoothstep(0.0, 0.35, outDist);   /* RIVERS (2026-11-24): .55 → .35 (with the narrowing below) */
        /* RIVERS (2026-11-24, client 「繼續修」): the plate's own river widens into a blob where it meets the plate's edge and the mirrored copy is
           then cut along a straight line, next to the narrower outer stream (the pale mouth with straight sides at the right edge). Within 7 %
           of the edge (and across it) the plate's water keeps only its channel, following its own banks (shore = toward the middle), so it
           arrives at the edge as narrow as the outer stream it joins */
        float dEdgeIn = min(min(uvR.x, 1.0 - uvR.x), min(uvR.y, 1.0 - uvR.y));
        float nearEdge = 1.0 - smoothstep(0.0, 0.07, dEdgeIn);
        float wmEdge = wm * mix(1.0, smoothstep(0.30, 0.66, shore), nearEdge);
        float outerDistF = smoothstep(0.0, 2.2, outDist);
        float stWm = mix(max(wmEdge, wsWm), wsWm, outBlend);
        float stShore = mix(max(shore, ws.z * smoothstep(0.02, 0.28, wsWm)), ws.z, outBlend);
        float stLakeN = outDist > 0.0005 ? 0.0 : lakeN;

        /* The main rivers share the lake datum. Branch water follows its
           sloping bed with room for a shallow shelf at the waterline. */
        float branchY=0.105+wt.b*uYRange.y*uRelief;
        float branchGate=smoothstep(0.60,0.96,stBranch)*(1.0-smoothstep(0.034,0.12,vForestWorld.y-branchY));
        float yClampLo = mix(0.111, 0.122, outBlend);
        float yClampHi = mix(0.128, 0.165, outBlend);
        float stWmSafe=max(stWm*(1.0-smoothstep(yClampLo,yClampHi,vForestWorld.y${FALLS ? '+vStFallsLow' : ''})),wt.r*branchGate);
        float creekMix=smoothstep(0.44,0.94,stBranch)*smoothstep(0.055,0.34,stCRDist0)*(1.0-stLakeN);
        float waterBlend = (uWaterOn > 0.5) ? smoothstep(0.08, 0.48, stWmSafe) : 0.0;
        float landM = 1.0 - smoothstep(0.18, 0.62, stWmSafe);
        // Differentiate the actual incision mask in world XZ. The uncut
        // height map alone would project top-face textures down a carved wall.
        float innerCut=max(${FALLS ? 'lb.y*0.18' : 'lb.y'},stCR0.y);
        #ifdef STUDIO_HEADWATERS
        float outerCut = 1.0 - stDryShoulder(ws);
        innerCut = mix(innerCut, outerCut, headwaterMix);
        #endif
        vec2 px=dFdx(wp),py=dFdy(wp),cutDiff=vec2(dFdx(innerCut),dFdy(innerCut));
        float det=px.x*py.y-px.y*py.x;
        vec2 cutGrad=vec2(cutDiff.x*py.y-px.y*cutDiff.y,px.x*cutDiff.y-cutDiff.x*py.x)*
                     (sign(det)/max(abs(det),1e-10));

        /* Real-time mountain cast shadow + monumental slow-drifting cloud shadows (${useOpt3Cloud ? 'OPT3: reads 512x512 GPU-cached stCloudVisibility3 from stBake.a!' : 'matching flow2-valley5-light.js!'}) */
        float cloudSh = ${useOpt3Cloud ? 'stBake.a' : 'stCloudVisibility3(vec3(wp.x, vForestWorld.y, wp.y))'};
        float sunVis = ${useFieldBake ? 'mix(1.0, stBake.r, clamp(uSunShadow, 0.0, 1.2))' : 'stTerrainSunShadow(vForestWorld, sunNS, outDist, stBranch)'} * cloudSh;

        /* -------------------- PART 1: CC0 2K PBR TERRAIN (DUAL-SCALE GRASS + TRIPLANAR SLATE CLIFFS + TIGHT WET SHORE) -------------------- */
        if (landM > 0.001) {
          /* Accurate world-space terrain normal (skip 4 DEM taps when outDist >= 2.25 where outer mountain normal replaces sN 100%) */
          vec3 sN = vec3(0.0, 1.0, 0.0);
          if (outDist < 2.25) {
            vec2 eS = 1.35 / PX;
            float hL = texture2D(tCanopy, uv - vec2(eS.x, 0.0)).r;
            float hR = texture2D(tCanopy, uv + vec2(eS.x, 0.0)).r;
            float hD = texture2D(tCanopy, uv - vec2(0.0, eS.y)).r;
            float hU = texture2D(tCanopy, uv + vec2(0.0, eS.y)).r;
            if (stBranch > 0.005) {
              vec4 bL=texture2D(tWater,uv-vec2(eS.x,0.0)), bR=texture2D(tWater,uv+vec2(eS.x,0.0));
              vec4 bD=texture2D(tWater,uv-vec2(0.0,eS.y)), bU=texture2D(tWater,uv+vec2(0.0,eS.y));
              float bedZero=(0.105-uYRange.x)/uYRange.y;
              hL=mix(hL,min(hL,bedZero+bL.b),bL.a); hR=mix(hR,min(hR,bedZero+bR.b),bR.a);
              hD=mix(hD,min(hD,bedZero+bD.b),bD.a); hU=mix(hU,min(hU,bedZero+bU.b),bU.a);
            }
            float sgnX = (uvR.x < uSkirt.x || uvR.x > 1.0 - uSkirt.x) ? -1.0 : 1.0;
            float sgnZ = (uvR.y < uSkirt.y || uvR.y > 1.0 - uSkirt.y) ? -1.0 : 1.0;
            // Convert height differences to world gradients; a fixed multiplier
            // flattened the slope as the source height-map resolution changed.
            vec2 normalScale = uYRange.y * uRelief * uBounds.zw / (2.0 * eS);
            sN = normalize(vec3(-(hR - hL) * normalScale.x * sgnX, 1.0, -(hU - hD) * normalScale.y * sgnZ));

            if (innerCut>0.001 && outDist<=0.0005) {
              float uncut=max(.0,(uYRange.x+(hL+hR+hD+hU)*.25*uYRange.y-.105)*uRelief);
              float left=max(.035,1.0-innerCut);
              vec2 faceSlope=-sN.xz/max(.06,sN.y)*pow(left,.58)-
                             clamp(cutGrad,-22.0,22.0)*(.58*(uncut+.028)*pow(left,-.42));
              vec3 carved=normalize(vec3(-faceSlope.x,1.0,-faceSlope.y));
              sN=normalize(mix(sN,carved,.84*smoothstep(.005,.09,innerCut)*(1.0-smoothstep(.91,.998,innerCut))));
            }
          }
          if (outDist > 0.0005) {
            #ifdef STUDIO_HEADWATERS
            // The gradient of (ridge height × land fraction) follows the
            // same incised surface as the mesh throughout the bend.
            vec2 ridgeSlope = -vStOutN.xz / max(0.001, vStOutN.y);
            vec2 slope = ridgeSlope*(1.0-outerCut) - vStOutN.y*clamp(cutGrad,-22.0,22.0);
            vec3 bankNormal = normalize(vec3(-slope.x*1.32, 1.0, -slope.y*1.32));
            sN = normalize(mix(sN, bankNormal, smoothstep(0.0, 2.25, outDist)));
            #else
            sN = normalize(mix(sN, normalize(vStOutN), smoothstep(0.0, 2.25, outDist)));
            #endif
          }
          float sunMacro = clamp(dot(sN, sunNS), 0.0, 1.0);

          /* Multi-scale organic domain warp & alpine biome zoning (fast 2-octave stFbm2 -> 4x faster ALU, ZERO grid repetition!) */
          vec2 warp = vec2(stFbm2(wp * 0.34 + vec2(3.1, -5.4)), stFbm2(wp * 0.34 + vec2(-6.7, 2.8))) - 0.5;
          vec2 wpW = wp + warp * 2.15;
          float patchMix    = stFbm2(wpW * 0.46 + vec2(4.2, -2.7));
          float macroBiomeA = stFbm2(wpW * 0.26 + vec2(11.4, -7.8));
          float macroBiomeB = forestNoise(wpW * 0.68 + vec2(-9.7, 13.2));
          float elevN = clamp((vForestWorld.y - 0.105) / max((uYRange.x + uYRange.y - 0.105) * uRelief, 0.25), 0.0, 1.0);
          float cavity = clamp(vStCurvature.x, 0.0, 1.0);
          float ridge = clamp(vStCurvature.y, 0.0, 1.0);
          float aspect = dot(sN.xz, normalize(sunNS.xz));
          float warmAspect = smoothstep(-0.12, 0.52, aspect);
          float coolAspect = 1.0 - smoothstep(-0.48, 0.10, aspect);
          float valleyFloor = 1.0 - smoothstep(0.10, 0.38, elevN);
          float exposed = smoothstep(0.36, 0.78, elevN);
          float coolHollow = clamp(cavity * 0.70 + valleyFloor * 0.46 + coolAspect * 0.30, 0.0, 1.0);
          float warmUpland = clamp(exposed * (0.76 + ridge * 0.24) + ridge * 0.28 + warmAspect * 0.16 - cavity * 0.35, 0.0, 1.0);
          /* Micro geological erosion ribs & highland heather/scree variation so treeless hills feel deeply detailed! */
          float erosionRib  = forestNoise(wp * 3.10 + warp * 1.4 + vec2(2.1, 7.6));
          float screeVeins  = smoothstep(0.48, 0.80, forestNoise(wpW * 1.15 + vec2(-4.8, 6.2)) * 0.70 + patchMix * 0.30);

          /* --- 1.0 UNIFIED TEXTURE DETAIL FUSION (山谷/textures hydraulic erosion + magic_valley canopy/meadow) --- */
          float fMix = clamp(uDetailFusion.x, 0.0, 1.5);
          float dryLand = smoothstep(0.008, 0.055, vForestWorld.y - 0.105) * landM;
          float fDry = fMix * dryLand;
          float steepF = smoothstep(0.04, 0.38, 1.0 - sN.y);
          vec3 eT = normalize(vec3(sN.y, -sN.x, 0.0));
          vec3 eB = normalize(cross(sN, eT));

          /* Dual-scale rotated + domain-warped 山谷/textures hydraulic erosion (zero tile repeat, zero macro tilt conflict) */
          vec2 sgNxy = vec2(0.0);
          float sgAO = 1.0, sgVein = 0.5, sgRough = 0.72;
          vec3 sgAlb = vec3(0.18);
          if (fDry > 0.002) {
            vec2 uvSg1 = rotP * wp * 0.21 + warp * 0.16 + vec2(0.17, 0.43);
            vec2 uvSg2 = rotQ * wp * 0.54 - warp * 0.12 + vec2(0.61, 0.29);
            vec4 sgAlb1 = texture2D(tSgErosionAlb, uvSg1);
            vec4 sgAlb2 = texture2D(tSgErosionAlb, uvSg2);
            vec4 sgNrm1 = texture2D(tSgErosionNrm, uvSg1);
            vec4 sgNrm2 = texture2D(tSgErosionNrm, uvSg2);
            vec2 sgN1 = rotPT * (sgNrm1.rg * 2.0 - 1.0);
            vec2 sgN2 = rotQT * (sgNrm2.rg * 2.0 - 1.0);
            float sgDetailW = mix(0.46, 0.68, nearDetail);
            sgNxy = sgN1 * 0.86 + sgN2 * sgDetailW;
            sgAO = clamp(sgNrm1.b * 0.66 + sgNrm2.b * 0.34, 0.08, 1.0);
            sgVein = clamp(sgNrm1.a * 0.62 + sgNrm2.a * 0.38, 0.0, 1.0);
            sgRough = clamp(sgAlb1.a * 0.65 + sgAlb2.a * 0.35, 0.0, 1.0);
            sgAlb = mix(sgAlb1.rgb, sgAlb2.rgb, 0.38);
          }

          /* Perturb slope normal with hydraulic gullies & ridgelets BEFORE lighting & canopy shading
             Boosted on outer mountains so background hills carry crisp eroded micro-topography matching the foreground DEM! */
          float erSlopeN = clamp(uDetailFusion.y, 0.0, 2.0) * fDry * (0.44 + 0.78 * steepF) * mix(1.0, 1.38, outerDistF);
          vec3 erodedN = normalize(sN + (eT * sgNxy.x + eB * sgNxy.y) * erSlopeN);
          float erosionCavityAO = mix(1.0, clamp(0.48 + 0.86 * sgAO, 0.36, 1.16), clamp(uDetailFusion.w, 0.0, 1.6) * fDry * (0.50 + 0.50 * steepF) * mix(1.0, 1.22, outerDistF));
          erosionRib = mix(erosionRib, sgVein, 0.58 * clamp(fDry, 0.0, 1.0));

          /* --- 1A. 4-LAYER ALPINE GRASS, MOSS & 山谷 SCREE BIOMES + MAGIC VALLEY MEADOW GRAIN --- */
          float shoreBreak = (forestNoise(wp * 2.4 + vec2(-5.1, 3.7)) - 0.5) * 0.024;
          float localWaterY = mix(0.105,branchY,smoothstep(0.002,0.16,stBranch))${FALLS ? '-vStFallsLow' : ''};
          float relY = vForestWorld.y - localWaterY + shoreBreak;
          float outerBankCap = (outDist > 0.05 ? smoothstep(0.38, 0.85, ws.y) : 1.0)${FALLS ? ' * mix(0.15, 1.0, smoothstep(0.05, 1.10, stFallsSd)) * mix(0.45, 1.0, smoothstep(1.10, 3.40, stFallsSd))   /* redo-s3/s5: no dark basalt waterline ring round the gorge, and softer river banks in its neighbourhood */' : ''};
          float shoreCliff = (1.0 - smoothstep(0.0, 0.095, relY)) * outerBankCap;
          float wetCliff   = (1.0 - smoothstep(0.0, 0.036, relY)) * outerBankCap * clamp(uShoreWet, 0.0, 1.5);
          float dampRim    = (1.0 - smoothstep(0.030, 0.092, relY)) * (1.0 - wetCliff) * outerBankCap * clamp(uShoreWet, 0.0, 1.5);
          // Small creeks retain mossy soil and gravel shoulders instead of
          // inheriting the main canyon's continuous dark basalt waterline.
          wetCliff*=mix(1.0,0.65,stBranch);
          shoreCliff*=mix(1.0,0.48,stBranch);
          wetCliff*=mix(1.0,.76,headwaterMix);
          shoreCliff*=mix(1.0,.68,headwaterMix);

          /* Independent rotated anti-tiling UVs for grass/moss scans + 山谷 scree/moss G4 */
          vec2 uvG1 = rotP * wp * 0.88 + vec2(0.19, 0.53) + warp * 0.14;  /* G1: Lush Grass004 meadow */
          vec2 uvG2 = wp * vec2(.57,.76) + vec2(.37,.11) - warp * .52;    /* G2: Sunlit Wild Highland forrest_ground_01 */
          vec2 uvG3 = rotQ * wp * .51 + vec2(.41,.77) + warp * .36;       /* G3: Deep Canyon Moss002 */

          vec4 g1Tex = texture2D(tGrassAlb,     uvG1);
          ${useFieldBake
            ? `vec4 g2Raw = stMaterialTile(tGrassBiomeAtlas, uvG2, 0.0);
          vec4 g3Raw = stMaterialTile(tGrassBiomeAtlas, uvG3, 1.0);
          vec4 g2Tex = vec4(stSrgbToLin(g2Raw.rgb), g2Raw.a);
          vec4 g3Tex = vec4(stSrgbToLin(g3Raw.rgb), g3Raw.a);`
            : `vec4 g2Tex = texture2D(tGrassWildAlb, uvG2);
          vec4 g3Tex = texture2D(tMossAlb,      uvG3);`}
          vec4 g4Tex = vec4(sgAlb, sgRough);                              /* G4: 山谷/textures alpine scree & eroded moss */

          // A continuous sward: broad cushions follow the fall line, with a
          // second, much finer scan for leaf blades, pore shadows and dew.
          vec3 g1Alb = stGrassAlbedo(g1Tex);
          vec3 g2Alb = g2Tex.rgb;
          vec4 cushionScan=g1Tex, bladeScan=g1Tex;
          vec2 lay=normalize(vec2(.86,.50)+warp*.62);
          mat2 toSward=mat2(lay.x,-lay.y,lay.y,lay.x);
          vec2 bedCoord=toSward*wp*vec2(1.55,2.85)+warp*.72;
          const float bladeScale=3.45;
          vec2 bladeUV=rotQ*wp*bladeScale+warp*.34+vec2(.29,.63);
          float opticalDetail=1.0-smoothstep(.018,.095,pxW*bladeScale);
          if (nearDetail > 0.04) {
            cushionScan=texture2D(tGrassAlb,bedCoord);
            // At a grazing angle, the tips reveal a little of the shaded soil
            // behind them. The prefiltered texture keeps distant ridges quiet.
            vec2 parallax=clamp(viewV.xz/max(.30,abs(viewV.y)),vec2(-1.7),vec2(1.7));
            bladeUV+=rotQ*parallax*((cushionScan.g-.50)*.034*opticalDetail);
            bladeScan=texture2D(tGrassAlb,bladeUV);
            g1Alb=mix(g1Alb,stGrassAlbedo(cushionScan),.36*nearDetail);
            g2Alb*=mix(1.0,.82+.36*cushionScan.g,.50*nearDetail);
          }

          /* Ecological 4-biome layering:
             - G1 Lush Emerald Grass: balanced mid-elevation meadows
             - G2 Wild Highland Olive-Sage Reed Grass: sweeping sunlit ridges, warm saddles & open windward slopes
             - G3 Deep Pine Canyon Moss: shady north slopes, cool valley hollows & damp lower depressions
             - G4 Alpine Heather/Peat Scree Rim: cliff lips, steep transitional shoulders & rocky high-altitude crowns */
          // Terrain determines the habitat; noise only breaks its boundaries.
          // Sun visibility deliberately does not enter these material weights:
          // passing clouds must not turn living moss into dry grass.
          float clumps = smoothstep(0.30, 0.68, patchMix * 0.72 + macroBiomeB * 0.28);
          float rimSlope = 1.0 - smoothstep(uRockSlope - 0.035, uRockSlope + 0.075, sN.y);
          float moisture = clamp(coolHollow * 0.82 + dampRim * 0.65 + wetCliff * 0.80 + stBranch * 0.36, 0.0, 1.0);
          float dryHeath = clamp(warmUpland * (0.72 + 0.28 * clumps) - moisture * 0.42, 0.0, 1.0);
          float cushion=clamp(.64*cushionScan.g+.36*g1Tex.g,0.0,1.0);
          float blades=(bladeScan.g-.50)*opticalDetail*nearDetail;
          float pores=(1.0-cushionScan.b)*nearDetail;
          // Green excess in the forest-floor photograph separates living leaves
          // from straw and soil. Moss luminance follows the scanned cushion relief.
          float greenExcess=dot(g2Tex.rgb,vec3(-.55,1.0,-.45))/max(.012,dot(g2Tex.rgb,vec3(1.0)));
          float liveLeaves=smoothstep(.018,.205,greenExcess);
          float mossCrown=smoothstep(.054,.157,g3Tex.g);
          float straw=smoothstep(.29,.79,(1.0-liveLeaves)*.53+dryHeath*.32+ridge*.12+erosionRib*.18);
          float ecology=clamp(uBiomeContrast,0.0,1.8);
          float exposedTips=smoothstep(.48,.74,cushion+blades*.63)*(1.0-pores*.54);
          float tipRelief=mix(mossCrown,exposedTips,.55*nearDetail);
          float mossHabitat=.11+.53*moisture+.31*mossCrown+.14*clumps+.10*coolAspect;
          float dryHabitat=.10+.34*dryHeath+.41*straw+.13*warmAspect+.10*ridge+.08*erosionRib-.13*moisture;
          float tipHabitat=.10+.30*liveLeaves+.29*tipRelief+.15*clumps+.13*cushion+.10*warmAspect;
          vec3 habitat=vec3(mossHabitat,dryHabitat,tipHabitat);
          vec3 grassLayers=stMeadowCover(.5+(habitat-.5)*(.76+.24*ecology));
          float wWild = 0.08 + dryHeath * 0.85 + .28*grassLayers.y;
          float wMoss = 0.08 + moisture * (1.25 + 0.36 * clumps) + .35*grassLayers.x;
          float wHeath = 0.06 + exposed * (0.35 + screeVeins * 0.54) + ridge * rimSlope * 0.38;
          float wLush = 0.24 + (1.0 - dryHeath) * (1.0 - moisture * 0.65) * (0.72 + 0.45 * clumps);
          float wSum   = max(wLush + wWild + wMoss + wHeath, 1e-4);
          wLush /= wSum; wWild /= wSum; wMoss /= wSum; wHeath /= wSum;

          /* Distinct canyon color-temperature harmony for each of the 4 grass layers -> rich multi-tone natural meadows! */
          vec3 colG1 = g1Alb * vec3(0.48, 0.64, 0.37);
          vec3 colG2 = g2Alb * vec3(0.79, 0.78, 0.61);
          vec3 colG3 = g3Tex.rgb * vec3(0.30, 0.48, 0.40);
          vec3 colG4 = g4Tex.rgb * vec3(0.78, 0.76, 0.66);

          vec3 turfBase = colG1 * wLush + colG2 * wWild + colG3 * wMoss + colG4 * wHeath;
          float roughDetail = clamp(g1Tex.a * wLush + g2Tex.a * wWild + g3Tex.a * wMoss + g4Tex.a * wHeath, 0.0, 1.0);
          float dryRough = mix(0.90, 0.96, roughDetail);
          float wetRough = mix(0.65, 0.75, roughDetail);
          float wetGrass=clamp(moisture+.16*grassLayers.x*(1.0-moisture)-.16*grassLayers.y*moisture,0.0,1.0);
          float turfRough = mix(dryRough, wetRough, wetGrass);
          turfRough=clamp(turfRough+blades*.065-pores*moisture*.036,
                          mix(.90,.65,wetGrass),mix(.96,.75,wetGrass));
          vec3 dryTint = vec3(1.15, 1.05, 0.90);
          vec3 wetTint = vec3(0.76, 0.87, 0.94);
          turfBase *= mix(vec3(1.0), dryTint, clamp(dryHeath * uBiomeContrast, 0.0, 1.0));
          turfBase *= mix(vec3(1.0), wetTint, clamp(moisture * uBiomeContrast, 0.0, 1.0));
          // Peat settles in concave, saturated ground instead of random spots.
          float peat = cavity * valleyFloor * moisture * (0.35 + 0.45 * (1.0 - clumps));
          turfBase = mix(turfBase, vec3(0.042, 0.052, 0.043) * (0.8 + roughDetail * 0.4), peat * 0.60);
          float swardAO=1.0-.21*pores-.12*(1.0-bladeScan.b)*opticalDetail;
          turfBase*=swardAO*(1.0+(cushion-.45)*.53+(bladeScan.r-.26)*.23*opticalDetail+blades*.63);

          /* Tangent-Space NormalGL for grass/moss layers + 山谷 erosion relief (works even when grassPbr=0!) */
          vec2 nG1 = rotPT * (texture2D(tGrassNrm, uvG1).rg * 2.0 - 1.0);
          vec2 nG3 = rotQT * (texture2D(tGrassNrm, uvG3).ba * 2.0 - 1.0);
          vec2 nG2 =          texture2D(tGrassNrm, uvG2 * 1.15 + vec2(0.23, 0.41)).rg * 2.0 - 1.0;
          vec2 turfNxy = nG1 * wLush + nG2 * wWild + nG3 * wMoss + sgNxy * wHeath;
          // Bump the continuous turf at cushion scale as well as blade scale.
          // Screen derivatives use the existing XZ Jacobian, without height taps.
          float matHeight=.54*mossCrown+.30*liveLeaves+.16*cushion;
          vec2 hd=vec2(dFdx(matHeight),dFdy(matHeight));
          vec2 matSlope=vec2(hd.x*py.y-px.y*hd.y,px.x*hd.y-hd.x*py.x)*
                        (sign(det)/max(abs(det),1e-10))*.007;
          turfNxy+=vec2(-matSlope.x,matSlope.y)*inversesqrt(1.0+dot(matSlope,matSlope)*7.0)*nearDetail;
          if (nearDetail > 0.04) {
            vec4 microN=texture2D(tGrassNrm,bladeUV);
            vec2 nFine=rotQT*(mix(microN.rg,microN.ba,moisture*.68)*2.0-1.0);
            turfNxy+=nFine*(.72*nearDetail*opticalDetail);
          }

          /* Magic Valley flowing meadow & micro-shrub grain (dual-scale rotated, velvety up close) */
          float mvGrainAmt = clamp(uCanopyParams.z, 0.0, 1.5) * fDry;
          float mvGrain = 0.0;
          if (mvGrainAmt > 0.002) {
            vec2 uvMvM1 = rotP * wp * 0.36 + warp * 0.16 + vec2(0.11, 0.73);
            vec2 uvMvM2 = rotQ * wp * 0.84 - warp * 0.12 + vec2(0.53, 0.21);
            mvGrain = (texture2D(tMvCanopyNrm, uvMvM1).b - 0.5) * 1.12 + (texture2D(tMvCanopyNrm, uvMvM2).b - 0.5) * mix(0.52, 0.34, nearDetail);
          }
          /* Subtle erosion-streak tonal modulation from 山谷 + meadow grain from Magic Valley */
          turfBase *= clamp(1.0 + mvGrain * 0.28 * mvGrainAmt + (sgVein - 0.52) * 0.28 * clamp(uDetailFusion.z, 0.0, 1.5) * fDry * (0.38 + 0.62 * steepF), 0.58, 1.48);

          /* Sculptural micro-terrain normal perturbation built on erodedN (keeps 山谷 gullies crisp at any grassPbr!) */
          vec3 turfT = eT;
          vec3 turfB = eB;
          vec3 grassN = normalize(erodedN + (turfT * turfNxy.x + turfB * turfNxy.y) * 1.05 * clamp(pbrAmt, 0.0, 1.5));
          float grassSun = clamp(dot(grassN, sunNS), 0.0, 1.0);
          float grassHeight = clamp((1.0 - turfRough) * 0.28 + dot(turfBase, vec3(0.26, 0.60, 0.14)) * 1.85 + wWild * 0.14 - wHeath * 0.16, 0.0, 1.0);

          /* Subtle sun/shade atmospheric color temperature shift + user saturation slider */
          turfBase *= mix(vec3(1.0), vec3(1.12, 1.04, 0.88), warmAspect * 0.62);
          turfBase *= mix(vec3(1.0), vec3(0.78, 0.88, 1.04), coolAspect * 0.58);
          turfBase=stMeadowDye(turfBase,grassLayers);
          float seams=(1.0-mossCrown)*(1.0-liveLeaves)*(.24+.55*moisture);
          turfBase*=1.0+(.16*(mossCrown-.5)+.12*(liveLeaves-.5)-.22*seams)*ecology;

          /* --- 1A-COLOR: ZERO-YELLOW MULTI-COLOR COOL ALPINE BIOMES (Silver-Sage Lichen, Muted Heather-Plum, Fresh Jade-Moss, Deep Blue-Spruce) --- */
          float colVar = clamp(uColorParams.x, 0.0, 1.8) * fDry;
          float accW   = clamp(uColorParams.y, 0.0, 1.8);
          float biomePatchA = stFbm2(wpW * 0.34 + vec2(8.7, -4.3));
          float biomePatchB = forestNoise(wpW * 0.90 + vec2(-5.4, 9.1));
          /* Suppress any residual yellow-ochre cast from warm sunlight tinting on grass/rock */
          float silverLichen = smoothstep(0.38, 0.78, dryHeath * 0.50 + ridge * 0.32 + exposed * 0.24 + biomePatchA * 0.34 - moisture * 0.38);
          float heatherPlum  = smoothstep(0.46, 0.84, exposed * 0.42 + sgVein * 0.36 + biomePatchB * 0.38 + warmAspect * 0.18 - moisture * 0.36);
          float freshJade    = smoothstep(0.40, 0.80, moisture * 0.50 + dampRim * 0.44 + (1.0 - sgVein) * 0.26 + biomePatchB * 0.24) * (1.0 - heatherPlum * 0.65);
          float coolSpruce   = smoothstep(0.36, 0.78, coolHollow * 0.54 + coolAspect * 0.38 + (1.0 - biomePatchA) * 0.32);
          if (colVar > 0.004) {
            float turfLum = max(0.03, dot(turfBase, vec3(0.2126, 0.7152, 0.0722)));
            /* Pure zero-yellow Icelandic/Scottish highland tones harmonizing with steel-blue water & slate rock */
            vec3 lichenCol  = vec3(0.92, 1.04, 1.06) * turfLum * 1.18;  /* Pale frosty silver-sage alpine lichen */
            vec3 heatherCol = vec3(1.06, 0.74, 0.92) * turfLum * 0.92;  /* Muted earthy highland heather-plum / cool mauve */
            vec3 jadeCol    = vec3(0.56, 1.24, 0.88) * turfLum * 1.04;  /* Fresh luminous emerald-jade moss */
            vec3 spruceCol  = vec3(0.40, 0.96, 1.14) * turfLum * 0.96;  /* Deep oceanic blue-spruce & pine-teal */
            turfBase = mix(turfBase, lichenCol,  clamp(silverLichen * 0.48 * colVar * accW, 0.0, 0.62));
            turfBase = mix(turfBase, heatherCol, clamp(heatherPlum  * 0.54 * colVar * accW, 0.0, 0.66));
            turfBase = mix(turfBase, jadeCol,    clamp(freshJade    * 0.42 * colVar, 0.0, 0.54));
            turfBase = mix(turfBase, spruceCol,  clamp(coolSpruce   * 0.46 * colVar, 0.0, 0.58));
          }
          /* Gently tame any yellow excess (R & G both high over B) so grass stays crisp emerald/teal/silver/plum */
          float turfYel = clamp((min(turfBase.r, turfBase.g) - turfBase.b) / max(max(turfBase.r, turfBase.g), 1e-3), 0.0, 1.0);
          turfBase = mix(turfBase, turfBase * vec3(0.84, 0.98, 1.14), turfYel * 0.58 * clamp(fDry, 0.0, 1.0));
          turfBase=stSat(turfBase,clamp(uGrassSat,.2,2.0));

          /* Dramatic canyon chiaroscuro lighting: sunlit wild-olive ridges vs deep cool-pine shadow hollows */
          float turfLit = mix(sunMacro, grassSun, 0.74) * sunVis;
          float baseValleyAO = max(0.42, 1.0 - cavity * uCavityDepth * 0.56);
          float valleyAO = baseValleyAO * erosionCavityAO;
          vec3 turfAmb = skyFillCol * (0.44 + 0.56 * max(0.0, grassN.y)) + bounceCol * (0.30 + 0.70 * (1.0 - max(0.0, grassN.y)));
          vec3 surfCol = turfBase * (turfAmb * valleyAO + sunKeyCol * turfLit * (1.0 - cavity * uCavityDepth * 0.12));
          surfCol *= 1.0 + ridge * uCavityDepth * 0.10;

          /* Crisp pale silvery-sage backlit grass rim light along sunlit wild-reed ridges & canyon lips */
          vec3 Hgrass = normalize(viewV + sunNS);
          float grassSpec = pow(max(dot(grassN, Hgrass), 0.0), mix(34.0, 8.0, turfRough)) * (1.0 - turfRough * 0.74) * turfLit;
          float ridgeRim  = pow(1.0 - clamp(dot(grassN, viewV), 0.0, 1.0), 2.8) * turfLit * (0.35 + 0.65 * smoothstep(0.16, 0.58, vForestWorld.y));
          vec3 grassSheen=mix(vec3(.20,.28,.19),uMeadowTips,grassLayers.z);
          surfCol += (vec3(0.17) + grassSheen*0.90) * (grassSpec * 0.24 + ridgeRim * (0.36 + 0.28 * wWild)) * clamp(uSunIntensity, 0.4, 1.8);

          /* --- 1A+. MAGIC VALLEY AERIAL CONIFER FOREST CANOPY GROVES (Multi-Scale 3D Crown Dome Normals + Inter-Crown AO) --- */
          float canopyCovCtrl = clamp(uCanopyParams.x, 0.0, 1.5);
          if (fDry > 0.005 && canopyCovCtrl > 0.005 && uGrassCover > 0.05) {
            /* Natural alpine tree-line ecology: sheltered valley shoulders, cool hollows & damp gullies; clears on bare crests & sheer cliffs */
            float groveNoise = stFbm2(wpW * 0.40 + vec2(-3.4, 7.1)) * 0.64 + forestNoise(wpW * 1.02 + vec2(5.2, -4.8)) * 0.36;
            float groveHabitat = groveNoise * 0.58 + coolHollow * 0.24 + (1.0 - sgVein) * 0.22 + moisture * 0.15 - warmUpland * 0.16 + outerDistF * (1.0 - exposed * 0.75) * 0.14;
            float groveThresh = mix(0.94, 0.34, clamp(canopyCovCtrl * 0.72, 0.0, 1.0));
            float slopeTreeOk = smoothstep(0.58, 0.84, sN.y) * smoothstep(0.022, 0.105, relY) * (1.0 - smoothstep(mix(0.62, 0.72, outerDistF), 0.96, elevN));
            if (groveHabitat + 0.20 > groveThresh - 0.14 && slopeTreeOk > 0.01) {
              vec2 uvCan1 = rotQ * wp * 0.58 + warp * 0.07 + vec2(0.31, 0.17);
              vec2 uvCan2 = rotP * wp * 0.94 - warp * 0.06 + vec2(0.73, 0.41);
              vec4 mvCanAlb1 = texture2D(tMvCanopyAlb, uvCan1);
              vec4 mvCanNrm1 = texture2D(tMvCanopyNrm, uvCan1);
              vec4 mvCanAlb2 = texture2D(tMvCanopyAlb, uvCan2);
              vec4 mvCanNrm2 = texture2D(tMvCanopyNrm, uvCan2);
              /* Blend old-growth + young pine scales for organic, non-repeating canopy even in close-up zoom */
              vec4 mvCanAlb = mix(mvCanAlb1, mvCanAlb2, 0.32);
              vec2 canNxy = rotQT * (mvCanNrm1.rg * 2.0 - 1.0) * 0.74 + rotPT * (mvCanNrm2.rg * 2.0 - 1.0) * 0.36;
              float canCrownAO = clamp(mix(mvCanNrm1.a, mvCanNrm2.a, 0.32), 0.20, 1.0);
              /* Feathered tree-by-tree treeline breakup driven by individual crown prominence (mvCanAlb.a) */
              float canopyMask = smoothstep(groveThresh - 0.14, groveThresh + 0.14, groveHabitat + (mvCanAlb.a - 0.5) * 0.26);
              canopyMask *= slopeTreeOk * fDry * smoothstep(0.01, 0.18, canopyCovCtrl) * smoothstep(0.10, 0.42, uGrassCover);
              if (canopyMask > 0.005) {
                float canLum = dot(mvCanAlb.rgb, vec3(0.2126, 0.7152, 0.0722));
                /* Harmonize Magic Valley pine canopy with zero-yellow alpine species (deep blue-spruce, emerald fir, silver-frosted spruce, muted heather-plum accents) */
                vec3 canPalette = mix(uMeadowMoss * 0.54, uMeadowBase * 0.72, smoothstep(0.20, 0.70, mvCanAlb.a));
                vec3 canBase = mix(mvCanAlb.rgb * vec3(0.32, 0.54, 0.46), canPalette * (0.46 + canLum * 1.48), 0.56);
                canBase *= mix(vec3(1.0), vec3(0.96, 1.04, 1.02), warmAspect * 0.40);
                canBase *= mix(vec3(1.0), vec3(0.76, 0.90, 1.08), coolAspect * 0.48);
                if (colVar > 0.004) {
                  float speciesCluster = forestNoise(wpW * 0.74 + vec2(3.1, -8.4)) * 0.56 + forestNoise(wpW * 1.85 + vec2(-6.2, 4.7)) * 0.44;
                  /* Individual blue-spruce, frosted silver-fir & muted plum-heather alpine shrubs dappled among dark emerald pines */
                  float silverFir   = smoothstep(0.54, 0.82, speciesCluster + ridge * 0.24 + (mvCanAlb.a - 0.45) * 0.46);
                  float plumShrub   = smoothstep(0.60, 0.88, speciesCluster * 0.86 + exposed * 0.26 + (mvCanAlb.a - 0.48) * 0.50);
                  float canBaseLum  = max(0.025, dot(canBase, vec3(0.2126, 0.7152, 0.0722)));
                  vec3 blueSpruceCol = vec3(0.38, 0.96, 1.18) * canBaseLum * 1.02;
                  vec3 silverFirCol  = vec3(0.76, 1.08, 1.12) * canBaseLum * 1.24;
                  vec3 plumShrubCol  = vec3(1.08, 0.70, 0.90) * canBaseLum * 1.12;
                  canBase = mix(canBase, blueSpruceCol, clamp(coolSpruce * 0.52 * colVar, 0.0, 0.62));
                  canBase = mix(canBase, silverFirCol,  clamp(silverFir  * 0.50 * colVar * accW, 0.0, 0.60));
                  canBase = mix(canBase, plumShrubCol,  clamp(plumShrub  * 0.44 * colVar * accW, 0.0, 0.54));
                }
                canBase = stSat(canBase, clamp(uGrassSat * 0.96, 0.2, 2.0));
                vec3 canN = normalize(erodedN + (eT * canNxy.x + eB * canNxy.y) * (1.20 * clamp(uCanopyParams.y, 0.0, 2.0)));
                float canSun = clamp(dot(canN, sunNS), 0.0, 1.0);
                float canLit = mix(sunMacro, canSun, 0.78) * sunVis;
                vec3 canAmb = skyFillCol * (0.36 + 0.64 * max(0.0, canN.y)) + bounceCol * 0.34;
                vec3 canCol = canBase * (canAmb * valleyAO * canCrownAO + sunKeyCol * canLit * (0.40 + 0.80 * canCrownAO));
                /* Sun-kissed pine needle tips on sun-facing crown domes */
                canCol += uMeadowTips * 0.20 * pow(canSun, 3.0) * mvCanAlb.a * sunVis * clamp(uSunIntensity, 0.4, 1.8);
                surfCol = mix(surfCol, canCol, clamp(canopyMask * 0.90, 0.0, 0.92));
              }
            }
          }

          /* --- 1B. 3-LAYER PURE 2K GEOLOGICAL ROCK & CLIFF SYSTEM (Rock051 Strata + Rock035 Dark Basalt + mossy_rock Ledges!) --- */
          float rockNoise  = patchMix * 0.45 + forestNoise(wp * 0.62 + vec2(-3.2, 5.1)) * 0.55;
          float rockFineN  = forestNoise(wp * 1.85 + vec2(6.4, -2.9));
          float darkRockZone = stFbm2(wpW * 0.38 + vec2(-8.2, 6.4));
          float slopeCut   = 1.0 - smoothstep(uRockSlope - 0.185, uRockSlope + 0.043, sN.y);
          float ridgeCrag  = exposed * (1.0 - smoothstep(uRockSlope - 0.06, uRockSlope + 0.06, sN.y)) * (0.32 + ridge * 0.68);
          /* Expose authentic fractured alpine slate ridges & high-altitude scree on outer background peaks */
          float outerPeakRock = outerDistF * smoothstep(0.30, 0.76, elevN) * smoothstep(0.32, 0.74, sgVein * 0.52 + ridge * 0.44 + (1.0 - sN.y) * 1.45) * 0.78;
          float highScree  = exposed * smoothstep(0.38, 0.78, screeVeins * 0.58 + rockNoise * 0.42) * 0.66;
          float gorgeRock  = ws.y * (1.0 - smoothstep(uRockSlope - 0.14, uRockSlope + 0.06, sN.y)) * (0.50 + 0.50 * rockNoise);
          float sheerRock  = clamp(slopeCut * 1.24 + ridgeCrag * 1.05 + outerPeakRock + highScree + gorgeRock * 0.85 + shoreCliff * 1.38, 0.0, 1.0);
          sheerRock*=1.0-stBranch*smoothstep(0.30,0.82,sN.y)*0.62;

          // Carve masks describe the newly exposed walls continuously across
          // mesh triangles. Their half-depth transition is the steepest part.
          float cutEdge=max(max(lb.y*(1.0-lb.y)${FALLS ? '*0.30' : ''},stCR0.y*(1.0-stCR0.y)),stBranch*(1.0-stBranch));
          cutEdge=max(cutEdge,ws.y*(1.0-ws.y)*headwaterMix);
          float bankFace=smoothstep(0.010,0.068,relY)*(1.0-smoothstep(0.27,0.60,relY));
          float rootingSlope=clamp(sN.y-cutEdge*1.32*bankFace,0.0,1.0);
          float rootPocket=(clumps-0.5)*0.10+(erosionRib-0.5)*0.12+(moisture-0.35)*0.05;
          vec2 fissureUV=vec2(dot(wp,vec2(.81,.59)),vForestWorld.y+dot(wp,vec2(-.18,.23)));
          rootPocket+=(forestNoise(fissureUV*8.7+warp)-0.5)*0.068+(g1Tex.a-g3Tex.a)*0.035;
          /* 山谷/textures dendritic erosion guides the rock/grass boundary cleanly along fractured ridges & mossy gullies */
          rootPocket-=(sgVein-0.48)*0.19*fDry*(0.40+0.60*steepF+0.35*ridge*exposed);
          rootPocket+=(0.58-sgAO)*0.09*fDry*(1.0-steepF*0.45);
          rootPocket-=clamp(wetCliff,0.0,1.0)*(1.0-rootingSlope)*0.19;
          float rockCover=1.0-stGrassCover(rootingSlope,sheerRock,rootPocket);
          ${FALLS ? 'rockCover *= mix(0.22, 1.0, smoothstep(0.30, 3.40, stFallsSd));   /* redo-s4/s5: round the gorge (to ~3.4 from the rim) the slopes and river banks stay grass and moss, no bare brown cut faces */' : ''}
          #ifdef STUDIO_HEADWATERS
          // Expose the existing slate and basalt scans on broken shoulders.
          // Sheltered patches keep their moss, and the toe still takes gravel.
          float bankBelt = 4.0*ws.y*(1.0-ws.y)*headwaterMix;
          float ledgeFace = smoothstep(0.035,0.14,relY) * (1.0-smoothstep(0.56,0.94,sN.y));
          rockCover = max(rockCover, bankBelt*ledgeFace*smoothstep(0.22,0.67,rockFineN*.58+rockNoise*.42)${FALLS ? '*mix(0.18,1.0,smoothstep(0.30,3.40,stFallsSd))' : ''});   /* redo-s5: the river banks' exposed scans stay grass and moss near the gorge */
          #endif
          if (rockCover > 0.006) {
            vec3 absN = abs(sN);
            vec3 triW = pow(max(absN,0.001),vec3(3.8));
            triW /= max(triW.x + triW.y + triW.z, 1e-4);

            /* R1: Monumental diagonal stratified grey canyon wall (Rock051 Triplanar 3-axis Color + NormalGL + Disp + AO; skip near-zero axes!) */
            float rScale = 0.72;
            vec2 rWarp = warp * 0.12;
            vec2 uvRX = vForestWorld.zy * rScale + rWarp;
            vec2 uvRY = vForestWorld.xz * rScale + rWarp;
            vec2 uvRZ = vForestWorld.xy * rScale + rWarp;

            vec4 rAlbX = vec4(0.0), rAlbY = vec4(0.0), rAlbZ = vec4(0.0);
            vec4 rNrmX = vec4(0.5, 0.5, 0.5, 1.0), rNrmY = vec4(0.5, 0.5, 0.5, 1.0), rNrmZ = vec4(0.5, 0.5, 0.5, 1.0);
            if (triW.x > 0.003) { rAlbX = texture2D(tRockAlb, uvRX); rNrmX = texture2D(tRockNrm, uvRX); }
            if (triW.y > 0.003) { rAlbY = texture2D(tRockAlb, uvRY); rNrmY = texture2D(tRockNrm, uvRY); }
            if (triW.z > 0.003) { rAlbZ = texture2D(tRockAlb, uvRZ); rNrmZ = texture2D(tRockNrm, uvRZ); }
            vec4 rockAlbR = rAlbX * triW.x + rAlbY * triW.y + rAlbZ * triW.z;

            vec3 tNX = stUnpackNrm(rNrmX.rg);
            vec3 tNY = stUnpackNrm(rNrmY.rg);
            vec3 tNZ = stUnpackNrm(rNrmZ.rg);
            vec3 wNX = vec3(sN.x, tNX.y, tNX.x * sign(sN.x));
            vec3 wNY = vec3(tNY.x, sN.y, -tNY.y * sign(sN.y));
            vec3 wNZ = vec3(tNZ.x * sign(sN.z), tNZ.y, sN.z);
            vec3 triRockN = normalize(wNX * triW.x + wNY * triW.y + wNZ * triW.z);

            float rockDisp = rNrmX.b * triW.x + rNrmY.b * triW.y + rNrmZ.b * triW.z;
            float rockAO   = rNrmX.a * triW.x + rNrmY.a * triW.y + rNrmZ.a * triW.z;

            // Keep weathering continuous across changes of dominant axis.
            // Where the oblique projection grazes a face, use the triplanar scan.
            vec2 uvDom=vec2(dot(vForestWorld,vec3(.80,0.0,.60)),
                            dot(vForestWorld,vec3(-.36,.80,.48)))*rScale+rWarp;
            float projectionWeight=smoothstep(.13,.60,abs(dot(sN,vec3(-.48,-.60,.64))));
            vec2 uvBasalt = rotP * uvDom * 1.48 + vec2(0.23, 0.59);
            vec2 uvMossRk = rotQ * uvDom * 1.18 + vec2(0.47, 0.13);

            vec4 basaltAlb = stMaterialTile(tRockBasaltAlb, uvBasalt, 0.0);
            vec4 mossyRkAlb = vec4(sgAlb, sgRough);
            vec2 basaltNxy = stMaterialTile(tRockNrm2, uvBasalt, 0.0).rg * 2.0 - 1.0;
            vec2 mossyNxy  = stMaterialTile(tRockNrm2, uvMossRk, 0.0).ba * 2.0 - 1.0;
            basaltAlb=mix(rockAlbR*vec4(.78,.83,.88,1.0),basaltAlb,projectionWeight);
            mossyRkAlb=mix(rockAlbR,mossyRkAlb,projectionWeight);
            basaltNxy*=projectionWeight;
            mossyNxy*=projectionWeight;

            /* Close-up micro-fracture detail octave when zoomed in */
            vec4 rockFine = rockAlbR;
            vec2 fNxy = vec2(0.0);
            float chipHeight = rockDisp;
            if (nearDetail > 0.04) {
              vec2 uvDomFine = rotP * uvDom * 2.75 + vec2(0.31, 0.67);
              rockFine = mix(rockAlbR,texture2D(tRockAlb,uvDomFine),projectionWeight);
              vec4 chipMap = texture2D(tRockNrm,uvDomFine);
              fNxy = (chipMap.rg*2.0-1.0)*projectionWeight;
              chipHeight = mix(rockDisp,chipMap.b,nearDetail*projectionWeight);
            }

            // A tilted mineral bed thickens and pinches out along the wall.
            // Keep the breakup in world space across triplanar projection seams.
            vec2 wallUV = vec2(dot(wp,vec2(2.1,1.7)), vForestWorld.y*3.7);
            float joint = forestNoise(wallUV*2.9 + warp*1.8);
            float splinter = chipHeight*0.57 + rockDisp*0.27 + joint*0.16;
            vec2 chipUV=vec2(dot(wp,vec2(.78,.61))+.24*vForestWorld.y,
                             vForestWorld.y*1.16+dot(wp,vec2(-.27,.19)));
            float weather=forestNoise(chipUV*13.6+warp)*.53+forestNoise(rotQ*chipUV*31.5)*.27+splinter*.20;
            float fractures=smoothstep(.38,.68,weather);
            float column = vForestWorld.y*7.1 + dot(wp,vec2(0.30,-0.19)) + macroBiomeA*0.72;
            column += 0.28*sin(column*1.55 + macroBiomeB*2.6) + (erosionRib-0.5)*0.36;
            column += (joint-0.5)*0.22 + (rockDisp-0.5)*0.23 + (weather-.50)*0.39;
            float bedID = floor(column);
            float seed = forestHash(vec2(bedID,7.4));
            float lens = forestNoise(wp*1.75 + vec2(11.3,bedID*3.17));
            float halfBed = mix(.055,.23,seed)*mix(.30,1.17,smoothstep(.22,.76,lens));
            float offset = fract(column) - mix(0.40,0.60,seed);
            float resolution = fwidth(column);
            float blur = 0.054 + min(resolution,0.15);
            float ledge = 1.0-smoothstep(halfBed*0.50,halfBed+blur,abs(offset));
            float parting = 1.0-smoothstep(0.0,0.032+blur,abs(offset+halfBed));
            float outcrop = (1.0-smoothstep(0.70,0.97,sN.y))*(1.0-smoothstep(0.17,0.49,resolution));
            float bandAmount = min(1.0,outcrop*uStrataStrength*mix(1.0,0.46,outerDistF)*(0.40+0.44*smoothstep(0.19,0.63,lens)));
            // Fresh, irregular fracture facets cut through the weathered bedding.
            float flake = smoothstep(0.57,0.79,splinter + 0.19*(joint-0.5));
            float intact = smoothstep(0.23,0.69,splinter + 0.34*(erosionRib-0.5));
            float paleFace=(ledge*(.22+.50*lens)*(.23+.77*intact)*(.14+.86*fractures)+
                            flake*(.16+.16*ledge)*fractures)*bandAmount;
            float seam = parting*(0.28+0.72*smoothstep(0.32,0.69,joint))*(1.0-flake*0.64)*bandAmount;
            float lowerBasalt = (1.0-smoothstep(0.012,0.14,relY))*outerBankCap*(0.16+0.20*darkRockZone);
            float basaltW = clamp(wetCliff*0.36 + lowerBasalt + (1.0-rockDisp)*0.23 + seam*0.14,0.0,0.67);

            float borderRim = (1.0 - smoothstep(0.22, 0.74, sheerRock)) * (1.0 - wetCliff);
            float shelfBench = smoothstep(0.54, 0.84, sN.y) * (1.0 - wetCliff * 0.88) * (0.48 + 0.52 * patchMix);
            float mossyRkW = clamp((borderRim * 0.88 + shelfBench * 0.86 + dampRim * 0.58) * (1.0 - basaltW * 0.58), 0.0, 0.86);

            /* Blend true 2K triplanar normals + 山谷 hydraulic erosion rock ridges & rills cleanly */
            vec3 secN = vec3(basaltNxy.x, 0.0, basaltNxy.y) * (0.68 * basaltW) + vec3(mossyNxy.x, 0.0, mossyNxy.y) * (0.52 * mossyRkW);
            vec3 beddingN = (vec3(0.0,1.0,0.0)-sN*sN.y)*(paleFace*0.19-seam*0.11);
            vec3 erRockN = (eT * sgNxy.x + eB * sgNxy.y) * (1.02 * clamp(uDetailFusion.y, 0.0, 2.0) * fDry);
            vec3 rockN = normalize(mix(sN, triRockN, clamp(max(pbrAmt, 0.44 * clamp(fMix, 0.0, 1.0)) * 0.95, 0.25, 1.0)) + secN + beddingN + erRockN + vec3(fNxy.x, 0.0, fNxy.y) * 0.45 * nearDetail);
            float rockSun = clamp(dot(rockN, sunNS), 0.0, 1.0);

            float rockRough = mix(rockAlbR.a, basaltAlb.a, basaltW);
            rockRough = mix(rockRough, mossyRkAlb.a, mossyRkW);
            rockRough = mix(0.45, 0.65, clamp(rockRough * 0.76 + rockFine.a * 0.24 - wetCliff * 0.22, 0.0, 1.0));
            float erAlbW = clamp(uDetailFusion.z, 0.0, 1.5) * fDry * (1.0 - wetCliff * 0.62);
            rockRough = mix(rockRough, mix(0.48, 0.88, sgRough), clamp(erAlbW * 0.48, 0.0, 0.56));
            float erRockAO = mix(1.0, clamp(0.36 + 0.98 * sgAO, 0.26, 1.14), clamp(uDetailFusion.w, 0.0, 1.6) * fDry);
            float creviceAO = clamp((smoothstep(0.04, 0.78, rockDisp) * 0.52 + rockAO * 0.48) * erRockAO, 0.18, 1.0);

            float grain = dot(mix(rockAlbR.rgb,rockFine.rgb,0.23*nearDetail),vec3(0.2126,0.7152,0.0722));
            vec3 weathered = stSat(rockAlbR.rgb,0.45)*0.55 + vec3(0.071,0.080,0.084)*(0.42+0.80*rockAO);
            vec3 basalt = stSat(basaltAlb.rgb,0.55)*0.70 + vec3(0.059,0.070,0.078);
            vec3 rockBase = mix(weathered,basalt,basaltW);
            rockBase = mix(rockBase,mossyRkAlb.rgb*vec3(0.66,0.76,0.62),mossyRkW*0.68);
            rockBase *= uRockBaseGain;
            /* Fuse 山谷/textures multi-mineral cool alpine rock (steel-blue slate, charcoal basalt, muted porphyry plum-slate, silver-quartz veins, emerald crevices — zero yellow!) */
            if (erAlbW > 0.004) {
              /* Blend planar XZ with oblique wall projection on steep canyon faces so sheer river cliffs stay crisp, never stretched */
              float steepWall = 1.0 - smoothstep(0.45, 0.78, sN.y);
              vec3 sgWallAlb = steepWall > 0.02 ? texture2D(tSgErosionAlb, rotP * uvDom * 0.55 + vec2(0.17, 0.43)).rgb : sgAlb;
              vec3 sgFaceAlb = mix(sgAlb, sgWallAlb, steepWall * 0.65 * projectionWeight);
              float sgRockLum = dot(sgFaceAlb, vec3(0.2126, 0.7152, 0.0722));
              float rockSat = mix(0.66, 0.96, clamp(colVar * 0.85, 0.0, 1.0));
              vec3 sgRockCol = mix(stSat(sgFaceAlb, rockSat) * 0.74, vec3(sgRockLum) * vec3(0.58, 0.62, 0.68), 0.22) * uRockBaseGain;
              /* Cool alpine mineral stratification: steel-blue slate, dark indigo-basalt, muted heather-porphyry beds & pale silver-quartz veins */
              if (colVar > 0.004) {
                float coolSlateZone = smoothstep(0.28, 0.76, coolAspect * 0.42 + (1.0 - biomePatchA) * 0.42 + dampRim * 0.30);
                float porphyryBand  = smoothstep(0.46, 0.82, fract(column * 0.35 + biomePatchB * 0.45)) * (1.0 - wetCliff * 0.70);
                float silverQuartz  = smoothstep(0.56, 0.86, sgVein) * (0.45 + 0.55 * exposed);
                vec3 slateBlue      = vec3(0.66, 0.84, 1.12) * sgRockLum * 0.80;
                vec3 porphyryPlum   = vec3(0.96, 0.74, 0.88) * sgRockLum * 0.78;
                vec3 quartzSilver   = vec3(0.98, 1.04, 1.12) * sgRockLum * 1.08;
                sgRockCol = mix(sgRockCol, slateBlue,    clamp(coolSlateZone * 0.46 * colVar, 0.0, 0.58));
                sgRockCol = mix(sgRockCol, porphyryPlum, clamp(porphyryBand  * 0.38 * colVar * accW, 0.0, 0.48));
                sgRockCol = mix(sgRockCol, quartzSilver, clamp(silverQuartz  * 0.42 * colVar * accW, 0.0, 0.52));
              }
              float sgRibBoost = smoothstep(0.52, 0.84, sgVein) * (0.42 + 0.58 * exposed);
              sgRockCol = mix(sgRockCol, sgRockCol * 1.38 * uRockLayerGain, sgRibBoost * 0.44);
              rockBase = mix(rockBase, sgRockCol, clamp(erAlbW * 0.72, 0.0, 0.84));
            }
            vec3 freshStone = mix(vec3(0.30,0.325,0.34),vec3(0.57,0.56,0.51),smoothstep(0.22,0.78,rockNoise+0.25*(joint-0.5)));
            freshStone *= 0.36 + grain*1.20 + rockDisp*0.23 + chipHeight*0.53;
            // Exposed beds retain the neighbouring slate's grain and albedo.
            // Only fractured mineral faces carry a distinctly lighter pigment.
            freshStone=mix(rockBase*(1.13+.25*weather),freshStone,.50+.19*fractures)*uRockLayerGain;
            rockBase = mix(rockBase,freshStone,paleFace)*(1.0-seam*.11);

            // Moss takes root in damp pockets between beds, giving way to bare split faces.
            float pocket = smoothstep(0.35,0.62,0.41*joint + 0.32*erosionRib + 0.27*(1.0-chipHeight));
            float ledgeMoss = pocket*(0.50*seam + moisture*0.46 + mossyRkW*0.59)*(1.0-flake*0.77);
            ledgeMoss *= smoothstep(0.012,0.070,relY)*grassLayers.x*smoothstep(0.0,.22,uGrassCover);
            vec3 moss = mix(mossyRkAlb.rgb*vec3(0.62,0.78,0.46),colG3+vec3(0.082,0.109,0.039),0.71);
            moss = stMeadowDye(moss,vec3(1.0,0.0,0.0));
            rockBase = mix(rockBase,moss,clamp(ledgeMoss*1.65,0.0,0.73));
            rockBase *= 1.0-clamp(wetCliff,0.0,1.0)*(0.12+0.10*joint);

            float rockLit = mix(sunMacro, rockSun, 0.58) * sunVis;
            vec3 rockAmb = mix(vec3(0.29,0.33,0.37),vec3(0.42,0.46,0.50),max(0.0,rockN.y)) + bounceCol*0.50;
            /* Use baseValleyAO (not double-multiplied by erosionCavityAO, since creviceAO already carries erRockAO!) */
            vec3 litRock = rockBase * (rockAmb * (0.60 + 0.40 * creviceAO) * baseValleyAO + sunKeyCol * 0.82 * rockLit * (0.58 + 0.42 * creviceAO));
            // Fractured pale faces catch skylight in the lee; the sunny faces
            // roll off earlier so the highlands keep their grey mineral colour.
            litRock+=paleFace*freshStone*(0.065+0.075*creviceAO)*(1.0-rockLit)*(1.0-ledgeMoss);
            float brightRock=dot(litRock,vec3(0.2126,0.7152,0.0722));
            litRock/=1.0+max(0.0,brightRock-0.26)*0.93;
            litRock *= 1.0 + ridge * uCavityDepth * 0.08;

            vec3 Hr = normalize(viewV + sunNS);
            vec3 wetN = normalize(mix(sN, rockN, 0.62));
            float rockSpec = pow(max(dot(wetN, Hr), 0.0), mix(36.0, 12.0, rockRough)) * (1.0 - rockRough * 0.68) * rockLit * creviceAO;
            float wetFres  = pow(1.0 - clamp(dot(wetN, viewV), 0.18, 1.0), 4.0) * wetCliff * creviceAO;
            float rockRim  = pow(1.0 - clamp(dot(rockN, viewV), 0.0, 1.0), 3.4) * rockLit * smoothstep(0.24, 0.62, vForestWorld.y);
            litRock += vec3(0.46, 0.52, 0.58) * (rockSpec * mix(0.24, 0.44, wetCliff) + rockRim * 0.16) * clamp(uSunIntensity, 0.4, 1.8);
            litRock += vec3(0.20, 0.30, 0.44) * wetFres * 0.24;

            float edge=4.0*rockCover*(1.0-rockCover);
            float rockMargin=clamp(rockCover+(rockDisp-grassHeight)*0.26*edge,0.0,1.0);
            surfCol=mix(surfCol,litRock,mix(rockMargin,smoothstep(0.0,1.0,rockMargin),0.38));
          }

          // Sediment settles on low, relatively flat shelves beside the
          // water. Patchy drift and moss keep gravel from outlining every bank.
          float riverBank=(1.0-smoothstep(0.09,0.36,stCRDist0))*(1.0-smoothstep(0.015,0.15,relY));
          float creekBank=smoothstep(0.06,0.46,stBranch)*(1.0-smoothstep(0.042,0.18,relY));
          float lakeBank=smoothstep(0.03,0.48,lb.y)*(1.0-smoothstep(0.025,0.13,relY));
          float drift=smoothstep(0.28,0.68,patchMix*0.45+rockFineN*0.55);
          float gravelShelf=max(max(riverBank,creekBank),lakeBank*${FALLS ? '0.16' : '0.74'})*
                            smoothstep(0.32,0.72,sN.y)*(0.32+0.68*drift)*clamp(uShoreWet,0.0,1.4)${FALLS ? '*mix(0.35,1.0,smoothstep(0.30,3.40,stFallsSd))' : ''};
          float outerShelfF=max(headwaterMix,smoothstep(0.0,1.25,outDist));
          float outerShelf=outerShelfF*smoothstep(0.54,0.95,ws.y)*(1.0-smoothstep(0.015,0.16,relY));
          gravelShelf=max(gravelShelf,outerShelf*smoothstep(0.36,0.76,sN.y)*(0.34+0.58*drift)*clamp(uShoreWet,0.0,1.4));
          float emergedBar=smoothstep(0.93,0.997,stBranch)*(1.0-smoothstep(0.020,0.059,abs(relY)))*
                           (1.0-smoothstep(0.09,0.52,wt.r));
          gravelShelf=max(gravelShelf,emergedBar*clamp(uShoreWet,0.0,1.0));
          if(gravelShelf>0.018) {
            vec4 gravel,gravelDetail;
            float contact;
            stCobbleSurface(wp,sN,viewV,sunNS,gravel,gravelDetail,contact);
            vec2 stoneSlope=stGravelSlope(gravelDetail.rg);
            vec3 slope=vec3(stoneSlope.x,0.0,stoneSlope.y);
            vec3 stoneN=normalize(sN+(slope-sN*dot(sN,slope))*1.26);
            float stoneLight=max(dot(stoneN,sunNS),0.0)*sunVis*contact;
            float cap=smoothstep(0.44,0.78,gravelDetail.b);
            float contactWet=1.0-smoothstep(0.008,0.068,relY+(cap-0.5)*0.036);
            /* Cool alpine river granite & dark wet slate pebbles (zero muddy ochre tint!) */
            vec3 stoneColor=gravel.rgb*mix(vec3(1.06,1.10,1.13),vec3(0.58,0.72,0.80),contactWet);
            stoneColor*=gravelDetail.a*(skyFillCol*(1.08+0.78*max(0.0,stoneN.y))+sunKeyCol*stoneLight*0.90);
            stoneColor*=(0.70+0.62*gravelDetail.b)*mix(0.82,1.0,contact);
            float stoneSpec=pow(max(dot(stoneN,normalize(viewV+sunNS)),0.0),36.0)*
                            (1.0-gravel.a)*contactWet*stoneLight;
            stoneColor+=vec3(0.84,0.93,0.99)*stoneSpec*0.20;
            float gravelCover=gravelShelf*max(emergedBar,smoothstep(0.10,0.52,gravelDetail.b+drift*0.32));
            surfCol=mix(surfCol,stoneColor,clamp(gravelCover,0.0,0.94));
          }

          /* Capillary wet stone meniscus & damp moss just above the waterline. */
          float wetMeniscus=(1.0-smoothstep(0.0,0.025,relY))*outerBankCap*clamp(uShoreWet,0.0,1.4);
          surfCol *= mix(1.0, 0.70, wetMeniscus * 0.68) * mix(1.0, 0.84, dampRim * 0.56);

          /* SATELLITE DRAPE (2026-11-24, client: 「做衛星感色塊」, after the Okanagan / VR-trip references: one continuous satellite picture over a
             DEM, so the land's colour changes in big natural patches and nothing repeats). Here, procedurally and continuously over the whole land:
             dark conifer stands in the cool hollows and gullies, lighter yellow-green meadows on open gentle ground, olive-dry upland grass,
             pale grey-tan bare ridges and screes, richer green along the valley floors; each in large warped patches with a finer mottle inside.
             A tint on the lit colour (its light and shade stay), strength / patch scale / contrast from the panel (「衛星感色塊」), ?satDrape=0 off */
          if (uSatDrape.x > 0.001) {
            float sc = uSatDrape.y;
            vec2 sp = wpW * 0.16 * sc;
            float sA = stFbm2(sp + vec2(2.3, -8.1)), sB = stFbm2(sp * 1.9 + vec2(-5.6, 3.9)), sC = forestNoise(wpW * 1.7 * sc + vec2(7.7, 1.3));
            float mottle = forestNoise(wpW * 4.6 * sc + vec2(-3.1, 9.4)) * 0.6 + forestNoise(wpW * 11.0 * sc + vec2(4.4, -6.6)) * 0.4;
            float slopeS = 1.0 - sN.y;
            float bare = clamp(smoothstep(0.42, 0.78, ridge * 0.55 + exposed * 0.55 + slopeS * 0.75 + (sB - 0.5) * 0.5) + rockCover * 0.35, 0.0, 1.0);
            float conifer = smoothstep(0.46, 0.66, sA * 0.62 + coolHollow * 0.34 + moisture * 0.18 - exposed * 0.22 + (mottle - 0.5) * 0.22) * (1.0 - bare);
            float dryGrass = smoothstep(0.5, 0.72, sB * 0.7 + warmUpland * 0.35 - moisture * 0.25) * (1.0 - conifer) * (1.0 - bare * 0.6);
            float riparian = valleyFloor * smoothstep(0.35, 0.75, moisture + (sC - 0.5) * 0.4) * (1.0 - bare);
            float meadow = clamp(1.0 - conifer - dryGrass - bare * 0.8, 0.0, 1.0) * smoothstep(0.35, 0.65, sC * 0.6 + sA * 0.4);
            vec3 tint = vec3(1.0);
            tint = mix(tint, vec3(0.58, 0.74, 0.62) * (0.86 + 0.28 * mottle), conifer * 0.85);
            tint = mix(tint, vec3(1.13, 1.13, 0.84), meadow * 0.55);
            tint = mix(tint, vec3(1.14, 1.04, 0.76), dryGrass * 0.6);
            tint = mix(tint, vec3(1.12, 1.06, 0.98), bare * 0.55);
            tint = mix(tint, vec3(0.84, 1.04, 0.86), riparian * 0.5);
            tint *= 0.9 + 0.2 * (sA * 0.6 + mottle * 0.4);                                   /* the picture's own large and small brightness changes */
            tint = mix(vec3(dot(tint, vec3(0.333))), tint, uSatDrape.z);                       /* contrast between the patches' hues */
            tint = mix(vec3(1.0), tint, clamp(uSatDrape.x, 0.0, 2.0) * mix(1.0, 0.6, uSatDrape.x > 1.0 ? 0.0 : 0.0));
            surfCol *= max(tint, vec3(0.2));
          }

          /* Filmic shoulder rolloff preserving crisp white sunlit rock highlights & deep charcoal shadows */
          surfCol = surfCol / (1.0 + surfCol * 0.20);
          col = mix(col, surfCol, clamp(stAmt, 0.0, 1.0));
        }

        /* -------------------- PART 2: FINE-SCALE AERIAL ALPINE LAKE & FLOW-ALIGNED DETAIL RIVERS -------------------- */
        if (waterBlend > 0.003) {
          // Smooth crossfade of current vector across the core-to-headwater boundary (zero seam pinch!)
          vec2 coreFlow = length(stCRFlow) > 0.01 ? stCRFlow : wsFlow;
          vec2 flowRaw = mix(coreFlow, wsFlow, outBlend);
          float bedSill=0.0, bedGrade=0.0;
          if (creekMix > 0.002) {
            vec2 downstream=stCreekCurrent(uvR);
            vec2 alongBed=downstream*uBounds.zw*0.043;
            vec4 ahead=texture2D(tWater,uvR+alongBed), behind=texture2D(tWater,uvR-alongBed);
            bedGrade=smoothstep(0.04,0.37,(behind.b-ahead.b)*uYRange.y*uRelief/0.086);
            bedSill=smoothstep(0.014,0.13,(behind.g+ahead.g)*0.5-wt.g)*min(behind.r,ahead.r);
            vec2 branchCurrent=downstream*(0.52+0.21*bedGrade+0.13*bedSill);
            flowRaw=mix(flowRaw,branchCurrent,creekMix);
          }
          float flowLen = length(flowRaw);
          vec2 flowDir = flowLen > 0.01 ? (flowRaw / flowLen) : normalize(${FALLS ? `vec2(${FALLS.FALLS_SHAPE.centre[0].toFixed(4)}, ${FALLS.FALLS_SHAPE.centre[1].toFixed(4)})` : 'vec2(0.122, -0.056)'} - wp + vec2(1e-4));
          vec2 flowPerp = vec2(-flowDir.y, flowDir.x);
          float flowSpd = mix(clamp(flowLen * 1.35 + 0.44, 0.44, 1.0), 0.24, stLakeN);
          flowSpd*=mix(1.0,0.68+0.30*(1.0-smoothstep(0.20,0.56,wt.g)),creekMix);

          /* Channel classification: wide central lake, confluence mouths, main canyon rivers & narrow headwaters */
          float wScale = clamp(uRiverDetail.x, 0.4, 2.2);
          float rivDet = clamp(uRiverDetail.y, 0.0, 1.8);
          float outerStreamF = max(headwaterMix, smoothstep(0.0, 1.35, outDist));
          float inWideLake = smoothstep(0.06, 0.60, lb.x);
          float mouthZone = 4.0 * inWideLake * (1.0 - inWideLake) * smoothstep(0.08, 0.45, stWmSafe);
          float narrowRiver = clamp(creekMix + outerStreamF * 0.82 + (1.0 - smoothstep(0.22, 0.62, stShore)) * (1.0 - inWideLake) * 0.48, 0.0, 1.0);

          /* Unified optical depth with organic shoal/point-bar modulation & dark center thalweg */
          float shoalVar = stFbm2(wp * 2.15 + vec2(3.4, -7.1)) - 0.5;
          float depthNoise = (forestNoise(wp * 1.45 + vec2(5.2, -3.1)) - 0.5) * 0.075 + shoalVar * 0.13 * (1.0 - inWideLake);
          float rawSh = clamp(stShore + depthNoise * smoothstep(0.03, 0.34, stShore), 0.0, 1.0);
          float basinProfile = clamp(lb.z + depthNoise * 0.14, 0.0, 1.0);
          float lakeSmoothD = mix(sqrt(basinProfile), basinProfile, 0.32);
          float riverSmoothD = smoothstep(0.02, 0.78, rawSh) * 0.88;
          /* Alternating deep sapphire pools, asymmetric cut-bank thalwegs & translucent turquoise gravel point-bars on upper headwaters */
          float outerPool = stFbm2(wp * 1.90 + vec2(4.1, -6.2));
          float outerBraid = forestNoise(wp * 5.6 + vec2(-2.3, 7.8));
          float outerDepth = mix(0.06, 0.88, pow(clamp(ws.z * (0.76 + 0.44 * outerPool) + (outerBraid - 0.5) * 0.20, 0.0, 1.0), 0.72));
          float shoreDist = clamp(max(smoothstep(0.0, 0.40, rawSh), smoothstep(0.0, 0.24, lb.z) * inWideLake), 0.0, 1.0);
          shoreDist = mix(shoreDist, smoothstep(0.0, 0.44, clamp(ws.z, 0.0, 1.0)), outerStreamF * 0.75);
          float wDepth = mix(riverSmoothD, lakeSmoothD, inWideLake);
          wDepth = mix(wDepth, outerDepth, outerStreamF);
          wDepth = mix(wDepth, clamp(wt.g + depthNoise * 0.52, 0.0, 1.0), creekMix);
          shoreDist = mix(shoreDist, smoothstep(0.04, 0.76, stWmSafe), creekMix);

          /* Organic mid-channel rapid chutes, bend turbulence & boulder riffle zones (shared by waves & whitewater!) */
          float chutePatch = stFbm2(wp * 1.65 + vec2(-2.9, 4.7));
          float riffleFine = forestNoise(wp * 4.2 + vec2(-2.8, 3.6)) * 0.60 + forestNoise(wp * 9.5 + vec2(4.1, -5.2)) * 0.40;
          float riverChute = smoothstep(0.46, 0.76, chutePatch * 0.62 + riffleFine * 0.38) * (1.0 - inWideLake) * smoothstep(0.08, 0.44, stWmSafe);
          float bankTurb = smoothstep(0.02, 0.16, shoreDist) * (1.0 - smoothstep(0.24, 0.54, shoreDist)) * (1.0 - inWideLake);

          /* --- 2A. Proportionally Scaled Aerial Lake Ripples & Anisotropic Flow-Advected River Wavelets --- */
          float wSpd = max(0.0, uWaterSpeed);
          float phBase = uTime * wSpd * 0.42;
          float a1 = fract(phBase), a2 = fract(phBase + 0.5);
          float b1 = 1.0 - abs(2.0 * a1 - 1.0), b2 = 1.0 - b1;
          float bn = inversesqrt(b1 * b1 + b2 * b2);

          float L1 = 0.28 * flowSpd;
          float L2 = 0.44 * flowSpd;
          vec2 o1A = flowDir * (a1 - 0.5) * L1, o2A = flowDir * (a2 - 0.5) * L1;
          vec2 o1B = flowDir * (a1 - 0.5) * L2, o2B = flowDir * (a2 - 0.5) * L2;

          /* Seamless world-space downstream advection (ZERO bend phase-shear or tile seams!) */
          mat2 crossR  = mat2(0.898, -0.438, 0.438, 0.898);
          mat2 crossRT = mat2(0.898,  0.438, -0.438, 0.898);
          float rippleScale = mix(1.0, 1.65, narrowRiver) * wScale;
          vec2 uvRiv1A = (wp - o1A) * 1.12 * rippleScale;
          vec2 uvRiv2A = (wp - o2A) * 1.12 * rippleScale + vec2(0.41, 0.27);
          vec4 wMac1 = texture2D(tWaterNrm, uvRiv1A);
          vec4 wMac2 = texture2D(tWaterNrm, uvRiv2A);
          vec4 wMic1 = texture2D(tWaterNrm, crossR * (wp - o1B) * 2.15 * rippleScale + vec2(0.17, 0.63));
          vec4 wMic2 = texture2D(tWaterNrm, crossR * (wp - o2B) * 2.15 * rippleScale + vec2(0.73, 0.19));

          vec2 rivN1 = ((wMac1.rg - 0.5) * b1 + (wMac2.rg - 0.5) * b2) * bn;
          vec2 rivN2 = crossRT * (((wMic1.rg - 0.5) * b1 + (wMic2.rg - 0.5) * b2) * bn);
          float rivCaust = (wMac1.b * b1 + wMac2.b * b2) * 0.52 + (wMic1.b * b1 + wMic2.b * b2) * 0.48;
          float rivFoamN = (wMac1.a * b1 + wMac2.a * b2) * 0.48 + (wMic1.a * b1 + wMic2.a * b2) * 0.52;

          /* Central Lake: delicate aerial alpine wind ripples + crossing breeze + close-up capillary shimmer */
          float microAA = 1.0 - smoothstep(0.011, 0.056, pxW);
          vec2 lakeN1 = vec2(0.0), lakeN2 = vec2(0.0), lakeN3 = vec2(0.0);
          float lakeCaust = 0.0;
          if (stLakeN > 0.002) {
            vec2 lUv1 = wp * (0.92 * wScale) + vec2(0.78, 0.62) * uTime * 0.028 * wSpd;
            vec2 lUv2 = crossR * wp * (1.72 * wScale) + vec2(-0.56, 0.83) * uTime * 0.048 * wSpd + vec2(0.31, 0.67);
            vec4 lk1 = texture2D(tWaterNrm, lUv1), lk2 = texture2D(tWaterNrm, lUv2);
            lakeN1 = lk1.rg - 0.5;
            lakeN2 = crossRT * (lk2.rg - 0.5);
            lakeCaust = lk1.b * 0.52 + lk2.b * 0.48;
            if (microAA > 0.02) {
              vec2 lUv3 = rotQ * wp * (3.15 * wScale) + vec2(0.34, -0.94) * uTime * 0.068 * wSpd + vec2(0.57, 0.13);
              lakeN3 = rotQT * (texture2D(tWaterNrm, lUv3).rg - 0.5);
            }
          }

          /* Smooth grazing-distance attenuation & natural wind-lane slicks ("cat's-paws") */
          float grazeAA = mix(0.46, 1.0, smoothstep(0.10, 0.52, abs(viewV.y)));
          float windPatch = stFbm2(wp * 0.78 + vec2(uTime * 0.012, -uTime * 0.009));
          float windBand = smoothstep(0.22, 0.78, windPatch);
          float leeShelter = mix(0.30, 1.0, smoothstep(0.04, 0.42, shoreDist));
          float lakeWind = mix(0.34, 1.14, windBand) * leeShelter;

          /* Anisotropic river slope shaping: elongated laminar wavelets in deep reaches, crisp transverse standing waves in rapid chutes */
          vec2 rivRawSlope = rivN1 * 0.96 + rivN2 * (0.64 * (0.38 + 0.62 * microAA));
          float sAlong = dot(rivRawSlope, flowDir);
          float sAcross = dot(rivRawSlope, flowPerp);
          float rapidBump = clamp(bedSill * 0.95 + bedGrade * 0.75 + riverChute * 0.72 + (1.0 - smoothstep(0.08, 0.36, wDepth)) * narrowRiver * 0.65, 0.0, 1.0);
          vec2 anisoRiv = flowDir * (sAlong * mix(0.62, 1.42, rapidBump)) + flowPerp * (sAcross * mix(1.22, 0.96, rapidBump));
          vec2 rivSlope = anisoRiv * mix(0.84, 1.24, rapidBump) * (0.78 + 0.26 * windBand);
          vec2 lakeSlope = (lakeN1 * 0.86 + lakeN2 * (0.56 * (0.40 + 0.60 * microAA)) + lakeN3 * (0.34 * microAA)) * lakeWind;
          vec2 dualSlope = mix(rivSlope, lakeSlope, stLakeN) * grazeAA;

          /* Delicate concentric resonant ripples around the central holographic LOGO */
          vec2 toLogo = wp - vec2(0.122, -0.056);
          float logoR = length(toLogo);
          float logoRad = max(0.35, uCurtainLogo.y * 0.5);
          if (uCurtainLogo.x > 0.5 && logoR < logoRad * 2.1) {
            float nr = logoR / logoRad;
            float ripWave = sin(nr * 38.0 - uTime * max(0.35, uCurtainLogo.z * 2.6)) * exp(-abs(nr - 0.96) * 2.8) * smoothstep(0.28, 0.62, nr);
            dualSlope += normalize(toLogo + vec2(1e-4)) * ripWave * 0.048 * uCurtainGlow;
          }

          /* Crisp proportionally accurate aerial wave slopes (6°-11° micro-ripple tilt, ZERO oversized ocean lumps!) */
          float waveAmp = mix(0.66, 0.58, stLakeN) * clamp(uWaterWave, 0.1, 2.5);
          vec2 sl = dualSlope * waveAmp * mix(0.48, 1.0, smoothstep(0.0, 0.30, shoreDist));
          sl *= mix(1.0, 0.68, outerStreamF);
          vec3 Nw = normalize(vec3(-sl.x, 1.0, -sl.y));
          float ndv = clamp(dot(Nw, viewV), 0.0, 1.0);

          /* --- 2B. Glacial Optical Depth, Refracted Alpine Riverbed Cobbles & Sharp Ray-Focused Caustics --- */
          float exposedBed = 1.0 - smoothstep(0.04, 0.78, wDepth);
          float shallMask = clamp(exposedBed * uWaterClear * 1.32, 0.0, 0.98);
          vec3 mineralLight = vec3(0.032, 0.152, 0.162) * (0.72 + 0.28 * sunVis);
          vec3 shallowTint = uWaterShallow * mix(1.06, 0.84, creekMix) + mineralLight * mix(0.46, 0.98, max(creekMix, outerStreamF * 0.72));
          shallowTint = mix(shallowTint, uWaterShallow * 0.72 + vec3(0.016, 0.044, 0.054), 0.52 * inWideLake);
          vec3 deepTint = uWaterDeep * mix(vec3(1.0), vec3(0.76, 0.85, 0.96), lakeSmoothD * inWideLake);
          vec3 waterBody = mix(shallowTint, deepTint, smoothstep(0.012, 0.86, pow(wDepth, 0.74)));
          /* Mineral-turquoise river inflow plumes fanning subtly into the calm central lake */
          waterBody = mix(waterBody, shallowTint * 1.20, mouthZone * 0.30 * rivDet);
          float bedRelief = 0.5;
          if (shallMask > 0.012) {
            vec4 gravel, gravelDetail;
            float contact;
            vec3 refractedView = -refract(-viewV, vec3(0.0, 1.0, 0.0), 0.75);
            stCobbleSurface(wp + sl * (0.012 + 0.026 * wDepth), vec3(0.0, 1.0, 0.0), refractedView, sunNS, gravel, gravelDetail, contact);
            bedRelief = gravelDetail.b;
            vec2 bedSlope = stGravelSlope(gravelDetail.rg);
            vec3 bedN = normalize(vec3(bedSlope.x * 1.24, 1.0, bedSlope.y * 1.24));
            float bedSun = max(dot(bedN, sunNS), 0.0) * sunVis * contact;
            float caustic = smoothstep(0.24, 0.82, mix(rivCaust, lakeCaust, stLakeN)) * bedSun;
            float path = max(0.0, wDepth - (bedRelief - 0.44) * 0.15) / max(0.42, ndv);
            vec3 transmission = exp(-vec3(3.75, 1.88, 1.48) * path);
            vec3 bottom = gravel.rgb * gravelDetail.a * (skyFillCol * (1.18 + 0.68 * bedN.y) + sunKeyCol * bedSun * 0.92);
            /* Cool glacial mineral slate silt on point bars (zero muddy yellow/ochre!) */
            float silt = max(creekMix, outerStreamF * 0.58) * (1.0 - smoothstep(0.035, 0.26, wDepth)) * (1.0 - bedSill) *
                         (1.0 - smoothstep(0.36, 0.68, bedRelief));
            bottom = mix(bottom, (vec3(0.14, 0.22, 0.25) + gravel.rgb * 0.30) * (0.58 + 0.58 * bedSun), silt * 0.64);
            bottom *= vec3(0.92, 0.98, 1.00) * (0.68 + bedRelief * 0.66 + caustic * 0.48) * mix(0.83, 1.0, contact);
            float exposedStone = smoothstep(0.58, 0.85, bedRelief) * (1.0 - smoothstep(0.018, 0.20, wDepth));
            vec3 stoneTop = bottom * vec3(1.08, 1.12, 1.15);
            bottom = bottom * transmission + shallowTint * (0.30 + 0.44 * (1.0 - transmission));
            bottom = mix(bottom, stoneTop, exposedStone * 0.84);
            float bedVisibility = shallMask * mix(0.88, 1.0, max(creekMix, outerStreamF * 0.62)) * (1.0 - inWideLake * (0.15 + 0.18 * lakeSmoothD));
            waterBody = mix(waterBody, bottom, bedVisibility);
          }
          waterBody *= 1.0 - smoothstep(0.18, 0.98, wDepth) * 0.20;
          /* Keep deep glacial sapphire richness on upper headwater channels (prevents pale pastel blue ribbons!) */
          waterBody *= mix(1.0, 0.80, outerStreamF * (1.0 - exposedBed * 0.55));

          /* Crisp directional micro-ripple shading so fine wind-wavelets read cleanly across lake & rivers */
          float waveFace = clamp(dot(Nw, sunNS), 0.0, 1.0);
          float waveContrast = 0.76 + 0.54 * smoothstep(0.12, 0.86, waveFace) * (0.35 + 0.65 * sunVis) * clamp(uSunIntensity, 0.5, 1.8);
          waterBody *= waveContrast;
          float rippleCrest = smoothstep(0.045, 0.18, abs(dot(sl, sunNS.xz))) * smoothstep(0.30, 0.85, waveFace);
          waterBody += vec3(0.032, 0.074, 0.118) * rippleCrest * (0.35 + 0.65 * sunVis);

          /* --- 2C. Deep Alpine Sky Fresnel, Dark Gorge Bank Reflections & Pinpoint Sunlight Sparkles --- */
          vec3 Rw = reflect(-viewV, Nw);
          vec3 skyHorizon = vec3(0.24, 0.40, 0.59);
          vec3 skyZenith  = vec3(0.05, 0.14, 0.29);
          vec3 skyRefl = mix(skyHorizon, skyZenith, smoothstep(0.03, 0.72, max(0.0, Rw.y)));
          /* Narrow incised mountain rivers reflect darker surrounding slopes rather than bright open sky */
          skyRefl *= mix(1.0, 0.74, narrowRiver * (1.0 - inWideLake));
          float sunReflTight = pow(max(dot(Rw, sunNS), 0.0), 72.0) * sunVis;
          skyRefl += vec3(0.68, 0.76, 0.84) * sunReflTight * 0.34 * clamp(uSunIntensity, 0.4, 1.8);

          /* Dark canyon cliff & pine slope reflection anchoring every bank and lakeshore */
          vec3 cliffShadeRefl = mix(vec3(0.014, 0.034, 0.058), skyRefl, smoothstep(0.04, 0.54, shoreDist));
          vec3 reflCol = cliffShadeRefl;
          #ifdef FOREST_MIRROR
          float obliqueMirror = 1.0 - smoothstep(0.34, 0.90, abs(viewV.y));
          if (outDist <= 0.0005 && obliqueMirror > 0.01) {
            vec4 rp = uReflMat * vec4(vForestWorld, 1.0);
            vec4 rf = texture2D(tRefl, clamp(rp.xy / max(rp.w, 1e-4) + sl * 0.055, vec2(0.002), vec2(0.998)));
            vec3 safeBankRefl = max(rf.rgb * 0.66, uWaterDeep * 0.78);
            reflCol = mix(cliffShadeRefl, safeBankRefl, clamp(rf.a, 0.0, 0.88) * obliqueMirror);
          }
          #endif

          /* Crisp glassy Schlick Fresnel keeping overhead water rich sapphire-teal */
          float fres = clamp(0.048 + 0.66 * pow(1.0 - ndv, 4.0), 0.048, 0.68);
          vec3 wc = mix(waterBody, reflCol, fres * 0.76);

          /* Waterline contact AO so sheer rock walls & boulders plunge cleanly into water */
          wc *= mix(mix(0.66, 0.88, exposedBed), 1.0, smoothstep(0.0, 0.24, shoreDist));

          /* Pinpoint sparkling sunlight glints dancing across fine ripples (ZERO milky grey smear!) */
          vec3 Hsun = normalize(viewV + sunNS);
          float nh = max(dot(Nw, Hsun), 0.0);
          float unresolved = clamp(length(fwidth(Nw)) * 2.2, 0.0, 1.0);
          float lakeGlint = pow(nh, mix(440.0, 150.0, unresolved)) * mix(4.60, 1.65, unresolved)
                          + pow(nh, mix(115.0, 52.0, unresolved)) * mix(0.56, 0.24, unresolved);
          float riverGlint = pow(nh, mix(220.0, 88.0, unresolved)) * mix(2.85, 1.15, unresolved)
                           + pow(nh, 52.0) * 0.22;
          float specShimmer = mix(riverGlint / (1.0 + riverGlint * 0.58), lakeGlint / (1.0 + lakeGlint * 0.26), stLakeN);
          float shallowSpec = mix(1.0, 0.52, exposedBed) * mix(1.0, 0.76, creekMix);
          wc += vec3(0.92, 0.97, 1.00) * specShimmer * sunVis * clamp(uSunIntensity, 0.3, 2.0) * smoothstep(0.03, 0.22, shoreDist) * shallowSpec * mix(1.0, 0.46, outerStreamF);
          /* Outer headwater rivers stay jewel-clear & gorge-shaded instead of turning flat silver-grey */
          wc = mix(wc, mix(waterBody, cliffShadeRefl, fres * 0.40) + vec3(0.76, 0.90, 0.98) * specShimmer * sunVis * 0.30 * shallowSpec, outerStreamF * 0.68);

          /* --- 2D. Holographic Light Curtain & Central LOGO Fine Wave-Slope Water Reflection --- */
          if (uCurtainGlow > 0.002 && uWaterGlow > 0.002) {
            float cg = uCurtainGlow * uWaterGlow * (1.0 - outerStreamF * 0.92);
            float grazingCap = mix(0.16, 1.0, smoothstep(0.20, 0.66, abs(viewV.y)));
            float slopeCatch = smoothstep(0.03, 0.32, length(sl) * 3.6) * (0.45 + 0.55 * smoothstep(-0.22, 0.32, dot(sl, normalize(viewV.xz + vec2(1e-4)))));
            float waveCatch = mix(0.24, 0.94, slopeCatch);

            float riverDist = (outDist <= 0.0005) ? stCRDist0 : (1.0 - clamp(ws.z, 0.0, 1.0)) * 0.24;
            float inRiverZone = (1.0 - stLakeN * 0.80) * smoothstep(0.12, 0.58, stWmSafe);
            float coreRefl = exp(-riverDist * riverDist * 135.0);
            float softPool = exp(-riverDist * riverDist * 22.0);
            float pulseTravel = 0.74 + 0.26 * sin(dot(wp, flowDir) * 3.8 - uTime * max(0.2, uCurtainLogo.z) * 5.5);
            float rivGlow = (coreRefl * (0.28 + 0.52 * waveCatch) + softPool * 0.14) * inRiverZone * pulseTravel;

            float logoBounce = 0.0;
            float logoSpecBounce = 0.0;
            if (uCurtainLogo.x > 0.5) {
              vec2 lRel = toLogo + sl * 0.22 - viewV.xz * logoRad * 0.10;
              float lrN = length(lRel) / logoRad;
              float logoSubPool = exp(-lrN * lrN * 1.32) * 0.26;
              float logoRingRefl = exp(-pow((lrN - 0.92) / 0.24, 2.0)) * (0.35 + 0.39 * waveCatch);
              float rRate = max(0.09, uCurtainLogo.z * 0.38);
              float rPh = fract(uTime * rRate);
              float ripR = 0.68 + rPh * 1.08;
              float ripGlow = exp(-pow((lrN - ripR) / 0.12, 2.0)) * (1.0 - rPh) * (0.12 + 0.22 * waveCatch);
              float lGate = smoothstep(0.18, 0.78, stLakeN) * smoothstep(0.55, 0.98, uCurtainLogo.w);
              logoBounce = (logoSubPool + logoRingRefl * 0.65 + ripGlow) * lGate;
              logoSpecBounce = (logoRingRefl * 0.52 + ripGlow * 0.45) * lGate;
            }

            float reflectedInRiver = mix(1.0, 0.39, exposedBed) * mix(1.0, 0.37, creekMix);
            vec3 iceScatter = uCurtainCol * (rivGlow * 0.40 * reflectedInRiver + logoBounce * 0.70);
            vec3 iceSpecular = uCurtainContact * (coreRefl * inRiverZone * waveCatch * 0.26 * reflectedInRiver + logoSpecBounce * 0.36) * (0.45 + 0.55 * fres);
            wc += (iceScatter + iceSpecular) * cg * grazingCap;
          }

          /* --- 2E. Calibrated Directional LIC Braided Streamlines, Rapid Chutes, Boulder Wakes & Lacy Shore Foam --- */
          float licStep = mix(0.036, 0.020, narrowRiver) / max(wScale, 0.5);
          float sFreq = 1.48 * rippleScale;
          vec2 sUv1 = (wp - o1A * 1.35) * sFreq + vec2(0.11, 0.37);
          vec2 sUv2 = (wp - o2A * 1.35) * sFreq + vec2(0.61, 0.83);
          vec2 fOff = flowDir * (licStep * sFreq);
          vec2 thA = (texture2D(tWaterNrm, sUv1).ba + texture2D(tWaterNrm, sUv1 - fOff).ba + texture2D(tWaterNrm, sUv1 + fOff).ba) * 0.3333;
          vec2 thB = (texture2D(tWaterNrm, sUv2).ba + texture2D(tWaterNrm, sUv2 - fOff).ba + texture2D(tWaterNrm, sUv2 + fOff).ba) * 0.3333;
          vec2 threads = thA * b1 + thB * b2;
          float threadCaust = threads.x;
          float threadLace = threads.y;

          /* Calibrated post-LIC silky braided streamlines flowing down ALL 4 main rivers, headwaters & mouth fans */
          float flowMask = clamp((1.0 - stLakeN) + mouthZone * 0.88, 0.0, 1.0);
          float centerBand = smoothstep(0.04, 0.34, shoreDist);
          float braid = 0.54 + 0.46 * sin(dot(wp, flowPerp) * mix(22.0, 34.0, narrowRiver) + stFbm2(wp * 3.4 + vec2(1.7, -4.2)) * 4.4);
          float silkRibbon = smoothstep(0.35, 0.63, threadLace) * braid;
          float fineStreak = smoothstep(0.46, 0.76, rivFoamN * 0.55 + threadLace * 0.45) * (0.45 + 0.55 * braid);
          float currentThreads = (silkRibbon * 0.72 + fineStreak * 0.44) * flowMask * flowSpd * centerBand * rivDet;
          vec3 threadTint = mix(vec3(0.38, 0.74, 0.86), vec3(0.80, 0.94, 0.99), smoothstep(0.38, 0.74, silkRibbon));
          wc += threadTint * currentThreads * mix(0.28, 0.24, outerStreamF) * grazeAA * (0.58 + 0.42 * sunVis);
          /* Gentle luminous glacial-cyan flow sheen tapering organically into upper headwaters past 上市櫃投資 */
          float headSheen = outerStreamF * exp(-outDist * 0.52) * smoothstep(0.32, 0.82, ws.z) * (0.45 + 0.55 * silkRibbon) * rivDet;
          wc += vec3(0.46, 0.80, 0.96) * headSheen * 0.18 * (0.55 + 0.45 * sunVis);

          /* Multi-source rapid & riffle energy: mid-channel rocky chutes, shallow gravel bars, boulder wakes, sills & outer bends */
          float shallowRiffle = smoothstep(0.025, 0.14, wDepth) * (1.0 - smoothstep(0.26, 0.62, wDepth));
          float riffleZone = smoothstep(0.36, 0.70, riffleFine) * shallowRiffle * (1.0 - inWideLake);
          float stoneWake = smoothstep(0.54, 0.80, bedRelief) * (shallowRiffle + bankTurb * 0.65) * (1.0 - inWideLake) * 0.78;
          float rapidEnergy = clamp(
            riverChute * (0.52 + 0.48 * bankTurb)
            + riffleZone * 0.72
            + stoneWake * 0.66
            + max(bedSill * 0.96, bedGrade * 0.78) * (1.0 - smoothstep(0.18, 0.52, wDepth)) * creekMix
            + outerStreamF * (riverChute * 0.78 + shallowRiffle * smoothstep(0.30, 0.68, riffleFine) * 0.68)
            + mouthZone * 0.28 * silkRibbon,
            0.0, 1.35
          );
          /* Aerated glacial-turquoise glow beneath churning rapids & chutes */
          float aerGlow = rapidEnergy * smoothstep(0.28, 0.62, threadLace * 0.62 + rivFoamN * 0.38) * rivDet;
          wc = mix(wc, mix(wc, vec3(0.24, 0.66, 0.76), 0.58), clamp(aerGlow * 0.54, 0.0, 0.48));

          /* Lacy flow-stretched whitewater foam ribbons trailing downstream through chutes & boulder wakes */
          float foam = 0.0;
          if (uWhitewater > 0.002 && inWideLake < 0.88) {
            float aerated = threadLace * 0.58 + rivFoamN * 0.30 + threadCaust * 0.24 + (bedRelief - 0.5) * 0.16;
            float fwA = min(0.09, fwidth(aerated) * 0.72);
            float foamLace = smoothstep(0.36 - fwA, 0.65 + fwA, aerated);
            foam = rapidEnergy * foamLace * smoothstep(0.24, 0.78, stWmSafe) * (1.0 - inWideLake * 0.86);
            foam *= uWhitewater * rivDet * (0.72 + 0.28 * sunVis);
          }

          /* Whisper-thin broken rocky shoreline contact foam (strongly broken on narrow outer streams so ZERO uniform pale outline!) */
          float shoreBreakN = forestNoise(wp * 5.8 + vec2(1.9, -4.3));
          float shoreEdge = smoothstep(0.004, 0.032, shoreDist) * (1.0 - smoothstep(0.032, 0.125, shoreDist + (rivFoamN - 0.5) * 0.070));
          float shoreGate = smoothstep(mix(0.34, 0.52, outerStreamF), mix(0.74, 0.84, outerStreamF), rivFoamN * 0.58 + shoreBreakN * 0.50);
          float shoreLap = shoreEdge * shoreGate * mix(0.36, 0.22, inWideLake) * mix(1.0, 0.42, outerStreamF) * (0.55 + 0.45 * rivDet) * uWhitewater;

          float froth = (foam * 0.95 + shoreLap) * mix(1.0, 0.86, outerStreamF);
          vec3 foamCol = mix(vec3(0.68, 0.87, 0.93), vec3(0.93, 0.98, 1.00), smoothstep(0.20, 0.70, froth) * (0.48 + 0.52 * sunVis));
          wc = mix(wc, foamCol, min(0.85, froth / (1.0 + 0.30 * froth)));

          wc = wc / (1.0 + wc * 0.14);
          ${FALLS ? '' : `/* CANYON WATER (2026-11-24, client: 「河流顏色要跟前面山道一樣」): the rivers take the canyon's water before this view (sampled from
             its frames: deep navy (17,37,59), steel blue (31,53,77), its light (155,176,188) in sRGB): the same water seen from above. Mapped by the
             water's own brightness, so its depth, ripples and white water stay; the lake keeps a little of its own colour. ?canyonWater=0 = before */
          if (uCanyonWater.x > 0.001) {
            float cwl = dot(wc, vec3(0.2126, 0.7152, 0.0722));
            /* SEAMS (2026-11-24, client: 「俯視山谷繼續精修 尤其在接縫處」): the base colour comes from the water's DEPTH (deep navy → shallow steel),
               not from its brightness: the rivers (bright with threads, bed and sky) no longer turn into a pale silver sheet against the dark lake.
               Only real highlights (glints, foam, thread crests) become the canyon's light, and only as sparkle. */
            float shallowK = 1.0 - smoothstep(0.04, 0.72, wDepth);
            vec3 cw = mix(vec3(0.0056, 0.0185, 0.0437), vec3(0.0137, 0.0368, 0.0762), 0.30 + 0.55 * shallowK);
            cw *= 0.78 + 0.44 * smoothstep(0.015, 0.22, cwl);                                                   /* the water's own shading (ripples, shade) */
            cw *= 1.0 - 0.18 * smoothstep(0.2, 0.8, cwl) * (1.0 - inWideLake);                                   /* the rivers' grazing sheen does not lift the whole river */
            float sparkle = clamp(froth * 0.95 + specShimmer * 0.32 + currentThreads * 0.22, 0.0, 1.0);             /* sparkle only from foam, glints and flow threads */
            cw += vec3(0.32, 0.43, 0.50) * sparkle * uCanyonWater.z;                                              /* … in the canyon's light */
            wc = mix(wc, cw, uCanyonWater.x * mix(1.0, uCanyonWater.y, inWideLake));
          }`}${FALLS ? `
          /* director 2026-11-24 (client 「河流也要統一」): every river is ONE water with the falls: its brightness kept, its colour re-graded into the
             falls' teal family (deep teal-steel -> pale teal), the white riffles tamed to one scale, nearer the gorge the band's teal */
          { float wl = dot(wc, vec3(0.2126, 0.7152, 0.0722));
            float rq = forestNoise(wp * 23.0 + flowDir * uTime * 0.35) * 0.55 + forestNoise(wp * 47.0 - flowDir * uTime * 0.55) * 0.45;
            float lw = smoothstep(0.03, 0.62, wl * 0.80 + (rq - 0.5) * 0.10);
            vec3 uni = mix(mix(vec3(0.052, 0.170, 0.200), vec3(0.165, 0.420, 0.440), lw), vec3(0.62, 0.78, 0.80), smoothstep(0.62, 1.0, lw) * 0.55);
            float nearG = 1.0 - smoothstep(0.25, 2.6, stFallsSd);
            uni = mix(uni, mix(vec3(0.040, 0.130, 0.140), vec3(0.150, 0.330, 0.330), lw), nearG * 0.60);   /* director fix2: deep teal near the gorge, never a light rim */
            wc = mix(wc, uni, 0.82); }` : ''}
          col = mix(col, wc, waterBlend * clamp(stAmt, 0.0, 1.0));
        }

        // Screen-space antialiasing keeps real elevation contours hairline-thin.
        // Dense cliff contours fade before they turn into moire or white bands.
        if (uContours > 0.001 && landM > 0.01) {
          float h=(vForestWorld.y-0.105)/max(uContourInterval,0.025);
          float fw=max(fwidth(h),0.0001);
          float line=1.0-smoothstep(fw*0.25,fw*1.15,abs(fract(h+0.5)-0.5));
          float indexLine=1.0-step(0.5,mod(floor(h+0.5),4.0));
          float contourA=line*uContours*mix(0.30,0.80,indexLine)*(1.0-smoothstep(0.18,0.55,fw));
          contourA*=smoothstep(0.025,0.08,vForestWorld.y-0.105)*landM;
          contourA*=mix(1.0,0.22,smoothstep(0.12,0.85,stBranch));
          col=mix(col,vec3(0.52,0.59,0.55),contourA);
        }

        /* -------------------- PART 3: COOL CANYON AERIAL PERSPECTIVE -------------------- */
        if (uStudioMist > 0.002) {
          float camD = length(cameraPosition - vForestWorld);
          float obliqueFactor = 1.0 - smoothstep(0.52, 0.96, abs(viewV.y));
          float outerRidge=smoothstep(2.4,8.2,outDist);
          float farA=smoothstep(uDist*mix(.61,.52,outerRidge),uDist*mix(2.35,1.82,outerRidge),camD);
          float sunSide = pow(max(dot(-viewV, sunNS), 0.0), 2.0);
          /* Cool steel-periwinkle canyon haze warming cleanly to silvery-white toward the sun! */
          vec3 airCol = mix(vec3(0.32, 0.44, 0.62), vec3(0.86, 0.90, 0.95), sunSide * 0.60);
          float ridgeAir=outerRidge*obliqueFactor*exp(-max(0.0,vForestWorld.y-.105)*.32);
          airCol=mix(airCol,vec3(.42,.52,.65),ridgeAir*.30);
          airCol=mix(airCol,vec3(.86,.90,.94),uAirWhite);   /* 2026-11-21 遠景霧白度 (0 = as before) */
          float mistAmt=clamp(farA*((.28+.66*obliqueFactor)*.64+.17*ridgeAir)*uStudioMist,0.0,.74);
          col = mix(col, airCol, mistAmt);
        }

        col = stValleyAir(col, vForestWorld, cameraPosition);

        }
      }
    `;

    const waterExpandReplace = `
      #ifdef FOREST_MIRROR
      float stNotMirror = 1.0 - step(0.5, uMirror);
      #else
      float stNotMirror = 1.0;
      #endif
      float stOut0 = forestOut(uvR);
      float stBranch = uTributaries > 0.5 && stOut0 < 0.0005 ? wt.a : 0.0;${useFieldBake ? `
      vec2 stBakeUv = clamp((vForestWorld.xz + vec2(19.0, 16.0)) * vec2(0.02631579, 0.03125), vec2(0.0005), vec2(0.9995));
      vec4 stBake = (stNotMirror > 0.5 && uPbrTerrainOn > 0.001) ? texture2D(tStFieldBake, stBakeUv) : vec4(1.0, 0.0, 0.0, 0.0);` : ''}
      vec3 stLB0 = (stNotMirror > 0.5 && stOut0 <= 0.0005 && uPbrTerrainOn > 0.001${useFieldBake ? (useOpt3Cloud ? ' && stBake.b > 0.004' : ' && stBake.a > 0.004') : ''}) ? stCentralLakeBasin(vForestWorld.xz) : vec3(0.0);${FALLS && !FALLS_SINK ? `
      if (stFallsSd < 0.0) discard;   /* RISE FALLS: inside the rim the gorge's own meshes are the land */` : ''}
      vec2 stCRFlow = vec2(0.0);
      float stCRDist0 = 9.0;
      vec3 stCR0 = (stNotMirror > 0.5 && stOut0 <= 0.0005 && uPbrTerrainOn > 0.001${useFieldBake ? ' && stBake.b > 0.004' : ''}) ? stCoreRiversEx(vForestWorld.xz, stCRFlow, stCRDist0) : vec3(0.0);
      ${FALLS ? 'wt.r *= 1.0 - smoothstep(0.3, 0.7, wt.b);   /* director fix2: no old-lake water anywhere outside the live rim (it made the light ring round the bowl) */   /* redo-s5: the OLD lake water (atlas, wt.b) away from the live rim is dry land (a smaller opening leaves part of the old lake outside) */' : ''}
      float wm = max(max(wt.r, stLB0.x), stCR0.x);
      float shore = max(max(wt.g, stLB0.z * 0.94 * smoothstep(0.05, 0.35, stLB0.x)), stCR0.z * 0.58 * smoothstep(0.05, 0.35, stCR0.x));
      float lakeN = ${FALLS ? '0.0;   /* RISE FALLS: no still lake is left: the water outside the rim runs to the lip */' : 'max(stBranch > 0.001 ? 0.0 : wt.b, smoothstep(0.05, 0.42, stLB0.x));'}
    `;
    const flowReplace = `
      vec2 F=fl.rg*2.-1.;
      if (stCR0.x > 0.05 && length(F) < 0.22 && length(stCRFlow) > 0.01) {
        F = mix(F, stCRFlow * 0.72, smoothstep(0.05, 0.40, stCR0.x));
      }
    `;

    if (document.documentElement.hasAttribute('data-rise-studio-pbr')) {
      /* On rise.html uLand is permanently 0 (PBR replaces land col); strip dead D1 Voronoi block to cut ANGLE/FXC compile time */
      mat.fragmentShader = mat.fragmentShader.replace(/if\(landOn>\.001\)\{[\s\S]*?col\*=mix\(1\.,\.62\+\.62\*litG,\.6\*landK\*uLandB\.y\);\r?\n\s*\}/, '');
    }
    mat.fragmentShader = mat.fragmentShader
      .replace('void main(){', decls + '\nvoid main(){')
      .replace('vec3 col=forestNWFix(texture2D(tPlate,uv).rgb,uv);', 'vec3 col=vec3(0.05,0.08,0.09);')
      .replace('vec3 wt=texture2D(tWater,uv).rgb;', 'vec4 wt=texture2D(tWater,uv);')
      .replace('float wm=wt.r, shore=wt.g, lakeN=wt.b;', waterExpandReplace)
      .replace('vec2 F=fl.rg*2.-1.;', flowReplace)
      .replace('float cshadow=smoothstep(.48,.78,forestFbm(vForestWorld.xz*.34+vec2(uTime*.004,-uTime*.002)));', 'float cshadow=uCloud>.001?smoothstep(.48,.78,forestFbm(vForestWorld.xz*.34+vec2(uTime*.004,-uTime*.002))):0.;')
      .replace('col=forestHaze(col,vForestWorld);', inject + '\ncol=forestHaze(col,vForestWorld);\ncol=stArrivalColor(col,vForestWorld.xz,vStArrival);')
      .replace('gl_FragColor=vec4(col,1.);', `
        // Feather each side before the last row of the 11.5-unit skirt.
        // Evaluate the sky on this exact camera ray, after all land grading.
        vec2 past=max(max(-uvR,uvR-1.0),0.0)/uBounds.zw;
        float rim=max(past.x,past.y);
        if(rim>3.0 && uPbrTerrainOn>0.5) {
          float weather=forestNoise(vForestWorld.xz*0.41)*0.90-0.45;
          float edge=smoothstep(3.65,10.1,rim+weather);
          vec3 ray=normalize(vForestWorld-cameraPosition);
          col=mix(col,stAlpineSky(ray,uPbrStyle,uCloudLayer,uArrival),edge);
        }
        // The brush compositor reads the survey ink from alpha. RGB stays fully shaded.
        float surveyInk = 0.0;
        if (uEntrySurvey > 0.5) {
          float h = (vForestWorld.y - 0.105) / max(uContourInterval, 0.075);
          float aa = max(fwidth(h), 0.0001);
          float indexLine = 1.0 - step(0.5, mod(floor(h + 0.5), 4.0));
          float contour = 1.0 - smoothstep(aa * 0.22, aa * mix(1.08, 1.65, indexLine), abs(fract(h + 0.5) - 0.5));
          float reach = 1.0 - smoothstep(0.17, 0.58, aa);
          float land = (1.0 - smoothstep(0.30, 0.71, wm)) * smoothstep(0.025, 0.095, vForestWorld.y - 0.105);
          surveyInk = contour * reach * land * mix(0.51, 0.90, indexLine);
          surveyInk *= 1.0 - smoothstep(3.0, 8.2, rim);
        }
        gl_FragColor=vec4(col,1.0-surveyInk);`);
    mat.needsUpdate = true;
    /* OPT3 (2026-11-26): dedicated lightweight ~4 KB mirror shader (exact same math as uMirror > 0.5 branch)
       so Forest mirror avoids compiling/spilling registers of the 138 KB main terrain+water shader!
       Shares mat.uniforms directly; ?opt3=0 disables and keeps the original path untouched. */
    if (document.documentElement.hasAttribute('data-rise-opt3') && new URLSearchParams(location.search).get('opt3') !== '0' && mat.defines?.FOREST_MIRROR) {
      const mirrorFrag = `
        uniform sampler2D tCanopy, tGrassAlb, tRockAlb${useOpt3Cloud ? ', tStFieldBake' : ''};
        uniform vec4 uBounds, uSkirt, uView;
        uniform vec2 uYRange, uSkirtAir;
        uniform vec3 uSun, uRockBaseGain, uMeadowBase, uMeadowTips, uMeadowMoss, uMeadowDry, uMeadowLayerCover, uLatticeGround;
        uniform float uTime, uRelief, uHaze, uDist, uVig, uLattice;
        uniform float uPbrStyle, uPbrTerrainOn, uGrassSat, uRockSlope, uGrassCover, uSunIntensity, uCloudLayer;
        varying vec3 vForestWorld, vStOutN;
        varying vec2 vStCurvature;
        varying float vStArrival;
        const vec2 PX = vec2(1494., 836.);
        vec2 forestMir(vec2 u){vec2 lo=uSkirt.xy,hi=1.-uSkirt.xy;u=mix(u,2.*hi-u,step(hi,u));return mix(u,2.*lo-u,step(u,lo));}
        float forestOut(vec2 u){return length(max(max(-u,u-1.),0.)/uBounds.zw);}
        float forestHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float forestNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(forestHash(i),forestHash(i+vec2(1.,0.)),f.x),mix(forestHash(i+vec2(0.,1.)),forestHash(i+vec2(1.,1.)),f.x),f.y);}
        vec3 forestHaze(vec3 col,vec3 world){
          float far=clamp((length(cameraPosition-world)-uDist)/uDist*5.,0.,1.);
          float low=1.-smoothstep(.12,.8,world.y);
          return mix(col,vec3(.63,.73,.77),far*(.3+.7*low)*uHaze*.6);
        }
        vec3 stMeadowCover(vec3 habitat){
          vec3 edge=mix(vec3(1.16),vec3(.28),uMeadowLayerCover);
          vec3 cover=smoothstep(edge-.14,edge+.14,clamp(habitat,0.0,1.0));
          cover.y*=1.0-.62*cover.x; cover.z*=1.0-.36*cover.y; return cover;
        }
        vec3 stMeadowDye(vec3 source,vec3 cover){
          float value=dot(source,vec3(.2126,.7152,.0722));
          vec3 grain=clamp(source/max(.005,value),.63,1.45);
          vec3 pigment=mix(uMeadowBase/.12,uMeadowMoss/.11,cover.x);
          pigment=mix(pigment,uMeadowDry/.30,cover.y);
          pigment=mix(pigment,uMeadowTips/.29,cover.z);
          return value*pigment*mix(vec3(1.0),grain,.23);
        }
        vec3 stGrassAlbedo(vec4 scan){return scan.r*scan.r*vec3(.94,1.037,.81);}
        vec3 stSat(vec3 c,float s){float l=dot(c,vec3(0.2126,0.7152,0.0722));return max(vec3(0.0),mix(vec3(l),c,s));}
        float stGrassCover(float up,float rockExposure,float pocket){
          float rooting=up-0.22*rockExposure+pocket+(0.88-uRockSlope)*0.30;
          float threshold=mix(1.32,0.14,uGrassCover);
          return smoothstep(threshold-0.112,threshold+0.122,rooting);
        }
        float stFbm2(vec2 p){return forestNoise(p)*0.67+forestNoise(mat2(0.80,-0.60,0.60,0.80)*p*2.04+vec2(7.3,4.1))*0.33;}
        ${useOpt3Cloud ? `
        uniform float uArrival, uArrivalMap;
        vec3 stArrivalColor(vec3 color, vec2 p, float field) {
          if (uArrival >= 0.9999) return color;
          float outside = length(max(abs(p) - vec2(7.0, 3.917), 0.0));
          float fallback = 0.23 + length(p * vec2(1.0, 1.35)) * 0.065;
          float arrival = mix(fallback, field, uArrivalMap) + outside * 0.018;
          float edgeNoise = forestNoise(p * 3.1) * 0.025 + forestNoise(p * 0.83) * 0.04;
          float front = uArrival * 1.36 - arrival + edgeNoise;
          float life = smoothstep(0.0, 0.11, front);
          float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
          vec3 stone = vec3(luminance * 0.88 + 0.008);
          float lip = exp(-pow((front - 0.045) / 0.029, 2.0));
          return mix(stone, color, life) + vec3(0.023, 0.027, 0.012) * lip;
        }` : HIGHLAND_GLSL}
        ${ALPINE_SKY_GLSL}
        void main(){
          if(vForestWorld.y<0.1072) discard;
          vec2 uvR=(vForestWorld.xz-uBounds.xy)*uBounds.zw, uv=forestMir(uvR);
          vec2 wp=vForestWorld.xz;
          float outDist=forestOut(uvR);
          vec3 sunNS=normalize(uSun);
          vec3 sunKeyCol=vec3(2.12,1.99,1.72)*clamp(uSunIntensity,0.25,2.0);
          vec3 skyFillCol=vec3(0.16,0.24,0.35);
          vec2 eM=1.6/PX;
          float mL=texture2D(tCanopy,uv-vec2(eM.x,0.0)).r;
          float mR=texture2D(tCanopy,uv+vec2(eM.x,0.0)).r;
          float mD=texture2D(tCanopy,uv-vec2(0.0,eM.y)).r;
          float mU=texture2D(tCanopy,uv+vec2(0.0,eM.y)).r;
          vec3 mN=normalize(vec3(-(mR-mL)*14.0*uRelief,1.0,-(mU-mD)*14.0*uRelief));
          if(outDist>0.0005) mN=normalize(mix(mN,normalize(vStOutN),smoothstep(0.0,2.25,outDist)));
          vec4 mScan=texture2D(tGrassAlb,wp*.48);
          vec3 mGrass=stGrassAlbedo(mScan)*vec3(.40,.66,.48);
          float mUp=smoothstep(.12,.72,(vForestWorld.y-.105)/max(.25,(uYRange.x+uYRange.y-.105)*uRelief));
          float mFacing=smoothstep(-.38,.46,dot(mN.xz,normalize(sunNS.xz)));
          vec3 mHabitat=vec3(.22+.29*(1.0-mUp)+.18*(1.0-mFacing)+.20*vStCurvature.x+.23*mScan.g,
                             .13+.32*mUp+.20*mFacing+.18*vStCurvature.y+.20*(1.0-mScan.g),
                             .16+.43*mScan.g+.16*mFacing+.08*mScan.b);
          mGrass=stMeadowDye(mGrass,stMeadowCover(mHabitat));
          vec3 mRock=texture2D(tRockAlb,wp*1.15).rgb*uRockBaseGain;
          float mSlope=1.0-smoothstep(uRockSlope-0.16,uRockSlope+0.025,mN.y);
          float mirroredGrass=stGrassCover(mN.y,mSlope,0.0);
          vec3 mAlb=mix(mRock,stSat(mGrass,clamp(uGrassSat,0.2,2.0)),mirroredGrass);
          float mCloud=${useOpt3Cloud ? 'texture2D(tStFieldBake,clamp((wp+vec2(19.0,16.0))*vec2(0.02631579,0.03125),vec2(0.0005),vec2(0.9995))).a' : 'stCloudVisibility(wp)'};
          float mLit=smoothstep(0.02,0.88,clamp(dot(mN,sunNS),0.0,1.0))*mCloud;
          vec3 mCol=mAlb*(skyFillCol*(0.45+0.55*max(0.0,mN.y))+sunKeyCol*mLit);
          mCol=mCol/(1.0+mCol*0.22);
          float stAmt=clamp(uPbrStyle,0.0,1.25)*uPbrTerrainOn;
          vec3 col=mix(vec3(0.05,0.08,0.09),mCol,clamp(stAmt,0.0,1.0));
          col=forestHaze(col,vForestWorld);
          col=stArrivalColor(col,vForestWorld.xz,vStArrival);
          col=mix(col,vec3(.63,.73,.77),smoothstep(uSkirtAir.x,uSkirtAir.y,outDist)*uSkirt.w);
          vec2 sc=(gl_FragCoord.xy-uView.xy)/uView.zw-.5;
          col*=1.-uVig*smoothstep(.5,1.9,dot(sc,sc)*4.);
          col=mix(col,uLatticeGround,clamp(uLattice,0.,1.));
          vec2 past=max(max(-uvR,uvR-1.0),0.0)/uBounds.zw;
          float rim=max(past.x,past.y);
          if(rim>3.0 && uPbrTerrainOn>0.5){
            float weather=forestNoise(vForestWorld.xz*0.41)*0.90-0.45;
            float edge=smoothstep(3.65,10.1,rim+weather);
            vec3 ray=normalize(vForestWorld-cameraPosition);
            col=mix(col,stAlpineSky(ray,uPbrStyle,uCloudLayer,uArrival),edge);
          }
          gl_FragColor=vec4(col,1.0);
          #include <colorspace_fragment>
        }
      `;
      const mirrorMat = new THREE.ShaderMaterial({
        uniforms: mat.uniforms,
        vertexShader: mat.vertexShader,
        fragmentShader: mirrorFrag,
        defines: { ...(mat.defines || {}) },
        side: mat.side,
        toneMapped: false
      });
      mirrorMat.userData.handlesArrival = true;
      obj.userData.opt3MirrorMat = mirrorMat;
      /* OPT3 Mirror LOD index buffer: stride-4 lattice (~25k tris instead of 727k tris = 29x fewer triangles,
         zero sub-pixel quad overdraw inside the 682x383 rippled planar reflection!). Exact same vertex buffer! */
      const pos = obj.geometry?.attributes?.position;
      if (pos && pos.count > 1000) {
        const pa = pos.array, n = pos.count;
        let row = 1; while (row < n && pa[row * 3 + 2] === pa[2]) row++;
        let rows = 1; while ((rows + 1) * row <= n && pa[rows * row * 3] === pa[0] && pa[rows * row * 3 + 2] > pa[(rows - 1) * row * 3 + 2]) rows++;
        if (row > 16 && rows > 16) {
          const S = 4, xs = [], zs = [];
          for (let i = 0; i < row - 1; i += S) xs.push(i);
          if (xs[xs.length - 1] !== row - 1) xs.push(row - 1);
          for (let j = 0; j < rows - 1; j += S) zs.push(j);
          if (zs[zs.length - 1] !== rows - 1) zs.push(rows - 1);
          const idx = new Uint32Array((xs.length - 1) * (zs.length - 1) * 6);
          let k = 0;
          for (let j = 0; j < zs.length - 1; j++) {
            const r0 = zs[j] * row, r1 = zs[j + 1] * row;
            for (let i = 0; i < xs.length - 1; i++) {
              const a = r0 + xs[i], b = r0 + xs[i + 1], c = r1 + xs[i], d = r1 + xs[i + 1];
              idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
            }
          }
          obj.userData.opt3MirrorIdx = new THREE.BufferAttribute(idx, 1);
        }
      }
    }
    patched = true;
  });
  return patched;
}

/* ---------- Patch Optional W1 Water Surface Mesh (if user opens 俯視水面 N) ---------- */
function patchWaterSurfaceMaterial(atlas, shoreAlb, studioUniforms) {
  let patched = false;
  const seen = new Set();
  atlas.scene.traverse(obj => {
    if (!obj.isMesh || !obj.material || seen.has(obj.material)) return;
    seen.add(obj.material);
    const mat = obj.material;
    if (!mat.fragmentShader || !mat.fragmentShader.includes('vW1World') || !mat.fragmentShader.includes('vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;')) return;
    if (mat.fragmentShader.includes('tPbrRiverBed')) return;

    Object.assign(mat.uniforms, {
      tPbrRiverBed: { value: shoreAlb },
      uPbrStyle: studioUniforms.uPbrStyle,
      uPbrTerrainOn: studioUniforms.uPbrTerrainOn,
      uTributaries: studioUniforms.uTributaries,
      uCloudStrength: studioUniforms.uCloudStrength,
      uBankShadow: studioUniforms.uBankShadow,
      uMistColor: studioUniforms.uMistColor,
      uValleyMist: studioUniforms.uValleyMist,
      uMistHeight: studioUniforms.uMistHeight
    });

    const wDecls = `
      uniform sampler2D tPbrRiverBed;
      uniform float uPbrStyle, uPbrTerrainOn, uTributaries;
      float forestHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float forestNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(forestHash(i),forestHash(i+vec2(1.0,0.0)),f.x),mix(forestHash(i+vec2(0.0,1.0)),forestHash(i+vec2(1.0)),f.x),f.y);
      }
      float stFbm2(vec2 p) {
        return forestNoise(p)*0.67+forestNoise(mat2(0.80,-0.60,0.60,0.80)*p*2.04+vec2(7.3,4.1))*0.33;
      }
      ${HIGHLAND_GLSL}
      ${SHORE_ATLAS_GLSL}
      float stWLakeR(vec2 p) {
        vec2 q = (p - vec2(0.122, -0.056)) / vec2(1.66, 1.42);
        float r = length(q);
        float ang = atan(q.y, q.x);
        return r + 0.085 * sin(ang * 3.0 + 0.7) + 0.055 * cos(ang * 5.0 - 1.2) + 0.035 * sin(ang * 7.0 + 2.4);
      }
      vec3 stWCentralLake(vec2 p) {
        float lr = stWLakeR(p);
        return vec3(1.0 - smoothstep(0.86, 1.00, lr), 0.0, 1.0 - smoothstep(0.0, 1.02, lr));
      }
    `;
    const wMaskReplace = `
      vec3 stLBw = (uPbrTerrainOn > 0.001) ? stWCentralLake(wq) : vec3(0.0);
      // This optional plane is at the lake datum. Let the conforming terrain
      // water shade elevated branches and fade the plane back in at the mouth.
      float raised=smoothstep(0.006,0.056,wt.b)*smoothstep(0.75,0.99,wt.a)*uTributaries;
      float wm=wt.r*(1.0-raised*(1.0-stLBw.x));
      float shore=max(wt.g, stLBw.z * 0.94 * smoothstep(0.05, 0.35, stLBw.x));
      float lakeN=max(uTributaries>0.5 && wt.a>0.005 ? 0.0 : wt.b, smoothstep(0.05, 0.42, stLBw.x));
      float sh2=shore*shore, shoreN=clamp(sh2*4.,0.,1.);
      float body=smoothstep(.2,.7,wm), rim=smoothstep(.02,.3,wm)*(1.-body)*uW1B.z*(1.0 - smoothstep(0.10, 0.45, stLBw.x));
    `;
    const wBedReplace = `
      vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;
      if (uPbrTerrainOn > 0.001) {
        float wBedAmt = clamp(uPbrStyle, 0.0, 1.0) * uPbrTerrainOn;
        vec3 cobbleBed=stMaterialTile(tPbrRiverBed,stGravelUV(wq+sl*0.026),1.0).rgb;
        float shallW = 1.0 - smoothstep(0.02, 0.54, sh2);
        vec3 alpineBed = mix(vec3(0.07, 0.18, 0.26), cobbleBed * vec3(0.62, 0.92, 1.02), 0.84);
        bed = mix(bed, alpineBed, wBedAmt * (0.58 + 0.42 * shallW));
      }
    `;

    mat.fragmentShader = mat.fragmentShader
      .replace('void main(){', wDecls + '\nvoid main(){')
      .replace('*uRvSun*(1.-shade)', '*uRvSun*stCloudVisibility(wq)*(1.-shade)')
      .replace('bodyC*=1.+clamp(dot(-ws,normalize(uSun.xz))*1.6*uW1A.z,-.25,.3);', 'bodyC*=1.+clamp(dot(-ws,normalize(uSun.xz))*1.6*uW1A.z,-.25,.3)*stCloudVisibility(wq);')
      .replace('col=forestHaze(col,vW1World);', 'col=forestHaze(col,vW1World); col=stValleyAir(col,vW1World,cameraPosition);')
      .replace('vec3 wt=texture2D(tWater,uv).rgb;', 'vec4 wt=texture2D(tWater,uv);')
      .replace(/float wm=wt\.r, shore=wt\.g, lakeN=wt\.b, sh2=shore\*shore, shoreN=clamp\(sh2\*4\.,0\.,1\.\);\r?\n\s*float body=smoothstep\(\.2,\.7,wm\), rim=smoothstep\(\.02,\.3,wm\)\*\(1\.-body\)\*uW1B\.z;/, wMaskReplace)
      .replace('vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;', wBedReplace);
    mat.needsUpdate = true;
    patched = true;
  });
  return patched;
}

/* ---------- Build Batched Volumetric Alpine Sunlight Shafts (1 draw call) ---------- */
function buildSunbeamGroup(atlas, studioUniforms) {
  const specs = [
    { ox: 3.0, oz: -2.2, w: 6.4, h: 10.2, rotY: 0.00, intensity: 1.00, seed: 1.1 },
    { ox: -1.2, oz: -1.8, w: 5.8, h: 9.6, rotY: 0.28, intensity: 0.85, seed: 2.7 },
    { ox: 4.8, oz: 1.0, w: 6.0, h: 9.2, rotY: -0.24, intensity: 0.82, seed: 4.3 },
    { ox: 0.6, oz: 0.2, w: 7.0, h: 10.6, rotY: 0.52, intensity: 0.78, seed: 6.1 },
    { ox: -3.6, oz: 1.4, w: 5.2, h: 8.8, rotY: -0.45, intensity: 0.68, seed: 8.5 },
    { ox: 2.0, oz: -3.5, w: 6.2, h: 9.8, rotY: 0.85, intensity: 0.80, seed: 10.2 }
  ];

  const pos = [], uvs = [], nrm = [], rays = [], idx = [];
  let vBase = 0;

  for (const s of specs) {
    for (let k = 0; k < 2; k++) {
      const ang = s.rotY + k * (Math.PI * 0.5);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const hw = s.w * 0.5;
      const nx = -sa, nz = ca;
      const corners = [[-hw, 0, 0, 0], [hw, 0, 1, 0], [-hw, s.h, 0, 1], [hw, s.h, 1, 1]];
      for (const [lx, ly, u, v] of corners) {
        pos.push(lx * ca + s.ox, ly, lx * sa + s.oz);
        uvs.push(u, v);
        nrm.push(nx, 0, nz);
        rays.push(s.seed + k * 0.37, s.intensity, s.w, k);
      }
      idx.push(vBase, vBase + 1, vBase + 2, vBase + 1, vBase + 3, vBase + 2);
      vBase += 4;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aRay', new THREE.Float32BufferAttribute(rays, 4));
  geo.setIndex(idx);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: atlas.uniforms.uTime,
      uRayStrength: studioUniforms.uSunRays,
      uSunIntensity: studioUniforms.uSunIntensity,
      uLattice: atlas.uniforms.uLattice || { value: 0 }
    },
    vertexShader: SUNBEAM_VERT,
    fragmentShader: SUNBEAM_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Studio Alpine Sunlight Shafts';
  mesh.frustumCulled = false;
  mesh.renderOrder = 16;

  const pivot = new THREE.Group();
  pivot.name = 'Studio Sunbeam Pivot';
  pivot.position.set(0, 0.12, 0);
  pivot.add(mesh);

  const up = new THREE.Vector3(0, 1, 0);
  function alignToSun(sunVec) {
    pivot.quaternion.setFromUnitVectors(up, sunVec);
  }

  return { group: pivot, mesh, mat, alignToSun };
}

/* ---------- Create the Standalone CC0 2K PBR Terrain + Unified Water + Alpine Sunlight Layer ---------- */
export async function createStudioTerrainPbrLayer(renderer, atlas, initialConfig = {}) {
  const cfg = {
    ...DEFAULT_PBR_CONFIG,
    ...initialConfig,
    layers: { ...DEFAULT_PBR_CONFIG.layers, ...(initialConfig.layers || {}) }
  };
  const arrivalPacked = packArrivalField(atlas);
  /* RISE FALLS (team FT, 2026-11-23): the gorge's shape, only where the page asks for it (html[data-rise-falls]); see FALLS above. ?fallsLand=0 = the lake's land as before */
  FALLS = document.documentElement.hasAttribute('data-rise-falls') && new URLSearchParams(location.search).get('fallsLand') !== '0'
    ? await import('../falls/falls-shape.js?v=dir2').catch(error => { console.warn('Rise falls: the shape did not load, the lake stays', error); return null; }) : null;
  FALLS_SINK = !!FALLS && new URLSearchParams(location.search).get('fallsSink') === '1';   /* test switch (cost study): sink the land inside the rim instead of the discard */

  /* Hide ALL legacy 3D trees completely per brief (pure planar terrain & water pass!) */
  if (atlas.trees) {
    atlas.trees.visible = false;
    atlas.trees.children.forEach(m => { m.visible = false; });
  }

  const baseUrl = name => new URL('../' + name + '?v=' + (name.includes('-shore') ? SHORE_VER : PBR_VER), import.meta.url).href;
  const fusionUrl = name => new URL('./assets/' + name + '?v=261124-f5', import.meta.url).href;
  const texLoader = new THREE.TextureLoader();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  /* PERF (strike team PIPE, 2026-11-21; rise page only, ?perf=0 = as before). TextureLoader hands three an <img>: each tile was decoded AND
     uploaded on the main thread at its first draw, 145-182 ms per 2048 x 2048 tile, all twelve in one 1.3-1.5 s frame while the opening is
     already live. Here the same file is decoded by createImageBitmap (off the main thread; no premultiply, no colour conversion: the bytes
     three asked the <img> for), and its first upload is asked for here, one picture per frame, so flow2-tex-engine.js sends it in strips
     (userData.flow2Strips). Same texture settings as below. Any failure falls back to the loader.
     Tier step (medium / low start only): tiles wider than 1024 are halved while decoding (a quarter of their memory). */
  const PERF_ON = new URLSearchParams(location.search).get('perf') !== '0' && document.documentElement.hasAttribute('data-rise-studio-pbr') && typeof createImageBitmap === 'function';
  const perfHalf = PERF_ON && new URLSearchParams(location.search).get('perfTiles') !== 'full' && (q => !!q && (q.start === 'medium' || q.start === 'low'))(window.__FLOW2_QUALITY__);
  const perfState = window.__RISE_PERF_TILES__ = { on: PERF_ON, half: perfHalf, decoded: 0, fallback: 0, initMs: [] };
  const perfFrame = () => new Promise(done => { let over = false; const go = () => { if (!over) { over = true; done(); } }; requestAnimationFrame(go); setTimeout(go, 120); });
  let perfChain = Promise.resolve();
  const loadTexDecoded = async (name, { srgb = false, mips = true, repeat = true, url: urlT = '', tiered = false } = {}) => {
    const response = await fetch(urlT || baseUrl(name));
    if (!response.ok) throw new Error(name + ' ' + response.status);
    const options = { premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
    let bitmap = await createImageBitmap(await response.blob(), options);
    if (perfHalf && !tiered && bitmap.width > 1024) {
      const half = await createImageBitmap(bitmap, { ...options, resizeWidth: bitmap.width >> 1, resizeHeight: bitmap.height >> 1, resizeQuality: 'high' });
      bitmap.close(); bitmap = half;
    }
    const tex = new THREE.Texture(bitmap);
    tex.flipY = false;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.generateMipmaps = mips;
    tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    if (mips) tex.anisotropy = maxAniso;
    tex.userData.flow2Strips = true;
    tex.needsUpdate = true;
    perfState.decoded++;
    perfChain = perfChain.then(perfFrame).then(() => { const t0 = performance.now(); try { renderer.initTexture?.(tex); } catch (error) { /* uploaded at its first draw instead */ } perfState.initMs.push(+(performance.now() - t0).toFixed(1)); });
    await perfChain;
    return tex;
  };
  const loadTexPerf = (name, options) => PERF_ON
    ? loadTexDecoded(name, options).catch(error => { perfState.fallback++; perfState.error = String(error?.message || error); return loadTexImage(name, options); })
    : loadTexImage(name, options);
  /* KTX2 (PIPE, 2026-11-21; client: 「KTX2 貼圖壓縮…同意你做」; rise page only; ?perf=0 or ?ktx2=0 = no). The same twelve tiles as GPU-compressed
     pictures (studio/ktx2/*.ktx2, made by tools/ktx2/scripts: UASTC for the normal / data tiles, ETC1S for the colour tiles, mip-maps inside).
     They stay compressed on the GPU: a quarter of the memory at the full 2048 size, so the lower tiers get the full-size tiles back instead
     of the halved ones, and nothing is decoded on the main thread (three's KTX2Loader transcodes in its worker).
     WHO: a medium or low start and phones. The HIGH tier keeps today's pictures exactly (?ktx2=1 forces KTX2 there, for comparison only).
     A GPU without ASTC / BC7 / ETC2, or any failure for a tile: that tile loads as above (webp), silently. */
  const pageQuery = new URLSearchParams(location.search);
  const KTX2_VER = 'ktx2-20261121-1';
  const ktx2Phone = (() => { try { return matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 900; } catch (error) { return false; } })();
  /* TEXTURE TIERS (Team T, 2026-11-21; client: 「在設計與特效不變狀況下做出最優的優化」; rise page only; ?optT=0 or ?perf=0 = the code above and below
     exactly as the 11-21 07:45 build). Tier sets made by scripts/perf-bake/rise-tiers.cjs (studio/tiers/, manifest.json): <name>-<w>.webp and
     <name>-<w>-u.ktx2 (UASTC) / -e.ktx2 (ETC1S, colour tiles) with w = the tile's width x the tier's scale (window.__FLOW2_TEX_TIER__ when ?texTier=
     medium|low is given, else .5 for a medium / low start and for phones, 1 = today's files). HIGH takes the half-size WebP too (T_HIGH_HALF; ?perfTiles=full = today's pbr-*.webp byte for byte).
     ?texFmt=ktx2 forces the KTX2 set at any tier (at high: the full-size tiles, comparison only; ktx2u = UASTC for the colour tiles too, ktx2e = ETC1S),
     ?texFmt=webp the WebP set; unset = KTX2 where the GPU has BC7 / ASTC / ETC2 (medium, low, phones), else WebP. Any failure of a tier file falls back
     to the older path (the 07:45 KTX2 full set, then the full WebP). State: __RISE_PERF_TILES__.t */
  const optT = PERF_ON && pageQuery.get('optT') !== '0';
  const texFmt = pageQuery.get('texFmt');
  const tierT = (() => { const tt = window.__FLOW2_TEX_TIER__; if (tt && (tt.tier === 'medium' || tt.tier === 'low')) return tt.tier; const q = window.__FLOW2_QUALITY__; return q && (q.start === 'medium' || q.start === 'low') ? q.start : (ktx2Phone ? 'phone' : 'high'); })();
  const T_HIGH_HALF = pageQuery.has('tHigh') ? pageQuery.get('tHigh') === 'half' : true;   /* ?tHigh=half|full overrides (tests); ?perfTiles=full = today's full-size tiles */
  /* OPT2 D4 (team D, 2026-11-25; html[data-rise-opt2] only, ?opt2D=0 or ?opt2DSmall=0 = off): a LOW start and phones take the quarter-size tiles (measured identical to half size at the
     view on the low tier); phones also the terrain-fusion maps and the lake ripple map at 512 (opt2d/, made by scripts/perf-bake/opt2-assets.cjs). Desktop high / medium: unchanged. */
  const OPT2D_SMALL = document.documentElement.hasAttribute('data-rise-opt2') && pageQuery.get('opt2D') !== '0' && pageQuery.get('opt2DSmall') !== '0' && (tierT === 'low' || tierT === 'phone');
  const OPT2D_PHONE = OPT2D_SMALL && tierT === 'phone';   /* the fusion maps + lake ripple map at 512: phones only (desktop low keeps 1024) */
  /* half-size tiles (WebP q 98) at the top tier too: the half is the picture one mip level down, which the screen reaches on 0.05 % of the pixels at the settled view and the lake dive (OPT-T.md §4: mean 0.31 / 0.61 of 255 at the settled view / the dive's worst moment); one switch to undo */
  const scaleT = !optT || pageQuery.get('perfTiles') === 'full' ? 1 : tierT === 'high' ? (T_HIGH_HALF ? .5 : 1) : (OPT2D_SMALL || (window.__FLOW2_TEX_TIER__ && window.__FLOW2_TEX_TIER__.tier === 'low') ? .25 : .5);
  const ktx2Want = PERF_ON && pageQuery.get('ktx2') !== '0' && !(optT && texFmt === 'webp')
    && (pageQuery.get('ktx2') === '1' || (optT && /^ktx2[ue]?$/.test(texFmt || '')) || ktx2Phone || (q => !!q && (q.start === 'medium' || q.start === 'low'))(window.__FLOW2_QUALITY__));
  const ktx2State = perfState.ktx2 = { want: ktx2Want, phone: ktx2Phone, loaded: 0, fallback: 0, formats: {}, bytesGPU: 0 };
  const ktx2Loader = !ktx2Want ? null : import('three/addons/loaders/KTX2Loader.js').then(module => {
    const loader = new module.KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/').detectSupport(renderer);
    const c = loader.workerConfig || {};
    if (!(c.astcSupported || c.bptcSupported || c.etc2Supported)) throw new Error('no ASTC / BC7 / ETC2 on this GPU');
    return loader;
  });
  ktx2Loader?.catch(error => { ktx2State.error = String(error?.message || error); });
  const loadTexKtx2 = async (name, { srgb = false, mips = true, repeat = true, url: urlT = '' } = {}) => {
    const loader = await ktx2Loader;
    const tex = await loader.loadAsync(urlT || new URL('../ktx2/' + name.replace(/.webp$/, '.ktx2') + '?v=' + KTX2_VER, import.meta.url).href);
    if (!tex || !tex.isCompressedTexture || !(tex.mipmaps && tex.mipmaps.length > 1)) { tex?.dispose?.(); throw new Error(name + ': not a compressed picture with mip-maps'); }
    tex.flipY = false;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    if (mips) tex.anisotropy = maxAniso;
    tex.needsUpdate = true;
    ktx2State.loaded++; ktx2State.formats[tex.format] = (ktx2State.formats[tex.format] || 0) + 1;
    for (const level of tex.mipmaps) ktx2State.bytesGPU += level.data ? level.data.byteLength : 0;
    perfChain = perfChain.then(perfFrame).then(() => { const t0 = performance.now(); try { renderer.initTexture?.(tex); } catch (error) { /* uploaded at its first draw instead */ } perfState.initMs.push(+(performance.now() - t0).toFixed(1)); });
    await perfChain;
    return tex;
  };
  const loadTexOlder = (name, options) => ktx2Want
    ? loadTexKtx2(name, options).catch(error => { ktx2State.fallback++; ktx2State.lastError = String(error?.message || error); return loadTexPerf(name, options); })
    : loadTexPerf(name, options);
  const T_VER = 'tiers-20261121-1', T_COLOUR_MODE = '-u', T_FULL_W = { 'pbr-sward-relief': 1536, 'pbr-basalt-shore': 1536, 'pbr-rock-shore-detail': 1536, 'pbr-water-nrm': 1024 };
  const tState = perfState.t = { on: optT, tier: tierT, scale: scaleT, fmt: texFmt || 'auto', ktx2: 0, webp: 0, older: 0, files: [] };
  /* CMP (2026-11-22, client: 「第二區塊後 … 貼圖可以壓縮一點」; rise page only through PERF_ON; ?cmp=0 = the line above exactly): the half-size WebP tiles
     (the top tier, and the WebP fallback of medium / phones) come from <name>-<w>-c.webp = the same lossless half-size picture re-encoded at WebP q 85
     (alpha still lossless: it carries data) instead of q 98: 12.72 → 9.80 MB. Made by scripts/perf-bake/rise-cmp-tiers.cjs; a failed -c file loads the q 98 file. */
  const CMP_T = PERF_ON && pageQuery.get('cmp') !== '0' && scaleT === .5, CMP_VER = 'cmp-20261122-1';
  tState.cmp = CMP_T;
  const loadTex = (name, options) => {
    if (!optT || (scaleT === 1 && !/^ktx2[ue]?$/.test(texFmt || ''))) return loadTexOlder(name, options);
    const base = name.replace(/\.webp$/, ''), w = Math.max(256, Math.round((T_FULL_W[base] || 2048) * scaleT));
    const url = (suffix, ext) => new URL('../tiers/' + base + '-' + w + suffix + '.' + ext + '?v=' + T_VER, import.meta.url).href;
    const webpAt = u => loadTexPerf(name, { ...options, url: u, tiered: scaleT < 1 }).then(tx => { tState.webp++; tState.files.push(u.replace(/^.*\/studio\//, '').replace(/\?.*/, '')); return tx; });
    const webp = () => { const u = scaleT === 1 ? baseUrl(name) : url('', 'webp'); return CMP_T ? webpAt(new URL('../tiers/' + base + '-' + w + '-c.webp?v=' + CMP_VER, import.meta.url).href).catch(() => webpAt(u)) : webpAt(u); };
    const mode = options && options.srgb ? (texFmt === 'ktx2u' ? '-u' : texFmt === 'ktx2e' ? '-e' : T_COLOUR_MODE) : '-u';
    const viaKtx2 = ktx2Want ? loadTexKtx2(name, { ...options, url: url(mode, 'ktx2') }).then(tx => { tState.ktx2++; tState.files.push(base + '-' + w + mode + '.ktx2'); return tx; }) : Promise.reject(new Error('no ktx2'));
    return viaKtx2.catch(error => { if (ktx2Want) { ktx2State.fallback++; ktx2State.lastError = String(error?.message || error); } return webp(); }).catch(error => { tState.older++; tState.lastError = String(error?.message || error); return loadTexOlder(name, options); });
  };
  const loadTexImage = (name, { srgb = false, mips = true, repeat = true, url: urlT = '' } = {}) => new Promise((resolve, reject) => {
    texLoader.load(urlT || baseUrl(name), tex => {
      tex.flipY = false;
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.generateMipmaps = mips;
      tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      if (mips) tex.anisotropy = maxAniso;
      resolve(tex);
    }, undefined, reject);
  });
  const loadFusionTex = (name, options) => loadTexPerf(name, { ...options, url: fusionUrl(name), tiered: false });
  /* COMPRESSED (2026-11-24, client 「壓小並量效能」): the fusion maps as KTX2 at 1024 (albedo ETC1S, normals UASTC), the 1536 WebP stays the
     fallback (?fusionKtx=0); on every tier (the page's KTX2 loader on phones / medium / low, one of its own on the desktop top tier).
     The canopy's colour is only fetched while the forest is on (canopyCover > 0, also later from the panel); until then a 1-pixel stand-in. */
  const FUSION_KTX = pageQuery.get('fusionKtx') !== '0';
  const fusionKtxLoader = !FUSION_KTX ? null : (ktx2Loader || import('three/addons/loaders/KTX2Loader.js').then(module => {
    const loader = new module.KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/').detectSupport(renderer);
    const c = loader.workerConfig || {};
    if (!(c.astcSupported || c.bptcSupported || c.etc2Supported || c.dxtSupported)) throw new Error('no ASTC / BC / ETC2 on this GPU');
    return loader;
  }));
  const fusionState = perfState.fusion = { ktx: 0, webp: 0, error: '' };
  const loadFusionKtx = async (url, { srgb = false, repeat = true } = {}) => {
    const loader = await fusionKtxLoader;
    const tex = await loader.loadAsync(url);
    if (!tex || !tex.isCompressedTexture || !(tex.mipmaps && tex.mipmaps.length > 1)) { tex?.dispose?.(); throw new Error(url + ': not a compressed picture with mip-maps'); }
    tex.flipY = false; tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; tex.anisotropy = maxAniso; tex.needsUpdate = true;
    return tex;
  };
  const loadFusion = (name, ktx, options) => (fusionKtxLoader
    ? loadFusionKtx(OPT2D_PHONE ? new URL('./opt2d/' + ktx.replace(/-1024\.ktx2$/, '-512.ktx2') + '?v=opt2d4', import.meta.url).href : new URL('./ktx2/' + ktx + '?v=261124-k1', import.meta.url).href, options).then(t => { fusionState.ktx++; return t; })
    : Promise.reject(new Error('webp'))).catch(error => { if (fusionKtxLoader) fusionState.error = String(error?.message || error); fusionState.webp++; return loadFusionTex(name, options); });
  const blankCanopy = new THREE.DataTexture(new Uint8Array([46, 62, 38, 255]), 1, 1); blankCanopy.colorSpace = THREE.SRGBColorSpace; blankCanopy.needsUpdate = true; blankCanopy.userData.blank = true;
  const canopyColour = () => loadFusion('mv-canopy-albedo.webp', 'mv-canopy-albedo-1024.ktx2', { srgb: true, mips: true, repeat: true });

  // 9 core CC0 PBR/shore/water samplers + 4 seamless 1536px 山谷/magic_valley fusion samplers (+ 3 native = 16/16 WebGL units!)
  const [grassAlb, grassWildAlb, mossAlb, grassNrm, rockAlb, rockBasaltAlb, rockNrm, rockNrm2, waterNrm, sgErosionAlb, sgErosionNrm, mvCanopyAlb, mvCanopyNrm] = await Promise.all([
    loadTex('pbr-sward-relief.webp', { mips: true, repeat: true }),
    loadTex('pbr-grass-wild.webp',   { srgb: true,  mips: true, repeat: true }),
    loadTex('pbr-moss-albedo.webp',  { srgb: true,  mips: true, repeat: true }),
    loadTex('pbr-grass-nrm.webp',    { srgb: false, mips: true, repeat: true }),
    loadTex('pbr-rock-albedo.webp',  { srgb: true,  mips: true, repeat: true }),
    loadTex('pbr-basalt-shore.webp', { srgb: true,  mips: true, repeat: false }),
    loadTex('pbr-rock-nrm.webp',     { srgb: false, mips: true, repeat: true }),
    loadTex('pbr-rock-shore-detail.webp', { srgb: false, mips: true, repeat: false }),
    (OPT2D_PHONE ? loadTexPerf('alpine-water-nrm.webp', { srgb: false, mips: true, repeat: true, url: new URL('./opt2d/alpine-water-nrm-512.webp?v=opt2d4', import.meta.url).href, tiered: true }).catch(() => loadFusionTex('alpine-water-nrm.webp', { srgb: false, mips: true, repeat: true }))
      : loadFusionTex('alpine-water-nrm.webp', { srgb: false, mips: true, repeat: true })),
    loadFusion('sg-erosion-albedo.webp', 'sg-erosion-albedo-1024.ktx2', { srgb: true,  mips: true, repeat: true }),
    loadFusion('sg-erosion-nrm-ao.webp', 'sg-erosion-nrm-ao-1024.ktx2', { srgb: false, mips: true, repeat: true }),
    (Number(cfg.canopyCover) > 0 ? canopyColour() : Promise.resolve(blankCanopy)),
    loadFusion('mv-canopy-nrm-meadow.webp', 'mv-canopy-nrm-meadow-1024.ktx2', { srgb: false, mips: true, repeat: true })
  ]);
  const fusionTex = { canopy: mvCanopyAlb, loading: false };

  atlas.scene.background = new THREE.Color(0x142438);
  const origSun = atlas.uniforms.uSun.value.clone();
  const liveSun = sunVecFromAngles(cfg.sunAzimuth, cfg.sunElevation);
  atlas.uniforms.uSun.value.copy(liveSun);

  const studioUniforms = {
    uPbrStyle: { value: cfg.style },
    uPbrTerrainOn: { value: cfg.layers.terrainStyle ? 1.0 : 0.0 },
    uGrassPbr: { value: cfg.grassPbr },
    uGrassSat: { value: cfg.grassSat },
    uMeadowBase: { value: new THREE.Color(cfg.grassColor) },
    uMeadowTips: { value: new THREE.Color(cfg.grassTipColor) },
    uMeadowMoss: { value: new THREE.Color(cfg.grassMossColor) },
    uMeadowDry: { value: new THREE.Color(cfg.grassDryColor) },
    uMeadowLayerCover: { value: new THREE.Vector3() },
    uRockBaseGain: { value: new THREE.Color(1,1,1) },
    uRockLayerGain: { value: new THREE.Color(1,1,1) },
    uGrassCover: { value: cfg.grassCoverage/100 },
    uRockSlope: { value: cfg.rockSlope },
    uShoreWet: { value: cfg.shoreWet },
    uSunIntensity: { value: cfg.sunIntensity },
    uSunShadow: { value: cfg.sunShadow },
    uSunRays: { value: cfg.sunRays },
    uStudioMist: { value: cfg.mist },
    uBiomeContrast: { value: cfg.biomeContrast },
    uCavityDepth: { value: cfg.cavityDepth },
    uStrataStrength: { value: cfg.strataStrength },
    uCloudLayer: { value: cfg.layers.clouds ? 1 : 0 },
    uCloudStrength: { value: cfg.cloudStrength },
    uBankShadow: { value: new THREE.Vector4(0, 1, 0, 0) },
    uAirWhite: { value: 0 },
    uMistColor: { value: new THREE.Color(cfg.mistColor || '#a8b8c7') },
    uValleyMist: { value: cfg.valleyMist },
    uMistHeight: { value: cfg.mistHeight },
    uArrival: { value: 1 },
    uArrivalMap: { value: arrivalPacked ? 1 : 0 },
    uTributaries: { value: atlas.studioHydrology ? 1 : 0 },
    uTributaryTexel: { value: atlas.studioHydrology?.texel || new THREE.Vector2(1/1494,1/836) },
    uContours: { value: cfg.contourOpacity },
    uContourInterval: { value: cfg.contourInterval },
    uEntrySurvey: { value: 0 },
    uWaterDeep: { value: new THREE.Color(cfg.waterDeep) },
    uWaterShallow: { value: new THREE.Color(cfg.waterShallow) },
    uWaterSpeed: { value: cfg.waterSpeed },
    uWaterWave: { value: cfg.waterWave },
    uWaterClear: { value: cfg.waterClear },
    uFallsSize: { value: FALLS?.DEFAULT_OPENING ? new THREE.Vector2(FALLS.DEFAULT_OPENING.scale * FALLS.DEFAULT_OPENING.width, FALLS.DEFAULT_OPENING.scale * FALLS.DEFAULT_OPENING.length) : new THREE.Vector2(1, 1) },   /* director: the default opening */
    uFallsHeadland: { value: 1 },
    uFallsDrop: { value: FALLS?.DEFAULT_OPENING ? FALLS.DEFAULT_OPENING.depth : 0 },   /* redo-s5: the opening's drop (set by falls/falls-gorge.js on build and on every slider rebuild) */
    uWhitewater: { value: cfg.whitewater },
    uWaterGlow: { value: cfg.waterGlow },
    uWaterOn: { value: cfg.layers.water ? 1.0 : 0.0 },
    uCurtainGlow: { value: 0.78 },
    uCurtainCol: { value: new THREE.Color('#88ccf8') },
    uCurtainContact: { value: new THREE.Color('#d9f2ff') },
    uCurtainLogo: { value: new THREE.Vector4(1.0, 1.40, 0.28, 1.0) },
    uDetailFusion: { value: new THREE.Vector4(cfg.detailFusion, cfg.erosionRelief, cfg.erosionAlbedo, cfg.erosionAO) },
    uCanopyParams: { value: new THREE.Vector4(cfg.canopyCover, cfg.canopyRelief, cfg.meadowGrain, 0) },
    uColorParams:  { value: new THREE.Vector4(cfg.colorVariety, cfg.alpineAccents, 0, 0) },
    uSatDrape:     { value: new THREE.Vector4(.8, 1, 1, 0) },
    uCanyonWater:  { value: new THREE.Vector4(pageQuery.get('canyonWater') === '0' ? 0 : (+(pageQuery.get('canyonWater') || .95) || .95), 1.0, +(pageQuery.get('waterSparkle') || .55) || .55, 0) }   /* 2026-11-24 client 「水的顏色不一樣」: the lake takes the same water as the rivers (was .55) */,
    uRiverDetail:  { value: new THREE.Vector4(cfg.waveScale, cfg.riverDetail, 0, 0) }
  };

  /* OPT2 Zero-Loss GPU Bakes: pack grassWildAlb + mossAlb into 1 guttered atlas -> free sampler #16 for static 1024x1024 shadow/hydro-skip FBO,
     and bake static terrain vertices (p.y, vStOutN, vStCurvature, vStArrival) on GPU into vertex attributes. ?opt2=0 or ?opt2Bake=0 disables. */
  const useOpt2Bake = document.documentElement.hasAttribute('data-rise-opt2') && pageQuery.get('opt2Bake') !== '0' && !FALLS;
  const useOpt3CloudBake = useOpt2Bake && document.documentElement.hasAttribute('data-rise-opt3') && pageQuery.get('opt3') !== '0';
  let grassAtlasRT = null, fieldBaker = null, vertexBaker = null, opt2Bake = null;
  if (useOpt2Bake) {
    try {
      grassAtlasRT = createOpt2GrassBiomeAtlas(renderer, grassWildAlb, mossAlb, maxAniso);
      grassWildAlb.dispose();
      mossAlb.dispose();
      fieldBaker = createOpt2FieldBaker(renderer, atlas, studioUniforms, useOpt3CloudBake);
      vertexBaker = createOpt2VertexBaker(renderer, atlas, studioUniforms);
      opt2Bake = { grassAtlasTex: grassAtlasRT.texture, fieldTex: fieldBaker.texture, opt3Cloud: useOpt3CloudBake, vertexBaked: !!vertexBaker, grid: null };
      perfState.opt2Bake = { field: true, opt3Cloud: useOpt3CloudBake, vertex: !!vertexBaker };
    } catch (error) {
      perfState.opt2Bake = { error: String(error?.message || error) };
      grassAtlasRT?.dispose(); grassAtlasRT = null;
      fieldBaker?.dispose(); fieldBaker = null;
      vertexBaker?.dispose(); vertexBaker = null;
      opt2Bake = null;
    }
  }

  const terrainPatched = patchTerrainAndWater(atlas, {
    grassAlb, grassWildAlb, mossAlb, grassNrm,
    rockAlb, rockBasaltAlb, rockNrm, rockNrm2, waterNrm,
    sgErosionAlb, sgErosionNrm, mvCanopyAlb, mvCanopyNrm
  }, studioUniforms, opt2Bake);
  const waterPatched = patchWaterSurfaceMaterial(atlas, rockBasaltAlb, studioUniforms);
  /* Refine headwater bank stones to natural river-margin proportions (no oversized mid-channel brown lumps!) */
  const refinedOuterStones = REFINE_HEADWATERS ? headwaterStones(atlas.uniforms.uBounds.value).map(st => ({
    ...st,
    shape: [st.shape[0] * 0.54, st.shape[1] * 0.50, st.shape[2] * 0.56, st.shape[3]]
  })) : [];
  const cobbles = createShoreCobbles(atlas, studioUniforms, rockBasaltAlb, refinedOuterStones, FALLS);
  atlas.scene.add(cobbles);

  /* Alpine Daylight Sky Horizon Dome (OPT3: render after opaque terrain at far depth z=w for 99% Early-Z rejection, bit-exact!) */
  const useOpt3 = document.documentElement.hasAttribute('data-rise-opt3') && pageQuery.get('opt3') !== '0';
  const skyDomeGeo = new THREE.SphereGeometry(185, 32, 20);
  const skyDomeMat = new THREE.ShaderMaterial({
    uniforms: {
      uSun: atlas.uniforms.uSun,
      uTime: atlas.uniforms.uTime,
      uSunIntensity: studioUniforms.uSunIntensity,
      uLattice: atlas.uniforms.uLattice || { value: 0 },
      uStyle: studioUniforms.uPbrStyle,
      uCloudLayer: studioUniforms.uCloudLayer,
      uArrival: studioUniforms.uArrival
    },
    vertexShader: useOpt3 ? SKY_DOME_VERT_OPT3 : SKY_DOME_VERT,
    fragmentShader: SKY_DOME_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    depthFunc: useOpt3 ? THREE.LessEqualDepth : THREE.LessDepth,
    toneMapped: false
  });
  const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
  skyDomeMat.userData.handlesArrival = true;
  skyDome.name = 'Studio Alpine Sky Dome';
  skyDome.frustumCulled = false;
  skyDome.renderOrder = useOpt3 ? 2 : -10;
  atlas.scene.add(skyDome);

  /* Volumetric Alpine Sunlight Shafts */
  const sunbeams = buildSunbeamGroup(atlas, studioUniforms);
  sunbeams.alignToSun(liveSun);
  atlas.scene.add(sunbeams.group);

  const mistGroup = createStudioClouds(atlas,studioUniforms);
  atlas.scene.add(mistGroup);

  const origTune = {
    relief: atlas.tune.relief, land: atlas.tune.land, rvDeep: atlas.tune.rvDeep, rvShallow: atlas.tune.rvShallow,
    rvSky: atlas.tune.rvSky, rvClear: atlas.tune.rvClear
  };

  let linkedCurtain = null;
  function syncCurtain() {
    if (!linkedCurtain) return;
    const cc = linkedCurtain.config;
    const on = cc.enabled ? 1.0 : 0.0;
    studioUniforms.uCurtainGlow.value = on * Math.max(0, +cc.brightness || 0);
    studioUniforms.uCurtainCol.value.set(cc.color || '#88ccf8');
    studioUniforms.uCurtainContact.value.set(cc.contactColor || '#d9f2ff');
    studioUniforms.uCurtainLogo.value.set(
      cc.showLogo ? 1.0 : 0.0,
      Math.max(0.2, +cc.logoScale || 1.40),
      Math.max(0.0, +cc.speed || 0.28),
      Math.max(0.0, Math.min(1.0, +cc.progress))
    );
  }
  function bindCurtain(curtainApi) {
    linkedCurtain = curtainApi || null;
    syncCurtain();
  }

  // Each default swatch gives unity gain, preserving the scanned mineral colours.
  function inverseSwatch(hex) {
    const c=new THREE.Color(hex);
    return c.setRGB(1/c.r,1/c.g,1/c.b);
  }
  const baseReference=inverseSwatch(DEFAULT_PBR_CONFIG.rockColor);
  const layerReference=inverseSwatch(DEFAULT_PBR_CONFIG.rockLayerColor);
  function apply() {
    const s = Math.max(0, Math.min(1.25, cfg.style));
    const lerpHex = (aHex, bHex, t) => '#' + new THREE.Color(aHex).lerp(new THREE.Color(bHex), Math.max(0, Math.min(1, t))).getHexString();

    sunVecFromAngles(cfg.sunAzimuth, cfg.sunElevation, liveSun);
    atlas.uniforms.uSun.value.copy(origSun).lerp(liveSun, Math.min(1, s)).normalize();
    sunbeams.alignToSun(atlas.uniforms.uSun.value);

    studioUniforms.uPbrStyle.value = s;
    studioUniforms.uPbrTerrainOn.value = cfg.layers.terrainStyle ? 1.0 : 0.0;
    studioUniforms.uGrassPbr.value = Math.max(0, Math.min(1.6, +cfg.grassPbr || 0));
    studioUniforms.uGrassSat.value = Math.max(0.2, Math.min(2.0, +cfg.grassSat || 1.0));
    studioUniforms.uMeadowBase.value.set(cfg.grassColor);
    studioUniforms.uMeadowTips.value.set(cfg.grassTipColor);
    studioUniforms.uMeadowMoss.value.set(cfg.grassMossColor);
    studioUniforms.uMeadowDry.value.set(cfg.grassDryColor);
    studioUniforms.uMeadowLayerCover.value.set(cfg.grassMossCoverage,cfg.grassDryCoverage,cfg.grassTipCoverage)
      .multiplyScalar(.01).clampScalar(0,1);
    studioUniforms.uRockBaseGain.value.set(cfg.rockColor).multiply(baseReference);
    studioUniforms.uRockLayerGain.value.set(cfg.rockLayerColor).multiply(layerReference);
    studioUniforms.uGrassCover.value = THREE.MathUtils.clamp(Number(cfg.grassCoverage ?? DEFAULT_PBR_CONFIG.grassCoverage)/100,0,1);
    studioUniforms.uRockSlope.value = Math.max(0.45, Math.min(0.98, +cfg.rockSlope || 0.86));
    studioUniforms.uShoreWet.value = Math.max(0.0, Math.min(1.8, +cfg.shoreWet || 0.0));
    studioUniforms.uSunIntensity.value = Math.max(0.2, Math.min(2.2, +cfg.sunIntensity || 1.24));
    studioUniforms.uSunShadow.value = Math.max(0.0, Math.min(1.2, +cfg.sunShadow || 0.0));
    studioUniforms.uSunRays.value = (cfg.layers.sunbeams && cfg.layers.terrainStyle) ? Math.max(0, +cfg.sunRays || 0) : 0.0;
    studioUniforms.uStudioMist.value = cfg.layers.atmosphere ? Math.max(0, +cfg.mist || 0) : 0.0;
    studioUniforms.uBiomeContrast.value = THREE.MathUtils.clamp(+cfg.biomeContrast || 0, 0, 1.8);
    studioUniforms.uCavityDepth.value = THREE.MathUtils.clamp(+cfg.cavityDepth || 0, 0, 1);
    studioUniforms.uStrataStrength.value = THREE.MathUtils.clamp(+cfg.strataStrength || 0, 0, 1.4);
    studioUniforms.uCloudLayer.value = cfg.layers.clouds && cfg.layers.terrainStyle ? 1 : 0;
    studioUniforms.uCloudStrength.value = cfg.layers.terrainStyle ? THREE.MathUtils.clamp(+cfg.cloudStrength || 0, 0, 0.6) : 0;
    { const L = atlas.uniforms.uSun.value; studioUniforms.uBankShadow.value.set(L.x, L.y, L.z, cfg.layers.clouds && cfg.layers.terrainStyle ? THREE.MathUtils.clamp(+cfg.cloudShadow || 0, 0, 1) : 0); }
    studioUniforms.uMistColor.value.set(cfg.mistColor || '#a8b8c7');
    studioUniforms.uAirWhite.value = THREE.MathUtils.clamp(+cfg.airWhite || 0, 0, 1);
    studioUniforms.uValleyMist.value = cfg.layers.atmosphere ? THREE.MathUtils.clamp(+cfg.valleyMist || 0, 0, 1.2) : 0;
    studioUniforms.uMistHeight.value = THREE.MathUtils.clamp(+cfg.mistHeight || 0.1, 0.1, 1.8);
    studioUniforms.uTributaries.value = atlas.studioHydrology && cfg.layers.tributaries && cfg.layers.terrainStyle ? 1 : 0;
    atlas.studioHydrology?.setEnabled(studioUniforms.uTributaries.value > 0.5);
    studioUniforms.uContours.value = cfg.layers.contours ? THREE.MathUtils.clamp(+cfg.contourOpacity || 0,0,0.8) : 0;
    studioUniforms.uContourInterval.value = THREE.MathUtils.clamp(+cfg.contourInterval || 0.105,0.04,0.22);
    studioUniforms.uWaterDeep.value.set(cfg.waterDeep || '#071c33');
    studioUniforms.uWaterShallow.value.set(cfg.waterShallow || '#217582');
    studioUniforms.uWaterSpeed.value = Math.max(0, +cfg.waterSpeed || 0);
    studioUniforms.uWaterWave.value = Math.max(0.1, +cfg.waterWave || 1.0);
    studioUniforms.uWaterClear.value = THREE.MathUtils.clamp(+cfg.waterClear || 0, 0, 1.3);
    studioUniforms.uWhitewater.value = THREE.MathUtils.clamp(+cfg.whitewater || 0, 0, 1.5);
    studioUniforms.uWaterGlow.value = Math.max(0, +cfg.waterGlow || 0);
    studioUniforms.uWaterOn.value = cfg.layers.water ? 1.0 : 0.0;
    const numOr = (v, d) => (v !== undefined && v !== null && v !== '' && Number.isFinite(+v)) ? +v : d;
    studioUniforms.uDetailFusion.value.set(
      THREE.MathUtils.clamp(numOr(cfg.detailFusion, 1.0), 0, 1.5),
      THREE.MathUtils.clamp(numOr(cfg.erosionRelief, 1.12), 0, 2.0),
      THREE.MathUtils.clamp(numOr(cfg.erosionAlbedo, 0.78), 0, 1.5),
      THREE.MathUtils.clamp(numOr(cfg.erosionAO, 0.88), 0, 1.6)
    );
    if (numOr(cfg.canopyCover, 0) > 0 && fusionTex.canopy?.userData?.blank && !fusionTex.loading) {   /* the forest turned on: fetch its colour now */
      fusionTex.loading = true;
      canopyColour().then(t => { fusionTex.canopy = t; atlas.scene.traverse(o => { const u = o.material?.uniforms?.tMvCanopyAlb; if (u) u.value = t; }); }).catch(() => {});
    }
    studioUniforms.uCanopyParams.value.set(
      THREE.MathUtils.clamp(numOr(cfg.canopyCover, 0.74), 0, 1.5),
      THREE.MathUtils.clamp(numOr(cfg.canopyRelief, 1.08), 0, 2.0),
      THREE.MathUtils.clamp(numOr(cfg.meadowGrain, 0.68), 0, 1.5),
      0
    );
    studioUniforms.uColorParams.value.set(
      THREE.MathUtils.clamp(numOr(cfg.colorVariety, 1.0), 0, 1.8),
      THREE.MathUtils.clamp(numOr(cfg.alpineAccents, 1.0), 0, 1.8),
      0,
      0
    );
    studioUniforms.uSatDrape.value.set(
      pageQuery.get('satDrape') === '0' ? 0 : THREE.MathUtils.clamp(numOr(cfg.satDrape, 0.8), 0, 2),
      THREE.MathUtils.clamp(numOr(cfg.satScale, 1.0), 0.25, 4),
      THREE.MathUtils.clamp(numOr(cfg.satContrast, 1.0), 0, 2),
      0
    );
    studioUniforms.uRiverDetail.value.set(
      THREE.MathUtils.clamp(numOr(cfg.waveScale, 1.0), 0.4, 2.2),
      THREE.MathUtils.clamp(numOr(cfg.riverDetail, 1.0), 0, 1.8),
      0,
      0
    );

    atlas.tune.relief = cfg.relief;
    atlas.uniforms.uRelief.value = atlas.tune.relief;
    atlas.uniforms.uCanopy.value = atlas.tune.canopy;
    atlas.tune.haze = 0.0;
    /* Skip native 3x3 Voronoi D1 LAND loop whenever our PBR terrain fully replaces col (massive GPU speedup!) */
    atlas.tune.land = (cfg.layers.terrainStyle && s >= 0.98) ? 0.0 : origTune.land;

    if (cfg.layers.water) {
      atlas.tune.rv = 1.0;
      atlas.tune.rvDeep = lerpHex(origTune.rvDeep, cfg.waterDeep || '#071c33', s);
      atlas.tune.rvShallow = lerpHex(origTune.rvShallow, cfg.waterShallow || '#217582', s);
      atlas.tune.rvSky = lerpHex(origTune.rvSky, '#86a6cd', s);
      atlas.tune.rvSpeed = Math.max(0, +cfg.waterSpeed || 1.0);
      atlas.tune.rvWave = Math.max(0.1, +cfg.waterWave || 1.0);
      atlas.tune.rvClear = Math.max(0, Math.min(1.3, cfg.waterClear * Math.min(1, s) + origTune.rvClear * (1 - Math.min(1, s))));
    } else {
      atlas.tune.rv = 0.0;
    }

    if (atlas.trees) atlas.trees.visible = false;
    cobbles.visible = !!(cfg.layers.terrainStyle && s > 0.01 && cfg.shoreWet > 0.0);
    skyDome.visible = !!cfg.layers.terrainStyle;
    sunbeams.group.visible = !!(cfg.layers.sunbeams && cfg.layers.terrainStyle && cfg.sunRays > 0.005);
    mistGroup.visible = studioUniforms.uCloudLayer.value > 0 || studioUniforms.uStudioMist.value > 0.005;

    if (vertexBaker && opt2Bake?.grid) vertexBaker.bake(opt2Bake.grid);
    if (fieldBaker) { fieldBaker.bake(); fieldBaker.updateClouds?.(true); }

    syncCurtain();
  }

  apply();

  return {
    config: cfg,
    terrainPatched,
    lineWatershed: REFINE_HEADWATERS ? makeWatershedGlsl : null,
    falls: FALLS,   /* RISE FALLS: the shape module the land was cut with (null = the lake as before) */
    waterPatched,
    skyDome,
    sunbeams,
    mistGroup,
    uniforms: studioUniforms,
    bindCurtain,
    syncCurtain,
    apply,
    updateClouds() { fieldBaker?.updateClouds?.(false); },
    disposeTextures() {
      for (const tex of [grassAlb, grassWildAlb, mossAlb, grassNrm, rockAlb, rockBasaltAlb, rockNrm, rockNrm2, waterNrm, sgErosionAlb, sgErosionNrm, fusionTex.canopy, mvCanopyNrm]) tex?.dispose?.();
      grassAtlasRT?.dispose?.();
      fieldBaker?.dispose?.();
      vertexBaker?.dispose?.();
      if (arrivalPacked) atlas.uniforms.tCanopy.value.dispose();
    },
    getStats() {
      return {
        mode: 'fused-pbr-terrain-water-261124',
        ecology: 'height / aspect / finite-difference curvature / moisture / 山谷 erosion / Magic Valley canopy',
        arrival: arrivalPacked ? 'authored canyon field in height alpha' : 'procedural fallback',
        activeTrees: 0,
        activeRocks: cobbles.visible ? cobbles.userData.stoneCount : 0,
        tributaries: atlas.studioHydrology?.stats || null,
        textures: [
          'pbr-sward-relief.webp (1536px Grass004 reflectance, blade height, cavity, roughness)',
          'pbr-grass-wild.webp (SRGB, 2K Pure forrest_ground_01)',
          'pbr-moss-albedo.webp (SRGB, 2K Pure Moss002)',
          'pbr-grass-nrm.webp (NoColorSpace, 2K Grass004+Moss002)',
          'pbr-rock-albedo.webp (SRGB, 2K Pure Rock051)',
          'pbr-basalt-shore.webp (sRGB atlas: Rock035 + Pers Scans shore gravel)',
          'pbr-rock-nrm.webp (NoColorSpace, 2K Rock051)',
          'pbr-rock-shore-detail.webp (linear atlas: basalt/moss normals + gravel relief)',
          'alpine-water-nrm.webp (NoColorSpace, 1K Seamless Aerial Capillary Ripples + Ray-Focused Caustics + Flow-Foam Lace)',
          'sg-erosion-albedo.webp (SRGB, 1536px seamless 山谷/textures alpine rock/moss + roughness)',
          'sg-erosion-nrm-ao.webp (Linear, 1536px seamless 山谷/textures OpenGL erosion normal + cavity AO + scree vein mask)',
          'mv-canopy-albedo.webp (SRGB, 1536px seamless magic_valley/textures pine canopy + crown prominence)',
          'mv-canopy-nrm-meadow.webp (Linear, 1536px seamless magic_valley/textures OpenGL crown dome normal + meadow grain + inter-crown AO)'
        ]
      };
    }
  };
}
