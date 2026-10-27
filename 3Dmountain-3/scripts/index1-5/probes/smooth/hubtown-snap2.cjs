'use strict';
/* hubtown-snap2.cjs — does Hubtown's home film magnet to a "hold" after the visitor stops WHEELING (not a native jump)?
   From a start y, send N notches (100 px / 80 ms), then watch scrollTop for 7 s: delay until it moves again, glide speed, final y.
   Usage: node scripts/index1-5/probes/smooth/hubtown-snap2.cjs [--cases 3000:9,9000:6,13000:3,5200:2] [--out NAME]
   Output: .qa/index1-5/smooth/<NAME>/snap2.json */
const H = require('./ht-lib.cjs');
const { L, path } = H;
L.main('hubtown-snap2', { usage: 'hubtown-snap2.cjs [--cases y:n,…] [--out NAME]', timeout: 600, spec: { cases: 'value', out: 'value' } }, async o => {
  const cases = String(o.cases || '3000:9,9000:6,13000:3,5200:2,16000:4').split(',').map(c => c.split(':').map(Number));
  const out = path.join(L.QA_DIR, 'smooth', String(o.out || 'hubtown-snap2'));
  const s = await H.openHubtown('hubtown-snap2', o);
  const { page } = s;
  await page.waitForFunction(() => !!document.body && !!window.__HT && Object.keys(window.__HT.seen).length > 3 && !!document.querySelector('.js-page-scroll') && document.querySelector('.js-page-scroll').scrollHeight > 1500, null, { timeout: 150000, polling: 500 });
  await page.waitForTimeout(6000); await page.mouse.move(720, 450);
  const res = [];
  for (const [y0, n] of cases) {
    await page.evaluate(v => { document.querySelector('.js-page-scroll').scrollTop = v; }, y0);
    await page.waitForTimeout(9000);   // let any jump-snap finish
    const base = await page.evaluate(() => document.querySelector('.js-page-scroll').scrollTop);
    await page.evaluate(() => window.__HT.start([]));
    const events = Array.from({ length: n }, (_, i) => [200 + i * 80, 100]);
    await page.evaluate(([e, d]) => window.__HT.send(e, d), [events, 200 + n * 80 + 7000]);
    const d = await page.evaluate(() => { const P = window.__HT; P.stop(); return { f: P.frames.map(x => [x[0], x[1], x[4]]), w: P.wheels.slice() }; });
    const tl = d.w[d.w.length - 1][0], f = d.f;
    // lenis settles ~2 s after the last notch; look from 3 s on for further movement
    const late = f.filter(x => x[0] >= tl + 3000), a = late[0][1], b = late[late.length - 1][1];
    const mv = late.find(x => Math.abs(x[1] - a) > 2);
    const r = { start: base, notches: n, expectEnd: base + n * 100, yAtLast: f.find(x => x[0] >= tl)[1], y3s: a, yEnd: b, movedAfter3s: Math.round(b - a), tMoveAfter3s: mv ? Math.round(mv[0] - tl) : null, curve: f.filter(x => x[0] >= tl && (Math.round(x[0] - tl) % 500) < 9).map(x => [Math.round(x[0] - tl), Math.round(x[1])]).slice(0, 20) };
    res.push(r); console.log(JSON.stringify({ ...r, curve: undefined }));
  }
  L.writeJson(path.join(out, 'snap2.json'), res);
  console.log('json', L.abs(path.join(out, 'snap2.json')));
  return 0;
});
