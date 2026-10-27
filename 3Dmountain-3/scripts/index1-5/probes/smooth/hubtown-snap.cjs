'use strict';
/* hubtown-snap.cjs — Lenis response + snap behaviour of Hubtown, same headless environment for home and an inner page:
     notch     one 100 px wheel notch from rest: 63 % / 95 % / 99 % settle times, travel
     jump      native scrollTop jump on the home film: is the 3D camera smoothed again? (per-frame camera z)
     snap      after a notch / a stream stops in a "hold" region: delay until the page glides to a snap point, duration, curve
   Usage: node scripts/index1-5/probes/smooth/hubtown-snap.cjs --page home|about [--out NAME]
   Output: .qa/index1-5/smooth/<NAME>/snap-<page>.json. */
const H = require('./ht-lib.cjs');
const { L, path } = H;

L.main('hubtown-snap', { usage: 'hubtown-snap.cjs --page home|about [--out NAME]', timeout: 900, spec: { page: 'value', out: 'value' } }, async o => {
  const which = String(o.page || 'home'), out = path.join(L.QA_DIR, 'smooth', String(o.out || 'hubtown-snap'));
  const s = await H.openHubtown('hubtown-snap', o, which === 'home' ? 'https://hubtown.co.in/' : 'https://hubtown.co.in/' + which);
  const { page } = s;
  await page.waitForFunction(() => !!document.body && !!window.__HT && Object.keys(window.__HT.seen).length > 3 && !!document.querySelector('.js-page-scroll') && document.querySelector('.js-page-scroll').scrollHeight > 1500, null, { timeout: 150000, polling: 500 });
  await page.waitForTimeout(6000);
  await page.mouse.move(720, 450);
  const res = { page: which };
  const rec = async (name, setup, events, dur) => {
    await page.evaluate(() => window.__HT.start([]));
    await page.evaluate(setup || '0');
    const t = await page.evaluate(([e, d]) => window.__HT.send(e, d), [events, dur]);
    const d = await page.evaluate(() => { const P = window.__HT; P.stop(); return { f: P.frames.map(x => [x[0], x[1], x[4]]), w: P.wheels.slice() }; });
    return { t, ...d };
  };
  const settle = (f, t0, y0, y1) => { const rel = f.filter(x => x[0] >= t0).map(x => [x[0] - t0, x[1]]); const tot = y1 - y0; const find = q => { const r = rel.find(x => Math.abs(x[1] - y0) >= q * Math.abs(tot)); return r ? +r[0].toFixed(0) : null; }; return { total: +tot.toFixed(1), t63: find(.632), t95: find(.95), t99: find(.99) }; };
  // notch: from rest at a mid position
  const y0 = which === 'home' ? 1000 : 300;
  await page.evaluate(v => { document.querySelector('.js-page-scroll').scrollTop = v; }, y0);
  await page.waitForTimeout(3000);
  let r = await rec('notch', null, [[300, 100]], 3500);
  const tw = r.w[0][0]; const y1 = r.f[r.f.length - 1][1];
  res.notch = { y0: r.f[0][1], y1, ...settle(r.f, tw, r.f[0][1], y1) };
  console.log('notch', JSON.stringify(res.notch));
  // five notches 100 ms apart
  await page.waitForTimeout(2000);
  r = await rec('five', null, [0, 1, 2, 3, 4].map(i => [300 + i * 100, 100]), 4200);
  const tl = r.w[r.w.length - 1][0]; res.five = { y0: r.f[0][1], y1: r.f[r.f.length - 1][1] };
  { const f = r.f.filter(x => x[0] >= tl); const yEnd = f[f.length - 1][1]; const yAt = f[0][1]; const rem = yEnd - yAt; const find = q => { const x = f.find(x => (x[1] - yAt) >= q * rem); return x ? +(x[0] - tl).toFixed(0) : null; }; res.five.afterLast = { remaining: +rem.toFixed(1), t63: find(.632), t95: find(.95), t99: find(.99) }; }
  console.log('five', JSON.stringify(res.five));
  if (which === 'home') {
    // jump test: camera follows scrollTop instantly?
    await page.evaluate(() => { document.querySelector('.js-page-scroll').scrollTop = 1500; });
    await page.waitForTimeout(3000);
    r = await rec('jump', () => 0, [], 10);
    await page.evaluate(() => window.__HT.start([]));
    await page.waitForTimeout(250);
    const tj = await page.evaluate(() => { const t = performance.now(); document.querySelector('.js-page-scroll').scrollTop = 1800; return t; });
    await page.waitForTimeout(2500);
    const d = await page.evaluate(() => { const P = window.__HT; P.stop(); return P.frames.map(x => [x[0], x[1], x[4]]); });
    const z = d.filter(f => f[0] >= tj - 30).map(f => [+(f[0] - tj).toFixed(1), f[1], f[2] ? f[2][2] : null]);
    const z0 = z[0][2], z1 = z[z.length - 1][2]; const fz = q => { const x = z.find(x => x[2] != null && Math.abs(x[2] - z0) >= q * Math.abs(z1 - z0)); return x ? x[0] : null; };
    res.jump = { z0, z1, st0: z[0][1], st1: z[z.length - 1][1], t50: fz(.5), t90: fz(.9), t99: fz(.99), first: z.slice(0, 12).map(x => x.join(':')).join(' ') };
    console.log('jump', JSON.stringify(res.jump));
    // snap after a native set into the hold zone (no more input): watch scrollTop for 5 s
    for (const y of [3600, 6000, 11000, 14400]) {
      await page.evaluate(() => { document.querySelector('.js-page-scroll').scrollTop = 0; }); await page.waitForTimeout(2500);
      const rr = await rec('snap' + y, `document.querySelector('.js-page-scroll').scrollTop = ${y}`, [], 6000);
      const f = rr.f; const first = f[0][1]; let mv = f.find(x => Math.abs(x[1] - y) > 1);
      const end = f[f.length - 1][1]; const tMove = mv ? mv[0] - f[0][0] : null;
      const tail = f.filter(x => mv && x[0] >= mv[0]); const tDone = tail.length ? (tail.find(x => Math.abs(x[1] - end) < 1) || [])[0] : null;
      res['snap' + y] = { set: y, end, glide: !!mv, tMove: tMove && +tMove.toFixed(0), dur: mv && tDone ? +(tDone - mv[0]).toFixed(0) : null, curve: tail.filter((_, i) => i % 12 === 0).map(x => [+(x[0] - mv[0]).toFixed(0), Math.round(x[1])]).slice(0, 40) };
      console.log('snap', y, JSON.stringify({ end, tMove: res['snap' + y].tMove, dur: res['snap' + y].dur }));
    }
    // wheel stop in the hold zone: 8 notches then stop
    await page.evaluate(() => { document.querySelector('.js-page-scroll').scrollTop = 3000; }); await page.waitForTimeout(3000);
    r = await rec('stopHold', null, Array.from({ length: 8 }, (_, i) => [200 + i * 80, 100]), 7000);
    const lt = r.w[r.w.length - 1][0]; const f = r.f; const end = f[f.length - 1][1];
    const after = f.filter(x => x[0] >= lt); res.stopHold = { y0: f[0][1], atLast: after[0][1], end, curve: after.filter((_, i) => i % 12 === 0).map(x => [+(x[0] - lt).toFixed(0), Math.round(x[1])]).slice(0, 50) };
    console.log('stopHold', JSON.stringify({ y0: f[0][1], atLast: after[0][1], end }));
  }
  L.writeJson(path.join(out, `snap-${which}.json`), res);
  console.log('json', L.abs(path.join(out, `snap-${which}.json`)));
  L.printLog(s.log);
  return 0;
});
