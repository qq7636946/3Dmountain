// Slow-asset race test: the page must open no matter which files arrive late. (Regression test for the import-map/modulepreload ordering bug, 2026-10-10.)
//   node scripts/restructure/verify-race.cjs <url> <delayMs> <runs> <css|js|all>     e.g.  http://127.0.0.1:5502/3Dmountain-3/index.html 1500 2 css
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.argv[2], delay = Number(process.argv[3] ?? 1500), runs = Number(process.argv[4] || 3), what = process.argv[5] || 'css';   // css | js | all
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  for (let i = 1; i <= runs; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
    const errs = [], warns = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) warns.push(m.type() + ': ' + m.text().slice(0, 170)); });
    const hit = p => what === 'css' ? /\/css\/[^/]+\.css$/.test(p) : what === 'js' ? /\/js\/[^/]+\.js$/.test(p) : /\/(css|js)\/[^/]+\.(css|js)$/.test(p);
    const seen = []; if (delay) await page.route(u => hit(u.pathname), async r => { seen.push(new URL(r.request().url()).pathname.split('/').pop()); await new Promise(z => setTimeout(z, delay)); await r.continue(); });
    page.once('close', () => {}); process.on('exit', () => {});
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    let ready = true; try { await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 25000, polling: 250 }); } catch { ready = false; }
    const st = await page.evaluate(() => ({ note: (document.querySelector('.loader-note') || {}).textContent, mode: document.documentElement.dataset.renderMode || '' }));
    console.log(`run ${i} (${what} delayed ${delay} ms; ${delay ? seen.length + ' files held' : 'no delay'}): ready=${ready} loader="${st.note}" mode=${st.mode || '-'}\n   pageErrors=${JSON.stringify(errs)}\n   console=${JSON.stringify([...new Set(warns)])}`);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
