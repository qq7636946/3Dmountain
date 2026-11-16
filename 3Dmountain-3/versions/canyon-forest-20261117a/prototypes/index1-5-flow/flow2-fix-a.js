/* Flow2, group A fixes (2026-11-10, client: 「先修 A 組」): where the visitor is decides how much of the fixed interface stands over the
   content (flow2-fix-a.css). html[data-flow2-rail]:
     full     the 3D journey
     compact  desktop: Why, News, the globe (the left arc keeps only its dots)
     hide     desktop: from the principles to the footer (their copy starts at the left edge); phone: the footer (it has its own links)
   It reads the world the page already exposes (__MONTIS_STUDY__.world: leg, y, at) and changes nothing else. Also adds the phone dock's
   backing element. */
(() => {
  const root = document.documentElement, desktop = matchMedia('(min-width: 961px)');
  let state = '', frame = 0;
  function where() {
    const W = window.__MONTIS_STUDY__?.world, body = document.body.classList, H = innerHeight;
    /* the epilogue (globe → principles → logo → footer) is the world's sky leg; Why is its sea leg */
    const sky = !!(W && W.leg === 'sky' && W.at), y = W?.y ?? 0;
    if (desktop.matches) {
      if (sky && W.at.principles > 0 && y >= W.at.principles - H * .35) return 'hide';
      return body.contains('is-world') || body.contains('is-portfolio') ? 'compact' : 'full';
    }
    return sky && W.at.footer > 0 && y >= W.at.footer - H * .95 ? 'hide' : 'full';
  }
  function tick() {
    /* about ten times a second is enough for a fade */
    if (++frame % 6 === 0) {
      const next = where();
      if (next !== state) { state = next; root.dataset.flow2Rail = next; }
    }
    requestAnimationFrame(tick);
  }
  function start() {
    const ui = document.querySelector('.finnovation-ui');
    if (ui && !ui.querySelector(':scope > .flow2-dock-scrim')) {
      const scrim = document.createElement('div');
      scrim.className = 'flow2-dock-scrim';
      scrim.setAttribute('aria-hidden', 'true');
      ui.prepend(scrim);
    }
    root.dataset.flow2Rail = state = where();
    requestAnimationFrame(tick);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
