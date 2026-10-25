/* The small drops retain the opening hero's cold-blue reflection and moving
   interior. The alternate opening-refinement page keeps its silver preset. */
module.exports = ({ main, drops, ...rest }) => {
  const once = (s, a, b) => {
    if (s.split(a).length !== 2) throw Error('droplet coherence anchor: ' + a.slice(0, 90));
    return s.replace(a, () => b);
  };
  if (!main.includes('/* DROPLET_COHERENCE */')) {
    main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* DROPLET_COHERENCE */
      if (!document.documentElement.hasAttribute('data-opening-refinement')) {
        CONFIG.beadLife.matchHero = 1;
        Object.assign(CONFIG.logoDrops, {
          uniformColor: 1, swirlMetal: .90, swirlMetalVar: .05, swirlEnvTurn: .14,
          swirlDefocus: .32, swirlHaze: .18,
          swirlSunRim: .08, swirlSunGlint: .32, chromeCard: .80, chromeBand: .08,
          chromeRough: .026, chromeRim: .58, chromeRimEdge: 12,
          chromeLens: .38, chromeLensEdge: 8.5, innerFlow: .8
        });
      }
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
    main = once(main, '        chrome: { glsl: MONTIS_ENV_GLSL + MONTIS_CHROME_GLSL, uniforms: { ...montisEnvUniforms, ...dropChromeUniforms } },', `        chrome: { glsl: MONTIS_ENV_GLSL + MONTIS_CHROME_GLSL, uniforms: { ...montisEnvUniforms, ...dropChromeUniforms },
          flow: { uOdNoiseTime: dropletUniforms.uNoiseTime, uOdNoiseScale: dropletUniforms.uNoiseScale,
            uOdNoiseView: dropletUniforms.uNoiseView, uOdTint0: dropletUniforms.uTint0,
            uOdTint1: dropletUniforms.uTint1, uOdContrast: dropletUniforms.uContrast, uOdSheen: dropletUniforms.uSheen } },`);
    // Proximity adds depth, but no longer bleaches a whole set of beads to white.
    main = once(main, '? 1 - smooth01((dNear - .40) / 8.60)', '? (1 - smooth01((dNear - .40) / 8.60)) * (CONFIG.beadLife.matchHero ? .18 : 1)');
    main = once(main, 'u.uBeadBand.value = L(.16, .86, close);', 'u.uBeadBand.value = L(CONFIG.beadLife.matchHero ? .06 : .16, .86, close);');
    main = once(main, "['金屬比例（平均；1＝英雄水珠的鏡面）', 'logoDrops', 'swirlMetal', 0, 1, .01],", "['內部流水（與主水滴同源）', 'logoDrops', 'innerFlow', 0, 1.5, .01],\n            ['散開珠色跟隨主珠', 'beadLife', 'matchHero', 0, 1, 1],\n            ['金屬比例（平均；1＝英雄水珠的鏡面）', 'logoDrops', 'swirlMetal', 0, 1, .01],");
  }
  if (!drops.includes('DROPLET_COHERENCE_FLOW')) {
    const start = main.indexOf('float dropletRnd(vec3 p){');
    const next = main.indexOf('float dropletNoise(vec3 p){', start);
    if (start < 0 || next < start) throw Error('droplet coherence: hero noise missing');
    const noise = main.slice(start, main.indexOf('\n}', next) + 2)
      .replaceAll('dropletRnd', 'odHeroRnd').replaceAll('dropletNoise', 'odHeroNoise');
    drops = once(drops, '  const odUniforms = { ...chrome.uniforms,', '  const odUniforms = { ...chrome.uniforms, ...chrome.flow, uOdFlow: { value: 0 },');
    drops = once(drops, '    uniform vec4 uOdChrome,uOdEdge,uOdLook,uOdVar;', `    uniform vec4 uOdChrome,uOdEdge,uOdLook,uOdVar;
    /* DROPLET_COHERENCE_FLOW: shared hero clock and tints; no extra render pass. */
    uniform float uOdFlow,uOdNoiseTime,uOdNoiseScale,uOdContrast,uOdSheen;
    uniform mat3 uOdNoiseView;
    uniform vec3 uOdTint0,uOdTint1;
${noise}`);
    drops = once(drops, '      float mask=smoothstep(.25,.85,fract(seed+Nt.y*.5+Nt.x*.31));', `      float mask=smoothstep(.25,.85,fract(seed+Nt.y*.5+Nt.x*.31));
      vec3 phase=vec3(fract(seed)*9.7);
      if(uOdFlow>.001){
        // Broad, slow refraction moves within the round silhouette.
        float t=uOdNoiseTime;
        vec3 A=vec3(2.1,3.4,1.3),B=vec3(-2.7,1.8,3.1);
        vec3 bend=(A*cos(dot(Nt,A)+t*1.1+seed)+B*cos(dot(Nt,B)-t*.8+seed))*.012*uOdFlow;
        Nt=normalize(Nt+bend-Nt*dot(Nt,bend));
        mask=smoothstep(.25,.85,odHeroNoise(Nt*uOdNoiseScale+t+phase));
      }`);
    drops = once(drops, '      float face=clamp(dot(N,Vc),0.,1.);', `      if(uOdFlow>.001){
        // Same two moving interior light fields as the hero, with staggered phases.
        vec3 r=reflect(vec3(0.,0.,-1.),normalize(uOdNoiseView*Nt));
        float a=odHeroNoise(r*uOdNoiseScale+uOdNoiseTime+phase);
        float b=odHeroNoise(r*uOdNoiseScale-uOdNoiseTime+phase);
        vec3 light=pow(max((uOdTint0*a+uOdTint1*b)*2.3,vec3(0.)),vec3(uOdContrast))*uOdSheen;
        vec3 sheen=min(light,vec3(1.))*uOdSheen*.35*min(uOdFlow,1.);
        c=vec3(1.)-(vec3(1.)-c)*(vec3(1.)-sheen);
      }
      float face=clamp(dot(N,Vc),0.,1.);`);
    drops = once(drops, '    state.delivering = delivering;', '    state.delivering = delivering;\n    odUniforms.uOdFlow.value = Math.max(0, config.innerFlow ?? 0);');
  }
  if (!drops.includes('varying float vOdSeed;')) {
    // Travelling through world-space cells must not restart a droplet's flow.
    drops = drops.replaceAll('varying vec3 vWorld,vNormalW,vCenter;', 'varying vec3 vWorld,vNormalW,vCenter;\n      varying float vOdSeed;');
    drops = once(drops, '        vAlpha=aBead.y;', '        vAlpha=aBead.y;\n        vOdSeed=aBead.x;');
    drops = once(drops, 'odChrome(odN,-V,fract(dot(vCenter,vec3(.71,.37,.53))*3.1))', 'odChrome(odN,-V,uOdFlow>.001?vOdSeed*5.17:fract(dot(vCenter,vec3(.71,.37,.53))*3.1))');
  }
  return { main, drops, ...rest };
};
