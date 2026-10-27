#!/usr/bin/env node
/* One-off migration (2026-10-10): split index.html into HTML + css/ + js/, and sort the project into
 *   css/  js/  images/  media/  models/  docs/  _archive/
 * Nothing is deleted: everything that the live page does not use is MOVED to _archive/ and every edited original is
 * kept in _archive/pre-restructure/.  docs/restructure-manifest.json records each move so scripts/restructure/undo.cjs can reverse it.
 *
 *   node scripts/restructure/restructure.cjs --src <projectRoot> --out <dir>            # stage: build the new tree in <dir> (copies, source untouched)
 *   node scripts/restructure/restructure.cjs --src <projectRoot> --apply --yes [--expect <sha256-prefix of index.html>]
 */
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const A = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith('--')) continue; const n = process.argv[i + 1]; if (n !== undefined && !n.startsWith('--')) { A[a.slice(2)] = n; i++; } else A[a.slice(2)] = true; }
const SRC = path.resolve(A.src || '.');
const APPLY = !!A.apply;
if (APPLY && !A.yes) throw new Error('--apply modifies the real folder; pass --yes to confirm');
if (!APPLY && !A.out) throw new Error('stage mode needs --out <dir>');
const OUT = APPLY ? SRC : path.resolve(A.out);
if (!APPLY && (OUT === SRC || OUT.startsWith(SRC + path.sep))) throw new Error('--out must be outside the source tree');

// ------------------------------------------------------------------ what is live, and where it goes
const LIVE_JS = ['finnovation-cursor.js', 'finnovation-interface.js', 'water-canyon-watershed-463.js', 'water-confluence-fx-463.js', 'water-forward-transition.js',
  'water-journey-river.js', 'water-journey-scene-463.js', 'water-journey-story.js', 'water-logo-cards.js', 'water-logo-drops.js', 'water-logo-geometry.js',
  'water-logo-geometry-client.js', 'water-logo-geometry-worker.js', 'water-logo-geometry-worker.bundle.js', 'water-logo-reference-glass.js'];
const MOVES = [   // [old, new] (files or whole folders)
  ...LIVE_JS.map(f => [f, 'js/' + f]),
  ['finnovation-readable.css', 'css/readable.css'],
  ['logo.svg', 'images/logo.svg'], ['text_logo2.svg', 'images/text_logo2.svg'], ['text_logo3.svg', 'images/text_logo3.svg'],
  ['slide-assets', 'images/slides'],
  ['logo.mp4', 'media/logo.mp4'],
  ['drop_of_water', 'models/drop_of_water'],
  ['index4-6-3-optimization-report.md', 'docs/optimization-report-2026-10-01.md'],
];
// not used by the live page -> _archive/<bucket>/  (hosting artefacts dist/ build/ worker/ .openai/ and tooling scripts/ .qa/ stay where they are)
const ARCHIVE = {
  '1010_bk': 'backups', 'backups': 'backups',
  'arcade-main': 'demos', 'arcade-main.zip': 'demos', 'interactive-droplets-main': 'demos', 'interactive-droplets-main.zip': 'demos',
  '3_mountain': 'models', 'snowy_mountain_v2_-_terrain': 'models', 'earth': 'models', 'earth_B': 'models', 'orb_morb': 'models', 'boeing_747-100': 'models',
  'cargo_ship_runtime': 'models', 'water_droplet': 'models', 'water_orb': 'models', 'river_water_runtime': 'models',
  'xx': 'misc', 'dist-expanded-backup': 'misc', 'logo.gltf': 'misc', 'text_logo.svg': 'misc',
  'images/river.mp4': 'misc', 'images/river2.mp4': 'misc',
};
const LEGACY_JS_BUCKET = 'legacy-js';   // every other *.js at the root
const KEEP_AT_ROOT = new Set(['index.html', 'index2.html', 'sitemap.xml', '.gitignore', '.git', '.claude', '.openai', '.vscode', '.qa', 'scripts', 'dist', 'build', 'worker', 'README.md',
  'css', 'js', 'images', 'media', 'models', 'docs', '_archive']);

// ------------------------------------------------------------------ exact-string edits (count is asserted)
const HTML_EDITS = [
  ['href="logo.svg"', 'href="images/logo.svg"', 1],
  ['src="logo.mp4"', 'src="media/logo.mp4"', 1],
  ['href="./finnovation-readable.css"', 'href="./css/readable.css"', 1],
  ['style.href = "./finnovation-readable.css"', 'style.href = "./css/readable.css"', 1],
];
const MAIN_EDITS = [
  ["gltfLoader.load('drop_of_water/scene.gltf'", "gltfLoader.load('models/drop_of_water/scene.gltf'", 1],
  ["url: 'logo.svg'", "url: 'images/logo.svg'", 1],
  ["url: 'text_logo2.svg'", "url: 'images/text_logo2.svg'", 1],
  ["url: 'text_logo3.svg'", "url: 'images/text_logo3.svg'", 1],
];
const MODULE_EDITS = {
  'water-logo-cards.js': [["'./slide-assets/'", "'./images/slides/'", 1]],
  'water-logo-drops.js': [["'./slide-assets/'", "'./images/slides/'", 1]],
};
const SCRIPT_EDITS = {
  'scripts/seo/build-static-interface.mjs': [
    ["from '../../finnovation-interface.js'", "from '../../js/finnovation-interface.js'", 1],
    ["files.push('index4-6-3.html')", "files.push('index.html')", 1]],
  'scripts/seo/check-seo.mjs': [
    ["from '../../finnovation-interface.js'", "from '../../js/finnovation-interface.js'", 1],
    ["process.argv[2] || 'index4-6-3.html'", "process.argv[2] || 'index.html'", 1],
    ["const base = new URL('.',canonical);",
     "const base = new URL('.',canonical);\n// Whitespace-insensitive view: a formatter may re-wrap the page (multi-line <meta>, <noscript>) without changing its content.\nconst flat = s => s.replace(/\\s+/g,' ').replace(/\\s*([<>])\\s*/g,'$1').replace(/ \\/>/g,'/>').trim();\nconst htmlFlat = flat(html);", 1],
    ["[...html.matchAll(new RegExp(`<meta (?:name|property)=\"${name.replaceAll(':','\\\\:')}\" content=\"([^\"]*)\">`,'g'))]",
     "[...htmlFlat.matchAll(new RegExp(`<meta (?:name|property)=\"${name.replaceAll(':','\\\\:')}\" content=\"([^\"]*)\" ?/?>`,'g'))]", 1],
    ["assert(content.includes(renderJourneyInterface()),", "assert(flat(content).includes(flat(renderJourneyInterface())),", 1],
    ["assert(html.includes('<noscript><link rel=\"stylesheet\" href=\"./finnovation-readable.css\"></noscript>'));",
     "assert(htmlFlat.includes('<noscript><link rel=\"stylesheet\" href=\"./css/readable.css\"></noscript>'));", 1],
    ["path.join(root,'finnovation-readable.css')", "path.join(root,'css/readable.css')", 1]],
  'scripts/build-logo-worker.cjs': [
    ["path.join(root, 'water-logo-geometry-worker.js')", "path.join(root, 'js', 'water-logo-geometry-worker.js')", 1],
    ["path.join(root, 'water-logo-geometry-worker.bundle.js')", "path.join(root, 'js', 'water-logo-geometry-worker.bundle.js')", 1]],
};
const README_DOC_EDITS = [   // documentation wording only, counts not asserted
  ['finnovation-readable.css', 'css/readable.css'], ['`finnovation-interface.js`', '`js/finnovation-interface.js`'], ['`index4-6-3.html` 是編輯來源', '`index.html` 是編輯來源'], ['index4-6-3.html', 'index.html'],
];

// ------------------------------------------------------------------ helpers
const rd = rel => fs.readFileSync(path.join(SRC, rel), 'utf8');
const has = rel => fs.existsSync(path.join(SRC, rel));
const norm = p => p.split(path.sep).join('/');
const count = (s, sub) => s.split(sub).length - 1;
const manifest = { generated: new Date().toISOString(), mode: APPLY ? 'apply' : 'stage', src: norm(SRC), moves: [], writes: [], backups: [], notes: [] };
function edit(text, pairs, label, strict = true) {
  for (const [from, to, n] of pairs) { const c = count(text, from); if (strict && n !== undefined && c !== n) throw new Error(`${label}: expected ${n} x ${JSON.stringify(from)}, found ${c}`); text = text.split(from).join(to); }
  return text;
}
const mk = d => fs.mkdirSync(d, { recursive: true });
function copyRec(a, b) { const st = fs.statSync(a); if (st.isDirectory()) { mk(b); for (const n of fs.readdirSync(a)) copyRec(path.join(a, n), path.join(b, n)); } else { mk(path.dirname(b)); fs.copyFileSync(a, b); } }
function renameRetry(a, b) { for (let i = 0; ; i++) { try { fs.renameSync(a, b); return; } catch (e) { if (i >= 6 || !['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500 * (i + 1)); } } }
function write(rel, content) { const p = path.join(OUT, rel); mk(path.dirname(p)); fs.writeFileSync(p, content); manifest.writes.push(norm(rel)); }
function backupOriginal(rel) {   // apply: keep the untouched original; stage: nothing to do
  if (!APPLY) return; const to = '_archive/pre-restructure/' + rel; const dst = path.join(OUT, to); mk(path.dirname(dst)); renameRetry(path.join(SRC, rel), dst); manifest.backups.push({ from: norm(rel), to }); }
function place(oldRel, newRel) {
  if (!has(oldRel)) { manifest.notes.push('missing, skipped: ' + oldRel); return; }
  const dst = path.join(OUT, newRel); if (fs.existsSync(dst)) throw new Error('destination exists: ' + newRel); mk(path.dirname(dst));
  if (APPLY) renameRetry(path.join(SRC, oldRel), dst); else copyRec(path.join(SRC, oldRel), dst);
  manifest.moves.push({ from: norm(oldRel), to: norm(newRel) });
}
function placeText(oldRel, newRel, transform) {   // moved AND edited
  if (!has(oldRel)) { manifest.notes.push('missing, skipped: ' + oldRel); return; }
  const text = transform(rd(oldRel)); backupOriginal(oldRel); write(newRel, text);
  manifest.moves.push({ from: norm(oldRel), to: norm(newRel), edited: true });
}

// ------------------------------------------------------------------ 1. index.html -> html + css + js
const srcHtml = rd('index.html');
const srcHash = crypto.createHash('sha256').update(srcHtml).digest('hex').slice(0, 12);
if (A.expect && A.expect !== srcHash) throw new Error(`index.html changed since the stage run (${srcHash} != ${A.expect}); re-run stage and verify again`);
const version = (srcHtml.match(/name="build-version" content="([^"]+)"/) || [])[1] || 'dev';
const bodyAt = srcHtml.indexOf('<body');
if (bodyAt < 0) throw new Error('no <body>');
let head = srcHtml.slice(0, bodyAt), rest = srcHtml.slice(bodyAt);
const NAMES = { '': 'base', 'id="journey-story-style"': 'journey-story', 'id="finnovation-interface-style"': 'interface', 'id="finnovation-glass-refinement"': 'glass-refinement' };
const css = [];
head = head.replace(/([ \t]*)<style([^>]*)>([\s\S]*?)<\/style>/g, (m, indent, attrs, body) => {
  const name = NAMES[attrs.trim()]; if (!name) throw new Error('unexpected <style ' + attrs + '>');
  css.push({ name, body }); return `${indent}<link rel="stylesheet" href="css/${name}.css?v=${version}">`;
});
if (css.length !== 4) throw new Error('expected 4 inline <style> blocks, found ' + css.length);
const EOL = srcHtml.includes('\r\n') ? '\r\n' : '\n';
const open = '<script type="module" id="journeyModule" onerror="showFinnovationText()">';
const iOpen = rest.indexOf(open); if (iOpen < 0 || count(rest, open) !== 1) throw new Error('module <script> not found exactly once');
const iBody = iOpen + open.length, iClose = rest.indexOf('</script>', iBody);
const tail = rest.slice(iClose + '</script>'.length);
if (/<script/.test(tail)) throw new Error('unexpected <script> after the module');
const mainBody = edit(rest.slice(iBody, iClose), MAIN_EDITS, 'main.js');
rest = rest.slice(0, iOpen) + `<script type="module" id="journeyModule" src="js/main.js?v=${version}" onerror="showFinnovationText()"></script>` + tail;
const pre = '<link rel="modulepreload" href="https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js">';
if (count(head, pre) !== 1) throw new Error('three modulepreload not found exactly once');
head = head.replace(pre, `${pre}${EOL}  <link rel="modulepreload" href="js/main.js?v=${version}">`);
// The import map must precede every modulepreload and module script, otherwise the browser ignores it and 'three' cannot be resolved
// (found the hard way on 2026-10-10: with the map left at the end of <body>, a slow stylesheet left the page on the loader for good).
const IM_RE = /[ \t]*<script type="importmap">[\s\S]*?<\/script>[ \t]*\r?\n?(\r?\n)?/;
const im = rest.match(IM_RE); if (!im || count(rest, '<script type="importmap">') !== 1) throw new Error('import map not found exactly once in the body');
rest = rest.replace(im[0], '');
const anchor = '  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>';
if (count(head, anchor) !== 1) throw new Error('jsdelivr preconnect anchor not found exactly once');
head = head.replace(anchor, `  <!-- The import map must stay ABOVE every modulepreload and every module <script>. If a module graph starts loading first,${EOL}       the map is ignored, "three" cannot be resolved and the page sits on the loader for good. -->${EOL}` + im[0].replace(/\r?\n+$/, '').replace(/^[ \t]*/, '  ') + EOL + anchor);
let newHtml = edit(head + rest, HTML_EDITS, 'index.html');
// Safety net: a module graph that dies after it was fetched raises a window error (no `error` event on the <script>); fall back to the readable page.
const WATCHDOG = [
  "    // A module graph that dies AFTER it was fetched (unresolved import, blocked CDN) raises a window error instead of the script's",
  "    // `error` event, which used to leave the loader up for good. Before the scene is ready that is fatal anyway: show the readable page.",
  "    window.addEventListener('error', function (e) {",
  "      if (!document.body.classList.contains('is-ready') && document.documentElement.dataset.renderMode !== 'text' && /Failed to resolve module specifier|Importing a module script failed|Failed to fetch dynamically imported module/i.test(String(e.message))) window.showFinnovationText();",
  "    });"];
const WD_RE = /(window\.showFinnovationText = function \(\) \{[\s\S]*?\r?\n    \};)(\r?\n  <\/script>)/;
if (!WD_RE.test(newHtml)) throw new Error('showFinnovationText block not found');
newHtml = newHtml.replace(WD_RE, (m, a, b) => a + EOL + WATCHDOG.join(EOL) + b);
const banner = (what) => `/* ${what} — extracted verbatim from index.html on 2026-10-10 (no code changes; only asset paths updated). */${EOL}`;

if (APPLY) backupOriginal('index.html');
write('index.html', newHtml);
for (const { name, body } of css) write(`css/${name}.css`, banner(`css/${name}.css`) + body.replace(/^\r?\n/, ''));
write('js/main.js', banner('js/main.js (journeyModule)') + mainBody.replace(/^\r?\n/, ''));

// ------------------------------------------------------------------ 2. index2.html: same modules, so only the paths change (it keeps its own inline CSS/JS)
if (has('index2.html')) {
  let t = rd('index2.html');
  t = t.replace(/(from\s*['"])\.\/((?:finnovation|water)-[A-Za-z0-9-]+\.js)/g, (m, a, f) => LIVE_JS.includes(f) ? `${a}./js/${f}` : m);
  t = edit(t, [...HTML_EDITS, ...MAIN_EDITS], 'index2.html', false);
  t = t.replace(/(url\s*:\s*')((?:text_)?logo[0-9]*\.svg')/g, '$1images/$2');   // index2 writes  url:'logo.svg'  (no space)
  t = t.replace(/(gltfLoader\.load\(')drop_of_water\//g, '$1models/drop_of_water/');
  backupOriginal('index2.html'); write('index2.html', t);
  manifest.notes.push('index2.html: paths only (inline CSS/JS kept)');
}

// ------------------------------------------------------------------ 3. modules, assets
for (const [from, to] of MOVES) {
  if (MODULE_EDITS[from]) placeText(from, to, t => edit(t, MODULE_EDITS[from], from));
  else place(from, to);
}
if (!APPLY) { for (const f of ['sitemap.xml']) if (has(f)) { copyRec(path.join(SRC, f), path.join(OUT, f)); } }
if (!APPLY) { for (const f of ['images/finnovation-logo.png', 'images/finnovation-social-card.png', 'images/bg.jpg']) if (has(f)) { copyRec(path.join(SRC, f), path.join(OUT, f)); } }

// ------------------------------------------------------------------ 4. scripts (paths) — both modes; stage gets a copy so the SEO gate can run there
for (const [rel, pairs] of Object.entries(SCRIPT_EDITS)) {
  if (!has(rel)) { manifest.notes.push('missing, skipped: ' + rel); continue; }
  const text = edit(rd(rel), pairs.map(([a, b, n]) => [a.replace(/\n/g, rd(rel).includes('\r\n') ? '\r\n' : '\n'), b.replace(/\n/g, rd(rel).includes('\r\n') ? '\r\n' : '\n'), n]), rel);
  if (APPLY) backupOriginal(rel); write(rel, text);
}
if (has('scripts/seo/README.md')) { let t = rd('scripts/seo/README.md'); t = edit(t, README_DOC_EDITS.map(([a, b]) => [a, b]), 'seo README', false); if (APPLY) backupOriginal('scripts/seo/README.md'); write('scripts/seo/README.md', t); }

// ------------------------------------------------------------------ 5. archive everything else (apply only)
if (APPLY) {
  const arch = (rel, bucket) => { if (!has(rel)) { manifest.notes.push('missing, skipped: ' + rel); return; } const to = `_archive/${bucket}/${path.basename(rel)}`; place(rel, to); };
  for (const [rel, bucket] of Object.entries(ARCHIVE)) arch(rel, bucket);
  for (const e of fs.readdirSync(SRC, { withFileTypes: true })) {   // leftovers at the root
    if (KEEP_AT_ROOT.has(e.name) || e.name in ARCHIVE) continue;
    if (e.isFile() && e.name.endsWith('.js')) arch(e.name, LEGACY_JS_BUCKET);
    else manifest.notes.push('left at root (unclassified): ' + e.name);
  }
}

// ------------------------------------------------------------------ 6. manifest
manifest.indexHtmlSha256 = srcHash;
write('docs/restructure-manifest.json', JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({ mode: manifest.mode, out: norm(OUT), indexHtmlSha: srcHash, cssFiles: css.length, mainJsKB: Math.round(mainBody.length / 1024), htmlLines: newHtml.split('\n').length, moves: manifest.moves.length, writes: manifest.writes.length, backups: manifest.backups.length, notes: manifest.notes }, null, 1));
