/* Index1-5's later world uses one renderer for globe, ocean and closing lake.
   Its mobilePerformance flag belongs only to the main index1-5 page; preserve
   the older small/low-memory fallback and index1-5-1 allocation paths. */
const once = (source, anchor, replacement, label) => {
  const usesCrlf = !source.includes(anchor) && anchor.includes('\n');
  const selected = usesCrlf ? anchor.replace(/\n/g, '\r\n') : anchor;
  if (source.split(selected).length !== 2) throw Error('world mobile performance ' + label + ': unexpected anchor count');
  return source.replace(selected, () => usesCrlf ? replacement.replace(/\n/g, '\r\n') : replacement);
};
function patchWorld(source) {
  if (source.includes('/* WORLD_MOBILE_PERFORMANCE:')) return source;
  source = once(source,
    "  if (!root) throw new Error('World epilogue: no #fiWorld in the page');",
    `  if (!root) throw new Error('World epilogue: no #fiWorld in the page');
  /* WORLD_MOBILE_PERFORMANCE: one gate for this renderer and its ocean/lake allocations. */
  const shortScreen = Math.min(screen.width, screen.height);
  const mobilePerformance = document.documentElement.matches('[data-look="index1-5"]:not([data-opening-refinement])') &&
    (innerWidth <= 760 || shortScreen < 700 || (!!window.matchMedia?.('(pointer: coarse)')?.matches && shortScreen <= 900));`, 'main-page mobile gate');
  source = once(source, 'root, reducedMotion, config: oceanConfig, small:',
    'root, reducedMotion, config: oceanConfig, mobilePerformance, small:', 'ocean mobile gate');
  source = once(source, 'root, reducedMotion, config: logoConfig, small:',
    'root, reducedMotion, config: logoConfig, mobilePerformance, small:', 'lake mobile gate');
  source = once(source,
    '  const maxDpr = Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2);',
    '  const maxDpr = Math.min(window.devicePixelRatio || 1, mobilePerformance ? 1.25 : small ? 1.75 : 2);', 'world DPR');
  source = once(source,
    "    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });",
    "    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobilePerformance, alpha: true, powerPreference: 'high-performance' });", 'canvas MSAA');
  source = once(source,
    'new THREE.SphereGeometry(1, small ? 128 : 192, small ? 96 : 144)',
    'new THREE.SphereGeometry(1, mobilePerformance ? 96 : small ? 128 : 192, mobilePerformance ? 64 : small ? 96 : 144)', 'globe geometry');
  source = once(source,
    'new THREE.SphereGeometry(1.075, 96, 64)',
    'new THREE.SphereGeometry(1.075, mobilePerformance ? 48 : 96, mobilePerformance ? 32 : 64)', 'halo geometry');
  return source;
}
module.exports = ({ main, drops, letters, glass, html, extra = {}, journey }) => {
  if (!extra['finnovation-world.js']) throw Error('world mobile performance: world module is missing');
  return { main, drops, letters, glass, html, journey,
    extra: { 'finnovation-world.js': patchWorld(extra['finnovation-world.js']) } };
};
module.exports.patchWorld = patchWorld;
