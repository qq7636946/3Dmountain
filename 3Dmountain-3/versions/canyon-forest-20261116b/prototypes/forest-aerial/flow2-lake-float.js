/* Flow2 · the floating mark over the lake (2026-11-16). index1-5-canyon-forest.html, ?lakeLogo=float (index1-5-canyon-forest-float.html opens it so).
   Client: 「然後再給我一個版本 中間有LOGO浮著 類似這樣」 with a picture: the glass mark standing UPRIGHT in the middle of the lake, its foot in the
   water, rings spreading round it and its reflection under it, seen from an oblique lens. The SAME glass mark as the canyon's
   (prototypes/index1-5/js/world-logo-mark.js with the canyon mark's look from flow2-mark.js), so the mark met at the start of the valley comes back.

   · Upright, turned to face the lens, its foot a little under the water (the water cuts it: a clipping plane at the surface); it breathes up and down.
   · Rings spread from its foot and its reflection lies under it, broken by the waves — both in the water's own shader (flow2-original-scene.js,
     FOREST_LOGO, float branch), from the pose this file publishes.
   · It rises out of the lake turning one whole revolution as the spreading finishes, and sinks back when the spreading runs back.
   · This version opens with a more oblique lens (the scene's 視角 dial 俯角 starts at +26° here), so an upright mark reads.
   · Drawn the way flow2-mark.js draws the canyon's glass (little cost): a tiny scene of its own, rendered into a buffer with smoothed edges and laid
     over the view; what the glass refracts is a copy of the view of the same frame. Hook: flow2-forest-atlas.js calls draw() right after the view.
   Panel 「森林水流」 (O): 湖上浮空 LOGO rows. Reduce motion: simply there. Loaded before flow2-forest-atlas.js. Without ?lakeLogo=float it does nothing. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('lakeLogo') !== 'float') return;
  document.documentElement.setAttribute('data-lake-logo', 'float');
  const SRC = (document.currentScript && document.currentScript.src) || new URL('prototypes/forest-aerial/flow2-lake-float.js', document.baseURI).href;
  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { return false; } })();
  /* the dials (shown in 「森林水流」; height in multiples of the lake's inscribed radius) */
  /* E2 STILL (2026-11-16, client: 「到山谷可以進場動畫一下就好就不要隨便動了」): once it has risen it holds still — no bob, no sway, and the glass's own
     time (its inner caustics, the turning reflections) stops with it; it moves again only when it sinks or rises. ?motion=old = as before. */
  const motionOld = Q.get('motion') === 'old';
  const T = { size: 1.05, sink: .06, bob: motionOld ? .03 : 0, sway: motionOld ? .6 : 0, spin: 1, glow: 1, ripple: 1, reflect: 1, lean: .7 };   /* lean: how far it leans back toward the lens (share of the lens's elevation) */
  const S = { stage: 'waiting', notes: [] };
  const pose = { x: 0, z: 0, y: 0, box: 1, cy: 0, rx: 1, rz: 0, tanE: 1, on: 0 };
  const api = window.__FLOW2_LAKE_MARK__ = { mode: 'float', tune: T, state: S, pose, viewTilt: 34, draw,
    /* E2: enter() rises now, leave() sinks now, auto() follows the spreading again (default); phase: 'away' | 'rising' | 'still' | 'sinking' */
    enter() { manual = 1; }, leave() { manual = 0; }, auto() { manual = null; },
    get phase() { const g = goalNow; if (Math.abs(g - rise) < .002) return rise > .998 ? 'still' : 'away'; return g > rise ? 'rising' : 'sinking'; } };
  let manual = null, goalNow = 0, markTime = 0;

  let THREE = null, mark = null, scene2 = null, holder = null, sun = null, copyRT = null, markRT = null, blit = null, over = null, building = null, cut = null;
  let rise = 0, last = 0, clock = 0;
  /* lead (2026-11-16, Engineer 3's note): when the stroke into the view starts an entrance that replays (back after a long time away), the mark
     starts from the water at once instead of sinking from where it stood and rising again (one entrance, never two) */
  document.addEventListener('flow2:handover', event => { const d = event.detail || {}; if ((d.dir === 1 || d.dir === 'in') && d.phase === 'start' && d.replay) rise = 0; });   /* dir 1 = into the view (flow2-lift-cut.js) */
  const WATER = .105;
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  async function build(three, renderer) {
    THREE = three; S.stage = 'loading';
    const [markModule, svgModule] = await Promise.all([
      import(new URL('../index1-5/js/world-logo-mark.js?v=i15-mw30beoi', SRC).href),
      import('three/addons/loaders/SVGLoader.js')
    ]);
    const CONFIG = window.__MONTIS_STUDY__?.CONFIG || {};
    const canyonLook = window.__FLOW2_MARK__?.tune?.look || {};
    mark = await markModule.createLogoMark({ THREE, SVGLoader: svgModule.SVGLoader, renderer, svgUrl: new URL('../../images/logo.svg', SRC).href,
      look: { ...(CONFIG.logoMark || {}), small: false, bgDisplay: 0, ...canyonLook } });
    mark.update({ yaw: 0, time: 0, q: 1 });
    cut = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER);      /* the water cuts the glass */
    mark.group.traverse(o => { if (o.isMesh && o.material) o.material.clippingPlanes = [cut]; });
    scene2 = new THREE.Scene();
    holder = new THREE.Group(); holder.add(mark.group); scene2.add(holder);
    sun = new THREE.DirectionalLight(0xffffff, 3); scene2.add(sun, sun.target);
    const tri = new THREE.PlaneGeometry(2, 2);
    copyRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    const copyMaterial = new THREE.ShaderMaterial({ uniforms: { tScene: { value: null } }, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: 'uniform sampler2D tScene; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tScene, vUv).rgb, 1.); }' });
    blit = { scene: new THREE.Scene(), camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material: copyMaterial };
    const bm = new THREE.Mesh(tri, copyMaterial); bm.frustumCulled = false; blit.scene.add(bm);
    markRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, samples: Math.max(0, Math.round(window.__FLOW2_QUALITY__?.pick?.(4, 2, 0) ?? 4)) });
    /* the view of this frame as the tiny scene's only opaque thing: three's transmission pass draws it for the glass; the glass's own draw does not */
    const backMaterial = new THREE.ShaderMaterial({ uniforms: { tScene: { value: copyRT.texture } }, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }',
      fragmentShader: 'uniform sampler2D tScene; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tScene, vUv).rgb, 1.); }' });
    const backdrop = new THREE.Mesh(tri, backMaterial); backdrop.frustumCulled = false; backdrop.renderOrder = -10;
    backdrop.onBeforeRender = r => { backMaterial.colorWrite = r.getRenderTarget() !== markRT; };
    scene2.add(backdrop);
    /* laid over the view; the brightest glints eased off (a mirror bevel in the sun is far brighter than white) */
    const overMaterial = new THREE.ShaderMaterial({ uniforms: { tMark: { value: markRT.texture }, uMax: { value: 1.3 } }, depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `uniform sampler2D tMark; uniform float uMax; varying vec2 vUv;
        void main(){ vec4 t = texture2D(tMark, vUv); float m = max(t.r, max(t.g, t.b)); if (m > uMax) t.rgb *= (uMax + (m - uMax) / (1. + (m - uMax) / uMax)) / m; gl_FragColor = t; }` });
    over = { scene: new THREE.Scene() }; const om = new THREE.Mesh(tri, overMaterial); om.frustumCulled = false; over.scene.add(om);
    holder.position.set(0, -1e4, 0);
    S.stage = 'compiling';
    const clip = renderer.localClippingEnabled; renderer.localClippingEnabled = true;
    try { await renderer.compileAsync(scene2, new THREE.PerspectiveCamera()); } catch (error) { S.notes.push('precompile skipped: ' + (error?.message || error)); }
    renderer.localClippingEnabled = clip;
    S.stage = 'ready';
  }

  /* where the mark stands this frame (the water reads pose for its rings and the reflection) */
  function seat(atlas) {
    const lake = atlas.lake, U = atlas.uniforms, cam = atlas.camera, tune = atlas.tune || {};
    const now = performance.now() / 1000, dt = last ? Math.min(.1, now - last) : 0; last = now; clock += dt;
    const grow = U && U.uGrow ? U.uGrow.value : 1, goal = manual === null ? smooth(.7, 1, grow) : manual;
    goalNow = goal;
    const before = rise;
    rise = reduced ? goal : rise + (goal - rise) * (1 - Math.exp(-dt * 1.8));
    if (Math.abs(goal - rise) < 1e-4) rise = goal;                                     /* settled: exactly still */
    if (motionOld || Math.abs(rise - before) > 1e-6) markTime += dt;                    /* the glass lives only while it moves */
    const e = rise, turn = reduced ? 0 : (1 - e) * (1 - e) * Math.PI * 2 * T.spin;     /* one revolution, slowing as it arrives */
    const H = lake.radius * T.size * (+tune.logoSize || 1);                            /* the mark's height, world units */
    const bob = reduced ? 0 : Math.sin(clock * .9) * T.bob * H * e;
    pose.x = lake.center.x + (+tune.logoX || 0); pose.z = lake.center.z + (+tune.logoZ || 0);
    const centre = WATER + H * (.5 - T.sink) * e - H * .55 * (1 - e) + bob;            /* rising out of the water */
    pose.y = centre; pose.cy = centre - WATER; pose.box = H / .8667; pose.on = e;
    /* upright, turned to the lens */
    const dx = cam.position.x - pose.x, dz = cam.position.z - pose.z, yaw = Math.atan2(dx, dz);
    holder.position.set(pose.x, centre, pose.z);
    const elev = Math.atan2(cam.position.y - WATER, Math.max(1e-3, Math.hypot(dx, dz)));
    holder.rotation.set(0, 0, 0); holder.rotateY(yaw + turn); holder.rotateX(-elev * T.lean * e); holder.rotateZ(reduced ? 0 : Math.sin(clock * .41 + 1.3) * .03 * T.sway * e);
    holder.scale.setScalar(H);
    holder.updateMatrixWorld(true);
    mark.update({ yaw: 0, time: motionOld ? clock : markTime, q: 1 });
    pose.rx = Math.cos(yaw); pose.rz = -Math.sin(yaw);
    pose.tanE = Math.max(.05, (cam.position.y - WATER) / Math.max(1e-3, Math.hypot(dx, dz)));
    if (U && U.uSun) { sun.position.copy(U.uSun.value).multiplyScalar(30).add(holder.position); sun.target.position.copy(holder.position); sun.target.updateMatrixWorld(); }
    sun.intensity = 3 * T.glow;
  }

  /* called by flow2-forest-atlas.js right after the view is rendered into its buffer (tone mapping off, that buffer bound) */
  function draw(renderer, target, atlas, three) {
    if (!atlas || !atlas.lake || !atlas.camera || !three) return;
    if (!building) building = build(three, renderer).catch(error => { S.stage = 'failed: ' + (error?.message || error); console.warn('flow2 lake float: off', error); });
    if (S.stage !== 'ready') return;
    seat(atlas);
    if (pose.on < .002) return;
    const w = target.width, h = target.height;
    if (copyRT.width !== w || copyRT.height !== h) { copyRT.setSize(w, h); markRT.setSize(w, h); }
    const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha(), auto = renderer.autoClear, clip = renderer.localClippingEnabled;
    try {
      blit.material.uniforms.tScene.value = target.texture;
      renderer.setRenderTarget(copyRT); renderer.render(blit.scene, blit.camera);
      renderer.setRenderTarget(markRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false);
      renderer.localClippingEnabled = true; renderer.render(scene2, atlas.camera); renderer.localClippingEnabled = clip;
      renderer.setRenderTarget(target); renderer.autoClear = false; renderer.render(over.scene, blit.camera);
    } finally { renderer.autoClear = auto; renderer.localClippingEnabled = clip; renderer.setClearColor(prevClear, prevAlpha); renderer.setRenderTarget(target); }
  }
})();
