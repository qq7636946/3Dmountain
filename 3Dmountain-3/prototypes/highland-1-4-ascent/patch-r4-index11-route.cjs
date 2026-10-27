// index1-4-ascent · R4 (2026-10-23). Client: 山的路徑 index1-1.html 照這個 光流也是 — the route follows index1-1:
// first person on the water through the canyon for IDEAS / CONVERGENCE / VALUE, then A WIDER PERSPECTIVE rises
// FORWARD and looks ahead and down at the rivers meeting (A and C from the lower corners, B below, D from the right,
// the trunk on to the bay and the sea at the top). No high reveal before the flight, no turn-back after it.
// Replaces R1–R3's pre/post keys and anchors. Run: node patch-r4-index11-route.cjs
const fs = require('node:fs'), path = require('node:path');
const file = path.join(__dirname, 'js', 'highland-scene.js');
let src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
const cut = (from, to) => {   // replace the text between two unique markers (markers kept)
  const a = src.indexOf(from), b = src.indexOf(to, a + from.length);
  if (a < 0 || b < 0 || src.indexOf(from, a + 1) >= 0) throw new Error('marker ' + from.slice(0, 40));
  return [a + from.length, b];
};
{
  const [a, b] = cut('  // ---- the flight (R1 downstream)', '  const pose = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, fov: 58 };');
  src = src.slice(0, a) + `: like index1-1 — first person on the water, with the current, through the canyon on
  // path B; then the rise, forward, to look ahead and down at the rivers meeting and running on to the bay and the sea.
  const trunk = meta.rivers.TRUNK.filter(p => p[1] < -620).slice().reverse();     // junction → bay
  const pathB = meta.rivers.B.filter(p => p[1] < -1700 && p[1] > -3570).slice().reverse();   // upper canyon → junction
  const tail = [[-30, -430], [-10, -60], [30, 380], [70, 820], [100, 1250]];        // the open bay, then out to sea
  const ground2 = pathB.concat(trunk, tail);
  const heightAlong = z => z < -1950 ? 17 : z < -1100 ? THREE.MathUtils.lerp(17, 70, THREE.MathUtils.smoothstep(z, -1950, -1450))
    : THREE.MathUtils.lerp(70, 120, THREE.MathUtils.smoothstep(z, -1100, -400));
  const curve = new THREE.CatmullRomCurve3(ground2.map(([x, z]) => new THREE.Vector3(x, heightAlong(z), z)), false, 'centripetal', .5);
  const pathLength = curve.getLength();
  const arcAtZ = z => {   // arc length where the flight first reaches z (going north)
    const n = 600; for (let i = 0; i <= n; i++) { const p = curve.getPointAt(i / n); if (p.z >= z) return i / n * pathLength; } return pathLength;
  };
  // q → arc length (monotone cubic through the chapter anchors): 1.404 the LOGO dissolves onto the water in the upper
  // canyon · 1.98–3.86 IDEAS · 4.70 CONVERGENCE · 5.88–6.85 VALUE, the canyon narrowing toward the confluence
  const FLY0 = 1.404, FLY1 = 6.85;
  const qs = [FLY0, 1.98, 3.86, 4.70, 5.88, 6.40, FLY1];
  const ss = [arcAtZ(-3530), arcAtZ(-3420), arcAtZ(-3020), arcAtZ(-2820), arcAtZ(-2580), arcAtZ(-2470), arcAtZ(-2380)];
  const flightS = monotone(qs, ss);
  const widthAt = () => 40;
  const PRE = [];
  // A WIDER PERSPECTIVE: up and slightly forward over the canyon's end — the confluence ahead and below, the arms
  // spreading to the lower corners, the trunk, the bay and the sea to the horizon (q, x, y, z, yaw°, pitch°, fov)
  const POST = [
    [7.60, -45, 230, -2360, 180, -16, 58],
    [8.16, -52, 560, -2345, 180, -25, 58],
    [8.96, -60, 900, -2330, 180, -31, 58]
  ];
  const HOLD = POST[POST.length - 1].slice(1);
  const AERIAL = POST.concat([10.15, 11.38, 12.82, 13.8].map(q => [q, ...HOLD]));

` + src.slice(b);
}
for (const [label, find, repl] of [
  ['tracks',
`  const preTrack = trackOf([...PRE, poseKey(FLY0)]);`,
`  const preTrack = null;   // R4: the flight itself starts at the LOGO dissolve`],
  ['aerial',
`  const aerialAt = q => THREE.MathUtils.clamp(1 - THREE.MathUtils.smoothstep(q, 2.2, 3.0) + THREE.MathUtils.smoothstep(q, 6.85, 8.96), 0, 1);`,
`  const aerialAt = q => THREE.MathUtils.smoothstep(q, 6.85, 8.96);`],
  ['apply',
`      const T = q < FLY0 ? preTrack : q > FLY1 ? track : null;`,
`      const T = q > FLY1 ? track : null;`],
  ['low',
`q > 2.6 && q < 7.75;   // detailed land for the low flight only`,
`q < 7.75;   // detailed land for the low flight only`],
  ['walls',
`      const walls = q > 3.1 && q < 6.7 && low;`,
`      const walls = q > 1.5 && q < 6.95 && low;`]
]) {
  const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
  if (src.split(f).length - 1 !== 1) throw new Error(`[${label}] anchor`);
  src = src.replace(f, () => r);
}
fs.writeFileSync(file, src);
console.log('patched highland-scene.js (R4)');
