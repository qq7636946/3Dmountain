/* Flow2 · after FOUR PATHS: THE DIVE (team LZ, 2026-11-17). index1-5-canyon-forest.html; driven by flow2-lake-zoom.js (its default mode).
   Client: 「webgl 的中心點打開的轉場還不夠好 請認真思考我之前給你的網址」 (the OceanX globe → first chapter move; zoom wanted this time, still no grid).
   Only the idea is taken, nothing of theirs. One notch past FOUR PATHS plays it on time (≈ 1.5 s); about two notches up at the next block's top
   play it backwards (same rule as the brush version before).
     · the lens dives into the screen centre, faster and faster (the outer camera moves along its own line of sight; the world point under the
       screen centre stays there). The point: window.__FLOW2_RIVER__.centreTarget() when team RV's river travel provides it, else the lake's
       centre (the aim slides to it in the first half, so nothing jumps);
     · thin turquoise / white streaks fly outward with the zoom (they are fixed in the world: their speed is the zoom's speed), a faint soft
       light at the centre;
     · a soft circle opens in the middle: inside, the SAME spot seen from a camera much closer (a second render of the same scene, scissored to
       the circle, no clouds layer). The circle is a lens: the outer picture is magnified toward its middle and pressed together at its rim,
       so outside → rim → inside is one continuous picture, and the sharp near view takes over inside the rim's soft band;
     · the circle grows past the corners while the two cameras converge (at the moment it covers the screen they are the same camera: no seam);
       the close water then settles: it sinks into the next block's navy (a little of the water stays under the block as its ground), the
       block's HTML comes in.
   Cost: the second render only between the circle's birth and its full cover, scissored to the circle; one full-screen composite pass while
   the dive plays. The composite program is compiled in the background and both targets are allocated near FOUR PATHS (no first-play hitch).
   Interface (used by flow2-lake-zoom.js): window.__FLOW2_LAKE_DIVE__ = { tune, state, curve(t), warm(r, src, atlas, THREE, journey),
   render(r, src, atlas, THREE, t, closing) → texture, set(t), free() }. Dials: tune (live). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { return false; } })();
  const T = {
    time: num('diveTime', 1.5),      // seconds, the dive in
    closeTime: num('diveBack', 1.2), // seconds, back out
    t0: .17,                         // the circle is born (share of the dive)
    t1: .82,                         // … it covers the screen; the two cameras are one
    kb: 3,                           // at birth the inner view is this much closer than the outer one
    miEnd: num('diveDepth', 14),     // the near view's magnification at the end (× the composed view)
    p: 2.2,                          // the outer zoom's acceleration (power)
    down: .3,                        // how far the line of sight turns toward straight down as the lens closes in (0 = keeps its tilt)
    bulge: 4,                        // the lens profile: high = the magnification is even inside and the pressing sits at the rim
    aberr: .010,                     // colour fringe in the rim band
    featherK: .38, featherMax: .2,   // the soft edge: share of the radius, capped (short-side units)
    blur: .011,                      // the outer picture's radial speed blur per unit of zoom speed
    streak: .5, glow: .09, rim: .035, // light (restrained: the rim light only once the circle is large, never a small ring)
    deep: .84,                       // how far the close water sinks into the navy (1 = the plain navy; the block's ground keeps 1 - deep of it)
    settleFrom: .78,
    /* DROP (2026-11-22, client: 「轉場仿照 cosmicenterprises.co 這段」, their drop gate: a bead of light condenses at the centre and swells into a
       water drop with the next world inside, which swallows the frame; method only, nothing of theirs). why-sea.js sets drop = 1 on the rise page
       (?dive=lens there = the lens dive as before; other pages keep 0). The circle becomes a crisp-skinned drop that stays small, then rushes;
       the close camera is not rendered (the next block fills the drop, why-sea.js draws its skin); a bead of light first; the outer picture
       streams toward the drop (radial zoom blur, more taps) and brightens a little. */
    drop: num('diveDrop', 0),
    dropP: 2.2,          // the drop's growth power (high = it stays small longer, then rushes)
    bead: .012,          // the drop's radius at birth (short-side units)
    dropF: .0025,        // the edge's softness (short-side units: crisp)
    dropBlur: .26,       // the outer picture's radial zoom blur at its strongest
    beadGlow: .9,        // the bead of light before the drop
    dropStreak: .35,     // the streaks' strength (× streak)
    dropLift: .5         // how much the outer picture brightens toward the drop
  };
  const S = { t: 0, used: null, frames: 0, warm: { compiled: false, asked: false, rt: false, freed: 0 }, hooked: false, centre: '', inner: 0, scissor: '' };
  const clamp01 = v => Math.min(1, Math.max(0, v)), sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* ---------------- the curves (one place: the camera hook, the inner camera and the composite read the same numbers) ---------------- */
  function curve(t, aspect) {
    t = clamp01(t);
    const { t0, t1, kb, miEnd, p } = T;
    const eo = u => 1 - (1 - u) * (1 - u);
    const ui = x => clamp01((x - t0) / (1 - t0));
    /* L = ln(outer magnification at t1) = ln(inner magnification at t1); the inner one starts kb × the outer one at t0 (fixed point) */
    let L = Math.log(miEnd) * .95;
    for (let i = 0; i < 8; i++) { const mib = kb * Math.exp(L * Math.pow(t0 / t1, p)); L = Math.log(mib * Math.pow(miEnd / mib, eo(ui(t1)))); }
    const mib = kb * Math.exp(L * Math.pow(t0 / t1, p));
    const lnMo = x => x <= t1 ? L * Math.pow(x / t1, p) : Math.log(mib * Math.pow(miEnd / mib, eo(ui(x))));
    const lo = lnMo(t), mo = Math.exp(lo);
    const mi = t < t0 ? mo : mib * Math.pow(miEnd / mib, eo(ui(t)));
    const K = t < t0 || t >= t1 ? 1 : Math.max(1, mi / mo);
    /* the circle (short-side units): from nothing at t0 to past every corner (its inner, sharp part included) at t1 */
    const asp = aspect || 2, hd = .5 * Math.sqrt(1 + Math.pow(Math.max(asp, 1 / asp), 2));
    const Rcov = hd + .04 + 1.6 * T.featherMax;
    const u2 = clamp01((t - t0) / (t1 - t0));
    const D = T.drop > 0;
    const R = t < t0 ? 0 : t >= t1 ? Rcov * 1.15 : D ? T.bead * sm(0, .08, u2) + (Rcov - T.bead) * Math.pow(u2, T.dropP) : Rcov * Math.pow(u2, 1.7);
    const F = D ? T.dropF : Math.max(.012, Math.min(T.featherMax, T.featherK * R));
    const eps = .004, speed = (lnMo(Math.min(1, t + eps)) - lnMo(Math.max(0, t - eps))) / (Math.min(1, t + eps) - Math.max(0, t - eps)) / T.time;   // d ln(zoom) / second
    return {
      t, mo, mi, K, R, F, lnMo: lo, speed, inner: !D && t >= t0 && t < t1 && R > .02, drop: D,
      glow: D ? T.beadGlow * sm(0, .12, t) * (1 - sm(t0 + .01, t0 + .12, t)) : T.glow * sm(.03, .2, t) * (1 - sm(.3, .55, t)),
      streak: (D ? T.dropStreak : 1) * T.streak * sm(.04, .22, t) * (1 - sm(.6, .84, t)),
      rim: D ? 0 : T.rim * sm(.3, .55, u2) * (1 - sm(.75, 1, u2)),
      blurD: D ? T.dropBlur * sm(.04, .6, t) * (1 - sm(t1, Math.min(1, t1 + .12), t)) : 0,
      lift: D ? T.dropLift * sm(.08, .55, t) : 0,
      settle: sm(T.settleFrom, 1, t)
    };
  }

  /* ---------------- the cameras ---------------- */
  let V = null;   // THREE scratch, made on first use
  function vecs(THREE) {
    if (V) return V;
    V = { THREE, P0: new THREE.Vector3(), S0: new THREE.Vector3(), C: new THREE.Vector3(), T: new THREE.Vector3(), V0: new THREE.Vector3(), up: new THREE.Vector3(), fwd: new THREE.Vector3(),
      tmp: new THREE.Vector3(), Y: new THREE.Vector3(0, 1, 0), inner: new THREE.PerspectiveCamera(16, 2, .05, 200), base: null };
    return V;
  }
  /* the dive's target: the point under the screen centre at the end of team PN's pan (flow2-aerial-pan.js, 2026-11-17: 「可以從最左上橫移到左下後
     再轉場嗎」), else team RV's point (when their travel has ended there), else the lake's centre */
  function centre(atlas, out) {
    const P = window.__FLOW2_AERIAL_PAN__;
    if (P && typeof P.centreTarget === 'function' && P.ready) {
      try { const c = P.centreTarget(); if (c && Number.isFinite(+c.x) && Number.isFinite(+c.z)) { out.set(+c.x, Number.isFinite(+c.y) ? +c.y : .105, +c.z); S.centre = c.water ? 'pan · ' + c.water : 'pan'; return out; } } catch (error) { }
    }
    const R = window.__FLOW2_RIVER__;
    if (R && typeof R.centreTarget === 'function' && (R.ready === undefined || R.ready)) {
      try { const c = R.centreTarget(); if (c && Number.isFinite(+c.x) && Number.isFinite(+c.z)) { out.set(+c.x, Number.isFinite(+c.y) ? +c.y : .105, +c.z); S.centre = 'river'; return out; } } catch (error) { }
    }
    if (atlas && atlas.lake && atlas.lake.center) { out.copy(atlas.lake.center); S.centre = 'lake'; return out; }
    out.set(0, .105, 0); S.centre = 'origin'; return out;
  }
  /* a camera at magnification m along the dive (both cameras use it: same target, same rule, so their centres meet) */
  function place(cam, m, aim, base) {
    const v = V.tmp.copy(base.V0dir);
    const g = Math.min(1, Math.log(Math.max(1, m)) / Math.log(Math.max(1.01, T.miEnd)));
    if (T.down > 0) v.lerp(V.Y, T.down * g * g).normalize();
    cam.position.copy(V.T).addScaledVector(v, base.dist / Math.max(1, m));
    cam.up.copy(base.up); cam.lookAt(V.T); cam.updateMatrixWorld();
  }
  /* atlas.onUpdate: runs after the scene built its own camera for the frame; while the dive plays the outer camera closes in */
  function hook(frame) {
    if (S.t <= 0 || reduced || !V) { S.used = null; return; }
    const cam = frame.camera, c = curve(S.t, cam.aspect);
    const b = V.base || (V.base = { V0dir: new V.THREE.Vector3(), up: new V.THREE.Vector3(), dist: 1 });
    V.P0.copy(cam.position);
    V.fwd.set(0, 0, -1).transformDirection(cam.matrixWorld);
    V.up.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
    centre(S.atlas, V.C);
    /* the point under the screen centre (on the target's level); the aim slides from it to the target in the first half */
    const k = V.fwd.y < -1e-3 ? (V.C.y - V.P0.y) / V.fwd.y : V.P0.distanceTo(V.C);
    V.S0.copy(V.P0).addScaledVector(V.fwd, k);
    V.T.copy(V.S0).lerp(V.C, sm(0, .45, c.t));
    b.V0dir.copy(V.P0).sub(V.S0); b.dist = b.V0dir.length(); b.V0dir.normalize(); b.up.copy(V.up);
    place(cam, c.mo, V.T, b);
    S.used = { t: c.t, mo: c.mo, aspect: cam.aspect, fov: cam.fov, dist: b.dist };
  }

  /* ---------------- the composite ---------------- */
  const FRAG = `
    uniform sampler2D tOuter, tInner; uniform vec2 uRes; uniform vec4 uA, uB, uC, uD; varying vec2 vUv;
    /* uA = (radius, feather, K = inner / outer magnification, inner on); uB = (t, blur, ln zoom, streaks); uC = (glow, rim, settle, deep);
       uD = (lens profile power, colour fringe, reduce, drop: 0 = off, 1 + brightening = on). Short-side units: 1 = the screen's short side, 0 = its centre. */
    float h1(float n){ return fract(sin(n * 127.1 + .7) * 43758.5453); }
    vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
    /* the next block's ground: its CSS radial-gradient(120% 90% at 50% 0%, #10314f, #0a1d33 46%, #061222) */
    vec3 navy(vec2 uv){ float g = length(vec2((uv.x - .5) / 1.2, (1. - uv.y) / .9));
      vec3 c = g < .46 ? mix(vec3(.0627, .1922, .3098), vec3(.0392, .1137, .2), g / .46) : mix(vec3(.0392, .1137, .2), vec3(.0235, .0706, .1333), clamp((g - .46) / .54, 0., 1.));
      return lin(c); }
    void main(){
      float m = min(uRes.x, uRes.y);
      vec2 k2 = m / uRes;
      vec2 p = (vUv - .5) / k2; float d = length(p); vec2 dir = d > 1e-5 ? p / d : vec2(1., 0.);
      float t = uB.x;
      if (uD.z > .5) { vec3 c0 = texture2D(tOuter, vUv).rgb; gl_FragColor = vec4(mix(c0, navy(vUv), uC.z * uC.w), 1.); return; }
      float R = uA.x, F = max(uA.y, 1e-3), K = max(uA.z, 1.);
      float openW = R > 0. ? 1. - smoothstep(R - F, R + F * .3, d) : 0.;
      /* outside: the far view, zooming; a radial speed blur toward the centre */
      vec3 outer = vec3(0.);
      if (openW < .999) {
        float bl = uB.y;
        if (bl > .002) { vec3 acc = vec3(0.); float ws = 0.;
          float jt = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));   /* per-pixel offset: a smooth smear, no ghost copies */
          for (int i = 0; i < TAPS; i++) { float f = (float(i) + jt) / float(TAPS); float w = 1. - f * .6; acc += texture2D(tOuter, .5 + p * (1. - bl * f) * k2).rgb * w; ws += w; }
          outer = acc / ws; }
        else outer = texture2D(tOuter, vUv).rgb;
      }
      if (uD.w > .5) outer = mix(outer, outer * 1.05 + vec3(.012, .026, .032), clamp(uD.w - 1., 0., 1.));   /* DROP: the picture brightens toward the drop's light */
      vec3 col = outer;
      if (openW > .001) {
        /* the lens: the outer picture magnified K × toward the middle, pressed together at the rim (continuous with the outside at the rim) */
        float x = clamp(d / R, 0., 1.), xn = pow(x, uD.x);
        float s = d * (1. / K + (1. - 1. / K) * xn);
        float ca = uD.y * xn * (1. - 1. / K) * smoothstep(.0, .2, R);
        vec2 q = dir * s;
        vec3 lensC = vec3(texture2D(tOuter, .5 + q * (1. + ca) * k2).r, texture2D(tOuter, .5 + q * k2).g, texture2D(tOuter, .5 + q * (1. - ca) * k2).b);
        col = mix(outer, lensC, openW);
        /* the near view: the same spot from the close camera, aligned with the lens (inner short-side units = q × K) */
        if (uA.w > .5) {
          vec2 ui = .5 + q * K * k2;
          vec2 e = min(ui, 1. - ui) / k2;
          float cov = smoothstep(0., .03, min(e.x, e.y));
          float innerW = (1. - smoothstep(R - 1.6 * F, R - .3 * F, d)) * cov;
          if (innerW > .001) col = mix(col, texture2D(tInner, ui).rgb, innerW);
        }
        /* a soft light along the inside of the rim */
        col += vec3(.72, .95, .94) * uC.y * exp(-pow((d - R + .35 * F) / (.5 * F + .01), 2.));
      }
      /* streaks: fixed in the world, so they fly out with the zoom (log radius moves with ln zoom); their trails lengthen with its speed */
      float sa = uB.w * smoothstep(.1, .34, d) * (1. - openW * .9);
      if (sa > .001) {
        float a = atan(p.y, p.x) / 6.2831853 + .5, lr = log(max(d, 1e-3));
        vec3 add = vec3(0.);
        for (int L = 0; L < 2; L++) {
          float N = L == 0 ? 60. : 104., P = L == 0 ? 1.15 : 1.5;
          float cell = floor(a * N), jit = (h1(cell + N * 3.1) - .5) * .5 / N;
          float da = abs(a - (cell + .5) / N - jit) * 6.2831853 * d * m;          /* pixels across the streak */
          float qq = (lr - uB.z * (L == 0 ? 1. : .8) - h1(cell * 1.7 + N) * P) / P;
          float kk = floor(qq), f = fract(qq);
          float on = step(h1(cell * 7.3 + kk * 13.1 + N), L == 0 ? .32 : .2);
          float len = clamp(.06 + uB.y * 4.5, .06, .5);
          float body = smoothstep(1. - len, 1., f) * (1. - smoothstep(.975, 1., f));
          float wpx = (1. + 1.3 * h1(cell * 3.3 + kk)) * m / 930.;
          float across = 1. - smoothstep(wpx * .5, wpx * .5 + 1.1, da);
          vec3 c = mix(vec3(1., .99, .96), vec3(.27, .83, .77), step(.45, h1(cell * 5.1 + kk * 2.)));
          add += c * body * across * on * (L == 0 ? 1. : .6);
        }
        col += add * sa;
      }
      /* a faint soft light at the centre */
      if (uD.w > .5) col += vec3(.88, .97, 1.) * uC.x * (exp(-d * d / .0012) * 2.2 + exp(-d * 9.) * .35);   /* DROP: a bead of light, a soft halo round it */
      else col += vec3(1., .985, .95) * uC.x * exp(-d * d / .08);
      /* the close water sinks into the next block's navy; the water's own light stays a little */
      if (uC.z > 0.) {
        float l = dot(col, vec3(.2126, .7152, .0722));
        vec3 deep = navy(vUv) * (.8 + .7 * smoothstep(.02, .45, l));
        col = mix(col, deep, uC.z * uC.w);
      }
      gl_FragColor = vec4(col, 1.);
    }`;
  let mat = null, quadScene = null, quadCam = null, innerRT = null, outRT = null;
  function make(THREE) {
    if (mat) return;
    vecs(THREE);
    mat = new THREE.ShaderMaterial({
      uniforms: { tOuter: { value: null }, tInner: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uA: { value: new THREE.Vector4() }, uB: { value: new THREE.Vector4() }, uC: { value: new THREE.Vector4() }, uD: { value: new THREE.Vector4() } },
      defines: { TAPS: T.drop > 0 ? 16 : 8 },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: FRAG, depthTest: false, depthWrite: false, toneMapped: false });
    quadScene = new THREE.Scene(); quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; quadScene.add(quad);
    innerRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    outRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  }
  function size(r, src) {
    for (const rt of [innerRT, outRT]) if (rt.width !== src.width || rt.height !== src.height) {
      rt.setSize(src.width, src.height);
      const was = r.getRenderTarget(); try { rt.scissorTest = false; r.setRenderTarget(rt); r.clear(true, rt.depthBuffer, false); } finally { r.setRenderTarget(was); }
    }
    S.warm.rt = true;
  }
  function ensureHook(atlas) {
    S.atlas = atlas;
    if (S.hooked === atlas || !atlas || typeof atlas.onUpdate !== 'function') return;
    try { atlas.onUpdate(hook); S.hooked = atlas; } catch (error) { }
  }
  /* near FOUR PATHS: program compiled in the background, both targets allocated, the hook in place — all before the first frame of the dive */
  function warm(r, src, atlas, THREE, J) {
    if (!J || !Number.isFinite(J.max)) return;
    const near = J.progress > J.max - .6, away = J.progress < J.max - 1.6;
    if (near) {
      make(THREE); ensureHook(atlas);
      if (!S.warm.asked && r.compileAsync) {
        S.warm.asked = true;
        const was = r.getRenderTarget(); let pr = null;
        try { r.setRenderTarget(outRT); pr = r.compileAsync(quadScene, quadCam); } catch (error) { pr = null; } finally { r.setRenderTarget(was); }
        if (pr && pr.then) pr.then(() => { S.warm.compiled = true; }, () => { S.warm.compiled = 'at first use'; }); else S.warm.compiled = 'at first use';
      }
      size(r, src);
    } else if (away && S.warm.rt && S.t <= 0 && innerRT) { innerRT.setSize(4, 4); outRT.setSize(4, 4); S.warm.rt = false; S.warm.freed++; }
  }
  function hideAir(scene, on) {
    for (const o of scene.children) if (o.name === 'Forest air') { if (on) { o.userData.__diveVis = o.visible; o.visible = false; } else if (o.userData.__diveVis !== undefined) { o.visible = o.userData.__diveVis; delete o.userData.__diveVis; } }
  }
  /* called by flow2-lake-zoom.js after the atlas drew the (outer) view into src; returns the picture the atlas should show */
  function render(r, src, atlas, THREE, t, closing) {
    make(THREE); ensureHook(atlas); size(r, src);
    S.t = t;
    const aspect = src.width / src.height, c = curve(t, aspect), U = mat.uniforms;
    const m = Math.min(src.width, src.height);
    let innerOn = 0;
    const used = S.used;
    if (!reduced && c.inner && used && V.base) {
      /* the inner camera: same target, same rule, closer (its magnification relative to the outer camera actually used this frame) */
      const cam = atlas.camera, I = V.inner;
      const K = Math.max(1, c.mi / used.mo);
      I.fov = cam.fov; I.aspect = aspect;
      const dist = V.base.dist / Math.max(1, used.mo * K);
      I.near = Math.max(.004, dist * .04); I.far = dist + 90; I.updateProjectionMatrix();
      place(I, used.mo * K, V.T, V.base);
      /* only the circle's sharp part is needed: scissor to it (the lens samples up to s(R - .3F) × K) */
      const dI = Math.max(0, c.R - .3 * c.F), x = Math.min(1, dI / Math.max(1e-4, c.R)), s = dI * (1 / K + (1 - 1 / K) * Math.pow(x, T.bulge));
      const half = (s * K + .03) * m;
      const x0 = Math.max(0, Math.floor(src.width / 2 - half)), y0 = Math.max(0, Math.floor(src.height / 2 - half));
      const x1 = Math.min(src.width, Math.ceil(src.width / 2 + half)), y1 = Math.min(src.height, Math.ceil(src.height / 2 + half));
      if (x1 - x0 > 2 && y1 - y0 > 2) {
        innerRT.scissor.set(x0, y0, x1 - x0, y1 - y0); innerRT.scissorTest = x0 > 0 || y0 > 0 || x1 < src.width || y1 < src.height;
        S.scissor = `${x1 - x0}x${y1 - y0}`;
        const was = r.getRenderTarget();
        hideAir(atlas.scene, true);
        try { r.setRenderTarget(innerRT); r.clear(); r.render(atlas.scene, I); }
        finally { hideAir(atlas.scene, false); innerRT.scissorTest = false; r.setRenderTarget(was); }
        innerOn = 1; U.uA.value.set(c.R, c.F, K, 1);
      }
    }
    if (!innerOn) U.uA.value.set(c.R, c.F, c.inner ? Math.max(1, c.mi / (used ? used.mo : c.mo)) : 1, 0);
    S.inner = innerOn;
    U.tOuter.value = src.texture; U.tInner.value = innerRT.texture; U.uRes.value.set(src.width, src.height);
    U.uB.value.set(t, reduced ? 0 : Math.max(Math.min(.07, T.blur * c.speed), c.blurD), c.lnMo, reduced ? 0 : c.streak * (closing ? .6 : 1));
    U.uC.value.set(reduced ? 0 : c.glow, reduced ? 0 : c.rim, reduced ? t : c.settle, T.deep);
    U.uD.value.set(T.bulge, T.aberr, reduced ? 1 : 0, c.drop && !reduced ? 1 + c.lift : 0);
    const was = r.getRenderTarget(); r.setRenderTarget(outRT); r.render(quadScene, quadCam); r.setRenderTarget(was);
    S.frames++;
    return outRT.texture;
  }
  function set(t) { S.t = clamp01(+t || 0); if (S.t <= 0) S.used = null; }
  function free() { if (innerRT) { innerRT.setSize(4, 4); outRT.setSize(4, 4); S.warm.rt = false; S.warm.freed++; } }

  window.__FLOW2_LAKE_DIVE__ = { tune: T, state: S, curve, warm, render, set, free, reduced };
})();
