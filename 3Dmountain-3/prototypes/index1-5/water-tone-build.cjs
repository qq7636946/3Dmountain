/* Preserve the 2026-10-28 colour-only refinement when rebuilding index1-5. */
const TONE_PATCH = {
  // Free letters, their forming water and the assembled word share this glass.
  logoGlass: {
    tint: '#e4edf5', glCore: '#6888a4', glDepth: .30,
    glInkColor: '#203b55', glInk: .32, glBandHigh: '#527694', glBandLow: '#d5e3ee', glBand: .30,
    glRimColor: '#c5d9e9', glRim: .75, glFillColor: '#91b0c8', glBounceColor: '#52718a',
    shadeColor: '#36536d', shade: .22, glInner: .45, glCaustic: .22
  },
  logoLetters: { tint: '#e4edf5', ink: '#36536d' },
  logoDrops: { swirlMetal: 1, swirlMetalVar: 0, swirlHaze: .10 },
  alpineLight: { sunColor: '#e4edf5', rimColor: '#e4edf5', cloudLit: '#e8eef4', cloudShade: '#8098b2', fogColor: '#b8cbdc', valleyHazeColor: '#b8cbdc' },
  watershedWater: { base: '#6888a4', highlight: '#c5d9e9', reflection: .25 },
  watershedFlow: { color: '#7dabc9', coreTint: .24, brightness: .86 },
  worldOcean: { deep: '#344d66', lit: '#799ab5', ink: '#1f344a', foam: '#e4edf5', glintColor: '#e4edf5' },
  logoSeal: { glassTint: '#6d91b4', tileGlowColor: '#91b0c8', tileField: '#10243a' }
  // logoLake and logoMark are out since 2026-11-01: the client chose the closing LOGO and lake of 2026-10-27, from before this pass
};
const marker = '/* WATER_TONE_CHAPTERS_20261028 */';
function patchMain(main) {
  const anchor = '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));';
  if (main.split(anchor).length !== 2) throw Error('Water tone: missing final config anchor');
  // Replace the owned block as its palette evolves; all other presets stay intact.
  const start = main.indexOf('      ' + marker);
  if (start >= 0) {
    const end = main.indexOf(anchor, start);
    if (end < 0) throw Error('Water tone: invalid owned block');
    main = main.slice(0, start) + main.slice(end);
  }
  const lines = Object.entries(TONE_PATCH).map(([group, values]) =>
    `        Object.assign(CONFIG.${group}, ${JSON.stringify(values)});`).join('\n');
  // Snapshot the final palette, so disabling daylight for the world cannot restore warm legacy light.
  main = main.replace(/^      configureSceneDaylight\(CONFIG\);\r?\n/m, '');
  return main.replace(anchor, `      ${marker}
      if (!document.documentElement.hasAttribute('data-opening-refinement')) {
${lines}
      }
      configureSceneDaylight(CONFIG);
${anchor}`);
}
module.exports = ({ main, ...rest }) => ({ main: patchMain(main), ...rest });
module.exports.patchMain = patchMain;
module.exports.TONE_PATCH = TONE_PATCH;
