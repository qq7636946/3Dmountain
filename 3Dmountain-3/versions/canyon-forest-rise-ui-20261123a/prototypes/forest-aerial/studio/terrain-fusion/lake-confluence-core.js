/* lake-confluence-core.js — Unified Lake Confluence Light (Concentric Frosted Terraces + Luminous Core + Gathering Waves + 460 Stardust Particles)
   Unified single-control lake centerpiece replacing the split 湖心匯流光環 / 湖心匯集光 panels.
   - Luminous white core disc (scales smoothly down to 0 = clean open center) surrounded by 3 crisp stepped
     translucent frosted-ice concentric terraces lying optically flat on the central lake water (0.105 + 0.009).
   - Directional gathering wave rings (+speed = inward confluence 匯集, -speed = outward ripple, 0 = still).
   - 460 GPU-animated twinkling pinpoint stardust particles drifting smoothly across the lake & 4 river mouths.
   - Master opacity dial (0..1), lake-basin water clipping, smooth dive fade, and river-beam outer stop radius (beamStop). */
import * as THREE from 'three';

const LAKE_CENTER = new THREE.Vector3(0.122, 0.105, -0.056);

/* 4 river entrance corridors feeding into the central lake (matching CORE_RIVER_PTS approaches!) */
const RIVER_CORRIDORS = [
  /* SW: 衍生性商品 approach into lake */
  [[-3.20, 0.52], [-2.53, 0.50], [-2.12, 0.22], [-1.42, 0.06], [-0.62, -0.02], [0.122, -0.056]],
  /* NW/W: AI量化交易 approach into lake */
  [[-3.40, -2.25], [-2.64, -1.58], [-2.05, -1.36], [-1.39, -1.20], [-0.75, -0.78], [0.122, -0.056]],
  /* NE: 上市櫃投資 approach into lake */
  [[3.50, -1.65], [2.91, -1.31], [2.36, -1.20], [1.72, -1.16], [1.14, -0.84], [0.122, -0.056]],
  /* SE/E: 未上市與PRE-IPO approach into lake */
  [[3.25, 2.30], [2.62, 2.10], [2.42, 1.52], [2.16, 1.12], [1.54, 0.88], [1.06, 0.54], [0.122, -0.056]]
];

const num = (v, d) => (v !== undefined && v !== null && v !== '' && Number.isFinite(+v)) ? +v : d;

export const DEFAULT_CONFLUENCE_CORE = {
  enabled: true,         /* 顯示湖心匯集光 */
  opacity: 1.0,          /* 湖心匯集光透明度 (0..1, scales discs, core & particles together) */
  scale: 1.0,            /* 整體大小倍率 (1.0 -> outer ring radius ~1.28 world units) */
  coreScale: 1.0,        /* 中央亮核大小倍率 */
  coreBright: 1.15,      /* 中央亮核亮度 (0..2.4; 0 = clean open center!) */
  ringOpacity: 1.0,      /* 層次光盤（同心圓層階）不透明度 */
  pulse: 0.72,           /* 往內收的光紋強度 */
  pulseSpeed: 0.85,      /* 光紋速度（正＝往內匯入、負＝往外擴散、0＝靜止） */
  particles: 1.0,        /* 微光粒子／閃爍亮點亮度 (0 = off) */
  particleSpeed: 1.0,    /* 粒子匯流速度 */
  beamStop: 0.0,         /* 河光停在湖心外半徑（0＝四河交會到中心） */
  offsetX: 0.0,          /* 中心位置 X 微調 */
  offsetZ: 0.0,          /* 中心位置 Z 微調 */
  coreColor: '#f7fcff',  /* 中心核心色 */
  ringColor: '#cde6fa'   /* 同心光環色 */
};

/* ---------- 1. Concentric Stepped Frosted Confluence Disc Shader ---------- */
const DISC_VERT = /* glsl */`
  varying vec2 vLocal;
  varying vec3 vWorld;
  void main() {
    vLocal = position.xy; /* -1..+1 local radius space */
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const DISC_FRAG = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform float uArrival;
  uniform float uProgress;
  uniform float uLattice;
  uniform float uOpacity;
  uniform float uCoreScale;
  uniform float uCoreBright;
  uniform float uRingOpacity;
  uniform float uPulse;
  uniform float uPulseSpeed;
  uniform vec3  uCenter;
  uniform vec3  uCoreColor;
  uniform vec3  uRingColor;

  varying vec2 vLocal;
  varying vec3 vWorld;

  float ccHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float ccNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(ccHash(i), ccHash(i + vec2(1.0, 0.0)), f.x),
      mix(ccHash(i + vec2(0.0, 1.0)), ccHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  /* Exact central lake contour so concentric terraces never spill onto dry rocky shore */
  float ccLakeBasinR(vec2 p) {
    vec2 q = (p - vec2(0.122, -0.056)) / vec2(1.66, 1.42);
    float r = length(q);
    float ang = atan(q.y, q.x);
    float wobble = 0.085 * sin(ang * 3.0 + 0.7) + 0.055 * cos(ang * 5.0 - 1.2) + 0.035 * sin(ang * 7.0 + 2.4);
    float cove = (ccNoise(p * 1.45 + vec2(3.7, -2.1)) - 0.5) * 0.055;
    return r + wobble + cove;
  }

  void main() {
    if (uLattice > 0.35 || uOpacity < 0.003) discard;
    float r = length(vLocal);
    if (r > 1.02) discard;

    /* Screen-space antialiased edge width so every circular step stays razor-clean at any zoom */
    float aa = max(fwidth(r) * 1.25, 0.0045);

    /* Subtle water-surface micro-shimmer modulating the frosted light terraces */
    float n1 = ccNoise(vWorld.xz * 5.5 + vec2(uTime * 0.16, -uTime * 0.12));
    float n2 = ccNoise(vWorld.xz * 12.5 - vec2(uTime * 0.22, uTime * 0.18));
    float waterShimmer = 0.92 + 0.14 * (n1 * 0.62 + n2 * 0.38);

    /* Gentle breathing + directional confluence wave rings (+speed = inward gathering, -speed = outward ripple) */
    float spdAbs = abs(uPulseSpeed);
    float breathe = 1.0 + 0.026 * sin(uTime * 1.45 * max(0.35, min(spdAbs, 1.6))) * clamp(uPulse, 0.0, 1.4) * step(0.001, spdAbs);
    float r0 = clamp(0.225 * uCoreScale * breathe, 0.09, 0.44);
    float r1 = mix(r0 + 0.18, 0.445, 0.72);
    float r2 = 0.705;
    float r3 = 0.965;

    /* 1) Pure luminous white-ice center disc + soft radiant inner bloom halo (cleanly disappears when uCoreBright == 0!) */
    float coreOn = smoothstep(0.0, 0.22, uCoreBright);
    float coreDisc = (1.0 - smoothstep(r0 - aa * 1.6, r0 + aa * 2.2, r)) * coreOn;
    float coreInner = 1.0 - smoothstep(0.0, r0 * 0.92, r);
    float coreBloom = exp(-pow(max(0.0, r - r0 * 0.75) / (r0 * 0.95), 2.0)) * 0.48 * coreOn;

    /* 2) Three clean stepped translucent frosted terraces (gently opens the middle when core is turned to 0) */
    float innerHollow = mix(0.30 + 0.70 * smoothstep(0.0, r0 * 1.25, r), 1.0, coreOn);
    float step1 = (1.0 - smoothstep(r1 - aa * 1.8, r1 + aa * 1.8, r)) * innerHollow;
    float step2 = (1.0 - smoothstep(r2 - aa * 2.0, r2 + aa * 2.0, r)) * smoothstep(r1 - aa, r1 + aa * 2.0, r);
    float step3 = (1.0 - smoothstep(r3 - aa * 2.4, r3 + aa * 2.4, r)) * smoothstep(r2 - aa, r2 + aa * 2.0, r);

    /* Subtle hairline boundary rims accentuating each concentric step cleanly */
    float rim1 = exp(-pow((r - r1) / max(aa * 1.8, 0.0080), 2.0)) * 0.11;
    float rim2 = exp(-pow((r - r2) / max(aa * 2.0, 0.0090), 2.0)) * 0.075;
    float rim3 = exp(-pow((r - r3) / max(aa * 2.4, 0.0110), 2.0)) * 0.045;

    /* Smooth directional wave pulses gliding across the terraces (positive = gathering inward r3 -> r0) */
    float ph1 = spdAbs > 0.001 ? fract(uTime * 0.165 * spdAbs) : 0.35;
    float ph2 = fract(ph1 + 0.5);
    float dirOut = step(uPulseSpeed, -0.0001);
    float pR1 = mix(r0, r3, mix(1.0 - ph1, ph1, dirOut));
    float pR2 = mix(r0, r3, mix(1.0 - ph2, ph2, dirOut));
    float env1 = smoothstep(0.0, 0.14, ph1) * (1.0 - smoothstep(0.76, 1.0, ph1));
    float env2 = smoothstep(0.0, 0.14, ph2) * (1.0 - smoothstep(0.76, 1.0, ph2));
    float pulseWave = (
      exp(-pow((r - pR1) / 0.068, 2.0)) * env1 +
      exp(-pow((r - pR2) / 0.068, 2.0)) * env2 * 0.68
    ) * uPulse * (1.0 - smoothstep(r3 - 0.04, r3 + 0.03, r)) * mix(smoothstep(0.04, 0.24, r), 1.0, coreOn);

    /* Subtle frosted radial luminance gradient inside each terrace */
    float terraceFill = (
      step1 * (0.44 + 0.08 * (1.0 - (r - r0) / max(r1 - r0, 0.05))) +
      step2 * (0.26 + 0.05 * (1.0 - (r - r1) / max(r2 - r1, 0.05))) +
      step3 * (0.135 + 0.03 * (1.0 - (r - r2) / max(r3 - r2, 0.05)))
    ) * waterShimmer;

    float ringAlpha = clamp((terraceFill + rim1 + rim2 + rim3) * uRingOpacity + pulseWave * 0.24 * max(0.35, min(uRingOpacity, 1.2)), 0.0, 0.92);

    /* Lock softly inside open lake water so terraces tuck gracefully against shore bays */
    float lr = ccLakeBasinR(vWorld.xz);
    float lakeMask = 1.0 - smoothstep(0.84, 1.01, lr);

    /* Sync smoothly with valley arrival, river beam convergence & lake dive */
    float reveal = smoothstep(0.18, 0.92, uArrival) * smoothstep(0.08, 0.72, uProgress);
    float diveFade = smoothstep(2.2, 6.8, distance(cameraPosition, uCenter));

    /* Compose frosted cool-ice terraces + luminous pure-white central confluence disc */
    vec3 frostedCol = mix(uRingColor * 0.90, uCoreColor * 1.08, clamp(step1 * 0.45 + rim1 + rim2 + pulseWave * 0.55 + coreBloom * 0.75, 0.0, 1.0));
    vec3 coreCol = uCoreColor * (1.18 + 0.34 * coreInner) * uCoreBright;

    float coreAlpha = coreDisc * 0.97 + coreBloom * (0.34 + 0.30 * clamp(uRingOpacity, 0.0, 1.2));
    float totalAlpha = clamp(max(ringAlpha, coreAlpha) * lakeMask * reveal * diveFade * uOpacity, 0.0, 0.985);
    if (totalAlpha < 0.003) discard;

    /* Blend color seamlessly from translucent silver-ice terraces into incandescent pure-white core */
    float coreMix = clamp(coreDisc + coreBloom * 0.42, 0.0, 1.0);
    vec3 col = mix(frostedCol, coreCol, coreMix);
    /* Subtle additive sheen on bright white core & pulse crests */
    col += uCoreColor * (coreDisc * 0.22 * uCoreBright + pulseWave * 0.22 * max(0.4, uRingOpacity));

    /* Desaturate cleanly during monochrome arrival opening */
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(lum), col, smoothstep(0.12, 0.93, uArrival));

    gl_FragColor = vec4(col, totalAlpha);
    #include <colorspace_fragment>
  }
`;

/* ---------- 2. Converging Lake & River-Mouth Stardust Sparkle Particles ---------- */
const PARTICLE_VERT = /* glsl */`
  attribute vec4 aSeed;   /* x = phase [0..1], y = speed, z = sizePx, w = driftType (0=orbital halo, 1=river inflow) */
  attribute vec4 aMotion; /* xy = endPosXZ (core or inner rim), z = baseHeight, w = lateralAmp */

  uniform sampler2D tWater;
  uniform vec4  uBounds;
  uniform float uTime;
  uniform float uPixel;
  uniform float uScale;
  uniform float uSpeed;
  uniform float uArrival;
  uniform float uProgress;
  uniform float uLattice;
  uniform vec2  uOffset;
  uniform vec3  uCenter;

  varying float vAlpha;
  varying float vWarm;

  void main() {
    if (uLattice > 0.35) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vWarm = 0.0;
      return;
    }

    float t = fract(aSeed.x + uTime * aSeed.y * uSpeed * 0.085);
    vec2 baseCenter = vec2(0.122, -0.056);
    vec2 center = baseCenter + uOffset;
    vec2 startXZ = position.xz;
    vec2 endXZ = aMotion.xy;

    vec2 pXZ;
    float hY;
    float life;

    if (aSeed.w < 0.5) {
      /* Orbital confluence lake sparkles: drift gently inward & slightly spiral across the lake rings */
      vec2 rel = (startXZ - baseCenter) * uScale;
      float shrink = mix(1.06, 0.24, t);
      float ang = t * 0.36 * (aMotion.w >= 0.0 ? 1.0 : -1.0);
      float ca = cos(ang), sa = sin(ang);
      vec2 rotRel = vec2(rel.x * ca - rel.y * sa, rel.x * sa + rel.y * ca) * shrink;
      pXZ = center + rotRel;
      hY = 0.105 + 0.014 + aMotion.z * (0.45 + 0.55 * sin(t * 3.14159265)) + 0.018 * sin(uTime * 1.8 + aSeed.x * 40.0);
      life = smoothstep(0.0, 0.16, t) * (1.0 - smoothstep(0.76, 1.0, t));
    } else {
      /* River-mouth inflow specks: glide downstream along the 4 lake entrances into the glowing core */
      vec2 baseP = mix(startXZ, endXZ, t);
      vec2 dir = normalize(endXZ - startXZ + vec2(1e-4));
      vec2 perp = vec2(-dir.y, dir.x);
      float sway = sin(t * 6.283185 + aSeed.x * 31.0) * aMotion.w * (1.0 - t * 0.65);
      pXZ = baseP + perp * sway + uOffset;
      hY = 0.105 + 0.014 + aMotion.z * (0.35 + 0.65 * sin(t * 3.14159265));
      life = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.84, 1.0, t));
    }

    /* Keep every particle strictly over water using the live authored tWater mask! */
    vec2 wUv = (pXZ - uBounds.xy) * uBounds.zw;
    float overWater = 1.0;
    if (all(greaterThanEqual(wUv, vec2(0.0))) && all(lessThanEqual(wUv, vec2(1.0)))) {
      float wm = texture2D(tWater, wUv).r;
      /* Also allow central analytical lake basin inside r < 1.35 */
      float lr = length((pXZ - vec2(0.122, -0.056)) / vec2(1.66, 1.42));
      overWater = max(smoothstep(0.18, 0.52, wm), 1.0 - smoothstep(0.82, 0.96, lr));
    }

    /* Individual crisp twinkle + dive fade */
    float twinkle = 0.42 + 0.58 * pow(0.5 + 0.5 * sin(uTime * (2.6 + aSeed.y * 2.2) + aSeed.x * 62.83), 2.0);
    float reveal = smoothstep(0.24, 0.92, uArrival) * smoothstep(0.12, 0.78, uProgress);
    float diveFade = smoothstep(2.2, 6.8, distance(cameraPosition, uCenter));

    vec3 wp = vec3(pXZ.x, hY, pXZ.y);
    vec4 mv = viewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mv;

    /* Scale point size cleanly by distance & DPR so specks stay razor-crisp like fine water stardust */
    float distScale = clamp(22.0 / max(-mv.z, 2.0), 0.65, 2.15);
    gl_PointSize = aSeed.z * uPixel * distScale;

    vAlpha = life * twinkle * overWater * reveal * diveFade;
    vWarm = fract(aSeed.x * 17.31);
  }
`;

const PARTICLE_FRAG = /* glsl */`
  precision highp float;

  uniform float uOpacity;
  uniform float uParticles;
  uniform vec3  uCoreColor;
  uniform vec3  uRingColor;

  varying float vAlpha;
  varying float vWarm;

  void main() {
    if (vAlpha < 0.004 || uParticles < 0.004 || uOpacity < 0.004) discard;
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float d2 = dot(q, q);
    if (d2 > 1.0) discard;

    /* Sharp gleaming pinpoint center + soft ethereal ice halo */
    float core = exp(-d2 * 7.5);
    float halo = pow(max(0.0, 1.0 - d2), 2.2) * 0.55;
    float shape = core + halo;

    vec3 col = mix(uRingColor, uCoreColor * 1.18, clamp(core * 0.85 + vWarm * 0.30, 0.0, 1.0));
    vec3 outCol = col * shape * vAlpha * uParticles * uOpacity * 0.95;
    if (max(outCol.r, max(outCol.g, outCol.b)) < 0.003) discard;

    gl_FragColor = vec4(outCol, 1.0);
    #include <colorspace_fragment>
  }
`;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function samplePolyline(pts, u) {
  const n = pts.length - 1;
  const f = THREE.MathUtils.clamp(u, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const t = f - i;
  return [
    pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
    pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t
  ];
}

export function createLakeConfluenceCore(renderer, atlas, studio, options = {}) {
  const q = options.query || new URLSearchParams(location.search);
  const cfg = { ...DEFAULT_CONFLUENCE_CORE, ...(options.config || {}) };
  if (q.get('cv') === '0' || q.get('confluenceCore') === '0') cfg.enabled = false;
  const center = atlas.lake?.center ? atlas.lake.center.clone() : LAKE_CENTER.clone();

  const group = new THREE.Group();
  group.name = 'Lake Concentric Confluence Core';

  /* 1. Concentric Stepped Frosted Light Discs Mesh (lies flat on central lake water) */
  const discGeo = new THREE.PlaneGeometry(2, 2, 1, 1); /* local xy in [-1, +1] */
  const uCenter = { value: new THREE.Vector3(center.x, 0.105, center.z) };
  const discUniforms = {
    uTime: atlas.uniforms.uTime,
    uArrival: studio.uniforms.uArrival,
    uProgress: { value: 1.0 },
    uLattice: atlas.uniforms.uLattice || { value: 0.0 },
    uOpacity: { value: cfg.opacity },
    uCoreScale: { value: cfg.coreScale },
    uCoreBright: { value: cfg.coreBright },
    uRingOpacity: { value: cfg.ringOpacity },
    uPulse: { value: cfg.pulse },
    uPulseSpeed: { value: options.reducedMotion ? 0.0 : cfg.pulseSpeed },
    uCenter,
    uCoreColor: { value: new THREE.Color(cfg.coreColor) },
    uRingColor: { value: new THREE.Color(cfg.ringColor) }
  };
  const discMat = new THREE.ShaderMaterial({
    uniforms: discUniforms,
    vertexShader: DISC_VERT,
    fragmentShader: DISC_FRAG,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  discMat.userData.handlesArrival = true;

  const discMesh = new THREE.Mesh(discGeo, discMat);
  discMesh.name = 'Lake Concentric Terraces';
  discMesh.rotation.x = -Math.PI * 0.5;
  discMesh.frustumCulled = false;
  discMesh.renderOrder = 8;
  group.add(discMesh);

  /* 2. 460 Converging Lake Stardust & River-Mouth Sparkle Particles */
  const rand = mulberry(26112409);
  const ORBIT_COUNT = 260;
  const RIVER_COUNT = 200;
  const TOTAL = ORBIT_COUNT + RIVER_COUNT;

  const pos = new Float32Array(TOTAL * 3);
  const seed = new Float32Array(TOTAL * 4);
  const motion = new Float32Array(TOTAL * 4);

  let idx = 0;
  /* A) Lake confluence halo sparkles: denser across the concentric discs & open lake bays */
  for (let i = 0; i < ORBIT_COUNT; i++, idx++) {
    const ang = rand() * Math.PI * 2;
    const rad = 0.28 + Math.pow(rand(), 0.72) * 1.58;
    const wx = center.x + Math.cos(ang) * rad * 1.06;
    const wz = center.z + Math.sin(ang) * rad * 0.92;
    pos[idx * 3] = wx;
    pos[idx * 3 + 1] = 0.105;
    pos[idx * 3 + 2] = wz;

    seed[idx * 4] = rand();
    seed[idx * 4 + 1] = 0.55 + rand() * 0.95;
    seed[idx * 4 + 2] = 1.65 + Math.pow(rand(), 1.8) * 3.15;
    seed[idx * 4 + 3] = 0.0; /* orbital halo */

    motion[idx * 4] = center.x;
    motion[idx * 4 + 1] = center.z;
    motion[idx * 4 + 2] = Math.pow(rand(), 2.2) * 0.22;
    motion[idx * 4 + 3] = rand() < 0.5 ? -1.0 : 1.0;
  }

  /* B) River-mouth converging stardust streams along all 4 rivers into the lake center */
  for (let i = 0; i < RIVER_COUNT; i++, idx++) {
    const corr = RIVER_CORRIDORS[i % RIVER_CORRIDORS.length];
    const u0 = rand() * 0.68;
    const u1 = Math.min(1.0, u0 + 0.34 + rand() * 0.35);
    const p0 = samplePolyline(corr, u0);
    const p1 = samplePolyline(corr, u1);
    const spread = (rand() - 0.5) * 0.34;
    const spreadZ = (rand() - 0.5) * 0.34;
    pos[idx * 3] = p0[0] + spread;
    pos[idx * 3 + 1] = 0.105;
    pos[idx * 3 + 2] = p0[1] + spreadZ;

    seed[idx * 4] = rand();
    seed[idx * 4 + 1] = 0.75 + rand() * 1.15;
    seed[idx * 4 + 2] = 1.55 + Math.pow(rand(), 1.9) * 2.85;
    seed[idx * 4 + 3] = 1.0; /* river inflow */

    motion[idx * 4] = p1[0] + (rand() - 0.5) * 0.18;
    motion[idx * 4 + 1] = p1[1] + (rand() - 0.5) * 0.18;
    motion[idx * 4 + 2] = Math.pow(rand(), 2.4) * 0.16;
    motion[idx * 4 + 3] = (rand() - 0.5) * 0.24;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  pGeo.setAttribute('aMotion', new THREE.BufferAttribute(motion, 4));

  const pUniforms = {
    tWater: atlas.uniforms.tWater,
    uBounds: atlas.uniforms.uBounds,
    uTime: atlas.uniforms.uTime,
    uPixel: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uOpacity: discUniforms.uOpacity,
    uScale: { value: cfg.scale },
    uSpeed: { value: cfg.particleSpeed },
    uParticles: { value: cfg.particles },
    uArrival: studio.uniforms.uArrival,
    uProgress: discUniforms.uProgress,
    uLattice: discUniforms.uLattice,
    uOffset: { value: new THREE.Vector2(cfg.offsetX, cfg.offsetZ) },
    uCenter,
    uCoreColor: discUniforms.uCoreColor,
    uRingColor: discUniforms.uRingColor
  };

  const pMat = new THREE.ShaderMaterial({
    uniforms: pUniforms,
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  pMat.userData.handlesArrival = true;

  const points = new THREE.Points(pGeo, pMat);
  points.name = 'Lake Confluence Stardust';
  points.frustumCulled = false;
  points.renderOrder = 10;
  group.add(points);

  const BASE_RADIUS = 1.28; /* world radius of outermost frosted terrace at scale=1.0 */

  function apply() {
    const on = !!cfg.enabled;
    const op = THREE.MathUtils.clamp(num(cfg.opacity, 1.0), 0.0, 1.0);
    group.visible = on && op > 0.002;

    const s = Math.max(0.25, num(cfg.scale, 1.0));
    const ox = num(cfg.offsetX, 0.0);
    const oz = num(cfg.offsetZ, 0.0);

    uCenter.value.set(center.x + ox, 0.105, center.z + oz);
    discMesh.position.set(center.x + ox, 0.105 + 0.009, center.z + oz);
    /* Geometrically pure circle in world XZ -> projects into sleek symmetrical concentric ellipses in aerial perspective */
    discMesh.scale.set(BASE_RADIUS * s, BASE_RADIUS * s, 1);

    discUniforms.uOpacity.value = op;
    discUniforms.uCoreScale.value = THREE.MathUtils.clamp(num(cfg.coreScale, 1.0), 0.35, 2.0);
    discUniforms.uCoreBright.value = THREE.MathUtils.clamp(num(cfg.coreBright, 1.15), 0.0, 2.5);
    discUniforms.uRingOpacity.value = THREE.MathUtils.clamp(num(cfg.ringOpacity, 1.0), 0.0, 2.2);
    discUniforms.uPulse.value = THREE.MathUtils.clamp(num(cfg.pulse, 0.72), 0.0, 2.5);
    discUniforms.uPulseSpeed.value = options.reducedMotion ? 0.0 : THREE.MathUtils.clamp(num(cfg.pulseSpeed, 0.85), -2.5, 2.5);
    discUniforms.uCoreColor.value.set(cfg.coreColor || '#f7fcff');
    discUniforms.uRingColor.value.set(cfg.ringColor || '#cde6fa');

    pUniforms.uScale.value = s;
    pUniforms.uSpeed.value = options.reducedMotion ? 0.0 : THREE.MathUtils.clamp(num(cfg.particleSpeed, 1.0), 0.0, 3.0);
    pUniforms.uParticles.value = THREE.MathUtils.clamp(num(cfg.particles, 1.0), 0.0, 2.5);
    pUniforms.uOffset.value.set(ox, oz);
    points.visible = group.visible && pUniforms.uParticles.value > 0.004;
  }

  function getBeamOutline() {
    const r = Math.max(0, num(cfg.beamStop, 0));
    if (!cfg.enabled || r <= 0.01) return [];
    const cx = center.x + num(cfg.offsetX, 0);
    const cz = center.z + num(cfg.offsetZ, 0);
    const ring = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ring.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    return [ring];
  }

  function update({ routeProgress = 1.0 } = {}) {
    discUniforms.uProgress.value = THREE.MathUtils.clamp(routeProgress, 0, 1);
    pUniforms.uPixel.value = Math.min(renderer?.getPixelRatio?.() || window.devicePixelRatio || 1, 2);
  }

  apply();

  const api = {
    config: cfg,
    group,
    discMesh,
    points,
    discUniforms,
    pUniforms,
    getBeamOutline,
    apply,
    update,
    dispose() {
      atlas.scene.remove(group);
      discGeo.dispose();
      discMat.dispose();
      pGeo.dispose();
      pMat.dispose();
    }
  };
  window.__LAKE_CONVERGENCE__ = api;
  return api;
}
