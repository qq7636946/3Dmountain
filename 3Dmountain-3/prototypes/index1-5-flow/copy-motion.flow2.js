/* Flow copy direction: one scroll clock, one text owner.
   These factories replace section-motion's factories in the Flow-local
   interface and world modules. They never move a camera or a slide. */
import { FLOW_MOTION as M } from './motion-tokens.js?v=flow-unified-9c1fe0c6850f';
export const clamp01 = value => Math.max(0, Math.min(1, value));
export function motionEase(a, b, value) {
  const t = clamp01((value - a) / Math.max(.00001, b - a));
  return t * t * (3 - 2 * t);
}
export function motionPose(enter, exit, index = 0, reduced = false) {
  const delay = Math.min(index, 5) * M.rowStagger;
  const a = motionEase(delay, .72 + delay, enter);
  const b = motionEase(delay, .80 + delay, exit);
  return { a, b, alpha: a * (1 - b), y: reduced ? 0 : (1 - a) * M.bodyRise - b * M.bodyExit };
}

// A reversible focus wave, inspired by the supplied FiabaMia reference.
// The scene's scroll clock is unchanged. Every glyph returns to its exact
// original baseline, scale and zero blur while its title is being read.
export function titleFocusPose(enter, exit, index = 0, total = 1, reduced = false) {
  const phase = index / Math.max(1, total - 1) * M.wordStagger;
  const a = reduced ? (enter > 0 ? 1 : 0) : motionEase(phase, .72 + phase, enter);
  const b = reduced ? (exit >= 1 ? 1 : 0) : motionEase(phase, .76 + phase, exit);
  const soft = reduced ? 0 : Math.max(1 - a, b);
  const seed = Math.sin((index + 1) * 12.9898);
  return {
    a, b, alpha: a * (1 - b),
    x: seed * soft * M.titleScatter,
    y: reduced ? 0 : (1 - a) * M.titleRise - b * M.titleExit,
    scale: soft * M.titleScale,
    blur: soft * M.titleBlur,
    rotate: seed * soft * M.titleRotate
  };
}

// Flow2 stages supporting UI around the headline on the same scroll clock.
const EDITORIAL_ROWS = {
  eyebrow: { inStart: 0, inEnd: .52, outStart: .34, outEnd: .96, travel: 8 },
  body: { inStart: .18, inEnd: .76, outStart: .12, outEnd: .69, travel: 12 },
  action: { inStart: .30, inEnd: .92, outStart: 0, outEnd: .55, travel: 13 }
};

function editorialRowPose(enter, exit, role, index, reduced) {
  const { inStart, inEnd, outStart, outEnd, travel } = EDITORIAL_ROWS[role] || EDITORIAL_ROWS.body;
  const delay = Math.min(Math.max(index - 1, 0), 3) * .018;
  const a = motionEase(inStart + delay, inEnd + delay, enter);
  const b = motionEase(outStart, outEnd, exit);
  return { a, alpha: a * (1 - b), y: reduced ? 0 : (1 - a) * travel - b * travel * .6 };
}

function editorialTitlePose(enter, exit, index, total, reduced) {
  if (reduced) return { alpha: enter > 0 && exit < 1 ? 1 : 0, y: 0 };
  const phase = index / Math.max(1, total - 1);
  const a = motionEase(.035 + phase * .16, .65 + phase * .16, enter);
  const b = motionEase(.17 + (1 - phase) * .13, .71 + (1 - phase) * .13, exit);
  return { alpha: a * (1 - b), y: (1 - a) * .82 - b * .63 };
}

const html = document.documentElement;
const editorialMotion = html.hasAttribute('data-flow2-editorial-motion');
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
  const words = [], inks = [];
  const wrap = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1) {
        if (child.tagName !== 'BR' && !child.classList.contains('flow-copy-word')) wrap(child);
        continue;
      }
      if (child.nodeType !== 3 || !child.textContent.trim()) continue;
      const fragment = document.createDocumentFragment();
      // Keep the original line breaks and word boundaries. Flow2 moves each
      // word as one unit to preserve its spacing and reduce animated spans.
      for (const token of child.textContent.split(/(\s+|[，。、；：！？])/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) { fragment.append(document.createTextNode(token)); continue; }
        const word = document.createElement('span');
        word.className = 'flow-copy-word'; word.setAttribute('aria-hidden', 'true');
        for (const glyph of editorialMotion ? [token] : token) {
          const ink = document.createElement('span'); ink.className = 'flow-copy-ink'; ink.textContent = glyph;
          word.append(ink); inks.push(ink);
        }
        fragment.append(word); words.push(word);
      }
      child.replaceWith(fragment);
    }
  };
  wrap(title);
  title.classList.add('flow-copy-title');
  const entry = { node: title, words, inks, title: true };
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
  else if (node.matches('button,a,.fi-copy-action,.fiwo-pill,.fiwo-progress,.site-card-controls')) node.dataset.copyRole = 'action';
  else node.dataset.copyRole = 'body';
  prepared.set(node, entry);
  return entry;
}
function paintTitle(entry, enter, exit, reduced) {
  if (editorialMotion) {
    const clipping = !reduced && ((enter > 0 && enter < .81) || (exit > .17 && exit < 1));
    style(entry.node, '--copy-word-clip', clipping ? 'inset(-.12em -.08em -.12em)' : 'none');
  }
  const getPose = editorialMotion ? editorialTitlePose : titleFocusPose;
  entry.inks.forEach((ink, index) => {
    const pose = getPose(enter, exit, index, entry.inks.length, reduced);
    style(ink, '--copy-ink-alpha', pose.alpha.toFixed(4));
    style(ink, '--copy-ink-y', pose.y.toFixed(4) + 'em');
    if (!editorialMotion) {
      style(ink, '--copy-ink-x', pose.x.toFixed(4) + 'em');
      style(ink, '--copy-ink-scale', pose.scale.toFixed(4));
      style(ink, '--copy-ink-rotate', pose.rotate.toFixed(3) + 'deg');
      style(ink, '--copy-ink-blur', pose.blur.toFixed(2) + 'px');
    }
    // Release compositor hints at rest, including all hidden chapters.
    const moving = pose.alpha > .001 && pose.alpha < .999 && !reduced;
    style(ink, 'will-change', moving ? (editorialMotion ? 'transform,opacity' : 'transform,opacity,filter') : 'auto');
  });
}
function apply(node, enter, exit, index, reduced) {
  if (!node) return 0;
  const entry = prepare(node);
  const pose = editorialMotion
    ? editorialRowPose(enter, exit, node.dataset.copyRole, index, reduced)
    : motionPose(enter, exit, index, reduced);
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
    if (!editorialMotion) style(node, '--copy-body-blur', (reduced ? 0 : ((1 - pose.a) + pose.b) * M.bodyBlur).toFixed(2) + 'px');
    style(node, '--copy-rule-x', pose.a.toFixed(4));
    entry.headings.forEach(heading => paintTitle(heading, enter, exit, reduced));
  }
  // Only completely clipped text leaves the tab order. The chapter itself
  // remains responsible for aria-hidden and focus during navigation.
  const waitingForAction = editorialMotion && !reduced && node.dataset.copyRole === 'action' && pose.alpha < .005;
  const inert = enter <= 0 || exit >= 1 || waitingForAction;
  if (node.inert !== inert) node.inert = inert;
  return pose.alpha;
}
function activate() { html.dataset.flowCopyMotion = 'on'; }

export function createNewsCopyMotion({ root, getPortfolio, reducedMotion = false }) {
  activate();
  let news = null, newsNodes = [], newsKey = '', meta = null, caption = null, active = false;
  function update() {
    const portfolio = getPortfolio();
    if (!portfolio) return;
    const transition = clamp01(portfolio.transition ?? 0);
    if (!portfolio.open && transition <= .0001) {
      // Clear descendants once: their explicit visibility must not escape the
      // portfolio owner's hidden panel after returning to ocean or journey.
      if (active) newsNodes.forEach((node, i) => apply(node, 0, 0, i, reducedMotion));
      active = false; return;
    }
    active = true;
    if (!news?.isConnected) {
      news = root.querySelector('.site-cards-copy');
      if (!news) return;
      newsKey = '';
      newsNodes = [...news.querySelectorAll('.site-section-eyebrow,.site-card-title,.site-card-lead,.site-card-meta,.site-card-caption,.site-card-description,.site-card-status,.site-card-controls')];
      meta = news.querySelector('.site-card-meta'); caption = news.querySelector('.site-card-caption');
    }
    // setExit() hides the original portfolio panel during the globe. Respect
    // that owner as well as its bridge amount so child titles cannot leak out.
    const enter = news.style.visibility === 'hidden' ? 0 : clamp01((transition - .42) / .48);
    // At full bridge amount the portfolio's own opacity tracks the handoff to the globe.
    const exit = editorialMotion && transition >= .92 ? 1 - Number(news.style.opacity || 1) : 0;
    const key = meta?.textContent || caption?.textContent || '';
    if (key !== newsKey) {
      newsKey = key;
      // News is author-owned dynamic text. A changed caption gets one fresh
      // splitter, not a clone or a persistent stale accessible name.
      if (caption) { prepared.delete(caption); poses.delete(caption); caption.removeAttribute('aria-label'); }
    }
    newsNodes.forEach((node, i) => {
      const detail = node.matches('.site-card-meta,.site-card-caption,.site-card-description,.site-card-status');
      // This is a free-scrolling strip, with no snap to image centres. Its
      // nearest article may change at any fraction, but must remain readable
      // when the visitor stops there. Only the gallery's own entry/exit hides it.
      apply(node, enter, exit, detail ? i - 3 : Math.min(i, 2), reducedMotion);
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
  const heading = pin?.querySelector('.flow-why-heading');
  const slides = [...root.querySelectorAll('.fiwo-panel')].map(panel => ({
    panel, copy: children(panel.querySelector('.fiwo-strategy-copy')),
    // Photography keeps its existing WebGL/photo-inertia controller.
    meta: panel.querySelector('.fiwo-strategy-meta'), visual: panel.querySelector('.fiwo-strategy-visual'), photo: panel.querySelector('.fiwo-photo')
  }));
  const flow = [...root.querySelectorAll('.fiw-global > *, .fiw-footer > :not(.fiw-sr), .fiwp-chapter > :not(.fiwp-columns), .fiwp-columns > div:first-child > *, .fiwp-card')];
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
    if (root.classList.contains('is-sea-leg') && ocean && stops?.length) {
      const last = stops[slides.length - 1];
      const out = clamp01((y - last - height * .06) / (height * .72));
      root.classList.toggle('has-section-motion', y > metrics.respTop - height * .25);
      const nextPin = 'translate3d(0,' + Math.max(0, y - (metrics.respTop + metrics.respH - height)).toFixed(1) + 'px,0)';
      if (pin && nextPin !== lastPin) { pin.style.transform = nextPin; lastPin = nextPin; }
      if (pin) { style(pin, 'opacity', '1'); style(pin, 'visibility', out >= 1 ? 'hidden' : 'visible'); }
      if (responsibility && responsibility.inert !== (out > .96)) responsibility.inert = out > .96;
      if (responsibility?.getAttribute('aria-hidden') !== 'false') responsibility?.setAttribute('aria-hidden', 'false');
      if (progress) apply(progress, ocean.panel0, out, 0, reducedMotion);
      if (heading) apply(heading, ocean.panel0, out, 0, reducedMotion);
      slides.forEach(({ panel, copy, meta, visual, photo }, index) => {
        // Middle cards enter and leave through physical horizontal travel.
        // No broad fade, mask or scale can erase a neighbouring visible card.
        const enter = index === 0 ? ocean.panel0 : 1;
        const exit = index === slides.length - 1 ? out : 0;
        // The photo and caption follow the same reversible bridge as the copy.
        // They cannot linger over the valley until the world root closes.
        if (visual) {
          const alpha = clamp01(enter) * (1 - clamp01(exit));
          style(visual, 'opacity', alpha.toFixed(3));
          style(visual, 'visibility', alpha > .001 ? 'visible' : 'hidden');
          style(photo, '--motion-opacity', alpha.toFixed(3));
        }
        copy.forEach((node, row) => {
          if (editorialMotion) {
            apply(node, enter, exit, row, reducedMotion);
            return;
          }
          const title = node.matches(titleSelector);
          const focusIn = title && index > 0 ? clamp01((1.12 - (index - ocean.h)) / .48) : enter;
          const focusOut = title ? Math.max(exit, clamp01((ocean.h - index - .50) / .56)) : exit;
          apply(node, focusIn, focusOut, row, reducedMotion);
        });
        if (meta) apply(meta, enter, exit, 4, reducedMotion);
        if (index === slides.length - 1) {
          const inert = out > .96 || Math.abs(ocean.h - index) > 1;
          if (panel.inert !== inert) panel.inert = inert;
        }
      });
    } else if (responsibility) {
      responsibility.inert = true;
      if (responsibility.getAttribute('aria-hidden') !== 'true') responsibility.setAttribute('aria-hidden', 'true');
      if (pin) style(pin, 'visibility', 'hidden');
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
