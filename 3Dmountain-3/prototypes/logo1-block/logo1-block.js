/* LOGO 1 區塊原型（獨立，不接入 index1-5）。
   LOGO 1 = images/logo.svg（只有符號，沒有字標）。擠出成實體，圓角可調，材質用 MeshPhysicalMaterial 模擬水感玻璃。
   滾動驅動平旋轉：進度 0 → 1 對應 0° → 360°（緩入緩出），結尾回到正面（6.webp 的姿態）。
   旋鈕的值記在這個瀏覽器（localStorage），「複製參數」給工程師寫成預設值。 */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const LOGO_URL = new URL('../../images/logo.svg', import.meta.url).href;
const STORE_KEY = 'logo1-block-proto-v1';
const TARGET_HEIGHT = 2.4;   // 邏輯單位，相機約在 8.2

/* 水感（圓潤）與玻璃（近似原本，估計值）。depth／bevel 以 LOGO 高度為比例。 */
const PRESETS = {
  water: { depth: .24, bevelSize: .12, bevelThickness: .14, bevelSegments: 14, roughness: .06, transmission: .9, thickness: 1.1, ior: 1.33,
    attenuationDistance: .9, clearcoat: 1, clearcoatRoughness: .04, envIntensity: 1.5, size: 1, tint: '#d8efff', attenuationColor: '#7fb6e0' },
  glass: { depth: .1, bevelSize: .02, bevelThickness: .02, bevelSegments: 3, roughness: .12, transmission: .7, thickness: .3, ior: 1.5,
    attenuationDistance: 3, clearcoat: 1, clearcoatRoughness: .08, envIntensity: 1.1, size: 1, tint: '#ffffff', attenuationColor: '#ffffff' },
  silver: { depth: .16, bevelSize: .035, bevelThickness: .045, bevelSegments: 8, roughness: .04, transmission: .8, thickness: .9, ior: 1.5,
    attenuationDistance: 1.2, clearcoat: 1, clearcoatRoughness: .03, envIntensity: 1.8, size: 1, tint: '#e6eff8', attenuationColor: '#4f87c0' }
};

/* 旋鈕定義：[鍵, 名稱, 最小, 最大, 步進]。 */
const DEFS = [
  ['size', '整體大小', .5, 1.6, .01],
  ['depth', '擠出厚度（÷ 高度）', 0, .6, .005],
  ['bevelSize', '圓角寬度（÷ 高度）', 0, .3, .002],
  ['bevelThickness', '圓角厚度（÷ 高度）', 0, .3, .002],
  ['bevelSegments', '圓角段數', 1, 24, 1],
  ['roughness', '表面粗糙度', 0, 1, .01],
  ['transmission', '透光', 0, 1, .01],
  ['thickness', '厚度感（折射量）', 0, 3, .01],
  ['ior', '折射率', 1, 2.2, .01],
  ['attenuationDistance', '吸收距離（小＝越藍）', .05, 4, .01],
  ['clearcoat', '清漆光', 0, 1, .01],
  ['clearcoatRoughness', '清漆粗糙', 0, .5, .005],
  ['envIntensity', '環境反光', 0, 3, .01]
];
const COLORS = [['tint', '底色'], ['attenuationColor', '吸收色（水的藍）']];

let params = load() ?? { ...PRESETS.water };
function load() { try { const raw = localStorage.getItem(STORE_KEY); return raw ? { ...PRESETS.water, ...JSON.parse(raw) } : null; } catch { return null; } }
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(params)); } catch { /* 無痕或被擋：不影響原型 */ } }

/* ---------- 場景 ---------- */
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, .1, 100);
camera.position.set(0, 0, 8.2);

const key = new THREE.DirectionalLight('#fff1dc', 2.2); key.position.set(-4, 5, 6); scene.add(key);
const fill = new THREE.DirectionalLight('#8fb8ea', .8); fill.position.set(5, -2, 4); scene.add(fill);
const rim = new THREE.DirectionalLight('#bfe3ff', 1.2); rim.position.set(0, 3, -6); scene.add(rim);

const group = new THREE.Group();
scene.add(group);
let mesh = null, shapes = null, logoHeight = 1;
const material = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });

/* ---------- LOGO 1 → 實體 ---------- */
function shapesHeight(list) {
  let min = Infinity, max = -Infinity;
  for (const shape of list) for (const v of shape.getPoints(12)) { min = Math.min(min, v.y); max = Math.max(max, v.y); }
  return max - min;
}
function buildGeometry() {
  const H = logoHeight;
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: params.depth * H, bevelEnabled: true,
    bevelThickness: params.bevelThickness * H, bevelSize: params.bevelSize * H, bevelOffset: 0,
    bevelSegments: Math.round(params.bevelSegments), curveSegments: 32
  });
  geo.rotateX(Math.PI);                 // SVG 的 y 朝下：繞 X 轉半圈（不鏡射）
  geo.center();
  const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
  const k = TARGET_HEIGHT / Math.max(box.max.y - box.min.y, 1e-6);
  geo.scale(k, k, k);
  return geo;
}
function applyGeometry() {
  if (!shapes) return;
  const geo = buildGeometry();
  if (mesh) { mesh.geometry.dispose(); mesh.geometry = geo; }
  else { mesh = new THREE.Mesh(geo, material); group.add(mesh); }
}
function applyMaterial() {
  material.color.set(params.tint);
  material.roughness = params.roughness;
  material.metalness = 0;
  material.transmission = params.transmission;
  material.thickness = params.thickness;
  material.ior = params.ior;
  material.attenuationColor.set(params.attenuationColor);
  material.attenuationDistance = params.attenuationDistance;
  material.clearcoat = params.clearcoat;
  material.clearcoatRoughness = params.clearcoatRoughness;
  material.envMapIntensity = params.envIntensity;
  material.needsUpdate = true;
  group.scale.setScalar(params.size);
}

let rebuildQueued = false;
function queueGeometry() {
  if (rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(() => { rebuildQueued = false; applyGeometry(); });
}

async function loadLogo() {
  const text = await (await fetch(LOGO_URL)).text();
  const data = new SVGLoader().parse(text);
  shapes = data.paths.flatMap(path => SVGLoader.createShapes(path));
  logoHeight = shapesHeight(shapes) || 1;
  applyMaterial();
  applyGeometry();
}

/* ---------- 滾動 → 平旋轉 ---------- */
const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
const progress = () => Math.min(1, Math.max(0, scrollY / maxScroll()));
const easeInOut = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const readout = document.getElementById('readout');
let lastShown = '';

function frame() {
  requestAnimationFrame(frame);
  const t = progress();
  const angle = easeInOut(t) * Math.PI * 2;
  group.rotation.y = angle;
  const text = `旋轉 ${Math.round(t * 100)}%｜${Math.round(angle * 180 / Math.PI)}°`;
  if (text !== lastShown) { readout.textContent = text; lastShown = text; if (typeof syncScrubber === 'function') syncScrubber(t); }
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

/* ---------- 旋鈕 ---------- */
const controls = document.getElementById('controls');
const inputs = {};
let syncScrubber = null;

for (const [key, name, min, max, step] of DEFS) {
  const label = document.createElement('label');
  label.innerHTML = `<span>${name}</span><span class="v"></span><input type="range" min="${min}" max="${max}" step="${step}">`;
  const input = label.querySelector('input'), value = label.querySelector('.v');
  inputs[key] = { input, value };
  input.addEventListener('input', () => {
    params[key] = Number(input.value);
    value.textContent = params[key].toFixed(step < 1 ? (String(step).split('.')[1] || '').length : 0);
    save();
    if (['depth', 'bevelSize', 'bevelThickness', 'bevelSegments'].includes(key)) queueGeometry();
    applyMaterial();
  });
  controls.appendChild(label);
}
for (const [key, name] of COLORS) {
  const label = document.createElement('label');
  label.className = 'full';
  label.innerHTML = `<span>${name}</span><input type="color">`;
  const input = label.querySelector('input');
  inputs[key] = { input };
  input.addEventListener('input', () => { params[key] = input.value; save(); applyMaterial(); });
  controls.appendChild(label);
}
function syncInputs() {
  for (const [key, name, , , step] of DEFS) {
    const { input, value } = inputs[key];
    input.value = params[key];
    value.textContent = Number(params[key]).toFixed(step < 1 ? (String(step).split('.')[1] || '').length : 0);
  }
  for (const [key] of COLORS) inputs[key].input.value = params[key];
}
function setParams(next) { params = { ...next }; syncInputs(); save(); queueGeometry(); applyMaterial(); }

/* 進度滑桿：拖動即是滾動位置（同一個來源） */
{
  const scrub = document.createElement('label');
  scrub.className = 'full';
  scrub.innerHTML = '<span>旋轉進度（拖動＝滾動）</span><input type="range" min="0" max="1" step="0.001">';
  const input = scrub.querySelector('input');
  input.addEventListener('input', () => scrollTo(0, Number(input.value) * maxScroll()));
  syncScrubber = t => { input.value = t; };
  controls.prepend(scrub);
}

document.getElementById('preset-water').addEventListener('click', () => setParams(PRESETS.water));
document.getElementById('preset-glass').addEventListener('click', () => setParams(PRESETS.glass));
document.getElementById('preset-silver').addEventListener('click', () => setParams(PRESETS.silver));
document.getElementById('reset').addEventListener('click', () => setParams(PRESETS.water));
document.getElementById('copy').addEventListener('click', async () => {
  const text = JSON.stringify(params, null, 2);
  try { await navigator.clipboard.writeText(text); readout.textContent = '參數已複製（JSON）'; }
  catch { console.log(text); readout.textContent = '無法複製，請看主控台的 JSON'; }
});

syncInputs();
applyMaterial();
loadLogo().catch(error => { readout.textContent = 'LOGO 1 載入失敗：' + error.message; console.warn(error); });
frame();
