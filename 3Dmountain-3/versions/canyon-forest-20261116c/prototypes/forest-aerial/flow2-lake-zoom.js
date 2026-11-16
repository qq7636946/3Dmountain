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
   Live: window.__FLOW2_AFTER__ = { state, tune, set(a), … }. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('after') === '0') return;
  const html = document.documentElement;
  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { return false; } })();
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const T = {
    travel: num('afterTravel', 1500),   // wheel pixels for the whole of A (about 15 notches)
    follow: 5.5,                         // how fast A follows the hand (1/s)
    lines: [0, .34], zoom: [.34, .82], next: [.82, 1],
    lensFrom: .17,                       // the window's radius at the start of the zoom (share of the screen's short side)
    lensTo: 1.12,                        // … at its end (covers the corners)
    tilt: num('afterTilt', 30),       // degrees the lens tilts up during the lines (eased back during the dive)
    mag: .85,                            // extra magnification in the middle of the zoom (1 + mag at the peak, back to 1 at the end)
    grid: 1,                             // the grid's strength
    linesOut: [.5, .8]                   // during the zoom (share of the zoom) the lines give way to the lake's real water
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
      .f2-next-scroll { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
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
        opacity: 0 !important; pointer-events: none !important; transition: opacity .6s ease !important; }`;
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
    uniform sampler2D tSrc; uniform vec2 uRes, uCenter; uniform vec4 uLens; varying vec2 vUv;
    void main(){
      float m=min(uRes.x,uRes.y);
      vec2 p=(vUv-uCenter)*uRes/m;                                   /* square units: 1 = the screen's short side */
      float d=length(p), R=uLens.y, px=1./m;
      float inside=1.-smoothstep(R-2.*px,R,d);
      float rim=smoothstep(R*.8,R,d)*inside;
      vec2 q=p/mix(1.,uLens.z,inside)*(1.-rim*.05*uLens.x);          /* magnified inside, a little bulge at the rim */
      vec3 col=texture2D(tSrc,uCenter+q*m/uRes).rgb;
      vec3 outer=texture2D(tSrc,vUv).rgb;
      float l=dot(outer,vec3(.2126,.7152,.0722));
      outer=mix(outer,vec3(l),.4*uLens.x)*(1.-.42*uLens.x);          /* outside the window: quieter and darker */
      col=mix(outer,col,inside);
      /* the grid: fine lines in the magnified space, a cross tick every fourth crossing */
      float g=.048;
      vec2 gq=q/g, fw=fwidth(gq), f=abs(fract(gq-.5)-.5)/max(fw,vec2(1e-4));
      float line=1.-min(min(f.x,f.y),1.);
      vec2 tq=q/(g*4.), tf=abs(fract(tq-.5)-.5)*4.*g/px;             /* distance to the nearest 4th crossing, in pixels */
      float tick=(1.-smoothstep(.6,1.4,min(tf.x,tf.y)))*(1.-smoothstep(5.,6.5,max(tf.x,tf.y)));
      col+=vec3(.42,.70,1.)*(line*.16+tick*.55)*uLens.w*inside;
      float ring=exp(-pow((d-R)/(1.4*px),2.));
      float dash=step(.5,fract(atan(p.y,p.x)*24./6.28318));
      float ring2=exp(-pow((d-R-9.*px)/(.9*px),2.))*dash;
      col+=vec3(.55,.80,1.)*(ring*.9+ring2*.45)*uLens.x;
      gl_FragColor=vec4(col,1.);
    }`;
  function buildLens(THREE) {
    THREEref = THREE;
    lensMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uCenter: { value: new THREE.Vector2(.5, .5) }, uLens: { value: new THREE.Vector4() } },
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
    if (S.lens <= .001) { if (pass.uniforms.tForest.value !== src.texture) pass.uniforms.tForest.value = src.texture; return; }
    if (!lensMat) buildLens(THREE);
    if (lensRT.width !== src.width || lensRT.height !== src.height) lensRT.setSize(src.width, src.height);
    const F = forest();
    if (F && F.lake && F.camera && THREE) { const v = new THREE.Vector3().copy(F.lake.center).project(F.camera); if (Number.isFinite(v.x)) { projected.x = v.x * .5 + .5; projected.y = v.y * .5 + .5; } }
    const U = lensMat.uniforms, z = S.zoomT;
    U.tSrc.value = src.texture; U.uRes.value.set(src.width, src.height); U.uCenter.value.set(projected.x, projected.y);
    U.uLens.value.set(S.lens, T.lensFrom + (T.lensTo - T.lensFrom) * smooth(z), 1 + T.mag * Math.sin(Math.PI * z), T.grid * S.lens * (1 - smooth(clamp01((z - .7) / .3))));
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
      if (S.target <= 0 && S.a <= 0) { clearInterval(watching); watching = 0; return; }
      if (J && J.target < J.max - .01) setTarget(0);
    }, 400);
  }

  /* ---------------- the hand (called by flow2-scope.js, which owns the wheel at the journey's end) ---------------- */
  const norm = e => { let d = e.deltaY || 0; if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= innerHeight; return Math.max(-240, Math.min(240, d)); };
  const blockScrolls = dir => !!scroller && S.target >= 1 && S.a >= .999 && (dir > 0 ? scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1 : scroller.scrollTop > 0);
  /* returns 'native' when the next block should scroll by itself (the caller then lets the browser do it), true when A took it */
  function wheel(e) {
    const d = norm(e);
    if (!d) return true;
    if (blockScrolls(Math.sign(d))) return 'native';
    if (d > 0 && S.target >= 1) return true;
    setTarget(S.target + d / T.travel);
    return true;
  }
  function key(dir) { if (blockScrolls(dir)) return 'native'; setTarget(S.target + dir * 100 / T.travel); return true; }
  function touch(dy) { if (blockScrolls(Math.sign(dy))) return 'native'; setTarget(S.target + dy * 2.2 / T.travel); return true; }

  window.__FLOW2_AFTER__ = {
    enabled: true, state: S, tune: T, lens, wheel, key, touch,
    active: () => S.target > 0 || S.a > 0,
    get covered() { return S.covered; },
    set(a) { setTarget(+a || 0); },
    reset() { setTarget(0); }
  };
  html.dataset.flow2After = 'off';
  buildStyle();
})();
