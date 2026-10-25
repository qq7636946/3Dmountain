/* Run after mobile-touch-build and world-mobile-performance-build. Reuse the
   world's page/device gate to align only the main page's phone strategy cards. */
const fs = require('fs'), path = require('path');
function patchWorld(source) {
  if (source.includes('/* MOBILE_OCEAN_SNAP */')) return source;
  source = source.replace(/\r\n/g, '\n');
  const once = (anchor, replacement) => {
    if (source.split(anchor).length !== 2) throw Error('Mobile ocean snap anchor: ' + anchor.slice(0, 100));
    source = source.replace(anchor, () => replacement);
  };
  once("import * as THREE from 'three';", "import * as THREE from 'three';\nimport { createOceanPanelSnap } from './ocean-panel-snap.js'; /* MOBILE_OCEAN_SNAP */");
  once('  let samples = [];', `  let samples = [];
  const oceanSnap = createOceanPanelSnap({
    enabled: () => open && mobilePerformance,
    getPosition: () => yt,
    getStops: () => ocean ? Array.from({ length: ocean.N }, (_, k) => ocean.stopY(k)) : [],
    moveTo: value => { yt = clamp(value, 0, maxY); run(); }
  });`);
  once('    yt = clamp(yt + px, 0, maxY);', '    yt = clamp(yt + px, 0, maxY);\n    oceanSnap.input(px, source);');
  once('    onStart: () => { samples = []; },', '    onStart: () => { samples = []; oceanSnap.cancel(); },');
  once('      if (!pixels) { samples = []; return; }', '      if (!pixels) { samples = []; oceanSnap.cancel(); return; }');
  once('    onEnd: ({ cancelled }) => { if (cancelled) samples = []; else if (samples.length) fling(); }', `    onEnd: ({ cancelled }) => {
      if (cancelled) { samples = []; oceanSnap.cancel(); }
      else { if (samples.length) fling(); oceanSnap.finish(); }
    }`);
  once('      return pixels ? scrollPx(pixels, source) : true;', '      if (!pixels) { oceanSnap.cancel(); return true; }\n      return scrollPx(pixels, source);');
  once('  const onResize = () => {', '  const onResize = () => {\n    oceanSnap.cancel();');
  once('    open = false; cancelAnimationFrame(raf); raf = 0; samples = [];', '    open = false; oceanSnap.cancel(); cancelAnimationFrame(raf); raf = 0; samples = [];');
  once("  root.addEventListener('click', event => {", "  root.addEventListener('click', event => {\n    oceanSnap.cancel();");
  once('    scrollTo(value) { if (!open) return;', '    scrollTo(value) { if (!open) return; oceanSnap.cancel();');
  once('    next() { if (!open) return false;', '    next() { if (!open) return false; oceanSnap.cancel();');
  once('    jump(value) { if (!open) enter();', '    jump(value) { oceanSnap.cancel(); if (!open) enter();');
  return source;
}
module.exports = state => ({ ...state, extra: { ...state.extra,
  'finnovation-world.js': patchWorld(state.extra['finnovation-world.js']),
  'ocean-panel-snap.js': fs.readFileSync(path.join(__dirname, 'ocean-panel-snap.js'), 'utf8')
} });
module.exports.patchWorld = patchWorld;
