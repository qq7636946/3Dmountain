'use strict';
/* validate-cards — checks task cards against docs/haiku-plan/card-format.md (no browser, no network, reads sources only).
   node scripts/index1-5/validate-cards.cjs [--dir docs/haiku-plan/cards] [--card ID] [--plan docs/haiku-plan/plan.md]
        [--conflicts] [--fresh] [--coverage] [--strict] [--json] [--quiet]
   Per card: front matter, required sections (in order), 可改檔案 exist, every 錨點 FILE exists and its ANCHOR occurs
   exactly once (CRLF normalised; helper/source files, never the generated js), 參數 table (default = 現況值 when default: same),
   tool commands exist (scripts/index1-5, evidence tools, scripts/seo) with known flags, 驗收 lines carry evidence, depends exist.
   --conflicts  every pair of cards that edit the same file must be ordered by depends (so they can never run together)
   --fresh      also report files changed after the card's `written:` stamp (and build.cjs / lanes.md)
   --coverage   compare the card files with the CARD PLAN in plan.md (missing / unplanned cards)
   Exit 0 = no errors, 1 = errors (warnings never fail unless --strict), 2 = bad usage. */
const fs = require('node:fs'), path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TOOLS_DIR = path.join(ROOT, 'scripts', 'index1-5');
const SECTIONS = ['目標', '為什麼', '開工', '可改檔案', '不可改檔案', '錨點', '步驟', '參數', '驗證指令', '驗收', '還原', '回報', '常見失敗與處理'];
const KINDS = ['code', 'dial+sweep', 'sweep', 'measure', 'doc'];
const ACTIONS = ['replace-with', 'insert-after', 'insert-before', 'replace-file', 'target:replace-with', 'target:insert-after', 'target:insert-before'];
const REQUIRED_FM = ['id', 'title', 'source', 'writer', 'lane', 'wave', 'size', 'kind', 'depends', 'autodispatch', 'default', 'written'];
const PARAM_HEADER = ['中文標籤', 'key', 'min', 'max', 'step', 'default', '現況值'];
const COMMON_FLAGS = ['help', 'no-lock', 'timeout', 'allow-new'];
const CARD_SUBCOMMANDS = ['start', 'build', 'exec', 'finish', 'abort', 'status', 'release', 'done', 'diff'];
const CARD_FLAGS = new Set([...COMMON_FLAGS, 'files', 'then', 'cmd', 'retry', 'wait', 'force', 'ignore-depends', 'no-validate', 'no-build']);
const ID_RE = /^(?:W0-\d{2}|[ABC]-\d{2}[a-z]?)$/;

/* ------------------------------------------------------------------ helpers */
const norm = s => String(s).replace(/\r\n/g, '\n');
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const read = p => norm(fs.readFileSync(p, 'utf8'));
function countOcc(hay, needle) { if (!needle) return 0; let c = 0, i = 0; while ((i = hay.indexOf(needle, i)) >= 0) { c++; i += needle.length; } return c; }

/* the stub every new helper starts as (W0-01 writes these; the validator treats a missing "(new)" file as this text) */
function stubText(file) {
  const base = path.basename(file);
  if (base.endsWith('.css')) return `/* index1-5 ${base} (registered by W0-01). Cards insert rules above the END marker. */\n/* ==== END RULES ==== */\n`;
  if (base.endsWith('.md') || base.endsWith('.json') || base.endsWith('.xml')) return '';
  return `/* index1-5 ${base} - stub registered by W0-01. Cards insert patches above the END marker. */\n  /* ==== PATCHES (cards insert above the END marker) ==== */\n  /* ==== END PATCHES ==== */\n`;
}

/* ------------------------------------------------------------------ parsing */
function parseFrontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(norm(text));
  if (!m) return { error: '缺少 front-matter（檔案開頭要有 --- … ---）' };
  const fm = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const k = /^([\w-]+):\s*(.*?)\s*(?:#.*)?$/.exec(line);
    if (!k) return { error: 'front-matter 這行看不懂：' + line };
    let v = k[2];
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    else if (/^-?\d+$/.test(v)) v = +v;
    fm[k[1]] = v;
  }
  return { fm, rest: norm(text).slice(m[0].length) };
}
/* sections by `## ` headings outside code fences; also collects fenced blocks per section */
function parseSections(body) {
  const secs = [], lines = body.split('\n'); let cur = null, fence = null;
  for (const line of lines) {
    const f = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (f) {
      if (!fence) { fence = { ch: f[1][0], len: f[1].length, lang: f[2].trim(), lines: [] }; if (cur) cur.blocks.push(fence); }
      else if (f[1][0] === fence.ch && f[1].length >= fence.len && !f[2].trim()) fence = null;
      else if (fence) fence.lines.push(line);
      if (cur) cur.lines.push(line);
      continue;
    }
    if (fence) { fence.lines.push(line); if (cur) cur.lines.push(line); continue; }
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) { cur = { name: h[1], lines: [], blocks: [] }; secs.push(cur); continue; }
    if (cur) cur.lines.push(line);
  }
  for (const s of secs) s.text = s.lines.join('\n');
  return secs;
}
function parseCard(file) {
  const text = fs.readFileSync(file, 'utf8');
  const fmr = parseFrontMatter(text);
  const card = { file, name: path.basename(file, '.md'), errors: [], warns: [], text: norm(text) };
  if (fmr.error) { card.errors.push(fmr.error); card.fm = {}; return card; }
  card.fm = fmr.fm; card.body = fmr.rest; card.sections = parseSections(fmr.rest);
  card.sec = n => card.sections.find(s => s.name === n);
  return card;
}
/* 可改檔案: lines like  - `path` (new)  → [{file, isNew}] */
function editableFiles(card) {
  const s = card.sec && card.sec('可改檔案'); if (!s) return [];
  const out = [];
  for (const line of s.lines) { const m = /^\s*[-*]\s+`([^`]+)`(.*)$/.exec(line); if (m) out.push({ file: m[1].trim(), isNew: /\(new\)/i.test(m[2]) }); }
  return out;
}
function anchorRows(card) {
  const s = card.sec && card.sec('錨點'); if (!s) return null;
  const b = s.blocks.find(x => x.lang === 'anchors'); if (!b) return null;
  const rows = [], bad = [];
  for (const line of b.lines) {
    if (!line.trim()) continue;
    if (/^\s*none\s*$/i.test(line)) { rows.none = true; continue; }
    const m = /^(A\d+)\s+\|\s+(\S+)\s+\|\s+("(?:[^"\\]|\\.)*")\s+\|\s+([a-z:\-]+)(?:\s+\|\s+(after:[\w\-]+))?\s*$/.exec(line);
    if (!m) { bad.push(line); continue; }
    let anchor; try { anchor = JSON.parse(m[3]); } catch (e) { bad.push(line + '  （ANCHOR 不是合法 JSON 字串）'); continue; }
    rows.push({ id: m[1], file: m[2], anchor, action: m[4], after: m[5] ? m[5].slice(6) : null, line });
  }
  rows.bad = bad; return rows;
}

/* ------------------------------------------------------------------ tool specs (flags) */
const specCache = new Map();
function toolSpec(script) {
  const abs = path.resolve(ROOT, script);
  if (specCache.has(abs)) return specCache.get(abs);
  let spec = null;
  if (fs.existsSync(abs) && abs.startsWith(TOOLS_DIR + path.sep)) {
    const src = fs.readFileSync(abs, 'utf8'), m = /spec:\s*\{([^}]*)\}/.exec(src);
    spec = new Set(COMMON_FLAGS);
    if (m) for (const k of m[1].matchAll(/['"]?([\w-]+)['"]?\s*:/g)) spec.add(k[1]);
    else if (!/L\.main\(/.test(src)) spec = null;   // not a lib tool: do not guess
  }
  specCache.set(abs, spec); return spec;
}
function tokenize(line) {
  const out = []; let cur = '', q = null, has = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; else if (c === '\\' && q === '"' && i + 1 < line.length && /["\\]/.test(line[i + 1])) cur += line[++i]; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; has = true; continue; }
    if (/\s/.test(c)) { if (cur || has) out.push(cur); cur = ''; has = false; continue; }
    cur += c;
  }
  if (cur || has) out.push(cur); return out;
}
function commandLines(sec) {
  const lines = []; if (!sec) return lines;
  for (const b of sec.blocks) {
    if (!/^(bash|sh|shell|cmd|powershell|console|)$/i.test(b.lang)) continue;
    let acc = '';
    for (const raw of b.lines) { const l = raw.replace(/\s+$/, ''); if (/\\$/.test(l)) { acc += l.slice(0, -1) + ' '; continue; } acc += l; if (acc.trim()) lines.push(acc.trim().replace(/^\$\s+/, '')); acc = ''; }
  }
  return lines;
}
function checkCommand(line, errs, ctx) {
  for (const part of line.split(/\s+&&\s+|\s*;\s+(?=node\s)/)) {
    const t = tokenize(part); if (!t.length) continue;
    if (t[0] !== 'node') continue;       // other shell lines (cd, echo, type…) are not checked
    const script = (t[1] || '').replace(/\\/g, '/');
    if (!script) { errs.push(`命令沒有指令碼：${part}`); continue; }
    if (script.startsWith('-')) continue;   // node -e …
    const abs = path.resolve(ROOT, script);
    if (!fs.existsSync(abs)) { if (!ctx.virtualScripts.has(script)) errs.push(`指令碼不存在：${script}`); continue; }
    const ok = /^scripts\/(index1-5|seo|logo-letters)\//.test(rel(abs)) || /^docs\/haiku-plan\/evidence\/[ABC]\/tools\//.test(rel(abs)) || /^prototypes\/index1-5\/(build|opening-range-make)\.cjs$/.test(rel(abs)) || /^\.qa\/index1-5\//.test(rel(abs));
    if (!ok) { errs.push(`不允許的指令碼位置（只能用 scripts/index1-5、scripts/seo、evidence/*/tools、prototypes/index1-5/build.cjs）：${script}`); continue; }
    if (rel(abs) === 'scripts/index1-5/card.cjs') {
      const sub = t[2];
      if (!CARD_SUBCOMMANDS.includes(sub)) errs.push(`card.cjs 子命令不存在：${sub}（${CARD_SUBCOMMANDS.join('/')}）`);
      const thenIdx = t.indexOf('--then');
      if (thenIdx >= 0 && t[thenIdx + 1]) checkCommand(t[thenIdx + 1], errs, ctx);
      if (sub === 'exec') { const ci = t.indexOf('--cmd'); if (ci >= 0 && t[ci + 1]) checkCommand(t[ci + 1], errs, ctx); else errs.push('card.cjs exec 要 --cmd "命令"'); }
      for (const f of t.slice(2)) { const m = /^--([\w-]+)/.exec(f); if (m && !CARD_FLAGS.has(m[1])) errs.push(`card.cjs 沒有 --${m[1]} 這個選項`); }
      if (sub === 'start' || sub === 'finish' || sub === 'abort' || sub === 'build') { if (!t[3] || t[3].startsWith('-')) errs.push(`card.cjs ${sub} 後面要接卡號：${part}`); else if (ctx.id && t[3] !== ctx.id && t[3] !== '<ID>') errs.push(`card.cjs ${sub} 的卡號 ${t[3]} 不是本卡 ${ctx.id}`); }
      continue;
    }
    const spec = toolSpec(script);
    if (spec) for (const f of t.slice(2)) { const m = /^--([\w-]+)/.exec(f); if (m && !spec.has(m[1])) errs.push(`${path.basename(script)} 沒有 --${m[1]} 這個選項`); }
  }
}

/* ------------------------------------------------------------------ plan.md (CARD PLAN rows) */
function parsePlan(planFile) {
  if (!planFile || !fs.existsSync(planFile)) return null;
  const rows = new Map();
  for (const line of read(planFile).split('\n')) {
    const m = /^\|\s*`([^`]+)`\s*\|(.*)\|\s*$/.exec(line); if (!m || !ID_RE.test(m[1])) continue;
    const c = m[2].split('|').map(s => s.trim());
    if (c.length < 12) continue;   // 來源 作者 型態 範圍 檔案 lane wave 相依 自動 預設 規模 風險
    rows.set(m[1], { source: c[0], writer: c[1], kind: c[2], scope: c[3], files: c[4], lane: c[5], wave: c[6], deps: c[7], auto: c[8], def: c[9], size: c[10], risk: c[11] });
  }
  return rows;
}
function laneMap(lanesFile) {
  const map = new Map(); if (!lanesFile || !fs.existsSync(lanesFile)) return map;
  for (const line of read(lanesFile).split('\n')) { const m = /^\|\s*`([^`]+)`(?:\s*\(new\))?\s*\|\s*([A-Z]{2,5})\s*\|/.exec(line); if (m) map.set(m[1], m[2]); }
  return map;
}

/* ------------------------------------------------------------------ the checks for one card */
function sameValue(a, b) {
  const x = String(a).trim().replace(/^[`'"]|[`'"]$/g, ''), y = String(b).trim().replace(/^[`'"]|[`'"]$/g, '');
  if (x === y) return true;
  const nx = Number(x), ny = Number(y);
  if (x !== '' && y !== '' && Number.isFinite(nx) && Number.isFinite(ny)) return Math.abs(nx - ny) < 1e-9;
  return x.toLowerCase() === y.toLowerCase();
}
function checkCard(card, env) {
  const E = card.errors, W = card.warns, fm = card.fm;
  if (!card.sections) return;
  // --- front matter
  for (const k of REQUIRED_FM) if (!(k in fm)) E.push(`front-matter 缺少 ${k}`);
  const id = fm.id; card.id = id;
  if (id && !ID_RE.test(id)) E.push(`id 格式不對：${id}（W0-01 或 A-09 / A-09a）`);
  if (id && card.name !== id) E.push(`檔名 ${card.name}.md 與 id ${id} 不一致`);
  if (fm.kind && !KINDS.includes(fm.kind)) E.push(`kind 要是 ${KINDS.join('｜')}，收到 ${fm.kind}`);
  if (fm.size && !['S', 'M'].includes(fm.size)) E.push(`size 要是 S 或 M（更大就要拆卡），收到 ${fm.size}`);
  if (fm.autodispatch && !['yes', 'no'].includes(fm.autodispatch)) E.push('autodispatch 要是 yes 或 no');
  if (fm.default && !['same', 'fix', 'n/a'].includes(fm.default)) E.push('default 要是 same｜fix｜n/a');
  if (fm.writer && !['A', 'B', 'C'].includes(fm.writer)) E.push('writer 要是 A｜B｜C');
  for (const k of ['source', 'lane', 'depends']) if (k in fm && !Array.isArray(fm[k])) E.push(`${k} 要寫成 [a, b] 清單`);
  if ('wave' in fm && !Number.isInteger(fm.wave)) E.push('wave 要是整數');
  if (fm.written && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(fm.written)) E.push('written 要是 2026-10-24T09:30 這種格式');
  if (fm.title && /^[^:]{1,40}:\s*\S/.test(fm.title) && /explainer/i.test(fm.title)) W.push('title 不要寫成「名稱: 說明」');
  // --- sections: present, exact names, order
  const names = card.sections.map(s => s.name);
  for (const n of SECTIONS) if (!names.includes(n)) E.push(`缺少章節「## ${n}」`);
  const order = names.filter(n => SECTIONS.includes(n));
  if (SECTIONS.every(n => names.includes(n)) && order.join('|') !== SECTIONS.join('|')) E.push(`章節順序要是：${SECTIONS.join(' → ')}`);
  for (const n of names) if (!SECTIONS.includes(n)) W.push(`多出章節「## ${n}」（模板以外的章節會被忽略）`);
  const sec = n => card.sec(n);
  for (const n of ['目標', '為什麼']) if (sec(n) && sec(n).text.trim().length < 6) E.push(`「${n}」是空的`);
  if (sec('目標')) { const one = sec('目標').text.trim().split('\n').filter(l => l.trim()); if (one.length > 3) W.push('「目標」要一句話（超過 3 行）'); }
  // --- 開工
  if (sec('開工')) {
    const cmds = commandLines(sec('開工')).join('\n');
    if (id && !cmds.includes(`card.cjs start ${id}`)) E.push(`「開工」要有 node scripts/index1-5/card.cjs start ${id}`);
    if (id && !cmds.includes(`validate-cards.cjs --card ${id}`)) W.push(`「開工」建議有 validate-cards.cjs --card ${id} --fresh`);
  }
  // --- files
  const files = editableFiles(card); card.files = files;
  if (!files.length && !['measure', 'sweep'].includes(fm.kind) && !(fm.kind === 'doc')) E.push('「可改檔案」沒有任何 `路徑` 項目');
  if (files.length === 0 && ['measure', 'sweep'].includes(fm.kind) && !/無/.test((sec('可改檔案') || { text: '' }).text)) W.push('measure/sweep 卡沒有可改檔案時，請在「可改檔案」寫「無（只產出報告／圖表）」');
  const fileSet = new Set(files.map(f => f.file));
  for (const f of files) {
    const abs = path.resolve(ROOT, f.file);
    if (/^(js|css)\//.test(f.file) || /^prototypes\/index1-5\/js\//.test(f.file)) E.push(`禁止修改：${f.file}`);
    if (/^prototypes\/index1-5\/presets\//.test(f.file) || /^prototypes\/(?!index1-5\/)/.test(f.file) || /^index(?!1-5)[\d-]*\.html$/.test(f.file) || /^index\.html$/.test(f.file)) E.push(`禁止修改：${f.file}`);
    if (!fs.existsSync(abs) && !f.isNew && !env.newFiles.has(f.file)) E.push(`可改檔案不存在（新檔案請標 (new)）：${f.file}`);
    if (fs.existsSync(abs) && f.isNew && !env.newFiles.has(f.file)) W.push(`標了 (new) 但檔案已存在：${f.file}`);
    if (fm.lane && env.lanes.size && !f.file.startsWith('docs/')) { const ln = env.lanes.get(f.file); if (!ln) W.push(`lanes.md 沒有登記這個檔案：${f.file}`); else if (Array.isArray(fm.lane) && !fm.lane.includes(ln)) E.push(`${f.file} 屬於 lane ${ln}，front-matter lane 沒有列出`); }
  }
  if (sec('不可改檔案')) { const t = sec('不可改檔案').text; for (const must of ['prototypes/index1-5/js/', 'presets']) if (!t.includes(must)) E.push(`「不可改檔案」要明寫 ${must}`); }
  // --- anchors
  const rows = anchorRows(card); card.anchors = rows;
  if (!rows) E.push('「錨點」要有 ```anchors 區塊（沒有錨點就寫一行 none）');
  else {
    if (rows.bad.length) for (const b of rows.bad) E.push('錨點行格式錯誤：' + b.slice(0, 160));
    if (!rows.length && !rows.none) E.push('「錨點」區塊是空的（沒有錨點請寫 none）');
    if (rows.none && rows.length) E.push('錨點寫了 none 又有其他行');
    const ids = new Set();
    for (const r of rows) {
      if (ids.has(r.id)) E.push(`錨點 id 重複：${r.id}`); ids.add(r.id);
      if (!ACTIONS.includes(r.action)) { E.push(`${r.id}: ACTION ${r.action} 不合法（${ACTIONS.join('／')}）`); continue; }
      const isTarget = r.action.startsWith('target:'), inList = fileSet.has(r.file);
      if (isTarget && inList) E.push(`${r.id}: ${r.file} 在可改檔案裡，ACTION 不能是 target:*`);
      if (!isTarget && !inList) E.push(`${r.id}: ${r.file} 不在可改檔案裡，只能用 target:*（唯讀目標）`);
      if (/^prototypes\/index1-5\/js\//.test(r.file) && !isTarget) E.push(`${r.id}: 產生檔不能當編輯錨點 ${r.file}`);
      let content = null; const abs = path.resolve(ROOT, r.file);
      if (fs.existsSync(abs)) content = read(abs);
      else if (env.newFiles.has(r.file) || files.find(f => f.file === r.file && f.isNew)) content = norm(stubText(r.file));
      if (content === null) { E.push(`${r.id}: 檔案不存在 ${r.file}`); continue; }
      if (r.action === 'replace-file') { if (r.anchor !== '') E.push(`${r.id}: replace-file 的 ANCHOR 要是 ""`); continue; }
      if (r.anchor === '') { E.push(`${r.id}: ANCHOR 是空字串`); continue; }
      const a = norm(r.anchor), n = countOcc(content, a);
      if (n === 1) continue;
      if (n === 0 && r.after) {
        const dep = env.cards.get(r.after);
        if (!dep) E.push(`${r.id}: after:${r.after} 找不到那張卡`);
        else if (!Array.isArray(fm.depends) || !env.reaches(id, r.after)) E.push(`${r.id}: after:${r.after} 不在本卡 depends（含間接）裡`);
        else if (!norm(dep.text).includes(a)) E.push(`${r.id}: 錨點沒有出現在 ${r.after} 卡的程式碼裡，無法確認它會被前一張卡寫出來`);
        continue;
      }
      E.push(`${r.id}: 錨點在 ${r.file} 出現 ${n} 次（要剛好 1 次）：${JSON.stringify(a.slice(0, 80))}`);
    }
    // steps reference the anchors
    if (sec('步驟')) for (const r of rows) if (r.id && !new RegExp('\\[' + r.id + '\\]').test(sec('步驟').text)) W.push(`步驟沒有引用 [${r.id}]`);
  }
  // --- steps
  if (sec('步驟')) {
    const t = sec('步驟').text;
    if (!/^\s*1\.\s+/m.test(t)) E.push('「步驟」要用 1. 2. 3. 編號');
    if (['code', 'dial+sweep'].includes(fm.kind) && !sec('步驟').blocks.some(b => b.lang && b.lang !== 'anchors' && !/^(bash|sh|shell|console)$/i.test(b.lang))) E.push('「步驟」要有要貼上的程式碼區塊（```js／```glsl／```css）');
    if (/…|\.\.\.\s*$/m.test(t.replace(/```[\s\S]*?```/g, ''))) W.push('「步驟」文字裡有「…」，請寫出完整內容');
    for (const b of sec('步驟').blocks) if (b.lang !== 'anchors' && /^(js|glsl|css|cjs)$/i.test(b.lang) && /(\.\.\.|…)\s*$/m.test(b.lines.join('\n'))) W.push('程式碼區塊結尾有 … ，要寫成完整程式碼');
  }
  // --- params
  if (sec('參數')) {
    const t = sec('參數').text, tab = t.split('\n').filter(l => /^\s*\|/.test(l));
    if (!tab.length) { if (!/無新增參數/.test(t)) E.push('「參數」要有表格，或寫「無新增參數」'); }
    else {
      const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(s => s.trim());
      const head = cells(tab[0]);
      if (head.join('|') !== PARAM_HEADER.join('|')) E.push(`參數表標題要是：| ${PARAM_HEADER.join(' | ')} |`);
      else {
        const body = tab.slice(2);
        if (!body.length) E.push('參數表沒有資料列');
        for (const l of body) {
          const c = cells(l);
          if (c.length !== PARAM_HEADER.length) { E.push('參數列欄位數不對：' + l.slice(0, 80)); continue; }
          if (!/^[\w.]+$/.test(c[1].replace(/`/g, ''))) E.push(`參數 key 格式不對：${c[1]}`);
          const color = /^#?[0-9a-f]{6}$/i.test(c[5].replace(/[`'"#]/g, '')) && c[2] === '-';
          if (!color && c[2] !== '-' && [2, 3, 4].some(i => !Number.isFinite(Number(c[i].replace(/`/g, ''))))) E.push(`參數 ${c[1]} 的 min/max/step 要是數字（顏色與旗標用 -）`);
          if (fm.default === 'same' && !sameValue(c[5], c[6])) E.push(`參數 ${c[1]}：default ${c[5]} 不等於現況值 ${c[6]}（default: same 的卡，預設必須等於現在的畫面）`);
        }
      }
    }
  }
  // --- commands
  const cmdText = commandLines(sec('驗證指令')); card.commands = cmdText;
  if (sec('驗證指令')) {
    if (!cmdText.length) E.push('「驗證指令」沒有 ```bash 區塊');
    const errs = []; for (const l of cmdText) checkCommand(l, errs, { id, virtualScripts: env.virtualScripts });
    for (const e of errs) E.push('驗證指令：' + e);
    if (['code', 'dial+sweep'].includes(fm.kind) && id && !cmdText.some(l => l.includes('card.cjs build'))) E.push('code／dial+sweep 卡的「驗證指令」要有 card.cjs build <ID>（上鎖的建置）');
    if (fm.kind === 'dial+sweep' && !cmdText.some(l => /sweep\.cjs|shot\.cjs|world-shot\.cjs|wheel\.cjs/.test(l))) E.push('dial+sweep 卡要有 sweep.cjs／shot.cjs／world-shot.cjs／wheel.cjs 產出對照表');
    if (fm.kind === 'sweep' && !cmdText.some(l => /sweep\.cjs|shot\.cjs|world-shot\.cjs|wheel\.cjs/.test(l))) E.push('sweep 卡要有 sweep.cjs／shot.cjs／world-shot.cjs／wheel.cjs');
    if (sec('還原')) { const errs2 = []; for (const l of commandLines(sec('還原'))) checkCommand(l, errs2, { id, virtualScripts: env.virtualScripts }); for (const e of errs2) E.push('還原：' + e); }
  }
  // --- acceptance
  if (sec('驗收')) {
    const items = sec('驗收').lines.filter(l => /^\s*[-*]\s/.test(l));
    if (items.length < 2) E.push('「驗收」至少 2 條 - [ ] AC1: … — 證據: …');
    items.forEach(l => { if (!/^\s*-\s+\[ \]\s+AC\d+:\s+.+\s+(?:—|--)\s*證據:\s*\S+/.test(l)) E.push('驗收行格式要是「- [ ] AC1: 條件 — 證據: 工具／檔名／數字」：' + l.trim().slice(0, 90)); });
    const all = items.join('\n');
    if (!/errors\s*\[\s*\]/.test(all) && !['doc'].includes(fm.kind)) E.push('驗收要有一條 errors []（頁面錯誤為空）');
    if (fm.default === 'same' && ['code', 'dial+sweep'].includes(fm.kind) && !/預設[^\n]*(不變|相同|等於|Δ)/.test(all)) E.push('default: same 的卡，驗收要有一條「預設值畫面不變（Δ …）」');
    if (fm.kind === 'dial+sweep' && !/sheet/.test(all)) E.push('dial+sweep 卡的驗收要有一條產出 sheet.jpg（對照表）');
    if (!/[\d]|\.jpg|\.json|\.png|exit|ok:\s*true/.test(all)) W.push('驗收沒有任何數字或檔名，客觀性不足');
  }
  // --- revert / report / failures
  if (sec('還原') && id && !sec('還原').text.includes(`card.cjs abort ${id}`)) E.push(`「還原」要寫 node scripts/index1-5/card.cjs abort ${id}`);
  if (sec('回報') && !/回報格式/.test(sec('回報').text)) E.push('「回報」要寫「用主提示詞的回報格式」');
  if (sec('常見失敗與處理')) {
    const n = sec('常見失敗與處理').lines.filter(l => /^\s*[-*]\s*症狀/.test(l)).length;
    if (n < 2) E.push('「常見失敗與處理」至少 2 條「- 症狀：… → 處理：…」');
    if (!/錨點/.test(sec('常見失敗與處理').text)) E.push('「常見失敗與處理」要有一條講「錨點出現 0 次或多次」');
  }
  // --- depends / plan / inputs
  if (Array.isArray(fm.depends)) for (const d of fm.depends) {
    if (/^ext:/.test(d)) continue;
    if (!ID_RE.test(d)) { E.push(`depends 的卡號格式不對：${d}`); continue; }
    if (d === id) E.push('depends 不能含自己');
    if (!env.cards.has(d) && !(env.plan && env.plan.has(d))) E.push(`depends 的卡不存在（卡檔與 plan.md 都找不到）：${d}`);
    else if (!env.cards.has(d)) card.pending = (card.pending || []).concat(d);
  }
  if (Array.isArray(fm.inputs)) for (const f of fm.inputs) if (!fs.existsSync(path.resolve(ROOT, f))) W.push(`inputs 還沒就緒：${f}`);
  if (env.plan && env.plan.has(id)) {
    const p = env.plan.get(id);
    const set = s => new Set(String(s).split(/[,，\s]+/).map(x => x.replace(/`/g, '')).filter(x => x && x !== '—' && x !== '-'));
    const eq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
    const mism = (what, got, want) => W.push(`與 plan.md 不一致：${what} 卡上是 ${got}，plan 是 ${want}`);
    if (fm.writer && p.writer !== fm.writer) mism('writer', fm.writer, p.writer);
    if (fm.wave != null && String(p.wave) !== String(fm.wave)) mism('wave', fm.wave, p.wave);
    if (Array.isArray(fm.lane) && !eq(new Set(fm.lane.filter(l => l !== 'DOC' || fm.lane.length === 1)), set(p.lane.replace(/\+/g, ',')))) mism('lane', fm.lane.join('+'), p.lane);
    if (Array.isArray(fm.depends) && !eq(new Set(fm.depends), set(p.deps))) mism('depends', fm.depends.join(','), p.deps);
    if (fm.kind && p.kind !== fm.kind) mism('kind', fm.kind, p.kind);
    const wantAuto = /^(自動|自動\(量測\))/.test(p.auto) ? 'yes' : 'no';
    if (fm.autodispatch && fm.autodispatch !== wantAuto) mism('autodispatch', fm.autodispatch, wantAuto + '（' + p.auto + '）');
  }
}

/* ------------------------------------------------------------------ run */
function loadDir(dir) {
  const cards = new Map(), list = [];
  if (!fs.existsSync(dir)) return { cards, list };
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md') && !/^(README|index)/i.test(f)).sort()) {
    const c = parseCard(path.join(dir, f)); list.push(c);
    const id = c.fm && c.fm.id; if (id) { if (cards.has(id)) c.errors.push(`id ${id} 重複（也在 ${path.basename(cards.get(id).file)}）`); else cards.set(id, c); }
  }
  return { cards, list };
}
function makeEnv(cards, plan, lanes) {
  const reachCache = new Map();
  const reaches = (from, to) => {
    const key = from + '>' + to; if (reachCache.has(key)) return reachCache.get(key);
    const seen = new Set(), stack = [from]; let ok = false;
    while (stack.length) { const x = stack.pop(); const c = cards.get(x); if (!c || !Array.isArray(c.fm.depends)) continue; for (const d of c.fm.depends) { if (d === to) { ok = true; stack.length = 0; break; } if (!seen.has(d)) { seen.add(d); stack.push(d); } } }
    reachCache.set(key, ok); return ok;
  };
  // files that earlier cards create: any card that depends (even indirectly) on the creator may name them
  const newFiles = new Set();
  for (const c of cards.values()) for (const f of editableFiles(c)) if (f.isNew) newFiles.add(f.file);
  // scripts the cards create (none expected); kept for symmetry
  return { cards, plan, lanes, reaches, newFiles, virtualScripts: new Set() };
}
function conflicts(cards) {
  const out = [], list = [...cards.values()].filter(c => c.fm && c.fm.id && c.sections), byFile = new Map();
  for (const c of list) for (const f of editableFiles(c)) { if (!byFile.has(f.file)) byFile.set(f.file, []); byFile.get(f.file).push(c); }
  const reachCache = new Map();
  const reach = (a, b) => { const k = a + '>' + b; if (reachCache.has(k)) return reachCache.get(k); const seen = new Set(), st = [a]; let ok = false; while (st.length && !ok) { const x = st.pop(), c = cards.get(x); if (!c || !Array.isArray(c.fm.depends)) continue; for (const d of c.fm.depends) { if (d === b) { ok = true; break; } if (!seen.has(d)) { seen.add(d); st.push(d); } } } reachCache.set(k, ok); return ok; };
  for (const [file, cs] of byFile) for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i].fm.id, b = cs[j].fm.id;
    if (cs[i].fm.autodispatch === 'no' && cs[j].fm.autodispatch === 'no') continue;   // both wait for the client/a report: card.cjs claims keep them apart, whichever input arrives first goes first
    if (!reach(a, b) && !reach(b, a)) out.push(`${a} 與 ${b} 都要改 ${file}，但 depends 沒有先後（會同時動工）`);
  }
  return out;
}
function main(argv) {
  const o = { dir: path.join(ROOT, 'docs', 'haiku-plan', 'cards'), plan: path.join(ROOT, 'docs', 'haiku-plan', 'plan.md'), lanes: path.join(ROOT, 'docs', 'haiku-plan', 'lanes.md') };
  const flags = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') o.dir = path.resolve(ROOT, argv[++i]); else if (a === '--card') o.card = argv[++i]; else if (a === '--plan') o.plan = path.resolve(ROOT, argv[++i]);
    else if (['--conflicts', '--fresh', '--coverage', '--strict', '--json', '--quiet', '--help', '-h'].includes(a)) flags.add(a.replace(/^-+/, ''));
    else { console.error('不認得的選項 ' + a + '\n用法見檔案開頭的註解'); return 2; }
  }
  if (flags.has('help') || flags.has('h')) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[\s\S]*?\/\*\s*/, '')); return 0; }
  const { cards, list } = loadDir(o.dir);
  const plan = parsePlan(o.plan), lanes = laneMap(o.lanes), env = makeEnv(cards, plan, lanes);
  let targets = list;
  if (o.card) { targets = list.filter(c => c.fm && c.fm.id === o.card); if (!targets.length) { console.error(`找不到卡 ${o.card}（${rel(o.dir)}）`); return 1; } }
  for (const c of targets) checkCard(c, env);
  const extra = [];
  if (flags.has('fresh')) for (const c of targets) {
    const stamp = c.fm && c.fm.written ? Date.parse(c.fm.written) : NaN; if (!Number.isFinite(stamp)) continue;
    const watch = new Set([...(c.anchors || []).map(r => r.file), ...(c.files || []).map(f => f.file), 'prototypes/index1-5/build.cjs', 'docs/haiku-plan/lanes.md']);
    for (const f of watch) { const abs = path.resolve(ROOT, f); if (fs.existsSync(abs) && fs.statSync(abs).mtimeMs > stamp + 1000) c.warns.push(`卡寫好之後 ${f} 又被改過（${new Date(fs.statSync(abs).mtimeMs).toLocaleString('zh-TW', { hour12: false })}）；錨點仍已逐一重新驗證`); }
  }
  if (flags.has('conflicts')) for (const m of conflicts(cards)) extra.push('衝突：' + m);
  if (flags.has('coverage') && plan) {
    for (const [id, p] of plan) if (!cards.has(id) && !/待補/.test(p.auto)) extra.push(`缺卡：plan.md 有 ${id}（${p.scope}）但 ${rel(o.dir)} 沒有`);
    for (const id of cards.keys()) if (!plan.has(id)) extra.push(`計畫外的卡：${id} 不在 plan.md 的卡片計畫裡`);
  }
  let nErr = 0, nWarn = 0;
  const rows = targets.map(c => { nErr += c.errors.length; nWarn += c.warns.length; return c; });
  nErr += extra.length;
  if (flags.has('json')) { console.log(JSON.stringify({ cards: rows.map(c => ({ id: c.fm && c.fm.id || c.name, errors: c.errors, warns: c.warns })), extra }, null, 2)); return nErr || (flags.has('strict') && nWarn) ? 1 : 0; }
  const pad = (s, n) => String(s).padEnd(n);
  if (!flags.has('quiet')) {
    console.log(pad('卡號', 9) + pad('wave', 5) + pad('lane', 14) + pad('kind', 11) + pad('錨點', 5) + '結果');
    for (const c of rows) {
      const fm = c.fm || {}, n = (c.anchors || []).length;
      console.log(pad(fm.id || c.name, 9) + pad(fm.wave ?? '-', 5) + pad(Array.isArray(fm.lane) ? fm.lane.join('+') : '-', 14) + pad(fm.kind || '-', 11) + pad(n || '-', 5) + (c.errors.length ? `FAIL(${c.errors.length})` : c.warns.length ? `OK+${c.warns.length}警告` : 'OK') + (c.pending ? `  (待補的相依：${c.pending.join(',')})` : ''));
    }
  }
  for (const c of rows) { for (const e of c.errors) console.log(`  ✗ ${(c.fm && c.fm.id) || c.name}: ${e}`); if (!flags.has('quiet') || o.card) for (const w of c.warns) console.log(`  ! ${(c.fm && c.fm.id) || c.name}: ${w}`); }
  for (const e of extra) console.log('  ✗ ' + e);
  console.log(`\n${rows.length} 張卡，${nErr} 個錯誤，${nWarn} 個警告${flags.has('strict') && nWarn ? '（--strict：警告也算失敗）' : ''}`);
  return nErr || (flags.has('strict') && nWarn) ? 1 : 0;
}

module.exports = { parseCard, parseFrontMatter, parseSections, editableFiles, anchorRows, checkCard, loadDir, makeEnv, conflicts, parsePlan, laneMap, stubText, countOcc, norm, ROOT, SECTIONS };
if (require.main === module) process.exit(main(process.argv.slice(2)));
