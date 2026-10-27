// The letters' parameter panel, exercised as a person would: it is there on a local address, the switches and sliders
// write the config and the scene follows, the values survive a reload, they can be copied out, it folds, L hides it,
// and it stays in step with the workshop. Screenshots on the way.
//   node panel-test.cjs [base=http://127.0.0.1:5611/] [outPrefix=shots/panel]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const base = process.argv[2] || 'http://127.0.0.1:5611/', out = process.argv[3] || 'shots/panel';
fs.mkdirSync(require('node:path').dirname(out), { recursive: true });
const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  const errs = []; page.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  const requests = []; page.on('request', r => requests.push(r.url()));
  const ready = async url => { await page.goto(url, { waitUntil: 'commit' }); await page.waitForFunction(() => document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 120000, polling: 250 }); await page.evaluate(() => window.__MONTIS_STUDY__.ready); };
  const cfg = () => page.evaluate(() => { const C = window.__MONTIS_STUDY__.CONFIG; return { ease: C.logoDrops.swirlEase, fly: C.logoDrops.flyTime, over: C.logoLetters.overshoot, crowd: C.logoDrops.crowd, gloss: C.logoDrops.swirlGloss, frost: C.logoLetters.frost, tint: C.logoLetters.tint }; });

  // 1. a local address: the panel is there without being asked for
  await ready(base + 'index.html');
  await page.waitForSelector('.letters-panel', { timeout: 15000 });
  const first = await page.evaluate(() => { const p = document.querySelector('.letters-panel'); return { hidden: p.hidden, rows: p.querySelectorAll('.lp-row').length, sections: [...p.querySelectorAll('.lp-section summary')].map(s => s.firstChild.textContent), axes: p.querySelectorAll('.lp-axis').length, pressed: [...p.querySelectorAll('.lp-seg button[aria-pressed=true]')].map(b => b.textContent) }; });
  check('local address: panel mounted and shown', first.hidden === false && first.rows === 107 && first.axes === 5 && first.sections.length === 9, first);
  check('at the defaults every switch stands on 設計值', first.pressed.length === 5 && first.pressed.every(t => t === '設計值'), first.pressed);
  const before = await cfg();
  await page.evaluate(() => window.__MONTIS_STUDY__ && document.querySelector('.letters-panel .lp-actions button').click());   // 到本章
  await page.waitForTimeout(1200);
  await page.hover('.letters-panel');
  fs.writeFileSync(out + '-1-default.png', await page.screenshot({ type: 'png' }));

  // 1b. the drops' liquid physics, row for row as index2.html's panel has it; and that panel's hand-set values in one click
  const liquid = await page.evaluate(() => { const d = [...document.querySelectorAll('.letters-panel .lp-section')].find(x => x.querySelector('summary').firstChild.textContent === '水滴 · 液體物理'); return d ? [...d.querySelectorAll('.lp-row label')].map(l => l.textContent) : null; });
  check('水滴 · 液體物理: the twelve rows, under the names index2.html has for them', JSON.stringify(liquid) === JSON.stringify(['蠕動幅度', '蠕動速度', '蠕動尺度', '慣性甩動', '彈性頻率', '彈性阻尼', '速度拉長', '水滴拖尾', '重力下垂', '表面滾動', '內部晃動', '變形上限']), liquid);
  await page.locator('.letters-panel .lp-axis').nth(1).locator('.lp-seg button').nth(0).click();
  const still = await page.evaluate(() => { const D = window.__MONTIS_STUDY__.CONFIG.logoDrops; return [D.wobble, D.wobbleSpeed, D.wobbleScale, D.inertia, D.jiggle, D.damping, D.stretch, D.tail, D.sag, D.roll, D.slosh]; });
  check('switch 液體感→靜止 sets the series as in the screenshot', JSON.stringify(still) === JSON.stringify([0, 0, .53, 0, 2, .02, 0, 0, 0, 0, 0]), still);
  await page.waitForTimeout(900);
  await page.hover('.letters-panel');
  fs.writeFileSync(out + '-1b-still.png', await page.screenshot({ type: 'png' }));
  await page.locator('.letters-panel .lp-axis').nth(1).locator('.lp-seg button').nth(1).click();
  const backToDesign = await page.evaluate(() => { const D = window.__MONTIS_STUDY__.CONFIG.logoDrops; return [D.wobble, D.inertia, D.jiggle, D.damping, D.slosh]; });
  check('…and 設計值 puts it back', JSON.stringify(backToDesign) === JSON.stringify([.058, 1, 9, .22, 1]), backToDesign);

  // 2. a switch moves its handful of values; the scene's config follows
  await page.locator('.letters-panel .lp-axis').nth(0).locator('.lp-seg button').nth(0).click();
  let after = await cfg();
  check('switch 節奏→柔慢 writes the config', after.ease === 1.15 && after.fly === 1.15 && after.over === .22, after);
  const pressed = await page.evaluate(() => [...document.querySelectorAll('.letters-panel .lp-seg button[aria-pressed=true]')].map(b => b.textContent));
  check('the switch shows where it stands', pressed[0] === '柔慢', pressed);

  // 3. a slider, and a typed number
  await page.evaluate(() => { const input = document.querySelector('#lp-logoDrops-crowd'); input.closest('details').open = true; input.value = '1.4'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => { const row = document.querySelector('#lp-logoLetters-frost').closest('.lp-row'); row.closest('details').open = true; const n = row.querySelector('input[type=number]'); n.value = '0.8'; n.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(() => { const input = document.querySelector('#lp-logoLetters-tint'); input.value = '#e8f2ff'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  after = await cfg();
  check('slider, typed number and colour write the config', after.crowd === 1.4 && after.frost === .8 && after.tint === '#e8f2ff', after);
  const marks = await page.evaluate(() => ({ changed: document.querySelectorAll('.letters-panel .lp-row.is-changed').length, note: document.querySelector('.letters-panel .lp-foot p').textContent.slice(0, 12), counts: [...document.querySelectorAll('.letters-panel .lp-section summary i')].map(i => i.textContent) }));
  check('changed rows are marked and counted', marks.changed === 8 && marks.note.startsWith('已調整 8 項'), marks);
  await page.hover('.letters-panel');
  fs.writeFileSync(out + '-2-changed.png', await page.screenshot({ type: 'png' }));

  // 4. the scene really follows (more water in the air at crowd 1.4: sixteen plain drops at this moment at the design value)
  const drops = await page.evaluate(async () => { const s = window.__MONTIS_STUDY__, C = s.CONFIG; s.journey.velocity = 0; s.journey.progress = s.journey.target = C.logo.at * 2.6 + .3 * C.logo.length; await new Promise(r => setTimeout(r, 900)); return s.brandMark.drops.meshes.filter(m => m.visible && m.userData.plain !== undefined).length; });
  check('the scene follows: more plain drops at 清水水滴數量 1.4', drops > 17, { plain: drops });

  // 5. copy
  await page.click('.letters-panel .lp-foot .lp-buttons button:nth-child(1)');
  await page.waitForTimeout(200);
  const copied = await page.evaluate(async () => ({ clip: await navigator.clipboard.readText().catch(() => null), box: document.querySelector('.letters-panel textarea').value }));
  let parsed = null; try { parsed = JSON.parse(copied.box); } catch { }
  check('複製參數 gives the changed values as JSON', !!parsed && parsed.logoDrops.crowd === 1.4 && parsed.logoDrops.swirlEase === 1.15 && parsed.logoLetters.frost === .8 && parsed.logoLetters.tint === '#e8f2ff' && (copied.clip === null || copied.clip.split(String.fromCharCode(13)).join('') === copied.box), parsed);

  // 6. a reload keeps them
  await ready(base + 'index.html');
  await page.waitForSelector('.letters-panel');
  after = await cfg();
  check('after a reload the changes are still in force', after.crowd === 1.4 && after.frost === .8 && after.ease === 1.15 && after.tint === '#e8f2ff', after);

  // 7. fold, and L
  await page.click('.letters-panel .lp-head button:last-child');
  const folded = await page.evaluate(() => { const p = document.querySelector('.letters-panel'); return { folded: p.classList.contains('is-folded'), h: p.getBoundingClientRect().height }; });
  check('folds to a tab', folded.folded && folded.h < 60, folded);
  fs.writeFileSync(out + '-3-folded.png', await page.screenshot({ type: 'png', clip: { x: 1000, y: 0, width: 440, height: 200 } }));
  await page.keyboard.press('l');
  const hiddenNow = await page.evaluate(() => document.querySelector('.letters-panel').hidden);
  await page.keyboard.press('l');
  const shownAgain = await page.evaluate(() => document.querySelector('.letters-panel').hidden === false);
  check('L hides it and brings it back', hiddenNow === true && shownAgain);
  await page.click('.letters-panel .lp-head button:last-child');

  // 7b. the other side; the chapter slider; a ghost when the pointer is away
  await page.click('.letters-panel .lp-head button:nth-last-child(2)');
  const left = await page.evaluate(() => { const r = document.querySelector('.letters-panel').getBoundingClientRect(); return Math.round(r.left); });
  await page.click('.letters-panel .lp-head button:nth-last-child(2)');
  const right = await page.evaluate(() => { const r = document.querySelector('.letters-panel').getBoundingClientRect(); return Math.round(innerWidth - r.right); });
  check('swaps sides and back', left === 18 && right === 18, { left, right });
  await page.evaluate(() => { const input = document.querySelector('.letters-panel .lp-scrub input'); input.value = '0.5'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(500);
  const whereNow = await page.evaluate(() => { const s = window.__MONTIS_STUDY__, C = s.CONFIG; return +((s.journey.progress - C.logo.at * 2.6) / C.logo.length).toFixed(3); });
  check('章節位置 slider puts the chapter where it says', Math.abs(whereNow - .5) < .002, { whereNow });
  await page.mouse.move(300, 500); await page.mouse.click(300, 500); await page.waitForTimeout(450);
  const ghost = await page.evaluate(() => document.querySelector('.letters-panel').classList.contains('is-idle'));
  await page.hover('.letters-panel .lp-title'); await page.waitForTimeout(100);
  const solid = await page.evaluate(() => !document.querySelector('.letters-panel').classList.contains('is-idle'));
  check('a ghost while the pointer is away, solid under it', ghost && solid, { ghost, solid });

  // 8. reset
  await page.evaluate(() => document.querySelector('.letters-panel .lp-foot .lp-buttons button:nth-child(2)').click());
  after = await cfg();
  check('全部還原 returns the design values and forgets', JSON.stringify(after) === JSON.stringify(before) && await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('finnovation:letters-panel:v1')).values).length === 0), after);

  // 9. in step with the workshop
  await ready(base + 'index.html?tune=1');
  await page.waitForSelector('.letters-panel'); await page.waitForSelector('.tune-group');
  await page.evaluate(() => { const input = document.querySelector('#lp-logoDrops-crowd'); input.value = '0.5'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const workshop = await page.evaluate(() => { const g = [...document.querySelectorAll('.tune-group')].find(g => g.dataset.title === '水滴 · 字母誕生（LOGO 組字）'); const row = [...g.querySelectorAll('.tune-row')].find(r => r.querySelector('label').textContent.startsWith('清水水滴數量')); return Number(row.querySelector('input[type=range]').value); });
  check('panel → workshop: the workshop slider follows', workshop === .5, { workshop });
  await page.evaluate(() => { const g = [...document.querySelectorAll('.tune-group')].find(g => g.dataset.title === '水滴 · 字母誕生（LOGO 組字）'); const row = [...g.querySelectorAll('.tune-row')].find(r => r.querySelector('label').textContent.startsWith('清水水滴數量')); const input = row.querySelector('input[type=range]'); input.value = '1.2'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const panelValue = await page.evaluate(() => Number(document.querySelector('#lp-logoDrops-crowd').value));
  check('workshop → panel: the panel slider follows', panelValue === 1.2, { panelValue });
  const geometry = await page.evaluate(() => { const a = document.querySelector('.letters-panel').getBoundingClientRect(), b = document.querySelector('#tuner').getBoundingClientRect(); return { panelRight: Math.round(a.right), workshopLeft: Math.round(b.left) }; });
  check('side by side, not on top of each other', geometry.panelRight <= geometry.workshopLeft, geometry);
  fs.writeFileSync(out + '-4-with-workshop.png', await page.screenshot({ type: 'png' }));
  await page.evaluate(() => document.querySelector('.letters-panel .lp-foot .lp-buttons button:nth-child(2)').click());

  // 10. not there when it should not be
  await ready(base + 'index.html?tune=0');
  await page.waitForTimeout(600);
  const absent = await page.evaluate(() => !document.querySelector('.letters-panel'));
  const fetched = requests.filter(u => u.includes('water-logo-letters-panel')).length;
  check('?tune=0: no panel', absent);
  await page.keyboard.press('l');
  await page.waitForSelector('.letters-panel', { timeout: 15000 });
  check('…until L asks for it', true);
  check('console clean', errs.length === 0, errs.slice(0, 4));
  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed  (panel module fetched ' + fetched + ' times before the ?tune=0 page)');
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
