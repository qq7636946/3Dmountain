/* Flow2 · the lift cut (2026-11-14, evening). index1-5-flow2.html (and its trial copy index1-5-flow2-mark.html).
   Client, with three pictures: 「2.圖一到這裡時候直接webgl 轉場 轉場參考 https://www.ibi.cash/」 — where the valley flight ends
   (picture one: CAPITAL FLOWS FORWARD, the lens beginning to rise) the page changes DIRECTLY to the view from the air (picture two:
   WHERE VALUE CONNECTS) through a WebGL transition of glass cells, instead of the long continuous lift.
   This brand's own drawing of that kind of change (not the reference's code or look): an irregular lattice of glass cells, larger
   towards one side, with slightly rounded corners. The glass first forms over the old picture (a thin pale ice-blue rim fades in,
   a finer line inside it, the old picture bulges a little in each cell); then each cell FILLS with the next picture along the
   front's direction, like water rising in a glass (a soft water line); inside, the next picture is seen as through a glass bead
   (magnified in the middle, the outer part squeezed into the rim), which relaxes while the rim thins away. The cells turn one after
   another along a soft front that crosses the screen (up when going forward, down when going back), each a little after its
   neighbours; at the end the lattice is gone and the next picture is exact. A faint cool / warm split on the rims. No glow, no
   flash, no grain, nothing dark laid over the picture. (T.fill = 0 turns the cells from their middle instead, as a lens opening.)

   What happens:
   - FORWARD: when the journey, moving down the valley, reaches picture one (journey clock T.from = 7.6), the frame on the screen is
     kept (one frame-sized snapshot); the engine is moved to picture two (clock T.to = 8.96, the page's own rest for WHERE VALUE
     CONNECTS) without drawing anything in between, and the live aerial picture is revealed through the cells. It plays on time
     (T.duration), not with the wheel; the visitor's input meanwhile is absorbed (no double fire, no stop between the two places).
     Then the visitor is at picture two and scrolls on as usual.
   - BACKWARD: scrolling up from picture two plays it the other way (the aerial frame kept, the valley's end revealed, the front
     travelling back down), and the visitor is at picture one, free to scroll further up the valley.
   - The page's own navigation (rail, menu, NEXT, Home / End) across the cut does not play the cells: it goes as it always went.
     A navigation during the transition ends it at once and goes through.
   - Reduce motion: a plain cross-fade (T.reduceFade s). Phones / the lighter drawing (lite, < 760 px) and text mode: nothing (the
     lift as before).
   - Quality tiers (flow2-quality.js): high = everything; medium = the same cells, fill and lenses without the rims' colour split,
     the glass over the old picture and the bevel light (fewer taps, lighter maths); low = fewer, larger cells, no refraction, plain
     rims, the same fill. The tier is a uniform of ONE program (a step down while the page runs recompiles nothing). The warm-up is
     the same at every tier. The kept frame always has the size of the page's own buffers (the renderer's real drawing size).
   - Warm-up (so nothing hitches at the cut): the two programs are handed to the driver when the page is live (compileAsync) and
     drawn once off screen; the snapshot is made when the journey comes near the cut; once, in a quiet moment in the valley, the
     aerial view is drawn off screen from picture two's camera (small target) so its programs, textures and levels of detail are
     warm. Measured on this page before the warm-up: the engine's own start-up already leaves the aerial view warm (first aerial
     frame 16.6 ms at 120 Hz, no new programs, geometries or textures); the 92 ms frame of the first try was this pass compiling
     its shader on first use: that is what the warm-up removes.
   - Cost: nothing while it is not playing (the pass is switched off; one frame-sized snapshot is kept near the cut only); while it
     plays, one full-screen pass at the end of the page's chain (it works on the finished picture, so both ends are exactly the
     page's own frames).

   How (no edit in main.js): the journey object's `progress` and `target` become accessor properties that pass every write through
   (window.__MONTIS_STUDY__.journey). The engine's own follow writes progress each frame: when that write would carry the journey to
   picture one (or back to picture two) while the visitor asks past it, the journey is held there and the cut is armed; the pass
   keeps that frame and moves the journey. Hooks: window.__FLOW2_FINE_JOURNEY__.attach / .canyon (chained, as flow2-streaks.js).
   ?cut=0 leaves it out (the lift as before). Live: window.__FLOW2_LIFT_CUT__ = { tune, state, play(dir), off() }. Panel 「轉場」, key X.

   flow2 td3 (2026-11-15, third team, D2). Client, on a picture of CAPITAL FLOWS FORWARD at the canyon's wide outlet: 「這段後面的模型跟畫面都刪除」
   (delete the models and the imagery behind this stretch) and 「山谷河岸的河流要跟前面段的建模一樣」 (the river and banks there must be the same
   modelling as the first segment). Two changes, both here, nothing in main.js or the canyon modules:
   - THE CUT FIRES EARLIER: T.from 7.6 -> 6.6 (journey progress 10.49 -> 9.49). There the lens is still low (2.8 m) between the canyon's
     two walls, on the same water with the same banks, rock, stones, grass and plants as the first segment; CAPITAL FLOWS FORWARD has
     been on the screen since clock 5.9. The wide outlet (clock 6.9 - 7.6: the flat pale lift river, the old polygonal slopes) is never
     reached by scrolling any more. ?cutFrom=7.6 gives the old place back.
   - NOTHING OLD BEHIND THE WALLS: from clock T.hideFrom (2.7: a bend where the walls close the view, so nothing pops) up to the cut the
     old aerial world (the group "Alpine watershed · five sources, one current": its pale massifs and the sharp snowy peak, its rivers)
     and "Atmospheric far range" are not drawn: the gap between the walls shows the sky and the valley's own haze. They are hidden by
     their layers (nothing is disposed, the engine's own visible flags are left alone) and come back exactly as they were above
     T.hideFrom and past the cut (the old aerial itself, for ?topdown=0). T.hideOld = 0 (?hideOld=0) switches this off.
   window.__FLOW2_LIFT_CUT__.canyon is the canyon's handle (for the capture tools).

   THE BRUSH (lead, 2026-11-15; client: 「山道接俯視轉場改成webgl刷過去的而且轉場銜接不要停住才轉场，過程要絲滑銜接」). Opt-in per page
   (window.__FLOW2_CUT_MODE__ = 'brush' before this file, or ?cutMode=brush; the main page keeps the cells). Nothing is held and no frame is
   kept: BOTH places are live while a brush stroke paints the view from above over the valley.
   - FORWARD: shortly before picture one (T.pre before T.from) with the visitor going on, the stroke starts. The valley keeps flying under it
     (the journey is let on softly, never into the old outlet: at most T.cap past picture one); the view from above is drawn live from its own
     arrival (clock 7.9 → 8.96: the lens rises over the lake) and its spreading starts from the bare land. When the stroke has covered the
     screen the journey is moved to picture two — invisible, the view already fills the screen — and the visitor scrolls on.
   - BACKWARD: from picture two going up, the journey moves to picture one at once (the view still fills the screen) and the stroke wipes
     the view away over the live valley, the lens sinking back.
   - The stroke: one wide sweep along T.brushAngle, its head curved, its edge bristled (fine fibres ahead, broken dry paint just behind),
     both pictures dragged a little along the stroke at the edge. No colour of its own: no glow, no line, no grain. Reduce motion: a cross-fade.
   - It is drawn by the forest view's own composite (flow2-forest-atlas.js reads window.__FLOW2_FOREST_ATLAS__.override = { clock, brush, dir,
     look, reduce }); this file's glass pass stays off. Panel 「轉場」: 刷過去 rows.

   HAND-OVERS LINKED (Engineer 3, 2026-11-16; client: 「到山谷可以進場動畫一下就好就不要隨便動了 轉場銜接進退場動畫」). Brush mode only; ?motion=old = as before.
   - A small turn of the wheel up at picture two no longer throws the visitor back into the valley: the journey holds at picture two until the
     visitor asks clearly above it (T.backAsk, about two notches); then the stroke plays back.
   - Going back, the journey lands in the valley proper (T.land before picture one), where the view from above is off: before, a short way back
     landed inside the cut, the view came back over the valley and its spreading ran backwards in front of the visitor.
   - The spreading is the view's ONE entrance: leaving keeps it as it is (it no longer runs back unseen), and coming back within T.replayGap s
     shows the land as it was left (it finishes growing if it had not); only a return after longer plays the entrance again.
   - The page's own navigation across the cut (rail, menu, keys) plays the stroke as the wheel does, then goes on to where it was sent.
   - The title block leaves with the stroke and the next one comes in when it is done (before, the valley's title stood over the forest).
   - Each hand-over is announced on document as a 'flow2:handover' event { dir: 1 | -1, phase: 'start' | 'end', replay } for the chapters' own
     entrance / exit (the floating mark, the canyon's mark). window.__FLOW2_MOTION__ = { leftAt, recent(), left() } is shared with flow2-forest-atlas.js. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('cut') === '0') return;
  /* flow2 unify (2026-11-14, client: 「山道這邊怎畫質又不一樣 請統一」): the valley modules fade their detail out for the lift between
     journey 9.6 and 10.7, but the cut's first picture stands at about 10.43–10.49, in the middle of that fade. With the cut, the
     lift is never seen: the detail stays full up to the cut and goes during the jump (they read this window; without it, their own). */
  if (innerWidth >= 760) window.__FLOW2_LIFT_FADE__ = [10.52, 10.62];   // removed again below if the cut does not install (the lighter drawing, text mode)
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    mode: Q.get('cutMode') || window.__FLOW2_CUT_MODE__ || 'cells',   // 'brush' = the WebGL brush sweep, live on both sides, no hold (lead, 2026-11-15)
    brushTime: num('brushTime', 1.15),   // seconds of the stroke
    pre: .45,                    // the stroke starts this far (journey clock) before picture one
    cap: .2,                     // the valley may fly on at most this far past picture one under the stroke (a soft limit)
    brushAngle: 16,              // the stroke's direction, degrees (0 = left to right, 90 = upward)
    brushSoft: 1.6, brushBristle: .45, brushSmear: .55,   // feathered (client 22:55: 「要羽化不要那麼銳利邊」)
    backAsk: num('backAsk', .28),  // going back from picture two: how far above it the visitor must ask (journey units; a wheel notch is about .15)   /* Engineer 3 */
    land: .06,                     // going back: the journey lands this far before picture one (where the view from above is off)
    replayGap: num('replayGap', 20),   // s: coming back to the view within this keeps the land as it was left; after it, the spreading plays again
    from: num('cutFrom', 6.6),   // picture one: the journey clock where the valley flight is cut (CAPITAL FLOWS FORWARD, the lens still low between the canyon's walls; 7.6 until 2026-11-15)   /* flow2 td3 (2026-11-15) */
    hideOld: num('hideOld', 1),  // 1 = the old aerial world behind the canyon is not drawn from hideFrom up to the cut   /* flow2 td3 (2026-11-15) */
    hideFrom: num('hideFrom', 2.7),   // the journey clock where that begins (a bend: the walls close the view)   /* flow2 td3 (2026-11-15) */
    to: num('cutTo', 8.96),      // picture two: the journey clock it lands on (the page's own rest for WHERE VALUE CONNECTS)
    reach: .06,                  // the cut fires once the journey is this close to picture one (journey clock) and the visitor asks past it
    duration: num('cutTime', 1.4),   // seconds
    size: .15,                   // cell size, in screen heights, at the middle of the screen
    sizeVar: 2.6,                // the cells on the large side are this many times the size of those on the small side
    sizeAngle: 20,               // the large side (degrees; 0 = right, 90 = up)
    jitter: .75,                 // how irregular the lattice is (0 = an even honeycomb)
    refract: 1,                  // lens strength
    rim: 1,                      // rim brightness
    rimWidth: 1.1,               // rim half-width in pixels at 930 px of height
    chroma: .6,                  // the cool / warm split of the rims, pixels at 930 px of height
    angle: 90,                   // the direction the front travels forward (degrees; 90 = up the screen); backward the other way
    front: .4,                   // the share of the time each cell takes to open (a wider front = more cells opening at once)
    curve: .35,                  // the front's curvature (the middle leads)
    fill: 1,                     // how a cell turns: 1 = it fills with the next view along the front, like water rising in a glass; 0 = from its middle
    rimColor: '#e6f2ff',
    reduceFade: .3,
    preview: NaN,                // hold the transition at this moment (0…1), at the cut's own place, without scrolling
    loop: 0                      // 1 = play it forward and back in place, over and over (tuning)
  };
  const S = { stage: 'waiting', phase: 'idle', dir: 0, t: 0, cuts: 0, last: null, warm: {}, tier: '', notes: [] };
  const api = window.__FLOW2_LIFT_CUT__ = { tune: T, state: S, play: null, off: null };

  window.__FLOW2_PANEL__?.add({ id: 'cut', title: '轉場', key: 'x', tune: T, rows: [
    ['預覽：停在（0＝關）', 'preview', 0, 1, .01, 'off0'], ['預覽：來回播放', 'loop', 0, 1, 1],
    ['時間長度（秒）', 'duration', .6, 3, .05],
    ['山谷後面的舊景：1＝不畫', 'hideOld', 0, 1, 1],
    ['— 格子 —'],
    ['格子大小', 'size', .05, .4, .005], ['大小變化', 'sizeVar', 1, 6, .05], ['大的一側（方向）', 'sizeAngle', -180, 180, 1], ['不規則程度', 'jitter', 0, 1, .01],
    ['— 玻璃 —'],
    ['折射強度', 'refract', 0, 2.5, .01], ['邊線亮度', 'rim', 0, 2, .01], ['邊線粗細', 'rimWidth', .3, 4, .05], ['色散', 'chroma', 0, 4, .05], ['邊線顏色', 'rimColor', 'color'],
    ['— 前緣 —'],
    ['方向', 'angle', -180, 180, 1], ['前緣寬度', 'front', .1, .8, .01], ['前緣彎曲', 'curve', -1, 1, .01],
    ['格子翻開：1＝像水注滿，0＝從中心', 'fill', 0, 1, .01],
    ['— 刷過去（筆刷轉場）—'],
    ['筆刷時間（秒）', 'brushTime', .5, 3, .05], ['提早開始（越大越早）', 'pre', 0, .6, .01], ['筆刷方向（度）', 'brushAngle', -60, 60, 1],
    ['筆刷前緣寬度', 'brushSoft', .3, 2.5, .01], ['筆毛（前緣的鬚）', 'brushBristle', 0, 2.5, .01], ['拖曳感', 'brushSmear', 0, 3, .01],
    ['— 進退場銜接 —'], ['往回捲多少才轉回山谷（約 .15＝一格滾輪）', 'backAsk', .05, .8, .01], ['離開後多久回來才重播蔓延（秒）', 'replayGap', 0, 120, 1]
  ] });
  T.preview = NaN; T.loop = 0;   // a preview left on in the panel's memory must not move the page on the next visit
  /* Engineer 3 (2026-11-16): the hand-overs linked (see the header); ?motion=old = as before */
  const MOTION_NEW = Q.get('motion') !== 'old' && T.mode === 'brush';
  const motion = window.__FLOW2_MOTION__ = { on: MOTION_NEW, leftAt: 0, recent: () => MOTION_NEW && motion.leftAt > 0 && performance.now() - motion.leftAt < Math.max(0, +T.replayGap || 0) * 1000, left: () => { if (MOTION_NEW) motion.leftAt = performance.now(); } };
  const announce = (d, ph, replay) => { try { document.dispatchEvent(new CustomEvent('flow2:handover', { detail: { dir: d, phase: ph, replay: !!replay } })); } catch (error) { } };
  if (MOTION_NEW) {
    document.documentElement.setAttribute('data-flow2-motion', '');
    const style = document.createElement('style');
    /* the title block leaves with the stroke (both ways) and the next comes in once the stroke is done; ids in :not() outrank the page's HUD rules */
    style.textContent = 'html[data-flow2-motion]:not(#e3a):not(#e3b):not(#e3c):not(#e3d) body .finnovation-ui > .fi-copy { transition: opacity .5s ease .12s; }\n' +
      'html[data-flow2-motion][data-flow2-brush]:not(#e3a):not(#e3b):not(#e3c):not(#e3d) body .finnovation-ui > .fi-copy { opacity: 0 !important; transition: opacity .26s ease-out !important; pointer-events: none !important; }';
    document.head.append(style);
  }
  let navTarget = NaN;   // a navigation that crosses the cut: where it was going (it goes on after the stroke)

  let THREE = null, renderer = null, composer = null, ShaderPass = null, canyon = null, lite = false, started = false;
  let J = null, study = null, _p = 0, _t = 0, installed = false, update = null;
  let pass = null, copyPass = null, snap = null, material = null;
  let phase = 'idle', dir = 0, held = 0, dest = 0, t0 = 0, armedAt = 0, navigating = false, loopNext = 0, lastInput = 0, lastFrameAt = 0, pendingPlay = 0;
  const NAV = 1.3, EPS = 1e-4;
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)'); } catch (error) { return { matches: false }; } })();
  const now = () => performance.now();
  const shift = () => (study ? 20 - study.journeyClock(20) : 0);
  const P1 = () => T.from + shift(), P2 = () => T.to + shift();
  const tier = () => { const q = window.__FLOW2_QUALITY__; const r = q && Number.isFinite(+q.rank) ? +q.rank : 2; return Math.max(0, Math.min(2, Math.round(r))); };
  for (const type of ['wheel', 'touchmove', 'keydown', 'pointerdown']) addEventListener(type, () => { lastInput = now(); }, { passive: true, capture: true });

  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const attachBefore = host.attach, canyonBefore = host.canyon;
  host.attach = function (handles = {}) {
    try { return attachBefore?.call(this, handles); } finally { THREE ||= handles.THREE; renderer ||= handles.renderer; composer = handles.composer || composer; ShaderPass ||= handles.ShaderPass; start(); }
  };
  host.canyon = function (handles = {}) {
    try { return canyonBefore?.call(this, handles); } finally { THREE ||= handles.THREE; renderer ||= handles.renderer; canyon = handles.canyon || canyon; lite = !!handles.lite; start(); }
  };

  function start() {
    if (started || !composer || !canyon || !THREE || !ShaderPass) return;
    started = true;
    if (lite || (innerWidth < 760 && !document.documentElement.hasAttribute('data-flow2-phone-full'))) { S.stage = 'off: the lighter drawing (the lift as before)'; delete window.__FLOW2_LIFT_FADE__; return; }
    if (document.documentElement.dataset.renderMode === 'text') { S.stage = 'off: text mode'; delete window.__FLOW2_LIFT_FADE__; return; }
    api.canyon = canyon;
    try { build(); install(); S.stage = 'ready'; warmPrograms(); }
    catch (error) { S.stage = 'failed: ' + (error?.message || error); console.warn('flow2 lift cut: left out', error); off(); }
  }

  /* ---------------------------------------------------------------- the journey's two places */
  function install() {
    study = window.__MONTIS_STUDY__; J = study?.journey;
    if (!J) throw new Error('no journey');
    _p = +J.progress || 0; _t = +J.target || 0;
    Object.defineProperty(J, 'progress', { configurable: true, enumerable: true, get: () => _p, set: v => { _p = onProgress(+v); } });
    Object.defineProperty(J, 'target', { configurable: true, enumerable: true, get: () => _t, set: v => { _t = onTarget(+v); } });
    installed = true;
    /* the valley's clock: called while the canyon is drawn, after the journey moved and before the frame renders */
    update = canyon.update;
    canyon.update = function (...args) { const out = update.apply(this, args); try { frame(args); } catch (error) { console.warn('flow2 lift cut: frame', error); } return out; };
    addEventListener('finnovation:text-mode', () => off(), { once: true });
  }
  function off() {
    setOld(false);
    delete window.__FLOW2_LIFT_FADE__;   // flow2 unify: the lift is seen again, so the valley modules fade over their own window
    finish('off');
    if (installed && J) { const p = _p, t = _t; delete J.progress; delete J.target; J.progress = p; J.target = t; installed = false; }
    snap?.dispose(); snap = null;
    S.stage = 'off';
  }
  api.off = off;

  const active = () => installed && innerWidth >= 760 && document.documentElement.dataset.renderMode !== 'text';

  /* every write of progress: the engine's follow, the page's navigation, the QA tools */
  function onProgress(v) {
    if (!Number.isFinite(v)) return v;
    if (T.mode === 'brush') return brushProgress(v);
    if (phase === 'armed') return held;
    if (phase === 'play') return dest;
    if (!active() || navigating) return v;
    const a = P1(), b = P2(), old = _p;
    /* down the valley: the visitor asks past picture one and the journey has come within reach of it (or would pass it) */
    if (old <= a + EPS && v >= old && _t > a + EPS && v >= a - T.reach && v < b - EPS) { arm(+1, Math.min(v, a)); return held; }
    /* back up: the visitor asks above picture two and the journey has come within reach of it */
    if (old >= b - EPS && v <= old && _t < b - EPS && v <= b + T.reach && v > a + EPS) { arm(-1, Math.max(v, b)); return held; }
    return v;
  }
  /* every write of target: the wheel, keys, touch (at most 1.25 from where the journey is), the page's navigation (anywhere) */
  function onTarget(v) {
    if (!Number.isFinite(v)) return v;
    if (T.mode === 'brush') {
      if (phase !== 'sweep') { if (Math.abs(v - _p) > NAV) navigating = true; return v; }
      if (MOTION_NEW) {
        if (Math.abs(v - _p) > NAV && Math.abs(v - P2()) > NAV && Math.abs(v - P1()) > NAV) { navTarget = v; }   /* a far write while the stroke plays: carried out after it */
        return dir > 0 ? Math.min(v, P1() + T.cap) : Math.min(v, P1() - T.land);
      }
      /* a far write that is neither near picture one nor near picture two is the page's own navigation: it goes through */
      if (Math.abs(v - _p) > NAV && Math.abs(v - P2()) > NAV) { endSweep('navigation'); navigating = true; return v; }
      return Math.min(v, P1() + T.cap);   // the valley keeps moving under the stroke, never into the old outlet
    }
    if (phase === 'idle') { if (Math.abs(v - _p) > NAV) navigating = true; return v; }
    if (Math.abs(v - dest) > NAV && Math.abs(v - held) > NAV) { finish('navigation'); navigating = true; return v; }
    return phase === 'armed' ? held : dest;   // absorbed while it plays
  }

  function arm(d, at) {
    dir = d; held = at; dest = d > 0 ? P2() : P1();
    phase = 'armed'; armedAt = now(); _t = held;
    S.phase = phase; S.dir = dir;
    if (pass) { pass.enabled = true; seat(); pass.mode = 'capture'; }
  }
  function jump() {
    _p = dest; _t = dest; if (J) J.velocity = 0;
    phase = 'play'; t0 = now(); lastFrameAt = t0; S.phase = phase; S.cuts++;
    S.last = { dir, at: Math.round(t0), from: +(held - shift()).toFixed(3), to: +(dest - shift()).toFixed(3), tier: tier(), frames: [] };
  }
  function finish(reason) {
    if (phase === 'idle') return;
    phase = 'idle'; S.phase = phase; S.t = 1; S.ended = reason;
    if (pass) { pass.enabled = false; pass.mode = 'idle'; }
  }

  /* flow2 td3 (2026-11-15): the old aerial world behind the canyon, not drawn in the canyon's later stretches (see the header) */
  const OLD = ['Alpine watershed · five sources, one current', 'Atmospheric far range'];
  const oldLayers = new Map(); let oldHidden = false;
  function setOld(hide) {
    if (hide === oldHidden || !canyon || !canyon.scene) return;
    if (hide) for (const name of OLD) canyon.scene.getObjectByName(name)?.traverse(o => { if (!oldLayers.has(o)) oldLayers.set(o, o.layers.mask); o.layers.mask = 0; });
    else { for (const [o, mask] of oldLayers) o.layers.mask = mask; oldLayers.clear(); }
    oldHidden = hide; S.old = hide ? 'hidden (' + oldLayers.size + ' objects)' : 'shown';
  }

  /* per frame (while the canyon is drawn), after canyon.update placed this frame's camera */
  function frame(args) {
    if (!installed) { setOld(false); return; }
    { const c = _p - shift(); setOld(T.hideOld >= .5 && active() && c >= T.hideFrom && c <= T.from + (T.mode === 'brush' ? T.cap + .05 : .1)); }
    if (navigating && Math.abs(_t - _p) < .002) navigating = false;
    if (T.mode === 'brush') { brushFrame(); return; }
    if (phase === 'armed' && now() - armedAt > 400) { S.notes.push('armed but no frame was kept: released'); phase = 'idle'; S.phase = phase; if (pass) pass.enabled = false; }
    if (phase === 'idle') warm(args);
    if (phase === 'play') seat();   // the last of the chain (other passes may have been added since): never from inside the composer's own loop
    /* preview (the panel): hold at a moment, or play back and forth, at the cut's own place; api.play(dir) plays it once */
    const wantHold = Number.isFinite(T.preview) && T.preview > 0, wantLoop = T.loop >= .5;
    if ((wantHold || wantLoop || pendingPlay) && phase === 'idle' && active() && now() >= loopNext) {
      const a = P1(), b = P2(), at = x => Math.abs(_p - x) < 1e-3 && Math.abs(_t - x) < 1e-3;
      if (pendingPlay < 0 ? at(b) : at(a)) { arm(pendingPlay < 0 ? -1 : +1, pendingPlay < 0 ? b : a); pendingPlay = 0; }
      else if (wantLoop && at(b)) arm(-1, b);
      else { navigating = false; _p = _t = pendingPlay < 0 ? b : a; if (J) J.velocity = 0; }
    }
  }

  /* ---------------------------------------------------------------- the brush (see the header) */
  const soft = v => { const a = P1(); return v <= a ? v : a + T.cap * Math.tanh((v - a) / T.cap); };
  const forestApi = () => window.__FLOW2_FOREST_ATLAS__;
  /* forward, the valley flies on BY TIME under the stroke: from the visitor's own speed, easing out to rest exactly as the stroke covers
     the screen, never further than T.cap past picture one (the canyon's clean stretch ends there) */
  let lastW = 0, lastV = 0, speed = 0, pS = 0, pD = 0;
  const glide = () => { const span = Math.max(.05, reduce.matches ? T.reduceFade : T.brushTime), t = Math.min(1, (now() - t0) / 1000 / span); return pS + pD * (1 - Math.pow(1 - t, 2.2)); };
  function brushProgress(v) {
    const tw = now();
    if (phase === 'sweep') return dir > 0 ? glide() : Math.min(v, P1() + (MOTION_NEW ? -T.land : T.cap));
    if (tw - lastW > 0 && tw - lastW < 200) speed = speed * .6 + .4 * Math.max(0, (v - lastV) / ((tw - lastW) / 1000)); else speed = 0;
    lastW = tw; lastV = v;
    if (!active()) return v;
    if (navigating && !MOTION_NEW) return v;
    const a = P1(), b = P2(), old = _p;
    if (MOTION_NEW && navigating) {
      /* the page's navigation crossing the cut: the stroke plays, then the journey goes on to where it was sent */
      if (old < a + EPS && v >= a - T.pre && _t > b - EPS) { navTarget = _t; _t = P1() + T.cap; navigating = false; _p = soft(Math.min(v, a)); sweep(+1); return phase === 'sweep' ? glide() : _p; }
      if (old > b - EPS && v < b - EPS && _t < a + EPS) { navTarget = _t; navigating = false; sweep(-1); return phase === 'sweep' ? P1() : v; }
      return v;
    }
    if (old < a + EPS && v >= old && _t > a + EPS && v >= a - T.pre && v < b - EPS) { _p = soft(v); sweep(+1); return phase === 'sweep' ? glide() : _p; }
    /* a small turn up at picture two: held there (no stroke) until the visitor asks clearly above it */
    if (MOTION_NEW && old >= b - EPS && v < old && _t < b - EPS && _t > b - T.backAsk) { if (J) J.velocity = 0; return b; }
    if (old >= b - EPS && v <= old && _t < b - EPS && v <= b + T.reach && v > a + EPS) { sweep(-1); return P1(); }
    return v;
  }
  function sweep(d) {
    const F = forestApi()?.scene;
    if (!F) return;
    dir = d; phase = 'sweep'; t0 = now(); lastFrameAt = t0;
    S.phase = 'play'; S.dir = d; S.cuts++; S.mode = 'brush'; S.t = 0;
    document.documentElement.setAttribute('data-flow2-brush', d > 0 ? 'in' : 'out');   /* the canyon's lock-on labels fade with the stroke (flow2-forest-atlas.css) */
    S.last = { dir: d, mode: 'brush', at: Math.round(t0), frames: [] };
    let replay = true;
    if (d > 0) {
      replay = !MOTION_NEW || !motion.recent() || !(F.growth > .02);
      if (replay) F.arrive?.(); else F.setGrowth?.(F.growth);   /* coming back soon: the land as it was left (it finishes growing after the stroke) */
      const span = Math.max(.05, reduce.matches ? T.reduceFade : T.brushTime);
      pS = Math.min(_p, P1() + T.cap); pD = Math.max(0, Math.min(speed * span / 2.2, P1() + T.cap - pS));
      S.last.glide = { from: +(pS - shift()).toFixed(3), by: +pD.toFixed(3), speed: +speed.toFixed(3) };
    }
    else { _t = P1() - (MOTION_NEW ? T.land : .04); F.setGrowth?.(F.growth); }
    setOverride(0);
    if (MOTION_NEW) { S.last.replay = replay; announce(d, 'start', replay); }
  }
  function setOverride(t, hold) {
    const A = forestApi(); if (!A) return;
    const e = t * t * (3 - 2 * t), c0 = 7.9, c1 = T.to;
    const brush = .18 * t + .82 * e;                       // the stroke speeds up and settles
    A.override = { on: 1, clock: dir > 0 ? c0 + (c1 - c0) * e : c1 - (c1 - c0) * e, brush: dir > 0 ? brush : 1 - brush, dir, reduce: reduce.matches ? 1 : 0,
      look: [T.brushAngle * Math.PI / 180, T.brushSoft, T.brushBristle, T.brushSmear], hold: !!hold };
  }
  function endSweep(reason) {
    if (phase !== 'sweep') return;
    if (dir > 0 && reason !== 'navigation') { _p = P2(); _t = P2(); if (J) J.velocity = 0; }
    const A = forestApi(); if (A) { A.override = null; if (!(MOTION_NEW && dir < 0)) A.scene?.autoGrowth?.(); }
    phase = 'idle'; S.phase = 'idle'; S.t = 1; S.ended = reason;
    document.documentElement.removeAttribute('data-flow2-brush');
    if (MOTION_NEW) {
      if (dir < 0) motion.left();
      announce(dir, 'end', S.last && S.last.replay);
      const go = navTarget; navTarget = NaN;
      if (Number.isFinite(go) && reason !== 'navigation' && J && (dir > 0 ? go > P2() + EPS : go < P1() - T.land - EPS)) { navigating = true; J.target = go; }
    }
  }
  let previewing = false, warmFrame = false, warmedNear = false;
  function brushFrame() {
    if (phase === 'sweep') {
      const span = Math.max(.05, reduce.matches ? T.reduceFade : T.brushTime), t1 = now();
      const t = Math.min(1, (t1 - t0) / 1000 / span); S.t = +t.toFixed(3);
      if (S.last && S.last.frames.length < 240) S.last.frames.push(+(t1 - lastFrameAt).toFixed(1));
      lastFrameAt = t1;
      if (t >= 1) { endSweep('done'); if (T.loop >= .5) loopNext = now() + 900; } else setOverride(t);
      return;
    }
    /* coming down the valley towards the stroke: draw the view from above once, invisibly (a mask of nothing), so its first real frame is warm */
    if (phase === 'idle' && active()) {
      const c = _p - shift(), A = forestApi();
      if (warmFrame) { warmFrame = false; if (A && A.override && A.override.warm) A.override = null; S.phase = 'idle'; }
      else if (false && A?.scene && !warmedNear && c > T.from - T.pre - .9 && c < T.from - T.pre - .05 && _t >= _p) {   /* off (2026-11-15 22:20): the warm frame itself was a 58 ms frame in the canyon */
        warmedNear = true; warmFrame = true; S.phase = 'armed';
        A.override = { on: 1, warm: 1, clock: 7.9, brush: 0, dir: 1, reduce: 0, look: [T.brushAngle * Math.PI / 180, T.brushSoft, T.brushBristle, T.brushSmear] };
        S.warm.brush = 'clock ' + c.toFixed(2);
      }
      if (c < T.from - 2) warmedNear = false;
    }
    /* the panel: hold the stroke at a moment at picture one, or play it back and forth; api.play(dir) plays it once */
    const wantHold = Number.isFinite(T.preview) && T.preview > 0, wantLoop = T.loop >= .5;
    if (wantHold && active()) {
      if (Math.abs(_p - P1()) > 1e-3) { navigating = false; _p = _t = P1(); if (J) J.velocity = 0; }
      dir = 1; setOverride(Math.min(.999, T.preview), true); previewing = true; return;
    }
    if (previewing) { previewing = false; const A = forestApi(); if (A) A.override = null; }
    if ((wantLoop || pendingPlay) && active() && now() >= loopNext) {
      const a = P1(), b = P2(), at = x => Math.abs(_p - x) < 1e-3 && Math.abs(_t - x) < 1e-3;
      if ((pendingPlay < 0 || (wantLoop && at(b))) && at(b)) { pendingPlay = 0; sweep(-1); _p = P1(); }
      else if (pendingPlay >= 0 && at(a)) { pendingPlay = 0; sweep(+1); }
      else { navigating = false; _p = _t = pendingPlay < 0 ? b : a; if (J) J.velocity = 0; }
    }
  }

  /* ---------------------------------------------------------------- warm-up */
  function warmPrograms() {
    /* the two programs, as the frame will use them: the copy into the kept frame (a target), the cells onto the screen */
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), geo = new THREE.PlaneGeometry(2, 2);
    const meshCopy = new THREE.Mesh(geo, copyPass.material), meshCut = new THREE.Mesh(geo, material);
    meshCopy.frustumCulled = meshCut.frustumCulled = false;
    const tiny = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, depthBuffer: false });
    const t0w = now();
    (async () => {
      const prev = renderer.getRenderTarget();
      let a, b;
      try { scene.add(meshCopy); renderer.setRenderTarget(tiny); a = renderer.compileAsync ? renderer.compileAsync(scene, cam) : null; }
      finally { scene.remove(meshCopy); renderer.setRenderTarget(prev); }
      await a;
      try { scene.add(meshCut); renderer.setRenderTarget(null); b = renderer.compileAsync ? renderer.compileAsync(scene, cam) : null; }
      finally { scene.remove(meshCut); renderer.setRenderTarget(prev); }
      await b;
      /* one real draw of each, off screen, so nothing is left for the first frame of the cut */
      await new Promise(r => requestAnimationFrame(r));
      const prev2 = renderer.getRenderTarget(), U = material.uniforms;
      U.tDiffuse.value = tiny.texture; U.tHeld.value = tiny.texture; U.uRes.value.set(4, 4); U.uT.value = .5;
      try {
        scene.add(meshCopy); renderer.setRenderTarget(tiny); renderer.render(scene, cam); scene.remove(meshCopy);
      } finally { renderer.setRenderTarget(prev2); }
      U.tDiffuse.value = null; U.tHeld.value = null;
      S.warm.programs = Math.round(now() - t0w) + ' ms (async)';
    })().catch(error => { S.warm.programs = 'failed: ' + (error?.message || error); }).finally(() => { geo.dispose(); tiny.dispose(); });
  }

  let aerialWarmed = false;
  function warm(args) {
    if (!study || !Number.isFinite(_p)) return;
    const c = _p - shift(), quiet = now() - lastInput > 700 && Math.abs(_t - _p) < 1e-3;
    /* the kept frame: made near the cut, let go far from it */
    const near = c > T.from - 3.2 && c < T.to + .9, close = c > T.from - 1.2 && c < T.to + .5;
    if (near && (quiet || close) && !snap) {
      const rb = composer.readBuffer; ensureSnap(rb.width, rb.height);
      const prev = renderer.getRenderTarget(); renderer.setRenderTarget(snap); renderer.clear(true, false, false); renderer.setRenderTarget(prev);
      S.warm.snapshot = rb.width + ' × ' + rb.height;
    } else if (!near && snap && phase === 'idle') { snap.dispose(); snap = null; S.warm.snapshot = 'let go'; }
    /* the aerial view, once, from picture two's camera, in a quiet moment in the valley */
    if (!aerialWarmed && quiet && c > 1.9 && c < T.from - .05 && args && args.length >= 4) {
      aerialWarmed = true;
      const t1 = now();
      try { warmAerial(args); S.warm.aerial = (now() - t1).toFixed(1) + ' ms (once, clock ' + c.toFixed(2) + ')'; }
      catch (error) { S.warm.aerial = 'skipped: ' + (error?.message || error); }
    }
  }
  /* picture two's camera, from the canyon's own update (a pure function of its arguments), then this frame's back */
  function warmAerial(args) {
    const C = study.CONFIG || {}, c = T.to;
    const descent = document.documentElement.dataset.epilogue === 'world' ? Math.min(1, Math.max(0, +(C.mist && C.mist.descent) || 0)) : 0;
    const riseFrom = 6.4 - .05 * descent, riseTo = 11.8 - .6 * descent, joinFrom = 11.8 - 1.8 * descent;
    const riseW = Math.min(1.5, Math.max(0, +(C.valleyPolish && C.valleyPolish.riseSettle) || 0)), riseA = 10.18 - riseW;
    const cl = x => Math.min(1, Math.max(0, x));
    let riseU = cl((c - riseFrom) / (riseTo - riseFrom));
    if (riseW > 0 && c > riseA) { const s = cl((c - riseA) / riseW), uA = cl((riseA - riseFrom) / (riseTo - riseFrom)), m = riseW / (riseTo - riseFrom); riseU = uA + m * (s + s * s - s * s * s); }
    const aerial = [cl((c - 1.404) / (8 - 1.404)), args[1], args[2], riseU, cl((c - joinFrom) / (13.8 - joinFrom))];
    const rt = new THREE.WebGLRenderTarget(320, 160, { type: THREE.HalfFloatType, depthBuffer: true });
    const prev = renderer.getRenderTarget(), shadows = renderer.shadowMap.autoUpdate, hidden = oldHidden;
    setOld(false);   // the aerial view is warmed whole   /* flow2 td3 (2026-11-15) */
    try {
      update.apply(canyon, aerial);
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(rt); renderer.render(canyon.scene, canyon.camera);
    } finally {
      renderer.shadowMap.autoUpdate = shadows; renderer.setRenderTarget(prev);
      update.apply(canyon, args);
      rt.dispose();
      setOld(hidden);
    }
  }

  /* ---------------------------------------------------------------- the picture */
  function build() {
    const vertexShader = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
    copyPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null } }, vertexShader,
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }'
    });
    copyPass.material.toneMapped = false;
    pass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, tHeld: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 }, uFade: { value: 0 }, uTier: { value: 2 },
        uCell: { value: new THREE.Vector4(.15, .3, .7, 3.1) },     // size at the middle, size gradient k, jitter, seed
        uSizeDir: { value: new THREE.Vector2(1, 0) },
        uFront: { value: new THREE.Vector4(0, 1, .4, .35) },      // front direction (x, y), width, curvature
        uLook: { value: new THREE.Vector4(1, 1, 1.1, 1.2) },      // refraction, rim brightness, rim half-width px, chroma px
        uRimColor: { value: new THREE.Color(T.rimColor) }, uFill: { value: 1 }
      },
      vertexShader, fragmentShader: FRAGMENT
    });
    pass.material.toneMapped = false;
    material = pass.material;
    pass.enabled = false; pass.mode = 'idle';
    const shaderRender = pass.render.bind(pass);
    pass.render = function (r, writeBuffer, readBuffer, deltaTime, maskActive) {
      try { draw(r, writeBuffer, readBuffer, deltaTime, maskActive, shaderRender); }
      catch (error) { pass.enabled = false; phase = 'idle'; S.phase = phase; S.stage = 'failed while drawing: ' + (error?.message || error); console.warn('flow2 lift cut: switched off', error); }
    };
    composer.addPass(pass);
    api.play = d => { if (phase !== 'idle' || !installed) return false; pendingPlay = d < 0 ? -1 : 1; return true; };
  }

  /* the pass is the last of the page's chain while it plays (the finished picture, as shown) */
  function seat() {
    const P = composer.passes, i = P.indexOf(pass);
    if (i === P.length - 1) return;
    if (i >= 0) P.splice(i, 1);
    P.push(pass);
  }

  function ensureSnap(w, h) {
    if (snap && snap.width === w && snap.height === h) return snap;
    snap?.dispose();
    snap = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    snap.texture.name = 'flow2 lift cut: kept frame';
    return snap;
  }

  function draw(r, writeBuffer, readBuffer, deltaTime, maskActive, shaderRender) {
    const t1 = now();
    if (pass.mode === 'capture') {
      /* this frame is the one on the screen: keep it (one copy), show it, and move the journey to the other place */
      const keep = ensureSnap(readBuffer.width, readBuffer.height);
      copyPass.renderToScreen = false; copyPass.render(r, keep, readBuffer);
      setUniforms(readBuffer, 0); shaderRender(r, writeBuffer, readBuffer, deltaTime, maskActive);
      pass.mode = 'play'; jump();
      return;
    }
    if (pass.mode !== 'play' || phase !== 'play') { pass.enabled = false; setUniforms(readBuffer, 1); shaderRender(r, writeBuffer, readBuffer, deltaTime, maskActive); return; }
    const span = Math.max(.05, reduce.matches ? T.reduceFade : T.duration);
    let t = Math.min(1, (t1 - t0) / 1000 / span);
    const hold = Number.isFinite(T.preview) && T.preview > 0;
    if (hold) { t = Math.min(.999, T.preview); t0 = t1 - t * span * 1000; }
    S.t = +t.toFixed(3);
    if (S.last && S.last.frames.length < 240) S.last.frames.push(+(t1 - lastFrameAt).toFixed(1));
    lastFrameAt = t1;
    setUniforms(readBuffer, t);
    shaderRender(r, writeBuffer, readBuffer, deltaTime, maskActive);
    if (t >= 1 && !hold) { finish('done'); if (T.loop >= .5) loopNext = now() + 1000; }
  }

  function setUniforms(readBuffer, t) {
    const U = material.uniforms, w = readBuffer.width, h = readBuffer.height, aspect = w / h, q = tier();
    U.tHeld.value = snap ? snap.texture : readBuffer.texture;
    U.uRes.value.set(w, h);
    U.uT.value = t <= 0 ? 0 : t >= 1 ? 1 : .65 * t + .35 * t * t * (3 - 2 * t);
    U.uFade.value = reduce.matches ? 1 : 0; U.uTier.value = q;
    if (S.tier !== String(q)) S.tier = String(q);
    /* the size gradient: cells grow by sizeVar across the screen's extent along sizeAngle */
    const sa = T.sizeAngle * Math.PI / 180, sd = [Math.cos(sa), Math.sin(sa)], extent = Math.abs(sd[0]) * aspect + Math.abs(sd[1]);
    const k = Math.log(Math.max(1.0001, T.sizeVar)) / Math.max(.2, extent);
    U.uCell.value.set(T.size * (q === 0 ? 1.55 : 1), Math.max(.002, k), T.jitter, 3.1);
    U.uSizeDir.value.set(sd[0], sd[1]);
    const fa = T.angle * Math.PI / 180 + (dir < 0 ? Math.PI : 0);
    U.uFront.value.set(Math.cos(fa), Math.sin(fa), T.front, T.curve);
    U.uLook.value.set(q === 0 ? 0 : T.refract, T.rim, T.rimWidth * h / 930, T.chroma * h / 930);
    U.uRimColor.value.set(T.rimColor); U.uFill.value = Math.min(1, Math.max(0, +T.fill || 0));
  }

  const FRAGMENT = `
    precision highp float;
    uniform sampler2D tDiffuse, tHeld;
    uniform vec2 uRes, uSizeDir;
    uniform float uT, uFade, uTier;
    uniform vec4 uCell, uFront, uLook;
    uniform vec3 uRimColor;
    uniform float uFill;
    varying vec2 vUv;
    const float H3 = .8660254;
    vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p + uCell.w) * 43758.5453); }
    float hash1(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1)) + uCell.w * 1.7) * 15731.743); }
    vec2 cmul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
    /* the lattice lives in w: a conformal map of the screen in which every cell is the same size; on the screen the cells grow
       smoothly towards one side (local size = S0 * exp(k * x along uSizeDir)) and keep their shapes */
    vec2 toW(vec2 zr, out vec2 e){
      float k = uCell.y, S0 = uCell.x;
      float m = exp(-k * zr.x); e = m * vec2(cos(k * zr.y), -sin(k * zr.y));     // exp(-k z)
      return vec2(1. - e.x, -e.y) / (k * S0);
    }
    vec2 fromW(vec2 w){
      float k = uCell.y, S0 = uCell.x;
      vec2 e = vec2(1. - k * S0 * w.x, -k * S0 * w.y);
      return -vec2(log(length(e)), atan(e.y, e.x)) / k;
    }
    vec2 seedAt(vec2 c){
      vec2 h = hash2(c);
      float a = 6.2831853 * h.y, r = uCell.z * .46 * sqrt(h.x);
      return vec2(c.x + .5 * c.y, H3 * c.y) + r * vec2(cos(a), sin(a));
    }
    void main(){
      if (uFade > .5) { gl_FragColor = mix(texture2D(tHeld, vUv), texture2D(tDiffuse, vUv), smoothstep(0., 1., uT)); return; }
      if (uT <= 0.) { gl_FragColor = texture2D(tHeld, vUv); return; }
      if (uT >= 1.) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      float aspect = uRes.x / uRes.y, px = uRes.y / 930.;
      vec2 z = (vUv - .5) * vec2(aspect, 1.);
      mat2 R = mat2(uSizeDir.x, -uSizeDir.y, uSizeDir.y, uSizeDir.x);   // screen -> rotated (x along the size gradient)
      vec2 zr = R * z, e;
      vec2 w = toW(zr, e);
      /* nearest seed (hex lattice in skewed coordinates) */
      vec2 lc = vec2(w.x - .5 * w.y / H3, w.y / H3), base = floor(lc + .5);
      float best = 1e9; vec2 nC = base, nP = vec2(0.);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 c = base + vec2(float(i), float(j)), p = seedAt(c), d = p - w;
        float dd = dot(d, d);
        if (dd < best) { best = dd; nC = c; nP = p; }
      }
      /* distance to the cell's borders: sharp (the rim) and soft (the lens), with the soft inward normal */
      float dMin = 1e9, rIn = 1e9, sumW = 0., sumR = 0.; vec2 nrm = vec2(0.);
      bool soft = uTier > .5;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        if (i == 0 && j == 0) continue;
        vec2 c = nC + vec2(float(i), float(j)), p = seedAt(c), ab = p - nP;
        float len = length(ab); vec2 eb = ab / len;
        float d = dot(.5 * (nP + p) - w, eb);
        if (d < dMin) { dMin = d; if (!soft) nrm = -eb; }
        rIn = min(rIn, .5 * len);
        if (soft) { float wt = exp(-d / .06); sumW += wt; nrm -= wt * eb; sumR += exp(-d / .018); }
      }
      float dSoft = soft ? -.06 * log(max(sumW, 1e-30)) : dMin;
      float scale = uCell.x * exp(uCell.y * zr.x);              // screen heights per w unit, here
      float dPx = (soft ? -.018 * log(max(sumR, 1e-30)) : dMin) * scale * uRes.y;   // the rim's distance: corners slightly rounded
      float h = clamp(dSoft / max(rIn, 1e-3), 0., 1.);          // 0 at the rim, 1 in the middle
      vec2 nZr = normalize(cmul(normalize(nrm + 1e-6), vec2(e.x, -e.y)));
      vec2 nZ = transpose(R) * nZr;                              // inward, on the screen
      vec2 nUv = nZ / vec2(aspect, 1.);
      /* this cell's moment along the front */
      vec2 cZ = transpose(R) * fromW(nP);
      vec2 cUv = cZ / vec2(aspect, 1.) + .5;
      vec2 fd = uFront.xy, pd = vec2(-fd.y, fd.x);
      float ext = .5 * (abs(fd.x) * aspect + abs(fd.y)), extP = .5 * (abs(pd.x) * aspect + abs(pd.y));
      float f = .5 + .5 * dot(cZ, fd) / ext, q = clamp(dot(cZ, pd) / extP, -1., 1.);
      f -= uFront.w * .22 * (1. - q * q);
      f += (hash1(nC) - .5) * .16;
      f = clamp(f, 0., 1.);
      float W = uFront.z, Rp = .1;
      float s0 = Rp + f * (1. - W - Rp);
      float u = clamp((uT - s0) / W, 0., 1.), pre = smoothstep(s0 - Rp, s0, uT);
      /* a cell's life: the glass forms over the old picture (pre: the rim fades in, the old picture bulges in the bead), the bead
         flips to the next picture from its middle (quickly), the lens relaxes and the rim thins away */
      float flip = smoothstep(0., .3, u);
      float th = 1.04 - 1.3 * flip, aaH = fwidth(h) + .01;
      float iris = smoothstep(th - aaH, th + aaH, h);
      /* or: the cell fills with the next view along the front's direction, a water line rising through it (the meniscus curves
         up at the walls) */
      float cellExt = max(rIn * scale * 1.25, 1e-4);
      float sA = dot(z - cZ, uFront.xy) / cellExt, sP = dot(z - cZ, vec2(-uFront.y, uFront.x)) / cellExt;
      /* the level starts below the lowest corner any cell can have and ends above the highest (a seed is not its cell's centre,
         and a long cell reaches far from it): no sliver of the next view shows in a cell before its turn */
      float lvl = -2.7 + 5.4 * flip + .1 * min(sP * sP, 2.25), aaF = fwidth(sA) + .004;
      float water = 1. - smoothstep(lvl - aaF, lvl + aaF, sA);
      water = max(water, smoothstep(.9, 1., flip));
      float inside = mix(iris, water, uFill);
      float relax = 1. - smoothstep(.12, 1., u);
      float rScr = rIn * scale;                                  // the cell's inner radius, screen heights
      float edge = 1. - h, ring = edge * edge * edge;
      float lensIn = uLook.x * relax, lensOut = uLook.x * pre * (1. - flip) * .7;
      /* magnified in the middle; near the rim the outer picture is squeezed in (rays bent outward by the dome) */
      vec2 uvIn = cUv + (vUv - cUv) * (1. - .2 * lensIn) - nUv * lensIn * ring * rScr * .55;
      vec3 colIn = texture2D(tDiffuse, uvIn).rgb;
      vec3 colOut;
      if (uTier > 1.5) {
        /* the glass of the lattice already lies over the old picture where the front is near */
        vec2 uvOut = cUv + (vUv - cUv) * (1. - .12 * lensOut) - nUv * lensOut * ring * rScr * .45;
        colOut = texture2D(tHeld, uvOut).rgb;
        /* the rim of the bead splits the light a little: warm outside, cool inside */
        float sp = uLook.w / uRes.y * ring * lensIn;
        colIn.r = texture2D(tDiffuse, uvIn - nUv * sp * 1.2).r;
        colIn.b = texture2D(tDiffuse, uvIn + nUv * sp * 1.2).b;
      } else colOut = texture2D(tHeld, vUv).rgb;
      vec3 col = mix(colOut, colIn, inside);
      /* the edge of the flip: a hairline of light while the bead turns */
      float hq = mix((h - th) / (aaH * 1.4), (sA - lvl) / (aaF * 1.4), uFill);
      col += uRimColor * .13 * flip * (1. - flip) * 4. * exp(-hq * hq) * step(.5, uTier);
      /* the rim: a thin pale line on the border; a faint warm / cool split across it (high); it thins and goes as the cell opens */
      float rimA = pre * (1. - smoothstep(.42, 1., u)) * uLook.y;
      float wpx = uLook.z * (.75 + .5 * smoothstep(.06, .3, rScr)) * mix(1., .3, smoothstep(.3, 1., u));
      float aa = max(fwidth(dPx), .35);
      float rG = 1. - smoothstep(wpx - aa, wpx + aa, dPx);
      vec3 rim = vec3(rG);
      if (uTier > 1.5) {
        float sh = dot(nZ, normalize(vec2(.8, .6))) * uLook.w;
        rim.r = 1. - smoothstep(wpx - aa, wpx + aa, dPx + sh);
        rim.b = 1. - smoothstep(wpx - aa, wpx + aa, dPx - sh);
        /* the bead's bevel: a soft light on the side facing the light, a soft shade on the other (inside open cells only) */
        float lit = dot(-nZ, normalize(vec2(-.55, .83)));
        col *= 1. + mix(lensOut, lensIn * inside, inside) * ring * .2 * lit;
      }
      col = col * (1. - .5 * rG * rimA) + uRimColor * rim * rimA * .92;
      /* the bead's inner edge: a second, finer line just inside the rim (fine detail at the edges, no glow) */
      if (uTier > .5) { float d2 = abs(dPx - (wpx + 2.6 * px)); col = mix(col, uRimColor, rimA * .22 * (1. - smoothstep(.3 * px, .3 * px + aa, d2))); }
      gl_FragColor = vec4(col, 1.);
    }`;
})();
