/* index1-5 only: the site-wide daylight stops when the cards hand over to the Earth (2026-10-24, client: 「卡牌到地球時候就關閉全站日照
   這個效果」). Applied after daylight-build.cjs / light-specks-build.cjs (it patches their output, not their sources).
   「全站日照」 = CONFIG.sceneDaylight (tuner 「全站太陽／場景時間 Scene Time」, `enabled`: 1 on / 0 the hand-set light).
   While the world (Earth → ocean → LOGO seal → footer) is open, a suppress flag makes setSceneTime() behave exactly as `enabled 0`:
   every consumer already reverts by itself (the Earth's sky/globe/deck back to LOOK, the ocean and lake to their own dials, the
   scene-clock widget hides, the sun back to the authored one). Scrolling back to the cards clears the flag and the same hour
   (a pure function of scroll) is restored, so nothing is stateful. The user's own 「全站日照」 value is never written.
   Dial: CONFIG.sceneDaylight.worldOff (1 = off at the Earth, 0 = keep it running through the Earth as before). */
module.exports = ({ main, drops, letters, glass, html, extra = {} }) => {
  const once = (source, anchor, replacement, label) => {
    const n = source.split(anchor).length - 1;
    if (n !== 1) throw new Error('index1-5 world-daylight-off anchor (' + label + '): ' + n + ' × ' + anchor.slice(0, 100));
    return source.replace(anchor, () => replacement);
  };
  if (typeof extra['scene-daylight.js'] !== 'string') throw new Error('index1-5 world-daylight-off: extra["scene-daylight.js"] missing (daylight-build must run first)');

  /* ---- scene-daylight.js: a suppress flag, its dial ---- */
  let sd = extra['scene-daylight.js'];
  sd = once(sd, 'warmth: 1, exposure: 1 });', 'warmth: 1, exposure: 1, worldOff: 1 });', 'defaults');
  sd = once(sd, "  ['開場／山谷 曝光倍率', 'sceneDaylight', 'exposure', .65, 1.3, .01]\n];", "  ['開場／山谷 曝光倍率', 'sceneDaylight', 'exposure', .65, 1.3, .01],\n  ['卡牌→地球 關閉全站日照（1 關／0 地球也照跑）', 'sceneDaylight', 'worldOff', 0, 1, 1]\n];", 'row');
  sd = once(sd, 'export function setSceneTime(requestedHour) {', `/* The world (Earth and after) asks for the daylight to rest: same state as "enabled 0", without touching the dial. */
let suppressed = false;
export function suppressSceneDaylight(flag) { suppressed = !!flag; }
export function setSceneTime(requestedHour) {`, 'flag');
  sd = once(sd, 'const on = P.enabled > .5;', 'const on = P.enabled > .5 && !suppressed;', 'on');

  /* ---- main: raise the flag while the world is open ---- */
  main = once(main, 'configureSceneDaylight, getSceneDaylight, setSceneTime, journeySceneHour }', 'configureSceneDaylight, getSceneDaylight, setSceneTime, suppressSceneDaylight, journeySceneHour }', 'import');
  main = once(main, '        if (world?.open) setSceneTime(getSceneDaylight().hour);', `        suppressSceneDaylight(!!world?.open && CONFIG.sceneDaylight.worldOff > .5);
        if (world?.open) setSceneTime(getSceneDaylight().hour);`, 'frame');

  return { main, drops, letters, glass, html, extra: { 'scene-daylight.js': sd } };
};
