/* index1-5 only: the focused 3D-LOGO panel for the last cut (2026-10-24, client: 「最後一cut的3D LOGO 要開數值bar給我」).
   Ships logo-panel.js (local module) and mounts it from main.js. The row list is read from the live modules at build time
   (world-logo-mark.js MARK_ROWS, world-logo-scene.js LAKE_ROWS, world-logo-build.cjs SEAL_ROWS), so a row the specialists add
   shows up after the next build; a key that no longer exists is dropped with a warning instead of breaking the page.
   Starts closed; M opens the panel, including with ?logopanel=0. */
const fs = require('fs'), path = require('path');
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/* same technique as world-logo-build.cjs: read `export const NAME = <literal>;` without running the module */
function extractExport(src, name) {
  const m = new RegExp('export\\s+const\\s+' + name + '\\s*=\\s*').exec(src);
  if (!m) return undefined;
  const start = m.index + m[0].length;
  let i = start, depth = 0, started = false;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') { for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++; continue; }
    if ('([{'.includes(c)) { depth++; started = true; continue; }
    if (')]}'.includes(c)) { depth--; continue; }
    if (depth === 0 && c === ';') break;
    if (depth === 0 && started && c === '\n') { const next = src.slice(i).match(/^\s*(\S)/); if (!next || !'.,+-*/?:|&'.includes(next[1])) break; }
  }
  return new Function('return (' + src.slice(start, i) + ')')();
}

/* the sections: [title, open, [[group, key], …]]. Labels and ranges come from the modules' own rows. */
const SECTIONS = [
  ['旋轉模糊', false, [['logoSeal', 'spinBlur']]],
  ['位置、旋轉與升起', true, [['logoLake', 'markY'], ['logoLake', 'markSize'], ['logoSeal', 'markScale'], ['logoSeal', 'markY'], ['logoSeal', 'restYaw'],
    ['logoSeal', 'spinStart'], ['logoSeal', 'spin'], ['logoSeal', 'spinEnd'], ['logoSeal', 'spinEase'], ['logoSeal', 'riseStart'], ['logoSeal', 'riseEnd'], ['logoSeal', 'riseEase'],
    ['logoSeal', 'riseOnWave'], ['logoSeal', 'riseWaveStart'], ['logoSeal', 'riseWaveEnd'],
    ['logoSeal', 'hold'], ['logoLake', 'portraitMarkY'], ['logoLake', 'portraitMarkSize']]],
  ['轉場（海洋 → LOGO，Hubtown 毛玻璃）', false, ['transition', 'cutClock', 'cutAt', 'cutTime', 'wave', 'waveLead', 'glassSize', 'glassSplit', 'glassShift', 'glassZoom', 'glassBlur', 'glassChroma', 'glassFrost', 'glassDip', 'glassBloom', 'glassBloomAt', 'glassSpread', 'glassSeam', 'glassPush', 'glassTint'].map(k => ['logoSeal', k])],
  ['LOGO 對照與鑄造質感', false, [['logoMark','variant'],['logoMark','castRelief'],['logoLake','markWidth'],['logoLake','speckDensity']]],
  ['暮色光影與漂浮水浪', false, ['matchOpening', 'skyTop', 'skyHorizon', 'sunAz', 'sunEl', 'sunBloom', 'skySpecks', 'mistAmount', 'waterSwell', 'waterScale', 'waterSpeed', 'waterRough', 'waterFine'].map(k => ['logoLake', k])],
  ['形體（粗細、圓角）', false, ['size', 'thickness', 'tubeAspect', 'edgeRadius', 'bevelSoft', 'edgeCurve', 'edgeSegments', 'crown'].map(k => ['logoMark', k])],
  ['玻璃光學', false, ['transmission', 'volume', 'ior', 'dispersion', 'tint', 'attenuationColor', 'attenuationDistance', 'roughness', 'clearcoat', 'clearcoatRoughness',
    'specular', 'envIntensity', 'envSpin', 'doubleSide', 'thickFloor', 'bgDisplay'].map(k => ['logoMark', k])],
  ['表面與邊緣光', false, ['sheen', 'sheenColor', 'sheenRoughness', 'iridescence', 'rimStrength', 'rimPower', 'rimLine', 'rimColor'].map(k => ['logoMark', k])],
  ['水滴與 3D 字的閃光', false, ['on', 'water', 'bend', 'rim', 'follow', 'followMin', 'wordOn', 'wordRim', 'wordBloomCut', 'color', 'heroAt', 'wordAt', 'wordDelay', 'attack', 'hold', 'release', 'line', 'soft', 'smooth', 'detail', 'body', 'heroScale', 'wordScale', 'wordScalePhone', 'heroGain', 'wordGain', 'speed', 'bloom', 'wordBloom', 'bloomCut'].map(k => ['flashGlow', k])],
  ['水滴與 3D 字的光芒', false, ['on', 'phone', 'phoneStrength', 'wordPhone', 'wordPhoneLength', 'color', 'tint', 'hero', 'word', 'heroLength', 'wordLength', 'heroCore', 'wordCore', 'wordDrop', 'below', 'heroDim', 'wordDim', 'dimOut', 'shaftKnee', 'heroEdge', 'wordEdge', 'wordLines', 'pad', 'cut', 'knee', 'ceil', 'fall', 'streaks', 'count', 'sharp', 'speed', 'view'].map(k => ['lightShafts', k])],
  ['點擊發光', false, ['emberOn', 'emberWater', 'emberBend', 'emberColor', 'emberSoft', 'emberSmooth', 'emberDetail', 'emberHole', 'emberBurn', 'emberScale', 'emberSpeed', 'emberIdleSpeed', 'emberGain', 'emberBody', 'emberBloom', 'emberBloomRadius', 'emberShake', 'emberLift'].map(k => ['logoMark', k])],
  ['點擊發光的光芒', false, ['emberShafts', 'emberShaftKnee', 'emberShaftSettle', 'emberShaftLength', 'emberShaftFall', 'emberShaftCore', 'emberShaftTurnDim', 'emberShaftEdgeFrom', 'emberShaftEdgeTo', 'emberShaftDrop', 'emberShaftTint', 'emberShaftStreaks', 'emberShaftCount', 'emberShaftSharp', 'emberShaftSpeed', 'emberShaftWater', 'emberShaftWaterLine', 'emberShaftWaterReach', 'emberShaftWaterSoft', 'emberShaftWaterGap', 'emberShaftOverWater', 'emberShaftOverReach', 'emberShaftRipple', 'emberShaftRippleUp', 'emberShaftPhone', 'emberShaftPhoneStrength', 'emberShaftView'].map(k => ['logoMark', k])],
  ['水珠粒子（滑鼠互動）', false, ['beads', 'beadGlass', 'beadSize', 'beadSpec', 'beadCaustic', 'beadEdge', 'beadFace', 'beadDeep', 'beadMid', 'beadLight', 'beadBlue', 'beadBlueDeep', 'beadSpring', 'beadDamp', 'beadPush', 'beadDrag', 'beadRadius', 'beadFlow', 'beadFlowScale', 'beadFlowSpeed', 'beadLag', 'beadDrip', 'beadDripSpeed', 'beadGatherFrom', 'beadGatherTo'].map(k => ['logoMark', k])],
  ['外框導角水感', false, ['waterRim', 'waterRimWiden', 'waterWobble', 'waterWall', 'waterCurve', 'waterIor', 'waterGain', 'waterContrast', 'waterDeep', 'waterSky', 'waterEdge', 'waterMeniscus', 'waterGloss', 'waterFlow', 'waterFlowSpeed'].map(k => ['logoMark', k])],
  ['水感（內部光、焦散）', false, ['glow', 'glowPulse', 'glowSpeed', 'glowColor', 'caustic', 'causticScale', 'causticSpeed', 'shimmer', 'shimmerScale'].map(k => ['logoMark', k])],
  ['品牌藍（上方葉片）', false, ['brandBlue', 'brandBlueColor', 'brandBlueDeep', 'brandBlueGlow', 'brandBlueAbsorb'].map(k => ['logoMark', k])],
  ['打光與倒影', false, [['logoLake', 'lightSun'], ['logoLake', 'lightFill'], ['logoLake', 'envIntensity'], ['logoLake', 'reflStrength'], ['logoLake', 'reflLength'],
    ['logoLake', 'reflRipple'], ['logoLake', 'reflFresnel'], ['logoLake', 'reflBlur']]]
];
/* dials that exist in world-logo.js's defaults but have no row in the big tuner */
const EXTRA_ROWS = [
  ['從水面升起 開始（佔旋轉長度）', 'logoSeal', 'riseStart', 0, 1, .01],
  ['從水面升起 結束（佔旋轉長度）', 'logoSeal', 'riseEnd', 0, 1, .01],
  ['升起 緩動（0 線性／1 先快後慢）', 'logoSeal', 'riseEase', 0, 1, .01],
  ['跟著波浪升起（1 開／0 用上面兩列）', 'logoSeal', 'riseOnWave', 0, 1, 1],
  ['跟波浪升起 開始（佔波浪長度）', 'logoSeal', 'riseWaveStart', 0, 1, .01],
  ['跟波浪升起 完成（佔波浪長度）', 'logoSeal', 'riseWaveEnd', 0, 1, .01],
  ['閃光（1 開／0 關）', 'flashGlow', 'on', 0, 1, 1], ['閃光｜水流感（0 結晶紋／1 水）', 'flashGlow', 'water', 0, 1, .01], ['閃光｜水流彎曲（0 直／大＝更蜿蜒）', 'flashGlow', 'bend', 0, 2.5, .01], ['閃光｜水滴邊緣的光', 'flashGlow', 'rim', 0, 3, .01], ['閃光｜水滴跟著往下捲（1 捲動時亮／0 只閃一次）', 'flashGlow', 'follow', 0, 1, 1], ['閃光｜多快才算在捲（小＝輕輕捲也亮）', 'flashGlow', 'followMin', .005, .5, .005], ['閃光｜3D 字也亮（1 開／0 關）', 'flashGlow', 'wordOn', 0, 1, 1], ['閃光｜3D 字邊緣的光', 'flashGlow', 'wordRim', 0, 3, .01], ['閃光｜3D 字光暈門檻（大＝只有最亮處才暈開，字較清楚）', 'flashGlow', 'wordBloomCut', .5, 5, .01], ['閃光｜紋路柔和（線條寬度）', 'flashGlow', 'soft', .02, .6, .005], ['閃光｜紋路圓滑（只影響結晶紋）', 'flashGlow', 'smooth', 0, 1, .01], ['閃光｜細碎紋理（只影響結晶紋）', 'flashGlow', 'detail', 0, 1, .01], ['閃光｜整體透光', 'flashGlow', 'body', 0, 1, .01], ['閃光｜顏色', 'flashGlow', 'color'], ['閃光｜水滴：捲到哪裡開始亮', 'flashGlow', 'heroAt', 0, 2, .01], ['閃光｜3D 字：退回這裡以上才會再亮一次（亮起是字落定的那一刻）', 'flashGlow', 'wordAt', 1, 5, .01], ['閃光｜3D 字：字落定後等幾秒', 'flashGlow', 'wordDelay', 0, 2, .01],
  ['閃光｜亮起（秒）', 'flashGlow', 'attack', .02, 2, .01], ['閃光｜停留（秒）', 'flashGlow', 'hold', 0, 3, .01], ['閃光｜熄滅（秒）', 'flashGlow', 'release', .05, 4, .01], ['閃光｜紋路位置', 'flashGlow', 'line', .02, .4, .005],
  ['閃光｜水滴紋路尺度', 'flashGlow', 'heroScale', .2, 8, .05], ['閃光｜3D 字紋路尺度', 'flashGlow', 'wordScale', .2, 8, .05], ['閃光｜3D 字紋路尺度（手機）', 'flashGlow', 'wordScalePhone', .2, 8, .05], ['閃光｜水滴亮度', 'flashGlow', 'heroGain', 0, 16, .1], ['閃光｜3D 字亮度', 'flashGlow', 'wordGain', 0, 16, .1],
  ['閃光｜紋路速度', 'flashGlow', 'speed', 0, 4, .01], ['閃光｜水滴光暈強度', 'flashGlow', 'bloom', 0, 2, .01], ['閃光｜3D 字光暈強度', 'flashGlow', 'wordBloom', 0, 2, .01], ['閃光｜光暈門檻', 'flashGlow', 'bloomCut', .5, 2.5, .01],
  ['光芒（1 開／0 關）', 'lightShafts', 'on', 0, 1, 1], ['光芒｜手機（1 省電版／0 關）', 'lightShafts', 'phone', 0, 1, 1], ['光芒｜手機強度倍數', 'lightShafts', 'phoneStrength', 0, 2, .01], ['光芒｜手機 3D 字再乘', 'lightShafts', 'wordPhone', 0, 6, .01], ['光芒｜手機 3D 字長度倍數', 'lightShafts', 'wordPhoneLength', .3, 3, .01], ['光芒｜顏色', 'lightShafts', 'color'], ['光芒｜染色（0 發光體原色／1 全用上面的顏色）', 'lightShafts', 'tint', 0, 1, .01],
  ['光芒｜水滴強度', 'lightShafts', 'hero', 0, 8, .01], ['光芒｜3D 字強度', 'lightShafts', 'word', 0, 8, .01], ['光芒｜水滴長度（螢幕高）', 'lightShafts', 'heroLength', .05, 2, .01], ['光芒｜3D 字長度（螢幕高）', 'lightShafts', 'wordLength', .05, 2, .01],
  ['光芒｜蓋在水滴上的比例', 'lightShafts', 'heroCore', 0, 1, .01], ['光芒｜蓋在字上的比例', 'lightShafts', 'wordCore', 0, 1, .01], ['光芒｜3D 字中心往下（螢幕高）', 'lightShafts', 'wordDrop', -.3, .5, .005], ['光芒｜往下（標題那邊）的比例', 'lightShafts', 'below', 0, 1, .01], ['光芒｜光源範圍（物件大小的倍數）', 'lightShafts', 'pad', 1, 2, .01],
  ['光芒｜水滴時畫面壓暗（線間才黑）', 'lightShafts', 'heroDim', 0, .8, .01], ['光芒｜3D 字時畫面壓暗（線間才黑）', 'lightShafts', 'wordDim', 0, .8, .01], ['光芒｜畫面回亮最快速度（秒／全幅）', 'lightShafts', 'dimOut', .1, 5, .01], ['光芒｜亮度壓縮（大＝不隨紋路忽強忽弱）', 'lightShafts', 'shaftKnee', 0, 6, .01], ['光芒｜水滴邊緣柔度（螢幕高）', 'lightShafts', 'heroEdge', .005, .4, .005], ['光芒｜3D 字邊緣柔度（螢幕高）', 'lightShafts', 'wordEdge', .005, .4, .005], ['光芒｜3D 字細線疏密倍數', 'lightShafts', 'wordLines', .3, 3, .01], ['光芒｜門檻', 'lightShafts', 'cut', 0, 6, .01], ['光芒｜門檻柔邊', 'lightShafts', 'knee', .01, 6, .01], ['光芒｜亮度上限', 'lightShafts', 'ceil', 1, 30, .1], ['光芒｜衰減（越小越快淡出）', 'lightShafts', 'fall', .002, 1, .001],
  ['光芒｜細線深度（0 無線條／1 線間全黑）', 'lightShafts', 'streaks', 0, 1, .01], ['光芒｜細線數量（一圈）', 'lightShafts', 'count', 8, 500, 1], ['光芒｜細線粗細（越大越細）', 'lightShafts', 'sharp', .3, 8, .01], ['光芒｜細線飄移速度', 'lightShafts', 'speed', 0, 2, .01],
  ['光芒｜檢視（0 畫面／1 光源／2 只看光芒）', 'lightShafts', 'view', 0, 2, 1]
];

const once = (source, anchor, replacement, label) => {
  const n = source.split(anchor).length - 1;
  if (n !== 1) throw new Error('index1-5 logo-panel anchor (' + label + '): ' + n + ' × ' + anchor.slice(0, 100));
  return source.replace(anchor, () => replacement);
};

/* the sections with their rows, read from the live modules; null when the modules are not there */
function buildSections(from = __dirname) {
  const markFile = path.join(from, 'world-logo-mark.js'), lakeFile = path.join(from, 'world-logo-scene.js');
  if (!fs.existsSync(markFile) || !fs.existsSync(lakeFile)) return null;

  /* every row we know, by group/key: [label, group, key, min, max, step] or [label, group, key] for colours */
  const known = new Map();
  const add = (group, row) => { const r = Array.isArray(row) ? row.slice() : []; if (r[1] && typeof r[1] === 'string' && r[0] && !known.has(group + '/' + r[1])) known.set(group + '/' + r[1], [r[0], group, ...r.slice(1)]); };
  for (const row of require('./world-logo-build.cjs').SEAL_ROWS) known.set(row[1] + '/' + row[2], row);
  for (const row of EXTRA_ROWS) if (!known.has(row[1] + '/' + row[2])) known.set(row[1] + '/' + row[2], row);
  for (const row of extractExport(read(markFile), 'MARK_ROWS') || []) add('logoMark', row);
  for (const row of extractExport(read(lakeFile), 'LAKE_ROWS') || []) add('logoLake', row);
  const modelRows=extractExport(read(path.join(__dirname,'logo-panel.js')),'LOGO_MODEL_ROWS')||[];
  for(const row of modelRows)add('logoModel',row);

  const orbitRows=[...known.values()].filter(row=>row[1]==='logoLake'&&row[2].startsWith('orbit'));
  const sections = [{title:'LOGO 環繞光點',open:true,rows:orbitRows},{title:'Blender 建模',open:true,rows:modelRows.map(row=>[row[0],'logoModel',...row.slice(1)])}], missing = [],used=new Set([...modelRows.map(row=>'logoModel/'+row[1]),...orbitRows.map(row=>row[1]+'/'+row[2])]);
  for (const [title, open, keys] of SECTIONS) {
    const rows = [];
    for (const [g, k] of keys) { const row = known.get(g + '/' + k); if (row){rows.push(row);used.add(g+'/'+k);}else missing.push(g + '.' + k); }
    if (rows.length) sections.push({ title, open:false, rows });
  }
  for(const[group,title]of [['logoMark','更多 LOGO 光學與表面'],['logoLake','完整場景、背景與水面'],['logoSeal','完整轉場與節奏']]){
    const rows=[...known].filter(([key,row])=>row[1]===group&&!used.has(key)).map(([key,row])=>{used.add(key);return row;});
    if(rows.length)sections.push({title,open:false,rows});
  }
  if (missing.length) console.log('logo panel: no row for ' + missing.join(', ') + ' (dropped)');
  return sections;
}

/* main.js: the import and the mount. `ver` = the version suffix the generated file's other local imports carry ('' inside a build: the rewire adds it) */
function patchMain(main, sections, ver = '') {
  main = once(main, "    import * as THREE from 'three';", `    import * as THREE from 'three';\n    import { mountLogoPanel } from './logo-panel.js${ver ? '?v=' + ver : ''}';`, 'import');
  main = once(main, "      document.addEventListener('click', event => {\n        if (!event.target.closest?.('.finnovation-ui [data-next]')) return;",
    `      /* LOGO_PANEL：最後一段 3D LOGO 的專用參數面板（logo-panel-build.cjs；M 開關，localhost 在最後一段自動開）。onChange 在使用者動作時才呼叫，那時 syncWorkshop 早已宣告。 */
      CONFIG.logoModel = { ...${JSON.stringify(extractExport(read(path.join(__dirname,'logo-panel.js')),'LOGO_MODEL_DEFAULTS'))}, ...(CONFIG.logoModel || {}) };
      DEFAULT_CONFIG.logoModel = { ...${JSON.stringify(extractExport(read(path.join(__dirname,'logo-panel.js')),'LOGO_MODEL_DEFAULTS'))} };
      mountLogoPanel({ config: CONFIG, defaults: DEFAULT_CONFIG, sections: ${JSON.stringify(sections)}, getWorld: () => world, getJourney: () => journey, onChange: () => syncWorkshop() });
      document.addEventListener('click', event => {
        if (!event.target.closest?.('.finnovation-ui [data-next]')) return;`, 'mount');
  return main;
}

module.exports = ({ main, drops, letters, glass, html, extra = {} }) => {
  const sections = buildSections();
  if (!sections) { console.log('logo panel: world-logo-mark.js / world-logo-scene.js missing, panel skipped'); return { main, drops, letters, glass, html, extra: {} }; }
  main = patchMain(main, sections);
  console.log('Logo panel: ' + sections.length + ' sections, ' + sections.reduce((n, s) => n + s.rows.length, 0) + ' rows');
  return { main, drops, letters, glass, html, extra: { 'logo-panel.js': read(path.join(__dirname, 'logo-panel.js')) } };
};
module.exports.SECTIONS = SECTIONS;
module.exports.buildSections = buildSections;
module.exports.patchMain = patchMain;
module.exports.extractExport = extractExport;
module.exports.modelDefaults = () => extractExport(read(path.join(__dirname,'logo-panel.js')),'LOGO_MODEL_DEFAULTS');

/* Scoped sync, no rebuild: put just the panel into the ALREADY GENERATED js/main.js + js/logo-panel.js (what build.cjs would add), leaving every
   other generated file as it is — for when someone else's source edits are not ready to ship. Idempotent. `node logo-panel-build.cjs --sync` */
module.exports.syncGenerated = function syncGenerated() {
  const dir = path.join(__dirname, 'js'), file = path.join(dir, 'main.js');
  const main = fs.readFileSync(file, 'utf8');
  /* the module itself is refreshed every time (it has no imports); main.js is only patched once */
  fs.writeFileSync(path.join(dir, 'logo-panel.js'), '/* index1-5 generated by prototypes/index1-5/build.cjs */\n' + read(path.join(__dirname, 'logo-panel.js')));
  if (main.includes('mountLogoPanel')) { console.log('logo panel: main.js already has it; js/logo-panel.js refreshed'); return false; }
  const ver = (/from '\.\/scene-daylight\.js\?v=([0-9A-Za-z_-]+)'/.exec(main) || [])[1];
  if (!ver) throw new Error('logo panel sync: cannot read the generated version stamp');
  /* the rows come from the SHIPPED modules (js/), so the panel matches what is actually live, not another session's unbuilt source */
  const sections = buildSections(dir); if (!sections) throw new Error('logo panel sync: modules missing');
  const nl = main.includes('\r\n') ? '\r\n' : '\n';
  const patched = patchMain(main.replace(/\r\n/g, '\n'), sections, ver).replace(/\n/g, nl);
  fs.writeFileSync(file, patched);
  console.log('logo panel: synced into js/main.js (version ' + ver + ') and js/logo-panel.js');
  return true;
};
if (require.main === module && process.argv.includes('--sync')) module.exports.syncGenerated();
