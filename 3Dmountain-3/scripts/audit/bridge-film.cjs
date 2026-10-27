// Screenshots of index1-1's valley -> cards bridge, one wheel notch at a time (read-only).
//   node bridge-film.cjs <base> <outPrefix> [--w 1440 --h 900] [--gap 450] [--notches 14]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const args = process.argv.slice(2), flag = (k, d) => args.includes('--' + k) ? Number(args[args.indexOf('--' + k) + 1]) : d;
const base = args[0] || 'http://127.0.0.1:5641/', out = args[1] && !args[1].startsWith('--') ? args[1] : 'shots/film';
const W = flag('w', 1440), H = flag('h', 900), GAP = flag('gap', 450), N = flag('notches', 14);
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage(); page.setDefaultTimeout(150000);
  await page.goto(base + 'index1-1.html?tune=0&letters=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 150000, polling: 250 });
  await page.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
  await page.mouse.move(W / 2, H / 2);
  await page.keyboard.press('End');
  await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .01; }, null, { timeout: 90000, polling: 200 });
  await page.waitForFunction(() => window.__MONTIS_STUDY__.portfolio && window.__MONTIS_STUDY__.portfolio.ready, null, { timeout: 90000, polling: 200 }).catch(() => { });
  await page.waitForTimeout(2000);
  const files = [];
  const shot = async label => { const f = `${out}-${String(files.length).padStart(2, '0')}.jpg`; fs.writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 80 })); files.push(f + '=' + label); };
  await shot('end');
  for (let i = 1; i <= N; i++) {
    await page.mouse.wheel(0, 100); await page.waitForTimeout(GAP);
    const tr = await page.evaluate(() => { const p = window.__MONTIS_STUDY__.portfolio; return p ? 'tr' + p.transition.toFixed(2) + '_strip' + p.strip.toFixed(2) : '-'; });
    await shot('n' + i + '_' + tr.replace(/ /g, '_'));
  }
  console.log(files.join(' '));
  await shut(browser); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
