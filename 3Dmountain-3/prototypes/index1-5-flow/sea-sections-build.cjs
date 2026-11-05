'use strict';
/* Restore the original Flow sea leg and its existing grid transitions.
   The five public sections remain: Why Us uses the ocean's four panels;
   Latest News owns the separate finite WebGL card strip. */
const fs = require('node:fs'), path = require('node:path');
const part = name => fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/\r\n/g, '\n');
function once(source, anchor, replacement, label) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) throw Error('Flow sea restoration (' + label + '): ' + count + ' anchors');
  return source.replace(anchor, () => replacement);
}
function all(source, anchor, replacement, expected, label) {
  const count = source.split(anchor).length - 1;
  if (count !== expected) throw Error('Flow sea restoration (' + label + '): ' + count + ' anchors');
  return source.split(anchor).join(replacement);
}

function restoreMain(main) {
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
          if (!world.next()) { if (world.seaLeg) chapterFlow.goSection(3); else document.querySelector('.finnovation-ui .fi-menu-links [data-chapter="0"]')?.click(); }`, 'main next');
main = once(main, 'window.__MONTIS_STUDY__ = { runtimeQuality,', 'window.__MONTIS_STUDY__ = { seaFlow, runtimeQuality,', 'main study');

return main;
}
function restoreWorld(world) {

  world = once(world,
    "  const ocean = document.documentElement.dataset.siteSections === 'five' ? null : createWorldOcean({",
    "  const ocean = createWorldOcean({", 'enable existing ocean');
  world = once(world,
    "  const logo = ocean ? createWorldLogo({",
    "  const logo = ocean && document.documentElement.dataset.siteSections !== 'five' ? createWorldLogo({", 'keep the hidden closing seal inactive');
  world = once(world,
    "    if (document.documentElement.dataset.siteSections === 'five') at.resp = at.block = at.footer;\n",
    "", 'restore ocean measurements');
  world = once(world,
    "photo: document.documentElement.dataset.siteSections === 'five' ? 0 : o ? o.show : smooth(",
    "photo: o ? o.show : smooth(", 'restore water imagery');
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

return world;
}
function restoreOcean(ocean) {
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

ocean = once(ocean, "progress.setAttribute('aria-label','四大投資策略')", "progress.setAttribute('aria-label','為何選擇我們')", 'ocean navigation label');
ocean = once(ocean, "make('span','fiwo-progress-label','INVESTMENT STRATEGIES')", "make('span','fiwo-progress-label','WHY FINNOVATION')", 'ocean section label');
ocean = once(ocean, "article.querySelector('.fiwo-sub').textContent", "article.querySelector('.fiwo-strategy-tagline').textContent", 'distinct ocean card labels');
return ocean;
}
function restoreDive(dive) {
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

return dive;
}
function restoreHTML(html) {
  html = html.replace('<html ', '<html data-flow-ocean-sections="separate" ');
  html = html.replace(/<section\b[^>]*\bid="responsibility"[^>]*>/, tag => tag.replace(/\s+hidden(?=\s|>)/g, ''));
  html = html.replace(/(<h2[^>]*id="fiwRespTitle"[^>]*>)[\s\S]*?(<\/h2>)/, '$1為何選擇我們 · Why FINNOVATION$2');
  const reasons = [
    ['RESEARCH', '深度研究，理解價值', '從資料、產業與市場脈絡出發，讓每一個判斷都有清晰的依據。', 'Deeper research for a clearer understanding of value.'],
    ['TECHNOLOGY', '以科技，拓展洞察', '連結資料分析與金融專業，將複雜訊號轉化為可驗證的投資思考。', 'Technology and financial expertise turn signals into insight.'],
    ['DISCIPLINE', '以紀律，面對變化', '持續檢視風險、假設與條件，在變動的市場中維持決策的一致性。', 'A disciplined approach to risk and changing markets.'],
    ['PARTNERSHIP', '以長期，陪伴成長', '讓知識、資本與企業彼此連結，從共同理解走向長期價值。', 'Long-term partnership built on shared understanding.']
  ];
  let count = 0;
  html = html.replace(/(<article\b[^>]*\bdata-strategy="(\d+)"[^>]*>)([\s\S]*?)(<\/article>)/g, (all, open, number, body, close) => {
    const reason = reasons[Number(number) - 1];
    if (!reason) throw Error('Unexpected ocean card ' + number);
    count++;
    body = body.replace(/(<p class="fiwo-kicker"[^>]*>[\s\S]*?<span>)[\s\S]*?(<\/span>)/, '$1' + number + ' / 04 · WHY FINNOVATION$2');
    body = body.replace(/(<p class="fiwo-sub"[^>]*>)[\s\S]*?(<\/p>)/, '$1為何選擇我們$2');
    body = body.replace(/<h3([^>]*class="[^"]*fiwo-strategy-title[^"]*"[^>]*)>[\s\S]*?<\/h3>/, (m, attrs) => '<h3' + attrs.replace(/aria-label="[^"]*"/, 'aria-label="' + reason[0] + '"') + '><span>' + reason[0] + '</span></h3>');
    for (const [cls, text] of [['fiwo-strategy-tagline', reason[1]], ['fiwo-strategy-body', reason[2]], ['fiwo-strategy-en', reason[3]]])
      body = body.replace(new RegExp('(<p class="' + cls + '"[^>]*>)[\\s\\S]*?(<\\/p>)'), '$1' + text + '$2');
    body = body.replace('<span>NEXT STRATEGY</span>', '<span>NEXT CARD</span>');
    if (Number(number) === 4) body = body.replace('data-world-go="contact"', 'data-section="3"').replace('<span>CONTACT</span>', '<span>LATEST NEWS</span>');
    return open + body + close;
  });
  if (count !== 4) throw Error('Flow requires all four original ocean cards, found ' + count);
  return html;
}
module.exports = { restoreMain, restoreWorld, restoreOcean, restoreDive, restoreHTML };
