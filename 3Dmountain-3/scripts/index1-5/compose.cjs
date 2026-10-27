'use strict';
/* Labelled contact sheet from image files (ported from scratchpad/maritime/compose.cjs). JPEG, PNG, WebP, GIF inputs
   (type read from the file's bytes); mixed sizes are fitted without stretching. No GPU, no site page. */
const fs = require('node:fs'), path = require('node:path');
const L = require('./lib.cjs');
const USAGE = `compose.cjs — 把幾張圖排成有標籤的對照表（例如前後對照）
用法：node scripts/index1-5/compose.cjs out.jpg COLS "標籤|檔案" "標籤|檔案" ...
  out.jpg   輸出檔（.jpg 或 .png）
  COLS      每列幾張
  "標籤|檔案"  標籤和圖檔路徑用 | 分開；只給路徑就用檔名當標籤。可混用 .jpg / .png / .webp
  --title   對照表最上面的一行標題
  --cell    每格寬度 px（預設：橫圖 640、直圖 360）
例：node scripts/index1-5/compose.cjs .qa/index1-5/ba.jpg 2 "之前|.qa/index1-5/a/p-8.9.jpg" "之後|.qa/index1-5/b/p-8.9.jpg" --title "峽谷 p 8.9 前後"
結束碼：0 成功｜1 失敗｜2 指令打錯（檔案不存在也算）`;

L.main('compose', { usage: USAGE, timeout: 180, spec: { title: 'value', cell: 'value' } }, async o => {
  const [out, colsArg, ...items] = o._;
  if (!out || colsArg === undefined || !items.length) throw new L.UsageError('要給 out.jpg、COLS 和至少一張圖');
  if (!/\.(jpe?g|png)$/i.test(out)) throw new L.UsageError(`輸出檔要是 .jpg 或 .png：${out}`);
  const cols = L.num(colsArg, 'COLS', { min: 1, max: 20, int: true }), cell = L.opt(o, 'cell', 0, { min: 80, max: 4000, int: true });
  const cells = items.map(s => {
    const bar = s.lastIndexOf('|'), label = bar >= 0 ? s.slice(0, bar) : null, file = path.resolve(process.cwd(), bar >= 0 ? s.slice(bar + 1) : s);
    if (!fs.existsSync(file)) throw new L.UsageError(`找不到圖檔 ${file}`);
    return { label: label ?? path.basename(file), file };
  });
  const browser = await L.launchBrowser({ gpu: false });
  const dest = path.resolve(process.cwd(), out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await L.contactSheet(browser, cells, dest, { cols, cell, title: o.title && o.title !== true ? String(o.title) : '' });
  console.log('ok', L.abs(dest));
  return 0;
});
