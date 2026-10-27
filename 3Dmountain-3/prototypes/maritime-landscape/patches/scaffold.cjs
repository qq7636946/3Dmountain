// Scaffold the independent Maritime test build. Production files are only READ.
//   index1-3-maritime.html                      <- copy of index1-3.html, loads the copied main.js
//   prototypes/maritime-landscape/js/main.js     <- copy of js/main.js, imports rewired
//   prototypes/maritime-landscape/js/water-journey-scene-463.js, water-canyon-watershed-463.js, water-confluence-fx-463.js
// Re-running overwrites the COPIES (refuses if a copy has been edited since, unless --force).
const fs = require('fs');
const path = require('path');
const ROOT = 'G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3';
const OUT = path.join(ROOT, 'prototypes/maritime-landscape');
const JS = path.join(OUT, 'js');
const force = process.argv.includes('--force');
const LOCAL = ['water-journey-scene-463.js', 'water-canyon-watershed-463.js', 'water-confluence-fx-463.js'];
fs.mkdirSync(JS, { recursive: true });

const guard = f => { if (fs.existsSync(f) && !force) { console.error('exists, not overwriting (use --force): ' + f); process.exit(2); } };

// main.js: local copies stay './X', everything else goes back to the production folder.
let main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
let rewired = 0, kept = 0;
main = main.replace(/(from\s+|import\(\s*)'\.\/([^'?]+)(\?[^']*)?'/g, (m, pre, file, q) => {
  if (LOCAL.includes(file)) { kept++; return `${pre}'./${file}?v=maritime'`; }
  rewired++; return `${pre}'../../../js/${file}${q || ''}'`;
});
main = '/* MARITIME TEST COPY of js/main.js (2026-10-20). Production js/main.js is untouched; see prototypes/maritime-landscape/README.md. */\n' + main;
const mainOut = path.join(JS, 'main.js'); guard(mainOut); fs.writeFileSync(mainOut, main);

for (const f of LOCAL) {
  let src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  src = src.replace(/(from\s+)'\.\/([^'?]+)(\?[^']*)?'/g, (m, pre, file) => LOCAL.includes(file) ? `${pre}'./${file}?v=maritime'` : `${pre}'../../../js/${file}'`);
  src = `/* MARITIME TEST COPY of js/${f} (2026-10-20). Production file untouched. */\n` + src;
  const o = path.join(JS, f); guard(o); fs.writeFileSync(o, src);
}

// The page: same shell, new entry, never indexed.
let html = fs.readFileSync(path.join(ROOT, 'index1-3.html'), 'utf8');
const before = html.length;
html = html.replace(/js\/main\.js\?v=[0-9a-f]+/g, 'prototypes/maritime-landscape/js/main.js?v=maritime');
html = html.replace('<html lang="zh-Hant" prefix="og: https://ogp.me/ns#">', '<html lang="zh-Hant" prefix="og: https://ogp.me/ns#" data-look="maritime">');
html = html.replace('<meta name="robots" content="index, follow, max-image-preview:large">', '<meta name="robots" content="noindex, nofollow">');
html = html.replace('<title>恒灝創新 FINNOVATION｜科技賦能・金融加值</title>', '<title>恒灝創新 FINNOVATION｜Maritime 寫實山海測試版</title>');
html = html.replace('<link rel="stylesheet" href="css/glass-refinement.css?v=795411628b">', '<link rel="stylesheet" href="css/glass-refinement.css?v=795411628b">\n  <link rel="stylesheet" href="prototypes/maritime-landscape/maritime.css?v=maritime">');
const pageOut = path.join(ROOT, 'index1-3-maritime.html'); guard(pageOut); fs.writeFileSync(pageOut, html);
const cssOut = path.join(OUT, 'maritime.css'); if (!fs.existsSync(cssOut)) fs.writeFileSync(cssOut, '/* Maritime test look: page-level overrides (overlays, UI tints). */\n');
console.log(JSON.stringify({ rewired, kept, htmlDelta: html.length - before, entryHits: (html.match(/maritime-landscape\/js\/main\.js/g) || []).length }));
