// Maritime look, pass 2. Edits ONLY the copies in prototypes/maritime-landscape/js.
const fs = require('fs');
const path = require('path');
const DIR = 'G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/maritime-landscape/js';
const files = {};
const load = f => files[f] ??= fs.readFileSync(path.join(DIR, f), 'utf8');
function rep(f, a, b) {
  const s = load(f); const n = s.split(a).length - 1;
  if (n !== 1) { console.error(`[${f}] MATCH COUNT ${n} for:\n` + a.slice(0, 200)); process.exit(1); }
  files[f] = s.replace(a, () => b);
}
const MAIN = 'main.js', SCN = 'water-journey-scene-463.js';
if (load(MAIN).includes("'mar-land'")) { console.error('pass 2 already applied'); process.exit(2); }

// Land/water on screen: the page CSS switches to white type and smoky glass.
rep(MAIN, `        const mix = journey.mix;
        canyon.scene.environment = scene.environment;`,
`        const mix = journey.mix;
        document.body.classList.toggle('mar-land', !!CONFIG.maritime.on && mix >= .5);
        canyon.scene.environment = scene.environment;`);

// Surf on the aerial rivers: a hint of it, not a white rim down every bank.
rep(MAIN, `*(1.-.88*aer*(1.-.6*marOn));`, `*(1.-.88*aer*(1.-.25*marOn));`);

// Palette: a greyer warm rock, softer bedding, more scrub on the gentle ground, quieter light ribbons.
rep(MAIN, `rock: '#857869', rockCool: '#6d6c69', rockWarm: '#9a7a58', streak: .55,
        veg: '#3b4031', vegAmount: .85, vegLine: 520,`,
`rock: '#857869', rockCool: '#6d6c69', rockWarm: '#8d7760', streak: .45,
        veg: '#3b4031', vegAmount: .9, vegLine: 760,`);
rep(MAIN, `        Object.assign(CONFIG.shoreline, { foamColor: '#e9eeee', frost: .2 });`,
`        Object.assign(CONFIG.shoreline, { foamColor: '#e9eeee', frost: .2, strata: 1 });
        Object.assign(CONFIG.watershedFlow, { brightness: .65 });`);
rep(SCN, `float mVeg=smoothstep(.40,.22,mSteep)`, `float mVeg=smoothstep(.46,.26,mSteep)`);

for (const [f, s] of Object.entries(files)) fs.writeFileSync(path.join(DIR, f), s);
console.log('patched', Object.keys(files).join(', '));
