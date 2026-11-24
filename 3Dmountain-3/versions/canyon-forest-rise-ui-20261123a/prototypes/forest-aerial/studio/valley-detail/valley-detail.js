/* valley-detail.js — VALLEY DETAIL (2026-11-24, client: 「俯視山谷你可以依據 magic_valley 跟 山谷/textures 這2檔案的方式 幫我貼材質的方式跟現在的方做出
   完美的結合，利用材質圖增加更多細節」).
   Their way: one terrain, one big picture baked from above (colour + normal) that carries the erosion: gullies, ridgelets, streaks, canopy grain.
   Ours: the live PBR land (studio-terrain-pbr-layer.js: tiled grass / moss / rock scans, our colours, our light).
   Together: our land stays exactly as it is, and a second, light pass over the same surface multiplies in the small things from their pictures
   (vd-detail-1024.webp, made by .qa/valley-detail/make-detail.py from the two CC-BY-4.0 maps; credit in docs/valley-detail/README.md):
     · erosion relief (their normal, high-passed) lit by OUR sun: gullies and ridgelets on every slope, stronger where it is steep;
     · erosion streaks (their colour's brightness, high-passed) on the slopes;
     · meadow / canopy grain (Magic Valley's brightness, high-passed) on the gentler ground.
   Why a second pass: the land's program already uses all 16 texture units, so it cannot read one more picture. This pass shares the land's
   geometry and vertex shader (same uniforms by reference: it follows every relief, falls and arrival change) and a 2× multiply blend
   (result = 2 × its colour × the land's), so 0.5 = unchanged. Water, the shore strip and the far haze are left alone.
   Only made by flow2-studio-pbr-view.js on html[data-rise-ui] unless ?vtex=0. Dials: ?vdStr ?vdTiles ?vdRelief ?vdStreak ?vdMeadow,
   live: window.__VALLEY_DETAIL__.u (uVD = strength, tiles, relief, meadow · uVD2 = streaks, fade from, fade to, arrival). */
import * as THREE from 'three';
import { HIGHLAND_GLSL } from '../studio-highland-ecology.js?v=weather1-bank1-fast1';   /* the land's clouds, valley air: same stamp as the land */

const VER = 's3', VER_TX = 't2';   /* the picture's stamp (module s6: mirror pass skipped, lake shore) */
/* one picture for every user (the land's pass here, the lake's drowned slopes in falls/falls-water.js): one download, one upload */
let texPromise = null;
export function loadDetailTexture(renderer) {
  return texPromise || (texPromise = new THREE.TextureLoader().loadAsync(new URL('./vd-detail-1024.webp?v=' + VER, import.meta.url).href).then(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4); tex.needsUpdate = true;
    return tex;
  }));
}
const FRAG = /* glsl */`
  uniform sampler2D tCanopy, tWater, tVD;
  uniform vec4 uBounds; uniform vec2 uYRange; uniform float uRelief; uniform vec3 uSun;
  uniform vec4 uVD, uVD2; uniform float uMirror;
  uniform vec4 uLK; uniform vec3 uLKShallow, uLKMid, uLKDeep;   /* LAKE SHORE: strength · reach (land uv) · floor relief · - · colour factors over the lake's own colour */
  varying vec3 vForestWorld;
  float vdGround(vec2 uv) { return uYRange.x + texture2D(tCanopy, uv).r * uYRange.y; }
  void main() {
    if (uMirror > .5) discard;   /* never in the water's mirror pass (it is also kept off the mirror camera's layer) */
    vec2 uv = clamp((vForestWorld.xz - uBounds.xy) * uBounds.zw, 0., 1.);
    vec2 e = 1. / vec2(textureSize(tCanopy, 0));
    float hl = vdGround(uv - vec2(e.x, 0.)), hr = vdGround(uv + vec2(e.x, 0.)), hd = vdGround(uv - vec2(0., e.y)), hu = vdGround(uv + vec2(0., e.y));
    vec2 dw = 2. * e / uBounds.zw;
    vec3 N = normalize(vec3(-(hr - hl) * uRelief / dw.x, 1., -(hu - hd) * uRelief / dw.y));
    float relY = (vdGround(uv) - .105) * uRelief;
    vec4 wt = texture2D(tWater, uv);
    float water = smoothstep(.12, .45, wt.r);
    float landK = (1. - water) * smoothstep(-.001, .01, relY) * smoothstep(.104, .118, vForestWorld.y);   /* down to the waterline (not in a carved bowl) */
    /* two scales, the second turned and offset: no visible repeat */
    vec2 p = (vForestWorld.xz - uBounds.xy) * uBounds.z * uVD.y;   /* world, one scale for both axes */
    vec4 d1 = texture2D(tVD, p);
    vec4 d2 = texture2D(tVD, mat2(.8, -.6, .6, .8) * p * 2.31 + vec2(.37, .11));
    float steep = smoothstep(.06, .42, 1. - N.y);
    vec2 nd = (d1.rg - .5) * 2. + (d2.rg - .5) * .9;
    vec3 Nd = normalize(N + vec3(nd.x, 0., nd.y) * uVD.z * (.5 + .9 * steep));
    vec3 L = normalize(uSun);
    float shade = (max(dot(Nd, L), 0.) + .42) / (max(dot(N, L), 0.) + .42);
    float streak = 1. + ((d1.b - .5) * 1.3 + (d2.b - .5) * .6) * uVD2.x * (.35 + .65 * steep);
    float grain = 1. + ((d1.a - .5) * 1.2 + (d2.a - .5) * .7) * uVD.w * (1. - .6 * steep);
    float far = 1. - smoothstep(uVD2.y, uVD2.z, distance(cameraPosition, vForestWorld));
    float k = clamp(uVD.x * landK * far * uVD2.w, 0., 1.5);
    float mul = mix(1., clamp(shade * streak * grain, .5, 1.6), k);
    vec3 outC = vec3(mul);
    /* LAKE SHORE (2026-11-24, client: Crater Lake 「湖泊周圍這種銜接感」): clear water over a drowned slope. How far in from the shore comes
       from the water mask round this place (three rings of six taps, only on the lake); near the shore a bright shallow shelf, then blue,
       then deep navy; the slope's own erosion relief (this same picture) runs on under the water, lit by the sun, fading with depth. */
    float lake = water * smoothstep(.45, .8, wt.b) * uLK.x;
    if (lake > .002) {
      float s = 0.; vec2 g = vec2(0.);
      for (int k = 0; k < 6; k++) {
        float a = float(k) * 1.0472 + .52;
        vec2 d = vec2(cos(a), sin(a));
        float w1 = texture2D(tWater, uv + d * uLK.y).r, w2 = texture2D(tWater, uv + d * uLK.y * 2.6).r, w3 = texture2D(tWater, uv + d * uLK.y * 5.5).r;
        s += w1 * .30 + w2 * .33 + w3 * .37; g += d * (w1 * .5 + w2 * .3 + w3 * .2);
      }
      s /= 6.;
      float dep = smoothstep(.52, .97, s);
      float seen = .15 + .85 * (1. - pow(dep, .75));
      vec3 Nf = normalize(vec3(g.x * 1.6 * (1. - dep), 1., g.y * 1.6 * (1. - dep)) + vec3(nd.x, 0., nd.y) * uLK.z);
      float fShade = clamp((max(dot(Nf, L), 0.) + .3) / (max(L.y, 0.) + .3), .5, 1.7);
      vec3 f = mix(uLKShallow, uLKMid, smoothstep(0., .5, dep));
      f = mix(f, uLKDeep, smoothstep(.42, 1., dep));
      f *= mix(1., fShade * (1. + (d1.b - .5) * .3), seen);
      outC = mix(outC, f, clamp(lake * far * uVD2.w, 0., 1.));
    }
    gl_FragColor = vec4(clamp(outC * .5, 0., 1.), 1.);
  }`;

/* TEXTURE PASS (2026-11-24, client: 「山谷你沒有貼材質??? 我要材質搭配原本3D草皮阿」): the reference maps' own MATERIALS, in colour, laid on the
   land where they belong, over our 3D turf, which stays on the meadows:
     · rock: "Mountain Range 01"'s eroded tan slopes (gullies, scree, grassy seams) on the steep ground and broken ridges;
     · forest: "Magic Valley"'s tree canopy in patches on the gentle-to-mid slopes.
   Lit like the land (the gorge's recipe: the page's sun key, sky fill, cloud shadows, valley air, arrival, vignette) plus a short march on
   the height map for the hills' own shadows; blended over the land with soft edges (alpha). ?vtexMat=0 = off; dials ?vtRock ?vtForest ?vtTiles ?vtSlope ?vtCover. */
const TEX_FRAG = /* glsl */`
  uniform sampler2D tCanopy, tWater, tVD, tRockC, tForestC;
  uniform vec4 uBounds; uniform vec2 uYRange; uniform float uRelief; uniform vec3 uSun;
  uniform float uMirror, uSunIntensity, uStudioMist, uAirWhite, uDist, uVig, uLattice, uTime;
  uniform vec3 uLatticeGround; uniform vec4 uView;
  uniform vec4 uTX;   /* rock amount · forest amount · tiles across the land · slope where rock starts (1 - N.y) */
  uniform vec4 uTX2;  /* forest cover · forest patch scale · rock albedo gain · arrival */
  uniform vec4 uTXF;  /* cost switches: cloud shadows · valley air · hill shadows · - */
  varying vec3 vForestWorld;
  /* the helpers HIGHLAND_GLSL expects (as in falls-gorge.js) */
  float forestHash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float forestNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(forestHash(i),forestHash(i+vec2(1.0,0.0)),f.x),mix(forestHash(i+vec2(0.0,1.0)),forestHash(i+vec2(1.0,1.0)),f.x),f.y); }
  float stFbm2(vec2 p){ return forestNoise(p)*0.67+forestNoise(mat2(0.80,-0.60,0.60,0.80)*p*2.04+vec2(7.3,4.1))*0.33; }
  ${HIGHLAND_GLSL}
  float txGround(vec2 uv) { return uYRange.x + texture2D(tCanopy, uv).r * uYRange.y; }
  float txLum(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
  void main() {
    if (uMirror > .5 || uTXF.w > .5) discard;   /* uTXF.w: a cost probe (?vtProbe=1 = the pass's geometry only) */
    vec2 uv = clamp((vForestWorld.xz - uBounds.xy) * uBounds.zw, 0., 1.);
    vec2 e = 1. / vec2(textureSize(tCanopy, 0));
    float h0 = txGround(uv), hl = txGround(uv - vec2(e.x, 0.)), hr = txGround(uv + vec2(e.x, 0.)), hd = txGround(uv - vec2(0., e.y)), hu = txGround(uv + vec2(0., e.y));
    vec2 dw = 2. * e / uBounds.zw;
    vec3 N = normalize(vec3(-(hr - hl) * uRelief / dw.x, 1., -(hu - hd) * uRelief / dw.y));
    float relY = (h0 - .105) * uRelief;
    vec4 wt = texture2D(tWater, uv);
    float landK = (1. - smoothstep(.12, .45, wt.r)) * smoothstep(.0, .012, relY) * smoothstep(.104, .118, vForestWorld.y);
    if (landK < .003) discard;
    /* masks: rock on the steep ground and on convex ridges, broken by noise; forest in patches on gentle-to-mid slopes */
    float conv = (hl + hr + hd + hu) * .25 - h0;                  /* < 0 on ridges */
    float slope = 1. - N.y;
    vec2 ui = (vForestWorld.xz - uBounds.xy) * uBounds.z;   /* one scale for both axes: round patches, not streaks */
    float rn = stBkNoise(ui * 64.) * .6 + stBkNoise(ui * 151. + 3.1) * .4;
    float rockA = clamp(smoothstep(uTX.w, uTX.w + .22, slope + (rn - .5) * .22) + smoothstep(.0004, .0025, -conv * uRelief) * .45 * smoothstep(.04, .2, slope), 0., 1.) * uTX.x;
    float fn = stBkNoise(ui * uTX2.y) * .62 + stBkNoise(ui * uTX2.y * 2.7 + 5.3) * .38;
    fn += (stBkNoise(ui * uTX2.y * 9.) - .5) * .16;   /* a ragged, soft forest edge */
    float forestA = smoothstep(1. - uTX2.x - .06, 1. - uTX2.x + .16, fn) * (1. - smoothstep(uTX.w * .8, uTX.w + .1, slope)) * smoothstep(.006, .03, relY) * uTX.y;
    float a = 1. - (1. - rockA) * (1. - forestA);
    if (a < .003) discard;
    /* the materials: two scales, the second turned, mixed by a slow noise (no visible repeat) */
    vec2 p = (vForestWorld.xz - uBounds.xy) * uBounds.z * uTX.z, q = mat2(.8, -.6, .6, .8) * p * 1.63 + vec2(.31, .17);   /* world, one scale for both axes, not clamped */
    float mixN = smoothstep(.3, .7, stBkNoise(ui * 19.));
    #ifdef VT_LITE
    vec3 rockC = vec3(.3,.26,.22), forC = vec3(.1,.14,.07);
    #else
    #ifdef VT_ONE
    /* one tap each: the place picks one of the two placings (no blend: half the reads) */
    vec2 pr = mixN > .5 ? q : p;
    vec3 rockC = pow(texture2D(tRockC, pr).rgb, vec3(2.2)) * uTX2.z;
    vec3 forC = pow(texture2D(tForestC, pr * 1.6).rgb, vec3(2.2));
    #else
    vec3 rockC = pow(mix(texture2D(tRockC, p).rgb, texture2D(tRockC, q).rgb, mixN), vec3(2.2)) * uTX2.z;
    vec3 forC = pow(mix(texture2D(tForestC, p * 1.6).rgb, texture2D(tForestC, q * 1.6).rgb, mixN), vec3(2.2));
    #endif
    #endif
    vec4 d1 = texture2D(tVD, p), d2 = texture2D(tVD, q);
    vec2 nd = (d1.rg - .5) * 2. + (d2.rg - .5) * .9;
    vec3 Nr = normalize(N + vec3(nd.x, 0., nd.y) * .9);
    /* light: the page's sun key and sky fill, the clouds' shadows, the hills' own shadow (4 taps toward the sun on the height map) */
    vec3 L = normalize(uSun);
    vec2 ldir = normalize(L.xz + 1e-5); float tanE = L.y / max(length(L.xz), 1e-3);
    float y0 = .105 + relY, occ = 0.;
    #ifdef VT_SHADOW
    for (int k = 1; k <= 4; k++) {
      float t = float(k * k) * .028;
      vec2 su = uv + ldir * t * uBounds.zw;
      float yk = .105 + (txGround(su) - .105) * uRelief;
      occ = max(occ, smoothstep(.0, .012, yk - (y0 + t * tanE)));
    }
    #endif
    float sunVis = 1. - occ * .85;
    #ifdef VT_CLOUDS
    sunVis *= stCloudVisibility3(vForestWorld);
    #endif
    float lit = max(dot(Nr, L), 0.) * sunVis;
    vec3 sunKey = vec3(2.12, 1.99, 1.72) * clamp(uSunIntensity, .25, 2.);
    vec3 rockAmb = mix(vec3(.27, .30, .33), vec3(.40, .44, .47), max(0., Nr.y));
    vec3 colRock = rockC * (rockAmb * .72 + sunKey * .78 * lit);
    colRock /= 1. + max(0., txLum(colRock) - .26) * .93;
    vec3 skyFill = vec3(.16, .24, .35), bounce = vec3(.065, .077, .085);
    vec3 turfAmb = skyFill * (.44 + .56 * max(0., Nr.y)) + bounce * (.3 + .7 * (1. - max(0., Nr.y)));
    vec3 colFor = forC * 1.25 * (turfAmb + sunKey * lit * .92);
    vec3 col = mix(colFor, colRock, rockA / max(rockA + forestA * (1. - rockA), 1e-3));
    col = col / (1. + col * .20);
    if (uStudioMist > .002) {
      vec3 V = normalize(cameraPosition - vForestWorld);
      float farA = smoothstep(uDist * .61, uDist * 2.35, length(cameraPosition - vForestWorld));
      float oblique = 1. - smoothstep(.52, .96, abs(V.y));
      vec3 air = mix(mix(vec3(.32, .44, .62), vec3(.86, .90, .95), pow(max(dot(-V, L), 0.), 2.) * .6), vec3(.86, .90, .94), uAirWhite);
      col = mix(col, air, clamp(farA * (.28 + .66 * oblique) * .64 * uStudioMist, 0., .74));
    }
    #ifdef VT_AIR
    col = stValleyAir(col, vec3(vForestWorld.x, max(vForestWorld.y, .105), vForestWorld.z), cameraPosition);
    #endif
    col = mix(vec3(txLum(col) * .88 + .008), col, uTX2.w);
    vec2 sc = (gl_FragCoord.xy - uView.xy) / uView.zw - .5;
    col *= 1. - uVig * smoothstep(.5, 1.9, dot(sc, sc) * 4.);
    col = mix(col, uLatticeGround, clamp(uLattice, 0., 1.));
    gl_FragColor = vec4(col, clamp(a * landK, 0., 1.));
  }`;

export async function createValleyDetail(renderer, atlas, { query = new URLSearchParams(location.search), fusion = false } = {}) {
  /* fusion (the -ui page's 261124 land, 2026-11-24): that land carries its own erosion and materials, so this file only keeps the LAKE SHORE;
     ?vdStr= / ?vtexMat=1 bring the detail / texture passes back over it */
  const num = (k, d) => { const v = query.get(k); return v != null && v !== '' && Number.isFinite(+v) ? +v : d; };
  let land = null;
  atlas.scene.traverse(o => { if (!land && o.isMesh && o.material && o.material.fragmentShader && o.material.fragmentShader.includes('uPbrStyle') && o.material.vertexShader.includes('vForestWorld')) land = o; });
  if (!land) throw new Error('valley detail: no land mesh');
  const tex = await loadDetailTexture(renderer);
  const L = land.material;
  const u = {
    tVD: { value: tex },
    uVD: { value: new THREE.Vector4(num('vdStr', fusion ? 0 : 1), num('vdTiles', 3), num('vdRelief', 1.1), num('vdMeadow', .6)) },
    uVD2: { value: new THREE.Vector4(num('vdStreak', .6), num('vdFar0', 18), num('vdFar1', 34), 1) },
    /* LAKE SHORE dials: ?lakeShore=0 off · ?lakeReach (land uv, .006) · ?lakeRelief (1.3) · colour factors (× the lake's colour) */
    uLK: { value: new THREE.Vector4(query.get('lakeShore') === '0' ? 0 : num('lakeShore', 1), num('lakeReach', .01), num('lakeRelief', 1.8), 0) },
    uLKShallow: { value: new THREE.Vector3(1.3, 1.9, 1.85) }, uLKMid: { value: new THREE.Vector3(.7, 1.15, 1.55) }, uLKDeep: { value: new THREE.Vector3(.28, .55, 1.05) }
  };
  const mat = new THREE.ShaderMaterial({
    name: 'valley-detail', vertexShader: L.vertexShader, fragmentShader: FRAG, defines: { ...(L.defines || {}) },
    uniforms: { ...L.uniforms, uSun: atlas.uniforms.uSun, ...u },
    transparent: false, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.SrcColorFactor,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2
  });
  const mesh = new THREE.Mesh(land.geometry, mat);
  /* drawn with the solid things, right after the land (its renderOrder + 1): everything see-through (clouds, mist, the falls' water) comes after
     it and is not multiplied; trees and rocks in front hide it by depth */
  mesh.name = 'Valley detail'; mesh.frustumCulled = land.frustumCulled; mesh.renderOrder = (land.renderOrder || 0) + 1;
  mesh.matrixAutoUpdate = false;
  const parent = land.parent || atlas.scene;
  let texOn = true, texMesh = null, texMat = null, tu = null;
  const sync = () => { mesh.matrix.copy(land.matrix); mesh.visible = land.visible && on; if (texMesh) { texMesh.matrix.copy(land.matrix); texMesh.visible = land.visible && on && texOn; } };
  let on = true;
  /* its own layer, seen by the view's camera only: the water's mirror pass (flow2-original-scene.js mirrorCam, layer 0) skips it */
  mesh.layers.set(5); atlas.camera?.layers?.enable(5);
  sync(); parent.add(mesh);
  /* TEXTURE PASS: colour materials over the land, after the detail multiply (renderOrder + 2) */
  if (fusion ? query.get('vtexMat') === '1' : query.get('vtexMat') !== '0') {
    const ld = name => new THREE.TextureLoader().loadAsync(new URL('./' + name + '?v=' + VER_TX, import.meta.url).href).then(t => {
      t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.format = THREE.RGBAFormat; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;   /* plain RGBA8 with mip-maps (an sRGB upload cost 2.6 ms here); decoded in the shader */ t.anisotropy = Math.min(num('vtAniso', 4), renderer.capabilities.getMaxAnisotropy()); t.needsUpdate = true; return t; });
    const [rockC, forestC] = await Promise.all([ld('vd-rock-1024.webp'), ld('vd-forest-1024.webp')]);
    const A = atlas.uniforms;
    tu = {
      tRockC: { value: rockC }, tForestC: { value: forestC },
      uTX: { value: new THREE.Vector4(num('vtRock', 1), num('vtForest', 1), num('vtTiles', 7), num('vtSlope', .25)) },
      uTX2: { value: new THREE.Vector4(num('vtCover', .32), num('vtPatch', 22), num('vtRockGain', .5), 1) },
      uTXF: { value: new THREE.Vector4(num('vtClouds', 1), num('vtAir', 1), num('vtShadow', 1), num('vtProbe', 0)) }
    };
    texMat = new THREE.ShaderMaterial({
      name: 'valley-textures', vertexShader: L.vertexShader, fragmentShader: TEX_FRAG, defines: { ...(L.defines || {}), ...(num('vtClouds', 1) ? { VT_CLOUDS: 1 } : {}), ...(num('vtAir', 1) ? { VT_AIR: 1 } : {}), ...(num('vtShadow', 1) ? { VT_SHADOW: 1 } : {}), ...(num('vtLite', 0) ? { VT_LITE: 1 } : {}), ...(num('vtOne', 0) ? { VT_ONE: 1 } : {}) },
      uniforms: { ...L.uniforms, uSun: A.uSun, tVD: u.tVD, uView: A.uView || L.uniforms.uView, uVig: A.uVig || L.uniforms.uVig || { value: 0 },
        uLattice: A.uLattice || L.uniforms.uLattice, uLatticeGround: A.uLatticeGround || L.uniforms.uLatticeGround, uDist: A.uDist || L.uniforms.uDist || { value: 20 }, ...tu },
      transparent: false, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth,
      blending: THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3
    });
    texMesh = new THREE.Mesh(land.geometry, texMat);
    texMesh.name = 'Valley textures'; texMesh.frustumCulled = land.frustumCulled; texMesh.renderOrder = (land.renderOrder || 0) + 2; texMesh.matrixAutoUpdate = false;
    texMesh.layers.set(5); texMesh.matrix.copy(land.matrix); parent.add(texMesh);
  }
  const api = {
    mesh, u, land, get texMesh() { return texMesh; }, get tu() { return tu; },
    setTexOn(v) { texOn = !!v; sync(); },
    update() { sync(); },
    setArrival(a) { u.uVD2.value.w = Math.max(0, Math.min(1, +a || 0)); if (tu) tu.uTX2.value.w = u.uVD2.value.w; },
    setOn(v) { on = !!v; sync(); },
    get state() { return { on, ver: VER, tiles: u.uVD.value.y, strength: u.uVD.value.x }; },
    dispose() { parent.remove(mesh); mat.dispose(); if (texMesh) { parent.remove(texMesh); texMat.dispose(); tu.tRockC.value.dispose(); tu.tForestC.value.dispose(); } }   /* the picture is shared with the lake: kept */
  };
  window.__VALLEY_DETAIL__ = api;
  if (query.get('vtPanel') === '1' || query.get('vtPanel') === '0') makePanel(api, query.get('vtPanel') === '1');
  else addEventListener('keydown', e => { if (e.key === 'F9' && !api.panel) makePanel(api, true); }, { once: false });
  return api;
}

/* 「材質比例」 panel (2026-11-24, client: 「調材質比例」): live sliders for the texture pass and the detail pass; 「複製參數 JSON」 copies the values
   (send them back to be baked into the defaults). ?vtPanel=1 opens it, F9 toggles it. Nothing is saved in the browser. */
function makePanel(api, open) {
  if (api.panel) { api.panel.style.display = api.panel.style.display === 'none' ? '' : 'none'; return; }
  const tu = api.tu, u = api.u;
  const rows = [
    ['森林覆蓋', 'vtCover', () => tu.uTX2.value.x, v => tu.uTX2.value.x = v, 0, .8, .01],
    ['森林塊細碎（大＝小塊）', 'vtPatch', () => tu.uTX2.value.y, v => tu.uTX2.value.y = v, 6, 70, 1],
    ['森林濃度', 'vtForest', () => tu.uTX.value.y, v => tu.uTX.value.y = v, 0, 1.5, .01],
    ['岩石量', 'vtRock', () => tu.uTX.value.x, v => tu.uTX.value.x = v, 0, 1.5, .01],
    ['多陡開始是岩石（小＝岩石多）', 'vtSlope', () => tu.uTX.value.w, v => tu.uTX.value.w = v, .06, .6, .01],
    ['岩石亮度', 'vtRockGain', () => tu.uTX2.value.z, v => tu.uTX2.value.z = v, .15, 1.2, .01],
    ['材質密度（大＝細）', 'vtTiles', () => tu.uTX.value.z, v => tu.uTX.value.z = v, 2, 16, .1],
    ['侵蝕紋強度', 'vdStr', () => u.uVD.value.x, v => u.uVD.value.x = v, 0, 2, .01],
    ['侵蝕紋起伏', 'vdRelief', () => u.uVD.value.z, v => u.uVD.value.z = v, 0, 2.5, .01],
    ['湖岸', 'lakeShore', () => u.uLK.value.x, v => u.uLK.value.x = v, 0, 1.5, .01]
  ].filter(r => tu || !r[1].startsWith('vt'));
  const start = Object.fromEntries(rows.map(r => [r[1], r[2]()]));
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:14px;top:84px;z-index:2147483000;width:290px;padding:12px 14px;border-radius:12px;background:rgba(12,20,28,.82);' +
    'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#dfe9f0;font:12px/1.35 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12)';
  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:13px">材質比例</b><span style="opacity:.6">F9 開關</span></div>';
  const fmt = v => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2));
  for (const [label, key, get, set, lo, hi, st] of rows) {
    const row = document.createElement('label'); row.style.cssText = 'display:block;margin:6px 0';
    const top = document.createElement('div'); top.style.cssText = 'display:flex;justify-content:space-between';
    const name = document.createElement('span'); name.textContent = label; const val = document.createElement('span'); val.textContent = fmt(get()); val.style.opacity = '.8';
    top.append(name, val);
    const r = document.createElement('input'); r.type = 'range'; r.min = lo; r.max = hi; r.step = st; r.value = get(); r.dataset.key = key; r.style.cssText = 'width:100%';
    r.addEventListener('input', () => { set(+r.value); val.textContent = fmt(+r.value); if (key.startsWith('vt')) api.setTexOn(true); });
    row.append(top, r); box.append(row);
  }
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:8px;margin-top:10px';
  const btn = t => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'flex:1;padding:6px 0;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:inherit;cursor:pointer'; return b; };
  const copy = btn('複製參數 JSON'), reset = btn('重設');
  copy.addEventListener('click', async () => {
    const out = Object.fromEntries(rows.map(r => [r[1], +(+r[2]()).toFixed(3)]));
    const text = JSON.stringify({ valleyTextures: out });
    try { await navigator.clipboard.writeText(text); copy.textContent = '已複製'; } catch (error) { prompt('複製這段：', text); }
    setTimeout(() => { copy.textContent = '複製參數 JSON'; }, 1400);
  });
  reset.addEventListener('click', () => { for (const r of rows) r[3](start[r[1]]); box.querySelectorAll('input[type=range]').forEach(i => { i.value = start[i.dataset.key]; i.dispatchEvent(new Event('input')); }); });
  bar.append(copy, reset); box.append(bar);
  if (!open) box.style.display = 'none';
  document.body.append(box);
  api.panel = box;
  addEventListener('keydown', e => { if (e.key === 'F9') box.style.display = box.style.display === 'none' ? '' : 'none'; });
}
