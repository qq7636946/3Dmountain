// How much the canyon camera moves per unit of scroll through the valley chapters (read-only, deterministic stepping).
//   node valley-camera.cjs <base> [from=6.5] [to=13.8] [step=.05]     (positions are base stops, shifted like the page)
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [base = 'http://127.0.0.1:5661/', fromA = '6.5', toA = '13.8', stepA = '.05'] = process.argv.slice(2);
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__frozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__frozen) cb(t); }); });
  const page = await context.newPage(); page.setDefaultTimeout(150000);
  await page.goto(base + 'index1-1.html?tune=0&letters=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 150000, polling: 250 });
  await page.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
  await page.evaluate(() => { window.__frozen = true; });
  const rows = await page.evaluate(({ from, to, step }) => {
    const s = window.__MONTIS_STUDY__, extra = Math.max(0, s.journey.max - 13.8), cam = s.canyon.camera, out = [];
    const dir = new s.canyon.camera.position.constructor();
    let prev = null;
    for (let b = from; b <= to + 1e-6; b += step) {
      const p = b + extra; s.journey.progress = s.journey.target = p; s.journey.velocity = 0; s.step(2, 1 / 60);
      cam.getWorldDirection(dir);
      const now = { b: +b.toFixed(2), x: cam.position.x, y: cam.position.y, z: cam.position.z, dx: dir.x, dy: dir.y, dz: dir.z, copy: document.querySelector('.fi-copy-panel.is-active h1, .fi-copy-panel.is-active h2')?.textContent.trim().slice(0, 26) };
      if (prev) { now.move = Math.hypot(now.x - prev.x, now.y - prev.y, now.z - prev.z); now.turn = Math.acos(Math.min(1, now.dx * prev.dx + now.dy * prev.dy + now.dz * prev.dz)) * 180 / Math.PI; }
      out.push(now); prev = now;
    }
    return out;
  }, { from: Number(fromA), to: Number(toA), step: Number(stepA) });
  for (const r of rows) console.log(String(r.b).padEnd(6), 'move', (r.move ?? 0).toFixed(1).padStart(7), 'turn', (r.turn ?? 0).toFixed(2).padStart(6), ' y', r.y.toFixed(0).padStart(6), ' ', r.copy || '');
  await shut(context); await shut(browser); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
