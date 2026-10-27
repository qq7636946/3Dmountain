// Maritime look, pass 4: values only. Brighter rock, near-day light over the aerial, more saturated deep water.
const fs = require('fs');
const f = 'G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/maritime-landscape/js/main.js';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) { console.error('MATCH COUNT ' + n + ': ' + a); process.exit(1); } s = s.replace(a, () => b); };
rep(`        sun: '#f3eadc', sunDay: 2.9, sunAerial: 2.6,
        hemiSky: '#d5d9d6', hemiGround: '#3c4247', hemiDay: 1.1, hemiAerial: .55,
        rim: '#a9b6c1', rimDay: .45, rimAerial: .3, ibl: .35,
        rock: '#7d7164', rockCool: '#5f5f5c', rockWarm: '#8a735b', streak: .45,`,
`        sun: '#f3eadc', sunDay: 3.0, sunAerial: 3.2,
        hemiSky: '#d5d9d6', hemiGround: '#3c4247', hemiDay: 1.2, hemiAerial: 1.0,
        rim: '#a9b6c1', rimDay: .45, rimAerial: .4, ibl: .35,
        rock: '#8c7f70', rockCool: '#6a6965', rockWarm: '#9a8066', streak: .45,`);
rep(`deep: '#0d2740', mid: '#23435f', bed: '#2f4a4c', foam: '#e9eeee', reflect: 1, glint: .35, ripple: .14`,
  `deep: '#06223d', mid: '#1b3d5c', bed: '#2f4a4c', foam: '#e9eeee', reflect: .85, glint: .35, ripple: .14`);
fs.writeFileSync(f, s); console.log('pass 4 applied');
