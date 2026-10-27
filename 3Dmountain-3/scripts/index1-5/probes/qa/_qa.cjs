'use strict';
/* QA interaction helpers (read-only observation; nothing here edits site code).
   require('./_qa.cjs') from a probe script that lives in scripts/index1-5/probes/qa/ */
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'docs', 'qa', 'evidence', 'interaction');

/* one line of everything that matters about the page state */
const study = page => page.evaluate(() => {
  const s = window.__MONTIS_STUDY__, j = s.journey, P = s.portfolio, W = s.world, r = (v, d = 3) => typeof v === 'number' ? +v.toFixed(d) : v;
  let world = null;
  try { if (W) { const st = W.open ? W.state : null; world = { open: !!W.open, y: st ? Math.round(st.y) : 0, yt: st ? Math.round(st.yt) : 0, maxY: st ? Math.round(st.maxY) : 0 }; } } catch { }
  const wc = document.querySelector('.fiw-canvas'), root = document.querySelector('#fiWorld'), gl = document.querySelector('#gl');
  const vis = el => { if (!el) return null; if (el.checkVisibility) return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !el.closest('[hidden]'); const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.01; };
  return {
    p: r(j.progress), t: r(j.target), max: r(j.max),
    cards: P ? { open: !!P.open, tr: r(P.transition ?? 0), strip: r(P.strip ?? 0) } : null, world,
    ui: { worldVis: root ? !root.hidden && !root.inert : null, worldCanvasVis: vis(wc), glVis: vis(gl), bodyClass: document.body.className.replace(/\s+/g, ' ').trim().slice(0, 140), chapter: document.querySelector('.finnovation-ui')?.dataset.chapter, scene: document.querySelector('.finnovation-ui')?.dataset.scene, menuOpen: !!document.querySelector('dialog.fi-menu')?.open },
  };
});
const short = s => { const w = s.world; return `p=${s.p} t=${s.t}/${s.max} cards=${s.cards ? (s.cards.open ? 'OPEN' : 'closed') + '@' + s.cards.tr : '-'} world=${w ? (w.open ? 'OPEN y=' + w.y + '/' + w.maxY : 'closed') : '-'} worldCanvas=${s.ui.worldCanvasVis} gl=${s.ui.glVis} ch=${s.ui.chapter}`; };

/* descriptor of the focused element (or a given selector) */
const focusInfo = page => page.evaluate(() => {
  const e = document.activeElement; if (!e || e === document.body || e === document.documentElement) return { tag: e && e.tagName.toLowerCase(), body: true };
  const cs = getComputedStyle(e), r = e.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  let op = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { op *= +getComputedStyle(n).opacity; }
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let top = null; if (cx >= 0 && cy >= 0 && cx < vw && cy < vh) { const t = document.elementFromPoint(cx, cy); top = t === e || e.contains(t) || (t && t.contains(e) && false) ? 'self' : (t ? (t.className && t.className.toString().slice(0, 40)) || t.tagName.toLowerCase() : null); }
  const label = (e.getAttribute('aria-label') || e.textContent || e.value || e.href || '').replace(/\s+/g, ' ').trim().slice(0, 36);
  const cls = (e.className && e.className.toString ? e.className.toString() : '').split(/\s+/).slice(0, 2).join('.');
  const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
  const shadow = cs.boxShadow && cs.boxShadow !== 'none';
  return {
    tag: e.tagName.toLowerCase(), cls, label, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    inView: r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh && r.width > 0 && r.height > 0,
    opacity: +op.toFixed(2), covered: top && top !== 'self' ? top : null, hidden: cs.visibility === 'hidden' || cs.display === 'none',
    ring: ring ? `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}` : null, shadow: shadow ? cs.boxShadow.slice(0, 50) : null,
    focusVisible: e.matches(':focus-visible'), inert: !!e.closest('[inert]'), ariaHidden: !!e.closest('[aria-hidden="true"]'),
    inDialog: !!e.closest('dialog'), part: e.closest('[data-world-part]')?.dataset.worldPart || (e.closest('.finnovation-ui') ? 'ui' : '')
  };
});

/* press Tab up to n times from the current focus; stop when the first element comes round again */
async function tabWalk(page, n = 40, opts = {}) {
  const { key = 'Tab', settle = 120 } = opts;
  const out = []; let first = null;
  /* Chrome keeps the sequential-focus starting point after blur(): plant a sentinel at the very start of the document so every walk begins at the document start */
  if (opts.fromStart !== false) await page.evaluate(() => { document.getElementById('qa-start')?.remove(); const s = document.createElement('span'); s.id = 'qa-start'; s.tabIndex = -1; document.body.prepend(s); s.focus(); });
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(key); await page.waitForTimeout(settle);
    const f = await focusInfo(page); const st = await study(page);
    f.i = i; f.state = short(st); out.push(f);
    const id = f.body ? 'BODY' : f.tag + '|' + f.cls + '|' + f.label + '|' + f.rect.join(',');
    if (i === 0) first = id; else if (id === first && i > 1) { f.cycle = true; break; }
    if (f.body && i > 0) { f.cycle = true; break; }
  }
  return out;
}

const key = async (page, k, wait = 350) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
const wheel = async (page, dy, n = 1, gap = 90) => { for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy); await page.waitForTimeout(gap); } };
const shot = async (page, name, q = 80) => { fs.mkdirSync(EVID, { recursive: true }); const f = path.join(EVID, name.replace(/[^\w.\-]/g, '_') + '.jpg'); await page.screenshot({ path: f, type: 'jpeg', quality: q }); return f; };
const click = async (page, sel, opts = {}) => { await page.click(sel, { timeout: 4000, ...opts }); };
/* try a click, report instead of throwing (a button that cannot be clicked is itself a finding) */
const tryClick = async (page, sel, opts = {}) => { try { await page.click(sel, { timeout: 3000, ...opts }); return { ok: true }; } catch (e) { return { ok: false, err: String(e.message || e).split('\n')[0].slice(0, 160) }; } };
/* wait until journey progress is steady (or timeout) */
async function settle(page, ms = 6000) {
  const t0 = Date.now(); let last = null, steady = 0;
  while (Date.now() - t0 < ms) {
    const s = await study(page); const sig = JSON.stringify([s.p, s.world && s.world.y, s.cards && s.cards.tr]);
    if (sig === last) { if (++steady >= 3) return s; } else steady = 0; last = sig; await page.waitForTimeout(160);
  }
  return study(page);
}
/* go to a "named" state with real inputs where possible. names: top, p:<n>, max, cards, world, global, h:<n>, principles, logo, footer */
async function goState(page, L, vp, name, world) {
  if (name === 'top') { await page.evaluate(() => { const j = window.__MONTIS_STUDY__.journey; j.target = 0; }); await settle(page, 9000); return; }
  if (name.startsWith('p:')) { await L.fly(page, name === 'p:max' ? 'max' : +name.slice(2)); await page.waitForTimeout(700); return; }
  if (name === 'max') { await L.fly(page, 'max'); await page.waitForTimeout(900); return; }
  if (name === 'cards') { await L.fly(page, 'max'); await page.waitForTimeout(900); await page.mouse.move(vp.width / 2, vp.height / 2); for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(140); } await page.waitForTimeout(1500); return; }
  const st = world || (await L.enterWorld(page, vp)).state;
  const live = await page.evaluate(() => { const w = window.__MONTIS_STUDY__.world.state; return { pr: w.principles && w.principles.top, lg: w.logo && w.logo.at && w.logo.at.logo, la: w.logo && w.logo.at, maxY: w.maxY }; });
  const H = vp.height;
  const y = name === 'world' ? 0 : name === 'footer' ? live.maxY : name === 'global' ? L.worldY(st, 'g:0.9') : name === 'principles' ? live.pr + H : name === 'logo' ? live.la.s1 + 0.3 * H : L.worldY(st, name);
  await L.jumpWorld(page, y); await page.waitForTimeout(1300);
}
module.exports = { ROOT, EVID, study, short, focusInfo, tabWalk, key, wheel, shot, click, tryClick, settle, goState };
