/* index1-5 has one typography owner. Legacy scene sheets contribute layout only.
   Run: node prototypes/index1-5-morning-20261026/editorial-polish-build.cjs (no WebGL rebuild). */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const SOURCES = [
  'css/base.css', 'css/journey-story.css', 'css/interface.css', 'css/glass-refinement.css',
  'css/world.css', 'prototypes/index1-5-morning-20261026/index1-5.css',
  ...['world-ocean','world-logo','daylight-ui','header-brand','world-principles','section-motion','editorial-polish'].map(n => `prototypes/index1-5-morning-20261026/${n}.css`),
];
const TYPE_PROPERTY = /^(?:font(?:-[a-z-]+)?|line-height|letter-spacing|word-spacing|text-transform|text-shadow|text-rendering|-webkit-font-smoothing|--(?:ep-[\w-]+|editorial-font|alp-(?:sans|display|mono|num)|fiwo-(?:display|mono)|fisl-(?:display|mono)))$/;
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
function layoutOnly(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^{}]*\}/g, '');
  // All selected declarations have scalar CSS values (no URL/data payloads).
  css = css.replace(/(?<=[{;])\s*([\w-]+)\s*:\s*([^;{}]*)(?:;|(?=\}))/g,
    (declaration, property) => TYPE_PROPERTY.test(property) ? '' : declaration);
  let previous;
  do { previous = css; css = css.replace(/[^{};]+\{\s*\}/g, ''); } while(css !== previous);
  return css.trim();
}
function buildLayout() {
  const output = path.join(__dirname, 'site-layout.css');
  const css = '/* Generated layout only. Edit typography.css for ALL fonts, sizes, weights and tracking. */\n' + SOURCES.map(file => {
    let source = layoutOnly(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    source = source.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (all, quote, url) => {
      if (/^(?:data:|https?:|\/|#)/.test(url)) return all;
      const resolved = path.resolve(ROOT, path.dirname(file), url);
      const relative = path.relative(path.dirname(output), resolved).split(path.sep).join('/');
      return `url(${quote}${relative}${quote})`;
    });
    return `\n/* Layout: ${file} */\n${source}\n`;
  }).join('');
  fs.writeFileSync(output, css);
  return hash(css);
}
function patchWorld(world) {
  world = world.replace(/\r\n/g, '\n');
  if (world.includes('data-i15-layout')) return world;
  const anchor = "  const styled = new Promise(resolve => { style.onload = resolve; style.onerror = resolve; });\n  document.head.append(style);";
  if (!world.includes(anchor)) throw new Error('Unified styles: world stylesheet anchor missing');
  return world.replace(anchor, `  // The page bundle already contains world layout; do not load the old type rules again.
  const pageStyles = document.querySelector('link[data-i15-layout]');
  const styled = pageStyles ? Promise.resolve() : new Promise(resolve => { style.onload = resolve; style.onerror = resolve; });
  if (!pageStyles) document.head.append(style);`);
}
function patch({ html }) {
  const layoutHash = buildLayout();
  const typography = fs.readFileSync(path.join(__dirname, 'typography.css'), 'utf8');
  if (/!important/.test(typography)) throw new Error('Typography must use normal cascade priority');
  const typeHash = hash(typography);
  // The no-JS document layout must still load after the normal page layout.
  let readable = '';
  html = html.replace(/<noscript>\s*<link\b[^>]*href=["']\.\/css\/readable\.css["'][^>]*>\s*<\/noscript>\s*/g, block => {
    readable = block.trim();
    return '';
  });
  html = html.replace(/<link\b[^>]*>/g, tag => {
    if (/data-i15-(?:font|typography|editorial|layout)/.test(tag)) return '';
    const href = tag.match(/href=["']([^"']+)/)?.[1]?.replace(/^\.\//,'').split('?')[0];
    return SOURCES.includes(href) ? '' : tag;
  });
  html = html.replace(/https:\/\/fonts\.googleapis\.com\/css2\?family=Montserrat[^"']*/g,
    'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500&display=swap');
  const links = [
    '  <link rel="preload" href="prototypes/index1-5-morning-20261026/assets/fonts/dm-sans/latin.woff2" as="font" type="font/woff2" crossorigin data-i15-font>',
    `  <link rel="stylesheet" href="prototypes/index1-5-morning-20261026/site-layout.css?v=${layoutHash}" data-i15-layout>`,
    `  <link rel="stylesheet" href="prototypes/index1-5-morning-20261026/typography.css?v=${typeHash}" data-i15-typography>`,
  ].join('\n');
  if (!html.includes('</head>')) throw new Error('Unified styles: missing head');
  html = html.replace(/\s*<\/head>/, '\n' + links + '\n' + (readable ? '  ' + readable + '\n' : '') + '</head>');
  return { html };
}
module.exports = patch;
module.exports.patchWorld = patchWorld;
module.exports.layoutOnly = layoutOnly;
module.exports.sources = SOURCES;
