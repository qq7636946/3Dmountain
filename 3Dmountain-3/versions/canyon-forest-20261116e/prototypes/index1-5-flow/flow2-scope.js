/* Flow2 · scope (lead, 2026-11-15). Only for index1-5-canyon-forest.html.
   Client: 「我現在因為要乾淨的html 先幫我把山道跟俯視這邊先獨立取出來另開html 我怕原本的這樣改太雜亂了」 — the canyon and the view from above on a
   page of their own. The engine is the same; this file only keeps the visitor inside that stretch:
   - the page opens on the canyon's first screen (journey progress FROM = 4.87: the river, the mark), not on the opening before it;
   - the journey cannot go back above FROM, and ends at FOUR PATHS: the wheel, keys and touch past the end are not passed on (no sea, no world,
     no cards after it), and the chapter links / NEXT that lead out of the stretch are hidden;
   - ?scope=0 = the whole page as before. Live: window.__FLOW2_SCOPE__ = { from, state }. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('scope') === '0') return;
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const FROM = num('scopeFrom', 4.87);
  /* client 23:15 (two pictures of the first screen): 「整體往下調一點像圖一這樣」 — the canyon's picture (with the mark and its 3D labels), the left
     rail and the right read sit lower by this share of the screen height; the title, copy, button and NEXT stay where they are. ?scopeShift=0 = as before */
  const SHIFT = num('scopeShift', .076);
  const S = { stage: 'waiting', from: FROM, blocked: 0 };
  window.__FLOW2_SCOPE__ = { from: FROM, state: S };

  const style = document.createElement('style');
  style.textContent = `
    /* the stretch has two chapters: the canyon (02 CAPITAL FLOWS FORWARD) and the view from above (WHERE VALUE CONNECTS → FOUR PATHS) */
    html[data-flow2-scope] .fi-footer-next, html[data-flow2-scope] [data-world-go] { display: none !important; }
    html[data-flow2-scope] .fi-rail { translate: 0 ${(SHIFT * 100).toFixed(2)}vh; }
    /* the right read (TAIPEI, 02 / 05, the vertical name, FLOW) and the lock-on labels, but not NEXT; the page's HUD rules are very specific */
    :root:not(#s1):not(#s2):not(#s3):not(#s4):not(#s5):not(#s6):not(#s7)[data-flow2-scope] body .finnovation-ui > .f2u-side > :not(.f2u-next),
    :root:not(#s1):not(#s2):not(#s3):not(#s4):not(#s5):not(#s6):not(#s7)[data-flow2-scope] body .f2u-lock { translate: 0 ${(SHIFT * 100).toFixed(2)}vh !important; }
    html[data-flow2-scope] .fi-rail > [data-section]:not([data-section="1"]),
    html[data-flow2-scope] .fi-menu-links [data-section]:not([data-section="1"]) { opacity: .28; pointer-events: none; }`;
  document.head.append(style);
  document.documentElement.setAttribute('data-flow2-scope', 'canyon-forest');

  let J = null, study = null;
  const atEnd = () => J && J.target >= J.max - .002 && J.progress >= J.max - .05;
  const atStart = () => J && J.target <= FROM + .002;
  /* nothing past the end and nothing above the start reaches the engine */
  const stop = e => { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); S.blocked++; };
  const preparing = () => S.stage !== 'ready' && S.stage !== 'no engine' && !S.stage.startsWith('failed');
  /* AFTER (team F3, 2026-11-16): past the end the hand drives what comes after FOUR PATHS (flow2-lake-zoom.js: lines → the dive into the lake →
     the next block); while that is open nothing reaches the journey. 'native' = the next block scrolls by itself (the page's own handlers still
     do not see the event). ?after=0 leaves the module out and the page ends at FOUR PATHS as before. */
  const after = () => { const A = window.__FLOW2_AFTER__; return A && A.enabled ? A : null; };
  const handOver = (e, run) => { const r = run(); if (r === 'native') { e.stopImmediatePropagation(); S.native = (S.native || 0) + 1; return; } stop(e); };
  addEventListener('wheel', e => {
    if (preparing()) { stop(e); return; } if (!J) return;
    const A = after();
    if (A && (A.active() || (e.deltaY > 0 && atEnd()))) { handOver(e, () => A.wheel(e)); return; }
    if ((e.deltaY > 0 && atEnd()) || (e.deltaY < 0 && atStart())) stop(e);
  }, { capture: true, passive: false });
  addEventListener('keydown', e => {
    if (!J || e.target?.closest?.('input,textarea,[contenteditable]')) return;
    const down = ['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key), up = ['ArrowUp', 'PageUp', 'Home'].includes(e.key);
    const A = after();
    if (A && (down || up) && (A.active() || (down && atEnd()))) { handOver(e, () => A.key(down ? 1 : -1)); return; }
    if ((down && atEnd()) || (up && atStart())) stop(e);
  }, { capture: true });
  let touchY = null;
  addEventListener('touchstart', e => { touchY = e.touches[0]?.clientY ?? null; }, { capture: true, passive: true });
  addEventListener('touchmove', e => {
    if (!J || touchY == null) return; const y = e.touches[0]?.clientY ?? touchY, dy = touchY - y;
    const A = after();
    if (A && dy && (A.active() || (dy > 0 && atEnd()))) { touchY = y; handOver(e, () => A.touch(dy)); return; }
    if ((dy > 0 && atEnd()) || (dy < 0 && atStart())) stop(e);
  }, { capture: true, passive: false });

  /* the journey: never above FROM (chained over whatever accessors other modules installed, e.g. flow2-lift-cut.js) */
  function clampJourney() {
    for (const key of ['progress', 'target']) {
      const d = Object.getOwnPropertyDescriptor(J, key); let own = J[key];
      Object.defineProperty(J, key, {
        configurable: true, enumerable: true,
        get: d && d.get ? () => d.get.call(J) : () => own,
        set: d && d.set ? v => { d.set.call(J, Number.isFinite(+v) ? Math.max(FROM, +v) : v); } : v => { own = Number.isFinite(+v) ? Math.max(FROM, +v) : v; }
      });
    }
  }
  async function start() {
    for (let i = 0; i < 600 && !(window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey); i++) await new Promise(r => setTimeout(r, 50));
    study = window.__MONTIS_STUDY__; if (!study) { S.stage = 'no engine'; return; }
    await study.ready;
    J = study.journey;
    /* open on the canyon: straight there, without flying through the opening */
    J.target = FROM; J.progress = FROM; J.velocity = 0;
    clampJourney();
    S.stage = 'warming';
    await warmCanyon().catch(error => { S.warm = 'skipped: ' + (error?.message || error); });
    S.stage = 'ready';
  }
  /* the canyon ahead, drawn once off screen from ten places down the valley before the visitor may scroll: its programs are compiled and its
     textures uploaded now, not in the middle of the flight (on this page the visitor starts in the canyon, with no opening to hide that work).
     The camera for each place comes from the canyon's own update (a pure function of its arguments, as flow2-lift-cut.js warms the aerial). */
  async function warmCanyon() {
    const cut = window.__FLOW2_LIFT_CUT__; let canyon = cut && cut.canyon;
    for (let i = 0; i < 100 && !(canyon = (window.__FLOW2_LIFT_CUT__ || {}).canyon); i++) await new Promise(r => setTimeout(r, 50));
    if (!canyon || !canyon.update || !canyon.scene || !canyon.camera) { S.warm = 'no canyon handle'; return; }
    let args = null; const up = canyon.update;
    canyon.update = function (...a) { args = a; return up.apply(this, a); };
    for (let i = 0; i < 60 && !args; i++) await new Promise(r => requestAnimationFrame(r));
    canyon.update = up;
    if (!args || args.length < 4) { S.warm = 'no arguments'; return; }
    const THREE = await import('three'), gl = study.renderer;
    if (!gl) { S.warm = 'no renderer'; return; }
    const C = study.CONFIG || {}, cl = x => Math.min(1, Math.max(0, x));
    const descent = document.documentElement.dataset.epilogue === 'world' ? cl(+(C.mist && C.mist.descent) || 0) : 0;
    const riseFrom = 6.4 - .05 * descent, riseTo = 11.8 - .6 * descent, joinFrom = 11.8 - 1.8 * descent;
    const rt = new THREE.WebGLRenderTarget(480, 240, { type: THREE.HalfFloatType, depthBuffer: true });
    const t0 = performance.now(), places = [2.3, 2.8, 3.3, 3.8, 4.3, 4.8, 5.3, 5.8, 6.3, 6.7];
    for (const c of places) {
      await new Promise(res => requestAnimationFrame(res));
      const a = [cl((c - 1.404) / (8 - 1.404)), args[1], args[2], cl((c - riseFrom) / (riseTo - riseFrom)), cl((c - joinFrom) / (13.8 - joinFrom))];
      const prev = gl.getRenderTarget(), shadows = gl.shadowMap.autoUpdate;
      try { up.apply(canyon, a); gl.shadowMap.autoUpdate = false; gl.setRenderTarget(rt); gl.render(canyon.scene, canyon.camera); }
      finally { gl.shadowMap.autoUpdate = shadows; gl.setRenderTarget(prev); up.apply(canyon, args); }
    }
    rt.dispose();
    S.warm = places.length + ' places, ' + Math.round(performance.now() - t0) + ' ms';
    shiftCanyon(canyon);
  }
  /* the canyon's lens shifted (a view offset: the same perspective, the picture lower on the screen); the lock-on labels project through the same
     camera, so they follow. Set after every canyon update (the engine rebuilds the projection when the window changes). */
  function shiftCanyon(canyon) {
    if (!SHIFT) return;
    /* NB three's setViewOffset also sets aspect = fullWidth / fullHeight: the full size must carry the screen's own aspect (it was 1000 x 1000 at
       first, which squeezed the picture on a wide window); re-applied whenever the engine changes the aspect */
    const cam = canyon.camera, apply = () => {
      const a = cam.aspect, v = cam.view, fw = 1000 * a;
      if (!v || !v.enabled || Math.abs(v.fullWidth - fw) > 1e-3 || Math.abs(v.offsetY + SHIFT * 1000) > 1e-6) cam.setViewOffset(fw, 1000, 0, -SHIFT * 1000, fw, 1000);
    };
    const up = canyon.update;
    canyon.update = function (...a) { const out = up.apply(this, a); apply(); return out; };
    apply(); S.shift = SHIFT;
  }
  start().catch(error => { S.stage = 'failed: ' + (error?.message || error); });
})();
