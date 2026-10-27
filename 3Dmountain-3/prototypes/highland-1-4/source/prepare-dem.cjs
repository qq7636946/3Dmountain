/* Independent public DEM preparation. Run: node prototypes/highland-1-4/source/prepare-dem.cjs
   Source imagery and processed height maps from third-party reference websites are not used. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const SOURCE = __dirname;
const TILE_DIR = path.join(SOURCE, 'everest-tiles');
const ASSETS = path.resolve(SOURCE, '../assets');
const ZOOM = 13, TILE_SIZE = 256, WORLD = TILE_SIZE * 2 ** ZOOM;
const CROP = { x: 1554310, y: 878324, width: 872, height: 758 };
const BASE_URL = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium';
const DATASET_URL = 'https://registry.opendata.aws/terrain-tiles/';
const FORMAT_URL = 'https://github.com/tilezen/joerd/blob/master/docs/formats.md';
const ATTRIBUTION_URL = 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md';
const geo = (x, y) => ({ lon: x / WORLD * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / WORLD))) * 180 / Math.PI });
const bounds = { west: geo(CROP.x, CROP.y).lon, east: geo(CROP.x + CROP.width - 1, CROP.y).lon, north: geo(CROP.x, CROP.y).lat, south: geo(CROP.x, CROP.y + CROP.height - 1).lat };
const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
function decodePNG(bytes) {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw Error('Invalid PNG signature');
  let width, height, channels, palette = null;
  const chunks = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8), data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })[data[9]];
      if (data[8] !== 8 || !channels || data[10] || data[11] || data[12]) throw Error('PNG requires non-interlaced 8-bit standard compression');
    } else if (type === 'IDAT') chunks.push(data);
    else if (type === 'PLTE') palette = data;
    else if (type === 'IEND') break;
    offset += length + 12;
  }
  if (width !== TILE_SIZE || height !== TILE_SIZE) throw Error('Unexpected tile dimensions');
  const stride = width * channels, packed = zlib.inflateSync(Buffer.concat(chunks)), pixels = Buffer.alloc(width * height * 3);
  if (packed.length !== (stride + 1) * height) throw Error('Invalid PNG scanline length');
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = packed[y * (stride + 1)], row = Buffer.from(packed.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    if (filter > 4) throw Error('Unknown PNG filter');
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? row[i - channels] : 0, b = previous[i], c = i >= channels ? previous[i - channels] : 0;
      row[i] = (row[i] + (filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0)) & 255;
    }
    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 3, i = x * channels;
      if (palette) { const p = row[i] * 3; pixels[target] = palette[p]; pixels[target + 1] = palette[p + 1]; pixels[target + 2] = palette[p + 2]; }
      else if (channels >= 3) { pixels[target] = row[i]; pixels[target + 1] = row[i + 1]; pixels[target + 2] = row[i + 2]; }
      else pixels.fill(row[i], target, target + 3);
    }
    previous = row;
  }
  return pixels;
}
async function getTile(x, y) {
  const file = path.join(TILE_DIR, `${ZOOM}-${x}-${y}.png`), url = `${BASE_URL}/${ZOOM}/${x}/${y}.png`;
  if (!fs.existsSync(file)) {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw Error(`${response.status} ${url}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        decodePNG(bytes);
        fs.writeFileSync(file, bytes);
        break;
      } catch (error) { if (attempt >= 2) throw error; }
    }
  }
  return { x, y, pixels: decodePNG(fs.readFileSync(file)), url, file: path.relative(SOURCE, file).replaceAll('\\', '/') };
}
function describe(values) {
  let min = Infinity, max = -Infinity, sum = 0;
  for (const value of values) { const m = value / 4; if (!Number.isFinite(m) || m < 0 || m > 16383.75) throw Error('Invalid quarter-metre height'); min = Math.min(min, m); max = Math.max(max, m); sum += m; }
  if (min < 3000 || max < 8000 || max > 9500) throw Error(`Unexpected Everest range ${min}..${max}`);
  return { minMetres: min, maxMetres: max, meanMetres: sum / values.length, finiteSamples: values.length };
}
function writeGrid(file, values, width, height) {
  const binary = Buffer.alloc(values.length * 2);
  for (let i = 0; i < values.length; i++) binary.writeUInt16LE(values[i], i * 2);
  const compressed = zlib.gzipSync(binary, { level: 9 });
  if (!zlib.gunzipSync(compressed).equals(binary)) throw Error('Gzip roundtrip failed');
  fs.writeFileSync(path.join(ASSETS, file), compressed);
  return { file, width, height, rawBytes: binary.length, compressedBytes: compressed.length, ...describe(values) };
}
async function main() {
  fs.mkdirSync(TILE_DIR, { recursive: true }); fs.mkdirSync(ASSETS, { recursive: true });
  const jobs = [];
  for (let y = Math.floor(CROP.y / TILE_SIZE); y <= Math.floor((CROP.y + CROP.height - 1) / TILE_SIZE); y++) for (let x = Math.floor(CROP.x / TILE_SIZE); x <= Math.floor((CROP.x + CROP.width - 1) / TILE_SIZE); x++) jobs.push([x, y]);
  const tiles = new Map(), records = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (cursor < jobs.length) { const [x, y] = jobs[cursor++], tile = await getTile(x, y); tiles.set(`${x},${y}`, tile.pixels); records.push({ x, y, url: tile.url, file: tile.file }); } }));
  const grid = new Uint16Array(CROP.width * CROP.height);
  for (let y = 0; y < CROP.height; y++) for (let x = 0; x < CROP.width; x++) {
    const gx = CROP.x + x, gy = CROP.y + y, rgb = tiles.get(`${Math.floor(gx / TILE_SIZE)},${Math.floor(gy / TILE_SIZE)}`), i = ((gy % TILE_SIZE) * TILE_SIZE + gx % TILE_SIZE) * 3;
    const metres = rgb[i] * 256 + rgb[i + 1] + rgb[i + 2] / 256 - 32768;
    if (!Number.isFinite(metres) || metres < 0 || metres > 16383.75) throw Error('Terrain height outside Uint16 quarter-metre range');
    grid[y * CROP.width + x] = Math.round(metres * 4);
  }
  const liteWidth = 436, liteHeight = 379, lite = new Uint16Array(liteWidth * liteHeight);
  for (let y = 0; y < liteHeight; y++) for (let x = 0; x < liteWidth; x++) lite[y * liteWidth + x] = grid[Math.round(y * (CROP.height - 1) / (liteHeight - 1)) * CROP.width + Math.round(x * (CROP.width - 1) / (liteWidth - 1))];
  const full = writeGrid('everest-dem.bin.gz', grid, CROP.width, CROP.height), phone = writeGrid('everest-dem-lite.bin.gz', lite, liteWidth, liteHeight);
  const metadata = { version: 1, description: 'Independent Everest elevation crop from public Mapzen Terrain Tiles; contains numerical terrain data only.', bounds, mercator: { zoom: ZOOM, worldPixels: WORLD, crop: CROP, metresPerPixelAt27_85N: 156543.03392 * Math.cos(27.85 * Math.PI / 180) / 2 ** ZOOM }, encoding: { compression: 'gzip', sampleType: 'uint16', byteOrder: 'little-endian', order: 'row-major, west-to-east columns and north-to-south rows', decoder: 'metres = uint16le / 4', verticalUnits: 'metres', verticalExaggeration: 1, quantizationMetres: 0.25, sourceDecoder: 'metres = red * 256 + green + blue / 256 - 32768' }, full, lite: { ...phone, resampling: 'nearest source sample on an endpoint-preserving 436 x 379 grid; shares full bounds' }, source: { dataset: DATASET_URL, format: FORMAT_URL, attribution: ATTRIBUTION_URL, attributionText: 'Mapzen Terrain Tiles. SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey.', bucket: 's3://elevation-tiles-prod/terrarium/', tiles: records.sort((a, b) => a.y - b.y || a.x - b.x) } };
  fs.writeFileSync(path.join(ASSETS, 'everest-dem.json'), JSON.stringify(metadata, null, 2) + '\n');
  console.log(JSON.stringify({ bounds, full, lite: metadata.lite, tiles: records.length }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
