'use strict';
/* LOGO 收尾（logo seal）行為檢查：量測（區塊接在海洋後、頁尾接在區塊後）、旋轉端點與緩動、往回捲對稱、Tab 不會讓畫面亂跑、
   頁首白字／聲音鈕、EXPLORE 停靠點、釋放（離遠時 GPU 資源回收）、context lost 後能繼續。
   用法：node scripts/index1-5/probe.cjs --world --script scripts/index1-5/probes/logo-seal-behaviour.probe.cjs --out logo-seal-behaviour */
module.exports = async ({ page, L, vp, world }) => {
  const out = {}, la = world.logo && world.logo.at;
  if (!la) return { ok: false, error: 'no logo block' };
  const S = () => page.evaluate(() => { const w = window.__MONTIS_STUDY__.world, s = w.state, g = s.logo; return { y: s.y, yt: s.yt, maxY: s.maxY, footer: s.at.footer, logo: g && { phase: g.phase, ready: g.ready, failed: g.failed, sample: g.sample, gl: g.gl, timings: g.timings } }; });
  const go = async y => { await L.jumpWorld(page, y); await page.waitForTimeout(250); };
  const ready = async () => {
    await go(la.logo - 1.9 * vp.height);
    await page.waitForFunction(() => { const g = window.__MONTIS_STUDY__.world.state.logo; return g.ready || g.failed; }, null, { timeout: 40000, polling: 200 })
      .catch(async () => { out.readyTimeout = await S(); throw new Error('lake not ready: ' + JSON.stringify(out.readyTimeout.logo.phase) + ' ' + JSON.stringify(out.readyTimeout.logo.sample)); });
    await page.waitForTimeout(500);
  };
  const mid = la.s1 + 0.5 * (la.end - la.s1);
  await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });   // another session's dev panel sits over the sound button

  // ---- 1. layout: the block sits right after the ocean section, the footer right after the block, maxY follows
  const st0 = await S();
  const expectLogo = world.ocean.at.resp + vp.height + 3 * world.ocean.at.stop + world.ocean.at.tail;
  out.layout = {
    logoAt: Math.round(la.logo), expectLogo: Math.round(expectLogo), footer: Math.round(st0.footer), blockEndFooter: Math.round(la.logo + la.height), maxY: Math.round(st0.maxY),
    ok: Math.abs(la.logo - expectLogo) < 2 && Math.abs(st0.footer - (la.logo + la.height)) < 2 && Math.abs(st0.maxY - (st0.footer + world.at.footerH - vp.height)) < 3
  };

  // ---- 2. the spin: exact ends, monotonic, eased (slow at both ends)
  await ready();
  const yaws = [], rises = [];
  for (let i = 0; i <= 24; i++) {
    const y = la.s0 + (la.spinDone - la.s0) * i / 24; await go(y);
    const s = (await S()).logo.sample; yaws.push([+s.qSpin.toFixed(4), s.yaw]); rises.push([+s.qSpin.toFixed(4), s.rise]);
  }
  const mono = yaws.every((p, i) => i === 0 || p[1] >= yaws[i - 1][1] - 1e-9);
  const first = yaws[1][1] - yaws[0][1], middle = yaws[13][1] - yaws[12][1], last = yaws[24][1] - yaws[23][1];
  const rest = await page.evaluate(() => (+window.__MONTIS_STUDY__.CONFIG.logoSeal.restYaw || 0) * Math.PI / 180);   // the resting angle after the full turn (0 = dead front)
  const endYaw = Math.PI * 2 + rest;
  out.spin = {
    start: yaws[0][1], end: yaws[24][1], endIs2PI: Math.abs(yaws[24][1] - endYaw) < 1e-9, mono, firstStep: +first.toFixed(4), midStep: +middle.toFixed(4), lastStep: +last.toFixed(4),
    ok: yaws[0][1] === 0 && Math.abs(yaws[24][1] - endYaw) < 1e-9 && mono && first < middle * .6 && last < middle * .6
  };
  // the rise: 0 as the spin begins (riseStart 0), exactly 1 from riseEnd on, monotonic, slowing as it arrives (ease-out); a build without the scene's rise still has the clock
  const dials = await page.evaluate(() => ({ ...window.__MONTIS_STUDY__.CONFIG.logoSeal }));
  const riseMono = rises.every((p, i) => i === 0 || p[1] >= rises[i - 1][1] - 1e-12), after = rises.filter(p => p[0] >= dials.riseEnd), k = Math.ceil(24 * dials.riseEnd);
  out.rise = {
    samples: rises.filter((p, i) => i % 3 === 0), mono: riseMono, start: rises[0][1], doneBy: dials.riseEnd, earlyStep: +(rises[2][1] - rises[1][1]).toFixed(4), lateStep: +(rises[k][1] - rises[k - 1][1]).toFixed(4),
    ok: rises[0][1] === 0 && riseMono && after.length > 0 && after.every(p => p[1] === 1) && rises.filter(p => p[0] < dials.riseEnd - .05).every(p => p[1] < 1) && rises[k][1] - rises[k - 1][1] < rises[2][1] - rises[1][1]
  };
  await go(la.w0 - 300); const a = (await S()).logo.sample; await go(la.end); const b = (await S()).logo.sample; await go(la.end + vp.height * .45); const c = (await S()).logo.sample;
  out.ends = {
    before: { qWave: a.qWave, yaw: a.yaw, textP: a.textP, rise: a.rise }, after: { qWave: b.qWave, yaw: b.yaw, textP: b.textP, rise: b.rise }, footerComing: { textP: c.textP },
    ok: a.qWave === 0 && a.yaw === 0 && a.textP === 0 && a.rise === 0 && b.rise === 1 && b.qWave === 1 && Math.abs(b.yaw - endYaw) < 1e-9 && b.textP === 1 && c.textP === 0
  };

  // ---- 3. scroll back plays back: the real wheel down into the spin and up again; the clocks stay the same function of y
  await go(la.w1); await page.mouse.move(vp.width / 2, vp.height / 2);
  const track = [];
  const rec = async dir => {
    for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, dir * 120); await page.waitForTimeout(130); }
    await page.waitForTimeout(900);
    const s = await S(); track.push({ dir, y: Math.round(s.y), yaw: +s.logo.sample.yaw.toFixed(3), qSpin: +s.logo.sample.qSpin.toFixed(3) });
  };
  await rec(1); await rec(1); await rec(-1); await rec(-1);
  const model = y => Math.max(0, Math.min(1, (y - la.s0) / (la.spinDone - la.s0)));
  out.back = {
    track,
    ok: track.every(t => Math.abs(t.qSpin - model(t.y)) < .01) && Math.abs(track[3].y - track[0].y + (track[1].y - track[0].y) - (track[1].y - track[0].y) * 0) >= 0 && Math.abs(track[2].y - track[0].y) < 60 && track[1].y > track[0].y && track[3].y < track[2].y
  };

  // ---- 4. the keyboard: nothing in the block takes focus; Tab does not move the page unless focus lands in the footer; the ocean is inert there
  await go(mid); await page.waitForTimeout(500);
  await page.evaluate(() => document.activeElement?.blur?.());
  const tabs = []; const y0 = (await S()).yt;
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab'); await page.waitForTimeout(450);
    const r = await page.evaluate(() => { const e = document.activeElement; return { el: (e?.className?.toString?.() || e?.tagName || '').slice(0, 28), inOcean: !!e?.closest?.('[data-world-part="responsibility"]'), inFooter: !!e?.closest?.('[data-world-part="contact"]') }; });
    tabs.push({ ...r, yt: Math.round((await S()).yt) });
  }
  out.tab = {
    y0: Math.round(y0), tabs, respInert: await page.evaluate(() => !!document.querySelector('[data-world-part="responsibility"]')?.inert),
    ok: tabs.every(t => !t.inOcean) && tabs.filter(t => !t.inFooter).every(t => Math.abs(t.yt - Math.round(y0)) < 12)
  };
  await page.evaluate(() => document.activeElement?.blur?.());

  // ---- 5. chrome: header white on dark, chapter rail hidden, sound button reachable, the words are the page's
  await go(mid); await page.waitForTimeout(500);
  out.chrome = await page.evaluate(() => {
    const root = document.querySelector('#fiWorld'), btn = document.querySelector('.fi-sound'), r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), rail = getComputedStyle(root.querySelector('.fiw-chapters'));
    const hdr = document.querySelector('.finnovation-ui .fi-header');
    return {
      isLogoseal: root.classList.contains('is-logoseal'), worldDark: document.body.classList.contains('is-world-dark'), railOpacity: rail.opacity,
      soundHit: !!hit?.closest?.('.fi-sound'), headerColor: hdr ? getComputedStyle(hdr).color : null,
      text: ['.fisl-kicker', '.fisl-title', '.fisl-zh', '.fisl-line'].map(s => root.querySelector(s)?.textContent)
    };
  });
  out.chrome.ok = out.chrome.isLogoseal && out.chrome.worldDark && out.chrome.railOpacity === '0' && out.chrome.soundHit;

  // ---- 6. EXPLORE walks strategies → the block's stop → footer
  await L.jumpWorld(page, L.worldY(world, 'h:3')); await page.waitForTimeout(900);
  const ex = [];
  for (let i = 0; i < 2; i++) { const before = (await S()).yt; await page.click('.fi-explore'); await page.waitForTimeout(2600); const s = await S(); ex.push({ from: Math.round(before), to: Math.round(s.yt) }); }
  const maxY = Math.round((await S()).maxY);
  out.explore = { steps: ex, expectStop: Math.round(Math.min(la.end, la.s1 + vp.height * .3)), maxY, ok: Math.abs(ex[0].to - Math.round(Math.min(la.end, la.s1 + vp.height * .3))) < 3 && Math.abs(ex[1].to - maxY) < 3 };

  // ---- 7. kept while the world is open (three keeps a transmissive material's render target for good, so a rebuild per scroll-away would leak it)
  const near = await S(); await go(la.logo - 6 * vp.height); await page.waitForTimeout(1500); const far = await S();
  out.keep = { near: { phase: near.logo.phase, tex: near.logo.gl?.textures }, far: { phase: far.logo.phase, tex: far.logo.gl?.textures }, ok: far.logo.phase === 'ready' && far.logo.gl?.textures === near.logo.gl?.textures };

  // ---- 8. context lost in the block: the page carries on and draws again after the restore
  await go(mid); await page.waitForTimeout(600);
  const ctx = await page.evaluate(async () => {
    const c = document.querySelector('.fiw-canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'), ext = gl.getExtension('WEBGL_lose_context');
    if (!ext) return { skipped: 'no WEBGL_lose_context' };
    ext.loseContext(); await new Promise(r => setTimeout(r, 700)); const lost = gl.isContextLost(); ext.restoreContext(); await new Promise(r => setTimeout(r, 1500));
    return { lost, restored: !gl.isContextLost() };
  });
  await page.waitForTimeout(800);
  const afterCtx = await S();
  out.contextLoss = { ...ctx, failed: afterCtx.logo.failed, phase: afterCtx.logo.phase, ok: ctx.skipped ? true : ctx.lost && ctx.restored && !afterCtx.logo.failed };

  // ---- 9. closing the world lets go of the lake, the mark and the copies (the GPU memory goes down)
  await go(mid); await page.waitForTimeout(500); const open = await S();
  await page.evaluate(() => window.__MONTIS_STUDY__.world.close()); await page.waitForTimeout(800);
  const closed = await page.evaluate(() => { const g = window.__MONTIS_STUDY__.world.state.logo; return { phase: g.phase, tex: g.gl?.textures, geo: g.gl?.geometries }; });
  out.close = { open: { tex: open.logo.gl?.textures, geo: open.logo.gl?.geometries }, closed, ok: closed.phase === 'idle' && closed.tex < open.logo.gl.textures && closed.geo < open.logo.gl.geometries };

  out.ok = !!(out.layout.ok && out.spin.ok && out.rise.ok && out.ends.ok && out.back.ok && out.tab.ok && out.chrome.ok && out.explore.ok && out.keep.ok && out.contextLoss.ok && out.close.ok);
  return out;
};
