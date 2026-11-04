/* FLOW title direction · 2026-11-04.
   Child letters only: section-motion continues to own the heading's opacity,
   translation and scroll envelope. No animation loop or idle timer. */
(() => {
  const html = document.documentElement;
  if (html.dataset.flowTitles === 'on') return;
  const selector = '.fi-copy-panel > h1, .fi-copy-panel > h2, .fi-portfolio-copy > h2, .fiwo-strategy-title, .fiwp-title, .fisl-title, .fiw-outro-title, .fiw-statement';
  const entries = new Map(), intersections = new WeakMap(), observers = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let destroyed = false, lastChapter = -1, lastTitleOrder = -1, direction = 1, scrollY = 0;
  const world = document.getElementById('fiWorld');
  const viewport = world?.querySelector('.fiw-viewport');
  const held = () => /^(hold|ready|finishing|enter)$/.test(html.dataset.gate || '');
  const disabled = () => reduced.matches || html.dataset.renderMode === 'text';

  /* Existing copy letters retain their accessibility labels and transitions.
     Group whole words so a narrow phone never breaks DISCIPLINE mid-word. */
  function groupLetters(node) {
    let word = null;
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1 && child.classList.contains('cl-ch')) {
        if (/^\s+$/.test(child.textContent)) {
          child.replaceWith(document.createTextNode(child.textContent)); word = null;
        } else {
          if (!word) { word = document.createElement('span'); word.className = 'flow-title-word'; node.insertBefore(word, child); }
          child.classList.add('flow-title-char'); word.appendChild(child);
        }
      } else { word = null; if (child.nodeType === 1) groupLetters(child); }
    }
  }
  function wrapWorld(node, byWord) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1) { if (child.tagName !== 'BR') wrapWorld(child, byWord); continue; }
      if (child.nodeType !== 3 || !child.textContent.trim()) continue;
      const fragment = document.createDocumentFragment();
      for (const token of child.textContent.split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) { fragment.appendChild(document.createTextNode(token)); continue; }
        const word = document.createElement('span'); word.className = 'flow-title-word';
        if (byWord) { word.classList.add('flow-title-char'); word.textContent = token; word.setAttribute('aria-hidden', 'true'); }
        else for (const letter of token) {
          const ch = document.createElement('span'); ch.className = 'flow-title-char'; ch.textContent = letter; ch.setAttribute('aria-hidden', 'true'); word.appendChild(ch);
        }
        fragment.appendChild(word);
      }
      child.replaceWith(fragment);
    }
  }
  function observe(el, attributes) {
    if (!el) return;
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: attributes }); observers.push(observer);
  }
  function prepare(title) {
    if (entries.has(title) || title.dataset.flowTitle === 'ready') return;
    const panel = title.closest('.fi-copy-panel, .fi-portfolio-copy');
    /* copy-layout wraps later on some initial loads. Its childList callback
       below retries once those letters exist; never split its letters twice. */
    if (panel && html.dataset.copyLayout && !title.querySelector('.cl-ch')) return;
    if (!panel && title.querySelector('.fiw-line-mask, .char')) return; // GSAP fallback owns this title.
    if (!title.hasAttribute('aria-label')) title.setAttribute('aria-label', [...title.childNodes].map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim());
    title.dataset.flowTitle = 'ready';
    if (panel && title.querySelector('.cl-ch')) groupLetters(title);
    else wrapWorld(title, title.matches('.fiw-statement'));
    const letters = [...title.querySelectorAll('.flow-title-char')];
    letters.forEach((ch, i) => {
      const phase = i / Math.max(1, letters.length - 1);
      ch.style.setProperty('--ft-delay-forward', (phase * 280).toFixed(1) + 'ms');
      ch.style.setProperty('--ft-delay-backward', ((1 - phase) * 280).toFixed(1) + 'ms');
    });
    const order = panel ? (panel.classList.contains('fi-portfolio-copy') ? 7 : [...document.querySelectorAll('.fi-copy-panel')].indexOf(panel))
      : title.matches('.fiwo-strategy-title') ? 6 + [...document.querySelectorAll('.fiwo-strategy-title')].indexOf(title) / 10
      : title.matches('.fiw-statement') ? 8
      : title.matches('.fiwp-title') ? 9 + [...document.querySelectorAll('.fiwp-title')].indexOf(title) / 10
      : title.matches('.fisl-title') ? 10 : 11;
    entries.set(title, { panel, order, shown: false });
    if (panel) observe(panel, ['class', 'inert', 'aria-hidden']);
    observe(title, ['inert']);
    if (!panel) { intersections.set(title, false); io.observe(title); }
  }
  function sync() {
    if (destroyed) return;
    const panels = [...document.querySelectorAll('.fi-copy-panel')];
    const chapter = panels.findIndex(p => p.classList.contains('is-active'));
    if (chapter >= 0 && chapter !== lastChapter) {
      if (lastChapter >= 0) direction = chapter > lastChapter ? 1 : -1;
      lastChapter = chapter;
    }
    const clear = disabled(), gate = held();
    for (const [title, entry] of entries) {
      const inactive = !!title.closest('[inert], [aria-hidden="true"], [hidden]');
      const panelOn = entry.panel && (entry.panel.classList.contains('cl-on') || !html.dataset.copyLayout)
        && (entry.panel.classList.contains('is-active') || entry.panel.classList.contains('fi-portfolio-copy'));
      const shown = clear || (!gate && !inactive && (entry.panel ? panelOn : world?.classList.contains('is-open') && intersections.get(title)));
      if (shown === entry.shown) continue;
      entry.shown = shown;
      if (shown) {
        const entranceDirection = lastTitleOrder < 0 || entry.order === lastTitleOrder ? direction : entry.order > lastTitleOrder ? 1 : -1;
        if (!clear) lastTitleOrder = entry.order;
        title.style.setProperty('--ft-direction', entranceDirection);
        title.dataset.flowTitleDirection = entranceDirection < 0 ? 'backward' : 'forward';
      }
      title.classList.toggle('flow-title-on', shown);
    }
  }
  const io = new IntersectionObserver(list => {
    for (const entry of list) intersections.set(entry.target, entry.isIntersecting && entry.intersectionRatio > .08);
    sync();
  }, { root: null, rootMargin: '-5% 0px -9% 0px', threshold: [0, .08, .25] });
  function scan() { if (destroyed) return; document.querySelectorAll(selector).forEach(prepare); sync(); }
  const onScroll = () => { const next = viewport.scrollTop; if (Math.abs(next - scrollY) > 1) direction = next > scrollY ? 1 : -1; scrollY = next; };
  function start() {
    if (destroyed) return;
    html.dataset.flowTitles = 'on';
    scan();
    const copy = document.querySelector('.fi-copy');
    if (copy) { const observer = new MutationObserver(scan); observer.observe(copy, { childList: true, subtree: true }); observers.push(observer); }
    observe(html, ['data-gate', 'data-render-mode']);
    observe(world, ['class', 'inert', 'hidden']);
    document.querySelectorAll('.fiwo-panel, .fiw-resp, .fiwp-chapter').forEach(el => observe(el, ['class', 'inert', 'aria-hidden']));
    viewport?.addEventListener('scroll', onScroll, { passive: true });
    reduced.addEventListener('change', sync);
  }
  /* Public disposal is only for page teardown/testing; it makes all text
     readable before detaching observers, including when a WebGL fallback runs. */
  window.__FLOW_TITLE_MOTION__ = { dispose() {
    destroyed = true; io.disconnect(); observers.forEach(o => o.disconnect());
    viewport?.removeEventListener('scroll', onScroll); reduced.removeEventListener('change', sync);
    delete html.dataset.flowTitles;
    entries.forEach((_, title) => { title.classList.add('flow-title-on'); }); entries.clear();
  } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
