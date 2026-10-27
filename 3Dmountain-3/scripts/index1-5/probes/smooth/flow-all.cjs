'use strict';
/* flow-all.cjs — flow.cjs's whole-page real-wheel run (top → footer → top at a steady cadence), but recording EVERY clock each frame
   (journey progress, bridge amount, cards strip target, world y, world open flags) so that "dead" stretches are real ones:
   a frame is dead when none of the clocks moved while a wheel notch arrived in the last 260 ms.
   Prints: per direction the dead stretches ≥ 100 ms (with the section state around them), the frame-time hitches, and a
   notch-weighted speed of the whole page (all clocks normalised to "notches of travel") around every section boundary.
   Usage: node scripts/index1-5/probes/smooth/flow-all.cjs [--interval 120] [--delta 100] [--phone] [--dir both|down|up] [--out NAME] [--query "&smooth=classic"]
   Output: .qa/index1-5/<NAME>/flow-all.json */
const path = require('node:path');
const L = require('../../lib.cjs');

const RECORDER = () => {
  const S = window.__MONTIS_STUDY__, rows = [], R = window.__FA__ = { rows, last: -1e9, on: true, wheels: [] };
  addEventListener('wheel', e => { R.last = performance.now(); R.wheels.push(R.last); }, { capture: true, passive: true });
  let prev = performance.now();
  const tick = now => {
    if (!R.on) return;
    const j = S.journey, P = S.portfolio, W = S.world; let y = 0, wo = 0;
    try { if (W && W.open) { y = W.state.y; wo = 1; } } catch { }
    rows.push([Math.round(now * 10) / 10, Math.round((now - prev) * 10) / 10, j.progress, P ? (P.transition || 0) : 0, P ? (P.strip || 0) : 0, y, P && P.open ? 1 : 0, wo, now - R.last < 260 ? 1 : 0]);
    prev = now; requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

L.main('flow-all', { usage: 'flow-all.cjs [--interval 120] [--delta 100] [--dir both|down|up] [--max 900] [--w --h --phone] [--out NAME] [--query Q]', timeout: 1800,
  spec: { interval: 'value', delta: 'value', dir: 'value', max: 'value', w: 'value', h: 'value', phone: 'bool', query: 'value', out: 'value' } }, async o => {
  const every = Number(o.interval) || 120, delta = Number(o.delta) || 100, maxN = Number(o.max) || 900, dir = String(o.dir || 'both');
  const out = L.outDir('flow-all', o.out);
  const s = await L.openSession('flow-all', o, { autoplay: true });
  const { page, vp } = s; await page.waitForTimeout(1500);
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.evaluate(RECORDER);
  const state = () => page.evaluate(() => { const S = window.__MONTIS_STUDY__, j = S.journey, W = S.world; let y = 0, maxY = 0, open = false; try { if (W && W.open) { open = true; y = W.state.y; maxY = W.state.maxY; } } catch { } return { p: j.progress, max: j.max, open, y, maxY }; });
  const run = async sign => {
    let n = 0, still = 0, prev = null; const t0 = Date.now();
    for (; n < maxN; n++) {
      await page.mouse.wheel(0, sign * delta); await page.waitForTimeout(every);
      if (n % 5 === 4) { const st = await state(), key = JSON.stringify([Math.round(st.p * 1000), st.open, Math.round(st.y)]); const atEnd = sign > 0 ? (st.open && st.maxY > 0 && st.y >= st.maxY - 2) : (!st.open && st.p < .002); still = key === prev ? still + 1 : 0; prev = key; if (atEnd || still >= 6) break; }
    }
    await page.waitForTimeout(1600); return { notches: n, ms: Date.now() - t0 };
  };
  const res = {}; let cut = 0;
  if (dir !== 'up') res.down = await run(1);
  cut = await page.evaluate(() => window.__FA__.rows.length);
  if (dir !== 'down') { if (dir === 'up') await page.evaluate(() => { const j = window.__MONTIS_STUDY__.journey; j.target = j.max; }); res.up = await run(-1); }
  const data = await page.evaluate(() => { window.__FA__.on = false; return window.__FA__.rows; });
  const split = { down: data.slice(0, cut), up: data.slice(cut) };
  // unit of one notch per clock (so different sections are comparable): journey 0.1307·gain, bridge 0.1, strip ≈ 1/steps of the strip (unknown → skip), world 100 px
  const gain = await page.evaluate(() => (window.__FEEL__ && window.__FEEL__.gain()) || 1);
  const U = { j: .1307 * gain, b: .1, y: 100 };
  const report = { viewport: vp, gain: +gain.toFixed(3), notchMs: every };
  const secOf = r => r[7] ? 'world' : r[6] ? (r[3] < .999 ? 'bridge' : 'cards') : 'journey';
  for (const k of ['down', 'up']) {
    const rows = split[k]; if (!rows.length) continue;
    const dead = [], hitch = []; let d0 = -1;
    const moved = i => Math.abs(rows[i][2] - rows[i - 1][2]) > 2e-5 || Math.abs(rows[i][3] - rows[i - 1][3]) > 2e-5 || Math.abs(rows[i][4] - rows[i - 1][4]) > 2e-5 || Math.abs(rows[i][5] - rows[i - 1][5]) > .02;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1] > 25) hitch.push({ t: Math.round(rows[i][0]), ms: rows[i][1], sec: secOf(rows[i]), p: +rows[i][2].toFixed(3), y: Math.round(rows[i][5]) });
      const still = !moved(i) && rows[i][8];
      if (still && d0 < 0) d0 = i;
      if ((!still || i === rows.length - 1) && d0 >= 0) { const ms = rows[i][0] - rows[d0][0]; if (ms >= 100) dead.push({ t: Math.round(rows[d0][0]), ms: Math.round(ms), sec: secOf(rows[d0]), p: +rows[d0][2].toFixed(3), tr: +rows[d0][3].toFixed(3), strip: +rows[d0][4].toFixed(3), y: Math.round(rows[d0][5]) }); d0 = -1; }
    }
    // whole-page speed in notches / s around each boundary (window 250 ms before / after the first frame of the new section)
    const bnd = [];
    for (let i = 1; i < rows.length; i++) if (secOf(rows[i]) !== secOf(rows[i - 1])) {
      const t = rows[i][0], spd = (lo, hi) => { const a = rows.filter(r => r[0] >= t + lo && r[0] < t + hi); if (a.length < 2) return null; const f = a[0], l = a[a.length - 1], dt = (l[0] - f[0]) / 1000;
        return +(((Math.abs(l[2] - f[2]) / U.j + Math.abs(l[3] - f[3]) / U.b + Math.abs(l[5] - f[5]) / U.y) / dt)).toFixed(2); };
      bnd.push({ at: Math.round(t), from: secOf(rows[i - 1]), to: secOf(rows[i]), before: spd(-250, 0), after: spd(0, 250) });
    }
    const dts = rows.map(r => r[1]).slice(1).sort((a, b) => a - b), q = p => dts[Math.min(dts.length - 1, Math.floor(dts.length * p))];
    report[k] = { notches: res[k].notches, frames: rows.length, p50: q(.5), p95: q(.95), worst: dts[dts.length - 1], hitches: hitch, dead, boundaries: bnd };
    console.log(`== ${k}: ${res[k].notches} notches, ${rows.length} frames, p95 ${q(.95)} ms, worst ${dts[dts.length - 1]} ms`);
    console.log('  hitches > 25 ms:', hitch.map(h => `${h.ms}ms ${h.sec}@${h.sec === 'world' ? h.y + 'px' : h.p}`).join(' | ') || 'none');
    console.log('  dead stretches ≥ 100 ms (all clocks still, wheel arriving):', dead.map(d => `${d.ms}ms ${d.sec}@${d.sec === 'world' ? d.y + 'px' : d.sec === 'journey' ? d.p : d.sec === 'bridge' ? d.tr : d.strip}`).join(' | ') || 'none');
    console.log('  boundaries (notches/s of whole-page travel, 250 ms before → after):', bnd.map(b => `${b.from}→${b.to} ${b.before}→${b.after}`).join(' | '));
  }
  L.writeJson(path.join(out, 'flow-all.json'), report);
  console.log('json', L.abs(path.join(out, 'flow-all.json')));
  L.printLog(s.log);
  return 0;
});
