// Analyse a wheellog -log.json. node analyze.cjs a-log.json [b-log.json ...] [--json out.json]
// per frame: 3-D camera-direction speed (deg/s, what the audit measured), horizontal yaw rate, roll (deg), camera y, lateral offset / river half-width.
const fs = require('node:fs');
const args = process.argv.slice(2); const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
const BENDS = { A: [5.55, 5.95], B: [7.2, 7.62], C: [8.5, 8.9] }, RANGE = [4.8, 10.2];
const D = 180 / Math.PI;
function series(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8')), F = j.frames, off = j.off, out = [];
  for (let i = 1; i < F.length; i++) {
    const a = F[i - 1], c = F[i], dt = (c[0] - a[0]) / 1000; if (dt <= 0) continue;
    const dot = Math.max(-1, Math.min(1, a[5] * c[5] + a[6] * c[6] + a[7] * c[7]));
    const ang = Math.acos(dot) * D / dt;
    let dyaw = Math.atan2(c[5], -c[7]) - Math.atan2(a[5], -a[7]); if (dyaw > Math.PI) dyaw -= 2 * Math.PI; if (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    const sp = Math.hypot(c[2] - a[2], c[3] - a[3], c[4] - a[4]) / dt;
    out.push({ t: c[0], p: c[1], dpdt: (c[1] - a[1]) / dt, ang, yaw: Math.abs(dyaw) * D / dt, yawS: dyaw * D / dt, sp, y: c[3], roll: Math.asin(Math.max(-1, Math.min(1, c[9]))) * D, fov: c[8], ofs: off[i][1] / off[i][2], phase: c[11], pitch: Math.asin(c[6]) * D, shX: c[12] ?? 0, shZ: c[14] ?? 0, shMag: c[15] ?? 0, latPx: Math.abs(c[12] ?? 0) * 450 / (20 * Math.tan(c[8] * Math.PI / 360)) });
  }
  return { meta: j.meta, rows: out };
}
const pct = (arr, q) => { const s = arr.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function stat(rows, [p0, p1], key = 'ang') { const r = rows.filter(x => x.p >= p0 && x.p <= p1 && x.phase === 0); return { n: r.length, max: +Math.max(0, ...r.map(x => x[key])).toFixed(1), mean: +mean(r.map(x => x[key])).toFixed(1), p95: +pct(r.map(x => x[key]), .95).toFixed(1) }; }
// 100 ms moving-average of a rate (the eye does not see a 16 ms spike): max of the smoothed series
function smoothMax(rows, [p0, p1], key = 'ang', win = 100) { const r = rows.filter(x => x.p >= p0 && x.p <= p1 && x.phase === 0); let best = 0; for (let i = 0; i < r.length; i++) { let k = i, sum = 0, n = 0; while (k < r.length && r[k].t - r[i].t < win) { sum += r[k][key]; n++; k++; } if (n) best = Math.max(best, sum / n); } return +best.toFixed(1); }
const result = {};
for (const f of files) {
  const { meta, rows } = series(f);
  const down = rows.filter(r => r.phase === 0 && r.p >= RANGE[0] && r.p <= RANGE[1]), fp = down.filter(r => r.p <= 9.29);
  const o = {
    file: f, frames: rows.length, from: meta.from, racing: meta.probe.racing,
    all: { ang: stat(rows, RANGE, 'ang'), yaw: stat(rows, RANGE, 'yaw'), ang100: smoothMax(rows, RANGE, 'ang'), yaw100: smoothMax(rows, RANGE, 'yaw') },
    bends: Object.fromEntries(Object.entries(BENDS).map(([k, w]) => [k, { ang: stat(rows, w, 'ang'), yaw: stat(rows, w, 'yaw') }])),
    roll: { min: +Math.min(...fp.map(r => r.roll)).toFixed(2), max: +Math.max(...fp.map(r => r.roll)).toFixed(2) },
    y: { min: +Math.min(...fp.map(r => r.y)).toFixed(2), max: +Math.max(...fp.map(r => r.y)).toFixed(2) },
    blur: Object.fromEntries(Object.entries(BENDS).map(([k, w]) => { const r = rows.filter(x => x.p >= w[0] && x.p <= w[1] && x.phase === 0); return [k, { latPx20max: +Math.max(0, ...r.map(x => x.latPx)).toFixed(1), latPx20mean: +mean(r.map(x => x.latPx)).toFixed(1), shiftMax: +Math.max(0, ...r.map(x => x.shMag)).toFixed(2) }]; }).concat([['straight6.4-6.6', (() => { const r = rows.filter(x => x.p >= 6.4 && x.p <= 6.6 && x.phase === 0); return { latPx20max: +Math.max(0, ...r.map(x => x.latPx)).toFixed(1), shiftMax: +Math.max(0, ...r.map(x => x.shMag)).toFixed(2), shiftMean: +mean(r.map(x => x.shMag)).toFixed(2) }; })()]])),
    ofs: { absMax: +Math.max(...fp.map(r => Math.abs(r.ofs))).toFixed(3) },
    camSpeed: { p50: +pct(down.map(r => r.sp), .5).toFixed(0), max: +pct(down.map(r => r.sp), 1).toFixed(0) },
    dpdt: { p50: +pct(down.map(r => r.dpdt), .5).toFixed(3), max: +pct(down.map(r => r.dpdt), 1).toFixed(3) },
    pSpan: [+down[0].p.toFixed(3), +down[down.length - 1].p.toFixed(3)]
  };
  result[f] = { summary: o, rows: rows.map(r => [Math.round(r.t), +r.p.toFixed(4), +r.ang.toFixed(2), +r.yaw.toFixed(2), +r.roll.toFixed(3), +r.y.toFixed(3), +r.ofs.toFixed(4), +r.sp.toFixed(1), r.phase, +r.dpdt.toFixed(4), +r.pitch.toFixed(3), +r.latPx.toFixed(1), +r.shMag.toFixed(3)]) };
  console.log(JSON.stringify(o));
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(result));
