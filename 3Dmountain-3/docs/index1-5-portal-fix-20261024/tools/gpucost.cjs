'use strict';
/* gpucost.cjs — frame time of the portal card with the frame-rate cap OFF (so the GPU cost shows instead of the 120 fps cap).
   node scripts/index1-5/with-lock.cjs "node docs/index1-5-portal-fix-20261024/tools/gpucost.cjs [--phone] [--at 4.5,4.6,4.7,4.73] [--frames 240]"
   For each variant (old = portalFix 0, new = portalFix 1) and parked position: median / p95 / mean frame interval over N frames.
   Also the per-frame times of a scripted move 4.3 -> 4.8 (journey.target), which includes the camera flight itself. */
const L = require('../../../scripts/index1-5/lib.cjs');
L.main('gpucost', { usage: 'see header', spec: { phone: 'bool', at: 'value', frames: 'value', w: 'value', h: 'value', variants: 'value' }, timeout: 900 }, async o => {
  const at = String(o.at || '4.5,4.6,4.7,4.73').split(',').map(Number), N = +(o.frames || 240), variants = String(o.variants || 'old,new').split(',');
  const browser = await L.launchBrowser({});
  // uncapped rAF: relaunch with the vsync / frame-limit flags
  await browser.close();
  const { chromium } = require(process.env.I15_PLAYWRIGHT || 'C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const b2 = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const s = await L.openSession('gpucost', o, { browser: b2 });
  const { page } = s; const out = [];
  const frames = n => page.evaluate(n => new Promise(res => { const d = []; let last = performance.now(); const tick = t => { d.push(t - last); last = t; if (d.length < n + 5) requestAnimationFrame(tick); else { d.splice(0, 5); d.sort((a, b) => a - b); res({ median: +d[d.length >> 1].toFixed(2), p95: +d[Math.floor(d.length * .95)].toFixed(2), mean: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2), max: +d[d.length - 1].toFixed(2) }); } }; requestAnimationFrame(tick); }), n);
  for (const v of variants) {
    await page.evaluate(v => { const C = window.__MONTIS_STUDY__.CONFIG.openingPortal; C.portalFix = v === 'old' ? 0 : 1; C.portalDebug = 0; window.index4.applyConfig(); }, v);
    for (const p of at) {
      await L.fly(page, p); await page.waitForTimeout(1800);
      const r = await frames(N); out.push({ v, p, ...r }); console.log(v, p, JSON.stringify(r));
    }
    // a scripted move: record every frame
    await L.fly(page, 4.3); await page.waitForTimeout(2500);
    const mv = await page.evaluate(() => new Promise(res => { const d = [], pr = []; let last = performance.now(); const j = window.__MONTIS_STUDY__.journey; j.target = 4.8; const t0 = last; const tick = t => { d.push(+(t - last).toFixed(1)); pr.push(+j.progress.toFixed(3)); last = t; if (t - t0 < 4500 && Math.abs(j.progress - 4.8) > .004 || t - t0 < 700) requestAnimationFrame(tick); else res({ d, pr }); }; requestAnimationFrame(tick); }));
    const sorted = [...mv.d].sort((a, b) => a - b);
    const sum = { n: sorted.length, median: sorted[sorted.length >> 1], p95: sorted[Math.floor(sorted.length * .95)], max: sorted[sorted.length - 1], over20: sorted.filter(x => x > 20).length, over50: sorted.filter(x => x > 50).length };
    out.push({ v, move: sum }); console.log(v, 'move 4.3->4.8', JSON.stringify(sum));
  }
  console.log('RESULT ' + JSON.stringify(out));
  return 0;
});
