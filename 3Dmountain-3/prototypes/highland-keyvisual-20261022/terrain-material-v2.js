import * as THREE from 'three';

/* Highland rock & moss, v2 — the key-visual material.
   v1 (../highland-material-study-20261022/terrain-material.js) tiled a 2 m sandstone close-up every
   19 units, so its three or four beds repeated ~15 times up every peak: even, contour-like stripes.
   Here the big structure is procedural and the photo textures only supply small-scale detail.
   The beds themselves come in per vertex (attribute aStrata = continuous bed coordinate, minor-bed
   coordinate, coverage mask, computed by keyvisual.js strataAt) — the same values carve the mesh,
   so every shaded ledge sits on a carved ledge:
     · rock beds: warped, gently dipping, of irregular thickness, each with its own tone (slate,
       weathered sandstone, dark basalt, pale grit); a weathered lip on top of each bed, a dark
       recess at every bedding plane, and the beds fade in and out instead of ringing every peak
     · rain-streaks / gullies running down the faces, lichen in places
     · grass and moss on the flats AND on the treads between beds (the terraced Torridon look),
       ragged edges, patches of bracken, heather and dry straw; bare summits; scree aprons
     · a wet, darker tide line with weed at the foot of the rock
   Colour textures are used for luminance detail only (their own average divided out), so the
   orange source photo no longer decides the hue. Palette values are sRGB, decoded with s2l(). */
export function createTerrainMaterial(maps, opts = {}) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .94, metalness: 0 });
  const tune = { strataScale: 24, strata: 1, moss: 1, ...opts };
  material.userData.tune = tune;
  material.onBeforeCompile = shader => {
    for (const [name, value] of Object.entries(maps)) shader.uniforms[name] = { value };
    shader.uniforms.uStrataScale = { value: tune.strataScale };
    shader.uniforms.uStrata = { value: tune.strata };
    shader.uniforms.uMoss = { value: tune.moss };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute float terrainAO; attribute vec3 aStrata;
      varying vec3 tWorld; varying vec3 tNormal; varying float tAO; varying vec3 vStrata;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      tWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      tNormal = normalize(mat3(modelMatrix) * normal); tAO = terrainAO; vStrata = aStrata;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D rockColor, rockNormal, rockRoughness, grassColor, grassNormal, grassRoughness, erosionNormal;
      uniform float uStrataScale, uStrata, uMoss;
      varying vec3 tWorld; varying vec3 tNormal; varying float tAO; varying vec3 vStrata;
      vec3 s2l(vec3 c) { return pow(c, vec3(2.2)); }
      float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float h11(float n) { return fract(sin(n * 127.1 + 1.7) * 43758.5453); }
      float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
      float vnoise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h11(i), h11(i + 1.), f); }
      float fbm(vec2 p) { float a = .5, s = 0.; mat2 r = mat2(.8, .6, -.6, .8);
        for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= .5; } return s / .97; }
      vec3 weights(vec3 n) { vec3 w = pow(abs(n), vec3(4.)); return w / max(dot(w, vec3(1.)), .0001); }
      vec3 tri(sampler2D tex, vec3 p, vec3 w) { return texture2D(tex, p.zy).rgb * w.x + texture2D(tex, p.xz).rgb * w.y + texture2D(tex, p.xy).rgb * w.z; }
      vec3 triB(sampler2D tex, vec3 p, vec3 w, float b) { return texture2D(tex, p.zy, b).rgb * w.x + texture2D(tex, p.xz, b).rgb * w.y + texture2D(tex, p.xy, b).rgb * w.z; }
      // luminance detail of a photo texture around 1.0 (its local average divided out)
      float detail(sampler2D tex, vec3 p, vec3 w) { return clamp(luma(tri(tex, p, w)) / max(luma(triB(tex, p, w, 9.)), .04), .5, 1.6); }
      vec3 triPerturb(sampler2D tex, vec3 p, vec3 n, vec3 w) {
        vec3 x = texture2D(tex, p.zy).xyz * 2. - 1., y = texture2D(tex, p.xz).xyz * 2. - 1., z = texture2D(tex, p.xy).xyz * 2. - 1.;
        vec3 d = vec3(0., x.y, x.x) * w.x + vec3(y.x, 0., y.y) * w.y + vec3(z.x, z.y, 0.) * w.z;
        return d - n * dot(n, d);
      }
      vec3 terrainW, terrainN; float vegMix, wetMix, bedF, strataMask;
    `).replace('#include <map_fragment>', `
      terrainN = normalize(tNormal); terrainW = weights(terrainN);
      vec3 P = tWorld;
      mat2 rot = mat2(.799, .602, -.602, .799);
      vec3 Pr = vec3(rot * P.xz, P.y).xzy;                  // a rotated copy to break photo tiling
      float steep = 1. - smoothstep(.55, .86, terrainN.y);

      // --- rock beds: bold major tiers + faint minor beds ---------------------------------------
      // decided per vertex on the CPU (keyvisual.js strataAt), the same values that carved the mesh
      float bedId = floor(vStrata.x); bedF = fract(vStrata.x);
      float tone = h11(bedId * 1.37 + .5);
      float minorF = fract(vStrata.y), minorTone = h11(floor(vStrata.y) * 2.13 + .3);
      strataMask = vStrata.z * steep * uStrata;
      vec3 slate = s2l(vec3(.31, .32, .32)), sandst = s2l(vec3(.38, .34, .29)), basalt = s2l(vec3(.23, .235, .24)), grit = s2l(vec3(.45, .45, .43));
      vec3 bedCol = mix(slate, sandst, smoothstep(.0, .42, tone));
      bedCol = mix(bedCol, basalt, smoothstep(.45, .78, tone));
      bedCol = mix(bedCol, grit, smoothstep(.84, .99, tone));
      float lip = smoothstep(.82, .95, bedF) * (1. - smoothstep(.975, 1., bedF));
      float recess = 1. - smoothstep(.0, .14, bedF);            // a soft shadow band under each tread, not a hairline
      float body = .84 + .16 * smoothstep(0., .8, bedF);
      float minor = .9 + .2 * minorTone;                         // minor beds: tone only, no lines
      vec3 rock = mix(slate * (.82 + .36 * fbm(P.xz * .013)), bedCol, strataMask * .85);
      rock *= mix(1., body * minor * (1. + lip * .30) * (1. - recess * .38), strataMask);

      // two horizontal projections (faces looking along x use z, faces looking along z use x),
      // blended by the normal — stable, unlike a coordinate taken along the normal itself
      vec2 wxz = pow(abs(terrainN.xz), vec2(3.)); wxz /= max(wxz.x + wxz.y, 1e-4);
      // vertical jointing: every bed splits into blocks of their own tone (the blocky buttresses)
      float ja = P.z / 9.5 + h11(bedId * 3.1) * 7., jb = P.x / 9.5 + h11(bedId * 5.7) * 7.;
      float blockT = h21(vec2(floor(ja), bedId)) * wxz.x + h21(vec2(floor(jb), bedId + .5)) * wxz.y;
      float joint = smoothstep(.80, .97, abs(fract(ja) - .5) * 2.) * wxz.x + smoothstep(.80, .97, abs(fract(jb) - .5) * 2.) * wxz.y;
      rock *= mix(1., (.86 + .28 * blockT) * (1. - joint * .22), strataMask);

      // rock from the photo at three scales, luminance only (buttresses, blocks, grain)
      float rd1 = detail(rockColor, P / 6.5, terrainW), rd2 = detail(rockColor, Pr / 19., terrainW), rd3 = detail(rockColor, P / 57. + .31, terrainW);
      rock *= pow(rd1 * .25 + rd2 * .40 + rd3 * .35, 1.5);

      // rain streaks and gullies down the faces, lichen in places
      float streakN = fbm(vec2(P.z * .11, P.y * .011)) * wxz.x + fbm(vec2(P.x * .11, P.y * .011)) * wxz.y;
      float lichenN = fbm(vec2(P.z * .05 + 7., P.y * .02)) * wxz.x + fbm(vec2(P.x * .05 + 7., P.y * .02)) * wxz.y;
      float streak = smoothstep(.56, .80, streakN) * steep;
      float lichen = smoothstep(.64, .82, lichenN) * steep;
      rock *= 1. - streak * .34;
      rock = mix(rock, rock * vec3(1.16, 1.14, 1.02) + s2l(vec3(.06)), lichen * .4);

      // scree aprons under the faces
      float scree = smoothstep(.40, .55, terrainN.y) * (1. - smoothstep(.64, .78, terrainN.y)) * smoothstep(.5, .72, fbm(P.xz * .03 + 2.));
      rock = mix(rock, s2l(vec3(.52, .51, .48)) * rd1, scree * .55);

      // --- grass and moss --------------------------------------------------------------------
      float nb = (fbm(P.xz * .045) - .5) * .42 + (fbm(P.xz * .17 + 9.) - .5) * .16;
      float flatGround = smoothstep(.54, .76, terrainN.y + nb);
      float tread = smoothstep(.78, .965, bedF) * smoothstep(.20, .50, terrainN.y + nb * .5) * strataMask;
      vegMix = max(flatGround, tread * .9) * uMoss;
      vegMix *= 1. - smoothstep(170., 262., P.y + nb * 60.);   // bare summits
      vegMix *= smoothstep(1.2, 6., P.y);                      // nothing in the tide zone
      float pa = fbm(P.xz * .011), pb = fbm(P.xz * .032 + 4.7), pc = fbm(P.xz * .09 + 1.3), pd = fbm(P.xz * .02 + 8.);
      vec3 grass = mix(s2l(vec3(.27, .32, .17)), s2l(vec3(.36, .37, .21)), smoothstep(.35, .66, pa));   // moss green → olive
      grass = mix(grass, s2l(vec3(.40, .32, .21)), smoothstep(.60, .78, pb) * .5);                     // dead bracken, muted
      grass = mix(grass, s2l(vec3(.30, .26, .25)), smoothstep(.62, .80, pc) * .45);                    // heather
      grass = mix(grass, s2l(vec3(.48, .46, .33)), smoothstep(.72, .88, pd) * .35);                    // dry straw
      grass *= pow(detail(grassColor, P / 8., terrainW) * .55 + detail(grassColor, Pr / 23., terrainW) * .45, 1.3);
      grass *= .80 + .40 * fbm(P.xz * .06 + 5.);                                                       // tussocks, wet hollows
      grass *= mix(1., .82, tread * (1. - flatGround));                                                // ledges sit in shade
      grass *= mix(.75, 1., smoothstep(.6, .95, tAO));                                                  // gullies hold darker growth

      // --- the shore -------------------------------------------------------------------------
      wetMix = 1. - smoothstep(.4, 5., P.y);
      float weed = 1. - smoothstep(-.6, 1.5, P.y);
      vec3 col = mix(rock, grass, vegMix);
      col *= mix(1., .42, wetMix);
      col = mix(col, s2l(vec3(.17, .16, .11)), weed * .55);
      diffuseColor.rgb *= col * tAO * (1. - recess * strataMask * .18);
    `).replace('#include <roughnessmap_fragment>', `
      float rr = tri(rockRoughness, P / 6.5, terrainW).r;
      float roughnessFactor = mix(clamp(rr * .4 + .58, .6, .97), .93, vegMix);
      roughnessFactor = mix(roughnessFactor, .30, wetMix * (1. - vegMix));
    `).replace('#include <normal_fragment_maps>', `
      vec3 rdN = triPerturb(rockNormal, P / 6.5, terrainN, terrainW);
      vec3 gdN = triPerturb(grassNormal, P / 8., terrainN, terrainW);
      vec3 en = texture2D(erosionNormal, vec2((P.x + 600.) / 1200., (600. - P.z) / 1200.)).xyz * 2. - 1.;
      vec3 tangent = normalize(vec3(1., 0., 0.) - terrainN * terrainN.x);
      vec3 bitangent = normalize(cross(terrainN, tangent));
      vec3 eroded = normalize(terrainN * en.z + tangent * en.x * .7 + bitangent * en.y * .7);
      // every bed steps: the lip tilts toward the sky, the recess away from it
      vec3 upT = vec3(0., 1., 0.) - terrainN * terrainN.y; upT /= max(length(upT), .001);
      float stepTilt = smoothstep(.84, .97, bedF) - (1. - smoothstep(.0, .12, bedF)) * .7;
      vec3 wd = normalize(eroded + mix(rdN * .38 + upT * stepTilt * .5 * strataMask, gdN * .26, vegMix));
      normal = normalize(mat3(viewMatrix) * wd);
    `);
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'highland-keyvisual-v2';
  return material;
}
