'use strict';
/* LOGO 收尾（logo seal）取證截圖：波浪經過（q 0/.25/.5/.75/1）、旋轉（0/90/180/270/360°，用 yaw 反推位置）、停留（文字）。
   輸出 docs/logo-seal/evidence/integration/<視窗>[-reduced]-<名稱>.jpg 與 <視窗>[-reduced]-sheet.jpg（環境變數 LOGOSEAL_EVIDENCE 可改資料夾）。
   用法：node scripts/index1-5/probe.cjs --world --script scripts/index1-5/probes/logo-seal-shots.probe.cjs [--phone | --w 1920 --h 1080 | --reduced] --out logo-seal-shots */
const fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp, world }) => {
  const la = world.logo && world.logo.at;
  if (!la) return { ok: false, error: 'no logo block' };
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const tag = `${vp.width}x${vp.height}${reduced ? '-reduced' : ''}`;
  const dir = path.resolve(process.cwd(), process.env.LOGOSEAL_EVIDENCE || 'docs/logo-seal/evidence/integration');
  fs.mkdirSync(dir, { recursive: true });
  const dials = await page.evaluate(() => ({ ...window.__MONTIS_STUDY__.CONFIG.logoSeal }));
  // build the lake first (it is built lazily near the block)
  await L.jumpWorld(page, la.logo - 1.9 * vp.height);
  await page.waitForFunction(() => { const g = window.__MONTIS_STUDY__.world.state.logo; return g.ready || g.failed; }, null, { timeout: 90000, polling: 200 });
  await page.waitForTimeout(600);
  const plan = await page.evaluate(() => window.__MONTIS_STUDY__.world.state.logo.at);
  const smoother = t => t * t * t * (t * (t * 6 - 15) + 10), curve = t => t + (smoother(t) - t) * dials.spinEase;
  const tForYaw = frac => { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (curve(m) < frac) lo = m; else hi = m; } return (lo + hi) / 2; };
  const shots = [], cells = [];
  const only = process.env.LOGOSEAL_ONLY ? process.env.LOGOSEAL_ONLY.split(',') : null;   // e.g. wave-05,spin-180,hold
  const shot = async (name, y, label) => {
    if (only && !only.includes(name)) return;
    await L.jumpWorld(page, y); await page.waitForTimeout(1300);
    const file = path.join(dir, `${tag}-${name}.jpg`);
    await L.capture(page, file, 80);
    const s = await page.evaluate(() => { const g = window.__MONTIS_STUDY__.world.state.logo.sample; return { qWave: g.qWave, qSpin: g.qSpin, yaw: g.yaw, textP: g.textP }; });
    shots.push({ name, y: Math.round(y), ...s }); cells.push({ label: `${label} · ${tag}`, file });
  };
  for (const q of [0, .25, .5, .75, 1]) await shot(`wave-${String(q).replace('.', '')}`, plan.w0 + (plan.w1 - plan.w0) * q, `wave ${q}`);
  if (!reduced) for (const deg of [0, 90, 180, 270, 360]) await shot(`spin-${deg}`, plan.s0 + (plan.spinDone - plan.s0) * tForYaw(deg / 360), `yaw ${deg}°`);
  await shot('hold', plan.s1 + (plan.end - plan.s1) * .5, 'hold');
  const sheet = await L.contactSheet(page.context(), cells, path.join(dir, `${tag}-sheet.jpg`), { cols: vp.width < 700 ? 6 : 4, title: `logo seal · ${tag}` });
  return { ok: true, dir, sheet, shots };
};
