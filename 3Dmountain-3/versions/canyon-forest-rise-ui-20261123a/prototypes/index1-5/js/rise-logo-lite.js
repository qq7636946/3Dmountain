/* rise-logo-lite.js · OPT-M (strike team M, 2026-11-21): reader for the compact copy of the glass logo's model.
   Only index1-5-canyon-forest-rise.html asks for it (world-logo-mark.js, html[data-rise-studio-pbr], ?optM=0 / ?optMlogo=0 / ?perf=0 = the GLB as before).
   The file is made by scripts/perf-bake/rise-geo-logo.cjs from logo3d-<name>.glb and is named after the manifest's revision, so a new GLB
   (new revision) never meets an old copy: no copy for the revision = the page loads the GLB.
   Format (gzip around all of it; DecompressionStream reads it): 'RGL1', u32 jsonLength, JSON, sections.
     per part: positions as 3 x uint16 inside the part's own box, delta from the previous vertex, zig-zag, byte-planes (low bytes first);
               normals as octahedral 2 x uint16, byte-planes; indices as 'new vertex' (0) or 'distance back from the newest vertex' (>0), byte-planes.
   Vertices are numbered in order of first use; the triangles keep their order and winding. Position step <= 1.3e-5 (the model is 1 unit high),
   normal error <= 3e-5 rad: far below one pixel at the closest view. */
export function decodeLogoLite(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8[0] !== 0x52 || u8[1] !== 0x47 || u8[2] !== 0x4c || u8[3] !== 0x31) throw new Error('not an RGL1 file');
  const jl = dv.getUint32(4, true), head = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + jl))), base = 8 + jl;   /* section offsets count from the end of the header */
  const unshuffle = (off, count) => { const o = new Uint16Array(count), a = u8.subarray(off, off + count), b = u8.subarray(off + count, off + 2 * count); for (let i = 0; i < count; i++) o[i] = a[i] | (b[i] << 8); return o; };
  const parts = [];
  for (const p of head.parts) {
    const V = p.V, I = p.I, pos = new Float32Array(V * 3), nrm = new Float32Array(V * 3), idx = new Uint16Array(I);
    const D = unshuffle(base + p.pos, V * 3), prev = [0, 0, 0];
    for (let v = 0; v < V; v++) for (let k = 0; k < 3; k++) { const z = D[v * 3 + k], d = (z >> 1) ^ -(z & 1); prev[k] = (prev[k] + d) & 0xffff; pos[v * 3 + k] = p.min[k] + prev[k] * (p.max[k] - p.min[k]) / 65535; }
    const O = unshuffle(base + p.nrm, V * 2);
    for (let v = 0; v < V; v++) {
      let u = O[v * 2] / 65535 * 2 - 1, w = O[v * 2 + 1] / 65535 * 2 - 1, z = 1 - Math.abs(u) - Math.abs(w), x = u, y = w;
      if (z < 0) { x = (1 - Math.abs(w)) * (u >= 0 ? 1 : -1); y = (1 - Math.abs(u)) * (w >= 0 ? 1 : -1); }
      const l = Math.sqrt(x * x + y * y + z * z) || 1; nrm[v * 3] = x / l; nrm[v * 3 + 1] = y / l; nrm[v * 3 + 2] = z / l;
    }
    const C = unshuffle(base + p.idx, I); let hw = 0;
    for (let i = 0; i < I; i++) { const c = C[i]; if (c === 0) idx[i] = hw++; else idx[i] = hw - c; }
    parts.push({ name: p.name, position: pos, normal: nrm, index: idx });
  }
  return { revision: head.revision, source: head.source, parts };
}
export async function fetchLogoLite(url) {
  if (typeof DecompressionStream !== 'function') throw new Error('no DecompressionStream');
  const r = await fetch(url); if (!r.ok || !r.body) throw new Error('logo copy ' + r.status);
  const buf = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return decodeLogoLite(new Uint8Array(buf));
}
