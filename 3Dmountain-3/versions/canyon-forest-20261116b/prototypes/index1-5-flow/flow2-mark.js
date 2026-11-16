/* Flow2 · the mark in the valley (2026-11-14). index1-5-flow2-mark.html only (a trial page; index1-5-flow2.html does not load this).
   Client: 「做完後把最後一個3D 這樣放看看 如圖，另開html 不要覆蓋」 with a picture: the closing chapter's glass mark standing on the
   river in the middle of the valley's first screen, mirrored in the water, rings spreading from its foot.

   What it does
   · The SAME glass mark as the closing chapter (the live module prototypes/index1-5/js/world-logo-mark.js, read-only, with the
     page's own CONFIG.logoMark look) stands on the river ahead of the first screen's camera, facing it.
   · It rises out of the water when the page becomes live, and sinks back as the flight approaches it (scroll back: it rises
     again). Nothing else of the journey changes.
   · A broken mirror image under it and slow rings on the water around its foot (still under "reduce motion").

   How (so that the glass costs little and stays sharp): the mark is NOT put into the canyon scene — three's transmission pass
   would then draw the whole valley a second time every frame, and the page's forward-motion blur would smear the glass into
   ghost copies while scrolling (the client saw exactly that). Two small extra passes instead:
     1 · right after the page's main render pass, into the same buffer and against the same depth: the things that lie ON the
         water (the mirror image and the rings); the page's own passes then treat them like the rest of the water;
     2 · after the page's motion and transition passes (just before its bloom): the glass itself, drawn into a buffer of its own
         (smooth edges) and laid over the picture. The water cuts it with a clipping plane at the water level, and what it
         refracts is a half-size copy of the finished picture of that same frame.
   Hooks: window.__FLOW2_FINE_JOURNEY__.attach (the composer) and .canyon (the canyon), both chained; main.js is not edited.
   Off on the lighter drawing (phones, weak devices). ?mark=0 leaves it out. Live: window.__FLOW2_MARK__.tune / .state.

   ENTRANCE AND EXIT (lead, 2026-11-15; client: 「初始LOGO幫我思考進場時候完美的效果 例如360度轉上來 然後還要加入退場動畫」):
   · IN  — a ring of light opens on the water first; then the mark rises out of it turning one whole revolution about its own axis, the turn
           slowing so that it comes to rest exactly facing the lens; it rises a little past its height and settles back (a soft spring), leaning
           back slightly as it breaks the surface and straightening as it stands. The rings swell while it crosses the surface.
   · OUT — when the visitor flies on, it turns away (three quarters of a turn) and sinks back into the river with a last ring, in step with the
           flight itself (32–62 m ahead of the lens), so it is seen whole at any scrolling speed; scrolling back, it rises turning the other way. Reduce motion: simply there (no turn, no spring). Panel 「LOGO」: 進場 / 退場 rows.
   · ?markIntro=0 = the plain rise of before. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('mark') === '0') return;
  const SRC = (document.currentScript && document.currentScript.src) || new URL('prototypes/index1-5-flow/flow2-mark.js', document.baseURI).href;
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    /* 2026-11-15: the client's own values from the LOGO panel (複製參數 JSON) are the defaults now */
    height: num('markH', 31.5),      // metres, foot to top
    distance: num('markD', 65),      // metres ahead of the first screen's camera (used while `place` is null)
    place: null,                     // [x, z, facingYaw] in the valley's world; null = taken from the first live frame
    side: num('markX', 0),           // metres to the right of the view axis
    dip: 0,                          // metres of the foot under the water
    riseTime: 2.9,                   // seconds, the entrance (the plain rise, ?markIntro=0)
    intro: Q.get('markIntro') === '0' ? 0 : 1,
    inTime: num('markIn', 2.8),      // seconds of the entrance
    inTurns: 1,                      // whole turns on the way up
    inDelay: .35,                    // the ring opens this long before the glass breaks the surface
    spring: .045,                    // how far past its height it rises (share of the height) before it settles
    lean: .2,                        // radians it leans back while breaking the surface
    outTime: num('markOut', 1.35),   // seconds of the exit
    outTurns: .75,                   // turns on the way down
    sinkFar: num('markFar', 62),     // metres ahead of the lens: still fully up
    sinkNear: num('markNear', 32),   // metres ahead of the lens: fully under
    sway: 0,                         // radians, a slow turn to and fro (0 = still)
    env: Q.get('markEnv') || 'own',  // 'own' = the mark's dusk studio (the closing chapter's look); 'scene' = the valley's environment
    /* the glass: clearer than the closing chapter's frosted look so the valley shows through it (?markLook=0 = the closing chapter's own look) */
    look: Q.get('markLook') === '0' ? {} : {
      transmission: 1, roughness: 0, clearcoatRoughness: .05, volume: .3, ior: 2.33, dispersion: 1.75, thickFloor: 1,
      tint: '#f5faff', attenuationColor: '#7daad4', attenuationDistance: 12, envIntensity: .65, specular: 1, sheen: .11, clearcoat: .6,
      rimStrength: 6, rimLine: .45, rimColor: '#c2daeb', glow: 0, wallGlow: 0, caustic: 2.5, shimmer: .1, brandBlue: .72, brandBlueColor: '#77b1ee'
    },
    sun: 3,                          // the valley's sun on the glass (0 = environment only)
    maxBright: num('markMax', 1.3),  // how bright one point of the glass may get before it is eased off (see the note at the composite)
    mirror: { opacity: num('markMirror', .11), stretch: .97, wobble: 1.7, deep: '#3f8fdc', bright: '#d8e7f3' },
    rings: { amount: num('markRings', 1.3), radius: 1.15, count: 6, speed: .5, glow: num('markGlow', .8), lift: .22, color: '#bfe6ff' },
    copyScale: 1,                    // size of the picture the glass refracts (of the frame). Half size made small bright things behind the glass (drifting motes, glints) show as soft SQUARES once the glass magnified them (client: 這種反射光應該是圓形吧不是方形)
    msaa: 4                          // edge smoothing of the glass's own buffer (0 = none); read once
  };
  try { Object.assign(T.look, JSON.parse(Q.get('markTry') || '{}')); } catch (error) { }   // ?markTry={"ior":1.4}: try look values from the address bar
  const S = { stage: 'waiting', notes: [] };
  const api = window.__FLOW2_MARK__ = { tune: T, state: S, place: () => { placed = false; } };
  /* the client's sliders (flow2-panel.js) */
  window.__FLOW2_PANEL__?.add({ id: 'mark', title: 'LOGO', key: 'm',   /* M (the page already uses L, T, C and G) */ tune: T, onChange: key => { if (/^(height|distance|side)$/.test(key)) placed = false; if (key.startsWith('look.')) mark?.setLook({ ...T.look }); }, rows: [
    ['— 透明度（先調這一組）—'],
    ['透光', 'look.transmission', 0, 1, .01], ['霧面（0＝全清）', 'look.roughness', 0, .7, .005], ['折射厚度（背景扭曲）', 'look.volume', 0, 6, .05], ['折射率', 'look.ior', 1, 2.33, .01],
    ['吸收距離（大＝更透）', 'look.attenuationDistance', .1, 12, .05], ['吸收色（藍）', 'look.attenuationColor', 'color'], ['底色', 'look.tint', 'color'],
    ['邊緣折射下限（小＝更透）', 'look.thickFloor', 0, 1, .01],
    ['— 反光與亮度 —'],
    ['環境反光', 'look.envIntensity', 0, 8, .05], ['鏡面強度', 'look.specular', 0, 1, .01], ['清漆', 'look.clearcoat', 0, 1, .01], ['絨光（霧感）', 'look.sheen', 0, 1, .01],
    ['亮點上限（小＝不刺眼）', 'maxBright', .5, 12, .1], ['邊緣光', 'look.rimStrength', 0, 6, .05], ['邊緣亮線', 'look.rimLine', 0, 5, .05], ['邊緣光顏色', 'look.rimColor', 'color'], ['內部散射光', 'look.glow', 0, 1.5, .01],
    ['水紋焦散', 'look.caustic', 0, 2.5, .01], ['閃爍', 'look.shimmer', 0, 1, .01], ['色散', 'look.dispersion', 0, 5, .05],
    ['品牌藍濃度', 'look.brandBlue', 0, 1, .01], ['品牌藍顏色', 'look.brandBlueColor', 'color'],
    ['— 位置與大小 —'],
    ['高度（公尺）', 'height', 8, 60, .5], ['離鏡頭多遠', 'distance', 40, 160, 1], ['左右偏移', 'side', -40, 40, .5], ['腳沉入水', 'dip', 0, 3, .05], ['慢慢擺動', 'sway', 0, .4, .01], ['太陽打在玻璃上', 'sun', 0, 3, .05],
    ['— 靠近時沉入水中 —'],
    ['開始下沉的距離', 'sinkFar', 20, 120, 1], ['完全沉入的距離', 'sinkNear', 5, 80, 1], ['升起花幾秒', 'riseTime', .2, 6, .1],
    ['— 進場（轉上來）與退場 —'],
    ['進場秒數', 'inTime', .8, 6, .05], ['進場轉幾圈', 'inTurns', 0, 3, .05], ['水面光圈先出現（秒）', 'inDelay', 0, 1.5, .05], ['升過頭再回彈', 'spring', 0, .15, .005], ['出水時後仰', 'lean', 0, .6, .01],
    ['退場秒數', 'outTime', .4, 4, .05], ['退場轉幾圈', 'outTurns', 0, 3, .05],
    ['— 倒影 —'],
    ['倒影濃度', 'mirror.opacity', 0, 1, .01], ['倒影晃動', 'mirror.wobble', 0, 3, .05], ['倒影拉長', 'mirror.stretch', .5, 2, .01], ['倒影深色', 'mirror.deep', 'color'], ['倒影亮色', 'mirror.bright', 'color'],
    ['— 漣漪 —'],
    ['漣漪亮度', 'rings.amount', 0, 4, .05], ['腳下的光', 'rings.glow', 0, 3, .05], ['漣漪範圍', 'rings.radius', .5, 4, .05], ['漣漪圈數', 'rings.count', 1, 8, .1], ['漣漪速度', 'rings.speed', 0, .5, .01], ['漣漪顏色', 'rings.color', 'color']
  ] });

  let THREE = null, renderer = null, composer = null, canyon = null, lite = false, started = false, placed = false;
  let mark = null, holder = null, scene2 = null, sceneWater = null, sun = null, pass = null, pass2 = null, mainPass = null, copyRT = null, markRT = null, blit = null, over = null, backdrop = null, mirror = null, mirrorGroup = null, mirrorHolder = null, rings = null, water = null, frame = null;
  let live = 0, liveSince = 0, lastTime = 0, reduced = false, base = { min: -.5, size: 1 };
  /* the entrance / exit clock: 'hidden' → 'in' → 'shown' → 'out' → 'hidden' (or back to 'in' from the middle of 'out') */
  let act = 'hidden', actAt = 0, actFrom = 0;
  /* MOTION (E1, 2026-11-16; client: 「到山谷可以進場動畫一下就好就不要隨便動了 轉場銜接進退場動畫」): one entrance, then nothing moves by itself.
     · the glass's own clock (its shimmer, inner light, caustic web, turning highlights and the rings at its foot) runs only while the
       mark moves — the entrance, the exit with the flight, the re-entrance when scrolling back — and eases to a stop (≈ .7 s) when it stands;
       the rings at its foot fade with it. Its mirror image keeps the water's own time (it lies in moving water).
     · the river's light lines pulse while the page makes its entrance, then hold (≈ .8 s ease); flying on, they still pass by.
     ?motion=old = as before (the glass and the lines on the wall clock). */
  const MOTION_OLD = Q.get('motion') === 'old';
  let glassTime = 0, glassRate = 1, glassLast = -1, lightTime = 0, lightRate = 1, lightLast = -1, liveAt = 0;
  function lightClock(t) {
    const now = performance.now() / 1000, still = document.documentElement.dataset.flow2Still;
    const pageLive = still === undefined ? document.body.classList.contains('is-ready') : still === 'off';
    if (lightLast < 0) { lightLast = now; lightTime = t; }
    const dt = Math.min(.1, Math.max(0, now - lightLast)); lightLast = now;
    if (pageLive && !liveAt) liveAt = now;
    const entrance = Math.max(.2, T.inTime) + Math.max(0, T.inDelay) + .4;
    lightRate = !liveAt || now - liveAt < entrance ? 1 : lightRate * Math.exp(-dt / .8);
    lightTime += dt * lightRate; S.motion = { glass: +glassRate.toFixed(3), lights: +lightRate.toFixed(3) };
    return lightTime;
  }
  const easeOut3 = t => 1 - Math.pow(1 - t, 3), easeIn2 = t => t * t, clamp01 = t => Math.min(1, Math.max(0, t));
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const attachBefore = host.attach, canyonBefore = host.canyon;
  host.attach = function (handles = {}) {
    try { return attachBefore?.call(this, handles); } finally { THREE ||= handles.THREE; renderer ||= handles.renderer; composer = handles.composer || composer; start(); }
  };
  host.canyon = function (handles = {}) {
    try { return canyonBefore?.call(this, handles); } finally { THREE ||= handles.THREE; renderer ||= handles.renderer; canyon = handles.canyon || canyon; lite = !!handles.lite; start(); }
  };

  function start() {
    if (started || !composer || !canyon || !THREE || !renderer) return;
    started = true;
    /* the light lines hold after the entrance (on every drawing, also where the glass is not drawn) */
    if (!MOTION_OLD && canyon.followLights && typeof canyon.followLights.update === 'function' && !canyon.followLights.__f2Still) {
      const lightsUpdate = canyon.followLights.update;
      canyon.followLights.update = function (route, time, ...rest) { return lightsUpdate.call(this, route, lightClock(+time || 0), ...rest); };
      canyon.followLights.__f2Still = true;
    }
    if (lite || innerWidth < 760) { S.stage = 'off: the lighter drawing'; return; }
    /* 2026-11-15: the first screen's lens is recorded on the first canyon frame drawn at the journey's floor, so the mark stands
       before the first screen even when the visitor has scrolled on before the mark was ready */
    const firstUpdate = canyon.update;
    canyon.update = function (...args) {
      const out = firstUpdate.apply(this, args);
      if (!origin) { const j = window.__MONTIS_STUDY__?.journey; const floor = Number.isFinite(j?.floor) ? j.floor : null;
        if (j && floor !== null && j.progress <= floor + .02) { const cam = canyon.camera; cam.updateMatrixWorld(); const e = cam.matrixWorld.elements; let dx = -e[8], dz = -e[10]; const n = Math.hypot(dx, dz) || 1; origin = { position: cam.position.clone(), dx: dx / n, dz: dz / n }; S.origin = 'first screen'; } }
      return out;
    };
    build().catch(error => { S.stage = 'failed: ' + (error?.message || error); console.warn('flow2 mark: the valley stays without the mark', error); });
  }

  async function build() {
    S.stage = 'loading';
    const [markModule, svgModule] = await Promise.all([
      import(new URL('../index1-5/js/world-logo-mark.js?v=i15-mw30beoi', SRC).href),
      import('three/addons/loaders/SVGLoader.js')
    ]);
    const CONFIG = window.__MONTIS_STUDY__?.CONFIG || {};
    mark = await markModule.createLogoMark({
      THREE, SVGLoader: svgModule.SVGLoader, renderer, svgUrl: new URL('../../images/logo.svg', SRC).href,
      look: { ...(CONFIG.logoMark || {}), small: false, bgDisplay: 0, ...T.look }
    });
    mark.update({ yaw: 0, time: 0, q: 1 });

    scene2 = new THREE.Scene(); sceneWater = new THREE.Scene();
    water = new THREE.Plane(new THREE.Vector3(0, 1, 0), .04);   // the glass ends at the water
    holder = new THREE.Group(); holder.add(mark.group); scene2.add(holder);
    sun = new THREE.DirectionalLight(0xffffff, 0); scene2.add(sun, sun.target);
    measure();

    /* the valley's finished picture, half size: what the glass refracts */
    copyRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    copyRT.texture.name = 'flow2 mark backdrop';
    const tri = new THREE.PlaneGeometry(2, 2);
    const copyMaterial = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null } }, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: 'uniform sampler2D tScene; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tScene, vUv).rgb, 1.); }'
    });
    blit = { scene: new THREE.Scene(), camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material: copyMaterial };
    const blitMesh = new THREE.Mesh(tri, copyMaterial); blitMesh.frustumCulled = false; blit.scene.add(blitMesh);
    /* the same picture as the tiny scene's only opaque thing: three's transmission pass draws it for the glass; in the scene's
       own draw (into the page's buffer) it writes nothing */
    const backMaterial = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: copyRT.texture } }, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }',
      fragmentShader: 'uniform sampler2D tScene; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tScene, vUv).rgb, 1.); }'
    });
    backdrop = new THREE.Mesh(tri, backMaterial); backdrop.frustumCulled = false; backdrop.renderOrder = -10;
    backdrop.onBeforeRender = r => { backMaterial.colorWrite = r.getRenderTarget() !== markRT; };
    scene2.add(backdrop);

    markRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, samples: Math.max(0, Math.round(window.__FLOW2_QUALITY__?.pick?.(T.msaa, Math.min(T.msaa, 2), 0) ?? T.msaa)) });   // flow2 quality: fewer edge samples at medium, none at low
    markRT.texture.name = 'flow2 mark glass';
    const overMaterial = new THREE.ShaderMaterial({
      uniforms: { tMark: { value: markRT.texture }, uMax: { value: T.maxBright } }, depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      /* A mirror-smooth bevel catching the sun is one pixel thousands of times brighter than white. The page's bloom then
         spreads it over the whole SQUARE reach of its blur (client: 「這種反射光應該是圓形吧不是方形」). So the glass's brightest
         points are eased off here (above uMax they approach 2 × uMax): the bloom gets a spark it can draw as a small round glow. */
      fragmentShader: `uniform sampler2D tMark; uniform float uMax; varying vec2 vUv;
        void main(){ vec4 t = texture2D(tMark, vUv); float m = max(t.r, max(t.g, t.b)); if (m > uMax) t.rgb *= (uMax + (m - uMax) / (1. + (m - uMax) / uMax)) / m; gl_FragColor = t; }`
    });
    over = { scene: new THREE.Scene(), material: overMaterial };
    const overMesh = new THREE.Mesh(tri, overMaterial); overMesh.frustumCulled = false; over.scene.add(overMesh);

    buildMirror(); buildRings();

    mainPass = composer.passes.find(p => p && p.scene && p.camera && typeof p.render === 'function');
    if (!mainPass) throw new Error('no main render pass in the composer');
    const guard = (which, fn) => (r, writeBuffer, readBuffer) => { try { fn(r, readBuffer); } catch (error) { pass.enabled = pass2.enabled = false; S.stage = 'failed while drawing (' + which + '): ' + (error?.message || error); console.warn('flow2 mark: switched off', error); } };
    pass = { enabled: true, needsSwap: false, clear: false, renderToScreen: false, setSize() { }, dispose() { }, render: guard('water', drawWater) };
    pass2 = { enabled: true, needsSwap: false, clear: false, renderToScreen: false, setSize() { }, dispose() { }, render: guard('glass', drawGlass) };
    composer.insertPass(pass, composer.passes.indexOf(mainPass) + 1);
    composer.insertPass(pass2, composer.passes.indexOf(pass) + 1);

    /* the valley's clock (called only while the canyon is drawn) */
    const update = canyon.update;
    canyon.update = function (...args) { const out = update.apply(this, args); lastTime = +args[1] || 0; reduced = !!args[2]; seat(); return out; };

    /* compile before it is shown */
    holder.position.set(0, -1e4, 0);
    mark.mesh.material.clippingPlanes = [water];
    const clipping = renderer.localClippingEnabled; renderer.localClippingEnabled = true;
    try { await renderer.compileAsync(scene2, canyon.camera); await renderer.compileAsync(sceneWater, canyon.camera); } catch (error) { S.notes.push('precompile skipped: ' + (error?.message || error)); }
    renderer.localClippingEnabled = clipping;
    S.stage = 'ready'; S.model = mark.model; S.triangles = mark.mesh ? Math.round((mark.mesh.geometry.index ? mark.mesh.geometry.index.count : mark.mesh.geometry.attributes.position.count) / 3) : 0;
  }

  /* the glass pass sits just before the page's bloom (after its motion and transition passes); if there is no bloom, after the
     forward-motion pass; otherwise where it is */
  function seat() {
    const P = composer.passes, bloom = P.find(p => p && p !== pass && p !== pass2 && 'strength' in p && 'radius' in p && 'threshold' in p), motion = window.__MONTIS_STUDY__?.canyonMotion?.pass;
    const before = bloom && P.includes(bloom) ? bloom : null, after = !before && motion && P.includes(motion) ? motion : null;
    const at = P.indexOf(pass2);
    if (before) { if (P[P.indexOf(before) - 1] === pass2) return; P.splice(at, 1); P.splice(P.indexOf(before), 0, pass2); S.seat = 'before the bloom'; }
    else if (after) { if (P[P.indexOf(after) + 1] === pass2) return; P.splice(at, 1); P.splice(P.indexOf(after) + 1, 0, pass2); S.seat = 'after the motion pass'; }
  }

  function measure() {
    holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); holder.scale.setScalar(1); holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mark.group);
    base = { min: box.min.y, size: Math.max(1e-3, box.max.y - box.min.y) };
  }

  function buildMirror() {
    const C = new THREE.Color();
    const material = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uUp: { value: 0 }, uHeight: { value: T.height }, uOpacity: { value: T.mirror.opacity }, uWobble: { value: T.mirror.wobble },
        uDeep: { value: new THREE.Color(T.mirror.deep) }, uBright: { value: new THREE.Color(T.mirror.bright) } },
      vertexShader: `
        uniform float uTime, uWobble, uHeight; varying vec3 vW, vN, vV; varying float vSource;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.);
          vSource = w.y;                                     // the mirrored point's height: below the water = a part that stands above it
          float depth = max(0., -w.y);
          vec3 right = normalize(vec3(viewMatrix[0][0], 0., viewMatrix[2][0]));
          float k = depth / uHeight;
          w.xyz += right * (sin(w.y * 1.9 + uTime * 1.25) * .55 + sin(w.y * 4.3 - uTime * 1.9) * .28) * uWobble * (.08 + .5 * k) * uHeight * .035;
          vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform float uTime, uUp, uHeight, uOpacity; uniform vec3 uDeep, uBright; varying vec3 vW, vN, vV; varying float vSource;
        void main(){
          if (vSource > 0.) discard;
          float k = clamp(-vSource / uHeight, 0., 1.);
          float fres = pow(1. - abs(dot(normalize(vN), normalize(vV))), 1.6);
          float bands = .62 + .38 * sin(vW.y * 2.6 + uTime * 1.6 + sin(vW.x * .45 + uTime * .4) * 1.8);
          float fade = (1. - smoothstep(.0, .95, k)); fade *= fade;
          float a = uOpacity * uUp * fade * (.72 + .28 * fres) * bands;
          gl_FragColor = vec4(mix(uDeep, uBright, .35 + .45 * fres + .2 * (1. - k)), a);
        }`
    });
    mirror = new THREE.Mesh(mark.mesh.geometry, material); mirror.frustumCulled = false; mirror.renderOrder = 6;
    mirrorGroup = new THREE.Group(); mirrorGroup.add(mirror);
    mirrorHolder = new THREE.Group(); mirrorHolder.add(mirrorGroup); sceneWater.add(mirrorHolder);
    void C;
  }

  function buildRings() {
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uUp: { value: 0 }, uAmount: { value: T.rings.amount }, uCount: { value: T.rings.count }, uGlow: { value: T.rings.glow }, uColor: { value: new THREE.Color(T.rings.color) } },
      vertexShader: 'varying vec2 vP; void main(){ vP = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `
        uniform float uTime, uUp, uAmount, uCount, uGlow; uniform vec3 uColor; varying vec2 vP;
        void main(){
          float r = length(vP);
          float phase = r * uCount - uTime;
          float fw = fwidth(phase);
          float wave = pow(.5 + .5 * sin(phase * 6.2831853), 3.);
          wave = mix(wave, .3125, smoothstep(.12, .42, fw));                      // rings too dense for the pixels settle to their mean (no shimmer)
          float body = smoothstep(.03, .12, r) * (1. - smoothstep(.25, 1., r));
          float a = (wave * body * uAmount + exp(-r * r * 20.) * uGlow) * uUp;
          gl_FragColor = vec4(uColor * a, a);
        }`
    });
    rings = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), material); rings.renderOrder = 4; rings.frustumCulled = false;
    sceneWater.add(rings);
  }

  const _dir = { x: 0, z: -1 }, _v = { x: 0, y: 0, z: 0 }; let origin = null;   // the first screen's lens: every later placing starts from it
  function placeNow(live) {
    if (!origin) { const e = live.matrixWorld.elements; let dx = -e[8], dz = -e[10]; const n = Math.hypot(dx, dz) || 1; origin = { position: live.position.clone(), dx: dx / n, dz: dz / n }; }
    const camera = origin, dx = origin.dx, dz = origin.dz;
    if (T.place) { _v.x = T.place[0]; _v.z = T.place[1]; }
    else { _v.x = camera.position.x + dx * T.distance - dz * T.side; _v.z = camera.position.z + dz * T.distance + dx * T.side; }
    _dir.x = dx; _dir.z = dz;
    const yaw = T.place && Number.isFinite(T.place[2]) ? T.place[2] : Math.atan2(camera.position.x - _v.x, camera.position.z - _v.z);
    holder.rotation.y = yaw; mirrorHolder.rotation.y = yaw;
    S.place = [+_v.x.toFixed(2), +_v.z.toFixed(2), +yaw.toFixed(4)]; S.viewAxis = [+dx.toFixed(4), +dz.toFixed(4)]; S.cameraAtPlacing = origin.position.toArray().map(v => +v.toFixed(2));
    placed = true;
  }

  /* 1 · every frame the valley is the picture: where the mark stands, how far up it is; then the things on the water */
  function drawWater(r, readBuffer) {
    frame = null;
    if (!mark || mainPass.scene !== canyon.scene) { live = 0; return; }
    const camera = canyon.camera, now = performance.now() / 1000;
    const still = document.documentElement.dataset.flow2Still;
    const pageLive = still === undefined ? document.body.classList.contains('is-ready') : still === 'off';
    if (!pageLive) return;
    if (!placed) { const first = !origin; placeNow(camera); if (first) liveSince = now; }
    if (mirror.geometry !== mark.mesh.geometry) { mirror.geometry = mark.mesh.geometry; measure(); }

    /* how far up: the entrance × the approach */
    const ahead = (_v.x - camera.position.x) * _dir.x + (_v.z - camera.position.z) * _dir.z;
    /* values kept from the panel can never sink it before the first screen: near stays 10 m short of its distance */
    const sNear = Math.min(T.sinkNear, T.distance - 10), sFar = Math.max(sNear + 4, Math.min(T.sinkFar, T.distance - 1));
    let up, spin = 0, tilt = 0, burst = 0;
    if (!T.intro || reduced) {
      const rise = reduced ? 1 : smooth(0, 1, (now - liveSince) / Math.max(.01, T.riseTime));
      up = rise * smooth(sNear, sFar, ahead);
    } else {
      /* IN: on its own time, once, when the page becomes live (the visitor may already scroll: the exit below takes over) */
      const inT = Math.max(.2, T.inTime), dl = Math.max(0, T.inDelay);
      const t = (now - liveSince - dl) / inT, k = clamp01(t);
      const eUp = k >= 1 ? 1 : Math.max(0, easeOut3(clamp01(k / .78)) * (1 + T.spring * Math.sin(Math.PI * clamp01(k / .9))));
      const eSpin = (1 - easeOut3(k)) * Math.PI * 2 * T.inTurns;
      const eTilt = T.lean * Math.sin(Math.PI * clamp01(k / .7)) * (1 - k);
      const eBurst = t < 0 ? clamp01(1 + t * inT / Math.max(.01, dl)) : (k < 1 ? Math.sin(Math.PI * clamp01(k / .5)) : 0);
      /* OUT: with the visitor's own flight — however fast they scroll, they see it turn away and sink (and come back up turning, the other way) */
      const x = 1 - smooth(sNear, sFar, ahead), xs = x * x * (3 - 2 * x);
      up = Math.min(eUp, 1 - xs);
      spin = eSpin - xs * Math.PI * 2 * T.outTurns;
      tilt = eTilt - T.lean * .6 * Math.sin(Math.PI * x);
      burst = Math.max(eBurst, x > .01 && x < .99 ? Math.sin(Math.PI * x) : 0);
      act = k < 1 ? 'in' : x > .99 ? 'hidden' : x > .01 ? 'out' : 'shown';
      /* never above the water once the lens is near (the old rule as a limit) */

    }
    S.ahead = +ahead.toFixed(1); S.up = +up.toFixed(3); S.act = act;
    if (up < .003 && burst < .01) { live = 0; return; }
    live = Math.min(1, up);
    /* fix 2026-11-16 (client's picture: a ring of glass in the sky): while only the ring of light shows (the mark still / already under the water),
       neither the glass nor its mirror image is drawn — the mirror image of a sunk mark stands ABOVE the water */
    const body = up >= .003; mirror.visible = body;

    /* the glass's own clock: it runs while the mark moves, and eases to a stop when it stands (MOTION above) */
    if (glassLast < 0) glassLast = now;
    const gdt = Math.min(.1, Math.max(0, now - glassLast)); glassLast = now;
    const moving = (T.intro && !reduced) ? (act === 'in' || act === 'out' || burst > .01) : (up > .003 && up < .997);
    glassRate = moving ? 1 : glassRate * Math.exp(-gdt / .7); glassTime += gdt * glassRate;
    const idle = MOTION_OLD ? 1 : glassRate;
    const scale = T.height / base.size, waterTime = reduced ? 0 : lastTime, time = reduced ? 0 : MOTION_OLD ? lastTime : glassTime;
    const y = -base.min * scale - T.dip - (1 - up) * (T.height + .6);
    holder.position.set(_v.x, y, _v.z); holder.scale.setScalar(scale);
    mark.update({ yaw: (reduced ? 0 : Math.sin(time * .22) * T.sway) + spin, time, q: 1 });
    mark.group.rotation.x = tilt;
    /* the mirror image: the same body turned over about the water */
    mirrorHolder.position.set(_v.x, -y, _v.z); mirrorHolder.scale.set(scale, -scale * T.mirror.stretch, scale);
    mirrorGroup.rotation.y = mark.group.rotation.y; mirrorGroup.rotation.x = -tilt; mirror.scale.copy(mark.mesh.scale); mirror.position.copy(mark.mesh.position);
    const MU = mirror.material.uniforms; MU.uTime.value = waterTime; MU.uUp.value = up; MU.uHeight.value = T.height; MU.uOpacity.value = T.mirror.opacity; MU.uWobble.value = T.mirror.wobble; MU.uDeep.value.set(T.mirror.deep); MU.uBright.value.set(T.mirror.bright);
    const R = T.height * T.rings.radius, RU = rings.material.uniforms;
    rings.position.set(_v.x, T.rings.lift, _v.z); rings.scale.set(R, 1, R);
    RU.uTime.value = time * T.rings.speed; RU.uUp.value = Math.max(Math.min(1, up) * smooth(0, .35, up) * idle, burst * .9); RU.uAmount.value = T.rings.amount * (1 + 1.3 * burst); RU.uCount.value = T.rings.count; RU.uGlow.value = T.rings.glow; RU.uColor.value.set(T.rings.color);

    const target = r.getRenderTarget(), autoClear = r.autoClear;
    r.autoClear = false; r.setRenderTarget(readBuffer); r.render(sceneWater, camera);
    r.autoClear = autoClear; r.setRenderTarget(target);
    frame = body ? { camera } : null;
  }

  /* 2 · the glass, after the page's motion passes: its own buffer, then over the picture */
  const _clear = { color: null, alpha: 1 };
  function drawGlass(r, readBuffer) {
    if (!frame || !mark) return;
    const camera = frame.camera;
    /* the valley's own sun and environment on the glass */
    const source = canyon.scene.children.find(o => o.isDirectionalLight && o.castShadow);
    if (source) { sun.color.copy(source.color); sun.intensity = source.intensity * T.sun; sun.position.copy(source.position); sun.target.position.copy(source.target.position); sun.target.updateMatrixWorld(); }
    const wanted = T.env === 'scene' ? (canyon.scene.environment || null) : null;
    if (S.env !== (wanted ? 'scene' : 'own')) { mark.setEnvironment(wanted); S.env = wanted ? 'scene' : 'own'; }
    const material = mark.mesh.material;
    if (!material.clippingPlanes || material.clippingPlanes[0] !== water) { material.clippingPlanes = [water]; material.needsUpdate = true; }

    const qs = window.__FLOW2_QUALITY__?.pick?.(1, .6, .5) ?? 1;   // flow2 quality: the refracted picture smaller at medium / low
    const w = readBuffer.width, h = readBuffer.height, cw = Math.max(4, Math.round(w * T.copyScale * qs)), ch = Math.max(4, Math.round(h * T.copyScale * qs));
    if (copyRT.width !== cw || copyRT.height !== ch) copyRT.setSize(cw, ch);
    if (markRT.width !== w || markRT.height !== h) markRT.setSize(w, h);
    const target = r.getRenderTarget(), autoClear = r.autoClear, clipping = r.localClippingEnabled;
    _clear.color ||= new THREE.Color(); r.getClearColor(_clear.color); _clear.alpha = r.getClearAlpha();
    blit.material.uniforms.tScene.value = readBuffer.texture; over.material.uniforms.uMax.value = Math.max(.2, T.maxBright);
    r.setRenderTarget(copyRT); r.render(blit.scene, blit.camera);                 // what the glass refracts
    r.localClippingEnabled = true; r.autoClear = true; r.setClearColor(0x000000, 0);
    r.setRenderTarget(markRT); r.render(scene2, camera);                           // the glass alone
    r.localClippingEnabled = clipping; r.autoClear = false; r.setClearColor(_clear.color, _clear.alpha);
    r.setRenderTarget(readBuffer); r.render(over.scene, blit.camera);              // over the picture
    r.autoClear = autoClear; r.setRenderTarget(target);
  }
})();
