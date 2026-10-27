// Card strip → Earth handoff, frame by frame: wheel to the last card, then one notch, then a screenshot every few
// tens of milliseconds. Writes the frames and a timeline (ms after that notch) to the folder given as the argument.
//   node scripts/world/handoff-shots.cjs <outDir> [--throttle=4] [--net=fast3g] [--phone]
// Env: PAGE (default index1-1), PLAYWRIGHT_CORE, CHROME, BASE — as in handoff-measure.cjs.
const fs = require('fs');
const path = require('path');
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
let chromium; try { ({ chromium } = require(PW)); } catch { ({ chromium } = require('playwright')); }
const BASE = process.env.BASE || 'http://localhost:5178/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outDir = process.argv[2];
if (!outDir) { console.error('usage: handoff-shots.cjs <outDir>'); process.exit(1); }
const arg = name => process.argv.includes(name);
const num = (flag, fallback) => +((process.argv.find(a => a.startsWith(flag + '=')) || '').slice(flag.length + 1) || fallback);
const throttle = num('--throttle', 0), netName = (process.argv.find(a => a.startsWith('--net=')) || '').slice(6);
const NETS = { '4g': { latency: 80, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 }, fast3g: { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: .75e6 / 8 } };
const view = arg('--phone') ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const page_ = process.env.PAGE || 'index1-1';

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await browser.newContext(view);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    if (throttle) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
    await page.goto(BASE + page_ + '?tune=0&letters=0');
    await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 120000 });
    await page.mouse.move(view.viewport.width / 2, view.viewport.height / 2);
    if (netName) { const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETS[netName] }); }

    // Steady wheel down to the last card (the strip stops at 1).
    const started = Date.now();
    while (Date.now() - started < 150000) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(60);
      if (await page.evaluate(() => (window.__MONTIS_STUDY__.portfolio?.strip ?? 0) >= .999)) break;
    }
    // Let the cards settle, then one notch, then frames.
    await page.waitForTimeout(400);
    const state = () => page.evaluate(() => {
      const s = window.__MONTIS_STUDY__, p = s.portfolio, w = s.world;
      return { t: performance.now(), transition: +(p?.transition ?? -1).toFixed(3), strip: +(p?.strip ?? -1).toFixed(3), mounted: !!w, open: !!(w && w.open), y: w ? Math.round(w.state.y) : -1 };
    });
    const t0 = await page.evaluate(() => performance.now());
    await page.mouse.wheel(0, 120);
    const log = [];
    for (let i = 0; i < 30; i++) {
      const st = await state();
      const file = path.join(outDir, String(i).padStart(2, '0') + '.jpg');
      await page.screenshot({ path: file, type: 'jpeg', quality: 70 });
      log.push({ i, ms: Math.round(st.t - t0), ...st, file: path.basename(file) });
      if (st.y > 420) break;
      await page.waitForTimeout(40);
    }
    fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify({ page: page_, throttle, net: netName || 'none', log, errors: errors.slice(0, 5) }, null, 1));
    console.log(JSON.stringify({ frames: log.length, last: log[log.length - 1], errors: errors.slice(0, 3) }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
