// Do any two drops of the swirl ever intersect? Scrubs the LOGO chapter and measures, for every pair of visible drops,
// the gap between their surfaces (centre distance minus the two radii, in the ring's units). Real GPU page, frozen rAF.
//   node clearance.cjs [--base http://127.0.0.1:5611/] [--from -0.42] [--to 1.02] [--step 0.004] [--exp "<js>"] [--profile desktop1x|phone]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const argv = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n !== undefined && !/^--[a-z]/.test(n)) { argv[a.slice(2)] = n; i++; } else argv[a.slice(2)] = true; } }
const BASE = argv.base || 'http://127.0.0.1:5611/', FROM = Number(argv.from ?? -.42), TO = Number(argv.to ?? 1.02), STEP = Number(argv.step || .004);
const PROFILES = { desktop1x: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const context = await browser.newContext(PROFILES[argv.profile || 'desktop1x']);
  await context.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__rafFrozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); }); });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(BASE + 'index.html?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 180000, polling: 250 });
  await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; window.__rafFrozen = true; });
  if (argv.exp) await page.evaluate(argv.exp);
  const out = await page.evaluate(({ FROM, TO, STEP }) => {
    const s = window.__MONTIS_STUDY__, C = s.CONFIG, D = s.brandMark.drops;
    const worst = [], counts = [];
    let most = 0, mostAt = 0, letterPairs = 1e9;
    for (let t = FROM; t <= TO + 1e-9; t += STEP) {
      s.journey.progress = s.journey.target = C.logo.at * 2.6 + t * C.logo.length; s.journey.velocity = 0; s.step(2, 1 / 60);
      const live = D.group.visible ? D.meshes.filter(m => m.visible && m.material.uniforms.uOpacity.value > .05) : [];
      if (live.length > most) { most = live.length; mostAt = t; }
      if (Math.abs(t * 20 - Math.round(t * 20)) < STEP * 10 - 1e-9) counts.push([+t.toFixed(2), live.length, live.filter(m => m.userData.plain === undefined).length]);
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        // a drop that is breaking has stopped being a body: it is a thinning shell drawn over everything else
        if (a.material.uniforms.uBurst.value > .02 || b.material.uniforms.uBurst.value > .02) continue;
        const gap = a.position.distanceTo(b.position) - a.scale.x - b.scale.x;
        const both = a.userData.plain === undefined && b.userData.plain === undefined;
        if (both) letterPairs = Math.min(letterPairs, gap);
        if (gap < .03) worst.push({ t: +t.toFixed(3), gap: +gap.toFixed(3), a: a.name.replace('Water drop ', ''), b: b.name.replace('Water drop ', ''), ra: +a.scale.x.toFixed(3), rb: +b.scale.x.toFixed(3) });
      }
    }
    worst.sort((x, y) => x.gap - y.gap);
    const pairs = new Map();
    for (const w of worst) { const k = w.a + ' | ' + w.b; if (!pairs.has(k)) pairs.set(k, { ...w, frames: 0 }); pairs.get(k).frames++; }
    return { most, mostAt: +mostAt.toFixed(3), letterPairsMinGap: +letterPairs.toFixed(3), tightPairs: [...pairs.values()].slice(0, 14), counts };
  }, { FROM, TO, STEP });
  console.log(JSON.stringify({ ...out, errors }, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
