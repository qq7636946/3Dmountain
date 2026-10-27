'use strict';
/* make-prompts — assembles one copy-paste prompt per task card.
   node scripts/index1-5/make-prompts.cjs [--card ID] [--cards docs/haiku-plan/cards] [--out docs/haiku-plan/prompts]
        [--master docs/haiku-plan/prompts/00-MASTER-PROMPT.md] [--no-validate] [--force]
   Writes <out>/<card-id>.txt = master prompt body (its leading "# …" title and "> …" quote lines dropped)
   + a "任務：<id> <title>" block + the card text (front-matter removed), and <out>/ALL-PROMPTS.md
   (index table by wave and lane, then every prompt in its own fenced block so the client can copy one at a time).
   Cards that fail validate-cards are skipped (listed) unless --force. Exit 0 = all written, 1 = some skipped / errors, 2 = usage. */
const fs = require('node:fs'), path = require('node:path');
const V = require('./validate-cards.cjs');

const ROOT = V.ROOT;
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function masterBody(file) {
  const lines = V.norm(fs.readFileSync(file, 'utf8')).split('\n');
  let i = 0;
  while (i < lines.length && (/^\s*$/.test(lines[i]) || /^#\s/.test(lines[i]) || /^>/.test(lines[i]))) i++;
  return lines.slice(i).join('\n').replace(/\s+$/, '') + '\n';
}
const fenceFor = text => { let max = 2; for (const m of text.matchAll(/`+/g)) max = Math.max(max, m[0].length); return '`'.repeat(max + 1); };

function main(argv) {
  const o = { cards: path.join(ROOT, 'docs', 'haiku-plan', 'cards'), out: path.join(ROOT, 'docs', 'haiku-plan', 'prompts'), master: path.join(ROOT, 'docs', 'haiku-plan', 'prompts', '00-MASTER-PROMPT.md'), validate: true, force: false, card: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--card') o.card = argv[++i]; else if (a === '--cards') o.cards = path.resolve(ROOT, argv[++i]); else if (a === '--out') o.out = path.resolve(ROOT, argv[++i]);
    else if (a === '--master') o.master = path.resolve(ROOT, argv[++i]); else if (a === '--no-validate') o.validate = false; else if (a === '--force') o.force = true;
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[\s\S]*?\/\*\s*/, '')); return 0; }
    else { console.error('不認得的選項 ' + a); return 2; }
  }
  if (!fs.existsSync(o.master)) { console.error('找不到主提示詞 ' + rel(o.master)); return 2; }
  const master = masterBody(o.master);
  const { cards, list } = V.loadDir(o.cards);
  if (!list.length) { console.error('沒有任何卡：' + rel(o.cards)); return 1; }
  const plan = V.parsePlan(path.join(ROOT, 'docs', 'haiku-plan', 'plan.md')), lanes = V.laneMap(path.join(ROOT, 'docs', 'haiku-plan', 'lanes.md'));
  const env = V.makeEnv(cards, plan, lanes);
  fs.mkdirSync(o.out, { recursive: true });
  const done = [], skipped = [];
  for (const c of list) {
    const id = c.fm && c.fm.id; if (!id) { skipped.push([c.name, c.errors.join('；') || '沒有 id']); continue; }
    if (o.card && id !== o.card) continue;
    if (o.validate) { V.checkCard(c, env); if (c.errors.length && !o.force) { skipped.push([id, c.errors[0] + (c.errors.length > 1 ? `（另 ${c.errors.length - 1} 個）` : '')]); continue; } }
    const prompt = master + `\n---\n\n## 任務：${id} ${c.fm.title}\n\n` + c.body.replace(/^\s+/, '').replace(/\s+$/, '') + '\n';
    fs.writeFileSync(path.join(o.out, id + '.txt'), prompt, 'utf8');
    done.push({ id, fm: c.fm, prompt });
  }
  // the index: only when building everything (a single --card run must not shrink it)
  if (!o.card) {
    done.sort((a, b) => a.fm.wave - b.fm.wave || a.id.localeCompare(b.id, 'en'));
    let md = '# 全部任務提示詞（自動產生，請勿手改）\n\n';
    md += `產生時間：${new Date().toLocaleString('zh-TW', { hour12: false })}　主提示詞：\`${rel(o.master)}\`　卡片：\`${rel(o.cards)}\`　共 ${done.length} 張`;
    if (skipped.length) md += `（另有 ${skipped.length} 張沒通過驗證，未列入）`;
    md += '\n\n用法：從下面的索引找到卡號，複製該卡下方整個灰色區塊（或直接用 `prompts/<卡號>.txt`）貼給 Haiku。一次只派一張；派之前看 `waves.md` 的順序與 `lanes.md` 的併行規則。\n\n';
    md += '## 索引（依 wave、卡號）\n\n| wave | 卡號 | lane | 型態 | 規模 | 自動派發 | 預設 | 相依 | 標題 |\n|---|---|---|---|---|---|---|---|---|\n';
    for (const d of done) { const fm = d.fm; md += `| ${fm.wave} | [${d.id}](#${d.id.toLowerCase()}) | ${(fm.lane || []).join('+')} | ${fm.kind} | ${fm.size} | ${fm.autodispatch} | ${fm.default} | ${(fm.depends || []).join(', ') || '—'} | ${String(fm.title).replace(/\|/g, '／')} |\n`; }
    const lanesSeen = new Map();
    for (const d of done) for (const l of d.fm.lane || []) { if (!lanesSeen.has(l)) lanesSeen.set(l, []); lanesSeen.get(l).push(d.id); }
    md += '\n## 依 lane 排隊（同一 lane 的卡一次只能派一張，照這個順序）\n\n';
    for (const [l, ids] of [...lanesSeen].sort()) md += `- **${l}**：${ids.join(' → ')}\n`;
    md += '\n---\n';
    for (const d of done) { const f = fenceFor(d.prompt); md += `\n## ${d.id}\n\n_${d.fm.title}_　wave ${d.fm.wave}｜lane ${(d.fm.lane || []).join('+')}｜${d.fm.kind}｜${d.fm.autodispatch === 'yes' ? '可自動派發' : '需先確認'}\n\n${f}text\n${d.prompt.replace(/\s+$/, '')}\n${f}\n`; }
    fs.writeFileSync(path.join(o.out, 'ALL-PROMPTS.md'), md, 'utf8');
  }
  console.log(`寫出 ${done.length} 份提示詞到 ${rel(o.out)}/${o.card ? '' : '（含 ALL-PROMPTS.md）'}`);
  for (const [id, why] of skipped) console.log(`  略過 ${id}：${why}`);
  return skipped.length && !o.force ? 1 : 0;
}
module.exports = { masterBody, fenceFor };
if (require.main === module) process.exit(main(process.argv.slice(2)));
