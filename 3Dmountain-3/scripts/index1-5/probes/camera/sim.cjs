// Offline simulation of the canyon camera on the REAL wheel trajectory p(t) of a baseline run.
// node sim.cjs [log.json]  -> prints old (racing 0) and candidate summaries (same metrics as analyze.cjs: 3-D angular speed per frame).
const fs = require('node:fs');
const d = require('./design-lib.cjs');
const { D, L, N, ds, C, Wd, tangent, sOf } = d;

function gaussSmooth(sigma) { // smoothed centreline (x,z) arrays at N+1 samples, truncated renormalised kernel
  const K = Math.ceil(3 * sigma / ds), w = []; let sum = 0; for (let k = -K; k <= K; k++) { const v = Math.exp(-.5 * (k * ds / sigma) ** 2); w.push(v); }
  const ox = new Float64Array(N + 1), oz = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) { let sx = 0, sz = 0, sw = 0; for (let k = -K; k <= K; k++) { const j = i + k; if (j < 0 || j > N) continue; const q = w[k + K]; const c = d.C(j * ds); sx += q * c[0]; sz += q * c[1]; sw += q; } ox[i] = sx / sw; oz[i] = sz / sw; }
  return { x: ox, z: oz };
}
const smoothstep = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const smoother = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * u * (u * (u * 6 - 15) + 10); };
// route stops (page p) -> arc length
const STOPS = [4.8, 7.694, 9.794];

function makeModel(P) {
  const sm = P.sigma > 0 ? gaussSmooth(P.sigma) : null;
  const off = new Float64Array(N + 1); // signed normal offset of the smoothed line (clamped)
  if (sm) for (let i = 0; i <= N; i++) { const s = i * ds, c = C(s), tg = tangent(s), nx = -tg[1], nz = tg[0]; const dn = (sm.x[i] - c[0]) * nx + (sm.z[i] - c[1]) * nz; const lim = P.clamp * Wd(s); off[i] = lim * Math.tanh(dn / lim); }
  const smL = P.sigmaL > 0 ? gaussSmooth(P.sigmaL) : null, offL = new Float64Array(N + 1);
  if (smL) for (let i = 0; i <= N; i++) { const s = i * ds, c = C(s), tg = tangent(s), nx = -tg[1], nz = tg[0]; const dn = (smL.x[i] - c[0]) * nx + (smL.z[i] - c[1]) * nz; const lim = (P.clampL || 9) * Wd(s); offL[i] = lim * Math.tanh(dn / lim); }
  const offLAt = s => { const x = Math.max(0, Math.min(N, s / ds)), i = Math.min(N - 1, Math.floor(x)), f = x - i; return offL[i] * (1 - f) + offL[i + 1] * f; };
  const offAt = s => { const x = Math.max(0, Math.min(N, s / ds)), i = Math.min(N - 1, Math.floor(x)), f = x - i; return off[i] * (1 - f) + off[i + 1] * f; };
  // blend weight by page p
  const ramp = P.ramp; // p-units
  const Wfun = p => {
    let w = P.racing;
    w *= smoother(STOPS[0], STOPS[0] + ramp, p);            // start: one-sided
    w *= smoother(0, ramp, Math.abs(p - STOPS[1]));          // middle stop: two-sided
    w *= 1 - smoother(STOPS[2] - ramp, STOPS[2], p) * 1;     // last stop: ramp to 0 on the way in …
    if (p > STOPS[2]) w = 0;                                  // … and nothing after it (the rise)
    return w;
  };
  return { offAt, offLAt: smL ? offLAt : offAt, Wfun };
}
function cam(model, P, p) {
  const s = sOf(p), W = model.Wfun(p);
  const camPt = () => { const c = C(s), tg = tangent(s), nx = -tg[1], nz = tg[0], o = W * model.offAt(s); return [c[0] + nx * o, c[1] + nz * o]; };
  const a = P.lookAhead0 + (P.lookAhead1 - P.lookAhead0) * W / Math.max(1e-6, P.racing || 1);
  const sl = Math.min(d.L, s + a);
  const c2 = C(sl), t2 = tangent(sl), o2 = W * model.offLAt(sl) * (P.lookGain ?? 1);
  const look = [c2[0] + (-t2[1]) * o2, c2[1] + t2[0] * o2];
  const pos = camPt();
  const dx = look[0] - pos[0], dz = look[1] - pos[1], dy = .5;
  const h = Math.hypot(dx, dz, dy);
  return { pos, dir: [dx / h, dy / h, dz / h], W, off: W * model.offAt(s), width: Wd(s) };
}
function run(P, frames) {
  const model = makeModel(P), out = []; let prev = null;
  for (const f of frames) {
    const t = f[0], p = f[1]; const c = cam(model, P, p);
    if (prev) { const dt = (t - prev.t) / 1000; if (dt > 0) { const dot = Math.max(-1, Math.min(1, prev.c.dir[0] * c.dir[0] + prev.c.dir[1] * c.dir[1] + prev.c.dir[2] * c.dir[2])); out.push({ p, ang: Math.acos(dot) * D / dt, off: c.off / c.width, W: c.W }); }}
    prev = { t, c };
  }
  return out;
}
const BENDS = { A: [5.55, 5.95], B: [7.2, 7.62], C: [8.5, 8.9] };
function summarize(rows) {
  const g = (a, b) => rows.filter(r => r.p >= a && r.p <= b), mx = r => Math.max(0, ...r.map(x => x.ang)), mn = r => r.length ? r.reduce((s, x) => s + x.ang, 0) / r.length : 0;
  const all = g(4.8, 10.2), o = { peak: +mx(all).toFixed(1), ofsMax: +Math.max(...g(4.8, 9.3).map(x => Math.abs(x.off))).toFixed(3) };
  for (const [k, [a, b]] of Object.entries(BENDS)) { const r = g(a, b); o['mean' + k] = +mn(r).toFixed(1); o['max' + k] = +mx(r).toFixed(1); }
  return o;
}
module.exports = { run, summarize, makeModel, cam, STOPS };
if (require.main === module) {
  const log = JSON.parse(fs.readFileSync(process.argv[2] || '.qa/index1-5/camera/before-a-log.json', 'utf8'));
  const frames = log.frames.filter(f => f[11] === 0 && f[1] >= 4.7 && f[1] <= 10.4);
  const base = { sigma: 0, clamp: .45, racing: 0, ramp: .15, lookAhead0: 29, lookAhead1: 29 };
  console.log('old    ', JSON.stringify(summarize(run(base, frames))));
  for (const sigma of [60, 90, 120, 160]) for (const ramp of [.15, .35]) for (const la of [29, 60]) {
    const P = { ...base, sigma, racing: .7, ramp, lookAhead1: la };
    console.log(`σ${sigma} ramp${ramp} la${la}`.padEnd(18), JSON.stringify(summarize(run(P, frames))));
  }
}
