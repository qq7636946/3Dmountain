// The portfolio epilogue, exercised as a visitor would: scroll to the end of the journey, scroll on, ride the strip,
// scroll back. Real GPU, the page's own loop, real wheel events. Writes a filmstrip and prints checks.
//   node epilogue-test.cjs [base=http://127.0.0.1:5631/] [out=shots/epilogue] [--phone]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const base = args[0] || 'http://127.0.0.1:5631/', out = args[1] || 'shots/epilogue', phone = process.argv.includes('--phone');
const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const reduced = process.argv.includes('--reduced');
  const context = await browser.newContext({ ...(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }), reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  const errors = [], bad = [], asked = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 200)); });
  page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 100)); });
  page.on('request', r => { const u = r.url(); if (/portfolio-|ogl@|pexels/.test(u)) asked.push(u.replace(/\?.*$/, '').split('/').slice(-1)[0]); });
  await page.goto(base + 'index.html?tune=0&letters=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 120000, polling: 250 });
  await page.evaluate(() => window.__MONTIS_STUDY__.ready);
  const frames = [];
  const snap = async label => { const shot = await page.screenshot({ type: 'jpeg', quality: 84 }); if (label === 'settled' || label === 'opening') fs.writeFileSync(out + '-' + label + '.jpg', shot); frames.push({ label, data: 'data:image/jpeg;base64,' + shot.toString('base64') }); };
  const st = () => page.evaluate(() => { const s = window.__MONTIS_STUDY__, p = s.portfolio, layer = document.querySelector('.fi-portfolio');
    return { progress: +s.journey.progress.toFixed(3), max: +s.journey.max.toFixed(3), mounted: !!p, open: !!p?.open, covering: !!p?.covering, layer: layer ? getComputedStyle(layer).opacity : null,
      body: document.body.classList.contains('is-portfolio'), copy: document.querySelector('.fi-portfolio-copy') ? getComputedStyle(document.querySelector('.fi-portfolio-copy')).opacity : null,
      rail: getComputedStyle(document.querySelector('.fi-rail')).opacity }; });
  const wheel = async (n, dy = 100, gap = 140) => { for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy); await page.waitForTimeout(gap); } };
  await page.mouse.move(phone ? 195 : 720, phone ? 420 : 450);

  check('nothing of the epilogue is asked for at the start of the page', asked.length === 0, asked);
  // to the end of the journey, as End does
  await page.keyboard.press('End');
  await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .02; }, null, { timeout: 60000, polling: 200 });
  await page.waitForTimeout(1500);
  const atEnd = await st(); await snap('last chapter');
  check('near the end the epilogue module is mounted, and stays closed', atEnd.mounted && !atEnd.open && atEnd.layer === '0', atEnd);
  const got = [...new Set(asked)];
  check('the strip, OGL and the pictures are fetched ahead', got.includes('portfolio-epilogue.js') && got.includes('portfolio-slider.js') && got.some(a => /\+esm|ogl/.test(a)) && got.filter(a => /pexels-photo/.test(a)).length === 11, got.slice(0, 16));

  // scrolled on: it opens
  await wheel(2);
  const opening = await st(); await page.waitForTimeout(350); await snap('opening');
  check('scrolled on past the end: it opens', opening.open && opening.body, opening);
  await page.waitForTimeout(1300); await snap('fly-in');
  const covered = await st();
  check('the ground covers the scene, the chapter copy and the rail are out, its own copy is in', covered.covering && covered.layer === '1' && Number(covered.rail) < .05 && Number(covered.copy) > .9, covered);
  await page.waitForTimeout(2600); await snap('settled');
  const pictures = await page.evaluate(async () => { const c = document.querySelector('.fi-portfolio canvas'); const probe = document.createElement('canvas'); probe.width = 96; probe.height = 60;
    await new Promise(r => requestAnimationFrame(r)); const x = probe.getContext('2d'); x.drawImage(c, 0, 0, 96, 60); const d = x.getImageData(0, 0, 96, 60).data; let dark = 0, n = 0, lo = 255, hi = 0;
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; n++; if (l < 200) dark++; lo = Math.min(lo, l); hi = Math.max(hi, l); } return { size: c.width + 'x' + c.height, share: +(dark / n).toFixed(3), lo: Math.round(lo), hi: Math.round(hi) }; });
  check('the cards are drawn (pictures on a pale ground)', pictures.share > .08 && pictures.share < .7 && pictures.hi > 225, pictures);

  // the wheel rides the strip, the journey stays where it is
  const before = await page.evaluate(() => window.__MONTIS_STUDY__.journey.target);
  await wheel(3); await page.waitForTimeout(250); await snap('riding');
  await page.waitForTimeout(1800); await snap('rest');
  const riding = await page.evaluate(() => ({ target: window.__MONTIS_STUDY__.journey.target, open: window.__MONTIS_STUDY__.portfolio.open }));
  check('the wheel rides the strip; the journey does not move', riding.open && Math.abs(riding.target - before) < 1e-6, riding);
  // a drag moves the cards
  if (!phone) { await page.mouse.move(900, 380); await page.mouse.down(); await page.mouse.move(600, 380, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(900); await snap('dragged'); }
  // back up the strip and out
  for (let i = 0; i < 14 && (await st()).open; i++) await wheel(1, -100, 110);
  await wheel(3, -100, 110);   /* the pull carries on a moment after it has closed */
  await page.waitForTimeout(800);
  const closed = await st();
  check('scrolled back past the start of the strip: it closes, the last chapter is there again', !closed.open && !closed.body && Math.abs(closed.progress - closed.max) < .02, closed);
  await page.waitForTimeout(1300); await snap('back');
  const after = await st();
  check('the scene and its copy are back', after.layer === '0' && Number(after.rail) > .9, after);
  // open again, then sent elsewhere by the page's own navigation
  await wheel(2); await page.waitForTimeout(600);
  const again = await st();
  await page.keyboard.press('Home'); await page.waitForTimeout(700);
  const home = await st();
  check('it opens again; Home closes it and the journey goes back to the start', again.open && !home.open && home.progress < again.progress, { again: again.open, home });
  check('console clean, nothing failed to load', errors.length === 0 && bad.length === 0, { errors: errors.slice(0, 4), bad: bad.slice(0, 4) });

  const sheet = await page.evaluate(async frames => {
    const ims = await Promise.all(frames.map(f => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = f.data; })));
    const cols = Math.min(4, ims.length), cw = 620, ch = Math.round(cw * ims[0].naturalHeight / ims[0].naturalWidth), c = document.createElement('canvas'); c.width = cw * cols; c.height = ch * Math.ceil(ims.length / cols);
    const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    ims.forEach((im, i) => { const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch; x.drawImage(im, cx, cy, cw, ch); x.font = '600 14px system-ui'; x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(cx + 6, cy + 6, x.measureText(frames[i].label).width + 12, 22); x.fillStyle = '#fff'; x.fillText(frames[i].label, cx + 12, cy + 22); });
    return c.toDataURL('image/jpeg', .85);
  }, frames);
  fs.writeFileSync(out + '.jpg', Buffer.from(sheet.split(',')[1], 'base64'));
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed  → ${out}.jpg`);
  await shut(context); await shut(browser); process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
