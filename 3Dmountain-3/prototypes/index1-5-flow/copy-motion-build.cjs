'use strict';
/* Integration: copy shared finnovation-interface.js into Flow/js, run
   patchInterface on it and point Flow main's interface import at that copy.
   patchWorld rewires Flow's existing world import. The module lives one
   directory above Flow/js, so both imports share exactly one controller. */
function patchController(source, version) {
  const pattern = /from ['"](?:\.\/|\.\.\/\.\.\/index1-5\/js\/)section-motion\.js(?:\?[^'"]*)?['"]/g;
  if ([...source.matchAll(pattern)].length !== 1) throw Error('Flow copy motion: section-motion import anchor changed');
  return source.replace(pattern, "from '../copy-motion.js?v=" + version + "'");
}
function patchHTML(html, version) {
  html = html.replace(/\s*<script\b[^>]*\bdata-(?:copy-layout-js|title-motion-js)\b[^>]*>[\s\S]*?<\/script>/g, '');
  html = html.replace(/\s*<link\b[^>]*\bdata-title-motion(?:\s|=)[^>]*>/g, '');
  if (html.includes('data-title-motion-js') || html.includes('data-copy-layout-js')) throw Error('Flow copy motion: legacy owner remained');
  const css = 'prototypes/index1-5-flow/copy-motion.css?v=' + version;
  if (!html.includes('prototypes/index1-5-flow/copy-motion.css')) html = html.replace('</head>', '  <link rel="stylesheet" href="' + css + '">\n</head>');
  return html;
}
module.exports = { patchInterface: patchController, patchWorld: patchController, patchHTML };
