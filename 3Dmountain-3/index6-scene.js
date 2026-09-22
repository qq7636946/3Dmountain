import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGlassLogo } from './index6-logo.js?v=1';
import { sampleLogoMotion } from './index6-motion.js?v=rotation-2';

const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const root=document.documentElement,stage=document.querySelector('#stage');
const clamp=x=>Math.min(1,Math.max(0,x));
const ease=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const state={progress:0,target:0,ready:false,time:0};
let renderer,composer,scene,camera,logo,particles,heading,headingTexture,environment,pmrem;
let visible=true,last=performance.now(),raf=0;
const disposables=[];
const navIntro=document.querySelector('#introLink'),navAbout=document.querySelector('#aboutLink'),cue=document.querySelector('#scrollCue'),copy=document.querySelector('#aboutCopy');
function scrollToChapter(about){const max=document.documentElement.scrollHeight-innerHeight;window.scrollTo({top:about?max:0,behavior:reduced?'instant':'smooth'});}
for(const a of document.querySelectorAll('a[href^="#"]'))a.addEventListener('click',e=>{e.preventDefault();scrollToChapter(a.hash==='#about');});
cue.addEventListener('click',()=>scrollToChapter(state.target<.85));
addEventListener('scroll',()=>{state.target=clamp(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight));},{passive:true});

function makeEnvironment(){
 const room=new THREE.Scene();room.background=new THREE.Color('#030609');
 const panel=(x,y,z,w,h,color)=>{const material=new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(...color),side:THREE.DoubleSide});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);mesh.position.set(x,y,z);mesh.lookAt(0,0,0);room.add(mesh);disposables.push(mesh.geometry,material);};
 panel(-4,1,3,1.8,7,[4.8,5.2,6]);panel(2.5,4,2,5,.6,[5.2,5.5,6]);panel(4,-.5,1,.5,6,[1.5,1.2,3.3]);panel(-1,-4,2,4,.3,[1.5,2.3,2.5]);panel(0,1,-4,5,6,[2.5,2.8,4.2]);panel(1,0,4,.32,4,[3,3,3.4]);
 pmrem=new THREE.PMREMGenerator(renderer);const target=pmrem.fromScene(room,.035,.1,30);disposables.push(target);return target.texture;
}
function makeHeading(){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=2048;canvas.height=810;
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#e9f2f4';ctx.font='400 228px "Chakra Petch"';ctx.textBaseline='top';
 for(const [i,line]of ['TECHNOLOGY','FINANCE','REIMAGINED'].entries())ctx.fillText(line,6,i*247);
 headingTexture=new THREE.CanvasTexture(canvas);headingTexture.colorSpace=THREE.SRGBColorSpace;headingTexture.minFilter=THREE.LinearFilter;
 const material=new THREE.MeshBasicMaterial({map:headingTexture,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
 heading=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);heading.name='Typography behind refractive logo';heading.renderOrder=-2;scene.add(heading);disposables.push(headingTexture,heading.geometry,material);
}
function buildParticles(){
 const count=innerWidth<700?7500:14500;
 const start=new Float32Array(count*3),target=new Float32Array(count*3),seed=new Float32Array(count),size=new Float32Array(count);
 const faces=[];let total=0;const A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
 for(const geometry of logo.geometries){const pos=geometry.attributes.position,index=geometry.index;const n=index?index.count:pos.count;for(let j=0;j<n;j+=3){A.fromBufferAttribute(pos,index?index.getX(j):j);B.fromBufferAttribute(pos,index?index.getX(j+1):j+1);C.fromBufferAttribute(pos,index?index.getX(j+2):j+2);const area=ab.subVectors(B,A).cross(ac.subVectors(C,A)).length()*.5;if(area<1e-9)continue;total+=area;faces.push({a:A.clone(),b:B.clone(),c:C.clone(),sum:total});}}
 let randomState=16439;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)|0;return(randomState>>>0)/4294967296;};
 for(let i=0;i<count;i++){
  const r=random()*total;let lo=0,hi=faces.length-1;while(lo<hi){const m=(lo+hi)>>1;if(faces[m].sum<r)lo=m+1;else hi=m;}const f=faces[lo],u=Math.sqrt(random()),v=random();A.copy(f.a).multiplyScalar(1-u).addScaledVector(f.b,u*(1-v)).addScaledVector(f.c,u*v);target.set(A.toArray(),i*3);
  const phi=random()*Math.PI*2,theta=Math.acos(random()*2-1),radius=Math.pow(random(),.48)*2.9;
  start.set([Math.sin(theta)*Math.cos(phi)*radius*.9,Math.cos(theta)*radius*1.16,Math.sin(theta)*Math.sin(phi)*radius*.60],i*3);seed[i]=random();size[i]=.6+random()*1.35;
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(start,3));geometry.setAttribute('aTarget',new THREE.BufferAttribute(target,3));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seed,1));geometry.setAttribute('aSize',new THREE.BufferAttribute(size,1));
 const uniforms={uTime:{value:0},uMorph:{value:0},uOpacity:{value:1},uDpr:{value:Math.min(devicePixelRatio,1.8)}};
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms,
 vertexShader:`attribute vec3 aTarget;attribute float aSeed,aSize;uniform float uTime,uMorph,uDpr;varying float vSeed;void main(){vSeed=aSeed;vec3 p=position;float phase=uTime*.1+aSeed*6.283;float c=cos(uTime*.07),s=sin(uTime*.07);p.xz=mat2(c,-s,s,c)*p.xz;p+=vec3(sin(phase+p.y),cos(phase*.83+p.x),sin(phase*.71+p.z))*.16;p=mix(p,aTarget,uMorph);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(5.,aSize*uDpr*(9./-mv.z));}`,
 fragmentShader:`uniform float uTime,uOpacity;varying float vSeed;void main(){float r=length(gl_PointCoord-.5)*2.;float glow=exp(-r*r*4.)*(1.-smoothstep(.72,1.,r));float twinkle=.65+.35*sin(uTime*.8+vSeed*80.);vec3 c=mix(vec3(.44,.59,.67),vec3(.86,.92,1.),step(.84,vSeed));c=mix(c,vec3(.64,.58,.88),step(.975,vSeed));gl_FragColor=vec4(c,glow*(.28+vSeed*.55)*uOpacity*twinkle);}`});
 particles=new THREE.Points(geometry,material);particles.name='Quiet particle field → original brand silhouette';scene.add(particles);disposables.push(geometry,material);
 // A sparse, distant layer maintains depth without coloured fog or scenery.
 const dustGeo=new THREE.BufferGeometry(),dustPos=new Float32Array(700*3);for(let i=0;i<700;i++)dustPos.set([(random()-.5)*25,(random()-.5)*16,-3-random()*9],i*3);dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));const dustMat=new THREE.PointsMaterial({color:'#71909e',size:.013,transparent:true,opacity:.28,depthWrite:false});const dust=new THREE.Points(dustGeo,dustMat);dust.name='Distant dust';scene.add(dust);disposables.push(dustGeo,dustMat);
}
function resize(){
 const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio,w<700?1.5:1.8);renderer.setPixelRatio(dpr);renderer.setSize(w,h);composer.setPixelRatio(dpr);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();particles.material.uniforms.uDpr.value=dpr;
 // Typography is rendered inside the same 3D scene, so glass can refract it.
 const mobile=w<700,z=-1.1,distance=camera.position.z-z,worldH=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*distance,worldW=worldH*camera.aspect;
 const pixelW=mobile?w*.98:w*.65,pixelH=pixelW*810/2048,left=mobile?w*.075:w*.176,top=mobile?h*.15:h*.305;
 heading.scale.set(pixelW/w*worldW,pixelH/h*worldH,1);heading.position.set((left+pixelW/2-w/2)/w*worldW,(h/2-top-pixelH/2)/h*worldH,z);
 state.target=clamp(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight));
}
function draw(dt){
 state.time+=reduced?dt*.18:dt;
 const follow=reduced?1:1-Math.exp(-dt*8.5);state.progress+=(state.target-state.progress)*follow;if(Math.abs(state.progress-state.target)<.00002)state.progress=state.target;
 const p=state.progress,t=state.time,mobile=innerWidth<700;
 const motion=sampleLogoMotion(p,{mobile,reduced,aspect:camera.aspect});
 const {morph,about,intro}=motion;
 root.style.setProperty('--intro',intro.toFixed(4));root.style.setProperty('--about',about.toFixed(4));root.style.setProperty('--progress',p.toFixed(4));
 // Both SVG paths stay rigidly attached to their common, centered pivot.
 // Rotation is driven only by scrolling; pausing never drifts into another pose.
 logo.group.scale.setScalar(motion.scale);
 logo.group.position.set(motion.x,motion.y,motion.z);
 logo.group.rotation.set(motion.pitch,motion.yaw,motion.roll,'YXZ');
 logo.group.visible=motion.glass>.001;
 for(const material of logo.materials){material.transparent=motion.glass<.999;material.opacity=motion.glass;}
 particles.position.copy(logo.group.position);particles.quaternion.copy(logo.group.quaternion);
 particles.scale.setScalar(THREE.MathUtils.lerp(.84,motion.scale,morph));
 particles.material.uniforms.uTime.value=t;particles.material.uniforms.uMorph.value=morph;
 particles.material.uniforms.uOpacity.value=motion.particles;particles.visible=motion.particles>.001;
 heading.material.opacity=about;heading.visible=about>.001;
 copy.setAttribute('aria-hidden',about<.5?'true':'false');document.querySelector('#chapter').textContent=p>.5?'02':'01';
 if(p>.5){navAbout.setAttribute('aria-current','page');navIntro.removeAttribute('aria-current');}else{navIntro.setAttribute('aria-current','page');navAbout.removeAttribute('aria-current');}
 cue.querySelector('span').textContent=p>.94?'BACK TO THE START':'SCROLL TO EXPLORE';cue.setAttribute('aria-label',p>.94?'回到粒子開場':'往下探索關於恒灝創新');
 composer.render();
}
function tick(now){if(!visible)return;const dt=Math.min((now-last)/1000,.05);last=now;draw(dt);raf=requestAnimationFrame(tick);}
async function init(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setClearColor('#05090b',1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;stage.append(renderer.domElement);
 scene=new THREE.Scene();scene.background=new THREE.Color('#030607');camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.05,60);camera.position.set(0,0,9);camera.lookAt(0,0,0);
 environment=makeEnvironment();scene.environment=environment;scene.environmentIntensity=1;
 scene.add(new THREE.AmbientLight('#c9d6f5',.65));const key=new THREE.DirectionalLight('#e5eeff',3.5);key.position.set(-3,5,6);scene.add(key);const rim=new THREE.PointLight('#9c8ce9',12,20,2);rim.position.set(3,-1,2);scene.add(rim);
 logo=await createGlassLogo(THREE,{environment});scene.add(logo.group);
 await Promise.race([Promise.all([document.fonts.load('400 228px "Chakra Petch"'),document.fonts.ready]),new Promise(resolve=>setTimeout(resolve,4500))]);makeHeading();buildParticles();
 composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.28,.52,1.16);composer.addPass(bloom);composer.addPass(new OutputPass());
 resize();addEventListener('resize',resize);if(location.hash==='#about'||new URLSearchParams(location.search).get('view')==='about'){window.scrollTo(0,document.documentElement.scrollHeight-innerHeight);state.target=state.progress=1;}
 draw(0);state.ready=true;document.body.classList.add('is-ready');last=performance.now();raf=requestAnimationFrame(tick);
 document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(visible){last=performance.now();raf=requestAnimationFrame(tick);}else cancelAnimationFrame(raf);});
 window.__INDEX6__={state,scene,camera,logo,particles,heading,renderer,motion:sampleLogoMotion,seek(value){state.progress=state.target=clamp(value);window.scrollTo(0,state.target*(document.documentElement.scrollHeight-innerHeight));draw(0);},render:draw};
}
init().catch(error=>{console.error('Finnovation scene:',error);document.body.classList.add('is-ready','no-webgl');copy.setAttribute('aria-hidden','false');});
addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(raf);logo?.dispose();for(const resource of disposables)resource.dispose?.();pmrem?.dispose();composer?.dispose();renderer?.dispose();},{once:true});
