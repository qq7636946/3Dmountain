// EVEREST COLOUR COPY, pass E1 "Ascent" (2026-10-22): night blue and champagne gold under one low sun.
// Adds snow on the high ground (terrain-texture-detail.js), the ASCENT palette as this copy's default
// (?look=everest = the copied Everest state, ?look=highland, ?look=textured-blue … as before), and wires
// the snow and the film grade. Every replacement asserts one unique anchor. Run from the project root.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, 'js');
function edit(name, pairs) {
  const file = path.join(dir, name);
  let src = fs.readFileSync(file, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  for (const [label, find, repl] of pairs) {
    const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
    const n = src.split(f).length - 1;
    if (n !== 1) throw new Error(`${name} [${label}] anchor found ${n} times`);
    src = src.replace(f, () => r);
  }
  fs.writeFileSync(file, src);
  console.log('patched', name, pairs.length);
}

edit('terrain-texture-detail.js', [
  ['uniforms',
    `    uTerrainEverest: { value: everest ? 1 : 0 }
  };`,
    `    uTerrainEverest: { value: everest ? 1 : 0 },
    /* ASCENT snow: x amount, y line (world y), z softness, w how steep a face still holds it. */
    uTerrainSnow: { value: new THREE.Vector4(0, 380, 180, .5) },
    uTerrainSnowColour: { value: new THREE.Vector3(.84, .87, .92) }
  };`],
  ['decl',
    `uniform float uTerrainTextureReady,uTerrainHighland,uTerrainEverest;\n`,
    `uniform float uTerrainTextureReady,uTerrainHighland,uTerrainEverest;
uniform vec4 uTerrainSnow;
uniform vec3 uTerrainSnowColour;
`],
  ['snow',
    `    txAlbedo=mix(stoneColour,turfColour*clamp(grassL/.22,.45,1.55),turf);
    txHeath=turf;
  }`,
    `    txAlbedo=mix(stoneColour,turfColour*clamp(grassL/.22,.45,1.55),turf);
    txHeath=turf;
  }
  if(uTerrainSnow.x>.001){
    // ASCENT: snow on the high ground, broken by the rock's own broad sheets and a slow noise, held by
    // the flatter faces. The low sun turns it gold and the sky turns its shade blue; no colour is painted.
    float snowN=rockNoise(txP*vec3(.018,.026,.018)+7.)*.6+dot(txBroad,vec3(.3333))*.4;
    float snowH=smoothstep(uTerrainSnow.y-uTerrainSnow.z,uTerrainSnow.y+uTerrainSnow.z,txP.y+(snowN-.5)*uTerrainSnow.z*1.8);
    float snowS=smoothstep(.62-uTerrainSnow.w*.5,.92-uTerrainSnow.w*.3,txWorldN.y+(snowN-.5)*.25);
    float snowK=clamp(snowH*snowS*uTerrainSnow.x,0.,1.);
    txAlbedo=mix(txAlbedo,uTerrainSnowColour*mix(.86,1.04,snowN),snowK);
    txHeath*=1.-snowK;
  }`],
  ['return',
    `  return { status, ready, install, dispose() {`,
    `  return { status, ready, install, uniforms, dispose() {`]
]);

edit('main.js', [
  ['flag',
    `    document.documentElement.dataset.terrainMood = EVEREST ? 'everest' : HIGHLAND ? 'highland' : 'previous';`,
    `    document.documentElement.dataset.terrainMood = EVEREST ? 'everest' : HIGHLAND ? 'highland' : 'previous';
    /* ASCENT (this copy's default, 2026-10-22): night blue and champagne gold under one low sun, snow on
       the heights, a film grade. ?look=everest shows the copied Everest state for A/B. */
    const ASCENT = EVEREST && new URLSearchParams(location.search).get('look') !== 'everest';
    if (ASCENT) document.documentElement.dataset.grade = 'ascent';`],
  ['snow-keys',
    `        glow: '#fffcf2', glowGain: 1.02, veil: '#8f8f91'
      };`,
    `        glow: '#fffcf2', glowGain: 1.02, veil: '#8f8f91',
        /* Snow on the high ground (textured terrain only): amount, line (world y), softness, slope hold. */
        snow: 0, snowLine: 380, snowSoft: 180, snowSlope: .5, snowColour: '#eef2f8'
      };`],
  ['palette',
    `        Object.assign(CONFIG.grade, { hue: 0, sat: .93, temp: .015, tint: 0 });
        CONFIG.scene.grain = .012;
      }`,
    `        Object.assign(CONFIG.grade, { hue: 0, sat: .93, temp: .015, tint: 0 });
        CONFIG.scene.grain = .012;
      }
      if (ASCENT) {
        /* Blue hour over the sea, golden hour in the mountains: one low sun, shade the colour of the sky,
           snow that takes the light, champagne gold as the only accent. */
        Object.assign(CONFIG.field, { zenith: '#17305f', upper: '#22417e', top: '#081530', horizon: '#3a5a96', lower: '#2c4888', floor: '#152c5e', ink: '#0c1c44', core: .9, coreSpread: .5, bandGain: .05 });
        Object.assign(CONFIG.maritime, {
          skyZenith: '#14244e', skyHorizon: '#e9b878', fog: '#5f6a8c', aerialFog: '#6b7697',
          sun: '#ffcf8f', sunDay: 5.0, sunAerial: 5.2, hemiSky: '#5d72a6', hemiGround: '#2e2a26', hemiDay: .55, hemiAerial: .5,
          rim: '#ffd29a', rimDay: .6, rimAerial: .55, ibl: .22, vegAmount: .35,
          deep: '#03102e', mid: '#0c2a62', bed: '#164a6a', foam: '#e9edf2', reflect: .7, glint: .9, ripple: .14,
          glow: '#fff1d8', glowGain: .95, veil: '#3a4f86',
          snow: .9, snowLine: 380, snowSoft: 180, snowSlope: .5, snowColour: '#eef2f8'
        });
        Object.assign(CONFIG.horizon, { islands: 0, clouds: .3, cloudColour: .25, cloudTint: '#ffe3b5', glow: .25, glowColour: '#ffb04a',
          glowHeight: -.008, glowWidth: .007, glowSpread: 40, canyonClouds: .45, canyonGlow: .5, sat: .8 });
        Object.assign(CONFIG.watershedStyle, { rockColor: '#6e675f', skyColor: '#2a4a8a', mistColor: '#5f6a8c' });
        Object.assign(CONFIG.watershedWater, { base: '#163a6a', highlight: '#e8d2a8', reflection: .34 });
        Object.assign(CONFIG.watershedFlow, { color: '#ffd38a', brightness: .7 });
        Object.assign(CONFIG.grade, { hue: 0, sat: .98, temp: 0, tint: 0 });
        Object.assign(CONFIG.film, { amount: 1, contrast: .22, shadow: '#26375e', shadowAmt: .16, high: '#ffd49a', highAmt: .2, lift: .012, vignette: .34, vignetteSoft: .75 });
      }`],
  ['snow-frame',
    `          canyonSkyU.uCloudA.value.w = (performance.now() / 1000 * (+CONFIG.horizon.cloudDrift || 0)) % 2;`,
    `          canyonSkyU.uCloudA.value.w = (performance.now() / 1000 * (+CONFIG.horizon.cloudDrift || 0)) % 2;
          {
            const tu = canyon.textureDetail?.uniforms, MR = CONFIG.maritime;
            if (tu?.uTerrainSnow) {
              tu.uTerrainSnow.value.set(Math.max(0, +MR.snow || 0), +MR.snowLine || 380, Math.max(1, +MR.snowSoft || 180), +MR.snowSlope || 0);
              const sc = new THREE.Color(MR.snowColour || '#eef2f8');
              tu.uTerrainSnowColour.value.set(sc.r, sc.g, sc.b);
            }
          }`],
  ['rows',
    `            ['開場核心光色', 'maritime', 'glow'],`,
    `            ['山頂積雪', 'maritime', 'snow', 0, 1.5, .01], ['雪線高度', 'maritime', 'snowLine', 0, 1500, 5],
            ['雪線柔和', 'maritime', 'snowSoft', 10, 600, 5], ['陡坡留雪', 'maritime', 'snowSlope', 0, 1, .01], ['雪色', 'maritime', 'snowColour'],
            ['開場核心光色', 'maritime', 'glow'],`]
]);
