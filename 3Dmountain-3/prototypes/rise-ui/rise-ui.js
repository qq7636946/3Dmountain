/* RISE UI (2026-11-22) — the chrome of index1-5-canyon-forest-rise-ui.html (see rise-ui.css for the type system and the why).
   That site's set of parts (2023.breakthroughenergy.org: thin inset frame, a top bar with the logo and an Index menu, a centred chapter pill,
   a report button and a menu button, split-arrow buttons, small uppercase captions with a "0 / 4" counter, a row of round chapter icons,
   a cursor ring), drawn in our own style and carrying our own content; plus the underwater act's depth ruler on both edges all the way through.
   · TOP BAR: the page's own logo stays; next to it a separator, INDEX ▾ (the sections, a dropdown) and the sound bars (they press the page's own
     sound button); at the right a CONTACT button (to the last section) and the menu icon (it presses the page's own menu button). The page's
     SOUND OFF / MENU pills are hidden, not removed (rise-ui.css).
   · PILL (top centre): the section's icon, number, Chinese and English names, a progress line; ‹ › go to the previous / next section.
   · RULER: the underwater act's depth ruler (rise.js #xs-sea) carried on through the page; it moves with the journey, then the sea's scroll.
   · FOOT: a caption and the counter (bottom left), the row of round chapter icons (bottom right).
   · CURSOR: a ring and a dot following the pointer (fine pointers only), the ring opening over anything clickable.
   Reads only: window.__MONTIS_STUDY__.journey, window.__FLOW2_NEXT__ (the sea), .finnovation-ui[data-site-section], the rail, the page's
   sound / menu buttons. Writes only its own elements. ?ui=0: the page does not load this file. */
(() => {
  'use strict';
  const html = document.documentElement;
  if (!html.hasAttribute('data-rise-ui')) return;
  const PX_PER_UNIT = 22, TICKS = 420, JOURNEY_PX = 150, SEA_K = .32;
  const fine = (() => { try { return matchMedia('(pointer: fine)').matches; } catch (error) { return false; } })();
  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { return false; } })();
  /* the five sections: our own line icons (16 × 16, stroke) */
  const SECTIONS = [
    { icon: 'M8 1.8C8 1.8 3.6 6.6 3.6 9.6a4.4 4.4 0 0 0 8.8 0C12.4 6.6 8 1.8 8 1.8Z', en: 'CORE VALUES' },
    { icon: 'M8 14V8M8 8 2.6 3M8 8l5.4-5M8 8 4 1.8M8 8l4-6.2', en: 'INVESTMENT STRATEGIES' },
    { icon: 'M1.5 6.5c1.6-1.3 3.3-1.3 4.9 0s3.3 1.3 4.9 0 3.3-1.3 3.2 0M1.5 10.5c1.6-1.3 3.3-1.3 4.9 0s3.3 1.3 4.9 0 3.3-1.3 3.2 0', en: 'WHY FINNOVATION' },
    { icon: 'M2.5 3.5h11v9h-11zM5 6.5h6M5 9.5h4', en: 'NEWS' },
    { icon: 'M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8ZM1.8 8h12.4M8 1.8c-2 2-2 10.4 0 12.4M8 1.8c2 2 2 10.4 0 12.4', en: 'GLOBAL PRESENCE' }
  ];
  const svg = (d, cls = '') => `<svg class="${cls}" viewBox="0 0 16 16" aria-hidden="true"><path d="${d}"/></svg>`;
  let root = null, strips = [], fill = null, nEl = null, tEl = null, eEl = null, icEl = null, cEl = null, dots = [], idx = null, idxBtn = null, bars = null, cur = null;
  let raf = 0, tick = 0;
  const last = { tr: '', sec: '', fill: '', on: null, mid: '', sound: '' };

  function build() {
    if (root || !document.body) return;
    const ticks = () => { let h = ''; for (let d = 0; d <= TICKS; d++) { const M = d % 5 === 0; h += `<i class="${M ? 'M' : ''}" style="top:${d * PX_PER_UNIT}px">${M && d ? String(d).padStart(2, '0') : ''}</i>`; } return h; };
    root = document.createElement('div'); root.id = 'ru-chrome';
    root.innerHTML =
      '<div class="ru-frame" aria-hidden="true"></div><div class="ru-bar-line" aria-hidden="true"></div>' +
      `<div class="ru-rule l" aria-hidden="true"><div class="ru-strip">${ticks()}</div><b class="ru-mark"></b></div>` +
      `<div class="ru-rule r" aria-hidden="true"><div class="ru-strip">${ticks()}</div><b class="ru-mark"></b></div>` +
      /* top bar, left: INDEX ▾ and the sound bars, after the page's logo */
      '<div class="ru-left"><i class="ru-sep" aria-hidden="true"></i>' +
      `<button type="button" class="ru-index-btn" aria-expanded="false" aria-haspopup="true">INDEX${svg('M4 6l4 4 4-4', 'ru-caret')}</button>` +
      '<button type="button" class="ru-sound" aria-label="環境水聲" aria-pressed="false"><span class="ru-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>' +
      '<div class="ru-index" role="menu" hidden>' + SECTIONS.map((s, i) => `<button type="button" role="menuitem" data-go="${i}"><b>${String(i + 1).padStart(2, '0')}</b>${svg(s.icon, 'ic')}<span class="zh"></span><span class="en">${s.en}</span></button>`).join('') + '</div></div>' +
      /* top bar, centre: the chapter pill */
      `<nav class="ru-pill" aria-label="章節"><button type="button" class="ru-prev" aria-label="上一章">${svg('M10 3 5 8l5 5')}</button>` +
      `<div class="ru-now"><span class="n"></span><span class="t"></span><span class="e"></span><span class="p"><i></i></span></div>` +
      `<button type="button" class="ru-next" aria-label="下一章">${svg('M6 3l5 5-5 5')}</button></nav>` +
      /* top bar, right: the contact button (split arrow) and the menu icon */
      '<div class="ru-right">' +
      `<button type="button" class="ru-btn ru-contact" data-go="4"><span>CONTACT · 聯絡我們</span><i aria-hidden="true">${svg('M3 8h10M9 4l4 4-4 4')}</i></button>` +
      '<button type="button" class="ru-burger" aria-label="選單"><i></i><i></i></button></div>' +
      /* foot */
      '<div class="ru-foot" aria-hidden="true"><span class="c">FINNOVATION · 恒灝創新<br>WHERE KNOWLEDGE FLOWS INTO CAPITAL</span><span class="k"></span></div>' +
      '<div class="ru-dots" role="tablist" aria-label="章節">' + SECTIONS.map((s, i) => `<button type="button" data-go="${i}" aria-label="${String(i + 1).padStart(2, '0')}">${svg(s.icon)}<span class="tip"></span></button>`).join('') + '</div>';
    document.body.append(root);
    /* 2026-11-23 client 「底下這排參數值給我一個小按鈕點選可以先隱藏」: a small button left of the panel tabs hides / shows the whole panel bar
       (tabs and any open panel); the choice is remembered in this browser. Shown only once the panel bar exists (desktop, not under automation). */
    if (!document.documentElement.hasAttribute('data-rise-published')) {
      const KEY = 'rise-ui:panels-hidden', html = document.documentElement;
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ru-ptoggle'; btn.hidden = true;
      const sync = () => { const off = html.hasAttribute('data-ru-panels-off'); btn.setAttribute('aria-pressed', String(off)); btn.title = off ? '顯示參數列' : '隱藏參數列'; btn.setAttribute('aria-label', btn.title); btn.innerHTML = svg(off ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'); };
      try { if (localStorage.getItem(KEY) === '1') html.setAttribute('data-ru-panels-off', ''); } catch (error) { }
      btn.addEventListener('click', () => { const off = !html.hasAttribute('data-ru-panels-off'); html.toggleAttribute('data-ru-panels-off', off); try { localStorage.setItem(KEY, off ? '1' : '0'); } catch (error) { } sync(); });
      sync(); document.body.append(btn);
      const show = () => { if (document.querySelector('.f2p')) { btn.hidden = false; return true; } return false; };
      if (!show()) { const mo = new MutationObserver(() => { if (show()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); setTimeout(() => mo.disconnect(), 60000); }
    }
    strips = [...root.querySelectorAll('.ru-strip')];
    fill = root.querySelector('.ru-now .p i'); nEl = root.querySelector('.ru-now .n'); tEl = root.querySelector('.ru-now .t'); eEl = root.querySelector('.ru-now .e'); icEl = root.querySelector('.ru-now .ic path');
    cEl = root.querySelector('.ru-foot .k'); dots = [...root.querySelectorAll('.ru-dots button')];
    idx = root.querySelector('.ru-index'); idxBtn = root.querySelector('.ru-index-btn'); bars = root.querySelector('.ru-sound');
    root.querySelector('.ru-prev').addEventListener('click', () => step(-1));
    root.querySelector('.ru-next').addEventListener('click', () => step(1));
    root.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { goTo(+g.dataset.go); openIndex(false); } });
    idxBtn.addEventListener('click', e => { e.stopPropagation(); openIndex(idx.hidden); });
    document.addEventListener('click', e => { if (!idx.hidden && !e.target.closest('.ru-left')) openIndex(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape') openIndex(false); });
    bars.addEventListener('click', () => document.getElementById('flow2-header-sound')?.click());
    root.querySelector('.ru-burger').addEventListener('click', () => document.getElementById('flow2-menu-toggle')?.click());
    if (fine && !reduced) cursor();
  }
  function openIndex(on) { if (!idx) return; idx.hidden = !on; idxBtn.setAttribute('aria-expanded', String(on)); }
  const ui = () => document.querySelector('.finnovation-ui');
  const rail = () => [...document.querySelectorAll('.finnovation-ui .fi-rail [data-section]')];
  function goTo(i) { const b = rail().find(x => +x.dataset.section === i); if (b) b.click(); }
  function step(d) { goTo(+(ui()?.dataset.siteSection ?? 0) + d); }
  function section() {
    const u = ui(), i = u?.dataset.siteSection ?? '0', r = rail(), b = r.find(x => x.dataset.section === i), all = r.length || 5;
    const num = b?.querySelector('.fi-rail-number')?.textContent.trim() || String(+i + 1).padStart(2, '0');
    const zh = b?.querySelector('.fi-rail-zh')?.textContent.trim() || '';
    const en = document.querySelector('.f2u-name')?.textContent.trim() || SECTIONS[+i]?.en || '';
    return { i: +i, key: i + '|' + zh + '|' + en, num, zh, en, of: String(all).padStart(2, '0'), names: r.map(x => x.querySelector('.fi-rail-zh')?.textContent.trim() || '') };
  }
  /* how far down the page the visitor is, in ruler px: the journey, then the sea's own scroll */
  function depth() {
    const J = window.__MONTIS_STUDY__?.journey, N = window.__FLOW2_NEXT__;
    let v = J ? (J.progress || 0) * JOURNEY_PX : 0, f = J && J.max ? (J.progress || 0) / J.max : 0;
    const st = N?.state, w = N?.world?.state;
    if (st && st.entered && !st.quiet && w && Number.isFinite(w.y)) { v += Math.max(0, w.y) * SEA_K; f = w.maxY ? Math.min(1, w.y / w.maxY) : f; }
    return { v, f: Math.max(0, Math.min(1, f)) };
  }
  /* the top bar lines up with the page's logo (its centre, measured once a second: the logo never moves while reading) */
  function align() {
    const b = document.querySelector('.finnovation-ui .fi-header .fi-brand') || document.querySelector('.fi-brand');
    const r = b?.getBoundingClientRect();
    let mid = r && r.height > 4 ? Math.round(r.top + r.height / 2) : 52;
    const right = r && r.width > 4 ? Math.round(r.right) : 190;
    /* 2026-11-23 (client, after 2023.breakthroughenergy.org: 「對照一下人家的間距 我選單高度要照這樣」): on desktop the bar is a band of fixed
       height (--ru-band) under the frame's top edge and its parts fill it with an even margin; the page's logo is moved to the band's middle */
    if (b && innerWidth > 760) {
      const cs = getComputedStyle(root), inset = parseFloat(cs.getPropertyValue('--ru-inset')) || 12, band = parseFloat(cs.getPropertyValue('--ru-band')) || 0;
      if (band > 0 && r && r.height > 4) {
        const dy = parseFloat(b.dataset.ruDy || '0'), natural = r.top + r.height / 2 - dy, target = Math.round(inset + band / 2), nd = Math.round(target - natural);
        if (nd !== dy) { b.dataset.ruDy = String(nd); b.style.translate = '0 ' + nd + 'px'; }
        mid = target;
      }
    } else if (b && b.dataset.ruDy) { delete b.dataset.ruDy; b.style.translate = ''; }
    const key = mid + '|' + right;
    if (key !== last.mid) { last.mid = key; root.style.setProperty('--ru-mid', mid + 'px'); root.style.setProperty('--ru-logo-r', right + 'px'); }
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!root) { build(); if (!root) return; }
    const on = !!document.body?.classList.contains('is-ready') && (html.dataset.gate || 'off') === 'off';
    if (on !== last.on) { last.on = on; html.classList.toggle('ru-on', on); }
    if (!on || document.hidden) return;
    if (tick++ % 60 === 0) {
      align();
      const s0 = document.getElementById('flow2-header-sound')?.getAttribute('aria-pressed') || 'false';
      if (s0 !== last.sound) { last.sound = s0; bars.setAttribute('aria-pressed', s0); }
    }
    const { v, f } = depth();
    const tr = `translate3d(0,${(innerHeight * .5 - 82 - v).toFixed(1)}px,0)`;   /* the mark sits at the rule's middle (the rule is inset 82 px top and bottom) */
    if (tr !== last.tr) { last.tr = tr; for (const s of strips) s.style.transform = tr; }
    const fs = f.toFixed(3); if (fs !== last.fill) { last.fill = fs; fill.style.transform = `scaleX(${fs})`; }
    const s = section();
    if (s.key !== last.sec) {
      last.sec = s.key;
      nEl.textContent = s.num; tEl.textContent = s.zh; eEl.textContent = s.en; cEl.textContent = s.num + ' / ' + s.of;
      if (icEl) icEl.setAttribute('d', (SECTIONS[s.i] || SECTIONS[0]).icon);   /* 2026-11-23 client 「這個左邊icon拿掉」: the pill has no icon now */
      dots.forEach((d, k) => { d.toggleAttribute('aria-current', k === s.i); const tip = d.querySelector('.tip'); if (tip && s.names[k]) tip.textContent = s.names[k]; });
      idx.querySelectorAll('[data-go]').forEach((d, k) => { d.toggleAttribute('aria-current', k === s.i); const zh = d.querySelector('.zh'); if (zh && s.names[k]) zh.textContent = s.names[k]; });
    }
  }
  /* the cursor: a ring that trails the pointer and opens over anything clickable, a dot on the pointer */
  function cursor() {
    cur = document.createElement('div'); cur.className = 'ru-cursor'; cur.setAttribute('aria-hidden', 'true'); cur.innerHTML = '<i class="ring"></i><i class="dot"></i>';
    document.body.append(cur);
    const ring = cur.firstChild, dot = cur.lastChild; let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, shown = false, hot = false, loop = 0;
    const run = () => {
      rx += (x - rx) * .2; ry += (y - ry) * .2;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0) scale(${hot ? 1.6 : 1})`;
      loop = Math.abs(x - rx) + Math.abs(y - ry) > .3 ? requestAnimationFrame(run) : 0;
    };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY; dot.style.transform = `translate3d(${x}px,${y}px,0)`;
      const h = !!e.target.closest?.('a, button, [role="button"], input, label, summary');
      if (h !== hot) { hot = h; cur.classList.toggle('is-hot', h); }
      if (!shown) { shown = true; cur.classList.add('is-on'); rx = x; ry = y; }
      if (!loop) loop = requestAnimationFrame(run);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { shown = false; cur.classList.remove('is-on'); });
  }
  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  window.__RISE_UI__ = { get state() { return { ...last, built: !!root }; } };
})();
