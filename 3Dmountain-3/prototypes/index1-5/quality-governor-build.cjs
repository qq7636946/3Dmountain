/* 2026-11-03 (客戶同意「第一階段全做加第 5 項」): the frame-time governor (quality-governor.js) drives the drawing resolution of the
   journey (main.js resize) and of the world (finnovation-world.js setDpr, which had its own rule: down at > 24 ms, back up only under
   14 ms, which a 60 Hz screen never reaches, and never below 1). A capable machine stays at scale 1: its picture does not change.
   Runs last in build.cjs's first helper list (its anchors come from mobile-performance, silk-scroll, flash-glow and light-shafts). Undo without a rebuild: ?governor=0. Remove: drop this file's name from build.cjs. */
const fs = require('fs'), path = require('path');
function once(s, a, b, label) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw Error(`quality governor anchor (${label}): ${n} matches`);
  return s.replace(a, () => b);
}
function patchMain(s) {
  if (s.includes('/* QUALITY_GOVERNOR */')) return s;
  s = once(s, "    import { stepJourneyPolish } from './motion-response.js';", "    import { stepJourneyPolish } from './motion-response.js';\n    import { createQualityGovernor } from './quality-governor.js';   /* QUALITY_GOVERNOR */", 'main import');
  s = once(s, '      let lastWidth = 0, lastHeight = 0, lastDpr = 0, resizeFrame = 0;',
    '      let lastWidth = 0, lastHeight = 0, lastDpr = 0, resizeFrame = 0;\n      /* QUALITY_GOVERNOR: the journey\'s resolution follows its own frame times on a weak device (quality-governor.js) */\n      const journeyGovernor = createQualityGovernor(\'journey\', { min: .6 });', 'main governor');
  s = once(s, '        const width = innerWidth, height = innerHeight, dpr = Math.min(devicePixelRatio, mobileRenderBudget.dpr);',
    '        const width = innerWidth, height = innerHeight, baseDpr = Math.min(devicePixelRatio, mobileRenderBudget.dpr), dpr = journeyGovernor.scale < 1 ? Math.round(baseDpr * journeyGovernor.scale * 100) / 100 : baseDpr;', 'main resize dpr');
  s = once(s, '        if ((portfolio?.covering || world?.covering) && !manual) { /* covered */ }',
    '        if (!manual && !firstFrame && !(portfolio?.covering || world?.covering) && journeyGovernor.sample(realDelta, performance.now() / 1000)) resize();   /* QUALITY_GOVERNOR */\n        if ((portfolio?.covering || world?.covering) && !manual) { /* covered */ }', 'main sample');
  return s;
}
function patchWorld(s) {
  if (s.includes('/* QUALITY_GOVERNOR */')) return s;
  s = once(s, "import { stepWorldFollow } from './motion-response.js';   /* SILK_SCROLL */", "import { stepWorldFollow } from './motion-response.js';   /* SILK_SCROLL */\nimport { createQualityGovernor } from './quality-governor.js';   /* QUALITY_GOVERNOR */", 'world import');
  s = once(s, '  let dpr = maxDpr;', "  let dpr = maxDpr;\n  const worldGovernor = createQualityGovernor('world', { min: Math.min(.6, 1 / maxDpr) });   /* QUALITY_GOVERNOR: down to DPR 1 on a retina screen as before, .6 of 1 on a plain one */", 'world governor');
  s = once(s, '    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;', '    const rawDt = Math.max(0, (now - last) / 1000), dt = Math.min(.05, rawDt); last = now;', 'world raw dt');
  s = once(s, '    clock.avgMs = mix(clock.avgMs, dt * 1000, .08); clock.lastDt = dt;', '    clock.avgMs = mix(clock.avgMs, dt * 1000, .08); clock.lastDt = dt; clock.raw = rawDt;', 'world clock raw');
  s = once(s, `    // Adaptive resolution: if frames come slower than ~40/s, draw fewer pixels; climb back when there is room.
    if (++frames % 45 === 0 && clock) {
      if (clock.avgMs > 24 && dpr > 1) setDpr(dpr - .25);
      else if (clock.avgMs < 14 && dpr < maxDpr) setDpr(dpr + .25);
    }`, `    /* QUALITY_GOVERNOR: adaptive resolution by the device's own frame times (quality-governor.js); before: −.25 DPR at > 24 ms, back only under 14 ms (never, at 60 Hz), floor 1 */
    if (clock && worldGovernor.sample(clock.raw, time)) setDpr(maxDpr * worldGovernor.scale);`, 'world adaptive');
  s = once(s, '  function setDpr(value) { dpr = clamp(value, 1, maxDpr);', '  function setDpr(value) { dpr = clamp(value, .5, maxDpr);', 'world dpr floor');
  return s;
}
module.exports = state => ({ ...state, main: patchMain(state.main), extra: { ...state.extra, 'finnovation-world.js': patchWorld(state.extra['finnovation-world.js']), 'quality-governor.js': fs.readFileSync(path.join(__dirname, 'quality-governor.js'), 'utf8').replace(/\r\n/g, '\n') } });
module.exports.patchMain = patchMain; module.exports.patchWorld = patchWorld;
