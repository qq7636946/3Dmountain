'use strict';
/* QA · run several QA probe modules back-to-back in ONE browser session (one lock acquisition).
   Module list: each session takes (and removes) the first non-comment line of _modules.txt when it starts running (i.e. after the lock is won),
   else env QA_MODULES, else kbd-tab-order,rapid-input.
   Run: node scripts/index1-5/probe.cjs --script scripts/index1-5/probes/qa/all.probe.cjs --timeout 1700 --out qa-all */
const path = require('node:path'), fs = require('node:fs');
module.exports = async ctx => {
  const mf = path.join(__dirname, '_modules.txt'); let fromFile = null;
  if (fs.existsSync(mf)) {
    const lines = fs.readFileSync(mf, 'utf8').split('\n').map(l => l.trim());
    const i = lines.findIndex(l => l && !l.startsWith('#'));
    if (i >= 0) { fromFile = lines[i]; lines.splice(i, 1); fs.writeFileSync(mf, lines.join('\n')); }
  }
  const mods = (fromFile || process.env.QA_MODULES || 'kbd-tab-order,rapid-input').split(','), out = {};
  for (const m of mods) {
    const f = path.join(__dirname, m + '.probe.cjs'); delete require.cache[require.resolve(f)];
    const e0 = ctx.log.errors.length;
    try { out[m] = await require(f)(ctx); } catch (e) { out[m] = { ok: false, threw: String(e && e.stack || e).slice(0, 400) }; }
    out[m].pageErrors = ctx.log.errors.slice(e0);
    try { await ctx.page.reload({ waitUntil: 'commit' }); await ctx.page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 120000, polling: 250 }); await ctx.page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; }); } catch (e) { out[m].reloadErr = String(e.message).slice(0, 200); }
  }
  return { ok: Object.values(out).every(o => o && o.ok !== false), modules: out };
};
