/* Flow2 readiness (2026-11-11): for index1-5-flow2.html only. Loaded before main.js. ?perf=0 leaves all of it out.
   Client: 「進場後例如到第二段就會卡住了 或是到山谷 卡住 這應該是後面的特效還沒跑好???」「注意開場loading速度現在有點慢」
   「如果是因為電腦效能....等因素 你就把畫質跟3D的細緻度或是webgl細節降階就好了」.

   WHAT WAS WRONG (measured; docs/flow2/flow2-perf-20261111.md). The page lets the visitor in as soon as the opening drop is
   painted, and prepares the wordmark chapter and then the valley behind it. Scrolling is held at the door of a chapter that is
   not ready. The entry choice is up after 2–4 s, but:
   - the wordmark chapter waits for one program, the water drops', which the graphics driver takes 4–5 s to build whenever the
     browser has not kept it (a first visit always; later visits often: the browser's shader cache is small and this page has
     several programs too big to all stay in it): ready at 7–8 s, the visitor has been at its door since 3.5–5 s;
   - the valley's terrain was not begun until that was done and the entry wave had finished, and its own programs take
     another 4 s: ready at 13–15 s.

   WHAT THIS DOES
   1. eager: main.js (FLOW2_EAGER_WARMUP) starts the terrain as soon as the hero's own programs are back from the driver,
      side by side with the wordmark's, instead of after it and after the gate.
   2. The drops in two steps. Their program is slow because it holds the drop twice: once still, once smeared by motion. The
      first is built alone (STILL: the same text with the smear's branch closed; about a third of the time) and the chapter
      opens on it; the whole program is built behind everything else and the drops are given it when it arrives (promote()).
      Until then a fast drop is drawn sharp instead of smeared: nothing else differs, and nothing at all once it has arrived.
      The module that owns the shader is shared with the live page and is not changed; this page changes its own copy of the
      text before it is compiled.
   3. pace(): toward a chapter that is still being prepared the journey keeps moving, at a calmer pace, instead of running to
      the door and standing there. journey.waiting ('logo' | 'valley') says so to the interface.
   4. The film-grain sheet nobody sees is not generated (see the end of this file).
   ?perfDrops=full builds the drops' whole program at once as before; ?perfPace=0 no calmer pace, ?perfPace=steady the calmer
   pace at one speed (as first built) instead of set by when the valley is expected; ?perf=0 none of this.
   window.__FLOW2_PERF__.marks has the times. */
(() => {
  const q = new URLSearchParams(location.search);
  if (q.get('perf') === '0') return;
  const BRANCH = 'if(uBlurOn>.5){', CLOSED = 'if(false){';
  const twoSteps = q.get('perfDrops') !== 'full';
  const isDrop = material => !!(material?.isShaderMaterial && material.uniforms?.uBlurSamples && material.uniforms?.uBlurOn);
  let stage = twoSteps ? 'still' : 'full', seen = -1, queue = null;
  const P = window.__FLOW2_PERF__ = {
    eager: 1,
    bake: q.get('perfBake') || 'late',   // 'early' = the terrain's workers start with the page (measured: the opening screen pays half a second for it)
    marks: {},
    get stage() { return stage; },
    /* every drop of the module (the sixteen, the core, the plain ones made when the letters arrive) carries the text of the
       current step, so they all share one program */
    patch({ logoDrops } = {}) {
      if (!twoSteps || !logoDrops?.group) return;
      logoDrops.group.traverse(object => {
        const material = object.material;
        if (!isDrop(material) || material.userData.f2Step === stage) return;
        const whole = material.userData.f2Whole ??= material.fragmentShader;
        if (whole.split(BRANCH).length !== 2) { material.userData.f2Step = stage; return; }   // not the text this was written for: left as it is
        material.fragmentShader = stage === 'still' ? whole.replace(BRANCH, CLOSED) : whole;
        material.userData.f2Step = stage; material.needsUpdate = true;
      });
      seen = logoDrops.group.children.length;
    },
    /* one drop carrying the whole program, to be compiled behind everything else (main.js hands it to the driver) */
    wholeGroup({ THREE, logoDrops } = {}) {
      if (!twoSteps || stage !== 'still') return null;
      const source = logoDrops?.meshes?.find(mesh => isDrop(mesh.material) && mesh.material.userData.f2Whole);
      if (!source) return null;
      const material = source.material.clone();
      material.fragmentShader = source.material.userData.f2Whole; material.userData = {}; material.needsUpdate = true;
      const mesh = new THREE.Mesh(source.geometry, material); mesh.frustumCulled = false;
      const group = new THREE.Group(); group.add(mesh); group.userData.dispose = () => material.dispose();
      return group;
    },
    /* the whole program has arrived: the drops take it, a few each frame (taking it is a cache hit, not a build) */
    promote({ logoDrops } = {}) {
      if (stage !== 'still' || !logoDrops?.group) return;
      stage = 'full'; queue = []; logoDrops.group.traverse(object => { if (isDrop(object.material)) queue.push(object.material); });
      P.marks['drops-whole'] ??= Math.round(performance.now());
    },
    /* after the drops have been placed for this frame */
    frame({ logoDrops } = {}) {
      if (!twoSteps || !logoDrops?.group) return;
      if (logoDrops.group.children.length !== seen) P.patch({ logoDrops });
      if (queue) {
        for (let n = 0; n < 6 && queue.length; n++) { const material = queue.pop(); if (material.userData.f2Step !== 'full' && material.userData.f2Whole) { material.fragmentShader = material.userData.f2Whole; material.userData.f2Step = 'full'; material.needsUpdate = true; } }
        if (!queue.length) queue = null;
      }
      /* a drop still on the first step is never asked to smear: its program has no smear */
      for (const mesh of logoDrops.group.children) { const material = mesh.material; if (material?.userData.f2Step === 'still') material.uniforms.uBlurOn.value = 0; }
    },
    /* How far ahead of where it is the journey may aim while the chapter beyond LIMIT is being prepared: the follow's speed is
       its rate times that lead, so this is a speed (units per second) written as a lead. 0 = no say. */
    pace(kind, progress, limit) {
      const mode = q.get('perfPace');
      if (mode === '0') return 0;
      const rate = window.__SILK__?.lambda || 7.2, left = limit - progress;
      if (left > 2.2) return 0;
      let speed = kind === 'valley' ? .4 : .7;   // the wordmark's chapter (1.8 long) then takes about five seconds: its letters forming, seen properly
      if (kind === 'valley' && mode !== 'steady') {
        /* That steady pace arrives at the valley's door about when the valley usually is ready. When the driver takes longer over
           the terrain's programs (4.5 s as a rule, 6.3 s seen) it arrived early and stood there for a second (one cold start in
           nine, 2026-11-11). So the pace is set by when the valley can be expected: never faster than the steady pace, slower
           when the valley will be late, and over the last stretch it eases in, so the journey never runs up to the door and
           stops dead: it is still moving, a little, when the door opens. ?perfPace=steady compares. */
        const boot = window.__FINNOVATION_BOOT__?.marks || {}, now = performance.now();
        const due = boot['terrain-ready'] ? boot['terrain-ready'] + 5000 : (boot['terrain-building'] ?? now) + 11000;
        speed = Math.min(speed, Math.max(.14, left / Math.max(.3, (due - now) / 1000)));
        if (left < .3) speed = Math.min(speed, Math.max(.02, left * 1.2));
      }
      return speed / rate;
    }
  };
  document.documentElement.dataset.flow2Perf = 'on';
  /* 4. The film-grain sheet is hidden on every screen of this page (the two flow2-fine files), yet alpine-ui.js still generated it at the
     start: a third of a second of main-thread work for something never seen. alpine-ui.js skips it when it finds this attribute.
     Not set when the grain is kept by one of the fine layers' own switches. */
  if (q.get('fine') !== '0' && q.get('fineFilm') !== 'keep' && !(q.get('fineOff') || '').split(',').includes('grain') && q.get('atmos') !== '1') document.documentElement.setAttribute('data-flow2-no-grain', '');
})();
