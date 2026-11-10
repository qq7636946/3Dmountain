/* Flow's five public sections: Why Us uses the four original ocean panels;
   Latest News owns its separate WebGL card strip. */
import { createNewsCopyMotion } from '../copy-motion.js?v=flow2-editorial-ffa3aa51caff';
import { FLOW_MOTION } from '../motion-tokens.js?v=flow-unified-9c1fe0c6850f';
const SECTIONS = [
  { id: 'core-values', zh: '核心價值', en: 'CORE VALUES' },
  { id: 'investment-strategies', zh: '投資策略', en: 'INVESTMENT STRATEGIES' },
  { id: 'why-us', zh: '為何選擇我們', en: 'WHY FINNOVATION' },
  { id: 'latest-news', zh: '最新消息', en: 'LATEST NEWS' },
  { id: 'global-presence', zh: '全球布局', en: 'GLOBAL PRESENCE' }
];
const NEWS_CATEGORIES = [
  ['COMPANY UPDATES', '公司消息', '恒灝的最新動態與重要資訊，將在此持續更新'],
  ['INDUSTRY INSIGHTS', '產業觀點', '持續觀察科技、產業與金融市場，分享值得關注的思考'],
  ['EVENTS', '活動紀事', '交流、對話與合作的最新紀錄，即將於此呈現']
];
const NEWS_PHOTOS = ['governance-architecture', 'strategy-derivatives', 'responsibility-team'];
// Retain all seven of the existing WebGL images and their original spread.
// The supplied news categories remain placeholders until articles are provided.
const CARDS = Array.from({ length: 7 }, (_, index) => NEWS_CATEGORIES[index % NEWS_CATEGORIES.length]);
const clamp = v => Math.max(0, Math.min(1, v));
const two = n => String(n + 1).padStart(2, '0');
const wait = ms => new Promise(r => setTimeout(r, ms));
const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

function mountPlainNews() {
  const section = document.createElement('section');
  section.id = 'latest-news';
  section.className = 'flow2-static-news';
  section.hidden = true;
  section.tabIndex = 0;
  section.setAttribute('aria-labelledby', 'flow2-static-news-title');
  const cards = NEWS_CATEGORIES.map(([type, title, text], index) => {
    const photo = new URL('../../index1-5/assets/ocean/' + NEWS_PHOTOS[index] + '-480.webp', import.meta.url).href;
    return `<article class="flow2-static-news-card">
      <img src="${photo}" alt="" width="480" height="270" loading="lazy" decoding="async">
      <div class="flow2-static-news-card-copy">
        <p class="flow2-static-news-kicker" lang="en">${type}</p>
        <h3>${title}</h3>
        <p>${text}</p>
        <p class="flow2-static-news-status">內容準備中</p>
      </div>
    </article>`;
  }).join('');
  section.innerHTML = `<div class="flow2-static-news-content">
    <header class="flow2-static-news-heading">
      <p class="flow2-static-news-kicker">04 / 最新消息</p>
      <h2 id="flow2-static-news-title" lang="en">LATEST NEWS</h2>
      <p>觀點、動態與交流</p>
      <p>在持續更新中，看見恒灝的每一步</p>
    </header>
    <div class="flow2-static-news-cards">${cards}</div>
    <nav class="flow2-static-news-links" aria-label="相鄰區塊">
      <button type="button" data-section="2">← 為何選擇我們</button>
      <button type="button" data-section="4">全球布局 →</button>
    </nav>
  </div>`;
  document.body.append(section);
  return section;
}


function newsTickerMarkup() {
  const items = NEWS_CATEGORIES.map(([type, title, text], index) =>
    `<article class="site-news-item${index === 0 ? ' is-current' : ''}"${index === 0 ? '' : ' aria-hidden="true"'}>
      <p class="site-news-index">${two(index)} / ${String(NEWS_CATEGORIES.length).padStart(2, '0')} · ${type}</p>
      <h3 class="site-news-name">${title}</h3>
      <p class="site-news-description">${text}</p>
      <p class="site-news-status">COMING SOON · 內容準備中</p>
    </article>`).join('');
  return `<div class="site-news-ticker" role="group" aria-label="最新消息輪播">
    <div class="site-news-window">${items}</div>
    <div class="site-news-controls">
      <button type="button" data-news-pause aria-label="暫停消息輪播"><span aria-hidden="true" class="site-news-pause">Ⅱ</span><span aria-hidden="true" class="site-news-play">▸</span></button>
      <button type="button" data-news-next aria-label="下一則消息"><span aria-hidden="true">↓</span></button>
    </div>
    <span class="site-news-announcement" data-news-announcement aria-live="polite"></span>
  </div>`;
}


function mountNewsTicker(ticker, reducedMotion) {
  const items = [...ticker.querySelectorAll('.site-news-item')];
  const pause = ticker.querySelector('[data-news-pause]');
  const next = ticker.querySelector('[data-news-next]');
  const announcement = ticker.querySelector('[data-news-announcement]');
  const events = new AbortController();
  const options = { signal: events.signal };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let active = false, paused = reducedMotion, hovering = false, focused = false;
  let index = 0, timer;

  function rotate() {
    const previous = items[index];
    index = (index + 1) % items.length;
    for (const item of items) item.classList.remove('is-entering', 'is-leaving');
    const current = items[index];
    previous.classList.remove('is-current');
    previous.setAttribute('aria-hidden', 'true');
    current.classList.add('is-current');
    current.removeAttribute('aria-hidden');
    if (!motion.matches) {
      previous.classList.add('is-leaving');
      current.classList.add('is-entering');
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (!active || paused || motion.matches || document.hidden || hovering || focused) return;
    timer = setTimeout(() => { rotate(); schedule(); }, 5600);
  }

  function updatePause() {
    const stopped = paused || motion.matches;
    pause.setAttribute('aria-label', stopped ? '播放消息輪播' : '暫停消息輪播');
    pause.toggleAttribute('data-paused', stopped);
    pause.hidden = motion.matches;
    schedule();
  }

  pause.addEventListener('click', () => { paused = !paused; updatePause(); }, options);
  next.addEventListener('click', () => {
    rotate();
    announcement.textContent = items[index].querySelector('h3').textContent;
    schedule();
  }, options);
  ticker.addEventListener('animationend', event => {
    if (event.target.classList.contains('site-news-item')) event.target.classList.remove('is-entering', 'is-leaving');
  }, options);
  ticker.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') { hovering = true; schedule(); }
  }, options);
  ticker.addEventListener('pointerleave', () => { hovering = false; schedule(); }, options);
  ticker.addEventListener('focusin', () => { focused = true; schedule(); }, options);
  ticker.addEventListener('focusout', event => { focused = ticker.contains(event.relatedTarget); schedule(); }, options);
  document.addEventListener('visibilitychange', schedule, options);
  motion.addEventListener('change', updatePause, options);
  updatePause();

  return {
    setActive(value) {
      if (value === active) return;
      active = value;
      schedule();
    },
    dispose() {
      clearTimeout(timer);
      events.abort();
    }
  };
}

export function createChapterFlow({ ui, journey, getPortfolio, getWorld, loadWorld, warmEpilogue, toCards, getFlow = () => null, onPlainNewsChange, reducedMotion = false, restoreHash = true }) {
  if (!ui) return { update() {}, go() {}, goSection() {} };
  const page = document.documentElement;
  const plainNews = page.hasAttribute('data-flow2-plain-news');
  const newsMotion = plainNews ? null : createNewsCopyMotion({ root: ui, getPortfolio, reducedMotion });
  const independentNews = page.hasAttribute('data-flow2-news-ticker');
  const menuDialog = ui.querySelector('#fi-menu');
  let newsTicker, newsSection, plainNewsOpen = false;
  const rail = ui.querySelector('.fi-rail'), menu = ui.querySelector('.fi-menu-links');
  // Keep the six native journey buttons as private controls for the original
  // interface's camera targets. They never appear in the public navigation.
  const native = document.createElement('div'); native.className = 'site-native-journey'; native.hidden = true; native.setAttribute('aria-hidden', 'true');
  native.append(...rail.querySelectorAll('[data-chapter]')); rail.append(native);
  const blueInterface = document.documentElement.hasAttribute('data-flow2-blue-ui');
  const button = (s, i, menu = false) => {
    let label = s.zh;
    if (menu) label = `<span class="fi-menu-link-en" lang="en">${s.en}</span><span class="fi-menu-link-zh">${s.zh}</span>`;
    else if (blueInterface) label = `<span class="fi-rail-en" lang="en">${s.en}</span><span class="fi-rail-zh">${s.zh}</span>`;
    return `<button type="button" data-section="${i}" aria-label="${two(i)} ${s.zh}"><span class="${menu ? 'fi-menu-link-number' : 'fi-rail-number'}" aria-hidden="true">${two(i)}</span><span class="${menu ? 'site-menu-copy' : 'fi-rail-label'}">${label}</span></button>`;
  };
  rail.insertAdjacentHTML('beforeend', SECTIONS.map((s, i) => button(s, i)).join(''));
  rail.setAttribute('aria-label', '網站五大區塊');
  if (menu) menu.innerHTML = SECTIONS.map((s, i) => button(s, i, true)).join('');
  const topnav = ui.querySelector('.fi-topnav');
  if (topnav) topnav.innerHTML = [0, 1, 2].map(i => `<button type="button" data-section="${i}">${SECTIONS[i].zh}</button>`).join('');
  const footerCurrent = ui.querySelector('.fi-footer-current'), footerTotal = ui.querySelector('.fi-footer-total');
  const footerNext = ui.querySelector('.fi-footer-next span'), footerLine = ui.querySelector('.fi-footer-progress i');
  const veil = document.createElement('div'); veil.className = 'fi-flow-veil site-section-veil'; veil.setAttribute('aria-hidden', 'true'); document.body.append(veil);
  if (document.documentElement.hasAttribute('data-flow2-section-wipe')) {
    const label = document.createElement('span'); label.className = 'flow2-section-veil-label'; veil.append(label);
  }
  let shown = -1, busy = false, disposed = false, raf = 0, panel = null, cardIndex = -1, queuedSection = null;
  let cardButtons = [], cardEdges = -1;

  function setPlainNews(open) {
    if (open === plainNewsOpen) return;
    if (open) newsSection ??= mountPlainNews();
    plainNewsOpen = open;
    newsSection.hidden = !open;
    page.toggleAttribute('data-flow2-plain-news-open', open);
    document.body.classList.toggle('is-portfolio', open);
    onPlainNewsChange?.(open);
  }

  function current() {
    if (plainNewsOpen) return 3;
    const world = getWorld(), cards = getPortfolio();
    if (world?.open && world.leg === 'sky') return 4;
    if (cards?.open && cards.transition > .5) return 3;
    if (world?.open && (getFlow()?.amount ?? 1) > .4) return 2;
    return journey.mix > .04 || Number(ui.dataset.journeyIndex) >= 2 ? 1 : 0;
  }

  function journeyTo(i) {
    ui.querySelector(`.fi-rail [data-chapter="${i}"]`)?.click();
    journey.progress = journey.target; journey.velocity = 0;
  }
  async function worldAtJourneyEnd() {
    await warmEpilogue?.();
    if (disposed) return null;
    const world = getWorld() || await loadWorld?.();
    if (!world) return null;
    await world.ready;
    if (disposed) return null;
    getPortfolio()?.close();
    journey.progress = journey.target = journey.max; journey.velocity = 0;
    return world;
  }
  async function seaAt(end = false) {
    const world = await worldAtJourneyEnd();
    if (!world || disposed) return null;
    getFlow()?.settle();
    world.jump(end ? Infinity : world.targetOf('responsibility'), 'sea');
    return world;
  }
  async function cardsAt(progress) {
    const world = await seaAt(true);
    if (!world) return false;
    const cards = getPortfolio();
    return !!cards && await cards.openAt(progress);
  }
  async function goSection(index, { hash = true } = {}) {
    index = Number(index);
    if (disposed || !SECTIONS[index]) return;
    // Warm-up is asynchronous. Preserve the latest navigation intent instead
    // of silently discarding a quick reverse click while the first is loading.
    if (busy) { queuedSection = { index, hash }; return; }
    if (plainNews && index === 3) {
      // News can open even when the visitor has never loaded either 3D scene.
      setPlainNews(true);
      getWorld()?.close(true);
      getFlow()?.close(true);
      newsSection.scrollTop = 0;
      newsSection.focus({ preventScroll: true });
      if (hash) history.replaceState(null, '', '#' + SECTIONS[index].id);
      return;
    }
    const cards = getPortfolio(), world = getWorld();
    if (index === 2 && world?.open && world.leg === 'sea' && !cards?.open) {
      getFlow()?.settle();
      world.scrollTo(world.seaMin);
      if (hash) history.replaceState(null, '', '#' + SECTIONS[index].id);
      return;
    }
    if (index === 3 && cards?.open && cards.transition > .98 && world?.leg !== 'sky') {
      cards.seekProgress(0, false);
      if (hash) history.replaceState(null, '', '#' + SECTIONS[index].id);
      return;
    }
    if (veil.firstElementChild) {
      const from = ui.dataset.siteSection;
      veil.toggleAttribute('data-sea-news', (from === '2' && index === 3) || (from === '3' && index === 2));
      veil.firstElementChild.textContent = two(index) + ' / 05  ·  ' + SECTIONS[index].zh;
    }
    const fromPlainNews = plainNewsOpen;
    const restoreNewsFocus = fromPlainNews && newsSection.contains(document.activeElement);
    busy = true;
    veil.toggleAttribute('data-plain-news-handoff', fromPlainNews);
    veil.classList.add('is-on');
    setPlainNews(false);
    try {
      // Match the veil's full cover before swapping a remote chapter.
      if (!reducedMotion && !fromPlainNews) await wait(FLOW_MOTION.navigationMs);
      if (index < 2) {
        getWorld()?.close(); getPortfolio()?.close(); getFlow()?.close(true);
        journeyTo(index === 0 ? 0 : 5);
      } else if (index === 2) await seaAt();
      else if (index === 3) await cardsAt(0);
      else if (plainNews) {
        const global = await worldAtJourneyEnd();
        getFlow()?.close(true);
        if (global) global.jump(global.targetOf('global'), 'sky');
      } else {
        await cardsAt(1);
        const global = getWorld();
        if (global) global.jump(global.targetOf('global'), 'sky');
      }
      if (hash) history.replaceState(null, '', '#' + SECTIONS[index].id);
      await frames();
    } finally {
      busy = false;
      const queued = queuedSection; queuedSection = null;
      veil.classList.remove('is-on');
      if (restoreNewsFocus && !queued) rail.querySelector(`[data-section="${index}"]`)?.focus({ preventScroll: true });
      if (queued && !disposed) void goSection(queued.index, { hash: queued.hash });
    }
  }
  // Private journey indices are still accepted by the original CTAs.
  async function go(index, options) {
    if (index < 6) {
      if (index === 0 || index === 5) return goSection(index === 0 ? 0 : 1, options);
      setPlainNews(false);
      getWorld()?.close(); getPortfolio()?.close(); getFlow()?.close(true); journeyTo(index); return;
    }
    return goSection(index === 6 ? 2 : index === 7 ? 3 : 4, options);
  }
  function setupCards() {
    const next = ui.querySelector('.fi-portfolio-copy');
    if (!next || next === panel) return;
    panel = next; panel.classList.add('site-cards-copy');
    const intro = `<section class="site-card-intro" id="latest-news" data-card-group="3"><p class="site-section-eyebrow">04 / 最新消息</p><h2 class="site-card-title site-news-title" lang="en">LATEST NEWS</h2><p class="site-card-lead"><span class="site-card-subtitle">觀點、動態與交流</span><span class="site-card-support">在持續更新中，看見恒灝的每一步</span></p></section>`;
    const detail = independentNews ? newsTickerMarkup() : `<div class="site-card-detail"><p class="site-card-meta"></p><h3 class="site-card-caption"></h3><p class="site-card-description"></p><p class="site-card-status"></p></div>`;
    const controls = independentNews ? `<div class="site-card-controls" role="group" aria-label="圖卡控制"><button type="button" data-card-step="-1" aria-label="上一張卡片"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4m0 0 5-5m-5 5 5 5"/></svg></button><span class="site-card-count"></span><button type="button" data-card-step="1" aria-label="下一張卡片"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m0 0-5-5m5 5-5 5"/></svg></button></div>` : `<div class="site-card-controls"><button type="button" data-card-step="-1" aria-label="上一張卡片">←</button><span class="site-card-count"></span><button type="button" data-card-step="1" aria-label="下一張卡片">→</button></div>`;
    panel.innerHTML = intro + detail + controls;
    newsTicker?.dispose();
    if (independentNews) {
      newsTicker = mountNewsTicker(panel.querySelector('.site-news-ticker'), reducedMotion);
      cardButtons = [...panel.querySelectorAll('[data-card-step]')];
      cardEdges = -1;
    }
    cardIndex = -1;
  }
  function updateCards() {
    setupCards(); if (!panel) return;
    const cards = getPortfolio(), progress = clamp(cards?.displayStrip ?? cards?.strip ?? 0);
    const total = CARDS.length, index = Math.min(total - 1, Math.round(progress * (total - 1)));
    if (independentNews) {
      const target = cards?.strip ?? 0, edges = (target <= 0 ? 1 : 0) | (target >= 1 ? 2 : 0);
      if (edges !== cardEdges) {
        cardEdges = edges;
        cardButtons[0].setAttribute('aria-disabled', String(Boolean(edges & 1)));
        cardButtons[1].setAttribute('aria-disabled', String(Boolean(edges & 2)));
      }
    }
    if (index === cardIndex) return;
    cardIndex = index;
    const position = `${two(index)} / ${String(total).padStart(2, '0')}`;
    const count = panel.querySelector('.site-card-count');
    count.textContent = independentNews ? '[' + position + ']' : position;
    if (independentNews) {
      count.style.setProperty('--card-index', String((index + 1) / total));
      return;
    }
    const [type, title, description] = CARDS[index];
    panel.querySelector('.site-card-meta').textContent = position + ' · ' + type;
    panel.querySelector('.site-card-caption').textContent = title;
    panel.querySelector('.site-card-description').textContent = description;
    panel.querySelector('.site-card-status').textContent = 'COMING SOON · 內容準備中';
  }
  function centerRail(behavior) {
    const active = rail.querySelector('[data-section][aria-current]');
    if (!active || rail.scrollWidth <= rail.clientWidth) return;
    const start = active.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    rail.scrollTo({ left: Math.max(0, start - (rail.clientWidth - active.offsetWidth) / 2), behavior });
  }
  const railResize = independentNews && typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => centerRail('instant')) : null;
  railResize?.observe(rail);
  function update() {
    if (disposed) return;
    if (!plainNews) { updateCards(); newsMotion.update(); }
    const index = current();
    if (index !== shown) {
      shown = index; ui.dataset.siteSection = String(index);
      ui.querySelectorAll('[data-section]').forEach(b => { if (Number(b.dataset.section) === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      centerRail(reducedMotion || plainNewsOpen ? 'instant' : 'smooth');
    }
    const total = `${two(index)} / 05`;
    if (footerCurrent && footerCurrent.textContent !== SECTIONS[index].en) footerCurrent.textContent = SECTIONS[index].en;
    if (footerTotal && footerTotal.textContent !== total) footerTotal.textContent = total;
    const globeWorld = index === 4 ? getWorld() : null;
    const nextText = index === 4 && globeWorld?.y >= (globeWorld?.endY ?? Infinity) - 2 ? 'BACK TO TOP' : 'NEXT SECTION';
    if (footerNext && footerNext.textContent !== nextText) footerNext.textContent = nextText;
    if (rail.inert) { rail.inert = false; rail.removeAttribute('aria-hidden'); }
    const p = getPortfolio(), w = getWorld(); let local = 0;
    newsTicker?.setActive(index === 3 && p?.transition >= .92 && !busy && !menuDialog?.open);
    if (index === 0) local = clamp(journey.progress / (journey.max * .35));
    if (index === 1) local = clamp((journey.progress / journey.max - .35) / .65);
    if (index === 2) local = clamp(((w?.y || 0) - (w?.seaMin || 0)) / Math.max(1, (w?.seaMax || 1) - (w?.seaMin || 0)));
    if (index === 3) local = clamp(p?.displayStrip ?? p?.strip ?? 0);
    if (index === 4) local = clamp((w?.y || 0) / Math.max(1, w?.at.footer || 1));
    const progress = ((index + local) / 5).toFixed(4);
    if (footerLine && footerLine.dataset.siteProgress !== progress) { footerLine.dataset.siteProgress = progress; footerLine.style.setProperty('--fi-progress', progress); }
    raf = requestAnimationFrame(update);
  }
  function onClick(event) {
    const section = event.target.closest?.('[data-section]'), step = event.target.closest?.('[data-card-step]');
    const newsHome = plainNewsOpen && event.target.closest?.('.fi-header .fi-brand[data-chapter="0"]');
    if (section || newsHome) {
      event.preventDefault(); event.stopImmediatePropagation();
      ui.querySelector('.fi-menu[open]')?.close();
      goSection(newsHome ? 0 : section.dataset.section);
    }
    else if (step) {
      event.preventDefault(); event.stopImmediatePropagation();
      const cards = getPortfolio(), span = Math.max(1, CARDS.length - 1), dir = Number(step.dataset.cardStep);
      if (!cards) return;
      if (independentNews && (dir < 0 ? cards.strip <= 0 : cards.strip >= 1)) return;
      // Step from the requested card so a quick second press still advances.
      const from = independentNews ? Math.round(cards.strip * span) : cardIndex;
      cards.seekProgress(clamp((from + dir) / span), false);
    }
    else if (event.target.closest?.('.fi-footer-next')) {
      event.preventDefault(); event.stopImmediatePropagation();
      const world = getWorld();
      if (current() === 4 && world?.leg === 'sky' && world.next()) return;
      goSection((current() + 1) % 5);
    }
  }
  document.addEventListener('click', onClick, true);
  ui.addEventListener('fi:flow-next', () => goSection(2));
  let deepLink = restoreHash ? SECTIONS.findIndex(s => s.id === location.hash.slice(1)) : -1;
  const checkEntry = setInterval(() => { if (deepLink < 0 || /^(entered|off)$/.test(document.documentElement.dataset.gate || window.__GATE__?.state || 'hold')) { clearInterval(checkEntry); if (deepLink >= 0) goSection(deepLink, { hash: false }); deepLink = -1; } }, 200);
  raf = requestAnimationFrame(update);
  return {
    update() {}, go, goSection,
    get chapter() { return shown; },
    get sections() { return SECTIONS; },
    get plainNewsOpen() { return plainNewsOpen; },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); clearInterval(checkEntry);
      railResize?.disconnect(); newsTicker?.dispose();
      setPlainNews(false); newsSection?.remove();
      document.removeEventListener('click', onClick, true); veil.remove();
    }
  };
}
