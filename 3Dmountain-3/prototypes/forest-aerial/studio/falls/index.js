/* RISE FALLS · the one entry (team FW: water and air, 2026-11-23). Brief: docs/falls/BRIEF-20261123.md · report: docs/falls/FW.md
   Client: 「幫我 index1-5-canyon-forest-rise-ui.html 這段做成像圖一峽谷的樣子，匯集中間瀑布如圖三」.
   Only ever imported by studio/flow2-studio-pbr-view.js when html[data-rise-falls] is set (the page: ?falls=1 while it is being built).

   What this file does:
     · reads team FT's contract (./falls-shape.js: levels, rim outline, lip ranges per river, the fourth river's path down its ravine);
     · asks FT's ./falls-gorge.js for the rock (missing or failing: a warning, the water still comes);
     · makes what both of FW's layers share: the lip resampled as smooth chains, the foot line of the falling water, a small field
       picture of the gorge (distance to the foot, distance to the rim, how full the fall is there) and one small noise picture;
     · builds the water (./falls-water.js: the curtain, the pool, the ravine's stream, the rivers' light running down and gathering)
       and the air (./falls-mist.js: one soft cloud, marched through in a single draw);
     · ties them to the view: the entrance (setArrival), the rivers' light lines ending at the lip, the old lake's flow marks cut at the rim,
       the dive's target (the pool), the quality tiers.

   createStudioFalls(renderer, atlas, studio, ctx) → { group, update(frame), setArrival(k), dispose(), … }
   ctx: { reducedMotion, query, beams, curtain, flow } (all optional).

   Switches (URL): ?fallsMist=0 (no cloud) · ?fallsLight=0 (no light on the curtain / in the pool) · ?fallsWater=0 (no curtain, pool, stream:
   the rock alone) · ?fallsGorge=0 (FT's rock not asked for) · ?fallsSteps=N (the cloud's samples per pixel, 3–12).
   Dials: panel 「瀑布與水霧」 (key W; ?panel=1 under automation). Live: window.__RISE_FALLS__ = { tune, state, apply(), stats(), … }. */
import * as THREE from 'three';
import { createFallsWater } from './falls-water.js?v=dir2-shelf23';
import { createFallsMist } from './falls-mist.js?v=redo-w6b';

/* team FT's modules: FT bumps these two stamps when they change */
const SHAPE_URL = './falls-shape.js?v=dir2';
const GORGE_URL = './falls-gorge.js?v=dir1-shelf23';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const cr = (a, b, c, d, t) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);

/* ------------------------------------------------------------------ one small noise picture (made here, no file)
   128 x 128, tiles in both directions. R, G: two independent smooth noises (two octaves); B: one octave, broad; A: four octaves (billows). */
export function makeFallsNoise(renderer) {
  const N = 128, data = new Uint8Array(N * N * 4);
  const lattice = (period, seed) => { const g = new Float32Array(period * period); let s = seed >>> 0;
    for (let i = 0; i < g.length; i++) { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9E3779B9) >>> 0; s ^= s >>> 13; g[i] = ((Math.imul(s, 3266489909) >>> 0) / 4294967296); } return g; };
  const value = (g, period, x, y) => { const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi; fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period, x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = g[y0 * period + x0], b = g[y0 * period + x1], c = g[y1 * period + x0], d = g[y1 * period + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  const layers = [
    [[8, .62, 11], [16, .38, 12]],
    [[8, .62, 21], [16, .38, 22]],
    [[4, 1, 31]],
    [[4, .5, 41], [8, .27, 42], [16, .15, 43], [32, .08, 44]]
  ].map(ch => ch.map(([period, weight, seed]) => ({ period, weight, g: lattice(period, seed * 7919 + 17) })));
  for (let c = 0; c < 4; c++) {
    const ch = layers[c]; let lo = Infinity, hi = -Infinity; const tmp = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0; for (const o of ch) v += o.weight * value(o.g, o.period, x / N * o.period, y / N * o.period); tmp[y * N + x] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
    for (let i = 0; i < N * N; i++) data[i * 4 + c] = Math.round(255 * (tmp[i] - lo) / Math.max(1e-6, hi - lo));
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.name = 'Rise falls noise'; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 1); tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ the contract, made ready for both layers */
export function prepareFalls(S, sdFn, dropFn = null) {
  const O = S.outline, n = O.length, H = S.waterY - S.poolY;
  const P = i => O[((i % n) + n) % n];
  const rim = f => { const i = Math.floor(f), t = f - i, a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2); return [cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t)]; };
  const throwD = clamp(.32 * H, .18, .40);           /* redo-w5: a rounder crest (the arc over the brink reads at the client's lens) */
  /* lips → chains of neighbours that share their end point */
  const lips = (S.lips || []).map(l => { let a = +l.from, b = +l.to; while (b < a) b += n; return { a, b, river: l.river || null, flow: clamp(Number.isFinite(+l.flow) ? +l.flow : .7) }; }).sort((x, y) => x.a - y.a);
  const chains = [];
  for (const l of lips) { const c = chains[chains.length - 1]; if (c && Math.abs(c.b - l.a) < 1e-6) { c.b = l.b; c.lips.push(l); } else chains.push({ a: l.a, b: l.b, lips: [l] }); }
  if (chains.length > 1) { const f = chains[0], l = chains[chains.length - 1]; if (Math.abs(l.b - n - f.a) < 1e-6) { l.b = f.b + n; for (const x of f.lips) l.lips.push({ ...x, a: x.a + n, b: x.b + n }); chains.shift(); } }
  const STEP = .04;
  let u0 = 0;
  for (const C of chains) {
    /* walk the rim at a fine index step, keep a sample every STEP of length */
    const fine = []; let len = 0, prev = null;
    for (let f = C.a; f <= C.b + 1e-9; f += 1 / 24) { const p = rim(Math.min(f, C.b)); if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); fine.push([p[0], p[1], len, Math.min(f, C.b)]); prev = p; }
    const count = Math.max(8, Math.round(len / STEP)), samples = [];
    let j = 0;
    for (let i = 0; i <= count; i++) {
      const want = len * i / count; while (j < fine.length - 2 && fine[j + 1][2] < want) j++;
      const A = fine[j], B = fine[j + 1], t = B[2] > A[2] ? (want - A[2]) / (B[2] - A[2]) : 0;
      samples.push({ x: A[0] + (B[0] - A[0]) * t, z: A[1] + (B[1] - A[1]) * t, s: want, f: A[3] + (B[3] - A[3]) * t });
    }
    for (let i = 0; i <= count; i++) {
      const a = samples[Math.max(0, i - 1)], b = samples[Math.min(count, i + 1)], q = samples[i];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      let nx = -tz, nz = tx;
      if (sdFn(q.x + nx * .06, q.z + nz * .06) > sdFn(q.x - nx * .06, q.z - nz * .06)) { nx = -nx; nz = -nz; }   /* the normal points into the gorge */
      q.nx = nx; q.nz = nz; q.tx = tx; q.tz = tz; q.u = u0 + q.s;
      const lip = C.lips.find(L => q.f >= L.a - 1e-6 && q.f <= L.b + 1e-6) || C.lips[C.lips.length - 1];
      q.raw = lip.flow; q.river = lip.river;
    }
    /* the fall is fuller where a river arrives: the steps between lips are eased over about half a unit; the chain thins out at its two ends */
    const win = Math.max(1, Math.round(.28 / (len / count)));
    for (let i = 0; i <= count; i++) { let sum = 0, w = 0; for (let k = -win; k <= win; k++) { const m = samples[clamp(i + k, 0, count)], g = 1 - Math.abs(k) / (win + 1); sum += m.raw * g; w += g; } samples[i].flow = sum / w; }
    for (const q of samples) { q.end = smooth(0, .10, Math.min(q.s, len - q.s)); q.fx = q.x + q.nx * throwD; q.fz = q.z + q.nz * throwD; }
    C.samples = samples; C.length = len; C.u0 = u0; u0 += len + 4;
  }
  /* the fourth river's water line down its ravine, finer; redo-w3: the same for the left river's low inlet (shape redo-s2 `inlet`) */
  const riverOf = o => {
    if (!o || !Array.isArray(o.path) || o.path.length < 4) return null;
    const Q = o.path, m = Q.length, at = i => Q[clamp(i, 0, m - 1)], pts = [];
    for (let i = 0; i < m - 1; i++) for (let k = 0; k < 3; k++) { const t = k / 3, a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2); pts.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t), i + t]); }
    pts.push([Q[m - 1][0], Q[m - 1][1], Q[m - 1][2], m - 1]);
    let d = 0; pts.forEach((p, i) => { if (i) d += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1], p[2] - pts[i - 1][2]); p[4] = d; });
    const start = Number.isFinite(+o.start) ? +o.start : 0, cross = Number.isFinite(+o.cross) ? +o.cross : m - 1;
    const dAt = idx => { let best = pts[0]; for (const p of pts) if (Math.abs(p[3] - idx) < Math.abs(best[3] - idx)) best = p; return best[4]; };
    const mouth = pts.find(p => p[3] >= cross && p[2] <= S.poolY + .012) || pts[pts.length - 1];   /* where the cascade has come down to the pool */
    return { pts, start, cross, dStart: dAt(start), dCross: dAt(cross), length: d, width: clamp(+o.width || .3, .08, .8), river: o.river || null, mouth: [mouth[0], mouth[1]] };
  };
  const outlet = riverOf(S.outlet), inlet = riverOf(S.inlet);
  /* the field: R = distance to the foot of the falling water, G = signed distance to the rim, B = how full the nearest fall is,
     A = how far the land outside the rim lies under the plateau's water level there (FT's troughDrop: the river's trough, the dipped near shore).
     Where the fourth river's cascade lands counts as a small fall of its own (a little churn, a breath of spray). */
  const feet = chains.flatMap(C => C.samples);
  const landings = [outlet, inlet].filter(Boolean).map(r => ({ fx: r.mouth[0], fz: r.mouth[1], flow: .32, end: 1 }));
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of O) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  const M = 1.1; x0 -= M; x1 += M; z0 -= M; z1 += M;
  const FN = 128, field = new Float32Array(FN * FN * 4);
  for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) {
    const x = x0 + (i + .5) / FN * (x1 - x0), z = z0 + (j + .5) / FN * (z1 - z0);
    let best = Infinity, fl = 0;
    for (const q of feet) { if (q.end < .25) continue; const dx = x - q.fx, dz = z - q.fz, dd = dx * dx + dz * dz; if (dd < best) { best = dd; fl = q.flow; } }
    for (const q of landings) { const dx = x - q.fx, dz = z - q.fz, dd = (dx * dx + dz * dz) * 6; if (dd < best) { best = dd; fl = q.flow; } }   /* felt over a short reach only */
    const o = (j * FN + i) * 4; let drop = 0; if (dropFn) { try { drop = Math.max(0, +dropFn(x, z) || 0); } catch (error) { drop = 0; } }
    field[o] = Math.sqrt(best); field[o + 1] = sdFn(x, z); field[o + 2] = fl; field[o + 3] = drop;
  }
  const sample = (x, z) => {   /* bilinear read of the field on the CPU (the pool's vertices) */
    const fx = clamp((x - x0) / (x1 - x0) * FN - .5, 0, FN - 1.001), fz = clamp((z - z0) / (z1 - z0) * FN - .5, 0, FN - 1.001), i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j;
    const r = c => { const p = (j * FN + i) * 4 + c; return (field[p] * (1 - a) + field[p + 4] * a) * (1 - b) + (field[p + FN * 4] * (1 - a) + field[p + FN * 4 + 4] * a) * b; };
    return [r(0), r(1), r(2), r(3)];
  };
  return { S, sd: sdFn, H, throwD, chains, feet, outlet, inlet, rect: [x0, z0, x1, z1], fieldN: FN, field, sample, rim, n };
}

function fieldTexture(G) {
  const half = new Uint16Array(G.field.length);
  for (let i = 0; i < half.length; i++) half[i] = THREE.DataUtils.toHalfFloat(clamp(G.field[i], -60000, 60000));
  const tex = new THREE.DataTexture(half, G.fieldN, G.fieldN, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.name = 'Rise falls field'; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  return tex;
}

/* where a line of [x, z] points first meets a closed ring: the length along the line, or -1 */
function firstCrossing(pts, cum, ring) {
  const cross = (ax, az, bx, bz) => ax * bz - az * bx;
  for (let i = 1; i < pts.length; i++) {
    const [x, z] = pts[i - 1], [nx, nz] = pts[i], dx = nx - x, dz = nz - z; let first = Infinity;
    for (let j = 0; j < ring.length; j++) {
      const [rx, rz] = ring[j], [tx, tz] = ring[(j + 1) % ring.length], ex = tx - rx, ez = tz - rz, den = cross(dx, dz, ex, ez);
      if (Math.abs(den) < 1e-9) continue;
      const along = cross(rx - x, rz - z, ex, ez) / den, across = cross(rx - x, rz - z, dx, dz) / den;
      if (along >= 0 && along <= 1 && across >= 0 && across <= 1) first = Math.min(first, along);
    }
    if (Number.isFinite(first)) return { s: cum[i - 1] + first * (cum[i] - cum[i - 1]), x: x + dx * first, z: z + dz * first };
  }
  return null;
}

/* REDO 2026-11-23 (designer B, WATER; docs/falls/REDO-20261123.md): the client's picture has ONE continuous horseshoe curtain.
   Whatever arcs the shape's lips are (17:30 they were three separate falls), the water is laid along one lip from `ends[0]` to `ends[1]`
   (parametric rim angles, degrees: 0 = the right end of the widest line, 90 = the far middle, 180 = the left end), the shape's own lips
   keep their rivers and their fullness, the stretches between them are bridged at `bridge` fullness. ?fallsSplit=1 = the shape's lips as
   they are (the 17:30 three falls), for comparison only. */
export function oneHorseshoe(S, { ends = [10, 170], bridge = .84, riverMin = .92 } = {}) {
  const n = S.outline.length, fn = S.fn || {};
  const lips = (S.lips || []).map(l => { const from = +l.from; let to = +l.to; while (to < from) to += n; return { from, to, river: l.river || null, flow: Math.max(riverMin, +l.flow || 0) }; }).sort((a, b) => a.from - b.from);
  if (!lips.length) return S;
  let a = lips[0].from, b = lips[lips.length - 1].to;
  if (typeof fn.rimIndex === 'function' && Array.isArray(ends)) {
    const ia = Math.round(fn.rimIndex(ends[0])); let ib = Math.round(fn.rimIndex(ends[1])); while (ib < ia) ib += n;
    if (ia < a) a = ia; if (ib > b) b = ib;
  }
  const out = []; let cur = a;
  for (const l of lips) {
    if (l.to <= cur) continue;
    if (l.from > cur) out.push({ from: cur, to: l.from, river: null, flow: bridge });
    out.push({ from: Math.max(cur, l.from), to: l.to, river: l.river, flow: l.flow }); cur = l.to;
  }
  if (b > cur) out.push({ from: cur, to: b, river: null, flow: bridge });
  return { ...S, lips: out.map(l => ({ ...l, from: l.from % n, to: l.to % n })), oneCurtain: { ends: [a % n, b % n], bridge } };
}

export async function createStudioFalls(renderer, atlas, studio, ctx = {}) {
  const Q = ctx.query || new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const qNum = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const reduced = !!ctx.reducedMotion;
  const shapeModule = ctx.shapeModule || await import(new URL(SHAPE_URL, import.meta.url).href);
  let S = shapeModule.FALLS_SHAPE, sdFn = shapeModule.gorgeSd;
  if (!S || typeof sdFn !== 'function' || !Array.isArray(S.outline) || S.outline.length < 8 || !(S.waterY > S.poolY)) throw new Error('falls-shape.js: the contract is not complete');
  /* director 2026-11-24: the client's opening is the default (「好，設成預設」): 開口大小 0.66, 峽谷深度 0.54 (falls-shape.js DEFAULT_OPENING; the
     published FALLS_SHAPE is the shape at that opening) */
  const DEF = { scale: 1, width: 1, length: 1, headland: 1, ...(S.defaults || {}), ...(shapeModule.DEFAULT_OPENING || {}) };
  const defDepth = +(S.waterY - S.poolY).toFixed(2);
  const initScale = clamp(qNum('fallsScale', DEF.scale), .55, 1.40);
  const initWidth = clamp(qNum('fallsWidth', DEF.width), .60, 1.40);
  const initLength = clamp(qNum('fallsLength', DEF.length), .60, 1.40);
  const initDepth = clamp(qNum('fallsDepth', defDepth), .40, 2.40);
  const initHeadland = clamp(qNum('fallsHeadland', DEF.headland), 0, 1.80);
  const isDefault = (sc, w, l, d, h) => Math.abs(sc - DEF.scale) + Math.abs(w - DEF.width) + Math.abs(l - DEF.length) + Math.abs(d - defDepth) + Math.abs(h - DEF.headland) < 1e-4;
  if (typeof shapeModule.buildFallsShape === 'function' && !isDefault(initScale, initWidth, initLength, initDepth, initHeadland)) {
    S = shapeModule.buildFallsShape({ scale: initScale, width: initWidth, length: initLength, depth: initDepth, headland: initHeadland });
    sdFn = S.fn.gorgeSd;
  }
  if (studio?.uniforms?.uFallsSize) studio.uniforms.uFallsSize.value.set(initScale * initWidth, initScale * initLength);
  if (studio?.uniforms?.uFallsHeadland) studio.uniforms.uFallsHeadland.value = initHeadland;
  /* redo-s5: the drop for every live trough program (GORGE's rock sets it too; set here as well so it is right with ?fallsGorge=0) */
  const dropUniform = studio?.uniforms?.uFallsDrop || { value: 0 };
  const setDrop = shape => { dropUniform.value = +(shape.waterY - shape.poolY).toFixed(4); };
  const split = Q.get('fallsSplit') === '1';
  const endsQ = (Q.get('fallsEnds') || '').split(',').map(Number);
  const initEnds = endsQ.length === 2 && endsQ.every(Number.isFinite) ? endsQ : [10, 170];
  const asOne = shape => split ? shape : oneHorseshoe(shape, { ends: [tune.lipFrom, tune.lipTo] });
  const tune = {
    openingScale: initScale, openingWidth: initWidth, openingLength: initLength, openingDepth: initDepth, headlandLift: initHeadland,
    lipFrom: initEnds[0], lipTo: initEnds[1],
    /* redo-1 look (designer B): one curtain of white columns under a thin teal lip, a big soft plume, a lit teal pool laced with foam */
    /* director 2026-11-24: finer, more strands (columnWidth .2 -> .085, streakScale 3 -> 6), lighter grooves, no ledge breaks, a lighter plume */
    speed: 1, crest: 1.5, cover: .64, gapLight: .24, gapSolid: .92, columnWidth: .085, streakScale: 6.0, relief: .55, footVeil: .50,
    froth: .8, scallop: .012, glassMid: .62, lipBright: 1, ledges: 0,
    soft: 1.0, groove: .05, veil: .40, veilSides: .10, glow: 1.2, shoreHaze: .22, foamSoft: .7,
    mistSides: .10, mist: 1.45, mistHeight: .80, mistReach: .72, mistSoft: .14, mistRise: 1, mistWisp: .10, mistBright: .86, mistPlume: .80, mistBody: .32, mistPuffs: .28, mistPuffBright: 1.08,
    foam: 1.1, light: .45, drift: 1,
    teal: '#2a7878', tealDeep: '#0e3a40', pale: '#93cbc8', poolDeep: '#0d3f4c', poolTeal: '#1d6070', poolPale: '#4f939c', white: '#d9e5e9', shade: '#6b8b99' };
  let rawS = S;                        /* the shape as published (the rock reads this one) */
  setDrop(rawS);
  S = asOne(S);
  let G = prepareFalls(S, sdFn, S.fn?.troughDrop || shapeModule.troughDrop || null);

  const group = new THREE.Group(); group.name = 'Rise falls';   /* renderOrder stays 0: three sorts by the group's order first, and these layers must sit between the view's own */
  const state = { version: 'dir2', shape: S.version || '', curtain: split ? 'split (shape lips)' : 'one horseshoe', stage: 'building', tier: 2, steps: 0, arrival: 0, pour: 0, mist: 0, light: [0, 0, 0, 0], gorge: 'not asked', errors: [] };

  /* FT's rock. It never stops the water. */
  let gorge = null;
  if (Q.get('fallsGorge') !== '0' && ctx.gorge !== false) {
    try {
      const made = ctx.gorgeModule || await import(new URL(GORGE_URL, import.meta.url).href);
      gorge = await made.createFallsGorge(renderer, atlas, studio, rawS);
      if (gorge?.group) group.add(gorge.group);
      state.gorge = gorge ? 'ready' : 'none';
    } catch (error) { gorge = null; state.gorge = 'missing'; state.errors.push('gorge: ' + String(error?.message || error)); console.warn('Rise falls: the gorge (falls-gorge.js) is not there yet; the water comes without it.', error); }
  }

  const noise = makeFallsNoise(renderer), field = fieldTexture(G);
  let flat = null; const flatArrive = () => { flat = new THREE.DataTexture(new Uint8Array([0, 0, 0, 70]), 1, 1, THREE.RGBAFormat); flat.needsUpdate = true; return flat; };
  const shared = {
    THREE, renderer, atlas, studio, G, S, tune, reduced, noise, field,
    uniforms: {
      tNoise: { value: noise }, tField: { value: field },
      uFieldRect: { value: new THREE.Vector4(G.rect[0], G.rect[1], 1 / (G.rect[2] - G.rect[0]), 1 / (G.rect[3] - G.rect[1])) },
      uTime: atlas?.uniforms?.uTime || { value: 0 },
      uSun: atlas?.uniforms?.uSun || { value: new THREE.Vector3(.8066, .4067, -.4289) },
      uSunI: studio?.uniforms?.uSunIntensity || { value: 1.6 },
      uLife: { value: 1 }, uPour: { value: 1 }, uLevels: { value: new THREE.Vector4(S.waterY, S.poolY, G.H, G.throwD) },
      /* the land's own arrival field (the height picture's alpha, packed by studio-highland-ecology.js) and its clock: the water takes its colour
         and starts to fall place by place with the land */
      tArrive: atlas?.uniforms?.tCanopy?.value ? atlas.uniforms.tCanopy : { value: flatArrive() },
      uBounds: atlas?.uniforms?.uBounds || { value: new THREE.Vector4(-7, -3.917, 1 / 14, 1 / 7.834) },
      uArrival: studio?.uniforms?.uArrival || { value: 1 }, uArrivalMap: atlas?.uniforms?.tCanopy?.value && studio?.uniforms?.uArrivalMap ? studio.uniforms.uArrivalMap : { value: 0 }
    }
  };
  const water = Q.get('fallsWater') === '0' ? null : createFallsWater(shared);
  const mist = Q.get('fallsMist') === '0' ? null : createFallsMist(shared);
  if (water) group.add(water.group);
  /* redo-w3: the rock ledges across the fall (shape `ledges`, from GORGE's redo-s2: rim angles from / to in degrees, `at` = share of the drop),
     turned into u along the lip for the curtain; none in the shape = no breaks */
  function ledgesOf(shape, g) {
    const list = Array.isArray(shape?.ledges) ? shape.ledges.slice(0, 4) : [], fn = shape?.fn || {};
    if (!list.length || typeof fn.rimIndex !== 'function') return [];
    const n = shape.outline.length;
    const uAt = deg => { const f = fn.rimIndex(deg); let best = null, bd = Infinity; for (const q of g.feet) { const d = Math.min(Math.abs(q.f - f), Math.abs(q.f - f - n), Math.abs(q.f - f + n)); if (d < bd) { bd = d; best = q; } } return best && bd < 2 ? best.u : null; };
    const H = shape.waterY - shape.poolY;
    return list.map(l => {
      const d0 = Number.isFinite(+l.deg0) ? +l.deg0 : +l.from, d1 = Number.isFinite(+l.deg1) ? +l.deg1 : +l.to;
      const a = uAt(d0), b = uAt(d1); if (a == null || b == null) return null;
      /* where the water lands: the ledge's top, as a share of the drop from the lip (redo-s2 gives its height yTop) */
      /* sliders: where the water lands = the ledge's share of the wall (depthTop) on THIS shape's wall: from the rim's top down to its foot (poolY − .12) */
      let share = +l.at;
      if (Number.isFinite(+l.depthTop)) { const top = typeof fn.rimY === 'function' ? +fn.rimY((d0 + d1) / 2) : shape.waterY, foot = shape.poolY - .12; share = (shape.waterY - (top - (top - foot) * +l.depthTop)) / H; }
      else if (Number.isFinite(+l.yTop)) share = (shape.waterY - +l.yTop) / H;
      /* the curtain's profile place is the square root of the share of the drop (it falls as a parabola: drop = H·k²) */
      return { u0: Math.min(a, b), u1: Math.max(a, b), at: Math.sqrt(clamp(Number.isFinite(share) ? share : .3, .02, .9)), out: clamp(Number.isFinite(+l.out) ? +l.out : .2, 0, .5),
        k: clamp(Number.isFinite(+l.k) ? +l.k : 1) * clamp(Number.isFinite(+tune.ledges) ? +tune.ledges : 1) }; }).filter(Boolean);
  }
  const applyLedges = () => { if (!water) return; const L = Q.get('fallsLedges') === '0' ? [] : ledgesOf(rawS, G); water.setLedges(L); state.ledges = L.map(l => [+l.u0.toFixed(2), +l.u1.toFixed(2), +l.at.toFixed(3), l.out, +l.k.toFixed(2)]); };
  if (mist) group.add(mist.group);

  /* ---------------- the rivers' light: ends at the lip, runs down the curtain, gathers in the pool ---------------- */
  const lightOn = Q.get('fallsLight') !== '0';
  const lights = [0, 1, 2, 3].map(() => ({ u: -1e4, foot: null, k: 0, on: false, line: -1, stop: 0 }));
  let beams = null;
  function nearestLip(x, z) { let best = null, bd = Infinity; for (const q of G.feet) { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } } return bd < .35 && best.end > .2 ? best : null; }
  /* a river that meets the rim on a dry side wall (ft-v4: the right and left rivers run along the wall top to the curtain's ends): its light
     comes down the curtain at its own lip, at the end nearest where its line stops */
  function lipOfRiver(name, x, z) { if (!name) return null; let best = null, bd = Infinity; for (const q of G.feet) { if (q.river !== name || q.end < .6) continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } } return best; }
  function bindBeams(made) {
    beams = made || null;
    if (!beams || !beams.lines || !beams.uniforms?.uStops) return;
    try {
      beams.setLogoOutline([S.outline]);                       /* the trunks stop at the rim; the old meeting glow at the lake's centre rests */
      const stops = beams.uniforms.uStops.value, o = G.outlet;
      beams.lines.forEach((L, li) => {
        const hit = firstCrossing(L.pts, L.cum, S.outline);
        let stop = hit ? hit.s : 0;
        const isTrunk = L.kind < .5;
        if (isTrunk && o && atlas?.rivers?.[L.k]?.name === o.river) {
          /* the fourth river: its light follows the water down the trough to the rim (lowerIntoTrough below), the cascade carries it on */
          lights[L.k].u = -500; lights[L.k].foot = o.mouth; lights[L.k].on = true; lights[L.k].line = li; lights[L.k].stop = stop || L.L;
        } else if (isTrunk && hit) {
          const q = nearestLip(hit.x, hit.z) || lipOfRiver(atlas?.rivers?.[L.k]?.name, hit.x, hit.z);
          if (q && L.k >= 0 && L.k < 4) { lights[L.k].u = q.u; lights[L.k].foot = [q.fx, q.fz]; lights[L.k].on = true; lights[L.k].line = li; lights[L.k].stop = stop; }
        }
        if (stop > 0) stops[li] = stop;
      });
      state.lightLines = lights.map(l => l.on ? +l.u.toFixed(2) : null);
    } catch (error) { state.errors.push('beams: ' + String(error?.message || error)); console.warn('Rise falls: light lines not bound', error); }
    water?.setLights(lights);
  }
  /* without the beams (or before they are bound): the lips' own rivers, lit at once */
  function defaultLights() {
    const names = (atlas?.rivers || []).map(r => r.name);
    for (const C of G.chains) for (const L of C.lips) {
      if (!L.river) continue; const k = names.indexOf(L.river); if (k < 0 || k > 3) continue;
      const mid = C.samples.filter(q => q.f >= L.a && q.f <= L.b); const q = mid[Math.floor(mid.length / 2)]; if (!q) continue;
      lights[k].u = q.u; lights[k].foot = [q.fx, q.fz]; lights[k].on = true;
    }
    if (G.outlet) { const k = names.indexOf(G.outlet.river); if (k >= 0 && k < 4) { lights[k].u = -500; lights[k].foot = G.outlet.mouth; lights[k].on = true; } }
    water?.setLights(lights);
  }
  if (ctx.beams) bindBeams(ctx.beams); else defaultLights();

  /* the fourth river runs its last stretch in a trough that FT lowers in the land (falls-shape.js TROUGH_GLSL). The light line and the flow marks
     are drawn at the old water level by their own modules: here their vertex programs get the same lowering (before the view's programs are
     compiled, so nothing is compiled twice). An anchor that is not found leaves that module exactly as it is. */
  function lowerIntoTrough(material, anchor, lowered, what) {
    const glsl = shapeModule.LIVE_TROUGH_GLSL || shapeModule.TROUGH_GLSL;
    if (!material || !glsl || material.userData.fallsTrough) return;
    const src = material.vertexShader;
    if (!src.includes(anchor) || !src.includes('void main(){')) { state.errors.push('trough: ' + what + ' not lowered (its program changed)'); return; }
    const uDecl = shapeModule.LIVE_TROUGH_GLSL ? 'uniform vec2 uFallsSize;\n' : '';
    if (shapeModule.LIVE_TROUGH_GLSL && material.uniforms) {
      material.uniforms.uFallsSize = studio?.uniforms?.uFallsSize || { value: new THREE.Vector2(1, 1) };
      material.uniforms.uFallsDrop = studio?.uniforms?.uFallsDrop || dropUniform;   /* redo-s5: the troughs' lowering follows the depth slider */
    }
    material.vertexShader = src.replace('void main(){', uDecl + glsl + '\n  void main(){').replace(anchor, lowered);
    material.userData.fallsTrough = true; material.needsUpdate = true;
    (state.trough ||= []).push(what);
  }
  lowerIntoTrough(ctx.beams?.group?.children?.[0]?.material, 'p.y+=uLift;', 'p.y+=uLift-fallsTrough(p.xz);', 'light lines');
  lowerIntoTrough(ctx.flow?.group?.children?.[0]?.material, 'p.y=0.105+uLift;', 'p.y=0.105+uLift-fallsTrough(p.xz);', 'flow marks');

  /* the old lake's flow marks (flow2-scene-flow.js): nothing is drawn over the hole (their triangles there are emptied in place) */
  function cutFlow(flow) {
    try {
      const geo = flow?.group?.children?.[0]?.geometry, pos = geo?.attributes?.position, index = geo?.index; if (!pos || !index) return;
      /* sliders: the rim moves, so the cut is redone from the untouched index each time */
      if (!geo.userData.fallsIndex0) geo.userData.fallsIndex0 = index.array.slice(); else index.array.set(geo.userData.fallsIndex0);
      const gone = new Uint8Array(pos.count);
      for (let i = 0; i < pos.count; i++) if (sdFn(pos.getX(i), pos.getZ(i)) < .03) gone[i] = 1;
      const a = index.array; let cut = 0;
      for (let i = 0; i < a.length; i += 3) if (gone[a[i]] || gone[a[i + 1]] || gone[a[i + 2]]) { a[i + 1] = a[i]; a[i + 2] = a[i]; cut++; }
      index.needsUpdate = true; state.flowCut = cut;
    } catch (error) { state.errors.push('flow: ' + String(error?.message || error)); }
  }
  if (ctx.flow) cutFlow(ctx.flow);

  /* ---------------- tiers ---------------- */
  const phone = (() => { try { return matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 900; } catch (error) { return false; } })();
  const askedSteps = parseInt(Q.get('fallsSteps') || '', 10);
  function applyTier() {
    const q = typeof window !== 'undefined' ? window.__FLOW2_QUALITY__ : null;
    let rank = q && Number.isFinite(+q.rank) ? +q.rank : 2; if (phone) rank = Math.min(rank, 1);
    if (rank === state.tier && state.steps) return;
    state.tier = rank;
    state.steps = Number.isFinite(askedSteps) ? clamp(askedSteps, 3, 12) : rank >= 2 ? 10 : rank === 1 ? 6 : 4;
    mist?.setQuality({ steps: state.steps, lit: rank >= 2 });
    water?.setQuality({ rank });
  }

  /* ---------------- the entrance, the clock ---------------- */
  /* when the land's colour reaches the nearest and the farthest part of the lips (arrival 0..1), read from the same field on the CPU */
  const RIM_AT = (() => {
    try {
      const img = atlas?.uniforms?.tCanopy?.value?.image, b = atlas?.uniforms?.uBounds?.value;
      if (!img?.data || !b || !(studio?.uniforms?.uArrivalMap?.value > .5)) throw 0;
      let lo = Infinity, hi = -Infinity;
      for (const q of G.feet) { const u = clamp((q.x - b.x) * b.z), v = clamp((q.z - b.y) * b.w), f = img.data[(Math.min(img.height - 1, Math.floor(v * img.height)) * img.width + Math.min(img.width - 1, Math.floor(u * img.width))) * 4 + 3] / 255; lo = Math.min(lo, f); hi = Math.max(hi, f); }
      if (!Number.isFinite(lo)) throw 0;
      return [clamp(lo / 1.36, .05, .8), clamp(hi / 1.36, .1, .85)];
    } catch (error) { return [.30, .34]; }
  })();
  state.rimAt = RIM_AT.map(v => +v.toFixed(3));
  let arrival = 1, lightClock = 0;
  const lifeOf = k => smooth(0, .11, k * 1.36 - .27);          /* as the land's colour arrives at the lake (studio-highland-ecology.js) */
  function setArrival(k) {
    arrival = clamp(+k || 0);
    state.arrival = +arrival.toFixed(3);
    const life = reduced ? 1 : lifeOf(arrival);
    /* the curtain itself follows the land's colour front along the rim (falls-water.js fallsLead: it starts where the colour first reaches the
       rim and sweeps round); these two are the pool's foam (once the first water has landed) and the cloud (once most of it has) */
    const pour = reduced ? 1 : smooth(Math.min(.78, RIM_AT[0] + .15), Math.min(.96, RIM_AT[1] + .20), arrival);
    const air = reduced ? 1 : smooth(Math.min(.82, RIM_AT[0] + .20), Math.min(.985, RIM_AT[1] + .34), arrival);
    shared.uniforms.uLife.value = life; shared.uniforms.uPour.value = pour;
    state.pour = +pour.toFixed(3); state.mist = +air.toFixed(3);
    mist?.setAmount(air);
    try { gorge?.setArrival?.(arrival); } catch (error) { }
  }
  function update(frame = {}) {
    applyTier();
    const dt = Math.min(Math.max(+frame.dt || 0, 0), .05);
    const lattice = atlas?.uniforms?.uLattice?.value > .35;      /* the 3D-lines version of the view (?after=lines): no water drawn */
    if (water) water.group.visible = !lattice;
    if (mist) mist.group.visible = !lattice;                     /* stays in the scene while its amount is 0, so its program is compiled with the view's */
    /* each river's light comes down the curtain once its line has reached the lip */
    for (let k = 0; k < 4; k++) {
      const L = lights[k]; let want = 0;
      if (L.on && lightOn) {
        if (beams && L.line >= 0) { const head = beams.heads?.[L.line] ?? 0; want = beams.group?.visible !== false && head >= L.stop - .04 ? 1 : 0; }
        else want = arrival > .8 ? 1 : 0;
      }
      L.k = reduced ? want : L.k + (want - L.k) * (1 - Math.exp(-dt * (want > L.k ? 1.6 : 5)));
      state.light[k] = +L.k.toFixed(3);
    }
    lightClock += dt;
    const dive = Math.min(1, Math.max(0, +(atlas?.zoom || 0), +(typeof window !== 'undefined' && window.__FLOW2_LAKE_DIVE__?.state?.t) || 0));
    water?.update(frame, { lights, dive, camera: frame.camera || atlas?.camera });
    mist?.update(frame, { dive, camera: frame.camera || atlas?.camera });
    try { gorge?.update?.(frame); } catch (error) { }
  }

  const diveTarget = new THREE.Vector3(S.centre[0], S.poolY, S.centre[1]);
  const geomKeyOf = () => [
    clamp(+tune.openingScale || DEF.scale, .55, 1.40).toFixed(3),
    clamp(+tune.openingWidth || DEF.width, .60, 1.40).toFixed(3),
    clamp(+tune.openingLength || DEF.length, .60, 1.40).toFixed(3),
    clamp(+tune.openingDepth || defDepth, .40, 2.40).toFixed(3),
    clamp(Number.isFinite(+tune.headlandLift) ? +tune.headlandLift : 1, 0, 1.80).toFixed(3),
    (+tune.lipFrom || 0).toFixed(1), (+tune.lipTo || 0).toFixed(1)
  ].join('|');
  let lastGeomKey = geomKeyOf();
  function rebuildOpening() {
    const scale = clamp(+tune.openingScale || DEF.scale, .55, 1.40);
    const width = clamp(+tune.openingWidth || DEF.width, .60, 1.40);
    const length = clamp(+tune.openingLength || DEF.length, .60, 1.40);
    const depth = clamp(+tune.openingDepth || defDepth, .40, 2.40);
    const headland = clamp(Number.isFinite(+tune.headlandLift) ? +tune.headlandLift : 1, 0, 1.80);
    if (studio?.uniforms?.uFallsSize) studio.uniforms.uFallsSize.value.set(scale * width, scale * length);
    if (studio?.uniforms?.uFallsHeadland) studio.uniforms.uFallsHeadland.value = headland;
    const shapeMoved = !isDefault(scale, width, length, depth, headland);
    const before = rawS;
    if (typeof shapeModule.buildFallsShape === 'function' && (shapeMoved || rawS !== shapeModule.FALLS_SHAPE)) rawS = shapeMoved ? shapeModule.buildFallsShape({ scale, width, length, depth, headland }) : shapeModule.FALLS_SHAPE;
    sdFn = rawS.fn?.gorgeSd || shapeModule.gorgeSd;
    S = asOne(rawS);
    G = prepareFalls(S, sdFn, rawS.fn?.troughDrop || shapeModule.troughDrop || null);
    shared.S = S; shared.G = G;
    api.shape = S; api.prepared = G;
    /* update the 128x128 field DataTexture in-place (zero GPU allocation) */
    const half = field.image.data;
    for (let i = 0; i < half.length; i++) half[i] = THREE.DataUtils.toHalfFloat(clamp(G.field[i], -60000, 60000));
    field.needsUpdate = true;
    shared.uniforms.uFieldRect.value.set(G.rect[0], G.rect[1], 1 / (G.rect[2] - G.rect[0]), 1 / (G.rect[3] - G.rect[1]));
    shared.uniforms.uLevels.value.set(S.waterY, S.poolY, G.H, G.throwD);
    diveTarget.set(S.centre[0], S.poolY, S.centre[1]);
    setDrop(rawS);
    if (rawS !== before) gorge?.rebuild?.(rawS);
    water?.rebuild?.(G, S);
    mist?.rebuild?.(G, S);
    if (beams) bindBeams(beams); else defaultLights();
    if (ctx.flow) cutFlow(ctx.flow);
    state.opening = { scale, width, length, depth, headland, shape: rawS.params ? 'built' : 'base' };
  }
  const api = {
    group, state, tune, shape: S, prepared: G, water, mist, gorge, diveTarget,
    update, setArrival, bindBeams, cutFlow, rebuildOpening,
    apply() {
      const k = geomKeyOf();
      if (k !== lastGeomKey) { lastGeomKey = k; rebuildOpening(); }
      water?.apply(); mist?.apply(); applyLedges();
    },
    stats() { return { water: water?.stats() || null, mist: mist?.stats() || null, textures: { noise: '128x128 RGBA8 + mips (87 KB)', field: '128x128 RGBA16F (128 KB)' } }; },
    dispose() {
      try { gorge?.dispose?.(); } catch (error) { }
      water?.dispose(); mist?.dispose(); noise.dispose(); field.dispose(); flat?.dispose(); group.removeFromParent();
      if (typeof window !== 'undefined' && window.__RISE_FALLS__ === api) delete window.__RISE_FALLS__;
    }
  };
  /* the client's dials (flow2-panel.js; the tab 「瀑布與水霧」, key W). Saved values are applied by the panel when it registers. */
  try {
    if (typeof window !== 'undefined') window.__FLOW2_PANEL__?.add({ id: 'rise-falls', storageId: 'rise-falls-dir2', title: '瀑布與水霧', key: 'w', tune, rows: [
      ['— 峽谷開口 —'], ['開口大小', 'openingScale', .55, 1.40, .01], ['左右寬度', 'openingWidth', .60, 1.40, .01], ['前後長度', 'openingLength', .60, 1.40, .01], ['峽谷深度', 'openingDepth', .40, 2.40, .02], ['岩岬高度', 'headlandLift', 0, 1.80, .05],
      ['— 瀑布水幕 —'], ['水幕右端（角度）', 'lipFrom', -10, 60, 1], ['水幕左端（角度）', 'lipTo', 120, 190, 1],
      ['水流速度', 'speed', 0, 2.5, .01], ['頂端透綠水層（越大越長）', 'crest', .3, 2.5, .01], ['白色水絲多寡', 'cover', 0, 1, .01],
      ['水柱寬度', 'columnWidth', .06, .40, .005], ['細水絲密度', 'streakScale', 1.5, 9, .1], ['水柱立體感', 'relief', 0, 2, .01], ['底部水霧遮蓋', 'footVeil', 0, 1, .01],
      ['白色泡沫（水柱、崖頂、岩階）', 'froth', 0, 2, .01], ['崖頂扇貝形起伏', 'scallop', 0, .09, .001], ['中段透綠水色', 'glassMid', 0, 2, .01], ['崖邊亮帶', 'lipBright', 0, 2, .01], ['岩階斷水', 'ledges', 0, 1, .01],
      ['— 柔和 —'], ['整體柔焦（越大越柔）', 'soft', 0, 3, .05], ['水柱間暗縫', 'groove', 0, .5, .01], ['下半部水霧紗', 'veil', 0, 1.2, .01], ['水霧紗（兩側）', 'veilSides', 0, 1, .01], ['白水微光', 'glow', 0, 3, .01], ['潭邊霧化', 'shoreHaze', 0, 1.2, .01], ['白沫成片（0 細線…1 成片）', 'foamSoft', 0, 1, .01],
      ['水絲之間的明暗', 'gapLight', 0, 1, .01], ['水絲之間的濃度（低＝透出岩壁）', 'gapSolid', 0, 1, .01],
      ['頂端水色', 'teal', 'color'], ['頂端深水色', 'tealDeep', 'color'], ['頂端亮部', 'pale', 'color'], ['白水', 'white', 'color'], ['白水陰影', 'shade', 'color'],
      ['— 瀑布下的水潭 —'], ['白沫', 'foam', 0, 2, .01], ['白沫漂移', 'drift', 0, 3, .01], ['水潭深色', 'poolDeep', 'color'], ['水潭水色', 'poolTeal', 'color'], ['水潭淺色', 'poolPale', 'color'],
      ['— 水霧 —'], ['水霧濃度', 'mist', 0, 2.5, .01], ['水霧高度', 'mistHeight', .4, 2.5, .01], ['水霧範圍', 'mistReach', .4, 2.5, .01], ['水霧邊緣的柔和（低＝雲團起伏）', 'mistSoft', 0, .6, .01], ['水霧上升速度', 'mistRise', 0, 3, .01],
      ['中央水霧團', 'mistBody', 0, 2, .01], ['瀑布兩側水霧', 'mistSides', 0, 1, .01], ['翻騰霧團（濃度）', 'mistPuffs', 0, 1.5, .01], ['翻騰霧團（亮度）', 'mistPuffBright', .4, 1.4, .01], ['飄出崖頂的薄霧', 'mistWisp', 0, 1, .01], ['水霧亮度', 'mistBright', .4, 1.2, .01], ['水霧中央高度', 'mistPlume', 0, 2, .01],
      ['— 河流光 —'], ['瀑布與水潭上的河流光', 'light', 0, 2, .01]
    ], onChange() { api.apply(); } });
  } catch (error) { state.errors.push('panel: ' + String(error?.message || error)); }
  applyTier(); setArrival(reduced ? 1 : 0); api.apply();
  state.stage = 'ready';
  if (typeof window !== 'undefined') window.__RISE_FALLS__ = api;
  return api;
}
