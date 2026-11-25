/* Flow2 HUD (2026-11-10): the interface of index1-5-flow2.html as a hairline frame with a bar at its foot, and the big titles' line of
   light (after web3.esqrd.co's title). flow2-hud.css draws all of it; this file switches it on and adds what the page did not have.

   Second version (same day, client: 「不要跟參考網址一模一樣」「設計細節加強10倍」): the page's own drawing of that kind of interface. Here:
   the bar's reading of where you are (02 / 05, both names, FLOW n%), NEXT with the name of the section it goes to, the caption in the
   frame's top line (Taipei's time and the head office's coordinates, as the globe's label gives them).

   Third round (2026-11-11, client: 「主要是畫面的細緻度加強 UI幫我適合的處理一下」): the same interface, fitted to the picture (flow2-hud.css
   says how). Here: the ground under the frame is read through the white cloud passage into the Earth (watchGround, below), and the
   slash of "/ 05" is left to the stylesheet to draw.

   ?hud=0       the interface as it was before any of this (nothing here runs)
   ?hud=1       the first version (close to the reference): flow2-hud-v1.css, the row of section links, monospace labels
   ?hud=2       the second version as it stood before the third round: flow2-hud-v2.css, and nothing of the third round runs here
   ?hud=3       the third round (the hairline frame with the bar at its foot, the canyon's moving titles): flow2-hud-v3.css
   ?streak=0    the interface, with the page's own title motion
   ?contours=1  the canyon's contour lines back
   ?arc=N       the frame's corner in px (16 by default; buttons and tags follow it; 0 = square)
   Live: window.__FLOW2_HUD__ = { version (1 to 4), streak: { set(true/false), tune }, on }

   Fourth round (2026-11-11, client: 「圖一、二外框拿掉 這些設計看能不能移到左右兩邊 下面不要放那麼多 下方最多scroll 重新排出最完美的UI，
   跑馬燈拿掉 跟大家一樣這種標題」): the default now. No frame and no bar. What the bar read stands as a column on the right edge
   (buildSide, below): Taipei's time and the coordinates, the section's number over 05, the place in the whole site on a short
   vertical track with the section's name beside it, FLOW n%, NEXT with the section it goes to. SOUND sits beside MENU. The list of
   sections keeps the left edge. The foot of the screen has the scroll hint only (flow2-feel.js). The canyon's moving strip is not
   mounted (html[data-flow2-titles="block"] tells the page's route script): its four chapters show their own title block, as the
   opening screen does. flow2-ui-lockon.js draws the valley's labels.

   What it leans on, and does not change:
   - NEXT (and the first version's section links) are plain buttons with .fi-footer-next / data-section: the page's own click handler
     (site-sections.js) moves the page. No navigation code here.
   - Where you are is READ from the page: .finnovation-ui[data-site-section], the page's own NEXT SECTION / BACK TO TOP text, and the
     number it writes on .fi-footer-progress i (data-site-progress). Nothing is computed twice.
   - The titles: copy-motion.js still owns them and still writes each word's --copy-ink-alpha from the scroll. That number is READ as the
     signal (a title has arrived when its words are half shown and rising, is leaving as soon as they start to fade); the words then
     play the streak in their own time, so a title is never left half drawn. Not with "reduce motion".
   - If anything here throws, the streak switches itself off and the page's own titles show. */
(() => {
  const q = new URLSearchParams(location.search), html = document.documentElement;
  const hud = q.get('hud');
  if (hud === '0') return;
  const version = hud === '1' ? 1 : hud === '2' ? 2 : hud === '3' ? 3 : 4;
  const first = version === 1, third = version >= 3, fourth = version === 4;
  html.dataset.flow2Hud = String(version);
  if (q.get('contours') === '1') html.dataset.flow2Contours = 'on';
  { const arc = parseFloat(q.get('arc')); if (!first && Number.isFinite(arc)) html.style.setProperty('--f2h-arc', Math.max(0, Math.min(40, arc)) + 'px'); }

  if (!fourth) {
    /* an earlier version: its own frozen stylesheet instead of the page's */
    const sheet = document.querySelector('link[rel="stylesheet"][href*="flow2-hud.css"]');
    if (sheet) sheet.href = sheet.href.replace('flow2-hud.css', first ? 'flow2-hud-v1.css' : version === 2 ? 'flow2-hud-v2.css' : 'flow2-hud-v3.css');
  } else html.dataset.flow2Titles = 'block';   /* the page's route script reads this: no moving strip, the canyon's chapters show their own titles */
  if (first) {
    /* the first version's label face (Latin only; asked for only here) */
    const font = document.createElement('link');
    font.rel = 'stylesheet'; font.dataset.flow2Hud = 'font';
    font.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.append(font);
  }

  const NAMES = ['CORE VALUES', 'INVESTMENT STRATEGIES', 'WHY FINNOVATION', 'LATEST NEWS', 'GLOBAL PRESENCE'];
  const NAMES_ZH = ['核心價值', '投資策略', '為何選擇我們', '最新消息', '全球布局'];
  const HOME = '25.03° N · 121.56° E';     // the globe's TAIPEI HQ label
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const el = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };
  const two = i => String(i + 1).padStart(2, '0');

  /* ---- what the page did not have ---- */
  function build() {
    const ui = document.querySelector('.finnovation-ui'), header = ui?.querySelector('.fi-header');
    if (!ui || !header) return false;
    if (ui.querySelector('.f2h-next')) return true;
    /* the page's own names for its sections, where it has them (the menu's rows, the list at the left) */
    const rows = [...ui.querySelectorAll('#fi-menu .fi-menu-links [data-section]')];
    const names = NAMES.map((fallback, i) => rows.find(r => r.dataset.section === String(i))?.querySelector('.fi-menu-link-en')?.textContent.replace(/\s+/g, ' ').trim() || fallback);
    const namesZh = NAMES_ZH.map((fallback, i) => ui.querySelector(`.fi-rail > [data-section="${i}"] .fi-rail-zh`)?.textContent.trim() || fallback);
    if (fourth) return buildSide(ui, names, namesZh);
    /* the bar's backing (flow2-hud.css shows it only where something would show through the bar) */
    const bar = el('div', 'f2h-bar'); bar.setAttribute('aria-hidden', 'true');
    (ui.querySelector('.flow2-blue-frame') || ui.firstElementChild).before(bar);
    const next = el('button', 'fi-footer-next f2h-next'); next.type = 'button'; next.setAttribute('aria-label', '下一段');

    if (first) {
      const nav = el('nav', 'f2h-nav'); nav.setAttribute('aria-label', '區段');
      names.forEach((name, i) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.section = String(i); b.textContent = name; nav.append(b); });
      header.append(nav);
      next.innerHTML = '<span>NEXT</span><i aria-hidden="true"></i>';
      ui.append(next);
      return true;
    }

    next.innerHTML = '<span class="f2h-next-k">NEXT</span><span class="f2h-next-n"></span><i aria-hidden="true"></i>';
    ui.append(next);
    const nextKey = next.querySelector('.f2h-next-k'), nextName = next.querySelector('.f2h-next-n');

    /* where you are, drawn large (the page's own words stay in place for screen readers) */
    const read = el('div', 'f2h-read'); read.setAttribute('aria-hidden', 'true');
    /* (third round: the slash before 05 is drawn by the stylesheet, at the angle of every other slash) */
    read.innerHTML = '<span class="f2h-read-n"><b>01</b></span>' + (third ? '<span class="f2h-read-of f2h-slash">05</span>' : '<span class="f2h-read-of">/ 05</span>') + '<i></i><span class="f2h-read-en"></span><span class="f2h-read-zh" lang="zh-Hant"></span><span class="f2h-read-flow">FLOW<b>00</b>%</span>';
    ui.append(read);
    const numBox = read.querySelector('.f2h-read-n'), en = read.querySelector('.f2h-read-en'), zh = read.querySelector('.f2h-read-zh'), flow = read.querySelector('.f2h-read-flow b');
    const pageNext = ui.querySelector('.fi-footer > .fi-footer-next span');
    let shown = -1, rollTimer = 0, pingTimer = 0;
    /* arriving in a section: one ring leaves the diamond on the waterline */
    const track = ui.querySelector('.fi-footer-progress');
    const ping = () => { if (!track || reduced.matches || document.hidden) return; clearTimeout(pingTimer); track.classList.remove('is-step'); void track.offsetWidth; track.classList.add('is-step'); pingTimer = setTimeout(() => track.classList.remove('is-step'), 1250); };
    const now = () => Math.max(0, Math.min(4, Number(ui.dataset.siteSection) || 0));
    function nextState() {
      const i = now(), top = (pageNext?.textContent || '').trim() === 'BACK TO TOP', target = top ? 0 : i < 4 ? i + 1 : -1;
      next.classList.toggle('is-top', top);
      nextKey.textContent = top ? 'TOP' : 'NEXT';
      nextName.textContent = '';
      if (target >= 0) { const b = document.createElement('b'); b.textContent = two(target); nextName.append(b, names[target]); }
      next.setAttribute('aria-label', top ? '回到最上方' : target >= 0 ? '下一段：' + namesZh[target] : '下一段');
    }
    function section() {
      const i = now();
      if (i !== shown) {
        const live = numBox.querySelector('b:not(.is-out)');
        if (shown < 0 || reduced.matches || document.hidden) live.textContent = two(i);
        else {
          /* the number rolls: up when going on, down when going back */
          clearTimeout(rollTimer);
          for (const b of numBox.querySelectorAll('b.is-out')) b.remove();
          const fresh = document.createElement('b'); fresh.textContent = two(i);
          numBox.dataset.dir = i > shown ? 'down' : 'up';
          live.className = 'is-out'; fresh.className = 'is-in'; numBox.append(fresh);
          rollTimer = setTimeout(() => { live.remove(); fresh.className = ''; }, 560);
        }
        if (shown >= 0) ping();
        shown = i; en.textContent = names[i]; zh.textContent = namesZh[i];
      }
      nextState();
    }
    new MutationObserver(section).observe(ui, { attributes: true, attributeFilter: ['data-site-section'] });
    if (pageNext) new MutationObserver(nextState).observe(pageNext, { childList: true, characterData: true, subtree: true });
    section();
    /* FLOW: the place in the whole site, as the page counts it */
    const line = ui.querySelector('.fi-footer-progress i');
    if (line) {
      let last = -1;
      const flowNow = () => { const v = Math.round((parseFloat(line.dataset.siteProgress) || 0) * 100); if (v !== last) { last = v; flow.textContent = String(v).padStart(2, '0'); } };
      new MutationObserver(flowNow).observe(line, { attributes: true, attributeFilter: ['data-site-progress'] });
      flowNow();
    } else read.querySelector('.f2h-read-flow').remove();

    /* the caption in the frame's top line; the line opens for exactly its width */
    const cap = el('div', 'f2h-cap'); cap.setAttribute('aria-hidden', 'true');
    cap.innerHTML = '<span>TAIPEI<b></b></span><i></i><span></span>';
    cap.lastElementChild.textContent = HOME;
    ui.append(cap);
    const clock = cap.querySelector('b');
    let format = null;
    try { format = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (error) { /* no time zones here: the place alone */ }
    const fit = () => html.style.setProperty('--f2h-cap', cap.offsetWidth ? cap.offsetWidth + 36 + 'px' : '0px');
    const tick = () => { if (!format) return; const text = format.format(new Date()); if (clock.textContent !== text) { clock.textContent = text; fit(); } };
    tick(); setInterval(tick, 15000);
    addEventListener('resize', fit, { passive: true });
    new MutationObserver(fit).observe(html, { attributes: true, attributeFilter: ['data-gate', 'data-flow2-plain-news-open'] });
    document.fonts?.ready.then(fit);
    setTimeout(fit, 1200);

    /* the brand's line, as the opening screen words it, in the middle of the bar */
    const words = ui.querySelector('#chapter-knowledge .fi-copy-zh')?.textContent.replace(/s+/g, ' ').trim();
    if (words) { const motto = el('div', 'f2h-motto'); motto.setAttribute('aria-hidden', 'true'); motto.lang = 'zh-Hant'; motto.textContent = words; ui.append(motto); }
    if (third) watchGround(ui);
    return true;
  }

  /* ---- fourth round: what the bar read, as a column on the right edge ----
     .f2h-read is the column itself (flow2-hud.css gives that class the ink of the ground it stands on). NEXT is the page's own kind of
     button (.fi-footer-next: site-sections.js moves the page), so there is no navigation code here either. */
  function buildSide(ui, names, namesZh) {
    const side = el('div', 'f2h-read f2u-side');
    side.innerHTML = '<div class="f2u-cap" aria-hidden="true"><span>TAIPEI<b></b></span><span></span></div>'
      + '<div class="f2u-where" aria-hidden="true"><span class="f2h-read-n"><b>01</b></span><span class="f2u-of">05</span></div>'
      + '<div class="f2u-gauge" aria-hidden="true"><span class="f2u-name"></span><span class="f2u-track"><i></i></span></div>'
      + '<div class="f2u-flow" aria-hidden="true">FLOW<b>00</b>%</div>';
    side.querySelector('.f2u-cap > span:last-child').textContent = HOME;
    const next = el('button', 'fi-footer-next f2h-next f2u-next'); next.type = 'button'; next.setAttribute('aria-label', '下一段');
    next.innerHTML = '<span class="f2u-next-top"><span class="f2h-next-k">NEXT</span><i aria-hidden="true"></i></span><span class="f2h-next-n"></span>';
    side.append(next);
    ui.append(side);
    const numBox = side.querySelector('.f2h-read-n'), en = side.querySelector('.f2u-name'), flow = side.querySelector('.f2u-flow b');
    const nextKey = next.querySelector('.f2h-next-k'), nextName = next.querySelector('.f2h-next-n');
    const pageNext = ui.querySelector('.fi-footer > .fi-footer-next span');
    let shown = -1, rollTimer = 0;
    const now = () => Math.max(0, Math.min(4, Number(ui.dataset.siteSection) || 0));
    function nextState() {
      const i = now(), top = (pageNext?.textContent || '').trim() === 'BACK TO TOP', target = top ? 0 : i < 4 ? i + 1 : -1;
      next.classList.toggle('is-top', top);
      nextKey.textContent = top ? 'TOP' : 'NEXT';
      nextName.textContent = '';
      if (target >= 0) { const b = document.createElement('b'); b.textContent = two(target); nextName.append(b, names[target]); }
      next.setAttribute('aria-label', top ? '回到最上方' : target >= 0 ? '下一段：' + namesZh[target] : '下一段');
    }
    function section() {
      const i = now();
      if (i !== shown) {
        const live = numBox.querySelector('b:not(.is-out)');
        if (shown < 0 || reduced.matches || document.hidden) live.textContent = two(i);
        else {
          /* the number rolls: up when going on, down when going back */
          clearTimeout(rollTimer);
          for (const b of numBox.querySelectorAll('b.is-out')) b.remove();
          const fresh = document.createElement('b'); fresh.textContent = two(i);
          numBox.dataset.dir = i > shown ? 'down' : 'up';
          live.className = 'is-out'; fresh.className = 'is-in'; numBox.append(fresh);
          rollTimer = setTimeout(() => { live.remove(); fresh.className = ''; }, 560);
        }
        shown = i; en.textContent = names[i];
      }
      nextState();
    }
    new MutationObserver(section).observe(ui, { attributes: true, attributeFilter: ['data-site-section'] });
    if (pageNext) new MutationObserver(nextState).observe(pageNext, { childList: true, characterData: true, subtree: true });
    section();
    /* the place in the whole site, as the page counts it: the marker on the track, and FLOW */
    const line = ui.querySelector('.fi-footer-progress i');
    if (line) {
      let last = -1;
      const flowNow = () => {
        const p = Math.max(0, Math.min(1, parseFloat(line.dataset.siteProgress) || 0)), v = Math.round(p * 100);
        side.style.setProperty('--f2u-p', p.toFixed(4));
        if (v !== last) { last = v; flow.textContent = String(v).padStart(2, '0'); }
      };
      new MutationObserver(flowNow).observe(line, { attributes: true, attributeFilter: ['data-site-progress'] });
      flowNow();
    } else side.querySelector('.f2u-flow').remove();
    /* Taipei's time (the visitor's clock, turned to Taipei's zone), looked at four times a minute */
    const clock = side.querySelector('.f2u-cap b');
    let format = null;
    try { format = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (error) { /* no time zones here: the place alone */ }
    const tick = () => { if (!format) return; const text = format.format(new Date()); if (clock.textContent !== text) clock.textContent = text; };
    tick(); setInterval(tick, 15000);
    /* SOUND stands at MENU's left: it needs MENU's width */
    const menu = ui.querySelector('#flow2-menu-toggle');
    if (menu) {
      const fit = () => { if (menu.offsetWidth) html.style.setProperty('--f2u-menu-w', menu.offsetWidth + 'px'); };
      try { new ResizeObserver(fit).observe(menu); } catch (error) { addEventListener('resize', fit, { passive: true }); }
      fit(); document.fonts?.ready.then(fit);
    }
    /* WHY's card numbers stood in the bar. They stand under WHY's picture now, on the line of its keywords (flow2-hud.css): the place
       of that line comes from the page's own layout, so it is read (offsets, which a card's movement does not change) when WHY is
       come to and when the window changes. Without a reading the row keeps the page's own place */
    const placePager = () => {
      const pin = document.querySelector('#fiWorld .fiwo-pin'), row = pin?.querySelector('.fiwo-strategy-keywords') || pin?.querySelector('.fiwo-strategy-meta');
      if (!pin || !pin.querySelector('.fiwo-progress')) return;
      let y = NaN;
      if (row && row.offsetHeight && innerWidth > 960) { y = row.offsetHeight / 2 - 15; for (let n = row; n && n !== pin; n = n.offsetParent) { y += n.offsetTop; if (!n.offsetParent) y = NaN; } }
      if (Number.isFinite(y) && y > 0) pin.style.setProperty('--f2u-why-y', Math.round(y) + 'px'); else pin.style.removeProperty('--f2u-why-y');
    };
    let pagerTimer = 0;
    const pagerSoon = () => { placePager(); clearTimeout(pagerTimer); pagerTimer = setTimeout(placePager, 700); };
    new MutationObserver(pagerSoon).observe(ui, { attributes: true, attributeFilter: ['data-site-section'] });
    addEventListener('resize', pagerSoon, { passive: true });
    document.fonts?.ready.then(pagerSoon); pagerSoon();
    watchGround(ui);
    return true;
  }

  /* ---- the ground under the frame (third round) ----
     From the news the page goes through a white deck of cloud into the Earth. The page calls that stretch section 05 from its first
     pixel and gives its header the light ink at 28% of the deck, but the picture stays pale, then white, until the deck has torn open
     (about 70% of it): light lines, a light logo and light labels on white. The deck's own clock is READ here (world.y / world.at.clouds:
     the numbers flow2-fix-a.js already reads) and .finnovation-ui is marked data-f2h-ground="pale" for as long as the picture under the
     frame is pale; flow2-hud.css then keeps the dark ink the interface has in the news. Nothing of the page is changed, and without the
     world object nothing is marked. A phone has no news strip under the deck (its news is a page of its own), so the mark starts
     there only when the deck itself has closed, and ends sooner. The look is taken every frame only while the visitor is inside the
     deck; elsewhere it stops by itself 2.6 s after the last wheel, touch or key. */
  function watchGround(ui) {
    const narrow = matchMedia('(max-width: 960px)');
    let pale = false, raf = 0, until = 0;
    const look = () => {
      let next = false, inside = false;
      try {
        const w = window.__MONTIS_STUDY__?.world;
        if (w && w.open && w.leg === 'sky' && w.at && w.at.clouds > 0) {
          const c = w.y / w.at.clouds;
          inside = c < 1.2;
          /* a computer: pale from the first pixel (the news' own ground is still under the deck) until the deck has torn open;
             a phone: only while the deck itself is closed (the valley is under it before, and its upright picture clears sooner) */
          next = (narrow.matches ? c > .3 && c < .6 : c < (reduced.matches ? .6 : .71)) && !('flow2PlainNewsOpen' in html.dataset);
        }
      } catch (error) { /* no world (yet): no mark */ }
      if (next !== pale) { pale = next; if (pale) ui.dataset.f2hGround = 'pale'; else delete ui.dataset.f2hGround; }
      return inside;
    };
    const frame = () => { raf = 0; if (look() || performance.now() < until) raf = requestAnimationFrame(frame); };
    const wake = () => { until = performance.now() + 2600; if (!raf) raf = requestAnimationFrame(frame); };
    new MutationObserver(wake).observe(ui, { attributes: true, attributeFilter: ['data-site-section'] });
    for (const type of ['wheel', 'touchmove', 'keydown', 'pointerup']) addEventListener(type, wake, { passive: true, capture: true });
    wake();
  }
  function whenReady() {
    /* the five sections' interface is put in by the page's modules after this script: wait for its list */
    if (document.querySelector('.finnovation-ui .fi-rail > [data-section]') && build()) return;
    setTimeout(whenReady, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', whenReady, { once: true }); else whenReady();

  /* ---- the titles: a line of light ---- */
  const T = {
    showAt: .5, hideAt: .9,      // of the words' own scroll-led opacity: arrive when it rises past showAt, leave when it falls under hideAt (early: a chapter's panel is taken away soon after, and the leaving needs its third of a second)
    in: 680, step: 55,           // a word opens over `in` ms; each next word starts `step` ms later
    out: 260, stepOut: 16,
    enterWait: 380               // after the page is entered, before the first title
  };
  const TITLES = 'h1.flow-copy-title, h2.flow-copy-title, .fiwo-strategy-title.flow-copy-title';
  const states = new WeakMap();
  let on = false, entered = false, timer = 0, raf = 0, busyUntil = 0;
  /* while the page is being moved, the titles are looked at every frame (a leaving title has little time before its panel goes);
     at rest, four times a second is enough to catch a move that did not come from the visitor's hand */
  const frameLook = () => { raf = 0; if (!on) return; look(); if (performance.now() < busyUntil) raf = requestAnimationFrame(frameLook); };
  const moved = () => { busyUntil = performance.now() + 2600; if (on && !raf) raf = requestAnimationFrame(frameLook); };
  for (const type of ['wheel', 'touchmove', 'keydown', 'pointerup']) addEventListener(type, moved, { passive: true, capture: true });

  function prepare(title) {
    /* the canyon chapters' own titles stay for reading order only (the moving strip shows their words) */
    if (title.closest('[data-flow2-route-copy]')) { if (title.classList.contains('f2s')) title.classList.remove('f2s', 'f2s-on', 'f2s-in', 'f2s-out'); return null; }
    const inks = title.getElementsByClassName('flow-copy-ink'), words = title.getElementsByClassName('flow-copy-word');
    if (!inks.length || !words.length) return null;
    let st = states.get(title);
    if (!st) { st = { shown: false, mean: undefined, timer: 0, words: 0 }; states.set(title, st); }
    if (st.words !== words.length || !title.classList.contains('f2s')) {
      for (let i = 0; i < words.length; i++) words[i].style.setProperty('--f2s-i', String(i));
      st.words = words.length; title.classList.add('f2s'); title.classList.toggle('f2s-on', st.shown);
    }
    st.inks = inks;
    return st;
  }
  function play(title, st, show, wait = 0) {
    st.shown = show; clearTimeout(st.timer);
    title.classList.remove('f2s-in', 'f2s-out');
    title.style.setProperty('--f2s-wait', wait + 'ms');
    void title.offsetWidth;                                   // the animation starts again from its first frame
    title.classList.add(show ? 'f2s-in' : 'f2s-out');
    title.classList.toggle('f2s-on', show);
    const total = wait + (show ? T.in + st.words * T.step : T.out + st.words * T.stepOut) + 80;
    st.timer = setTimeout(() => title.classList.remove('f2s-in', 'f2s-out'), total);   // at rest: plain text, no filter, no layer kept
  }
  function look() {
    if (!on || document.hidden) return;
    try {
      const open = html.dataset.gate === 'off' && document.body.classList.contains('is-ready');
      const first = open && !entered; if (open) entered = true;
      for (const title of document.querySelectorAll(TITLES)) {
        const st = prepare(title); if (!st) continue;
        let sum = 0;
        for (let i = 0; i < st.inks.length; i++) { const a = parseFloat(st.inks[i].style.getPropertyValue('--copy-ink-alpha')); sum += Number.isFinite(a) ? a : 1; }
        const mean = sum / st.inks.length, before = st.mean ?? mean, rising = mean > before + .002, falling = mean < before - .002;
        st.mean = mean;
        let want = st.shown;
        if (!entered) want = false;
        else if (!st.shown) { if (mean >= T.showAt && (rising || mean >= .98)) want = true; }
        else if ((falling && mean < T.hideAt) || mean < .15) want = false;
        if (want !== st.shown) play(title, st, want, want && first ? T.enterWait : 0);
      }
    } catch (error) { console.warn('flow2 hud: title streak switched off', error); set(false); }
  }
  function set(value) {
    const next = !!value && !reduced.matches;
    if (next === on) return;
    on = next; clearInterval(timer); cancelAnimationFrame(raf); raf = 0;
    if (on) {
      html.dataset.flow2Streak = 'on';
      html.style.setProperty('--f2s-in', T.in + 'ms'); html.style.setProperty('--f2s-step', T.step + 'ms'); html.style.setProperty('--f2s-out', T.out + 'ms');
      entered = false; look(); timer = setInterval(look, 250); moved();
    } else {
      delete html.dataset.flow2Streak;
      for (const title of document.querySelectorAll('.f2s')) { const st = states.get(title); if (st) { st.shown = false; clearTimeout(st.timer); } title.classList.remove('f2s-on', 'f2s-in', 'f2s-out'); }
    }
  }
  window.__FLOW2_HUD__ = { on: true, version, streak: { set, tune: T, get on() { return on; } } };
  const startStreak = () => set(q.get('streak') !== '0');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startStreak, { once: true }); else startStreak();
})();
