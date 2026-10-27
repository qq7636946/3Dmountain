'use strict';
/* QA · every control that exists in the world epilogue, clicked from the state where a visitor would meet it:
   world rail (3), EXPLORE, NEXT STRATEGY pills, progress dots, THE SPIRIT, principles next, BACK TO TOP, footer links, header chrome (brand / top nav / menu items).
   After each click: settle, then read journey/cards/world, flag BROKEN (world canvas visible while the journey is short of the end, world open with journey < max, ...).
   Run: node scripts/index1-5/probe.cjs --script scripts/index1-5/probes/qa/nav-world.probe.cjs --out qa-nav-world --timeout 1700  [--phone] [--reduced]
   Env: QA_WSTATES="global,h:1,principles,logo,footer"  QA_WCONTROLS="id,id" (ids as listed in PLAN below) */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path');
const PLAN = {
  'global': [['worldrail:0', '.fiw-chapters [data-world-go="global"]'], ['worldrail:1', '.fiw-chapters [data-world-go="responsibility"]'], ['worldrail:2', '.fiw-chapters [data-world-go="contact"]'], ['explore', '.fi-explore'], ['next', '.fi-footer-next'], ['brand', '.fi-brand'], ['topnav:2', '.fi-topnav [data-chapter="5"]'], ['rail:0', '.fi-rail [data-chapter="0"]'], ['rail:5', '.fi-rail [data-chapter="5"]'], ['menu:0', 'menu:0'], ['menu:5', 'menu:5']],
  'h:1': [['pill-next', '.fiwo-panel[data-stop="1"] [data-ocean-go]'], ['dot:0', '.fiwo-progress [data-ocean-go="0"]'], ['dot:2', '.fiwo-progress [data-ocean-go="2"]'], ['dot:3', '.fiwo-progress [data-ocean-go="3"]'], ['explore', '.fi-explore'], ['brand', '.fi-brand'], ['topnav:0', '.fi-topnav [data-chapter="0"]'], ['rail:5', '.fi-rail [data-chapter="5"]'], ['menu:3', 'menu:3']],
  'h:3': [['pill-spirit', '.fiwo-panel[data-stop="3"] .fiwo-pill'], ['explore', '.fi-explore']],
  'principles': [['principles-next', '.fiwp-next'], ['explore', '.fi-explore'], ['brand', '.fi-brand'], ['menu:0', 'menu:0']],
  'logo': [['explore', '.fi-explore'], ['brand', '.fi-brand'], ['menu:5', 'menu:5'], ['sound', '.fi-sound']],
  'footer': [['top', '.fiw-top'], ['flink:0', '.fiw-menu [data-chapter-link="0"]'], ['flink:3', '.fiw-menu [data-chapter-link="3"]'], ['flink:5', '.fiw-menu [data-chapter-link="5"]'], ['fglobal', '.fiw-menu [data-world-go="global"]'], ['fresp', '.fiw-menu [data-world-go="responsibility"]'], ['legal:contact', '.fiw-legal a[data-todo="contact"]'], ['legal:privacy', '.fiw-legal a[data-todo="privacy"]'], ['legal:terms', '.fiw-legal a[data-todo="terms"]'], ['explore', '.fi-explore'], ['brand', '.fi-brand'], ['menu:2', 'menu:2'], ['sound', '.fi-sound']]
};
module.exports = async ({ page, L, vp, log }) => {
  const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'nav-world' + (vp.phone ? '-phone' : '') + (process.env.QA_SUFFIX || '') + '.json');
  const states = (process.env.QA_WSTATES || 'global,h:1,h:3,principles,logo,footer').split(','); const only = process.env.QA_WCONTROLS ? process.env.QA_WCONTROLS.split(',') : null;
  const rows = [], bad = [];
  const css = () => page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });
  await css();
  const waitReady = async () => { await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 120000, polling: 250 }); await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; }); await css(); };
  const hardReset = async why => { await page.reload({ waitUntil: 'commit' }); await waitReady(); rows.push({ note: 'hardReset: ' + why }); };
  const chapterName = () => page.evaluate(() => document.querySelector('.fi-footer-current')?.textContent);
  let ws = null;
  const toState = async name => {
    let st = await Q.study(page);
    if (!(st.world && st.world.open)) {
      if (st.cards?.open || st.ui.worldCanvasVis || st.p < st.max - 1) { if (st.ui.worldCanvasVis || st.cards?.open) await hardReset('broken/leftover before ' + name); }
      ws = (await L.enterWorld(page, vp)).state;
    }
    await Q.goState(page, L, vp, name, ws);
    return Q.study(page);
  };
  for (const s of states) {
    for (const [id, sel] of PLAN[s] || []) {
      if (only && !only.includes(id)) continue;
      const pre = await toState(s); const preName = await chapterName(); const t0 = Date.now(); let r;
      if (sel.startsWith('menu:')) { r = await Q.tryClick(page, '.fi-menu-toggle'); await page.waitForTimeout(500); if (r.ok) r = await Q.tryClick(page, `.fi-menu-links [data-chapter="${sel.slice(5)}"]`); }
      else r = await Q.tryClick(page, sel);
      await page.waitForTimeout(500); const post = await Q.settle(page, 12000); const ms = Date.now() - t0;
      const f = await Q.focusInfo(page); const name = await chapterName();
      const row = { state: s, control: id, click: r.ok ? 'ok' : r.err, from: Q.short(pre), to: Q.short(post), toChapter: name, ms, menuOpen: post.ui.menuOpen, focus: f.body ? 'BODY' : f.cls + ':' + f.label };
      const w = post.world, c = post.cards;
      const why = [];
      if (!r.ok) why.push('click failed (not clickable here)');
      if (post.p < post.max - 1 && ((w && w.open) || (c && c.open) || post.ui.worldCanvasVis)) why.push('BROKEN: world/cards/canvas still present while journey short of end');
      if (post.ui.worldCanvasVis && !(w && w.open)) why.push('BROKEN: world canvas visible but world closed');
      if (post.ui.menuOpen) why.push('menu still open');
      if (why.length) { bad.push({ ...row, why }); await Q.shot(page, `nw-${s.replace(':', '')}-${id.replace(':', '')}`, 66).catch(() => { }); }
      rows.push(row); fs.writeFileSync(file, JSON.stringify({ rows, bad }, null, 1));
      if (post.ui.worldCanvasVis && !(w && w.open)) await hardReset('broken state after ' + s + '/' + id);
    }
  }
  return { ok: bad.length === 0, rows: rows.length, bad: bad.length, badRows: bad.map(b => `${b.state}/${b.control}: ${b.why.join('; ')} → ${b.to}`) };
};
