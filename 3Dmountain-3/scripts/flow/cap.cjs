// Copied from the 2026-10-22 build session. Output defaults point at %TEMP%/flowcap; Playwright and Chrome paths are this machine's.
// Headless capture of index1-3-flow.html at chosen p stops (served from disk via routing).
// usage: node cap.cjs <outDir> <label> <p1,p2,...> [width] [height] [query] [evalFile]
const PW = 'C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(PW);
const fs = require('fs');
const path = require('path');
const ROOT = 'G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3';
const [outDir, label = 'cap', stopsArg = '0', W = '1440', H = '810', query = '', evalFile = ''] = process.argv.slice(2);
const width = +W, height = +H;
fs.mkdirSync(outDir, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.route('http://flow.test/**', route => {
    const u = new URL(route.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 600)); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  const t0 = Date.now();
  await page.goto('http://flow.test/index1-3-flow.html?fixed=1' + (query ? '&' + query : ''), { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__FLOW__, null, { timeout: 60000 });
  await page.evaluate(() => window.__FLOW__.ready);
  const bootMs = Date.now() - t0;
  await page.evaluate(() => { window.__FLOW__.pause(true); window.__FLOW__.skipIntro(); });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation-play-state:paused!important}' });
  await page.waitForTimeout(300);
  if (evalFile) console.error('eval:', JSON.stringify(await page.evaluate(fs.readFileSync(evalFile, 'utf8'))));
  const stops = stopsArg.split(',').map(Number);
  const files = [];
  for (const p of stops) {
    await page.evaluate(p => { const F = window.__FLOW__; F.seek(p); F.step(3, 1 / 60); }, p);
    await page.waitForTimeout(60);
    await page.evaluate(p => { const F = window.__FLOW__; F.seek(p); F.step(1, 1 / 60); }, p);
    const f = path.join(outDir, `${label}-${p.toFixed(2)}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 86 });
    files.push({ p, f });
  }
  const perf = await page.evaluate(() => {
    const F = window.__FLOW__, gl = F.renderer && F.renderer.getContext();
    if (!gl) return null;
    const px = new Uint8Array(4), out = {};
    for (const p of [0.5, 3.1, 4.5, 6.0, 7.7]) {
      F.seek(p); F.step(2); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t = performance.now(); F.step(10); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      out[p] = +((performance.now() - t) / 10).toFixed(1);
    }
    return { msPerFrame: out, size: [F.renderer.domElement.width, F.renderer.domElement.height] };
  });
  const cols = Math.min(4, files.length), tw = 400, th = Math.round(400 * height / width);
  const imgs = files.map(({ p, f }) => `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>p ${p}</figcaption></figure>`).join('');
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: cols * tw + (cols + 1) * 6, height: Math.ceil(files.length / cols) * (th + 22) + 12 });
  await sheet.setContent(`<html><body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:6px;padding:6px;font:12px monospace;color:#ddd">${imgs}<style>figure{margin:0}img{width:${tw}px;height:${th}px;display:block}figcaption{height:16px}</style></body></html>`);
  await sheet.waitForTimeout(300);
  await sheet.screenshot({ path: path.join(outDir, `${label}-sheet.jpg`), type: 'jpeg', quality: 82, fullPage: true });
  console.log(JSON.stringify({ bootMs, stops, perf, logs: logs.slice(0, 30) }, null, 1));
  await shut(ctx); await shut(browser); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
