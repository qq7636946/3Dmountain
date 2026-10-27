'use strict';
/* hubtown-film.cjs — (1) is the 3D camera smoothed again on top of Lenis? (native scrollTop jump → per-frame camera);
   (2) steady wheel through the whole Hubtown home film (default 100 px / 50 ms = 2000 px/s): per-frame scrollTop + camera +
   every float uniform that changes → where the cuts are, what animates at a cut, camera speed per scroll px (continuity).
   Usage: node scripts/index1-5/probes/smooth/hubtown-film.cjs [--rate 2000] [--out NAME] [--skip-jump 1]
   Output: .qa/index1-5/smooth/<NAME>/film.json. Numbers only. */
const H = require('./ht-lib.cjs');
const { L, path } = H;

L.main('hubtown-film', { usage: 'hubtown-film.cjs [--rate 2000] [--out NAME]', timeout: 900, spec: { rate: 'value', out: 'value', 'skip-jump': 'value' } }, async o => {
  const rate = Number(o.rate) || 2000, out = path.join(L.QA_DIR, 'smooth', String(o.out || 'hubtown-film'));
  const s = await H.openHubtown('hubtown-film', o);
  const { page } = s;
  await page.waitForFunction(() => !!document.body && /SCROLL TO EXPLORE|NEXT/i.test(document.body.innerText) && !!window.__HT && Object.keys(window.__HT.seen).length > 3, null, { timeout: 120000, polling: 500 });
  await page.waitForTimeout(5000);
  await page.mouse.move(720, 450);
  const res = { rate };
  const grab = async () => page.evaluate(() => ({ f: window.__HT.frames.map(x => [x[0], x[1], x[4], x[5]]), u: window.__HT.ulog.slice(), w: window.__HT.wheels.slice() }));
  if (!o['skip-jump']) {
    // (1) native jump 1500 -> 1800, per-frame camera
    await page.evaluate(() => { document.querySelector('.js-page-scroll').scrollTop = 1500; });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__HT.start([]));
    await page.waitForTimeout(300);
    const tj = await page.evaluate(() => { const t = performance.now(); document.querySelector('.js-page-scroll').scrollTop = 1800; return t; });
    await page.waitForTimeout(3000);
    const d = await grab(); await page.evaluate(() => window.__HT.stop());
    const z = d.f.filter(f => f[0] >= tj - 40 && f[0] <= tj + 3000).map(f => [+(f[0] - tj).toFixed(1), f[1], f[2] && +f[2][2].toFixed(3)]);
    const z0 = z[0][2], z1 = z[z.length - 1][2];
    res.jump = { from: 1500, to: 1800, z0, z1, series: z.filter((_, i) => i % 4 === 0).map(x => x.join(':')).join(' ') };
    const find = q => (z.find(x => Math.abs(x[2] - z0) >= q * Math.abs(z1 - z0)) || [])[0];
    res.jump.t50 = find(.5); res.jump.t90 = find(.9); res.jump.t99 = find(.99);
    console.log('jump', JSON.stringify({ z0, z1, t50: res.jump.t50, t90: res.jump.t90, t99: res.jump.t99 }));
    await page.evaluate(() => { document.querySelector('.js-page-scroll').scrollTop = 0; });
    await page.waitForTimeout(2500);
  }
  // (2) steady wheel through the film
  const per = 50, delta = rate * per / 1000, n = Math.ceil(25300 / delta);
  await page.evaluate(() => window.__HT.start([]));
  const events = Array.from({ length: n }, (_, i) => [200 + i * per, delta]);
  const dur = 200 + n * per + 5000;
  await page.evaluate(([e, d]) => window.__HT.send(e, d), [events, dur]);
  const d = await grab(); await page.evaluate(() => window.__HT.stop());
  const w0 = d.w[0][0];
  res.film = { n: d.f.length, wheels: d.w.length, ulogN: d.u.length };
  L.writeJson(path.join(out, 'film.frames.json'), { w0, frames: d.f, ulog: d.u });
  // analysis: cuts (camera jumps), speed per scroll px
  const fr = d.f; const cuts = [];
  for (let i = 1; i < fr.length; i++) { if (!fr[i][2] || !fr[i - 1][2]) continue; const dd = H.dist(fr[i][2], fr[i - 1][2]); if (dd > 15) cuts.push({ t: +(fr[i][0] - w0).toFixed(0), st: fr[i][1], d: +dd.toFixed(1), from: fr[i - 1][2].map(v => +v.toFixed(1)), to: fr[i][2].map(v => +v.toFixed(1)) }); }
  res.cuts = cuts;
  // uniforms that change within +-700 ms of each cut
  res.cutUniforms = cuts.map(c => { const tc = c.t + w0; const names = {}; for (const [t, dl] of d.u) if (Math.abs(t - tc) < 700) for (const k in dl) (names[k] = names[k] || []).push([+(t - tc).toFixed(0), dl[k]]); return { st: c.st, names: Object.fromEntries(Object.entries(names).filter(([k, v]) => v.length > 1 && v.length < 400).slice(0, 25).map(([k, v]) => [k, v.length > 12 ? v.filter((_, i) => i % Math.ceil(v.length / 12) === 0) : v])) }; });
  // speed profile: per 300 scroll px bucket, camera distance travelled per scroll px (excluding cut frames)
  const buckets = {}; for (let i = 1; i < fr.length; i++) { if (!fr[i][2] || !fr[i - 1][2]) continue; const dd = H.dist(fr[i][2], fr[i - 1][2]); if (dd > 15) continue; const b = Math.floor(fr[i][1] / 300) * 300; const bk = buckets[b] || (buckets[b] = { dcam: 0, dst: 0 }); bk.dcam += dd; bk.dst += Math.max(0, fr[i][1] - fr[i - 1][1]); }
  res.speedPerPx = Object.entries(buckets).map(([b, v]) => [+b, v.dst ? +(v.dcam / v.dst * 100).toFixed(2) : null]);
  // scroll velocity (px/s) smoothness: max accel
  const vs = []; for (let i = 1; i < fr.length; i++) vs.push([fr[i][0] - w0, (fr[i][1] - fr[i - 1][1]) / (fr[i][0] - fr[i - 1][0]) * 1000]);
  res.scrollVel = { max: +Math.max(...vs.map(v => v[1])).toFixed(0), at: vs.reduce((a, b) => b[1] > a[1] ? b : a)[0] };
  L.writeJson(path.join(out, 'film.json'), res);
  console.log('cuts', JSON.stringify(cuts.map(c => [c.st, c.d, c.t])));
  console.log('cutUniforms', JSON.stringify(res.cutUniforms).slice(0, 2500));
  console.log('speedPerPx(cam units per 100 scroll px)', JSON.stringify(res.speedPerPx));
  console.log('scrollVel', JSON.stringify(res.scrollVel));
  console.log('json', L.abs(path.join(out, 'film.json')));
  L.printLog(s.log);
  return 0;
});
