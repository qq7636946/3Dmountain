/* index1-5 only: the dispersal's beads keep the hero's life (2026-10-24 client note 「向這邊時候水滴還會律動，滾下去就不動了 …
   圖二這個可以假裝律動讓銜接上不會差太多嗎」).
   Measured first: held still at journey .7 the hero (SDF) changes ~29% of its pixels every 1.5 s, at .9 the beads change 0%.
   Once the page is scrolled the hero's own wave clock (uTouchTime) is already frozen; what still moves on it is the Codrops
   sheen and the iridescence mask, both read off one value noise that drifts with uNoiseTime. The beads are a pure function
   of scroll (instance matrices untouched here), so they stop dead when the wheel stops.
   1. The beads wear the same moving sheen and the same moving iris mask: the hero's uniforms by reference, one clock.
      Bead 0 (the lead, which takes over from the hero) samples exactly the hero's pattern, so the hand-over does not jump;
      the others are offset so they are not printed copies of one another. The old fract() mask left a hard seam — IRIS 1
      replaces it.
   2. A slow breath and surface wave: the hero's dropletDisplace formula and numbers (uWave), as vertex displacement with
      its analytic normal, on the scene clock; bead 0 in phase with the hero, the others staggered.
   3. Icosahedron detail 3 → 10: at 180–365 px the old 320-triangle sphere showed corners on its outline.
   4. The window ring fades in (client, same day: 「讓主珠接手後那圈窗光淡入」): at the hand-over only the band differs
      (bead .16, hero 0; card/rough/lens/rim are equal there, measured), so each bead's band starts at the hero's and grows
      to its own as it separates — the lead by its gap to the nearest primary, a bud by its own gap — over RING IN of its
      radius. Still a pure function of scroll.
   Dials in 「開場水滴 Drops」 (散開水滴 …). All 0 = the previous look, except the smoother outline. */
module.exports = ({ main, drops, letters, glass, html }) => {
  const once = (source, anchor, replacement, label) => {
    const n = source.split(anchor).length - 1;
    if (n !== 1) throw new Error('index1-5 bead-life anchor (' + label + '): ' + n + ' × ' + anchor.slice(0, 90));
    return source.replace(anchor, () => replacement);
  };

  /* the hero's value noise, copied verbatim and renamed (separate material, separate program) */
  const a = main.indexOf('float dropletRnd(vec3 p){'), b = main.indexOf('float dropletNoise(vec3 p){');
  if (a < 0 || b < a || main.indexOf('float dropletRnd(vec3 p){', a + 1) >= 0) throw new Error('index1-5 bead-life: hero noise not found');
  const noise = main.slice(a, main.indexOf('\n}\n', b) + 3).replaceAll('dropletRnd', 'beadRnd').replaceAll('dropletNoise', 'beadNoise');

  /* ---- defaults (before DEFAULT_CONFIG, so RESET returns to them) ---- */
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* 散開水滴的律動（客戶 2026-10-24）：捲動後英雄水珠還在動的，是表面那層光斑和虹彩雜訊；散開的珠子穿上同一層、跟同一個時鐘走。
         SHEEN 光斑、IRIS 虹彩（×英雄；0＝原本的珠子）、WAVE 呼吸與表面波（×英雄的數字）、PHASE 每顆呼吸錯開（主珠永遠和英雄同相）。
         RING IN 窗光淡入：主珠接手、芽脫離的那一格光帶和英雄一樣（0），分開 RING IN 個自己的半徑後才是珠子的光帶（0＝一接手就有）。 */
      CONFIG.beadLife = { sheen: 1, iris: 1, wave: 1, phase: 1, ringIn: 1 };
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'defaults');

  /* ---- uniforms: the hero's, by reference ---- */
  main = once(main, 'uDropLens: { value: new THREE.Vector2(CONFIG.drop.lens, CONFIG.drop.lensEdge) }', `uDropLens: { value: new THREE.Vector2(CONFIG.drop.lens, CONFIG.drop.lensEdge) },
            /* 律動：x 呼吸、y 光斑、z 虹彩、w 錯開。其餘是英雄水珠的同一批 uniform（同一個物件），跟它一起動。 */
            uBeadLife: { value: new THREE.Vector4(1, 1, 1, 1) },
            uBeadTime: { value: 0 },
            uHeroBand: dropletUniforms.uDropBand,
            uWave: dropletUniforms.uWave,
            uNoiseView: dropletUniforms.uNoiseView, uNoiseScale: dropletUniforms.uNoiseScale, uNoiseTime: dropletUniforms.uNoiseTime,
            uTint0: dropletUniforms.uTint0, uTint1: dropletUniforms.uTint1, uContrast: dropletUniforms.uContrast, uSheen: dropletUniforms.uSheen`, 'uniforms');

  /* ---- vertex: the hero's wave and breath ---- */
  main = once(main, '        attribute vec3 instanceExtra;   /* x 淡出, y 亂數種子, z 拉長量 */', `        attribute vec3 instanceExtra;   /* x 淡出, y 亂數種子, z 拉長量 */
        attribute float instanceRing;   /* 窗光淡入 0…1 */
        uniform vec4 uBeadLife,uWave;
        uniform float uBeadTime;
        varying float vSeed;
        varying float vRing;`, 'vertex pars');
  main = once(main, `          vec4 world=instanceMatrix*vec4(position,1.);
          world=modelMatrix*world;
          vW=world.xyz;
          mat3 nm=mat3(instanceMatrix);
          vN=normalize(nm*position);`, `          /* 律動：英雄 dropletDisplace 的波與呼吸，同一條公式、同一組數字，鋪在世界方向上（英雄的場也是）。
             第 0 顆（主珠，接英雄的班）相位 0、雜訊不偏移；其他顆錯開。法線用位移的解析梯度，反光跟著形狀走。 */
          float id=float(gl_InstanceID);
          vSeed=id<.5?0.:fract(id*.6180339887);
          vRing=instanceRing;
          mat3 nm=mat3(instanceMatrix);
          mat3 rot=mat3(normalize(nm[0]),normalize(nm[1]),normalize(nm[2]));
          vec3 n=rot*position;
          float T=uBeadTime*uWave.z+vSeed*6.2831853*uBeadLife.w;
          const vec3 WA=vec3(1.,.72,.36);
          const vec3 WB=vec3(-.28,-.54,1.);
          float k1=uWave.y*3.14159,k2=uWave.y*4.72;
          float s1=dot(n,WA)*k1+T,s2=dot(n,WB)*k2-T*1.31;
          float amp=uWave.x*uBeadLife.x;
          float w=(.64*sin(s1)+.36*sin(s2))*amp+sin(T*.72)*uWave.w*uBeadLife.x;
          vec3 g=(.64*cos(s1)*k1*WA+.36*cos(s2)*k2*WB)*amp;
          vec3 nW=normalize(n-(g-n*dot(n,g))/(1.+w));
          vec4 world=instanceMatrix*vec4(position*(1.+w),1.);
          world=modelMatrix*world;
          vW=world.xyz;
          vN=normalize(nm*(transpose(rot)*nW));`, 'vertex body');

  /* ---- fragment: the hero's moving iris mask and sheen ---- */
  main = once(main, '        uniform float uDropCard,uChromeRough,uBeadBand;', `        uniform float uDropCard,uChromeRough,uBeadBand;
        uniform vec4 uBeadLife;
        uniform mat3 uNoiseView;
        uniform float uNoiseScale,uNoiseTime,uContrast,uSheen,uHeroBand;
        uniform vec3 uTint0,uTint1;
        varying float vSeed;
        varying float vRing;
        /* 英雄水珠的值雜訊（dropletRnd / dropletNoise 原樣複製、改名）。 */
${noise.replace(/^/gm, '        ').replace(/\s+$/, '')}`, 'fragment pars');
  main = once(main, '          float mask=smoothstep(.25,.85,fract(vExtra.y+N.y*.5+N.x*.31));', `          float mask=smoothstep(.25,.85,fract(vExtra.y+N.y*.5+N.x*.31));
          /* 律動：哪裡閃虹彩改由英雄那張會流動的雜訊決定（同一個 uNoiseTime）；主珠和英雄同一張，其他顆錯開。 */
          vec3 seedOff=vec3(vSeed*37.);
          mask=mix(mask,smoothstep(.25,.85,beadNoise(N*uNoiseScale+uNoiseTime+seedOff)),uBeadLife.z);`, 'iris mask');
  main = once(main, '          col+=uEnvGlow*vExtra.z;', `          /* 律動：英雄的光斑（Codrops 的雜訊高光，讀在反射方向上、隨 uNoiseTime 流動），同樣以 uSheen×.35 用 screen 疊上。 */
          if(uBeadLife.y>.001){
            vec3 rv=reflect(vec3(0.,0.,-1.),normalize(uNoiseView*N));
            float na=beadNoise(rv*uNoiseScale+uNoiseTime+seedOff);
            float nb=beadNoise(rv*uNoiseScale-uNoiseTime+seedOff);
            vec3 hv=pow(max((uTint0*na+uTint1*nb)*2.3,vec3(0.)),vec3(uContrast))*uSheen;
            vec3 sh=min(hv,vec3(1.))*uSheen*.35*uBeadLife.y;
            col=vec3(1.)-(vec3(1.)-col)*(vec3(1.)-sh);
          }
          col+=uEnvGlow*vExtra.z;`, 'sheen');

  main = once(main, 'vec3 col=montisChrome(N,V,flow,.35,uChromeRough,mask,uBeadBand,uDropCard);',
    '/* 窗光淡入：光帶從英雄的量（接手那一格）長到珠子自己的量。 */\n          vec3 col=montisChrome(N,V,flow,.35,uChromeRough,mask,mix(uHeroBand,uBeadBand,vRing),uDropCard);', 'ring band');

  /* ---- mesh: a round outline at hero size, and a per-bead ring fade ---- */
  main = once(main, 'new THREE.IcosahedronGeometry(1, 3),', 'new THREE.IcosahedronGeometry(1, 10), /* 律動：3 → 10，大顆的輪廓不再有折角 */', 'detail');
  main = once(main, '      disperseMesh.geometry.attributes.instanceExtra.setUsage(THREE.DynamicDrawUsage);', `      disperseMesh.geometry.attributes.instanceExtra.setUsage(THREE.DynamicDrawUsage);
      /* 窗光淡入：每顆的光帶從英雄的量長到珠子的量（0…1），updateDispersal 每格填。 */
      disperseMesh.geometry.setAttribute('instanceRing', new THREE.InstancedBufferAttribute(new Float32Array(DISPERSE_MAX).fill(1), 1));
      disperseMesh.geometry.attributes.instanceRing.setUsage(THREE.DynamicDrawUsage);`, 'ring attribute');

  /* ---- per bead: how far it has separated, as a pure function of scroll ---- */
  main = once(main, '        let dNear = Infinity;', `        let dNear = Infinity;
        /* 窗光淡入：芽剛脫離、主珠剛接手的那一格，光帶是英雄的量；分開 RING IN 個自己的半徑後才是珠子的量。
           芽看自己離本體的間距，主珠看離它最近那顆一級碎片的間距（最後脫離的那顆）。 */
        const ringArr = disperseMesh.geometry.attributes.instanceRing.array;
        const ringIn = Math.max(0, CONFIG.beadLife?.ringIn ?? 1);
        let leadExcess = Infinity;`, 'ring setup');
  main = once(main, '          const ratio = lead / s.size;', `          const ratio = lead / s.size;
          let ringNow = 1;`, 'ring per bead');
  main = once(main, '              disperseBuds.r[q] = radius;', `              disperseBuds.r[q] = radius;
              ringNow = 0;
              leadExcess = Math.min(leadExcess, gap - reach);`, 'ring attached');
  main = once(main, '              shape = smooth01((gap - reach) / (radius * .5));', `              shape = smooth01((gap - reach) / (radius * .5));
              ringNow = ringIn > 1e-4 ? smooth01((gap - reach) / (ringIn * radius)) : 1;
              leadExcess = Math.min(leadExcess, gap - reach);`, 'ring detached');
  main = once(main, '          extra.array[i * 3] = fade;', `          ringArr[i] = ringNow;
          extra.array[i * 3] = fade;`, 'ring write');
  main = once(main, '        disperseLead.sdf = !broken || disperseLead.attached > 0;', `        disperseLead.sdf = !broken || disperseLead.attached > 0;
        ringArr[0] = !Number.isFinite(leadExcess) || ringIn <= 1e-4 ? 1
          : smooth01(Math.max(0, leadExcess) / (ringIn * R * lead));`, 'ring lead');
  main = once(main, '        extra.needsUpdate = true;', `        extra.needsUpdate = true;
        disperseMesh.geometry.attributes.instanceRing.needsUpdate = true;`, 'ring upload');

  /* ---- per frame: dials and the scene clock ---- */
  main = once(main, '        u.uDropRim.value.set(L(CONFIG.drop.rim, 1.0, close), CONFIG.drop.rimEdge);', `        u.uDropRim.value.set(L(CONFIG.drop.rim, 1.0, close), CONFIG.drop.rimEdge);
        /* 律動的撥盤；減少動態時不呼吸（光斑和英雄一樣，本來就停）。 */
        const BL = CONFIG.beadLife || {};
        u.uBeadLife.value.set(reduceMotion ? 0 : BL.wave ?? 1, BL.sheen ?? 1, BL.iris ?? 1, BL.phase ?? 1);`, 'dials');
  main = once(main, '        updateDispersal(progress, breakUp, flight, dropX, dropY, originZ);', `        disperseMaterial.uniforms.uBeadTime.value = time;
        updateDispersal(progress, breakUp, flight, dropX, dropY, originZ);`, 'clock');

  /* ---- tuner ---- */
  main = once(main, "['英雄 光斑', 'droplet', 'sheen', 0, 2, .01],", `['英雄 光斑', 'droplet', 'sheen', 0, 2, .01],
            ['散開水滴 光斑流動（×英雄）', 'beadLife', 'sheen', 0, 2, .01], ['散開水滴 虹彩流動（×英雄）', 'beadLife', 'iris', 0, 1, .01],
            ['散開水滴 呼吸與表面波（×英雄）', 'beadLife', 'wave', 0, 4, .05], ['散開水滴 呼吸每顆錯開', 'beadLife', 'phase', 0, 1, .01],
            ['散開水滴 窗光淡入距離（×珠子半徑；0＝一接手就有）', 'beadLife', 'ringIn', 0, 3, .05],`, 'tuner');

  return { main, drops, letters, glass, html };
};
