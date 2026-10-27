'use strict';
/* Journey captures + a labelled contact sheet (ported from scratchpad/maritime/lookdev.cjs).
   Optional CONFIG writes (--set, at run time + applyConfig; --early = before the scene is built) and an in-page --js file. */
const path = require('node:path');
const L = require('./lib.cjs');
const USAGE = `shot.cjs — 旅程位置截圖＋對照表（sheet.jpg）
用法：node scripts/index1-5/shot.cjs --at "0,2.96,8.9,max" [選項]
  --at        位置清單 p（逗號分隔；max＝旅程終點 ≈13.07）
  --w --h     視窗（預設 1440 900）；--phone ＝ 390×844 手機模擬（--w 小於 700 也算手機）
  --out       輸出資料夾名稱（預設 shot-yyyymmdd-hhmmss），放在 .qa/index1-5/ 底下
  --cols      對照表每列幾張（預設 4）
  --set       執行中改 CONFIG："group.key=0.5,group.key=#a0b0c0"（數字、#hex、true/false），改完呼叫 window.index4.applyConfig()
  --early     --set 的值在場景建立前就寫進 CONFIG（「重整生效」的參數要用這個）
  --js        在頁面裡執行一個 .js 檔（之後也會 applyConfig）
  --query     額外網址參數（例如 "&logolook=original"）；預設已帶 tune=0（不開面板）
  --reduced   減少動態模式（prefers-reduced-motion）
  --wait      每個位置到達後等幾毫秒再截（預設 2600；p 0 是 3500）
  --quality   JPEG 品質（預設 84）
輸出：.qa/index1-5/<名稱>/p-<位置>.jpg、sheet.jpg、run.json（參數、到達位置、錯誤）
結束碼：0 成功｜1 頁面有錯或位置沒到｜2 指令打錯｜3 超時`;

L.main('shot', {
  usage: USAGE, timeout: 900,
  spec: { at: 'value', w: 'value', h: 'value', phone: 'bool', out: 'value', cols: 'value', set: 'value', early: 'bool', js: 'value', query: 'value', reduced: 'bool', wait: 'value', quality: 'value' },
}, async o => {
  const at = L.parsePositions(o.at);
  const sets = o.set !== undefined ? L.parseSets(o.set) : [];
  if (o.early && !sets.length) throw new L.UsageError('--early 要搭配 --set');
  const jsFile = L.readJsFile(o);
  const cols = L.opt(o, 'cols', 4, { min: 1, max: 12, int: true }), waitMs = o.wait !== undefined ? L.num(o.wait, 'wait', { min: 0 }) : null;
  const quality = L.opt(o, 'quality', 84, { min: 30, max: 100, int: true });
  const vp = L.viewport(o), dir = L.outDir('shot', o.out);

  const s = await L.openSession('shot', o, { early: o.early ? sets : null });
  const { page, log } = s;
  const run = { tool: 'shot', url: s.url, viewport: vp, reduced: !!o.reduced, ms: s.ms, args: process.argv.slice(2), sets: null, js: null, shots: [] };
  if (s.early) run.sets = { mode: 'early', ...s.early };
  else if (sets.length) run.sets = { mode: 'runtime', ...await L.applySets(page, sets) };
  if (jsFile) { run.js = { file: L.abs(jsFile), result: await L.runJs(page, jsFile) }; L.note('js done', run.js.result ?? ''); }
  await page.waitForTimeout(1200);

  const cells = []; let missed = 0;
  for (const p of at) {
    const f = await L.fly(page, p);
    await page.waitForTimeout(waitMs ?? (p === 0 ? 3500 : 2600));
    const file = path.join(dir, `p-${L.fileTag(L.posName(p))}.jpg`);
    await L.capture(page, file, quality);
    const st = await L.readState(page);
    if (!f.ok) missed++;
    run.shots.push({ at: L.posName(p), file: L.abs(file), reached: f.ok, progress: st.progress, max: st.max, cards: st.cards });
    cells.push({ label: `p ${L.posName(p)}${f.ok ? '' : `（未到，停在 ${f.progress}）`}`, file });
  }
  const stats = await L.imageStats(s.context, cells.map(c => c.file));
  cells.forEach((c, i) => {
    c.label += ` · L* ${stats[i].lstar}`; run.shots[i].lstar = stats[i].lstar;
    console.log(run.shots[i].file, `L* ${stats[i].lstar}`, run.shots[i].reached ? '' : `NOT REACHED progress ${run.shots[i].progress}`);
  });
  const title = `index1-5 · ${L.vpName(vp)}${o.reduced ? ' · reduced' : ''}${o.query ? ' · ' + o.query : ''}${sets.length ? ' · ' + (o.early ? 'early ' : '') + sets.map(x => x.key + '=' + x.raw).join(', ') : ''}${jsFile ? ' · js ' + path.basename(jsFile) : ''} · ${new Date().toLocaleString('zh-TW', { hour12: false })}`;
  const sheet = await L.contactSheet(s.context, cells, path.join(dir, 'sheet.jpg'), { cols, title });
  Object.assign(run, L.logJson(log), { sheet: L.abs(sheet) });
  L.writeJson(path.join(dir, 'run.json'), run);
  console.log('sheet', L.abs(sheet));
  console.log('run', L.abs(path.join(dir, 'run.json')));
  L.printLog(log);
  return log.errors.length || missed ? 1 : 0;
});
