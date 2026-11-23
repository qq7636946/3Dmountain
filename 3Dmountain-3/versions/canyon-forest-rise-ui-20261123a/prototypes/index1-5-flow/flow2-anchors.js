/* Flow2 · round anchors and their hand-over (lead, 2026-11-16). index1-5-canyon-forest.html only.
   Client: 「幫我思考一開始的方形錨點可以改成圓形 到這塊時候剛好四方圓點停留」 — the square anchors of the canyon become round, and on arriving
   at the view from above the four round points come to rest exactly on its four places.

   The idea: the four fields are ONE set of four round points for the whole stretch. In the canyon each rides its beam of light (a fine ring
   with a white point in it, its name beside it — flow2-ui-lockon.js draws them; only their shape is changed here, by CSS). When the brush
   paints the view from above, each point leaves its ring, flies across the stroke to its own river — 01 to the north-west, 02 the north-east,
   03 the south-east, 04 the south-west — growing into the white point that marks the field there, and stays. Scrolling back, the four fly
   home to their beams. Reduce motion: no flight (each set simply shows in its own place).

   How: this file only DRAWS four travelling points while the stroke plays (html[data-flow2-brush], set by flow2-lift-cut.js) and for a moment
   after it, exactly over the real ones at both ends, so the change of hands is not seen. It reads the canyon marks' places from their nodes
   and the forest's places from the scene's own anchors and lens. Nothing else is touched. ?anchors=0 leaves it out (square anchors, no flight). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('anchors') === '0') return;
  const html = document.documentElement;
  html.setAttribute('data-flow2-anchors', '');
  /* client 2026-11-16: 「這圓圈都拿掉好了」 — the canyon marks lose their ring and point (their names stay), so nothing flies; ?anchorRings=1 brings both back */
  const rings = Q.get('anchorRings') === '1'; if (rings) html.setAttribute('data-flow2-anchor-rings', '');
  const S = { stage: 'ready', flights: 0, mode: '' };
  window.__FLOW2_ANCHORS__ = { state: S };

  const style = document.createElement('style');
  style.textContent = `
    /* the canyon's anchors: a fine ring, a white point with a dark heart (the same point the view from above shows, smaller), no corner marks, no readout */
    html[data-flow2-anchors][data-flow2-lockon] .f2u-lock[data-kind="canyon"] .f2u-lk-frame { border-radius: 50%; border-color: rgb(226 244 255 / 62%); background: rgb(6 25 43 / 7%); }
    html[data-flow2-anchors][data-flow2-lockon] .f2u-lock[data-kind="canyon"] .f2u-lk-frame::before { content: none; }
    html[data-flow2-anchors][data-flow2-lockon] .f2u-lock[data-kind="canyon"] .f2u-lk-frame::after { content: ""; position: absolute; inset: 5px; border-radius: 50%; border: 1px solid rgb(226 244 255 / 20%); }
    html[data-flow2-anchors][data-flow2-lockon] .f2u-lock[data-kind="canyon"] .f2u-lk-xy { display: none; }
    /* client 2026-11-16 08:00: 「這原點不要有黑點 然後白色要毛玻璃透明」 — a white frosted disc with one 1px line, no dark heart */
    html[data-flow2-anchors][data-flow2-lockon] .f2u-lock[data-kind="canyon"] .f2u-lk-box > i {
      box-sizing: border-box; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: rgb(255 255 255 / .3);
      border: 1px solid rgb(255 255 255 / .9); box-shadow: 0 1px 5px rgb(0 0 0 / .22);
      -webkit-backdrop-filter: blur(5px) brightness(1.15); backdrop-filter: blur(5px) brightness(1.15);
    }
    /* client 2026-11-16: 「文字拿掉」 — after the rings, the names too (they ran into the title's kicker): the canyon marks are gone; ?anchorRings=1 brings all back */
    html[data-flow2-anchors][data-flow2-lockon]:not([data-flow2-anchor-rings]) .f2u-lock[data-kind="canyon"] { display: none !important; }
    /* the travelling points */
    .f2a-layer { position: fixed; inset: 0; z-index: 7; pointer-events: none; contain: strict; }
    .f2a-dot { box-sizing: border-box; position: absolute; left: 0; top: 0; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%; background: rgb(255 255 255 / .3);
      border: 1px solid rgb(255 255 255 / .9); box-shadow: 0 2px 8px rgb(0 0 0 / .22); opacity: 0; will-change: transform, opacity;
      -webkit-backdrop-filter: blur(6px) brightness(1.15); backdrop-filter: blur(6px) brightness(1.15); }
    .f2a-layer.is-leaving .f2a-dot { transition: opacity .28s ease; opacity: 0 !important; }`;
  document.head.append(style);

  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)'); } catch (error) { return { matches: false }; } })();
  const SMALL = 14 / 24;
  let layer = null, dots = [], raf = 0, mode = '', from = [null, null, null, null], settleAt = 0, lastTo = [null, null, null, null];
  const clamp01 = v => Math.min(1, Math.max(0, v)), ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const cutState = () => (window.__FLOW2_LIFT_CUT__ || {}).state || null;
  const forest = () => (window.__FLOW2_FOREST_ATLAS__ || {}).scene || null;

  function build() {
    if (layer) return;
    layer = document.createElement('div'); layer.className = 'f2a-layer'; layer.setAttribute('aria-hidden', 'true');
    for (let k = 0; k < 4; k++) { const d = document.createElement('i'); d.className = 'f2a-dot'; layer.append(d); dots.push(d); }
    document.body.append(layer);
  }
  /* where the canyon's mark k stands on the screen (its point), or null when it is not shown */
  function canyonXY(k) {
    const node = document.querySelectorAll('.f2u-lock[data-kind="canyon"] .f2u-lk')[k];
    if (!node || !node.classList.contains('is-on')) return null;
    const box = node.querySelector('.f2u-lk-box'); if (!box) return null;
    const r = box.getBoundingClientRect(); if (!(r.width > 0)) return null;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return x > -40 && x < innerWidth + 40 && y > -40 && y < innerHeight + 40 ? [x, y] : null;
  }
  /* where the view from above puts point k (the same rule as flow2-forest-atlas.js projectPoints) */
  function forestXY(k) {
    const F = forest(); if (!F || !F.anchors || !F.camera) return null;
    const a = F.anchors[k], c = F.camera, v = c.matrixWorldInverse.elements, p = c.projectionMatrix.elements, W = innerWidth, H = innerHeight;
    if (W < 600) return [W * (k === 0 || k === 3 ? .08 : .92), H * [.26, .36, .48, .55][k]];
    const ex = v[0] * a.x + v[4] * a.y + v[8] * a.z + v[12], ey = v[1] * a.x + v[5] * a.y + v[9] * a.z + v[13], ez = v[2] * a.x + v[6] * a.y + v[10] * a.z + v[14];
    const cw = p[3] * ex + p[7] * ey + p[11] * ez + p[15]; if (!(cw > 1e-6)) return null;
    const x = ((p[0] * ex + p[4] * ey + p[8] * ez + p[12]) / cw + 1) * .5 * W, y = (1 - (p[1] * ex + p[5] * ey + p[9] * ez + p[13]) / cw) * .5 * H;
    return [Math.max(52, Math.min(W - 52, x)), Math.max(145, Math.min(H * .87, y))];
  }
  /* a mark that is not on the screen starts (or ends) low on its own side: the four fan out as the four beams do */
  const fallback = k => [innerWidth * [.3, .43, .57, .7][k], innerHeight * .8];

  function place(k, x, y, scale, opacity) {
    const d = dots[k]; d.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${scale.toFixed(3)})`; d.style.opacity = opacity.toFixed(3);
  }
  function frame() {
    raf = 0;
    const brush = html.getAttribute('data-flow2-brush'), now = performance.now();
    if (brush && mode !== brush) {          /* a stroke begins */
      mode = brush; S.mode = mode; S.flights++; layer.classList.remove('is-leaving'); settleAt = 0;
      for (let k = 0; k < 4; k++) from[k] = (brush === 'in' ? canyonXY(k) : forestXY(k)) || (brush === 'in' ? fallback(k) : forestXY(k) || fallback(k));
    }
    if (brush) {
      const st = cutState(), t = clamp01(st ? +st.t || 0 : 0), e = ease(clamp01((t - .03) / .9));
      for (let k = 0; k < 4; k++) {
        const to = (mode === 'in' ? forestXY(k) : canyonXY(k)) || lastTo[k] || fallback(k); lastTo[k] = to;
        const a = from[k], bow = Math.sin(Math.PI * e) * 26 * (k < 2 ? -1 : 1);       /* a slight bow: the outer pair one way, the inner pair the other */
        const dx = to[0] - a[0], dy = to[1] - a[1], n = Math.hypot(dx, dy) || 1;
        const x = a[0] + dx * e + (-dy / n) * bow, y = a[1] + dy * e + (dx / n) * bow;
        const s = mode === 'in' ? SMALL + (1 - SMALL) * e : 1 - (1 - SMALL) * e;
        place(k, x, y, s, clamp01(t / .06));
      }
    } else if (mode) {                      /* the stroke is over: stay on the real points until they are there, then let go */
      if (!settleAt) settleAt = now;
      const stay = mode === 'in' ? 950 : 260;
      for (let k = 0; k < 4; k++) { const to = (mode === 'in' ? forestXY(k) : canyonXY(k)) || lastTo[k]; if (to) place(k, to[0], to[1], mode === 'in' ? 1 : SMALL, 1); }
      if (now - settleAt > stay) { layer.classList.add('is-leaving'); if (now - settleAt > stay + 320) { mode = ''; S.mode = ''; for (const d of dots) d.style.opacity = '0'; lastTo = [null, null, null, null]; return; } }
    } else return;
    raf = requestAnimationFrame(frame);
  }
  function wake() { if (reduce.matches || !rings) return; build(); if (!raf) raf = requestAnimationFrame(frame); }
  new MutationObserver(wake).observe(html, { attributes: true, attributeFilter: ['data-flow2-brush'] });
})();
