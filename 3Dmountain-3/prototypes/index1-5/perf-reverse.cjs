/* Local to index1-5 (2026-10-31). What makes a perf stream reversible: build.cjs rewrites index1-5.html from itself, so html a helper adds would stay after the helper is off.
   build.cjs calls strip() before the perf helpers run. A helper that adds html does it with wrap():
     const { wrap } = require('./perf-reverse.cjs');
     html = html.replace('</head>', wrap('boot', '<link rel="preload" ...>') + '</head>');
   The block is then removed on every build and written again only while the stream is on. Same for the one hand-kept module a helper patches (index1-5-terrain.js). */
const fs = require('fs'), path = require('path');
const BLOCK = /[ \t]*<!--\s*PERF_HTML:([\w-]+)\s*-->[\s\S]*?<!--\s*\/PERF_HTML:\1\s*-->[ \t]*\n?/g;
/* blocks written before the marker rule (round 1 helpers) */
const OLDER = [/[ \t]*<!--perf-boot(-s2)?:begin-->[\s\S]*?<!--perf-boot\1:end-->[ \t]*\n?/g, /[ \t]*<style id="perf-phone-blend">[\s\S]*?<\/style>[ \t]*\n?/g];
const TUFT = /\/\* perf-boot tuft-atlas:[^\n]*?\*\/ if \([^\n]*?\) (load\('alpineTuft',new URL\('tuft-atlas\.webp',alp\)\.href,false\);)/;
const wrap = (stream, block) => { if (!/^[\w-]+$/.test(stream)) throw Error('perf-reverse: stream name ' + stream); return `<!-- PERF_HTML:${stream} -->\n${block}\n<!-- /PERF_HTML:${stream} -->\n`; };
function strip(html) { let out = html.replace(BLOCK, ''); for (const re of OLDER) out = out.replace(re, ''); return out; }
function stripHandKept(jsDir) {
  const file = path.join(jsDir, 'index1-5-terrain.js');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8'), next = text.replace(TUFT, '$1');
  if (next !== text) fs.writeFileSync(file, next);
}
module.exports = { wrap, strip, stripHandKept };
