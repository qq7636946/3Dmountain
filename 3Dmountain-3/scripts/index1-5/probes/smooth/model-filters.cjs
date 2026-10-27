'use strict';
/* model-filters.cjs — numeric step / 5-notch / stream response of the candidate input smoothers (no browser).
   exp(τ) = Lenis-style damped lerp; crit(ω) = critically damped spring (ours today); silk(τ1, ω2) = exp(τ1) feeding crit(ω2).
   Prints t63/t95/t99 (ms after one notch), time of peak speed, % of the travel still to come after the 5th notch of 5 @100 ms,
   and the speed the visual would have 1 s after a 1 s stream stops (how long it coasts). */
const dt = 1 / 240;
const mk = {
  exp: tau => () => { let x = 0; return (tgt) => (x += (tgt - x) * (1 - Math.exp(-dt / tau))); },
  crit: om => () => { let x = 0, v = 0; return (tgt) => { const o = x - tgt, j = (v + om * o) * dt, d = Math.exp(-om * dt); x = tgt + (o + j) * d; v = (v - om * j) * d; return x; }; },
  silk: (tau, om) => () => { const a = mk.exp(tau)(), b = mk.crit(om)(); return tgt => b(a(tgt)); },
};
function run(make, events, T) { const f = make(); const out = []; let tgt = 0, i = 0; for (let k = 0; k * dt < T; k++) { const t = k * dt; while (i < events.length && events[i][0] <= t) tgt += events[i++][1]; out.push([t, f(tgt)]); } return out; }
const cases = { 'Hubtown home  exp τ=0.41 (lerp .04)': mk.exp(.4167), 'Hubtown inner exp τ=0.167 (lerp .1)': mk.exp(.1667), 'ours journey crit ω=10.5': mk.crit(10.5), 'ours bridge crit ω=5.5': mk.crit(5.5), 'ours world globe crit ω=9.5': mk.crit(9.5), 'ours ocean crit ω=6': mk.crit(6), 'ours strip crit ω=12': mk.crit(12),
  'proposal A silk τ1=.15 ω2=14': mk.silk(.15, 14), 'proposal B silk τ1=.22 ω2=12': mk.silk(.22, 12), 'proposal C silk τ1=.30 ω2=11': mk.silk(.30, 11), 'proposal D crit ω=8 (bridge/ocean fix)': mk.crit(8) };
console.log('case'.padEnd(42), 't63  t95  t99  peakAt | 5 notches: left after last, t95 after last | stream 1s: v at stop+0.5s / v at stop (rel)');
for (const [name, make] of Object.entries(cases)) {
  const s = run(make, [[0, 1]], 4), q = p => Math.round(1000 * (s.find(x => x[1] >= p) || [4])[0]);
  let pk = 0, pv = 0; for (let i = 1; i < s.length; i++) { const v = (s[i][1] - s[i - 1][1]) / dt; if (v > pv) { pv = v; pk = s[i][0]; } }
  const ev5 = [0, 1, 2, 3, 4].map(i => [i * .1, 1]), f5 = run(make, ev5, 5), at = f5.find(x => x[0] >= .4)[1], left = ((5 - at) / 5 * 100).toFixed(0), a95 = Math.round(1000 * ((f5.find(x => x[0] >= .4 && x[1] >= at + .95 * (5 - at)) || [5])[0] - .4));
  const evS = Array.from({ length: 50 }, (_, i) => [i * .02, 1]), fs = run(make, evS, 3), vAt = t => { const i = Math.round(t / dt); return (fs[i + 1][1] - fs[i][1]) / dt; }, v0 = vAt(1.0), vh = vAt(1.5);
  console.log(name.padEnd(42), String(q(.632)).padStart(4), String(q(.95)).padStart(4), String(q(.99)).padStart(4), (Math.round(pk * 1000) + ' ms').padStart(8), ' |', (left + ' %').padStart(5), String(a95).padStart(5), ' |', (vh / v0).toFixed(2));
}
