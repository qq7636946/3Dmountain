// index1-1.html with in-memory changes to js/main.js (nothing on disk is touched), captured at journey positions.
//   node variant-shots.cjs <base> <out-prefix> <variants.json> [stops]
// variants.json: { "<name>": [[find, replace, "re"?], ...], ... }   — "re" makes FIND a regular expression
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const [base = 'http://127.0.0.1:5641/', out = 'shots/variant', spec = 'variants.json', stopsArg = '8.95,10.99,12.43,13.8'] = process.argv.slice(2);
const stops = stopsArg.split(',').map(Number), variants = JSON.parse(fs.readFileSync(spec, 'utf8'));
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  for (const [name, patches] of Object.entries(variants)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await context.newPage(); page.setDefaultTimeout(150000);
    const errors = [], missed = [];
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
    await page.route(u => u.pathname.endsWith('/js/main.js'), async route => {
      const resp = await route.fetch(); let body = await resp.text();
      for (const [find, replace, mode] of patches) {
        const before = body;
        body = mode === 're' ? body.replace(new RegExp(find), replace) : body.split(find).join(replace);
        if (body === before) missed.push(find.slice(0, 60));
      }
      await route.fulfill({ response: resp, body });
    });
    const page1 = name.startsWith('bk') ? '_archive/backups/1010_bk/index.html?tune=0' : 'index1-1.html?tune=0&letters=0';
    await page.goto(base + page1, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 150000, polling: 250 });
    await page.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
    await page.waitForTimeout(1500);
    const frames = [];
    for (const stop of stops) {
      const p = await page.evaluate(stop => { const s = window.__MONTIS_STUDY__, extra = Math.max(0, s.journey.max - 13.8); const p = stop > 3 ? stop + extra : stop; s.journey.target = p; return p; }, stop);
      await page.waitForFunction(p => Math.abs(window.__MONTIS_STUDY__.journey.progress - p) < .01, p, { timeout: 60000, polling: 100 }).catch(() => { });
      await page.waitForTimeout(2200);
      const shot = await page.screenshot({ type: 'jpeg', quality: 82 });
      fs.writeFileSync(`${out}-${name}-${stop}.jpg`, shot);
      frames.push(shot.length);
    }
    console.log(name.padEnd(10), 'missed patches:', JSON.stringify(missed), 'errors:', JSON.stringify(errors.slice(0, 2)));
    await shut(context);
  }
  await shut(browser); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
