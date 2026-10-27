// index1-4-ascent · L1 light flow (2026-10-23). Client: 光流也是（照 index1-1）; 匯流到卡牌要完美流暢，光線不要突然斷掉卡住.
// · the first-person lines run from the start of the canyon flight (the route now starts at the LOGO dissolve)
// · the river light, after the confluence, runs down the trunk, across the bay and on out to sea until the haze takes
//   it — there is no visible end for the eye to stop on, and it keeps flowing through the bridge into the cards
// · the rivers come up as the camera rises (index1-1: lit rivers converging ahead), and stay lit
const fs = require('node:fs'), path = require('node:path');
const file = path.join(__dirname, 'js', 'highland-lights.js');
let src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
for (const [label, find, repl] of [
  ['sea',
`    ? [[-30, -500], [-20, -280], [0, 0], [30, 300], [70, 600]]`,
`    ? [[-30, -500], [-20, -280], [0, 0], [30, 300], [70, 600], [110, 1050], [150, 1700], [190, 2600], [230, 3800], [260, 5200]]   // on out to sea: the haze ends it, not a cut`],
  ['fp',
`      const fp = sm(2.7, 3.5, q) * (1 - sm(6.95, 7.65, q));`,
`      const fp = sm(1.55, 2.3, q) * (1 - sm(6.95, 7.65, q));`],
  ['reveal',
`        const reveal = confluence ? sm(6.8 + F.stagger * .15, 8.65 + F.stagger * .15, q)`,
`        const reveal = confluence ? sm(6.75 + F.stagger * .12, 8.3 + F.stagger * .12, q)`]
]) {
  const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
  if (src.split(f).length - 1 !== 1) throw new Error(`[${label}] anchor`);
  src = src.replace(f, () => r);
}
fs.writeFileSync(file, src);
console.log('patched highland-lights.js 3');
