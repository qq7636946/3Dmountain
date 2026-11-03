/* index1-5 optimisation 2026-11-03, stream "net" (客戶：「第一階段全做加第 5 項」). Downloads and phone-only card sizes, picked out of the
   unshipped perf-boot / perf-phone helpers (both off; only these items are taken):
     gsap-unused       the world downloads GSAP, ScrollTrigger and SplitText from the CDN, registers them, waits for the fonts and then leaves:
                       index1-5's own section motion (section-motion.js) always exists, so the GSAP reveals never run. Not downloaded now.
     phone-budget-attr main.js publishes its one phone rule (mobileRenderBudget.mobile) as <html data-perf-phone> for the two items below.
                       Not data-mobile-budget: button-glass.css holds dormant phone rules on that name (lighter glass, smaller chips), never
                       switched on; publishing it changed the phone buttons (caught by the phone parity check, 11-03).
     phone-card-photos the eleven Pexels card photographs at 720 px on phones instead of 1024 (a card is at most ~640 device px wide there).
     phone-card-dpr    the card strip draws at DPR 1.25 on phones instead of 1.75 (its seven full-screen passes). Desktop unchanged.
   Runs in build.cjs's perf loop; an item whose anchor is missing is skipped with a warning. */
'use strict';
const log = (...a) => console.log('perf-net:', ...a);
function must(s, a, b) {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error(`anchor found ${c}x: ${a.slice(0, 80)}`);
  return s.replace(a, () => b);
}
function item(name, fn) { try { const out = fn(); log('applied', name); return out; } catch (e) { log('ITEM SKIPPED', name, '—', e.message); return null; } }
const PHONE = "document.documentElement.hasAttribute('data-perf-phone')";

module.exports = state => {
  let { main } = state;
  const extra = { ...state.extra };
  const world = 'finnovation-world.js', cards = 'portfolio-epilogue-polish.js';
  if (!main.includes('/* PERF_NET */')) {
    extra[world] = item('gsap-unused', () => must(extra[world], 'const motion = reducedMotion ? Promise.resolve() : Promise.all([import(GSAP_URL)',
      '/* PERF_NET gsap-unused: section-motion.js always exists here, so the GSAP branch below never ran past its fonts wait */\n  const motion = reducedMotion || sectionMotion ? Promise.resolve() : Promise.all([import(GSAP_URL)')) || extra[world];
    const attr = item('phone-budget-attr', () => must(main, '      let renderer, sceneStopped = false, logoGeometryBuilder = null;',
      "      document.documentElement.toggleAttribute('data-perf-phone', mobileRenderBudget.mobile);   /* PERF_NET: the one phone rule, for the card sizes */\n      let renderer, sceneStopped = false, logoGeometryBuilder = null;"));
    if (attr) {
      main = attr;
      main = item('phone-card-photos', () => must(main, 'images: CONFIG.portfolio.images, base: CONFIG.portfolio.base,',
        `images: ${PHONE} ? CONFIG.portfolio.images.map(url => url.replace('&w=1024&h=1024', '&w=720&h=720')) : CONFIG.portfolio.images, base: CONFIG.portfolio.base,`)) || main;
      extra[cards] = item('phone-card-dpr', () => must(extra[cards], 'dpr: 1.75, skipIntro: reducedMotion, externalEntrance: true',
        `dpr: ${PHONE} ? 1.25 : 1.75, skipIntro: reducedMotion, externalEntrance: true`)) || extra[cards];
    }
  }
  return { ...state, main, extra };
};
