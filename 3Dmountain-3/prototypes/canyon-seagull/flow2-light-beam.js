/* Flow2 · the first-person light beam in the canyon (Team SG, 2026-11-17). index1-5-canyon-forest.html.
   Client: 「這種第一人稱光束要加強在山道跟著海鷗 我很喜歡這部分 所以幫我認真看一下，index-orbit-canyon.html這裡也有做出來」, then (the
   close gull removed) the beam flies on its own ahead of the lens; 「要幫我注意效能喔 能用貼圖就全部用貼圖」.
   The client's own beam from index-orbit-canyon.html (prototypes/orbit/beam.js; recipe docs/everswap-ref/SPEC.md §3) at the canyon's scale:
   · thin additive tubes winding round one path along the river (instanced): one core + strands spiralling with noisy radius, each at its own
     speed and direction, blue-white, lit on their upper and lower edges (ribbons); only the stretch behind the head shows, fading at both
     ends. The head runs ahead of the lens, left of its path and just under the eye, leading the eye down the canyon (journey
     4.885 → 6.30, a pure function of the scroll: back = it withdraws). Its trail never crosses the lens.
   · strength k (1 = the reference recipe: 24 strands; the page default 1.7; up to 2): more strands (to 48, fewer on the medium / low
     quality tiers), a brighter head core, sparks shed behind it, more light on the water and the cliffs, the page's own bloom raised.
   · on the river: the beam's mirror image on the water (where a mirror puts it seen from the lens), broken by moving waves.
   · on the cliffs and the water: a soft glow round the head and the last metres of the trail (from the scene's depth, in its screen box).
   · ?beamDim=0..1 (default 0): the world darkens beyond the head while the beam flies and is lit again where it has passed.
   · over the chapter title the light is held to 40 % (the title stays readable).
   Texture-first: the ribbon's edge profile and its shimmer along each strand, the waves' break-up under the mirror image and the sparks are
   small baked textures (made once at load), not per-pixel noise maths.
   Every layer adds to the colour only (the page's buffer keeps its alpha) and every output is finite and ≥ 0 (2026-11-17 black-speck fix).
   LOOP (client 2026-11-17: 「光束停止時候也要一直loop 光線條少一點」, an explicit exception to "nothing moves by itself", for the beam only):
   the head's place still follows the scroll; inside the ribbon the spiral turns and flows toward the head, light packets run along the
   strands and the sparks twinkle on time, calmly and without a seam, whenever the beam is on screen (the page keeps its full frame rate
   meanwhile: window.__FLOW2_IDLE_HOLD__, set by flow2-seagull.js). A tidy bundle: the core + 12 strands (strength no longer adds strands).
   Switches: ?beam=0 off, ?beam=<k> strength (1..2). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const qb = Q.get('beam'); if (qb === '0') return;
  if (Q.get('trail') !== 'beam') return;   /* 2026-11-17: the client chose the bead string + wake (flow2-bead-wake.js); ?trail=beam = this light trail for comparison */
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const T = {
    k: Math.min(2, Math.max(1, Number.isFinite(parseFloat(qb)) ? parseFloat(qb) : 1.7)),
    dim: Math.min(1, Math.max(0, num('beamDim', 0))),
    scale: .05,                 // orbit units → canyon metres (the strands' radii)
    len: 190,                   // metres of trail behind the head
    headBack: 1.5,              // metres the head sits behind the lead point
    spinA: 2 * Math.PI / 40, spinB: 2 * Math.PI / 24,   // turns per metre: long, gentle curves (liquid, not electric)
    gain: num('beamGain', 1.4), refl: num('beamRefl', 1.0), glow: num('beamGlow', 1.0), titleHold: .4,
    activeIn: [.04, .14], activeOut: [.8, 1]
  };
  const layer = { name: 'beam', tune: T };
  (window.__FLOW2_SEAGULL_LAYERS__ ||= []).push(layer);
  window.__FLOW2_BEAM__ = layer;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ---------- baked textures (once) ---------- */
  const clamp01 = x => Math.min(1, Math.max(0, x));
  function bakeTextures(THREE) {
    /* ribbon: x = across the tube (0 centre-facing … 1 edge seen side-on), y = along a strand (shimmer); R = brightness / 3 */
    const RW = 64, RH = 64, rib = new Uint8Array(RW * RH * 4);
    const h1 = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
    for (let y = 0; y < RH; y++) {
      const a = y / RH * 8, i = Math.floor(a), f = a - i, sm = f * f * (3 - 2 * f), nz = h1(i % 8) * (1 - sm) + h1((i + 1) % 8) * sm;
      const yy = y / RH, pulse = Math.pow(.5 + .5 * Math.cos(2 * Math.PI * (yy - .5)), 6);   /* A: one soft light packet per tile, flowing back from the drop */
      for (let x = 0; x < RW; x++) {
        /* a liquid filament: soft contrast (light inside, a brighter rim), water-blue, a faint spectral fringe right at the rim (saharan's spectrum idea) */
        const e = x / (RW - 1), v = (.38 + .62 * e * e) * (.75 + .5 * nz) / 3, hue = clamp01((e - .72) / .28);
        const fr = 1 + .35 * hue * Math.max(0, 1 - Math.abs(hue - .85) * 3), fg = 1 + .2 * hue * Math.max(0, 1 - Math.abs(hue - .55) * 3), fb = 1 + .3 * hue * Math.max(0, 1 - Math.abs(hue - .25) * 3);
        const k = (y * RW + x) * 4; rib[k] = Math.min(255, Math.round(v * .66 * fr * 255)); rib[k + 1] = Math.min(255, Math.round(v * .84 * fg * 255)); rib[k + 2] = Math.min(255, Math.round(v * 1.0 * fb * 255)); rib[k + 3] = Math.round(pulse * 255);
      }
    }
    const ribbon = new THREE.DataTexture(rib, RW, RH, THREE.RGBAFormat); ribbon.wrapT = THREE.RepeatWrapping; ribbon.magFilter = ribbon.minFilter = THREE.LinearFilter; ribbon.needsUpdate = true;
    /* waves: tileable value noise, two octaves in R and G */
    const NW = 128, wav = new Uint8Array(NW * NW * 4), lat = (g, x, y) => { const X = ((x % g) + g) % g, Y = ((y % g) + g) % g; return h1(X * 57 + Y * 131 + g * 7); };
    const vn = (g, x, y) => { const fx = x * g / NW, fy = y * g / NW, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = lat(g, ix, iy), b = lat(g, ix + 1, iy), c = lat(g, ix, iy + 1), d = lat(g, ix + 1, iy + 1); return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy; };
    for (let y = 0; y < NW; y++) for (let x = 0; x < NW; x++) { const k = (y * NW + x) * 4; wav[k] = Math.round((vn(8, x, y) * .6 + vn(16, x, y) * .4) * 255); wav[k + 1] = Math.round((vn(16, x, y) * .5 + vn(32, x, y) * .5) * 255); wav[k + 2] = 0; wav[k + 3] = 255; }
    const waves = new THREE.DataTexture(wav, NW, NW, THREE.RGBAFormat); waves.wrapS = waves.wrapT = THREE.RepeatWrapping; waves.magFilter = THREE.LinearFilter; waves.minFilter = THREE.LinearMipmapLinearFilter; waves.generateMipmaps = true; waves.needsUpdate = true;
    /* the head's glow and the sparks' dot */
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.12, 'rgba(210,225,255,0.85)'); gr.addColorStop(.4, 'rgba(140,165,255,0.22)'); gr.addColorStop(1, 'rgba(120,140,255,0)');
    c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64);
    const dot = new THREE.CanvasTexture(cv); dot.colorSpace = THREE.NoColorSpace;
    /* a crisp spark: a hard bright core with a thin falloff (sparkle, not fog) */
    const sw = 16, spk = new Uint8Array(sw * sw * 4);
    for (let y = 0; y < sw; y++) for (let x = 0; x < sw; x++) { const dx = (x + .5) / sw * 2 - 1, dy = (y + .5) / sw * 2 - 1, r = Math.hypot(dx, dy), v = Math.max(0, 1 - r) ** 3; const k = (y * sw + x) * 4; spk[k] = spk[k + 1] = spk[k + 2] = Math.round(v * 255); spk[k + 3] = 255; }
    const spark = new THREE.DataTexture(spk, sw, sw, THREE.RGBAFormat); spark.magFilter = spark.minFilter = THREE.LinearFilter; spark.needsUpdate = true;
    return { ribbon, waves, dot, spark };
  }

  let THREE, tubes, head, halo, sparks, strip, glow, dim, uni, sp, glowU, dimU, stripU, TRAIL = 4, maxTubes = 48, sparkShare = 1;
  layer.init = ctx => {
    THREE = ctx.THREE; sp = ctx.spline;
    const ADD = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
    const Qt = window.__FLOW2_QUALITY__; maxTubes = Qt?.pick ? Qt.pick(13, 12, 10) : 13;   /* the core + 12 strands (11 / 9 on the lower tiers) */ sparkShare = Qt?.pick ? Qt.pick(1, .6, .35) : 1;
    const tex = bakeTextures(THREE);
    const N = 512, RADIAL = 3, TUBES = 48;   /* ≈ 0.37 m per segment: the twist stays round, no kinks */
    uni = { uSpline: { value: sp.tex }, uSplN: { value: sp.N }, uS0: { value: sp.s0 }, uS1: { value: sp.s1 }, uSHead: { value: 0 }, uLen: { value: T.len }, uActive: { value: 0 }, uWind: { value: 0 },
      uGain: { value: 1 }, uPx: { value: 1 }, uScale: { value: T.scale }, uSpin: { value: new THREE.Vector2(T.spinA, T.spinB) }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uDelta: { value: new THREE.Vector3() }, uFall: { value: 26 }, uMerge: { value: 0 }, uDropR: { value: 0 },
      uRibbon: { value: tex.ribbon }, uWaves: { value: tex.waves }, uDot: { value: tex.dot }, uTitle: { value: new THREE.Vector4(-1, -1, -1, -1) }, uRail: { value: new THREE.Vector4(-1, -1, -1, -1) }, uTitleHold: { value: T.titleHold } };
    const COMMON = /* glsl */`
uniform sampler2D uSpline; uniform float uSplN, uS0, uS1, uSHead, uLen, uActive, uWind, uGain, uPx, uScale, uTime, uFall, uMerge, uDropR; uniform vec2 uSpin; uniform vec3 uCam, uDelta;
/* the path; its last metres bend to where the drop actually is (flow2-drop-lead.js: the drop is the head) */
vec3 sp(float s){ float x = clamp((s - uS0) / (uS1 - uS0), 0.0, 1.0) * (uSplN - 1.0); float i = floor(x); float f = x - i;
  vec3 a = texture2D(uSpline, vec2((i + 0.5) / uSplN, 0.5)).xyz; vec3 b = texture2D(uSpline, vec2((min(i + 1.0, uSplN - 1.0) + 0.5) / uSplN, 0.5)).xyz;
  float w = 1.0 - smoothstep(0.0, uFall, uSHead - s); return mix(a, b, f) + uDelta * w * w * (3.0 - 2.0 * w); }
vec3 snorm(vec3 v, vec3 fb){ float l = length(v); return l > 1e-5 ? v / l : fb; }
vec4 hash42(vec2 p){ vec4 p4 = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }
float n1(float x){ float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(fract(sin(i * 127.1) * 43758.5453), fract(sin((i + 1.0) * 127.1) * 43758.5453), f); }
vec3 strand(float s, float id, vec4 r){
  vec3 p = sp(s); vec3 T = snorm(sp(s + 0.6) - sp(s - 0.6), vec3(1.0, 0.0, 0.0));
  vec3 Nn = snorm(cross(T, vec3(0.0, 1.0, 0.0)), vec3(0.0, 0.0, 1.0)); vec3 B = cross(Nn, T);
  float cs = s - uWind * mix(1.3, 2.3, r.z);                     /* the pattern flows toward the head on time (uWind = seconds while visible) */
  float dir = r.z > 0.3 ? 1.0 : -1.0;                               /* most strands wind the same way: a tidy bundle */
  float spin = cs * mix(uSpin.x, uSpin.y, r.y) * dir + r.x * 6.2831853 + uWind * 0.35 * dir;
  float rad = mix(0.8, 1.2, n1(cs * 0.035 + id * 7.3)) * mix(6.0, 11.0, r.w) * uScale;   /* a calm, close bundle that breathes slowly */
  rad *= mix(1.0, smoothstep(0.0, 14.0, uSHead - s), uMerge);   /* the strands come out of the drop's tail */
  return p + (Nn * cos(spin) + B * sin(spin)) * rad * (id > 0.5 ? 1.0 : 0.25);
}`;
    const TITLE = /* glsl */`
uniform vec4 uTitle, uRail; uniform float uTitleHold;
float holdIn(vec4 b){ vec2 q = gl_FragCoord.xy; vec2 d = max(b.xy - q, q - b.zw); return b.z < 0.0 ? 1.0 : mix(uTitleHold, 1.0, smoothstep(-6.0, 26.0, max(d.x, d.y))); }
float titleHold(){ return min(holdIn(uTitle), holdIn(uRail)); }   /* the chapter title and the left section rail stay readable */`;
    /* tubes (instanced: one draw for every strand) */
    const pos = new Float32Array(N * RADIAL * 3), idx = [];
    for (let d = 0, c = 0; d < N; d++) for (let s = 0; s < RADIAL; s++) { const f = s / RADIAL * Math.PI * 2; pos[c++] = Math.cos(f); pos[c++] = Math.sin(f); pos[c++] = (d + .5) / N; }
    for (let d = 0; d < N - 1; d++) for (let s = 0; s < RADIAL; s++) { const a = d * RADIAL + s, b = d * RADIAL + (s + 1) % RADIAL, c = a + RADIAL, e = b + RADIAL; idx.push(a, b, c, c, b, e); }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    g.setAttribute('instanceId', new THREE.InstancedBufferAttribute(new Float32Array(TUBES).map((_, i) => i), 1));
    g.instanceCount = 24;
    tubes = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, ...ADD, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
      vertexShader: /* glsl */`
attribute float instanceId; varying float vNy; varying float vOp; varying float vAlong; varying float vPulse;
${COMMON}
void main(){
  float m = position.z; float s = uSHead - (1.0 - m) * uLen;
  vec4 r = hash42(vec2(instanceId, 1.5));
  vec3 c = strand(s, instanceId, r); vec3 T = snorm(strand(s + 0.6, instanceId, r) - strand(s - 0.6, instanceId, r), vec3(1.0, 0.0, 0.0));
  vec3 Nn = snorm(cross(T, vec3(0.0, 1.0, 0.0)), vec3(0.0, 0.0, 1.0)); vec3 B = snorm(cross(Nn, T), vec3(0.0, 1.0, 0.0));
  float head = 1.0 - clamp((uSHead - s) / (uLen * 0.45), 0.0, 1.0);
  float radius = (instanceId > 0.5 ? 0.3 + r.x * 0.35 : 0.8) * uScale * mix(0.08, 1.0, pow(head, 1.6));   /* liquid filaments: fuller by the drop, tapering to nothing */
  if (instanceId < 0.5) radius = max(radius, uDropR * 0.5 * (1.0 - smoothstep(0.0, 12.0, uSHead - s)));   /* the drop's body draws out into the trail */
  vec4 mvc = viewMatrix * vec4(c, 1.0);
  float minR = max(-mvc.z * uPx * (instanceId > 0.5 ? 0.6 : 1.0), 1e-5); float thin = clamp(radius / minR, 0.25, 1.0); radius = max(radius, minR);
  vec3 off = Nn * position.x + B * position.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(c + off * radius, 1.0);
  vNy = snorm(mat3(viewMatrix) * off, vec3(0.0)).y;
  vAlong = s * 0.021 + r.z * 3.7;
  vPulse = (s + uWind * mix(5.0, 7.5, r.y)) / 30.0 + r.x;   /* the drop's light flowing back along the filaments */
  vOp = (instanceId > 0.5 ? 0.5 + r.y * 0.35 : 1.3) * (instanceId > 23.5 ? 0.8 : 1.0) * thin;
  vOp *= uActive * smoothstep(1.0, 0.975, m) * smoothstep(1.0 - uActive * 0.9, 1.0, m) * step(uS0, s);
  vOp = clamp(vOp * (instanceId > 0.5 ? smoothstep(3.0, 10.0, -mvc.z) : smoothstep(2.0, 7.0, -mvc.z)), 0.0, 1.0);   /* never a smear across the lens: strands close by fade out */
  /* (2026-11-17 round 7) no longer moved off-screen when invisible: a triangle with one moved corner drew long faint slivers to the frame's
     corner (the "stray strands"); the positions are finite (guarded normalizations), an invisible vertex just carries no light */
}`,
      fragmentShader: /* glsl */`
precision highp float; uniform float uGain; uniform sampler2D uRibbon; varying float vNy; varying float vOp; varying float vAlong; varying float vPulse;
${TITLE}
void main(){ vec3 b = texture2D(uRibbon, vec2(clamp(abs(vNy), 0.0, 1.0), vAlong)).rgb * 3.0 * (0.65 + 0.9 * texture2D(uRibbon, vec2(0.5, vPulse)).a);
  gl_FragColor = vec4(clamp(b * uGain * vOp * titleHold(), 0.0, 32.0), 0.0); }`
    }));
    tubes.frustumCulled = false; tubes.renderOrder = 20; ctx.sceneA.add(tubes);

    /* the head */
    head = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.dot, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      depthWrite: false, depthTest: true, transparent: true, fog: false, toneMapped: false, opacity: 0, color: 0xffffff }));
    head.renderOrder = 21; ctx.sceneA.add(head);
    halo = new THREE.Sprite(head.material.clone()); halo.renderOrder = 21; ctx.sceneA.add(halo);

    /* sparks shed behind the head (fixed along the river: they stay where they were shed); a textured point sprite */
    const SP = 1600, aS = new Float32Array(SP), aR = new Float32Array(SP * 3), p0 = new Float32Array(SP * 3);
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < SP; i++) { aS[i] = sp.s0 + (sp.s1 - sp.s0) * rnd(); aR[i * 3] = rnd(); aR[i * 3 + 1] = rnd(); aR[i * 3 + 2] = rnd(); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p0, 3)); sg.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); sg.setAttribute('aR', new THREE.BufferAttribute(aR, 3));
    sparks = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, ...ADD, depthWrite: false, toneMapped: false, fog: false,
      vertexShader: /* glsl */`
attribute float aS; attribute vec3 aR; varying float vA;
${COMMON}
void main(){
  float age = (uSHead - aS) / 18.0;
  vec3 p = sp(aS);
  float a = aR.x * 6.2831853; vec3 dir = normalize(vec3(cos(a), aR.y * 1.4 - 0.2, sin(a)));
  p += (dir * (4.0 + (10.0 + 30.0 * aR.z) * age) - vec3(0.0, 60.0 * age * age, 0.0)) * uScale;   /* fine mist shed from the trail, settling toward the river */
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float z = -mv.z;
  if (age < 0.0 || age > 1.0 || z < 1.0 || uActive <= 0.0) { vA = 0.0; gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   /* not shed yet / gone / behind the lens */
  float tw = 0.7 + 0.3 * sin(uWind * (1.2 + aR.z * 1.8) + aR.x * 40.0);
  vA = clamp((1.0 - age) * (1.0 - age) * tw * uActive * smoothstep(1.0, 4.0, z), 0.0, 1.0);
  gl_PointSize = clamp((0.8 + 1.2 * aR.z) * (1.0 - age * 0.4) * 0.04 / (z * max(uPx, 1e-6) / 0.8), 1.5, 8.0);   /* tiny soft droplets */
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */`
precision highp float; uniform float uGain; uniform sampler2D uDot; varying float vA;
${TITLE}
void main(){ float f = texture2D(uDot, gl_PointCoord).r; gl_FragColor = vec4(clamp(vec3(0.74, 0.84, 1.0) * f * uGain * 0.55 * vA * titleHold(), 0.0, 32.0), 0.0); }`
    }));
    sparks.frustumCulled = false; sparks.renderOrder = 22; ctx.sceneA.add(sparks);

    /* the mirror image on the river: a strip on the water under the beam, at the place a mirror shows it from the lens, broken by waves */
    const NS = 200, sp2 = new Float32Array(NS * 2 * 3), si = [];
    for (let i = 0; i < NS; i++) for (let j = 0; j < 2; j++) { const k = (i * 2 + j) * 3; sp2[k] = j * 2 - 1; sp2[k + 1] = 0; sp2[k + 2] = i / (NS - 1); }
    for (let i = 0; i < NS - 1; i++) { const a = i * 2; si.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const stg = new THREE.BufferGeometry(); stg.setAttribute('position', new THREE.BufferAttribute(sp2, 3)); stg.setIndex(si);
    stripU = { ...uni, uRefl: { value: 1 }, uHalf: { value: 2.4 }, uWater: { value: .05 } };
    strip = new THREE.Mesh(stg, new THREE.ShaderMaterial({
      uniforms: stripU, transparent: true, ...ADD, depthWrite: false, depthTest: true, toneMapped: false, fog: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: /* glsl */`
uniform float uHalf, uWater; varying float vLat; varying float vS; varying vec3 vW;
${COMMON}
void main(){
  float s = uSHead + 6.0 - position.z * (uLen + 6.0);
  vec3 b = sp(s); vec3 T = snorm(sp(s + 0.6) - sp(s - 0.6), vec3(1.0, 0.0, 0.0)); vec3 R = snorm(cross(T, vec3(0.0, 1.0, 0.0)), vec3(0.0, 0.0, 1.0));
  float h = max(0.2, b.y - uWater), ch = max(0.3, uCam.y - uWater);
  float k = ch / (ch + h);                              /* where the lens sees the mirror image of this point on the water */
  vec2 xz = uCam.xz + (b.xz - uCam.xz) * k;
  float w = uHalf * mix(0.6, 1.0, k);
  vec3 p = vec3(xz.x, uWater, xz.y) + R * position.x * w;
  vLat = position.x * w; vS = s; vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: /* glsl */`
precision highp float; uniform float uRefl, uSHead, uLen, uActive, uGain, uTime; uniform vec3 uCam; uniform sampler2D uWaves; varying float vLat; varying float vS; varying vec3 vW;
${TITLE}
void main(){
  vec2 toP = vW.xz - uCam.xz; float dist = length(toP); vec2 fw = dist > 0.01 ? toP / dist : vec2(0.0, 1.0), side = vec2(-fw.y, fw.x);
  vec2 q = vec2(dot(vW.xz, side) * 0.11, dot(vW.xz, fw) * 0.014 - uTime * 0.055);   /* streaks along the view: a mirror image on moving water */
  vec2 n = texture2D(uWaves, q).rg, n2 = texture2D(uWaves, q * vec2(1.0, 3.0) + vec2(0.37, uTime * 0.04)).rg;
  float d = vLat + (n.r - 0.5) * 1.6;
  float band = exp(-d * d / 0.10) + 0.06 * exp(-d * d / 1.2);   /* a narrow mirrored line, not a sheet */
  float broken = 0.1 + 0.9 * smoothstep(0.38, 0.7, n2.g);
  float behind = uSHead - vS;
  float trail = smoothstep(-3.0, 1.5, behind) * (1.0 - smoothstep(uLen * 0.45, uLen * 0.9, behind));
  float a = band * broken * trail * uActive * uRefl * smoothstep(1.2, 6.0, dist) * titleHold();
  gl_FragColor = vec4(clamp(vec3(0.55, 0.64, 1.0) * a * uGain * 0.5, 0.0, 16.0), 0.0);
}`
    }));
    strip.frustumCulled = false; strip.renderOrder = 19; ctx.sceneA.add(strip);

    /* glow on the cliffs and the water, round the head and the last metres of the trail (from the scene's depth, in its screen box) */
    const quad = new THREE.BufferGeometry(); quad.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3)); quad.setIndex([0, 1, 2, 2, 1, 3]);
    glowU = { tDepth: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uScreen: { value: new THREE.Vector2(1, 1) },
      uBox: { value: new THREE.Vector4(-1, -1, 1, 1) }, uPts: { value: Array.from({ length: TRAIL }, () => new THREE.Vector4()) }, uCol: { value: new THREE.Color(.5, .6, 1) } };
    glow = new THREE.Mesh(quad, new THREE.ShaderMaterial({
      uniforms: glowU, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, ...ADD,
      vertexShader: 'uniform vec4 uBox; void main(){ gl_Position = vec4(mix(uBox.xy, uBox.zw, position.xy), 0., 1.); }',
      fragmentShader: /* glsl */`
precision highp float; uniform sampler2D tDepth; uniform mat4 uInvProj, uCamWorld; uniform vec3 uCamPos, uCol; uniform vec2 uScreen; uniform vec4 uPts[${TRAIL}];
void main(){
  vec2 uv = gl_FragCoord.xy / uScreen; float d = texture2D(tDepth, uv).x; if (d >= 0.99999) discard;
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w; vec3 wp = (uCamWorld * v).xyz;
  vec3 nc = cross(dFdx(wp), dFdy(wp)); float nl = length(nc); vec3 N = nl > 1e-12 ? nc / nl : vec3(0.0, 1.0, 0.0); if (dot(N, uCamPos - wp) < 0.0) N = -N;
  vec3 c = vec3(0.0);
  for (int i = 0; i < ${TRAIL}; i++) { vec3 L = uPts[i].xyz - wp; float dl = length(L), r = 1.0 + float(i) * 0.6;
    float g = exp(-dl * dl / (r * r * 5.0)); c += uCol * uPts[i].w * g * (0.3 + 0.7 * max(0.0, dot(N, L / max(dl, 0.01)))); }
  gl_FragColor = vec4(clamp(c, 0.0, 8.0), 0.0);
}`
    }));
    glow.frustumCulled = false; glow.renderOrder = 30; ctx.sceneB.add(glow);

    /* ?beamDim: beyond the head the world is darker; where the light has passed it is lit again */
    dimU = { tDepth: glowU.tDepth, uInvProj: glowU.uInvProj, uScreen: glowU.uScreen, uHeadZ: { value: 10 }, uDim: { value: 0 } };
    const full = new THREE.BufferGeometry(); full.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    dim = new THREE.Mesh(full, new THREE.ShaderMaterial({
      uniforms: dimU, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: /* glsl */`
precision highp float; uniform sampler2D tDepth; uniform mat4 uInvProj; uniform vec2 uScreen; uniform float uHeadZ, uDim;
void main(){
  vec2 uv = gl_FragCoord.xy / uScreen; float d = texture2D(tDepth, uv).x;
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); float z = d >= 0.99999 ? 1e5 : -v.z / v.w;
  float beyond = clamp(smoothstep(uHeadZ - 4.0, uHeadZ + 22.0, z) * uDim, 0.0, 1.0);
  gl_FragColor = vec4(clamp(mix(vec3(1.0), vec3(0.30, 0.34, 0.46), beyond), 0.0, 1.0), 1.0);
}`
    }));
    dim.frustumCulled = false; dim.renderOrder = 5; ctx.sceneB.add(dim);   /* before the light layers: the beam itself is not darkened */
    layer.hide();
  };

  layer.warmPose = () => { uni.uActive.value = 1; uni.uSHead.value = (sp.s0 + sp.s1) / 2; };
  layer.hide = () => { if (!tubes) return; tubes.visible = head.visible = halo.visible = sparks.visible = strip.visible = glow.visible = dim.visible = false; };

  /* the chapter title's box (drawing-buffer pixels, origin bottom left), read a few times a second */
  let titleAt = 0;
  function titleBox(readBuffer) {
    const now = performance.now(); if (now - titleAt < 250) return; titleAt = now;
    const panel = document.querySelector('.fi-copy-panel.is-active'); const U = uni.uTitle.value;
    if (!panel) { U.set(-1, -1, -1, -1); return; }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const el of panel.querySelectorAll('.fi-copy-kicker, h1, h2, .fi-copy-zh')) { const r = el.getBoundingClientRect(); if (r.width < 2) continue; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
    if (x1 < x0) { U.set(-1, -1, -1, -1); return; }
    const sx = readBuffer.width / innerWidth, sy = readBuffer.height / innerHeight;
    U.set(x0 * sx, (innerHeight - y1) * sy, x1 * sx, (innerHeight - y0) * sy);
    const rail = document.querySelector('.fi-rail'), RU = uni.uRail.value; RU.set(-1, -1, -1, -1);
    if (rail && getComputedStyle(rail).visibility !== 'hidden') { let a = 1e9, b2 = 1e9, c = -1e9, d = -1e9; for (const el of [rail, ...rail.querySelectorAll('*')]) { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; a = Math.min(a, r.left); b2 = Math.min(b2, r.top); c = Math.max(c, r.right); d = Math.max(d, r.bottom); } if (c > a) RU.set(a * sx, (innerHeight - d) * sy, c * sx, (innerHeight - b2) * sy); }
  }

  const _v = {}; let flowTime = 0;
  layer.update = (f, ctx, readBuffer) => {
    if (!_v.ok) Object.assign(_v, { ok: true, h: new THREE.Vector3(), p: new THREE.Vector3(), a: new THREE.Vector3() });
    const k = T.k, cam = ctx.canyon.camera, Dp = ctx.drop;
    /* with the drop (flow2-drop-lead.js): the beam comes in during phase 3, its head runs from behind the lens into the drop and stays there */
    const active = Dp ? Dp.beam * (Dp.trail ?? Dp.fade) : smooth(T.activeIn[0], T.activeIn[1], f.u) * (1 - Math.pow(smooth(T.activeOut[0], T.activeOut[1], f.u), 2));
    const on = active > .002;
    tubes.visible = strip.visible = on; sparks.visible = on && k > 1.02; head.visible = halo.visible = sparks.visible && !(Dp && Dp.on);   /* the drop is the head */
    if (!on) { glow.visible = dim.visible = false; return; }
    titleBox(readBuffer);
    let sHead = f.sLead - T.headBack;
    if (Dp) { const sLens = sp.lensArc(f.p), e = 1 - Math.pow(1 - Dp.beam, 3); sHead = sLens - 8 + (Dp.sArc - (sLens - 8)) * e; }
    sp.point(sHead, _v.p);
    if (Dp && Dp.on) uni.uDelta.value.copy(Dp.pos).sub(_v.p).multiplyScalar(Dp.merge); else uni.uDelta.value.set(0, 0, 0);
    /* while the drop leads (after its race) the trail is a shorter loop behind it, ending well in front of the lens */
    uni.uLen.value = Dp ? T.len + (44 - T.len) * smooth(.2, 1, Dp.race || 0) : T.len;
    uni.uMerge.value = Dp ? Dp.merge : 0; uni.uDropR.value = Dp && Dp.on ? (Dp.radius || 0) * Dp.merge : 0;
    uni.uSHead.value = sHead; uni.uActive.value = active;
    /* LOOP (client 2026-11-17: 光束停止時候也要一直loop): the motion inside the ribbon runs on time whenever the beam is on screen */
    flowTime = (flowTime + (f.reduced ? 0 : Math.min(.1, f.dt))) % 3600;
    uni.uWind.value = flowTime;
    uni.uTime.value = f.now % 1000; uni.uCam.value.copy(cam.position);
    uni.uGain.value = T.gain * (1 + (k - 1) * .35);
    uni.uPx.value = 2 * Math.tan(cam.fov * Math.PI / 360) / Math.max(1, readBuffer.height) * .8;
    tubes.geometry.instanceCount = maxTubes;   /* strength no longer adds strands (client: 光線條少一點) */
    stripU.uRefl.value = T.refl * (.8 + .5 * (k - 1));
    /* the head */
    sp.point(sHead, _v.h).add(uni.uDelta.value);
    _v.a.copy(_v.h).applyMatrix4(cam.matrixWorldInverse); const headZ = -_v.a.z, near = smooth(5, 16, headZ);
    const headGlow = (.10 + (k - 1) * .55) * active * near;
    /* a small intense point (≈ 0.3–0.5 m) and a faint halo twice … three times its size */
    head.position.copy(_v.h); head.scale.setScalar(.22 + .35 * (k - 1)); head.material.opacity = Math.min(1, (k - 1) * 1.5) * active * near; head.material.color.setScalar(6.0);
    halo.position.copy(_v.h); halo.scale.setScalar(.8 + .9 * (k - 1)); halo.material.opacity = .22 * Math.min(1, (k - 1) * 1.5) * active * near; halo.material.color.setScalar(1.6);
    sparks.geometry.setDrawRange(0, Math.round(300 * sparkShare * Math.min(1, (k - 1) / .8)));   /* few, soft */
    ctx.state.beam = { active: +active.toFixed(3), sHead: +sHead.toFixed(1), headZ: +headZ.toFixed(1), k, tubes: tubes.geometry.instanceCount, flow: +flowTime.toFixed(2) };
    window.__FLOW2_SEAGULL__.bloomGain = 1 + active * (.05 + .1 * (k - 1));   /* a small raise only: the strands stay crisp */
    /* the glow's points: the head and the trail behind it (none within a few metres of the lens) */
    glowU.uCol.value.setRGB(.5, .6, 1).multiplyScalar(T.glow * .75);
    let x0 = 1, y0 = 1, x1 = -1, y1 = -1, any = false;
    const tv = Math.tan(cam.fov * Math.PI / 360), th = tv * cam.aspect;
    for (let i = 0; i < TRAIL; i++) {
      const s = sHead - i * 7; sp.point(s, _v.p); { const w = Math.max(0, 1 - i * 7 / 26); _v.p.addScaledVector(uni.uDelta.value, w * w * (3 - 2 * w)); }
      _v.a.copy(_v.p).applyMatrix4(cam.matrixWorldInverse); const z = -_v.a.z, R = (1 + i * .6) * 3.9;
      const w = (i === 0 ? headGlow * 1.4 : (.10 + (k - 1) * .55) * active * .5 * (1 - i / TRAIL) * smooth(4, 12, z)) * (s > sp.s0 ? 1 : 0);
      glowU.uPts.value[i].set(_v.p.x, _v.p.y, _v.p.z, w);
      if (w <= .001 || z < -R) continue;
      if (z < R) { x0 = -1; y0 = -1; x1 = 1; y1 = 1; any = true; continue; }
      const sx = R / z / th, sy = R / z / tv, nx = _v.a.x / z / th, ny = _v.a.y / z / tv;
      x0 = Math.min(x0, nx - sx); x1 = Math.max(x1, nx + sx); y0 = Math.min(y0, ny - sy); y1 = Math.max(y1, ny + sy); any = true;
    }
    x0 = Math.max(-1, x0); y0 = Math.max(-1, y0); x1 = Math.min(1, x1); y1 = Math.min(1, y1);
    glowU.uBox.value.set(x0, y0, x1, y1);
    glow.visible = any && x1 > x0 && y1 > y0;
    dimU.uHeadZ.value = Math.max(2, headZ); dimU.uDim.value = T.dim * active;
    dim.visible = T.dim > 0;
  };
  /* the depth-reading layers get the scene's depth (none on a buffer without multisampling: then they are not drawn) */
  layer.late = (f, ctx, readBuffer, depthTex) => {
    if (!tubes || (!glow.visible && !dim.visible)) return;
    if (!depthTex) { glow.visible = dim.visible = false; return; }
    const cam = ctx.canyon.camera;
    glowU.tDepth.value = depthTex; glowU.uInvProj.value.copy(cam.projectionMatrixInverse); glowU.uCamWorld.value.copy(cam.matrixWorld); glowU.uCamPos.value.copy(cam.position);
    glowU.uScreen.value.set(readBuffer.width, readBuffer.height);
  };
})();
