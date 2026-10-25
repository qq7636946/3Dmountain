/* index1-5 · dev tool (not run by build.cjs): bakes the opening's distant range band from a render of the valley itself.
   1. Capture a clean 2048×1280 frame of index1-5 at journey 10.6 (UI hidden), e.g. with Playwright.
   2. node prototypes/index1-5/opening-range-make.cjs <capture.png>
   Writes prototypes/index1-5/assets/opening-range.webp (2048×1024, colour above / alpha below): the peaks with the sky keyed out (alpha), the sun and
   its lens streak removed, edges and foot faded, and every partly transparent pixel pre-mixed toward the valley haze
   (#cbd8e6) so mip levels never bleed sky-blue fringes. opening-world.js samples it inside montisEnv(). */
const path = require('path');
const sharp = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const src = process.argv[2];
if (!src) { console.error('usage: node opening-range-make.cjs <2048x1280 capture at journey 10.6>'); process.exit(1); }
const OUT = path.join(__dirname, 'assets', 'opening-range.webp');
/* x ≥ 560 only: on the sun side the range dissolves in the glare anyway, and the frame's sun and halo stay out of the band. */
const CROP = { left: 560, top: 40, width: 1488, height: 520 }, SUN = [305 - 560, 180 - 40], HAZE = [203, 216, 230];
const S = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
(async () => {
  const { data, info } = await sharp(src).extract(CROP).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, out = Buffer.alloc(W * H * 4);
  // the lens streak: rows 132–152 (crop space) left of x 1150 are rebuilt from the rows just outside it
  const px = (x, y) => { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let [r, g, b] = px(x, y);
    if (x < 1150 - 560 && y >= 130 && y <= 154) { const t = (y - 130) / 24, a = px(x, 127), c = px(x, 157); r = a[0] + (c[0] - a[0]) * t; g = a[1] + (c[1] - a[1]) * t; b = a[2] + (c[2] - a[2]) * t; }
    const sky = S(28, 54, b - r);
    let alpha = 1 - sky;
    const ds = Math.hypot(x - SUN[0], y - SUN[1]), Y = .3 * r + .59 * g + .11 * b;
    alpha *= S(70, 190, ds);                                          // the sun
    alpha *= 1 - Math.max(S(14, 34, b - r), S(165, 195, Y)) * (1 - S(260, 440, ds)); // its halo: washed, bluish sky near the sun
    alpha *= S(0, W * .30, x) * S(0, W * .22, W - 1 - x);              // soft ends: long on the sun side (left), where glare eats the range
    alpha *= 1 - S(H * .80, H * .99, y);                                // the foot melts into the haze band
    const k = alpha;
    const o = (y * W + x) * 4;
    out[o] = Math.round(HAZE[0] + (r - HAZE[0]) * k); out[o + 1] = Math.round(HAZE[1] + (g - HAZE[1]) * k); out[o + 2] = Math.round(HAZE[2] + (b - HAZE[2]) * k);
    out[o + 3] = Math.round(255 * alpha);
  }
  /* One OPAQUE texture, two halves (an image with real alpha loses the colour of its clear texels on the way to the GPU):
     rows 0–495 the colour (pre-mixed toward the haze), 496–511 its last row repeated; rows 512–527 the first alpha row
     repeated, 528–1023 the alpha as grey. opening-world-build.cjs samples both halves (texture is linear, colour decoded
     in the shader). */
  const rgb = Buffer.alloc(W * H * 3), a = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) { rgb[i * 3] = out[i * 4]; rgb[i * 3 + 1] = out[i * 4 + 1]; rgb[i * 3 + 2] = out[i * 4 + 2]; a[i] = out[i * 4 + 3]; }
  const BW = 2048, BH = 496;
  const R = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).resize(BW, BH, { fit: 'fill' }).raw().toBuffer();
  const A = await sharp(a, { raw: { width: W, height: H, channels: 1 } }).resize(BW, BH, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  if (A.length !== BW * BH) throw new Error('alpha resize returned ' + A.length / (BW * BH) + ' channels');
  const IMG = Buffer.alloc(BW * 1024 * 3);
  const put = (row, x, r, g, b) => { const o = (row * BW + x) * 3; IMG[o] = r; IMG[o + 1] = g; IMG[o + 2] = b; };
  for (let row = 0; row < 512; row++) { const sr = Math.min(row, BH - 1); for (let x = 0; x < BW; x++) { const o = (sr * BW + x) * 3; put(row, x, R[o], R[o + 1], R[o + 2]); } }
  for (let row = 512; row < 1024; row++) { const sr = Math.max(0, row - 528); for (let x = 0; x < BW; x++) { const v = A[sr * BW + x]; put(row, x, v, v, v); } }
  await sharp(IMG, { raw: { width: BW, height: 1024, channels: 3 } }).webp({ quality: 92 }).toFile(OUT);
  console.log('wrote', OUT);
})();
