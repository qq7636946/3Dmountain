// index1-4-ascent · R2 pacing (2026-10-23): the bay begins only ~400 units past the confluence on this map, so R1
// reached open water by VALUE. More of the canyon, CONVERGENCE as the confluence comes into view, a low rise over the
// pool so the five channels read as one meeting, then the bay. Run: node patch-r2-pacing.cjs
const fs = require('node:fs'), path = require('node:path');
const file = path.join(__dirname, 'js', 'highland-scene.js');
let src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
for (const [label, find, repl] of [
  ['height',
`  const heightAlong = z => z < -1950 ? 17 : z < -650 ? 24
    : THREE.MathUtils.lerp(26, 170, THREE.MathUtils.smoothstep(z, -650, 1250));   // rising gently over the bay as the sea opens`,
`  const heightAlong = z => z < -2050 ? 17                                                   // the canyon floor
    : z < -1100 ? THREE.MathUtils.lerp(17, 70, THREE.MathUtils.smoothstep(z, -2050, -1550))   // a low lift over the confluence pool: the five channels meet below
    : THREE.MathUtils.lerp(70, 170, THREE.MathUtils.smoothstep(z, -1100, 1250));          // then gently up over the bay as the sea opens`],
  ['anchors',
`  const ss = [0, arcAtZ(-2720), arcAtZ(-1760), arcAtZ(-1180), arcAtZ(-880), arcAtZ(-640), arcAtZ(240)];`,
`  const ss = [0, arcAtZ(-2600), arcAtZ(-1980), arcAtZ(-1520), arcAtZ(-1180), arcAtZ(-880), arcAtZ(60)];`]
]) {
  const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
  if (src.split(f).length - 1 !== 1) throw new Error(`[${label}] anchor`);
  src = src.replace(f, () => r);
}
fs.writeFileSync(file, src);
console.log('patched highland-scene.js 2');
