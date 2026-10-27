const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); page.setDefaultTimeout(150000);
  await page.goto(process.argv[2] + 'index1-1.html?letters=0&grade=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body.classList.contains('is-ready') && document.querySelector('.fi-grade'), null, { timeout: 150000, polling: 250 });
  await page.evaluate(() => { const b = [...document.querySelectorAll('.fi-grade button')].find(x => x.textContent.trim() === '霧'); b && b.click(); });
  await page.waitForTimeout(800);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.fi-grade label, .fi-grade [data-key]')].map(e => e.textContent.trim().slice(0, 12)).filter(Boolean).slice(0, 40));
  const box = await page.evaluate(() => { const r = document.querySelector('.fi-grade').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 900 - r.y) }; });
  fs.writeFileSync(process.argv[3], await page.screenshot({ type: 'jpeg', quality: 85, clip: box }));
  console.log(JSON.stringify(rows));
  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 8000))]); process.exit(0);
})();
