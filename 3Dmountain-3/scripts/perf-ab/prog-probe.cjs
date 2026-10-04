// Which materials go through three's getParameters()/getProgramCacheKey() EVERY FRAME (needsProgramChange)?
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:5200/__base__/';
const SCEN = (process.argv[3] || 'hero,logo,canyon,rivers').split(',');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    const raw = window.requestAnimationFrame.bind(window); window.__rawRaf = raw; window.__rafFrozen = false;
    window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); });
  });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  await page.goto(BASE + 'index4-6-3.html?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 240000, polling: 250 });
  await page.evaluate(() => { window.__rafFrozen = true; });
  for (const name of SCEN) {
    const res = await page.evaluate(n => {
      const S = window.__MONTIS_STUDY__, C = S.CONFIG;
      const shift = Math.max(0, S.logoChapterEnd() - C.disperse.handoff * 2.6) + S.forwardLength() - .572, ls = C.logo.at * 2.6;
      const map = { hero: 0, logo: ls + C.logo.length * .44, canyon: 4.6 + shift, rivers: 10.98 + shift };
      S.journey.progress = S.journey.target = map[n]; S.step(120, 1 / 60);
      const counts = new Map(); const restore = [];
      const label = (m, extra) => `${m.type}:${m.name || m.uuid.slice(0, 6)}${extra || ''}`;
      // find Material.prototype
      let sampleMat = null;
      for (const root of [S.mainRenderPass.scene, S.canyon.scene]) root.traverse(o => { if (!sampleMat && o.material) sampleMat = Array.isArray(o.material) ? o.material[0] : o.material; });
      let P = Object.getPrototypeOf(sampleMat);
      while (P && !Object.prototype.hasOwnProperty.call(P, 'customProgramCacheKey')) P = Object.getPrototypeOf(P);
      const protoOrig = P.customProgramCacheKey;
      P.customProgramCacheKey = function () { const k = label(this); counts.set(k, (counts.get(k) || 0) + 1); return protoOrig.call(this); };
      restore.push(() => { P.customProgramCacheKey = protoOrig; });
      for (const root of [S.mainRenderPass.scene, S.canyon.scene]) root.traverse(o => {
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) if (Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) {
          const o2 = m.customProgramCacheKey; m.customProgramCacheKey = function () { const k = label(this, ' (own)'); counts.set(k, (counts.get(k) || 0) + 1); return o2.call(this); };
          restore.push(() => { m.customProgramCacheKey = o2; });
        }
      });
      const FR = 10; S.step(FR, 1 / 60);
      restore.forEach(f => f());
      const rows = [...counts.entries()].map(([k, v]) => [k, v / FR]).sort((a, b) => b[1] - a[1]);
      return { total: rows.reduce((s, r) => s + r[1], 0), rows: rows.slice(0, 14) };
    }, name);
    console.log(`\n## ${name}: getParameters calls per frame = ${res.total}`);
    res.rows.forEach(([k, v]) => console.log(`   ${String(v).padStart(5)} /frame  ${k}`));
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
