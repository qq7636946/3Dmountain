/* Flow2 canyon light (2026-11-10): light and shade for the canyon (chapters 02–04), on index1-5-flow2.html only.
   Reference the client gave: underthesea.wawasensei.dev (a light source with a halo, its path broken into glints
   on the water, haze in layers). The canyon sat under the site-wide noon sun (48° high, straight ahead), which
   gives the walls no modelling and the river nothing to reflect.

   Two parts, both through what the canyon already has (no live file changes):
   1. The canyon's own light dials (CONFIG.alpineLight, read by alpine-atmosphere every frame): a lower sun ahead and
      to the right while inside the canyon (its disc and halo come into the sky, the ridges facing it light up), the
      backlight rim along the ridges, warmer haze toward the sun, more valley haze in steps. The sun is held still
      (the shadow map re-bakes only when it moves); the rest eases back to the site's values as the camera rises
      over the watershed, so the aerial chapters keep their look. The aerial sun keys are never touched.
      Another writer (the daylight system, the tuner) setting one of these keys becomes the new base for it.
   2. The river (flow2's own water material): the sun's path on the water — a soft column under the sun's azimuth
      and small glints that flicker in it, only where a glint is larger than a pixel; bloom gives them a halo.
      The river's reflections come from its own room, not the canyon's sun, so this is drawn in its shader.

   main.js calls install() right after the canyon is built, before any of its shaders compile.
   ?light=0 leaves all of it out (and the principles light layer). */
(() => {
  if (new URLSearchParams(location.search).get('light') === '0') return;
  /* the canyon sun: azimuth 0 = straight down the river (-Z), negative to the left; elevation above the horizon */
  const SUN = { sunAzimuth: 18, sunElevation: 28 };   // lower than 28 bleaches the shore stones facing it
  /* eased in the canyon, back to the site's values over the watershed */
  const EASED = { rimAzimuth: 8, rimElevation: 6, rimStrength: 1.2, hazeSunGlow: .8, glowStrength: .9, valleyHaze: .7, layerContrast: 1.35, shadowStrength: 2.05 };
  /* the river's light path: how high the light it mirrors sits (low, so the column runs to the far water), strength */
  const GLINT = { elevation: 6, strength: 1 };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  const RIVER_PARS = 'uniform vec4 uF2Glint;\nuniform vec3 uF2GlintCol;\n';
  /* one candidate glint a cell: jittered across the cell, its own size and clock; seven cells in ten stay dark */
  const RIVER_FUNC = `
    float f2Glints(vec2 p,float seed){
      vec2 i=floor(p),f=fract(p)-.5;
      float h=montisHash(i+seed);
      vec2 o=vec2(montisHash(i+seed+17.3),montisHash(i+seed+41.9))-.5;
      float r=mix(.08,.2,montisHash(i+seed+5.1));
      float tw=pow(.5+.5*sin(uSeaTime*(1.1+2.4*h)+h*37.),5.);
      return smoothstep(r,0.,length(f-o*.6))*step(.5,h)*tw;
    }
`;
  const MAIN_ANCHOR = 'void main(){';
  const RIVER_ANCHOR = 'col+=montisDither(gl_FragCoord.xy)*mix(.004,.0006,uJourneyNight);';
  const RIVER_GLSL = `
      /* flow2 canyon light: the sun's path on the river (flow2-canyon-light.js). */
      if(uRiverSurface>.5&&uF2Glint.w>.001){
        vec3 f2R=reflect(-V,nrm);
        float f2D=max(dot(f2R,uF2Glint.xyz),0.);
        float f2far=smoothstep(30.,700.,vDist);
        float f2px=fwidth(vWorld.x)+fwidth(vWorld.z)+1e-3;
        /* the column: a narrow core and a wide soft skirt, both widening with distance (the slope under a pixel) */
        /* (the core waits a few metres out: right under the lens a single wave facet would flash as a blob) */
        float f2col=pow(f2D,mix(260.,46.,f2far))*.9*smoothstep(12.,70.,vDist)+pow(f2D,mix(34.,11.,f2far))*.16;
        /* the glints: two layers of cells at different sizes and angles (one lattice reads as a dot grid),
           kept inside the column and only where a glint is larger than a pixel */
        float f2sp=f2Glints(mat2(.8,.6,-.6,.8)*vWorld.xz*.95,0.)+f2Glints(mat2(.47,-.88,.88,.47)*vWorld.xz*1.8,71.);
        f2sp*=pow(f2D,mix(40.,12.,f2far))*(1.-smoothstep(.35,1.1,f2px*.9));
        col+=uF2GlintCol*(f2col+f2sp*3.2)*uF2Glint.w*(1.-smoothstep(900.,2400.,vDist));
      }
`;

  function install({ THREE, canyon, seaMaterial, journey, CONFIG }) {
    if (!THREE || !canyon || !journey || !CONFIG?.alpineLight) return;
    const L = CONFIG.alpineLight;
    /* 2. the river */
    let glint = null, glintCol = null;
    const once = anchor => seaMaterial?.fragmentShader?.split(anchor).length === 2;
    if (seaMaterial?.isShaderMaterial && once(RIVER_ANCHOR) && once(MAIN_ANCHOR)) {
      glint = new THREE.Vector4(0, 0, -1, 0); glintCol = new THREE.Color();
      seaMaterial.uniforms.uF2Glint = { value: glint };
      seaMaterial.uniforms.uF2GlintCol = { value: glintCol };
      seaMaterial.fragmentShader = RIVER_PARS + seaMaterial.fragmentShader
        .replace(MAIN_ANCHOR, RIVER_FUNC + '    ' + MAIN_ANCHOR)
        .replace(RIVER_ANCHOR, RIVER_GLSL + '      ' + RIVER_ANCHOR);
      seaMaterial.needsUpdate = true;
    } else console.warn('flow2 canyon light: river shader anchor not found; the river is left as it was');
    /* 1. the light dials: base = the site's value, written = what we last set */
    const base = {}, written = {};
    const keys = [...Object.keys(SUN), ...Object.keys(EASED)];
    for (const k of keys) base[k] = L[k];
    const az = SUN.sunAzimuth * Math.PI / 180, el = GLINT.elevation * Math.PI / 180;
    let lastSunColor = '';
    function frame() {
      requestAnimationFrame(frame);
      for (const k of keys) if (L[k] !== written[k]) base[k] = L[k];
      const p = journey.progress;
      const w = 1 - smooth(6.95, 8.9, p);   // the canyon (1) → the watershed from the air (0), with the river's own palette change
      for (const k of Object.keys(SUN)) L[k] = written[k] = SUN[k];
      for (const [k, v] of Object.entries(EASED)) {
        const b = +base[k];
        L[k] = written[k] = Number.isFinite(b) ? b + (v - b) * w : v;
      }
      if (glint) {
        glint.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el), GLINT.strength * w);
        if (L.sunColor !== lastSunColor) { lastSunColor = L.sunColor; glintCol.set(L.sunColor).lerp(new THREE.Color('#fff4e4'), .35); }
      }
    }
    frame();
    document.documentElement.dataset.flow2CanyonLight = 'on';
  }
  window.__FLOW2_CANYON_LIGHT__ = { install, SUN, EASED, GLINT };
})();
