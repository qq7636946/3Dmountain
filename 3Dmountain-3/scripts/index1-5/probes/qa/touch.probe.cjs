'use strict';
/* QA · touch (phone emulation): real touch events through CDP (Input.dispatchTouchEvent), tap targets, overscroll / touch-action.
   Swipes up/down through the journey from different starting spots (canvas, over the headline, over the footer bar), cards swiped sideways,
   world / ocean vertical + horizontal swipes, taps on every kind of control, tap target sizes in every state.
   Run: node scripts/index1-5/probe.cjs --phone --script scripts/index1-5/probes/qa/touch.probe.cjs --out qa-touch --timeout 1200  (use --w 768 --h 1024 --phone for a tablet-ish run) */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp, log }) => {
  const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'touch' + (process.env.QA_SUFFIX || '') + '.json'); const res = {};
  const rec = (k, v) => { res[k] = v; fs.writeFileSync(file, JSON.stringify(res, null, 1)); };
  const only = process.env.QA_ONLY ? process.env.QA_ONLY.split(',') : null; const want = k => !only || only.includes(k);
  const section = async (k, fn) => { if (!want(k)) return; const e0 = log.errors.length; const t0 = Date.now(); try { const out = await fn(); out.errorsDuring = log.errors.slice(e0); out.ms = Date.now() - t0; rec(k, out); } catch (e) { rec(k, { threw: String(e.message || e).slice(0, 300), errorsDuring: log.errors.slice(e0) }); } };
  const S = () => Q.study(page);
  await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const swipe = async (x1, y1, x2, y2, { steps = 14, gap = 14, hold = 0 } = {}) => {
    await touch('touchStart', [[x1, y1]]);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', [[x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps]]); await page.waitForTimeout(gap); }
    if (hold) await page.waitForTimeout(hold);
    await touch('touchEnd', []);
  };
  const reload = async () => { await page.reload({ waitUntil: 'commit' }); await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 120000, polling: 250 }); await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; }); await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { }); };
  const W = vp.width, H = vp.height;

  await section('t0_css', async () => page.evaluate(() => {
    const q = s => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); return { touchAction: cs.touchAction, overscroll: cs.overscrollBehavior, userSelect: cs.userSelect, overflow: cs.overflow, pos: cs.position }; };
    return { html: q('html'), body: q('body'), gl: q('#gl'), ui: q('.finnovation-ui'), copy: q('.fi-copy'), world: q('#fiWorld'), viewport: q('.fiw-viewport'), cards: q('.portfolio-layer, [data-portfolio-layer]') || null, meta: document.querySelector('meta[name=viewport]').content, hasTouch: navigator.maxTouchPoints };
  }));

  await section('t1_journey_swipes', async () => {
    const out = { starts: [] };
    for (const [name, x, y] of [['canvasMiddle', W / 2, H * .38], ['overHeadline', W / 2, H * .62], ['overCtaRegion', W / 2, H * .74], ['footerBar', W / 2, H - 30], ['header', W / 2, 60], ['rail', 30, H * .5]]) {
      await L.fly(page, 0); await page.waitForTimeout(700); const s0 = await S();
      await swipe(x, y, x, y - 300);   // finger moves up = page goes forward
      await page.waitForTimeout(1500); const s1 = await Q.settle(page, 8000);
      out.starts.push({ name, x: Math.round(x), y: Math.round(y), before: s0.p, afterSwipeUp: s1.p, advanced: s1.t > s0.t + .05 || s1.p > s0.p + .05 });
    }
    // long up-swipes through the whole opening, then back down
    await L.fly(page, 0); await page.waitForTimeout(600); const trace = [];
    for (let i = 0; i < 10; i++) { await swipe(W / 2, H * .75, W / 2, H * .25, { steps: 10, gap: 12 }); await page.waitForTimeout(500); trace.push((await S()).p); }
    out.upTrace = trace;
    const down = []; for (let i = 0; i < 10; i++) { await swipe(W / 2, H * .25, W / 2, H * .75, { steps: 10, gap: 12 }); await page.waitForTimeout(500); down.push((await S()).p); }
    out.downTrace = down; out.afterDown = Q.short(await Q.settle(page, 8000));
    return out;
  });

  await section('t2_cards_and_world', async () => {
    const out = {}; await L.fly(page, 'max'); await page.waitForTimeout(900);
    for (let i = 0; i < 6; i++) { await swipe(W / 2, H * .8, W / 2, H * .2, { steps: 8, gap: 10 }); await page.waitForTimeout(500); }
    await page.waitForTimeout(1500); out.afterSwipesAtEnd = Q.short(await S());
    for (let i = 0; i < 8 && !(await S()).cards?.open; i++) { await swipe(W / 2, H * .8, W / 2, H * .2, { steps: 8, gap: 10 }); await page.waitForTimeout(600); }
    await page.waitForTimeout(1800); out.cards = Q.short(await S()); await Q.shot(page, 't2-cards-open-phone', 66).catch(() => { });
    const sBefore = (await S()).cards; await swipe(W * .85, H * .5, W * .15, H * .5, { steps: 10, gap: 12 }); await page.waitForTimeout(900); const sAfter = (await S()).cards;
    out.cardsSideSwipe = { before: sBefore && sBefore.strip, after: sAfter && sAfter.strip };
    await swipe(W * .15, H * .5, W * .85, H * .5, { steps: 10, gap: 12 }); await page.waitForTimeout(900); out.cardsSideSwipeBack = (await S()).cards && (await S()).cards.strip;
    // vertical swipes to enter the world
    for (let i = 0; i < 24 && !(await S()).world?.open; i++) { await swipe(W / 2, H * .75, W / 2, H * .2, { steps: 8, gap: 10 }); await page.waitForTimeout(450); }
    await page.waitForTimeout(2500); out.worldEntered = Q.short(await S());
    const y0 = (await S()).world?.y; const ys = [y0];
    for (let i = 0; i < 6; i++) { await swipe(W / 2, H * .75, W / 2, H * .25, { steps: 10, gap: 12 }); await page.waitForTimeout(600); ys.push((await S()).world?.y); }
    out.worldYsUp = ys;
    return out;
  });

  await section('t3_ocean_swipes', async () => {
    const out = {}; await reload();
    const w = (await L.enterWorld(page, { width: W, height: H })).state; await L.jumpWorld(page, L.worldY(w, 'h:0')); await page.waitForTimeout(1500);
    const rows = []; let y = (await S()).world.y;
    for (const [name, dx, dy] of [['sideLeft', -240, 0], ['sideLeft2', -240, 0], ['sideRight', 240, 0], ['diag', -200, -60], ['verticalUp', 0, -260], ['verticalDown', 0, 260]]) {
      const x0 = W / 2 + (dx > 0 ? -dx / 2 : dx < 0 ? -dx / 2 : 0), y0 = H * .55 + (dy > 0 ? -dy / 2 : dy < 0 ? -dy / 2 : 0);
      await swipe(x0, y0, x0 + dx, y0 + dy, { steps: 12, gap: 12 }); await page.waitForTimeout(1300); const s = await S(); rows.push({ name, dx, dy, y: s.world.y, moved: s.world.y - y }); y = s.world.y;
    }
    out.rows = rows; await Q.shot(page, 't3-ocean-after-swipes-phone', 66).catch(() => { });
    return out;
  });

  await section('t4_taps', async () => {
    const out = { taps: [] }; await reload(); await L.fly(page, 0); await page.waitForTimeout(800);
    const tap = async (sel, label) => { const box = await page.locator(sel).first().boundingBox().catch(() => null); if (!box) return { label, err: 'no box' }; const s0 = await S(); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(900); const s1 = await Q.settle(page, 9000); return { label, size: [Math.round(box.width), Math.round(box.height)], from: s0.p, to: s1.p, menuOpen: s1.ui.menuOpen }; };
    out.taps.push(await tap('.fi-menu-toggle', 'MENU')); await page.touchscreen.tap(W / 2, H - 5).catch(() => { }); await page.waitForTimeout(600);
    const m = await page.evaluate(() => document.querySelector('dialog.fi-menu').open); out.menuAfterOutsideTap = m; if (m) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    out.taps.push(await tap('.fi-explore', 'EXPLORE'));
    out.taps.push(await tap('.fi-footer-next', 'NEXT CHAPTER'));
    out.taps.push(await tap('.fi-rail [data-chapter="4"]', 'rail 5'));
    out.taps.push(await tap('.fi-sound', 'SOUND'));
    out.taps.push(await tap('.fi-copy-panel.is-active .fi-copy-action', 'CTA'));
    out.taps.push(await tap('.fi-brand', 'brand'));
    return out;
  });

  await section('t5_tap_target_sizes', async () => {
    const measure = () => page.evaluate(() => {
      const out = []; const sel = 'button, a[href], [role=tab], input, select, summary, [tabindex]:not([tabindex="-1"])';
      for (const e of document.querySelectorAll(sel)) {
        if (e.closest('[inert]') || e.closest('dialog:not([open])')) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        let op = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity; if (op < .1) continue;
        const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
        out.push({ el: (e.className && e.className.toString().split(/\s+/)[0]) || e.tagName.toLowerCase(), label: (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28), w: Math.round(r.width), h: Math.round(r.height) });
      }
      return out;
    });
    const out = {}; await reload();
    for (const st of ['p:0', 'p:5.56', 'p:max', 'cards']) { if (st === 'cards') await Q.goState(page, L, vp, 'cards'); else await L.fly(page, st === 'p:max' ? 'max' : +st.slice(2)); await page.waitForTimeout(900); const m = await measure(); out[st] = { n: m.length, under24: m.filter(x => x.w < 24 || x.h < 24), under44: m.filter(x => (x.w < 44 || x.h < 44) && x.w >= 24 && x.h >= 24) }; }
    const w = (await L.enterWorld(page, { width: W, height: H })).state;
    for (const t of ['g:0.9', 'h:0', 'h:1', 'end']) { await L.jumpWorld(page, L.worldY(w, t)); await page.waitForTimeout(1200); const m = await measure(); out['world ' + t] = { n: m.length, under24: m.filter(x => x.w < 24 || x.h < 24), under44: m.filter(x => (x.w < 44 || x.h < 44) && x.w >= 24 && x.h >= 24) }; if (t === 'end') await Q.shot(page, 't5-footer-phone', 66).catch(() => { }); }
    return out;
  });
  return { ok: true, sections: Object.keys(res), file: path.relative(Q.ROOT, file) };
};
