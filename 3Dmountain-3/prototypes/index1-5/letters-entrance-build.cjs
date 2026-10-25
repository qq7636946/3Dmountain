/* index1-5 only — 水字登場: the liquid letters' water entrance, and the chapter's rhythm (2026-10-23).
 * Run by build.cjs after opening-drops-build.cjs (which owns the drops' LOOK; this file touches only their motion).
 * 1. Letters (from prototypes/highland-1-4-ascent/js/water-logo-letters.js): each letter leaves the sea as a drop
 *    and takes its shape on the way up — letters-water-fx.js, copied from ./letters-water-fx.src.js.
 * 2. Rhythm (client 「水滴跟文字出來的節奏…現在一起出來有點爛」): one sequence instead of two things at once —
 *    the helix drops swirl, then spiral up and OUT of the frame, clearing the word's row; the letters rise out of
 *    the sea after them and form in clear space; the word sets at the same moment as before. Every timing is a dial.
 * 3. Panel (client 「跟 index4-6-3-1.html 的參數一樣」): in the LOGO section — a 水字登場 switch under 水滴進場,
 *    「節奏細項」「水字細項」 next to ▶ 播放本章, and the two groups listed first under the LOGO header.
 * URL: ?letterfx=drop (default) | condense | off. */
const fs = require('fs'), path = require('path');
function once(source, anchor, replacement) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) throw Error('letters-entrance-build: anchor found ' + count + 'x: ' + anchor.slice(0, 90));
  return source.replace(anchor, () => replacement);
}
const RHYTHM = '水字 · 節奏（水滴 → 文字）', EFFECT = '水字 · 出海成字', COUNT = '水滴 · 數量與大小';
module.exports = ({ main, drops, letters, glass, html }) => {
  const fx = fs.readFileSync(path.join(__dirname, 'letters-water-fx.src.js'), 'utf8').replace(/\r\n/g, '\n');

  /* ---- letters: the entrance module, its defaults, and the hand-over to the glass ---- */
  letters = once(letters, 'export const LOGO_LETTER_DEFAULTS = {',
    "import { createLetterWaterFx, LETTER_FX_DEFAULTS } from './letters-water-fx.js';\nexport const LOGO_LETTER_DEFAULTS = {\n  ...LETTER_FX_DEFAULTS,");
  letters = once(letters, 'export function createLogoLetters(THREE, { glassMaterial, blueMaterial, config, lite = false }) {',
    'export function createLogoLetters(THREE, { glassMaterial, blueMaterial, config, lite = false, seaLevel = () => 0, onSplash = null }) {');
  letters = once(letters, '  const GLYPH_SIZE = lite ? 160 : 256;\n',
    '  const GLYPH_SIZE = lite ? 160 : 256;\n'
    + '  /* 水字登場: each letter leaves the sea as a drop and takes its shape on the way up (letters-water-fx.js). */\n'
    + '  const fx = createLetterWaterFx(THREE, { group, glassMaterial, blueMaterial, config, lite, seaLevel, onSplash });\n');
  /* The letter's glass carries on the ripple and the glint the water started. */
  letters = once(letters, 'uniform float uIce,uIceBlue,uLetterAlpha,uLetterTile;', 'uniform float uIce,uIceBlue,uLetterAlpha,uLetterTile;uniform vec4 uFxWave;');
  letters = once(letters, 'Ng=normalize(Ng+(vLetterX*lg.x+vLetterY*lg.y)*lens);"',
    'Ng=normalize(Ng+(vLetterX*lg.x+vLetterY*lg.y)*lens);\\n        if(uFxWave.y>1e-4){float frr=length(vLetterP.xy),fdr=frr-uFxWave.x;vec2 fdir=vLetterP.xy/max(frr,1e-4);Ng=normalize(Ng+(vLetterX*fdir.x+vLetterY*fdir.y)*sin(fdr*44.)*exp(-fdr*fdr*55.)*uFxWave.y*smoothstep(.45,.9,abs(vLetterN.z)));}"');
  letters = once(letters, "      + '        gl_FragColor=vec4(color,uOpacity*uLetterAlpha);');",
    "      + '        if(uFxWave.w>.001){float fb=(vLetterP.x*.8+vLetterP.y*.6)-uFxWave.z,gl=exp(-fb*fb/.005),sh=exp(-fb*fb/.04);color=color*(1.-.28*uFxWave.w*(sh-gl))+vec3(.95,.98,1.)*uFxWave.w*gl*(.45+.55*pow(1.-NdV,2.));}\\n'\n      + '        gl_FragColor=vec4(color,uOpacity*uLetterAlpha);');");
  letters = once(letters, 'uLetterGlyph: { value: map }, uLetterTile: { value: .5 / tile }',
    'uLetterGlyph: { value: map }, uLetterTile: { value: .5 / tile }, uFxWave: { value: new THREE.Vector4() }');
  letters = once(letters, '      letters = built;\n', '      letters = built;\n      fx.build(letters, { depth });\n');
  letters = once(letters, '    letters = []; glyphs = []; slots = []; ready = false; source = null;',
    '    fx.clear();\n    letters = []; glyphs = []; slots = []; ready = false; source = null;');
  letters = once(letters, '    state.assembled = false; state.glass = false; state.pulse = 0;',
    '    fx.begin();\n    state.assembled = false; state.glass = false; state.pulse = 0;');
  /* The letters' own timing, dialled: when the first one sets off (RISE START, chapter 0–1), how far behind it the
     last one is (RISE STAGGER), and how long each takes from the deep to its place (RISE LENGTH). The word sets
     just after the last is home — with the design values that is the .80–.93 it always was. */
  letters = once(letters, '    if (config.freeHelix) fuse = smooth(progress, .80, .93);',
    '    const riseDone = config.riseStart + config.riseStagger + config.riseLength;\n    if (config.freeHelix) fuse = smooth(progress, riseDone + .015, riseDone + .145);');
  letters = once(letters, '        const start = .035 + letter.index / last * .31;\n        const raw = (progress - start) / .44;',
    '        const start = config.riseStart + letter.index / last * config.riseStagger;\n        const raw = (progress - start) / Math.max(.05, config.riseLength);');
  letters = once(letters, '      letter.mesh.matrixWorldNeedsUpdate = true;\n      letter.mesh.visible = !config.directedHelix || delivery.alpha > .001;',
    '      letter.mesh.matrixWorldNeedsUpdate = true;\n      const fxMesh = fx.letter(letter, snap, pose, config.directedHelix ? delivery.alpha : 1, reducedMotion);\n      letter.mesh.visible = (!config.directedHelix || delivery.alpha > .001) && fxMesh > .001;');
  letters = once(letters, 'for (const material of materials) material.depthWrite = delivery.alpha >= .999;',
    'for (const material of materials) material.depthWrite = delivery.alpha * fxMesh >= .999;');
  letters = once(letters, 'letter.uniforms.uLetterAlpha.value = config.directedHelix ? delivery.alpha : 1;',
    'letter.uniforms.uLetterAlpha.value = (config.directedHelix ? delivery.alpha : 1) * fxMesh;');
  letters = once(letters, 'if (config.directedHelix) letter.edge.material.opacity *= delivery.alpha;',
    'letter.edge.material.opacity *= (config.directedHelix ? delivery.alpha : 1) * fxMesh;');
  letters = once(letters, 'dispose() { epoch++; clear(); ice.uIceNoise.value.dispose(); }',
    'fx, dispose() { epoch++; clear(); fx.dispose(); ice.uIceNoise.value.dispose(); }');

  /* ---- drops: the helix's way out, its own dials (the photographs' spiral keeps leaveSpin/leaveRise/leaveRadius) ----
     The letters' drops leave on the same schedule as the rest of the string (they had .52/.14/.25 written in), so one
     pair of dials — 水滴離場開始／最後一顆離場 — moves the whole helix. Each falls back to the shared value. */
  drops = once(drops, 'const departed = C.freeLetters ? clamp01((clock - .52 - slot / Math.max(1, count - 1) * .14) / .25) : 0;',
    'const departed = C.freeLetters ? clamp01((clock - C.swirlLeaveStart - clamp01((deliver.s[slot] - deliver.leave.from) / deliver.leave.span) * (deliver.leave.window - deliver.leave.climb)) / deliver.leave.climb) : 0;');
  drops = once(drops, 'const angle = swirlPlace(deliver.s[slot] - (C.freeLetters ? C.leaveSpin * Math.PI * 2 * Math.pow(departed, 1.5) : 0),\n          C.freeLetters ? C.swirlRadius * (C.leaveRadius - 1) * rise : 0,',
    'const angle = swirlPlace(deliver.s[slot] - (C.freeLetters ? (C.swirlLeaveSpin ?? C.leaveSpin) * Math.PI * 2 * Math.pow(departed, 1.5) : 0),\n          C.freeLetters ? C.swirlRadius * ((C.swirlLeaveRadius ?? C.leaveRadius) - 1) * rise : 0,');
  drops = once(drops, 'if (C.freeLetters && rise > 0) dock.y += travelToClear(dock, radiusNow * 1.4, 1) * C.leaveRise * rise;',
    'if (C.freeLetters && rise > 0) dock.y += travelToClear(dock, radiusNow * 1.4, 1) * (C.swirlLeaveRise ?? C.leaveRise) * rise;');
  drops = once(drops, '          s - C.leaveSpin * Math.PI * 2 * onward,\n          (C.swirlRadius + water.out * spread) * THREE.MathUtils.lerp(1, C.leaveRadius, rise) - C.swirlRadius,',
    '          s - (C.swirlLeaveSpin ?? C.leaveSpin) * Math.PI * 2 * onward,\n          (C.swirlRadius + water.out * spread) * THREE.MathUtils.lerp(1, C.swirlLeaveRadius ?? C.leaveRadius, rise) - C.swirlRadius,');
  drops = once(drops, '          if (rise > 0) mesh.position.y += travelToClear(mesh.position, radiusNow * 1.4, 1) * C.leaveRise * rise;\n          grow = .35 + .65 * born;',
    '          if (rise > 0) mesh.position.y += travelToClear(mesh.position, radiusNow * 1.4, 1) * (C.swirlLeaveRise ?? C.leaveRise) * rise;\n          grow = .35 + .65 * born;');

  /* ---- drops: how many and how big (client 「這個數量跟大小怎沒有數值可以操控」) ----
     In letters mode the helix is: the 11 big drops (one per letter: LETTER SIZE × the word's rhythm, LETTER SIZE VAR),
     the plain water strung with them and riding off the string (CROWD shows a share of a composed list; PLAIN SIZE,
     PLAIN SIZE VAR, CROWD SPREAD), and the loose beads in the air (AMBIENT shows a share of a pool, AMBIENT SIZE).
     COUNT and SIZE are the photographs' spiral and do nothing here. Two knobs were missing: how many of the big
     drops show (SWIRL BIG, 0–1, each shrinking away rather than popping), and more beads than the pool held —
     the pool is doubled, the first half exactly as before (same seeds), the second half only for AMBIENT above 1. */
  drops = once(drops, '        grow = (1 + .06 * docked) * (.35 + .65 * born);',
    '        grow = (1 + .06 * docked) * (.35 + .65 * born);\n'
    + '        if (C.freeLetters) { const keep = clamp01(((C.swirlBig ?? 1) - fract(slot * .618034 + .31)) / .06); grow *= keep; if (keep <= 0) gone = true; }');
  drops = once(drops, '  const AMBIENT_MAX = lite ? 44 : 80;', '  const AMBIENT_BASE = lite ? 44 : 80, AMBIENT_MAX = AMBIENT_BASE * 2;');
  drops = once(drops, '  const randomUnit = (out) => {', '  for (let j = AMBIENT_BASE; j < AMBIENT_MAX; j++) ambient[j].order += 1;\n  const randomUnit = (out) => {');
  drops = once(drops, '    const shown = clamp01(C.ambient);', '    const shown = THREE.MathUtils.clamp(C.ambient, 0, 2);');

  /* ---- drops: no longer a row of pearls (client 2026-10-24 「這螺旋水滴很怪，可能太規則」) ----
     Each drop of the swirl gets a character of its own, seeded so it keeps it: its size departs from the composed
     rhythm (SWIRL SIZE JITTER) and a few are hero drops (SWIRL HERO SHARE of them, SWIRL HERO larger); its place is off
     the helix by a little, in and out of depth as much as up and down (SWIRL JITTER, in the swirl's radii), and it
     drifts there slowly (SWIRL DRIFT; still under reduced motion). The choreography — the string, the gates, the climb
     out over the top — is untouched: these are offsets on top of it. */
  drops = once(drops, "  /* How far above or below the string's line a drop in place WHERE stands:",
    "  const dropHash = (s, k) => fract(Math.sin(s * 127.1 + k * 311.7) * 43758.5453);\n"
    + "  function dropSizeVary(mesh, plain) {\n"
    + "    const C = config, s = mesh.material.uniforms.uSeed.value;\n"
    + "    let v = 1 + (dropHash(s, 4) - .5) * 2 * (C.swirlSizeJitter ?? 0) * (plain ? .7 : 1);\n"
    + "    if (!plain && dropHash(s, 5) < (C.swirlHeroShare ?? 0)) v *= 1 + (C.swirlHero ?? 0);\n"
    + "    return Math.max(.3, v);\n"
    + "  }\n"
    + "  function jitterDrop(mesh, time, amount) {\n"
    + "    const C = config, s = mesh.material.uniforms.uSeed.value, j = (C.swirlJitter ?? 0) * C.swirlRadius * amount, d = (C.swirlDrift ?? 0) * amount;\n"
    + "    if (j <= 0 && d <= 0) return;\n"
    + "    const a = dropHash(s, 1) * Math.PI * 2, out = dropHash(s, 2) - .5, up = dropHash(s, 3) - .5;\n"
    + "    mesh.position.x += Math.sin(a) * out * 2 * j + Math.sin(time * .31 + s * 17) * d;\n"
    + "    mesh.position.z += Math.cos(a) * out * 2 * j + Math.cos(time * .27 + s * 11) * d;\n"
    + "    mesh.position.y += up * 1.2 * j + Math.sin(time * .37 + s * 23) * d * .8;\n"
    + "  }\n"
    + "  /* How far above or below the string's line a drop in place WHERE stands:");
  drops = once(drops, "        : Math.max(.25, 1 + (rhythm[slot % rhythm.length] - 1) * sizeVar);",
    "        : Math.max(.25, 1 + (rhythm[slot % rhythm.length] - 1) * sizeVar) * (delivering ? dropSizeVary(mesh, false) : 1);");
  drops = once(drops, "        ? Math.max(.15, plainSize * Math.max(.3, 1 + (water.size - 1) * plainVar) * thin / size)",
    "        ? Math.max(.15, plainSize * Math.max(.3, 1 + (water.size - 1) * plainVar) * thin / size) * dropSizeVary(mesh, true)");
  drops = once(drops, "        dock.addScaledVector(lensAxis, C.gatePush * docked);\n        mesh.position.copy(dock);",
    "        dock.addScaledVector(lensAxis, C.gatePush * docked);\n        mesh.position.copy(dock);\n        jitterDrop(mesh, time * motion, 1);");
  drops = once(drops, "          clock, mesh.position);\n",
    "          clock, mesh.position);\n        jitterDrop(mesh, time * motion, .65);\n");

  /* ---- main: the rhythm's design values, ?letterfx=, the sea, warm-up ---- */
  main = once(main, 'const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',
    '/* 節奏（客戶 2026-10-23「水滴跟文字一起出來有點爛」）：先是水滴的螺旋；章節 .10 起水滴依序往上、往外轉出畫面，\n'
    + '         到 .42 前讓出字標那一列；文字 .08 起從海裡依序出來（每字間隔總跨度 .29、每字行程 .415），在空出來的地方成字，\n'
    + '         整字融合仍是 .80–.93。全部在面板「水字 · 節奏」。 */\n'
    + '      Object.assign(CONFIG.logoDrops, { swirlLeaveStart: .1, swirlLeaveEnd: .42, swirlLeaveClimb: .26, swirlLeaveRadius: 1.55, swirlLeaveRise: 1.35, swirlLeaveSpin: .3, swirlBig: 1 });\n'
    + '      Object.assign(CONFIG.logoLetters, { riseStart: .08, riseStagger: .29, riseLength: .415 });\n'
    + '      /* 螺旋水滴有大有小、不在一條線上（客戶 2026-10-24「這螺旋水滴很怪，可能太規則」）：主串大小差異 .18 → 1、每顆再隨機、少數特大，位置離開螺旋一點、慢慢飄。 */\n'
    + '      Object.assign(CONFIG.logoDrops, { letterSizeVar: 1, swirlSizeJitter: .28, swirlHero: .5, swirlHeroShare: .2, swirlJitter: .14, swirlDrift: .03 });\n'
    + "      { const letterFx = new URLSearchParams(location.search).get('letterfx'); const fxMode = { off: 0, '0': 0, drop: 1, '1': 1, condense: 2, '2': 2 }[letterFx]; if (fxMode !== undefined) CONFIG.logoLetters.fxMode = fxMode; }\n"
    + '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));');
  main = once(main, 'const logoLetters = createLogoLetters(THREE, { glassMaterial: logoMaterial, blueMaterial: logoBlueMaterial, config: CONFIG.logoLetters, lite: DROPLET_LITE });',
    'const logoLetters = createLogoLetters(THREE, { glassMaterial: logoMaterial, blueMaterial: logoBlueMaterial, config: CONFIG.logoLetters, lite: DROPLET_LITE,\n'
    + '        /* 水字登場: the letters leave the sea; each one rings it as it goes */\n'
    + '        seaLevel: () => sea.position.y, onSplash: (x, y, z, strength) => { spawnRipple(x, z, strength); queueRipple(x, z, .45 * strength, .16); } });');
  main = once(main, 'for (const item of logoLetters.letters) { place(new THREE.Mesh(item.geometry, item.mesh.material), .05); place(new THREE.LineSegments(item.edge.geometry, item.edge.material), .05); }',
    'for (const item of logoLetters.letters) { place(new THREE.Mesh(item.geometry, item.mesh.material), .05); place(new THREE.LineSegments(item.edge.geometry, item.edge.material), .05); }\n'
    + '          { const water = logoLetters.letters[0]?.fx; if (water) { const m = place(new THREE.Mesh(water.mesh.geometry, water.material), .05); m.onBeforeRender = water.mesh.onBeforeRender; } }');

  /* ---- main: the dials. Two groups, listed first under the LOGO header ---- */
  main = once(main, "          ['卡牌轉場 Cards', [",
    `          /* 水字 · 節奏：整章的先後。水滴（慣性、螺旋、何時、往哪裡離場）→ 文字（何時開始、每字間隔、每字行程、何時成字）。
             時間都是 LOGO 章節自己的 0–1（▶ 播放本章 從 0 播到 1）。 */
          ['${RHYTHM}', [
            ['水滴慣性（跟隨捲動的延遲，秒）', 'logoDrops', 'swirlEase', 0, 2, .01], ['水滴晃動慣性（液體）', 'logoDrops', 'inertia', 0, 3, .05], ['水滴速度拉伸', 'logoDrops', 'stretch', 0, 2, .01],
            ['水滴螺旋速度（整章圈數）', 'logoDrops', 'swirlTurns', .4, 2.5, .01], ['水滴螺旋半徑', 'logoDrops', 'swirlRadius', .8, 2.2, .01],
            ['水滴開始離場', 'logoDrops', 'swirlLeaveStart', 0, 1.2, .01], ['最後一顆離場', 'logoDrops', 'swirlLeaveEnd', .05, 1.4, .01],
            ['單顆離場時間', 'logoDrops', 'swirlLeaveClimb', .04, .6, .01],
            ['離場往外飛（半徑倍數）', 'logoDrops', 'swirlLeaveRadius', .5, 3, .01], ['離場衝高', 'logoDrops', 'swirlLeaveRise', .5, 3, .01],
            ['離場追加圈數', 'logoDrops', 'swirlLeaveSpin', 0, 1.5, .01],
            ['文字開始（第一個字出海）', 'logoLetters', 'riseStart', 0, .5, .005], ['每字間隔（第一到最後的總跨度）', 'logoLetters', 'riseStagger', 0, .6, .005],
            ['每字行程（出海 → 到位）', 'logoLetters', 'riseLength', .15, .7, .005],
            ['開始成字（行程，約 .46 出海）', 'logoLetters', 'fxShapeStart', .3, .8, .01], ['成字完成', 'logoLetters', 'fxShapeEnd', .4, .98, .01],
            ['成字跟隨彈簧（越大越跟手）', 'logoLetters', 'fxSpring', 2, 30, .5], ['成字回彈', 'logoLetters', 'fxBounce', 0, .85, .01]
          ]],
          /* 水滴 · 數量與大小（字母誕生這一章）。螺旋上的水滴有兩種：主串水滴＝每個字母位置一顆，共 11 顆（大小照字的節奏起伏）；
             清水水滴＝串上其餘的水滴（含幾顆特別大的）和串內外的小水滴，1＝設計量（桌機約 38 顆，手機約六成）。小水珠＝空中的散珠
             （1＝80 顆，手機 44）。客戶設定裡的 count／size 是「照片水滴」模式用的，這一章不起作用。全部即時。 */
          ['${COUNT}', [
            ['主串水滴數量（11 顆的比例，0–1）', 'logoDrops', 'swirlBig', 0, 1, .01], ['主串水滴大小', 'logoDrops', 'letterSize', .04, .4, .005],
            ['主串水滴大小差異', 'logoDrops', 'letterSizeVar', 0, 1.5, .01],
            ['清水水滴數量（1＝設計量約 38 顆，最多 1.6）', 'logoDrops', 'crowd', 0, 1.6, .01], ['清水水滴大小', 'logoDrops', 'plainSize', .02, .25, .005],
            ['清水水滴大小差異', 'logoDrops', 'plainSizeVar', 0, 1.5, .01], ['串外水滴離串距離', 'logoDrops', 'crowdSpread', 0, 1.6, .01],
            ['小水珠數量（1＝80 顆，最多 2＝160）', 'logoDrops', 'ambient', 0, 2, .01], ['小水珠大小', 'logoDrops', 'ambientSize', .1, 3, .01],
            ['手機上水滴整體大小', 'logoDrops', 'mobileScale', .4, 1, .01],
            ['每顆大小隨機', 'logoDrops', 'swirlSizeJitter', 0, .8, .01], ['特大水滴比例', 'logoDrops', 'swirlHeroShare', 0, .6, .01], ['特大水滴加大', 'logoDrops', 'swirlHero', 0, 1.5, .01],
            ['位置離開螺旋（半徑倍數）', 'logoDrops', 'swirlJitter', 0, .5, .01], ['原地漂移', 'logoDrops', 'swirlDrift', 0, .15, .005]
          ]],
          /* 水字 · 出海成字：文字的水。登場方式 0 原本／1 出海成字／2 水珠凝聚（網址 ?letterfx=off|drop|condense）。 */
          ['${EFFECT}', [
            ['登場方式（0 原本／1 出海成字／2 水珠凝聚）', 'logoLetters', 'fxMode', 0, 2, 1],
            ['水滴大小', 'logoLetters', 'fxBlob', .3, 1.4, .01], ['出海水柱長度', 'logoLetters', 'fxNeck', 0, 3, .05], ['水冠水珠數', 'logoLetters', 'fxDroplets', 0, 6, 1],
            ['水冠高度', 'logoLetters', 'fxCrown', 0, 2, .05], ['海面隆起', 'logoLetters', 'fxMound', 0, 1.5, .05], ['海面漣漪', 'logoLetters', 'fxSplash', 0, 2.5, .05],
            ['融合水頸（表面張力）', 'logoLetters', 'fxMelt', 0, .4, .005], ['液態圓邊', 'logoLetters', 'fxRound', .008, .07, .001], ['水面顫動', 'logoLetters', 'fxWobble', 0, .04, .001],
            ['拖尾淚滴', 'logoLetters', 'fxTail', 0, 2, .01],
            ['水滴透鏡', 'logoLetters', 'fxLens', 0, 3, .05], ['水滴暗邊', 'logoLetters', 'fxRim', 0, 1, .01], ['水滴棚燈反光', 'logoLetters', 'fxWindows', 0, 5, .05],
            ['成字漣漪', 'logoLetters', 'fxRipple', 0, 1.5, .01], ['成字掃光', 'logoLetters', 'fxGlint', 0, 2, .01], ['水滴焦散', 'logoLetters', 'fxCaustic', 0, 2, .01],
            ['品牌藍暈染', 'logoLetters', 'fxDye', 0, 1, .01]
          ]],
          ['卡牌轉場 Cards', [`);
  main = once(main, "const logoGroupOrder = ['山體建模',", `const logoGroupOrder = ['${RHYTHM}', '${COUNT}', '${EFFECT}', '山體建模',`);
  /* The LOGO header: a 水字登場 switch after 水滴進場, and the two groups one press away from ▶ 播放本章. */
  main = once(main, '        motionActions.append(playSeam, playChapter, editLetters, editMotion);',
    `        const editRhythm = document.createElement('button'); editRhythm.type = 'button'; editRhythm.textContent = '節奏細項';
        editRhythm.addEventListener('click', () => jumpTo('${RHYTHM}'));
        const editWater = document.createElement('button'); editWater.type = 'button'; editWater.textContent = '水字細項';
        editWater.addEventListener('click', () => jumpTo('${EFFECT}'));
        const editCount = document.createElement('button'); editCount.type = 'button'; editCount.textContent = '數量大小';
        editCount.addEventListener('click', () => jumpTo('${COUNT}'));
        motionActions.append(playSeam, playChapter, editRhythm, editCount, editWater, editLetters, editMotion);
        /* 水字登場：文字怎麼從海裡出來。寫 logoLetters.fxMode，和上面的開關一樣只是鏡像。 */
        const waterHeading = document.createElement('h3'); waterHeading.textContent = '水字登場（文字從海裡出來）';
        const waterSwitches = document.createElement('div'); waterSwitches.className = 'tuner-actions logo-switches';
        waterSwitches.style.setProperty('--logo-count', '3');
        const waterButtons = new Map();
        const syncWater = () => { const mode = Math.round(CONFIG.logoLetters.fxMode); for (const [id, button] of waterButtons) button.setAttribute('aria-pressed', String(mode === id)); };
        for (const [id, label] of [[0, '原本'], [1, '出海成字'], [2, '水珠凝聚']]) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
          button.setAttribute('aria-label', '水字登場：' + label); button.setAttribute('aria-pressed', 'false');
          button.addEventListener('click', () => { CONFIG.logoLetters.fxMode = id; syncTunerValues(); lettersPanel?.sync(); syncWater(); });
          waterSwitches.appendChild(button); waterButtons.set(id, button);
        }
        tunerBody.addEventListener('input', syncWater);
        tunerBody.addEventListener('click', () => setTimeout(syncWater, 0));
        syncWater();`);
  main = once(main, 'motionHeading, motionSwitches, enterHeading, enterSwitches, motionActions); tunerBody.appendChild(logoCompare);',
    'motionHeading, motionSwitches, enterHeading, enterSwitches, waterHeading, waterSwitches, motionActions); tunerBody.appendChild(logoCompare);\n'
    + '        /* The LOGO header stays pinned only while it leaves room for the dials under it: taller than ~45% of the panel\n'
    + '           (a laptop screen), it scrolls with the rest, and the jump buttons bring a group to the top. */\n'
    + "        const fitLogoHeader = () => { const tall = logoCompare.offsetHeight > tunerBody.clientHeight * .45; logoCompare.style.position = tall ? 'static' : ''; };\n"
    + '        if (typeof ResizeObserver === \'function\') new ResizeObserver(fitLogoHeader).observe(tunerBody); addEventListener(\'resize\', fitLogoHeader); fitLogoHeader();');
  /* every jump in the panel offsets by the header only while it is pinned */
  {
    const jump = '- logoCompare.offsetHeight - 5';
    if (main.split(jump).length !== 4) throw Error('letters-entrance-build: expected 3 header-offset jumps');
    main = main.split(jump).join("- (getComputedStyle(logoCompare).position === 'sticky' ? logoCompare.offsetHeight : 0) - 5");
  }
  return { main, drops, letters, glass, html, extra: { 'letters-water-fx.js': fx } };
};
