// Scrolling back up from the Earth: how long until the page answers the first wheel-up notch (read-only).
//   node scripts/world/reverse-measure.cjs [--gap=80] [--notches=14]
// Env: PAGE (default index1-1), BASE (default http://localhost:5178/), PLAYWRIGHT_CORE, CHROME.
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
let chromium; try { ({ chromium } = require(PW)); } catch { ({ chromium } = require('playwright')); }
const BASE = process.env.BASE || 'http://localhost:5178/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGE = process.env.PAGE || 'index1-1';
const num = (flag, fallback) => +((process.argv.find(a => a.startsWith(flag + '=')) || '').slice(flag.length + 1) || fallback);
const gap = num('--gap', 80), notches = num('--notches', 14);

// Runs in the page: one record per frame [now, dt, worldOpen, worldY, portfolioOpen, transition, strip, worldCovering, portfolioCovering],
// the wheel events [time, deltaY] and long tasks.
const probe = () => {
  window.__rec = []; window.__wheel = []; window.__lt = []; window.__stopRec = false;
  addEventListener('wheel', e => window.__wheel.push([performance.now(), e.deltaY]), { capture: true, passive: true });
  try { new PerformanceObserver(list => list.getEntries().forEach(e => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch { }
  let last = performance.now();
  const loop = now => {
    const s = window.__MONTIS_STUDY__ || {}, p = s.portfolio, w = s.world;
    window.__rec.push([Math.round(now), +(now - last).toFixed(1),
      w ? (w.open ? 1 : 0) : -1, w ? +w.state.y.toFixed(1) : -1,
      p ? (p.open ? 1 : 0) : -1, p ? +p.transition.toFixed(3) : -1, p ? +p.strip.toFixed(3) : -1,
      w && w.covering ? 1 : 0, p && p.covering ? 1 : 0]);
    last = now;
    if (!window.__stopRec) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
    await page.goto(BASE + PAGE + '?tune=0&letters=0');
    await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 120000 });
    await page.mouse.move(720, 450);
    if (+process.env.THROTTLE) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.THROTTLE }); }
    // Down, through the cards, into the Earth.
    const started = Date.now();
    let inWorld = false;
    while (Date.now() - started < 150000) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(60);
      inWorld = await page.evaluate(min => { const w = window.__MONTIS_STUDY__.world; return !!w && w.open && w.state.y > min; }, +(process.env.YMIN || 500));
      if (inWorld) break;
    }
    if (!inWorld) { console.log(JSON.stringify({ error: 'never reached the Earth', errors })); return; }
    await page.waitForTimeout(2500);
    await page.evaluate(probe);
    // Back up, steady notches.
    for (let i = 0; i < notches; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(gap); }
    await page.waitForTimeout(1800);
    const data = await page.evaluate(() => { window.__stopRec = true; return { rec: window.__rec, wheel: window.__wheel, lt: window.__lt }; });

    const rec = data.rec;
    const ups = data.wheel.filter(w => w[1] < 0);
    const tUp = ups.length ? ups[0][0] : null;
    if (tUp === null) { console.log(JSON.stringify({ error: 'no wheel-up recorded', errors })); return; }
    const before = rec.filter(r => r[0] < tUp).slice(-1)[0] || rec[0];
    const y0 = before[3];
    const resp = rec.find(r => r[0] >= tUp && r[3] >= 0 && r[3] < y0 - 1);
    const rel = t => Math.round(t - tUp);
    const winEnd = rec[rec.length - 1][0];
    const win = rec.filter(r => r[0] >= tUp - 100 && r[0] <= winEnd);
    // only the flags that switch (world open, cards open, covering), and a sample of the Earth's height every ~6 frames
    const changes = []; let prev = '';
    const after = rec.filter(r => r[0] >= tUp - 100);
    for (const r of after) {
      const key = [r[2], r[4], r[7], r[8]].join('|');
      if (key !== prev) { changes.push([rel(r[0]), r[2], r[3], r[4], r[5], r[6], r[7], r[8]]); prev = key; }
    }
    const samples = after.filter((r, i) => i % 6 === 0).map(r => [rel(r[0]), r[3], r[5], r[6]]);
    const out = {
      page: PAGE, gap, notches, upNotches: ups.length,
      yAtFirstWheelUp: y0,
      worldRespondsMs: resp ? rel(resp[0]) : null,
      longTasksMs: data.lt.filter(([s]) => s >= tUp - 100 && s <= winEnd).map(([s, d]) => [rel(s), d]),
      longFramesOver34ms: win.filter(r => r[1] > 34).map(r => [rel(r[0]), r[1]]),
      changes,
      samples,
      columns: '[t, worldOpen, worldY, portfolioOpen, transition, strip, worldCovering, portfolioCovering]',
      errors: errors.slice(0, 5)
    };
    console.log(JSON.stringify(out, null, 1));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
