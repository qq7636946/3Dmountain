/* Local to index1-5 (2026-10-31). The sea keeps its original blue (client: 「圖一的海回復原色」).
   The 2026-10-28 tone pass (water-tone-build.cjs) moved the valley's water and light to silver-blue. The ocean derives its palette from those
   (worldOcean.valley), so it went grey with them. It now reads its own copy of the values it had before that pass (read off the running page of
   _archive/backups/index1-5-before-tone-unification-20261028); the river and everything else keep the tone pass. Dials: 「海洋章節 Ocean」. */
const SEA = { seaBase: '#699fce', seaHighlight: '#b4bec5', seaSun: '#ffeacc', seaFog: '#b7c9d6', seaCloudLit: '#f0f0eb', seaCloudShade: '#7e96b1' };
const ROWS = [['海 原色｜水', 'seaBase'], ['海 原色｜水面亮處', 'seaHighlight'], ['海 原色｜太陽（亮點）', 'seaSun'], ['海 原色｜遠處霧', 'seaFog'], ['海 原色｜雲 受光', 'seaCloudLit'], ['海 原色｜雲 背光', 'seaCloudShade']]
  .map(([label, key]) => [label, 'worldOcean', key]);
function once(source, anchor, replacement, label) {
  const n = source.split(anchor).length - 1;
  if (n !== 1) throw Error('sea-original anchor (' + label + '): ' + n);
  return source.replace(anchor, () => replacement);
}
function patchOcean(src) {
  if (src.includes('/* SEA_ORIGINAL */')) return src;
  src = once(src, '  function palette() {', '  const seaWater = {}, seaLight = {};   /* SEA_ORIGINAL */\n  function palette() {', 'palette');
  return once(src, 'const C = window.__MONTIS_STUDY__?.CONFIG, ww = C?.watershedWater || {}, al = C?.alpineLight || {};',
    `const C = window.__MONTIS_STUDY__?.CONFIG, O = cfg(), W0 = C?.watershedWater || {}, A0 = C?.alpineLight || {};
    // The sea's own colours (see sea-original-build.cjs); the valley's when a key is cleared.
    seaWater.base = O.seaBase || W0.base; seaWater.highlight = O.seaHighlight || W0.highlight;
    seaLight.sunColor = O.seaSun || A0.sunColor; seaLight.fogColor = O.seaFog || A0.fogColor; seaLight.cloudLit = O.seaCloudLit || A0.cloudLit; seaLight.cloudShade = O.seaCloudShade || A0.cloudShade;
    const ww = seaWater, al = seaLight;`, 'palette reads');
}
function patchMain(main) {
  if (main.includes('/* SEA_ORIGINAL */')) return main;
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',
    `      /* SEA_ORIGINAL */
      Object.assign(CONFIG.worldOcean, ${JSON.stringify(SEA)});
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'config');
  return once(main, "['海洋章節 Ocean', [", `['海洋章節 Ocean', [${ROWS.map(r => JSON.stringify(r)).join(',')},`, 'rows');
}
module.exports = ({ main, drops, letters, glass, html, extra = {} }) => {
  if (!extra['world-ocean.js']) throw Error('sea-original: no world-ocean.js in extra');
  return { main: patchMain(main), drops, letters, glass, html, extra: { 'world-ocean.js': patchOcean(extra['world-ocean.js']) } };
};
module.exports.patchOcean = patchOcean; module.exports.patchMain = patchMain;
