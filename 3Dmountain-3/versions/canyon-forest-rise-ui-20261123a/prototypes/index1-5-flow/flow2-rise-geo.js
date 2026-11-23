/* flow2-rise-geo.js · OPT-M (strike team M, 2026-11-21): the canyon terrain's draw, on index1-5-canyon-forest-rise.html only.
   Client: 「整體程式碼、貼圖材質、3dmodel 都整理乾淨、優化、壓縮、在設計與特效不變狀況下做出最優的優化」 — the picture must not change.

   What it does (all of it off with ?optM=0 or ?perf=0; this part alone off with ?optMcull=0; nothing happens on a page without html[data-rise-studio-pbr]):

   TERRAIN TILES   The canyon terrain ("Interlocking alpine massifs and carved confluences") is one 441,396-vertex, 880,088-triangle mesh
                   that was drawn whole in every pass (the lens, and the river's mirror a second time), whatever the camera saw.
                   Here its index buffer is re-ordered into tiles (bands of 64 cell rows x 16 cell columns: the SAME triangles, the same three
                   vertices in the same order, nothing is added, dropped or moved; the vertex buffers are not touched) and every pass draws only
                   the tiles whose box (the real min/max of the tile's vertices) is inside that pass's own view frustum, camera.projectionMatrix
                   x matrixWorldInverse x the terrain's matrixWorld, i.e. the mirror's oblique one too. A triangle that is not drawn here would
                   have been clipped away by the GPU: the picture is the same. The tiles also put the triangles in a vertex-cache friendly order.
                   The draw is the page's own draw with its range emptied, then one gl.drawElements per visible run of tiles (or one
                   WEBGL_multi_draw call) straight after it, with the same program, uniforms and vertex array.
   Checks          ?optMverify=1 compares the set of triangles before and after (exact, in the page) and logs it; tune.cull = 0 switches the
                   culling off live (the re-ordered index stays, the draw is the whole index again).
   State for QA    window.__RISE_GEO__ { state, tune, stats() }.  Same code runs in Node for the offline tests: require() returns the planning functions. */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- pure functions (also used by the Node tests) */
  /* The terrain's index is made cell by cell (water-canyon-watershed-463.js, "Triangulation"): cell (r, c) = vertices a = r*W + c, a+1, b = a+W, b+1,
     six indices, cells in row-major order. Returns null when the index is not that. */
  function gridOf(index, vertexCount) {
    if (!index || index.length < 12 || index.length % 6) return null;
    const first = index[3] === 0 ? index[2] - 1 : index[2];   /* cell 0 is (a,a+1,b,b,a+1,b+1) or (a,a+1,b+1,a,b+1,b) */
    const W = first, cells = index.length / 6;
    if (!(W > 2) || vertexCount % W) return null;
    const cols = W - 1, rows = cells / cols;
    if (rows !== Math.floor(rows) || (rows + 1) * W !== vertexCount) return null;
    for (let r = 0, k = 0; r < rows; r++) for (let c = 0; c < cols; c++, k += 6) {
      const a = r * W + c, b = a + W, lo = a, hi = b + 1;
      for (let j = 0; j < 6; j++) { const v = index[k + j]; if (v < lo || v > hi || (v !== a && v !== a + 1 && v !== b && v !== b + 1)) return null; }
    }
    return { W, rows, cols };
  }

  /* the real min/max of the vertices of every tile (re-run when the terrain's heights are edited in the tuner: position.version changes) */
  function fillBoxes(position, grid, Tz, Tx, box) {
    const { W, rows, cols } = grid, nb = Math.ceil(rows / Tz), nt = Math.ceil(cols / Tx);
    for (let br = 0; br < nb; br++) for (let bc = 0; bc < nt; bc++) {
      const r0 = br * Tz, r1 = Math.min(rows, r0 + Tz), c0 = bc * Tx, c1 = Math.min(cols, c0 + Tx);
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const v = (r * W + c) * 3, x = position[v], y = position[v + 1], z = position[v + 2];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      box[(br * nt + bc) * 6] = x0; box[(br * nt + bc) * 6 + 1] = y0; box[(br * nt + bc) * 6 + 2] = z0; box[(br * nt + bc) * 6 + 3] = x1; box[(br * nt + bc) * 6 + 4] = y1; box[(br * nt + bc) * 6 + 5] = z1;
    }
  }
  /* tiles of Tz cell rows x Tx cell columns in band-major order; the same triangles, regrouped. */
  function planTiles(index, position, grid, Tz, Tx) {
    const { rows, cols } = grid, nb = Math.ceil(rows / Tz), nt = Math.ceil(cols / Tx), out = new index.constructor(index.length);
    const tileStart = new Uint32Array(nb * nt + 1), box = new Float32Array(nb * nt * 6);
    let o = 0;
    for (let br = 0; br < nb; br++) for (let bc = 0; bc < nt; bc++) {
      const r0 = br * Tz, r1 = Math.min(rows, r0 + Tz), c0 = bc * Tx, c1 = Math.min(cols, c0 + Tx);
      tileStart[br * nt + bc] = o;
      for (let r = r0; r < r1; r++) { const s = (r * cols + c0) * 6, n = (c1 - c0) * 6; out.set(index.subarray(s, s + n), o); o += n; }
    }
    tileStart[nb * nt] = o; fillBoxes(position, grid, Tz, Tx, box);
    return { nb, nt, out, tileStart, box, Tz, Tx };
  }

  /* PROPOSAL (picture-changing, off unless ?optMlod=1 / tune.lod = 1): the same tiles with every 2 x 2 cells made two triangles (the corners only), for the river's
     mirror (658 x 326 px). The block's rim along the leftover odd bottom row gets the extra middle vertex (three triangles), so no crack opens there. */
  function planCoarse(index, position, grid, plan) {
    const { W, rows, cols } = grid, { nb, nt, Tz, Tx } = plan; if (cols % 2 || Tz % 2 || Tx % 2) return null; const out = [], tileStart = new Uint32Array(nb * nt + 1), even = rows - rows % 2, y = v => position[v * 3 + 1];
    for (let br = 0; br < nb; br++) for (let bc = 0; bc < nt; bc++) {
      tileStart[br * nt + bc] = out.length;
      const r0 = br * Tz, r1 = Math.min(even, r0 + Tz), c0 = bc * Tx, c1 = Math.min(cols - cols % 2, c0 + Tx);
      for (let r = r0; r + 2 <= r1; r += 2) for (let c = c0; c + 2 <= c1; c += 2) {
        const A = r * W + c, B = A + 2, C = A + 2 * W, D = C + 2;
        if (r + 2 === even && rows % 2) { const M = C + 1; out.push(A, B, D, A, D, M, A, M, C); }
        else if (Math.abs(y(A) - y(D)) < Math.abs(y(B) - y(C))) out.push(A, B, D, A, D, C); else out.push(A, B, C, C, B, D);
      }
      if (rows % 2 && r0 + Tz >= rows) { const k0 = ((rows - 1) * cols + c0) * 6, k1 = ((rows - 1) * cols + Math.min(cols, c0 + Tx)) * 6; for (let k = k0; k < k1; k++) out.push(index[k]); }   /* the odd last cell row stays as it is */
    }
    tileStart[nb * nt] = out.length;
    return { out: Uint32Array.from(out), tileStart };
  }
  const mul = (a, b) => { const o = new Float64Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  /* the six clip planes of a column-major clip matrix (WebGL clip volume -w <= x, y, z <= w) */
  function planesOf(m, P) {
    P = P || new Float64Array(24);
    const r = i => [m[i], m[4 + i], m[8 + i], m[12 + i]], r0 = r(0), r1 = r(1), r2 = r(2), r3 = r(3);
    let k = 0; for (const [a, s] of [[r0, 1], [r0, -1], [r1, 1], [r1, -1], [r2, 1], [r2, -1]]) { P[k++] = r3[0] + s * a[0]; P[k++] = r3[1] + s * a[1]; P[k++] = r3[2] + s * a[2]; P[k++] = r3[3] + s * a[3]; }
    return P;
  }
  function boxVisible(P, b, o) {
    for (let k = 0; k < 24; k += 4) {
      const px = P[k] >= 0 ? b[o + 3] : b[o], py = P[k + 1] >= 0 ? b[o + 4] : b[o + 1], pz = P[k + 2] >= 0 ? b[o + 5] : b[o + 2];
      if (P[k] * px + P[k + 1] * py + P[k + 2] * pz + P[k + 3] < 0) return false;
    }
    return true;
  }
  /* index ranges to draw: one run per visible band (from its first to its last visible tile); runs that touch, or lie closer than gap indices, are one */
  function visibleRanges(plan, P, gap, out, table) {
    const { nb, nt, box } = plan, tileStart = table || plan.tileStart; out = out || []; out.length = 0;
    for (let br = 0; br < nb; br++) {
      let first = -1, last = -1;
      for (let bc = 0; bc < nt; bc++) if (boxVisible(P, box, (br * nt + bc) * 6)) { if (first < 0) first = bc; last = bc; }
      if (first < 0) continue;
      const s = tileStart[br * nt + first], e = tileStart[br * nt + last + 1], n = out.length;
      if (n && s - out[n - 1][1] <= gap) out[n - 1][1] = e; else out.push([s, e]);
    }
    return out;
  }
  /* set of triangles, order and rotation-insensitive but winding-sensitive: sum and xor of a 2x32-bit mix per triangle */
  function triangleSetHash(index) {
    let s1 = 0, s2 = 0, x1 = 0, x2 = 0;
    for (let i = 0; i < index.length; i += 3) {
      let a = index[i], b = index[i + 1], c = index[i + 2];
      if (b < a && b < c) { const t = a; a = b; b = c; c = t; } else if (c < a && c < b) { const t = a; a = c; c = b; b = t; }   /* rotate the smallest first: keeps the winding */
      let h1 = Math.imul(a, 0x9E3779B1) ^ Math.imul(b + 0x7F4A7C15, 0x85EBCA6B) ^ Math.imul(c + 0x165667B1, 0xC2B2AE35), h2 = Math.imul(b, 0x27D4EB2F) ^ Math.imul(c + 0x61C88647, 0x9E3779B1) ^ Math.imul(a + 0x2545F491, 0xFF51AFD7);
      h1 ^= h1 >>> 15; h1 = Math.imul(h1, 0x2C1B3C6D); h1 ^= h1 >>> 12; h2 ^= h2 >>> 13; h2 = Math.imul(h2, 0x297A2D39); h2 ^= h2 >>> 16;
      s1 = (s1 + (h1 >>> 0)) >>> 0; s2 = (s2 + (h2 >>> 0)) >>> 0; x1 ^= h1; x2 ^= h2;
    }
    return [s1, s2, x1 >>> 0, x2 >>> 0].join('.') + ':' + index.length;
  }
  const CORE = { gridOf, planTiles, fillBoxes, planCoarse, planesOf, boxVisible, visibleRanges, triangleSetHash, mul };
  if (typeof module !== 'undefined' && module.exports) { module.exports = CORE; return; }
  if (!root || !root.document) return;

  /* ---------------------------------------------------------------- the page */
  const Q = new URLSearchParams(location.search), html = document.documentElement;
  const TERRAIN = 'Interlocking alpine massifs and carved confluences';
  const state = { on: false, why: '', terrain: null }, tune = { cull: 1, Tz: 64, Tx: 16, gap: 24000, lod: Q.get('optMlod') === '1' ? 1 : 0 };
  const API = root.__RISE_GEO__ = { state, tune, core: CORE, stats: () => JSON.parse(JSON.stringify(state)) };
  if (!html.hasAttribute('data-rise-studio-pbr')) { state.why = 'not the rise page'; return; }
  if (Q.get('perf') === '0' || Q.get('optM') === '0') { state.why = 'off: ?perf=0 / ?optM=0'; return; }
  if (Q.get('optMcull') === '0') { state.why = 'off: ?optMcull=0'; return; }
  state.on = true; state.why = 'waiting for the canyon';

  const now = () => performance.now();
  function tileTerrain(THREE, renderer, mesh) {
    const g = mesh.geometry, idx = g && g.index, pos = g && g.attributes && g.attributes.position;
    if (!idx || !pos || pos.itemSize !== 3 || pos.isInterleavedBufferAttribute) { state.terrain = 'not tiled: no plain indexed geometry'; return; }
    /* the tile boxes are the vertices' own positions: only right while the vertex shader does not move them (the canyon walls' bank material does, this one does not) */
    for (const m of [].concat(mesh.material || [])) if (m && m.defines && (m.defines.ALP_BANK || m.defines.USE_SKINNING || m.defines.USE_MORPHTARGETS)) { state.terrain = 'not tiled: the material displaces vertices'; return; }
    const I = idx.array, P = pos.array, t0 = now(), grid = gridOf(I, pos.count);
    if (!grid) { state.terrain = 'not tiled: the index is not the cell-by-cell grid'; return; }
    const want = Q.get('optMverify') === '1', before = want ? triangleSetHash(I) : null;
    const plan = planTiles(I, P, grid, tune.Tz, tune.Tx), coarse = tune.lod ? planCoarse(I, P, grid, plan) : null;
    I.set(plan.out); plan.out = null; idx.needsUpdate = true;
    const after = want ? triangleSetHash(I) : null;
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_multi_draw'), type = I instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, bytes = I.BYTES_PER_ELEMENT;
    const S = state.terrain = { tiles: plan.nb * plan.nt, bands: plan.nb, per: plan.nt, tile: tune.Tz + 'x' + tune.Tx, triangles: I.length / 3, ms: +(now() - t0).toFixed(1), identical: want ? before === after : 'not checked (?optMverify=1)', multiDraw: !!ext, passes: 0, seen: 0, drawn: 0, ranges: 0, last: null };
    const planes = new Float64Array(24), runs = [], counts = new Int32Array(64), offsets = new Int32Array(64);
    let pend = null, pendCoarse = false, coarseBuf = null, fineBuf = null;
    if (coarse) { coarseBuf = gl.createBuffer(); gl.bindBuffer(gl.COPY_WRITE_BUFFER, coarseBuf); gl.bufferData(gl.COPY_WRITE_BUFFER, coarse.out, gl.STATIC_DRAW); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);   /* WebGL2: any target; no vertex array's index binding is touched */ S.coarse = { triangles: coarse.out.length / 3, mb: +(coarse.out.byteLength / 1048576).toFixed(2) }; }
    const isMirror = renderer_ => { const rt = renderer_.getRenderTarget(); return !!rt && rt.width <= 0.35 * renderer_.domElement.width; };
    const prevBefore = mesh.onBeforeRender, prevAfter = mesh.onAfterRender, prevShB = mesh.onBeforeShadow, prevShA = mesh.onAfterShadow;
    let boxVersion = pos.version;
    const cut = camera => {
      if (pos.version !== boxVersion) { boxVersion = pos.version; fillBoxes(P, grid, tune.Tz, tune.Tx, plan.box); S.boxRefresh = (S.boxRefresh || 0) + 1; }   /* the tuner moved the terrain's heights */
      planesOf(mul(camera.projectionMatrix.elements, mul(camera.matrixWorldInverse.elements, mesh.matrixWorld.elements)), planes);
      pendCoarse = !!(coarse && tune.lod && isMirror(renderer));
      visibleRanges(plan, planes, tune.gap * 3, runs, pendCoarse ? coarse.tileStart : null);
      let n = 0; for (const r of runs) n += r[1] - r[0];
      S.passes++; S.drawn += n / 3; S.ranges += runs.length; S.last = { share: +(n / I.length).toFixed(3), runs: runs.length, coarse: pendCoarse };
      g.drawRange.start = 0; g.drawRange.count = 0;   /* the page's own draw now draws nothing: the program and vertex array are set up all the same */
      pend = runs.length ? runs : null;
    };
    const flush = () => {
      g.drawRange.start = 0; g.drawRange.count = Infinity;
      if (!pend) return; const n = pend.length;
      if (pendCoarse) { fineBuf = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, coarseBuf); for (const r of pend) { const c = r[1] - r[0]; gl.drawElements(gl.TRIANGLES, c, type, r[0] * bytes); renderer.info.update(c, gl.TRIANGLES, 1); } gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fineBuf); pendCoarse = false; }
      else if (ext && n > 1 && n <= 64) { let total = 0; for (let k = 0; k < n; k++) { counts[k] = pend[k][1] - pend[k][0]; offsets[k] = pend[k][0] * bytes; total += counts[k]; } ext.multiDrawElementsWEBGL(gl.TRIANGLES, counts, 0, type, offsets, 0, n); renderer.info.update(total, gl.TRIANGLES, 1); renderer.info.render.calls += n - 1; }
      else for (const r of pend) { const c = r[1] - r[0]; gl.drawElements(gl.TRIANGLES, c, type, r[0] * bytes); renderer.info.update(c, gl.TRIANGLES, 1); }
      pend = null;
    };
    const safeCut = camera => { try { cut(camera); } catch (error) { g.drawRange.start = 0; g.drawRange.count = Infinity; pend = null; tune.cull = 0; state.why = 'culling stopped: ' + (error && error.message || error); console.warn('flow2 rise geo: the terrain is drawn whole again', error); } };   /* any trouble: the page's own draw, whole */
    mesh.onBeforeRender = function (r, scene, camera, geometry, material, group) { if (prevBefore) prevBefore.apply(this, arguments); if (geometry === g) S.seen++; if (tune.cull && geometry === g) safeCut(camera); };
    mesh.onAfterRender = function (r, scene, camera, geometry, material, group) { if (geometry === g) flush(); if (prevAfter) prevAfter.apply(this, arguments); };
    mesh.onBeforeShadow = function (r, obj, camera, shadowCamera, geometry) { if (prevShB) prevShB.apply(this, arguments); if (tune.cull && geometry === g) safeCut(shadowCamera); };
    mesh.onAfterShadow = function (r, obj, camera, shadowCamera, geometry) { if (geometry === g) flush(); if (prevShA) prevShA.apply(this, arguments); };
    state.why = 'tiled';
  }

  function install(handles) {
    const { THREE, renderer, canyon } = handles || {};
    if (!THREE || !renderer || !canyon || !canyon.scene) { state.why = 'no canyon handles'; return; }
    let terrain = null; canyon.scene.traverse(o => { if (!terrain && o.isMesh && o.name === TERRAIN) terrain = o; });
    if (!terrain) { state.terrain = 'not found'; state.why = 'no terrain mesh'; return; }
    tileTerrain(THREE, renderer, terrain);
  }
  const host = root.__FLOW2_FINE_JOURNEY__ = root.__FLOW2_FINE_JOURNEY__ || {}, before = host.canyon;
  host.canyon = function (handles) { try { return before ? before.apply(this, arguments) : undefined; } finally { try { install(handles); } catch (error) { state.why = 'failed: ' + (error && error.message || error); console.warn('flow2 rise geo: terrain draw unchanged', error); } } };
})(typeof window !== 'undefined' ? window : null);
