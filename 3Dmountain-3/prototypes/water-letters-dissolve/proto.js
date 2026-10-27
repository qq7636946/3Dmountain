/* =====================================================================
   Motion prototype — water-drop letters: loosen, detach, fracture, spiral.
   Stand-alone (not part of the site). It validates one thing: the relation
   between the drops, the letters and the spiral paths, as a storyboard you
   can scrub. Materials are deliberately simple (three.js physical glass and
   frosted ice); the production version would keep the site's own shaders.

   Causality, per letter (reading order F → n, one letter every 0.034 of
   the chapter, so nothing happens all at once):
     1  LOOSEN   the drop starts to slide; the letter, buoyant and lagging
                 by inertia, shifts up in the drop and turns slightly
     2  SLIDE    gravity: the drop accelerates down and away (power2.in),
                 stretching along its speed; it leaves the letter behind
     3  DETACH   the letter clears the drop's surface (a bulge, a few
                 drops of water fall back), now hanging free
     4  CRACK    cracks open from the foot of the letter, where the drop
                 left it; pieces break off in order of distance from there
     5  RISE     each piece joins one helix around a single vertical axis:
                 its own radius (swelling, then drawing in), phase (where
                 it broke off), turn rate (inner and smaller = faster) and
                 climb (small pieces lighter = faster); fine ice dust
                 trails each piece on the same path
     6  RESOLVE  A: the pieces come home into the wordmark above the title
                 (the chapter's present ending, which the next chapter's
                 fly-through needs); B: they drift up out of the frame
   One GSAP timeline holds every stage; scrolling (with inertia) or play
   drives its progress.
   ===================================================================== */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as GSAP from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm';
import polygonClipping from 'https://cdn.jsdelivr.net/npm/polygon-clipping@0.15.7/+esm';

const gsap = GSAP.gsap || GSAP.default;
const SVG_URL = '../../images/text_logo3.svg';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const rng = seed => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

/* ---------- stage, light, camera ---------- */
const canvas = document.createElement('canvas'); document.body.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = (() => {   // the site's pale ice-blue plate
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#f1f5fa'); grad.addColorStop(.55, '#dde7f1'); grad.addColorStop(1, '#c8d7e6');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
scene.fog = new THREE.Fog('#d8e3ee', 9.5, 15);   // pieces behind the axis recede into the air: front–back layers
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, .1, 80);
camera.position.set(0, .2, 11); camera.lookAt(0, .35, 0);
// everything lives on one stage, scaled down on narrow screens so the wordmark always fits
const stage = new THREE.Group(); scene.add(stage);
const fitStage = () => { const k = Math.min(1, Math.sqrt(camera.aspect / 1.55)); stage.scale.setScalar(k); stage.position.y = (1 - k) * .9; };
fitStage();
const key = new THREE.DirectionalLight('#ffffff', 1.5); key.position.set(-3, 5, 6); scene.add(key);
scene.add(new THREE.HemisphereLight('#f6f9fc', '#b6c6d5', .55));

const drop = new THREE.MeshPhysicalMaterial({
  color: '#ffffff', transmission: 1, thickness: .45, ior: 1.33, roughness: .02, metalness: 0,
  clearcoat: 1, clearcoatRoughness: .04, attenuationColor: new THREE.Color('#dcecf7'), attenuationDistance: 7, envMapIntensity: 1.1
});
// frosted steel-blue ice: reads against the pale plate, as the site's ice letters do
const ice = new THREE.MeshPhysicalMaterial({ color: '#94acc6', roughness: .22, metalness: 0, clearcoat: 1, clearcoatRoughness: .12, sheen: .6, sheenColor: new THREE.Color('#ffffff'), envMapIntensity: 1.35 });
const brand = new THREE.MeshPhysicalMaterial({ color: '#2e6fd8', roughness: .25, metalness: 0, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.1 });
const water = new THREE.MeshPhysicalMaterial({ color: '#e8f3fb', roughness: .05, metalness: 0, clearcoat: 1, envMapIntensity: 1.6 });

/* ---------- the wordmark, cut into pieces ---------- */
const svg = new SVGLoader().parse(await (await fetch(SVG_URL)).text());
const ring = pts => { const r = pts.map(p => [p.x, -p.y]); r.push(r[0]); return r; };
const toMulti = path => SVGLoader.createShapes(path).map(s => { const e = s.extractPoints(10); return [ring(e.shape), ...e.holes.map(ring)]; });
const ringArea = r => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; };
const ringCentroid = r => { let a = 0, x = 0, y = 0; for (let i = 0; i < r.length - 1; i++) { const c = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += c; x += (r[i][0] + r[i + 1][0]) * c; y += (r[i][1] + r[i + 1][1]) * c; } return [x / (3 * a), y / (3 * a)]; };
const inside = (multi, x, y) => { let n = false; for (const poly of multi) for (const r of poly) for (let i = 0, j = r.length - 2; i < r.length - 1; j = i++) { if (((r[i][1] > y) !== (r[j][1] > y)) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) n = !n; } return n; };
const boxOf = multi => { const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; for (const poly of multi) for (const [x, y] of poly[0]) { b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); } return b; };
function clipHalf(poly, s, o) {   // keep the side of the bisector of s–o that holds s (one Voronoi wall)
  const nx = o[0] - s[0], ny = o[1] - s[1], mx = (s[0] + o[0]) / 2, my = (s[1] + o[1]) / 2, d = p => (p[0] - mx) * nx + (p[1] - my) * ny, out = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length], da = d(a), db = d(b);
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
const DEPTH = 6;   // extrusion, in wordmark units (the letters are ~32 high)
function fracture(multi, count, seed) {
  // Voronoi cells, seeded more densely near the foot of the letter: that is where the drop lets go and the
  // cracks start, so the pieces are small there and large far from it.
  const R = rng(seed), b = boxOf(multi), w = b.x1 - b.x0, h = b.y1 - b.y0, foot = [(b.x0 + b.x1) / 2, b.y0];
  const seeds = []; let guard = 0;
  while (seeds.length < count && guard++ < 8000) {
    const near = R() < .45, x = near ? foot[0] + (R() - .5) * w * .8 : b.x0 + R() * w, y = near ? foot[1] + R() * h * .45 : b.y0 + R() * h;
    if (inside(multi, x, y)) seeds.push([x, y]);
  }
  const frame = [[b.x0 - 3, b.y0 - 3], [b.x1 + 3, b.y0 - 3], [b.x1 + 3, b.y1 + 3], [b.x0 - 3, b.y1 + 3]], pieces = [];
  seeds.forEach((s, i) => {
    let cell = frame;
    seeds.forEach((o, j) => { if (i !== j && cell.length >= 3) cell = clipHalf(cell, s, o); });
    if (cell.length < 3) return;
    for (const poly of polygonClipping.intersection(multi, [[...cell, cell[0]]])) {
      const area = Math.abs(ringArea(poly[0])) - poly.slice(1).reduce((a, r) => a + Math.abs(ringArea(r)), 0);
      if (area > 1.2) pieces.push({ poly, area, centroid: ringCentroid(poly[0]) });
    }
  });
  return { pieces, foot, box: b };
}
function pieceGeometry({ poly, centroid: [cx, cy] }) {
  const v = r => r.slice(0, -1).map(([x, y]) => new THREE.Vector2(x - cx, y - cy));
  const shape = new THREE.Shape(v(poly[0]));
  for (const hole of poly.slice(1)) shape.holes.push(new THREE.Path(v(hole)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -DEPTH / 2); g.computeVertexNormals();
  return g;
}

const letterMultis = svg.paths.slice(0, 11).map(toMulti);
const arcMulti = toMulti(svg.paths[11]);   // the brand-blue arc of the F
const wordBox = boxOf(letterMultis.flat());
const wordCenter = [(wordBox.x0 + wordBox.x1) / 2, (wordBox.y0 + wordBox.y1) / 2];
const S_DROP = .27 / 32;                    // a letter is ~45% of a letter drop
const S_WORD = 4.6 / (wordBox.x1 - wordBox.x0);
const WORD_AT = new THREE.Vector3(0, 1.95, -.3);
const AXIS = new THREE.Vector2(0, -.8);      // the spiral's vertical axis (x, z)

/* ---------- the arc of drops (as the chapter shows them now) ---------- */
const arc = new THREE.CatmullRomCurve3([[-4.3, .3, -.9], [-2.7, .82, .2], [-1, .7, .7], [.6, .3, .6], [2.2, -.25, .1], [3.9, -.85, -.6]].map(p => new THREE.Vector3(...p)));
const order = ['c', 0, 1, 2, 'c', 3, 4, 5, 'c', 6, 7, 8, 'c', 9, 10, 'c'];
const clearSizes = { 0: .15, 4: .2, 8: .17, 12: .21, 15: .13 };
const ballGeo = new THREE.SphereGeometry(1, 48, 32);
// spaced by their own sizes along the arc, with a small gap: a string of drops, not a tube
const radii = order.map((who, k) => who === 'c' ? clearSizes[k] : .29);
const span = radii.reduce((a, r) => a + 2 * r, 0) + .07 * (order.length - 1), arcLength = arc.getLength();
let along = (arcLength - span) / 2;
const drops = order.map((who, k) => {
  along += radii[k]; const home = arc.getPointAt(clamp(along / arcLength)); along += radii[k] + .07;
  const radius = radii[k];
  const mesh = new THREE.Mesh(ballGeo, drop); mesh.scale.setScalar(radius); mesh.position.copy(home); stage.add(mesh);
  return { who, home, radius, mesh, phase: k * 1.7, prev: home.clone(), stretch: 1, slide: 0 };
});

const letters = letterMultis.map((multi, i) => {
  const R = rng(101 + i * 17), area = multi.reduce((a, p) => a + Math.abs(ringArea(p[0])), 0);
  const cut = fracture(multi, clamp(Math.round(area / 42), 5, 11), 7 + i * 31);
  const b = cut.box, center = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  const parts = cut.pieces.map(p => ({ ...p, material: ice }));
  if (i === 0) for (const p of fracture(arcMulti, 2, 5).pieces) parts.push({ ...p, material: brand });
  const dropInfo = drops.find(d => d.who === i);
  const L = {
    i, center, dropInfo, state: { loosen: 0, slide: 0, detach: 0, crack: 0, rise: 0, home: 0 },
    tilt: (R() - .5) * .5, turn: (R() - .5) * .7, freeRot: new THREE.Quaternion(), pieces: []
  };
  const maxDist = Math.max(...parts.map(p => Math.hypot(p.centroid[0] - cut.foot[0], p.centroid[1] - cut.foot[1])));
  const maxArea = Math.max(...parts.map(p => p.area));
  const ranked = parts.map(p => ({ p, d: Math.hypot(p.centroid[0] - cut.foot[0], p.centroid[1] - cut.foot[1]) / maxDist })).sort((a, b) => a.d - b.d);
  ranked.forEach(({ p, d }, rank) => {
    const mesh = new THREE.Mesh(pieceGeometry(p), p.material); stage.add(mesh);
    const size = Math.sqrt(p.area / maxArea);                 // 0 tiny … 1 the biggest piece of this letter
    L.pieces.push({
      mesh, size, rel: .78 * rank / Math.max(1, ranked.length - 1), dist: d,
      home: new THREE.Vector3(p.centroid[0] - center[0], p.centroid[1] - center[1], 0),
      word: new THREE.Vector3(p.centroid[0] - wordCenter[0], p.centroid[1] - wordCenter[1], 0),
      spinAxis: new THREE.Vector3(R() - .5, R() - .5, R() - .5).normalize(), spin: (1.1 + 2.1 * (1 - size)) * Math.PI * (R() < .5 ? -1 : 1),
      swell: .25 + .35 * R(), climb: 1.45 + .6 * (1 - size) + .25 * R(), drift: R(),
      P0: new THREE.Vector3(), kick: new THREE.Vector3(), r0: 1, th0: 0, turns: 1
    });
  });
  return L;
});

/* ---------- where each piece is when it lets go, and its helix from there ---------- */
const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
function letterRotation(L, loosen, detach, out) {
  _e.set(.06 * loosen + .1 * detach, L.turn * (loosen * .5 + detach * .5), L.tilt * (loosen * .6 + detach * .4));
  return out.setFromEuler(_e);
}
for (const L of letters) {
  letterRotation(L, 1, 1, L.freeRot);
  const free = L.dropInfo.home.clone().addScaledVector(UP, .14);
  for (const f of L.pieces) {
    f.P0.copy(f.home).multiplyScalar(S_DROP).applyQuaternion(L.freeRot).add(free);
    const dx = f.P0.x - AXIS.x, dz = f.P0.z - AXIS.y;
    f.r0 = Math.max(.35, Math.hypot(dx, dz)); f.th0 = Math.atan2(dz, dx);
    f.turns = .9 + .35 * (1 - f.size) + .3 * (1 - f.drift);   // one shared sense of turn; smaller and inner (lower drift = smaller ring) faster
    f.kick.copy(f.home).normalize().multiplyScalar(.35).add(_v.set(0, .25, .15));
  }
}
function helix(f, s, out) {
  // a funnel: from where the piece broke off it is drawn into one vortex round the axis, each piece on its own
  // ring (0.5–1.4), breathing a little as it climbs — a single readable column, not a scatter
  const ringR = .5 + .9 * f.drift;
  const r = mix(f.r0, ringR, smooth(0, .7, s)) * (1 + .18 * f.swell * Math.sin(Math.PI * 2 * s));
  const th = f.th0 + f.turns * 2 * Math.PI * s;
  out.set(AXIS.x + Math.cos(th) * r, f.P0.y + f.climb * (s * .75 + .25 * s * s) + (ending === 'drift' ? 3 * smooth(.6, 1, s) : 0), AXIS.y + Math.sin(th) * r);
  const k = clamp(s / .2); out.addScaledVector(f.kick, Math.sin(Math.PI * k) * (1 - k * .4) * .35);
  return out;
}

/* ---------- fine detail: ice dust on the pieces' paths, water falling back from the drops ---------- */
const dustPerPiece = 3, pieceList = letters.flatMap(L => L.pieces.map(f => ({ L, f })));
const dust = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), ice, pieceList.length * dustPerPiece);
const dustSeeds = Array.from({ length: dust.count }, (_, k) => { const R = rng(900 + k); return { lag: .025 + .07 * R(), off: new THREE.Vector3(R() - .5, R() - .5, R() - .5).multiplyScalar(.2), size: .008 + .013 * R(), spin: R() * 6 }; });
const splash = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), water, letters.length * 8);
const splashSeeds = Array.from({ length: splash.count }, (_, k) => { const R = rng(4000 + k), a = R() * Math.PI * 2; return { v: new THREE.Vector3(Math.cos(a) * (.4 + .6 * R()), .9 + 1.1 * R(), Math.sin(a) * .5), size: .02 + .03 * R() }; });
for (const m of [dust, splash]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; stage.add(m); }

/* ---------- the storyboard, as one GSAP timeline ---------- */
const tl = gsap.timeline({ paused: true });
const START = i => .06 + i * .034;
letters.forEach((L, i) => {
  const t0 = START(i), S = L.state;
  tl.to(S, { loosen: 1, duration: .09, ease: 'sine.inOut' }, t0)
    .to(S, { slide: 1, duration: .34, ease: 'power2.in' }, t0 + .03)
    .to(S, { detach: 1, duration: .07, ease: 'power2.out' }, t0 + .085)
    .to(S, { crack: 1, duration: .11, ease: 'power1.inOut' }, t0 + .13)
    .to(S, { rise: 1, duration: .52, ease: 'sine.in' }, t0 + .14)
    .to(S, { home: 1, duration: .16, ease: 'power3.inOut' }, .74 + i * .012);
});
drops.forEach((d, k) => {   // the clear drops slide with their neighbours
  if (d.who !== 'c') return;
  const near = drops.slice(0, k).reverse().find(x => x.who !== 'c') || drops.find(x => x.who !== 'c');
  const t = START(near.who) + .05;
  d.state = { slide: 0 }; tl.to(d.state, { slide: 1, duration: .38, ease: 'power2.in' }, t);
});
tl.set({}, {}, 1);

/* ---------- each frame: read the timeline, place everything ---------- */
let ending = 'assemble', showDust = true;
const _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _id = new THREE.Quaternion();
const anchor = new THREE.Vector3(), _h = new THREE.Vector3(), _o = new THREE.Vector3();
const FALL = new THREE.Vector3();
function place(time, dt) {
  // drops: weight (gravity ease), receding into depth, stretched along their speed, a bulge as the letter leaves
  for (const d of drops) {
    const slide = d.who === 'c' ? d.state.slide : letters[d.who].state.slide;
    FALL.set(Math.sign(d.home.x || 1) * (.45 + .4 * (1 - Math.min(1, Math.abs(d.home.x) / 2))), -1, -.6).normalize();   // away from the title
    d.mesh.position.copy(d.home).addScaledVector(FALL, 5.2 * slide);
    d.mesh.position.y += .03 * Math.sin(time * 1.1 + d.phase) * (1 - slide);
    const speed = dt > 0 ? d.mesh.position.distanceTo(d.prev) / dt : 0; d.prev.copy(d.mesh.position);
    d.stretch = mix(d.stretch, 1 + clamp(speed * .1, 0, .38), .25);
    const bulge = d.who === 'c' ? 0 : Math.sin(Math.PI * letters[d.who].state.detach) * .1;
    _q.setFromUnitVectors(UP, slide > .001 ? FALL : UP);
    d.mesh.quaternion.copy(_q);
    d.mesh.scale.set(d.radius / Math.sqrt(d.stretch), d.radius * (d.stretch + bulge), d.radius / Math.sqrt(d.stretch));
    d.mesh.visible = slide < .999;
  }
  let di = 0, si = 0;
  for (const L of letters) {
    const S = L.state, D = L.dropInfo.mesh.position;
    // while held: lags behind the falling drop and floats up in it; once free: hangs just above where the drop was
    anchor.copy(D).lerp(L.dropInfo.home, .3 * S.loosen).addScaledVector(UP, .04 + .06 * S.loosen);
    const at = anchor.lerp(_w.copy(L.dropInfo.home).addScaledVector(UP, .14), S.detach);
    letterRotation(L, S.loosen, S.detach, _qa);
    // splash: a few drops of water torn off as the letter breaks the surface, falling back
    const tSplash = clamp((tl.time() - (START(L.i) + .085)) * 9);
    for (let k = 0; k < 8; k++, si++) {
      const sd = splashSeeds[si], on = tSplash > 0 && tSplash < 1;
      _v.copy(L.dropInfo.home).addScaledVector(UP, .3).addScaledVector(sd.v, tSplash * .8); _v.y -= 2.4 * tSplash * tSplash;
      _m.compose(_v, _id, _s.setScalar(on ? sd.size * (1 - tSplash * .6) : 0)); splash.setMatrixAt(si, _m);
    }
    for (const f of L.pieces) {
      // cracks open first (a hair-line gap), then the piece lets go and joins its helix
      const gap = smooth(f.rel - .25, f.rel, S.crack) * .02;
      const attached = _v.copy(f.home).multiplyScalar(S_DROP).applyQuaternion(_qa).add(at).addScaledVector(_s.copy(f.home).normalize(), gap);
      const released = smooth(f.rel, f.rel + .14, S.crack);
      const s = clamp((S.rise - f.rel * .3) / (1 - f.rel * .3));
      // pieces grow as they climb towards the viewer: the big ones become the picture, the dust stays fine
      let scale = S_DROP * (1 + 1.3 * smooth(0, .75, s) * released);
      const pos = released > 0 ? helix(f, s, _w.set(0, 0, 0)).lerp(attached, 1 - released) : attached;
      _qb.setFromAxisAngle(f.spinAxis, f.spin * s * released).multiply(_qa);
      if (ending === 'assemble' && S.home > 0) {
        const e = S.home;
        pos.lerp(_h.copy(f.word).multiplyScalar(S_WORD).add(WORD_AT), e);
        _qb.slerp(_id, e); scale = mix(scale, S_WORD, e);
      } else if (ending === 'drift') {
        scale *= 1 - smooth(.62, 1, s);   // melts into the air near the top
      }
      f.mesh.position.copy(pos); f.mesh.quaternion.copy(_qb); f.mesh.scale.setScalar(scale);
      // dust: same path, a little behind, only once the piece is loose, gone as it settles
      for (let k = 0; k < dustPerPiece; k++, di++) {
        const ds = dustSeeds[di], sk = Math.max(0, s - ds.lag);
        const vis = showDust ? released * smooth(0, .05, sk) * (1 - smooth(.7, .95, s)) * (1 - S.home) : 0;
        helix(f, sk, _h).add(_o.copy(ds.off).multiplyScalar(1 + s));
        _qb.setFromAxisAngle(f.spinAxis, ds.spin + time * 2);
        _m.compose(_h, _qb, _s.setScalar(ds.size * vis)); dust.setMatrixAt(di, _m);
      }
    }
  }
  dust.instanceMatrix.needsUpdate = true; splash.instanceMatrix.needsUpdate = true;
}

/* ---------- debug: the axis and a few helices ---------- */
const guides = new THREE.Group(); guides.visible = false; stage.add(guides);
guides.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(AXIS.x, -1.2, AXIS.y), new THREE.Vector3(AXIS.x, 4.2, AXIS.y)]), new THREE.LineBasicMaterial({ color: '#2e6fd8' })));
for (const L of letters) for (const f of L.pieces.filter((_, k) => k % 3 === 0)) {
  const pts = []; for (let s = 0; s <= 1.0001; s += .02) pts.push(helix(f, s, new THREE.Vector3()));
  guides.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#7f98b0', transparent: true, opacity: .55 })));
}

/* ---------- scroll with inertia, play, UI ---------- */
const ui = document.querySelector('.ui'), scrub = ui.querySelector('[data-scrub]'), pOut = ui.querySelector('[data-p]');
const stageOut = ui.querySelector('[data-stage]'), stageItems = [...ui.querySelectorAll('[data-stages] li')];
const STAGES = [[0, '靜止'], [.06, '水滴滑落・字母鬆動'], [.12, '字母脫出'], [.19, '碎裂'], [.27, '螺旋上升'], [.74, '重組成字標']];
let target = 0, p = 0, v = 0, playing = false, speed = 1, last = performance.now();
addEventListener('wheel', e => { if (e.target.closest('.ui')) return; e.preventDefault(); target = clamp(target + e.deltaY * .00055); playing = false; }, { passive: false });
scrub.addEventListener('input', () => { target = p = +scrub.value; v = 0; playing = false; });
ui.querySelector('[data-play]').addEventListener('click', () => { if (target >= 1) target = p = 0; playing = !playing; });
ui.querySelector('[data-rewind]').addEventListener('click', () => { target = p = 0; v = 0; playing = false; });
ui.querySelector('[data-speed]').addEventListener('input', e => { speed = +e.target.value; ui.querySelector('[data-speed-out]').textContent = speed.toFixed(2); });
ui.querySelector('[data-axis]').addEventListener('click', e => { guides.visible = !guides.visible; e.target.setAttribute('aria-pressed', String(guides.visible)); });
ui.querySelector('[data-dust]').addEventListener('click', e => { showDust = !showDust; e.target.setAttribute('aria-pressed', String(showDust)); });
for (const b of ui.querySelectorAll('[data-ending]')) b.addEventListener('click', () => {
  ending = b.dataset.ending;
  for (const x of ui.querySelectorAll('[data-ending]')) x.setAttribute('aria-pressed', String(x === b));
  ui.querySelector('[data-last]').textContent = ending === 'assemble' ? '碎片重組成字標' : '碎片向上飄散出畫面';
  STAGES[5][1] = ending === 'assemble' ? '重組成字標' : '向上飄散';
});
addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); playing = !playing; } });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); fitStage(); });

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (playing) { target = clamp(target + dt * speed / 9); if (target >= 1) playing = false; }
  // critically damped spring (~0.6 s to catch up): the page's scroll inertia
  const omega = 7, x = p - target, decay = Math.exp(-omega * dt), tmp = (v + omega * x) * dt;
  p = target + (x + tmp) * decay; v = (v - omega * tmp) * decay;
  tl.time(clamp(p));
  place(now / 1000, dt);
  renderer.render(scene, camera);
  scrub.value = String(p); pOut.textContent = p.toFixed(3);
  let k = 0; for (let j = 0; j < STAGES.length; j++) if (p >= STAGES[j][0]) k = j;
  stageOut.textContent = STAGES[k][1]; stageItems.forEach((li, j) => li.classList.toggle('on', j === k));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* for scripted review: window.__PROTO__.set(p, ending) */
window.__PROTO__ = { set(value, end) { if (end) ui.querySelector(`[data-ending="${end}"]`).click(); target = p = clamp(value); v = 0; playing = false; }, get p() { return p; }, letters, drops, renderer };
