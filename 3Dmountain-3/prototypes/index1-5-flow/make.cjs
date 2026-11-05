/* FLOW test page (2026-11-04): index1-5 with the client's new section order. Run after every index1-5 build:
     node prototypes/index1-5-flow/make.cjs
   Client: 「我區塊順序要調整一下，這塊滾下去要接這塊」, then 「不要山谷俯視了」 and 「我的轉場要原本那個網格」: 06 → 07 is the ORIGINAL 06 → cards
   transition of the live page (applyBridgeView + bridgeMosaic on CONFIG.mist: the same function, clock, follow and ten notches), with the sea
   where the cards used to arrive.
   Order: 01–06 journey → 07 INVESTMENT STRATEGIES (the sea, straight after 06) → 08 PORTFOLIO (the cards, up out of the sea's mist)
          → 09 GLOBAL REACH (clouds → planet, as before) → 10 PRINCIPLES → 11 CONTACT.
   Reads the live build (index1-5.html and prototypes/index1-5/js/{main, finnovation-world, world-ocean, world-dive-fx, chapter-flow}.js) and never
   writes to it. Writes prototypes/index1-5-flow/js/ (patched copies of those five) and index1-5-flow.html. Every other module, asset and
   stylesheet is the live one, so the test page tracks the live page. Remove: delete prototypes/index1-5-flow/ and index1-5-flow.html.
   The world gets two legs (finnovation-world.js): 'sea' = the strategies, entered from the journey's end, under the cards (z 5);
   'sky' = after the cards, the sea folded away (flow.css), the planet followed by the principles. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), LIVE = path.join(ROOT, 'prototypes/index1-5/js'), OUT = path.join(__dirname, 'js');
const version = 'flow-' + Date.now().toString(36);
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
function once(s, a, b, label) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw Error(`flow anchor (${label}): ${n} matches`);
  return s.replace(a, () => b);
}
function all(s, a, b, count, label) {
  const n = s.split(a).length - 1;
  if (n !== count) throw Error(`flow anchor (${label}): ${n} matches, expected ${count}`);
  return s.split(a).join(b);
}
const COPIED = ['main.js', 'finnovation-world.js', 'world-ocean.js', 'world-dive-fx.js', 'chapter-flow.js', 'world-logo.js', 'world-principles.js'];
const LOCAL = new Set([...COPIED, 'transition-details.js']);
const { patchFlow, patchButtons } = require('./motion-polish-build.cjs');
const lookPreset = JSON.parse(partJSON());
function partJSON() { return read(path.join(__dirname, 'look-preset.json')); }
/* The copies sit in prototypes/index1-5-flow/js/, so every './x.js' they name moves to '../../index1-5/js/x.js' (the live folder, from either js
   folder: main passes sliderUrl as a string and the live portfolio module imports it). */
const rewire = s => s
  .replace(/(from\s+|import\(\s*|sliderUrl:\s*)'\.\/([\w.-]+\.js)(\?[^']*)?'/g, (m, lead, file, query) =>
    LOCAL.has(file) ? `${lead}'./${file}?v=${version}'` : `${lead}'../../index1-5/js/${file}${query || ''}'`)
  .replace(/new URL\('\.\.\/assets\//g, "new URL('../../index1-5/assets/");
const leftover = (name, s) => { const m = s.match(/(?:from\s+|import\(\s*)'\.\/(?![\w.-]+\.js\?v=flow-)[^']+'/); if (m) throw Error(`${name}: unrewired ${m[0]}`); };
const part = name => read(path.join(__dirname, name));

/* Projected strategy labels keep their existing placement algorithm. */
let alpineUI = part('../index1-5/alpine-ui.js');
alpineUI = once(alpineUI, "  makePin('peak', { id: 'confluence', name: 'CONFLUENCE', num: '恒灝創新', at: { x: main.x, y: 0, z: zc }, maxLead: 54, phone: true });", '', 'remove central confluence annotation');
alpineUI = require('./strategy-labels-build.cjs').patchAlpine(alpineUI);

/* ============================================================== main.js */
let main = read(path.join(LIVE, 'main.js'));
main = "import { paintJourneyTransition } from './transition-details.js';\n" + main;
/* Keep the supplied opening palette editable while the existing sun clock
   still controls lighting. Otherwise setSceneTime overwrites these swatches. */
main = once(main, 'getSceneDaylight, setSceneTime, suppressSceneDaylight', 'getSceneDaylight, setSceneTime as setTimedSceneLight, suppressSceneDaylight', 'flow palette clock import');
main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      var flowFieldOverride = { ...CONFIG.field };
      function setSceneTime(hour) {
        if (flowFieldOverride) Object.assign(flowFieldOverride, CONFIG.field);
        const light = setTimedSceneLight(hour);
        if (flowFieldOverride) Object.assign(CONFIG.field, flowFieldOverride);
        return light;
      }
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'flow palette clock');
const lookCode = Object.entries(lookPreset).map(([group, values]) => '      Object.assign(CONFIG[' + JSON.stringify(group) + '] ||= {}, ' + JSON.stringify(values) + ');').join('\n');
main = once(main, '      configureSceneDaylight(CONFIG);', '      /* FLOW: capture the daylight reset palette after the complete client preset. */', 'flow daylight defaults');
main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* FLOW_LOOK_PRESET: complete client-exported initial settings. */
${lookCode}
      /* Keep the supplied desktop framing and the existing portrait adaptation. */
      Object.assign(FRAME_TIERS.wide, { fov: CONFIG.camera.fov, ty: CONFIG.camera.ty, dropY: CONFIG.drop.y });
      if (frameTier() !== 'wide') applyFrameTier(true);
      configureSceneDaylight(CONFIG);
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'flow look preset');
/* The model workshop is mounted later; its reset must use this page's preset too. */
if (lookPreset.logoModel) {
  const modelDefaults = main.match(/^      DEFAULT_CONFIG\.logoModel = .*;$/m)?.[0];
  if (!modelDefaults) throw Error('flow anchor (model defaults): missing');
  main = once(main, modelDefaults, '      DEFAULT_CONFIG.logoModel = JSON.parse(JSON.stringify(CONFIG.logoModel));', 'flow model reset');
}
main = once(main, '        const time = sceneTime;\n', '        const time = sceneTime;\n        paintJourneyTransition({ reduced: reduceMotion, worldOpen: !!world?.open, drop: dropTransition.progress, flight: logoFlight.t, mix: journey.mix });\n', 'flow journey optics');
main = once(main, '      let portfolioNavPending = false;\n', part('main-flow.part.js') + '      let portfolioNavPending = false;\n', 'main seaFlow');
/* the wheel: the world, then the 06 → 07 bridge, then the cards — and the cards only come up out of the sea once the bridge is over (or are already up) */
main = once(main, 'if (world?.take(delta, source, target)) return; if (portfolio?.take(delta)) return;',
  'if (world?.take(delta, source, target)) return; if (seaFlow.take(delta)) return; if ((portfolio?.open || (world?.open && !(world.seaLeg && seaFlow.target < 1))) && portfolio?.take(delta)) return;', 'main wheel');
main = once(main, '        if (worldEpilogue && portfolio?.bridge && !reduceMotion) applyBridgeView(portfolio.transition);\n',
  '        seaFlow.frame(flightDelta);   /* SEA_FLOW: 06 → 07 is the cards\'s own bridge (same view, same clock), the sea where the cards were */\n        if (worldEpilogue && !reduceMotion) applyBridgeView(Math.max(portfolio?.bridge ? portfolio.transition : 0, seaFlow.amount));\n', 'main bridge call');
main = once(main, "progress: worldEpilogue && portfolio?.bridge ? portfolio.transition || 0 : 0, velocity: null",
  "progress: Math.max(worldEpilogue && portfolio?.bridge ? portfolio.transition || 0 : 0, seaFlow.mosaic), velocity: null", 'main mosaic');
main = once(main, 'THREE.MathUtils.clamp(portfolio?.transition || 0, 0, 1));', 'THREE.MathUtils.clamp(Math.max(seaFlow.amount, portfolio?.transition || 0), 0, 1));', 'main surge');
main = all(main, 'if (world?.open && !portfolio?.open) world.close();', 'if (world?.open && !portfolio?.open && !world.seaLeg) world.close();', 2, 'main world close');
/* the valley keeps its daylight until the sea covers it (then, as before, the world's frame has the site's sun off) */
main = all(main, 'suppressSceneDaylight(!!world?.open && CONFIG.sceneDaylight.worldOff > .5);', 'suppressSceneDaylight(!!world?.open && !(world.seaLeg && !world.covering) && CONFIG.sceneDaylight.worldOff > .5);', 2, 'main daylight');
main = all(main, 'if (world?.open) setSceneTime(getSceneDaylight().hour);', 'if (world?.open && !(world.seaLeg && !world.covering)) setSceneTime(getSceneDaylight().hour);', 2, 'main daylight hour');
/* a chapter link or NEXT past 06 goes over the valley into the sea, not into the cards */
main = once(main, 'if (p <= journey.max + .001 && (portfolio?.open || world?.open)) { world?.close(); portfolio?.close(); }',
  'if (p <= journey.max + .001 && (portfolio?.open || world?.open || seaFlow.open)) { world?.close(); portfolio?.close(); seaFlow.close(); }', 'main navigate');
main = once(main, '          else if (journeyReady && portfolio?.ready && J.progress > J.max - .08 && !journeyUI.menuOpen) {', '          else if (journeyReady && J.progress > J.max - .08 && !journeyUI.menuOpen) {', 'main nav pending');
main = once(main, '            portfolio.take(portfolio.bridge ? distance : .4);\n', '            void distance; seaFlow.navigate();   /* SEA_FLOW */\n', 'main nav take');
main = once(main, '        getPortfolio: () => portfolio, getWorld: () => world, loadWorld, warmEpilogue,',
  '        getPortfolio: () => portfolio, getWorld: () => world, loadWorld, warmEpilogue, getFlow: () => seaFlow,', 'main chapter flow');
main = once(main, `        const toGlobal = w => { if (!w.open) w.enter(0); w.scrollTo(w.state.at.global + innerHeight * .2); };
        if (world?.open) {
          event.preventDefault(); event.stopPropagation();
          if (!world.next()) document.querySelector('.finnovation-ui .fi-menu-links [data-chapter="0"]')?.click();`,
`        const toGlobal = w => { w.enter(0, 'sky'); w.scrollTo(w.state.at.global + innerHeight * .2); };   /* SEA_FLOW: the planet is on the world's 'sky' leg */
        if (world?.open && !(world.seaLeg && portfolio?.open)) {
          event.preventDefault(); event.stopPropagation();
          if (!world.next()) { if (world.seaLeg) chapterFlow.go(7); else document.querySelector('.finnovation-ui .fi-menu-links [data-chapter="0"]')?.click(); }`, 'main next');
main = once(main, 'window.__MONTIS_STUDY__ = { runtimeQuality,', 'window.__MONTIS_STUDY__ = { seaFlow, runtimeQuality,', 'main study');
main = once(main, 'world = module.mountWorld({ root:', 'world = module.mountWorld({ syncSceneTime: setSceneTime, root:', 'flow world palette clock');
main = rewire(main); leftover('main.js', main);

/* ============================================================== finnovation-world.js */
let world = read(path.join(LIVE, 'finnovation-world.js'));
world = require('./deep-water-build.cjs').patchWorld(world);
world = "import { paintWorldTransition, clearTransition } from './transition-details.js';\n" + world;
/* Route the world clock through the same palette guard when world daylight is enabled in the tuner. */
world = once(world, 'export function mountWorld({ root,', 'export function mountWorld({ syncSceneTime = setSceneTime, root,', 'world palette clock option');
world = once(world, '    setSceneTime(hour);', '    syncSceneTime(hour);', 'world palette clock call');
world = once(world, '  function close() {\n    if (!open) return;', '  function close() {\n    clearTransition();\n    if (!open) return;', 'flow optical cleanup');
world = once(world, '  let ownScrollWrite = false;\n', `  let ownScrollWrite = false;
  /* SEA_FLOW: which leg is open. 'sea': the four strategies straight after the journey (from the first strategy to the last), under the
     cards; 'sky': after the cards, the sea folded away (flow.css), from the clouds to the footer. */
  let leg = 'sky', seaOpacity = '', logoArmed = false, lastInputAt = 0;
  const legLo = () => leg === 'sea' ? (ocean ? ocean.stopY(0) : at.resp) : 0;   /* the sea leg opens on the first strategy (it arrives under the bridge) */
  const legHi = () => leg === 'sea' && ocean ? Math.min(maxY, ocean.stopY(ocean.N - 1)) : maxY;
  /* the 06 → 07 bridge (main.js seaFlow, window.__SEA_FLOW__): the sea leg is up from its first notch, faded in as the cards were in the
     original bridge, over the cards' mist window (CONFIG.mist start → end: .34 → .9), its words over the cards' words' (.66 → .92). Without the
     flow (a chapter jump, the way back from the cards) the sea is simply there. */
  const flowNow = () => window.__SEA_FLOW__;
  const flowAmount = () => { const F = flowNow(); return F && F.open ? F.amount : 1; };
  const flowHold = () => { const F = flowNow(); return !!(F && (F.open ? F.target < 1 : F.amount < 1)); };   /* the bridge is running (or playing back): the wheel is its */
  const seaIn = () => { const m = mist() || {}, a = Number.isFinite(+m.start) ? +m.start : .34, b = Number.isFinite(+m.end) ? +m.end : .9; return reducedMotion ? flowAmount() : smooth(a, Math.max(a + .02, b), flowAmount()); };
`, 'world state');
world = once(world, '  const sectionMotion = createWorldSectionMotion({ root, reducedMotion });\n', `  const sectionMotion = createWorldSectionMotion({ root, reducedMotion });
  /* SEA_FLOW: the LOGO lake's first build (~16 programs) began on the world's first frame; now that frame is the arrival from the valley, so it
     waits until the visitor rests on the sea, or the 'sky' leg opens (see frame). A page flag read by world-logo.js's near, not CONFIG, so the
     LOGO panel's copied settings never carry it. */
  window.__SEA_FLOW_LOGO_HOLD__ = true;
`, 'world logo hold');
world = once(world, '    yt = clamp(yt, 0, maxY); y = clamp(y, 0, maxY);\n  }', '    yt = clamp(yt, legLo(), legHi()); y = clamp(y, legLo(), legHi());\n  }', 'world measure clamp');
world = once(world, '    const o = ocean ? ocean.sample(yy) : null;\n', '    const o = ocean ? ocean.sample(yy) : null;\n    if (o && leg === \'sea\') { o.seaLeg = true; o.haze = clamp(epilogue()?.transition || 0); }   /* SEA_FLOW: how far the cards have come up over the sea */\n', 'world sample haze');
world = once(world, '    const recede = o ? 0 : smooth(', "    const recede = o && leg !== 'sky' ? 0 : smooth(", 'world recede');
world = once(world, `    pf?.setExit(s.exit);
    if (root.classList.contains('is-live') !== (s.c > .4)) root.classList.toggle('is-live', s.c > .4);`,
`    pf?.setExit(leg === 'sea' ? 0 : s.exit);
    /* SEA_FLOW: the cards have come up over the sea: the page is theirs (header colours, their words, the pointer) */
    const veiled = leg === 'sea' && (!!pf?.open && (pf.transition || 0) > .5 || flowAmount() < .9);
    if (leg === 'sea') {
      const hz = smooth(.04, .4, s.o?.haze || 0).toFixed(3); if (root.style.getPropertyValue('--sea-haze-out') !== hz) root.style.setProperty('--sea-haze-out', hz);
    }
    if (root.classList.contains('is-live') !== (s.c > .4 && !veiled)) root.classList.toggle('is-live', s.c > .4 && !veiled);`, 'world paint live');
world = once(world, '    const dark = s.c > .45 && s.footerTop > 70, light = s.footerTop < H * .5;\n    const key = `${s.c > .28}|${dark}|${light}`;',
  '    const dark = s.c > .45 && s.footerTop > 70 && !veiled, light = s.footerTop < H * .5;\n    const key = `${s.c > .28 && !veiled}|${dark}|${light}`;', 'world paint key');
world = once(world, "      document.body.classList.toggle('is-world', s.c > .28);", "      document.body.classList.toggle('is-world', s.c > .28 && !veiled);", 'world paint is-world');
world = once(world, '    if (!light.enabled) {\n      if (worldDaylightOn) {', "    if (!light.enabled || leg === 'sea') {   /* SEA_FLOW: the sea keeps the world's own look while the valley under it still has the sun */\n      if (worldDaylightOn) {", 'world daylight');
world = once(world, '    if (!renderer || !deck) build();   // whatever the free moments have not done yet\n    if (!renderer) return;\n', `    if (!renderer || !deck) build();   // whatever the free moments have not done yet
    if (!renderer) return;
    if (leg === 'sea') {   /* SEA_FLOW: nothing to draw once the cards cover the sea; over the valley it comes in as the cards did */
      const pf = epilogue();
      if (pf?.open && pf.covering) { if (shown) { shown = false; canvas.style.visibility = 'hidden'; } return; }
      const k = seaIn(), op = k >= .999 ? '' : k.toFixed(3);
      if (op !== seaOpacity) { seaOpacity = op; canvas.style.opacity = op; }
    }
`, 'world render sea');
world = once(world, '    const s = sample(y);\n    paintPage(s);\n', `    const s = sample(y);
    paintPage(s);
    paintWorldTransition({ s, leg, flow: flowNow(), cards: epilogue(), reduced: reducedMotion });
    if (!logoArmed && (leg === 'sky' || (flowAmount() >= .999 && Math.abs(y - yt) < 1 && now - lastInputAt > 1000))) {
      logoArmed = true; window.__SEA_FLOW_LOGO_HOLD__ = false;
    }
`, 'world logo arm');
world = once(world, '    if (!open) return false;\n    if (px < 0 && yt <= 0 && y < 24) { close(); return false; }', `    if (!open) return false;
    lastInputAt = performance.now();
    if (leg === 'sea' && flowHold()) return false;   /* SEA_FLOW: the 06 → 07 bridge is still running: its clock takes the wheel */
    const lo = legLo(), hi = legHi();
    /* SEA_FLOW: up at the first strategy: the bridge plays back (main.js seaFlow closes the world at its start); up past the planet's top: the
       cards again, with the sea under them */
    if (px < 0 && yt <= lo + .5 && y < lo + 24) { if (leg === 'sky' && ocean && epilogue()?.open) { enter(0, 'sea', Infinity); flowNow()?.settle?.(); } else if (leg !== 'sea') close(); return false; }
    /* past the last strategy the cards take the wheel */
    if (px > 0 && leg === 'sea' && yt >= hi - .5) return false;`, 'world scroll ends');
world = once(world, '    yt = clamp(yt + px, 0, maxY);', '    yt = clamp(yt + px, lo, hi);', 'world scroll clamp');
world = once(world, '    jump(value) { if (!open) enter(); y = yt = clamp(value, 0, maxY); vy = 0; run(); },',
  "    jump(value, which) { if (!open || (which && which !== leg)) enter(0, which || 'sky'); y = yt = clamp(value === Infinity ? legHi() : value, legLo(), legHi()); vy = 0; run(); },", 'world jump');
world = once(world, '    get covering() { return open && y >= at.clouds * .4; },', "    get covering() { return open && (leg === 'sea' ? flowAmount() >= .999 && !flowHold() : y >= at.clouds * .4); },", 'world covering');
world = once(world, '      if (!open || !Number.isFinite(delta)) return false;\n      const pixels', "      if (!open || !Number.isFinite(delta)) return false;\n      if (leg === 'sea' && epilogue()?.open) return false;   /* SEA_FLOW: the cards are up (or coming up) over the sea: they take the wheel */\n      const pixels", 'world take');
world = once(world, `    next() { if (!open) return false; const stops = [at.global + H * .2, ...(ocean ? Array.from({ length: ocean.N }, (_, k) => ocean.stopY(k)) : [at.resp + H * .3]), ...(principles ? [principles.stopY()] : []), ...(logo ? [logo.stopY()] : []), maxY].sort((a, b) => a - b); const t = stops.find(v => v > Math.max(y, yt) + 40); if (t === undefined) return false; yt = clamp(t, 0, maxY); run(); return true; },`,
  `    next() { if (!open) return false; const stops = (leg === 'sea' && ocean ? Array.from({ length: ocean.N }, (_, k) => ocean.stopY(k)) : [at.global + H * .2, ...(ocean ? [] : [at.resp + H * .3]), ...(principles ? [principles.stopY()] : []), ...(logo ? [logo.stopY()] : []), maxY]).sort((a, b) => a - b); const t = stops.find(v => v > Math.max(y, yt) + 40); if (t === undefined) return false; yt = clamp(t, legLo(), legHi()); run(); return true; },   /* SEA_FLOW: each leg its own stops */`, 'world next');
world = once(world, '    get state() { return { y, yt, maxY, at: { ...at },', "    get state() { return { leg: open ? leg : '', y, yt, maxY, at: { ...at },", 'world state report');
world = once(world, '    /* CHAPTER_FLOW */ targetOf: name => clamp(target(name), 0, maxY), get at() { return at; }, get y() { return y; },',
  "    /* CHAPTER_FLOW */ targetOf: name => clamp(target(name), 0, maxY), get at() { return at; }, get y() { return y; },\n    /* SEA_FLOW */ get leg() { return open ? leg : ''; }, get seaLeg() { return open && leg === 'sea'; }, get seaMin() { return ocean ? ocean.stopY(0) : at.resp; }, get seaMax() { return ocean ? Math.min(maxY, ocean.stopY(ocean.N - 1)) : maxY; },", 'world getters');
/* the city labels went with the sea's reframe; on the 'sky' leg the principles come straight after the planet, so they go as those arrive */
world = once(world, '    const show = earth.visible ? smooth(.72, 1, s.reveal) * (1 - smooth(.25, .7, s.recede)) * (1 - smooth(0, .3, s.o?.reframe ?? 0)) : 0;',
  '    const show = earth.visible ? smooth(.72, 1, s.reveal) * (1 - smooth(.25, .7, s.recede)) * (1 - smooth(0, .3, s.o?.reframe ?? 0)) * (1 - smooth(0, .25, s.principles?.enter ?? 0)) : 0;   /* SEA_FLOW */', 'world pins');
/* every other move inside the world stays on the open leg */
world = all(world, 'go: value => { yt = clamp(value, 0, maxY); run(); }', 'go: value => { yt = clamp(value, legLo(), legHi()); run(); }', 3, 'world go callbacks');
world = once(world, 'y = yt = clamp(viewport.scrollTop, 0, maxY);', 'y = yt = clamp(viewport.scrollTop, legLo(), legHi());', 'world adopt scroll');
world = once(world, 'yt = clamp(y + r.top - H * .45, 0, maxY);', 'yt = clamp(y + r.top - H * .45, legLo(), legHi());', 'world focus');
world = once(world, 'yt = clamp(yt + clamp(v * .33, -H * 1.6, H * 1.6), 0, maxY);', 'yt = clamp(yt + clamp(v * .33, -H * 1.6, H * 1.6), legLo(), legHi());', 'world fling');
world = once(world, 'yt = clamp(target(go.dataset.worldGo), 0, maxY);', 'yt = clamp(target(go.dataset.worldGo), legLo(), legHi());', 'world go click');
world = once(world, 'yt = clamp(value === Infinity ? maxY : value, 0, maxY);', 'yt = clamp(value === Infinity ? legHi() : value, legLo(), legHi());', 'world scrollTo');
world = once(world, `  function enter(delta = 0) {
    if (disposed) return;
    if (!open) {
      open = true; y = yt = vy = 0; written = -1; revealAll();
      measure();
      viewport.scrollTop = 0;
      root.classList.add('is-open'); root.inert = false; root.setAttribute('aria-hidden', 'false');
      refreshTriggers();
    }`, `  /* SEA_FLOW: which = the leg to open ('sky' from the cards, as before; 'sea' from the journey's end); start = the y to open at (default the
     leg's first; Infinity its last). Opening the other leg closes this one first. */
  function enter(delta = 0, which = 'sky', start) {
    if (disposed) return;
    if (open && which !== leg) close();
    if (!open) {
      leg = which; root.classList.toggle('is-sea-leg', leg === 'sea'); root.classList.toggle('is-sky-leg', leg === 'sky');
      if (leg === 'sea') { const r = part('responsibility'); if (r) r.inert = false; }   /* (the principles make it inert on the way past) */
      seaOpacity = canvas.style.opacity = leg === 'sea' && flowNow()?.open ? '0' : '';   /* (remembered, so the first frame that shows it whole writes it) */
      open = true; y = yt = vy = 0; written = -1; revealAll();
      measure();
      y = yt = clamp(start === Infinity ? legHi() : start ?? legLo(), legLo(), legHi());
      viewport.scrollTop = y; written = y;
      root.classList.add('is-open'); root.inert = false; root.setAttribute('aria-hidden', 'false');
      refreshTriggers();
    }`, 'world enter');
world = once(world, '    open = false; cancelAnimationFrame(raf); raf = 0; samples = [];\n', "    open = false; cancelAnimationFrame(raf); raf = 0; samples = [];\n    root.classList.remove('is-sea-leg', 'is-sky-leg'); seaOpacity = ''; canvas.style.opacity = '';   /* SEA_FLOW */\n", 'world close');
world = once(world, "    await later('compile', () => (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera))).catch(() => { /* compiled on first use */ }));\n",
  "    await later('compile', () => (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera))).catch(() => { /* compiled on first use */ }));\n    await later('compile dive', () => diveFx.warm?.(renderer));   /* SEA_FLOW: the sea → cards panes, before the visitor gets there */\n", 'world dive warm');
world = rewire(world); leftover('finnovation-world.js', world);

/* ============================================================== world-ocean.js */
let ocean = read(path.join(LIVE, 'world-ocean.js'));
ocean = once(ocean, '  function sample(y) {\n    const t = (y - at.dive) / at.diveH;\n', `  function sample(y) {
    /* SEA_FLOW: on the world's 'sky' leg (after the cards) the sea is folded away: nothing of it shows */
    if (root.classList.contains('is-sky-leg')) { cur = { t: -9, h: 0, cam: 1, zoom: 1, reframe: 0, w: 0, push: 0, covered: false, alpha: 0, show: 0, deep: 0, panel0: 0, birds: 0, active: false, u: 0 }; return cur; }
    const t = (y - at.dive) / at.diveH;
`, 'ocean sky');
ocean = once(ocean, '    // the sideways travel eases in over the end of the dive', `    /* SEA_FLOW: on the 'sea' leg it comes straight from the valley (the 06 → 07 bridge): no planet, no wave, the sea already in place */
    if (root.classList.contains('is-sea-leg')) {
      o.w = 1; o.covered = true; o.show = 1; o.push = 0; o.reframe = 1; o.alpha = 1;
      /* the first strategy's words (and the reading scrim) come in as the cards' words did in the original bridge: .66 → .92 of it (section-motion plays its own entrance on panel0) */
      const F = window.__SEA_FLOW__;
      if (F && F.open) o.panel0 = smooth(.66, .92, F.amount);
      if (F && F.open && !reducedMotion) {
        /* the sea zooms in as it comes in (client: 「網格轉場後橫移進場背景的俯視要zoom in進場」): the ocean's own entrance, the camera settling from DEPTH
           onto the water (the dive's mix(depth, 1, smooth)), on the bridge's clock from the moment the sea starts to show (.34) to its end */
        const depth = num('depth', 1.5, 14); o.cam = mix(depth, 1, smooth(.34, 1, F.amount)); o.zoom = depth / o.cam;
      }
    }
    // the sideways travel eases in over the end of the dive`, 'ocean sea');
ocean = all(ocean, '    const light = getSceneDaylight();\n    if (light.enabled) {', "    const light = getSceneDaylight();\n    if (light.enabled && !root.classList.contains('is-sea-leg')) {   /* SEA_FLOW: the sea keeps its own look while the valley under it still has the sun */", 2, 'ocean daylight');
/* the island atlases (two mipmapped uploads) and the strategy photos came in as the planet turned; now the sea's first frame is the arrival
   from the valley, so they come once the sea is prepared (behind the entry gate, or a quiet moment) */
ocean = once(ocean, '      baked=true;\n    })()', '      baked=true;\n      (window.requestIdleCallback || (fn => setTimeout(fn, 200)))(() => { if (!oceanDisposed) { islands?.load(); loadPhotos(); } }, { timeout: 3000 });   /* SEA_FLOW */\n    })()', 'ocean preload');
ocean = rewire(ocean); leftover('world-ocean.js', ocean);

/* ============================================================== world-dive-fx.js */
let dive = read(path.join(LIVE, 'world-dive-fx.js'));
dive = once(dive, '  float mw = uD.x * e * (0.2 + 0.8 * exp(-pow(sd / (bw * 2.4), 2.0)));',
  '  float mw = uD.x * e * max(0.2 + 0.8 * exp(-pow(sd / (bw * 2.4), 2.0)), uE.z);   // SEA_FLOW: uE.z = panes all over the frame (no front)', 'dive panes');
dive = once(dive, '  col = mix(col, uFog * (0.9 + 0.22 * fb), clamp(fogD, 0.0, 0.97));\n',
  '  col = mix(col, uFog * (0.9 + 0.22 * fb), clamp(fogD, 0.0, 0.97));\n  col = mix(col, uFog * (0.94 + 0.16 * fb), clamp(uE.w * (1.0 + 0.5 * (fb - 0.5)), 0.0, 1.0));   // SEA_FLOW: an even haze, rolling a little\n', 'dive haze');
dive = once(dive, '    state.e = e;\n    if (e < .002) return;', `    /* SEA_FLOW: the world's 'sea' leg, leaving for the cards (07 → 08): the sea thickens into the cards' ground with the panes over it. No front,
       no glitch, no chill. */
    let all = 0, haze = 0, hazeCol = null;
    if (o?.seaLeg) {
      const hz = o.haze || 0;
      e = smooth(0, .35, hz) * (1 - smooth(.62, .96, hz)); deck = 0; all = 1;
      haze = smooth(.05, .8, hz);
      hazeCol = document.querySelector('.fi-portfolio')?.dataset.ground || 'rgb(204,217,230)';
    }
    state.e = e;
    if (e < .002 && haze < .002) return;`, 'dive sea');
dive = once(dive, "u.uFront.value.set(dx, dy, deck ? 99 : F,", "u.uFront.value.set(dx, dy, deck || all ? 99 : F,", 'dive front');
dive = once(dive, "u.uA.value.set(Math.min(e, 1), deck ? 0 : num(C, 'fog', D.fog, 0, 1.5), deck ? 0 : num(C, 'glitch', D.glitch, 0, 2) * Math.min(1, e),",
  "u.uA.value.set(Math.min(e, 1), deck || all ? 0 : num(C, 'fog', D.fog, 0, 1.5), deck || all ? 0 : num(C, 'glitch', D.glitch, 0, 2) * Math.min(1, e),", 'dive fog glitch');
dive = once(dive, "u.uE.value.set(num(C, 'mosaicSeam', D.mosaicSeam, 0, 2), .6, 0, 0);", "u.uE.value.set(num(C, 'mosaicSeam', D.mosaicSeam, 0, 2), .6, all, haze);", 'dive uE');
dive = once(dive, "u.uC.value.set(deck ? 0 : num(C, 'cold', D.cold, 0, 1),", "u.uC.value.set(deck || all ? 0 : num(C, 'cold', D.cold, 0, 1),", 'dive cold');
dive = once(dive, "    renderer.render(scene, camera);\n    state.drawn++;", "    if (hazeCol) u.uFog.value.setStyle(hazeCol, THREE.LinearSRGBColorSpace);\n    renderer.render(scene, camera);\n    state.drawn++;", 'dive haze colour');
dive = once(dive, '  return { render, dispose, state };', `  /* SEA_FLOW: compiled with the world (its ready chain, finnovation-world.js), not on its first draw: that draw is now the sea's first frame,
     and a program first used there cost a 110 ms frame (getProgramInfoLog) */
  function warm(renderer) {
    if (state.warmed || reducedMotion || !renderer) return Promise.resolve();
    state.warmed = true; if (!mat) build();
    return (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera))).catch(() => { });
  }
  return { render, dispose, state, warm };`, 'dive warm');
dive = rewire(dive); leftover('world-dive-fx.js', dive);

/* ============================================================== world-logo.js */
let logo = read(path.join(LIVE, 'world-logo.js'));
logo = once(logo, "      near: num('prepareEarly', 0, 1) > .5 || y > (at.resp > 0 ? at.resp : a.logo - H1 * 4.7) + H1 * num('prepare', 0, 6)",
  "      near: !window.__SEA_FLOW_LOGO_HOLD__ && (num('prepareEarly', 0, 1) > .5 || y > (at.resp > 0 ? at.resp : a.logo - H1 * 4.7) + H1 * num('prepare', 0, 6))   /* SEA_FLOW: held until the visitor rests on the sea (finnovation-world.js) */", 'logo hold');
logo = rewire(logo); leftover('world-logo.js', logo);

/* ============================================================== world-principles.js */
/* its program was compiled on its first draw (a 120–133 ms frame, on the live page too); now it compiles as the section is set up, screens before */
let principlesSrc = read(path.join(LIVE, 'world-principles.js'));
principlesSrc = once(principlesSrc, 'quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quad.frustumCulled=false;scene.add(quad);', 'quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quad.frustumCulled=false;scene.add(quad);renderer.compileAsync?.(scene,camera).catch(()=>{});   /* SEA_FLOW */', 'principles warm');
principlesSrc = rewire(principlesSrc); leftover('world-principles.js', principlesSrc);

/* ============================================================== chapter-flow.js */
let flow = read(path.join(LIVE, 'chapter-flow.js'));
flow = once(flow, `const EPILOGUE = [
  { en: 'PORTFOLIO', zh: '投資組合', realm: 'cards' },
  { en: 'GLOBAL REACH', zh: '善水長流', realm: 'world', part: 'global' },
  { en: 'INVESTMENT STRATEGIES', zh: '四大投資策略', realm: 'world', part: 'responsibility' },`, `/* SEA_FLOW (index1-5-flow test page): 07 the strategies over the sea (the world's 'sea' leg, straight after 06), 08 the cards (up out of the
   sea's mist), 09–11 the world's 'sky' leg (clouds → planet → principles → contact). */
const EPILOGUE = [
  { en: 'INVESTMENT STRATEGIES', zh: '四大投資策略', realm: 'sea', part: 'responsibility' },
  { en: 'PORTFOLIO', zh: '投資組合', realm: 'cards' },
  { en: 'GLOBAL REACH', zh: '善水長流', realm: 'world', part: 'global' },`, 'flow epilogue');
flow = once(flow, 'export function createChapterFlow({ ui, journey, getPortfolio, getWorld, loadWorld, warmEpilogue, toCards, reducedMotion = false }) {',
  'export function createChapterFlow({ ui, journey, getPortfolio, getWorld, loadWorld, warmEpilogue, toCards, getFlow = () => null, reducedMotion = false }) {', 'flow args');
flow = once(flow, "node.textContent.replace('BACK TO THE BEGINNING', 'VIEW PORTFOLIO')", "node.textContent.replace('BACK TO THE BEGINNING', 'VIEW STRATEGIES')", 'flow 06 next words');
flow = once(flow, '  fill(cloud, JOURNEY.length + 1);', '  fill(cloud, JOURNEY.length + 2);', 'flow cloud title');
flow = once(flow, `    if (W?.open) {
      const y = W.y, H = innerHeight, s = worldStart(W);
      if (y >= s.contact - H * .55) return 10;
      if (y >= s.principles - H * .5) return 9;
      if (y >= s.resp - H * .5) return 8;
      return 7;
    }
    if (P?.open && (P.transition ?? 0) > .5) return 6;`, `    if (W?.open && W.leg !== 'sea') {
      const y = W.y, H = innerHeight, s = worldStart(W);
      if (y >= s.contact - H * .55) return 10;
      if (y >= s.principles - H * .5) return 9;
      return 8;
    }
    if (P?.open && (P.transition ?? 0) > .5) return 7;
    if (W?.open) { const F = getFlow(); if (!(F?.open && F.amount < .5)) return 6; }`, 'flow current');
flow = once(flow, "i === 5 ? 'VIEW PORTFOLIO' : i === TOTAL - 1", "i === 5 ? 'VIEW STRATEGIES' : i === 6 ? 'VIEW PORTFOLIO' : i === TOTAL - 1", 'flow footer next');
flow = once(flow, `  async function cardsUp(instant) {
    toCards();
    if (instant) { journey.progress = journey.target; journey.velocity = 0; }
    await until(() => { const P = getPortfolio(); return P?.open && (P.transition ?? 0) > .985; }, 4000);
  }
  async function worldTo(part, instant) {
    let W = getWorld();
    if (!W) { await warmEpilogue?.(); W = getWorld() || await loadWorld?.(); }
    if (!W) return;
    const y = W.targetOf ? W.targetOf(part) : 0;
    if (instant) W.jump(y); else { if (!W.open) W.enter(0); W.scrollTo(y); }
  }`, `  /* SEA_FLOW: the sea is the world's 'sea' leg; the cards come up out of it; the planet and after are its 'sky' leg */
  async function theWorld() {
    let W = getWorld();
    if (!W) { await warmEpilogue?.(); W = getWorld() || await loadWorld?.(); }
    if (W) await Promise.race([W.ready, new Promise(r => setTimeout(r, 8000))]);
    return W;
  }
  const bridgeSpan = () => 10 * 100 / Math.max(720, innerHeight * .85);
  async function seaUp(instant, y) {
    if (!instant) { toCards(); return getWorld(); }   /* the journey runs to 06's end and the flow carries on over the valley into the sea (main.js) */
    const W = await theWorld(); if (!W) return null;
    getPortfolio()?.close(); getFlow()?.settle();
    journey.target = journey.progress = journey.max; journey.velocity = 0;
    /* open the leg first: its layout (the sea unfolded) is what the target is measured in */
    if (!(W.open && W.leg === 'sea')) W.enter(0, 'sea');
    W.jump(y ?? W.targetOf('responsibility'), 'sea');
    return W;
  }
  async function cardsUp(instant) {
    const W = instant ? await seaUp(true, Infinity) : getWorld(); if (!W) return;
    if (!instant) { W.scrollTo(Infinity); await until(() => W.y > W.seaMax - 6, 4000); }
    getPortfolio()?.take(bridgeSpan());
    await until(() => { const P = getPortfolio(); return P?.open && (P.transition ?? 0) > .985; }, 4000);
  }
  async function worldTo(part, instant) {
    const W = await theWorld(); if (!W) return;
    if (instant) { if (!(W.open && W.leg === 'sky')) W.enter(0, 'sky'); W.jump(W.targetOf(part), 'sky'); return; }   /* (the sea folded away first) */
    W.enter(0, 'sky'); W.scrollTo(W.targetOf(part));
  }`, 'flow routes');
flow = once(flow, `    const from = current(), far = veiled ?? Math.abs(to - from) >= 2;
    if (!far) {
      if (to < JOURNEY.length) { getWorld()?.close(); getPortfolio()?.close(); journeyTo(to, false); }
      else if (to === 6) { if (getWorld()?.open) getWorld().close(); else await cardsUp(false); }
      else await worldTo(EPILOGUE[to - JOURNEY.length].part, false);
      return;
    }`, `    /* next door the usual way (the journey's spring, the flow over the valley into the sea, the cards up out of the sea, the world's own
       scroll); everything else under the mist */
    const from = current(), J = JOURNEY.length, SEA = J, CARDS = J + 1;
    const nextDoor = (to < J && from < J && Math.abs(to - from) < 2) || (from === J - 1 && to === SEA) || (from === SEA && to === CARDS) || (from === CARDS && to === SEA) || (from === CARDS && to === CARDS + 1) || (from > CARDS && to > CARDS && Math.abs(to - from) < 2);
    const far = veiled ?? !nextDoor;
    if (!far) {
      if (to < J) { getWorld()?.close(); getPortfolio()?.close(); getFlow()?.close(); journeyTo(to, false); }
      else if (to === SEA) { if (from === CARDS) { getPortfolio()?.close(); getWorld()?.scrollTo(getWorld().targetOf('responsibility')); } else await seaUp(false); }
      else if (to === CARDS) await cardsUp(false);
      else await worldTo(EPILOGUE[to - J].part, false);
      return;
    }`, 'flow next door');
flow = once(flow, `      if (to < JOURNEY.length) { getWorld()?.close(); getPortfolio()?.close(); journeyTo(to, true); }
      else if (to === 6) { getWorld()?.close(); await cardsUp(true); }
      else { if (!getPortfolio()?.open) await cardsUp(true); await worldTo(EPILOGUE[to - JOURNEY.length].part, true); }`,
`      if (to < JOURNEY.length) { getWorld()?.close(); getPortfolio()?.close(); getFlow()?.close(true); journeyTo(to, true); }
      else if (to === SEA) await seaUp(true);
      else if (to === CARDS) await cardsUp(true);
      else { if (!getPortfolio()?.open) await cardsUp(true); await worldTo(EPILOGUE[to - JOURNEY.length].part, true); }`, 'flow far');
flow = once(flow, "  ui.addEventListener('fi:flow-next', () => go(6));", `  ui.addEventListener('fi:flow-next', () => go(6));
  /* SEA_FLOW: the last strategy's pill goes on to the cards (index1-5-flow.html: data-flow-go="7") */
  document.addEventListener('click', event => { const b = event.target.closest?.('[data-flow-go]'); if (!b) return; event.preventDefault(); event.stopPropagation(); go(Number(b.dataset.flowGo)); }, true);`, 'flow pill');
flow = once(flow, `      const f = Wd?.open ? (J + 1 + 4 * Math.min(1, Wd.y / Math.max(1, Wd.at.footer || 1))) / TOTAL : P?.open && (P.transition ?? 0) > .5 ? (J + Math.min(1, P.strip || 0)) / TOTAL : J * Math.min(1, journey.progress / Math.max(.001, journey.max)) / TOTAL;`,
`      const f = Wd?.open && Wd.leg !== 'sea' ? (J + 2 + 3 * Math.min(1, Wd.y / Math.max(1, Wd.at.footer || 1))) / TOTAL
        : P?.open && (P.transition ?? 0) > .5 ? (J + 1 + Math.min(1, P.strip || 0)) / TOTAL
        : Wd?.open ? (J + Math.min(1, Math.max(0, (Wd.y - Wd.seaMin) / Math.max(1, Wd.seaMax - Wd.seaMin)))) / TOTAL
        : J * Math.min(1, journey.progress / Math.max(.001, journey.max)) / TOTAL;`, 'flow footer line');
flow = once(flow, '    if (W?.open && !busy) {', "    if (W?.open && W.leg !== 'sea' && !busy) {", 'flow cloud only sky');
flow = patchFlow(flow);
flow = rewire(flow); leftover('chapter-flow.js', flow);

/* ============================================================== html (patched before anything is written: a missed anchor leaves the last build whole) */
main = require('./deep-water-build.cjs').patchGullControl(main);
ocean = require('./deep-water-build.cjs').patchOcean(ocean);
let html = read(path.join(ROOT, 'index1-5.html'));
const mainRef = /prototypes\/index1-5\/js\/main\.js\?v=[\w-]+/g, refs = html.match(mainRef) || [];
if (refs.length !== 2) throw Error(`flow anchor (html main refs): ${refs.length}`);
html = html.replace(mainRef, `prototypes/index1-5-flow/js/main.js?v=${version}`);
html = html.replace(/<title>/, '<title>［區塊順序測試］');
html = once(html, '<head>', '<head>\n  <meta name="robots" content="noindex">', 'html head');
html = once(html, '</head>', `  <link rel="stylesheet" href="prototypes/index1-5-flow/flow.css?v=${version}">\n  <link rel="stylesheet" href="prototypes/index1-5-flow/visual-polish.css?v=${version}">\n  <link rel="stylesheet" href="prototypes/index1-5-flow/transition-details.css?v=${version}">\n</head>`, 'html css');
html = once(html, '</head>', `  <link rel="stylesheet" href="prototypes/index1-5-flow/title-polish.css?v=${version}">\n  <link rel="stylesheet" href="prototypes/index1-5-flow/title-motion.css?v=${version}">\n  <link rel="stylesheet" href="prototypes/index1-5-flow/strategy-labels.css?v=${version}">\n  <script defer src="prototypes/index1-5-flow/title-motion.js?v=${version}"></script>\n</head>`, 'flow titles and labels');
const alpineScript = html.match(/prototypes\/index1-5\/alpine-ui\.js\?v=[\w-]+/)?.[0];
if (!alpineScript) throw Error('flow anchor (alpine script): missing');
html = once(html, alpineScript, `prototypes/index1-5-flow/js/alpine-ui.js?v=${version}`, 'flow alpine script');
html = html.replace(/prototypes\/index1-5\/button-glass\.js\?v=[\w-]+/g, `prototypes/index1-5-flow/js/button-glass.js?v=${version}`);
html = once(html, '<button type="button" class="fiwo-pill" data-world-go="contact"><span>CONTACT</span>', '<button type="button" class="fiwo-pill" data-flow-go="7"><span>VIEW PORTFOLIO</span>', 'html last pill');
/* the footer's (and the hidden world nav's) links to the strategies: they are chapter 07 on the sea now, not a place on the planet's side */
html = all(html, 'data-world-go="responsibility"', 'data-flow-go="6"', 3, 'html strategy links');

/* ============================================================== write */
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'alpine-ui.js'), alpineUI);
fs.writeFileSync(path.join(OUT, 'transition-details.js'), part('transition-details.js'));
fs.writeFileSync(path.join(OUT, 'button-glass.js'), patchButtons(read(path.join(ROOT, 'prototypes/index1-5/button-glass.js'))));
const banner = '/* index1-5 FLOW test, generated by prototypes/index1-5-flow/make.cjs from the live build. Do not edit. */\n';
for (const [name, source] of Object.entries({ 'main.js': main, 'finnovation-world.js': world, 'world-ocean.js': ocean, 'world-dive-fx.js': dive, 'chapter-flow.js': flow, 'world-logo.js': logo, 'world-principles.js': principlesSrc }))
  fs.writeFileSync(path.join(OUT, name), banner + source.replace(/^\/\* index1-5 generated by prototypes\/index1-5\/build\.cjs \*\/\n/, '').replace(/[ \t]+$/gm, '').trimEnd() + '\n');
html = require('../index1-5/startup-preload.cjs').addStartupPreloads(html, ROOT);
fs.writeFileSync(path.join(ROOT, 'index1-5-flow.html'), html);
console.log(`Built ${version}: index1-5-flow.html from the live ${refs[0].split('=')[1]}`);
