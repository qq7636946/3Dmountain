/* Flow2 · the drop's bead string and its wake on the river (Team SQ, 2026-11-17). index1-5-canyon-forest.html.
   Client chose 「水珠串＋水面航跡」 (a string of water beads + a wake on the water); it replaces the light-strand trail (?trail=beam = the old trail).
   Works with flow2-drop-lead.js (the drop: rises, holds, runs, leads down the canyon, dives at its end) and the host in flow2-seagull.js.

   · BEADS: while the drop runs it sheds small water beads along the exact path it just flew, each smaller than the one before (45 % → 8 % of
     the drop). Each catches the sun in a brief glint, hangs a moment, then slowly falls into the river, leaves a small ring where it lands
     and is gone. More and closer together while it races, a few while it leads slowly; at rest one small bead drips off now and then.
     Moving back, the drop never sheds and re-absorbs the beads it meets (none ever shows in front of it). ≤ 40 live, one instanced draw,
     the drop's lens look in a light version (the canyon picture turned over inside, a fresnel rim, a sharp sparkle).
   · WAKE: behind the drop (which now flies low over the river) a V-shaped wake follows its path round the bends: two bright edge lines at the
     Kelvin angle, curved ripples between them, caustic glints from a baked noise texture, fading with distance and age; small rings where
     beads land; a gentle ring pulsing under the drop at rest; the drop's broken reflection on the water.
   Everything adds light (finite, ≥ 0, the buffer's alpha untouched) and is depth-tested against the scene (the river hides what is under it).
   Nothing exists until the drop moves; the canyon's light and the title hold are kept. Switch: ?trail=beam (the old light trail instead). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  /* 2026-11-17 client 「水滴跑動時候 水要有漣漪」: the RIPPLES (rings + a light V wake) are on by default (?wake=0 = off); the beads only with
     ?trail=beads (their program is not built otherwise). Panel 海鷗・LOGO 參數 (E), group 水滴漣漪: window.__FLOW2_WAKE__.tune. */
  const BEADS = Q.get('trail') === 'beads', WAKE = Q.get('wake') !== '0' || BEADS;
  if (!WAKE || Q.get('drop') === '0' || Q.get('beam') === '0') return;
  const T = {
    maxBeads: 40, sizeFrom: .55, sizeTo: .12, sizeStep: .86,   // bead size as a share of the drop, shrinking along the string
    spacingFast: 1.3, spacingSlow: 3.4, fastSpeed: 40,         // metres between beads at speed / slow; m/s counted as "fast"
    hang: .28, gravity: 5.5, life: 4.5,                        // s a bead hangs, m/s² it falls with, s at most
    drip: 2.8,                                                 // s between drips at rest
    wakeMax: 42, wakeAngle: Math.tan(19.5 * Math.PI / 180),    // metres of wake at speed; the Kelvin half-angle
    ringLife: 2.2, restRing: 1.6,                              // s a ring lives; s between the calm rings under the drop at rest
    /* the ripple dials (panel 水滴漣漪; defaults = the look shown to the client) */
    gain: 1, ringSize: 1, ringCount: 3, ringSpacing: 3.5, fade: 1, glint: 1
  };
  const layer = { name: 'beads', order: .5, tune: T };
  window.__FLOW2_WAKE__ = layer;
  (window.__FLOW2_SEAGULL_LAYERS__ ||= []).push(layer);
  const clamp01 = x => Math.min(1, Math.max(0, x)), smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  let THREE, beads, rings, wake, refl, U, RU, WU, FU, pathTex, pathData, M = 96, NS = 90;
  const pool = [], ringPool = [], hist = [];
  layer.init = ctx => {
    THREE = ctx.THREE;
    const ADD = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
    /* baked: noise for the caustic glints (two octaves, tileable) and a soft blob */
    const NW = 64, nd = new Uint8Array(NW * NW * 4), h1 = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
    const lat = (g, x, y) => h1(((x % g) + g) % g * 57 + ((y % g) + g) % g * 131 + g * 7);
    const vn = (g, x, y) => { const fx = x * g / NW, fy = y * g / NW, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      return (lat(g, ix, iy) * (1 - sx) + lat(g, ix + 1, iy) * sx) * (1 - sy) + (lat(g, ix, iy + 1) * (1 - sx) + lat(g, ix + 1, iy + 1) * sx) * sy; };
    for (let y = 0; y < NW; y++) for (let x = 0; x < NW; x++) { const k = (y * NW + x) * 4; nd[k] = Math.round(vn(8, x, y) * 255); nd[k + 1] = Math.round(vn(16, x, y) * 255); nd[k + 2] = 0; nd[k + 3] = 255; }
    const noise = new THREE.DataTexture(nd, NW, NW, THREE.RGBAFormat); noise.wrapS = noise.wrapT = THREE.RepeatWrapping; noise.magFilter = THREE.LinearFilter; noise.minFilter = THREE.LinearMipmapLinearFilter; noise.generateMipmaps = true; noise.needsUpdate = true;

    /* BEADS: one instanced draw, a light version of the drop's lens (built only with ?trail=beads) */
    if (BEADS) {
    const bg = new THREE.SphereGeometry(1, 20, 14);
    bg.setAttribute('aBead', new THREE.InstancedBufferAttribute(new Float32Array(T.maxBeads * 2), 2));
    U = { tScene: { value: null }, uHasScene: { value: 0 }, uScreen: { value: new THREE.Vector2(1, 1) }, uSky: { value: new THREE.Color(.6, .7, .85) }, uSun: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color(1, 1, 1) }, uViewToWorld: { value: new THREE.Matrix3() }, uLensPx: { value: 1 } };
    beads = new THREE.InstancedMesh(bg, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthTest: true, depthWrite: false, toneMapped: false, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: /* glsl */`attribute vec2 aBead; varying vec3 vN; varying vec3 vV; varying vec2 vB; varying float vR;
void main(){ vec4 w = instanceMatrix * vec4(position, 1.0); vec4 mv = viewMatrix * modelMatrix * w; vV = mv.xyz;
  vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * normal); vB = aBead;
  vR = length(instanceMatrix[0].xyz) / max(0.5, -mv.z);   /* the bead's size on the screen (radius / depth) */
  gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`precision highp float;
uniform sampler2D tScene; uniform float uHasScene, uLensPx; uniform vec2 uScreen; uniform vec3 uSky, uSun, uSunCol; uniform mat3 uViewToWorld;
varying vec3 vN; varying vec3 vV; varying vec2 vB; varying float vR;
void main(){
  vec3 N = normalize(vN); float lv = length(vV); vec3 eye = lv > 1e-5 ? vV / lv : vec3(0.0, 0.0, -1.0);
  float ndv = clamp(dot(-eye, N), 0.0, 1.0), F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  /* a small ball lens: the picture behind it turned over (an offset against the normal, about twice its size) */
  vec2 uv = gl_FragCoord.xy / uScreen, off = -N.xy * vR * uLensPx * 1.8;
  vec3 thru = uHasScene > 0.5 ? vec3(texture2D(tScene, clamp(uv + off * 0.97, 0.002, 0.998)).r, texture2D(tScene, clamp(uv + off, 0.002, 0.998)).g, texture2D(tScene, clamp(uv + off * 1.03, 0.002, 0.998)).b) : uSky;
  float band = 1.0 - 0.4 * exp(-pow((ndv - 0.3) / 0.12, 2.0));
  vec3 rw = normalize(uViewToWorld * reflect(eye, N) + vec3(1e-6));
  float spec = pow(max(dot(rw, uSun), 0.0), 160.0) * 2.0 + pow(max(dot(rw, vec3(0.0, 1.0, 0.0)), 0.0), 160.0);
  vec3 col = mix(max(thru, vec3(0.0)) * 1.08 * band, uSky * 1.2, F) + uSunCol * spec * (1.0 + 4.0 * vB.x) + vec3(0.9, 0.95, 1.0) * vB.x * pow(ndv, 3.0) * 1.5;
  float a = clamp(vB.y, 0.0, 1.0);
  gl_FragColor = vec4(clamp(col, 0.0, 24.0) * a, a);
}`
    }), T.maxBeads);
    beads.frustumCulled = false; beads.renderOrder = 21; beads.count = 0; beads.visible = false; ctx.sceneA.add(beads);
    for (let i = 0; i < T.maxBeads; i++) pool.push({ alive: false });
    }

    /* RINGS on the water: where beads land, and the gentle pulse under the drop at rest */
    const rg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    rg.setAttribute('aRing', new THREE.InstancedBufferAttribute(new Float32Array(T.maxBeads * 2), 2));
    RU = { uNoise: { value: noise }, uGain: { value: 1 }, uK: { value: T.ringCount }, uGlint: { value: 1 }, uTitle: { value: new THREE.Vector4(-1, -1, -1, -1) } };
    rings = new THREE.InstancedMesh(rg, new THREE.ShaderMaterial({
      uniforms: RU, transparent: true, ...ADD, depthTest: true, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: 'attribute vec2 aRing; varying vec2 vP; varying vec2 vR; varying vec2 vW; void main(){ vP = position.xz * 2.0; vR = aRing; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      /* soft ripples, not drawn circles: a train of low waves travels out from the centre; only their light-catching crests show, broken
         up by the water's own texture, inside a broad soft band that widens and fades as it spreads */
      fragmentShader: /* glsl */`precision highp float; uniform sampler2D uNoise; uniform float uGain, uK, uGlint; uniform vec4 uTitle; varying vec2 vP; varying vec2 vR; varying vec2 vW;
float titleHold(){ vec2 q = gl_FragCoord.xy; vec2 d = max(uTitle.xy - q, q - uTitle.zw); return uTitle.z < 0.0 ? 1.0 : mix(0.25, 1.0, smoothstep(-6.0, 30.0, max(d.x, d.y))); }
void main(){ float r = length(vP), t = clamp(vR.x, 0.0, 1.0), front = 0.1 + 0.85 * pow(t, 0.55);
  float band = exp(-pow((r - front * 0.72) / (0.22 + 0.25 * t), 2.0)) * (1.0 - smoothstep(0.82, 1.0, r));
  float crest = pow(max(sin((r - front) * uK * 6.2831853), 0.0), 3.0);
  float n = texture2D(uNoise, vW * 0.55).r, n2 = texture2D(uNoise, vW * 1.7 + 0.37).g;
  float broken = 0.25 + 0.75 * smoothstep(0.3, 0.72, n);
  float glint = pow(clamp(n * n2 * 2.2, 0.0, 1.0), 5.0) * 4.0 * uGlint;
  float a = (crest * broken * 2.2 + crest * glint * 1.6 + 0.3) * band * (1.0 - t) * (1.0 - t) * clamp(vR.y, 0.0, 2.0) * uGain * titleHold();   /* seen at a grazing angle from 30–40 m: bright enough to read */
  gl_FragColor = vec4(clamp(vec3(0.78, 0.88, 1.0) * a, 0.0, 8.0), 0.0); }`
    }), T.maxBeads);
    rings.frustumCulled = false; rings.renderOrder = 18; rings.count = 0; rings.visible = false; ctx.sceneA.add(rings);
    for (let i = 0; i < T.maxBeads; i++) ringPool.push({ alive: false });

    /* WAKE: a strip on the river along the drop's recent path, V-shaped */
    pathData = new Float32Array(M * 4);
    pathTex = new THREE.DataTexture(pathData, M, 1, THREE.RGBAFormat, THREE.FloatType); pathTex.minFilter = pathTex.magFilter = THREE.NearestFilter; pathTex.needsUpdate = true;
    const wp = new Float32Array(NS * 2 * 3), wi = [];
    for (let i = 0; i < NS; i++) for (let j = 0; j < 2; j++) { const k = (i * 2 + j) * 3; wp[k] = j * 2 - 1; wp[k + 1] = 0; wp[k + 2] = i / (NS - 1); }
    for (let i = 0; i < NS - 1; i++) { const a = i * 2; wi.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(wp, 3)); wg.setIndex(wi);
    WU = { uTitle: RU.uTitle, uGain: RU.uGain, uGlint: RU.uGlint, uPath: { value: pathTex }, uN: { value: M }, uLen: { value: 0 }, uAmt: { value: 0 }, uTan: { value: T.wakeAngle }, uTime: { value: 0 }, uNoise: { value: noise }, uWater: { value: .045 } };
    wake = new THREE.Mesh(wg, new THREE.ShaderMaterial({
      uniforms: WU, transparent: true, ...ADD, depthTest: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: /* glsl */`uniform sampler2D uPath; uniform float uN, uLen, uTan, uWater; varying float vD; varying float vLat; varying float vHalf; varying vec2 vXZ;
vec4 path(float d){ float x = clamp(d / max(uLen, 1e-3), 0.0, 1.0) * (uN - 1.0); float i = floor(x), f = x - i;
  return mix(texture2D(uPath, vec2((i + 0.5) / uN, 0.5)), texture2D(uPath, vec2((min(i + 1.0, uN - 1.0) + 0.5) / uN, 0.5)), f); }
void main(){
  float d = position.z * uLen; vec4 p = path(d); vec2 t = p.zw; float tl = length(t); t = tl > 1e-4 ? t / tl : vec2(0.0, 1.0);
  vec2 n = vec2(-t.y, t.x); float hw = 0.35 + d * uTan;
  vec2 xz = p.xy + n * position.x * hw * 1.15;
  vD = d; vLat = position.x * hw * 1.15; vHalf = hw; vXZ = xz;
  gl_Position = projectionMatrix * viewMatrix * vec4(xz.x, uWater, xz.y, 1.0);
}`,
      fragmentShader: /* glsl */`precision highp float; uniform float uLen, uAmt, uTime, uGain, uGlint; uniform sampler2D uNoise; uniform vec4 uTitle; varying float vD; varying float vLat; varying float vHalf; varying vec2 vXZ;
float titleHold(){ vec2 q = gl_FragCoord.xy; vec2 d = max(uTitle.xy - q, q - uTitle.zw); return uTitle.z < 0.0 ? 1.0 : mix(0.25, 1.0, smoothstep(-6.0, 30.0, max(d.x, d.y))); }
void main(){
  float a = abs(vLat), edge = exp(-pow((a - vHalf * 0.9) / (0.35 + vD * 0.03), 2.0));       /* the two soft arms of the V */
  float inside = 1.0 - smoothstep(vHalf * 0.85, vHalf * 1.0, a);
  float crest = pow(0.5 + 0.5 * cos((vD + vLat * vLat * 0.09) * 2.1 - uTime * 2.4), 6.0) * inside * 0.45;   /* curved transverse ripples */
  vec2 n = texture2D(uNoise, vXZ * 0.09 + vec2(0.0, uTime * 0.05)).rg, n2 = texture2D(uNoise, vXZ * 0.23 - vec2(uTime * 0.04, 0.0)).rg;
  float glint = pow(clamp(n.r * n2.g * 1.9, 0.0, 1.0), 6.0) * 5.0 * (edge + inside * 0.4) * uGlint;   /* caustic glints catching the light */
  edge *= 0.3 + 0.7 * smoothstep(0.3, 0.7, n.g);                                              /* broken by the water: no drawn line */
  float age = 1.0 - smoothstep(uLen * 0.35, uLen, vD), head = smoothstep(0.0, 1.2, vD);
  float v = (edge * 1.8 + crest * 1.6 + glint * 2.2) * age * head * uAmt * uGain * titleHold();   /* the chapter title stays readable */
  gl_FragColor = vec4(clamp(vec3(0.72, 0.84, 1.0) * v, 0.0, 8.0), 0.0);
}`
    }));
    wake.frustumCulled = false; wake.renderOrder = 17; wake.visible = false; ctx.sceneA.add(wake);

    /* the drop's broken reflection on the water (where the lens sees it), stretched toward the lens */
    FU = { uNoise: { value: noise }, uTime: { value: 0 }, uAmt: { value: 0 } };
    refl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: FU, transparent: true, ...ADD, depthTest: true, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: 'varying vec2 vP; varying vec2 vW; void main(){ vP = position.xz * 2.0; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */`precision highp float; uniform sampler2D uNoise; uniform float uTime, uAmt; varying vec2 vP; varying vec2 vW;
void main(){ float r = length(vP * vec2(1.0, 0.45)); vec2 n = texture2D(uNoise, vW * vec2(0.5, 0.12) + vec2(0.0, uTime * 0.12)).rg;
  float a = exp(-r * r * 3.0) * (0.35 + 0.65 * smoothstep(0.35, 0.7, n.g)) * uAmt;
  gl_FragColor = vec4(clamp(vec3(0.78, 0.88, 1.0) * a, 0.0, 6.0), 0.0); }`
    }));
    refl.frustumCulled = false; refl.renderOrder = 18; refl.visible = false; if (BEADS) ctx.sceneA.add(refl);   /* otherwise the drop draws its own (flow2-drop-lead.js) */
    Object.assign(V, { m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), dir: new THREE.Vector3(), last: null, sun: new THREE.Vector3() });
  };
  const V = {};
  layer.hide = () => { if (!rings) return; if (beads) beads.visible = false; rings.visible = wake.visible = refl.visible = false; };
  layer.busy = () => ringPool.some(r => r.alive);   /* the last rings (the dive's splash) finish after the drop is gone */
  layer.warmPose = ctx => { if (beads) beads.count = 1; rings.count = 1; WU.uLen.value = 10; WU.uAmt.value = 1; };

  /* the drop's recent path (head first), spaced ≥ 0.6 m; moving back over it eats it from the head */
  function track(pos) {
    if (!hist.length) { hist.push(pos.clone()); return 0; }
    const head = hist[0], moved = Math.hypot(pos.x - head.x, pos.z - head.z);   /* travel over the river (the hover's bob does not count) */
    let forward = 0;
    if (hist.length > 1 && moved > .02) {
      const prev = hist[1], back = V.dir.subVectors(prev, head), bl = back.length();
      if (bl > 1e-4 && V.p.subVectors(pos, head).dot(back) / bl > moved * .5) {   /* moving back along its own path */
        while (hist.length > 2) { const p1 = hist[1], p2 = hist[2]; if ((pos.x - p1.x) * (p2.x - p1.x) + (pos.z - p1.z) * (p2.z - p1.z) > 0) hist.splice(1, 1); else break; }   /* eaten only once passed going back */
        head.copy(pos); return -moved;
      }
    }
    forward = moved; head.copy(pos);
    if (hist.length === 1 || hist[1].distanceTo(head) >= .6) hist.splice(1, 0, head.clone());
    let L = 0; for (let i = 1; i < hist.length; i++) { L += hist[i].distanceTo(hist[i - 1]); if (L > 75) { hist.length = i + 1; break; } }
    return forward;
  }
  function resample(len) {   /* the path on the water, M samples over [0, len] behind the head: x, z, tangent x, z */
    let seg = 0, acc = 0;
    for (let k = 0; k < M; k++) {
      const d = len * k / (M - 1);
      while (seg < hist.length - 2 && acc + hist[seg].distanceTo(hist[seg + 1]) < d) { acc += hist[seg].distanceTo(hist[seg + 1]); seg++; }
      const a = hist[seg], b = hist[Math.min(hist.length - 1, seg + 1)], sl = Math.max(1e-4, a.distanceTo(b)), f = clamp01((d - acc) / sl);
      const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f, tx = (b.x - a.x) / sl, tz = (b.z - a.z) / sl;
      pathData.set([x, z, Number.isFinite(tx) ? tx : 0, Number.isFinite(tz) ? tz : 1], k * 4);
    }
    pathTex.needsUpdate = true;
  }
  let titleAt = 0;
  function titleRect(readBuffer, U) {   /* the chapter title's box in drawing-buffer pixels (origin bottom left), a few times a second */
    const t = performance.now(); if (t - titleAt < 250) return; titleAt = t;
    const panel = document.querySelector('.fi-copy-panel.is-active'); if (!panel) { U.set(-1, -1, -1, -1); return; }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const el of panel.querySelectorAll('.fi-copy-kicker, h1, h2, .fi-copy-zh, p')) { const r = el.getBoundingClientRect(); if (r.width < 2) continue; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
    if (x1 < x0) { U.set(-1, -1, -1, -1); return; }
    const sx = readBuffer.width / innerWidth, sy = readBuffer.height / innerHeight;
    U.set(x0 * sx, (innerHeight - y1) * sy, x1 * sx, (innerHeight - y0) * sy);
  }
  const histLen = () => { let L = 0; for (let i = 1; i < hist.length; i++) L += hist[i].distanceTo(hist[i - 1]); return L; };

  let lastT = 0, speed = 0, wakeLen = 0, sinceShed = 0, chain = 0, dripAt = 0, restRingAt = 0, lastDive = 0, sinceRing = 0;
  function spawnBead(p, scale, now, vy = 0) {
    let b = pool.find(x => !x.alive); if (!b) { b = pool.reduce((o, x) => (x.born < o.born ? x : o)); }
    Object.assign(b, { alive: true, x: p.x, y: p.y, z: p.z, s: scale, born: now, vy, fall: 0 });
  }
  function spawnRing(x, z, size, now, alpha = 1, keep = false) {
    let r = ringPool.find(o => !o.alive); if (!r) r = ringPool.reduce((o, x) => (x.born < o.born ? x : o));
    Object.assign(r, { alive: true, x, z, size, born: now, alpha, keep });
  }
  function updRings(now, trail) {
    let m = 0; const life = T.ringLife * Math.max(.2, T.fade);
    for (const r of ringPool) {
      if (!r.alive) continue;
      const t = (now - r.born) / (life * (r.keep ? 1.4 : 1)); if (t >= 1) { r.alive = false; continue; }
      V.p.set(r.x, .045, r.z); V.s.set(r.size, 1, r.size); V.m.compose(V.p, V.q.identity(), V.s); rings.setMatrixAt(m, V.m);
      rings.geometry.attributes.aRing.setXY(m, t, r.alpha * (r.keep ? 1 : trail)); m++;
    }
    rings.count = m; rings.visible = m > 0; if (m) { rings.instanceMatrix.needsUpdate = true; rings.geometry.attributes.aRing.needsUpdate = true; }
    return m;
  }

  layer.update = (f, ctx, readBuffer) => {
    const D = ctx.drop, cam = ctx.canyon.camera;
    const now = performance.now() / 1000, dt = Math.min(.1, Math.max(0, now - (lastT || now))); lastT = now;
    RU.uGain.value = Math.max(0, T.gain); RU.uK.value = Math.max(1, T.ringCount); RU.uGlint.value = Math.max(0, T.glint);
    const dive = window.__FLOW2_DROP__?.dive || 0;
    if (D && D.on && dive > .55 && lastDive <= .55) spawnRing(D.pos.x, D.pos.z, (D.radius || 1) * 9 * T.ringSize, now, 1.4, true);   /* the dive: a last splash */
    lastDive = dive;
    if (!D || !D.on) { if (beads) beads.visible = false; wake.visible = refl.visible = false; hist.length = 0; pool.forEach(b => { b.alive = false; }); wakeLen = 0; updRings(now, 1); return; }
    const R = D.radius || 1, moving = D.race > 0;                  /* nothing until the drop runs */
    const fwd = track(D.pos);
    const v = Math.abs(fwd) / Math.max(1e-3, dt); speed += (v - speed) * (1 - Math.exp(-dt / .25));
    const fast = clamp01(speed / T.fastSpeed);
    /* shed beads along the path while it moves forward (never moving back) */
    if (BEADS && moving && fwd > 0) {
      sinceShed += fwd;
      const spacing = T.spacingSlow + (T.spacingFast - T.spacingSlow) * fast;
      if (speed < 3) chain = 0;
      while (sinceShed >= spacing) {
        sinceShed -= spacing;
        const k = Math.min(1, sinceShed / Math.max(.01, fwd));     /* place it back along this frame's movement */
        let back = null; for (let i = 1; i < hist.length; i++) if (hist[i].distanceTo(D.pos) > .3) { back = hist[i]; break; }
        if (back) V.p.copy(D.pos).addScaledVector(V.dir.copy(back).sub(D.pos).normalize(), R * 1.05 + k * fwd); else V.p.copy(D.pos);
        if (!Number.isFinite(V.p.x)) V.p.copy(D.pos);
        spawnBead(V.p, R * Math.max(T.sizeTo, T.sizeFrom * Math.pow(T.sizeStep, chain)), now);
        chain++;
      }
    } else if (fwd < 0) sinceShed = 0;
    /* at rest: now and then one small bead drips off */
    if (BEADS && moving && speed < 2 && D.trail > .5) { if (!dripAt) dripAt = now + T.drip * .5; if (now > dripAt) { V.p.copy(D.pos); V.p.y -= R * .9; spawnBead(V.p, R * .12, now); dripAt = now + T.drip * (.8 + .4 * Math.random()); } } else dripAt = 0;
    /* beads: glint, hang, fall into the river (a ring), or be re-absorbed by the drop */
    let n = 0;
    for (const b of pool) {
      if (!b.alive) continue;
      const age = now - b.born;
      if (age > T.hang) { b.vy -= T.gravity * dt; b.y += b.vy * dt; }
      const near = Math.hypot(b.x - D.pos.x, b.y - D.pos.y, b.z - D.pos.z) < R * 1.25 && age > .2;
      if (b.y <= .03) { spawnRing(b.x, b.z, Math.max(.6, b.s * 9), now); b.alive = false; continue; }
      if (near || age > T.life) { b.alive = false; continue; }
      V.p.set(b.x, b.y, b.z); V.s.setScalar(b.s); V.m.compose(V.p, V.q.identity(), V.s); beads.setMatrixAt(n, V.m);
      const glint = Math.exp(-Math.pow((age - .12) / .1, 2)), fade = smooth(0, .06, age) * (1 - smooth(T.life - .6, T.life, age)) * D.trail;
      beads.geometry.attributes.aBead.setXY(n, glint, fade); n++;
    }
    if (beads) { beads.count = n; beads.visible = n > 0; if (n) { beads.instanceMatrix.needsUpdate = true; beads.geometry.attributes.aBead.needsUpdate = true; } }
    /* ripples under the drop: one ring every ringSpacing metres it travels (stronger with speed); a calm one every restRing s at rest */
    const sz = R * 8 * Math.max(.2, T.ringSize);
    if (moving && fwd > 0 && D.pos.y < 6) { sinceRing += fwd; const sp = Math.max(.8, T.ringSpacing) * (1 + fast); if (sinceRing >= sp) { sinceRing = 0; spawnRing(D.pos.x, D.pos.z, sz * (1 + .6 * fast), now, .7 + .5 * fast); } }
    if (moving && speed < 2 && D.pos.y < 6) { if (!restRingAt || now > restRingAt) { spawnRing(D.pos.x, D.pos.z, sz, now, .5); restRingAt = now + T.restRing; } } else restRingAt = 0;
    const m = updRings(now, D.trail);
    /* the wake: longer with speed, settling away at rest; only while it flies low */
    const low = 1 - smooth(4, 8, D.pos.y);
    const want = moving ? Math.min(T.wakeMax * Math.max(.2, T.fade), 4 + speed * .9) * low : 0;
    wakeLen += (want - wakeLen) * (1 - Math.exp(-dt / (want > wakeLen ? .3 : 1.8)));
    const L = Math.min(wakeLen, histLen());
    titleRect(readBuffer, WU.uTitle.value);
    WU.uLen.value = L; WU.uAmt.value = clamp01(L / 6) * (.45 + .55 * fast) * D.trail; WU.uTime.value = now % 1000;
    wake.visible = L > .8 && WU.uAmt.value > .01; if (wake.visible) resample(L);
    /* the reflection of the drop on the water (only with the beads; otherwise the drop draws its own) */
    const ch = Math.max(.3, cam.position.y), dh = Math.max(.2, D.pos.y), kk = ch / (ch + dh);
    V.p.set(cam.position.x + (D.pos.x - cam.position.x) * kk, .05, cam.position.z + (D.pos.z - cam.position.z) * kk);
    refl.position.copy(V.p); refl.rotation.y = Math.atan2(cam.position.x - V.p.x, cam.position.z - V.p.z); refl.scale.set(R * 1.3, 1, R * 4.2);
    FU.uAmt.value = .5 * (1 - smooth(3, 10, dh)) * smooth(0, .3, D.race + .3) * D.trail * (D.pos.y > .1 ? 1 : 0); FU.uTime.value = now % 1000; refl.visible = FU.uAmt.value > .01;
    /* the beads' lens: the canyon picture and the light (only with the beads) */
    if (U) {
    const hasScene = readBuffer.samples > 0 && readBuffer.texture;
    U.tScene.value = hasScene ? readBuffer.texture : null; U.uHasScene.value = hasScene ? 1 : 0; U.uScreen.value.set(readBuffer.width, readBuffer.height);
    U.uLensPx.value = 1 / Math.tan(cam.fov * Math.PI / 360) * .5; U.uViewToWorld.value.setFromMatrix4(cam.matrixWorld);
    const scene = ctx.canyon.scene, sun = scene.children.find(o => o.isDirectionalLight && o.castShadow);
    if (sun) { U.uSun.value.copy(sun.position).sub(sun.target.position).normalize(); U.uSunCol.value.copy(sun.color).multiplyScalar(Math.min(4, sun.intensity * .2)); }
    if (scene.fog) U.uSky.value.copy(scene.fog.color).multiplyScalar(1.15);
    }
    ctx.state.beads = { live: n, rings: m, wake: +L.toFixed(1), speed: +speed.toFixed(1), chain };
  };
})();
