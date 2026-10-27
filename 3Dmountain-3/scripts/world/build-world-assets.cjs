// Builds the web textures of the world epilogue (js/finnovation-world.js) into images/world/.
//   node scripts/world/build-world-assets.cjs
// Needs Playwright (set PLAYWRIGHT_CORE to its folder if it is not resolvable) and a local Chrome (CHROME).
// Sources (both kept in _archive/, licences beside them):
//   earth  _archive/models/earth_B/textures/Surface.mat_baseColor.jpeg  8192x4096, "Earth" by Alan Zimmerman, CC-BY-4.0
//   ocean  images/bg.jpg                                                3334x1988, the project's own photograph
// Outputs:
//   earth-2k.jpg                  the whole planet as one grey "tone" channel: oceans low, land high, ice near white.
//                                 The globe shader maps it onto its palette, so the colours live in code, not here.
//                                 The archive stores the map upside down (glTF convention); it is flipped upright here.
//   earth-asia.jpg / -m.jpg       the part the camera actually looks at (ROI below) at the source's full 22.75 px/deg
//                                 (half that for phones): crisp coastlines without shipping an 8K map.
//                                 ROI must match EARTH_ROI in js/finnovation-world.js.
//   clouds-2k.jpg                 procedural cloud cover, sampled on the sphere so it has no seam and no pole pinch
//   ocean-2400.jpg / ocean-1280.jpg  the photograph, resized; it is graded in the shader
const path = require('node:path'), fs = require('node:fs');
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
let chromium; try { ({ chromium } = require(PW)); } catch { ({ chromium } = require('playwright')); }
const root = path.resolve(__dirname, '..', '..');
const out = path.join(root, 'images', 'world');
const ORIGIN = 'https://world-assets.local/';
const SOURCES = {
  'earth.jpg': path.join(root, '_archive/models/earth_B/textures/Surface.mat_baseColor.jpeg'),
  'ocean.jpg': path.join(root, 'images/bg.jpg')
};
const ROI = { lon0: 40, lon1: 180, lat0: -50, lat1: 62 };
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage();
    // Same-origin images keep the canvases readable (file:// would taint them).
    await page.route(ORIGIN + '**', route => {
      const name = route.request().url().slice(ORIGIN.length);
      if (SOURCES[name]) return route.fulfill({ path: SOURCES[name], contentType: 'image/jpeg' });
      return route.fulfill({ body: '<!doctype html><title>assets</title>', contentType: 'text/html' });
    });
    await page.goto(ORIGIN);
    const save = (name, dataUrl) => { const buf = Buffer.from(dataUrl.split(',')[1], 'base64'); fs.writeFileSync(path.join(out, name), buf); console.log(name.padEnd(16), (buf.length / 1024).toFixed(0).padStart(5), 'KB'); };

    // ---- earth: flip upright, grade to one tone channel at full size, then the whole map and the region ----
    const earth = await page.evaluate(async ROI => {
      const img = new Image(); img.src = 'earth.jpg'; await img.decode();
      const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
      g.translate(0, H); g.scale(1, -1); g.drawImage(img, 0, 0, W, H); g.setTransform(1, 0, 0, 1, 0, 0);
      const id = g.getImageData(0, 0, W, H), d = id.data;
      const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, gr = d[i + 1] / 255, b = d[i + 2] / 255;
        const lum = .2126 * r + .7152 * gr + .0722 * b;
        // Water is the only surface where blue leads both other channels by a clear share, even when
        // it is nearly black (deep ocean is ~[1,7,23]); ice, snow and haze are grey, land is warm.
        const water = sm(.12, .3, (b - Math.max(r, gr)) / (b + .02));
        const sea = .07 + .14 * Math.pow(Math.min(1, lum / .6), 1.1);
        const land = .38 + .56 * Math.pow(lum, .9);
        const v = Math.round(255 * Math.min(1, land + (sea - land) * water));
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      g.putImageData(id, 0, 0);
      const draw = (w, h, sx = 0, sy = 0, sw = W, sh = H) => { const o = document.createElement('canvas'); o.width = w; o.height = h; const x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, sx, sy, sw, sh, 0, 0, w, h); return o.toDataURL('image/jpeg', .87); };
      const sx = (ROI.lon0 + 180) / 360 * W, sw = (ROI.lon1 - ROI.lon0) / 360 * W, sy = (90 - ROI.lat1) / 180 * H, sh = (ROI.lat1 - ROI.lat0) / 180 * H;
      return { world: draw(2048, 1024), roi: draw(Math.round(sw), Math.round(sh), sx, sy, sw, sh), roiSmall: draw(Math.round(sw / 2), Math.round(sh / 2), sx, sy, sw, sh) };
    }, ROI);
    save('earth-2k.jpg', earth.world); save('earth-asia.jpg', earth.roi); save('earth-asia-m.jpg', earth.roiSmall);

    // ---- clouds: domain-warped 3D noise on the unit sphere ----
    const clouds = await page.evaluate(() => {
      const W = 2048, H = 1024;
      const perm = new Uint8Array(512); { let s = 1337; const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
      const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t;
      const grad = (h, x, y, z) => { const u = (h & 15) < 8 ? x : y, v = (h & 15) < 4 ? y : ((h & 15) === 12 || (h & 15) === 14) ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
      const noise = (x, y, z) => {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
        const u = fade(x), v = fade(y), w = fade(z), A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
        return lerp(lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u), lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
          lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u), lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v), w);
      };
      const fbm = (x, y, z, oct) => { let a = .5, f = 1, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * noise(x * f, y * f, z * f); n += a; a *= .5; f *= 2.03; } return s / n; };
      const ridged = (x, y, z, oct) => { let a = .5, f = 1, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * (1 - Math.abs(noise(x * f, y * f, z * f))); n += a; a *= .5; f *= 2.07; } return s / n; };
      const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      const id = g.createImageData(W, H), d = id.data;
      for (let j = 0; j < H; j++) {
        const lat = (.5 - (j + .5) / H) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat), al = Math.abs(lat);
        // storm tracks near 55 deg, the equatorial band, dry subtropics near 25 deg
        const band = .16 * Math.exp(-(((al - .95) / .26) ** 2)) + .1 * Math.exp(-((lat / .1) ** 2)) - .12 * Math.exp(-(((al - .44) / .13) ** 2));
        for (let i = 0; i < W; i++) {
          const lon = ((i + .5) / W) * 2 * Math.PI - Math.PI, x = cl * Math.cos(lon), z = -cl * Math.sin(lon);
          // Gentle warp (no marbling), latitude squeezed so systems run east-west, a ridged
          // fine layer for the fibrous edges; the soft high end leaves thin cloud see-through.
          const qx = x * 1.4, qy = y * 1.4, qz = z * 1.4;
          const wx = fbm(qx + 11.3, qy, qz, 3), wy = fbm(qx, qy + 27.1, qz, 3), wz = fbm(qx, qy, qz + 41.7, 3);
          const n = fbm(x * 2.6 + wx * .8, y * 4.94 + wy * .8, z * 2.6 + wz * .8, 6);
          const fine = ridged(x * 22 + wx * 2, y * 30.8 + wy * 2, z * 22 + wz * 2, 4) - .62;
          let v = sm(-.12, .42, n + band + fine * .35 + .02);
          v = Math.pow(v, 1.9);
          const cirrus = sm(.14, .44, fbm(x * 6 + wz * 1.5, y * 2.5, z * 6 + wx * 1.5, 4)) * .1;
          v = Math.min(1, v + cirrus * (1 - v));
          const o = (j * W + i) * 4; d[o] = d[o + 1] = d[o + 2] = Math.round(v * 255); d[o + 3] = 255;
        }
      }
      g.putImageData(id, 0, 0);
      return c.toDataURL('image/jpeg', .84);
    });
    save('clouds-2k.jpg', clouds);

    // ---- ocean photograph: two widths ----
    const ocean = await page.evaluate(async () => {
      const img = new Image(); img.src = 'ocean.jpg'; await img.decode();
      const size = w => { const h = Math.round(img.height * w / img.width), c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h); return c.toDataURL('image/jpeg', .8); };
      return { big: size(2400), small: size(1280) };
    });
    save('ocean-2400.jpg', ocean.big); save('ocean-1280.jpg', ocean.small);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
