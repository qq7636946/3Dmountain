/* RISE-TD · the canyon's end → the view from above, to the client's storyboard (2026-11-20):
   轉場 (lattice + clouds sweep from the left) → 黑白 (grey relief under a white grid) → 渲染 (render pass) → 彩色. Scroll-scrubbed, both ways.
   Contract: .qa/index1-5/rise-td/CONTRACT.md. This file owns the timeline, the journey moves and ONE pass at the end of the page's own
   composer (no extra canvas, no extra context). The look (td-look.js) and the render pass (td-reveal.js) draw inside that pass;
   plain built-in versions stand in for either while its file is not listed in MODULES below (or with ?tdLook=0 / ?tdReveal=0).
   Only index1-5-canyon-forest-rise.html loads this (through rise.js, ?riseOut=td, the default there). */
const MODULES = { look: '2', reveal: '2' };   // stamps, e.g. { look: '1', reveal: '1' } once the files exist (a missing file would log a 404)

export async function createTransition({ Q, engine, study, getJ, H, P1, self, html, reduced, lite, base, canStart }) {
  const THREE = engine.THREE, renderer = engine.renderer, composer = engine.composer;
  if (!THREE || !renderer || !composer) throw new Error('no composer');
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lin = (a, b, x) => clamp01((x - a) / (b - a));
  const mix = (a, b, t) => a + (b - a) * t;
  const cut = () => window.__FLOW2_LIFT_CUT__, forest = () => window.__FLOW2_FOREST_ATLAS__;
  const P2 = () => { const c = cut(); return P1() + ((c && +c.tune.to) || 8.96) - ((c && +c.tune.from) || 6.6); };

  const T = {
    /* client 2026-11-20: 「進場動畫直接跑完就好 不要free操作 一cut進場動畫演到完」: one notch plays the whole change on a clock; input is swallowed meanwhile.
       ?tdMode=scrub = the wheel-scrubbed version · ?tdBack=scrub = only the way back follows the wheel */
    /* client 2026-11-20, UPDATE 4 (the video at 10 s): the page's ORIGINAL change — the brush wipe from the left over the grey relief land, the lens
       turning into place, the colour growing in, the rivers' light — as one self-playing cut, with the colour slower and the 3D lines withdrawing once
       settled; the way back the same in reverse. style 'video' (default) is that; ?tdStyle=storyboard = the lattice / clouds / render-pass version. */
    style: Q.get('tdStyle') === 'storyboard' ? 'storyboard' : 'video',
    /* v11 (client: 「節奏可以看10秒之後的那樣一模一樣 3dline要退場」): the entry IS the original entrance, on the original clocks: the studio view runs its own
       lens turn, colour growth and river light exactly as in the client's video; this file only starts the wipe on screen at once (the video's first
       visible change = our notch), holds the input, moves the headline, and withdraws the 3D lines at the end. Times are seconds on a 3.4 s reference
       clock; tdDur stretches or shrinks ALL of it (the studio's clocks included). Measured from the video: see STATUS-TD-LEAD.md. */
    vDur: num('tdDur', 3.8),            // seconds from the notch to the settled, line-free view (input is held for this long)
    wipeV: .75,                         // the wipe crosses the screen in this time (video: first change 10.82 s, whole at 11.57 s)
    lensRate: num('tdLensRate', 1.9),   // the lens turns this many times faster than the view's default clock: in the video the valley is framed by about 2 s
    studioAt: num('tdStudioAt', .2),   // the view's own entrance clock (lens turn, colour) starts this long after the wipe appears. Fitted to the video: the land is still
                                        // all grey when the wipe has crossed (.83 s), colour half-way at 1.39 s, whole at about 2.0 s
    early: num('tdEarly', .16),         // the cut starts this far (journey units, a notch is about .15) before the canyon's end while the visitor is still scrolling: the lens and the drop never stop first (0 = only from rest)
    askWindow: .9,                      // … if that scroll was within this many seconds                           // the studio's clocks are this far along when the wipe appears (in the original the stroke starts off screen)
    linesS: num('tdLinesAt', 2.9), lineOutS: num('tdLineOut', .8),
    colourOn: .82, colourFull: 2.2,     // the colour: first green and whole, seconds after the wipe appears (video: 11.63 s and 12.8 s)
    riverOn: 1.3, riverFull: 3.3,       // the rivers' light, curtains, beams and the ring's column (video: first light 12.5 s, the column whole at 14.1 s)   // the 3D lines withdraw to nothing while the rivers light up
    headIn: 1.6, headInLen: .7,         // WHERE VALUE CONNECTS comes in (video: 12.45 → 13.2 s)
    fogS: num('tdFogAt', 1.6), fogLen: 1.4, fogRest: num('tdFog', .12),   // the cloud bank at lower left thins to this share by the settled view (1 = stays)
    /* the exit: the same rhythm backwards, on a 3.4 s reference clock that stretches with tdDurBack: lines back, river light out, colour drains,
       the lens turns back all the way through, the wipe plays out over the last .75 s */
    xLines0: .1, xLines: .9, xRiver0: .3, xRiver: 2.3, xColour0: 1.4, xColour1: 2.6, xTurn0: .25, xTurn1: 3.4, xWipe0: 2.65, xWipe1: 3.4, xJourney: .45, xHead0: 1.1, xHead1: 1.75,
    mode: Q.get('tdMode') === 'scrub' ? 'scrub' : 'cut',
    back: Q.get('tdBack') === 'scrub' ? 'scrub' : 'cut',
    dur: num('tdDur', 6),               // storyboard style: seconds of the entry
    durBack: num('tdDurBack', Q.get('tdStyle') === 'storyboard' ? 4.5 : 2),     // seconds of the way back
    ease: .6,                           // 0 = even speed, 1 = soft start and end
    notches: num('tdNotches', 10),      // wheel notches for the whole change
    follow: num('tdFollow', .32),       // seconds the picture lags the wheel
    a: num('tdA', .34),                 // end of 轉場 (clouds whole)
    x: .37,                             // the swap under the clouds
    b: num('tdB', .40),                 // 黑白 begins (clouds part)
    c: num('tdC', .62),                 // 渲染 begins
    d: num('tdD', .88),                 // 彩色 reached, the lens settled
    lineOut: Q.get('tdStyle') === 'storyboard' ? num('tdLineOut', .08) : .08,     // after settling the 3D lines withdraw to nothing over this much (client 2026-11-20: 「轉到定位後 3Dline就退掉」)
    lineColour: .6,                     // line amount left while the colour comes in (before they withdraw)
    head: num('tdHead', .70),           // the headline changes here
    clock0: num('tdClock', 8.25),       // (old top-down land only) the view from above starts at this lens place
    turnLead: num('tdTurnLead', .10),   // the lens starts turning this much before 渲染
    cloudRest: .35,
    cloudCurve: num('tdCloudCurve', 1.8),   // >1 = the clouds gather late (whole only for about a notch)
    cloudPart: .12,                     // the clouds part over this much after 黑白 begins
    river0: num('tdRiver0', .74), river1: num('tdRiver1', .92),   // the rivers' light comes on between these (with the colour)
    headFade: num('tdHeadFade', .06),   // the headline fades out / in over this much on either side of its change
                     // clouds left during 黑白
    push: .07,                          // the picture's own push-in under the clouds
    /* built-in look */
    gridDensity: 26, gridBright: .62, contour: 9, cloudAmount: 1, cloudSpeed: 1, monoContrast: 1.25,
    /* built-in render pass */
    gridKeep: .22, edge: .09, glow: .8
  };
  const VID = T.style === 'video';
  const REF = 3.8;
  const tau = () => S.u * REF;   // reference seconds; the real length is T.vDur
  /* the wipe as measured in the video: share of the screen covered against time (0 … .75 s), and the brush value that gives that share on this page */
  const table = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[ys.length - 1]; };
  const covAt = x => table([0, .14, .22, .30, .38, .46, .54, .62, .70, .75], [0, .10, .24, .35, .50, .55, .64, .77, .93, 1], x);
  const brushOf = c => (c <= 0 ? 0 : c >= 1 ? 1 : table([0, .35, .65, .95, 1], [.38, .51, .66, .83, .9], c));
  /* video style: what this file sets from the clock. Entry: x = seconds since the notch. Exit (S.exit): its own clock, everything scripted */
  function vs() {
    if (S.exit) {
      const x = (1 - S.u) * 3.4, want = x < T.xWipe0 - T.xJourney;   // the journey goes back under the whole view before the wipe, so the wipe never waits for it
      return { brush: brushOf(covAt(.75 * (1 - lin(T.xWipe0, T.xWipe1, x)))), turn: 1 - ss(T.xTurn0, T.xTurn1, x), colour: 1 - ss(T.xColour0, T.xColour1, x), river: 1 - ss(T.xRiver0, T.xRiver, x),
        lines: ss(T.xLines0, T.xLines, x), fog: mix(T.fogRest, 1, ss(T.xColour0, T.xColour1, x)), want, survey: x >= T.xColour1 ? 1 : 0,
        head: want ? 1 - ss(T.xHead0, T.xHead1, x) : 0, phase: x < T.xColour0 ? 'lines back' : x < T.xColour1 ? 'colour out' : x < T.xWipe0 ? 'turn back' : 'wipe back' };
    }
    const x = tau(), want = x >= T.wipeV;
    return { brush: brushOf(covAt(x / Math.max(.05, T.wipeV) * .75)), lines: 1 - ss(T.linesS, T.linesS + Math.max(.05, T.lineOutS), x),
      fog: mix(1, T.fogRest, ss(T.fogS, T.fogS + Math.max(.1, T.fogLen), x)), want,
      head: want ? ss(T.headIn, T.headIn + Math.max(.05, T.headInLen), x) : 1 - ss(0, .22, x), phase: x < T.wipeV ? 'wipe' : x < T.linesS ? 'colour' : 'lines out' };
  }
  const headT = () => T.head, headW = () => T.headFade;
  const S = { on: false, t: 0, tT: 0, u: 0, play: 0, dir: 0, phase: '', scene: 'canyon', frames: 0, ms: [], notes: [], look: 'built-in', reveal: 'built-in' };

  /* ------------------------------------------------------------ built-in look and render pass (plain stand-ins) */
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quadCam = new THREE.Camera();
  const VS = 'varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }';
  const NOISE = `
    float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
    float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s / .96875; }`;
  const full = (uniforms, fragmentShader) => {
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(tri, material); mesh.frustumCulled = false; const scene = new THREE.Scene(); scene.add(mesh);
    return { material, scene, uniforms };
  };
  function builtInLook() {
    const q = full({
      tSrc: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uA: { value: new THREE.Vector4() }, uB: { value: new THREE.Vector4() }, uC: { value: new THREE.Vector4() }
    }, `precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uRes; uniform vec4 uA, uB, uC;
      /* uA = sweep, cloud, mono, grid · uB = time, aerial, push, cloudAmount · uC = gridDensity, gridBright, contour, monoContrast */
      ${NOISE}
      float luma(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
      float line(float q, float w){ float d = .5 - abs(fract(q) - .5); return 1. - smoothstep(0., w, d); }
      void main(){
        float asp = uRes.x / uRes.y, aerial = uB.y;
        vec2 uv = (vUv - vec2(.5, .46)) / (1. + uB.z) + vec2(.5, .46);
        vec3 src = texture2D(tSrc, uv).rgb, c = src;
        vec2 px = 1. / uRes;
        float l = luma(src);
        float lb = (luma(texture2D(tSrc, uv + px * vec2(5., 0.)).rgb) + luma(texture2D(tSrc, uv - px * vec2(5., 0.)).rgb)
                  + luma(texture2D(tSrc, uv + px * vec2(0., 5.)).rgb) + luma(texture2D(tSrc, uv - px * vec2(0., 5.)).rgb) + l) * .2;
        /* the wash from the left: a soft, uneven front */
        float n = fbm(vec2(vUv.x * asp, vUv.y) * 2.2 + 3.7);
        float front = uA.x * 1.6 - .3;
        float m = smoothstep(front + .12, front - .12, vUv.x + (n - .5) * .35);
        /* grey relief */
        float g = clamp((lb * .35 + l * .65 - .5) * uC.w + .53, 0., 1.);
        vec3 grey = vec3(g) * vec3(.955, .975, 1.);
        c = mix(c, grey, uA.z * mix(.35 + .65 * m, 1., aerial));
        /* the survey lattice, draped: the picture's own light and dark lift the lines */
        float drape = (lb - .4) * mix(.05, .11, aerial);
        vec2 s = vec2((vUv.x - .5) * asp, vUv.y + drape);
        float depth = mix(1., 1.9 - 1.25 * s.y, .75);                       // rows gather towards the top: a ground seen from above
        vec2 gq = vec2(s.x * depth + .13 * s.y, s.y * depth * 1.25 + .1 * s.x) * uC.x * .5;
        vec2 w = fwidth(gq) * 1.15;
        float grid = max(line(gq.x, w.x), line(gq.y, w.y)) * clamp(1.6 - max(w.x, w.y) * 3.5, 0., 1.);
        float ct = lb * uC.z, cw = fwidth(ct) * 1.2;
        float contour = line(ct, cw) * clamp(1.3 - cw * 2.2, 0., 1.) * .55;
        float sky = mix(smoothstep(.93, .7, l) , 1., aerial);               // none on the bright sky of the canyon
        float lines = max(grid, contour) * uA.w * m * uC.y * sky * (1. - aerial);   // above, the land's own 3D lines are the lattice
        c += lines * mix(vec3(.82, .9, 1.), vec3(1.), .5);
        /* clouds from the left */
        float cl = uA.y;
        vec2 cp = vec2(vUv.x * asp, vUv.y) * 1.35 - vec2(uB.x * .035, uB.x * .006);
        float f = fbm(cp + .55 * vec2(fbm(cp * 1.7 + 4.), fbm(cp * 1.7 - 9.)));
        float th = mix(1.35, -.4, cl), bias = (.5 - vUv.x) * .7 * (1. - cl);
        float a = smoothstep(th, th + .34, f + bias) * uB.w;
        a = max(a, smoothstep(.9, 1., cl));
        vec3 cloud = mix(vec3(.74, .78, .83), vec3(.985, .99, 1.), smoothstep(.25, .8, f));
        c = mix(c, cloud, a * .97);
        gl_FragColor = vec4(c, 1.);
      }`);
    return {
      tune: T, rows: [],
      update(f) {
        const U = q.uniforms;
        U.tSrc.value = f.source; U.uRes.value.set(f.width, f.height);
        U.uA.value.set(f.sweep, f.cloud, f.mono, f.grid);
        U.uB.value.set(f.time * T.cloudSpeed, f.scene === 'aerial' ? 1 : 0, f.push, T.cloudAmount);
        U.uC.value.set(T.gridDensity, T.gridBright, T.contour, T.monoContrast);
        f.renderer.setRenderTarget(f.target); f.renderer.render(q.scene, quadCam);
      },
      warm() { return renderer.compileAsync ? renderer.compileAsync(q.scene, quadCam) : null; },
      resize() { }, dispose() { q.material.dispose(); }
    };
  }
  function builtInReveal() {
    const q = full({
      tSrc: { value: null }, tLook: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uA: { value: new THREE.Vector4() }, uB: { value: new THREE.Vector4() }
    }, `precision highp float; varying vec2 vUv; uniform sampler2D tSrc, tLook; uniform vec2 uRes; uniform vec4 uA, uB;
      /* uA = reveal, gridKeep, edge, glow · uB = time, grid */
      ${NOISE}
      void main(){
        float asp = uRes.x / uRes.y;
        vec3 src = texture2D(tSrc, vUv).rgb, look = texture2D(tLook, vUv).rgb;
        /* the colour spreads from where the rivers meet, along an uneven front, a thin bright line riding it */
        vec2 p = (vUv - vec2(.5, .44)) * vec2(asp, 1.);
        float d = length(p) / length(vec2(asp * .5, .56)) + (fbm(vUv * vec2(asp, 1.) * 3.1 + 1.3) - .5) * .32;
        float r = uA.x * 1.5 - .2, e = max(.01, uA.z);
        float m = smoothstep(r + e, r - e, d);
        float band = exp(-pow((d - r) / (e * .55), 2.)) * step(.002, uA.x) * (1. - smoothstep(.9, 1., uA.x));
        float grey = dot(src, vec3(.299, .587, .114));
        vec3 residual = max(look - vec3(grey), 0.);
        vec3 c = mix(look, src + residual * uA.y * uB.y, m);
        c += band * uA.w * vec3(.55, .82, 1.) * .55;
        gl_FragColor = vec4(c, 1.);
      }`);
    return {
      tune: T, rows: [],
      update(f) {
        const U = q.uniforms;
        U.tSrc.value = f.source; U.tLook.value = f.look; U.uRes.value.set(f.width, f.height);
        U.uA.value.set(f.reveal, T.gridKeep, T.edge, T.glow); U.uB.value.set(f.time, f.grid, 0, 0);
        f.renderer.setRenderTarget(f.target); f.renderer.render(q.scene, quadCam);
      },
      warm() { return renderer.compileAsync ? renderer.compileAsync(q.scene, quadCam) : null; },
      resize() { }, dispose() { q.material.dispose(); }
    };
  }

  const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
  const quality = () => { const r = +window.__FLOW2_QUALITY__?.rank; return r === 0 ? 'low' : r === 1 ? 'medium' : 'high'; };
  const init = { THREE, renderer, width: size.x, height: size.y, dpr: renderer.getPixelRatio(), lite: !!lite, quality: quality(), base };
  async function load(kind, fallback) {
    const flag = Q.get(kind === 'look' ? 'tdLook' : 'tdReveal'), stamp = MODULES[kind];
    if (flag !== '0' && stamp && (!VID || flag === '1')) {
      try {
        const mod = await import(base + 'td-' + kind + '.js?v=' + stamp);
        const made = await (kind === 'look' ? mod.createLook : mod.createReveal)(init);
        if (made && typeof made.update === 'function') { S[kind] = 'td-' + kind + '.js ' + stamp; return made; }
      } catch (error) { console.warn('rise td: ' + kind + ' left out, the built-in one draws', error); S.notes.push(kind + ': ' + (error?.message || error)); }
    }
    return fallback();
  }
  const [look, reveal] = await Promise.all([load('look', builtInLook), load('reveal', builtInReveal)]);
  window.__RISE_TD_LOOK__ ||= look; window.__RISE_TD_REVEAL__ ||= reveal;

  /* ------------------------------------------------------------ the timeline: every value from t */
  const f = { progress: 0, dir: 0, phase: 'A', sweep: 0, cloud: 0, mono: 0, grid: 0, lines: 0, reveal: 0, fade: 1, push: 0, scene: 'canyon', camera: null,
    renderer, source: null, look: null, target: null, time: 0, dt: 0, width: 1, height: 1, dpr: 1, reduced: false };
  function values(t) {
    const fade = 1 - ss(Math.min(.99, T.d + T.lineOut * .5), 1, t), aerial = t >= T.x;
    f.progress = t; f.fade = fade;
    f.phase = t < T.a ? 'A' : t < T.b ? 'X' : t < T.c ? 'B' : t < T.d ? 'C' : t < T.d + T.lineOut ? 'E' : 'D';
    f.sweep = ss(.02, T.a - .04, t);
    f.mono = aerial ? 1 : .75 * ss(.04, T.a, t) + .25 * ss(T.a - .04, T.x, t);
    f.cloud = (t < T.x ? Math.pow(ss(.08, T.a, t), Math.max(.3, T.cloudCurve)) : mix(1, T.cloudRest, ss(T.b, T.b + Math.max(.02, T.cloudPart), t)) * mix(1, .34, ss(T.c, T.d, t))) * fade;
    f.grid = f.lines = mix(1, T.lineColour, ss(T.c, T.d, t)) * (1 - ss(T.d, Math.min(.995, T.d + T.lineOut), t));   // zero once settled; back before 黑白 on the way up
    f.reveal = lin(T.c, T.d, t);
    f.push = aerial ? T.push * (1 - ss(T.x, T.c, t)) : T.push * ss(.1, T.x, t);
    f.scene = aerial ? 'aerial' : 'canyon';
    return f;
  }
  const clockAt = t => mix(T.clock0, (cut() && +cut().tune.to) || 8.96, ss(T.x, T.d, t));

  /* ------------------------------------------------------------ the view from above, drawn whole under our picture */
  let wrapped = false, raw = null;
  function wrapForest() {
    const A = forest(); if (!A || wrapped) return !!A;
    raw = A.override;
    Object.defineProperty(A, 'override', {
      configurable: true, enumerable: true,
      get() {
        if (!S.on) return raw;   // never anything of ours while the change is not playing (the old hidden pre-draw through this override showed the land: removed)
        const c = cut(), tune = c && c.tune || {};
        if (VID) {
          const there = atAerial(), b = S.exit && there ? 1 : vs().brush;   // going back, the wipe waits for the canyon to be under it
          if (b >= 1 && there) return null;   // the view is whole and the journey is there: the canyon under it is not drawn
          return { on: 1, td: 1, clock: +tune.to || 8.96, brush: b, dir: 1, reduce: 0, hold: true,
            look: [(tune.brushAngle || 16) * Math.PI / 180, tune.brushSoft || 1.6, tune.brushBristle || .45, tune.brushSmear || .55] };
        }
        if (S.t < T.x - .14) return null;
        return { on: 1, warm: S.t < T.x ? 1 : 0, clock: clockAt(S.t), brush: S.t < T.x ? 0 : 1, dir: 1, reduce: 1, hold: true,
          look: [(tune.brushAngle || 16) * Math.PI / 180, tune.brushSoft || 1.6, tune.brushBristle || .45, tune.brushSmear || .55] };
      },
      set(v) { raw = v; }
    });
    wrapped = true; wrapStudio(); return true;
  }
  /* the studio land's own entrance (the lens turning into place, the land filling in) follows t instead of its clock; its 3D lines follow f.lines */
  let fogBase = NaN, fogSet = NaN;
  let studioUpdate = null, lineBase = NaN, fed = 0, prewarm = 0, rawRoute = 0, primed = false; const FEED = 10.5;
  let nClock = 0;   // the studio view's own entrance clock, seconds (entry)
  /* the colour in the entry: the view's own growth curve, read on a clock fitted to the video (its first green at colourOn, whole at colourFull);
     it joins the view's real clock again well before we let go, so nothing jumps at the end */
  function entryColour() {
    const n = nClock, n0 = Math.max(0, T.colourOn - T.studioAt), n1 = Math.max(n0 + .2, T.colourFull - T.studioAt);
    const a = (1.38 - .68) / (n1 - n0), fit = .68 + (n - n0) * a, w = ss(n1 + .2, n1 + 1.5, n), nc = Math.max(0, fit * (1 - w) + n * w);
    return 1 - Math.pow(1 - clamp01((nc - .15) / 3.95), 2.45);
  }
  const riverAt = t => (VID ? (S.exit ? vs().river : ss(T.riverOn, T.riverFull, tau())) : ss(T.river0, T.river1, t));
  const routeTarget = V => clamp01(+V.curtain?.config?.progress || 0) * riverAt(S.t);
  function river(V) {   /* the rivers' light follows t (its own clock has been run to its end unseen) */
    try {
      const p = routeTarget(V), C = V.curtain, U = V.studio?.uniforms;
      if (C?.uniforms?.uProgress) C.uniforms.uProgress.value = p;
      if (U?.uCurtainLogo) U.uCurtainLogo.value.w = p;
      if (U?.uCurtainGlow) U.uCurtainGlow.value = C?.config?.enabled ? (+C.config.brightness || 0) * ss(0, 1, p) : 0;
    } catch (error) { }
  }
  const studio = () => forest()?.studio;
  const arrivalAt = t => lin(T.c - T.turnLead, T.d, t);
  function wrapStudio() {
    const V = studio(); if (!V || studioUpdate) return;
    studioUpdate = V.update;
    V.update = function (dt, override, tune) {
      if (!S.on) {
        return studioUpdate.call(this, dt, override, tune);
      }
      const fogNow = v => { const F = this.studio.mistGroup?.material?.uniforms?.uLeftFog; if (F) { if (!Number.isFinite(fogBase) || Math.abs(F.value.x - fogSet) > 1e-6) fogBase = F.value.x; fogSet = F.value.x = fogBase * v.fog; } };
      if (VID && !S.exit) {
        /* the entry: the view's OWN entrance on its own clocks (lens, colour, survey drawing, river light), as in the video. Only the speed dial and the lead are ours */
        const k = REF / Math.max(.3, T.vDur);
        const run = tau() >= T.studioAt;
        const nb = () => { const l = clamp01(tau() / 1.15); return .18 * l + .82 * l * l * (3 - 2 * l); };   // lift-cut's own stroke value at this moment
        if (run) nClock += dt * k;
        const out = studioUpdate.call(this, run ? dt * k * Math.max(.2, T.lensRate) : 0, tau() < T.wipeV ? { on: 1, dir: 1, reduce: 0, brush: Math.min(.5, nb()) } : null, tune);   // brush < .55: the rivers' light, curtains, beams and ring stay off until the wipe is done, then come on their own clock
        try { fogNow(vs()); this.state.arrival = entryColour(); river(this); } catch (error) { }
        return out;
      }
      if (!VID && S.t >= T.x) { const still = Object.assign({}, tune, { drift: 0 }); for (let i = 0; i < 4 && fed < FEED; i++) { fed += .1; studioUpdate.call(this, .1, null, still); } }
      const out = studioUpdate.call(this, dt, { on: 1, hold: true, reduce: 0, dir: 1, brush: (VID ? vs().turn : arrivalAt(S.t)) / .29, warm: !VID && S.t < T.x ? 1 : 0 }, tune);
      if (VID) try {   /* the colour on its own, slower clock; the survey drawing of the land only while the wipe crosses, as in the original */
        const v = vs();
        this.state.arrival = v.colour; this.studio.uniforms.uEntrySurvey.value = v.survey;   // uArrival itself reads the slow clock (below): shaders and the labels follow it
        fogNow(v);
      } catch (error) { }
      if (S.exit || !VID) river(this);
      return out;
    };
    if (VID) try {   /* the colour's uniform: one object shared by the land, the clouds, the stones and the labels */
      const UA = V.studio.uniforms.uArrival; let rawA = UA.value;
      Object.defineProperty(UA, 'value', { configurable: true, enumerable: true, get: () => (S.on ? (S.exit ? vs().colour : entryColour()) : rawA), set: v => { rawA = v; } });
    } catch (error) { S.notes.push('uArrival: ' + (error?.message || error)); }
    try {
      rawRoute = +V.state.routeProgress || 0;
      Object.defineProperty(V.state, 'routeProgress', { configurable: true, enumerable: true, get: () => (S.on ? routeTarget(V) : rawRoute), set: v => { rawRoute = v; } });
    } catch (error) { }
  }
  function setLines(k) {
    const L = studio()?.lines3d; if (!L || !L.uniforms?.uAlpha) return;
    if (!Number.isFinite(lineBase)) lineBase = Math.max(0, Math.min(2, +L.config.opacity || 0));
    L.uniforms.uAlpha.value = lineBase * k; L.group.visible = !!L.config.enabled && k > .002;
    S.lines = +k.toFixed(3);
  }
  function settleStudio(forward) {
    const V = studio(); if (!V || !studioUpdate) return;
    try {
      if (!forward) { V.leave(); fed = 0; setLines(1); const F = V.studio.mistGroup?.material?.uniforms?.uLeftFog; if (F && Number.isFinite(fogBase)) { F.value.x = fogBase; fogSet = NaN; } }
    } catch (error) { S.notes.push('studio: ' + (error?.message || error)); }
  }

  /* ------------------------------------------------------------ the pass: last of the page's chain while the change is on */
  let lookRT = null;
  function ensureRT(w, h, dpr) {
    if (lookRT && lookRT.width === w && lookRT.height === h) return;
    lookRT?.dispose();
    lookRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    try { look.resize?.(w, h, dpr); reveal.resize?.(w, h, dpr); renderer.initRenderTarget?.(lookRT); } catch (error) { }
  }
  const pass = {
    isPass: true, enabled: false, needsSwap: true, clear: false, renderToScreen: false,
    setSize() { }, dispose() { },
    render(r, write, read) {
      const t0 = performance.now();
      const target = this.renderToScreen ? null : write, before = r.getRenderTarget(), ac = r.autoClear;
      r.autoClear = false;
      try {
        const w = read.width, h = read.height;
        f.source = read.texture; f.width = w; f.height = h; f.dpr = r.getPixelRatio();
        f.camera = f.scene === 'aerial' ? (forest()?.scene?.camera || engine.canyon.camera) : engine.canyon.camera;
        if (f.reveal > .0005) {
          ensureRT(w, h, f.dpr);
          f.look = null; f.target = lookRT; look.update(f);
          f.look = lookRT.texture; f.target = target; reveal.update(f);
        } else { f.look = null; f.target = target; look.update(f); }
      } catch (error) {
        pass.enabled = false; S.notes.push('draw: ' + (error?.message || error)); console.warn('rise td: switched off', error); stop();
      } finally { r.autoClear = ac; r.setRenderTarget(before); }
      S.frames++; S.ms.push(+(performance.now() - t0).toFixed(2)); if (S.ms.length > 240) S.ms.shift();
    }
  };
  composer.addPass(pass);
  const seat = () => { const P = composer.passes, i = P.indexOf(pass); if (i !== P.length - 1) { if (i >= 0) P.splice(i, 1); P.push(pass); } };

  const style = document.createElement('style');
  style.textContent = 'html[data-rise-td-scene="aerial"] :is(.alp-labels, #flow2-canyon-atlas, .f2u-lock) { opacity: 0 !important; transition: opacity .3s ease !important; pointer-events: none !important; }';
  document.head.append(style);

  /* ------------------------------------------------------------ the clock: the wheel moves tT, the picture follows; the journey is moved at the headline's place */
  let raf = 0, last = 0, clockSec = 0;
  const J = () => getJ();
  const cutIdle = () => { const c = cut(); return !c || c.state.phase === 'idle'; };
  const atAerial = () => { const j = J(); return !!j && +j.progress > P1() + .3; };
  let copyEl = null, brushTime = NaN, askAt = -1e9, askRaf = 0;
  function headline(op) {
    copyEl ||= document.querySelector('.finnovation-ui > .fi-copy'); if (!copyEl) return;
    if (op == null) { copyEl.style.removeProperty('opacity'); copyEl.style.removeProperty('transition'); return; }
    copyEl.style.setProperty('transition', 'none', 'important'); copyEl.style.setProperty('opacity', op.toFixed(3), 'important');
  }
  function start(dir) {
    if (S.on || !wrapForest()) return false;
    prewarm = 0; primed = false; nClock = 0; S.startedAt = performance.now();
    if (dir > 0) { const j = J(); if (j) self(() => { j.target = Math.max(+j.target, P1() - .002); }); }   // the canyon keeps gliding a little under the wipe: no dead stop
    { const c = cut(); if (c && Number.isFinite(+c.tune.brushTime) && !Number.isFinite(brushTime)) { brushTime = +c.tune.brushTime; c.tune.brushTime = .06; } }   // the journey's own move is hidden under our picture: make it short
    S.on = true; S.t = S.tT = S.u = dir > 0 ? 0 : 1; S.dir = dir; last = 0;
    S.play = T.mode === 'cut' && (dir > 0 || T.back !== 'scrub') ? dir : 0;
    S.exit = VID && S.play < 0;   // ±1 = it plays by itself to its end
    if (!VID) { values(S.t); seat(); ensureRT(composer.readBuffer.width, composer.readBuffer.height, renderer.getPixelRatio()); pass.enabled = true; }
    html.setAttribute('data-rise-td', dir > 0 ? 'in' : 'out');
    if (!raf) raf = requestAnimationFrame(tick);
    return true;
  }
  function stop(end) {
    S.play = 0; S.exit = false; S.endedAt = performance.now();
    if (end) { settleStudio(end > 0); if (end > 0) setLines(0); }
    S.on = false; pass.enabled = false; S.dir = 0; headline(null);
    { const c = cut(); if (c && Number.isFinite(brushTime)) { c.tune.brushTime = brushTime; brushTime = NaN; } }
    html.removeAttribute('data-rise-td'); html.removeAttribute('data-rise-td-scene');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  function tick(now) {
    raf = 0; if (!S.on) return;
    const dt = last ? Math.min(.1, Math.max(.001, (now - last) / 1000)) : 1 / 60; last = now;
    const j = J(); if (!j) { stop(); return; }
    const reducedNow = !!reduced.matches;
    if (!reducedNow) clockSec += dt;
    const before = S.t;
    let t;
    if (S.play) {
      S.u = clamp01(S.u + S.play * dt / Math.max(.5, S.play > 0 ? (VID ? T.vDur : T.dur) : T.durBack)); S.tT = S.play > 0 ? 1 : 0;
      t = VID ? S.u : mix(S.u, S.u * S.u * (3 - 2 * S.u), clamp01(T.ease));
    } else {
      t = S.t + (S.tT - S.t) * (1 - Math.exp(-dt / Math.max(.02, T.follow / 3)));
      if (Math.abs(S.tT - t) < .0004) t = S.tT;
      if (VID) S.u = t;
    }
    /* the journey: in the canyon below the headline's place, at the view's rest above it (lift-cut's own move, its picture is ours meanwhile) */
    const aerialNow = atAerial(), idle = cutIdle();
    if (!VID && aerialNow && t < T.b) t = Math.max(t, Math.min(before, T.b));        // the clouds stay closed until the canyon is back under them
    if (idle) {
      const want = VID ? vs().want : t >= headT();
      if (want && !aerialNow) self(() => { j.target = P1() + .08; });
      else if (!want && aerialNow) self(() => { j.target = H(); });
    }
    S.t = t; S.dir = t > before ? 1 : t < before ? -1 : 0;
    const v = VID ? vs() : null;
    if (VID) { f.progress = t; f.lines = f.grid = v.lines; f.scene = v.brush > .5 ? 'aerial' : 'canyon'; f.phase = v.phase; }
    else values(t);
    f.dir = S.dir; f.time = reducedNow ? 0 : clockSec; f.dt = dt; f.reduced = reducedNow;
    S.phase = f.phase; S.scene = f.scene; if (VID || !look.setLines) setLines(f.lines);   // td-look.js withdraws the lines itself (one of the two, not both)
    if (VID) headline(v.want === aerialNow && idle ? v.head : 0);
    else headline((t >= headT()) === aerialNow && idle ? ss(0, Math.max(.005, headW()), Math.abs(t - headT())) : 0);
    if (html.getAttribute('data-rise-td-scene') !== f.scene) html.setAttribute('data-rise-td-scene', f.scene);
    window.__FLOW2_IDLE_HOLD__ = true;
    if (!VID) seat();
    if (idle && S.tT >= 1 && t >= 1 && aerialNow && (VID || fed >= FEED || !studioUpdate)) { stop(1); return; }
    if (idle && S.tT <= 0 && t <= 0 && !aerialNow) { stop(-1); return; }
    raf = requestAnimationFrame(tick);
  }

  const api = {
    tune: T, state: S, ready: true, look, reveal,
    get on() { return S.on; },
    cooling() { return !S.on && performance.now() - (S.endedAt || -1e9) < 600; },   // the same gesture's last wheel ticks do not scroll on
    /* at rest on the view from above (WHERE VALUE CONNECTS), from where a turn up plays the change back */
    atRest() { const j = J(); return !!j && cutIdle() && Math.abs(+j.progress - P2()) < .02 && +j.target <= P2() + .02 && +j.target > P2() - 1; },
    wheel(d) {
      if (!S.on) { if (!start(d > 0 ? 1 : -1)) return false; if (d < 0) { const j = J(); self(() => { j.target = P2(); }); } }
      if (!S.play) S.tT = clamp01(S.tT + d / (Math.max(2, T.notches) * 100));   // while it plays by itself, input is swallowed
      if (!raf) raf = requestAnimationFrame(tick);
      return true;
    },
    /* the visitor scrolled past the canyon's end (rise.js held the journey there): start as soon as the lens is close, while it still moves */
    ask() {
      askAt = performance.now(); if (askRaf || S.on || !(T.early > 0) || T.mode !== 'cut') return;
      const watch = () => {
        askRaf = 0; const j = J();
        if (S.on || !j || performance.now() - askAt > T.askWindow * 1000) return;
        if ((!canStart || canStart()) && cutIdle() && +j.progress >= H() - T.early && +j.progress <= H() + .03) { api.wheel(100); return; }
        askRaf = requestAnimationFrame(watch);
      };
      askRaf = requestAnimationFrame(watch);
    },
    seek(t) { if (!S.on && !start(1)) return false; S.play = 0; S.tT = clamp01(+t); if (!raf) raf = requestAnimationFrame(tick); return true; },
    stats() { const a = S.ms.slice().sort((x, y) => x - y); return { style: T.style, sec: +tau().toFixed(2), brush: (() => { const o = forest()?.override; return o ? +(+o.brush).toFixed(3) : null; })(), exit: !!S.exit, on: S.on, t: +S.t.toFixed(4), tT: +S.tT.toFixed(4), phase: S.phase, scene: S.scene, frames: S.frames, passMsMedian: a[a.length >> 1], passMsWorst: a[a.length - 1], look: S.look, reveal: S.reveal, prewarmed: S.prewarmed || 0, fed: +fed.toFixed(1), notes: S.notes }; },
    dispose() { stop(); const P = composer.passes, i = P.indexOf(pass); if (i >= 0) P.splice(i, 1); look.dispose?.(); reveal.dispose?.(); lookRT?.dispose(); style.remove(); }
  };
  window.__RISE_TD__ = api;

  const rows = [
    ['— 影片版（預設）：一格滾輪播完；節奏＝客戶影片 —'], ['進場總長（秒；3.8＝影片原速，所有時間等比例）', 'vDur', 1, 12, .1], ['鏡頭開始轉（秒）', 'studioAt', 0, 1.5, .01], ['鏡頭轉速（倍）', 'lensRate', .5, 4, .05], ['退場總長（秒；3.4＝影片倒放原速，預設 2＝約 60 %）', 'durBack', 1, 12, .1],
    ['筆刷刷過（秒）', 'wipeV', .3, 2, .05], ['提早銜接（旅程單位；0＝停住後才轉）', 'early', 0, .4, .01], ['3D 線開始退場（秒）', 'linesS', .5, 3.3, .05], ['3D 線退場長度（秒）', 'lineOutS', .1, 2, .05],
    ['新標題進場（秒）', 'headIn', .8, 3, .05], ['上色：開始（秒）', 'colourOn', .4, 2, .01], ['上色：完成（秒）', 'colourFull', 1, 3.5, .01], ['河光・光幕・光柱：開始（秒）', 'riverOn', .8, 3, .05], ['河光・光幕・光柱：完成（秒）', 'riverFull', 1.5, 3.8, .05], ['左下雲霧：定位後保留量（1＝不變）', 'fogRest', 0, 1, .01], ['左下雲霧開始變薄（秒）', 'fogS', 0, 3, .1],
    ['— 退場（以 3.4 秒為準的秒數）—'], ['3D 線回來：結束', 'xLines', .2, 2, .05], ['河光熄滅：結束', 'xRiver', .5, 3, .05], ['顏色褪去：開始', 'xColour0', .2, 3, .05], ['顏色褪去：結束', 'xColour1', .5, 3.3, .05],
    ['鏡頭轉回：結束', 'xTurn1', 1, 3.4, .05], ['筆刷退場：開始', 'xWipe0', 1, 3.3, .05], ['筆刷退場：結束', 'xWipe1', 1.5, 3.4, .05], ['旅程提早回山谷（秒）', 'xJourney', .2, 1.5, .05],
    ['— 分鏡版（?tdStyle=storyboard）—'], ['進場時間（秒）', 'dur', 2, 12, .1], ['起收柔和度', 'ease', 0, 1, .01],
    ['（?tdMode=scrub）整段長度（滾輪格數）', 'notches', 4, 20, 1], ['（?tdMode=scrub）畫面跟隨（秒）', 'follow', .1, 1, .01],
    ['— 階段（0…1）—'], ['轉場結束（雲蓋滿）', 'a', .2, .36, .01], ['黑白開始（雲散開）', 'b', .38, .55, .01], ['渲染開始', 'c', .5, .8, .01], ['彩色完成・鏡頭定位', 'd', .75, .95, .01], ['定位後 3D 線退場長度', 'lineOut', .01, .12, .005], ['上色時線條保留量', 'lineColour', 0, 1, .01], ['標題更換', 'head', .45, .95, .01], ['標題淡出淡入寬度', 'headFade', .01, .2, .005],
    ['— 雲與河光 —'], ['雲聚集曲線（大＝晚蓋滿）', 'cloudCurve', .5, 4, .05], ['雲散開長度', 'cloudPart', .02, .3, .01], ['河光開始', 'river0', .5, .95, .01], ['河光完成', 'river1', .6, 1, .01],
    ['— 鏡頭 —'], ['鏡頭提早開始轉', 'turnLead', 0, .25, .01], ['雲下推進', 'push', 0, .2, .005], ['黑白階段雲量', 'cloudRest', 0, 1, .01]
  ];
  const own = (m, title) => { for (const r of m.rows || []) rows.push(Array.isArray(r) ? r : [r.label, r.key, r.min, r.max, r.step]); if (m.tune && m.tune !== T) for (const r of m.rows || []) { const k = Array.isArray(r) ? r[1] : r.key; if (k && !(k in T)) Object.defineProperty(T, k, { enumerable: true, get: () => m.tune[k], set: v => { m.tune[k] = v; } }); } };
  if (look.tune === T) rows.push(['— 網格・雲・黑白（內建）—'], ['網格密度', 'gridDensity', 8, 60, 1], ['網格亮度', 'gridBright', 0, 1.5, .01], ['等高線', 'contour', 0, 30, .5], ['雲量', 'cloudAmount', 0, 1, .01], ['雲速', 'cloudSpeed', 0, 4, .05], ['黑白對比', 'monoContrast', .6, 2, .01]);
  else { rows.push(['— 網格・雲・黑白 —']); own(look); }
  if (reveal.tune === T) rows.push(['— 渲染（內建）—'], ['彩色後保留網格', 'gridKeep', 0, 1, .01], ['前緣柔度', 'edge', .01, .4, .005], ['前緣亮線', 'glow', 0, 2, .01]);
  else { rows.push(['— 渲染 —']); own(reveal); }
  try { window.__FLOW2_PANEL__?.add({ id: 'rise-td', title: '俯瞰轉場', key: 'j', tune: T, rows, onChange: () => { if (S.on && !raf) raf = requestAnimationFrame(tick); } }); } catch (error) { }

  try {
    await Promise.all([look.warm?.(), reveal.warm?.()]);
    const RW = composer.readBuffer.width, RH = composer.readBuffer.height; ensureRT(RW, RH, renderer.getPixelRatio());
    const tiny = new THREE.WebGLRenderTarget(RW, RH, { depthBuffer: false }), tiny2 = new THREE.WebGLRenderTarget(RW, RH, { depthBuffer: false });
    const before = renderer.getRenderTarget(), ac = renderer.autoClear; renderer.autoClear = false;
    try {
      for (const t of [.2, .5, .8]) {
        values(t); f.source = tiny2.texture; f.width = RW; f.height = RH; f.camera = engine.canyon.camera; f.look = null; f.target = tiny; look.update(f);
        f.look = tiny.texture; f.target = tiny2; f.source = tiny.texture; reveal.update(f);
      }
    } finally { renderer.autoClear = ac; renderer.setRenderTarget(before); tiny.dispose(); tiny2.dispose(); values(0); }
  } catch (error) { S.notes.push('warm: ' + (error?.message || error)); }
  /* Warm-up, strictly off screen: ONE draw of the land into a small render target of our own (never the composer, never the canvas, no override),
     the renderer's state put back. Off by default: the view's own start-up already does the same; ?tdPrewarm=1 adds this one. */
  if (Q.get('tdPrewarm') === '1') (function arm(n) {
    const A = forest(), F = A?.scene;
    if (!F?.scene || !F?.camera || !A.state?.ready) { if (n < 150) setTimeout(() => arm(n + 1), 400); return; }
    if (S.on) return;
    const tiny = new THREE.WebGLRenderTarget(64, 64, { depthBuffer: true }), before = renderer.getRenderTarget(), tone = renderer.toneMapping, shadow = renderer.shadowMap.autoUpdate, ac = renderer.autoClear;
    try { renderer.toneMapping = THREE.NoToneMapping; renderer.shadowMap.autoUpdate = false; renderer.autoClear = true; renderer.setRenderTarget(tiny); renderer.render(F.scene, F.camera); S.prewarmed = 1; }
    catch (error) { S.notes.push('prewarm: ' + (error?.message || error)); }
    finally { renderer.toneMapping = tone; renderer.shadowMap.autoUpdate = shadow; renderer.autoClear = ac; renderer.setRenderTarget(before); tiny.dispose(); }
  })(0);
  return api;
}
