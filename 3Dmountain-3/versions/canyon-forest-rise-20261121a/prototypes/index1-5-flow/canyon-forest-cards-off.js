/* index1-5-canyon-forest.html only (team T, tidy round 2026-11-17; client: 「整理我現有的程式碼+效能完美優化」).
   The page's import map points main.js's lazy import of the epilogue cards (prototypes/index1-5/js/portfolio-epilogue-polish.js) here.
   On this page the cards can never open: they sit after the sea and the globe, and the globe is already an inert stand-in here
   (flow2-scope-world.js, whose ready never comes, so site-sections' cardsAt() never reaches openAt(), and main.js hands the wheel to the
   cards only while they are open). Yet the engine mounted them about a second after the canyon went live and prepared them out of
   sight: a second WebGL canvas (OGL from jsdelivr, 107 KB), seven photographs from images.pexels.com (≈ 0.56 MB), the slider module,
   a hidden layer, a hidden copy panel and the news ticker built into it. This stand-in answers every question the engine and the
   interface ask (closed, nothing to show) and loads nothing.
   ?opt=0 (the page as on 11-16) or ?cards=1 = the real module, unchanged (its address carries "&real" because the address without it
   is the import map's key and would lead back here). */
const Q = new URLSearchParams(location.search);
const real = (Q.get('opt') === '0' || Q.get('cards') === '1') ? await import('../index1-5/js/portfolio-epilogue-polish.js?v=recorded-20261109&real') : null;

export function mountPortfolio(options = {}) {
  if (real) return real.mountPortfolio(options);
  const bridge = !!options.bridge;
  return {
    preload: () => Promise.resolve(null), close() { },
    openAt: async () => false, seekProgress() { },
    get displayStrip() { return 0; },
    get open() { return false; }, get ready() { return false; }, get pending() { return false; },
    get transition() { return 0; }, get covering() { return false; },
    get bridge() { return bridge; }, get strip() { return 0; },
    setExit() { }, take() { return false; }, dispose() { }
  };
}
