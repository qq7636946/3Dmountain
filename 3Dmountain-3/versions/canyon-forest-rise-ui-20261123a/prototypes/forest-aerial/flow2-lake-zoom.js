/* Flow2 · after FOUR PATHS: the view becomes 3D lines, the lens dives into the lake, the next block (team F3, 2026-11-16). index1-5-canyon-forest.html.
   Client: 「往下滾直接往湖泊放大+轉場到下一頁就好 不要放大又縮小，往下滾的流程是變成3D線條如圖1，然後往湖泊放大後 …oceanx… 這種中間放大Webgl放大轉場，
   然後下個區塊你隨便用假文案假區塊先放就好」 and 「但都要注意效能問題」.

   When the journey stands at its end (FOUR PATHS), the wheel / keys / touch that flow2-scope.js used to swallow drive one more progress, A (0 → 1):
     A 0   → .34  LINES  the view turns into 3D lines (team F2: window.__FLOW2_LATTICE__.set; feature-detected) and the chapter's copy, labels and
                         rail step aside (the header stays);
     A .34 → .82  ZOOM   the lens dives straight into the lake's centre (the scene's setZoom: aim to the lake, tilt to straight down, distance to 6 %;
                         it only ever gets closer) and, as at OceanX, a round window in the middle magnifies the water under a fine blue grid with
                         cross ticks and grows until it fills the screen; the lines give way to the lake's real water on the way down;
     A .82 → 1    NEXT   the next block (placeholder copy, plain HTML/CSS) comes up over the water; at 1 it is a normal scrolling page.
   Scrolling back at the top of the next block runs it all backwards. Nothing moves on its own: A eases to where the hand put it, then the loop stops.
   Cost: the lens is ONE full-screen pass, only while the zoom runs (flow2-forest-atlas.js calls lens() after drawing the view); once the next
   block covers the screen the view is not drawn at all (the atlas reads .covered). ?after=0 = the page ends at FOUR PATHS as before.
   Live: window.__FLOW2_AFTER__ = { state, tune, set(a), … }.

   SINCE THE SAME DAY (client: 「俯視的轉場直接跟山道>俯視的方法一樣就好，只是俯視的轉場是中間打開， 網格跟放大就不用了」) the default is the
   'open' mode: the same hand-over as the canyon → view (flow2-lift-cut.js's brush: its duration, its ease, its feathered bristled edge, both
   pictures dragged a little where the brush is), only it OPENS FROM THE CENTRE outward. The first turn of the wheel past FOUR PATHS starts it
   and it plays on time (the visitor's input meanwhile is absorbed); the view is painted away to the next block's ground, then the block's
   HTML takes over and its content comes in. At the top of the block, about two notches up (the stroke's own threshold) close it the same
   way, towards the centre, and the view is back as it was. No lines, no dive, no window, no tilt. While it plays html[data-flow2-brush] is
   set ('after-in' / 'after-out'), as the canyon's stroke does. ?after=lines = the lines → dive → window segment above. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('after') === '0') return;
  /* team LZ (2026-11-17): the default is now THE DIVE (flow2-lake-dive.js, OceanX-style continuous dive into the screen centre); ?after=open = the
     centre-opening brush of 11-16 unchanged; ?after=lines = the lines → dive → window segment. The dive reuses the open mode's clock, hand and block. */
  const DIVE = window.__FLOW2_LAKE_DIVE__ || null;
  const MODE = Q.get('after') === 'lines' ? 'lines' : (Q.get('after') === 'open' || !DIVE) ? 'open' : 'dive';
  const OPENLIKE = MODE !== 'lines';
  const html = document.documentElement;
  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { return false; } })();
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const T = {
    travel: num('afterTravel', 1500),   // wheel pixels for the whole of A (about 15 notches)
    follow: 5.5,                         // how fast A follows the hand (1/s)
    lines: [0, .34], zoom: [.34, .82], next: [.82, 1],
    lensFrom: .17,                       // the window's radius at the start of the zoom (share of the screen's short side)
    lensTo: 1.95,                        // … at its end (beyond every corner, the feather included, on wide and tall screens)
    feather: [.10, .42],                 // the feather's width at the start and the end of the zoom (short-side units)
    edgeNoise: .22,                      // how far the noise breaks the edge (share of the radius); it calms toward the end
    tilt: num('afterTilt', 30),       // degrees the lens tilts up during the lines (eased back during the dive)
    mag: .85,                            // extra magnification in the middle of the zoom (1 + mag at the peak, back to 1 at the end)
    grid: 1,                             // the grid's strength
    linesOut: [.12, .6]                  // during the zoom (share of the zoom) the lines dissolve as the window spreads
  };
  const NOLENS = Q.get('afterLens') === '0';
  const S = { a: 0, target: 0, stage: 'off', covered: false, lens: 0, lattice: 0, zoom: 0, loop: false, steps: 0 };
  const clamp01 = v => Math.min(1, Math.max(0, v)), seg = (a, r) => clamp01((a - r[0]) / (r[1] - r[0])), smooth = t => t * t * (3 - 2 * t);
  const study = () => window.__MONTIS_STUDY__, forest = () => window.__FLOW2_FOREST_ATLAS__?.scene || null;

  /* ---------------- the next block (placeholder copy; plain HTML/CSS) ---------------- */
  let block = null, scroller = null;
  let styled = false;
  function buildStyle() {
    if (styled) return; styled = true;
    const style = document.createElement('style');
    style.textContent = `
      .f2-next { position: fixed; inset: 0; z-index: 6; opacity: 0; visibility: hidden; pointer-events: none; transform: translate3d(0, 6vh, 0);
        background: radial-gradient(120% 90% at 50% 0%, #10314f 0%, #0a1d33 46%, #061222 100%); color: #e9f2ff; }
      .f2-next.is-on { visibility: visible; }
      .f2-next.is-in { pointer-events: auto; }
      .f2-next::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .35;
        background-image: linear-gradient(rgb(140 190 255 / .10) 1px, transparent 1px), linear-gradient(90deg, rgb(140 190 255 / .10) 1px, transparent 1px);
        background-size: 64px 64px; mask-image: radial-gradient(90% 70% at 50% 30%, #000 30%, transparent 85%); -webkit-mask-image: radial-gradient(90% 70% at 50% 30%, #000 30%, transparent 85%); }
      .f2-next-scroll { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
      .f2n-wrap { max-width: 1180px; margin: 0 auto; padding: clamp(120px, 18vh, 200px) clamp(20px, 5vw, 64px) 120px; position: relative; }
      .f2n-kicker { font: 500 12px/1 "Oswald", "Noto Sans TC", sans-serif; letter-spacing: .28em; color: #8fc6ff; margin: 0 0 22px; text-transform: uppercase; }
      .f2n-title { font: 500 clamp(44px, 6.4vw, 86px)/1.02 "Oswald", "Noto Sans TC", sans-serif; letter-spacing: -.01em; margin: 0 0 22px; text-transform: uppercase; }
      .f2n-lead { font: 500 clamp(17px, 1.6vw, 22px)/1.6 "Noto Sans TC", sans-serif; color: #cfe2fb; margin: 0 0 14px; }
      .f2n-body { font: 400 15px/1.9 "Noto Sans TC", sans-serif; color: rgb(207 226 251 / .78); max-width: 620px; margin: 0 0 34px; }
      .f2n-cta { display: inline-flex; align-items: center; gap: 14px; height: 50px; padding: 0 8px 0 24px; border-radius: 999px; border: 1px solid rgb(255 255 255 / .38);
        background: rgb(255 255 255 / .1); color: #fff; font: 500 13px/1 "Oswald", sans-serif; letter-spacing: .14em; text-decoration: none; }
      .f2n-cta i { width: 34px; height: 34px; border-radius: 50%; background: #0b1d33; display: grid; place-items: center; font-style: normal; }
      .f2n-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin: clamp(80px, 12vh, 140px) 0 0; }
      .f2n-card { padding: 30px 28px 34px; border-radius: 18px; border: 1px solid rgb(160 205 255 / .2); background: rgb(255 255 255 / .04); }
      .f2n-card b { display: block; font: 500 13px/1 "Oswald", sans-serif; letter-spacing: .2em; color: #8fc6ff; margin-bottom: 18px; }
      .f2n-card h3 { font: 500 26px/1.2 "Oswald", "Noto Sans TC", sans-serif; margin: 0 0 12px; letter-spacing: .02em; }
      .f2n-card p { font: 400 14px/1.85 "Noto Sans TC", sans-serif; color: rgb(207 226 251 / .76); margin: 0; }
      .f2n-band { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin: clamp(70px, 10vh, 120px) 0 0; padding: 40px 0; border-top: 1px solid rgb(160 205 255 / .18); border-bottom: 1px solid rgb(160 205 255 / .18); }
      .f2n-band div { text-align: center; }
      .f2n-band strong { display: block; font: 500 clamp(40px, 4.6vw, 64px)/1 "Oswald", sans-serif; color: #fff; }
      .f2n-band span { display: block; margin-top: 10px; font: 400 14px/1.6 "Noto Sans TC", sans-serif; color: rgb(207 226 251 / .72); }
      .f2n-note { margin: 70px 0 0; font: 500 11px/1 "Oswald", sans-serif; letter-spacing: .3em; color: rgb(207 226 251 / .45); text-align: center; }
      @media (max-width: 760px) { .f2n-cards, .f2n-band { grid-template-columns: 1fr; } }
      /* while A runs, the chapter's own copy, labels and rail step aside (the header stays) */
      :root:not(#a1):not(#a2):not(#a3):not(#a4):not(#a5):not(#a6):not(#a7):not(#a8)[data-flow2-after]:not([data-flow2-after="off"]) :is(.finnovation-ui .fi-copy, .finnovation-ui .fi-rail, .finnovation-ui .fi-footer, .finnovation-ui .f2u-side, .f2u-lock, .f2td-layer, .alp-labels, #flow2-canyon-atlas, .fi-copy-panel) {
        opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; transition: opacity .6s ease, visibility 0s linear .6s !important; }
      /* THE DIVE: the interface leaves quickly (the dive itself is 1.5 s) */
      :root:not(#a1):not(#a2):not(#a3):not(#a4):not(#a5):not(#a6):not(#a7):not(#a8)[data-flow2-after][data-flow2-dive]:not([data-flow2-after="off"]) :is(.finnovation-ui .fi-copy, .finnovation-ui .fi-rail, .finnovation-ui .fi-footer, .finnovation-ui .f2u-side, .f2u-lock, .f2td-layer, .alp-labels, #flow2-canyon-atlas, .fi-copy-panel) {
        transition: opacity .3s ease, visibility 0s linear .3s !important; }
      /* …and the next block stands on the dive's last picture (the close water sunk into navy): a light veil of its own ground, no grid; its copy rises in */
      .f2-next.is-dive { background: radial-gradient(120% 90% at 50% 0%, rgb(16 49 79 / .34) 0%, rgb(10 29 51 / .3) 46%, rgb(6 18 34 / .42) 100%); }
      .f2-next.is-dive::before { display: none; }
      .f2-next.is-dive .f2n-wrap { transition: transform 1.1s cubic-bezier(.2, .7, .2, 1), opacity .8s ease; }
      .f2-next.is-dive:not(.is-in) .f2n-wrap { transform: translate3d(0, 28px, 0); opacity: 0; }
      /* …and nothing inside them takes the pointer or a touch (a faded button's inner spans kept pointer-events: auto and caught the finger).
         SMOOTH (2026-11-22): that used to be one more rule over every descendant (… :is(…) * { pointer-events: none }); a universal last
         compound makes each change of data-flow2-after (four per trip: opening / in / closing / off) restyle the whole document — measured
         19–25 ms each on the rise page. Now the faded parts turn visibility: hidden once their fade is done (above: inherited, so their
         descendants take no pointer either; on screen nothing changes, they are at opacity 0 by then). */
`;
    document.head.append(style);
  }
  function buildBlock() {
    if (block) return;
    buildStyle();
    block = document.createElement('section');
    block.className = 'f2-next'; block.setAttribute('aria-label', '下一個區塊（暫用文案）'); block.setAttribute('aria-hidden', 'true'); block.inert = true;
    block.innerHTML = `<div class="f2-next-scroll"><div class="f2n-wrap">
      <p class="f2n-kicker">03 · Why Finnovation · 暫用文案</p>
      <h2 class="f2n-title">Depth beneath<br>the surface</h2>
      <p class="f2n-lead">在水面之下，看見價值真正的流向</p>
      <p class="f2n-body">這裡是下一個區塊的暫用文案。恒灝以研究為本、以紀律為綱，從四大投資領域的交會處出發，尋找能長期累積的價值。正式內容確認後替換。</p>
      <a class="f2n-cta" href="#" onclick="return false">了解我們的方法<i>→</i></a>
      <div class="f2n-cards">
        <div class="f2n-card"><b>01</b><h3>洞察 Insight</h3><p>暫用文案：以科技與研究洞察市場，從資料裡看見趨勢的起點。</p></div>
        <div class="f2n-card"><b>02</b><h3>紀律 Discipline</h3><p>暫用文案：以一致的流程與風險控管，讓每一次決策都經得起時間。</p></div>
        <div class="f2n-card"><b>03</b><h3>長期 Long term</h3><p>暫用文案：與企業、人才與資本一起成長，讓價值持續流向它該去的地方。</p></div>
      </div>
      <div class="f2n-band"><div><strong>4</strong><span>大投資領域（暫用）</span></div><div><strong>12+</strong><span>年研究累積（暫用）</span></div><div><strong>100%</strong><span>長期導向（暫用）</span></div></div>
      <p class="f2n-note">PLACEHOLDER · 內容準備中</p>
    </div></div>`;
    document.body.append(block);
    scroller = block.querySelector('.f2-next-scroll');
  }

  /* ---------------- the lens pass (built on first use; one full-screen pass, only while the zoom runs) ---------------- */
  let lensMat = null, lensScene = null, lensCam = null, lensRT = null, forestTex = null, passRef = null, THREEref = null;
  const LENS_FRAG = `
    uniform sampler2D tSrc; uniform vec2 uRes, uCenter; uniform vec4 uLens, uLens2; varying vec2 vUv;
    /* uLens = (amount, radius, magnification, grid); uLens2 = (feather width, edge noise, progress, -) */
    float lzHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float lzNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(lzHash(i), lzHash(i + vec2(1., 0.)), f.x), mix(lzHash(i + vec2(0., 1.)), lzHash(i + 1.), f.x), f.y); }
    void main(){
      float m = min(uRes.x, uRes.y);
      vec2 p = (vUv - uCenter) * uRes / m;                          /* square units: 1 = the screen's short side */
      float d = length(p), z = uLens2.z;
      /* the edge spreads like ink in water: a smooth noise of the place (it moves only with the progress, never by itself) */
      float n = lzNoise(p * 2.3 + vec2(1.7, 4.1) + z * .9) * .65 + lzNoise(p * 5.1 + vec2(7.3, 2.9) - z * 1.3) * .35;
      float R = uLens.y * (1. + uLens2.y * (n * 2. - 1.));
      float F = uLens2.x;
      float open = 1. - smoothstep(R - F, R + F * .35, d);           /* 1 inside, a wide soft feather, 0 outside */
      vec2 q = p / mix(1., uLens.z, open);                           /* magnified as it opens */
      vec3 inner = texture2D(tSrc, uCenter + q * m / uRes).rgb;
      vec3 outer = texture2D(tSrc, vUv).rgb;
      float l = dot(outer, vec3(.2126, .7152, .0722));
      outer = mix(outer, vec3(l), .3 * uLens.x) * (1. - .3 * uLens.x * (1. - open));   /* outside: a little quieter */
      vec3 col = mix(outer, inner, open);
      /* the fine grid and its cross ticks live only inside, fading out through the feather */
      float g = .048, px = 1. / m;
      vec2 gq = q / g, fw = fwidth(gq), f2 = abs(fract(gq - .5) - .5) / max(fw, vec2(1e-4));
      float line = 1. - min(min(f2.x, f2.y), 1.);
      vec2 tf = abs(fract(q / (g * 4.) - .5) - .5) * 4. * g / px;
      float tick = (1. - smoothstep(.6, 1.4, min(tf.x, tf.y))) * (1. - smoothstep(5., 6.5, max(tf.x, tf.y)));
      col += vec3(.42, .70, 1.) * (line * .14 + tick * .5) * uLens.w * smoothstep(.55, 1., open);
      gl_FragColor = vec4(col, 1.);
    }`;
  function buildLens(THREE) {
    THREEref = THREE;
    lensMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uCenter: { value: new THREE.Vector2(.5, .5) }, uLens: { value: new THREE.Vector4() }, uLens2: { value: new THREE.Vector4() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: LENS_FRAG, depthTest: false, depthWrite: false, toneMapped: false });
    lensScene = new THREE.Scene(); lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMat); quad.frustumCulled = false; lensScene.add(quad);
    lensRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  }
  const projected = { x: .5, y: .5 };
  /* called by flow2-forest-atlas.js right after it drew the view into its buffer (that buffer bound, tone mapping off) */
  function lens(renderer, src, pass, atlas, THREE) {
    if (!pass || !src) return;
    passRef = pass; if (!forestTex) forestTex = src.texture;
    if (MODE === 'open') { openPass(renderer, src, pass, THREE); return; }
    if (MODE === 'dive') { divePass(renderer, src, pass, atlas, THREE); return; }
    if (S.lens <= .001) { if (pass.uniforms.tForest.value !== src.texture) pass.uniforms.tForest.value = src.texture; return; }
    if (!lensMat) buildLens(THREE);
    if (lensRT.width !== src.width || lensRT.height !== src.height) lensRT.setSize(src.width, src.height);
    const F = forest();
    if (F && F.lake && F.camera && THREE) { const v = new THREE.Vector3().copy(window.__RISE_FALLS__?.diveTarget || F.lake.center).project(F.camera);   /* RISE FALLS: the pool, where the lake is a gorge */ if (Number.isFinite(v.x)) { projected.x = v.x * .5 + .5; projected.y = v.y * .5 + .5; } }
    const U = lensMat.uniforms, z = S.zoomT;
    U.tSrc.value = src.texture; U.uRes.value.set(src.width, src.height); U.uCenter.value.set(projected.x, projected.y);
    const grow = smooth(z);
    U.uLens.value.set(S.lens, T.lensFrom + (T.lensTo - T.lensFrom) * grow * grow, 1 + T.mag * Math.sin(Math.PI * z), T.grid * S.lens * (1 - smooth(clamp01((z - .65) / .3))));
    U.uLens2.value.set(T.feather[0] + (T.feather[1] - T.feather[0]) * grow, T.edgeNoise * (1 - .7 * grow), z, 0);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(lensRT); renderer.render(lensScene, lensCam); renderer.setRenderTarget(prev);
    pass.uniforms.tForest.value = lensRT.texture;
  }

  /* ---------------- A → the scene ---------------- */
  function apply() {
    const a = S.a;
    const lines = smooth(seg(a, T.lines)), zt = seg(a, T.zoom), nx = smooth(seg(a, T.next));
    S.zoomT = zt;
    const stage = a <= 1e-4 ? 'off' : a < T.lines[1] ? 'lines' : a < T.zoom[1] ? 'zoom' : a < .999 ? 'next' : 'in';
    if (stage !== S.stage) { S.stage = stage; html.dataset.flow2After = stage; }
    /* the lines (F2), giving way to the lake's real water during the dive */
    const giveWay = smooth(clamp01((zt - T.linesOut[0]) / (T.linesOut[1] - T.linesOut[0])));
    S.lattice = lines * (1 - giveWay);
    try { window.__FLOW2_LATTICE__?.set?.(S.lattice); } catch (error) { }
    /* the dive */
    S.zoom = smooth(zt);
    try { forest()?.setZoom?.(S.zoom); } catch (error) { }
    /* the lines are seen from an oblique lens (the client's picture 1: rolling wire terrain): the lens tilts up with the lines, then the tilt
       eases back while the dive takes it straight down — one move, never away from the lake. The entry offsets are shared with the canyon → view
       entrance (flow2-aerial-entry.js uses them only during its arrival); this file holds them only while A > 0 and lets go once at 0. */
    const F = forest();
    if (F && typeof F.setEntry === 'function') {
      if (a > 1e-4) { const tilt = T.tilt * lines * (1 - smooth(clamp01(zt / .7))); try { F.setEntry({ fore: tilt, side: 0, turn: 0, dist: 1 - .08 * lines * (1 - zt) }); } catch (error) { } S.entry = +tilt.toFixed(2); S.holding = true; }
      else if (S.holding) { try { F.setEntry(null); } catch (error) { } S.holding = false; S.entry = 0; }
    }
    /* the window: grows in over the first sixth of the zoom, gone at its end (the picture is then the plain dive) */
    S.lens = zt <= 0 || zt >= 1 ? 0 : smooth(clamp01(zt / .16)) * (1 - smooth(clamp01((zt - .9) / .1)));
    if (NOLENS) S.lens = 0;   /* ?afterLens=0: the dive without the window (to compare its cost) */
    /* the next block */
    if (nx > 0 || block) buildBlock();
    if (block) {
      block.style.opacity = nx.toFixed(3);
      block.style.transform = `translate3d(0, ${((1 - nx) * 6).toFixed(2)}vh, 0)`;
      block.classList.toggle('is-on', nx > 0);
      const inNow = a >= .999;
      if (block.classList.contains('is-in') !== inNow) { block.classList.toggle('is-in', inNow); block.inert = !inNow; block.setAttribute('aria-hidden', inNow ? 'false' : 'true'); }
    }
    const covered = a >= .995;
    if (covered !== S.covered) { S.covered = covered; if (covered && passRef && forestTex) passRef.uniforms.tForest.value = forestTex; }
  }
  let last = 0;
  function tick(now) {
    const dt = last ? Math.min(.1, (now - last) / 1000) : 1 / 60; last = now;
    const k = reduced ? 1 : 1 - Math.exp(-dt * T.follow);
    S.a += (S.target - S.a) * k;
    if (Math.abs(S.target - S.a) < 2e-4) S.a = S.target;
    S.steps++;
    apply();
    if (S.a !== S.target) requestAnimationFrame(tick); else { S.loop = false; last = 0; }
  }
  function setTarget(v) {
    S.target = clamp01(v);
    if (!S.loop) { S.loop = true; last = 0; requestAnimationFrame(tick); }
    if (S.target > 0) watchJourney();
  }
  /* if the journey leaves its end while A is open (the menu, the rail), A closes */
  let watching = 0;
  function watchJourney() {
    if (watching) return;
    watching = setInterval(() => {
      const J = study()?.journey;
      if (OPENLIKE) { if (O.phase === 'off') { clearInterval(watching); watching = 0; return; } if (J && J.target < J.max - .01 && O.phase === 'in') startClose(); return; }
      if (S.target <= 0 && S.a <= 0) { clearInterval(watching); watching = 0; return; }
      if (J && J.target < J.max - .01) setTarget(0);
    }, 400);
  }

  /* ---------------- OPEN MODE: the canyon → view brush, opening from the centre ---------------- */
  const O = { nativeAt: 0, phase: 'off', t: 0, brush: 0, t0: 0, upAsk: 0, upAt: 0, fadeUntil: 0 };
  S.open = O;
  const cutTune = () => (window.__FLOW2_LIFT_CUT__ && window.__FLOW2_LIFT_CUT__.tune) || {};
  const span = () => Math.max(.05, reduced ? (+cutTune().reduceFade || .3) : MODE === 'dive' ? (O.phase === 'closing' ? +DIVE.tune.closeTime || 1.2 : +DIVE.tune.time || 1.5) : (+cutTune().brushTime || 1.15));
  const BRUSH_FRAG = `
    uniform sampler2D tSrc; uniform vec2 uRes; uniform vec4 uB, uLook; varying vec2 vUv;
    /* uB = (progress 0..1, reduce, -, -); uLook = (-, soft, bristle, smear): the canyon stroke's own dials */
    float bH(float x){return fract(sin(x*127.1+.7)*43758.5453);}
    float bN2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=bH(i.x+i.y*57.),b=bH(i.x+1.+i.y*57.),c=bH(i.x+(i.y+1.)*57.),d=bH(i.x+1.+(i.y+1.)*57.);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
    vec3 lin(vec3 c){return pow(c,vec3(2.2));}
    void main(){
      float asp=uRes.x/uRes.y; vec2 p=(vUv-.5)*vec2(asp,1.);
      float s=length(p); vec2 dir=s>1e-5?p/s:vec2(1.,0.);
      float ext=.5*sqrt(asp*asp+1.);                        /* the half diagonal: at 1 every corner is covered */
      float band=.26*uLook.y;
      float f=mix(-band*1.3-.06,ext+band*1.05+.4,uB.x);
      /* the stroke's edge, bent round into a circle: fibres ahead, a softly broken band behind, a wide feather (as flow2-forest-atlas.js's brush) */
      float e=f+((bN2(dir*9.+7.7)-.5)*.06+(bN2(dir*3.+3.1)-.5)*.14)*uLook.z+pow(bN2(dir*30.+1.3),5.)*.06*uLook.z;
      float paint=1.-smoothstep(e-band*.9,e+band*.4,s);
      float behind=clamp((e-s)/band,0.,1.);
      float dry=smoothstep(.05,.95,bN2(dir*24.+vec2(s*2.,s*1.3))+behind*.7);
      float m=paint*mix(mix(1.,dry,.6*min(1.,uLook.z)),1.,smoothstep(.1,.9,behind));
      m=smoothstep(0.,1.,m);
      if(uB.y>.5)m=uB.x;                                     /* reduce motion: a plain cross-fade */
      float at=exp(-abs(s-e+band*.25)/(.12*uLook.y))*uLook.w;
      vec3 view=texture2D(tSrc,vUv+dir/vec2(asp,1.)*.016*at).rgb;   /* the view dragged outward a little where the brush is */
      /* the next block's ground: its CSS radial-gradient(120% 90% at 50% 0%, #10314f, #0a1d33 46%, #061222), in linear light */
      float gt=length(vec2((vUv.x-.5)/1.2,(1.-vUv.y)/.9));
      vec3 g=gt<.46?mix(vec3(.0627,.1922,.3098),vec3(.0392,.1137,.2),gt/.46):mix(vec3(.0392,.1137,.2),vec3(.0235,.0706,.1333),clamp((gt-.46)/.54,0.,1.));
      gl_FragColor=vec4(mix(view,lin(g),m),1.);
    }`;
  let brushMat = null, brushScene = null, brushRT = null;
  /* PERF ROUND (Team A, 2026-11-17; only with html[data-flow2-opt], not ?aerialopt=0): the opening used to compile its program and allocate its
     full-screen target on its own first frame (measured: a 53 ms frame on the RTX laptop, 80 ms at phone size; GPU spike 71 ms), and build the
     next block's DOM on its last. Now, while the visitor stands near FOUR PATHS, the program is compiled in the background (compileAsync), the
     target is allocated and the block is built hidden — all before the first frame of the stroke. The target is let go again (≈ 31 MB of GPU
     memory at 2820 × 1395) once the visitor has left the end of the journey with the stroke closed. Same picture, same timing. */
  const OPT = html.hasAttribute('data-flow2-opt') && Q.get('aerialopt') !== '0';
  const W = { compiled: false, asked: false, rt: false, block: false, freed: 0 };
  S.warm = W;
  function makeBrush(THREE) {
    if (brushMat) return;
    brushMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uB: { value: new THREE.Vector4() }, uLook: { value: new THREE.Vector4(0, 1.6, .45, .55) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: BRUSH_FRAG, depthTest: false, depthWrite: false, toneMapped: false });
    brushScene = new THREE.Scene(); const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), brushMat); quad.frustumCulled = false; brushScene.add(quad);
    brushRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    if (!lensCam) lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  function warmOpen(renderer, src, THREE) {
    const J = study()?.journey; if (!J || !Number.isFinite(J.max)) return;
    const near = J.progress > J.max - .6, away = J.progress < J.max - 1.6;
    if (near) {
      makeBrush(THREE);
      if (!W.asked && renderer.compileAsync) {
        W.asked = true;
        /* compiled with a target bound (the stroke draws into brushRT: linear output), on the driver's threads */
        const was = renderer.getRenderTarget(); let p = null;
        try { renderer.setRenderTarget(brushRT); p = renderer.compileAsync(brushScene, lensCam); } catch (error) { p = null; } finally { renderer.setRenderTarget(was); }
        if (p && p.then) p.then(() => { W.compiled = true; }, () => { W.compiled = 'at first use'; }); else W.compiled = 'at first use';
      }
      if (!W.rt || brushRT.width !== src.width || brushRT.height !== src.height) {
        /* allocate at the view's size now (a clear), not on the stroke's first frame */
        brushRT.setSize(src.width, src.height);
        const was = renderer.getRenderTarget(); try { renderer.setRenderTarget(brushRT); renderer.clear(true, false, false); } finally { renderer.setRenderTarget(was); }
        W.rt = true;
      }
      if (!W.block && !block) { W.block = 'asked'; const go = () => { if (!block) buildBlock(); W.block = true; }; if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 800 }); else setTimeout(go, 60); }
    } else if (away && W.rt && O.phase === 'off' && brushRT) { brushRT.setSize(4, 4); W.rt = false; W.freed++; }   /* three re-allocates at the new size: the big one is let go */
  }
  function openPass(renderer, src, pass, THREE) {
    if (OPT && O.brush <= .001) { try { warmOpen(renderer, src, THREE); } catch (error) { W.error = String(error?.message || error); } }
    if (O.brush <= .001) { if (pass.uniforms.tForest.value !== src.texture) pass.uniforms.tForest.value = src.texture; return; }
    if (OPT) makeBrush(THREE);
    if (!brushMat) {
      brushMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uB: { value: new THREE.Vector4() }, uLook: { value: new THREE.Vector4(0, 1.6, .45, .55) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: BRUSH_FRAG, depthTest: false, depthWrite: false, toneMapped: false });
      brushScene = new THREE.Scene(); const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), brushMat); quad.frustumCulled = false; brushScene.add(quad);
      brushRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
      if (!lensCam) lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
    if (brushRT.width !== src.width || brushRT.height !== src.height) brushRT.setSize(src.width, src.height);
    const ct = cutTune(), U = brushMat.uniforms;
    U.tSrc.value = src.texture; U.uRes.value.set(src.width, src.height);
    U.uB.value.set(O.brush, reduced ? 1 : 0, 0, 0);
    U.uLook.value.set(0, Number.isFinite(+ct.brushSoft) ? +ct.brushSoft : 1.6, Number.isFinite(+ct.brushBristle) ? +ct.brushBristle : .45, Number.isFinite(+ct.brushSmear) ? +ct.brushSmear : .55);
    const prev = renderer.getRenderTarget(); renderer.setRenderTarget(brushRT); renderer.render(brushScene, lensCam); renderer.setRenderTarget(prev);
    pass.uniforms.tForest.value = brushRT.texture;
  }
  /* THE DIVE (team LZ): near FOUR PATHS the dive warms up (program, targets, camera hook); while it plays it draws over the view */
  let diveDrawn = 0;
  function divePass(renderer, src, pass, atlas, THREE) {
    if (O.phase === 'off' && O.brush <= .001) {
      try { DIVE.warm(renderer, src, atlas, THREE, study()?.journey); } catch (error) { W.error = String(error?.message || error); }
      if (!W.block && !block && !window.__FLOW2_NEXT__) { const J = study()?.journey; if (J && J.progress > J.max - .6) { W.block = 'asked'; const go = () => { if (!block) buildBlock(); W.block = true; }; if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 800 }); else setTimeout(go, 60); } }
      if (pass.uniforms.tForest.value !== src.texture) pass.uniforms.tForest.value = src.texture;
      return;
    }
    let tex = null;
    try { tex = DIVE.render(renderer, src, atlas, THREE, O.brush, O.phase === 'closing'); diveDrawn++; } catch (error) { W.error = String(error?.message || error); }
    pass.uniforms.tForest.value = tex || src.texture;
  }
  const ease = t => .18 * t + .82 * (t * t * (3 - 2 * t));   /* the canyon stroke's own: it speeds up and settles */
  function setStage(st) { if (S.stage !== st) { S.stage = st; html.dataset.flow2After = st; } }
  /* NEXT HOOK (2026-11-22, rise page only: prototypes/rise/why-sea.js registers window.__FLOW2_NEXT__): when a real next block is registered and
     ready, it stands where the placeholder block stood (show / take the hand); absent → everything below runs as before. */
  const NEXT = () => { const n = window.__FLOW2_NEXT__; return n && n.enabled ? n : null; };
  function showBlock(on, quick) {
    if (NEXT()) { NEXT().show(on, quick); if (block && !on) { block.classList.remove('is-on', 'is-in'); block.style.opacity = '0'; } return; }
    buildBlock();
    block.style.transition = quick ? 'opacity .25s ease' : 'opacity .4s ease';
    block.style.transform = 'none';
    if (MODE === 'dive' && on) block.classList.toggle('is-dive', diveDrawn > 0);   /* its ground is the dive's last picture (the close water sunk into navy) */
    block.classList.toggle('is-on', on); block.classList.toggle('is-in', on); block.inert = !on; block.setAttribute('aria-hidden', on ? 'false' : 'true');
    requestAnimationFrame(() => { block.style.opacity = on ? '1' : '0'; });
    if (on && scroller) scroller.scrollTop = 0;
  }
  function openFrame(now) {
    if (O.phase === 'opening' || O.phase === 'closing') {
      if (O.phase === 'closing' && now < O.fadeUntil) { O.brush = 1; requestAnimationFrame(openFrame); return; }   /* the block fades first */
      let t = Math.min(1, (now - O.t0) / 1000 / span());
      if (O.hold != null) { t = O.phase === 'opening' ? O.hold : 1 - O.hold; O.t0 = now - t * 1000 * span(); }   /* frame strips: __FLOW2_AFTER__.hold(t) */
      O.t = t;
      if (MODE === 'dive') { O.brush = O.phase === 'opening' ? t : 1 - t; DIVE.set(O.brush); }   /* the dive eases itself */
      else O.brush = O.phase === 'opening' ? ease(t) : 1 - ease(t);
      S.lens = 0;
      if (t < 1 || O.hold != null) { requestAnimationFrame(openFrame); return; }
      if (O.phase === 'opening') {
        O.phase = 'in'; O.brush = 1; setStage('in'); html.removeAttribute('data-flow2-brush');
        showBlock(true);
        setTimeout(() => { if (O.phase === 'in') S.covered = true; }, 450);   /* the block is opaque: the view is not drawn behind it */
      } else {
        O.phase = 'off'; O.brush = 0; setStage('off'); html.removeAttribute('data-flow2-brush'); html.removeAttribute('data-flow2-dive');
        if (MODE === 'dive') DIVE.set(0);
        if (passRef && forestTex) passRef.uniforms.tForest.value = forestTex;
      }
    }
  }
  function startOpen() {
    if (O.phase !== 'off') return;
    O.phase = 'opening'; O.t0 = performance.now(); O.t = 0; O.brush = 0; S.covered = false;
    setStage('opening'); html.setAttribute('data-flow2-brush', 'after-in'); if (MODE === 'dive') { html.setAttribute('data-flow2-dive', 'in'); diveDrawn = 0; }
    requestAnimationFrame(openFrame); watchJourney();
  }
  function startClose() {
    if (O.phase !== 'in') return;
    S.covered = false; O.brush = 1; O.phase = 'closing'; setStage('closing'); html.setAttribute('data-flow2-brush', 'after-out'); if (MODE === 'dive') { html.setAttribute('data-flow2-dive', 'out'); DIVE.set(1); }
    showBlock(false, true);
    O.fadeUntil = performance.now() + 260; O.t0 = O.fadeUntil; O.upAsk = 0;
    requestAnimationFrame(openFrame);
  }
  /* about two notches up at the block's top close it (the canyon stroke's own threshold for going back) */
  function askUp(px) { const now = performance.now(); if (now - O.nativeAt < 300) { O.upAsk = 0; return; }   /* momentum from scrolling the block back to its top does not count */
    if (now - O.upAt > 1200) O.upAsk = 0; O.upAt = now; O.upAsk += px; if (O.upAsk >= 180) startClose(); }
  const blockFree = dir => !!scroller && O.phase === 'in' && (dir > 0 ? scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1 : scroller.scrollTop > 0);
  function openHand(d) {
    if (O.phase === 'opening' || O.phase === 'closing') return true;            /* absorbed while it plays */
    if (O.phase === 'off') { if (d > 0) startOpen(); return true; }
    if (NEXT()) { if (NEXT().take(d)) { O.nativeAt = performance.now(); return true; } if (d < 0) askUp(-d); return true; }   /* NEXT HOOK */
    if (blockFree(Math.sign(d))) { O.nativeAt = performance.now(); return 'native'; }
    if (d < 0) askUp(-d);
    return true;
  }

  /* touches that start inside the next block while it is in: its own pan, or (pulled down at its top) the close request; the page's touch
     navigation never sees them (it cancels touches to drive the journey, which would stop the block from panning) */
  let blockTouchY = null;
  const inBlock = e => O.phase === 'in' && block && e.target && block.contains(e.target);
  addEventListener('touchstart', e => { if (!OPENLIKE || !inBlock(e)) { blockTouchY = null; return; } blockTouchY = e.touches[0]?.clientY ?? null; e.stopImmediatePropagation(); }, { capture: true, passive: true });
  addEventListener('touchmove', e => {
    if (!OPENLIKE || blockTouchY == null || !inBlock(e)) return;
    const y = e.touches[0]?.clientY ?? blockTouchY, dy = blockTouchY - y; blockTouchY = y;
    e.stopImmediatePropagation();
    if (dy < 0 && scroller && scroller.scrollTop <= 0) { askUp(-dy * 2.2); if (e.cancelable) e.preventDefault(); } else O.nativeAt = performance.now();
  }, { capture: true, passive: false });
  /* the page's touch navigation (mobile-touch-navigation.js) reads pointer events: inside the block they are the block's own */
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) addEventListener(type, e => { if (OPENLIKE && inBlock(e)) e.stopImmediatePropagation(); }, { capture: true, passive: true });

  /* ---------------- the hand (called by flow2-scope.js, which owns the wheel at the journey's end) ---------------- */
  const norm = e => { let d = e.deltaY || 0; if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= innerHeight; return Math.max(-240, Math.min(240, d)); };
  const blockScrolls = dir => !!scroller && S.target >= 1 && S.a >= .999 && (dir > 0 ? scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1 : scroller.scrollTop > 0);
  /* returns 'native' when the next block should scroll by itself (the caller then lets the browser do it), true when A took it */
  function wheel(e) {
    const d = norm(e);
    if (!d) return true;
    if (OPENLIKE) return openHand(d);
    if (blockScrolls(Math.sign(d))) return 'native';
    if (d > 0 && S.target >= 1) return true;
    setTarget(S.target + d / T.travel);
    return true;
  }
  function key(dir) { if (OPENLIKE) return openHand(dir * 100); if (blockScrolls(dir)) return 'native'; setTarget(S.target + dir * 100 / T.travel); return true; }
  function touch(dy) { if (OPENLIKE) return openHand(dy * 2.2); if (blockScrolls(Math.sign(dy))) return 'native'; setTarget(S.target + dy * 2.2 / T.travel); return true; }

  window.__FLOW2_AFTER__ = {
    enabled: true, state: S, tune: T, lens, wheel, key, touch,
    mode: MODE,
    active: () => OPENLIKE ? O.phase !== 'off' : (S.target > 0 || S.a > 0),
    dive: DIVE,
    /* frame strips (QA): hold(t) freezes the dive in at t (0..1; starts it if needed), hold(null) lets it run on */
    hold(t) { if (!OPENLIKE) return; if (t == null) { O.hold = null; return; } O.hold = Math.min(1, Math.max(0, +t || 0)); if (O.phase === 'off') startOpen(); },
    get covered() { return S.covered; },
    set(a) { if (OPENLIKE) { if (+a > .5) startOpen(); else startClose(); return; } setTarget(+a || 0); },
    reset() { if (OPENLIKE) { startClose(); return; } setTarget(0); }
  };
  html.dataset.flow2After = 'off';
  buildStyle();
})();
