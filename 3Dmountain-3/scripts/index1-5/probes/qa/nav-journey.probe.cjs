'use strict';
/* QA · every journey-level control from several starting positions (the controls of the fixed header / rail / footer bar / menu):
   EXPLORE, NEXT CHAPTER, the 6 rail buttons, the 3 top-nav buttons, the brand logo link, MENU -> each item, the chapter CTA, the bottom cue.
   After each click: wait for the journey to settle, then read journey/cards/world + the visible chapter name + menu state + focus.
   "Broken" = world or cards still open / world canvas still visible although the journey is clearly short of the end.
   Run: node scripts/index1-5/probe.cjs --script scripts/index1-5/probes/qa/nav-journey.probe.cjs --out qa-nav-journey [--phone]
   Env: QA_STARTS="0,2.96,5.56,max"  QA_CONTROLS="explore,next,rail:1,..."  */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path');
const CONTROLS = (() => {
  const c = [{ id: 'explore', sel: '.fi-explore' }, { id: 'next', sel: '.fi-footer-next' }, { id: 'cta', sel: '.fi-copy-panel.is-active .fi-copy-action' }, { id: 'cue', sel: '#journeyCue' }, { id: 'brand', sel: '.fi-brand' }];
  for (let i = 0; i < 6; i++) c.push({ id: 'rail:' + i, sel: `.fi-rail [data-chapter="${i}"]` });
  [0, 2, 5].forEach((d, k) => c.push({ id: 'topnav:' + k, sel: `.fi-topnav [data-chapter="${d}"]` }));
  for (let i = 0; i < 6; i++) c.push({ id: 'menu:' + i, menu: true, sel: `.fi-menu-links [data-chapter="${i}"]` });
  return c;
})();
module.exports = async ({ page, L, vp }) => {
  const starts = (process.env.QA_STARTS || '0,2.96,5.56,max').split(',');
  const only = process.env.QA_CONTROLS ? process.env.QA_CONTROLS.split(',') : null;
  const rows = [], bad = [];
  await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });
  const chapterName = () => page.evaluate(() => document.querySelector('.fi-footer-current')?.textContent);
  const nextLabel = () => page.evaluate(() => document.querySelector('.fi-footer-next span')?.textContent);
  const hardReset = async why => { await page.reload({ waitUntil: 'commit' }); await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 120000, polling: 250 }); await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; }); await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { }); rows.push({ note: 'hardReset: ' + why }); };
  const toStart = async s => {
    const st = await Q.study(page);
    if (st.cards?.open || st.world?.open || st.ui.worldCanvasVis) { await hardReset('leaving a closed-world state for start ' + s); }
    const f = await L.fly(page, s === 'max' ? 'max' : +s); await page.waitForTimeout(900);
    if (!f.ok) { await hardReset('fly failed ' + JSON.stringify(f)); await L.fly(page, s === 'max' ? 'max' : +s); await page.waitForTimeout(900); }
    return Q.study(page);
  };
  for (const s of starts) {
    for (const c of CONTROLS) {
      if (only && !only.includes(c.id)) continue;
      const pre = await toStart(s); const preName = await chapterName(), preNext = await nextLabel();
      const t0 = Date.now(); let r;
      if (c.menu) {
        r = await Q.tryClick(page, '.fi-menu-toggle'); await page.waitForTimeout(500);
        if (r.ok) r = await Q.tryClick(page, c.sel);
      } else r = await Q.tryClick(page, c.sel);
      await page.waitForTimeout(400);
      const post = await Q.settle(page, 14000); const ms = Date.now() - t0;
      const name = await chapterName(), nxt = await nextLabel(), focus = await Q.focusInfo(page);
      const row = { start: s, control: c.id, click: r.ok ? 'ok' : r.err, from: Q.short(pre), fromChapter: preName + '/' + preNext, to: Q.short(post), toChapter: name + '/' + nxt, ms, menuOpen: post.ui.menuOpen, focus: focus.body ? 'BODY' : (focus.cls + ':' + focus.label) };
      const stuckHigh = post.p < post.max - 1 && (post.cards?.open || post.world?.open || post.ui.worldCanvasVis);
      if (!r.ok) bad.push({ ...row, why: 'click failed' });
      if (stuckHigh) bad.push({ ...row, why: 'BROKEN: world/cards still open or world canvas visible although journey short of the end' });
      if (post.ui.menuOpen) bad.push({ ...row, why: 'menu still open after choosing an item' });
      if (Math.abs(post.p - post.t) > 0.02 && !(post.cards?.open || post.world?.open)) bad.push({ ...row, why: 'journey did not settle at its target' });
      rows.push(row);
      if (stuckHigh) await Q.shot(page, `nav-broken-${s}-${c.id.replace(':', '')}`, 70).catch(() => { });
    }
  }
  const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'nav-journey' + (vp.phone ? '-phone' : '') + '.json'), JSON.stringify({ rows, bad }, null, 1));
  return { ok: bad.length === 0, bad: bad.length, rows: rows.length, badRows: bad.slice(0, 12) };
};
