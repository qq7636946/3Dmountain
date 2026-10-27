// The look panel's new 山景 tab and its memory, on the staged page (index1-1 ?grade=1).
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
const base = process.argv[2] || 'http://127.0.0.1:5671/', out = process.argv[3] || 'shots/p7';
const results = []; const check = (n, ok, d) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); };
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(); page.setDefaultTimeout(150000);
  const errors = []; page.on('pageerror', e => errors.push(String(e.message).slice(0, 160))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  const load = async () => { await page.goto(base + 'index1-1.html?letters=0&grade=1', { waitUntil: 'commit' }); await page.waitForFunction(() => document.body.classList.contains('is-ready') && document.querySelector('.fi-grade') && window.__MONTIS_STUDY__, null, { timeout: 150000, polling: 250 }); };
  // a v1 store as an older panel left it: every value, at that day's defaults, plus one real choice
  await page.goto(base + 'index1-1.html?letters=0&grade=1', { waitUntil: 'commit' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('finnovation-look-v1', JSON.stringify({ mist: { push: .34, fog: 14, start: .16, end: .78, cards: .3, depth: 6, texture: .7 }, video: { brightness: 1, colour: .22, speed: 1 } })); });
  await load();
  const cfg = () => page.evaluate(() => { const C = window.__MONTIS_STUDY__.CONFIG; return { fog: C.mist.fog, push: C.mist.push, texture: C.mist.texture, colour: C.video.colour, height: C.watershedTerrain.height, snow: C.relief.snow, rock: C.watershedStyle.rockColor }; });
  const a = await cfg();
  check('old v1 store: values that were only that day\'s defaults do not cover the new ones; a real choice is kept', a.fog === 9 && a.push === .5 && a.colour === 1 && a.texture === .7, a);
  await page.evaluate(() => { [...document.querySelectorAll('.fi-grade [data-show]')].find(b => b.textContent.trim() === '山景').click(); });
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.fi-grade [data-panel="landscape"] label > span:first-child')].map(s => s.textContent));
  check('山景 tab lists the mountain settings (colours, frost, layers, and the shape ones marked ↻)', rows.length >= 26 && rows.includes('山石色彩') && rows.includes('山高 ↻') && rows.includes('山的數量 ↻'), { n: rows.length, first: rows.slice(0, 4), shape: rows.filter(r => r.includes('↻')).length });
  // a live one
  const setRange = (key, v) => page.evaluate(({ key, v }) => { const i = document.querySelector(`.fi-grade input[data-key="${key}"]`); i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); }, { key, v });
  await setRange('relief.snow', 1.2); await page.waitForTimeout(200);
  check('a live setting writes CONFIG at once', (await cfg()).snow === 1.2);
  await page.evaluate(() => { const i = document.querySelector('.fi-grade input[data-key="watershedStyle.rockColor"]'); i.value = '#a0b8cc'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await setRange('watershedTerrain.height', 1.3); await page.waitForTimeout(200);
  const shot1 = await page.screenshot({ type: 'jpeg', quality: 80, clip: await page.evaluate(() => { const r = document.querySelector('.fi-grade').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 900 - r.y) }; }) });
  fs.writeFileSync(out + '-landscape-tab.jpg', shot1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('finnovation-look-v2')));
  check('only what differs from the defaults is remembered', stored.landscape?.['relief.snow'] === 1.2 && stored.landscape?.['watershedTerrain.height'] === 1.3 && stored.mist?.fog === undefined && stored.mist?.texture === .7, stored);
  // 套用山形 reloads, and the shape is built with the new height
  await Promise.all([page.waitForNavigation({ waitUntil: 'commit' }), page.evaluate(() => document.querySelector('.fi-grade [data-rebuild]').click())]);
  await page.waitForFunction(() => document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 150000, polling: 250 });
  const b = await cfg();
  check('after 套用山形 the page reloads with the saved mountain values in place before the build', b.height === 1.3 && b.snow === 1.2 && b.rock === '#a0b8cc', b);
  // 重設本頁 on the 山景 tab goes back to the page's own values
  await page.waitForFunction(() => document.querySelector('.fi-grade'), null, { timeout: 60000 });
  await page.evaluate(() => { [...document.querySelectorAll('.fi-grade [data-show]')].find(x => x.textContent.trim() === '山景').click(); document.querySelector('.fi-grade [data-reset]').click(); });
  await page.waitForTimeout(300);
  const c = await cfg(); const stored2 = await page.evaluate(() => JSON.parse(localStorage.getItem('finnovation-look-v2')));
  check('重設本頁 (山景) restores the page values and forgets them', c.height === 1 && c.snow === 0 && c.rock === '#bdd3e5' && !stored2.landscape, { c, stored2 });
  const copied = await page.evaluate(async () => { let t = ''; navigator.clipboard.writeText = s => { t = s; return Promise.resolve(); }; document.querySelector('.fi-grade [data-copy]').click(); await new Promise(r => setTimeout(r, 50)); return t; });
  check('複製參數 lists the mountains one path a line', /watershedTerrain\.height: 1\.00,/.test(copied) && /watershedStyle\.rockColor: '#bdd3e5',/.test(copied), copied.split('\n').filter(l => /watershed|relief|shoreline/.test(l)).slice(0, 4));
  check('no page errors', errors.length === 0, errors.slice(0, 3));
  await page.evaluate(() => localStorage.clear());
  console.log((results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED') + ' ' + results.filter(Boolean).length + '/' + results.length);
  await shut(ctx); await shut(browser); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
