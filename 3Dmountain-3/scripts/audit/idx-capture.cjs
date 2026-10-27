// index.html must be unchanged: the same journey positions on the project as it is (A) and on the staged build (B), pixel diff.
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [a, outFile, pageName = "index.html"] = process.argv.slice(2); const b = null;
const stops = [2.5, 9.79, 13.88, 16.69];
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const shots = {};
  for (const base of [a]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); page.setDefaultTimeout(150000);
    await ctx.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__frozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__frozen) cb(t); }); });
    await page.goto(base + pageName + '?tune=0&letters=0', { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 150000, polling: 250 });
    await page.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
    await page.evaluate(() => { window.__frozen = true; });
    shots[base] = [];
    for (const p of stops) {
      shots[base].push(await page.evaluate(async p => { const s = window.__MONTIS_STUDY__; s.journey.progress = s.journey.target = Math.min(p, s.journey.max); s.journey.velocity = 0; s.step(90, 1 / 60);
        const c = document.createElement('canvas'); c.width = 320; c.height = 200; const src = s.renderer.domElement; s.step(1, 1 / 60); c.getContext('2d').drawImage(src, 0, 0, 320, 200);
        return Array.from(c.getContext('2d').getImageData(0, 0, 320, 200).data); }, p));
    }
    await shut(ctx);
  }
  require("fs").writeFileSync(outFile, JSON.stringify(shots[a])); console.log("saved", outFile);

  await shut(browser); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
