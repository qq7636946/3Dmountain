/* index1-5-alpine -> index1-5: sky, sun, light rig, fog, valley clouds and air ice (lighting & atmosphere pass, 2026-10-23).
   Edits to the GENERATED water-journey-scene-463.js. Each anchor must occur exactly once; no anchor carries a ?v= query,
   so it applies to any build of prototypes/index1-5-morning-20261026/js/water-journey-scene-463.js.

   New / replaced modules that must sit next to the patched file (copy from prototypes/index1-5-alpine/js/):
     alpine-light-params.js   ALPINE_LIGHT live parameters + ALPINE_LIGHT_ROWS (tuner rows)
     alpine-atmosphere.js     sky dome shader (gradient, sun disc/halo/streak, cumulus, horizon cloud sea, grain),
                              sun / rim / cool fill rig, two-phase static shadow fit, fog scaling, drifting ice particles
     alpine-cloud-banks.js    (replaces the old one) sorted, sun-lit valley cloud puffs + shared billow noise texture
   Their imports are query-less on purpose (one ALPINE_LIGHT instance for every importer). NOTE for build.cjs: its
   rewire() maps any './x.js' that is not in LOCAL to '../../../js/x.js', so run this patch AFTER rewire (as a post-step
   on the written file), or teach rewire to leave alpine-light-params.js / alpine-atmosphere.js untouched.

   Usage:
     node patches/light-sky-clouds.cjs <path/to/water-journey-scene-463.js>        apply in place
     node patches/light-sky-clouds.cjs <path> --check                             dry run (anchors only)
     require('./light-sky-clouds.cjs')({journey}) -> {journey}                     build-step form */
const EDITS = [
  ['import { createCanyonWatershedBuilder }',
   "import { createAlpineAtmosphere } from './alpine-atmosphere.js';\nimport { createCanyonWatershedBuilder }"],
  ['const alpineClouds=createAlpineCloudBanks(THREE,{lite,sampleHeight:watershed.sampleHeight});',
   'const alpineClouds=createAlpineCloudBanks(THREE,{lite,sampleHeight:watershed.sampleHeight,terrainAt:watershed.terrainAt,riverDistance:watershed.riverDistance,bounds:watershed.bounds});\n' +
   '  const alpineAtmosphere=createAlpineAtmosphere(THREE,{scene,camera,sky,hemisphere,sunlight,rim,clouds:alpineClouds,lite});'],
  ['    alpineClouds.update(u,time,reduceMotion);',
   '    alpineAtmosphere.update(u,time,reduceMotion);\n    alpineClouds.update(u,time,reduceMotion,camera);\n    alpineAtmosphere.finishClouds();'],
  ['    alpineClouds.dispose();',
   '    alpineAtmosphere.dispose();\n    alpineClouds.dispose();'],
  ['return { scene, camera, curve, widthAt, river, alpineClouds,',
   'return { scene, camera, curve, widthAt, river, alpineClouds, alpineAtmosphere,']
];
function apply(journey) {
  const eol = journey.includes('\r\n') ? '\r\n' : '\n';
  let s = journey.replace(/\r\n/g, '\n');
  if (s.includes('createAlpineAtmosphere')) throw Error('light-sky-clouds: already applied');
  for (const [a, b] of EDITS) {
    const n = s.split(a).length - 1;
    if (n !== 1) throw Error(`light-sky-clouds anchor found ${n}x (need 1): ${a.slice(0, 90)}`);
    s = s.replace(a, () => b);
  }
  return eol === '\n' ? s : s.replace(/\n/g, eol);
}
module.exports = ({ journey, ...rest }) => ({ ...rest, journey: apply(journey) });
module.exports.apply = apply;
module.exports.EDITS = EDITS;
if (require.main === module) {
  const fs = require('fs'), file = process.argv[2], check = process.argv.includes('--check');
  if (!file) { console.error('usage: node light-sky-clouds.cjs <water-journey-scene-463.js> [--check]'); process.exit(2); }
  const out = apply(fs.readFileSync(file, 'utf8'));
  if (!check) fs.writeFileSync(file, out);
  console.log((check ? 'check ok: ' : 'patched: ') + file + ' (' + EDITS.length + ' edits)');
}
