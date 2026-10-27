/* index1-4 · highland — build (2026-10-22). Run from anywhere: node prototypes/highland-1-4/build.cjs [--force]
   Makes index1-4.html run the highland world WITHOUT touching anything other pages load:
     · copies js/main.js, js/water-logo-drops.js, js/water-logo-letters.js and tuning panels into ./js/
       (the animation copies are built here; shared imports are rewired to ../../../js/, so it
       loads the very same shared files as index1-1)
     · patches the copies with unique-anchor edits (each anchor must match exactly the expected
       number of times, or the build stops and writes nothing)
     · points index1-4.html at the copy and marks it data-look="highland", noindex
   js/ is not in git: this script never writes there. --force re-copies from js/ (losing hand edits). */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), HERE = __dirname, JS = path.join(ROOT, 'js'), OUT = path.join(HERE, 'js');
const force = process.argv.includes('--force'), V = 'hl' + Date.now().toString(36);
const LOCAL = new Set(['water-logo-reference-glass.js', 'water-logo-drops.js', 'water-logo-letters.js', 'water-logo-letters-panel.js', 'finnovation-grade-panel.js', 'highland-scene.js', 'legacy-defaults.js']);
const read = f => fs.readFileSync(f, 'utf8');
function edit(s, from, to, count = 1, label = '') {
  const n = s.split(from).length - 1;
  if (n !== count) { console.error(`anchor ${label || JSON.stringify(from.slice(0, 70))}: found ${n}, expected ${count}`); process.exit(1); }
  return s.split(from).join(to);
}
function editRe(s, re, to, label) {
  const n = (s.match(new RegExp(re.source, 'g')) || []).length;
  if (n !== 1) { console.error(`anchor ${label}: found ${n}, expected 1`); process.exit(1); }
  return s.replace(re, to);
}
function rewire(src) {   // relative imports → shared js/, except the local copies
  return src.replace(/(from\s+|import\(\s*)'\.\/([^'?]+)(\?[^']*)?'/g, (m, pre, file, q) =>
    LOCAL.has(file) ? `${pre}'./${file}?v=${V}'` : `${pre}'../../../js/${file}${q || ''}'`);
}

// ---- main.js -------------------------------------------------------------------------------------
let main = read(path.join(JS, 'main.js'));
main = edit(main, '/* js/main.js (journeyModule)', `/* index1-4 · highland copy of js/main.js (built ${new Date().toISOString().slice(0, 10)} by prototypes/highland-1-4/build.cjs — do not hand-edit, re-run the build).
   Changes: the landscape is the Blender highland world (highland-scene.js) instead of the procedural canyon;
   the opening room (CONFIG.field) and the LOGO drops/letters are recoloured to the highland's overcast sky and
   silver sea; the page grade is neutral; the letters panel stores its own settings. Everything else is index1-1.
   Original header: js/main.js (journeyModule)`, 1, 'header');
main = edit(main, `    const risingLetters = document.documentElement.dataset.letterDirection === 'rising-helix';`,
  `    const risingLetters = document.documentElement.dataset.letterDirection === 'rising-helix';
    /* index1-4 (客戶 2026-10-22：水滴要符合這些風格): a softer core, a slate (not blue-ink) rim, less room haze. */
    const HIGHLAND_DROP_LOOK = { glow: .45, rim: .42, haze: .38 };
    /* index1-4 (客戶 2026-10-22：整體設計風格色調陽光明亮一點): the sunny look is the default; ?look=overcast brings
       back the whole earlier look (landscape, rooms, grade, glass, bloom, page CSS) for comparison. */
    const HL_SUNNY = new URLSearchParams(location.search).get('look') !== 'overcast';
    document.documentElement.toggleAttribute('data-hl-sunny', HL_SUNNY);`, 1, 'risingLetters');
main = edit(main, `          zenith: '#e8eef8', upper: '#eaf0fa', top: '#92a8cd', horizon: '#e6edf7',
          lower: '#c9d5e8', floor: '#93a6c4', ink: '#3f5a7e',`,
  `          /* index1-4: the highland's sky (the drops' room, the opening sea and backdrop all read from here).
             Sunny: a clear blue ceiling matching the landscape's sky, warm white haze, blue-slate ink.
             Overcast (?look=overcast): the earlier pale grey-blue ceiling, silver sea, slate ink. */
          ...(HL_SUNNY ? { zenith: '#5f90c6', upper: '#93b7de', top: '#a9c7e3', horizon: '#eef1ee',
            lower: '#86b4c6', floor: '#2f6d84', ink: '#36506a' }
          : { zenith: '#eef2f3', upper: '#eef2f3', top: '#a7b6bd', horizon: '#eaefee',
            lower: '#cdd7d8', floor: '#98a7ab', ink: '#3e4f57' }),`, 1, 'CONFIG.field');
main = edit(main, `          popSwell: .09, popSpray: .45, fuseKick: .035, fuseTime: 1
        } : {}) },`, `          popSwell: .09, popSpray: .45, fuseKick: .035, fuseTime: 1
        } : {}), ...HIGHLAND_DROP_LOOK },`, 1, 'logoDrops');
main = edit(main, `          fuseSwell: .018, lockFlash: .32
        } : {}) },`, `          fuseSwell: .018, lockFlash: .32
        } : {}), tint: '#f2f5f5', ink: '#4b5d66' },`, 1, 'logoLetters');
main = edit(main, `grade: worldEpilogue ? { ...GRADE_PRESETS['偏藍'] } : { ...GRADE_IDENTITY },`, `grade: HL_SUNNY ? { hue: 0, sat: 1.1, temp: .25, tint: 0 } : { ...GRADE_IDENTITY },   /* index1-4: no blue correction (not purple); sunny: a little warmer and richer (temp above ~.3 turns the canyon sepia) */`, 1, 'grade');
main = edit(main, `          blur: 18, saturate: 1.2, brightness: 1.04, tint: '#e2edf4', fill: 1,`,
  `          blur: 18, ...(HL_SUNNY ? { saturate: 1.45, brightness: 1.08, tint: '#e8f1f7' } : { saturate: 1.2, brightness: 1.04, tint: '#e2edf4' }), fill: 1,   /* index1-4 sunny: clearer glass */`, 1, 'uiGlass');
main = main.replace(/      const canyon = await createJourneySceneAsync\(THREE, \{[^\n]*\}\);\n/, m => {
  if (!m) throw new Error('canyon line');
  return `      /* index1-4: the highland world instead of the procedural canyon (same object shape). */\n      const canyon = await createHighlandSceneAsync(THREE, { lite: DROPLET_LITE, renderer });\n`;
});
if (!main.includes('createHighlandSceneAsync(THREE')) { console.error('canyon call not replaced'); process.exit(1); }
main = edit(main, 'canyon.scene.environment = scene.environment;', 'if (!canyon.ownEnvironment) canyon.scene.environment = scene.environment;', 3, 'environment');
main = edit(main, 'THREE.MathUtils.clamp((p - joinFrom) / (13.8 - joinFrom), 0, 1));', 'THREE.MathUtils.clamp((p - joinFrom) / (13.8 - joinFrom), 0, 1), p);', 1, 'canyon.update');
main = edit(main, `        bloom.threshold = THREE.MathUtils.lerp(bloom.threshold, 1.12, watershedNight);`,
  `        bloom.threshold = THREE.MathUtils.lerp(bloom.threshold, 1.12, watershedNight);
        /* index1-4: the highland sky and its sunlit rock sit above 1.12, so the river-night bloom would veil the
           whole frame in glow; once the highland is on screen only true glints may bloom. */
        if (canyon.ownEnvironment) {
          const on = THREE.MathUtils.clamp(journey.mix, 0, 1);
          /* sunny: the light lines, the sun disc and the water's glints bloom (sky and rock stay under 2.4), a touch
             more exposure; overcast: only the brightest glints */
          if (HL_SUNNY) { bloom.strength *= 1 + .6 * on; bloom.threshold = THREE.MathUtils.lerp(bloom.threshold, 2.4, on); renderer.toneMappingExposure *= 1 + .15 * on; }
          else { bloom.strength *= 1 - .55 * on; bloom.threshold = THREE.MathUtils.lerp(bloom.threshold, 3.5, on); }
        }`, 1, 'bloom');
/* ---- the hero (客戶 2026-10-22：第一區塊水滴 水都沒有融合進去風格裡面; reference index1-3-maritime) — sunny only ----
   · the highland's range stands on the horizon of the opening room: the backdrop draws it, the sea mirrors it and
     the drop reflects it (one function of direction, montisEnv, feeds all three)
   · the opening sea is water, not metal (the maritime build's recipe: dielectric Fresnel over a deep body, the room
     in the reflection, a sun glint), in the highland's teal-blue
   · the drop's dark studio flag is deep sea-teal instead of navy, its light a little warmer, less rainbow film
   · the horizon sits a little higher, so more water shows */
main = edit(main, `        uEnvDropInk: { value: paletteLinear('#22334c') },`,
  `        uEnvDropInk: { value: paletteLinear(HL_SUNNY ? '#284f5c' : '#22334c') },
        /* index1-4: the highland range on the horizon (x on/off, y height in elevation) and its colour */
        uEnvRidge: { value: new THREE.Vector4(HL_SUNNY ? 1 : 0, .046, 0, 0) },
        uEnvRidgeCol: { value: paletteLinear('#5f7d90') },`, 1, 'drop ink');
main = edit(main, `        uEnvGlow: { value: new THREE.Vector3(1.00, 1.03, 1.10) },`,
  `        uEnvGlow: { value: HL_SUNNY ? new THREE.Vector3(1.04, 1.02, .97) : new THREE.Vector3(1.00, 1.03, 1.10) },`, 1, 'env glow');
main = edit(main, `uniform vec3 uEnvCardDir,uEnvDropInk,uEnvKeyDir,uEnvKey;`, `uniform vec3 uEnvCardDir,uEnvDropInk,uEnvKeyDir,uEnvKey;
uniform vec4 uEnvRidge; uniform vec3 uEnvRidgeCol;
/* a mountain profile: one peak per cell at a random place and height, neighbours overlapping */
float hlPeak(float x,float s){ float best=0.; for(int k=-1;k<=1;k++){ float i=floor(x)+float(k);
  float c=i+.25+.5*fract(sin((i+s)*127.1)*43758.5453), hg=.35+.65*fract(sin((i+s)*311.7)*43758.5453);
  best=max(best,hg*max(0.,1.-abs(x-c)*1.9)); } return best; }`, 1, 'env ridge uniforms');
main = edit(main, `  /* An azimuth break, so a mirror-flat trough does not read as a disc. */`,
  `  /* index1-4: the highland on the horizon — a far range of peaks and a nearer, darker one, hazed by distance.
     Their foot reaches below the room's horizon (the sea covers it there), so they stand on the water. */
  if(uEnvRidge.x>0.){
    float raz=atan(d.x,-d.z);
    float re=.0015+b*.04;
    float rh=uEnvRidge.y*(.16+.84*(hlPeak(raz*3.1,1.)*.72+hlPeak(raz*8.3,5.)*.28))+.0012*sin(raz*90.);
    float foot=card>0.?smoothstep(-.02,0.,h):smoothstep(-.14,-.12,h);
    float mist=smoothstep(rh*.85,-.03,h);   // crest clearest, the foot dissolving into the haze over the water
    c=mix(c,mix(uEnvRidgeCol,uEnvHorizon,.42+.5*mist),smoothstep(rh+re,rh-re,h)*foot*uEnvRidge.x);
  }
  /* An azimuth break, so a mirror-flat trough does not read as a disc. */`, 1, 'env ridges');
main = edit(main, `        uWatershedReflection: { value: CONFIG.watershedWater.reflection },`,
  `        uWatershedReflection: { value: CONFIG.watershedWater.reflection },
        /* index1-4: the opening sea as water (x on, y reflectance, z glint) and its body colours */
        uHlWater: { value: new THREE.Vector3(HL_SUNNY ? 1 : 0, 1, .6) },
        uHlDeep: { value: paletteLinear('#1d5d76') }, uHlMid: { value: paletteLinear('#4b95ad') },`, 1, 'hero water uniforms');
main = edit(main, `    uniform float uWatershedReflection;`, `    uniform float uWatershedReflection;
    uniform vec3 uHlWater,uHlDeep,uHlMid;`, 1, 'hero water decl');
main = edit(main, `      vec3 col=montisChrome(nrm,V,vFlow+uSeaCurrent*.35,curv,rough,mask,1.,0.);`,
  `      vec3 col=montisChrome(nrm,V,vFlow+uSeaCurrent*.35,curv,rough,mask,1.,0.);
      /* index1-4: water, not metal (after index1-3-maritime): a dielectric Fresnel over a deep teal body that
         lightens toward grazing, the room (sky, the range, the drop) in the reflection, roughness flattening the
         Fresnel as a ruffled surface does, and the sun's glint. */
      if(uHlWater.x>.001){
        vec3 mR=reflect(-V,nrm);
        vec3 mSky=montisEnv(mR,clamp(rough*1.6,0.,1.),uBandGain*.3,0.);
        float mCos=clamp(dot(nrm,V),0.,1.);
        float mF=.02+.98*pow(1.-mCos,5.);
        mF=mix(mF,.05+mF*.6,clamp(rough*2.5,0.,1.));
        vec3 mw=mix(mix(uHlDeep,uHlMid,pow(1.-mCos,2.)*.75),mSky,clamp(mF*uHlWater.y,0.,1.));
        mw+=uEnvGlow*pow(max(dot(nrm,normalize(uEnvCoreDir+V)),0.),mix(900.,70.,clamp(rough*3.,0.,1.)))*uHlWater.z;
        col=mix(col,mw,uHlWater.x);
      }`, 1, 'hero water');
main = edit(main, `          screenDown: 200,`, `          screenDown: HL_SUNNY ? 120 : 200,   /* index1-4 sunny: a higher horizon, more water */`, 1, 'sea horizon');
main = edit(main, `f0: .94, aniso: .08, streak: 1.55, iris: .58, irisEdge: 1.35,`, `f0: .94, aniso: .08, streak: 1.55, iris: HL_SUNNY ? .30 : .58, irisEdge: 1.35,   /* index1-4 sunny: less rainbow film */`, 1, 'drop iris');
// film grain speckles the clear sunny sky: half of it once the highland is on screen
main = edit(main, `        grainPass.uniforms.uAmount.value = CONFIG.scene.grain * (1 - watershedNight * .88);`,
  `        grainPass.uniforms.uAmount.value = CONFIG.scene.grain * (1 - watershedNight * .88) * (canyon.ownEnvironment && HL_SUNNY ? 1 - .5 * THREE.MathUtils.clamp(journey.mix, 0, 1) : 1);`, 1, 'grain');
main = edit(main, `localStorage.getItem('finnovation-look-v2')`, `localStorage.getItem('finnovation-look-v2:highland-1-4')`, 1, 'look store');
main = rewire(main);
/* optimisation (client 2026-10-22 要壓縮並優化): the procedural canyon is never built on this page, so its modules
   (water-journey-scene-463, water-canyon-watershed-463, water-confluence-fx-463, water-journey-river: ~220 kB of
   JS to fetch, parse and compile) are no longer imported; the six settings objects main still reads come from
   legacy-defaults.js, copied out of those modules verbatim at build time. */
main = editRe(main, /    import \{ createJourneySceneAsync, WATERSHED_STYLE_DEFAULTS, SHORELINE_DEFAULTS, CANYON_VIEW_DEFAULTS, RELIEF_DEFAULTS \} from '[^']+';\n/,
  `    import { createHighlandSceneAsync } from './highland-scene.js?v=${V}';
    import { WATERSHED_STYLE_DEFAULTS, SHORELINE_DEFAULTS, CANYON_VIEW_DEFAULTS, RELIEF_DEFAULTS, WATERSHED_FLOW_DEFAULTS, WATERSHED_TERRAIN_DEFAULTS } from './legacy-defaults.js?v=${V}';\n`, 'scene import');
main = editRe(main, /    import \{ WATERSHED_FLOW_DEFAULTS, WATERSHED_TERRAIN_DEFAULTS \} from '[^']+';\n/, '', 'watershed import');
main = editRe(main, /    import \{ createJourneyRiver \} from '[^']+';\n/, '', 'river import');
if (/\bcreateJourney(SceneAsync|River)\s*\(|water-(journey-scene|canyon-watershed|confluence-fx)-463|water-journey-river/.test(main)) { console.error('main still reaches the legacy canyon'); process.exit(1); }

// ---- legacy-defaults.js: the six settings objects, cut out of the shared modules (bracket-matched, then checked) ----
const DEFAULTS = [['water-journey-scene-463.js', ['WATERSHED_STYLE_DEFAULTS', 'SHORELINE_DEFAULTS', 'RELIEF_DEFAULTS', 'CANYON_VIEW_DEFAULTS']],
  ['water-confluence-fx-463.js', ['WATERSHED_FLOW_DEFAULTS']], ['water-canyon-watershed-463.js', ['WATERSHED_TERRAIN_DEFAULTS']]];
let legacy = `/* index1-4 · settings objects of index1-1's procedural canyon (built by prototypes/highland-1-4/build.cjs from the
   shared modules named below — do not hand-edit). main.js only reads them; the canyon itself is not loaded here. */\n`;
for (const [file, names] of DEFAULTS) {
  const src = read(path.join(JS, file));
  for (const name of names) {
    const head = `export const ${name} = Object.freeze(`, at = src.indexOf(head);
    if (at < 0 || src.indexOf(head, at + 1) >= 0) { console.error(`${file}: ${name} not found exactly once`); process.exit(1); }
    let i = at + head.length, depth = 1, quote = null;
    for (; i < src.length && depth; i++) {
      const ch = src[i];
      if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`') quote = ch; else if (ch === '(') depth++; else if (ch === ')') depth--;
    }
    const body = src.slice(at + head.length, i - 1);
    try { new Function(`return (${body});`)(); } catch (e) { console.error(`${name} is not self-contained: ${e.message}`); process.exit(1); }
    legacy += `// from js/${file}\nexport const ${name} = Object.freeze(${body});\n`;
  }
}

// ---- the drops: the highland's water ------------------------------------------------------------
let drops = read(path.join(JS, 'water-logo-drops.js'));
drops = `/* index1-4 · highland copy of js/water-logo-drops.js (built by prototypes/highland-1-4/build.cjs).
   Only colours change: a neutral, slightly cool absorption instead of the cyan cast, a little more
   reflectance (the silver sea's), and a neutral studio gloss instead of a warm one. */\n` + drops;
drops = edit(drops, 'exp(-vec3(.20,.075,.018)*uAbsorb*path*2.)', 'exp(-vec3(.13,.095,.075)*uAbsorb*path*2.)', 1, 'absorb drop');
drops = edit(drops, 'exp(-vec3(.20,.075,.018)*uAbsorb*s)', 'exp(-vec3(.13,.095,.075)*uAbsorb*s)', 1, 'absorb bead');
drops = edit(drops, 'float fresnel=.02+.98*pow(1.-NdV,5.);', 'float fresnel=.04+.96*pow(1.-NdV,5.);', 2, 'F0');
drops = edit(drops, 'col+=vec3(1.,.985,.96)*beadGloss(R)', 'col+=vec3(.97,.985,1.)*beadGloss(R)', 1, 'gloss');
// the highland in every drop: a distant range of slate ridges along the room's horizon, softened by haze
drops = edit(drops, `    vec3 c=mix(sea,sky,smoothstep(-.015,.015,h));
    float core=max(dot(R,normalize(vec3(0.,.08,-1.))),0.);`, `    vec3 c=mix(sea,sky,smoothstep(-.015,.015,h));
    {
      float az=atan(R.x,-R.z);
      float ridge=.035+.03*sin(az*3.1+.6)+.018*sin(az*7.3+1.9)+.009*sin(az*17.+.4)+.004*sin(az*41.+2.2);
      float land=smoothstep(ridge+.004,ridge-.004,h)*smoothstep(-.03,.0,h);
      c=mix(c,mix(uRoomInk,uRoomHorizon,.52+.22*smoothstep(-.02,ridge,h)),land*.78);
    }
    float core=max(dot(R,normalize(vec3(0.,.08,-1.))),0.);`, 1, 'roomEnv ridges');

// ---- the letters panel: its own storage, so index1-1's tuning never lands here ----------------
let panel = `/* index1-4 · highland copy of js/water-logo-letters-panel.js (built by prototypes/highland-1-4/build.cjs): only its storage key differs. */\n` + read(path.join(JS, 'water-logo-letters-panel.js'));
panel = edit(panel, `'finnovation:letters-panel:rising-helix:v1' : 'finnovation:letters-panel:v1'`, `'finnovation:letters-panel:highland-1-4:v1' : 'finnovation:letters-panel:highland-1-4-plain:v1'`, 1, 'panel store');

// ---- the C panel (色調/霧/影片/山景): its own storage too (QA: a preset chosen on index1-1 loaded here) ----
let grade = `/* index1-4 · highland copy of js/finnovation-grade-panel.js (built by prototypes/highland-1-4/build.cjs): only its storage keys differ. */\n` + read(path.join(JS, 'finnovation-grade-panel.js'));
grade = edit(grade, `const KEY = 'finnovation-look-v2', V1_KEY = 'finnovation-look-v1', OLD_KEY = 'finnovation-grade-v1';`,
  `const KEY = 'finnovation-look-v2:highland-1-4', V1_KEY = 'finnovation-look-v1:highland-1-4', OLD_KEY = 'finnovation-grade-v1:highland-1-4';`, 1, 'grade keys');
grade = rewire(grade);

main = require('./confluence-build.cjs')(main);
let letters = read(path.join(JS, 'water-logo-letters.js'));
({ main, drops, letters } = require('./free-helix-build.cjs')({ main, drops, letters }));
let glass = read(path.join(JS,'water-logo-reference-glass.js'));
({main,letters,glass}=require('./liquid-wordmark-build.cjs')({main,letters,glass}));
glass='/* index1-4 liquid wordmark — generated by build.cjs */\n'+rewire(glass);

letters = '/* index1-4 independent rising letters — generated by build.cjs */\n' + letters;
letters = rewire(letters);

// ---- write ------------------------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
for (const [name, text] of [['main.js', main], ['water-logo-reference-glass.js', glass], ['water-logo-drops.js', drops], ['water-logo-letters.js', letters], ['water-logo-letters-panel.js', panel], ['finnovation-grade-panel.js', grade], ['legacy-defaults.js', legacy]]) {
  const f = path.join(OUT, name);
  if (fs.existsSync(f) && !force && !read(f).includes('build.cjs')) { console.error(`${name} exists and was not made by this build; use --force`); process.exit(1); }
  fs.writeFileSync(f, text);
}

// ---- the page ---------------------------------------------------------------------------------
const pageFile = path.join(ROOT, 'index1-4.html');
let page = read(pageFile);
page = page.replace(/(js\/main\.js|prototypes\/highland-1-4\/js\/main\.js)\?v=[0-9a-z]+/g, `prototypes/highland-1-4/js/main.js?v=${V}`);
if ((page.match(/prototypes\/highland-1-4\/js\/main\.js/g) || []).length !== 2) { console.error('page: expected the modulepreload and the script to point at main.js'); process.exit(1); }
if (!page.includes('data-look="highland"')) page = edit(page, 'data-landscape="1010">', 'data-landscape="1010" data-look="highland">', 1, 'html flags');
page = page.replace('<meta name="robots" content="index, follow, max-image-preview:large">', '<meta name="robots" content="noindex, nofollow">');
page = page.replace(/\n  <link rel="stylesheet" href="prototypes\/highland-1-4\/highland\.css\?v=[0-9a-z]+">/, '');
page = edit(page, '<link rel="stylesheet" href="css/glass-refinement.css?v=795411628b">', `<link rel="stylesheet" href="css/glass-refinement.css?v=795411628b">\n  <link rel="stylesheet" href="prototypes/highland-1-4/highland.css?v=${V}">`, 1, 'css link');
if (!page.includes('Highland 測試')) page = page.replace('<title>恒灝創新 FINNOVATION｜科技賦能・金融加值</title>', '<title>Highland 測試｜恒灝創新 FINNOVATION</title>');
fs.writeFileSync(pageFile, page);
console.log('built', V, '— main.js, water-logo-drops.js, water-logo-letters-panel.js, finnovation-grade-panel.js, legacy-defaults.js → prototypes/highland-1-4/js/; index1-4.html points at the copy');
