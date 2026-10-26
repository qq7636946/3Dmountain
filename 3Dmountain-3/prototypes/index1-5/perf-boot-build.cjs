/* index1-5 optimisation team (2026-10-25), stream "boot" (first half, 2026-10-26).
   Anchored patches on the GENERATED text, run by build.cjs (PERF_ONLY=boot builds only this file).
   Desktop picture must stay identical. Each item is guarded on its own: an item whose anchor is not found is
   skipped with a line "perf-boot: ITEM SKIPPED …" and the rest still applies.
   Items (audit ids in .qa/index1-5/perf-audit-results.json, index 0):
     duplicate-module-instances   water-journey-story.js was imported with two ?v= strings (two instances)
     lazy-boot-modules            GLTFLoader only for ?orb=mesh; logo-panel.js only where the panel can mount
                                  (same host/flag test as logo-panel.js); tuft-atlas.webp only where tufts can exist
     terrain-early-start          the nine terrain maps start at startJourneyScene() entry (same cached set)
     gsap-unused                  the world never reaches the GSAP branch (sectionMotion is always truthy)
     section-two-dead             .section-two is fixed, opacity forced to 0 each journey frame: display:none
     modulepreload-graph          one <link rel=modulepreload> per module of the static boot graph (computed here
                                  from the import text; local ones take main.js's ?v= at run time, see the inline script)
     stone-normal idle slices     createReferenceLogoGlass's stoneNormalTexture() in idle slices, same bytes
   Helper contract: ({main,drops,letters,glass,html,extra,journey,watershed,ui}) => the same (+ extra:{file:source}). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'js'), SHARED = path.join(ROOT, 'js');
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const log = (...a) => console.log('perf-boot:', ...a);

/* exact anchor: must occur once */
function must(src, anchor, replacement) {
  const n = src.split(anchor).length - 1;
  if (n !== 1) throw new Error(`anchor found ${n}x: ${anchor.slice(0, 90)}`);
  return src.replace(anchor, () => replacement);
}
/* run one item; on failure keep the state as it was */
function item(name, S, fn) {
  // bisecting only: PERF_BOOT_SKIP=word,word leaves items whose name contains a word out of the build (unset = all items)
  const skip = (process.env.PERF_BOOT_SKIP || '').split(',').map(s => s.trim()).filter(Boolean);
  if (skip.some(w => name.includes(w))) { log('left out (PERF_BOOT_SKIP)', name); return S; }
  try { const r = fn(S); log('applied', name); return r; }
  catch (e) { log('ITEM SKIPPED', name, '-', (e && e.message) || e); return S; }
}

/* ---------- module-graph preload data ---------- */
// three@0.170.0 examples/jsm closure of the addons the static boot graph imports (GLTFLoader is dynamic only, not listed).
// Generated from the live CDN sources by .qa/index1-5/perf-boot/cdn-walk.cjs (2026-10-26).
const ADDON_DEPS = {
  'loaders/SVGLoader.js': [],
  'utils/BufferGeometryUtils.js': [],
  'objects/Water.js': [],
  'objects/MarchingCubes.js': [],
  'postprocessing/Pass.js': [],
  'postprocessing/ShaderPass.js': ['postprocessing/Pass.js'],
  'postprocessing/MaskPass.js': ['postprocessing/Pass.js'],
  'postprocessing/EffectComposer.js': ['shaders/CopyShader.js', 'postprocessing/ShaderPass.js', 'postprocessing/MaskPass.js'],
  'postprocessing/RenderPass.js': ['postprocessing/Pass.js'],
  'postprocessing/UnrealBloomPass.js': ['postprocessing/Pass.js', 'shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js'],
  'postprocessing/OutputPass.js': ['postprocessing/Pass.js', 'shaders/OutputShader.js'],
  'shaders/CopyShader.js': [],
  'shaders/LuminosityHighPassShader.js': [],
  'shaders/OutputShader.js': [],
};
const ADDON_BASE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/';
const IMPORT_RE = /(import\s+(?:[^'"()]*?\s+from\s+)?|export\s+[^'"]*?\s+from\s+|import\(\s*)(['"])([^'"]+)\2/g;

/* static graph from the module texts this build will write (memory first, else the last build's file) */
function bootPreloadLists(S) {
  // build.cjs applies section-motion-build's patchUI to the interface module AFTER the helpers run (it adds the
  // section-motion import), so the walk applies the same pure transform to see the imports the page really gets.
  let uiFinal = S.ui;
  try { uiFinal = require('./section-motion-build.cjs').patchUI(S.ui); } catch (e) { log('patchUI not applied for the walk:', e.message); }
  const MEM = { 'main.js': S.main, 'water-journey-scene-463.js': S.journey, 'water-canyon-watershed-463.js': S.watershed,
    'water-logo-drops.js': S.drops, 'water-logo-letters.js': S.letters, 'water-logo-reference-glass.js': S.glass,
    'finnovation-interface.js': uiFinal, ...S.extra };
  const textOf = name => (name in MEM ? MEM[name] : read(path.join(OUT, name)));
  const locals = [], shared = [], addons = [], warn = [], seen = new Set(), queue = [[path.join(OUT, 'main.js'), S.main]];
  const pushOnce = (list, v) => { if (!list.includes(v)) list.push(v); };
  while (queue.length) {
    const [file, text] = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(text))) {
      if (m[1].startsWith('import(')) continue;                       // dynamic: not part of the boot graph
      const spec = m[3], bare = spec.split('?')[0], query = spec.includes('?') ? '?' + spec.split('?').slice(1).join('?') : '';
      if (spec === 'three') continue;                                  // core: already preloaded in index1-5.html
      if (spec.startsWith('three/addons/')) {
        const name = bare.slice('three/addons/'.length);
        if (!(name in ADDON_DEPS)) { warn.push('addon not in table: ' + name); continue; }
        const walk = n => { pushOnce(addons, ADDON_BASE + n); for (const d of ADDON_DEPS[n]) walk(d); };
        walk(name);
        continue;
      }
      if (/^https?:/.test(spec)) continue;
      const importerIsLocal = file.startsWith(OUT + path.sep);
      // build.cjs rewires './x' to a local module (?v=version) when x is one of its local modules, else to '../../../js/x' + query.
      // Local modules are the ones this build writes: names in memory or already in the output folder.
      const localName = bare.startsWith('./') && importerIsLocal ? bare.slice(2) : null;
      const isLocal = localName !== null && (localName in MEM || fs.existsSync(path.join(OUT, localName)));
      if (isLocal) {
        const resolved = path.join(OUT, localName);
        if (localName !== 'main.js') pushOnce(locals, localName);
        if (!seen.has(resolved)) {
          try { queue.push([resolved, textOf(localName)]); } catch (e) { warn.push('unreadable ' + localName); }
        }
        continue;
      }
      const resolved = bare.startsWith('./') ? path.join(SHARED, bare.slice(2)) : path.resolve(path.dirname(file), bare);
      if (resolved.startsWith(SHARED + path.sep)) {
        const rel = path.relative(SHARED, resolved).split(path.sep).join('/');
        pushOnce(shared, 'js/' + rel + query);
        if (!seen.has(resolved)) {
          try { queue.push([resolved, read(resolved)]); } catch (e) { warn.push('unreadable shared ' + rel); }
        }
      } else warn.push('outside known roots: ' + spec);
    }
  }
  return { locals, shared, addons, warn };
}

/* the inline script: runs while the head is parsed, after the import map and main.js's modulepreload */
function preloadBlock(lists) {
  const data = JSON.stringify({ locals: lists.locals, shared: lists.shared, addons: lists.addons });
  return [
    '  <!--perf-boot:begin-->',
    '  <script>',
    '  /* perf-boot (2026-10-26): the static module graph of index1-5, one modulepreload per module (computed at build time).',
    '     Local modules take the ?v= of main.js so they match the import URLs exactly (build.cjs stamps them all with one version). */',
    '  (function(){try{',
    '    var mainLink=document.querySelector(\'link[rel="modulepreload"][href*="js/main.js"]\');',
    '    var v=mainLink?mainLink.getAttribute("href").split("?")[1]:"";',
    '    var graph=' + data + ';',
    '    function add(href){var l=document.createElement("link");l.rel="modulepreload";l.href=href;document.head.appendChild(l);}',
    '    if(v)graph.locals.forEach(function(n){add("prototypes/index1-5/js/"+n+"?"+v);});',
    '    graph.shared.forEach(function(u){add(u);});',
    '    graph.addons.forEach(function(u){add(u);});',
    '  }catch(e){}})();',
    '  </script>',
    '  <!--perf-boot:end-->',
  ].join('\n') + '\n';
}

/* ---------- items ---------- */
function storyQuery(S) {
  // finnovation-interface.js imported water-journey-story.js with its own ?v=; main.js uses this one (one module instance)
  const before = S.ui;
  S.ui = S.ui.replace(/water-journey-story\.js\?v=story-perf-20261004/g, () => 'water-journey-story.js?v=index463-scroll-20261004-78fa788ddc');
  log('story query aligned', before !== S.ui ? 'yes' : 'already');
  return S;
}

function gltfOnDemand(S) {
  S.main = must(S.main, "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';", '/* GLTFLoader: imported only for ?orb=mesh (perf-boot) */');
  S.main = must(S.main, 'const gltfLoader = new GLTFLoader(assetManager);',
    "const gltfLoader = new URLSearchParams(location.search).get('orb') === 'mesh' || !dropSDF ? new (await import('three/addons/loaders/GLTFLoader.js')).GLTFLoader(assetManager) : null;");
  return S;
}

function logoPanelOnDemand(S) {
  // logo-panel.js mounts only on localhost / *.localhost / *.test or with ?logopanel (the same test as inside mountLogoPanel)
  const LP_IMPORT = /import \{ mountLogoPanel \} from '\.\/logo-panel\.js[^']*';/g;
  if ((S.main.match(LP_IMPORT) || []).length !== 1) throw new Error('logo-panel import count is not 1');
  S.main = S.main.replace(LP_IMPORT, () => '/* logo-panel: imported only where the panel can mount (perf-boot) */');
  S.main = must(S.main, 'mountLogoPanel({ config: CONFIG, defaults: DEFAULT_CONFIG, sections:',
    String.raw`if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname) || /\.(localhost|test)$/.test(location.hostname) || new URLSearchParams(location.search).get('logopanel') !== null) import('./logo-panel.js').then(({ mountLogoPanel }) => mountLogoPanel({ config: CONFIG, defaults: DEFAULT_CONFIG, sections:`);
  S.main = must(S.main, 'onChange: () => syncWorkshop() });', 'onChange: () => syncWorkshop() })).catch(() => { });');
  return S;
}

function terrainEarlyStart(S) {
  S.main = must(S.main, "import { createJourneySceneAsync,",
    "import { preloadIndex15Terrain } from './index1-5-terrain.js';\n    import { createJourneySceneAsync,");
  S.main = must(S.main, 'async function startJourneyScene() {',
    "async function startJourneyScene() {\n      /* perf-boot terrain-early-start: the nine terrain maps start with the page script (same cached set createJourneySceneAsync awaits). */\n      const i15TerrainReady = preloadIndex15Terrain(THREE, matchMedia('(max-width: 720px), (pointer: coarse)').matches);\n      i15TerrainReady.catch(() => { });");
  return S;
}

function tuftAtlasOnDemand(S) {
  // index1-5-terrain.js is a hand-kept module that build.cjs re-reads from the output folder: patch it once (marker keeps it idempotent)
  let text = S.extra['index1-5-terrain.js'] || read(path.join(OUT, 'index1-5-terrain.js'));
  if (!text.includes('perf-boot tuft-atlas')) {
    text = must(text, "load('alpineTuft',new URL('tuft-atlas.webp',alp).href,false);",
      "/* perf-boot tuft-atlas: only createCanyonTufts reads this map, and it returns null on index1-5 (same predicate). */ if (!(typeof document !== 'undefined' && document.documentElement.matches('[data-look=\"index1-5\"]:not([data-opening-refinement])'))) load('alpineTuft',new URL('tuft-atlas.webp',alp).href,false);");
  }
  S.extra = { ...S.extra, 'index1-5-terrain.js': text };
  return S;
}

function gsapOff(S) {
  const key = 'finnovation-world.js';
  if (!S.extra[key]) throw new Error('finnovation-world.js not in extra');
  S.extra = { ...S.extra, [key]: must(S.extra[key], 'const motion = reducedMotion ? Promise.resolve() : Promise.all([import(GSAP_URL)',
    'const motion = reducedMotion || sectionMotion ? Promise.resolve() : Promise.all([import(GSAP_URL)') };
  return S;
}

const IDLE_STONE_NORMAL = String.raw`function stoneNormalTextureIdle(size = 512) {
  /* perf-boot: stoneNormalTexture() in idle slices. The same formulas in the same order, so the same bytes; the DataTexture
     exists at once as a flat 1x1 placeholder (the uniform keeps this object) and gets its image when the last slice lands. */
  const tiles = Math.max(1, Math.round(6 * RK.reliefScale));
  const relTiles = RK.tiles, relGrain = RK.grain, relSwell = RK.swell;
  const hash2 = (x, y, k) => { const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
  const h = new Float32Array(size * size);
  const data = new Uint8Array(size * size * 4), kk = 2.4 * size / 64;
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  const job = { cancelled: false, done: false, force: false };
  normalJob = job;
  const idleSlot = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => fn(), { timeout: 40 }) : setTimeout(fn, 4));
  let phase = 0, row = 0;
  const slice = () => {
    if (job.cancelled || job.done) return;
    const until = performance.now() + (job.force ? Infinity : 5);
    if (phase === 0) {
      for (; row < size && performance.now() < until; row++) {
        const j = row;
        for (let i = 0; i < size; i++) {
          const px = i / size * tiles, py = j / size * tiles;
          const ix = Math.floor(px), iy = Math.floor(py);
          let f1 = 9, f2 = 9;
          for (let gy = -1; gy <= 1; gy++) for (let gx = -1; gx <= 1; gx++) {
            const cx = ((ix + gx) % tiles + tiles) % tiles, cy = ((iy + gy) % tiles + tiles) % tiles;
            const dx = ix + gx + hash2(cx, cy, 1) - px, dy = iy + gy + hash2(cx, cy, 2) - py;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          }
          const bevel = Math.min(1, (f2 - f1) / .09);
          const grain = jsFbm(px * 5.3, py * 5.3, 1.7, 3) - .5;
          const swell = jsFbm(px * .55, py * .55, 2.9, 3) - .5;
          h[j * size + i] = bevel * (.7 + .3 * hash2(ix, iy, 3)) * .8 * relTiles + grain * relGrain + (jsNoise(px * 1.7, py * 1.7, 4.2) - .5) * .2 + swell * relSwell;
        }
      }
      if (row >= size) { phase = 1; row = 0; }
    } else {
      for (; row < size && performance.now() < until; row++) {
        const j = row;
        for (let i = 0; i < size; i++) {
          const l = h[j * size + ((i - 1 + size) % size)], r = h[j * size + ((i + 1) % size)];
          const u = h[((j - 1 + size) % size) * size + i], d = h[((j + 1) % size) * size + i];
          let nx = -(r - l) * kk, ny = -(d - u) * kk, nz = 1;
          const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
          const o = (j * size + i) * 4;
          data[o] = (nx * .5 + .5) * 255; data[o + 1] = (ny * .5 + .5) * 255; data[o + 2] = (nz * .5 + .5) * 255; data[o + 3] = 255;
        }
      }
      if (row >= size) {
        // a fresh texture, not a resized placeholder: WebGL keeps the 1x1 storage once it was uploaded, so the swap is the
        // same as stoneNormalTexture()'s own rebake (uniform value + dispose the old one)
        const fin = new THREE.DataTexture(data, size, size);
        fin.wrapS = fin.wrapT = THREE.RepeatWrapping;
        fin.generateMipmaps = true; fin.minFilter = THREE.LinearMipmapLinearFilter; fin.magFilter = THREE.LinearFilter;
        fin.needsUpdate = true;
        const old = normalMap;
        normalMap = fin; uniforms.uNormalMap.value = fin; old.dispose();
        job.done = true;
        if (normalJob === job) normalJob = null;
        return;
      }
    }
    if (!job.force) idleSlot(slice);
  };
  job.finish = () => { if (job.done || job.cancelled) return; job.force = true; while (!job.done && !job.cancelled) slice(); };
  idleSlot(slice);
  return t;
}
`;

function stoneNormalSlices(S) {
  S.glass = must(S.glass, '  let normalMap=stoneNormalTexture();', '  let normalJob=null;let normalMap=stoneNormalTextureIdle();');
  S.glass = must(S.glass, 'function stoneNormalTexture(size = 512) {', IDLE_STONE_NORMAL + 'function stoneNormalTexture(size = 512) {');
  S.glass = must(S.glass, 'const old=normalMap;normalMap=stoneNormalTexture();', 'const old=normalMap;if(normalJob)normalJob.cancelled=true;normalMap=stoneNormalTexture();');
  S.glass = must(S.glass, 'function update({palette,opacity=1,time=0,reducedMotion=false,sun=null}={}){', 'function update({palette,opacity=1,time=0,reducedMotion=false,sun=null}={}){ if(normalJob&&uniforms.uOpacity&&uniforms.uOpacity.value>0)normalJob.finish();');
  return S;
}

function sectionTwoOff(S) {
  // .section-two is position:fixed (out of flow), and main.js writes opacity 0 and drops is-active/is-live/is-in on every
  // journey frame, so it is never painted on index1-5: display:none removes its layers and its 7 blurred clouds' animations
  let html = S.html.replace(/[ \t]*<!--perf-boot-s2:begin-->[\s\S]*?<!--perf-boot-s2:end-->[ \t]*\n?/, '');
  html = must(html, '</head>', '  <!--perf-boot-s2:begin-->\n  <style id="perf-boot-section-two">html[data-look="index1-5"] .section-two{display:none!important}</style>\n  <!--perf-boot-s2:end-->\n</head>');
  S.html = html;
  return S;
}

function preloadGraph(S) {
  // main.js's modulepreload link is the anchor: the block goes right after it (the import map is above it, as the page requires)
  const MAIN_LINK = /<link rel="modulepreload" href="(?:js\/|prototypes\/index1-5\/js\/)main\.js[^"]*">[ \t]*\n?/;
  let html = S.html.replace(/[ \t]*<!--perf-boot:begin-->[\s\S]*?<!--perf-boot:end-->[ \t]*\n?/, '');
  if (!MAIN_LINK.test(html)) throw new Error('main.js modulepreload link not found');
  const lists = bootPreloadLists(S);
  if (lists.warn.length) log('graph warnings:', lists.warn.join(' | '));
  log('graph: ' + lists.locals.length + ' local, ' + lists.shared.length + ' shared, ' + lists.addons.length + ' three addons');
  const block = preloadBlock(lists);
  S.html = html.replace(MAIN_LINK, m => (m.endsWith('\n') ? m : m + '\n') + block);
  return S;
}

module.exports = ({ main, drops, letters, glass, html, extra, journey, watershed, ui }) => {
  let S = { main, drops, letters, glass, html, extra: { ...(extra || {}) }, journey, watershed, ui };
  S = item('duplicate-module-instances (story query)', S, storyQuery);
  S = item('lazy-boot-modules: GLTFLoader', S, gltfOnDemand);
  S = item('lazy-boot-modules: logo-panel', S, logoPanelOnDemand);
  S = item('lazy-boot-modules: tuft-atlas', S, tuftAtlasOnDemand);
  // terrain-early-start: left out (2026-10-26): parity not proven, no measured gain — see docs/perf
  S = item('gsap-unused', S, gsapOff);
  S = item('stone-normal idle slices', S, stoneNormalSlices);
  S = item('section-two-dead', S, sectionTwoOff);
  S = item('modulepreload-graph', S, preloadGraph);
  return { main: S.main, drops: S.drops, letters: S.letters, glass: S.glass, html: S.html, journey: S.journey, watershed: S.watershed, ui: S.ui, extra: S.extra };
};
