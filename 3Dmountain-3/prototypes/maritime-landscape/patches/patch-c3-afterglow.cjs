// Colour pass C3 "afterglow" (2026-10-21): a thin warm band of light lying on the banner's horizon (the
// sea mirrors it, the drop wears it), plus the C2 horizon values settled after look-dev. COBALT only.
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
    `        islands: COBALT ? 1 : 0, scale: 1, haze: .26, hazeStep: .16, mist: .24, sat: .92, bright: 1, tint: '#ffffff',
        reflect: .32, reflectLen: .85,
        clouds: COBALT ? .75 : 0, cloudLow: .012, cloudHigh: .36, cloudSpan: 96, cloudDrift: .0035, cloudColour: .85, cloudTint: '#ffffff'
      };`,
    `        islands: COBALT ? 1 : 0, scale: 1, haze: .42, hazeStep: .14, mist: .3, sat: .82, bright: .88, tint: '#ffffff',
        reflect: .32, reflectLen: .85,
        clouds: COBALT ? .5 : 0, cloudLow: -.005, cloudHigh: .2, cloudSpan: 96, cloudDrift: .0035, cloudColour: .75, cloudTint: '#ffffff',
        /* AFTERGLOW: a thin warm band on the horizon, widest straight ahead, mirrored by the sea. */
        glow: COBALT ? .55 : 0, glowColour: '#ffb48a', glowHeight: .012, glowWidth: .035, glowSpread: 60
      };`],
  ['env-uniforms',
    `        uEnvCloudSpan: { value: 1.68 }
      };`,
    `        uEnvCloudSpan: { value: 1.68 },
        /* AFTERGLOW: rgb colour × amount, w elevation; G2 x width (elevation), y azimuth spread (radians). */
        uEnvAfter: { value: new THREE.Vector4(0, 0, 0, .012) },
        uEnvAfter2: { value: new THREE.Vector2(.035, 1.05) }
      };`],
  ['env-decl',
    `uniform float uEnvCloudSpan;\n`,
    `uniform float uEnvCloudSpan;
uniform vec4 uEnvAfter;
uniform vec2 uEnvAfter2;
`],
  ['env-band',
    `  /* COBALT clouds: a generated plate of dusk cloud`,
    `  /* AFTERGLOW: the low sun's last light lying along the horizon, behind the clouds. */
  if(uEnvAfter.r+uEnvAfter.g+uEnvAfter.b>0.){
    float aw=uEnvAfter2.x+b*.08;
    float ab=exp(-pow((d.y-uEnvAfter.w)/aw,2.))*exp(-pow(atan(d.x,-d.z)/uEnvAfter2.y,2.));
    c+=uEnvAfter.rgb*ab*(uEnvAfter2.x/aw);
  }

  /* COBALT clouds: a generated plate of dusk cloud`],
  ['apply',
    `          montisEnvUniforms.uEnvCloudSpan.value = THREE.MathUtils.degToRad(Math.max(20, +H.cloudSpan || 96));`,
    `          montisEnvUniforms.uEnvCloudSpan.value = THREE.MathUtils.degToRad(Math.max(20, +H.cloudSpan || 96));
          {
            const ga = Math.max(0, +H.glow || 0), gc = paletteLinear(H.glowColour);
            montisEnvUniforms.uEnvAfter.value.set(gc.x * ga, gc.y * ga, gc.z * ga, +H.glowHeight || 0);
            montisEnvUniforms.uEnvAfter2.value.set(Math.max(.004, +H.glowWidth || .035), THREE.MathUtils.degToRad(Math.max(5, +H.glowSpread || 60)));
          }`],
  ['rows',
    `            ['雲的彩度', 'horizon', 'cloudColour', 0, 1.5, .01], ['雲色調', 'horizon', 'cloudTint']`,
    `            ['雲的彩度', 'horizon', 'cloudColour', 0, 1.5, .01], ['雲色調', 'horizon', 'cloudTint'],
            ['地平線餘暉', 'horizon', 'glow', 0, 2, .01], ['餘暉顏色', 'horizon', 'glowColour'], ['餘暉高度', 'horizon', 'glowHeight', -.05, .15, .001],
            ['餘暉厚度', 'horizon', 'glowWidth', .005, .15, .001], ['餘暉寬度°', 'horizon', 'glowSpread', 10, 180, 1]`]
]);
