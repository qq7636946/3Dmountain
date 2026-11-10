/* water-light.js — what water-light.css cannot do alone (2026-11-02). Standalone, no imports; nothing runs at rest.
   1. The menu's rows are not in button-glass.js's list: the pool of light follows the pointer there too.
   2. A touch screen has no hover: a tap holds .wl-tap for a moment, which gives the press its light (and puts it where the finger is).
   ?waterlight=0 takes the whole layer off, for comparison. */
(() => {
  if (new URLSearchParams(location.search).get('waterlight') === '0') { document.querySelector('link[data-water-light]')?.remove(); return; }
  const ROWS = '.fi-menu-links button';
  const TAP = '.fi-copy-action, .fiwo-pill, .fiwp-next, .fiw-outro-links button, .fi-menu-toggle, .fi-footer button, .fiw-top, .fi-menu-links button, .fi-menu-close';
  const place = (el, e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left).toFixed(1) + 'px'); el.style.setProperty('--my', (e.clientY - r.top).toFixed(1) + 'px'); };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const row = e.target instanceof Element ? e.target.closest(ROWS) : null;
    if (row) place(row, e);
  }, { passive: true });
  const timers = new WeakMap();
  addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    const el = e.target instanceof Element ? e.target.closest(TAP) : null;
    if (!el) return;
    place(el, e); el.classList.add('wl-tap');
    clearTimeout(timers.get(el));
    timers.set(el, setTimeout(() => el.classList.remove('wl-tap'), 700));
  }, { passive: true, capture: true });
})();
