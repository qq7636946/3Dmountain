'use strict';
/* ours-flow-boundaries.cjs — reads a flow.cjs run (.qa/index1-5/<dir>/flow.json) and reports, at every section hand-over
   (journey → bridge → cards → world, and back), how the motion of the visible clock behaves:
     idle   = ms during which wheel input kept coming but neither section's clock moved (dead stretch around the boundary)
     before/after = clock speed (units/s) in the 250 ms before / after the first frame of the new section, and the same in
                    "wheel notches per second" so different sections can be compared (journey 0.1307 u/notch · bridge 1/8 per notch ·
                    cards strip = target, steps with the wheel · world 100 px/notch)
   Usage: node scripts/index1-5/probes/smooth/ours-flow-boundaries.cjs [--dir flow-base]  (default .qa/index1-5/flow-base/flow.json) */
const fs = require('node:fs'), path = require('node:path');
const L = require('../../lib.cjs');
const dir = (process.argv.indexOf('--dir') > 0 ? process.argv[process.argv.indexOf('--dir') + 1] : 'flow-base');
const j = JSON.parse(fs.readFileSync(path.join(L.QA_DIR, dir, 'flow.json'), 'utf8'));
const NOTCH = { journey: 0.1307, bridge: 1 / 8, cards: 1, world: 100 };
for (const k of ['down', 'up']) {
  const fr = j.frames[k]; if (!fr || !fr.length) continue;
  console.log('==', k, 'frames', fr.length);
  for (let i = 1; i < fr.length; i++) {
    if (fr[i][2] === fr[i - 1][2]) continue;
    const t = fr[i][0], a = fr[i - 1][2], b = fr[i][2];
    const win = (lo, hi, sec) => fr.filter(f => f[0] >= t + lo && f[0] < t + hi && f[2] === sec);
    const speed = rows => rows.length > 1 ? (rows[rows.length - 1][3] - rows[0][3]) / ((rows[rows.length - 1][0] - rows[0][0]) / 1000) : null;
    const sa = speed(win(-250, 0, a)), sb = speed(win(0, 250, b));
    // idle: walk outward from the boundary while the clock of the active section does not move but input is present
    let idle = 0, lastMove = t; for (let q = i; q > Math.max(0, i - 120); q--) { if (fr[q][2] === a && Math.abs(fr[q][3] - fr[q - 1][3]) > 1e-4) { lastMove = fr[q][0]; break; } }
    let firstMove = t; for (let q = i + 1; q < Math.min(fr.length, i + 200); q++) { if (fr[q][2] === b && Math.abs(fr[q][3] - fr[q - 1][3]) > 1e-4) { firstMove = fr[q][0]; break; } }
    idle = firstMove - lastMove;
    const f = (v, sec) => v == null ? '-' : `${v.toFixed(3)} u/s (${(v / NOTCH[sec] / 8.33).toFixed(2)} notch/s)`;
    console.log(`${a} → ${b} at t=${t}  clock ${fr[i - 1][3]} → ${fr[i][3]}  last motion ${(lastMove - t)} ms · first motion ${(firstMove - t)} ms · gap ${idle} ms · speed before ${f(sa, a)} · after ${f(sb, b)}`);
  }
}
