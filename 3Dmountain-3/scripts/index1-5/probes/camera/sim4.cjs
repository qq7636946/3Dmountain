// sim4: heading-correction table by feasibility DP (rate-capped, anchored at the stops), evaluated on the real wheel trajectory.
const fs = require('node:fs');
const d = require('./design-lib.cjs');
const { D, L, C, Wd, tangent, sOf } = d;
const H = .01, P0 = 4.6, P1 = 10.6, NP = Math.round((P1 - P0) / H);
const pAt = i => P0 + i * H;
function chordHeading(s, a = 29) { const c = C(s), e = C(Math.min(L, s + a)); return Math.atan2(e[0] - c[0], -(e[1] - c[1])) * D; }
function unwrap(arr) { for (let i = 1; i < arr.length; i++) { while (arr[i] - arr[i - 1] > 180) arr[i] -= 360; while (arr[i] - arr[i - 1] < -180) arr[i] += 360; } return arr; }
const psiOld = unwrap(Array.from({ length: NP + 1 }, (_, i) => chordHeading(sOf(pAt(i)))));
const gaussArr = (a, sigmaU) => { const K = Math.ceil(3 * sigmaU / H), w = []; for (let k = -K; k <= K; k++) w.push(Math.exp(-.5 * (k * H / sigmaU) ** 2)); return a.map((_, i) => { let s = 0, sw = 0; for (let k = -K; k <= K; k++) { const j = i + k; if (j < 0 || j > a.length - 1) continue; s += w[k + K] * a[j]; sw += w[k + K]; } return s / sw; }); };
// anchors: [p, tol(deg)]
const ANCH = { start: [4.87, 0], c1: [5.014, 1.5], c2: [5.854, 1.5], n3: [7.594, 2], c3: [7.694, 1.5], n4: [9.744, 2], c4: [9.794, 1.5] };
function solve({ r, delta, sigmaU, lead, anchors = ANCH, tolScale = 1, useTarget = true }) {
  // target correction: filtered (with lead) minus old
  const lead_i = Math.round(lead / H);
  const filt = gaussArr(psiOld, sigmaU);
  const target = psiOld.map((_, i) => { const j = Math.min(NP, i + lead_i); return useTarget ? filt[j] - psiOld[i] : 0; });
  const lo = new Float64Array(NP + 1).fill(-delta), hi = new Float64Array(NP + 1).fill(delta);
  // x = 0 for p <= start and p >= last anchor
  const A = Object.values(anchors);
  for (let i = 0; i <= NP; i++) { const p = pAt(i); if (p <= A[0][0] + 1e-9) { lo[i] = hi[i] = 0; } if (p >= A[A.length - 1][0] - 1e-9) { lo[i] = hi[i] = 0; } }
  for (const [p, tol] of A) { const i = Math.round((p - P0) / H); const t = tol * tolScale; lo[i] = Math.max(lo[i], -t); hi[i] = Math.min(hi[i], t); }
  const rateOn = i => pAt(i) >= A[0][0] - 1e-9 && pAt(i + 1) <= A[A.length - 1][0] + 1e-9;   // the cap only matters between the first and the last anchor
  const step = i => psiOld[i + 1] - psiOld[i];
  // backward feasible set B_i (x_i such that a continuation exists)
  const bl = new Float64Array(NP + 1), bh = new Float64Array(NP + 1); bl[NP] = lo[NP]; bh[NP] = hi[NP];
  for (let i = NP - 1; i >= 0; i--) { // x_{i+1} - x_i in [-rH - st, rH - st]  => x_i in [x_{i+1} - rH + st, x_{i+1} + rH + st]
    const st = step(i), rr = rateOn(i) ? r : 1e9; bl[i] = Math.max(lo[i], bl[i + 1] - rr * H + st); bh[i] = Math.min(hi[i], bh[i + 1] + rr * H + st); if (bl[i] > bh[i] + 1e-9) return { ok: false, at: pAt(i) }; }
  const x = new Float64Array(NP + 1); x[0] = Math.max(bl[0], Math.min(bh[0], target[0]));
  for (let i = 0; i < NP; i++) { const st = step(i), rr = rateOn(i) ? r : 1e9; let l = Math.max(bl[i + 1], x[i] - rr * H - st), h = Math.min(bh[i + 1], x[i] + rr * H - st); if (l > h) { l = h = (l + h) / 2; } x[i + 1] = Math.max(l, Math.min(h, target[i + 1])); }
  return { ok: true, x: Array.from(x), target };
}
function evaluate(res, frames, smoothU = 0) {
  let x = res.x; if (smoothU > 0) x = gaussArr(x, smoothU);
  const interp = (arr, p) => { const f = (p - P0) / H, i = Math.max(0, Math.min(NP - 1, Math.floor(f))), t = f - i; return arr[i] * (1 - t) + arr[i + 1] * t; };
  const phi = Math.atan(.5 / 29), cp = Math.cos(phi), sp = Math.sin(phi);
  const out = []; let prev = null;
  for (const f of frames) { const t = f[0], p = f[1]; const h = (interp(psiOld, p) + interp(x, p)) / D; const dir = [Math.sin(h) * cp, sp, -Math.cos(h) * cp];
    if (prev) { const dt = (t - prev.t) / 1000; if (dt > 0) { const dot = Math.max(-1, Math.min(1, prev.dir[0] * dir[0] + prev.dir[1] * dir[1] + prev.dir[2] * dir[2])); out.push({ p, ang: Math.acos(Math.min(1, dot)) * D / dt, x: interp(x, p) }); } }
    prev = { t, dir }; }
  return out;
}
const BENDS = { A: [5.55, 5.95], B: [7.2, 7.62], C: [8.5, 8.9] };
function summarize(rows) { const g = (a, b) => rows.filter(r => r.p >= a && r.p <= b), mx = r => Math.max(0, ...r.map(x => x.ang)), mn = r => r.length ? r.reduce((s, x) => s + x.ang, 0) / r.length : 0; const all = g(4.8, 10.2); const o = { peak: +mx(all).toFixed(0), xMax: +Math.max(...all.map(r => Math.abs(r.x))).toFixed(1) }; for (const [k, [a, b]] of Object.entries(BENDS)) { const r = g(a, b); o['m' + k] = +mn(r).toFixed(0); o['x' + k] = +mx(r).toFixed(0); } return o; }
module.exports = { solve, evaluate, summarize, psiOld, pAt, NP, H, P0, gaussArr, ANCH };
if (require.main === module) {
  const log = JSON.parse(fs.readFileSync('.qa/index1-5/camera/before-a-log.json', 'utf8'));
  const frames = log.frames.filter(f => f[11] === 0 && f[1] >= 4.7 && f[1] <= 10.4);
  console.log('old', JSON.stringify(summarize(evaluate({ x: psiOld.map(() => 0) }, frames))));
  for (const r of [50, 60, 70, 80]) for (const delta of [20, 30, 45]) for (const [sigmaU, lead] of [[.25, .2], [.35, .3]]) {
    const res = solve({ r, delta, sigmaU, lead });
    if (!res.ok) { console.log(`r${r} δ${delta} σ${sigmaU} lead${lead}`.padEnd(30), 'infeasible at', res.at); continue; }
    console.log(`r${r} δ${delta} σ${sigmaU} lead${lead}`.padEnd(30), JSON.stringify(summarize(evaluate(res, frames, .04))));
  }
}
