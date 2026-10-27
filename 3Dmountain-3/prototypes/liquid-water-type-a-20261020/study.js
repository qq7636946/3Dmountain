// Isolated A approval viewer. No production files, animation paths or GSAP timelines are imported.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLiquidStudio } from './liquid-studio.js';

const mount = document.querySelector('#stage');
const status = document.querySelector('#status');
const statsNode = document.querySelector('#stats');
const initialReduced = matchMedia('(prefers-reduced-motion: reduce)');
let activeStudy;

export async function mountStudy() {
  activeStudy?.dispose();
  status.hidden = false;
  status.classList.remove('error');
  status.textContent = '載入獨立 A 模型與水體材質…';
  const abort = new AbortController();
  const listen = (target, type, cb, options = {}) => target.addEventListener(type, cb, { ...options, signal: abort.signal });
  const lite = innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, lite ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene();
  const backgroundCanvas = document.createElement('canvas');
  backgroundCanvas.width = 8; backgroundCanvas.height = 1024;
  const backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);
  backgroundTexture.colorSpace = THREE.SRGBColorSpace;
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 60);
  const studio = createLiquidStudio(THREE, renderer, scene, { lite });
  const modelGroup = new THREE.Group();
  scene.add(modelGroup);
  const floorMat = new THREE.MeshStandardMaterial({ color: '#e4e2db', roughness: .72, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.025;
  floor.receiveShadow = true;
  // A seamless photographic plate supplies the neutral studio ground appearance.
  // The optional opaque diagnostic backplate is still real scene geometry.
  floor.visible = false;
  scene.add(floor);
  const contactMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uOpacity: { value: .2 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv;uniform float uOpacity;void main(){
      vec2 p=(vUv-.5)*vec2(3.4,1.9);
      float a=exp(-dot((p-vec2(-.73,0.))*vec2(3.,5.5),(p-vec2(-.73,0.))*vec2(3.,5.5)));
      float b=exp(-dot((p-vec2(.73,0.))*vec2(3.,5.5),(p-vec2(.73,0.))*vec2(3.,5.5)));
      gl_FragColor=vec4(.07,.09,.10,min(a+b,1.)*uOpacity);
      #include <colorspace_fragment>
    }`
  });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(3.4,1.9), contactMaterial);
  contact.rotation.x=-Math.PI/2; contact.position.y=-.02;
  modelGroup.add(contact);
  // A broad backplate, behind the transmissive geometry, establishes actual background refraction.
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 1024; plateCanvas.height = 1024;
  const plateCtx = plateCanvas.getContext('2d');
  plateCtx.fillStyle = '#eae9e4'; plateCtx.fillRect(0, 0, 1024, 1024);
  for (let x = 0; x < 1024; x += 64) {
    plateCtx.fillStyle = x % 128 ? '#7295a4' : '#c0bbaa';
    plateCtx.fillRect(x, 0, 18, 1024);
  }
  for (let y = 0; y < 1024; y += 64) {
    plateCtx.fillStyle = '#718794'; plateCtx.fillRect(0, y, 1024, 2);
  }
  const plateTex = new THREE.CanvasTexture(plateCanvas);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  const plateMat = new THREE.MeshBasicMaterial({ map: plateTex });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(24, 15), plateMat);
  plate.position.set(0, 5, -2);
  plate.visible = false;
  scene.add(plate);
  let disposed = false, ready = false, model = null, raf = 0, currentView = 'quarter';
  let rotating = false, dark = false, pattern = false, reduced = initialReduced.matches;
  let previousTime = 0, motionTime = 0, lastStats = 0, frameTimes = [], frameCount = 0;
  const bounds = new THREE.Box3();
  const geometrySet = new Set();
  const api = {
    ready: false, disposed: false, renderer, scene, camera, studio, modelGroup,
    setView, setBackground, setPattern, setRotation, dispose,
    stats: () => ({
      ready, disposed, reducedMotion: reduced, view: currentView, rotating, frameCount,
      pixelRatio: renderer.getPixelRatio(), width: innerWidth, height: innerHeight,
      drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0,
      modelVertices: [...geometrySet].reduce((n, g) => n + g.attributes.position.count, 0),
      modelBounds: ready ? { min: bounds.min.toArray(), max: bounds.max.toArray() } : null,
      cpuRafMeanMs: frameTimes.length ? frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length : null,
      note: 'CPU requestAnimationFrame interval; not GPU timing.',
      shadowMethod: 'Art-directed soft contact shadow; not ray-traced caustics.',
      material: { ior: studio.material.ior, transmission: studio.material.transmission, roughness: studio.material.roughness, thickness: studio.material.thickness }
    }),
    remount: mountStudy
  };
  activeStudy = api;
  window.__WATER_A_STUDY__ = api;
  function syncButtons() {
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === currentView)));
    document.querySelector('#rotation').setAttribute('aria-pressed', String(rotating));
    document.querySelector('#rotation').textContent = rotating ? '暫停旋轉' : '開始旋轉';
    document.querySelector('#background').setAttribute('aria-pressed', String(dark));
    document.querySelector('#background').textContent = dark ? '淺色背景' : '深色背景';
    document.querySelector('#pattern').setAttribute('aria-pressed', String(pattern));
  }
  function fitCamera() {
    camera.aspect = innerWidth / innerHeight;
    // Reserve upper and lower room for UI without hiding the feet or apex on narrow screens.
    const aspectScale = Math.max(1, .8 / camera.aspect);
    const distance = 7.2 * aspectScale;
    const yaw = currentView === 'front' ? 0 : currentView === 'side' ? Math.PI / 2 : .49;
    camera.position.set(Math.sin(yaw)*distance, 1.65 + distance*.085, Math.cos(yaw)*distance);
    camera.lookAt(0, 1.3, 0);
    camera.updateProjectionMatrix();
  }
  function setView(view) {
    if (!['front','quarter','side'].includes(view)) return;
    currentView = view; modelGroup.rotation.y = 0; rotating = false;
    fitCamera(); syncButtons();
  }
  function setBackground(value) {
    dark = value === 'dark' || value === true;
    const ctx = backgroundCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0,0,0,1024);
    gradient.addColorStop(0,dark?'#111c24':'#69757e');
    gradient.addColorStop(.45,dark?'#263641':'#adb3b4');
    gradient.addColorStop(1,dark?'#4b5960':'#e0e0da');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,8,1024);
    backgroundTexture.needsUpdate=true;
    scene.background=backgroundTexture;
    floorMat.color.set(dark ? '#273139' : '#e4e2db');
    document.body.classList.toggle('dark', dark); syncButtons();
  }
  function setPattern(value) { pattern = !!value; plate.visible = pattern; syncButtons(); }
  function setRotation(value) { rotating = !!value && !reduced; syncButtons(); }
  function resize() { renderer.setSize(innerWidth, innerHeight, false); fitCamera(); }
  function frame(time) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = previousTime ? Math.min((time - previousTime)/1000,.05) : 0;
    if (previousTime) { frameTimes.push(time - previousTime); if(frameTimes.length>120)frameTimes.shift(); }
    previousTime = time;
    if (!reduced) motionTime += dt;
    if (rotating && ready) modelGroup.rotation.y += dt * .18;
    studio.update(motionTime);
    renderer.render(scene, camera);
    frameCount++;
    if (time - lastStats > 650) {
      const s = api.stats();
      statsNode.textContent = `${s.drawCalls} draw calls · ${s.triangles.toLocaleString()} triangles\nDPR ${s.pixelRatio.toFixed(2)} · ${s.geometries} geometries · ${s.textures} textures`;
      statsNode.style.whiteSpace = 'pre-line';
      lastStats = time;
    }
  }
  function dispose() {
    if (disposed) return api.stats();
    disposed = true; api.disposed = true; api.ready = false; ready = false;
    cancelAnimationFrame(raf); abort.abort();
    for (const g of geometrySet) g.dispose();
    floor.geometry.dispose(); floorMat.dispose();
    plate.geometry.dispose(); plateMat.dispose(); plateTex.dispose();
    backgroundTexture.dispose(); contact.geometry.dispose(); contactMaterial.dispose();
    studio.dispose();
    renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss();
    renderer.domElement.remove();
    scene.clear();
    return api.stats();
  }
  document.querySelectorAll('[data-view]').forEach(b => listen(b,'click',()=>setView(b.dataset.view)));
  listen(document.querySelector('#rotation'),'click',()=>setRotation(!rotating));
  listen(document.querySelector('#background'),'click',()=>setBackground(!dark));
  listen(document.querySelector('#pattern'),'click',()=>setPattern(!pattern));
  listen(initialReduced,'change',e=>{ reduced=e.matches; if(reduced)setRotation(false); });
  listen(window,'resize',resize);
  listen(window,'pagehide',dispose);
  listen(renderer.domElement,'webglcontextlost',e=>{
    if(disposed)return;
    e.preventDefault(); status.hidden=false; status.classList.add('error');
    status.textContent='WebGL 內容遺失，請重新載入此獨立測試頁。';
  });
  resize(); setBackground('light'); syncButtons(); raf=requestAnimationFrame(frame);
  try {
    const gltf = await new GLTFLoader().loadAsync(lite ? './assets/water-A-mobile.glb' : './assets/water-A.glb');
    if (disposed) {
      gltf.scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material))m.dispose();});
      return api;
    }
    model = gltf.scene;
    const oldMaterials = new Set(), oldTextures = new Set();
    model.traverse(o=>{
      if (!o.isMesh) return;
      geometrySet.add(o.geometry);
      for(const m of [].concat(o.material)) {
        oldMaterials.add(m);
        for(const value of Object.values(m))if(value?.isTexture)oldTextures.add(value);
      }
      o.material = studio.material;
      o.castShadow = false; // An opaque shadow map would falsely paint a black A beneath transparent water.
      o.receiveShadow = false;
    });
    oldMaterials.forEach(m=>m.dispose());oldTextures.forEach(t=>t.dispose());
    modelGroup.add(model); bounds.setFromObject(model);
    if (!Number.isFinite(bounds.max.y) || bounds.isEmpty()) throw new Error('模型不含有效可視幾何。');
    ready = true; api.ready = true; api.model = model;
    status.hidden = true;
  } catch(error) {
    if (disposed)return api;
    api.error = String(error);
    status.hidden = false; status.classList.add('error');
    status.textContent = `A 模型尚未成功載入：${error.message || error}`;
    console.error('[Water A study]', error);
  }
  return api;
}

mountStudy().catch(error=>{
  status.hidden=false;status.classList.add('error');
  status.textContent=`無法初始化獨立 WebGL 測試：${error.message || error}`;
  console.error(error);
});
