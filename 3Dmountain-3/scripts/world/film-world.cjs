// Rides index1-1 from the end of the journey through the cards into the world epilogue and films it.
// Screenshots go to the system temp folder by default (fs.rmSync on the Google Drive volume crashes Node).
//   node scripts/world/film-world.cjs [outDir] [--phone|--tablet] [--scroll] [--only=06,13]
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
let chromium; try { ({ chromium } = require(PW)); } catch { ({ chromium } = require('playwright')); }
const BASE = process.env.BASE || 'http://localhost:5178/';   // the dev server (npx serve . / .claude/launch.json montis); note it serves index1-1 without .html
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fs = require('fs'), path = require('path');
const phone = process.argv.includes('--phone'), tablet = process.argv.includes('--tablet'), real = process.argv.includes('--scroll');
const out = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(require('os').tmpdir(), 'finnovation-world-qa', 'world');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const view = phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : tablet ? { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await browser.newContext(view);
    const page = await ctx.newPage();
    const errors = [], bad = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
    page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 120)); });
    await page.goto(BASE + 'index1-1?tune=0&letters=0');
    await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey, null, { timeout: 90000 });
    await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 90000 });
    const W = view.viewport.width, H = view.viewport.height;
    await page.mouse.move(W / 2, H / 2);
    await page.keyboard.press('End');
    await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .01; }, null, { timeout: 90000 });
    await page.waitForFunction(() => window.__MONTIS_STUDY__.portfolio && window.__MONTIS_STUDY__.portfolio.ready, null, { timeout: 90000 });
    await page.waitForTimeout(600);
    // Through the bridge and the whole strip with the wheel, until the world opens.
    let n = 0;
    while (n < 200) {
      await page.mouse.wheel(0, 160); n++; await page.waitForTimeout(45);
      const o = await page.evaluate(() => window.__MONTIS_STUDY__.world?.open);
      if (o) break;
    }
    const t0 = Date.now();
    await page.waitForFunction(() => window.__MONTIS_STUDY__.world?.open, null, { timeout: 30000 });
    console.log('world opened after', n, 'wheel steps');
    await page.evaluate(() => window.__MONTIS_STUDY__.world.ready);
    const st = await page.evaluate(() => window.__MONTIS_STUDY__.world.state);
    console.log(JSON.stringify({ maxY: Math.round(st.maxY), at: Object.fromEntries(Object.entries(st.at).map(([k, v]) => [k, Math.round(v)])), dpr: st.dpr }));
    const shots = [];
    const at = st.at, stops = [
      ['00-start', 0], ['01-roll', at.clouds * .18], ['02-deck', at.clouds * .32], ['03-white', at.clouds * .44], ['04-tear', at.clouds * .62],
      ['05-open', at.clouds * .8], ['06-planet', at.clouds], ['07-statement', at.global + at.globalH * .3], ['08-statement2', at.global + at.globalH * .5],
      ['09-recede', at.global + at.globalH * .8], ['10-dark', at.resp + H * .1], ['11-intro', at.resp + H * .45], ['12-photo', at.block - H * .5],
      ['13-block1', at.block - H * .05], ['14-block1b', at.block + H * .6], ['15-mid', at.block + H * 2.2], ['16-late', at.footer - H * 1.1], ['17-footer', at.footer - H * .5], ['18-end', st.maxY]
    ];
    if (real) {
      // Wheel through the world as a visitor would, screenshot every ~third of a screen.
      let k = 0;
      for (let i = 0; i < 400; i++) {
        await page.mouse.wheel(0, 120); await page.waitForTimeout(40);
        if (i % 6 === 5) { await page.waitForTimeout(250); const y = await page.evaluate(() => Math.round(window.__MONTIS_STUDY__.world.state.y)); await page.screenshot({ path: path.join(out, String(k++).padStart(3, '0') + '-' + y + '.png') }); }
        const s = await page.evaluate(() => window.__MONTIS_STUDY__.world.state); if (s.y >= s.maxY - 1) break;
      }
    } else {
      const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
      for (const [name, y] of stops) {
        if (only.length && !only.some(o => name.startsWith(o))) continue;
        await page.evaluate(v => window.__MONTIS_STUDY__.world.jump(v), y);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(out, name + '.png') });
        shots.push(name);
      }
    }
    // Back up to the top and out to the cards with the wheel.
    await page.evaluate(() => window.__MONTIS_STUDY__.world.jump(200));
    await page.waitForTimeout(500);
    for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(60); }
    await page.waitForTimeout(800);
    const back = await page.evaluate(() => ({ worldOpen: window.__MONTIS_STUDY__.world.open, strip: window.__MONTIS_STUDY__.portfolio.strip, cardsOpen: window.__MONTIS_STUDY__.portfolio.open, body: document.body.className }));
    await page.screenshot({ path: path.join(out, '99-back-to-cards.png') });
    const metrics = await page.evaluate(() => { const r = window.__MONTIS_STUDY__.world; return { y: r.state.y, dpr: r.state.dpr }; });
    console.log(JSON.stringify({ back, metrics, ms: Date.now() - t0, errors: errors.slice(0, 12), bad: bad.slice(0, 12) }, null, 1));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
