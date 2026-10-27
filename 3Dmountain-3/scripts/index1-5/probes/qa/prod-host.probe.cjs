'use strict';
/* QA · "what does a public visitor get?" Loads the page under a NON-local hostname (http://qa-prod.example/ routed to the local server),
   then presses the developer hotkeys (T tuner, L letters panel, C grade panel, M logo panel) and a few more keys and reports which dev UI appears.
   Also reports the typing-while-focused-on-input exceptions and the document-level keys that bypass the journey.
   Run: node scripts/index1-5/probe.cjs --script scripts/index1-5/probes/qa/prod-host.probe.cjs --out qa-prod-host */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp, log }) => {
  const ctx = page.context(); const p2 = await ctx.newPage(); const errs = []; p2.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 200))); p2.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text().slice(0, 200)); });
  await p2.route('http://qa-prod.example/**', async route => { const u = new URL(route.request().url()); try { const r = await route.fetch({ url: 'http://127.0.0.1:5621' + u.pathname + u.search }); await route.fulfill({ response: r }); } catch (e) { await route.abort(); } });
  await p2.setViewportSize({ width: vp.width, height: vp.height });
  await p2.goto('http://qa-prod.example/index1-5.html', { waitUntil: 'commit' });
  await p2.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 150000, polling: 250 });
  await p2.evaluate(async () => { await window.__MONTIS_STUDY__.ready; });
  const probe = () => p2.evaluate(() => {
    const vis = sel => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, w: Math.round(r.width), h: Math.round(r.height), hidden: e.hidden }; };
    return { host: location.hostname, tuning: document.documentElement.dataset.tuning, tuner: vis('#tuner'), tunerRows: document.querySelectorAll('#tunerBody input, #tunerBody button').length, letters: vis('.letters-panel:not(.lgp)'), logoPanel: vis('.lgp'), grade: vis('[class*="grade-panel"], .grade-panel, .fgp'), lettersPanels: [...document.querySelectorAll('.letters-panel')].map(e => e.className.slice(0, 40) + ' hidden=' + e.hidden), bodyTuningClass: document.body.className.slice(0, 80) };
  });
  const out = { initial: await probe() };
  await p2.mouse.move(vp.width / 2, vp.height / 2);
  for (const k of ['t', 'T', 'l', 'c', 'm']) { await p2.keyboard.press(k); await p2.waitForTimeout(k === 'c' || k === 'l' ? 2500 : 700); out['after_' + k] = await probe(); await Q.shot({ screenshot: o => p2.screenshot(o) }, 'prod-host-key-' + k, 60).catch(() => { }); }
  out.errors = errs;
  await p2.close();
  const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'prod-host.json'), JSON.stringify(out, null, 1));
  const anyDev = ['after_t', 'after_T', 'after_l', 'after_c', 'after_m'].some(k => { const o = out[k]; return (o.tuner && o.tuner.display !== 'none' && o.tuner.w > 0) || (o.letters && o.letters.w > 0 && !o.letters.hidden) || (o.logoPanel && o.logoPanel.w > 0 && !o.logoPanel.hidden) || (o.grade && o.grade.w > 0); });
  return { ok: true, devUiReachableByHotkeysOnPublicHost: anyDev, out };
};
