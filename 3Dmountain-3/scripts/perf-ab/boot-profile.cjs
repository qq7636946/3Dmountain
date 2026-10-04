// Where does boot time go? CPU sampling profile from navigation to `is-ready` (= the hero is visible), with optional CPU throttling.
//   node scripts/perf-ab/boot-profile.cjs http://127.0.0.1:5199/ [cpuThrottle=1] [pageFile=index4-6-3.html]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:5199/';
const RATE = Number(process.argv[3] || 1);
const PAGE = process.argv[4] || 'index4-6-3.html';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  let browserPid = null;
  try {
    const session = await browser.newBrowserCDPSession();
    const { processInfo } = await session.send('SystemInfo.getProcessInfo');
    browserPid = processInfo.find(info => info.type === 'browser')?.id || null;
    await session.detach();
  } catch {}
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.setDefaultTimeout(300000);
  await page.addInitScript(() => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch {} });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 400 });
  if (RATE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  await page.goto(BASE + PAGE + '?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && document.body.classList.contains('is-ready'), null, { timeout: 300000, polling: 200 });
  const readyMs = Date.now() - t0;
  await page.evaluate(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.ready);
  const chapterReadyMs = Date.now() - t0;
  const { profile } = await cdp.send('Profiler.stop');
  const lt = await page.evaluate(() => window.__lt);
  // ---- aggregate the sampling profile
  const nodes = new Map(profile.nodes.map(n => [n.id, n])); const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const key = n => `${n.callFrame.functionName || '(anon)'} @ ${(n.callFrame.url || '').split('/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`;
  const selfByKey = new Map(), inclByKey = new Map(); let total = 0, idle = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = (profile.timeDeltas[i] || 0) / 1000; let id = profile.samples[i]; const n = nodes.get(id); total += dt;
    if (n.callFrame.functionName === '(idle)') { idle += dt; continue; }
    const k = key(n); selfByKey.set(k, (selfByKey.get(k) || 0) + dt);
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) { const kk = key(nodes.get(cur)); if (!seen.has(kk)) { seen.add(kk); inclByKey.set(kk, (inclByKey.get(kk) || 0) + dt); } }
  }
  const own = k => /index4-6-3|-463\.js|water-|finnovation-/.test(k);
  const top = (m, filt, n) => [...m.entries()].filter(([k]) => filt(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(6)} ms  ${k}`);
  const longSum = lt.reduce((s, [, d]) => s + d, 0);
  const heroTbtMs = lt.filter(([start]) => start < readyMs).reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0);
  const chapterTbtMs = lt.reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0);
  const maxLongTaskMs = lt.reduce((max, [, duration]) => Math.max(max, duration), 0);
  console.log(JSON.stringify({ cpuThrottle: RATE, readyMs, heroReadyMs: readyMs, chapterReadyMs, profiledMs: Math.round(total), busyMs: Math.round(total - idle), busyPct: Math.round((total - idle) / total * 100), longTasks: lt.length, longTaskMs: longSum, heroTbtMs, chapterTbtMs, maxLongTaskMs, biggestLongTasks: [...lt].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, d]) => `${d}ms@${s}`) }));
  console.log('--- inclusive time of the page\'s own functions ---'); console.log(top(inclByKey, own, 16).join('\n'));
  console.log('--- biggest self-time overall (incl. engine/three) ---'); console.log(top(selfByKey, () => true, 8).join('\n'));
  let closeTimer;
  const closed = await Promise.race([
    browser.close().then(() => true, () => false),
    new Promise(resolve => { closeTimer = setTimeout(() => resolve(false), 10000); })
  ]);
  clearTimeout(closeTimer);
  if (!closed && browserPid) { try { process.kill(browserPid); } catch {} }
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
