/* flow2-tex-water.js — index1-5-canyon-forest.html only (2026-11-16 performance round: textures in place of per-pixel work).
   Owner: WATER (.qa/index1-5/flow2-tex/BRIEF.md, STATUS-WATER.md). ?tex=0 turns the whole round off, ?texW=0 this file only.

   THE SAMPLE (on by default) — THE FOREST VIEW'S WATER ONLY WHERE THERE IS WATER (ENGINE's cost table item 2, its water part).
   The forest view's land is one dense grid (1000 × 560 cells + skirt on high) drawn by ONE program, and that program's water section
   (FOREST_WATER: living water + FOREST_WATER3D + FOREST_RIVER — ~45 texture reads, mirror, sun, foam) ran on EVERY pixel of the land,
   twice a frame (the view and its mirror pass), although off the water every one of its terms is multiplied by the baked water mask
   (d1-water.png, R) and is exactly zero. Now the baked mask decides ONCE, at load: each grid cell that the mask (with its bilinear reach
   and a safety margin) touches is drawn by the program as it was; every dry cell is drawn by the SAME program compiled without its water
   section (same uniforms object, same vertex shader, same everything else). Same picture by construction — the dry cells' water terms
   were zeros — and the water itself is drawn by the unchanged program, so it moves exactly as before.
   How: flow2-original-scene.js calls window.__FLOW2_TEX_WATER__.forest({ THREE, terrain, material, uniforms, waterMap }) right after the
   grid gets its material (one marked line; on other pages nothing defines the hook). The dry program is made at once (the view's own
   compileAsync compiles it with the rest); the cells are sorted (water cells first, then dry) in slices of a few ms, then the grid's
   index is rewritten in place (same size) with two groups. All tiers. ?texWForest=0 = not installed; live A/B in one page:
   window.__FLOW2_TEX_WATER__.tune.forest = 0 / 1 (0 = one group: the full program on every cell, as before).

   PREPARED, OFF BY DEFAULT (?texWRiver=1) — THE CANYON RIVER'S WAVES FROM BAKED TILES (the FFT-ocean / "wave cascade" method of game water, without the FFT).
   Before: every river pixel summed the third round's eleven wind-wave trains (flow2-valley3-water.js f3wave: two cosines, two sines,
   a square root and a smoothstep each), i.e. 44 trig calls a pixel on ~a million pixels a frame.
   Now: the same eleven trains (read from that shader, so they stay the same trains) are drawn ONCE a frame into three small
   tiling tiles of 256 × 256 (half-float, mip-mapped), one per size band — 64 m (the 10 m … 2.6 m swell), 16 m (1.7 m … 44 cm),
   4 m (29 … 12 cm ripples) — and every river pixel reads three texels instead of computing the trains:
     · each train keeps its own speed (√(g·k) × the river's own wave clock), so the water moves and changes exactly as it did
       (a scrolled normal map would only slide); the tiles are re-drawn each frame: 3 × 65 k texels instead of ~1 M pixels;
     · directions and wavelengths are snapped to the tile so it repeats seamlessly (≤ 6° / ≤ 4 %, under the domain warp of the
       river shader, which still bends every train as before);
     · what a pixel cannot hold is still kept as roughness: the tiles hold the slope AND its square (LEAN moments), so the
       mip-maps give the lost slope's variance exactly where the old code faded each train out (keep → variance). The fade point is
       matched by a gradient scale (dial 「細節保留」, 2^0.6 by default).
   The rest of the river is untouched (gust, warp, the fourth round's ripples, the fifth round's swell, mirror, sun, shore).
   Gate: <html data-flow2-tex> and not ?tex=0 / ?texW=0. Quality tiers: low has no third-round water (nothing to replace);
   medium and high both use the tiles. Live switch for A/B: window.__FLOW2_TEX_WATER__.tune.on = 0 / 1 (one uniform; the old
   eleven trains stay in the program behind it). Panel 「河面貼圖」 (key Y). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search), html = document.documentElement;
  if (!html.hasAttribute('data-flow2-tex') || Q.get('tex') === '0' || Q.get('texW') === '0') return;
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const QL = window.__FLOW2_QUALITY__, tier = QL?.start || 'high';
  const T = {
    forest: num('texWForest', 1),    // the forest view: 1 = dry cells drawn without the water section, 0 = the full program everywhere (A/B)
    margin: 2,                       // mask pixels added round each cell (beyond the bilinear texel) before it counts as dry
    river: num('texWRiver', 0),      // the canyon river's wave tiles: installed only with ?texWRiver=1 (prepared, not the sample)
    on: num('texWOn', 1),            // (river) 1 = the trains from the baked tiles, 0 = computed per pixel as before (A/B)
    chrome: num('texWChrome', 1),    // (river) 1 = skip the opening sea's chrome while the water covers the river, 0 = always compute it (A/B)
    detail: num('texWBias', .6),     // (river) the mip bias (log2): where a train gives way to roughness (0.6 matches the old per-train fade)
    size: 256                        // (river) texels per tile side
  };
  const state = { forest: 'waiting for the forest view', river: T.river > .5 ? 'waiting for the canyon' : 'off (prepared: ?texWRiver=1)', tiles: [], bakes: 0, tier };
  const api = window.__FLOW2_TEX_WATER__ = { tune: T, state };

  /* ================= THE FOREST VIEW: water program only on the water's cells ================= */
  api.forest = function forest({ THREE, terrain, material, uniforms, waterMap } = {}) {
    if (Q.get('texWForest') === '0') { state.forest = 'off (?texWForest=0)'; return; }
    if (!THREE || !material?.isShaderMaterial || !material.defines?.FOREST_WATER) { state.forest = 'the land program has no water section here: nothing to split'; return; }
    let grid = null;
    terrain?.traverse?.(o => { if (!grid && o.isMesh && o.material === material && o.geometry?.index) grid = o; });
    if (!grid) { state.forest = 'no indexed land grid: nothing to split'; return; }
    const g = grid.geometry, index = g.index, pos = g.attributes.position;
    const img = waterMap?.image, B = uniforms?.uBounds?.value, S = uniforms?.uSkirt?.value;
    if (!img?.width || !img?.height || !B || !S || !index?.array || !pos?.array) { state.forest = 'the water mask or the grid is not readable: left as it is'; return; }
    /* the dry program: the same material without FOREST_WATER (which holds FOREST_WATER3D and FOREST_RIVER inside it) */
    const defines = { ...material.defines }; delete defines.FOREST_WATER;
    const dry = new THREE.ShaderMaterial({
      uniforms: material.uniforms, vertexShader: material.vertexShader, fragmentShader: material.fragmentShader, defines,
      side: material.side, transparent: material.transparent, depthTest: material.depthTest, depthWrite: material.depthWrite,
      toneMapped: material.toneMapped, blending: material.blending, fog: material.fog, lights: material.lights
    });
    dry.name = (material.name || 'forest land') + ' · dry cells (flow2-tex-water)';
    dry.extensions = { ...(material.extensions || {}) };
    if (material.onBeforeCompile && material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) dry.onBeforeCompile = material.onBeforeCompile;
    if (material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) { const k = material.customProgramCacheKey.bind(material); dry.customProgramCacheKey = () => k() + '|flow2-tex-dry'; }
    const total = index.count;
    /* iGPU rule: the dry program is NOT added to the view's own compile burst (which runs while the visitor is in the canyon). The grid keeps
       its one material until the cells are sorted AND the dry program has been compiled in the background (compileAsync = parallel compile,
       polled without blocking, after the view itself reports ready); only then the grid switches to [full, dry] — both programs compiled. */
    api.forestParts = { grid, material, dry };
    let dryReady = false, dryAsked = false;
    const compileDry = () => {
      const r = api.renderer; if (dryAsked || !r) return; dryAsked = true;
      const t1 = performance.now();
      try {
        const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(), mesh = new THREE.Mesh(g, dry); mesh.frustumCulled = false; scene.add(mesh);
        /* the view is drawn into a render target (linear output): compile with one bound so the program is the one the draw will use */
        const tiny = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false }), was = r.getRenderTarget();
        r.setRenderTarget(tiny);
        let pr = null; try { pr = r.compileAsync ? r.compileAsync(scene, cam) : null; } finally { r.setRenderTarget(was); }
        const ready = how => { dryReady = true; tiny.dispose(); state.forestDry = how + ' (' + Math.round(performance.now() - t1) + ' ms after asking)'; };
        if (pr && pr.then) pr.then(() => ready('compiled in parallel'), () => ready('compiled at first use')); else ready('compiled at first use (no compileAsync)');
      } catch (error) { state.forestDry = 'not compiled (' + (error?.message || error) + '): the full program stays on every cell'; }
    };
    state.forest = 'sorting the cells';
    const t0 = performance.now();
    /* iGPU rule (lead 23:20, 「這跑內顯時候會卡」): every step below runs in slices of at most BUDGET ms of the main thread, yielding between
       them; nothing is done in one long block (mask read, table, sort, rewrite). */
    const BUDGET = 3;
    let W = img.width, H = img.height, sat = null, cv = null, c2 = null, row = 0;
    const any = (x0, y0, x1, y1) => { x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1); if (x1 < x0 || y1 < y0) return false; const w1 = W + 1; return sat[(y1 + 1) * w1 + x1 + 1] - sat[y0 * w1 + x1 + 1] - sat[(y1 + 1) * w1 + x0] + sat[y0 * w1 + x0] > 0; };
    /* the shader reads the mask at forestMir(uvR) (THE SKIRT mirrors the plate at lo / hi): the image of an interval under that fold */
    const fold = (u0, u1, lo, hi) => {
      if (u0 >= lo && u1 <= hi) return [u0, u1];
      if (u0 > hi) return [2 * hi - u1, 2 * hi - u0];
      if (u1 < lo) return [2 * lo - u1, 2 * lo - u0];
      let a = Math.max(u0, lo), b = Math.min(u1, hi);
      if (u1 > hi) a = Math.min(a, 2 * hi - u1), b = hi;
      if (u0 < lo) b = Math.max(b, 2 * lo - u0), a = lo;
      return [Math.max(0, a), Math.min(1, b)];
    };
    const P = pos.array, I = index.array, stride = total % 6 === 0 ? 6 : 3, chunks = total / stride, M = T.margin;
    if (I.length !== total) { state.forest = 'the grid index is not kept on the CPU: left as it is'; return; }
    const wet = new Uint8Array(chunks);
    let k = 0, nWet = 0, out = null, a = 0, b = 0, c = 0, copied = 0, worst = 0, slices = 0, phase = 'mask';
    /* uploads of the grid's index (the GPU copy): the rewrite should land before the first one, or cost one more */
    let uploads = 0; const prevUpload = index.onUploadCallback;
    index.onUpload(function () { uploads++; state.forestUploads = uploads; try { prevUpload?.call(this); } catch (error) { } });
    const slice = () => {
      const s0 = performance.now(), until = s0 + BUDGET; slices++;
      try {
        if (phase === 'mask') {
          /* the baked mask (R > 0 = water) as a summed-area table, read in strips of rows */
          if (!cv) { cv = document.createElement('canvas'); cv.width = W; cv.height = H; c2 = cv.getContext('2d', { willReadFrequently: true }); c2.drawImage(img, 0, 0); sat = new Int32Array((W + 1) * (H + 1)); }
          else while (row < H && performance.now() < until) {
            const n = Math.min(48, H - row), px = c2.getImageData(0, row, W, n).data;
            for (let y = 0; y < n; y++) { const yy = row + y; let r = 0; for (let x = 0; x < W; x++) { r += px[(y * W + x) * 4] > 0 ? 1 : 0; sat[(yy + 1) * (W + 1) + x + 1] = sat[yy * (W + 1) + x + 1] + r; } }
            row += n;
          }
          if (row >= H) { cv.width = cv.height = 1; cv = c2 = null; phase = 'cells'; }
        } else if (phase === 'cells') {
          for (; k < chunks; k++) {
            if ((k & 511) === 0 && performance.now() > until) break;
            let ux0 = 9, ux1 = -9, uz0 = 9, uz1 = -9;
            for (let q = k * stride, e = q + stride; q < e; q++) { const v = I[q] * 3, u = (P[v] - B.x) * B.z, w = (P[v + 2] - B.y) * B.w; if (u < ux0) ux0 = u; if (u > ux1) ux1 = u; if (w < uz0) uz0 = w; if (w > uz1) uz1 = w; }
            const [a0, a1] = fold(ux0, ux1, S.x, 1 - S.x), [b0, b1] = fold(uz0, uz1, S.y, 1 - S.y);
            /* texel centres at (i + .5) / W: bilinear reads one texel either side; then the margin */
            if (any(Math.floor(a0 * W - .5) - M, Math.floor(b0 * H - .5) - M, Math.ceil(a1 * W - .5) + M, Math.ceil(b1 * H - .5) + M)) { wet[k] = 1; nWet++; }
          }
          if (k >= chunks) { sat = null; out = new Uint32Array(total); a = 0; b = nWet * stride; c = 0; phase = 'sort'; }
        } else if (phase === 'sort') {
          /* water cells first, then the dry ones: the same triangles */
          for (; c < chunks; c++) {
            if ((c & 4095) === 0 && performance.now() > until) break;
            const src = c * stride; if (wet[c]) { for (let i = 0; i < stride; i++) out[a++] = I[src + i]; } else { for (let i = 0; i < stride; i++) out[b++] = I[src + i]; }
          }
          if (c >= chunks) phase = 'copy';
        } else if (phase === 'copy') {
          /* rewritten in place in ONE native copy (a memcpy of the index, ~2 ms for 4.6 M entries; atomic, so a first upload can never
             see half of it; same buffer size: no new GPU buffer); the groups switch on the next frame */
          I.set(out); copied = total;
          {
            out = null; index.needsUpdate = true;
            api.forestSplit = nWet * stride; applied = -1; phase = 'done';
            state.forest = 'on: ' + (100 * nWet / chunks).toFixed(1) + ' % of the cells hold water and keep the full program, ' + (100 - 100 * nWet / chunks).toFixed(1) + ' % are drawn without the water section (' + chunks + (stride === 6 ? ' cells' : ' triangles') + ', sorted in ' + Math.round(performance.now() - t0) + ' ms wall time, ' + slices + ' slices, the longest ' + worst.toFixed(1) + ' ms; index uploads before the rewrite: ' + uploads + ')';
            state.wetShare = +(nWet / chunks).toFixed(4); state.forestSlices = { slices, worstMs: +worst.toFixed(2), uploadsBefore: uploads };
            html.dataset.flow2TexWater = 'forest';
          }
        }
      } catch (error) { phase = 'failed'; state.forest = 'the split failed (' + (error?.message || error) + '): the full program draws every cell, as before'; console.warn('flow2-tex-water: forest split failed', error); }
      worst = Math.max(worst, performance.now() - s0);
      if (phase !== 'done' && phase !== 'failed') setTimeout(slice, 0);
    };
    let applied = 1;   /* 1 = one group (as before) */
    let sortedAt = 0;
    (function watch() {
      requestAnimationFrame(watch);
      if (api.forestSplit === undefined) return;
      if (!sortedAt) sortedAt = performance.now();
      /* ask for the dry program once the view says it is ready (its own compile burst is over), or 4 s after the sort at the latest */
      if (!dryAsked && (window.__FLOW2_FOREST_ATLAS__?.state?.ready || performance.now() - sortedAt > 4000)) compileDry();
      if (!dryReady) return;
      if (!Array.isArray(grid.material)) { grid.material = [material, dry]; applied = -1; }
      const want = T.forest > .5 ? 2 : 1;
      if (want === applied) return;
      g.clearGroups();
      if (want === 2) { g.addGroup(0, api.forestSplit, 0); g.addGroup(api.forestSplit, total - api.forestSplit, 1); } else g.addGroup(0, total, 0);
      applied = want;
    })();
    setTimeout(slice, 0);
  };

  try {
    window.__FLOW2_PANEL__?.add({
      id: 'texwater', title: '水面效能', key: 'y', tune: T, rows: [
        ['森林：乾的地方不跑水面程式（1＝開，0＝原本）', 'forest', 0, 1, 1],
        ...(T.river > .5 ? [['— 峽谷河面（試作）—'], ['河浪用烘焙貼圖（1＝開）', 'on', 0, 1, 1], ['細節保留（越大越早變粗糙）', 'detail', -1, 2, .05]] : [])
      ]
    });
  } catch (error) { }

  /* main.js calls __FLOW2_FINE_JOURNEY__.canyon({ renderer, … }) when the canyon is built: the renderer is kept for the background compiles */
  {
    const host = window.__FLOW2_FINE_JOURNEY__ ||= {}, beforeCanyon = host.canyon;
    host.canyon = function (h = {}) { try { return beforeCanyon?.call(this, h); } finally { try { if (h.renderer) { api.renderer = h.renderer; api.riverWarm?.(h.renderer); } } catch (error) { } } };
  }

  if (!(T.river > .5)) return;   /* the river's wave tiles below are prepared but not part of this sample */

  /* the third round's trains, as written in the river shader: f3wave(f3pw,f3px,f3t,vec2(dx,dz),k,amp*f3g,f3sl,f3va,f3hg); */
  const TRAIN = /f3wave\(f3pw,f3px,f3t,vec2\(([-.\d]+),([-.\d]+)\),([.\d]+),([.\d]+)\*f3g,f3sl,f3va,f3hg\);/g;
  /* three bands: the tile (m) and the trains it takes (k in rad/m) */
  const BANDS = [{ name: 'swell', W: 64, kMax: 3 }, { name: 'chop', W: 16, kMax: 16 }, { name: 'ripple', W: 4, kMax: 1e9 }];
  const MAX_PER = 6;

  const BAKE_VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  /* one band: the slope (x, z), its square, and the height (the crest tint) of the same sum the river shader made per pixel */
  const BAKE_FS = `precision highp float;
varying vec2 vUv;
uniform vec4 uTr[${MAX_PER}];   /* (k' x, k' z, phase now, amplitude) — k' snapped to the tile's lattice, phase = ω t mod 2π */
uniform float uW;uniform int uN;
void main(){
  vec2 p=vUv*uW,sl=vec2(0.);float h=0.;
  for(int i=0;i<${MAX_PER};i++){
    if(i>=uN)break;
    vec4 t=uTr[i];float k=length(t.xy);vec2 d=t.xy/k;
    float ph=dot(p,t.xy)-t.z;
    sl+=d*(t.w*(cos(ph)+.32*cos(2.*ph+.6)));
    h+=t.w/k*(sin(ph)+.16*sin(2.*ph+.6));
  }
  gl_FragColor=vec4(sl,dot(sl,sl),h);
}`;
  const PARS = 'uniform sampler2D uTWA,uTWB,uTWC;uniform vec4 uTWS;uniform float uTWOn;\n';

  function river(args) {
    const { THREE, seaMaterial, canyon } = args || {};
    if (!THREE || !seaMaterial?.isShaderMaterial) { state.river = 'no canyon river'; return; }
    if (!/^on/.test(window.__FLOW2_VALLEY3_WATER__?.state?.water || '')) { state.river = 'the third round\'s water is not on here (' + (tier === 'low' ? 'low tier' : window.__FLOW2_VALLEY3_WATER__?.state?.water || 'not loaded') + '): nothing to replace'; return; }
    let fs = seaMaterial.fragmentShader;
    if (fs.includes('uTWA')) { state.river = 'already installed'; return; }
    const calls = [...fs.matchAll(TRAIN)];
    if (calls.length < 3) { state.river = 'the river\'s wave trains were not found: left as it is'; return; }
    /* the block of consecutive train lines (it must be one block) */
    const first = calls[0].index, lastCall = calls[calls.length - 1], end = lastCall.index + lastCall[0].length;
    const block = fs.slice(first, end);
    if (block.replace(TRAIN, '').replace(/\s+/g, '') !== '') { state.river = 'the river\'s wave trains are not one block: left as it is'; return; }
    if (!fs.includes('vec2 f3sl=vec2(0.);float f3va=0.,f3hg=0.')) { state.river = 'the river shader has changed: left as it is'; return; }
    /* each train to its band, its wave vector snapped to the band's tile */
    const trains = calls.map(m => ({ d: [+m[1], +m[2]], k: +m[3], a: +m[4] }));
    const bands = BANDS.map(b => ({ ...b, list: [] }));
    for (const t of trains) {
      const l = Math.hypot(t.d[0], t.d[1]) || 1, dx = t.d[0] / l, dz = t.d[1] / l;
      const b = bands.find(b => t.k < b.kMax);
      const c = b.W / (2 * Math.PI), m = Math.round(t.k * dx * c), n = Math.round(t.k * dz * c);
      const kx = m / c, kz = n / c, k2 = Math.hypot(kx, kz);
      b.list.push({ kx, kz, k: t.k, omega: Math.sqrt(9.81 * t.k), a: t.a, err: { length: +((k2 / t.k - 1) * 100).toFixed(1) + ' %', turn: +(Math.acos(Math.min(1, (kx * dx + kz * dz) / k2)) * 180 / Math.PI).toFixed(1) + '°' } });
    }
    if (bands.some(b => b.list.length > MAX_PER || !b.list.length)) { state.river = 'the trains do not fit the three tiles: left as it is'; return; }
    /* the tiles */
    const N = T.size;
    const make = () => {
      const rt = new THREE.WebGLRenderTarget(N, N, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
      rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping; rt.texture.anisotropy = 1; rt.texture.name = 'flow2-tex-water tile';
      return rt;
    };
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); quad.frustumCulled = false;
    const bakeScene = new THREE.Scene(); bakeScene.add(quad);
    const bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    for (const b of bands) {
      b.rt = make();
      b.mat = new THREE.ShaderMaterial({ vertexShader: BAKE_VS, fragmentShader: BAKE_FS, depthTest: false, depthWrite: false, toneMapped: false,
        uniforms: { uTr: { value: Array.from({ length: MAX_PER }, () => new THREE.Vector4()) }, uW: { value: b.W }, uN: { value: b.list.length } } });
    }
    state.tiles = bands.map(b => ({ band: b.name, metres: b.W, trains: b.list.map(t => ({ k: t.k, lambda: +(2 * Math.PI / t.k).toFixed(2), snapped: t.err })) }));
    /* the river reads them */
    const U = {
      uTWA: { value: bands[0].rt.texture }, uTWB: { value: bands[1].rt.texture }, uTWC: { value: bands[2].rt.texture },
      uTWS: { value: new THREE.Vector4(1 / bands[0].W, 1 / bands[1].W, 1 / bands[2].W, Math.pow(2, T.detail)) }, uTWOn: { value: T.on > .5 ? 1 : 0 }
    };
    const READ = `/* flow2-tex-water.js: the eleven trains read from three baked tiles (slope, slope², height; drawn once a frame with each
           train's own speed). The tiles' mip-maps do what keep / variance did per train: the slope a pixel cannot hold becomes
           roughness. The gradients are taken here (uniform control flow) and scaled by the detail dial. */
        vec2 twdx=dFdx(f3pw)*uTWS.w,twdy=dFdy(f3pw)*uTWS.w;
        if(uTWOn>.5){
          vec4 twa=textureGrad(uTWA,f3pw*uTWS.x,twdx*uTWS.x,twdy*uTWS.x);
          vec4 twb=textureGrad(uTWB,f3pw*uTWS.y,twdx*uTWS.y,twdy*uTWS.y);
          vec4 twc=textureGrad(uTWC,f3pw*uTWS.z,twdx*uTWS.z,twdy*uTWS.z);
          f3sl+=(twa.xy+twb.xy+twc.xy)*f3g;
          f3va+=(max(twa.z-dot(twa.xy,twa.xy),0.)+max(twb.z-dot(twb.xy,twb.xy),0.)+max(twc.z-dot(twc.xy,twc.xy),0.))*f3g*f3g;
          f3hg+=(twa.w+twb.w+twc.w)*f3g;
        }else{
        ${block}
        }`;
    fs = fs.slice(0, first) + READ + fs.slice(end);
    /* R1, the dead chrome: the river's own colour starts as the opening sea's liquid metal (montisChrome: two montisEnv look-ups of the
       studio, iris, ink). Where the third round's water covers the river completely (f3w = 1: every frame in the canyon) the WATER block
       replaces that colour outright (col = mix(col, f3col, 1)), so it was computed and thrown away. It is now computed only when some of it
       can show (f3w < 1: the fade before the lift, the night chapters, the mirror's retreat) — decided per draw from the same uniforms
       (a uniform branch: every pixel of the draw takes the same side). */
    let chromeOn = false;
    const CHROME = 'vec3 col=montisChrome(nrm,V,vFlow+uSeaCurrent*.35,curv,rough,mask,1.,0.);';
    if (fs.split(CHROME).length === 2 && fs.includes('col=mix(col,f3col,f3w);')) {
      fs = fs.replace(CHROME, () => 'vec3 col=vec3(0.);\n      if(uTWChrome>.5)col=montisChrome(nrm,V,vFlow+uSeaCurrent*.35,curv,rough,mask,1.,0.);   /* flow2-tex-water.js R1: only when it can show */');
      chromeOn = true;
    }
    const v5max = fs.includes('max(uF2Water.x,uV5F.x)');
    U.uTWChrome = { value: 1 };
    seaMaterial.fragmentShader = PARS + 'uniform float uTWChrome;\n' + fs;
    Object.assign(seaMaterial.uniforms, U);
    seaMaterial.needsUpdate = true;
    state.chrome = chromeOn ? 'ready (skipped while the water covers the river)' : 'the chrome line was not found: always computed';
    const f32 = Math.fround;
    /* the same f3w the shader computes, from the same uniforms (valley3 / valley5 / valley): 1 → the chrome cannot show */
    const covered = () => {
      const su = seaMaterial.uniforms, w = su.uF3W?.value, f2 = su.uF2Water?.value, v5 = su.uV5F?.value;
      if (!w || !f2 || !(+su.uRiverSurface?.value > .5)) return false;
      const m = v5max && v5 ? Math.max(f2.x, v5.x) : f2.x;
      if (!(w.x > .001 && m > .001)) return false;
      return f32(f32(f32(w.x) * f32(m)) * f32(1 - (+su.uJourneyNight?.value || 0))) >= 1;
    };
    let skipped = 0, drawn = 0;

    /* the bake: right before the river is drawn, once per value of the river's clock */
    let lastT = NaN, failed = false, bakeReady = false;
    const TAU = 2 * Math.PI;
    /* iGPU rule: the bake's program is compiled in parallel when the canyon is built (KHR_parallel_shader_compile through compileAsync),
       never at the first river draw; until it is ready the river computes its trains per pixel (the old path). The tiles are cleared
       once there too, so the river never samples an unwritten target. */
    quad.material = bands[0].mat;
    api.riverWarm = renderer => {
      try { const was = renderer.getRenderTarget(); for (const b of bands) { renderer.setRenderTarget(b.rt); renderer.clear(true, false, false); } renderer.setRenderTarget(was); } catch (error) { }
      let p = null; try { p = renderer.compileAsync ? renderer.compileAsync(bakeScene, bakeCam) : null; } catch (error) { p = null; }
      if (p && p.then) p.then(() => { bakeReady = true; state.bakeProgram = 'compiled in parallel'; }, () => { bakeReady = true; state.bakeProgram = 'compiled at first use'; });
      else { bakeReady = true; state.bakeProgram = 'compiled at first use (no compileAsync)'; }
    };
    function bake(renderer) {
      if (failed) return;
      U.uTWOn.value = T.on > .5 && bakeReady ? 1 : 0; U.uTWS.value.w = Math.pow(2, Math.min(3, Math.max(-1, +T.detail || 0)));
      if (!U.uTWOn.value) { lastT = NaN; return; }
      const su = seaMaterial.uniforms, t = (+su.uSeaTime?.value || 0) * (+su.uF3Flow?.value?.z || 0);
      if (t === lastT) return;
      lastT = t;
      for (const b of bands) {
        const v = b.mat.uniforms.uTr.value;
        b.list.forEach((tr, i) => { const ph = (tr.omega * t) % TAU; v[i].set(tr.kx, tr.kz, ph, tr.a); });
      }
      const was = renderer.getRenderTarget(), shadows = renderer.shadowMap.autoUpdate, xr = renderer.xr.enabled;
      try {
        renderer.shadowMap.autoUpdate = false; renderer.xr.enabled = false;
        for (const b of bands) { quad.material = b.mat; renderer.setRenderTarget(b.rt); renderer.render(bakeScene, bakeCam); }
        state.bakes++;
      } catch (error) { failed = true; U.uTWOn.value = 0; state.river = 'the bake failed: ' + (error?.message || error) + ' (the trains are computed per pixel again)'; console.warn('flow2-tex-water: bake failed', error); }
      finally { renderer.setRenderTarget(was); renderer.shadowMap.autoUpdate = shadows; renderer.xr.enabled = xr; }
    }
    const meshes = [];
    (canyon?.scene || null)?.traverse?.(o => { if (o.isMesh && o.material === seaMaterial) meshes.push(o); });
    if (!meshes.length && canyon?.river?.mesh) meshes.push(canyon.river.mesh);
    if (!meshes.length) { state.river = 'no river mesh to hang the bake on: left as computed'; U.uTWOn.value = 0; return; }
    for (const mesh of meshes) {
      const own = mesh.onBeforeRender;
      mesh.onBeforeRender = function (renderer, scene, camera, ...rest) {
        try { bake(renderer); } catch (error) { }
        const r = own?.call(this, renderer, scene, camera, ...rest);
        if (camera?.viewport !== undefined) renderer.state.viewport(camera.viewport);
        /* after the rounds' own hooks (flow2-valley.js sets uF2Water here): is the chrome needed for this draw? */
        const skip = chromeOn && T.chrome > .5 && covered();
        U.uTWChrome.value = skip ? 0 : 1; if (skip) skipped++; else drawn++;
        if (((skipped + drawn) & 255) === 0) state.chromeDraws = { skipped, drawn };
        return r;
      };
    }
    state.river = 'on: ' + trains.length + ' trains → 3 tiles of ' + N + ' (' + bands.map(b => b.W + ' m × ' + b.list.length).join(', ') + '), ' + meshes.length + ' river mesh(es)';
    html.dataset.flow2TexWater = 'river';
    api.bands = bands;
  }

  /* main.js hands the built canyon to __FLOW2_CANYON_LIGHT__.install; the river rounds (valley, valley3, valley4, valley5) wrap it before
     this file, so this runs after all of them, before the river's program is compiled */
  const prev = window.__FLOW2_CANYON_LIGHT__;
  window.__FLOW2_CANYON_LIGHT__ = { ...(prev || {}), install(args) { try { prev?.install?.(args); } finally { try { river(args || {}); } catch (error) { state.river = 'failed: ' + (error?.message || error); console.warn('flow2-tex-water: the river stays as it was', error); } } } };
  /* (the bake's program is compiled in parallel from the __FLOW2_FINE_JOURNEY__.canyon hook above: api.riverWarm) */
})();
