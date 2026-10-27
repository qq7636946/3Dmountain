/* Highland key visual — one perfected still of the "Between land & light." close shot.
   Built on ../highland-material-study-20261022 (same licensed terrain, Poly Haven maps, three r170,
   Water.js — all referenced from there, nothing copied or changed in it). What differs:
     · terrain-material-v2.js (procedural rock beds, ledge moss, gullies, scree, wet shore)
     · the full 513² height field on a 512² grid, sampled bilinearly (v1: nearest, 256²)
     · aerial perspective: denser haze in the horizon colour, so the far ridges recede
     · a sharper mirror, shore foam broken up instead of one even white line
   Query: ?text=0 hides the caption · ?view=aerial · ?light=overcast · ?grid=256 */
import * as THREE from 'three';
import { Water } from '../highland-material-study-20261022/vendor/Water.js';
import { createTerrainMaterial } from './terrain-material-v2.js';

const STUDY = '../highland-material-study-20261022/assets/';
const params = new URLSearchParams(location.search);
const api = window.__HIGHLAND_KV__ = { ready: false };
if (params.get('text') === '0') document.body.classList.add('no-text');

const scene = new THREE.Scene();
const HAZE = new THREE.Color('#bfcbcb');
scene.background = HAZE.clone();
scene.fog = new THREE.FogExp2(HAZE, .00045);
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .8, 12000);
const overcast = params.get('light') === 'overcast';
const sun = new THREE.DirectionalLight('#fff0d8', overcast ? 1.3 : 3.1);
sun.position.set(-650, 300, 420); sun.castShadow = true;
sun.shadow.mapSize.setScalar(4096);
Object.assign(sun.shadow.camera, { left: -760, right: 760, top: 760, bottom: -760, near: 20, far: 1900 });
sun.shadow.bias = -.00012; sun.shadow.normalBias = .6; sun.shadow.radius = 3;
const hemi = new THREE.HemisphereLight('#d3e0e8', '#3a3f30', overcast ? 1.35 : .95);
scene.add(sun, hemi);

function createSky() {
  return new THREE.Mesh(new THREE.SphereGeometry(5500, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDirection: { value: sun.position.clone().normalize() }, haze: { value: HAZE } },
    vertexShader: `varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `
      varying vec3 vDirection; uniform vec3 sunDirection; uniform vec3 haze;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y); }
      float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= .5; } return s; }
      void main() {
        vec3 d = normalize(vDirection); float up = max(d.y, 0.);
        vec3 c = mix(vec3(.72, .79, .78), vec3(.17, .33, .46), pow(up, .48));
        vec2 p = d.xz / (abs(d.y) + .22) * 2.2;
        float base = fbm(p + vec2(4., 7.));
        float clouds = smoothstep(.37, .68, base) * smoothstep(-.03, .18, d.y);
        float lit = smoothstep(.40, .64, fbm(p + vec2(4.15, 7.13)));
        vec3 cloudCol = mix(vec3(.36, .43, .47), vec3(.92, .93, .87), lit);
        c = mix(c, cloudCol, clouds * .92);
        c += vec3(.22, .19, .13) * pow(max(dot(d, sunDirection), 0.), 14.) * (1. - clouds * .6);
        c = mix(c, haze, smoothstep(.07, 0., d.y) * .8);        // the horizon dissolves into the haze
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
}

/* The rock beds are decided here, once, on the CPU: the same values carve the geometry (steps,
   crags) and drive the shader's tiers (passed as the aStrata attribute: continuous bed coordinate,
   minor-bed coordinate, coverage mask), so a shaded ledge always sits on a carved ledge. */
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
const STRATA = 24;   // the major beds' mean thickness, in world units
function strataAt(x, y, z) {
  const warp = (fbm(x * .0045, z * .0045) - .5) * 34 + (fbm(x * .021 + 3.1, z * .021 + 3.1, 3) - .5) * 7;
  const hs = y + warp + x * .05 - z * .028;                        // warped, gently dipping
  let bc = hs / STRATA; bc += (vn1(bc * .55) - .5) * .9;           // irregular thickness, still monotonic
  let mc = hs / 6.1; mc += (vn1(mc * .7 + 3) - .5) * .8;
  const mask = smoothstep(.22, .55, fbm(x * .008 + y * .004 + 2.3, z * .008 + y * .004 + 2.3, 4));
  return [bc, mc, mask];
}

function makeTerrain(data, material) {
  const count = +params.get('grid') || 1024;
  const geo = new THREE.PlaneGeometry(1200, 1200, count, count); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, ao = new Float32Array(p.count), strata = new Float32Array(p.count * 3);
  const at = (ix, iz) => data[THREE.MathUtils.clamp(iz, 0, 512) * 513 + THREE.MathUtils.clamp(ix, 0, 512)];
  const sample = (x, z) => {   // bilinear, not nearest
    const fx = THREE.MathUtils.clamp((x + 600) / 1200 * 512, 0, 512), fz = THREE.MathUtils.clamp((600 - z) / 1200 * 512, 0, 512);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    return (at(ix, iz) * (1 - tx) + at(ix + 1, iz) * tx) * (1 - tz) + (at(ix, iz + 1) * (1 - tx) + at(ix + 1, iz + 1) * tx) * tz;
  };
  const surfaceHeight = (x, z) => {
    const edge = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), 430, 600);
    return (sample(x, z) * 68 - 32) * edge - 16 * (1 - edge);
  };
  const carve = +(params.get('carve') ?? 1);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = sample(x, z);
    let y = surfaceHeight(x, z);
    const [bc, mc, mask] = strataAt(x, y, z);
    strata.set([bc, mc, mask], i * 3);
    // steepness of the smooth surface, for where the carving applies
    const gx = (surfaceHeight(x + 2, z) - surfaceHeight(x - 2, z)) / 4, gz = (surfaceHeight(x, z + 2) - surfaceHeight(x, z - 2)) / 4;
    const steep = 1 - smoothstep(.55, .86, 1 / Math.sqrt(1 + gx * gx + gz * gz));
    if (y > .5 && carve) {
      // each bed: a steepened riser and a flatter tread on top (stays within its own bed)
      const u = bc - Math.floor(bc), stepped = smoothstep(0, .8, u);
      y += (stepped - u) * STRATA * .62 * steep * mask * carve;
      // crags: ridged noise breaks up the smooth faces and the skyline
      const crag = ridged(x / 13, z / 13) * .65 + ridged(x / 4.6 + 3, z / 4.6 + 3) * .35;
      y += (crag - .55) * 3.4 * steep * smoothstep(.5, 6, y) * carve;
    }
    p.setY(i, y);
    // cavity: how far this point sits below its neighbourhood, at two radii
    const n1 = (sample(x + 6, z) + sample(x - 6, z) + sample(x, z + 6) + sample(x, z - 6)) / 4;
    const n2 = (sample(x + 18, z) + sample(x - 18, z) + sample(x, z + 18) + sample(x, z - 18)) / 4;
    ao[i] = THREE.MathUtils.clamp(1 - (n1 - h) * 3.2 - (n2 - h) * 1.4, .55, 1);
  }
  geo.setAttribute('terrainAO', new THREE.BufferAttribute(ao, 1));
  geo.setAttribute('aStrata', new THREE.BufferAttribute(strata, 3)); geo.computeVertexNormals();
  const shoreData = new Float32Array(513 * 513);
  for (let z = 0; z < 513; z++) for (let x = 0; x < 513; x++) shoreData[z * 513 + x] = surfaceHeight(x / 512 * 1200 - 600, 600 - z / 512 * 1200);
  const shoreHeight = new THREE.DataTexture(shoreData, 513, 513, THREE.RedFormat, THREE.FloatType);
  shoreHeight.minFilter = shoreHeight.magFilter = THREE.LinearFilter; shoreHeight.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, material); mesh.castShadow = mesh.receiveShadow = true;
  return { mesh, shoreHeight };
}

const shots = {
  close: { position: new THREE.Vector3(470, 96, 560), target: new THREE.Vector3(-55, 65, -70), fov: 43 },
  aerial: { position: new THREE.Vector3(480, 510, 730), target: new THREE.Vector3(-70, 10, -80), fov: 48 }
};

let renderer, water;
async function loadMap(file, kind, size) {
  const t = await new THREE.TextureLoader().loadAsync(STUDY + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = kind === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
async function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(devicePixelRatio); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.querySelector('#scene').append(renderer.domElement);
  const sky = createSky(); scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); envScene.add(sky.clone());
  scene.environment = pmrem.fromScene(envScene, .04, .1, 6000).texture; scene.environmentIntensity = .3; pmrem.dispose();

  const maps = {};
  await Promise.all(['rock', 'grass'].flatMap(name => ['Color', 'Normal', 'Roughness'].map(async suffix => {
    const id = name === 'rock' ? 'cliff_side' : 'aerial_grass_rock';
    maps[name + suffix] = await loadMap(`${id}-${suffix.toLowerCase()}-2048.webp`, suffix.toLowerCase());
  })));
  const erosion = await loadMap('terrain-erosion-normal-2048.webp', 'normal');
  erosion.flipY = false; erosion.wrapS = erosion.wrapT = THREE.ClampToEdgeWrapping; maps.erosionNormal = erosion;
  const heights = new Float32Array(await (await fetch(STUDY + 'terrain-height-513.bin')).arrayBuffer());
  const material = createTerrainMaterial(maps);
  const { mesh, shoreHeight } = makeTerrain(heights, material); scene.add(mesh);

  const normals = await loadMap('waternormals.jpg', 'normal');
  water = new Water(new THREE.PlaneGeometry(100000, 100000), { textureWidth: 2048, textureHeight: 2048, waterNormals: normals, alpha: 1,
    sunDirection: sun.position.clone().normalize(), sunColor: 0xfff3e2, waterColor: 0xbfd0d3, distortionScale: 2.2, fog: true });
  water.rotation.x = -Math.PI / 2;
  water.material.fragmentShader = water.material.fragmentShader
    .replace('uniform sampler2D mirrorSampler;', 'uniform sampler2D mirrorSampler; uniform sampler2D shoreHeight;')
    .replace('vec3( 1.5, 1.0, 1.5 )', 'vec3( 0.72, 1.0, 0.72 )')
    .replace('float rf0 = 0.3;', 'float rf0 = 0.05;')
    .replace('vec3 outgoingLight = albedo;', `vec3 outgoingLight = mix(albedo * 1.18, vec3(.16,.33,.50), smoothstep(.03,.2,abs(surfaceNormal.x+surfaceNormal.z))*.26);
      vec2 uvShore = vec2((worldPosition.x+600.)/1200., (600.-worldPosition.z)/1200.);
      float shoreY = texture2D(shoreHeight, uvShore).r;
      float inside = step(0.,uvShore.x)*step(0.,uvShore.y)*step(uvShore.x,1.)*step(uvShore.y,1.);
      float lace = sin(worldPosition.x*.9+worldPosition.z*.7+time*1.6)*.5+.5;
      lace *= sin(worldPosition.x*.37-worldPosition.z*.53+1.3)*.5+.5;
      float foam = smoothstep(-2.6,-.1,shoreY) * inside * smoothstep(.15,.7,lace+.25*sin(worldPosition.z*.11));
      float shallow = smoothstep(-9.,-1.,shoreY) * inside;
      outgoingLight = mix(outgoingLight, outgoingLight*vec3(.86,.93,.92), shallow*.5);
      outgoingLight = mix(outgoingLight, vec3(.86,.92,.93), foam*.6);`);
  water.material.uniforms.shoreHeight = { value: shoreHeight };
  water.material.uniforms.size.value = 3.0; water.material.uniforms.time.value = 4.2;
  scene.add(water);

  const shot = shots[params.get('view') === 'aerial' ? 'aerial' : 'close'];
  camera.position.copy(shot.position); camera.lookAt(shot.target); camera.fov = shot.fov; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); render(); });
  render();
  Object.assign(api, { ready: true, renderer, scene, camera, material, water, sun, hemi, render, pause() {} });
  document.body.classList.add('ready');
}
function render() { renderer.render(scene, camera); }
init().catch(e => { console.error(e); api.failure = String(e && e.message || e); });
