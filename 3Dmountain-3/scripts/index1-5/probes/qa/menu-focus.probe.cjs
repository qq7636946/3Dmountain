'use strict';
/* QA · the MENU dialog, step by step: where focus goes on open, whether Tab stays inside, what closes it (Esc, CLOSE, outside click, items),
   what wheel / keys do while it is open, where focus lands afterwards, and the same by keyboard only (Enter / Space on MENU).
   Run: node scripts/index1-5/probe.cjs --script scripts/index1-5/probes/qa/menu-focus.probe.cjs --out qa-menu-focus [--phone] */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp, log }) => {
  const out = { steps: [] }; await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });
  const snap = async label => { const o = await page.evaluate(() => { const d = document.querySelector('dialog.fi-menu'), e = document.activeElement; return { dialogOpen: d.open, modal: d.matches(':modal'), active: e === document.body ? 'BODY' : (e.className && e.className.toString().split(/\s+/)[0] || e.tagName.toLowerCase()) + ':' + (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24), inDialog: !!e.closest('dialog'), expanded: document.querySelector('.fi-menu-toggle').getAttribute('aria-expanded'), rect: (() => { const r = d.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })() }; }); const s = await Q.study(page); out.steps.push({ label, ...o, p: s.p }); return o; };
  await L.fly(page, 2.96); await page.waitForTimeout(800); await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.click('.fi-menu-toggle'); await page.waitForTimeout(150); await snap('click MENU +150ms'); await page.waitForTimeout(700); await snap('click MENU +850ms');
  for (let i = 0; i < 9; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(100); await snap('Tab ' + (i + 1)); }
  await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(100); await snap('Shift+Tab');
  for (const k of ['ArrowDown', 'PageDown', 'End', 'Space']) { await page.keyboard.press(k); await page.waitForTimeout(250); await snap('key ' + k); }
  await page.mouse.wheel(0, 240); await page.waitForTimeout(300); await snap('wheel 240');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500); await snap('Escape');
  // keyboard only: focus the MENU toggle with Tab from the document start, Enter
  await page.evaluate(() => { document.getElementById('qa-start')?.remove(); const s = document.createElement('span'); s.id = 'qa-start'; s.tabIndex = -1; document.body.prepend(s); s.focus(); });
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab'); await page.waitForTimeout(150); await snap('keyboard: after 6 Tabs (expect MENU)');
  await page.keyboard.press('Enter'); await page.waitForTimeout(700); await snap('Enter on MENU');
  await page.keyboard.press('Tab'); await page.waitForTimeout(100); await snap('Tab inside menu 1'); await page.keyboard.press('Tab'); await page.waitForTimeout(100); await snap('Tab inside menu 2');
  await page.keyboard.press('Enter'); await page.waitForTimeout(2500); await snap('Enter on a menu item');
  await Q.shot(page, 'menu-keyboard-after-item', 66).catch(() => { });
  // Space on MENU
  await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(100); await snap('refocus');
  // outside click positions
  await page.click('.fi-menu-toggle'); await page.waitForTimeout(700);
  const pts = [[4, 4], [vp.width - 4, 4], [4, vp.height - 4], [vp.width - 4, vp.height - 4], [vp.width / 2, vp.height - 4]];
  out.outside = [];
  for (const [x, y] of pts) { await page.mouse.click(x, y); await page.waitForTimeout(450); const open = await page.evaluate(() => document.querySelector('dialog.fi-menu').open); out.outside.push({ x: Math.round(x), y: Math.round(y), closedIt: !open }); if (!open) { await page.click('.fi-menu-toggle'); await page.waitForTimeout(700); } }
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await Q.shot(page, 'menu-open-desktop' + (vp.phone ? '-phone' : ''), 66).catch(() => { });
  const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'menu-focus' + (vp.phone ? '-phone' : '') + '.json'), JSON.stringify(out, null, 1));
  return { ok: true, steps: out.steps.map(s => `${s.label} => open=${s.dialogOpen} modal=${s.modal} active=${s.active} inDialog=${s.inDialog}`), outside: out.outside };
};
