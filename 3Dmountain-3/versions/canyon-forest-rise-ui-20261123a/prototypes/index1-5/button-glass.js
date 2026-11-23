/* button-glass.js — the buttons' detail (2026-11-01, client: 「UI 按鈕再更有質感一點 參考AWW FWA」). Standalone, no imports; button-glass.css draws everything, and without this file the buttons stay plain glass.
   1. Builds what the glass needs: the label in a roll (it turns over on hover) and the arrow in a small round chip.
   2. With a mouse: the light on the glass follows the pointer (--mx, --my). The button leaning a few pixels towards it is off (LEAN.on); it uses the `translate` property, added to the section motion's own --motion-y.
   Nothing runs at rest: one listener, and the frame loop lives only while a button is moving. Reduced motion or a touch screen: no lean. */
(() => {
  const PILLS = '.fi-copy-action, .fiwo-pill, .fiwp-next, .fiw-outro-links button';
  const ROLLS = '.fi-copy-action > span, .fiwo-pill > span, .fiwp-next > span, .fiw-outro-links button, .fiw-top, .fi-menu-close';
  const LEANS = PILLS + ', .fi-menu-toggle, .fiw-top, .fi-menu-close, .fi-sound, .fi-footer-next';
  const LEAN = { on: false, x: .16, y: .3, most: 7, ease: .16 };   // the client: 「滑鼠碰按鈕，按鈕不需要移動」. on: true brings it back
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function arrow(d) {
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 20 20'); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.appendChild(p);
    return svg;
  }
  function roll(host) {
    for (const n of [...host.childNodes]) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
      const text = n.nodeValue.replace(/\s+/g, ' ').trim(), wrap = document.createElement('span'), inner = document.createElement('span');
      wrap.className = 'btn-roll'; wrap.dataset.text = text; inner.className = 'btn-roll-in'; inner.textContent = text; wrap.appendChild(inner);
      host.replaceChild(wrap, n);
    }
  }
  function chip(button) {
    if (button.querySelector('.btn-chip')) return;
    const up = button.matches('.fiw-outro-links button'), c = document.createElement('span'), d = up ? 'M6 14 14 6M7 6h7v7' : 'M4 10h11m-5-5 5 5-5 5';
    c.className = 'btn-chip' + (up ? ' btn-chip--up' : ''); c.setAttribute('aria-hidden', 'true');
    c.append(arrow(d), arrow(d));
    (button.matches('.fi-copy-action') ? button.firstElementChild : button).appendChild(c);
    button.classList.add('btn-lux');
  }
  function enhance() {
    for (const host of document.querySelectorAll(ROLLS)) roll(host);
    for (const b of document.querySelectorAll(PILLS)) if (!b.matches('.fi-copy-action') || b.firstElementChild) chip(b);
  }

  /* the lean: each button eases to where the pointer asks and is let go when it is home */
  const live = new Map(); let raf = 0;
  function step() {
    raf = 0;
    for (const [b, s] of live) {
      s.x += (s.tx - s.x) * LEAN.ease; s.y += (s.ty - s.y) * LEAN.ease;
      if (!s.on && Math.abs(s.x) < .05 && Math.abs(s.y) < .05) { b.style.removeProperty('translate'); live.delete(b); continue; }
      b.style.translate = s.x.toFixed(2) + 'px calc(' + s.y.toFixed(2) + 'px + var(--motion-y, 0px))';   // the section motion moves these same buttons with --motion-y
    }
    if (live.size) raf = requestAnimationFrame(step);
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(step); };
  const clamp = v => Math.max(-LEAN.most, Math.min(LEAN.most, v));
  let current = null;
  function letGo() { const s = current && live.get(current); if (s) { s.on = false; s.tx = s.ty = 0; wake(); } current = null; }

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const b = e.target instanceof Element ? e.target.closest(LEANS) : null;
    if (b !== current) letGo();
    if (!b) return;
    current = b;
    /* measured without the lean, so the button does not chase itself */
    const s = live.get(b) || { x: 0, y: 0, tx: 0, ty: 0, on: true };
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', (e.clientX - r.left).toFixed(1) + 'px'); b.style.setProperty('--my', (e.clientY - r.top).toFixed(1) + 'px');
    if (reduced || !LEAN.on) return;
    s.on = true; s.tx = clamp((e.clientX - (r.left - s.x + r.width / 2)) * LEAN.x); s.ty = clamp((e.clientY - (r.top - s.y + r.height / 2)) * LEAN.y);
    live.set(b, s); wake();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', letGo);
  addEventListener('blur', letGo);

  /* the interface builds its panels when the page gets ready, and the world when it opens: go over them again on the body's class changes (not on every change in the page) */
  enhance();
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', enhance);
  const start = () => { enhance(); new MutationObserver(enhance).observe(document.body, { attributes: true, attributeFilter: ['class'] }); };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
})();
