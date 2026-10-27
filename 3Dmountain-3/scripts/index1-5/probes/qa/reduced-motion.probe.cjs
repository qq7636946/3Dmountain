'use strict';
/* QA · prefers-reduced-motion (run with --reduced): every section reachable, nothing stuck, no infinite CSS animation left running,
   journey / world jump instead of glide, the buttons still do their job, the LOGO block shows its end state.
   Run: node scripts/index1-5/probe.cjs --reduced --script scripts/index1-5/probes/qa/reduced-motion.probe.cjs --out qa-reduced --timeout 1200 */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp, log }) => {
  const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'reduced-motion.json'); const res = {};
  const rec = (k, v) => { res[k] = v; fs.writeFileSync(file, JSON.stringify(res, null, 1)); };
  const S = () => Q.study(page);
  await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });
  res.media = await page.evaluate(() => ({ reduce: matchMedia('(prefers-reduced-motion: reduce)').matches })); rec('media', res.media);
  const anim = () => page.evaluate(() => {
    const run = document.getAnimations().filter(a => a.playState === 'running'); const inf = run.filter(a => { const t = a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming(); return t && t.iterations === Infinity; });
    const name = a => (a.animationName || a.transitionProperty || '') + '@' + ((a.effect && a.effect.target && ((a.effect.target.className && a.effect.target.className.toString().split(/\s+/)[0]) || a.effect.target.tagName)) || '');
    return { running: run.length, infinite: inf.length, infiniteWho: [...new Set(inf.map(name))].slice(0, 8) };
  });
  const states = [['top', 0], ['p2.96', 2.96], ['p5.56', 5.56], ['pmax', 'max']];
  const out = { journey: [] };
  for (const [name, p] of states) {
    const t0 = Date.now(); await page.evaluate(p => { const j = window.__MONTIS_STUDY__.journey; j.target = p === 'max' ? j.max : p; }, p);
    await page.waitForFunction(p => { const j = window.__MONTIS_STUDY__.journey; return Math.abs(j.progress - (p === 'max' ? j.max : p)) < .01; }, p, { timeout: 60000, polling: 50 }).catch(() => { });
    const ms = Date.now() - t0; await page.waitForTimeout(1200);
    out.journey.push({ name, reachedInMs: ms, state: Q.short(await S()), anim: await anim() }); await Q.shot(page, `reduced-${name}`, 66).catch(() => { });
  }
  rec('journey', out.journey);
  // rail click -> instant?
  await L.fly(page, 0); await page.waitForTimeout(500); const t1 = Date.now(); await page.click('.fi-rail [data-chapter="3"]'); await page.waitForFunction(() => { const j = window.__MONTIS_STUDY__.journey; return j.progress > 5; }, null, { timeout: 30000, polling: 50 }).catch(() => { });
  rec('railClick', { toVALUEms: Date.now() - t1, state: Q.short(await Q.settle(page, 6000)) });
  // cards + world
  await Q.goState(page, L, vp, 'cards'); const c = await S(); await Q.shot(page, 'reduced-cards', 66).catch(() => { });
  const w = (await L.enterWorld(page, vp)).state; const flow = [];
  for (const t of ['g:0.9', 'h:0', 'h:1', 'h:2', 'h:3', 'end']) { await L.jumpWorld(page, L.worldY(w, t)); await page.waitForTimeout(1300); const s = await S(); flow.push({ t, state: Q.short(s), anim: await anim() }); await Q.shot(page, 'reduced-world-' + t.replace(':', ''), 62).catch(() => { }); }
  const la = await page.evaluate(() => window.__MONTIS_STUDY__.world.state.logo && window.__MONTIS_STUDY__.world.state.logo.at);
  if (la) { await L.prepareLogo(page, w).catch(() => { }); for (const [n, f] of [['wave', la.w0 + (la.w1 - la.w0) * .5], ['spin', la.s0 + (la.spinDone - la.s0) * .5], ['hold', la.end]]) { await L.jumpWorld(page, f); await page.waitForTimeout(1500); const lg = await L.logoNow(page); flow.push({ t: 'logo-' + n, state: Q.short(await S()), logo: lg }); await Q.shot(page, 'reduced-logo-' + n, 62).catch(() => { }); } }
  rec('cards', { state: Q.short(c) }); rec('world', flow);
  // wheel in the world: instantaneous (y === yt)?
  await L.jumpWorld(page, L.worldY(w, 'h:1')); await page.waitForTimeout(900); await page.mouse.move(vp.width / 2, vp.height / 2);
  const y0 = (await S()).world; await page.mouse.wheel(0, 120); await page.waitForTimeout(80); const y1 = (await S()).world; await page.waitForTimeout(700); const y2 = (await S()).world;
  rec('worldWheel', { y0: y0.y, after80ms: y1.y, yt80: y1.yt, after780ms: y2.y });
  // EXPLORE chain in reduced motion to the footer and back to the top
  const chain = []; for (let i = 0; i < 8; i++) { await page.click('.fi-explore', { timeout: 3000 }).catch(() => { }); await page.waitForTimeout(1300); const s = await S(); chain.push(Q.short(s)); if (s.p < 1 && !(s.world && s.world.open)) break; }
  rec('exploreChain', chain);
  await page.waitForTimeout(1500); const fin = await Q.settle(page, 10000); rec('afterChain', { state: Q.short(fin) });
  return { ok: true, file: path.relative(Q.ROOT, file) };
};
