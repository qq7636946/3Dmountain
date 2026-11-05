/* Flow copy direction: one scroll clock, one text owner.
   These factories replace section-motion's factories in the Flow-local
   interface and world modules. They never move a camera or a slide. */
export const clamp01 = value => Math.max(0, Math.min(1, value));
export function motionEase(a, b, value) {
  const t = clamp01((value - a) / Math.max(.00001, b - a));
  return t * t * (3 - 2 * t);
}
export function motionPose(enter, exit, index = 0, reduced = false) {
  const delay = Math.min(index, 5) * .025;
  const a = motionEase(delay, .72 + delay, enter);
  const b = motionEase(delay, .80 + delay, exit);
  return { a, b, alpha: a * (1 - b), y: reduced ? 0 : (1 - a) * 10 - b * 7 };
}

const html = document.documentElement;
const prepared = new WeakMap();
const poses = new WeakMap();
const styles = new WeakMap();
const titleSelector = 'h1,h2,h3,.fiwo-strategy-title,.fiw-statement,.fiw-outro-title';
const children = node => node ? [...node.children].filter(el => !el.matches('script,style')) : [];
function style(node, name, value, priority = '') {
  if (!node) return;
  let previous = styles.get(node);
  if (!previous) { previous = {}; styles.set(node, previous); }
  if (previous[name] === value && node.style.getPropertyValue(name) === value) return;
  previous[name] = value;
  node.style.setProperty(name, value, priority);
}
function prepareTitle(title) {
  const saved = prepared.get(title);
  if (saved && saved.words.every(word => word.isConnected)) return saved;
  if (!title.hasAttribute('aria-label')) title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  const words = [];
  const wrap = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1) {
        if (child.tagName !== 'BR' && !child.classList.contains('flow-copy-word')) wrap(child);
        continue;
      }
      if (child.nodeType !== 3 || !child.textContent.trim()) continue;
      const fragment = document.createDocumentFragment();
      // Keep the original line spans and spaces. Chinese punctuation defines
      // short phrase groups, so neither language is staggered letter by letter.
      for (const token of child.textContent.split(/(\s+|[，。、；：！？])/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) { fragment.append(document.createTextNode(token)); continue; }
        const word = document.createElement('span');
        word.className = 'flow-copy-word'; word.setAttribute('aria-hidden', 'true');
        const ink = document.createElement('span'); ink.className = 'flow-copy-ink'; ink.textContent = token;
        word.append(ink); fragment.append(word); words.push(word);
      }
      child.replaceWith(fragment);
    }
  };
  wrap(title);
  title.classList.add('flow-copy-title');
  const entry = { words, title: true };
  prepared.set(title, entry);
  return entry;
}
function prepare(node) {
  if (node.matches(titleSelector)) return prepareTitle(node);
  let entry = prepared.get(node);
  if (entry) return entry;
  entry = { title: false, headings: [...node.querySelectorAll(titleSelector)].map(prepareTitle) };
  node.classList.add('flow-copy-node');
  if (node.matches('.fi-copy-kicker,.fiwo-kicker,.fiw-kicker,.site-section-eyebrow,.site-card-meta')) node.dataset.copyRole = 'eyebrow';
  else if (node.matches('button,a,.fi-copy-action,.fiwo-pill,.site-card-controls')) node.dataset.copyRole = 'action';
  else node.dataset.copyRole = 'body';
  prepared.set(node, entry);
  return entry;
}
function paintTitle(entry, enter, exit, reduced) {
  const end = Math.max(1, entry.words.length - 1);
  entry.words.forEach((word, index) => {
    const phase = index / end * .15;
    const a = reduced ? (enter > 0 ? 1 : 0) : motionEase(phase, .78 + phase, enter);
    const b = reduced ? (exit >= 1 ? 1 : 0) : motionEase(phase, .80 + phase, exit);
    style(word, '--copy-mask-bottom', ((1 - a) * 118 - 12).toFixed(2) + '%');
    style(word, '--copy-mask-top', (b * 118 - 12).toFixed(2) + '%');
    style(word, '--copy-ink-y', (reduced ? 0 : (1 - a) * .26 - b * .18).toFixed(4) + 'em');
    style(word, '--copy-ink-blur', (reduced ? 0 : ((1 - a) + b) * 1.4).toFixed(2) + 'px');
  });
}
function apply(node, enter, exit, index, reduced) {
  if (!node) return 0;
  const entry = prepare(node);
  const pose = motionPose(enter, exit, index, reduced);
  const key = [enter.toFixed(4), exit.toFixed(4), index, reduced].join('|');
  if (poses.get(node) === key) return pose.alpha;
  poses.set(node, key);
  if (entry.title) {
    paintTitle(entry, enter, exit, reduced);
    style(node, '--copy-title-visible', enter > 0 && exit < 1 ? 'visible' : 'hidden');
  }
  else {
    style(node, '--copy-alpha', (reduced ? (enter > 0 && exit < 1 ? 1 : 0) : pose.alpha).toFixed(4));
    style(node, '--copy-y', pose.y.toFixed(2) + 'px');
    style(node, '--copy-body-blur', (reduced ? 0 : ((1 - pose.a) + pose.b) * .7).toFixed(2) + 'px');
    style(node, '--copy-rule-x', pose.a.toFixed(4));
    entry.headings.forEach(heading => paintTitle(heading, enter, exit, reduced));
  }
  // Only completely clipped text leaves the tab order. The chapter itself
  // remains responsible for aria-hidden and focus during navigation.
  const inert = enter <= 0 || exit >= 1;
  if (node.inert !== inert) node.inert = inert;
  return pose.alpha;
}
function activate() { html.dataset.flowCopyMotion = 'on'; }

export function createNewsCopyMotion({ root, getPortfolio, reducedMotion = false }) {
  activate();
  let news = null, newsNodes = [], newsKey = '';
  function update() {
    const next = root.querySelector('.site-cards-copy');
    if (!next) return;
    if (next !== news) { news = next; newsKey = ''; }
    const portfolio = getPortfolio();
    if (!portfolio) return;
    const transition = clamp01(portfolio.transition ?? 0);
    const enter = clamp01((transition - .42) / .48);
    const progress = clamp01(portfolio.displayStrip ?? portfolio.strip ?? 0);
    const count = Number(news.querySelector('.site-card-count')?.textContent.split('/')[1]) || 7;
    const position = progress * Math.max(1, count - 1);
    const center = Math.round(position), distance = Math.abs(position - center);
    const detailEnter = 1 - motionEase(.18, .49, distance);
    const key = news.querySelector('.site-card-caption')?.textContent || '';
    if (key !== newsKey || !newsNodes.length) {
      newsKey = key;
      newsNodes = [...news.querySelectorAll('.site-section-eyebrow,.site-card-title,.site-card-lead,.site-card-meta,.site-card-caption,.site-card-description,.site-card-status,.site-card-controls')];
      // News is author-owned dynamic text. A changed caption gets one fresh
      // splitter, not a clone or a persistent stale accessible name.
      const caption = news.querySelector('.site-card-caption');
      if (caption) { prepared.delete(caption); poses.delete(caption); caption.removeAttribute('aria-label'); }
    }
    newsNodes.forEach((node, i) => {
      const detail = node.matches('.site-card-meta,.site-card-caption,.site-card-description,.site-card-status');
      apply(node, detail ? Math.min(enter, detailEnter) : enter, 0, detail ? i - 3 : Math.min(i, 2), reducedMotion);
    });
  }
  return { update };
}

export function createJourneyCopyMotion({ root, reducedMotion = false }) {
  activate();
  const panels = [...root.querySelectorAll('.fi-copy-panel')];
  const nodes = panels.map(children);
  panels.forEach(panel => panel.classList.add('flow-copy-panel'));
  return { update(state, thresholds, chapters, business) {
    const ranges = chapters.map((chapter, index) => ({ id: chapter.id, from: thresholds[index] }));
    for (const chapter of business) ranges.push({ id: chapter.id, from: chapter.from + state.shift - .025 });
    ranges.sort((a, b) => a.from - b.from);
    panels.forEach((panel, index) => {
      const order = ranges.findIndex(chapter => chapter.id === panel.dataset.copy);
      if (order < 0) return;
      const start = ranges[order].from, end = ranges[order + 1]?.from ?? state.max + .15;
      const enter = order === 0 ? 1 : clamp01((state.progress - start + .12) / .30);
      // The terminal chapter hands off through seaFlow's existing envelope.
      // At its exact landing it must remain fully resolved and readable.
      const exit = order === ranges.length - 1 ? 0 : clamp01((state.progress - end + .28) / .34);
      const shown = enter > 0 && exit < 1;
      style(panel, 'visibility', shown ? 'visible' : 'hidden');
      style(panel, 'pointer-events', shown && panel.classList.contains('is-active') ? 'auto' : 'none');
      const inert = !shown || !panel.classList.contains('is-active');
      if (panel.inert !== inert) panel.inert = inert;
      if (panel.getAttribute('aria-hidden') !== String(inert)) panel.setAttribute('aria-hidden', String(inert));
      if (nodes[index].length !== panel.children.length) nodes[index] = children(panel);
      nodes[index].forEach((node, row) => apply(node, enter, exit, row, reducedMotion));
    });
  } };
}

export function createWorldSectionMotion({ root, reducedMotion = false }) {
  activate();
  const responsibility = root.querySelector('[data-world-part="responsibility"]');
  const pin = responsibility?.querySelector('.fiwo-pin');
  const progress = pin?.querySelector('.fiwo-progress');
  const slides = [...root.querySelectorAll('.fiwo-panel')].map(panel => ({
    panel, copy: children(panel.querySelector('.fiwo-strategy-copy')),
    // Photography keeps its existing WebGL/photo-inertia controller.
    meta: panel.querySelector('.fiwo-strategy-meta')
  }));
  const flow = [...root.querySelectorAll('.fiw-global > *, .fiw-footer > :not(.fiw-sr)')];
  let height = innerHeight, metrics = null, rows = [], lastPin = '';
  function measure(width, h, top, measured) {
    height = h;
    const footer = root.querySelector('.fiw-footer');
    metrics = { ...measured, footerTop: footer ? top(footer) : Infinity,
      footerEnd: footer ? top(footer) + footer.offsetHeight - h : Infinity,
      respTop: responsibility ? top(responsibility) : 0, respH: responsibility?.offsetHeight || 0 };
    // Remove the previous optical translate from measured coordinates.
    // These are the only text geometry reads in the engine.
    rows = flow.map(node => ({ node, top: top(node) - parseFloat(node.style.getPropertyValue('--copy-y') || 0), height: node.offsetHeight }));
  }
  function paint(sample, y) {
    if (!metrics) return;
    root.classList.toggle('is-footer-reading', y >= metrics.footerTop - 1);
    const ocean = sample.o, stops = metrics.ocean?.stops;
    if (ocean && stops?.length) {
      const last = stops[slides.length - 1];
      const out = clamp01((y - last - height * .06) / (height * .72));
      root.classList.toggle('has-section-motion', y > metrics.respTop - height * .25);
      const nextPin = 'translate3d(0,' + Math.max(0, y - (metrics.respTop + metrics.respH - height)).toFixed(1) + 'px,0)';
      if (pin && nextPin !== lastPin) { pin.style.transform = nextPin; lastPin = nextPin; }
      if (pin) { style(pin, 'opacity', '1'); style(pin, 'visibility', out >= 1 ? 'hidden' : 'visible'); }
      if (responsibility && responsibility.inert !== (out > .96)) responsibility.inert = out > .96;
      if (progress) apply(progress, ocean.panel0, out, 0, reducedMotion);
      slides.forEach(({ panel, copy, meta }, index) => {
        // Middle cards enter and leave through physical horizontal travel.
        // No broad fade, mask or scale can erase a neighbouring visible card.
        const enter = index === 0 ? ocean.panel0 : 1;
        const exit = index === slides.length - 1 ? out : 0;
        copy.forEach((node, row) => apply(node, enter, exit, row, reducedMotion));
        if (meta) apply(meta, enter, exit, 4, reducedMotion);
        if (index === slides.length - 1) {
          const inert = out > .96 || Math.abs(ocean.h - index) > 1;
          if (panel.inert !== inert) panel.inert = inert;
        }
      });
    }
    rows.forEach(({ node, top, height: nodeHeight }, index) => {
      const screen = top - y;
      const enter = clamp01((height * .94 - screen) / (height * .24));
      const exit = 1 - clamp01((screen + nodeHeight - 108) / (height * .18));
      const settledFooter = node.parentElement?.classList.contains('fiw-footer') && y >= metrics.footerEnd - 2;
      apply(node, settledFooter ? 1 : enter, settledFooter ? 0 : exit, index % 3, reducedMotion);
    });
  }
  function close() {
    root.classList.remove('has-section-motion', 'is-footer-reading');
    if (pin) { pin.style.transform = ''; pin.style.visibility = ''; styles.delete(pin); }
    lastPin = '';
  }
  return { measure, paint, close };
}
