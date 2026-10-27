/* index1-5 only: the first-person canyon camera (2026-10-24; audit B-17 whip, B-18 roll / altitude, B-19 blur).
   Patches the generated journey scene (water-journey-scene-463.js) and main.js; ships the local module canyon-racing.js
   (the maths — read its header for the cause and the design). Needs `journey` from build.cjs (see the loop there).

   Dials, tuner group 「峽谷鏡頭 Canyon」 (all live; canyonView.* are read every frame, the tables rebuild in ~1 ms when racing changes):
     canyonView.racing     彎道取直      0 = the old camera exactly, .7 = the new default (yaw ≤ ~64°/s, bend mean ≈ 43°/s), 1 = strongest
     canyonView.maxYaw     最大偏離角 °  how far the view may lag the river (relaxed automatically if the stops make it impossible)
     canyonView.rollBoost  側傾加成      × the old bank (±2°) — 2.5 ≈ ±4–5°; also scales the old formula when racing = 0
     canyonView.altWave    高度起伏      0 = fixed 2.4; 1 = up to +2.1 where the river opens, −0.4 where it narrows (never below 2.0)
     canyonMotion.lateralBlur 轉彎側向模糊  1 = unchanged, 0 = the blur / motes keep only the forward part of the camera's motion
   Flags: ?racing=0 → the old camera exactly (racing 0, rollBoost 1, altWave 0, lateralBlur 1); ?racing=.5 etc. sets racing only.
   Reduced motion: none of it applies (the scene's reduceMotion path is untouched). */
const fs = require('fs'), path = require('path');
/* defaults of the new look. DEV_DEFAULT = true keeps every default at the OLD camera (the dials and flags still exist, so the look can be
   tried with ?racing=.7 …); it is switched to false when the look is signed off. VALLEY_CAMERA_DEV=0|1 overrides it for a dry run. */
const DEFAULTS = { racing: .7, maxYaw: 45, rollBoost: 2.5, altWave: .6, lateralBlur: .5 };
const DEV_DEFAULT = false;
const DEV = process.env.VALLEY_CAMERA_DEV ? process.env.VALLEY_CAMERA_DEV === '1' : DEV_DEFAULT;
const once = (source, anchor, replacement, label) => {
  const n = source.split(anchor).length - 1;
  if (n !== 1) throw new Error('index1-5 valley-scene anchor (' + label + '): ' + n + ' × ' + anchor.slice(0, 100));
  return source.replace(anchor, () => replacement);
};
function patchJourney(journey) {
  if (journey.includes('/* CANYON_RACING */')) return journey;
  const D = DEV ? { racing: 0, maxYaw: DEFAULTS.maxYaw, rollBoost: 1, altWave: 0 } : DEFAULTS;
  journey = once(journey, '// Opt in per page; existing journey pages retain their original night palette.',
    "import { createCanyonRacing } from './canyon-racing.js';   // CANYON_RACING\n// Opt in per page; existing journey pages retain their original night palette.", 'import');
  journey = once(journey, '  bob: 1            // 起伏晃動：貼水前進時上下起伏的倍數',
    '  bob: 1,           // 起伏晃動：貼水前進時上下起伏的倍數\n' +
    `  racing: ${D.racing},        // 彎道取直（valley-scene-build.cjs）：0 = 舊鏡頭；越大，彎道裡的轉向速度上限越低（鏡頭可以略為落後河道）\n` +
    `  maxYaw: ${D.maxYaw},       // 最大偏離角（度）：視線最多落後河道方向多少度\n` +
    `  rollBoost: ${D.rollBoost},     // 側傾加成：舊側傾（±2°）的倍數\n` +
    `  altWave: ${D.altWave}        // 高度起伏：河道開闊處升高、狹窄處降低（0 = 固定高度）`, 'defaults');
  journey = once(journey, '  const pathLength = curve.getLength();',
    '  const pathLength = curve.getLength();\n' +
    '  /* 峽谷鏡頭 CANYON_RACING：取直後的轉向、側滑、側傾與高度，都是路線位置的純函數（往回捲完全對稱），表在 canyon-racing.js */\n' +
    '  const racingLine = createCanyonRacing({ length: pathLength, centre: s => { const p = curve.getPointAt(Math.min(1, s / pathLength)); return [p.x, p.z]; }, halfWidth: s => widthAt(Math.min(1, s / pathLength)) });\n' +
    '  const viewAxis = new THREE.Vector3();', 'pathLength');
  // the first-person branch of update(): roll, altitude, the corrected view direction, then the slid camera
  journey = once(journey, "      const bank = reduceMotion ? 0 : THREE.MathUtils.clamp(turn * .32, -.035, .035) * viewNumber('bank', 0, 4);",
    "      const ahead = viewNumber('lookAhead', 4, 160);\n" +
    "      const rc = reduceMotion ? null : racingLine.sample(t * pathLength, viewNumber('racing', 0, 1), ahead, viewNumber('maxYaw', 8, 90));\n" +
    "      const bank = reduceMotion ? 0 : (rc && rc.on ? rc.roll * .035 : THREE.MathUtils.clamp(turn * .32, -.035, .035)) * viewNumber('bank', 0, 4) * viewNumber('rollBoost', 0, 6);", 'bank');
  journey = once(journey, "      camera.position.y = viewNumber('height', .3, 40) + (reduceMotion ? 0 : (Math.sin(t * pathLength * .015) * .05 + Math.sin(t * pathLength * .007) * .035) * viewNumber('bob', 0, 6));\n      const ahead = viewNumber('lookAhead', 4, 160);\n",
    "      camera.position.y = viewNumber('height', .3, 40) + (reduceMotion ? 0 : (Math.sin(t * pathLength * .015) * .05 + Math.sin(t * pathLength * .007) * .035) * viewNumber('bob', 0, 6));\n" +
    "      // altitude wave: never lowers the camera below 2.0 (or below its own height if that is already lower)\n" +
    "      const altW = rc && rc.on ? rc.alt * viewNumber('altWave', 0, 2) : 0, altBase = camera.position.y;\n" +
    "      if (altW) camera.position.y = Math.max(Math.min(altBase, 2.0), altBase + altW);\n", 'height');
  journey = once(journey, "      look.y = viewNumber('lookHeight', -20, 60) + Math.tan(THREE.MathUtils.degToRad(viewNumber('pitch', -35, 35))) * ahead;\n      const lateral",
    "      look.y = viewNumber('lookHeight', -20, 60) + Math.tan(THREE.MathUtils.degToRad(viewNumber('pitch', -35, 35))) * ahead;\n" +
    "      if (rc && rc.on) {\n" +
    "        // the old chord (camera → look point) turned about the vertical by the yaw correction, hung on the camera after it slid toward the inside of the bend\n" +
    "        const cy = Math.cos(rc.yaw), sy = Math.sin(rc.yaw), dx = look.x - point.x, dz = look.z - point.z;\n" +
    "        camera.position.addScaledVector(right, rc.side);\n" +
    "        look.x = camera.position.x + dx * cy - dz * sy; look.z = camera.position.z + dz * cy + dx * sy;\n" +
    "        look.y += (camera.position.y - altBase) * .8;\n" +
    "      }\n" +
    "      const lateral", 'look');
  journey = once(journey, '      camera.position.addScaledVector(right, lateral); look.addScaledVector(right, lateral);',
    '      camera.position.addScaledVector(right, lateral); look.addScaledVector(right, lateral);\n' +
    '      if (rc && rc.on) { viewAxis.copy(look).sub(camera.position).normalize(); up.copy(worldUp).applyAxisAngle(viewAxis, bank); camera.up.copy(up); }   // roll about the view axis, not the river tangent', 'roll axis');
  return journey;
}
function patchMain(main) {
  if (main.includes('/* CANYON_RACING_MAIN */')) return main;
  const D = DEV ? { lateralBlur: 1 } : DEFAULTS;
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',
    '      /* CANYON_RACING_MAIN 峽谷鏡頭 Canyon（valley-scene-build.cjs）：?racing=0 = 舊鏡頭、?racing=.5 只改取直 */\n' +
    `      CONFIG.canyonMotion.lateralBlur = ${D.lateralBlur};\n` +
    "      { const rq = new URLSearchParams(location.search).get('racing'); if (rq !== null && rq.trim() !== '' && Number.isFinite(+rq)) { CONFIG.canyonView.racing = Math.max(0, Math.min(1, +rq)); if (+rq === 0) { Object.assign(CONFIG.canyonView, { rollBoost: 1, altWave: 0 }); CONFIG.canyonMotion.lateralBlur = 1; } } }\n" +
    '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', 'config + flag');
  main = once(main, "          ['LOGO 位置', [",
    "          ['峽谷鏡頭 Canyon', [\n" +
    "            ['彎道取直（0＝舊鏡頭）', 'canyonView', 'racing', 0, 1, .01],\n" +
    "            ['最大偏離角 °', 'canyonView', 'maxYaw', 8, 60, 1],\n" +
    "            ['側傾加成（× 彎道側傾）', 'canyonView', 'rollBoost', 0, 4, .05],\n" +
    "            ['高度起伏', 'canyonView', 'altWave', 0, 1.5, .05],\n" +
    "            ['轉彎側向模糊（1＝原樣）', 'canyonMotion', 'lateralBlur', 0, 1, .05]\n" +
    "          ]],\n" +
    "          ['LOGO 位置', [", 'tuner group');
  main = once(main, '      let flowSurge = 0, flowSurgeTime = null;',
    '      let flowSurge = 0, flowSurgeTime = null;\n      const latRight = new THREE.Vector3();', 'latRight');
  main = once(main, '        const speedCue = canyonMotion.measure({ camera: canyon.camera, amount: flowAmount, dt: flightDelta, reducedMotion: reduceMotion });',
    '        const speedCue = canyonMotion.measure({ camera: canyon.camera, amount: flowAmount, dt: flightDelta, reducedMotion: reduceMotion });\n' +
    '        /* 轉彎側向模糊：鏡頭的移動在視角的左右方向上的部分（彎道裡視線落後河道時變大）只留 LATERAL BLUR 的比例；直道上本來就接近 0。快門位移與光點共用同一個向量。 */\n' +
    '        { const LB = THREE.MathUtils.clamp(CONFIG.canyonMotion.lateralBlur ?? 1, 0, 1); if (LB < .999 && canyonMotion.state.shift > 1e-3) { canyon.camera.updateMatrixWorld(); latRight.setFromMatrixColumn(canyon.camera.matrixWorld, 0); const sw = canyonMotion.shiftWorld; sw.addScaledVector(latRight, -sw.dot(latRight) * (1 - LB)); canyonMotion.state.shift = sw.length(); } }', 'lateral blur');
  return main;
}
module.exports = ({ main, drops, letters, glass, html, journey }) => {
  const out = { main: patchMain(main), drops, letters, glass, html, extra: { 'canyon-racing.js': fs.readFileSync(path.join(__dirname, 'canyon-racing.js'), 'utf8') } };
  if (journey) out.journey = patchJourney(journey);
  return out;
};
module.exports.patchJourney = patchJourney;
module.exports.patchMain = patchMain;
