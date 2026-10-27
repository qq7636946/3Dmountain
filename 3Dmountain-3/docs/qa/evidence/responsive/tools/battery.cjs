'use strict';
/* battery.cjs — several QA probe sessions under ONE hold of the shared browser lock (QA only, read-only on the site).
   The lock is not fair when many agents queue (each probe.cjs call has to win it again), so related runs go in one chunk.
   Usage: node docs/qa/evidence/responsive/tools/battery.cjs <jobs.json> [name,name,...]   (names filter the jobs)
   jobs.json: [{ "name":"j390", "script":"resp-audit|menu|flicker", "mode":"journey|world", "w":390, "h":844, "phone":true,
                 "reduced":false, "query":"", "env":{ "RESP_POINTS":"0,1" }, "waitFor":"world" }] */
const fs = require('node:fs'), path = require('node:path');
const L = require('../../../../../scripts/index1-5/lib.cjs');

L.main('resp-battery', { usage: 'battery.cjs <jobs.json> [names]', timeout: 3300, spec: {} }, async o => {
  const jobsFile = path.resolve(o._[0]);
  let jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
  if (o._[1]) { const want = o._[1].split(','); jobs = want.map(n => jobs.find(j => j.name === n)).filter(Boolean); }
  const summary = [];
  for (const j of jobs) {
    const t0 = Date.now();
    const env = { RESP_WAIT: '1500', ...(j.env || {}) };
    const saved = {}; for (const k of Object.keys(env)) { saved[k] = process.env[k]; process.env[k] = env[k]; }
    const dirName = 'resp-' + j.name;
    process.env.RESP_DIR = process.env.RESP_DIR_OVERRIDE || path.join(L.QA_DIR, dirName);
    process.env.RESP_MODE = j.mode || 'journey';
    process.env.MENU_DIR = process.env.RESP_DIR; process.env.FLK_DIR = process.env.RESP_DIR;
    L.note(`=== ${j.name} (${j.script}/${j.mode || 'journey'}) ${j.w}x${j.h}${j.phone ? ' phone' : ''}${j.reduced ? ' reduced' : ''}`);
    let result, err = null, logj = null;
    try {
      const s = await L.openSession('resp-battery', { w: j.w, h: j.h, phone: !!j.phone, reduced: !!j.reduced, query: j.query }, { autoplay: j.mode === 'world' || j.script === 'flicker' });
      try {
        let world = null;
        if (j.mode === 'world') world = (await L.enterWorld(s.page, s.vp)).state;
        const fn = require(path.resolve(__dirname, (j.script || 'resp-audit') + '.probe.cjs'));
        result = await fn({ page: s.page, L, vp: s.vp, world, log: s.log });
        logj = L.logJson(s.log);
        const kb = s.vp; // keep eslint quiet
      } finally { await s.browser.close().catch(() => { }); }
    } catch (e) { err = String(e && e.stack || e).slice(0, 700); }
    for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    const line = { name: j.name, sec: Math.round((Date.now() - t0) / 1000), err, errors: logj && logj.errors, http: logj && logj.http, result: result && (result.sum ? { dir: result.dir, sum: result.sum.map(x => `${x.pt}:i${x.issues}/t${x.smallTaps}${x.hscroll ? '/H' : ''}${x.broken ? '/B' + x.broken : ''}/L${x.L}`).join(' ') } : result) };
    summary.push(line);
    console.log('JOB ' + JSON.stringify(line).slice(0, 2500));
  }
  return summary.some(s => s.err) ? 1 : 0;
});
