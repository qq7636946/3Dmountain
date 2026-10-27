'use strict';
/* flicker.probe.cjs — brightness jumps / black frames / popping while the visitor keeps scrolling (QA only).
   CDP screencast (small jpeg frames) during a steady real-wheel scroll; every frame is decoded in a helper page and reduced to
   mean luma + difference from the previous frame. Reports spikes with the scroll position they happened at.
   Env: FLK_DIR (output dir), FLK_SIGN (1 down / -1 up, default 1), FLK_EVERY (ms between notches, default 100), FLK_DELTA (default 120),
        FLK_MAX (max notches, default 700), FLK_FROM (journey p to start from, default 0; "max" = end), FLK_WORLD=1 (start inside the world epilogue)
   Run: FLK_DIR=.qa/index1-5/flk-1440 node scripts/index1-5/probe.cjs --script docs/qa/evidence/responsive/tools/flicker.probe.cjs --out flk-1440 */
const fs = require('node:fs'), path = require('node:path');

module.exports = async ({ page, L, vp }) => {
  const dir = path.resolve(process.env.FLK_DIR || '.qa/index1-5/flk');
  fs.mkdirSync(dir, { recursive: true });
  const sign = Number(process.env.FLK_SIGN) || 1, every = Number(process.env.FLK_EVERY) || 100, delta = Number(process.env.FLK_DELTA) || 120, maxN = Number(process.env.FLK_MAX) || 700;
  const from = process.env.FLK_FROM || '0';
  if (from !== '0') { await L.fly(page, from === 'max' ? 'max' : Number(from)); await page.waitForTimeout(1500); }
  await page.mouse.move(vp.width / 2, vp.height / 2);
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const t0 = Date.now();
  cdp.on('Page.screencastFrame', async f => { frames.push({ t: Date.now() - t0, d: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => { }); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 45, maxWidth: 320, maxHeight: 320, everyNthFrame: 1 });
  const state = () => page.evaluate(() => { const S = window.__MONTIS_STUDY__, j = S.journey, P = S.portfolio, W = S.world; let y = 0, maxY = 0, open = false; try { if (W && W.open) { open = true; y = W.state.y; maxY = W.state.maxY; } } catch { } return { p: +j.progress.toFixed(3), max: j.max, cards: P && P.open ? +(P.transition || 0).toFixed(3) : null, open, y: Math.round(y), maxY: Math.round(maxY) }; });
  const samples = [];
  let still = 0, prev = null;
  for (let n = 0; n < maxN; n++) {
    await page.mouse.wheel(0, sign * delta); await page.waitForTimeout(every);
    if (n % 2 === 1) { const st = await state(); samples.push({ t: Date.now() - t0, ...st }); }
    if (n % 5 === 4) {
      const st = samples[samples.length - 1], key = JSON.stringify([Math.round(st.p * 1000), st.open, st.y]);
      const atEnd = sign > 0 ? (st.open && st.maxY > 0 && st.y >= st.maxY - 2) : (!st.open && st.p < .002);
      still = key === prev ? still + 1 : 0; prev = key;
      if (atEnd || still >= 6) break;
    }
  }
  await page.waitForTimeout(1200);
  await cdp.send('Page.stopScreencast').catch(() => { });
  // decode
  const helper = await page.context().newPage();
  const stats = await helper.evaluate(async frames => {
    const out = []; let prevG = null;
    const c = document.createElement('canvas'), W = 64, H = 36; c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
    for (const f of frames) {
      const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'data:image/jpeg;base64,' + f.d; });
      if (!img) { out.push({ t: f.t, bad: true }); continue; }
      x.drawImage(img, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
      let s = 0, mx = 0, dark = 0;
      for (let k = 0; k < W * H; k++) { const l = .2126 * d[k * 4] + .7152 * d[k * 4 + 1] + .0722 * d[k * 4 + 2]; g[k] = l; s += l; if (l < 6) dark++; if (l > mx) mx = l; }
      let diff = 0; if (prevG) { for (let k = 0; k < g.length; k++) diff += Math.abs(g[k] - prevG[k]); diff /= g.length; }
      out.push({ t: f.t, mean: +(s / g.length / 2.55).toFixed(2), diff: +diff.toFixed(2), dark: +(dark / g.length).toFixed(3) });
      prevG = g;
    }
    return out;
  }, frames);
  await helper.close().catch(() => { });
  // attach scroll position
  const at = t => { let best = samples[0]; for (const s of samples) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s; return best; };
  stats.forEach(s => { const a = at(s.t); s.pos = a ? (a.open ? 'w' + a.y : a.cards != null ? 'c' + a.cards : 'p' + a.p) : null; });
  // events: luma jump vs previous frame; diff spike vs rolling median; black frames
  const events = [];
  for (let i = 1; i < stats.length; i++) {
    const s = stats[i], p = stats[i - 1]; if (s.bad || p.bad) continue;
    const dl = s.mean - p.mean;
    const win = stats.slice(Math.max(0, i - 8), i).map(q => q.diff).filter(v => v != null).sort((a, b) => a - b), med = win.length ? win[win.length >> 1] : 0;
    if (Math.abs(dl) >= 6) events.push({ k: 'luma-jump', t: s.t, pos: s.pos, from: p.mean, to: s.mean });
    if (s.diff > Math.max(14, med * 5)) events.push({ k: 'diff-spike', t: s.t, pos: s.pos, diff: s.diff, med: +med.toFixed(2) });
    if (s.dark > .96 && p.dark < .5) events.push({ k: 'black-frame', t: s.t, pos: s.pos, mean: s.mean });
  }
  const gaps = []; for (let i = 1; i < stats.length; i++) { const g = stats[i].t - stats[i - 1].t; if (g > 250) gaps.push({ t: stats[i].t, gap: g, pos: stats[i].pos }); }
  // save a few key frames around events (decoded jpg straight)
  const keep = events.slice(0, 12);
  keep.forEach((e, n) => { const f = frames.reduce((a, b) => Math.abs(b.t - e.t) < Math.abs(a.t - e.t) ? b : a); fs.writeFileSync(path.join(dir, `ev${n}-${e.k}-${String(e.pos).replace(/[^\w.]/g, '_')}.jpg`), Buffer.from(f.d, 'base64')); });
  fs.writeFileSync(path.join(dir, 'flicker.json'), JSON.stringify({ vp, sign, every, delta, frames: stats.length, events, gaps, samples: samples.length, series: stats }, null, 1));
  return { ok: true, frames: stats.length, events: events.length, gaps: gaps.length, top: events.slice(0, 25), gapTop: gaps.slice(0, 10), dir: path.relative(process.cwd(), dir) };
};
