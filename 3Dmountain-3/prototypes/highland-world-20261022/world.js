/* Highland world — the key visual's island, grown into a full range (2026-10-22).
   Terrain: assets/world-height-4097.bin, built in Blender by blender/build_world.py from the same
   licensed "Snowy Mountain V2" terrain. Look: exactly the key visual's — terrain-material-world.js
   (a copy of ../highland-keyvisual-20261022/terrain-material-v2.js), the same CPU rock beds that
   carve the mesh, the same sky, haze and silver water.
   The world is cut into 300-unit tiles whose density follows the distance from the shot's camera
   (the key visual's 1.17 units near the subject, coarser far away); tile edges carry skirts so
   different densities never show a crack. Outside the 4800² world the height field is mirrored, so
   the range runs on into the haze instead of ending at a cut edge.
   Query: ?shot=close|paths|valley|canyon · ?text=0 · ?light=overcast */
import * as THREE from 'three';
import { Water } from '../highland-material-study-20261022/vendor/Water.js';
import { createTerrainMaterial } from './terrain-material-world.js';

const STUDY = '../highland-material-study-20261022/assets/';
const params = new URLSearchParams(location.search);
const api = window.__HIGHLAND_WORLD__ = { ready: false };
const shotName = params.get('shot') || 'close';
document.body.dataset.shot = shotName;
if (params.get('text') === '0') document.body.classList.add('no-text');

// per-shot look: the camera itself comes from assets/shots.json (the same file the .blend's cameras use)
const LOOK = {
  close:  { fog: .00045, shadow: { x: 0, z: 0, r: 900 } },
  paths:  { fog: .00026, shadow: { x: 0, z: -1700, r: 2600 } },
  valley: { fog: .00042, shadow: { x: -60, z: -1500, r: 1300 } },
  canyon: { fog: .00055, shadow: { x: 0, z: -2600, r: 900 } }
};
const look = LOOK[shotName] || LOOK.close;

const scene = new THREE.Scene();
// ?sky=1.2 lifts the sky dome, its clouds and the horizon haze (the terrain's own exposure is untouched)
const SKY = +(params.get('sky') || 1);
const HAZE = new THREE.Color('#bfcbcb').lerp(new THREE.Color('#ffffff'), Math.max(0, SKY - 1) * .55);
scene.background = HAZE.clone();
scene.fog = new THREE.FogExp2(HAZE, look.fog);
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .8, 14000);
const overcast = params.get('light') === 'overcast';
const sun = new THREE.DirectionalLight('#fff0d8', overcast ? 1.3 : 3.1);
sun.position.set(-650, 300, 420); sun.castShadow = true;
sun.shadow.mapSize.setScalar(4096); sun.shadow.bias = -.00012; sun.shadow.normalBias = .6; sun.shadow.radius = 3;
const hemi = new THREE.HemisphereLight('#d3e0e8', '#3a3f30', overcast ? 1.35 : .95);
scene.add(sun, sun.target, hemi);

function createSky() {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6500, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { sunDirection: { value: sun.position.clone().normalize() }, haze: { value: HAZE }, uSky: { value: SKY } },
    vertexShader: `varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `
      varying vec3 vDirection; uniform vec3 sunDirection; uniform vec3 haze; uniform float uSky;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y); }
      float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= .5; } return s; }
      void main() {
        vec3 d = normalize(vDirection); float up = max(d.y, 0.);
        vec3 c = mix(vec3(.72, .79, .78), vec3(.17, .33, .46), pow(up, .48));
        vec2 p = d.xz / (abs(d.y) + .22) * 2.2;
        float clouds = smoothstep(.37, .68, fbm(p + vec2(4., 7.))) * smoothstep(-.03, .18, d.y);
        float lit = smoothstep(.40, .64, fbm(p + vec2(4.15, 7.13)));
        c = mix(c, mix(vec3(.36, .43, .47), vec3(.92, .93, .87), lit), clouds * .92);
        c += vec3(.22, .19, .13) * pow(max(dot(d, sunDirection), 0.), 14.) * (1. - clouds * .6);
        c = mix(c, haze, smoothstep(.07, 0., d.y) * .8);
        c = mix(c, vec3(1.), clamp(uSky - 1., 0., 1.) * .35) * mix(1., uSky, .5);
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  sky.onBeforeRender = (r, s, cam) => sky.position.copy(cam.position);   // always around whichever camera draws it
  return sky;
}

// ---------------------------------------------------------------------------------------------
// the height field and the rock beds (the key visual's strataAt, unchanged)
// ---------------------------------------------------------------------------------------------
let HW, N, X0, ZTOP, DX;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function Hs(x, z) {   // bilinear; mirrored outside the world so the range runs on into the haze
  let fx = (x - X0) / DX, fz = (ZTOP - z) / DX; const m = N - 1;
  fx = Math.abs(fx); fz = Math.abs(fz); if (fx > m) fx = clamp(2 * m - fx, 0, m); if (fz > m) fz = clamp(2 * m - fz, 0, m);
  fx = Math.min(fx, m - .001); fz = Math.min(fz, m - .001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * N + ix;
  return (HW[i] * (1 - tx) + HW[i + 1] * tx) * (1 - tz) + (HW[i + N] * (1 - tx) + HW[i + N + 1] * tx) * tz;
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash2 = (x, z) => { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); };
const hash1 = n => { const h = Math.sin(n * 127.1 + 1.7) * 43758.5453; return h - Math.floor(h); };
function vn(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return (hash2(ix, iz) * (1 - ux) + hash2(ix + 1, iz) * ux) * (1 - uz) + (hash2(ix, iz + 1) * (1 - ux) + hash2(ix + 1, iz + 1) * ux) * uz;
}
function fbm(x, z, oct = 5) {
  let s = 0, a = .5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vn(x, z); n += a; const nx = .8 * x + .6 * z, nz = -.6 * x + .8 * z; x = nx * 2.03 + 11.7; z = nz * 2.03 + 11.7; a *= .5; }
  return s / n;
}
const vn1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash1(i) * (1 - u) + hash1(i + 1) * u; };
const ridged = (x, z) => 1 - Math.abs(2 * vn(x, z) - 1);
const STRATA = 24;
function strataAt(x, y, z) {
  const warp = (fbm(x * .0045, z * .0045) - .5) * 34 + (fbm(x * .021 + 3.1, z * .021 + 3.1, 3) - .5) * 7;
  const hs = y + warp + x * .05 - z * .028;
  let bc = hs / STRATA; bc += (vn1(bc * .55) - .5) * .9;
  let mc = hs / 6.1; mc += (vn1(mc * .7 + 3) - .5) * .8;
  const mask = smoothstep(.22, .55, fbm(x * .008 + y * .004 + 2.3, z * .008 + y * .004 + 2.3, 4));
  return [bc, mc, mask];
}
// one terrain sample: carved height, beds, cavity
function terrainAt(x, z, out, o) {
  const h = Hs(x, z);
  let y = h;
  const [bc, mc, mask] = strataAt(x, y, z);
  const gx = (Hs(x + 2, z) - Hs(x - 2, z)) / 4, gz = (Hs(x, z + 2) - Hs(x, z - 2)) / 4;
  const steep = 1 - smoothstep(.55, .86, 1 / Math.sqrt(1 + gx * gx + gz * gz));
  if (y > .5) {
    const u = bc - Math.floor(bc), stepped = smoothstep(0, .8, u);
    y += (stepped - u) * STRATA * .62 * steep * mask;
    const crag = ridged(x / 13, z / 13) * .65 + ridged(x / 4.6 + 3, z / 4.6 + 3) * .35;
    y += (crag - .55) * 3.4 * steep * smoothstep(.5, 6, y);
  }
  const n1 = (Hs(x + 6, z) + Hs(x - 6, z) + Hs(x, z + 6) + Hs(x, z - 6)) / 4;
  const n2 = (Hs(x + 18, z) + Hs(x - 18, z) + Hs(x, z + 18) + Hs(x, z - 18)) / 4;
  out[o] = y; out[o + 1] = bc; out[o + 2] = mc; out[o + 3] = mask;
  out[o + 4] = clamp(1 - (n1 - h) * .047 - (n2 - h) * .0206, .55, 1);
}

// ---------------------------------------------------------------------------------------------
// tiles: density by distance from the camera, skirts at the edges
// ---------------------------------------------------------------------------------------------
const TILE = 300;
function tileGeometry(x0, z0, segs) {
  const s = TILE / segs, n = segs + 1, b = n + 2;          // b: with a one-sample border, for normals
  const S = new Float32Array(b * b * 5);
  for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) terrainAt(x0 + (i - 1) * s, z0 + (j - 1) * s, S, (j * b + i) * 5);
  const skirt = 4 * n, count = n * n + skirt;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), ao = new Float32Array(count), st = new Float32Array(count * 3);
  const put = (k, i, j, drop) => {
    const q = ((j + 1) * b + (i + 1)) * 5;
    const yl = S[q - 5], yr = S[q + 5], yd = S[q - b * 5], yu = S[q + b * 5];
    let nx = -(yr - yl) / (2 * s), nz = -(yu - yd) / (2 * s), ny = 1; const l = Math.hypot(nx, ny, nz);
    pos.set([x0 + i * s, S[q] - drop, z0 + j * s], k * 3); nor.set([nx / l, ny / l, nz / l], k * 3);
    ao[k] = S[q + 4]; st.set([S[q + 1], S[q + 2], S[q + 3]], k * 3);
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put(j * n + i, i, j, 0);
  const edges = [[i => [i, 0]], [i => [i, segs]], [i => [0, i]], [i => [segs, i]]].map(e => e[0]);
  const idx = [];
  const g = (i, j) => j * n + i;
  for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) { const a = g(i, j), bb = g(i + 1, j), c = g(i, j + 1), d = g(i + 1, j + 1); idx.push(a, c, bb, bb, c, d); }
  edges.forEach((edge, e) => {
    const base = n * n + e * n;
    for (let i = 0; i < n; i++) { const [ii, jj] = edge(i); put(base + i, ii, jj, 14); }
    for (let i = 0; i < segs; i++) {
      const [a0, a1] = edge(i), [b0, b1] = edge(i + 1); const ta = g(a0, a1), tb = g(b0, b1), sa = base + i, sb = base + i + 1;
      idx.push(ta, sa, tb, tb, sa, sb, ta, tb, sa, tb, sb, sa);   // both windings: a skirt may be seen from either side
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('terrainAO', new THREE.BufferAttribute(ao, 1)); geo.setAttribute('aStrata', new THREE.BufferAttribute(st, 3));
  geo.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}
function buildTiles(material, shot) {
  const cam = new THREE.Vector3(...shot.pos), tgt = new THREE.Vector3(...shot.target);
  const fwd = new THREE.Vector2(tgt.x - cam.x, tgt.z - cam.z).normalize();
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(shot.fov) / 2) * (innerWidth / innerHeight));
  const group = new THREE.Group(); let verts = 0, tiles = 0;
  for (let z0 = -4800; z0 < 2400; z0 += TILE) for (let x0 = -3600; x0 < 3600; x0 += TILE) {
    const nx = clamp(cam.x, x0, x0 + TILE), nz = clamp(cam.z, z0, z0 + TILE);
    const dxz = Math.hypot(nx - cam.x, nz - cam.z), d = Math.hypot(dxz, Math.max(0, cam.y - 90));
    const cx = x0 + TILE / 2 - cam.x, cz = z0 + TILE / 2 - cam.z, cl = Math.hypot(cx, cz);
    if (cl > 450) {   // well behind, or well outside the view: no need for it (with a margin for shadows)
      const ang = Math.acos(clamp((cx * fwd.x + cz * fwd.y) / cl, -1, 1));
      if (ang > hfov / 2 + THREE.MathUtils.degToRad(cl > 1500 ? 14 : 32)) continue;
    }
    const sigma = clamp(1.17 * d / 650, 1.17, 37.5);
    const segs = clamp(2 ** Math.floor(Math.log2(TILE / sigma)), 8, 256);
    const mesh = new THREE.Mesh(tileGeometry(x0, z0, segs), material);
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    verts += (segs + 1) ** 2; tiles++;
  }
  return { group, verts, tiles };
}

let renderer, water;
async function loadMap(file, kind) {
  const t = await new THREE.TextureLoader().loadAsync(STUDY + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = kind === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
async function init() {
  const t0 = performance.now();
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(devicePixelRatio); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.querySelector('#scene').append(renderer.domElement);
  const sky = createSky(); scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); const envSky = sky.clone(); envSky.onBeforeRender = () => {}; envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, .04, .1, 8000).texture; scene.environmentIntensity = .3; pmrem.dispose();

  const [meta, shots] = await Promise.all([fetch('./assets/world-meta.json').then(r => r.json()), fetch('./assets/shots.json').then(r => r.json())]);
  ({ n: N, x0: X0, ztop: ZTOP, dx: DX } = meta.grid);
  HW = new Float32Array(await (await fetch('./assets/world-height-4097.bin')).arrayBuffer());
  if (HW.length !== N * N) throw new Error('height field size');
  const shot = shots[shotName] || shots.close;

  const maps = {};
  await Promise.all(['rock', 'grass'].flatMap(name => ['Color', 'Normal', 'Roughness'].map(async suffix => {
    const id = name === 'rock' ? 'cliff_side' : 'aerial_grass_rock';
    maps[name + suffix] = await loadMap(`${id}-${suffix.toLowerCase()}-2048.webp`, suffix.toLowerCase());
  })));
  const erosion = await loadMap('terrain-erosion-normal-2048.webp', 'normal');
  erosion.flipY = false; erosion.wrapS = erosion.wrapT = THREE.ClampToEdgeWrapping; maps.erosionNormal = erosion;
  const material = createTerrainMaterial(maps, { grassCut: +(params.get('grassCut') || 0), debugVeg: +(params.get('debugVeg') || 0) });
  const tStart = performance.now();
  const { group, verts, tiles } = buildTiles(material, shot); scene.add(group);
  const buildMs = performance.now() - tStart;

  // shore foam from the light (1025²) height field over the whole world
  const lite = new Float32Array(await (await fetch('./assets/world-height-1025.bin')).arrayBuffer());
  const shoreHeight = new THREE.DataTexture(lite, 1025, 1025, THREE.RedFormat, THREE.FloatType);
  shoreHeight.minFilter = shoreHeight.magFilter = THREE.LinearFilter; shoreHeight.needsUpdate = true;
  const normals = await loadMap('waternormals.jpg', 'normal');
  water = new Water(new THREE.PlaneGeometry(100000, 100000), { textureWidth: 2048, textureHeight: 2048, waterNormals: normals, alpha: 1,
    sunDirection: sun.position.clone().normalize(), sunColor: 0xfff3e2, waterColor: 0xbfd0d3, distortionScale: 2.2, fog: true });
  water.rotation.x = -Math.PI / 2;
  const W = (N - 1) * DX;
  water.material.fragmentShader = water.material.fragmentShader
    .replace('uniform sampler2D mirrorSampler;', 'uniform sampler2D mirrorSampler; uniform sampler2D shoreHeight;')
    .replace('vec3( 1.5, 1.0, 1.5 )', 'vec3( 0.72, 1.0, 0.72 )')
    .replace('float rf0 = 0.3;', 'float rf0 = 0.05;')
    .replace('vec3 outgoingLight = albedo;', `vec3 outgoingLight = mix(albedo * 1.18, vec3(.16,.33,.50), smoothstep(.03,.2,abs(surfaceNormal.x+surfaceNormal.z))*.26);
      vec2 uvShore = vec2((worldPosition.x - (${X0.toFixed(1)})) / ${W.toFixed(1)}, (${ZTOP.toFixed(1)} - worldPosition.z) / ${W.toFixed(1)});
      float shoreY = texture2D(shoreHeight, uvShore).r;
      float inside = step(0.,uvShore.x)*step(0.,uvShore.y)*step(uvShore.x,1.)*step(uvShore.y,1.);
      // broken lace from three crossing waves (two sines alone read as regular dashes up close)
      float lace = (sin(worldPosition.x*.9+worldPosition.z*.7+time*1.6) + sin(worldPosition.x*.41-worldPosition.z*.97+2.1)
                  + sin(worldPosition.x*1.73+worldPosition.z*.29-time*.9+.7)) / 6. + .5;
      float foam = smoothstep(-2.2,-.1,shoreY) * inside * smoothstep(.45,.85,lace+.18*sin(worldPosition.z*.071+worldPosition.x*.05));
      float shallow = smoothstep(-9.,-1.,shoreY) * inside;
      outgoingLight = mix(outgoingLight, outgoingLight*vec3(.86,.93,.92), shallow*.5);
      outgoingLight = mix(outgoingLight, vec3(.86,.92,.93), foam*.6);`);
  water.material.uniforms.shoreHeight = { value: shoreHeight };
  water.material.uniforms.size.value = 3.0; water.material.uniforms.time.value = 4.2;
  scene.add(water);

  // shadows follow the shot's subject
  const sh = look.shadow, dir = sun.position.clone().normalize();
  sun.target.position.set(sh.x, 0, sh.z); sun.position.copy(sun.target.position).addScaledVector(dir, 1400);
  Object.assign(sun.shadow.camera, { left: -sh.r, right: sh.r, top: sh.r, bottom: -sh.r, near: 20, far: 3200 }); sun.shadow.camera.updateProjectionMatrix();

  camera.position.set(...shot.pos); camera.lookAt(new THREE.Vector3(...shot.target)); camera.fov = shot.fov;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  render();
  Object.assign(api, { ready: true, renderer, scene, camera, material, water, sun, render, pause() {},
    stats: { shot: shotName, tiles, verts, buildMs: Math.round(buildMs), totalMs: Math.round(performance.now() - t0), triangles: renderer.info.render.triangles } });
  document.body.classList.add('ready');
}
function render() { renderer.render(scene, camera); }
init().catch(e => { console.error(e); api.failure = String(e && e.stack || e); });
