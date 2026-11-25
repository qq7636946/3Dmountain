/* Drop gorge · transition A, THROUGH THE SURFACE (Team DIVE, 2026-11-17 evening). index1-5-canyon-forest.html, desktop only.
   Client: transition A chosen 17:44 (the lens follows the drop THROUGH the water surface in one continuous shot, not the water line pushed up
   the screen), then 「https://organimo.com/ 水下轉場參考這個」. organimo's moment: one scroll and the lens drops through the surface — for a
   moment the screen is split by the meniscus (above: the air world; below: the underside of the surface, bright stretched ripple streaks over
   coloured water), then the bright rippling surface hangs overhead. Our blue, our canyon, our drop.

   PHASE 2 (2026-11-17 night; client 「轉場部分還要再跟絲滑 注意上方的網址作法」 and 「下去後怎麼變完全不同情境」) — organimo's way, WHERE THE
   VISITOR IS. One notch past the hold TRIGGERS a timed take-over (1.2 s, ?diveTime=) that plays on its own; input meanwhile is queued, not
   stacked (one notch on carries into the gorge, one back plays it back); one notch up at the hand-over frame plays it backwards the same way.
   The controller's g runs 0 → 500 linearly in time; each channel has its own ease (timeline share tl):
     tl .00 → .10  the drop hangs a moment (lifts 0.3 m); its lead had already slowed to 26 m on the way to the hold (never back);
     tl .08 → .48  it falls FORWARD and down in an accelerating arc (≈ 0.45 s), 5 m further ahead, a little stretch as it goes in (≈ tl .37);
     tl .37 → .92  a ring spreads on the water where it went in, a small crown of splash drops (.37 → .58);
     tl .30 → .56  the canyon lens sinks STRAIGHT DOWN to 0.12 m over the water (scrubbed by the scroll since phase 3) — same yaw, same pitch, same framing (CAPITAL FLOWS FORWARD);
                   nothing new of the canyon comes into view (phase 1's forward glide was removed: it reached places never dressed);
     tl .42 → .72  ONE level water line sweeps the screen bottom → top (≈ 0.36 s): above it the canyon, the water climbing the lens just above
                   the line; under it DEEP's underwater picture with a band of bright stretched ripples (the surface's underside) and bubbles;
     tl .50 → 1    the gorge lens settles from just under the surface to DEEP's hand-over depth (2.8 m) — the hand-over frame, g = 500.
   (Phase 1's scroll-scrubbed version: before/phase2/dg-dive.js.)
   The canyon camera is moved ONLY for the canyon's own renders of that frame (the first render with that camera applies the move, a
   microtask after the frame restores it): main.js's camera state is never changed, nothing accumulates. Nothing moves by itself except
   living water (the line's waves, the streaks, the bubbles' rise; all still under "reduce motion").
   Cost: two full-screen passes only while they show (canyon side: the meniscus band + lens drops, early-out under the line; gorge side: the
   streaks + bubbles, early-out above the line), one ring quad, 14 points. Compiled before the section shows.
   Switches: ?dive=old = today's water line (this file is not loaded) · ?diveTime=1.2 · ?diveGpu=1 GPU timer of the gorge-side overlay ·
   live: window.__FLOW2_GORGE__.dive() → { tune, stats(), freeze(ms) (QA: hold the take-over) }. */
import * as THREE from 'three';
import { lensDrops as DROPS, lensSplashGLSL } from './lens-splash.js';

const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* the meniscus line: the SAME formula as the gorge's mode-1 branch (dg-scene.js), so the two canvases meet exactly */
const LINE_GLSL = /* glsl */`
float lineD(vec2 uv, float asp, vec4 L){
  float x = uv.x * asp;
  float wv = L.y * (sin(x * 6.0 + L.z) * 0.6 + sin(x * 15.0 - L.z * 1.7) * 0.28 + sin(x * 37.0 + L.z * 0.6) * 0.12);
  return (L.x + wv) - uv.y;   /* > 0 under the water */
}`;

function noiseTex(THREE3, size = 128, seed = 5) {
  let s = seed >>> 0; const R = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const oct = [[6, .55], [12, .3], [24, .15]].map(([n, w]) => ({ n, w, v: Float32Array.from({ length: n * n }, R) }));
  const d = new Uint8Array(size * size * 4), sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    for (const o of oct) {
      const fx = x / size * o.n, fy = y / size * o.n, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const at = (i, j) => o.v[(j % o.n) * o.n + (i % o.n)];
      v += o.w * ((at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty);
    }
    const k = (y * size + x) * 4, b = Math.round(clamp01(v) * 255); d[k] = d[k + 1] = d[k + 2] = b; d[k + 3] = 255;
  }
  const t = new THREE3.DataTexture(d, size, size, THREE3.RGBAFormat);
  t.wrapS = t.wrapT = THREE3.RepeatWrapping; t.magFilter = THREE3.LinearFilter; t.minFilter = THREE3.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
function bigTriangle(THREE3) {
  const g = new THREE3.BufferGeometry();
  g.setAttribute('position', new THREE3.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return g;
}

export async function createDive(o) {
  const { gorge, T, S, Q } = o;
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const DT = {
    /* PHASE 2 (client 「轉場部分還要再跟絲滑 注意上方的網址作法」 + 「下去後怎麼變完全不同情境」): organimo's way — ONE notch past the hold
       TRIGGERS a timed, eased take-over that plays on its own (input meanwhile queued, not stacked) and plays back the same way; the crossing
       happens WHERE THE VISITOR IS: same framing (CAPITAL FLOWS FORWARD), the drop is brought back toward the lens and dives there, the lens
       only sinks straight down (same yaw and pitch), one level water line sweeps the screen bottom → top. Shares below are of the
       timeline tl (0 → 1, linear in time; each channel has its own ease). */
    pre: num('divePre', 330),         // controller g of the take-over (g 0 → pre + today's entry = the hand-over frame, g = T.entry)
    dur: num('diveTime', 1.2),        // seconds, both ways
    /* PHASE 5 fix (client 「水滴下去怎會往後下去」): the drop NEVER moves toward the lens. Its lead slows to 26 m while the visitor scrolls
       up to the hold (pull, journey-driven); in the take-over it hangs a moment (a small lift, tl 0 → .1), then falls FORWARD and down in
       an accelerating arc (tl .08 → .42 ≈ 0.4 s, gravity-like ease-in, 5 m further ahead), a little stretch on entry (≈ tl .33). */
    pullBefore: 0.5,                  // journey units before the hold over which its lead slows (36 → 26 m)
    lift: 0.3, hang: [0.0, 0.1],      // metres it lifts / hangs before the fall
    fall: [0.08, 0.48], ahead: 5,     // the fall (tl) and how far it carries on ahead while falling (m)
    ring: [0.37, 0.92], crown: [0.37, 0.58],   // where it goes in
    sink: [0.36, 0.7],                  // the canyon lens sinks straight down to eyeEnd over the water
    sweep: [0.42, 0.72],              // the water line sweeps the screen (≈ 0.38 s at 1.2 s)
    settle: [0.5, 1.0],               // the gorge lens settles from just under the surface to DEEP's hand-over depth (2.8 m)
    bubbles: [0.42, 1.0],
    streakOut: [0.78, 1.0],
    currentsOut: [0.04, 0.3],         // the river's blue currents fade while the lens sinks (they would stand above the horizon)
    eyeEnd: 0.5,                      // metres over the water where the canyon lens ends (lower, the river's own waves rise over the lens: they read as dark bands)
    wave: 0.006, bandW: 0.035,        // one level line: slight waviness; the water climbing the lens just above it
    streak: num('diveStreak', 0.5), streakW: 0.2, bubble: num('diveBubble', 0.5), ring: 1, drops: num('diveDrops', 1),   /* the lens splash (client: 「不要刪掉」) */
    dropLow: 0.3                      // how far under the screen centre the gorge's drop starts (share of the screen height)
  };
  /* OCEAN (Team CROSS, 2026-11-18; client: the crossing as in the "OCEAN" recording, 7.0 → 8.5 s): ?ocean=1 only. The look and the
     video's timing live in ocean-cross/oc-look.js (loaded only with the switch); without it nothing below changes. */
  let OC = null, ocEnd = null, ocCeil = 0.35, ocCeilT = 0, ocClr = 0;
  /* PASS 8 (client 11-18: 「水下去的中間過程這段不需要 跟原本一樣就好」): with ?ocean=1 the crossing is the ORIGINAL one (the code below, untouched);
     the ocean crossing of passes 1–6 is kept only behind ?ocean=1&oceanCross=1. s.ceil / s.sunX are then not passed: CEIL's ceiling is at its full value. */
  if (Q.get('ocean') !== '0' && Q.get('oceanCross') === '1') {   /* OCEAN DEFAULT (CEIL pass 7): on unless ?ocean=0 */
    try { OC = (await import(new URL('./ocean-cross/oc-look.js?v=5', import.meta.url).href)).createOcean({ num }); Object.assign(DT, OC.timeline()); }
    catch (error) { OC = null; console.warn('[dive] ocean look: ' + (error?.message || error)); }
  }
  const base = { entry: T.entry, travel: T.travel, beats: T.beats.map(b => b.slice()), values: T.values ? T.values.slice() : null, canyonLift: T.canyonLift, depthTravel: T.depthTravel || 1100 };
  /* PASS 8b (client 11-18: 「水下高度不用那麼高，水下高度約150vh的高度即可」): with ?ocean=1 the under-water part is shorter on the wheel — 700 px from the
     end of the take-over to the seabed (was 930), then the usual 70 px to hand over. The stations' ranges below are derived from the depths and
     this length, so every beat keeps its share. Dial: ?ocTravel= (base units, default 870; 1100 = as before). */
  if (Q.get('ocean') !== '0') base.travel = Math.max(520, num('ocTravel', 1100));   /* 2026-11-18 night, client 「水下高度大概1100px就好了」 (was 1040) */   /* lead 11-18: the client's 「約150vh」 taken literally = 1040 (≈ 1.5 window heights at 1836×762); CROSS's 870 ≈ 1.18 */
  const ST = { g: 0, k: 0, tl: 0, line: [-1, 0, 0, 0], E: null, camApplied: 0, canyonLayer: 'waiting', gpu: [], notes: [], frames: 0, tweens: 0 };
  const api = { tune: DT, state: ST, ocean: OC };
  const live = () => S.state === 'gorge';
  const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const tlOf = g => clamp01(g / T.entry);
  const ch = (r, tl) => easeInOut(clamp01((tl - r[0]) / (r[1] - r[0])));   /* one channel, eased in and out */

  /* ---------------------------------------------------------------- the controller's numbers (installed on the gorge's live tune) */
  function install() {
    T.entry = base.entry + DT.pre; T.travel = base.travel + DT.pre;
    T.beats = base.beats.map(b => b.map(v => (v >= 1e8 ? v : v + DT.pre))); T.canyonLift = 0;
    if (base.values) T.values = base.values.map(v => (v >= 1e8 ? v : v + DT.pre));
  }
  function uninstall() { T.entry = base.entry; T.travel = base.travel; T.beats = base.beats.map(b => b.slice()); if (base.values) T.values = base.values.slice(); T.canyonLift = base.canyonLift; }
  install();
  /* the gorge lens's share of its descent: during the take-over it settles (eased) to DEEP's hand-over depth, then today's mapping shifted by X */
  const handU = base.entry / base.depthTravel;
  api.u = g => g < T.entry ? handU * (1 - Math.pow(1 - clamp01((tlOf(g) - DT.settle[0]) / (DT.settle[1] - DT.settle[0])), 3)) : (api.lane ? handU : Math.min(1, (g - DT.pre) / base.depthTravel));   /* PHASE 3: the lane stays at the hand-over depth */
  api.line = (g, time, alive) => {
    const tl = tlOf(g); ST.g = g; ST.k = tl; ST.tl = tl;
    if (OC) {   /* OCEAN: a level seam under the tilted, rolling edge (oc-look.js); the video's climb */
      if (tl >= 1) { if (ocEnd == null) ocEnd = time; } else ocEnd = null;   /* the clock after the take-over: my water clears, CEIL's ceiling comes in */
      const post = ocEnd == null ? 0 : Math.max(0, time - ocEnd);
      const s = OC.state(tl, time, alive, post, innerWidth / Math.max(1, innerHeight)); ST.oc = s; ST.line = s.line; ST.c = s.c;
      { const dt0 = Math.min(0.1, Math.max(0, time - ocCeilT)); ocClr = s.k[1] >= ocClr ? s.k[1] : Math.max(s.k[1], ocClr - dt0 / 0.12); s.k[1] = ocClr; }   /* on the way back my water comes over in ≈ 0.1 s, not in one frame */
      { const want = OC.ceilAt(post), dt = Math.min(0.1, Math.max(0, time - ocCeilT)); ocCeilT = time; ocCeil += Math.max(-2.5 * dt, Math.min(2.5 * dt, want - ocCeil)); }
      return { y: s.seam, line: ST.line, dropY: -DT.dropLow * (1 - ch([DT.sweep[0] + 0.1, 1.0], tl)), hidden: s.c <= 0 && S.state === 'gorge' };
    }
    const c = ch(DT.sweep, tl);
    const y = -0.06 + 1.2 * c;
    const amp = DT.wave * (1 - smooth(0.9, 1, c));
    const ph = c * 3.0 + (alive ? time * 0.8 : 0);
    const lip = 1 - smooth(0.92, 1, c);
    ST.line = [y, amp, ph, lip]; ST.c = c;
    /* the gorge's drop stays under the rising line (it went in there) and floats up to its place by the hand-over */
    const dropY = -DT.dropLow * (1 - ch([DT.sweep[0] + 0.1, 1.0], tl));
    return { y, line: ST.line, dropY, hidden: c <= 0 && S.state === 'gorge' };   /* hidden: the line is still under the screen */
  };

  /* ---------------------------------------------------------------- the take-over clock: a notch triggers it, it plays on its own */
  let TW = null;
  const nowMs = () => performance.now();
  function startTween(dir) {
    const target = dir > 0 ? T.entry : 0, dist = Math.abs(target - S.g);
    TW = { dir, t0: nowMs(), g0: S.g, target, ms: Math.max(120, DT.dur * 1000 * dist / T.entry), q: 0 }; ST.tweens++;
  }
  api.busy = () => !!TW;
  let FZ = null; api.freeze = ms => { FZ = ms == null ? null : +ms; };   /* QA: hold the take-over at ms after its start (frame strips) */
  /* the hand: true = this file took the input (the controller does nothing else with it) */
  /* PHASE 4 correction (client 「水下去的那邊 也是直接跳一cup就好 取消自由滾動」): back to phase 2 — one notch triggers the take-over and it
     plays on its own (input queued, not stacked; one notch back plays it back). The lens splash plays inside it as the line passes. */
  api.push = px => {
    if (!live() || !px) return false;
    if (TW) { TW.q = Math.sign(px); return true; }             /* queued, not stacked */
    const D = T.entry;
    if (px > 0 && S.g < D - 0.5) { startTween(1); return true; }
    if (px < 0 && S.g <= D + 0.5) { startTween(-1); return true; }
    if (px < 0 && S.gT + px < D) { S.gT = D; return true; }   /* glide back to the hand-over frame; the next notch up plays it back */
    return false;
  };
  api.tick = () => {
    if (!TW) return false;
    if (!live()) { TW = null; return false; }
    const p = clamp01((FZ != null ? FZ : nowMs() - TW.t0) / TW.ms);
    S.g = S.gT = TW.g0 + (TW.target - TW.g0) * p;
    if (p >= 1 && FZ == null) {
      const { dir, q } = TW; TW = null;
      if (dir < 0) { if (q > 0) startTween(1); else o.back(); }
      else if (q < 0) startTween(-1);
      else if (q > 0) S.gT = Math.min(T.travel, S.g + 100);       /* one queued notch carries on down */
    }
    return true;
  };

  /* ---------------------------------------------------------------- PHASE 3: first person, forward along the lane (DEEP's contract, STATUS-DEEP)
     DEEP's scene exports scene.lane = { len, sand, eye, x(z), floor(x, z), stations: [{ name, z, side, anchor }] } (numbers read, not copied).
     After the crossing the lens DOLLIES FORWARD along −z with the scroll (the controller's own glide = the damping): it sinks from the
     hand-over depth to eye height over the sand during the first 8 m, then follows the lane's centre line x(z) at eye height, looking ahead
     along it; it slows round each hold point (the lens 9.5 m before a station's z: the texts hold while centred) and starts gently out of
     the crossing. Stations (texts, DOM) are anchored at their station z: the block scales about the vanishing point by hold / distance
     (in from afar, held, passing out). The last 140 px open the centre circle (scrubbed). Without scene.lane: today's descent (no dolly). */
  const L0 = gorge.lane && Array.isArray(gorge.lane.stations) && gorge.lane.stations.length >= 4 ? gorge.lane : null;
  const laneOn = !!L0 && Q.get('lane') === '1';   /* PHASE 4: the client 「水滴先不要第一人稱好了」 — the lane only with ?lane=1 */
  api.lane = laneOn;
  const LN = { holdBack: 9.5, circlePx: 140, dwell: 2.4, dwellW: 5, start: 1.6, sinkM: 8, sway: 0.12 };
  let ST4 = [], zEnd = -1, zOpen = -1;
  const NT = 512, zs = new Float32Array(NT + 1), cs = new Float32Array(NT + 1);
  if (laneOn) {
    const byName = n => L0.stations.find(x => x.name === n);
    ST4 = ['insight', 'discipline', 'strategies', 'values'].map((n, i) => byName(n) || L0.stations[i]);
    const open = byName('open') || L0.stations[L0.stations.length - 1];
    zOpen = open.z; zEnd = Math.max(zOpen + 12, ST4[3].z + LN.holdBack - 10);   /* the dolly ends a little past the values hold */
    const holds = ST4.map(x => x.z + LN.holdBack);
    let c = 0;
    for (let i = 0; i <= NT; i++) { const z = zEnd * i / NT; zs[i] = z;
      let w = 1 + LN.start * Math.exp(-Math.pow(z / 7, 2)); for (const h of holds) w += LN.dwell * Math.exp(-Math.pow((z - h) / LN.dwellW, 2));
      if (i) c += w; cs[i] = c; }
    for (let i = 0; i <= NT; i++) cs[i] /= c;
  }
  const zOfS = sv => { sv = clamp01(sv); let lo = 0, hi = NT; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cs[m] < sv) lo = m; else hi = m; } const f = (sv - cs[lo]) / Math.max(1e-9, cs[hi] - cs[lo]); return zs[lo] + (zs[hi] - zs[lo]) * f; };
  const sOfZ = z => { const x = clamp01(z / zEnd) * NT, i = Math.min(NT - 1, Math.floor(x)), f = x - i; return cs[i] + (cs[i + 1] - cs[i]) * f; };
  const laneG = () => [T.entry, T.travel - LN.circlePx];
  api.circleRange = () => laneOn ? [T.travel - LN.circlePx, T.travel] : null;   /* scrubbed circle: lane only; PHASE 4 = one notch, on the stroke's clock */
  api.camZ = g => { if (!laneOn || g <= T.entry) return 0; const [a, b] = laneG(); if (g <= b) return zOfS((g - a) / (b - a)); return zEnd - 4 * smooth(b, T.travel, g); };
  const gOfZ = z => { const [a, b] = laneG(); return a + (b - a) * sOfZ(z); };
  const laneX = z => (L0 && typeof L0.x === 'function' ? +L0.x(z) || 0 : 0);
  api.camX = g => { const z = api.camZ(g); return laneX(z) + LN.sway * Math.sin(z / 9.5 + 0.7); };   /* the lane's own S + a slow natural sway, no bob */
  api.lookX = g => { const z = api.camZ(g); return laneX(z - 14); };
  api.camY = (g, before) => {
    if (!laneOn || g <= T.entry) return before;
    const z = api.camZ(g), x = api.camX(g), fl = (typeof L0.floor === 'function' ? +L0.floor(x, z) : +L0.sand) + (+L0.eye || 1);
    return before + (fl - before) * easeInOut(clamp01(-z / LN.sinkM));
  };
  api.laneK = g => laneOn ? clamp01(api.camZ(g) / zEnd) : 0;
  /* a station's block: scale about the vanishing point = hold distance / distance (i = 0..2 beats, 3 = values) */
  api.anchor = (i, g) => { if (!laneOn) return 1; const d = api.camZ(g) - ST4[i].z; return Math.min(i === 3 ? 1.12 : 1.8, Math.max(0.3, LN.holdBack / Math.max(1.5, d))); };   /* the centred values panel never outgrows the screen */
  if (laneOn) {   /* the stations' g ranges from their places on the lane: in from 22 m before the hold, full at 6, out from 5 past, gone at 12 */
    const rng = zh => [gOfZ(zh + 22), gOfZ(zh + 6), gOfZ(zh - 5), gOfZ(zh - 12)].map(v => Math.round(v));
    T.beats = [rng(ST4[0].z + LN.holdBack), rng(ST4[1].z + LN.holdBack), rng(ST4[2].z + LN.holdBack)];
    if (T.values) T.values = rng(ST4[3].z + LN.holdBack).map((v, i) => i < 3 ? v : Math.min(v, T.travel - LN.circlePx - 5));
  }


  /* ---------------------------------------------------------------- PHASE 4: the DESCENT (DEEP's contract, STATUS-DEEP "PHASE 4 — DESCENT CONTRACT")
     After the crossing the lens sinks straight down through the reef gorge with the scroll (the controller's glide = the damping), from
     scene.descent.top to its 'open' station (the seabed), slowing round each station depth so its beat holds; the beats / values come and go
     at those depths; at the bottom the circle opens on one notch (the page's hand-over). s.camY in metres + s.descent: true; no s.camZ. */
  const DS = !laneOn && gorge.descent && Array.isArray(gorge.descent.stations) ? gorge.descent : null;
  api.descent = !!DS && Q.get('descent') !== '0';
  let yTop = -2.8, yEnd = -55;
  const NY = 512, ys = new Float32Array(NY + 1), cy = new Float32Array(NY + 1);
  if (api.descent) {
    const sy = n => { const x = DS.stations.find(q => q.name === n); return x ? +x.y : NaN; };
    const holds = (T.values ? ['insight', 'discipline', 'strategies', 'values'] : ['insight', 'discipline', 'strategies']).map(sy).filter(Number.isFinite);   /* PHASE 5: no hold where the values were */
    yTop = Number.isFinite(+DS.top) ? +DS.top : -2.8;
    yEnd = Number.isFinite(sy('open')) ? sy('open') : (Number.isFinite(+DS.bottom) ? +DS.bottom + 1 : -55);
    let c = 0;
    for (let i = 0; i <= NY; i++) { const y = yTop + (yEnd - yTop) * i / NY; ys[i] = y;
      let w = 1 + 1.2 * Math.exp(-Math.pow((y - yTop) / 3, 2)); for (const h of holds) w += 2.2 * Math.exp(-Math.pow((y - h) / 2.6, 2));
      if (i) c += w; cy[i] = c; }
    for (let i = 0; i <= NY; i++) cy[i] /= c;
    const yOfS = sv => { sv = clamp01(sv); let lo = 0, hi = NY; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cy[m] < sv) lo = m; else hi = m; } const f = (sv - cy[lo]) / Math.max(1e-9, cy[hi] - cy[lo]); return ys[lo] + (ys[hi] - ys[lo]) * f; };
    const sOfY = y => { const x = clamp01((y - yTop) / (yEnd - yTop)) * NY, i = Math.min(NY - 1, Math.floor(x)), f = x - i; return cy[i] + (cy[i + 1] - cy[i]) * f; };
    const gOfY = y => T.entry + (T.travel - T.entry) * sOfY(y);
    api.camY = (g, before) => g <= T.entry ? before : yOfS((g - T.entry) / (T.travel - T.entry));
    /* the beats / values from their depths: in from 7 m above the hold, full at 2.5 m, out from 2.5 m below, gone at 6 m below */
    const rng = y => [gOfY(y + 7), gOfY(y + 2.5), gOfY(y - 2.5), gOfY(y - 6)].map(v => Math.round(v));
    if (holds.length >= 3) T.beats = [rng(holds[0]), rng(holds[1]), T.values ? rng(holds[2]) : [...rng(holds[2]).slice(0, 2), Math.round(gOfY(yEnd + 5)), Math.round(gOfY(yEnd + 2))]];   /* without values: beat 3 stays down to just above the seabed */
    if (T.values && holds.length >= 4) T.values = rng(holds[3]).map(v => Math.min(v, T.travel - 8));
    api.depthAt = g => api.camY(g, yTop);
    api.stationY = holds.slice();   /* PHASE 7: the stations' depths (the controller anchors its text blocks there) */
  }

  const R = gorge.renderer;
  const ovCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  async function installForestCircle() {
    /* ---------------------------------------------------------------- PHASE 6 (client 「轉場要有渲染那個特效，參考:index1-5-flow2-mark.html」)
       The centre circle to the view from above carries the mark page's BRUSH look: the same mask as lift-cut's stroke (flow2-forest-atlas.js
       composite / dg-scene.js mode 2: a feathered edge with bristle noise along it, dry-brush streaks behind it), turned round the drop
       — the stroke runs outward along the radius, its bristles go round the circle. Drawn into the gorge canvas after its own picture
       (DEEP's mode 3 keeps a small inner window with its drag + rim just inside the brushed band), as a "destination-out" cut:
       every pixel keeps (1 − mask) of itself, so the gorge is painted away exactly like the canyon is on the mark page. */
    const cutMat = new THREE.ShaderMaterial({
      uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uC: { value: new THREE.Vector4(0.5, 0.5, 0, 0) }, uLook: { value: new THREE.Vector4(1.6, num('circleBristle', 0.65), 0.55, 0) } },
      depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */`precision highp float;
  uniform vec2 uRes; uniform vec4 uC, uLook;   /* uC: centre x, y (shares, GL), radius of the brush front (screen heights), on; uLook: soft, bristle, smear */
  float bH(float x){ return fract(sin(x * 127.1 + 0.7) * 43758.5453); }
  float bN(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(bH(i), bH(i + 1.0), f); }
  float bF(float x){ return bN(x) * 0.55 + bN(x * 2.13 + 7.0) * 0.3 + bN(x * 4.71 + 3.0) * 0.15; }
  float bN2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = bH(i.x + i.y * 57.0), b = bH(i.x + 1.0 + i.y * 57.0), c = bH(i.x + (i.y + 1.0) * 57.0), d = bH(i.x + 1.0 + (i.y + 1.0) * 57.0); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
  void main(){
    vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
    vec2 p = (uv - uC.xy) * vec2(asp, 1.0);
    float s = length(p);                                   /* along the stroke: outward */
    float ang = atan(p.y, p.x);
    float q = ang * max(uC.z, 0.25);                        /* across the stroke: arc length round the circle (screen heights, as the stroke's own across) */
    float band = 0.26 * uLook.x;
    float e = uC.z + ((bF(q * 18.0 + 40.0) - 0.5) * 0.06 + (bF(q * 5.0 + 43.0) - 0.5) * 0.12) * uLook.y + pow(bF(q * 60.0 + 11.0), 5.0) * 0.06 * uLook.y;
    float paint = 1.0 - smoothstep(e - band * 0.9, e + band * 0.4, s);
    float behind = clamp((e - s) / band, 0.0, 1.0);
    float dry = smoothstep(0.05, 0.95, bN2(vec2(q * 24.0, s * 2.0)) + behind * 0.7);
    float m = paint * mix(mix(1.0, dry, 0.6 * min(1.0, uLook.y)), 1.0, smoothstep(0.1, 0.9, behind));
    m = smoothstep(0.0, 1.0, m) * uC.w;
    gl_FragColor = vec4(0.0, 0.0, 0.0, m);
  }`
    });
    const cutScene = new THREE.Scene(); { const q = new THREE.Mesh(bigTriangle(THREE), cutMat); q.frustumCulled = false; cutScene.add(q); }
    try { await R.compileAsync(cutScene, ovCam); } catch (error) { }
    /* the brush front for a circle progress k (0 closed … 1 open): from just behind the centre to past the farthest corner, as lift-cut's f */
    api.brushOpen = (k, cx, cy) => {
      const asp = innerWidth / Math.max(1, innerHeight), band = 0.26 * 1.6;
      const far = Math.max(Math.hypot(cx * asp, cy), Math.hypot((1 - cx) * asp, cy), Math.hypot(cx * asp, 1 - cy), Math.hypot((1 - cx) * asp, 1 - cy));
      const front = -band * 0.45 - 0.05 + (far + band * 1.05 + 0.15 + band * 0.45 + 0.05) * k;
      return { front, inner: Math.max(0, front - band * 0.75) };   /* DEEP's mode-3 window sits inside the brushed band (its drag + rim there) */
    };
    api.cut = (k, cx, cy) => {
      if (!(k > 0.0005)) return;
      const U = cutMat.uniforms, b = api.brushOpen(k, cx, cy);
      R.getDrawingBufferSize(U.uRes.value); U.uC.value.set(cx, cy, b.front, 1);
      const ac = R.autoClear; R.autoClear = false;
      try { R.setRenderTarget(null); R.render(cutScene, ovCam); } finally { R.autoClear = ac; }
    };
  }

  // RISE owns its crossing. It needs only the descent path and the later forest circle.
  if (o.externalCrossing) {
    if (o.forestCircle !== false) await installForestCircle();
    ST.canyonLayer = 'external crossing';
    api.dispose = uninstall;
    return api;
  }

  /* ---------------------------------------------------------------- the drop: flow2-drop-lead.js reads layer.diveOverride / layer.pull every frame */
  const drop = window.__FLOW2_DROP__;
  const heldInCanyon = () => { const J = window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey; return !(J && Number.isFinite(S.hold) && +J.target > S.hold + 0.03); };
  if (drop) {
    Object.defineProperty(drop, 'diveOverride', {
      configurable: true, enumerable: true,
      get() {
        const st = S.state;
        if (st === 'gorge') return ST.g < T.entry ? Math.pow(clamp01((tlOf(ST.g) - DT.fall[0]) / (DT.fall[1] - DT.fall[0])), 1.25) : 1;   /* × drop-lead's pow 1.6 ≈ a falling body */
        if (st === 'canyon') return heldInCanyon() ? 0 : null;   /* the drop keeps leading, alive, at the hold; a jump past the canyon: as before */
        return null;
      },
      set(v) { /* the controller owns it while this file is loaded */ }
    });
    Object.defineProperty(drop, 'pull', {
      configurable: true, enumerable: true,
      get() {   /* the lead slows to 26 m on the way to the hold (journey-driven), and stays there through the take-over: never back */
        if (S.state === 'gorge') return 1;
        if (S.state !== 'canyon' || !Number.isFinite(S.hold)) return 0;
        const J = window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey; return J ? smooth(S.hold - DT.pullBefore, S.hold, +J.progress) : 0; },
      set(v) { }
    });
    Object.defineProperty(drop, 'lift', { configurable: true, enumerable: true, set(v) { },
      get() { if (S.state !== 'gorge' || ST.g >= T.entry) return 0; const t = clamp01((tlOf(ST.g) - DT.hang[0]) / (DT.hang[1] - DT.hang[0])); return DT.lift * (1 - Math.pow(1 - t, 2)); } });
    Object.defineProperty(drop, 'ahead', { configurable: true, enumerable: true, set(v) { },
      get() { if (S.state !== 'gorge') return 0; if (ST.g >= T.entry) return DT.ahead; const tl = tlOf(ST.g); return DT.ahead * (0.15 * clamp01(tl / DT.hang[1]) + 0.85 * clamp01((tl - DT.fall[0]) / (DT.fall[1] - DT.fall[0]))); } });
  } else ST.notes.push('no drop layer');

  /* ---------------------------------------------------------------- the gorge side: streaks under the meniscus, bubbles (gorge renderer) */
  const glG = R.getContext();
  const nTex = noiseTex(THREE);
  const ovMat = new THREE.ShaderMaterial({
    uniforms: { tN: { value: nTex }, uRes: { value: new THREE.Vector2(1, 1) }, uLine: { value: new THREE.Vector4(-1, 0, 0, 0) },
      uK: { value: new THREE.Vector4(0, 0, 0.2, 0) }, uB: { value: new THREE.Vector4(0.5, 0, 0, 0) } },
    depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`precision highp float;
uniform sampler2D tN; uniform vec2 uRes; uniform vec4 uLine, uK, uB;
${LINE_GLSL}
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
  float d = lineD(uv, asp, uLine);
  if (d <= 0.0) discard;
  vec3 col = vec3(0.0);
  /* 1 · the underside of the surface right under the meniscus: bright ripple streaks, stretched flat by the grazing angle */
  float band = exp(-d / uK.z) * uK.x;
  if (band > 0.004) {
    float v = 1.0 / (d + 0.03);
    vec2 p = vec2((uv.x - 0.5) * asp * (0.9 + 0.05 * v), v * 0.42);
    float n1 = texture2D(tN, p * vec2(0.55, 0.36) + vec2(uK.w * 0.010, uK.w * 0.022)).r;
    float n2 = texture2D(tN, p * vec2(1.45, 0.85) + vec2(0.37 - uK.w * 0.016, uK.w * 0.012)).r;
    float s = n1 * 0.6 + n2 * 0.4;
    float streak = smoothstep(0.55, 0.72, s) * (0.55 + 0.45 * smoothstep(0.5, 0.75, n2));
    col += vec3(0.80, 0.93, 1.0) * streak * band + vec3(0.30, 0.52, 0.62) * band * 0.10;
  }
  /* 2 · fine bubbles rising round the entry column */
  if (uB.z > 0.004) {
    float bub = 0.0;
    for (int L = 0; L < 2; L++) {
      float fl = float(L), sc = mix(20.0, 36.0, fl);
      vec2 g = vec2(uv.x * asp, uv.y - uB.y * (0.8 + 0.5 * fl)) * sc + vec2(fl * 3.7, 0.0);
      vec2 id = floor(g), f = fract(g) - 0.5;
      float h = h21(id + fl * 17.0);
      if (h < 0.13) {
        vec2 off = (vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5) * 0.5 + vec2(sin(uK.w * 2.3 + h * 60.0) * 0.07, 0.0);
        vec2 q = f - off; float l = length(q), rr = mix(0.07, 0.17, h21(id + 11.3)) * (1.0 - 0.3 * fl);
        float ring = smoothstep(rr, rr * 0.82, l) - smoothstep(rr * 0.78, rr * 0.5, l);
        float hi = smoothstep(rr * 0.32, 0.0, length(q - vec2(-rr * 0.35, rr * 0.35)));
        bub += (ring * 0.6 + hi * 0.9) * (1.0 - 0.35 * fl);
      }
    }
    float colW = exp(-pow((uv.x - uB.x) * asp / 0.32, 2.0)) * 0.85 + 0.15;
    col += vec3(0.82, 0.92, 1.0) * bub * colW * uB.z * smoothstep(0.0, 0.03, d);
  }
  gl_FragColor = vec4(col, 0.0);
}`
  });
  const ovScene = new THREE.Scene();
  const ovQuad = new THREE.Mesh(bigTriangle(THREE), ovMat); ovQuad.frustumCulled = false; ovScene.add(ovQuad);
  try { await R.compileAsync(ovScene, ovCam); } catch (error) { }
  /* warm the crossing once, unseen (the canvas is still hidden): the gorge in its mode-1 state with the line mid-screen, then my overlay
     (first use of its program and noise texture), then cleared — the take-over's first real frames find everything ready */
  function warmCrossing() {
    try {
      gorge.render({ camY: -0.6, camX: 0, surf: 0.5, glow: 1, deep: 0, time: 0, live: true, drop: { r: T.dropR || 0.135, stretch: 1, wob: [1, 1, 1], opacity: 1, y: -0.2 },
        mode: 1, line: [0.5, DT.wave, 0, 1], fade: 1 });
      const U = ovMat.uniforms; R.getDrawingBufferSize(U.uRes.value); U.uLine.value.set(0.5, DT.wave, 0, 1); U.uK.value.set(0.5, 0, 0.2, 0); U.uB.value.set(0.5, 0, 0.5, 0);
      const ac = R.autoClear; R.autoClear = false; try { R.setRenderTarget(null); R.render(ovScene, ovCam); if (OC) { const s = OC.state(0.5, 0, false, 0, 2), U2 = ocMat.uniforms; R.getDrawingBufferSize(U2.uRes.value); OC.set(U2, s); R.render(ocScene, ovCam); } } finally { R.autoClear = ac; }
      gorge.clear();
    } catch (error) { ST.notes.push('warm gorge: ' + (error?.message || error)); }
  }

  /* GPU timer of the overlay (?diveGpu=1) */
  const tq = Q.get('diveGpu') === '1' ? glG.getExtension('EXT_disjoint_timer_query_webgl2') : null, pend = [];
  function tBegin() { if (!tq) return; for (let i = pend.length - 1; i >= 0; i--) { const q = pend[i]; if (glG.getQueryParameter(q, glG.QUERY_RESULT_AVAILABLE)) { if (!glG.getParameter(tq.GPU_DISJOINT_EXT)) { ST.gpu.push(glG.getQueryParameter(q, glG.QUERY_RESULT) / 1e6); if (ST.gpu.length > 240) ST.gpu.shift(); } glG.deleteQuery(q); pend.splice(i, 1); } } if (pend.length > 4) return; const q = glG.createQuery(); glG.beginQuery(tq.TIME_ELAPSED_EXT, q); pend.push(q); pend.open = q; }
  function tEnd() { if (tq && pend.open) { glG.endQuery(tq.TIME_ELAPSED_EXT); pend.open = null; } }

  await installForestCircle();

  let ocMat = null, ocScene = null;
  if (OC) {
    ocMat = OC.gorgeMat(THREE, nTex); ocScene = new THREE.Scene();
    const q = new THREE.Mesh(bigTriangle(THREE), ocMat); q.frustumCulled = false; ocScene.add(q);
    try { await R.compileAsync(ocScene, ovCam); } catch (error) { }
  }
  api.after = (g, time, alive) => {
    if (!live() || g >= T.entry + 140) return;
    if (OC) {   /* OCEAN: the water under the edge, the bokeh, the sparkles — over the gorge's picture, clearing as the lens settles */
      const s = ST.oc; if (!s || s.c <= 0 || s.k[1] >= 0.999) return;   /* it goes on a little after the take-over (s.post) */
      const U = ocMat.uniforms; R.getDrawingBufferSize(U.uRes.value); OC.set(U, s);
      tBegin();
      const ac = R.autoClear; R.autoClear = false;
      try { R.setRenderTarget(null); R.render(ocScene, ovCam); } finally { R.autoClear = ac; }
      tEnd();
      return;
    }
    const tl = tlOf(g);
    const streak = DT.streak * smooth(DT.sweep[0], DT.sweep[0] + 0.06, tl) * (1 - smooth(DT.streakOut[0], DT.streakOut[1], tl));
    const bub = DT.bubble * smooth(DT.bubbles[0], DT.bubbles[0] + 0.15, tl) * (1 - smooth(T.entry + 20, T.entry + 140, g));   /* then DEEP's own bubbles */
    if (streak < 0.004 && bub < 0.004) return;
    const U = ovMat.uniforms;
    R.getDrawingBufferSize(U.uRes.value); U.uLine.value.fromArray(ST.line);
    U.uK.value.set(streak, 0, DT.streakW + 0.25 * ST.c, alive ? time % 1000 : 0);
    const ex = ST.Escreen ? ST.Escreen.x : 0.5;
    U.uB.value.set(ex, (alive ? time * 0.035 : 0) + tl * 0.5, bub, 0);
    tBegin();
    const ac = R.autoClear; R.autoClear = false;
    try { R.setRenderTarget(null); R.render(ovScene, ovCam); } finally { R.autoClear = ac; }
    tEnd();
  };

  /* ---------------------------------------------------------------- the canyon side (a layer of the seagull host: the canyon's renderer, its picture) */
  let C = null;
  async function canyonSide() {
    let SG = null;
    for (let i = 0; i < 100; i++) { SG = window.__FLOW2_SEAGULL__; if (SG && SG.ctx && /^ready/.test(SG.state.stage)) break; await sleep(50); }
    if (!(SG && SG.ctx && /^ready/.test(SG.state.stage))) { ST.canyonLayer = 'no host'; return; }
    const ctx = SG.ctx, T3 = ctx.THREE, cr = ctx.renderer, cam = ctx.canyon.camera;
    const KEEP = { blending: T3.CustomBlending, blendSrc: T3.OneFactor, blendDst: T3.OneMinusSrcAlphaFactor, blendSrcAlpha: T3.ZeroFactor, blendDstAlpha: T3.OneFactor };
    /* the ring on the water */
    const ringMat = new T3.ShaderMaterial({
      uniforms: { uS: { value: 0 }, uA: { value: 0 } }, ...KEEP, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false,   /* flat on the water: the waves would hide it */
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz * 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`precision highp float; uniform float uS, uA; varying vec2 vP;
void main(){
  float r = length(vP), c = 0.0, dk = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i), ri = uS * (1.0 - fi * 0.27), w = 0.016 + 0.028 * uS, x = (r - ri) / w, amp = (1.0 - fi * 0.3) * step(0.001, ri);
    c += exp(-x * x) * amp; dk += exp(-(x + 1.7) * (x + 1.7)) * amp;
  }
  float fade = (1.0 - smoothstep(0.5, 1.0, uS)) * smoothstep(0.0, 0.04, uS) * (1.0 - smoothstep(0.82, 1.0, r));
  float spot = exp(-r * r / (0.004 + 0.03 * uS)) * (1.0 - smoothstep(0.0, 0.3, uS)) * smoothstep(0.0, 0.02, uS);
  vec3 col = vec3(0.86, 0.93, 1.0) * (c * 0.5 * fade + spot * 0.45) * uA;
  gl_FragColor = vec4(col, dk * 0.2 * fade * uA);
}`
    });
    const ring = new T3.Mesh(new T3.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ringMat); ring.frustumCulled = false; ring.renderOrder = 19; ring.scale.setScalar(14);
    /* the crown: a few splash drops thrown up and falling back (positions from the splash clock, no simulation) */
    const NC = 14, aA = new Float32Array(NC * 3), P0 = new Float32Array(NC * 3);
    for (let i = 0; i < NC; i++) { const h = Math.sin(i * 91.7) * 43758.5; const f = h - Math.floor(h); aA.set([i / NC * Math.PI * 2 + f * .4, .55 + .45 * f, .6 + .8 * ((f * 7.3) % 1)], i * 3); }
    const cg = new T3.BufferGeometry(); cg.setAttribute('position', new T3.Float32BufferAttribute(P0, 3)); cg.setAttribute('aA', new T3.Float32BufferAttribute(aA, 3));
    const crownMat = new T3.ShaderMaterial({
      uniforms: { uC: { value: 0 }, uA: { value: 0 }, uPx: { value: 1 } }, ...KEEP, transparent: true, depthTest: true, depthWrite: false, toneMapped: false, fog: false,
      vertexShader: /* glsl */`uniform float uC, uPx; attribute vec3 aA; varying float vA;
void main(){ float t = uC; vec3 p = vec3(cos(aA.x), 0.0, sin(aA.x)) * (0.08 + 0.55 * aA.y * t) + vec3(0.0, aA.z * 1.9 * t - 2.4 * t * t, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, uPx * 0.07 * aA.z / max(0.3, -mv.z));
  vA = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.65, 1.0, t)) * step(-0.02, p.y); }`,
      fragmentShader: 'precision highp float; uniform float uA; varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float l = dot(q, q); if (l > 1.0) discard; float a = (1.0 - l) * vA * uA; gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * a * 0.9, a * 0.25); }'
    });
    const crown = new T3.Points(cg, crownMat); crown.frustumCulled = false; crown.renderOrder = 20;
    /* the screen: the meniscus band above the line, the drops on the lens (both read the canyon's own picture) */
    const scrMat = new T3.ShaderMaterial({
      uniforms: { tScene: { value: null }, uRes: { value: new T3.Vector2(1, 1) }, uLine: { value: new T3.Vector4(-1, 0, 0, 0) }, uBandW: { value: DT.bandW },
        uDrops: { value: DROPS.map(() => new T3.Vector4(0, 0, 0.01, 0)) }, uRun: { value: DROPS.map(() => 0) } },
      ...KEEP, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */`precision highp float;
uniform sampler2D tScene; uniform vec2 uRes; uniform vec4 uLine; uniform float uBandW;
${lensSplashGLSL}
${LINE_GLSL}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
  float d = lineD(uv, asp, uLine);
  if (d > 0.003) discard;   /* the gorge draws under the water */
  vec4 acc = vec4(0.0);
  /* the water climbing the lens just above the line: the canyon through it, pulled down, a little cooler */
  float m = exp(min(d, 0.0) / uBandW) * uLine.w;
  float wet = exp(min(d, 0.0) / 0.22) * uLine.w * 0.6;   /* the lens close to the water: the low canyon (a bright mirror at that height) dims toward the water's colour */
  if (m > 0.004 || wet > 0.004) {
    vec3 col = vec3(0.0); float al = 0.0;
    if (m > 0.004) {
      float x = uv.x * asp;
      vec2 s = uv + vec2(0.0025 * sin(x * 23.0 + uLine.z * 1.3), -0.05 * m * (0.75 + 0.25 * sin(x * 9.0 - uLine.z)));
      vec3 c = texture2D(tScene, clamp(s, vec2(0.001), vec2(0.999))).rgb * vec3(0.88, 0.96, 1.02) + vec3(0.02, 0.035, 0.045) * m;
      al = smoothstep(0.0, 1.0, m); col = c * al;
    }
    col = col * (1.0 - wet) + vec3(0.03, 0.07, 0.095) * wet; al = al + wet * (1.0 - al);
    acc = vec4(col, al);
  }
  addLensSplash(acc, tScene, uv, asp);
  gl_FragColor = acc;
}`
    });
    let ocSun, ocSunE = null;   /* OCEAN: the sky's sun (direction; its energy fades for the canyon's renders while the band is there: ONE sun, the blob) */
    const findSun = () => { if (ocSun !== undefined) return; ocSun = null; ctx.canyon.scene.traverse(o => { const u = o.material && o.material.uniforms; if (!ocSun && u && u.uSunDir && u.uSunSize) { ocSun = u.uSunDir; ocSunE = u.uSunEnergy && typeof u.uSunEnergy.value === 'number' ? u.uSunEnergy : null; } }); };
    const ocScr = OC ? OC.canyonMat(T3, noiseTex(T3), KEEP) : null;   /* OCEAN: its own screen pass (our picture out of focus, the edge, the water under it) */
    const scr = new T3.Mesh(bigTriangle(T3), ocScr || scrMat); scr.frustumCulled = false; scr.renderOrder = 60;
    /* compile before anything shows (a scene of their own, all visible) */
    /* compile, then ONE small off-screen draw (uniforms, buffers, first use): nothing is new to the GPU when the take-over plays */
    try {
      const tmp = new T3.Scene(); tmp.add(ring, crown, scr); await cr.compileAsync(tmp, cam);
      const wt = new T3.WebGLRenderTarget(4, 4, { type: T3.HalfFloatType, depthBuffer: true }), was = cr.getRenderTarget(), ac = cr.autoClear;
      ringMat.uniforms.uS.value = 0.3; ringMat.uniforms.uA.value = 1; crownMat.uniforms.uC.value = 0.3; crownMat.uniforms.uA.value = 1;
      const t1 = new T3.DataTexture(new Uint8Array([90, 110, 140, 255]), 1, 1, T3.RGBAFormat); t1.needsUpdate = true;   /* never the target itself (no feedback loop) */
      scrMat.uniforms.tScene.value = t1; scrMat.uniforms.uLine.value.set(0.5, 0.006, 0, 1); scrMat.uniforms.uRes.value.set(4, 4);
      if (ocScr) { OC.set(ocScr.uniforms, OC.state(0.5, 0, false, 0, 2)); ocScr.uniforms.tScene.value = t1; ocScr.uniforms.uRes.value.set(4, 4); }
      try { cr.setRenderTarget(wt); cr.render(tmp, cam); } finally { cr.setRenderTarget(was); cr.autoClear = ac; scrMat.uniforms.tScene.value = null; if (ocScr) ocScr.uniforms.tScene.value = null; tmp.remove(ring, crown, scr); wt.dispose(); t1.dispose(); }
    } catch (error) { ST.notes.push('warm canyon: ' + (error?.message || error)); }
    ring.visible = crown.visible = scr.visible = false;
    ctx.sceneA.add(ring, crown, scr);

    /* the lens follows: the canyon camera moved for the canyon's own renders of this frame only */
    const V = { p: new T3.Vector3(), q: new T3.Quaternion(), E: new T3.Vector3(), tmp: new T3.Vector3() };
    let applied = false;
    const camOn = () => live() && ST.g > 0.05 && ST.g < T.entry + 0.5 && !window.__FLOW2_COVER__;
    /* where the drop goes in: it follows the drop until the drop is under (it is brought back toward the lens first) */
    function entryPoint() {
      const D = ctx.drop;
      if (D && D.on && D.pos) { V.E.set(D.pos.x, 0, D.pos.z); ST.E = V.E; }
      if (ST.E) return ST.E;
      cam.getWorldDirection(V.tmp); V.tmp.y = 0; V.tmp.normalize(); V.E.copy(cam.position).addScaledVector(V.tmp, 16); V.E.y = 0;
      ST.E = V.E; return V.E;
    }
    /* the river's blue currents (main.js's follow-light-lines group): faded for these renders while the lens sinks to the water */
    let curU;
    const currents = () => {
      if (curU !== undefined) return curU;
      const u = []; const grp = ctx.canyon.scene && ctx.canyon.scene.getObjectByName('index1-5 first-person blue currents');
      if (grp) grp.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.uBright && !u.includes(o.material.uniforms.uBright)) u.push(o.material.uniforms.uBright); });   /* one per lane */
      return (curU = u);
    };
    function restore() { if (!applied) return; cam.position.copy(V.p); cam.quaternion.copy(V.q); cam.updateMatrixWorld(true); if (V.cu) { V.cu.forEach((x, i) => { x.value = V.bright[i]; }); V.cu = null; } if (V.su) { V.su.value = V.sunE; V.su = null; } applied = false; }
    function apply() {
      applied = true; queueMicrotask(restore);
      V.p.copy(cam.position); V.q.copy(cam.quaternion);
      const tl = tlOf(ST.g);
      const cu = currents(); if (cu.length) { const kf = 1 - smooth(DT.currentsOut[0], DT.currentsOut[1], tl); V.cu = cu; V.bright = cu.map(x => x.value); cu.forEach(x => { x.value *= kf; }); }
      if (OC && ST.oc && OC.tune.skySun < 1) { findSun(); if (ocSunE) { V.su = ocSunE; V.sunE = ocSunE.value; ocSunE.value *= 1 - (1 - OC.tune.skySun) * smooth(0, 0.3, ST.oc.ts); } }   /* OCEAN pass 4: the sky's disc fades as the band forms */
      /* WHERE THE VISITOR IS: the lens only sinks straight down, same yaw and pitch (nothing new of the canyon comes into view) */
      cam.position.y = V.p.y + (DT.eyeEnd - V.p.y) * ch(DT.sink, tl);
      cam.updateMatrixWorld(true);
      ST.camApplied++;
    }
    const origRender = cr.render;
    cr.render = function (scene, camera) {
      if (camera === cam && !applied && camOn()) { try { apply(); } catch (error) { applied = false; ST.notes.push('cam: ' + (error?.message || error)); } }
      return origRender.apply(this, arguments);
    };
    C = { restore, unhook() { cr.render = origRender; restore(); ctx.sceneA.remove(ring, crown, scr); } };

    /* the layer (after the drop and the beam: it reads where the drop is) */
    const layer = {
      name: 'dive', order: 5,
      busy: () => live() && ST.g > 0.05 && ST.g < T.entry,
      hide() { ring.visible = crown.visible = scr.visible = false; },
      update(f, ctx2, readBuffer) {
        if (!layer.busy()) { layer.hide(); if (!live()) ST.E = null; return; }
        window.__FLOW2_IDLE_HOLD__ = true;   /* the lens is moving: full frame rate */
        const g = ST.g, tl = tlOf(g), E = entryPoint();
        const rs = smooth(DT.ring[0], DT.ring[1], tl), cs = smooth(DT.crown[0], DT.crown[1], tl);
        ring.position.set(E.x, 0.06, E.z); ringMat.uniforms.uS.value = rs; ringMat.uniforms.uA.value = DT.ring; ring.visible = rs > 0.001 && rs < 0.999;
        crown.position.set(E.x, 0.05, E.z); crownMat.uniforms.uC.value = cs; crownMat.uniforms.uA.value = 1; crownMat.uniforms.uPx.value = readBuffer.height; crown.visible = cs > 0.001 && cs < 0.999;
        /* the screen pass: only with the canyon's resolved picture (multisampled buffer) */
        const hasScene = readBuffer.samples > 0 && readBuffer.texture;
        if (ocScr) {   /* OCEAN */
          const s = ST.oc, U = ocScr.uniforms;
          /* PASS 3 (lead): ONE sun — the blob sits where OUR sky's sun meets the line; CEIL's hotspot x is only kept for ?ocToHot= */
          const hot = gorge.ocean && gorge.ocean.hot && gorge.ocean.hot.value; OC.hotU = hot && Number.isFinite(hot.x) ? hot.x : null;
          findSun();
          if (ocSun) { V.tmp.copy(ocSun.value).transformDirection(cam.matrixWorldInverse); if (V.tmp.z < -0.05) OC.sunU = Math.min(0.9, Math.max(0.1, 0.5 + 0.5 * cam.projectionMatrix.elements[0] * V.tmp.x / -V.tmp.z)); }
          else if (OC.hotU != null) OC.sunU = OC.hotU;
          OC.tune.cal[0] = cr.toneMapping === T3.NeutralToneMapping ? 1 : 0; OC.tune.cal[1] = cr.toneMapping === T3.NoToneMapping ? 1 : 1 / Math.max(0.05, cr.toneMappingExposure);   /* the bokeh sits where OUR sun meets the edge */
          scr.visible = !!hasScene && !!s && s.k[0] > 0.002 && s.seam < 1.0;
          if (scr.visible) { U.uRes.value.set(readBuffer.width, readBuffer.height); OC.set(U, s); }
          U.tScene.value = hasScene ? readBuffer.texture : null;
          V.tmp.copy(E).project(cam); ST.Escreen = { x: V.tmp.x * 0.5 + 0.5, y: V.tmp.y * 0.5 + 0.5 };
          ST.frames++; return;
        }
        const U = scrMat.uniforms; U.uRes.value.set(readBuffer.width, readBuffer.height); U.uLine.value.fromArray(ST.line);
        let anyDrop = false;
        DROPS.forEach(([x, y, r], i) => {
          /* THE LENS SPLASH: as the lens meets the water (the line's start), drops hit the screen one after another; they run down (the
             bigger the faster, leaving a streak) and the rising water swallows them; scrubbed, so scrolling up plays it back */
          const t0 = DT.sweep[0] - 0.01 + (i % 6) * 0.01, a = smooth(t0, t0 + 0.025, tl) * DT.drops;   /* just after the drop went in, as the lens meets the water */
          const slide = 0.11 * smooth(t0, DT.sweep[1], tl) * (r / 0.03);
          U.uDrops.value[i].set(x, y - slide, r, a); U.uRun.value[i] = slide; if (a > 0.004) anyDrop = true;
        });
        scr.visible = !!hasScene && (anyDrop || (ST.line[3] > 0.01 && ST.line[0] > -0.06));
        U.tScene.value = hasScene ? readBuffer.texture : null;
        /* where the entry point is on the screen (the bubbles' column) */
        V.tmp.copy(E).project(cam); ST.Escreen = { x: V.tmp.x * 0.5 + 0.5, y: V.tmp.y * 0.5 + 0.5 };
        ST.frames++;
      }
    };
    (window.__FLOW2_SEAGULL_LAYERS__ ||= []).includes(layer) || SG.layers.push(layer);
    ST.canyonLayer = 'ready';
  }
  await canyonSide().catch(error => { ST.canyonLayer = 'failed: ' + (error?.message || error); });
  warmCrossing();

  if (OC) api.sunX = () => OC.sunU;   /* OCEAN: our sun's screen x for CEIL (s.sunX) */
  if (OC) api.ceil = () => ocCeil;   /* OCEAN: CEIL's s.ceil (drop-gorge.js passes it on, OCEAN HOOK) */
  api.dispose = () => { uninstall(); if (C) C.unhook(); if (drop) { for (const k of ['diveOverride', 'pull', 'lift', 'ahead']) delete drop[k]; drop.diveOverride = null; drop.pull = drop.lift = drop.ahead = 0; } };
  api.stats = () => { const q = ST.gpu.slice().sort((a, b) => a - b); return { ...(OC ? { ocean: true } : {}), tweens: ST.tweens, busy: !!TW, tl: +ST.tl.toFixed(3), canyonLayer: ST.canyonLayer, g: +ST.g.toFixed(1), k: +ST.k.toFixed(3), line: ST.line.map(v => +v.toFixed(3)), camApplied: ST.camApplied, frames: ST.frames, E: ST.E && [+ST.E.x.toFixed(1), +ST.E.z.toFixed(1)], Escreen: ST.Escreen, overlayGpuMedian: q.length ? +q[q.length >> 1].toFixed(3) : null, overlayGpuP90: q.length ? +q[Math.floor(q.length * .9)].toFixed(3) : null, gpuN: q.length, notes: ST.notes }; };
  return api;
}
