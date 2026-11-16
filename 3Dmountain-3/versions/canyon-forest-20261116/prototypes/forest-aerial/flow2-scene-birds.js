/* Flow2 · the forest view's SEAGULLS (2026-11-15, AIR2). Loaded by prototypes/index1-5-flow/flow2-forest-atlas.js only (?birds=0 leaves it out).
   Client: 「你看一下人家的海鷗 跟雲層還有精細感」. Method only; every part is made here in code (no picture, no model from anywhere).
   - A few small white gulls over the view: now and then a loose flock (3–7) crosses the frame, and one or two birds fly alone (slower, longer
     glides, sometimes a few lazy circles before they leave). Gentle flaps in short bursts, long glides with the gull's bent "M" wing, banking
     into every turn. They fly at 1.45–1.9 (world units; the land tops out near 1.0, the clouds start at 2.0), so they slide over the land with
     the lens (parallax) and pass under the cloud banks.
   - Paths are picked so that a bird never stays over the title block or the four labels: each candidate path is projected with the lens and
     rejected when it would linger there.
   - ONE instanced mesh, ~30 triangles per bird (body + two three-part wings with a spine), wings folded and flapped in the vertex shader;
     edges faded over ~1 px with screen derivatives (no MSAA in the forest target), so a 2-px wing never shimmers.
   - Tiny soft shadows: the birds' places go to the air module's shadow map (window.__FLOW2_FOREST_AIR__.spots), which the land already reads.
   Tiers (window.__FLOW2_QUALITY__.rank): 2 = flock up to `flock` + `solos`; 1 = flock ≤ 3 + one solo; 0 = none. Reduce motion: no birds.
   API: createForestBirds(renderer, { reducedMotion, atlas, tune, shared }) → { group, tune, state, update(dt, tune?), setTier(rank), dispose() }.
   Dials: panel 「海鷗」 key S (registered here). */
import * as THREE from 'three';

const MAX = 9;                    // instances: 0–6 the flock, 7–8 the solos
const VERT = `
  attribute vec4 iPos;            // xyz, scale (semi-span, world units)
  attribute vec4 iRot;            // heading, bank, flap phase, wing fold (glide)
  attribute vec4 iWing;           // flap amount, alpha, albedo tint, (unused)
  attribute vec3 aPart;           // 0 body / 1 wing, edge (0 rim … 1 spine), albedo
  uniform vec3 uSun; uniform float uFlap;
  varying float vEdge, vAlpha, vLight, vAlb;
  void main(){
    vAlpha=iWing.y;
    if(vAlpha<.003){ gl_Position=vec4(2.,2.,2.,1.); return; }
    vec3 p=position, n=vec3(0.,1.,0.);
    if(aPart.x>.5){
      /* the wing: an inner part to the wrist (span .42) and an outer part that lags the beat and droops in a glide (the gull's bent wing) */
      float side=sign(p.z), span=abs(p.z), f=iWing.x*uFlap, ph=iRot.z, fold=iRot.w;
      float a1=f*sin(ph)*.62+(1.-f)*.13*fold;
      float a2=a1+f*sin(ph-.95)*.5-(1.-f)*.3*fold;
      float s1=min(span,.42), s2=max(span-.42,0.);
      p=vec3(p.x+s2*s2*.18*f*cos(ph),s1*sin(a1)+s2*sin(a2),side*(s1*cos(a1)+s2*cos(a2)));
      float a=span>.42?a2:a1; n=vec3(0.,cos(a),-side*sin(a));
    }
    float cb=cos(iRot.y), sb=sin(iRot.y);                                        /* bank: + = the right wing down */
    p=vec3(p.x,p.y*cb-p.z*sb,p.y*sb+p.z*cb); n=vec3(n.x,n.y*cb-n.z*sb,n.y*sb+n.z*cb);
    float ch=cos(iRot.x), sh=sin(iRot.x);                                        /* heading: local x (forward) → (cos, 0, sin) in x / z */
    p=vec3(p.x*ch-p.z*sh,p.y,p.x*sh+p.z*ch); n=vec3(n.x*ch-n.z*sh,n.y,n.x*sh+n.z*ch);
    vec3 w=iPos.xyz+p*iPos.w;
    vLight=.5+.56*max(dot(n,uSun),0.)+.08*n.y;
    vEdge=aPart.y; vAlb=aPart.z*iWing.z;
    gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);
  }`;
const FRAG = `
  uniform float uBright;
  varying float vEdge, vAlpha, vLight, vAlb;
  void main(){
    float aa=clamp(vEdge/max(fwidth(vEdge)*.95,1e-4),0.,1.);                    /* the rim faded over about a pixel */
    float a=aa*vAlpha; if(a<.004) discard;
    vec3 col=vec3(vAlb*vLight*uBright)*vec3(1.,.995,.985);
    gl_FragColor=vec4(col*a,a);
  }`;

/* one gull, local units: x forward, z right, y up; the semi-span is 1 */
function gullGeometry() {
  const pos = [], part = [], idx = [];
  const v = (x, y, z, wing, edge, alb) => { pos.push(x, y, z); part.push(wing, edge, alb); return pos.length / 3 - 1; };
  /* body: a spine nose → tail, a rim on each side; the tail a small fan */
  const body = [[.28, 0, .9], [.2, .026, .94], [.03, .044, .95], [-.16, .03, .93], [-.29, .05, .9]];
  const rows = body.map(([x, w, alb], i) => [v(x, .012, -w, 0, 0, alb), v(x, .02, 0, 0, i === 0 ? 0 : 1, alb), v(x, .012, w, 0, 0, alb)]);
  for (let i = 0; i < rows.length - 1; i++) { const [a0, b0, c0] = rows[i], [a1, b1, c1] = rows[i + 1]; idx.push(a0, b0, a1, b0, b1, a1, b0, c0, b1, c0, c1, b1); }
  /* wings: stations along the span (root, wrist, outer, tip): leading x, trailing x, albedo (pale grey mantle, dark tips) */
  const st = [[.045, .085, -.085, .8], [.42, .115, -.05, .78], [.74, .02, -.09, .6], [1, -.165, -.172, .14]];
  for (const side of [1, -1]) {
    const R = st.map(([z, L, T, alb], i) => { const tip = i === st.length - 1;
      return [v(L, 0, side * z, 1, 0, alb), v((L + T) / 2, 0, side * z, 1, tip ? 0 : 1, alb), v(T, 0, side * z, 1, 0, alb)]; });
    for (let i = 0; i < R.length - 1; i++) {
      const [l0, s0, t0] = R[i], [l1, s1, t1] = R[i + 1];
      if (side > 0) idx.push(l0, l1, s0, s0, l1, s1, s0, s1, t0, t0, s1, t1); else idx.push(l0, s0, l1, s0, s1, l1, s0, t0, s1, t0, t1, s1);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 3)); g.setIndex(idx);
  return g;
}

export function createForestBirds(renderer, options = {}) {
  const reduced = !!options.reducedMotion, atlas = options.atlas || {}, shared = options.shared || window.__FLOW2_FOREST_AIR__ || null;
  const camera = options.camera || atlas.camera;
  const DEFAULTS = { on: 1, flock: 5, solos: 2, size: 1, speed: 1, every: 15, height: 1, flap: 1, shadow: 1, bright: 1 };
  const tune = options.tune || {};
  for (const k in DEFAULTS) if (!Number.isFinite(+tune[k])) tune[k] = DEFAULTS[k];
  if (options.panel !== false) window.__FLOW2_PANEL__?.add({ id: 'forestbirds', title: '海鷗', key: 's', tune, rows: [
    ['海鷗（1 開 / 0 關）', 'on', 0, 1, 1], ['一群最多幾隻', 'flock', 0, 7, 1], ['單飛的海鷗', 'solos', 0, 2, 1], ['多久來一群（秒）', 'every', 4, 60, 1],
    ['大小', 'size', .4, 2.5, .01], ['速度', 'speed', .2, 3, .01], ['飛行高度（倍）', 'height', .7, 1.4, .01], ['拍翅幅度', 'flap', 0, 2, .01],
    ['影子', 'shadow', 0, 1, .01], ['亮度', 'bright', .5, 1.5, .01]
  ] });
  const state = { stage: 'ready', tier: 2, active: 0, flocks: 0, solos: 0, version: 'birds-2' };

  /* ---------------------------------------------------------------- the mesh */
  const geometry = gullGeometry();
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4), iRot = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4), iWing = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
  for (const a of [iPos, iRot, iWing]) a.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('iPos', iPos); geometry.setAttribute('iRot', iRot); geometry.setAttribute('iWing', iWing); geometry.instanceCount = MAX;
  const sun = atlas.uniforms?.uSun?.value?.isVector3 ? atlas.uniforms.uSun.value : new THREE.Vector3(-.6881, .6001, -.408).normalize();
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uSun: { value: sun }, uFlap: { value: 1 }, uBright: { value: 1 } },
    transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
  material.toneMapped = false;
  const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = 50; mesh.name = 'Forest gulls';
  const group = new THREE.Group(); group.name = 'Forest birds'; group.add(mesh);

  /* ---------------------------------------------------------------- flight */
  let seed = 1234567; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const R = (a, b) => a + (b - a) * rnd();
  const v3 = new THREE.Vector3(), ray = new THREE.Vector3();
  /* the frame on the plane y = h (axis-aligned box of the four corner rays) */
  function frameOn(h) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < 4; i++) {
      ray.set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, .5).unproject(camera).sub(camera.position).normalize();
      const k = ray.y < -1e-3 ? (h - camera.position.y) / ray.y : 30, x = camera.position.x + ray.x * k, z = camera.position.z + ray.z * k;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, ax: (x1 - x0) / 2, az: (z1 - z0) / 2 };
  }
  const screenOf = (x, y, z) => { v3.set(x, y, z).project(camera); return [(v3.x * .5 + .5), (.5 - v3.y * .5)]; };
  /* places a bird must not linger over (screen shares): the title block and the four labels */
  function busy(sx, sy) {
    if (sx > .27 && sx < .73 && sy > .58 && sy < .92) return 2;
    const W = innerWidth || 1880, H = innerHeight || 930;
    if (atlas.anchors) for (let k = 0; k < atlas.anchors.length; k++) {
      const [ax, ay] = screenOf(atlas.anchors[k].x, atlas.anchors[k].y, atlas.anchors[k].z), side = W >= 760 ? (k === 1 ? -1 : 1) : 1;
      const cx = ax + side * 88 / W; if (Math.abs(sx - cx) < 135 / W && Math.abs(sy - ay) < 46 / H) return 1;
    }
    return 0;
  }
  /* a path: a cubic Bézier across the frame (flock, solo), or a few lazy circles that leave along their tangent (solo) */
  function crossing(h, solo) {
    const F = frameOn(h);
    let best = null, bestScore = Infinity;
    for (let tries = 0; tries < 10; tries++) {
      const dir = rnd() < .5 ? 1 : -1, vertical = rnd() < .22;
      let P;
      if (!vertical) {                                                              // west ↔ east, in the upper two thirds of the frame
        const za = F.cz + F.az * R(-.85, .25), zb = F.cz + F.az * R(-.85, .3);
        P = [[F.cx - dir * (F.ax + 1.1), za], [F.cx - dir * F.ax * R(.2, .5), za + F.az * R(-.35, .35)], [F.cx + dir * F.ax * R(.2, .5), zb + F.az * R(-.35, .35)], [F.cx + dir * (F.ax + 1.1), zb]];
      } else {                                                                      // a diagonal from a side corner
        const xa = F.cx + dir * F.ax * R(.55, .95), xb = F.cx - dir * F.ax * R(.2, .9);
        P = [[xa + dir * .9, F.cz - F.az - 1.1], [xa, F.cz - F.az * .3], [xb, F.cz + F.az * R(-.2, .3)], [xb - dir * 2.5, F.cz + F.az + 1.1]];
      }
      const path = bezierPath(P, h);
      let score = 0; for (let i = 1; i < 20; i++) { const p = path.at(path.length * i / 20); const [sx, sy] = screenOf(p.x, h, p.z); score += busy(sx, sy); }
      if (score < bestScore) { best = path; bestScore = score; } if (score === 0) break;
    }
    if (solo && rnd() < .38) return circlePath(best, F, h);
    return best;
  }
  function bezierPath(P, h) {
    const N = 64, pts = [], acc = [0];
    for (let i = 0; i <= N; i++) { const t = i / N, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      pts.push([a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]]); }
    for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const length = acc[N];
    return { length, h, at(s) {
      s = Math.max(0, Math.min(length, s)); let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (acc[m] <= s) lo = m; else hi = m; }
      const f = (s - acc[lo]) / Math.max(1e-6, acc[hi] - acc[lo]), x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, z = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f;
      return { x, z, heading: Math.atan2(pts[hi][1] - pts[lo][1], pts[hi][0] - pts[lo][0]) };
    } };
  }
  /* fly the first third of a crossing, circle 1–2 times (radius ~1), leave along the crossing's last part */
  function circlePath(base, F, h) {
    const s0 = base.length * .36, p0 = base.at(s0), r = R(.8, 1.2), turn = rnd() < .5 ? 1 : -1, loops = R(1, 1.8) * Math.PI * 2;
    const cx = p0.x - Math.sin(p0.heading) * r * turn, cz = p0.z + Math.cos(p0.heading) * r * turn, a0 = Math.atan2(p0.z - cz, p0.x - cx);
    const L1 = s0, L2 = loops * r, rest = base.length - s0;
    return { length: L1 + L2 + rest, h, at(s) {
      if (s <= L1) return base.at(s);
      if (s <= L1 + L2) { const a = a0 + turn * (s - L1) / r; return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, heading: a + turn * Math.PI / 2 }; }
      return base.at(s0 + (s - L1 - L2));
    } };
  }
  const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const birds = Array.from({ length: MAX }, (_, i) => ({ i, on: false, path: null, s: 0, speed: 0, back: 0, sideOff: 0, lift: 0, wander: R(0, 6.28), heading: 0, bank: 0,
    phase: R(0, 6.28), rate: R(2.1, 2.6), flap: 0, flapWant: 1, timer: R(.2, 1.5), size: 1, tint: 1, alpha: 0, x: 0, y: 0, z: 0, solo: i >= 7 }));
  let flockTimer = 1.4, soloTimer = .8, first = true, tier = 2, wall = 0;
  function startFlock(n) {
    const h = R(1.5, 1.82) * tune.height, path = crossing(h, false), speed = R(.48, .58);
    for (let k = 0; k < 7; k++) { const b = birds[k]; b.on = k < n; if (!b.on) continue;
      const row = Math.ceil(k / 2), side = k === 0 ? 0 : (k % 2 ? 1 : -1);
      Object.assign(b, { path, speed, s: 0, back: row * R(.15, .24), sideOff: side * row * R(.11, .18), lift: R(-.07, .07), size: R(.9, 1.1), tint: R(.95, 1.03),
        timer: R(0, 1.2), flapWant: 1, alpha: 0 });
    }
    state.flocks++;
  }
  function startSolo(b, inside) {
    const h = R(1.45, 1.9) * tune.height, path = crossing(h, true);
    Object.assign(b, { on: true, path, speed: R(.36, .45), s: inside ? path.length * R(.3, .45) : 0, back: 0, sideOff: 0, lift: 0, size: R(.95, 1.12), tint: R(.97, 1.03), timer: R(.5, 2), flapWant: 0, alpha: inside ? 1 : 0 });
    state.solos++;
  }
  function writeOff(i) { iWing.array[i * 4 + 1] = 0; }

  const api = {
    group, tune, state,
    setTier(rank) { tier = rank; state.tier = rank; },
    update(dt, liveTune) {
      if (liveTune && liveTune !== tune) Object.assign(tune, liveTune);
      const q = window.__FLOW2_QUALITY__; if (q && Number.isFinite(+q.rank)) { tier = +q.rank; state.tier = tier; }
      const on = !reduced && tier > 0 && tune.on >= .5 && !!camera;
      group.visible = on;
      const spots = shared ? (shared.spots instanceof Float32Array && shared.spots.length === 32 ? shared.spots : (shared.spots = new Float32Array(32))) : null;
      if (!on) { if (spots) spots.fill(0); return; }
      const step = Math.min(Math.max(dt || 0, 0), .05); wall += step;
      const maxFlock = Math.max(0, Math.min(7, Math.round(tier > 1 ? tune.flock : Math.min(3, tune.flock)))), maxSolo = Math.max(0, Math.min(2, Math.round(tier > 1 ? tune.solos : Math.min(1, tune.solos))));
      /* the schedule: the first flock soon after the view arrives, then one every `every` seconds (± 40 %); solos keep coming back */
      const flockFlying = birds.slice(0, 7).some(b => b.on);
      flockTimer -= step; if (!flockFlying && flockTimer <= 0 && maxFlock >= 1) { startFlock(Math.max(1, Math.min(maxFlock, Math.round(R(3, maxFlock + .49))))); flockTimer = Math.max(4, tune.every) * R(.6, 1.4); }
      soloTimer -= step;
      if (soloTimer <= 0) { const free = birds.slice(7, 7 + maxSolo).find(b => !b.on); if (free) startSolo(free, first); soloTimer = R(2.5, 7); first = false; }
      let n = 0, seen = 0;
      for (const b of birds) {
        const i = b.i;
        if (!b.on || (b.solo && b.i - 7 >= maxSolo)) { if (b.on && b.solo) b.on = false; writeOff(i); continue; }
        b.s += step * b.speed * tune.speed;
        const sAt = b.s - b.back;
        if (sAt > b.path.length + .2) { b.on = false; writeOff(i); continue; }
        const p = b.path.at(sAt), ahead = b.path.at(sAt + .35);
        b.wander += step * .31;
        const nx = -Math.sin(p.heading), nz = Math.cos(p.heading), wob = Math.sin(b.wander) * .045, side = b.sideOff + wob;
        b.x = p.x + nx * side; b.z = p.z + nz * side; b.y = b.path.h + b.lift + Math.sin(b.wander * 1.3 + 1) * .035;
        /* heading eases toward the path's; bank from the turn ahead */
        const want = p.heading + Math.sin(b.wander * .8) * .06, turnAhead = angle(ahead.heading - p.heading) / .35;
        b.heading += angle(want - b.heading) * (1 - Math.exp(-step * 5));
        b.bank += (Math.max(-.6, Math.min(.6, turnAhead * .55)) - b.bank) * (1 - Math.exp(-step * 2.5));
        /* flap bursts and glides */
        b.timer -= step;
        if (b.timer <= 0) { if (b.flapWant > .5) { b.flapWant = 0; b.timer = b.solo ? R(2.8, 6) : R(1.6, 3.6); } else { b.flapWant = 1; b.timer = (b.solo ? R(2, 3.2) : R(2, 4.2)) / b.rate; } }
        b.flap += (b.flapWant - b.flap) * (1 - Math.exp(-step * (b.flapWant ? 6 : 2.2)));
        b.phase += step * b.rate * Math.PI * 2 * (.35 + .65 * b.flap);
        /* fade in / out only at the path's ends (they start and end outside the frame anyway) */
        const fade = Math.min(1, sAt / .6, (b.path.length - sAt) / .6);
        b.alpha = Math.max(0, Math.min(1, fade));
        const o = i * 4, size = .07 * tune.size * b.size;
        iPos.array[o] = b.x; iPos.array[o + 1] = b.y; iPos.array[o + 2] = b.z; iPos.array[o + 3] = size;
        iRot.array[o] = b.heading; iRot.array[o + 1] = b.bank; iRot.array[o + 2] = b.phase; iRot.array[o + 3] = 1;
        iWing.array[o] = b.flap; iWing.array[o + 1] = b.alpha; iWing.array[o + 2] = b.tint; seen++;
        if (spots && n < 8) { spots[n * 4] = b.x; spots[n * 4 + 1] = b.y; spots[n * 4 + 2] = b.z; spots[n * 4 + 3] = size * .62 * Math.max(0, tune.shadow) * b.alpha; n++; }
      }
      if (spots) for (let k = n; k < 8; k++) spots[k * 4 + 3] = 0;
      state.active = seen;
      iPos.needsUpdate = iRot.needsUpdate = iWing.needsUpdate = true;
      material.uniforms.uFlap.value = tune.flap; material.uniforms.uBright.value = tune.bright;
    },
    dispose() { group.removeFromParent(); geometry.dispose(); material.dispose(); if (shared?.spots) shared.spots.fill(0); state.stage = 'off'; }
  };
  return api;
}
