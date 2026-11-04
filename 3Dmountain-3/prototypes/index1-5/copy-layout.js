/* index1-5 copy reveal (2026-11-04): the letters of each chapter title come up one by one out of a blur (after ysuriadesign.co), and the
   lines after them a moment later, when the chapter becomes the one on screen (the interface toggles .is-active; the cards' panel is
   shown by un-inerting it). Behind the entry gate (index1-5-enter) the words light when the visitor is let in.
   Client: 「文字排版跟顏色樣式要照我原本的」— so by default the layout and the colours are the page's own (the centred copy, the water
   titles of title-water.css); only the reveal is added. ?copylayout=next shows the layout after the client's "NEXT" sample
   (copy-layout.css); ?copylayout=0 turns the reveal off as well.
   The water titles are one picture seen through the letters (background-clip: text on the title). A letter that fades, blurs or rises on
   its own is painted on its own, outside that picture, so each letter carries its own piece of it: the same images, sized to the
   title and shifted by the letter's place in it. The title looks as before, letter for letter. */
(() => {
  const root = document.documentElement;
  const asked = (new URLSearchParams(location.search).get('copylayout') || '').toLowerCase();
  if (/^(0|off|false)$/.test(asked)) { delete root.dataset.copyLayout; return; }
  if (asked === 'next') root.dataset.copyLayout = 'next';
  if (!root.dataset.copyLayout) return;
  const NUM = { knowledge: 1, innovation: 2, convergence: 3, value: 4, perspective: 5, strategies: 6, ai: 6, public: 6, private: 6, derivatives: 6 };
  const held = () => /^(hold|ready)$/.test(root.dataset.gate || '');
  const titles = new Set();

  function wrapLetters(title) {
    if (!title.hasAttribute('aria-label')) title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
    let i = 0;
    const wrap = (node, top) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 1) { wrap(child, false); continue; }
        if (child.nodeType !== 3) continue;
        if (top && !child.textContent.trim()) continue;   /* the gap between the title's two lines stays plain */
        const frag = document.createDocumentFragment();
        for (const ch of child.textContent) { const s = document.createElement('span'); s.className = 'cl-ch'; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--i', i++); s.textContent = ch; frag.append(s); }
        child.replaceWith(frag);
      }
    };
    wrap(title, true);
    titles.add(title);
    new MutationObserver(() => { if (title.dataset.clWater !== 'on') paintWater(title); }).observe(title, { attributes: true, attributeFilter: ['class'] });
  }

  /* ------------------------------------------------------------ the water picture, piece by piece */
  const aspects = new Map();   /* picture url → width / height, once it has loaded */
  const urlOf = layer => (/url\(["']?([^"')]+)["']?\)/.exec(layer) || [])[1];
  const layersOf = value => { const out = []; let depth = 0, from = 0; for (let i = 0; i < value.length; i++) { const c = value[i]; if (c === '(') depth++; else if (c === ')') depth--; else if (c === ',' && depth === 0) { out.push(value.slice(from, i).trim()); from = i + 1; } } out.push(value.slice(from).trim()); return out; };
  function lengthIn(token, box, image) { if (token.endsWith('%')) return (box - image) * parseFloat(token) / 100; return parseFloat(token) || 0; }
  function paintWater(title) {
    const cs = getComputedStyle(title);
    const images = title.dataset.clImages || cs.backgroundImage;
    /* not (yet) a water title: section-motion.js adds the class title-water.css asks for once the page runs, and the title is looked at again then */
    if (!/url\(/.test(images) || !/text/.test(cs.webkitBackgroundClip || cs.backgroundClip || '')) return;
    /* keep the title's own layers once: after this the title's background is turned off and the letters carry it */
    if (!title.dataset.clImages) { title.dataset.clImages = images; title.dataset.clSizes = cs.backgroundSize; title.dataset.clPositions = cs.backgroundPosition; title.dataset.clRepeats = cs.backgroundRepeat; }
    const imageLayers = layersOf(title.dataset.clImages), sizes = layersOf(title.dataset.clSizes), positions = layersOf(title.dataset.clPositions);
    const W = title.clientWidth, H = title.clientHeight;
    if (cs.position === 'static') title.style.position = 'relative';   /* the letters' places are measured from the title */
    if (!W || !H) return;
    const placed = imageLayers.map((layer, k) => {
      const [sw = 'auto', sh = 'auto'] = (sizes[k] || 'auto').split(/\s+/), [px = '0%', py = '0%'] = (positions[k] || '0% 0%').split(/\s+/);
      let w = sw === 'auto' ? NaN : sw.endsWith('%') ? W * parseFloat(sw) / 100 : parseFloat(sw), h = sh === 'auto' ? NaN : sh.endsWith('%') ? H * parseFloat(sh) / 100 : parseFloat(sh);
      const url = urlOf(layer);
      if (url) { const a = aspects.get(url); if (!a) { if (!aspects.has(url)) { aspects.set(url, 0); const img = new Image(); img.onload = () => { aspects.set(url, img.naturalWidth / Math.max(1, img.naturalHeight)); for (const t of titles) paintWater(t); }; img.src = url; } return null; }
        if (Number.isNaN(w) && Number.isNaN(h)) { w = W; h = w / a; } else if (Number.isNaN(h)) h = w / a; else if (Number.isNaN(w)) w = h * a; }
      else { if (Number.isNaN(w)) w = W; if (Number.isNaN(h)) h = H; }   /* a gradient with no size fills the box */
      return { w, h, x: lengthIn(px, W, w), y: lengthIn(py, H, h) };
    });
    if (placed.some(p => !p)) return;   /* a picture still loading: painted when it arrives */
    title.style.backgroundImage = 'none';
    const size = placed.map(p => `${p.w.toFixed(1)}px ${p.h.toFixed(1)}px`).join(', ');
    for (const ch of title.querySelectorAll('.cl-ch')) {
      let x = 0, y = 0;
      for (let n = ch; n && n !== title; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; if (n.offsetParent === title) break; }
      ch.style.backgroundImage = title.dataset.clImages; ch.style.backgroundSize = size; ch.style.backgroundRepeat = title.dataset.clRepeats;
      ch.style.backgroundPosition = placed.map(p => `${(p.x - x).toFixed(1)}px ${(p.y - y).toFixed(1)}px`).join(', ');
    }
    title.dataset.clWater = 'on';
  }
  let dirty = true;
  const repaint = () => { dirty = false; for (const t of titles) if (t.offsetParent) paintWater(t); else dirty = true; };

  /* ------------------------------------------------------------ lighting a chapter */
  function light(panel) {
    const on = !held() && (panel.classList.contains('is-active') || panel.classList.contains('fi-portfolio-copy') && !panel.inert);
    if (on === (panel.dataset.clWant === '1')) return;
    panel.dataset.clWant = on ? '1' : '0';
    /* two frames, so the letters start from their hidden state even when the panel has just been shown */
    if (on) requestAnimationFrame(() => { const t = panel.querySelector(':scope > :is(h1, h2)'); if (t && (dirty || t.dataset.clWater !== 'on')) paintWater(t); requestAnimationFrame(() => { if (panel.dataset.clWant === '1') panel.classList.add('cl-on'); }); });
    else panel.classList.remove('cl-on');
  }
  function prepare(panel) {
    if (panel.dataset.clReady) return; panel.dataset.clReady = '1';
    const title = panel.querySelector(':scope > :is(h1, h2)');
    if (title) wrapLetters(title);
    const kicker = panel.querySelector(':scope > .fi-copy-kicker'), n = NUM[panel.dataset.copy] || (panel.classList.contains('fi-portfolio-copy') ? 7 : 0);
    if (kicker && n) kicker.dataset.clNum = String(n).padStart(2, '0') + ' / 11';
    new MutationObserver(() => light(panel)).observe(panel, { attributes: true, attributeFilter: ['class', 'inert'] });
    light(panel);
  }
  function start() {
    const copy = document.querySelector('.finnovation-ui .fi-copy');
    if (!copy) return;
    for (const panel of copy.querySelectorAll('.fi-copy-panel')) prepare(panel);
    new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('fi-copy-panel')) prepare(n); }).observe(copy, { childList: true });
    new MutationObserver(() => { for (const panel of copy.querySelectorAll('.fi-copy-panel')) light(panel); }).observe(root, { attributes: true, attributeFilter: ['data-gate'] });
    /* the letters' places move with the window and with the font arriving */
    let t = 0; addEventListener('resize', () => { dirty = true; clearTimeout(t); t = setTimeout(repaint, 120); });
    document.fonts?.ready.then(repaint);
    requestAnimationFrame(repaint);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
