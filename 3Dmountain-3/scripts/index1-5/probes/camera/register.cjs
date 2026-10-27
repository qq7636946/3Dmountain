// Registers valley-scene-build.cjs in prototypes/index1-5/build.cjs (idempotent, one read-modify-write; run it ONLY through with-lock.cjs).
const fs = require('node:fs'), path = require('node:path'); const { applyRegistration } = require('./dryrun.cjs');
const f = path.resolve(__dirname, '..', '..', '..', '..', 'prototypes', 'index1-5', 'build.cjs');
const before = fs.readFileSync(f, 'utf8'), after = applyRegistration(before);
if (after === before) console.log('already registered'); else { fs.writeFileSync(f, after); console.log('registered valley-scene-build.cjs in build.cjs'); }
