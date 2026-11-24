/* falls-plate.js — FALLS-PLATE (2026-11-23; client: 「瀑布還是不夠好太銳利」「全力把瀑布製作到一模一樣」).
   index1-5-canyon-forest-rise-ui.html?fallsPlate=1 only (one guarded line before </head>; without it this file is not even loaded).

   The client's own picture of this exact view (docs/falls/ref/04-target-horseshoe-20261123.webp = the page at 1880x930 cut at (180, 98))
   is projected back onto the world from the client's rest lens, over the waterfall region:
     - assets/plate.webp: the picture's gorge + rim + a margin of plateau (labels and beacon columns removed), feathered alpha, 2x Lanczos;
       assets/regions.png: where the life layers act (R curtain, G pool, B plume, A water before the lip); built by .qa/falls-plate/make-plate.py;
     - proxy geometry: a grid in picture space, each vertex pushed along its projector ray to the falls' own forms (falls-shape: plateau at
       waterY outside the rim, the rim wall where the ray meets it, the pool at poolY), depth smoothed so nothing tears when the lens sways;
       the plate is projective-textured from the fixed rest lens, so at rest it IS the picture, and sways with the land;
     - depth: written as a flat card a little above the plateau (only where the plate is solid), so the land and the river lines under it are
       covered, while beacons, birds and clouds above it stay in front;
     - life: two-phase flow of the picture down the curtain + soft falling streaks; a slow breathing, warped plume; foam shimmer drifting out
       across the pool; riffles on the water before the lip. All soft.
   The live 3D falls (rock, water, mist: view.falls.group) are hidden while the plate is fully on, and come back (cross-fade) whenever the lens
   leaves the rest pose: the arrival turn, the pool dive (atlas.zoom / __FLOW2_LAKE_DIVE__), a different framing (phones), ?after=lines.
   Switches: ?fallsPlate=1 · ?fallsPlateLife=0 (still picture) · ?panel=1 → panel 「瀑布照片投影」 · window.__FALLS_PLATE__ = { state, tune, setOn(v) }. */
import * as THREE from 'three';

const Q = new URLSearchParams(location.search);
const state = { stage: 'off', errors: [], k: 0, pose: 0, dev: 0, dive: 0, liveHidden: false, tris: 0, buildMs: 0 };
const api = window.__FALLS_PLATE__ = { state };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tune = { on: true, life: Q.get('fallsPlateLife') === '0' ? 0 : 1, curtain: 1, streaks: 1, mist: 1, pool: 1, band: 1, speed: 1, soft: .35,
  poseIn: 4.2, poseOut: 9, fade: .45, hideLive: true, pull: 1.0 };
api.tune = tune;

const waitFor = (fn, ms) => new Promise((res, rej) => { const t0 = performance.now(); const tick = () => { let v = null; try { v = fn(); } catch (e) { } if (v) return res(v); if (performance.now() - t0 > ms) return rej(new Error('timeout')); setTimeout(tick, 200); }; tick(); });
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/* a tileable noise picture (256^2): R, G one octave each (lattice 32), B two octaves, A four octaves */
function noiseTexture() {
  const N = 256, d = new Uint8Array(N * N * 4);
  const hash = (x, y, p, s) => { x = ((x % p) + p) % p; y = ((y % p) + p) % p; let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(p, 982451653) + Math.imul(s, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vn = (x, y, p, s) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (hash(i, j, p, s) * (1 - u) + hash(i + 1, j, p, s) * u) * (1 - v) + (hash(i, j + 1, p, s) * (1 - u) + hash(i + 1, j + 1, p, s) * u) * v; };
  const fbm = (x, y, ps, s) => { let a = .55, t = 0, sum = 0; for (const p of ps) { sum += a * vn(x / N * p, y / N * p, p, s); t += a; a *= .5; } return sum / t; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = (y * N + x) * 4;
    d[k] = Math.round(255 * vn(x / N * 32, y / N * 32, 32, 1)); d[k + 1] = Math.round(255 * vn(x / N * 32, y / N * 32, 32, 2));
    d[k + 2] = Math.round(255 * fbm(x, y, [16, 32], 3)); d[k + 3] = Math.round(255 * fbm(x, y, [8, 16, 32, 64], 4)); }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.UnsignedByteType); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
const loadTex = url => new Promise((res, rej) => new THREE.TextureLoader().load(url, t => res(t), undefined, () => rej(new Error('could not load ' + url))));

const VS = /* glsl */`
attribute vec3 aCard;
uniform mat4 uProjPV;
varying vec4 vProj;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vProj = uProjPV * w;
  vec4 c = projectionMatrix * viewMatrix * w;
  vec4 k = projectionMatrix * viewMatrix * modelMatrix * vec4(aCard, 1.0);
  c.z = clamp(k.z / k.w, -1.0, 1.0) * c.w;     /* depth of a flat card just above the plateau: covers the land, stays behind what stands up */
  gl_Position = c;
}`;
const COMMON = /* glsl */`
uniform sampler2D tPlate, tReg, tNoise;
uniform vec4 uRect;      /* plate rect in picture px: x0, y0, 1/w, 1/h */
uniform vec4 uPage;      /* projector page px w, h; picture offset x, y */
uniform float uOpacity;
varying vec4 vProj;
vec2 pictPx(){ vec2 ndc = vProj.xy / vProj.w; return vec2((ndc.x * .5 + .5) * uPage.x - uPage.z, (.5 - ndc.y * .5) * uPage.y - uPage.w); }
`;
const FS = /* glsl */`${COMMON}
uniform float uTime, uSoft;
uniform vec4 uLife;      /* curtain, mist, pool, band */
uniform vec2 uLife2;     /* streaks, speed */
uniform vec2 uFan;       /* picture px the pool's foam fans out from (behind the far curtain) */
uniform vec2 uCal;       /* x > 0.5: write the flat value y (calibration captures only) */
/* noise read in picture px: feature size (px) and velocity (px / s); one lattice cell of the noise = 1/32 of the texture */
float N(vec2 p, vec2 feat, vec2 vel, float t){ return texture2D(tNoise, (p - vel * t) / (feat * 32.0)).r; }
float Ng(vec2 p, vec2 feat, vec2 vel, float t){ return texture2D(tNoise, (p - vel * t) / (feat * 32.0)).g; }
vec4 Nall(vec2 p, vec2 feat, vec2 vel, float t){ return texture2D(tNoise, (p - vel * t) / (feat * 32.0)); }
void main(){
  vec2 pict = pictPx();
  vec2 uv = (pict - uRect.xy) * uRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
  float a = texture2D(tPlate, uv).a * uOpacity;
  if (a < 0.002) discard;
  vec4 R = texture2D(tReg, uv) * vec4(uLife.x, uLife.z, uLife.y, uLife.w);   /* curtain, pool, plume, band */
  float t = uTime * uLife2.y;
  vec2 px = uRect.zw;
  /* the curtain: each column falls at its own pace (a slow per-column speed), two phases half a cycle apart, cross-faded */
  float colSpeed = 0.75 + 0.5 * N(vec2(pict.x, 0.0), vec2(9.0, 1000.0), vec2(0.0), 0.0);
  vec2 fan = normalize(pict - uFan + vec2(0.0, 1e-3));
  float ph0 = fract(t * 1.35), ph1 = fract(t * 1.35 + 0.5);
  float w0 = 1.0 - abs(2.0 * ph0 - 1.0);
  vec2 flow = vec2(0.0, 18.0 * colSpeed) * R.r + fan * 5.0 * R.g + vec2(0.0, 5.0) * R.a;
  /* the plume: a slow churn (warp), breathing */
  vec4 m1 = Nall(pict, vec2(24.0, 16.0), vec2(3.0, -5.0), t);
  vec2 warp = (m1.gb - 0.5) * 8.0 * R.b;
  vec2 u0 = uv + (warp - flow * (ph0 - 0.5)) * px, u1 = uv + (warp - flow * (ph1 - 0.5)) * px;
  vec3 col = texture2D(tPlate, u0, uSoft).rgb * w0 + texture2D(tPlate, u1, uSoft).rgb * (1.0 - w0);
  float lum = sqrt(max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.0));   /* ~ display brightness (col is linear light) */
  /* curtain: soft falling streaks (white water slides down) + slow pulses of brightness running down */
  float s = N(pict, vec2(2.6, 42.0), vec2(0.0, 46.0 * colSpeed), t);
  float s2 = Ng(pict + vec2(37.0, 11.0), vec2(1.8, 26.0), vec2(0.0, 62.0 * colSpeed), t);
  float streak = smoothstep(0.58, 0.9, s) * 0.7 + smoothstep(0.62, 0.95, s2) * 0.5;
  col += vec3(0.76, 0.89, 0.93) * streak * 0.13 * uLife2.x * R.r * (0.35 + 0.65 * smoothstep(0.3, 0.75, lum));
  float pulse = N(pict, vec2(34.0, 22.0), vec2(0.0, 40.0), t);
  col *= 1.0 + R.r * 0.09 * (pulse - 0.5);
  /* plume: billows rising and rolling, and a slow breath */
  float bil = Nall(pict, vec2(20.0, 13.0), vec2(4.0, -7.0), t).a * 0.6 + Nall(pict + vec2(91.0, 7.0), vec2(9.0, 6.0), vec2(-3.0, -10.0), t).a * 0.4;
  float breath = 0.5 + 0.5 * sin(uTime * 0.55 + pict.x * 0.011 - pict.y * 0.004);
  col = mix(col, vec3(0.79, 0.87, 0.89), R.b * (0.07 + 0.09 * breath) * smoothstep(0.42, 0.78, bil));
  col *= 1.0 + R.b * 0.04 * (breath - 0.5);
  /* pool: foam shimmer drifting out from the falls */
  float sh = N(pict, vec2(3.2, 2.2), fan * 9.0, t);
  float foam = smoothstep(0.4, 0.78, lum);
  col *= 1.0 + R.g * (sh - 0.5) * 0.2 * (0.35 + foam);
  /* the water before the lip: riffles moving to the edge */
  float rp = Ng(pict, vec2(5.0, 1.8), vec2(0.0, 9.0), t);
  col *= 1.0 + R.a * (rp - 0.5) * 0.16;
  if (uCal.x > 0.5) col = vec3(uCal.y);
  gl_FragColor = vec4(col, a);
}`;
const FS_DEPTH = /* glsl */`${COMMON}
void main(){
  vec2 uv = (pictPx() - uRect.xy) * uRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
  if (texture2D(tPlate, uv).a * uOpacity < 0.6) discard;
  gl_FragColor = vec4(0.0);
}`;

async function start() {
  state.stage = 'waiting for the view';
  const A = await waitFor(() => { const a = window.__FLOW2_FOREST_ATLAS__; return a && a.state && a.state.ready && a.studio ? a : null; }, 240000);
  const V = A.studio, atlas = A.scene, falls = V.falls;
  if (!falls || !falls.shape) { state.stage = 'no falls on this page (?falls=0): plate off'; return; }
  const scene = atlas.scene || V.studio.skyDome.parent;
  const base = new URL('./assets/', import.meta.url);
  const meta = await fetch(new URL('plate.json', base), { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('plate.json ' + r.status); return r.json(); });
  const ver = '?v=' + encodeURIComponent(meta.at || '1');
  const [plateTex, regTex] = await Promise.all([loadTex(new URL('plate.webp' + ver, base).href), loadTex(new URL('regions.png' + ver, base).href)]);
  for (const t of [plateTex, regTex]) { t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; }
  /* the picture is display values; the view's draw ends in an sRGB encode (measured: a flat 0.5 written here reaches the screen as 188/255,
     no tone curve on this material): sampled as sRGB, the picture comes back on screen as itself (.qa/falls-plate/cal.py) */
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.anisotropy = 4;

  /* ---- the projector: the client's rest lens (page 1880x930, read from the page at rest, mouse centred) */
  const P = meta.projector, PW = P.page[0], PH = P.page[1], OX = P.offset[0], OY = P.offset[1];
  const view = new THREE.Matrix4().fromArray(P.vi), proj = new THREE.Matrix4().fromArray(P.pr);
  const PV = proj.clone().multiply(view), inv = PV.clone().invert();
  const camWorld = view.clone().invert(), origin = new THREE.Vector3().setFromMatrixPosition(camWorld);
  const fwd = new THREE.Vector3(0, 0, -1).transformDirection(camWorld);

  /* ---- proxy geometry (picture-space grid pushed onto the falls' forms) */
  const t0 = performance.now();
  const S = falls.shape, WY = S.waterY, PY = S.poolY;
  const sdF = (S.fn && typeof S.fn.gorgeSd === 'function') ? S.fn.gorgeSd : (() => { const o = S.outline, n = o.length; return (x, z) => { let d = 1e9, inside = false; for (let i = 0, j = n - 1; i < n; j = i++) { const [xi, zi] = o[i], [xj, zj] = o[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; const ex = xi - xj, ez = zi - zj, l = ex * ex + ez * ez || 1, k = clamp(((x - xj) * ex + (z - zj) * ez) / l); d = Math.min(d, Math.hypot(x - xj - ex * k, z - zj - ez * k)); } return inside ? -d : d; }; })();
  const [X0, Y0, X1, Y1] = meta.rect, STEP = 4, nx = Math.ceil((X1 - X0) / STEP) + 1, ny = Math.ceil((Y1 - Y0) / STEP) + 1;
  const T = new Float32Array(nx * ny), TC = new Float32Array(nx * ny), dirs = new Float32Array(nx * ny * 3), q = new THREE.Vector3();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const px = Math.min(X0 + i * STEP, X1), py = Math.min(Y0 + j * STEP, Y1);
    q.set((px + OX) / PW * 2 - 1, 1 - (py + OY) / PH * 2, 1).applyMatrix4(inv).sub(origin).normalize();
    const k = j * nx + i; dirs[k * 3] = q.x; dirs[k * 3 + 1] = q.y; dirs[k * 3 + 2] = q.z;
    const at = y => (y - origin.y) / q.y, X = t => origin.x + q.x * t, Z = t => origin.z + q.z * t;
    const t1 = at(WY); let t = t1;
    if (q.y < -1e-4 && sdF(X(t1), Z(t1)) < 0) {
      const t2 = at(PY);
      if (sdF(X(t2), Z(t2)) <= 0) t = t2;
      else { let a = t1, b = t2; for (let s = 0; s < 18; s++) { const m = (a + b) / 2; if (sdF(X(m), Z(m)) < 0) a = m; else b = m; } t = (a + b) / 2; }
    }
    T[k] = q.y < -1e-4 ? t : t1; TC[k] = t1;
  }
  /* smooth the depth (no tearing at the near rim when the lens sways): two box passes of radius 3 cells */
  const blur = (src, r) => { const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let s = 0, c = 0; for (let d = -r; d <= r; d++) { const ii = i + d; if (ii < 0 || ii >= nx) continue; s += src[j * nx + ii]; c++; } tmp[j * nx + i] = s / c; }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let s = 0, c = 0; for (let d = -r; d <= r; d++) { const jj = j + d; if (jj < 0 || jj >= ny) continue; s += tmp[jj * nx + i]; c++; } out[j * nx + i] = s / c; }
    return out; };
  const Ts = blur(blur(T, 3), 3);
  const pos = new Float32Array(nx * ny * 3), card = new Float32Array(nx * ny * 3);
  const writeCard = pull => { for (let k = 0; k < nx * ny; k++) { const tc = TC[k] - pull; for (let c = 0; c < 3; c++) card[k * 3 + c] = origin.getComponent(c) + dirs[k * 3 + c] * tc; } };
  for (let k = 0; k < nx * ny; k++) for (let c = 0; c < 3; c++) pos[k * 3 + c] = origin.getComponent(c) + dirs[k * 3 + c] * Ts[k];
  writeCard(tune.pull);
  const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
  for (let j = 0, k = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const cardAttr = new THREE.BufferAttribute(card, 3); geo.setAttribute('aCard', cardAttr);
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  state.tris = idx.length / 3; state.grid = [nx, ny]; state.buildMs = Math.round(performance.now() - t0);

  const U = { tPlate: { value: plateTex }, tReg: { value: regTex }, tNoise: { value: noiseTexture() },
    uRect: { value: new THREE.Vector4(X0, Y0, 1 / (X1 - X0), 1 / (Y1 - Y0)) }, uPage: { value: new THREE.Vector4(PW, PH, OX, OY) },
    uProjPV: { value: PV }, uOpacity: { value: 0 }, uTime: { value: 0 }, uSoft: { value: tune.soft },
    uLife: { value: new THREE.Vector4(1, 1, 1, 1) }, uLife2: { value: new THREE.Vector2(1, 1) }, uFan: { value: new THREE.Vector2(meta.fan ? meta.fan[0] : 830, meta.fan ? meta.fan[1] : 230) }, uCal: { value: new THREE.Vector2(0, 0) } };
  api.uniforms = U;
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const depthMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS_DEPTH, transparent: true, depthTest: true, depthWrite: true, colorWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const plate = new THREE.Mesh(geo, mat), plateDepth = new THREE.Mesh(geo, depthMat);
  plate.name = 'FALLS-PLATE picture'; plateDepth.name = 'FALLS-PLATE depth card';
  plate.frustumCulled = plateDepth.frustumCulled = false;
  /* among the see-through layers: after the land, the rock / pool (opaque) and the live curtain (4); before the old lake's flow (8), the river beams (9), beacons (15), the falls' mist (18, 19), birds (50) and the cloud banks (58) */
  plate.renderOrder = meta.renderOrder ?? 6; plateDepth.renderOrder = plate.renderOrder + .5;
  plate.visible = plateDepth.visible = false;
  const group = new THREE.Group(); group.name = 'FALLS-PLATE'; group.add(plate, plateDepth); scene.add(group);
  api.group = group; api.material = mat;

  /* ---- per frame, after the view placed its lens */
  const cam = atlas.camera, cf = new THREE.Vector3();
  let k = 0, last = performance.now(), clock = 0;
  const apply = () => {
    U.uSoft.value = +tune.soft || 0;
    const L = REDUCED ? 0 : +tune.life || 0;
    U.uLife.value.set(L * tune.curtain, L * tune.mist, L * tune.pool, L * tune.band); U.uLife2.value.set(+tune.streaks || 0, Math.max(0, +tune.speed || 0));
    if (Math.abs((+tune.pull || 0) - (cardAttr.__pull ?? -1)) > 1e-4) { writeCard(+tune.pull || 0); cardAttr.__pull = +tune.pull || 0; cardAttr.needsUpdate = true; }
  };
  apply();
  const frame = () => {
    const now = performance.now(), dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now; clock += dt;
    cam.getWorldDirection(cf);
    const ang = Math.acos(clamp(cf.dot(fwd), -1, 1)) * 180 / Math.PI, off = cam.position.distanceTo(origin) / Math.max(1, origin.length()) * 180 / Math.PI;
    const dev = Math.max(ang, off), pose = 1 - sstep(+tune.poseIn, Math.max(+tune.poseIn + .1, +tune.poseOut), dev);
    const D = window.__FLOW2_LAKE_DIVE__, dive = Math.max(+(atlas.zoom || 0), +(D && D.state && D.state.t) || 0);
    const lattice = atlas.uniforms?.uLattice?.value > .35;
    const want = tune.on && !lattice ? pose * (1 - sstep(0, .05, dive)) : 0;
    /* in quickly when the lens settles, out at once when it leaves (the pose term already moves with the lens) */
    k = want < k ? want : k + (want - k) * (1 - Math.exp(-dt / Math.max(.05, +tune.fade)));
    if (want === 1 && k > .995) k = 1;
    const show = k > .002;
    plate.visible = show; plateDepth.visible = show && k > .985;
    U.uOpacity.value = k; U.uTime.value = clock;
    const hide = !!tune.hideLive && k >= .999;
    if (falls.group.visible === hide) falls.group.visible = !hide;
    state.k = +k.toFixed(3); state.pose = +pose.toFixed(3); state.dev = +dev.toFixed(2); state.dive = +dive.toFixed(3); state.liveHidden = hide;
  };
  const update = V.update;
  V.update = function () { const r = update.apply(this, arguments); try { frame(); } catch (e) { if (state.errors.length < 5) state.errors.push(String(e.message || e)); } return r; };

  /* compile ahead (no hitch when it first shows); a failure = the live falls stay */
  const renderer = window.__MONTIS_STUDY__?.renderer;
  if (renderer) { try { plate.visible = plateDepth.visible = true; const c = new THREE.PerspectiveCamera();
      if (renderer.compileAsync) await renderer.compileAsync(group, c, scene); else renderer.compile(group, c, scene);
      for (const mm of [mat, depthMat]) { const pr = renderer.properties.get(mm).currentProgram; if (pr) { pr.getUniforms(); if (pr.diagnostics && pr.diagnostics.runnable === false) throw new Error('plate program failed'); } }
    } catch (e) { group.removeFromParent(); V.update = update; falls.group.visible = true; throw e; } finally { plate.visible = plateDepth.visible = false; } }

  api.apply = apply;
  api.setOn = v => { tune.on = !!v; return tune.on; };
  state.stage = 'ready'; state.meta = { at: meta.at, rect: meta.rect, shape: S.version };
  window.__FLOW2_PANEL__?.add({ id: 'falls-plate', title: '瀑布照片投影', tune, rows: [
    ['照片投影（關＝即時 3D 瀑布）', 'on', 'checkbox'], ['照片下藏起 3D 瀑布', 'hideLive', 'checkbox'],
    ['— 動態 —'], ['整體動態', 'life', 0, 2, .01], ['水幕流動', 'curtain', 0, 2, .01], ['水幕細流光', 'streaks', 0, 3, .01], ['水霧呼吸', 'mist', 0, 2, .01], ['潭面泡沫', 'pool', 0, 2, .01], ['瀑頂水面', 'band', 0, 2, .01], ['速度', 'speed', 0, 3, .01],
    ['— 柔和 / 進出 —'], ['柔化（mip bias）', 'soft', 0, 2, .01], ['開始淡出（偏離度）', 'poseIn', .5, 15, .1], ['完全淡出（偏離度）', 'poseOut', 1, 30, .1], ['淡入秒數', 'fade', .05, 2, .01], ['深度卡片前移', 'pull', 0, 3, .01]], onChange: apply });
}

if (Q.get('fallsPlate') === '1') start().catch(e => { state.stage = 'failed'; state.errors.push(String(e && e.message || e)); console.warn('[falls-plate] left out, the live falls stay:', e); });
