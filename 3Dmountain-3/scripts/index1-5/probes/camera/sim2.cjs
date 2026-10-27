// sim2: corridor-constrained smooth path (alternating projections: gaussian smooth, then clamp to +-clamp*halfwidth) + separate look smoothing.
const fs = require('node:fs');
const d = require('./design-lib.cjs');
const { D, L, C, Wd, tangent, sOf } = d;
const M = 512, dsM = L / M;                       // coarse sampling (4 units)
const cx = new Float64Array(M + 1), cz = new Float64Array(M + 1), nx = new Float64Array(M + 1), nz = new Float64Array(M + 1), wd = new Float64Array(M + 1);
for (let i = 0; i <= M; i++) { const s = i * dsM, c = C(s), tg = tangent(s); cx[i] = c[0]; cz[i] = c[1]; nx[i] = -tg[1]; nz[i] = tg[0]; wd[i] = Wd(s); }
function kernel(sigma) { const K = Math.ceil(3 * sigma / dsM), w = []; for (let k = -K; k <= K; k++) w.push(Math.exp(-.5 * (k * dsM / sigma) ** 2)); return { K, w }; }
function gauss(arr, ker) { const out = new Float64Array(M + 1), { K, w } = ker; for (let i = 0; i <= M; i++) { let s = 0, sw = 0; for (let k = -K; k <= K; k++) { let j = i + k; if (j < 0) j = 0; if (j > M) j = M; const q = w[k + K]; s += q * arr[j]; sw += q; } out[i] = s / sw; } return out; }
// lateral-offset formulation: o(s), path = C + o n.  Smoothing the path in space ~ smoothing o plus the centreline's own swing; do it in xz.
function corridor(sigma, frac, iters, finalSigma = 0, finalFrac = frac) {
  const ker = kernel(sigma); let px = Float64Array.from(cx), pz = Float64Array.from(cz), o = new Float64Array(M + 1);
  for (let it = 0; it < iters; it++) {
    px = gauss(px, ker); pz = gauss(pz, ker);
    for (let i = 0; i <= M; i++) { let v = (px[i] - cx[i]) * nx[i] + (pz[i] - cz[i]) * nz[i]; const lim = frac * wd[i]; v = Math.max(-lim, Math.min(lim, v)); o[i] = v; px[i] = cx[i] + nx[i] * v; pz[i] = cz[i] + nz[i] * v; }
  }
  if (finalSigma > 0) { const kf = kernel(finalSigma); o = gauss(o, kf); for (let i = 0; i <= M; i++) { const lim = finalFrac * wd[i]; o[i] = lim * Math.tanh(o[i] / lim); } }
  return o;
}
function lerpArr(a, s) { const x = Math.max(0, Math.min(M, s / dsM)), i = Math.min(M - 1, Math.floor(x)), f = x - i; return a[i] * (1 - f) + a[i + 1] * f; }
module.exports = { corridor, gauss, kernel, lerpArr, M, dsM, cx, cz, nx, nz, wd };
if (require.main === module) {
  for (const [sigma, iters, fs, ff] of [[40, 30, 0, .45], [40, 30, 30, .45], [40, 30, 50, .45], [60, 60, 40, .45], [60, 60, 60, .45], [60,60,80,.45], [90,60,60,.45], [60,60,60,.60]]) {
    const o = corridor(sigma, ff, iters, fs, .45), mx = Math.max(...o.map(Math.abs));
    // heading of racing line vs centreline over the first-person range
    const hd = (arrx, arrz, i) => Math.atan2(arrx[i + 1] - arrx[i - 1], -(arrz[i + 1] - arrz[i - 1])) * D;
    const px = [], pz = []; for (let i = 0; i <= M; i++) { px.push(cx[i] + nx[i] * o[i]); pz.push(cz[i] + nz[i] * o[i]); }
    let maxC = 0, maxP = 0; const i0 = Math.round(d.sOf(4.8) / dsM), i1 = Math.round(d.sOf(10) / dsM);
    for (let i = i0; i < i1; i++) { let a = hd(cx, cz, i + 1) - hd(cx, cz, i), b = hd(px, pz, i + 1) - hd(px, pz, i); const fix = v => (v > 180 ? v - 360 : v < -180 ? v + 360 : v); a = fix(a); b = fix(b); maxC = Math.max(maxC, Math.abs(a) / dsM * 269); maxP = Math.max(maxP, Math.abs(b) / dsM * 269); }
    console.log(`σ${sigma} it${iters} fs${fs} ff${ff} maxOffset ${mx.toFixed(1)}  peak heading rate per p-unit: centre ${maxC.toFixed(0)} racing ${maxP.toFixed(0)}`);
  }
}
