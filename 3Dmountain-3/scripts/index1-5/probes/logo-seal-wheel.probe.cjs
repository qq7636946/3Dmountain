'use strict';
/* LOGO 收尾（logo seal）真實滾輪連拍：湖景建好後，從海洋第 4 章用真的滾輪一格一格往下滾過波浪與旋轉，再往回捲同樣長度；
   每隔幾格拍一張，標上當時的 y、波浪／旋轉進度、yaw。往回捲的同一個 y 應該看到同樣的畫面（時鐘只和 y 有關）。
   輸出 docs/logo-seal/evidence/integration/<視窗>-wheel-down-sheet.jpg、-wheel-up-sheet.jpg（LOGOSEAL_EVIDENCE 可改資料夾）。
   用法：node scripts/index1-5/probe.cjs --world --script scripts/index1-5/probes/logo-seal-wheel.probe.cjs --out logo-seal-wheel */
const fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp, world }) => {
  const la = world.logo && world.logo.at;
  if (!la) return { ok: false, error: 'no logo block' };
  const tag = `${vp.width}x${vp.height}`;
  const dir = path.resolve(process.cwd(), process.env.LOGOSEAL_EVIDENCE || 'docs/logo-seal/evidence/integration');
  const tmp = path.resolve(process.cwd(), '.qa/index1-5/_logo-wheel-tmp'); fs.mkdirSync(tmp, { recursive: true });
  await L.jumpWorld(page, la.logo - 1.9 * vp.height);
  await page.waitForFunction(() => { const g = window.__MONTIS_STUDY__.world.state.logo; return g.ready || g.failed; }, null, { timeout: 90000, polling: 200 });
  await page.waitForTimeout(800);
  await L.jumpWorld(page, la.w0 - 0.35 * vp.height); await page.waitForTimeout(1500);
  await page.mouse.move(vp.width / 2, vp.height / 2);
  const info = () => page.evaluate(() => { const s = window.__MONTIS_STUDY__.world.state, g = s.logo.sample; return { y: Math.round(s.y), qWave: +g.qWave.toFixed(2), qSpin: +g.qSpin.toFixed(2), yaw: +(g.yaw * 180 / Math.PI).toFixed(0) }; });
  const run = async (dir_, n, every, name) => {
    const cells = [];
    for (let i = 0; i <= n; i++) {
      if (i % every === 0) {
        const file = path.join(tmp, `${name}-${String(cells.length).padStart(2, '0')}.jpg`); await L.capture(page, file, 74);
        const s = await info(); cells.push({ label: `y ${s.y} · wave ${s.qWave} · yaw ${s.yaw}°`, file });
      }
      if (i < n) { await page.mouse.wheel(0, dir_ * 120); await page.waitForTimeout(140); }
    }
    await page.waitForTimeout(1600);
    return cells;
  };
  const down = await run(1, 36, 3, 'down');
  const up = await run(-1, 36, 3, 'up');
  const a = await L.contactSheet(page.context(), down, path.join(dir, `${tag}-wheel-down-sheet.jpg`), { cols: 4, title: `logo seal · real wheel down · ${tag}` });
  const b = await L.contactSheet(page.context(), up, path.join(dir, `${tag}-wheel-up-sheet.jpg`), { cols: 4, title: `logo seal · real wheel back up · ${tag}` });
  return { ok: true, a, b, down: down.map(c => c.label), up: up.map(c => c.label) };
};
