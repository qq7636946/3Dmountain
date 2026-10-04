// Sampling heap profile of per-frame garbage, including objects already collected (short-lived allocations).
// node heap-profile.cjs <baseUrl> [scenarios] [frames]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:5200/__base__/';
const SCEN = (process.argv[3] || 'hero,logo,canyon,rivers').split(',');
const FRAMES = Number(process.argv[4] || 240);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    const raw = window.requestAnimationFrame.bind(window); window.__rawRaf = raw; window.__rafFrozen = false;
    window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); });
  });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  await page.goto(BASE + 'index4-6-3.html?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 240000, polling: 250 });
  await page.evaluate(() => { window.__rafFrozen = true; });
  const cdp = await context.newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  for (const name of SCEN) {
    await page.evaluate(([n]) => {
      const S = window.__MONTIS_STUDY__, C = S.CONFIG;
      const shift = Math.max(0, S.logoChapterEnd() - C.disperse.handoff * 2.6) + S.forwardLength() - .572, ls = C.logo.at * 2.6;
      const map = { hero: 0, disperse: .52, logo: ls + C.logo.length * .44, transition: S.logoChapterEnd() - .16, canyon: 4.6 + shift, rivers: 10.98 + shift };
      S.journey.progress = S.journey.target = map[n]; S.step(120, 1 / 60);
    }, [name]);
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 128, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    await page.evaluate(n => { window.__MONTIS_STUDY__.step(n, 1 / 60); }, FRAMES);
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    const agg = new Map(); let total = 0;
    const walk = node => {
      const cf = node.callFrame;
      if (node.selfSize > 0) {
        const key = `${cf.functionName || '(anon)'} @ ${cf.url.split('/').pop().split('?')[0]}:${cf.lineNumber + 1}`;
        agg.set(key, (agg.get(key) || 0) + node.selfSize); total += node.selfSize;
      }
      (node.children || []).forEach(walk);
    };
    walk(profile.head);
    const rows = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
    console.log(`\n## ${name}: ${(total / FRAMES / 1024).toFixed(1)} KB/frame sampled`);
    for (const [k, v] of rows) console.log(`  ${(v / FRAMES / 1024).toFixed(2).padStart(7)} KB/f  ${k}`);
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
