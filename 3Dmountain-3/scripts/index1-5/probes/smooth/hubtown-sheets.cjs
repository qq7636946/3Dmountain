'use strict';
/* hubtown-sheets.cjs — frame evidence for the Hubtown home film (our own screenshots; nothing downloaded from the site):
     static   settled frames at fixed scroll positions (every --every px)
     live     a real-speed wheel scroll through a cut while screenshots run back to back (time-stamped), plus a DOM watch of
              every text element's opacity / transform / clip-path (text reveal recipe)
   Usage: node scripts/index1-5/probes/smooth/hubtown-sheets.cjs [--mode static,live] [--every 1200] [--cuts 3000,6000,13400,14200] [--out NAME]
   Output: .qa/index1-5/smooth/<NAME>/ (jpg frames + live-*.json) */
const H = require('./ht-lib.cjs');
const { L, path } = H;

L.main('hubtown-sheets', { usage: 'hubtown-sheets.cjs [--mode static,live] [--every 1200] [--cuts a,b,c] [--out NAME]', timeout: 1500, spec: { mode: 'value', every: 'value', cuts: 'value', out: 'value', rate: 'value' } }, async o => {
  const modes = String(o.mode || 'static,live').split(','), every = Number(o.every) || 1200;
  const cuts = String(o.cuts || '3000,5600,13600,14300,20300').split(',').map(Number), rate = Number(o.rate) || 1500;
  const out = path.join(L.QA_DIR, 'smooth', String(o.out || 'hubtown-sheets'));
  const s = await H.openHubtown('hubtown-sheets', o);
  const { page } = s;
  await page.waitForFunction(() => !!document.body && /SCROLL TO EXPLORE|NEXT/i.test(document.body.innerText) && !!window.__HT && Object.keys(window.__HT.seen).length > 3, null, { timeout: 120000, polling: 500 });
  await page.waitForTimeout(5000);
  await page.mouse.move(720, 450);
  const setY = y => page.evaluate(v => { document.querySelector('.js-page-scroll').scrollTop = v; }, y);
  const cells = [];
  if (modes.includes('static')) {
    const max = 24360;
    for (let y = 0; y <= max + 1; y += every) {
      const yy = Math.min(y, max); await setY(yy); await page.waitForTimeout(2200);
      const f = path.join(out, `static-${String(yy).padStart(5, '0')}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 72 });
      const st = await page.evaluate(() => ({ cam: window.__HT.cam, st: document.querySelector('.js-page-scroll').scrollTop, head: [...document.querySelectorAll('h1,h2,h3')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 50 && r.top < innerHeight && r.bottom > 0 && !e.closest('nav,header'); }).map(e => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)) }));
      cells.push({ label: `y ${yy} (${(yy / 900).toFixed(1)} screens)`, file: f, st });
      console.log('static', yy, JSON.stringify(st).slice(0, 160));
    }
    L.writeJson(path.join(out, 'static.json'), cells.map(c => ({ label: c.label, file: path.basename(c.file), st: c.st })));
  }
  if (modes.includes('live')) {
    for (const y0 of cuts) {
      await setY(y0); await page.waitForTimeout(2500);
      await page.evaluate(() => {
        const P = window.__HT; P.start([]); P.snap = [];
        // text-element watch: every ~60 ms, opacity / transform / clip of each text-bearing element in the page overlay
        const els = []; const w = document.createTreeWalker(document.querySelector('#__nuxt'), NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { if (n.textContent.trim().length > 2 && n.parentElement && !els.includes(n.parentElement)) els.push(n.parentElement); }
        P.els = els.slice(0, 400);
        P.tid = setInterval(() => { const t = performance.now(); const row = []; P.els.forEach((e, i) => { const cs = getComputedStyle(e); let o = 1, x = e; while (x && x !== document.body) { o *= +getComputedStyle(x).opacity; x = x.parentElement; } row.push([i, +o.toFixed(3), cs.transform === 'none' ? '' : cs.transform.replace('matrix(', '').replace(')', ''), cs.clipPath !== 'none' ? cs.clipPath : '']); }); P.snap.push([+t.toFixed(0), row]); }, 60);
        P.labels = P.els.map(e => (e.textContent || '').trim().slice(0, 28) + ' <' + e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0].slice(0, 20) + '>');
      });
      const delta = rate * 0.04, n = Math.ceil(2600 / delta), events = Array.from({ length: n }, (_, i) => [100 + i * 40, delta]);
      const sendP = page.evaluate(([e, d]) => window.__HT.send(e, d), [events, 100 + n * 40 + 2500]);
      const shots = []; const tEnd = Date.now() + 100 + n * 40 + 2200; let k = 0;
      while (Date.now() < tEnd) {
        const info = await page.evaluate(() => ({ t: +performance.now().toFixed(0), st: Math.round(document.querySelector('.js-page-scroll').scrollTop) }));
        const f = path.join(out, `live-${y0}-${String(k).padStart(2, '0')}.jpg`);
        await page.screenshot({ path: f, type: 'jpeg', quality: 62 }); shots.push({ ...info, file: path.basename(f) }); k++;
      }
      await sendP;
      const d = await page.evaluate(() => { const P = window.__HT; clearInterval(P.tid); P.stop(); return { snap: P.snap, labels: P.labels, frames: P.frames.map(x => [x[0], x[1], x[4], x[5]]), ulog: P.ulog, w: P.wheels }; });
      L.writeJson(path.join(out, `live-${y0}.json`), { y0, rate, shots, ...d });
      console.log('live', y0, 'shots', shots.length, 'st', shots[0].st, '→', shots[shots.length - 1].st);
    }
  }
  L.printLog(s.log);
  return 0;
});
