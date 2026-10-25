/* Canyon grass tufts — index1-5, 2026-10-24.
   Instanced clumps of tapered blades (images/alpine/tuft-atlas.webp, baked by
   prototypes/index1-5-alpine/tools/bake-tuft-atlas.cjs) standing on the canyon banks where the bank shader's
   own turf is: the tuft vertex shader evaluates the very same canyon-turf field (alpCanyonField) and the same
   outward wall relief (alpBankDisp) at each tuft's root, so a tuft never stands on bare rock or floats off
   the displaced wall. The CPU only scatters candidates over the bank meshes (denser near the camera path, at
   the wall toe above the wet band and in hollows; never on sheer faces or in the water).
   One draw call (InstancedBufferGeometry: 3 crossed cards x 3 rows per tuft), alpha-tested with mip-aware
   alpha, lit by the scene (MeshStandardMaterial: sun, shadow map, hemisphere), fogged like the rock.
   Fades by camera distance (no popping: tufts grow out of the ground) and with the aerial reveal (hidden). */
import { ALPINE_TERRAIN } from './alpine-terrain-params.js';
import { ALPINE_TERRAIN_UNIFORMS as U, syncAlpineUniforms, alpineMaps, ALP_NOISE_GLSL, ALP_BANK_GLSL, ALP_CANYON_GLSL } from './alpine-terrain-material.js';

const fract = x => x - Math.floor(x);
const hash = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7 + 74.7) * 43758.5453);

function tuftGeometry(THREE) {
  // 3 vertical cards crossed at 60 degrees, each 3 rows high (the blades bend), uv.x across, uv.y up
  const pos = [], nrm = [], uv = [], card = [], idx = [];
  for (let c = 0; c < 3; c++) {
    const a = c * Math.PI / 3, dx = Math.cos(a), dz = Math.sin(a), base = pos.length / 3;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) {
      const x = k - .5, y = r / 2;
      pos.push(x * dx, y, x * dz); nrm.push(-dz, 0, dx); uv.push(k, y); card.push(c);
    }
    for (let r = 0; r < 2; r++) { const o = base + r * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCard', new THREE.Float32BufferAttribute(card, 1));
  g.setIndex(idx);
  return g;
}

/** banks: the shore bank meshes (userData.rim = {rows, columns}); rows run along the river (t), columns out
    from the water (lateral distance (j/lateral)^1.62 x 250). curve/widthAt: the river the camera follows. */
export function createCanyonTufts(THREE, { banks, curve, widthAt, lite = false }) {
  // index1-5 uses the bank material's grass colour/normal maps only.
  // Skip the crossed grass cards before allocating geometry or materials.
  if (typeof document !== 'undefined' && document.documentElement.matches('[data-look="index1-5"]:not([data-opening-refinement])')) return null;
  const maps = alpineMaps();
  if (!banks?.length || !maps?.alpineTuft || !maps?.alpineErosion) return null;
  const started = performance.now();
  // ---- candidates -----------------------------------------------------------------------------------------
  const MAX = lite ? 9000 : 36000, DENSITY = lite ? .25 : 1;
  const roots = [], normals = [], seeds = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  const cells = [];
  let expected = 0;
  for (const bank of banks) {
    const { rows, columns } = bank.userData.rim || {};
    if (!rows || !columns) continue;
    const P = bank.geometry.attributes.position.array, lateral = columns - 1;
    const at = (i, j, v) => v.fromArray(P, (i * columns + j) * 3);
    for (let i = 0; i < rows - 1; i++) {
      const t = i / (rows - 1);
      if (t > .93) break;
      const half = widthAt(t), centre = curve.getPointAt(Math.min(1, t));
      for (let j = 0; j < columns - 1; j++) {
        const lat = Math.pow((j + .5) / lateral, 1.62) * 250;
        // past ~80 the bank is laid under the watershed ground (blendBankRims): a tuft there would be buried
        if (lat > 82) break;
        at(i, j, a); at(i, j + 1, b); at(i + 1, j, c); at(i + 1, j + 1, d);
        const y = (a.y + b.y + c.y + d.y) * .25;
        if (y < 2.6 || y > 230) continue;            // the wet rock right at the water stays bare
        e1.subVectors(d, a); e2.subVectors(c, b); n.crossVectors(e1, e2);
        const area = n.length() * .5; if (area < 1e-4) continue;
        n.normalize(); if (n.y < 0) n.negate();
        if (n.y < .2) continue;                       // overhangs and sheer faces: never
        // the camera rides the river centre 2.4 above the water: the nearer, the denser — and only ground
        // that faces the river (bench tops above the cliff and the backs of ribs are never seen from it)
        const cx = (a.x + d.x) * .5, cz = (a.z + d.z) * .5, tx = centre.x - cx, ty = 2.4 - y, tz = centre.z - cz;
        const dist = Math.hypot(tx, ty, tz), facing = (n.x * tx + n.y * ty + n.z * tz) / Math.max(dist, 1e-3);
        if (facing < .02) continue;
        let w = Math.exp(-Math.max(0, dist - 30) / 70) * Math.min(1, facing / .3);
        if (n.y < .6) w *= .45;                       // steep walls: only their ledges can carry a tuft
        if (y < 14) w *= 1.8;                         // the wall toe above the wet band: what the flight sees
        const ex = area * DENSITY * w;
        if (ex < .002) continue;
        expected += ex;
        cells.push(bank, i, j, ex, n.x, n.y, n.z);
      }
    }
  }
  const scale = Math.min(1, MAX / Math.max(1, expected));
  const v00 = new THREE.Vector3(), v10 = new THREE.Vector3(), v01 = new THREE.Vector3(), v11 = new THREE.Vector3(), p = new THREE.Vector3();
  for (let k = 0; k < cells.length; k += 7) {
    const bank = cells[k], i = cells[k + 1], j = cells[k + 2], ex = cells[k + 3] * scale;
    const { columns } = bank.userData.rim, P = bank.geometry.attributes.position.array;
    let count = Math.floor(ex); if (hash(i * 1.7 + j * .31, k * .013) < ex - count) count++;
    for (let m = 0; m < count; m++) {
      const u = hash(i + m * 7.1, j * 1.3 + .5), v = hash(j + m * 3.7, i * .7 + 1.5);
      v00.fromArray(P, (i * columns + j) * 3); v10.fromArray(P, (i * columns + j + 1) * 3);
      v01.fromArray(P, ((i + 1) * columns + j) * 3); v11.fromArray(P, ((i + 1) * columns + j + 1) * 3);
      p.copy(v00).lerp(v10, u).lerp(v01.lerp(v11, u), v);
      roots.push(p.x, p.y, p.z); normals.push(cells[k + 4], cells[k + 5], cells[k + 6]);
      seeds.push(hash(m * 13.1 + i, j * 7.7), hash(i * .37 + m, j + 2.2), hash(j * .91, m + i * .19), hash(m + .5, i * .11 + j * .53));
    }
  }
  const count = roots.length / 3;
  if (!count) return null;
  const geometry = tuftGeometry(THREE);
  geometry.setAttribute('aRoot', new THREE.InstancedBufferAttribute(new Float32Array(roots), 3));
  geometry.setAttribute('aNrm', new THREE.InstancedBufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 4));
  geometry.instanceCount = count;

  // ---- material ---------------------------------------------------------------------------------------------
  const local = { uTime: { value: 0 }, uTuftFade: { value: 1 }, uTuftNear: { value: lite ? 90 : 150 }, uTuftFar: { value: lite ? 140 : 230 }, uWindOn: { value: 1 } };
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .88, metalness: 0, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, local, { alpineTuft: { value: maps.alpineTuft }, alpineErosion: { value: maps.alpineErosion } });
    for (const [name, u] of Object.entries(U)) shader.uniforms[name] = u;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute vec3 aRoot; attribute vec3 aNrm; attribute vec4 aSeed; attribute float aCard;
      uniform sampler2D alpineErosion; uniform float uCliffRelief;
      uniform float uCanyonCos, uLedgeGrass, uGrassPatch, uCanyonGrass, uAlpDebug;
      uniform float uTuftAmount, uTuftHeight, uTuftVar, uTuftWind, uTime, uTuftFade, uTuftNear, uTuftFar, uWindOn;
      uniform float uRockTone, uValleyTone, uValleyShadow, uValleyContrast, uValleyReach, uValleyBlend;
      uniform vec3 uRockColor, uRockColor2, uValleyFloorColor, uValleyMidColor, uValleyUpperColor, uGrassColor, uGrassShadeColor;
      varying vec2 vTuftUv; varying vec3 vTuftDry; varying vec3 vTuftGreen; varying float vTuftShow;
      float aLumaV(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
      ${ALP_NOISE_GLSL}
      ${ALP_BANK_GLSL}
      ${ALP_CANYON_GLSL}`)
      .replace('#include <beginnormal_vertex>', `
      // the tuft's root on the displaced wall, and the turf field there (the bank shader's own functions)
      vec3 tRoot=aRoot,tN0=normalize(aNrm);
      vec4 tBd=alpBankDisp(tRoot,tN0);tRoot+=tN0*tBd.w;vec3 tRn=tBd.xyz;
      // the same field, a little more generous (tufts also stand on the turf's fringe and the wall toe)
      float tField=alpCanyonField(tRoot,tN0.y,tRn.y,tRn.y,tRn.y,.12,2.2).x;
      // on the turf and its fringe (the turf itself starts at .36)
      // ...and in the cracks and small steps of the steep walls, where the rock relief turns up from the wall
      // (clumps rooted in a crevice: upright tufts, sparse, never a sheet down the face)
      float tCrev=uLedgeGrass*smoothstep(.03,.14,tRn.y-tN0.y)*smoothstep(.36,.52,tRn.y)*smoothstep(.3,.45,tN0.y)*step(aSeed.y,.6)*smoothstep(2.6,5.,tRoot.y);   // never on sheer faces
      float tOn=max(smoothstep(.16,.32,tField),tCrev)*step(aSeed.x*2.,uTuftAmount);
      if(uAlpDebug>4.5)tOn=1.;   // look-dev: every candidate
      float tCam=distance(cameraPosition,tRoot);
      float tK=tOn*(1.-smoothstep(uTuftNear,uTuftFar,tCam))*uTuftFade;
      vec3 tUp=normalize(mix(vec3(0.,1.,0.),tRn,.3));
      vec3 tT1=normalize(cross(tUp,vec3(0.,0.,1.))),tT2=cross(tT1,tUp);
      float tAng=aSeed.z*6.2831853,tC=cos(tAng),tS=sin(tAng);
      // grass is lit as standing grass: mostly up, a little toward the slope and the card
      // on a steep wall the clump takes the wall's light (a tuft in a shaded crack is never brighter than the rock)
      float tWall=1.-smoothstep(.5,.8,tN0.y);
      vec3 objectNormal=normalize(normalize(mix(vec3(0.,1.,0.),tRn,mix(.45,.85,tWall)))*1.2+(tT1*(tC*normal.x-tS*normal.z)+tT2*(tS*normal.x+tC*normal.z))*.35);`)
      .replace('#include <begin_vertex>', `
      float tH=uTuftHeight*(1.+(aSeed.y-.5)*1.3*uTuftVar)*mix(.6,1.,tOn)*tK;
      float tW=tH*(.75+.5*aSeed.w)*(1.+(aSeed.x-.5)*.5*uTuftVar);
      vec2 tXZ=mat2(tC,tS,-tS,tC)*position.xz;
      float tY=position.y,tBend=tY*tY;
      float tLa=aSeed.w*6.2831853;
      vec2 tLean=vec2(cos(tLa),sin(tLa))*(.12+.28*aSeed.y);
      float tPh=uTime*1.7+dot(tRoot.xz,vec2(.045,.061))+aSeed.x*6.2831853;
      vec2 tWind=vec2(.8,.6)*(sin(tPh)*.7+sin(tPh*2.3+1.7)*.3)*.16*uTuftWind*uWindOn;
      vec3 transformed=tH>.001?tRoot+tT1*(tXZ.x*tW)+tT2*(tXZ.y*tW)+tUp*(tY*tH)+vec3(tLean.x+tWind.x,0.,tLean.y+tWind.y)*tBend*tH:tRoot;
      // which of the four atlas clumps this card shows
      float tVar=mod(floor(aSeed.x*97.)+aCard,4.);
      vTuftUv=vec2((tVar+uv.x)/4.,uv.y);vTuftShow=tK;
      // colour: brightness follows the rock's albedo (never glows against shaded rock); hue between the
      // dials' grass tints, dry straw and dark green; the canyon's valley tone like the turf beneath
      float tRef=aLumaV(mix(uRockColor,uRockColor2,.5))*uRockTone;
      vec3 tDryC=vec3(.58,.49,.31),tGreenC=mix(vec3(.30,.34,.19),vec3(.19,.24,.13),aSeed.w);
      vec3 tHue=mix(uGrassShadeColor,uGrassColor,.5);tHue/=max(aLumaV(tHue),.005);
      tDryC=mix(tDryC/aLumaV(tDryC),tHue,.25);tGreenC=mix(tGreenC/aLumaV(tGreenC),tHue,.25);
      float tVt=pow(clamp(tRoot.y/250.,0.,1.),uValleyReach),tBw=.5/max(uValleyBlend,.05);
      vec3 tVTint=mix(mix(uValleyFloorColor,uValleyMidColor,smoothstep(.25-tBw*.5,.25+tBw*.5,tVt)),uValleyUpperColor,smoothstep(.72-tBw*.5,.72+tBw*.5,tVt))/.2158;
      tVTint=max(vec3(0.),vec3(1.)+(tVTint-vec3(1.))*uValleyContrast);
      vec3 tTone=mix(vec3(1.),tVTint,clamp(uValleyTone,0.,2.))*(1.-clamp(uValleyShadow*.45*pow(1.-clamp(tRoot.y/250.,0.,1.),1.6)*.5,0.,.85));
      float tL=tRef*mix(.8,1.2,fract(aSeed.y*91.7+aSeed.z*13.1));   // blade tips about as bright as the rock, bases darker (AO)
      float tCrack=mix(1.,.72,tWall);   // rooted in a crack: shadowed at the base, smaller
      vTuftDry=tDryC*tL*1.25*tTone*tCrack;vTuftGreen=tGreenC*tL*.95*tTone*tCrack;
      if(uAlpDebug>5.5){vTuftDry=vTuftGreen=vec3(clamp(tField/.36,0.,1.),tN0.y,tRn.y)*.3;}   // look-dev: field / base slope / relief slope`)
      ;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D alpineTuft; uniform float uTuftDry;
      varying vec2 vTuftUv; varying vec3 vTuftDry; varying vec3 vTuftGreen; varying float vTuftShow;`)
      .replace('#include <map_fragment>', `
      if(vTuftShow<.001)discard;
      vec4 tx=texture2D(alpineTuft,vTuftUv);
      // mip-aware alpha: thin blades keep their coverage in the distance; a crisp, antialiased cut
      vec2 tTex=vTuftUv*vec2(512.,256.);
      float tMip=max(0.,.5*log2(max(dot(dFdx(tTex),dFdx(tTex)),dot(dFdy(tTex),dFdy(tTex)))));
      float ta=tx.a*(1.+tMip*.3);
      ta=(ta-.5)/max(fwidth(ta),1e-4)+.5;
      if(ta<.5)discard;
      float tDry=smoothstep(tx.g-.18,tx.g+.18,uTuftDry);
      diffuseColor.rgb=mix(vTuftGreen,vTuftDry,tDry)*(.55+.65*tx.r)*mix(.4,1.,tx.b);`)
      .replace('#include <normal_fragment_maps>', `normal=normalize(vNormal);`);
  };
  material.customProgramCacheKey = () => 'alpine-canyon-tufts-v1' + (lite ? '-lite' : '');
  material.onBeforeRender = () => syncAlpineUniforms();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Canyon grass tufts';
  // lit exactly like the bank rock it stands on: the shore banks neither cast nor receive the sun's shadow map
  // (the watershed ground buried under them does), so a shadow-receiving tuft went black inside that ground's shadow
  mesh.frustumCulled = false; mesh.receiveShadow = false; mesh.castShadow = false;
  mesh.renderOrder = 1;
  const stats = { candidates: count, buildMs: Math.round(performance.now() - started), trianglesEach: 12 };
  return {
    mesh, stats,
    update(camera, reveal = 0, time = 0, reduceMotion = false) {
      const fade = 1 - Math.min(1, Math.max(0, (reveal - .03) / .12));
      local.uTuftFade.value = fade * fade * (3 - 2 * fade);
      mesh.visible = local.uTuftFade.value > .001 && (Number(ALPINE_TERRAIN.tuftAmount) || 0) > 0;
      local.uWindOn.value = reduceMotion ? 0 : 1;
      if (!reduceMotion) local.uTime.value = time;
    },
    dispose() { geometry.dispose(); material.dispose(); mesh.removeFromParent(); }
  };
}
