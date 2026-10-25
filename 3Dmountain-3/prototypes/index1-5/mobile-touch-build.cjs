/* Durable index1-5 touch ownership; intentionally no presentation changes. */
const fs = require('fs'), path = require('path');
function once(source, anchor, replacement) {
  if (source.split(anchor).length !== 2) throw Error('mobile touch build anchor: ' + anchor.slice(0, 100));
  return source.replace(anchor, () => replacement);
}
function patchMain(source) {
  if (source.includes('/* MOBILE_TOUCH_MAIN */')) return source;
  source = source.replace(/\r\n/g, '\n');
  source = once(source, "import * as THREE from 'three';", "import * as THREE from 'three';\n    import { mountJourneyTouchNavigation } from './mobile-touch-navigation.js'; /* MOBILE_TOUCH_MAIN */");
  source = once(source, 'function advanceJourney(delta, source)', 'function advanceJourney(delta, source, target)');
  source = once(source, 'world?.take(delta, source)', 'world?.take(delta, source, target)');
  source = once(source, 'epilogue: () => portfolio, grade:', "epilogue: () => portfolio, carry: delta => advanceJourney(delta, 'touch'), grade:");
  source = once(source, 'advanceJourney(THREE.MathUtils.clamp(pixels, -400, 400) / Math.max(720, innerHeight * .85));', "advanceJourney(THREE.MathUtils.clamp(pixels, -400, 400) / Math.max(720, innerHeight * .85), 'wheel', event.target);");
  const start = source.indexOf('      let journeyTouch = null;');
  const finish = source.indexOf("      addEventListener('keydown', event => {", start);
  if (start < 0 || finish < 0) throw Error('mobile touch main input range');
  return source.slice(0, start) + `      mountJourneyTouchNavigation({
        canvas, uiRoot: journeyUI.root,
        blocked: () => sceneStopped || !assetsReady || journeyUI.menuOpen || dropTouch.grabbed,
        advance: (delta, target) => advanceJourney(delta, 'touch', target)
      });
` + source.slice(finish);
}
function patchWorld(source) {
  if (source.includes('/* MOBILE_TOUCH_WORLD */')) return source;
  source = source.replace(/\r\n/g, '\n');
  source = once(source, "import * as THREE from 'three';", "import * as THREE from 'three';\nimport { consumeMobileScroll, mountMobileTouchNavigation } from './mobile-touch-navigation.js'; /* MOBILE_TOUCH_WORLD */");
  source = once(source, '  let touch = null, samples = [];', '  let samples = [];');
  source = once(source, 'epilogue = () => null, grade =', 'epilogue = () => null, carry = null, grade =');
  source = once(source, 'raf = 0; touch = null; samples = [];', 'raf = 0; samples = [];');
  const start = source.indexOf('  // Touches that start on this layer');
  const finish = source.indexOf('  // ---------- navigation ----------', start);
  if (start < 0 || finish < 0) throw Error('mobile touch world input range');
  source = source.slice(0, start) + `  const disposeWorldTouch = mountMobileTouchNavigation({
    surface: viewport, blocked: (_, phase) => phase === 'start' && !open, observeEnd: true,
    onStart: () => { samples = []; },
    onDelta: ({ dx, dy, axis, target }) => {
      const pixels = axis === 'x' ? (ocean?.active ? dx * ocean.swipe : 0) : consumeMobileScroll(target, dy);
      if (!pixels) { samples = []; return; }
      // Carry the remainder across the world/cards boundary in the same swipe.
      if (!scrollPx(pixels, 'touch')) {
        const delta = pixels * 1.9 / Math.max(580, H * .8);
        if (carry) carry(delta); else epilogue()?.take(delta);
      }
    },
    onEnd: ({ cancelled }) => { if (cancelled) samples = []; else if (samples.length) fling(); }
  });

` + source.slice(finish);
  source = once(source, 'take(delta, source) { if (!open || !Number.isFinite(delta)) return false; return scrollPx(toPixels(delta, source), source); },', `take(delta, source, target) {
      if (!open || !Number.isFinite(delta)) return false;
      const pixels = consumeMobileScroll(target, toPixels(delta, source));
      return pixels ? scrollPx(pixels, source) : true;
    },`);
  source = once(source, "removeEventListener('resize', onResize); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);", "removeEventListener('resize', onResize); disposeWorldTouch();");
  return source;
}
module.exports = state => ({ ...state, main: patchMain(state.main), extra: { ...state.extra, 'finnovation-world.js': patchWorld(state.extra['finnovation-world.js']), 'mobile-touch-navigation.js': fs.readFileSync(path.join(__dirname, 'mobile-touch-navigation.js'), 'utf8') } });
module.exports.patchMain = patchMain;
module.exports.patchWorld = patchWorld;
