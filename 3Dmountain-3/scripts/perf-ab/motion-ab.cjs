// Motion A/B: while the journey is scrolling, the swap-type post passes (journeyBlend / canyon DOF-motion blur / cursor /
// forward transition) switch on. Static scenes never exercise them, so this walks the same deterministic trajectory on two builds,
// reports which passes were active at each capture, and compares the frames.
//   node scripts/perf-ab/motion-ab.cjs http://127.0.0.1:5200/__base__/ http://127.0.0.1:5200/
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [BASE_A, BASE_B] = [process.argv[2], process.argv[3]];
const PAGE = 'index4-6-3.html';

async function run(base) {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__rawRaf = raw; window.__rafFrozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); }); });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  await page.route(u => u.pathname.endsWith('/' + PAGE), async route => {
    const resp = await route.fetch(); let body = await resp.text();
    body = body.replace('let sceneTime = 0;', 'let sceneTime = 0; window.__setSceneTime = v => { sceneTime = v; };');
    body = body.replace('window.__MONTIS_STUDY__ = { canyonMotion,', 'window.__MONTIS_STUDY__ = { composer, canyonMotion,');
    await route.fulfill({ response: resp, body });
  });
  await page.goto(base + PAGE + '?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 240000, polling: 250 });
  await page.evaluate(() => { window.__rafFrozen = true; });
  const res = await page.evaluate(() => {
    const s = window.__MONTIS_STUDY__, C = s.CONFIG, out = {};
    const shift = Math.max(0, s.logoChapterEnd() - C.disperse.handoff * 2.6) + s.forwardLength() - .572;
    const plans = {
      'move-canyon': { from: 4.6 + shift, to: 5.8 + shift, caps: [5, 10, 16, 24] },
      'move-forward': { from: s.logoChapterEnd() - .25, to: s.logoChapterEnd() + s.forwardLength() + .1, caps: [6, 12, 18, 26, 34] },
      'move-rivers': { from: 10.98 + shift, to: 11.98 + shift, caps: [5, 10, 16, 24] }
    };
    for (const [kind, plan] of Object.entries(plans)) {
      s.journey.progress = s.journey.target = plan.from; if (window.__setSceneTime) window.__setSceneTime(1000); s.step(150, 1 / 60);
      s.journey.target = plan.to; out[kind] = [];
      for (let f = 1; f <= Math.max(...plan.caps); f++) {
        s.step(1, 1 / 60);
        if (!plan.caps.includes(f)) continue;
        const c = s.renderer.domElement; let src = c;
        while (src.width / 2 >= 192) { const t = document.createElement('canvas'); t.width = src.width >> 1; t.height = src.height >> 1; const x = t.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, t.width, t.height); src = t; }
        const sm = document.createElement('canvas'); sm.width = 192; sm.height = Math.round(192 * c.height / c.width);
        const cx = sm.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingQuality = 'high'; cx.drawImage(src, 0, 0, sm.width, sm.height);
        const px = cx.getImageData(0, 0, sm.width, sm.height).data; let bin = ''; for (let i = 0; i < px.length; i += 4096) bin += String.fromCharCode.apply(null, px.subarray(i, Math.min(px.length, i + 4096)));
        out[kind].push({ frame: f, progress: +s.journey.progress.toFixed(3), on: s.composer.passes.map((p, i) => (p.enabled && i >= 1 && i <= 4) ? i : '').join(''), b64: btoa(bin) });
      }
    }
    return out;
  });
  await browser.close();
  return res;
}
(async () => {
  const A = await run(BASE_A), B = await run(BASE_B);
  for (const kind of Object.keys(A)) for (let i = 0; i < A[kind].length; i++) {
    const a = A[kind][i], b = B[kind][i]; const PA = Buffer.from(a.b64, 'base64'), PB = Buffer.from(b.b64, 'base64');
    let sum = 0, max = 0, se = 0; for (let k = 0; k < PA.length; k += 4) for (let c = 0; c < 3; c++) { const d = Math.abs(PA[k + c] - PB[k + c]); sum += d; se += d * d; if (d > max) max = d; }
    const n = PA.length / 4 * 3, mse = se / n;
    console.log(`${kind.padEnd(13)} f${String(a.frame).padStart(2)}  progress ${a.progress} vs ${b.progress}  swap-passes-on: base[${a.on || '-'}] opt[${b.on || '-'}]  meanAbsDiff=${(sum / n).toFixed(3)} max=${max} PSNR=${mse === 0 ? 'inf' : (10 * Math.log10(65025 / mse)).toFixed(1)}dB`);
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
