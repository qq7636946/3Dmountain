/* index1-5 · flow-feel (2026-10-24, client 「絲滑跟轉場請抄他的」 — Hubtown). Spec and numbers: docs/smooth-flow/hubtown-study.md.
   ONE shared input → motion smoother ("silk": a damped follow τ1 feeding a critically damped spring ω2) replaces the five springs
   the page had (journey ω10.5, cards bridge ω4.2, globe ω9.5, ocean ω6, cards-strip ω12 stays in the shared slider), the hand-offs
   between sections no longer swallow a notch (the part of a wheel step past the journey's end rides the bridge; the part past the
   bridge's start goes back to the journey; the world gives the wheel back near the top, not only at y < 2 px), and the journey's
   distance per notch is set from a target of wheel notches per chapter (default 20).
   Phase 2 (same helper): time-driven chapter text, dissolve mask over the hard cuts.
   Switch: ?smooth=classic (also 0 / off) = every patched spot runs the code that was there before (FEEL.on false).
   Dials: tuner group 「滑順手感 Smooth」 = CONFIG.smooth. Runtime: flow-feel.js → extra['smooth-input.js'].
   Runs after logo-panel-build.cjs and before flow-fix-build.cjs (another engineer's file: warm-ups, preloads, slicing; it does not touch
   springs). Every anchor must occur exactly once; patches into files other sessions edit are skipped with a warning (FEEL.skipped).
   Never edits the shared js/ files: portfolio-epilogue.js is shipped as a local copy (extra), finnovation-world.js is already local. */
const fs = require('fs'), path = require('path');
module.exports = ({ main, drops, letters, glass, html, extra = {}, journey }) => {
  const ROOT = path.resolve(__dirname, '../..');
  const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const skipped = [];
  const once = (source, anchor, replacement, label) => {
    const n = source.split(anchor).length - 1;
    if (n !== 1) throw new Error('index1-5 flow-feel anchor (' + label + '): ' + n + ' × ' + anchor.slice(0, 110));
    return source.replace(anchor, () => replacement);
  };
  /* a patch set on a file other sessions edit: all-or-nothing, never stops the build */
  const soft = (name, source, fn) => { try { return fn(source); } catch (e) { const msg = String(e.message || e).slice(0, 200); console.warn('[flow-feel] SKIPPED ' + name + ': ' + msg); skipped.push(name + ': ' + msg); return source; } };

  /* ---------------------------------------------------------------- runtime */
  let rt = read(path.join(__dirname, 'flow-feel.js')) + '\n' + read(path.join(__dirname, 'flow-feel-p2.part.js'));
  const files = { 'smooth-input.js': rt };

  /* ---------------------------------------------------------------- main */
  main = once(main, "import { mountJourneyStory, stepJourneyMotion } from './water-journey-story.js?v=index463-scroll-20261004-78fa788ddc';",
    "import { mountJourneyStory, stepJourneyMotion } from './water-journey-story.js?v=index463-scroll-20261004-78fa788ddc';\n    import { FEEL, installCuts } from './smooth-input.js';", 'import');
  /* dials + host binding (right before the defaults snapshot, so 重設 / 複製參數 JSON know them) */
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',
    `      /* index1-5 flow-feel: one smoother for every section (docs/smooth-flow/hubtown-study.md). ?smooth=classic = the old springs. */
      CONFIG.smooth = FEEL.defaults();
      FEEL.bind({ cfg: () => CONFIG.smooth, stops: () => journeyStops(), max: () => journey.max, notch: () => 100 / Math.max(720, innerHeight * .85) });
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'defaults');
  main = once(main, "          ['卡牌轉場 Cards', [",
    `          ['滑順手感 Smooth', [
            ['手感檔位（0 輕 A／1 中 B／2 重 C）', 'smooth', 'weight', 0, 2, 1],
            ['補間 τ1 秒（0＝用檔位）', 'smooth', 'tau1', 0, .6, .01], ['彈簧 ω2（0＝用檔位）', 'smooth', 'omega2', 0, 20, .5],
            ['每章停留（滾輪格數／章，0＝用下一列）', 'smooth', 'stayNotches', 0, 60, 1], ['旅程每格距離 ×（停留＝0 時）', 'smooth', 'journeyGain', .15, 1.5, .01],
            ['交棒寬容：橋完成度（橋→地球）', 'smooth', 'handoff', .5, 1, .01], ['交棒寬容：回頂 px（地球→卡牌）', 'smooth', 'topTol', 2, 200, 1],
            ['字卡：標題時長 ms', 'smooth', 'textMs', 200, 2400, 10], ['字卡：進場延遲 ms（切點後）', 'smooth', 'textDelay', 0, 1500, 10],
            ['字卡：行距延遲 ms', 'smooth', 'textStagger', 0, 400, 5], ['字卡：舊章淡出 ms', 'smooth', 'outMs', 60, 900, 10],
            ['溶解遮罩 ms（0＝關）', 'smooth', 'dissolveMs', 0, 2000, 25], ['溶解強度', 'smooth', 'dissolve', 0, 1.5, .05]
          ]],
          ['卡牌轉場 Cards', [`, 'tuner rows');
  /* the journey's own spring */
  main = once(main, '        stepJourneyMotion(J, scrollDt, reduceMotion);', '        FEEL.journey(J, scrollDt, reduceMotion, stepJourneyMotion);\n        FEEL.frame();', 'journey step');
  /* phase 2: the dissolve pass (off until a cut asks for it; one clock, no scroll dependence) */
  main = once(main, '      composer.addPass(grainPass);\n',
    `      composer.addPass(grainPass);
      /* index1-5 flow-feel: dissolve mask over chapter / hand-over cuts (FEEL.cut), off (enabled = false) the rest of the time */
      const feelDissolve = new ShaderPass(FEEL.dissolveShader); composer.addPass(feelDissolve); FEEL.attachPass(feelDissolve); installCuts();
`, 'dissolve pass');
  /* distance per notch + the part of a step past the journey's end goes on to the bridge */
  main = once(main, 'journey.target = THREE.MathUtils.clamp(journey.target + delta, Math.max(0, journey.progress - 1.25), Math.min(journey.max, journey.progress + 1.25)); }',
    `const feelGain = (source === 'wheel' || source === 'touch') ? FEEL.gain() : 1, wanted = journey.target + delta * feelGain;
        journey.target = THREE.MathUtils.clamp(wanted, Math.max(0, journey.progress - 1.25), Math.min(journey.max, journey.progress + 1.25));
        if (FEEL.on && delta > 0 && wanted > journey.max + 1e-6 && journey.target >= journey.max - 1e-6) portfolio?.take((wanted - journey.max) / feelGain); }`, 'advance');
  main = once(main, '        advanceJourney(THREE.MathUtils.clamp(pixels, -400, 400) / Math.max(720, innerHeight * .85));',
    "        advanceJourney(THREE.MathUtils.clamp(pixels, -400, 400) / Math.max(720, innerHeight * .85), 'wheel');", 'wheel');
  main = once(main, '          notch: () => 100 / Math.max(720, innerHeight * .85)\n        });',
    "          notch: () => 100 / Math.max(720, innerHeight * .85),\n          /* flow-feel: what is left of a wheel step when the bridge closes going back goes on to the journey */\n          carry: FEEL.on ? rest => advanceJourney(rest, 'wheel') : null\n        });", 'carry');

  /* ---------------------------------------------------------------- portfolio-epilogue.js (local copy of the shared file) */
  let ep = read(path.join(ROOT, 'js', 'portfolio-epilogue.js'));
  ep = '/* index1-5 copy of js/portfolio-epilogue.js (flow-feel-build.cjs): silk bridge, hand-offs that keep the rest of a notch */\n' + ep;
  ep = once(ep, 'const GATE = .1, UNITS = 6900, BRIDGE = 1.3;', "import { FEEL } from './smooth-input.js';\nconst GATE = .1, UNITS = 6900, BRIDGE = 1.3;", 'ep import');
  ep = once(ep, 'bridge = false, onEnd = null, grade = null, mist = null, notch = null }) {', 'bridge = false, onEnd = null, grade = null, mist = null, notch = null, carry = null }) {', 'ep signature');
  ep = once(ep, 'import(sliderUrl)', 'import(FEEL.sliderUrl(sliderUrl))', 'ep slider url');
  ep = once(ep, '  let bt = 0, exit = 0, exitPainted = NaN, suspended = false, gradeKey = \'\';', "  const silk = FEEL.newSilk(0);\n  let bt = 0, exit = 0, exitPainted = NaN, suspended = false, gradeKey = '';", 'ep state');
  ep = once(ep, `      const follow = +mist?.()?.follow, omega = bridge ? (Number.isFinite(follow) && follow > 1 ? follow : 5.5) : 8;
      const offset = amount - target, j = (velocity + omega * offset) * dt, decay = Math.exp(-omega * dt);
      amount = Math.max(0, Math.min(1, target + (offset + j) * decay)); velocity = (velocity - omega * j) * decay;
      if (Math.abs(amount - target) < .001 && Math.abs(velocity) < .01) { amount = target; velocity = 0; }`,
    `      if (bridge && FEEL.on) {
        FEEL.step(silk, target, dt, { x: amount, v: velocity }, { min: 0, max: 1, eps: .001, veps: .01 }); amount = silk.x; velocity = silk.v;
      } else {
      const follow = +mist?.()?.follow, omega = bridge ? (Number.isFinite(follow) && follow > 1 ? follow : 5.5) : 8;
      const offset = amount - target, j = (velocity + omega * offset) * dt, decay = Math.exp(-omega * dt);
      amount = Math.max(0, Math.min(1, target + (offset + j) * decay)); velocity = (velocity - omega * j) * decay;
      if (Math.abs(amount - target) < .001 && Math.abs(velocity) < .01) { amount = target; velocity = 0; }
      }`, 'ep spring');
  ep = once(ep, '      if (next <= 0) { close(); return true; }', '      if (next <= 0) { close(); if (FEEL.on && carry && next < -1e-6) carry(next * span()); return true; }', 'ep carry');
  ep = once(ep, 'if (delta > 0 && slider.progress >= 1 && amount >= .97) onEnd?.(delta);', 'if (delta > 0 && slider.progress >= 1 && amount >= FEEL.handoff()) onEnd?.(delta);', 'ep handoff');
  files['portfolio-epilogue.js'] = ep;

  /* ---------------------------------------------------------------- finnovation-world.js (already a local copy) */
  let world = extra['finnovation-world.js'];
  if (typeof world !== 'string') { console.warn('[flow-feel] SKIPPED world: extra["finnovation-world.js"] missing'); skipped.push('world: missing'); }
  else world = soft('world', world, w => {
    w = once(w, "import * as THREE from 'three';", "import * as THREE from 'three';\nimport { FEEL } from './smooth-input.js';", 'world import');
    w = once(w, '  let y = 0, yt = 0, vy = 0, written = -1, maxY = 1;', '  const silk = FEEL.newSilk(0);\n  let y = 0, yt = 0, vy = 0, written = -1, maxY = 1;', 'world state');
    w = once(w, `      const omega = ocean ? ocean.omega(y) : 9.5, x = y - yt, decay = Math.exp(-omega * dt), temp = (vy + omega * x) * dt;
      y = yt + (x + temp) * decay; vy = (vy - omega * temp) * decay;
      if (Math.abs(y - yt) < .05 && Math.abs(vy) < .5) { y = yt; vy = 0; }`,
      `      if (FEEL.on) {
        FEEL.step(silk, yt, dt, { x: y, v: vy }, { eps: .05, veps: .5 }); y = silk.x; vy = silk.v;
      } else {
      const omega = ocean ? ocean.omega(y) : 9.5, x = y - yt, decay = Math.exp(-omega * dt), temp = (vy + omega * x) * dt;
      y = yt + (x + temp) * decay; vy = (vy - omega * temp) * decay;
      if (Math.abs(y - yt) < .05 && Math.abs(vy) < .5) { y = yt; vy = 0; }
      }`, 'world spring');
    w = once(w, '    if (px < 0 && yt <= 0 && y < 2) { close(); return false; }', '    if (px < 0 && yt <= 0 && y < FEEL.topTol()) { close(); return false; }', 'world top');
    return w;
  });
  if (typeof world === 'string') files['finnovation-world.js'] = world;

  /* ---------------------------------------------------------------- flow-fix's slider copy (only if that helper already ran) */
  if (typeof extra['portfolio-slider-flow.js'] === 'string') extra['portfolio-slider-flow.js'] = soft('slider', extra['portfolio-slider-flow.js'], s => {
    s = once(s, '    const t = Math.max(0, Math.min(.05, dt)), omega = 12;', "    const t = Math.max(0, Math.min(.05, dt)), omega = FEEL.on ? FEEL.eff().omega2 : 12;", 'slider omega');
    return "import { FEEL } from './smooth-input.js';\n" + s;
  });

  if (extra['portfolio-slider-flow.js'] !== undefined && typeof extra['portfolio-slider-flow.js'] === 'string' && files['portfolio-slider-flow.js'] === undefined) files['portfolio-slider-flow.js'] = extra['portfolio-slider-flow.js'];
  if (skipped.length) files['smooth-input.js'] = files['smooth-input.js'].replace('/*FEEL_SKIPPED*/[]/*/FEEL_SKIPPED*/', JSON.stringify(skipped));
  return { main, drops, letters, glass, html, extra: files };
};
