/* index1-5 · 開場世界 Opening world (2026-10-23, visual director). Client: 「山谷那段為主，幫我整體的色調設計風格都調整跟山谷一樣」.
   Chapters 1–2 move into the valley's world: same sky, same sun (the room's core light, aligned with the valley's sun through the
   cross-fade), same air (haze, warm motes and glints), a distant range on the horizon sampled inside montisEnv(), the sea tinted
   toward the valley's glacier water, deeper darks with the eye-level haze kept bright. Camera and framing are NOT changed;
   ?opencam=valley swaps in the valley's camera grammar (FOV 44°, eye 2.4, horizon ≈52%) for review only.
   Run by build.cjs after opening-drops / letters-entrance / logo-look, before user-preset. The canyon's river keeps its own
   room, sun direction and glint colour (its uniforms are split off here), so nothing from chapter 3 on changes.
   Live code: opening-world.js (shipped as js/opening-world.js); band: assets/opening-range.webp (opening-range-make.cjs). */
const fs = require('fs'), path = require('path');
module.exports = ({ main, drops, letters, glass, html }) => {
  const once = (source, anchor, replacement, label) => {
    const n = source.split(anchor).length - 1;
    if (n !== 1) throw new Error('index1-5 opening-world anchor (' + label + '): ' + n + ' × ' + anchor.slice(0, 90));
    return source.replace(anchor, () => replacement);
  };

  /* ---- import ---- */
  main = once(main, "    import * as THREE from 'three';\n", "    import * as THREE from 'three';\n    import { createOpeningWorld, OPENING_WORLD_DEFAULTS, OPENING_WORLD_ROWS, OPENING_RANGE_BLANK } from './opening-world.js';\n    import { createOpeningPortal, OPENING_PORTAL_DEFAULTS, OPENING_PORTAL_ROWS } from './opening-portal.js';\n", 'import');

  /* ---- the room's new uniforms (shared by reference with the backdrop, the probe, the opening sea and every drop) ---- */
  main = once(main, '        uEnvKey: { value: new THREE.Vector3(1.6, 34., .71) }\n      };', `        uEnvKey: { value: new THREE.Vector3(1.6, 34., .71) },
        /* 開場世界：太陽色（乘在光核上，0 = 原本的白光）、遠山帶（貼圖＋兩組參數）、湖面色調。 */
        uEnvSunTint: { value: new THREE.Vector3() },
        uEnvSunDisc: { value: new THREE.Vector4() },
        uEnvRangeTex: { value: OPENING_RANGE_BLANK },
        uEnvRangeA: { value: new THREE.Vector4() },
        uEnvRangeB: { value: new THREE.Vector4(-.035, .15, 1, .6) },
        uOpenSeaTint: { value: new THREE.Vector4() }
      };`, 'env uniforms');

  /* ---- GLSL: declarations, the range band before the core, the sun's colour on the core ---- */
  main = once(main, 'uniform vec3 uEnvCardDir,uEnvDropInk,uEnvKeyDir,uEnvKey;', 'uniform vec3 uEnvCardDir,uEnvDropInk,uEnvKeyDir,uEnvKey;\nuniform vec3 uEnvSunTint;\nuniform sampler2D uEnvRangeTex;\nuniform vec4 uEnvRangeA,uEnvRangeB,uEnvSunDisc;', 'glsl decl');
  /* A: x opacity, y haze, z tan(half width), w centre azimuth (rad). B: x base elevation (rad), y height (rad), z 1/exposure, w blur.
     Azimuth 0 = straight ahead (−Z), negative = left, as ALPINE_LIGHT. The band is a perspective strip, hence the tan(). */
  main = once(main, '  float k=max(dot(d,uEnvCoreDir),0.);', `  /* 開場世界：遠山帶（山谷自己的畫面烘成的條帶，見 opening-world.js）。背景畫它、海面倒映它、水珠反射它、探針也烘進去。 */
  float rangeSunMask=1.;
  if(uEnvRangeA.x>0.){
    float rAz=atan(d.x,-d.z)-uEnvRangeA.w;
    float rV=(asin(clamp(d.y,-1.,1.))-uEnvRangeB.x)/uEnvRangeB.y;
    if(rV>0.&&rV<1.&&abs(rAz)<1.4){
      float rU=.5+.5*tan(rAz)/uEnvRangeA.z;
      if(rU>0.&&rU<1.){
        /* One opaque texture: colour in the top half, alpha (grey) in the bottom half (see opening-range-make.cjs). The
           colour is pre-mixed toward the haze #cbd8e6 where the band is clear, so the exact 'over' is
           colour + (sky − haze)·(1 − alpha); then aerial perspective toward the sky behind it, more at the foot. */
        float rRow=(1.-rV)*.484375,rBias=uEnvRangeB.w+b*22.;
        vec3 rTex=pow(texture2D(uEnvRangeTex,vec2(rU,1.-rRow),rBias).rgb,vec3(2.2));
        float rA=texture2D(uEnvRangeTex,vec2(rU,.484375-rRow),rBias).r;
        rangeSunMask=1.-rA*uEnvRangeA.x;
        vec3 rHz=vec3(.6062,.6941,.7972)*uEnvRangeB.z;
        vec3 rc=rTex*uEnvRangeB.z+(c-rHz)*(1.-rA);
        rc=mix(rc,c,uEnvRangeA.y*(1.-.45*rV)*rA);
        c=mix(c,rc,uEnvRangeA.x);
      }
    }
  }
  float k=max(dot(d,uEnvCoreDir),0.);`, 'glsl range');
  main = once(main, '  return c+uEnvGlow*g;', `  /* 開場世界：太陽（光核＋小而燙的圓盤），加上貼地平線、朝太陽那側的金色天光（黃金時刻的地平線）。 */
  vec2 sunH=normalize(uEnvCoreDir.xz+vec2(1e-5)),dirH=d.xz/max(length(d.xz),1e-4);
  float gold=uEnvSunDisc.z*pow(max(dot(dirH,sunH),0.),5.)*exp(-abs(d.y)*uEnvSunDisc.w);
  float sunUp=smoothstep(-.04,.015,uEnvCoreDir.y);
  float sunRadius=clamp(sqrt(2./max(uEnvSunDisc.y,1.)),.002,.03),sunEdge=max(fwidth(k)*1.3,2e-6);
  // Rivers disable the solar disc with zero uniforms. Never evaluate pow(0,0):
  // its undefined result contaminates reflections even when multiplied by zero.
  float solarDisc=0.;
  if(uEnvSunDisc.x>0.){
    solarDisc=mix(pow(k,max(uEnvSunDisc.y*sharp,1e-4)),smoothstep(cos(sunRadius)-sunEdge,cos(sunRadius)+sunEdge,k),1.-smoothstep(.025,.09,b));
  }
  return c+uEnvGlow*(1.+uEnvSunTint)*((g+uEnvSunDisc.x*solarDisc)*rangeSunMask+gold)*sunUp;`, 'glsl sun');

  /* ---- the opening sea toward the valley's glacier water (luminance kept; highlights keep their own colour; never the river) ---- */
  main = once(main, 'fragmentShader: MONTIS_ENV_GLSL + MONTIS_CHROME_GLSL + MONTIS_VEIL_GLSL + MONTIS_DITHER_GLSL + RIPPLE_GLSL + `', 'fragmentShader: MONTIS_ENV_GLSL + MONTIS_CHROME_GLSL + MONTIS_VEIL_GLSL + MONTIS_DITHER_GLSL + RIPPLE_GLSL + `\n    uniform vec4 uOpenSeaTint;', 'sea decl');
  main = once(main, '      gl_FragColor=vec4(max(col,vec3(0.)),1.);', `      {
        float tk=uOpenSeaTint.a*(1.-uRiverSurface);
        if(tk>0.){
          float ty=dot(col,vec3(.2126,.7152,.0722));
          vec3 tc=uOpenSeaTint.rgb/max(dot(uOpenSeaTint.rgb,vec3(.2126,.7152,.0722)),1e-3);
          col=mix(col,ty*tc,tk*(1.-smoothstep(.55,1.3,ty)));
        }
      }
      gl_FragColor=vec4(max(col,vec3(0.)),1.);`, 'sea tint');

  /* ---- the canyon's river keeps its sun direction, glint colour, white core and no band ---- */
  main = once(main, '      seaUniforms.uEnvCore = { value: new THREE.Vector4() };', `      seaUniforms.uEnvCore = { value: new THREE.Vector4() };
      /* 開場世界只換開場：峽谷的河保留原本的光核方向、反光色、白色光核，也不畫遠山帶。 */
      seaUniforms.uEnvCoreDir = { value: montisEnvUniforms.uEnvCoreDir.value.clone() };
      seaUniforms.uEnvGlow = { value: montisEnvUniforms.uEnvGlow.value.clone() };
      seaUniforms.uEnvSunTint = { value: new THREE.Vector3() };
      seaUniforms.uEnvSunDisc = { value: new THREE.Vector4() };
      seaUniforms.uEnvRangeA = { value: new THREE.Vector4() };`, 'river split');

  /* ---- ?opencam=valley: the valley's camera grammar, for review only ---- */
  main = once(main, '      const frameTier = () =>', `      /* ?opencam=valley：開場改用山谷的鏡頭語言（FOV 44°、眼高 2.4、地平線約 52%），只給客戶比較，不是預設。 */
      const OPENCAM_VALLEY = new URLSearchParams(location.search).get('opencam') === 'valley';
      if (OPENCAM_VALLEY) {
        Object.assign(FRAME_TIERS.wide, { fov: 44, ty: 2.7, dropY: 4.6 });
        Object.assign(FRAME_TIERS.tall, { fov: 50, ty: 2.85, dropY: 5.0 });
        Object.assign(FRAME_TIERS.phone, { fov: 58, ty: 3.0, dropY: 5.4 });
      }
      const frameTier = () =>`, 'opencam tiers');

  /* ---- values (before DEFAULT_CONFIG, so 還原 returns to them) ---- */
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* ==== 開場世界 Opening world（opening-world-build.cjs，2026-10-23 視覺總監）====
         山谷為主：房間＝山谷的天（上緣深鈷藍、眼高處山谷的霧色）、湖面倒影帶冰河水的青藍、暗部真的暗。
         第四輪（2026-10-24，客戶同意開場變暗、更接近山谷）：中位明度 69 → 約 55，霧帶與太陽光暈收窄。
         峽谷的河在上面已經另存它自己的房間，不受影響。 */
      Object.assign(CONFIG.field, { zenith: '#1d4580', upper: '#33629d', top: '#22508c', horizon: '#a9bcd1', lower: '#3f6273', floor: '#08192a', ink: '#050d18', core: .5, coreSpread: .6 });
      CONFIG.openingWorld = { ...OPENING_WORLD_DEFAULTS };
      CONFIG.openingPortal = { ...OPENING_PORTAL_DEFAULTS };
      CONFIG.openingDrops.veil = .14;
      CONFIG.details.waterGlints = .18;
      if (OPENCAM_VALLEY) { CONFIG.camera.y = 2.4; CONFIG.sea.screenDown = 0; }
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'defaults');

  /* ---- create (after the lights and the motes exist) ---- */
  main = once(main, '      airMotes.renderOrder = 4;\n      scene.add(airMotes);', `      airMotes.renderOrder = 4;
      scene.add(airMotes);
      const openingWorld = createOpeningWorld({
        uniforms: montisEnvUniforms, config: CONFIG, renderer, keyLight, hemiLight, airMotes, waterGlints,
        rebake: () => queueEnvBake(), rangeUrl: new URL('../assets/opening-range.webp?v=${require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'assets/opening-range.webp'))).digest('hex').slice(0,12)}', import.meta.url).href
      });
      /* 一鏡到底：峽谷在「切換那一格」的畫面先烘成 2.5-D 卡片放進開場，鏡頭飛進去，到切換點兩個畫面本來就一樣。 */
      const openingPortal = createOpeningPortal({ renderer, scene, config: CONFIG, envUniforms: montisEnvUniforms, veilUniforms: montisVeilUniforms, envGlsl: MONTIS_ENV_GLSL + MONTIS_VEIL_GLSL, bandGain: backdropUniforms.uBandGain, sea, seaMaterial: openingSeaMaterial, riverUniforms: seaUniforms });
      function openingPortalPose() {
        const P = CONFIG.openingPortal, SEA = CONFIG.sea;
        const pClock = journeyClock(logoChapterEnd() + P.cut * forwardLength());
        /* the river as it will be after the cut: river waves, no froth, no hero in the water */
        writeSeaWaves(2.6, 1, 1, 0, 1, SEA.round);
        seaUniforms.uFoam.value.x = 0; seaUniforms.uHeroOn.value = 0; seaUniforms.uDropOcclude.value = 0;
        canyon.scene.environment = scene.environment;
        canyon.update(THREE.MathUtils.clamp((pClock - 1.404) / (8 - 1.404), 0, 1), sceneTime, false, 0, 0);
      }`, 'create');

  /* ---- applyConfig: colours, sun, band, tint, lights; then the probe re-bakes as before ---- */
  main = once(main, '        syncRiverRoom();\n        queueEnvBake();', '        syncRiverRoom();\n        openingWorld.apply();\n        queueEnvBake();', 'applyConfig');

  /* ---- every frame: the band's base on the visible sea line, the sun's hand-over to the valley's sun ---- */
  main = once(main, '        updateJourneyCamera(time);\n', `        /* bake once the valley is ready, on a calm frame (or regardless when the hand-off is near) */
        if (journeyReady && !reduceMotion && openingPortal.wanted() && (Math.abs(journey.velocity || 0) < .03 || journey.progress > logoChapterEnd() - .5)) openingPortal.render({ canyon, pose: openingPortalPose });
        updateJourneyCamera(time);
        {
          const portalNow = openingPortal.update({ camera, handoff: THREE.MathUtils.clamp((journey.progress - logoChapterEnd()) / forwardLength(), 0, 1), reducedMotion: reduceMotion });
          openingWorld.update({ camera, canyon, mix: journey.mix, screenDown: CONFIG.sea.screenDown * (1 - portalNow.riverness), portal: openingPortal });
        }
`, 'frame');
  /* ---- the scene swap is a single frame at the cut (reduced motion / not baked yet: the old cross-fade) ---- */
  main = once(main, '        J.mix = CONFIG.logo.dolly > .5 && !reduceMotion ? easeJourney((handoff - .56) / .30) : easeJourney(handoff); J.impact = 0;',
    '        const portalMix = openingPortal.mix(handoff, reduceMotion);\n        J.mix = portalMix ?? (CONFIG.logo.dolly > .5 && !reduceMotion ? easeJourney((handoff - .56) / .30) : easeJourney(handoff)); J.impact = 0;', 'portal mix');
  /* ---- the lake calms into the river on the way in; its screen offset goes, so the water meets the card's river ---- */
  main = once(main, '        const toRiver = THREE.MathUtils.clamp(journey.mix, 0, 1) * SEA.river;', '        const toRiver = THREE.MathUtils.clamp(Math.max(journey.mix, openingPortal.state.riverness), 0, 1) * SEA.river;', 'portal river');
  main = once(main, '        surfaceScreenOffset.value = 2 * CONFIG.sea.screenDown / Math.max(1, innerHeight);', '        surfaceScreenOffset.value = 2 * CONFIG.sea.screenDown * (1 - openingPortal.state.riverness) / Math.max(1, innerHeight);', 'portal offset');
  /* ---- the zoom's focus follows the flight; the valley's speed blur and lean ease in after the cut ---- */
  main = once(main, '          centerX: logoFlight.cx, centerY: logoFlight.cy, mix: journey.mix,', '          centerX: logoFlight.cx, centerY: logoFlight.cy, mix: openingPortal.fxMix(journey.mix),', 'portal fx');
  main = once(main, '        const flowAmount = journey.mix * (1 - easeJourney((p - 6.1) / .7));', '        const flowAmount = journey.mix * openingPortal.state.motionIn * (1 - easeJourney((p - 6.1) / .7));', 'portal motion');

  /* ---- light motes: the valley's dust, warm, a little more of it ---- */
  main = once(main, 'airMotes.material.uniforms.uOpacity.value = .30 * (1 - J.mix);', 'airMotes.material.uniforms.uOpacity.value = CONFIG.openingWorld.motes * (1 - J.mix);', 'motes');

  /* ---- dials ---- */
  main = once(main, "          ['卡牌轉場 Cards', [", `          ['開場世界 Opening', OPENING_WORLD_ROWS],
          ['一鏡到底 Opening → Valley', OPENING_PORTAL_ROWS],
          ['卡牌轉場 Cards', [`, 'tuner');

  const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n');
  const extra = { 'opening-world.js': read('opening-world.js'), 'opening-portal.js': read('opening-portal.js') };
  return { main, drops, letters, glass, html, extra };
};
