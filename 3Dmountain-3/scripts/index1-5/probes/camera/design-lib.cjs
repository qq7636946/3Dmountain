// Offline mirror of the canyon camera (index1-5): loads .qa/index1-5/camera/curve.json (arc-length samples of the centreline + half-width)
// and evaluates the OLD framing and candidate racing-line framings per journey p. Used to pick parameters before touching the scene.
const fs = require('node:fs');
const D = 180 / Math.PI;
const SHIFT = 2.894, CLOCK0 = 1.404, CLOCKSPAN = 6.596;
const curve = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '..', '..', '..', '..', '.qa', 'index1-5', 'camera', 'curve.json'), 'utf8'));
const L = curve.L, N = curve.N, PTS = curve.pts, WID = curve.w;
const ds = L / N;
// page p -> route position s (arc length on the centreline), exactly the scene's t = route * .865
function routeOf(p) { // downstream clock for p >= 4.87 is p - SHIFT; for 4.7..4.87 the cubic matters only to the opening handoff
  const c = p - SHIFT; return Math.max(0, Math.min(1, (c - CLOCK0) / CLOCKSPAN));
}
const sOf = p => routeOf(p) * .865 * L;
const pOfS = s => (s / L / .865) * CLOCKSPAN + CLOCK0 + SHIFT;
// sampled accessors (linear interp), clamped
function at(arr2, s, k) { const x = Math.max(0, Math.min(N, s / ds)), i = Math.min(N - 1, Math.floor(x)), f = x - i; return arr2[i][k] * (1 - f) + arr2[i + 1][k] * f; }
const C = s => [at(PTS, s, 0), at(PTS, s, 1)];
const Wd = s => { const x = Math.max(0, Math.min(N, s / ds)), i = Math.min(N - 1, Math.floor(x)), f = x - i; return WID[i] * (1 - f) + WID[i + 1] * f; };
// unit tangents (central differences over 2 units)
function tangent(s) { const a = C(s - 1), b = C(s + 1), x = b[0] - a[0], z = b[1] - a[1], h = Math.hypot(x, z) || 1; return [x / h, z / h]; }
const headingOf = tg => Math.atan2(tg[0], -tg[1]) * D;
module.exports = { D, SHIFT, L, N, ds, C, Wd, tangent, headingOf, routeOf, sOf, pOfS };
