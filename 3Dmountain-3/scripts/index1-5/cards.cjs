'use strict';
/* S3 → S4 navigation check (ported from scratchpad/asc/navcheck.cjs): end of journey → real wheel into the cards →
   wheel back out → the chapter CTA. Prints each state; exits 1 when the cards do not open on wheel / CTA or do not
   close on the reverse wheel. One screenshot per step as evidence (+ sheet). */
const path = require('node:path');
const L = require('./lib.cjs');
const USAGE = `cards.cjs — 卡牌轉場導覽檢查（滾輪進入／滾輪退回／CTA 按鈕）
用法：node scripts/index1-5/cards.cjs [--w 1440 --h 900] [--query "..."] [--out 名稱]
  步驟：到旅程終點（FOUR PATHS）→ 往下滾 14 格 → 卡牌要打開 → 往上滾 18 格 → 卡牌要關上
        → 回到終點按 FOUR PATHS 的按鈕（.fi-copy-panel.is-active .fi-copy-action）→ 卡牌要打開
  --down / --up   滾輪格數（預設 14 / 18）
  --settle        每步之後等幾毫秒（預設 3000；CTA 之後 4500）
輸出：每步一行狀態（prog、max、open、tr＝轉場 0–1、next 按鈕字），PASS/FAIL；截圖 .qa/index1-5/<名稱>/
結束碼：0 全部通過｜1 有一步不對或頁面有錯｜2 指令打錯｜3 超時`;

L.main('cards', {
  usage: USAGE, timeout: 600,
  spec: { w: 'value', h: 'value', phone: 'bool', query: 'value', out: 'value', down: 'value', up: 'value', settle: 'value' },
}, async o => {
  const down = L.opt(o, 'down', 14, { min: 1, max: 200, int: true }), up = L.opt(o, 'up', 18, { min: 1, max: 200, int: true });
  const settle = L.opt(o, 'settle', 3000, { min: 0 });
  const vp = L.viewport(o), dir = L.outDir('cards', o.out);
  const s = await L.openSession('cards', o);
  const { page, log } = s;
  const st = () => page.evaluate(() => {
    const s = window.__MONTIS_STUDY__, P = s.portfolio, n = document.querySelector('.fi-footer-next span, [data-next] span');
    return { prog: +s.journey.progress.toFixed(2), max: +s.journey.max.toFixed(2), open: !!(P && P.open), tr: +((P && P.transition) ?? 0).toFixed(2), next: n ? n.textContent.trim() : null };
  });
  const steps = [], cells = [];
  const step = async (name, expectOpen) => {
    const state = await st();
    const ok = expectOpen === undefined ? true : state.open === expectOpen;
    const file = path.join(dir, `${String(steps.length + 1).padStart(2, '0')}-${name.replace(/\s+/g, '-')}.jpg`);
    await L.capture(page, file, 78);
    steps.push({ step: name, expect: expectOpen === undefined ? null : expectOpen ? 'open' : 'closed', ok, ...state, file: L.abs(file) });
    cells.push({ label: `${name} · open ${state.open} · tr ${state.tr} · p ${state.prog}${ok ? '' : ' ✗'}`, file });
    console.log(name.padEnd(16), JSON.stringify(state), expectOpen === undefined ? '' : ok ? 'ok' : `FAIL (expected ${expectOpen ? 'open' : 'closed'})`);
  };
  const toEnd = async () => { const f = await L.fly(page, 'max'); if (!f.ok) throw new Error(`旅程沒有到終點（progress ${f.progress} / max ${f.max}）`); };

  await toEnd(); await page.waitForTimeout(2500);
  await step('at end', false);
  await page.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < down; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(140); }
  await page.waitForTimeout(settle);
  await step('after wheel down', true);
  for (let i = 0; i < up; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(140); }
  await page.waitForTimeout(settle);
  await step('after wheel up', false);
  // the chapter CTA at FOUR PATHS
  await toEnd(); await page.waitForTimeout(1500);
  const cta = page.locator('.fi-copy-panel.is-active .fi-copy-action').first();
  let ctaError = null;
  await cta.click({ timeout: 10000 }).catch(e => { ctaError = L.clip(e.message, 160); console.log('cta click failed:', ctaError); });
  await page.waitForTimeout(Math.max(settle, 4500));
  await step('after CTA', true);

  const failed = steps.filter(x => !x.ok).map(x => x.step);
  if (ctaError) failed.push('CTA click: ' + ctaError);
  const sheet = await L.contactSheet(s.context, cells, path.join(dir, 'sheet.jpg'), { cols: 4, title: `cards · ${L.vpName(vp)}${o.query ? ' · ' + o.query : ''} · ${new Date().toLocaleString('zh-TW', { hour12: false })}` });
  const result = { ok: !failed.length && !log.errors.length, failed, steps, url: s.url, viewport: vp, sheet: L.abs(sheet), ...L.logJson(log) };
  L.writeJson(path.join(dir, 'run.json'), result);
  console.log('sheet', L.abs(sheet));
  L.printLog(log);
  console.log(result.ok ? 'PASS' : `FAIL ${JSON.stringify(failed)}${log.errors.length ? ' + page errors' : ''}`);
  return result.ok ? 0 : 1;
});
