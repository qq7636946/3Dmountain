// Open every page of _archive/backups/1010_bk in a real (headless, GPU) Chrome and list what it failed to fetch
// from this server, and what it threw. Scrolls a little so lazily loaded parts are asked for too.
//   node load-test.cjs <base e.g. http://127.0.0.1:5621/> [out.json] [--only "a.html,b.html"]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path');
const P = 'G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3', DIR = '_archive/backups/1010_bk';
const base = process.argv[2] || 'http://127.0.0.1:5621/', outFile = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const shut = thing => Promise.race([thing.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
  const pages = fs.readdirSync(path.join(P, DIR)).filter(f => /\.html?$/i.test(f)).sort().filter(f => !only || only.includes(f));
  const results = [];
  for (const name of pages) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    const failed = new Set(), errors = [], external = new Set();
    const local = u => u.startsWith(base);
    const tidy = u => decodeURIComponent(u.slice(base.length)).replace(/\?.*$/, '');
    page.on('response', r => { if (r.status() >= 400) (local(r.url()) ? failed : external).add((local(r.url()) ? tidy(r.url()) : r.url().slice(0, 90)) + ' [' + r.status() + ']'); });
    page.on('requestfailed', r => { const why = r.failure()?.errorText || ''; if (/ABORTED/.test(why)) return; (local(r.url()) ? failed : external).add((local(r.url()) ? tidy(r.url()) : r.url().slice(0, 90)) + ' [' + why + ']'); });
    page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 160)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });
    let opened = true;
    try {
      await page.goto(base + DIR + '/' + encodeURIComponent(name), { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(5000);
      for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(500); }
      await page.waitForTimeout(1500);
    } catch (e) { opened = false; errors.push('open: ' + String(e.message).slice(0, 120)); }
    const canvas = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? c.width + 'x' + c.height : null; }).catch(() => null);
    results.push({ name, opened, canvas, failed: [...failed].sort(), errors: [...new Set(errors)].slice(0, 6), external: [...external].slice(0, 4) });
    console.log(name.padEnd(22), 'failed ' + String(failed.size).padStart(2), '| errors ' + String(new Set(errors).size).padStart(2), failed.size ? '| ' + [...failed].sort().join(', ').slice(0, 260) : '');
    await shut(context);
  }
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
  await shut(browser);
  process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
