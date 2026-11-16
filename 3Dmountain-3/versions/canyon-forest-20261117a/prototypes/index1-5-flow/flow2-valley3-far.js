/* Flow2 valley, third round (2026-11-14): far (遠山、天空與空氣). index1-5-flow2.html only.
   Client: 「山谷細節要更好」. Seen from the river, everything beyond the canyon walls read as one pale cut-out: the scene's distance
   fog (FogExp2) whitens a ridge 800 units off by about 70 %, evenly from its foot to its top, so the far range had no depth inside
   it and its big faces showed as flat facets. Rendered without that fog the same ridges are rock with texture and moss.

   What this file does, while the lens is in the canyon (gone before the aerial chapters, p 9.7 → 10.5):
   1. AIR IN LAYERS. (a) The distance haze's curve, in the haze code the world's lit materials share (alpine-atmosphere.js
      HAZE_FRAGMENT): the same air at 300 units, a gentler, longer climb beyond (one line, see 1a). (b) That code's layered-haze
      model (height haze pooled on each valley floor), which the page switches on only from the air, is used a little in the
      canyon too, through its shared uniforms: each ridge's foot sinks into the air while its top stands out, and ridge behind
      ridge steps back paler and cooler.
   2. HIGH THIN CLOUD. Where the sky shows between the walls (high up, where the page's cumulus fades out) a faint layer of
      streaked high cloud, lit from the sun's side, drifting very slowly with the cumulus. Never flickers: smooth texture only.
   (3. opt-in, ?v3farMesh=1: ridged relief inside the far mountains' big triangles, see 1c.)
   Not touched: the walls' and the water's look (other members), the fog density and colour dials, the tone, the sun.
   Hooks: __FLOW2_FINE_JOURNEY__.canyon (as flow2-valley-real.js; the previous handler runs first), before the canyon compiles:
   the hazed materials' onBeforeCompile gets one more step (programs that compile anyway; cache key '|flow2-valley3-far-1'; no
   new program) and the sky dome's shader a few lines; the canyon's alpineAtmosphere.update is wrapped so the values are written
   right after the page writes its own, every frame.
   On by default since the lead's review (2026-11-14); ?v3=0 (all three) or ?v3far=0 leaves it out. Switches: ?v3farAir=0, ?v3farCurve=0, ?v3farSky=0, ?v3farMesh=1 (opt-in far relief). Live: window.__FLOW2_VALLEY3_FAR__ */
(() => {
  const Q = new URLSearchParams(location.search);
  const on = Q.has('v3far') ? Q.get('v3far') : Q.get('v3');
  if (on === '0' || (on !== '1' && window.__FLOW2_QUALITY__?.start === 'low')) return;   /* flow2 quality (2026-11-14): not installed when the page starts at the low tier (flow2-quality.js); ?v3far=1 forces it */
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    amount: num('v3farAmount', 1),             // all of it (0 = the page as it was)
    air: Q.get('v3farAir') === '0' ? 0 : 1,
    /* the layered haze in the canyon: strength (×1e-3 per unit at the valley floor), height (units over which it halves ~0.7×),
       floor offset (units), layer contrast (the haze amount is raised to this power: >1 clears the middle distance) */
    haze: { strength: num('v3farHaze', .3), height: num('v3farHazeH', 50), floor: num('v3farHazeFloor', 0), contrast: num('v3farContrast', 1) },
    /* the distance haze's curve: 1 − exp(−(c·ρd)^k) in place of the page's 1 − exp(−(ρd)²) (on: 0 = the page's curve) */
    curve: { on: Q.get('v3farCurve') === '0' ? 0 : 1, c: num('v3farC', .55), k: num('v3farK', 1.2) },
    mesh: Q.get('v3farMesh') === '1' ? 1 : 0,  // the far ground's own relief: opt-in (?v3farMesh=1), compiled in only then (it adds to a heavy terrain program for a small gain)
    relief: num('v3farRelief', 1),             // its strength (live)
    sky: Q.get('v3farSky') === '0' ? 0 : 1,
    cirrus: num('v3farCirrus', .45),           // high thin cloud
    cirrusScale: num('v3farCirrusScale', .6)   // its size on the sky (larger = finer streaks)
  };
  const state = { air: 'waiting for the canyon', sky: 'waiting for the canyon', weight: 0 };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  /* the canyon only: nothing of it from the air */
  const weight = () => { const j = window.__MONTIS_STUDY__?.journey; if (!j) return 0; const LF = window.__FLOW2_LIFT_FADE__; return 1 - smooth(LF ? LF[0] : 9.7, LF ? LF[1] : 10.5, j.progress); }; /* flow2 unify (2026-11-14): with the lift cut on, the canyon keeps its full look up to the cut (window.__FLOW2_LIFT_FADE__, set by flow2-lift-cut.js); without it, the original window */

  /* ---------------------------------------------------------------- 2. the sky's high thin cloud */
  const SKY_ANCHOR = '  // Sun: disc, two-scale halo';
  const SKY_GLSL = `  // flow2 valley3 far (flow2-valley3-far.js): high thin cloud, where the sky shows between the canyon walls
  if(uF2Far.x>.001&&y>.04){
    vec2 cq=d.xz/(y+.14)*uF2Far.y;
    cq=mat2(.93,-.37,.37,.93)*cq+vec2(uTime*.00022*uDrift,uTime*.00006*uDrift);
    float cn1=texture2D(uNoise,cq*vec2(.42,2.3)+vec2(.13,.71)).r;
    float cn2=texture2D(uNoise,cq*vec2(1.3,6.2)+vec2(.57,.29)).r;
    float cn3=texture2D(uNoise,cq*.16+vec2(.41,.07)).r;
    float cs=smoothstep(.48,.86,cn1*.68+cn2*.32)*smoothstep(.34,.72,cn3);
    cs*=smoothstep(.04,.2,y)*(1.-smoothstep(.8,.99,y));
    vec3 ccol=mix(col,mix(uCloudLit,horizon,.35),.62)+uSunCol*pow(max(mu,0.),7.)*.22*uSunEnergy;
    col=mix(col,ccol,clamp(cs*uF2Far.x,0.,.6));
  }
`;
  function skyCloud(built, THREE) {
    const A = built?.alpineAtmosphere, m = A?.sky;
    if (!m || !m.isShaderMaterial) { state.sky = 'no sky dome handed over'; return; }
    if (!m.fragmentShader.includes(SKY_ANCHOR) || !m.fragmentShader.includes('uniform sampler2D uNoise;')) { state.sky = 'the sky shader has changed: left as it was'; return; }
    if (m.fragmentShader.includes('uF2Far')) return;
    m.uniforms.uF2Far = { value: new THREE.Vector4(0, 0, 0, 0) };
    m.fragmentShader = m.fragmentShader.replace('uniform sampler2D uNoise;', 'uniform sampler2D uNoise;\nuniform vec4 uF2Far;').replace(SKY_ANCHOR, SKY_GLSL + SKY_ANCHOR);
    m.needsUpdate = true;
    state.sky = 'on';
  }

  /* ---------------------------------------------------------------- 1a. the distance haze's curve, in the haze code the world's
     lit materials already share (alpine-atmosphere.js HAZE_FRAGMENT): the page's FogExp2 curve 1 − exp(−(ρd)²) is clear to ~300
     units and then whitens everything within a few hundred more (a ridge 800 off is 71 % fog, one 1200 off 94 %): a pale cut-out.
     Real air thickens more gently and for longer: 1 − exp(−(c·ρd)^k) with k 1.4, c .69 matches the page's haze at 300 units
     (the near walls and the river beside them keep their air) and leaves a ridge 800 off at 50 %, 1500 off at 81 %, the horizon
     still lost in haze. Blended in by the canyon weight; the code is one line in programs that compile anyway. */
  const FOG_PARS = 'uniform vec4 uAlpHaze;', FOG_ANCHOR = '    vec3 alpRay = vAlpWorld - cameraPosition;';
  const FOG_GLSL = `    #ifdef FOG_EXP2
      alpDist = mix(alpDist, 1.0 - exp(-pow(max(fogDensity * vFogDepth * uF2FarFog.y, 0.), uF2FarFog.z)), uF2FarFog.x);   /* flow2-valley3-far.js */
    #endif
`;
  /* ---------------------------------------------------------------- 1c. the far ground's own relief (the watershed's mountains,
     ALP_MESH, full program only): that mesh is a 27-unit grid, so a peak 800 off is a handful of big flat triangles, and once the
     air is clearer their planes show. Two octaves of ridged relief (38 and 14 units, on the ground's own side projections) turn
     the normal inside those planes, each gone before it is finer than ~4 pixels; only beyond 120 units from the lens, only in
     the canyon (from the air the mountains keep the page's look). */
  const MESH_ANCHOR = '      alpN=normalize(mix(Nf,Nsn,snowM));';
  const MESH_GLSL = `
      #if defined(ALP_MESH) && !defined(ALP_LITE)
      if(uF2FarFog.w>.001){
        float f3k=uF2FarFog.w*smoothstep(120.,320.,camD);
        if(f3k>.001){
          vec3 f3w=aTriW(N0);
          float f3a=1.-smoothstep(3.8,9.5,foot),f3b=1.-smoothstep(1.4,3.5,foot);
          vec3 f3p=P/38.;
          float f3h=((1.-abs(aNoise(f3p.zy+vec2(3.1,.7))*2.-1.))*f3w.x+(1.-abs(aNoise(f3p.xz+vec2(.4,5.2))*2.-1.))*f3w.y+(1.-abs(aNoise(f3p.xy+vec2(7.3,2.9))*2.-1.))*f3w.z)*22.*f3a;
          f3p=P/14.;
          f3h+=((1.-abs(aNoise(f3p.zy+vec2(1.7,8.3))*2.-1.))*f3w.x+(1.-abs(aNoise(f3p.xz+vec2(6.6,.2))*2.-1.))*f3w.y+(1.-abs(aNoise(f3p.xy+vec2(2.2,4.4))*2.-1.))*f3w.z)*7.*f3b;
          vec3 f3Px=dFdx(P),f3Py=dFdy(P);float f3Hx=dFdx(f3h),f3Hy=dFdy(f3h);
          vec3 f3R1=cross(f3Py,alpN),f3R2=cross(alpN,f3Px);float f3Det=dot(f3Px,f3R1);
          vec3 f3G=sign(f3Det)*(f3Hx*f3R1+f3Hy*f3R2);
          f3G*=min(1.,1.5*abs(f3Det)/max(length(f3G),1e-6));
          alpN=normalize(mix(alpN,normalize(abs(f3Det)*alpN-f3G),f3k));
        }
      }
      #endif
`;
  const fogU = { uF2FarFog: { value: null } };
  function fogCurve(built, A, THREE) {
    fogU.uF2FarFog.value = new THREE.Vector4(0, T.curve.c, T.curve.k, 0);
    let n = 0;
    for (const material of A.hazed || []) {
      if (!material || typeof material.onBeforeCompile !== 'function' || material.userData.f2Far) continue;
      const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
      material.onBeforeCompile = function (shader, renderer) {
        compile.call(this, shader, renderer);
        let f = shader.fragmentShader;
        if (f.includes('uF2FarFog') || !f.includes(FOG_PARS) || !f.includes(FOG_ANCHOR)) return;
        f = f.replace(FOG_PARS, FOG_PARS + '\nuniform vec4 uF2FarFog;').replace(FOG_ANCHOR, FOG_GLSL + FOG_ANCHOR);
        if (T.mesh && f.includes('#define ALP_MESH\n') && !f.includes('#define ALP_LITE\n') && f.includes(MESH_ANCHOR)) { f = f.replace(MESH_ANCHOR, MESH_ANCHOR + MESH_GLSL); state.mesh = 'on'; }
        shader.fragmentShader = f;
        shader.uniforms.uF2FarFog = fogU.uF2FarFog;
        state.programs = (state.programs || 0) + 1;
      };
      material.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|flow2-valley3-far-1'; };
      material.userData.f2Far = true; material.needsUpdate = true; n++;
    }
    state.curve = n ? `on (${n} materials)` : 'no hazed materials';
  }

  /* ---------------------------------------------------------------- 1b. the air in layers (+ the curve, the sky's dial), every frame */
  function air(built, THREE) {
    const A = built?.alpineAtmosphere;
    if (!A?.hazeUniforms?.uAlpHaze || typeof A.update !== 'function') { state.air = 'no haze on this page'; return; }
    if (T.air) fogCurve(built, A, THREE);
    const H = A.hazeUniforms.uAlpHaze.value, sky = A.sky?.uniforms?.uF2Far?.value, F = fogU.uF2FarFog;
    const update = A.update;
    A.update = function () {
      const r = update.apply(this, arguments);
      try {
        const w = weight() * Math.min(1, Math.max(0, T.amount));
        state.weight = +w.toFixed(3);
        const wa = w * T.air;
        if (F.value) { F.value.x = wa * T.curve.on; F.value.y = T.curve.c; F.value.z = T.curve.k; F.value.w = wa * T.relief; }
        if (wa > 0) {
          /* the page's values (from the air: its own valley haze; in the canyon: none) are the base; the canyon's are blended in */
          H.x = mix(H.x, T.haze.strength, wa); H.y = mix(H.y, T.haze.height, wa);
          H.z = mix(H.z, T.haze.floor, wa); H.w = mix(H.w, T.haze.contrast, wa);
        }
        if (sky) { sky.x = T.cirrus * w * T.sky; sky.y = T.cirrusScale; }
      } catch (error) { state.air = 'failed: ' + (error?.message || error); }
      return r;
    };
    state.air = T.air ? 'on' : 'off (?v3farAir=0)';
  }

  /* main.js → __FLOW2_FINE_JOURNEY__.canyon(handles): add this file to that call (the previous handler first) */
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const before = host.canyon;
  host.canyon = function (handles = {}) {
    try { before?.call(this, handles); } finally {
      if (handles.lite) { state.air = state.sky = 'not on the lighter drawing'; }
      else {
        try { if (T.sky) skyCloud(handles.canyon, handles.THREE || window.THREE); else state.sky = 'off (?v3farSky=0)'; } catch (error) { state.sky = 'failed: ' + (error?.message || error); console.warn('flow2 valley3 far: the sky keeps its own look', error); }
        try { air(handles.canyon, handles.THREE || window.THREE); } catch (error) { state.air = 'failed: ' + (error?.message || error); console.warn('flow2 valley3 far: the air keeps its own look', error); }
      }
    }
  };
  window.__FLOW2_VALLEY3_FAR__ = { tune: T, state };
})();
