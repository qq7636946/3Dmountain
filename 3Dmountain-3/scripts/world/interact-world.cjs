// Interaction checks: touch drag/fling/return (phone), keyboard (desktop), reduced motion, index.html untouched.
//   node scripts/world/interact-world.cjs
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
let chromium; try { ({ chromium } = require(PW)); } catch { ({ chromium } = require('playwright')); }
const BASE = process.env.BASE || 'http://localhost:5178/';   // the dev server (npx serve . / .claude/launch.json montis); note it serves index1-1 without .html
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const path = require('path'), fs = require('fs');
const out = path.join(require('os').tmpdir(), 'finnovation-world-qa', 'interact'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };

async function toEnd(page, W, H) {
  await page.waitForFunction(() => window.__MONTIS_STUDY__ && document.body.classList.contains('is-ready'), null, { timeout: 120000 });
  await page.mouse.move(W / 2, H / 2);
  await page.keyboard.press('End');
  await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .01 && s.portfolio && s.portfolio.ready; }, null, { timeout: 120000 });
  await page.waitForTimeout(400);
}
async function toWorld(page) {
  for (let n = 0; n < 200; n++) { await page.mouse.wheel(0, 160); await page.waitForTimeout(45); if (await page.evaluate(() => window.__MONTIS_STUDY__.world?.open)) break; }
  await page.waitForFunction(() => window.__MONTIS_STUDY__.world?.open, null, { timeout: 30000 });
  await page.evaluate(() => window.__MONTIS_STUDY__.world.ready);
}
const st = page => page.evaluate(() => { const w = window.__MONTIS_STUDY__.world; return w ? { open: w.open, y: Math.round(w.state.y), yt: Math.round(w.state.yt), maxY: Math.round(w.state.maxY), strip: window.__MONTIS_STUDY__.portfolio.strip } : null; });
async function drag(cdp, x, y0, y1, ms = 160, steps = 10) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * i / steps }] }); await new Promise(r => setTimeout(r, ms / steps)); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    // ---------- phone: touch ----------
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(BASE + 'index1-1?tune=0&letters=0'); await toEnd(page, 390, 844); await toWorld(page);
      await page.evaluate(() => window.__MONTIS_STUDY__.world.jump(2200)); await page.waitForTimeout(600);
      const cdp = await ctx.newCDPSession(page);
      const a = await st(page);
      await drag(cdp, 195, 640, 340, 300, 12); await page.waitForTimeout(80);
      const b = await st(page);
      check('touch drag up scrolls the world ~1:1', b.yt - a.y > 260 && b.yt - a.y < 900, { before: a.y, after: b.yt });
      await page.waitForTimeout(900);
      await drag(cdp, 195, 700, 300, 90, 6); await page.waitForTimeout(1200);
      const c = await st(page);
      check('fast flick carries on (momentum)', c.y - b.yt > 450, { before: b.yt, after: c.y });
      // back at the top, pull down: the world closes and the strip scrolls back
      await page.evaluate(() => window.__MONTIS_STUDY__.world.jump(40)); await page.waitForTimeout(600);
      const stripBefore = (await st(page)).strip;
      await drag(cdp, 195, 250, 750, 400, 16); await page.waitForTimeout(900);
      const d = await st(page);
      check('pull down at the top returns to the cards', !d.open && d.strip < stripBefore, { open: d.open, strip: [stripBefore, d.strip] });
      check('phone: no page errors', errors.length === 0, errors.slice(0, 3));
      await ctx.close();
    }
    // ---------- desktop: keyboard ----------
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(BASE + 'index1-1?tune=0&letters=0'); await toEnd(page, 1440, 900); await toWorld(page);
      await page.evaluate(() => window.__MONTIS_STUDY__.world.jump(1600)); await page.waitForTimeout(500);
      const a = await st(page);
      for (let i = 0; i < 3; i++) { await page.keyboard.press('PageDown'); await page.waitForTimeout(120); }
      await page.waitForTimeout(700);
      const b = await st(page);
      check('PageDown x3 scrolls the world', b.y - a.y > 1500, { from: a.y, to: b.y });
      await page.keyboard.press('End'); await page.waitForTimeout(1500);
      const c = await st(page);
      check('End goes to the footer', c.y >= c.maxY - 2, c);
      // Tab into the footer: focus must land on a visible control
      await page.evaluate(() => document.querySelector('#fiWorld [data-world-top]').focus());
      for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
      await page.waitForTimeout(600);
      const f = await page.evaluate(() => { const el = document.activeElement, r = el.getBoundingClientRect(); return { tag: el.tagName, text: el.textContent.trim().slice(0, 30), top: Math.round(r.top), bottom: Math.round(r.bottom), inWorld: !!el.closest('#fiWorld') }; });
      check('Tab moves through footer links, on screen', f.inWorld && f.top >= 0 && f.bottom <= 900, f);
      await page.screenshot({ path: path.join(out, 'desktop-footer-focus.png') });
      // a footer chapter link flies the journey back and closes everything
      await page.evaluate(() => document.querySelector('#fiWorld [data-chapter-link="2"]').click());
      await page.waitForTimeout(2500);
      const g = await page.evaluate(() => ({ world: window.__MONTIS_STUDY__.world.open, cards: window.__MONTIS_STUDY__.portfolio.open, target: +window.__MONTIS_STUDY__.journey.target.toFixed(2), body: document.body.className.includes('is-world') }));
      check('footer chapter link leaves the epilogue', !g.world && !g.cards && g.target < 8 && !g.body, g);
      await page.screenshot({ path: path.join(out, 'desktop-after-chapter-link.png') });
      check('desktop: no page errors', errors.length === 0, errors.slice(0, 3));
      await ctx.close();
    }
    // ---------- reduced motion ----------
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      const asked = []; page.on('request', r => { if (/gsap/.test(r.url())) asked.push(r.url()); });
      await page.goto(BASE + 'index1-1?tune=0&letters=0'); await toEnd(page, 1440, 900); await toWorld(page);
      for (const [name, y] of [['rm-cards', 300], ['rm-planet', 1700], ['rm-block', 4300], ['rm-footer', 99999]]) {
        await page.evaluate(v => window.__MONTIS_STUDY__.world.jump(v), y); await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(out, name + '.png') });
      }
      const hidden = await page.evaluate(() => [...document.querySelectorAll('#fiWorld [data-reveal]')].filter(el => getComputedStyle(el).opacity < .5).length);
      check('reduced motion: no motion library, all text visible', asked.length === 0 && hidden === 0, { gsap: asked.length, hidden });
      check('reduced motion: no page errors', errors.length === 0, errors.slice(0, 3));
      await ctx.close();
    }
    // ---------- index.html untouched ----------
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const asked = []; page.on('request', r => { if (/finnovation-world|world\.css|images\/world/.test(r.url())) asked.push(r.url()); });
      await page.goto(BASE + 'index?tune=0&letters=0'); await toEnd(page, 1440, 900);
      const t0 = Date.now();
      await page.mouse.wheel(0, 140);
      await page.waitForFunction(() => window.__MONTIS_STUDY__.portfolio.transition > .99, null, { timeout: 15000 });
      const ms = Date.now() - t0;
      for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 160); await page.waitForTimeout(40); }
      await page.waitForTimeout(800);
      const s = await page.evaluate(() => ({ bridge: window.__MONTIS_STUDY__.portfolio.bridge, world: !!window.__MONTIS_STUDY__.world, flag: document.documentElement.dataset.epilogue || null, strip: window.__MONTIS_STUDY__.portfolio.strip, worldEl: !!document.querySelector('#fiWorld') }));
      check('index.html keeps the timed fade and stops at the cards', s.bridge === false && !s.world && !s.flag && !s.worldEl && asked.length === 0 && ms < 2500, { ...s, openMs: ms, asked: asked.length });
      await page.screenshot({ path: path.join(out, 'index-cards-end.png') });
      check('index.html: no page errors', errors.length === 0, errors.slice(0, 3));
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
})().catch(e => { console.error(e); process.exitCode = 1; });
