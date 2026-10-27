// Frame pacing from the end of the journey to the footer with a steady wheel; prints the world's preparation steps.
//   node scripts/world/perf-world.cjs [--phone|--tablet] [--throttle=4]
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
let chromium; try { ({ chromium } = require(PW)); } catch { ({ chromium } = require('playwright')); }
const BASE = process.env.BASE || 'http://localhost:5178/';   // the dev server (npx serve . / .claude/launch.json montis); note it serves index1-1 without .html
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const phone = process.argv.includes('--phone'), tablet = process.argv.includes('--tablet');
const throttle = +((process.argv.find(a => a.startsWith('--throttle=')) || '').slice(11) || 0);
const view = phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : tablet ? { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await browser.newContext(view);
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 200)); });
    if (throttle) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
    const t0 = Date.now();
    await page.goto(BASE + 'index1-1?tune=0&letters=0');
    await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 120000 });
    const loadMs = Date.now() - t0;
    const W = view.viewport.width, H = view.viewport.height;
    await page.mouse.move(W / 2, H / 2);
    await page.keyboard.press('End');
    await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .01 && s.portfolio && s.portfolio.ready; }, null, { timeout: 120000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false }); } catch { } }); await page.evaluate(() => { window.__f = []; let last = performance.now(); const loop = now => { window.__f.push([now, now - last, window.__MONTIS_STUDY__.portfolio?.transition || 0, window.__MONTIS_STUDY__.world?.open ? window.__MONTIS_STUDY__.world.state.y : -1]); last = now; if (!window.__stop) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
    let steps = 0;
    for (; steps < 400; steps++) {
      await page.mouse.wheel(0, 120); await page.waitForTimeout(50);
      if (steps % 10 === 9) { const done = await page.evaluate(() => { const w = window.__MONTIS_STUDY__.world; return !!(w && w.open && w.state.y >= w.state.maxY - 2); }); if (done) break; }
    }
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      window.__stop = true;
      const f = window.__f.slice(2), gaps = f.map(x => x[1]).sort((a, b) => a - b);
      const phase = (lo, hi) => { const g = f.filter(x => x[0] >= lo && x[0] < hi).map(x => x[1]); return g.length ? { frames: g.length, avgFps: +(1000 / (g.reduce((a, b) => a + b, 0) / g.length)).toFixed(1), hitches: g.filter(v => v > 34).length, max: +Math.max(...g).toFixed(1) } : null; };
      const firstWorld = f.find(x => x[3] >= 0)?.[0] ?? Infinity, firstCards = f.find(x => x[2] > .999)?.[0] ?? Infinity;
      const w = window.__MONTIS_STUDY__.world, info = w ? null : null;
      return {
        all: { frames: f.length, avgFps: +(1000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)).toFixed(1), p95: +gaps[Math.floor(gaps.length * .95)].toFixed(1), hitches: gaps.filter(v => v > 34).length, max: +gaps[gaps.length - 1].toFixed(1) },
        bridge: phase(0, firstCards), strip: phase(firstCards, firstWorld), world: phase(firstWorld, Infinity),
        steps: performance.getEntriesByType('measure').filter(m => m.name.startsWith('world')).map(m => m.name.slice(6) + ' ' + Math.round(m.duration) + 'ms').join(', '), longTasks: (window.__lt || []).join(','), dpr: w?.state.dpr, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : null
      };
    });
    console.log(JSON.stringify({ view: phone ? 'phone' : tablet ? 'tablet' : 'desktop', throttle, loadMs, steps, ...r, errors: errors.slice(0, 6) }, null, 1));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
