/* Colour/material transfer from index1-3-maritime.html (EVEREST preset).
   Main index1-5 only. No geometry, camera, timing, DOM or CSS changes. */
'use strict';

function patchMain(main) {
  const once = (a, b) => {
    if (main.split(a).length !== 2) throw Error('maritime palette anchor: ' + a.slice(0, 100));
    main = main.replace(a, () => b);
  };
  once('      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* MARITIME_WATER_PALETTE_20261026: the reference page's mineral blue-grey room,
         silver reflections and water body, applied to the existing journey. */
      const MARITIME_WATER_PALETTE = document.documentElement.matches('[data-look="index1-5"]:not([data-opening-refinement])');
      let maritimePaletteClock = null;
      function applyMaritimeAtmosphere(enabled = true) {
        if (!MARITIME_WATER_PALETTE || !enabled) { maritimePaletteClock = null; return; }
        const daylight = getSceneDaylight();
        const clock = daylight.enabled + ':' + daylight.hour;
        if (clock === maritimePaletteClock) return;
        maritimePaletteClock = clock;
        // Only refresh after the daylight clock writes its colours. Manual M edits
        // remain live between time changes; sun direction and intensity still follow it.
        Object.assign(CONFIG.field, {
          zenith: '#bacbd7', upper: '#d4e0e5', top: '#18374e', horizon: '#aebfc9',
          lower: '#657f8e', floor: '#294b60', ink: '#203b50', core: .9, coreSpread: .55, bandGain: .035
        });
        Object.assign(CONFIG.openingWorld, {
          sunColor: '#e3e9e6', glintColor: '#e3e9e6', glintStrength: .88,
          seaTint: '#7d9da9', seaTintAmount: 0,
          hemiSky: '#c7d9e5', hemiGround: '#414750',
          moteColor: '#d8e1e6', glintTint: '#e3e9e6'
        });
        Object.assign(CONFIG.alpineLight, {
          skyZenith: '#27475e', skyMid: '#6e899e', skyHorizon: '#c9d4d7',
          fogColor: '#9faeb7', valleyHazeColor: '#9eafb9',
          sunColor: '#f7e5c8', rimColor: '#dbe7ef',
          shadowColor: '#394d5c', groundColor: '#414750',
          cloudLit: '#e3e9e6', cloudShade: '#8ea5b5'
        });
        Object.assign(CONFIG.watershedStyle, {
          rockColor: '#6e7a7d', skyColor: '#6e899e', mistColor: '#adbfc9'
        });
      }
      if (MARITIME_WATER_PALETTE) {
        // Ascent H1 drop: restore its broad cyan/lilac reflections, including
        // the iris falloff and sheen that the earlier steel palette suppressed.
        Object.assign(CONFIG.drop, {
          f0: .94, roughness: .028, aniso: .08, streak: 1.55,
          iris: .58, irisEdge: 1.35, contour: .55,
          card: .92, rim: .55, rimEdge: 12, lens: .34, lensEdge: 8.5
        });
        Object.assign(CONFIG.droplet, { sheen: 1, bodyColor: '#3d5f78', glowColor: '#26313a', sheenColor: '#cfe4ff' });
        Object.assign(CONFIG.logoDrops, { chromeCard: .92, chromeRough: .028, chromeRim: .55, chromeLens: .34 });
        Object.assign(CONFIG.logoGlass, {
          tint: '#f0f3f1', glCore: '#7d9da9', glInkColor: '#203b50',
          glBandHigh: '#657f8e', glBandLow: '#d4e0e5', glRimColor: '#b3cdd5', shadeColor: '#394d5c'
        });
        Object.assign(CONFIG.watershedWater, {
          base: '#294c60', highlight: '#7d9da9', reflection: .92
        });
        // Client's M-panel reference: small heads, no head flare, short sparse tails.
        Object.assign(CONFIG.watershedFlow, {
          color: '#b8d8e2', headSize: .20, headBright: 0, headGlow: 0,
          headWidth: .30, tail: .20, spacing: 3.00
        });
        Object.assign(CONFIG.shoreline, { foamColor: '#e1e5df' });
        Object.assign(CONFIG.lightSpecks, { color: '#d8e1e6' });
        Object.assign(CONFIG.grade, { hue: 0, sat: .93, temp: .015, tint: 0 });
        applyMaritimeAtmosphere();
      }
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
  once('        updateJourneyCamera(time);', `        applyMaritimeAtmosphere(!world?.open && !portfolio?.open);
        updateJourneyCamera(time);`);
  once('setSceneTime(10.2); openingPortal.render({ canyon, pose: openingPortalPose }); setSceneTime(restoreHour);',
    'setSceneTime(10.2); applyMaritimeAtmosphere(); openingPortal.render({ canyon, pose: openingPortalPose }); setSceneTime(restoreHour); applyMaritimeAtmosphere();');
  once('        montisVeilUniforms.uVeil.value.x = THREE.MathUtils.clamp(CONFIG.openingDrops?.veil ?? .14, 0, 1);', `        montisVeilUniforms.uVeil.value.x = THREE.MathUtils.clamp(CONFIG.openingDrops?.veil ?? .14, 0, 1);
        if (MARITIME_WATER_PALETTE) montisVeilUniforms.uVeilTint.value.set(142 / 255, 165 / 255, 181 / 255);`);
  once("material.uniforms.uWaterRiseColor = { value: new THREE.Color('#4fbcff') };", "material.uniforms.uWaterRiseColor = { value: new THREE.Color(MARITIME_WATER_PALETTE ? '#b3cdd5' : '#4fbcff') };");
  once('  vec3 balance=mix(vec3(.58,.82,1.12),vec3(.90,.98,1.08),smoothstep(.02,.9,y));',
    '  vec3 balance=mix(vec3(${MARITIME_WATER_PALETTE ? ".82,.94,1.03" : ".58,.82,1.12"}),vec3(${MARITIME_WATER_PALETTE ? "1.0,1.02,1.02" : ".90,.98,1.08"}),smoothstep(.02,.9,y));');
  // Ascent keeps the shader's reflection hues; do not desaturate them by 82%.
  // Shared hero/small-drop materials all use this function. The alternate page
  // retains its earlier steel-blue balance, and the sea shader is unaffected.
  once('  return mix(c,y*balance,.82);',
    '  return mix(c,y*balance,${MARITIME_WATER_PALETTE ? "0.0" : ".82"});');
  once('dropChromeUniforms.uChromeF0.value.set(D.f0, D.f0 * 1.036, D.f0 * 1.099);',
    'dropChromeUniforms.uChromeF0.value.set(D.f0, D.f0 * (MARITIME_WATER_PALETTE ? 1.012 : 1.036), D.f0 * (MARITIME_WATER_PALETTE ? 1.036 : 1.099));');
  once('        uJourneyNight: { value: 0 },', `        uMaritimeWaterDeep: { value: paletteLinear(CONFIG.watershedWater.base) },
        uMaritimeWaterMid: { value: paletteLinear(CONFIG.watershedWater.highlight) },
        uMaritimeWaterZenith: { value: paletteLinear('#27475e') },
        uMaritimeWaterHorizon: { value: paletteLinear('#c9d4d7') },
        uJourneyNight: { value: 0 },`);
  once('...(RIVER_WATER_PALETTE ? { RIVER_WATER_PALETTE: 1 } : {})',
    '...(RIVER_WATER_PALETTE && !MARITIME_WATER_PALETTE ? { RIVER_WATER_PALETTE: 1 } : {}), ...(MARITIME_WATER_PALETTE ? { MARITIME_WATER_PALETTE: 1 } : {})');
  once('    uniform vec3 uWatershedBase,uWatershedHighlight;', `    uniform vec3 uWatershedBase,uWatershedHighlight;
    uniform vec3 uMaritimeWaterDeep,uMaritimeWaterMid,uMaritimeWaterZenith,uMaritimeWaterHorizon;`);
  once('      vec3 col=montisChrome(nrm,V,vFlow+uSeaCurrent*.35,curv,rough,mask,1.,0.);', `      #ifdef MARITIME_WATER_PALETTE
        // The reference's dielectric water, over the original waves and normals.
        // Two broad reflection tones retain moving silver highlights without a metal plate.
        vec3 marR=reflect(-V,nrm);
        float marCos=clamp(dot(nrm,V),0.,1.);
        vec2 marCloudUV=marR.xz/max(.28,marR.y+.7)*3.1+vWorld.xz*.003;
        float marCloud=seaNoise(marCloudUV+vec2(uSeaTime*.006,1.7))*.68+seaNoise(marCloudUV*2.3+4.1)*.32;
        float marGap=smoothstep(.46,.69,marCloud);
        vec3 marSky=mix(mix(uMaritimeWaterHorizon,uMaritimeWaterZenith,.22),uMaritimeWaterZenith,marGap*.65);
        float marF=.02+.98*pow(1.-marCos,5.);
        marF=mix(marF,.05+marF*.6,clamp(rough*2.5,0.,1.));
        marF=max(marF,.30);
        vec3 marBody=mix(uMaritimeWaterDeep,uMaritimeWaterMid,pow(1.-marCos,2.)*.75);
        vec3 col=mix(marBody,marSky,clamp(marF*uWatershedReflection,0.,1.));
        vec3 marHalf=normalize(uEnvCoreDir+V);
        col+=uMaritimeWaterHorizon*pow(max(dot(nrm,marHalf),0.),mix(900.,70.,clamp(rough*3.,0.,1.)))*.25;
      #else
        vec3 col=montisChrome(nrm,V,vFlow+uSeaCurrent*.35,curv,rough,mask,1.,0.);
      #endif`);
  once('      if(foam>.002)col=mix(col,mix(col,vec3(1.),.58)*froth,foam);', `      #ifdef MARITIME_WATER_PALETTE
        if(foam>.002)col=mix(col,mix(col,uShoreFoamColor,.58)*froth,foam);
      #else
        if(foam>.002)col=mix(col,mix(col,vec3(1.),.58)*froth,foam);
      #endif`);
  once('        col=mix(col,mountainWater,uJourneyNight);', `        #ifdef MARITIME_WATER_PALETTE
          // The same water continues into the aerial view, with its original distance fog.
          col=mix(col,uRiverFogColor,riverFog*uJourneyNight);
        #else
          col=mix(col,mountainWater,uJourneyNight);
        #endif`);
  once('        seaUniforms.uWatershedBase.value.set(CONFIG.watershedWater.base);', `        if (MARITIME_WATER_PALETTE) {
          paletteLinear(CONFIG.watershedWater.base, seaUniforms.uMaritimeWaterDeep.value);
          paletteLinear(CONFIG.watershedWater.highlight, seaUniforms.uMaritimeWaterMid.value);
        }
        seaUniforms.uWatershedBase.value.set(CONFIG.watershedWater.base);`);
  return main;
}

module.exports = state => ({ ...state, main: patchMain(state.main) });
module.exports.patchMain = patchMain;
