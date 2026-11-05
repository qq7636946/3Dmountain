/* Flow's five public sections: Why Us uses the four original ocean panels;
   Latest News owns its separate WebGL card strip. */
import { createNewsCopyMotion } from '../copy-motion.js?v=flow-mw35buwe';
const SECTIONS = [
  { id: 'core-values', zh: '核心價值', en: 'CORE VALUES' },
  { id: 'investment-strategies', zh: '投資策略', en: 'INVESTMENT STRATEGIES' },
  { id: 'why-us', zh: '為何選擇我們', en: 'WHY FINNOVATION' },
  { id: 'latest-news', zh: '最新消息', en: 'LATEST NEWS' },
  { id: 'global-presence', zh: '全球布局', en: 'GLOBAL PRESENCE' }
];
const NEWS_CATEGORIES = [
  ['COMPANY UPDATES', '公司消息', '恒灝的最新動態與重要資訊，將在此持續更新。'],
  ['INDUSTRY INSIGHTS', '產業觀點', '持續觀察科技、產業與金融市場，分享值得關注的思考。'],
  ['EVENTS', '活動紀事', '交流、對話與合作的最新紀錄，即將於此呈現。']
];
// Retain all seven of the existing WebGL images and their original spread.
// The supplied news categories remain placeholders until articles are provided.
const CARDS = Array.from({ length: 7 }, (_, index) => NEWS_CATEGORIES[index % NEWS_CATEGORIES.length]);
const clamp = v => Math.max(0, Math.min(1, v));
const two = n => String(n + 1).padStart(2, '0');
const wait = ms => new Promise(r => setTimeout(r, ms));
const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

export function createChapterFlow({ ui, journey, getPortfolio, getWorld, loadWorld, warmEpilogue, toCards, getFlow = () => null, reducedMotion = false }) {
  if (!ui) return { update() {}, go() {}, goSection() {} };
  const newsMotion = createNewsCopyMotion({ root: ui, getPortfolio, reducedMotion });
  const rail = ui.querySelector('.fi-rail'), menu = ui.querySelector('.fi-menu-links');
  // Keep the six native journey buttons as private controls for the original
  // interface's camera targets. They never appear in the public navigation.
  const native = document.createElement('div'); native.className = 'site-native-journey'; native.hidden = true; native.setAttribute('aria-hidden', 'true');
  native.append(...rail.querySelectorAll('[data-chapter]')); rail.append(native);
  const button = (s, i, menu = false) => `<button type="button" data-section="${i}" aria-label="${two(i)} ${s.zh}"><span class="${menu ? 'fi-menu-link-number' : 'fi-rail-number'}" aria-hidden="true">${two(i)}</span><span class="${menu ? 'site-menu-copy' : 'fi-rail-label'}">${menu ? `<span class="fi-menu-link-en">${s.en}</span><span class="fi-menu-link-zh">${s.zh}</span>` : s.zh}</span></button>`;
  rail.insertAdjacentHTML('beforeend', SECTIONS.map((s, i) => button(s, i)).join(''));
  rail.setAttribute('aria-label', '網站五大區塊');
  if (menu) menu.innerHTML = SECTIONS.map((s, i) => button(s, i, true)).join('');
  const topnav = ui.querySelector('.fi-topnav');
  if (topnav) topnav.innerHTML = [0, 1, 2].map(i => `<button type="button" data-section="${i}">${SECTIONS[i].zh}</button>`).join('');
  const footerCurrent = ui.querySelector('.fi-footer-current'), footerTotal = ui.querySelector('.fi-footer-total');
  const footerNext = ui.querySelector('.fi-footer-next span'), footerLine = ui.querySelector('.fi-footer-progress i');
  const veil = document.createElement('div'); veil.className = 'fi-flow-veil site-section-veil'; veil.setAttribute('aria-hidden', 'true'); document.body.append(veil);
  let shown = -1, busy = false, disposed = false, raf = 0, panel = null, cardIndex = -1;

  function current() {
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
  async function seaAt(end = false) {
    await warmEpilogue?.();
    const world = getWorld() || await loadWorld?.();
    if (!world) return null;
    await world.ready;
    getPortfolio()?.close();
    journey.progress = journey.target = journey.max; journey.velocity = 0;
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
    if (disposed || busy || !SECTIONS[index]) return;
    const cards = getPortfolio(), world = getWorld();
    if (index === 2 && world?.open && world.leg === 'sea' && !cards?.open) {
      world.scrollTo(world.seaMin);
      if (hash) history.replaceState(null, '', '#' + SECTIONS[index].id);
      return;
    }
    if (index === 3 && cards?.open && cards.transition > .98 && world?.leg !== 'sky') {
      cards.seekProgress(0, false);
      if (hash) history.replaceState(null, '', '#' + SECTIONS[index].id);
      return;
    }
    busy = true; veil.classList.add('is-on');
    try {
      if (!reducedMotion) await wait(260);
      if (index < 2) {
        getWorld()?.close(); getPortfolio()?.close(); getFlow()?.close(true);
        journeyTo(index === 0 ? 0 : 5);
      } else if (index === 2) await seaAt();
      else if (index === 3) await cardsAt(0);
      else {
        await cardsAt(1);
        const global = getWorld();
        if (global) global.jump(global.targetOf('global'), 'sky');
      }
      if (hash) history.replaceState(null, '', '#' + SECTIONS[index].id);
      await frames();
    } finally { veil.classList.remove('is-on'); busy = false; }
  }
  // Private journey indices are still accepted by the original CTAs.
  async function go(index, options) {
    if (index < 6) {
      if (index === 0 || index === 5) return goSection(index === 0 ? 0 : 1, options);
      getWorld()?.close(); getPortfolio()?.close(); journeyTo(index); return;
    }
    return goSection(index === 6 ? 2 : index === 7 ? 3 : 4, options);
  }
  function setupCards() {
    const next = ui.querySelector('.fi-portfolio-copy');
    if (!next || next === panel) return;
    panel = next; panel.classList.add('site-cards-copy');
    panel.innerHTML = `<section class="site-card-intro" id="latest-news" data-card-group="3"><p class="site-section-eyebrow">04 / 最新消息</p><h2 class="site-card-title site-news-title" lang="en">LATEST NEWS</h2><p class="site-card-lead">觀點、動態與交流。<br>在持續更新中，看見恒灝的每一步。</p></section><div class="site-card-detail"><p class="site-card-meta"></p><h3 class="site-card-caption"></h3><p class="site-card-description"></p><p class="site-card-status"></p></div><div class="site-card-controls"><button type="button" data-card-step="-1" aria-label="上一張卡片">←</button><span class="site-card-count"></span><button type="button" data-card-step="1" aria-label="下一張卡片">→</button></div>`;
    cardIndex = -1;
  }
  function updateCards() {
    setupCards(); if (!panel) return;
    const cards = getPortfolio(), progress = clamp(cards?.displayStrip ?? cards?.strip ?? 0);
    const total = CARDS.length, index = Math.min(total - 1, Math.round(progress * (total - 1)));
    if (index === cardIndex) return;
    cardIndex = index; const item = CARDS[index];
    panel.querySelector('.site-card-meta').textContent = `${two(index)} / ${String(total).padStart(2, '0')} · ${item[0]}`;
    panel.querySelector('.site-card-caption').textContent = item[1];
    panel.querySelector('.site-card-description').textContent = item[2];
    panel.querySelector('.site-card-status').textContent = 'COMING SOON · 內容準備中';
    panel.querySelector('.site-card-count').textContent = `${two(index)} / ${String(total).padStart(2, '0')}`;
  }
  function update() {
    if (disposed) return;
    updateCards(); newsMotion.update(); const index = current();
    if (index !== shown) {
      shown = index; ui.dataset.siteSection = String(index);
      ui.querySelectorAll('[data-section]').forEach(b => { if (Number(b.dataset.section) === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      const b = rail.querySelector('[data-section][aria-current]');
      if (b && rail.scrollWidth > rail.clientWidth) rail.scrollTo({ left: Math.max(0, b.offsetLeft - (rail.clientWidth - b.offsetWidth) / 2), behavior: reducedMotion ? 'instant' : 'smooth' });
    }
    const total = `${two(index)} / 05`;
    if (footerCurrent && footerCurrent.textContent !== SECTIONS[index].en) footerCurrent.textContent = SECTIONS[index].en;
    if (footerTotal && footerTotal.textContent !== total) footerTotal.textContent = total;
    const globeWorld = index === 4 ? getWorld() : null;
    const nextText = index === 4 && globeWorld?.y >= (globeWorld?.endY ?? Infinity) - 2 ? 'BACK TO TOP' : 'NEXT SECTION';
    if (footerNext && footerNext.textContent !== nextText) footerNext.textContent = nextText;
    if (rail.inert) { rail.inert = false; rail.removeAttribute('aria-hidden'); }
    const p = getPortfolio(), w = getWorld(); let local = 0;
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
    if (section) { event.preventDefault(); event.stopImmediatePropagation(); ui.querySelector('.fi-menu[open]')?.close(); goSection(section.dataset.section); }
    else if (step) { event.preventDefault(); event.stopImmediatePropagation(); getPortfolio()?.seekProgress(clamp((cardIndex + Number(step.dataset.cardStep)) / Math.max(1, CARDS.length - 1)), false); }
    else if (event.target.closest?.('.fi-footer-next')) {
      event.preventDefault(); event.stopImmediatePropagation();
      const world = getWorld();
      if (current() === 4 && world?.leg === 'sky' && world.next()) return;
      goSection((current() + 1) % 5);
    }
  }
  document.addEventListener('click', onClick, true);
  ui.addEventListener('fi:flow-next', () => goSection(2));
  let deepLink = SECTIONS.findIndex(s => s.id === location.hash.slice(1));
  const checkEntry = setInterval(() => { if (deepLink < 0 || /^(entered|off)$/.test(document.documentElement.dataset.gate || window.__GATE__?.state || 'hold')) { clearInterval(checkEntry); if (deepLink >= 0) goSection(deepLink, { hash: false }); deepLink = -1; } }, 200);
  raf = requestAnimationFrame(update);
  return { update() {}, go, goSection, get chapter() { return shown; }, get sections() { return SECTIONS; }, dispose() { disposed = true; cancelAnimationFrame(raf); clearInterval(checkEntry); document.removeEventListener('click', onClick, true); veil.remove(); } };
}
