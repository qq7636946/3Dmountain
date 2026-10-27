'use strict';
/* with-lock.cjs — run any shell command while holding the shared QA lock (the same lock the browser tools use), so that
   "build, then capture" cannot be interleaved with another worker's build or capture. The command's own tools run with
   I15_NO_LOCK=1 so they do not queue behind this process.
   Usage:  node scripts/index1-5/with-lock.cjs "node prototypes/index1-5/build.cjs && node scripts/index1-5/shot.cjs --at 12.3 --out mine"
   Exit code = the command's. Wait limit: I15_LOCK_WAIT seconds (default 900). */
const { spawnSync } = require('node:child_process');
const L = require('./lib.cjs');
const cmd = process.argv.slice(2).join(' ').trim();
if (!cmd || cmd === '--help') { console.log(require('node:fs').readFileSync(__filename, 'utf8').split('*/')[0].replace('/* ', '')); process.exit(cmd ? 0 : 2); }
(async () => {
  await L.acquireLock('with-lock');
  try {
    const r = spawnSync(cmd, { shell: true, stdio: 'inherit', cwd: L.ROOT, env: { ...process.env, I15_NO_LOCK: '1' } });
    process.exitCode = r.status === null ? 1 : r.status;
  } finally { L.releaseLock(); }
})().catch(e => { console.error(String(e && e.message || e)); L.releaseLock(); process.exit(1); });
