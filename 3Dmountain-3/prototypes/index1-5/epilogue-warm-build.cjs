/* Local to index1-5 (2026-11-04). The cards and the world prepared ahead, so the bottom of the site is never white or stuck.
   Client: 「最底下看到空白跟卡住」「主要就是要先擋一下 讓他跑完 我裡面才會不卡跟太慢顯示」.
   Before: the cards module loaded only near the journey's end (p > max − 3.2) and the world only once the cards were up and the visitor
   rested 0.9 s; a visitor who kept scrolling waited on the last card (three notches kept, the rest dropped) while the globe was built.
   Now warmEpilogue() loads the cards (their slider compiled off screen: portfolio.ready) and then mounts the world (globe, ocean,
   textures uploaded and compiled: world.ready). The entry gate (index1-5-enter) calls it behind its cover; this page calls it itself
   once the journey is warm and the visitor has rested 2.5 s. The world's preparation steps still wait while the journey is moving
   (busy), so none of it lands on a scrolled frame; behind the gate's cover nothing is moving and it runs straight through.
   __MONTIS_STUDY__.warmEpilogue / .epilogueWarm (state for the gate's counter). */
const once = (source, anchor, replacement, label) => {
  if (source.split(anchor).length !== 2) throw Error('epilogue-warm anchor (' + label + '): ' + (source.split(anchor).length - 1));
  return source.replace(anchor, () => replacement);
};
function patchMain(main) {
  if (main.includes('/* EPILOGUE_WARM */')) return main;
  main = once(main, '      /* 地球還沒載好時，卡牌尾端的這一格滾輪先存下來（最多三格），載好後套用，不丟掉。 */', `      /* EPILOGUE_WARM: the cards, then the world, prepared ahead of the visitor (epilogue-warm-build.cjs) */
      const epilogueWarm = { started: 0, cards: 0, world: 0, done: 0 };
      let epilogueWarmJob = null;
      const settled = (test, ms) => new Promise(resolve => { const t0 = performance.now(); const look = () => test() || performance.now() - t0 > ms ? resolve(test()) : setTimeout(look, 80); look(); });
      const warmEpilogue = () => epilogueWarmJob ??= (async () => {
        epilogueWarm.started = performance.now();
        if (CONFIG.portfolio.on > .5) { await loadPortfolio(); await settled(() => !!portfolio?.ready, 30000); }
        epilogueWarm.cards = 1;
        if (worldEpilogue && portfolio) { const w = await loadWorld(); if (w) await Promise.race([w.ready, new Promise(resolve => setTimeout(resolve, 30000))]); }
        epilogueWarm.world = 1;
      })().catch(error => console.warn('Epilogue warm-up failed', error)).finally(() => { epilogueWarm.done = performance.now(); });
      /* 地球還沒載好時，卡牌尾端的這一格滾輪先存下來（最多三格），載好後套用，不丟掉。 */`, 'warm');
  /* the world's steps keep out of a moving journey too, except behind the gate's cover, where nothing moves */
  main = once(main, 'busy: () => /* BRIDGE_FLOW_MAIN */ !!portfolio?.open && portfolio.transition < .9 && performance.now() - (journey.lastInput || 0) < 1400 });',
    "busy: () => /* BRIDGE_FLOW_MAIN */ !!portfolio?.open && portfolio.transition < .9 && performance.now() - (journey.lastInput || 0) < 1400 || /* EPILOGUE_WARM */ !portfolio?.open && document.documentElement.dataset.gate !== 'hold' && performance.now() - (journey.lastInput || 0) < 900 });", 'busy');
  main = once(main, '        if (!portfolioJob && CONFIG.portfolio.on > .5 && journeyReady && (p > J.max - 3.2', `        if (!epilogueWarmJob && journeyReady && !/^(hold|ready)$/.test(document.documentElement.dataset.gate || '') && performance.now() - (journey.lastInput || 0) > 2500) void warmEpilogue();   /* EPILOGUE_WARM */
        if (!portfolioJob && CONFIG.portfolio.on > .5 && journeyReady && (p > J.max - 3.2`, 'auto');
  main = once(main, 'canyonMotion, forwardMosaic, bridgeMosaic, lightShafts, flashPulse,', 'canyonMotion, forwardMosaic, bridgeMosaic, lightShafts, flashPulse, warmEpilogue, epilogueWarm,', 'study');
  return main;
}
module.exports = state => ({ ...state, main: patchMain(state.main) });
module.exports.patchMain = patchMain;
