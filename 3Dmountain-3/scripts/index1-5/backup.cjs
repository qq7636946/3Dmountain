'use strict';
/* Before a task card touches anything: copy prototypes/index1-5/ (all of it) + index1-5.html into
   _archive/backups/index1-5-<card-id>-<yyyymmdd-hhmm>/ and verify the copy. Never deletes or overwrites anything. */
const L = require('./lib.cjs');
const USAGE = `backup.cjs — 動手前先備份 index1-5（整個 prototypes/index1-5/ ＋ index1-5.html）
用法：node scripts/index1-5/backup.cjs <卡號> [--note "說明"]
  <卡號>   任務卡編號，例如 S3-grass-01（英數字、- _ . 或中文）
  --note   寫進 BACKUP.json 的一句說明
輸出：_archive/backups/index1-5-<卡號>-<yyyymmdd-hhmm>/（同一分鐘再備份會加 -2、-3）
       裡面：index1-5.html、prototypes/index1-5/…、BACKUP.json（檔案數、大小、還原指令）
       不會刪除或覆蓋任何東西。還原：node scripts/index1-5/restore.cjs <這個資料夾> --yes
結束碼：0 成功且驗證相符｜1 失敗或驗證不符｜2 指令打錯`;

L.main('backup', { usage: USAGE, timeout: 300, spec: { note: 'value' } }, async o => {
  const id = o._[0];
  if (!id) throw new L.UsageError('要給卡號，例如 node scripts/index1-5/backup.cjs S3-grass-01');
  if (o._.length > 1) throw new L.UsageError('只能給一個卡號（有空白的話加引號，或用 - 連起來）');
  const { dest, ok, manifest } = L.makeBackup(id, { note: o.note && o.note !== true ? String(o.note) : '' });
  console.log('backup', L.abs(dest));
  console.log(`files ${manifest.files}, bytes ${manifest.bytes}, verified ${ok}`);
  console.log('restore with:', manifest.restore);
  return ok ? 0 : 1;
});
