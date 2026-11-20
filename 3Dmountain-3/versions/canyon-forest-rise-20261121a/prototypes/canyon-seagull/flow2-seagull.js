/* Flow2 · the seagull flock and the light beam's host (Team SG, 2026-11-17). index1-5-canyon-forest.html.
   Client: 「有第一人稱感的海鷗經過」 → (after seeing the close bird) 「第一人稱海鷗我覺得可以拿掉了 不好看」 → 「一開始有一群海鷗飛過就好」.
   (The close first-person bird of the first pass is kept in _archive/backups/canyon-seagull-20261117/flow2-seagull-v2-closebird.js.)

   THE FLOCK (default; ?seagull=0 = none)
   · Seven gulls (the same model, cloned: each its own wing phase, size ± 12 %, height and place in a loose V) fly past ONCE, on the first
     screen, when the canyon first appears: from over the right bank, high over the river, gliding with a few wing beats, banking
     gently left and receding down the canyon above the glass mark, then gone (≈ 7 s). One entrance (the client's rule
     「到山谷可以進場動畫一下就好」): it does not loop, and nothing moves by itself afterwards. If the visitor scrolls on meanwhile the
     birds carry on in the valley's world and finish. Mid distance (16 → 68 m, round 2: closer so seven flapping gulls read clearly): sharp, never close
     or blurred; their path crosses the upper third, above the mark's top and the title and below the header. Under "reduce motion" there is no fly-by.
   · Drawn in the canyon's own light (its sun, sky light and rim light copied every frame; its fog and environment shared), the sun behind
     them lighting their rims and shining through the wings; depth-tested against the cliffs.
   · Model: "Seagull" by Dayvable (https://sketchfab.com/3d-models/seagull-dc42ffc81c86480e9e7f7752fa134174), CC BY 4.0 — credited in the
     page footer's legal line. Loaded only when the flock is on.

   THE HOST (for flow2-light-beam.js)
   · the beam's path along the river (a spline in a float texture), its lead point for every journey place (4.885 → 6.30), and ONE pass
     right after the page's main canyon render (same buffer, same depth): the flock, the beam and the depth-reading layers (glow on the
     cliffs, ?beamDim) in ONE draw (one resolve of the multisampled buffer; no extra depth resolve). Nothing is drawn and nothing runs on the
     GPU when neither is on screen.
   · Shaders compiled in parallel and drawn once off-screen at load: the first appearance does not hitch.
   Hooks: window.__FLOW2_FINE_JOURNEY__.attach / .canyon (chained, as flow2-mark.js does). main.js is not edited.
   Idle loop: while the beam (or the fly-by) is on screen window.__FLOW2_IDLE_HOLD__ is true, so main.js's idle cap (FLOW2_IDLE_CAP) keeps the
   full frame rate; false everywhere else (and never set with ?seagull=0&beam=0).
   Switches: ?seagull=0 no flock · ?beam=0 no beam (flow2-light-beam.js) · ?seagullTime=1 GPU timer of the pass in __FLOW2_SEAGULL__.gpu
   (not together with vcost2: timer queries cannot nest) · __FLOW2_SEAGULL__.scanNext = true counts NaN / Inf / negative values in the
   page's buffer before and after this pass (test hook) · window.__SG_FREEZE__ = <seconds> holds the fly-by at that time (pictures). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const FLOCK = Q.get('seagull') !== '0', BEAM = Q.get('beam') !== '0';
  if (!FLOCK && !BEAM) return;
  const SRC = (document.currentScript && document.currentScript.src) || new URL('prototypes/canyon-seagull/flow2-seagull.js', document.baseURI).href;
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const T = {
    from: num('beamFrom', 4.885), to: num('beamTo', 6.30),
    /* the beam's lead point: [u, metres ahead of the lens along the river, lateral from the river's centre line (− = left), height above
       the water]; its head rides just behind it. Left of the lens path and just under the eye (the lens flies at ≈ 2.5 m): the trail runs
       in along the horizon from the left edge, never through the lens nor over the sky or the title; the head leads the eye down the canyon. */
    lead: [[0, -4, -5.6, 2.0], [.06, 3, -5.6, 2.05], [.15, 13, -5.2, 2.15], [.3, 28, -4.6, 2.3], [.5, 45, -3.8, 2.45], [.7, 62, -3.1, 2.6], [.85, 90, -2.6, 2.9], [1, 150, -2.2, 3.4]],
    flock: {
      count: Math.max(1, Math.min(9, Math.round(num('flockN', 7)))),
      dur: num('flockDur', 7), delay: num('flockDelay', 1.1), span: num('flockSpan', 1.45),
      /* the flock's centre on the first screen: [t, x and y as shares of the half screen (−1 … 1, aspect-free), metres ahead] */
      path: [[0, 1.24, .50, 16], [.22, .84, .60, 18.5], [.45, .46, .66, 23], [.7, .2, .68, 34], [1, .05, .66, 68]],   /* in close over the right bank, across the upper third, then down the canyon */
      fade: [.86, 1],
      flapRate: 1.2, glideAt: 4.7,
      /* panel 海鷗參數 (flow2-seagull-panel.js; defaults = the picture as before) */
      size: 1, height: 0, side: 1, offX: 0, dist: 1, rate: 1, fog: 1
    },
    exposure: .9, rim: .45, through: .22   /* white birds against the sky stay under the page's light-shaft / bloom cut (no streaked copies) */
  };
  const S = { stage: 'waiting', notes: [], u: -1, visible: false, flock: null };
  const layers = window.__FLOW2_SEAGULL_LAYERS__ ||= [];
  const api = window.__FLOW2_SEAGULL__ = { tune: T, state: S, layers, frame: null, gpu: null, flockOn: FLOCK, bloomGain: 1 };

  let THREE = null, renderer = null, composer = null, canyon = null, started = false, ready = false, reduced = false;
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const attachBefore = host.attach, canyonBefore = host.canyon;
  host.attach = function (h = {}) { try { return attachBefore?.call(this, h); } finally { THREE ||= h.THREE; renderer ||= h.renderer; composer = h.composer || composer; start(); } };
  host.canyon = function (h = {}) { try { return canyonBefore?.call(this, h); } finally { THREE ||= h.THREE; renderer ||= h.renderer; canyon = h.canyon || canyon; start(); } };

  const clamp01 = x => Math.min(1, Math.max(0, x));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function keyed(rows, u, out) {   /* Catmull-Rom through rows [u, a, b, c…] */
    const n = rows.length;
    if (u <= rows[0][0]) { for (let i = 1; i < rows[0].length; i++) out[i - 1] = rows[0][i]; return out; }
    if (u >= rows[n - 1][0]) { for (let i = 1; i < rows[n - 1].length; i++) out[i - 1] = rows[n - 1][i]; return out; }
    let k = 0; while (k < n - 2 && u > rows[k + 1][0]) k++;
    const a = rows[Math.max(0, k - 1)], b = rows[k], c = rows[k + 1], d = rows[Math.min(n - 1, k + 2)], t = (u - b[0]) / (c[0] - b[0]), t2 = t * t, t3 = t2 * t;
    for (let i = 1; i < b.length; i++) {
      const m1 = (c[i] - a[i]) / Math.max(1e-6, c[0] - a[0]) * (c[0] - b[0]), m2 = (d[i] - b[i]) / Math.max(1e-6, d[0] - b[0]) * (c[0] - b[0]);
      out[i - 1] = (2 * t3 - 3 * t2 + 1) * b[i] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * c[i] + (t3 - t2) * m2;
    }
    return out;
  }

  function start() {
    if (started || !composer || !canyon || !THREE || !renderer) return;
    started = true;
    build().catch(e => { S.stage = 'failed: ' + (e?.message || e); console.warn('flow2 seagull: the canyon stays without it', e); });
  }

  /* ---------- the river path: the lens's arc length at a journey place (the page's journey clock), the beam's spline ---------- */
  let L = 1, spline = null;
  const clock = p => { const c = window.__MONTIS_STUDY__?.journeyClock; return typeof c === 'function' ? c(p) : p; };
  const lensArc = p => { let r = clamp01((clock(p) - 1.404) / (8 - 1.404)); if (r > .9) { const v = (r - .9) / .1; r = .9 + .1 * (v + v * v - v * v * v); } return r * .865 * L; };
  function buildSpline() {
    L = canyon.stats?.pathLength || canyon.curve.getLength();
    const N = 1024, tmp = [0, 0, 0], samples = [];   /* the path reaches the canyon's end (the drop leads all the way): ≈ 1.5 m per sample */
    for (let i = 0; i <= 400; i++) { const u = i / 400, p = T.from + u * (T.to - T.from); keyed(T.lead, u, tmp); samples.push([lensArc(p) + tmp[0], tmp[1], tmp[2]]); }
    const s0 = samples[0][0] - 4, sEnd = samples[samples.length - 1][0], s1 = Math.max(sEnd + 140, lensArc(9.7) + 320);
    const at = s => {
      if (s <= samples[0][0]) return [samples[0][1], samples[0][2]];
      if (s >= sEnd) { const e = samples[samples.length - 1]; return [e[1], e[2] + 1.5 * smooth(sEnd, s1, s)]; }
      let lo = 0, hi = samples.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (samples[m][0] < s) lo = m; else hi = m; }
      const a = samples[lo], b = samples[hi], t = (s - a[0]) / Math.max(1e-6, b[0] - a[0]); return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    };
    const data = new Float32Array(N * 4), P = new THREE.Vector3(), Tn = new THREE.Vector3(), R = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), pts = [];
    for (let i = 0; i < N; i++) {
      const s = s0 + (s1 - s0) * i / (N - 1), t = clamp01(s / L);
      canyon.curve.getPointAt(t, P); canyon.curve.getTangentAt(t, Tn); R.crossVectors(Tn, up).normalize();
      /* a living current: the line snakes gently across the river and rises and falls a little (fixed in the valley) */
      const [lat0, h0] = at(s), lat = lat0 + 1.1 * Math.sin(s * 2 * Math.PI / 57 + .7) + .45 * Math.sin(s * 2 * Math.PI / 23 + 2.1), h = h0 + .32 * Math.sin(s * 2 * Math.PI / 41 + 1.3) + .14 * Math.sin(s * 2 * Math.PI / 17);
      P.addScaledVector(R, lat); P.y = h;
      data.set([P.x, P.y, P.z, s], i * 4); pts.push(P.clone());
    }
    const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.FloatType); tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
    spline = { N, s0, s1, tex, pts, lensArc,
      point(s, out) { const x = clamp01((s - s0) / (s1 - s0)) * (N - 1), i = Math.floor(x), f = x - i; return out.copy(pts[i]).lerp(pts[Math.min(N - 1, i + 1)], f); } };
    api.spline = spline;
  }

  /* ---------- build ---------- */
  let sceneA = null, sceneB = null, mainPass = null, bloom = null, pass = null, lights = null, flock = null;
  async function build() {
    S.stage = 'loading';
    const glbP = FLOCK ? Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/utils/SkeletonUtils.js')])
      .then(([G, U]) => new G.GLTFLoader().loadAsync(new URL('./assets/seagull-dayvable.glb', SRC).href).then(gltf => ({ gltf, SkeletonUtils: U }))) : null;
    for (let i = 0; i < 600 && typeof window.__MONTIS_STUDY__?.journeyClock !== 'function'; i++) await new Promise(r => setTimeout(r, 50));
    buildSpline();
    sceneA = new THREE.Scene(); sceneB = sceneA;   /* one scene, one draw: the depth-reading layers read the depth the page's own pass resolved */
    const ctx = api.ctx = { THREE, renderer, canyon, sceneA, sceneB, spline, tune: T, state: S };
    if (FLOCK) { try { buildFlock(await glbP); } catch (e) { flock = null; S.notes.push('flock: ' + (e?.message || e)); console.warn('flow2 seagull: no flock', e); } }
    layers.sort((a, b) => (a.order ?? 1) - (b.order ?? 1));   /* the drop (order 0) places itself before the beam reads it */
    for (const layer of layers) { try { await layer.init?.(ctx); } catch (e) { S.notes.push('layer ' + (layer.name || '?') + ': ' + (e?.message || e)); console.warn('flow2 seagull layer skipped', e); } }
    mainPass = composer.passes.find(p => p && p.scene && p.camera && typeof p.render === 'function');
    if (!mainPass) throw new Error('no main render pass');
    bloom = composer.passes.find(p => p && 'strength' in p && 'radius' in p && 'threshold' in p) || null;
    pass = { enabled: true, needsSwap: false, clear: false, renderToScreen: false, setSize() { }, dispose() { },
      render(r, w, rb) { try { draw(r, rb); } catch (e) { pass.enabled = false; S.stage = 'failed while drawing: ' + (e?.message || e); console.warn('flow2 seagull: switched off', e); } } };
    composer.insertPass(pass, composer.passes.indexOf(mainPass) + 1);
    if (bloom && !bloom.__sgWrapped) {   /* the beam raises the page's own bloom while it flies: a multiplier for this frame's draw only */
      const render = bloom.render.bind(bloom); bloom.__sgWrapped = true;
      bloom.render = function (...a) { const g = api.bloomGain; if (!(g > 1)) return render(...a); const s = bloom.strength; bloom.strength = s * Math.min(2.5, g); try { return render(...a); } finally { bloom.strength = s; } };
    }
    const update = canyon.update;
    canyon.update = function (...args) { const out = update.apply(this, args); reduced = !!args[2]; return out; };
    await warm();
    ready = true; S.stage = 'ready';
  }

  /* ---------- the flock ---------- */
  let rimUniforms = null, flockMat = null;
  function buildFlock({ gltf, SkeletonUtils }) {
    const base = gltf.scene, F = T.flock;
    base.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const m = flockMat = o.material;
      if (m.map) { m.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); m.map.needsUpdate = true; }
      m.side = THREE.DoubleSide; m.fog = true; m.transparent = true; m.opacity = 1; m.depthWrite = true;
      rimUniforms = { uSunView: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uRim: { value: T.rim }, uThrough: { value: T.through }, uExposure: { value: T.exposure }, uFogMix: { value: 1 } };
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, rimUniforms);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunView; uniform vec3 uSunCol; uniform float uRim, uThrough, uExposure;')
          .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.a = opacity;   /* solid birds: only the closing fade makes them see-through (the texture alpha is ignored) */')
          .replace('#include <opaque_fragment>', `{
            /* rim from the canyon's sun (strongest when the sun is behind the bird) and light through the thin wings */
            vec3 Vd = normalize(vViewPosition); float ndv = clamp(dot(normal, -Vd), 0., 1.), back = clamp(dot(Vd, uSunView), 0., 1.);
            float rimT = pow(1. - ndv, 3.) * (.25 + .75 * back), thru = clamp(-dot(normal, uSunView), 0., 1.) * (.35 + .65 * back);
            outgoingLight = max(outgoingLight + uSunCol * (rimT * uRim * .12 + diffuseColor.rgb * thru * uThrough * .1), 0.) * uExposure;
          }
          #include <opaque_fragment>`)
          .replace('#include <fog_fragment>', `#ifdef USE_FOG
            #ifdef FOG_EXP2
              float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
            #else
              float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
            #endif
            gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( fogFactor * uFogMix, 0.0, 1.0 ) );   /* panel: how much the canyon's air veils them */
          #endif`)
          .replace('uniform float uRim, uThrough, uExposure;', 'uniform float uRim, uThrough, uExposure, uFogMix;');
      };
      m.customProgramCacheKey = () => 'flow2-seagull-rim';
      m.needsUpdate = true;
    });
    base.updateMatrixWorld(true);
    /* its own axes from the bones (bind pose): forward = back → head, right = left wing → right wing */
    const bone = name => { let b = null; base.traverse(o => { if (!b && o.isBone && o.name.startsWith(name)) b = o; }); return b; };
    const wp = o => o.getWorldPosition(new THREE.Vector3());
    const Fm = wp(bone('Bn-Head')).sub(wp(bone('Bn-Back-1'))).normalize(), Rr = wp(bone('Bn-R-Wing-1')).sub(wp(bone('Bn-L-Wing-1'))).normalize();
    const Um = new THREE.Vector3().crossVectors(Rr, Fm).normalize(); if (Q.get('seagullFlip') === '1') Um.negate();
    const Rm = new THREE.Vector3().crossVectors(Fm, Um).normalize();
    const qModel = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Rm, Um, Fm)).invert();
    const box = new THREE.Box3().setFromObject(base, true), size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const unit = F.span / Math.max(size.x, size.y, size.z);
    const clip = gltf.animations[0], glideClip = clip.clone();
    const group = new THREE.Group(); group.visible = false;
    /* a loose V: leader, then pairs back and out, each jittered (fixed seed: the same flock every visit) */
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const birds = [];
    for (let i = 0; i < 9; i++) {   /* nine are made; the panel's count shows the first n (default 7) */
      const model = SkeletonUtils.clone(base); model.position.sub(centre);
      const pivot = new THREE.Group(); pivot.add(model); pivot.quaternion.copy(qModel);
      const root = new THREE.Group(); root.add(pivot);
      const k = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? 1 : -1);
      const b = {
        root, scale: unit * (.88 + .24 * rnd()),
        off: new THREE.Vector3(side * (1.9 * k + (rnd() - .5) * .9), (rnd() - .5) * .7 - k * .12, 1.6 * k + (rnd() - .5) * 1.2),   // side, up, back (metres)
        phase: rnd() * 1.17, rate: F.flapRate * (.9 + .2 * rnd()), drift: rnd() * 6.28, roll: (rnd() - .5) * .12,
        flaps: [[0, .36 + .12 * rnd()], [.56 + .08 * rnd(), .68 + .08 * rnd()]], flapW: 0, flapTime: 1.25
      };
      b.mixer = new THREE.AnimationMixer(model);
      b.actFlap = b.mixer.clipAction(clip); b.actGlide = b.mixer.clipAction(glideClip);
      for (const a of [b.actFlap, b.actGlide]) { a.play(); a.timeScale = 0; a.enabled = true; }
      b.flapTime = 1.25 + b.phase; b.actFlap.time = b.flapTime; b.actGlide.time = F.glideAt; b.actFlap.setEffectiveWeight(0); b.actGlide.setEffectiveWeight(1); b.mixer.update(0);
      root.scale.setScalar(b.scale);
      group.add(root); birds.push(b);
    }
    lights = { hemi: new THREE.HemisphereLight(0xffffff, 0x444444, 0), sun: new THREE.DirectionalLight(0xffffff, 0), rim: new THREE.DirectionalLight(0xffffff, 0) };
    sceneA.add(group, lights.hemi, lights.sun, lights.sun.target, lights.rim, lights.rim.target);
    sceneA.fog = canyon.scene.fog; sceneA.environment = canyon.scene.environment || null;
    flock = { group, birds, state: 'waiting', t0: 0, origin: null, done: false };
    S.model = { triangles: 4352, birds: F.count, unitScale: +unit.toFixed(4) };
    /* play the fly-by again (panel 海鷗參數 「再飛一次」): from the lens's place now */
    api.replayFlock = () => { if (!flock) return; flock.done = false; flock.frozen = false; flock.force = true; flock.state = 'waiting'; flock.group.visible = false; };
  }

  const FV = {};
  function flockFrame(now, dt, p) {
    if (!flock || flock.done) return false;
    const F = T.flock, J = window.__MONTIS_STUDY__?.journey, floor = Number.isFinite(J?.floor) ? J.floor : T.from;
    const freeze = typeof window.__SG_FREEZE__ === 'number' ? window.__SG_FREEZE__ : null;
    if (flock.state === 'waiting') {
      const still = document.documentElement.dataset.flow2Still, live = still === undefined ? document.body.classList.contains('is-ready') : still === 'off';
      if (!live) return false;
      if (!flock.force && (reduced || p > floor + .15)) { flock.done = true; S.flock = { state: reduced ? 'skipped (reduce motion)' : 'skipped (the visitor had moved on)' }; return false; }
      /* the first screen's lens, recorded once: the flock lives in the valley's world from now on */
      const cam = canyon.camera; cam.updateMatrixWorld(); const e = cam.matrixWorld.elements;
      flock.origin = { O: new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld), R: new THREE.Vector3(e[0], e[1], e[2]).normalize(), U: new THREE.Vector3(e[4], e[5], e[6]).normalize(),
        F: new THREE.Vector3(-e[8], -e[9], -e[10]).normalize(), tanV: Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), aspect: cam.aspect,
        /* phones draw a window of a taller frustum (camera.view, e.g. 76 px of 1000 shifted): the path is given in screen shares, so map them */
        view: cam.view && cam.view.enabled ? { ...cam.view } : null };
      flock.state = 'flying'; flock.t0 = now + (flock.force ? .3 : F.delay); flock.force = false;
    }
    let tsec = now - flock.t0;
    if (freeze !== null) { tsec = freeze; flock.frozen = true; } else if (flock.frozen) { flock.done = true; flock.group.visible = false; return false; }
    const t = tsec / F.dur;
    if (t >= 1) { flock.done = true; flock.group.visible = false; S.flock = { state: 'done', t: 1 }; return false; }
    if (t < 0) { flock.group.visible = false; return false; }
    if (!FV.ok) Object.assign(FV, { ok: true, c: new THREE.Vector3(), c2: new THREE.Vector3(), Fd: new THREE.Vector3(), side: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), U: new THREE.Vector3(), R: new THREE.Vector3(), m: new THREE.Matrix4(), tmp: [0, 0, 0], tmp2: [0, 0, 0], p: new THREE.Vector3(), sun: new THREE.Vector3() });
    const o = flock.origin, tanH = o.tanV * o.aspect;
    const cv = canyon.camera.view, V = cv && cv.enabled ? cv : null, toFull =(x, y) => V ? [((x * .5 + .5) * V.width + V.offsetX) / V.fullWidth * 2 - 1, 1 - (((.5 - y * .5) * V.height + V.offsetY) / V.fullHeight) * 2] : [x, y];
    const centreAt = (tt, out, tmp) => { keyed(F.path, tt, tmp); tmp[0] = tmp[0] * (F.side < 0 ? -1 : 1) + F.offX; tmp[1] += F.height; tmp[2] *= Math.max(.2, F.dist); const z = tmp[2], [fx, fy] = toFull(tmp[0], tmp[1]); return out.copy(o.O).addScaledVector(o.R, fx * z * tanH).addScaledVector(o.U, fy * z * o.tanV).addScaledVector(o.F, z); };
    centreAt(t, FV.c, FV.tmp);
    if (t + .01 <= 1) { centreAt(t + .01, FV.c2, FV.tmp2); FV.Fd.subVectors(FV.c2, FV.c); } else { centreAt(t - .01, FV.c2, FV.tmp2); FV.Fd.subVectors(FV.c, FV.c2); }
    FV.Fd.normalize();
    /* the bend of its path → the bank (turning left = left wing down) */
    centreAt(Math.min(1, t + .06), FV.c2, FV.tmp2); const ax = FV.c2.x - FV.c.x, az = FV.c2.z - FV.c.z, la = Math.hypot(ax, az) || 1;
    const turn = (FV.Fd.x * az - FV.Fd.z * ax) / la;
    FV.side.crossVectors(FV.Fd, FV.up).normalize();
    const fade = 1 - smooth(F.fade[0], F.fade[1], t);
    const tight = o.aspect < 1 ? .6 : 1;   /* upright screens: a tighter formation */
    const shown = Math.max(1, Math.min(9, Math.round(F.count)));
    rimUniforms.uExposure.value = T.exposure; rimUniforms.uFogMix.value = Math.max(0, F.fog);
    flock.birds.forEach((b, i) => { b.root.visible = i < shown; b.root.scale.setScalar(b.scale * Math.max(.1, F.size)); });
    for (const b of flock.birds) {
      if (!b.root.visible) continue;
      const wob = Math.sin(tsec * .9 + b.drift), wob2 = Math.sin(tsec * .7 + b.drift * 1.3);
      FV.p.copy(FV.c).addScaledVector(FV.side, (b.off.x + wob * .25) * tight).addScaledVector(FV.up, b.off.y + wob2 * .15).addScaledVector(FV.Fd, -b.off.z * tight);
      const roll = THREE.MathUtils.clamp(-turn * 2.2, -.45, .45) + b.roll + wob * .05;
      FV.U.copy(FV.up).applyAxisAngle(FV.Fd, roll); FV.R.crossVectors(FV.Fd, FV.U).normalize(); FV.U.crossVectors(FV.R, FV.Fd).normalize();
      FV.m.makeBasis(FV.R, FV.U, FV.Fd); b.root.quaternion.setFromRotationMatrix(FV.m); b.root.position.copy(FV.p);
      let band = 0; for (const [a, c] of b.flaps) band = Math.max(band, smooth(a - .02, a + .02, t) * (1 - smooth(c - .02, c + .03, t)));
      if (t < .02) band = 1;
      b.flapW += (band - b.flapW) * (1 - Math.exp(-dt / .2));
      const rate = b.rate * Math.max(.1, F.rate);
      if (freeze !== null) { b.flapW = band; b.flapTime = 1.25 + ((b.phase + tsec * rate) % 1.17); }
      else if (b.flapW > .002) { b.flapTime += dt * rate; if (b.flapTime > 2.42) b.flapTime -= 1.17; }
      b.actFlap.time = b.flapTime; b.actGlide.time = F.glideAt; b.actFlap.setEffectiveWeight(b.flapW); b.actGlide.setEffectiveWeight(1 - b.flapW); b.mixer.update(0);
    }
    flockMat.opacity = fade;
    flock.group.visible = true; flock.group.updateMatrixWorld(true);
    S.flock = { state: 'flying', t: +t.toFixed(3), screen: [+(FV.tmp[0]).toFixed(3), +(FV.tmp[1]).toFixed(3)], z: +FV.tmp[2].toFixed(1) };
    copyLights();
    return true;
  }
  function copyLights() {
    if (!FV.sun) FV.sun = new THREE.Vector3();
    let sun = null, rim = null, hemi = null;
    for (const o of canyon.scene.children) { if (o.isHemisphereLight) hemi ||= o; else if (o.isDirectionalLight) { if (o.castShadow && !sun) sun = o; else if (!rim && o.intensity > .01 && o !== sun) rim = o; } }
    if (hemi) { lights.hemi.color.copy(hemi.color); lights.hemi.groundColor.copy(hemi.groundColor); lights.hemi.intensity = hemi.intensity; }
    const copyDir = (d, s) => { if (!s) { d.intensity = 0; return; } d.color.copy(s.color); d.intensity = s.intensity; d.position.copy(s.position); d.target.position.copy(s.target.position); d.target.updateMatrixWorld(); d.updateMatrixWorld(); };
    copyDir(lights.sun, sun); copyDir(lights.rim, rim);
    if (sun) { FV.sun.copy(sun.position).sub(sun.target.position).normalize().transformDirection(canyon.camera.matrixWorldInverse); rimUniforms.uSunView.value.copy(FV.sun); rimUniforms.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity); }
    sceneA.fog = canyon.scene.fog; if (canyon.scene.environment && sceneA.environment !== canyon.scene.environment) sceneA.environment = canyon.scene.environment;
  }

  /* ---------- per frame: the beam's lead point ---------- */
  let lastP = NaN, lastNow = 0, moving = 0, windClock = 0;
  const LV = {};
  function beamFrame(now, dt, p) {
    if (!BEAM || !layers.length) return null;
    const u = (p - T.from) / (T.to - T.from);
    const dp = Number.isFinite(lastP) ? Math.abs(p - lastP) : 0; lastP = p;
    const want = dt > 0 && dp / dt > .012 ? 1 : 0;
    moving += (want - moving) * (1 - Math.exp(-dt / (want > moving ? .12 : .45)));
    if (reduced) moving = 0;
    windClock += dt * moving;
    const still = document.documentElement.dataset.flow2Still, live = still === undefined ? document.body.classList.contains('is-ready') : still === 'off';
    const busy = layers.some(l => l.busy?.());   /* a layer still playing on time (the drop's race) keeps the frame alive past the range */
    if (!live || u <= 0 || (u >= 1 && !busy)) return null;
    if (!LV.ok) Object.assign(LV, { ok: true, pos: new THREE.Vector3() });
    const r = keyed(T.lead, u, [0, 0, 0]);
    const sLead = lensArc(p) + r[0];
    spline.point(sLead, LV.pos);
    return { u, p, sLead, pos: LV.pos, moving, windClock, now, dt, reduced };
  }

  /* ---------- the pass, right after the main canyon render ---------- */
  function draw(r, readBuffer) {
    api.frame = null; api.bloomGain = 1;
    if (!ready || mainPass.scene !== canyon.scene) { window.__FLOW2_IDLE_HOLD__ = false; return; }
    const J = window.__MONTIS_STUDY__?.journey; if (!J) { window.__FLOW2_IDLE_HOLD__ = false; return; }
    const now = performance.now() / 1000, dt = Math.min(.1, Math.max(0, now - (lastNow || now))); lastNow = now;
    const p = +J.progress || 0;
    const birds = flockFrame(now, dt, p);
    const f = beamFrame(now, dt, p); api.frame = f;
    /* IDLE HOLD (main.js FLOW2_IDLE_CAP reads it): while the beam's loop (or the one fly-by) is on screen the page keeps its full frame rate */
    /* round 7: only while something moves fast (the fly-by, the drop's race / gathering / dive); at rest the page's idle cap runs */
    const dropLayer = layers.find(l => l.name === 'drop');
    window.__FLOW2_IDLE_HOLD__ = !!(birds || (dropLayer && dropLayer.fast ? (f && !f.reduced && dropLayer.fast()) : (f && !f.reduced)));
    S.u = f ? +f.u.toFixed(4) : -1; S.visible = !!(birds || f);
    if (!f) for (const l of layers) l.hide?.();
    if (!birds && !f) { if (flock) flock.group.visible = false; if (api.scanNext) { api.scanNext = false; api.scan = { idle: scanTarget(r, readBuffer) }; } return; }
    S.draws = (S.draws || 0) + 1;
    const scanBefore = api.scanNext ? scanTarget(r, readBuffer) : null;
    gpuBegin(r);
    if (f) for (const l of layers) { try { l.update?.(f, api.ctx, readBuffer); } catch (e) { S.notes.push(String(e?.message || e)); } }
    /* ONE draw into the page's buffer (one resolve): the flock, the beam, and the layers that read the scene's depth. They read the depth
       texture the page itself resolves for its motion pass while the lens moves (the frame's own depth), else the last one resolved (the
       lens has not moved since). Only on a multisampled buffer: there the depth texture is not attached to the framebuffer drawn into. */
    const depth = readBuffer.samples > 0 && readBuffer.depthTexture ? readBuffer.depthTexture : null;
    if (f) for (const l of layers) { try { l.late?.(f, api.ctx, readBuffer, depth); } catch (e) { S.notes.push(String(e?.message || e)); } }
    let any = !!birds; if (!any) sceneA.traverseVisible(o => { if (o.isMesh || o.isSprite || o.isPoints) any = true; });
    if (any) {   /* nothing on screen (e.g. phase 1, before the drop): no draw, no resolve */
      const autoClear = r.autoClear, target = r.getRenderTarget();
      try { r.autoClear = false; r.setRenderTarget(readBuffer); r.render(sceneA, canyon.camera); }
      finally { r.autoClear = autoClear; r.setRenderTarget(target); }
    }
    gpuEnd(r);
    if (scanBefore) { api.scanNext = false; api.scan = { before: scanBefore, after: scanTarget(r, readBuffer) }; }
  }

  /* ---------- warm-up: every program in its drawn variant, compiled in parallel; then one off-screen draw (uploads) ---------- */
  async function warm() {
    const r = renderer, was = r.getRenderTarget(), wt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    const t0 = performance.now(), shown = [], show = sc => sc.traverse(o => { if (o !== sc && !o.visible) { o.visible = true; shown.push(o); } });
    try {
      show(sceneA);
      for (const l of layers) l.warmPose?.(api.ctx);
      if (flock) { copyLights(); const c = canyon.camera; flock.birds.forEach((b, i) => { b.root.position.copy(c.position).add(new THREE.Vector3(i - 3, 2, -30).applyQuaternion(c.quaternion)); }); flock.group.updateMatrixWorld(true); }
      r.setRenderTarget(wt);
      await r.compileAsync(sceneA, canyon.camera);
      r.render(sceneA, canyon.camera);
    } finally { shown.forEach(o => { o.visible = false; }); for (const l of layers) l.hide?.(); if (flock) flock.group.visible = false; r.setRenderTarget(was); wt.dispose(); }
    S.warmMs = Math.round(performance.now() - t0);
  }

  /* ---------- test hooks ---------- */
  function scanTarget(r, rt) {
    try {
      const w = Math.floor(rt.width), h = Math.floor(rt.height), buf = new Uint16Array(w * h * 4);
      r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      let bad = 0, neg = 0, first = null;
      for (let i = 0; i < buf.length; i++) { const v = buf[i]; if ((v & 0x7c00) === 0x7c00) { bad++; if (!first) first = [(i >> 2) % w, Math.floor((i >> 2) / w), i & 3]; } else if ((v & 0x8000) && (v & 0x7fff)) neg++; }
      return { w, h, bad, neg, first };
    } catch (e) { return { error: String(e?.message || e) }; }
  }
  const TIMER = Q.get('seagullTime') === '1';
  let gl = null, ext = null, q = null; const pending = [];
  function gpuBegin(r) { if (!TIMER) return; if (!gl) { gl = r.getContext(); ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); api.gpu = { A: [], B: [] }; } if (!ext || q) return; q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
  function gpuEnd() {
    if (!TIMER || !ext || !q) return; gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q); q = null;
    for (let i = pending.length - 1; i >= 0; i--) { const qq = pending[i]; if (gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { const a = api.gpu.A; a.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6); if (a.length > 600) a.shift(); } gl.deleteQuery(qq); pending.splice(i, 1); } }
  }
})();
