'use strict';
/* QA · touch, part 2: (a) where on the screen is a swipe START ignored? — computed from the page's own rule (main.js: a touch that starts inside
   [data-journey-ui] / [data-world-ui] or on a button/link/input never scrolls the journey), as the share of a 30 px grid per state;
   (b) real CDP swipes that start on bare canvas (y = 38% of the height): through the journey, into the cards, across the cards, into the world, up out of the world, back down.
   Run: node scripts/index1-5/probe.cjs --phone --script scripts/index1-5/probes/qa/touch-grid.probe.cjs --out qa-touch-grid --timeout 1200 */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp, log }) => {
  const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'touch-grid' + (process.env.QA_SKIPGRID ? '-swipes' : '') + (process.env.QA_SUFFIX || '') + '.json'); const res = {}; const rec = (k, v) => { res[k] = v; fs.writeFileSync(file, JSON.stringify(res, null, 1)); };
  await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });
  const cdp = await page.context().newCDPSession(page); const W = vp.width, H = vp.height;
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const swipe = async (x1, y1, x2, y2, { steps = 10, gap = 12 } = {}) => { await touch('touchStart', [[x1, y1]]); for (let i = 1; i <= steps; i++) { await touch('touchMove', [[x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps]]); await page.waitForTimeout(gap); } await touch('touchEnd', []); };
  const S = () => Q.study(page);
  const grid = () => page.evaluate(() => {
    const step = 30; let n = 0, dead = 0; const deadBy = {}; const rows = [];
    for (let y = step / 2; y < innerHeight; y += step) { let line = ''; for (let x = step / 2; x < innerWidth; x += step) { n++; const t = document.elementFromPoint(x, y); const blocked = !t || !!t.closest('[data-journey-ui],[data-world-ui]') || !!t.closest('button,a,input'); if (blocked) { dead++; const who = t && (t.closest('.fi-copy-panel') ? 'copy' : t.closest('.fi-header') ? 'header' : t.closest('.fi-footer') ? 'footer' : t.closest('.fi-rail') ? 'rail' : t.closest('[data-world-ui]') ? 'world' : t.closest('dialog') ? 'dialog' : 'other:' + ((t.className && t.className.toString()) || t.tagName).slice(0, 24)); deadBy[who] = (deadBy[who] || 0) + 1; } line += blocked ? '#' : '.'; } rows.push(line); }
    return { cells: n, deadShare: +(dead / n).toFixed(2), deadBy, map: rows };
  });
  const out = {};
  if (!process.env.QA_SKIPGRID) { for (const [name, p] of [['p0', 0], ['p2.96', 2.96], ['p5.56', 5.56], ['pmax', 'max']]) { await L.fly(page, p); await page.waitForTimeout(1500); out[name] = await grid(); } rec('grid', out); }
  const sw = { journeyUp: [], journeyDown: [] };
  await L.fly(page, 0); await page.waitForTimeout(800);
  const y0 = H * .30;   /* the free band of the phone screen (the lower half is the headline/CTA block: swipes starting there are ignored) */
  for (let i = 0; i < 40 && (await S()).p < 13; i++) { await swipe(W / 2, y0 + 110, W / 2, y0 - 100); await page.waitForTimeout(350); const s = await S(); sw.journeyUp.push(s.p); if (s.cards && s.cards.open) break; }
  sw.afterUp = Q.short(await Q.settle(page, 8000));
  rec('swipes', sw);
  // at the end: keep swiping up from bare canvas -> cards (is the canvas start reachable at the end? the FOUR PATHS panel covers the middle)
  for (let i = 0; i < 12 && !(await S()).cards?.open; i++) { await swipe(W / 2, y0 + 110, W / 2, y0 - 100); await page.waitForTimeout(500); }
  await page.waitForTimeout(2000); sw.cards = Q.short(await S()); await Q.shot(page, 'tg-cards-phone', 64).catch(() => { });
  const a = (await S()).cards; await swipe(W * .85, H * .5, W * .15, H * .5, { steps: 10, gap: 12 }); await page.waitForTimeout(1000); const b = (await S()).cards;
  sw.cardsSide = { before: a && a.strip, after: b && b.strip };
  for (let i = 0; i < 16 && !(await S()).world?.open; i++) { await swipe(W / 2, H * .45, W / 2, H * .1, { steps: 8, gap: 10 }); await page.waitForTimeout(500); }
  await page.waitForTimeout(2500); sw.world = Q.short(await S());
  const ys = []; for (let i = 0; i < 6; i++) { await swipe(W / 2, H * .55, W / 2, H * .2); await page.waitForTimeout(700); ys.push((await S()).world?.y); } sw.worldUp = ys;
  const yd = []; for (let i = 0; i < 14; i++) { await swipe(W / 2, H * .3, W / 2, H * .8); await page.waitForTimeout(700); const s = await S(); yd.push(s.world?.open ? s.world.y : 'closed'); } sw.worldDown = yd;
  sw.afterDown = Q.short(await Q.settle(page, 8000));
  rec('swipes', sw);
  return { ok: true, deadShare: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.deadShare + ' ' + JSON.stringify(v.deadBy)])), swipes: sw };
};
