import { createCanyonWatershed } from './water-canyon-watershed.js?v=shore-detail-1';

// Opt in per page; existing journey pages retain their original night palette.
export const WATERSHED_STYLE_DEFAULTS = Object.freeze({
  rockColor: '#899baa', skyColor: '#8fa5ba', mistColor: '#c2cdd6',
  exposure: 1, haze: 1, relief: 1
});

/* 河岸與山體細節（opt-in）：只有傳入 shoreConfig 的頁面才會換上新的岸線幾何、
   碎裂岩塊、岸邊碎石與岩面細節；沒傳的頁面（index4-6 / 4-6-2）維持原本的每一個位元組。
   數值類的鍵每一幀即時讀取，所以參數列拖曳不必重建場景；幾何只在載入時建一次。 */
export const SHORELINE_DEFAULTS = Object.freeze({
  foam: .75,        // 岸邊浪花蕾絲：水面側與岩石側同一條接觸線
  shallow: .8,      // 淺水透亮：越靠岸越淺、越亮
  reflect: .55,     // 岸壁倒影：近岸水面映出山壁的暗色
  wet: 1,           // 濕岩帶：水線上方被水打濕的深色帶
  micro: 1,         // 岩面紋理：世界座標的法線擾動，依像素足跡淡出，不會閃
  strata: 1,        // 岩層層理：沉積層的橫向層階
  crease: 1,        // 岩縫陰影：凹處（溝、縫、層階下緣）壓暗
  frost: .55,       // 高處霜色：高而平的坡面帶一點霜白（在遠霧/銀色色域內）
  foamColor: '#e9f0f4'
});

/** A bounded, deterministic river canyon. All camera positions share the river's arc-length coordinates. */
export function createJourneyScene(THREE, { createRiver, watershedStyle = null, flowConfig = null, terrainConfig = null, shoreConfig = null, lite = typeof innerWidth === 'number' && innerWidth < 760 }) {
  const shore = shoreConfig;
  const shoreNumber = (key, min, max) => {
    const value = Number(shore?.[key] ?? SHORELINE_DEFAULTS[key]);
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : SHORELINE_DEFAULTS[key]));
  };
  const scene = new THREE.Scene();
  scene.name = 'MONTIS River Journey';
  scene.background = new THREE.Color('#a9bdcf');
  scene.fog = new THREE.FogExp2('#b5c7d7', .00172);
  const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, .10, 3200);
  const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const clamp01 = x => Math.max(0, Math.min(1, x));
  // Long, deliberately broad turns leave the complete navigable corridor visible.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(-12, 0, -112),
    new THREE.Vector3(45, 0, -252), new THREE.Vector3(114, 0, -375),
    new THREE.Vector3(55, 0, -514), new THREE.Vector3(-65, 0, -645),
    new THREE.Vector3(-82, 0, -775), new THREE.Vector3(35, 0, -913),
    new THREE.Vector3(96, 0, -1050), new THREE.Vector3(35, 0, -1220),
    new THREE.Vector3(-5, 0, -1370), new THREE.Vector3(-26, 0, -1580),
    new THREE.Vector3(-42, 0, -1880)
  ], false, 'centripetal');
  curve.arcLengthDivisions = 1600;
  curve.updateArcLengths();
  const widthAt = t => 19 + 38 * (1 - smooth(.035, .21, t))
    + 106 * smooth(.70, .95, t) + 3.2 * Math.sin(t * Math.PI * 6 + .4);
  // Shore mode: the water sheet runs under the banks, so the visible edge is the
  // true intersection of water and rock instead of the mesh's own straight hem.
  const mainOverlap = shore ? 1.34 : null;
  const river = shore ? createRiver(THREE, curve, widthAt, { bankOverlap: mainOverlap }) : createRiver(THREE, curve, widthAt);
  river.mesh.name = 'Continuous reflective river';
  scene.add(river.mesh);

  const hemisphere = new THREE.HemisphereLight('#dce9f4', '#53616b', 2.3);
  const sunlight = new THREE.DirectionalLight('#ffead0', 2.65);
  sunlight.position.set(-190, 260, -210);
  // Static terrain shadows are baked once by the directional light.
  sunlight.target.position.set(0,0,-2200);
  sunlight.position.set(-4750,6500,-7450);
  sunlight.castShadow=true;
  sunlight.shadow.mapSize.set(innerWidth<760?2048:4096,innerWidth<760?2048:4096);
  Object.assign(sunlight.shadow.camera,{left:-5200,right:5200,top:5200,bottom:-5200,near:100,far:17000});
  sunlight.shadow.bias=-.00012;sunlight.shadow.normalBias=3;
  sunlight.shadow.autoUpdate=false;sunlight.shadow.needsUpdate=true;
  scene.add(hemisphere, sunlight, sunlight.target);
  const rim = new THREE.DirectionalLight('#9bbddd', 1.4);
  rim.position.set(140, 80, 220);
  scene.add(rim);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(2700, 28, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zenith: { value: new THREE.Color('#779abf') }, horizon: { value: new THREE.Color('#d4dee5') } },
    vertexShader: 'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 zenith,horizon; varying vec3 vDirection; void main(){float h=max(normalize(vDirection).y,0.); vec3 c=mix(horizon,zenith,pow(h,.47)); gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const fract = v => v - Math.floor(v);
  const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7 + 81.73) * 43758.5453);
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), ux), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), ux), uy);
  }
  function fbm(x, y) { return noise(x, y) * .57 + noise(x * 2.07 + 13, y * 2.07) * .28 + noise(x * 4.13, y * 4.13 + 19) * .15; }

  const styleValue = key => watershedStyle?.[key] ?? WATERSHED_STYLE_DEFAULTS[key];
  const styleNumber = (key, min, max) => {
    const value = Number(styleValue(key));
    return THREE.MathUtils.clamp(Number.isFinite(value) ? value : WATERSHED_STYLE_DEFAULTS[key], min, max);
  };
  const atmosphere = {
    uOverview: { value: 0 }, uIcePalette: { value: watershedStyle ? 1 : 0 },
    uIceRockTint: { value: new THREE.Color(styleValue('rockColor')) },
    uIceExposure: { value: 1 }, uIceHaze: { value: 1 }, uIceRelief: { value: 1 }
  };
  const rockMaterial = new THREE.MeshStandardMaterial({ color: '#adbbc5', vertexColors: true, roughness: .94, metalness: .035 });
  rockMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, atmosphere);
    shader.vertexShader = 'varying vec3 vRockWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 rockLocal=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nrockLocal=instanceMatrix*rockLocal;\n#endif\nvRockWorld=(modelMatrix*rockLocal).xyz;');
    shader.fragmentShader = `varying vec3 vRockWorld; uniform float uOverview,uIcePalette,uIceExposure,uIceHaze,uIceRelief; uniform vec3 uIceRockTint;
      float rockHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float rockNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(rockHash(i),rockHash(i+vec3(1,0,0)),f.x),mix(rockHash(i+vec3(0,1,0)),rockHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(rockHash(i+vec3(0,0,1)),rockHash(i+vec3(1,0,1)),f.x),mix(rockHash(i+vec3(0,1,1)),rockHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float rockLarge=rockNoise(vRockWorld*.085);
      float warp=rockNoise(vRockWorld*vec3(.028,.015,.028));
      float bedding=vRockWorld.y*.19+vRockWorld.x*.045+vRockWorld.z*.025+warp*5.6+rockLarge*1.9;
      float ledge=smoothstep(.88,.98,abs(sin(bedding)))*smoothstep(.30,.70,rockNoise(vRockWorld*.064));
      float fine=rockNoise(vRockWorld*.83);
      float fracture=smoothstep(.79,.94,rockNoise(vRockWorld*vec3(.33,.033,.33)));
      diffuseColor.rgb*= (.82+rockLarge*.30+fine*.19-ledge*.075-fracture*.20);
      float waterline=1.-smoothstep(.15,3.8,vRockWorld.y);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.48,.57,.61),waterline*.62);
      // The later aerial chapter moves into moonlit slate, not pale snow.
      // Wide erosion bands survive distance; subpixel grain fades away.
      float strata = .5+.5*sin(vRockWorld.y*.028+warp*7.+vRockWorld.x*.008);
      float vein = smoothstep(.69,.94,rockNoise(vRockWorld*vec3(.018,.041,.014)));
      vec3 blueSlate = diffuseColor.rgb*vec3(.045,.105,.25);
      blueSlate *= .78+strata*.15+rockLarge*.18-vein*.12;
      // Neutral mineral tint keeps the distant range in the same silver-blue world.
      float mineralLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      vec3 iceSlate=uIceRockTint*(.40+min(mineralLuma,.8)*2.1);
      float erosion=.85+(strata-.5)*.13+(rockLarge-.5)*.20-vein*.10;
      iceSlate*=max(.40,1.+(erosion-1.)*uIceRelief)*uIceExposure;
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(blueSlate,iceSlate,uIcePalette),uOverview);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      float relief = (rockLarge*.8+sin(bedding)*.10)*(1.-smoothstep(170.,900.,length(vViewPosition)));
      vec3 qx=dFdx(-vViewPosition),qy=dFdy(-vViewPosition);
      vec3 rx=cross(qy,normal),ry=cross(normal,qx);float determinant=dot(qx,rx);
      vec3 gradient=sign(determinant)*(dFdx(relief)*rx+dFdy(relief)*ry);
      normal=normalize(abs(determinant)*normal-gradient*.22*uOverview*mix(1.,uIceRelief,uIcePalette)+normal*.000001);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.48,1.-smoothstep(.2,3.,vRockWorld.y));');
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
        float dayFogAmount=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
        float nightDepth=length(vViewPosition);
        float distanceHaze=smoothstep(mix(2800.,4300.,uIcePalette),12500.,nightDepth)*.68;
        float valleyHaze=exp(-max(vRockWorld.y,0.)*.005)*smoothstep(1800.,7200.,nightDepth)*mix(.24,.12,uIcePalette);
        float nightFogAmount=clamp((distanceHaze+valleyHaze)*mix(1.,uIceHaze,uIcePalette),0.,mix(.76,.68,uIcePalette));
        gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,mix(dayFogAmount,nightFogAmount,uOverview));
      #endif
    `);
  };
  rockMaterial.customProgramCacheKey = () => 'montis-canyon-mineral-palette-v5';
  // Shore mode layers extra rock detail onto the unchanged original program.
  // Every term is band-limited by its own pixel footprint, so the far range
  // keeps its haze and nothing shimmers during the aerial dolly.
  const shoreUniforms = shore ? {
    uShoreWet: { value: 1 }, uShoreFoam: { value: .75 }, uRockMicro: { value: 1 }, uRockStrata: { value: 1 },
    uRockCrease: { value: 1 }, uRockFrost: { value: .55 },
    uShoreFoamColor: { value: new THREE.Color(SHORELINE_DEFAULTS.foamColor) },
    uFrostColor: { value: new THREE.Color('#d6e2ea') }, uFrostRange: { value: new THREE.Vector2(520, 1150) }
  } : null;
  if (shore) {
    const baseCompile = rockMaterial.onBeforeCompile;
    rockMaterial.onBeforeCompile = shader => {
      baseCompile(shader);
      Object.assign(shader.uniforms, shoreUniforms);
      shader.fragmentShader = 'uniform float uShoreWet,uShoreFoam,uRockMicro,uRockStrata,uRockCrease,uRockFrost;\nuniform vec3 uShoreFoamColor,uFrostColor;\nuniform vec2 uFrostRange;\n' + shader.fragmentShader;
      const paletteLine = 'diffuseColor.rgb=mix(diffuseColor.rgb,mix(blueSlate,iceSlate,uIcePalette),uOverview);';
      shader.fragmentShader = shader.fragmentShader.replace(paletteLine, paletteLine + `
      // ---- shore mode: micro relief, strata, creases, frost, wet band and foam lace ----
      vec3 rockN=normalize((vec4(vNormal,0.)*viewMatrix).xyz);
      vec3 rp=vRockWorld;
      float rockFoot=length(fwidth(rp))+1e-4;
      float w0=1.-smoothstep(.16,.45,rockFoot*.011),w1=1.-smoothstep(.16,.45,rockFoot*.045);
      float w2=1.-smoothstep(.16,.45,rockFoot*.22),w3=1.-smoothstep(.16,.45,rockFoot*.55),w4=1.-smoothstep(.16,.45,rockFoot*1.9);
      float m0=rockNoise(rp*vec3(.011,.016,.011)+vec3(3.1,0.,7.7));
      float m1=rockNoise(rp*.045+vec3(11.,5.,2.));
      // Sedimentary bedding: a sharp riser, then a long tread.
      float layer=fract((rp.y*.58+warp*2.5+m0*1.4)/6.2832);
      float w2s=1.-smoothstep(.10,.30,rockFoot*.22);
      float strataH=smoothstep(0.,.32,layer)*(1.-layer)*.75;
      // Close-range terms are skipped outright where their footprint has faded (aerial).
      float joint=0.,grain=.5;
      if(rockFoot<.9){
        joint=smoothstep(.86,.97,1.-abs(rockNoise(rp*vec3(.30,.045,.30)+13.)*2.-1.))*smoothstep(.35,.6,m1)*(1.-smoothstep(.04,.12,rockFoot));
        grain=rockNoise(rp*1.9);
      }
      float microRelief=uRockMicro*(w0*m0*9.+w1*m1*2.4+w2s*strataH*uRockStrata-w3*joint*.45+w4*grain*.07);
      float crease=uRockCrease*(w1*(.5-m1)*.10+w2s*(1.-smoothstep(0.,.10,layer))*.07*uRockStrata+w3*joint*.20);
      diffuseColor.rgb*=1.-clamp(crease,-.08,.42);
      diffuseColor.rgb*=1.+uRockCrease*(.045-(1.-rockN.y)*.10);
      float frost=uRockFrost*smoothstep(uFrostRange.x,uFrostRange.y,rp.y+(m1-.5)*140.+(m0-.5)*260.)
        *smoothstep(.62,.92,rockN.y)*(.55+.45*m1)*(1.-joint*.6);
      diffuseColor.rgb=mix(diffuseColor.rgb,uFrostColor*uIceExposure,clamp(frost,0.,1.)*.55);
      float yFoot=max(fwidth(rp.y),1e-3);
      if(rp.y<14.+yFoot*4.){
      float wetTop=.8+1.9*rockNoise(rp*vec3(.35,.08,.35)+2.)+m1*.8;
      float wetBand=1.-smoothstep(wetTop*.45,wetTop+yFoot,rp.y);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.50,.58,.65),wetBand*.78*uShoreWet);
      // Flood stains: faint vertical streaks left by high water on the lower walls.
      float stain=(1.-smoothstep(2.5,7.5+m1*4.,rp.y))*smoothstep(.45,.75,rockNoise(rp*vec3(.9,.06,.9)+31.))*w3;
      diffuseColor.rgb*=1.-stain*.16*uShoreWet;
      // Swash zone: the rock between wave trough and crest carries the foam.
      float laceN=rockNoise(vec3(rp.xz*.8,rp.y*1.5)+7.)*.6+rockNoise(vec3(rp.xz*2.2,1.7))*.4;
      // Fixed world-height band: fwidth(rp.y) is large and per-quad on near-flat shelves at
      // grazing view, so letting it widen the band painted whole facets white.
      float bandW=clamp(yFoot*1.3,.2,.45);
      float contact=smoothstep(-1.0,-.55,rp.y)*(1.-smoothstep(bandW*.2,bandW*(.6+laceN*.9),rp.y));
      float laceDetail=1.-smoothstep(.25,.8,rockFoot*1.35);
      // Risers that meet the water carry the lace; flat shelf tops get little; far range fades out.
      // The lace must resolve to a few pixels in height; where one pixel already spans a large
      // part of the band (distant/grazing rubble) it would fill whole facets, so it fades out and
      // the water-side shore line carries the contact instead.
      float laceRes=1.-smoothstep(.012,.045,yFoot);
      float riser=smoothstep(.2,.6,1.-rockN.y);
      float rockFoam=contact*(.20+.80*smoothstep(.40,.70,laceN))*laceDetail*laceRes*riser*uShoreFoam*mix(.62,.12,uOverview);
      float spray=(1.-smoothstep(0.,1.1,rp.y))*smoothstep(-.35,.05,rp.y)*laceRes*.08*uShoreFoam;
      diffuseColor.rgb=mix(diffuseColor.rgb,uShoreFoamColor*.92,clamp(max(rockFoam,spray),0.,.86));
      }
      `);
      const normalLine = 'normal=normalize(abs(determinant)*normal-gradient*.22*uOverview*mix(1.,uIceRelief,uIcePalette)+normal*.000001);';
      shader.fragmentShader = shader.fragmentShader.replace(normalLine, normalLine + `
      vec3 microGradient=sign(determinant)*(dFdx(microRelief)*rx+dFdy(microRelief)*ry);
      normal=normalize(abs(determinant)*normal-microGradient);
      `);
    };
    rockMaterial.customProgramCacheKey = () => 'montis-canyon-mineral-palette-v5-shore-1';
  }
  const longitudinal = shore ? (lite ? 460 : 660) : 380, lateral = shore ? (lite ? 62 : 84) : 53;
  const rockDark = new THREE.Color('#526676'), rockPale = new THREE.Color('#a0acb4'), lichen = new THREE.Color('#687875');
  let terrainVertices = 0;
  for (const side of (shore ? [] : [-1, 1])) {
    const positions = [], colors = [], indices = [];
    for (let i = 0; i <= longitudinal; i++) {
      const t = i / longitudinal, center = curve.getPointAt(t), tangent = curve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const canyon = smooth(.025, .17, t) * (1 - smooth(.65, .91, t));
      const buttress = noise(t * 24 + 13, side * 19 + 65);
      const ravine = Math.pow(noise(t * 47 + 38, side * 11 + 14), 1.5);
      const shoulder = 18 + canyon * (32 + buttress * 42);
      for (let j = 0; j <= lateral; j++) {
        const u = j / lateral;
        // Concentrate samples at the steep wet edge; retain enough land beyond the skyline.
        const distance = Math.pow(u, 1.47) * 250;
        const bankRipple = (noise(t * 95, side * 13 + 51) - .5) * 4.2;
        const r = widthAt(t) * .985 + distance + bankRipple * smooth(0, 13, distance);
        const shore = r - distance;
        // Carry outer land outward in world X, avoiding folded offset curves on the inside of bends.
        const x = center.x + normal.x * side * shore + side * distance;
        const z = center.z + normal.z * side * shore;
        const broad = fbm(x * .017 + side * 5, z * .014);
        const ridges = Math.pow(Math.abs(Math.sin(t * 42 + side * 2.7 + broad * 3.3)), .52);
        const cliffHeight = shoulder * (.34 + buttress * .50 + ravine * .52 + broad * .14);
        const cliffStart = 4 + 24 * noise(t * 39, side * 7 + 30);
        const cliff = smooth(cliffStart, cliffStart + 11 + broad * 20, distance);
        const upperRidge = Math.pow(ridges, 1.8) * (26 + broad * 117) + broad * 48;
        const highland = smooth(58 + buttress * 35, 235, distance) * upperRidge * (.40 + canyon * .60);
        const rockFace = noise(t * 118 + 7, u * 18 + side * 18);
        const teeth = (rockFace - .5) * (5 + cliff * 10) * smooth(2, 16, distance);
        const shelf = Math.sin(distance * .08 + broad * 4) * (2 + ravine * 5) * smooth(14, 55, distance);
        const outlet = 1 - smooth(.89, 1, t) * .58;
        const y = -.9 + (Math.min(distance, 8) * .16 + cliffHeight * cliff + highland + teeth + shelf) * outlet;
        positions.push(x, y, z);
        const color = rockDark.clone().lerp(rockPale, .19 + broad * .61 + Math.min(y / 220, .17));
        color.lerp(lichen, smooth(70, 155, y) * noise(x * .028, z * .028) * .20);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let i = 0; i < longitudinal; i++) for (let j = 0; j < lateral; j++) {
      const a = i * (lateral + 1) + j, b = a + lateral + 1;
      // Geometry normals must face out/up on both sides of the river.
      if (side < 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const bank = new THREE.Mesh(geometry, rockMaterial);
    bank.name = side < 0 ? 'West stratified cliffs' : 'East stratified cliffs';
    scene.add(bank); terrainVertices += positions.length / 3;
  }

  // ---- Shore mode (opt-in) ------------------------------------------------
  // Every bank quantity is a pure function of (t, side, distance), so the bank
  // mesh, the boulders, the scree and the water's shore attribute all read the
  // very same rock. Nothing here runs when shoreConfig is absent.
  function rowFrame(t, side) {
    const center = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const canyon = smooth(.025, .17, t) * (1 - smooth(.65, .91, t));
    const buttress = noise(t * 24 + 13, side * 19 + 65);
    const ravine = Math.pow(noise(t * 47 + 38, side * 11 + 14), 1.5);
    const w = widthAt(t);
    // Coves and rocky points: the shoreline is no longer a parallel offset of the centreline.
    const jitter = ((noise(t * 170 + side * 7.3, 3.7) - .5) * 3.4 + (noise(t * 41 + side * 2.1, side * 5 + 2) - .5) * 7.5) * Math.min(1, w / 30);
    return { t, side, center, tangent, normal, canyon, buttress, ravine, w,
      shoulder: 18 + canyon * (32 + buttress * 42), r0: w * .985 + jitter,
      rise: 1.2 + 2.0 * noise(t * 90 + side * 3.1, 11.3), cliffStart: 4 + 24 * noise(t * 39, side * 7 + 30),
      bankRipple: (noise(t * 95, side * 13 + 51) - .5) * 4.2, outlet: 1 - smooth(.89, 1, t) * .58,
      strataH: 7.5 + 3 * noise(t * 5 + side * 3, 7) };
  }
  function bankHeight(f, distance, x, z) {
    const { t, side } = f;
    // Below the waterline the bed keeps falling away under the water sheet.
    if (distance < 0) return Math.max(-6, -1.5 + distance * .38);
    const broad = fbm(x * .017 + side * 5, z * .014);
    const ridges = Math.pow(Math.abs(Math.sin(t * 42 + side * 2.7 + broad * 3.3)), .52);
    const cliffHeight = f.shoulder * (.34 + f.buttress * .50 + f.ravine * .52 + broad * .14);
    const cliff = smooth(f.cliffStart, f.cliffStart + 11 + broad * 20, distance);
    const upperRidge = Math.pow(ridges, 1.8) * (26 + broad * 117) + broad * 48;
    const highland = smooth(58 + f.buttress * 35, 235, distance) * upperRidge * (.40 + f.canyon * .60);
    const u = Math.pow(distance / 250, 1 / 1.47);
    const teeth = (noise(t * 118 + 7, u * 18 + side * 18) - .5) * (5 + cliff * 10) * smooth(2, 16, distance);
    const shelf = Math.sin(distance * .08 + broad * 4) * (2 + f.ravine * 5) * smooth(14, 55, distance);
    // Macro: sharper aretes on the skyline, drainage gullies cut down the walls.
    const arete = Math.pow(1 - Math.abs(noise(x * .019 + side * 3, z * .016) * 2 - 1), 3) * 30 * smooth(45, 190, distance) * (.4 + f.canyon * .6);
    const gully = Math.pow(1 - Math.abs(noise(t * 64 + side * 13, distance * .011 + side * 2) * 2 - 1), 3.5) * (3 + cliff * 8) * smooth(12, 50, distance);
    // Boulder-field relief on the low shelf between the waterline and the cliff foot.
    const rubble = ((noise(t * 140 + side * 5.3, distance * .22 + side) - .5) * 3.2 + (noise(t * 380 + side, distance * .6 + 17) - .5) * 1.1)
      * smooth(2.5, 6, distance) * (1 - cliff * .8);
    let y = -.9 + (Math.min(distance, 8) * .16 + cliffHeight * cliff + highland + teeth + shelf + arete - gully + rubble) * f.outlet;
    // The wet edge: rock climbs out of the water within a few units, in lumpy shelves.
    const near = -1.5 + 3.3 * smooth(0, f.rise, distance)
      + (noise(t * 230 + side * 9.7, distance * .55 + side * 4.1) - .5) * 2.6 * smooth(.4, 3, distance)
      + (noise(t * 560 + side * 3.3, distance * 1.4 + 9) - .5) * .9 * smooth(.2, 1.6, distance);
    y += (near - (-.9 + Math.min(distance, 8) * .16 * f.outlet)) * (1 - smooth(5, 15, distance));
    // Meso: tilted sedimentary terraces on the walls (continuous, no cliffs of zero width).
    const H = f.strataH, phase = (x * .024 + z * .011) / H + noise(x * .01 + 4, z * .01) * .6;
    const s = y / H + phase, fl = Math.floor(s), fr = s - fl;
    const terrace = (fl + smooth(.5, 1, fr) * .85 + fr * .15 - phase) * H;
    y += (terrace - y) * .42 * smooth(10, 26, distance) * (1 - smooth(190, 250, distance));
    return y;
  }
  function bankPoint(f, distance, out) {
    const shoreR = f.r0 + f.bankRipple * smooth(0, 13, distance);
    out.x = f.center.x + f.normal.x * f.side * shoreR + f.side * distance;
    out.z = f.center.z + f.normal.z * f.side * shoreR;
    out.y = bankHeight(f, distance, out.x, out.z);
    return out;
  }
  const lateralDistance = j => Math.pow(j / lateral, 1.62) * 250;
  function buildShoreBanks() {
    let vertices = 0;
    const columns = lateral + 1, rows = longitudinal + 1, point = { x: 0, y: 0, z: 0 };
    const segment = curve.getLength() / longitudinal;
    for (const side of [-1, 1]) {
      const positions = new Float32Array(rows * columns * 3), colors = new Float32Array(rows * columns * 3), indices = [];
      for (let i = 0; i < rows; i++) {
        const f = rowFrame(i / longitudinal, side);
        for (let j = 0; j < columns; j++) {
          bankPoint(f, lateralDistance(j), point);
          positions.set([point.x, point.y, point.z], (i * columns + j) * 3);
        }
      }
      // Crease/ridge tone baked from the grid's own curvature: gullies, ledge
      // undersides and the notch at the waterline darken, arete crests lift.
      const color = new THREE.Color();
      for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
        const o = (i * columns + j) * 3, x = positions[o], y = positions[o + 1], z = positions[o + 2];
        const yAt = (a, b) => positions[(Math.max(0, Math.min(rows - 1, a)) * columns + Math.max(0, Math.min(columns - 1, b))) * 3 + 1];
        const dL = lateralDistance(Math.max(0, j - 1)), dR = lateralDistance(Math.min(lateral, j + 1));
        const across = ((yAt(i, j - 1) + yAt(i, j + 1)) * .5 - y) / Math.max(.6, (dR - dL) * .5);
        const along = ((yAt(i - 1, j) + yAt(i + 1, j)) * .5 - y) / segment;
        const concave = across * .55 + along * .45;
        const broad = fbm(x * .017 + side * 5, z * .014);
        color.copy(rockDark).lerp(rockPale, .19 + broad * .61 + Math.min(y / 220, .17));
        color.lerp(lichen, smooth(70, 155, y) * noise(x * .028, z * .028) * .20);
        color.multiplyScalar(1 - THREE.MathUtils.clamp(concave * .55, -.10, .22));
        colors.set([color.r, color.g, color.b], o);
      }
      for (let i = 0; i < longitudinal; i++) for (let j = 0; j < lateral; j++) {
        const a = i * columns + j, b = a + columns;
        if (side < 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
        else indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      const bank = new THREE.Mesh(geometry, rockMaterial);
      bank.name = side < 0 ? 'West stratified cliffs · shore detail' : 'East stratified cliffs · shore detail';
      scene.add(bank); vertices += rows * columns;
    }
    return vertices;
  }
  // Fractured rock: a noisy ellipsoid cut by a few planes. A face lying on a
  // cut keeps that plane's normal (a fresh, flat break with a crisp edge);
  // everything else keeps smooth weathered normals.
  function makeRockGeometry(seed, detail, flatten, lighten = 0) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, count = p.count;
    const planes = [], cuts = 5 + Math.floor(hash(seed, 1) * 3), v = new THREE.Vector3();
    for (let k = 0; k < cuts; k++) {
      const a = hash(seed * 13 + k, 5) * Math.PI * 2, c = hash(seed * 7 + k, 9) * 1.4 - .45, sb = Math.sqrt(1 - c * c);
      planes.push([new THREE.Vector3(sb * Math.cos(a), c, sb * Math.sin(a)), .5 + hash(seed + k, 3) * .32]);
    }
    planes.push([new THREE.Vector3(0, -1, 0), .42]);
    const cutOf = new Int16Array(count).fill(-1);
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(p, i);
      v.multiplyScalar(.84 + noise(v.x * 2.3 + seed * 5, v.z * 2.3 + v.y * 1.7) * .26 + noise(v.x * 6 + seed, v.y * 6 + v.z * 3) * .06);
      for (let k = 0; k < planes.length; k++) { const n = planes[k][0], e = v.dot(n) - planes[k][1]; if (e > 0) { v.addScaledVector(n, -e); cutOf[i] = k; } }
      v.y *= flatten;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    // Smooth normals keyed by position (the icosahedron is non-indexed).
    const key = i => Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
    const sums = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    const faceNormals = [];
    for (let f = 0; f < count; f += 3) {
      a.fromBufferAttribute(p, f); b.fromBufferAttribute(p, f + 1); c.fromBufferAttribute(p, f + 2);
      n.subVectors(c, b).cross(a.clone().sub(b)).normalize(); faceNormals.push(n.clone());
      for (let k = 0; k < 3; k++) { const id = key(f + k), s = sums.get(id) || new THREE.Vector3(); s.add(n); sums.set(id, s); }
    }
    const normals = new Float32Array(count * 3), colors = new Float32Array(count * 3), color = new THREE.Color();
    for (let f = 0; f < count; f += 3) {
      const flat = cutOf[f] >= 0 && cutOf[f] === cutOf[f + 1] && cutOf[f] === cutOf[f + 2];
      for (let k = 0; k < 3; k++) {
        const i = f + k, nn = flat ? faceNormals[f / 3] : sums.get(key(i)).clone().normalize();
        normals.set([nn.x, nn.y, nn.z], i * 3);
        v.fromBufferAttribute(p, i);
        color.copy(rockDark).lerp(rockPale, .22 + lighten + noise(v.x * 3 + seed * 3, v.z * 3 + v.y * 2) * .34 + (flat ? .10 : 0));
        colors.set([color.r, color.g, color.b], i * 3);
      }
    }
    g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeBoundingSphere();
    return g;
  }
  const shoreObstacles = [];
  function buildShoreRocks() {
    const geometries = [makeRockGeometry(1, 2, .66), makeRockGeometry(2, 2, .58)], pebbleGeometry = makeRockGeometry(3, 0, .62, .22);
    const placements = [[], []], pebbles = [], point = { x: 0, y: 0, z: 0 };
    const tint = new THREE.Color();
    const clusterCount = lite ? 40 : 70;
    for (let c = 0; c < clusterCount; c++) {
      const t0 = .03 + hash(c, 91) * .80, side = hash(c, 92) < .5 ? -1 : 1;
      const members = 1 + Math.floor(hash(c, 93) * 4.6);
      for (let k = 0; k < members; k++) {
        const s = c * 7 + k, big = k === 0;
        const size = big ? 2.6 + Math.pow(hash(s, 94), 1.3) * 5.8 : .9 + hash(s, 95) * 2.4;
        const t = Math.min(.86, Math.max(.02, t0 + (big ? 0 : (hash(s, 96) - .5) * 14 / 1880)));
        const f = rowFrame(t, side);
        const d = big ? -size * (.25 + hash(c, 97) * .5) + hash(c, 98) * 3 : -size * .6 + hash(s, 99) * 7;
        bankPoint(f, Math.max(0, d), point);
        let x = point.x, z = point.z;
        if (d < 0) { x = f.center.x + f.normal.x * f.side * (f.r0 + d); z = f.center.z + f.normal.z * f.side * (f.r0 + d); }
        const ground = d < 0 ? bankHeight(f, d, x, z) : point.y;
        const sy = size * (.78 + hash(s, 100) * .42), y = ground + sy * .2;
        placements[s % 2].push({ x, y, z, sx: size * (.9 + hash(s, 101) * .5), sy, sz: size * (.85 + hash(s, 102) * .45), ry: hash(s, 103) * 6.28, rx: (hash(s, 104) - .5) * .35, rz: (hash(s, 105) - .5) * .35 });
        shoreObstacles.push({ x, z, t, r: size * 1.05, base: ground, top: y + sy * .6 });
      }
    }
    // A few rocks break the open channel (kept well off the camera line).
    for (let k = 0; k < (lite ? 5 : 9); k++) {
      const t = .06 + hash(k, 301) * .74, side = hash(k, 302) < .5 ? -1 : 1, f = rowFrame(t, side);
      const o = f.w * (.5 + hash(k, 303) * .3), size = 1.4 + hash(k, 304) * 1.8;
      const x = f.center.x + f.normal.x * side * o, z = f.center.z + f.normal.z * side * o, base = -2.6, sy = size * .9, y = base + sy * .95;
      placements[k % 2].push({ x, y, z, sx: size * 1.2, sy, sz: size, ry: hash(k, 305) * 6.28, rx: 0, rz: (hash(k, 306) - .5) * .3 });
      shoreObstacles.push({ x, z, t, r: size * 1.1, base, top: y + sy * .6 });
    }
    // Pebbles on the wet shelf and scree fans at the foot of the walls.
    const pebbleCount = lite ? 700 : 1600;
    for (let i = 0; i < pebbleCount; i++) {
      const scree = hash(i, 202) < .36, side = hash(i, 208) < .5 ? -1 : 1;
      let t, d, size;
      if (scree) {
        const fan = Math.floor(hash(i, 203) * 22);
        t = .04 + hash(fan, 204) * .78 + (hash(i, 205) - .5) * .012;
        const f0 = rowFrame(t, side);
        d = Math.max(1, f0.cliffStart - 3 + Math.pow(hash(i, 206), .8) * 10);
        size = .35 + Math.pow(hash(i, 209), 2) * 1.3;
      } else {
        t = .025 + hash(i, 201) * .83;
        d = -.6 + Math.pow(hash(i, 207), 1.3) * 15;
        size = .28 + Math.pow(hash(i, 210), 2) * 1.0;
      }
      const f = rowFrame(t, side);
      bankPoint(f, Math.max(0, d), point);
      let x = point.x, z = point.z;
      if (d < 0) { x = f.center.x + f.normal.x * side * (f.r0 + d); z = f.center.z + f.normal.z * side * (f.r0 + d); }
      const ground = d < 0 ? bankHeight(f, d, x, z) : point.y;
      pebbles.push({ x, y: ground + size * .08, z, sx: size * (.9 + hash(i, 211) * .6), sy: size * (.7 + hash(i, 212) * .5), sz: size * (.9 + hash(i, 213) * .5), ry: hash(i, 214) * 6.28, rx: (hash(i, 215) - .5) * .6, rz: (hash(i, 216) - .5) * .6 });
    }
    const dummy = new THREE.Object3D(), meshes = [];
    const instance = (geometry, list, name, seed) => {
      const mesh = new THREE.InstancedMesh(geometry, rockMaterial, list.length);
      list.forEach((q, i) => {
        dummy.position.set(q.x, q.y, q.z); dummy.rotation.set(q.rx, q.ry, q.rz); dummy.scale.set(q.sx, q.sy, q.sz);
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        const shade = (seed === 100 ? .86 : .74) + hash(i + seed, 400) * (seed === 100 ? .26 : .40);
        tint.setRGB(shade * (.97 + hash(i, 401) * .05), shade, shade * (1 + hash(i, 402) * .05));
        mesh.setColorAt(i, tint);
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere(); mesh.name = name; scene.add(mesh); meshes.push(mesh);
      return mesh;
    };
    instance(geometries[0], placements[0], 'Fractured shore boulders A', 0);
    instance(geometries[1], placements[1], 'Fractured shore boulders B', 50);
    instance(pebbleGeometry, pebbles, 'Wet shelf pebbles and scree fans', 100);
    const triangles = meshes.reduce((sum, m) => sum + m.geometry.attributes.position.count / 3 * m.count, 0);
    return { meshes, slabGeometry: geometries[0], stats: { boulders: placements[0].length + placements[1].length, pebbles: pebbles.length, triangles } };
  }
  // Water side of the junction: per-vertex (bed height, inward distance to the
  // bank, wall height). The shared water shader reads it only on river meshes.
  function bakeMainShore() {
    const g = river.mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv;
    const { lengthSegments, widthSegments } = river.mesh.userData.journeyRiver, columns = widthSegments + 1;
    const data = new Float32Array(pos.count * 3), point = { x: 0, y: 0, z: 0 };
    for (let row = 0; row <= lengthSegments; row++) {
      const t = row / lengthSegments, frames = { '-1': rowFrame(t, -1), '1': rowFrame(t, 1) };
      const wall = { '-1': bankPoint(frames['-1'], 42, point).y, '1': bankPoint(frames['1'], 42, point).y };
      for (let col = 0; col < columns; col++) {
        const i = row * columns + col, o = (uv.getX(i) * 2 - 1) * frames['1'].w * mainOverlap, side = o < 0 ? -1 : 1, f = frames[side];
        const d = Math.abs(o) - f.r0;
        data[i * 3] = bankHeight(f, d, pos.getX(i), pos.getZ(i));
        data[i * 3 + 1] = -d;
        data[i * 3 + 2] = Math.max(0, wall[side]);
      }
    }
    const length = curve.getLength();
    for (const ob of shoreObstacles) {
      const span = Math.ceil((ob.r * 1.6 + 4) / length * lengthSegments), center = Math.round(ob.t * lengthSegments);
      for (let row = Math.max(0, center - span); row <= Math.min(lengthSegments, center + span); row++) for (let col = 0; col < columns; col++) {
        const i = row * columns + col, dist = Math.hypot(pos.getX(i) - ob.x, pos.getZ(i) - ob.z), q = dist / ob.r;
        if (q > 1.6) continue;
        const top = ob.base + (ob.top - ob.base) * Math.sqrt(Math.max(0, 1 - q * q));
        data[i * 3] = Math.max(data[i * 3], q < 1 ? top : -.3 - 1.3 * (q - 1) / .6);
        data[i * 3 + 1] = Math.min(data[i * 3 + 1], Math.max(0, dist - ob.r * .85));
      }
    }
    g.setAttribute('aShore', new THREE.BufferAttribute(data, 3));
  }
  if (shore) terrainVertices += buildShoreBanks();

  // Irregular, partially submerged talus breaks the continuous shoreline into individual masses.
  let boulderGeometry = null;
  if (!shore) {
  boulderGeometry = new THREE.IcosahedronGeometry(1, 2);
  const bp = boulderGeometry.attributes.position;
  const bc = [];
  for (let i = 0; i < bp.count; i++) {
    const x=bp.getX(i), y=bp.getY(i), z=bp.getZ(i);
    const rough=.82+noise(x*7+9,z*7+y*3)*.32;
    bp.setXYZ(i,x*rough,y*rough,z*rough);
    const c=rockDark.clone().lerp(rockPale,.27+noise(x*4+20,z*5)*.30);bc.push(c.r,c.g,c.b);
  }
  boulderGeometry.setAttribute('color',new THREE.Float32BufferAttribute(bc,3));
  const bn=[];
  for(let i=0;i<bp.count;i++){const n=new THREE.Vector3(bp.getX(i),bp.getY(i),bp.getZ(i)).normalize();bn.push(n.x,n.y,n.z);}
  boulderGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(bn,3));
  const boulders = new THREE.InstancedMesh(boulderGeometry,rockMaterial,116);
  const dummy = new THREE.Object3D();
  for(let i=0;i<116;i++){
    const side=i%2===0?-1:1;
    const t=.03+hash(i,9)*.79, p=curve.getPointAt(t), tangent=curve.getTangentAt(t);
    const size=1.8+Math.pow(hash(i,11),2)*7.5;
    const nx=-tangent.z*side, nz=tangent.x*side;
    const r=widthAt(t)+size*.78+hash(i,71)*9;
    dummy.position.set(p.x+nx*r,-.7+size*.22,p.z+nz*r);
    dummy.rotation.set(hash(i,51)*.8,hash(i,26)*6.28,hash(i,47)*.8);
    dummy.scale.set(size*(.8+hash(i,36)*.8),size*(.7+hash(i,40)*.9),size*(.8+hash(i,44)));
    dummy.updateMatrix();boulders.setMatrixAt(i,dummy.matrix);
  }
  boulders.name='Broken slate and shore talus';scene.add(boulders);
  }
  const shoreRocks = shore ? buildShoreRocks() : null;
  if (shore) boulderGeometry = shoreRocks.slabGeometry;

  // A second atmospheric range closes the far horizon without loading large terrain assets.
  const distantGeometry = new THREE.PlaneGeometry(3800, 1500, 150, 20);
  distantGeometry.rotateX(-Math.PI / 2);
  const dp = distantGeometry.attributes.position;
  const dc = [];
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i), z = dp.getZ(i) - 2960;
    const n = fbm(x * .004 + 21, z * .005);
    const range = Math.pow(Math.abs(Math.sin(x * .0032 + n * 2.8)), .63);
    const envelope = smooth(-2210, -2760, z);
    const pass = smooth(80, 550, Math.abs(x + 165));
    dp.setXYZ(i, x, -14 + envelope * (50 + range * 205 + n * 125) * (.17 + pass * .83), z);
    const c = rockPale.clone().lerp(new THREE.Color('#b8cbdc'), .55);
    dc.push(c.r, c.g, c.b);
  }
  distantGeometry.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
  distantGeometry.computeVertexNormals(); distantGeometry.computeBoundingSphere();
  const distantMaterial=rockMaterial.clone();
  distantMaterial.onBeforeCompile=rockMaterial.onBeforeCompile;
  distantMaterial.customProgramCacheKey=rockMaterial.customProgramCacheKey;
  distantMaterial.transparent=true;distantMaterial.depthWrite=false;
  const distant = new THREE.Mesh(distantGeometry, distantMaterial);
  distant.name = 'Atmospheric far range'; scene.add(distant);

  // All five rivers exist in this same world, using the original water and rock.
  if (shore) bakeMainShore();
  const watershed=shore
    ?createCanyonWatershed(THREE,{curve,widthAt,createRiver,rockMaterial,boulderGeometry,rockDark,rockPale,flowConfig,terrainConfig,shoreDetail:true,mainOverlap})
    :createCanyonWatershed(THREE,{curve,widthAt,createRiver,rockMaterial,boulderGeometry,rockDark,rockPale,flowConfig,terrainConfig});
  if (shore) shoreUniforms.uFrostRange.value.set(watershed.stats.maxHeight * .40, watershed.stats.maxHeight * .80);
  scene.add(watershed.group);
  const shotDirection=new THREE.Vector3(),shotFocus=new THREE.Vector3();
  const overviewDirection=new THREE.Vector3(-.055,-.37,-.927).normalize();
  const overviewFocus=new THREE.Vector3(0,70,-1780);
  const dayZenith=new THREE.Color('#779abf'),nightZenith=new THREE.Color('#06132c');
  const dayHorizon=new THREE.Color('#d4dee5'),nightHorizon=new THREE.Color('#102748');
  const dayFog=new THREE.Color('#b5c7d7'),nightFog=new THREE.Color('#294b79');
  const daySun=new THREE.Color('#ffead0'),nightSun=new THREE.Color('#7dacf0');
  const dayHemi=new THREE.Color('#dce9f4'),nightHemi=new THREE.Color('#8cbafa');
  const dayGround=new THREE.Color('#53616b'),nightGround=new THREE.Color('#08172d');
  const dayRim=new THREE.Color('#9bbddd'),iceRim=new THREE.Color('#bfd3e2');
  const iceZenith=new THREE.Color(),iceHorizon=new THREE.Color(),iceFog=new THREE.Color();
  const iceSun=new THREE.Color('#e8edf1'),iceHemi=new THREE.Color('#c9d7e3'),iceGround=new THREE.Color('#60717e');
  const smoother=n=>{const t=clamp01(n);return t*t*t*(t*(t*6-15)+10)};
  const forward = new THREE.Vector3(), next = new THREE.Vector3();
  const look = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const pathLength = curve.getLength();
  const stats = { pathLength, terrainVertices: terrainVertices + dp.count, bankSegments: longitudinal, riverHalfWidthMin: 15.8, maxBankRadians: .035, routeEnd: .865, riverCount:5, watershed:watershed.stats };
  if (shore) stats.shore = { lite, bankRows: longitudinal + 1, bankColumns: lateral + 1, bankTriangles: longitudinal * lateral * 4, ...shoreRocks.stats };
  function update(progress, time = 0, reduceMotion = false, reveal = 0, confluence = 0) {
    let route=clamp01(progress);
    if(route>.90){const u=(route-.90)/.10;route=.90+.10*(u+u*u-u*u*u);}
    const t=route*.865;
    const point = curve.getPointAt(t);
    forward.copy(curve.getTangentAt(t)).normalize();
    next.copy(curve.getTangentAt(Math.min(1, t + 28 / pathLength))).normalize();
    right.crossVectors(forward, worldUp).normalize();
    const turn = forward.x * next.z - forward.z * next.x;
    const bank = reduceMotion ? 0 : THREE.MathUtils.clamp(turn * .32, -.035, .035);
    up.copy(worldUp).applyAxisAngle(forward, bank);
    camera.up.copy(up);
    camera.position.copy(point);
    camera.position.y = 2.4 + (reduceMotion ? 0 : Math.sin(t * pathLength * .015) * .05 + Math.sin(t * pathLength * .007) * .035);
    look.copy(curve.getPointAt(Math.min(1, t + 29 / pathLength)));
    look.y = 2.9;
    camera.fov = 64 + 5 * smooth(.04, .55, t);
    // Lift first, then ease backward: the river under the viewer remains the
    // central river in the wider landscape. There is no scene swap or dissolve.
    const u=clamp01(reveal),tilt=smoother(u/.60),dolly=smoother((u-.08)/.92),framing=smoother((u-.18)/.70);
    // Portrait retains a readable central confluence instead of retreating 10km.
    const finalFov=camera.aspect<.75?61:56;
    const fitDistance=THREE.MathUtils.clamp(2250/(Math.tan(THREE.MathUtils.degToRad(finalFov*.5))*camera.aspect)+1100,4400,6500);
    const closeDistance=camera.position.distanceTo(look);
    // Let the last dolly clear the valley shoulders so the five paths remain readable.
    // The low first-person reach and initial lift retain their original framing.
    const riverReadability=flowConfig!==null?smoother((u-.40)/.60):0;
    overviewDirection.set(-.055,THREE.MathUtils.lerp(-.37,-.48,riverReadability),THREE.MathUtils.lerp(-.927,-.876,riverReadability)).normalize();
    shotDirection.copy(look).sub(camera.position).normalize().lerp(overviewDirection,tilt).normalize();
    shotFocus.copy(look).lerp(overviewFocus,framing);
    const joining=smoother(confluence);shotFocus.z-=joining*1060;shotFocus.y-=joining*230;
    shotDirection.x-=joining*.015;shotDirection.y+=joining*.025;shotDirection.normalize();
    camera.position.copy(shotFocus).addScaledVector(shotDirection,-THREE.MathUtils.lerp(closeDistance,fitDistance*(1-joining*.12),dolly));
    camera.up.lerp(worldUp,tilt).normalize();camera.lookAt(shotFocus);
    camera.fov=THREE.MathUtils.lerp(camera.fov,finalFov,dolly);
    // Higher aerial near plane retains depth precision for light ribbons above water.
    camera.near=THREE.MathUtils.lerp(.10,flowConfig!==null?32:1,dolly);camera.far=THREE.MathUtils.lerp(6200,Math.max(16000,fitDistance+9000),dolly);
    scene.fog.density=THREE.MathUtils.lerp(.00172,.42/fitDistance,smoother(u/.80));
    const mountainLight=smoother((u-.25)/.65);
    atmosphere.uOverview.value=mountainLight;
    if(shore) {
      shoreUniforms.uShoreWet.value=shoreNumber('wet',0,2);
      shoreUniforms.uShoreFoam.value=shoreNumber('foam',0,2);
      shoreUniforms.uRockMicro.value=shoreNumber('micro',0,2.5);
      shoreUniforms.uRockStrata.value=shoreNumber('strata',0,2.5);
      shoreUniforms.uRockCrease.value=shoreNumber('crease',0,2.5);
      shoreUniforms.uRockFrost.value=shoreNumber('frost',0,1.5);
      shoreUniforms.uShoreFoamColor.value.set(shore.foamColor ?? SHORELINE_DEFAULTS.foamColor);
      shoreUniforms.uFrostColor.value.set(styleValue('mistColor')).lerp(shoreUniforms.uShoreFoamColor.value,.35);
    }
    if(watershedStyle) {
      atmosphere.uIceRockTint.value.set(styleValue('rockColor'));
      atmosphere.uIceExposure.value=styleNumber('exposure',.5,1.6);
      atmosphere.uIceRelief.value=styleNumber('relief',0,1.8);
      atmosphere.uIceHaze.value=styleNumber('haze',.3,1.8);
      iceZenith.set(styleValue('skyColor'));
      iceFog.set(styleValue('mistColor'));
      iceHorizon.copy(iceFog).lerp(dayHorizon,.25);
    }
    hemisphere.intensity=THREE.MathUtils.lerp(2.3,watershedStyle?.62:.35,mountainLight);
    hemisphere.color.copy(dayHemi).lerp(watershedStyle?iceHemi:nightHemi,mountainLight);
    hemisphere.groundColor.copy(dayGround).lerp(watershedStyle?iceGround:nightGround,mountainLight);
    sunlight.intensity=THREE.MathUtils.lerp(2.65,watershedStyle?2.25:2.0,mountainLight);
    sunlight.color.copy(daySun).lerp(watershedStyle?iceSun:nightSun,mountainLight);
    rim.intensity=THREE.MathUtils.lerp(1.4,watershedStyle?.72:.48,mountainLight);
    rim.color.copy(dayRim).lerp(watershedStyle?iceRim:dayRim,mountainLight);
    sky.material.uniforms.zenith.value.copy(dayZenith).lerp(watershedStyle?iceZenith:nightZenith,mountainLight);
    sky.material.uniforms.horizon.value.copy(dayHorizon).lerp(watershedStyle?iceHorizon:nightHorizon,mountainLight);
    scene.fog.color.copy(dayFog).lerp(watershedStyle?iceFog:nightFog,mountainLight);
    scene.background.copy(dayFog).lerp(watershedStyle?iceZenith:nightZenith,mountainLight);
    // The close-up horizon yields to the actual continuous distant terrain.
    distantMaterial.opacity=1-smoother((u-.015)/.20);distant.visible=distantMaterial.opacity>.001;
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
    river.update(time);if(watershed.update(time,u,confluence,reduceMotion))sunlight.shadow.needsUpdate=true;
  }
  function resize(width, height) {
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
  function dispose() {
    watershed.group.removeFromParent();watershed.dispose();
    scene.traverse(object => { if (object.isMesh && object !== river.mesh) object.geometry.dispose(); });
    distantMaterial.dispose();rockMaterial.dispose(); sky.material.dispose(); river.dispose?.();
  }
  update(0, 0, true);
  return { scene, camera, curve, widthAt, river, rivers:[river,...watershed.rivers], watershed, update, resize, stats, dispose };
}


