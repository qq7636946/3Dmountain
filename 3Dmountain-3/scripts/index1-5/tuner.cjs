'use strict';
/* Are the tuner groups there? (ported from scratchpad/asc/tunercheck.cjs). Loads with ?tune=1&letters=1, reads every
   group heading of the main panel (#tuner .tune-group) plus the letters panel, and matches each requested name as a
   case-insensitive substring of a heading (fallback: anywhere in the panel text). */
const L = require('./lib.cjs');
const USAGE = `tuner.cjs — 檢查參數面板（?tune=1）裡有沒有某些群組
用法：node scripts/index1-5/tuner.cjs --groups "山景打光,山形材質,卡牌轉場"
  --groups   要找的群組名稱（逗號分隔；比對標題的部分文字，不分大小寫）
             不給就只列出所有群組標題
  --rows     另外找參數列的文字（逗號分隔，例如 "陽光強度,雪線高度"）
  --w --h / --phone / --query   同 shot.cjs
輸出：每個群組 found／MISSING（找到的標題、面板、列數），最後 PASS／FAIL
結束碼：0 全部找到｜1 有缺的或頁面有錯｜2 指令打錯｜3 超時`;

L.main('tuner', { usage: USAGE, timeout: 300, spec: { groups: 'value', rows: 'value', w: 'value', h: 'value', phone: 'bool', query: 'value' } }, async o => {
  const list = v => v && v !== true ? String(v).split(',').map(x => x.trim()).filter(Boolean) : [];
  const wanted = list(o.groups), rows = list(o.rows);
  if (o.groups === true) throw new L.UsageError('--groups 要接名稱');
  const s = await L.openSession('tuner', o, { defaults: { tune: '1', letters: '1' } });
  const { page, log } = s;
  await page.waitForFunction(() => document.querySelectorAll('#tuner .tune-group').length > 0, null, { timeout: 30000, polling: 250 })
    .catch(() => { throw new Error('30s 內沒有出現參數面板（#tuner .tune-group）'); });
  await page.waitForTimeout(1500);   // the letters panel is a lazy import
  const panel = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('#tuner .tune-group')].map(g => ({ title: g.dataset.title || (g.querySelector('h3') || {}).textContent || '', rows: g.querySelectorAll('.tune-row').length, panel: 'tuner' }));
    const lp = document.querySelector('.letters-panel');
    const lpHeads = lp ? [...lp.querySelectorAll('h2,h3,h4,summary,.lp-section-title,.lp-title')].map(h => ({ title: h.textContent.trim(), rows: 0, panel: 'letters' })) : [];
    const rowText = [...document.querySelectorAll('#tuner .tune-row, .letters-panel label, .letters-panel .lp-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim());
    return { groups: [...groups, ...lpHeads], text: ((document.querySelector('#tuner') || {}).textContent || '') + '\n' + (lp ? lp.textContent : ''), rowText, letters: !!lp };
  });
  const norm = x => x.toLowerCase().replace(/\s+/g, ' ');
  console.log(`tuner groups (${panel.groups.filter(g => g.panel === 'tuner').length})${panel.letters ? ' + letters panel' : ''}:`);
  console.log('  ' + panel.groups.map(g => `${g.title}${g.rows ? ` [${g.rows}]` : ''}${g.panel === 'letters' ? ' {letters}' : ''}`).join(' | '));
  const missing = [];
  for (const name of wanted) {
    const hit = panel.groups.find(g => norm(g.title).includes(norm(name)));
    if (hit) console.log(`found   ${name} → 「${hit.title}」 (${hit.panel}${hit.rows ? `, ${hit.rows} rows` : ''})`);
    else if (norm(panel.text).includes(norm(name))) console.log(`found   ${name} → (面板文字裡有，但不是群組標題)`);
    else { console.log(`MISSING ${name}`); missing.push(name); }
  }
  for (const name of rows) {
    const hit = panel.rowText.find(t => norm(t).includes(norm(name)));
    if (hit) console.log(`row     ${name} → 「${L.clip(hit, 60)}」`); else { console.log(`MISSING row ${name}`); missing.push('row:' + name); }
  }
  L.printLog(log);
  const ok = !missing.length && !log.errors.length;
  console.log(ok ? 'PASS' : `FAIL ${JSON.stringify(missing)}${log.errors.length ? ' + page errors' : ''}`);
  return ok ? 0 : 1;
});
