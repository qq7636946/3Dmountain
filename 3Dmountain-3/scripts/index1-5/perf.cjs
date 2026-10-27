'use strict';
/* Hitches during one journey move (ported from scratchpad/asc/hitch2.cjs + hitch3.cjs): park at --from, then fly to
   --to while recording long tasks (PerformanceObserver 'longtask') and every frame interval; slow frame = > 34 ms.
   --profile adds a CPU profile: top self-time functions and the call chains sampled inside the long tasks.
   Prints one JSON line; exit 1 if any long task is longer than --limit (default 50 ms). */
const L = require('./lib.cjs');
const USAGE = `perf.cjs — 移動過程的長任務（long task）與掉幀
用法：node scripts/index1-5/perf.cjs --from 8.9 [--to max] [選項]
  --from / --to   起點、終點位置 p（數字或 max；預設 8.9 → max）
  --limit         長任務門檻毫秒（預設 50：任何 >50 ms 的長任務就算失敗）
  --settle        到起點後先等幾毫秒（預設 3000，讓載入工作結束）
  --tail          到終點後再記錄幾毫秒（預設 1500）
  --profile       另外錄 CPU profile，列出最花時間的函式和長任務裡的呼叫鏈（會讓數字稍差）
  --w --h / --phone / --query / --reduced   同 shot.cjs
輸出：一行 JSON {ok, from, to, moveMs, frames, slowFrames, worstFrameMs, p95FrameMs, longTasks:[[開始ms,長度ms]…], maxLongTaskMs}
結束碼：0 沒有超過門檻的長任務｜1 有（或沒到終點、頁面有錯）｜2 指令打錯｜3 超時
注意：無頭 Chrome 的數字只能拿來前後比較，不等於真機。一次只跑一個瀏覽器，數字才準。`;

L.main('perf', {
  usage: USAGE, timeout: 600,
  spec: { from: 'value', to: 'value', limit: 'value', settle: 'value', tail: 'value', profile: 'bool', w: 'value', h: 'value', phone: 'bool', query: 'value', reduced: 'bool' },
}, async o => {
  const from = L.parsePositions(o.from ?? '8.9', 'from')[0], to = L.parsePositions(o.to ?? 'max', 'to')[0];
  const limit = L.opt(o, 'limit', 50, { min: 0 }), settle = L.opt(o, 'settle', 3000, { min: 0 }), tail = L.opt(o, 'tail', 1500, { min: 0 });
  const s = await L.openSession('perf', o);
  const { page, log, context } = s;
  const f0 = await L.fly(page, from);
  if (!f0.ok) throw new Error(`起點 ${L.posName(from)} 沒有到（progress ${f0.progress}）`);
  await page.waitForTimeout(settle);
  let cdp = null, profStart = 0;
  if (o.profile) {
    cdp = await context.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
    profStart = await page.evaluate(() => performance.now());   // ≈ profile.startTime on the page clock (a few ms of IPC)
  }
  await page.evaluate(to => {
    window.__qaLT = []; window.__qaFR = []; window.__qaRun = true;
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__qaLT.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask' }); } catch (e) { window.__qaLTError = String(e); }
    let last = performance.now();
    const tick = t => { window.__qaFR.push([Math.round(t), +(t - last).toFixed(1)]); last = t; if (window.__qaRun && window.__qaFR.length < 20000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__qaT0 = performance.now();
    const j = window.__MONTIS_STUDY__.journey; j.target = to === 'max' ? j.max : Math.min(to, j.max);
  }, to);
  const t0 = Date.now();
  let reached = true;
  await page.waitForFunction(P => { const j = window.__MONTIS_STUDY__.journey; return Math.abs(j.progress - (P === 'max' ? j.max : Math.min(P, j.max))) < .01; }, to, { timeout: 90000, polling: 100 }).catch(() => { reached = false; });
  const moveMs = Date.now() - t0;
  await page.waitForTimeout(tail);
  const r = await page.evaluate(() => { window.__qaRun = false; return { t0: Math.round(window.__qaT0), lt: window.__qaLT, fr: window.__qaFR, ltError: window.__qaLTError || null, origin: performance.timeOrigin, progress: window.__MONTIS_STUDY__.journey.progress }; });
  const d = r.fr.slice(1).map(x => x[1]).sort((a, b) => a - b);
  const pct = q => d.length ? d[Math.min(d.length - 1, Math.floor(d.length * q))] : null;
  const slow = r.fr.slice(1).filter(x => x[1] > 34);
  const out = {
    ok: false, from: L.posName(from), to: L.posName(to), reached, progress: L.round(r.progress), moveMs,
    frames: d.length, slowFrames: slow.length, worstFrameMs: d.length ? d[d.length - 1] : null, p95FrameMs: pct(.95), medianFrameMs: pct(.5),
    longTasks: r.lt.map(([a, b]) => [a - r.t0, b]), maxLongTaskMs: r.lt.reduce((m, x) => Math.max(m, x[1]), 0), limit,
    slowFrameList: slow.slice(0, 20).map(([t, ms]) => [t - r.t0, ms]), url: s.url, viewport: s.vp, errors: L.tally(log.errors),
  };
  if (r.ltError) out.longTaskObserverError = r.ltError;
  if (cdp) {
    const { profile } = await cdp.send('Profiler.stop');
    const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
    for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
    const name = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`;
    const self = new Map(), inLong = new Map(), win = r.lt.map(([a, b]) => [a, a + b]);
    let t = profile.startTime;
    profile.samples.forEach((id, i) => {
      const dt = (profile.timeDeltas[i] || 0); t += dt; const n = byId.get(id); if (!n) return;
      self.set(name(n), (self.get(name(n)) || 0) + dt / 1000);
      const ms = profStart + (t - profile.startTime) / 1000;
      if (win.some(([a, b]) => ms >= a && ms <= b)) {
        const chain = []; let m = n; for (let k = 0; m && k < 6; k++) { chain.push(name(m)); m = byId.get(parent.get(m.id)); }
        const key = chain.join(' < '); inLong.set(key, (inLong.get(key) || 0) + dt / 1000);
      }
    });
    const top = (m, k) => [...m].filter(([n]) => !/^\((idle|program|garbage collector)\)/.test(n)).sort((a, b) => b[1] - a[1]).slice(0, k).map(([n, v]) => `${v.toFixed(0)}ms ${n}`);
    out.profile = { topSelf: top(self, 14), inLongTasks: top(inLong, 10) };
  }
  out.ok = reached && !out.errors.length && !r.lt.some(x => x[1] > limit);
  console.log(JSON.stringify(out));
  if (out.profile) { console.error('top self time:\n  ' + out.profile.topSelf.join('\n  ')); console.error('inside long tasks:\n  ' + out.profile.inLongTasks.join('\n  ')); }
  L.note(out.ok ? 'PASS' : `FAIL: ${!reached ? 'did not reach --to; ' : ''}${out.errors.length ? 'page errors; ' : ''}${r.lt.filter(x => x[1] > limit).length} long task(s) > ${limit} ms`);
  return out.ok ? 0 : 1;
});
