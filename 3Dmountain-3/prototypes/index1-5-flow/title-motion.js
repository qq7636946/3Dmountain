/* FLOW water titles: the scene's scroll clock owns every frame.
   No duration, autoplay, queued transition or title translation.
   Two blurred text masks merge through the CodePen alpha-threshold technique. */
(() => {
  const html = document.documentElement;
  if (window.__FLOW_TITLE_MOTION__?.effect === 'water-scroll-v7') return;
  window.__FLOW_TITLE_MOTION__?.dispose();

  const selector = '.fi-copy-panel > h1, .fi-copy-panel > h2, .fi-portfolio-copy > h2, .fiwp-title, .fisl-title, .fiw-outro-title, .fiw-statement';
  const nativeSelector = '.fiwo-strategy-title';
  const legacy = '.cl-ch, .flow-title-char, .flow-title-word, .fiwo-ch, .char, .fiw-line-mask';
  const sources = new Set(), journeyTitles = new Map(), observers = [], slots = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const world = document.getElementById('fiWorld'), viewport = world?.querySelector('.fiw-viewport');
  const clamp = value => Math.max(0, Math.min(1, value));
  const kind = title => title.closest('.fi-portfolio-copy') ? 'portfolio'
    : title.closest('.fi-copy-panel') ? 'journey' : 'document';
  const label = title => title.getAttribute('aria-label') || title.textContent.trim();
  const held = () => /^(hold|ready|finishing|enter)$/.test(html.dataset.gate || '');
  const textMode = () => html.dataset.renderMode === 'text';
  const PAD = 48;
  let models = new WeakMap(), stage = null, svg = null, activePair = null;
  let journeyState = null, worldState = null, syncFrame = 0, started = false, disposed = false;
  let lastPose = '', lastLayout = '', lastProgress = null;

  function prepare() {
    // The four horizontal cards keep their own headings inside each card.
    // Also remove wrappers left by a previous title controller on hot replacement.
    document.querySelectorAll(nativeSelector).forEach(title => {
      [...title.querySelectorAll(legacy)].reverse().forEach(node => node.replaceWith(...node.childNodes));
      title.normalize();
      for (const attr of ['data-flow-morph-source', 'data-flow-title', 'data-flow-title-direction'])
        if (title.hasAttribute(attr)) title.removeAttribute(attr);
      if (title.classList.contains('flow-title-on')) title.classList.remove('flow-title-on');
    });
    document.querySelectorAll(selector).forEach(title => {
      if (!title.textContent.trim() || sources.has(title)) return;
      if (html.dataset.siteSections === 'five' && title.closest('.fiw-footer')) return;
      [...title.querySelectorAll(legacy)].reverse().forEach(node => node.replaceWith(...node.childNodes));
      title.normalize();
      if (!title.hasAttribute('aria-label')) title.setAttribute('aria-label',
        [...title.childNodes].map(node => node.textContent).join(' ').replace(/\s+/g, ' ').trim());
      title.dataset.flowTitle = 'ready';
      title.setAttribute('data-flow-morph-source', '');
      title.classList.remove('flow-title-on');
      title.removeAttribute('data-flow-morph-hidden');
      sources.add(title);
      const panel = title.closest('.fi-copy-panel');
      if (panel) {
        journeyTitles.set(panel.dataset.copy, title);
        const kicker = panel.querySelector('.fi-copy-kicker');
        const number = panel.classList.contains('fi-portfolio-copy') ? 8
          : ({ knowledge: 1, innovation: 2, convergence: 3, value: 4, perspective: 5, strategies: 6, ai: 6, public: 6, private: 6, derivatives: 6 })[panel.dataset.copy];
        if (kicker && number) kicker.dataset.clNum = String(number).padStart(2, '0') + ' / 11';
      }
    });
    for (const title of sources) if (!title.isConnected) {
      sources.delete(title);
      for (const [id, node] of journeyTitles) if (node === title) journeyTitles.delete(id);
    }
  }

  function ensureStage() {
    if (stage) return;
    const ns = 'http://www.w3.org/2000/svg';
    svg = document.createElementNS(ns, 'svg');
    svg.classList.add('flow-morph-filters');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const defs = document.createElementNS(ns, 'defs'), filter = document.createElementNS(ns, 'filter');
    filter.id = 'flow-title-morph-threshold';
    filter.setAttribute('x', '-35%'); filter.setAttribute('y', '-100%');
    filter.setAttribute('width', '170%'); filter.setAttribute('height', '300%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const matrix = document.createElementNS(ns, 'feColorMatrix');
    matrix.setAttribute('type', 'matrix');
    // Lower cutoff and a wider ink mask keep the stronger melt connected.
    matrix.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -96');
    filter.append(matrix); defs.append(filter); svg.append(defs);
    stage = document.createElement('div');
    stage.className = 'flow-title-morph'; stage.hidden = true;
    stage.setAttribute('aria-hidden', 'true'); stage.inert = true;
    document.body.append(svg, stage);
  }

  function rectOf(title) {
    const box = title.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height, bottom: box.bottom };
  }

  const typography = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch',
    'font-kerning', 'font-feature-settings', 'font-variation-settings', 'line-height',
    'letter-spacing', 'word-spacing', 'text-align', 'text-transform', 'text-indent',
    'white-space', 'word-break', 'overflow-wrap', 'text-wrap', 'box-sizing',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left'];
  function capture(title) {
    if (!title?.isConnected || title.matches(nativeSelector)) return null;
    if (models.has(title)) return models.get(title);
    const rect = rectOf(title);
    if (rect.width < 1 || rect.height < 1) return null;
    const clone = title.cloneNode(true), originals = [title, ...title.querySelectorAll('*')];
    [clone, ...clone.querySelectorAll('*')].forEach((node, index) => {
      const style = getComputedStyle(originals[index]);
      [...node.attributes].forEach(attr => node.removeAttribute(attr.name));
      typography.forEach(name => node.style.setProperty(name, style.getPropertyValue(name)));
      Object.assign(node.style, { display: index ? style.display : 'block', position: 'static',
        margin: '0', opacity: '1', visibility: 'visible', transform: 'none', translate: 'none',
        rotate: 'none', scale: 'none', filter: 'none', clipPath: 'none', overflow: 'visible',
        transition: 'none', animation: 'none', background: 'none', color: '#fff',
        webkitTextFillColor: '#fff', textShadow: style.textShadow });
    });
    const width = Math.min(rect.width, innerWidth - 32);
    Object.assign(clone.style, { width: width + 'px', height: 'auto', maxWidth: 'none' });
    const group = kind(title);
    if (group === 'journey' || group === 'document' || group === 'portfolio') clone.style.textAlign = 'center';
    const layer = document.createElement('div'); layer.className = 'flow-morph-layer';
    layer.append(clone);
    const model = { title, rect, layer, width, height: rect.height, kind: group,
      fontSize: parseFloat(getComputedStyle(title).fontSize) || 48 };
    models.set(title, model);
    return model;
  }

  function slotFor(model) {
    if (slots.has(model.kind)) return slots.get(model.kind);
    const group = [...sources].filter(title => kind(title) === model.kind).map(capture).filter(Boolean);
    const width = Math.max(model.width, ...group.map(item => item.width));
    const height = Math.max(model.height, ...group.map(item => item.height));
    const reference = model.kind === 'journey' ? document.querySelector('#chapter-knowledge > h1') || model.title : model.title;
    const box = rectOf(reference), centered = true;
    // The slot is measured once, including every title in the section.
    // It never resizes, follows a moving parent, or re-centers at morph completion.
    const slot = { left: centered ? (innerWidth - width) / 2 - PAD : box.left - PAD,
      top: (model.kind === 'document' ? innerHeight * .36 : box.top) - PAD,
      width: width + PAD * 2, height: height + PAD * 2, centered };
    slots.set(model.kind, slot);
    return slot;
  }

  function layout(pair) {
    const slot = slotFor(pair.to), key = pair.to.kind;
    if (lastLayout !== key) {
      Object.assign(stage.style, { left: slot.left + 'px', top: slot.top + 'px',
        width: slot.width + 'px', height: slot.height + 'px' });
      lastLayout = key;
    }
    for (const model of new Set([pair.from, pair.to])) Object.assign(model.layer.style, {
      left: (slot.centered ? (slot.width - model.width) / 2 : PAD) + 'px', top: PAD + 'px'
    });
  }

  function render(fromTitle, toTitle = fromTitle, fraction = 0) {
    const from = capture(fromTitle), to = capture(toTitle);
    if (!from || !to) return;
    ensureStage();
    let progress = clamp(fraction);
    if (reduced.matches) progress = progress < .5 ? 0 : 1;
    const morphing = from !== to && progress > 0 && progress < 1;
    const key = label(from.title) + '|' + label(to.title) + '|' + progress.toFixed(6) + '|' + to.kind;
    stage.hidden = false;
    if (key === lastPose) return;
    const samePair = activePair?.from === from && activePair?.to === to;
    if (!samePair) { activePair = { from, to }; lastProgress = null; }
    if (lastProgress !== null && progress !== lastProgress)
      stage.dataset.direction = progress > lastProgress ? 'forward' : 'reverse';
    lastProgress = progress; lastPose = key;
    layout(activePair);
    stage.dataset.state = morphing ? 'morph' : 'rest';
    stage.dataset.progress = progress.toFixed(6);
    stage.dataset.from = label(from.title); stage.dataset.to = label(to.title);
    stage.dataset.title = label((progress < .5 ? from : to).title);
    if (morphing) {
      const children = [...stage.children];
      if (children.length !== 2 || children[0] !== from.layer || children[1] !== to.layer)
        stage.replaceChildren(from.layer, to.layer);
      const wave = Math.sin(Math.PI * progress), size = Math.max(from.fontSize, to.fontSize);
      const blur = Math.max(3.2, Math.min(7, size * .075));
      stage.style.setProperty('--flow-ink', (wave * Math.min(1.4, size * .0125)).toFixed(3) + 'px');
      stage.style.setProperty('--flow-soften', (wave * .55).toFixed(3) + 'px');
      const pose = (model, weight) => {
        model.layer.style.opacity = Math.pow(weight, .4).toFixed(6);
        model.layer.style.filter = 'blur(' + Math.min(80, blur * (1 / Math.max(.001, weight) - 1)).toFixed(4) + 'px)';
      };
      pose(from, 1 - progress); pose(to, progress);
      html.dataset.flowMorphActive = 'true';
    } else {
      const model = progress >= 1 ? to : from;
      if (stage.children.length !== 1 || stage.firstElementChild !== model.layer) stage.replaceChildren(model.layer);
      model.layer.style.opacity = '1'; model.layer.style.filter = 'none';
      stage.style.setProperty('--flow-ink', '0px'); stage.style.setProperty('--flow-soften', '0px');
      delete html.dataset.flowMorphActive;
    }
  }

  // Each boundary has one fixed interval. Reading the same scroll position,
  // from either direction, produces exactly the same pair and mask weights.
  function journeyPair() {
    if (!journeyState) return null;
    const rows = journeyState.ranges.map(row => ({ ...row, title: journeyTitles.get(row.id) }))
      .filter(row => row.title?.isConnected);
    if (!rows.length) return null;
    const p = journeyState.progress;
    for (let i = 1; i < rows.length; i++) {
      const half = Math.min(.38, (rows[i].from - rows[i - 1].from) * .45,
        i + 1 < rows.length ? (rows[i + 1].from - rows[i].from) * .45 : .38);
      if (p < rows[i].from - half) return [rows[i - 1].title];
      if (p <= rows[i].from + half)
        return [rows[i - 1].title, rows[i].title, clamp((p - rows[i].from + half) / (2 * half))];
    }
    return [rows[rows.length - 1].title];
  }

  function documentPair() {
    const rows = [...world.querySelectorAll(selector)].filter(title => kind(title) === 'document'
      && !(html.dataset.siteSections === 'five' && title.closest('.fiw-footer')))
      .map(title => ({ title, box: rectOf(title) })).filter(row => row.box.width > 0);
    const H = innerHeight;
    for (let i = 1; i < rows.length; i++) {
      const previous = rows[i - 1], next = rows[i];
      if (next.box.top < H * .82 && next.box.top > H * .28 && previous.box.bottom > -H * .55)
        return [previous.title, next.title, clamp((H * .82 - next.box.top) / (H * .54))];
    }
    const visible = rows.filter(row => row.box.top < H * .82 && row.box.bottom > H * .12);
    visible.sort((a, b) => Math.abs(a.box.top - H * .36) - Math.abs(b.box.top - H * .36));
    return visible[0] ? [visible[0].title] : null;
  }

  function hideStage() {
    if (stage && !stage.hidden) stage.hidden = true;
    delete html.dataset.flowMorphActive;
    lastPose = '';
  }

  function sync() {
    syncFrame = 0;
    if (!started || disposed) return;
    if (held() || textMode()) { hideStage(); return; }
    // The two editorial card chapters own their nested DOM headings. Never
    // leave the last journey-title clone floating behind their WebGL strip.
    if (html.dataset.siteSections === 'five' && document.body.classList.contains('is-portfolio') && !world?.classList.contains('is-open')) {
      if (stage) stage.hidden = true;
      delete html.dataset.flowMorphActive;
      return;
    }
    const portfolio = document.querySelector('.fi-portfolio-copy > h2');
    let pair;
    if (document.body.classList.contains('is-portfolio') && portfolio) pair = [portfolio];
    else if (world?.classList.contains('is-open')) {
      if (html.dataset.siteSections === 'five') pair = documentPair();
      else if (!world.classList.contains('is-sky-leg') &&
        (worldState?.state.o?.active || world.classList.contains('is-ocean') || world.querySelector('.fiwo-panel.is-active')))
        { hideStage(); return; }
      else if (world.classList.contains('is-sky-leg') || world.classList.contains('is-live')) pair = documentPair();
      else pair = journeyPair();
    } else pair = journeyPair();
    if (!pair && !journeyState) {
      const title = document.querySelector('.fi-copy-panel.is-active > h1, .fi-copy-panel.is-active > h2');
      if (title) pair = [title];
    }
    if (pair) render(...pair);
    else hideStage(); // Authored cloud-only passages keep their empty space.
  }
  function schedule() { if (!disposed && !syncFrame) syncFrame = requestAnimationFrame(sync); }
  function refresh() {
    models = new WeakMap(); slots.clear(); activePair = null;
    lastPose = ''; lastLayout = ''; lastProgress = null; schedule();
  }
  function observe(records) {
    let discover = false, changed = false;
    for (const record of records) {
      if (record.target.nodeType === 1 && record.target.closest('.flow-title-morph, .flow-morph-filters')) continue;
      if (record.type === 'attributes') changed = true;
      else if ([...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1
        && (node.matches(selector + ', ' + nativeSelector + ', ' + legacy) || node.querySelector(selector + ', ' + nativeSelector)))) discover = true;
    }
    if (discover) prepare();
    if (discover || changed) schedule();
  }
  function start() {
    if (disposed) return;
    started = true; html.dataset.flowTitles = 'on'; html.dataset.flowTitleEffect = 'water';
    prepare();
    const bodyObserver = new MutationObserver(observe);
    bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'inert', 'hidden', 'aria-hidden', 'aria-current'] });
    const htmlObserver = new MutationObserver(schedule);
    htmlObserver.observe(html, { attributes: true, attributeFilter: ['data-gate', 'data-render-mode'] });
    observers.push(bodyObserver, htmlObserver);
    viewport?.addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', refresh, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    reduced.addEventListener('change', schedule);
    document.fonts?.ready.then(refresh);
    sync();
  }

  window.__FLOW_TITLE_MOTION__ = {
    effect: 'water-scroll-v7',
    setJourney(state, ranges) {
      if (!Number.isFinite(state.progress)) return;
      journeyState = { progress: state.progress, ranges };
      sync();
    },
    setWorld(state, y, metrics) { worldState = { state, y, metrics }; sync(); },
    dispose() {
      disposed = true; cancelAnimationFrame(syncFrame); observers.forEach(observer => observer.disconnect());
      viewport?.removeEventListener('scroll', schedule); removeEventListener('resize', refresh);
      document.removeEventListener('visibilitychange', schedule); reduced.removeEventListener('change', schedule);
      sources.forEach(title => title.removeAttribute('data-flow-morph-source'));
      stage?.remove(); svg?.remove();
      delete html.dataset.flowTitles; delete html.dataset.flowTitleEffect; delete html.dataset.flowMorphActive;
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
