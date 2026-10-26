/* index1-5 · LOGO 收尾 Logo Seal (2026-10-24). Client: 「新區塊在橫移以下出現，轉場方式跟地球到橫移一樣，中間是 LOGO1 的 LOGO 平旋轉一圈，
   結尾如圖（6.webp）… LOGO 的質感材質還要再調整」. After the horizontal strategies a full-screen water wave carries the sea away and brings in
   a dusk lake with the LOGO 1 glass mark, which turns once with the scroll and ends facing front; then four lines of words, then the footer.
   Live code: world-logo.js (+ world-logo.css), the lake world-logo-scene.js (Interface B), the mark world-logo-mark.js (Interface A);
   until those two specialist files exist the stubs world-logo-*-stub.js are shipped under the same names.
   What this helper does (build.cjs runs it right after world-ocean-build, with the shared `extra`):
   · extra['finnovation-world.js'] (the ocean-patched LOCAL COPY of the shared world module) gets anchored patches: the module, the clocks
     (layout / measure / sample / paint / next / close / state / dispose) and the drawing hook. The shared js/finnovation-world.js is untouched.
   · extra['world-logo.js', 'world-logo-mark.js', 'world-logo-scene.js'] (+ any local module they import).
   · main: CONFIG.logoSeal / logoMark / logoLake defaults, the mount option logo, the tuner group 「LOGO 收尾 Logo Seal」 (live dials).
   · html: <section data-world-part="logo"> before the footer (between LOGO_SEAL markers: idempotent) and <link data-world-logo> to world-logo.css.
   Every anchor must occur exactly once (once() throws otherwise), so a change in the world module stops the build instead of silently
   dropping a hook. ?logoseal=0 removes the section at run time and the page is as it was before. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
function once(src, anchor, repl, label = '') {
  const n = src.split(anchor).length - 1;
  if (n !== 1) throw new Error('index1-5 world-logo anchor' + (label ? ' (' + label + ')' : '') + ': ' + n + ' × ' + anchor.slice(0, 100));
  return src.replace(anchor, () => repl);
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------- THE WORDS (temporary, until the client approves them)
   One place to edit: change here, run `node prototypes/index1-5/build.cjs`. No buttons, no links. */
const COPY = require('./page-copy.cjs').SEAL_COPY;

/* ---------------------------------------------------------------- the tuner rows: ['label', group, key, min, max, step] / colour ['label', group, key] */
const SEAL_ROWS = [
  ['轉場方式（2＝毛玻璃馬賽克 Hubtown／1＝立體方塊／0＝水波）', 'logoSeal', 'transition', 0, 2, 1],
  ['轉場 自己播放（1＝捲過門檻後自己播完，像 Hubtown／0＝跟著捲動）', 'logoSeal', 'cutClock', 0, 1, 1], ['轉場 門檻（佔轉場長度，捲到這裡開始播）', 'logoSeal', 'cutAt', 0, 1, .01],
  ['轉場 播放秒數', 'logoSeal', 'cutTime', .1, 4, .05],
  ['毛玻璃 方塊大小（螢幕高）', 'logoSeal', 'glassSize', .05, 2, .01], ['毛玻璃 切成小塊的機率', 'logoSeal', 'glassSplit', 0, 1, .01],
  ['毛玻璃 方塊錯位', 'logoSeal', 'glassShift', 0, 2, .01], ['毛玻璃 方塊放大', 'logoSeal', 'glassZoom', 0, .6, .01],
  ['毛玻璃 動態模糊長度', 'logoSeal', 'glassBlur', 0, .8, .01], ['毛玻璃 色散（彩色邊）', 'logoSeal', 'glassChroma', 0, 2, .01],
  ['毛玻璃 霧面顆粒', 'logoSeal', 'glassFrost', 0, 3, .05], ['毛玻璃 中段變暗', 'logoSeal', 'glassDip', 0, 1, .01],
  ['毛玻璃 亮處拉出光痕', 'logoSeal', 'glassBloom', 0, 4, .05], ['毛玻璃 光痕門檻（越低越多處發光）', 'logoSeal', 'glassBloomAt', 0, 1, .01],
  ['毛玻璃 igloo 像素拉絲／錯位', 'logoSeal', 'glassGlitch', 0, 2, .01], ['毛玻璃 igloo 底片顆粒', 'logoSeal', 'glassGrain', 0, 2, .01],
  ['毛玻璃 錯開（0 同時換／越大越一塊一塊換）', 'logoSeal', 'glassSpread', 0, .95, .01], ['毛玻璃 接縫與玻璃邊光', 'logoSeal', 'glassSeam', 0, 2, .01],
  ['毛玻璃 整體推進（穿過去的感覺）', 'logoSeal', 'glassPush', 0, .4, .01], ['毛玻璃 色調', 'logoSeal', 'glassTint'],
  ['轉場長度（螢幕高，越小越快）', 'logoSeal', 'wave', .3, 6, .05], ['轉場提早開始（螢幕高，海洋最後一章還沒完全離開時）', 'logoSeal', 'waveLead', 0, 1.5, .01],
  ['立體方塊 數量（長邊幾格）', 'logoSeal', 'tiles', 3, 20, 1], ['立體方塊 下沉深度（格寬倍數）', 'logoSeal', 'tileDepth', 0, 4, .05],
  ['立體方塊 透視距離（越小越立體）', 'logoSeal', 'tilePersp', .3, 6, .05], ['立體方塊 錯開程度（0 同時／越大越依序）', 'logoSeal', 'tileSpread', 0, .95, .01],
  ['立體方塊 亂序（0 照方向／1 完全隨機）', 'logoSeal', 'tileJitter', 0, 1, .01], ['立體方塊 邊緣光強度', 'logoSeal', 'tileGlow', 0, 4, .05],
  ['立體方塊 邊緣光粗細（px）', 'logoSeal', 'tileLine', .2, 8, .1], ['立體方塊 邊緣光顏色', 'logoSeal', 'tileGlowColor'], ['立體方塊 深處底色', 'logoSeal', 'tileField'],
  ['立體方塊 下沉變暗', 'logoSeal', 'tileFog', 0, 1, .01], ['立體方塊 轉場中全格線', 'logoSeal', 'tileGrid', 0, 1, .01], ['立體方塊 側面延伸畫面', 'logoSeal', 'tileExtrude', 0, 1, .01],
  ['波浪方向（度，0＝由下往上，正＝偏右）', 'logoSeal', 'waveAngle', -90, 90, 1], ['波長', 'logoSeal', 'waveLength', .03, .6, .005], ['波高（位移）', 'logoSeal', 'waveAmp', 0, .2, .001],
  ['浪前緣柔和', 'logoSeal', 'waveSoft', .002, .3, .002], ['浪前緣起伏', 'logoSeal', 'wobble', 0, .3, .005],
  ['浪峰亮度', 'logoSeal', 'crest', 0, 4, .05], ['浪花飛沫', 'logoSeal', 'spray', 0, 3, .05],
  ['折射強度（海面被波浪扭曲）', 'logoSeal', 'refract', 0, 3, .05], ['折射強度（湖景被波浪扭曲）', 'logoSeal', 'refractNew', 0, 3, .05],
  ['旋轉開始（佔波浪長度的比例，1＝浪過完才轉）', 'logoSeal', 'spinStart', 0, 1, .01], ['旋轉長度（螢幕高）', 'logoSeal', 'spin', 0, 6, .05],
  ['旋轉完成點（佔旋轉長度，之後停在正面）', 'logoSeal', 'spinEnd', .2, 1, .01], ['旋轉緩動（0 線性／1 緩入緩出）', 'logoSeal', 'spinEase', 0, 1, .01], ['結尾停的角度（度，0＝正對；稍微轉一點才看得到玻璃的厚度）', 'logoSeal', 'restYaw', -45, 45, .5],
  ['旋轉模糊強度（%）', 'logoSeal', 'spinBlur', 0, 100, 1],
  ['停留長度（螢幕高，正面＋文字停著）', 'logoSeal', 'hold', 0, 4, .05],
  ['跟全站日照（0＝固定黃昏 ref-6／1＝跟全站太陽與場景時間）', 'logoSeal', 'followDaylight', 0, 1, 1],
  ['建置時機（進入海洋橫移段後多少螢幕高才開始建湖景＋預熱，0＝一進入就建）', 'logoSeal', 'prepare', 0, 6, .05],
  ['符號升起 開始（佔旋轉長度的比例，0＝旋轉一開始就升）', 'logoSeal', 'riseStart', 0, 1, .01], ['符號升起 完成（佔旋轉長度的比例）', 'logoSeal', 'riseEnd', 0, 1, .01],
  ['符號升起 緩出（0 線性／1 到頂前明顯變慢）', 'logoSeal', 'riseEase', 0, 1, .01],
  ['文字 出現時機（旋轉進度）', 'logoSeal', 'textIn', 0, 1, .01], ['文字 垂直位置（由上）', 'logoSeal', 'textY', .3, .95, .005],
  ['文字 大小', 'logoSeal', 'textSize', .4, 2, .01], ['文字 顯示（0 隱藏）', 'logoSeal', 'textShow', 0, 1, .01],
  ['符號 大小倍率', 'logoSeal', 'markScale', .2, 3, .01], ['符號 上下位移', 'logoSeal', 'markY', -2, 2, .01],
  ['時間流速（湖面、微塵）', 'logoSeal', 'timeScale', 0, 3, .05]
];

/* ---------------------------------------------------------------- reading the specialists' exports without running them (they may import 'three') */
function extractExport(src, name, file) {
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
  const literal = src.slice(start, i);
  try { return new Function('return (' + literal + ')')(); }
  catch (e) { throw new Error('index1-5 world-logo: cannot read ' + name + ' from ' + file + ' (' + e.message + '). Keep it a plain literal.'); }
}
/* [label, key, min, max, step] → [label, group, key, min, max, step]; tolerates rows that already carry a group */
function groupRows(rows, group, defaults, file) {
  return (rows || []).map(row => {
    const r = Array.isArray(row) ? row.slice() : [];
    if (typeof r[1] === 'string' && typeof r[2] === 'string' && !(r[1] in defaults) && (r[2] in defaults)) r.splice(1, 1);
    const key = r[1];
    if (!(key in defaults)) throw new Error('index1-5 world-logo: ' + file + ' has a tuner row for "' + key + '" but no default for it');
    return [r[0], group, ...r.slice(1)];
  });
}

/* the local modules to ship: the real specialist file when it exists, else the stub, under the same name */
function modules() {
  const out = {};
  // LOGOSEAL_STUBS=1 forces the stubs (to test the integration on its own, whatever state the specialists' files are in)
  const have = name => fs.existsSync(path.join(__dirname, name)) && !(process.env.LOGOSEAL_STUBS === '1' && /^world-logo-(mark|scene)\.js$/.test(name));
  const pick = (name, stub) => { const real = have(name); out[name] = read(path.join(__dirname, real ? name : stub)); return { real, file: real ? name : stub }; };
  const mark = pick('world-logo-mark.js', 'world-logo-mark-stub.js'), lake = pick('world-logo-scene.js', 'world-logo-scene-stub.js');
  out['world-logo.js'] = read(path.join(__dirname, 'world-logo.js'));
  // anything those modules import locally ships too (transitively)
  const queue = Object.keys(out);
  while (queue.length) {
    const src = out[queue.pop()];
    for (const m of src.matchAll(/(?:from\s+|import\(\s*)'\.\/([^'?]+)(?:\?[^']*)?'/g)) {
      const file = m[1];
      if (out[file] === undefined && have(file)) { out[file] = read(path.join(__dirname, file)); queue.push(file); }
    }
  }
  return { out, mark, lake };
}

function patchWorld(src) {
  const p = (a, b, label) => { src = once(src, a, b, label); };
  src = src.replace(/^(\/\* index1-5 LOCAL COPY[\s\S]*?\*\/\n)/, (m) => m + '/* + LOGO 收尾 Logo Seal hooks (prototypes/index1-5/world-logo-build.cjs): world-logo.js */\n');
  p("import { createWorldOcean } from './world-ocean.js';\n", "import { createWorldOcean } from './world-ocean.js';\nimport { createWorldLogo } from './world-logo.js';\n", 'import');
  // 2026-10-25 fix (client: from the bottom, the brand logo / chapter links broke the page): frame() gives the canvas an inline
  // `visibility: visible`, which beats the root's `visibility: hidden` — after a close from a link its last frame (globe, ocean, lake)
  // stayed on screen over the journey. Hide it together with the root.
  p("    root.inert = true; root.setAttribute('aria-hidden', 'true');", "    root.inert = true; root.setAttribute('aria-hidden', 'true');\n    canvas.style.visibility = 'hidden'; shown = false;   /* index1-5: the canvas' own inline visibility would keep its last frame over the journey */", 'close hides canvas');
  p("ocean: oceanConfig = () => null })", "ocean: oceanConfig = () => null, logo: logoConfig = () => null })", 'signature');
  // the block follows the ocean's horizontal section (it needs the ocean's DOM already rearranged)
  p("  /* GSAP's scroll reveals stay off the horizontal section (it reveals its chapters itself, by stop) */\n", `  /* index1-5 logo seal (world-logo.js): after the horizontal strategies a water wave carries the sea away and the LOGO 1 glass mark
     turns once over a dusk lake; null when the markup is not there or ?logoseal=0 (then all below runs as before). */
  const logo = ocean ? createWorldLogo({
    root, reducedMotion, config: logoConfig, small: Math.min(screen.width, screen.height) < 700 || (navigator.deviceMemory && navigator.deviceMemory < 4),
    go: value => { yt = clamp(value, 0, maxY); run(); }, remeasure: () => { measure(); refreshTriggers(); run(); }
  }) : null;
  /* GSAP's scroll reveals stay off the horizontal section (it reveals its chapters itself, by stop) */
`, 'create');
  // measuring: the block sizes its section, then reads where it is (the footer's top follows it by itself)
  p("    ocean?.layout(W, H);\n", "    ocean?.layout(W, H);\n    logo?.layout(W, H);\n", 'layout');
  p("    ocean?.measure(at, top);\n", "    ocean?.measure(at, top);\n    logo?.measure(at, top);\n", 'measure');
  // the clock
  p("    const o = ocean ? ocean.sample(yy) : null;\n", "    const o = ocean ? ocean.sample(yy) : null;\n    logo?.shape(o, yy);\n", 'shape');
  p("o, footerTop: at.footer - yy", "o, l: logo ? logo.sample(yy) : null, footerTop: at.footer - yy", 'sample l');
  // drawing: the block draws the whole frame from the wave on (the sea is then an offscreen picture)
  p("    ocean?.render(s, time);\n    renderer.render(scene, camera);",
    `    const logoDrawn = logo ? logo.render(s, time, { renderer, world: () => ocean?.render(s, time), draw: () => renderer.render(scene, camera) }) : false;
    if (!logoDrawn) { ocean?.render(s, time); renderer.render(scene, camera); }`, 'render');
  p("    ocean?.paint(s);\n", "    ocean?.paint(s);\n    logo?.paint(s);\n", 'paint');
  // EXPLORE: the lake is a stop of its own (declaration → strategies → lake → footer)
  p(": [at.resp + H * .3]), maxY].sort(", ": [at.resp + H * .3]), ...(logo ? [logo.stopY()] : []), maxY].sort(", 'next');
  // the last strategy's pill (world-logo.js turns CONTACT into data-world-go="logo"): the block's stop
  p(": name === 'contact' ? maxY : 0;", ": name === 'logo' ? (logo ? logo.stopY() : maxY) : name === 'contact' ? maxY : 0;", 'nav logo');
  // lifecycle + diagnostics
  p("    ocean?.close();\n", "    ocean?.close();\n    logo?.close();\n", 'close');
  p("ocean: ocean?.state,", "ocean: ocean?.state, logo: logo?.state,", 'state');
  p("      ocean?.dispose();\n", "      logo?.dispose();\n      ocean?.dispose();\n", 'dispose');
  return src;
}

module.exports = ({ main, drops, letters, glass, html, extra }) => {
  if (!extra || typeof extra['finnovation-world.js'] !== 'string') throw new Error('index1-5 world-logo: extra["finnovation-world.js"] missing (world-ocean-build must run first, and build.cjs must pass extra to the helpers)');
  const logoSrc = read(path.join(__dirname, 'world-logo.js'));
  const dm = logoSrc.match(/\/\*LOGOSEAL-DEFAULTS\*\/([\s\S]*?)\/\*\/LOGOSEAL-DEFAULTS\*\//);
  if (!dm) throw new Error('index1-5 world-logo: defaults block not found in world-logo.js');
  const seal = JSON.parse(dm[1]);
  for (const [, group, key] of SEAL_ROWS) if (group !== 'logoSeal' || !(key in seal)) throw new Error('index1-5 world-logo: dial without a default: ' + key);

  const { out, mark, lake } = modules();
  const markDefaults = extractExport(out['world-logo-mark.js'], 'MARK_DEFAULTS', mark.file) || {}, markRows = extractExport(out['world-logo-mark.js'], 'MARK_ROWS', mark.file) || [];
  const lakeDefaults = extractExport(out['world-logo-scene.js'], 'LAKE_DEFAULTS', lake.file) || {}, lakeRows = extractExport(out['world-logo-scene.js'], 'LAKE_ROWS', lake.file) || [];
  JSON.parse(JSON.stringify(markDefaults)); JSON.parse(JSON.stringify(lakeDefaults));
  const orbitRows = groupRows(lakeRows.filter(([, key]) => key.startsWith('orbit')), 'logoLake', lakeDefaults, lake.file);
  const rows = [...SEAL_ROWS, ...groupRows(markRows, 'logoMark', markDefaults, mark.file), ...groupRows(lakeRows.filter(([, key]) => !key.startsWith('orbit')), 'logoLake', lakeDefaults, lake.file)];

  /* ---- main.js ---- */
  main = once(main, 'ocean: () => CONFIG.worldOcean,', 'ocean: () => CONFIG.worldOcean, logo: () => CONFIG,', 'mount option');
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* LOGO 收尾 Logo Seal（world-logo-build.cjs）：橫移之後的波浪轉場、符號旋轉一圈、黃昏湖。logoMark／logoLake 是材質與場景的參數。 */
      CONFIG.logoSeal = ${JSON.stringify(seal)};
      CONFIG.logoMark = ${JSON.stringify(markDefaults)};
      CONFIG.logoLake = ${JSON.stringify(lakeDefaults)};
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'defaults');
  main = once(main, "          ['卡牌轉場 Cards', [", `          /* LOGO 收尾 Logo Seal：海洋橫移之後（波浪轉場 → 黃昏湖 → 符號旋轉一圈 → 文字）；符號材質與湖景的列來自各自的模組 */
          ['LOGO 環繞光點', ${JSON.stringify(orbitRows)}],
          ['LOGO 收尾 Logo Seal', ${JSON.stringify(rows)}],
          ['卡牌轉場 Cards', [`, 'tuner');
  main = once(main, "const logoGroupOrder = [", "const logoGroupOrder = ['LOGO 環繞光點', ", 'orbit tuner order');
  // (inserted before 'worldOcean': the helpers after this one anchor on the list's tail)
  main = once(main, "'relief', 'logoTerrain', 'worldOcean'].includes(groupKey);", "'relief', 'logoTerrain', 'logoSeal', 'logoMark', 'logoLake', 'worldOcean'].includes(groupKey);", 'live dials');

  /* ---- html: the section before the footer, the stylesheet (content-hashed); both idempotent ---- */
  const section = `        <!-- LOGO_SEAL_START · prototypes/index1-5/world-logo-build.cjs (COPY there is the one place to edit the words) -->
        <section class="fisl" id="logo-seal" data-world-part="logo" data-pill="${escape(COPY.pill)}" aria-labelledby="fislTitle">
          <div class="fisl-pin">
            <div class="fisl-text">
              <p class="fisl-kicker" lang="en"><span>${escape(COPY.kicker)}</span></p>
              <h2 class="fisl-title" id="fislTitle" lang="en">${escape(COPY.title)}</h2>
              <p class="fisl-zh" lang="zh-Hant">${escape(COPY.zh)}</p>
              <p class="fisl-line" lang="zh-Hant">${escape(COPY.line)}</p>
            </div>
          </div>
        </section>
        <!-- LOGO_SEAL_END -->
`;
  html = html.replace(/[ \t]*<!-- LOGO_SEAL_START[\s\S]*?LOGO_SEAL_END -->\n?/g, '');
  const footer = '        <footer class="fiw-footer fiw-grid" id="contact" data-world-part="contact"';
  html = once(html, footer, section + footer, 'html footer');
  const css = read(path.join(__dirname, 'world-logo.css'));
  const hash = crypto.createHash('md5').update(css).digest('hex').slice(0, 10);
  html = html.replace(/\n[ \t]*<link rel="stylesheet" href="prototypes\/index1-5\/world-logo\.css[^"]*" data-world-logo>/g, '');
  const anchor = html.match(/\n[ \t]*<link rel="stylesheet" href="prototypes\/index1-5\/world-ocean\.css[^"]*" data-world-ocean>/g);
  if (!anchor || anchor.length !== 1) throw new Error('index1-5 world-logo: html anchor (world-ocean.css link) × ' + (anchor ? anchor.length : 0));
  html = html.replace(anchor[0], () => anchor[0] + `\n  <link rel="stylesheet" href="prototypes/index1-5/world-logo.css?v=${hash}" data-world-logo>`);

  /* ---- the local modules ---- */
  extra['finnovation-world.js'] = patchWorld(extra['finnovation-world.js']);
  const add = { ...out, 'finnovation-world.js': extra['finnovation-world.js'] };
  for (const [k, v] of Object.entries(add)) extra[k] = v;
  console.log('Logo seal: lake = ' + lake.file + ', mark = ' + mark.file + ', ' + rows.length + ' tuner rows');
  return { main, drops, letters, glass, html, extra: add };
};
/* for test harnesses */
module.exports.COPY = COPY;
module.exports.SEAL_ROWS = SEAL_ROWS;
