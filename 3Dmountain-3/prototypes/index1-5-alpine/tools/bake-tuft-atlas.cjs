#!/usr/bin/env node
/* Bakes the canyon grass-tuft atlas (index1-5, 2026-10-24): images/alpine/tuft-atlas.webp, 512 x 256, RGBA.
   Four tuft variants side by side (128 x 256 each), every one a clump of 26-44 tapered, curved blades drawn
   back to front and supersampled 4x. Channels (data, not colour — the shader tints them):
     R  blade shading: per-blade value, darker toward the base, a lit midrib, back blades darker
     G  per-blade dryness 0..1 (the shader's 草叢顏色（乾/綠） dial turns blades dry below its value)
     B  ambient occlusion: dark at the root and inside the clump
     A  coverage (alpha-tested in the shader)
   Deterministic (seeded). usage: node bake-tuft-atlas.cjs */
'use strict';
const path = require('path'), fs = require('fs');
const sharp = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const OUT = path.resolve(__dirname, '../../../images/alpine/tuft-atlas.webp');
let seed = 20261024;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += rnd(); return (s - 2) / .58; };
const SS = 4, CW = 128, CH = 256, W = CW * 4 * SS, H = CH * SS;
const R = new Float32Array(W * H), G = new Float32Array(W * H), B = new Float32Array(W * H), A = new Float32Array(W * H);
for (let v = 0; v < 4; v++) {
  const x0 = v * CW * SS, blades = [];
  const n = 26 + Math.floor(rnd() * 18), spread = [30, 38, 26, 44][v], tall = [.85, .7, .95, .6][v];
  for (let b = 0; b < n; b++) {
    const bx = 64 + gauss() * spread * .5;
    const centre = 1 - Math.min(1, Math.abs(bx - 64) / (spread * 1.3));
    blades.push({
      bx, depth: rnd(), h: (95 + 140 * (.45 + .55 * centre) * (.7 + .3 * rnd())) * tall,
      lean: (bx - 64) / 64 * (55 + 60 * rnd()) + (rnd() - .5) * 34, droop: (rnd() - .3) * 26,
      w: 2.6 + 2.6 * rnd(), val: .55 + .45 * rnd(), dry: rnd()
    });
  }
  blades.sort((a, b) => a.depth - b.depth);   // back to front
  for (const bl of blades) {
    const steps = Math.ceil(bl.h * SS * 1.5);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // centreline: rises, leans out quadratically, the tip droops
      const cx = bl.bx + bl.lean * t * t + bl.droop * Math.pow(t, 3);
      const cy = CH - 1 - bl.h * t * (1 - .12 * t * t * Math.abs(bl.droop) / 26);
      const half = Math.max(.35, bl.w * .5 * Math.pow(1 - t, .75));
      const px = (cx * SS) | 0, py = (cy * SS) | 0, r = half * SS;
      for (let yy = Math.floor(py - r); yy <= Math.ceil(py + r); yy++) {
        if (yy < 0 || yy >= H) continue;
        for (let xx = Math.floor(px - r); xx <= Math.ceil(px + r); xx++) {
          if (xx < 0 || xx >= CW * SS) continue;
          const dx = xx - px, dy = yy - py, d = Math.hypot(dx, dy);
          if (d > r) continue;
          const i = yy * W + x0 + xx, across = d / Math.max(r, 1e-3);
          const shade = bl.val * (.5 + .5 * Math.pow(t, .6)) * (1 - .25 * across * across) * (.75 + .25 * bl.depth);
          R[i] = shade; G[i] = bl.dry; A[i] = 1;
          B[i] = (.35 + .65 * Math.min(1, t / .45)) * (.7 + .3 * bl.depth);
        }
      }
    }
  }
}
// downsample 4x4 (premultiplied by coverage, so edge colour does not bleed black)
const w = CW * 4, h = CH, px = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  let a = 0, r = 0, g = 0, b = 0;
  for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) { const k = (y * SS + j) * W + x * SS + i; a += A[k]; r += R[k] * A[k]; g += G[k] * A[k]; b += B[k] * A[k]; }
  const o = (y * w + x) * 4, cov = a / (SS * SS);
  px[o] = Math.round(255 * (a ? r / a : .5)); px[o + 1] = Math.round(255 * (a ? g / a : .5)); px[o + 2] = Math.round(255 * (a ? b / a : .5)); px[o + 3] = Math.round(255 * cov);
}
// bleed the RGB of covered texels into the empty ones (mipmaps then never average toward grey)
for (let pass = 0; pass < 6; pass++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const o = (y * w + x) * 4; if (px[o + 3] > 0) continue;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const q = (yy * w + xx) * 4; if (px[q + 3] > 0) { px[o] = px[q]; px[o + 1] = px[q + 1]; px[o + 2] = px[q + 2]; px[o + 3] = 1; break; } }
}
for (let o = 3; o < px.length; o += 4) if (px[o] === 1) px[o] = 0;
sharp(px, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 88, alphaQuality: 92, effort: 6 }).toFile(OUT)
  .then(() => console.log(OUT, fs.statSync(OUT).size, 'bytes'));
