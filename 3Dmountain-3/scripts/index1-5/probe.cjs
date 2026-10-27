'use strict';
/* probe.cjs — run a small check script in a prepared index1-5 page (so a task card can ship its own objective test).
   The script is a CommonJS file that exports  async ({ page, L, vp, world, fly, jumpWorld, log }) => result
     page   the Playwright page (page loaded, body.is-ready, __MONTIS_STUDY__.ready awaited)
     L      scripts/index1-5/lib.cjs (L.worldY(world,'h:1'), L.jumpWorld(page,y), L.fly(page,p), L.oceanNow(page), …)
     world  with --world: the state after entering the world epilogue (cards → globe → …); otherwise null
   Return any JSON-able object; { ok:false } (or any page error) makes the exit code 1.  Prints one line "probe {...}". */
const path = require('node:path');
const L = require('./lib.cjs');
const USAGE = `probe.cjs — 在準備好的頁面裡跑一支檢查腳本（卡片自己帶驗收腳本用）
用法：node scripts/index1-5/probe.cjs --script <檔案.cjs> [--world] [--at "5.56"] [--w --h --phone --reduced --query "&x=1"] [--set "g.k=v"] [--early] [--out 名稱]
  --script   CommonJS 檔，exports = async ({ page, L, vp, world, fly, jumpWorld, log }) => { return { ok: true, … } }
  --world    先走進世界段（地球／海洋／頁尾），把 world.state 交給腳本（L.worldY(world,'h:1') 可換成 y）
  --at       先飛到旅程位置 p（可多個，只飛到最後一個；--world 時忽略）
  --set      執行中改 CONFIG（同 shot.cjs）；--early 則在場景建立前寫入
輸出：.qa/index1-5/<名稱>/probe.json（腳本回傳值、頁面錯誤）；stdout 一行 probe {...}
結束碼：0 ok｜1 腳本回傳 ok:false、腳本丟錯、或頁面有錯｜2 指令打錯｜3 超時`;

L.main('probe', {
  usage: USAGE, timeout: 900,
  spec: { script: 'value', world: 'bool', at: 'value', w: 'value', h: 'value', phone: 'bool', query: 'value', reduced: 'bool', set: 'value', early: 'bool', out: 'value' },
}, async o => {
  if (!o.script || o.script === true) throw new L.UsageError('缺少 --script 檔案');
  const file = path.resolve(process.cwd(), String(o.script));
  if (!require('node:fs').existsSync(file)) throw new L.UsageError('找不到腳本 ' + file);
  const sets = o.set !== undefined ? L.parseSets(o.set) : [];
  if (o.early && !sets.length) throw new L.UsageError('--early 要搭配 --set');
  const at = o.at !== undefined ? L.parsePositions(o.at) : [];
  const dir = L.outDir('probe', o.out);
  const s = await L.openSession('probe', o, { autoplay: !!o.world, early: o.early ? sets : null });
  const { page, log, vp } = s;
  const run = { tool: 'probe', script: L.abs(file), url: s.url, viewport: vp, reduced: !!o.reduced, ms: s.ms, args: process.argv.slice(2), sets: null };
  if (s.early) run.sets = { mode: 'early', ...s.early };
  else if (sets.length) run.sets = { mode: 'runtime', ...await L.applySets(page, sets) };
  let world = null;
  if (o.world) world = (await L.enterWorld(page, vp)).state;
  else if (at.length) { const f = await L.fly(page, at[at.length - 1]); run.fly = f; if (!f.ok) log.errors.push(`位置 ${at[at.length - 1]} 沒有到（停在 ${f.progress}）`); await page.waitForTimeout(1200); }
  let result = null, failed = false;
  try {
    delete require.cache[require.resolve(file)];
    const fn = require(file);
    if (typeof fn !== 'function') throw new Error('腳本要 module.exports = async ({ page, L, … }) => result');
    result = await fn({ page, L, vp, world, log, fly: (p) => L.fly(page, p), jumpWorld: y => L.jumpWorld(page, y) });
  } catch (e) { failed = true; result = { ok: false, error: String(e && e.stack || e).slice(0, 800) }; }
  await page.waitForTimeout(600);
  run.result = result; Object.assign(run, L.logJson(log));
  L.writeJson(path.join(dir, 'probe.json'), run);
  console.log('probe ' + JSON.stringify(result));
  console.log('json', L.abs(path.join(dir, 'probe.json')));
  L.printLog(log);
  return failed || (result && result.ok === false) || log.errors.length ? 1 : 0;
});
