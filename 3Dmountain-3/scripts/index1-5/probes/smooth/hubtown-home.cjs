'use strict';
/* hubtown-home.cjs — observation of https://hubtown.co.in/ home (WebGL scroll film): what one wheel notch does, how long it
   plays, threshold / queue / cooldown, direction symmetry, camera easing, text reveal. Numbers only + our own screenshots.
   Usage: node scripts/index1-5/probes/smooth/hubtown-home.cjs [--exp explore,notch,tiny,queue,stream,back,sheet] [--out NAME]
   Output: .qa/index1-5/smooth/<NAME>/home.json (+ sheet frames in the same folder). One headless browser at a time (QA lock). */
const H = require('./ht-lib.cjs');
const { L, path } = H;

const WATCH = ['.page h1', '.page h2', '.page p', '.page .split-line', '.page a'];

L.main('hubtown-home', { usage: 'hubtown-home.cjs [--exp explore,notch,...] [--out NAME]', timeout: 900, spec: { exp: 'value', out: 'value' } }, async o => {
  const exps = String(o.exp || 'explore,notch,tiny,queue,back,stream').split(',');
  const out = path.join(L.QA_DIR, 'smooth', String(o.out || 'hubtown-home'));
  const s = await H.openHubtown('hubtown-home', o);
  const { page } = s;
  const res = { url: 'https://hubtown.co.in/', t: new Date().toISOString() };
  const t0 = Date.now();
  await page.waitForFunction(() => !!document.body && /SCROLL TO EXPLORE|NEXT/i.test(document.body.innerText) && !!window.__HT && Object.keys(window.__HT.seen).length > 3, null, { timeout: 120000, polling: 500 });
  await page.waitForTimeout(4000);
  res.loadMs = Date.now() - t0;
  await page.mouse.move(720, 450);
  const frames = async () => page.evaluate(() => ({ f: window.__HT.frames.map(x => x.slice()), w: window.__HT.wheels.slice() }));
  const head = () => page.evaluate(() => { const e = [...document.querySelectorAll('h1,h2')].find(x => x.getBoundingClientRect().width > 100 && getComputedStyle(x).opacity > 0.5); return e ? e.textContent.replace(/\s+/g, ' ').trim().slice(0, 50) : ''; });
  const run = async (name, events, dur, extra = {}) => {
    await page.evaluate(w => { window.__HT.wheels.length = 0; window.__HT.start(w); }, WATCH);
    const h0 = await head();
    const tsend = await page.evaluate(([e, d]) => window.__HT.send(e, d), [events, dur]);
    const h1 = await head();
    const d = await frames(); await page.evaluate(() => window.__HT.stop());
    const fr = d.f; const camPos = f => f[4] || H.camFromView(f[2] || f[3]);
    const prog = H.pathProgress(fr, camPos);
    const w0 = d.w[0] ? d.w[0][0] : tsend;
    const r = { name, events: events.length, head0: h0, head1: h1, camTotal: +prog.total.toFixed(4), moveStartMs: prog.t0 == null ? null : +(prog.t0 - w0).toFixed(1), moveEndMs: +(prog.t1 - w0).toFixed(1), p10: H.tAt(prog, .1, w0), p50: H.tAt(prog, .5, w0), p90: H.tAt(prog, .9, w0), p99: H.tAt(prog, .99, w0), frameN: fr.length, ...extra };
    const sm = H.samplesOf(prog, 40); if (sm.length) { r.fit = H.fitBezier(sm); r.named = H.bestNamed(sm); r.curve = sm.filter((_, i) => i % 2 === 0).map(x => +x[1].toFixed(3)); }
    // peak speed (world units / s) and when
    let vmax = 0, tv = 0; for (let i = 1; i < fr.length; i++) { const a = camPos(fr[i]), b = camPos(fr[i - 1]); if (!a || !b) continue; const v = H.dist(a, b) / (fr[i][0] - fr[i - 1][0]) * 1000; if (v > vmax) { vmax = v; tv = fr[i][0] - w0; } }
    r.vmax = +vmax.toFixed(2); r.tVmax = +tv.toFixed(0);
    // text watch: first frame opacity changes per watched selector
    r.watchFirstChange = WATCH.map((sel, k) => { const a = fr.findIndex((f, i) => i && f[6][k] && fr[i - 1][6][k] && (f[6][k][0] !== fr[i - 1][6][k][0] || f[6][k][1] !== fr[i - 1][6][k][1])); return a < 0 ? null : [sel, +(fr[a][0] - w0).toFixed(0)]; });
    res[name] = r;
    L.writeJson(path.join(out, name + '.frames.json'), { events, wheels: d.w, frames: fr.map(f => [f[0], f[1], f[4], f[5], f[6]]) });
    console.log(name, JSON.stringify({ head0: r.head0, head1: r.head1, total: r.camTotal, start: r.moveStartMs, end: r.moveEndMs, p50: r.p50, p90: r.p90, fit: r.fit && r.fit.css, rmse: r.fit && r.fit.rmse, named: r.named && r.named.name, vmax: r.vmax, tVmax: r.tVmax }));
    await page.waitForTimeout(1500);
    return r;
  };
  if (exps.includes('explore')) {
    res.uniforms = await page.evaluate(() => window.__HT.seen);
    res.dom = await page.evaluate(() => ({ title: document.title, lenisCls: (document.querySelector('.lenis') || {}).className, dpr: devicePixelRatio, canvases: [...document.querySelectorAll('canvas')].map(c => [c.width, c.height]), bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500) }));
    await page.screenshot({ path: path.join(out, 'explore.jpg'), type: 'jpeg', quality: 70 });
    console.log('explore', JSON.stringify(res.uniforms).slice(0, 300));
  }
  let step = 0;
  const settle = () => page.waitForTimeout(2500);
  if (exps.includes('notch')) { await run('notch1', [[200, 100]], 4500); await settle(); await run('notch2', [[200, 100]], 4500); await settle(); }
  if (exps.includes('tiny')) { await run('tiny4', [[200, 4]], 3500); await settle(); await run('tiny30', [[200, 30]], 3500); await settle(); }
  if (exps.includes('queue')) {
    await run('twoQuick', [[200, 100], [700, 100]], 6500); await settle();
    await run('five100ms', [0, 1, 2, 3, 4].map(i => [200 + i * 100, 100]), 9500); await settle();
  }
  if (exps.includes('back')) { await run('backNotch', [[200, -100]], 4500); await settle(); await run('backNotch2', [[200, -100]], 4500); await settle(); }
  if (exps.includes('stream')) { await run('stream4s', Array.from({ length: 80 }, (_, i) => [200 + i * 50, 100]), 12000); await settle(); }
  L.writeJson(path.join(out, 'home.json'), res);
  console.log('json', L.abs(path.join(out, 'home.json')));
  L.printLog(s.log);
  return 0;
});
