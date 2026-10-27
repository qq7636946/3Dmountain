/* index1-4 · packs the height field for the browser (2026-10-22, client: 要壓縮並優化).
   source/world-height-{2049,1025}.u16 (1 cm steps, value/100 − 64) → assets/world-height-{2049,1025}.dz:
   5 cm steps, each value minus its left neighbour (first column: minus the one above), the int16 deltas
   split into a high-byte plane and a low-byte plane, gzip -9. Decoded in highland-scene.js loadField().
   5 cm is far below the 2.34-unit grid's own error; desktop 8.4 MB → ~3.2 MB, phones 2.1 MB → ~0.9 MB.
   Run: node prototypes/highland-1-4/pack-field.cjs */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const here = p => path.join(__dirname, p);
const SRC_SCALE = .01, SCALE = .05, OFFSET = -64;
function pack(n) {
  const src = new Uint16Array(fs.readFileSync(here(`source/world-height-${n}.u16`)).buffer.slice(0));
  if (src.length !== n * n) throw new Error(`world-height-${n}.u16: ${src.length} values, expected ${n * n}`);
  const q = new Uint16Array(src.length);
  for (let i = 0; i < src.length; i++) q[i] = Math.round(src[i] * SRC_SCALE / SCALE);
  const M = n * n, planes = Buffer.alloc(2 * M);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c, d = (q[i] - (c ? q[i - 1] : r ? q[i - n] : 0)) & 0xffff;
    planes[i] = d >> 8; planes[M + i] = d & 255;
  }
  const gz = zlib.gzipSync(planes, { level: 9 });
  // round trip, exactly as the browser decodes it
  const b = zlib.gunzipSync(gz), out = new Uint16Array(M);
  let worst = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c, d = ((b[i] << 8 | b[M + i]) << 16) >> 16;
    out[i] = (c ? out[i - 1] : r ? out[i - n] : 0) + d;
    if (out[i] !== q[i]) throw new Error(`round trip differs at ${i}`);
    worst = Math.max(worst, Math.abs(out[i] * SCALE - src[i] * SRC_SCALE));
  }
  fs.writeFileSync(here(`assets/world-height-${n}.dz`), gz);
  console.log(`world-height-${n}.dz  ${(src.byteLength / 1e6).toFixed(2)} MB → ${(gz.length / 1e6).toFixed(2)} MB, worst error ${worst.toFixed(3)} u`);
}
pack(2049); pack(1025);
const metaPath = here('assets/world-meta.json'), meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
meta.encoding = { type: 'uint16-delta-planes-gzip', height: 'value*0.05 - 64', offset: OFFSET, scale: SCALE,
  layout: 'gzip( high bytes[n²], low bytes[n²] ) of int16 deltas: v − left neighbour (column 0: v − the one above)' };
meta.files = { full: 'world-height-2049.dz', lite: 'world-height-1025.dz' };
fs.writeFileSync(metaPath, JSON.stringify(meta));
console.log('world-meta.json: encoding + files updated');
