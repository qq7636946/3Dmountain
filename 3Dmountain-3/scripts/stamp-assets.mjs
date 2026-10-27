// Cache-busting for the files that index.html loads directly: css/*.css and js/main.js.
//   node scripts/stamp-assets.mjs            # rewrites ?v=<content hash> in index.html
//   node scripts/stamp-assets.mjs --check    # exits 1 if any stamp is stale (use before publishing)
// Why: the page used to carry its CSS/JS inline, so one cached HTML meant one consistent version. Now the HTML points at separate files, and
// GitHub Pages lets browsers reuse a cached copy for 10 minutes; a new ?v= makes the browser fetch the new file together with the new HTML.
// (The ?v= stamps on the imports *inside* js/ are still maintained by hand, as before.)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv.find(a => a.endsWith('.html')) || 'index.html';
const check = process.argv.includes('--check');
const file = path.join(root, target);
let html = fs.readFileSync(file, 'utf8');
let stale = 0, changed = 0;
html = html.replace(/((?:href|src)="(css\/[A-Za-z0-9._-]+\.css|js\/main\.js))\?v=([^"]*)"/g, (m, head, rel, old) => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex').slice(0, 10);
  if (hash !== old) { stale++; changed++; }
  return `${head}?v=${hash}"`;
});
if (check) { console.log(stale ? `${stale} stale ?v= stamp(s) in ${target}: run node scripts/stamp-assets.mjs` : `${target}: all ?v= stamps are current`); process.exit(stale ? 1 : 0); }
if (changed) fs.writeFileSync(file, html);
console.log(changed ? `${target}: updated ${changed} stamp(s)` : `${target}: nothing to update`);
