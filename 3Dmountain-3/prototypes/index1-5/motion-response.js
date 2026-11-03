/* The journey's and the world's follow (2026-11-03, 客戶：「絲滑捲動套到正式頁」, tested first on index1-5-silk.html).
   The reference (orchestrated.nl: Lenis 1.3.19, lerp .12) follows the wheel with one exponential, value += (target - value) * (1 - e^(-7.2 dt)).
   Before, a critically damped spring (omega 11.5): it settles in the same time (95% in .413 s against .416 s) but eases in, 16% of a notch
   in 63 ms against 36%, which reads as weight, a lag. So only the start changed: the distance per notch, the chapter stops and the camera
   path are as they were. Measured on the test page: 120 ms after a notch 54% against 35% (journey), 45% against 25% (globe); same frame times.
   The speed the effects read (motion blur, flow surges) is the follow's own speed through a .06 s ease, so it does not jump on every
   notch; not the reference's .3 s release, which kept the blur on for about a second after the camera stopped.
   `?silk=0` gives the spring back (to compare, or to undo without a rebuild); window.__SILK__.on switches it live. */
const q = new URLSearchParams(location.search);
const num = (key, fallback) => { const v = parseFloat(q.get(key)); return Number.isFinite(v) ? v : fallback; };
export const SILK = window.__SILK__ = {
  on: q.get('silk') === '0' ? 0 : 1,
  lambda: num('silkLambda', 7.2),      // the reference: lerp .12 at 60 Hz
  ease: num('silkEase', .06),
  world: q.get('silkWorld') === '0' ? 0 : 1,
  SPRING: 11.5                          // the old omega; the world's per-section omegas scale against it
};

function spring(state, t) {
  const omega = SILK.SPRING, x = state.progress - state.target, v = state.velocity || 0, d = Math.exp(-omega * t), j = (v + omega * x) * t;
  state.progress = state.target + (x + j) * d; state.velocity = (v - omega * j) * d;
  if (state.progress < 0 || state.progress > state.max) { state.progress = Math.max(0, Math.min(state.max, state.progress)); state.velocity = 0; }
  if (Math.abs(state.progress - state.target) < .00005 && Math.abs(state.velocity) < .0005) { state.progress = state.target; state.velocity = 0; }
}

export function stepJourneyPolish(state, dt, reduced = false) {
  if (reduced) { state.progress = state.target; state.velocity = 0; return; }
  const t = Math.max(0, Math.min(.18, dt));
  if (!SILK.on) { spring(state, t); return; }
  const before = state.progress;
  state.progress = state.target + (state.progress - state.target) * Math.exp(-SILK.lambda * t);
  if (state.progress < 0 || state.progress > state.max) state.progress = Math.max(0, Math.min(state.max, state.progress));
  if (Math.abs(state.progress - state.target) < .00005) state.progress = state.target;
  if (t <= 0) return;
  // velocity holds the eased speed (a reversal or a jump that zeroes it just restarts the ease)
  const raw = (state.progress - before) / t, v = state.velocity || 0;
  state.velocity = v + (raw - v) * (1 - Math.exp(-t / Math.max(.001, SILK.ease)));
  if (state.progress === state.target && Math.abs(state.velocity) < .002) state.velocity = 0;
}

/* The world section (globe, ocean chapters, LOGO, footer) has its own loop and per-section omegas (finnovation-world.js, silk-scroll-build.cjs).
   Same exchange there: the exponential at omega * 7.2 / 11.5, so every section keeps its settle time. Returns [y, vy]. */
export function stepWorldFollow(y, yt, vy, omega, dt) {
  if (!SILK.on || !SILK.world) {
    const x = y - yt, decay = Math.exp(-omega * dt), temp = (vy + omega * x) * dt;
    return [yt + (x + temp) * decay, (vy - omega * temp) * decay];
  }
  const next = yt + (y - yt) * Math.exp(-omega * SILK.lambda / SILK.SPRING * dt);
  return [next, dt > 0 ? (next - y) / dt : 0];
}
