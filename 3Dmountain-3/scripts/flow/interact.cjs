// Copied from the 2026-10-22 build session. Output defaults point at %TEMP%/flowcap; Playwright and Chrome paths are this machine's.
// Interaction check for index1-3-flow.html with the page's own loop running.
const PW = 'C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(PW);
const fs = require('fs');
const path = require('path');
const ROOT = 'G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3';
const OUT = 'C:/Users/qq763/AppData/Local/Temp/flowcap/ix';
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  await ctx.route('http://flow.test/**', route => {
    const f = path.join(ROOT, decodeURIComponent(new URL(route.request().url()).pathname));
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }, body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  const t0 = Date.now();
  await page.goto('http://flow.test/index1-3-flow.html', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__FLOW__, null, { timeout: 60000 });
  await page.evaluate(() => window.__FLOW__.ready);
  const r = { bootMs: Date.now() - t0 };
  await page.waitForTimeout(2200);
  r.afterLoad = await page.evaluate(() => ({ p: window.__FLOW__.p, loaderDone: document.getElementById('loader').classList.contains('is-done'), heroA: getComputedStyle(document.getElementById('ch-knowledge')).getPropertyValue('--a'), bodyClass: document.body.className, scrollH: document.documentElement.scrollHeight }));
  await page.screenshot({ path: OUT + '/ix-0-load.jpg', type: 'jpeg', quality: 80 });
  // Wheel down a few times: p should advance smoothly.
  await page.mouse.move(720, 400);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(120); }
  await page.waitForTimeout(1500);
  r.afterWheel = await page.evaluate(() => ({ p: +window.__FLOW__.p.toFixed(3), pT: +window.__FLOW__.state.pT.toFixed(3), count: document.getElementById('countNow').textContent }));
  // Menu: open, jump to 04 Value (long jump → iris).
  await page.click('#menuBtn');
  await page.waitForTimeout(400);
  r.menuOpen = await page.evaluate(() => ({ open: document.getElementById('menu').open, expanded: document.getElementById('menuBtn').getAttribute('aria-expanded') }));
  await page.screenshot({ path: OUT + '/ix-1-menu.jpg', type: 'jpeg', quality: 80 });
  await page.click('#menu [data-go="3"]');
  await page.waitForTimeout(250);
  r.midJump = await page.evaluate(() => ({ iris: +window.__FLOW__.S.iris.toFixed(2), menuOpen: document.getElementById('menu').open }));
  await page.waitForTimeout(2200);
  r.afterJump = await page.evaluate(() => ({ p: +window.__FLOW__.p.toFixed(3), count: document.getElementById('countNow').textContent, valueOn: document.getElementById('ch-value').classList.contains('on') }));
  await page.screenshot({ path: OUT + '/ix-2-value.jpg', type: 'jpeg', quality: 80 });
  // Note link (short jump → smooth scroll).
  await page.click('#ch-value .note-link');
  await page.waitForTimeout(3500);
  r.afterLink = await page.evaluate(() => ({ p: +window.__FLOW__.p.toFixed(3), count: document.getElementById('countNow').textContent }));
  // Sound toggle.
  await page.click('#sound');
  await page.waitForTimeout(300);
  r.sound = await page.evaluate(() => document.getElementById('sound').getAttribute('aria-pressed'));
  await page.click('#sound');
  r.soundOff = await page.evaluate(() => document.getElementById('sound').getAttribute('aria-pressed'));
  // Escape closes the menu.
  await page.click('#menuBtn'); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  r.escClosed = await page.evaluate(() => !document.getElementById('menu').open);
  // End of the page.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(3000);
  r.end = await page.evaluate(() => ({ p: +window.__FLOW__.p.toFixed(3), lastOn: document.getElementById('ch-derivatives').classList.contains('on') }));
  await page.screenshot({ path: OUT + '/ix-3-end.jpg', type: 'jpeg', quality: 80 });
  r.frames = await page.evaluate(() => window.__FLOW__.renderer.info.render.frame);
  r.logs = logs;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
