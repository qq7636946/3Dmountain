/* index1-5 · flow-fix (2026-10-24, client 「整體每一區塊轉場不夠順暢絲滑 往下滾跟往回滾都要注意」).
   scripts/index1-5/flow.cjs (real wheel, top → footer → top, every frame recorded) found a handful of one-off hitches. Each is the
   same kind of event: a heavy one-time job (a shader link, a texture upload, a serialisation) lands inside the frame the visitor
   happens to be scrolling through. This helper moves each job out of the scroll path — splits it into slices, starts it
   earlier, or compiles in the background (KHR_parallel_shader_compile through renderer.compileAsync) — without changing what is
   drawn. Details, numbers and how to revert: docs/smooth-flow/hitch-fix.md.
   Runs LAST in build.cjs's list (after logo-panel-build), on the generated sources:
     main                       · environmentKey no longer serialises textures (toDataURL in the dispersal)
                                · the cards strip: loaded from the canyon on (not at the last chapter), built in slices
     extra['portfolio-slider-flow.js']  a local copy of js/portfolio-slider.js whose createSlider() is built in slices (the shared file is untouched)
     extra['finnovation-world.js']      the world's CJK layout steps split further
     extra['world-ocean.js']            bake(): the sea's programs and the planet's render-target variants compiled in the background
     extra['world-logo*.js']            the lake: env/foot programs compiled in the background, the glass variants primed (clipping)
     extra['flow-fix.js']       the small shared runtime (FLOW.on = false with ?flowfix=0: every behaviour falls back to the old code)
   Every anchor must occur exactly once. Patches into files that other sessions edit (world-logo*.js, world-ocean*.js) do not stop the
   build when their anchor has moved: they are skipped with a warning here and listed in FLOW.skipped (visible in the console / trace). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const SKIP = new Set(String(process.env.FLOWFIX_SKIP || '').split(',').map(s => s.trim()).filter(Boolean));   // build-time switch for A/B dry builds
const skipped = [];

function once(src, anchor, repl, label = '') {
  const n = src.split(anchor).length - 1;
  if (n !== 1) throw new Error('index1-5 flow-fix anchor' + (label ? ' (' + label + ')' : '') + ': ' + n + ' × ' + anchor.slice(0, 100));
  return src.replace(anchor, () => repl);
}
/* a patch set on files another session edits: all-or-nothing (the pieces of one fix rely on each other), never stops the build.
   fn({key: source}) edits that copy and returns the changed {key: source}; on any error nothing of the group is applied. */
function soft(name, extra, keys, fn) {
  if (SKIP.has(name)) return extra;
  try {
    const part = {};
    for (const k of keys) { if (typeof extra[k] !== 'string') throw new Error('no module ' + k); part[k] = extra[k]; }
    return { ...extra, ...fn(part) };
  } catch (error) {
    const msg = String(error.message || error).slice(0, 220);
    console.warn('[flow-fix] SKIPPED ' + name + ': ' + msg); skipped.push(name + ': ' + msg.replace(/^index1-5 flow-fix anchor /, ''));
    return extra;
  }
}
const hash = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);

/* ================================================================ the cards strip (js/portfolio-slider.js, local copy) */
function patchSlider(src) {
  const p = (a, b, label) => { src = once(src, a, b, 'slider ' + label); };
  p("import { GRADE_GLSL, gradeVector, gradeRGB } from './finnovation-grade.js?v=eb26a41a84';",
    "import { GRADE_GLSL, gradeVector, gradeRGB } from './finnovation-grade.js?v=eb26a41a84';\nimport { FLOW, idleSlot, mark } from './flow-fix.js';", 'import');
  // createSlider becomes a generator: the same statements in the same order, with a `yield` after each one that costs a frame
  // (a context, a program link, a render target). Run to the end in one go, it is the original function.
  p("export function createSlider(canvas, {", "function* createSliderSteps(canvas, {", 'generator');
  p("  const postEffects = new Post(gl, { dpr: pixelRatio });\n", "  const postEffects = new Post(gl, { dpr: pixelRatio });\n  yield 'context';\n", 'y context');
  p("  resize();\n\n  const scene = new Transform(gl);\n", "  resize();\n  yield 'size';\n\n  const scene = new Transform(gl);\n", 'y size');
  p("uDirection: { value: new Vec2(1, 0) } }\n  });\n", "uDirection: { value: new Vec2(1, 0) } }\n  });\n  yield 'blur x';\n", 'y blur x');
  p("uDirection: { value: new Vec2(0, 1) } }\n  });\n", "uDirection: { value: new Vec2(0, 1) } }\n  });\n  yield 'blur y';\n", 'y blur y');
  p("\n  const noisePass = mist ? null : postEffects.addPass({", "\n  yield 'displace';\n  const noisePass = mist ? null : postEffects.addPass({", 'y displace');
  p("\n  const composePass = postEffects.addPass(mist ? {", "\n  yield 'noise';\n  const composePass = postEffects.addPass(mist ? {", 'y noise');
  p("\n  const viewDistPass = postEffects.addPass({", "\n  yield 'compose';\n  const viewDistPass = postEffects.addPass({", 'y compose');
  p("\n  // A failed/slow photograph keeps a neutral card", "\n  yield 'view';\n  // A failed/slow photograph keeps a neutral card", 'y view');
  p("\n  const slideProgram = new Program(gl, {", "\n  yield 'images';\n  const slideProgram = new Program(gl, {", 'y images');
  p("\n  const renderTargets = [new RenderTarget(gl, { depth: false }), null];", "\n  yield 'slides';\n  const renderTargets = [new RenderTarget(gl, { depth: false }), null];", 'y slides');
  p("\n  /* ---- scroll state: the host feeds this ---- */", "\n  yield 'cloning';\n  /* ---- scroll state: the host feeds this ---- */", 'y cloning');
  p("    count: textures.length,\n", "    count: textures.length,\n    /* flow-fix: is there a picture that has arrived but is not on the GPU yet (warm() uploads one) */\n    pending() { return !disposed && textures.some(t => t.image !== paper && (t.needsUpdate || t.store?.image !== t.image)); },\n", 'pending');
  src += `
/* ---------------------------------------------------------------- flow-fix: the strip is built in slices
   createSliderSteps() is the original createSlider() cut at its expensive statements. With flow-fix on, createSlider() hands the host a
   stand-in at once and runs the steps one per free moment; its \`ready\` also waits until the pictures that are in have been uploaded
   (warm(), one per free moment), so the host's first frame finds the strip built. Off, the generator is run to its end: the original. */
export function createSlider(canvas, options = {}) {
  const gen = createSliderSteps(canvas, options);
  if (!FLOW.on) { let r = gen.next(); while (!r.done) r = gen.next(); return r.value; }
  let real = null, dead = false;
  const later = { entrance: undefined, bridge: undefined, grade: undefined };
  const built = new Promise((resolve, reject) => {
    const budget = 6, started = performance.now();
    const slice = () => {
      if (dead) { try { canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* gone */ } resolve(null); return; }
      const t0 = performance.now();
      try {
        let r;
        do { r = gen.next(); } while (!r.done && performance.now() - t0 < budget);
        if (r.done) { real = r.value; mark('strip built', Math.round(performance.now() - started)); resolve(real); return; }
      } catch (error) { reject(error); return; }
      idleSlot(200).then(slice);
    };
    idleSlot(200).then(slice);
  });
  const ready = built.then(async () => {
    if (!real) return false;
    const r = await real.ready;
    // the pictures that are in go up one per free moment, here, instead of all inside the first frame
    let n = 0;
    while (!dead && real.pending()) { await idleSlot(200); real.warm(); n++; }
    mark('strip uploaded', n);
    if (later.entrance !== undefined) real.setEntrance(later.entrance);
    if (later.grade !== undefined) real.setGrade(later.grade);
    if (later.bridge) real.setBridge(...later.bridge);
    return r;
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
    groundCss: () => real ? real.groundCss() : 'rgb(' + (options.base || [.055, .055, .06]).map(v => Math.round(v * 255)).join(',') + ')',
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

/* ================================================================ main.js */
function patchMain(main) {
  const m = (a, b, label) => { main = once(main, a, b, 'main ' + label); };
  m("import * as THREE from 'three';", "import * as THREE from 'three';\nimport { FLOW } from './flow-fix.js';", 'import');
  // A1 — the dispersal: environmentKey() ran JSON.stringify over every uniform, which serialises a THREE.Texture by drawing its image into a
  // canvas and calling toDataURL (6 ms and more, twice per bake request, at journey ≈ .9). A texture is identified by uuid + version.
  m("const environmentKey = () => JSON.stringify(Object.values(envProbeMaterial.uniforms).map(({ value }) => value?.toArray ? value.toArray() : value));",
    "const environmentKey = () => JSON.stringify(Object.values(envProbeMaterial.uniforms).map(({ value }) => value?.toArray ? value.toArray() : FLOW.on && value?.isTexture ? 'tex:' + value.uuid + ':' + value.version : value));", 'environmentKey');
  // A2 — the cards strip: preload from the canyon on (the idle-only trigger never fired for a visitor who keeps scrolling, so the whole
  // setup landed in the rise toward FOUR PATHS), and build it in slices (portfolio-slider-flow.js).
  m("if (!portfolioJob && CONFIG.portfolio.on > .5 && journeyReady && (p > J.max - 3.2 || p > 4.6 &&",
    "if (!portfolioJob && CONFIG.portfolio.on > .5 && journeyReady && (p > J.max - 3.2 || FLOW.on && p > 5.2 || p > 4.6 &&", 'preload trigger');
  // (an absolute address: the epilogue module that imports it is the shared one in js/ or flow-feel's local copy next to the generated modules)
  m("          sliderUrl: './portfolio-slider.js?v=4dc9d73082',", "          sliderUrl: FLOW.on ? new URL('prototypes/index1-5-morning-20261026/js/portfolio-slider-flow.js?v=__SLIDER_V__', document.baseURI).href : './portfolio-slider.js?v=4dc9d73082',", 'sliderUrl');
  // A3 — the composer's fullscreen passes that start switched off link at the frame they are first switched on (8 ms on the desktop at the
  // forward transition, 14 + 10 + 9 ms for the grain and a second pass on a phone at journey ≈ 2). Compiled in the background instead.
  m("        } finally { warmTarget.dispose(); journeyReady = true; }", "        } finally { warmTarget.dispose(); journeyReady = true; if (FLOW.on) void warmComposerPasses(); }", 'composer warm call');
  m("      const journeyBaseStops = [", `      /* flow-fix: every fullscreen pass of the composer, compiled in the background one at a time, for the two targets they draw into (a render target / the canvas) */
      async function warmComposerPasses() {
        if (!FLOW.on || !renderer.compileAsync) return;
        const quads = composer.passes.map(pass => pass.fsQuad?._mesh).filter(mesh => mesh?.material);
        for (const mesh of quads) for (const target of [composer.renderTarget1, null]) {
          await new Promise(resolve => setTimeout(resolve, 90));
          if (sceneStopped) return;
          const prev = renderer.getRenderTarget();
          renderer.setRenderTarget(target);
          const done = renderer.compileAsync(mesh, camera, scene);
          renderer.setRenderTarget(prev);
          await done.catch(() => { });
        }
      }
      const journeyBaseStops = [`, 'composer warm fn');
  return main;
}

/* ================================================================ the sea (world-ocean.js): bake() in the background */
function patchOcean(files) {
  let src = files['world-ocean.js'];
  const p = (a, b, label) => { src = once(src, a, b, 'ocean ' + label); };
  // the original body stays, as bakeSync()
  p("  function bake() {\n    if (!built || baked) return;\n    baked = true;\n", "  function bakeSync() {\n    if (!built || baked) return;\n    baked = true;\n", 'bake head');
  p("\n  let video = null, photo = null, videoMix = 0, videoSize = [16, 9], photoSize = [1280, 763];\n", `
  /* flow-fix: the same job, with the programs it needs linked in the background first. ANGLE links a program when it is first drawn
     (getProgramInfoLog then waits for the whole compile: 23 + 8 ms for the two bake programs here, ~20 ms each for the planet's, the
     sky's and the halo's render-target variants at the wave, ~47 ms in one frame). compileAsync starts them all now and polls, so the
     draws bakeSync() does next, and the wave's later ones, find them done. The render-target variant matters: the planet is drawn
     into sceneRT for the wave to refract, and a render target is another program (linear output). */
  let baking = false;
  async function bakeAsync() {
    if (!built || baked || baking) return;
    baking = true;
    const t0 = performance.now(), prev = renderer.getRenderTarget();
    try {
      bakeMesh.material = noiseMat; renderer.setRenderTarget(noiseRT); const a = renderer.compileAsync(bakeScene, bakeCam);
      bakeMesh.material = waveMat; renderer.setRenderTarget(waveRT); const b = renderer.compileAsync(bakeScene, bakeCam);
      renderer.setRenderTarget(prev);
      await Promise.all([a, b]);
      if (baked) return;
      const shown = [oceanMesh.visible, skyMesh.visible, gullMesh.visible, islands.mesh.visible];
      oceanMesh.visible = skyMesh.visible = gullMesh.visible = islands.mesh.visible = true;
      let c; try { c = renderer.compileAsync(scene, camera); } finally { [oceanMesh.visible, skyMesh.visible, gullMesh.visible, islands.mesh.visible] = shown; }
      // what the wave draws into sceneRT: the world without my four layers
      const own = new Set([oceanMesh, skyMesh, gullMesh, islands.mesh]), jobs = [c];
      renderer.setRenderTarget(sceneRT);
      for (const child of scene.children) if (!own.has(child)) jobs.push(renderer.compileAsync(child, camera, scene));
      renderer.setRenderTarget(prev);
      await Promise.all(jobs);
    } catch { /* bakeSync() below compiles on first use, as before */ }
    finally { renderer.setRenderTarget(prev); baking = false; }
    if (!baked) bakeSync();
    try { performance.mark('ff:ocean bake ' + Math.round(performance.now() - t0)); } catch { /* old browsers */ }
  }
  function bake() { return globalThis.__FLOWFIX__?.on ? bakeAsync() : bakeSync(); }

  let video = null, photo = null, videoMix = 0, videoSize = [16, 9], photoSize = [1280, 763];
`, 'bake async');
  // the wave must not start before the sea is baked: draw it the old way if the background job has not finished by then
  p("    if (!baked) bake();\n", "    if (!baked && (!baking || o.show > .001)) bakeSync();\n", 'render fallback');
  return { 'world-ocean.js': src };
}

/* ================================================================ the world page (a local copy of js/finnovation-world.js) */
function patchWorld(files) {
  let src = files['finnovation-world.js'];
  const p = (a, b, label) => { src = once(src, a, b, 'world ' + label); };
  // the first layout of the CJK text, one block per free moment: a block of long paragraphs was one 14–20 ms step; blocks now split down to a paragraph
  p("  const pieces = chunks.flatMap(el => { const kids = [...el.children].filter(kid => !kid.hidden); return kids.length > 2 ? kids : [el]; });",
    `  const split = (el, depth) => {
    const kids = [...el.children].filter(kid => !kid.hidden);
    if (!globalThis.__FLOWFIX__?.on || depth > 2 || kids.length < 2 || (el.textContent || '').length < 140 || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return [el];
    return kids.flatMap(kid => split(kid, depth + 1));
  };
  const pieces = chunks.flatMap(el => { const kids = [...el.children].filter(kid => !kid.hidden); return kids.length > 2 ? kids.flatMap(kid => split(kid, 1)) : [el]; });`, 'pieces');
  return { 'finnovation-world.js': src };
}

/* ================================================================ the logo lake (world-logo.js, world-logo-scene.js) */
function patchLake(files) {
  let scene = files['world-logo-scene.js'], logo = files['world-logo.js'];
  const ps = (a, b, label) => { scene = once(scene, a, b, 'lake scene ' + label); };
  const pl = (a, b, label) => { logo = once(logo, a, b, 'lake ' + label); };
  // --- world-logo-scene.js: createLakeScene() no longer links the sky/footprint programs in its own (blocking) first update
  ps("  function bakeEnvironment() {\n    envDirty = false;\n    if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer);\n", "  function ensureEnvScene() {\n    if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer);\n", 'env head');
  ps("      envScene.add(envMesh);\n    }\n    envMesh.material.uniforms.uSunB.value.set(U.uSunB.value.x, 5, 0, 0);\n",
    "      envScene.add(envMesh);\n    }\n  }\n  function bakeEnvironment() {\n    envDirty = false;\n    ensureEnvScene();\n    envMesh.material.uniforms.uSunB.value.set(U.uSunB.value.x, 5, 0, 0);\n", 'env tail');
  ps("  syncOpeningLook(); layout(); update({ q: 0, time: 0 });\n", "  syncOpeningLook(); layout();\n  /* flow-fix: the first update() bakes the sky into the glass's environment (PMREM) and the first footprint draw links their programs —\n     250 ms + 15 ms of blocking compile in one frame. With flow-fix on, api.finish() does both after compiling those programs in the background. */\n  const deferFirst = globalThis.__FLOWFIX__?.on === true;\n  if (!deferFirst) update({ q: 0, time: 0 });\n", 'first update');
  ps("  /* the footprint texture starts as \"no footprint anywhere\" (99), so the rings never start from an empty texture */\n  {\n    const prev = renderer.getRenderTarget();\n",
    "  /* the footprint texture starts as \"no footprint anywhere\" (99), so the rings never start from an empty texture */\n  const footInit = () => {\n    const prev = renderer.getRenderTarget();\n", 'foot head');
  ps("    renderer.setRenderTarget(footRT); renderer.render(footScene, convCam); renderer.setRenderTarget(prev);\n  }\n  return api;\n}",
    `    renderer.setRenderTarget(footRT); renderer.render(footScene, convCam); renderer.setRenderTarget(prev);
  };
  if (deferFirst) {
    api.finish = async () => {
      if (disposed) return;
      ensureEnvScene();
      const prev = renderer.getRenderTarget();
      // the sky shader draws into PMREM's cube targets and the footprint quad into footRT: render targets, so they are compiled as such
      renderer.setRenderTarget(footRT);
      const jobs = [renderer.compileAsync(envScene, camera), renderer.compileAsync(footScene, convCam)];
      renderer.setRenderTarget(prev);
      await Promise.all(jobs).catch(() => { });
      if (disposed) return;
      update({ q: 0, time: 0 });
      footInit();
    };
    return api;
  }
  footInit();
  return api;
}`, 'foot tail');
  // --- world-logo.js: the build calls finish() as a step of its own; the glass variants get the clipping count the real draw has
  pl("    R0.lake = await step(R0, 'lake', () => sceneMod.createLakeScene({ THREE, renderer, width: Math.round(_size.x), height: Math.round(_size.y), palette: paletteHex(), assetBase, small, reducedMotion }), true);\n    if (dead(R0)) return;\n",
    "    R0.lake = await step(R0, 'lake', () => sceneMod.createLakeScene({ THREE, renderer, width: Math.round(_size.x), height: Math.round(_size.y), palette: paletteHex(), assetBase, small, reducedMotion }), true);\n    if (dead(R0)) return;\n    if (R0.lake.finish) { await step(R0, 'lake finish', () => R0.lake.finish()); if (dead(R0)) return; }\n", 'lake step');
  pl("      const p = precompile(R0, renderer).catch(() => { }).then(() => { R0.compiling = null; });",
    "      const p = precompile(R0, renderer).catch(() => { }).then(() => primeGlass(R0, renderer)).catch(() => { }).then(() => { R0.compiling = null; });", 'compile step');
  pl("  function makeComposite(R0) {\n", `  /* flow-fix: three's compile() keys a program on the renderer's CURRENT clipping count — whatever the last draw left (the clipped glass
     leaves 1, anything else 0) — while a real draw uses the material's own count. The mark's materials carry the waterline plane, so the
     variants precompile() made for them had numClippingPlanes 0 and the first drawLake() compiled three more (~250 ms each, one frame).
     Here the mark alone is compiled again with the count set to 1 (an empty render with one global plane leaves it so), for every
     combination the lake draws: the canvas, and the render targets (mirror, transmission) with front and back faces. Additive: variants that
     already exist are found in three's cache. */
  let clipProbe = null, clipScene = null, clipCam = null;
  const clipState = (renderer, count) => {
    const saved = renderer.clippingPlanes, rt = renderer.getRenderTarget();
    renderer.clippingPlanes = Array.from({ length: count }, () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6));
    try { renderer.setRenderTarget(clipProbe ||= new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false })); renderer.render(clipScene ||= new THREE.Scene(), clipCam ||= new THREE.PerspectiveCamera()); }
    finally { renderer.clippingPlanes = saved; renderer.setRenderTarget(rt); }
  };
  async function primeGlass(R0, renderer) {
    if (!globalThis.__FLOWFIX__?.on || R0.dead || !R0.holder || !renderer.compileAsync || !renderer.localClippingEnabled) return;
    const scene = R0.lake.scene, camera = R0.lake.camera, mark = R0.holder, glass = [];
    mark.traverse(o => { const m = o.material; if (o.isMesh && m && !Array.isArray(m) && m.transmission > 0 && m.side === THREE.DoubleSide) glass.push(m); });
    const rt = new THREE.WebGLRenderTarget(8, 8, { type: THREE.HalfFloatType });
    try {
      for (const [target, side] of [[null, null], [rt, null], [rt, THREE.BackSide], [null, THREE.BackSide]]) {
        if (R0.dead) break;
        for (const m of glass) { m.side = side ?? THREE.DoubleSide; m.needsUpdate = true; }
        const prev = renderer.getRenderTarget();
        clipState(renderer, 1);
        renderer.setRenderTarget(target);
        const done = renderer.compileAsync(mark, camera, scene);
        renderer.setRenderTarget(prev);
        clipState(renderer, 0);
        await done.catch(() => { });
      }
    } finally { for (const m of glass) { m.side = THREE.DoubleSide; m.needsUpdate = true; } clipState(renderer, 0); rt.dispose(); }
  }
  function makeComposite(R0) {
`, 'prime glass');
  // one build step per frame at most: a step that finishes must be followed by a gap, or two of them (and a frame) land in the same few milliseconds
  pl("        if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 900 }); else setTimeout(run, 50);\n",
    "        if (globalThis.__FLOWFIX__?.on) { const gap = 70 - (performance.now() - (R0.stepEnd || 0)); if (gap > 0) { setTimeout(when, gap); return; } }\n        if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 900 }); else setTimeout(run, 50);\n", 'step gap');
  pl("Promise.resolve(out).then(v => { R0.log.push([name + ' (whole step)'", "Promise.resolve(out).then(v => { R0.stepEnd = performance.now(); R0.log.push([name + ' (whole step)'", 'step end');
  pl("      try { renderer.compile(R0.comp.scene, R0.comp.camera); } catch { /* compiled on first use */ }",
    "      try { if (globalThis.__FLOWFIX__?.on && renderer.compileAsync) return renderer.compileAsync(R0.comp.scene, R0.comp.camera).catch(() => { }); renderer.compile(R0.comp.scene, R0.comp.camera); } catch { /* compiled on first use */ }", 'composite compile');
  return { 'world-logo-scene.js': scene, 'world-logo.js': logo };
}

/* ================================================================ the mark takes the lake's environment at creation */
function patchMarkEnv(files) {
  let logo = files['world-logo.js'], mark = files['world-logo-mark.js'];
  logo = once(logo, "markMod.createLogoMark({ THREE, SVGLoader: svgMod.SVGLoader, svgUrl, renderer, look: { ...(cfg().logoMark || {}) } })",
    "markMod.createLogoMark({ THREE, SVGLoader: svgMod.SVGLoader, svgUrl, renderer, look: { ...(cfg().logoMark || {}) }, env: R0.lake.environment || null })", 'mark env call');
  // without it createLogoMark bakes a built-in fallback environment (a PMREM pass and its programs, ~20 ms) that the 'link' step replaces at once
  mark = once(mark, "export async function createLogoMark({ THREE, SVGLoader, svgUrl, renderer, look } = {}) {", "export async function createLogoMark({ THREE, SVGLoader, svgUrl, renderer, look, env = null } = {}) {", 'mark signature');
  mark = once(mark, "  let givenEnv = null, fallbackEnv = null, flags = '';", "  let givenEnv = (globalThis.__FLOWFIX__?.on && env) || null, fallbackEnv = null, flags = '';", 'mark givenEnv');
  return { 'world-logo.js': logo, 'world-logo-mark.js': mark };
}

/* ================================================================ the cast glass geometry: one shape per task */
function patchCast(files) {
  let cast = files['world-logo-cast.js'], mark = files['world-logo-mark.js'];
  // createCastGeometry (an ExtrudeGeometry + creased normals per shape: ~40 ms in one task) becomes a generator; the sync export is the same function run to the end
  cast = once(cast, "export function createCastGeometry(THREE, outline, look, small) {", "function* createCastGeometrySteps(THREE, outline, look, small) {", 'cast head');
  cast = once(cast, "    g.clearGroups(); parts.push(g);\n  }\n  const geometry=mergeGeometries(parts,false);", "    g.clearGroups(); parts.push(g); yield;\n  }\n  const geometry=mergeGeometries(parts,false);", 'cast yield');
  cast = once(cast, "  parts.forEach(g=>g.dispose()); geometry.computeBoundingBox(); geometry.computeBoundingSphere();\n  return geometry;\n}",
    `  parts.forEach(g=>g.dispose()); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
/* flow-fix: the same geometry, one shape per timer task */
export function createCastGeometry(THREE, outline, look, small) { const it = createCastGeometrySteps(THREE, outline, look, small); let r = it.next(); while (!r.done) r = it.next(); return r.value; }
export async function createCastGeometryAsync(THREE, outline, look, small) {
  const it = createCastGeometrySteps(THREE, outline, look, small); let r = it.next();
  while (!r.done) { await new Promise(resolve => setTimeout(resolve, 0)); r = it.next(); }
  return r.value;
}`, 'cast wrappers');
  mark = once(mark, "import { createCastGeometry, createCastNormal } from './world-logo-cast.js", "import { createCastGeometry, createCastGeometryAsync, createCastNormal } from './world-logo-cast.js", 'mark import');
  mark = once(mark, "g = cast ? createCastGeometry(THREE, nextOutline, geoParams(), small) : await buildGeometry(", "g = cast ? (globalThis.__FLOWFIX__?.on ? await createCastGeometryAsync(THREE, nextOutline, geoParams(), small) : createCastGeometry(THREE, nextOutline, geoParams(), small)) : await buildGeometry(", 'mark call');
  return { 'world-logo-cast.js': cast, 'world-logo-mark.js': mark };
}

/* ================================================================ the island atlases: decoded off the main thread, uploaded one per free moment */
function patchIslands(files) {
  let src = files['world-ocean-islands.js'];
  src = once(src, `.then(loaded => {
      if (disposed) { loaded.forEach(t => t.dispose()); return; }
      textures = loaded;
      for (const texture of textures) {
        texture.colorSpace = THREE.NoColorSpace; texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = small ? 1 : 2; renderer.initTexture(texture);
      }
      material.uniforms.uIsland.value = textures[0]; material.uniforms.uIslandForm.value = textures[1];`,
    `.then(async loaded => {
      /* flow-fix: the atlases were decoded and uploaded together inside the load event (14 + 13 ms of decode and 2 × 18 ms of upload in
         one frame, at the first global chapter). Decoded off the main thread first, then one upload per free moment. */
      const ff = globalThis.__FLOWFIX__?.on === true;
      if (ff) await Promise.all(loaded.map(t => t.image && t.image.decode ? t.image.decode().catch(() => { }) : null));
      if (disposed) { loaded.forEach(t => t.dispose()); return; }
      textures = loaded;
      for (const texture of textures) {
        texture.colorSpace = THREE.NoColorSpace; texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = small ? 1 : 2; if (!ff) renderer.initTexture(texture);
      }
      if (ff) for (const texture of textures) {
        await new Promise(r => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r(), { timeout: 300 }) : setTimeout(r, 40)));
        if (disposed) return;
        renderer.initTexture(texture);
      }
      material.uniforms.uIsland.value = textures[0]; material.uniforms.uIslandForm.value = textures[1];`, 'islands upload');
  return { 'world-ocean-islands.js': src };
}

/* ================================================================ the module */
module.exports = ({ main, drops, letters, glass, html, extra, journey }) => {
  extra = { ...extra };
  const sliderSrc = patchSlider(read(path.join(ROOT, 'js', 'portfolio-slider.js')));
  const sliderV = hash(sliderSrc);
  extra['portfolio-slider-flow.js'] = '/* index1-5 LOCAL COPY of js/portfolio-slider.js (prototypes/index1-5-morning-20261026/flow-fix-build.cjs): createSlider() built in slices. The shared file is untouched. */\n' + sliderSrc;
  main = patchMain(main).replace('__SLIDER_V__', sliderV);
  extra = soft('world-layout', extra, ['finnovation-world.js'], patchWorld);
  extra = soft('ocean-bake', extra, ['world-ocean.js'], patchOcean);
  extra = soft('logo-lake', extra, ['world-logo-scene.js', 'world-logo.js'], patchLake);
  extra = soft('logo-mark-env', extra, ['world-logo.js', 'world-logo-mark.js'], patchMarkEnv);
  extra = soft('logo-cast-split', extra, ['world-logo-cast.js', 'world-logo-mark.js'], patchCast);
  extra = soft('islands-upload', extra, ['world-ocean-islands.js'], patchIslands);
  const runtime = read(path.join(__dirname, 'flow-fix.js')).replace('/*FLOW_SKIPPED*/[]/*/FLOW_SKIPPED*/', '/*FLOW_SKIPPED*/' + JSON.stringify(skipped) + '/*/FLOW_SKIPPED*/');
  extra['flow-fix.js'] = runtime;
  return { main, drops, letters, glass, html, extra, journey };
};
module.exports.patchSlider = patchSlider;
