'use strict';
/* ours-notch.cjs — the same single-notch / five-notch / stop measurement as the Hubtown study, on OUR index1-5 (real wheel
   events through Playwright, per-frame clocks of whatever section is on screen). Read-only: nothing on the page is changed.
   Sections: journey (--p 0.3,3.6,8.9,11.13), bridge (from journey max), cards strip, world (g:0.5,h:1,logo l:0.5).
   Usage: node scripts/index1-5/probes/smooth/ours-notch.cjs [--p 0.3,3.6,8.9,11.13] [--world 1] [--out NAME]
   Output: .qa/index1-5/smooth/<NAME>/ours.json + one stdout line per test:
     t63/t95/t99 = ms after the wheel event until the clock has covered 63/95/99 % of its final move; first = ms until it moves at all;
     peakAt = ms until peak speed (a critically damped spring starts at zero speed, an exponential lerp does not). */
const path = require('node:path');
const L = require('../../lib.cjs');

const REC = () => {
  const S = window.__MONTIS_STUDY__, R = window.__R = { rows: [], wheels: [], on: true };
  addEventListener('wheel', e => R.wheels.push([performance.now(), e.deltaY]), { capture: true, passive: true });
  const tick = now => {
    if (!R.on) return;
    const j = S.journey, P = S.portfolio, W = S.world; let y = 0;
    try { if (W && W.open) y = W.state.y; } catch { }
    R.rows.push([now, j.progress, P ? (P.transition || 0) : 0, P ? (P.strip || 0) : 0, y, P && P.open ? 1 : 0, W && W.open ? 1 : 0]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

function metrics(rows, wheels, col, label) {
  if (!wheels.length) return { label, error: 'no wheel' };
  const tw = wheels[0][0], tl = wheels[wheels.length - 1][0];
  const r = rows.filter(x => x[0] >= tw - 50), c0 = r[0][col], c1 = r[r.length - 1][col], tot = c1 - c0;
  const rel = q => { const x = r.find(x => x[0] >= tw && Math.abs(x[col] - c0) >= q * Math.abs(tot)); return x ? Math.round(x[0] - tw) : null; };
  const out = { label, total: +tot.toFixed(4), first: rel(.01), t63: rel(.632), t95: rel(.95), t99: rel(.99), wheels: wheels.length };
  let vmax = 0, at = 0; for (let i = 1; i < r.length; i++) { const v = (r[i][col] - r[i - 1][col]) / (r[i][0] - r[i - 1][0]) * 1000; if (Math.abs(v) > Math.abs(vmax)) { vmax = v; at = r[i][0] - tw; } }
  out.peakSpeed = +vmax.toFixed(4); out.peakAt = Math.round(at);
  if (wheels.length > 1) { const ra = r.filter(x => x[0] >= tl); const a0 = ra[0][col], rem = c1 - a0; const f = q => { const x = ra.find(x => Math.abs(x[col] - a0) >= q * Math.abs(rem)); return x ? Math.round(x[0] - tl) : null; }; out.afterLast = { remaining: +rem.toFixed(4), pctOfTotal: +(rem / tot * 100).toFixed(1), t63: f(.632), t95: f(.95), t99: f(.99) }; }
  return out;
}

L.main('ours-notch', { usage: 'ours-notch.cjs [--p 0.3,3.6,8.9,11.13] [--world 1] [--out NAME]', timeout: 900, spec: { p: 'value', world: 'value', only: 'value', pts: 'value', out: 'value', query: 'value', w: 'value', h: 'value' } }, async o => {
  const ps = String(o.p || '0.3,3.6,8.9,11.13').split(',').map(Number), out = path.join(L.QA_DIR, 'smooth', String(o.out || 'ours-notch'));
  const s = await L.openSession('ours-notch', o, { autoplay: true });
  const { page, vp } = s; await page.waitForTimeout(1500);
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.evaluate(REC);
  const res = { viewport: vp, tests: [] };
  const run = async (name, col, notches, gap, wait) => {
    await page.evaluate(() => { window.__R.rows.length = 0; window.__R.wheels.length = 0; });
    await page.waitForTimeout(250);
    for (let i = 0; i < notches; i++) { await page.mouse.wheel(0, 100); if (i < notches - 1) await page.waitForTimeout(gap); }
    await page.waitForTimeout(wait);
    const d = await page.evaluate(() => ({ rows: window.__R.rows.slice(), wheels: window.__R.wheels.slice() }));
    const m = metrics(d.rows, d.wheels, col, name); res.tests.push(m);
    console.log(JSON.stringify(m)); return m;
  };
  // journey (column 1 = progress, in journey units; one notch = 100 / max(720, 0.85 H))
  const only = String(o.only || '');
  if (!only) for (const p of ps) {
    await L.fly(page, p); await page.waitForTimeout(1800);
    await run(`journey p${p} · 1 notch`, 1, 1, 0, 3500);
    await L.fly(page, p); await page.waitForTimeout(1500);
    await run(`journey p${p} · 5 notches @100ms`, 1, 5, 100, 3500);
  }
  // bridge → cards: from the journey end
  if (!only) {
  await L.fly(page, 'max'); await page.waitForTimeout(2500);
  const st = await L.readState(page); res.state = st;
  await run('bridge · 1 notch', 2, 1, 0, 3500);
  await run('bridge · 5 notches @100ms', 2, 5, 100, 4000);
  for (let i = 0; i < 18; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(140); }
  await page.waitForTimeout(2500);
  res.afterBridge = await L.readState(page); console.log('after bridge', JSON.stringify(res.afterBridge));
  await run('cards strip · 1 notch', 3, 1, 0, 3500);
  await run('cards strip · 5 notches @100ms', 3, 5, 100, 4000);
  }
  if (String(o.world) !== '0') {
    try {
      const w = await L.enterWorld(page, vp); res.world = w.state;
      await page.evaluate(() => { window.__R.rows.length = 0; });
      for (const pt of String(o.pts || 'g:0.5,h:1,h:3').split(',')) {
        const y = L.worldY(w.state, pt); await L.jumpWorld(page, y); await page.waitForTimeout(2500);
        await run(`world ${pt} (y ${Math.round(y)}) · 1 notch`, 4, 1, 0, 3500);
        await L.jumpWorld(page, y); await page.waitForTimeout(2500);
        await run(`world ${pt} · 5 notches @100ms`, 4, 5, 100, 3500);
      }
    } catch (e) { res.worldError = String(e.message || e); console.log('world skipped', res.worldError); }
  }
  L.writeJson(path.join(out, 'ours.json'), res);
  console.log('json', L.abs(path.join(out, 'ours.json')));
  L.printLog(s.log);
  return 0;
});
