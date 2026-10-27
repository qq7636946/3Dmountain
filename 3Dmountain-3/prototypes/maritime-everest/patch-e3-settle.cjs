// EVEREST COLOUR COPY, pass E3 (2026-10-22): settled ASCENT values after look-dev — a thin gold line on the
// banner's horizon instead of a band, a lighter room under the drop (glassier, fewer navy blotches), cool
// sky-blue shade and a pale-gold sun on the mineral rock. Run from the project root.
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, 'js/main.js');
let src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
for (const [label, find, repl] of [
  ['field',
    `        Object.assign(CONFIG.field, { zenith: '#17305f', upper: '#22417e', top: '#081530', horizon: '#3a5a96', lower: '#2c4888', floor: '#152c5e', ink: '#0c1c44', core: .9, coreSpread: .5, bandGain: .05 });`,
    `        Object.assign(CONFIG.field, { zenith: '#17305f', upper: '#22417e', top: '#081530', horizon: '#3a5a96', lower: '#4a6ab0', floor: '#2d4c90', ink: '#162a5c', core: .9, coreSpread: .5, bandGain: .05 });`],
  ['light',
    `          sun: '#ffcf8f', sunDay: 5.0, sunAerial: 5.2, hemiSky: '#5d72a6', hemiGround: '#2e2a26', hemiDay: .55, hemiAerial: .5,
          rim: '#ffd29a', rimDay: .6, rimAerial: .55, ibl: .22, vegAmount: .2,`,
    `          sun: '#ffd9a8', sunDay: 5.0, sunAerial: 5.2, hemiSky: '#6f86c0', hemiGround: '#1e2638', hemiDay: .7, hemiAerial: .6,
          rim: '#ffd29a', rimDay: .7, rimAerial: .55, ibl: .22, vegAmount: .2,`],
  ['line',
    `        Object.assign(CONFIG.horizon, { islands: 0, clouds: .3, cloudColour: .25, cloudTint: '#ffe3b5', glow: .3, glowColour: '#ffb04a',
          glowHeight: -.012, glowWidth: .01, glowSpread: 40, canyonClouds: .45, canyonGlow: .5, sat: .8 });`,
    `        Object.assign(CONFIG.horizon, { islands: 0, clouds: .3, cloudColour: .25, cloudTint: '#ffe3b5', glow: .2, glowColour: '#ffb04a',
          glowHeight: -.03, glowWidth: .006, glowSpread: 40, canyonClouds: .45, canyonGlow: .5, sat: .8 });`]
]) {
  const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
  const n = src.split(f).length - 1;
  if (n !== 1) throw new Error(`[${label}] anchor found ${n} times`);
  src = src.replace(f, () => r);
}
fs.writeFileSync(file, src);
console.log('patched main.js 3');
