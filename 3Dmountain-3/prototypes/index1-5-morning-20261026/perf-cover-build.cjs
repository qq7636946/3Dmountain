/* index1-5 optimisation team (2026-10-26), stream "cover": work done for things that are hidden, covered, idle or duplicated.
   Desktop output must stay visually identical. Every item is an anchored, all-or-nothing patch on the generated text (each anchor
   must occur exactly once). An item whose anchor is missing is reported as "COVER ITEM SKIPPED" and left out; the others still apply.
   Helper contract: ({main,drops,letters,glass,html,extra,journey,watershed,ui}) => the same (+ extra:{file:source} for local modules).
   Items (first half):
     keylight        the opening key light's 2048² shadow map: nothing in the main scene receives it
     logo-cut        LOGO cut at progress 0 inside the wave's band: keep the lake's CPU clocks, skip its GPU work (the world frame is shown)
     video           the ocean film pauses while principles or the LOGO lake cover the ocean; its mix is held, not eased
     cards-idle      the card strip's rAF loop sleeps while suspended under a covering section, and re-arms with a fresh clock
     covered         covered picture (world or cards) and a settled journey: the journey's per-frame work is skipped (cheap eases,
                     clock and the world's load triggers still run), on desktop as well as phones
     slider-rt       local copy of the shared card slider: the render targets it replaces on resize are deleted */

const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');

function swap(source, anchor, replacement, label) {
  const hits = source.split(anchor).length - 1;
  if (hits !== 1) throw new Error(label + ': anchor found ' + hits + ' times');
  return source.replace(anchor, () => replacement);
}

module.exports = state => {
  const S = { main: state.main, extra: { ...state.extra } };
  const log = [];
  /* Left out by default: keylight (parity 2026-10-26: the opening key light's shadow is visible in the hero frame at the bottom right, so
     the shadow map is needed); logo-cut (parity forces logoSeal.cutClock=0, so its path cannot be compared; enable after a cutClock=1
     check). COVER_OFF=a,b adds to the list for bisects; COVER_ON=a,b re-enables an item. */
  const DEFAULT_OFF = ['keylight', 'logo-cut'];
  const OFF = new Set([...DEFAULT_OFF, ...String(process.env.COVER_OFF || '').split(',').map(s => s.trim()).filter(Boolean)]);
  for (const k of String(process.env.COVER_ON || '').split(',').map(s => s.trim()).filter(Boolean)) OFF.delete(k);
  const item = (id, patch) => {
    if (OFF.has(id)) { log.push(id + ' OFF (bisect)'); return; }
    const before = { main: S.main, extra: { ...S.extra } };
    try { patch(); log.push(id + ' applied'); }
    catch (e) { S.main = before.main; S.extra = before.extra; log.push(id + ' SKIPPED'); console.log('COVER ITEM SKIPPED: ' + id + ' - ' + (e && e.message || e)); }
  };

  /* ---- keylight: the opening's key light is the only shadow caster in the main scene that is not static. Nothing in it
     receives shadows (water is hidden, sea.receiveShadow=false, the canyon is in its own scene). Without castShadow the shadow
     pass (one per frame, two in the LOGO chapter) and the 2048² RGBA8 + depth map (about 32 MB) go away. */
  item('keylight', () => {
    S.main = swap(S.main,
      '      keyLight.castShadow = true;\n      keyLight.shadow.mapSize.set(2048, 2048);',
      '      keyLight.castShadow = false; /* cover (perf): nothing in this scene receives it */\n      keyLight.shadow.mapSize.set(2048, 2048);', 'keylight');
  });

  /* ---- logo-cut: while the cut is at 0 the wave's draw() would draw the lake, copy two full frames and composite — and the composite
     at progress 0 is exactly the world frame that the world draws itself. Keep frame() and the spin update (they advance the lake's
     clocks and rings), skip the GPU work, and return false so the world draws its frame. */
  item('logo-cut', () => {
    const key = 'world-logo.js';
    if (typeof S.extra[key] !== 'string') throw new Error('world-logo.js missing from extra');
    S.extra[key] = swap(S.extra[key],
      '    try {\n      const t0 = performance.now(), drawn = draw(R, l, time, ctx, renderer);',
      '    /* cover (perf): the cut has not begun, so the world frame is shown and the lake is not drawn. The CPU state is advanced as draw()\n' +
      '       advances it (the lake clocks, rings and the spin); only the GPU work (lake, two copies, composite) is skipped. */\n' +
      '    if (!reducedMotion && Math.round(num(\'transition\', 0, 2)) > 0 && num(\'cutClock\', 0, 1) >= .5 && !(l.pc > 0)) {\n' +
      '      try { frame(R, l, time, renderer); R.spinFx.update({ yaw: l.yaw, progress: l.qSpin, now: performance.now() / 1000, reducedMotion }); } catch (e) { fail(e); }\n' +
      '      return false;\n' +
      '    }\n' +
      '    try {\n      const t0 = performance.now(), drawn = draw(R, l, time, ctx, renderer);', 'logo-cut');
  });

  /* ---- video: principles at enter 1, or the lake at cut 1, draw without the ocean, so the film is not seen. Pause it then (the
     existing play/pause branch does the rest), and hold the mix: today the mix stays at 1 while the film plays under them, so holding
     it keeps the water exactly where it was when the visitor scrolls back. */
  item('video', () => {
    const key = 'finnovation-world.js';
    if (typeof S.extra[key] !== 'string') throw new Error('finnovation-world.js missing from extra');
    let m = S.extra[key];
    m = swap(m, '  let video = null, videoTexture = null, videoMix = 0, videoWanted = false;',
      '  let video = null, videoTexture = null, videoMix = 0, videoWanted = false, lakeCut = 0;', 'video decl');
    m = swap(m, '    const showing = open && s.photo > .001 && s.footerTop > 1;',
      '    /* cover (perf): principles or the LOGO lake fully replace the ocean; the film is paused and its mix held meanwhile */\n' +
      '    const coverHeld = !!((s.principles && s.principles.enter >= 1) || lakeCut >= 1);\n' +
      '    const showing = open && s.photo > .001 && s.footerTop > 1 && !coverHeld;', 'video showing');
    m = swap(m, '    const target = videoTexture && !video.paused && video.readyState >= 2 ? 1 : 0;\n    videoMix += (target - videoMix) * .08; if (Math.abs(target - videoMix) < .002) videoMix = target;',
      '    if (!coverHeld) {\n      const target = videoTexture && !video.paused && video.readyState >= 2 ? 1 : 0;\n      videoMix += (target - videoMix) * .08; if (Math.abs(target - videoMix) < .002) videoMix = target;\n    }', 'video mix');
    m = swap(m, '    const logoDrawn = logo ? logo.render(s, time, { renderer, world: () => {}, draw: drawBeforeSeal }) : false;',
      '    const logoDrawn = logo ? logo.render(s, time, { renderer, world: () => {}, draw: drawBeforeSeal }) : false;\n    lakeCut = s.l?.pc ?? 0;', 'video lake cut');
    S.extra[key] = m;
  });

  /* ---- cards-idle: the strip's loop re-arms every frame even when a section covers it (only the slider draw is skipped). setExit,
     take and close already re-arm on any change, so at rest under a cover the loop can sleep. run() takes a fresh clock when it wakes,
     so the strip's clock does not step by the length of the sleep. */
  item('cards-idle', () => {
    const key = 'portfolio-epilogue-polish.js';
    if (typeof S.extra[key] !== 'string') throw new Error('portfolio-epilogue-polish.js missing from extra');
    let m = S.extra[key];
    m = swap(m, '    else run();\n  }\n  function beginBridge() {',
      '    else if (!(suspended && open && amount === target && velocity === 0)) run();   /* cover (perf): asleep at rest under a section; setExit / take / close wake it */\n  }\n  function beginBridge() {', 'cards tail');
    m = swap(m, '  function run() { if (!raf && !disposed && !document.hidden) { if (!last) last = performance.now(); raf = requestAnimationFrame(tick); } }',
      '  function run() { if (!raf && !disposed && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } }', 'cards run');
    S.extra[key] = m;
  });

  /* ---- covered: while the world or the cards cover the picture (the same test that already skips composer.render on desktop), and the
     journey has settled, the journey's per-frame simulation is not run. Kept, so the first uncovered frame starts from the same state:
     the scene clock, the pointer and camera eases, the scene daylight, the world's load triggers and close. Phones keep their earlier
     world-only early return (it runs first, so their behaviour is unchanged). */
  item('covered', () => {
    const anchor = '        const motion = reduceMotion ? 0 : 1;\n        /* Freeze the parallax input while the drop transition runs: the camera';
    const block =
      '        const motion = reduceMotion ? 0 : 1;\n' +
      '        /* cover (perf): covered and settled. Only the cheap eases, the clock, the daylight and the world\'s load triggers run. */\n' +
      '        if (!manual && (portfolio?.covering || world?.covering) && Math.abs(journey.target - journey.progress) < 1e-4 && Math.abs(journey.velocity || 0) < 1e-4) {\n' +
      '          if (!(dropTransition.target > 0 || dropTransition.progress > .001)) pointerSoft.lerp(pointer, 1 - Math.exp(-dt * 2.4));\n' +
      '          const coverCamX = CONFIG.camera.x + pointerSoft.x * .18 * motion;\n' +
      '          const coverCamY = CONFIG.camera.y - pointerSoft.y * .07 * motion;\n' +
      '          camera.position.y += appliedKick;\n' +
      '          camera.position.x += (coverCamX - camera.position.x) * Math.min(1, dt * 1.8);\n' +
      '          camera.position.y += (coverCamY - camera.position.y) * Math.min(1, dt * 1.8);\n' +
      '          camera.position.z += (CONFIG.camera.z - camera.position.z) * Math.min(1, dt * 1.8);\n' +
      '          appliedKick = impactKick * motion;\n' +
      '          camera.position.y -= appliedKick;\n' +
      '          camera.lookAt(cameraLook.x + pointerSoft.x * .08 * motion, cameraLook.y - pointerSoft.y * .04 * motion, cameraLook.z);\n' +
      '          suppressSceneDaylight(!!world?.open && CONFIG.sceneDaylight.worldOff > .5);\n' +
      '          if (world?.open) setSceneTime(getSceneDaylight().hour);\n' +
      '          else setSceneTime(journeySceneHour({ progress: journey.progress, clock: journeyClock(journey.progress), logoStart: logoChapterStart(), logoEnd: logoChapterEnd(), max: journey.max, portfolio }));\n' +
      '          if (worldEpilogue) {\n' +
      '            if (!worldJob && portfolio?.ready && journey.progress > journey.max - .9 && performance.now() - (journey.lastInput || 0) > 900) loadWorld();\n' +
      '            if (!worldJob && portfolio?.open) loadWorld();\n' +
      '            if (world?.open && !portfolio?.open) world.close();\n' +
      '          }\n' +
      '          animationFrame = requestAnimationFrame(tick); return;\n' +
      '        }\n' +
      '        /* Freeze the parallax input while the drop transition runs: the camera';
    S.main = swap(S.main, anchor, block, 'covered');
  });

  /* ---- slider-rt: the shared card slider never deletes the render targets it replaces on resize (OGL keeps no dispose). The shared file
     stays untouched: a local copy with the same source and two anchored additions is shipped, and the strip loads that copy. */
  item('slider-rt', () => {
    /* the slider module the strip loads right now: a local copy made by an earlier helper (firstpass), or the shared file */
    const local = S.main.match(/sliderUrl: '\.\/(portfolio-slider-[a-z]+\.js)\?v=[^']*'/);
    let m = S.main, localName, s;
    if (local && typeof S.extra[local[1]] === 'string') { localName = local[1]; s = S.extra[local[1]]; }
    else {
      localName = 'portfolio-slider-cover.js';
      s = fs.readFileSync(path.join(ROOT, 'js', 'portfolio-slider.js'), 'utf8').replace(/\r\n/g, '\n');
      m = swap(m, "sliderUrl: '../../../js/portfolio-slider.js?v=4dc9d73082',", "sliderUrl: './portfolio-slider-cover.js?v=i15-cover',", 'slider url');
    }
    s = swap(s, '  const renderTargets = [new RenderTarget(gl, { depth: false }), null];',
      '  /* cover (perf): delete a replaced target\'s GL objects; instances are checked, so an unexpected layout deletes nothing */\n' +
      '  const freeTarget = rt => { if (!rt) return; for (const k of ["buffer", "depthBuffer", "stencilBuffer", "depthStencilBuffer"]) { const o = rt[k]; if (typeof WebGLFramebuffer !== "undefined" && o instanceof WebGLFramebuffer) gl.deleteFramebuffer(o); else if (typeof WebGLRenderbuffer !== "undefined" && o instanceof WebGLRenderbuffer) gl.deleteRenderbuffer(o); } const t = rt.texture?.texture; if (typeof WebGLTexture !== "undefined" && t instanceof WebGLTexture) gl.deleteTexture(t); };\n' +
      '  const renderTargets = [new RenderTarget(gl, { depth: false }), null];', 'slider decl');
    s = swap(s, '    if (resized || !sceneTarget) {\n      sceneTarget = new RenderTarget(gl);',
      '    if (resized || !sceneTarget) {\n      freeTarget(sceneTarget); freeTarget(renderTargets[1]);\n      sceneTarget = new RenderTarget(gl);', 'slider scene');
    s = swap(s, '    if (resized) { renderTargets[0] = new RenderTarget(gl, { depth: false }); resized = false; }',
      '    if (resized) { freeTarget(renderTargets[0]); renderTargets[0] = new RenderTarget(gl, { depth: false }); resized = false; }', 'slider resize');
    S.extra[localName] = localName === 'portfolio-slider-cover.js' ? '/* index1-5 LOCAL COPY of js/portfolio-slider.js (prototypes/index1-5-morning-20261026/perf-cover-build.cjs). The shared file is untouched. */\n' + s : s;
    S.main = m;
  });

  console.log('COVER items: ' + log.join('; '));
  return { ...state, main: S.main, extra: S.extra };
};
