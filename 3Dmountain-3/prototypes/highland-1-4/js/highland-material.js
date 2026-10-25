import * as THREE from 'three';

/* Alpine rock and snow — 2026-10-23.
   Existing slate photo supplies close mineral grain. Oblique, gravity-stretched
   gullies and triangular fracture planes supply medium-scale rock relief. Snow
   follows slope, wind shelter and broken erosion channels across broad climate
   zones; no colour or normal is addressed by a repeating height contour.
   Mirror retains the broad geology and snow mask without photo or relief work. */
export function createTerrainMaterial(maps, opts = {}) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .94, metalness: 0 });
  // grassCut: raises the slope a patch must have before grass/moss holds (0 = the key visual's look);
  // debugVeg: 1 paints every terrain pixel (r = grass coverage, g = 0, b = 1) for measuring coverage
  // tint / vegTint: albedo multipliers for rock / grass (the sunny look lifts the rock more than the grass);
  // ao: how much of the baked cavity darkening is kept; strataFar: [amount, from, to] the beds calm down with distance
  // layers: 0–1, continuous warm / cool mineral variety; no discrete height bands
  // mirror: the variant the water's reflection draws (optimisation 2026-10-22): no photo detail, no normal maps,
  // a constant rock roughness, two-octave noise — the rippled reflection cannot show any of it
  const tune = { strataScale: 24, strata: 1, moss: 1, grassCut: .18, debugVeg: 0, tint: [1, 1, 1], vegTint: [1, 1, 1], ao: 1, strataFar: [.5, 1300, 3400], layers: 0, mirror: false, ...opts };
  if (tune.mirror) material.defines.HL_MIRROR = '';
  material.userData.tune = tune;
  material.onBeforeCompile = shader => {
    for (const [name, value] of Object.entries(maps)) shader.uniforms[name] = { value };
    shader.uniforms.uStrataScale = { value: tune.strataScale };
    shader.uniforms.uStrata = { value: tune.strata };
    shader.uniforms.uMoss = { value: tune.moss };
    shader.uniforms.uGrassCut = { value: tune.grassCut };
    shader.uniforms.uDebugVeg = { value: tune.debugVeg };
    shader.uniforms.uTint = { value: new THREE.Vector3(...tune.tint) };
    shader.uniforms.uVegTint = { value: new THREE.Vector3(...tune.vegTint) };
    shader.uniforms.uAO = { value: tune.ao };
    shader.uniforms.uLayers = { value: tune.layers };
    shader.uniforms.uStrataFar = { value: new THREE.Vector3(...tune.strataFar) };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute float terrainAO;
      varying vec3 tWorld; varying vec3 tNormal; varying float tAO;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      tWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      tNormal = normalize(mat3(modelMatrix) * normal); tAO = terrainAO;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D rockDetail, grassColor, grassNormal;
      uniform float uStrataScale, uStrata, uMoss, uGrassCut, uDebugVeg, uAO, uLayers; uniform vec3 uTint, uVegTint, uStrataFar;
      varying vec3 tWorld; varying vec3 tNormal; varying float tAO;
      vec3 s2l(vec3 c) { return pow(c, vec3(2.2)); }
      float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float h11(float n) { return fract(sin(n * 127.1 + 1.7) * 43758.5453); }
      float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
      float vnoise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h11(i), h11(i + 1.), f); }
      // optimisation: 3 octaves instead of 5 (the last two were sub-pixel almost everywhere); the offset keeps the mean
      #ifdef HL_MIRROR
        #define FBM_OCT 2
        #define FBM_OFF .11
      #else
        #define FBM_OCT 3
        #define FBM_OFF .0475
      #endif
      float fbm(vec2 p) { float a = .5, s = 0.; mat2 r = mat2(.8, .6, -.6, .8);
        for (int i = 0; i < FBM_OCT; i++) { s += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= .5; } return (s + FBM_OFF) / .97; }
      // A piecewise planar field gives rock sharp fracture faces instead of
      // the rounded bumps produced by smooth noise. No texture fetches.
      float facetNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        float a = h21(i), b = h21(i + vec2(1.,0.));
        float c = h21(i + vec2(0.,1.)), d = h21(i + vec2(1.));
        return f.x + f.y < 1. ? a + (b-a)*f.x + (c-a)*f.y
          : d + (c-d)*(1.-f.x) + (b-d)*(1.-f.y);
      }
      vec3 weights(vec3 n) { vec3 w = pow(abs(n), vec3(4.)); return w / max(dot(w, vec3(1.)), .0001); }
      vec3 tri(sampler2D tex, vec3 p, vec3 w) { return texture2D(tex, p.zy).rgb * w.x + texture2D(tex, p.xz).rgb * w.y + texture2D(tex, p.xy).rgb * w.z; }
      vec3 triB(sampler2D tex, vec3 p, vec3 w, float b) { return texture2D(tex, p.zy, b).rgb * w.x + texture2D(tex, p.xz, b).rgb * w.y + texture2D(tex, p.xy, b).rgb * w.z; }
      // luminance detail of a photo texture around 1.0 (its local average divided out)
      float detail(sampler2D tex, vec3 p, vec3 w) {
      #ifdef HL_MIRROR
        return 1.;
      #else
        return clamp(luma(tri(tex, p, w)) / max(luma(triB(tex, p, w, 9.)), .04), .5, 1.6);
      #endif
      }
      vec3 triPerturb(sampler2D tex, vec3 p, vec3 n, vec3 w) {
      #ifdef HL_MIRROR
        return vec3(0.);
      #endif
        vec3 x = texture2D(tex, p.zy).xyz * 2. - 1., y = texture2D(tex, p.xz).xyz * 2. - 1., z = texture2D(tex, p.xy).xyz * 2. - 1.;
        vec3 d = vec3(0., x.y, x.x) * w.x + vec3(y.x, 0., y.y) * w.y + vec3(z.x, z.y, 0.) * w.z;
        return d - n * dot(n, d);
      }
      vec3 terrainW, terrainN; float vegMix, wetMix, strataMask, rockGrain, rockRelief, stoneRough, crestDust, alpineCut, rockFacet;
    `).replace('#include <map_fragment>', `
      terrainN = normalize(tNormal); terrainW = weights(terrainN);
      vec3 P = tWorld;
      mat2 rot = mat2(.799, .602, -.602, .799);
      vec3 Pr = vec3(rot * P.xz, P.y).xzy;                  // a rotated copy to break photo tiling
      float steep = 1. - smoothstep(.55, .86, terrainN.y);
      rockGrain = 1.; rockRelief = 0.; stoneRough = .91; alpineCut = 0.; rockFacet = .5;
      #ifndef HL_MIRROR
        // Existing slate photograph: oblique 3D projections at two scales.
        // Nothing is addressed by altitude, so cracks cannot wrap into contour rings.
        vec3 Rp = vec3(dot(P,vec3(.72,.34,.60)),dot(P,vec3(-.49,.86,.12)),dot(P,vec3(-.47,-.37,.80)));
        vec3 Rq = vec3(dot(P,vec3(.31,.71,-.63)),dot(P,vec3(-.93,.36,-.05)),dot(P,vec3(.19,.60,.78)));
        float nearStone = luma(tri(rockDetail, Rp / 19., terrainW));
        float farStone = luma(tri(rockDetail, Rq / 87. + vec3(2.7), terrainW));
        float nearMean = max(luma(triB(rockDetail, Rp / 19., terrainW, 8.)), .04);
        float farMean = max(luma(triB(rockDetail, Rq / 87. + vec3(2.7), terrainW, 8.)), .04);
        float nearDetail = clamp(nearStone / nearMean, .20, 2.1);
        float farDetail = clamp(farStone / farMean, .24, 2.0);
        float footprint = length(fwidth(P));
        float microFade = 1. - smoothstep(.20, 2.6, footprint);
        rockGrain = mix(1.,pow(nearDetail,.62),.60) * mix(1.,pow(farDetail,.70),.72);
        // Gullies run down the faces. The coarse field warps the tributaries,
        // keeping the smaller cuts attached to larger drainage channels.
        float down = P.y + dot(P.xz,vec2(.13,-.09));
        float side = dot(P.xz,vec2(.78,.63));
        vec2 valleyUV = vec2(side * .018, down * .0048);
        float bend = vnoise(valleyUV * .58 + vec2(7.8,13.2));
        float trunk = abs(fbm(valleyUV + vec2((bend-.5)*1.8,0.)) - .50);
        float tributary = abs(vnoise(vec2(side*.065 + bend*2.6, down*.014 + side*.008)) - .50);
        float broadCut = 1. - smoothstep(.025,.115,trunk);
        float branchCut = (1.-smoothstep(.028,.13,tributary)) * smoothstep(.035,.20,trunk);
        alpineCut = clamp(broadCut*.78 + branchCut*.45,0.,1.);
        vec2 fractureUV = vec2(dot(P,vec3(.71,.28,.64)),dot(P,vec3(-.40,.90,.17)));
        rockFacet = facetNoise(fractureUV*.065 + vec2(bend*.65,0.));
        float fineFacet = facetNoise(fractureUV*.18 + vec2(8.1,3.7));
        float reliefFade = 1.-smoothstep(1.8,11.,footprint);
        rockRelief = ((rockFacet-.5)*3.0 + (fineFacet-.5)*.72 - alpineCut*2.2) * reliefFade
          + (nearDetail-1.)*.024*microFade + (farDetail-1.)*.065*(1.-smoothstep(1.,8.,footprint));
        stoneRough = clamp(.90-(nearDetail-1.)*.10+alpineCut*.035,.75,.99);
      #endif

      // Directional geology: tilted through the mass, broken by slow lateral
      // variation. Continuous noise never assigns one colour to a height ring.
      float strike = dot(P.xz, vec2(.82, .57));
      float across = dot(P.xz, vec2(-.57, .82));
      float macro = fbm(P.xz * .0034 + vec2(3.3, 8.1));
      float dip = P.y + P.x * .18 - P.z * .11 + (macro - .5) * 42.;
      float geology = fbm(vec2(strike * .0075, dip * .016));
      float mineral = fbm(vec2(across * .013 + 13.7, dip * .007));
      strataMask = steep * uStrata * smoothstep(.22, .72, macro);
      strataMask *= 1. - uStrataFar.x * smoothstep(uStrataFar.y, uStrataFar.z, length(cameraPosition - P));
      // Grass follows slope and broken habitat, never a recurring ledge stripe.
      float nb = (fbm(P.xz * .045) - .5) * .42 + (fbm(P.xz * .17 + 9.) - .5) * .16;
      float flatGround = smoothstep(.54 + uGrassCut, .76 + uGrassCut, terrainN.y + nb);
      vegMix = flatGround * uMoss;
      vegMix *= 1. - smoothstep(170., 262., P.y + nb * 60.);
      vegMix *= smoothstep(1.2, 6., P.y);
      // optimisation: photo and mineral detail only where rock is visible.
      vec3 rock = vec3(0.);
      if (vegMix < .998) {
      vec3 slate = s2l(vec3(.255, .265, .275));
      vec3 warmStone = s2l(vec3(.39, .38, .355));
      vec3 coolStone = s2l(vec3(.23, .25, .27));
      vec3 limestone = s2l(vec3(.47, .48, .475));
      vec3 geologyColour = mix(coolStone, warmStone, smoothstep(.22, .73, geology));
      geologyColour = mix(geologyColour, limestone, smoothstep(.58, .82, mineral) * .40);
      rock = mix(slate, geologyColour, clamp(.28 + uLayers * .48 + strataMask * .20, 0., .88));
      rock *= .86 + .28 * macro;

      // Stronger mid-scale rock grain gives the aerials real talus texture,
      // while larger mineral masses keep distant slopes legible.
      rock *= clamp(rockGrain,.48,1.65);
      // Broad dark cuts remain legible in aerial views; the angular planes
      // catch the scene light rather than painting a fake sun into the rock.
      float fractureShade = smoothstep(.66,.90,mineral)*steep;
      rock *= (1.-fractureShade*.20) * (1.-alpineCut*steep*.40);
      rock *= mix(.76,1.18,rockFacet);
      rock = mix(rock,s2l(vec3(.48,.49,.475)),smoothstep(.66,.85,geology)*.15);

      // scree aprons under the faces
      float scree = smoothstep(.40, .55, terrainN.y) * (1. - smoothstep(.64, .78, terrainN.y)) * smoothstep(.5, .72, fbm(P.xz * .03 + 2.));
      rock = mix(rock, s2l(vec3(.39, .385, .37)) * clamp(rockGrain,.65,1.4), scree * .42);

      }
      vec3 grass = vec3(0.);
      if (vegMix > .002) {
      float pa = fbm(P.xz * .011), pb = fbm(P.xz * .032 + 4.7), pc = fbm(P.xz * .09 + 1.3), pd = fbm(P.xz * .02 + 8.);
      grass = mix(s2l(vec3(.26, .32, .235)), s2l(vec3(.355, .38, .29)), smoothstep(.35, .66, pa));   // moss green → olive
      grass = mix(grass, s2l(vec3(.40, .32, .21)), smoothstep(.60, .78, pb) * .5);                     // dead bracken, muted
      grass = mix(grass, s2l(vec3(.30, .26, .25)), smoothstep(.62, .80, pc) * .45);                    // heather
      grass = mix(grass, s2l(vec3(.48, .46, .33)), smoothstep(.72, .88, pd) * .35);                    // dry straw
      grass *= pow(detail(grassColor, P / 8., terrainW) * .55 + detail(grassColor, Pr / 23., terrainW) * .45, 1.3);
      grass *= .80 + .40 * fbm(P.xz * .06 + 5.);                                                       // tussocks, wet hollows
      grass *= mix(.75, 1., smoothstep(.6, .95, tAO));                                                  // gullies hold darker growth

      }

      // Snow is an accumulated surface: sheltered slopes and drainage cuts
      // retain it while wind-facing cliffs expose dark rock. Broad warped
      // climate variation avoids a level snowline or a ring around each peak.
      float snowNoise = fbm(P.xz*.021 + vec2(P.y*.006,9.2));
      float sheltered = clamp(.5-dot(terrainN.xz,vec2(-.82,.57))*.7,0.,1.);
      float cavity = 1.-smoothstep(.63,.98,tAO);
      float climate = smoothstep(600.,1350.,P.y+(macro-.5)*180.+(mineral-.5)*65.);
      float support = terrainN.y+(snowNoise-.5)*.12+sheltered*.07+alpineCut*.06+cavity*.05;
      float snowHold = smoothstep(.45,.85,support);
      float snowSupply = climate*(.10+snowHold*.90)+alpineCut*climate*.06;
      crestDust = smoothstep(.18,.80,snowSupply);
      // High alpine snowfields still expose the sheer rock faces.
      crestDust *= smoothstep(.025,.24,terrainN.y+alpineCut*.11+sheltered*.045);
      vec3 snow = s2l(mix(vec3(.82,.86,.89),vec3(.945,.95,.935),smoothstep(.23,.80,snowNoise)));
      snow *= mix(.88,1.035,smoothstep(.58,.99,tAO));
      grass = mix(grass,snow,crestDust);
      rock = mix(rock,snow,crestDust);

      // --- the shore -------------------------------------------------------------------------
      wetMix = 1. - smoothstep(.4, 5., P.y);
      float weed = 1. - smoothstep(-.6, 1.5, P.y);
      vec3 col = mix(rock, grass, vegMix);
      col *= mix(1., .42, wetMix);
      col = mix(col, s2l(vec3(.17, .16, .11)), weed * .55);
      diffuseColor.rgb *= col * mix(uTint, uVegTint, vegMix) * mix(1., tAO, uAO);
    `).replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = mix(mix(stoneRough, .94, vegMix), .96, crestDust);
      roughnessFactor = mix(roughnessFactor, .30, wetMix * (1. - vegMix));
    `).replace('#include <normal_fragment_maps>', `
      vec3 gdN = vegMix > .002 ? triPerturb(grassNormal, P / 8., terrainN, terrainW) : vec3(0.);
      vec3 rockN = terrainN;
      #ifndef HL_MIRROR
        // World-space surface derivatives perturb only the mineral grain;
        // no horizontal photographic normal, terraced tilt or former island bake.
        vec3 grainDx = dFdx(P), grainDy = dFdy(P);
        vec3 grainRx = cross(grainDy, terrainN), grainRy = cross(terrainN, grainDx);
        float grainDet = dot(grainDx, grainRx);
        vec3 grainGradient = sign(grainDet) * (dFdx(rockRelief)*grainRx + dFdy(rockRelief)*grainRy);
        rockN = normalize(max(abs(grainDet),.000001)*terrainN - grainGradient);
      #endif
      float detailFade = 1. - smoothstep(800., 2200., length(cameraPosition - P));
      // Settled snow softens small fracture normals while retaining the actual
      // serrated mountain surface supplied by the mesh.
      rockN = normalize(mix(rockN,terrainN,crestDust*.55));
      vec3 wd = normalize(mix(rockN, terrainN + gdN*.23*detailFade, vegMix*(1.-crestDust)));
      normal = normalize(mat3(viewMatrix) * wd);
    `).replace('#include <dithering_fragment>', `#include <dithering_fragment>
      if (uDebugVeg > .5) gl_FragColor = vec4(vegMix, 0., 1., 1.);`);
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'highland-index1-4-alpine-v9-clean-dissolve' + (tune.mirror ? '-mirror' : '');
  return material;
}
