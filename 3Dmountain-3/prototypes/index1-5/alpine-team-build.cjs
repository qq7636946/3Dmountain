/* index1-5 · alpine team pass (2026-10-23). Client: 山的精細度、天空跟雲、打光照 everest.suraj.work；介面照它調整；重要屬性開參數.
   Developed in the staging copy index1-5-alpine (three specialists), sources kept in prototypes/index1-5/alpine/:
     light   alpine-light-params.js (ALPINE_LIGHT + rows), alpine-atmosphere.js (sky dome, sun/rim/fill rig, fog, air ice),
             alpine-cloud-banks.js (replaces the earlier banks), light-sky-clouds.cjs (5 anchored edits to the journey)
     terrain alpine-terrain-params.js (+ its modules) and terrain-material.cjs (when present)
     ui      alpine-ui.js (stat bar, scene labels, chapter numerals), alpine-ui.css (one block keyed on html[data-alpine-ui])
   Returns the patched sources plus { extra: {file: source} } for build.cjs to write (rewired like every local module),
   and appends the UI block to index1-5.css / marks the page (idempotent). Tuner (?tune=1 or T): 山景打光／山形材質 groups. */
const fs = require('fs'), path = require('path');
const A = p => path.join(__dirname, 'alpine', p), has = p => fs.existsSync(A(p));
const read = p => fs.readFileSync(A(p), 'utf8').replace(/\r\n/g, '\n');
module.exports = function ({ main, journey, watershed, html }) {
  const extra = {};
  const once = (s, a, b, label) => { if (s.split(a).length !== 2) throw Error('alpine-team anchor ' + label); return s.replace(a, () => b); };

  // ---- light, sky, clouds -------------------------------------------------------------------------
  ({ journey } = require(A('light-sky-clouds.cjs'))({ journey }));
  for (const f of ['alpine-light-params.js', 'alpine-atmosphere.js', 'alpine-cloud-banks.js']) extra[f] = read(f);
  main = once(main, "    import * as THREE from 'three';\n",
    "    import * as THREE from 'three';\n    import { ALPINE_LIGHT, ALPINE_LIGHT_ROWS } from './alpine-light-params.js';\n", 'light import');
  let rows = "          ['山景打光 Light', ALPINE_LIGHT_ROWS.map(r => [r[0], 'alpineLight', ...r.slice(1)])],\n";
  let config = '      CONFIG.alpineLight = ALPINE_LIGHT;   /* the tuner edits the shared live object */\n';
  // the formed wordmark sits clear of the chapter kicker on wide screens (2026-10-23)
  config += '      if (innerWidth >= 760) CONFIG.logoFraming.y = -48;\n';

  // ---- terrain & material (when delivered) ------------------------------------------------------------
  if (has('terrain-material.cjs')) {
    // erosion + ridge net on the baked grid (watershed, generated) and the alpine terrain material (index1-5-terrain.js,
    // a hand-kept local module: patched once, then left alone — the patch marks it)
    const { PATCHES, apply, MARK } = require(A('terrain-material.cjs'));
    watershed = apply(watershed, PATCHES['water-canyon-watershed-463.js'], 'water-canyon-watershed-463.js');
    // terrain round 5: the canyon grass tufts' hook in the journey (alpine-canyon-tufts.js)
    if (PATCHES['water-journey-scene-463.js']?.length) journey = apply(journey, PATCHES['water-journey-scene-463.js'], 'water-journey-scene-463.js');
    const terrainFile = path.join(__dirname, 'js', 'index1-5-terrain.js');
    const terrain = fs.readFileSync(terrainFile, 'utf8');
    if (!terrain.includes(MARK)) extra['index1-5-terrain.js'] = apply(terrain, PATCHES['index1-5-terrain.js'], 'index1-5-terrain.js');
    for (const f of ['alpine-terrain-params.js', 'alpine-erosion.js', 'alpine-terrain-material.js', 'alpine-canyon-tufts.js']) if (has(f)) extra[f] = read(f);
    main = once(main, "    import { ALPINE_LIGHT, ALPINE_LIGHT_ROWS } from './alpine-light-params.js';\n",
      "    import { ALPINE_LIGHT, ALPINE_LIGHT_ROWS } from './alpine-light-params.js';\n    import { ALPINE_TERRAIN, ALPINE_TERRAIN_ROWS } from './alpine-terrain-params.js';\n", 'terrain import');
    rows += "          ['山形材質 Terrain', ALPINE_TERRAIN_ROWS.map(r => [r[0], 'alpineTerrain', ...r.slice(1)])],\n";
    config += '      CONFIG.alpineTerrain = ALPINE_TERRAIN;\n';
  }
  main = once(main, "          ['卡牌轉場 Cards', [", rows + "          ['卡牌轉場 Cards', [", 'tuner rows');
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', config + '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', 'config');

  // ---- interface ----------------------------------------------------------------------------------------
  const cssFile = path.join(__dirname, 'index1-5.css'), block = read('alpine-ui.css');
  let css = fs.readFileSync(cssFile, 'utf8').replace(/\r\n/g, '\n');
  const start = css.indexOf('/* ==== ALPINE-UI START'), endMark = '/* ==== ALPINE-UI END ==== */';
  if (start >= 0) css = css.slice(0, start).replace(/\s+$/, '') + '\n' + css.slice(css.indexOf(endMark, start) + endMark.length).replace(/^\s+/, '');
  fs.writeFileSync(cssFile, css.replace(/\s+$/, '') + '\n\n' + block.trim() + '\n');
  fs.writeFileSync(path.join(__dirname, 'alpine-ui.js'), read('alpine-ui.js'));
  // one data-alpine-ui on <html>, however many times the build runs (the earlier lazy regex appended one per build)
  html = html.replace(/<html ([^>]*)>/, (m, a) => `<html ${a.replace(/\s*data-alpine-ui/g, '').trimEnd()} data-alpine-ui>`);
  if (!html.includes('prototypes/index1-5/alpine-ui.js')) {
    html = once(html, '" onerror="showFinnovationText()"></script>\n', '" onerror="showFinnovationText()"></script>\n  <!-- ALPINE-UI: everest-style interface layer (stat bar, scene labels, chapter numerals); styles in index1-5.css -->\n  <script type="module" src="prototypes/index1-5/alpine-ui.js?v=VERSION"></script>\n', 'ui script');
  }
  return { main, journey, watershed, html, extra };
};
