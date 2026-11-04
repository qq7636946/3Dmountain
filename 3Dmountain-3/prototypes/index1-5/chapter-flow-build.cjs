/* Local to index1-5 (2026-11-04). Ships chapter-flow.js: one chapter index (01–11) through the journey, the cards and the world.
   Runs after epilogue-warm-build.cjs (it needs warmEpilogue). patchUI runs on the interface at the end of build.cjs.
   main:      creates the flow beside the loaders (it keeps its own clock: the page's frame stops short while the cards or the world cover the scene)
   world:     targetOf(name), at and y, read without building the whole state report
   interface: reports its chapter (data-journey-index), counts to 11, and hands 06's last NEXT to the flow instead of going back to 01 */
const fs = require('fs'), path = require('path');
const once = (source, anchor, replacement, label) => {
  if (source.split(anchor).length !== 2) throw Error('chapter-flow anchor (' + label + '): ' + (source.split(anchor).length - 1));
  return source.replace(anchor, () => replacement);
};
function patchMain(main) {
  if (main.includes('createChapterFlow')) return main;
  main = once(main, "    import * as THREE from 'three';", "    import * as THREE from 'three';\n    import { createChapterFlow } from './chapter-flow.js';", 'import');
  main = once(main, '      /* 地球還沒載好時，卡牌尾端的這一格滾輪先存下來（最多三格），載好後套用，不丟掉。 */', `      /* CHAPTER_FLOW: the rail, the menu and the footer count eleven chapters through the journey, the cards and the world (chapter-flow-build.cjs) */
      const chapterFlow = createChapterFlow({ ui: document.querySelector('.finnovation-ui'), journey, reducedMotion: reduceMotion,
        getPortfolio: () => portfolio, getWorld: () => world, loadWorld, warmEpilogue,
        /* the cards, the way a chapter link past the journey's end goes (navigate above) */
        toCards: () => { skipEntry(); journey.velocity = 0; journey.target = journey.max; portfolioNavPending = true; void loadPortfolio(); } });
      /* 地球還沒載好時，卡牌尾端的這一格滾輪先存下來（最多三格），載好後套用，不丟掉。 */`, 'create');
  main = once(main, 'warmEpilogue, epilogueWarm,', 'warmEpilogue, epilogueWarm, chapterFlow,', 'study');
  return main;
}
function patchWorld(world) {
  if (world.includes('/* CHAPTER_FLOW */')) return world;
  return once(world, '    scrollTo(value) { if (!open) return; yt = clamp(value === Infinity ? maxY : value, 0, maxY); run(); },',
    '    /* CHAPTER_FLOW */ targetOf: name => clamp(target(name), 0, maxY), get at() { return at; }, get y() { return y; },\n    scrollTo(value) { if (!open) return; yt = clamp(value === Infinity ? maxY : value, 0, maxY); run(); },', 'world api');
}
function patchUI(ui) {
  if (ui.includes('/* CHAPTER_FLOW */')) return ui;
  ui = once(ui, "currentLabel.textContent=chapters[index].en;total.textContent=`${String(index+1).padStart(2,'0')} / 06`;",
    "/* CHAPTER_FLOW */root.dataset.journeyIndex=String(index);currentLabel.textContent=chapters[index].en;total.textContent=`${String(index+1).padStart(2,'0')} / 11`;", 'index');
  /* the footer line is the flow's now (all eleven chapters); the interface no longer writes it */
  ui = once(ui, "if(key!==progressKey){progressKey=key;(progressBar||root).style.setProperty('--fi-progress',key);}", "if(key!==progressKey){progressKey=key;}", 'line');
  ui = once(ui, "if(copyId==='derivatives'){go(0);return;}", "if(copyId==='derivatives'){root.dispatchEvent(new CustomEvent('fi:flow-next'));return;}", 'next');
  return ui.replace("BACK TO THE BEGINNING", "VIEW PORTFOLIO");
}
module.exports = state => {
  const extra = { 'chapter-flow.js': fs.readFileSync(path.join(__dirname, 'chapter-flow.js'), 'utf8') };
  if (state.extra?.['finnovation-world.js']) extra['finnovation-world.js'] = patchWorld(state.extra['finnovation-world.js']);
  return { ...state, main: patchMain(state.main), extra };
};
module.exports.patchMain = patchMain;
module.exports.patchWorld = patchWorld;
module.exports.patchUI = patchUI;
