// Cache-busting for the modules of the index1-1 epilogue, which main.js (and each other) import by hand-written ?v=.
//   node scripts/world/stamp-world.mjs            # rewrites the ?v= of these imports to content hashes, leaves first
//   node scripts/world/stamp-world.mjs --check    # exits 1 if any is stale
// Then run node scripts/stamp-assets.mjs index1-1.html (and index.html), which stamps js/main.js and css/ in the pages.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const check = process.argv.includes('--check');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const hash = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex').slice(0, 10);
// [file whose content is hashed, files that import it] — in dependency order, so a hash is taken after its own imports were stamped.
const ORDER = [
  ['js/finnovation-grade.js', ['js/main.js', 'js/portfolio-slider.js', 'js/finnovation-world.js', 'js/finnovation-grade-panel.js']],
  ['css/world.css', ['js/finnovation-world.js']],
  ['js/finnovation-grade-panel.js', ['js/main.js']],
  ['js/portfolio-slider.js', ['js/main.js']],
  ['js/portfolio-epilogue.js', ['js/main.js']],
  ['js/finnovation-world.js', ['js/main.js']]
];
let stale = 0;
for (const [dep, users] of ORDER) {
  const h = hash(dep), name = path.basename(dep).replace(/\./g, '\\.');
  for (const user of users) {
    const before = read(user);
    const after = before.replace(new RegExp(`(${name}\\?v=)[A-Za-z0-9._-]+`, 'g'), `$1${h}`);
    if (!before.match(new RegExp(`${name}\\?v=`))) throw new Error(`${user} does not import ${dep} with ?v=`);
    if (after !== before) { stale++; if (!check) fs.writeFileSync(path.join(root, user), after); console.log(`${check ? 'stale' : 'stamped'} ${dep} -> ${user} (${h})`); }
  }
}
if (check) { console.log(stale ? `${stale} stale stamp(s): run node scripts/world/stamp-world.mjs` : 'world epilogue stamps are current'); process.exit(stale ? 1 : 0); }
console.log(stale ? `updated ${stale} stamp(s)` : 'nothing to update');
