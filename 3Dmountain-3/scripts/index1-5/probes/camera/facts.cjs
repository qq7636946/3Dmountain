// Facts about the canyon route/page clock (read-only). node facts.cjs [url]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:5621/index1-5.html?tune=0';
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.setDefaultTimeout(150000);
  await p.goto(url, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { polling: 250 });
  await p.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
  const r = await p.evaluate(() => {
    const s = window.__MONTIS_STUDY__, C = s.CONFIG, J = s.journey;
    const out = { max: J.max, logoEnd: s.logoChapterEnd(), fwdLen: s.forwardLength(), pathLength: s.canyon.stats.pathLength, view: { ...C.canyonView }, motion: { blur: C.canyonMotion.blur, wallBlur: C.canyonMotion.wallBlur, shutter: C.canyonMotion.shutter, maxStreak: C.canyonMotion.maxStreak } };
    out.clock = {}; for (const pp of [4.45, 4.7, 4.736, 4.8, 4.87, 5, 5.6, 7.694, 9.294, 9.794, 10.2, 11.844, 13.074]) { const c = s.journeyClock(pp); out.clock[pp] = [+c.toFixed(4), +(Math.max(0, Math.min(1, (c - 1.404) / 6.596))).toFixed(5)]; }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await Promise.race([b.close(), new Promise(r => setTimeout(r, 8000))]); process.exit(0);
})();
