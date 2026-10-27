import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createPotato,makeMicroMaps } from './model.js';

const $=s=>document.querySelector(s),viewport=$('#viewport');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const api=window.__POTATO_STUDY__={ready:false};
document.querySelectorAll('button').forEach(b=>b.disabled=true);
let renderer,controls,model,camera,potato,raf=0,disposed=false,resizeObserver,exportUrl;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);
const target=new THREE.Vector3(0,2.96807,0),textures=[];
function message(t){$('#message').textContent=t;$('#message').hidden=false;}
function resetView(back=false){controls.autoRotate=false;$('#rotate').setAttribute('aria-pressed','false');camera.position.set(back?0.001:0,target.y,back?-15:15);camera.zoom=1;controls.target.copy(target);camera.updateProjectionMatrix();controls.update();}
function sideView(){resetView();camera.position.set(15,target.y,0);controls.update();}
function resize(){if(!renderer)return;const w=viewport.clientWidth,h=viewport.clientHeight,aspect=w/h,span=Math.max(8.37906,3.76552/aspect);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();renderer.setSize(w,h);}
function animate(){if(disposed)return;raf=requestAnimationFrame(animate);if(document.hidden)return;controls.update();renderer.render(scene,camera);}
function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);controls?.dispose();resizeObserver?.disconnect();scene.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat())m?.dispose();});potato?.extraMaterials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer?.dispose();if(exportUrl)URL.revokeObjectURL(exportUrl);}
async function exportModel(){
  $('#export').disabled=true;
  try{
    const { GLTFExporter }=await import('./vendor/GLTFExporter.js');
    const buffer=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true,maxTextureSize:2048});
    if(exportUrl)URL.revokeObjectURL(exportUrl);exportUrl=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'}));
    const a=document.createElement('a');a.href=exportUrl;a.download='sweet-potato-continuous-v2.glb';a.click();
    message('已匯出可旋轉的 GLB，包含模型與材質。背面為推估重建，不是照片掃描。');
    return buffer.byteLength;
  }catch(e){message('匯出失敗：'+e.message);throw e;}finally{$('#export').disabled=false;}
}
async function init(){
  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.5:2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  viewport.append(renderer.domElement);
  camera=new THREE.OrthographicCamera(-4,4,4,-4,.05,80);camera.position.set(0,target.y,15);
  controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);controls.enableDamping=!reduced;controls.dampingFactor=.08;controls.enablePan=false;controls.minZoom=.6;controls.maxZoom=3.2;controls.autoRotateSpeed=.6;controls.update();
  const ambient=new THREE.HemisphereLight(0xffffff,0xd8d4bd,1.15);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xfff9eb,2.1);key.position.set(-4,8,7);key.castShadow=true;key.shadow.mapSize.setScalar(innerWidth<700?1024:2048);Object.assign(key.shadow.camera,{left:-3,right:3,top:5,bottom:-5,near:.5,far:25});key.target.position.set(0,3,0);key.shadow.bias=-.0003;key.shadow.normalBias=.015;key.shadow.radius=4;scene.add(key,key.target);
  const fill=new THREE.DirectionalLight(0xf0f4ff,.5);fill.position.set(4,4,-3);scene.add(fill);
  const loader=new THREE.TextureLoader();
  const [skin,leaf]=await Promise.all(['skin-albedo.png','leaf-albedo.png'].map(f=>loader.loadAsync('./assets/'+f)));
  for(const t of [skin,leaf]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.push(t);}
  const micro=makeMicroMaps();textures.push(micro.normal,micro.roughness);
  const profile=await fetch('./assets/tuber-profile.json').then(r=>{if(!r.ok)throw new Error('Missing tuber profile');return r.json()});
  const object=createPotato({skin,leaf,profile:profile.profile,...micro});potato=object;model=object.model;scene.add(model);textures.push(...object.extraTextures);
  model.userData={revision:2,reference:'Single user-provided photograph; unseen surfaces inferred.',textures:'Unified continuous PBR skin, mirrored-period cylindrical UV. Generated leaf albedo.',authoring:'Closed tuber surface with welded seam normals; closed curved leaf silhouettes, thin rims, upper/lower surfaces and spatially distributed petioles.'};
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);resize();
  let triangles=0;model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  $('#stats').textContent=`${Math.round(triangles).toLocaleString()} 三角面 · ${object.leafCount} 片葉`;
  Object.assign(api,{ready:true,model,body:object.body,scene,camera,renderer,controls,exportModel,resetView,sideView,dispose,stats:()=>({triangles,leaves:object.leafCount,closedLeaves:model.children.filter(m=>m.geometry?.userData.closedLeaf).length,meshes:model.children.length,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,drawCalls:renderer.info.render.calls,finite:model.children.every(m=>[...m.geometry.attributes.position.array,...m.geometry.attributes.normal.array].every(Number.isFinite))})});
  $('#loading').classList.add('done');document.querySelectorAll('button').forEach(b=>b.disabled=false);animate();
  renderer.domElement.addEventListener('dblclick',()=>resetView());
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();message('WebGL 資源中斷，請重新整理頁面。');});
}
$('#front').addEventListener('click',()=>resetView());$('#back').addEventListener('click',()=>resetView(true));$('#side').addEventListener('click',sideView);
$('#rotate').addEventListener('click',()=>{controls.autoRotate=!controls.autoRotate;$('#rotate').setAttribute('aria-pressed',String(controls.autoRotate));});
$('#compare').addEventListener('click',()=>{const show=$('#reference').hidden;$('#reference').hidden=!show;document.body.classList.toggle('comparing',show);$('#compare').setAttribute('aria-pressed',String(show));});
$('#export').addEventListener('click',()=>exportModel().catch(console.error));
window.addEventListener('pagehide',dispose,{once:true});
init().catch(e=>{$('#loading').textContent='無法載入 3D 模型：'+e.message;api.failure=e.message;console.error(e);});
