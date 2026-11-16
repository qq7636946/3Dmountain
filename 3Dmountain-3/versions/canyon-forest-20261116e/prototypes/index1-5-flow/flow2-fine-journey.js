/* Flow2 fine picture, the journey (2026-11-11): the opening screen, the wordmark, the canyon and FOUR PATHS drawn finer, on
   index1-5-flow2.html only. Client: 「主要是畫面的細緻度加強」.
   Loaded before main.js and after flow2-water.js / flow2-sea.js. ?fine=0 leaves it out (the picture as it was).

   What made the picture coarse, and what this does about each:
   1. FILM. A film-grain sheet lay over the whole page (.alp-grain, made by alpine-ui.js: white noise, blended at 6%, jumping six
      times a second). It put a speckle of about ±5 grey levels on every smooth surface, the sky first of all, and it moved.
      While the journey is on screen it is taken off: everywhere the page is not in the world or on the cards (body.is-world /
      .is-portfolio), which is exactly where flow2-fine-world.js takes it off, so with both files it is gone from the whole
      page and it does not blink on at the hand-over. Alone, this file lets it fade back for the world half.
      (T.film = 'page' takes it off everywhere by itself.) The canvas has its own still, sub-visible dither, so the
      gradients do not band.
   2. SCALE. On a screen with one device pixel per CSS pixel the scene was drawn at exactly that: every thin highlight, far ridge
      and rock detail was at the limit of the grid. A capable desktop now draws the journey at 1.5 pixels per CSS pixel and the
      browser scales it down (what a high-density screen already got; the engine's own limit of 1.65 still holds, and so does a
      ceiling on the total number of pixels). The terrain shaders fade their detail by the size of a pixel on the rock, so the
      finer grid also brings in a finer layer of relief on the canyon walls.
      It gives way: phones, tablets, weak or software GPUs and screens that are already dense never get it; if the frames come
      slower than the screen's beat for a second and a half it is taken away for the rest of the visit (one resize), before the
      engine's own governor has to act; and whenever that governor is below 1 it is off.
   3. EDGES. With the finer scale in force, one last full-screen step steepens soft edges a little (an unsharp mask that leaves
      anything under 1.5 grey levels alone, so it cannot bring speckle back, and that may not pass the brightest or darkest
      neighbour by more than 6 levels, so it cannot draw halos). It is off whenever the finer scale is off: no cost elsewhere.
   4. ROCK. The canyon walls' joints, ribs and grain were sized for a wall seen from far off: from the river, 2.4 units above
      the water, one rib is a hand wide on the screen and the wall reads as soft plaster. The WALLS ONLY (the bank shader, not
      the mountains seen from the air, not the shore stones) get their own, smaller fracture size, and a shallower relief
      with it: a finer grain. (Smaller AND deeper was tried: every rib edge the low canyon sun grazes lights up, and the
      shaded walls fill with white scratches.) Constant values: nothing eases with the scroll, so nothing crawls on the
      rock. The tuner's dials still drive them.
   5. GRAZING. The terrain's photographs and relief maps were filtered at 4 samples along the view; the canyon walls are seen
      almost edge-on, where that smears. They get the GPU's full anisotropy (a sampler setting: no upload, no shader change).

   main.js calls renderScale() from its resize(), attach() once (it hands over resize() and the composer), and canyon() when
   the canyon is built. Each does nothing if this file is absent. window.__FLOW2_FINE_JOURNEY__.state tells what is in force. */
(() => {
  const Q = new URLSearchParams(location.search);
  if (Q.get('fine') === '0') return;
  const html = document.documentElement;
  const T = {
    film: 'journey',      // 'journey' = the film sheet is off while the journey is on screen; 'page' = off everywhere; 'keep' = as it was
    scale: 1.5,           // drawing scale asked for on a capable desktop whose screen has fewer pixels than this (?fineScale=1 = none)
    maxPixels: 4.2e6,     // never more drawn pixels than this (1.5 × a 1920 × 1080 window is just under it; a 2560 × 1440 window stays near 1)
    grace: 4,             // seconds after the entry screen before the frames are judged (the engine is still warming up)
    sharpen: .8,          // edge step: how much of the difference from the neighbours is added back (0 = no step at all)
    sharpenCore: 1.5 / 255,   // differences under this are left alone (the dither, soft gradients)
    sharpenOver: 6 / 255,     // how far past its brightest / darkest neighbour a pixel may go
    rockScale: .6,        // canyon walls: fracture size × this (the tuner's rockScale dial still multiplies it)
    rockDetail: .7,       // canyon walls: relief strength × this (the tuner's rockDetail dial still multiplies it)
    anisotropy: 16        // along-the-view filtering of the terrain maps (the GPU's own maximum if that is lower)
  };
  const num = (key, lo, hi) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null; };
  { const v = num('fineScale', 1, 2); if (v !== null) T.scale = v; }
  { const v = num('fineSharp', 0, 2); if (v !== null) T.sharpen = v; }
  { const v = num('fineRock', .3, 2); if (v !== null) T.rockScale = v; }
  { const f = Q.get('fineFilm'); if (f === 'page' || f === 'keep' || f === 'journey') T.film = f; }

  /* ------------------------------------------------------------------ 1. the film sheet */
  const style = document.createElement('style');
  style.id = 'flow2-fine-journey-style';
  style.textContent = `
html[data-flow2-fine-film] .alp-grain { transition: opacity .8s linear; }
html[data-flow2-fine-film="journey"] body:not(:is(.is-world, .is-portfolio)) .alp-grain,
html[data-flow2-fine-film="page"] .alp-grain { opacity: 0 !important; animation: none !important; }
@media (prefers-reduced-motion: reduce) { html[data-flow2-fine-film] .alp-grain { transition: none; } }
`;
  (document.head || html).append(style);
  if (T.film !== 'keep') html.dataset.flow2FineFilm = T.film;

  /* ------------------------------------------------------------------ 2. the drawing scale */
  const KEY = 'flow2-fine-scale';
  const state = { scale: 0, why: 'not asked yet', gpu: '', dropped: null, sharpen: false, rock: 0, anisotropy: 0, maps: 0 };
  let off = false, engine = null, watching = false, edgePass = null;
  /* QUALITY_HOLD (2026-11-16, client: 「畫質降級先等未來再做」): while flow2-quality.js holds the top tier (always, unless ?qualityTiers=1) the finer
     scale is never taken away, and an earlier "too heavy" of this tab is forgotten */
  const HELD = Q.get('qualityTiers') !== '1';
  if (HELD) { try { sessionStorage.removeItem(KEY); } catch { /* no storage */ } }
  try { if (!HELD && sessionStorage.getItem(KEY) === 'off' && !Q.has('fineScale')) { off = true; state.why = 'this visit already found it too heavy'; } } catch { /* no storage */ }
  /* GPUs that are not asked: software renderers, phone chips, and Intel's integrated ones other than Arc / Iris Xe */
  const WEAK = /swiftshader|llvmpipe|softpipe|basic render|mali|adreno|powervr|videocore|apple a\d|\bintel\b(?![^,]*\b(arc|iris\(r\) xe|iris xe)\b)/i;
  const edges = () => {
    if (!edgePass) return;
    const U = edgePass.uniforms;
    U.uAmount.value = T.sharpen; U.uCore.value = T.sharpenCore; U.uOver.value = T.sharpenOver;
    edgePass.enabled = state.scale > 0 && T.sharpen > 0; state.sharpen = edgePass.enabled;
  };
  const drop = why => {
    if (off || HELD) return;
    off = true; state.dropped = why; state.why = 'taken away: ' + why; state.scale = 0; edges();
    try { sessionStorage.setItem(KEY, 'off'); } catch { /* no storage */ }
  };
  /* Called from main.js's resize(): the scale to draw at, or 0 for the screen's own. main.js still caps it at its budget. */
  function renderScale({ budget, governor = 1 } = {}) {
    const no = why => { state.scale = 0; if (!off) state.why = why; edges(); return 0; };
    if (off) return 0;
    if (!budget || budget.mobile || !(budget.sceneSamples > 0) || html.hasAttribute('data-flow2-low-gpu')) return no('phone or low-power drawing budget');
    if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) return no('touch device');
    if (governor < 1) { drop('the engine lowered its resolution'); return 0; }
    if (state.gpu && WEAK.test(state.gpu)) return no('GPU not asked: ' + state.gpu);
    const native = devicePixelRatio || 1;
    const scale = Math.min(T.scale, budget.dpr || 1, Math.sqrt(T.maxPixels / Math.max(1, innerWidth * innerHeight)));
    if (!(scale > native + .05)) return no('the screen is already this dense');
    state.scale = Math.round(scale * 100) / 100; state.why = 'on'; edges();
    if (!watching) watch();
    return state.scale;
  }
  /* Its own judge, quicker and stricter than the engine's governor (which waits for two seconds under 41 fps and then takes
     15% off whatever is drawn): more than half the frames of two windows running later than the screen's beat, and the
     finer scale goes. Only the journey's own frames count (not the entry screen, not while the world or the cards cover it). */
  function watch() {
    watching = true;
    let last = 0, start = -1, slow = 0, beat = 16.7, since = -1;
    const gaps = [];
    const idle = () => { gaps.length = 0; start = -1; slow = 0; };
    const tick = now => {
      if (off) { watching = false; return; }
      requestAnimationFrame(tick);
      const dt = now - last; last = now;
      if (!state.scale || !(dt > 0) || document.visibilityState === 'hidden') return idle();
      const S = window.__MONTIS_STUDY__;
      if (/^(boot|live)$/.test(window.__GATE__?.state || '') || !S) { since = -1; return idle(); }
      if (since < 0) since = now;
      if (now - since < T.grace * 1000 || S.world?.covering || S.portfolio?.covering || S.runtimeQuality?.covered) return idle();
      if (start < 0) { start = now; return; }
      if (dt <= 200) gaps.push(dt);
      if (now - start < 750) return;
      const n = gaps.length, sorted = gaps.slice().sort((a, b) => a - b); gaps.length = 0; start = now;
      if (n < 9) { slow = 0; return; }                                   // a throttled tab is not a slow device
      const median = sorted[n >> 1];
      beat = Math.min(beat, Math.max(6.5, sorted[Math.floor(n * .2)]));   // the screen's beat: the quickest steady gap seen
      if (median > 24 && sorted[Math.floor(n * .9)] - sorted[Math.floor(n * .1)] < 1.5) { slow = 0; return; }   // a capped screen
      state.median = Math.round(median * 10) / 10; state.beat = Math.round(beat * 10) / 10;
      slow = median > Math.min(20.9, Math.max(beat * 1.25, 12.5)) ? slow + 1 : 0;
      if (slow >= 2) { drop('frames slower than the screen (' + state.median + ' ms)'); try { engine?.resize?.(); } catch { /* the next resize applies it */ } }
    };
    requestAnimationFrame(now => { last = now; requestAnimationFrame(tick); });
  }

  /* ------------------------------------------------------------------ 3. the edge step */
  function buildEdgePass({ THREE, composer, ShaderPass }) {
    if (!THREE || !composer?.addPass || !ShaderPass || !(T.sharpen > 0)) return;
    const pass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) }, uAmount: { value: T.sharpen }, uCore: { value: T.sharpenCore }, uOver: { value: T.sharpenOver } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `precision highp float;
uniform sampler2D tDiffuse;uniform vec2 uTexel;uniform float uAmount,uCore,uOver;varying vec2 vUv;
void main(){
  vec4 c=texture2D(tDiffuse,vUv);
  vec3 n=texture2D(tDiffuse,vUv+vec2(0.,uTexel.y)).rgb,s=texture2D(tDiffuse,vUv-vec2(0.,uTexel.y)).rgb;
  vec3 e=texture2D(tDiffuse,vUv+vec2(uTexel.x,0.)).rgb,w=texture2D(tDiffuse,vUv-vec2(uTexel.x,0.)).rgb;
  vec3 lo=min(c.rgb,min(min(n,s),min(e,w))),hi=max(c.rgb,max(max(n,s),max(e,w)));
  vec3 d=c.rgb-(n+s+e+w)*.25;
  d=sign(d)*max(abs(d)-uCore,0.);
  gl_FragColor=vec4(clamp(c.rgb+d*uAmount,lo-uOver,hi+uOver),c.a);
}`
    });
    pass.setSize = (width, height) => pass.uniforms.uTexel.value.set(1 / Math.max(1, width), 1 / Math.max(1, height));
    pass.enabled = false;
    composer.addPass(pass);
    edgePass = pass;
  }
  /* Called once from main.js before its first resize(). */
  function attach(handles = {}) {
    engine = handles;
    try {
      const gl = handles.renderer?.getContext?.(), info = gl?.getExtension('WEBGL_debug_renderer_info');
      state.gpu = String((info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl?.getParameter(gl.RENDERER) || '');
    } catch { state.gpu = ''; }
    if (!handles.mobileRenderBudget?.mobile) buildEdgePass(handles);
  }

  /* ------------------------------------------------------------------ 4. the canyon walls' rock, 5. the terrain maps */
  /* The alpine material shares one set of uniforms between the walls (ALP_BANK), the shore stones and the mountains seen from
     the air. The walls' program is given its own two, which follow the shared dials times T. */
  function finerRock(built) {
    if (!built?.scene || (T.rockScale === 1 && T.rockDetail === 1)) return;
    const mine = { uRockScale: { value: T.rockScale }, uRockDetail: { value: T.rockDetail } };
    let shared = null;
    const seen = new Set();
    built.scene.traverse(object => {
      for (const material of [].concat(object.material || [])) {
        if (!material?.userData?.alpineTerrain || seen.has(material) || typeof material.onBeforeCompile !== 'function') continue;
        seen.add(material);
        const compile = material.onBeforeCompile, draw = material.onBeforeRender, key = material.customProgramCacheKey;
        material.onBeforeCompile = function (shader, renderer) {
          compile.call(this, shader, renderer);
          if (!shader.fragmentShader.includes('#define ALP_BANK\n') || !shader.uniforms.uRockScale || !shader.uniforms.uRockDetail) return;
          shared ||= { scale: shader.uniforms.uRockScale, detail: shader.uniforms.uRockDetail };
          shader.uniforms.uRockScale = mine.uRockScale; shader.uniforms.uRockDetail = mine.uRockDetail;
        };
        material.onBeforeRender = function (...args) {
          draw?.apply(this, args);
          if (shared) { mine.uRockScale.value = Math.max(.25, shared.scale.value * T.rockScale); mine.uRockDetail.value = Math.min(2.5, shared.detail.value * T.rockDetail); }
        };
        material.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|flow2-fine-rock-1'; };
        material.needsUpdate = true;
        state.rock++;
      }
    });
  }
  /* The maps may already be on the GPU (main.js uploads them while the terrain is building), so the sampler is set in place:
     marking them changed would upload every one of them again. */
  function grazing({ renderer, terrainTextures }) {
    if (!renderer || typeof terrainTextures !== 'function') return;
    const max = Math.min(T.anisotropy, renderer.capabilities.getMaxAnisotropy?.() || 1);
    if (!(max > 4)) return;
    Promise.resolve(terrainTextures()).then(list => {
      const gl = renderer.getContext(), ext = renderer.extensions.get('EXT_texture_filter_anisotropic');
      for (const texture of list || []) {
        if (!texture?.isTexture || texture.anisotropy >= max) continue;
        texture.anisotropy = max;
        const slot = renderer.properties.get(texture);
        if (slot.__webglTexture && ext) {
          renderer.state.bindTexture(gl.TEXTURE_2D, slot.__webglTexture);
          gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
          slot.__currentAnisotropy = max;
          renderer.state.unbindTexture();
        }
        state.maps++;
      }
      state.anisotropy = max;
    }).catch(error => console.warn('flow2 fine: terrain maps left as they were', error));
  }
  /* Called from main.js when the canyon is built, before its shaders compile. Phones keep theirs as it was. */
  function canyon(handles = {}) {
    if (engine?.mobileRenderBudget?.mobile || handles.lite) return;
    try { finerRock(handles.canyon); } catch (error) { console.warn('flow2 fine: canyon rock left as it was', error); }
    grazing(handles);
  }

  /* tune = the values above (change one, then call refresh() for the edge step; the rock follows by itself) */
  window.__FLOW2_FINE_JOURNEY__ = { renderScale, attach, canyon, tune: T, state, drop, refresh: edges };
  html.dataset.flow2FineJourney = 'on';
})();
