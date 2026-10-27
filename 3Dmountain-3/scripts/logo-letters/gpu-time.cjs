// GPU time per frame at given LOGO-chapter times (timer queries, real GPU, frozen rAF, deterministic stepping).
//   node gpu-time.cjs --base http://127.0.0.1:5611/ --label new --profile desktop --t "-0.2,0.02,0.3,0.6,0.86,1" [--exp "<js>"] [--frames 90] [--scroll]
// --scroll measures while the chapter is being scrubbed through each t (springs, blur, spray live) instead of at rest.
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const argv = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n !== undefined && !/^--[a-z]/.test(n)) { argv[a.slice(2)] = n; i++; } else argv[a.slice(2)] = true; } }
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  desktop1x: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  desktop4k: { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36' }
};
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-frame-rate-limit', '--disable-gpu-vsync'] });
  const context = await browser.newContext(PROFILES[argv.profile || 'desktop']);
  await context.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__rawRaf = raw; window.__rafFrozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); }); });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.goto((argv.base || 'http://127.0.0.1:5611/') + (argv.page || 'index.html') + '?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 180000, polling: 250 });
  await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; window.__rafFrozen = true; });
  if (argv.exp) await page.evaluate(argv.exp);
  // photographs in, if this build shows any
  await page.evaluate(async () => { const s = window.__MONTIS_STUDY__, C = s.CONFIG; s.journey.progress = s.journey.target = C.logo.at * 2.6 + .3 * C.logo.length; s.step(5, 1 / 60); if (!(s.brandMark.drops.state.delivering)) await s.brandMark.drops.ready; s.step(40, 1 / 60); });
  const rows = [];
  for (const t of String(argv.t || '-0.2,0.02,0.3,0.6,0.86,1').split(',').map(Number)) {
    rows.push(await page.evaluate(async ({ t, frames, scroll }) => {
      const s = window.__MONTIS_STUDY__, C = s.CONFIG, r = s.renderer, gl = r.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const P = v => C.logo.at * 2.6 + v * C.logo.length;
      const span = scroll ? .06 : 0;   // scrubbed: from t-span/2 to t+span/2 across the measured frames
      s.journey.progress = s.journey.target = P(t - span / 2); s.journey.velocity = 0; s.step(60, 1 / 60);
      r.info.autoReset = false; r.info.reset(); s.step(1, 1 / 60);
      const counts = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.autoReset = true;
      const sink = new Uint8Array(4), gpu = [], cpu = [], pending = [];
      const harvest = () => { while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) { const q = pending.shift(); const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT); const v = gl.getQueryParameter(q, gl.QUERY_RESULT); if (!disjoint) gpu.push(v / 1e6); gl.deleteQuery(q); } };
      for (let i = 0; i < frames; i++) {
        if (scroll) s.journey.progress = s.journey.target = P(t - span / 2 + span * (i + 1) / frames);
        const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        const t0 = performance.now(); s.step(1, 1 / 60); cpu.push(performance.now() - t0);
        gl.endQuery(ext.TIME_ELAPSED_EXT); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sink);
        pending.push(q); harvest();
      }
      for (let tries = 0; tries < 300 && pending.length; tries++) { await new Promise(z => window.__rawRaf(z)); harvest(); }
      const med = a => { const x = [...a].sort((p, q) => p - q); return x.length ? x[x.length >> 1] : null; }, p95 = a => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.floor(x.length * .95)] : null; };
      const D = s.brandMark.drops, L = s.brandMark.letters;
      return { t, gpu: +med(gpu).toFixed(2), gpu95: +p95(gpu).toFixed(2), cpu: +med(cpu).toFixed(2), cpu95: +p95(cpu).toFixed(2), n: gpu.length, ...counts,
        drops: D.meshes.filter(m => m.visible).length, letters: L && L.group.visible ? L.letters.filter(l => l.mesh.visible).length : 0, mark: s.brandMark.mesh.visible && s.brandMark.root.visible };
    }, { t, frames: Number(argv.frames || 90), scroll: !!argv.scroll }));
  }
  console.log(JSON.stringify({ label: argv.label || 'run', profile: argv.profile || 'desktop', scroll: !!argv.scroll, canvas: await page.evaluate(() => [window.__MONTIS_STUDY__.renderer.domElement.width, window.__MONTIS_STUDY__.renderer.domElement.height]), rows, errs }));
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
