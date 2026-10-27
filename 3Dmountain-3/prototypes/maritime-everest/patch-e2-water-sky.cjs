// EVEREST COLOUR COPY, pass E2 (2026-10-22): deep-blue water with gold glints instead of the silver-water
// mode under ASCENT (the silver mode turned the opening sea into gold "dunes" and the rivers violet), a
// three-stop dusk sky in the canyon (gold → pale blue → night blue, never through brown), and the settled
// fog, water and film values. Every replacement asserts one unique anchor. Run from the project root.
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, 'js/main.js');
let src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
for (const [label, find, repl] of [
  ['silver',
    `        uMarSilver: { value: HIGHLAND ? 1 : 0 }, uMarEverest: { value: EVEREST ? 1 : 0 },`,
    `        uMarSilver: { value: HIGHLAND && !ASCENT ? 1 : 0 }, uMarEverest: { value: EVEREST ? 1 : 0 },`],
  ['skymid-key',
    `        snow: 0, snowLine: 380, snowSoft: 180, snowSlope: .5, snowColour: '#eef2f8'
      };`,
    `        snow: 0, snowLine: 380, snowSoft: 180, snowSlope: .5, snowColour: '#eef2f8',
        /* The canyon sky's middle stop (ASCENT only): gold horizon → this → zenith. */
        skyMid: '#a9b9cf'
      };`],
  ['ascent-values',
    `          skyZenith: '#14244e', skyHorizon: '#e9b878', fog: '#5f6a8c', aerialFog: '#6b7697',`,
    `          skyZenith: '#1b2f5e', skyHorizon: '#efc488', skyMid: '#a9b9cf', fog: '#6f7690', aerialFog: '#76809c',`],
  ['ascent-water',
    `          rim: '#ffd29a', rimDay: .6, rimAerial: .55, ibl: .22, vegAmount: .35,
          deep: '#03102e', mid: '#0c2a62', bed: '#164a6a', foam: '#e9edf2', reflect: .7, glint: .9, ripple: .14,`,
    `          rim: '#ffd29a', rimDay: .6, rimAerial: .55, ibl: .22, vegAmount: .2,
          deep: '#04153a', mid: '#103a72', bed: '#1d4f6e', foam: '#e9edf2', reflect: .7, glint: .9, ripple: .14,`],
  ['ascent-horizon',
    `        Object.assign(CONFIG.horizon, { islands: 0, clouds: .3, cloudColour: .25, cloudTint: '#ffe3b5', glow: .25, glowColour: '#ffb04a',
          glowHeight: -.008, glowWidth: .007, glowSpread: 40, canyonClouds: .45, canyonGlow: .5, sat: .8 });`,
    `        Object.assign(CONFIG.horizon, { islands: 0, clouds: .3, cloudColour: .25, cloudTint: '#ffe3b5', glow: .3, glowColour: '#ffb04a',
          glowHeight: -.012, glowWidth: .01, glowSpread: 40, canyonClouds: .45, canyonGlow: .5, sat: .8 });`],
  ['ascent-river',
    `        Object.assign(CONFIG.watershedWater, { base: '#163a6a', highlight: '#e8d2a8', reflection: .34 });`,
    `        Object.assign(CONFIG.watershedWater, { base: '#163a6a', highlight: '#cfd6d8', reflection: .34 });`],
  ['ascent-film',
    `        Object.assign(CONFIG.film, { amount: 1, contrast: .22, shadow: '#26375e', shadowAmt: .16, high: '#ffd49a', highAmt: .2, lift: .012, vignette: .34, vignetteSoft: .75 });`,
    `        Object.assign(CONFIG.film, { amount: 1, contrast: .22, shadow: '#2c3550', shadowAmt: .12, high: '#ffd49a', highAmt: .2, lift: .012, vignette: .34, vignetteSoft: .75 });`],
  ['sky-uniforms',
    `        uAfter: { value: new THREE.Vector4(0, 0, 0, 0) }, uAfter2: { value: new THREE.Vector2(.02, 0) }`,
    `        uAfter: { value: new THREE.Vector4(0, 0, 0, 0) }, uAfter2: { value: new THREE.Vector2(.02, 0) },
        uSkyMid: { value: new THREE.Vector3(.4, .47, .6) }, uSkyMidOn: { value: 0 }`],
  ['sky-shader',
    `uniform float uCloudSpan;
varying vec3 vDirection;
void main(){
  vec3 d=normalize(vDirection);
  float h=max(d.y,0.);
  vec3 c=mix(horizon,zenith,pow(h,.47));`,
    `uniform float uCloudSpan,uSkyMidOn;
uniform vec3 uSkyMid;
varying vec3 vDirection;
void main(){
  vec3 d=normalize(vDirection);
  float h=max(d.y,0.);
  vec3 c=mix(horizon,zenith,pow(h,.47));
  if(uSkyMidOn>.5){
    /* Dusk: the gold stays low and passes through a pale blue to the night, never through brown. */
    c=mix(horizon,uSkyMid,smoothstep(0.,.14,h));
    c=mix(c,zenith,smoothstep(.06,.55,h));
  }`],
  ['sky-apply',
    `            const ca = canyonSkyU.uCloudA.value;`,
    `            canyonSkyU.uSkyMidOn.value = ASCENT ? 1 : 0;
            { const sm = new THREE.Color(CONFIG.maritime.skyMid || '#a9b9cf'); canyonSkyU.uSkyMid.value.set(sm.r, sm.g, sm.b); }
            const ca = canyonSkyU.uCloudA.value;`],
  ['rows',
    `            ['山頂積雪', 'maritime', 'snow', 0, 1.5, .01],`,
    `            ['峽谷天空中段色', 'maritime', 'skyMid'], ['山頂積雪', 'maritime', 'snow', 0, 1.5, .01],`]
]) {
  const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
  const n = src.split(f).length - 1;
  if (n !== 1) throw new Error(`[${label}] anchor found ${n} times`);
  src = src.replace(f, () => r);
}
fs.writeFileSync(file, src);
console.log('patched main.js 11');
