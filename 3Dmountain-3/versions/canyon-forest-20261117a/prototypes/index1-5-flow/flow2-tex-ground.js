/* flow2-tex-ground.js — index1-5-canyon-forest.html only (2026-11-16 performance round: textures in place of per-pixel work).
   Owner: GROUND (terrain / rock / grass). Brief: .qa/index1-5/flow2-tex/BRIEF.md. Notes: .qa/index1-5/flow2-tex/STATUS-GROUND.md.
   Client: 「這效能消耗太大了 很多地方幫我換成貼圖材質」. Same picture, cheaper.

   SAMPLE 1 — the canyon walls' macro fields, baked once instead of computed every pixel every frame.
   The walls' program (alpine-terrain-material.js, ALP_BANK: the two canyon banks) works out, for EVERY pixel of rock, every frame:
     - the fall-line gully filter: 5 octaves of 3x3 Gabor cells (45 x exp + cos + sin + hashes) -> gullyH, gullyF, gullyD
       (the rock's light and dark gullies and ribs, and the normal they bend), the biggest single block of the program;
     - four broad fbm fields (macro, geo, patchN, clumps: 12 value-noise octaves) -> rock colour masses, scree and forest patches.
   None of these depend on the camera (the gully octaves fade by the pixel's footprint only beyond foot .9 m, i.e. far away), and
   the canyon banks never move: they are a regular grid (661 rows along the river x 85 columns across, per side).
   So (the 4965R1 method: macro maps baked, sampled at run time) they are computed ONCE, on the GPU, with the very same GLSL
   (taken from the walls' own compiled program, so nothing can drift), into an atlas laid out in the banks' own grid
   (u = across, v = along), and the walls READ them: one textureLod for the fbm fields, one for the gullies.
     - same picture by construction (same functions at the same surface points; bilinear between texels <= ~0.75 m apart, the
       finest gully octave is 8.2 m); far pixels (foot >= .9 m, where the gully octaves start to fade) and any mesh that is not one
       of the two banks (the far range) keep the procedural path, so nothing changes there either;
     - re-baked by itself when anything it depends on changes (the banks' rim blend, the gully / relief dials, the erosion tile).
   Atlas: one RGBA16F texture, 6 blocks (west / east: gullies, fbm fields, and since phase 2 four more noises: the bed dip that
   three modules computed separately, damp moss, two turf tones); size by quality tier (high ~0.75 m along, 256 across per block;
   medium ~1 m / 192; low ~1.5 m / 128). One sampler added to the walls' program.
   No long frame (phase 2, client: 「這跑內顯時候會卡」): the bake starts as soon as the canyon is handed over (normally seconds before
   the visitor sees the valley), its program is compiled on the driver's threads (KHR_parallel_shader_compile), the target is
   allocated in a frame of its own, and the bake itself is cut into slices of bank rows, one per frame (tune.slice gully texels).

   Switches: ?tex=0 (whole round) / ?texG=0 (this file) leave it out; needs <html data-flow2-tex>. Live A/B in one page:
   window.__FLOW2_TEX_GROUND__.tune.on = 0 / 1 (no recompile). State: window.__FLOW2_TEX_GROUND__.state.
   Never edits alpine-terrain-material.js or main.js: chained onto __FLOW2_FINE_JOURNEY__.canyon like the valley rounds, edits the
   walls' program text in its own onBeforeCompile link (cache key '|flow2-tex-ground-1'). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const html = document.documentElement;
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    on: Q.get('texGOn') === '0' ? 0 : 1,   // 1 = the walls read the atlas; 0 = they compute it as before (live, no recompile)
    footLimit: num('texGFoot', .9),          // the gullies are read from the atlas only where a pixel is finer than this (m): beyond it
                                             // the procedural octaves start to fade (finest octave L*.11 = .90): kept procedural there
    texel: num('texGTexel', 0),              // metres per atlas texel along the river (0 = by quality tier)
    more: Q.get('texGMore') !== '0',         // phase 2: block C (dip, moss, turf tone noises); ?texGMore=0 = phase 1's atlas only
    slice: num('texGSlice', 120000)          // gully texels baked per frame: the bake is cut into slices (no long frame, iGPU too)
  };
  const state = { mode: 'waiting for the canyon', patches: {}, programs: 0, bakes: 0 };
  const API = window.__FLOW2_TEX_GROUND__ = { tune: T, state };
  /* (OPT_IN = true: only with ?texG=1 — how it stood while ENGINE built its table; checked and measured, on by default since v=2) */
  const OPT_IN = false;
  if (OPT_IN && Q.get('texG') !== '1') { state.mode = 'off until verified (?texG=1 turns it on)'; return; }
  if (!html.hasAttribute('data-flow2-tex') || Q.get('tex') === '0' || Q.get('texG') === '0') { state.mode = 'off (' + (html.hasAttribute('data-flow2-tex') ? '?tex=0 / ?texG=0' : 'no data-flow2-tex on this page') + ')'; return; }

  const QL = window.__FLOW2_QUALITY__, RANKS = { low: 0, medium: 1, high: 2 };
  const startRank = QL && QL.start in RANKS ? RANKS[QL.start] : 2;
  const TIER = [{ texel: 1.5, across: 128 }, { texel: 1, across: 192 }, { texel: .75, across: 256 }][startRank];
  state.tier = ['low', 'medium', 'high'][startRank];

  const count = (s, a) => s.split(a).length - 1;
  const NB = 6;   // atlas blocks: A gullies (west, east), B fbm fields (west, east), C more noise (west, east)
  const U = { f2gAtlas: { value: null }, uF2g: { value: [0, T.footLimit, .5 / TIER.across, 0] } };   // on, foot limit, half a texel across, (spare)
  /* phase 2 (2026-11-16): block C = four more static noises of the walls' program, read from the atlas instead of computed:
     x the bed "dip" wander (two value noises, computed THREE times: flow2-valley-real.js, -valley3-rock.js, -valley5-rock.js),
     y the damp-moss patches, z the turf's 14 m tussock tone, w the turf palette's 11 m variation. Only noises with a period of
     9 m or more (the atlas texel is <= ~1 m there). The streak columns and the turf field's fine octaves vary down the wall's
     height, which the banks' grid squeezes: not bakeable in it. */
  const DIP = '(aNoise(P.xz*.016+vec2(2.7,9.1))-.5)*16.+(aNoise(P.xz*.06+vec2(6.3,1.2))-.5)*3.';
  const CN = [['f2gN1', 'aNoise(P.xz*.11+vec2(8.4,1.6))', 'y'], ['f2gN2', 'aNoise(P.xz*.07+vec2(3.3,1.9))', 'z'], ['f2gN3', 'aNoise(P.xz*.09+vec2(1.3,7.7))', 'w']];

  /* ---------------- the walls' program: read the atlas instead of computing ---------------- */
  const A_MAIN = 'void main() {';
  const A_GDECL = 'float gullyH=0.,gullyF=0.;vec2 gullyD=vec2(0.);';
  const A_GBODY = 'float amp=1.,ampSum=0.,ampF=0.;vec2 g=grad;';
  const A_GEND = 'gullyH/=ampSum*.6;gullyF/=max(ampF*.6,1e-3);';
  const FIELDS = ['macro', 'geo', 'patchN', 'clumps'];   // atlas channels .x .y .z .w of the fbm blocks
  const fieldRe = name => new RegExp('\\n([ \\t]*)float ' + name + '=([^;\\n]+);');
  /* (no comments inside the injected GLSL: the walls' program is the page's biggest compile; every line of it is paid there) */
  const G_DECL = `
      bool f2gOn=uF2g.x>.5&&vF2g.z>.5;
      bool f2gUseA=f2gOn&&foot<uF2g.y;
      float f2gU=clamp(vF2g.x,uF2g.z,1.-uF2g.z);
      vec4 f2gB=vec4(.5),f2gC=vec4(.5);
      if(f2gOn){f2gB=textureLod(f2gAtlas,vec2(vF2g.y,(2.+vF2g.w+f2gU)/6.),0.);f2gC=textureLod(f2gAtlas,vec2(vF2g.y,(4.+vF2g.w+f2gU)/6.),0.);}`;
  const G_GREAD = 'if(f2gUseA){vec4 f2gA=textureLod(f2gAtlas,vec2(vF2g.y,(vF2g.w+f2gU)/6.),0.);gullyH=f2gA.x;gullyF=f2gA.y;gullyD=f2gA.zw;}else';

  const cap = { src: null, erosion: null, relief: null, gully: null };
  function capture(fs, vs, uniforms) {
    if (cap.src) return;
    const noiseA = fs.indexOf('float aH(vec2 p)'), fbmEnd = fs.indexOf('return s/.875;}', noiseA);
    const gA = fs.indexOf('vec3 aGully(vec2 p,vec2 dir){'), gE = gA < 0 ? -1 : fs.indexOf('}', fs.indexOf('return va/wt;', gA));
    const bA = fs.indexOf(A_GBODY), bE = bA < 0 ? -1 : fs.indexOf(A_GEND, bA);
    const dA = vs.indexOf('float alpBankH('), dE = dA < 0 ? -1 : vs.indexOf('#endif', dA);
    const lines = FIELDS.map(n => fs.match(fieldRe(n)));
    if (noiseA < 0 || fbmEnd < 0 || gA < 0 || gE < 0 || bA < 0 || bE < 0 || dA < 0 || dE < 0 || lines.some(m => !m)) { state.capture = 'the wall shader has changed: no bake'; return; }
    cap.src = {
      noise: fs.slice(noiseA, fbmEnd + 'return s/.875;}'.length),
      gully: fs.slice(gA, gE + 1),
      body: fs.slice(bA, bE + A_GEND.length),
      fields: lines.map((m, k) => 'float ' + FIELDS[k] + '=' + m[2] + ';').join('\n    '),
      disp: vs.slice(dA, dE)
    };
    cap.erosion = uniforms.alpineErosion || null; cap.relief = uniforms.uCliffRelief || null; cap.gully = uniforms.uGully || null;
    state.capture = cap.erosion && cap.relief && cap.gully ? 'ok' : 'uniforms missing';
    wake();
  }

  function link(material) {
    const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      let f = shader.fragmentShader, v = shader.vertexShader;
      /* the walls' full program only: not the phone's lighter one, not the mountains seen from the air, not the shore stones */
      if (!f.includes('#define ALP_BANK\n') || f.includes('#define ALP_LITE\n') || f.includes('uF2g')) return;
      capture(f, v, shader.uniforms);
      const ok = count(f, A_MAIN) === 1 && count(v, A_MAIN) === 1 && count(v, '#include <begin_vertex>') === 1 && count(f, A_GDECL) === 1 && count(f, A_GBODY) === 1;
      if (!ok) { state.mode = 'the wall shader has changed: left as it was'; return; }
      /* 1 · declarations and the atlas reads, right after the gully variables are declared */
      f = f.replace(A_GDECL, () => A_GDECL + G_DECL);
      /* 2 · the gully block: read when the atlas holds it, else the page's own loop (unchanged) */
      const b = f.indexOf(A_GBODY), open = f.lastIndexOf('{', b);
      if (open < 0 || f.slice(open + 1, b).trim() !== '') { state.mode = 'the gully block has changed: left as it was'; return; }
      f = f.slice(0, open) + G_GREAD + f.slice(open);
      state.patches.gully = 'on';
      /* 3 · the four fbm fields */
      FIELDS.forEach((name, k) => {
        const re = fieldRe(name), n = (f.match(new RegExp(re.source, 'g')) || []).length;
        if (n !== 1) { state.patches[name] = 'skipped (' + n + ')'; return; }
        f = f.replace(re, (all, ws, expr) => '\n' + ws + 'float ' + name + ';if(f2gOn)' + name + '=f2gB.' + 'xyzw'[k] + ';else ' + name + '=' + expr + ';');
        state.patches[name] = 'on';
      });
      /* 4 · block C (phase 2): edits only AFTER the atlas reads; off = the page's own expressions, exactly */
      if (T.more) {
        const at = f.indexOf(G_DECL) + G_DECL.length; const head = f.slice(0, at); let tail = f.slice(at), pre = '';
        let nd = 0, k = tail.indexOf(DIP);
        while (k >= 0) {
          const st = tail.lastIndexOf('float ', k), eq = tail.indexOf('=', st), name = tail.slice(st + 6, eq), end = k + DIP.length;
          if (st < 0 || !/^\w+$/.test(name) || tail[end] !== ';' || tail.slice(st, k).includes(';')) { k = tail.indexOf(DIP, end); continue; }
          const prefix = tail.slice(eq + 1, k).replace(/\+$/, '');
          const put = 'float ' + name + '=' + prefix + ';if(f2gOn)' + name + '+=f2gC.x;else ' + name + '+=(' + DIP + ');';
          tail = tail.slice(0, st) + put + tail.slice(end + 1);
          nd++; k = tail.indexOf(DIP, st + put.length);
        }
        state.patches.dip = nd ? 'on (' + nd + ' sites)' : 'not found';
        for (const [v, expr, c] of CN) {
          const n = tail.split(expr).length - 1;
          if (!n) { state.patches[v] = 'not found'; continue; }
          pre += 'float ' + v + ';if(f2gOn)' + v + '=f2gC.' + c + ';else ' + v + '=' + expr + ';';
          tail = tail.split(expr).join(v); state.patches[v] = 'on (' + n + ')';
        }
        f = head + (pre ? '\n      ' + pre : '') + tail;
      }
      shader.fragmentShader = f.replace(A_MAIN, () => 'uniform sampler2D f2gAtlas;uniform vec4 uF2g;varying vec4 vF2g;\n' + A_MAIN);
      shader.vertexShader = v.replace(A_MAIN, () => 'attribute vec4 aF2gUV;varying vec4 vF2g;\n' + A_MAIN)
        .replace('#include <begin_vertex>', () => '#include <begin_vertex>\n      vF2g=aF2gUV;');   // the banks' grid: u across, v along, 1 = on a bank, side
      for (const k of Object.keys(U)) shader.uniforms[k] = U[k];
      state.programs++; state.mode = 'on';
    };
    material.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|flow2-tex-ground-1'; };
    /* meshes without the banks' grid (the far range) read (0,0,0,0): the procedural path, as before */
    if (material.defaultAttributeValues) material.defaultAttributeValues.aF2gUV = [0, 0, 0, 0];
    else material.defaultAttributeValues = { aF2gUV: [0, 0, 0, 0] };
    material.needsUpdate = true;
  }

  /* ---------------- the bake ---------------- */
  const ctx = { THREE: null, renderer: null, canyon: null, banks: null, rt: null, scene: null, material: null, sig: '', ready: false, busy: false };
  function wake() { if (ctx.THREE && cap.src && !ctx.loop) { ctx.loop = true; requestAnimationFrame(frame); } }

  function prepare() {
    const { THREE, canyon, renderer } = ctx;
    const banks = canyon.scene.children.filter(m => m.isMesh && m.userData?.rim && /shore detail/.test(m.name || ''))
      .sort((a, b) => (/West/.test(a.name) ? 0 : 1) - (/West/.test(b.name) ? 0 : 1));
    if (banks.length !== 2) { state.mode = 'the two banks were not found: procedural as before'; return false; }
    const length = canyon.curve?.getLength?.() || 0;
    const along = Math.min(renderer.capabilities?.maxTextureSize || 8192, 8192, Math.max(512, Math.ceil(length / (T.texel > 0 ? T.texel : TIER.texel) / 64) * 64));
    const across = TIER.across;
    ctx.size = [along, across * NB];
    banks.forEach((bank, side) => {
      const { rows, columns } = bank.userData.rim, g = bank.geometry;
      if (g.attributes.position.count !== rows * columns) throw new Error('bank grid ' + rows + 'x' + columns + ' != ' + g.attributes.position.count);
      const uv = new Float32Array(rows * columns * 4);
      for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) { const o = (i * columns + j) * 4; uv[o] = j / (columns - 1); uv[o + 1] = i / (rows - 1); uv[o + 2] = 1; uv[o + 3] = side; }
      g.setAttribute('aF2gUV', new THREE.BufferAttribute(uv, 4));
    });
    ctx.banks = banks;
    ctx.rt = new THREE.WebGLRenderTarget(along, across * NB, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
      generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    ctx.rt.texture.name = 'flow2 tex ground · walls macro atlas';
    const S = cap.src;
    ctx.material = new THREE.ShaderMaterial({
      name: 'flow2 tex ground · bake',
      uniforms: { alpineErosion: cap.erosion, uCliffRelief: cap.relief, uGully: cap.gully, uPass: { value: 0 } },
      depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NoBlending, toneMapped: false,
      vertexShader: `attribute vec4 aF2gUV;
uniform sampler2D alpineErosion;uniform float uCliffRelief;uniform float uPass;
varying vec3 tWorld;varying vec3 tNormal;
${S.disp}
void main(){
  /* exactly as the walls' vertex shader places the surface */
  vec4 localRock=vec4(position,1.);vec3 localNormal=normal;
  tWorld=(modelMatrix*localRock).xyz;tNormal=normalize(mat3(modelMatrix)*localNormal);
  vec4 bd=alpBankDisp(tWorld,tNormal);
  tWorld+=tNormal*bd.w;tNormal=bd.xyz;
  /* into its block of the atlas: x = along, y = (block + across) / 6, block = side + 2 x pass */
  gl_Position=vec4(aF2gUV.y*2.-1.,(aF2gUV.w+2.*uPass+aF2gUV.x)/3.-1.,0.,1.);
}`,
      fragmentShader: `uniform float uGully;uniform float uPass;
varying vec3 tWorld;varying vec3 tNormal;
${S.noise}
${S.gully}
void main(){
  vec3 N0=normalize(tNormal);vec3 P=tWorld;float foot=0.;
  if(uPass<.5){
    vec2 grad=-N0.xz/max(N0.y,.18);
    float steepT=length(grad);
    float gullyH=0.,gullyF=0.;vec2 gullyD=vec2(0.);
    {
    ${S.body}
    }
    gl_FragColor=vec4(gullyH,gullyF,gullyD);
  }else if(uPass<1.5){
    ${S.fields}
    gl_FragColor=vec4(macro,geo,patchN,clumps);
  }else{
    gl_FragColor=vec4(${DIP},${CN[0][1]},${CN[1][1]},${CN[2][1]});
  }
}`
    });
    ctx.scene = new THREE.Scene(); ctx.eye = new THREE.Camera(); ctx.geos = [];
    ctx.grid = { rows: banks[0].userData.rim.rows, lateral: banks[0].userData.rim.columns - 1 };
    for (const bank of banks) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', bank.geometry.attributes.position); g.setAttribute('normal', bank.geometry.attributes.normal);
      g.setAttribute('aF2gUV', bank.geometry.attributes.aF2gUV); g.setIndex(bank.geometry.index); ctx.geos.push(g);
      bank.updateWorldMatrix(true, false);
      const m = new THREE.Mesh(g, ctx.material); m.frustumCulled = false; m.matrixAutoUpdate = false; m.matrix.copy(bank.matrixWorld); m.matrixWorld.copy(bank.matrixWorld);
      ctx.scene.add(m);
    }
    ctx.scene.matrixWorldAutoUpdate = false;
    U.f2gAtlas.value = ctx.rt.texture;
    state.atlas = along + ' x ' + across * NB + ' RGBA16F (' + (along * across * NB * 8 / 1048576).toFixed(1) + ' MB), ' + (length / along).toFixed(2) + ' m per texel along, canyon ' + Math.round(length) + ' m';
    return true;
  }

  /* everything the atlas depends on: re-baked when it changes */
  function signature() {
    const ero = cap.erosion?.value, b = ctx.banks;
    return [b[0].geometry.attributes.position.version, b[1].geometry.attributes.position.version, b[0].geometry.attributes.normal?.version, b[1].geometry.attributes.normal?.version,
      cap.relief?.value, cap.gully?.value, ero?.version, ero?.uuid].join('|');
  }
  const imageReady = t => { const i = t?.image; return !!i && (i.width || i.naturalWidth || 0) > 0 && i.complete !== false; };
  /* The bake, in slices (2026-11-16, the client: 「這跑內顯時候會卡」): one slice per frame = a run of the banks' rows (their triangles
     are stored row by row, so a slice is one draw range), all three passes. The number of rows per slice holds the gully texels per
     frame under tune.slice (120 k: about 1/12 of the high tier's atlas; the GPU work of a slice is a few ms on a small iGPU, well
     under 1 ms on the RTX 4070). The atlas is read only when every slice is done. renderer.info is not reset by these draws. */
  function slicePlan() {
    const [along, h] = ctx.size, perRow = along * (h / NB) * 2 / (ctx.grid.rows - 1);   // gully texels per bank row (both sides)
    const rowsPer = Math.max(4, Math.floor(Math.max(1000, +T.slice || 120000) / perRow));
    const list = []; for (let i = 0; i < ctx.grid.rows - 1; i += rowsPer) list.push([i, Math.min(ctx.grid.rows - 1, i + rowsPer)]);
    return list;
  }
  function bakeSlice([i0, i1]) {
    const { renderer } = ctx, prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevReset = renderer.info.autoReset;
    const t0 = performance.now(), n = ctx.grid.lateral * 6;
    for (const g of ctx.geos) g.setDrawRange(i0 * n, (i1 - i0) * n);
    try {
      renderer.info.autoReset = false; renderer.autoClear = false; renderer.setRenderTarget(ctx.rt);
      for (let pass = 0; pass < 3; pass++) { ctx.material.uniforms.uPass.value = pass; renderer.render(ctx.scene, ctx.eye); }
    } finally {
      renderer.autoClear = prevAuto; renderer.info.autoReset = prevReset; renderer.setRenderTarget(prevTarget);
    }
    const ms = performance.now() - t0; state.sliceCpuMaxMs = Math.max(state.sliceCpuMaxMs || 0, Math.round(ms * 10) / 10);
  }
  /* the bake program really linked (else the walls stay procedural) */
  function linked() {
    const p = ctx.renderer.properties.get(ctx.material)?.currentProgram, gl = ctx.renderer.getContext();
    return !!p?.program && gl.getProgramParameter(p.program, gl.LINK_STATUS) === true;
  }
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  /* first bake: as early as the canyon is handed over and the erosion tile is there (usually long before the visitor sees the
     valley: the page waits ~5 s for its own programs then); each step in a frame of its own */
  async function firstBake() {
    const r = ctx.renderer, ext = r.extensions;
    if (!(ext?.has?.('EXT_color_buffer_float') || ext?.has?.('EXT_color_buffer_half_float'))) { state.mode = 'no half-float render targets here: procedural as before'; return false; }
    state.mode = 'preparing'; const t0 = performance.now();
    if (!prepare()) return false;
    state.prepareMs = Math.round(performance.now() - t0);
    await nextFrame();
    /* compiled for the atlas target, without blocking (KHR_parallel_shader_compile: three's compileAsync waits for the driver's
       threads); three keys a program by its output, so the target must be set while it is created */
    state.mode = 'compiling the bake';
    { const t = performance.now(), prev = r.getRenderTarget(); let job = null;
      try { r.setRenderTarget(ctx.rt); job = r.compileAsync?.(ctx.scene, ctx.eye); } finally { r.setRenderTarget(prev); }
      try { await job; } catch { } state.compileMs = Math.round(performance.now() - t); state.parallelCompile = !!ext?.has?.('KHR_parallel_shader_compile'); }
    await nextFrame();
    { const t = performance.now(); try { r.initRenderTarget?.(ctx.rt); } catch { } state.allocMs = Math.round((performance.now() - t) * 10) / 10; }
    await nextFrame();
    return true;
  }
  async function bakeAll() {
    const t0 = performance.now(), plan = slicePlan();
    state.slices = plan.length; ctx.sig = signature();
    for (let k = 0; k < plan.length; k++) {
      state.mode = 'baking ' + (k + 1) + '/' + plan.length;
      bakeSlice(plan[k]);
      await nextFrame();
      if (signature() !== ctx.sig) return false;   // the banks or the dials changed under it: start again
    }
    state.bakes++; state.bakeFrames = plan.length; state.bakeWallMs = Math.round(performance.now() - t0);
    return true;
  }
  async function run() {
    if (ctx.busy) return; ctx.busy = true;
    try {
      if (!ctx.rt) { if (!(await firstBake())) { ctx.failed = true; return; } }
      ctx.ready = false;
      let tries = 0; while (!(await bakeAll())) if (++tries > 20) { state.mode = 'the banks keep changing: procedural as before'; ctx.failed = true; return; }
      if (!linked()) { state.mode = 'the bake program did not link: procedural as before'; ctx.failed = true; return; }
      ctx.ready = true; state.mode = 'on';
    } catch (error) {
      ctx.failed = true; ctx.ready = false; state.mode = 'failed: ' + (error?.message || error); console.warn('flow2 tex ground: the walls stay procedural', error);
    } finally { ctx.busy = false; }
  }

  function frame() {
    requestAnimationFrame(frame);
    const u = U.uF2g.value;
    u[1] = T.footLimit;
    if (!ctx.failed && !ctx.busy) {
      if (!ctx.rt && !imageReady(cap.erosion?.value)) state.mode = 'waiting for the erosion tile';
      else if (!ctx.ready || signature() !== ctx.sig) run();
    }
    u[0] = ctx.ready && T.on ? 1 : 0;
  }

  API.rebake = () => { ctx.sig = ''; };   // (tests: bake again on the next frame)
  /* main.js -> __FLOW2_FINE_JOURNEY__.canyon(handles): add this file to that call (after every valley round) */
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const before = host.canyon;
  host.canyon = function (handles = {}) {
    try { before?.call(this, handles); } finally {
      if (handles.lite) state.mode = 'not on the lighter drawing';
      else if (!handles.canyon?.scene || !handles.THREE || !handles.renderer) state.mode = 'no canyon handed over';
      else {
        try {
          ctx.THREE = handles.THREE; ctx.renderer = handles.renderer; ctx.canyon = handles.canyon;
          const seen = new Set();
          handles.canyon.scene.traverse(o => { for (const m of [].concat(o.material || [])) if (m?.userData?.alpineTerrain && !seen.has(m) && typeof m.onBeforeCompile === 'function') { seen.add(m); link(m); } });
          state.mode = seen.size ? 'waiting for the walls to be compiled' : 'no terrain material found';
          wake();
        } catch (error) { state.mode = 'failed: ' + (error?.message || error); console.warn('flow2 tex ground: the walls keep their own program', error); }
      }
    }
  };
})();
