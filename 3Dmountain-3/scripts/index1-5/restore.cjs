'use strict';
/* Put a backup made by backup.cjs back: its prototypes/index1-5/ and index1-5.html are copied over the live ones,
   then the build runs. Refuses without --yes (and then only shows what would change). Before copying it makes a
   safety backup of the current state (card id "prerestore"), so a restore can itself be undone. Nothing is deleted:
   live files that the backup does not have are listed, and left where they are. */
const fs = require('node:fs'), path = require('node:path');
const L = require('./lib.cjs');
const USAGE = `restore.cjs — 把 backup.cjs 做的備份放回去，然後重新建置
用法：node scripts/index1-5/restore.cjs <備份資料夾> --yes [--no-build]
  <備份資料夾>  完整路徑、相對路徑，或 _archive/backups/ 底下的資料夾名稱
  --yes        真的執行（沒有 --yes 只列出會改哪些檔案，不動任何東西）
  --no-build   放回去之後不跑 node prototypes/index1-5/build.cjs
  會先自動把「現在的狀態」備份成 _archive/backups/index1-5-prerestore-<時間>/，所以還原本身也能再還原。
  不刪除任何檔案：備份裡沒有、現在多出來的檔案會列出來（要移走請手動移到 _archive/）。
結束碼：0 完成（含建置成功）｜1 建置失敗或複製失敗｜2 指令打錯／沒有 --yes／不是 backup.cjs 的備份`;

L.main('restore', { usage: USAGE, timeout: 600, spec: { yes: 'bool', 'no-build': 'bool' } }, async o => {
  const arg = o._[0];
  if (!arg) throw new L.UsageError('要給備份資料夾');
  const cands = [path.resolve(process.cwd(), arg), path.resolve(L.ROOT, arg), path.join(L.BACKUPS, arg)];
  const dir = cands.find(p => fs.existsSync(path.join(p, 'prototypes', 'index1-5', 'build.cjs')) && fs.existsSync(path.join(p, L.PAGE_FILE)));
  if (!dir) throw new L.UsageError(`${arg} 不是 backup.cjs 做的備份（要有 index1-5.html 和 prototypes/index1-5/build.cjs）。找過：\n  ${cands.map(L.abs).join('\n  ')}`);
  const bProto = path.join(dir, 'prototypes', 'index1-5');
  const inBackup = L.walk(bProto), live = L.walk(L.PROTO);
  const liveMap = new Map(live.map(f => [f.rel, f])), backMap = new Map(inBackup.map(f => [f.rel, f]));
  const same = (a, b) => fs.readFileSync(a).equals(fs.readFileSync(b));
  const changed = inBackup.filter(f => liveMap.has(f.rel) && !same(path.join(bProto, f.rel), path.join(L.PROTO, f.rel))).map(f => f.rel);
  const added = inBackup.filter(f => !liveMap.has(f.rel)).map(f => f.rel);
  const extra = live.filter(f => !backMap.has(f.rel)).map(f => f.rel);
  const htmlChanged = !same(path.join(dir, L.PAGE_FILE), path.join(L.ROOT, L.PAGE_FILE));
  let manifest = null; try { manifest = JSON.parse(fs.readFileSync(path.join(dir, 'BACKUP.json'), 'utf8')); } catch { }
  console.log('backup', L.abs(dir), manifest ? `(card ${manifest.card}, ${manifest.created})` : '');
  console.log(`would overwrite ${changed.length} file(s)${htmlChanged ? ' + index1-5.html' : ''}, add ${added.length}; ${extra.length} live file(s) not in the backup stay`);
  const show = (t, l) => { if (l.length) console.log(`  ${t}: ${l.slice(0, 40).join(', ')}${l.length > 40 ? ` …(+${l.length - 40})` : ''}`); };
  show('overwrite', changed); show('add', added); show('extra (kept, not deleted)', extra);
  if (!o.yes) { console.log('REFUSED: 加 --yes 才會真的還原（什麼都沒改）'); return 2; }

  const safety = L.makeBackup('prerestore', { note: 'restore.cjs 之前的狀態；要回到還原前就還原這個' });
  console.log('safety backup of the current state', L.abs(safety.dest), safety.ok ? '(verified)' : '(NOT verified)');
  if (!safety.ok) { console.log('安全備份驗證不符，停止，沒有覆蓋任何檔案'); return 1; }
  L.copyTree(bProto, L.PROTO, { overwrite: true });
  fs.copyFileSync(path.join(dir, L.PAGE_FILE), path.join(L.ROOT, L.PAGE_FILE));
  console.log(`restored ${inBackup.length} file(s) + index1-5.html`);
  if (extra.length) console.log(`WARN 這些檔案備份裡沒有，仍留在 prototypes/index1-5/（presets/*.diff.json 會照檔名順序被套用！）：${extra.join(', ')}`);
  if (o['no-build']) { console.log('build skipped (--no-build)'); return 0; }
  const b = L.runBuild();
  console.log(b.ok ? `build ok (${b.ms} ms): ${b.out}` : `build FAILED: ${b.err || b.out}`);
  return b.ok ? 0 : 1;
});
