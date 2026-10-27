// forward vs backward pass of a wheellog (--reverse 1): camera heading / position / roll at the same journey p
const fs = require('node:fs'); const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), F = j.frames, D = 180 / Math.PI;
const fw = F.filter(f => f[11] === 0), bw = F.filter(f => f[11] === 1);
const near = (arr, p) => { let b = null, bd = 1e9; for (const f of arr) { const d = Math.abs(f[1] - p); if (d < bd) { bd = d; b = f; } } return bd < .01 ? b : null; };
let maxYaw = 0, maxPos = 0, maxRoll = 0, maxY = 0, n = 0, at = 0;
for (let p = 4.9; p <= 9.3; p += .02) { const a = near(fw, p), b = near(bw, p); if (!a || !b) continue; n++;
  const ha = Math.atan2(a[5], -a[7]) * D, hb = Math.atan2(b[5], -b[7]) * D; let dh = Math.abs(ha - hb); if (dh > 180) dh = 360 - dh;
  const dp = Math.hypot(a[2] - b[2], a[4] - b[4]), dr = Math.abs(Math.asin(a[9]) - Math.asin(b[9])) * D, dy = Math.abs(a[3] - b[3]);
  if (dh > maxYaw) { maxYaw = dh; at = p; } maxPos = Math.max(maxPos, dp); maxRoll = Math.max(maxRoll, dr); maxY = Math.max(maxY, dy); }
console.log(JSON.stringify({ samples: n, maxHeadingDiffDeg: +maxYaw.toFixed(2), at: +at.toFixed(2), maxPosDiff: +maxPos.toFixed(2), maxRollDiffDeg: +maxRoll.toFixed(2), maxYdiff: +maxY.toFixed(3) }));
