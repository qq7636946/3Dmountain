// Card strip → Earth handoff (index1-1): how long the wheel stops at the last card before the planet moves.
//   node scripts/world/handoff-measure.cjs [--throttle=4] [--phone] [--pause] [--gap=60]
//   --gap: ms between wheel notches (60 = a quick scroll, 120 = a steady one)
//   --pause: rest 1.5 s once the journey is near its end; the world prepares in that rest.
// Needs the dev server from .claude/launch.json ("montis", port 5178) or BASE=…
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
let chromium; try { ({ chromium } = require(PW)); } catch { ({ chromium } = require('playwright')); }
const BASE = process.env.BASE || 'http://localhost:5178/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const arg = name => process.argv.includes(name);
const num = (flag, fallback) => +((process.argv.find(a => a.startsWith(flag + '=')) || '').slice(flag.length + 1) || fallback);
const throttle = num('--throttle', 0), gap = num('--gap', 60);
const netName = (process.argv.find(a => a.startsWith('--net=')) || '').slice(6);
const NETS = { '4g': { latency: 80, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 }, fast3g: { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: .75e6 / 8 } };
const view = arg('--phone') ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

// Runs in the page: one record per frame [now, dt, transition, strip, worldMounted, worldOpen, worldY],
// the wheel times, long tasks, and the moment the world's own `ready` promise resolves.
const probe = () => {
  window.__rec = []; window.__wheel = []; window.__lt = []; window.__stopRec = false; window.__worldReadyAt = null;
  addEventListener('wheel', () => window.__wheel.push(performance.now()), { capture: true, passive: true });
  try { new PerformanceObserver(list => list.getEntries().forEach(e => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch { }
  let hooked = null, last = performance.now();
  const loop = now => {
    const s = window.__MONTIS_STUDY__ || {}, p = s.portfolio, w = s.world;
    if (w && w !== hooked) { hooked = w; Promise.resolve(w.ready).then(() => { window.__worldReadyAt = performance.now(); }, () => { }); }
    window.__rec.push([Math.round(now), +(now - last).toFixed(1), p ? p.transition : -1, p ? p.strip : -1, w ? 1 : 0, w && w.open ? 1 : 0, w ? w.state.y : -1]);
    last = now;
    if (!window.__stopRec) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await browser.newContext(view);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    if (throttle) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
    await page.goto(BASE + (process.env.PAGE || 'index1-1') + '?tune=0&letters=0');
    await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 120000 });
    await page.mouse.move(view.viewport.width / 2, view.viewport.height / 2);
    // --net=4g | fast3g: the network the cards' pictures, the planet's files and the CDN modules arrive over (after the journey has loaded).
    if (netName) { const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETS[netName] }); }
    await page.evaluate(probe);

    // A steady wheel: one notch (120 px) every `gap` ms. Stop 1.2 s after the planet starts to move.
    let paused = false, moved = false, sent = 0;
    const started = Date.now();
    while (Date.now() - started < 150000) {
      await page.mouse.wheel(0, 120); sent++;
      await page.waitForTimeout(gap);
      if (arg('--pause') && !paused && await page.evaluate(() => { const j = window.__MONTIS_STUDY__.journey; return j.progress > j.max - .9; })) { paused = true; await page.waitForTimeout(1500); }
      if (!moved) moved = await page.evaluate(() => { const w = window.__MONTIS_STUDY__.world; return !!w && w.state.y > 2; });
      if (moved) {
        // --wait-ready: stay until the planet's own ready promise resolves (up to 20 s), so its textures' arrival can be read.
        if (arg('--wait-ready')) { for (let k = 0; k < 40; k++) { await page.waitForTimeout(500); if (await page.evaluate(() => !!window.__worldReadyAt)) break; } }
        else await page.waitForTimeout(1200);
        break;
      }
    }
    const data = await page.evaluate(() => {
      window.__stopRec = true;
      const re = /finnovation-world|world\.css|finnovation-grade|portfolio-epilogue|portfolio-slider|earth-|clouds-|ocean-|gsap|ogl|pexels/i;
      return {
        rec: window.__rec, wheel: window.__wheel, lt: window.__lt, readyAt: window.__worldReadyAt,
        measures: performance.getEntriesByType('measure').filter(m => m.name.startsWith('world')).map(m => [m.name.slice(6), Math.round(m.startTime), Math.round(m.duration)]),
        resources: performance.getEntriesByType('resource').filter(r => re.test(r.name)).map(r => [r.name.split('/').pop().split('?')[0].slice(0, 40), Math.round(r.startTime), Math.round(r.responseEnd), r.transferSize]),
        mode: window.__MONTIS_STUDY__.world ? 'world' : 'no-world'
      };
    });

    // [now, dt, transition, strip, mounted, open, y]. The stall is measured from the moment the strip stops at its last card.
    const rec = data.rec;
    const atEnd = rec.find(r => r[3] >= .999);
    if (!atEnd) { console.log(JSON.stringify({ error: 'strip never reached its last card', notchesSent: sent, errors }, null, 1)); return; }
    const t0 = atEnd[0];
    const rel = t => Math.round(t - t0);
    const settled = rec.find(r => r[0] >= t0 && r[2] >= .999);
    const bridgeStart = rec.find(r => r[2] > 0);
    const mounted = rec.find(r => r[4] === 1), opened = rec.find(r => r[5] === 1);
    const movedAt = rec.find(r => r[0] >= t0 && r[6] > 2);
    const tEnd = movedAt ? movedAt[0] : Infinity;
    const steps = data.measures.filter(([, start]) => start >= t0 - 3000 && start <= tEnd + 1000).map(([name, start, dur]) => `${name} @${rel(start)} +${dur}`);
    // What changed, frame by frame, from just before the stop to just after the planet moves (changes only).
    const timeline = []; let prev = '';
    for (const r of rec) {
      if (r[0] < t0 - 300 || r[0] > Math.min(tEnd, t0 + 4000) + 300) continue;
      const row = [rel(r[0]), +r[2].toFixed(3), +r[3].toFixed(3), r[4], r[5], Math.round(r[6])];
      const key = row.slice(1).join('|');
      if (key !== prev) { timeline.push(row); prev = key; }
    }
    const out = {
      view: arg('--phone') ? 'phone 390x844' : 'desktop 1440x900', throttle, net: netName || 'none', gap, pause: arg('--pause'), notchesSent: sent, mode: data.mode,
      bridgeStartMs: bridgeStart ? rel(bridgeStart[0]) : null,
      lastCardMs: 0,
      bridgeSettledMs: settled ? rel(settled[0]) : null,
      worldMountedMs: mounted ? rel(mounted[0]) : null,
      worldOpenMs: opened ? rel(opened[0]) : null,
      worldReadyMs: data.readyAt ? rel(data.readyAt) : null,
      worldMovesMs: movedAt ? rel(movedAt[0]) : null,
      stuckMs: movedAt ? rel(movedAt[0]) : null,
      notchesSwallowed: data.wheel.filter(t => t >= t0 && t < tEnd).length,
      longestFrameMs: Math.round(Math.max(...rec.filter(r => r[0] >= t0 && r[0] <= tEnd).map(r => r[1]), 0)),
      // the bridge itself (from its start to the last card): frames over 34 ms, and the longest frame
      bridgeHitches: bridgeStart ? rec.filter(r => r[0] >= bridgeStart[0] && r[0] < t0 && r[1] > 34).length : null,
      bridgeLongestMs: bridgeStart ? Math.round(Math.max(0, ...rec.filter(r => r[0] >= bridgeStart[0] && r[0] < t0).map(r => r[1]))) : null,
      longTasksMs: data.lt.filter(([s]) => s >= (bridgeStart ? bridgeStart[0] : t0) - 200 && s <= tEnd + 500).map(([s, d]) => [rel(s), d]),
      worldSteps: steps,
      resources: data.resources.filter(([, start]) => start >= t0 - 3000).map(([n, s, e, b]) => `${n} ${rel(s)}→${rel(e)} ${b}B`),
      timeline, errors: errors.slice(0, 6)
    };
    console.log(JSON.stringify(out, null, 1));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
