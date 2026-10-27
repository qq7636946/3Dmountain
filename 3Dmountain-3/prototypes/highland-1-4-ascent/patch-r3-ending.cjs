// index1-4-ascent · R3 ending (2026-10-23): the old end sat past the bay mouth, with both headlands behind the lens,
// so the last frame was empty sea. The bay is now crossed slowly; the last rise happens over the middle of the bay,
// drifting forward, so the frame holds the headlands on both sides, the open bay and the sea to the horizon.
const fs = require('node:fs'), path = require('node:path');
const file = path.join(__dirname, 'js', 'highland-scene.js');
let src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
for (const [label, find, repl] of [
  ['height',
`    : THREE.MathUtils.lerp(70, 170, THREE.MathUtils.smoothstep(z, -1100, 1250));          // then gently up over the bay as the sea opens`,
`    : THREE.MathUtils.lerp(70, 120, THREE.MathUtils.smoothstep(z, -1100, -400));          // then gently up into the bay`],
  ['anchors',
`  const ss = [0, arcAtZ(-2600), arcAtZ(-1980), arcAtZ(-1520), arcAtZ(-1180), arcAtZ(-880), arcAtZ(60)];`,
`  const ss = [0, arcAtZ(-2600), arcAtZ(-1980), arcAtZ(-1520), arcAtZ(-1300), arcAtZ(-1120), arcAtZ(-760)];`],
  ['post',
`    [8.16, 60, 400, 320, 180, -12, 58],
    [8.96, 70, 680, 560, 180, -15, 60]      // high over the bay mouth: the coast both sides, the open sea to the horizon`,
`    [8.16, 40, 420, -640, 180, -15, 58],
    [8.96, 60, 760, -470, 180, -19, 60]     // high over the bay, still drifting forward: both headlands, the bay mouth, the sea to the horizon`]
]) {
  const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
  if (src.split(f).length - 1 !== 1) throw new Error(`[${label}] anchor`);
  src = src.replace(f, () => r);
}
fs.writeFileSync(file, src);
console.log('patched highland-scene.js 3');
