/* Flow2 · the view becomes 3D lines (2026-11-16). index1-5-canyon-forest.html. Team F2.
   Client: 「往下滾的流程是變成3D線條如圖1」 (their picture: a wire TERRAIN — the grid rises and falls with the hills, dark navy ground, a soft
   blue haze toward the distance), then 「網格要依照地形幅度那種 不是單純隔線」 and 「但都要注意效能問題」.

   What it draws
   · A wire grid displaced by the land's own heights (original/d1-canopy.png R through uBounds / uYRange / uRelief — the same heights as the
     land's grid), EXAGGERATED (tune.relief, 4× by default) as the lines come: the hills rise, the lake and the four rivers stay low, so the
     valleys read. Where the land is hilly the grid is twice as dense (every other line exists only on slopes and crests).
   · Lines lit by the slope toward a light from the north-west, crests brighter, valleys and water darker; bluer and a little brighter on the
     water so the four rivers into one lake stay readable; thinner and hazier with distance (as the picture's far edge).
   · They come in as a SWEEP from the lake outward (a widening ring, a little brighter at its front); the relief rises after the ring.
   · Under them a dark navy ground with the same displacement (it hides the lines behind a crest and holds the distance haze).
   Nothing moves by itself and nothing flickers: the picture is a function of the amount only.

   Cost (client: 「但都要注意效能問題」): the lines are ONE draw. While they are up, the view's own land (≈1.1 M triangles), its water, trees,
   rocks, mirror, clouds, gulls and flow are switched off, and the dark ground replaces the land with ≈64 k triangles: the frame gets cheaper
   than the view, not dearer. First the view eases to the same dark through the scene's hook uLattice / uLatticeGround, so the swap
   cannot be seen.

   API (team F3 drives it from the scroll after FOUR PATHS; this file never reads the scroll):
     window.__FLOW2_LATTICE__ = { set(amount 0..1), get amount(), tune, state }
     tune.relief  exaggeration of the land's relief (3–6 reads well)     tune.density  grid density (1 = 0.3 world units between main lines)
   ?lattice=0: the API exists, set() does nothing. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const OFF = Q.get('lattice') === '0';
  const T = {
    relief: 4,             // × the land's relief at full amount (the lake and rivers stay at the water)
    density: 1,            // main lines every 0.3 / density world units; minor lines halfway, on slopes and crests only
    step: .04,             // segment length along a line
    lift: .006,            // lines above the dark ground
    color: '#d3e0ff', accent: '#9cc6ff',
    alpha: .7,             // line strength once drawn
    front: .5,             // extra light at the sweep's front
    width: 1.6,            // softness of the sweep's front (world units)
    ground: '#070c1a',     // the dark navy under the lines
    haze: '#24345e',       // the ground toward the distance (the picture's blue haze)
    hazeNear: 18,          // distance from the lens where the haze starts
    hazeFar: 44,           // … and where it is full
    fade: .55,             // how much the far lines thin
    shade: 1, exag: 3.5,   // slope light (how strongly a slope shows)
    ridge: .6, water: .55, minor: .6
  };
  const S = { stage: OFF ? 'off (?lattice=0)' : 'waiting for the view', vertices: 0, indices: 0, groundTriangles: 0, draws: 0, hidden: [], swapped: false };
  let amount = 0, lines = null, ground = null, mat = null, gmat = null, atlas = null, THREE = null, building = false, hiddenNow = false, swapped = false, builtDensity = 0;
  const kept = new Map(); let keptBg;   /* the scene's own background (green) comes back with the view */
  const api = window.__FLOW2_LATTICE__ = {
    tune: T, state: S,
    get amount() { return amount; },
    set(v) {
      if (OFF) return;
      amount = Math.min(1, Math.max(0, +v || 0));
      if (!lines) { tryBuild(); return; }
      if (Math.abs((+T.density || 1) - builtDensity) > 1e-3) rebuildLines();
      apply();
    }
  };
  if (OFF) return;
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  function tryBuild() {
    if (building || lines) return;
    const A = window.__FLOW2_FOREST_ATLAS__ && window.__FLOW2_FOREST_ATLAS__.scene;
    if (!A || !A.scene || !A.uniforms || !A.uniforms.tCanopy || !A.uniforms.tCanopy.value || !A.lake) return;
    building = true;
    import('three').then(three => { THREE = three; build(A); }).catch(error => { S.stage = 'failed: ' + (error?.message || error); console.warn('flow2 lattice: off', error); }).finally(() => { building = false; });
  }

  /* the height both meshes share: the land's own (as its grid computes it), its relief above the water × uEx */
  const HEIGHT = `
    uniform sampler2D tCanopy; uniform vec4 uBounds; uniform vec2 uYRange; uniform float uRelief, uEx;
    float landRaw(vec2 xz){ vec3 c = texture2D(tCanopy, (xz - uBounds.xy) * uBounds.zw).rgb; return .105 + (uYRange.x + c.r * uYRange.y - .105) * uRelief; }
    float latEdge(vec2 xz){ vec2 uv = (xz - uBounds.xy) * uBounds.zw; vec2 m = min(uv, 1. - uv) / uBounds.zw; return smoothstep(0., .9, min(m.x, m.y)); }
    float latH(vec2 xz){ return .105 + max(landRaw(xz) - .105, 0.) * mix(1., uEx, latEdge(xz)) * smoothstep(-.05, .35, min(min((xz.x - uBounds.x) * uBounds.z, 1. - (xz.x - uBounds.x) * uBounds.z), min((xz.y - uBounds.y) * uBounds.w, 1. - (xz.y - uBounds.y) * uBounds.w)) * 4.); }`;

  function gridLines() {
    const U = atlas.uniforms, b = U.uBounds.value, x0 = b.x, z0 = b.y, W = 1 / b.z, D = 1 / b.w;
    const sp = .3 / Math.max(.25, +T.density || 1) / 2, st = Math.max(.01, T.step), m = .02;   /* half spacing: every other line is a minor one */
    const pos = [], minor = [], idx = [];
    const line = (ax, az, bx, bz, mi) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / st)), base = pos.length / 3;
      for (let i = 0; i <= n; i++) { const t = i / n; pos.push(ax + (bx - ax) * t, 0, az + (bz - az) * t); minor.push(mi); if (i) idx.push(base + i - 1, base + i); }
    };
    let k = 0;
    for (let z = z0 + (D % sp) / 2; z <= z0 + D + 1e-6; z += sp, k++) line(x0 + m, z, x0 + W - m, z, k % 2);
    k = 0;
    for (let x = x0 + (W % sp) / 2; x <= x0 + W + 1e-6; x += sp, k++) line(x, z0 + m, x, z0 + D - m, k % 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aMinor', new THREE.Float32BufferAttribute(minor, 1));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + W / 2, 1, z0 + D / 2), Math.hypot(W, D) / 2 + 4);
    S.vertices = pos.length / 3; S.indices = idx.length; builtDensity = +T.density || 1;
    return g;
  }
  function rebuildLines() { if (!lines) return; const old = lines.geometry; lines.geometry = gridLines(); old.dispose(); }

  function build(A) {
    atlas = A;
    const U = A.uniforms, b = U.uBounds.value, x0 = b.x, z0 = b.y, W = 1 / b.z, D = 1 / b.w, lc = A.lake.center;
    const far = Math.max(Math.hypot(x0 - lc.x, z0 - lc.z), Math.hypot(x0 + W - lc.x, z0 - lc.z), Math.hypot(x0 - lc.x, z0 + D - lc.z), Math.hypot(x0 + W - lc.x, z0 + D - lc.z));
    const shared = { tCanopy: U.tCanopy, uBounds: U.uBounds, uYRange: U.uYRange, uRelief: U.uRelief, uEx: { value: 1 } };
    const look = { uGround: { value: new THREE.Color(T.ground) }, uHazeCol: { value: new THREE.Color(T.haze) }, uHazeFar: { value: T.hazeFar }, uHazeNear: { value: T.hazeNear } };
    /* ---- the lines (one draw) ---- */
    mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, shared, look, {
        uLift: { value: T.lift }, uLake: { value: new THREE.Vector2(lc.x, lc.z) }, uSweep: { value: new THREE.Vector4(0, T.width, far, T.front) },
        uCol: { value: new THREE.Color(T.color) }, uAcc: { value: new THREE.Color(T.accent) }, uAlpha: { value: T.alpha }, uFade: { value: T.fade },
        uShade: { value: new THREE.Vector4(T.shade, T.exag, T.ridge, T.minor) }, uWater: { value: T.water }
      }),
      vertexShader: HEIGHT + `
        uniform float uLift; uniform vec4 uShade;
        attribute float aMinor;
        varying vec3 vW; varying float vLit, vWet, vMinor;
        void main(){
          vec3 p = position;
          float raw = landRaw(p.xz), h = latH(p.xz);
          vWet = 1. - smoothstep(.104, .118, raw);
          p.y = h + uLift;
          /* the slope of the drawn (exaggerated) surface, toward a light from the north-west; crests brighter, valleys darker */
          float e = .07; vec3 n = normalize(vec3(latH(p.xz - vec2(e, 0.)) - latH(p.xz + vec2(e, 0.)), 2. * e / max(uShade.y, .01), latH(p.xz - vec2(0., e)) - latH(p.xz + vec2(0., e))));
          float lit = clamp(.2 + 1.3 * max(dot(n, normalize(vec3(-.55, .62, -.56))), 0.), .16, 1.55);
          float crest = smoothstep(.0, .35, raw - .105);
          lit *= mix(1., mix(.58, 1.32, crest), uShade.z);
          vLit = mix(1., lit, uShade.x);
          /* minor lines (halfway between the main ones) live only where the land rises: denser on the hills */
          vMinor = aMinor * (1. - smoothstep(.12, .3, raw - .105 + length(n.xz) * .35)) * uShade.w;   /* minor lines only on clear crests and slopes */
          vec4 w = modelMatrix * vec4(p, 1.); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
          gl_Position.z -= .0004 * gl_Position.w;
        }`,
      fragmentShader: `
        uniform vec2 uLake; uniform vec4 uSweep; uniform vec3 uCol, uAcc; uniform float uAlpha, uFade, uWater, uHazeFar;
        varying vec3 vW; varying float vLit, vWet, vMinor;
        void main(){
          float d = length(vW.xz - uLake);
          float r = uSweep.x * (uSweep.z + uSweep.y) - uSweep.y * .5;
          float drawn = 1. - smoothstep(r - uSweep.y * .5, r + uSweep.y * .5, d);
          float frontBand = exp(-pow((d - r) / (uSweep.y * .28), 2.)) * step(.001, uSweep.x) * (1. - smoothstep(.85, 1., uSweep.x));
          float far = clamp(distance(cameraPosition, vW) / uHazeFar, 0., 1.);
          float wet = vWet * uWater;
          float a = (drawn * uAlpha * mix(vLit, 1.2, wet) + frontBand * uSweep.w * .6) * (1. - uFade * far) * (1. - vMinor);
          if (a < .004) discard;
          vec3 col = mix(mix(uCol, uAcc * 1.1, wet), uAcc, clamp(frontBand, 0., 1.)) * (1. + frontBand * uSweep.w);
          gl_FragColor = vec4(col * a, a);
        }`,
      transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor
    });
    lines = new THREE.LineSegments(gridLines(), mat);
    lines.name = 'Flow2 lattice (3D lines)'; lines.frustumCulled = false; lines.renderOrder = 15; lines.visible = false;
    /* ---- the dark ground under them: same displacement, hides lines behind crests, holds the haze (replaces the land while up) ---- */
    const nx = 240, nz = Math.round(240 * D / W), gp = new Float32Array((nx + 1) * (nz + 1) * 3), gi = new Uint32Array(nx * nz * 6);
    let p = 0, q = 0;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { gp[p++] = x0 + W * i / nx; gp[p++] = 0; gp[p++] = z0 + D * j / nz; }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a0 = j * (nx + 1) + i, b0 = a0 + 1, c0 = a0 + nx + 1, d0 = c0 + 1; gi[q++] = a0; gi[q++] = c0; gi[q++] = b0; gi[q++] = b0; gi[q++] = c0; gi[q++] = d0; }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setIndex(new THREE.BufferAttribute(gi, 1));
    gg.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + W / 2, 1, z0 + D / 2), Math.hypot(W, D) / 2 + 4);
    S.groundTriangles = nx * nz * 2;
    gmat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, shared, look, { uView: U.uView, uVig: U.uVig }),
      vertexShader: HEIGHT + `
        varying vec3 vW;
        void main(){ vec3 p = position; p.y = latH(p.xz); vec4 w = modelMatrix * vec4(p, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform vec3 uGround, uHazeCol; uniform float uHazeFar, uHazeNear, uVig; uniform vec4 uView;
        varying vec3 vW;
        void main(){
          float far = smoothstep(uHazeNear, uHazeFar, distance(cameraPosition, vW));
          vec3 col = mix(uGround, uHazeCol, far);
          vec2 sc = (gl_FragCoord.xy - uView.xy) / uView.zw - .5; col *= 1. - uVig * smoothstep(.5, 1.9, dot(sc, sc) * 4.);
          gl_FragColor = vec4(col, 1.);
        }`,
      toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2
    });
    ground = new THREE.Mesh(gg, gmat);
    ground.name = 'Flow2 lattice ground'; ground.frustumCulled = false; ground.visible = false; ground.renderOrder = -1;
    const vt = new THREE.Vector4();
    ground.onBeforeRender = r => { r.getCurrentViewport(vt); U.uView.value.copy(vt); };
    A.scene.add(ground, lines);
    S.draws = 1; S.stage = 'ready';
    /* compile both now, while nobody looks */
    try {
      const r = window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.renderer;
      if (r && r.compileAsync) { const tmp = new THREE.Scene(); const a1 = new THREE.LineSegments(lines.geometry, mat), a2 = new THREE.Mesh(gg, gmat); a1.frustumCulled = a2.frustumCulled = false; tmp.add(a1, a2); r.compileAsync(tmp, A.camera).catch(() => { }).finally(() => tmp.clear()); }
    } catch (error) { /* compiled at the first draw instead */ }
    apply();
  }

  function wrapOthers() {
    const F = window.__FLOW2_FOREST_ATLAS__ || {};
    for (const key of ['birds', 'flow', 'water']) {
      const o = F[key]; if (!o || typeof o.update !== 'function' || o.__latticeWrapped) continue;
      const up = o.update; o.update = function (...args) { if (hiddenNow) { if (o.group) o.group.visible = false; return; } return up.apply(this, args); };
      o.__latticeWrapped = true; S.hidden.push(key);
    }
    const air = F.air;
    if (air && !air.__latticeWrapped) {
      const up = air.update, rd = air.render;
      if (typeof up === 'function') air.update = function (...args) { const out = up.apply(this, args); if (hiddenNow && air.group) air.group.visible = false; return out; };
      if (typeof rd === 'function') air.render = function (...args) { if (hiddenNow) return; return rd.apply(this, args); };
      air.__latticeWrapped = true; S.hidden.push('air');
    }
  }

  /* the land and everything on it go once the view is as dark as the ground (the swap cannot be seen); they come back on the way out */
  function swap(on) {
    if (on === swapped) return;
    swapped = on; S.swapped = on;
    const sc = atlas.scene;
    if (on) { for (const o of sc.children) { if (o === lines || o === ground) continue; kept.set(o, o.visible); o.visible = false; } ground.visible = true; keptBg = sc.background; sc.background = new THREE.Color(T.haze); }
    else { for (const [o, v] of kept) o.visible = v; kept.clear(); ground.visible = false; if (keptBg !== undefined) { sc.background = keptBg; keptBg = undefined; } const F = window.__FLOW2_FOREST_ATLAS__ || {}; if (F.air && F.air.group) F.air.group.visible = true; }
  }

  function apply() {
    if (!lines || !atlas) return;
    wrapOthers();
    const a = amount, U = atlas.uniforms;
    const ex = 1 + (Math.max(1, +T.relief || 1) - 1) * smooth(.3, .85, a);
    mat.uniforms.uEx.value = ex; gmat.uniforms.uEx.value = ex;   /* one object in both (shared) — set anyway for clarity */
    mat.uniforms.uSweep.value.set(smooth(0, 1, a), T.width, mat.uniforms.uSweep.value.z, T.front);
    mat.uniforms.uCol.value.set(T.color); mat.uniforms.uAcc.value.set(T.accent); mat.uniforms.uAlpha.value = T.alpha; mat.uniforms.uLift.value = T.lift; mat.uniforms.uFade.value = T.fade;
    mat.uniforms.uShade.value.set(T.shade, T.exag, T.ridge, T.minor); mat.uniforms.uWater.value = T.water;
    gmat.uniforms.uGround.value.set(T.ground); gmat.uniforms.uHazeCol.value.set(T.haze); gmat.uniforms.uHazeFar.value = mat.uniforms.uHazeFar.value = T.hazeFar; gmat.uniforms.uHazeNear.value = T.hazeNear;
    lines.visible = a > .001;
    /* the view eases to the dark ground first (needed under the lines, and so the swap below cannot be seen) */
    if (U.uLattice) U.uLattice.value = smooth(0, .3, a);
    if (U.uLatticeGround) U.uLatticeGround.value.set(T.ground);
    hiddenNow = a > .28;
    swap(a > .32);
    const M = window.__FLOW2_LAKE_MARK__;
    if (M && typeof M.leave === 'function') {
      if (a > .08 && !api.__markLeft) { M.leave(); api.__markLeft = true; }
      else if (a <= .001 && api.__markLeft) { (M.auto || M.enter).call(M); api.__markLeft = false; }
    }
    S.amount = +a.toFixed(3); S.relief = +ex.toFixed(2); S.hiding = hiddenNow;
  }

  const wait = () => {
    if (lines) return;
    tryBuild(); if (!lines) setTimeout(wait, 600);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => setTimeout(wait, 1500), { once: true }); else setTimeout(wait, 1500);
})();
