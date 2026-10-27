// sim3: racing-line position (corridor) + heading filter (decoupled view yaw) + optional pace remap; evaluated on the real wheel trajectory.
const fs = require('node:fs');
const d = require('./design-lib.cjs');
const K2 = require('./sim2.cjs');
const { D, L, C, Wd, tangent, sOf } = d;
const { M, dsM } = K2;
const STOPS = [4.8, 7.694, 9.794];
const smoother = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * u * (u * (u * 6 - 15) + 10); };
// unwrapped tangent heading on the coarse grid
const psiT = new Float64Array(M + 1); { let prev = 0; for (let i = 0; i <= M; i++) { const t = tangent(i * dsM); let h = Math.atan2(t[0], -t[1]); if (i) { while (h - prev > Math.PI) h -= 2 * Math.PI; while (h - prev < -Math.PI) h += 2 * Math.PI; } psiT[i] = h; prev = h; } }
function build(P) {
  const o = P.sigmaP > 0 && P.fracP > 0 ? K2.corridor(P.sigmaP, P.fracP, P.iters || 40, P.finalSigma ?? 40, P.fracP) : new Float64Array(M + 1);
  const psiF = P.sigmaH > 0 ? K2.gauss(psiT, K2.kernel(P.sigmaH)) : psiT;
  return { o, psiF };
}
function weights(P, p) { // [Wp (position), Wh (heading)]
  const f = (ramp) => { let w = smoother(STOPS[0], STOPS[0] + ramp, p) * smoother(0, ramp, Math.abs(p - STOPS[1])) * (1 - smoother(STOPS[2] - ramp, STOPS[2], p)); if (p > STOPS[2]) w = 0; return w; };
  return [f(P.rampP), f(P.rampH)];
}
function camAt(P, B, p) {
  const s = sOf(p), [Wp, Wh] = weights(P, p), c = C(s), tg = tangent(s), nx = -tg[1], nz = tg[0];
  const off = Wp * P.racing * K2.lerpArr(B.o, s), pos = [c[0] + nx * off, c[1] + nz * off];
  // old-style chord heading from the racing position to the centreline point `lookAhead` ahead (offset likewise)
  const sl = Math.min(L, s + P.lookAhead), c2 = C(sl), t2 = tangent(sl), o2 = Wp * P.racing * K2.lerpArr(B.o, sl);
  const look = [c2[0] + (-t2[1]) * o2, c2[1] + t2[0] * o2];
  let dx = look[0] - pos[0], dz = look[1] - pos[1];
  const h0 = Math.atan2(dx, -dz);
  const hf = K2.lerpArr(B.psiF, Math.min(L, s + (P.lead || 0)));
  let dh = hf - h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
  const h = h0 + Wh * P.racingH * dh;
  const phi = Math.atan(.5 / 29), cp = Math.cos(phi), dir = [Math.sin(h) * cp, Math.sin(phi), -Math.cos(h) * cp]; // pitch ~1deg like the old (look.y 2.9 vs cam 2.4 over 29)
  return { pos, dir, Wp, Wh, off, h, tangentH: Math.atan2(tg[0], -tg[1]) };
}
function run(P, frames) {
  const B = build(P), out = []; let prev = null;
  for (const f of frames) {
    const t = f[0], p = f[1], c = camAt(P, B, p);
    if (prev) { const dt = (t - prev.t) / 1000; if (dt > 0) { const dot = Math.max(-1, Math.min(1, prev.c.dir[0] * c.dir[0] + prev.c.dir[1] * c.dir[1] + prev.c.dir[2] * c.dir[2])); let delta = (c.h - c.tangentH) * D; while (delta > 180) delta -= 360; while (delta < -180) delta += 360; out.push({ p, ang: Math.acos(Math.min(1, dot)) * D / dt, off: c.off / Wd(sOf(p)), delta, Wp: c.Wp, Wh: c.Wh }); } }
    prev = { t, c };
  }
  return out;
}
const BENDS = { A: [5.55, 5.95], B: [7.2, 7.62], C: [8.5, 8.9] };
function summarize(rows) {
  const g = (a, b) => rows.filter(r => r.p >= a && r.p <= b), mx = r => Math.max(0, ...r.map(x => x.ang)), mn = r => r.length ? r.reduce((s, x) => s + x.ang, 0) / r.length : 0;
  const all = g(4.8, 10.2), o = { peak: +mx(all).toFixed(0), ofs: +Math.max(...g(4.8, 9.3).map(x => Math.abs(x.off))).toFixed(2), dMax: +Math.max(...g(4.8, 9.8).map(x => Math.abs(x.delta))).toFixed(0) };
  for (const [k, [a, b]] of Object.entries(BENDS)) { const r = g(a, b); o['m' + k] = +mn(r).toFixed(0); o['x' + k] = +mx(r).toFixed(0); }
  return o;
}
module.exports = { run, summarize, build, camAt };
if (require.main === module) {
  const log = JSON.parse(fs.readFileSync('.qa/index1-5/camera/before-a-log.json', 'utf8'));
  const frames = log.frames.filter(f => f[11] === 0 && f[1] >= 4.7 && f[1] <= 10.4);
  const base = { sigmaP: 0, fracP: .45, racing: 0, racingH: 0, sigmaH: 0, lead: 0, rampP: .15, rampH: .15, lookAhead: 29 };
  console.log('old'.padEnd(34), JSON.stringify(summarize(run(base, frames))));
  for (const [sigmaH, lead, ramp] of [[60, 0, .3], [90, 0, .3], [90, 50, .3], [120, 60, .3], [120, 60, .5], [150, 80, .3], [150, 80, .5]])
    for (const sigmaP of [0, 50]) {
      const P = { ...base, sigmaP, racing: sigmaP ? .7 : 0, racingH: 1, sigmaH, lead, rampP: ramp, rampH: ramp };
      console.log(`σH${sigmaH} lead${lead} ramp${ramp} pos${sigmaP ? 'on' : 'off'}`.padEnd(34), JSON.stringify(summarize(run(P, frames))));
    }
}
