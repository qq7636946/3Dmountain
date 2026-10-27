import * as THREE from 'three';
import { Water } from './vendor/Water.js';
import { createTerrainMaterial } from './terrain-material.js';

const $=s=>document.querySelector(s), params=new URLSearchParams(location.search);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile=innerWidth<700 || (navigator.deviceMemory && navigator.deviceMemory<=4);
const low=mobile || params.get('quality')==='low';
const assetSize=low?1024:2048;
let paused=reduced, disposed=false, needsRender=true, time=0, raf=0, cloudy=false, requestedView='close';
let renderer,terrain,water,environment,sky,shoreHeight;
const textures=[], fallbackAssets=[];
const api=window.__HIGHLAND_STUDY__={ready:false,errors:fallbackAssets};
function notice(message){$('#notice').textContent=message;$('#notice').hidden=false;}
function flatTexture(value,color=false){const t=new THREE.DataTexture(new Uint8Array([...value,255]),1,1);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.needsUpdate=true;return t;}
async function loadMap(file,kind){
  let t;
  try {t=await new THREE.TextureLoader().loadAsync(`./assets/${file}`);}
  catch {fallbackAssets.push(file);t=flatTexture(kind==='normal'?[128,128,255]:kind==='color'?[110,118,91]:[218,218,218],kind==='color');}
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=kind==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
  t.anisotropy=Math.min(low?4:8,renderer.capabilities.getMaxAnisotropy());textures.push(t);return t;
}

const scene=new THREE.Scene();
scene.background=new THREE.Color('#cbd6d3');scene.fog=new THREE.FogExp2('#ced8d4',.00020);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.8,12000);
const sun=new THREE.DirectionalLight('#fff1d4',3.8);
sun.position.set(-650,330,400);sun.castShadow=true;
sun.shadow.mapSize.setScalar(low?1024:2048);
Object.assign(sun.shadow.camera,{left:-760,right:760,top:760,bottom:-760,near:20,far:1800});
sun.shadow.bias=-.00015;sun.shadow.normalBias=.7;
const hemi=new THREE.HemisphereLight('#cfdfeb','#353b2b',.85);
scene.add(sun,hemi);

function createSky(){
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{sunDirection:{value:sun.position.clone().normalize()},cloudy:{value:0}},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
    varying vec3 vDirection;uniform vec3 sunDirection;uniform float cloudy;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.26+noise(p*4.07)*.13+noise(p*8.1)*.06;}
    void main(){vec3 d=normalize(vDirection);float up=max(d.y,0.);
      vec3 c=mix(vec3(.72,.79,.78),vec3(.17,.33,.46),pow(up,.48));
      vec2 p=d.xz/(abs(d.y)+.22)*2.2;
      float clouds=smoothstep(.37,.68,fbm(p+vec2(4.,7.)));
      clouds*=smoothstep(-.03,.18,d.y);
      c=mix(c,mix(vec3(.36,.43,.47),vec3(.92,.93,.87),smoothstep(.40,.64,fbm(p+vec2(4.15,7.13)))),clouds*.92);
      float glow=pow(max(dot(d,sunDirection),0.),16.);
      c+=vec3(.26,.23,.16)*glow;
      c=mix(c,vec3(.67,.73,.73),cloudy*.38);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  return new THREE.Mesh(new THREE.SphereGeometry(5500,32,16),material);
}

function makeTerrain(data,material){
  const count=low?128:256;
  const geo=new THREE.PlaneGeometry(1200,1200,count,count);geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position, ao=new Float32Array(p.count);
  const sample=(x,z)=>{
    const ix=THREE.MathUtils.clamp(Math.round((x+600)/1200*512),0,512);
    const iz=THREE.MathUtils.clamp(Math.round((600-z)/1200*512),0,512);
    return data[iz*513+ix];
  };
  const surfaceHeight=(x,z)=>{
    const edge=1.-THREE.MathUtils.smoothstep(Math.max(Math.abs(x),Math.abs(z)),430,600);
    return (sample(x,z)*68-32)*edge-16*(1-edge);
  };
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),h=sample(x,z);
    const y=surfaceHeight(x,z);
    p.setY(i,y);
    const neighbours=(sample(x+12,z)+sample(x-12,z)+sample(x,z+12)+sample(x,z-12))/4;
    ao[i]=THREE.MathUtils.clamp(1-(neighbours-h)*2.5,.60,1);
  }
  geo.setAttribute('terrainAO',new THREE.BufferAttribute(ao,1));geo.computeVertexNormals();geo.computeBoundingSphere();
  const shoreData=new Float32Array(513*513);
  for(let z=0;z<513;z++)for(let x=0;x<513;x++)shoreData[z*513+x]=surfaceHeight(x/512*1200-600,600-z/512*1200);
  shoreHeight=new THREE.DataTexture(shoreData,513,513,THREE.RedFormat,THREE.FloatType);
  shoreHeight.minFilter=shoreHeight.magFilter=THREE.LinearFilter;shoreHeight.needsUpdate=true;textures.push(shoreHeight);
  const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.name='Licensed eroded terrain / reduced grid';return mesh;
}

const shots={
  close:{position:new THREE.Vector3(470,96,560),target:new THREE.Vector3(-55,65,-70),fov:43},
  aerial:{position:new THREE.Vector3(480,510,730),target:new THREE.Vector3(-70,10,-80),fov:48}
};
let currentPos=shots.close.position.clone(),currentTarget=shots.close.target.clone(),currentFov=43;
function setView(name,instant=false){
  if(!shots[name])return;requestedView=name;document.body.dataset.view=name;
  document.querySelectorAll('[data-view]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.view===name));});
  $('#shot-description').textContent=name==='close'?'以岩壁的厚度，承接海面的光。':'苔綠山脊，向銀白色的海延伸。';
  if(instant||reduced){currentPos.copy(shots[name].position);currentTarget.copy(shots[name].target);currentFov=shots[name].fov;}
  needsRender=true;
}
function setLighting(overcast){
  cloudy=overcast;sun.intensity=cloudy?1.25:3.8;hemi.intensity=cloudy?1.3:.85;
  sky.material.uniforms.cloudy.value=cloudy?1:0;
  scene.fog.density=cloudy?.00040:.00020;
  $('#light').setAttribute('aria-pressed',String(cloudy));needsRender=true;
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();needsRender=true;}
let last=0;
function frame(ms){
  if(disposed)return;raf=requestAnimationFrame(frame);
  const dt=Math.min((ms-last)/1000||.016,.05);last=ms;
  if(document.hidden)return;
  const shot=shots[requestedView],blend=1-Math.exp(-dt*2.8);
  const moving=currentPos.distanceTo(shot.position)>.03||currentTarget.distanceTo(shot.target)>.03;
  currentPos.lerp(shot.position,blend);currentTarget.lerp(shot.target,blend);currentFov=THREE.MathUtils.lerp(currentFov,shot.fov,blend);
  if(paused&&!needsRender&&!moving)return;
  if(!paused)time+=dt;
  camera.position.copy(currentPos);
  // A subtle breathing drift only; never changes the two authored compositions.
  if(!paused&&!reduced){camera.position.x+=Math.sin(time*.065)*2;camera.position.y+=Math.sin(time*.09)*.55;}
  camera.lookAt(currentTarget);camera.fov=currentFov+(innerWidth<700?12:0);camera.updateProjectionMatrix();
  water.material.uniforms.time.value=time*.32;
  renderer.info.reset();renderer.render(scene,camera);needsRender=false;
}
function dispose(){
  if(disposed)return;disposed=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);
  scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of [o.material].flat())m.dispose();}});
  textures.forEach(t=>t.dispose());environment?.dispose();water?.getRenderTarget?.()?.dispose();sun.shadow.map?.dispose();renderer?.dispose();
}
async function init(){
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:low?'low-power':'high-performance',alpha:false});}
  catch(e){throw new Error('此裝置無法啟動 WebGL2，請使用支援硬體加速的瀏覽器。');}
  renderer.setPixelRatio(Math.min(devicePixelRatio,low?1.25:1.65));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.info.autoReset=false;
  $('#scene').append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;notice('繪圖資源中斷，請重新整理以恢復測試。');});
  sky=createSky();scene.add(sky);
  const pmrem=new THREE.PMREMGenerator(renderer),envScene=new THREE.Scene();envScene.add(sky.clone());
  environment=pmrem.fromScene(envScene,.08,.1,6000);scene.environment=environment.texture;scene.environmentIntensity=.25;pmrem.dispose();
  const entries=await Promise.all(['rock','grass'].flatMap(name=>['Color','Normal','Roughness'].map(async suffix=>{
    const id=name==='rock'?'cliff_side':'aerial_grass_rock',kind=suffix.toLowerCase();
    return [name+suffix,await loadMap(`${id}-${kind}-${assetSize}.webp`,kind)];
  })));
  const response=await fetch('./assets/terrain-height-513.bin');if(!response.ok)throw new Error('山體資料無法載入，請確認使用本機伺服器開啟。');
  const heights=new Float32Array(await response.arrayBuffer());if(heights.length!==513*513)throw new Error('山體資料不完整。');
  const erosion=await loadMap(`terrain-erosion-normal-${assetSize}.webp`,'normal');erosion.flipY=false;erosion.wrapS=erosion.wrapT=THREE.ClampToEdgeWrapping;
  entries.push(['erosionNormal',erosion]);
  terrain=makeTerrain(heights,createTerrainMaterial(Object.fromEntries(entries)));scene.add(terrain);
  const normals=await loadMap('waternormals.jpg','normal');
  water=new Water(new THREE.PlaneGeometry(100000,100000),{textureWidth:low?256:768,textureHeight:low?256:768,waterNormals:normals,alpha:1,sunDirection:sun.position.clone().normalize(),sunColor:0xfff5e5,waterColor:0xc4d4d6,distortionScale:3.1,fog:true});
  water.rotation.x=-Math.PI/2;
  // Dielectric water with pale sky reflection. Blue belongs in the reflection, not an opaque paint layer.
  water.material.fragmentShader=water.material.fragmentShader
    .replace('uniform sampler2D mirrorSampler;','uniform sampler2D mirrorSampler; uniform sampler2D shoreHeight;')
    .replace('vec3( 1.5, 1.0, 1.5 )','vec3( 0.72, 1.0, 0.72 )')
    .replace('float rf0 = 0.3;','float rf0 = 0.055;')
    .replace('vec3 outgoingLight = albedo;',`vec3 outgoingLight = mix(albedo * 1.2, vec3(.17,.35,.53), smoothstep(.025,.19,abs(surfaceNormal.x+surfaceNormal.z))*.31);
      vec2 uvShore=vec2((worldPosition.x+600.)/1200.,(600.-worldPosition.z)/1200.);
      float shoreY=texture2D(shoreHeight,uvShore).r;
      float inside=step(0.,uvShore.x)*step(0.,uvShore.y)*step(uvShore.x,1.)*step(uvShore.y,1.);
      float foam=smoothstep(-3.5,-.15,shoreY)*inside;
      foam*=.48+.3*sin(worldPosition.x*.7+worldPosition.z*.6+time*1.8);
      outgoingLight=mix(outgoingLight,vec3(.85,.93,.94),foam*.7);`);
  water.material.uniforms.shoreHeight={value:shoreHeight};
  water.material.uniforms.size.value=3.4;scene.add(water);
  $('#mesh-stat').textContent=`${(terrain.geometry.index.count/3).toLocaleString()} 三角面 · ${low?'輕量':'桌機'}模式`;
  $('#texture-stat').textContent=`${assetSize===2048?'2K':'1K'} / Color + Normal + Roughness`;
  if(fallbackAssets.length)notice('部分貼圖載入失敗，已切換基礎材質；請重新整理或檢查 assets 資料夾。');
  api.ready=true;api.setView=setView;api.setLighting=setLighting;api.dispose=dispose;
  api.pause=()=>{paused=true;needsRender=true};api.resume=()=>{paused=false;needsRender=true};
  api.stats=()=>({triangles:terrain.geometry.index.count/3,totalTriangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,textures:renderer.info.memory.textures,geometry:renderer.info.memory.geometries,quality:low?'low':'high',mapSize:assetSize,reducedMotion:reduced,paused,view:requestedView,fallbackAssets:[...fallbackAssets],finite:[...terrain.geometry.attributes.position.array,...terrain.geometry.attributes.normal.array].every(Number.isFinite)});
  api.camera=camera;api.shots=shots;api.renderer=renderer;api.scene=scene;
  setView(params.get('view')==='aerial'?'aerial':'close',true);$('#loading').classList.add('done');
  $('#motion').textContent=paused?'播放動態':'暫停動態';$('#motion').setAttribute('aria-pressed',String(paused));
  requestAnimationFrame(frame);
}
document.querySelectorAll('button[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('#light').addEventListener('click',()=>setLighting(!cloudy));
$('#motion').addEventListener('click',()=>{paused=!paused;needsRender=true;$('#motion').textContent=paused?'播放動態':'暫停動態';$('#motion').setAttribute('aria-pressed',String(paused));});
function showInfo(show){$('#details').hidden=!show;$('#info').setAttribute('aria-expanded',String(show));if(show)$('#close-info').focus();else $('#info').focus();}
$('#info').addEventListener('click',()=>showInfo($('#details').hidden));$('#close-info').addEventListener('click',()=>showInfo(false));
window.addEventListener('keydown',e=>{if(e.key==='Escape')showInfo(false);if(/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.key==='ArrowDown')setView('aerial');if(e.key==='ArrowUp')setView('close');});
let wheelTotal=0,wheelTimer;
window.addEventListener('wheel',e=>{if(!$('#details').hidden)return;wheelTotal+=e.deltaY;clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>wheelTotal=0,180);if(Math.abs(wheelTotal)>90){setView(wheelTotal>0?'aerial':'close');wheelTotal=0;}},{passive:true});
window.addEventListener('resize',resize);window.addEventListener('pagehide',dispose,{once:true});
init().catch(e=>{$('#loading').innerHTML='';$('#loading').textContent=e.message;$('#loading').classList.add('error');console.error(e);api.failure=e.message;});
