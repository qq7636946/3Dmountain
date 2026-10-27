#!/usr/bin/env node
/* Bakes the alpine terrain's erosion-detail tile from a real eroded terrain (index1-5-alpine, 2026-10-23).
   Source: prototypes/highland-world-20261022/assets/hero-raw-1025.npy — the height field of
   "Snowy Mountain V2 - Terrain" by artfromheath (https://sketchfab.com/artfromheath),
   https://sketchfab.com/3d-models/snowy-mountain-v2-terrain-4c70cd82edd44951b7af6c144545df34,
   licensed CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/). The same terrain index1-4 is built from.
   What it writes (images/alpine/):
     erosion-height-512.png / -256.png  12-bit (R = high 8 bits, G = low 4 bits << 4), lossless; one tile = 900 world units at 1:1: the terrain's HIGH-PASS (its ridges, spurs and
       dendritic gullies, without its own macro shape), contrast-levelled so gentle and steep parts carry
       similar character, made seamless by a variance-preserving overlap cross-fade. q 2048 = 0, 256 = σ.
     erosion-normal-1024.webp  R,G = normal of a finer high-pass (for shading), B = that height.
   usage: node bake-erosion-detail.cjs */
'use strict';
const fs = require('fs'), path = require('path');
const sharp = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'prototypes/highland-world-20261022/assets/hero-raw-1025.npy');
const OUT = path.join(ROOT, 'images/alpine');
fs.mkdirSync(OUT, { recursive: true });

const buf = fs.readFileSync(SRC), hl = buf.readUInt16LE(8);
const N0 = 1025, raw = new Float32Array(buf.buffer.slice(buf.byteOffset + 10 + hl, buf.byteOffset + 10 + hl + N0 * N0 * 4));
const N = 1024, UNIT = 1200 / 1024;                // index1-4 scale: 1.17 world units per sample, heights × 68
const H = new Float64Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) H[y * N + x] = raw[y * N0 + x] * 68;

function boxBlur(src, r, wrap) {   // separable box, clamped (or wrapped) edges
  const t = new Float64Array(N * N), o = new Float64Array(N * N), at = (i) => wrap ? ((i % N) + N) % N : Math.max(0, Math.min(N - 1, i));
  for (let y = 0; y < N; y++) { let s = 0; for (let k = -r; k <= r; k++) s += src[y * N + at(k)]; for (let x = 0; x < N; x++) { t[y * N + x] = s / (2 * r + 1); s += src[y * N + at(x + r + 1)] - src[y * N + at(x - r)]; } }
  for (let x = 0; x < N; x++) { let s = 0; for (let k = -r; k <= r; k++) s += t[at(k) * N + x]; for (let y = 0; y < N; y++) { o[y * N + x] = s / (2 * r + 1); s += t[at(y + r + 1) * N + x] - t[at(y - r) * N + x]; } }
  return o;
}
const gauss = (src, sigmaUnits, wrap = false) => { const r = Math.max(1, Math.round(sigmaUnits / UNIT * Math.sqrt(12 / 3 + 1) / 2)); return boxBlur(boxBlur(boxBlur(src, r, wrap), r, wrap), r, wrap); };

function detail(sigma, levelSigma) {
  const low = gauss(H, sigma), hp = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) hp[i] = H[i] - low[i];
  const sq = new Float64Array(N * N); for (let i = 0; i < N * N; i++) sq[i] = hp[i] * hp[i];
  const v = gauss(sq, levelSigma);
  let g = 0; for (let i = 0; i < N * N; i++) g += v[i]; g = Math.sqrt(g / (N * N));
  // Partial contrast levelling: std^0.65, never amplifying the flattest ground more than 2.5x.
  for (let i = 0; i < N * N; i++) { const s = Math.sqrt(v[i]); hp[i] = hp[i] / Math.pow(Math.max(s, g * .4) / g, .65) / g; }
  // Seamless: the tile is the first TS samples; its last band of width M is cross-faded (variance kept)
  // into the samples just beyond it, which continue the first ones — so the right edge runs on into the
  // left one without repeating any feature (an offset blend repeats at half the period).
  const TS = 768, M = 256, T = new Float64Array(TS * TS), tmp = new Float64Array(TS * N);
  const fade = t => { const u = t * t * (3 - 2 * t); return [u, 1 - u]; };
  for (let y = 0; y < N; y++) for (let x = 0; x < TS; x++) {
    if (x >= M) { tmp[y * TS + x] = hp[y * N + x]; continue; }
    const [a, b] = fade(x / M); tmp[y * TS + x] = (a * hp[y * N + x] + b * hp[y * N + x + TS]) / Math.sqrt(a * a + b * b);
  }
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    if (y >= M) { T[y * TS + x] = tmp[y * TS + x]; continue; }
    const [a, b] = fade(y / M); T[y * TS + x] = (a * tmp[y * TS + x] + b * tmp[(y + TS) * TS + x]) / Math.sqrt(a * a + b * b);
  }
  T.size = TS;
  return T;
}
function down(src, size) {   // area-ish resample of a TS² periodic tile to size² (bilinear of a pre-blurred copy)
  const TS = src.size, f = TS / size, o = new Float64Array(size * size), at = (x, y) => src[(((y % TS) + TS) % TS) * TS + (((x % TS) + TS) % TS)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let s = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const sx = (x + .5) * f - .5 + i * f * .4, sy = (y + .5) * f - .5 + j * f * .4, ix = Math.floor(sx), iy = Math.floor(sy), tx = sx - ix, ty = sy - iy;
      s += (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty; n++;
    }
    o[y * size + x] = s / n;
  }
  return o;
}
(async () => {
  const D = detail(95, 160);          // ridges, spurs, gullies up to ~300 units
  let mn = 0, sd = 0; for (const v of D) mn += v; mn /= D.length; for (const v of D) sd += (v - mn) ** 2; sd = Math.sqrt(sd / D.length);
  console.log('detail mean', mn.toFixed(3), 'std', sd.toFixed(3));
  for (const size of [512, 256]) {
    // 12-bit fixed point (an 8-bit tile terraces into contour lines): q = 2048 + 256·(d/σ);
    // R = q >> 4, G = (q & 15) << 4, B = 0.
    const d = down(D, size), px = Buffer.alloc(size * size * 3);
    let clip = 0; for (let i = 0; i < d.length; i++) { let q = Math.round(2048 + (d[i] - mn) / sd * 256); if (q < 0 || q > 4095) clip++; q = Math.max(0, Math.min(4095, q)); px[i * 3] = q >> 4; px[i * 3 + 1] = (q & 15) << 4; }
    const f = path.join(OUT, `erosion-height-${size}.png`);
    await sharp(px, { raw: { width: size, height: size, channels: 3 } }).png({ compressionLevel: 9, palette: false }).toFile(f);
    console.log(f, fs.statSync(f).size, 'bytes, clipped', clip);
  }
  // Shading tile: a finer high-pass (gullies 5-120 units), as a normal map.
  const F = down(detail(40, 90), N), px = Buffer.alloc(N * N * 3);
  let fs2 = 0; for (const v of F) fs2 += v * v; fs2 = Math.sqrt(fs2 / F.length);
  const k = 1.9;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, xr = y * N + (x + 1) % N, xl = y * N + (x + N - 1) % N, yd = ((y + 1) % N) * N + x, yu = ((y + N - 1) % N) * N + x;
    const dx = (F[xr] - F[xl]) * .5 * k, dy = (F[yd] - F[yu]) * .5 * k, len = Math.hypot(dx, dy, 1);
    px[i * 3] = Math.round((-dx / len * .5 + .5) * 255); px[i * 3 + 1] = Math.round((-dy / len * .5 + .5) * 255);
    px[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(128 + F[i] / fs2 * 40)));
  }
  const f = path.join(OUT, 'erosion-normal-1024.webp');
  await sharp(px, { raw: { width: N, height: N, channels: 3 } }).webp({ quality: 84, effort: 6 }).toFile(f);
  console.log(f, fs.statSync(f).size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
