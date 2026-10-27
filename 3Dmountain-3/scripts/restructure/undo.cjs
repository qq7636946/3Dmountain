#!/usr/bin/env node
/* Reverses scripts/restructure/restructure.cjs using docs/restructure-manifest.json.
 *   node scripts/restructure/undo.cjs            # dry run: prints the plan
 *   node scripts/restructure/undo.cjs --yes      # does it
 * Order: delete every file the migration wrote -> put the untouched originals back from _archive/pre-restructure -> move everything else back.
 */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const YES = process.argv.includes('--yes');
const mf = path.join(ROOT, 'docs', 'restructure-manifest.json');
if (!fs.existsSync(mf)) throw new Error('docs/restructure-manifest.json not found: nothing to undo');
const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
if (m.mode !== 'apply') throw new Error('manifest is from a stage run, not an applied migration');
const abs = r => path.join(ROOT, r);
const plan = [];
for (const w of m.writes) plan.push(['delete', w]);
for (const b of m.backups) plan.push(['restore', b.to, b.from]);
for (const mv of [...m.moves].reverse()) if (!mv.edited) plan.push(['move', mv.to, mv.from]);
console.log(`${YES ? 'EXECUTING' : 'DRY RUN'}: ${plan.length} steps (${m.writes.length} deletes, ${m.backups.length} restores, ${m.moves.filter(x => !x.edited).length} moves back)`);
const mkdir = p => fs.mkdirSync(path.dirname(p), { recursive: true });
let errors = 0;
for (const [op, a, b] of plan) {
  if (!YES) { console.log(`  ${op.padEnd(7)} ${a}${b ? '  ->  ' + b : ''}`); continue; }
  try {
    if (op === 'delete') { fs.rmSync(abs(a), { force: true }); }
    else if (!fs.existsSync(abs(a))) { console.log(`  skip (missing): ${a}`); }
    else { if (fs.existsSync(abs(b))) throw new Error('target exists: ' + b); mkdir(abs(b)); fs.renameSync(abs(a), abs(b)); }
  } catch (e) { errors++; console.log(`  ERROR ${op} ${a}: ${e.message}`); }
}
if (YES) {
  for (const d of ['css', 'js', 'media', 'models', 'images/slides', '_archive/pre-restructure', '_archive']) { // remove what is left empty, deepest first
    const p = abs(d); const prune = q => { if (!fs.existsSync(q) || !fs.statSync(q).isDirectory()) return; for (const n of fs.readdirSync(q)) prune(path.join(q, n)); if (!fs.readdirSync(q).length) fs.rmdirSync(q); }; prune(p);
  }
  fs.renameSync(mf, path.join(ROOT, 'docs', 'restructure-manifest.undone.json'));
  console.log(errors ? `finished with ${errors} error(s)` : 'undo complete');
}
