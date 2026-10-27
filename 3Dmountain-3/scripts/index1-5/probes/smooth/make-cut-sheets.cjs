'use strict';
/* make-cut-sheets.cjs — picks the screenshots nearest to fixed offsets around the first camera cut of a live run written by
   hubtown-sheets.cjs and builds a labelled contact sheet with sheet.cjs.
   Usage: node scripts/index1-5/probes/smooth/make-cut-sheets.cjs <qa dir name> <y0> <out.jpg> "title" */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const L = require('../../lib.cjs');
const [dir, y0, out, title] = process.argv.slice(2);
const base = path.join(L.QA_DIR, 'smooth', dir), d = JSON.parse(fs.readFileSync(path.join(base, `live-${y0}.json`), 'utf8'));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), fr = d.frames;
let tc = null; for (let i = 1; i < fr.length; i++) if (fr[i][2] && fr[i - 1][2] && dist(fr[i][2], fr[i - 1][2]) > 15) { tc = fr[i][0]; break; }
const want = [-400, -200, 0, 120, 250, 400, 600, 800, 1000, 1300, 1700, 2200], args = [];
for (const w of want) { let best = null; for (const s of d.shots) { const dt = Math.abs(s.t - tc - w); if (!best || dt < best.dt) best = { dt, s }; } const s = best.s; args.push(`${s.t - tc >= 0 ? '+' : ''}${Math.round(s.t - tc)} ms · y ${s.st}|${path.join(base, s.file)}`); }
const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'sheet.cjs'), out, '4', title, ...args], { encoding: 'utf8' });
console.log((r.stdout || '').trim().split('\n').pop(), (r.stderr || '').trim().split('\n').pop());
