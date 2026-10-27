'use strict';
/* QA · page lifecycle and odd environments: resize mid-state (desktop <-> phone sizes), refresh at several places (restored scroll?), URL hashes,
   tab hidden -> visible mid-transition, bfcache-style leave/return, window blur/focus, text selection + drag, right-click,
   ctrl+wheel / shift+wheel / horizontal wheel, WebGL context loss of the main canvas and of the world canvas.
   Appends to .qa/index1-5/qa-interaction/lifecycle.json per section.
   Run: node scripts/index1-5/probe.cjs --script scripts/index1-5/probes/qa/lifecycle.probe.cjs --out qa-lifecycle [--reduced]   Env QA_ONLY="l1,l8" */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp, log }) => {
  const only = process.env.QA_ONLY ? process.env.QA_ONLY.split(',') : null;
  const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'lifecycle' + (process.env.QA_SUFFIX || '') + '.json'); const res = {};
  const rec = (k, v) => { res[k] = v; fs.writeFileSync(file, JSON.stringify(res, null, 1)); };
  const want = k => !only || only.includes(k);
  const S = () => Q.study(page);
  const css = () => page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });
  const waitReady = async () => { await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 120000, polling: 250 }); await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; }); await css(); };
  const reload = async () => { await page.reload({ waitUntil: 'commit' }); await waitReady(); await page.mouse.move(vp.width / 2, vp.height / 2); };
  const section = async (k, fn) => { if (!want(k)) return; const e0 = log.errors.length; const t0 = Date.now(); try { const out = await fn(); out.errorsDuring = log.errors.slice(e0); out.ms = Date.now() - t0; rec(k, out); } catch (e) { rec(k, { threw: String(e.message || e).slice(0, 300), errorsDuring: log.errors.slice(e0) }); } };
  const geom = () => page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, bodyOverflowX: document.documentElement.scrollWidth > innerWidth + 1, worldCanvas: (() => { const c = document.querySelector('.fiw-canvas'); return c && [c.width, c.height, Math.round(c.getBoundingClientRect().width), Math.round(c.getBoundingClientRect().height)]; })(), glCanvas: (() => { const c = document.querySelector('#gl'); return c && [c.width, c.height]; })() }));
  const size = async (w, h) => { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(1500); };
  await css(); await page.mouse.move(vp.width / 2, vp.height / 2);

  /* l1 resize mid-state */
  await section('l1_resize', async () => {
    const out = { cases: [] }; const W0 = vp.width, H0 = vp.height;
    const pair = [[390, 844], [768, 1024], [1920, 1080]];
    for (const st of ['p:2.96', 'cards', 'global', 'h:1', 'logo', 'footer']) {
      let worldState = null;
      if (/^(global|h:|logo|footer)/.test(st)) worldState = (await L.enterWorld(page, { width: W0, height: H0 })).state;
      await Q.goState(page, L, { width: W0, height: H0 }, st, worldState); await page.waitForTimeout(500);
      const before = await S(), g0 = await geom();
      const c = { state: st, before: Q.short(before), g0, sizes: [] };
      for (const [w, h] of pair) {
        await size(w, h); const s = await Q.settle(page, 4000), g = await geom();
        await Q.shot(page, `l1-resize-${st.replace(':', '')}-${w}x${h}`, 66).catch(() => { });
        c.sizes.push({ w, h, state: Q.short(s), worldY: s.world && s.world.open ? `${s.world.y}/${s.world.maxY}` : null, hOverflow: g.bodyOverflowX, worldCanvas: g.worldCanvas, gl: g.glCanvas });
      }
      await size(W0, H0); const back = await S(), gb = await geom(); c.backToStart = { state: Q.short(back), worldCanvas: gb.worldCanvas, gl: gb.glCanvas }; out.cases.push(c);
      if (st !== 'p:2.96' && st !== 'cards') { /* leave the world for the next state to re-enter cleanly */ await reload(); }
      else if (st === 'cards') { await reload(); }
    }
    return out;
  });

  /* l2 refresh at various places + hash links */
  await section('l2_refresh_hash', async () => {
    const out = { refresh: [], hash: [] };
    for (const st of ['p:5.56', 'cards', 'footer']) {
      let ws = null; if (st === 'footer') ws = (await L.enterWorld(page, vp)).state;
      await Q.goState(page, L, vp, st, ws); await page.waitForTimeout(500); const before = await S();
      await page.reload({ waitUntil: 'commit' }); await page.waitForTimeout(600); await waitReady(); await page.waitForTimeout(1500);
      const after = await S();
      const info = await page.evaluate(() => ({ scrollRestoration: history.scrollRestoration, scrollY: scrollY, docScroll: document.scrollingElement.scrollTop, hash: location.hash, loaderGone: !document.querySelector('#loader')?.offsetParent || getComputedStyle(document.querySelector('#loader')).opacity === '0' || getComputedStyle(document.querySelector('#loader')).display === 'none', heroVisible: (() => { const h = document.querySelector('.fi-copy-panel.is-active'); return h && h.dataset.copy; })() }));
      await Q.shot(page, `l2-refresh-from-${st.replace(':', '')}`, 66).catch(() => { });
      out.refresh.push({ from: st, before: Q.short(before), after: Q.short(after), ...info });
    }
    for (const h of ['#contact', '#global', '#logo-seal', '#chapter-strategies', '#responsibility', '#nope']) {
      await page.goto(Q.ROOT ? L.BASE + L.PAGE_FILE + '?tune=0' + h : '', { waitUntil: 'commit' }); await waitReady(); await page.waitForTimeout(1800);
      const s = await S(); const info = await page.evaluate(() => ({ scrollY, docScroll: document.scrollingElement.scrollTop, bodyScroll: document.body.scrollTop, hash: location.hash, active: document.activeElement?.tagName }));
      out.hash.push({ hash: h, state: Q.short(s), ...info });
    }
    await page.goto(L.BASE + L.PAGE_FILE + '?tune=0', { waitUntil: 'commit' }); await waitReady();
    return out;
  });

  /* l3 hidden -> visible during transitions */
  await section('l3_visibility', async () => {
    const out = {};
    const hide = ms => page.evaluate(async ms => { const set = v => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => v }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }; set(true); await new Promise(r => setTimeout(r, ms)); set(false); }, ms);
    await L.fly(page, 0); await page.waitForTimeout(500);
    await page.click('.fi-rail [data-chapter="3"]'); await page.waitForTimeout(500); await hide(2500); const s1 = await Q.settle(page, 14000);
    out.journeyHiddenDuringRail = { state: Q.short(s1), chapter: await page.evaluate(() => document.querySelector('.fi-footer-current').textContent) };
    // sound state across hidden
    await page.click('.fi-sound').catch(() => { }); await page.waitForTimeout(500); await hide(800);
    out.soundAfterHidden = await page.evaluate(() => { const b = document.querySelector('.fi-sound'); return { pressed: b.getAttribute('aria-pressed'), text: b.querySelector('span').textContent }; });
    await page.click('.fi-sound').catch(() => { });
    // world: hide while the spring is running
    const w = (await L.enterWorld(page, vp)).state; await L.jumpWorld(page, L.worldY(w, 'g:0.3')); await page.waitForTimeout(600);
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(50); }
    await hide(2000); const s2 = await Q.settle(page, 8000); out.worldHiddenDuringScroll = Q.short(s2);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(100); } const s3 = await Q.settle(page, 8000); out.worldRespondsAfter = { before: s2.world && s2.world.y, after: s3.world && s3.world.y };
    // cards stage: hidden during the bridge
    await reload(); await L.fly(page, 'max'); await page.waitForTimeout(600);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(60); }
    await hide(2500); out.cardsBridgeHidden = Q.short(await Q.settle(page, 9000));
    // blur / focus events (no behaviour expected)
    await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); }); out.afterBlurFocus = Q.short(await S());
    return out;
  });

  /* l4 leave and return (bfcache / history) */
  await section('l4_history', async () => {
    const out = {}; await reload(); await L.fly(page, 3.6); await page.waitForTimeout(500);
    out.before = Q.short(await S());
    await page.goto('about:blank'); await page.waitForTimeout(500);
    await page.goBack({ waitUntil: 'commit' }).catch(e => { out.backErr = String(e.message).split('\n')[0]; }); await page.waitForTimeout(1500);
    try { await waitReady(); } catch (e) { out.readyErr = String(e.message).split('\n')[0]; }
    out.afterBack = Q.short(await S().catch(() => ({ p: 'n/a', t: 'n/a', max: 'n/a', cards: null, world: null, ui: {} })));
    out.persisted = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.type);
    out.historyLength = await page.evaluate(() => history.length);
    return out;
  });

  /* l5 selection, drag, right click, modified wheels */
  await section('l5_pointer_oddities', async () => {
    const out = {}; await reload(); await L.fly(page, 0); await page.waitForTimeout(800);
    await page.keyboard.press('Control+a'); await page.waitForTimeout(200);
    out.selectAll = await page.evaluate(() => ({ len: getSelection().toString().length, sample: getSelection().toString().replace(/\s+/g, ' ').slice(0, 80) }));
    await Q.shot(page, 'l5-select-all-top', 66).catch(() => { });
    await page.mouse.click(5, 5); await page.waitForTimeout(200);
    // drag across the hero text
    await page.mouse.move(vp.width * .3, vp.height * .5); await page.mouse.down(); await page.mouse.move(vp.width * .7, vp.height * .55, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(200);
    out.dragSelect = await page.evaluate(() => getSelection().toString().length);
    // drag the droplet / canvas: the journey must not move
    const s0 = await S(); await page.mouse.move(vp.width * .5, vp.height * .45); await page.mouse.down(); await page.mouse.move(vp.width * .56, vp.height * .6, { steps: 14 }); await page.waitForTimeout(300); await page.mouse.up(); await page.waitForTimeout(700);
    out.dragCanvas = { before: Q.short(s0), after: Q.short(await S()) };
    // right click on canvas, on a button, on the droplet
    for (const [name, x, y] of [['canvas', vp.width * .5, vp.height * .45], ['corner', 40, vp.height - 40]]) { await page.mouse.click(x, y, { button: 'right' }).catch(() => { }); await page.waitForTimeout(300); }
    await page.mouse.click(vp.width * .5, vp.height * .45, { button: 'middle' }).catch(() => { }); await page.waitForTimeout(300);
    out.afterRightMiddle = Q.short(await S()); out.dropGrabClass = await page.evaluate(() => document.body.className.replace(/\s+/g, ' ').slice(0, 120));
    // wheel variants in the ocean
    const w = (await L.enterWorld(page, vp)).state; await L.jumpWorld(page, L.worldY(w, 'h:1')); await page.waitForTimeout(1200);
    const y0 = (await S()).world.y;
    await page.mouse.wheel(300, 0); await page.waitForTimeout(900); const yH = (await S()).world.y;
    await page.keyboard.down('Shift'); await page.mouse.wheel(0, 300); await page.keyboard.up('Shift'); await page.waitForTimeout(900); const yS = (await S()).world.y;
    await page.keyboard.down('Control'); await page.mouse.wheel(0, 300); await page.keyboard.up('Control'); await page.waitForTimeout(900); const yC = (await S()).world.y;
    await page.mouse.wheel(0, 120); await page.waitForTimeout(900); const yV = (await S()).world.y;
    out.oceanWheel = { start: y0, afterHorizontalDeltaX300: yH, afterShiftWheel: yS, afterCtrlWheel: yC, afterPlainWheel120: yV };
    return out;
  });

  /* l8 WebGL context loss */
  await section('l8_context_loss', async () => {
    const out = {}; await reload(); await L.fly(page, 2.96); await page.waitForTimeout(800);
    out.main = await page.evaluate(async () => {
      const c = document.querySelector('#gl'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const ext = gl && gl.getExtension('WEBGL_lose_context'); if (!ext) return { skipped: true };
      let prevented = null; c.addEventListener('webglcontextlost', e => { prevented = e.defaultPrevented; }, { once: true });
      ext.loseContext(); await new Promise(r => setTimeout(r, 900)); const lost = gl.isContextLost(); const mode = document.documentElement.dataset.renderMode; ext.restoreContext(); await new Promise(r => setTimeout(r, 1800));
      return { lost, renderModeAfterLoss: mode || null, restored: !gl.isContextLost(), renderModeAfterRestore: document.documentElement.dataset.renderMode || null, bodyBooting: document.body.classList.contains('is-booting'), canvasDisplay: getComputedStyle(c).display, panels: [...document.querySelectorAll('.fi-copy-panel')].filter(p => !p.inert).map(p => p.dataset.copy) };
    });
    await Q.shot(page, 'l8-main-context-lost', 66).catch(() => { });
    out.afterMain = Q.short(await S());
    out.readable = await page.evaluate(() => ({ readableCss: !!document.getElementById('finnovation-readable'), menuToggle: !!document.querySelector('.fi-menu-toggle')?.offsetParent, hasHorizontalScroll: document.documentElement.scrollWidth > innerWidth + 1, scrollable: getComputedStyle(document.documentElement).overflowY, bodyOverflow: getComputedStyle(document.body).overflowY }));
    // world canvas
    await reload(); const w = (await L.enterWorld(page, vp)).state; await L.jumpWorld(page, L.worldY(w, 'h:1')); await page.waitForTimeout(1200);
    out.world = await page.evaluate(async () => {
      const c = document.querySelector('.fiw-canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const ext = gl && gl.getExtension('WEBGL_lose_context'); if (!ext) return { skipped: true };
      ext.loseContext(); await new Promise(r => setTimeout(r, 800)); const lost = gl.isContextLost(); ext.restoreContext(); await new Promise(r => setTimeout(r, 2000)); return { lost, restored: !gl.isContextLost(), renderMode: document.documentElement.dataset.renderMode || null };
    });
    await page.waitForTimeout(800); out.afterWorldLoss = Q.short(await S());
    for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(150); } await page.waitForTimeout(900); out.worldStillScrolls = Q.short(await S());
    await Q.shot(page, 'l8-world-context-restored', 66).catch(() => { });
    return out;
  });
  return { ok: true, sections: Object.keys(res), file: path.relative(Q.ROOT, file) };
};
