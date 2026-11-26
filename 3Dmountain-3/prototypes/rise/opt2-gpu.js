/* OPT2 · team B · GPU frame cost (2026-11-25, client: 「畫質不要變動太大 肉眼看不出來的狀態下 優化到極致」; docs/perf/enter-round/OPT2-B.md).
   Only under html[data-rise-opt2] (set by index1-5-canyon-forest-rise-ui-enter-round.html; ?opt2=0 = off), not with ?opt2B=0.
   Single parts off: ?opt2Boff=mirror,order (comma list). Live: window.__OPT2_B__ = { state, tune }.
   The view from above draws its land (flow2-original-scene.js 'Forest relief grid' + the studio PBR program) twice per frame: once from the
   river's mirror camera into a half-size target, once into the full-size land target. Measured (OPT2-B.md §1) it is 79 % of that frame.
     mirror  The mirror picture is read only by water inside the plate where the studio program's obliqueMirror > .01 (|view.y| < .867), at the
             water point's own mirrored screen position plus a ripple offset of at most .075 × |slope|. Each frame (re-computed only when the
             camera moves) the part of the mirror target that can be read is bounded on a 48 × 28 grid over the plate (both water heights, one
             grid step of dilation, the largest possible ripple offset as margin) and the mirror pass is scissored to it; nothing readable =
             the pass is skipped. Pixels that are read are drawn exactly as before (same program, same camera) — the picture is identical.
             Only when the studio program fully replaces the original water colour (uPbrStyle × uPbrTerrainOn ≥ 1 and water on), otherwise
             the whole target is drawn as before (the original water samples the mirror everywhere).
     order   The land's triangles are drawn nearest rows first (a second, reversed copy of the same index; picked per frame from where the
             camera stands): hidden hill sides then fail the depth test before the program runs. Same triangles, same depth test. */
(() => {
  'use strict';
  const html = document.documentElement, Q = new URLSearchParams(location.search);
  if (!html.hasAttribute('data-rise-opt2') || Q.get('opt2B') === '0' || window.__OPT2_B__) return;   /* once (a test harness may inject it too) */
  const off = new Set((Q.get('opt2Boff') || '').split(',').map(s => s.trim()).filter(Boolean));
  const S = { occ: 0, occFrames: 0, stage: 'waiting', mirror: off.has('mirror') ? 'off' : 'pending', order: off.has('order') ? 'off' : 'pending', errors: [],
    rect: null, skipped: 0, scissored: 0, whole: 0, share: 1, rev: 0, fwd: 0 };
  const T = { mirror: off.has('mirror') ? 0 : 1, order: off.has('order') ? 0 : 1, thr: .89, poison: 0,
    /* mirrorK (B2): the river mirror at half its width and height (a quarter of its pixels). The water reads it through a ripple offset and a
       Fresnel weight ≤ .56: frozen-frame A/B at the view = mean 0.002 / max 2 of 255 (shots/b-b2-mirror-half-view.jpg). ?opt2BmirrorK=1 = as before. */
    mirrorK: off.has('mirrorK') ? 1 : (v => Number.isFinite(v) && v > 0 ? v : .5)(parseFloat(Q.get('opt2BmirrorK'))),
    occ: off.has('occ') ? 0 : 1, occMargin: .1 };   /* occ: the round opening's covered core is not shaded in the canyon (see below); occMargin in short-side units */   /* mirrorK: the river mirror's size × this (read by flow2-original-scene.js; 1 = as before) */   /* poison (tests only): the parts of the mirror left undrawn are filled magenta, so a wrong bound shows */
  window.__OPT2_B__ = { state: S, tune: T };
  html.setAttribute('data-rise-opt2-b', '');

  let tries = 0;
  const iv = setInterval(() => {
    const A = window.__FLOW2_FOREST_ATLAS__, sc = A && A.scene && A.scene.scene;
    if (A && A.state && A.state.ready && sc) { clearInterval(iv); try { install(A, sc); } catch (error) { S.errors.push(String(error && error.message || error)); S.stage = 'failed'; } }
    else if (++tries > 1200) { clearInterval(iv); S.stage = 'no view'; }
  }, 250);

  function install(A, sc) {
    let grid = null, probe = null;
    sc.traverse(o => { if (o.name === 'Forest relief grid' && o.isMesh) grid = o; if (o.name === 'Forest mirror' && o.isMesh) probe = o; });
    if (!grid) { S.stage = 'no land'; return; }
    S.stage = 'on';
    if (T.mirror && probe) installMirror(grid, probe); else if (T.mirror) S.mirror = 'no mirror';
    if (T.order) installOrder(grid);
    if (html.hasAttribute('data-rise-enter-round')) installOcc(A).catch(error => { S.errors.push('occ: ' + String(error && error.message || error)); });
  }

  /* ---------------- occ: the canyon is not shaded under the round opening's covered core ----------------
     During the canyon -> view change (flow2-lift-cut.js round mode, drawn by flow2-forest-atlas.js's composite) the view covers a disc at the
     centre completely: rMask = 1 inside r × solid, × open (= 1 once the opening is born); the composite reads the canyon there only through its
     radial blur, whose taps reach in to (1 − blur) × the radius. A depth-only disc drawn first in the canyon's main pass, smaller than that by a
     margin (occMargin: the canyon's depth motion streaks reach ±55 px at this size, its bloom spreads further but faintly), makes the canyon's
     walls fail the depth test there before they are shaded. When the opening covers the screen (cover) the whole canyon is skipped that way
     (the composite reads none of it). Nothing else draws with it: other cameras / targets (the river's mirror) see a zero-size disc. */
  async function installOcc(A) {
    const St = window.__MONTIS_STUDY__, cyn = St && St.canyon;
    if (!cyn || !cyn.scene || !cyn.camera) { S.occState = 'no canyon'; return; }
    const THREE = await import('three');
    const R = St.renderer;
    const mat = new THREE.ShaderMaterial({ uniforms: { uS: { value: new THREE.Vector2() } },
      vertexShader: 'uniform vec2 uS; void main(){ gl_Position = vec4(position.xy * uS, -1.0, 1.0); }',
      fragmentShader: 'void main(){ gl_FragColor = vec4(0.); }',
      colorWrite: false, depthWrite: true, depthTest: true, depthFunc: THREE.AlwaysDepth, toneMapped: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 96), mat);
    disc.frustumCulled = false; disc.renderOrder = -1e9; disc.matrixAutoUpdate = false; disc.name = 'OPT2-B covered core (depth only)';
    disc.onBeforeRender = (r, scene, cam) => {
      let k = 0; const t = r.getRenderTarget();
      if (T.occ >= .5 && cam === cyn.camera && t && t.width === R.domElement.width && t.height === R.domElement.height) {
        const o = A.override, RR = o && o.on && !o.reduce && !o.warm && o.round;
        if (RR && A.state.view === 1) {
          const core = (+RR.r || 0) * Math.min(1, Math.max(0, +RR.solid || 0)), m0 = Math.min(t.width, t.height);
          /* the solid core reaches every corner: no pixel reads the canyon (no blur taps either) */
          if (RR.cover || (+RR.open >= .999 && core > .5 * Math.hypot(t.width / m0, t.height / m0) + .01)) k = 4;
          else if (+RR.open >= .999) k = core * (1 - Math.min(.9, Math.max(0, +RR.blur || 0))) - T.occMargin;
        }
      }
      if (k > .03) { const w = t.width, h = t.height, m = Math.min(w, h); mat.uniforms.uS.value.set(2 * k * m / w, 2 * k * m / h); S.occ = +k.toFixed(3); S.occFrames++; }
      else { mat.uniforms.uS.value.set(0, 0); S.occ = 0; }
    };
    cyn.scene.add(disc);
    S.occState = 'on';
  }

  /* ---------------- mirror: draw only the part of the mirror target that the water can read ---------------- */
  function installMirror(grid, probe) {
    const U = grid.material.uniforms;
    if (!U.tRefl || !U.uBounds || !U.uYRange || !U.uRelief || !U.uPbrStyle || !U.uPbrTerrainOn || !U.uWaterOn) { S.mirror = 'uniforms missing'; return; }
    const reflTex = U.tRefl.value;
    if (!reflTex) { S.mirror = 'no target'; return; }
    const V3 = grid.position.constructor, M4 = grid.matrixWorld.constructor;
    const NX = 48, NZ = 28, pv = new M4(), p = new V3();
    const lastCam = new Float64Array(32); let cached = null;
    const ndcU = new Float32Array((NX + 1) * (NZ + 1) * 2), ndcV = new Float32Array((NX + 1) * (NZ + 1) * 2), ok = new Uint8Array((NX + 1) * (NZ + 1));
    /* where the mirror can be read, in its own uv (0..1, v up), or null (= all of it), or false (= nowhere); also D = how far (uv) a water
       fragment's read can sit from the fragment itself before the ripple (the mirrored point of raised branch water projects lower), m = the ripple */
    let lastD = 1, lastM = 1;
    function readable(cam) {
      const st = Math.min(1.25, Math.max(0, +U.uPbrStyle.value || 0)) * (+U.uPbrTerrainOn.value || 0);
      if (!(st >= 1) || !(+U.uWaterOn.value > .5)) return null;
      cam.updateMatrixWorld();
      const me = cam.matrixWorld.elements, pe = cam.projectionMatrix.elements;
      let same = cached !== null; for (let k = 0; k < 16; k++) { if (lastCam[k] !== me[k] || lastCam[16 + k] !== pe[k]) { same = false; lastCam[k] = me[k]; lastCam[16 + k] = pe[k]; } }
      const b = U.uBounds.value, yr = U.uYRange.value, rel = +U.uRelief.value || 0, wave = Math.min(2.5, Math.max(.1, +(U.uWaterWave ? U.uWaterWave.value : 1) || 1));
      const key = b.x + ',' + b.y + ',' + b.z + ',' + b.w + ',' + yr.x + ',' + yr.y + ',' + rel + ',' + wave + ',' + T.thr;
      if (same && cached.key === key) { lastD = cached.D; lastM = cached.m; return cached.r; }
      const x0 = b.x, z0 = b.y, sx = 1 / b.z, sz = 1 / b.w;
      const yLo = .105, yHi = .105 + Math.max(0, yr.y) * Math.max(0, rel) + .14;   /* the highest water: a branch's bed + the shelf above it (the program's branchGate) */
      pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      const e = pv.elements, cx = me[12], cy = me[13], cz = me[14];
      let any = false, D = 0;
      for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
        const k = j * (NX + 1) + i, x = x0 + sx * i / NX, z = z0 + sz * j / NZ;
        /* |view.y| is smallest at the highest point of a column: oblique there or nowhere */
        const dx = cx - x, dz = cz - z, dy = cy - yHi, vy = Math.abs(dy) / Math.max(1e-9, Math.hypot(dx, dy, dz));
        ok[k] = vy < T.thr ? 1 : 0; if (ok[k]) any = true;
        for (let h = 0; h < 2; h++) {
          const y = .21 - (h ? yHi : yLo);   /* the mirrored point */
          const w = e[3] * x + e[7] * y + e[11] * z + e[15];
          if (!(w > 1e-6)) { cached = { key, r: null, D: 1, m: 1 }; lastD = lastM = 1; return null; }
          ndcU[k * 2 + h] = (e[0] * x + e[4] * y + e[8] * z + e[12]) / w;
          ndcV[k * 2 + h] = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w;
        }
        { const w = e[3] * x + e[7] * yHi + e[11] * z + e[15]; if (!(w > 1e-6)) { cached = { key, r: null, D: 1, m: 1 }; lastD = lastM = 1; return null; }
          const du = (e[0] * x + e[4] * yHi + e[8] * z + e[12]) / w - ndcU[k * 2 + 1], dv = (e[1] * x + e[5] * yHi + e[9] * z + e[13]) / w - ndcV[k * 2 + 1];
          D = Math.max(D, .5 * Math.hypot(du, dv)); }
      }
      const m = .075 * .68 * wave * 3.0 + .01;
      lastD = D; lastM = m;
      if (!any) { cached = { key, r: false, D, m }; return false; }
      let u0 = 9, v0 = 9, u1 = -9, v1 = -9;
      for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
        if (!ok[j * (NX + 1) + i]) continue;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const jj = j + dj, ii = i + di; if (jj < 0 || jj > NZ || ii < 0 || ii > NX) continue;
          const k = jj * (NX + 1) + ii;
          for (let h = 0; h < 2; h++) { const u = ndcU[k * 2 + h], v = ndcV[k * 2 + h]; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
        }
      }
      /* ndc -> uv, + the largest ripple offset the program can add (.075 × .68 × wave × |dualSlope|, |dualSlope| ≤ (1.25 + .78) × √2 + the logo ripple) */
      const r = [Math.max(0, u0 * .5 + .5 - m), Math.max(0, v0 * .5 + .5 - m), Math.min(1, u1 * .5 + .5 + m), Math.min(1, v1 * .5 + .5 + m)];
      cached = { key, r: r[2] > r[0] && r[3] > r[1] ? r : false, D, m };
      return cached.r;
    }
    let rt = null, want = null;
    const keep = probe.material.color.clone();   /* a THREE.Color */
    function poison(r, t) { const was = r.getRenderTarget(), st = t.scissorTest, cc = r.getClearColor(keep), ca = r.getClearAlpha(); t.scissorTest = false; r.setRenderTarget(t); r.setClearColor(0xff00ff, 1); r.clear(); r.setClearColor(cc, ca); t.scissorTest = st; r.setRenderTarget(was); }
    const ob = probe.onBeforeRender;
    probe.onBeforeRender = function (r, scene, cam) {
      if (!(T.mirror >= .5) || !cam || !cam.isCamera) { if (rt) rt.scissorTest = false; return ob.apply(this, arguments); }
      let reg;
      try { reg = readable(cam); } catch (error) { reg = null; S.errors.push('mirror: ' + String(error && error.message || error)); T.mirror = 0; }
      if (reg === false && rt) { S.skipped++; S.rect = 'none'; S.share = 0; if (T.poison) poison(r, rt); return; }   /* nothing on screen can read it: the pass is not drawn (the target keeps its last picture, never read) */
      want = reg || null;
      /* the land is drawn only inside its target's scissor box (flow2-forest-atlas.js landBox: the round opening; flow2-lake-dive.js: the inner
         circle): no water outside it reads the mirror. Only where the studio program owns the water (reg not null). */
      const cur = r.getRenderTarget();
      if (want && cur && cur.scissorTest && cur.width > 0 && cur.height > 0) {
        const sc = cur.scissor, g = lastD + lastM + .004;
        const bx = [sc.x / cur.width - g, sc.y / cur.height - g, (sc.x + sc.z) / cur.width + g, (sc.y + sc.w) / cur.height + g];
        want = [Math.max(want[0], bx[0]), Math.max(want[1], bx[1]), Math.min(want[2], bx[2]), Math.min(want[3], bx[3])];
        if (!(want[2] > want[0] && want[3] > want[1])) { if (rt) { S.skipped++; S.rect = 'none (box)'; S.share = 0; if (T.poison) poison(r, rt); return; } want = reg; }
        S.boxed = (S.boxed || 0) + 1;
      }
      const set = r.setRenderTarget;
      r.setRenderTarget = function (t) {
        if (t && t.texture === reflTex) {
          rt = t;
          if (want) {
            const x = Math.max(0, Math.floor(want[0] * t.width) - 2), y = Math.max(0, Math.floor(want[1] * t.height) - 2);
            const w = Math.min(t.width, Math.ceil(want[2] * t.width) + 2) - x, h = Math.min(t.height, Math.ceil(want[3] * t.height) + 2) - y;
            t.scissor.set(x, y, Math.max(1, w), Math.max(1, h)); t.scissorTest = w < t.width || h < t.height;
            S.share = +((w * h) / (t.width * t.height)).toFixed(3); S.rect = [x, y, w, h]; S.scissored++;
            if (T.poison && t.scissorTest) { r.setRenderTarget = set; poison(r, t); r.setRenderTarget = this.setRenderTarget; }
          } else { t.scissorTest = false; S.share = 1; S.rect = 'all'; S.whole++; }
        }
        return set.apply(this, arguments);
      };
      try { return ob.apply(this, arguments); } finally { r.setRenderTarget = set; }
    };
    S.mirror = 'on';
  }

  /* ---------------- order: nearest rows first ---------------- */
  function installOrder(grid) {
    const g = grid.geometry, A0 = g.index, pos = g.attributes.position;
    if (!A0 || !pos || g.groups.length || g.drawRange.start !== 0 || g.drawRange.count < A0.count) { S.order = 'not a plain index'; return; }
    /* the studio's extended relief grid (studio-terrain-pbr-layer.js buildExtendedReliefGrid) emits its cells row by row, z ascending
       (fine cells and their fans inline); the lattice comes first in the vertex list */
    const pa = pos.array, n = pos.count; let row = 1; while (row < n && pa[row * 3 + 2] === pa[2]) row++;
    let rows = 1; while ((rows + 1) * row <= n && pa[rows * row * 3] === pa[0] && pa[rows * row * 3 + 2] > pa[(rows - 1) * row * 3 + 2]) rows++;
    const zLo = pa[2], zHi = pa[((rows - 1) * row) * 3 + 2];
    if (!(rows > 8 && row > 8 && zHi !== zLo)) { S.order = 'no rows'; return; }
    S.lattice = row + ' x ' + rows + ', ' + (A0.count / 3) + ' triangles';
    let A1 = null;
    const build = () => {
      const a = A0.array, N = a.length / 3, b = new a.constructor(a.length);
      for (let t = 0, s = (N - 1) * 3; t < a.length; t += 3, s -= 3) { b[t] = a[s]; b[t + 1] = a[s + 1]; b[t + 2] = a[s + 2]; }
      A1 = new A0.constructor(b, 1); S.order = 'on';
    };
    (window.requestIdleCallback || (f => setTimeout(f, 50)))(() => { try { build(); } catch (error) { S.order = 'failed'; S.errors.push('order: ' + String(error && error.message || error)); } }, { timeout: 3000 });
    const prev = grid.onBeforeRender;
    const zMid = (zLo + zHi) / 2;
    grid.onBeforeRender = function (r, scene, cam) {
      if (A1 && cam && (g.index === A0 || g.index === A1)) {   /* an index someone else set is left alone */
        /* rows run from z = zLo (first) to zHi (last); a camera on the zHi side sees the last rows nearest */
        const cz = cam.matrixWorld.elements[14];   /* the mirror camera is mirrored in y only: same z */
        const rev = T.order >= .5 && (zHi > zLo ? cz > zMid : cz < zMid);
        const want = rev ? A1 : A0;
        if (g.index !== want) g.setIndex(want);
        if (rev) S.rev++; else S.fwd++;
      }
      return prev.apply(this, arguments);
    };
  }
})();
