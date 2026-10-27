// Maritime look, pass 1. Edits ONLY the copies in prototypes/maritime-landscape/js.
const fs = require('fs');
const path = require('path');
const DIR = 'G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/maritime-landscape/js';
const files = {};
const load = f => files[f] ??= fs.readFileSync(path.join(DIR, f), 'utf8');
function rep(f, a, b) {
  const s = load(f); const n = s.split(a).length - 1;
  if (n !== 1) { console.error(`[${f}] MATCH COUNT ${n} for:\n` + a.slice(0, 200)); process.exit(1); }
  files[f] = s.replace(a, () => b);
}
const MAIN = 'main.js', SCN = 'water-journey-scene-463.js';
if (load(MAIN).includes('CONFIG.maritime = {')) { console.error('main.js already patched'); process.exit(2); }

/* ============================ main.js ============================ */
rep(MAIN, `    const tuneFlag = new URLSearchParams(location.search).get('tune');`,
`    const tuneFlag = new URLSearchParams(location.search).get('tune');
    /* MARITIME TEST: ?look=original draws the untouched index1-3 look, for A/B. */
    const MARITIME = new URLSearchParams(location.search).get('look') !== 'original';`);

rep(MAIN, `      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`,
`      /* ------------------------------------------------------------------
         MARITIME (test build, 2026-10-20): the realistic coast of Mont-Fort
         Maritime. An overcast sky, warm eroded rock with dark scrub on the
         gentle ground, deep navy water with white surf where it meets rock.
         Every value is a live tuner row (group 寫實山海 Maritime). Geometry,
         camera, timing and interaction are untouched; ?look=original shows
         the page exactly as index1-3 draws it.
         ------------------------------------------------------------------ */
      CONFIG.maritime = {
        on: MARITIME ? 1 : 0,
        heroSea: 1,
        skyZenith: '#8e9aa5', skyHorizon: '#d3d5ce', fog: '#c2c4be', aerialFog: '#c4c6c0',
        sun: '#f3eadc', sunDay: 2.3, sunAerial: 2.1,
        hemiSky: '#d5d9d6', hemiGround: '#40474c', hemiDay: 1.55, hemiAerial: .75,
        rim: '#a9b6c1', rimDay: .55, rimAerial: .35, ibl: .55,
        rock: '#857869', rockCool: '#6d6c69', rockWarm: '#9a7a58', streak: .55,
        veg: '#3b4031', vegAmount: .85, vegLine: 520, frost: '#b2aa9c', refL: .13,
        deep: '#0d2740', mid: '#23435f', bed: '#2f4a4c', foam: '#e9eeee', reflect: 1, glint: .35
      };
      if (MARITIME) {
        Object.assign(CONFIG.field, { zenith: '#eef0ea', upper: '#e7e9e3', top: '#8e9aa5', horizon: '#d3d5ce', lower: '#b9bfbf', floor: '#56687a', ink: '#163049', core: 1.1 });
        Object.assign(CONFIG.watershedStyle, { rockColor: '#857869', skyColor: '#8e9aa5', mistColor: '#c4c6c0' });
        Object.assign(CONFIG.watershedWater, { base: '#14304a', highlight: '#a2adb3', reflection: .30 });
        Object.assign(CONFIG.shoreline, { foamColor: '#e9eeee', frost: .2 });
        Object.assign(CONFIG.relief, { snow: 0, ridgeFrost: .35 });
        Object.assign(CONFIG.grade, { hue: 0, sat: .97, temp: .06, tint: 0 });
      }
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);

rep(MAIN, `        uWatershedReflection: { value: CONFIG.watershedWater.reflection },`,
`        uWatershedReflection: { value: CONFIG.watershedWater.reflection },
        /* MARITIME water: uMarOn.x the banner's sea, .y the rivers. Colours from applyConfig, the
           rivers' sky from the canyon sky every frame. */
        uMarOn: { value: new THREE.Vector2(0, 0) },
        uMarDeep: { value: new THREE.Vector3() }, uMarMid: { value: new THREE.Vector3() }, uMarBed: { value: new THREE.Vector3() },
        uMarFoam: { value: new THREE.Vector3(1, 1, 1) },
        uMarSkyZenith: { value: new THREE.Vector3(.4, .45, .5) }, uMarSkyHorizon: { value: new THREE.Vector3(.75, .76, .72) },
        uMarSun: { value: new THREE.Vector4(-.494, .676, -.546, 0) }, uMarReflect: { value: 1 },`);

rep(MAIN, `    uniform float uWatershedReflection;`,
`    uniform float uWatershedReflection;
    uniform vec2 uMarOn;
    uniform vec3 uMarDeep,uMarMid,uMarBed,uMarFoam,uMarSkyZenith,uMarSkyHorizon;
    uniform vec4 uMarSun;
    uniform float uMarReflect;`);

rep(MAIN, `      vec3 col=montisChrome(nrm,V,vFlow+uSeaCurrent*.35,curv,rough,mask,1.,0.);
      /* The lift. Toward white rather than to it, and modulated by the same
         speckle that roughened it, so the froth keeps the plate's blue and
         never punches a flat sheet out of the picture. */
      if(foam>.002)col=mix(col,mix(col,vec3(1.),.58)*froth,foam);`,
`      vec3 col=montisChrome(nrm,V,vFlow+uSeaCurrent*.35,curv,rough,mask,1.,0.);
      /* MARITIME: water, not metal. A dielectric Fresnel (F0 .02) over a deep navy body that
         lightens a little toward grazing, the sky in the reflection (the banner's own room, now
         an overcast sky; the canyon's sky on the rivers), roughness flattening the Fresnel the
         way a ruffled surface does, and a soft sun glint. */
      float marOn=mix(uMarOn.x,uMarOn.y,uRiverSurface);
      if(marOn>.001){
        vec3 mR=reflect(-V,nrm);
        float mRy=clamp(mR.y,0.,1.);
        vec3 mSky=uRiverSurface>.5?mix(uMarSkyHorizon,uMarSkyZenith,pow(mRy,.47)):montisEnv(mR,clamp(rough*1.6,0.,1.),uBandGain,0.);
        float mCos=clamp(dot(nrm,V),0.,1.);
        float mF=.02+.98*pow(1.-mCos,5.);
        mF=mix(mF,.05+mF*.6,clamp(rough*2.5,0.,1.));
        vec3 mBody=mix(uMarDeep,uMarMid,pow(1.-mCos,2.)*.75);
        vec3 mw=mix(mBody,mSky,clamp(mF*uMarReflect,0.,1.));
        vec3 mH=normalize(uMarSun.xyz+V);
        mw+=uMarSkyHorizon*pow(max(dot(nrm,mH),0.),mix(900.,70.,clamp(rough*3.,0.,1.)))*uMarSun.w;
        col=mix(col,mw,marOn);
      }
      /* The lift. Toward white rather than to it, and modulated by the same
         speckle that roughened it, so the froth keeps the plate's blue and
         never punches a flat sheet out of the picture. */
      if(foam>.002)col=mix(col,mix(mix(col,vec3(1.),.58),uMarFoam,marOn)*froth,foam);`);

rep(MAIN, `      if(hz>.001)col=mix(col,montisEnv(view,.05,uBandGain,0.),hz);`,
`      if(hz>.001)col=mix(col,mix(montisEnv(view,.05,uBandGain,0.),uRiverFogColor,uRiverSurface*marOn),hz);`);

rep(MAIN, `        vec3 bedTint=mix(uShoreBedColor,uWatershedHighlight,.30);`,
`        vec3 bedTint=mix(mix(uShoreBedColor,uWatershedHighlight,.30),uMarBed,marOn);`);
rep(MAIN, `        float foamAmt=uShore.x*vis*(hug*lace+trail)*(1.-.88*aer);`,
`        float foamAmt=uShore.x*vis*(hug*lace+trail)*(1.-.88*aer*(1.-.6*marOn));`);
rep(MAIN, `        float lift=uShoreTone.x*(1.-smoothstep(.16,.52,waterL))*vis*(.28+.42*nearBank)*(1.-.5*aer);`,
`        float lift=uShoreTone.x*(1.-smoothstep(.16,.52,waterL))*vis*(.28+.42*nearBank)*(1.-.5*aer)*(1.-.85*marOn);`);

rep(MAIN, `        seaUniforms.uBandGain.value = F.bandGain;`,
`        seaUniforms.uBandGain.value = F.bandGain;
        {
          /* MARITIME water colours, light colour and the veil's tint. */
          const MR = CONFIG.maritime, on = THREE.MathUtils.clamp(+MR.on || 0, 0, 1);
          seaUniforms.uMarOn.value.set(on * THREE.MathUtils.clamp(+MR.heroSea || 0, 0, 1), on);
          paletteLinear(MR.deep, seaUniforms.uMarDeep.value);
          paletteLinear(MR.mid, seaUniforms.uMarMid.value);
          paletteLinear(MR.bed, seaUniforms.uMarBed.value);
          paletteLinear(MR.foam, seaUniforms.uMarFoam.value);
          seaUniforms.uMarSun.value.w = +MR.glint || 0;
          seaUniforms.uMarReflect.value = +MR.reflect || 0;
          montisEnvUniforms.uEnvGlow.value.set(...(on ? [1.02, 1.01, .97] : [1, 1.03, 1.10]));
          montisVeilUniforms.uVeilTint.value.set(...(on ? [.56, .56, .57] : [.48, .56, .74]));
          document.documentElement.dataset.look = on ? 'maritime' : 'original';
        }`);

rep(MAIN, `        seaUniforms.uRiverFogColor.value.copy(canyon.scene.fog.color);`,
`        seaUniforms.uRiverFogColor.value.copy(canyon.scene.fog.color);
        if (CONFIG.maritime.on) {
          /* The rivers mirror the canyon's own sky. */
          maritimeSky ??= canyon.scene.children.find(o => o.material?.uniforms?.zenith)?.material || null;
          if (maritimeSky) {
            const z = maritimeSky.uniforms.zenith.value, h = maritimeSky.uniforms.horizon.value;
            seaUniforms.uMarSkyZenith.value.set(z.r, z.g, z.b); seaUniforms.uMarSkyHorizon.value.set(h.r, h.g, h.b);
          }
        }`);
rep(MAIN, `      const seaUniforms = Object.assign({`, `      let maritimeSky = null;
      const seaUniforms = Object.assign({`);

rep(MAIN, `logoTerrain: CONFIG.logoTerrain, lite: DROPLET_LITE,`, `logoTerrain: CONFIG.logoTerrain, maritime: CONFIG.maritime, lite: DROPLET_LITE,`);

rep(MAIN, `          ['山景色調', [`,
`          ['寫實山海 Maritime', [
            ['開啟（0＝原樣）', 'maritime', 'on', 0, 1, 1],
            ['開場海面也是水', 'maritime', 'heroSea', 0, 1, 1],
            ['天頂', 'maritime', 'skyZenith'], ['地平線', 'maritime', 'skyHorizon'],
            ['遠霧（谷中）', 'maritime', 'fog'], ['遠霧（空拍）', 'maritime', 'aerialFog'],
            ['日光色', 'maritime', 'sun'], ['日光（谷中）', 'maritime', 'sunDay', 0, 5, .05], ['日光（空拍）', 'maritime', 'sunAerial', 0, 5, .05],
            ['天光色', 'maritime', 'hemiSky'], ['地面反光色', 'maritime', 'hemiGround'],
            ['天光（谷中）', 'maritime', 'hemiDay', 0, 4, .05], ['天光（空拍）', 'maritime', 'hemiAerial', 0, 4, .05],
            ['逆光邊色', 'maritime', 'rim'], ['逆光（谷中）', 'maritime', 'rimDay', 0, 3, .05], ['逆光（空拍）', 'maritime', 'rimAerial', 0, 3, .05],
            ['環境光', 'maritime', 'ibl', 0, 1.5, .01],
            ['岩石', 'maritime', 'rock'], ['冷灰岩', 'maritime', 'rockCool'], ['赭色岩紋', 'maritime', 'rockWarm'],
            ['赭色沖蝕紋', 'maritime', 'streak', 0, 1.5, .01],
            ['植被', 'maritime', 'veg'], ['植被量', 'maritime', 'vegAmount', 0, 1.5, .01], ['植被線高度', 'maritime', 'vegLine', 0, 2000, 10],
            ['稜線淺岩色', 'maritime', 'frost'], ['明暗基準', 'maritime', 'refL', .04, .4, .005],
            ['深水', 'maritime', 'deep'], ['中景水色', 'maritime', 'mid'], ['淺水河床', 'maritime', 'bed'], ['浪花', 'maritime', 'foam'],
            ['天空倒影', 'maritime', 'reflect', 0, 1.5, .01], ['日光閃點', 'maritime', 'glint', 0, 2, .01]
          ]],
          ['山景色調', [`);
rep(MAIN, `const logoGroupOrder = ['山體建模',`, `const logoGroupOrder = ['寫實山海 Maritime', '山體建模',`);

/* ============================ scene ============================ */
rep(SCN, `logoTerrain = null, lite =`, `logoTerrain = null, maritime = null, lite =`);
rep(SCN, `    uIceExposure: { value: 1 }, uIceHaze: { value: 1 }, uIceRelief: { value: 1 }
  };`,
`    uIceExposure: { value: 1 }, uIceHaze: { value: 1 }, uIceRelief: { value: 1 },
    // MARITIME (test build): natural rock and ground, live from CONFIG.maritime.
    uMaritime: { value: 0 }, uMarRock: { value: new THREE.Color() }, uMarRockCool: { value: new THREE.Color() }, uMarRockWarm: { value: new THREE.Color() },
    uMarVeg: { value: new THREE.Color() }, uMarVegAmt: { value: 0 }, uMarVegLine: { value: 520 }, uMarStreak: { value: 0 }, uMarRefL: { value: .13 }
  };`);
rep(SCN, `uniform float uOverview,uIcePalette,uIceExposure,uIceHaze,uIceRelief; uniform vec3 uIceRockTint;`,
`uniform float uOverview,uIcePalette,uIceExposure,uIceHaze,uIceRelief; uniform vec3 uIceRockTint;
      uniform float uMaritime,uMarVegAmt,uMarVegLine,uMarStreak,uMarRefL; uniform vec3 uMarRock,uMarRockCool,uMarRockWarm,uMarVeg;`);
rep(SCN, "`#include <color_fragment>\n      float rockLarge=rockNoise(vRockWorld*.085);",
  "`#include <color_fragment>\n      vec3 marBase=diffuseColor.rgb;\n      float rockLarge=rockNoise(vRockWorld*.085);");
rep(SCN, `      iceSlate*=max(.40,1.+(erosion-1.)*uIceRelief)*uIceExposure;
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(blueSlate,iceSlate,uIcePalette),uOverview);`,
`      iceSlate*=max(.40,1.+(erosion-1.)*uIceRelief)*uIceExposure;
      // ---- MARITIME: natural rock and scrub; the baked tone keeps only its brightness ----
      if(uMaritime>.001){
        vec3 mL=vec3(.2126,.7152,.0722);
        float mTone=clamp(sqrt(dot(marBase,mL)/uMarRefL),.55,1.30);
        float mMod=dot(diffuseColor.rgb,mL)/max(dot(marBase,mL),1e-4);
        vec3 mN=normalize((vec4(vNormal,0.)*viewMatrix).xyz);
        float mSteep=1.-mN.y;
        float mHue=rockNoise(vRockWorld*vec3(.0042,.0061,.0042)+17.)*.65+rockNoise(vRockWorld*.017+3.)*.35;
        vec3 mRock=mix(uMarRockCool,uMarRock,smoothstep(.30,.70,mHue));
        float mOchre=smoothstep(.55,.85,strata)*smoothstep(.25,.6,mSteep)*(.55+.45*rockLarge);
        mRock=mix(mRock,uMarRockWarm,clamp(mOchre*uMarStreak,0.,1.));
        float mVegN=rockNoise(vRockWorld*vec3(.012,.02,.012)+41.)*.6+rockNoise(vRockWorld*.05+7.)*.4;
        float mVegLine=uMarVegLine*(1.+(mVegN-.5)*.6);
        float mVeg=smoothstep(.40,.22,mSteep)*(1.-smoothstep(mVegLine*.75,mVegLine,vRockWorld.y))*smoothstep(3.5,9.,vRockWorld.y)*smoothstep(.30,.62,mVegN);
        mRock=mix(mRock,uMarVeg*(.85+.3*mVegN),clamp(mVeg*uMarVegAmt,0.,1.));
        diffuseColor.rgb=mix(diffuseColor.rgb,mRock*mTone*mMod,uMaritime);
        blueSlate=mix(blueSlate,diffuseColor.rgb,uMaritime);
        iceSlate=mix(iceSlate,diffuseColor.rgb,uMaritime);
      }
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(blueSlate,iceSlate,uIcePalette),uOverview);`);
rep(SCN, `diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.50,.58,.65),wetBand*.78*uShoreWet);`,
  `diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*mix(vec3(.50,.58,.65),vec3(.55,.53,.50),uMaritime),wetBand*.78*uShoreWet);`);
rep(SCN, `      diffuseColor.rgb*=1.-uReliefErosion*(groove*.16-clamp(ero,0.,1.)*.05);`,
`      diffuseColor.rgb*=1.-uReliefErosion*(groove*.16-clamp(ero,0.,1.)*.05);
      // MARITIME: the erosion ribs on steep faces carry the warm ochre stain.
      diffuseColor.rgb*=mix(vec3(1.),vec3(1.14,1.02,.84),clamp(clamp(ero,0.,1.)*steep*uMarStreak,0.,1.)*uMaritime);`);
rep(SCN, `  const iceSun=new THREE.Color('#e8edf1'),iceHemi=new THREE.Color('#c9d7e3'),iceGround=new THREE.Color('#60717e');`,
`  const iceSun=new THREE.Color('#e8edf1'),iceHemi=new THREE.Color('#c9d7e3'),iceGround=new THREE.Color('#60717e');
  const marFogA=new THREE.Color(),marFogB=new THREE.Color();`);
rep(SCN, `    scene.background.copy(dayFog).lerp(watershedStyle?iceZenith:nightZenith,mountainLight);`,
`    scene.background.copy(dayFog).lerp(watershedStyle?iceZenith:nightZenith,mountainLight);
    // MARITIME (test build): one overcast light and sky over the canyon and the aerial alike.
    if(maritime&&+maritime.on>0){
      const M=maritime,k=mountainLight,num=(key,f)=>{const v=Number(M[key]);return Number.isFinite(v)?v:f;};
      atmosphere.uMaritime.value=THREE.MathUtils.clamp(num('on',0),0,1);
      atmosphere.uMarRock.value.set(M.rock);atmosphere.uMarRockCool.value.set(M.rockCool);atmosphere.uMarRockWarm.value.set(M.rockWarm);
      atmosphere.uMarVeg.value.set(M.veg);atmosphere.uMarVegAmt.value=num('vegAmount',0);atmosphere.uMarVegLine.value=num('vegLine',520);
      atmosphere.uMarStreak.value=num('streak',0);atmosphere.uMarRefL.value=Math.max(.01,num('refL',.13));
      hemisphere.intensity=THREE.MathUtils.lerp(num('hemiDay',1.5),num('hemiAerial',.75),k);
      hemisphere.color.set(M.hemiSky);hemisphere.groundColor.set(M.hemiGround);
      sunlight.intensity=THREE.MathUtils.lerp(num('sunDay',2.3),num('sunAerial',2.1),k);sunlight.color.set(M.sun);
      rim.intensity=THREE.MathUtils.lerp(num('rimDay',.55),num('rimAerial',.35),k);rim.color.set(M.rim);
      sky.material.uniforms.zenith.value.set(M.skyZenith);sky.material.uniforms.horizon.value.set(M.skyHorizon);
      marFogA.set(M.fog);marFogB.set(M.aerialFog);scene.fog.color.copy(marFogA).lerp(marFogB,k);
      scene.background.copy(scene.fog.color);
      scene.environmentIntensity=num('ibl',.55);
      if(shore)shoreUniforms.uFrostColor.value.set(M.frost);
    } else { atmosphere.uMaritime.value=0; scene.environmentIntensity=1; }`);

for (const [f, s] of Object.entries(files)) fs.writeFileSync(path.join(DIR, f), s);
console.log('patched', Object.keys(files).join(', '));
