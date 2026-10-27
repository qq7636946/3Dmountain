// node poscmp.cjs a.json b.json  -> per position: distance between camera positions, angle between view directions, roll difference, dy
const fs = require('node:fs'); const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')).out);
const D = 180 / Math.PI; const rows = [];
for (const k of Object.keys(a)) { const A = a[k], B = b[k]; if (!B) continue;
  const dist = Math.hypot(A.pos[0] - B.pos[0], A.pos[1] - B.pos[1], A.pos[2] - B.pos[2]);
  const dot = Math.max(-1, Math.min(1, A.dir[0] * B.dir[0] + A.dir[1] * B.dir[1] + A.dir[2] * B.dir[2]));
  rows.push(`p ${String(k).padEnd(6)} dpos ${dist.toFixed(4).padStart(8)}  dy ${(B.pos[1] - A.pos[1]).toFixed(3).padStart(7)}  ddir ${(Math.acos(dot) * D).toFixed(3).padStart(7)}°  droll ${((Math.asin(B.rightY) - Math.asin(A.rightY)) * D).toFixed(3).padStart(7)}°  dfov ${(B.fov - A.fov).toFixed(4)}  roll ${(Math.asin(A.rightY) * D).toFixed(2)}→${(Math.asin(B.rightY) * D).toFixed(2)}`); }
console.log(rows.join('\n'));
