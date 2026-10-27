'use strict';
/* dry-build.cjs — run prototypes/index1-5/build.cjs WITHOUT touching the project: every file it writes under the project root is
   written to <OUT>/<same relative path> instead, and every file it reads is taken from <OUT> first when it is there. Serve the result
   with the overlay server (the page and its generated modules come from OUT, everything else from the project):
     node scripts/index1-5/with-lock.cjs "node scripts/index1-5/dry-build.cjs <OUT>"
     node scripts/logo-letters/overlay-server.cjs "<project root>" 5631 "<OUT>"        (once; leave it running)
     I15_BASE=http://127.0.0.1:5631/ node scripts/index1-5/flow.cjs ...
   Usage: node scripts/index1-5/dry-build.cjs <OUT folder>   (files in OUT are overwritten, nothing is ever deleted) */
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const out = process.argv[2] && path.resolve(process.argv[2]);
if (!out || out === ROOT || !out.startsWith(ROOT) && !/scratchpad|Temp/i.test(out)) { console.error('usage: dry-build.cjs <OUT folder>  (OUT inside the project or a temp folder; never the project root)'); process.exit(2); }
const inRoot = p => { const a = path.resolve(String(p)); return a.startsWith(ROOT + path.sep) && !a.startsWith(out + path.sep) ? a : null; };
const map = a => path.join(out, path.relative(ROOT, a));
const wf = fs.writeFileSync, rf = fs.readFileSync, ex = fs.existsSync, mk = fs.mkdirSync, cf = fs.copyFileSync;
fs.writeFileSync = (p, ...r) => { const a = typeof p === 'string' && inRoot(p); if (!a) return wf(p, ...r); mk(path.dirname(map(a)), { recursive: true }); return wf(map(a), ...r); };
fs.readFileSync = (p, ...r) => { const a = typeof p === 'string' && inRoot(p); if (a && ex(map(a))) return rf(map(a), ...r); return rf(p, ...r); };
fs.existsSync = p => { const a = typeof p === 'string' && inRoot(p); return (a && ex(map(a))) || ex(p); };
fs.copyFileSync = (s, d, ...r) => { const a = typeof d === 'string' && inRoot(d); if (!a) return cf(s, d, ...r); mk(path.dirname(map(a)), { recursive: true }); return cf(s, map(a), ...r); };
// build.cjs rewrites a few shared files in place (read, rewire, write back): they must exist in OUT first, copied from the project
for (const f of ['index1-5-terrain.js', 'highland-material.js', 'follow-light-lines.js', 'alpine-cloud-banks.js']) {
  const a = path.join(ROOT, 'prototypes', 'index1-5', 'js', f); if (ex(a)) { mk(path.dirname(map(a)), { recursive: true }); cf(a, map(a)); }
}
/* build.cjs is compiled from its text with the helper list completed in memory (flow-fix-build.cjs last), so a dry run can include a helper that build.cjs does not list yet */
const buildPath = path.join(ROOT, 'prototypes', 'index1-5', 'build.cjs');
let buildSrc = rf(buildPath, 'utf8');
const extraHelpers = String(process.env.DRY_HELPERS || 'flow-fix-build.cjs').split(',').filter(h => h && !buildSrc.includes("'" + h + "'"));
if (extraHelpers.length) {
  const end = "]){if(!fs.existsSync(path.join(__dirname,n)))continue;";
  if (buildSrc.split(end).length !== 2) throw new Error('dry-build: cannot find the end of the helper list in build.cjs');
  buildSrc = buildSrc.replace(end, () => ',' + extraHelpers.map(h => "'" + h + "'").join(',') + end);
}
const Module = require('node:module');
const mod = new Module(buildPath, null); mod.filename = buildPath; mod.paths = Module._nodeModulePaths(path.dirname(buildPath));
mod._compile(buildSrc, buildPath);
console.log('dry-build -> ' + out);
