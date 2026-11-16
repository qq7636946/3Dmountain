/* Flow2 · the canyon → view entrance (team F4, 2026-11-16). index1-5-canyon-forest.html.
   Client: 「山道>俯視時候應該要做進場效果 例如轉不同視角再到俯視之類的」 — passing from the canyon road to the view from above, the view makes an
   entrance: the lens comes in low, oblique and turned, and swings up in one continuous curve into the top-down composition.
   Earlier rules of the same client kept: one entrance, then nothing moves on its own; it is tied to the brush stroke of flow2-lift-cut.js
   (document 'flow2:handover' { dir, phase, replay }); a quick return (within that file's replay gap) shows no entrance; no zoom-in-then-out
   (the distance only grows, the tilt only lifts, the turn only unwinds — every part eases out without overshoot).

   How: the lens is the scene's (flow2-original-scene.js); this file only adds offsets through its hook scene.setEntry({ fore, side, turn, dist })
   and clears them (setEntry(null)) when the move is done. It replaces the scene's own short arrival rise (tune.arrive, set to 0 here), so the
   two never fight. Reduce motion: no move. ?entry=0 leaves this file out (the scene's own arrival rise then plays as before).
   Live: window.__FLOW2_AERIAL_ENTRY__ = { tune, state, play(), stop() }. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('entry') === '0') return;
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)'); } catch (error) { return { matches: false }; } })();
  /* the move: where the lens starts (added to the composed pose) and how long it takes to come home */
  const T = {
    fore: num('entryFore', 30),      // degrees more oblique at the start (the lens low over the lake, looking across it)
    turn: num('entryTurn', 58),      // degrees turned about the vertical at the start (the land comes round under it)
    side: num('entrySide', -6),      // degrees of sideways lean at the start
    dist: num('entryDist', .62),     // distance factor at the start (closer; it only grows to 1)
    time: num('entryTime', 2.5),     // seconds from the stroke's start to the composed view
    turnLead: .82,                   // the turn finishes a little before the tilt (share of the time), so the last moment is a pure rise
    maxFore: num('entryMax', 52)   // the start never tilts past this from the vertical: a lens nearer the horizon shows far more land, trees and fog (cost)
  };
  const S = { stage: 'waiting for the view', plays: 0, skipped: 0, playing: false, t: 0, arrive: null, fore: 0 };
  let scene = null, raf = 0, t0 = 0, owned = false;   /* owned: this file holds the lens offsets only while its move runs (team F3 uses setEntry after FOUR PATHS) */
  const busy = () => (+(window.__FLOW2_LATTICE__ && window.__FLOW2_LATTICE__.amount) || 0) > 0 || (+(scene && scene.zoom) || 0) > 0;   /* the 3D lines / the zoom into the lake own the lens */

  const ease = t => 1 - Math.pow(1 - t, 3);                          // fast under the stroke, a long soft landing, never past 0
  function frame(now) {
    raf = 0;
    if (!scene || !S.playing || !owned) return;
    if (busy()) { stop('the lines or the zoom took over'); return; }
    const t = Math.min(1, (now - t0) / 1000 / Math.max(.3, T.time)); S.t = +t.toFixed(3);
    const a = 1 - ease(t), b = 1 - ease(Math.min(1, t / Math.max(.3, T.turnLead)));
    scene.setEntry({ fore: S.fore * a, side: T.side * a, turn: T.turn * b, dist: 1 - (1 - T.dist) * a });
    if (t >= 1) { stop('done'); return; }
    raf = requestAnimationFrame(frame);
  }
  function play() {
    if (!scene || reduce.matches || busy()) { S.skipped++; return; }
    /* how much more oblique it may start: the composed view of the floating-mark version is already oblique (俯角 +34), so it gets little */
    const rest = +(scene.pose && scene.pose.fore) || 10; S.fore = Math.max(0, Math.min(T.fore, T.maxFore - rest));
    S.plays++; S.playing = true; S.stage = 'playing'; t0 = performance.now(); owned = true;
    scene.setEntry({ fore: S.fore, side: T.side, turn: T.turn, dist: T.dist });   /* the first frame of the view already stands at the start */
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function stop(why) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const mine = owned; owned = false; S.playing = false; S.stage = why || 'stopped';
    if (mine) { try { scene?.setEntry(null); } catch (error) { } }   /* one release, and only of what this file set */
  }
  window.__FLOW2_AERIAL_ENTRY__ = { tune: T, state: S, play, stop };

  /* the stroke into the view starts the move (a replayed entrance only); going back cancels it */
  document.addEventListener('flow2:handover', event => {
    const d = event.detail || {};
    if (!scene) return;
    if (d.phase === 'start' && (d.dir === 1 || d.dir === 'in')) { if (d.replay) play(); else { S.skipped++; stop('quick return: no entrance'); } }
    else if (d.phase === 'start' && (d.dir === -1 || d.dir === 'out')) stop('left');
  });

  /* wait for the view's scene (flow2-forest-atlas.js sets window.__FLOW2_FOREST_ATLAS__.scene once it is built) */
  (function find() {
    const A = window.__FLOW2_FOREST_ATLAS__, sc = A && A.scene;
    if (sc && typeof sc.setEntry === 'function') {
      scene = sc; S.stage = 'ready';
      if (sc.tune && 'arrive' in sc.tune) { S.arrive = sc.tune.arrive; sc.tune.arrive = 0; }   /* this move replaces the scene's own arrival rise */
      return;
    }
    setTimeout(find, 250);
  })();
})();
