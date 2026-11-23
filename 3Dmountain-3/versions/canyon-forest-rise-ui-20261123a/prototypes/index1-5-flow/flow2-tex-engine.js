/* flow2-tex-engine.js — index1-5-canyon-forest.html only (2026-11-16 performance round: textures in place of per-pixel work).
   Owner: ENGINE (see .qa/index1-5/flow2-tex/BRIEF.md). ?tex=0 turns the whole round off; ?texE=0 turns off this file only.

   SAMPLE 1 — no canyon under the view from above.
   When the view from above (flow2-forest-atlas.js) covers the screen, its pass composes  live = mix(base, forest, uWeight * m)  with
   uWeight = 1 and m = 1 (no brush stroke on the screen): the valley's picture under it ("base") is multiplied by zero. The engine still
   drew that picture every frame: the main pass cleared and resolved the 4x multisampled scene target (with the forest-atlas's empty
   scene in it), then the glass mark's two passes, the speed streaks, the light shafts, the bloom (five mips), Output, the lunge grade and
   the sharpen ran on it, each a full 2820 x 1395 surface at the client's window (≈ 1.3–1.6 ms of the forest frame on an RTX 4070).
   Here, on exactly those frames, the main pass hands the composer the scene target untouched and the passes between it and the
   forest-atlas pass sit out that one frame (their own `enabled` comes back as soon as the composer is done). Nothing on the screen
   changes: the forest-atlas pass decides "covered" itself (it swaps the main pass's scene for its empty scene), and we follow that.
   While the brush paints (either way), during the lift cut, on the canyon and at the first frame back, everything is drawn as before.
   Every quality tier gains the same; low stays the lightest.
   Live: window.__FLOW2_TEX_ENGINE__ = { on, state } — set .on = false to compare in the same page (A/B). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search), html = document.documentElement;
  if (!html.hasAttribute('data-flow2-tex') || Q.get('tex') === '0' || Q.get('texE') === '0') return;
  const S = { stage: 'waiting', covered: false, frames: 0, skipped: 0, passesOff: 0, coveredRun: 0 };
  const SKIP = Q.get('texEskip') !== '0', KEEP_WARM = (v => Number.isFinite(v) ? Math.max(0, Math.round(v)) : 30)(parseFloat(Q.get('texEwarmN')));
  const api = window.__FLOW2_TEX_ENGINE__ = { on: true, state: S };
  /* SAMPLE 2 (iGPU round, client: 「這跑內顯時候會卡」) — settle(renderer, warm): make a module's one-time warm-up draw never block.
     A warm-up that DRAWS (renderer.render into a small target) compiles every program it meets synchronously: 0.25–0.37 s frames during the
     canyon's start (the view from above prepared early: its air and land programs, measured in .qa/index1-5/flow2-tex/engine/igpu/).
     settle() runs the same warm-up once with renderer.render replaced by renderer.compile (same targets, same tone mapping: the variants it
     will draw), lets the driver compile them on its own threads (KHR_parallel_shader_compile) and resolves when every program reports ready
     (at most 20 s); the module then runs its real warm-up, which no longer waits for any compile. Nothing is drawn differently. */
  api.settle = function (renderer, warm, { timeout = 20000 } = {}) {
    const t0 = performance.now(), mats = new Set(), real = renderer.render, st = api.settled = api.settled || { calls: 0, programs: 0, ms: [] };
    st.calls++;
    renderer.render = function (scene, camera) { try { for (const m of renderer.compile(scene, camera)) mats.add(m); } catch (error) { st.error = String(error && error.message || error); } };
    try { warm(); } catch (error) { st.error = String(error && error.message || error); } finally { renderer.render = real; }
    const programs = () => { const l = []; for (const m of mats) { const p = renderer.properties.get(m); if (p.programs) p.programs.forEach(pr => l.push(pr)); else if (p.currentProgram) l.push(p.currentProgram); } return l; };
    return new Promise(done => { (function poll() { let ok = true, l = []; try { l = programs(); ok = l.every(p => !p.isReady || p.isReady()); } catch (error) { ok = true; }
      if (ok || performance.now() - t0 > timeout) { st.programs += l.length; st.ms.push(Math.round(performance.now() - t0)); done(); } else setTimeout(poll, 40); })(); });
  };
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const beforeAttach = host.attach;
  host.attach = function (h = {}) { try { return beforeAttach?.call(this, h); } finally { try { install(h); } catch (error) { S.stage = 'failed: ' + (error?.message || error); } } };

  /* SAMPLE 2b — the post passes' programs (bloom blurs, high-pass, copy, Output, grade, sharpen, the later passes) were compiled on the frame
     they were first used, when the page goes live: a 0.19–0.31 s frame (iGPU code path). Here they are compiled while the page starts, both
     variants (into a target and to the screen), with the clipping state a pass draw has (none), in parallel; settle() waits, nothing draws. */
  function warmPosts(h) {
    const { THREE, renderer, composer } = h;
    if (!THREE || !renderer || !composer || typeof renderer.compile !== 'function') return;
    const st = api.posts = { rounds: 0, materials: 0 };
    const seen = new WeakSet(), geo = new THREE.PlaneGeometry(2, 2), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    const probe = new THREE.Scene(); { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false })); m.frustumCulled = false; probe.add(m); }
    const round = () => {
      const mats = [];
      for (const p of composer.passes || []) { if (!p) continue; for (const m of [p.material, p.fsQuad && p.fsQuad.material, p.compositeMaterial, p.blendMaterial, p.materialHighPassFilter, p.copyMaterial, ...(p.separableBlurMaterials || [])]) if (m && m.isMaterial && !seen.has(m)) { seen.add(m); mats.push(m); } }
      if (!mats.length) return;
      st.rounds++; st.materials += mats.length;
      const scene = new THREE.Scene(); for (const m of mats) { const q = new THREE.Mesh(geo, m); q.frustumCulled = false; scene.add(q); }
      const was = renderer.getRenderTarget(), clip = renderer.localClippingEnabled;
      try { renderer.localClippingEnabled = false; renderer.setRenderTarget(rt); renderer.render(probe, cam); } finally { renderer.setRenderTarget(was); renderer.localClippingEnabled = clip; }   // a real 1-quad draw: the clipping state a pass has
      api.settle(renderer, () => { for (const target of [rt, null]) { const w = renderer.getRenderTarget(); try { renderer.setRenderTarget(target); renderer.render(scene, cam); } finally { renderer.setRenderTarget(w); } } });
    };
    try { round(); } catch (error) { st.error = String(error && error.message || error); }
    for (const ms of [1500, 3500]) setTimeout(() => { try { round(); } catch (error) { st.error = String(error && error.message || error); } }, ms);
  }

  /* SAMPLE 3 (phase 3, client: 「修剩下的卡頓」) — big pictures uploaded in strips. The view from above prepares its pictures while the visitor
     is already in the canyon; renderer.initTexture() sent the 8K bake (7968 × 4459, 173 MB with its mips) to the GPU in ONE call: a 0.14–0.25 s
     frame. Here, for pictures of 8 M pixels and more: three allocates the texture as always (texStorage2D, all mip levels — its own bookkeeping
     is complete), but the pixels go in strips of rows, one strip per animation frame (≤ STRIP_MS of main-thread work), and the mips are made
     after the last strip. Nothing samples the picture before the view from above is reached; if it is reached first (a chapter jump),
     the rest goes at once — the old behaviour. The picture itself is the same bytes. Off: ?texEplate=0. State: __FLOW2_TEX_ENGINE__.strips */
  function stripUploads(h) {
    const { renderer } = h;
    if (Q.get('texEplate') === '0' || !renderer || typeof renderer.initTexture !== 'function' || renderer.__flow2TexStrips) return;
    renderer.__flow2TexStrips = true;
    const gl = renderer.getContext(), state = renderer.state, ST = api.strips = { textures: 0, strips: 0, done: 0, flushed: 0, maxMs: 0, totalMs: 0, rows: 0, MB: 0 };
    const MIN_PX = 8e6, ROWS_MB = 6;   /* strips of ≈ 6 MB (≈ 1.5–2 ms on the 4070's main thread) */
    const PERF_RISE = Q.get('perf') !== '0' && html.hasAttribute('data-rise-studio-pbr');
    const jobs = [];
    const init = renderer.initTexture.bind(renderer);
    renderer.initTexture = function (t) {
      const im = t && t.image, w = im && (im.width || im.naturalWidth), h = im && (im.height || im.naturalHeight);
      const plain = t && t.isTexture && !t.isRenderTargetTexture && !t.isDataTexture && !t.isCompressedTexture && !t.isCubeTexture && !t.isVideoTexture && !t.isCanvasTexture && !(t.mipmaps && t.mipmaps.length) && !t.isFramebufferTexture && t.format === 1023 && t.type === 1009;   /* RGBA, unsigned bytes */
      const bitmap = (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap) || (typeof HTMLImageElement !== 'undefined' && im instanceof HTMLImageElement);
      /* PERF (strike team PIPE, 2026-11-21; rise page, ?perf=0 = as before): pictures their loader marks (userData.flow2Strips: the view from
         above's twelve PBR tiles, decoded off the main thread) also go in strips from 1 M pixels on, instead of one upload call each */
      const marked = PERF_RISE && t && t.userData && t.userData.flow2Strips === true && w * h >= 1e6;
      if (!plain || !bitmap || !(w * h >= MIN_PX || marked) || t.flipY || t.source.dataReady === false) return init(t);
      /* three allocates the storage and its mip levels, uploads nothing (source.dataReady false), records the source as uploaded */
      t.source.dataReady = false;
      try { init(t); } finally { t.source.dataReady = true; }
      const glTex = renderer.properties.get(t).__webglTexture;
      if (!glTex) return;
      const rows = Math.max(16, Math.floor(ROWS_MB * 1048576 / (w * 4)));
      jobs.push({ t, glTex, w, h, y: 0, rows, mips: t.generateMipmaps && t.minFilter !== 1006 && t.minFilter !== 1003 });
      ST.textures++; ST.MB += Math.round(w * h * 4 / 1048576); ST.rows = rows;
      if (jobs.length === 1) requestAnimationFrame(pump);
    };
    const covered = () => { const A = window.__FLOW2_FOREST_ATLAS__, C = window.__FLOW2_LIFT_CUT__, J = window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey;
      return !!((A && A.state && (A.state.view === 1 || (A.override && A.override.on))) || (C && C.state && C.state.phase && C.state.phase !== 'idle') || (J && J.progress > 9.3)); };
    const strip = (job, all) => {
      const t0 = performance.now();
      state.bindTexture(gl.TEXTURE_2D, job.glTex, gl.TEXTURE0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!job.t.premultiplyAlpha);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, job.t.unpackAlignment); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      try {
        do {
          const n = Math.min(job.rows, job.h - job.y);
          gl.pixelStorei(gl.UNPACK_SKIP_ROWS, job.y);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, job.y, job.w, n, gl.RGBA, gl.UNSIGNED_BYTE, job.t.image);
          job.y += n; ST.strips++;
        } while (all && job.y < job.h);
      } finally { gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0); }
      if (job.y >= job.h) { if (job.mips) gl.generateMipmap(gl.TEXTURE_2D); ST.done++; }
      const ms = performance.now() - t0; ST.totalMs += ms; if (ms > ST.maxMs) ST.maxMs = +ms.toFixed(2);
    };
    function pump() {
      const job = jobs[0]; if (!job) return;
      try {
        if (covered()) { ST.flushed++; while (jobs.length) { strip(jobs[0], true); jobs.shift(); } return; }
        strip(job, false); if (job.y >= job.h) jobs.shift();
      } catch (error) { ST.error = String(error && error.message || error); while (jobs.length) { const j = jobs.shift(); try { j.t.needsUpdate = true; } catch (e) { } } return; }   /* on any failure three uploads the whole picture itself */
      if (jobs.length) requestAnimationFrame(pump);
    }
  }

  /* SAMPLE 4 (phase 3) — the canyon's first live frame done under the start cover. The canyon is parked (not drawn) while the start cover
     stands; its first live frame then uploaded ≈ 120 MB of pictures and ≈ 125 MB of geometry and drew every program for the first time:
     a 0.11–0.19 s frame just as the cover fades. Here, while the cover still stands (html[data-flow2-still] ≠ off) and the canyon exists,
     the canyon is drawn into a 16 × 16 target with its own lens (programs first compiled in parallel through settle(); at most 4 times,
     ≥ 1.2 s apart, so pieces added later are caught too). Nothing of it is seen. Off: ?texEcover=0. State: __FLOW2_TEX_ENGINE__.cover */
  function coverWarm(h) {
    const { THREE, renderer } = h, html = document.documentElement;
    if (Q.get('texEcover') !== '1' || !THREE || !renderer) return;   /* OPT-IN (?texEcover=1): measured 23:55 — the first live frame's uploads are the mark's targets, not the canyon's, and the parallel compile may delay the lift */
    const S = api.cover = { stage: 'waiting', draws: 0, ms: [], settleMs: [] };
    let rt = null, busy = false, last = 0;
    const tick = () => {
      if (html.dataset.flow2Still === 'off' || S.draws >= 4) { S.stage = S.draws ? 'done (' + S.draws + ')' : 'cover lifted first'; if (rt && !busy) { rt.dispose(); rt = null; } return; }
      const C = window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.canyon;
      if (C && C.scene && C.camera && !busy && performance.now() - last > 1200) {
        busy = true; last = performance.now(); S.stage = 'warming';
        rt ||= new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, depthBuffer: true });
        const draw = () => { const was = renderer.getRenderTarget(); try { renderer.setRenderTarget(rt); renderer.render(C.scene, C.camera); } finally { renderer.setRenderTarget(was); } };
        const t0 = performance.now();
        api.settle(renderer, draw).then(() => {
          S.settleMs.push(Math.round(performance.now() - t0));
          if (html.dataset.flow2Still !== 'off') { const t = performance.now(); try { draw(); } catch (error) { S.error = String(error && error.message || error); } S.draws++; S.ms.push(+(performance.now() - t).toFixed(1)); }
          busy = false;
        });
      }
      setTimeout(tick, 250);
    };
    tick();
  }

  /* VRAM (2026-11-18, client: 「顯示卡記憶體 繼續修」). Measured (.qa/index1-5/flow2-tex/engine/igpu/vram.cjs): the page's WebGL memory is
     ≈ 1.87 GB on the 4070 (high, drawn at 1.5×) and ≈ 1.0 GB on the AMD path (low). The biggest: three 4×-multisampled HalfFloat targets at the
     drawing size (each 120 MB of colour + 60 MB of depth): the scene's, the glass mark's, and three's own TRANSMISSION target (the glass's
     refraction source, 4× + a mip chain). At a 1.5× drawing scale every pixel already carries 2.25 samples; 4× MSAA on top doubles memory for
     edges nobody can tell apart at the client's window. Here, only when drawn at ≥ 1.25×:
       · the scene target: 4× → 2× MSAA (?texEvramMsaa=0 = as before);
       · three's transmission targets (made by three for any transmissive material): no MSAA (they hold a full-screen backdrop quad and the
         glass's back faces, which are only ever seen refracted through the glass) and the size of the window in CSS pixels instead of the
         drawing size (the refraction reads it with screen-relative coordinates). OFF by default since 2026-11-18 01:00: the smaller target turned the
         canyon drop into a flat pale ball (client: 「水滴怎變這樣」; three draws the backdrop at the full viewport into it); ?texEvramTx=1 = on.
     The glass's own target (flow2-mark.js) and the plate (flow2-original-scene.js), the gorge (dg-scene.js) take their part in their files.
     ?texEvram=0 turns every VRAM step off. State: __FLOW2_TEX_ENGINE__.vram */
  const VRAM = Q.get('texEvram') !== '0';
  const VR = api.vram = { on: VRAM, scene: '', tx: 0, txSize: '' };
  const drawScale = renderer => { try { const c = renderer.domElement; return c.width / Math.max(1, c.clientWidth || innerWidth); } catch (error) { return 1; } };
  function vramTransmission(h) {
    const { THREE, renderer } = h;
    if (!VRAM || Q.get('texEvramTx') !== '1' || !THREE || !THREE.WebGLRenderTarget || THREE.WebGLRenderTarget.prototype.__flow2TxPatched) return;
    const P = THREE.WebGLRenderTarget.prototype, setSize = P.setSize;
    P.__flow2TxPatched = true;   /* (the per-target flag below is an own property; this one only says the patch is in) */
    P.setSize = function (w, hgt, d) {
      /* three's transmission target: made at 1 × 1 with 4 samples, mip-mapped, depth not resolved (WebGLRenderer.renderTransmissionPass) */
      if (!Object.prototype.hasOwnProperty.call(this, '__flow2Tx')) this.__flow2Tx = this.width === 1 && this.height === 1 && this.samples === 4 && this.resolveDepthBuffer === false && this.texture && this.texture.generateMipmaps === true && this.texture.minFilter === THREE.LinearMipmapLinearFilter;
      if (this.__flow2Tx) {
        if (!VR.txList) Object.defineProperty(VR, 'txList', { value: [], enumerable: false }); if (!VR.txList.includes(this)) VR.txList.push(this);
        const k = drawScale(renderer);
        if (k >= 1.25 && !this.__flow2TxOff) { if (this.samples !== 0) { this.samples = 0; this.dispose(); } w = Math.max(1, Math.round(w / k)); hgt = Math.max(1, Math.round(hgt / k)); }
        if (this.width !== w || this.height !== hgt) { VR.tx++; VR.txSize = w + 'x' + hgt; }
      }
      return setSize.call(this, w, hgt, d);
    };
  }
  function vramScene(target, renderer) {
    if (!VRAM || Q.get('texEvramMsaa') === '0' || !target || target.__flow2Vram) return;
    target.__flow2Vram = true; Object.defineProperty(VR, 'target', { value: target, configurable: true, enumerable: false });   /* for the A/B crops */
    /* PERF (strike team, 2026-11-21; rise page, ?perf=0 or ?perfMsaa=0 = as before): a LOW start also takes 2x (it drew 4x at the window's own
       size: the tier meant to be lightest carried the heaviest target per pixel). Tier step: high and medium are not touched by this line. */
    const lowStart = Q.get('perf') !== '0' && Q.get('perfMsaa') !== '0' && html.hasAttribute('data-rise-studio-pbr') && window.__FLOW2_QUALITY__ && window.__FLOW2_QUALITY__.start === 'low';
    if (target.samples > 2 && (drawScale(renderer) >= 1.25 || lowStart)) { target.samples = 2; target.dispose(); VR.scene = '2x at ' + drawScale(renderer).toFixed(2) + (lowStart ? ' (low start)' : ''); }
    else VR.scene = 'kept ' + target.samples + 'x at ' + drawScale(renderer).toFixed(2);
  }

  function install(h) {
    try { vramTransmission(h); } catch (error) { VR.error = String(error && error.message || error); }
    try { coverWarm(h); } catch (error) { /* the canyon's first frame as before */ }
    try { stripUploads(h); } catch (error) { /* the page uploads as before */ }
    try { warmPosts(h); } catch (error) { /* the page draws as before */ }
    const composer = h.composer, study = window.__MONTIS_STUDY__, main = study && study.mainRenderPass;
    if (composer) Object.defineProperty(api, 'composer', { value: composer, configurable: true, enumerable: false });   /* PERF 2026-11-21: read-only use (its buffer size) by the glass logo's preparation */
    if (!composer || !main || typeof main.render !== 'function' || main.__flow2TexE) { if (!main?.__flow2TexE) S.stage = 'off: no composer / main pass'; return; }
    main.__flow2TexE = true;
    let sceneTarget = null, held = [];
    /* the forest-atlas pass: a ShaderPass whose uniforms carry the forest picture and its weight */
    const forestIndex = passes => passes.findIndex(p => p && p.enabled && p.uniforms && p.uniforms.tForest && p.uniforms.uWeight);
    /* covered = flow2-forest-atlas.js drew this frame with its empty scene in the main pass (its own test: active, weight 1, no brush) */
    const covered = pass => {
      const sc = pass.scene, A = window.__FLOW2_FOREST_ATLAS__;
      if (!sc || !sc.isScene || sc.children.length || !A || !A.state || A.state.view !== 1 || (A.override && A.override.on)) return false;
      return !!sceneTarget && forestIndex(composer.passes) > composer.passes.indexOf(pass);
    };
    const render = main.render;
    main.render = function (r, writeBuffer, readBuffer, ...rest) {
      S.frames++;
      /* RETURN TRIP (2026-11-17): a canyon skipped for seconds goes cold (its targets and pictures are the least recently used on a full GPU and get
         paged out; the way back then pages them in on the first frames). Every KEEP_WARM-th covered frame is drawn as before, so they stay resident;
         ?texEskip=0 = never skipped, ?texEwarmN=0 = never drawn while covered (as on 11-16). */
      const keep = KEEP_WARM > 0 && S.covered && (++S.coveredRun % KEEP_WARM === 0);
      if (!SKIP || !api.on || keep || !covered(this)) {
        if (keep) S.kept = (S.kept || 0) + 1;
        const out = render.call(this, r, writeBuffer, readBuffer, ...rest);
        sceneTarget = composer.readBuffer;   // main.js hands the composer its multisampled scene target here
        if (!sceneTarget.__flow2Vram) { try { vramScene(sceneTarget, r); } catch (error) { VR.error = String(error && error.message || error); } }
        if (!keep) { S.covered = false; S.coveredRun = 0; }
        return out;
      }
      /* the picture under the view is not needed: the same hand-off main.js makes, without drawing or resolving the target */
      composer.readBuffer = sceneTarget; composer.writeBuffer = composer.renderTarget1;
      const list = composer.passes, from = list.indexOf(this), to = forestIndex(list);
      for (let i = from + 1; i < to; i++) { const p = list[i]; if (p && p.enabled) { p.enabled = false; held.push(p); } }
      S.covered = true; S.skipped++; S.passesOff = held.length;
    };
    /* every pass we set aside comes back the moment the composer is done with this frame (the page's own logic sets `enabled` between frames) */
    const run = composer.render;
    composer.render = function (...args) {
      try { return run.apply(this, args); }
      finally { if (held.length) { for (const p of held) p.enabled = true; held = []; } }
    };
    S.stage = 'on';
  }
})();
