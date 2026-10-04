// Measures dedicated GPU memory used by the Chrome process tree (Windows "GPU Process Memory" counters).
// node gpumem.cjs <baseUrl> <profile: desktop|phone> [scenarios]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execSync } = require('node:child_process');
const MARK = 'gm' + Date.now();
const BASE = process.argv[2], PROFILE = process.argv[3] || 'desktop', SCEN = (process.argv[4] || 'hero,canyon').split(',');
const P = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
            phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } }[PROFILE];
const ps = cmd => execSync(`powershell -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`, { encoding: 'utf8', timeout: 60000 }).trim();
function unusedTree(rootPid) {
  const rows = JSON.parse(ps('Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress'));
  const kids = new Map(); rows.forEach(r => { (kids.get(r.ParentProcessId) || kids.set(r.ParentProcessId, []).get(r.ParentProcessId)).push(r.ProcessId); });
  const out = new Set([rootPid]); const stack = [rootPid];
  while (stack.length) { const p = stack.pop(); for (const k of kids.get(p) || []) if (!out.has(k)) { out.add(k); stack.push(k); } }
  return out;
}
function gpuMB(pids) {
  const raw = ps("(Get-Counter '\\GPU Process Memory(*)\\Dedicated Usage' -ErrorAction SilentlyContinue).CounterSamples | Select-Object InstanceName,CookedValue | ConvertTo-Json -Compress");
  const rows = [].concat(JSON.parse(raw || '[]'));
  let sum = 0;
  for (const r of rows) { const m = /pid_(\d+)_/.exec(r.InstanceName); if (m && pids.has(Number(m[1]))) sum += r.CookedValue; }
  return Math.round(sum / 1048576);
}
const chromePids = () => new Set([].concat(JSON.parse(ps("@(Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { $_.Id }) | ConvertTo-Json -Compress") || "[]")));
let BEFORE = new Set();
const ours = () => new Set([...chromePids()].filter(p => !BEFORE.has(p)));
(async () => {
  BEFORE = chromePids();
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-precise-memory-info', '--gpumem-marker=' + MARK] });
  const context = await browser.newContext({ ...P });
  await context.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__rawRaf = raw; window.__rafFrozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); }); });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  const idle = gpuMB(ours());
  await page.goto(BASE + 'index4-6-3.html?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 240000, polling: 250 });
  await page.evaluate(() => { window.__rafFrozen = true; });
  const res = { profile: PROFILE, canvas: await page.evaluate(() => { const c = window.__MONTIS_STUDY__.renderer.domElement; return c.width + 'x' + c.height; }), browserIdleMB: idle };
  for (const name of SCEN) {
    await page.evaluate(n => { const S = window.__MONTIS_STUDY__, C = S.CONFIG; const shift = Math.max(0, S.logoChapterEnd() - C.disperse.handoff * 2.6) + S.forwardLength() - .572;
      S.journey.progress = S.journey.target = ({ hero: 0, canyon: 4.6 + shift, rivers: 10.98 + shift })[n]; S.step(90, 1 / 60); }, name);
    await new Promise(r => setTimeout(r, 1200));
    res[name + 'MB'] = gpuMB(ours());
  }
  console.log(JSON.stringify(res));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
