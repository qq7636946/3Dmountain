// Contact sheets of the LOGO chapter (real GPU, deterministic stepping).
//
//   node chapter-shots.cjs --base http://127.0.0.1:5611/ --out shots --label base --t "-0.3,-0.1,0,0.2,0.5,0.8,1"
//   node chapter-shots.cjs ... --run "0:1:360" --every 30          (scroll t 0 -> 1 over 360 frames, keep every 30th)
//
// --t       chapter clock values (0 = chapter start, 1 = chapter end; negative = the entrance; >1 = forward transition)
// --run     a:b:frames, a scrubbed scroll at constant speed (springs / blur / spray behave as they would live)
// --profile desktop | desktop1x | phone        --settle frames before a still        --query "tune=0"
// --full    also write every frame as its own full-resolution PNG                    --ui  screenshot the page (DOM UI included)
// --exp     JS evaluated in the page once it is ready (e.g. CONFIG overrides)        --page index.html
// --cols    contact-sheet columns                                                    --cell contact-sheet cell width in px
// --crop    "x,y,w,h" in 0-1 of the frame, applied to the sheet cells and the full PNGs
const { chromium } = require(require('node:path').join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const fs = require('node:fs'), path = require('node:path');
const argv = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]; if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next !== undefined && !/^--[a-z]/.test(next)) { argv[a.slice(2)] = next; i++; } else argv[a.slice(2)] = true;
}
const BASE = argv.base || 'http://127.0.0.1:5611/', PAGE = argv.page || 'index.html', QUERY = argv.query === undefined ? 'tune=0' : argv.query;
const OUT = path.resolve(argv.out || 'shots'), LABEL = argv.label || 'run';
const SETTLE = Number(argv.settle || 50), COLS = Number(argv.cols || 4), CELL = Number(argv.cell || 640);
const CROP = argv.crop ? String(argv.crop).split(',').map(Number) : [0, 0, 1, 1];
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  desktop1x: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  wide: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36' }
};
const PROFILE = PROFILES[argv.profile || 'desktop1x'];
fs.mkdirSync(OUT, { recursive: true });

function installInPage() {
  const raw = window.requestAnimationFrame.bind(window);
  window.__rawRaf = raw; window.__rafFrozen = false;
  window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const context = await browser.newContext({ ...PROFILE, ignoreHTTPSErrors: true, reducedMotion: argv.reduced ? 'reduce' : 'no-preference' });
  await context.addInitScript(installInPage);
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  const log = { errors: [], warnings: [], pageErrors: [], failed: [] };
  page.on('console', m => { const t = m.type(); if (t === 'error') log.errors.push(m.text().slice(0, 400)); else if (t === 'warning') log.warnings.push(m.text().slice(0, 400)); });
  page.on('pageerror', e => log.pageErrors.push(String(e.stack || e).slice(0, 900)));
  page.on('requestfailed', r => log.failed.push(r.url().slice(0, 160) + ' :: ' + (r.failure() && r.failure().errorText)));
  page.on('response', r => { if (r.status() >= 400) log.failed.push(r.status() + ' ' + r.url().slice(0, 160)); });
  await page.route(u => u.pathname.endsWith('/js/main.js'), async route => {
    const resp = await route.fetch(); const body = await resp.text();
    await route.fulfill({ response: resp, body: body.replace('let sceneTime = 0;', 'let sceneTime = 0; window.__setSceneTime = v => { sceneTime = v; };') });
  });
  const t0 = Date.now();
  await page.goto(BASE + PAGE + (QUERY ? '?' + QUERY : ''), { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 180000, polling: 250 });
  const readyMs = Date.now() - t0;
  await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; window.__rafFrozen = true; });
  await page.waitForTimeout(300);
  if (argv.exp) await page.evaluate(argv.exp);
  const info = await page.evaluate(() => { const s = window.__MONTIS_STUDY__, C = s.CONFIG; return { start: C.logo.at * 2.6, length: C.logo.length, end: s.logoChapterEnd(), canvas: [s.renderer.domElement.width, s.renderer.domElement.height], drops: { ...C.logoDrops } }; });

  const frames = [];   // { label, dataUrl }
  const grab = async label => {
    if (argv.ui) {
      await page.evaluate(() => new Promise(r => window.__rawRaf(() => window.__rawRaf(r))));
      const vp = page.viewportSize();
      const buf = await page.screenshot({ type: 'png', clip: { x: vp.width * CROP[0], y: vp.height * CROP[1], width: vp.width * CROP[2], height: vp.height * CROP[3] } });
      frames.push({ label, dataUrl: 'data:image/png;base64,' + buf.toString('base64') });
    } else frames.push({ label, dataUrl: await page.evaluate(CROP => {
      // cropped in the page, in the same task as the draw (the buffer is not preserved), so only the region travels back
      const s = window.__MONTIS_STUDY__; s.step(1, 1 / 60);
      const src = s.renderer.domElement, c = document.createElement('canvas');
      c.width = Math.round(src.width * CROP[2]); c.height = Math.round(src.height * CROP[3]);
      c.getContext('2d').drawImage(src, -Math.round(src.width * CROP[0]), -Math.round(src.height * CROP[1]));
      return c.toDataURL('image/png');
    }, CROP) });
  };
  const setT = (t, velocityFree = true) => page.evaluate(({ t, velocityFree }) => {
    const s = window.__MONTIS_STUDY__, C = s.CONFIG, p = C.logo.at * 2.6 + t * C.logo.length;
    s.journey.progress = s.journey.target = Math.max(0, Math.min(s.journey.max, p)); if (velocityFree) s.journey.velocity = 0;
  }, { t, velocityFree });

  if (argv.run) {
    const [a, b, n] = String(argv.run).split(':').map(Number), every = Number(argv.every || Math.max(1, Math.round(n / 12)));
    await setT(a); await page.evaluate(n => window.__MONTIS_STUDY__.step(n, 1 / 60), SETTLE);
    for (let i = 0; i <= n; i++) {
      const t = a + (b - a) * i / n;
      await setT(t, false);
      if (i % every === 0 || i === n) await grab('t=' + t.toFixed(3));
      else await page.evaluate(() => window.__MONTIS_STUDY__.step(1, 1 / 60));
    }
  } else {
    const list = String(argv.t || '-0.3,-0.15,0,0.15,0.3,0.45,0.6,0.75,0.9,1').split(',').map(Number);
    for (const t of list) {
      await setT(t); await page.evaluate(n => window.__MONTIS_STUDY__.step(n, 1 / 60), SETTLE);
      await grab('t=' + t.toFixed(3));
    }
  }

  // contact sheet, composed in the page (no image library needed)
  const sheet = await page.evaluate(async ({ frames, COLS, CELL, CROP }) => {
    const images = await Promise.all(frames.map(f => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = f.dataUrl; })));
    const sw = images[0].naturalWidth, sh = images[0].naturalHeight;
    const cw = CELL, ch = Math.round(CELL * sh / sw), rows = Math.ceil(images.length / COLS);
    const c = document.createElement('canvas'); c.width = cw * Math.min(COLS, images.length); c.height = ch * rows;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    images.forEach((im, i) => {
      const cx = (i % COLS) * cw, cy = Math.floor(i / COLS) * ch;
      x.drawImage(im, 0, 0, sw, sh, cx, cy, cw, ch);
      x.font = '600 15px system-ui, sans-serif'; x.fillStyle = 'rgba(8,18,40,.78)'; x.fillRect(cx + 6, cy + 6, x.measureText(frames[i].label).width + 12, 22);
      x.fillStyle = '#fff'; x.fillText(frames[i].label, cx + 12, cy + 22);
    });
    return c.toDataURL('image/jpeg', .9);
  }, { frames, COLS, CELL, CROP });
  const sheetPath = path.join(OUT, LABEL + '-sheet.jpg');
  fs.writeFileSync(sheetPath, Buffer.from(sheet.split(',')[1], 'base64'));
  if (argv.full) for (const f of frames) {
    const data = f.dataUrl;
    fs.writeFileSync(path.join(OUT, LABEL + '-' + f.label.replace('=', '') + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log(JSON.stringify({ label: LABEL, readyMs, chapter: { start: info.start, length: info.length }, canvas: info.canvas, frames: frames.length, sheet: sheetPath,
    errors: log.errors.slice(0, 6), pageErrors: log.pageErrors.slice(0, 6), failed: [...new Set(log.failed)].slice(0, 8), warnings: log.warnings.slice(0, 6) }, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
