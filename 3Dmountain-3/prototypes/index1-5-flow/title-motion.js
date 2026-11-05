/* FLOW title morph · 2026-11-05.
   Scroll selects the chapter; two temporary text layers merge through an
   SVG alpha threshold, inspired by https://codepen.io/Valgo/pen/PowZaNY.
   The original headings keep their layout and accessible names. Only an
   active transition owns a frame loop; nothing repaints while it is idle. */
(() => {
  const html = document.documentElement;
  if (window.__FLOW_TITLE_MOTION__?.effect === 'morph') return;
  // The live page's earlier script may have prepared these same headings.
  // Transfer ownership instead of leaving two reveal controllers running.
  window.__FLOW_TITLE_MOTION__?.dispose();
  const selector = '.fi-copy-panel > h1, .fi-copy-panel > h2, .fi-portfolio-copy > h2, .fiwo-strategy-title, .fiwp-title, .fisl-title, .fiw-outro-title, .fiw-statement';
  const entries = new Map(), intersections = new WeakMap(), observers = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let destroyed = false, lastChapter = -1, lastTitleOrder = -1, direction = 1, scrollY = 0;
  let pendingSync = 0, animation = 0, activeMorph = null, lastTitle = null;
  let overlay = null, filterSvg = null;
  const world = document.getElementById('fiWorld');
  const viewport = world?.querySelector('.fiw-viewport');
  const held = () => /^(hold|ready|finishing|enter)$/.test(html.dataset.gate || '');
  const disabled = () => reduced.matches || html.dataset.renderMode === 'text';

  function makeOverlay() {
    if (overlay) return;
    const ns = 'http://www.w3.org/2000/svg';
    filterSvg = document.createElementNS(ns, 'svg');
    filterSvg.classList.add('flow-morph-filters');
    filterSvg.setAttribute('aria-hidden', 'true');
    filterSvg.setAttribute('focusable', 'false');
    const defs = document.createElementNS(ns, 'defs');
    const filter = document.createElementNS(ns, 'filter');
    filter.id = 'flow-title-morph-threshold';
    filter.setAttribute('x', '-20%'); filter.setAttribute('y', '-60%');
    filter.setAttribute('width', '140%'); filter.setAttribute('height', '220%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const threshold = document.createElementNS(ns, 'feColorMatrix');
    threshold.setAttribute('type', 'matrix');
    // A slightly lower alpha cutoff retains the existing condensed font's
    // finer stems while the two blurred silhouettes join and separate.
    threshold.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -96');
    filter.appendChild(threshold); defs.appendChild(filter); filterSvg.appendChild(defs);
    overlay = document.createElement('div');
    overlay.className = 'flow-title-morph'; overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true'); overlay.inert = true;
    document.body.append(filterSvg, overlay);
  }

  const typeProperties = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch',
    'font-kerning', 'font-feature-settings', 'font-variation-settings', 'line-height', 'letter-spacing',
    'word-spacing', 'text-align', 'text-transform', 'text-indent', 'white-space', 'word-break',
    'overflow-wrap', 'text-wrap', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'box-sizing'];
  function snapshot(title) {
    if (!title?.isConnected) return null;
    const rect = title.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > innerHeight) return null;
    const clone = title.cloneNode(true), style = getComputedStyle(title);
    const originals = [title, ...title.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    copies.forEach((copy, index) => {
      const computed = index ? getComputedStyle(originals[index]) : style;
      for (const attr of [...copy.attributes]) copy.removeAttribute(attr.name);
      for (const name of typeProperties) copy.style.setProperty(name, computed.getPropertyValue(name));
      copy.style.setProperty('display', index ? computed.display : 'block');
      copy.style.setProperty('position', 'static');
      copy.style.setProperty('margin', '0');
      copy.style.setProperty('opacity', '1', 'important');
      copy.style.setProperty('visibility', 'visible', 'important');
      copy.style.setProperty('transform', 'none', 'important');
      copy.style.setProperty('translate', 'none', 'important');
      copy.style.setProperty('filter', 'none', 'important');
      copy.style.setProperty('transition', 'none', 'important');
      copy.style.setProperty('animation', 'none', 'important');
      copy.style.setProperty('background', 'none', 'important');
      copy.style.setProperty('color', '#fff', 'important');
      copy.style.setProperty('-webkit-text-fill-color', '#fff', 'important');
      copy.style.setProperty('text-shadow', 'none', 'important');
    });
    clone.style.width = rect.width + 'px'; clone.style.height = rect.height + 'px';
    clone.style.maxWidth = 'none';
    const layer = document.createElement('div'); layer.className = 'flow-morph-layer';
    layer.appendChild(clone);
    return { title, rect, layer, fontSize: parseFloat(style.fontSize) || 48 };
  }

  function finishMorph() {
    cancelAnimationFrame(animation); animation = 0;
    if (activeMorph) {
      activeMorph.from?.title.removeAttribute('data-flow-morph-hidden');
      activeMorph.to.title.removeAttribute('data-flow-morph-hidden');
      activeMorph = null;
    }
    if (overlay) {
      overlay.hidden = true; overlay.replaceChildren();
      overlay.style.transform = ''; delete overlay.dataset.progress;
    }
    delete html.dataset.flowMorphActive;
  }

  function morphTo(title) {
    const previous = lastTitle;
    lastTitle = title;
    finishMorph();
    if (disabled() || held()) return;
    const to = snapshot(title);
    if (!to) return;
    let from = previous && previous !== title ? snapshot(previous) : null;
    // Separate sections can sit a full screen apart. Only merge headings in
    // the same reading area; the first heading of a new area still resolves
    // through the same filter, following its own position on screen.
    if (from && Math.abs(from.rect.top - to.rect.top) > innerHeight * .38) from = null;
    makeOverlay();
    const pad = 24;
    const left = Math.min(to.rect.left, from?.rect.left ?? to.rect.left) - pad;
    const top = Math.min(to.rect.top, from?.rect.top ?? to.rect.top) - pad;
    const right = Math.max(to.rect.right, from?.rect.right ?? to.rect.right) + pad;
    const bottom = Math.max(to.rect.bottom, from?.rect.bottom ?? to.rect.bottom) + pad;
    Object.assign(overlay.style, { left: left + 'px', top: top + 'px', width: right - left + 'px', height: bottom - top + 'px' });
    for (const item of [from, to].filter(Boolean)) {
      item.layer.style.left = item.rect.left - left + 'px';
      item.layer.style.top = item.rect.top - top + 'px';
      item.title.setAttribute('data-flow-morph-hidden', '');
      overlay.appendChild(item.layer);
    }
    activeMorph = { from, to };
    overlay.hidden = false; html.dataset.flowMorphActive = 'true';
    const duration = 820, started = performance.now();
    const blurScale = Math.max(1.2, Math.min(3.6, to.fontSize * .028));
    const alignX = from ? to.rect.left + to.rect.width / 2 - from.rect.left - from.rect.width / 2 : 0;
    const alignY = from ? to.rect.top + to.rect.height / 2 - from.rect.top - from.rect.height / 2 : 0;
    function paint(now) {
      if (!activeMorph || destroyed) return;
      if (disabled() || held() || !title.isConnected || document.hidden) { finishMorph(); return; }
      const progress = Math.max(0, Math.min(1, (now - started) / duration));
      const current = title.getBoundingClientRect();
      overlay.style.transform = `translate3d(${current.left - to.rect.left}px,${current.top - to.rect.top}px,0)`;
      // Copy blocks have different lead heights. Bring the outgoing word to
      // the new word's baseline before their silhouettes merge at mid-morph.
      const align = Math.min(1, progress / .42), settle = align * align * (3 - 2 * align);
      if (from) from.layer.style.transform = `translate3d(${alignX * settle}px,${alignY * settle}px,0)`;
      const pose = (item, weight) => {
        if (!item) return;
        item.layer.style.opacity = Math.pow(weight, .4).toFixed(4);
        item.layer.style.filter = `blur(${Math.min(32, blurScale * (1 / Math.max(.001, weight) - 1)).toFixed(3)}px)`;
      };
      pose(from, 1 - progress); pose(to, progress);
      overlay.dataset.progress = progress.toFixed(3);
      if (progress >= 1) { finishMorph(); return; }
      animation = requestAnimationFrame(paint);
    }
    paint(started);
  }

  function scheduleSync() {
    if (!destroyed && !pendingSync) pendingSync = requestAnimationFrame(() => { pendingSync = 0; sync(); });
  }

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
    const observer = new MutationObserver(scheduleSync);
    observer.observe(el, { attributes: true, attributeFilter: attributes }); observers.push(observer);
  }
  function prepare(title) {
    if (entries.has(title)) return;
    const panel = title.closest('.fi-copy-panel, .fi-portfolio-copy');
    /* copy-layout wraps later on some initial loads. Its childList callback
       below retries once those letters exist; never split its letters twice. */
    if (panel && html.dataset.copyLayout && !title.querySelector('.cl-ch')) return;
    if (!panel && title.querySelector('.fiw-line-mask, .char')) return; // GSAP fallback owns this title.
    if (!title.hasAttribute('aria-label')) title.setAttribute('aria-label', [...title.childNodes].map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim());
    title.dataset.flowTitle = 'ready';
    if (!title.querySelector('.flow-title-char')) {
      if (panel && title.querySelector('.cl-ch')) groupLetters(title);
      else wrapWorld(title, title.matches('.fiw-statement'));
    }
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
    const visibleTitles = [];
    for (const [title, entry] of entries) {
      if (!title.isConnected) {
        io.unobserve(title); entries.delete(title);
        if (lastTitle === title) lastTitle = null;
        continue;
      }
      const inactive = !!title.closest('[inert], [aria-hidden="true"], [hidden]');
      const panelOn = entry.panel && (entry.panel.classList.contains('cl-on') || !html.dataset.copyLayout)
        && (entry.panel.classList.contains('is-active') || entry.panel.classList.contains('fi-portfolio-copy'));
      const shown = clear || (!gate && !inactive && (entry.panel ? panelOn : world?.classList.contains('is-open') && intersections.get(title)));
      if (shown && !clear) visibleTitles.push(title);
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
    if (clear || gate) { finishMorph(); lastTitle = null; return; }
    const next = visibleTitles.find(title => entries.get(title).panel?.classList.contains('is-active'))
      || visibleTitles.sort((a, b) => Number(getComputedStyle(b).opacity) - Number(getComputedStyle(a).opacity))[0];
    if (next && next !== lastTitle) morphTo(next);
    else if (!next && activeMorph) finishMorph();
  }
  const io = new IntersectionObserver(list => {
    for (const entry of list) intersections.set(entry.target, entry.isIntersecting && entry.intersectionRatio > .08);
    scheduleSync();
  }, { root: null, rootMargin: '-5% 0px -9% 0px', threshold: [0, .08, .25] });
  function scan() { if (destroyed) return; document.querySelectorAll(selector).forEach(prepare); sync(); }
  const onScroll = () => { const next = viewport.scrollTop; if (Math.abs(next - scrollY) > 1) direction = next > scrollY ? 1 : -1; scrollY = next; scheduleSync(); };
  const onResize = () => { finishMorph(); scheduleSync(); };
  const onVisibility = () => { if (document.hidden) finishMorph(); };
  function start() {
    if (destroyed) return;
    html.dataset.flowTitles = 'on';
    html.dataset.flowTitleEffect = 'morph';
    scan();
    const copy = document.querySelector('.fi-copy');
    if (copy) { const observer = new MutationObserver(scan); observer.observe(copy, { childList: true, subtree: true }); observers.push(observer); }
    // The sea's panels receive their active/inert state when their module
    // mounts later. Observe that subtree without watching per-frame styles.
    if (world) {
      const observer = new MutationObserver(records => {
        const addedTitle = records.some(record => record.type === 'childList' && [...record.addedNodes]
          .some(node => node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector))));
        if (addedTitle) scan(); else scheduleSync();
      });
      observer.observe(world, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'inert', 'aria-hidden', 'hidden'] });
      observers.push(observer);
    }
    observe(html, ['data-gate', 'data-render-mode']);
    observe(world, ['class', 'inert', 'hidden']);
    document.querySelectorAll('.fiwo-panel, .fiw-resp, .fiwp-chapter').forEach(el => observe(el, ['class', 'inert', 'aria-hidden']));
    viewport?.addEventListener('scroll', onScroll, { passive: true });
    reduced.addEventListener('change', scheduleSync);
    addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
  }
  /* Public disposal is only for page teardown/testing; it makes all text
     readable before detaching observers, including when a WebGL fallback runs. */
  window.__FLOW_TITLE_MOTION__ = { effect: 'morph', dispose() {
    destroyed = true; io.disconnect(); observers.forEach(o => o.disconnect());
    cancelAnimationFrame(pendingSync); finishMorph();
    viewport?.removeEventListener('scroll', onScroll); reduced.removeEventListener('change', scheduleSync);
    removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVisibility);
    delete html.dataset.flowTitles;
    delete html.dataset.flowTitleEffect;
    overlay?.remove(); filterSvg?.remove();
    entries.forEach((_, title) => { title.classList.add('flow-title-on'); }); entries.clear();
  } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
