// Colour pass C6 "film" (2026-10-21): a film grade in the last pass (display-referred, after OutputPass):
// split tone (shadows toward night blue, highlights toward champagne gold), an S-curve, a lift of the blacks
// toward blue, and a vignette. Off (amount 0) unless the cobalt palette turns it on; every value is a dial.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
function edit(rel, pairs) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  for (const [label, find, repl] of pairs) {
    const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
    const n = src.split(f).length - 1;
    if (n !== 1) throw new Error(`${rel} [${label}] anchor found ${n} times`);
    src = src.replace(f, () => r);
  }
  fs.writeFileSync(file, src);
  console.log('patched', rel, pairs.length);
}

edit('prototypes/maritime-landscape/js/main.js', [
  ['config',
    `      /* COBALT HORIZON (2026-10-21): generated island plates`,
    `      /* FILM (2026-10-21): the last pass grades the finished frame like a print. amount 0 = untouched. */
      CONFIG.film = {
        amount: 0, contrast: .22, shadow: '#1c2f66', shadowAmt: .35, high: '#ffd9a0', highAmt: .22,
        lift: .018, vignette: .32, vignetteSoft: .75
      };
      /* COBALT HORIZON (2026-10-21): generated island plates`],
  ['uniforms',
    `          uGrade: { value: new THREE.Vector4(0, 1, 0, 0) }
        },`,
    `          uGrade: { value: new THREE.Vector4(0, 1, 0, 0) },
          uFilm: { value: new THREE.Vector4(0, .22, .018, .32) },
          uFilmSplit: { value: new THREE.Vector2(.35, .22) },
          uFilmShadow: { value: new THREE.Vector3(.11, .18, .4) },
          uFilmHigh: { value: new THREE.Vector3(1, .85, .63) },
          uFilmVig: { value: .75 },
          uAspect: { value: innerWidth / Math.max(1, innerHeight) }
        },`],
  ['glsl',
    `      vec4 c=texture2D(tDiffuse,vUv);
      c.rgb=fiGrade(c.rgb);`,
    `      vec4 c=texture2D(tDiffuse,vUv);
      c.rgb=fiGrade(c.rgb);
      if(uFilm.x>0.){
        /* FILM: S-curve, split tone (multiplicative, luminance-kept), blacks lifted toward the shadow
           colour, vignette. Display-referred, so the numbers read like a colourist's. */
        vec3 f=clamp(c.rgb,0.,1.);
        f=mix(f,f*f*(3.-2.*f),uFilm.y);
        float fl=dot(f,vec3(.2126,.7152,.0722));
        vec3 ts=uFilmShadow/max(dot(uFilmShadow,vec3(.2126,.7152,.0722)),1e-3);
        vec3 th=uFilmHigh/max(dot(uFilmHigh,vec3(.2126,.7152,.0722)),1e-3);
        f*=mix(vec3(1.),ts,(1.-smoothstep(0.,.6,fl))*uFilmSplit.x);
        f*=mix(vec3(1.),th,smoothstep(.35,1.,fl)*uFilmSplit.y);
        f+=uFilm.z*uFilmShadow*(1.-fl);
        vec2 vq=(vUv-.5)*vec2(uAspect,1.)/max(uAspect,1.);
        f*=1.-uFilm.w*smoothstep(1.-uFilmVig*.9,1.15,length(vq)*1.55);
        c.rgb=mix(c.rgb,f,uFilm.x);
      }`],
  ['decl',
    `    uniform float uAmount,uSize,uSpeed,uTime;
    varying vec2 vUv;
    \${GRADE_GLSL}`,
    `    uniform float uAmount,uSize,uSpeed,uTime;
    uniform vec4 uFilm;
    uniform vec2 uFilmSplit;
    uniform vec3 uFilmShadow,uFilmHigh;
    uniform float uFilmVig,uAspect;
    varying vec2 vUv;
    \${GRADE_GLSL}`],
  ['apply',
    `        grainPass.uniforms.uSpeed.value = CONFIG.scene.grainSpeed;`,
    `        grainPass.uniforms.uSpeed.value = CONFIG.scene.grainSpeed;
        {
          const FL = CONFIG.film, U = grainPass.uniforms, hx = h => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
          U.uFilm.value.set(THREE.MathUtils.clamp(+FL.amount || 0, 0, 1), +FL.contrast || 0, +FL.lift || 0, +FL.vignette || 0);
          U.uFilmSplit.value.set(+FL.shadowAmt || 0, +FL.highAmt || 0);
          U.uFilmShadow.value.set(...hx(FL.shadow)); U.uFilmHigh.value.set(...hx(FL.high));
          U.uFilmVig.value = THREE.MathUtils.clamp(+FL.vignetteSoft || 0, 0, 1);
          U.uAspect.value = innerWidth / Math.max(1, innerHeight);
        }`],
  ['rows',
    `          ['島嶼與雲 Horizon', [`,
    `          ['底片調色 Film', [
            ['調色強度（0＝關）', 'film', 'amount', 0, 1, .01], ['對比 S 曲線', 'film', 'contrast', 0, 1, .01],
            ['暗部色', 'film', 'shadow'], ['暗部染色', 'film', 'shadowAmt', 0, 1, .01],
            ['亮部色', 'film', 'high'], ['亮部染色', 'film', 'highAmt', 0, 1, .01],
            ['黑位提亮', 'film', 'lift', 0, .1, .001], ['暗角', 'film', 'vignette', 0, 1, .01], ['暗角柔和', 'film', 'vignetteSoft', 0, 1, .01]
          ]],
          ['島嶼與雲 Horizon', [`]
]);
