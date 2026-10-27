/* Applied last: one scene clock across opening, valley, cards, globe and ocean.
   Also usable on the current generated main for a scoped sync (no unrelated rebuild). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n');
function patchMain(main) {
  const once = (a, b) => { if (main.split(a).length !== 2) throw Error('daylight main anchor: ' + a.slice(0, 100)); main = main.replace(a, () => b); };
  once("    import * as THREE from 'three';", "    import * as THREE from 'three';\n    import { DAYLIGHT_DEFAULTS, DAYLIGHT_ROWS, configureSceneDaylight, getSceneDaylight, setSceneTime, journeySceneHour } from './scene-daylight.js';");
  once('      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      CONFIG.sceneDaylight = { ...DAYLIGHT_DEFAULTS };
      if (CONFIG.logoSeal) CONFIG.logoSeal.followDaylight = 1;
      configureSceneDaylight(CONFIG);
      setSceneTime(6.25);
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
  once("          ['開場世界 Opening', OPENING_WORLD_ROWS],", "          ['全站太陽／場景時間 Scene Time', DAYLIGHT_ROWS],\n          ['開場世界 Opening', OPENING_WORLD_ROWS],");
  once('uniforms: montisEnvUniforms, config: CONFIG, renderer, keyLight,', 'uniforms: montisEnvUniforms, config: CONFIG, renderer, palette: paletteLinear, keyLight,');
  once('      function glacierSun() {', `      function glacierSun() {
        if (getSceneDaylight().enabled) { glacierSunState.dir.copy(getSceneDaylight().sunDirection); glacierSunState.color = CONFIG.openingWorld.sunColor; return glacierSunState; }`);
  once("const isLogo = groupKey === 'uiGlass' ||", "const isLogo = groupKey === 'sceneDaylight' || groupKey === 'uiGlass' ||");
  once('        syncWorkshop = () => syncTunerValues();', daylightWorkshop()+'\n        syncWorkshop = () => syncTunerValues();');
  // The canyon plate must be captured in its handoff light, even if it is pre-warmed during dawn.
  once('openingPortal.render({ canyon, pose: openingPortalPose });', `{ const restoreHour = getSceneDaylight().hour; setSceneTime(10.2); openingPortal.render({ canyon, pose: openingPortalPose }); setSceneTime(restoreHour); }`);
  once('        updateJourneyCamera(time);', `        if (world?.open) setSceneTime(getSceneDaylight().hour);
        else setSceneTime(journeySceneHour({ progress: journey.progress, clock: journeyClock(journey.progress), logoStart: logoChapterStart(), logoEnd: logoChapterEnd(), max: journey.max, portfolio }));
        updateJourneyCamera(time);`);
  once('Math.min(CONFIG.scene.exposure * 1.34, CONFIG.scene.exposure * preDip * (1 + burst * DZ.exposure * lightMotion))', 'Math.min(CONFIG.scene.exposure * 1.15, CONFIG.scene.exposure * preDip * (1 + burst * DZ.exposure * lightMotion * .5)) * (getSceneDaylight().enabled ? getSceneDaylight().exposure : 1)');
  // Keep the reflection room in the same sun as the shadowed canyon. This is intentionally after the existing
  // authored water/light layout, whose syncRiverRoom otherwise reinstates a fixed studio sun every frame.
  once('        seaUniforms.uHaze.value.set(CONFIG.sea.haze * waterHazeScale, CONFIG.sea.hazeFar * waterHazeScale);', `        seaUniforms.uHaze.value.set(CONFIG.sea.haze * waterHazeScale, CONFIG.sea.hazeFar * waterHazeScale);
        if (getSceneDaylight().enabled) {
          const D = getSceneDaylight();
          for (const [key, name] of RIVER_ROOM_KEYS) paletteLinear(CONFIG.field[key], seaUniforms[name].value);
          seaUniforms.uEnvCoreDir.value.copy(D.sunDirection);
          seaUniforms.uEnvGlow.value.set(D.sunColor.r, D.sunColor.g, D.sunColor.b).multiplyScalar(.38 + D.intensity * .1);
        }`);
  return main;
}
module.exports = ({main,drops,letters,glass,html,extra={}}) => {
  main = patchMain(main);
  const css = read('daylight-ui.css'), hash = crypto.createHash('sha256').update(css).digest('hex').slice(0,12);
  const link = `<link rel="stylesheet" href="prototypes/index1-5-morning-20261026/daylight-ui.css?v=${hash}" data-scene-daylight>`;
  html = /<link[^>]+data-scene-daylight[^>]*>/.test(html) ? html.replace(/<link[^>]+data-scene-daylight[^>]*>/,link) : html.replace('</head>', '  '+link+'\n</head>');
  return {main,drops,letters,glass,html,extra:{'scene-daylight.js':read('scene-daylight.js')}};
};
module.exports.patchMain = patchMain;
function daylightWorkshop() { return `        /* DAYLIGHT_WORKSHOP: visible first, live numeric inputs and one-click time previews. */
        const daylightGroup = tunerBody.querySelector('[data-title="全站太陽／場景時間 Scene Time"]');
        if (daylightGroup) {
          const presets = document.createElement('div'); presets.className = 'tuner-actions daylight-presets';
          for (const [label, hour] of [['日出',6.25],['正午',12],['夕照',17.5],['藍調',19.5],['跟隨捲動',null]]) {
            const b = document.createElement('button'); b.type='button'; b.textContent=label;
            b.addEventListener('click',()=>{ CONFIG.sceneDaylight.enabled=1; CONFIG.sceneDaylight.auto=hour===null?1:0; if(hour!==null)CONFIG.sceneDaylight.hour=hour;
              for(const ref of sliderRefs) if(ref.groupKey==='sceneDaylight') { const v=CONFIG.sceneDaylight[ref.key]; ref.input.value=v; ref.value.value=Number(v).toFixed(ref.digits); }
            });
            presets.appendChild(b);
          }
          daylightGroup.insertBefore(presets,daylightGroup.children[1]); tunerBody.prepend(daylightGroup);
        }`; }
module.exports.daylightWorkshop = daylightWorkshop;
