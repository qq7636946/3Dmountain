/* Flow2 · the drop's light ribbon (Team SQ, 2026-11-17). index1-5-canyon-forest.html. The default trail.
   Client 「水滴山道跑動後面要帶光束如圖一 只是不要像之前那像一堆像靈魂 可能一條厚的?」 with a long-exposure light-painting photo: ONE flat ribbon
   of parallel thin bright lines, evenly spaced like a flat cable, following one smooth winding path along the ground, even in brightness.
   · The ribbon is locked to the drop's OWN flown path (recorded as it moves, the last ≈ 120 m): it grows out of the drop's back while the drop
     runs, sinks from the drop down to skim just above the river, and lies along the path round the bends back past the lens — so, as in
     the photo, it enters large from the lower left in the foreground (near the lens it keeps to the left, clear of the title) and narrows
     into the distance to the drop. Seven parallel lines on one band of constant
     width in the world (it narrows naturally with distance; the lines stay parallel through the bends: offsets of the path, never strands).
   · Even brightness, a little brighter right behind the drop (it joins it), a gentle fade only at the far tail; cool white with the faintest
     blue, a soft glow only; its broken reflection on the river.
   · At rest the ribbon stays long (a still photograph) and a calm light pulse travels along it toward the drop; moving back, it shortens from the drop's end (it
     never lies in front of the drop). The chapter title and the left rail stay readable (its light is held to 30 % over them).
   Everything adds light (finite, ≥ 0, the buffer's alpha untouched), depth-tested against the canyon. Other trails: ?trail=beads (the bead
   string + wake), ?trail=beam (the earlier light strands). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  /* 2026-11-17 client 「然後水滴拖尾先取消好了」: no trail by default (nothing built); ?trail=ribbon shows this ribbon */
  if (Q.get('trail') !== 'ribbon' || Q.get('drop') === '0' || Q.get('beam') === '0') return;
  const T = {
    width: num('ribbonW', 1.2),      // metres across (constant in the world)
    lines: 7,                         // parallel lines
    skim: .6,                         // metres above the river it settles to behind the drop
    sink: 15,                         // metres behind the drop over which it sinks from the drop to the skim height (a long, smooth arc)
    maxLen: 120, restLen: 110,       // metres of ribbon (the whole flown path, back past the lens like the client's photo); at rest it barely shortens
    aside: 7.5, asideNear: 14, asideFar: 36,   // near the lens the ribbon keeps to the lower left (metres left of the lens's path, full within asideNear m)
    gain: num('ribbonGain', 2.1)
  };
  function num(k, d) { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; }
  const layer = { name: 'ribbon', order: .5, tune: T };
  (window.__FLOW2_SEAGULL_LAYERS__ ||= []).push(layer);
  const clamp01 = x => Math.min(1, Math.max(0, x)), smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  let THREE, ribbon, mirror, U, pathTex, pathData, M = 256, NS = 240;
  const hist = [], V = {};
  layer.init = ctx => {
    THREE = ctx.THREE;
    const ADD = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
    pathData = new Float32Array(M * 4);
    pathTex = new THREE.DataTexture(pathData, M, 1, THREE.RGBAFormat, THREE.FloatType); pathTex.minFilter = pathTex.magFilter = THREE.NearestFilter; pathTex.needsUpdate = true;
    /* a baked noise for the reflection's break-up */
    const NW = 64, nd = new Uint8Array(NW * NW * 4), h1 = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
    for (let y = 0; y < NW; y++) for (let x = 0; x < NW; x++) { const k = (y * NW + x) * 4, gx = Math.floor(x / 8), gy = Math.floor(y / 8), fx = (x % 8) / 8, fy = (y % 8) / 8;
      const a = h1(gx % 8 * 57 + gy % 8 * 131), b = h1((gx + 1) % 8 * 57 + gy % 8 * 131), c = h1(gx % 8 * 57 + (gy + 1) % 8 * 131), e = h1((gx + 1) % 8 * 57 + (gy + 1) % 8 * 131);
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); nd[k] = nd[k + 1] = nd[k + 2] = Math.round(((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + e * sx) * sy) * 255); nd[k + 3] = 255; }
    const noise = new THREE.DataTexture(nd, NW, NW, THREE.RGBAFormat); noise.wrapS = noise.wrapT = THREE.RepeatWrapping; noise.magFilter = noise.minFilter = THREE.LinearFilter; noise.needsUpdate = true;
    const pos = new Float32Array(NS * 2 * 3), idx = [];
    for (let i = 0; i < NS; i++) for (let j = 0; j < 2; j++) { const k = (i * 2 + j) * 3; pos[k] = j * 2 - 1; pos[k + 1] = 0; pos[k + 2] = i / (NS - 1); }
    for (let i = 0; i < NS - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    U = { uPath: { value: pathTex }, uN: { value: M }, uLen: { value: 0 }, uW: { value: T.width }, uLines: { value: T.lines }, uAmt: { value: 0 }, uGain: { value: T.gain }, uTime: { value: 0 },
      uPulse: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWater: { value: .04 }, uMirror: { value: 0 }, uNoise: { value: noise },
      uTitle: { value: new THREE.Vector4(-1, -1, -1, -1) }, uRail: { value: new THREE.Vector4(-1, -1, -1, -1) } };
    const VERT = /* glsl */`
uniform sampler2D uPath; uniform float uN, uLen, uW, uWater, uMirror; uniform vec3 uCam; varying float vD; varying float vV; varying vec3 vW;
vec3 path(float d){ float x = clamp(d / max(uLen, 1e-3), 0.0, 1.0) * (uN - 1.0); float i = floor(x), f = x - i;
  return mix(texture2D(uPath, vec2((i + 0.5) / uN, 0.5)).xyz, texture2D(uPath, vec2((min(i + 1.0, uN - 1.0) + 0.5) / uN, 0.5)).xyz, f); }
void main(){
  float d = position.z * uLen; vec3 p = path(d), q = path(d + 0.4) - path(max(0.0, d - 0.4)); float ql = length(q); vec3 t = ql > 1e-4 ? q / ql : vec3(0.0, 0.0, 1.0);
  vec3 toC = uCam - p; float cl = length(toC); toC = cl > 1e-4 ? toC / cl : vec3(0.0, 1.0, 0.0);
  vec3 side = cross(t, toC); float sl = length(side); side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);   /* the band faces the lens: parallel lines stay parallel */
  vec3 lie = cross(t, vec3(0.0, 1.0, 0.0)); float ll = length(lie); lie = ll > 1e-4 ? lie / ll : side; if (dot(lie, side) < 0.0) lie = -lie;
  side = normalize(mix(side, lie, smoothstep(0.12, 0.35, toC.y)) + vec3(1e-5));   /* lying flat on the water where the lens looks down on it */
  vec3 w = p + side * position.x * uW * 0.5;
  if (uMirror > 0.5) {                                   /* where the lens sees this point mirrored on the river */
    float h = max(0.05, w.y - uWater), ch = max(0.3, uCam.y - uWater), k = ch / (ch + h);
    w = vec3(uCam.x + (w.x - uCam.x) * k, uWater, uCam.z + (w.z - uCam.z) * k);
  }
  vD = d; vV = position.x; vW = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
    const FRAG = /* glsl */`precision highp float;
uniform float uLen, uLines, uAmt, uGain, uTime, uPulse, uMirror; uniform vec3 uCam; uniform sampler2D uNoise; uniform vec4 uTitle, uRail; varying float vD; varying float vV; varying vec3 vW;
float holdIn(vec4 b){ vec2 q = gl_FragCoord.xy; vec2 d = max(b.xy - q, q - b.zw); return b.z < 0.0 ? 1.0 : mix(0.3, 1.0, smoothstep(-6.0, 26.0, max(d.x, d.y))); }
void main(){
  /* seven parallel lines, crisp at any distance (their width follows the pixel), on a faint band */
  float t = (vV * 0.5 + 0.5) * (uLines - 1.0), e = abs(t - floor(t + 0.5)), px = max(fwidth(t), 1e-4);
  float line = 1.0 - smoothstep(0.0, px * 1.3 + 0.03, e);
  float band = 0.10 * (1.0 - smoothstep(0.85, 1.0, abs(vV)));
  float along = (1.0 - smoothstep(uLen * 0.7, uLen, vD)) * (1.0 + 0.6 * exp(-vD / 2.5));   /* brighter at the drop, a gentle fade at the tail */
  along *= smoothstep(0.0, 0.5, vD);                                                    /* it starts inside the drop's back */
  float pulse = 1.0 + uPulse * 0.4 * pow(0.5 + 0.5 * cos((vD + uTime * 3.0) * 0.12), 12.0);   /* a calm light travelling along it toward the drop */
  float nearLens = smoothstep(1.6, 4.5, length(vW - uCam));
  float a = (line * 0.9 + band) * along * pulse * nearLens * uAmt * min(holdIn(uTitle), holdIn(uRail));
  if (uMirror > 0.5) { float n = texture2D(uNoise, vW.xz * vec2(0.35, 0.08) + vec2(0.0, uTime * 0.05)).r; a *= 0.32 * (0.3 + 0.7 * smoothstep(0.35, 0.7, n)); }
  gl_FragColor = vec4(clamp(vec3(0.86, 0.93, 1.0) * a * uGain, 0.0, 12.0), 0.0);
}`;
    const mat = () => new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, ...ADD, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    ribbon = new THREE.Mesh(g, mat()); ribbon.frustumCulled = false; ribbon.renderOrder = 20; ribbon.visible = false;
    ribbon.onBeforeRender = () => { U.uMirror.value = 0; };
    const mm = mat(); mm.polygonOffset = true; mm.polygonOffsetFactor = -2; mm.polygonOffsetUnits = -4;
    mirror = new THREE.Mesh(g, mm); mirror.frustumCulled = false; mirror.renderOrder = 18; mirror.visible = false;
    mirror.onBeforeRender = () => { U.uMirror.value = 1; };
    ctx.sceneA.add(mirror, ribbon);
    Object.assign(V, { p: new THREE.Vector3(), dir: new THREE.Vector3() });
  };
  layer.hide = () => { if (ribbon) ribbon.visible = mirror.visible = false; };
  layer.warmPose = () => { U.uLen.value = 10; U.uAmt.value = 1; };

  /* the drop's flown path (head first), points ≥ 0.5 m apart; moving back along it eats it from the head */
  /* round 10 fix: travel is measured over the river (the drop's hover bob is not travel), "moving back" needs real backward motion, and a
     point is only eaten once the drop has passed it going back (before, the bob at rest could eat the whole path a point at a time) */
  const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function track(pos) {
    if (!hist.length) { hist.push(pos.clone()); return 0; }
    const head = hist[0], moved = hd(head, pos);
    if (hist.length > 1 && moved > .02) {
      const prev = hist[1], bx = prev.x - head.x, bz = prev.z - head.z, bl = Math.hypot(bx, bz);
      if (bl > 1e-4 && ((pos.x - head.x) * bx + (pos.z - head.z) * bz) / bl > moved * .5) {   /* moving back along its own path */
        while (hist.length > 2) { const p1 = hist[1], p2 = hist[2]; if ((pos.x - p1.x) * (p2.x - p1.x) + (pos.z - p1.z) * (p2.z - p1.z) > 0) hist.splice(1, 1); else break; }
        head.copy(pos); return -moved;
      }
    }
    head.copy(pos);
    if (hist.length === 1 || hd(hist[1], head) >= .5) hist.splice(1, 0, head.clone());
    let L = 0; for (let i = 1; i < hist.length; i++) { L += hist[i].distanceTo(hist[i - 1]); if (L > T.maxLen + 10) { hist.length = i + 1; break; } }   /* ≤ ≈ 260 points */
    return moved;
  }
  const histLen = () => { let L = 0; for (let i = 1; i < hist.length; i++) L += hist[i].distanceTo(hist[i - 1]); return L; };
  function resample(len, cam) {   /* M samples over [0, len] behind the drop; sinking from the drop to skim the river; near the lens kept to the lower left */
    cam.updateMatrixWorld(); const e = cam.matrixWorld.elements, cx = cam.position.x, cz = cam.position.z;
    let fx = -e[8], fz = -e[10]; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl; const lx = fz, lz = -fx;   /* the lens's horizontal forward and its left */
    let seg = 0, acc = 0;
    for (let k = 0; k < M; k++) {
      const d = len * k / (M - 1);
      while (seg < hist.length - 2 && acc + hist[seg].distanceTo(hist[seg + 1]) < d) { acc += hist[seg].distanceTo(hist[seg + 1]); seg++; }
      const a = hist[seg], b = hist[Math.min(hist.length - 1, seg + 1)], sl = Math.max(1e-4, a.distanceTo(b)), f = clamp01((d - acc) / sl);
      const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, z = a.z + (b.z - a.z) * f;
      const yy = y + (T.skim - y) * smooth(0, T.sink, d);
      const zc = (x - cx) * fx + (z - cz) * fz, aside = T.aside * (1 - smooth(T.asideNear, T.asideFar, zc)) * smooth(0, 8, d) * asideK;
      const xx = x + lx * aside, zz = z + lz * aside;
      pathData.set([Number.isFinite(xx) ? xx : x, Number.isFinite(yy) ? yy : T.skim, Number.isFinite(zz) ? zz : z, 0], k * 4);
    }
    pathTex.needsUpdate = true;
  }
  let titleAt = 0;
  function titleRects(readBuffer) {
    const t = performance.now(); if (t - titleAt < 250) return; titleAt = t;
    const sx = readBuffer.width / innerWidth, sy = readBuffer.height / innerHeight;
    const box = (els, out) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const el of els) { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
      if (x1 > x0) out.set(x0 * sx, (innerHeight - y1) * sy, x1 * sx, (innerHeight - y0) * sy); else out.set(-1, -1, -1, -1); };
    const panel = document.querySelector('.fi-copy-panel.is-active'); box(panel ? panel.querySelectorAll('.fi-copy-kicker, h1, h2, .fi-copy-zh, p') : [], U.uTitle.value);
    const rail = document.querySelector('.fi-rail'); box(rail && getComputedStyle(rail).visibility !== 'hidden' ? [rail, ...rail.querySelectorAll('*')] : [], U.uRail.value);
  }

  let lastT = 0, speed = 0, len = 0, asideK = 1;
  layer.update = (f, ctx, readBuffer) => {
    const D = ctx.drop, cam = ctx.canyon.camera;
    const now = performance.now() / 1000, dt = Math.min(.1, Math.max(0, now - (lastT || now))); lastT = now;
    if (!D || !D.on) { layer.hide(); hist.length = 0; len = 0; return; }
    /* the path is recorded from the drop's back */
    const R = D.radius || 1;
    const moved = track(D.pos);
    speed += (Math.abs(moved) / Math.max(1e-3, dt) - speed) * (1 - Math.exp(-dt / .3));
    const running = D.race > 0;
    const want = running ? T.restLen + (T.maxLen - T.restLen) * clamp01(speed / 8) : 0;   /* the whole flown path; at rest it barely shortens */
    len += (want - len) * (1 - Math.exp(-dt / (want > len ? .35 : 3)));
    const L = Math.min(len, histLen());
    U.uLen.value = L; U.uAmt.value = smooth(0, .06, D.race) * clamp01(L / 3) * D.trail; U.uTime.value = now % 1000;
    U.uPulse.value = 1 - smooth(1, 8, speed); U.uW.value = T.width * (cam.aspect < 1 ? .85 : 1) * Math.max(.6, Math.min(1.2, R / 1.1));
    U.uCam.value.copy(cam.position);
    const on = L > .8 && U.uAmt.value > .005;
    ribbon.visible = mirror.visible = on;
    asideK = cam.aspect < 1 ? .55 : 1;   /* upright phones: the screen is narrow, a smaller step aside keeps it in view */
    if (on) { resample(L, cam); titleRects(readBuffer); }
    ctx.state.ribbon = { len: +L.toFixed(1), speed: +speed.toFixed(1), amt: +U.uAmt.value.toFixed(2) };
  };
})();
