/* index1-5 only · submerged cyan light pools.
   Runs after opening-sea-depth. It patches the copied opening material only:
   shared seaMaterial (the canyon / river) and the existing water/air blend are untouched.
   Frame updates bind uWaterRise to the existing light-specks time/config. No draw or target is added. */
const INJECTION = /* glsl */ `
      // Broad underwater light gathers before the luminous flecks rise.
      // Four unequal pools are tied to world water; the live normal breaks their reflected edges.
      if (uWaterRise.x > .001) {
        float wrTime = uWaterRise.y;
        vec2 wrP = vWorld.xz + nrm.xz * (1.1 + min(vDist, 80.) * .015);
        vec2 wrA = (wrP - vec2(-6., -9.)) / vec2(3.6, 7.5);
        vec2 wrB = (wrP - vec2(7., -17.)) / vec2(4.4, 9.5);
        vec2 wrC = (wrP - vec2(-13., -27.)) / vec2(5.8, 12.);
        vec2 wrD = (wrP - vec2(16., -40.)) / vec2(7.8, 16.);
        float wrPools = exp(-dot(wrA, wrA)) * (.73 + .23 * sin(wrTime * .37))
          + exp(-dot(wrB, wrB)) * (.71 + .21 * sin(wrTime * .29 + 1.8))
          + exp(-dot(wrC, wrC)) * (.62 + .18 * sin(wrTime * .33 + 3.9))
          + exp(-dot(wrD, wrD)) * (.56 + .16 * sin(wrTime * .24 + 5.4));
        // Crest-broken reflections, band-limited into a calm mean as pixels grow offshore.
        float wrDetail = 1. - smoothstep(.35, 1.3, length(fwidth(wrP)));
        float wrLace = .48 + .52 * smoothstep(-.7, .8,
          sin(wrP.x * 1.6 + wrP.y * .82 - wrTime * .62 + nrm.z * 12.));
        float wrFacet = mix(.72, wrLace, wrDetail) * (.48 + .52 * smoothstep(-.09, .15, nrm.z));
        float wrMid = smoothstep(5., 13., vDist) * (1. - smoothstep(70., 150., vDist));
        // A quiet central channel protects the title and glass drop. No screen-space overlay.
        float wrReading = mix(.16, 1., smoothstep(.035, .22, abs(view.x)));
        float wrGain = clamp(uWaterRise.x, 0., 1.) * (.28 + .08 * clamp(uWaterRise.z, 0., 1.));
        col += uWaterRiseColor * wrPools * wrFacet * wrMid * wrReading * wrGain;
      }
`;

module.exports = ({ main, drops, letters, glass, html }) => {
  const marker = '/* water-rise-pools-20261025 */';
  if (main.includes(marker)) return { main, drops, letters, glass, html };
  const anchor = '      const RIVER_ROOM_KEYS = ';
  if (main.split(anchor).length !== 2) throw Error('water-rise pools: opening material anchor');
  const patch = `      ${marker}
      {
        const material = openingSeaMaterial;
        const anchor = 'col=montisVeil(col,view);';
        if (material.fragmentShader.split(anchor).length !== 2) throw Error('water-rise pools: veil shader anchor');
        material.uniforms.uWaterRise = { value: new THREE.Vector4(0, 0, 0, 0) };
        material.uniforms.uWaterRiseColor = { value: new THREE.Color('#4fbcff') };
        material.fragmentShader = ${JSON.stringify('uniform vec4 uWaterRise;\nuniform vec3 uWaterRiseColor;\n')}
          + material.fragmentShader.replace(anchor, ${JSON.stringify(INJECTION)} + '\\n' + anchor);
        material.needsUpdate = true;
      }
`;
  main = main.replace(anchor, () => patch + anchor);
  return { main, drops, letters, glass, html };
};
