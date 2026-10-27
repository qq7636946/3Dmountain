'use strict';
/* hubtown-map.cjs — maps the Hubtown home scroll film: scroll length, per-position camera / headline / nav state, speed of the
   camera per scroll pixel (continuity across chapter boundaries), and (optionally) a frame sheet.
   Usage: node scripts/index1-5/probes/smooth/hubtown-map.cjs [--step 150] [--shots 0|1] [--out NAME] [--url https://hubtown.co.in/]
   Output: .qa/index1-5/smooth/<NAME>/map.json. Numbers + our own screenshots only. */
const H = require('./ht-lib.cjs');
const { L, path } = H;

L.main('hubtown-map', { usage: 'hubtown-map.cjs [--step 150] [--shots 0|1] [--out NAME]', timeout: 1200, spec: { step: 'value', shots: 'value', out: 'value', url: 'value' } }, async o => {
  const step = Number(o.step) || 150, shots = Number(o.shots || 0);
  const out = path.join(L.QA_DIR, 'smooth', String(o.out || 'hubtown-map'));
  const s = await H.openHubtown('hubtown-map', o, o.url || 'https://hubtown.co.in/');
  const { page } = s;
  await page.waitForFunction(() => !!document.body && /SCROLL TO EXPLORE|NEXT/i.test(document.body.innerText) && !!window.__HT && Object.keys(window.__HT.seen).length > 3, null, { timeout: 120000, polling: 500 });
  await page.waitForTimeout(5000);
  await page.mouse.move(720, 450);
  const geo = await page.evaluate(() => {
    const el = document.querySelector('.js-page-scroll') || document.querySelector('.lenis');
    const kids = [...el.querySelectorAll('*')].filter(e => e.getBoundingClientRect().height > 300 && e.parentElement && (e.parentElement === el || e.parentElement.parentElement === el || e.parentElement.parentElement.parentElement === el)).slice(0, 20).map(e => [e.tagName + '.' + String(e.className).slice(0, 50), Math.round(e.getBoundingClientRect().top + el.scrollTop), Math.round(e.getBoundingClientRect().height), getComputedStyle(e).position]);
    return { sel: el.className.slice(0, 60), sh: el.scrollHeight, ch: el.clientHeight, st: el.scrollTop, kids };
  });
  console.log('geo', JSON.stringify(geo).slice(0, 900));
  const res = { geo, step, samples: [] };
  const maxSt = geo.sh - geo.ch;
  const state = () => page.evaluate(() => {
    const el = document.querySelector('.js-page-scroll') || document.querySelector('.lenis'), P = window.__HT;
    const vis = []; const w = document.createTreeWalker(document.querySelector('#__nuxt'), NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const t = n.textContent.trim(); if (t.length < 3) continue; const e = n.parentElement; if (e.closest('nav,header,footer')) continue; const r = e.getBoundingClientRect(); if (r.width < 2 || r.bottom < 0 || r.top > innerHeight) continue; let o = 1, x = e; while (x && x !== document.body) { o *= +getComputedStyle(x).opacity; x = x.parentElement; } if (o > 0.05) vis.push([t.slice(0, 30), +o.toFixed(2), Math.round(r.top)]); }
    const view = P.view, cam = P.cam;
    return { st: el.scrollTop, cam, view: view && view.map(v => +v.toFixed(4)), fov: P.proj ? +(2 * Math.atan(1 / P.proj[5]) * 180 / Math.PI).toFixed(2) : null, vis: vis.slice(0, 8) };
  });
  // jump through scroll positions (native scrollTop set; Lenis syncs) and read the state after the frame settles
  for (let y = 0; y <= maxSt + step; y += step) {
    const yy = Math.min(y, maxSt);
    await page.evaluate(v => { const el = document.querySelector('.js-page-scroll') || document.querySelector('.lenis'); el.scrollTop = v; }, yy);
    await page.waitForTimeout(shots ? 900 : 260);
    const st = await state(); st.y = yy; res.samples.push(st);
    if (shots && (res.samples.length - 1) % shots === 0) await page.screenshot({ path: path.join(out, `y-${String(yy).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 70 });
    if (yy >= maxSt) break;
  }
  L.writeJson(path.join(out, 'map.json'), res);
  // brief print: y, camera, headline words
  let prev = null;
  for (const m of res.samples) { const c = m.cam; const d = prev && c && prev.cam ? H.dist(c, prev.cam) : 0; console.log(String(m.y).padStart(6), c ? c.map(v => v.toFixed(2)).join(',') : '-', 'd=' + d.toFixed(2), 'fov=' + m.fov, m.vis.map(v => v[0].slice(0, 22)).join(' / ')); prev = m; }
  console.log('json', L.abs(path.join(out, 'map.json')));
  L.printLog(s.log);
  return 0;
});
