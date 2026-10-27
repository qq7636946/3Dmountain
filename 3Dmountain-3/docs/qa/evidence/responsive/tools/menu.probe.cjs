'use strict';
/* menu.probe.cjs — the MENU dialog + header on the current viewport (QA only, read-only on the site).
   Env: MENU_DIR output dir, MENU_AT journey positions (default "0,5.56,12.3").
   Checks: open via the MENU button, dialog box vs viewport, overflow/scroll, tap targets, Tab focus trap, Escape closes, focus returns,
   a menu link navigates, header rects (brand logo vs EXPLORE/MENU) and screenshots in both states. */
const fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp }) => {
  const dir = path.resolve(process.env.MENU_DIR || '.qa/index1-5/menu');
  fs.mkdirSync(dir, { recursive: true });
  const ats = (process.env.MENU_AT || '0,5.56,12.3').split(',').map(Number);
  const out = [];
  for (const p of ats) {
    await L.fly(page, p); await page.waitForTimeout(1600);
    const rec = { p };
    rec.header = await page.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)]; };
      return { brand: r('.fi-brand-logo2'), brandArt: r('.fi-brand-art'), explore: r('.fi-explore'), menu: r('.fi-menu-toggle'), rail: r('.fi-chapters,.fi-chapter-rail,.fi-rail'), sound: r('.fi-sound'), next: r('.fi-footer-next'), vw: innerWidth, vh: innerHeight };
    });
    fs.writeFileSync(path.join(dir, `closed-p${p}.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 }));
    const btn = await page.$('.fi-menu-toggle');
    if (!btn) { rec.err = 'no .fi-menu-toggle'; out.push(rec); continue; }
    await btn.click({ timeout: 5000 }).catch(e => { rec.clickErr = String(e.message).slice(0, 200); });
    await page.waitForTimeout(1100);
    rec.menu = await page.evaluate(() => {
      const m = document.querySelector('#fi-menu') || document.querySelector('.fi-menu');
      if (!m) return null;
      const cs = getComputedStyle(m), q = m.getBoundingClientRect();
      const links = [...m.querySelectorAll('button,a')].map(e => { const b = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30), w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left), y: Math.round(b.top), onscreen: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth }; });
      const scroller = [m, ...m.querySelectorAll('*')].find(e => { const c = getComputedStyle(e); return /(auto|scroll)/.test(c.overflowY) && e.scrollHeight > e.clientHeight + 2; });
      return { role: m.getAttribute('role'), modal: m.getAttribute('aria-modal'), open: !m.hidden && cs.display !== 'none' && cs.visibility !== 'hidden', op: cs.opacity, rect: [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)], links, scrolls: !!scroller, vw: innerWidth, vh: innerHeight, active: document.activeElement && (document.activeElement.className || document.activeElement.tagName), bodyOverflow: getComputedStyle(document.body).overflow, cls: m.className };
    });
    fs.writeFileSync(path.join(dir, `open-p${p}.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 }));
    // focus trap
    const seq = [];
    for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); seq.push(await page.evaluate(() => { const a = document.activeElement; if (!a) return null; const inMenu = !!a.closest('#fi-menu,.fi-menu'); return (inMenu ? 'M:' : 'X:') + (a.innerText || a.className || a.tagName).toString().trim().slice(0, 18).replace(/\s+/g, ' '); })); }
    rec.tabSeq = seq;
    await page.keyboard.press('Escape'); await page.waitForTimeout(900);
    rec.afterEsc = await page.evaluate(() => { const m = document.querySelector('#fi-menu') || document.querySelector('.fi-menu'); const cs = m && getComputedStyle(m); const a = document.activeElement; return { open: m ? (!m.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > .05) : null, cls: m && m.className, active: a && (a.className || a.tagName) }; });
    // reopen and click the 3rd link
    if (rec.afterEsc.open) { await page.keyboard.press('Escape'); }
    await btn.click({ timeout: 5000 }).catch(() => { }); await page.waitForTimeout(900);
    const before = (await L.readState(page)).progress;
    const link = (await page.$$('#fi-menu .fi-menu-links button, .fi-menu .fi-menu-links button'))[2];
    if (link) { await link.click({ timeout: 5000 }).catch(e => { rec.linkErr = String(e.message).slice(0, 160); }); await page.waitForTimeout(2600); rec.linkNav = { before, after: (await L.readState(page)).progress }; fs.writeFileSync(path.join(dir, `after-link-p${p}.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 })); }
    rec.menuAfterLink = await page.evaluate(() => { const m = document.querySelector('#fi-menu') || document.querySelector('.fi-menu'); const cs = m && getComputedStyle(m); return m ? (!m.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > .05) : null; });
    out.push(rec);
  }
  fs.writeFileSync(path.join(dir, 'menu.json'), JSON.stringify({ vp, out }, null, 1));
  return { ok: true, out };
};
