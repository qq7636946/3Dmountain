// Real-wheel strip (read-only): park at --from, then real mouse.wheel notches at a steady cadence; a frame logger
// records progress / canyon camera / fov / portfolio.transition every rAF; screenshots every --shot ms; then optional
// reverse. Prints motion stats (camera angular speed, speed jumps, slow frames) and writes a labelled sheet.
//   node wheelstrip.cjs <url> <out> [--from 4.8] [--notches 30] [--interval 200] [--dy 100] [--shot 400] [--w 1440 --h 900]
//                        [--reverse 0|1] [--settle 1500] [--cols 5] [--shots 20] [--js file]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const args = process.argv.slice(2), flag = (k, d) => args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d;
const [url, out] = args;
const FROM = Number(flag('from', 4.8)), NOTCH = Number(flag('notches', 30)), IV = Number(flag('interval', 200)), DY = Number(flag('dy', 100));
const SHOT = Number(flag('shot', 400)), W = Number(flag('w', 1440)), H = Number(flag('h', 900)), REV = flag('reverse', '0') === '1';
const SETTLE = Number(flag('settle', 1500)), COLS = Number(flag('cols', 5)), MAXSHOTS = Number(flag('shots', 20));
const js = flag('js', null) ? fs.readFileSync(flag('js'), 'utf8') : '';
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage(); p.setDefaultTimeout(150000);
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await p.goto(url, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { polling: 250 });
  await p.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
  if (js) console.log('js ->', JSON.stringify(await p.evaluate(js)));
  await p.evaluate(f => { const s = window.__MONTIS_STUDY__; s.journey.target = Math.min(f, s.journey.max); }, FROM);
  await p.waitForFunction(f => { const s = window.__MONTIS_STUDY__; return Math.abs(s.journey.progress - Math.min(f, s.journey.max)) < .005; }, FROM, { polling: 100 });
  await p.waitForTimeout(SETTLE);
  await p.mouse.move(W / 2, H / 2);
  await p.evaluate(() => {
    const s = window.__MONTIS_STUDY__; window.__log = []; window.__lt = [];
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask' }); } catch { }
    const d = new (s.canyon.camera.position.constructor)();
    const tick = t => { const c = s.canyon.camera; c.getWorldDirection(d); const P = s.portfolio; window.__log.push([t, s.journey.progress, s.journey.target, c.position.x, c.position.y, c.position.z, d.x, d.y, d.z, c.fov, P ? (P.transition || 0) : 0, c.up.x, c.up.y, c.up.z]); if (window.__log.length < 20000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick); window.__t0 = performance.now();
  });
  const shots = [], t0 = Date.now();
  let nextShot = 0, notch = 0, nextNotch = 0, phase = 'down';
  const total = NOTCH * IV + 2500, totalRev = REV ? NOTCH * IV + 2500 : 0;
  while (Date.now() - t0 < total + totalRev) {
    const el = Date.now() - t0;
    if (phase === 'down' && el >= total) { phase = 'up'; notch = 0; nextNotch = el; }
    if (notch < NOTCH && el >= nextNotch) { await p.mouse.wheel(0, phase === 'down' ? DY : -DY); notch++; nextNotch += IV; }
    if (MAXSHOTS > 0 && el >= nextShot && shots.length < MAXSHOTS * (REV ? 2 : 1)) {
      const st = await p.evaluate(() => { const s = window.__MONTIS_STUDY__; return { prog: +s.journey.progress.toFixed(3), tr: +((s.portfolio && s.portfolio.transition) || 0).toFixed(3), y: Math.round(s.canyon.camera.position.y) }; });
      const img = await p.screenshot({ type: 'jpeg', quality: 72 });
      shots.push({ t: el, phase, ...st, data: 'data:image/jpeg;base64,' + img.toString('base64') });
      fs.writeFileSync(`${out}-f${String(shots.length).padStart(2, '0')}.jpg`, img);
      nextShot = el + SHOT;
    }
    await p.waitForTimeout(8);
  }
  const { log, lt } = await p.evaluate(() => ({ log: window.__log, lt: window.__lt }));
  // motion stats
  const rate = [], jumps = []; let slow = 0, maxDt = 0;
  for (let i = 2; i < log.length; i++) {
    const a = log[i - 1], c = log[i], dt = (c[0] - a[0]) / 1000; if (dt <= 0) continue; maxDt = Math.max(maxDt, dt * 1000); if (dt > .034) slow++;
    const dot = Math.max(-1, Math.min(1, a[6] * c[6] + a[7] * c[7] + a[8] * c[8])); const ang = Math.acos(dot) * 180 / Math.PI / dt; // deg/s
    const sp = Math.hypot(c[3] - a[3], c[4] - a[4], c[5] - a[5]) / dt; const dp = (c[1] - a[1]) / dt;
    rate.push({ t: c[0], prog: c[1], ang, sp, dp, fov: c[9], roll: Math.atan2(c[11], c[12]) * 180 / Math.PI, tr: c[10], dt: dt * 1000 });
  }
  const pick = k => rate.map(r => r[k]).sort((x, y) => x - y), pct = (a, q) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * q))] : 0;
  const angs = pick('ang'), sps = pick('sp'), dps = pick('dp');
  // speed jumps: frame-to-frame change of angular speed
  for (let i = 1; i < rate.length; i++) jumps.push(Math.abs(rate[i].ang - rate[i - 1].ang));
  jumps.sort((x, y) => x - y);
  const maxAngAt = rate.reduce((m, r) => r.ang > m.ang ? r : m, { ang: -1 });
  const rolls = rate.map(r => r.roll);
  const summary = { frames: log.length, slowFrames: slow, maxFrameMs: Math.round(maxDt), longTasks: lt.slice(0, 12), angDegPerS: { p50: +pct(angs, .5).toFixed(2), p95: +pct(angs, .95).toFixed(2), max: +pct(angs, 1).toFixed(2), maxAtProg: +(maxAngAt.prog || 0).toFixed(3) }, camSpeed: { p50: +pct(sps, .5).toFixed(1), p95: +pct(sps, .95).toFixed(1), max: +pct(sps, 1).toFixed(1) }, progRate: { p50: +pct(dps, .5).toFixed(3), max: +pct(dps, 1).toFixed(3), min: +pct(dps, 0).toFixed(3) }, angJump: { p95: +pct(jumps, .95).toFixed(2), max: +pct(jumps, 1).toFixed(2) }, roll: { min: +Math.min(...rolls).toFixed(2), max: +Math.max(...rolls).toFixed(2) }, progSpan: [+log[0][1].toFixed(3), +Math.max(...log.map(r => r[1])).toFixed(3), +log[log.length - 1][1].toFixed(3)] };
  fs.writeFileSync(out + '-log.json', JSON.stringify({ summary, rate: rate.map(r => [Math.round(r.t), +r.prog.toFixed(3), +r.ang.toFixed(2), +r.sp.toFixed(1), +r.fov.toFixed(2), +r.roll.toFixed(2), +r.tr.toFixed(3), Math.round(r.dt)]) }));
  console.log(JSON.stringify(summary));
  const sheet = !shots.length ? null : await p.evaluate(async ({ shots, cols }) => {
    const ims = await Promise.all(shots.map(s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s.data; })));
    const cw = 400, ch = Math.round(cw * ims[0].naturalHeight / ims[0].naturalWidth), c = document.createElement('canvas'); c.width = cw * cols; c.height = ch * Math.ceil(ims.length / cols);
    const x = c.getContext('2d'); ims.forEach((im, i) => { const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch; x.drawImage(im, cx, cy, cw, ch); const s = shots[i]; const lab = `${(s.t / 1000).toFixed(1)}s ${s.phase === 'up' ? '↑' : '↓'} p${s.prog}${s.tr ? ' tr' + s.tr : ''} y${s.y}`; x.font = '600 12px system-ui'; x.fillStyle = 'rgba(0,0,0,.72)'; x.fillRect(cx + 4, cy + 4, x.measureText(lab).width + 10, 18); x.fillStyle = '#fff'; x.fillText(lab, cx + 9, cy + 17); });
    return c.toDataURL('image/jpeg', .84);
  }, { shots: shots.map(s => ({ ...s })), cols: COLS });
  if (sheet) fs.writeFileSync(out + '-sheet.jpg', Buffer.from(sheet.split(',')[1], 'base64'));
  console.log('sheet', sheet ? out + '-sheet.jpg' : '(none)', 'shots', shots.length, 'errors', JSON.stringify(errs.slice(0, 4)));
  await Promise.race([b.close(), new Promise(r => setTimeout(r, 8000))]); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
