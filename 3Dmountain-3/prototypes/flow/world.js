/* =============================================================================================
   FLOW · world — sky, terrain, forest canopy and the river network, all procedural.
   Rendered into an MRT target: location 0 = linear HDR colour, location 1 = view depth (m).
   ============================================================================================= */
import * as THREE from 'three';

export const GLSL_HASH = /* glsl */`
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec4 hash42(vec2 p) { vec4 p4 = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1., 0.)), u.x), mix(hash12(i + vec2(0., 1.)), hash12(i + vec2(1., 1.)), u.x), u.y);
}
float fbm2(vec2 p, int oct) {
  float v = 0., a = .5;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; v += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.31; a *= .5; }
  return v;
}
float ridged(vec2 p) {
  float v = 0., a = .5, prev = 1.;
  for (int i = 0; i < 6; i++) { float n = 1. - abs(vnoise(p) * 2. - 1.); n *= n; v += a * n * prev; prev = n; p = mat2(1.6, 1.2, -1.2, 1.6) * p + 3.7; a *= .5; }
  return v;
}
`;

/* The sky as a function, shared by the dome, the clouds' ambient and the bubble's reflection. */
export const GLSL_SKY = /* glsl */`
uniform vec3 uZenith, uHorizon, uBelow, uSunDir, uSunColor;
uniform float uSunGlow;
vec3 skyColor(vec3 d) {
  float h = d.y;
  vec3 c = mix(uHorizon, uZenith, pow(clamp(h, 0., 1.), .48));
  c = mix(c, uBelow, smoothstep(0., -.10, h));
  float s = max(dot(d, uSunDir), 0.);
  c += uSunColor * (pow(s, 900.) * 24. + pow(s, 24.) * .22 * uSunGlow + pow(s, 4.) * .07 * uSunGlow);
  return c;
}
`;

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------------------------------------------------------------------------------------
   RIVERS. Sine-generated meanders (Langbein & Leopold): the heading swings as a sine of arc
   length, which is what real meandering rivers do. One main river, flowing toward -z, and four
   tributaries joining it in one reach — the "four paths" of the last chapter.
   --------------------------------------------------------------------------------------------- */
function meander({ x, z, heading, length, M, omega, step = 6, rnd, centre = 0, pull = 2600, wobble = .25 }) {
  const pts = [];
  const ph = rnd() * Math.PI * 2, ph2 = rnd() * Math.PI * 2;
  for (let s = 0; s <= length; s += step) {
    pts.push([x, z]);
    const th = heading + omega * Math.sin(2 * Math.PI * s / M + ph) + wobble * Math.sin(2 * Math.PI * s / (M * 2.7) + ph2)
      - (centre === null ? 0 : Math.max(-.5, Math.min(.5, (x - centre) / pull)));
    x += Math.sin(th) * step; z -= Math.cos(th) * step;
  }
  return pts;
}
export function buildRivers(seed = 11) {
  const rnd = mulberry32(seed);
  const main = meander({ x: 0, z: 9800, heading: 0, length: 36000, M: 1180, omega: 1.32, rnd });
  const cut = main.findIndex(p => p[1] < -9800);
  if (cut > 0) main.length = cut;
  const rivers = [{ id: 0, pts: main, half: s => 9 + 2 * Math.sin(s / 900) }];
  /* Junctions: in the reach the last chapters look at (z between -3300 and -1700). */
  const reach = main.map((p, i) => ({ p, i })).filter(o => o.p[1] < -1650 && o.p[1] > -3350);
  const picks = [.12, .37, .62, .88].map(f => reach[Math.floor(f * (reach.length - 1))].i);
  picks.forEach((idx, k) => {
    const a = main[Math.max(0, idx - 3)], b = main[Math.min(main.length - 1, idx + 3)];
    const downstream = Math.atan2(b[0] - a[0], -(b[1] - a[1]));
    const side = k % 2 === 0 ? 1 : -1;
    const up = downstream + Math.PI + side * (.9 + rnd() * .25);
    const trib = meander({ x: main[idx][0], z: main[idx][1], heading: up, length: 9000, M: 620 + rnd() * 260, omega: .95 + rnd() * .2, rnd, centre: null, wobble: .18 });
    trib.reverse();
    rivers.push({ id: k + 1, pts: trib, half: s => 5.5 + 1.5 * Math.min(1, s / 2500) });
  });
  for (const r of rivers) {
    let s = 0; r.s = [0];
    for (let i = 1; i < r.pts.length; i++) { s += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); r.s.push(s); }
    r.length = s;
  }
  return { rivers, junctions: picks.map(i => main[i]), main };
}

/* Distance field of the network on a grid: Felzenszwalb-Huttenlocher EDT with the nearest seed
   carried along, then the exact distance to that seed's centreline point minus the half width.
   Packed as RGBA half floats: signed distance to the bank (m), arc length (km), flow heading
   + river id * 8, half width. */
export function riverField(net, { size = 2048, minX = -7200, minZ = -8200, extent = 14400 } = {}) {
  const N = size, cell = extent / N;
  const seedX = [], seedZ = [], seedHalf = [], seedS = [], seedHead = [];
  const grid = new Int32Array(N * N).fill(-1);
  for (const r of net.rivers) {
    for (let i = 1; i < r.pts.length; i++) {
      const [x0, z0] = r.pts[i - 1], [x1, z1] = r.pts[i];
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / (cell * .45)));
      const head = Math.atan2(x1 - x0, -(z1 - z0));
      for (let k = 0; k < n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        const gi = Math.floor((x - minX) / cell), gj = Math.floor((z - minZ) / cell);
        if (gi < 0 || gj < 0 || gi >= N || gj >= N) continue;
        const s = r.s[i - 1] + len * t;
        const id = seedX.length;
        seedX.push(x); seedZ.push(z); seedHalf.push(r.half(s)); seedS.push(s / 1000); seedHead.push(head + r.id * 8);
        const g = gj * N + gi;
        if (grid[g] < 0 || r.id === 0) grid[g] = id;
      }
    }
  }
  const INF = 1e20;
  /* Pass 1: along rows, nearest seed column. */
  const rowD = new Float32Array(N * N), rowS = new Int32Array(N * N).fill(-1);
  for (let j = 0; j < N; j++) {
    let last = -1;
    for (let i = 0; i < N; i++) { const g = j * N + i; if (grid[g] >= 0) last = i; rowS[g] = last >= 0 ? grid[j * N + last] : -1; rowD[g] = last >= 0 ? (i - last) : INF; }
    last = -1;
    for (let i = N - 1; i >= 0; i--) {
      const g = j * N + i; if (grid[g] >= 0) last = i;
      if (last >= 0 && (last - i) < rowD[g]) { rowD[g] = last - i; rowS[g] = grid[j * N + last]; }
    }
    for (let i = 0; i < N; i++) { const g = j * N + i; rowD[g] = rowD[g] >= INF ? INF : rowD[g] * rowD[g]; }
  }
  /* Pass 2: along columns, lower envelope of parabolas (Felzenszwalb & Huttenlocher). */
  const out = new Float32Array(N * N * 4);
  const v = new Int32Array(N), zb = new Float64Array(N + 1), f = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) f[j] = rowD[j * N + i];
    let k = -1;
    for (let q = 0; q < N; q++) {
      if (f[q] >= INF) continue;
      if (k < 0) { k = 0; v[0] = q; zb[0] = -INF; zb[1] = INF; continue; }
      let s2 = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s2 <= zb[k]) { k--; s2 = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; zb[k] = s2; zb[k + 1] = INF;
    }
    for (let q = 0, kk = 0; q < N; q++) {
      const g = (q * N + i) * 4;
      if (k < 0) { out[g] = 3000; continue; }
      while (zb[kk + 1] < q) kk++;
      const row = v[kk], sid = rowS[row * N + i];
      if (sid < 0) { out[g] = 3000; continue; }
      const x = minX + (i + .5) * cell, z = minZ + (q + .5) * cell;
      const d = Math.hypot(x - seedX[sid], z - seedZ[sid]) - seedHalf[sid];
      out[g] = Math.max(-200, Math.min(3000, d)); out[g + 1] = seedS[sid]; out[g + 2] = seedHead[sid]; out[g + 3] = seedHalf[sid];
    }
  }
  const half = new Uint16Array(out.length);
  for (let i = 0; i < out.length; i++) half[i] = THREE.DataUtils.toHalfFloat(out[i]);
  const tex = new THREE.DataTexture(half, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, box: new THREE.Vector4(minX, minZ, extent, 1 / extent), N, cell, minX, minZ };
}

/* ---------------------------------------------------------------------------------------------
   TERRAIN height, the same in the vertex shader: hills that flatten into the floodplain, a ring
   of hazy mountains far out, the river bed a little lower.
   --------------------------------------------------------------------------------------------- */
const GLSL_TERRAIN = /* glsl */`
uniform sampler2D tRiver;
uniform vec4 uRiverBox;
vec4 riverAt(vec2 p) {
  vec2 uv = (p - uRiverBox.xy) * uRiverBox.w;
  if (uv.x <= 0. || uv.y <= 0. || uv.x >= 1. || uv.y >= 1.) return vec4(3000., 0., 0., 0.);
  return textureLod(tRiver, uv, 0.);
}
float terrainH(vec2 p) {
  float d = riverAt(p).r;
  float flood = smoothstep(30., 520., d);
  float hills = (fbm2(p / 1150., 5) - .38) * 190. * flood + (fbm2(p / 300. + 9., 3) - .5) * 18. * flood;
  float r = length(p - vec2(0., -600.));
  float ring = smoothstep(4600., 9800., r);
  float mtn = ring * (ridged(p / 2700.) * 1750. + (fbm2(p / 760., 4) - .5) * 240.) * mix(.18, 1., smoothstep(60., 1500., d));
  float h = max(hills, -4.) + mtn;
  h -= 2.2 * (1. - smoothstep(-3., 5., d));
  return h;
}
`;

/* ---------------------------------------------------------------------------------------------
   FOREST CANOPY. A jittered grid of trees, ~3.6 m apart: conifers as star-shaped cones (the way a
   spruce looks from above), broadleaves as softer domes in groves, a few yellow birches. Height
   field max over the 3x3 neighbourhood; normals by finite difference; self-shadowing by marching
   the height field toward the sun. Far away (a texel over ~1 m) it hands over to an averaged
   forest tone so nothing shimmers.
   --------------------------------------------------------------------------------------------- */
const GLSL_CANOPY = /* glsl */`
const float CELL = 3.6;
float forestAt(vec2 p) {
  float d = riverAt(p).r;
  float dens = smoothstep(2., 12., d + (vnoise(p / 23.) - .5) * 14.);
  dens *= 1. - .9 * smoothstep(.60, .74, fbm2(p / 300. + 3.1, 3));
  return clamp(dens, 0., 1.) * .94;
}
float canopy(vec2 p, out vec4 info) {
  vec2 g = floor(p / CELL);
  float best = 0.; info = vec4(0., 0., 1., 0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = g + vec2(float(i), float(j));
    vec4 h = hash42(c);
    vec2 ctr = (c + .18 + .64 * h.xy) * CELL;
    if (h.w > forestAt(ctr)) continue;
    float grove = smoothstep(.56, .70, vnoise(ctr / 140. + 4.2));
    float broad = step(.62 - .45 * grove, hash12(c * 1.37 + 5.1));
    vec2 dv = p - ctr; float dist = length(dv);
    float R = mix(1.45, 2.65, h.z) * mix(1., 1.35, broad);
    if (dist >= R * 1.25) continue;
    float ang = atan(dv.y, dv.x);
    float star = broad > .5 ? 1. + .07 * sin(ang * 5. + h.x * 9.) + .05 * sin(ang * 9. + h.y * 7.)
                            : 1. + .17 * sin(ang * 7. + h.x * 20.) + .07 * sin(ang * 13. + h.y * 31.);
    float Re = R * star;
    if (dist >= Re) continue;
    float u = dist / Re;
    float ch = broad > .5 ? 3.2 * pow(1. - u * u, .7) : 7.5 * pow(1. - u, .85);
    ch += mix(14., 22., h.y);
    if (ch > best) { best = ch; info = vec4(h.z, broad, u, hash12(c * 3.7)); }
  }
  return best;
}
`;

export function createWorld(renderer, { quality = 1 } = {}) {
  const net = buildRivers(11);
  const field = riverField(net, { size: quality > .6 ? 2048 : 1024 });
  const scene = new THREE.Scene();

  const shared = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBelow: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(-.45, .55, -.70).normalize() }, uSunColor: { value: new THREE.Color(1, .95, .88) }, uSunGlow: { value: 1 },
    uHaze: { value: new THREE.Color() }, uHazeDensity: { value: .00012 }, uTime: { value: 0 }
  };
  const terrainUniforms = { tRiver: { value: field.tex }, uRiverBox: { value: field.box } };

  /* Sky dome: follows the camera; writes a far depth. */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { ...shared, uCirrus: { value: 1 } },
    vertexShader: /* glsl */`varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */`
      layout(location = 1) out highp vec4 oDepth;
      uniform float uTime, uCirrus;
      varying vec3 vDir;
      ${GLSL_HASH}
      ${GLSL_SKY}
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = skyColor(d);
        /* High cirrus on a plane far above, streaked along the wind. */
        if (d.y > .015 && uCirrus > .001) {
          vec2 q = cameraPosition.xz + d.xz * ((9000. - cameraPosition.y) / d.y);
          q = mat2(.92, -.38, .38, .92) * q / 5200.;
          q.x *= .32;
          float n = fbm2(q + vec2(uTime * .004, 0.), 6);
          float wisp = smoothstep(.52, .86, n) * smoothstep(.015, .16, d.y) * (1. - smoothstep(.45, .9, d.y) * .5);
          float streak = smoothstep(.45, .8, fbm2(q * vec2(5., 1.) + 3.1, 4));
          c = mix(c, mix(uHorizon, vec3(1.), .55) * 1.25, wisp * (.45 + .55 * streak) * .62 * uCirrus);
        }
        gl_FragColor = vec4(c, 1.);
        oDepth = vec4(6e4, 0., 0., 1.);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50000, 64, 32), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  /* Ground: a grid dense in the middle and sparse at the edges (u -> sign(u)|2u|^2), ±21 km. */
  const SEG = quality > .6 ? 900 : 520, SPAN = 21000;
  const geo = new THREE.PlaneGeometry(1, 1, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i), w = pos.getZ(i);
    pos.setXYZ(i, Math.sign(u) * Math.pow(Math.abs(2 * u), 2) * SPAN, 0, Math.sign(w) * Math.pow(Math.abs(2 * w), 2) * SPAN - 600);
  }
  geo.computeBoundingSphere();
  const groundMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, ...terrainUniforms, uDetail: { value: quality }, uFlowGlow: { value: 0 }, uFlowRiver: { value: -1 }, uFlowPhase: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vWorld; varying vec3 vNrm; varying float vViewZ;
      ${GLSL_HASH}
      ${GLSL_TERRAIN}
      void main() {
        vec2 p = (modelMatrix * vec4(position, 1.)).xz;
        float h = terrainH(p);
        float e = 7.;
        float hx = terrainH(p + vec2(e, 0.)), hz = terrainH(p + vec2(0., e));
        vNrm = normalize(vec3(h - hx, e, h - hz));
        vec4 wp = vec4(p.x, h, p.y, 1.);
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      layout(location = 1) out highp vec4 oDepth;
      uniform vec3 uHaze; uniform float uHazeDensity, uTime, uDetail, uFlowGlow, uFlowRiver, uFlowPhase;
      varying vec3 vWorld; varying vec3 vNrm; varying float vViewZ;
      ${GLSL_HASH}
      ${GLSL_SKY}
      ${GLSL_TERRAIN}
      ${GLSL_CANOPY}
      vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
      void main() {
        vec2 p = vWorld.xz;
        vec3 Ng = normalize(vNrm);
        vec4 rv = riverAt(p);
        float d = rv.r + (vnoise(p / 9.) - .5) * 3.5 + (vnoise(p / 2.3) - .5) * 1.2;
        float foot = max(length(dFdx(p)), length(dFdy(p)));
        vec3 L = uSunDir;
        float sunUp = max(L.y, .05);
        vec3 V = normalize(cameraPosition - vWorld);
        float slope = 1. - Ng.y;
        float hAbs = vWorld.y;

        vec3 albedo; vec3 N = Ng; float ao = 1., shadow = 1., rough = .9;
        /* Ground cover outside the forest: meadow by the river, rock and scree on steep mountain faces. */
        float meadowN = fbm2(p / 40., 4);
        vec3 meadow = mix(lin(vec3(.27, .35, .17)), lin(vec3(.38, .41, .24)), smoothstep(.35, .7, meadowN));
        meadow *= .85 + .3 * vnoise(p / 3.);
        vec3 gravel = lin(vec3(.62, .60, .55)) * (.82 + .25 * vnoise(p / 1.7)) * (.9 + .15 * vnoise(p / 13.));
        vec3 rock = lin(vec3(.42, .41, .40)) * (.8 + .3 * fbm2(p / 60., 4));
        vec3 floorCol = lin(vec3(.09, .12, .07));
        vec3 mud = lin(vec3(.36, .34, .29)) * (.85 + .3 * vnoise(p / 2.1));
        float bank = 1. - smoothstep(.4, 2. + 4. * vnoise(p / 37.), d);
        albedo = mix(meadow, mud, bank);
        albedo = mix(albedo, rock, smoothstep(.42, .62, slope));
        albedo = mix(albedo, lin(vec3(.86, .88, .9)), smoothstep(1650., 1900., hAbs + 140. * vnoise(p / 300.)) * smoothstep(.75, .45, slope));

        /* Forest. */
        float detailW = (1. - smoothstep(.9, 2.0, foot)) * step(.5, uDetail + .5);
        float onTree = 0.;
        float dens = forestAt(p) * (1. - smoothstep(.40, .60, slope)) * (1. - smoothstep(1500., 1750., hAbs));
        if (detailW > .001 && dens > .002) {
          vec4 info;
          float hc = canopy(p, info);
          if (hc > 0.) {
            vec4 i2;
            float e = max(.12, foot * .7);
            float hxp = canopy(p + vec2(e, 0.), i2), hzp = canopy(p + vec2(0., e), i2);
            hxp = hxp > 0. ? hxp : hc - 2.; hzp = hzp > 0. ? hzp : hc - 2.;
            vec3 Nc = normalize(vec3(hc - hxp, e, hc - hzp));
            /* Needles: fine, pixel-limited. */
            float fine = (1. - smoothstep(.06, .24, foot));
            vec2 nq = p * 3.1;
            Nc = normalize(Nc + vec3(vnoise(nq) - .5, 0., vnoise(nq + 7.) - .5) * .9 * fine);
            float broad = info.y;
            vec3 conifer = mix(lin(vec3(.06, .15, .08)), lin(vec3(.13, .26, .12)), info.x);
            vec3 leaf = mix(lin(vec3(.20, .34, .11)), lin(vec3(.45, .48, .16)), step(.93, info.w));
            vec3 tc = mix(conifer, leaf, broad) * (.75 + .4 * vnoise(p * 1.7 + info.w * 9.));
            tc *= mix(.78, 1.18, fbm2(p / 90., 3));
            float crownAO = mix(.28, 1., smoothstep(.98, .3, info.z));
            /* Shadows from neighbouring crowns: march toward the sun through the height field. */
            float sh = 1.;
            if (foot < 1.3) {
              vec2 sd = normalize(L.xz + 1e-4);
              float tanE = sunUp / max(length(L.xz), 1e-3);
              for (int k = 1; k <= 3; k++) {
                float dk = float(k) * 2.1;
                vec4 i3; float hq = canopy(p + sd * dk, i3);
                if (hq > hc + dk * tanE) sh -= .3 * smoothstep(0., 1.5, hq - hc - dk * tanE);
              }
              sh = max(sh, .12);
            }
            vec3 albF = tc;
            albedo = mix(albedo, albF, detailW);
            N = normalize(mix(N, Nc, detailW));
            ao = mix(ao, crownAO, detailW);
            shadow = mix(shadow, sh, detailW);
            onTree = detailW;
          } else {
            albedo = mix(albedo, floorCol, detailW * dens);
            ao = mix(ao, .32, detailW * dens);
            shadow = mix(shadow, .45, detailW * dens);
          }
        }
        /* Far forest: the averaged look of the canopy (dark green, AO, sun on the domes). */
        float farW = 1. - detailW;
        if (farW > .001 && dens > .002) {
          float m = fbm2(p / 55., 4);
          vec3 farCol = mix(lin(vec3(.08, .16, .08)), lin(vec3(.15, .24, .11)), m) * mix(1., 1.2, smoothstep(.6, .8, vnoise(p / 160.)));
          albedo = mix(albedo, farCol, farW * smoothstep(.0, .35, dens));
          ao = mix(ao, .62, farW * dens);
        }

        vec3 col;
        if (d < 0. && onTree < .5) {
          /* Water: shallow, pale, reflecting the sky; ripples carried along the flow. */
          float rid = floor((rv.b + 4.) / 8.);
          float hd = rv.b - rid * 8.;
          vec2 fl = vec2(sin(hd), -cos(hd));
          vec2 q = p - fl * uTime * .9;
          vec2 g = vec2(vnoise(q / 1.8) - vnoise(q / 1.8 + vec2(.7, 0.)), vnoise(q / 1.8) - vnoise(q / 1.8 + vec2(0., .7)))
                 + .6 * vec2(vnoise(q / .7 + 3.) - vnoise(q / .7 + vec2(3.5, 3.)), vnoise(q / .7 + 3.) - vnoise(q / .7 + vec2(3., 3.5)));
          vec3 Nw = normalize(vec3(g.x * .5, 1., g.y * .5));
          float depth = clamp(-d / max(rv.a, 4.), 0., 1.);
          vec3 body = mix(lin(vec3(.40, .39, .34)), lin(vec3(.15, .17, .16)), smoothstep(.0, .8, depth));
          float F = min(.02 + .98 * pow(1. - max(dot(Nw, V), 0.), 5.), .55);
          vec3 R = reflect(-V, Nw);
          vec3 refl = skyColor(R) * .8;
          col = mix(body * (uSunColor * sunUp * 1.1 + skyColor(vec3(0., 1., 0.)) * .5), refl, F);
          col += uSunColor * pow(max(dot(reflect(-L, Nw), V), 0.), 220.) * 3.;
          col = mix(col, mud * (uSunColor * sunUp + .35), smoothstep(-1., 0., d) * .4);
        } else {
          float ndl = max(dot(N, L), 0.);
          vec3 sky = skyColor(normalize(N + vec3(0., .6, 0.)));
          col = albedo * (uSunColor * ndl * shadow * 2.6 + sky * ao * .5);
          /* Wet edge at the waterline. */
          col *= mix(1., .6, 1. - smoothstep(0., 2.5, d));
        }
        /* The four paths: warm light along one tributary (or all of them), pulses running down
           into the main river, spilling a little onto the banks. */
        if (uFlowGlow > .001) {
          float gid = floor((rv.b + 4.) / 8.);
          if (gid > .5 && (uFlowRiver < -.5 || abs(gid - uFlowRiver) < .5)) {
            float ph = fract(rv.g * 2.4 - uFlowPhase);
            float pulse = smoothstep(0., .12, ph) * (1. - smoothstep(.12, .7, ph));
            float wet = 1. - smoothstep(-1., 1.5, d), halo = exp(-max(d, 0.) / 18.);
            col += vec3(1., .78, .42) * uFlowGlow * (.35 + pulse) * (wet * 1.6 + halo * .35);
          }
        }
        /* Aerial perspective: haze with distance, thicker low down, warm toward the sun. */
        float dist = length(cameraPosition - vWorld);
        float hz = 1. - exp(-dist * uHazeDensity * mix(1.4, .6, smoothstep(0., 1600., (vWorld.y + cameraPosition.y) * .5)));
        vec3 hazeC = mix(uHaze, uHaze + uSunColor * .35, pow(max(dot(-V, L), 0.), 6.));
        col = mix(col, hazeC, clamp(hz, 0., 1.));
        gl_FragColor = vec4(col, 1.);
        oDepth = vec4(vViewZ, 0., 0., 1.);
      }`
  });
  const ground = new THREE.Mesh(geo, groundMat);
  ground.frustumCulled = false;
  scene.add(ground);

  return {
    scene, net, field, shared, sky, ground, groundMat,
    update(S, time, camera) {
      shared.uTime.value = time;
      sky.position.copy(camera.position);
      if (S.zenith) shared.uZenith.value.copy(S.zenith);
      if (S.horizon) shared.uHorizon.value.copy(S.horizon);
      if (S.below) shared.uBelow.value.copy(S.below);
      if (S.haze) shared.uHaze.value.copy(S.haze);
      if (S.hazeDensity !== undefined) shared.uHazeDensity.value = S.hazeDensity;
      if (S.flowGlow !== undefined) { groundMat.uniforms.uFlowGlow.value = S.flowGlow; groundMat.uniforms.uFlowRiver.value = S.flowRiver; groundMat.uniforms.uFlowPhase.value = time * .25; }
    }
  };
}
