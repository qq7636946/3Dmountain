// Colour pass C4 "dusk" (2026-10-21): the settled banner values (afterglow, the drop's lower room), the
// land under a low warm sun with cool blue shadows, turquoise shallows and aqua river light, and the
// canyon's own sky given the same cloud plate and afterglow, so the whole page is one evening. COBALT only.
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
  ['horizon-values',
    `        glow: COBALT ? .55 : 0, glowColour: '#ffb48a', glowHeight: .012, glowWidth: .035, glowSpread: 60
      };`,
    `        glow: COBALT ? .5 : 0, glowColour: '#ff9c5a', glowHeight: -.006, glowWidth: .011, glowSpread: 44,
        /* The canyon's sky takes the same plate and the same afterglow. */
        canyonClouds: COBALT ? .55 : 0, canyonCloudLow: .02, canyonCloudHigh: .34, canyonGlow: COBALT ? .5 : 0
      };`],
  ['cobalt-land',
    `          sun: '#ffe4bd', sunDay: 3.3, sunAerial: 3.5,
          hemiSky: '#a9c6ee', hemiGround: '#4b3d2f', hemiDay: 1.15, hemiAerial: .95,
          rim: '#d6e6ff', rimDay: .5, rimAerial: .45, ibl: .3,
          rock: '#8a7a68', rockCool: '#5f6878', rockWarm: '#b98a5a', streak: .45,
          veg: '#42583a', vegAmount: .85, vegLine: 820, frost: '#e6dfd0',
          deep: '#061c56', mid: '#173f8e', bed: '#1f7c88', foam: '#eef5ff', reflect: .62, glint: .7,`,
    `          /* A low warm sun and cool blue shade: the banner's evening carried onto the land. */
          sun: '#ffcf96', sunDay: 3.5, sunAerial: 3.8,
          hemiSky: '#93b4ea', hemiGround: '#4b3d2f', hemiDay: 1.05, hemiAerial: .9,
          rim: '#ffd2a0', rimDay: .55, rimAerial: .5, ibl: .3,
          rock: '#8a7a68', rockCool: '#5f6878', rockWarm: '#c48a52', streak: .5,
          veg: '#42583a', vegAmount: .85, vegLine: 820, frost: '#e6dfd0',
          deep: '#061c56', mid: '#1a4fa0', bed: '#22a09c', foam: '#eef5ff', reflect: .62, glint: .7,`],
  ['cobalt-fog',
    `          skyZenith: '#2c5cb6', skyHorizon: '#bcd3ef', fog: '#a6bfe0', aerialFog: '#90afd9',`,
    `          skyZenith: '#2c5cb6', skyHorizon: '#bcd3ef', fog: '#a6bfe0', aerialFog: '#8eaee0',`],
  ['cobalt-field',
    `        Object.assign(CONFIG.field, { zenith: '#2446a0', upper: '#3a5cb6', top: '#0c1d58', horizon: '#6688dc', lower: '#183684', floor: '#08184a', ink: '#061340', core: 1.05, coreSpread: .55, bandGain: .07 });`,
    `        /* LOWER, FLOOR and INK only reach the drop and the probe: a lighter room under the drop keeps
           its folds glassy instead of blotched with navy. */
        Object.assign(CONFIG.field, { zenith: '#2446a0', upper: '#3a5cb6', top: '#0c1d58', horizon: '#6688dc', lower: '#3d62c0', floor: '#24479e', ink: '#13296e', core: 1.05, coreSpread: .55, bandGain: .07 });
        /* Aqua river light. */
        Object.assign(CONFIG.watershedFlow, { color: '#9af2ff', brightness: .85 });`],
  ['canyon-uniforms',
    `      const horizonFwd = new THREE.Vector3();`,
    `      /* The canyon sky's share of the plate (filled in applyConfig, wired once the canyon exists). */
      const canyonSkyU = {
        uCloud: montisEnvUniforms.uEnvCloud, uCloudB: montisEnvUniforms.uEnvCloudB,
        uCloudA: { value: new THREE.Vector4(0, .02, .34, 0) }, uCloudSpan: { value: THREE.MathUtils.degToRad(120) },
        uAfter: { value: new THREE.Vector4(0, 0, 0, 0) }, uAfter2: { value: new THREE.Vector2(.02, 0) }
      };
      const horizonFwd = new THREE.Vector3();`],
  ['canyon-sky',
    `      if (sceneStopped) return;
      canyon.scene.environment = scene.environment;`,
    `      if (sceneStopped) return;
      canyon.scene.environment = scene.environment;
      if (COBALT) {
        /* COBALT: the canyon's gradient sky gets the banner's cloud plate (repeating, mirrored, all the
           way round) and the warm afterglow along its horizon. Only the shader text changes. */
        const skyMat = canyon.scene.children.find(o => o.material?.uniforms?.zenith)?.material;
        if (skyMat) {
          Object.assign(skyMat.uniforms, canyonSkyU);
          skyMat.fragmentShader = \`uniform vec3 zenith,horizon;
uniform sampler2D uCloud;
uniform vec4 uCloudA,uCloudB,uAfter;
uniform vec2 uAfter2;
uniform float uCloudSpan;
varying vec3 vDirection;
void main(){
  vec3 d=normalize(vDirection);
  float h=max(d.y,0.);
  vec3 c=mix(horizon,zenith,pow(h,.47));
  c+=uAfter.rgb*exp(-pow((d.y-uAfter.w)/uAfter2.x,2.));
  if(uCloudA.x>0.){
    float cv=(d.y-uCloudA.y)/max(uCloudA.z-uCloudA.y,1e-3);
    float cf=smoothstep(0.,.10,cv)*smoothstep(1.,.72,cv)*uCloudA.x;
    if(cf>.001){
      vec3 cs=textureLod(uCloud,vec2(atan(d.x,-d.z)/uCloudSpan+.5+uCloudA.w,clamp(cv,0.,1.)),0.).rgb;
      vec3 cc=mix(vec3(dot(cs,vec3(.299,.587,.114))),cs,uCloudB.w)*uCloudB.rgb;
      c=c*(1.-max(cs.r,max(cs.g,cs.b))*cf)+cc*cf;
    }
  }
  gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}\`;
          skyMat.needsUpdate = true;
        }
      }`],
  ['canyon-drift',
    `          maritimeSky ??= canyon.scene.children.find(o => o.material?.uniforms?.zenith)?.material || null;`,
    `          maritimeSky ??= canyon.scene.children.find(o => o.material?.uniforms?.zenith)?.material || null;
          canyonSkyU.uCloudA.value.w = (performance.now() / 1000 * (+CONFIG.horizon.cloudDrift || 0)) % 2;`],
  ['apply',
    `            montisEnvUniforms.uEnvAfter2.value.set(Math.max(.004, +H.glowWidth || .035), THREE.MathUtils.degToRad(Math.max(5, +H.glowSpread || 60)));
          }`,
    `            montisEnvUniforms.uEnvAfter2.value.set(Math.max(.004, +H.glowWidth || .035), THREE.MathUtils.degToRad(Math.max(5, +H.glowSpread || 60)));
            const cg = Math.max(0, +H.canyonGlow || 0);
            canyonSkyU.uAfter.value.set(gc.x * ga * cg, gc.y * ga * cg, gc.z * ga * cg, Math.max(0, +H.glowHeight || 0));
            canyonSkyU.uAfter2.value.set(Math.max(.01, (+H.glowWidth || .011) * 3), 0);
            const ca = canyonSkyU.uCloudA.value;
            ca.x = Math.max(0, +H.canyonClouds || 0); ca.y = +H.canyonCloudLow || 0; ca.z = Math.max(ca.y + .02, +H.canyonCloudHigh || .34);
          }`],
  ['rows',
    `            ['餘暉厚度', 'horizon', 'glowWidth', .005, .15, .001], ['餘暉寬度°', 'horizon', 'glowSpread', 10, 180, 1]`,
    `            ['餘暉厚度', 'horizon', 'glowWidth', .005, .15, .001], ['餘暉寬度°', 'horizon', 'glowSpread', 10, 180, 1],
            ['峽谷雲量', 'horizon', 'canyonClouds', 0, 1.5, .01], ['峽谷雲下緣', 'horizon', 'canyonCloudLow', -.1, .4, .005],
            ['峽谷雲上緣', 'horizon', 'canyonCloudHigh', .1, .9, .005], ['峽谷餘暉', 'horizon', 'canyonGlow', 0, 2, .01]`]
]);
