// offline test of prototypes/index1-5/canyon-racing.js on the real wheel trajectory (before-a-log.json)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..', '..', '..', '..');
const { createCanyonRacing, RACING_ANCHORS } = await import(pathToFileURL(path.join(root, 'prototypes/index1-5/canyon-racing.js')).href);
const curve = JSON.parse(fs.readFileSync(path.join(root, '.qa/index1-5/camera/curve.json'), 'utf8')), L = curve.L, N = curve.N, ds = L / N;
const lerp2 = (s, k) => { const x = Math.max(0, Math.min(N - 1e-9, s / ds)), i = Math.floor(x), f = x - i; return curve.pts[i][k] * (1 - f) + curve.pts[i + 1][k] * f; };
const centre = s => [lerp2(s, 0), lerp2(s, 1)], halfWidth = s => { const x = Math.max(0, Math.min(N - 1e-9, s / ds)), i = Math.floor(x), f = x - i; return curve.w[i] * (1 - f) + curve.w[i + 1] * f; };
const R = createCanyonRacing({ length: L, centre, halfWidth });
const SHIFT = 2.894, D = 180 / Math.PI;
const sOf = p => Math.max(0, Math.min(1, (p - SHIFT - 1.404) / 6.596)) * .865 * L;
const argv = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const racing = Number(argv.racing ?? .7), ahead = Number(argv.ahead ?? 29), maxYaw = Number(argv.maxYaw ?? 45);
const log = JSON.parse(fs.readFileSync(path.join(root, argv.log ?? '.qa/index1-5/camera/before-a-log.json'), 'utf8'));
const frames = log.frames.filter(f => f[11] === 0 && f[1] >= 4.7 && f[1] <= 10.4);
const heading = (s) => { const a = centre(s), b = centre(Math.min(L, s + ahead)); return Math.atan2(b[0] - a[0], -(b[1] - a[1])) * D; };
let prev = null, rows = [];
for (const f of frames) {
  const t = f[0], p = f[1], s = sOf(p), r = R.sample(s, racing, ahead, maxYaw);
  const h = (heading(s) + r.yaw * D) / D, phi = Math.atan(.5 / 29), cp = Math.cos(phi), dir = [Math.sin(h) * cp, Math.sin(phi), -Math.cos(h) * cp];
  if (prev) { const dt = (t - prev.t) / 1000; if (dt > 0) { const dot = Math.max(-1, Math.min(1, prev.dir[0] * dir[0] + prev.dir[1] * dir[1] + prev.dir[2] * dir[2])); rows.push({ p, ang: Math.acos(Math.min(1, dot)) * D / dt, yaw: r.yaw * D, side: r.side / halfWidth(s), roll: r.roll, alt: r.alt }); } }
  prev = { t, dir };
}
const g = (a, b) => rows.filter(r => r.p >= a && r.p <= b), mx = (r, k = 'ang') => Math.max(0, ...r.map(x => x[k])), mn = (r, k = 'ang') => r.length ? r.reduce((s, x) => s + x[k], 0) / r.length : 0;
const T = R.table();
console.log(JSON.stringify({ ok: T?.ok, cap: T?.cap, peak: +mx(g(4.8, 10.2)).toFixed(1), A: [+mn(g(5.55, 5.95)).toFixed(1), +mx(g(5.55, 5.95)).toFixed(1)], B: [+mn(g(7.2, 7.62)).toFixed(1), +mx(g(7.2, 7.62)).toFixed(1)], C: [+mn(g(8.5, 8.9)).toFixed(1), +mx(g(8.5, 8.9)).toFixed(1)], yawMax: +mx(g(4.8, 10.2), 'yaw').toFixed(1), yawMin: +Math.min(...g(4.8, 10.2).map(r => r.yaw)).toFixed(1), sideMax: +Math.max(...g(4.8, 10.2).map(r => Math.abs(r.side))).toFixed(3), altMax: +mx(g(4.8, 10.2), 'alt').toFixed(2), rollMax: +mx(g(4.8, 10.2), 'roll').toFixed(2) }));
// anchors
const pOfClock = c => c + SHIFT, an = RACING_ANCHORS.map(([c, tol]) => { const s = ((c - 1.404) / 6.596) * .865 * L, r = R.sample(s, racing, ahead, maxYaw); return `${pOfClock(c).toFixed(3)}:yaw ${(r.yaw * D).toFixed(2)} side ${r.side.toFixed(2)} (tol ${tol})`; });
console.log(an.join('\n'));
const leak = []; for (const p of [4.5, 4.7, 4.736, 4.8, 4.87, 4.9]) { const r = R.sample(sOf(p), racing, ahead, maxYaw); leak.push(`${p}:${(r.yaw * D).toFixed(3)}`); } console.log('before start', leak.join(' '));
// roll at the stops: new shape × (.035 × boost) vs the old formula (bank 1)
const tang = s => { const a = centre(s - 1), b = centre(s + 1), x = b[0] - a[0], z = b[1] - a[1], h = Math.hypot(x, z); return [x / h, z / h]; };
const rollOld = s => { const f = tang(s), n = tang(Math.min(L, s + 28)); const turn = f[0] * n[1] - f[1] * n[0]; return Math.max(-.035, Math.min(.035, turn * .32)) * D; };
const boost = Number(argv.boost ?? 2.5);
console.log('roll at stops (deg): page p | old(bank1) | new(boost ' + boost + ')');
for (const pp of [4.736, 4.8, 4.894, 5.014, 5.854, 7.594, 7.694, 9.744, 9.794]) { const s = sOf(pp), r = R.sample(s, racing, ahead, maxYaw); console.log(pp, rollOld(s).toFixed(2), (r.roll * .035 * boost * D).toFixed(2)); }
let mxr = 0; for (let p = 4.8; p <= 9.3; p += .01) { const r = R.sample(sOf(p), racing, ahead, maxYaw); mxr = Math.max(mxr, Math.abs(r.roll * .035 * boost * D)); } console.log('max |roll| new', mxr.toFixed(2));
