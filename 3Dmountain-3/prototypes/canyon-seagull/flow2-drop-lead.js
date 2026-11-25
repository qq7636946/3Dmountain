/* Flow2 · the canyon's first scroll as four phases, the water drop that leads the beam (Team SQ/SG, 2026-11-17). index1-5-canyon-forest.html.
   Client spec (annotated screenshots): 1 the glass mark sinks into the water and its rings die away → 2 「水滴浮上來」 a glowing water drop rises
   from the same water centre and holds just above the horizon, above the chapter kicker → 3 「光束才跟過水滴」 only then the light strands come in
   from the left and gather right behind the drop (the drop is the beam's head) → 4 with further scrolling the drop leads, dragging the strands,
   racing down the river into the far distance while the lens follows. Scrolling back reverses each phase in order; places follow the scroll.

   Phases (journey; tune with ?seqP2=a,b ?seqP3=a,b ?seqP4=a,b):
     1  4.881 → 4.993   the mark's own exit in flow2-mark.js (sinks turning into the river as the lens nears it) — unchanged, it ends before 2.
     2  5.00  → 5.12    the drop rises out of the water at the mark's spot (27 m ahead, screen centre) to just above the horizon and holds
                         there (it keeps 27 m ahead of the moving lens, so it stands still on the screen).
     3  5.12  → 5.28    the beam (flow2-light-beam.js) runs in from the left behind the lens and its strands gather into the drop.
     4  from 5.28       THE RACE PLAYS ON ITS OWN (client 「要整個跑完」): past 5.28 the drop and its trail dash ahead on time (3.4 s) and settle
                         52 m ahead, a little above the river. It NEVER disappears in the canyon (client 「一停下來就消失了 是還沒做完嗎?」): it leads the
                         lens down the river at that distance, following the river's path, alive when the visitor stops (hovering, breathing, the trail's
                         light flowing), and leaves only at the canyon's end (9.30 → 9.45) by diving into the river with a soft splash of light, before
                         the lift into the view from above. Scrolling back reverses everything (the race on time). window.__SG_RACE__ holds the race.

   THE DROP'S LOOK (client: 「水滴可以參考 works-main/drops」 = saharan's "Drops", MIT, notice below). The same recipe, in one draw:
   · a thick lens: the front and the BACK surface normals of the drop (here an exact ray–ellipsoid intersection in the fragment shader — no depth
     / normal pass), the lens normal = mix(front, back, 0.2) as in Drops;
   · refraction: refract(eye, n, 0.7) bends the view into the canyon picture behind the drop (the main pass's resolved buffer, read while
     drawing into the multisampled one — no copy, no extra pass), split into three wavelengths (0.68 / 0.70 / 0.72) for faint rainbow fringes;
   · fresnel = pow(1 + dot(eye, nFront), 3); reflection of the canyon's sky and river; colour = fresnel·0.2 + mix(refr, refl, 0.2 + 0.8·fresnel)
     + a very sharp sun specular (pow 256) × 2, all as in Drops' MainShader;
   · a soft spectral caustic glint on the river under it (a baked sprite lying on the water, Drops' caustics in the cheapest form);
   · liquid: a slow surface-tension wobble on time (the ellipsoid's three axes breathe, volume kept), a vertical stretch while it rises and a
     stretch along its flight while it races ahead dragging the beam;
   · the beam's family: a faint blue inner glow and a small soft halo (it is the beam's head).
   Size ≈ 4.5 % of the screen width while it holds (≈ 85 px at 1880; smaller share on upright phones). Finite, ≥ 0 outputs; adds light without
   touching the buffer's alpha. ?drop=0 = no drop and no sequence (the beam then runs as before).

   ---- Drops (https://oimo.io/works/drops), whose shading recipe is reused here ----
   MIT License

   Copyright (c) 2023 saharan

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
   ---- */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('drop') === '0' || Q.get('beam') === '0') return;
  const BEAMTRAIL = Q.get('trail') === 'beam';
  const pair = (k, d) => { const v = (Q.get(k) || '').split(',').map(Number); return v.length === 2 && v.every(Number.isFinite) ? v : d; };
  const T = {
    p2: pair('seqP2', [5.00, 5.12]), p3: pair('seqP3', [5.12, 5.28]), p4: pair('seqP4', [5.28, 6.30]),
    hold: 27,
    raceTime: 3.4,         // seconds of the race (and of its way back)
    lead: 52, leadBeads: 36, dash: 34,    // metres ahead where it settles and leads (≈ 35 px across on desktop); how far past that it dashes first
    leadHeight: 1.9,       // metres above the river while it races and leads: low over the water (the wake), still clear of it
    dive: [9.30, 9.45],    // journey: at the canyon's end it dives into the river with a soft splash of light (before the lift into the view)
    screenY: .03,          // where it holds: share of the half screen above the centre (just above the horizon, above the kicker)
    radius: 1.1,           // metres on a landscape screen (≈ 4.5 % of 1880 px at 27 m); upright phones × 0.55
    disp: .012, far: 60,   // dispersion (spread of the index across red…blue); how far the exit ray is followed to read the canyon (m)
    wobble: .045, tint: [.62, .7, 1.0],
    /* CALM (Team DIVE, 2026-11-17 evening; client 「水滴在跑時候 不要太常左右左右晃」): while it runs and leads, the river's line under it is
       low-passed (averaged over ±calmSpan m) and drawn toward the screen centre by calm (0 = the river's line as before, 1 = dead centre). ?dropCalm=0..1 */
    calm: (v => Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : .7)(parseFloat(Q.get('dropCalm'))), calmSpan: 9,
    pullTo: 26             // metres ahead it leads at the canyon's hold: its lead slows to this while the visitor scrolls up to the hold (layer.pull, Team DIVE; never during the take-over)
  };
  const layer = { name: 'drop', order: 0, tune: T };
  (window.__FLOW2_SEAGULL_LAYERS__ ||= []).push(layer);
  window.__FLOW2_DROP__ = layer;
  const clamp01 = x => Math.min(1, Math.max(0, x)), smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  let THREE, ball, halo, core, glint, refl = null, RF = null, U, sp, V = {}, t0 = performance.now() / 1000;
  layer.init = ctx => {
    THREE = ctx.THREE; sp = ctx.spline;
    const ADD = { blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
    U = makeLensUniforms(THREE);
    ball = new THREE.Mesh(new THREE.SphereGeometry(1.02, 40, 28), makeLensMaterial(THREE, U));
    ball.frustumCulled = false; ball.renderOrder = 23; ball.visible = false; ctx.sceneA.add(ball);
    /* the halo / core (one baked radial dot) and the caustic glint on the water (a baked spectral ring) */
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, 'rgba(205,220,255,0.7)'); gr.addColorStop(.5, 'rgba(140,165,255,0.16)'); gr.addColorStop(1, 'rgba(120,140,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const dot = new THREE.CanvasTexture(cv); dot.colorSpace = THREE.NoColorSpace;
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, ...ADD, depthWrite: false, depthTest: true, transparent: true, fog: false, toneMapped: false, opacity: 0, color: 0xffffff }));
    core = new THREE.Sprite(halo.material.clone());
    halo.renderOrder = 22; core.renderOrder = 24; halo.visible = core.visible = false; ctx.sceneA.add(halo, core);
    const cw = 96, cd = new Uint8Array(cw * cw * 4);
    for (let y = 0; y < cw; y++) for (let x = 0; x < cw; x++) {
      const dx = (x + .5) / cw * 2 - 1, dy = (y + .5) / cw * 2 - 1, r = Math.hypot(dx, dy), k = (y * cw + x) * 4;
      const coreL = Math.exp(-r * r * 40) * 1.0, ring = Math.exp(-Math.pow((r - .55) / .12, 2)) * .35, hue = (r - .43) / .24;   // a bright focus + a faint spectral ring
      const sr = clamp01(1.5 - Math.abs(hue - 1) * 2.2), sg = clamp01(1.5 - Math.abs(hue - .5) * 2.2), sb = clamp01(1.5 - Math.abs(hue) * 2.2), fall = r < 1 ? 1 : 0;
      cd[k] = Math.round(clamp01(coreL + ring * sr) * 255 * fall); cd[k + 1] = Math.round(clamp01(coreL + ring * sg) * 255 * fall); cd[k + 2] = Math.round(clamp01(coreL + ring * sb) * 255 * fall); cd[k + 3] = 255;
    }
    const ct = new THREE.DataTexture(cd, cw, cw, THREE.RGBAFormat); ct.magFilter = ct.minFilter = THREE.LinearFilter; ct.needsUpdate = true;
    glint = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ct, ...ADD, depthWrite: false, depthTest: true, transparent: true, fog: false, toneMapped: false,
      opacity: 0, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    glint.frustumCulled = false; glint.renderOrder = 18; glint.visible = false; ctx.sceneA.add(glint);
    /* the drop's own broken reflection on the river (where the lens sees its mirror image), unless the bead / wake module draws one */
    if (Q.get('trail') !== 'beads') {   /* the bead module draws its own reflection with the beads */
      const NW = 64, nd = new Uint8Array(NW * NW * 4), h1 = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
      for (let y = 0; y < NW; y++) for (let x = 0; x < NW; x++) { const k = (y * NW + x) * 4, gx = x >> 3, gy = y >> 3, fx = (x & 7) / 8, fy = (y & 7) / 8, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = h1((gx & 7) * 57 + (gy & 7) * 131), b = h1(((gx + 1) & 7) * 57 + (gy & 7) * 131), c = h1((gx & 7) * 57 + ((gy + 1) & 7) * 131), e = h1(((gx + 1) & 7) * 57 + ((gy + 1) & 7) * 131);
        nd[k] = nd[k + 1] = nd[k + 2] = Math.round(((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + e * sx) * sy) * 255); nd[k + 3] = 255; }
      const nt = new THREE.DataTexture(nd, NW, NW, THREE.RGBAFormat); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.magFilter = nt.minFilter = THREE.LinearFilter; nt.needsUpdate = true;
      RF = { uNoise: { value: nt }, uTime: { value: 0 }, uAmt: { value: 0 } };
      refl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        uniforms: RF, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
        depthTest: true, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
        vertexShader: 'varying vec2 vP; varying vec2 vW; void main(){ vP = position.xz * 2.0; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `precision highp float; uniform sampler2D uNoise; uniform float uTime, uAmt; varying vec2 vP; varying vec2 vW;
void main(){ float r = length(vP * vec2(1.0, 0.45)); float n = texture2D(uNoise, vW * vec2(0.5, 0.12) + vec2(0.0, uTime * 0.12)).r;
  float a = exp(-r * r * 3.0) * (0.35 + 0.65 * smoothstep(0.35, 0.7, n)) * uAmt;
  gl_FragColor = vec4(clamp(vec3(0.78, 0.88, 1.0) * a, 0.0, 6.0), 0.0); }`
      }));
      refl.frustumCulled = false; refl.renderOrder = 18; refl.visible = false; ctx.sceneA.add(refl);
    }
    ctx.drop = { on: false, pos: new THREE.Vector3(), sArc: 0, merge: 0, beam: 0, race: 0, fade: 1 };
    Object.assign(V, { R: new THREE.Vector3(), Up: new THREE.Vector3(), F: new THREE.Vector3(), cam: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(),
      sun: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), z: new THREE.Vector3(0, 0, 1), dir: new THREE.Vector3(), sc: new THREE.Vector3() });
  };
  /* the race clock: 0 = holding, 1 = arrived ahead (time-driven; reverses on time). From then on the drop leads (never disappears in the canyon). */
  let race = 0, raceLast = 0, onNow = false;
  layer.busy = () => onNow || (race > 0 && race < 1);
  /* fast motion (the page then keeps its full frame rate): the race on time, the gathering, the dive; at rest the idle cap may halve it */
  let fastNow = false; layer.fast = () => fastNow;   /* keeps the host's frame alive while the drop is in the canyon (past the beam's own range) */

  /* REUSABLE LENS (for Team XS's gorge, prototypes/drop-gorge/): the same drop material in another scene.
     const mat = window.__FLOW2_DROP__.makeLensMaterial(THREE);           // a ShaderMaterial with its own uniforms (mat.uniforms)
     window.__FLOW2_DROP__.updateLens(mat, { mesh, camera, sceneTexture, width, height, sunDir, sunColor, skyColor, opacity, glow });
     – mesh: a SphereGeometry(1.02) mesh (any position / rotation / non-uniform scale: the lens is the exact ellipsoid of its matrix);
     – sceneTexture: that scene's picture behind the drop (a resolved texture NOT attached to the framebuffer being drawn into), or null;
     – call updateLens every frame after the mesh and camera matrices are final. Premultiplied output, finite and ≥ 0.
     window.__FLOW2_DROP__.dive = 0..1 (the canyon-end dive), .state = the drop's last state (position in ctx.drop). */
  function makeLensUniforms(THREE) {
    return { tScene: { value: null }, uHasScene: { value: 0 }, uScreen: { value: new THREE.Vector2(1, 1) }, uMV: { value: new THREE.Matrix4() }, uInvMV: { value: new THREE.Matrix4() },
      uNrm: { value: new THREE.Matrix3() }, uProj: { value: new THREE.Matrix4() }, uViewToWorld: { value: new THREE.Matrix3() }, uSun: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color(.7, .78, .9) }, uWater: { value: new THREE.Color(.04, .08, .16) }, uTint: { value: new THREE.Color(...T.tint) },
      uOpacity: { value: 1 }, uGlow: { value: .3 }, uDisp: { value: T.disp }, uFar: { value: 60 }, uScaleAvg: { value: 1 } }
  }
  function makeLensMaterial(THREE, uniforms) {
    return new THREE.ShaderMaterial({
      uniforms, transparent: true, depthTest: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.FrontSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: /* glsl */`varying vec3 vView; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`precision highp float;
uniform sampler2D tScene; uniform float uHasScene, uOpacity, uGlow, uDisp, uFar, uScaleAvg; uniform vec2 uScreen;
uniform mat4 uMV, uInvMV, uProj; uniform mat3 uNrm, uViewToWorld; uniform vec3 uSun, uSunCol, uSky, uWater, uTint; varying vec3 vView;
/* TRUE LENS (2026-11-17, client's references: a raymarched water-blob shader on Shadertoy — look only, no code — and three's physical-transmission
   example): the view ray refracts INTO the drop (1/1.33), crosses it, refracts OUT (1.33); the exit ray is followed far and the canyon picture
   is read where it lands, so the canyon shows INVERTED and magnified inside the drop. Total internal reflection near the rim gives the thin dark
   band that makes it read solid; a Schlick reflection wraps the bright sky / canyon round the edge. All on the exact ellipsoid (no extra pass). */
vec3 picture(vec3 fromV, vec3 dir){
  vec4 c = uProj * vec4(fromV + dir * uFar, 1.0);
  if (c.w <= 1e-3) return uSky;                                         /* bent behind the lens: the sky */
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  vec2 o = max(vec2(0.0), max(-uv, uv - 1.0));                          /* off the screen: fade to the canyon's air */
  vec3 s = uHasScene > 0.5 ? max(texture2D(tScene, clamp(uv, vec2(0.002), vec2(0.998))).rgb, vec3(0.0)) : uSky;
  return mix(s, uSky, smoothstep(0.0, 0.12, max(o.x, o.y))); }
vec3 envAt(vec3 dirV){ vec3 w = uViewToWorld * dirV; return mix(uWater, uSky * 1.25, smoothstep(-0.12, 0.3, w.y)); }
/* one wavelength through the drop: entry point / normal given, returns the colour carried by the exit ray (or the inner reflection) */
vec3 through(vec3 p1o, vec3 nIn, vec3 eye, float eta, out float tir, out float thick){
  vec3 d1 = refract(eye, nIn, 1.0 / eta); if (dot(d1, d1) < 1e-8) d1 = eye;
  vec3 o = p1o, dd = (uInvMV * vec4(d1, 0.0)).xyz; float dl = length(dd); dd = dl > 1e-6 ? dd / dl : vec3(0.0, 0.0, -1.0);
  float b = dot(o, dd), h = max(b * b - (dot(o, o) - 1.0), 0.0), t2 = -b + sqrt(h);
  vec3 p2o = o + dd * max(t2, 0.0); thick = max(t2, 0.0) * uScaleAvg;
  vec3 nOut = uNrm * p2o; float lo = length(nOut); nOut = lo > 1e-6 ? nOut / lo : -eye;
  vec3 p2v = (uMV * vec4(p2o, 1.0)).xyz;
  vec3 d2 = refract(d1, -nOut, eta);
  if (dot(d2, d2) < 1e-8) { tir = 1.0; return envAt(reflect(d1, -nOut)) * 0.32; }   /* total internal reflection: the dark band */
  tir = 0.0; return picture(p2v, d2); }
void main(){
  float lv = length(vView); vec3 eye = lv > 1e-5 ? vView / lv : vec3(0.0, 0.0, -1.0);
  vec3 ro = (uInvMV * vec4(0.0, 0.0, 0.0, 1.0)).xyz, rd = (uInvMV * vec4(eye, 0.0)).xyz; float rl = length(rd); rd = rl > 1e-6 ? rd / rl : vec3(0.0, 0.0, -1.0);
  float b = dot(ro, rd), h = b * b - (dot(ro, ro) - 1.0); if (h <= 0.0) discard;
  vec3 p1o = ro + rd * (-b - sqrt(h));
  vec3 nf = uNrm * p1o; float lf = length(nf); nf = lf > 1e-6 ? nf / lf : -eye;
  float ndv = clamp(dot(-eye, nf), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);                          /* Schlick, water */
  /* through the drop in three wavelengths (a faint rainbow at the edge) */
  float tr, tg, tb, kr, kg, kb; float dsp = uDisp * (0.4 + 1.6 * (1.0 - ndv));
  vec3 thru = vec3(through(p1o, nf, eye, 1.33 - dsp, tr, kr).r, through(p1o, nf, eye, 1.33, tg, kg).g, through(p1o, nf, eye, 1.33 + dsp, tb, kb).b);
  thru *= pow(vec3(0.94, 0.975, 1.0), vec3(kg / 1.2));                    /* clear water: the faintest cool tint through the thick centre */
  thru *= 1.08;                                                          /* a little brighter and crisper than around it */
  float band = 1.0 - 0.45 * exp(-pow((ndv - 0.3) / 0.12, 2.0));         /* the thin darker band just inside the rim */
  vec3 rf = reflect(eye, nf), refl = envAt(rf);
  vec2 ruv = clamp(gl_FragCoord.xy / uScreen + rf.xy * 0.06, vec2(0.002), vec2(0.998));
  if (uHasScene > 0.5) refl = mix(refl, max(texture2D(tScene, ruv).rgb, vec3(0.0)) * 1.15, 0.45);   /* the canyon round it, reflected crisply */
  vec3 rw = normalize(uViewToWorld * rf + vec3(1e-6));
  float spec = pow(max(dot(rw, uSun), 0.0), 256.0) * 2.0 + pow(max(dot(rw, vec3(0.0, 1.0, 0.0)), 0.0), 256.0) * 1.2 + pow(max(dot(rw, uSun), 0.0), 40.0) * 0.08;
  float heart = pow(ndv, 8.0) * uGlow;                                  /* the beam's faint inner light */
  vec3 col = mix(thru * band, refl, F) + vec3(1.0) * pow(1.0 - ndv, 6.0) * 0.25 + uSunCol * spec + uTint * heart;
  gl_FragColor = vec4(clamp(col, 0.0, 24.0) * uOpacity, uOpacity);
}`
    });
  }
  layer.makeLensMaterial = (THREE3, opts = {}) => { const m = makeLensMaterial(THREE3, makeLensUniforms(THREE3)); if (opts.disp != null) m.uniforms.uDisp.value = opts.disp; if (opts.far != null) m.uniforms.uFar.value = opts.far; return m; };
  layer.updateLens = (mat, o = {}) => {
    const u = mat.uniforms, cam = o.camera, mesh = o.mesh; if (!u || !cam || !mesh) return;
    mesh.updateMatrixWorld(); cam.updateMatrixWorld();
    u.uMV.value.multiplyMatrices(cam.matrixWorldInverse, mesh.matrixWorld); u.uInvMV.value.copy(u.uMV.value).invert(); u.uNrm.value.getNormalMatrix(u.uMV.value);
    u.uProj.value.copy(cam.projectionMatrix); u.uViewToWorld.value.setFromMatrix4(cam.matrixWorld);
    u.tScene.value = o.sceneTexture || null; u.uHasScene.value = o.sceneTexture ? 1 : 0; if (o.width) u.uScreen.value.set(o.width, o.height);
    if (o.sunDir) u.uSun.value.copy(o.sunDir).normalize(); if (o.sunColor) u.uSunCol.value.copy(o.sunColor); if (o.skyColor) u.uSky.value.copy(o.skyColor);
    u.uOpacity.value = o.opacity ?? 1; u.uGlow.value = o.glow ?? .3; u.uScaleAvg.value = (mesh.scale.x + mesh.scale.y + mesh.scale.z) / 3;
  };
  layer.dive = 0;
  layer.diveOverride = null;   /* set to 0..1 by prototypes/drop-gorge (transition A); null = the journey drives the dive */
  layer.pull = 0;              /* DIVE HOOK: 0..1, the drop's lead slows to T.pullTo m as the visitor comes to the canyon's hold */
  layer.ahead = 0; layer.lift = 0;   /* DIVE HOOK (phase 5): metres forward / up during the take-over's dive — it dives FORWARD and down, never back */
  layer.warmPose = ctx => { U.uOpacity.value = 1; ball.position.copy(ctx.canyon.camera.position).add(new THREE.Vector3(0, 0, -20).applyQuaternion(ctx.canyon.camera.quaternion)); ball.scale.setScalar(T.radius); };
  layer.hide = () => { if (!ball) return; ball.visible = halo.visible = core.visible = glint.visible = false; if (refl) refl.visible = false; };

  /* a point at screen (x, y) shares and d metres ahead of the lens (through the phone's view window, as the flock does) */
  function lensPoint(cam, x, y, d, out) {
    const cv = cam.view, W = cv && cv.enabled ? cv : null;
    const fx = W ? ((x * .5 + .5) * W.width + W.offsetX) / W.fullWidth * 2 - 1 : x, fy = W ? 1 - (((.5 - y * .5) * W.height + W.offsetY) / W.fullHeight) * 2 : y;
    const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), th = tv * cam.aspect, e = cam.matrixWorld.elements;
    V.R.set(e[0], e[1], e[2]); V.Up.set(e[4], e[5], e[6]); V.F.set(-e[8], -e[9], -e[10]); V.cam.setFromMatrixPosition(cam.matrixWorld);
    return out.copy(V.cam).addScaledVector(V.R, fx * d * th).addScaledVector(V.Up, fy * d * tv).addScaledVector(V.F, d);
  }

  const radiusAt = (camera, race) => T.radius * (camera.aspect < 1 ? .55 + .2 * smooth(0, 1, race) : 1);
  function applyDive(point, radius, depth) {
    if (depth > 0) point.y += (-radius * 2.4 - point.y) * Math.pow(depth, 1.6);
  }
  layer.sampleHandoff = (camera, depth, out) => {
    if (!V.cam) return 0;
    const radius = radiusAt(camera, 0);
    lensPoint(camera, 0, T.screenY, T.hold, out);
    applyDive(out, radius, depth);
    return radius;
  };
  /* the race: from the hold (27 m, screen centre) a dash ahead (≈ 85 m) that settles at the LEAD distance; then it leads down the river */
  const raceEase = r => 1 - Math.pow(1 - r, 3);
  function dropAt(p, e, cam, out) {   /* where the drop is at journey p and race point e (without the rise / dive); returns its arc */
    const lead = (BEAMTRAIL ? T.lead : T.leadBeads) * (cam.aspect < 1 ? .8 : 1);   /* with the beads + wake it leads nearer, so they read */   /* upright phones: a little nearer, so it still reads */
    let d = T.hold + (lead - T.hold) * raceEase(e) + T.dash * Math.sin(Math.PI * Math.min(1, e * 1.15)) * Math.pow(1 - e, .6);
    if (layer.pull > 0) d += (T.pullTo - d) * Math.min(1, layer.pull);   /* DIVE HOOK: its lead slows before the hold (the lens never goes forward) */
    if (layer.ahead > 0) d += layer.ahead;   /* DIVE HOOK: the dive carries it on ahead */
    lensPoint(cam, 0, T.screenY, T.hold, out);
    const s = sp.lensArc(p) + d, k = smooth(0, .3, e);
    if (k > 0) { sp.point(s, V.c);
      if (T.calm > 0) {   /* CALM: low-pass the river's line, then toward the screen centre at the same distance */
        const W = V.w || (V.w = new THREE.Vector3()); sp.point(s - T.calmSpan, W); V.c.add(W); sp.point(s + T.calmSpan, W); V.c.add(W).multiplyScalar(1 / 3);
        lensPoint(cam, 0, T.screenY, d, W); V.c.x += (W.x - V.c.x) * T.calm; V.c.z += (W.z - V.c.z) * T.calm;
      }
      const lh = Math.max(T.leadHeight, cam.position.y + .35);   /* low over the river, just above the lens's eye line (clear of the title below the horizon) */
      V.c.y = BEAMTRAIL ? V.c.y + 1.2 * smooth(.2, 1, e) : lh + (V.c.y - lh) * (1 - smooth(.2, 1, e)); out.lerp(V.c, k); }
    return s;
  }

  layer.update = (f, ctx, readBuffer) => {
    const D = ctx.drop, p = f.p, cam = ctx.canyon.camera; cam.updateMatrixWorld();
    const e2 = smooth(T.p2[0], T.p2[1], p), e3 = BEAMTRAIL ? smooth(T.p3[0], T.p3[1], p) : 0;   /* phase 3 (the beam gathering) only with ?trail=beam; else the drop just holds */
    /* the race plays on time toward 1 once the visitor is past the phase-4 start, back toward 0 above it */
    const nowS = performance.now() / 1000, dtR = Math.min(.1, Math.max(0, nowS - (raceLast || nowS))); raceLast = nowS;
    race = Math.min(1, Math.max(0, race + (p >= T.p4[0] ? 1 : -1) * dtR / T.raceTime));
    if (typeof window.__SG_RACE__ === 'number') race = clamp01(window.__SG_RACE__);
    /* the canyon's end: it dives into the river with a soft splash of light (scroll-driven, reversible), before the lift into the view */
    /* 2026-11-17 (Team DV, transition A): the gorge may drive the dive itself (camera follows the drop through the surface); null = journey-driven as before */
    const dv = typeof layer.diveOverride === 'number' ? clamp01(layer.diveOverride) : smooth(T.dive[0], T.dive[1], p); layer.dive = dv;
    fastNow = (race > 0 && race < 1) || (e3 > 0 && e3 < 1) || (dv > 0 && dv < 1);
    D.on = onNow = p > T.p2[0] && dv < .999; D.beam = e3; D.merge = e3; D.race = race; D.fade = 1; D.trail = 1 - smooth(.35, .8, dv);
    if (!D.on) { layer.hide(); return; }
    const R = radiusAt(cam, race); D.radius = R;   /* phones: a little larger once it leads */
    const sArc = dropAt(p, race, layer.handoffCamera ?? cam, V.a), dist = sArc - sp.lensArc(p);
    const rise = easeOut(e2);
    if (e2 < 1) V.a.y = -R * 1.6 + (V.a.y + R * 1.6) * rise;   /* out of the river (the water hides what is still under it) */
    const now = performance.now() / 1000 - t0, live = f.reduced ? 0 : 1;
    if (race >= 1) V.a.y += .18 * Math.sin(now * .9) * live;     /* leading: it hovers, breathing (on time, barely) */
    if (layer.lift > 0) V.a.y += layer.lift;   /* DIVE HOOK: a small lift / hang before it falls */
    applyDive(V.a, R, dv);
    D.pos.copy(V.a); D.sArc = sArc;
    /* liquid: a slow wobble (three axes, volume kept); a teardrop drawn toward its trail, longer while it dashes */
    const wx = 1 + T.wobble * Math.sin(now * 1.9) * live, wy = 1 + T.wobble * Math.sin(now * 1.9 + 2.1) * live, wz = 1 / (wx * wy);
    let dirOK = false;
    if (race > 0 && race < 1) { dropAt(p, Math.min(1, race + .01), cam, V.b); V.dir.subVectors(V.b, V.a); dirOK = V.dir.lengthSq() > 1e-6; }
    if (!dirOK && e3 > 0) { sp.point(sArc + 4, V.b); sp.point(sArc - 4, V.c); V.dir.subVectors(V.b, V.c); if (race < .3) { V.b.copy(V.a); sp.point(sArc - 6, V.c); V.dir.subVectors(V.b, V.c); } dirOK = V.dir.lengthSq() > 1e-6; }
    if (dv > 0) { V.dir.lerp(V.c.set(0, -1, 0), dv); dirOK = true; }
    if (!dirOK && e2 < 1) { V.dir.set(0, 1, 0); dirOK = true; }
    const dash = race > 0 && race < 1 ? Math.sin(Math.PI * race) : 0;
    const stretch = 1 + .16 * Math.sin(Math.PI * e2) * (e2 < 1 ? 1 : 0) + .2 * e3 + .5 * dash + .25 * Math.sin(Math.PI * dv);
    if (dirOK) { V.dir.normalize(); V.q.setFromUnitVectors(V.z, V.dir); } else V.q.identity();
    ball.position.copy(D.pos); ball.quaternion.copy(V.q);
    ball.scale.set(R * wx / Math.sqrt(stretch), R * wy / Math.sqrt(stretch), R * wz * stretch); ball.visible = true;
    ball.updateMatrixWorld(true);
    const appear = smooth(0, .25, e2) * (1 - smooth(.85, 1, dv)), splash = Math.sin(Math.PI * smooth(.45, .95, dv));   /* the soft splash of light as it enters the river */
    U.uOpacity.value = appear; U.uGlow.value = (.25 + .35 * e3 + .25 * smooth(0, .3, race)) * (.9 + .1 * Math.sin(now * 2.3) * live);
    U.uMV.value.multiplyMatrices(cam.matrixWorldInverse, ball.matrixWorld); U.uInvMV.value.copy(U.uMV.value).invert(); U.uNrm.value.getNormalMatrix(U.uMV.value);
    U.uProj.value.copy(cam.projectionMatrix); U.uViewToWorld.value.setFromMatrix4(cam.matrixWorld);
    const hasScene = readBuffer.samples > 0 && readBuffer.texture;
    U.tScene.value = hasScene ? readBuffer.texture : null; U.uHasScene.value = hasScene ? 1 : 0; U.uScreen.value.set(readBuffer.width, readBuffer.height);
    U.uFar.value = T.far; U.uScaleAvg.value = (ball.scale.x + ball.scale.y + ball.scale.z) / 3;
    const scene = ctx.canyon.scene, sun = scene.children.find(o => o.isDirectionalLight && o.castShadow);
    if (sun) { U.uSun.value.copy(sun.position).sub(sun.target.position).normalize(); U.uSunCol.value.copy(sun.color).multiplyScalar(Math.min(4, sun.intensity * .2)); }
    if (scene.fog) U.uSky.value.copy(scene.fog.color).multiplyScalar(1.15);
    /* the beam's family: a small soft halo and a faint core (the drop itself stays clear water) */
    halo.position.copy(D.pos); halo.scale.setScalar(R * (3.0 + .8 * e3)); halo.material.opacity = (.12 + .1 * e3) * appear; halo.material.color.setScalar(1.4); halo.visible = true;
    core.position.copy(D.pos); core.scale.setScalar(R * .3); core.material.opacity = (.3 + .3 * e3) * appear; core.material.color.setScalar(2.0); core.visible = true;
    /* the caustic glint on the river under it (brighter the lower it flies), and the splash of light where it dives in */
    const hgt = Math.max(.05, D.pos.y), gl = Math.max(appear * (1 - smooth(1, 9, hgt)) * smooth(.15, .6, e2) * (1 - smooth(.05, .3, race) * .6), splash);
    if (refl) {   /* its reflection: where the lens sees it mirrored in the river, stretched toward the lens, broken by the waves */
      const ch = Math.max(.3, cam.position.y), dh = Math.max(.2, D.pos.y), kk = ch / (ch + dh);
      refl.position.set(cam.position.x + (D.pos.x - cam.position.x) * kk, .05, cam.position.z + (D.pos.z - cam.position.z) * kk);
      refl.rotation.y = Math.atan2(cam.position.x - refl.position.x, cam.position.z - refl.position.z); refl.scale.set(R * 1.3, 1, R * 4.2);
      RF.uAmt.value = .5 * appear * (1 - smooth(3, 10, dh)) * (D.pos.y > .1 ? 1 : 0) * smooth(.5, 1, e2); RF.uTime.value = now % 1000; refl.visible = RF.uAmt.value > .01;
    }
    glint.visible = gl > .003; glint.position.set(D.pos.x, .05, D.pos.z); glint.scale.setScalar(R * (1.4 + hgt * .5 + 4 * splash)); glint.material.opacity = Math.min(1, gl * .9); glint.material.color.setScalar(1.6 + 1.2 * splash);
    V.b.copy(D.pos).applyMatrix4(cam.matrixWorldInverse);
    ctx.state.drop = { p2: +e2.toFixed(3), p3: +e3.toFixed(3), race: +race.toFixed(3), dive: +dv.toFixed(3), dist: +dist.toFixed(1), z: +(-V.b.z).toFixed(1), r: R, stretch: +stretch.toFixed(2) };
  };
})();
