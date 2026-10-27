'use strict';
/* card.cjs — the safe way for several Haiku workers to share ONE source tree and ONE build output.
   start   claim the card's 可改檔案 (file-level, atomic), check depends are finished, make a file-scoped backup + hash baseline
   build   syntax-check own files, take the QA browser lock, build, optionally run a command (--then) while still holding it;
           a build that fails inside someone else's file waits and retries instead of blaming (or "fixing") it
   exec    run any command (e.g. an evidence tool that opens a browser) under the same lock
   finish  scope check (what changed, vs the claim), syntax of changed files, release the claim, record the card as done
   abort   put back ONLY this card's files from its own backup (never the whole tree), rebuild, release
   diff    unified-style diff of the card's files against its own backup (no git needed)
   status  who holds which file, who holds the browser lock, last builds, finished cards
   release <ID> --force   (orchestrator) drop a stale claim      done <ID>   (orchestrator) mark a card finished by hand */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process'), crypto = require('node:crypto');
const L = require('./lib.cjs');
const V = require('./validate-cards.cjs');

/* I15_CARD_ROOT (tests only) relocates claims, backups, logs and the files under work into a scratch tree */
const TEST = !!process.env.I15_CARD_ROOT;
const ROOT = TEST ? path.resolve(process.env.I15_CARD_ROOT) : L.ROOT;
const PROTO = path.join(ROOT, 'prototypes', 'index1-5'), BACKUPS = path.join(ROOT, '_archive', 'backups');
const CLAIMS = TEST ? path.join(ROOT, '.claims') : path.join(os.tmpdir(), 'montis-index1-5-claims');
const QA = path.join(ROOT, '.qa', 'index1-5');
const LOG = path.join(QA, 'card-log.jsonl'), DONE = path.join(QA, 'card-done.jsonl');
const STALE_MS = 8 * 3600e3;
const cardsDir = path.join(ROOT, 'docs', 'haiku-plan', 'cards');
const sha = buf => crypto.createHash('sha1').update(buf).digest('hex');
const slash = L.slash;
const relp = p => slash(path.relative(ROOT, p));
const sleepMs = ms => new Promise(r => setTimeout(r, ms));

const USAGE = `card.cjs — 多個 Haiku 共用同一份來源與同一個建置輸出時的安全工具
用法：
  node scripts/index1-5/card.cjs start <卡號> [--files "a,b"] [--ignore-depends] [--force] [--no-validate]
  node scripts/index1-5/card.cjs build <卡號> [--then "命令"] [--retry 5] [--wait 60]
  node scripts/index1-5/card.cjs exec <卡號> --cmd "命令"
  node scripts/index1-5/card.cjs finish <卡號> [--force]
  node scripts/index1-5/card.cjs abort <卡號> [--no-build]
  node scripts/index1-5/card.cjs diff <卡號>                    （看這張卡相對開工備份改了什麼；總指揮審查用）
  node scripts/index1-5/card.cjs status
  node scripts/index1-5/card.cjs release <卡號> --force        （總指揮用）
  node scripts/index1-5/card.cjs done <卡號>                   （總指揮用：手動標記已完成）
結束碼：0 成功｜1 失敗（自己的錯誤、驗證不過、越界）｜2 指令打錯｜3 超時｜4 建置被別人的檔案擋住（等過了還是壞，不要還原、回報總指揮）｜5 檔案被別張卡佔用｜6 前置卡還沒完成
重點：不要用 restore.cjs（它會蓋掉整個 prototypes/index1-5，包括別人正在改的檔案）；要還原就用 abort。`;

/* ------------------------------------------------------------------ small stores */
const ensure = d => fs.mkdirSync(d, { recursive: true });
const claimFile = f => path.join(CLAIMS, sha(f).slice(0, 20) + '.json');
function readClaims() {
  ensure(CLAIMS); const out = [];
  for (const n of fs.readdirSync(CLAIMS)) { if (!n.endsWith('.json') || n.startsWith('build-') || n === 'lastbuild.json') continue; try { const c = JSON.parse(fs.readFileSync(path.join(CLAIMS, n), 'utf8')); if (c && c.card && c.file) out.push(c); } catch { } }
  return out;
}
const claimsOf = id => readClaims().filter(c => c.card === id);
const ownerOf = f => readClaims().find(c => c.file === f);
function appendLog(file, obj) { try { ensure(path.dirname(file)); fs.appendFileSync(file, JSON.stringify(obj) + '\n'); } catch { } }
function readJsonl(file) { try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } }
const doneSet = () => new Set(readJsonl(DONE).map(d => d.card));

/* ------------------------------------------------------------------ the card + its files */
function loadCard(id) {
  const file = path.join(cardsDir, id + '.md');
  if (!fs.existsSync(file)) return null;
  const c = V.parseCard(file); return c;
}
function claimList(card, o) {
  if (o.files && o.files !== true) return String(o.files).split(',').map(s => slash(s.trim())).filter(Boolean);
  if (!card || !card.sections) return null;
  return V.editableFiles(card).map(f => slash(f.file));
}
/* hash baseline: every source a card could touch by mistake (not images/media/models) */
const SKIP_DIR = new Set(['node_modules', '.git']);
function baselineSet() {
  const out = [];
  const walk = (dir, filter) => { if (!fs.existsSync(dir)) return; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(p, filter); } else if (e.isFile() && (!filter || filter(p))) out.push(p); } };
  walk(PROTO);
  walk(path.join(ROOT, 'js')); walk(path.join(ROOT, 'css'));
  walk(path.join(ROOT, 'prototypes', 'highland-1-4-ascent', 'js'));
  for (const n of fs.readdirSync(ROOT)) if (/^index.*\.html$/.test(n) || n === 'sitemap.xml') out.push(path.join(ROOT, n));
  return out.filter(p => { try { return fs.statSync(p).size < 12e6; } catch { return false; } });
}
function snapshot() { const m = {}; for (const p of baselineSet()) { try { m[relp(p)] = sha(fs.readFileSync(p)); } catch { } } return m; }
const isOutput = f => /^prototypes\/index1-5\/js\//.test(f) || f === 'prototypes/index1-5/index1-5.css' || f === 'prototypes/index1-5/alpine-ui.js' || f === 'index1-5.html';
function lastBackup(id) {
  if (!fs.existsSync(BACKUPS)) return null;
  const list = fs.readdirSync(BACKUPS).filter(n => n.startsWith(`card-${id}-`)).sort();
  return list.length ? path.join(BACKUPS, list[list.length - 1]) : null;
}

/* ------------------------------------------------------------------ syntax of own files */
function syntaxOwn(files) {
  const fails = [];
  for (const f of files) {
    const abs = path.resolve(ROOT, f); if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    if (/\.cjs$/.test(f)) { const r = cp.spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' }); if (r.status !== 0) fails.push(`${f}: ${L.clip((r.stderr || '').split('\n').find(l => /Error/.test(l)) || r.stderr, 200)}`); }
    else if (/\.(js|mjs)$/.test(f)) fails.push(...L.syntaxCheck([abs]));
  }
  return fails;
}

/* ------------------------------------------------------------------ build (full stderr, so the culprit can be named) */
function rawBuild() {
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, [path.join(PROTO, 'build.cjs')], { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
  return { ok: r.status === 0, code: r.status, ms: Date.now() - t0, out: (r.stdout || '').trim(), err: ((r.stderr || '').trim() || (r.error && r.error.message) || '') };
}
function culpritOf(err) {
  const rx = /prototypes[\\/]index1-5[\\/]((?:alpine[\\/])?[\w.\-]+\.(?:cjs|js|css|json))(?::\d+)?/g; let m;
  const seen = [];
  while ((m = rx.exec(err))) { const f = 'prototypes/index1-5/' + m[1].replace(/\\/g, '/'); if (f !== 'prototypes/index1-5/build.cjs' && !seen.includes(f)) seen.push(f); }
  if (seen.length) return seen[0];
  const h = /index1-5 ([\w-]+) anchor|(\w[\w-]*) anchor|cards-bridge|alpine-team|world-ocean|opening-world|letters-entrance|logo-look|opening-drops|bead-life|user-preset/i.exec(err);
  return h && fs.existsSync(path.join(PROTO, (h[1] || h[2] || h[0]).toLowerCase().replace(/^cards-bridge$/, 'cards-bridge-build.cjs'))) ? 'prototypes/index1-5/' + (h[1] || h[2] || h[0]).toLowerCase() : null;
}

/* ------------------------------------------------------------------ commands */
async function cmdStart(id, o) {
  const card = loadCard(id);
  let files = claimList(card, o);
  if (!files) throw new L.UsageError(`找不到卡檔 docs/haiku-plan/cards/${id}.md；沒有卡檔時要用 --files "a,b" 指定可改檔案`);
  if (card && !o['no-validate']) {
    const { cards } = V.loadDir(cardsDir), plan = V.parsePlan(path.join(ROOT, 'docs', 'haiku-plan', 'plan.md')), env = V.makeEnv(cards, plan, V.laneMap(path.join(ROOT, 'docs', 'haiku-plan', 'lanes.md')));
    V.checkCard(card, env);
    if (card.errors.length) { console.log('卡片驗證失敗：'); for (const e of card.errors) console.log('  ✗ ' + e); if (!o.force) { console.log('不要動工，回報總指揮（確定要硬做就加 --force）'); return 1; } }
    for (const w of card.warns.slice(0, 8)) console.log('  ! ' + w);
  }
  // depends finished?
  const deps = card && Array.isArray(card.fm.depends) ? card.fm.depends.filter(d => !d.startsWith('ext:')) : [];
  const done = doneSet(), missing = deps.filter(d => !done.has(d));
  if (missing.length && !o['ignore-depends']) { console.log(`前置卡還沒完成：${missing.join(', ')}（已完成的卡記在 .qa/index1-5/card-done.jsonl；總指揮確認過可用 --ignore-depends）`); return 6; }
  // claim, all or nothing
  ensure(CLAIMS);
  const got = [], now = Date.now();
  for (const f of files) {
    const cf = claimFile(f), rec = { file: f, card: id, at: new Date().toISOString(), pid: process.pid, host: os.hostname() };
    for (let tries = 0; ; tries++) {
      try { fs.writeFileSync(cf, JSON.stringify(rec), { flag: 'wx' }); got.push(cf); break; }
      catch (e) {
        if (e.code !== 'EEXIST') throw e;
        let cur = null; try { cur = JSON.parse(fs.readFileSync(cf, 'utf8')); } catch { }
        if (cur && cur.card === id) { got.push(null); break; }                                  // resuming the same card
        if (!cur || now - Date.parse(cur.at) > STALE_MS) { try { fs.unlinkSync(cf); } catch { } if (tries < 3) continue; }
        for (const g of got) if (g) try { fs.unlinkSync(g); } catch { }
        console.log(`BUSY：${f} 被卡 ${cur ? cur.card : '?'} 佔用（${cur ? cur.at : ''}）。等它 finish，或先做別張卡。`);
        return 5;
      }
    }
  }
  // scoped backup + baseline
  const dest = path.join(BACKUPS, `card-${id}-${L.stamp(new Date(), false)}`);
  let d = dest; for (let n = 2; fs.existsSync(d); n++) d = `${dest}-${n}`;
  const claimed = [];
  for (const f of files) {
    const abs = path.resolve(ROOT, f), existed = fs.existsSync(abs);
    if (existed) {
      if (fs.statSync(abs).isDirectory()) L.copyTree(abs, path.join(d, 'files', f), { overwrite: false });
      else { fs.mkdirSync(path.dirname(path.join(d, 'files', f)), { recursive: true }); fs.copyFileSync(abs, path.join(d, 'files', f)); }
    }
    claimed.push({ file: f, existed, sha: existed && !fs.statSync(abs).isDirectory() ? sha(fs.readFileSync(abs)) : null });
  }
  ensure(d);
  fs.writeFileSync(path.join(d, 'MANIFEST.json'), JSON.stringify({ card: id, created: new Date().toISOString(), claimed, baseline: snapshot() }, null, 1));
  console.log(`started ${id}`);
  console.log('claimed ' + files.length + ' file(s):\n  ' + files.join('\n  '));
  console.log('backup  ' + L.abs(d));
  if (deps.length) console.log('depends ' + deps.join(', ') + (missing.length ? `（${missing.join(', ')} 尚未登記完成，已用 --ignore-depends 略過）` : '（都已完成）'));
  console.log('提醒：改完用 node scripts/index1-5/card.cjs build ' + id + ' --then "…" 建置與驗證；不要用 restore.cjs；要還原用 card.cjs abort ' + id);
  return 0;
}

async function cmdBuild(id, o) {
  const mine = claimsOf(id).map(c => c.file);
  if (!mine.length) console.log(`WARN：${id} 還沒有 card.cjs start（沒有佔用任何檔案）；建置照跑，但出錯時分不出是誰的`);
  const own = syntaxOwn(mine);
  if (own.length) { console.log('你自己的檔案有語法錯誤，先修好再建置（沒有碰共用建置）：\n  ' + own.join('\n  ')); return 1; }
  const retry = L.opt(o, 'retry', 5, { min: 0, max: 20, int: true }), wait = L.opt(o, 'wait', 60, { min: 5, max: 600 });
  for (let attempt = 0; ; attempt++) {
    await L.acquireLock('card.cjs build ' + id, o);
    const b = rawBuild();
    const before = readLast(), now = snapshot(), changed = Object.keys(now).filter(f => !isOutput(f) && before[f] !== now[f]);
    if (b.ok) {
      writeLast(now); appendLog(LOG, { at: new Date().toISOString(), card: id, event: 'build', ok: true, ms: b.ms, attempt, changed });
      try { fs.writeFileSync(path.join(CLAIMS, `build-${id}.json`), JSON.stringify({ at: Date.now() })); } catch { }
      console.log(`build ok (${b.ms} ms)${changed.length ? '；自上次建置後有變動的來源：' + changed.join(', ') : ''}`);
      if (o.then && o.then !== true) {
        console.log('then: ' + o.then);
        const r = cp.spawnSync(String(o.then), { cwd: ROOT, shell: true, stdio: 'inherit', env: { ...process.env, I15_NO_LOCK: '1' } });
        return r.status ?? 1;
      }
      return 0;
    }
    const culprit = culpritOf(b.err), owner = culprit ? ownerOf(culprit) : null, isOwn = culprit && mine.includes(culprit);
    appendLog(LOG, { at: new Date().toISOString(), card: id, event: 'build', ok: false, ms: b.ms, attempt, culprit, owner: owner && owner.card, own: !!isOwn });
    console.log('build FAILED\n' + L.clip(b.err.split('\n').filter(l => !/node:internal/.test(l)).slice(0, 14).join('\n'), 1400));
    if (isOwn || !culprit) { console.log(isOwn ? `\n出錯的是你自己的檔案（${culprit}）：修好再建置。` : '\n看不出是哪個檔案出錯：先檢查自己這張卡改的地方；兩次修不好就停下來回報。'); return 1; }
    // someone else's file
    L.releaseLock();
    console.log(`\n出錯的是別人的檔案：${culprit}${owner ? `（卡 ${owner.card} 正在改，從 ${owner.at}）` : '（沒有人佔用，可能是人工在改）'}。不要碰它、不要還原。`);
    if (attempt >= retry) { console.log(`等了 ${retry} 輪（每輪 ${wait}s）還是壞：停手，回報總指揮「被 ${culprit} 擋住」。你自己的檔案沒有問題（語法已檢查）。`); return 4; }
    console.log(`等 ${wait}s 後重試（${attempt + 1}/${retry}）…`); await sleepMs(wait * 1000);
  }
}
const LASTF = path.join(CLAIMS, 'lastbuild.json');
function readLast() { try { return JSON.parse(fs.readFileSync(LASTF, 'utf8')); } catch { return {}; } }
function writeLast(m) { try { fs.writeFileSync(LASTF, JSON.stringify(m)); } catch { } }

async function cmdExec(id, o) {
  if (!o.cmd || o.cmd === true) throw new L.UsageError('exec 要 --cmd "命令"');
  await L.acquireLock('card.cjs exec ' + id, o);
  console.log('exec: ' + o.cmd);
  const r = cp.spawnSync(String(o.cmd), { cwd: ROOT, shell: true, stdio: 'inherit', env: { ...process.env, I15_NO_LOCK: '1' } });
  return r.status ?? 1;
}

async function cmdFinish(id, o) {
  const dir = lastBackup(id); if (!dir) throw new L.UsageError(`找不到 ${id} 的備份（先 card.cjs start ${id}）`);
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'MANIFEST.json'), 'utf8'));
  const mine = new Set(man.claimed.map(c => c.file)), claims = readClaims(), others = new Set(claims.filter(c => c.card !== id).map(c => c.file));
  const inMine = f => mine.has(f) || [...mine].some(m => m.endsWith('/') && f.startsWith(m));
  const now = snapshot(), all = new Set([...Object.keys(man.baseline), ...Object.keys(now)]);
  const rows = { mine: [], output: [], theirs: [], violation: [] };
  for (const f of [...all].sort()) {
    if (man.baseline[f] === now[f]) continue;
    const kind = man.baseline[f] === undefined ? 'new' : now[f] === undefined ? 'removed' : 'changed';
    if (inMine(f)) rows.mine.push(`${kind} ${f}`);
    else if (isOutput(f)) rows.output.push(f);
    else if (others.has(f)) rows.theirs.push(f);
    else rows.violation.push(`${kind} ${f}`);
  }
  // claimed files that were new and not in the repo baseline (docs etc.)
  for (const c of man.claimed) { const abs = path.resolve(ROOT, c.file); if (fs.existsSync(abs) && !fs.statSync(abs).isDirectory()) { const h = sha(fs.readFileSync(abs)); if (h !== c.sha && !rows.mine.some(r => r.endsWith(' ' + c.file))) rows.mine.push(`${c.existed ? 'changed' : 'new'} ${c.file}`); } }
  console.log(`卡 ${id} 完成檢查`);
  console.log(`改了（在佔用範圍內）${rows.mine.length}：\n  ${rows.mine.join('\n  ') || '（沒有）'}`);
  console.log(`建置產物（忽略）${rows.output.length}；別張卡正在改的檔案（忽略）${rows.theirs.length}`);
  if (rows.violation.length) console.log(`越界 ${rows.violation.length}：\n  ✗ ${rows.violation.join('\n  ✗ ')}`);
  const changedMine = rows.mine.map(r => r.split(' ').slice(1).join(' '));
  const syn = syntaxOwn(changedMine); if (syn.length) console.log('語法錯誤：\n  ✗ ' + syn.join('\n  ✗ '));
  let warn = '';
  try { const b = JSON.parse(fs.readFileSync(path.join(CLAIMS, `build-${id}.json`), 'utf8')); const late = changedMine.filter(f => { const a = path.resolve(ROOT, f); return fs.existsSync(a) && fs.statSync(a).mtimeMs > b.at + 500; }); if (late.length) warn = `改了檔案之後沒有重新建置：${late.join(', ')}（先 card.cjs build ${id}）`; } catch { warn = '這張卡沒有成功建置過（card.cjs build）'; if (!changedMine.length) warn = ''; }
  if (warn) console.log('WARN ' + warn);
  const bad = rows.violation.length || syn.length;
  if (bad && !o.force) { console.log('\n有越界或語法錯誤：佔用沒有釋放。修掉（越界的檔案用 abort 或請總指揮處理），再 finish。'); return 1; }
  for (const c of claimsOf(id)) try { fs.unlinkSync(claimFile(c.file)); } catch { }
  try { fs.unlinkSync(path.join(CLAIMS, `build-${id}.json`)); } catch { }
  fs.writeFileSync(path.join(dir, 'finish.json'), JSON.stringify({ card: id, at: new Date().toISOString(), changed: rows.mine, violation: rows.violation, warn }, null, 1));
  appendLog(DONE, { at: new Date().toISOString(), card: id, files: changedMine, warn: warn || undefined });
  console.log(`\nfinished ${id}；備份在 ${L.abs(dir)}`);
  console.log('回報時照主提示詞的格式；「改了哪些檔案」就貼上面「改了」那幾行。');
  return 0;
}

async function cmdAbort(id, o) {
  const dir = lastBackup(id); if (!dir) throw new L.UsageError(`找不到 ${id} 的備份`);
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'MANIFEST.json'), 'utf8'));
  const aside = path.join(ROOT, '_archive', 'aborted', `${id}-${L.stamp(new Date(), false)}`);
  for (const c of man.claimed) {
    const abs = path.resolve(ROOT, c.file);
    if (c.existed) {
      const src = path.join(dir, 'files', c.file);
      if (!fs.existsSync(src)) continue;
      if (fs.statSync(src).isDirectory()) L.copyTree(src, abs, { overwrite: true }); else fs.copyFileSync(src, abs);
      console.log('restored ' + c.file);
    } else if (fs.existsSync(abs)) {
      const to = path.join(aside, c.file); ensure(path.dirname(to)); fs.renameSync(abs, to);   // a file the card created: moved aside, never deleted
      console.log('moved aside ' + c.file + ' → ' + relp(to));
    }
  }
  for (const c of claimsOf(id)) try { fs.unlinkSync(claimFile(c.file)); } catch { }
  try { fs.unlinkSync(path.join(CLAIMS, `build-${id}.json`)); } catch { }
  appendLog(LOG, { at: new Date().toISOString(), card: id, event: 'abort' });
  if (o['no-build']) { console.log('aborted（沒有重新建置）'); return 0; }
  await L.acquireLock('card.cjs abort ' + id, o);
  const b = rawBuild();
  console.log(b.ok ? `aborted；build ok (${b.ms} ms)` : 'aborted；但建置失敗（可能是別人的檔案）：\n' + L.clip(b.err, 600));
  return b.ok ? 0 : 1;
}


/* small line diff: common prefix/suffix, LCS on the middle (falls back to a block replace when huge) */
function lineDiff(a, b) {
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const A = a.slice(p, a.length - s), B = b.slice(p, b.length - s), ops = [];
  if (A.length * B.length > 4e6) { A.forEach(x => ops.push(['-', x])); B.forEach(x => ops.push(['+', x])); }
  else {
    const n = A.length, m = B.length, dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) { if (A[i] === B[j]) { ops.push([' ', A[i]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(['-', A[i++]]); else ops.push(['+', B[j++]]); }
    while (i < n) ops.push(['-', A[i++]]); while (j < m) ops.push(['+', B[j++]]);
  }
  return { prefix: p, ops, tail: a.slice(a.length - s) };
}
function cmdDiff(id) {
  const dir = lastBackup(id); if (!dir) throw new L.UsageError('找不到 ' + id + ' 的備份');
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'MANIFEST.json'), 'utf8'));
  let total = 0;
  for (const c of man.claimed) {
    const abs = path.resolve(ROOT, c.file);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { console.log('--- ' + c.file + (fs.existsSync(abs) ? '（目錄，略過）' : '（不存在）')); continue; }
    const now = fs.readFileSync(abs, 'utf8'), before = c.existed ? fs.readFileSync(path.join(dir, 'files', c.file), 'utf8') : '';
    const crlfNow = (now.match(/\r\n/g) || []).length, crlfBefore = (before.match(/\r\n/g) || []).length;
    const a = before.replace(/\r\n/g, '\n').split('\n'), b = now.replace(/\r\n/g, '\n').split('\n');
    const d = lineDiff(a, b), changed = d.ops.filter(o => o[0] !== ' ');
    console.log('=== ' + c.file + (c.existed ? '' : '（新檔案）') + `　+${changed.filter(o => o[0] === '+').length} -${changed.filter(o => o[0] === '-').length}` + (crlfNow !== crlfBefore ? `　WARN 換行字元變了（CRLF ${crlfBefore} → ${crlfNow}）` : ''));
    if (!changed.length) { console.log('（沒有差異）'); continue; }
    let shown = 0; let ctx = a.slice(Math.max(0, d.prefix - 2), d.prefix);
    for (const l of ctx) console.log('  ' + l);
    for (const [k, l] of d.ops) { if (shown++ > 400) { console.log('…（超過 400 行，略）'); break; } console.log(k + ' ' + l); }
    for (const l of d.tail.slice(0, 2)) console.log('  ' + l);
    total += changed.length;
  }
  console.log(`
共 ${total} 行不同（以 ${relp(dir)} 為準）`);
  return 0;
}

function cmdStatus() {
  const claims = readClaims(), by = new Map();
  for (const c of claims) { if (!by.has(c.card)) by.set(c.card, []); by.get(c.card).push(c); }
  console.log(`進行中的卡 ${by.size}：`);
  for (const [card, list] of by) { const age = Math.round((Date.now() - Date.parse(list[0].at)) / 60000); console.log(`  ${card}（${age} 分鐘前開工）\n    ${list.map(c => c.file).join('\n    ')}`); }
  try { const info = JSON.parse(fs.readFileSync(L.LOCK, 'utf8')); console.log(`QA 瀏覽器鎖：${info.tool}（pid ${info.pid}，${info.at}）`); } catch { console.log('QA 瀏覽器鎖：空閒'); }
  const logs = readJsonl(LOG).slice(-5); if (logs.length) console.log('最近建置：\n  ' + logs.map(l => `${l.at.slice(11, 19)} ${l.card} ${l.event} ${l.ok === false ? 'FAIL ' + (l.culprit || '') : l.ok ? 'ok' : ''}`).join('\n  '));
  console.log(`已完成的卡：${doneSet().size}`);
  return 0;
}

L.main('card', {
  usage: USAGE, timeout: 1800,
  spec: { files: 'value', then: 'value', cmd: 'value', retry: 'value', wait: 'value', force: 'bool', 'ignore-depends': 'bool', 'no-validate': 'bool', 'no-build': 'bool' },
}, async o => {
  const [sub, id] = o._;
  if (!sub) throw new L.UsageError('要給子命令');
  if (sub === 'status') return cmdStatus();
  if (!id) throw new L.UsageError(`${sub} 要給卡號`);
  if (!/^(?:W0-\d{2}|[ABC]-\d{2}[a-z]?|[\w.\-]+)$/.test(id)) throw new L.UsageError('卡號格式不對：' + id);
  if (sub === 'start') return cmdStart(id, o);
  if (sub === 'build') return cmdBuild(id, o);
  if (sub === 'exec') return cmdExec(id, o);
  if (sub === 'finish') return cmdFinish(id, o);
  if (sub === 'abort') return cmdAbort(id, o);
  if (sub === 'diff') return cmdDiff(id);
  if (sub === 'release') { if (!o.force) throw new L.UsageError('release 要加 --force（只有總指揮能放掉別人的佔用）'); let n = 0; for (const c of claimsOf(id)) { try { fs.unlinkSync(claimFile(c.file)); n++; } catch { } } console.log(`released ${n} claim(s) of ${id}`); return 0; }
  if (sub === 'done') { appendLog(DONE, { at: new Date().toISOString(), card: id, manual: true }); console.log('marked done ' + id); return 0; }
  throw new L.UsageError('不認得的子命令 ' + sub);
});
