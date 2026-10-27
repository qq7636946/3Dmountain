// First-pass hitches: on a cold page, scrub once from the very first scroll through the LOGO chapter and report the
// slowest frames (CPU submit + GPU drain, measured with a readPixels sync), plus what was uploaded/compiled on the way.
// A program compiled on the way (programs after > before) is a warm-up that missed: see programs.cjs for which.
//   node hitch.cjs --base http://127.0.0.1:5611/ --label letters [--profile desktop|phone] [--exp "<js>"]
//                  [--from -1.083] [--to 1.2] [--frames 880]      (chapter clock: 0 = chapter start, 1 = its end; -1.083 = top of the page)
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const argv = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n !== undefined && !/^--[a-z]/.test(n)) { argv[a.slice(2)] = n; i++; } else argv[a.slice(2)] = true; } }
const PROFILES = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } };
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-frame-rate-limit', '--disable-gpu-vsync'] });
  const context = await browser.newContext(PROFILES[argv.profile || 'desktop']);
  await context.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__rawRaf = raw; window.__rafFrozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); }); });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  const t0 = Date.now();
  await page.goto((argv.base || 'http://127.0.0.1:5611/') + 'index.html?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 180000, polling: 250 });
  const heroMs = Date.now() - t0;
  await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; window.__rafFrozen = true; });
  const chapterMs = Date.now() - t0;
  if (argv.exp) await page.evaluate(argv.exp);
  const out = await page.evaluate(async ({ from, to, N }) => {
    const s = window.__MONTIS_STUDY__, C = s.CONFIG, r = s.renderer, gl = r.getContext(), sink = new Uint8Array(4);
    const P = v => C.logo.at * 2.6 + v * C.logo.length;
    const before = { programs: r.info.programs.length, textures: r.info.memory.textures, geometries: r.info.memory.geometries };
    const rows = [];
    for (let i = 0; i <= N; i++) {
      const t = from + (to - from) * i / N;
      s.journey.progress = s.journey.target = P(t);
      const a = performance.now(); s.step(1, 1 / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sink);
      rows.push([+(performance.now() - a).toFixed(2), +t.toFixed(3), r.info.programs.length, r.info.memory.textures]);
      if (i % 30 === 29) await new Promise(z => setTimeout(z, 0));   // let image decodes / async work land as they would live
    }
    const ms = rows.map(x => x[0]).sort((p, q) => p - q);
    const worst = [...rows].sort((p, q) => q[0] - p[0]).slice(0, 6).map(x => ({ ms: x[0], t: x[1] }));
    return { before, after: { programs: r.info.programs.length, textures: r.info.memory.textures, geometries: r.info.memory.geometries },
      median: ms[ms.length >> 1], p95: ms[Math.floor(ms.length * .95)], p99: ms[Math.floor(ms.length * .99)], max: ms[ms.length - 1], over8: ms.filter(v => v > 8).length, over16: ms.filter(v => v > 16.7).length, worst };
  }, { from: Number(argv.from ?? -1.083), to: Number(argv.to ?? 1.2), N: Number(argv.frames ?? 880) });
  console.log(JSON.stringify({ label: argv.label || 'run', profile: argv.profile || 'desktop', heroMs, chapterMs, ...out, errs }));
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
