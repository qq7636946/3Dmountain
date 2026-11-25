/* Flow2 valley (2026-11-11): the canyon drawn with more of the real thing. For index1-5-flow2.html only.
   Client: 「整體的情境場景 … 細節不夠好尤其是山谷不夠真實 所有細節、質感起碼要現在的2.3倍以上」.
   Nothing is added to the scene and nothing about its flight, timing or parts changes: what is there is drawn truer.

   1. THE RIVER IS WATER. The canyon's river was the opening sea's liquid metal: it mirrored a studio that is not there and
      nothing of the canyon it runs through, so two black walls stood over a pale sheet. Now:
      - it mirrors the canyon. The scene is drawn once more each frame, upside down about the water's level (walls, far
        range, sky; at a third of the window's size, no water, no effects), and the river shows that picture where it looks along the surface
        (Fresnel: almost all of it far off, less close under the lens, where one looks down into the water instead);
      - it has a surface: four trains of fine ripples that bend the picture in it, stronger where a slow wind ruffles the
        water and nearly gone where it lies calm, and never finer than a pixel (they fade out with distance instead of
        shimmering);
      - it has depth: dark green-blue where it is deep, paler over the shallows by the banks (the bed's depth is already in
        the river's mesh);
      - it stands in the same air as the walls (the scene's own fog, by distance).
      The page's own shore (foam lace, shallows) is drawn on top as before; the aerial chapters keep the page's pale rivers.
   2. COST AND RETREAT. The mirror is one more drawing of the terrain at an eighth of the window's pixels, only while the camera
      flies low over the river. It is not made on phones or on integrated or software GPUs. It halves its size when the
      engine has lowered its own resolution or when frames have run late for two seconds; two more seconds and it goes, eased
      out over a second: the river is the page's own metal again. No new shader programs for the terrain: the same ones draw the mirror.

   How it is hooked: flow2-canyon-light.js is called by main.js when the canyon has been built (before any of it is compiled);
   this file wraps that call. ?valley=0 leaves all of it out; window.__FLOW2_VALLEY__.tune holds the dials, .state says what
   is running and why. */
(() => {
  const q = new URLSearchParams(location.search);
  if (q.get('valley') === '0') return;
  const num = (key, fallback) => { const v = parseFloat(q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    water: num('valleyWater', 1),     // 0 = the page's own metal river, 1 = water
    mirror: .9,                       // how much of the mirrored canyon the water shows where it mirrors at all
    floor: .06,                       // and the least it shows even straight down (a little sky always lies on water)
    bend: .22,                        // how far the surface bends the picture in it
    ripple: 1.35,                     // fine ripples (their slope, × this)
    swell: 0,                         // the long slow swell (three folds 7 to 20 units long): the opening sea's lazy silk, 0 = none
    clarity: .4,                      // how quickly the water darkens with depth
    deep: [.05, .125, .18],           // deep water (linear light): the glacier's blue-green, in the page's own ice blue
    shallow: [.17, .31, .39],         // over the shallows
    size: num('valleySize', .35),     // the mirror's size against the window's. Compared at .5, .35 and .25: the ripples bend the picture more than the size softens it, so .35 (half the pixels of .5) cannot be told from .5
    low: 34, high: 150                // the camera's height over the water: all of it under LOW, none over HIGH (the aerial chapters)
  };
  /* 3. THE WALLS READ AS ROCK. They stood as near-black slabs with blue-white patches: the sun was cool white, and the shade had
     almost no light of its own. The sun is a little warm now and the shade is filled from the sky and from the water, so a
     lit face is warm stone, a shaded one cool stone, and the strata and joints can be seen in both. More stain on the rock,
     more moss and grass where the canyon holds them. Values only (the scene's own dials), eased out before the camera rises
     into the aerial chapters, which keep the page's own light. */
  const LIGHT = { ambient: .95, fillShare: 1.25 };
  const LIGHT_COLOURS = { sunColor: '#f6e9d6', shadowColor: '#86a0bb', groundColor: '#6f8ea3' };
  const ROCK = { rockStain: 1.3, canyonGrass: 2, riverMoss: 1.6, ledgeGrass: 1.5, valleyShadow: .9 };
  const CANYON_LIGHT = { rimStrength: .45, shadowStrength: 1.25 };   // two of flow2-canyon-light.js's own dials, set there
  const MIRROR_LAYER = 9;
  const WEAK = /swiftshader|llvmpipe|softpipe|basic render|mali|adreno|powervr|videocore|apple a\d|\bintel\b(?![^,]*\b(arc|iris\(r\) xe|iris xe)\b)/i;
  const state = { water: 'not built yet', mirror: 'not built yet', size: 0, frames: 0, ms: 0 };
  const PARS = `uniform sampler2D uF2Mirror;uniform mat4 uF2MirrorMatrix;uniform vec4 uF2Water,uF2Fog;uniform vec3 uF2Deep,uF2Shallow,uF2Tone;\n`;
  const ANCHOR = 'col=mix(col,mountainWater,uJourneyNight);';
  const GLSL = `
      /* flow2 valley (flow2-valley.js): in the canyon the river is water */
      if(uF2Water.x>.001&&uRiverSurface>.5){
        /* how much of the world one pixel covers here: anything finer is not drawn, it would only shimmer */
        float f2px=fwidth(vWorld.x)+fwidth(vWorld.z)+1e-4;
        vec2 f2q=vWorld.xz-uSeaCurrent*uSeaTime;
        /* a slow wind: patches where the surface is ruffled, patches where it lies calm */
        float f2wind=.30+.70*smoothstep(.34,.66,seaNoise(f2q*.021+vec2(uSeaTime*.013,0.))*.6+seaNoise(f2q*.057-vec2(0.,uSeaTime*.021))*.4);
        /* fine ripples: four short trains crossing one another, each gone before it is finer than a pixel */
        vec2 f2r=vec2(0.),f2d;float f2k;
        f2d=vec2(.86,.51);f2k=2.3;f2r+=f2d*.050*(1.-smoothstep(.10,.50,f2px*f2k))*cos(dot(f2q,f2d)*f2k-2.1*uSeaTime);
        f2d=vec2(-.42,.91);f2k=3.7;f2r+=f2d*.042*(1.-smoothstep(.10,.50,f2px*f2k))*cos(dot(f2q,f2d)*f2k+2.9*uSeaTime);
        f2d=vec2(.97,-.24);f2k=6.1;f2r+=f2d*.034*(1.-smoothstep(.10,.50,f2px*f2k))*cos(dot(f2q,f2d)*f2k-3.8*uSeaTime);
        f2d=vec2(.31,.95);f2k=9.4;f2r+=f2d*.026*(1.-smoothstep(.10,.50,f2px*f2k))*cos(dot(f2q,f2d)*f2k+5.1*uSeaTime);
        /* the long swell: three slow folds, the lazy silk of the opening sea, so the picture in the water sways in broad curves
           and the surface shows wide soft bands instead of only fine wrinkles. Not gated by the wind: a swell runs through calm water too. */
        vec2 f2s=vec2(0.);
        if(uF2Tone.z>.001){
          f2d=vec2(.26,.966);f2k=.31;f2s+=f2d*.034*(1.-smoothstep(.10,.50,f2px*f2k))*cos(dot(f2q,f2d)*f2k-.47*uSeaTime);
          f2d=vec2(-.50,.866);f2k=.53;f2s+=f2d*.027*(1.-smoothstep(.10,.50,f2px*f2k))*cos(dot(f2q,f2d)*f2k+.66*uSeaTime);
          f2d=vec2(.80,.60);f2k=.87;f2s+=f2d*.020*(1.-smoothstep(.10,.50,f2px*f2k))*cos(dot(f2q,f2d)*f2k-.83*uSeaTime);
        }
        vec3 f2n=nrm;f2n.xz-=f2r*uF2Water.z*f2wind+f2s*uF2Tone.z;f2n=normalize(f2n);
        float f2F=.02+.98*pow(1.-clamp(dot(f2n,V),0.,1.),5.);
        /* the canyon in the water: the mirrored picture, bent by the surface */
        vec4 f2m=uF2MirrorMatrix*vec4(vWorld,1.);
        vec3 f2vn=mat3(viewMatrix)*(f2n-vec3(0.,1.,0.));
        vec2 f2uv=f2m.xy/max(f2m.w,1e-4)+vec2(f2vn.x,-f2vn.z)*uF2Water.y;
        /* ripples finer than a pixel are not drawn, but they are still there: far off they pull the picture out along the line of sight */
        vec2 f2sm=vec2(0.,.03*smoothstep(.08,.9,f2px*2.3)*uF2Water.z*f2wind);
        vec3 f2R=(texture2D(uF2Mirror,clamp(f2uv,vec2(.002),vec2(.998))).rgb*2.+texture2D(uF2Mirror,clamp(f2uv+f2sm,vec2(.002),vec2(.998))).rgb+texture2D(uF2Mirror,clamp(f2uv-f2sm*.6,vec2(.002),vec2(.998))).rgb)*.25;
        /* the sun's own disc is not left in the picture as one hard white dot: its light on the water is the glitter the river
           already has (flow2-canyon-light.js), so the mirror is held to a bright sky */
        f2R=min(f2R,uF2Fog.rgb*2.2+.15);
        /* what is seen down into it: dark where it is deep, paler over the shallows by the banks */
        vec3 f2body=mix(uF2Shallow,uF2Deep,1.-exp(-max(-vShore.x,0.)*uF2Tone.x));
        vec3 f2w=mix(f2body,f2R,clamp(f2F*uF2Water.w+uF2Tone.y,0.,1.));
        /* the air between it and the lens: the valley's own */
        f2w=mix(f2w,uF2Fog.rgb,1.-exp(-pow(uF2Fog.a*vDist,2.)));
        col=mix(col,f2w,uF2Water.x*(1.-uJourneyNight));
      }
`;

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hex = s => { const m = /^#?([0-9a-f]{6})$/i.exec(String(s || '')); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  const mixHex = (a, b, t) => { const p = hex(a), q2 = hex(b); return p && q2 ? '#' + p.map((v, i) => Math.round(v + (q2[i] - v) * t).toString(16).padStart(2, '0')).join('') : (t > .5 ? b : a); };
  /* 4. ONE WORLD WITH THE OPENING (2026-11-11, later the same day). Built to be real, the valley had left the opening's palette:
     the opening is a pale periwinkle (hue 212, saturation .3 to .5, hardly a dark in it) over a sea of long slow folds; the
     valley came out grey (hue 203, saturation under .2) under a darker sky, its water a flat sheet of fine wrinkles.
     「這個海浪跟hero的海岸還有整體的色調都不一樣」, and the answer chosen was to meet halfway. ONE dial, the tone, carries the
     valley from as it was built this morning (0) to wholly in the opening's palette (1); the page stands at TONE.
     What the tone moves: the water's own colour toward the opening sea's blue, and a little less of the dark walls in it;
     fewer fine wrinkles and the long swell instead; the sky, the haze and the fog toward the opening's periwinkle, with a
     softer sun; a cooler sun on the rock and more light in its shade. What it does not move: the mirror itself, the depth,
     the shore, the rock's own surface. ?valleyTone=0…1; live: __FLOW2_VALLEY__.tone = .5 */
  const TONE = .7;
  const REAL = { water: { mirror: T.mirror, floor: T.floor, ripple: T.ripple, swell: T.swell, clarity: T.clarity, deep: T.deep, shallow: T.shallow }, light: { ...LIGHT }, colours: { ...LIGHT_COLOURS }, rock: { valleyShadow: ROCK.valleyShadow } };
  const HERO = {
    water: { mirror: .55, floor: .16, ripple: .55, swell: 1.4, clarity: .3, deep: [.085, .18, .43], shallow: [.27, .42, .72] },
    light: { ambient: 1.45, fillShare: 1.45 },
    colours: { sunColor: '#eef1f6', shadowColor: '#8fa8d6', groundColor: '#7c98c4' },
    rock: { valleyShadow: .6 }
  };
  /* the page's own sky and air, moved by the tone's share only (at 0 they are the page's): colours toward these… */
  const SKY_COLOURS = { skyZenith: '#6189c0', skyMid: '#8eabd6', skyHorizon: '#b3c8e8', fogColor: '#adc3e6', valleyHazeColor: '#adc3e6' };
  /* …and these as factors on the page's own value, so its panel still means something: more air between the walls, a
     smaller, softer sun with less of a streak.
     ONLY dials nothing else on this page holds. flow2-canyon-light.js holds glowStrength and valleyHaze (and the rim, the
     sun's place, shadowStrength) by the same "whatever else writes it is the new base" rule: two such holders on one dial
     take each other's writes for the page's, and a factor then compounds every frame (seen: valleyHaze 0.7 → 738 on the
     climb out, the whole range one pale cut-out). Those go through that file's own EASED values instead (grade(), below).
     fogNear, not fogFar: the page's fog is its own density × fogNear in the canyon and × fogFar from the air, and
     valleyHaze is nothing below 25 units of height, so neither of the last two can be seen from the river. */
  const SKY_SCALE = { fogNear: 1.5, sunSize: .7, glowSize: 1.5, flare: .25 };
  const light = window.__FLOW2_CANYON_LIGHT__;
  const ROCK_SCALE = { rockTone: 1.3 };
  let tone = 0;
  const blend = (a, b, t) => Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * t) : typeof a === 'string' ? mixHex(a, b, t) : a + (b - a) * t;
  function grade(value) {
    tone = Math.min(1, Math.max(0, Number.isFinite(+value) ? +value : TONE));
    for (const k of Object.keys(HERO.water)) T[k] = blend(REAL.water[k], HERO.water[k], tone);
    for (const k of Object.keys(HERO.light)) LIGHT[k] = blend(REAL.light[k], HERO.light[k], tone);
    for (const k of Object.keys(HERO.colours)) LIGHT_COLOURS[k] = blend(REAL.colours[k], HERO.colours[k], tone);
    for (const k of Object.keys(HERO.rock)) ROCK[k] = blend(REAL.rock[k], HERO.rock[k], tone);
    /* flow2-canyon-light.js's own dials, set there: its rim and shade as this file wants them, and its sun glow by the tone */
    if (light?.EASED && q.get('valleyLight') !== '0') Object.assign(light.EASED, CANYON_LIGHT, { glowStrength: blend(.9, .7, tone) });
    state.tone = tone;
  }
  grade(num('valleyTone', TONE));

  /* The scene's own dials, held at this file's values while the camera is in the canyon. The page's value is the base: whatever
     else writes a dial (the tuner, the time of day) becomes the new base, as in flow2-canyon-light.js. */
  function dials({ journey, CONFIG }) {
    const L = CONFIG?.alpineLight, A = CONFIG?.alpineTerrain;
    if (!journey || !L || !A || q.get('valleyLight') === '0') { state.light = 'not set'; return; }
    /* [whose dial, the values, how they are held, by the tone's share only] */
    const sets = [[L, LIGHT, 'set'], [L, LIGHT_COLOURS, 'colour'], [A, ROCK, 'set'], [L, SKY_COLOURS, 'colour', true], [L, SKY_SCALE, 'scale', true], [A, ROCK_SCALE, 'scale', true]], base = new Map(), written = new Map();
    const name = (object, k) => (object === A ? 'r:' : 'l:') + k;
    for (const [object, values] of sets) for (const k of Object.keys(values)) base.set(name(object, k), object[k]);
    state.light = 'on';
    (function frame() {
      requestAnimationFrame(frame);
      /* the canyon (1) → the aerial chapters (0): gone before the camera has climbed out */
      const LF = window.__FLOW2_LIFT_FADE__, w = 1 - smooth(LF ? LF[0] : 9.7, LF ? LF[1] : 10.7, journey.progress); /* flow2 unify (2026-11-14): with the lift cut on, the canyon keeps its full look up to the cut (window.__FLOW2_LIFT_FADE__, set by flow2-lift-cut.js); without it, the original window */
      for (const [object, values, kind, byTone] of sets) {
        const g = byTone ? w * tone : w;
        for (const k of Object.keys(values)) {
          const id = name(object, k);
          if (object[k] !== written.get(id)) base.set(id, object[k]);
          const from = base.get(id);
          const value = kind === 'colour' ? mixHex(from, values[k], g) : typeof from !== 'number' ? from : kind === 'scale' ? from * (1 + (values[k] - 1) * g) : from + (values[k] - from) * g;
          if (value !== undefined && object[k] !== value) object[k] = value;
          written.set(id, object[k]);
        }
      }
    })();
  }

  function install({ THREE, canyon, seaMaterial, journey, CONFIG }) {
    try { dials({ journey, CONFIG }); } catch (error) { state.light = 'failed: ' + (error?.message || error); }
    if (!THREE || !canyon?.scene || !seaMaterial?.isShaderMaterial) { state.water = state.mirror = 'no canyon river to work on'; return; }
    const budget = window.__MONTIS_STUDY__?.mobileRenderBudget;
    if (budget?.mobile || seaMaterial.defines?.SEA_LITE || document.documentElement.hasAttribute('data-flow2-low-gpu') || (!document.documentElement.hasAttribute('data-flow2-phone-full') && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches)) { state.water = state.mirror = 'phone or low-power drawing budget: the river stays as it was'; return; }
    if (seaMaterial.fragmentShader.split(ANCHOR).length !== 2 || !seaMaterial.fragmentShader.includes('float seaNoise(') || !seaMaterial.fragmentShader.includes('varying vec3 vShore;')) { state.water = state.mirror = 'the river shader has changed: left as it is'; console.warn('flow2 valley: the river shader has changed; the river stays as it was'); return; }
    const U = {
      uF2Mirror: { value: null }, uF2MirrorMatrix: { value: new THREE.Matrix4() },
      uF2Water: { value: new THREE.Vector4(0, T.bend, T.ripple, T.mirror) }, uF2Fog: { value: new THREE.Vector4(.7, .78, .85, .001) },
      uF2Deep: { value: new THREE.Vector3(...T.deep) }, uF2Shallow: { value: new THREE.Vector3(...T.shallow) }, uF2Tone: { value: new THREE.Vector3(T.clarity, T.floor, T.swell) }
    };
    Object.assign(seaMaterial.uniforms, U);
    seaMaterial.fragmentShader = PARS + seaMaterial.fragmentShader.replace(ANCHOR, ANCHOR + GLSL);
    seaMaterial.needsUpdate = true;
    state.water = 'on';

    /* ---------- the mirror ---------- */
    const rivers = [], kept = [];
    canyon.scene.traverse(object => {
      if (object.isMesh && object.material === seaMaterial) rivers.push(object);
      /* what stands in the water's picture: the land and the sky, and the lights that light them. Not the water itself,
         not the light lines, mist sheets, particles or anything that draws itself by its own rules. */
      else if (object.isLight || (object.isMesh && !object.isPoints && (object.material?.isMeshStandardMaterial || /sky dome/i.test(object.material?.name || '')))) kept.push(object);
    });
    if (!rivers.length) { state.mirror = 'no river mesh found'; return; }
    for (const object of kept) object.layers.enable(MIRROR_LAYER);
    const eye = new THREE.PerspectiveCamera(); eye.layers.set(MIRROR_LAYER); eye.matrixAutoUpdate = true;
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    target.texture.minFilter = target.texture.magFilter = THREE.LinearFilter; target.texture.generateMipmaps = false;
    U.uF2Mirror.value = target.texture;
    const bias = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
    const up = new THREE.Vector3(0, 1, 0), origin = new THREE.Vector3(0, 0, 0), here = new THREE.Vector3(), look = new THREE.Vector3(), aim = new THREE.Vector3(), turn = new THREE.Matrix4();
    const plane = new THREE.Plane(), clip = new THREE.Vector4(), corner = new THREE.Vector4(), fogColor = new THREE.Color();
    let shrink = 1, drawing = false, off = '', late = 0, last = 0, gpu = null;
    /* once per animation frame and camera (the renderer's own frame count moves with every pass, this one's included) */
    let tick = 0, drawnTick = -1, drawnFor = null;
    (function beat() { tick++; requestAnimationFrame(beat); })();
    const retreat = why => { off = why; state.mirror = 'taken away: ' + why; U.uF2Water.value.x = 0; };
    /* when it goes because frames run late, the water eases back to the page's own river over a second: never in one frame */
    let leaving = 0, leavingWhy = '';
    /* flow2-tex ENGINE (2026-11-17, return-trip hitches): reading clientWidth / clientHeight here, inside the frame, made the browser lay the
       whole page out whenever something above had touched the DOM (8–10 ms a frame while the gorge hands back to the canyon, measured with
       the V8 profiler, .qa/index1-5/flow2-tex/engine/igpu/prof2). The same two numbers are read once per size change instead (a ResizeObserver
       reads them right after the browser's own layout, at no extra cost). Only with data-flow2-tex; ?texE=0 / ?tex=0 = as before. */
    const sizeCache = new WeakMap(), CACHE_SIZE = document.documentElement.hasAttribute('data-flow2-tex') && q.get('tex') !== '0' && q.get('texE') !== '0' && q.get('texEsize') !== '0' && typeof ResizeObserver === 'function';
    function canvasSize(el) {
      if (!CACHE_SIZE) return [el.clientWidth, el.clientHeight];
      let c = sizeCache.get(el);
      if (!c) { c = [el.clientWidth, el.clientHeight]; sizeCache.set(el, c); try { new ResizeObserver(() => { c[0] = el.clientWidth; c[1] = el.clientHeight; }).observe(el); } catch (error) { } }
      return c;
    }
    function mirror(renderer, scene, camera) {
      if (drawing || off || !camera.isPerspectiveCamera) return;
      if (tick === drawnTick && camera === drawnFor) return;
      drawnTick = tick; drawnFor = camera;
      if (gpu === null) { try { const gl = renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info'); gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''; } catch { gpu = ''; } if (WEAK.test(gpu)) { retreat('GPU not asked: ' + gpu); return; } }
      camera.getWorldPosition(here);
      /* only while the camera flies low over the river: from the air there is nothing to mirror that a pale ribbon does not say */
      let amount = T.water * (1 - Math.min(1, Math.max(0, (here.y - T.low) / (T.high - T.low))));
      if (leaving) { const k = 1 - (performance.now() - leaving) / 1200; if (k <= 0) { retreat(leavingWhy); return; } amount *= k * k * (3 - 2 * k); }
      U.uF2Water.value.set(amount, T.bend, T.ripple, T.mirror); U.uF2Tone.value.set(T.clarity, T.floor, T.swell);
      U.uF2Deep.value.set(...T.deep); U.uF2Shallow.value.set(...T.shallow);
      const fog = scene.fog; if (fog?.color) { fogColor.copy(fog.color); U.uF2Fog.value.set(fogColor.r, fogColor.g, fogColor.b, fog.density ?? .001); }
      if (amount <= .001 || here.y <= .05) return;
      /* its own judge: frames running late while the mirror is being drawn. Counted in time, not in frames: a machine that
         draws fifteen frames a second must not wait four times as long for relief as one that draws sixty. */
      const now = performance.now(), dt = now - last; last = now;
      if (!window.__FLOW2_QUALITY__?.hold && !leaving && dt > 0 && dt < 400) {   /* QUALITY_HOLD (2026-11-16): the mirror stays while the picture is held */
        late = dt > 25 ? late + dt : Math.max(0, late - 2 * dt); if (late > 1800) { late = 0; if (shrink > .6) { shrink = .5; state.mirror = 'on, at half its size (frames ran late)'; } else { leaving = now; leavingWhy = 'frames ran late'; state.mirror = 'going: frames ran late'; } } }
      if (!window.__FLOW2_QUALITY__?.hold && shrink > .6 && /lowered its resolution/.test(window.__FLOW2_FINE_JOURNEY__?.state?.dropped || '')) shrink = .5;
      const scale = Math.min(1, Math.max(.1, T.size)) * shrink;
      const cw = canvasSize(renderer.domElement);   /* flow2-tex ENGINE: the canvas's size without a forced layout each frame */
      const w = Math.max(64, Math.round(cw[0] * scale)), h = Math.max(64, Math.round(cw[1] * scale));
      if (target.width !== w || target.height !== h) { target.setSize(w, h); state.size = w + ' x ' + h; }
      /* the eye under the water, looking up at the same thing (after three.js's Reflector, for the level plane y = 0) */
      here.y = -here.y; eye.position.copy(here);
      turn.extractRotation(camera.matrixWorld);
      look.set(0, 0, -1).applyMatrix4(turn); camera.getWorldPosition(aim).add(look); aim.y = -aim.y;
      eye.up.set(0, 1, 0).applyMatrix4(turn); eye.up.y = -eye.up.y;
      eye.lookAt(aim); eye.far = camera.far; eye.near = camera.near; eye.updateMatrixWorld();
      eye.projectionMatrix.copy(camera.projectionMatrix); eye.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      U.uF2MirrorMatrix.value.copy(bias).multiply(eye.projectionMatrix).multiply(eye.matrixWorldInverse);
      /* nothing under the water's level is drawn into its picture: the near plane is laid on the water (oblique frustum) */
      plane.setFromNormalAndCoplanarPoint(up, origin).applyMatrix4(eye.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const P = eye.projectionMatrix.elements;
      corner.set((Math.sign(clip.x) + P[8]) / P[0], (Math.sign(clip.y) + P[9]) / P[5], -1, (1 + P[10]) / P[14]);
      clip.multiplyScalar(2 / clip.dot(corner));
      P[2] = clip.x; P[6] = clip.y; P[10] = clip.z + 1 - .003; P[14] = clip.w;
      const t0 = performance.now(), was = renderer.getRenderTarget(), xr = renderer.xr.enabled, shadows = renderer.shadowMap.autoUpdate;
      drawing = true;
      try {
        renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false;
        renderer.setRenderTarget(target); renderer.state.buffers.depth.setMask(true);
        if (renderer.autoClear === false) renderer.clear();
        renderer.render(scene, eye);
      } finally {
        drawing = false; renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = shadows; renderer.setRenderTarget(was);
        if (camera.viewport !== undefined) renderer.state.viewport(camera.viewport);
      }
      state.frames++; state.ms = Math.round((performance.now() - t0) * 100) / 100; if (!off && !/half|going/.test(state.mirror)) state.mirror = 'on';
    }
    for (const river of rivers) {
      const own = river.onBeforeRender;
      river.onBeforeRender = function (renderer, scene, camera, ...rest) {
        try { mirror(renderer, scene, camera); } catch (error) { retreat('it failed: ' + (error?.message || error)); console.warn('flow2 valley: mirror stopped', error); }
        return own?.call(this, renderer, scene, camera, ...rest);
      };
    }
    state.mirror = 'ready'; state.kept = kept.length; state.rivers = rivers.length; API.kept = kept;
    API.dispose = () => { target.dispose(); };
  }

  const API = window.__FLOW2_VALLEY__ = { install, tune: T, state, LIGHT, LIGHT_COLOURS, ROCK, REAL, HERO, SKY_COLOURS, SKY_SCALE, ROCK_SCALE };
  Object.defineProperty(API, 'tone', { get: () => tone, set: grade, enumerable: true });
  /* main.js hands the built canyon to flow2-canyon-light.js; this takes it from there (and stands in for it under ?light=0) */
  window.__FLOW2_CANYON_LIGHT__ = { ...(light || {}), install(args) { try { light?.install?.(args); } finally { try { install(args || {}); } catch (error) { state.water = state.mirror = 'failed: ' + (error?.message || error); console.warn('flow2 valley skipped', error); } } } };
})();
