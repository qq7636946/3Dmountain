/* Drop gorge · the slab sculptor (Team XS, 2026-11-17). A module worker: the gorge's few large slabs are carved here once, at load, off
   the main thread, and handed back as plain buffers (nothing is downloaded, nothing is computed per pixel later).
   Each slab is a signed distance field (units: its thickness T = 1): a long block with rounded, worn edges (rounded box + domain warp),
   uneven thickness and taper, a broken inner tip (an angled break), shallow strata on its sides, a net of cracks carved into it
   (cellular F2 − F1 grooves), a few weathered pits, fine erosion; some are two plates fused. Meshed by surface nets (a smooth quad mesh),
   normals from the field's gradient. Baked per vertex: AO (the field sampled along the normal and up toward the light), crack depth,
   a moss amount (on what faces up, cushion-shaped, thicker in the cracks), and anchors for flower clusters growing out of cracks on top.
   Message: { shapes: [{ seed, L, D, kind }], res } → { slabs: [{ pos, nrm, ao, crack, moss, index, anchors, bbox }] } (transferred). */
const hash = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function vnoise(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iy, iz, s), b = hash(ix + 1, iy, iz, s), c = hash(ix, iy + 1, iz, s), d = hash(ix + 1, iy + 1, iz, s);
  const e = hash(ix, iy, iz + 1, s), f = hash(ix + 1, iy, iz + 1, s), g = hash(ix, iy + 1, iz + 1, s), h = hash(ix + 1, iy + 1, iz + 1, s);
  return ((a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy) * (1 - uz) + ((e + (f - e) * ux) + ((g + (h - g) * ux) - (e + (f - e) * ux)) * uy) * uz;
}
const fbm = (x, y, z, s, o = 4) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * vnoise(x * f, y * f, z * f, s + i * 17); f *= 2.03; a *= 0.5; } return v / (1 - Math.pow(0.5, o)); };
/* cellular: F2 − F1 (the crack net) */
function cells(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let f1 = 9, f2 = 9;
  for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, cz = iz + k;
    const px = cx + hash(cx, cy, cz, s), py = cy + hash(cx, cy, cz, s + 1), pz = cz + hash(cx, cy, cz, s + 2);
    const d = (px - x) * (px - x) + (py - y) * (py - y) + (pz - z) * (pz - z);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return Math.sqrt(f2) - Math.sqrt(f1);
}
const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };
const roundBox = (x, y, z, bx, by, bz, r) => {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
};

function makeField(sh) {
  const s = sh.seed | 0, L = sh.L, D = sh.D, R = (k) => hash(k, 3, 7, s);
  const holes = [];
  const nh = 2 + Math.floor(R(1) * 3);
  for (let i = 0; i < nh; i++) holes.push([(R(10 + i) - 0.2) * L * 0.7, 0.35 + R(20 + i) * 0.25, (R(30 + i) - 0.3) * D * 0.8, 0.12 + R(40 + i) * 0.16]);
  const cutA = 0.5 + R(50) * 0.6, cutB = (R(51) - 0.5) * 1.2, cutO = L * (0.36 + R(52) * 0.1);
  const twoPlates = sh.kind === 'stack', bend = (R(60) - 0.5) * 0.25;
  const crackScale = 0.85 + R(61) * 0.5, crackDepth = 0.075 + R(62) * 0.04;
  /* the bare form (no cracks / fine erosion): used for the crack mask too */
  const form = (x, y, z) => {
    const w = 0.17;
    const qx = x + w * (vnoise(x * 0.9, y * 0.9, z * 0.9 + 3.1, s) - 0.5) * 2;
    const qy = y + w * 0.7 * (vnoise(x * 0.9 + 5.2, y * 0.9, z * 0.9, s + 3) - 0.5) * 2 - bend * Math.pow(qx0(x, L), 2);
    const qz = z + w * (vnoise(x * 0.9, y * 0.9 + 7.7, z * 0.9, s + 5) - 0.5) * 2;
    const u = (qx / L) + 0.5;   /* 0 root (outside the frame) … 1 tip */
    const th = 0.5 * (1 + 0.25 * (vnoise(qx * 0.55, 0.3, qz * 0.3, s + 7) - 0.5) * 2) * (1 - 0.3 * Math.max(0, u - 0.55) / 0.45 * (sh.kind === 'wedge' ? 1.6 : 1));
    const dp = 0.5 * D * (1 + 0.2 * (vnoise(qx * 0.4, 1.3, 0, s + 9) - 0.5) * 2);
    let d = roundBox(qx, qy, qz, L / 2, Math.max(0.12, th), dp, 0.2);
    if (twoPlates) { const d2 = roundBox(qx - L * 0.08, qy - 0.78, qz + D * 0.06, L * 0.42, 0.32, dp * 0.85, 0.16); d = smin(d, d2, 0.12); }
    if (sh.kind === 'step') { const d2 = roundBox(qx + L * 0.12, qy + 0.62, qz - D * 0.05, L * 0.36, 0.3, dp * 0.9, 0.15); d = smin(d, d2, 0.1); }
    /* the broken tip: an angled break */
    const cn = Math.hypot(1, cutB, cutA), cut = ((qx - cutO) + cutB * qy + cutA * qz * 0.4) / cn;
    d = Math.max(d, cut * 0.9);
    /* strata: shallow horizontal steps on the sides */
    d += 0.03 * (Math.abs(Math.sin(qy * 4.2 + 2.0 * vnoise(qx * 0.6, qy, qz * 0.6, s + 11))) - 0.5);
    return d;
  };
  const qx0 = (x, L) => x / L;
  const crack = (x, y, z) => { const c = cells(x * crackScale * 0.9, y * crackScale * 1.4, z * crackScale * 0.9, s + 13); return Math.exp(-c / 0.07); };
  const f = (x, y, z) => {
    let d = form(x, y, z);
    if (d > 0.5) return d;
    d += crackDepth * crack(x, y, z);
    for (const h of holes) { const hd = Math.hypot(x - h[0], (y - h[1]) * 1.3, z - h[2]) - h[3] * (0.8 + 0.4 * vnoise(x * 3, y * 3, z * 3, s + 19)); d = Math.max(d, -hd); }
    d += 0.035 * (fbm(x * 2.6, y * 2.6, z * 2.6, s + 23, 3) - 0.5);
    return d;
  };
  return { f, crack, bbox: [-L / 2 - 0.5, -1.5, -D / 2 - 0.5, L / 2 + 0.5, 1.7, D / 2 + 0.5] };
}

function mesh(field, h, sh, wantAnchors) {
  const [x0, y0, z0, x1, y1, z1] = field.bbox;
  const nx = Math.ceil((x1 - x0) / h), ny = Math.ceil((y1 - y0) / h), nz = Math.ceil((z1 - z0) / h);
  const sx = nx + 1, sy = ny + 1, F = new Float32Array(sx * sy * (nz + 1));
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) F[i + sx * (j + sy * k)] = field.f(x0 + i * h, y0 + j * h, z0 + k * h);
  const at = (i, j, k) => F[i + sx * (j + sy * k)];
  const cellV = new Int32Array(nx * ny * nz).fill(-1), P = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { v[c] = at(i + C[c][0], j + C[c][1], k + C[c][2]); if (v[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let ax = 0, ay = 0, az = 0, n = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      ax += C[a][0] + (C[b][0] - C[a][0]) * t; ay += C[a][1] + (C[b][1] - C[a][1]) * t; az += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    cellV[i + nx * (j + ny * k)] = P.length / 3;
    P.push(x0 + (i + ax / n) * h, y0 + (j + ay / n) * h, z0 + (k + az / n) * h);
  }
  const cv = (i, j, k) => cellV[i + nx * (j + ny * k)];
  const I = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {   /* x edges */
    const a = at(i, j, k), b = at(i + 1, j, k); if ((a < 0) === (b < 0)) continue;
    quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), !(a < 0));
  }
  for (let k = 1; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {   /* y edges */
    const a = at(i, j, k), b = at(i, j + 1, k); if ((a < 0) === (b < 0)) continue;
    quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), !(a < 0));
  }
  for (let k = 0; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {   /* z edges */
    const a = at(i, j, k), b = at(i, j, k + 1); if ((a < 0) === (b < 0)) continue;
    quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), !(a < 0));
  }
  /* per vertex: normal (gradient), AO, crack, moss */
  const nV = P.length / 3, N = new Float32Array(nV * 3), AO = new Float32Array(nV), CR = new Float32Array(nV), MS = new Float32Array(nV);
  const e = h * 0.5, f = field.f;
  const anchors = [];
  for (let q = 0; q < nV; q++) {
    const x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2];
    let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
    N[q * 3] = gx; N[q * 3 + 1] = gy; N[q * 3 + 2] = gz;
    let occ = 0;
    for (let s = 1; s <= 4; s++) { const dd = 0.09 * s; occ += Math.max(0, dd - f(x + gx * dd, y + gy * dd, z + gz * dd)) / dd * Math.pow(0.6, s); }
    let up = 0;   /* the light comes from above: anything of the slab over this point shades it */
    for (let s = 1; s <= 3; s++) { const dd = 0.22 * s; if (f(x + gx * 0.05, y + 0.05 + dd, z + gz * 0.05) < 0) up += 0.33; }
    AO[q] = Math.max(0.12, Math.min(1, 1 - occ * 1.15)) * (1 - 0.45 * up);
    const c = field.crack(x, y, z); CR[q] = c;
    const top = Math.max(0, Math.min(1, (gy - 0.3) / 0.5));
    const cush = fbm(x * 1.7, y * 1.7, z * 1.7, (sh.seed | 0) + 31, 3);
    const lip = Math.max(0, Math.min(1, (gy + 0.15) / 0.45)) * (1 - top) * Math.max(0, Math.min(1, (y - 0.15) / 0.3));
    MS[q] = Math.max(0, Math.min(1, top * ((cush - 0.4) * 3.2 + c * 0.9 + 0.1) + lip * ((cush - 0.55) * 3 + c * 0.6)));
    if (wantAnchors && gy > 0.72 && c > 0.35 && x > -sh.L * 0.25 && hash(q, 1, 2, sh.seed | 0) < 0.12) anchors.push(x, y, z, gx, gy, gz, c);
  }
  return { pos: new Float32Array(P), nrm: N, ao: AO, crack: CR, moss: MS, index: nV < 65536 ? new Uint16Array(I) : new Uint32Array(I), anchors: new Float32Array(anchors), tris: I.length / 3 };
}

self.onmessage = ev => {
  const { shapes, res, id } = ev.data || {};
  const t0 = performance.now(), out = [], transfer = [];
  for (const sh of shapes) {
    const field = makeField(sh);
    const r = mesh(field, res.hi, sh, true);
    const lo = mesh(field, res.lo, sh, false);
    const pack = m => ({ pos: m.pos, nrm: m.nrm, ao: m.ao, crack: m.crack, moss: m.moss, index: m.index, tris: m.tris });
    out.push({ hi: pack(r), lo: pack(lo), anchors: r.anchors, shape: sh });
    for (const m of [r, lo]) transfer.push(m.pos.buffer, m.nrm.buffer, m.ao.buffer, m.crack.buffer, m.moss.buffer, m.index.buffer);
    transfer.push(r.anchors.buffer);
  }
  self.postMessage({ id, slabs: out, ms: Math.round(performance.now() - t0) }, transfer);
};
