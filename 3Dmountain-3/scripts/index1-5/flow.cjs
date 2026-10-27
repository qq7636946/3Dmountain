'use strict';
/* flow.cjs — whole-page smoothness run: a real mouse wheel at a steady cadence from the top of index1-5 to the footer, then all
   the way back up, recording every frame in the page (frame time, the visible clock of whatever section is on screen, long tasks).
   It answers "where does the page stop, jump or hitch while the visitor keeps scrolling" for both directions.
   Metrics per frame: dt; section (journey / bridge / cards / world); the section's own clock (journey.progress, the cards'
   transition and strip, world.state.y); input (a notch sent in the last 260 ms).
   Events reported:
     hitch  — a frame longer than 25 ms (with the section and clock where it happened)
     stall  — wheel input keeps coming but the visible clock does not move for ≥ 140 ms (outside the true ends)
     jump   — one frame moves the clock more than 4× the median motion of its section (a snap)
   Usage: node scripts/index1-5/flow.cjs [--dir both|down|up] [--interval 120] [--delta 100] [--max 700] [--w --h --phone] [--out NAME]
   Output: .qa/index1-5/<NAME>/flow.json (summary + events + every frame) and one stdout summary line. Exit 1 if any hitch > 50 ms
   or any stall ≥ 300 ms. */
const path = require('node:path');
const L = require('./lib.cjs');

const RECORDER = () => {
  const S = window.__MONTIS_STUDY__, frames = [], longs = [];
  window.__FLOW__ = { frames, longs, lastInput: -1e9, on: true };
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) longs.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: false }); } catch { }
  addEventListener('wheel', () => { window.__FLOW__.lastInput = performance.now(); }, { capture: true, passive: true });
  let last = performance.now();
  const tick = now => {
    if (!window.__FLOW__.on) return;
    const j = S.journey, P = S.portfolio, W = S.world;
    let sec = 'journey', clock = j.progress, y = 0, tr = 0, strip = 0;
    if (P && P.open) { tr = P.transition || 0; strip = P.strip || 0; sec = tr < .999 ? 'bridge' : 'cards'; clock = tr < .999 ? tr : 1 + strip; }
    if (W && W.open) { try { y = W.state.y; } catch { } sec = 'world'; clock = y; }
    frames.push([Math.round(now), Math.round((now - last) * 10) / 10, sec, Math.round(clock * 10000) / 10000, now - window.__FLOW__.lastInput < 260 ? 1 : 0]);
    last = now; requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

function analyse(frames, H) {
  const scale = { journey: 100, bridge: 100, cards: 100, world: 1 / Math.max(1, H) * 100 };  // clock units → % of a screen-ish
  const motion = frames.map((f, i) => i ? Math.abs(f[3] - frames[i - 1][3]) * (scale[f[2]] || 100) * (f[2] !== frames[i - 1][2] ? 0 : 1) : 0);
  const med = {};
  for (const sec of Object.keys(scale)) { const v = motion.filter((m, i) => frames[i][2] === sec && m > 1e-4).sort((a, b) => a - b); med[sec] = v.length ? v[v.length >> 1] : 0; }
  const hitches = [], stalls = [], jumps = [];
  frames.forEach((f, i) => { if (i && f[1] > 25) hitches.push({ t: f[0], ms: f[1], sec: f[2], clock: f[3] }); });
  let s0 = -1;
  for (let i = 1; i < frames.length; i++) {
    const still = motion[i] < 1e-3 && frames[i][4];
    if (still && s0 < 0) s0 = i;
    if ((!still || i === frames.length - 1) && s0 >= 0) { const d = frames[i][0] - frames[s0][0]; if (d >= 140) stalls.push({ t: frames[s0][0], ms: d, sec: frames[s0][2], clock: frames[s0][3] }); s0 = -1; }
    if (med[frames[i][2]] > 0 && motion[i] > med[frames[i][2]] * 4 && motion[i] > .5) jumps.push({ t: frames[i][0], x: Math.round(motion[i] / med[frames[i][2]] * 10) / 10, sec: frames[i][2], clock: frames[i][3] });
  }
  const dts = frames.map(f => f[1]).slice(1).sort((a, b) => a - b);
  const pct = q => dts.length ? dts[Math.min(dts.length - 1, Math.floor(dts.length * q))] : 0;
  return { frames: frames.length, p50: pct(.5), p95: pct(.95), p99: pct(.99), worst: dts[dts.length - 1] || 0, hitches, stalls, jumps, median: med };
}

L.main('flow', {
  usage: 'flow.cjs [--dir both|down|up] [--interval 120] [--delta 100] [--max 700] [--w --h --phone] [--out NAME]', timeout: 1500,
  spec: { dir: 'value', interval: 'value', delta: 'value', max: 'value', w: 'value', h: 'value', phone: 'bool', query: 'value', reduced: 'bool', out: 'value' },
}, async o => {
  const dir = String(o.dir || 'both'), every = Number(o.interval) || 120, delta = Number(o.delta) || 100, maxN = Number(o.max) || 700;
  const out = L.outDir('flow', o.out);
  const s = await L.openSession('flow', o, { autoplay: true });
  const { page, log, vp } = s;
  await page.waitForTimeout(1500);
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.evaluate(RECORDER);
  const state = () => page.evaluate(() => { const S = window.__MONTIS_STUDY__, j = S.journey, W = S.world; let y = 0, maxY = 0, open = false; try { if (W && W.open) { open = true; y = W.state.y; maxY = W.state.maxY; } } catch { } return { p: j.progress, max: j.max, open, y, maxY }; });
  const run = async sign => {
    let n = 0, still = 0, prev = null, t0 = Date.now();
    for (; n < maxN; n++) {
      await page.mouse.wheel(0, sign * delta); await page.waitForTimeout(every);
      if (n % 5 === 4) {
        const st = await state(), key = JSON.stringify([Math.round(st.p * 1000), st.open, Math.round(st.y)]);
        const atEnd = sign > 0 ? (st.open && st.maxY > 0 && st.y >= st.maxY - 2) : (!st.open && st.p < .002);
        still = key === prev ? still + 1 : 0; prev = key;
        if (atEnd || still >= 6) break;
      }
    }
    await page.waitForTimeout(1600);
    return { notches: n, ms: Date.now() - t0, end: await state() };
  };
  const res = {};
  if (dir !== 'up') { await page.evaluate(() => { window.__FLOW__.mark = 'down'; }); res.down = await run(1); }
  const cut = await page.evaluate(() => window.__FLOW__.frames.length);
  if (dir !== 'down') { if (dir === 'up') await page.evaluate(() => { const j = window.__MONTIS_STUDY__.journey; j.target = j.max; }); res.up = await run(-1); }
  const data = await page.evaluate(() => { window.__FLOW__.on = false; return { frames: window.__FLOW__.frames, longs: window.__FLOW__.longs }; });
  const split = { down: data.frames.slice(0, cut), up: data.frames.slice(cut) };
  const summary = { tool: 'flow', url: s.url, viewport: vp, interval: every, delta, longTasks: data.longs.filter(l => l[1] > 50) };
  for (const k of ['down', 'up']) if (res[k]) summary[k] = { ...res[k], ...analyse(split[k], vp.height) };
  L.writeJson(path.join(out, 'flow.json'), { ...summary, frames: split, logs: L.logJson(log) });
  const brief = k => summary[k] && { notches: summary[k].notches, p95: summary[k].p95, worst: summary[k].worst, hitches: summary[k].hitches.length, stalls: summary[k].stalls.length, jumps: summary[k].jumps.length };
  console.log('flow ' + JSON.stringify({ down: brief('down'), up: brief('up'), longTasks: summary.longTasks.length }));
  for (const k of ['down', 'up']) if (summary[k]) {
    const top = [...summary[k].hitches.sort((a, b) => b.ms - a.ms).slice(0, 6).map(e => `hitch ${e.ms}ms ${e.sec}@${e.clock}`), ...summary[k].stalls.sort((a, b) => b.ms - a.ms).slice(0, 6).map(e => `stall ${e.ms}ms ${e.sec}@${e.clock}`), ...summary[k].jumps.slice(0, 6).map(e => `jump ×${e.x} ${e.sec}@${e.clock}`)];
    console.log(k + ': ' + (top.join(' | ') || 'clean'));
  }
  console.log('json', L.abs(path.join(out, 'flow.json')));
  L.printLog(log);
  const bad = ['down', 'up'].some(k => summary[k] && (summary[k].hitches.some(e => e.ms > 50) || summary[k].stalls.some(e => e.ms >= 300)));
  return bad || log.errors.length ? 1 : 0;
});
