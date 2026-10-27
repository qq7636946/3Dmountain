'use strict';
/* Real-wheel feel strip (ported from scratchpad/asc/bridge2.cjs): start at a journey position (or at the start of the
   world epilogue), send real mouse-wheel notches on their own timeline, and capture frames at a fixed cadence while
   they land. Every frame is labelled with its actual time and where the page was. */
const path = require('node:path');
const L = require('./lib.cjs');
const USAGE = `wheel.cjs — 真實滾輪手感：從某個位置開始滾，連拍成一張對照表
用法：node scripts/index1-5/wheel.cjs --from 3.6 [選項]
  --from      起點位置 p（數字或 max；預設 max＝FOUR PATHS，往下滾就是卡牌轉場）
  --world     改從世界段（卡牌之後：地球→海洋）的開頭開始滾
  --notches   滾幾格（預設 12）　--delta 每格多少（預設 120）　--dir down|up（預設 down）
  --interval  每格間隔毫秒（預設 140，像一般快速滾動）
  --frames    拍幾張（預設 16）　--every 每張間隔毫秒（預設 300；截圖本身也要時間，標籤上是實際時間）
  --w --h / --phone / --query / --reduced / --set / --early   同 shot.cjs
  --cols      每列幾張（預設 4）；--out 資料夾名稱（預設 wheel-yyyymmdd-hhmmss）
輸出：.qa/index1-5/<名稱>/f-00.jpg…、sheet.jpg、run.json（每張的時間、p、卡牌／世界段狀態、每格滾輪送出的時間）
結束碼：0 成功｜1 頁面有錯或起點沒到｜2 指令打錯｜3 超時`;

L.main('wheel', {
  usage: USAGE, timeout: 900,
  spec: { from: 'value', world: 'bool', notches: 'value', delta: 'value', dir: 'value', interval: 'value', frames: 'value', every: 'value', w: 'value', h: 'value', phone: 'bool', query: 'value', reduced: 'bool', set: 'value', early: 'bool', cols: 'value', out: 'value' },
}, async o => {
  if (o.world && o.from !== undefined) throw new L.UsageError('--from 和 --world 只能選一個');
  const from = o.world ? null : L.parsePositions(o.from ?? 'max', 'from')[0];
  const notches = L.opt(o, 'notches', 12, { min: 0, max: 400, int: true }), delta = L.opt(o, 'delta', 120, { min: 1, max: 2000 });
  const dir = String(o.dir ?? 'down').toLowerCase(); if (!['down', 'up'].includes(dir)) throw new L.UsageError('--dir 只能是 down 或 up');
  const interval = L.opt(o, 'interval', 140, { min: 0 }), frames = L.opt(o, 'frames', 16, { min: 1, max: 120, int: true }), every = L.opt(o, 'every', 300, { min: 0 });
  const cols = L.opt(o, 'cols', 4, { min: 1, max: 12, int: true });
  const sets = o.set !== undefined ? L.parseSets(o.set) : [];
  if (o.early && !sets.length) throw new L.UsageError('--early 要搭配 --set');
  const vp = L.viewport(o), out = L.outDir('wheel', o.out);

  const s = await L.openSession('wheel', o, { autoplay: !!o.world, early: o.early ? sets : null });
  const { page, log } = s;
  const run = { tool: 'wheel', url: s.url, viewport: vp, ms: s.ms, args: process.argv.slice(2), start: null, ticks: [], frames: [] };
  if (s.early) run.sets = { mode: 'early', ...s.early }; else if (sets.length) run.sets = { mode: 'runtime', ...await L.applySets(page, sets) };
  await page.waitForTimeout(1200);
  let reached = true;
  if (o.world) { const w = await L.enterWorld(page, vp); run.start = { world: true, notchesToEnter: w.notches, maxY: w.state.maxY }; }
  else { const f = await L.fly(page, from); reached = f.ok; run.start = f; await page.waitForTimeout(from === 0 ? 3500 : 2500); }
  console.log('start', JSON.stringify(await L.readState(page)));

  await page.mouse.move(vp.width / 2, vp.height / 2);
  const sign = dir === 'up' ? -1 : 1, t0 = Date.now();
  const wheeling = (async () => {
    for (let i = 0; i < notches; i++) {
      const due = t0 + i * interval, w = due - Date.now(); if (w > 0) await L.sleep(w);
      run.ticks.push(Date.now() - t0);
      await page.mouse.wheel(0, sign * delta);
    }
  })();
  const shots = [];
  for (let i = 0; i < frames; i++) {
    const due = t0 + i * every, w = due - Date.now(); if (w > 0) await L.sleep(w);
    const t = Date.now() - t0, st = await L.readState(page), buf = await page.screenshot({ type: 'jpeg', quality: 72 });
    shots.push({ t, st, buf });
  }
  await wheeling;
  const cells = shots.map((f, i) => {
    const file = L.writeFile(path.join(out, `f-${String(i).padStart(2, '0')}.jpg`), f.buf);
    const inWorld = !!(f.st.world && f.st.world.open);
    const where = inWorld ? `world y ${f.st.world.y}` : `p ${f.st.progress}`;
    const cards = !inWorld && f.st.cards && (f.st.cards.open || f.st.cards.transition > 0) ? ` · cards ${f.st.cards.open ? 'open' : 'closed'} ${f.st.cards.transition}` : '';
    run.frames.push({ i, t: f.t, file: L.abs(file), ...f.st });
    console.log(`f-${String(i).padStart(2, '0')} +${(f.t / 1000).toFixed(2)}s ${where}${cards}`);
    return { label: `+${(f.t / 1000).toFixed(2)}s · ${where}${cards}`, file };
  });
  const title = `wheel ${dir} ${notches}×${delta} every ${interval}ms from ${o.world ? 'world start' : 'p ' + L.posName(from)} · ${L.vpName(vp)}${o.query ? ' · ' + o.query : ''} · ${new Date().toLocaleString('zh-TW', { hour12: false })}`;
  run.sheet = L.abs(await L.contactSheet(s.context, cells, path.join(out, 'sheet.jpg'), { cols, title }));
  run.end = await L.readState(page);
  Object.assign(run, L.logJson(log));
  L.writeJson(path.join(out, 'run.json'), run);
  console.log('ticks sent at ms', JSON.stringify(run.ticks));
  console.log('end', JSON.stringify(run.end));
  console.log('sheet', run.sheet);
  console.log('run', L.abs(path.join(out, 'run.json')));
  L.printLog(log);
  return log.errors.length || !reached ? 1 : 0;
});
