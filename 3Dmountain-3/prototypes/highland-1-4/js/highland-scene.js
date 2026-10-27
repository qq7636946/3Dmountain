/* index1-4 · the highland landscape (2026-10-22).
   Replaces index1-1's procedural canyon/watershed (js/water-journey-scene-463.js) for this page only:
   the copy of main.js in this folder calls createHighlandSceneAsync() where index1-1 calls
   createJourneySceneAsync(), and gets back the same shape it already drives — scene, camera, curve,
   widthAt, stats.pathLength, update(), resize(), ready.
   The world comes from the Blender build (prototypes/highland-world-20261022, the key visual's island grown
   into a 4800² range with a bay, sea-loch glens, four branching paths and a canyon). The runtime copy now
   removes that central island to open the river mouth; the Blender source remains intact. Look: the key
   visual's material with the client's changes of 2026-10-22 — grass/moss cut to half (grassCut .18,
   measured), the sky lifted (SKY 1.25) — the same sky, haze and silver Water.js sea.
   Camera, by the downstream clock q (the one index1-1's chapters use):
     1.40–1.98  the island, dissolving in behind the LOGO fly-through (the key visual's view)
     → 3.86     round the island and into the loch glen (the trunk)
     CONVERGENCE (3.86, rest 4.70)   up the glen, through the confluence, into the canyon
     VALUE       (5.88, rest 6.85)   out of the canyon into the northern valley, climbing
     PERSPECTIVE (8.16, rest 8.96)   the rise and the turn: high over the range, looking south
     STRATEGIES  (9.66, rest 10.15)  the four paths converging on the island's bay and the sea;
                 panels 10.66 / 11.38 / 12.10 / 12.82 look along paths A / B / C / D; 13.8 the whole. */
import { Water } from 'three/addons/objects/Water.js';

const ASSETS = new URL('../assets/', import.meta.url).href;
const TEX = new URL('../assets/textures/', import.meta.url).href;   // own copies (Poly Haven CC0 + the terrain's erosion normal), see textures/source-manifest.json
// children inherit this module's build stamp (?v=…), so a rebuild reaches every browser cache
const V = new URL(import.meta.url).search;
const SKY = 1.25;            // client: 天空要再更亮一點
/* the look (client 2026-10-22: 整體設計風格色調陽光明亮一點). 'confluence' is the default; 'sunny' and 'overcast' preserve the earlier lighting options, with 'overcast' approved
   before it, kept value for value as the fallback (?look=overcast restores it). */
const LOOKS = {
  overcast: { haze: '#bfcbcb', sunDir: [-650, 300, 420], sun: ['#fff0d8', 2.8], hemi: ['#d3e0e8', '#3a3f30', .9, .62],
    horizon: [.72, .79, .78], zenith: [.17, .33, .46], cloudCut: [.37, .68], cloudAmt: .92, cloudShade: [.36, .43, .47], cloudLit: [.92, .93, .87],
    glow: [.22, .19, .13], glowWide: [0, 0, 0], disc: 0, fog: [.00042, .00019], water: 0xbfd0d3, waterBlue: [.16, .33, .50], waterBlueAmt: .26, tint: [1, 1, 1], vegTint: [1, 1, 1], ao: 1, strataFar: [.5, 1300, 3400] },
  // sunny (art-direction pass): side light from the west, cool blue shade, sunlit warm rock, clearer air, blue water;
  // the grass gets a gentler lift than the rock so the halved grass does not come back through brightness
  sunny: { haze: '#c8dbe9', sunDir: [-800, 560, 120], sun: ['#ffe6c2', 4.6], hemi: ['#c8e0fa', '#8c8778', 4.0, 2.1],
    horizon: [.80, .86, .89], zenith: [.24, .47, .76], cloudCut: [.47, .76], cloudAmt: .78, cloudShade: [.66, .72, .80], cloudLit: [1, .98, .94],
    glow: [.40, .32, .18], glowWide: [.09, .07, .035], disc: 2.2, fog: [.00026, .00011], water: 0x2f7891, waterBlue: [.05, .30, .50], waterBlueAmt: .30, lines: 'ice', waterDiffuse: .07,
    tint: [1.65, 1.56, 1.38], vegTint: [.95, .92, .84], ao: .75, strataFar: [.85, 1000, 2800],
    grassCut: .25, layers: .55 },
  // Open confluence: sunlit slate and restrained blue water; no separate island in the river mouth.
  confluence: { sky: 1.12, haze: '#b5c6d0', sunDir: [-800, 520, 180], sun: ['#f1e9db', 4.1], hemi: ['#b9cfe2', '#6d7377', 1.65, .88],
    horizon: [.73, .81, .85], zenith: [.13, .30, .47], cloudCut: [.47, .76], cloudAmt: .62, cloudShade: [.52, .61, .70], cloudLit: [.94, .95, .94],
    glow: [.25, .22, .16], glowWide: [.05, .045, .03], disc: 1.4, fog: [.00026, .00007], water: 0x39586d, waterBlue: [.10, .19, .27], waterBlueAmt: .16, lines: 'confluence', waterDiffuse: .06,
    tint: [1.30, 1.32, 1.32], vegTint: [.78, .84, .83], ao: .88, strataFar: [.85, 1000, 2800], grassCut: .25, layers: 0 }   // grass ~12% of the land on screen (was ~20%: 客戶 2026-10-22 草綠地可以再少一點)
};

export async function createHighlandSceneAsync(THREE, opts = {}) {
  const lite = !!opts.lite, renderer = opts.renderer;
  const lookName = opts.look || new URLSearchParams(location.search).get('look') || 'confluence', LOOK = LOOKS[lookName] || LOOKS.confluence;
  const showEverest = new URLSearchParams(location.search).get('terrain') === 'everest';
  const SKY = LOOK.sky ?? 1.25;
  const [{ createTerrainMaterial }, { createLightLines }] = await Promise.all([import('./highland-material.js' + V), import('./highland-lights.js' + V)]);
  const { createValleyClouds } = await import('./highland-valley-clouds.js' + V);
  const scene = new THREE.Scene();
  const HAZE = new THREE.Color(LOOK.haze).lerp(new THREE.Color('#ffffff'), (SKY - 1) * .55);
  /* the sky brightens its own horizon by SKY; the fog must end on exactly that colour, or distant land and
     water meet the sky at a hard line (QA 2026-10-22) */
  const FOGC = HAZE.clone().lerp(new THREE.Color('#ffffff'), (SKY - 1) * .35).multiplyScalar(1 + (SKY - 1) * .5);
  scene.background = FOGC.clone();
  scene.fog = new THREE.FogExp2(FOGC.clone(), .00045);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .5, 14000);

  const sunDir = new THREE.Vector3(...LOOK.sunDir).normalize();
  const sun = new THREE.DirectionalLight(...LOOK.sun);
  // 2048²: a 4096² PCF-soft map held ~134 MB of GPU memory, more than all the terrain (optimisation 2026-10-22)
  sun.castShadow = true; sun.shadow.mapSize.setScalar(2048);
  sun.shadow.bias = -.00045; sun.shadow.normalBias = 2.0; sun.shadow.radius = 3;
  sun.target.position.set(0, 0, -1300); sun.position.copy(sun.target.position).addScaledVector(sunDir, 2600);
  Object.assign(sun.shadow.camera, { left: -2700, right: 2700, top: 2700, bottom: -2700, near: 50, far: 6000 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.autoUpdate = false;                 // the land never moves: one shadow pass, after it is built
  sun.shadow.camera.layers.enable(1);            // the shadow is cast by layer-1 copies of the light set (see the build)
  // main.js tone-maps with Neutral (the key visual used ACES, which deepens shadows): a lower fill brings the depth back
  const hemi = new THREE.HemisphereLight(LOOK.hemi[0], LOOK.hemi[1], LOOK.hemi[3]);
  scene.add(sun, sun.target, hemi);

  // the key visual's sky, lifted, always centred on whichever camera draws it (the mirror's too)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6500, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    uniforms: { sunDirection: { value: sunDir.clone() }, haze: { value: HAZE.clone() }, uSky: { value: SKY },
      uHorizon: { value: new THREE.Vector3(...LOOK.horizon) }, uZenith: { value: new THREE.Vector3(...LOOK.zenith) },
      uCloudCut: { value: new THREE.Vector2(...LOOK.cloudCut) }, uCloudAmt: { value: LOOK.cloudAmt },
      uCloudShade: { value: new THREE.Vector3(...LOOK.cloudShade) }, uCloudLit: { value: new THREE.Vector3(...LOOK.cloudLit) },
      uGlow: { value: new THREE.Vector3(...LOOK.glow) }, uGlowWide: { value: new THREE.Vector3(...LOOK.glowWide) }, uDisc: { value: LOOK.disc } },
    // drawn last, pinned to the far plane: only the pixels no land or water covered pay for the sky
    vertexShader: `varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w * .99999; }`,
    fragmentShader: `
      varying vec3 vDirection; uniform vec3 sunDirection; uniform vec3 haze; uniform float uSky;
      uniform vec3 uHorizon, uZenith, uCloudShade, uCloudLit, uGlow, uGlowWide; uniform vec2 uCloudCut; uniform float uCloudAmt, uDisc;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y); }
      float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= .5; } return s; }
      void main() {
        vec3 d = normalize(vDirection); float up = max(d.y, 0.);
        vec3 c = mix(uHorizon, uZenith, pow(up, .48));
        vec2 p = d.xz / (abs(d.y) + .22) * 2.2;
        float clouds = smoothstep(uCloudCut.x, uCloudCut.y, fbm(p + vec2(4., 7.))) * smoothstep(.02, .30, d.y);   // clouds thin out well above the horizon
        float lit = smoothstep(.40, .64, fbm(p + vec2(4.15, 7.13)));
        c = mix(c, mix(uCloudShade, uCloudLit, lit), clouds * uCloudAmt);
        float sd = max(dot(d, sunDirection), 0.);
        c += (uGlow * pow(sd, 14.) + uGlowWide * pow(sd, 3.)) * (1. - clouds * .6);
        c += vec3(1., .97, .9) * uDisc * smoothstep(.99955, .99985, sd) * (1. - clouds * .85);   // the sun itself
        c = mix(c, haze, smoothstep(.20, -.005, d.y));   // a tall, soft haze band, all haze at the horizon: meets the fog seamlessly
        c = mix(c, vec3(1.), clamp(uSky - 1., 0., 1.) * .35) * mix(1., uSky, .5);
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder = 100; sky.frustumCulled = false;
  // three has already computed this frame's matrices when this runs: update ours, or the sky stays centred on the
  // previous pass's camera (in the aerials the mirror camera, 2600 below — a band at the top of the frame)
  sky.onBeforeRender = (r, s, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(); };
  scene.add(sky);

  // ---- the world: height field + river lines -----------------------------------------------
  /* the field ships compressed: 5 cm steps, left-neighbour deltas split into high/low byte planes, gzip
     (desktop 2049² 8.4 MB → 3.2 MB, phones 1025² 2.1 MB → 0.9 MB); the browser gunzips it natively */
  const meta = await fetch(ASSETS + 'world-meta.json' + V).then(r => r.json());
  const grid = lite ? meta.liteGrid : meta.grid;
  const { n: N, x0: X0, ztop: ZTOP, dx: DX } = grid, OFF = meta.encoding.offset, SC = meta.encoding.scale;
  const H16 = await loadField(ASSETS + (lite ? meta.files.lite : meta.files.full) + V, N);
  // The Blender source deliberately restores its hero island in [-600,600]² after carving the bay.
  // Remove that one feature in the decoded working copy, before ANY consumer reads it: camera clearance,
  // river ribbons, shoreline foam, reflected terrain and both mesh densities all share the same seabed.
  // Source .dz / Blender assets stay unchanged. The 600–720 shoulder is already submerged in the source;
  // the smooth blend cannot introduce a visible square shoreline or raise the surrounding terrain.
  const confluence = carveOpenBay(H16, grid, meta.encoding);
  const heightBuf = H16.buffer;
  const demJob = showEverest ? (async()=>{
    const [meta,resp] = await Promise.all([fetch(ASSETS+'everest-dem.json'+V).then(r=>r.json()),fetch(ASSETS+(lite?'everest-dem-lite.bin.gz':'everest-dem.bin.gz')+V)]);
    if(!resp.ok)throw Error('Everest elevation '+resp.status);
    const raw = await new Response(resp.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const grid = lite?meta.lite:meta.full;
    if(raw.byteLength!==grid.width*grid.height*2)throw Error('Everest elevation dimensions');
    return {data:raw,grid:{n:grid.width,m:grid.height}};
  })() : Promise.resolve(null);
  const ground = (x, z) => {   // bay-adjusted height, mirrored outside the world; for camera clearance
    let fx = Math.abs((x - X0) / DX), fz = Math.abs((ZTOP - z) / DX); const m = N - 1;
    if (fx > m) fx = Math.max(0, 2 * m - fx); if (fz > m) fz = Math.max(0, 2 * m - fz);
    fx = Math.min(fx, m - .001); fz = Math.min(fz, m - .001);
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * N + ix;
    return ((H16[i] * (1 - tx) + H16[i + 1] * tx) * (1 - tz) + (H16[i + N] * (1 - tx) + H16[i + N + 1] * tx) * tz) * SC + OFF;
  };

  // ---- the flight: over the open bay, up the trunk glen, through the canyon on path B ---------
  const trunk = meta.rivers.TRUNK.filter(p => p[1] < -620);
  const pathB = meta.rivers.B.filter(p => p[1] < -1700 && p[1] > -3420);
  const lead = [[520, 760], [700, 250], [560, -380], [170, -650]];
  const ground2 = lead.concat(trunk, pathB);
  const heightAlong = z => z > -650 ? THREE.MathUtils.lerp(26, 75, THREE.MathUtils.smoothstep(z, -650, 760))
    : z > -1950 ? 24 : z > -3020 ? 17 : THREE.MathUtils.lerp(17, 230, THREE.MathUtils.smoothstep(-z, 3000, 3400));   // VALUE: up out of the canyon, over its rim
  const curve = new THREE.CatmullRomCurve3(ground2.map(([x, z]) => new THREE.Vector3(x, heightAlong(z), z)), false, 'centripetal', .5);
  const pathLength = curve.getLength();
  const arcAtZ = z => {   // arc length where the flight first crosses depth z (going north)
    const n = 600; for (let i = 0; i <= n; i++) { const p = curve.getPointAt(i / n); if (p.z <= z) return i / n * pathLength; } return pathLength;
  };
  // q → arc length: a monotone cubic through the chapter anchors, so speed never jumps
  const qs = [1.404, 1.98, 3.86, 4.70, 5.88, 6.40, 6.85];
  const ss = [0, 140, arcAtZ(-1000), arcAtZ(-2250), arcAtZ(-2620), arcAtZ(-2860), arcAtZ(-3010)];
  const flightS = monotone(qs, ss);
  const widthAt = () => 40;

  // after the flight: the rise, the turn and the aerial over the four paths (q, x, y, z, yaw°, pitch°, fov)
  const AERIAL = [
    [7.60, 40, 430, -3120, 6, -34, 56],          // straight up out of the canyon, still looking up the valley
    [8.96, -300, showEverest ? 2300 : 1020, showEverest ? -4800 : -3700, 168, showEverest ? -24 : -25, showEverest ? 60 : 54],
    [10.15, -380, 1320, -3780, 172, -29.3, 50],
    [10.66, -380, 1320, -3780, 204, -27, 50],     // path A, the north-west glen
    [11.38, -330, 1300, -3760, 179, -35, 50],     // path B, the canyon
    [12.10, -300, 1300, -3760, 142, -28, 50],     // path C, north-east
    [12.82, -120, 1310, -3700, 150, -24, 50],     // path D, the eastern loch
    [13.80, -260, 1240, -3640, 174, -22, 50]      // one vision: all four into the bay, the island, the sea
  ];

  const pose = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, fov: 58 };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function flightPose(q, out) {
    const s = THREE.MathUtils.clamp(flightS(q), 0, pathLength);
    curve.getPointAt(s / pathLength, out.pos);
    // climbing out of the canyon (VALUE) the eye reaches far up the valley instead of dropping into it
    const rise = THREE.MathUtils.smoothstep(out.pos.y, 30, 230);
    curve.getPointAt(Math.min(1, (s + THREE.MathUtils.lerp(150, 520, rise)) / pathLength), _a);
    if (rise > 0 && s + 520 > pathLength) _a.addScaledVector(curve.getTangentAt(1), s + 520 - pathLength);   // past the end, keep going north
    _a.y = out.pos.y - 5 - rise * 70;
    // the opening frame looks across the newly opened bay, then turns toward the river route
    const look = THREE.MathUtils.smoothstep(q, 1.6, 2.6);
    _b.set(-55, 62, -70).lerp(_a, look);
    _b.sub(out.pos);
    out.yaw = THREE.MathUtils.radToDeg(Math.atan2(_b.x, -_b.z));
    out.pitch = THREE.MathUtils.radToDeg(Math.atan2(_b.y, Math.hypot(_b.x, _b.z)));
    out.fov = THREE.MathUtils.lerp(46, 58, look);
    return out;
  }
  const endPose = flightPose(6.85, { pos: new THREE.Vector3() });
  const keys = [[6.85, endPose.pos.x, endPose.pos.y, endPose.pos.z, endPose.yaw, endPose.pitch, endPose.fov], ...AERIAL];
  const track = [1, 2, 3, 4, 5, 6].map(c => monotone(keys.map(k => k[0]), keys.map(k => k[c])));
  const fogAt = q => THREE.MathUtils.lerp(LOOK.fog[0], LOOK.fog[1], THREE.MathUtils.smoothstep(q, 6.85, 8.96));

  // ---- terrain, built off the main thread ------------------------------------------------------
  const loader = new THREE.TextureLoader();
  const sizeOf = kind => kind === 'color' && !lite ? 2048 : 1024;   // optimisation: only the colour maps keep 2K, on desktop
  const tex = async (file, kind) => {
    const t = await loader.loadAsync(TEX + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = kind === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };
  const water = new Water(new THREE.PlaneGeometry(100000, 100000), {
    textureWidth: lite ? 512 : 1024, textureHeight: lite ? 512 : 1024, waterNormals: await tex('waternormals.jpg', 'normal'), alpha: 1,
    sunDirection: sunDir.clone(), sunColor: 0xf1f0e9, waterColor: LOOK.water, distortionScale: lookName === 'confluence' ? 1.25 : 2.2, fog: true
  });
  water.rotation.x = -Math.PI / 2;
  // foam and shallows from a 1025² copy of the field
  const LN = 1025, lite1025 = new Float32Array(LN * LN), st = (N - 1) / (LN - 1);
  for (let r = 0; r < LN; r++) for (let c = 0; c < LN; c++) lite1025[r * LN + c] = H16[(r * st) * N + c * st] * SC + OFF;
  const shoreHeight = new THREE.DataTexture(lite1025, LN, LN, THREE.RedFormat, THREE.FloatType);
  shoreHeight.minFilter = shoreHeight.magFilter = THREE.LinearFilter; shoreHeight.needsUpdate = true;
  const WW = (N - 1) * DX;
  water.material.fragmentShader = water.material.fragmentShader
    .replace('uniform sampler2D mirrorSampler;', 'uniform sampler2D mirrorSampler; uniform sampler2D shoreHeight;')
    .replace('vec3( 1.5, 1.0, 1.5 )', 'vec3( 0.72, 1.0, 0.72 )')
    .replace('float rf0 = 0.3;', 'float rf0 = 0.05;')
    // the sun's diffuse wash over the body (Water.js .3): sunny keeps little of it, so the water reads deep, not milky
    .replace('sunColor * diffuseLight * 0.3', `sunColor * diffuseLight * ${(LOOK.waterDiffuse ?? .3).toFixed(3)}`)
    .replace('vec3 outgoingLight = albedo;', `vec3 outgoingLight = mix(albedo * 1.18, vec3(${LOOK.waterBlue.map(v => v.toFixed(3))}), smoothstep(.03,.2,abs(surfaceNormal.x+surfaceNormal.z))*${LOOK.waterBlueAmt.toFixed(3)});
      vec2 uvShore = vec2((worldPosition.x - (${X0.toFixed(1)})) / ${WW.toFixed(1)}, (${ZTOP.toFixed(1)} - worldPosition.z) / ${WW.toFixed(1)});
      float shoreY = texture2D(shoreHeight, uvShore).r;
      float inside = step(0.,uvShore.x)*step(0.,uvShore.y)*step(uvShore.x,1.)*step(uvShore.y,1.);
      float lace = (sin(worldPosition.x*.9+worldPosition.z*.7+time*1.6) + sin(worldPosition.x*.41-worldPosition.z*.97+2.1)
                  + sin(worldPosition.x*1.73+worldPosition.z*.29-time*.9+.7)) / 6. + .5;
      float foam = smoothstep(-2.2,-.1,shoreY) * inside * smoothstep(.45,.85,lace+.18*sin(worldPosition.z*.071+worldPosition.x*.05));
      float shallow = smoothstep(-9.,-1.,shoreY) * inside;
      outgoingLight = mix(outgoingLight, outgoingLight*vec3(.86,.93,.92), shallow*.5);
      outgoingLight = mix(outgoingLight, vec3(.86,.92,.93), foam*.6);`);
  water.material.uniforms.shoreHeight = { value: shoreHeight };
  water.material.uniforms.size.value = lookName === 'confluence' ? 2.3 : 3.0;
  scene.add(water);

  const terrainDetail = new THREE.Group(); terrainDetail.name = 'highland-terrain-detail';
  const terrainLight = new THREE.Group(); terrainLight.name = 'highland-terrain-light'; terrainLight.visible = false;
  // the shadow casters: the light set again (same buffers), on layer 1, which only the sun's shadow camera sees; one
  // shadow for both sets, so nothing re-renders when they swap (that swap cost a 29 ms frame)
  const terrainShadow = new THREE.Group(); terrainShadow.name = 'highland-terrain-shadow';
  const terrainBackdrop = new THREE.Group();terrainBackdrop.name='everest-dem-range';
  scene.add(terrainDetail, terrainLight, terrainShadow, terrainBackdrop);
  /* the water's mirror pass draws the light set only (it used to redraw the full-detail land: the 30 ms frames),
     with the mirror variant of the material (no photo detail or normal maps: the ripples hide them) */
  let mirrorMaterial = null, terrainMaterial = null, alpineMaterial = null, alpineMirror = null;
  const mirrorBefore = water.onBeforeRender;
  water.onBeforeRender = function (...args) {
    const d = terrainDetail.visible, l = terrainLight.visible, kids = terrainLight.children, mat = kids[0]?.material;
    terrainDetail.visible = false; terrainLight.visible = true;
    if (mirrorMaterial) { for (const m of kids) m.material = mirrorMaterial; for (const m of terrainBackdrop.children) m.material = alpineMirror; }
    try { mirrorBefore.apply(this, args); } finally {
      terrainDetail.visible = d; terrainLight.visible = l;
      if (mirrorMaterial) { for (const m of kids) m.material = mat; for (const m of terrainBackdrop.children) m.material = alpineMaterial; }
    }
  };
  const stats = { pathLength, buildMs: 0, confluence };
  let wallsShown = null;
  const ready = (async () => {
    const names = ['Color', 'Normal'];
    const maps = {};
    // Rock is procedural; only the grass layer needs photographic textures.
    await Promise.all(names.map(async n => {
      maps['grass' + n] = await tex(`aerial_grass_rock-${n.toLowerCase()}-${sizeOf(n.toLowerCase())}.webp`, n.toLowerCase());
    }));
    // One existing compressed rock texture; phone takes the 512 variant.
    const rock = await loader.loadAsync(new URL('../../../images/maritime/terrain/coastal-slate-' + (lite ? 512 : 1024) + '.webp', import.meta.url).href);
    rock.wrapS = rock.wrapT = THREE.RepeatWrapping; rock.colorSpace = THREE.SRGBColorSpace;
    if (renderer) rock.anisotropy = Math.min(lite ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
    maps.rockDetail = rock;
    const tune = { tint: LOOK.tint, vegTint: LOOK.vegTint, ao: LOOK.ao, strataFar: LOOK.strataFar, grassCut: LOOK.grassCut ?? .18, layers: LOOK.layers || 0 };
    const material = terrainMaterial = createTerrainMaterial(maps, tune);
    alpineMaterial = createTerrainMaterial(maps,tune);
    mirrorMaterial = createTerrainMaterial(maps, { ...tune, mirror: true });
    alpineMirror = createTerrainMaterial(maps,{...tune,mirror:true});
    const dem = await demJob;
    const route = curve.getSpacedPoints(80).map(p => [p.x, p.z]);
    const result = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./highland-terrain-worker.js' + V, import.meta.url), { type: 'module' });
      worker.onmessage = e => { resolve(e.data); worker.terminate(); };
      worker.onerror = e => { reject(e); worker.terminate(); };
      const copy = heightBuf.slice(0);
      worker.postMessage({ height: copy, grid, encoding: meta.encoding, route, lite,dem:dem?.data,demGrid:dem?.grid }, dem ? [copy,dem.data] : [copy]);
    });
    for (const [name, set] of Object.entries(result.sets)) for (const c of set.chunks) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(c.position, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(c.normal, 3, true));   // int8, normalised
      geo.setAttribute('terrainAO', new THREE.BufferAttribute(c.terrainAO, 1));
      geo.setAttribute('aStrata', new THREE.BufferAttribute(c.aStrata, 3));
      geo.setIndex(new THREE.BufferAttribute(c.index, 1)); geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, name === 'backdrop' ? alpineMaterial : material);
      mesh.receiveShadow = name !== 'backdrop';
      (name === 'detail' ? terrainDetail : name === 'backdrop' ? terrainBackdrop : terrainLight).add(mesh);
      if (name === 'light') { const caster = new THREE.Mesh(geo, material); caster.castShadow = true; caster.layers.set(1); terrainShadow.add(caster); }
    }
    sun.shadow.needsUpdate = true;
    Object.assign(stats, { buildMs: result.ms, detail: result.sets.detail.stats, light: result.sets.light.stats, backdrop: result.sets.backdrop?.stats });
  })();
  ready.catch(e => console.error('[highland] terrain build failed', e));

  // ---- the light lines: with the camera in the glen and the canyon, then out along the four rivers ----
  const lights = createLightLines(THREE, { flight: curve, flightLength: pathLength, rivers: meta.rivers, ground, colour: opts.lightColour || LOOK.lines || 'gold' });
  const valleyClouds = createValleyClouds(THREE,{lite});
  scene.add(lights.group,valleyClouds.group);

  // ---- per frame -----------------------------------------------------------------------------
  const dir = new THREE.Vector3();
  function applyPose(q) {
    if (q <= 6.85) flightPose(q, pose);
    else { pose.pos.set(track[0](q), track[1](q), track[2](q)); pose.yaw = track[3](q); pose.pitch = track[4](q); pose.fov = track[5](q); }
    camera.position.copy(pose.pos);
    camera.position.y = Math.max(camera.position.y, ground(pose.pos.x, pose.pos.z) + (q < 6.85 ? 9 : 60));   // never inside a hill
    const yaw = THREE.MathUtils.degToRad(pose.yaw), pitch = THREE.MathUtils.degToRad(pose.pitch);
    dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.up.set(0, 1, 0); camera.lookAt(_a.copy(camera.position).add(dir));
    camera.fov = pose.fov + (camera.aspect < .8 ? 8 : 0);
    camera.near = q < 6.85 ? .5 : 2; camera.far = 14000;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  return {
    scene, camera, curve, widthAt, stats, ready, look: lookName, ownEnvironment: true, watershed: null, water, sun, ground,
    /* main passes (route 0–1, time, reduced, rise, join, q); only q is used: every pose is a pure function of it */
    update(progress, time, reduced, reveal, confluence, q) {
      q = Number.isFinite(q) ? q : 1.404 + progress * (8 - 1.404);
      applyPose(q);
      scene.fog.density = fogAt(q);
      hemi.intensity = THREE.MathUtils.lerp(LOOK.hemi[2], LOOK.hemi[3], THREE.MathUtils.smoothstep(q, 6.85, 8.96));   // full fill down in the canyon, less over the range
      // detailed land only for the low flight; above ~250 over the canyon the light set is indistinguishable
      const low = q < 7.35;
      // the page header turns white over the canyon walls; while sky is still behind it, it keeps dark ink (highland.css)
      const walls = q > 4.5 && low;
      if (walls !== wallsShown) { wallsShown = walls; document.documentElement.toggleAttribute('data-hl-walls', walls); }
      const alpineFade = showEverest && q >= 8.85 ? 1 : 0;
      terrainDetail.visible = low; terrainLight.visible = !low && alpineFade < 1;
      terrainBackdrop.visible = alpineFade > 0;
      // Above the snow range all water is occluded: skip the mirror render entirely.
      water.visible = alpineFade < .995; lights.group.visible = alpineFade < .995;
      if(terrainMaterial){
        terrainMaterial.opacity=mirrorMaterial.opacity=1-alpineFade;alpineMaterial.opacity=alpineMirror.opacity=alpineFade;
        const depthWrite = alpineFade <= 0 || alpineFade >= 1;
        terrainMaterial.depthWrite=mirrorMaterial.depthWrite=alpineMaterial.depthWrite=alpineMirror.depthWrite=depthWrite;
      }
      lights.update(q, reduced ? 0 : time, camera, THREE.MathUtils.clamp(flightS(q), 0, pathLength), scene.fog.density, innerHeight);
      scene.fog.color.copy(FOGC); scene.background.copy(FOGC);   // main's card bridge lerps these each frame from here
      valleyClouds.update(q,time,reduced);
      water.material.uniforms.time.value = reduced ? 4.2 : time * .40;
    },
    resize(w = innerWidth, h = innerHeight) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  };
}

/* Small, bounded edit of the decoded field, once per load (not a per-frame shader or extra mesh). */
function carveOpenBay(field, grid, encoding) {
  const { n, x0, ztop, dx } = grid, { offset, scale } = encoding;
  const inner = 600, outer = 720, seabed = -16;
  const c0 = Math.max(0, Math.floor((-outer - x0) / dx)), c1 = Math.min(n - 1, Math.ceil((outer - x0) / dx));
  const r0 = Math.max(0, Math.floor((ztop - outer) / dx)), r1 = Math.min(n - 1, Math.ceil((ztop + outer) / dx));
  let changed = 0, peakBefore = -Infinity, peakAfter = -Infinity;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const x = x0 + c * dx, z = ztop - r * dx, d = Math.max(Math.abs(x), Math.abs(z));
    if (d >= outer) continue;
    const i = r * n + c, h = field[i] * scale + offset;
    const u = Math.min(1, Math.max(0, (d - inner) / (outer - inner))), weight = 1 - u * u * (3 - 2 * u);
    const y = h + (Math.min(h, seabed) - h) * weight;
    const value = Math.min(65535, Math.max(0, Math.round((y - offset) / scale)));
    if (field[i] !== value) { field[i] = value; changed++; }
    if (d <= inner) { peakBefore = Math.max(peakBefore, h); peakAfter = Math.max(peakAfter, field[i] * scale + offset); }
  }
  return { changed, footprint: inner, feather: outer - inner, seabed, peakBefore, peakAfter };
}

/* the compressed field: gunzip, then undo the byte-plane split and the left-neighbour deltas */
async function loadField(url, N) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('height field ' + res.status);
  const bytes = new Uint8Array(await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const M = N * N, hi = bytes.subarray(0, M), lo = bytes.subarray(M, 2 * M), out = new Uint16Array(M);
  for (let r = 0; r < N; r++) {
    const row = r * N;
    for (let c = 0; c < N; c++) {
      const i = row + c, d = (((hi[i] << 8) | lo[i]) << 16) >> 16;
      out[i] = (c ? out[i - 1] : r ? out[i - N] : 0) + d;
    }
  }
  return out;
}

/* monotone cubic (Fritsch–Carlson) through (xs, ys): smooth, never overshoots, clamped at the ends */
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

