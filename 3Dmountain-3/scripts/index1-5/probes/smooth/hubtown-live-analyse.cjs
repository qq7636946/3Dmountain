'use strict';
/* hubtown-live-analyse.cjs — reads .qa/index1-5/smooth/<dir>/live-<y0>.json written by hubtown-sheets.cjs and prints, per run:
   the camera cut time + scrollTop, which float uniforms animate around it (start/end/ease), and which text elements change
   (first/last change relative to the cut, opacity range, translate range).  Usage: node …/hubtown-live-analyse.cjs <dir> <y0> */
const fs = require('node:fs'), path = require('node:path');
const L = require('../../lib.cjs');
const [dir, y0] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(path.join(L.QA_DIR, 'smooth', dir, `live-${y0}.json`), 'utf8'));
const fr = d.frames; const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const cuts = []; for (let i = 1; i < fr.length; i++) if (fr[i][2] && fr[i - 1][2] && dist(fr[i][2], fr[i - 1][2]) > 15) cuts.push({ t: fr[i][0], st: Math.round(fr[i][1]), d: +dist(fr[i][2], fr[i - 1][2]).toFixed(1) });
const w0 = d.w[0] ? d.w[0][0] : fr[0][0];
console.log('run', y0, 'wheel0', w0.toFixed(0), 'frames', fr.length, 'shots', d.shots.length, 'cuts', JSON.stringify(cuts.map(c => ({ t: +(c.t - w0).toFixed(0), st: c.st, d: c.d }))));
const tc = cuts.length ? cuts[0].t : null;
// uniforms: for each name, time range of change near the cut
const names = {}; for (const [t, dl] of d.ulog) for (const k in dl) (names[k] = names[k] || []).push([t, dl[k]]);
const near = [];
for (const [k, v] of Object.entries(names)) {
  if (k === 'uTime' || v.length < 3) continue;
  const seg = tc ? v.filter(x => x[0] > tc - 800 && x[0] < tc + 3000) : v;
  if (seg.length < 3) continue;
  const vals = seg.map(x => x[1]); const lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 0.05) continue;
  near.push(`${k}: ${seg.length} changes, t ${(seg[0][0] - tc).toFixed(0)}..${(seg[seg.length - 1][0] - tc).toFixed(0)} ms, ${lo.toFixed(2)}..${hi.toFixed(2)}`);
}
console.log(near.join('\n'));
// text elements
const labels = d.labels, snap = d.snap; const res = [];
for (let i = 0; i < labels.length; i++) {
  const rows = snap.map(s => [s[0], s[1][i]]); const op = rows.map(r => r[1][1]), tr = rows.map(r => r[1][2]);
  const lo = Math.min(...op), hi = Math.max(...op);
  const ty = rows.map(r => { const m = r[1][2].split(',').map(Number); return m.length === 6 ? m[5] : 0; });
  const tyr = [Math.min(...ty), Math.max(...ty)];
  if (hi - lo < 0.05 && tyr[1] - tyr[0] < 2) continue;
  // first and last time opacity or ty differ from the first row
  let a = -1, b = -1; for (let k = 1; k < rows.length; k++) if (Math.abs(op[k] - op[k - 1]) > 0.004 || Math.abs(ty[k] - ty[k - 1]) > 0.3) { if (a < 0) a = k; b = k; }
  res.push({ lbl: labels[i], a: a >= 0 ? rows[a][0] - tc : null, b: b >= 0 ? rows[b][0] - tc : null, op: [lo, hi], ty: tyr.map(v => +v.toFixed(1)) });
}
res.sort((x, y) => (x.a ?? 1e9) - (y.a ?? 1e9));
console.log('text elements that animate (t relative to cut, ms):');
for (const r of res.slice(0, 40)) console.log(`  ${String(r.a == null ? '-' : r.a.toFixed(0)).padStart(6)} → ${String(r.b == null ? '-' : r.b.toFixed(0)).padStart(6)}  op ${r.op[0].toFixed(2)}..${r.op[1].toFixed(2)}  ty ${r.ty.join('..')}  ${r.lbl}`);
// shots: time → scrollTop
console.log('shots', d.shots.filter((_, i) => i % 8 === 0).map(s => `${s.file.replace('live-', '').replace('.jpg', '')}@${(s.t - w0).toFixed(0)}ms st${s.st}`).join('  '));
