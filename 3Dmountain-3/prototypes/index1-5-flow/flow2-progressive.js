/* Flow2 · progressive start (2026-11-14, night). index1-5-flow2.html only. ?progressive=0 leaves it out (the page then compiles
   everything first, as before).
   Client: 「進場直接就3D 不要一張靜態圖」 — straight into the 3D. The fifth valley round made the wait for the live valley ~2 s longer:
   the walls' shader program (`ALP_BANK`: the two canyon banks, and the far range drawn with the same kind of material) grew by the
   round's links (rock beds and shore slabs, the value floor, cloud shadows) and the GPU driver now needs ~6 s instead of ~4 s to
   compile it; the page waits for every program before it shows the valley.

   What this does: those meshes are shown first with their program as it was before the fifth round (rounds 1–4, compiled as fast
   as before, and started here ~0.1 s earlier than the page would). Once the valley is live, their whole program is compiled in
   the background, one at a time: the banks first, the far range once the banks are on (measured: two of these at once, or one
   beside the page's own last steps, slow the page's start and make the page's own calls wait: frames of 100–700 ms). The moment
   one is ready its first-use tables are made (another module's material sharing the program, the top-down land, then pays nothing
   for them); 0.8 s later (the banks) it is drawn once off the screen and its meshes change to it on one frame with the round's
   wall detail at zero (nothing changes on that frame), and the detail fades in over 1.2 s.
   Everything else of the round (the river, the stones, the far massifs, the light and the walls' shadows, the rocks and the
   plants) is not held back: those programs are not the slow ones. The cloud shadows wait, everywhere, until the walls can take
   them, and fade in with them.

   How: this script loads AFTER the fourth round's modules and BEFORE the fifth's. On the page's canyon hand-over it notes the
   walls' materials as the fourth round left them (onBeforeCompile chain + cache key) and compiles a copy carrying that chain;
   once every module has chained on, the meshes get that copy, and a second copy carrying the whole chain is compiled. The
   original materials are not changed (the page's program cache keys are the ones it would have used: nothing compiles twice).
   The fade drives private copies of the round's wall uniforms; when it is done the meshes go back to the page's own material
   (same program, found by its cache key): from then on the page draws exactly as it would without this file.
   If a GPU refuses to link the whole program (e.g. too few texture units), the walls keep the earlier look instead of going black.
   Live: window.__FLOW2_PROGRESSIVE__ = { tune, state, material(meshOrMaterial) }; doc docs/flow2/flow2-progressive-start-20261114.md. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    fade: num('progressiveFade', 1.2),          // seconds over which the held-back wall detail comes in
    mode: Q.get('progressiveMode') || 'chain',   // when the whole programs are compiled: 'chain' (once the page is live, the banks, then
                                                 // the far range: one at a time), 'after' (both once live), 'stagger' (the banks at
                                                 // once beside the page's own: their detail ~3 s sooner, the page live ~0.3–1.5 s
                                                 // later), 'parallel' (both at once)
    next: num('progressiveNext', 0),             // 'chain': > 0 = the far range starts at most this many seconds after the banks (tests)
    settle: num('progressiveSettle', .8),        // seconds between a program being ready and the change (others' first draws pass first)
    depth: Q.get('progressiveDepth') === '1'     // tests only: compile flow2-valley5-light.js's shadow-depth program here too (measured: no
                                                 // gain, it waits for the walls' program anyway; and a copy of another module's shader
                                                 // text under its cache key would go stale if that module changes it)
  };
  const S = { mode: 'waiting for the canyon', marks: {}, jobs: [], fade: 0 };
  const API = window.__FLOW2_PROGRESSIVE__ = { tune: T, state: S };
  if (Q.get('progressive') === '0') { S.mode = 'off (?progressive=0)'; return; }
  if (window.__FLOW2_QUALITY__?.start === 'low') { S.mode = 'off at a low start (the round adds little to the walls there)'; return; }
  const mark = key => { S.marks[key] ??= Math.round(performance.now()); };
  const smooth = x => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  const NL = String.fromCharCode(10);
  const jobs = [];
  let ctx = null;
  Object.defineProperty(API, 'jobs', { value: jobs });   // (for the checks in .qa/index1-5/flow2-valley5/startup/)
  /* for modules that draw more land with the walls' material: the material that carries (or will carry) the whole program */
  API.material = x => { const m = x?.isMaterial ? x : x?.material; const j = jobs.find(j => j.original === m || j.early === m || j.whole === m || j.meshes.includes(x)); return j ? (j.restored ? j.original : j.whole) : m; };

  /* a copy of a material that keeps everything the page and the modules hung on it (shared userData, the alpine sync,
     the default attribute values), with its own shader chain */
  function twin(m, obc, key, label) {
    const ud = m.userData; m.userData = {};
    let t; try { t = m.clone(); } finally { m.userData = ud; }
    t.userData = ud;
    for (const k of Object.keys(m)) if (!k.startsWith('_') && !(k in t)) t[k] = m[k];
    if (Object.prototype.hasOwnProperty.call(m, 'onBeforeRender')) t.onBeforeRender = m.onBeforeRender;
    if (m.defaultAttributeValues) t.defaultAttributeValues = m.defaultAttributeValues;
    t.onBeforeCompile = obc; t.customProgramCacheKey = key;
    t.name = (m.name || 'canyon walls') + ' · ' + label;
    return t;
  }
  /* the 64-pixel half-float target: the kind of target the page compiles and warms in (a program depends on it) */
  const target = () => ctx.rt ||= new ctx.THREE.WebGLRenderTarget(64, 64, { type: ctx.THREE.HalfFloatType });
  /* hand three a group of stand-ins (the real geometries, the given materials) to compile with the canyon's lights and air */
  function compileWith(pairs, label) {
    const { THREE, renderer, canyon } = ctx;
    const group = new THREE.Group(); group.name = 'flow2 progressive · ' + label + ' (compile only)';
    const proxies = pairs.map(([o, material]) => { const p = new THREE.Mesh(o.geometry, material); p.frustumCulled = false; p.receiveShadow = o.receiveShadow; group.add(p); return p; });
    const prev = renderer.getRenderTarget(), t0 = performance.now();
    try { renderer.setRenderTarget(target()); renderer.compile(group, canyon.camera, canyon.scene); }
    finally { renderer.setRenderTarget(prev); (S.submitMs ||= {})[label] = Math.round((performance.now() - t0) * 10) / 10; }
    return proxies;
  }

  /* 1 · on the hand-over, after rounds 1–4 have chained on: the walls' materials as they left them, compiled now */
  function before5(handles) {
    const { THREE, renderer, canyon } = handles;
    if (handles.lite || (innerWidth < 760 && !document.documentElement.hasAttribute('data-flow2-phone-full'))) { S.mode = 'not on the lighter drawing'; return; }
    if (!THREE || !renderer?.properties || !canyon?.scene) { S.mode = 'no canyon handed over'; return; }
    /* the materials whose plain (not instanced) meshes compile the walls' program, ALP_BANK */
    const seen = new Map();
    canyon.scene.traverse(o => {
      const m = o.material;
      if (!o.isMesh || o.isInstancedMesh || Array.isArray(m) || !m?.userData?.alpineTerrain || typeof m.onBeforeCompile !== 'function') return;
      if (!seen.has(m)) {
        let k = ''; try { k = String(m.customProgramCacheKey()); } catch (error) { return; }
        if (!k.includes('alpine-terrain-v2-rock') || k.includes('-lite')) return;
        const lite = { obc: m.onBeforeCompile, key: m.customProgramCacheKey };
        /* the early copy keeps the earlier chain AND its cache key: should the fifth round add nothing to these walls, the page's
           own compile finds this very program */
        const early = twin(m, function (shader, r) { lite.obc.call(this, shader, r); capture(shader); }, lite.key, 'early');
        seen.set(m, { lite, early, meshes: [] });
      }
      seen.get(m)?.meshes.push(o);
    });
    if (!seen.size) { S.mode = 'no canyon walls found'; return; }
    ctx = { THREE, renderer, canyon, lite: seen };
    mark('handover');
    try { compileWith([...seen.values()].flatMap(e => e.meshes.map(o => [o, e.early])), 'early walls'); mark('earlyCompile'); }
    catch (error) { console.warn('flow2 progressive: the early walls are left to the page', error); }
    queueMicrotask(afterAll);   // runs after every module's link and before the page goes on to compile
  }

  /* 2 · after every link: the meshes draw with the earlier chain; the whole chain is compiled here */
  const FADED = { uV5R: [0], uV5R2: [1], uV5RS: [0], uV5LCl: [0] };   // the components that switch the held-back parts on
  function afterAll() {
    for (const [m, e] of ctx.lite) {
      const full = { obc: m.onBeforeCompile, key: m.customProgramCacheKey };
      if (full.obc === e.lite.obc) continue;   // nothing of the fifth round on these meshes: they keep their material
      const job = { name: e.meshes.map(o => o.name || o.type).join(', '), original: m, meshes: e.meshes, early: e.early, f: 0, start: -1, own: {}, shared: {}, state: 'early' };
      job.earlyObc = e.early.onBeforeCompile; job.earlyKey = e.early.customProgramCacheKey;
      /* the whole chain, then its faded uniforms swapped for this copy's own (driven from the shared ones by the fade) */
      job.whole = twin(m, function (shader, r) {
        full.obc.call(this, shader, r);
        job.uniforms = shader.uniforms;   // three keeps this very object as the copy's uniforms
        for (const k of Object.keys(FADED)) { const u = shader.uniforms[k]; if (!u || !Array.isArray(u.value)) continue; job.shared[k] = u; shader.uniforms[k] = job.own[k] ||= { value: u.value.slice() }; }
        capture(shader);
      }, full.key, 'whole');
      for (const o of e.meshes) if (o.material === m) o.material = e.early;
      jobs.push(job); S.jobs.push({ name: job.name, meshes: e.meshes.length, state: 'early' });
    }
    if (!jobs.length) { S.mode = 'nothing to hold back'; return; }
    hookFade(ctx.canyon);
    const first = lead(), rest = jobs.filter(j => j !== first);
    if (T.mode === 'after' || T.mode === 'chain') setTimeout(() => dryRun(first), 0);   // the modules' compile-time hand-overs, without compiling
    if (T.mode === 'after') { S.mode = 'waiting for the page to be live'; whenLive(() => compileWhole(jobs)); }
    else if (T.mode === 'chain') {
      /* the banks first; the far range once the banks are on (measured: started beside the banks' compile, it made the page's
         own calls wait at the banks' change: frames of 125–225 ms; one after the other, nothing over 25 ms) */
      S.mode = 'waiting for the page to be live';
      whenLive(() => {
        let go = () => { go = () => { }; compileWhole(rest); };
        first.next = () => go(); compileWhole([first]);
        if (T.next > 0) setTimeout(() => go(), T.next * 1000);
      });
    }
    else if (T.mode === 'parallel' || jobs.length < 2) compileWhole(jobs);
    else { compileWhole([first]); whenEarlyReady(() => compileWhole(rest)); }
  }
  /* the page's own programs are back and its first live frame is on the screen (measured: a big program compiling beside the
     page's last steps holds its first frame back, and two at once make the first seconds after it rougher) */
  function whenLive(fn) {
    const html = document.documentElement;
    whenEarlyReady(() => {
      const valley = html.dataset.flow2Start === 'valley', t0 = performance.now();
      const tick = () => {
        if ((valley ? html.dataset.flow2Still === 'off' : performance.now() - t0 > 400)) { mark('live'); calm(fn); }
        else setTimeout(tick, 30);
      };
      tick();
    });
  }
  /* >>> flow2-tex GROUND (2026-11-17, client: 「修剩下的卡頓」; copy: .qa/index1-5/flow2-tex/before/flow2-progressive.js.before-ground).
     The whole walls' compile request (its link is handed to the driver in the frame it is asked) landed, in some loads, inside the
     page's first live frames (three's first use of the canyon's geometry: one ~100-130 ms frame right after the cover lifts) and
     stacked onto it: 113-157 ms frames with "canyon walls · whole" in them. On the tex page it now waits for the page to be calm:
     12 frames in a row under 25 ms after "live" (at most 3 s), then asks. The look and the swap are unchanged; the round's wall
     detail fades in a little later (about 0.3-1 s). ?progressiveCalm=0 = as before. */
  const CALM = html0 => html0.hasAttribute('data-flow2-tex') && Q.get('tex') !== '0' && Q.get('progressiveCalm') !== '0';
  function calm(fn) {
    if (!CALM(document.documentElement)) { requestAnimationFrame(() => requestAnimationFrame(fn)); return; }
    const t0 = performance.now(); let last = t0, run = 0;
    const tick = t => { const d = t - last; last = t; run = d < 25 ? run + 1 : 0; if (run >= 12 || t - t0 > 3000) { mark('calm'); requestAnimationFrame(fn); } else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  /* <<< flow2-tex GROUND */
  const lead = () => jobs.find(j => j.meshes.some(o => o.userData?.rim)) || jobs[0];
  /* Some links of the whole chain hand something over when the walls' program is first assembled (flow2-valley5-light.js takes
     the walls' displacement for the depth material that lets them cast their shadow; the shadows must be there from the first
     frame). When the whole program is compiled later, the chain is run once now on the shader text three would hand it
     (string work only, nothing goes to the GPU, the result is thrown away). */
  function dryRun(j) {
    const { THREE, renderer } = ctx, lib = THREE.ShaderLib?.standard;
    if (!lib || j.dry) return; j.dry = true;
    const shader = { shaderID: 'standard', shaderType: j.whole.type, shaderName: j.whole.name, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(lib.uniforms), defines: j.whole.defines, instancing: false, instancingColor: false, isRawShaderMaterial: false };
    const t0 = performance.now();
    try { j.original.onBeforeCompile.call(j.whole, shader, renderer); S.dry = 'run (' + Math.round(performance.now() - t0) + ' ms)'; }
    catch (error) { S.dry = 'failed: ' + (error?.message || error); }
  }
  function whenEarlyReady(fn) {
    const r = ctx.renderer;
    const tick = () => {
      const ok = jobs.every(j => { const p = r.properties.get(j.early)?.currentProgram; return p && p.isReady(); });
      if (ok) { mark('earlyReady'); fn(); } else setTimeout(tick, 16);
    };
    setTimeout(tick, 16);
  }

  /* the walls' displacement (as flow2-valley5-light.js takes it for its depth material), from the first copy compiled */
  function capture(shader) {
    if (ctx.disp || !shader.vertexShader.includes('#define ALP_BANK' + NL)) return;
    const v = shader.vertexShader, a = v.indexOf('float alpBankH('), b = a < 0 ? -1 : v.indexOf('#endif', a);
    if (b > a) ctx.disp = { src: v.slice(a, b), erosion: shader.uniforms.alpineErosion, relief: shader.uniforms.uCliffRelief };
    if (T.depth && ctx.disp && !ctx.depthQueued) { ctx.depthQueued = true; queueMicrotask(depthProgram); }
  }

  function compileWhole(list, then) {
    if (!list.length) return;
    list.then = then;
    mark(list.length === jobs.length ? 'wholeCompile' : 'wholeCompile-' + jobs.indexOf(list[0]));
    const proxies = compileWith(list.flatMap(j => j.meshes.map(o => [o, j.whole])), 'whole walls');
    let n = 0; for (const j of list) { j.proxies = proxies.slice(n, n + j.meshes.length); n += j.meshes.length; j.program = ctx.renderer.properties.get(j.whole)?.currentProgram || null; j.state = 'compiling'; j.t0 = performance.now(); }
    S.mode = 'compiling the whole walls in the background';
    /* asked often (the driver's answer to "ready?" does not wait): the moment it is ready, its first-use tables are fetched here,
       before anything else draws with this program (another module's material with the same cache key may share it: it then
       finds the tables made and does not pay three's log checks inside its own frame) */
    const tick = () => {
      for (const j of list) if (j.state === 'compiling' && (!j.program || j.program.isReady())) { j.state = 'compiled'; j.compileMs = Math.round(performance.now() - j.t0); prepare(j); }
      if (list.some(j => j.state === 'compiling')) setTimeout(tick, 8);
      else if (list.then) { const next = list.then; list.then = null; next(); }   // (chain: the next copy only once this one is back)
    };
    setTimeout(tick, 8);
  }

  /* first use, off the screen: did it link (a GPU with fewer texture units than this machine may refuse the whole program: the
     walls then keep the earlier look rather than going black) and three's tables (uniforms, attributes; its log checks are
     skipped, the link status was just read), at once; then, after a short pause (the page's other modules may start drawing
     with things that waited for this program: their first frames are not stacked onto the change), one real draw, the change */
  function prepare(j) {
    const r = ctx.renderer, gl = r.getContext(), t0 = performance.now();
    try {
      if (j.program && !gl.getProgramParameter(j.program.program, gl.LINK_STATUS)) { j.failed = true; console.warn('flow2 progressive: the whole program of the walls did not link here; they keep the earlier look', gl.getProgramInfoLog(j.program.program)); }
      else { const d = r.debug, was = d.checkShaderErrors; d.checkShaderErrors = false; try { j.program?.getUniforms(); j.program?.getAttributes(); } finally { d.checkShaderErrors = was; } }
    } catch (error) { console.warn('flow2 progressive: a step failed', error); }
    j.steps = [Math.round((performance.now() - t0) * 10) / 10];
    if (j.failed) { j.state = 'failed'; S.mode = 'the whole program did not link on this GPU: the walls keep the earlier look'; const s = S.jobs[jobs.indexOf(j)]; if (s) s.state = 'kept early (no link)'; if (j.next) { const n = j.next; j.next = null; n(); } return; }
    setTimeout(() => requestAnimationFrame(() => setTimeout(() => {
      const t1 = performance.now(); try { warmDraw(j); } catch (error) { console.warn('flow2 progressive: a step failed', error); }
      j.steps.push(Math.round((performance.now() - t1) * 10) / 10);
      j.state = 'prepared'; requestAnimationFrame(() => swap(j));
    }, 0)), j === lead() ? T.settle * 1000 : 0);   // (only the banks' program is shared by other modules' materials)
  }
  /* one draw of the stand-ins with the canyon's own lights (a layer only they and the lights are on), into the small target */
  function warmDraw(j) {
    const { renderer, canyon } = ctx;
    const LAYER = 30, cam = canyon.camera.clone(); cam.layers.set(LAYER);
    const lights = []; canyon.scene.traverse(o => { if (o.isLight) { lights.push([o, o.layers.mask]); o.layers.enable(LAYER); } });
    const group = j.proxies[0].parent, holder = group.parent;
    for (const p of j.proxies) p.layers.set(LAYER);
    canyon.scene.add(group);
    const prev = renderer.getRenderTarget(), sm = renderer.shadowMap, auto = sm.autoUpdate, due = sm.needsUpdate;   // no shadow pass in this draw
    try { sm.autoUpdate = false; sm.needsUpdate = false; renderer.setRenderTarget(target()); renderer.render(canyon.scene, cam); }
    finally { renderer.setRenderTarget(prev); sm.autoUpdate = auto; sm.needsUpdate = due; canyon.scene.remove(group); if (holder) holder.add(group); for (const [o, mask] of lights) o.layers.mask = mask; }
  }

  /* 3 · the change, on a frame of its own, with the held-back detail at zero; then the fade */
  function swap(j) {
    for (const o of j.meshes) if (o.material === j.early) o.material = j.whole;
    j.state = 'whole'; j.start = performance.now(); j.f = 0;
    /* anything else still drawing with the early copy (a module that took the walls' material meanwhile) gets the whole chain
       too: its program is the one just compiled (same cache key); only three's string work runs again on its next draw */
    j.early.onBeforeCompile = j.original.onBeforeCompile; j.early.customProgramCacheKey = j.original.customProgramCacheKey; j.early.needsUpdate = true;
    mark('swap-' + jobs.indexOf(j));
    const s = S.jobs[jobs.indexOf(j)]; if (s) { s.state = 'whole'; s.compileMs = j.compileMs; s.steps = j.steps; }
    if (j.next) { const next = j.next; j.next = null; requestAnimationFrame(() => setTimeout(next, 0)); }   // (chain: the next copy only now)
    if (jobs.every(x => x.state === 'whole')) { mark('swapped'); S.mode = 'whole walls on; fading in'; try { ctx.rt?.dispose(); ctx.rt = null; } catch (error) { } }
  }

  /* the fade, right before each drawing of the canyon (after every module has written its values): each whole copy gets the
     shared values with the held-back parts scaled by its own fade; the cloud shadows everyone else draws wait for the walls */
  let cloudBase = null, cloudWrote = null;
  function fade() {
    const now = performance.now();
    for (const j of jobs) {
      if (j.restored) continue;
      if (j.start >= 0 && j.f < 1) j.f = T.fade > 0 ? smooth((now - j.start) / (T.fade * 1000)) : 1;
      /* done: the meshes go back to the page's own material, whose program this is (same cache key: three finds it, nothing is
         compiled), with the modules' own uniforms and the page's own drawing order (a copy has another material id, and three
         orders opaque meshes by it: a few pixels where surfaces meet came out differently) */
      if (j.f >= 1) { for (const o of j.meshes) if (o.material === j.whole) o.material = j.original; if (j.uniforms) for (const k of Object.keys(j.own)) if (j.shared[k]) j.uniforms[k] = j.shared[k]; j.restored = true; continue; }
      for (const k of Object.keys(j.own)) {
        const own = j.own[k].value, src = j.shared[k]?.value; if (!src) continue;
        for (let i = 0; i < own.length; i++) own[i] = src[i];
        if (k === 'uV5LCl' && cloudBase !== null) own[0] = cloudBase;
        for (const i of FADED[k]) own[i] *= j.f;
      }
    }
    const first = lead(), g = first ? (first.restored ? 1 : first.f) : 1;
    const cl = window.__FLOW2_VALLEY5_LIGHT__?.cloud?.uniforms?.uV5LCl?.value;
    if (cl) { if (cloudWrote === null || cl[0] !== cloudWrote) cloudBase = cl[0]; cl[0] = cloudBase * g; cloudWrote = cl[0]; }
    S.fade = +g.toFixed(3);
    if (jobs.every(j => j.restored || j.state === 'failed')) { mark('faded'); S.mode = jobs.some(j => j.state === 'failed') ? 'done, but the whole program did not link here: those walls keep the earlier look' : 'done: the whole walls'; if (cl && first?.restored) cl[0] = cloudBase; }
  }
  function hookFade(canyon) {
    const scene = canyon.scene, prev = scene.onBeforeRender;
    scene.onBeforeRender = function (...a) { try { prev?.apply(this, a); } finally { try { if (!S.marks.faded) fade(); } catch (error) { S.fadeError = String(error?.message || error); } } };
  }

  /* the walls' shadow-depth program (flow2-valley5-light.js casts the walls through a depth material that runs their own
     displacement): compiled here, beside the page, so the page's warm-up draw does not compile it on the spot. Same text, same
     cache key and settings as three's shadow pass gives it: three hands that module's material this program when it is first drawn. */
  function depthProgram() {
    const { THREE, renderer, canyon } = ctx;
    const L = window.__FLOW2_VALLEY5_LIGHT__, cap = ctx.disp;
    if (!L || /^(low|not|no |failed|small)/.test(L.state?.walls || '') || !cap?.src?.includes('vec4 alpBankDisp(') || !cap.erosion || !cap.relief) { S.depth = 'not compiled here'; return; }
    const bank = [...ctx.lite.values()].flatMap(e => e.meshes).find(o => o.userData?.rim); if (!bank) { S.depth = 'no bank'; return; }
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    m.name = 'flow2 valley5 · walls\' shadow depth';
    m.onBeforeCompile = shader => {
      shader.uniforms.alpineErosion = cap.erosion; shader.uniforms.uCliffRelief = cap.relief;
      shader.vertexShader = 'uniform sampler2D alpineErosion;uniform float uCliffRelief;' + NL + cap.src + NL + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>' + NL + '  { vec3 v5w=(modelMatrix*vec4(position,1.)).xyz; vec3 v5n=normalize(mat3(modelMatrix)*normal); transformed+=normal*alpBankDisp(v5w,v5n).w; }');
    };
    m.customProgramCacheKey = () => 'flow2-valley5-wall-depth-1';
    m.side = THREE.BackSide;   // what three's shadow pass sets on a custom depth material of a front-sided mesh
    const p = new THREE.Mesh(bank.geometry, m); p.frustumCulled = false;
    const fog = canyon.scene.fog, prev = renderer.getRenderTarget();
    try { canyon.scene.fog = null; renderer.setRenderTarget(target()); renderer.compile(p, canyon.camera, canyon.scene); S.depth = 'compiled beside the page'; }
    catch (error) { S.depth = 'failed: ' + (error?.message || error); }
    finally { canyon.scene.fog = fog; renderer.setRenderTarget(prev); }
    mark('depth');
  }

  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const prior = host.canyon;
  host.canyon = function (handles = {}) {
    try { return prior?.call(this, handles); } finally {
      try { before5(handles); } catch (error) { S.mode = 'failed: ' + (error?.message || error); console.warn('flow2 progressive: the page compiles everything first, as before', error); }
    }
  };
})();
