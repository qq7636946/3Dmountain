// Colour pass C5 (2026-10-21): the canyon sky as a dusk gradient (deep blue over apricot) with more of
// the cloud plate, and a periwinkle haze so the far ridges read as silhouettes against it. COBALT only.
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../js/main.js');
let src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
for (const [label, find, repl] of [
  ['sky', `          skyZenith: '#2c5cb6', skyHorizon: '#bcd3ef', fog: '#a6bfe0', aerialFog: '#8eaee0',`,
          `          skyZenith: '#1d4cb8', skyHorizon: '#efd2b2', fog: '#8498ca', aerialFog: '#8eaee0',`],
  ['clouds', `        canyonClouds: COBALT ? .55 : 0, canyonCloudLow: .02, canyonCloudHigh: .34, canyonGlow: COBALT ? .5 : 0`,
             `        canyonClouds: COBALT ? .85 : 0, canyonCloudLow: .03, canyonCloudHigh: .42, canyonGlow: COBALT ? .5 : 0`]
]) {
  const f = find.replace(/\r?\n/g, eol), n = src.split(f).length - 1;
  if (n !== 1) throw new Error(`[${label}] anchor found ${n} times`);
  src = src.replace(f, () => repl);
}
fs.writeFileSync(file, src);
console.log('patched main.js 2');
