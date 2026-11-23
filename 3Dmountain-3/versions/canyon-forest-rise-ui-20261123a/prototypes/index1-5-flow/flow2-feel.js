/* Flow2 feel (2026-11-10): for index1-5-flow2.html only.
   Client: 「參考這網站幫我加入這網站細節 https://hubtown.co.in/ 捲動的感覺、亮點、UI介面、轉場」.
   That site was measured, not copied (docs/flow2/flow2-feel-20261110.md): none of its code, type, colours, frame or artwork is
   here. What it does that this page did not is added in this page's own type, colours and parts:

   1. GLIDE (捲動的感覺). Its scroll follows the wheel with one soft exponential: a notch is half done in .28 s, 90% in .93 s, and
      still gliding at 1.8 s. This page was three times as quick (.09 / .31 / .63 s): it stopped, where that one floats. The
      journey's own follow (window.__SILK__.lambda, motion-response.js) is turned down from 7.2 to T.glide for the wheel and the
      keys. A finger keeps the quick follow (that site, too, leaves touch to the browser): a scene that lags the finger feels
      broken, not soft. Distance per notch, chapter stops and camera path are untouched.
   2. DECODE (亮點、轉場). Its labels resolve out of changing letters: on hover, when a menu opens, when its loader finishes.
      Here the small Latin labels do the same, left to right in about half a second: the header's section name when the
      section changes, MENU / CLOSE / SOUND on hover, SOUND when it is switched, the menu's rows as it opens, the small
      line above a title as its chapter arrives, and all of the header once when the page is entered. Chinese labels and
      the big titles are left as they are (the titles keep the page's own scroll-led rise).
      The label itself is never rewritten (three controllers own the header's): a copy is laid exactly over it for the
      half second, and the label is hidden meanwhile.
   3. HOVER (UI介面). MENU and SOUND gave no answer to the pointer; they lift a little now (flow2-feel.css).
   4. HINT (UI介面). A quiet "SCROLL TO EXPLORE" at the foot of the opening screen, gone once the journey has begun. Not on
      phones and narrow screens (960px and under): the foot of the screen is the section dock there.
   5. NOTE (2026-11-11, client: 「進場後例如到第二段就會卡住了 或是到山谷 卡住」). When the visitor asks for a chapter that is still being
      prepared, main.js says so (journey.waiting: 'logo' or 'valley'). Once that has lasted 400 ms a small line stands in the hint's
      place: PREPARING THE CURRENT / PREPARING THE VALLEY, resolved once like the other labels; it goes when the wait is over (and
      stands for a second at least, so it cannot blink). No spinner, nothing that turns. On phones it stands under the header.

   Loaded before main.js. ?feel=0 leaves all of it out; ?glide=7.2 keeps the details and gives the page's own follow back.
   Live: window.__FLOW2_FEEL__.tune (glide 0 = the page's own follow, decode 0, hint 0). */
(() => {
  const q = new URLSearchParams(location.search);
  if (q.get('feel') === '0') return;
  const html = document.documentElement, reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const num = (key, fallback) => { const v = parseFloat(q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    glide: num('glide', 2.6),   // the follow's rate for wheel and keys, per second (the page's own: 7.2; the reference measured: 2.5)
    decode: 1,                  // labels resolve out of changing letters
    decodeMs: 520,              // how long one label takes
    hint: 1,                    // the scroll hint on the opening screen
    note: 1                     // the line that says a chapter is still being prepared
  };
  html.dataset.flow2Feel = 'on';

  /* ---------- 1. glide ---------- */
  let ownLambda = null, gliding = matchMedia('(pointer: fine)').matches;
  function applyGlide() {
    const S = window.__SILK__; if (!S) return;
    if (ownLambda === null) ownLambda = S.lambda;
    S.lambda = gliding && T.glide > 0 && !reduced.matches ? Math.min(ownLambda, T.glide) : ownLambda;
  }
  const glide = on => { gliding = on; applyGlide(); };
  addEventListener('wheel', () => glide(true), { capture: true, passive: true });
  addEventListener('keydown', () => glide(true), { capture: true });
  addEventListener('touchstart', () => glide(false), { capture: true, passive: true });
  addEventListener('pointerdown', event => glide(event.pointerType !== 'touch'), { capture: true, passive: true });

  /* ---------- 2. decode ---------- */
  const GLYPHS = 'ABCDEFGHKLNOPQRSTUVXYZ';      // no I, J, M, W: letters of about one width, so a label does not jump while it resolves
  const running = new Map();
  function stop(el) {
    const run = running.get(el); if (!run) return;
    cancelAnimationFrame(run.raf); run.copy.remove(); el.classList.remove('f2-feel-hide'); running.delete(el);
  }
  const PERF_COLOUR = document.documentElement.hasAttribute('data-rise-studio-pbr') && new URLSearchParams(location.search).get('perf') !== '0';
  function decode(el, ms = T.decodeMs, delay = 0) {
    if (!T.decode || reduced.matches || !el || !el.isConnected || document.hidden) return;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    /* Latin labels only: there is no "random letter" of Chinese that reads as one */
    if (!text || text.length > 44 || /[^\x20-\x7e]/.test(text) || !el.offsetWidth) { stop(el); return; }
    stop(el);
    const cs = getComputedStyle(el), copy = document.createElement('f2-copy');
    copy.setAttribute('aria-hidden', 'true'); copy.className = 'f2-feel-copy';
    Object.assign(copy.style, {
      width: el.offsetWidth + 'px', height: el.offsetHeight + 'px', fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, textTransform: cs.textTransform, color: cs.color,
      webkitTextFillColor: cs.webkitTextFillColor, visibility: 'hidden'
    });
    el.after(copy);
    const n = text.length, trail = Math.min(6, Math.max(2, Math.ceil(n * .35))), t0 = performance.now() + delay, run = { copy, raf: 0 };
    let swap = -1, noise = [], begun = false;
    const frame = now => {
      if (!el.isConnected) { stop(el); return; }
      if (now < t0) { run.raf = requestAnimationFrame(frame); return; }      // waiting its turn: the label still shows as it is
      if (!begun) {
        begun = true;
        /* laid exactly over the label, wherever its containing block is: it stands at 0,0, and is moved by what is missing */
        const a = el.getBoundingClientRect(), b = copy.getBoundingClientRect();
        copy.style.left = (a.left - b.left) + 'px'; copy.style.top = (a.top - b.top) + 'px';
        copy.style.visibility = ''; el.classList.add('f2-feel-hide');
      }
      const u = Math.min(1, (now - t0) / ms), settled = Math.floor((1 - (1 - u) * (1 - u)) * n + 1e-4), shown = u < 1 ? Math.min(n, settled + trail) : n;
      const tick = Math.floor((now - t0) / 48);
      if (tick !== swap) { swap = tick; noise = Array.from({ length: n }, () => GLYPHS[Math.random() * GLYPHS.length | 0]); }
      let s = text.slice(0, settled);
      for (let i = settled; i < shown; i++) { const c = text[i]; s += c === ' ' ? ' ' : /\d/.test(c) ? String(noise[i].charCodeAt(0) % 10) : /[a-z]/.test(c) ? noise[i].toLowerCase() : /[A-Z]/.test(c) ? noise[i] : c; }
      copy.textContent = s;
      /* the label's colour may be on its way somewhere (the interface turns dark over the light news page): the copy goes with it */
      /* PERF (2026-11-21, rise page; ?perf=0 = as before): cs is a live computed style; reading it right after the text was written made the browser
         recalculate style on every frame of the effect (1–5 ms each). The colour is followed eight times a second instead. */
      if (!PERF_COLOUR || now - (run.colourAt || -1e9) > 120) { run.colourAt = now;
      if (copy.style.color !== cs.color) { copy.style.color = cs.color; copy.style.webkitTextFillColor = cs.webkitTextFillColor; } }
      if (u < 1) run.raf = requestAnimationFrame(frame); else stop(el);
    };
    running.set(el, run);
    /* with no wait it begins at once, before the next paint: the new text never shows plain first */
    if (delay > 0) run.raf = requestAnimationFrame(frame); else frame(performance.now());
  }

  /* a label whose text is changed by the page (the header's section name, SOUND ON / OFF): resolved once its new text has stood
     for SETTLE ms. Three controllers write the header's name, and at a chapter's edge one of them writes its own chapter name for
     a frame or two before another puts the section's name back: that passing text is not a change, and must not set the label
     scrambling. (While writers keep changing it, nothing is done: the label simply shows what they write, as it always did.) */
  const SETTLE = 90, watched = new Map();
  let entered = false;
  function watch(key, el) {
    const had = watched.get(key);
    if (had?.el === el) return;
    if (had) { had.observer.disconnect(); clearTimeout(had.timer); }
    if (!el) { watched.delete(key); return; }
    const state = { el, shown: el.textContent.trim(), last: el.textContent.trim(), timer: 0, observer: null };
    state.observer = new MutationObserver(() => {
      const text = el.textContent.trim(); if (text === state.last) return;
      state.last = text; clearTimeout(state.timer);
      state.timer = setTimeout(() => { const now = el.textContent.trim(); if (now === state.shown) return; state.shown = now; if (entered) decode(el); }, SETTLE);
    });
    state.observer.observe(el, { childList: true, characterData: true, subtree: true });
    watched.set(key, state);
  }

  /* the small line above a title: its text goes into an element of its own, so that only the text is hidden while it resolves
     (the line also carries the FINNOVATION chip) */
  function kickerText(kicker) {
    let t = kicker.querySelector(':scope > f2-text'); if (t) return t;
    const node = [...kicker.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (!node) return null;
    t = document.createElement('f2-text'); node.replaceWith(t); t.append(node); return t;
  }
  const labelOf = control => control.matches('#flow2-header-sound') ? control.querySelector(':scope > span') : control.querySelector('.flow2-menu-mobile-text');
  const HOVER = '#flow2-menu-toggle, #fi-menu .fi-menu-close, #flow2-header-sound';
  document.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const control = event.target.closest?.(HOVER); if (!control || control.contains(event.relatedTarget)) return;
    const label = labelOf(control); if (label && !running.has(label)) decode(label, 380);
  }, { passive: true });

  /* ---------- 4. hint ---------- */
  let hint = null;
  function makeHint(ui) {
    hint = document.createElement('div'); hint.className = 'f2-feel-hint'; hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<svg viewBox="0 0 10 13" aria-hidden="true"><path d="M1 1.5 5 5.5 9 1.5M1 7 5 11 9 7"/></svg><f2-text>SCROLL TO EXPLORE</f2-text>';
    ui.append(hint);
  }

  /* ---------- 5. the note that a chapter is still being prepared ---------- */
  const NOTES = { logo: 'PREPARING THE CURRENT', valley: 'PREPARING THE VALLEY' };
  let note = null, noteOn = false, noteKind = '', waitSince = 0, waitSeen = -1e9, noteAt = 0;
  function makeNote(ui) {
    /* it shares the hint's class, so every interface version that places the hint places the note too */
    note = document.createElement('div'); note.className = 'f2-feel-hint f2-feel-note'; note.setAttribute('role', 'status');
    note.innerHTML = '<i aria-hidden="true"></i><f2-text></f2-text>';
    ui.append(note);
  }

  /* ---------- what is looked at ten times a second (nothing runs per frame unless a label is resolving) ---------- */
  const alpha = new WeakMap();
  let menuOpen = false, hintOn = false;
  function look() {
    applyGlide();
    const ui = document.querySelector('.finnovation-ui'); if (!ui) return;
    const open = html.dataset.gate === 'off' && document.body.classList.contains('is-ready');
    const header = ui.querySelector('.fi-footer-current'), sound = ui.querySelector('#flow2-header-sound > span');
    watch('header', header); watch('sound', sound);
    if (open && !entered) {
      entered = true;
      /* the page has just been entered: the header resolves once */
      decode(header, 620, 500); decode(ui.querySelector('#flow2-menu-toggle .flow2-menu-mobile-text'), 520, 680); decode(sound, 560, 860);
    }
    /* the menu's rows as it opens */
    const menu = ui.querySelector('#fi-menu'), isOpen = !!menu?.open;
    if (isOpen && !menuOpen) [...menu.querySelectorAll('.fi-menu-links button')].filter(b => b.offsetWidth).forEach((b, i) => decode(b.querySelector('.fi-menu-link-en'), 560, 120 + i * 70));
    menuOpen = isOpen;
    /* the line above a title, as its chapter arrives */
    const clock = performance.now();
    for (const kicker of ui.querySelectorAll('.fi-copy-panel > .fi-copy-kicker')) {
      const now = parseFloat(kicker.style.getPropertyValue('--copy-alpha')), was = alpha.get(kicker);
      if (!Number.isFinite(now)) continue;
      /* once per arrival, and not again within a second and a half (a wheel rocking on the threshold) */
      if (entered && was && was.a < .3 && now >= .3 && clock - was.t > 1500 && kicker.parentElement.classList.contains('is-active')) { decode(kickerText(kicker), 560); alpha.set(kicker, { a: now, t: clock }); }
      else alpha.set(kicker, { a: now, t: was ? was.t : -1e9 });
    }
    /* the note: main.js writes journey.waiting every frame. A wait counts once it has lasted 400 ms (a gap under a quarter second is
       not an end); the note then stands until the wait is over, and for a second at least */
    if (T.note) {
      const raw = open && !isOpen ? window.__MONTIS_STUDY__?.journey?.waiting : null, kind = NOTES[raw] ? raw : '';
      if (kind) { if (!waitSince || clock - waitSeen > 250) waitSince = clock; waitSeen = clock; }
      const waiting = !!kind || (waitSince > 0 && clock - waitSeen <= 250);
      if (!waiting) waitSince = 0;
      const want = waiting ? clock - waitSince >= 400 : noteOn && clock - noteAt < 1000;
      if (want && kind && (!noteOn || kind !== noteKind)) {
        if (!note) makeNote(ui);
        noteKind = kind; note.lastChild.textContent = NOTES[kind];
        if (!noteOn) { noteOn = true; noteAt = clock; note.classList.add('is-on'); }
        decode(note.lastChild, 620, 140);
      } else if (!want && noteOn) { noteOn = false; note.classList.remove('is-on'); }
    } else if (noteOn) { noteOn = false; note.classList.remove('is-on'); }
    /* the hint: on the opening screen only, and only while nothing has moved */
    if (T.hint) {
      if (!hint) makeHint(ui);
      const J = window.__MONTIS_STUDY__?.journey, want = open && !isOpen && !noteOn && !!J && J.progress < .12 && J.target < .12 && !window.__MONTIS_STUDY__.world?.open;
      if (want !== hintOn) { hintOn = want; hint.classList.toggle('is-on', want); if (want) decode(hint.lastChild, 700, 900); }
    } else if (hint) { hint.classList.remove('is-on'); hintOn = false; }
  }
  const timer = setInterval(look, 100);
  window.__FLOW2_FEEL__ = { tune: T, decode, glide, stop() { clearInterval(timer); glide(false); for (const el of [...running.keys()]) stop(el); for (const w of watched.values()) { w.observer.disconnect(); clearTimeout(w.timer); } watched.clear(); hint?.remove(); note?.remove(); delete html.dataset.flow2Feel; } };
})();
