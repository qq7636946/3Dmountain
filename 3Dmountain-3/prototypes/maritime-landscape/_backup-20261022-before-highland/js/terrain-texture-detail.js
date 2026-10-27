/* Maritime-only texture detail. No displacement: banks, routes and water masks stay in geometry.
 * World-space triplanar rock + slope/height-masked heath, shared by every rock draw kind.
 * RGB images are sampled as data and explicitly decoded once below. Their luminance is an
 * artistic bump/roughness proxy, NOT a measured PBR height scan or a baked normal map.
 */
export function createTerrainTextureDetail(THREE, { lite = false, highland = false, everest = false } = {}) {
  const size = lite ? 512 : 1024;
  const status = { enabled: true, size, loaded: [], failed: [], state: 'loading' };
  let disposed = false;
  const owned = new Set();
  const fallback = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  fallback.needsUpdate = true;
  owned.add(fallback);
  const uniforms = {
    uTerrainSlate: { value: fallback }, uTerrainHeath: { value: fallback },
    uTerrainTextureReady: { value: 0 }, uTerrainHighland: { value: highland ? 1 : 0 },
    uTerrainEverest: { value: everest ? 1 : 0 }
  };
  const loader = new THREE.TextureLoader();
  function load(name, uniform) {
    return new Promise(resolve => {
      const url = new URL(`../../../images/maritime/terrain/${name}-${size}.webp`, import.meta.url);
      const texture = loader.load(url.href, t => {
        if (disposed) { t.dispose(); resolve(false); return; }
        t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
        t.colorSpace = THREE.NoColorSpace;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.anisotropy = lite ? 4 : 8;
        t.needsUpdate = true;
        uniforms[uniform].value = t;
        status.loaded.push(name);
        resolve(true);
      }, undefined, () => {
        status.failed.push(name);
        console.warn(`[terrain] ${name} unavailable; retaining procedural material`);
        resolve(false);
      });
      owned.add(texture);
    });
  }
  const ready = Promise.all([load('coastal-slate', 'uTerrainSlate'), load('blue-heath', 'uTerrainHeath')]).then(results => {
    status.state = disposed ? 'disposed' : results.every(Boolean) ? 'ready' : 'fallback';
    uniforms.uTerrainTextureReady.value = status.state === 'ready' ? 1 : 0;
  });
  function install(material) {
    const compile = material.onBeforeCompile;
    const cacheKey = material.customProgramCacheKey();
    material.customProgramCacheKey = () => `${cacheKey}-textured-mineral-detail-3`;
    material.onBeforeCompile = shader => {
      compile(shader);
      Object.assign(shader.uniforms, uniforms);
      // Texture relief replaces the close-shore 27-cell fracture search once images are ready.
      // Keep it available only for the procedural fallback.
      shader.fragmentShader = shader.fragmentShader.replace('if(facetW>.01){', 'if(facetW>.01 && uTerrainTextureReady<.5){');
      const anchor = '#include <normal_fragment_maps>';
      if (!shader.fragmentShader.includes(anchor)) throw new Error('Terrain texture shader anchor missing');
      shader.fragmentShader = `
uniform sampler2D uTerrainSlate, uTerrainHeath;
uniform float uTerrainTextureReady,uTerrainHighland,uTerrainEverest;
vec3 terrainLinear(vec3 c) {
  return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(vec3(.04045), c));
}
vec3 terrainTri(vec3 p, vec3 w) {
  return texture2D(uTerrainSlate, p.zy).rgb * w.x
       + texture2D(uTerrainSlate, p.xz).rgb * w.y
       + texture2D(uTerrainSlate, p.xy).rgb * w.z;
}
` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(anchor, `${anchor}
if (uTerrainTextureReady > .5 && uMaritime > .001) {
  // Use the unperturbed normal for stable projection / habitat boundaries.
  vec3 txWorldN = normalize((vec4(nonPerturbedNormal, 0.) * viewMatrix).xyz);
  vec3 txW = pow(abs(txWorldN), vec3(4.));
  txW /= max(dot(txW, vec3(1.)), .0001);
  vec3 txP = vRockWorld;
  // Two incommensurate scales break repeated slabs; no view-dependent UV swimming.
  vec3 txFine = terrainTri(txP / 28., txW);
  vec3 txBroad = terrainTri(txP / 310. + vec3(.37, .63, .21), txW);
  // Larger fracture sheets stay legible at mid-distance; fine mineral grain rides over them.
  vec3 txRock = clamp(mix(txFine, txBroad, .48) + (txBroad - vec3(.48))*.16, .02, .98);
  vec3 txGrass = texture2D(uTerrainHeath, txP.xz / 13.).rgb;
  vec3 txGrassPatch = texture2D(uTerrainHeath, txP.xz / 87. + vec2(.31,.67)).rgb;
  txGrass = mix(txGrass, txGrassPatch, .32);
  float txPatch = rockNoise(txP * vec3(.011, .018, .011) + 41.);
  float txHeath = smoothstep(.44, .82, txWorldN.y)
    * (1. - smoothstep(uMarVegLine * .72, uMarVegLine * 1.12, txP.y))
    * smoothstep(3.5, 12., txP.y) * smoothstep(.20, .58, txPatch)
    * clamp(uMarVegAmt * 1.25, 0., 1.);
  vec3 txAlbedo = mix(terrainLinear(txRock) * vec3(.88, .98, 1.09), terrainLinear(txGrass) * vec3(.48, 1.02, 1.55), txHeath);
  if(uTerrainHighland>.5){
    // Broad, continuous grass shoulders; bare fractured rock on the steep faces.
    float grassL=dot(terrainLinear(txGrass),vec3(.2126,.7152,.0722));
    float stoneL=dot(terrainLinear(txRock),vec3(.2126,.7152,.0722));
    float rockBreak=dot(txBroad,vec3(.2126,.7152,.0722))-.48;
    float turf=smoothstep(.28,.72,txWorldN.y + rockBreak*.46)
      * (1.-smoothstep(uMarVegLine*.8,uMarVegLine*1.2,txP.y))
      * smoothstep(3.,14.,txP.y) * mix(.55,1.,smoothstep(.23,.65,txPatch));
    vec3 turfColour=mix(vec3(.105,.145,.038),vec3(.25,.285,.075),txPatch);
    vec3 stoneColour=vec3(.105,.116,.109)*clamp(stoneL/.24,.40,1.65);
    turf=clamp(turf*(.82+.38*smoothstep(.12,.36,grassL)),0.,1.);
    if(uTerrainEverest>.5){
      // Cool mineral faces and sparse sage / straw shoulders share the same
      // existing rock and heath samples. No added texture fetches or geometry.
      // Keep broad mineral variation subtle so sun and shadow describe form.
      vec3 mineral=mix(vec3(.135,.154,.165),vec3(.205,.194,.175),txPatch*.42);
      stoneColour=mineral*clamp(stoneL/.24,.58,1.42);
      turfColour=mix(vec3(.115,.150,.119),vec3(.230,.238,.184),txPatch);
      // Preserve the live vegetation control; restrained breaks let cliff
      // shoulders read as rock with habitat, rather than a continuous green cap.
      turf*=clamp(uMarVegAmt*.86,0.,1.)*mix(.72,.94,smoothstep(.25,.7,txPatch));
    }
    txAlbedo=mix(stoneColour,turfColour*clamp(grassL/.22,.45,1.55),turf);
    txHeath=turf;
  }
  // Keep the authored large-scale erosion / crest shading; replace the flat orange surface.
  float txOldLuma = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
  float txMacro = clamp(sqrt(txOldLuma / .22), .64, 1.38);
  txAlbedo *= txMacro;
  float txWet = 1. - smoothstep(.25, 3.8, txP.y);
  txAlbedo *= mix(vec3(1.), vec3(.48, .58, .64), txWet * .72);
  diffuseColor.rgb = mix(diffuseColor.rgb, txAlbedo, .96 * uMaritime);
  float txLuma = dot(mix(txRock, txGrass, txHeath), vec3(.2126, .7152, .0722));
  roughnessFactor = mix(clamp(.94 - txLuma * .18 + txHeath * .14, .70, .98), .64, txWet);
  // Screen derivatives reconstruct small relief without extra vertices or normal-map fetches.
  float txFoot = length(fwidth(txP));
  float txSheets=dot(txBroad,vec3(.2126,.7152,.0722));
  float txHeight = txLuma * mix(1.1, .24, txHeath) * (1. - smoothstep(1.5, 8., txFoot))
    + txSheets * .65 * (1.-txHeath*.78) * (1.-smoothstep(12.,50.,txFoot));
  normal = normalize(mix(normal, nonPerturbedNormal, .66));
  vec3 txDx = dFdx(-vViewPosition), txDy = dFdy(-vViewPosition);
  vec3 txRx = cross(txDy, normal), txRy = cross(normal, txDx);
  float txDet = dot(txDx, txRx);
  vec3 txGrad = sign(txDet) * (dFdx(txHeight) * txRx + dFdy(txHeight) * txRy);
  normal = normalize(max(abs(txDet), .000001) * normal - txGrad * .20);
}
`);
    };
    material.needsUpdate = true;
  }
  return { status, ready, install, dispose() {
    disposed = true;
    status.state = 'disposed';
    for (const texture of owned) texture.dispose();
    owned.clear();
  } };
}
