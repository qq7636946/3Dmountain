/* =============================================================================================
   FLOW — index1-3-flow.html (test build, 2026-10-22). One drop, followed from the sky into the
   forest: drops gather above a sea of cloud (01–02), the drop falls through the cloud and hangs
   as a tear with the forest inside it (03), we pass through it into the forest seen from above
   (04), rise for the wider view (05), and follow the four tributaries (06).
   Scroll drives one progress value p in [0, 10]. Every visual value is a keyed track of p; the
   camera is a keyed path (Hermite through its keys, stopping on the "hold" keys where the text
   reads). Cuts are two keys at the same p, each hidden by the drop, a flash or the iris.
   ============================================================================================= */
import * as THREE from 'three';
import { createWorld } from './world.js';
import { createClouds } from './clouds.js';
import { createBubbles } from './bubble.js';
import { createPost } from './post.js';

const P_MAX = 10;
const qs = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = matchMedia('(max-width: 760px)').matches;
const QUALITY = qs.has('q') ? Math.min(1, Math.max(.3, +qs.get('q') || 1)) : (narrow ? .5 : 1);
const $ = s => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180;

/* Where each chapter sits on p (data-go targets; 6 = the first of the four paths) and where the
   counter turns over. */
const GO = [0, 1.5, 3.12, 4.5, 5.9, 6.9, 7.66];
const CHAPTER_START = [0, 1.05, 2.6, 3.75, 5.2, 6.35];

/* ---------------------------------------------------------------------------------------------
   TRACKS. [p, value] keys, eased between neighbours; two keys at one p make a cut.
   --------------------------------------------------------------------------------------------- */
const n = (...k) => ({ k });
const col = (...k) => ({ k: k.map(([p, h]) => [p, new THREE.Color(h)]), c: new THREE.Color() });
const TRACKS = {
  /* Sky and air. */
  zenith: col([0, '#1f5aae'], [2.1, '#1f5aae'], [2.75, '#2f6cbd'], [3.62, '#2f6cbd'], [3.62, '#3d73b8'], [5.3, '#3d73b8'], [5.8, '#3b6fb0'], [6.4, '#3b6fb0'], [6.4, '#3a69a2']),
  horizon: col([0, '#8db5de'], [2.1, '#8db5de'], [2.75, '#9dbfe3'], [3.62, '#9dbfe3'], [3.62, '#b9cde0'], [5.8, '#bdd0dd'], [6.4, '#bdd0dd'], [6.4, '#b7c8d2']),
  below: col([0, '#c3cfda'], [2.75, '#7f9282']),
  haze: col([0, '#a7bfd7'], [2.1, '#a7bfd7'], [2.75, '#a3bdd8'], [3.62, '#a3bdd8'], [3.62, '#98afc3'], [5.3, '#98afc3'], [5.8, '#a4b9c9'], [6.4, '#a4b9c9'], [6.4, '#9db1bd']),
  hazeDensity: n([0, .00008], [2.3, .00008], [2.75, .00005], [3.62, .00005], [3.62, .00006], [5.3, .00006], [5.8, .00008]),
  /* Clouds. Above: a sea of cumulus (1450–1880 m) the drop falls into; round the tear only the
     clouds near the camera, with a clear pocket at the lens. After the pass-through: a thin mist
     layer low over the forest, opened under the camera when it looks straight down. */
  clouds: n([0, 1]),
  cloudBase: n([0, 1450], [3.62, 1450], [3.62, 205]),
  cloudTop: n([0, 1880], [3.62, 1880], [3.62, 300]),
  cloudScale: n([0, 2600], [3.62, 2600], [3.62, 760]),
  cloudCoverage: n([0, .46], [2.0, .46], [2.5, .36], [3.62, .36], [3.62, .44], [5.06, .44], [5.5, .26], [6.4, .26], [6.4, .24]),
  cloudFar: n([0, 14000], [2.3, 14000], [2.75, 3800], [3.62, 3800], [3.62, 0]),
  cloudClear: n([0, 0], [2.0, 0], [2.2, 120], [3.62, 120], [3.62, 0]),
  cloudHole: n([0, 0], [3.62, 0], [3.62, 1], [5.3, 1], [5.6, 0]),
  holeR0: n([0, 70]),
  holeR1: n([0, 190]),
  /* The drop: screen position, distance and radius in the camera's frame; shape; material. */
  bOn: n([0, 1], [3.62, 1], [3.62, 0], [3.79, 0], [3.8, 1], [5.4, 1], [5.42, 0]),
  bX: n([0, 0], [1.0, 0], [1.4, .1], [2.0, .1], [2.6, .14], [3.42, .15], [3.6, 0], [3.62, 0], [3.62, .14]),
  bY: n([0, -.02], [1.0, -.02], [1.4, .03], [2.0, .03], [2.3, -.2], [2.6, -.02], [2.85, .06], [3.42, .06], [3.6, 0], [3.62, 0], [3.62, .02]),
  bDist: n([0, 10], [3.42, 10], [3.6, 2.45], [3.62, 2.4], [3.62, 12]),
  bRadius: n([0, 1.3], [1.1, 1.3], [2.0, 1.42], [2.6, 1.7], [3.62, 1.75], [3.62, 0], [3.8, 0], [4.08, 1.25], [5.06, 1.25], [5.36, 0]),
  bMorph: n([0, 0], [2.0, 0], [2.6, .92], [3.42, .92], [3.58, .05], [3.62, 0]),
  bWobble: n([0, .012], [2.0, .012], [2.4, .03], [2.9, .008], [3.62, .008], [3.62, .014]),
  bDrop: n([0, .5], [2.0, .5], [2.6, .94], [3.62, .94], [3.62, .92]),
  bFilm: n([0, 1], [2.0, 1], [2.6, .32], [3.62, .32], [3.62, .65]),
  bFade: n([0, 0]),
  bGlow: n([0, .45], [2.6, .25], [3.62, .25], [3.62, .4]),
  bSoftbox: n([0, 1], [2.0, 1], [2.6, .55], [3.42, .55], [3.56, 0], [3.62, 0], [3.62, 1]),
  bDisp: n([0, .012], [2.0, .012], [2.6, .004], [3.62, .004], [3.62, .006]),
  bBack: n([0, 2600], [2.0, 2600], [2.6, 3000], [3.62, 3000], [3.62, 420]),
  envGround: col([0, '#cfd9e3'], [2.1, '#cfd9e3'], [2.6, '#5d6f63'], [3.62, '#5d6f63'], [3.62, '#4a5e4e']),
  portal: n([0, 0], [2.42, 0], [2.56, 1], [3.62, 1], [3.62, 0]),
  /* Near the lens's focal distance the drop magnifies without limit: its picture blurs instead. */
  portalBias: n([0, 0], [3.43, 0], [3.5, 2], [3.55, 4.5], [3.59, 6.5], [3.62, 6.5]),
  smallSky: n([0, 1], [1.9, 1], [2.08, 0]),
  smallLift: n([0, 0]),
  smallAir: n([0, 0], [3.85, 0], [4.15, 1], [5.0, 1], [5.28, 0]),
  /* Lens and grade. */
  aperture: n([0, 0], [3.62, 0], [3.62, .15], [4.05, .8], [5.0, .8], [5.32, 0]),
  exposure: n([0, 1.0], [2.3, 1.0], [2.5, 1.12], [2.75, .98], [3.42, .98], [3.62, 1.05], [3.62, .94], [5.3, .94], [5.8, 1.0]),
  contrast: n([0, 1.04], [2.3, 1.04], [2.75, 1.1], [3.62, 1.1], [3.62, 1.06], [6.4, 1.06], [6.4, 1.08]),
  sat: n([0, 1.04], [2.3, 1.04], [2.75, 1.12], [3.62, 1.12], [3.62, .96], [5.3, .96], [5.8, 1.02], [6.4, 1.02], [6.4, 1.0]),
  vignette: n([0, .18], [2.6, .24], [3.62, .3], [5.3, .3], [5.8, .22], [6.4, .26]),
  grain: n([0, .032]),
  warm: n([0, .1], [2.6, .25], [3.62, .25], [3.62, 0], [5.3, 0], [5.8, .12], [6.4, .18]),
  leak: n([0, 0], [2.25, 0], [2.62, 1], [3.42, .85], [3.5, 0]),
  fish: n([0, 0], [3.5, 0], [3.62, .5], [3.9, 0]),
  ca: n([0, 0], [3.5, 0], [3.62, .6], [3.9, 0], [6.3, 0], [6.4, .5], [6.6, 0]),
  flash: n([0, 0], [3.54, 0], [3.61, .42], [3.7, 0]),
  zoom: n([0, 0], [3.5, 0], [3.62, .8], [3.76, .3], [3.92, 0]),
  iris: n([0, 0], [6.22, 0], [6.4, 1], [6.6, 0]),
  /* The four paths: light running down the tributaries (all, then one per strategy). */
  flowGlow: n([0, 0], [6.5, 0], [6.75, .85], [7.3, .85], [7.38, 0], [7.5, 1], [7.94, 1], [8.04, 0], [8.14, 1], [8.56, 1], [8.66, 0], [8.76, 1], [9.18, 1], [9.28, 0], [9.38, 1]),
  flowRiver: n([0, -1], [7.38, -1], [7.38, 1], [8.04, 1], [8.04, 2], [8.66, 2], [8.66, 3], [9.28, 3], [9.28, 4])
};
function sample(tr, p) {
  const k = tr.k;
  let v0 = k[0][1], v1 = v0, t = 0;
  if (p > k[0][0]) {
    let i = 1;
    while (i < k.length && p > k[i][0]) i++;
    if (i >= k.length) v0 = v1 = k[k.length - 1][1];
    else { const [p0, a] = k[i - 1], [p1, b] = k[i]; v0 = a; v1 = b; t = p1 > p0 ? (p - p0) / (p1 - p0) : 1; t = t * t * (3 - 2 * t); }
  }
  return tr.c ? tr.c.copy(v0).lerp(v1, t) : v0 + (v1 - v0) * t;
}
const S = {};
function evalState(p, introT) {
  for (const key in TRACKS) S[key] = sample(TRACKS[key], p);
  /* Arrival: the drop and its company come in as the page opens. */
  const arrive = reduceMotion ? 1 : smooth(.1, 1.5, introT);
  S.bOn *= p < 1 ? arrive : 1;
  S.smallSky *= arrive;
  S.bRadius *= p < 1 ? .55 + .45 * arrive : 1;
  if (camera && camera.aspect < 1.35) {
    const fit = clamp(camera.aspect / 1.35, .5, 1);
    /* (while the drop closes in to fill the frame, the fit lets go) */
    S.bRadius *= p > 3.42 && p <= 3.62 ? fit + (1 - fit) * smooth(3.42, 3.6, p) : fit;
    S.bX *= fit * fit;
    S.leak *= fit;
  }
  S.focus = S.bDist;
  S.fadeIn = 1;
  if (reduceMotion) { S.bWobble *= .3; S.fish *= .4; S.grain *= .5; }
  return S;
}

/* ---------------------------------------------------------------------------------------------
   CAMERA PATH. Keys: position, a point to look at (or straight down with a screen-up direction),
   roll, field of view; "hold" keys stop the camera. Positions are Hermite-interpolated in p with
   finite-difference velocities (zero on holds); orientation slerps with matching easing.
   --------------------------------------------------------------------------------------------- */
/* Where the forest chapter looks down: over a meander of the main river. */
const AERIAL = (qs.get('aerial') || '-60,2400').split(',').map(Number);
function buildShots(net, aspect = 16 / 9) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0), AUP = V(-.42, 0, -.91).normalize();
  const dir = (yaw, pitch) => V(Math.sin(yaw * D2R) * Math.cos(pitch * D2R), Math.sin(pitch * D2R), -Math.cos(yaw * D2R) * Math.cos(pitch * D2R));
  const key = (p, pos, look, o = {}) => ({ p, pos, look, up: UP, roll: 0, fov: 40, hold: false, ...o });
  const view = (p, pos, yaw, pitch, o) => key(p, pos, pos.clone().addScaledVector(dir(yaw, pitch), 1000), o);
  const down = (p, pos, o) => key(p, pos, pos.clone().add(V(0, -1000, 0)), { up: AUP, fov: 50, ...o });
  const [AX, AZ] = AERIAL;
  const shots = [
    /* 01–02 above the sea of cloud, looking up into the sky. */
    view(0, V(0, 2350, 5600), 8, 14, { hold: true }),
    view(1.0, V(-4, 2346, 5530), 6, 13, { hold: true }),
    view(2.0, V(-10, 2330, 5400), 3, 10, { hold: true }),
    /* The fall: down to the cloud tops; the tear hangs among them, the valley beyond. */
    view(2.32, V(-22, 2200, 5080), 0, -20),
    view(2.6, V(-45, 2040, 4560), -3, -11),
    view(2.88, V(-60, 1995, 4280), -6, -8, { hold: true }),
    view(3.42, V(-76, 1990, 4100), -7, -7.5, { hold: true }),
    view(3.62, V(-80, 1989, 4070), -7, -7.4),
    /* Through the drop: arrive over the forest with a slight twist that settles. */
    down(3.62, V(AX, 430, AZ + 25), { roll: 28, fov: 46 }),
    down(3.77, V(AX, 430, AZ + 12), { roll: 9, fov: 48 }),
    down(3.95, V(AX, 430, AZ), { hold: true }),
    down(5.06, V(AX - 20, 425, AZ - 110), { hold: true }),
    /* 05 rise out over the valley. */
    key(5.42, V(AX, 760, AZ + 300), V(AX - 80, 0, AZ - 650), { fov: 46 }),
    key(5.8, V(150, 1100, 2100), V(-150, 0, -2400), { hold: true }),
    key(6.4, V(140, 1085, 1930), V(-150, 0, -2500), { hold: true }),
    /* 06 the confluence reach (after the iris). */
    key(6.4, V(760, 1300, -360), V(-30, 0, -2430), { fov: 42, hold: true }),
    key(7.12, V(640, 1260, -560), V(-40, 0, -2460), { fov: 42, hold: true })
  ];
  /* One view per tributary: from across the main river, looking up the side valley, the
     tributary kept in the right half of a wide frame (the text holds the left), central on a
     tall one. */
  const side = clamp((aspect - .8) / .9);
  const holds = [[7.5, 7.84], [8.14, 8.46], [8.76, 9.08], [9.4, 10]];
  net.rivers.slice(1).forEach((r, i) => {
    const J = r.pts[r.pts.length - 1];
    let j = r.s.findIndex(s => s >= r.length - 700); if (j < 0) j = 0;
    const d = new THREE.Vector2(r.pts[j][0] - J[0], r.pts[j][1] - J[1]).normalize();
    const pos = V(J[0] - d.x * 1050 + d.y * 200 * side, 720, J[1] - d.y * 1050 - d.x * 200 * side);
    const look = V(J[0] + d.x * 300 + d.y * 520 * side, 0, J[1] + d.y * 300 - d.x * 520 * side);
    shots.push(key(holds[i][0], pos, look, { fov: 44, hold: true }));
    shots.push(key(holds[i][1], pos.clone().add(V(d.x * 110, -25, d.y * 110)), look.clone().add(V(d.x * 60, 0, d.y * 60)), { fov: 44, hold: true }));
  });
  const m = new THREE.Matrix4(), qr = new THREE.Quaternion(), Z = V(0, 0, 1);
  shots.forEach((s, i) => {
    m.lookAt(s.pos, s.look, s.up);
    s.q = new THREE.Quaternion().setFromRotationMatrix(m);
    if (s.roll) s.q.multiply(qr.setFromAxisAngle(Z, s.roll * D2R));
    s.m = new THREE.Vector3();
    if (s.hold) return;
    const a = i > 0 && shots[i - 1].p < s.p ? shots[i - 1] : s;
    const b = i < shots.length - 1 && shots[i + 1].p > s.p ? shots[i + 1] : s;
    if (b.p > a.p) s.m.subVectors(b.pos, a.pos).divideScalar(b.p - a.p);
  });
  return shots;
}
const herm = (t, s0, s1) => { const t2 = t * t, t3 = t2 * t; return (t3 - 2 * t2 + t) * s0 + (-2 * t3 + 3 * t2) + (t3 - t2) * s1; };
function cameraAt(shots, p, pos, q) {
  if (p <= shots[0].p) { pos.copy(shots[0].pos); q.copy(shots[0].q); return shots[0].fov; }
  let i = 0;
  while (i < shots.length - 1 && p > shots[i + 1].p) i++;
  if (i >= shots.length - 1) { const s = shots[shots.length - 1]; pos.copy(s.pos); q.copy(s.q); return s.fov; }
  const a = shots[i], b = shots[i + 1], h = b.p - a.p, t = (p - a.p) / h;
  const t2 = t * t, t3 = t2 * t;
  pos.set(0, 0, 0)
    .addScaledVector(a.pos, 2 * t3 - 3 * t2 + 1).addScaledVector(a.m, (t3 - 2 * t2 + t) * h)
    .addScaledVector(b.pos, -2 * t3 + 3 * t2).addScaledVector(b.m, (t3 - t2) * h);
  const e = herm(t, a.hold ? 0 : 1, b.hold ? 0 : 1);
  q.slerpQuaternions(a.q, b.q, e);
  return a.fov + (b.fov - a.fov) * e;
}

/* ---------------------------------------------------------------------------------------------
   PAGE
   --------------------------------------------------------------------------------------------- */
const canvas = $('#gl');
const loader = $('#loader'), loaderBar = $('#loaderBar'), loaderNote = $('#loaderNote');
const space = $('#scrollSpace');
const panels = [...document.querySelectorAll('.panel')].map(el => {
  const [in0, in1] = el.dataset.in.split(',').map(Number), [out0, out1] = el.dataset.out.split(',').map(Number);
  el.querySelectorAll('.ln').forEach((ln, k) => ln.style.setProperty('--k', k));
  return { el, in0, in1, out0, out1, hero: el.classList.contains('hero'), on: false, a: -1, z: -1 };
});
const countNow = $('#countNow'), countFill = $('#countFill'), cue = $('.cue'), hint = $('#hint');
const state = { p: 0, pT: 0, time: 0, tReady: Infinity, paused: false, jump: null, chapter: -1 };
const progress = (v, note) => { loaderBar.style.setProperty('--p', v); if (note) loaderNote.textContent = note; };
/* A frame for the loader to paint; a timer stands in where frames are paused (background tabs). */
const nextFrame = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; setTimeout(r, 0); } }; requestAnimationFrame(go); setTimeout(go, 120); });
const scrollMax = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);

let renderer, camera, world, clouds, bubbles, post, shots, portalCam, portalRT;
let scale = 1, maxScale = 1;

function layout() {
  space.style.height = `${Math.round(innerHeight * (P_MAX + 1))}px`;
}
function resize() {
  layout();
  if (!renderer || !post || !portalRT) return;
  renderer.setPixelRatio(scale);
  renderer.setSize(Math.max(2, innerWidth), Math.max(2, innerHeight), false);
  const w = renderer.domElement.width, h = renderer.domElement.height;
  post.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  shots = buildShots(world.net, camera.aspect);
  portalCam.aspect = camera.aspect; portalCam.updateProjectionMatrix();
  const pw = QUALITY > .6 ? 1024 : 560;
  portalRT.setSize(pw, Math.round(pw / camera.aspect));
}

/* Scroll → p. */
addEventListener('scroll', () => { if (!state.jump) state.pT = clamp(scrollY / scrollMax()) * P_MAX; }, { passive: true });
addEventListener('resize', () => { const p = state.pT; resize(); scrollTo(0, p / P_MAX * scrollMax()); });

/* Chapter jumps: short ones scroll, long ones close the iris, cut, and open again. */
function go(i) {
  const target = GO[clamp(i | 0, 0, GO.length - 1)];
  if (Math.abs(target - state.p) > 1.05 && !reduceMotion && renderer) state.jump = { t: 0, target, done: false };
  else scrollTo({ top: target / P_MAX * scrollMax(), behavior: reduceMotion ? 'auto' : 'smooth' });
}
const menu = $('#menu'), menuBtn = $('#menuBtn');
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go]');
  if (!t) return;
  e.preventDefault();
  if (menu.open) menu.close();
  go(+t.dataset.go);
});
menuBtn.addEventListener('click', () => { menu.showModal(); menuBtn.setAttribute('aria-expanded', 'true'); });
$('#menuClose').addEventListener('click', () => menu.close());
menu.addEventListener('close', () => menuBtn.setAttribute('aria-expanded', 'false'));

/* Ambient: off by default; a soft wind made from filtered brown noise, only after a click. */
const soundBtn = $('#sound');
let audio = null;
soundBtn.addEventListener('click', () => {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC(), len = ctx.sampleRate * 6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let v = 0;
      for (let i = 0; i < len; i++) { v = (v + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = v * 3.5; }
      const drift = d[len - 1] - d[0];
      for (let i = 0; i < len; i++) d[i] -= drift * i / len;
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = .06; lfoGain.gain.value = 240; lfo.connect(lfoGain).connect(lp.frequency);
    src.connect(lp).connect(gain).connect(ctx.destination); src.start(); lfo.start();
    audio = { ctx, gain, on: false };
  }
  audio.on = !audio.on;
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
  audio.gain.gain.setTargetAtTime(audio.on ? .2 : 0, audio.ctx.currentTime, .6);
  soundBtn.setAttribute('aria-pressed', String(audio.on));
  soundBtn.setAttribute('aria-label', audio.on ? '關閉環境音' : '開啟環境音');
});

/* ---------------------------------------------------------------------------------------------
   FRAME
   --------------------------------------------------------------------------------------------- */
const tmpPos = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), sway = new THREE.Quaternion(), swayE = new THREE.Euler();
function tick(dt) {
  state.time += dt;
  const time = state.time;
  /* p follows the scroll with a little inertia; a chapter jump sets it outright behind the iris. */
  let irisJump = 0;
  if (state.jump) {
    const J = state.jump; J.t += dt;
    irisJump = J.t < .45 ? smooth(0, .45, J.t) : 1 - smooth(.62, 1.2, J.t);
    if (J.t >= .45 && !J.done) { J.done = true; scrollTo(0, J.target / P_MAX * scrollMax()); state.p = state.pT = J.target; }
    if (J.t > 1.2) state.jump = null;
  } else state.p += (state.pT - state.p) * (1 - Math.exp(-dt * 3.4));
  if (Math.abs(state.pT - state.p) < 1e-4) state.p = state.pT;
  const p = state.p;
  evalState(p, time - state.tReady);
  S.iris = Math.max(S.iris, irisJump);
  /* (a viewport with no size, e.g. a hidden embedded view, has nothing to draw into) */
  if (renderer && innerWidth > 1 && innerHeight > 1) render(p, time);
  ui(p, time);
}

function render(p, time) {
  let fov = cameraAt(shots, p, tmpPos, tmpQ);
  const o = window.__FLOW__.override;
  if (o) {
    tmpPos.fromArray(o.pos);
    tmpQ.setFromRotationMatrix(new THREE.Matrix4().lookAt(tmpPos, new THREE.Vector3().fromArray(o.look), new THREE.Vector3().fromArray(o.up || [0, 1, 0])));
    fov = o.fov || fov;
  }
  camera.position.copy(tmpPos);
  /* A slow sway so the frame never sits dead still. */
  const k = reduceMotion ? 0 : 1;
  swayE.set(Math.sin(time * .19) * .0026 * k, Math.sin(time * .23 + 1.3) * .0034 * k, 0);
  camera.quaternion.copy(tmpQ).multiply(sway.setFromEuler(swayE));
  if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
  world.update(S, time, camera);

  /* The next scene, for the drop to show while it hangs as a tear. */
  if (S.portal > .001) {
    world.sky.position.copy(portalCam.position);
    renderer.setRenderTarget(portalRT); renderer.render(world.scene, portalCam);
    world.sky.position.copy(camera.position);
  }
  renderer.setRenderTarget(post.world); renderer.render(world.scene, camera);
  clouds.setLight({ sunDir: world.shared.uSunDir.value, sunColor: world.shared.uSunColor.value, skyTop: S.zenith, skyLow: S.horizon, haze: S.haze });
  clouds.render(post.clouds, camera, post.world.textures[1], S, time);
  post.compose();

  bubbles.setScene(post.comp.texture);
  bubbles.setPortal(S.portal > .001 ? portalRT.textures[0] : null, S.portal, portalCam.projectionMatrix, S.portalBias);
  bubbles.update(S, p, time, camera, post.size);
  /* The drop can come within centimetres of the lens: a short near plane for its pass only. */
  camera.near = .04; camera.updateProjectionMatrix();
  renderer.setRenderTarget(post.bubble); renderer.render(bubbles.scene, camera);
  camera.near = 1; camera.updateProjectionMatrix();

  post.depthOfField(S);
  post.final(S, time);
}

function ui(p, time) {
  const introT = time - state.tReady;
  const introA = reduceMotion ? 1 : smooth(.25, 1.9, introT);
  let vis = 0;
  for (const P of panels) {
    let a = smooth(P.in0, P.in1, p);
    const z = smooth(P.out0, P.out1, p);
    if (P.hero) a = Math.min(a, introA);
    const on = a > .001 && z < .999;
    if (on !== P.on) { P.el.classList.toggle('on', on); P.on = on; }
    if (on) {
      if (Math.abs(a - P.a) > .0005) { P.el.style.setProperty('--a', a.toFixed(4)); P.a = a; }
      if (Math.abs(z - P.z) > .0005) { P.el.style.setProperty('--z', z.toFixed(4)); P.z = z; }
    }
    vis = Math.max(vis, a * (1 - z));
  }
  let c = 0;
  while (c < CHAPTER_START.length - 1 && p >= CHAPTER_START[c + 1]) c++;
  if (c !== state.chapter) { state.chapter = c; countNow.textContent = String(c + 1).padStart(2, '0'); }
  countFill.style.setProperty('--f', (p / P_MAX).toFixed(4));
  cue.style.setProperty('--s', ((time * .42) % 1).toFixed(3));
  cue.style.opacity = (1 - smooth(.2, .7, p)).toFixed(3);
  hint.style.setProperty('--h', ((1 - vis) * smooth(.4, .8, p) * (p < 9.9 ? 1 : 0)).toFixed(3));
}

/* Main loop, with a resolution that adapts to the frame time. */
let last = 0, acc = 0, cnt = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60;
  last = now;
  if (state.paused) return;
  tick(dt);
  if (!renderer || qs.has('fixed')) return;
  acc += dt; cnt++;
  if (cnt >= 50) {
    const avg = acc / cnt; acc = cnt = 0;
    if (avg > .026 && scale > .55) { scale = Math.max(.55, scale * .86); resize(); }
    else if (avg < .0135 && scale < maxScale) { scale = Math.min(maxScale, scale * 1.06); resize(); }
  }
}

/* ---------------------------------------------------------------------------------------------
   BOOT
   --------------------------------------------------------------------------------------------- */
function fallback(reason) {
  document.documentElement.classList.add('no-gl');
  canvas.style.display = 'none';
  console.warn('[flow] static fallback:', reason);
}
async function boot() {
  history.scrollRestoration = 'manual';
  layout();
  progress(.06, 'GATHERING THE CLOUDS');
  await nextFrame();
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' });
    if (!renderer.extensions.has('EXT_color_buffer_float')) throw new Error('no float render targets');
  } catch (err) {
    renderer = null; fallback(err.message);
  }
  if (renderer) {
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback('context lost'); renderer = null; });
    maxScale = Math.min(devicePixelRatio || 1, QUALITY > .6 ? 1 : .8);
    scale = maxScale;
    camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 1, 60000);
    clouds = createClouds(renderer, { quality: QUALITY });
    progress(.24, 'TRACING THE RIVERS');
    await nextFrame();
    world = createWorld(renderer, { quality: QUALITY });
    progress(.52, 'GROWING THE FOREST');
    await nextFrame();
    bubbles = createBubbles(world, { quality: QUALITY });
    post = createPost(renderer, { quality: QUALITY });
    shots = buildShots(world.net);
    const cut = shots.find(s => s.up !== shots[0].up);
    portalCam = new THREE.PerspectiveCamera(cut.fov, 1, 1, 60000);
    portalCam.position.copy(cut.pos);
    portalCam.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(cut.pos, cut.look, cut.up));
    portalCam.updateMatrixWorld();
    portalRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, count: 2, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    portalRT.textures[0].minFilter = THREE.LinearMipmapLinearFilter; portalRT.textures[0].generateMipmaps = true;
    resize();
    /* Compile against a linear target so the programs match the ones the frame uses. */
    renderer.setRenderTarget(post.world);
    try { await renderer.compileAsync(world.scene, camera); await renderer.compileAsync(bubbles.scene, camera); } catch (err) { console.warn('[flow] compileAsync', err); }
    renderer.setRenderTarget(null);
    progress(.86, 'FINDING THE LIGHT');
    await nextFrame();
  }
  /* Start where the page was (or ?p=), without sliding there. */
  const startP = qs.has('p') ? clamp(+qs.get('p') || 0, 0, P_MAX) : 0;
  scrollTo(0, startP / P_MAX * scrollMax());
  state.p = state.pT = startP;
  tick(1 / 60);
  progress(1, 'READY');
  await nextFrame();
  state.tReady = state.time;
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
  loader.classList.add('is-done');
  requestAnimationFrame(loop);
  readyResolve();
}

let readyResolve;
const ready = new Promise(r => { readyResolve = r; });
window.__FLOW__ = {
  ready, state, tracks: TRACKS, override: null,
  get S() { return S; }, get p() { return state.p; },
  get renderer() { return renderer; }, get camera() { return camera; }, get world() { return world; },
  get clouds() { return clouds; }, get bubbles() { return bubbles; }, get post() { return post; }, get shots() { return shots; },
  seek(p) { state.jump = null; state.p = state.pT = clamp(p, 0, P_MAX); scrollTo(0, state.p / P_MAX * scrollMax()); },
  pause(v = true) { state.paused = v; },
  step(nFrames = 1, dt = 1 / 60) { for (let i = 0; i < nFrames; i++) tick(dt); },
  skipIntro() { state.tReady = state.time - 30; }
};
boot().catch(err => {
  console.error('[flow] boot failed', err);
  renderer = null; fallback(err.message);
  loader.classList.add('is-done'); document.body.classList.remove('is-loading');
  requestAnimationFrame(loop); readyResolve();
});
