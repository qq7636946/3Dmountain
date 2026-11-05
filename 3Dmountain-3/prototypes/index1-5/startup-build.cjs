'use strict';
/* Startup scheduling only. Keep the authored scene, materials and scroll score.
   Applied after the terrain/performance transforms and inherited by Flow. */
function once(source, anchor, replacement) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) throw Error(`startup: expected one anchor (${count}): ${anchor.slice(0, 90)}`);
  return source.replace(anchor, () => replacement);
}

module.exports = state => {
  let main = state.main;
  main = once(main, '    async function startJourneyScene() {', `    async function startJourneyScene() {
      /* STARTUP_READINESS: milestones, not a guessed number of HTTP requests. */
      const startupState = window.__FINNOVATION_BOOT__ ||= { progress: 0, stage: 'modules', marks: {} };
      const setStartupStage = (stage, progress) => {
        startupState.marks[stage] ??= Math.round(performance.now());
        if (progress >= startupState.progress) { startupState.stage = stage; startupState.progress = progress; }
      };
      setStartupStage('modules-ready', .22);`);
  main = once(main, "    import { createJourneySceneAsync,", "    import { preloadIndex15Terrain } from './index1-5-terrain.js';\n    import { createJourneySceneAsync,");
  main = once(main, "      const DROPLET_LITE = matchMedia('(max-width: 720px), (pointer: coarse)').matches;", `      const DROPLET_LITE = matchMedia('(max-width: 720px), (pointer: coarse)').matches;
      /* Start the same cached maps while the opening objects are being built. */
      preloadIndex15Terrain(THREE, DROPLET_LITE).then(() => setStartupStage('textures-ready', .40)).catch(() => {});`);
  main = once(main, '      if (orbModelSkipped) assetsReady = true;', `      if (orbModelSkipped) { assetsReady = true; loaderNote.textContent = 'SCENE READY'; }
      setStartupStage('opening-built', .34);`);
  main = once(main, '      terrainBake.check?.(terrainKey());', "      setStartupStage('terrain-building', .44);\n      terrainBake.check?.(terrainKey());");
  main = once(main, '      if (sceneStopped) return;\n      canyon.scene.environment = scene.environment;', "      if (sceneStopped) return;\n      setStartupStage('terrain-ready', .66);\n      canyon.scene.environment = scene.environment;");

  // These variants are for later chapters. Compile them after the first frame,
  // along with the rest of the journey, instead of on the hero's critical path.
  const shafts = '      if (CONFIG.lightShafts.on > .5 && !reduceMotion && !(mobileRenderBudget.mobile && !(CONFIG.lightShafts.phone > .5))) lightShafts.warm();';
  main = once(main, shafts, '      /* Later-chapter shaders are prepared by prepareJourney(). */');
  main = once(main, '      canyonMotion.warm(renderer);', '      /* Canyon depth shader is warmed after the first hero frame. */');
  main = once(main, '      canyonMotes.warm(renderer, canyon.camera);', '      /* Canyon particle shader is warmed after the first hero frame. */');
  main = once(main, '      const yieldToBrowser = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));', `      const yieldToBrowser = () => {
        /* The opaque cover has its own animation. Preparation does not need
           a full animation frame for each letter/texture, especially in a
           background tab where animation-frame callbacks are throttled. */
        if (/^(boot|live)$/.test(window.__GATE__?.state || '')) {
          if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
          return new Promise(resolve => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
            channel.port2.postMessage(null);
          });
        }
        return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      };`);
  main = once(main, '      async function prepareJourney() {\n        if (sceneStopped) return;', `      async function prepareJourney() {
        if (sceneStopped) return;
        setStartupStage('letters-building', .76);`);
  main = once(main, '        const lettersBuilt = await (ensureLogoLetters() ?? (logoLetters.ready && logoLetters.source === logoMesh));', `        const lettersBuilt = await (ensureLogoLetters() ?? (logoLetters.ready && logoLetters.source === logoMesh));
        setStartupStage('letters-ready', .82);`);
  main = once(main, '          logoReady = true;', `          logoReady = true;
          setStartupStage('letters-compiled', .88);
          await yieldToBrowser();
    ${shafts.trim()}
          await yieldToBrowser(); canyonMotion.warm(renderer);
          await yieldToBrowser(); canyonMotes.warm(renderer, canyon.camera);
          setStartupStage('journey-compiling', .92);`);
  main = once(main, '        } finally { warmTarget.dispose(); journeyReady = true; }', "        } finally { warmTarget.dispose(); journeyReady = true; setStartupStage('journey-ready', 1); }");
  main = once(main, "            document.body.classList.add('is-ready');", "            document.body.classList.add('is-ready');\n            setStartupStage('hero-ready', .72);");

  // The opaque loader covers the hero during preparation. Keep its clocks,
  // physics and readiness work running, but leave GPU time for shader linking.
  // Reveal/ready/enter and direct previews all use the original full renderer.
  main = once(main, '        if (!manual && !firstFrame && !(portfolio?.covering || world?.covering) && journeyGovernor.sample(', `        const startupCovered = !manual && !firstFrame && !requestedPreview && /^(boot|live)$/.test(window.__GATE__?.state || '');
        if (!manual && !firstFrame && !startupCovered && !(portfolio?.covering || world?.covering) && journeyGovernor.sample(`);
  main = once(main, '        if ((portfolio?.covering || world?.covering) && !manual) { /* covered */ }', `        if (startupCovered) { startupState.parkedFrames = (startupState.parkedFrames || 0) + 1; }
        else if ((portfolio?.covering || world?.covering) && !manual) { /* covered */ }`);
  const extra = { ...state.extra };
  if (extra['finnovation-world.js']) {
    extra['finnovation-world.js'] = once(extra['finnovation-world.js'], `  const go = () => (window.requestIdleCallback || (f => setTimeout(f, 40)))(() => {
    if (busy?.()) { setTimeout(go, 120); return; }
    try { resolve(fn()); } catch (error) { reject(error); }
  }, { timeout: 1500 });`, `  const go = () => {
    const run = () => {
      if (busy?.()) { setTimeout(go, 120); return; }
      try { resolve(fn()); } catch (error) { reject(error); }
    };
    /* Keep the normal idle queue during scrolling; behind the entry gate,
       progress through one preparation task per browser turn. */
    if (/^(boot|live|reveal|ready|finishing)$/.test(window.__GATE__?.state || '')) {
      if (globalThis.scheduler?.yield) globalThis.scheduler.yield().then(run, reject);
      else {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); run(); };
        channel.port2.postMessage(null);
      }
    } else (window.requestIdleCallback || (f => setTimeout(f, 40)))(run, { timeout: 1500 });
  };`);
  }
  return { ...state, main, extra };
};
