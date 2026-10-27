'use strict';
/* QA · rapid / odd input on the journey: alternating wheel spam, fast repeated clicks, double-click, clicks during a transition,
   wheel / keys while the menu is open, Escape / Home / End / PageUp/PageDown / arrows / Space in the journey, cards and world.
   Every section appends its result to .qa/index1-5/qa-interaction/rapid-input.json as it goes, so an aborted run keeps what it learned.
   Run: node scripts/index1-5/probe.cjs --script scripts/index1-5/probes/qa/rapid-input.probe.cjs --out qa-rapid [--phone] [--reduced]
   Env: QA_ONLY="r1,r5" runs only those sections. */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp, log }) => {
  const only = process.env.QA_ONLY ? process.env.QA_ONLY.split(',') : null;
  const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'rapid-input' + (vp.phone ? '-phone' : '') + (process.env.QA_SUFFIX || '') + '.json'); const res = {};
  const rec = (k, v) => { res[k] = v; fs.writeFileSync(file, JSON.stringify(res, null, 1)); };
  await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });
  const want = k => !only || only.includes(k);
  const S = () => Q.study(page);
  const errCount = () => log.errors.length;
  const reload = async () => { await page.reload({ waitUntil: 'commit' }); await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 120000, polling: 250 }); await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; }); await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { }); await page.mouse.move(vp.width / 2, vp.height / 2); };
  const section = async (k, fn) => { if (!want(k)) return; const e0 = errCount(); const t0 = Date.now(); try { const out = await fn(); out.errorsDuring = log.errors.slice(e0); out.ms = Date.now() - t0; rec(k, out); } catch (e) { rec(k, { threw: String(e.message || e).slice(0, 300), errorsDuring: log.errors.slice(e0) }); } };
  const inconsistent = s => { const w = s.world, c = s.cards; const out = []; if (w && w.open && !(c && c.open)) out.push('world open but cards closed'); if (s.p < s.max - 1 && ((c && c.open) || (w && w.open))) out.push('journey short of end but cards/world open'); if (s.ui.worldCanvasVis && !(w && w.open)) out.push('world canvas visible while world closed'); return out; };
  await page.mouse.move(vp.width / 2, vp.height / 2);

  /* r1: alternating wheel at the opening and mid-journey */
  await section('r1_wheel_alternating', async () => {
    const out = { runs: [] };
    for (const start of [0, 2.96, 5.56]) {
      await L.fly(page, start); await page.waitForTimeout(800); const s0 = await S();
      for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, i % 2 ? -120 : 120); await page.waitForTimeout(25); }
      const s1 = await Q.settle(page, 8000);
      for (let i = 0; i < 24; i++) await page.mouse.wheel(0, 400);   // big fling
      const s2 = await Q.settle(page, 12000);
      out.runs.push({ start, before: Q.short(s0), afterAlternate: Q.short(s1), afterFling: Q.short(s2), inconsistent: inconsistent(s2) });
    }
    return out;
  });

  /* r2: the journey -> cards bridge: alternate wheel across it */
  await section('r2_bridge_alternating', async () => {
    await L.fly(page, 'max'); await page.waitForTimeout(1000);
    const trace = [];
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(40); }
      trace.push('dn' + Q.short(await S()));
      for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(40); }
      trace.push('up' + Q.short(await S()));
    }
    const fin = await Q.settle(page, 10000);
    await Q.shot(page, 'r2-bridge-after-alternating' + (vp.phone ? '-phone' : ''), 70).catch(() => { });
    // after settling a few notches up must bring the cards closed and the journey back
    for (let i = 0; i < 24; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(80); }
    const back = await Q.settle(page, 10000);
    return { trace: trace.slice(-6), final: Q.short(fin), inconsistent: inconsistent(fin), afterWheelUp: Q.short(back), inconsistentBack: inconsistent(back) };
  });

  /* r3: cards -> world, alternating */
  await section('r3_cards_world_alternating', async () => {
    await L.fly(page, 'max'); await page.waitForTimeout(800);
    for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(120); }
    await page.waitForTimeout(1200); const cardsOn = await S();
    const trace = [];
    for (let round = 0; round < 8; round++) {
      for (let i = 0; i < 7; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(35); }
      trace.push('dn ' + Q.short(await S()));
      for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(35); }
      trace.push('up ' + Q.short(await S()));
    }
    const fin = await Q.settle(page, 12000);
    await Q.shot(page, 'r3-cards-world-after-alternating' + (vp.phone ? '-phone' : ''), 70).catch(() => { });
    return { cardsOn: Q.short(cardsOn), trace: trace.slice(-6), final: Q.short(fin), inconsistent: inconsistent(fin) };
  });

  /* r4: wave into the LOGO block */
  await section('r4_logo_wave_alternating', async () => {
    const st = (await L.enterWorld(page, vp)).state; const la = st.logo && st.logo.at; if (!la) return { skipped: 'no logo block' };
    await L.prepareLogo(page, st);
    await L.jumpWorld(page, la.w0 - 0.3 * vp.height); await page.waitForTimeout(700);
    const trace = [];
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(40); }
      const a = await page.evaluate(() => { const w = window.__MONTIS_STUDY__.world.state; return { y: Math.round(w.y), q: w.logo && w.logo.sample && +w.logo.sample.qWave.toFixed(2) }; });
      for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(40); }
      const b = await page.evaluate(() => { const w = window.__MONTIS_STUDY__.world.state; return { y: Math.round(w.y), q: w.logo && w.logo.sample && +w.logo.sample.qWave.toFixed(2) }; });
      trace.push({ dn: a, up: b });
    }
    await page.waitForTimeout(1200);
    const fin = await S(); await Q.shot(page, 'r4-logo-wave-after-alternating' + (vp.phone ? '-phone' : ''), 70).catch(() => { });
    return { trace, final: Q.short(fin), ready: (await L.logoNow(page)) };
  });

  /* r5: fast repeated clicks and double clicks */
  await section('r5_fast_clicks', async () => {
    await reload(); const out = {};
    const burst = async (sel, n, gap) => { for (let i = 0; i < n; i++) { await page.click(sel, { timeout: 1500, noWaitAfter: true }).catch(() => { }); await page.waitForTimeout(gap); } };
    await L.fly(page, 0); await page.waitForTimeout(500);
    await burst('.fi-explore', 12, 40); out.explore12 = Q.short(await Q.settle(page, 14000));
    await L.fly(page, 0); await page.waitForTimeout(500);
    await burst('.fi-footer-next', 12, 40); out.next12 = Q.short(await Q.settle(page, 14000));
    await L.fly(page, 0); await page.waitForTimeout(500);
    for (let i = 0; i < 6; i++) { await page.click('.fi-rail [data-chapter="' + (i % 6) + '"]', { timeout: 1500, noWaitAfter: true }).catch(() => { }); await page.waitForTimeout(60); }
    out.railSweep = Q.short(await Q.settle(page, 14000)); out.railSweepChapter = await page.evaluate(() => document.querySelector('.fi-footer-current')?.textContent);
    // double click on each kind of button
    await L.fly(page, 0); await page.waitForTimeout(500);
    await page.dblclick('.fi-menu-toggle', { timeout: 2000 }).catch(e => { out.dblMenuErr = String(e.message).split('\n')[0]; }); await page.waitForTimeout(600);
    out.dblMenu = { open: await page.evaluate(() => document.querySelector('dialog.fi-menu').open), ariaExpanded: await page.getAttribute('.fi-menu-toggle', 'aria-expanded') };
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    out.afterEsc = { open: await page.evaluate(() => document.querySelector('dialog.fi-menu').open), ariaExpanded: await page.getAttribute('.fi-menu-toggle', 'aria-expanded'), focus: (await Q.focusInfo(page)).cls };
    await page.dblclick('.fi-rail [data-chapter="3"]', { timeout: 2000 }).catch(() => { }); out.dblRail = Q.short(await Q.settle(page, 12000));
    // CTA clicked repeatedly while the journey is moving
    await L.fly(page, 0); await page.waitForTimeout(600);
    for (let i = 0; i < 8; i++) { await page.click('.fi-copy-panel.is-active .fi-copy-action', { timeout: 800, noWaitAfter: true }).catch(() => { }); await page.waitForTimeout(250); }
    out.ctaDuringMove = Q.short(await Q.settle(page, 14000));
    // sound toggled fast: state must end consistent with aria-pressed and the label
    for (let i = 0; i < 7; i++) { await page.click('.fi-sound', { timeout: 1000, noWaitAfter: true }).catch(() => { }); await page.waitForTimeout(30); }
    await page.waitForTimeout(800);
    out.soundFast = await page.evaluate(() => { const b = document.querySelector('.fi-sound'); return { pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), text: b.querySelector('span').textContent, disabled: b.disabled }; });
    return out;
  });

  /* r6: menu open: wheel / keys must not move the page; backdrop click closes; Esc closes; focus returns */
  await section('r6_menu_modal', async () => {
    await reload(); const out = {}; await L.fly(page, 2.96); await page.waitForTimeout(700);
    const before = await S(); await page.click('.fi-menu-toggle'); await page.waitForTimeout(600);
    for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(40); }
    for (const k of ['ArrowDown', 'PageDown', 'End', ' ']) await Q.key(page, k, 120);
    await page.waitForTimeout(600); const during = await S();
    out.wheelAndKeysWithMenu = { before: Q.short(before), during: Q.short(during), moved: Math.abs(during.t - before.t) > .01 || Math.abs(during.p - before.p) > .01 };
    out.focusInDialog = await page.evaluate(() => !!document.activeElement.closest('dialog'));
    // Tab cycles inside the dialog
    const cycle = []; for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(60); const f = await Q.focusInfo(page); cycle.push((f.inDialog ? 'D:' : 'OUT:') + (f.label || f.cls)); }
    out.tabCycle = cycle;
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    out.afterEsc = { open: await page.evaluate(() => document.querySelector('dialog.fi-menu').open), focus: (await Q.focusInfo(page)).cls, expanded: await page.getAttribute('.fi-menu-toggle', 'aria-expanded') };
    // outside (backdrop) click
    await page.click('.fi-menu-toggle'); await page.waitForTimeout(400);
    await page.mouse.click(8, vp.height - 8); await page.waitForTimeout(500);
    out.backdropClick = { open: await page.evaluate(() => document.querySelector('dialog.fi-menu').open) };
    // click inside the dialog on the intro text must NOT close
    await page.click('.fi-menu-toggle'); await page.waitForTimeout(400);
    await page.click('.fi-menu-intro h2').catch(() => { }); await page.waitForTimeout(300);
    out.clickInsideKeepsOpen = { open: await page.evaluate(() => document.querySelector('dialog.fi-menu').open) };
    await page.click('.fi-menu-close'); await page.waitForTimeout(400);
    out.closeBtn = { open: await page.evaluate(() => document.querySelector('dialog.fi-menu').open), focus: (await Q.focusInfo(page)).cls };
    // menu opened in the cards / the world, then Esc: must close only the menu
    await L.fly(page, 'max'); await page.waitForTimeout(600);
    for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(120); }
    await page.waitForTimeout(1200); const c0 = await S();
    await page.click('.fi-menu-toggle').catch(() => { }); await page.waitForTimeout(500); await page.keyboard.press('Escape'); await page.waitForTimeout(700);
    const c1 = await S();
    out.escMenuOverCards = { before: Q.short(c0), after: Q.short(c1), cardsStillOpen: !!(c1.cards && c1.cards.open) === !!(c0.cards && c0.cards.open) };
    return out;
  });

  /* r7: keys in the journey / cards / world */
  await section('r7_keys', async () => {
    await reload(); const out = { journey: [], cards: [], world: [] };
    await L.fly(page, 2.96); await page.waitForTimeout(700); await page.mouse.move(vp.width / 2, vp.height / 2);
    for (const k of ['ArrowDown', 'ArrowDown', 'PageDown', 'PageUp', ' ', 'Shift+Space', 'ArrowUp', 'End', 'Home']) { const b = await S(); await Q.key(page, k, 1400); const a = await Q.settle(page, 9000); out.journey.push({ key: k, from: b.p, to: a.p, t: a.t, cards: a.cards && a.cards.open, world: a.world && a.world.open }); }
    // Escape / Home / End with the cards open
    await L.fly(page, 'max'); await page.waitForTimeout(600);
    for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(120); }
    await page.waitForTimeout(1200);
    for (const k of ['ArrowLeft', 'ArrowRight', 'Escape', 'Home']) {
      if (k === 'Escape' || k === 'Home') { /* re-open cards before each of these */ const s = await S(); if (!(s.cards && s.cards.open)) { await L.fly(page, 'max'); await page.waitForTimeout(500); for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(120); } await page.waitForTimeout(1200); } }
      const b = await S(); await Q.key(page, k, 1500); const a = await Q.settle(page, 12000); out.cards.push({ key: k, from: Q.short(b), to: Q.short(a), incons: inconsistent(a) });
      if (inconsistent(a).length) await Q.shot(page, 'r7-cards-key-' + k, 70).catch(() => { });
    }
    // world: Escape, End, Home, PageDown/Up, Space
    await reload(); await page.mouse.move(vp.width / 2, vp.height / 2);
    const w = (await L.enterWorld(page, vp)).state; await L.jumpWorld(page, L.worldY(w, 'g:0.5')); await page.waitForTimeout(900);
    for (const k of ['PageDown', 'PageDown', 'PageUp', 'ArrowDown', ' ', 'Escape', 'End', 'Home']) {
      const b = await S(); await Q.key(page, k, 1500); const a = await Q.settle(page, 12000); out.world.push({ key: k, from: Q.short(b), to: Q.short(a), incons: inconsistent(a) });
      if (inconsistent(a).length || k === 'Escape' || k === 'Home') await Q.shot(page, 'r7-world-key-' + k.trim() + (vp.phone ? '-phone' : ''), 70).catch(() => { });
      if (k === 'Escape' || k === 'Home') { // put the world back for the next key
        const s = await S(); if (!(s.world && s.world.open)) { await reload(); await page.mouse.move(vp.width / 2, vp.height / 2); const w2 = (await L.enterWorld(page, vp)).state; await L.jumpWorld(page, L.worldY(w2, 'g:0.5')); await page.waitForTimeout(900); }
      }
    }
    return out;
  });

  return { ok: true, sections: Object.keys(res), file: path.relative(Q.ROOT, file) };
};
