/* index1-5 optimisation team (2026-10-26), stream "firstpass": the first pass through a section must not pay for its own preparation.
   Every hitch the baseline found (docs/perf/index1-5-baseline-20261025.md, 「第一次經過」) is a one-time preparation that runs on the main
   thread inside the visitor's scroll: the cards strip is linked and its first photo uploaded at p≈10.6, the LOGO GLB is prepared during the
   ocean, the island atlases / principles photos / ocean photos / first video frame are decoded and uploaded inside a frame, and the principles
   programs are linked on their first draw.
   What this helper does (build.cjs runs it after the cover-free journey helpers, with the shared `extra`; PERF_ONLY=firstpass builds only it):
   · slider      the cards strip: createSlider() is a generator sliced at its program links (a local copy: portfolio-slider-firstpass.js; the
                 shared js/portfolio-slider.js is untouched). The host's first frame finds the photos it draws already on the GPU.
                 main.js's sliderUrl points at the copy.
   · principles  its two pictures are decoded and uploaded in free moments (the frame that draws them uploads them itself if they are not
                 up yet, as before). Its program is NOT compiled early: doing so changed the chapter's frames in parity (2026-10-26).
   · islands     the two atlases are decoded before the texture is handed to three (the upload inside the callback is then a copy).
   · photos      each ocean photo is decoded and uploaded in a free moment before it is marked ready.
   · video       the ocean loop's first frame is uploaded in a free moment after loadeddata.
   · logo        the GLB request starts when the lake starts to build (not after the mark's idle turn); its preparation runs in slices of
                 about 6 ms (prepareBlenderModelSteps), with the same statements in the same order. Output geometry is identical.
   The shared runtime is perf-firstpass.js (idleSlot, runSliced, decodedFirst, uploadSoon). Nothing here changes what is drawn or when a
   picture appears: only when its preparation runs. Every item is soft: an anchor that moved skips that item with a message, not the build. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const HERE = __dirname;
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const ROOT = path.resolve(__dirname, '../..');
const hash = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);
const skipped = [];
const applied = [];

/* the anchor must occur exactly once in the text it edits */
function once(src, anchor, repl, label) {
  const n = src.split(anchor).length - 1;
  if (n !== 1) throw new Error('anchor (' + label + ') found ' + n + ' times: ' + anchor.slice(0, 90).replace(/\n/g, '\\n'));
  return src.replace(anchor, () => repl);
}
/* replace the text from one anchor up to (not including) another; both must occur exactly once */
function between(src, start, end, repl, label) {
  const a = src.split(start).length - 1, b = src.split(end).length - 1;
  if (a !== 1 || b !== 1) throw new Error('block (' + label + ') anchors ' + a + '/' + b);
  const i = src.indexOf(start), j = src.indexOf(end);
  if (j <= i) throw new Error('block (' + label + ') out of order');
  return src.slice(0, i) + repl + src.slice(j);
}
/* build-time switch for A/B dry builds: FIRSTPASS_SKIP=video,photos leaves those items out (names as in `applied`) */
const SKIP = new Set(String(process.env.FIRSTPASS_SKIP || '').split(',').map(s => s.trim()).filter(Boolean));
/* one item: applies fn to the entries it names, keeps the result only if every step succeeded */
function soft(name, extra, keys, fn) {
  if (SKIP.has(name)) { skipped.push(name + ': left out by FIRSTPASS_SKIP'); return extra; }
  try {
    const part = {};
    for (const k of keys) { if (typeof extra[k] !== 'string') throw new Error('no module ' + k); part[k] = extra[k]; }
    const out = fn(part);
    applied.push(name);
    return { ...extra, ...out };
  } catch (error) {
    skipped.push(name + ': ' + String(error.message || error).slice(0, 200));
    return extra;
  }
}

const SHARED = read(path.join(HERE, 'perf-firstpass.js'));

/* ================================================================ the cards strip */
/* createSlider() becomes a generator: the same statements in the same order, with a `yield` after each one that costs a program link or a
   render target. The wrapper runs it in slices (about 6 ms per free moment) and hands the host a stand-in at once. */
function patchSlider(src) {
  const p = (a, b, label) => { src = once(src, a, b, 'slider ' + label); };
  p("import { GRADE_GLSL, gradeVector, gradeRGB } from './finnovation-grade.js?v=eb26a41a84';",
    "import { GRADE_GLSL, gradeVector, gradeRGB } from './finnovation-grade.js?v=eb26a41a84';\nimport { idleSlot } from './perf-firstpass.js';", 'import');
  p('export function createSlider(canvas, {', 'function* createSliderSteps(canvas, {', 'generator');
  p('  const postEffects = new Post(gl, { dpr: pixelRatio });\n', "  const postEffects = new Post(gl, { dpr: pixelRatio });\n  yield 'post';\n", 'y post');
  p('  resize();\n\n  const scene = new Transform(gl);\n', "  resize();\n  yield 'size';\n\n  const scene = new Transform(gl);\n", 'y size');
  p('uDirection: { value: new Vec2(1, 0) } }\n  });\n', "uDirection: { value: new Vec2(1, 0) } }\n  });\n  yield 'blur x';\n", 'y blur x');
  p('uDirection: { value: new Vec2(0, 1) } }\n  });\n', "uDirection: { value: new Vec2(0, 1) } }\n  });\n  yield 'blur y';\n", 'y blur y');
  p('\n  const noisePass = mist ? null : postEffects.addPass({', "\n  yield 'displace';\n  const noisePass = mist ? null : postEffects.addPass({", 'y noise');
  p('\n  const composePass = postEffects.addPass(mist ? {', "\n  yield 'noise';\n  const composePass = postEffects.addPass(mist ? {", 'y compose');
  p('\n  const viewDistPass = postEffects.addPass({', "\n  yield 'compose';\n  const viewDistPass = postEffects.addPass({", 'y view');
  p('\n  // A failed/slow photograph keeps a neutral card', "\n  yield 'view';\n  // A failed/slow photograph keeps a neutral card", 'y paper');
  p('\n  const slideProgram = new Program(gl, {', "\n  yield 'images';\n  const slideProgram = new Program(gl, {", 'y slide');
  p('\n  const renderTargets = [new RenderTarget(gl, { depth: false }), null];', "\n  yield 'slides';\n  const renderTargets = [new RenderTarget(gl, { depth: false }), null];", 'y targets');
  p('\n  /* ---- scroll state: the host feeds this ---- */', "\n  yield 'cloning';\n  /* ---- scroll state: the host feeds this ---- */", 'y scroll');
  p('    count: textures.length,\n', "    count: textures.length,\n    /* firstpass: is a picture that has arrived not on the GPU yet (warm() uploads one) */\n    pending() { return !disposed && textures.some(t => t.image !== paper && (t.needsUpdate || t.store?.image !== t.image)); },\n", 'pending');
  src += `
/* ---------------------------------------------------------------- firstpass: the strip is built in slices
   createSliderSteps() is the original createSlider() cut at its expensive statements. createSlider() hands the host a stand-in at once; the
   stand-in's \`ready\` resolves when the strip is built, its first pictures are in, and every picture that has arrived is on the GPU (warm(),
   one per free moment). The host waits on \`ready\` before its first frame (as it always did), so no frame is shown that is not the
   original's. Calls made before the strip exists are kept and applied when it does. */
export function createSlider(canvas, options = {}) {
  const gen = createSliderSteps(canvas, options);
  let real = null, dead = false;
  const later = {};
  const built = new Promise((resolve, reject) => {
    const slice = () => {
      if (dead) { try { canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* gone */ } resolve(null); return; }
      const t0 = performance.now();
      try {
        let r;
        do { r = gen.next(); } while (!r.done && performance.now() - t0 < 6);
        if (r.done) { real = r.value; resolve(real); return; }
      } catch (error) { reject(error); return; }
      idleSlot(200).then(slice);
    };
    idleSlot(200).then(slice);
  });
  const ready = built.then(async r => {
    if (!r) return false;
    const loaded = await r.ready;
    while (!dead && r.pending()) { await idleSlot(200); if (dead) break; r.warm(); }
    if (later.entrance !== undefined) r.setEntrance(later.entrance);
    if (later.grade !== undefined) r.setGrade(later.grade);
    if (later.bridge) r.setBridge(...later.bridge);
    return loaded;
  });
  ready.catch(() => { });
  return {
    get ready() { return ready; },
    get loaded() { return built.then(r => r ? r.loaded : false); },
    get count() { return real ? real.count : (options.images || []).length; },
    get progress() { return real ? real.progress : 0; },
    get introDone() { return real ? real.introDone : false; },
    frame: (...a) => real?.frame(...a),
    resize: () => real?.resize(),
    setEntrance(v) { later.entrance = v; real?.setEntrance(v); },
    setGrade(g) { later.grade = g; real?.setGrade(g); },
    setBridge(...a) { later.bridge = a; real?.setBridge(...a); },
    groundCss() { return real ? real.groundCss() : 'rgb(' + (options.base || [0.055, 0.055, 0.06]).map(v => Math.round(v * 255)).join(',') + ')'; },
    warm: () => real ? real.warm() : true,
    pending: () => !!real && real.pending(),
    addScroll: d => real?.addScroll(d),
    scrollBy: d => real ? real.scrollBy(d) : false,
    reset: a => real?.reset(a),
    replayIntro: () => real?.replayIntro(),
    dispose() { dead = true; real?.dispose(); }
  };
}
`;
  return src;
}

/* ================================================================ the principles chapter */
function patchPrinciples(src) {
  src = once(src, "import * as THREE from 'three';", "import * as THREE from 'three';\nimport { uploadSoon, idleSlot } from './perf-firstpass.js';", 'import');
  src = once(src, 'function begin(renderer){', `/* firstpass: the chapter's pictures are decoded and uploaded in free moments (the first frame that draws one uploads it itself, as before).
     The program is NOT compiled early: that changed the principles frames (parity, 2026-10-26), so its first-draw link stays where it was. */
 let warmRenderer = null;
 function warmPicture(t){ if(warmRenderer)uploadSoon(warmRenderer,t,()=>!disposed&&!!t.image).catch(()=>{}); }
 function begin(renderer){ warmRenderer=renderer;`, 'begin helpers');
  src = once(src, 'texture=setupTexture(t);', 'texture=setupTexture(t);warmPicture(t);', 'canopy upload');
  src = once(src, 'texture2=setupTexture(t);', 'texture2=setupTexture(t);warmPicture(t);', 'second upload');
  return src;
}

/* ================================================================ the ocean's island atlases */
function patchIslands(src) {
  src = once(src, "import * as THREE from 'three';", "import * as THREE from 'three';\nimport { decodedFirst } from './perf-firstpass.js';", 'import');
  src = once(src, '  function load() {\n    if (pending) return pending;\n',
    '  /* firstpass: decoded before three sees it, so the upload in the callback is a copy and not a decode */\n  const loadDecoded = (loader, url) => loader.loadAsync(url).then(texture => decodedFirst(texture));\n  function load() {\n    if (pending) return pending;\n', 'load');
  src = once(src, "loader.loadAsync(new URL('../assets/ocean/' + name + suffix, import.meta.url).href)",
    "loadDecoded(loader, new URL('../assets/ocean/' + name + suffix, import.meta.url).href)", 'loadAsync');
  return src;
}

/* ================================================================ the ocean's photographs */
function patchPhotos(src) {
  src = once(src, "import * as THREE from 'three';", "import * as THREE from 'three';\nimport { uploadSoon } from './perf-firstpass.js';", 'import');
  src = once(src, 'item.texture=new THREE.TextureLoader().load(src,texture=>{if(disposed||item.src!==src){texture.dispose();return;}item.ready=true;},undefined,()=>{item.ready=false;restore(item);});',
    'item.texture=new THREE.TextureLoader().load(src,texture=>{if(disposed||item.src!==src){texture.dispose();return;}' +
    'uploadSoon(renderer,texture,()=>!disposed&&item.src===src&&item.texture===texture).then(()=>{if(!disposed&&item.src===src&&item.texture===texture)item.ready=true;}).catch(()=>{});' +
    '},undefined,()=>{item.ready=false;restore(item);});', 'texture load');
  return src;
}

/* ================================================================ the ocean loop's first frame (finnovation-world.js copy) */
function patchVideo(src) {
  src = once(src, "import * as THREE from 'three';", "import * as THREE from 'three';\nimport { uploadSoon } from './perf-firstpass.js';   /* FIRSTPASS_VIDEO */", 'import');
  src = once(src, '        ocean?.setVideo(videoTexture);\n      }, { once: true });',
    '        ocean?.setVideo(videoTexture);\n        uploadSoon(renderer, videoTexture, () => !disposed && !!videoTexture).catch(() => { });   /* firstpass: its first frame in a free moment */\n      }, { once: true });', 'loadeddata');
  return src;
}

/* ================================================================ the LOGO glass mark: GLB request early, preparation in slices */
function patchLogoMark(src) {
  src = once(src, "import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';",
    "import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';\nimport { runSliced } from './perf-firstpass.js';", 'import');
  const steps = `function* prepareBlenderModelSteps(THREE, gltf, specification) {
    gltf.scene.updateMatrixWorld(true);
    const parts = [], names = [];
    const meshes = []; gltf.scene.traverse(node => { if (node.isMesh) meshes.push(node); });
    for (const node of meshes) {
      let g = node.geometry.clone();
      if (!g.getAttribute('normal')) { g.dispose(); throw new Error('Blender logo is missing its authored normals'); }
      g.applyMatrix4(node.matrixWorld);
      yield;
      if (g.index) { const source = g; g = g.toNonIndexed(); source.dispose(); }
      yield;
      // glTF primitives may carry different optional attributes. Keep the
      // imported positions/normals/UVs and the two attributes our glass reads.
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      g.computeBoundingBox();
      const p = g.getAttribute('position'), box = g.boundingBox, count = p.count;
      const uv = g.getAttribute('uv') ? null : new Float32Array(count * 2);
      const thick = new Float32Array(count).fill(1), brand = new Float32Array(count * 2);
      const blue = /sail|leaf/i.test(node.name);
      for (let i = 0; i < count; i++) {
        const x = p.getX(i), y = p.getY(i);
        if (uv) { uv[i * 2] = x * 2.4; uv[i * 2 + 1] = y * 2.4; }
        brand[i * 2] = blue ? 1 : 0;
        brand[i * 2 + 1] = clamp(.7 * (x - box.min.x) / Math.max(.0001, box.max.x - box.min.x) + .3 * (y - box.min.y) / Math.max(.0001, box.max.y - box.min.y), 0, 1);
        if ((i & 0x7fff) === 0x7fff) yield;
      }
      if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('aThick', new THREE.BufferAttribute(thick, 1));
      g.setAttribute('aBrand', new THREE.BufferAttribute(brand, 2));
      g.clearGroups(); parts.push(g); names.push(node.name);
      yield;
    }
    if (!parts.length) throw new Error('Blender logo contains no mesh');
    yield;
    const geometry = mergeGeometries(parts, false);
    parts.forEach(g => g.dispose());
    if (!geometry) throw new Error('Blender logo mesh attributes do not match');
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3()), center = geometry.boundingBox.getCenter(new THREE.Vector3());
    if (!(size.y > 0)) { geometry.dispose(); throw new Error('Blender logo has zero height'); }
    yield;
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(1 / size.y, 1 / size.y, 1 / size.y);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    __USERDATA__
    // The imported Blender materials are deliberately not used: the website
    // keeps its approved water-glass material and all live optical controls.
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      for (const m of Array.isArray(node.material) ? node.material : [node.material]) m?.dispose();
    });
    return { geometry, aspect: size.x / size.y };
}
/* the same preparation run to its end in one call (the live preview path uses it) */
function prepareBlenderModel(THREE, gltf, specification) {
  const steps = prepareBlenderModelSteps(THREE, gltf, specification);
  for (;;) { const r = steps.next(); if (r.done) return r.value; }
}
let blenderGltfTask = null, blenderGltfHref = '';
/* the GLB request, shared by the early prefetch and the mark's own call */
function blenderGltfOf(href) {
  if (!blenderGltfTask || blenderGltfHref !== href) {
    blenderGltfHref = href;
    blenderGltfTask = new GLTFLoader().loadAsync(href).catch(error => { blenderGltfTask = null; throw error; });
  }
  return blenderGltfTask;
}
/* firstpass: the lake starts to build, so the GLB starts to download with it (a request that is not parsed or prepared yet) */
export function prefetchLogoModel() {
  return getBlenderSpecification().then(specification => {
    const url = new URL(specification.asset, BLENDER_ASSET_BASE); url.searchParams.set('v', specification.revision);
    blenderGltfOf(url.href).catch(() => { });
  }).catch(() => { });
}
`;
  // the userData line is copied from the source as it is (its text carries the revision and the parameters)
  const old = src.slice(src.indexOf('function prepareBlenderModel(THREE, gltf, specification) {'), src.indexOf('async function getBlenderModel(THREE) {'));
  const userLine = old.split('\n').find(l => l.includes('geometry.userData = {'));
  if (!userLine) throw new Error('userData line not found');
  src = between(src, 'function prepareBlenderModel(THREE, gltf, specification) {', 'async function getBlenderModel(THREE) {', steps.replace('__USERDATA__', userLine.trim()), 'prepare');
  const getter = `async function getBlenderModel(THREE) {
  const specification = await getBlenderSpecification();
  const url = new URL(specification.asset, BLENDER_ASSET_BASE);url.searchParams.set('v', specification.revision);
  if (!blenderModelTask || blenderModelUrl !== url.href) {
    const previousTask = blenderModelTask;blenderModelUrl = url.href;
    blenderModelTask = blenderGltfOf(url.href).then(gltf => runSliced(prepareBlenderModelSteps(THREE, gltf, { ...specification, assetURL: url.href }))).then(model => {
      previousTask?.then(previous => previous.geometry.dispose()).catch(() => {});
      return model;
    }).catch(error => { if(blenderModelUrl===url.href){ blenderModelTask = null; blenderGltfTask = null; } throw error; });
  }
  return blenderModelTask;
}

`;
  src = between(src, 'async function getBlenderModel(THREE) {', '/* style 1 (water): every dial', getter, 'getBlenderModel');
  return src;
}
function patchLogoBuild(src) {
  return once(src, '  async function build(R0, renderer) {\n',
    "  async function build(R0, renderer) {\n    /* index1-5 firstpass: the GLB starts to download now; its parse and preparation run in idle slices later */\n    import('./world-logo-mark.js').then(m => m.prefetchLogoModel && m.prefetchLogoModel()).catch(() => { });\n", 'build');
}

/* ================================================================ main.js: the strip's address */
function patchMain(main, sliderV) {
  return once(main, "sliderUrl: '../../../js/portfolio-slider.js?v=4dc9d73082',",
    "sliderUrl: './portfolio-slider-firstpass.js?v=" + sliderV + "',", 'sliderUrl');
}

module.exports = ({ main, drops, letters, glass, html, extra = {}, journey, watershed, ui }) => {
  const sliderSrc = read(path.join(ROOT, 'js', 'portfolio-slider.js'));
  const sliderV = hash(patchSlider(sliderSrc));
  let out = { ...extra };
  let m = main;
  // one item at a time: a failing item leaves the others as they are
  try {
    const next = soft('slider', out, [], () => {
      const slider = '/* index1-5 firstpass LOCAL COPY of js/portfolio-slider.js (prototypes/index1-5/perf-firstpass-build.cjs): createSlider() built in slices.\n   The shared file is untouched. */\n' + patchSlider(sliderSrc);
      return { 'portfolio-slider-firstpass.js': slider, 'perf-firstpass.js': SHARED };
    });
    out = next;
    if (out['portfolio-slider-firstpass.js']) {
      try { m = patchMain(m, sliderV); } catch (error) { out = { ...out }; delete out['portfolio-slider-firstpass.js']; skipped.push('slider main: ' + error.message); }
    }
  } catch (error) { skipped.push('slider: ' + error.message); }
  if (!out['perf-firstpass.js']) out = { ...out, 'perf-firstpass.js': SHARED };

  out = soft('principles', out, ['world-principles.js'], p => ({ 'world-principles.js': patchPrinciples(p['world-principles.js']) }));
  out = soft('islands', out, ['world-ocean-islands.js'], p => ({ 'world-ocean-islands.js': patchIslands(p['world-ocean-islands.js']) }));
  out = soft('photos', out, ['world-ocean-photos.js'], p => ({ 'world-ocean-photos.js': patchPhotos(p['world-ocean-photos.js']) }));
  out = soft('video', out, ['finnovation-world.js'], p => ({ 'finnovation-world.js': patchVideo(p['finnovation-world.js']) }));
  out = soft('logo-mark', out, ['world-logo-mark.js'], p => ({ 'world-logo-mark.js': patchLogoMark(p['world-logo-mark.js']) }));
  out = soft('logo-build', out, ['world-logo.js'], p => ({ 'world-logo.js': patchLogoBuild(p['world-logo.js']) }));

  if (skipped.length) console.warn('[perf-firstpass] skipped: ' + skipped.join(' | '));
  console.log('[perf-firstpass] items: ' + applied.join(', '));
  return { main: m, drops, letters, glass, html, journey, watershed, ui, extra: out };
};
module.exports.skipped = skipped;
