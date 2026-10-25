/* Local to index1-5 (2026-10-25). The planet → ocean swipe after igloo.inc: world-dive-fx.js draws over the world's finished frame while
   the ocean's wave crosses (world-ocean.js is not touched). Patches this page's copy of finnovation-world.js (extra, after the ocean /
   logo helpers) and main.js (CONFIG.worldDive, rows at the top of the tuner's 「海洋章節 Ocean」 group). */
const fs = require('fs'), path = require('path');
const once = (src, a, b, label) => { if (src.split(a).length !== 2) throw Error('world-dive-fx anchor (' + label + '): ' + (src.split(a).length - 1)); return src.replace(a, () => b); };
function patchWorld(src) {
  if (src.includes('/* WORLD_DIVE_FX */')) return src;
  src = once(src, "import * as THREE from 'three';", "import * as THREE from 'three';\nimport { createWorldDiveFx } from './world-dive-fx.js';   /* WORLD_DIVE_FX */", 'world import');
  src = once(src, '  let renderer = null, scene = null, background = null, globe = null, halo = null, deck = null, blank = null;',
    '  let renderer = null, scene = null, background = null, globe = null, halo = null, deck = null, blank = null;\n  const diveFx = createWorldDiveFx({ reducedMotion });   // index1-5: igloo-style planet → ocean swipe', 'world create');
  src = once(src, '    if (!logoDrawn) drawBeforeSeal();', '    if (!logoDrawn) drawBeforeSeal();\n    diveFx.render(s, time, renderer);', 'world draw');
  return src;
}
function patchMain(main) {
  if (main.includes('/* WORLD_DIVE */')) return main;
  main = once(main, "    import * as THREE from 'three';", "    import * as THREE from 'three';\n    import { WORLD_DIVE_DEFAULTS, WORLD_DIVE_ROWS } from './world-dive-fx.js';", 'main import');
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* WORLD_DIVE */
      CONFIG.worldDive = { ...WORLD_DIVE_DEFAULTS };
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'main config');
  main = once(main, "['海洋章節 Ocean', [", "['海洋章節 Ocean', [...WORLD_DIVE_ROWS, ", 'main rows');
  return main;
}
module.exports = ({ main, drops, letters, glass, html, extra = {} }) => {
  if (!extra['finnovation-world.js']) throw Error('world-dive-fx: no finnovation-world.js in extra (run after world-ocean-build / world-logo-build)');
  return {
    main: patchMain(main), drops, letters, glass, html,
    extra: { 'finnovation-world.js': patchWorld(extra['finnovation-world.js']), 'world-dive-fx.js': fs.readFileSync(path.join(__dirname, 'world-dive-fx.js'), 'utf8') }
  };
};
module.exports.patchWorld = patchWorld; module.exports.patchMain = patchMain;
