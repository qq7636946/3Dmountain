/* index1-5 optimisation team (2026-10-25/26), stream "phone": PHONE ONLY, run last by build.cjs (PERF_ONLY=phone).
   One phone rule for this stream: main.js's mobileRenderBudget.mobile (mobile-render-budget.js: width <= 760, or a coarse pointer
   with a short side <= 900). main.js publishes it as <html data-mobile-budget>, so the CSS and the main-page modules read the same
   answer. The world modules keep their existing mobilePerformance flag (the same rule for every phone).
   Desktop: the attribute is absent, and every other change is numerically identical there (GLSL #define of the old literal).
   Items (first half): cards-dpr-phone, portfolio-pexels-phone, phone-transition-taps, phone-mirror-scale, phone-glass-capture,
   phone-glass-and-blend (CSS), principles-cbg-phone, earth-tone-phone, phone-tier-consistency (the attribute).
   Helper contract: ({main,drops,letters,glass,html,journey,watershed,ui,extra}) => the same (+ extra edits). */
'use strict';
/* 2026-10-26: this helper is OFF unless PERF_PHONE_ON=1 (its items are not yet verified at 390 px; see docs/perf/TEAM-PLAN.md). */
if (process.env.PERF_PHONE_ON !== '1') { module.exports = (S) => ({ ...S, extra: { ...(S.extra || {}) } }); return; }

const once = (source, anchor, replacement, label) => {
  const hits = source.split(anchor).length - 1;
  if (hits !== 1) throw Error('phone helper anchor ' + label + ': ' + hits + ' hits');
  return source.replace(anchor, () => replacement);
};
const need = (extra, name) => {
  if (typeof extra[name] !== 'string') throw Error('phone helper: module ' + name + ' is missing');
  return extra[name];
};

/* Phone-only look: the small per-element backdrop blurs (each one re-blurs the WebGL canvas behind it every frame), the
   full-screen CSS grain (a 220% layer under a 5% noise). The menu's own veil (.fi-menu::backdrop) and the soft-light wash stay:
   they are visible on a phone. Every rule needs the attribute, so desktop never matches it. */
const PHONE_CSS = `
/* perf-phone (2026-10-26): phones only (html[data-mobile-budget], the same rule as the JS budget). Desktop never has it. */
html[data-mobile-budget] .grain { display: none !important; }
html[data-mobile-budget] :is(.fi-header-actions .fi-menu-toggle, .fi-copy-action, .fi-copy-action > span, .fi-copy-panel .fi-copy-action,
  .fi-footer .fi-icon, .fi-menu, .alp-stats, .alp-tag, .alp-scene-clock, .journey-cue, #fiWorld .fiwo-pill, #fiWorld .fiwp-next) {
  -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
}
`;

module.exports = ({ main, drops, letters, glass, html, journey, watershed, ui, extra = {} }) => {
  /* ---- main.js: publish the one phone rule; portfolio photographs at 720 px on phones (Pexels size parameter only) ---- */
  main = once(main, '      let renderer, sceneStopped = false, logoGeometryBuilder = null;',
    "      document.documentElement.toggleAttribute('data-mobile-budget', mobileRenderBudget.mobile);\n" +
    '      let renderer, sceneStopped = false, logoGeometryBuilder = null;', 'budget attribute');
  main = once(main, 'images: CONFIG.portfolio.images, base: CONFIG.portfolio.base,',
    "images: document.documentElement.hasAttribute('data-mobile-budget') ? CONFIG.portfolio.images.map(url => url.replace('&w=1024&h=1024', '&w=720&h=720')) : CONFIG.portfolio.images, base: CONFIG.portfolio.base,",
    'portfolio photo size');

  /* ---- page CSS (inline, after every stylesheet link): one block, phone-only selectors ---- */
  html = once(html, '</head>', '<style id="perf-phone-blend">' + PHONE_CSS + '</style>\n</head>', 'phone css');

  /* ---- glass (water-logo-reference-glass.js): the optical capture on phones at 0.5 (was 0.75); desktop 1.15 unchanged ---- */
  glass = once(glass, 'Math.min(mobile ? .75 : 1.15,dpr)', 'Math.min(mobile ? .5 : 1.15,dpr)', 'glass capture size');

  const out = { ...extra };

  /* ---- card strip (portfolio-epilogue-polish.js): DPR 1.25 on phones, 1.75 desktop ---- */
  {
    const name = 'portfolio-epilogue-polish.js';
    out[name] = once(need(extra, name), 'dpr: 1.75, skipIntro: reducedMotion, externalEntrance: true',
      "dpr: document.documentElement.hasAttribute('data-mobile-budget') ? 1.25 : 1.75, skipIntro: reducedMotion, externalEntrance: true",
      'card strip dpr');
  }

  /* ---- LOGO cut composite (world-logo.js): 5 glass taps on phones, 9 on desktop (GLASS_TAPS define; desktop value 9 = old literal) ---- */
  {
    const name = 'world-logo.js';
    let s = need(extra, name);
    s = once(s, 'vertexShader: VERTEX, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false, blending: THREE.NoBlending,',
      'vertexShader: VERTEX, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false, blending: THREE.NoBlending, defines: { GLASS_TAPS: mobilePerformance ? 5 : 9 },',
      'composite define');
    s = once(s, 'for (int j = 0; j < 9; j++) {', 'for (int j = 0; j < GLASS_TAPS; j++) {', 'composite loop bound');
    s = once(s, 'float f = (float(j) + dz) / 9.0;', 'float f = (float(j) + dz) / float(GLASS_TAPS);', 'composite tap weight');
    out[name] = s;
  }

  /* ---- dive (world-dive-fx.js): 3 colour taps and 3 fbm octaves on phones (DIVE_TAPS, FBM_OCTAVES); desktop 5 and 4 ---- */
  {
    const name = 'world-dive-fx.js';
    let s = need(extra, name);
    s = once(s, 'export function createWorldDiveFx({ reducedMotion = false } = {}) {',
      'export function createWorldDiveFx({ reducedMotion = false, mobilePerformance = false } = {}) {', 'dive signature');
    s = once(s, 'vertexShader: VERTEX, fragmentShader: FRAGMENT, depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,',
      'vertexShader: VERTEX, fragmentShader: FRAGMENT, depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false, defines: { DIVE_TAPS: mobilePerformance ? 3 : 5, FBM_OCTAVES: mobilePerformance ? 3 : 4 },',
      'dive defines');
    s = once(s, 'float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) {',
      'float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < FBM_OCTAVES; i++) {', 'dive fbm octaves');
    s = once(s, '  for (int j = 0; j < 5; j++) {', '  for (int j = 0; j < DIVE_TAPS; j++) {', 'dive tap loop');
    s = once(s, '    float f = (float(j) + dz) / 5.0, s = 1.0 - L * f;', '    float f = (float(j) + dz) / float(DIVE_TAPS), s = 1.0 - L * f;', 'dive tap weight');
    s = once(s, '  col /= 5.0;', '  col /= float(DIVE_TAPS);', 'dive average');
    out[name] = s;
  }

  /* ---- world (finnovation-world.js): pass the world's phone flag on; the whole-planet map 1024 on phones ---- */
  {
    const name = 'finnovation-world.js';
    let s = need(extra, name);
    s = once(s, '  const principles = createWorldPrinciples({ root, reducedMotion,', '  const principles = createWorldPrinciples({ root, reducedMotion, mobilePerformance,', 'principles flag');
    s = once(s, '  const diveFx = createWorldDiveFx({ reducedMotion });', '  const diveFx = createWorldDiveFx({ reducedMotion, mobilePerformance });', 'dive flag');
    s = once(s, "const pictures = [asset('earth-2k.jpg'), ", "const pictures = [asset(mobilePerformance ? 'earth-1k.jpg' : 'earth-2k.jpg'), ", 'planet map size');
    out[name] = s;
  }

  /* ---- principles (world-principles.js): the second background at 1280 x 720 on phones (c-bg-v1-m.webp), desktop unchanged ---- */
  {
    const name = 'world-principles.js';
    let s = need(extra, name);
    s = once(s, 'export function createWorldPrinciples({root,reducedMotion=false,go=()=>{},remeasure=()=>{}}){',
      'export function createWorldPrinciples({root,reducedMotion=false,go=()=>{},remeasure=()=>{},mobilePerformance=false}){', 'principles signature');
    s = once(s, "new URL('../assets/principles/c-bg-v1.webp',import.meta.url).href",
      "new URL(mobilePerformance?'../assets/principles/c-bg-v1-m.webp':'../assets/principles/c-bg-v1.webp',import.meta.url).href", 'principles image');
    out[name] = s;
  }

  /* ---- lake mirror (world-logo-scene.js): a smaller mirror target on phones (.375; the reflection is blurred anyway) ---- */
  {
    const name = 'world-logo-scene.js';
    out[name] = once(need(extra, name), 'const mirrorScale = mobilePerformance ? .5 : .75;',
      'const mirrorScale = mobilePerformance ? .375 : .75;', 'mirror scale');
  }

  return { main, drops, letters, glass, html, journey, watershed, ui, extra: out };
};
