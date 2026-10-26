/* index1-5 only: the opening water, dispersed beads and liquid letters share
   the sea's steel-blue reflections (client reference, 2026-10-26). */
module.exports = ({ main, drops, letters, glass, html, ...rest }) => {
  const once = (a, b) => {
    if (main.split(a).length !== 2) throw Error('water palette anchor: ' + a.slice(0, 90));
    main = main.replace(a, () => b);
  };
  const normalOpening = !html.includes('data-opening-refinement');
  if (!normalOpening) return { main, drops, letters, glass, html, ...rest };

  once('      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* WATER_PALETTE_20261026: silver-blue highlights, navy shadows, no soap-film rainbow.
         Defaults are stored before the tuner snapshot; geometry and chapter timing are unchanged. */
      Object.assign(CONFIG.drop, {
        f0: .88, roughness: .026, streak: 1.15, iris: .02, irisEdge: 3.5,
        card: .72, rim: .48, lens: .26
      });
      Object.assign(CONFIG.chrome, { iris: .02 });
      Object.assign(CONFIG.droplet, {
        water: 1, sheen: .35, bodyColor: '#2f4d63', glowColor: '#20374a', sheenColor: '#bed7e6'
      });
      Object.assign(CONFIG.logoDrops, {
        uniformColor: 1, swirlMetal: .95, swirlMetalVar: .02, swirlEnvTurn: .05,
        swirlHaze: .10, swirlSunRim: .025, swirlSunGlint: .18,
        chromeCard: .72, chromeBand: .06, chromeRough: .026,
        chromeRim: .48, chromeLens: .26, innerFlow: .55
      });
      Object.assign(CONFIG.beadLife, { matchHero: 1, sheen: .8 });
      Object.assign(CONFIG.logoGlass, {
        tint: '#eff5f9', glCore: '#496d7d', glInkColor: '#132b3f',
        glBandHigh: '#52758f', glBandLow: '#d1e0eb', glRimColor: '#8fb3cd',
        shadeColor: '#20394f', iridescence: .003, iridPatch: 0
      });
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);

  // The hero formerly used a neutral/green silver F0 while the sea used blue.
  // Sharing the channel ratios also reaches both bead materials by reference.
  once(`        /* The hero's own metal. Neutral silver rather than the sea's blue one,
           a sharper mirror, and the iridescence spread into the body instead of
           ringing the silhouette. */`, `        /* Hero and beads retain their own reflection strength, with the sea's
           steel-blue channel balance and restrained edge iridescence. */`);
  once('dropChromeUniforms.uChromeF0.value.set(D.f0, D.f0 * 1.012, D.f0 * 1.036);',
       'dropChromeUniforms.uChromeF0.value.set(D.f0, D.f0 * 1.036, D.f0 * 1.099);');
  once('uEnvGlow: { value: new THREE.Vector3(.676, .694, .686) },',
       'uEnvGlow: { value: new THREE.Vector3(.64, .72, .79) },');
  // A small luminance-preserving balance removes green/magenta from the
  // droplets' moving interior without flattening their reflections. The sea
  // and the canyon do not call this balance; the reference waves keep their look.
  once('vec3 montisChrome(vec3 N,vec3 V,vec2 flow,float curv,float rough,float irisMask,float bandGain,float card){', `vec3 montisWaterTone(vec3 c){
  c=max(c,vec3(0.));
  const vec3 lum=vec3(.2126,.7152,.0722);
  float y=dot(c,lum);
  vec3 balance=mix(vec3(.58,.82,1.12),vec3(.90,.98,1.08),smoothstep(.02,.9,y));
  balance/=dot(balance,lum);
  return mix(c,y*balance,.82);
}
vec3 montisChrome(vec3 N,vec3 V,vec2 flow,float curv,float rough,float irisMask,float bandGain,float card){`);
  once('return mix(lifted,chrome,uMatch);', 'return mix(lifted,montisWaterTone(chrome),uMatch);');
  once('gl_FragColor=vec4(max(col,vec3(0.)),vExtra.x);', 'gl_FragColor=vec4(montisWaterTone(col),vExtra.x);');
  const odReturn = '      return max(c,vec3(0.));\n    }\n  `;\n  const group = new THREE.Group();';
  if (drops.split(odReturn).length !== 2) throw Error('water palette: spiral material anchor');
  drops = drops.replace(odReturn, '      return montisWaterTone(c);\n    }\n  `;\n  const group = new THREE.Group();');
  main = patchRiverMain(main);
  return { main, drops, letters, glass, html, ...rest };
};

// The river keeps its own sun direction and distance fog, but no longer uses
// the old white studio room or compresses aerial reflections to one pale band.
function patchRiverMain(main) {
  const once = (a, b) => {
    if (main.split(a).length !== 2) throw Error('river palette anchor: ' + a.slice(0, 100));
    main = main.replace(a, () => b);
  };
  once('      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* RIVER_WATER_PALETTE_20261026: the same navy / silver-blue family as the opening sea.
         Leave waves, river banks, aerial fade, fog and chapter motion intact. */
      const RIVER_WATER_PALETTE = document.documentElement.matches('[data-look="index1-5"]:not([data-opening-refinement])');
      if (RIVER_WATER_PALETTE) Object.assign(CONFIG.watershedWater, {
        base: '#203c50', highlight: '#c5dce9', reflection: .82
      });
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
  once('        const F = OPENING_RIVER_ROOM;', `        const F = RIVER_WATER_PALETTE ? CONFIG.field : OPENING_RIVER_ROOM;`);
  once('        seaUniforms.uEnvCore.value.set(F.core, .30 * F.coreSpread, .115 * F.coreSpread, .030 * F.coreSpread);', `        seaUniforms.uEnvCore.value.set(F.core, .30 * F.coreSpread, .115 * F.coreSpread, .030 * F.coreSpread);
        if (RIVER_WATER_PALETTE) {
          seaUniforms.uEnvGlow.value.copy(montisEnvUniforms.uEnvGlow.value);
          seaUniforms.uVeil.value.copy(montisVeilUniforms.uVeil.value);
        }`);
  once('        seaUniforms.uHaze.value.set(CONFIG.sea.haze * waterHazeScale, CONFIG.sea.hazeFar * waterHazeScale);', `        seaUniforms.uHaze.value.set(CONFIG.sea.haze * waterHazeScale, CONFIG.sea.hazeFar * waterHazeScale);
        if (RIVER_WATER_PALETTE) syncRiverRoom();`);
  once('          seaUniforms.uEnvGlow.value.set(D.sunColor.r, D.sunColor.g, D.sunColor.b).multiplyScalar(.38 + D.intensity * .1);', `          // Keep the valley sun direction; its water highlights retain the sea's cool silver-blue.
          if (RIVER_WATER_PALETTE) seaUniforms.uEnvGlow.value.copy(montisEnvUniforms.uEnvGlow.value);
          else seaUniforms.uEnvGlow.value.set(D.sunColor.r, D.sunColor.g, D.sunColor.b).multiplyScalar(.38 + D.intensity * .1);`);
  once('        defines: SEA_LITE ? { MONTIS_LITE: 1, SEA_LITE: 1 } : {},', `        defines: { ...(SEA_LITE ? { MONTIS_LITE: 1, SEA_LITE: 1 } : {}), ...(RIVER_WATER_PALETTE ? { RIVER_WATER_PALETTE: 1 } : {}) },`);
  once(`      // Only the late watershed chapter changes the shared water's palette.
      // Silver reflections share the ice-blue mountain palette.
      float waterLuma=dot(max(col,vec3(0.)),vec3(.2126,.7152,.0722));
      float silver=.52+(pow(clamp(waterLuma*.82,0.,1.),.75)-.5)*.10;
      vec3 mountainWater=mix(uWatershedBase,uWatershedHighlight,clamp(.10+silver*uWatershedReflection,0.,1.));`, `      // Preserve the moving reflection's luminance range during the aerial reveal.
      // Only the river's late grade changes; the opening sea is untouched.
      float waterLuma=dot(max(col,vec3(0.)),vec3(.2126,.7152,.0722));
      #ifdef RIVER_WATER_PALETTE
        float silver=smoothstep(.015,.62,waterLuma);
        vec3 mountainWater=mix(uWatershedBase,uWatershedHighlight,clamp(.06+silver*uWatershedReflection,0.,1.));
      #else
        float silver=.52+(pow(clamp(waterLuma*.82,0.,1.),.75)-.5)*.10;
        vec3 mountainWater=mix(uWatershedBase,uWatershedHighlight,clamp(.10+silver*uWatershedReflection,0.,1.));
      #endif`);
  once('      col=mix(col,mountainWater,uJourneyNight);', `      #ifdef RIVER_WATER_PALETTE
        // A near river retains the original reflections beneath the same cool grade;
        // the aerial view completes it on the existing chapter clock.
        col=mix(col,mountainWater,max(uJourneyNight,uRiverSurface*.78));
      #else
        col=mix(col,mountainWater,uJourneyNight);
      #endif`);
  return main;
}
module.exports.patchRiverMain = patchRiverMain;
