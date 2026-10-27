// Read-only measurement of index1-1's valley -> cards bridge under a real mouse wheel, in real time.
// Records every frame (interval, the bridge's clock, the camera's speed), long tasks, and what was fetched while it ran.
//   node bridge-measure.cjs <base> <out.json> [--phone] [--notch 160] [--notches 14]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const args = process.argv.slice(2), flag = (k, d) => args.includes('--' + k) ? (args[args.indexOf('--' + k) + 1] ?? d) : d;
const base = args[0] || 'http://127.0.0.1:5641/', out = args[1] && !args[1].startsWith('--') ? args[1] : 'bridge.json';
const phone = args.includes('--phone'), NOTCH = Number(flag('notch', 160)), NOTCHES = Number(flag('notches', 14));
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const W = Number(flag('w', 1440)), H = Number(flag('h', 900)), DPR = Number(flag('dpr', 1)), CPU = Number(flag('cpu', 1));
  const context = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const page = await context.newPage(); page.setDefaultTimeout(150000);
  if (CPU > 1) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
  const errors = [], fetched = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 160)); });
  page.on('request', r => fetched.push({ at: Date.now(), url: r.url().replace(/\?.*$/, '').split('/').slice(-2).join('/') }));
  await page.goto(base + 'index1-1.html?tune=0&letters=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 150000, polling: 250 });
  await page.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
  await page.mouse.move(phone ? 195 : 720, phone ? 420 : 450);
  await page.keyboard.press('End');
  await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .01; }, null, { timeout: 90000, polling: 200 });
  await page.waitForFunction(() => window.__MONTIS_STUDY__.portfolio && window.__MONTIS_STUDY__.portfolio.ready, null, { timeout: 90000, polling: 200 }).catch(() => { });
  await page.waitForTimeout(Number(flag('rest', 2500)));
  // the recorder: every animation frame, and every long task
  await page.evaluate(() => {
    const s = window.__MONTIS_STUDY__, rec = window.__rec = { frames: [], long: [], marks: [] };
    const cam = s.camera; let last = performance.now(), lastPos = cam ? cam.position.clone() : null;
    const loop = now => {
      const p = s.portfolio, pos = cam ? cam.position : null;
      const moved = pos && lastPos ? pos.distanceTo(lastPos) : 0; if (pos) lastPos.copy(pos);
      rec.frames.push([+(now - last).toFixed(2), +now.toFixed(1), p ? +p.transition.toFixed(4) : -1, p ? +p.strip.toFixed(4) : -1, +moved.toFixed(3), p?.covering ? 1 : 0]);
      last = now; if (!window.__stopRec) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    try { new PerformanceObserver(list => { for (const e of list.getEntries()) rec.long.push([+e.startTime.toFixed(1), +e.duration.toFixed(1), (e.attribution || []).map(a => a.containerSrc || a.name).join('|')]); }).observe({ type: 'longtask', buffered: false }); } catch { }
    rec.res = []; try { new PerformanceObserver(list => { for (const e of list.getEntries()) rec.res.push([+e.startTime.toFixed(0), +e.duration.toFixed(0), e.name.split("?")[0].split('/').slice(-2).join('/')]); }).observe({ type: 'resource', buffered: false }); } catch { }
    rec.measures = []; try { new PerformanceObserver(list => { for (const e of list.getEntries()) rec.measures.push([+e.startTime.toFixed(0), +e.duration.toFixed(1), e.name]); }).observe({ type: 'measure', buffered: false }); } catch { }
  });
  await page.waitForTimeout(Number(flag('pre', 1500)));
  const mark = label => page.evaluate(label => window.__rec.marks.push([label, +performance.now().toFixed(1)]), label);
  await mark('wheel');
  for (let i = 0; i < NOTCHES; i++) {
    if (phone) { await page.evaluate(() => { }); }
    await page.mouse.wheel(0, 100); await page.waitForTimeout(NOTCH);
  }
  await mark('rest');
  await page.waitForTimeout(6000);
  await page.evaluate(() => { window.__stopRec = true; });
  const rec = await page.evaluate(() => window.__rec);
  const state = await page.evaluate(() => { const p = window.__MONTIS_STUDY__.portfolio; return { open: p?.open, transition: p?.transition, strip: p?.strip, covering: p?.covering }; });
  fs.writeFileSync(out, JSON.stringify({ rec, state, errors, fetched }, null, 0));
  console.log('RES', JSON.stringify(rec.res.map(r => [Math.round(r[0] - rec.marks[0][1]), r[1], r[2]])));
  console.log('LONG', JSON.stringify(rec.long.map(l => [Math.round(l[0] - rec.marks[0][1]), l[1], l[2]])));
  console.log('MEASURES', JSON.stringify((rec.measures||[]).map(m => [Math.round(m[0] - rec.marks[0][1]), m[1], m[2]])));
  console.log('BIGFRAMES', JSON.stringify(rec.frames.filter(f => f[0] > 20).map(f => [Math.round(f[1] - rec.marks[0][1]), f[0], f[2], f[3]])));
  // summary
  const t0 = rec.marks[0][1], t1 = rec.marks[1][1];
  const phase = (from, to) => rec.frames.filter(f => f[1] >= from && f[1] < to).map(f => f[0]);
  const stats = list => { const s = [...list].sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { n: s.length, median: q(.5), p95: q(.95), max: s[s.length - 1], over20: s.filter(v => v > 20).length, over33: s.filter(v => v > 33.4).length }; };
  const bridgeFrames = rec.frames.filter(f => f[1] >= t0 && f[2] > 0 && f[2] < 1);
  const firstOpen = rec.frames.find(f => f[2] > 0), done = rec.frames.find(f => f[2] >= .999);
  // stop-go: how often the bridge clock stands still (or the camera does) while the wheel is still being turned
  const turning = rec.frames.filter(f => f[1] >= t0 && f[1] < t1);
  let still = 0; for (let i = 1; i < turning.length; i++) if (turning[i][2] < .999 && Math.abs(turning[i][2] - turning[i - 1][2]) < 1e-4) still++;
  const speeds = bridgeFrames.map((f, i, a) => i ? Math.abs(f[2] - a[i - 1][2]) / Math.max(1, f[0]) * 1000 : null).filter(v => v !== null);
  const meanSpeed = speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length), spread = Math.sqrt(speeds.reduce((a, b) => a + (b - meanSpeed) ** 2, 0) / Math.max(1, speeds.length)) / Math.max(1e-6, meanSpeed);
  console.log(JSON.stringify({
    phone, W, H, DPR, CPU, notchMs: NOTCH, notches: NOTCHES,
    idleAtEnd: stats(phase(t0 - Number(flag('pre', 1500)), t0)), whileWheeling: stats(phase(t0, t1)), afterWheel: stats(phase(t1, t1 + 3000)), duringBridge: stats(bridgeFrames.map(f => f[0])),
    bridge: { startsAfterMs: firstOpen ? +(firstOpen[1] - t0).toFixed(0) : null, fullAfterMs: done ? +(done[1] - t0).toFixed(0) : null, framesStill: still + '/' + turning.length, speedSpread: +spread.toFixed(2) },
    longTasks: rec.long.filter(l => l[0] >= t0 - Number(flag('pre', 1500))).map(l => [+(l[0] - t0).toFixed(0), l[1]]),
    fetchedDuring: [...new Set(fetched.filter(f => f.at > 0).map(f => f.url))].filter(u => /portfolio|ogl|pexels|world|images\//.test(u)).slice(0, 12),
    end: state, errors: errors.slice(0, 4)
  }, null, 1));
  await shut(context); await shut(browser); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
