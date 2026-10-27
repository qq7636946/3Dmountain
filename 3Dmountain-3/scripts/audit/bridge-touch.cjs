// The valley -> cards bridge driven by finger swipes (CDP touch events), on a phone or a tablet; frame gaps and how far
// each swipe carries the bridge. Read-only.   node bridge-touch.cjs <base> [--tablet] [--swipes 6] [--px 140]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const args = process.argv.slice(2), flag = (k, d) => args.includes('--' + k) ? Number(args[args.indexOf('--' + k) + 1]) : d;
const base = args[0] || 'http://127.0.0.1:5651/', tablet = args.includes('--tablet');
const W = tablet ? 1024 : 390, H = tablet ? 1366 : 844, SWIPES = flag('swipes', 6), PX = flag('px', 140);
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(150000);
  const errors = []; page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  const cdp = await context.newCDPSession(page);
  await page.goto(base + 'index1-1.html?tune=0&letters=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 150000, polling: 250 });
  await page.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
  await page.evaluate(() => { const s = window.__MONTIS_STUDY__; s.journey.target = s.journey.max; });
  await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .01; }, null, { timeout: 90000, polling: 200 });
  await page.waitForFunction(() => window.__MONTIS_STUDY__.portfolio && window.__MONTIS_STUDY__.portfolio.ready, null, { timeout: 90000, polling: 200 }).catch(() => { });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const rec = window.__gaps = []; let last = performance.now(); const loop = now => { rec.push(now - last); last = now; if (!window.__stop) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  const after = [];
  const x = W / 2;
  for (let i = 0; i < SWIPES; i++) {
    const y0 = H * .7;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - PX * k / 10 }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(450);
    after.push(await page.evaluate(() => +(window.__MONTIS_STUDY__.portfolio?.transition ?? -1).toFixed(2)));
  }
  await page.waitForTimeout(1200);
  const gaps = await page.evaluate(() => { window.__stop = true; return window.__gaps; });
  const s = [...gaps].sort((a, b) => a - b);
  console.log(JSON.stringify({ size: W + 'x' + H, swipePx: PX, transitionAfterEachSwipe: after, frames: s.length, median: +s[Math.floor(s.length / 2)].toFixed(1), max: +s[s.length - 1].toFixed(1), over20: s.filter(v => v > 20).length, errors }));
  await shut(context); await shut(browser); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
