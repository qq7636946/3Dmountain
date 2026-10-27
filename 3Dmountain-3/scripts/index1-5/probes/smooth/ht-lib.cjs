'use strict';
/* ht-lib.cjs — shared pieces for the Hubtown smooth-scroll study (observation only; no assets are saved, only numbers
   and our own screenshots of the page). Opens https://hubtown.co.in/ in OUR headless Chrome (one at a time, via the QA lock),
   hooks WebGL BEFORE the page runs (uniform names -> camera), and gives helpers to send wheel input at an exact cadence.
   Used by hubtown-home.cjs / hubtown-inner.cjs / ours-notch.cjs. */
const path = require('node:path');
const L = require('../../lib.cjs');

/* runs inside the page before any of its scripts: names every uniform location, remembers the latest view / projection
   matrices and cameraPosition the page's renderer uploads, and starts a per-frame recorder when window.__HT.start() is called */
const HOOK = () => {
  const P = window.__HT = { names: new WeakMap(), seen: {}, view: null, viewFirst: null, proj: null, cam: null, frames: [], on: false, wheels: [], marks: [] };
  const proto = WebGL2RenderingContext.prototype;
  const gUL = proto.getUniformLocation;
  proto.getUniformLocation = function (prog, name) { const l = gUL.call(this, prog, name); if (l) P.names.set(l, name); return l; };
  const uM = proto.uniformMatrix4fv;
  proto.uniformMatrix4fv = function (loc, tr, v) {
    const n = P.names.get(loc);
    if (n) {
      P.seen[n] = (P.seen[n] || 0) + 1;
      if (n === 'viewMatrix') { const a = Array.from(v.length === 16 ? v : v.subarray(0, 16)); P.view = a; if (!P.viewFirst) P.viewFirst = a; }
      else if (n === 'projectionMatrix') P.proj = Array.from(v.length === 16 ? v : v.subarray(0, 16));
    }
    return uM.apply(this, arguments);
  };
  const u3 = proto.uniform3fv, u3f = proto.uniform3f;
  proto.uniform3fv = function (loc, v) { if (P.names.get(loc) === 'cameraPosition') P.cam = [v[0], v[1], v[2]]; return u3.apply(this, arguments); };
  proto.uniform3f = function (loc, x, y, z) { if (P.names.get(loc) === 'cameraPosition') P.cam = [x, y, z]; return u3f.apply(this, arguments); };
  P.u1 = {}; P.u1prev = {}; P.ulog = [];
  const u1f = proto.uniform1f;
  proto.uniform1f = function (loc, x) { const n = P.names.get(loc); if (n && P.on) P.u1[n] = x; return u1f.apply(this, arguments); };
  addEventListener('wheel', e => P.wheels.push([+performance.now().toFixed(1), e.deltaX, e.deltaY, e.deltaMode, e.isTrusted ? 1 : 0]), { capture: true, passive: true });
  /* watch: [selector, ...] text-bearing elements whose opacity/transform are logged each frame */
  P.watch = [];
  P.start = (sel) => {
    P.on = true; P.frames.length = 0; P.ulog.length = 0; P.u1prev = {}; P.watch = sel || [];
    const tick = now => {
      if (!P.on) return;
      const el = document.querySelector('.js-page-scroll') || document.querySelector('.lenis');
      const w = P.watch.map(s => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); return [+cs.opacity, cs.transform === 'none' ? '' : cs.transform]; });
      P.frames.push([+now.toFixed(2), el ? el.scrollTop : 0, P.viewFirst, P.view, P.cam, P.proj && P.proj[5], w]);
      P.viewFirst = null;
      const dlt = {}; let any = false; for (const k in P.u1) if (P.u1[k] !== P.u1prev[k]) { dlt[k] = +(+P.u1[k]).toFixed(4); P.u1prev[k] = P.u1[k]; any = true; } if (any) P.ulog.push([+now.toFixed(2), dlt]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  P.stop = () => { P.on = false; };
  /* send events at exact times (ms from now), on the element under the pointer; returns when `dur` has elapsed */
  P.send = (events, dur, pt = [720, 450]) => new Promise(res => {
    const t0 = performance.now(); let i = 0; const target = document.elementFromPoint(pt[0], pt[1]) || document.body;
    const tick = now => {
      const t = now - t0;
      while (i < events.length && events[i][0] <= t) { target.dispatchEvent(new WheelEvent('wheel', { deltaY: events[i][1], deltaX: events[i][2] || 0, deltaMode: 0, bubbles: true, cancelable: true, clientX: pt[0], clientY: pt[1] })); i++; }
      if (t < dur) requestAnimationFrame(tick); else res(t0);
    };
    requestAnimationFrame(tick);
  });
};

async function openHubtown(tool, o, url = 'https://hubtown.co.in/') {
  await L.acquireLock(tool, o);
  const browser = await L.launchBrowser({ autoplay: true });
  const vp = { width: 1440, height: 900, phone: false, dpr: 1 };
  const s = await L.newPage(browser, vp);
  await s.page.addInitScript(HOOK);
  L.note(tool + ': opening ' + url);
  await s.page.goto(url, { waitUntil: 'commit', timeout: 60000 });
  return Object.assign(s, { browser, vp });
}

/* camera position from a viewMatrix (column-major rigid): -R^T t */
const camFromView = v => v ? [-(v[0] * v[12] + v[1] * v[13] + v[2] * v[14]), -(v[4] * v[12] + v[5] * v[13] + v[6] * v[14]), -(v[8] * v[12] + v[9] * v[13] + v[10] * v[14])] : null;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* progress curve of a recorded path: s(t) = path length travelled so far / total (monotone even if the path is curved),
   returns { t0, t1 (first/last moving frame), total, p: [[t, s], …] } */
function pathProgress(frames, getPos, eps = 1e-5) {
  const pts = frames.map(f => [f[0], getPos(f)]).filter(p => p[1]);
  let s = 0; const acc = [[pts[0][0], 0]];
  for (let i = 1; i < pts.length; i++) { s += dist(pts[i][1], pts[i - 1][1]); acc.push([pts[i][0], s]); }
  const tot = s; let a = acc.findIndex(x => x[1] > eps), b = acc.length - 1; while (b > 0 && acc[b][1] - acc[b - 1][1] < eps) b--;
  return { t0: a >= 0 ? acc[a][0] : null, t1: acc[b][0], total: tot, p: acc.map(x => [x[0], tot ? x[1] / tot : 0]) };
}
/* time (ms, relative to t0) where the normalised progress first crosses q */
const tAt = (prog, q, t0) => { const x = prog.p.find(p => p[0] >= (t0 || 0) && p[1] >= q); return x ? +(x[0] - t0).toFixed(1) : null; };

/* least-squares fit of a cubic-bezier(x1,y1,x2,y2) easing to normalised samples [[u(0..1), v(0..1)]] */
function fitBezier(samples) {
  const bez = (x1, y1, x2, y2) => { const f = t => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2, x = 3 * (1 - m) * (1 - m) * m * x1 + 3 * (1 - m) * m * m * x2 + m * m * m; if (x < t) lo = m; else hi = m; } const m = (lo + hi) / 2; return 3 * (1 - m) * (1 - m) * m * y1 + 3 * (1 - m) * m * m * y2 + m * m * m; }; return f; };
  let best = { e: 1e9 };
  for (let x1 = 0; x1 <= 1.0001; x1 += .05) for (let x2 = 0; x2 <= 1.0001; x2 += .05) for (let y1 = -0.2; y1 <= 1.2; y1 += .05) for (let y2 = -0.2; y2 <= 1.4; y2 += .05) {
    const f = bez(x1, y1, x2, y2); let e = 0; for (const [u, v] of samples) { const d = f(u) - v; e += d * d; }
    if (e < best.e) best = { e, x1, y1, x2, y2 };
  }
  const r = n => +n.toFixed(2);
  return { css: `cubic-bezier(${r(best.x1)}, ${r(best.y1)}, ${r(best.x2)}, ${r(best.y2)})`, rmse: +Math.sqrt(best.e / samples.length).toFixed(4) };
}
/* a few named easings for comparison */
const NAMED = {
  linear: t => t, 'power2.out': t => 1 - Math.pow(1 - t, 2), 'power3.out': t => 1 - Math.pow(1 - t, 3), 'power4.out': t => 1 - Math.pow(1 - t, 4), 'expo.out': t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  'power2.inOut': t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, 'power3.inOut': t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, 'power4.inOut': t => t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  'expo.inOut': t => t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2, 'sine.inOut': t => -(Math.cos(Math.PI * t) - 1) / 2, 'circ.inOut': t => t < .5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
};
function bestNamed(samples) {
  let best = null;
  for (const [n, f] of Object.entries(NAMED)) { let e = 0; for (const [u, v] of samples) { const d = f(u) - v; e += d * d; } const r = Math.sqrt(e / samples.length); if (!best || r < best.rmse) best = { name: n, rmse: +r.toFixed(4) }; }
  return best;
}
/* samples of the normalised progress between t0 and t1 */
function samplesOf(prog, n = 40) {
  const out = []; if (prog.t0 == null) return out;
  for (let k = 0; k <= n; k++) { const t = prog.t0 + (prog.t1 - prog.t0) * k / n; const x = prog.p.find(p => p[0] >= t) || prog.p[prog.p.length - 1]; out.push([k / n, x[1]]); }
  return out;
}
module.exports = { L, HOOK, openHubtown, camFromView, dist, pathProgress, tAt, fitBezier, bestNamed, samplesOf, NAMED, path };
