/* land-bake.js — BAKE sample S1 (2026-11-23; client: 「主要建模然後貼材質 再帶點生成的草皮」).
   index1-5-canyon-forest-rise-ui.html?land=bake (desktop only; phones keep the live land). Without ?land=bake this file is not even loaded.
   The view from above's land (one 610 k-triangle grid whose shape and look are computed per vertex / per pixel) is replaced by:
     - a modelled land: a 512 x 287 grid (+16 skirt cells each side) lifted by heights baked from the live page;
     - textures baked from the live page's own land program (prototypes/topdown-bake/assets/bake-nofalls | bake-falls; .qa/topdown-bake/bake-land.cjs);
     - live on top: the water (the live land program, but only on the triangles and pixels where there is water), the arrival colour front,
       cloud shadows (one scrolling texture read), the valley mist and far haze (the live program's own functions), the sun dial
       (colour = ambient + (lit - ambient) x sun / baked sun), the survey ink and the edge sky fade; beams, beacons, labels, falls untouched;
     - a little procedural grass: instanced tufts of three blades with wind, on gentle green slopes, fading with distance and with the arrival.
   The lake / pool dive falls back to the live land (the camera comes too close for the baked texture).
   Switches: ?land=bake · ?bakeGrass=<blades, 0..60000> · panel 「烘焙地形」 (?panel=1 under automation) · window.__LAND_BAKE__.setOn(false) = the live land. */
import * as THREE from 'three';

const Q = new URLSearchParams(location.search);
const state = { stage: 'off', errors: [], on: false, dive: false, camY: 99, waterTris: 0, gridTris: 0, grassTufts: 0 };
const api = window.__LAND_BAKE__ = { state };
const COARSE = matchMedia('(pointer: coarse)').matches;
const MAX_BLADES = 60000, BLADES_PER_TUFT = 3;
const tune = { on: true, grass: Math.max(0, Math.min(MAX_BLADES, Number.isFinite(+Q.get('bakeGrass')) && Q.get('bakeGrass') !== null ? +Q.get('bakeGrass') : 36000)),
  grassHeight: 1, wind: 1, fadeNear: 19, fadeFar: 29, cloud: .75, cloudScale: .11, diveLive: true };
api.tune = tune;

const waitFor = (fn, ms) => new Promise((res, rej) => { const t0 = performance.now(); const tick = () => { let v = null; try { v = fn(); } catch (e) { } if (v) return res(v); if (performance.now() - t0 > ms) return rej(new Error('timeout')); setTimeout(tick, 200); }; tick(); });
const pixels = async (blob, w, h) => { const bmp = await createImageBitmap(await blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); const W = w || bmp.width, H = h || bmp.height; const cv = new OffscreenCanvas(W, H), c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(bmp, 0, 0, W, H); const d = c.getImageData(0, 0, W, H).data; bmp.close?.(); return { d, W, H }; };
const findRenderer = () => { const seen = new WeakSet(), q = []; for (const k of Object.keys(window)) if (/^__/.test(k) && k !== '__LAND_BAKE__') { try { q.push([window[k], 0]); } catch (e) { } } let n = 0;
  while (q.length && n < 60000) { const [o, d] = q.shift(); if (!o || typeof o !== 'object' || seen.has(o)) continue; seen.add(o); n++; try { if (o.isWebGLRenderer) return o; } catch (e) { continue; } if (d >= 5 || o instanceof Node || ArrayBuffer.isView(o) || o === window) continue; try { if (o.isObject3D || o.isMaterial || o.isTexture || o.isBufferGeometry) continue; } catch (e) { continue; } let ks; try { ks = Array.isArray(o) ? o.slice(0, 32).map((_, i) => i) : Object.keys(o).slice(0, 100); } catch (e) { continue; } for (const k of ks) { try { const ds = Object.getOwnPropertyDescriptor(o, k); if (ds && ds.get) continue; const v = o[k]; if (v && typeof v === 'object') q.push([v, d + 1]); } catch (e) { } } }
  return null; };

/* a tileable cloud field (value-noise fbm, 256^2): the live shadows come from noise and cloud banks; this is their one-read stand-in */
function cloudTexture() {
  const N = 256, d = new Uint8Array(N * N), hash = (x, y, p) => { x = ((x % p) + p) % p; y = ((y % p) + p) % p; let h = x * 374761393 + y * 668265263 + p * 982451653; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vn = (x, y, p) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (hash(i, j, p) * (1 - u) + hash(i + 1, j, p) * u) * (1 - v) + (hash(i, j + 1, p) * (1 - u) + hash(i + 1, j + 1, p) * u) * v; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0, a = .55, t = 0; for (const p of [4, 8, 16, 32]) { s += a * vn(x / N * p, y / N * p, p); t += a; a *= .5; } d[y * N + x] = Math.round(255 * s / t); }
  const tex = new THREE.DataTexture(d, N, N, THREE.RedFormat, THREE.UnsignedByteType); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true; return tex;
}

async function start() {
  state.stage = 'waiting for the view';
  const A = await waitFor(() => { const a = window.__FLOW2_FOREST_ATLAS__; return a && a.state && a.state.ready && a.studio ? a : null; }, 240000);
  const V = A.studio, S = V.studio, scene = S.skyDome.parent;
  let grid = null; scene.traverse(o => { if (o.name === 'Forest relief grid') grid = o; });
  if (!grid) throw new Error('no land grid');
  const live = grid.material, fsL = live.fragmentShader;
  const variant = document.documentElement.hasAttribute('data-rise-falls') ? 'bake-falls' : 'bake-nofalls';
  const base = new URL(`./assets/${variant}/`, import.meta.url);
  state.stage = 'loading ' + variant;
  const meta = await fetch(new URL('meta.json', base), { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(variant + ' is not baked yet (.qa/topdown-bake/bake-land.cjs)'); return r.json(); });
  const ver = '?v=' + encodeURIComponent(meta.at || '1'), at = f => new URL(f + ver, base).href;
  const blobs = new Map(), blobOf = f => { if (!blobs.has(f)) blobs.set(f, fetch(at(f)).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.blob(); })); return blobs.get(f); };
  const loadTex = async (f, srgb) => { const bmp = await createImageBitmap(await blobOf(f), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); const t = new THREE.Texture(bmp); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t; };
  const [litC, ambC, watC, litO, ambO, watO, hbuf, watCpx, watOpx, litSmall] = await Promise.all([
    loadTex('lit-core.webp', true), loadTex('amb-core.webp', true), loadTex('water-core.png', false), loadTex('lit-outer.webp', true), loadTex('amb-outer.webp', true), loadTex('water-outer.png', false),
    fetch(at('height.bin')).then(r => r.arrayBuffer()), pixels(blobOf('water-core.png')), pixels(blobOf('water-outer.png')), pixels(blobOf('lit-core.webp'), 1024, Math.round(1024 * meta.sizes.core[1] / meta.sizes.core[0]))]);
  for (const t of [watC, watO]) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }

  /* ---- the modelled land */
  const P = meta.plate, O = meta.outer, G = meta.grid, SK = meta.skirt, xs = [], zs = [];
  for (let i = 0; i <= G.skirtCells; i++) xs.push(O.x0 + SK * i / G.skirtCells); for (let i = 1; i <= G.nx; i++) xs.push(P.x0 + P.w * i / G.nx); for (let i = 1; i <= G.skirtCells; i++) xs.push(P.x0 + P.w + SK * i / G.skirtCells);
  for (let i = 0; i <= G.skirtCells; i++) zs.push(O.z0 + SK * i / G.skirtCells); for (let i = 1; i <= G.nz; i++) zs.push(P.z0 + P.d * i / G.nz); for (let i = 1; i <= G.skirtCells; i++) zs.push(P.z0 + P.d + SK * i / G.skirtCells);
  const u16 = new Uint16Array(hbuf), nx = xs.length, nz = zs.length; if (u16.length !== nx * nz) throw new Error('height grid size');
  const H = i => G.hMin + u16[i] / 65535 * (G.hMax - G.hMin);
  const pos = new Float32Array(nx * nz * 3); for (let j = 0, k = 0; j < nz; j++) for (let i = 0; i < nx; i++, k += 3) { pos[k] = xs[i]; pos[k + 1] = H(j * nx + i); pos[k + 2] = zs[j]; }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); for (let j = 0, k = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .5, 0), 30);
  state.gridTris = idx.length / 3;

  const myU = { tLbLitC: { value: litC }, tLbAmbC: { value: ambC }, tLbWatC: { value: watC }, tLbLitO: { value: litO }, tLbAmbO: { value: ambO }, tLbWatO: { value: watO }, tLbCloud: { value: cloudTexture() },
    uLbOuter: { value: new THREE.Vector4(O.x0, O.z0, 1 / O.w, 1 / O.d) }, uLbK: { value: new THREE.Vector4(tune.cloud, tune.cloudScale, 1, 0) }, uLbBakeSun: { value: meta.bakedSun || 1 }, uLbDec: { value: 1 / (meta.enc || 1) },
    uLbG: { value: new THREE.Vector4(1, 1, tune.fadeNear, tune.fadeFar) } };
  const U = Object.assign({}, live.uniforms, myU);   /* shared uniform objects: every live value (sun, time, arrival, mist, …) reaches these materials */

  /* the baked material: the live program's own declarations and helper functions, a short main() */
  const mainAt = fsL.lastIndexOf('void main(){'); if (mainAt < 0) throw new Error('land program not recognised');
  const prelude = fsL.slice(0, mainAt);
  const cut = (a, b) => { const i = fsL.indexOf(a); if (i < 0) return ''; const j = fsL.indexOf(b, i); return j < 0 ? '' : fsL.slice(i, j + b.length); };
  const mist = cut('/* -------------------- PART 3: COOL CANYON AERIAL PERSPECTIVE', 'col = stValleyAir(col, vForestWorld, cameraPosition);');
  const rim = cut('// Feather each side before the last row', 'gl_FragColor=vec4(col,1.0-surveyInk);');
  state.parts = { mist: !!mist, rim: !!rim };
  const vary = []; prelude.replace(/varying\s+(?:(?:highp|mediump|lowp)\s+)?(float|vec2|vec3|vec4)\s+(\w+)\s*;/g, (_, t, n) => { if (!vary.some(v => v[1] === n)) vary.push([t, n]); });
  const vs = `uniform sampler2D tCanopy; uniform vec4 uBounds;
${vary.map(([t, n]) => `varying ${t} ${n};`).join('\n')}
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
${vary.map(([t, n]) => `  ${n} = ${t}(0.0);`).join('\n')}
  vForestWorld = w.xyz;
  vec2 uvR = (w.xz - uBounds.xy) * uBounds.zw; vec2 mu = 1.0 - abs(mod(uvR, 2.0) - 1.0);
  ${vary.some(v => v[1] === 'vStArrival') ? 'vStArrival = texture2D(tCanopy, mu).a;' : ''}
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
  const fs = `${prelude}
uniform sampler2D tLbLitC, tLbAmbC, tLbWatC, tLbLitO, tLbAmbO, tLbWatO, tLbCloud;
uniform vec4 uLbOuter, uLbK; uniform float uLbBakeSun, uLbDec;
void main(){
  vec2 uvR=(vForestWorld.xz-uBounds.xy)*uBounds.zw;
  vec2 uvO=(vForestWorld.xz-uLbOuter.xy)*uLbOuter.zw;
  vec3 lit=texture2D(tLbLitO,uvO).rgb, amb=texture2D(tLbAmbO,uvO).rgb; float wm=texture2D(tLbWatO,uvO).r;
  vec2 e2=min(uvR,1.0-uvR); float inC=min(e2.x,e2.y);
  ${/vec2\s+fallsGorgeField\s*\(/.test(prelude) ? 'if(inC>0.0 && fallsGorgeField(vForestWorld.xz).x<0.0) discard;   /* RISE FALLS: inside the rim the gorge own meshes are the land (the live rule, here explicit) */' : ''}
  if(inC>0.0){ vec4 lc=texture2D(tLbLitC,uvR); if(lc.a<0.5) discard; float k=smoothstep(0.0,0.006,inC);
    lit=mix(lit,lc.rgb,k); amb=mix(amb,texture2D(tLbAmbC,uvR).rgb,k); wm=mix(wm,texture2D(tLbWatC,uvR).r,k); }
  lit*=uLbDec; amb*=uLbDec;
  float vis=1.0;
  if(uBankShadow.w>0.001){ vec2 q=vForestWorld.xz*uLbK.y+vec2(-0.021,0.010)*uTime*uLbK.z; float c=texture2D(tLbCloud,q).r; vis=1.0-uBankShadow.w*uLbK.x*smoothstep(0.42,0.78,c); }
  vec3 col=amb+(lit-amb)*(uSunIntensity/max(uLbBakeSun,0.001))*vis;
  vec3 viewV=normalize(cameraPosition-vForestWorld); vec3 sunNS=normalize(uSun); float outDist=forestOut(uvR);
  ${mist}
  col=stArrivalColor(col,vForestWorld.xz,vStArrival);
  ${rim || 'gl_FragColor=vec4(col,1.0);'}
}`;
  const bakedMat = new THREE.ShaderMaterial({ uniforms: U, defines: { ...(live.defines || {}) }, vertexShader: vs, fragmentShader: fs, side: THREE.FrontSide, toneMapped: false, extensions: live.extensions });
  bakedMat.userData.handlesArrival = true;
  const baked = new THREE.Mesh(geo, bakedMat); baked.name = 'BAKE land (modelled + baked textures)'; baked.frustumCulled = false; baked.renderOrder = grid.renderOrder;
  baked.onBeforeRender = (r, sc, cam) => { if (cam.position.y > .2) state.camY = cam.position.y; };

  /* ---- live water: the live land program on the live grid's triangles near water, discarding every pixel that is not water */
  const g0 = grid.geometry, gp = g0.attributes.position.array, gi = g0.index.array;
  const wAt = (x, z) => { const u = (x - P.x0) / P.w, v = (z - P.z0) / P.d; if (u >= 0 && u <= 1 && v >= 0 && v <= 1) { const W = watCpx.W, Hh = watCpx.H; return watCpx.d[(Math.min(Hh - 1, Math.floor(v * Hh)) * W + Math.min(W - 1, Math.floor(u * W))) * 4] > 127; }
    const uo = (x - O.x0) / O.w, vo = (z - O.z0) / O.d; if (uo < 0 || uo > 1 || vo < 0 || vo > 1) return false; const W = watOpx.W, Hh = watOpx.H; return watOpx.d[(Math.min(Hh - 1, Math.floor(vo * Hh)) * W + Math.min(W - 1, Math.floor(uo * W))) * 4] > 127; };
  const keep = []; for (let t = 0; t < gi.length; t += 3) { const a = gi[t] * 3, b = gi[t + 1] * 3, c = gi[t + 2] * 3; if (wAt(gp[a], gp[a + 2]) || wAt(gp[b], gp[b + 2]) || wAt(gp[c], gp[c + 2]) || wAt((gp[a] + gp[b] + gp[c]) / 3, (gp[a + 2] + gp[b + 2] + gp[c + 2]) / 3)) keep.push(gi[t], gi[t + 1], gi[t + 2]); }
  const wGeo = new THREE.BufferGeometry(); for (const k of Object.keys(g0.attributes)) wGeo.setAttribute(k, g0.attributes[k]); wGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1)); wGeo.boundingSphere = g0.boundingSphere;
  /* the live program already uses all 16 texture units: the water gate travels as a per-vertex value instead of a mask texture */
  { const nv = gp.length / 3, aw = new Float32Array(nv); for (let v = 0; v < nv; v++) aw[v] = wAt(gp[v * 3], gp[v * 3 + 2]) ? 1 : 0; wGeo.setAttribute('aLbWater', new THREE.BufferAttribute(aw, 1)); }
  state.waterTris = keep.length / 3;
  const vsL = live.vertexShader, vMain = vsL.lastIndexOf('void main(){'); if (vMain < 0) throw new Error('land vertex program not recognised');
  const wVs = vsL.slice(0, vMain) + 'attribute float aLbWater; varying float vLbWater;\nvoid main(){ vLbWater = aLbWater;' + vsL.slice(vMain + 'void main(){'.length);
  const wFs = prelude + 'varying float vLbWater;\nvoid main(){ if(vLbWater<0.5) discard;' + fsL.slice(mainAt + 'void main(){'.length);
  const waterMat = new THREE.ShaderMaterial({ uniforms: U, defines: { ...(live.defines || {}) }, vertexShader: wVs, fragmentShader: wFs, side: live.side, toneMapped: false, extensions: live.extensions, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  waterMat.userData.handlesArrival = true;
  const water = new THREE.Mesh(wGeo, waterMat); water.name = 'BAKE live water (land program on water only)'; water.frustumCulled = false; water.renderOrder = grid.renderOrder + 1; water.onBeforeRender = grid.onBeforeRender;

  /* ---- procedural grass: tufts of three blades, placed on gentle green slopes, wind, distance and arrival fade */
  const tuft = (() => { const p = [], hgt = .04, w = .0035; for (let b = 0; b < BLADES_PER_TUFT; b++) { const a = b * Math.PI / BLADES_PER_TUFT + .3, c = Math.cos(a), s = Math.sin(a), lean = (b - 1) * .006; p.push(-w * c, 0, -w * s, w * c, 0, w * s, lean * s, hgt * (1 - b * .12), -lean * c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g; })();
  const grassMat = new THREE.ShaderMaterial({ uniforms: U, toneMapped: false, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime, uArrival, uArrivalMap; uniform vec4 uLbG, uBounds; uniform sampler2D tLbLitC, tCanopy; uniform float uLbDec;
      varying vec3 vCol; varying float vTip;
      void main(){
        vec3 root=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
        vec3 p=position; float tip=clamp(p.y/0.04,0.0,1.0); p.y*=uLbG.x;
        vec4 w=modelMatrix*instanceMatrix*vec4(p,1.0);
        float ph=dot(root.xz,vec2(3.1,2.3));
        w.xz+=vec2(sin(uTime*1.7+ph),cos(uTime*1.3+ph*1.3))*uLbG.y*tip*tip*0.01;
        float d=length(cameraPosition-root);
        float fade=1.0-smoothstep(uLbG.z,uLbG.w,d);
        vec2 uvR=(root.xz-uBounds.xy)*uBounds.zw;
        float field=mix(0.23+length(root.xz*vec2(1.0,1.35))*0.065,texture2D(tCanopy,uvR).a,uArrivalMap);
        float life=uArrival>=0.9999?1.0:smoothstep(0.0,0.11,uArrival*1.36-field);
        w.xyz=root+(w.xyz-root)*fade*life;
        vCol=texture2D(tLbLitC,uvR).rgb*uLbDec; vTip=tip;
        gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: `uniform float uSunIntensity, uLbBakeSun; varying vec3 vCol; varying float vTip;
      void main(){ vec3 c=vCol*mix(0.72,1.32,vTip)+vec3(0.018,0.026,0.0)*vTip; gl_FragColor=vec4(c*(uSunIntensity/max(uLbBakeSun,0.001)),1.0); }` });
  const maxTufts = Math.ceil(MAX_BLADES / BLADES_PER_TUFT), grass = new THREE.InstancedMesh(tuft, grassMat, maxTufts);
  grass.name = 'BAKE grass tufts'; grass.frustumCulled = false; grass.renderOrder = grid.renderOrder + 2;
  { const L = litSmall, WC = watCpx, cx0 = G.skirtCells, cz0 = G.skirtCells, o = new THREE.Object3D(); let n = 0, tries = 0; const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const hAt = (x, z) => { const fi = (x - P.x0) / P.w * G.nx + cx0, fj = (z - P.z0) / P.d * G.nz + cz0, i = Math.min(nx - 2, Math.max(0, Math.floor(fi))), j = Math.min(nz - 2, Math.max(0, Math.floor(fj))), a = fi - i, b = fj - j; return H(j * nx + i) * (1 - a) * (1 - b) + H(j * nx + i + 1) * a * (1 - b) + H((j + 1) * nx + i) * (1 - a) * b + H((j + 1) * nx + i + 1) * a * b; };
    while (n < maxTufts && tries < maxTufts * 40) { tries++; const u = rnd(), v = rnd(), x = P.x0 + u * P.w, z = P.z0 + v * P.d;
      const li = (Math.min(L.H - 1, Math.floor(v * L.H)) * L.W + Math.min(L.W - 1, Math.floor(u * L.W))) * 4, r = L.d[li], g = L.d[li + 1], bl = L.d[li + 2], al = L.d[li + 3];
      if (al < 128 || !(g > r * 1.06 && g >= bl * .98 && g > 40)) continue;
      if (WC.d[(Math.min(WC.H - 1, Math.floor(v * WC.H)) * WC.W + Math.min(WC.W - 1, Math.floor(u * WC.W))) * 4] > 127) continue;
      const e = .03, sl = Math.hypot(hAt(x + e, z) - hAt(x - e, z), hAt(x, z + e) - hAt(x, z - e)) / (2 * e); if (sl > .85) continue;
      o.position.set(x, hAt(x, z), z); o.rotation.set(0, rnd() * Math.PI * 2, 0); o.scale.setScalar(.7 + rnd() * .6 * (1 - sl * .5)); o.updateMatrix(); grass.setMatrixAt(n++, o.matrix); }
    grass.instanceMatrix.needsUpdate = true; state.grassPlaced = n; }

  /* ---- in the scene, next to the live land (same parent: whatever hides the land hides these too) */
  const parent = grid.parent; parent.add(baked); parent.add(water); parent.add(grass);
  const renderer = findRenderer();
  const apply = () => {
    myU.uLbK.value.set(tune.cloud, tune.cloudScale, 1, 0); myU.uLbG.value.set(tune.grassHeight, tune.wind, tune.fadeNear, Math.max(tune.fadeNear + .5, tune.fadeFar));
    const tufts = Math.min(state.grassPlaced, Math.round(tune.grass / BLADES_PER_TUFT)); grass.count = tufts; state.grassTufts = tufts;
    const useBake = !!tune.on && !(tune.diveLive && state.dive);
    baked.visible = water.visible = useBake; grass.visible = !!tune.on && tufts > 0 && !(tune.diveLive && state.dive) ? true : false;
    grid.visible = !useBake; state.on = useBake;
  };

  /* per frame, after the view has placed its lens: the dive check (camera height of the last drawn frame, with hysteresis) */
  const update = V.update;
  V.update = function () { const r = update.apply(this, arguments); try { const d = state.dive ? state.camY < 5.6 : state.camY < 4.6; if (d !== state.dive) { state.dive = d; apply(); } } catch (e) { } return r; };
  /* compile ahead (the programs are ready before the arrival), then check them; any failure = the live land stays */
  apply();
  if (renderer) { try { const cam = new THREE.PerspectiveCamera(); const vis = [baked.visible, water.visible, grass.visible, grid.visible]; baked.visible = water.visible = grass.visible = true;
    if (renderer.compileAsync) await renderer.compileAsync(scene, cam); else renderer.compile(scene, cam);
    [baked.visible, water.visible, grass.visible, grid.visible] = vis;
    for (const mm of [bakedMat, waterMat, grassMat]) { const pr = renderer.properties.get(mm).currentProgram; if (pr) { pr.getUniforms(); if (pr.diagnostics && pr.diagnostics.runnable === false) throw new Error('program failed: ' + (mm === bakedMat ? 'baked' : 'water/grass')); } }
  } catch (e) { parent.remove(baked); parent.remove(water); parent.remove(grass); grid.visible = true; V.update = update; state.dive = true; throw e; } }
  api.apply = apply;
  api.setOn = v => { tune.on = !!v; apply(); return state.on; };
  state.stage = 'ready'; state.variant = variant; state.meta = { at: meta.at, sizes: meta.sizes };
  window.__FLOW2_PANEL__?.add({ id: 'land-bake', title: '烘焙地形', tune, rows: [
    ['烘焙地形（關＝即時地形）', 'on', 'checkbox'], ['下潛改用即時地形', 'diveLive', 'checkbox'],
    ['— 生成草皮 —'], ['草葉數量', 'grass', 0, MAX_BLADES, 300], ['草葉高度', 'grassHeight', .3, 3, .01], ['風', 'wind', 0, 3, .01],
    ['淡出起點（距離）', 'fadeNear', 4, 40, .1], ['淡出終點（距離）', 'fadeFar', 5, 60, .1],
    ['— 雲影（一張捲動貼圖）—'], ['雲影強度', 'cloud', 0, 1.2, .01], ['雲影尺度', 'cloudScale', .02, .4, .001]], onChange: apply });
}

if (Q.get('land') === 'bake' && !COARSE) start().catch(e => { state.stage = 'failed'; state.errors.push(String(e && e.message || e)); console.warn('[land-bake] left out, the live land stays:', e); });
else state.stage = COARSE ? 'touch device: the live land' : 'off';
