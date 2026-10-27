// Films the scroll-driven valley -> cards bridge of index1-1 (screenshots per wheel notch, frame pacing).
//   node scripts/world/film-bridge.cjs [outDir] [--phone] [--reverse]
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
let chromium; try { ({ chromium } = require(PW)); } catch { ({ chromium } = require('playwright')); }
const BASE = process.env.BASE || 'http://localhost:5178/';   // the dev server (npx serve . / .claude/launch.json montis); note it serves index1-1 without .html
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fs = require('fs'), path = require('path');
const phone = process.argv.includes('--phone'), reverse = process.argv.includes('--reverse');
const out = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(require('os').tmpdir(), 'finnovation-world-qa', 'bridge');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
    await page.goto(BASE + 'index1-1?tune=0&letters=0');
    await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey, null, { timeout: 90000 });
    await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 90000 });
    await page.mouse.move(phone ? 195 : 720, phone ? 420 : 450);
    await page.keyboard.press('End');
    await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .01; }, null, { timeout: 90000 });
    await page.waitForFunction(() => window.__MONTIS_STUDY__.portfolio && window.__MONTIS_STUDY__.portfolio.ready, null, { timeout: 90000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, '00.png') });
    await page.evaluate(() => { window.__samples = []; const t0 = performance.now(); const loop = () => { const pf = window.__MONTIS_STUDY__.portfolio; window.__samples.push({ ms: Math.round(performance.now() - t0), a: +pf.transition.toFixed(3) }); if (performance.now() - t0 < 9000) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
    // One wheel notch (100 px) at a time, a screenshot after each.
    const notch = async (dy, k, label) => { await page.mouse.wheel(0, dy); await page.waitForTimeout(260); const a = await page.evaluate(() => window.__MONTIS_STUDY__.portfolio.transition.toFixed(3)); await page.screenshot({ path: path.join(out, String(k).padStart(2, '0') + '-' + label + '-' + a + '.png') }); };
    let k = 1;
    for (let i = 0; i < 11; i++) await notch(100, k++, 'dn');
    if (reverse) for (let i = 0; i < 11; i++) await notch(-100, k++, 'up');
    await page.waitForTimeout(400);
    const samples = await page.evaluate(() => window.__samples);
    const gaps = samples.slice(1).map((s, i) => s.ms - samples[i].ms);
    const state = await page.evaluate(() => { const s = window.__MONTIS_STUDY__; return { open: s.portfolio.open, covering: s.portfolio.covering, strip: s.portfolio.strip, progress: s.journey.progress, max: s.journey.max }; });
    fs.writeFileSync(path.join(out, 'samples.json'), JSON.stringify({ samples, maxGap: Math.max(...gaps) }, null, 0));
    console.log(JSON.stringify({ frames: samples.length, maxGapMs: Math.max(...gaps), hitches: gaps.filter(g => g > 34).length, state, errors: errors.slice(0, 8) }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
