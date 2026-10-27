import vm from 'node:vm';
import fs from 'node:fs';
let bad = 0;
for (const f of process.argv.slice(2)) {
  try { new vm.SourceTextModule(fs.readFileSync(f, 'utf8'), { identifier: f }); console.log('OK  ', f.split('/').pop()); }
  catch (e) { bad++; console.log('FAIL', f.split('/').pop(), e.message); }
}
process.exit(bad ? 1 : 0);
