/* index1-5 only: the opening's look (2026-10-23 client note 「第一二區塊要亮一點 … 第二塊這水滴，我要跟第一塊的水滴一樣，
   第一塊水滴要再圓弧一點」).
   1. A brighter room for chapters 1–2 (KNOWLEDGE / INNOVATION): the field palette the backdrop, the sea and every
      drop mirror, and a lighter camera veil on the top edge and corners.
   2. The LOGO helix's drops and its loose beads wear the hero's metal: the same montisChrome against the same room
      as chapter 1's burst (dropChromeUniforms + montisEnvUniforms, shared by reference — no extra pass).
   3. The hero is a near-perfect sphere: the surface wave is a ripple, not lobes; it keeps breathing.
   Run by build.cjs after every other helper. Look only: no timing or choreography is touched. */
module.exports = ({ main, drops, letters, glass, html }) => {
  const once = (source, anchor, replacement, label) => {
    const n = source.split(anchor).length - 1;
    if (n !== 1) throw new Error('index1-5 opening-drops anchor (' + label + '): ' + n + ' × ' + anchor.slice(0, 90));
    return source.replace(anchor, () => replacement);
  };

  /* ---- main: values (before DEFAULT_CONFIG, so RESET returns to them) ---- */
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* 峽谷的河用同一支海面材質、照同一個房間：它留著提亮之前的房間（下面 river room），所以第三塊以後不變。 */
      const OPENING_RIVER_ROOM = { ...CONFIG.field }, OPENING_RIVER_VEIL = .14;
      /* 開場亮一點（客戶 2026-10-23）：房間（背景、海面、每顆水珠倒映的都是它）整組提亮，畫面上緣與四角的壓暗放輕。 */
      Object.assign(CONFIG.field,{zenith:'#e2ebf0',upper:'#edf3f6',top:'#5a7a93',horizon:'#d6e1e7',lower:'#9db1bd',floor:'#557489',ink:'#30506a',core:1.3,coreSpread:.8});
      /* VEIL：上緣與四角壓暗後剩下的亮度（原本 .14；1 = 不壓）。 */
      CONFIG.openingDrops={veil:.45};
      /* 英雄水珠要圓：表面的波從「瓣」降成漣漪（波幅 .075 → .02），呼吸照舊，所以還是活的。 */
      Object.assign(CONFIG.distortion,{waveAmplitude:.02,breathing:.038});
      /* 光斑（Codrops 的雜訊高光）減半：滿量時它在球面上留下一塊塊不規則的亮斑，讀起來像凹痕；.5 仍留著那層會走動的光。 */
      CONFIG.droplet.sheen=.5;
      /* 第二塊的水滴穿上第一塊的金屬：CHROME 1 = 完全是英雄水珠那一層鏡面（同一個房間、同一組 F0／虹彩），
         CARD 黑卡、BAND 光帶、ROUGH 鏡面粗糙、RIM 邊光（RIM EDGE 銳利）、LENS 透光亮核（LENS EDGE 收斂）。
         取第一塊散開（1.12）時近距離珠子的值：card .22／rough .012／rim 1；光帶 .35、亮核 .9（散開時是 .86／1.05）——
         光帶太滿，珠子下半會是一圈深色的碗，比英雄水珠暗；.35 讓它和英雄一樣淡、亮，還留一道光環。
         WOBBLE .058 → .015、BEAD LUMP .3 → .1：第一塊的水珠是圓的，這裡的也要圓（蠕動還在，只是小）。 */
      Object.assign(CONFIG.logoDrops,{chromeLook:1,chromeCard:.22,chromeBand:.35,chromeRough:.012,chromeRim:1,chromeRimEdge:12,chromeLens:.9,chromeLensEdge:3.4,wobble:.015,beadLump:.1,beadBig0:1,beadBig1:1,beadBig2:1,beadBig3:1});
      /* 螺旋水滴不要像一排印出來的珍珠（客戶 2026-10-24）：每顆水滴金屬比例不同（大顆像英雄水珠、小顆是清水）、倒映的房間各自
         轉一點、太陽那側一條暖邊和一個跟著水滴走的亮點、比字標近的失焦、比字標遠的沉進空氣。 */
      Object.assign(CONFIG.logoDrops,{swirlMetal:.42,swirlMetalVar:.26,swirlEnvTurn:1.1,swirlSunRim:.55,swirlSunGlint:2,swirlDefocus:.9,swirlHaze:.4,swirlRefract:1,swirlGloss:.2});
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'defaults');

  /* ---- main: the helix gets the room and the hero's metal, by reference ---- */
  main = once(main, 'renderer, config: CONFIG.logoDrops, env: logoGlass.uniforms, lite: DROPLET_LITE, deferTextures: true, progressiveTextures: true,',
    'renderer, config: CONFIG.logoDrops, env: logoGlass.uniforms, lite: DROPLET_LITE, deferTextures: true, progressiveTextures: true,\n        chrome: { glsl: MONTIS_ENV_GLSL + MONTIS_CHROME_GLSL, uniforms: { ...montisEnvUniforms, ...dropChromeUniforms } },', 'drops options');

  /* ---- main: the canyon's river keeps the room it had: its own copies of the room colours and the veil ----
     (the opening sea is a copy of seaUniforms made just above, so it keeps the shared, brighter ones) */
  main = once(main, '      const sea = new THREE.Mesh(createSeaGeometry(), openingSeaMaterial);', `      const RIVER_ROOM_KEYS = [['zenith', 'uEnvZenith'], ['upper', 'uEnvUpper'], ['top', 'uEnvField'], ['horizon', 'uEnvHorizon'], ['lower', 'uEnvLower'], ['floor', 'uEnvFloor'], ['ink', 'uEnvInk']];
      for (const [, name] of RIVER_ROOM_KEYS) seaUniforms[name] = { value: new THREE.Vector3() };
      seaUniforms.uEnvCore = { value: new THREE.Vector4() };
      seaUniforms.uVeil = { value: montisVeilUniforms.uVeil.value.clone().setX(OPENING_RIVER_VEIL) };
      function syncRiverRoom() {
        const F = OPENING_RIVER_ROOM;
        for (const [key, name] of RIVER_ROOM_KEYS) paletteLinear(F[key], seaUniforms[name].value);
        seaUniforms.uEnvCore.value.set(F.core, .30 * F.coreSpread, .115 * F.coreSpread, .030 * F.coreSpread);
      }
      syncRiverRoom();
      const sea = new THREE.Mesh(createSeaGeometry(), openingSeaMaterial);`, 'river room');

  /* ---- main: the veil is live; the river follows exposure ---- */
  main = once(main, '        queueEnvBake();', `        montisVeilUniforms.uVeil.value.x = THREE.MathUtils.clamp(CONFIG.openingDrops?.veil ?? .14, 0, 1);
        syncRiverRoom();
        queueEnvBake();`, 'applyConfig veil');

  /* ---- main: dials ---- */
  main = once(main, "          ['卡牌轉場 Cards', [", `          ['開場水滴 Drops', [
            ['房間 畫面上緣', 'field', 'top'], ['房間 地平線', 'field', 'horizon'], ['房間 海面倒影（下）', 'field', 'lower'],
            ['房間 海面倒影（底）', 'field', 'floor'], ['房間 墨色', 'field', 'ink'], ['水珠倒影 天頂', 'field', 'zenith'], ['水珠倒影 上方', 'field', 'upper'],
            ['核心亮度', 'field', 'core', 0, 6, .05], ['核心範圍', 'field', 'coreSpread', .2, 3, .02],
            ['四角壓暗（1 不壓）', 'openingDrops', 'veil', 0, 1, .01],
            ['英雄 波幅（小＝圓）', 'distortion', 'waveAmplitude', 0, .3, .001], ['英雄 呼吸', 'distortion', 'breathing', 0, .15, .001], ['英雄 光斑', 'droplet', 'sheen', 0, 2, .01],
            ['第二塊 金屬鏡面', 'logoDrops', 'chromeLook', 0, 1, .01], ['第二塊 黑卡', 'logoDrops', 'chromeCard', 0, 1.5, .01],
            ['第二塊 光帶', 'logoDrops', 'chromeBand', 0, 1, .01], ['第二塊 鏡面粗糙', 'logoDrops', 'chromeRough', 0, .3, .002],
            ['第二塊 邊光', 'logoDrops', 'chromeRim', 0, 2, .01], ['第二塊 邊光銳利', 'logoDrops', 'chromeRimEdge', 3, 30, .5],
            ['第二塊 透光亮核', 'logoDrops', 'chromeLens', 0, 2, .01], ['第二塊 亮核收斂', 'logoDrops', 'chromeLensEdge', 1, 14, .1],
            ['第二塊 表面蠕動', 'logoDrops', 'wobble', 0, .2, .001], ['散珠 不規則', 'logoDrops', 'beadLump', 0, 1, .01], ['散珠 大小 1（主角）', 'logoDrops', 'beadBig0', 0, 2, .01], ['散珠 大小 2', 'logoDrops', 'beadBig1', 0, 2, .01], ['散珠 大小 3', 'logoDrops', 'beadBig2', 0, 2, .01], ['散珠 大小 4', 'logoDrops', 'beadBig3', 0, 2, .01]
          ]],
          ['水滴 · 質感（螺旋）', [
            ['金屬比例（平均；1＝英雄水珠的鏡面）', 'logoDrops', 'swirlMetal', 0, 1, .01], ['金屬比例 每顆差異', 'logoDrops', 'swirlMetalVar', 0, .5, .01],
            ['倒影 每顆轉向（弧度）', 'logoDrops', 'swirlEnvTurn', 0, 1.6, .01],
            ['太陽暖邊', 'logoDrops', 'swirlSunRim', 0, 2, .01], ['太陽亮點', 'logoDrops', 'swirlSunGlint', 0, 4, .05],
            ['近處失焦', 'logoDrops', 'swirlDefocus', 0, 1, .01], ['遠處沉入空氣', 'logoDrops', 'swirlHaze', 0, 1, .01],
            ['透出真實世界（太陽、遠山）', 'logoDrops', 'swirlRefract', 0, 1, .01]
          ]],
          ['卡牌轉場 Cards', [`, 'tuner group');

  /* ---- drops: the hero's metal as a layer over the water ---- */
  drops = once(drops, 'export function createLogoDrops(THREE, { config, renderer, env, lite = false, onSplash = null, deferTextures = false, progressiveTextures = false, letters = null }) {',
    `export function createLogoDrops(THREE, { config, renderer, env, lite = false, onSplash = null, deferTextures = false, progressiveTextures = false, letters = null, chrome = null }) {
  if (!chrome) throw new Error('index1-5 logo drops: the opening chrome (montis room + metal) was not passed');
  /* x CHROME (0 water … 1 the hero's mirror), y CARD, z BAND, w ROUGH; edge: x RIM, y RIM EDGE, z LENS, w LENS EDGE. */
  const odUniforms = { ...chrome.uniforms, uOdChrome: { value: new THREE.Vector4(1, .22, .35, .012) }, uOdEdge: { value: new THREE.Vector4(1, 12, .9, 3.4) }, uOdLook: { value: new THREE.Vector4(.55, 1.2, 0, 0) } };
  const OD_GLSL = (lite ? '#define MONTIS_LITE 1\\n' : '') + chrome.glsl + \`
    uniform vec4 uOdChrome,uOdEdge,uOdLook,uOdVar;
    /* Chapter 1's burst: the same metal against the same room, the iris wandering by a per-drop seed.
       2026-10-24 (client 「這螺旋水滴很怪，可能太規則」): a row of mirror balls in one infinitely far room all show the
       same picture — printed copies. Each drop now mirrors the room turned a little its own way (uOdVar.y/z: tumbling
       water never shows its studio square-on), goes softer when it is near the lens (w: defocus), and carries the real
       low sun as nothing else in it does: a warm rim on its sun side and one hard glint that moves with the drop. */
    mat3 odTurn(float a,float b){
      float ca=cos(a),sa=sin(a),cb=cos(b),sb=sin(b);
      return mat3(ca,0.,-sa,0.,1.,0.,sa,0.,ca)*mat3(1.,0.,0.,0.,cb,sb,0.,-sb,cb);
    }
    vec3 odChrome(vec3 N,vec3 Vc,float seed){
      mat3 T=odTurn(uOdVar.y,uOdVar.z);
      vec3 Nt=T*N,Vt=T*Vc;
      float mask=smoothstep(.25,.85,fract(seed+Nt.y*.5+Nt.x*.31));
      vec3 c=montisChrome(Nt,Vt,vec2(0.,1.),.35,uOdChrome.w+uOdVar.w*.07,mask,uOdChrome.z,uOdChrome.y);
      float face=clamp(dot(N,Vc),0.,1.);
      c+=uEnvGlow*uOdEdge.x*pow(1.-face,uOdEdge.y);
      vec3 S=normalize(uEnvCoreDir);
      float behind=clamp(dot(-Vc,S),0.,1.);
      c+=uEnvGlow*uOdEdge.z*pow(face,uOdEdge.w)*behind;
      vec3 sunC=uEnvGlow*(1.+uEnvSunTint);
      c+=sunC*uOdLook.x*pow(1.-face,2.2)*smoothstep(-.15,.7,dot(N,S));
      c+=sunC*uOdLook.y*pow(max(dot(reflect(-Vc,N),S),0.),mix(900.,90.,uOdVar.w));
      return max(c,vec3(0.));
    }
  \`;`, 'drops signature');
  drops = once(drops, "    /* The cards' grade, so the two rings share one palette. */", "    uniform float uSeed;\n    ${OD_GLSL}\n    /* The cards' grade, so the two rings share one palette. */", 'drop GLSL');
  drops = once(drops, '      col=mix(col,uRoomHorizon,uHaze);', `      /* The hero's metal over the water. A letter still inside its drop shows through. */
      {
        float od=uOdChrome.x*uOdVar.x;\${letters ? \`
        od*=1.-uGlyphOn*gLetter.a*.85;\` : ''}
        col=mix(col,odChrome(normalize(vNormalW),-V,uSeed*5.17),clamp(od,0.,1.));
        /* out of focus near the lens: the edge goes soft as a lens draws it */
        alpha*=mix(1.,smoothstep(0.,.45,clamp(dot(normalize(vNormalW),-V),0.,1.)),uOdVar.w);
      }
      col=mix(col,uRoomHorizon,uHaze);`, 'drop blend');
  drops = once(drops, '    uFuse: { value: new THREE.Vector2(.54, 1) }', '    uFuse: { value: new THREE.Vector2(.54, 1) },\n    ...odUniforms', 'shared uniforms');
  drops = once(drops, '    uCaustic: { value: .5 }, uAbsorb: { value: .2 }', '    uCaustic: { value: .5 }, uAbsorb: { value: .2 },\n    ...odUniforms, uOdVar: { value: new THREE.Vector4(1, 0, 0, 0) }', 'bead uniforms');
  /* What a drop shows through itself is the real world behind it, not a studio: the room it refracts is the opening's
     own sky — the low sun, the range on the horizon, the haze — so a drop in front of the sun carries the sun upside
     down in it and one in front of the range carries the range, and no two drops in the swirl are the same picture
     (SWIRL REFRACT, 0 = the drops' studio room as before). */
  drops = once(drops, '      vec3 room=roomEnv(normalize(o*uToLocal));', '      vec3 room=roomEnv(normalize(o*uToLocal));\n      room=mix(room,montisEnv(normalize(o*uToLocal),.03,.035,0.),uOdLook.z);', 'refract world');
  drops = once(drops, '    uniforms.uClipY = { value: -1e9 };', '    uniforms.uClipY = { value: -1e9 };\n    uniforms.uOdVar = { value: new THREE.Vector4(1, 0, 0, 0) };', 'drop var uniform');
  /* Per drop, every frame: how much of it is metal (the big ones carry the hero's mirror, the small ones are clearer
     water), how its room is turned, and how far out of focus it is (nearer the lens than the mark). Seeded, so a drop
     keeps its character; only in the letters' swirl — the other modes stay as they were. */
  drops = once(drops, '      u.uHaze.value = Math.min(1, C.haze * Math.pow(clamp01((distance - logoDistance - .6) / 8), .8) + (delivering ? C.swirlHaze * smooth(distance - logoDistance, 0, C.swirlRadius * 1.1) : 0));',
    `      u.uHaze.value = Math.min(1, C.haze * Math.pow(clamp01((distance - logoDistance - .6) / 8), .8) + (delivering ? C.swirlHaze * smooth(distance - logoDistance, 0, C.swirlRadius * 1.1) : 0));
      if (delivering) {
        const sd = u.uSeed.value, h1 = fract(Math.sin(sd * 91.7) * 43758.5453), h2 = fract(Math.sin(sd * 47.3 + 1.3) * 24634.6345), h3 = fract(Math.sin(sd * 13.9 + 2.1) * 12345.678);
        const metal = THREE.MathUtils.clamp((C.swirlMetal ?? 1) + (h1 - .5) * 2 * (C.swirlMetalVar ?? 0) + (rel - 1) * .3, .12, 1);
        const turn = C.swirlEnvTurn ?? 0;
        u.uOdVar.value.set(metal, (h2 - .5) * 2 * turn, (h3 - .5) * turn * .6, (C.swirlDefocus ?? 0) * smooth(logoDistance - distance - .35, 0, 1.6));
      } else u.uOdVar.value.set(1, 0, 0, 0);`, 'drop var');
  drops = once(drops, '      uniform float uIor,uReflect,uSpec,uRim,uCaustic,uAbsorb,uEnvStudio;', '      uniform float uIor,uReflect,uSpec,uRim,uCaustic,uAbsorb,uEnvStudio;\n      ${OD_GLSL}', 'bead GLSL');
  drops = once(drops, '        gl_FragColor=vec4(col,vAlpha);', `        /* The metal reads the bead's smooth body, not its lumps: a mirror on a twelve-pixel lump of facets is crumpled foil. */
        vec3 odN=normalize(mix(N,normalize(transpose(vInv)*(vInv*(vWorld-vCenter))),.85));
        col=mix(col,odChrome(odN,-V,fract(dot(vCenter,vec3(.71,.37,.53))*3.1)),clamp(uOdChrome.x,0.,1.));
        gl_FragColor=vec4(col,vAlpha);`, 'bead blend');
  drops = once(drops, "      syncRoomColor('uRoomTop', palette.top ?? '#92a8cd');", `      syncRoomColor('uRoomTop', palette.top ?? '#92a8cd');
      odUniforms.uOdChrome.value.set(C.chromeLook ?? 1, C.chromeCard ?? .22, C.chromeBand ?? .35, C.chromeRough ?? .012);
      odUniforms.uOdEdge.value.set(C.chromeRim ?? 1, C.chromeRimEdge ?? 12, C.chromeLens ?? .9, C.chromeLensEdge ?? 3.4);
      odUniforms.uOdLook.value.set(C.swirlSunRim ?? 0, C.swirlSunGlint ?? 0, delivering ? (C.swirlRefract ?? 0) : 0, 0);`, 'per-frame dials');

  return { main, drops, letters, glass, html };
};
