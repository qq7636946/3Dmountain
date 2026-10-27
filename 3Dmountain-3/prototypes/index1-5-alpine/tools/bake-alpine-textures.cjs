#!/usr/bin/env node
/* Bakes the alpine terrain's generated detail maps (index1-5-alpine, 2026-10-23).
   usage: node bake-alpine-textures.cjs [--sharp <path to sharp module>]
   Writes images/alpine/{rock,scree,snow}-<size>.webp: seamless (periodic) height fields turned into
   normal maps. Channels: R,G = surface normal x,y (0.5 = flat), B = height / cavity (0 = crevice).
     rock   fractured plates (two Voronoi generations with tilted fracture planes), crack grooves,
            a joint set and mineral grain                                   1024 (desktop), 512 (mobile)
     scree  angular stones and gravel, packed (talus, moraine, river gravel)   512
     snow   wind ripples and sastrugi, ripple crests across the +x wind      512
   Deterministic (seeded hash). No network, no paid service: sharp only encodes the WebP. */
'use strict';
const path = require('path'), fs = require('fs');
const argi = process.argv.indexOf('--sharp');
const sharp = require(argi > 0 ? process.argv[argi + 1] : 'C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const OUT = path.resolve(__dirname, '../../../images/alpine');
fs.mkdirSync(OUT, { recursive: true });

const fract = x => x - Math.floor(x);
const mod = (a, n) => ((a % n) + n) % n;
const hash = (x, y, s = 0) => fract(Math.sin(x * 127.1 + y * 311.7 + s * 74.7 + 13.13) * 43758.5453);
const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
// Periodic value noise with integer period `per` (cells per tile).
function pnoise(x, y, per, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash(mod(a, per), mod(b, per), s);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function pfbm(u, v, per, oct, s = 0, gain = .5) { let sum = 0, amp = 1, norm = 0, p = per; for (let o = 0; o < oct; o++) { sum += pnoise(u * p, v * p, p, s + o * 17) * amp; norm += amp; amp *= gain; p *= 2; } return sum / norm; }
// Periodic Voronoi: nearest / second distance, nearest cell id, vector to the nearest point.
function pvoronoi(u, v, per, s = 0, jitter = .85) {
  const x = u * per, y = v * per, ix = Math.floor(x), iy = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0, cx = 0, cy = 0;
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const gx = ix + i, gy = iy + j, wx = mod(gx, per), wy = mod(gy, per);
    const px = gx + .5 + (hash(wx, wy, s) - .5) * jitter, py = gy + .5 + (hash(wx, wy, s + 9) - .5) * jitter;
    const dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
    if (d < d1) { d2 = d1; d1 = d; id = wx * 7919 + wy; cx = dx; cy = dy; } else if (d < d2) d2 = d;
  }
  return { d1, d2, id, cx, cy };
}

function rockHeight(u, v) {
  // Domain warp (fractures are straight over a plate, not over the whole tile).
  const wu = u + (pfbm(u, v, 3, 2, 11) - .5) * .05, wv = v + (pfbm(u, v, 3, 2, 12) - .5) * .05;
  // Large fracture plates: each a tilted plane standing proud of or sunk below its neighbours
  // (ledges and steps), the joints between them only partly open.
  const A = pvoronoi(wu, wv, 5, 1, .95);
  const tA = hash(A.id, 3, 1) * 6.283, sA = .55 + .65 * hash(A.id, 5, 1);
  let h = (-A.cx * Math.cos(tA) - A.cy * Math.sin(tA)) * sA + hash(A.id, 7, 1) * .9;
  const openA = smooth(.45, .7, pfbm(u, v, 6, 2, 21));
  h -= (1 - smooth(0, .05, A.d2 - A.d1)) * .07 * openA;
  // Second generation: smaller spalled flakes on the plates, mostly tight.
  const B = pvoronoi(wu, wv, 13, 2, .9);
  const tB = hash(B.id, 3, 2) * 6.283, sB = .35 + .45 * hash(B.id, 5, 2);
  h += ((-B.cx * Math.cos(tB) - B.cy * Math.sin(tB)) * sB + hash(B.id, 7, 2) * .45) * .32 * smooth(.3, .7, pfbm(u, v, 5, 2, 23));
  h -= (1 - smooth(0, .04, B.d2 - B.d1)) * .025 * smooth(.5, .75, pfbm(u, v, 7, 2, 24));
  // A joint set: thin parallel fractures at an angle, broken by noise.
  const jw = pfbm(u, v, 8, 3, 30);
  const joint = Math.abs(Math.sin((u * 19 + v * 7 + jw * 3.2) * Math.PI));
  h -= (1 - smooth(0, .08, joint)) * .006 * smooth(.55, .8, pfbm(u, v, 4, 2, 41));
  // Mineral grain and pitting.
  h += (pfbm(u, v, 24, 4, 50) - .5) * .05 + (pfbm(u, v, 96, 2, 60) - .5) * .012;
  return h;
}
function screeHeight(u, v) {
  const A = pvoronoi(u, v, 14, 3, .9);
  const rA = .5 * (.55 + .45 * hash(A.id, 2, 3));
  const stone = Math.sqrt(Math.max(0, 1 - Math.pow(A.d1 / Math.max(.2, (A.d1 + A.d2) * .5), 2.2))) * (.6 + .6 * hash(A.id, 4, 3));
  const facet = (-A.cx * Math.cos(hash(A.id, 6, 3) * 6.28) - A.cy * Math.sin(hash(A.id, 6, 3) * 6.28)) * .35;
  let h = stone * (1 + facet) * (1 - (1 - smooth(0, .12, A.d2 - A.d1)) * .9) * rA * 2;
  const B = pvoronoi(u, v, 46, 4, .9);
  const pebble = Math.sqrt(Math.max(0, 1 - Math.pow(B.d1 / Math.max(.2, (B.d1 + B.d2) * .5), 2))) * (.4 + .6 * hash(B.id, 4, 4));
  h = Math.max(h, pebble * .38 + .05) + (pfbm(u, v, 128, 2, 70) - .5) * .06;
  return h;
}
function snowHeight(u, v) {
  // Wind along +x: ripple crests run along v, wander with a slow warp, and break into sastrugi.
  const warp = pfbm(u, v, 3, 3, 80) * 2.4 + pfbm(u, v, 9, 2, 85) * .5;
  const ripple = Math.sin((u * 22 + warp) * Math.PI * 2);
  const asym = ripple > 0 ? Math.pow(ripple, 1.5) : ripple * .55;      // steeper lee side
  const ripMask = .45 + .55 * smooth(.3, .7, pfbm(u, v, 4, 2, 90));
  const sastrugi = Math.pow(pfbm(u * 1, v * 1, 6, 3, 95), 2.2) * 1.6;
  const drift = pfbm(u, v, 2, 3, 99) * .9;
  return asym * .16 * ripMask + sastrugi * .35 + drift + (pfbm(u, v, 64, 2, 101) - .5) * .03;
}

async function bake(name, fn, size, strength, cavityGain) {
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = fn(x / size, y / size);
  let lo = Infinity, hi = -Infinity; for (const h of H) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
  const blur = new Float32Array(size * size), tmp = new Float32Array(size * size), r = Math.max(2, size >> 7);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { let s = 0; for (let t = -r; t <= r; t++) s += H[y * size + mod(x + t, size)]; tmp[y * size + x] = s / (2 * r + 1); }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { let s = 0; for (let t = -r; t <= r; t++) s += tmp[mod(y + t, size) * size + x]; blur[y * size + x] = s / (2 * r + 1); }
  // Strength: the median slope of the map is set to `strength` (tilt per texel is size-independent).
  const gs = []; for (let i = 0; i < size * size; i += 97) { const y = (i / size) | 0, x = i % size; gs.push(Math.hypot(H[y * size + mod(x + 1, size)] - H[y * size + mod(x - 1, size)], H[mod(y + 1, size) * size + x] - H[mod(y - 1, size) * size + x]) * .5); }
  gs.sort((a, b) => a - b);
  const px = Buffer.alloc(size * size * 3), k = strength / Math.max(1e-6, gs[gs.length >> 1]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const dx = (H[y * size + mod(x + 1, size)] - H[y * size + mod(x - 1, size)]) * .5 * k, dy = (H[mod(y + 1, size) * size + x] - H[mod(y - 1, size) * size + x]) * .5 * k;
    const len = Math.hypot(dx, dy, 1), nx = -dx / len, ny = -dy / len;
    const cav = Math.max(0, Math.min(1, .62 + (H[i] - blur[i]) / (hi - lo) * cavityGain + (H[i] - lo) / (hi - lo) * .25 - .12));
    px[i * 3] = Math.round((nx * .5 + .5) * 255); px[i * 3 + 1] = Math.round((ny * .5 + .5) * 255); px[i * 3 + 2] = Math.round(cav * 255);
  }
  const file = path.join(OUT, `${name}-${size}.webp`);
  await sharp(px, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 86, effort: 6 }).toFile(file);
  console.log(file, fs.statSync(file).size + ' bytes');
}

(async () => {
  await bake('rock', rockHeight, 1024, .42, 3.2);
  await bake('rock', rockHeight, 512, .42, 3.2);
  await bake('scree', screeHeight, 512, .5, 3.5);
  await bake('snow', snowHeight, 512, .16, 2.0);
})().catch(e => { console.error(e); process.exit(1); });
