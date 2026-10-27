// Maritime look, pass 3: light modelling, darker greyer rock, wind ripples on the water,
// a less silver aerial river. Edits ONLY the copies in prototypes/maritime-landscape/js.
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
const MAIN = 'main.js';
if (load(MAIN).includes('uMarRipple')) { console.error('pass 3 already applied'); process.exit(2); }

// Light: less ambient fill, more sun, so the rock is modelled instead of evenly lit.
rep(MAIN, `        sun: '#f3eadc', sunDay: 2.3, sunAerial: 2.1,
        hemiSky: '#d5d9d6', hemiGround: '#40474c', hemiDay: 1.55, hemiAerial: .75,
        rim: '#a9b6c1', rimDay: .55, rimAerial: .35, ibl: .55,
        rock: '#857869', rockCool: '#6d6c69', rockWarm: '#8d7760', streak: .45,`,
`        sun: '#f3eadc', sunDay: 2.9, sunAerial: 2.6,
        hemiSky: '#d5d9d6', hemiGround: '#3c4247', hemiDay: 1.1, hemiAerial: .55,
        rim: '#a9b6c1', rimDay: .45, rimAerial: .3, ibl: .35,
        rock: '#7d7164', rockCool: '#5f5f5c', rockWarm: '#8a735b', streak: .45,`);
rep(MAIN, `deep: '#0d2740', mid: '#23435f', bed: '#2f4a4c', foam: '#e9eeee', reflect: 1, glint: .35`,
  `deep: '#0d2740', mid: '#23435f', bed: '#2f4a4c', foam: '#e9eeee', reflect: 1, glint: .35, ripple: .14`);
rep(MAIN, `Object.assign(CONFIG.watershedWater, { base: '#14304a', highlight: '#a2adb3', reflection: .30 });`,
  `Object.assign(CONFIG.watershedWater, { base: '#14304a', highlight: '#8d9aa4', reflection: .22 });`);

// Wind ripples: shading only, band-limited by the pixel footprint so nothing crawls far off.
rep(MAIN, `        uMarSun: { value: new THREE.Vector4(-.494, .676, -.546, 0) }, uMarReflect: { value: 1 },`,
  `        uMarSun: { value: new THREE.Vector4(-.494, .676, -.546, 0) }, uMarReflect: { value: 1 }, uMarRipple: { value: 0 },`);
rep(MAIN, `    uniform float uMarReflect;`, `    uniform float uMarReflect,uMarRipple;`);
rep(MAIN, `        vec3 mR=reflect(-V,nrm);
        float mRy=clamp(mR.y,0.,1.);`,
`        /* Wind ripples on the water itself: two octaves of drifting value noise bent into the
           normal, faded out by the pixel footprint so distance shows them as tone, not crawl. */
        vec3 mNrm=nrm;
        float mFoot=fwidth(vWorld.x)+fwidth(vWorld.z);
        float mFade=(1.-smoothstep(.25,1.4,mFoot))*uMarRipple;
        if(mFade>.001){
          vec2 wq=vWorld.xz*vec2(.55,.9)+vec2(uSeaTime*.18,-uSeaTime*.11);
          float e=.35;
          float n0=seaNoise(wq),nx=seaNoise(wq+vec2(e,0.)),nz=seaNoise(wq+vec2(0.,e));
          vec2 wg=vec2(nx-n0,nz-n0)/e;
          vec2 wq2=wq*2.7+vec2(5.2,1.3)-uSeaTime*.07;
          float k0=seaNoise(wq2),kx=seaNoise(wq2+vec2(e,0.)),kz=seaNoise(wq2+vec2(0.,e));
          wg+=vec2(kx-k0,kz-k0)/e*.55;
          mNrm=normalize(nrm+vec3(-wg.x,0.,-wg.y)*mFade);
        }
        vec3 mR=reflect(-V,mNrm);
        float mRy=clamp(mR.y,0.,1.);`);
rep(MAIN, `        float mCos=clamp(dot(nrm,V),0.,1.);`, `        float mCos=clamp(dot(mNrm,V),0.,1.);`);
rep(MAIN, `        mw+=uMarSkyHorizon*pow(max(dot(nrm,mH),0.),mix(900.,70.,clamp(rough*3.,0.,1.)))*uMarSun.w;`,
  `        mw+=uMarSkyHorizon*pow(max(dot(mNrm,mH),0.),mix(900.,70.,clamp(rough*3.,0.,1.)))*uMarSun.w;`);
rep(MAIN, `          seaUniforms.uMarReflect.value = +MR.reflect || 0;`,
  `          seaUniforms.uMarReflect.value = +MR.reflect || 0;
          seaUniforms.uMarRipple.value = +MR.ripple || 0;`);
rep(MAIN, `            ['天空倒影', 'maritime', 'reflect', 0, 1.5, .01], ['日光閃點', 'maritime', 'glint', 0, 2, .01]`,
  `            ['天空倒影', 'maritime', 'reflect', 0, 1.5, .01], ['日光閃點', 'maritime', 'glint', 0, 2, .01], ['水面細紋', 'maritime', 'ripple', 0, .5, .005]`);

for (const [f, s] of Object.entries(files)) fs.writeFileSync(path.join(DIR, f), s);
console.log('patched', Object.keys(files).join(', '));
