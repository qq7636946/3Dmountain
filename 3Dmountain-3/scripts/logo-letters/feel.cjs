// How does the LOGO chapter FEEL under a real mouse wheel? Plays the page's own loop in real time, turns the wheel one
// notch at a time (as a notched mouse does), and measures what the eye judges smoothness by:
//   - the swirl: how evenly it turns while the wheel is being turned steadily (speed spread, share of time at a standstill)
//   - each letter: how long its break and its flight take in real time, and whether it is ever left hanging in mid-flight
// Optionally writes a filmstrip.
//   node feel.cjs [--base http://127.0.0.1:5611/] [--notch 250] [--out shots/feel.jpg] [--exp "<js>"] [--label x]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const argv = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n !== undefined && !/^--[a-z]/.test(n)) { argv[a.slice(2)] = n; i++; } else argv[a.slice(2)] = true; } }
const BASE = argv.base || 'http://127.0.0.1:5611/', NOTCH = Number(argv.notch || 250), PAGE = argv.page || 'index.html?tune=0';
if (argv.out) fs.mkdirSync(require('node:path').dirname(require('node:path').resolve(argv.out)), { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage(); page.setDefaultTimeout(120000);
  const log = []; page.on('pageerror', e => log.push('pageerror: ' + String(e.stack || e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push(m.type() + ': ' + m.text().slice(0, 240)); });
  await page.goto(BASE + PAGE, { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 120000, polling: 250 });
  await page.evaluate(() => window.__MONTIS_STUDY__.ready);
  if (argv.exp) await page.evaluate(argv.exp);
  // to just before the chapter, at rest; then start sampling every frame
  await page.evaluate(() => {
    const s = window.__MONTIS_STUDY__, C = s.CONFIG, B = s.brandMark, D = B.drops, L = B.letters;
    s.skipEntry?.(); s.journey.velocity = 0; s.journey.progress = s.journey.target = C.logo.at * 2.6 - .06 * C.logo.length;
    const rows = []; window.__feel = { rows, on: true };
    const start = performance.now();
    const tick = now => {
      if (!window.__feel.on) return;
      const t = (s.journey.progress - C.logo.at * 2.6) / C.logo.length;
      // one plain drop that is in view through most of the chapter: follow whichever plain drops are visible
      const plain = D.group.visible ? D.meshes.filter(m => m.visible && m.userData.plain !== undefined).map(m => [m.userData.plain, Math.atan2(m.position.x, m.position.z)]) : [];
      const del = D.state.delivery ? D.state.delivery.slice(0, L.letters.length).map(d => [d.stage, +d.snap.toFixed(4)]) : [];
      const breaking = D.group.visible ? D.meshes.filter(m => m.visible && m.userData.plain === undefined && m.material.uniforms.uBurst && m.material.uniforms.uBurst.value > .001).map(m => [m.userData.slot, +m.material.uniforms.uBurst.value.toFixed(4)]) : [];
      rows.push({ ms: now - start, t, plain, del, breaking });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(720, 450);
  await page.waitForTimeout(600);
  const shots = [];
  const total = Math.ceil(1.12 * 1.8 / (100 / Math.max(720, 900 * .85)));   // notches to cross the chapter and a little more
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await page.mouse.wheel(0, 100);
    if (argv.out && i % 1 === 0) shots.push(await page.screenshot({ type: 'jpeg', quality: 70 }));
    const due = t0 + (i + 1) * NOTCH; const wait = due - Date.now(); if (wait > 0) await page.waitForTimeout(wait);
  }
  await page.waitForTimeout(2500);
  const rows = await page.evaluate(() => { window.__feel.on = false; return window.__feel.rows; });
  // ---- the swirl's evenness: angular speed of every plain drop, frame to frame, while the wheel is turning ----
  const during = rows.filter(r => r.ms > 600 && r.ms < 600 + total * NOTCH && r.t > .02 && r.t < .8);
  const speeds = [];
  for (let i = 1; i < during.length; i++) {
    const a = new Map(during[i - 1].plain), dt = (during[i].ms - during[i - 1].ms) / 1000; if (!(dt > 0)) continue;
    const turns = []; for (const [id, ang] of during[i].plain) { if (!a.has(id)) continue; let d = a.get(id) - ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; turns.push(d / dt); }
    if (turns.length) speeds.push(turns.sort((p, q) => p - q)[turns.length >> 1]);
  }
  const mean = speeds.reduce((p, q) => p + q, 0) / Math.max(1, speeds.length), sd = Math.sqrt(speeds.reduce((p, q) => p + (q - mean) ** 2, 0) / Math.max(1, speeds.length));
  const still = speeds.filter(v => Math.abs(v) < mean * .15).length / Math.max(1, speeds.length), peak = [...speeds].sort((p, q) => q - p)[Math.floor(speeds.length * .02)] || 0;
  // ---- each letter: real-time length of its break and of its flight; time spent hanging in mid-flight ----
  const n = rows.length ? Math.max(...rows.map(r => r.del.length)) : 0, flights = [], breaks = new Map();
  for (let k = 0; k < n; k++) {
    let begin = null, end = null, hang = 0, lastSnap = null, lastMove = null;
    for (const r of rows) {
      const d = r.del[k]; if (!d) continue; const snap = d[1];
      if (begin === null && snap > .02) begin = r.ms;
      if (begin !== null && end === null) {
        if (snap >= .98) end = r.ms;
        if (lastSnap !== null && Math.abs(snap - lastSnap) > 1e-4) lastMove = r.ms;
        else if (lastMove !== null && snap > .05 && snap < .95 && r.ms - lastMove > 120) hang = Math.max(hang, r.ms - lastMove);
        lastSnap = snap; if (lastMove === null) lastMove = r.ms;
      }
    }
    flights.push({ k, flightMs: begin !== null && end !== null ? Math.round(end - begin) : null, hangMs: Math.round(hang) });
  }
  for (const r of rows) for (const [slot, b] of r.breaking) { const e = breaks.get(slot) || { from: r.ms, to: r.ms }; e.to = r.ms; breaks.set(slot, e); }
  const breakMs = [...breaks.values()].map(e => Math.round(e.to - e.from));
  const gaps = rows.slice(1).map((r, i) => r.ms - rows[i].ms).sort((p, q) => p - q);
  const out = { label: argv.label || '', notchMs: NOTCH, notches: total, frames: rows.length, frameMs: { median: +gaps[gaps.length >> 1].toFixed(1), p99: +gaps[Math.floor(gaps.length * .99)].toFixed(1), max: +gaps[gaps.length - 1].toFixed(1) },
    swirl: { meanRadPerSec: +mean.toFixed(3), spread: +(sd / Math.max(1e-6, mean)).toFixed(3), peakOverMean: +(peak / Math.max(1e-6, mean)).toFixed(2), shareAtStandstill: +still.toFixed(3) },
    flightMs: flights.map(f => f.flightMs), hangMs: flights.map(f => f.hangMs), breakMs, console: log.slice(0, 5) };
  console.log(JSON.stringify(out));
  if (argv.out) {
    const sheet = await page.evaluate(async frames => {
      const images = await Promise.all(frames.map(b => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/jpeg;base64,' + b; })));
      const cols = 5, cw = 576, ch = Math.round(cw * images[0].naturalHeight / images[0].naturalWidth), rowsN = Math.ceil(images.length / cols);
      const c = document.createElement('canvas'); c.width = cw * cols; c.height = ch * rowsN; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      images.forEach((im, i) => { x.drawImage(im, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch); x.font = '600 14px system-ui'; x.fillStyle = 'rgba(8,18,40,.8)'; x.fillRect((i % cols) * cw + 6, Math.floor(i / cols) * ch + 6, 74, 22); x.fillStyle = '#fff'; x.fillText('notch ' + (i + 1), (i % cols) * cw + 12, Math.floor(i / cols) * ch + 22); });
      return c.toDataURL('image/jpeg', .85).split(',')[1];
    }, shots.map(b => b.toString('base64')));
    fs.writeFileSync(argv.out, Buffer.from(sheet, 'base64'));
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
