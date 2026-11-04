/* index1-5 (2026-11-04): one chapter index for the whole site. Shipped by chapter-flow-build.cjs, created from main.js.
   Client: 「章節全部串起來：01–06 → 07 卡牌 → 08 GLOBAL REACH → 09 四大投資策略 → 10 PRINCIPLES → 11 CONTACT，用同一條章節列和頁尾計數；
   06 的 NEXT 接到卡牌；跳遠的章節用水霧標題卡轉場；雲層那段改成顯示章節標題」.
   Before: the rail and the footer counted 01–06 and were hidden once the world opened (body.is-world), which showed a nav of its own;
   06's last NEXT went back to 01. Now the rail, the menu and the footer count eleven chapters through the journey, the cards and the world.
   A jump of one chapter moves as before (the journey's spring, the cards' bridge, the world's own scroll). A longer one, or one between the
   journey, the cards and the world, goes under a title card of mist: it comes up, the page is put at the chapter, it clears.
   In the world's cloud passage the next chapter's title stands in the mist, so the white is a title page, not a blank. */
const EPILOGUE = [
  { en: 'PORTFOLIO', zh: '投資組合', realm: 'cards' },
  { en: 'GLOBAL REACH', zh: '善水長流', realm: 'world', part: 'global' },
  { en: 'INVESTMENT STRATEGIES', zh: '四大投資策略', realm: 'world', part: 'responsibility' },
  { en: 'PRINCIPLES', zh: '我們的理念', realm: 'world', part: 'principles' },
  { en: 'CONTACT', zh: '聯絡我們', realm: 'world', part: 'contact' }
];
const JOURNEY = [['KNOWLEDGE', '一滴知識'], ['INSIGHT', '洞察訊號'], ['DIRECTION', '洞察成流'], ['VALUE', '資本向前'], ['CONFLUENCE', '智匯相連'], ['STRATEGIES', '投資策略']];
const TOTAL = JOURNEY.length + EPILOGUE.length;
const two = n => String(n + 1).padStart(2, '0');
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const STYLE = `
/* CHAPTER_FLOW: the rail and the footer stay through the cards and the world; the world's own nav gives way to them */
html body.is-world .finnovation-ui .fi-rail { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
html body.is-world.is-world .finnovation-ui .fi-footer > :is(.fi-footer-center, .fi-footer-next) { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
html .fi-world .fiw-chapters { display: none !important; }
/* the footer's count: the line runs through all eleven, and its number stands beside it (index1-5 had hidden the words and kept the line) */
html body .finnovation-ui .fi-footer .fi-footer-total { display: inline !important; font-variant-numeric: tabular-nums; letter-spacing: .12em; }
/* the cards fade the rail out with the chapter's words (portfolio-epilogue-polish.js, inline styles and inert): it stays */
html body.is-portfolio .finnovation-ui .fi-rail { opacity: 1 !important; visibility: visible !important; }
/* the title card of mist, and the title in the clouds */
.fi-flow-veil { position: fixed; inset: 0; z-index: 9; display: grid; place-items: center; pointer-events: none; opacity: 0; visibility: hidden;
  background: radial-gradient(120% 95% at 50% 46%, #f2f6f9 0%, #dfe7ee 48%, #c4d2de 100%); transition: opacity .55s cubic-bezier(.65, 0, .35, 1), visibility .55s; }
.fi-flow-veil.is-on { opacity: 1; visibility: visible; pointer-events: auto; }
.fi-flow-veil.is-off { transition-duration: .9s, .9s; }
.fi-flow-card, .fi-flow-cloud { display: grid; justify-items: center; gap: 14px; text-align: center; color: #16283d; font-family: var(--site-font, 'Oswald', sans-serif); font-synthesis: none; }
.fi-flow-num { font-size: clamp(64px, 9vw, 140px); line-height: .9; letter-spacing: -.01em; }
.fi-flow-title { font-size: clamp(30px, 4.4vw, 68px); line-height: 1; letter-spacing: .02em; }
.fi-flow-zh { font-family: "Noto Sans TC", sans-serif; font-weight: 500; font-size: 14px; letter-spacing: .5em; text-indent: .5em; color: #3b5068; }
.fi-flow-ch { display: inline-block; white-space: pre; opacity: 0; filter: blur(10px); translate: 0 .3em; transition: opacity .8s cubic-bezier(.16, 1, .3, 1), filter .8s cubic-bezier(.16, 1, .3, 1), translate .8s cubic-bezier(.16, 1, .3, 1); transition-delay: calc(var(--i, 0) * 28ms); }
.is-shown .fi-flow-ch { opacity: 1; filter: blur(0); translate: 0 0; }
/* right after the world in the page: above its canvas, under the interface (both z 7) */
.fi-flow-cloud { position: fixed; left: 50%; top: 46%; translate: -50% -50%; z-index: 7; pointer-events: none; opacity: var(--cloud, 0); }
/* over the cards and the world the rail keeps to its numbers (their words sit where its names would): the names come out on hover or focus */
.fi-rail-label { display: inline-block; vertical-align: bottom; white-space: nowrap; overflow: hidden; max-width: 260px; transition: max-width .5s cubic-bezier(.2, .7, .2, 1), opacity .4s; }
html body:is(.is-world, .is-portfolio) .finnovation-ui .fi-rail:not(:hover):not(:focus-within) .fi-rail-label { max-width: 0; opacity: 0; }
html body:is(.is-world, .is-portfolio) .finnovation-ui .fi-rail:is(:hover, :focus-within) { background: #0b1a2e8c; -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border-radius: 14px; box-shadow: 0 0 0 10px #0b1a2e8c; }
@media (prefers-reduced-motion: reduce) { .fi-flow-veil, .fi-flow-ch { transition-duration: .01s !important; transition-delay: 0s !important; } }
/* 2026-11-04, client: 「這種章節的內容都移除」 — no chapter title cards: the cloud passage is cloud only and a long jump is mist only (number,
   title and Chinese line removed). Delete this rule to bring them back. */
.fi-flow-card, .fi-flow-cloud { display: none !important; }
`;

export function createChapterFlow({ ui, journey, getPortfolio, getWorld, loadWorld, warmEpilogue, toCards, reducedMotion = false }) {
  if (!ui) return { update() {} };
  const style = document.createElement('style'); style.dataset.chapterFlow = ''; style.textContent = STYLE; document.head.append(style);
  const rail = ui.querySelector('.fi-rail'), menuLinks = ui.querySelector('.fi-menu-links');
  const footerCurrent = ui.querySelector('.fi-footer-current'), footerTotal = ui.querySelector('.fi-footer-total'), footerNext = ui.querySelector('.fi-footer-next span'), footerLine = ui.querySelector('.fi-footer-progress i');
  const arrow = '<svg class="fi-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5" /></svg>';
  /* the five new chapters, in the same markup as the journey's own */
  EPILOGUE.forEach((c, k) => {
    const i = JOURNEY.length + k;
    if (rail) rail.insertAdjacentHTML('beforeend', `<button type="button" data-flow="${i}" aria-label="${two(i)} ${c.zh}"><span class="fi-rail-number" aria-hidden="true">${two(i)}</span>${c.en}</button>`);
    if (menuLinks) menuLinks.insertAdjacentHTML('beforeend', `<button type="button" data-flow="${i}"><span class="fi-menu-link-number">${two(i)}</span><span><span class="fi-menu-link-en">${c.en}</span><span class="fi-menu-link-zh">${c.zh}</span></span>${arrow}</button>`);
  });
  /* 06's last NEXT goes on to the cards: its words say so */
  for (const span of ui.querySelectorAll('[data-copy="derivatives"] .fi-copy-action span')) for (const node of span.childNodes) if (node.nodeType === 3 && /BACK TO THE BEGINNING/.test(node.textContent)) node.textContent = node.textContent.replace('BACK TO THE BEGINNING', 'VIEW PORTFOLIO');

  const split = (el, text) => { el.textContent = ''; let i = 0; for (const ch of text) { const s = document.createElement('span'); s.className = 'fi-flow-ch'; s.style.setProperty('--i', i++); s.textContent = ch; el.append(s); } };
  const card = (cls) => { const box = document.createElement('div'); box.className = cls; box.setAttribute('aria-hidden', 'true'); box.innerHTML = '<span class="fi-flow-num"></span><span class="fi-flow-title"></span><span class="fi-flow-zh"></span>'; return box; };
  const veil = document.createElement('div'); veil.className = 'fi-flow-veil'; const veilCard = card('fi-flow-card'); veil.append(veilCard); document.body.append(veil);
  const cloud = card('fi-flow-cloud'), worldRoot = document.querySelector('#fiWorld');
  if (worldRoot) worldRoot.after(cloud); else document.body.append(cloud);
  /* every rail name in its own box, so the rail can fold to its numbers over the cards and the world */
  for (const b of rail?.querySelectorAll('button') ?? []) for (const node of [...b.childNodes]) if (node.nodeType === 3 && node.textContent.trim()) { const s = document.createElement('span'); s.className = 'fi-rail-label'; s.textContent = node.textContent; node.replaceWith(s); }
  const label = i => i < JOURNEY.length ? { en: JOURNEY[i][0], zh: JOURNEY[i][1] } : EPILOGUE[i - JOURNEY.length];
  const fill = (box, i) => { const l = label(i); split(box.querySelector('.fi-flow-num'), two(i)); split(box.querySelector('.fi-flow-title'), l.en); box.querySelector('.fi-flow-zh').textContent = l.zh; };
  fill(cloud, JOURNEY.length + 1);

  /* ------------------------------------------------------------ where the visitor is, as one of eleven */
  /* the world's own stops (targetOf, at and y: chapter-flow-build.cjs adds them; its state getter builds a whole report, too much for every frame) */
  const worldStart = w => ({ resp: w.targetOf('responsibility'), principles: w.targetOf('principles'), contact: w.at.footer ?? Infinity });
  function current() {
    const P = getPortfolio(), W = getWorld();
    if (W?.open) {
      const y = W.y, H = innerHeight, s = worldStart(W);
      if (y >= s.contact - H * .55) return 10;
      if (y >= s.principles - H * .5) return 9;
      if (y >= s.resp - H * .5) return 8;
      return 7;
    }
    if (P?.open && (P.transition ?? 0) > .5) return 6;
    const j = Number(ui.dataset.journeyIndex); return Number.isFinite(j) ? j : 0;
  }
  let shown = -1;
  function paint(i) {
    shown = i;
    for (const b of ui.querySelectorAll('nav [data-chapter], nav [data-flow]')) {
      const n = b.hasAttribute('data-flow') ? Number(b.dataset.flow) : Number(b.dataset.chapter);
      if (n === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    }
    if (footerCurrent) footerCurrent.textContent = label(i).en;
    if (footerTotal) footerTotal.textContent = `${two(i)} / ${String(TOTAL).padStart(2, '0')}`;
    if (footerNext) footerNext.textContent = i === 5 ? 'VIEW PORTFOLIO' : i === TOTAL - 1 ? 'BACK TO TOP' : 'NEXT CHAPTER';
    ui.dataset.flowChapter = String(i);
    /* on a phone the rail is a strip that scrolls sideways: bring the chapter into it */
    const b = rail?.querySelector(`[aria-current="step"]`);
    if (b && rail.scrollWidth > rail.clientWidth) rail.scrollTo({ left: Math.max(0, b.offsetLeft - (rail.clientWidth - b.offsetWidth) * .5), behavior: reducedMotion ? 'instant' : 'smooth' });
  }

  /* ------------------------------------------------------------ going there */
  const frames = n => new Promise(resolve => { const step = () => (n-- <= 0 ? resolve() : requestAnimationFrame(step)); requestAnimationFrame(step); });
  const until = (test, ms) => new Promise(resolve => { const t0 = performance.now(); const look = () => (test() || performance.now() - t0 > ms ? resolve(!!test()) : requestAnimationFrame(look)); look(); });
  let busy = false, passThrough = false;
  /* a journey chapter, the way its own rail button goes (the interface knows its targets), then put there at once */
  function journeyTo(i, instant) {
    const b = ui.querySelector(`.fi-rail [data-chapter="${i}"]`); if (!b) return;
    passThrough = true; b.click(); passThrough = false;
    if (instant) { journey.progress = journey.target; journey.velocity = 0; }
  }
  async function cardsUp(instant) {
    toCards();
    if (instant) { journey.progress = journey.target; journey.velocity = 0; }
    await until(() => { const P = getPortfolio(); return P?.open && (P.transition ?? 0) > .985; }, 4000);
  }
  async function worldTo(part, instant) {
    let W = getWorld();
    if (!W) { await warmEpilogue?.(); W = getWorld() || await loadWorld?.(); }
    if (!W) return;
    const y = W.targetOf ? W.targetOf(part) : 0;
    if (instant) W.jump(y); else { if (!W.open) W.enter(0); W.scrollTo(y); }
  }
  async function go(to, { veiled } = {}) {
    if (busy || to === shown && !veiled) return;
    /* next door moves the usual way (the spring, the bridge, the world's scroll); two chapters or more go under the mist */
    const from = current(), far = veiled ?? Math.abs(to - from) >= 2;
    if (!far) {
      if (to < JOURNEY.length) { getWorld()?.close(); getPortfolio()?.close(); journeyTo(to, false); }
      else if (to === 6) { if (getWorld()?.open) getWorld().close(); else await cardsUp(false); }
      else await worldTo(EPILOGUE[to - JOURNEY.length].part, false);
      return;
    }
    busy = true;
    try {
      fill(veilCard, to); veilCard.classList.remove('is-shown');
      veil.classList.remove('is-off'); veil.classList.add('is-on');
      await frames(2); veilCard.classList.add('is-shown');
      const t0 = performance.now();
      await new Promise(r => setTimeout(r, reducedMotion ? 0 : 560));
      if (to < JOURNEY.length) { getWorld()?.close(); getPortfolio()?.close(); journeyTo(to, true); }
      else if (to === 6) { getWorld()?.close(); await cardsUp(true); }
      else { if (!getPortfolio()?.open) await cardsUp(true); await worldTo(EPILOGUE[to - JOURNEY.length].part, true); }
      await frames(3);
      /* the title stands a moment, then the mist clears */
      await new Promise(r => setTimeout(r, Math.max(0, (reducedMotion ? 0 : 1100) - (performance.now() - t0))));
      veilCard.classList.remove('is-shown');
      veil.classList.add('is-off'); veil.classList.remove('is-on');
    } finally { busy = false; }
  }
  /* the rail and the menu: one chapter on, as before; further, under the mist */
  ui.addEventListener('click', event => {
    if (passThrough) return;
    const b = event.target.closest?.('nav [data-flow], nav [data-chapter]'); if (!b) return;
    const to = b.hasAttribute('data-flow') ? Number(b.dataset.flow) : Number(b.dataset.chapter);
    if (!Number.isFinite(to)) return;
    const from = current();
    const plain = to < JOURNEY.length && from < JOURNEY.length && Math.abs(to - from) < 2;
    if (plain) return;   /* the interface's own handler moves the journey */
    event.preventDefault(); event.stopPropagation();
    ui.querySelector('.fi-menu[open]')?.close();
    go(to);
  }, true);
  /* 06's last NEXT, sent by the interface (chapter-flow-build.cjs) */
  ui.addEventListener('fi:flow-next', () => go(6));

  /* ------------------------------------------------------------ every frame */
  function update() {
    const i = current();
    if (i !== shown) paint(i);
    if (rail?.inert && (getPortfolio()?.open || getWorld()?.open)) { rail.inert = false; rail.removeAttribute('aria-hidden'); }
    /* the footer line: the whole site, six chapters of journey, the cards, four of world */
    if (footerLine) {
      const P = getPortfolio(), Wd = getWorld(), J = JOURNEY.length;
      const f = Wd?.open ? (J + 1 + 4 * Math.min(1, Wd.y / Math.max(1, Wd.at.footer || 1))) / TOTAL : P?.open && (P.transition ?? 0) > .5 ? (J + Math.min(1, P.strip || 0)) / TOTAL : J * Math.min(1, journey.progress / Math.max(.001, journey.max)) / TOTAL;
      const v = f.toFixed(4); if (v !== footerLine.dataset.flow) { footerLine.dataset.flow = v; footerLine.style.setProperty('--fi-progress', v); }
    }
    /* the cloud passage: the next chapter's title stands in the mist, in and out with the scroll */
    const W = getWorld();
    let k = 0;
    if (W?.open && !busy) {
      const a = W.at || {}, y = W.y, end = Math.max(1, a.global || a.clouds || innerHeight);
      k = smooth(.04, .22, y / end) * (1 - smooth(.55, .86, y / end));
    }
    const v = k.toFixed(3);
    if (cloud.style.getPropertyValue('--cloud') !== v) { cloud.style.setProperty('--cloud', v); cloud.classList.toggle('is-shown', k > .02); }
  }
  /* its own clock: the page's frame stops short while the cards or the world cover the scene */
  const tick = () => { update(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  return { update, go, get chapter() { return shown; } };
}
