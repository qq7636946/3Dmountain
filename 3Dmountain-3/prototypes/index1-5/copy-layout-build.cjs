/* Local to index1-5 (2026-11-04). The chapter titles' letter-by-letter reveal, and on request the copy layout after the client's "NEXT"
   sample: links copy-layout.css right after title-water.css (it re-sets the titles' look in the NEXT layout) and copy-layout.js (deferred),
   and marks the page data-copy-layout="original" (the client: 「文字排版跟顏色樣式要照我原本的」: the page's own layout and colours, the reveal
   only). ?copylayout=next shows the NEXT layout, ?copylayout=0 neither. Undo: take this file's name out of build.cjs. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const v = file => crypto.createHash('md5').update(fs.readFileSync(path.join(__dirname, file))).digest('hex').slice(0, 10);
module.exports = state => {
  let html = state.html;
  html = html.replace(/(<html[^>]*?)\s+data-copy-layout="[^"]*"/, '$1');   /* the page is built from its own last output */
  html = html.replace('<html ', '<html data-copy-layout="original" ');
  const tags = `<link rel="stylesheet" data-copy-layout-css href="prototypes/index1-5/copy-layout.css?v=${v('copy-layout.css')}">\n  <script defer data-copy-layout-js src="prototypes/index1-5/copy-layout.js?v=${v('copy-layout.js')}"></script>`;
  html = html.replace(/\s*<link[^>]*data-copy-layout-css[^>]*>/, '').replace(/\s*<script[^>]*data-copy-layout-js[^>]*><\/script>/, '');
  if (!/<link[^>]*data-title-water[^>]*>/.test(html)) throw Error('copy-layout: the title-water link is missing (copy-layout.css must come after it)');
  html = html.replace(/(<link[^>]*data-title-water[^>]*>)/, (m) => m + '\n  ' + tags);
  return { ...state, html };
};
