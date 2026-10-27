// Which shader programs are compiled DURING the first pass through the LOGO chapter (i.e. were not warmed), and when.
//   node programs.cjs --base http://127.0.0.1:5611/ --label letters
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const argv = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n !== undefined && !/^--[a-z]/.test(n)) { argv[a.slice(2)] = n; i++; } else argv[a.slice(2)] = true; } }
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await context.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__rawRaf = raw; window.__rafFrozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); }); });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  await page.goto((argv.base || 'http://127.0.0.1:5611/') + 'index.html?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 180000, polling: 250 });
  await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; window.__rafFrozen = true; });
  const out = await page.evaluate(async () => {
    const s = window.__MONTIS_STUDY__, C = s.CONFIG, r = s.renderer, gl = r.getContext(), sink = new Uint8Array(4);
    const P = v => C.logo.at * 2.6 + v * C.logo.length;
    const key = p => p.cacheKey;
    const describe = p => { const k = p.cacheKey; const lights = /,(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),/.exec(k); return { name: p.name, id: p.id, used: p.usedTimes, keyTail: k.slice(-120) }; };
    const seen = new Map(r.info.programs.map(p => [key(p), p]));
    const warmed = r.info.programs.map(p => p.name);
    const fresh = [];
    const N = 660;
    for (let i = 0; i <= N; i++) {
      const t = -.55 + 1.75 * i / N;
      s.journey.progress = s.journey.target = P(t);
      const a = performance.now(); s.step(1, 1 / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sink);
      const ms = performance.now() - a;
      for (const p of r.info.programs) if (!seen.has(key(p))) { seen.set(key(p), p); fresh.push({ t: +t.toFixed(3), ms: +ms.toFixed(1), ...describe(p) }); }
      if (i % 30 === 29) await new Promise(z => setTimeout(z, 0));
    }
    // the same named program twice = a variant that the warm-up compiled under a different key
    const names = {}; for (const p of r.info.programs) (names[p.name] ||= []).push(p.cacheKey);
    const twins = Object.entries(names).filter(([, keys]) => keys.length > 1).map(([name, keys]) => {
      const a = keys[0].split(','), b = keys[1].split(','); const diff = []; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diff.push(i + ':' + String(a[i]).slice(0, 30) + '→' + String(b[i]).slice(0, 30));
      return { name, variants: keys.length, firstDiffs: diff.slice(0, 8) };
    });
    return { warmedCount: warmed.length, fresh, twins };
  });
  console.log(JSON.stringify({ label: argv.label, ...out }, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
