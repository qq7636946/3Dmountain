// The look panel (色調／霧／影片) on index1-1: tabs, presets, the mist colour, live effect mid-bridge, video tab, copy.
//   node scripts/world/panel-test.cjs   (screenshots go to the system temp folder)
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
let chromium; try { ({ chromium } = require(PW)); } catch { ({ chromium } = require('playwright')); }
const BASE = process.env.BASE || 'http://localhost:5178/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const path = require('path'), fs = require('fs');
const out = path.join(require('os').tmpdir(), 'finnovation-world-qa', 'panel'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const results = []; const check = (n, ok, d) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); };
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await page.goto(BASE + 'index1-1?letters=0&grade=1');
    await page.waitForFunction(() => document.body.classList.contains('is-ready') && document.querySelector('.fi-grade'), null, { timeout: 120000 });
    await page.mouse.move(720, 450); await page.keyboard.press('End');
    await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .01 && s.portfolio && s.portfolio.ready; }, null, { timeout: 120000 });
    await page.waitForTimeout(600);
    // half way through the bridge
    for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(80); }
    await page.waitForTimeout(1200);
    const amount = await page.evaluate(() => window.__MONTIS_STUDY__.portfolio.transition);
    await page.click('.fi-grade [data-show="mist"]'); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(out, 'mist-default.png') });
    await page.click('.fi-grade [data-panel="mist"] [data-preset="濃霧"]'); await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, 'mist-thick.png') });
    const thick = await page.evaluate(() => ({ ...window.__MONTIS_STUDY__.CONFIG.mist }));
    check('濃霧 preset writes CONFIG.mist', thick.fog === 26 && thick.end === .68, { fog: thick.fog, end: thick.end });
    await page.click('.fi-grade [data-panel="mist"] [data-preset="淡霧"]'); await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, 'mist-light.png') });
    // mist colour (also the card ground): set through the colour input
    await page.evaluate(() => { const i = document.querySelector('.fi-grade input[type=color][data-key="base"]'); i.value = '#e3eef6'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(400);
    const base = await page.evaluate(() => window.__MONTIS_STUDY__.CONFIG.portfolio.base.map(v => +v.toFixed(3)));
    check('霧色 writes CONFIG.portfolio.base in place', Math.abs(base[0] - 227 / 255) < .002 && Math.abs(base[2] - 246 / 255) < .002, base);
    await page.click('.fi-grade [data-reset]'); await page.waitForTimeout(300);
    const reset = await page.evaluate(() => ({ fog: window.__MONTIS_STUDY__.CONFIG.mist.fog, base: window.__MONTIS_STUDY__.CONFIG.portfolio.base.map(v => +v.toFixed(3)) }));
    check('重設本頁 restores the mist defaults', reset.fog === 9 && reset.base[0] === .925 /* mist defaults since 2026-10-19: fog 9 */, reset);
    // video tab
    await page.click('.fi-grade [data-show="video"]'); await page.waitForTimeout(150);
    await page.click('.fi-grade [data-panel="video"] [data-preset="明亮"]'); await page.waitForTimeout(150);
    const v = await page.evaluate(() => ({ ...window.__MONTIS_STUDY__.CONFIG.video }));
    check('影片 preset writes CONFIG.video', v.brightness === 1.3 && v.colour === .5, v);
    await page.screenshot({ path: path.join(out, 'video-tab.png') });
    // copy text
    const text = await page.evaluate(async () => { let t = ''; navigator.clipboard.writeText = s => { t = s; return Promise.resolve(); }; document.querySelector('.fi-grade [data-copy]').click(); await new Promise(r => setTimeout(r, 50)); return t; });
    check('複製參數 lists grade, mist, video, base, haze', /grade: \{/.test(text) && /mist: \{.*fog: 9/.test(text) && /video: \{ brightness: 1\.30/.test(text) && /portfolio\.base/.test(text) && /watershedStyle\.haze/.test(text), text.split('\n').map(l => l.slice(0, 70)));
    check('no page errors', errors.length === 0, errors.slice(0, 3));
    console.log('bridge amount at the screenshots', amount.toFixed(3));
  } finally { await browser.close(); }
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
})().catch(e => { console.error(e); process.exitCode = 1; });
