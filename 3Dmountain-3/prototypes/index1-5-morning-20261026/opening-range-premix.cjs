/* index1-5 · dev tool (not run by build.cjs): turns an OWN-MADE range atlas into the form the room shader expects (2026-10-25).
   The atlas is the same layout as opening-range-make.cjs bakes: colour rows 0 … .484375·H (then its last row repeated), mask rows from .515625·H
   (its first row repeated before them), one OPAQUE RGB webp (a real alpha channel makes the browser drop the colour of the clear texels on the way
   to the GPU). The shader composites  rc = colour + (sky − haze)·(1 − alpha)  in linear light, exact only when every clear or half-clear texel of the
   colour half is ALREADY mixed toward the valley haze #cbd8e6:  colour' = haze + (colour − haze)·alpha. Steps, in this order:
     1. --refine[=d0,d1,sigma]   tighten the mask to the real mountain. A hand-made or generated mask is often a little larger than the peaks (here
                                 ~20 texels above the summit): the margin carries the picture's own sky colour and shows as a pale outline over the room's
                                 darker sky. The sky behind each pixel is estimated from the clear area round it (blur of the clear texels), and
                                 alpha' = alpha · smoothstep(d0, d1, colour distance to that sky).  Defaults 7, 24, 26.
     2. --decontaminate=R        inside a band of about R texels along the (refined) silhouette, replace the colour by the colour of the mountain just
                                 inside it (the generator fades mist and snow into the sky at the rim).
     3. the haze mix above, and the refined mask written back to the mask half.
   usage: node opening-range-premix.cjs <raw-atlas.webp> [out.webp] [--refine] [--decontaminate=R] [--check]
          (default out: assets/opening-range.webp — keep the raw file elsewhere!)   --check only prints how far the clear texels are from the haze. */
const path = require('path');
const sharp = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const argv = process.argv.slice(2), args = argv.filter(a => !a.startsWith('--')), flag = n => argv.find(a => a === '--' + n || a.startsWith('--' + n + '='));
const check = !!flag('check'), refine = flag('refine'), decArg = flag('decontaminate'), styleArg = flag('style');
const src = args[0];
if (!src) { console.error('usage: node opening-range-premix.cjs <raw-atlas.webp> [out.webp] [--refine] [--decontaminate=R] [--check]'); process.exit(1); }
const OUT = args[1] || path.join(__dirname, 'assets', 'opening-range.webp');
const HAZE = [203, 216, 230];
const S = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const num = (f, i, d) => { const v = f && f.includes('=') ? f.split('=')[1].split(',')[i] : undefined; return v !== undefined && v !== '' && Number.isFinite(+v) ? +v : d; };
(async () => {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const ch = Math.round(.484375 * H), off = Math.round(.515625 * H), n = W * ch;       // colour rows 0..ch-1, mask rows off..off+ch-1
  const col = Buffer.alloc(n * 3), a = new Float32Array(n);
  for (let y = 0; y < ch; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, mi = (Math.min(H - 1, off + y) * W + x) * 3;
    col[i * 3] = data[i * 3]; col[i * 3 + 1] = data[i * 3 + 1]; col[i * 3 + 2] = data[i * 3 + 2];
    a[i] = data[mi] / 255;
  }
  const stats = label => {
    let clear = 0, d = [0, 0, 0], mx = 0;
    for (let i = 0; i < n; i++) if (a[i] < .03) { clear++; for (let c = 0; c < 3; c++) { const v = col[i * 3 + c] - HAZE[c]; d[c] += v; mx = Math.max(mx, Math.abs(v)); } }
    console.log(`${label}: ${clear} clear texels (alpha < 3%), mean offset from the haze ${d.map(v => (v / clear).toFixed(1)).join(', ')}, largest ${mx}`);
  };
  stats('input');
  if (check) return;
  /* a one-channel image comes back from sharp with 3 channels: take one, and check the size */
  const blur = async (buf, channels, sigma) => {
    let img = sharp(buf, { raw: { width: W, height: ch, channels } }).blur(sigma);
    if (channels === 1) img = img.extractChannel(0);
    const out = await img.raw().toBuffer();
    if (out.length !== n * channels) throw new Error('blur returned ' + out.length / n + ' channels, expected ' + channels);
    return out;
  };

  if (refine) {
    const d0 = num(refine, 0, 7), d1 = num(refine, 1, 24), sigma = num(refine, 2, 26);
    const clearRgb = Buffer.alloc(n * 3), clearW = Buffer.alloc(n);
    for (let i = 0; i < n; i++) { const w = a[i] < .02 ? 255 : 0; clearW[i] = w; if (w) { clearRgb[i * 3] = col[i * 3]; clearRgb[i * 3 + 1] = col[i * 3 + 1]; clearRgb[i * 3 + 2] = col[i * 3 + 2]; } }
    const [bRgb, bW] = await Promise.all([blur(clearRgb, 3, sigma), blur(clearW, 1, sigma)]);
    let cut = 0;
    for (let i = 0; i < n; i++) {
      if (a[i] <= 0) continue;
      const p = bW[i] / 255;
      if (p < .05) continue;                          // too far from any clear sky to estimate it: keep the mask as it is
      let dist = 0;
      for (let c = 0; c < 3; c++) dist = Math.max(dist, Math.abs(col[i * 3 + c] - bRgb[i * 3 + c] / p));
      const keep = S(d0, d1, dist), a2 = a[i] * keep;
      if (a2 < a[i] - .02) cut++;
      a[i] = a2;
    }
    console.log(`refine ${d0},${d1},${sigma}: ${cut} texels of the margin turned (more) transparent`);
  }

  if (decArg) {
    const R = Math.max(1, num(decArg, 0, 8)), inRgb = Buffer.alloc(n * 3), inW = Buffer.alloc(n);
    for (let i = 0; i < n; i++) { const w = a[i] > .98 ? 255 : 0; inW[i] = w; if (w) { inRgb[i * 3] = col[i * 3]; inRgb[i * 3 + 1] = col[i * 3 + 1]; inRgb[i * 3 + 2] = col[i * 3 + 2]; } }
    const sigma = Math.max(.5, R * .6), [bRgb, bW] = await Promise.all([blur(inRgb, 3, sigma), blur(inW, 1, sigma)]);
    let changed = 0;
    for (let i = 0; i < n; i++) {
      const p = bW[i] / 255;
      if (p < .06 || p > .93 || a[i] <= 0) continue;
      const keep = S(0, 1, Math.min(1, Math.max(0, (p - .5) / .4)));
      if (keep > .995) continue;
      for (let c = 0; c < 3; c++) { const fill = bRgb[i * 3 + c] / p; col[i * 3 + c] = Math.max(0, Math.min(255, Math.round(fill + (col[i * 3 + c] - fill) * keep))); }
      changed++;
    }
    console.log(`decontaminate ${R}: ${changed} rim texels re-coloured from the mountain just inside`);
  }

  if (styleArg) {
    /* --style=valley[,strength]: the colours of the valley render (the CONFLUENCE screen, 2026-10-25 client: 「比較像這風格 跟顏色」). Measured on that screenshot:
       shadows a cool dark navy-grey (#17202f–#3a3d43), lit rock a muted warm brown (#4f433a → #99856f), moss a greyed olive (#4c4c38 → #918b65), mist a
       warm white (#dedad7). The mountain is re-coloured by a gradient map on its own luminance (so every light and shadow of the picture stays), mist and snow
       keep part of their original cool white, and moss grows on the lower slopes of each peak (depth below its own silhouette), patchy by noise. */
    const strength = num(styleArg, 1, .85), chroma = num(styleArg, 2, 1.5), darken = num(styleArg, 3, .9);   // chroma: colour pushed away from grey; darken: lit rock and shadow brought down
    const ROCK = [[0, [10, 15, 24]], [.14, [23, 32, 47]], [.24, [39, 47, 57]], [.34, [62, 60, 60]], [.46, [96, 84, 72]], [.58, [126, 110, 92]], [.70, [153, 133, 111]], [.80, [196, 184, 170]], [.92, [222, 218, 215]], [1, [240, 238, 235]]];
    const MOSS = [[0, [40, 42, 30]], [.25, [76, 76, 56]], [.40, [97, 94, 67]], [.55, [117, 115, 85]], [.70, [145, 139, 101]], [1, [170, 165, 130]]];
    const ramp = (stops, t) => { for (let k = 1; k < stops.length; k++) if (t <= stops[k][0]) { const [t0, c0] = stops[k - 1], [t1, c1] = stops[k], u = (t - t0) / (t1 - t0); return [c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u, c0[2] + (c1[2] - c0[2]) * u]; } return stops[stops.length - 1][1]; };
    const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    const vnoise = (x, y, s) => { const gx = x / s, gy = y / s, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      return (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) + (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v; };
    const yTop = new Int32Array(W).fill(ch);
    for (let x = 0; x < W; x++) for (let y = 0; y < ch; y++) if (a[y * W + x] > .5) { yTop[x] = y; break; }
    for (let y = 0; y < ch; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (a[i] <= .01) continue;
      const r = col[i * 3], g = col[i * 3 + 1], b = col[i * 3 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const L = Math.pow(Math.max(0, (.3 * r + .59 * g + .11 * b) / 255 - .04) / .96, 1.08), sat = mx ? (mx - mn) / mx : 0;
      const mist = S(.6, .85, L) * (1 - S(.10, .26, sat));             // bright and nearly colourless: snow, cloud, haze
      const rock = ramp(ROCK, L), amt = strength * (1 - .4 * mist);
      let o = [r + (rock[0] - r) * amt, g + (rock[1] - g) * amt, b + (rock[2] - b) * amt];
      { const lum = .3 * o[0] + .59 * o[1] + .11 * o[2], k = 1 + (chroma - 1) * (1 - mist), dk = 1 - (1 - darken) * (1 - mist); o = o.map(v => (lum + (v - lum) * k) * dk); }   // not the mist
      const depth = (y - yTop[x]) / ch;                                // how far below the top of its own peak
      const n = .6 * vnoise(x, y, 70) + .4 * vnoise(x + 977, y + 311, 24);
      const moss = S(.10, .42, depth) * (1 - S(.58, .80, L)) * S(.32, .62, n) * .7 * strength;
      if (moss > .004) { const m = ramp(MOSS, L); o = [o[0] + (m[0] - o[0]) * moss, o[1] + (m[1] - o[1]) * moss, o[2] + (m[2] - o[2]) * moss]; }
      for (let c = 0; c < 3; c++) col[i * 3 + c] = Math.max(0, Math.min(255, Math.round(o[c])));
    }
    console.log(`style valley (strength ${strength}): mountain re-coloured`);
  }

  // premix toward the haze, then lay the atlas out again
  const IMG = Buffer.alloc(W * H * 3), guard = Math.round(.5 * H);
  const colourRow = y => Math.min(y, ch - 1);
  for (let y = 0; y < off; y++) {
    const r = y < guard ? colourRow(y) : -1;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      if (r >= 0) { const i = r * W + x; for (let c = 0; c < 3; c++) IMG[o + c] = Math.round(HAZE[c] + (col[i * 3 + c] - HAZE[c]) * a[i]); }
      else { const v = Math.round(255 * a[x]); IMG[o] = IMG[o + 1] = IMG[o + 2] = v; }   // guard rows above the mask: its first row repeated
    }
  }
  for (let y = off; y < H; y++) for (let x = 0; x < W; x++) { const v = Math.round(255 * a[Math.min(ch - 1, y - off) * W + x]), o = (y * W + x) * 3; IMG[o] = IMG[o + 1] = IMG[o + 2] = v; }
  await sharp(IMG, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 92 }).toFile(OUT);
  console.log(`atlas ${W}×${H}: colour rows 0–${ch - 1}, mask rows ${off}–${H - 1}\nwrote ${OUT}`);
})();
