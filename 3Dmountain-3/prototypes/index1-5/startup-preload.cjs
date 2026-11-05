'use strict';
const fs = require('fs');
const path = require('path');
const ORIGIN = 'https://build.invalid/';
const BLOCK = /\s*<!-- STARTUP_PRELOADS -->[\s\S]*?<!-- END_STARTUP_PRELOADS -->\n?/g;

/* Walk the modules actually written by this build. In particular, Flow has its
   own import URLs: never copy the base page's query strings or module list. */
function addStartupPreloads(html, root) {
  html = html.replace(BLOCK, '\n');
  const main = html.match(/<script type="module" id="journeyModule" src="([^"]+)"/);
  if (!main) throw Error('startup preload: missing journey module');
  const importMap = JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)?.[1] || '{}').imports || {};
  const urls = new Set(), visited = new Set();
  const existing = new Set([...html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map(m => new URL(m[1], ORIGIN).href));
  const imports = /(?:^|\n)\s*(?:import\s+(?:[^;'"\n]*?\s+from\s+)?|export\s+[^;\n]*?\s+from\s+)['"]([^'"]+)['"]/g;
  function walk(url) {
    if (visited.has(url.href)) return;
    visited.add(url.href);
    if (url.origin !== new URL(ORIGIN).origin) return;
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file)) throw Error('startup preload: missing local module ' + url.pathname);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(imports)) {
      const spec = match[1]; let target;
      if (spec.startsWith('.') || spec.startsWith('/') || /^https?:/.test(spec)) target = new URL(spec, url);
      else {
        const key = Object.keys(importMap).filter(k => spec === k || k.endsWith('/') && spec.startsWith(k)).sort((a, b) => b.length - a.length)[0];
        if (!key) throw Error('startup preload: unmapped import ' + spec);
        target = new URL(importMap[key] + spec.slice(key.length), ORIGIN);
      }
      if (!existing.has(target.href)) urls.add(target.origin === new URL(ORIGIN).origin ? target.pathname.slice(1) + target.search : target.href);
      walk(target);
    }
  }
  walk(new URL(main[1], ORIGIN));
  const block = '  <!-- STARTUP_PRELOADS -->\n' + [...urls].map(url => `  <link rel="modulepreload" href="${url}" crossorigin>`).join('\n') + '\n  <!-- END_STARTUP_PRELOADS -->\n';
  return html.replace('</head>', block + '</head>');
}
module.exports = { addStartupPreloads };
