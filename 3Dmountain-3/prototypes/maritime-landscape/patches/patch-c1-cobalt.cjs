// Colour pass C1 "cobalt" (2026-10-20): deep ultramarine banner and sea, ochre and olive land.
// Default palette of the maritime build; ?look=overcast keeps the grey maritime palette, ?look=original the old page.
// Every replacement asserts one unique anchor. Run from the project root: node prototypes/maritime-landscape/patches/patch-c1-cobalt.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
function edit(rel, pairs) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  for (const [label, find, repl] of pairs) {
    const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
    const n = src.split(f).length - 1;
    if (n !== 1) throw new Error(`${rel} [${label}] anchor found ${n} times`);
    src = src.replace(f, () => r);
  }
  fs.writeFileSync(file, src);
  console.log('patched', rel, pairs.length);
}

edit('prototypes/maritime-landscape/js/main.js', [
  ['flag',
    `    const MARITIME = new URLSearchParams(location.search).get('look') !== 'original';\n`,
    `    const MARITIME = new URLSearchParams(location.search).get('look') !== 'original';
    /* COBALT (colour pass, 2026-10-20): the maritime build's default palette. ?look=overcast keeps
       the first, grey maritime palette for A/B. */
    const COBALT = MARITIME && new URLSearchParams(location.search).get('look') !== 'overcast';
`],
  ['keys',
    `        deep: '#06223d', mid: '#1b3d5c', bed: '#2f4a4c', foam: '#e9eeee', reflect: .85, glint: .35, ripple: .14\n      };`,
    `        deep: '#06223d', mid: '#1b3d5c', bed: '#2f4a4c', foam: '#e9eeee', reflect: .85, glint: .35, ripple: .14,
        /* The banner's light behind the drop (colour × gain) and the tint its edges darken toward. */
        glow: '#fffcf2', glowGain: 1.02, veil: '#8f8f91'
      };`],
  ['preset',
    `        Object.assign(CONFIG.grade, { hue: 0, sat: .97, temp: .06, tint: 0 });\n      }\n      const DEFAULT_CONFIG`,
    `        Object.assign(CONFIG.grade, { hue: 0, sat: .97, temp: .06, tint: 0 });
      }
      if (COBALT) {
        /* Blue carries the frame — night-blue banner, cobalt sea, azure haze over the land — and the
           warm colour lives only on the land: ochre on the sunlit rock, olive scrub, a warm sun. */
        Object.assign(CONFIG.maritime, {
          skyZenith: '#2c5cb6', skyHorizon: '#bcd3ef', fog: '#a6bfe0', aerialFog: '#90afd9',
          sun: '#ffe4bd', sunDay: 3.3, sunAerial: 3.5,
          hemiSky: '#a9c6ee', hemiGround: '#4b3d2f', hemiDay: 1.15, hemiAerial: .95,
          rim: '#d6e6ff', rimDay: .5, rimAerial: .45, ibl: .3,
          rock: '#8a7a68', rockCool: '#5f6878', rockWarm: '#b98a5a', streak: .45,
          veg: '#42583a', vegAmount: .85, vegLine: 820, frost: '#e6dfd0',
          deep: '#061c56', mid: '#173f8e', bed: '#1f7c88', foam: '#eef5ff', reflect: .62, glint: .7,
          glow: '#faf8ff', glowGain: 1.04, veil: '#5c75c7'
        });
        Object.assign(CONFIG.field, { zenith: '#2446a0', upper: '#3a5cb6', top: '#0c1d58', horizon: '#6688dc', lower: '#183684', floor: '#08184a', ink: '#061340', core: 1.05, coreSpread: .55, bandGain: .07 });
        Object.assign(CONFIG.watershedStyle, { rockColor: '#8a7a68', skyColor: '#3f6cc4', mistColor: '#a6bfe0' });
        Object.assign(CONFIG.watershedWater, { base: '#0b3486', highlight: '#a6ccff', reflection: .28 });
        Object.assign(CONFIG.grade, { hue: 0, sat: 1.06, temp: .02, tint: 0 });
        /* The banner's horizon sits higher (200 → 60 px below the lens line), and the bright rail
           moves above the frame, where on a dark sky it read as a grey band along the top. */
        CONFIG.sea.screenDown = 60;
        CONFIG.chrome.railY = .48;
      }
      const DEFAULT_CONFIG`],
  ['apply',
    `          montisEnvUniforms.uEnvGlow.value.set(...(on ? [1.02, 1.01, .97] : [1, 1.03, 1.10]));
          montisVeilUniforms.uVeilTint.value.set(...(on ? [.56, .56, .57] : [.48, .56, .74]));
          document.documentElement.dataset.look = on ? 'maritime' : 'original';`,
    `          if (on) {
            const hex = h => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
            const g = hex(MR.glow), gk = Number.isFinite(+MR.glowGain) ? +MR.glowGain : 1;
            montisEnvUniforms.uEnvGlow.value.set(g[0] * gk, g[1] * gk, g[2] * gk);
            montisVeilUniforms.uVeilTint.value.set(...hex(MR.veil));
          } else {
            montisEnvUniforms.uEnvGlow.value.set(1, 1.03, 1.10);
            montisVeilUniforms.uVeilTint.value.set(.48, .56, .74);
          }
          document.documentElement.dataset.look = on ? 'maritime' : 'original';
          document.documentElement.dataset.palette = COBALT ? 'cobalt' : 'overcast';`],
  ['rows',
    `            ['開場海面也是水', 'maritime', 'heroSea', 0, 1, 1],\n`,
    `            ['開場海面也是水', 'maritime', 'heroSea', 0, 1, 1],
            ['開場核心光色', 'maritime', 'glow'], ['開場核心光強', 'maritime', 'glowGain', 0, 2, .01], ['開場四周暗角色', 'maritime', 'veil'],
`]
]);

edit('index1-3-maritime.html', [
  ['html', `data-look="maritime">`, `data-look="maritime" data-palette="cobalt">`],
  ['preload', `<link rel="modulepreload" href="prototypes/maritime-landscape/js/main.js?v=maritime">`, `<link rel="modulepreload" href="prototypes/maritime-landscape/js/main.js?v=cobalt1">`],
  ['css', `<link rel="stylesheet" href="prototypes/maritime-landscape/maritime.css?v=maritime">`, `<link rel="stylesheet" href="prototypes/maritime-landscape/maritime.css?v=cobalt1">`],
  ['entry', `src="prototypes/maritime-landscape/js/main.js?v=maritime"`, `src="prototypes/maritime-landscape/js/main.js?v=cobalt1"`]
]);
