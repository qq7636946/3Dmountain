'use strict';
/* LOGO 收尾（logo seal）效能。兩種情境（環境變數 LOGOSEAL_SCENARIO）：
   continuous（預設）：從海洋第 1 章用真實滾輪「連續快速」一路滾進區塊、穿過波浪／旋轉／停留到頁尾，中間完全不停（最壞情況）。
   reading：滾到第 4 章停下來讀 3 秒，再連續滾過區塊。
   記錄：所有長任務（>50 ms；對到湖景建置／預熱的哪一步）、幀間隔（>34 ms 的幀數、最大值、平均）分段（海洋／波浪／旋轉／停留／頁尾）、
   建置各步驟耗時與湖景什麼時候就緒（捲到哪裡）。通過條件：區塊相關的長任務（log 對得到的）= 0，且區塊內幀時間無慢幀。
   用法：node scripts/index1-5/probe.cjs --world [--phone] --script scripts/index1-5/probes/logo-seal-perf.probe.cjs --out logo-seal-perf */
module.exports = async ({ page, L, vp, world }) => {
  // with ?logoseal=0 this is the baseline: the same scroll, the page without the block (its own long tasks are not ours)
  const la = world.logo && world.logo.at || { logo: world.at.footer, w0: world.at.footer, w1: world.at.footer, s1: world.at.footer, end: world.at.footer };
  const scenario = process.env.LOGOSEAL_SCENARIO || 'continuous';
  await L.jumpWorld(page, scenario === 'reading' ? L.worldY(world, 'h:2') : L.worldY(world, 'h:0') + 4);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const P = window.__lp = { frames: [], long: [], wheels: [], readyAt: null };
    addEventListener('wheel', () => P.wheels.push(performance.now()), { passive: true, capture: true });
    new PerformanceObserver(list => { for (const e of list.getEntries()) P.long.push([e.startTime, e.duration]); }).observe({ entryTypes: ['longtask'] });
    const vpEl = document.querySelector('.fiw-viewport');
    let prev = performance.now();
    (function tick(now) {
      P.frames.push([Math.round(now), +(now - prev).toFixed(1), Math.round(vpEl.scrollTop)]); prev = now;
      if (P.readyAt === null && window.__MONTIS_STUDY__.world.state.logo?.ready) P.readyAt = [Math.round(now), Math.round(vpEl.scrollTop)];
      requestAnimationFrame(tick);
    })(prev);
  });
  await page.mouse.move(vp.width / 2, vp.height / 2);
  const yNow = () => page.evaluate(() => window.__MONTIS_STUDY__.world.state.yt);
  let guard = 0;
  const wheelTo = async (target, step, gap) => { for (; guard < 600 && (await yNow()) < target; guard++) { await page.mouse.wheel(0, step); await page.waitForTimeout(gap); } };
  let readFrom = 0;
  if (scenario === 'reading') {
    await wheelTo(L.worldY(world, 'h:3') - 20, 100, 45);
    readFrom = await page.evaluate(() => Math.round(performance.now()));
    await page.waitForTimeout(3000);
  }
  await wheelTo(la.end + vp.height * 0.3, 100, 30);
  await page.waitForTimeout(1500);
  const res = await page.evaluate(({ la, readFrom }) => {
    const P = window.__lp, st = window.__MONTIS_STUDY__.world.state.logo || {}, f = P.frames.slice(5), log = st.log || [];
    const phase = y => y < la.logo - 6000 ? 'ocean' : y < la.w0 ? 'ocean' : y < la.w1 ? 'wave' : y < la.s1 ? 'spin' : y <= la.end + 2 ? 'hold' : 'footer';
    const by = {};
    for (const [t, dt, y] of f) { const k = phase(y), o = by[k] || (by[k] = { n: 0, sum: 0, max: 0, slow: 0 }); o.n++; o.sum += dt; o.max = Math.max(o.max, dt); if (dt > 34) o.slow++; }
    for (const o of Object.values(by)) { o.avg = +(o.sum / o.n).toFixed(1); o.max = +o.max.toFixed(1); delete o.sum; }
    const frameY = t => { let best = f[0]; for (const r of f) if (r[0] <= t + 1) best = r; return best ? best[2] : 0; };
    const scrolling = (s, d) => P.wheels.some(w => w > s - 150 && w < s + d + 60);
    const long = P.long.filter(([s, d]) => d > 50).map(([s, d]) => {
      const mine = log.filter(([n, t0, dur]) => t0 < s + d + 5 && t0 + dur > s - 5).map(([n, t0, dur]) => n + ' ' + dur + 'ms');
      return { at: Math.round(s), ms: Math.round(d), y: frameY(s), phase: phase(frameY(s)), whileScrolling: scrolling(s, d), logoStep: mine.join(', ') || null };
    });
    return { frames: f.length, by, long, readyAt: P.readyAt, timings: st.timings, log: log.map(([n, t0, d]) => n + ':' + d), built: st.built, phase: st.phase, plan: la };
  }, { la, readFrom });
  const mine = res.long.filter(x => x.logoStep && !/whole step/.test(x.logoStep.replace(/, .*/, '')) || /warm|lake|compile|texture|targets|link/.test(x.logoStep || '') && !/whole step$/.test(x.logoStep || '')), other = res.long.filter(x => !mine.includes(x));
  const inBlock = Object.entries(res.by).filter(([k]) => k !== 'ocean').reduce((n, [, v]) => n + v.slow, 0);
  return {
    ok: mine.length === 0 && inBlock === 0 && (!!res.timings || !world.logo),
    scenario, longTasks: res.long.length, longFromLogoSeal: mine.length, longOther: other.length, maxLongFromLogoSeal: mine.reduce((m, x) => Math.max(m, x.ms), 0), slowFramesInBlock: inBlock,
    ...res, plan: undefined
  };
};
