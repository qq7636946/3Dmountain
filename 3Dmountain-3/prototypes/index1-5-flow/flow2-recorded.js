import { createWorldSectionMotion } from './copy-motion.flow2.js?v=flow2-editorial-ffa3aa51caff';
import { createStrategyReveal } from './strategy-reveal.js?v=recorded-20261109';
import { consumeMobileScroll, isNativeTouchControl, mountMobileTouchNavigation } from '../index1-5/js/mobile-touch-navigation.js?v=i15-mw30beoi';
import { prepareOceanDom } from './js/ocean-chapter-dom.js?v=recorded-20261109';
import { oceanPanelState, oceanProgress } from '../index1-5/js/world-ocean-scroll.js?v=i15-mw30beoi';
import { mountRecordedPlates } from './flow2-recorded-plates.js?v=recorded-20261109';

const TIMELINE = { max: 13.074, logoStart: 1.95, logoEnd: 3.75, shift: 2.894 };
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mobile = matchMedia('(max-width: 760px) and (orientation: portrait)');

export async function startRecorded(snapshot) {
  const page = document.documentElement, body = document.body;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const variant = document.getElementById('journeyModule').src.includes('/main.flow2.js') ? '.flow2' : '';
  const [{ mountJourneyInterface }, { createChapterFlow }] = await Promise.all([
    import('./js/finnovation-interface' + variant + '.js?v=recorded-20261109'),
    import('./js/site-sections' + variant + '.js?v=recorded-20261109')
  ]);
  const journey = { ...TIMELINE, progress: clamp((snapshot?.progress || 0) / (snapshot?.max || TIMELINE.max)) * TIMELINE.max, target: 0, velocity: 0, mix: 0 };
  journey.target = journey.progress;
  const ui = snapshot?.ui || mountJourneyInterface({ navigate, reducedMotion: motion.matches });
  ui.setNavigation(navigate);
  const rail = ui.root.querySelector('.fi-rail');
  rail.querySelectorAll('[data-section]').forEach(button => button.remove());
  const oldNative = rail.querySelector('.site-native-journey');
  if (oldNative) { rail.append(...oldNative.children); oldNative.remove(); }
  body.classList.remove('is-journey-moving', 'is-sea-flow', 'is-sea-flow-out', 'is-world', 'is-world-dark', 'is-portfolio');
  document.getElementById('flow2-canyon-atlas').hidden = true;
  document.querySelector('.alp-labels')?.remove();
  const clips = mountRecordedPlates(mobile, motion);

  const panel = document.createElement('article');
  panel.className = 'fi-copy-panel fi-portfolio-copy';
  panel.tabIndex = -1;
  panel.style.transition = 'none';
  ui.root.querySelector('.fi-copy').append(panel);
  const header = ui.root.querySelector('.fi-header');
  const worldRoot = document.getElementById('fiWorld');
  prepareOceanDom(worldRoot);
  const viewport = worldRoot.querySelector('.fiw-viewport');
  const worldSections = [...worldRoot.querySelector('.fiw-content').children];
  const sea = worldRoot.querySelector('#responsibility');
  const panels = [...sea.querySelectorAll('.fiwo-panel')];
  const seaButtons = [...sea.querySelectorAll('.fiwo-progress [data-ocean-go]')];
  const global = worldRoot.querySelector('#global');
  const principles = worldRoot.querySelector('#principles');
  const principleCopy = principles.querySelector('.fiwp-layout');
  const logo = worldRoot.querySelector('#logo-seal');
  const logoCopy = logo.querySelector('.fisl-text');
  const seaProgress = sea.querySelector('.fiwo-progress');
  const sectionMotion = createWorldSectionMotion({ root: worldRoot, reducedMotion: motion.matches });
  const mainPanels = [...ui.root.querySelectorAll('.fi-copy-panel[data-copy]')];

  let leg = '', y = 0, targetY = 0, step = 1, seaStart = 0, stride = innerWidth, skyStops = [];
  let cardOpen = false, card = 0, cardTarget = 0, live = false, raf = 0, last = 0;
  let previousOwner = '', previousChapter = '';
  let skyEnd = 0, logoTop = 0, footerTop = 0;
  const endSea = () => seaStart + step * (panels.length - 1);
  const top = element => element.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
  const close = () => { leg = ''; y = targetY = 0; wake(); };

  function layout() {
    const h = innerHeight;
    worldRoot.style.setProperty('--fiwo-w', innerWidth + 'px');
    for (const name of ['--fiwo-h', '--fiwp-h', '--fisl-h']) worldRoot.style.setProperty(name, h + 'px');
    if (!leg) return;
    if (leg === 'sea') {
      const copy = panels[0].querySelector('.fiwo-strategy-copy');
      const visual = panels[0].querySelector('.fiwo-strategy-visual');
      const width = Math.max(copy.offsetLeft + copy.offsetWidth, visual.offsetLeft + visual.offsetWidth) - Math.min(copy.offsetLeft, visual.offsetLeft);
      stride = (innerWidth + clamp(width, 1, innerWidth)) * .5;
      step = Math.round(1.3 * h * stride / innerWidth);
      sea.style.height = h + step * (panels.length - 1) + 'px';
      seaStart = top(sea);
    } else {
      const principleEnd = principles.querySelector('.fiwp-bottom');
      if (principleEnd) principles.style.marginBottom = -Math.max(0, top(principles) + principles.offsetHeight - top(principleEnd) - principleEnd.offsetHeight) + 'px';
      logo.style.height = h * 4.08 + 'px';
      skyEnd = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      logoTop = top(logo);
      footerTop = top(worldRoot.querySelector('#contact'));
      skyStops = [top(global) + h * .2, top(principles), logoTop + h * 1.73, skyEnd];
    }
    sectionMotion.measure(innerWidth, h, top, { ocean: { stops: panels.map((_, i) => seaStart + i * step) } });
  }

  function paintOwner() {
    const owner = leg === 'sky' ? 'sky' : cardOpen ? 'news' : leg === 'sea' ? 'sea' : 'journey';
    if (owner === previousOwner) return owner;
    previousOwner = owner;
    const showWorld = owner === 'sky' || owner === 'sea';
    body.classList.toggle('is-world', showWorld);
    body.classList.toggle('is-world-dark', showWorld);
    body.classList.toggle('is-portfolio', owner === 'news');
    worldRoot.hidden = !showWorld;
    worldRoot.inert = !showWorld;
    worldRoot.setAttribute('aria-hidden', String(!showWorld));
    worldRoot.classList.toggle('is-open', showWorld);
    worldRoot.classList.toggle('is-live', showWorld);
    worldRoot.classList.toggle('is-ocean', owner === 'sea');
    worldRoot.classList.toggle('is-sea-leg', owner === 'sea');
    worldRoot.classList.toggle('is-sky-leg', owner === 'sky');
    worldRoot.classList.add('fiwo-on', 'fisl-on');
    worldRoot.classList.toggle('fiwo-still', motion.matches);
    for (const section of worldSections) {
      section.inert = owner === 'sea' ? section !== sea : section === sea;
      if (section === sea || section.matches('.fiwo-dive')) section.hidden = owner === 'sky';
    }
    sectionMotion.close();
    if (owner === 'sea') { worldRoot.classList.remove('is-light'); loadOceanPhotos(); }
    panel.style.visibility = owner === 'news' ? 'visible' : 'hidden';
    panel.style.opacity = owner === 'news' ? '1' : '0';
    panel.inert = owner !== 'news';
    panel.setAttribute('aria-hidden', String(panel.inert));
    header.style.setProperty('--alp-bridge-ink', owner === 'news' ? '1' : '0');
    return owner;
  }

  let photosLoaded = false;
  function loadOceanPhotos() {
    if (photosLoaded) return;
    photosLoaded = true;
    for (const image of sea.querySelectorAll('[data-ocean-photo]')) {
      const base = new URL('../index1-5/assets/ocean/' + image.dataset.oceanPhoto, import.meta.url).href;
      image.addEventListener('load', () => image.closest('figure').classList.add('is-loaded'), { once: true });
      image.srcset = base + '-480.webp 480w, ' + base + '-800.webp 800w';
      image.src = base + '-800.webp';
      if (image.complete && image.naturalWidth) image.closest('figure').classList.add('is-loaded');
    }
  }

  function limitY(value) {
    return leg === 'sea' ? clamp(value, seaStart, endSea()) : clamp(value, skyStops[0] || 0, skyEnd);
  }
  const world = {
    ready: Promise.resolve(),
    get open() { return Boolean(leg); },
    get leg() { return leg; },
    get y() { return y; },
    get at() { return { footer: footerTop }; },
    get seaMin() { return seaStart; },
    get seaMax() { return endSea(); },
    get endY() { return skyEnd; },
    targetOf(name) { return ({ global: skyStops[0] || 0, responsibility: seaStart, principles: skyStops[1], logo: skyStops[2], contact: skyEnd })[name]; },
    scrollTo(value) { targetY = limitY(value); wake(); },
    jump(value, which) {
      leg = which;
      paintOwner();
      layout();
      y = targetY = limitY(value);
      wake();
    },
    next() {
      const stops = leg === 'sea' ? panels.map((_, index) => seaStart + step * index) : skyStops;
      const next = stops.find(stop => stop > Math.max(y, targetY) + 4);
      if (next === undefined) return false;
      world.scrollTo(next); return true;
    },
    close
  };
  const portfolio = {
    get open() { return cardOpen; },
    get strip() { return cardTarget; },
    get displayStrip() { return card; },
    get transition() { return cardOpen ? 1 : 0; },
    seekProgress(value, immediate = false) {
      cardTarget = clamp(value);
      if (immediate) card = cardTarget;
      wake();
    },
    openAt(value) { cardOpen = true; portfolio.seekProgress(value, true); return true; },
    close() { cardOpen = false; wake(); }
  };

  function navigate(p) {
    if (!Number.isFinite(p)) return;
    close(); portfolio.close();
    journey.target = clamp(p, 0, journey.max);
    window.dispatchEvent(new CustomEvent('finnovation:navigate', { detail: { target: journey.target } }));
    wake();
  }

  const reveal = createStrategyReveal({ journey, enabled: () => live && !ui.menuOpen,
    blocked: () => world.open || portfolio.open, initialCount: snapshot?.tributary });
  const chapterFlow = createChapterFlow({
    ui: ui.root, journey, getPortfolio: () => portfolio, getWorld: () => world,
    toCards: () => chapterFlow.goSection(3), reducedMotion: motion.matches, restoreHash: !snapshot
  });
  window.__MONTIS_STUDY__ = { journey, journeyUI: ui, chapterFlow, strategyReveal: reveal, world, portfolio, recorded: true };

  function paint(now) {
    raf = 0;
    const owner = paintOwner(), factor = motion.matches ? 1 : 1 - Math.exp(-clamp((now - last) / 1000, 0.012, .05) * 12);
    last = now;
    const approach = (value, target, epsilon) => Math.abs(target - value) < epsilon ? target : value + (target - value) * factor;
    journey.progress = approach(journey.progress, journey.target, .002);
    journey.mix = clamp((journey.progress - 4.15) / 1.12);
    reveal.frame();
    ui.update(journey);
    const chapterKey = owner + '/' + ui.root.dataset.chapter;
    if (chapterKey !== previousChapter) {
      for (const el of mainPanels) {
        const hidden = owner !== 'journey' || !el.classList.contains('is-active');
        el.inert = hidden; el.setAttribute('aria-hidden', String(hidden));
      }
      previousChapter = chapterKey;
    }
    if (owner === 'sea') {
      y = approach(y, targetY, .5);
      const progress = oceanProgress((y - seaStart) / step, panels.length, motion.matches);
      if (Math.abs(viewport.scrollTop - seaStart) > 1) viewport.scrollTop = seaStart;
      for (const [index, el] of panels.entries()) {
        const { x, visible: selected } = oceanPanelState({ index, progress, width: stride, reducedMotion: motion.matches, count: panels.length });
        const visible = motion.matches ? selected : x <= innerWidth + 1 && x + innerWidth >= -1;
        el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
        el.style.visibility = visible ? 'visible' : 'hidden';
        el.style.opacity = '1';
        el.inert = !visible;
      }
      seaProgress.style.setProperty('--q', String(progress / Math.max(1, panels.length - 1)));
      for (const [index, button] of seaButtons.entries()) {
        const current = index === Math.round(progress);
        button.classList.toggle('is-active', current);
        if (current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      }
      sectionMotion.paint({ o: { panel0: 1, h: progress } }, y);
      clips.show('sea', 0, true);
    } else if (owner === 'news') {
      card = approach(card, cardTarget, .001);
      clips.show('news', card);
    } else if (owner === 'sky') {
      y = approach(y, targetY, .5);
      if (Math.abs(viewport.scrollTop - y) > 1) viewport.scrollTop = y;
      const local = (y - logoTop) / innerHeight;
      body.classList.toggle('is-world-dark', footerTop - y > 70);
      worldRoot.classList.toggle('is-light', footerTop - y < innerHeight * .5);
      logoCopy.style.visibility = local > .6 && local < 3.1 ? 'visible' : 'hidden';
      logoCopy.style.setProperty('--p', String(clamp((local - .6) / .9)));
      principleCopy.style.visibility = 'visible';
      principleCopy.style.setProperty('--show', '1');
      sectionMotion.paint({}, y);
      worldRoot.classList.toggle('is-chapters', innerWidth > 960 && y < skyEnd - innerHeight * .4);
      const atGlobe = y <= skyStops[0] + 1 && targetY <= y + 1;
      if (atGlobe) clips.show('globe', 0, true);
      else clips.show('sky', clips.skyProgress(y, skyStops));
    } else if (journey.progress < .002 && journey.target < .002) {
      clips.show('hero', 0, true);
    } else if (journey.progress >= journey.max - .045) {
      clips.showTributary(reveal.state.count);
    } else {
      if (journey.progress > 6.3) clips.preloadTributaries();
      clips.show('journey', journey.progress / journey.max);
    }
    if (journey.progress !== journey.target || (owner === 'news' && card !== cardTarget) ||
        ((owner === 'sea' || owner === 'sky') && y !== targetY)) wake();
  }

  function wake() { if (live && !raf) raf = requestAnimationFrame(paint); }

  function advance(delta, source, element) {
    if (!delta || ui.menuOpen || isNativeTouchControl(element)) return;
    const pixels = delta * Math.max(720, innerHeight * .85);
    const owner = paintOwner();
    if (owner === 'sky' || owner === 'sea') {
      const rest = consumeMobileScroll(element, pixels);
      if (!rest) return;
      if (owner === 'sky' && rest < 0 && y <= skyStops[0] + 1) {
        portfolio.openAt(1); close();
      } else if (owner === 'sea' && rest > 0 && y >= endSea() - 1) {
        portfolio.openAt(0);
      } else if (owner === 'sea' && rest < 0 && y <= seaStart + 1) {
        close(); journey.target = journey.max - .06;
      } else world.scrollTo(targetY + rest);
    } else if (owner === 'news') {
      if (delta > 0 && card >= .999) world.jump(0, 'sky');
      else if (delta < 0 && card <= .001) { portfolio.close(); world.jump(Infinity, 'sea'); }
      else portfolio.seekProgress(cardTarget + delta / 4.5);
    } else if (!reveal.take(delta, source)) {
      if (delta > 0 && journey.progress >= journey.max - .002) world.jump(0, 'sea');
      else journey.target = clamp(journey.target + delta, Math.max(0, journey.progress - 1.25), Math.min(journey.max, journey.progress + 1.25));
    }
    wake();
  }

  const events = new AbortController(), signal = events.signal;
  addEventListener('wheel', event => {
    if (ui.menuOpen || isNativeTouchControl(event.target) || event.ctrlKey || event.shiftKey) return;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (horizontal && !['sea', 'news'].includes(previousOwner)) return;
    event.preventDefault();
    const px = (horizontal ? event.deltaX : event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    advance(clamp(px, -400, 400) / Math.max(720, innerHeight * .85), 'wheel', event.target);
  }, { passive: false, signal });
  addEventListener('keydown', event => {
    if (ui.menuOpen || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input,textarea,select,[contenteditable]')) return;
    if (event.key === ' ' && event.target.closest?.('button,a')) return;
    const move = { ArrowDown: .15, ArrowUp: -.15, PageDown: .85, PageUp: -.85, ' ': event.shiftKey ? -.85 : .85 };
    if (event.key === 'Home') { event.preventDefault(); chapterFlow.goSection(0); }
    else if (event.key === 'End') { event.preventDefault(); if (leg === 'sky') world.scrollTo(Infinity); else chapterFlow.goSection(4); }
    else if (Object.hasOwn(move, event.key)) { event.preventDefault(); advance(move[event.key], 'key', event.target.closest?.('.fi-rail') ? null : event.target); }
  }, { signal });
  const unmountTouch = mountMobileTouchNavigation({
    blocked: () => !live || ui.menuOpen,
    onDelta: ({ dx, dy, axis, target }) => {
      if (axis === 'y' || ['sea', 'news'].includes(previousOwner)) {
        advance((axis === 'y' ? dy : dx) * 1.9 / Math.max(580, innerHeight * .8), 'touch', target);
      }
    }
  });

  let drag = null;
  clips.element.addEventListener('pointerdown', event => {
    if (previousOwner !== 'news' || event.button !== 0 || event.pointerType === 'touch') return;
    drag = { id: event.pointerId, x: event.clientX };
    clips.element.setPointerCapture(event.pointerId);
  }, { signal });
  clips.element.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    portfolio.seekProgress(cardTarget + (drag.x - event.clientX) / Math.max(900, innerWidth * 2));
    drag.x = event.clientX;
  }, { signal });
  clips.element.addEventListener('lostpointercapture', () => { drag = null; }, { signal });
  addEventListener('click', wake, { capture: true, signal });
  worldRoot.addEventListener('click', event => {
    const stop = event.target.closest('[data-ocean-go], [data-world-go]');
    if (!stop) return;
    event.preventDefault();
    if (stop.hasAttribute('data-ocean-go')) world.scrollTo(seaStart + step * Number(stop.dataset.oceanGo));
    else if (stop.dataset.worldGo === 'latest-news') chapterFlow.goSection(3);
    else {
      const target = world.targetOf(stop.dataset.worldGo);
      if (Number.isFinite(target)) world.scrollTo(target);
    }
  }, { signal });
  addEventListener('resize', () => {
    const previous = leg === 'sea' ? (y - seaStart) / step : leg === 'sky' ? (y - skyStops[0]) / Math.max(1, skyEnd - skyStops[0]) : 0;
    layout();
    if (leg === 'sea') y = targetY = limitY(seaStart + step * previous);
    if (leg === 'sky') y = targetY = limitY(skyStops[0] + previous * (skyEnd - skyStops[0]));
    wake();
  }, { passive: true, signal });
  motion.addEventListener('change', wake, { signal });
  addEventListener('finnovation:text-mode', () => {
    cancelAnimationFrame(raf); live = false; events.abort(); unmountTouch();
    chapterFlow.dispose(); reveal.dispose(); clips.dispose();
  }, { once: true });

  await clips.prepare();
  page.dataset.flow2Recorded = 'active';
  page.dataset.renderMode = 'webgl'; // The existing scene skin and layout use this selector.
  page.toggleAttribute('data-perf-phone', innerWidth <= 760 || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 900));
  live = true;
  if (snapshot?.section === 2) { world.jump(0, 'sea'); y = targetY = limitY(seaStart + (endSea() - seaStart) * clamp(snapshot.sea)); }
  if (snapshot?.section === 3) portfolio.openAt(snapshot.card ?? 0);
  if (snapshot?.section === 4) {
    portfolio.openAt(1); world.jump(0, 'sky');
    y = targetY = limitY(skyStops[0] + (skyEnd - skyStops[0]) * clamp(snapshot.sky));
  }
  paint(performance.now());
  body.classList.add('is-ready');
  body.classList.remove('is-booting');
  document.getElementById('loader')?.classList.add('is-done');
}
