/* Drop gorge · the scene (Team XS, 2026-11-17). index1-5-canyon-forest.html, loaded by drop-gorge.js (the controller) when the page is idle.
   Client: 「山道後轉場接>圖片這個 左右峽谷 水滴往下滾 水滴往下 左右出現文字 再接回去>俯視山谷」, then 「水滴進入水下時候 … 參考這網站左右兩邊的岩石」
   (deepseecommerce.com for the behaviour only: the lens sinks under the surface, masses at both edges slide by with depth, a light held at the
   centre, texts left and right). Our picture: the canyon's own dark slate with moss and small pale flowers, in slabs that come in from the
   left and right edges at five depths, in the soft blue-grey light under the river; the canyon's drop (Team SQ's lens) in the middle.

   One own canvas and context (#xs-gl, under the page interface). Per frame, only while the section shows:
     1  the gorge into A (RGBA8, MSAA 4 / phones 2): the ground (gradient + light from the surface + soft shafts, one noise read), five
        rock layers (one program, 3 texture reads a pixel: slate colour, strata normal, moss — dominant-axis projection, the slabs are
        flat-faced), instanced moss tufts / flowers / hanging moss (one program, one atlas read, alpha to coverage), three mist sheets,
        suspended specks (points);
     2  A copied into B and the drop drawn over it, reading A behind it (the canyon drop's own lens material, edge anti-aliased);
     3  B onto the screen: the waterline (entry), the brush mask (the hand-over to the view from above, the same stroke as the atlas), a soft vignette.
   Rocks are generated once at load (deterministic, a few thousand triangles, flat facets, per-vertex AO and moss bands baked into
   attributes); nothing is computed per pixel that could be baked. Colours are lit in linear light and written sRGB-encoded into A/B.

   UNDER WATER (DEEP, 2026-11-17 evening; client: 「https://organimo.com/ 水下轉場參考這個」「bluemarinefoundation … 水下世界都參考」).
   Default now; `?gorge=old` (or `?uw=0`) = the look above, untouched. Same journey, beats, texts and drop; in OUR blue (the canyon's teal → navy):
     · the water: teal toward the surface, navy below, the whole column cooler and darker as the lens sinks (one noise read, as before);
     · the surface overhead: the world plane y = 0 seen from below (one ray per pixel in the ground pass), two drifting ripple nets (the baked
       caustic texture) that stretch into bright bands at a grazing angle, fading with the light's path through the water;
     · soft god rays from it (screen pass, two noise reads, slow sway), moving caustics on the rocks' tops and the sand (two reads, min);
     · a sandy floor that rises ahead and at both sides (built once, sand ripples + caustics), seaweed / soft coral / sea fans on it and on
       the slabs (a second plant atlas drawn at load), rising bubbles (columns + singles) and drifting marine snow (points, fixed in the water);
     · light ink for the texts (drop-gorge.css, html[data-xs-uw]). Live dials: __FLOW2_GORGE__.scene().uw (uniform objects) and ?uwCeil= ?uwRays=
       ?uwCaus= ?uwBub= ?uwSnow= ?uwFog= ?uwFloor= (multipliers). */
import * as THREE from 'three';

const clamp01 = x => Math.min(1, Math.max(0, x));
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hex = h => new THREE.Color(h);   // sRGB hex → linear (three's colour management)
const UWQ = new URLSearchParams(location.search);
const UW_DEFAULT = UWQ.get('gorge') !== 'old' && UWQ.get('uw') !== '0';
const uwNum = (k, d) => { const v = parseFloat(UWQ.get(k)); return Number.isFinite(v) ? v : d; };
/* UW-BUILD (overnight 2026-11-18; client 「水下精緻度還是差太多 起碼要比現在更好5倍以上，但不能增加太多容量跟耗能 … 影片搭配3D也可以」):
   a FAR layer of baked / filmed light loops behind the live near layer (assets/far/far.json), plus near-layer refinements.
   ?uw=3d = today's all-3D underwater exactly (none of it) · ?far=0 = the near refinements without the far layer · ?farK= strength. */
const UW3D = UWQ.get('uw') === '3d';
/* OCEAN (CEIL, 2026-11-18 evening; client: 「海底下的質感要如圖一模一樣」): ?ocean=1 = the video's look just under the water (the surface seen from
   below with real refraction / total internal reflection, sun glints, god rays, teal → navy). The module is fetched only with the switch;
   without ?ocean=1 nothing here changes. */
const OC = (UWQ.get('ocean') === '1' || window.__RISE_OCEAN__ === true || (window.__GORGE_OCEAN__ === true && UWQ.get('ocean') !== '0')) ? await import('./ocean/dg-ocean.js?v=18-ambient').catch(() => null) : null;

/* ------------------------------------------------------------------ UNDER WATER: the same functions, the water's own colour (cheap: every layer calls bgAt) */
const COMMON_UW = /* glsl */`
uniform vec2 uRes; uniform float uCamY, uSurf, uGlow, uDeep, uShafts, uTime, uBgGain;
uniform vec3 uBgTop, uBgMid, uBgLow, uBgGlow, uAbyss;
uniform sampler2D tNoise;
uniform vec4 uBoostA, uBoostB; uniform float uBoost;
vec3 toSRGB(vec3 c){ c = max(c, vec3(0.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
float gFar = 1.0;   /* UW-BUILD: set by a fog line just before it reads bgAt (1 = the whole far layer, as the empty water shows it) */
#ifdef FAR
/* UW-BUILD FAR LAYER: two video slots (the depth bands either side of the lens, cross-faded). Per slot P = (plate half-tan x, y, vertical
   shift in tan units = parallax, weight), G = (plate mean luminance, contrast, keep the plate's own colour, white in the bright parts).
   Our water colour g is multiplied by the plate's light (plate / its mean): the colour stays the river's, the plate brings the light. */
uniform sampler2D tFarA, tFarB; uniform vec4 uFarA, uFarB, uFarGA, uFarGB; uniform vec2 uFarScr; uniform float uFarK, uFarLum; uniform vec3 uFarWhite;
vec3 farTap(sampler2D t, vec4 P, vec4 G, vec2 n, vec3 g){
  vec2 uv = vec2(0.5 + n.x * uFarScr.x / (2.0 * P.x), 0.5 + (n.y * uFarScr.y + P.z) / (2.0 * P.y));
  vec3 v = texture2D(t, uv).rgb; v = v * (v * (v * 0.305306011 + 0.682171111) + 0.012522878);   /* sRGB → linear */
  float l = dot(v, vec3(0.2126, 0.7152, 0.0722)), r = l / G.x, lg = dot(g, vec3(0.2126, 0.7152, 0.0722));
  vec3 c = g * pow(max(r, 0.0), G.y) + uFarWhite * lg * max(r - 1.0, 0.0) * G.w;
  return mix(c, v * (uFarLum / G.x), G.z);   /* keep: the plate's own (graded) colour, its mean held at our water's level at this depth */
}
vec3 farMix(vec3 g, vec2 s){
  vec2 n = s * 2.0 - 1.0; vec3 c = g * (1.0 - uFarA.w - uFarB.w);
  if (uFarA.w > 0.001) c += farTap(tFarA, uFarA, uFarGA, n, g) * uFarA.w;
  if (uFarB.w > 0.001) c += farTap(tFarB, uFarB, uFarGB, n, g) * uFarB.w;
  return mix(g, c, uFarK * gFar);
}
#endif
vec3 bgAt(vec2 fc){
  vec2 s = fc / uRes; float asp = uRes.x / uRes.y; float y = s.y;
  /* teal toward the surface (looking up), navy below; the column cools and darkens as the lens sinks */
  vec3 c = mix(uBgLow, uBgMid, smoothstep(-0.2, 0.62, y));
  c = mix(c, uBgTop, smoothstep(0.48, 1.12, y) * (1.0 - 0.4 * uDeep));
  c = mix(c, uAbyss, uDeep * 0.5 * (1.0 - 0.45 * smoothstep(0.35, 1.0, y)));
  float n = texture2D(tNoise, vec2(s.x * asp * 0.22 + 0.13, s.y * 0.3 - uCamY * 0.0045)).r;
  c *= (0.95 + 0.1 * n) * mix(1.0, uBgGain, smoothstep(0.65, 4.4, -uCamY));
#ifdef FAR
  c = farMix(c, s);
#endif
  return c;
}
float softRect(vec2 s, vec4 r, float f){
  return smoothstep(r.x - f, r.x + f * 0.4, s.x) * (1.0 - smoothstep(r.z - f * 0.4, r.z + f, s.x)) * smoothstep(r.y - f, r.y + f * 0.4, s.y) * (1.0 - smoothstep(r.w - f * 0.4, r.w + f, s.y));
}
float boostAt(vec2 fc){ vec2 s = fc / uRes; return uBoost * max(softRect(s, uBoostA, 0.07), softRect(s, uBoostB, 0.07)); }
/* moving caustics: two drifting copies of the baked light net, the darker of the two (the net bends and breathes, never flickers) */
float causMove(sampler2D t, vec2 p, float k){
  float a = texture2D(t, p + vec2(uTime * 0.021, uTime * 0.013) * k).r, b = texture2D(t, p * 1.31 + vec2(-uTime * 0.017, uTime * 0.019) * k + 0.41).r;
  return min(a, b);
}
`;

/* ------------------------------------------------------------------ shared GLSL: the ground colour (used by every layer for its haze) */
const COMMON = /* glsl */`
float gFar = 1.0;
uniform vec2 uRes; uniform float uCamY, uSurf, uGlow, uDeep, uShafts, uTime;
uniform vec3 uBgTop, uBgMid, uBgLow, uBgGlow;
uniform sampler2D tNoise;
uniform vec4 uBoostA, uBoostB; uniform float uBoost;
vec3 toSRGB(vec3 c){ c = max(c, vec3(0.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 bgAt(vec2 fc){
  vec2 s = fc / uRes; float asp = uRes.x / uRes.y; float y = s.y;
  vec3 c = mix(uBgLow, uBgMid, smoothstep(-0.1, 0.62, y));
  c = mix(c, uBgTop, smoothstep(0.5, 1.15, y) * (1.0 - 0.55 * uDeep));
  /* low, soft variation of the water's light (slides with the descent, never moves by itself) */
  float n = texture2D(tNoise, vec2(s.x * asp * 0.22 + 0.13, s.y * 0.3 - uCamY * 0.0045)).r;
  c *= 0.94 + 0.12 * n;
  /* soft shafts of light from the surface, fixed in the water (they slide up and fade as the lens goes deeper) */
  float xs = s.x * asp + (1.0 - y) * 0.28;
  float sh = exp(-pow((xs - 0.52 * asp) / 0.05, 2.0)) * 0.7 + exp(-pow((xs - 0.86 * asp) / 0.035, 2.0)) * 0.5 + exp(-pow((xs - 0.27 * asp) / 0.08, 2.0)) * 0.45
           + exp(-pow((xs - 1.22 * asp) / 0.06, 2.0)) * 0.4;
  sh *= (0.75 + 0.5 * texture2D(tNoise, vec2(xs * 1.7, 0.31)).r) * smoothstep(-0.25, 1.0, y) * uShafts;
  c += uBgGlow * sh * 0.07;
  /* the underside of the surface: right below the waterline (it rises out of view as the lens goes down) */
  float d = uSurf - y;
  float under = step(0.0, d);
  c += uBgGlow * uGlow * under * (exp(-d * 10.0) * 0.32 + exp(-d * 2.6) * 0.12);
  return c;
}
float softRect(vec2 s, vec4 r, float f){
  return smoothstep(r.x - f, r.x + f * 0.4, s.x) * (1.0 - smoothstep(r.z - f * 0.4, r.z + f, s.x)) * smoothstep(r.y - f, r.y + f * 0.4, s.y) * (1.0 - smoothstep(r.w - f * 0.4, r.w + f, s.y));
}
/* behind the texts the water is a little thicker, so a slab passing behind a title never fights it */
float boostAt(vec2 fc){ vec2 s = fc / uRes; return uBoost * max(softRect(s, uBoostA, 0.07), softRect(s, uBoostB, 0.07)); }
`;

/* ------------------------------------------------------------------ baked helper textures (made once, on the CPU, at load) */
function noiseTexture(size = 256, seed = 7) {
  /* tileable smooth value noise, 4 octaves */
  const R = rng(seed), g = (n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = R(); return a; };
  const data = new Uint8Array(size * size * 4), oct = [[4, .5], [8, .27], [16, .15], [32, .08]].map(([n, w]) => ({ n, w, v: g(n) }));
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    for (const o of oct) {
      const fx = x / size * o.n, fy = y / size * o.n, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const at = (i, j) => o.v[((j % o.n + o.n) % o.n) * o.n + ((i % o.n + o.n) % o.n)];
      v += o.w * ((at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty);
    }
    const k = (y * size + x) * 4, b = Math.round(clamp01(v / 1.0) * 255);
    data[k] = b; data[k + 1] = b; data[k + 2] = b; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
function causticTexture(size = 256, seed = 11) {
  /* tileable cellular light net (F2 − F1), the caustic of a rippled surface, frozen */
  const R = rng(seed), N = 7, pts = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([(i + .15 + .7 * R()) / N, (j + .15 + .7 * R()) / N]);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size; let f1 = 9, f2 = 9;
    for (const [px, py] of pts) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const d = Math.hypot(u - px - ox, v - py - oy); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const e = Math.exp(-(f2 - f1) * N * 9), k = (y * size + x) * 4, b = Math.round(clamp01(e) * 255);
    data[k] = b; data[k + 1] = b; data[k + 2] = b; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
/* the plant atlas, drawn once on a 2D canvas: 4 × 2 cells of 128 px.
   0 white flower cluster · 1 pale pink star flowers · 2 grass tuft · 3 moss cushion · 4 hanging moss · 5 small fern · 6 white bells · 7 seed heads */
function plantAtlas(seed = 5) {
  const C = 128, cv = document.createElement('canvas'); cv.width = C * 4; cv.height = C * 2;
  const g = cv.getContext('2d'), R = rng(seed);
  const cell = (i, f) => { g.save(); g.translate((i % 4) * C, Math.floor(i / 4) * C); g.beginPath(); g.rect(0, 0, C, C); g.clip(); f(); g.restore(); };
  const stem = (x0, y0, x1, y1, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + (R() - .5) * 10, (y0 + y1) / 2, x1, y1); g.stroke(); };
  const blossom = (x, y, r, petals, col, mid) => {
    g.fillStyle = col;
    for (let p = 0; p < petals; p++) { const a = p / petals * Math.PI * 2 + R() * .3; g.beginPath(); g.ellipse(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .55, r * .3, a, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = mid; g.beginPath(); g.arc(x, y, r * .28, 0, Math.PI * 2); g.fill();
  };
  const blades = (n, h, cols) => { for (let i = 0; i < n; i++) { const x = 64 + (R() - .5) * 70, lean = (R() - .5) * 46; stem(x, 128, x + lean, 128 - h * (.45 + .55 * R()), 2 + R() * 2.2, cols[i % cols.length]); } };
  cell(0, () => { blades(7, 70, ['#4f6b33', '#5f7c3c']); for (let i = 0; i < 6; i++) { const x = 30 + R() * 68, y = 26 + R() * 46; stem(x, y + 4, x + (R() - .5) * 6, 120, 1.6, '#55703a'); blossom(x, y, 9 + R() * 6, 5, '#f1f0e8', '#e8d58a'); } });
  cell(1, () => { blades(6, 60, ['#4c6631']); for (let i = 0; i < 7; i++) { const x = 26 + R() * 76, y = 30 + R() * 50; stem(x, y + 3, x, 122, 1.4, '#566f3c'); blossom(x, y, 7 + R() * 5, 6, '#f0dfe6', '#d9b8c6'); } });
  cell(2, () => blades(26, 110, ['#3e5a2a', '#56753a', '#6b8846', '#48652f']));
  cell(3, () => { for (let i = 0; i < 260; i++) { const a = R() * Math.PI, r = Math.sqrt(R()) * 50; const x = 64 + Math.cos(a) * r * 1.15, y = 124 - Math.sin(a) * r * .62; const lit = (124 - y) / 34; g.fillStyle = `rgba(${Math.round(52 + 50 * lit + R() * 20)},${Math.round(78 + 52 * lit + R() * 22)},${Math.round(36 + 22 * lit)},${0.8 + R() * 0.2})`; g.beginPath(); g.arc(x, y, 1.8 + R() * 3.6, 0, Math.PI * 2); g.fill(); } });
  cell(4, () => { for (let i = 0; i < 22; i++) { const x = 8 + R() * 112, len = 40 + R() * 80; g.strokeStyle = ['#3f5c2a', '#52703a', '#62803f'][i % 3]; g.lineWidth = 2 + R() * 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (R() - .5) * 12, len * .4, x + (R() - .5) * 18, len * .7, x + (R() - .5) * 10, len); g.stroke(); } g.fillStyle = '#4b6930'; g.fillRect(0, 0, 128, 8); });
  cell(5, () => { for (let f = 0; f < 5; f++) { const a = -Math.PI / 2 + (f - 2) * .42, len = 70 + R() * 30; for (let s = 0; s < 14; s++) { const t = s / 14, x = 64 + Math.cos(a) * len * t, y = 124 + Math.sin(a) * len * t, w = (1 - t) * 13 + 2; g.strokeStyle = '#4d6b31'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w, y + 2); g.lineTo(x + w, y - 2); g.stroke(); } } });
  cell(6, () => { blades(5, 64, ['#4f6b33']); for (let i = 0; i < 5; i++) { const x = 30 + R() * 66, y = 34 + R() * 40; stem(x, y, x + (R() - .5) * 8, 124, 1.5, '#55703a'); for (let b = 0; b < 3; b++) { g.fillStyle = '#eef0ea'; g.beginPath(); g.ellipse(x + (b - 1) * 7, y + b * 6, 4.2, 5.6, 0, 0, Math.PI * 2); g.fill(); } } });
  cell(7, () => { blades(10, 96, ['#6a7a44', '#7e8a52', '#56703a']); for (let i = 0; i < 8; i++) { const x = 20 + R() * 88, y = 20 + R() * 40; g.fillStyle = '#d9d7c4'; g.beginPath(); g.ellipse(x, y, 3.5, 8, (R() - .5) * .6, 0, Math.PI * 2); g.fill(); } });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 2;
  return t;
}
/* UNDER WATER: the same 4 × 2 cells, the sea's own plants (the placement code keeps its cell numbers):
   0 soft coral fingers · 1 anemone · 2 kelp ribbons · 3 algae cushion · 4 hanging algae · 5 sea fan · 6 white polyps · 7 tube sponges */
function seaAtlas(seed = 9) {
  const C = 128, cv = document.createElement('canvas'); cv.width = C * 4; cv.height = C * 2;
  const g = cv.getContext('2d'), R = rng(seed);
  const cell = (i, f) => { g.save(); g.translate((i % 4) * C, Math.floor(i / 4) * C); g.beginPath(); g.rect(0, 0, C, C); g.clip(); f(); g.restore(); };
  const finger = (x0, y0, x1, y1, w, col, tip) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + (R() - .5) * 8, (y0 + y1) / 2, x1, y1); g.stroke();
    if (tip) { g.fillStyle = tip; g.beginPath(); g.arc(x1, y1, w * 0.42, 0, Math.PI * 2); g.fill(); }
  };
  const ribbon = (x, h, w, col, sway) => {   /* a kelp blade: a wavy band that thins toward the tip */
    g.fillStyle = col; g.beginPath();
    const n = 18, pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, y = 128 - t * h, cx = x + Math.sin(t * 5.2 + sway) * 7 * t + sway * 6 * t * t, ww = w * (1 - t * 0.75) * (0.8 + 0.2 * Math.sin(t * 13 + sway)); pts.push([cx, y, ww]); }
    g.moveTo(pts[0][0] - pts[0][2], pts[0][1]); for (const p of pts) g.lineTo(p[0] - p[2], p[1]);
    for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0] + pts[i][2], pts[i][1]); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(210,220,150,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke();
  };
  const fan = (x, y, a, len, w, depth, col) => {   /* a sea fan: branching, thinner each fork */
    if (depth <= 0 || len < 3) return;
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
    fan(x1, y1, a - 0.32 - R() * 0.2, len * (0.74 + R() * 0.1), w * 0.72, depth - 1, col);
    fan(x1, y1, a + 0.3 + R() * 0.2, len * (0.72 + R() * 0.1), w * 0.72, depth - 1, col);
  };
  cell(0, () => { for (let i = 0; i < 14; i++) { const x0 = 64 + (R() - .5) * 30, a = -Math.PI / 2 + (R() - .5) * 1.5, l = 40 + R() * 55; finger(x0, 126, x0 + Math.cos(a) * l, 126 + Math.sin(a) * l, 9 + R() * 6, ['#e0906c', '#eba07a', '#d9836a'][i % 3], '#f7cdb2'); } });
  cell(1, () => { g.fillStyle = '#8f5f7a'; g.beginPath(); g.ellipse(64, 122, 22, 9, 0, 0, Math.PI * 2); g.fill(); for (let i = 0; i < 34; i++) { const a = -Math.PI / 2 + (R() - .5) * 2.4, l = 34 + R() * 50, x0 = 64 + (R() - .5) * 30; finger(x0, 118, x0 + Math.cos(a) * l, 118 + Math.sin(a) * l * 0.9, 2.6 + R() * 1.6, ['#d6a3c6', '#c792b8', '#e4b7d2'][i % 3], '#f6e3ee'); } });
  cell(2, () => { for (let i = 0; i < 6; i++) ribbon(26 + i * 15 + (R() - .5) * 8, 80 + R() * 46, 4 + R() * 3, ['#5d7a3c', '#6f8a45', '#4d6e48', '#7b8f4a'][i % 4], (R() - .5) * 2); });
  cell(3, () => { for (let i = 0; i < 240; i++) { const a = R() * Math.PI, r = Math.sqrt(R()) * 50; const x = 64 + Math.cos(a) * r * 1.15, y = 124 - Math.sin(a) * r * .62; const lit = (124 - y) / 34; g.fillStyle = `rgba(${Math.round(58 + 40 * lit + R() * 18)},${Math.round(92 + 46 * lit + R() * 20)},${Math.round(70 + 30 * lit)},${0.8 + R() * 0.2})`; g.beginPath(); g.arc(x, y, 2 + R() * 4, 0, Math.PI * 2); g.fill(); } });
  cell(4, () => { for (let i = 0; i < 20; i++) { const x = 8 + R() * 112, len = 40 + R() * 84; g.strokeStyle = ['#5a6a34', '#6b7a3c', '#4f6440'][i % 3]; g.lineWidth = 1.6 + R() * 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (R() - .5) * 16, len * .4, x + (R() - .5) * 22, len * .7, x + (R() - .5) * 14, len); g.stroke(); } g.fillStyle = '#56683a'; g.fillRect(0, 0, 128, 6); });
  cell(5, () => { for (let k = 0; k < 3; k++) fan(64 + (k - 1) * 10, 127, -Math.PI / 2 + (k - 1) * 0.35, 30, 4.2, 6, ['#d29a4c', '#c98a42', '#dcae62'][k]); });
  cell(6, () => { for (let i = 0; i < 16; i++) { const x = 18 + R() * 92, h = 30 + R() * 60; finger(x, 127, x + (R() - .5) * 14, 127 - h, 2.4, '#c9d4cc', null); g.fillStyle = '#f2f4ee'; g.beginPath(); g.arc(x + (R() - .5) * 2, 127 - h, 4 + R() * 3, 0, Math.PI * 2); g.fill(); } });
  cell(7, () => { for (let i = 0; i < 6; i++) { const x = 22 + i * 16 + (R() - .5) * 6, h = 50 + R() * 66, w = 9 + R() * 5; g.fillStyle = ['#c98a3e', '#d79a4c', '#b97a38'][i % 3]; g.beginPath(); g.moveTo(x - w * 0.8, 128); g.lineTo(x - w, 128 - h); g.lineTo(x + w, 128 - h); g.lineTo(x + w * 0.8, 128); g.closePath(); g.fill(); g.fillStyle = '#5a3a20'; g.beginPath(); g.ellipse(x, 128 - h, w, 3.2, 0, 0, Math.PI * 2); g.fill(); } });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 2;
  return t;
}

/* ------------------------------------------------------------------ the scene */
export function createGorge(opts = {}) {
  const canvas = opts.canvas, T = opts.tune || {}, texTier = opts.texTier || window.__FLOW2_TEX_TIER__;   /* opts.texTier: the rise page's own underwater tier (?uwq=); other pages: the page's tier as before */
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, stencil: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.autoClear = false; renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  const gl = renderer.getContext();
  const info = { tris: 0, slabs: 0, plants: 0, layers: [], lens: 'none', aa: false };

  const camera = new THREE.PerspectiveCamera(34, 2, 0.1, 220);
  const scene = new THREE.Scene();
  const base = 'prototypes/index1-5-flow/assets/baked/';
  const url = (name, full) => texTier && texTier.url ? texTier.url(base + name, full) : base + name + '-' + full + '.webp';
  const loader = new THREE.TextureLoader();
  const load = (u, srgb) => new Promise(res => loader.load(u, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; res(t); }, undefined, () => res(null)));
  const UW = opts.uw ?? (UW_DEFAULT && !opts.phone), DEF = UW ? '#define UW 1\n' : '';
  const FAR_ON = UW && !UW3D && /^(real|mix|bake)$/.test(UWQ.get('far') || '') && UWQ.get('uwLane') !== '1';   /* UW-BUILD: the far layer (desktop, the descent). 2026-11-18 client: 「不要加影片好了 比較豐富但不搭」 → opt-in (?far=real|mix|bake); default = 3D only */
  const CM = UW ? (FAR_ON ? '#define FAR 1\n' : '') + COMMON_UW : COMMON;
  const NEAR2 = UW && !UW3D && UWQ.get('uwNear') === '1';   /* 2026-11-18 lead: opt-in — the client saw flat black slabs on the walls at −26 / −38 m (「破格」), they come from these near refinements; ?uwNear=1 = on */
  /* UWTEX (2026-11-18, client 「還是用弄3D貼材質 現在就是材質產生不好」): ONE material sample — ?uwtex=2 swaps the reef kit to assets/reef3/
     (underwater reef rock painted into the same atlases, CC0) and lights it from above (caustics down the walls, a top light, clearer near
     water). Default (no ?uwtex) = today, untouched. Dials: panel U rows 「材質樣本」, or ?uwtexCaus= / ?uwtexClear= / ?uwtexTop= */
  /* BUBBLE-HERO (2026-11-18, opt-in): opts.hero = { uwtex: 2, life: 0..1, kelp: false, sponge: false, rich: false, panel: false } — the bubble page's thinned underwater world; without opts.hero nothing below changes */
  const HERO = UW && opts.hero ? opts.hero : null;
  const OCEAN = UW && !UW3D && !HERO && !!OC;   /* OCEAN: canyon-forest only (the bubble page passes opts.hero) */
  const riseWaterline = OCEAN && opts.riseWaterline === true;
  const riseDefine = riseWaterline ? '#define RISE_WATERLINE 1\n' : '';
  /* OCEAN pass 7 (client 11-18: 「岩石我覺得不行 … 你拿山來延伸它的底部也可以」): the gorge's rock under water is the canyon mountains themselves, going on down —
     the cliffs' own photograph and relief map, their strata, the same scale (placeMountains). ?ocReef=3 = the 礁石3 scan (pass 6, CC-BY, credited only then) · ?ocReef=2 = the reef2 kit */
  const OCKIT = !OCEAN ? '' : UWQ.get('ocReef') === '3' ? 'reef3' : UWQ.get('ocReef') === '2' ? 'reef2' : 'mtn', REEF3 = OCKIT === 'reef3', MTN = OCKIT === 'mtn';
  const NOLIFE = OCEAN && UWQ.get('ocLife') !== '1';   /* OCEAN pass 5 (client 11-18: 「魚跟水草都拿掉」): no fish, ray, plants, kelp, sponges, corals — never loaded, never built (?ocLife=1 = with them) */
  const UWTEX = UW && !UW3D && (UWQ.get('uwtex') === '2' || !!(HERO && HERO.uwtex === 2));   /* independent of NEAR2 (lead 11-18: NEAR2 now opt-in) */
  const UWTXU = { caus: { value: uwNum('uwtexCaus', 1) }, clear: { value: uwNum('uwtexClear', 1) }, top: { value: uwNum('uwtexTop', 1) } };   /* UWTEX */
  /* UW-BUILD: with the far layer and the seas-style beats (phase 7: no drop under water) the gorge never draws a drop — not even in DIVE's
     warm-up — so the copy target B is never allocated (−10.4 MB); ?sea=0 / ?dive=old / ?values=1 bring the drop back */
  const NODROP = FAR_ON && UWQ.get('sea') !== '0' && UWQ.get('dive') !== 'old' && UWQ.get('values') !== '1';
  const LIFE_HALF = FAR_ON && UWQ.get('farLife') !== '0';   /* UW-BUILD: fish / 3D coral maps 512 → 256 (VRAM for the video decoders) */   /* UW-BUILD: the near layer's refinements (?uwNear=0 = off; ?uw=3d = today) */   /* desktop only this round (phones: today's look) */
  const RIVER = UWQ.get('uwGrade') !== '0' && !OCEAN;   /* PHASE 5: the river's palette under water (?uwGrade=0 = phase 4's teal) */
  if (UW) document.documentElement.setAttribute('data-xs-uw', ''); else document.documentElement.removeAttribute('data-xs-uw');
  info.uw = UW;
  const causticTarget = riseWaterline ? OC.bakeRiseCaustics(THREE, renderer) : null;
  const tCaus = causticTarget ? causticTarget.texture : causticTexture();
  const tNoise = noiseTexture(), tAtlas = UW ? seaAtlas() : plantAtlas();

  /* the shared uniforms (one object each, spread into every material) */
  const C = {
    uRes: { value: new THREE.Vector2(1, 1) }, uCamY: { value: 0 }, uSurf: { value: 1.2 }, uGlow: { value: 1 }, uDeep: { value: 0 }, uShafts: { value: 1 }, uTime: { value: 0 },
    uBgTop: { value: hex(T.bgTop || '#86a0b5') }, uBgMid: { value: hex(T.bgMid || '#64819a') }, uBgLow: { value: hex(T.bgLow || '#4a657c') }, uBgGlow: { value: hex(T.bgGlow || '#d6e4ee') },
    tNoise: { value: tNoise }, uBgGain: { value: 1 }, uBoostA: { value: new THREE.Vector4(-1, -1, -1, -1) }, uBoostB: { value: new THREE.Vector4(-1, -1, -1, -1) }, uBoost: { value: 0.55 }
  };
  if (FAR_ON) Object.assign(C, { tFarA: { value: tNoise }, tFarB: { value: tNoise }, uFarA: { value: new THREE.Vector4(0.67, 0.38, 0, 0) }, uFarB: { value: new THREE.Vector4(0.67, 0.38, 0, 0) },
    uFarGA: { value: new THREE.Vector4(0.07, 1, 0, 0) }, uFarGB: { value: new THREE.Vector4(0.07, 1, 0, 0) }, uFarScr: { value: new THREE.Vector2(0.62, 0.31) }, uFarK: { value: uwNum('farK', 1) },
    uFarWhite: { value: hex('#e8f1f6') }, uFarLum: { value: 0.03 } });
  const L = {
    uKeyDir: { value: new THREE.Vector3(-0.32, 0.86, 0.4).normalize() }, uKeyCol: { value: hex('#e6eef3').multiplyScalar(1.25) },
    uSky: { value: hex('#9fb6c8').multiplyScalar(0.62) }, uGround: { value: hex('#2a333b').multiplyScalar(0.5) },
    uRockTint: { value: hex('#9aa3a8') }, uMossTint: { value: hex('#a9c47e') }, uCaus: { value: 0.55 }, tCaus: { value: tCaus }
  };
  /* UNDER WATER: our blue (the canyon river's teal at the surface → the navy of the deep), light through the surface (pale aqua, red absorbed) */
  const UWT = { fogK: 0.046 * uwNum('uwFog', 1) };
  if (UW) {
    /* PHASE 5 (client 「風格現在跟一開始河道有些不同」): the water is the canyon river's own navy / slate blue (measured on this page:
       river #26384e…#405470, far water #5f728b, sky #6a84a5…#798dab), not a reef teal; ?uwGrade=0 = phase 4's teal */
    C.uBgTop.value = hex(T.uwTop || (RIVER ? '#5d7a9c' : '#3f93a8')); C.uBgMid.value = hex(T.uwMid || (RIVER ? '#314f6f' : '#1b6683')); C.uBgLow.value = hex(T.uwLow || (RIVER ? '#142a40' : '#0c3352')); C.uBgGlow.value = hex(T.uwGlow || (RIVER ? '#d2e1ec' : '#c4ecf2'));
    C.uAbyss = { value: hex(T.uwAbyss || (RIVER ? '#0a1727' : '#06203a')) };
    L.uKeyDir.value.set(-0.14, 0.9, 0.38).normalize();   /* phase 4: the light from overhead, both walls of the gorge lit alike */
    L.uKeyCol.value = hex(RIVER ? '#dde7ee' : '#cdeef2').multiplyScalar(1.12); L.uSky.value = hex(RIVER ? '#7d97b2' : '#5ea7ba').multiplyScalar(0.62); L.uGround.value = hex(RIVER ? '#17222f' : '#0d2a3e').multiplyScalar(0.55);
    L.uRockTint.value = hex('#8da3aa'); L.uMossTint.value = hex('#93ae84'); L.uCaus.value = 0.95 * uwNum('uwCaus', 1);
  }
  const OCU = OCEAN ? OC.makeUniforms(THREE, tNoise) : null;   /* OCEAN */
  const OCX = { veilA: uwNum('ocVeilA', -8), veilB: uwNum('ocVeilB', -14), open: Math.min(1, uwNum('ocOpen', 1)),   /* pass 7: with the mountain walls the water is NOT kept open near the surface — the mountains' feet show right under the line (client: 「對照兩邊山的延伸底部」); ?ocOpen=1 = the open-water veil */ bub: uwNum('uwBub', 1), sunX: uwNum('ocSunX', 0.49), hotX: OCU ? OCU.uOcRay.value.x : 0, rays: OCU ? OCU.uOcRay.value.z : 0, glow: OCU ? OCU.uOcRay.value.w : 0, glint: OCU ? OCU.uOcB.value.x : 0 };   /* OCEAN: open water near the surface (0 = the walls from the start) */
  const oceanPalette = OCEAN ? (riseWaterline ? OC.RISE_PALETTE : OC.PALETTE) : null;
  if (OCEAN) { const P = oceanPalette;
    C.uBgTop.value = hex(P.top); C.uBgMid.value = hex(P.mid); C.uBgLow.value = hex(P.low); C.uBgGlow.value = hex(P.glow); C.uAbyss.value = hex(P.abyss);
    L.uKeyCol.value = hex(P.key).multiplyScalar(1.12); L.uSky.value = hex(P.sky).multiplyScalar(0.62); L.uGround.value = hex(P.ground).multiplyScalar(0.55);
    L.uRockTint.value = hex(P.rockTint); L.uMossTint.value = hex(P.mossTint); OCU.uOcDeep.value.set(P.deep); info.ocean = OC.VERSION; }
  const riseLighting = riseWaterline ? OC.createRiseLighting(THREE, OCX, L.uKeyDir,
    { uBgMid: C.uBgMid, uBgLow: C.uBgLow, uBgGain: C.uBgGain, uRockTint: L.uRockTint }, MTN && UWQ.get('uwLane') !== '1') : null;
  /* the live dials (uniform objects; scene().uw.ceil.value = 1.3 …) */
  const UWU = {
    ceil: { value: uwNum('uwCeil', 1) }, ceilK: { value: 0.034 }, surfY: { value: 0 }, rays: { value: 0.3 * uwNum('uwRays', 1) },
    tilt: { value: 0 }, camZ: { value: 0 }, rayK: { value: 1 }, wet: { value: uwNum('uwWet', 0.5) }, aoK: { value: uwNum('uwAO', 1.7) }, bubbles: { value: uwNum('uwBub', 1) }, snow: { value: uwNum('uwSnow', 1) }, floor: { value: uwNum('uwFloor', 1) }, caus: L.uCaus,
    camPos: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3(1, 0, 0) }, camU: { value: new THREE.Vector3(0, 1, 0) }, camF: { value: new THREE.Vector3(0, 0, -1) }, tanH: { value: 0.3 }
  };
  const riseSun = { value: new THREE.Vector3(-0.606, 0.384, -0.697).normalize() };
  const riseOptics = { value: new THREE.Vector2(1, 0) }; // shallow exposure, vertical lens shift
  const baseSnow = UWU.snow.value;
  const naturalFov = () => camera.aspect < 1 ? (T.fovPhone ?? 44) : (T.fov ?? 34);

  /* ---- the ground: one full-screen triangle, drawn first */
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  /* UNDER WATER: the surface overhead, the plane y = uSurfY seen from below (total internal reflection outside Snell's window: the underside
     mirrors the water, and the ripples' steep slopes let the sky through as bright bands, stretched by the grazing angle) */
  const ceilFS = /* glsl */`
    uniform sampler2D tCaus; uniform vec3 uCamPos, uCamR, uCamU, uCamF; uniform float uTanH, uSurfY, uCeil, uCeilK, uTiltC;
    void main(){
      vec2 fc = gl_FragCoord.xy; vec3 base = bgAt(fc);
      vec2 ndc = fc / uRes * 2.0 - 1.0; float asp = uRes.x / uRes.y;
      vec3 rd = normalize(uCamF + uCamR * (ndc.x * uTanH * asp) + uCamU * (ndc.y * uTanH));
      float h = max(uSurfY - uCamPos.y, 0.6), up = max(rd.y, 0.004), t = h / up;
      vec2 p = uCamPos.xz + rd.xz * t;
      /* small ripple cells (≈ 0.5 m), drawn out sideways; where the two nets cross, the bright fragments (far off, the mips melt them into a sheen) */
      float r1 = texture2D(tCaus, p * vec2(0.13, 0.3) + vec2(uTime * 0.018, uTime * 0.007), 0.8).r;
      float r2 = texture2D(tCaus, p * vec2(0.1, 0.24) + vec2(-uTime * 0.013, uTime * 0.016) + 0.37, 0.8).r;
      float glint = smoothstep(0.1, 0.9, r1 * r2 * 1.5 + max(r1, r2) * 0.2) * 0.8 * (1.0 - 0.5 * uTiltC);   /* looking up: a glowing sheet, the net calmer */
      float lit = exp(-t * uCeilK) * smoothstep(0.004, 0.07, rd.y) * uCeil;
      vec3 sheet = base * 1.3 + uBgGlow * (0.04 + glint * 0.75);
      vec3 col = mix(base, sheet, lit);
      gl_FragColor = vec4(toSRGB(col), 1.0);
    }`;
  const bgMat = new THREE.ShaderMaterial({ uniforms: UW ? { ...C, tCaus: { value: tCaus }, uCamPos: UWU.camPos, uCamR: UWU.camR, uCamU: UWU.camU, uCamF: UWU.camF, uTanH: UWU.tanH, uSurfY: UWU.surfY, uCeil: UWU.ceil, uCeilK: UWU.ceilK, uTiltC: UWU.tilt, ...(OCEAN ? { ...OCU, uOcOver: { value: 1 } } : {}), ...(riseWaterline ? { ...riseLighting.uniforms, uRiseOptics: riseOptics } : {}) } : { ...C },
    depthTest: riseWaterline, depthWrite: riseWaterline, depthFunc: THREE.LessEqualDepth,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: UW ? CM + (riseWaterline ? OC.riseCeilFS : OCEAN ? OC.ceilFS : ceilFS) : COMMON + 'void main(){ gl_FragColor = vec4(toSRGB(bgAt(gl_FragCoord.xy)), 1.0); }' });
  if (riseWaterline) bgMat.uniforms.uRiseClip = { value: new THREE.Vector2(camera.near, camera.far) };
  const bg = new THREE.Mesh(tri, bgMat); bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);
  /* OCEAN: the open-water veil — the ground pass once more OVER the gorge (under the mist, specks and bubbles), its opacity set per frame */
  const ocVeil = OCEAN ? new THREE.Mesh(tri, new THREE.ShaderMaterial({ uniforms: { ...bgMat.uniforms, uOcOver: { value: 0 } }, depthTest: false, depthWrite: false, transparent: true,
    vertexShader: bgMat.vertexShader, fragmentShader: bgMat.fragmentShader })) : null;
  if (ocVeil) { ocVeil.frustumCulled = false; ocVeil.renderOrder = 19; ocVeil.visible = false; scene.add(ocVeil); }

  /* ---- rocks: the sculpted slabs (dg-rocks-worker.js), triplanar slate in the slab's own space (the texture stays on the stone) */
  const rockVS = /* glsl */`
    attribute float aAO; attribute float aCrack; attribute float aMoss;
    varying vec3 vO; varying vec3 vON; varying vec3 vW; varying vec3 vN; varying float vAO; varying float vCrack; varying float vMoss; varying float vDist;
    varying vec3 vR0; varying vec3 vR1; varying vec3 vR2;
    void main(){ vO = position; vON = normal; vR0 = normalize(modelMatrix[0].xyz); vR1 = normalize(modelMatrix[1].xyz); vR2 = normalize(modelMatrix[2].xyz); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
      vAO = aAO; vCrack = aCrack; vMoss = aMoss; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const rockFS = DEF + CM + /* glsl */`
    uniform sampler2D tRock, tNorm, tMoss, tCaus; uniform float uTexScale, uLayerFog, uFogK, uFogStart, uMoss, uNormK, uCaus, uBright, uSoft, uSeed;
    uniform vec3 uKeyDir, uKeyCol, uSky, uGround, uRockTint, uMossTint, uPale;
    varying vec3 vO; varying vec3 vON; varying vec3 vW; varying vec3 vN; varying float vAO; varying float vCrack; varying float vMoss; varying float vDist;
    varying vec3 vR0; varying vec3 vR1; varying vec3 vR2;
    vec3 tri(sampler2D t, vec2 a, vec2 b, vec2 c, vec3 w){ return texture2D(t, a, uSoft).rgb * w.x + texture2D(t, b, uSoft).rgb * w.y + texture2D(t, c, uSoft).rgb * w.z; }
    void main(){
      vec3 N0 = normalize(vON);
      vec3 bw = pow(abs(N0), vec3(4.0)); bw /= dot(bw, vec3(1.0));
      vec3 o = vO * uTexScale + uSeed;
      vec2 ux = o.zy, uy = o.xz, uz = o.xy;
      vec3 rock = tri(tRock, ux, uy, uz, bw);
      /* whiteout blend of three tangent-space normals, in the slab's space */
      vec3 tX = texture2D(tNorm, ux * 0.8, uSoft).xyz * 2.0 - 1.0, tY = texture2D(tNorm, uy * 0.8, uSoft).xyz * 2.0 - 1.0, tZ = texture2D(tNorm, uz * 0.8, uSoft).xyz * 2.0 - 1.0;
      tX.xy *= uNormK; tY.xy *= uNormK; tZ.xy *= uNormK;
      tX = vec3(tX.xy + N0.zy, abs(tX.z) * N0.x); tY = vec3(tY.xy + N0.xz, abs(tY.z) * N0.y); tZ = vec3(tZ.xy + N0.xy, abs(tZ.z) * N0.z);
      vec3 nO = normalize(tX.zyx * bw.x + tY.xzy * bw.y + tZ.xyz * bw.z);
      vec3 nn = normalize(mat3(vR0, vR1, vR2) * nO), ng = normalize(vN);
      float lum = dot(rock, vec3(0.3, 0.55, 0.15));
      /* weathered: pale where it faces up, dark in the cracks, moss in cushions on the tops and in the cracks there */
      float top = smoothstep(0.3, 0.85, ng.y);
      float moss = smoothstep(0.22, 0.62, vMoss + (lum - 0.3) * 0.4) * uMoss;
      vec3 mossC = texture2D(tMoss, vW.xz * 0.9 / uTexScale * 0.35 + uSeed, uSoft).rgb * uMossTint;
      vec3 alb = rock * uRockTint * uBright;
      alb = mix(alb, uPale * (0.75 + 0.6 * lum), top * 0.55);
      alb *= mix(1.0, 0.3, smoothstep(0.35, 0.95, vCrack) * (1.0 - moss * 0.6));
      alb = mix(alb, mossC * (0.85 + 0.3 * lum), moss);
      /* light: from the surface above (soft, cool), the water around, a faint wet sheen, frozen caustics on what faces up, the mist behind the rim */
      vec3 V = normalize(cameraPosition - vW), Lk = normalize(uKeyDir);
      float ndl = dot(nn, Lk), diff = max(ndl, 0.0) * 0.78 + clamp((ndl + 0.4) / 1.4, 0.0, 1.0) * 0.22;
      vec3 hemi = mix(uGround, uSky, clamp(nn.y * 0.5 + 0.5, 0.0, 1.0));
      float ao = vAO;
      vec3 col = alb * (hemi * mix(0.35, 1.0, ao) + uKeyCol * diff * mix(0.3, 1.0, ao));
      col += uKeyCol * pow(max(dot(nn, normalize(Lk + V)), 0.0), 40.0) * 0.12 * (1.0 - moss) * ao;
#ifdef UW
      /* moving caustics: strongest on what faces up, a little on the walls (the light comes down through the ripples) */
      float caus = causMove(tCaus, vW.xz * 0.23 + vec2(vW.y * 0.05, 0.0), 1.0) * 1.5;
      col += uKeyCol * caus * caus * uCaus * mix(0.18, 1.0, top) * ao * 0.5 * smoothstep(-30.0, 0.0, vW.y);
#else
      float caus = texture2D(tCaus, vW.xz * 0.23 + vec2(vW.y * 0.05, 0.0)).r;
      col += uKeyCol * caus * caus * uCaus * top * ao * 0.4 * smoothstep(-26.0, 0.0, vW.y);
#endif
      vec3 bg = bgAt(gl_FragCoord.xy);
      col += bg * pow(1.0 - max(dot(ng, V), 0.0), 3.0) * 0.35 * ao;
      /* haze toward the water's own colour behind it (+ a little more behind the texts) */
      float f = max(1.0 - exp(-max(vDist - uFogStart, 0.0) * uFogK), uLayerFog);
      f = f + (1.0 - f) * boostAt(gl_FragCoord.xy) * mix(0.5, 1.0, smoothstep(5.0, 9.0, vDist));
      col = mix(col, bg, clamp(f, 0.0, 1.0));
      gl_FragColor = vec4(toSRGB(col), 1.0);
    }`;
  const rockMats = [];
  const makeRockMat = (layer, tex) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { ...C, ...L, tRock: { value: tex.rock }, tNorm: { value: tex.norm }, tMoss: { value: tex.moss },
        uTexScale: { value: layer.texScale }, uLayerFog: { value: layer.fogMin }, uFogK: { value: UW ? UWT.fogK : (T.fogK ?? 0.034) }, uFogStart: { value: UW ? 0.5 : 3 },
        uMoss: { value: layer.moss ?? 1 }, uNormK: { value: layer.normK ?? 1.0 }, uBright: { value: layer.bright ?? 1 }, uSoft: { value: layer.soft ?? 0 }, uSeed: { value: layer.seed ?? 0 },
        uPale: { value: hex('#b4b9b6') } },
      vertexShader: rockVS, fragmentShader: rockFS
    });
    rockMats.push(m); return m;
  };

  /* ---- plants: camera-facing quads on the slabs, one instanced draw (breeze on time: the only motion of their own) */
  const plantVS = DEF + /* glsl */`
    attribute vec3 iPos; attribute vec4 iData;   /* x size, y aspect (h/w), z cell, w phase */
    attribute float iHang;
    uniform float uTime, uWind;
    varying vec2 vUv; varying float vDist; varying float vY;
    void main(){
      vec2 c = position.xy;   /* x -0.5..0.5, y 0..1 */
      float h = iData.x, w = iData.x / max(iData.y, 0.2);
      vec4 mv = viewMatrix * vec4(iPos, 1.0);
#ifdef UW
      /* in the current: slow, wide, a wave running through the bed (the phase follows the position) */
      float sway = sin(uTime * 0.62 + iData.w * 6.283 + iPos.z * 0.15 + iPos.x * 0.05) * 0.75 + sin(uTime * 1.07 + iData.w * 17.0) * 0.25;
#else
      float sway = sin(uTime * 1.3 + iData.w * 6.283) * 0.6 + sin(uTime * 2.1 + iData.w * 17.0) * 0.4;
#endif
      float up = iHang > 0.5 ? -1.0 : 1.0;
      mv.x += c.x * w + sway * uWind * h * c.y * c.y * (iHang > 0.5 ? 0.35 : 1.0);
      mv.y += up * c.y * h;
      vDist = -mv.z; vY = c.y;
      float cell = iData.z, col = mod(cell, 4.0), row = floor(cell / 4.0);   /* row 0 = the canvas's top row (flipY: v = 1 at the top) */
      float lx = c.x + 0.5, ly = iHang > 0.5 ? 1.0 - c.y : c.y;
      vUv = vec2((col + lx * 0.98 + 0.01) / 4.0, 1.0 - (row + 1.0) / 2.0 + (ly * 0.98 + 0.01) / 2.0);
      gl_Position = projectionMatrix * mv; }`;
  const plantFS = DEF + CM + /* glsl */`
    uniform sampler2D tAtlas; uniform vec3 uKeyCol, uSky, uGround; uniform float uFogK;
    varying vec2 vUv; varying float vDist; varying float vY;
    void main(){
      vec4 t = texture2D(tAtlas, vUv);
      if (t.a < 0.08) discard;
#ifdef UW
      if (dot(t.rgb, vec3(0.3, 0.59, 0.11)) < 0.075) discard;   /* the scans' dark soil and driftwood: gone, the plant stands on the sand */
      t.a *= smoothstep(0.0, 0.06, vY);
      t.rgb = mix(vec3(dot(t.rgb, vec3(0.3, 0.59, 0.11))), t.rgb, 0.62) * vec3(0.8, 0.95, 1.0);   /* the aquarium's lime, cooled by the water */
#endif
      vec3 col = t.rgb * (mix(uGround, uSky, 0.4 + 0.6 * vY) * 1.1 + uKeyCol * (0.45 + 0.35 * vY));
      float f = 1.0 - exp(-max(vDist - 3.0, 0.0) * uFogK);
#ifdef UWVEIL
      f = f + (1.0 - f) * boostAt(gl_FragCoord.xy) * 0.3 * smoothstep(5.0, 9.0, vDist);   /* UWTEX: the texts' legibility veil at half, so the wall behind the text keeps its form and life */
#else
      f = f + (1.0 - f) * boostAt(gl_FragCoord.xy) * smoothstep(5.0, 9.0, vDist);
#endif
      gFar = smoothstep(0.04, 0.72, f); col = mix(col, bgAt(gl_FragCoord.xy), clamp(f, 0.0, 1.0));
      gl_FragColor = vec4(toSRGB(col), t.a);
    }`;
  let plants2 = null, plants2OK = false, lifeExtra = null;
  const plantMat = new THREE.ShaderMaterial({ defines: UWTEX ? { UWVEIL: 1 } : {}, uniforms: { ...C, ...L, tAtlas: { value: tAtlas }, uWind: { value: 0.06 }, uFogK: { value: UW ? UWT.fogK : (T.fogK ?? 0.036) } },
    vertexShader: plantVS, fragmentShader: plantFS, transparent: false, alphaToCoverage: true, side: THREE.DoubleSide });
  const plantMat2 = new THREE.ShaderMaterial({ defines: UWTEX ? { UWVEIL: 1 } : {}, uniforms: { ...plantMat.uniforms, tAtlas: { value: tAtlas } }, vertexShader: plantVS, fragmentShader: plantFS, alphaToCoverage: true, side: THREE.DoubleSide });   /* AD-LIFE's plants atlas */

  /* ---- mist sheets: three soft veils between the layers, fixed in the water (they slide with the descent) */
  const mistVS = 'varying vec2 vUv; varying float vDist; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }';
  const mistFS = CM + /* glsl */`
    uniform float uAlpha, uSeed; uniform vec2 uScale; varying vec2 vUv; varying float vDist;
    void main(){
      float n = texture2D(tNoise, vUv * uScale + uSeed).r, n2 = texture2D(tNoise, vUv * uScale * 2.7 + uSeed * 3.1).r;
      float a = smoothstep(0.38, 0.85, n * 0.75 + n2 * 0.35) * uAlpha;
      a *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x);
      vec3 col = bgAt(gl_FragCoord.xy) * 1.04 + vec3(0.012);
      gl_FragColor = vec4(toSRGB(col) * a, a);
    }`;
  const mists = [];

  /* ---- suspended specks (points, fixed in the water) */
  const speckMat = new THREE.ShaderMaterial({ uniforms: { ...C, uPx: { value: 1 } }, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: 'uniform float uPx, uTime; attribute float aS; varying float vA; void main(){ vec3 p = position; p.y += sin(uTime * 0.07 + aS * 9.0) * 0.35; p.x += sin(uTime * 0.05 + aS * 13.0) * 0.2; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z; gl_PointSize = max(1.0, aS * uPx * 26.0 / d); vA = clamp(0.55 * exp(-d * 0.045) * aS, 0.0, 0.5); }',
    fragmentShader: 'varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(p)) * vA; gl_FragColor = vec4(vec3(0.93, 0.96, 1.0) * a, a); }' });
  let specks = null;
  if (UW) {
    /* marine snow: the same specks, more of them, drifting wider and slower in a faint current, a pale aqua */
    speckMat.uniforms.uSnow = UWU.snow; speckMat.uniforms.uCamZ = UWU.camZ;
    speckMat.vertexShader = 'uniform float uPx, uTime, uSnow, uCamZ, uCamY; attribute float aS; varying float vA; void main(){ vec3 p = position; p.z = uCamZ - 2.0 - mod(uCamZ - 2.0 - p.z, 34.0); p.y = uCamY - 7.0 + mod(p.y - uCamY + 7.0, 15.0); p.y += sin(uTime * 0.045 + aS * 9.0) * 0.7 - sin(uTime * 0.021 + aS * 4.0) * 0.5; p.x += sin(uTime * 0.035 + aS * 13.0) * 0.6 + sin(uTime * 0.06 + aS * 21.0) * 0.12; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z; gl_PointSize = max(1.0, aS * uPx * 22.0 / d); vA = clamp(0.62 * exp(-d * 0.05) * aS, 0.0, 0.5) * uSnow; }';
    if (OCEAN) speckMat.vertexShader = speckMat.vertexShader.replace('mod(p.y - uCamY + 7.0, 15.0)', 'mod(p.y + uTime * 0.045 - uCamY + 7.0, 15.0)').replace('aS * uPx * 22.0 / d', 'aS * uPx * 38.0 / d');   /* OCEAN: the specks drift slowly up (video: 3–5 px/s) */
    speckMat.fragmentShader = 'varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(p)) * vA; gl_FragColor = vec4(vec3(0.84, 0.95, 0.97) * a, a); }';
  }
  /* UNDER WATER: rising bubbles (points fixed in the water, rising on time; columns from the floor and the rocks + a few loose ones).
     y wraps in a window round the lens (the bubble keeps its place in the water while the lens moves), faded at the window's ends and at the surface */
  const bubbleMat = UW ? new THREE.ShaderMaterial({ uniforms: { uTime: C.uTime, uCamY: C.uCamY, uCamZ: { value: 0 }, uCamX: { value: 0 }, uPhase: { value: 0 }, uStr: { value: 1 }, uBurst: { value: 0 }, uDropRel: { value: new THREE.Vector3(0, 0, -6.3) }, uPx: { value: 1 }, uBub: UWU.bubbles, uSurfY: UWU.surfY, uRes: C.uRes, uBoostA: C.uBoostA, uBoostB: C.uBoostB }, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */`
      uniform float uTime, uCamY, uCamZ, uCamX, uPhase, uStr, uBurst, uPx, uBub, uSurfY; uniform vec3 uDropRel; uniform vec4 uBoostA, uBoostB; attribute vec4 aB; varying float vA; varying float vPs; varying float vStr;
      /* PHASE 5 (client 「水氣泡往下滾也要有動態特效」): the scroll drives them — uPhase (accumulated from the lens's speed: up past the lens
         while sinking, back down while rising), uStr (a slight stretch along the motion when fast), uBurst (fine bubbles off the drop and the
         lens edges on a strong scroll, easing out when it stops). aB.w ≥ 2: a burst bubble, held relative to the lens. */
      void main(){
        vec3 p; float d, fade, w = fract(aB.w);
        if (aB.w < 1.5) {
          float spd = 0.55 + aB.w * 0.85, lo = uCamY - 13.0, win = 21.0;
          float y = mod(aB.y + uTime * spd + uPhase * (0.8 + 0.4 * aB.w) - lo, win) + lo;
          fade = smoothstep(0.0, 2.5, y - lo) * smoothstep(0.0, 3.0, lo + win - y) * smoothstep(0.0, 0.8, uSurfY - 0.15 - y);
          float wob = 0.05 * (0.6 + aB.w) * (1.0 + 0.8 * (uStr - 1.0));
          p = vec3(aB.x + sin(uTime * (2.1 + aB.w) + aB.y * 3.7) * wob, y, uCamZ - 3.0 - mod(uCamZ - 3.0 - aB.z, 30.0));
        } else if (aB.w >= 2.99) {
          /* micro-bubbles trailing off the drop (PHASE 6): rising from its top, wobbling, fading over ≈ 2 m */
          float life = mod(w * 9.0 + uTime * (0.32 + 0.2 * w) + uPhase * 0.6, 2.4);
          p = vec3(uCamX, uCamY, uCamZ) + uDropRel + vec3(aB.x + sin(uTime * 4.0 + w * 30.0) * 0.03 * life, aB.y + life, aB.z);
          fade = smoothstep(0.0, 0.25, life) * smoothstep(2.4, 1.2, life) * 0.85;
        } else {
          float life = mod(w * 7.0 + aB.y * 0.0 + uPhase * 2.4 + uTime * 0.45, 4.2);
          p = vec3(uCamX + aB.x + sin(uTime * 3.3 + w * 40.0) * 0.035 * life, uCamY + aB.y + life, uCamZ + aB.z);
          fade = uBurst * smoothstep(0.0, 0.5, life) * smoothstep(4.2, 2.8, life);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        d = -mv.z;
        float sz = aB.w < 1.5 ? (0.035 + 0.075 * aB.w) : aB.w >= 2.99 ? (0.008 + 0.016 * w) : (0.012 + 0.022 * w);
        gl_PointSize = clamp(sz * uPx * 930.0 / (d * 0.62) * uStr, 1.5, 34.0); vPs = gl_PointSize; vStr = uStr;
        vA = fade * exp(-d * 0.035) * uBub;
        vec2 sc = gl_Position.xy / gl_Position.w * 0.5 + 0.5; float m = 0.02;   /* never over the texts: the whole bubble goes */
        if (sc.x > uBoostA.x - m && sc.x < uBoostA.z + m && sc.y > uBoostA.y - m && sc.y < uBoostA.w + m) vA = 0.0;
        if (sc.x > uBoostB.x - m && sc.x < uBoostB.z + m && sc.y > uBoostB.y - m && sc.y < uBoostB.w + m) vA = 0.0;
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vPs; varying float vStr;
      void main(){
        vec2 p = gl_PointCoord * 2.0 - 1.0; p.x *= vStr; float r = length(p); if (r > 1.0) discard;   /* drawn out along the motion when fast */
        float aa = 1.5 / max(vPs, 1.0);
        float rim = smoothstep(0.62, 0.9, r) * (1.0 - smoothstep(1.0 - aa * 2.0, 1.0, r));
        float hl = smoothstep(0.42, 0.0, length(p - vec2(-0.32, -0.36)));
        float small = 1.0 - smoothstep(3.0, 7.0, vPs);   /* tiny ones: a soft bright dot */
        float a = mix(rim * 0.75 + 0.1 + hl * 0.9, smoothstep(1.0, 0.2, r) * 0.8, small) * vA;
        gl_FragColor = vec4(vec3(0.88, 0.97, 1.0) * a, a * 0.75);
      }` }) : null;
  let bubbles = null; const bubState = { t: null, y: null, v: 0 };
  /* UW-BUILD: motes — suspended specks 0.7–3.5 m from the lens, out of focus (soft discs with a faint ring), fixed in the water: the lens
     sinks past them, so they stream up with the scroll at their true speed; very faint (?uwMote= dial, 0 = off) */
  const moteMat = NEAR2 ? new THREE.ShaderMaterial({ uniforms: { uTime: C.uTime, uCamY: C.uCamY, uPx: { value: 1 }, uMote: { value: uwNum('uwMote', 1) }, uDeep: C.uDeep, uCol: { value: hex('#cfe0ea') } },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */`
      uniform float uTime, uCamY, uPx, uMote, uDeep; attribute vec4 aM; varying float vA; varying float vR;
      void main(){
        float H = 5.0, lo = uCamY - 2.5;
        float y = mod(aM.y + sin(uTime * 0.11 + aM.w * 9.0) * 0.12 - lo, H) + lo;
        vec3 p = vec3(aM.x + sin(uTime * 0.07 + aM.w * 17.0) * 0.1, y, aM.z);
        vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        float d = -mv.z, coc = abs(1.0 / d - 1.0 / 9.0) * 9.0;   /* focus ≈ 9 m: the nearer, the bigger the blur disc */
        gl_PointSize = clamp((0.006 + 0.018 * coc) * uPx * 930.0 / (d * 0.62) * 6.0, 2.0, 46.0); vR = gl_PointSize;
        float edge = smoothstep(0.0, 0.6, y - lo) * smoothstep(0.0, 0.6, lo + H - y);
        vA = uMote * edge * (0.05 + 0.07 * fract(aM.w * 7.3)) / (0.6 + 0.4 * coc) * (1.0 - 0.45 * uDeep);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; varying float vA; varying float vR;
      void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q); if (r > 1.0) discard;
        float aa = 2.0 / max(vR, 2.0), disc = 1.0 - smoothstep(1.0 - aa * 2.0, 1.0, r), ring = smoothstep(0.55, 0.92, r) * disc;
        float a = (disc * 0.55 + ring * 0.6) * vA; gl_FragColor = vec4(uCol * a, a); }` }) : null;
  let motes = null;
  const SUNC = new THREE.Color(0.9, 0.9, 0.9), SKYC_UW = new THREE.Color().setRGB(0.3, 0.56, 0.66), SKYC = new THREE.Color().setRGB(0.42, 0.53, 0.63), DV = new THREE.Vector3();   /* no allocations per frame */
  /* UNDER WATER: the sandy floor, built once (a 96 × 96 grid on a height function: rising ahead, rising at both sides, gentle mounds) */
  /* PHASE 3: the lane for the first-person travel (the contract with DIVE is in .qa/index1-5/underwater/STATUS-DEEP.md): a sandy path
     toward −z, its centre bending gently, the sand rising at the sides; stations dressed like the client's picture (a big rock close on one
     side, a coral cluster on the sand a few metres ahead, flat stones, a few pillars). The lens: eye 1 m over the sand, looking straight ahead. */
  const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const LANE = { len: 170, sand: T.sand ?? -12, eye: T.eye ?? 1.0, x: z => 1.6 * Math.sin(-z * 0.028) + 0.6 * Math.sin(-z * 0.071 + 1.3),
    stations: [{ name: 'insight', z: -40, side: -1 }, { name: 'discipline', z: -75, side: 1 }, { name: 'strategies', z: -110, side: -1 }, { name: 'values', z: -145, side: 0 }, { name: 'open', z: -160, side: 0 }] };
  /* PHASE 4 (client 「水滴先不要第一人稱好了 先繼續往下」): the DESCENT is the default; the phase-3 lane stays behind ?uwLane=1 */
  const LANE_MODE = UWQ.get('uwLane') === '1';
  const DESC = { top: -2.8, bottom: -56, sea: -62, stations: [{ name: 'insight', y: -14 }, { name: 'discipline', y: -26 }, { name: 'strategies', y: -38 }, { name: 'values', y: -47 }, { name: 'open', y: -55 }] };
  const seabedH = (x, z) => DESC.sea + 10 * ss(9, 42, Math.abs(x)) + 4 * ss(-40, -110, z) + 0.35 * Math.sin(x * 0.37 + z * 0.21) * Math.sin(z * 0.3 - x * 0.13) + 0.5 * Math.sin(x * 0.83 + 1.3) * Math.sin(z * 0.71);
  const laneH = (x, z) => { const d = Math.abs(x - LANE.x(z));
    return LANE.sand + 9 * ss(7, 36, d) + 0.25 * Math.sin(x * 0.37 + z * 0.21) * Math.sin(z * 0.3 - x * 0.13) + (0.12 + 0.6 * ss(5, 20, d)) * Math.sin(x * 0.83 + 1.3) * Math.sin(z * 0.71); };
  const floorH = LANE_MODE ? laneH : seabedH;
  LANE.floor = laneH; DESC.floor = seabedH;
  for (const st of LANE.stations) { const lx = LANE.x(st.z); st.anchor = [lx + st.side * 1.4, floorH(lx, st.z) + 1.5, st.z]; }
  const floorVS = 'varying vec3 vW; varying vec3 vN; varying float vDist; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }';
  const floorFS = CM + /* glsl */`
    uniform sampler2D tCaus, tSandA, tSandN, tSandH; uniform vec3 uKeyDir, uKeyCol, uSky, uGround, uSand; uniform float uFogK, uCaus, uFloor, uTile;
#ifdef UWTEX
    uniform float uTxCaus, uTxClear;
#endif
#ifdef FEET
    uniform vec4 uFeet[40];
#endif
    varying vec3 vW; varying vec3 vN; varying float vDist;
    void main(){
      vec3 N = normalize(vN);
      float n = texture2D(tNoise, vW.xz * 0.045).r, n2 = texture2D(tNoise, vW.xz * 0.23 + 0.31).r;
      /* ripples of sand across the current, a little darker in their troughs */
      float rp = sin(dot(vW.xz, vec2(0.93, 0.36)) * 2.3 + n * 10.0);
      float crest = 0.5;
#ifdef SANDTEX
      vec2 tuv = vW.xz / uTile, ruv = mat2(0.7986, -0.6018, 0.6018, 0.7986) * vW.xz / 23.0;
      vec4 s1 = texture2D(tSandA, tuv), s2 = texture2D(tSandA, ruv);
      vec3 sa = mix(s1.rgb, s2.rgb, 0.3);
      vec3 sn = texture2D(tSandN, tuv).xyz * 2.0 - 1.0; N = normalize(N + vec3(sn.x, 0.0, -sn.y) * mix(0.35, 1.25, smoothstep(30.0, 5.0, vDist)));   /* ripples read near, flatten far */
      crest = texture2D(tSandH, tuv).r;
      vec3 alb = sa * uSand * 1.5 * mix(1.0, s1.a, 0.6);
#else
      vec3 alb = uSand * (0.78 + 0.4 * n2) * (0.88 + 0.12 * rp) * mix(0.8, 1.0, n);
#endif
      float caus = causMove(tCaus, vW.xz * 0.27, 1.0) * 1.45;
      caus = mix(caus, 0.3, smoothstep(10.0, 30.0, vDist));   /* far off: an even shimmer, not a crackled net */
      vec3 col = alb * (mix(uGround, uSky, N.y * 0.5 + 0.5) + uKeyCol * max(dot(N, normalize(uKeyDir)), 0.0) * 0.62);
#ifdef UWTEX
      col += alb * uKeyCol * caus * caus * uCaus * uTxCaus * 1.3 * smoothstep(-0.3, 0.6, N.y) * (0.5 + 0.9 * crest);   /* UWTEX: the net on the ripples, crests brighter */
#else
      col += uKeyCol * caus * caus * uCaus * 0.4 * smoothstep(-0.3, 0.6, N.y) * (0.6 + 0.8 * crest);   /* brighter on the ripples' crests */
#endif
#ifdef FEET
      if (vDist < 45.0) { float occ = 1.0;   /* UW-BUILD: contact shadow round each seabed rock's foot */
        for (int i = 0; i < 40; i++) { vec4 F = uFeet[i]; if (F.z <= 0.0) break; vec2 dd = vW.xz - F.xy; if (abs(dd.x) > F.z * 1.6 || abs(dd.y) > F.z * 1.6) continue;
          occ *= 1.0 - F.w * (1.0 - smoothstep(F.z * 0.5, F.z * 1.45, length(dd))); }
        col *= occ; }
#endif
      col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))) * 0.95, smoothstep(10.0, 34.0, vDist) * 0.4);   /* far sand greys into the water */
#ifdef UWTEX
      float fd = max(vDist - 2.0, 0.0), f = 1.0 - exp(-fd * uFogK * (1.0 - 0.5 * uTxClear * smoothstep(14.0, 3.0, vDist)) - fd * fd * 0.00014);   /* UWTEX: clearer near */
#else
      float fd = max(vDist - 2.0, 0.0), f = 1.0 - exp(-fd * uFogK - fd * fd * 0.00014);   /* + a squared term: the far bed (and its crest) melts into the water */
#endif
      f = f + (1.0 - f) * boostAt(gl_FragCoord.xy) * 0.5;
      float ff = 1.0 - (1.0 - clamp(f, 0.0, 1.0)) * uFloor;   /* uFloor 0 = the floor gone into the water */
      gFar = smoothstep(0.04, 0.72, ff); col = mix(col, bgAt(gl_FragCoord.xy), ff);
      gl_FragColor = vec4(toSRGB(col), 1.0);
    }`;
  let floor = null;
  function buildFloor() {
    if (!UW || floor) return;
    const NX = 80, NZ = LANE_MODE ? 200 : 110, x0 = -64, x1 = 64, z0 = LANE_MODE ? 12 : 22, z1 = LANE_MODE ? -245 : -150, P = new Float32Array((NX + 1) * (NZ + 1) * 3), idx = [];
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const u = i / NX * 2 - 1, x = Math.sign(u) * Math.pow(Math.abs(u), 1.6) * (x1 - x0) * 0.5, z = z0 + (z1 - z0) * j / NZ, k = (j * (NX + 1) + i) * 3;   /* denser near the lane */
      P[k] = x; P[k + 1] = floorH(x, z); P[k + 2] = z;
    }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, b, c, b, d, c); }   /* faces up (z runs away from the lens) */
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.ShaderMaterial({ defines: Object.assign(sandTex && sandTex.n ? { SANDTEX: 1 } : {}, NEAR2 && !LANE_MODE ? { FEET: 1 } : {}, UWTEX ? { UWTEX: 1 } : {}), uniforms: { ...C, ...L, uTxCaus: UWTXU.caus, uTxClear: UWTXU.clear, uFeet: { value: Array.from({ length: 40 }, () => new THREE.Vector4(0, 0, 0, 0)) }, uSand: { value: hex(T.uwSand || (sandTex && sandTex.kit2 ? (RIVER ? '#aab0b4' : '#aab8b8') : '#a2aaa0')) }, uFogK: { value: UWT.fogK }, uFloor: UWU.floor, tSandA: { value: sandTex ? sandTex.a : tNoise }, tSandN: { value: sandTex && sandTex.n ? sandTex.n : tNoise }, uTile: { value: sandTex ? sandTex.tile : 4 }, tSandH: { value: sandTex && sandTex.h ? sandTex.h : tNoise } }, vertexShader: floorVS, fragmentShader: floorFS });
    floor = new THREE.Mesh(g, m); floor.renderOrder = 6; floor.frustumCulled = false; scene.add(floor);
    info.floorTris = idx.length / 3;
  }

  /* ---- the drop: Team SQ's lens (window.__FLOW2_DROP__), same material as the canyon's; else a small copy of the same recipe */
  const dropMesh = new THREE.Mesh(new THREE.SphereGeometry(1.02, 56, 40), null);
  dropMesh.frustumCulled = false; dropMesh.renderOrder = 30;
  const dropScene = new THREE.Scene();
  const copyMat = new THREE.ShaderMaterial({ uniforms: { tA: { value: null } }, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tA; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tA, vUv).rgb, 1.0); }' });
  const copyQuad = new THREE.Mesh(tri, copyMat); copyQuad.frustumCulled = false; copyQuad.renderOrder = -1;
  dropScene.add(copyQuad, dropMesh);
  let lens = null;
  function makeLens() {
    const D = window.__FLOW2_DROP__;
    let mat = null, update = null;
    if (UW && UWQ.get('uwBubble') !== '0') {   /* PHASE 6 (client 「水下的水滴好像可以在自然一點 現在好像有點假」): an air bubble's optics */
      mat = bubbleLens(); update = (m, o) => { ownUpdate(m, o); m.uniforms.uSky.value.setRGB(0.52, 0.64, 0.75); }; info.lens = 'bubble'; dropMesh.material = mat; lens = { mat, update }; info.aa = true; return;
    }
    if (D && typeof D.makeLensMaterial === 'function' && typeof D.updateLens === 'function') {
      try { mat = D.makeLensMaterial(THREE, { disp: 0.014, far: T.dropFar ?? 30 }); update = (m, o) => D.updateLens(m, o); info.lens = 'sq'; } catch (error) { mat = null; }
    }
    if (!mat) { mat = ownLens(); update = ownUpdate; info.lens = 'own'; }
    /* anti-aliased rim (this pass has no MSAA): the analytic silhouette fades over one pixel instead of a hard discard */
    let fs = mat.fragmentShader, ok = 0;
    const a1 = 'float b = dot(ro, rd), h = b * b - (dot(ro, ro) - 1.0); if (h <= 0.0) discard;';
    if (fs.includes(a1)) { fs = fs.replace(a1, 'float b = dot(ro, rd), h = b * b - (dot(ro, ro) - 1.0); float xsAA = clamp(h / max(fwidth(h), 1e-6), 0.0, 1.0); if (xsAA <= 0.0) discard; h = max(h, 1e-7);'); ok++; }
    const a2 = 'gl_FragColor = vec4(clamp(col, 0.0, 24.0) * uOpacity, uOpacity);';
    if (ok && fs.includes(a2)) { fs = fs.replace(a2, 'gl_FragColor = vec4(clamp(col, 0.0, 24.0) * uOpacity, uOpacity) * xsAA;'); ok++; }
    if (ok === 2) { mat.fragmentShader = fs; info.aa = true; }
    mat.depthTest = false;
    dropMesh.material = mat;
    lens = { mat, update };
  }

  /* ---- render targets */
  const phone = !!opts.phone;
  /* flow2-tex ENGINE VRAM (2026-11-18): this canvas draws at 1.25× already; 2× MSAA on top holds the edges (crops in docs/flow2/) for half the
     memory (83 → 42 MB). Only with data-flow2-tex; ?texEvram=0 / ?texEvramMsaa=0 = 4× as before */
  const vramQ = new URLSearchParams(location.search), vramOn = document.documentElement.hasAttribute('data-flow2-tex') && vramQ.get('texEvram') !== '0' && vramQ.get('texEvramMsaa') !== '0' && vramQ.get('tex') !== '0' && vramQ.get('texE') !== '0';
  const A = new THREE.WebGLRenderTarget(4, 4, { samples: riseWaterline ? 0 : (phone || vramOn ? 2 : 4), type: THREE.UnsignedByteType, depthBuffer: true });
  const B = new THREE.WebGLRenderTarget(4, 4, { samples: 0, type: THREE.UnsignedByteType, depthBuffer: false });
  A.texture.minFilter = A.texture.magFilter = THREE.LinearFilter; B.texture.minFilter = B.texture.magFilter = THREE.LinearFilter;
  A.texture.generateMipmaps = B.texture.generateMipmaps = false;

  /* ---- UW-BUILD FAR LAYER (overnight 2026-11-18): depth bands of looping video (assets/far/far.json: our baked light loops, or real
     footage from UW-FIND), cross-faded by the lens depth into two texture slots that every layer's fog reads (bgAt → farMix).
     A slot's texture is re-uploaded only when its video has a NEW frame (requestVideoFrameCallback), the videos play only near their
     band (others paused) and only while this section draws (a watchdog pauses them all after 0.7 s without a frame). */
  const FAR = FAR_ON ? { bands: [], slots: [], last: 0, timer: 0, uploads: 0, res: 0 } : null;
  /* UW-BUILD dials (the page's panel, tab 「水下 遠景」, key U; also scene().uwTune): far = the far layer's strength, contrast / white = its
     light's contrast and whitening (× each band's own), deep = how much of the shafts survive at the bottom, mote = the out-of-focus specks,
     relief = the reef's normal strength */
  const UWT2 = { far: uwNum('farK', 1), contrast: uwNum('farC', 1), white: uwNum('farW', 1), deep: uwNum('farDeep', 1), mote: uwNum('uwMote', 1), relief: uwNum('uwRelief', 1.25),
    txCaus: UWTXU.caus.value, txClear: UWTXU.clear.value, txTop: UWTXU.top.value };   /* UWTEX: the sample's three dials */
  info.far = FAR ? { on: true } : { on: false, why: UW3D ? 'uw=3d' : UW ? 'far=0' : 'not under water' };
  if (FAR) for (const k of ['A', 'B']) {
    const t = new THREE.Texture(); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    FAR.slots.push({ k, tex: t, band: null, P: C['uFar' + k].value, G: C['uFarG' + k].value, uT: C['tFar' + k] });
  }
  async function loadFar() {
    const cfg = await fetch(ASSETS + 'far/far.json?v=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (cfg && cfg.sets) { const k = UWQ.get('far') && cfg.sets[UWQ.get('far')] ? UWQ.get('far') : cfg.default; cfg.bands = cfg.sets[k]; info.far.set = k; }
    if (!cfg || !Array.isArray(cfg.bands) || !cfg.bands.length) { info.far.error = 'far.json'; return; }
    const qs = window.__FLOW2_QUALITY__ && window.__FLOW2_QUALITY__.start, tier = qs === 'low' || qs === 'medium' ? qs : (texTier && texTier.tier) || 'high';   /* the iGPU path (quality low) takes the 720 tier */
    const res = +(UWQ.get('farRes') || cfg[tier] || cfg.medium || 720); info.far.tier = tier;
    FAR.res = res; FAR.fade = cfg.fade ?? 6; FAR.cfg = cfg;
    const firsts = [];
    cfg.bands.forEach((b, i) => {
      const v = document.createElement('video');
      Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous', disablePictureInPicture: true });
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
      const band = { ...b, i, v, fresh: 0, ok: false, want: false, ref: b.ref ?? 0.07 };
      v.addEventListener('loadeddata', () => { band.ok = true; v.width = v.videoWidth; v.height = v.videoHeight; }, { once: true });
      v.addEventListener('error', () => { band.error = true; info.far.error = 'video ' + b.file; }, { once: true });
      if (v.requestVideoFrameCallback) { band.cb = () => { band.fresh++; v.requestVideoFrameCallback(band.cb); }; v.requestVideoFrameCallback(band.cb); } else band.poll = true;
      const rb = UWQ.get('farRes') ? res : (tier === 'high' && b.hiRes) || res;   /* a band may ask for its 1080 file on the high tier (the real fish school) */
      band.url = new URL(String(b.file).replace('{h}', rb), ASSETS + 'far/').href; v.src = band.url; band.res = rb;
      FAR.bands.push(band);
      firsts.push(new Promise(r => { if (band.ok) r(); v.addEventListener('loadeddata', r, { once: true }); v.addEventListener('error', r, { once: true }); }));
    });
    /* band edges: half-way between the bands' own depths unless given */
    FAR.bands.forEach((b, i) => { b.edge = i < FAR.bands.length - 1 ? (b.until ?? (b.y + FAR.bands[i + 1].y) / 2) : -1e9; });
    await Promise.race([Promise.all(firsts), new Promise(r => setTimeout(r, 6000))]);
    FAR.bands.forEach(b => { if (b.ok) { try { b.v.currentTime = (b.offset || 0); } catch (e) { } } });
    FAR.timer = setInterval(() => { if (performance.now() - FAR.last > 700) for (const b of FAR.bands) if (!b.v.paused) b.v.pause(); }, 350);
    info.far.bands = FAR.bands.map(b => b.id + '@' + b.res + (b.ok ? '' : '!')); info.far.res = res;
  }
  function farFrame(cy, tanY, aspect) {
    if (!FAR || !FAR.bands.length) return;
    FAR.last = performance.now(); C.uFarK.value = UWT2.far;
    C.uFarScr.value.set(tanY * aspect, tanY);
    { const d = C.uDeep.value, lo = C.uBgLow.value, mi = C.uBgMid.value, tp = C.uBgTop.value, ab = C.uAbyss.value, k1 = ss(-0.2, 0.62, 0.5), k2 = ss(0.48, 1.12, 0.5) * (1 - 0.4 * d), k3 = d * 0.5 * (1 - 0.45 * ss(0.35, 1, 0.5));
      const ch = i => { let c = lo[i] + (mi[i] - lo[i]) * k1; c += (tp[i] - c) * k2; c += (ab[i] - c) * k3; return c; };
      C.uFarLum.value = 0.2126 * ch('r') + 0.7152 * ch('g') + 0.0722 * ch('b'); }
    const f = FAR.fade, n = FAR.bands.length;
    /* weights: band i from the edge above (i − 1) to its own edge below, smooth over `fade` metres at each edge (they sum to 1) */
    let best = [];
    for (let i = 0; i < n; i++) {
      const b = FAR.bands[i], up = i === 0 ? 1 : ss(FAR.bands[i - 1].edge + f / 2, FAR.bands[i - 1].edge - f / 2, cy), dn = i === n - 1 ? 1 : 1 - ss(b.edge + f / 2, b.edge - f / 2, cy);
      b.w = b.ok ? up * dn : 0;
      const top = i === 0 ? 99 : FAR.bands[i - 1].edge + f / 2, bot = b.edge - f / 2;
      b.dist = cy > top ? cy - top : cy < bot ? bot - cy : 0;   /* metres from the zone where this band shows */
      if (b.w > 0.001) best.push(b);
    }
    /* keep (loaded + playing): every band that shows, else the nearest; plus the nearest other one within 9 m */
    const order = FAR.bands.slice().sort((a, c) => a.dist - c.dist), keep = new Set(order.filter(b => b.dist === 0));
    if (!keep.size) keep.add(order[0]);
    for (const b of order) { if (keep.size >= 2) break; if (!keep.has(b) && b.dist < 1.5) keep.add(b); }   /* the stations sit at band middles: one decoder there */
    const tNow = performance.now();
    for (const b of FAR.bands) {
      b.want = keep.has(b) && b.ok;
      if (keep.has(b)) { b.lastWant = tNow; if (b.unloaded) { b.unloaded = false; b.v.src = b.url; b.v.load(); if (b.cb && b.v.requestVideoFrameCallback) b.v.requestVideoFrameCallback(b.cb); } }
      else if (!b.unloaded && b.ok && tNow - (b.lastWant || 0) > 2000) {
        b.v.pause(); b.v.removeAttribute('src'); b.v.load(); b.unloaded = true; b.ok = false; b.w = 0;
        b.v.addEventListener('loadeddata', () => { b.ok = true; }, { once: true });
        for (const sl of FAR.slots) if (sl.band === b) { sl.band = null; sl.P.w = 0; }
      }
    }
    for (const b of FAR.bands) { b.rdy = b.ok ? Math.min(1, (b.rdy || 0) + 0.07) : 0; b.w *= b.rdy; }
    best = best.filter(b => b.ok && b.w > 0.001);
    best.sort((a, b) => b.w - a.w); best = best.slice(0, 2);
    const ws = Math.max(1, best.reduce((a, b) => a + b.w, 0));
    /* keep a band in the slot it already has (no re-upload when the order of the two weights flips) */
    const slots = FAR.slots, assign = [null, null];
    best.forEach(b => { const k = slots.findIndex(sl => sl.band === b); if (k >= 0) assign[k] = b; });
    best.forEach(b => { if (assign.includes(b)) return; const k = assign[0] ? 1 : 0; assign[k] = b; });
    slots.forEach((sl, k) => {
      const b = assign[k];
      if (!b) { sl.P.w = 0; return; }
      if (sl.band !== b) {   /* a slot's GPU storage is sized by its first video: another size needs a fresh texture (else texSubImage2D fails) */
        if (sl.w && (sl.w !== b.v.videoWidth || sl.h !== b.v.videoHeight)) sl.tex.dispose();
        sl.band = b; sl.tex.image = b.v; sl.tex.needsUpdate = true; sl.uT.value = sl.tex; b.fresh = 1; sl.w = b.v.videoWidth; sl.h = b.v.videoHeight; }
      if (b.fresh || b.poll) { b.fresh = 0; sl.tex.needsUpdate = true; FAR.uploads++; }
      /* cover-fit: a window wider than the plate (the client's ≈ 2.4 : 1) zooms the plate in instead of stretching its edge columns */
      const kf = Math.max(1, tanY * aspect * 1.01 / (b.tpx || 0.6726)), tpx = (b.tpx || 0.6726) * kf, tpy = (b.tpy || 0.3783) * kf;
      const shift = (cy - b.y) / (b.deff || 120), room = Math.max(0, tpy - tanY);
      sl.P.set(tpx, tpy, room > 0 ? room * Math.tanh(shift / Math.max(room, 1e-3)) : 0, b.w / ws);
      const dk = b.y < -30 ? UWT2.deep : 1;
      sl.G.set(b.ref, (b.gamma ?? 1) * UWT2.contrast * dk, b.keep ?? 0, (b.white ?? 0) * UWT2.white * dk);
    });
    for (const b of FAR.bands) { if (b.want && b.v.paused) b.v.play().catch(() => { }); else if (!b.want && !b.v.paused) b.v.pause(); }
  }

  /* ---- the screen pass: waterline (entry), brush (hand-over), vignette */
  const outScene = new THREE.Scene();
  const outMat = new THREE.ShaderMaterial({
    uniforms: { tNoise: { value: tNoise }, uRays: UWU.rays, uTime: C.uTime, uDeep: C.uDeep, uRayCol: { value: C.uBgGlow.value }, uTilt: UWU.tilt, uRayK: UWU.rayK, uOpen: { value: new THREE.Vector4(0.5, 0.5, 0, 0.02) },
      tB: { value: B.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uMode: { value: 0 }, uLine: { value: new THREE.Vector4(0, 0.01, 0, 1) },
      uBrush: { value: new THREE.Vector4(0, 0, 1, 0) }, uBrushLook: { value: new THREE.Vector4(0.28, 1.6, 0.45, 0.55) }, uMargin: { value: 0.03 }, uVig: { value: 0.22 }, uFade: { value: 1 }, uDrop: { value: new THREE.Vector4(0.5, 0.5, 0.1, 0) }, ...(OCEAN ? { uOcRay: OCU.uOcRay } : {}),
      ...(riseWaterline ? { ...riseLighting.uniforms, uRiseOptics: riseOptics, uCamPos: UWU.camPos,
        uCamR: UWU.camR, uCamU: UWU.camU, uCamF: UWU.camF, uTanH: UWU.tanH, uSurfY: UWU.surfY } : {}) },
    depthTest: false, depthWrite: false, transparent: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: riseDefine + DEF + (OCEAN ? '#define OCEAN 1' + String.fromCharCode(10) : '') + /* glsl */`
      uniform sampler2D tB; uniform vec2 uRes; uniform float uMode, uMargin, uVig, uFade; uniform vec4 uLine, uBrush, uBrushLook, uDrop, uOpen; varying vec2 vUv;
#ifdef RISE_WATERLINE
      uniform vec3 uCamPos, uCamR, uCamU, uCamF, uRiseRayColor;
      uniform vec2 uRiseOptics;
      uniform float uTanH, uSurfY;
      ${riseWaterline ? OC.riseLightGLSL : ''}
      ${riseWaterline ? OC.waterlineGLSL : ''}
#endif
#ifdef UW
      /* soft god rays from the surface: a fan from a point above the frame, two slow noise reads along its angle (they sway, never flicker) */
      uniform sampler2D tNoise; uniform float uRays, uTime, uDeep, uTilt, uRayK; uniform vec3 uRayCol;
      float raysAt(vec2 uv, float asp){
        vec2 d = (uv - vec2(0.6, 1.5)) * vec2(asp, 1.0);
        float ang = atan(d.x, -d.y);
        float n = texture2D(tNoise, vec2(ang * 0.85 + uTime * 0.0035, 0.21)).r, n2 = texture2D(tNoise, vec2(ang * 2.1 - uTime * 0.005, 0.63)).r;
        float sh = smoothstep(0.5, 0.78, n * 0.62 + n2 * 0.5);
        return sh * smoothstep(1.75, 0.5, length(d)) * smoothstep(-0.2, 0.8, uv.y);
      }
${OCEAN && !riseWaterline ? OC.raysFS : ''}
#endif
${riseWaterline ? OC.waterShaftsGLSL : ''}
      /* the brush mask: the same function as flow2-forest-atlas.js's composite (1 = the view from above, 0 = what is below it) */
      float bH(float x){ return fract(sin(x * 127.1 + 0.7) * 43758.5453); }
      float bN(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(bH(i), bH(i + 1.0), f); }
      float bF(float x){ return bN(x) * 0.55 + bN(x * 2.13 + 7.0) * 0.3 + bN(x * 4.71 + 3.0) * 0.15; }
      float bN2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = bH(i.x + i.y * 57.0), b = bH(i.x + 1.0 + i.y * 57.0), c = bH(i.x + (i.y + 1.0) * 57.0), d = bH(i.x + 1.0 + (i.y + 1.0) * 57.0); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
      void main(){
        vec2 uv = vUv; float a = 1.0; vec2 off = vec2(0.0); vec3 add = vec3(0.0); float lipA = 0.0; vec3 lipC = vec3(0.0);
        float asp = uRes.x / uRes.y, px = 1.0 / uRes.y;
#ifdef RISE_WATERLINE
        vec2 eyeUv = uv * 2.0 - 1.0 + vec2(0.0, uRiseOptics.y);
        vec3 ray = normalize(uCamF + (eyeUv.x * asp * uCamR + eyeUv.y * uCamU) * uTanH);
        vec3 eye = uCamPos - vec3(0.0, uSurfY, 0.0);
        float line = -1.0;
        if (eye.y > -0.84) {
          float rayLength = length(vec3(eyeUv * vec2(asp, 1.0) * uTanH, 1.0));
          line = waterPortDistance(eye.y, ray, uCamU, uTanH, rayLength, uTime);
          if (line > 0.018) { gl_FragColor = vec4(0.0); return; }
        }
#endif
        if (uMode > 0.5 && uMode < 1.5) {
          /* the waterline climbing the screen: the gorge below it, the canyon (the page's own canvas) above */
          float x = uv.x * asp;
          float wv = uLine.y * (sin(x * 6.0 + uLine.z) * 0.6 + sin(x * 15.0 - uLine.z * 1.7) * 0.28 + sin(x * 37.0 + uLine.z * 0.6) * 0.12);
          float d = (uLine.x + wv) - uv.y;   /* > 0 under the water */
          a = smoothstep(-1.2 * px, 1.2 * px, d);
          float near = exp(-max(d, 0.0) / 0.045);
          off.y += near * 0.018 * (0.6 + 0.4 * sin(x * 21.0 + uLine.z * 2.0));
          off.x += near * 0.004 * sin(x * 13.0 - uLine.z);
          add += vec3(0.86, 0.92, 0.97) * (0.34 * exp(-max(d, 0.0) / 0.012) + 0.1 * near) * a;   /* the underside of the surface: silver, right under the line */
          lipA = exp(-abs(d) / (1.4 * px)) * 0.75 * uLine.w + exp(-max(-d, 0.0) / (5.0 * px)) * (1.0 - a) * 0.22 * uLine.w;   /* the bright lip, a faint meniscus above it */
          lipC = vec3(0.93, 0.97, 1.0);
        }
        if (uMode > 2.5) {
          /* mode 3 (for DIVE, 2026-11-17 phase 2): the hand-over to the view from above as a round window opening from the drop.
             uOpen = (centre x, centre y in screen shares, radius and feather in screen heights); inside = the page's view, a slight refraction at the rim */
          vec2 p = (uv - uOpen.xy) * vec2(asp, 1.0); float d = length(p);
          a = smoothstep(uOpen.z - uOpen.w, uOpen.z + uOpen.w, d);
          float rim = exp(-abs(d - uOpen.z) / max(uOpen.w * 1.6, 1e-4)) * step(0.0005, uOpen.z);
          off += (p / max(d, 1e-4)) / vec2(asp, 1.0) * 0.012 * rim;
          add += vec3(0.85, 0.95, 1.0) * rim * 0.1;
        }
        if (uMode > 1.5 && uMode < 2.5 && uBrush.x > 0.5) {
          float b = clamp(uBrush.y - uMargin, 0.0, 1.0), m;
          if (uBrush.w > 0.5) m = b;
          else {
            vec2 p = (uv - 0.5) * vec2(asp, 1.0);
            vec2 dd = vec2(cos(uBrushLook.x), sin(uBrushLook.x)), n = vec2(-dd.y, dd.x);
            float s = dot(p, dd), q = dot(p, n);
            float ext = 0.5 * (abs(dd.x) * asp + abs(dd.y)), ext2 = 0.5 * (abs(n.x) * asp + abs(n.y));
            float band = 0.26 * uBrushLook.y, qn = q / ext2;
            float f = mix(-ext - band * 0.45 - 0.3, ext + band * 1.05 + 0.4, b);
            float e = f - 0.15 * qn * qn + ((bF(q * 18.0) - 0.5) * 0.06 + (bF(q * 5.0 + 3.0) - 0.5) * 0.12) * uBrushLook.z + pow(bF(q * 60.0 + 11.0), 5.0) * 0.06 * uBrushLook.z;
            float paint = 1.0 - smoothstep(e - band * 0.9, e + band * 0.4, s);
            float behind = clamp((e - s) / band, 0.0, 1.0);
            float dry = smoothstep(0.05, 0.95, bN2(vec2(q * 24.0, s * 2.0)) + behind * 0.7);
            m = paint * mix(mix(1.0, dry, 0.6 * min(1.0, uBrushLook.z)), 1.0, smoothstep(0.1, 0.9, behind));
            m = smoothstep(0.0, 1.0, m);
            float at = exp(-abs(s - e + band * 0.25) / (0.12 * uBrushLook.y)) * uBrushLook.w;
            off += (dd / vec2(asp, 1.0)) * 0.006 * at;
          }
          a = 1.0 - m;
        }
        vec3 c = texture2D(tB, clamp(uv + off, vec2(0.0005), vec2(0.9995))).rgb + add;
#ifdef RISE_WATERLINE
        float shafts = waterShafts(eye, ray);
        vec3 linear = c * (c * (c * 0.305306 + 0.682171) + 0.012523);
        vec3 light = uRiseRayColor * shafts;
        c = pow(max(linear * uRiseOptics.x + light, vec3(0.0)), vec3(1.0 / 2.2));
        // A continuous matte in the same optical coordinates as the air-side
        // droplets. The far end of the canyon mesh never becomes a water horizon.
        if (eye.y > -0.84) {
          float under = max(-line, 0.0);
          float band = exp(-under * 15.0) * (1.0 - smoothstep(0.40, 0.82, -eye.y));
          float inv = 1.0 / (0.039 + under);
          vec2 strip = vec2((uv.x - 0.5) * asp * (0.90 + 0.050 * inv), inv * 0.42);
          float n1 = texture2D(tNoise, strip * vec2(0.55,0.36) + vec2(uTime * 0.010,uTime * 0.022)).r;
          float n2 = texture2D(tNoise, strip * vec2(1.45,0.85) + vec2(0.37 - uTime * 0.016,uTime * 0.012)).r;
          float streak = smoothstep(0.49,0.68,0.60*n1 + 0.40*n2) * (0.55 + 0.45 * smoothstep(0.48,0.70,n2));
          float rim = exp(-abs(line) / max(0.0025,1.2 * px));
          c += vec3(0.68,0.88,0.99) * band * (0.04 + 0.74 * streak + rim * 0.84);
          // Let the real reflected bank show through the thin underside of the lip.
          float lipThickness = exp(-under * 33.0) * (1.0 - smoothstep(0.36, 0.80, -eye.y));
          a *= (1.0 - smoothstep(-0.003, 0.003, line)) * (1.0 - 0.56 * lipThickness);
        }
#elif defined(OCEAN)
        c += ocRays(uv, asp) * uRayK;   /* OCEAN: the fan under the sun's hotspot */
#elif defined(UW)
        c += uRayCol * raysAt(uv, asp) * uRays * uRayK * mix(1.0 - 0.45 * uDeep, 1.6, uTilt);   /* looking up (the values place): the rays at their brightest */
#endif
        /* a soft glow round the drop (it is the light of this section) */
        float dd = length((uv - uDrop.xy) * vec2(asp, 1.0)), dr = max(dd - uDrop.z, 0.0);
        c += vec3(0.86, 0.93, 1.0) * uDrop.w * (exp(-pow(dr / (uDrop.z * 0.75), 2.0)) * 0.55 + exp(-dr / (uDrop.z * 2.2)) * 0.25) * (dd > uDrop.z ? 1.0 : 0.25);
        c *= 1.0 - uVig * smoothstep(0.42, 1.2, length((uv - 0.5) * vec2(asp, 1.0)) * 1.05);
        a *= uFade;
        float A = a + lipA * (1.0 - a);
        gl_FragColor = vec4(c * a + lipC * lipA * (1.0 - a), A);
      }`
  });
  const outQuad = new THREE.Mesh(tri, outMat); outQuad.frustumCulled = false; outScene.add(outQuad);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* ---------------------------------------------------------------- the slabs: six shapes carved once in a worker, placed at four depths */
  const SHAPES = [{ seed: 11, L: 5.4, D: 2.4, kind: 'block' }, { seed: 23, L: 4.6, D: 2.2, kind: 'wedge' }, { seed: 37, L: 5.0, D: 2.6, kind: 'stack' },
    { seed: 41, L: 3.8, D: 2.9, kind: 'step' }, { seed: 53, L: 6.0, D: 2.0, kind: 'block' }, { seed: 67, L: 4.4, D: 2.5, kind: 'wedge' }];
  let sculpt = null;
  function sculptAll() {
    return new Promise((resolve, reject) => {
      let w; try { w = new Worker(new URL('./dg-rocks-worker.js?v=1', import.meta.url), { type: 'module' }); } catch (error) { reject(error); return; }
      const to = setTimeout(() => { w.terminate(); reject(new Error('sculpt timeout')); }, 20000);
      w.onerror = e => { clearTimeout(to); w.terminate(); reject(new Error('sculpt worker: ' + (e.message || 'error'))); };
      w.onmessage = ev => {
        clearTimeout(to); w.terminate();
        const geo = m => {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
          g.setAttribute('aAO', new THREE.BufferAttribute(m.ao, 1)); g.setAttribute('aCrack', new THREE.BufferAttribute(m.crack, 1)); g.setAttribute('aMoss', new THREE.BufferAttribute(m.moss, 1));
          g.setIndex(new THREE.BufferAttribute(m.index, 1)); g.computeBoundingSphere(); return g;
        };
        sculpt = ev.data.slabs.map(s => ({ hi: geo(s.hi), lo: geo(s.lo), anchors: s.anchors, shape: s.shape, tris: [s.hi.tris, s.lo.tris] }));
        info.sculptMs = ev.data.ms; resolve();
      };
      w.postMessage({ id: 1, shapes: SHAPES, res: { hi: 1 / (opts.phone ? 10 : 11.5), lo: 1 / 5 } });
    });
  }
  /* four depths with clear size steps (shares of the screen height at that depth); `every` = screens between slabs, sides alternating */
  const LAYERS = [
    { z: -4.3, T: 0.25, every: [1.0, 1.45], prot: [0.3, 0.46], tilt: [10, 26], lod: 'hi', fogMin: 0.0, bright: 1.0, soft: 1.6, normK: 0.7, moss: 1, plants: 0.55 },
    { z: -9.5, T: 0.15, every: [0.46, 0.7], prot: [0.3, 0.5], tilt: [6, 22], lod: 'hi', fogMin: 0.05, bright: 1.05, soft: 0, normK: 1.0, moss: 1, plants: 0.85 },
    { z: -19, T: 0.12, every: [0.36, 0.55], prot: [0.26, 0.52], tilt: [4, 18], lod: 'lo', fogMin: 0.2, bright: 1.1, soft: 0, normK: 1.0, moss: 0.9, plants: 0.35 },
    { z: -34, T: 0.1, every: [0.3, 0.46], prot: [0.22, 0.56], tilt: [3, 14], lod: 'lo', fogMin: 0.42, bright: 1.15, soft: 0, normK: 0.8, moss: 0.8, plants: 0 }
  ];
  /* ---- UNDER WATER: the reef (stone/ "Manta Point Cleaning Station Bommie (Version 2)" by CheeseAndJamSandwich, CC-BY-4.0, credited in the
     footer). bake/bake_bommie.py: 2.95 M triangles → 36 k, cut in three chunks; albedo (+ AO in alpha) and a tangent normal map (high → low).
     The chunks stand in the sand as long walls on both sides of the lane, reused turned round; 2 texture reads + the moving caustics a pixel. */
  const ASSETS = new URL('./assets/', import.meta.url).href;
  const tierUrl = (b, name, full) => texTier && texTier.url ? texTier.url(b + name, full) : b + name + '-' + full + '.webp';
  let bommie = null, aquaOK = false;
  const bommieVS = /* glsl */`attribute vec4 tangent; varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying vec4 vT; varying float vDist; varying vec3 vPc;
    void main(){ vUv = uv; vPc = modelMatrix[3].xyz; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vT = vec4(normalize(mat3(modelMatrix) * tangent.xyz), tangent.w);
      vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const bommieFS = CM + /* glsl */`
    uniform sampler2D tAlb, tNrm, tCaus; uniform vec3 uKeyDir, uKeyCol, uSky, uGround, uTint; uniform float uFogK, uCaus, uNormK, uSat;
#ifdef SHADE2
    uniform float uWet, uAO;
#endif
#ifdef UWTEX
    uniform float uTxCaus, uTxClear, uTxTop;   /* UWTEX: caustics on walls + sand, near clarity, top light */
#endif
#ifdef DETAIL
    uniform sampler2D tDetA, tDetN; uniform float uDetTile;
#endif
    varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying vec4 vT; varying float vDist; varying vec3 vPc;
    void main(){
      vec4 A = texture2D(tAlb, vUv); vec4 NR = texture2D(tNrm, vUv); vec3 tn = NR.xyz * 2.0 - 1.0; tn.xy *= uNormK;   /* NR.a = roughness (AD-REEF) */
      vec3 N0 = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), T = normalize(vT.xyz - N0 * dot(N0, vT.xyz)), Bt = cross(N0, T) * vT.w;
      vec3 N = normalize(T * tn.x + Bt * tn.y + N0 * max(tn.z, 0.05));
      vec3 alb = mix(vec3(dot(A.rgb, vec3(0.3, 0.59, 0.11))), A.rgb, uSat) * uTint; float ao = A.a;   /* the scan's own cyan, calmed into our blue */
#ifdef NEAR2
      /* UW-BUILD (AD-REEF's phase-6 note 1): the same chunk twice never matches — a value / warm-cool shift per piece (its world position)
         and a world-space macro tone (≈ 25 m) across every piece */
      { float hp = fract(sin(dot(floor(vPc * 0.37 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float mt = texture2D(tNoise, vW.xz * 0.037 + vec2(vW.y * 0.021, 0.31)).r;
        alb *= (0.9 + 0.2 * hp) * (0.86 + 0.28 * mt) * mix(vec3(1.035, 1.0, 0.965), vec3(0.965, 1.0, 1.035), hp); }
#endif
#ifdef DETAIL
      {
#ifdef SHADE2
        float dk = smoothstep(18.0, 5.0, vDist), upw = smoothstep(0.35, 0.8, abs(N.y));   /* the close-up crust holds longer, fades 5 → 18 m */
#else
        float dk = smoothstep(14.0, 6.0, vDist), upw = smoothstep(0.35, 0.8, abs(N.y));
#endif
        vec2 uvS = (abs(N.x) > abs(N.z) ? vW.zy : vW.xy) / uDetTile, uvT = vW.xz / uDetTile;
        vec4 dA = mix(texture2D(tDetA, uvS), texture2D(tDetA, uvT), upw);
        vec3 dn = mix(texture2D(tDetN, uvS).xyz, texture2D(tDetN, uvT).xyz, upw) * 2.0 - 1.0;
#if defined(SHADE2) && defined(NEAR2)
        /* UW-BUILD (AD-REEF's note 2: the detail set is high-passed now, so it can be stronger without tiling) */
        alb *= mix(1.0, clamp(dot(dA.rgb, vec3(0.3, 0.59, 0.11)) * 2.0, 0.4, 1.7), 0.56 * dk);
        ao *= mix(1.0, dA.a, 0.7 * dk);
        N = normalize(N + (T * dn.x + Bt * dn.y) * 0.95 * dk);
        float dk2 = smoothstep(9.0, 3.0, vDist);   /* the nearest rock: a second, finer pass of the same grain (0.65 m, turned) */
        if (dk2 > 0.0) { mat2 r2 = mat2(0.8, -0.6, 0.6, 0.8); vec4 eA = mix(texture2D(tDetA, r2 * uvS * 2.7 + 0.37), texture2D(tDetA, r2 * uvT * 2.7 + 0.37), upw);
          vec3 en = mix(texture2D(tDetN, r2 * uvS * 2.7 + 0.37).xyz, texture2D(tDetN, r2 * uvT * 2.7 + 0.37).xyz, upw) * 2.0 - 1.0;
          alb *= mix(1.0, clamp(dot(eA.rgb, vec3(0.3, 0.59, 0.11)) * 2.0, 0.55, 1.45), 0.4 * dk2); N = normalize(N + (T * en.x + Bt * en.y) * 0.5 * dk2); }
#elif defined(SHADE2)
        alb *= mix(1.0, clamp(dot(dA.rgb, vec3(0.3, 0.59, 0.11)) * 2.0, 0.45, 1.6), 0.42 * dk);
        ao *= mix(1.0, dA.a, 0.6 * dk);
        N = normalize(N + (T * dn.x + Bt * dn.y) * 0.75 * dk);
#else
        alb *= mix(1.0, clamp(dot(dA.rgb, vec3(0.3, 0.59, 0.11)) * 2.0, 0.45, 1.6), 0.35 * dk);
        ao *= mix(1.0, dA.a, 0.5 * dk);
        N = normalize(N + (T * dn.x + Bt * dn.y) * 0.6 * dk);
#endif
      }
#endif
      vec3 hemi = mix(uGround, uSky, clamp(N.y * 0.5 + 0.5, 0.0, 1.0));
      float ndl = dot(N, normalize(uKeyDir));
#ifdef SHADE2
      /* the canyon's contrast: a firmer key, less fill; crevices darker near (AO), flatter far; a wet sheen on what faces up (gloss from
         AD-REEF's roughness); caustics only on up-facing parts; far rock loses colour and contrast toward the water before the fog takes it */
      float near = smoothstep(26.0, 4.0, vDist), top = smoothstep(0.3, 0.88, N.y);
      float aoK = pow(ao, mix(1.0, uAO, near));
#ifdef UWTEX
      /* UWTEX · light from above: the open water overhead is the main source (what faces up is lit, sides half, undersides in the
         water's shade: the rock's FORM reads), less flat fill, crevices deep; then the surface's caustics, projected DOWN the light so
         they run over the walls as wavy streaks too (not only the tops), strongest near the surface */
      vec3 Lk = normalize(uKeyDir);
      /* UWTEX phase 3 · both walls read: the light from above leans in from the gorge's open middle onto EACH wall (mirrored, smooth across
         x = 0), so the left wall gets the same grazing key, caustics and form as the right one (it sat in the key's shadow) */
      Lk = normalize(vec3(-clamp(vW.x / 3.0, -1.0, 1.0) * 0.36, 0.86, 0.34));
      ndl = dot(N, Lk);
      /* UWTEX phase 2 · per depth (the rock's own depth): the light from the surface weakens and turns blue on the way down
         (reds go first), the caustics fade out by ≈ −45 m; dpt 0 at the surface → 1 at the seabed */
      float dpt = smoothstep(-2.0, -58.0, vW.y);
      vec3 kCol = uKeyCol * mix(vec3(0.94, 0.98, 1.0), vec3(0.62, 0.8, 1.0), dpt) * mix(1.0, 0.62, dpt);
      float skyW = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);   /* the bright water overhead */
      vec3 fillW = mix(uGround, uSky, 0.5) * 0.32;   /* the water's own scattered light, from every side: shade goes navy, never black */
      vec3 amb = mix(uGround * 0.9, uSky * 1.15, skyW * skyW) * mix(1.0, 0.8, uTxTop * 0.5) * mix(1.0, 0.72, dpt) + fillW;
      /* form: up-facing steps lit, vertical faces mid, undersides in shade (phase 2: less flat fill — the −14 m upper wall read silver) */
      float keyT = max(ndl, 0.0) * (0.75 + 0.45 * uTxTop) + pow(skyW, 3.0) * 0.62 * uTxTop;
      vec3 col = alb * (amb * mix(0.25, 1.0, aoK) + kCol * keyT * mix(0.22, 1.0, aoK));
      col += alb * mix(uGround, uSky, 0.6) * 0.55 * max(-N.y, 0.0) * mix(0.4, 1.0, aoK);   /* light coming back up from the water / sand below: undersides keep their stone */
      /* the open water column between the walls glows: each wall is lit from the gorge's middle as well (both walls alike) */
      col += alb * uSky * 0.6 * uTxTop * mix(1.0, 0.7, dpt) * max(dot(N, normalize(vec3(-sign(vW.x), 0.25, 0.35))) * 0.85 + 0.15, 0.0) * mix(0.3, 1.0, aoK);
      vec3 V = normalize(cameraPosition - vW), Hh = normalize(Lk + V);
      float gloss = clamp(1.0 - NR.a, 0.0, 1.0);
      col += kCol * pow(max(dot(N, Hh), 0.0), mix(18.0, 70.0, gloss)) * uWet * 0.6 * (0.25 + 0.75 * gloss) * top * aoK * near;
      vec2 cp = vW.xz - Lk.xz / max(Lk.y, 0.35) * vW.y;
      float caus = causMove(tCaus, cp * 0.15, 0.8) * 1.55 * (0.45 + 1.1 * texture2D(tNoise, cp * 0.035 + vec2(uTime * 0.006, -uTime * 0.004)).r);   /* ≈ 0.4 m cells, brighter where the surface focuses */
      float cFace = smoothstep(-0.3, 0.45, ndl) * (0.6 + 0.4 * top) * smoothstep(-0.6, 0.1, N.y);   /* walls too (streaks), not the undersides */
      col += alb * kCol * caus * caus * uCaus * uTxCaus * cFace * aoK * 3.4 * pow(1.0 - smoothstep(-3.0, -46.0, vW.y), 1.4);
      vec3 bgc = bgAt(gl_FragCoord.xy);
      float far = smoothstep(9.0 + 5.0 * uTxClear, 34.0, vDist);
      col = mix(col, mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 0.5) * (0.82 + 0.18 * normalize(bgc + 1e-4) * 1.7), far * 0.55);
#else
      vec3 col = alb * (hemi * mix(0.32, 1.0, aoK) * 1.05 + uKeyCol * (max(ndl, 0.0) * 0.86 + clamp((ndl + 0.4) / 1.4, 0.0, 1.0) * 0.1) * mix(0.28, 1.0, aoK));
      vec3 V = normalize(cameraPosition - vW), Hh = normalize(normalize(uKeyDir) + V);
      float gloss = clamp(1.0 - NR.a, 0.0, 1.0);
      col += uKeyCol * pow(max(dot(N, Hh), 0.0), mix(18.0, 70.0, gloss)) * uWet * (0.25 + 0.75 * gloss) * top * aoK * near;
      float caus = causMove(tCaus, vW.xz * 0.23 + vec2(vW.y * 0.05, 0.0), 1.0) * 1.5;
      col += uKeyCol * caus * caus * uCaus * top * aoK * 0.5 * smoothstep(-34.0, 0.0, vW.y);
      vec3 bgc = bgAt(gl_FragCoord.xy);
      float far = smoothstep(7.0, 32.0, vDist);
      col = mix(col, mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 0.45) * (0.82 + 0.18 * normalize(bgc + 1e-4) * 1.7), far * 0.55);
#endif
#else
      vec3 col = alb * (hemi * mix(0.4, 1.0, ao) * 1.25 + uKeyCol * (max(ndl, 0.0) * 0.72 + clamp((ndl + 0.4) / 1.4, 0.0, 1.0) * 0.12) * mix(0.35, 1.0, ao));
      float caus = causMove(tCaus, vW.xz * 0.23 + vec2(vW.y * 0.05, 0.0), 1.0) * 1.5;
      col += uKeyCol * caus * caus * uCaus * mix(0.15, 1.0, smoothstep(0.2, 0.85, N.y)) * ao * 0.45 * smoothstep(-30.0, 0.0, vW.y);
#endif
#if defined(UWTEX)
      /* UWTEX · a scan's open underside / a ledge seen from below: rock in the water's shade — its own texture and crevices, lifted by
         the scattered light (the client's 「破格」 flat black slabs must not come back) */
      if (!gl_FrontFacing) col = col * 0.55 + alb * mix(0.35, 1.0, aoK) * (mix(uGround, uSky, 0.5) * 1.6 + fillW) * (0.75 + 0.6 * skyW);
#elif defined(SHADE2) && defined(NEAR2)
      /* UW-BUILD (AD-REEF's note 4): a ledge's underside seen from below is rock in shade (its albedo, its crevices, the water's light from
         below and around), not a flat dark sheet */
      if (!gl_FrontFacing) col = alb * aoK * (mix(uGround, uSky, 0.35) * 0.62 + uKeyCol * 0.04);
#else
      if (!gl_FrontFacing) col *= 0.3;   /* the scan's open underside / cut faces: dark, never see-through */
#endif
#ifdef UWTEX
      /* UWTEX · clearer near the lens: the water's haze thins inside ≈ 12 m (the near wall keeps its stone colour and contrast), the far
         one still melts into the blue — so the picture has depth */
      float fd = max(vDist - 0.5, 0.0), f = 1.0 - exp(-fd * uFogK * (1.0 - 0.5 * uTxClear * smoothstep(14.0, 3.0, vDist)) - fd * fd * 0.00012);
#else
      float fd = max(vDist - 0.5, 0.0), f = 1.0 - exp(-fd * uFogK - fd * fd * 0.00012);
#endif
#ifdef UWVEIL
      f = f + (1.0 - f) * boostAt(gl_FragCoord.xy) * 0.3 * mix(0.5, 1.0, smoothstep(5.0, 9.0, vDist));   /* UWTEX: the texts' legibility veil at half, so the wall behind the text keeps its form and life */
#else
      f = f + (1.0 - f) * boostAt(gl_FragCoord.xy) * mix(0.5, 1.0, smoothstep(5.0, 9.0, vDist));
#endif
      gFar = smoothstep(0.04, 0.72, f); col = mix(col, bgAt(gl_FragCoord.xy), clamp(f, 0.0, 1.0));
      gl_FragColor = vec4(toSRGB(col), 1.0);
    }`;
  async function loadReef() {
    /* PHASE 4 · the ADs' deliveries, picked up by their manifests (formats in STATUS-DEEP.md); our own bakes stand in until they exist */
    const getJson = u => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
    const MF = UWQ.get('uwAD') === '0' ? null : await getJson(ASSETS + 'uw-manifest.json');   /* always present (no 404s): { reef: null | {...}, life: null | {...} } */
    const RM = MF && MF.reef || null, LM = NOLIFE ? null : MF && MF.life || null;
    info.adReef = !!RM; info.adLife = !!LM;
    if (MTN) { try { await loadMtn(RM); } catch (error) { bommie = null; info.reefError = 'mtn: ' + String(error && error.message || error); } }
    if (REEF3) { try { await loadReef3(RM); } catch (error) { bommie = null; info.reefError = 'reef3: ' + String(error && error.message || error); } }
    if (!bommie && RM && RM.kit === 'reef2') { try { await loadKit2(RM); } catch (error) { bommie = null; info.reefError = 'reef2: ' + String(error && error.message || error); } }
    const B = RM && RM.walls ? ASSETS + 'reef/' : ASSETS + 'bommie/', W = RM && RM.walls || { glb: 'bommie-chunks.glb', glbLo: 'bommie-chunks-lo.glb', albedo: 'bommie-albedo-ao', normal: 'bommie-normal', px: 2048 };
    const tl = (u, srgb) => load(u, srgb).then(t => { if (t) { t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; } return t; });
    if (RM && RM.sand) {
      const tr = (u, srgb) => load(u, srgb).then(t => { if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; } return t; });
      const [sa, sn] = await Promise.all([tr(tierUrl(ASSETS + 'reef/', RM.sand.albedo, RM.sand.px || 2048), true), RM.sand.normal ? tr(tierUrl(ASSETS + 'reef/', RM.sand.normal, RM.sand.px || 2048), false) : null]);
      if (sa) sandTex = { a: sa, n: sn, tile: RM.sand.tile || 4 };
    }
    /* UW-BUILD: with AD-REEF's kit the old bommie set (2.6 MB) and, with AD-LIFE's coral atlas, the aqua atlas were downloaded and never used */
    const skipOld = !UW3D && bommie && (bommie.kit === 'reef2' || bommie.kit === 'reef3' || bommie.kit === 'mtn'), skipAqua = NOLIFE || (!UW3D && LM && LM.coralAtlas);
    const [mod, alb, nrm, atlas] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), skipOld ? null : tl(tierUrl(B, W.albedo, W.px || 2048), true), skipOld ? null : tl(tierUrl(B, W.normal, W.px || 2048), false),
      skipAqua ? null : load(tierUrl(ASSETS + 'aqua/', 'aqua-atlas', 1024), true)]);
    if (LM && LM.plantsAtlas) { const pa = await load(tierUrl(ASSETS + 'life/', LM.plantsAtlas, LM.plantsPx || 1024), true); if (pa) { pa.wrapS = pa.wrapT = THREE.ClampToEdgeWrapping; pa.anisotropy = 4; plantMat2.uniforms.tAtlas.value = pa; plants2OK = true; } }
    if (LM) lifeExtra = LM;
    if (LM && LM.coralAtlas) {   /* AD-LIFE's coral / plant atlas (4 × 2 cells) replaces ours whole */
      const ca = await load(tierUrl(ASSETS + 'life/', LM.coralAtlas, LM.coralPx || 2048), true);
      if (ca) { ca.wrapS = ca.wrapT = THREE.ClampToEdgeWrapping; ca.anisotropy = 4; plantMat.uniforms.tAtlas.value = ca; aquaOK = true; if (atlas) atlas.dispose(); }
    } else if (atlas && atlas.image) {
      /* cells 0–4: the aquarium plants; 5–7: our own soft coral, sea fan and tube sponges (warm accents, from the canvas atlas) */
      const W = atlas.image.width, Hh = atlas.image.height, Cc = W / 4, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
      const g = cv.getContext('2d'); g.drawImage(atlas.image, 0, 0); const sea = tAtlas.image;
      for (const [dst, src] of [[5, 0], [6, 5], [7, 7]]) { g.clearRect((dst % 4) * Cc, Math.floor(dst / 4) * Cc, Cc, Cc); g.drawImage(sea, (src % 4) * 128, Math.floor(src / 4) * 128, 128, 128, (dst % 4) * Cc, Math.floor(dst / 4) * Cc, Cc, Cc); }
      const ct = new THREE.CanvasTexture(cv); ct.colorSpace = THREE.SRGBColorSpace; ct.generateMipmaps = true; ct.minFilter = THREE.LinearMipmapLinearFilter; ct.anisotropy = 2;
      ct.wrapS = ct.wrapT = THREE.ClampToEdgeWrapping; plantMat.uniforms.tAtlas.value = ct; aquaOK = true; atlas.dispose();
    }
    if (bommie) { info.reef = bommie.kit || 'reef2'; }
    else {
    if (!alb || !nrm) throw new Error('reef textures missing');
    const [gltf, glo] = await Promise.all([new mod.GLTFLoader().loadAsync(B + W.glb), W.glbLo ? new mod.GLTFLoader().loadAsync(B + W.glbLo).catch(() => null) : null]);
    const lo = {}; if (glo) glo.scene.traverse(o => { if (o.isMesh) lo[o.name] = o.geometry; });   /* bake/bommie_lod.py: a third of the triangles, same UVs */
    const chunks = []; gltf.scene.traverse(o => { if (o.isMesh) chunks.push(o); });
    chunks.sort((a, b) => a.name.localeCompare(b.name));
    if (chunks.length < 1) throw new Error('reef chunks: ' + chunks.length);
    const mat = new THREE.ShaderMaterial({ uniforms: { ...C, ...L, tAlb: { value: alb }, tNrm: { value: nrm }, uTint: { value: hex(T.reefTint || '#d2e2e6') }, uSat: { value: 0.6 }, uNormK: { value: 1.0 }, uFogK: { value: UWT.fogK } },
      vertexShader: bommieVS, fragmentShader: bommieFS, side: THREE.DoubleSide });
    bommie = { mat, chunks: chunks.map(o => {
      const g = o.geometry; g.computeBoundingBox();
      /* plant anchors: points with their normals (only those that face up once the chunk is placed get plants) */
      const P = g.attributes.position, N = g.attributes.normal, R = rng(31 + P.count), anchors = [];
      for (let k = 0; k < 400; k++) { const i = Math.floor(R() * P.count); anchors.push(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i)); }
      const lg = lo[o.name] || null;
      return { geo: g, bb: g.boundingBox, anchors, tris: g.index ? g.index.count / 3 : P.count / 3, lo: lg, loTris: lg ? lg.index.count / 3 : 0 };
    }) };
    info.reef = bommie.chunks.map(c => Math.round(c.tris));
    }
    /* AD-LIFE's fish species (each its own instanced draw, its own schools) */
    if (LM && Array.isArray(LM.fish)) for (const sp of LM.fish) {
      try {
        const nAll = (sp.schools || []).reduce((a, c) => a + (c.n || 0), 0), file = sp.glbLo && nAll > 150 ? sp.glbLo : sp.glb;   /* big schools: AD-LIFE's 80-tri LOD */
        const [fg, ft] = await Promise.all([new mod.GLTFLoader().loadAsync(ASSETS + 'life/' + file), load(tierUrl(ASSETS + 'life/', sp.tex, LIFE_HALF ? Math.max(256, (sp.px || 512) / 2) : sp.px || 512), true)]);
        let fm = null; fg.scene.traverse(o => { if (o.isMesh && !fm) fm = o; });
        if (fm && ft) { ft.flipY = false; ft.wrapS = ft.wrapT = THREE.ClampToEdgeWrapping; fishSpecies.push({ geo: fm.geometry, tex: ft, spec: sp }); }
      } catch (error) { info.fishError = String(error && error.message || error); }
    }
    if (LM && (LM.corals3d || LM.kelp || LM.heroes || LM.sponge)) { try { await loadLife3d(LM); } catch (error) { info.life3dError = String(error && error.message || error); } }
    /* the fish (our own: bake/bake_fish.py) */
    if (!NOLIFE) try {
      const [fg, ft] = await Promise.all([new mod.GLTFLoader().loadAsync(ASSETS + 'fish/fish.glb'), load(tierUrl(ASSETS + 'fish/', 'fish-albedo', 256), true)]);
      let fm = null; fg.scene.traverse(o => { if (o.isMesh && !fm) fm = o; });
      if (fm && ft) { ft.flipY = false; ft.wrapS = ft.wrapT = THREE.ClampToEdgeWrapping; fishSrc = { geo: fm.geometry, tex: ft }; }
    } catch (error) { info.fishError = String(error && error.message || error); }
  }
  /* AD-REEF's kit (assets/reef2/, Poly Haven CC0 scans; spec in STATUS-ADREEF.md): wall chunks (natural up = +X, relief = +Y, run = Z)
     and rock pieces (+Y up, foot at 0), each in three LODs with shared atlases; tiling sand (8 m) and a coral-crust detail set (1.75 m) */
  async function loadKit2(RM) {
    const B = ASSETS + (UWTEX ? 'reef3' : (RM.dir || 'reef2')) + '/', low = !!(texTier && texTier.tier === 'low'), mod = await import('three/addons/loaders/GLTFLoader.js');
    const tl = (u, srgb) => load(u, srgb).then(t => { if (t) { t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; } return t; });
    const tr = (u, srgb) => load(u, srgb).then(t => { if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; } return t; });
    const gl = f => new mod.GLTFLoader().loadAsync(B + f).catch(() => null);
    const [wA, wN, rA, rN, sA, sN, sH, dA, dN, w0, w1, w2, r0, r1, r2] = await Promise.all([
      tl(tierUrl(B, 'walls-albedo-ao', FAR_ON && UWQ.get('uwWalls') !== '2048' ? 1024 : 2048), true), tl(tierUrl(B, 'walls-normal', FAR_ON && UWQ.get('uwWalls') !== '2048' ? 1024 : 2048), false),   /* UW-BUILD: 1024 with the far layer (VRAM for the decoders; the detail set carries the close-up grain); ?uwWalls=2048 = as before */
      tl(tierUrl(B, 'rocks-albedo-ao', 1024), true), tl(tierUrl(B, 'rocks-normal', 1024), false),
      tr(tierUrl(B, 'sand-albedo-ao', 1024), true), tr(tierUrl(B, 'sand-normal', 1024), false), FAR_ON || (texTier && texTier.tier && texTier.tier !== 'high') ? null : tr(tierUrl(B, 'sand-height', 1024), false),
      low ? null : tr(tierUrl(B, 'detail-albedo-ao', 1024), true), low ? null : tr(tierUrl(B, 'detail-normal', 1024), false),
      gl('walls-chunks.glb'), gl('walls-chunks-lo.glb'), gl('walls-chunks-lo2.glb'), gl('rocks-chunks.glb'), gl('rocks-chunks-lo.glb'), gl('rocks-chunks-lo2.glb')]);
    if (!wA || !wN || !rA || !rN || !w0 || !r0) throw new Error('kit incomplete');
    const by = g => { const m = {}; if (g) g.scene.traverse(o => { if (o.isMesh) m[o.name] = o.geometry; }); return m; };
    const pieces = (g0, g1, g2) => { const a = by(g0), b = by(g1), c = by(g2);
      return Object.keys(a).sort().map(nm => { const geo = a[nm]; geo.computeBoundingBox(); geo.computeBoundingSphere();
        const P = geo.attributes.position, N = geo.attributes.normal, R = rng(57 + P.count), anchors = [];
        for (let k = 0; k < 300; k++) { const i = Math.floor(R() * P.count); anchors.push(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i)); }
        const lo = b[nm] || geo, lo2 = c[nm] || lo; [lo, lo2].forEach(g => { g.computeBoundingSphere(); });
        return { name: nm, geo, lo, lo2, bb: geo.boundingBox, anchors, tris: geo.index.count / 3, loTris: lo.index.count / 3, lo2Tris: lo2.index.count / 3 }; }); };
    const det = !!(dA && dN);
    const SH2 = UWQ.get('uwShade') !== '0', defs = Object.assign({}, det ? { DETAIL: 1 } : {}, SH2 ? { SHADE2: 1 } : {}, NEAR2 ? { NEAR2: 1 } : {}, UWTEX && SH2 ? { UWTEX: 1 } : {}, UWTEX ? { UWVEIL: 1 } : {});   /* UWTEX: reef3 + its light (above) */
    const mk = (alb, nrm) => new THREE.ShaderMaterial({ defines: defs, uniforms: { ...C, ...L, tAlb: { value: alb }, tNrm: { value: nrm }, tDetA: { value: dA || tNoise }, tDetN: { value: dN || tNoise },
      uWet: UWU.wet, uAO: UWU.aoK, uDetTile: { value: 1.75 }, uSat: { value: UWTEX ? 0.85 : SH2 ? 0.6 : RIVER ? 0.42 : 0.6 }, uTint: { value: hex(UWTEX ? '#e2e8ea' : T.reefTint || (RIVER ? '#d6dde2' : '#d4e2e6')) }, uNormK: { value: 1.0 }, uFogK: { value: UWT.fogK },
      uTxCaus: UWTXU.caus, uTxClear: UWTXU.clear, uTxTop: UWTXU.top }, vertexShader: bommieVS, fragmentShader: bommieFS, side: THREE.DoubleSide });   /* UWTEX: reef3 carries its stone's own colour (no chroma pre-boost) → saturation 0.85, near-neutral tint */
    bommie = { kit: 'reef2', mat: mk(wA, wN), rockMat: mk(rA, rN), chunks: pieces(w0, w1, w2), rocks: pieces(r0, r1, r2), detail: det };
    if (UWTEX) { const df = Object.assign({}, defs); delete df.DETAIL;   /* UWTEX phase 3: the far layers (≥ 20 m) skip the close-up detail taps (invisible there) — same uniforms */
      bommie.farMat = new THREE.ShaderMaterial({ defines: df, uniforms: bommie.mat.uniforms, vertexShader: bommieVS, fragmentShader: bommieFS, side: THREE.DoubleSide });
      bommie.farRockMat = new THREE.ShaderMaterial({ defines: Object.assign({}, df), uniforms: bommie.rockMat.uniforms, vertexShader: bommieVS, fragmentShader: bommieFS, side: THREE.DoubleSide }); }
    if (NEAR2) { bommie.mat.uniforms.uNormK.value = uwNum('uwRelief', 1.25); bommie.rockMat.uniforms.uNormK.value = uwNum('uwRelief', 1.25) * 0.92; }   /* AD-REEF's note 3: the facets read flat under a top light */
    sandTex = sA ? { a: sA, n: sN, h: sH, tile: 8, kit2: true } : sandTex;
    info.kit = { walls: bommie.chunks.map(c => c.name), rocks: bommie.rocks.map(c => c.name), detail: det };
  }
  /* OCEAN pass 7 · the canyon mountains under water. Material: the cliffs' own photograph and relief map (assets/baked/cliff-color, cliff-normal —
     the half-size copies of what the canyon above uses, already in the browser's cache), projected in world space at the canyon's two scales
     (9 m and 34 m a tile), kept mostly as light and shade over the slate's colour as up there, with level strata; lit from the surface, toned
     by depth, with the moving caustics and the water's haze. Geometry: two cliff faces built once on the CPU (about 20 k triangles in all):
     terraced strata, buttresses and gullies, steep at the surface and spreading toward the seabed, plus a few boulders of the same rock. */
  const mtnVS = /* glsl */`attribute float aAO; varying vec3 vW; varying vec3 vN; varying float vAO; varying float vDist;
    void main(){
      vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
      vAO = aAO; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv;
    }`;
  const mtnFS = CM + /* glsl */`
    uniform sampler2D tCliff, tCliffN, tCaus; uniform vec3 uKeyDir, uKeyCol, uSky, uGround, uRockTint; uniform float uFogK, uCaus, uNear, uFar, uRelief;
    varying vec3 vW; varying vec3 vN; varying float vAO; varying float vDist;
    #ifdef RISE_WATERLINE
      ${riseLighting ? OC.riseLightGLSL : ''}
      uniform float uRiseCausticTime, uRiseBedRippleSize, uRiseCausticStrength;
      uniform float uRiseRockOpacity, uRiseRockDetail;
    #endif
    void main(){
      vec3 N0 = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), aN = abs(N0);
      /* the wall's own plane (the larger of x / z decides), tops from above */
      float sx = step(aN.z, aN.x), up = smoothstep(0.55, 0.85, aN.y);
      vec2 pw = mix(vW.xy, vW.zy, sx), pt = vW.xz, uvN = mix(pw, pt, step(0.5, up)) / uNear, uvF = pw / uFar + 0.37;
      vec3 cN = texture2D(tCliff, uvN).rgb, cF = texture2D(tCliff, uvF).rgb;
      float lN = dot(cN, vec3(0.3, 0.59, 0.11)), lF = dot(cF, vec3(0.3, 0.59, 0.11));
      /* as on the canyon's walls: the photograph is the stone's light and shade (contrast 1.7) with a little of its own colour (0.16) */
      float lum = pow(clamp(lN / 0.36, 0.05, 3.0), 1.7) * mix(1.0, pow(clamp(lF / 0.36, 0.2, 2.2), 1.2), 0.6);
      vec3 chroma = mix(vec3(1.0), cN / max(lN, 0.02), 0.16);
      /* level strata: bands of lighter and darker beds, a thin dark line under each ledge */
      float strataY = vW.y;
      #ifdef RISE_WATERLINE
        float fault = texture2D(tNoise, vW.xz * vec2(0.018, 0.032) + 0.37).r - 0.5;
        strataY += fault * 4.2 + vW.z * (vW.x < 0.0 ? 0.061 : -0.038);
      #endif
      float bed = texture2D(tNoise, vec2(strataY * 0.045 + 0.2, 0.37 + (vW.z + vW.x) * 0.0016)).r, bed2 = texture2D(tNoise, vec2(strataY * 0.21, 0.71 + vW.z * 0.004)).r;
      vec3 alb = uRockTint * 1.15 * lum * chroma * (0.68 + 0.6 * bed) * (0.84 + 0.32 * bed2);
      vec3 tn = texture2D(tCliffN, uvN).xyz * 2.0 - 1.0; tn.xy *= uRelief;
      #ifdef RISE_WATERLINE
        tn.xy *= uRiseRockDetail;
      #endif
      vec3 T = normalize(mix(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), step(0.5, up) + (1.0 - step(0.5, up)) * (1.0 - sx))), B = normalize(cross(N0, T)); T = cross(B, N0);
      vec3 N = normalize(T * tn.x + B * tn.y + N0 * max(tn.z, 0.1));
      float dpt = smoothstep(2.0, 58.0, -vW.y), ao = vAO;
      vec3 Lk = normalize(vec3(-clamp(vW.x / 3.0, -1.0, 1.0) * 0.4, 0.84, 0.36));           /* the light from the open middle of the gorge, onto EACH wall */
      #ifdef RISE_WATERLINE
        Lk = normalize(uKeyDir);
      #endif
      vec3 kCol = uKeyCol * mix(vec3(0.95, 0.98, 1.0), vec3(0.6, 0.8, 1.0), dpt) * mix(1.0, 0.55, dpt);
      float ndl = dot(N, Lk), diff = max(ndl, 0.0) * 1.1 + clamp((ndl + 0.5) / 1.5, 0.0, 1.0) * 0.4;
      vec3 hemi = mix(uGround * 1.6, uSky * 1.5, clamp(N.y * 0.5 + 0.5, 0.0, 1.0)) * mix(1.0, 0.72, dpt);
      vec3 col = alb * (hemi * mix(0.4, 1.0, ao) + kCol * diff * mix(0.3, 1.0, ao));
      vec2 cp = vW.xz - Lk.xz / max(Lk.y, 0.35) * vW.y;
      #ifdef RISE_WATERLINE
        float caus = texture2D(tCaus, cp * (0.14 / uRiseBedRippleSize) + vec2(0.012, 0.006) * uRiseCausticTime).r
          * lightFootprint(cp, vec2(21.0, 17.5)) * uRiseCausticStrength * 1.15;
      #else
        float caus = causMove(tCaus, cp * 0.17, 0.8) * 1.5;
      #endif
      col += alb * kCol * caus * caus * uCaus * (0.35 + 0.65 * smoothstep(0.1, 0.7, N.y)) * ao * 2.2 * pow(1.0 - smoothstep(3.0, 46.0, -vW.y), 1.4);
      vec3 V = normalize(cameraPosition - vW), bg = bgAt(gl_FragCoord.xy);
      col += bg * pow(1.0 - max(dot(N0, V), 0.0), 3.0) * 0.3 * ao;
      #ifdef RISE_WATERLINE
        float dist = length(cameraPosition - vW);
        float depth = max(0.0, -vW.y);
        float edge = smoothstep(-0.12, 0.65, -vW.y) * (1.0 - smoothstep(61.0, 103.0, dist));
        float visibility = edge * exp(-0.48 * uRiseFogDensity * dist) * (0.60 + 0.20 * smoothstep(0.5, 9.0, depth));
        vec3 throughWater = exp(-uRiseFogDensity * dist * vec3(1.35, 0.76, 0.44));
        vec3 slate = vec3(0.012,0.036,0.059) + min(col,vec3(0.92)) * throughWater * 0.84;
        // Scattered skylight picks out pale layers even on the shaded bank.
        float paleBed = smoothstep(0.15,0.56,lN) * (0.45 + 0.55 * smoothstep(0.18,0.56,lF));
        float ledge = smoothstep(-0.12,0.70,N0.y) * (0.52 + 0.48 * bed);
        slate += vec3(0.11,0.16,0.18) * throughWater * paleBed * (0.28 + 0.72 * ledge);
        gl_FragColor = vec4(toSRGB(slate), visibility * uRiseRockOpacity);
      #else
      float fd = max(vDist - 0.5, 0.0), f = 1.0 - exp(-fd * uFogK - fd * fd * 0.00014);
      f = f + (1.0 - f) * boostAt(gl_FragCoord.xy) * mix(0.5, 1.0, smoothstep(5.0, 9.0, vDist));
      f = max(f, smoothstep(${uwNum('ocFeatherB', -38).toFixed(2)}, ${uwNum('ocFeatherA', -25).toFixed(2)}, vW.y + 3.0 * (texture2D(tNoise, vW.xz * 0.02).r - 0.5)));   /* lead 11-18 night (client: feather or remove the rock): the walls dissolve into the water toward the surface, no hard edge against the ceiling (?ocFeatherA= / ?ocFeatherB= m) */
      col = mix(col, bg, clamp(f, 0.0, 1.0));
      gl_FragColor = vec4(toSRGB(col), 1.0);
      #endif
    }`;
  let riseBankGroup = null, measuredWaterEdges = null;
  const initialBank = (side, z) => 31.5 + 1.8 * Math.sin(z * 0.067 + side * 2) - z * 0.046;
  const shoreWeight = y => (1 - ss(21, 48, -y)) * (1 - 0.39 * ss(0, 23, -y));
  function fitWaterEdges(edges) {
    if (!edges) return;
    measuredWaterEdges = edges;
    if (!riseBankGroup) return;
    for (const mesh of riseBankGroup.children) {
      const { side, columns, baseShoreX } = mesh.userData;
      if (!columns) continue;
      const pos = mesh.geometry.attributes.position;
      const edge = edges[side < 0 ? 0 : 1];
      let k = 0;
      for (let i = columns - 1; i >= 0; i--) {
        const z = pos.getZ(i);
        while (k < edge.length - 2 && edge[k + 1].z < z) k++;
        const a = edge[k], b = edge[k + 1];
        const t = clamp01((z - a.z) / Math.max(0.001,b.z - a.z));
        const offset = a.x + (b.x - a.x) * t - side * initialBank(side, z);
        for (let v = i; v < pos.count; v += columns) {
          pos.setX(v, baseShoreX[v] + offset * shoreWeight(pos.getY(v)));
        }
      }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
  }
  async function loadMtn(RM) {
    const B2 = ASSETS + ((RM && RM.dir) || 'reef2') + '/';
    const tr = (u, srgb) => load(u, srgb).then(t => { if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; } return t; });
    const [cC, cN, sA, sN] = await Promise.all([tr(url('cliff-color', 1024), true), tr(url('cliff-normal', 1024), false), tr(tierUrl(B2, 'sand-albedo-ao', 1024), true), tr(tierUrl(B2, 'sand-normal', 1024), false)]);
    if (!cC || !cN) throw new Error('cliff maps missing');
    const mat = new THREE.ShaderMaterial({ uniforms: { ...C, ...L, tCliff: { value: cC }, tCliffN: { value: cN }, uNear: { value: uwNum('ocMtnNear', 9) }, uFar: { value: uwNum('ocMtnFar', 34) }, uRelief: { value: uwNum('ocMtnRelief', 1.15) }, uFogK: { value: UWT.fogK } },
      vertexShader: mtnVS, fragmentShader: riseDefine + mtnFS, side: riseWaterline ? THREE.FrontSide : THREE.DoubleSide,
      transparent: riseWaterline, depthWrite: !riseWaterline });
    if (riseWaterline) {
      Object.assign(mat.uniforms, riseLighting.uniforms);
      mat.forceSinglePass = true;
    }
    bommie = { kit: 'mtn', mat };
    if (sA) sandTex = { a: sA, n: sN, h: null, tile: 8, kit2: true };
    info.kit = { mtn: true };
  }
  function placeMountains(aspect) {
    const grp = new THREE.Group(), R = rng(7107), narrow = aspect < 1; grp.name = 'descent-mtn';
    /* small value noise (deterministic) */
    const H2 = (i, j) => { const h = Math.sin(i * 127.1 + j * 311.7 + 17.3) * 43758.5453; return h - Math.floor(h); };
    const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      return (H2(ix, iy) * (1 - ux) + H2(ix + 1, iy) * ux) * (1 - uy) + (H2(ix, iy + 1) * (1 - ux) + H2(ix + 1, iy + 1) * ux) * uy; };
    const fbm = (x, y) => vn(x, y) * 0.55 + vn(x * 2.13 + 5.1, y * 2.13 + 1.7) * 0.3 + vn(x * 4.7 + 9.2, y * 4.7 + 3.3) * 0.15;
    const TOP = uwNum('ocMtnTop', riseWaterline ? 0.2 : -24), BOT = DESC.sea - 3;
    const Z0 = 7, Z1 = riseWaterline ? -111 : -66, NZ = riseWaterline ? 80 : 56, NY = 96, lane = narrow && !riseWaterline ? 0.7 : 1;
    let tris0 = 0, n = 0;
    /* how far from the lane's middle the face stands at (y, z) on one side: steep cliffs at the surface (where the mountains meet the water),
       level beds stepping out, buttresses and gullies down the face, the foot spreading toward the seabed */
    const face = (side, y, z) => {
      const so = side * 3.7, bed = y / 3.4 + 1.3 * fbm(z * 0.045 + so, y * 0.03), fr = bed - Math.floor(bed), step = Math.floor(bed) + ss(0.72, 1.0, fr);
      const inner = (5.3 + 0.085 * -Math.min(z, 0) + 1.3 * Math.sin(z * 0.11 + so) + 0.8 * Math.sin(z * 0.047 + so * 2.1) + uwNum('ocMtnSplay', 10) * ss(-13, 0.3, y)) * lane;   /* lead 11-18 night: the faces splay out toward the surface, so the ceiling stays wide overhead (client: no funnel) */
      const rib = 1 - Math.abs(2 * vn(z * 0.13 + so * 1.7, y * 0.012 + 3) - 1);                       /* buttresses (ridged, nearly vertical) */
      const x = inner + 1.5 * (bed - step) + 1.9 * (0.5 - rib) + 2.2 * (fbm(z * 0.09 + so, y * 0.08 + 7) - 0.5) + 0.5 * (fbm(z * 0.5 + so, y * 0.45) - 0.5)
        + 0.9 * ss(-4, 7, y) - 2.0 * ss(-22, BOT, y) * (0.5 + fbm(z * 0.05 + so, 4));
      const close = ss(-42, -64, z);   /* the gorge closes far ahead (in the haze): no bright slot of surface at its end */
      return [Math.max(2.7 * lane, x) * (1 - uwNum('ocMtnClose', 0) * close), 0.45 + 0.55 * ss(0.0, 0.5, fr > 0.72 ? 1 : fr) * (0.55 + 0.45 * rib)];
    };
    const submergedRelief = (side, y, z) => {
      const depth = -y;
      const shoulder = ss(0.8, 4.6, depth) * (1 - ss(22, 42, depth));
      const shear = side < 0 ? 0.063 : -0.042;
      const seed = side < 0 ? 19.6 : 44.7;
      const folds = vn(z * 0.047 + seed, y * 0.054 + 3.4);
      const ledges = smoothRockLedge(z, y, shear, seed, folds);
      const gully = ss(0.59, 0.83, vn(z * 0.092 + y * 0.029 + seed, 6.4 - y * 0.037));
      const joints = fbm(z * 0.18 + seed, y * 0.21 + folds);
      return shoulder * (3.6 * (folds - 0.45) - 2.7 * ledges + 3.8 * gully + 1.8 * (joints - 0.5));
    };
    function smoothRockLedge(z, y, shear, seed, folds) {
      const displacement = 2.25 * vn(z * 0.108 + seed, 9.1);
      const bed = (y + shear * z + 3.8 * folds + displacement) / (shear > 0 ? 4.9 : 6.6);
      const seam = 1 - Math.abs(2 * (bed - Math.floor(bed)) - 1);
      return ss(0.08, 0.74, seam) * ss(0.30, 0.74, vn(z * 0.071 + seed, bed * 0.87));
    }
    for (const side of [-1, 1]) {
      const P = new Float32Array((NZ + 1) * (NY + 1) * 3), A = new Float32Array((NZ + 1) * (NY + 1)), I = [];
      const shoreTops = riseWaterline ? Array.from({ length: NZ + 1 }, (_, i) =>
        face(side, TOP, Z0 + (Z1 - Z0) * Math.pow(i / NZ, 1.25))[0]) : null;
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= NZ; i++) { const z = Z0 + (Z1 - Z0) * Math.pow(i / NZ, 1.25), y = TOP + (BOT - TOP) * j / NY, k = j * (NZ + 1) + i, [x, ao] = face(side, y, z);
        let width = x;
        if (shoreTops) {
          const shallow = 1 - ss(21,48,-y);
          width = x * (1 - shallow) + initialBank(side,z) * shoreWeight(y)
            + (x - shoreTops[i]) * shallow * ss(0,5,-y) * 0.58
            + submergedRelief(side, y, z);
        }
        P[k * 3] = side * width; P[k * 3 + 1] = y; P[k * 3 + 2] = z; A[k] = ao; }
      const reverseFaces = riseWaterline ? side < 0 : side > 0;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NZ; i++) {
        const a = j * (NZ + 1) + i, b = a + 1, c = a + NZ + 1, d = c + 1;
        if (reverseFaces) I.push(a, c, b, b, c, d); else I.push(a, b, c, b, d, c);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aAO', new THREE.BufferAttribute(A, 1)); g.setIndex(I); g.computeVertexNormals();
      const m = new THREE.Mesh(g, bommie.mat); m.renderOrder = 2; m.frustumCulled = false; grp.add(m); tris0 += I.length / 3; n++;
      if (riseWaterline) {
        m.userData.side = side; m.userData.columns = NZ + 1;
        m.userData.baseShoreX = Float32Array.from(A, (_, i) => P[i * 3]);
      }
    }
    /* boulders of the same rock on the sand, at both sides of the lane (none in its middle) */
    for (let i = 0; i < 9; i++) { const side = i % 2 ? 1 : -1, x = side * (3.2 + R() * 6.5), z = -7 - R() * 30, r = 0.6 + R() * R() * 2.0, g = new THREE.IcosahedronGeometry(1, 3).toNonIndexed ? new THREE.IcosahedronGeometry(1, 3) : null;
      const P = g.attributes.position, A = new Float32Array(P.count), so = i * 5.3;
      for (let k = 0; k < P.count; k++) { const px = P.getX(k), py = P.getY(k), pz = P.getZ(k), d = 0.72 + 0.5 * fbm(px * 1.3 + so, pz * 1.3 + py * 0.9) + 0.14 * fbm(px * 4 + so, py * 4 + pz * 3);
        P.setXYZ(k, px * d * 1.25, py * d * 0.72, pz * d); A[k] = 0.5 + 0.5 * ss(-0.5, 0.4, py); }
      g.setAttribute('aAO', new THREE.BufferAttribute(A, 1)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, bommie.mat); m.position.set(x, seabedH(x, z) + r * 0.22, z); m.rotation.y = R() * 6.283; m.scale.setScalar(r); m.renderOrder = 2; grp.add(m); tris0 += P.count / 3; n++; }
    scene.add(grp); groups.push(grp);
    if (riseWaterline) { riseBankGroup = grp; fitWaterEdges(measuredWaterEdges); }
    info.tris += tris0; info.slabs = n; info.layers.push({ mtn: n, lod0Tris: Math.round(tris0) });
  }
  /* OCEAN pass 6 · the client's reef scan (assets/reef-scan3/: "Coral Reef Outcrop" by Ben M. Ritt, CC-BY-4.0 — CREDITS.md there): ONE patch of sand
     and coral (11 × 15 m, 2.8 m of relief, an open shell), 11 k triangles + a 3 k LOD with its own maps. The gorge is built from copies of it:
     stood on their side as the two walls (relief toward the lane, rims sunk into each other), lying on the seabed, small steep ones as boulders.
     The same lighting, caustics and haze as the reef kit's material; the scan's cyan is calmed into our palette (uSat, uTint ← ocTone). */
  async function loadReef3(RM) {
    const B = ASSETS + 'reef-scan3/', B2 = ASSETS + ((RM && RM.dir) || 'reef2') + '/', mod = await import('three/addons/loaders/GLTFLoader.js'), big = texTier && texTier.tier === 'low' ? 1024 : 2048;
    const tl = (u, srgb) => load(u, srgb).then(t => { if (t) { t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; } return t; });
    const tr = (u, srgb) => load(u, srgb).then(t => { if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; } return t; });
    const gl = f => new mod.GLTFLoader().loadAsync(B + f).catch(() => null);
    const [bA, bN, bO, lA, lN, sA, sN, g0, g1] = await Promise.all([tl(B + 'reef3-base-' + big + '.webp', true), tl(B + 'reef3-normal-' + big + '.webp', false), tl(B + 'reef3-ao-1024.webp', false),
      tl(B + 'reef3-lod1-base-1024.webp', true), tl(B + 'reef3-lod1-normal-1024.webp', false), tr(tierUrl(B2, 'sand-albedo-ao', 1024), true), tr(tierUrl(B2, 'sand-normal', 1024), false), gl('reef3.glb'), gl('reef3-lod1.glb')]);
    if (!bA || !bN || !g0) throw new Error('scan incomplete');
    const first = g => { let m = null; if (g) g.scene.traverse(o => { if (o.isMesh && !m) m = o.geometry; }); return m; };
    const geo = first(g0), lo = (lA && lN && first(g1)) || geo; geo.computeBoundingBox(); geo.computeBoundingSphere(); lo.computeBoundingSphere();
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;
    const fs = bommieFS.replace('uniform sampler2D tAlb, tNrm, tCaus;', 'uniform sampler2D tAlb, tNrm, tCaus, tAO;').replace('float ao = A.a;', 'float ao = texture2D(tAO, vUv).r;');
    const mk = (alb, nrm, ao) => new THREE.ShaderMaterial({ defines: { SHADE2: 1 }, uniforms: { ...C, ...L, tAlb: { value: alb }, tNrm: { value: nrm }, tAO: { value: ao || white }, tDetA: { value: tNoise }, tDetN: { value: tNoise },
      uWet: UWU.wet, uAO: UWU.aoK, uDetTile: { value: 1.75 }, uSat: { value: uwNum('ocReefSat', 0.3) }, uTint: { value: hex(OC.PALETTE.reef).multiplyScalar(uwNum('ocReefK', 1)) }, uNormK: { value: 1.15 }, uFogK: { value: UWT.fogK },
      uTxCaus: UWTXU.caus, uTxClear: UWTXU.clear, uTxTop: UWTXU.top }, vertexShader: bommieVS, fragmentShader: fs, side: THREE.DoubleSide });
    bommie = { kit: 'reef3', mat: mk(bA, bN, bO), geo, lo, bb: geo.boundingBox, tris: geo.index.count / 3, loTris: lo.index.count / 3 };
    bommie.farMat = lo === geo ? bommie.mat : mk(lA, lN, null);
    if (sA) sandTex = { a: sA, n: sN, h: null, tile: 8, kit2: true };
    info.kit = { reef3: true, px: big };
  }
  function placeDescent3(aspect) {
    const grp = new THREE.Group(), R = rng(3303), narrow = aspect < 1, HT = bommie.bb.max.y; grp.name = 'descent-reef3';
    let tris0 = 0, n = 0;
    const piece = far => { const L = new THREE.LOD(), m1 = new THREE.Mesh(bommie.lo, bommie.farMat); m1.renderOrder = 2;
      { const m0 = new THREE.Mesh(bommie.geo, bommie.mat); m0.renderOrder = 2; L.addLevel(m0, 0); L.addLevel(m1, far ? 16 : 24); }   /* the 3 k LOD only deep in the haze (its bake shows dark slivers up close) */
      tris0 += far ? bommie.loTris : bommie.tris; n++; return L; };
    /* a wall panel: the patch stood on its side, its relief toward the lane, leaning back a little (the top further out: it takes the light),
       turned in its own plane by quarter turns so no two neighbours repeat */
    const wall = (side, inner, y, z, s, far) => { const H = new THREE.Group(), L = piece(far);
      L.rotation.y = Math.floor(R() * 4) * Math.PI / 2 + (R() - 0.5) * 0.5; H.add(L);
      H.rotation.set((R() - 0.5) * 0.16, (R() - 0.5) * 0.3, side * (Math.PI / 2 - 0.08 - R() * 0.12), 'YXZ');
      H.scale.setScalar(s); H.position.set(side * (inner + HT * s * 0.8), y, z); grp.add(H); };
    for (const side of [-1, 1]) for (const [z0, inner, sc, far, step] of [[-7, 4.5, 1.0, false, 8.5], [-21, 6.3, 1.35, false, 11], [-36, 9.5, 1.8, true, 15]])
      for (let y = 5 + R() * 3; y > DESC.sea - 5; y -= step * (0.85 + 0.3 * R())) wall(side, (inner + R() * 1.6) * (narrow ? 0.7 : 1), y, z0 + (R() - 0.5) * 5, sc * (0.9 + 0.3 * R()), far);
    /* the seabed: patches lying in the sand, rims sunk; small steep copies as boulders at both sides of the lane */
    const flat = (x, z, s, far) => { const L = piece(far); L.position.set(x, seabedH(x, z) - 0.35 * s, z); L.rotation.set((R() - 0.5) * 0.1, R() * 6.283, (R() - 0.5) * 0.1); L.scale.setScalar(s); grp.add(L); };
    flat(-8.5, -12, 1.25, false); flat(8.8, -15, 1.3, false); flat(-1, -27, 1.5, false); flat(-13, -30, 1.6, true); flat(13, -32, 1.6, true); flat(0.5, -46, 2.2, true);
    for (let i = 0; i < 7; i++) { const side = i % 2 ? 1 : -1, x = side * (3.5 + R() * 8), z = -8 - R() * 24, s = 0.26 + R() * 0.22, L = piece(false);
      L.position.set(x, seabedH(x, z) + 0.15, z); L.rotation.set((R() - 0.5) * 1.0, R() * 6.283, (R() - 0.5) * 1.0); L.scale.setScalar(s); grp.add(L); }
    scene.add(grp); groups.push(grp);
    info.tris += tris0; info.slabs = n; info.layers.push({ reef3: n, lod0Tris: Math.round(tris0) });
    /* the scan's CC-BY credit, next to the page's other model credits (the footer's legal line), once */
    try { const host = document.querySelector('.fiw-legalline'); if (host && !host.querySelector('[data-oc-credit]')) { const a = document.createElement('a');
      a.href = 'https://sketchfab.com/3d-models/coral-reef-outcrop-8bc72c9e4575470ea30d1313e48b730c'; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('data-oc-credit', '');
      a.textContent = 'Reef rock: based on “Coral Reef Outcrop” by Ben M. Ritt, CC BY 4.0 (re-meshed, maps re-baked)'; host.appendChild(a); info.reefCredit = 'footer'; } else if (!host) info.reefCredit = 'no slot'; } catch (error) { }
  }
  /* a piece as a three-level LOD (switch at 18 m and 40 m, AD-REEF's distances); `pivot` moves the piece inside its holder */
  function lodPiece(pc, mat, pivot) {
    const L = new THREE.LOD();
    [[pc.geo, 0], [pc.lo, 15], [pc.lo2, 34]].forEach(([g, d]) => { const m = new THREE.Mesh(g, mat); if (pivot) m.position.copy(pivot); m.renderOrder = 2; L.addLevel(m, d); });
    return L;
  }
  function placeDescent2(aspect, plantData) {
    const grp = new THREE.Group(), R = rng(2777), a = new THREE.Vector3(), nv = new THREE.Vector3(), q = new THREE.Quaternion(); grp.name = 'descent-reef2';
    const narrow = aspect < 1, W = bommie.chunks, Rk = bommie.rocks, rock = nm => Rk.find(r => r.name.includes(nm)) || Rk[0];
    let tris0 = 0, n = 0;
    const plantsOn = (obj, pc, keep, minUp = 0.8) => { obj.updateMatrixWorld(true); const m = obj.levels ? obj.levels[0].object : obj; m.getWorldQuaternion(q);
      for (let i = 0; i < pc.anchors.length; i += 6) { if (R() > keep) continue;
        nv.set(pc.anchors[i + 3], pc.anchors[i + 4], pc.anchors[i + 5]).applyQuaternion(q); if (nv.y < minUp) continue;
        a.set(pc.anchors[i], pc.anchors[i + 1], pc.anchors[i + 2]).applyMatrix4(m.matrixWorld);
        const sz = 0.45 + 0.8 * R(); plantData.push([a.x, a.y - sz * 0.06, a.z, sz, 1.0, Math.floor(R() * 8), R(), 0, 1]); } };
    /* walls: wall_a is the main buttress; pivot = centre of its natural height and run, the back of its relief */
    const wall = (pc, side, inner, y, z, s, ry) => {
      const bb = pc.bb, pv = new THREE.Vector3(-(bb.min.x + bb.max.x) / 2, 0, -(bb.min.z + bb.max.z) / 2), L = lodPiece(pc, bommie.mat, pv);
      if (side < 0) L.rotation.set((R() - 0.5) * 0.08, ry + Math.PI, Math.PI / 2, 'YXZ'); else L.rotation.set((R() - 0.5) * 0.08, ry, Math.PI / 2, 'YXZ');
      L.scale.setScalar(s); L.position.set(side * (inner + bb.max.y * s), y, z); grp.add(L); tris0 += pc.tris; n++; return L;
    };
    const pickW = () => { const k = R(); return k < 0.6 ? [W[0], 1.1 + R() * 0.4] : k < 0.85 ? [W[1 % W.length], 1.6 + R() * 0.6] : [W[2 % W.length], 2.4 + R() * 0.6]; };
    for (const side of [-1, 1]) {
      for (let y = 4 + R() * 3; y > DESC.sea - 4;) {
        let tallest = 0;
        for (const [z0, back] of [[-4, 0], [-16, 0], [-31, 1]]) {
          const [pc, s0] = pickW(), s = s0 * (back ? 1.35 : 1) * (narrow ? 0.75 : 1), tall = (pc.bb.max.x - pc.bb.min.x) * s;
          wall(pc, side, (back ? 8.5 : 4.6) + R() * 2.2, y - R() * 2, z0 + (R() - 0.5) * 5, s, (R() - 0.5) * 0.6);
          if (!back) tallest = Math.max(tallest, tall);
        }
        y -= Math.max(6, tallest * 0.72);
      }
    }
    /* ledges at the beats' depths: AD-REEF's slab lying flat, jutting from the wall, plants on top */
    DESC.stations.forEach((st, i) => {
      if (st.name === 'open' || st.name === 'values') return;
      const side = i % 2 ? 1 : -1, pc = rock('ledge'), s = 1.6 + R() * 0.4, L = lodPiece(pc, bommie.rockMat);
      L.position.set(side * (5.6 + 1.2 * s), st.y - 3.0, -10 - R() * 4); L.rotation.y = R() * 6; L.scale.setScalar(s); grp.add(L); tris0 += pc.tris; n++;
      plantsOn(L, pc, 0.9);
    });
    /* the seabed: masses, boulders, pillars (a boulder stood on end), flat reef tops; a clear spot under the drop */
    const feet = [];
    const rockAt = (nm, x, z, s, opt = {}) => { const pc = rock(nm), L = lodPiece(pc, bommie.rockMat);
      { const bb = pc.bb, r = (opt.pillar ? Math.max(bb.max.y - bb.min.y, bb.max.x - bb.min.x) * 0.5 : Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.5) * s; feet.push([x, z, r, opt.pillar ? 0.5 : 0.62]); }
      if (opt.pillar) { L.rotation.set(Math.PI / 2, 0, R() * 6, 'YXZ'); L.position.set(x, seabedH(x, z) + 0.9 * s - 0.3, z); }
      else { L.rotation.y = R() * 6; L.position.set(x, seabedH(x, z) - 0.08 * (pc.bb.max.y - pc.bb.min.y) * s, z); }
      L.scale.setScalar(s); grp.add(L); tris0 += pc.tris; n++; return [L, pc]; };
    for (let i = 0; i < 8; i++) { const side = i % 2 ? 1 : -1, [L, pc] = rockAt('rock_a', side * (5 + R() * 11), -6 - i * 4.5 - R() * 4, 1.6 + R() * 2.0); plantsOn(L, pc, 0.45); }
    for (let i = 0; i < 16; i++) { const x = (R() - 0.5) * 26, z = -3 - R() * 34; if (Math.abs(x) < 2.2 && z > -14) continue; rockAt('rock_b', x, z, 0.5 + R() * 1.8); }
    for (let i = 0; i < 5; i++) { const side = i % 2 ? 1 : -1; rockAt('rock_b', side * (3.5 + R() * 9), -12 - R() * 26, 3 + R() * 2, { pillar: true }); }
    for (let i = 0; i < 4; i++) { const side = i % 2 ? 1 : -1, [L, pc] = rockAt('ledge', side * (3 + R() * 8), -8 - R() * 24, 1.2 + R() * 0.8); plantsOn(L, pc, 0.7); }
    for (let c = 0; c < 14; c++) { const side = c % 2 ? 1 : -1, cx0 = side * (2.5 + R() * 9), cz0 = -6 - R() * 32, nC = 6 + Math.floor(R() * 10);
      for (let i = 0; i < nC; i++) { const px = cx0 + (R() - 0.5) * 3, pz = cz0 + (R() - 0.5) * 2.2, sz = 0.45 + 1.1 * R(); plantData.push([px, seabedH(px, pz) - sz * 0.05, pz, sz, 1.0, R() < 0.5 ? 5 + Math.floor(R() * 3) : Math.floor(R() * 5), R(), 0]); } }
    scene.add(grp); groups.push(grp);
    if (floor && floor.material.uniforms.uFeet) { const F = floor.material.uniforms.uFeet.value; F.forEach(v => v.set(0, 0, 0, 0)); feet.sort((a, b) => b[1] - a[1]).slice(0, 40).forEach((f, i) => F[i].set(f[0], f[1], f[2], f[3])); info.feet = Math.min(40, feet.length); }
    info.tris += tris0; info.slabs = n; info.layers.push({ reef2: n, lod0Tris: Math.round(tris0) });
    if (life3d) placeLife3d(grp, R);
    if (UWTEX && !NOLIFE && UWQ.get('uwtexRich') !== '0' && !(HERO && HERO.rich === false)) try { richness26(grp, plantData, W, rock); } catch (error) { info.richError = String(error && error.message || error); }   /* UWTEX phase 3 (own rng: the default's placement is untouched) */
    const singles = [];
    for (let i = 0; i < 16; i++) singles.push([0, -5 - i * 3.2 - R() * 2, -9 - R() * 16, (R() < 0.5 ? -1 : 1) * (0.7 + R() * 0.8), 0.4 + R() * 0.35]);
    singles.push([0, -21, -6.5, 0.55, 1.25], [0, -44, -7.5, -0.45, 1.45]);
    buildFish(singles);
  }
  /* UWTEX phase 3 · richness sample at −26 m (DISCIPLINE), 2026-11-18 (client: 「先處理水下世界」, bar 「差10倍」): today the station is two side
     walls and an empty blue middle. (1) life on the near walls and ledges close to the lens — sea fans, sea whips, tube sponges, soft coral,
     coral heads, sponges — found by rays against the walls actually placed; (2) depth layers between the walls: a pinnacle (≈ 18 m), an arch
     (≈ 32 m), far pinnacles (≈ 48 m), all reef3 rock (the wall scans stood up facing the lens), fading into the water by the fog alone.
     Same kit, same light, no new downloads. ?uwtexRich=0 = without it. */
  function richness26(grp, plantData, W, rock) {
    const R = rng(9026), Y0 = -26, rc = new THREE.Raycaster(), o = new THREE.Vector3(), dv = new THREE.Vector3(), nW = new THREE.Vector3(), q = new THREE.Quaternion();
    let tris = 0, n = 0, life = 0; const per = { '-1': 0, '1': 0, miss: 0, under: 0 };
    grp.updateMatrixWorld(true);
    /* targets: the full-detail level of every placed piece near the station (what the lens sees up close; the coarse levels sit up to
       half a metre off the real surface and hid the life inside the rock) */
    const t0 = performance.now(), near = grp.children.filter(c => c.isLOD && Math.abs(c.position.y - Y0) < 14 && c.position.z > -30 && c.position.z < 2).map(c => c.levels[0].object);
    const hitAt = (ox, oy, oz, dx, dy, dz) => { rc.set(o.set(ox, oy, oz), dv.set(dx, dy, dz).normalize()); rc.far = 14; const h = rc.intersectObjects(near, false)[0];
      if (!h || !h.face) return null; nW.copy(h.face.normal).transformDirection(h.object.matrixWorld); if (nW.dot(dv) > 0) nW.negate(); return { p: h.point.clone(), n: nW.clone() }; };
    const L3 = life3d, heads = L3 ? L3.corals.filter(c => c.name !== 'seastar') : [];
    const head = (c, p, s) => { const L = new THREE.LOD(); [[c.geo, 0], [c.lo, 9]].forEach(([g, d]) => { const m = new THREE.Mesh(g, c.mat); m.renderOrder = 4; L.addLevel(m, d); });
      L.position.copy(p); L.position.y -= 0.05 * s; L.rotation.y = R() * 6; L.scale.setScalar(s); grp.add(L); life++; };
    /* plantData: [x, y, z, size, aspect, cell, phase, hang, atlas] — atlas 1 = AD-LIFE's plants (4 tube sponges, 5 orange fan, 6 gold whips,
       7 violet fan), no atlas = the coral atlas (5 cauliflower, 6 bubblegum soft coral, 7 lace fan) */
    const card = (p, sz, cell, plants) => { plantData.push(plants ? [p.x, p.y - sz * 0.08, p.z, sz, 1.0, cell, R(), 0, 1] : [p.x, p.y - sz * 0.08, p.z, sz, 1.0, cell, R(), 0]); life++; };
    const CARD = [[4, 1], [5, 1], [5, 1], [6, 1], [7, 1], [7, 1], [6, 0], [6, 0], [7, 0], [5, 0]];
    for (const side of [-1, 1]) {
      /* the wall faces: fans and whips growing out of the rock, a few soft-coral clusters */
      for (let k = 0; k < 34; k++) {
        const z = -8.0 - R() * (k < 20 ? 7 : 13), y = Y0 + (R() - 0.5) * 2 * Math.min(4.5, -z * 0.29), h = hitAt(0, y, z, side, 0, 0); if (!h) { per.miss++; continue; }
        if (h.n.y < -0.55) { per.under++; continue; }   /* not on the undersides */
        per[side]++;
        const [cell, pl] = CARD[Math.floor(R() * CARD.length)], sz = (0.55 + R() * 0.75) * (pl && cell === 4 ? 0.8 : 1);
        card(h.p.addScaledVector(h.n, 0.06), sz, cell, pl);
        if (R() < 0.45) { const p2 = h.p.clone().add(new THREE.Vector3(0, (R() - 0.5) * 0.6, (R() - 0.5) * 0.9)); card(p2, sz * (0.5 + R() * 0.4), CARD[Math.floor(R() * CARD.length)][0], true); }
      }
      /* ledge and step tops (rays from above): coral heads, sponges, a fan or two */
      for (let k = 0; k < 18; k++) {
        const x = side * (4.2 + R() * 3.2), z = -8.0 - R() * 12, h = hitAt(x, Y0 + 5, z, 0, -1, 0); if (!h || h.n.y < 0.5 || h.p.y < Y0 - 6 || h.p.y > Y0 + 4) continue;
        const r = R();
        if (r < 0.45 && heads.length) head(heads[Math.floor(R() * heads.length)], h.p, 0.45 + R() * 0.45);
        else if (r < 0.65 && L3 && L3.sponge) { const m = new THREE.Mesh(L3.sponge.geo, spongeMat(L3.sponge.color)); m.position.copy(h.p); m.position.y -= 0.03; m.rotation.y = R() * 6; m.scale.setScalar(0.5 + R() * 0.6); m.renderOrder = 4; grp.add(m); life++; }
        else card(h.p, 0.6 + R() * 0.7, [5, 7, 4, 6][Math.floor(R() * 4)], true);
      }
    }
    /* depth layers (pass 2: no stretched scans, no flat slabs): rock towers = AD-REEF's closed boulder stood on end, stacked, a rounded
       mass on top; buttresses = wall scans jutting in from the sides further down the gorge; a natural arch far off (two towers + boulders) */
    const tower = (x, z, top, s0) => { let y = top; const pc = rock('rock_b'), cap = rock('rock_a');
      for (let k = 0; y > DESC.sea - 3 && k < 7; k++) { const s = s0 * (1 + k * 0.09) * (0.9 + R() * 0.2), h = 1.8 * s * 1.45, L = lodPiece(pc, bommie.farRockMat);
        L.rotation.set(Math.PI / 2 + (R() - 0.5) * 0.12, (R() - 0.5) * 0.3, R() * 6, 'YXZ'); L.scale.set(s, s, s * 1.45); L.position.set(x + (R() - 0.5) * s * 0.4, y - h / 2 + (k ? 0.6 : 0), z + (R() - 0.5) * s * 0.4);
        grp.add(L); tris += pc.loTris; n++; y -= h * 0.82; }
      const C = lodPiece(cap, bommie.farRockMat), cs = s0 * 0.36; C.position.set(x, top - 0.55 * 1.9 * cs, z); C.rotation.y = R() * 6; C.scale.set(cs, cs * 0.8, cs); grp.add(C); tris += cap.loTris; n++; };
    const buttress = (pc, side, x, z, top, s, ry) => { let y = top;
      for (let k = 0; y > DESC.sea - 3 && k < 4; k++) { const bb = pc.bb, pv = new THREE.Vector3(-(bb.min.x + bb.max.x) / 2, 0, -(bb.min.z + bb.max.z) / 2), L = lodPiece(pc, bommie.farMat, pv), sk = s * (1 + k * 0.1), h = (bb.max.x - bb.min.x) * sk;
        L.rotation.set((R() - 0.5) * 0.06, (side < 0 ? Math.PI : 0) + ry, Math.PI / 2, 'YXZ'); L.scale.setScalar(sk); L.position.set(x, y - h / 2, z + (R() - 0.5) * 2); grp.add(L); tris += pc.loTris; n++; y -= h * 0.8; } };
    tower(-1.6, -27, Y0 + 3.2, 2.3);                                   /* ≈ 27 m: a free rock tower left of the middle */
    buttress(W[0], 1, 8.0, -29, Y0 + 7, 1.0, -0.6);                   /* ≈ 29 m: a buttress jutting in from the right, turned to the lens */
    buttress(W[0], -1, -7.0, -36, Y0 + 9, 1.35, 0.7);                 /* ≈ 36 m: one from the left */
    tower(3.6, -39, Y0 + 6.6, 2.4); tower(-3.8, -40, Y0 + 6.2, 2.3);   /* ≈ 40 m: the arch's legs … */
    { const cap = rock('rock_a'); for (const [x, y, sx, sy, sz] of [[-2.6, Y0 + 6.0, 1.7, 1.0, 1.3], [-0.4, Y0 + 6.7, 2.0, 1.05, 1.4], [1.8, Y0 + 6.5, 1.8, 1.0, 1.3], [3.4, Y0 + 5.9, 1.3, 0.9, 1.2]]) {   /* … and its span */
      const C = lodPiece(cap, bommie.farRockMat); C.position.set(x, y, -39.5 + (R() - 0.5)); C.rotation.set((R() - 0.5) * 0.3, R() * 6, Math.PI + (R() - 0.5) * 0.3); C.scale.set(sx, sy, sz); grp.add(C); tris += cap.loTris; n++; } }
    tower(0.6, -58, Y0 + 2.0, 3.0);                                    /* ≈ 58 m: almost water */
    info.rich26 = { life, pieces: n, loTris: Math.round(tris), per, near: near.length, rayMs: Math.round(performance.now() - t0) };
  }
  /* AD-LIFE's 3D life (assets/life2/, spec in STATUS-ADLIFE.md): Smithsonian CC0 coral scans (albedo + normal, real size, LOD 6 k / 1.5 k at 12 m),
     kelp forests (alpha-tested strands, sway from COLOR_0), sponges, and an eagle ray gliding past once on the way down */
  let life3d = null, ray = null;
  async function loadLife3d(LM) {
    const mod = await import('three/addons/loaders/GLTFLoader.js'), B = ASSETS + 'life/', gl = f => f ? new mod.GLTFLoader().loadAsync(B + f).catch(() => null) : Promise.resolve(null);
    const first = g => { let m = null; if (g) g.scene.traverse(o => { if (o.isMesh && !m) m = o; }); return m && m.geometry; };
    const tlc = (u, srgb) => load(u, srgb).then(t => { if (t) { t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; } return t; });
    const out = { corals: [], kelp: null, sponge: null, ray: null };
    const pick = (LM.corals3d || []).filter(c => ['brain', 'table', 'elkhorn', 'cauliflower', 'bubblegum', 'seastar', 'lettuce'].includes(c.name));
    await Promise.all(pick.map(async c => {
      const cpx = LIFE_HALF ? Math.max(256, (c.px || 512) / 2) : c.px || 512;   /* UW-BUILD: 256 with the far layer (VRAM) */
      const [g0, g1, ta, tn] = await Promise.all([gl(c.glb), gl(c.glbLo), tlc(tierUrl(B, c.tex, cpx), true), tlc(tierUrl(B, c.normal, cpx), false)]);
      const geo = first(g0), lo = first(g1) || geo; if (!geo || !ta || !tn || !geo.attributes.tangent) return;
      const mat = new THREE.ShaderMaterial({ defines: UWTEX ? { UWVEIL: 1 } : {}, uniforms: { ...C, ...L, tAlb: { value: ta }, tNrm: { value: tn }, uTint: { value: hex(RIVER ? '#e4e8ec' : '#e6f0f2') }, uSat: { value: RIVER ? 0.82 : 0.92 }, uNormK: { value: 1.0 }, uFogK: { value: UWT.fogK } },
        vertexShader: bommieVS, fragmentShader: bommieFS, side: THREE.DoubleSide });
      geo.computeBoundingBox(); out.corals.push({ name: c.name, geo, lo, mat, h: c.h || 1, warm: !!c.warm, bb: geo.boundingBox });
    }));
    if (LM.kelp) {
      const [gt, gy, kt] = await Promise.all([gl(LM.kelp.tall), gl(LM.kelp.young), load(tierUrl(B, LM.kelp.tex, LM.kelp.px || 512), true)]);
      const tall = first(gt), young = first(gy);
      if (tall && young && kt) { kt.flipY = false; kt.wrapS = kt.wrapT = THREE.ClampToEdgeWrapping; out.kelp = { tall, young, tex: kt, hT: LM.kelp.hTall || 8, hY: LM.kelp.hYoung || 3.5 }; }
    }
    if (LM.sponge) { const g = first(await gl(LM.sponge.glb)); if (g) out.sponge = { geo: g, color: hex(LM.sponge.color || '#9e80b8') }; }
    const hero = (LM.heroes || []).find(h => h.name === 'ray');
    if (hero) { const [g, t] = await Promise.all([gl(hero.glb), load(tierUrl(B, hero.tex, hero.px || 1024), true)]); const geo = first(g); if (geo && t) { t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; out.ray = { geo, tex: t, size: hero.size || 1 }; } }
    life3d = out; info.life3d = { corals: out.corals.map(c => c.name), kelp: !!out.kelp, sponge: !!out.sponge, ray: !!out.ray };
  }
  const kelpVS = /* glsl */`
    attribute vec4 aRig; attribute vec4 iK; uniform float uTime; varying vec2 vUv; varying float vDist; varying float vH;
    void main(){
      vec3 p = position * iK.w; float sw = aRig.x, fl = aRig.y;
      p.x += (sin(uTime * 0.55 + iK.y + p.y * 0.22) * 0.55 + sin(uTime * 0.9 + iK.y * 2.0) * 0.15) * sw * iK.w;
      p.z += sin(uTime * 0.43 + iK.y * 1.7 + p.y * 0.18) * 0.35 * sw * iK.w + sin(uTime * 2.3 + p.y * 3.0) * 0.04 * fl;
      float c = cos(iK.z), s = sin(iK.z); p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
      vec4 mv = viewMatrix * vec4(p + iK.xyx * vec3(1.0, 0.0, 0.0) + vec3(0.0, 0.0, 0.0), 1.0);
      vUv = uv; vH = aRig.x; vDist = -mv.z; gl_Position = projectionMatrix * mv;
    }`;
  const kelpFS = CM + /* glsl */`
    uniform sampler2D tKelp; uniform vec3 uKeyCol, uSky, uGround; uniform float uFogK; varying vec2 vUv; varying float vDist; varying float vH;
    void main(){
      vec4 t = texture2D(tKelp, vUv); if (t.a < 0.5) discard;
      vec3 col = t.rgb * (mix(uGround, uSky, 0.35 + 0.65 * vH) * 1.15 + uKeyCol * (0.35 + 0.4 * vH));
      float fd = max(vDist - 0.5, 0.0), f = 1.0 - exp(-fd * uFogK - fd * fd * 0.00012);
      gFar = smoothstep(0.04, 0.72, f); col = mix(col, bgAt(gl_FragCoord.xy), clamp(f, 0.0, 1.0));
      gl_FragColor = vec4(toSRGB(col), 1.0);
    }`;
  function placeLife3d(grp, R) {
    const Lf = life3d, put = (geo, lo, mat, x, y, z, s, ry) => { const L = new THREE.LOD(); [[geo, 0], [lo, 9]].forEach(([g, d]) => { const m = new THREE.Mesh(g, mat); m.renderOrder = 4; L.addLevel(m, d); });
      L.position.set(x, y, z); L.rotation.y = ry; L.scale.setScalar(s); grp.add(L); return L; };
    /* coral heads on the seabed, near the middle, a few on the ledges' tops */
    const big = Lf.corals.filter(c => c.name !== 'seastar'), star = Lf.corals.find(c => c.name === 'seastar');
    for (let i = 0; i < (HERO && HERO.life != null ? Math.round(14 * HERO.life) : 14) && big.length; i++) { const c = big[i % big.length], side = i % 2 ? 1 : -1, x = side * (1.8 + R() * 7), z = -5 - R() * 22;
      put(c.geo, c.lo, c.mat, x, seabedH(x, z) - 0.04, z, 0.8 + R() * 0.7, R() * 6); }
    if (star) for (let i = 0; i < 6; i++) { const x = (R() - 0.5) * 9, z = -3 - R() * 10; put(star.geo, star.lo, star.mat, x, seabedH(x, z) + 0.01, z, 0.9 + R() * 0.4, R() * 6); }
    DESC.stations.forEach((st, i) => { if (st.name === 'open' || st.name === 'values' || !big.length) return; const side = i % 2 ? 1 : -1, c = big[(i * 3) % big.length];
      put(c.geo, c.lo, c.mat, side * (6.4 + R() * 1.2), st.y - 3.0 + 0.9, -10 - R() * 3, 0.7 + R() * 0.3, R() * 6); });
    /* kelp forests rising from the seabed at both sides (one instanced draw per strand type) */
    if (Lf.kelp && !(HERO && HERO.kelp === false)) {
      const mk = (geo, list) => { if (!list.length) return; const g = new THREE.InstancedBufferGeometry(); g.index = geo.index;
        g.setAttribute('position', geo.attributes.position); g.setAttribute('uv', geo.attributes.uv); g.setAttribute('aRig', geo.attributes.color || new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 4), 4));
        g.setAttribute('iK', new THREE.InstancedBufferAttribute(new Float32Array(list.flat()), 4)); g.instanceCount = list.length;
        const m = new THREE.Mesh(g, kelpMat); m.frustumCulled = false; m.renderOrder = 7; grp.add(m); };
      const tall = [], young = [];
      for (let i = 0; i < 22; i++) { const side = i % 2 ? 1 : -1, x = side * (4 + R() * 12), z = -6 - R() * 30; tall.push([x, seabedH(x, z) - 0.1, z, 0.75 + R() * 0.45].map((v, k) => k === 1 ? v : v)); }
      for (let i = 0; i < 30; i++) { const side = i % 2 ? 1 : -1, x = side * (2.5 + R() * 13), z = -4 - R() * 30; young.push([x, seabedH(x, z) - 0.05, z, 0.7 + R() * 0.6]); }
      /* iK = (x, phase, yaw, scale); y goes through the position: pack (x, y, z) into a second attribute-free path: offset in the matrix */
      const pack = l => l.map(([x, y, z, sc]) => [x, y, z, sc]);
      mkKelp(Lf.kelp.tall, pack(tall), grp); mkKelp(Lf.kelp.young, pack(young), grp);
    }
    if (Lf.sponge && !(HERO && HERO.sponge === false)) { const m = new THREE.MeshBasicMaterial(); void m;
      for (let i = 0; i < 8; i++) { const side = i % 2 ? 1 : -1, x = side * (2 + R() * 8), z = -5 - R() * 20, mesh = new THREE.Mesh(Lf.sponge.geo, spongeMat(Lf.sponge.color)); mesh.position.set(x, seabedH(x, z) - 0.03, z); mesh.rotation.y = R() * 6; mesh.scale.setScalar(0.8 + R() * 0.8); grp.add(mesh); } }
    if (Lf.ray && !ray) {
      const m = new THREE.ShaderMaterial({ uniforms: { ...C, ...L, tFish: { value: Lf.ray.tex }, uRay: { value: new THREE.Vector4(0, -30, -7, 0) }, uSize: { value: Lf.ray.size }, uFogK: { value: UWT.fogK } },
        vertexShader: rayVS, fragmentShader: fishFS, side: THREE.DoubleSide });
      const g = Lf.ray.geo; if (g.attributes.color) g.setAttribute('aRig', g.attributes.color);
      ray = new THREE.Mesh(g, m); ray.frustumCulled = false; ray.renderOrder = 9; scene.add(ray);
    }
  }
  const kelpGroups = [];
  let kelpMat = null, spongeMats = {};
  function mkKelp(geo, list, grp) {
    if (!list.length) return;
    if (!kelpMat) kelpMat = new THREE.ShaderMaterial({ uniforms: { ...C, ...L, tKelp: { value: life3d.kelp.tex }, uFogK: { value: UWT.fogK } }, vertexShader: kelpVS2, fragmentShader: kelpFS, side: THREE.DoubleSide });
    const g = new THREE.InstancedBufferGeometry(); g.index = geo.index;
    g.setAttribute('position', geo.attributes.position); g.setAttribute('uv', geo.attributes.uv);
    g.setAttribute('aRig', geo.attributes.color || new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 4), 4));
    const P = [], K = []; const R = rng(list.length * 7 + 3);
    for (const [x, y, z, sc] of list) { P.push(x, y, z); K.push(R() * 6.28, R() * 6.28, sc, 0); }
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(P), 3)); g.setAttribute('iK', new THREE.InstancedBufferAttribute(new Float32Array(K), 4));
    g.instanceCount = list.length;
    const m = new THREE.Mesh(g, kelpMat); m.frustumCulled = false; m.renderOrder = 7; grp.add(m);
  }
  const kelpVS2 = /* glsl */`
    attribute vec4 aRig; attribute vec3 iPos; attribute vec4 iK; uniform float uTime; varying vec2 vUv; varying float vDist; varying float vH;
    void main(){
      vec3 p = position * iK.z; float sw = aRig.x, fl = aRig.y;
      p.x += (sin(uTime * 0.55 + iK.x + p.y * 0.22) * 0.55 + sin(uTime * 0.9 + iK.x * 2.0) * 0.15) * sw * iK.z;
      p.z += sin(uTime * 0.43 + iK.x * 1.7 + p.y * 0.18) * 0.35 * sw * iK.z + sin(uTime * 2.3 + p.y * 3.0) * 0.04 * fl;
      float c = cos(iK.y), s = sin(iK.y); p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
      vec4 mv = viewMatrix * vec4(p + iPos, 1.0);
      vUv = uv; vH = sw; vDist = -mv.z; gl_Position = projectionMatrix * mv;
    }`;
  function spongeMat(col) {
    const k = col.getHexString(); if (spongeMats[k]) return spongeMats[k];
    return (spongeMats[k] = new THREE.ShaderMaterial({ uniforms: { ...C, ...L, uCol: { value: col }, uFogK: { value: UWT.fogK } },
      vertexShader: 'varying vec3 vN; varying float vDist; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: CM + 'uniform vec3 uCol, uKeyDir, uKeyCol, uSky, uGround; uniform float uFogK; varying vec3 vN; varying float vDist; void main(){ vec3 N = normalize(vN); vec3 col = uCol * (mix(uGround, uSky, N.y * 0.5 + 0.5) * 1.2 + uKeyCol * max(dot(N, normalize(uKeyDir)), 0.0) * 0.6); float fd = max(vDist - 0.5, 0.0), f = 1.0 - exp(-fd * uFogK - fd * fd * 0.00012); col = mix(col, bgAt(gl_FragCoord.xy), clamp(f, 0.0, 1.0)); gl_FragColor = vec4(toSRGB(col), 1.0); }' }));
  }
  /* the eagle ray: wing flap and tail wave from its rig (COLOR_0: R tail, G wing, B along the body) */
  const rayVS = /* glsl */`
    attribute vec4 aRig; uniform float uTime, uSize; uniform vec4 uRay; varying vec2 vUv; varying vec3 vN; varying float vDist; varying vec3 vTint;
    vec3 rotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x * c - v.z * s, v.y, v.x * s + v.z * c); }
    void main(){
      vec3 p = position;
      p.y += sin(uTime * 5.65 * 0.5 - aRig.z * 2.2) * 0.22 * aRig.y;
      p.z += sin(uTime * 3.0 - aRig.z * 6.0) * 0.05 * aRig.x;
      vec3 wp = uRay.xyz + rotY(p * uSize, -uRay.w);
      vN = rotY(normal, -uRay.w); vUv = uv; vTint = vec3(1.0);
      vec4 mv = viewMatrix * vec4(wp, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv;
    }`;
  /* stones of our own (pillars, flat stones), generated once at their real size; the slabs' triplanar slate material (textures, no noise) */
  function stoneGeo(kind, seed, h = 1, r = 1) {
    const R = rng(seed), pil = kind === 'pillar';
    const g = pil ? new THREE.CylinderGeometry(r * 0.62, r, h, 11, 16, false) : new THREE.SphereGeometry(r, 11, 6);
    const P = g.attributes.position, n = P.count, ao = new Float32Array(n), cr = new Float32Array(n), ms = new Float32Array(n);
    const f1 = R() * 6, f2 = R() * 6, lean = (R() - 0.5) * 0.12 * h;
    for (let i = 0; i < n; i++) {
      let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const ang = Math.atan2(z, x);
      if (pil) { const t = y / h + 0.5, k = 1 + 0.16 * Math.sin(ang * 3 + f1 + t * 5) + 0.09 * Math.sin(ang * 7 + f2 - t * 11) + 0.05 * Math.sin(t * 23 + ang);
        x *= k; z *= k; x += lean * t * t; y = t * h; ao[i] = 0.45 + 0.55 * Math.min(1, t * 4); ms[i] = t > 0.9 ? 0.5 : 0; }
      else { const k = 1 + 0.2 * Math.sin(ang * 2 + f1) + 0.1 * Math.sin(ang * 5 + f2); x *= k; z *= k * 0.8; y = Math.max(y, -0.15 * r) * 0.3; ao[i] = 0.55 + 0.45 * Math.min(1, (y / r + 0.05) * 7); }
      cr[i] = 0.5 + 0.5 * Math.sin(x * 4.1 + z * 2.7 + y * 6.3); P.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1)); g.setAttribute('aCrack', new THREE.BufferAttribute(cr, 1)); g.setAttribute('aMoss', new THREE.BufferAttribute(ms, 1));
    g.computeBoundingSphere(); return g;
  }
  let stones = null, fishSrc = null, fish = null, sandTex = null;
  const fishSpecies = [], fishMeshes = [];   /* AD-LIFE's species; each: { mesh, schools, U } */
  const SCHOOLS = LANE_MODE ? [{ z: -55, x: -2, h: 3.0, R: 7, w: 0.055, ph: 0.4, n: 42, sz: [0.36, 0.52], tint: [1, 1, 1] }, { z: -126, x: 2.5, h: 3.6, R: 8, w: -0.048, ph: 2.1, n: 32, sz: [0.36, 0.52], tint: [1, 1, 1] }]
    /* the descent: a school at each depth band, different sizes and casts (AD-LIFE's species will replace the one body) */
    : [{ z: -15, x: -1.5, y: -10, R: 7, w: 0.05, ph: 0.4, n: 90, sz: [0.32, 0.46], tint: [1, 1, 1], spread: [7, 2.6, 4.2] },
       { z: -19, x: 2.0, y: -29, R: 9, w: -0.04, ph: 2.1, n: 120, sz: [0.2, 0.3], tint: [0.92, 1.0, 1.08], spread: [9, 3.2, 5] },
       { z: -17, x: -1.0, y: -43, R: 8, w: 0.035, ph: 4.0, n: 70, sz: [0.5, 0.68], tint: [1.08, 0.98, 0.86], spread: [7, 2.2, 4] }];
  const fishU = { uS0: { value: new THREE.Vector4() }, uS1: { value: new THREE.Vector4() }, uS2: { value: new THREE.Vector4() } };
  function buildFish(singles) {
    if ((HERO && HERO.fish === false) || NOLIFE) return;   /* BUBBLE-HERO: no schools behind the mark · OCEAN: no fish */
    if (fishSpecies.length && !fishMeshes.length && !UWQ.has('uwOwnFish') && !LANE_MODE) {
      /* the lens dwells at the beats: put the schools just above and ahead of it there (AD-LIFE's depth order kept) */
      const slots = [-12.6, -16.5, -24.6, -30, -36.6, -41.5, -45.2, -51.5], all = [];
      fishSpecies.forEach(sp => (sp.spec.schools || []).forEach(sc => all.push(sc)));
      all.sort((a, b) => (b.y ?? -20) - (a.y ?? -20)).forEach((sc, i) => { sc.y = slots[Math.min(slots.length - 1, Math.round(i * (slots.length - 1) / Math.max(1, all.length - 1)))]; sc.R = Math.min(sc.R ?? 5, 4.5); sc.x = Math.max(-2, Math.min(2, sc.x ?? 0)); });
    }
    if (fishSpecies.length && !fishMeshes.length && !UWQ.has('uwOwnFish')) {
      /* AD-LIFE: one draw per species, its schools from the manifest (depth y, centre z/x, loop radius R, count n, size range sz, tint) */
      fishSpecies.forEach((sp, k) => {
        const big = /fusilier|butterfly/.test(sp.spec.name || sp.spec.glb), more = /sardine|chromis/.test(sp.spec.name || sp.spec.glb) ? 1.4 : 1.15;
        const schools = (sp.spec.schools || []).slice(0, 3).map((sc, j) => ({ x: sc.x ?? 0, y: sc.y ?? -20, z: Math.max(-10, Math.min(-7, sc.z ?? -9)), R: sc.R ?? 8, w: sc.w ?? (j % 2 ? -0.04 : 0.045), ph: sc.ph ?? (k + j * 1.7), n: Math.round((sc.n ?? 60) * more), sz: (sc.sz || [0.3, 0.45]).map(v => v * (big ? 1.3 : 1)), tint: sc.tint || [1, 1, 1], spread: sc.spread }));
        const U = { uS0: { value: new THREE.Vector4() }, uS1: { value: new THREE.Vector4() }, uS2: { value: new THREE.Vector4() } };
        const R2 = rng(91 + k), sing = []; for (let i = 0; i < (sp.spec.singles || 0); i++) sing.push([0, -6 - R2() * 48, -8 - R2() * 16, (R2() < 0.5 ? -1 : 1) * (0.6 + R2() * 0.8), (sp.spec.singleSize || 0.8) * (0.8 + 0.4 * R2())]);
        const mesh = fishMesh({ geo: sp.geo, tex: sp.tex }, schools, sing, U); fishMeshes.push({ mesh, schools, U });
      });
      fish = fishMeshes[0].mesh; info.fish = fishMeshes.reduce((a, f) => a + f.mesh.geometry.instanceCount, 0); info.fishTris = fishMeshes.reduce((a, f) => a + f.mesh.geometry.instanceCount * f.mesh.geometry.index.count / 3, 0);
      return;
    }
    if (!fishSrc || fish) return;
    fish = fishMesh(fishSrc, SCHOOLS, singles, fishU); fishMeshes.push({ mesh: fish, schools: SCHOOLS, U: fishU });
    info.fish = fish.geometry.instanceCount; info.fishTris = fish.geometry.instanceCount * fishSrc.geo.index.count / 3;
  }
  function fishMesh(src, schools, singles, U) {
    const g = new THREE.InstancedBufferGeometry(); g.index = src.geo.index;
    g.setAttribute('position', src.geo.attributes.position); g.setAttribute('normal', src.geo.attributes.normal); g.setAttribute('uv', src.geo.attributes.uv);
    const rig = !!src.geo.attributes.color; if (rig) g.setAttribute('aRig', src.geo.attributes.color);   /* AD-LIFE's swim rig */
    const off = [], dat = [], tin = [], RF = rng(4711);
    schools.forEach((sc, k) => { const sp = sc.spread || [6.5, 2.2, 3.6];
      for (let i = 0; i < sc.n; i++) { off.push((RF() - 0.5) * sp[0], (RF() - 0.5) * sp[1], (RF() - 0.5) * sp[2]); dat.push(RF(), sc.sz[0] + RF() * (sc.sz[1] - sc.sz[0]), k, RF()); const v = 0.92 + RF() * 0.16; tin.push(sc.tint[0] * v, sc.tint[1] * v, sc.tint[2] * v); } });
    for (const [x, y, z, sp, sz] of singles) { off.push(x, y, z); dat.push(RF(), sz, 3, sp); tin.push(1, 1, 1); }
    g.setAttribute('iOff', new THREE.InstancedBufferAttribute(new Float32Array(off), 3)); g.setAttribute('iData', new THREE.InstancedBufferAttribute(new Float32Array(dat), 4));
    g.setAttribute('iTint', new THREE.InstancedBufferAttribute(new Float32Array(tin), 3));
    g.instanceCount = dat.length / 4;
    const m = new THREE.ShaderMaterial({ defines: rig ? { RIG: 1 } : {}, uniforms: { ...C, ...L, ...U, tFish: { value: src.tex }, uFogK: { value: UWT.fogK } }, vertexShader: fishVS, fragmentShader: fishFS, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 9; scene.add(mesh);
    return mesh;
  }
  function placeLane(aspect, plantData) {
    const grp = new THREE.Group(), R = rng(777), a = new THREE.Vector3(), nv = new THREE.Vector3(), q = new THREE.Quaternion(); grp.name = 'lane';
    if (!stones) stones = { pillars: [stoneGeo('pillar', 3, 6.5, 0.8), stoneGeo('pillar', 5, 8.5, 1.0), stoneGeo('pillar', 9, 4.5, 0.65)], flats: [stoneGeo('flat', 13, 1, 1), stoneGeo('flat', 17, 1, 1.2)] };
    const stoneMat = makeRockMat({ texScale: 0.45, moss: 0.35, bright: 0.8, fogMin: 0, soft: 0, normK: 1.0, seed: 0.7 }, tex);
    let tris = 0, nReef = 0;
    const plantsOn = (m, ch, keep, maxY) => {   /* plants only where the scan faces up once placed (ledges), never on the walls */
      m.getWorldQuaternion(q);
      for (let i = 0; i < ch.anchors.length; i += 6) {
        if (R() > keep) continue;
        nv.set(ch.anchors[i + 3], ch.anchors[i + 4], ch.anchors[i + 5]).applyQuaternion(q); if (nv.y < 0.82) continue;
        a.set(ch.anchors[i], ch.anchors[i + 1], ch.anchors[i + 2]).applyMatrix4(m.matrixWorld); if (a.y > maxY) continue;
        const sz = 0.6 + 0.9 * R(); plantData.push([a.x, a.y - sz * 0.06, a.z, sz, 1.0, Math.floor(R() * 8), R(), 0]);
      }
    };
    const reef = (ch, x, z, s, rx, ry, rz, sink, useLo) => {
      const lod = useLo && ch.lo, m = new THREE.Mesh(lod ? ch.lo : ch.geo, bommie.mat); m.rotation.set(rx, ry, rz, 'YXZ'); m.scale.setScalar(s);
      m.position.set(x, floorH(x, z) - sink, z); m.renderOrder = 2; m.updateMatrixWorld(true); grp.add(m); tris += lod ? ch.loTris : ch.tris; nReef++; return m;
    };
    const stone = (geo, x, z, s, yaw, sink = 0.05) => {
      const m = new THREE.Mesh(geo, stoneMat); m.position.set(x, floorH(x, z) - sink, z); m.rotation.y = yaw; m.scale.setScalar(s); m.renderOrder = 3; m.updateMatrixWorld(true); grp.add(m);
      tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; return m;
    };
    const cluster = (x, z, n, spread, warm) => {   /* a coral / plant cluster on the sand: several sizes, the tall ones behind */
      for (let i = 0; i < n; i++) {
        const px = x + (R() - 0.5) * spread, pz = z + (R() - 0.5) * spread * 0.7, sz = (0.45 + 1.0 * R()) * (i < 2 ? 1.5 : 1);
        const cell = warm && R() < 0.55 ? 5 + Math.floor(R() * 3) : Math.floor(R() * 5);
        plantData.push([px, floorH(px, pz) - sz * 0.05, pz, sz, 1.0, cell, R(), 0]);
      }
    };
    /* banks of reef along both sides (natural orientation, the long side along the lane), set back from the path */
    for (let k = 0, z = 6; z > -235; k++) {
      for (const side of [-1, 1]) {
        const ch = bommie.chunks[((k + (side > 0 ? 1 : 0))) % bommie.chunks.length], s = 0.5 + R() * 0.22, halfW = (ch.bb.max.x - ch.bb.min.x) * 0.5 * s;
        const zz = z + (side > 0 ? 11 : 0) + (R() - 0.5) * 8, inner = 7.5 + R() * 4 + (Math.abs(zz + 145) < 14 ? 4 : 0);
        const m = reef(ch, LANE.x(zz) + side * (inner + halfW), zz, s, 0, (R() - 0.5) * 0.5 + (R() < 0.5 ? Math.PI : 0), 0, 0.8 + R() * 0.8, true);
        plantsOn(m, ch, 0.18, LANE.sand + 5);
      }
      z -= 26 + R() * 8;
    }
    /* the stations: a big rock mass close on one side (the scan turned on its side: its relief faces the path), a coral cluster on the sand a
       few metres ahead, flat stones, a few pillars behind */
    LANE.stations.forEach((st, i) => {
      const lx = LANE.x(st.z);
      if (st.side) {
        const ch = bommie.chunks[(i) % bommie.chunks.length], s = 0.62 + 0.08 * R(), relief = ch.bb.max.y * s, tall = (ch.bb.max.x - ch.bb.min.x) * s;
        const m = reef(ch, lx + st.side * (3.4 + relief * 0.8), st.z + 4, s, 0, (R() - 0.5) * 0.25, st.side < 0 ? -Math.PI / 2 : Math.PI / 2, -tall * 0.5 + 1.5 + R() * 1.5);
        plantsOn(m, ch, 0.35, LANE.sand + 7);
        cluster(lx - st.side * 1.2, st.z - 3.5, 16, 3.2, true);
        cluster(lx + st.side * 1.6, st.z + 1.5, 7, 1.6, false);
        for (let p = 0; p < 3; p++) stone(stones.pillars[(i + p) % 3], lx - st.side * (4 + p * 1.7 + R()), st.z - 9 - p * 2.5 - R() * 3, 0.8 + R() * 0.35, R() * 6, 0.4);
      } else if (st.name === 'values') {
        /* a clearing: the surface open above, pillars round the far side */
        for (const ang of [-1.35, -0.85, 0.8, 1.3, 1.6]) { const p = Math.round(ang * 10) & 3; stone(stones.pillars[p % 3], lx + Math.sin(ang) * 11, st.z - 6 - Math.cos(ang) * 7, 0.9 + R() * 0.4, R() * 6, 0.4); }
        cluster(lx - 4.5, st.z + 2, 12, 3, true); cluster(lx + 5, st.z - 1, 10, 3, true);
      }
    });
    /* flat stones on the sand and small clusters along the path */
    for (let z = -6; z > -175; z -= 3.2 + R() * 3) {
      const side = R() < 0.5 ? -1 : 1, x = LANE.x(z) + side * (1.6 + R() * 4.5);
      stone(stones.flats[Math.floor(R() * 2)], x, z, 0.35 + R() * 0.7, R() * 6, 0.06);
      if (R() < 0.45) cluster(LANE.x(z) + side * (3.5 + R() * 3), z - 1.5, 3 + Math.floor(R() * 4), 1.4, R() < 0.5);
    }
    scene.add(grp); groups.push(grp);
    info.tris += tris; info.slabs = nReef; info.layers.push({ lane: nReef, tris: Math.round(tris) });
    /* the fish: two schools + a few single fish crossing the path (one instanced draw) */
    buildFish([[-22, 2.2, 1.1], [-63, 3.4, -0.8], [-92, 1.8, 1.3], [-118, 4.0, -1.0], [-150, 2.6, 0.9], [-170, 3.2, -1.2]].map(([z, y, sp]) => [LANE.x(z), LANE.sand + y, z, sp, 0.42 + 0.2 * ((z * 7) % 1 + 1) % 1]));
  }
  /* PHASE 4 · the descent: reef walls left and right all the way down (the scan on its side, its relief facing the open middle; a front
     column at full detail and a back column at the light LOD), ledges at the stations' depths with plants and coral on them, schools at
     three depths, the seabed at the bottom with boulders, pillars, flat stones and coral clusters. */
  function placeDescent(aspect, plantData) {
    const grp = new THREE.Group(), R = rng(1777), a = new THREE.Vector3(), nv = new THREE.Vector3(), q = new THREE.Quaternion(); grp.name = 'descent';
    if (!stones) stones = { pillars: [stoneGeo('pillar', 3, 6.5, 0.8), stoneGeo('pillar', 5, 8.5, 1.0), stoneGeo('pillar', 9, 4.5, 0.65)], flats: [stoneGeo('flat', 13, 1, 1), stoneGeo('flat', 17, 1, 1.2)] };
    const stoneMat = makeRockMat({ texScale: 0.45, moss: 0.35, bright: 0.8, fogMin: 0, soft: 0, normK: 1.0, seed: 0.7 }, tex);
    const narrow = aspect < 1; let tris = 0, n = 0;
    const put = (ch, lod, x, y, z, s, rx, ry, rz) => { const useLo = lod && ch.lo, m = new THREE.Mesh(useLo ? ch.lo : ch.geo, bommie.mat);
      m.rotation.set(rx, ry, rz, 'YXZ'); m.scale.setScalar(s); m.position.set(x, y, z); m.renderOrder = 2; m.updateMatrixWorld(true); grp.add(m); tris += useLo ? ch.loTris : ch.tris; n++; return m; };
    const plantsOn = (m, ch, keep) => { m.getWorldQuaternion(q);
      for (let i = 0; i < ch.anchors.length; i += 6) { if (R() > keep) continue;
        nv.set(ch.anchors[i + 3], ch.anchors[i + 4], ch.anchors[i + 5]).applyQuaternion(q); if (nv.y < 0.8) continue;
        a.set(ch.anchors[i], ch.anchors[i + 1], ch.anchors[i + 2]).applyMatrix4(m.matrixWorld);
        const sz = 0.5 + 0.9 * R(); plantData.push([a.x, a.y - sz * 0.06, a.z, sz, 1.0, Math.floor(R() * 8), R(), 0]); } };
    /* walls: bands down both sides, each chunk standing on its side (local up → toward the middle) */
    for (const side of [-1, 1]) {
      let k = side > 0 ? 1 : 0;
      for (let y = 2 + R() * 4; y > DESC.sea - 6; k++) {
        const ch = bommie.chunks[(k) % bommie.chunks.length], s = (0.78 + R() * 0.18) * (narrow ? 0.7 : 1), relief = ch.bb.max.y * s, tall = (ch.bb.max.x - ch.bb.min.x) * s;
        const inner = (5.2 + R() * 2.2) * (narrow ? 0.7 : 1);
        put(ch, false, side * (inner + relief * 0.82), y - tall * 0.5, -6 - R() * 8, s, (R() - 0.5) * 0.12, (R() - 0.5) * 0.3, side < 0 ? -Math.PI / 2 : Math.PI / 2);
        /* the back column, further out and deeper in z, at the light LOD */
        const ch2 = bommie.chunks[((k + 1)) % bommie.chunks.length], s2 = s * 1.1;
        put(ch2, true, side * (inner + 5 + ch2.bb.max.y * s2 * 0.8), y - tall * 0.45 - 4, -38 - R() * 10, s2, 0, (R() - 0.5) * 0.4, side < 0 ? -Math.PI / 2 : Math.PI / 2);
        y -= tall * (0.62 + R() * 0.18);
      }
    }
    /* ledges at the stations' depths, alternating sides: a reef top jutting in under the lens, plants and coral on it */
    DESC.stations.forEach((st, i) => {
      if (st.name === 'open' || st.name === 'values') return;
      const side = i % 2 ? 1 : -1, ch = bommie.chunks[((i + 2)) % bommie.chunks.length], s = 0.32 + R() * 0.06;
      const m = put(ch, false, side * (4.5 + (ch.bb.max.z - ch.bb.min.z) * s * 0.5), st.y - 3.4, -11 - R() * 4, s, 0, Math.PI / 2 + (R() - 0.5) * 0.4, 0);
      m.scale.y = s * 1.7; m.updateMatrixWorld(true);   /* a thicker shelf growing out of the wall */
      plantsOn(m, ch, 0.85);
    });
    /* the seabed: boulders, pillars, flat stones, coral clusters, a clear spot in the middle under the drop */
    for (let i = 0; i < 6; i++) { const side = i % 2 ? 1 : -1, ch = bommie.chunks[(i) % bommie.chunks.length], x = side * (6 + R() * 10), z = -8 - i * 7 - R() * 6, s = 0.22 + R() * 0.16;
      const m = put(ch, true, x, seabedH(x, z) - 0.6, z, s, 0, R() * 6, 0); plantsOn(m, ch, 0.5); }
    for (let p = 0; p < 6; p++) { const side = p % 2 ? 1 : -1, x = side * (3.5 + R() * 9), z = -10 - R() * 30, g = stones.pillars[p % 3];
      const st = new THREE.Mesh(g, stoneMat); st.position.set(x, seabedH(x, z) - 0.4, z); st.rotation.y = R() * 6; st.scale.setScalar(0.9 + R() * 0.5); st.updateMatrixWorld(true); grp.add(st); tris += g.index.count / 3; }
    for (let i = 0; i < 26; i++) { const x = (R() - 0.5) * 22, z = -3 - R() * 30, g = stones.flats[i % 2];
      const st = new THREE.Mesh(g, stoneMat); st.position.set(x, seabedH(x, z) - 0.05, z); st.rotation.y = R() * 6; st.scale.setScalar(0.35 + R() * 0.8); st.updateMatrixWorld(true); grp.add(st); tris += g.index.count / 3; }
    for (let c = 0; c < 14; c++) { const side = c % 2 ? 1 : -1, cx0 = side * (2.5 + R() * 9), cz0 = -6 - R() * 32, nC = 6 + Math.floor(R() * 10);
      for (let i = 0; i < nC; i++) { const px = cx0 + (R() - 0.5) * 3, pz = cz0 + (R() - 0.5) * 2.2, sz = 0.45 + 1.1 * R(); plantData.push([px, seabedH(px, pz) - sz * 0.05, pz, sz, 1.0, R() < 0.5 ? 5 + Math.floor(R() * 3) : Math.floor(R() * 5), R(), 0]); } }
    scene.add(grp); groups.push(grp);
    info.tris += tris; info.slabs = n; info.layers.push({ descent: n, tris: Math.round(tris) });
    /* single fish crossing at many depths, two big ones close to the lens */
    const singles = [];
    for (let i = 0; i < 16; i++) singles.push([0, -5 - i * 3.2 - R() * 2, -9 - R() * 16, (R() < 0.5 ? -1 : 1) * (0.7 + R() * 0.8), 0.4 + R() * 0.35]);
    singles.push([0, -21, -6.5, 0.55, 1.25], [0, -44, -7.5, -0.45, 1.45]);
    buildFish(singles);
  }
  /* fish: the body bends in a wave running to the tail; schools turn as one on a slow loop, each fish wandering a little in its place */
  const fishVS = /* glsl */`
    attribute vec3 iOff; attribute vec4 iData; attribute vec3 iTint; uniform float uTime; uniform vec4 uS0, uS1, uS2;
#ifdef RIG
    attribute vec4 aRig;
#endif
    varying vec2 vUv; varying vec3 vN; varying float vDist; varying vec3 vTint;
    vec3 rotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x * c - v.z * s, v.y, v.x * s + v.z * c); }
    void main(){
      float ph = iData.x, sc = iData.y, id = iData.z;
      vec3 p = position;
      float w = smoothstep(0.3, -0.75, p.x), f = 7.0 + iData.w * 3.0;
#ifdef RIG
      float big = step(0.7, sc);   /* the big singles: slower, smaller beat */
      p.z += sin(uTime * mix(f, 3.0, big) + ph * 6.283 - aRig.z * 7.0) * 0.12 * mix(1.0, 0.6, big) * aRig.x;
      p.z += sin(uTime * f * 1.7 + ph * 4.0) * 0.03 * aRig.y;
#else
      p.z += sin(uTime * f + ph * 6.283 - p.x * 5.0) * 0.12 * w;
#endif
      vec3 c; float yaw;
      vTint = iTint;
      if (id < 2.5) {
        vec4 S = id < 0.5 ? uS0 : (id < 1.5 ? uS1 : uS2);
        vec3 o = iOff + vec3(sin(uTime * 0.41 + ph * 6.283) * 0.4, sin(uTime * 0.53 + ph * 9.1) * 0.25, cos(uTime * 0.37 + ph * 5.3) * 0.4);
        c = S.xyz + rotY(o, -S.w); yaw = S.w + 0.18 * sin(uTime * 0.7 + ph * 7.0);
      } else {
        float sp = iData.w, tr = mod(uTime * abs(sp) + ph * 44.0, 44.0) - 22.0;
        c = iOff + vec3(sign(sp) * tr, 0.4 * sin(uTime * 0.5 + ph * 6.0), 1.5 * sin(tr * 0.08 + ph * 3.0)); yaw = sp > 0.0 ? 0.0 : 3.14159;
      }
      /* local +x (the head) along the heading (cos yaw, 0, sin yaw) */
      vec3 wp = c + rotY(p * sc, -yaw);
      vN = rotY(normal, -yaw); vUv = uv;
      vec4 mv = viewMatrix * vec4(wp, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv;
    }`;
  const fishFS = CM + /* glsl */`
    uniform sampler2D tFish; uniform vec3 uKeyDir, uKeyCol, uSky, uGround; uniform float uFogK;
    varying vec2 vUv; varying vec3 vN; varying float vDist; varying vec3 vTint;
    void main(){
      vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), alb = texture2D(tFish, vUv).rgb * vTint;
      alb = mix(vec3(dot(alb, vec3(0.3, 0.59, 0.11))), alb, 0.8) * vec3(0.96, 0.99, 1.03);   /* in the river's palette: a little calmer, cooler */
      vec3 col = alb * (mix(uGround, uSky, N.y * 0.5 + 0.5) * 1.35 + uKeyCol * (max(dot(N, normalize(uKeyDir)), 0.0) * 0.6 + 0.12));   /* a little more light from above (AD-LIFE's note) */
      col += uKeyCol * pow(max(N.y, 0.0), 6.0) * 0.08;
      float fd = max(vDist - 0.5, 0.0), f = 1.0 - exp(-fd * uFogK - fd * fd * 0.00012);
      gFar = smoothstep(0.04, 0.72, f); col = mix(col, bgAt(gl_FragCoord.xy), clamp(f, 0.0, 1.0));
      gl_FragColor = vec4(toSRGB(col), 1.0);
    }`;
  const groups = [], tex = { rock: null, norm: null, moss: null };
  let plants = null, built = '';
  const tanH = () => Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  function build(aspect, depth) {
    if (riseBankGroup) {
      for (const rock of riseBankGroup.children) rock.geometry.dispose();
      riseBankGroup = null;
    }
    for (const g of groups) scene.remove(g);
    groups.length = 0; rockMats.forEach(m => m.dispose()); rockMats.length = 0;
    if (plants) { scene.remove(plants); plants.geometry.dispose(); plants = null; }
    if (plants2) { scene.remove(plants2); plants2.geometry.dispose(); plants2 = null; }
    for (const m of mists) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } mists.length = 0;
    if (specks) { scene.remove(specks); specks.geometry.dispose(); specks = null; }
    if (bubbles) { scene.remove(bubbles); bubbles.geometry.dispose(); bubbles = null; }
    info.tris = 0; info.slabs = 0; info.layers = [];
    const narrow = aspect < 1, plantData = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), Sv = new THREE.Vector3(), Pv = new THREE.Vector3(), tip = new THREE.Vector3(), a = new THREE.Vector3(), nA = new THREE.Vector3();
    if (bommie && LANE_MODE) placeLane(aspect, plantData);
    else if (bommie && bommie.kit === 'mtn') placeMountains(aspect);   /* OCEAN: the canyon mountains go on down */
    else if (bommie && bommie.kit === 'reef3') placeDescent3(aspect);   /* OCEAN: the client's reef scan */
    else if (bommie && bommie.kit === 'reef2') placeDescent2(aspect, plantData);   /* PHASE 4: AD-REEF's kit */
    else if (bommie) placeDescent(aspect, plantData);   /* PHASE 4: the reef gorge for the descent */   /* UNDER WATER: the lane (reef scan chunks, stones, clusters, fish) instead of the slabs */
    else LAYERS.forEach((Ly, k) => {
      const R = rng(2000 + k * 131), hH = -Ly.z * tanH(), hW = hH * aspect;
      const s = Ly.T * 2 * hH * (narrow ? (k === 0 ? 0.55 : 0.75) : 1);   /* the slab's thickness in metres = its scale (shapes are carved with T = 1) */
      const mat = makeRockMat({ texScale: 0.55, moss: Ly.moss, bright: Ly.bright, fogMin: Ly.fogMin, soft: Ly.soft, normK: Ly.normK, seed: k * 0.37 }, tex);
      const grp = new THREE.Group(); grp.name = 'layer ' + k;
      const yTop = hH * 1.5, yEnd = -(depth + hH * 1.5);
      let y = yTop - R() * hH * 0.6, side = R() < 0.5 ? -1 : 1, n = 0, tris = 0, pairNext = false;
      while (y > yEnd) {
        const sh = sculpt[(k * 2 + n * 5 + Math.floor(R() * 3)) % sculpt.length];
        const geo = Ly.lod === 'hi' ? sculpt[sculpt.indexOf(sh)].hi : sh.lo;
        const tilt = THREE.MathUtils.degToRad(Ly.tilt[0] + (Ly.tilt[1] - Ly.tilt[0]) * R()) * (R() < 0.5 ? -1 : 1);
        const yaw = (R() - 0.5) * 0.5, roll = (R() - 0.5) * 0.25;
        E.set(roll, (side > 0 ? Math.PI : 0) + yaw, tilt, 'YXZ'); Q.setFromEuler(E);
        /* the broken tip sits this share of the half width in from the frame edge; the rest of the slab runs out past the frame */
        /* its root must run out past the frame (never a floating island): the reach from the tip back to the root, seen across */
        const reach = 0.82 * sh.shape.L * s * Math.abs(Math.cos(tilt)) - 0.12 * hW;
        const prot = Math.max(0.04, Math.min((Ly.prot[0] + (Ly.prot[1] - Ly.prot[0]) * R()) * (narrow ? (k === 0 ? 0.6 : 0.85) : 1), reach / hW));
        tip.set(sh.shape.L * 0.4, 0, 0).applyQuaternion(Q).multiplyScalar(s);
        Pv.set(side * hW * (1 - prot) - tip.x, y - tip.y, Ly.z + (R() - 0.5) * hH * 0.15 - tip.z);
        const mesh = new THREE.Mesh(geo, mat); mesh.position.copy(Pv); mesh.quaternion.copy(Q); mesh.scale.setScalar(s);
        mesh.renderOrder = k; mesh.updateMatrixWorld(true); grp.add(mesh);
        tris += geo.index.count / 3; info.slabs++;
        /* flowers growing out of the cracks on top, moss cushions, a little grass; moss hanging off the front edges */
        if (Ly.plants > 0) {
          const A = sh.anchors, nAn = A.length / 7;
          for (let i = 0; i < nAn; i++) {
            if (R() > Ly.plants) continue;
            a.set(A[i * 7], A[i * 7 + 1], A[i * 7 + 2]).applyMatrix4(mesh.matrixWorld);
            nA.set(A[i * 7 + 3], A[i * 7 + 4], A[i * 7 + 5]).applyQuaternion(Q);
            if (nA.y < 0.55) continue;
            const crack = A[i * 7 + 6], cl = 2 + Math.floor(R() * 4);
            for (let c = 0; c < cl; c++) {
              const kind = R(), cell = c === 0 && R() < 0.15 ? 3 : kind < 0.36 ? 0 : kind < 0.5 ? 1 : kind < 0.62 ? 6 : kind < 0.84 ? 2 : 7;
              const size = s * (cell === 3 ? 0.36 : cell === 2 ? 0.42 : 0.28) * (0.7 + 0.6 * R()) * (0.8 + 0.4 * crack);
              const ox = (R() - 0.5) * s * 0.5, oz = (R() - 0.5) * s * 0.4;
              plantData.push([a.x + ox, a.y - size * 0.12, a.z + oz, size, cell === 3 ? 0.55 : 1.05, cell, R(), 0]);
            }
          }
          /* hanging moss: from the top front edge (local z = +D/2 side toward the lens after the turn) */
          const nH = Math.round((R() * 2.2) * Ly.plants);
          for (let i = 0; i < nH; i++) {
            a.set(sh.shape.L * (-0.05 + 0.4 * R()), 0.42, sh.shape.D * 0.5 * (side > 0 ? -1 : 1) * 0.92).applyMatrix4(mesh.matrixWorld);
            const size = s * (0.22 + 0.3 * R());
            plantData.push([a.x, a.y, a.z, size, 1.3, 4, R(), 1]);
          }
        }
        const pair = !pairNext && R() < 0.3;
        pairNext = pair;
        y -= pair ? hH * 2 * (0.08 + 0.14 * R()) : hH * 2 * (Ly.every[0] + (Ly.every[1] - Ly.every[0]) * R());
        if (pair || R() < 0.8) side = -side;
        n++;
      }
      scene.add(grp); groups.push(grp);
      info.tris += tris; info.layers.push({ z: Ly.z, slabs: n, tris });
    });
    /* UNDER WATER: the sea bed's plants (same instanced draw): kelp, sea fans, soft coral, sponges, mostly toward both sides, thinning into the fog */
    if (UW && aquaOK && !bommie) {
      /* the baked aquarium plants (aqua/, CC-BY): square cards, clumps toward both sides of the sandy lane */
      const R = rng(4242), nF = narrow ? 120 : 260;
      for (let i = 0; i < nF; i++) {
        const z = -5 - Math.pow(R(), 0.85) * 70, hH = -z * tanH(), side = R() < 0.5 ? -1 : 1;
        const x = side * hH * aspect * (0.3 + Math.pow(R(), 0.6) * 0.95);
        const cell = Math.floor(R() * 8), clump = 1 + Math.floor(R() * 3), big = (cell === 2 || cell === 5 ? 1.5 : 1.15) * (0.8 + 0.9 * R());
        for (let c = 0; c < clump; c++) {
          const px = x + (R() - 0.5) * 1.6, pz = z + (R() - 0.5) * 1.6, sz = big * (0.7 + 0.5 * R());
          plantData.push([px, floorH(px, pz) - sz * 0.05, pz, sz, 1.0, (cell + c * 3) % 8, R(), 0]);
        }
      }
    } else if (UW) {
      const R = rng(4242), nF = narrow ? 260 : 560;
      for (let i = 0; i < nF; i++) {
        const z = -5 - Math.pow(R(), 0.85) * 75, hH = -z * tanH(), side = R() < 0.5 ? -1 : 1;
        const x = side * hH * aspect * (0.28 + Math.pow(R(), 0.6) * 1.0);   /* a clear sandy lane in the middle, the drop's corridor */
        const k = R(), cell = k < 0.26 ? 2 : k < 0.44 ? 5 : k < 0.62 ? 0 : k < 0.74 ? 7 : k < 0.85 ? 1 : k < 0.93 ? 6 : 3;
        const big = cell === 2 ? 1.2 + 1.5 * R() : cell === 5 ? 0.9 + 1.0 * R() : 0.5 + 0.7 * R();
        const clump = cell === 2 ? 2 + Math.floor(R() * 3) : 1;
        for (let c = 0; c < clump; c++) {
          const px = x + (R() - 0.5) * 1.4, pz = z + (R() - 0.5) * 1.4, sz = big * (0.7 + 0.5 * R());
          plantData.push([px, floorH(px, pz) - sz * 0.06, pz, sz, cell === 3 ? 0.55 : cell === 5 ? 1.0 : cell === 2 ? 1.9 : 1.05, cell, R(), 0]);
        }
      }
    }
    /* plants (one instanced draw) */
    const mkPlants = (list, mat) => {
      const q = new THREE.InstancedBufferGeometry();
      q.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
      const P = new Float32Array(list.length * 3), Dd = new Float32Array(list.length * 4), Hg = new Float32Array(list.length);
      list.forEach((d, i) => { P.set([d[0], d[1], d[2]], i * 3); Dd.set([d[3], d[4], d[5], d[6]], i * 4); Hg[i] = d[7]; });
      q.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 3)); q.setAttribute('iData', new THREE.InstancedBufferAttribute(Dd, 4)); q.setAttribute('iHang', new THREE.InstancedBufferAttribute(Hg, 1));
      q.instanceCount = list.length;
      const m = new THREE.Mesh(q, mat); m.frustumCulled = false; m.renderOrder = 8; scene.add(m); return m;
    };
    if (HERO && HERO.life != null) {   /* BUBBLE-HERO: fewer plants — the kelp ribbons and tube sponges go first, a fraction of the rest stays (stable pick by index) */
      const keep = plantData.filter((d, i) => { if (d[8] === 1 ? d[5] === 4 : (d[5] === 2 || d[5] === 7)) return false; const h = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return h - Math.floor(h) < HERO.life; });
      plantData.length = 0; plantData.push(...keep);
    }
    if (NOLIFE) plantData.length = 0;   /* OCEAN: no water plants */
    { const a1 = plantData.filter(d => !(plants2OK && d[8] === 1)), a2 = plants2OK ? plantData.filter(d => d[8] === 1) : [];
      if (a1.length) plants = mkPlants(a1, plantMat); if (a2.length) plants2 = mkPlants(a2, plantMat2); info.plants = plantData.length; }
    /* mist sheets between the depths (not under water: the fog does it, and the lens travels through them) */
    if (!UW) [[-7.2, 0.2, 7], [-14, 0.28, 13], [-26, 0.32, 21]].forEach(([z, alpha, seed], i) => {
      const hH = -z * tanH(), hW = hH * aspect, H = depth + hH * 3;
      const m = new THREE.ShaderMaterial({ uniforms: { ...C, uAlpha: { value: alpha }, uSeed: { value: seed * 0.137 }, uScale: { value: new THREE.Vector2(1.6 * aspect, H / hH * 0.5) } },
        vertexShader: mistVS, fragmentShader: mistFS, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(hW * 2.4, H), m);
      mesh.position.set(0, -depth * 0.5, z); mesh.renderOrder = 20 + i; mesh.frustumCulled = false; scene.add(mesh); mists.push(mesh);
    });
    /* specks */
    {
      const R = rng(77), n = (narrow ? 300 : 600) * (UW ? 2 : 1), P = new Float32Array(n * 3), S = new Float32Array(n);
      for (let i = 0; i < n; i++) { const z = -3 - Math.pow(R(), 1.4) * 30, hH = -z * tanH(); P.set([(R() * 2 - 1) * hH * aspect * 1.1, hH * 1.2 - R() * (depth + hH * 2.4), z], i * 3); S[i] = 0.5 + R() * 1.1; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 1));
      specks = new THREE.Points(g, speckMat); specks.frustumCulled = false; specks.renderOrder = 25; scene.add(specks);
    }
    /* UNDER WATER: more snow (a second scatter in the same draw would need a rebuild: the count is set here) + the bubbles */
    if (UW) {
      const R = rng(91), streams = narrow ? 6 : 11, per = 13, loose = narrow ? 40 : 80, B = [];
      for (let s = 0; s < streams; s++) {
        const z = -5 - Math.pow(R(), 0.9) * 24, hH = -z * tanH(), side = R() < 0.5 ? -1 : 1, x = side * hH * aspect * (0.38 + 0.55 * R()), ph = R() * 21, sz = R();
        for (let i = 0; i < per; i++) B.push(x + (R() - 0.5) * 0.08, ph + i * (0.9 + R() * 0.8), z + (R() - 0.5) * 0.08, Math.min(1, sz * 0.6 + R() * 0.5));
      }
      for (let i = 0; i < loose; i++) { const z = -3.5 - Math.pow(R(), 1.2) * 30, hH = -z * tanH(); B.push((R() * 2 - 1) * hH * aspect * 1.05, R() * 21, z, R() * 0.7); }
      /* burst bubbles (relative to the lens): a plume off the drop (6.3 m ahead) and streams along the lens's left / right edges */
      for (let i = 0; i < 70; i++) B.push((R() - 0.5) * 1.8, -1.5 - R() * 0.7, (T.dropZ ?? -6.3) + 0.6 + (R() - 0.5) * 1.0, 2 + R() * 0.98);   /* just in front of the drop, round its rim */
      for (let i = 0; i < 14; i++) B.push((R() - 0.5) * 0.22, 0.42 + R() * 0.1, 0.25 + (R() - 0.5) * 0.1, 3 + R() * 0.98);   /* the drop's trail */
      for (let i = 0; i < 90; i++) { const z = -1.8 - R() * 1.4, hW = -z * tanH() * aspect, side = R() < 0.5 ? -1 : 1; B.push(side * hW * (0.78 + 0.2 * R()), -2.2 - R() * 0.8, z, 2 + R() * 0.98); }
      const g = new THREE.BufferGeometry(); g.setAttribute('aB', new THREE.Float32BufferAttribute(B, 4));
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(B.length / 4 * 3), 3));
      bubbles = new THREE.Points(g, bubbleMat); bubbles.frustumCulled = false; bubbles.renderOrder = 26; scene.add(bubbles);
      info.bubbles = B.length / 4;
      if (moteMat && !motes) { const Rm = rng(313), M = [];
        for (let i = 0; i < 90; i++) { const z = -0.7 - Math.pow(Rm(), 1.3) * 2.8, hw = -z * 0.31 * aspect * 1.1; M.push((Rm() * 2 - 1) * hw, Rm() * 5, z, Rm()); }
        const mg = new THREE.BufferGeometry(); mg.setAttribute('aM', new THREE.Float32BufferAttribute(M, 4)); mg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(M.length / 4 * 3), 3));
        motes = new THREE.Points(mg, moteMat); motes.frustumCulled = false; motes.renderOrder = 27; scene.add(motes); }
    }
    built = (narrow ? 'narrow' : 'wide') + ':' + aspect.toFixed(1);
  }

  /* ---------------------------------------------------------------- GPU time of this canvas (opts.gpuTimer: ?gorgeGpu=1), EXT_disjoint_timer_query_webgl2 */
  const tq = opts.gpuTimer ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null, pending = [];
  info.gpu = [];
  function gpuBegin() {
    if (!tq) return;
    for (let i = pending.length - 1; i >= 0; i--) {
      const q = pending[i];
      if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { info.gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); if (info.gpu.length > 240) info.gpu.shift(); } gl.deleteQuery(q); pending.splice(i, 1); }
    }
    if (pending.length > 4) return;
    const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); pending.push(q); pending.open = q;
  }
  function gpuEnd() { if (tq && pending.open) { gl.endQuery(tq.TIME_ELAPSED_EXT); pending.open = null; } }

  /* ---------------------------------------------------------------- API */
  let W = 1, H = 1, dpr = 1, depthM = T.depth ?? 18, ready = false;
  const api = {
    fitWaterEdges,
    THREE, renderer, scene, camera, info, tune: T, get ready() { return ready; }, uw: UW ? UWU : null, uwTune: UWT2, get far() { return FAR; }, look: { tilt: null, camZ: null, camY: null }, lane: LANE, descent: DESC,
    get lensMat() { return lens && lens.mat; },
    async load() {
      /* the hitch at the first beat (g ≈ 605, found 2026-11-18: gone with the texts hidden): the beats' fonts decoding and their glyphs
         rasterising on first sight. Load the faces and paint every glyph once, unseen, while the section prepares. */
      if (UW && document.fonts) {
        try {
          const MONO = opts.mono || 'XS Mono';   /* opts.mono: the rise page's subset face ("RL Mono", ?uwq) instead of the 293 KB "XS Mono" */
          await Promise.all(['500 60px "XS Grotesk"', '500 40px "XS Grotesk"', '400 12px "XS Jakarta"', `400 12px "${MONO}"`, `400 11px "${MONO}"`].map(f => document.fonts.load(f).catch(() => null)));
          const g = document.createElement('div'), abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,—−·[]: ';
          g.setAttribute('aria-hidden', 'true');
          g.style.cssText = 'position:fixed;left:0;top:0;opacity:0.004;pointer-events:none;z-index:-1;white-space:nowrap;color:#eef7f9';
          g.innerHTML = ['XS Grotesk|clamp(32px, 3.05vw, 60px)|500', 'XS Jakarta|12px|400', MONO + '|11.5px|400', MONO + '|10.5px|400', MONO + '|12px|400'].map(x => { const [f, sz, w] = x.split('|'); return `<div style="font:${w} ${sz} '${f}', sans-serif">${abc}<span lang="zh-Hant" style="font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif">洞察先於判斷以知為本紀律創造長期價值四大投資領域策略</span></div>`; }).join('');
          document.body.appendChild(g);
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          g.remove();
        } catch (error) { }
      }
      /* …and the beats themselves (their per-letter blur and layout): shown once, nearly transparent, in two states, then put back */
      if (UW) {
        const ui = document.getElementById('xs-ui'), beats = ui ? [...ui.querySelectorAll('.xs-beat')] : [];
        if (ui && beats.length && !ui.classList.contains('is-on')) {
          try {
            const keepOp = ui.style.opacity; ui.style.opacity = '0.003'; ui.classList.add('is-on');
            for (const k of ['0.45', '1']) {
              beats.forEach(b => { b.classList.add('is-on'); b.style.setProperty('--k', k); b.style.setProperty('--kc', k); b.style.setProperty('--kb', k); b.style.setProperty('--o', '0'); });
              await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            }
            beats.forEach(b => { b.classList.remove('is-on'); ['--k', '--kc', '--kb', '--o'].forEach(v => b.style.removeProperty(v)); });
            ui.classList.remove('is-on'); ui.style.opacity = keepOp;
          } catch (error) { }
        }
      }
      /* TEXTURES (Team T, 2026-11-21; rise page only, ?optT=0 / ?perf=0 = as before): baked/coastal-slate-1024.webp is a byte copy of images/maritime/terrain/coastal-slate-1024.webp,
         which the canyon (index1-5-terrain.js) has already requested: ask for that URL, so the browser's cache answers instead of a second 455 KB download */
      const T_SLATE = document.documentElement.hasAttribute('data-rise-studio-pbr') && UWQ.get('perf') !== '0' && UWQ.get('optT') !== '0' && !(texTier && texTier.tier !== 'high');
      const [rock, norm, moss] = await Promise.all([load(T_SLATE ? 'images/maritime/terrain/coastal-slate-1024.webp' : url('coastal-slate', 1024), true), load(url('cliff-normal', 1024), false), load(url('grass-color', 512), true)]);
      tex.rock = rock || tNoise; tex.norm = norm || tNoise; tex.moss = moss || tNoise;
      /* UNDER WATER: the reef scan + the baked plant cards (the slabs' worker only if they fail: then today's slabs stand in) */
      if (UW && !UWQ.has('uwSlabs')) { try { await loadReef(); } catch (error) { bommie = null; info.reefError = String(error && error.message || error); } }
      if (!bommie) await sculptAll();
      if (FAR) { try { await loadFar(); } catch (error) { info.far.error = String(error && error.message || error); } }
      if (OCEAN) { const tf = await OC.loadFine(THREE, renderer); if (tf) OCU.tOcF.value = tf; else info.oceanError = 'fine map'; }
      if (OCEAN) { const t = await (opts.oceanSurface ? OC.loadSurface(THREE, renderer, opts.oceanSurface) : OC.loadSurface(THREE, renderer)); if (t) { OCU.tOcN.value = t; api.ocean.surfaceTex = t; } else info.oceanError = 'surface map'; }   /* OCEAN */
      buildFloor();
      makeLens();
      api.setSize(innerWidth, innerHeight, opts.dpr || 1);
      ready = true;
      if ((NEAR2 || FAR || UWTEX) && !(HERO && HERO.panel === false)) try {   /* UWTEX: the panel also carries the sample's dials */
        const apply = () => { if (moteMat) moteMat.uniforms.uMote.value = UWT2.mote; if (bommie && bommie.kit === 'reef2') { bommie.mat.uniforms.uNormK.value = UWT2.relief; bommie.rockMat.uniforms.uNormK.value = UWT2.relief * 0.92; }
          UWTXU.caus.value = UWT2.txCaus; UWTXU.clear.value = UWT2.txClear; UWTXU.top.value = UWT2.txTop; };   /* UWTEX */
        window.__FLOW2_PANEL__?.add({ id: 'uw-far', title: '水下 遠景', key: 'u', tune: UWT2, onChange: apply, rows: [
          ['— 遠景（影片） —'], ['遠景強度', 'far', 0, 1.5, 0.01], ['光束對比', 'contrast', 0, 2.5, 0.01], ['光束亮白', 'white', 0, 3, 0.01], ['深處光束', 'deep', 0, 1.5, 0.01],
          ['— 近景 —'], ['鏡頭前浮塵', 'mote', 0, 3, 0.01], ['岩石立體感', 'relief', 0.5, 2, 0.01]].concat(UWTEX ? [   /* UWTEX */
          ['— 材質樣本（?uwtex=2）—'], ['焦散光（岩壁＋沙）', 'txCaus', 0, 2.5, 0.01], ['近景清晰', 'txClear', 0, 1.5, 0.01], ['頂光（立體感）', 'txTop', 0, 2, 0.01]] : []) });
        apply();
      } catch (error) { }
    },
    setSize(w, h, d) {
      const aspect = w / h;
      camera.aspect = aspect; camera.fov = naturalFov(); camera.updateProjectionMatrix();
      const key = (aspect < 1 ? 'narrow' : 'wide') + ':' + aspect.toFixed(1);
      if (key !== built) build(aspect, depthM);
      if (w === W && h === H && d === dpr) return;
      W = w; H = h; dpr = d;
      renderer.setPixelRatio(1); renderer.setSize(Math.round(w * d), Math.round(h * d), false);
      A.setSize(Math.round(w * d), Math.round(h * d)); B.setSize(Math.round(w * d), Math.round(h * d));
      C.uRes.value.set(Math.round(w * d), Math.round(h * d)); outMat.uniforms.uRes.value.set(Math.round(w * d), Math.round(h * d));
      speckMat.uniforms.uPx.value = d * (h / 930);
      if (bubbleMat) bubbleMat.uniforms.uPx.value = d * (h / 930);
      if (moteMat) moteMat.uniforms.uPx.value = d * (h / 930);
    },
    /* where the drop is on the screen (CSS px) and its radius, for the texts' leader lines */
    dropScreen: { x: 0, y: 0, r: 0 },
    /* s = { camY, camX, surf, glow, deep, time, live, drop: { y, r, stretch, wob }, mode, line: [y, amp, phase, lip], brush: {on, b, dir, reduce, look}, boostA, boostB, fade } */
    render(s) {
      if (!ready) return;
      const t = s.time || 0;
      gpuBegin();
      const pitch = T.pitch ?? 0.35, laneOn = UW && !!bommie && LANE_MODE, descentOn = UW && !!bommie && !LANE_MODE;
      /* the values place: the lens tilts up toward the surface (s.tilt 0..1 from the controller, or api.look.tilt for QA); the drop keeps its place in the water */
      const tilt = api.look.tilt ?? (UWQ.get('values') === '1' ? (s.tilt ?? 0) : 0), tE = tilt * tilt * (3 - 2 * tilt);   /* PHASE 5: the values place is off (?values=1 brings it back) */
      let cx = s.camX || 0, cy = s.camY, cz = 0, lookX = cx * 0.6, lookZ = -20, lookY0 = s.camY - pitch;
      const Lk = api.look;
      if (laneOn) {
        /* first person along the lane: DIVE passes camX/camY/camZ; until then (and for QA: api.look.camZ) the old sinking depth is read as the travel */
        if (Lk.camZ != null) { cz = Lk.camZ; cx = LANE.x(cz); cy = floorH(cx, cz) + LANE.eye; }
        else if (s.camZ != null) { cz = s.camZ; cx = s.camX ?? LANE.x(cz); cy = s.camY; }
        else { const p = clamp01(-s.camY / 18), qq = clamp01((p - 0.15) / 0.85), k = ss(0.15, 0.27, p); cz = -qq * 152; cx = LANE.x(cz); cy = s.camY + (floorH(cx, cz) + LANE.eye - s.camY) * k; }
        lookZ = cz - 20; lookX = s.lookX ?? (LANE.x(cz - 20) * 0.6 + cx * 0.4); lookY0 = cy + 20 * Math.tan(s.pitch ?? 0.0);
      }
      if (descentOn) {
        /* the descent: DIVE passes metres (s.descent); without it the controller's old 18 m depth is read as the way down (QA: api.look.camY) */
        if (Lk.camY != null) cy = Lk.camY;
        else if (s.descent) cy = s.camY;
        else { const p = clamp01(-s.camY / 18); cy = p < 0.155 ? s.camY : DESC.top + (DESC.bottom - DESC.top) * Math.min(1, (p - 0.155) / 0.845); }
        const near = ss(DESC.bottom + 9, DESC.bottom, cy), pa = s.pitch ?? (-0.03 - 0.2 * near);
        cx = s.camX || 0; cz = 0; lookX = cx * 0.6; lookZ = -20; lookY0 = cy + 20 * Math.tan(pa);
      }
      if (riseWaterline) {
        const frame = s.waterline;
        const fov = frame?.fov ?? naturalFov();
        const shiftY = frame?.shiftY ?? 0;
        if (camera.fov !== fov || Math.abs(camera.projectionMatrix.elements[9] - shiftY) > 1e-6) {
          camera.fov = fov;
          if (Math.abs(shiftY) > 1e-6) {
            const width = 1000 * camera.aspect;
            camera.setViewOffset(width, 1000, 0, -shiftY * 500, width, 1000);
          } else if (camera.view?.enabled) camera.clearViewOffset();
          else camera.updateProjectionMatrix();
        }
        if (frame?.sun?.lengthSq() > 0.5) {
          riseSun.value.copy(frame.sun);
          if (frame.sunColor) OCU.uOcSunCol.value.copy(frame.sunColor);
        }
        const light = L.uKeyDir.value.copy(riseSun.value);
        light.x /= 1.333;
        light.z /= 1.333;
        light.y = Math.sqrt(Math.max(0, 1 - light.x * light.x - light.z * light.z));
        // The camera supplies the pitch for the surface, geometry and shafts together.
        OCU.uOcA.value.x = 0;
        UWU.snow.value = baseSnow * (s.live === false ? 0.27 : 0.36);
        riseOptics.value.set(1 + 0.12 * (frame?.shallow ?? 0), shiftY);
        riseLighting.update(t, s.live !== false, riseSun.value.y);
        // Move the eye along the canyon heading, so the rock, bed and light have the same parallax.
        const advance = frame?.advance ?? 0;
        cz -= advance;
        lookZ -= advance;
      }
      camera.position.set(cx, cy, cz); camera.lookAt(lookX, lookY0 + tE * (T.tiltRise ?? 10.5), lookZ); camera.updateMatrixWorld();
      if (UW) { UWU.tilt.value = tE; UWU.ceilK.value = (laneOn ? 0.021 : 0.034) * (1 - 0.62 * tE); UWU.camZ.value = cz; if (bubbleMat) bubbleMat.uniforms.uCamZ.value = cz; }
      if (laneOn || descentOn) for (const F of fishMeshes) {   /* the schools' slow loops (CPU: a point + a heading each) */
        F.schools.forEach((sc, k) => { const an = t * sc.w + sc.ph, x = (laneOn ? LANE.x(sc.z) : 0) + sc.x + sc.R * Math.cos(an), z = sc.z + sc.R * 0.6 * Math.sin(an);
          const dx = -sc.R * Math.sin(an) * sc.w, dzz = sc.R * 0.6 * Math.cos(an) * sc.w, y = (laneOn ? LANE.sand + sc.h : sc.y) + 0.6 * Math.sin(t * 0.13 + sc.ph);
          [F.U.uS0, F.U.uS1, F.U.uS2][k].value.set(x, y, z, Math.atan2(dzz, dx)); });
      }
      if (bubbleMat) {   /* PHASE 5: the bubbles follow the scroll (the lens's vertical speed, smoothed) */
        const BU = bubbleMat.uniforms, dt = Math.min(0.1, Math.max(0.001, t - (bubState.t ?? t - 0.016))), v = bubState.y == null ? 0 : (cy - bubState.y) / dt;
        bubState.t = t; bubState.y = cy; bubState.v += (Math.max(-40, Math.min(40, v)) - bubState.v) * (1 - Math.exp(-dt * 7));
        const sp = Math.abs(bubState.v);
        BU.uPhase.value += -bubState.v * dt * 0.55; BU.uStr.value = 1 + Math.min(0.5, sp * 0.04);   /* a slight stretch, not streaks */ BU.uCamX.value = cx;
        const tgt = ss(3, 12, sp); BU.uBurst.value += (tgt - BU.uBurst.value) * (1 - Math.exp(-dt * (tgt > BU.uBurst.value ? 6 : 1.4)));
      }
      if (descentOn) { UWU.rayK.value = 0.35 + 0.65 * Math.exp(cy * 0.028);
        if (ray) { const k = clamp01((-22 - cy) / 16), vis = k > 0 && k < 1; ray.visible = vis; if (vis) ray.material.uniforms.uRay.value.set(-16 + 32 * k, cy - 0.6 + Math.sin(k * 3.1) * 1.2, -6.5 - 1.5 * Math.sin(k * 3.1), 0.12 * Math.sin(k * 6.2)); } }
      C.uCamY.value = cy; C.uSurf.value = s.surf; C.uGlow.value = s.glow ?? 1; C.uDeep.value = descentOn ? 0.92 * ss(4, 64, -cy) : laneOn ? Math.min(0.5, s.deep ?? 0) : (s.deep ?? 0); C.uTime.value = t;
      if (UW) {
        const e = camera.matrixWorld.elements;
        UWU.camPos.value.copy(camera.position); UWU.camR.value.set(e[0], e[1], e[2]); UWU.camU.value.set(e[4], e[5], e[6]); UWU.camF.value.set(-e[8], -e[9], -e[10]);
        UWU.tanH.value = tanH();
        if (s.surfY != null) UWU.surfY.value = s.surfY;   /* DIVE's hooks (optional): the surface's world height, the ceiling's brightness */
        if (s.ceil != null) UWU.ceil.value = s.ceil;
      }
      if (OCEAN) {   /* OCEAN (lead 11-18): open water in the first metres — the open water itself (the same ground pass, a second time) veils the gorge, and thins as the lens passes −8 … −14 m: the walls come out of the water in place; no ringed bubbles there */
        let f = clamp01((cy - OCX.veilB) / Math.max(0.5, OCX.veilA - OCX.veilB)); f = f * f * (3 - 2 * f); f *= OCX.open;   /* dials: ocean.dials.veilA / veilB (m), ?ocVeilA= ?ocVeilB= */
        /* the hand-over after the crossing (CROSS drives s.ceil 0.35 → 1): at 0.35 the ceiling is dim and soft (glints ≈ 25 %, rays ≈ 15 %), 1 = full;
           the hotspot slides from the canyon sun's place on the screen (s.sunX, default 0.49) to its own */
        { const c = clamp01(UWU.ceil.value); let r = clamp01((c - 0.35) / 0.65); r = r * r * (3 - 2 * r); const on = ss(0, 0.35, c), pres = on * (0.55 + 0.45 * r);
          OCU.uOcK.value.set(pres, 2.6 * (1 - r), 0, 0); OCU.uOcB.value.x = OCX.glint * (0.25 + 0.75 * r) / (0.55 + 0.45 * r);
          OCU.uOcRay.value.x = (s.sunX ?? OCX.sunX) + (OCX.hotX - (s.sunX ?? OCX.sunX)) * r; OCU.uOcRay.value.z = OCX.rays * on * (0.15 + 0.85 * r); OCU.uOcRay.value.w = OCX.glow * on * (0.3 + 0.7 * r); api.ocean.ramp = r; }
        if (riseWaterline) {
          const light = L.uKeyDir.value;
          const forward = light.dot(UWU.camF.value), vertical = light.dot(UWU.camU.value);
          const distance = Math.max(0.22, forward) * UWU.tanH.value;
          const x = light.dot(UWU.camR.value) / (distance * camera.aspect);
          const y = vertical / distance - riseOptics.value.y;
          const rays = OCU.uOcRay.value;
          // A glint may leave the frame. The columns themselves live in the water.
          rays.x = 0.5 + 0.5 * x;
          rays.y = 0.5 + 0.5 * y;
          rays.z = OCX.rays;
        }
        ocVeil.visible = !riseBankGroup && f > 0.003;
        const solid = f > 0.997;
        bg.visible = !!riseBankGroup || !solid;
        for (const g of groups) {
          g.visible = g === riseBankGroup ? riseLighting.uniforms.uRiseRockOpacity.value > 0 : !solid;
        }
        ocVeil.material.uniforms.uOcOver.value = f;
        UWU.bubbles.value = OCX.bub * (riseWaterline
          ? 0.12 * (1 - f) + 0.34 * (s.waterline?.spray ?? 0) : 1 - f);
        api.ocean.open = f;
      }
      if (FAR) farFrame(cy, tanH(), camera.aspect);
      if (s.boostA) C.uBoostA.value.fromArray(s.boostA); if (s.boostB) C.uBoostB.value.fromArray(s.boostB);
      plantMat.uniforms.uWind.value = s.live ? (T.wind ?? (UW ? 0.13 : 0.06)) : 0;
      /* 1 · the gorge into A */
      if (riseWaterline) opts.onUnderwaterFrame?.(s, L.uKeyDir.value);
      renderer.setRenderTarget(A); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, false);
      renderer.render(scene, camera);
      info.drawTris = renderer.info.render.triangles; info.drawCalls = renderer.info.render.calls;   /* this pass only (autoReset) */
      /* 2 · A into B, the drop over it reading A */
      const dz = T.dropZ ?? -6.3, hH = -dz * tanH(), r = s.drop.worldRadius ?? (s.drop.r ?? 0.115) * 2 * hH * 0.5 * 2;
      const st = s.drop.stretch || 1, wob = s.drop.wob || [1, 1, 1];
      const along = -dz / 20;   /* the screen centre's line at the drop's depth */
      if (s.dropAt) dropMesh.position.fromArray(s.dropAt);
      else dropMesh.position.set(cx + (lookX - cx) * along, cy + (lookY0 - cy) * along + (s.drop.y || 0) * hH * 2 - (laneOn ? tE * hH * 1.25 : 0), cz + dz);   /* looking up: the drop sinks well under the values row */
      if (info.lens === 'bubble') {   /* a bubble's surface oscillates: an oblate/prolate mode + a slower one, livelier while the lens moves */
        const a = (0.022 + 0.035 * Math.min(1, Math.abs(bubState.v) / 9)) * (s.live === false ? 0 : 1), o1 = Math.sin(t * 6.3) * a, o2 = Math.sin(t * 3.7 + 1.1) * a * 0.6;
        dropMesh.scale.set(r * (1 + o1 - o2 * 0.4), r * (1 - o1 * 1.15 + o2) * 0.97, r * (1 + o1 + o2 * 0.3));
        lens.mat.uniforms.uLight.value = descentOn ? 0.45 + 0.75 * Math.exp(cy * 0.03) : 1;
      } else dropMesh.scale.set(r * wob[0] / Math.sqrt(st), r * wob[1] * st * 1.06, r * wob[2] / Math.sqrt(st));
      dropMesh.rotation.set(0, 0, 0);
      dropMesh.visible = (s.drop.opacity ?? 1) > 0.002 && !NODROP;
      if (lens && dropMesh.visible) lens.update(lens.mat, { mesh: dropMesh, camera, sceneTexture: A.texture, width: A.width, height: A.height,
        sunDir: L.uKeyDir.value, sunColor: SUNC, skyColor: UW ? SKYC_UW : SKYC, opacity: s.drop.opacity ?? 1, glow: s.drop.glow ?? 0.12 });
      if (lens && lens.mat.uniforms.uWater) { if (UW) lens.mat.uniforms.uWater.value.setRGB(0.03, 0.11, 0.17); else lens.mat.uniforms.uWater.value.setRGB(0.12, 0.15, 0.18); }
      if (info.lens === 'bubble') lens.mat.uniforms.uWater.value.setRGB(0.2, 0.3, 0.41);   /* the bubble mirrors the water round it (mid blue), not black */
      copyMat.uniforms.tA.value = A.texture;
      if ((FAR || riseWaterline) && !dropMesh.visible) outMat.uniforms.tB.value = A.texture;
      else {
        outMat.uniforms.tB.value = B.texture;
        renderer.setRenderTarget(B); renderer.clear(true, false, false);
        renderer.render(dropScene, camera);
      }
      /* where it is on the screen */
      const v = DV.copy(dropMesh.position).project(camera);
      api.dropScreen.x = (v.x * 0.5 + 0.5) * W; api.dropScreen.y = (0.5 - v.y * 0.5) * H;
      const scaleDepth = s.drop.worldRadius == null ? hH : Math.max(0.1, -DV.copy(dropMesh.position).applyMatrix4(camera.matrixWorldInverse).z) * tanH();
      api.dropScreen.r = r / scaleDepth * H * 0.5;
      /* 3 · onto the screen */
      const U = outMat.uniforms;
      U.uMode.value = s.mode || 0; U.uFade.value = s.fade ?? 1;
      U.uDrop.value.set(api.dropScreen.x / W, 1 - api.dropScreen.y / H, api.dropScreen.r / H, (s.drop.halo ?? 0.16) * (s.drop.opacity ?? 1) * (info.lens === 'bubble' ? 0.3 : 1) * (NODROP ? 0 : 1));   /* a bubble carries no glow of its own */
      if (bubbleMat) bubbleMat.uniforms.uDropRel.value.copy(dropMesh.position).sub(camera.position);
      if (s.line) U.uLine.value.fromArray(s.line);
      if (s.open) U.uOpen.value.fromArray(s.open);   /* mode 3: [cx, cy, radius, feather] */
      if (s.brush) { U.uBrush.value.set(s.brush.on ? 1 : 0, s.brush.b, s.brush.dir || 1, s.brush.reduce ? 1 : 0); if (s.brush.look) U.uBrushLook.value.fromArray(s.brush.look); U.uMargin.value = s.brush.margin ?? 0.03; }
      renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false);
      renderer.render(outScene, ortho);
      gpuEnd();
    },
    /* compile everything without showing it (KHR_parallel_shader_compile where available), then one tiny real draw */
    async warm(s) {
      if (!ready) return;
      if (FAR) s = { ...s, drop: { ...(s.drop || {}), opacity: 0 } };   /* UW-BUILD: the copy target B stays unallocated unless a drop is drawn later */
      { const seen = new Set(), up = m => { if (!m || !m.uniforms) return; for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture && !seen.has(v)) { seen.add(v); try { renderer.initTexture(v); } catch (e) { } } } };
        scene.traverse(o => { if (o.material) up(o.material); }); [plantMat, speckMat, bubbleMat, bgMat].forEach(up); info.warmTextures = seen.size; }
      if (FAR) for (const b of FAR.bands) if (b.ok && !b.unloaded) { const sl = FAR.slots[0]; if (sl.w && (sl.w !== b.v.videoWidth || sl.h !== b.v.videoHeight)) sl.tex.dispose(); sl.band = b; sl.tex.image = b.v; sl.tex.needsUpdate = true; sl.uT.value = sl.tex; sl.w = b.v.videoWidth; sl.h = b.v.videoHeight; try { renderer.initTexture(sl.tex); } catch (e) { } }
      try { await renderer.compileAsync(scene, camera); await renderer.compileAsync(dropScene, camera); await renderer.compileAsync(outScene, ortho); } catch (error) { }
      const keep = [W, H, dpr];
      if (riseWaterline) {
        if (opts.warmDrop) renderer.initRenderTarget(B);
        api.render({ ...s, camY: -0.14 });
        api.render(s);
        if (bubbleMat) bubbleMat.uniforms.uBurst.value = 0;
        bubState.t = bubState.y = null;
        bubState.v = 0;
        return keep;
      }
      api.render(s);
      /* PHASE 5: draw the way down once, unseen (every LOD's buffers, the fish, the seabed uploaded before the section shows) */
      if (UW && bommie && !LANE_MODE) { for (const y of [-4, -12, -20, -28, -36, -44, -52, -56]) { api.look.camY = y; api.render(s); } api.look.camY = null; }
      try {   /* every screen-pass state once (the crossing's line, the circle), and the bubbles' burst, in their real draw state */
        api.render({ ...s, mode: 1, line: [0.5, 0.011, 1.0, 1.0], surf: 0.5 }); api.render({ ...s, mode: 3, open: [0.5, 0.5, 0.3, 0.02] });
        if (bubbleMat) { bubbleMat.uniforms.uBurst.value = 1; bubbleMat.uniforms.uStr.value = 1.4; api.render(s); bubbleMat.uniforms.uBurst.value = 0; bubbleMat.uniforms.uStr.value = 1; bubState.t = null; bubState.y = null; bubState.v = 0; }
        renderer.getContext().finish();   /* the driver finishes all of it now, not on the first frame that shows */
      } catch (error) { }
      if (FAR) {   /* UW-BUILD: only the first band stays loaded until the lens goes under (the decoders of the others freed) */
        FAR.bands.forEach((b, i) => { if (b.unloaded) return; b.v.pause(); b.v.removeAttribute('src'); b.v.load(); b.unloaded = true; b.ok = false; b.w = 0; b.v.addEventListener('loadeddata', () => { b.ok = true; }, { once: true }); });
        for (const sl of FAR.slots) { sl.band = null; sl.P.w = 0; }
      }
      return keep;
    },
    clear() { renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false); },
    dispose() { causticTarget?.dispose(); renderer.dispose(); A.dispose(); B.dispose(); if (FAR) { clearInterval(FAR.timer); for (const b of FAR.bands) { b.v.pause(); b.v.removeAttribute('src'); b.v.load(); } } }
  };
  /* a small copy of Team SQ's lens recipe (Drops by saharan, MIT — notice in prototypes/canyon-seagull/flow2-drop-lead.js), used only when
     their factory is absent (?drop=0): exact ray–ellipsoid, refraction in and out, the picture behind read where the exit ray lands */
  function ownLens() {
    return new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, uHasScene: { value: 0 }, uScreen: { value: new THREE.Vector2(1, 1) }, uMV: { value: new THREE.Matrix4() }, uInvMV: { value: new THREE.Matrix4() },
        uNrm: { value: new THREE.Matrix3() }, uProj: { value: new THREE.Matrix4() }, uViewToWorld: { value: new THREE.Matrix3() }, uSun: { value: new THREE.Vector3(0, 1, 0) },
        uSunCol: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color(0.6, 0.7, 0.8) }, uWater: { value: new THREE.Color(0.1, 0.12, 0.15) }, uOpacity: { value: 1 }, uFar: { value: T.dropFar ?? 30 } },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: 'varying vec3 vView; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: /* glsl */`precision highp float;
uniform sampler2D tScene; uniform float uHasScene, uOpacity, uFar; uniform vec2 uScreen; uniform mat4 uMV, uInvMV, uProj; uniform mat3 uNrm, uViewToWorld; uniform vec3 uSun, uSunCol, uSky, uWater; varying vec3 vView;
vec3 picture(vec3 p, vec3 d){ vec4 c = uProj * vec4(p + d * uFar, 1.0); if (c.w <= 1e-3) return uSky; vec2 uv = c.xy / c.w * 0.5 + 0.5; return uHasScene > 0.5 ? texture2D(tScene, clamp(uv, vec2(0.002), vec2(0.998))).rgb : uSky; }
void main(){
  float lv = length(vView); vec3 eye = vView / max(lv, 1e-5);
  vec3 ro = (uInvMV * vec4(0.0, 0.0, 0.0, 1.0)).xyz, rd = normalize((uInvMV * vec4(eye, 0.0)).xyz);
  float b = dot(ro, rd), h = b * b - (dot(ro, ro) - 1.0); if (h <= 0.0) discard;
  vec3 p1 = ro + rd * (-b - sqrt(h)); vec3 nf = normalize(uNrm * p1); float ndv = clamp(dot(-eye, nf), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 d1 = refract(eye, nf, 1.0 / 1.33); vec3 dd = normalize((uInvMV * vec4(d1, 0.0)).xyz);
  float bb = dot(p1, dd), hh = max(bb * bb - (dot(p1, p1) - 1.0), 0.0); vec3 p2 = p1 + dd * (-bb + sqrt(hh));
  vec3 nOut = normalize(uNrm * p2); vec3 d2 = refract(d1, -nOut, 1.33);
  vec3 thru = dot(d2, d2) < 1e-8 ? uWater * 0.6 : picture((uMV * vec4(p2, 1.0)).xyz, d2);
  vec3 rf = reflect(eye, nf); vec3 refl = mix(uWater, uSky * 1.2, smoothstep(-0.12, 0.3, (uViewToWorld * rf).y));
  float spec = pow(max(dot(normalize(uViewToWorld * rf), uSun), 0.0), 256.0) * 2.0;
  vec3 col = mix(thru * 1.06 * (1.0 - 0.45 * exp(-pow((ndv - 0.3) / 0.12, 2.0))), refl, F) + vec3(1.0) * pow(1.0 - ndv, 6.0) * 0.25 + uSunCol * spec;
  gl_FragColor = vec4(clamp(col, 0.0, 24.0) * uOpacity, uOpacity);
}`
    });
  }
  /* an AIR BUBBLE in water (water → air, eta 1.33): past the critical angle (r/R > 0.75) total internal reflection — a mirror ring of the
     light above and the dark water below; inside, the scene behind seen through a diverging lens (small, upright), Fresnel rising to 1 at the
     critical angle; a thin bright edge and a small highlight of the light from above; everything scaled by the light at this depth.
     Exact ray–ellipsoid as SQ's recipe (the analytic silhouette, anti-aliased over one pixel). */
  function bubbleLens() {
    return new THREE.ShaderMaterial({
      defines: riseWaterline ? { RISE_BUBBLE: 1 } : {},
      uniforms: { tScene: { value: null }, uHasScene: { value: 0 }, uScreen: { value: new THREE.Vector2(1, 1) }, uMV: { value: new THREE.Matrix4() }, uInvMV: { value: new THREE.Matrix4() },
        uNrm: { value: new THREE.Matrix3() }, uProj: { value: new THREE.Matrix4() }, uViewToWorld: { value: new THREE.Matrix3() }, uSun: { value: new THREE.Vector3(0, 1, 0) },
        uSunCol: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color(0.62, 0.74, 0.84) }, uWater: { value: new THREE.Color(0.05, 0.1, 0.17) }, uOpacity: { value: 1 }, uFar: { value: T.dropFar ?? 30 }, uLight: { value: 1 } },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: 'varying vec3 vView; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: /* glsl */`precision highp float;
uniform sampler2D tScene; uniform float uHasScene, uOpacity, uFar, uLight; uniform vec2 uScreen; uniform mat4 uMV, uInvMV, uProj; uniform mat3 uNrm, uViewToWorld; uniform vec3 uSun, uSunCol, uSky, uWater; varying vec3 vView;
vec3 pic(vec3 p, vec3 d){ vec4 c = uProj * vec4(p + d * uFar, 1.0); if (c.w <= 1e-3) return uWater; vec2 uv = c.xy / c.w * 0.5 + 0.5; return uHasScene > 0.5 ? texture2D(tScene, clamp(uv, vec2(0.002), vec2(0.998))).rgb : uWater; }
vec3 env(vec3 w){ return mix(uWater, uSky * (1.05 + 0.35 * smoothstep(0.4, 1.0, w.y)), smoothstep(-0.55, 0.85, w.y)) * uLight; }   /* the water all round, brighter toward the surface: silver, not chrome */
void main(){
  float lv = length(vView); vec3 eye = vView / max(lv, 1e-5);
  vec3 ro = (uInvMV * vec4(0.0, 0.0, 0.0, 1.0)).xyz, rd = normalize((uInvMV * vec4(eye, 0.0)).xyz);
  float b = dot(ro, rd), h = b * b - (dot(ro, ro) - 1.0); float aa = clamp(h / max(fwidth(h), 1e-6), 0.0, 1.0); if (aa <= 0.0) discard; h = max(h, 1e-7);
  vec3 p1 = ro + rd * (-b - sqrt(h)); vec3 nf = normalize(uNrm * p1); float ci = clamp(dot(-eye, nf), 0.0, 1.0);
  vec3 rf = reflect(eye, nf), rfW = normalize(uViewToWorld * rf);
  vec3 refl = env(rfW);
#ifdef RISE_BUBBLE
  // Keep the refraction local to the meniscus as the camera approaches the surface.
  float incidence = sqrt(max(0.0, 1.0-ci*ci));
  vec2 radiusOnScreen = vec2(length(uMV[0].xyz)*uProj[0][0], length(uMV[1].xyz)*uProj[1][1])
                     / (2.0*max(0.1, -uMV[3].z));
  vec2 screen = gl_FragCoord.xy / uScreen;
  vec2 bend = nf.xy * radiusOnScreen * (0.14 + 0.18*incidence*incidence);
  vec3 through = texture2D(tScene, clamp(screen+bend, vec2(0.002), vec2(0.998))).rgb;
  vec3 behind = texture2D(tScene, screen).rgb;
  float fresnel = 0.03 + 0.28*pow(1.0-ci, 2.4);
  vec3 col = mix(through, mix(behind, refl, 0.47), fresnel);
  vec3 normal = normalize(uViewToWorld * nf);
  vec3 light = normalize(uSun);
  float litSide = smoothstep(-0.36, 0.83, dot(normal, light));
  float rim = pow(smoothstep(0.78, 0.997, incidence), 1.85) * mix(0.17, 0.62, litSide);
  vec3 edgeTint = mix(vec3(0.46, 0.68, 0.83), vec3(0.89, 0.97, 1.0), litSide);
  col = mix(col, edgeTint, rim * 0.74);
  float reflection = pow(max(0.0, dot(rfW, light)), 102.0);
  vec2 skySide = vec2(dot(uViewToWorld[0], light), dot(uViewToWorld[1], light));
  float lampLength = length(skySide);
  vec2 lamp = skySide / max(lampLength, 0.001);
  float azimuth = dot(nf.xy, lamp) / max(length(nf.xy), 0.001);
  float arc = pow(clamp(azimuth, 0.0, 1.0), 28.0) * smoothstep(0.82, 0.94, incidence)
            * (1.0 - smoothstep(0.955, 0.998, incidence));
  vec2 facet = nf.xy - lamp*0.56;
  float pin = exp(-dot(facet, facet)*144.0) * smoothstep(0.02, 0.23, lampLength);
  vec3 pearl = mix(vec3(0.77, 0.91, 1.0), uSunCol, 0.28);
  col = mix(col, pearl, max(reflection, max(0.63*arc, 0.86*pin)) * min(0.76, 0.55*uLight));
#else
  float s2 = 1.7689 * (1.0 - ci * ci), F = 1.0;   /* water → air */
  vec3 thru = refl;
  if (s2 < 1.0) {
    float ct = sqrt(1.0 - s2), rs = (1.33 * ci - ct) / (1.33 * ci + ct), rp = (ci - 1.33 * ct) / (ci + 1.33 * ct); F = clamp(0.5 * (rs * rs + rp * rp), 0.0, 1.0);
    vec3 d1 = refract(eye, nf, 1.33); vec3 dd = normalize((uInvMV * vec4(d1, 0.0)).xyz);
    float bb = dot(p1, dd), hh = max(bb * bb - (dot(p1, p1) - 1.0), 0.0); vec3 p2 = p1 + dd * (-bb + sqrt(hh));
    vec3 nOut = normalize(uNrm * p2); vec3 d2 = refract(d1, -nOut, 1.0 / 1.33);
    thru = dot(d2, d2) < 1e-8 ? refl : pic((uMV * vec4(p2, 1.0)).xyz, d2) * 1.1;
  }
  /* the ring past the critical angle: a mirror; a soft bright band just inside it, where the reflection rises */
  float ring = smoothstep(0.62, 0.68, 1.0 - ci) ;
  vec3 col = mix(thru, refl, max(F, ring * 0.0));
  col = mix(col, refl * 1.15, smoothstep(0.64, 0.7, sqrt(max(1.0 - ci * ci, 0.0))));
  col += uSunCol * pow(1.0 - ci, 14.0) * 0.55 * uLight;                                         /* the thin bright edge */
  col += uSunCol * pow(max(dot(rfW, normalize(uSun)), 0.0), 260.0) * 1.4 * uLight;           /* the light from above, small */
#endif
  gl_FragColor = vec4(clamp(col, 0.0, 8.0) * uOpacity, uOpacity) * aa;
}`
    });
  }
  function ownUpdate(mat, o) {
    const u = mat.uniforms, cam = o.camera, mesh = o.mesh;
    mesh.updateMatrixWorld(); cam.updateMatrixWorld();
    u.uMV.value.multiplyMatrices(cam.matrixWorldInverse, mesh.matrixWorld); u.uInvMV.value.copy(u.uMV.value).invert(); u.uNrm.value.getNormalMatrix(u.uMV.value);
    u.uProj.value.copy(cam.projectionMatrix); u.uViewToWorld.value.setFromMatrix4(cam.matrixWorld);
    u.tScene.value = o.sceneTexture || null; u.uHasScene.value = o.sceneTexture ? 1 : 0; if (o.width) u.uScreen.value.set(o.width, o.height);
    if (o.sunDir) u.uSun.value.copy(o.sunDir).normalize(); if (o.sunColor) u.uSunCol.value.copy(o.sunColor); if (o.skyColor) u.uSky.value.copy(o.skyColor);
    u.uOpacity.value = o.opacity ?? 1;
  }
  /* OCEAN: what CROSS (dg-dive.js) may read — null without ?ocean=1. surfaceTex = the slope map (RG = dh/dx, dh/dz around 0.5, B = height;
     repeat-wrapped; null until load() ends), tint = the water's colours (THREE.Color, linear),
     hot = the hotspot on the screen (uniform object, xy in shares, y up), u = every dial as uniform objects, palette = the sRGB hex values */
  api.ocean = OCEAN ? { on: true, version: OC.VERSION, surfaceTex: null, palette: oceanPalette, tint: { top: C.uBgTop.value, mid: C.uBgMid.value, low: C.uBgLow.value, abyss: C.uAbyss.value, glow: C.uBgGlow.value, deep: OCU.uOcDeep.value },
    sunCol: OCU.uOcSunCol.value, sky: OCU.uOcSky.value, hot: OCU.uOcRay, u: { ...OCU, ...riseLighting?.uniforms }, dials: OCX,
    lightingRows: riseLighting?.rows, tone: riseWaterline ? OC.RISE_TONE : OC.TONE, life: !NOLIFE } : null;
  return api;
}
