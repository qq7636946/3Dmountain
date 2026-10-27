/* index1-5 · FOUR PATHS → cards (2026-10-23). Client: 到 FOUR PATHS 這段時候直接 webgl 3D 轉場接卡牌就好.
   The journey ends at STRATEGIES (FOUR PATHS ONE VISION); the four business chapters after it are dropped. Scrolling
   on (or the chapter's buttons) runs the WebGL bridge into the card strip: the aerial camera glides forward and down
   along the rivers, the river light quickens and brightens instead of stopping, the valley's own air thickens, and the
   cards fly in out of that depth (the card strip's 3D approach). Reversible by scrolling back.
   Applied by build.cjs after the other helpers; returns { main, ui } (ui = this page's copy of finnovation-interface). */
const fs = require('fs'), path = require('path');
module.exports = function ({ main }) {
  const once = (a, b, label) => { if (main.split(a).length !== 2) throw Error('cards-bridge anchor ' + label); main = main.replace(a, () => b); };
  once('const journeyBaseStops = [.52, 1.12, 2.12, 2.96, 4.8, 6.9, 8.95, 10.18, 10.99, 11.71, 12.43, 13.22, 13.8];',
    'const journeyBaseStops = [.52, 1.12, 2.12, 2.96, 4.8, 6.9, 8.95, 10.18];   /* index1-5: the journey ends at FOUR PATHS; the cards follow */', 'stops');
  once('J.max = 13.8 + journeyShift();', 'J.max = 10.18 + journeyShift();', 'max');
  // a chapter button / CTA past the end opens the cards through the bridge (same mechanism as index1-4)
  once('      const journeyUI = mountJourneyInterface({', '      let portfolioNavPending = false;\n      const journeyUI = mountJourneyInterface({', 'nav flag');
  once('skipEntry(); journey.velocity = 0; journey.target = THREE.MathUtils.clamp(p, 0, journey.max);',
    `/* a chapter link from the cards / the world closes them (STRATEGIES sits at the journey's end, so the epilogue's own "target < max − .3" test never fired for it) */
          if (p <= journey.max + .001 && (portfolio?.open || world?.open)) { world?.close(); portfolio?.close(); }
          skipEntry(); journey.velocity = 0; journey.target = THREE.MathUtils.clamp(p, 0, journey.max);
          portfolioNavPending = p > journey.max; if (portfolioNavPending) void loadPortfolio();`, 'navigate');
  once('journey.lastInput = performance.now(); if (world?.take(delta, source))',
    'if (delta !== 0) portfolioNavPending = false; journey.lastInput = performance.now(); if (world?.take(delta, source))', 'wheel cancels nav');
  // the cards module costs a 70–80 ms setup (displacement field, uploads, compiles): prepare it while the page rests
  // in the canyon (no input for 0.9 s, camera settled), not mid-rise toward FOUR PATHS
  once('if (!portfolioJob && CONFIG.portfolio.on > .5 && journeyReady && p > J.max - 3.2) loadPortfolio();',
    `if (!portfolioJob && CONFIG.portfolio.on > .5 && journeyReady && (p > J.max - 3.2 || p > 4.6 && performance.now() - (journey.lastInput || 0) > 900 && Math.abs(journey.target - journey.progress) < .002)) loadPortfolio();
        if (portfolioNavPending) {
          if (J.target < J.max - .001 || portfolio?.open || sceneStopped) portfolioNavPending = false;
          else if (journeyReady && portfolio?.ready && J.progress > J.max - .08 && !journeyUI.menuOpen) {
            portfolioNavPending = false;
            const m = CONFIG.mist || {}, steps = +m.steps, unit = 100 / Math.max(720, innerHeight * .85);
            const distance = Number.isFinite(steps) && steps >= 2 ? steps * unit : Number.isFinite(+m.length) && +m.length > .2 ? +m.length : 1.3;
            portfolio.take(portfolio.bridge ? distance : .4);
          }
        }`, 'nav run');
  // the river light runs on through the bridge: it quickens and brightens with the bridge's own clock
  once('CONFIG.watershedFlow._surge = flowSurge;',
    'CONFIG.watershedFlow._surge = Math.max(flowSurge * (+CONFIG.watershedFlow.scrollSurge || 0), THREE.MathUtils.clamp(portfolio?.transition || 0, 0, 1));', 'surge');
  // the bridge's look: a deeper, slower 3D approach; cards' ground = the alpine haze, not near-white
  once('      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',
    `      /* index1-5 cards bridge: longer forward glide, cards from deeper, the light surging through it (dials: 霧／卡牌過場) */
      Object.assign(CONFIG.mist, { push: .62, fog: 7, start: .34, end: .9, cards: .16, depth: 8, steps: 10, follow: 4.2, veil: .78 });
      Object.assign(CONFIG.watershedFlow, { surge: 1.1, scrollSurge: 0 });
      CONFIG.portfolio.base = [.80, .85, .90];
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'defaults');
  // dials for the bridge (tuner: ?tune=1 or T)
  once("          ['河流光線', [", `          ['卡牌轉場 Cards', [
            ['鏡頭前推', 'mist', 'push', 0, .8, .01], ['霧濃度', 'mist', 'fog', 0, 14, .1],
            ['起霧（進度）', 'mist', 'start', 0, .9, .01], ['霧滿（進度）', 'mist', 'end', .1, 1, .01],
            ['卡牌出現（進度）', 'mist', 'cards', 0, .9, .01], ['卡牌飛入深度', 'mist', 'depth', 0, 14, .1],
            ['過場長度（滾輪格數）', 'mist', 'steps', 2, 20, 1], ['跟隨柔順', 'mist', 'follow', .5, 10, .1],
            ['山谷退場', 'mist', 'veil', .1, 1, .01], ['光流加速', 'watershedFlow', 'surge', 0, 3, .05]
          ]],
          ['河流光線', [`, 'tuner rows');
  main = main.replace(/from '\.\/finnovation-interface\.js\?[^']*'/, "from './finnovation-interface.js'");
  if (!main.includes("from './finnovation-interface.js'")) throw Error('cards-bridge anchor interface import');

  // this page's copy of the interface: at FOUR PATHS the "next" goes on to the cards
  let ui = fs.readFileSync(path.resolve(__dirname, '../../js/finnovation-interface.js'), 'utf8').replace(/\r\n/g, '\n');
  const uiOnce = (a, b, label) => { if (ui.split(a).length !== 2) throw Error('cards-bridge ui anchor ' + label); ui = ui.replace(a, () => b); };
  uiOnce("nextLabel.textContent=id==='derivatives'?'BACK TO START':index===5?'NEXT STRATEGY':'NEXT CHAPTER';",
    "nextLabel.textContent=index===5?'VIEW PORTFOLIO':'NEXT CHAPTER';", 'next label');
  ui = '/* index1-5 copy of js/finnovation-interface.js (cards-bridge-build.cjs): FOUR PATHS hands over to the cards */\n' + ui;
  ui = require('./page-copy.cjs').patchInterface(ui);
  return { main, ui };
};
