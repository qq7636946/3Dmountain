/* Flow2 valley, the rock (2026-11-12): the canyon's walls drawn as real stone, on index1-5-flow2.html only.
   Client: 「山谷再寫實2倍」 (the day before: 「山谷不夠真實，所有細節、質感起碼要現在的 2、3 倍以上」; that round made the river water and
   lit the rock, flow2-valley.js, and left the rock's own surface as it was: smooth faces with soft blotches and long streaks).

   What a real canyon wall has and this one lacked, all of it drawn in the wall's own shader (no new objects, no new pictures):
   1. BEDS. The rock lies in beds that dip gently and wander along the wall, thick ones made of thinner ones. A hard bed stands
      proud and is paler, a soft one is cut back and darker; the edge of each catches the light or holds a shadow.
   2. JOINTS. The wall's own upright joint sets (the scene's dials) cut a little deeper and closer, so they break the beds.
      (Cracks drawn as lines of equal noise were tried first: they read as contour lines, which the client had taken off.)
   3. GRAIN. Pits and grains close to the lens, so a face is never a smooth sheet.
   4. COLOUR. Bed to bed, and mineral staining across the beds: warmer and cooler stone, a few rust-pale patches. Small shifts
      inside the page's own grey-blue rock; the palette the client chose the day before (the tone) is not moved.
   5. THE WET FOOT. The band the river washes is dark, wet stone with a pale mineral line where the water usually stands.
   6. THE RIVER mirrors the canyon a little more clearly and carries a little more fine ripple (flow2-valley.js's water; its
      colours, its long swell and its tone are not moved). ?realWater=0 leaves the river as that file has it.
   Every part fades out before it would be finer than a pixel (nothing shimmers in the flight), and nothing moves by itself.

   How it gets there: main.js already calls window.__FLOW2_FINE_JOURNEY__.canyon() when the canyon is built, before its shaders
   compile (flow2-fine-journey.js). This file adds itself to that call (and makes the call's target if that file is switched off).
   It changes the walls' program only (ALP_BANK, not the phone's lighter one): the mountains seen from the air, the shore
   stones and the grass are not touched. The number of shader programs does not change.
   Loaded after flow2-fine-journey.js, before main.js. ?real=0 leaves it out. Live: window.__FLOW2_VALLEY_REAL__.tune, .state */
(() => {
  const Q = new URLSearchParams(location.search);
  if (Q.get('real') === '0') return;
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    rock: num('realRock', 1),   // all of it on the walls (0 = none)
    relief: 1,                  // how far the beds, cracks and grain turn the surface
    colour: 1,                  // bed-to-bed and mineral colour
    wet: 1,                     // the wet foot and its mineral line
    waterY: 0,                  // the river's level in the scene (the lens rides 2.4 above it)
    /* the wall's own dials (CONFIG.alpineTerrain), as factors on the page's values, held while the lens is in the canyon */
    dials: { jointAmt: 1.3, jointDensity: 1.3, scree: 1.7, rockFlute: .85 },
    /* the river (flow2-valley.js): what its water shows at the page's tone. mirror = how clearly it mirrors the canyon, ripple = fine
       ripples, bend = how far they bend the picture. The colours, the long swell and the tone itself are that file's and are not moved. */
    water: { mirror: .8, ripple: 1.15, bend: .26 }
  };
  const state = { rock: 'not built yet', programs: 0 };
  const U = { uF2Real: { value: [T.rock, T.waterY, T.colour, T.relief] }, uF2Real2: { value: [T.wet, 0, 0, 0] } };
  const ANCHOR = '      vec3 rockVar=vec3(1.);   // water streaks / varnish';
  const GLSL = `
      /* flow2 valley real (flow2-valley-real.js): the wall as bedded, cracked, weathered stone with a wet foot */
      if(uF2Real.x>.001){
        float f2rWall=1.-smoothstep(.5,.88,N0.y);                    /* sheer and steep rock; benches and ledges keep more of their own look */
        float f2rK=uF2Real.x*(.3+.7*f2rWall)*(1.-smoothstep(5.,14.,foot));   /* nothing of it from the air */
        float f2rU=mix(P.x,P.z,W.x/max(W.x+W.z,1e-3));               /* the way along the wall */
        /* beds: the height above the river, tilted a little, wandering along the wall */
        float f2rDip=P.y+dot(P.xz,vec2(.085,-.06))+(aNoise(P.xz*.016+vec2(2.7,9.1))-.5)*16.+(aNoise(P.xz*.06+vec2(6.3,1.2))-.5)*3.;
        float f2rA=1.-smoothstep(1.2,5.,foot),f2rB=1.-smoothstep(.45,2.,foot),f2rC=1.-smoothstep(.12,.7,foot);
        float f2rB1=aNoise(vec2(f2rDip*.19,3.7)),f2rB2=aNoise(vec2(f2rDip*.57,8.4)),f2rB3=aNoise(vec2(f2rDip*1.7,1.3)+f2rU*.02);
        /* thick beds with a clear edge, thinner ones inside them, and a fine lamination only close up */
        float f2rBed=(smoothstep(.4,.6,f2rB1)-.5)*f2rA+(smoothstep(.3,.7,f2rB2)-.5)*.55*f2rB+(f2rB3-.5)*.3*f2rC;
        /* grain and pitting, close to the lens only */
        float f2rN=1.-smoothstep(.05,.22,foot);
        float f2rG=(aNoise(Rp.xy*1.3)+aNoise(Rp.yz*2.9)*.6+aNoise(Rp.zx*6.1)*.35-.975)*f2rN;
        /* their height (world units) turns the surface */
        float f2rH=(f2rBed*.30+f2rG*.06)*uF2Real.w;
        {
          vec3 f2rPx=dFdx(P),f2rPy=dFdy(P);float f2rHx=dFdx(f2rH),f2rHy=dFdy(f2rH);
          vec3 f2rR1=cross(f2rPy,Nr),f2rR2=cross(Nr,f2rPx);float f2rDet=dot(f2rPx,f2rR1);
          vec3 f2rGrad=sign(f2rDet)*(f2rHx*f2rR1+f2rHy*f2rR2);
          /* (a slope steeper than about 60 degrees is held: one pixel's difference is not a cliff) */
          f2rGrad*=min(1.,1.8*abs(f2rDet)/max(length(f2rGrad),1e-6));
          Nr=normalize(abs(f2rDet)*Nr-f2rGrad*f2rK);
        }
        /* colour: bed to bed, mineral staining across the beds, the grain's own speckle; darker in the cracks */
        vec3 f2rTint=mix(vec3(1.07,1.,.92),vec3(.93,.98,1.06),aNoise(vec2(f2rDip*.11,5.5)+P.xz*.004));
        f2rTint=mix(f2rTint,vec3(1.1,1.02,.9),smoothstep(.62,.8,aNoise(P.xz*.021+P.y*.013+vec2(7.1,3.3)))*.5);
        rock*=mix(vec3(1.),f2rTint*(1.+f2rBed*.42+f2rG*.5),f2rK*uF2Real.z);
        /* the wet foot: dark where the river washes it, a pale line where the water usually stands */
        float f2rWy=P.y-uF2Real.y+(aNoise(vec2(f2rU*.19,1.7))-.5)*.9+(aNoise(vec2(f2rU*.9,6.2))-.5)*.25;
        float f2rWet=1.-smoothstep(.5,2.1,f2rWy),f2rRing=smoothstep(1.7,2.15,f2rWy)*(1.-smoothstep(2.15,2.9,f2rWy));
        rock*=mix(1.,.5,f2rWet*uF2Real2.x)*(1.+f2rRing*.22*uF2Real2.x);
      }
`;

  function stone(built) {
    if (!built?.scene) { state.rock = 'no canyon handed over'; return; }
    const seen = new Set();
    built.scene.traverse(object => {
      for (const material of [].concat(object.material || [])) {
        if (!material?.userData?.alpineTerrain || seen.has(material) || typeof material.onBeforeCompile !== 'function') continue;
        seen.add(material);
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
        material.onBeforeCompile = function (shader, renderer) {
          compile.call(this, shader, renderer);
          const f = shader.fragmentShader;
          /* the walls' full program only: not the phone's lighter one, not the mountains seen from the air, not the shore stones */
          if (!f.includes('#define ALP_BANK\n') || f.includes('#define ALP_LITE\n') || f.includes('uF2Real')) return;
          if (!f.includes(ANCHOR) || !f.includes('void main() {')) { state.rock = 'the wall shader has changed: left as it was'; return; }
          shader.fragmentShader = f.replace('void main() {', 'uniform vec4 uF2Real,uF2Real2;\nvoid main() {').replace(ANCHOR, GLSL + ANCHOR);
          shader.uniforms.uF2Real = U.uF2Real; shader.uniforms.uF2Real2 = U.uF2Real2;
          state.programs++; state.rock = 'on';
        };
        material.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|flow2-valley-real-1'; };
        material.needsUpdate = true;
      }
    });
    if (state.rock === 'not built yet') state.rock = seen.size ? 'waiting for the walls to be drawn' : 'no terrain material found';
    /* the dials follow the tune (changing one shows at once) */
    (function frame() {
      requestAnimationFrame(frame);
      const a = U.uF2Real.value, b = U.uF2Real2.value;
      a[0] = T.rock; a[1] = T.waterY; a[2] = T.colour; a[3] = T.relief; b[0] = T.wet;
    })();
  }

  /* The wall's dials: the page's value is the base (whatever else writes one becomes the new base, as flow2-valley.js does); only
     dials no other flow2 file holds. Gone before the lens has climbed out: the mountains seen from the air keep the page's values. */
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function dials() {
    const base = new Map(), written = new Map();
    state.dials = 'waiting for the scene';
    (function frame() {
      requestAnimationFrame(frame);
      const S = window.__MONTIS_STUDY__, A = S?.CONFIG?.alpineTerrain, journey = S?.journey;
      if (!A || !journey) return;
      const LF = window.__FLOW2_LIFT_FADE__, w = (1 - smooth(LF ? LF[0] : 9.7, LF ? LF[1] : 10.7, journey.progress)) * Math.min(1, Math.max(0, T.rock)); /* flow2 unify (2026-11-14): with the lift cut on, the canyon keeps its full look up to the cut (window.__FLOW2_LIFT_FADE__, set by flow2-lift-cut.js); without it, the original window */
      for (const k of Object.keys(T.dials)) {
        if (typeof A[k] !== 'number') continue;
        if (A[k] !== written.get(k)) base.set(k, A[k]);
        const value = base.get(k) * (1 + (T.dials[k] - 1) * w);
        if (A[k] !== value) A[k] = value;
        written.set(k, A[k]);
      }
      state.dials = 'on';
    })();
  }
  /* The river: flow2-valley.js blends each water value between a "real" and an "opening" endpoint by its tone. The opening endpoints
     of mirror and ripple are moved so that, at the tone the page stands at, the water shows T.water; then it is asked to blend again. */
  function river() {
    const V = window.__FLOW2_VALLEY__;
    if (!V?.HERO?.water || !V.REAL?.water || !V.tune) { state.water = 'no valley water on this page'; return; }
    const t = V.tone;
    if (t > .05) for (const k of ['mirror', 'ripple']) { const real = V.REAL.water[k]; if (typeof real === 'number' && typeof T.water[k] === 'number') V.HERO.water[k] = real + (T.water[k] - real) / t; }
    V.tone = t;
    if (typeof T.water.bend === 'number') V.tune.bend = T.water.bend;
    state.water = 'on';
  }
  if (Q.get('realWater') !== '0') { try { river(); } catch (error) { state.water = 'failed: ' + (error?.message || error); } }

  /* main.js → __FLOW2_FINE_JOURNEY__.canyon(handles): add this file to that call */
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const before = host.canyon;
  host.canyon = function (handles = {}) {
    try { before?.call(this, handles); } finally {
      if (!handles.lite) { try { stone(handles.canyon); dials(); } catch (error) { state.rock = 'failed: ' + (error?.message || error); console.warn('flow2 valley real: the walls keep their own look', error); } }
      else state.rock = 'not on the lighter drawing';
    }
  };
  window.__FLOW2_VALLEY_REAL__ = { tune: T, state };
})();
