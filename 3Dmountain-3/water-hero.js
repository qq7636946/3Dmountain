import * as THREE from 'three';
import { createDroplet, DROPLET_TRAIL } from './water-droplet.js';

const clamp=THREE.MathUtils.clamp, mix=THREE.MathUtils.lerp;
const smooth=x=>{const a=clamp(x,0,1);return a*a*(3-2*a);};
const range=(x,a,b)=>clamp((x-a)/(b-a),0,1),TAU=Math.PI*2;

export function liquidPose(progress,radius=1.35){
  const p=clamp(progress,0,1),fall=range(p,.20,.48),impact=range(p,.48,.63),merge=range(p,.63,.82),dive=range(p,.82,1);
  let y=mix(3.35,radius,fall*fall),sy=1+Math.sin(fall*Math.PI)*.25;
  if(p>=.48&&p<.63){
    const compression=Math.sin(Math.min(1,impact/.46)*Math.PI)*.66,rebound=Math.sin(range(impact,.35,1)*Math.PI)*.17;
    sy=1-compression+rebound;y=radius*sy;
  }else if(p>=.63){y=mix(radius,-radius*.86,smooth(merge))-dive*radius*1.8;sy=mix(1,.36,smooth(merge));}
  const sx=1/Math.sqrt(Math.max(.25,sy));
  return {y,sx,sy,sz:sx,fall,impact,merge,dive,gather:smooth(range(p,0,.20)),opacity:1-smooth(range(p,.76,.94)),phase:p<.20?'gather':p<.48?'fall':p<.63?'impact':p<.82?'merge':'dive'};
}

export function createWaterHero({scene,camera,renderer,canvas,environment,colourKey=null,emitRipple=()=>{},surfaceAt=()=>0,reducedMotion=false}){
  const R=1.35;
  const controls={radius:R,ior:1.333,roughness:.012,thickness:2.6,surfaceTension:10.5,damping:5.2,loopSpeed:1,wave:.12,touch:1,splash:1};
  const root=new THREE.Group();root.name='living-water-hero';scene.add(root);
  const motion=new THREE.Group();motion.name='liquid-body-motion';root.add(motion);
  const effects=new THREE.Group();effects.name='liquid-surface-effects';root.add(effects);
  // The drop no longer gathers or loops: it is whole from the first frame.
  const state={hovered:false,grabbed:false,phase:'rest',progress:0,intro:0,enabled:false,interactionEnabled:false,impactCount:0,cycle:0,gather:1,ballCount:1,triangles:0,bodyReady:true,ready:true,assetStatus:'loaded',geometrySource:'raymarched-sdf',error:null};
  const uniforms={time:{value:0},touch:{value:new THREE.Vector3(0,0,1)},pressure:{value:0},wobble:{value:0},radius:{value:R},wave:{value:.016}};
  // The splash pieces keep the plain water glass: one dielectric boundary,
  // neutral absorption and no coating.
  const physical={color:0xffffff,metalness:0,roughness:controls.roughness,transmission:1,ior:controls.ior,thickness:controls.thickness,attenuationColor:new THREE.Color(0xffffff),attenuationDistance:Infinity,specularIntensity:1,envMapIntensity:.88,clearcoat:0,transparent:true,side:THREE.FrontSide};
  const mobile=matchMedia('(max-width: 720px)').matches;
  // The drop itself: the Codrops droplet, raymarched, in water colour, with
  // the pointer's trail fused into it (water-droplet.js). It follows the
  // motion group's place, turn and squash, and the touch below shapes it.
  const droplet=createDroplet({radius:R,environment,colourKey,lite:mobile,physical:{roughness:controls.roughness,ior:controls.ior,thickness:controls.thickness}});
  root.add(droplet.mesh);droplet.attach(motion,root);
  // Where the drop's body is, for callers that measure it.
  const body=new THREE.Object3D();body.name='source-water-drop';motion.add(body);
  // Nothing to fetch: the surface is computed, so the loader need not wait.
  const ready=Promise.resolve(true);
  const random=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
  const temp=new THREE.Vector3();

  const touch={offset:new THREE.Vector2(),velocity:new THREE.Vector2(),target:new THREE.Vector2(),anchor:new THREE.Vector2(),direction:new THREE.Vector3(0,0,1),pointerVelocity:new THREE.Vector2(),pointer:new THREE.Vector2(5,5),pressure:0,wobble:0,pointerId:-1,submerged:false,dipTime:0};
  // The demo's trail on the drop's drag plane, in the root's space. It
  // shifts at a fixed 60 Hz, so the tail is the same length on any display.
  const trail={points:Array.from({length:DROPLET_TRAIL},()=>new THREE.Vector3(0,3.35,0)),prev:new THREE.Vector3(),hit:new THREE.Vector3(),amount:0,acc:0,primed:false,touchDown:false,pointerType:'mouse'};
  const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
  const hitPoint=new THREE.Vector3(),sphere=new THREE.Sphere(),worldPoint=new THREE.Vector3(),planeNormal=new THREE.Vector3(),planePoint=new THREE.Vector3();
  let pointerValid=false;
  const interactive=()=>state.enabled&&state.interactionEnabled&&state.progress<.12&&!reducedMotion&&root.visible;
  function ray(){root.updateMatrixWorld(true);camera.updateMatrixWorld(true);raycaster.setFromCamera(touch.pointer,camera);}
  function hitBody(){
    ray();sphere.center.copy(motion.position);root.localToWorld(sphere.center);sphere.radius=R*Math.max(motion.scale.x,motion.scale.y,motion.scale.z);
    return Boolean(raycaster.ray.intersectSphere(sphere,hitPoint));
  }
  function pointOnPlane(target){
    ray();planeNormal.set(0,0,1).transformDirection(root.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(planeNormal,root.localToWorld(planePoint.set(0,3.35,0)));
    if(!raycaster.ray.intersectPlane(plane,target))return false;root.worldToLocal(target);return true;
  }
  function updatePointer(event){
    const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*2-1,y=1-(event.clientY-rect.top)/rect.height*2;
    if(pointerValid)touch.pointerVelocity.add(new THREE.Vector2(x-touch.pointer.x,y-touch.pointer.y).multiplyScalar(.85));
    touch.pointer.set(x,y);pointerValid=event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
    trail.pointerType=event.pointerType||'mouse';
  }
  function pointerMove(event){updatePointer(event);}
  function pointerDown(event){
    if(event.pointerType==='touch')trail.touchDown=true;
    if(event.button!==0||event.target.closest?.('a,button,input,textarea,select,dialog,[data-no-water]'))return;
    updatePointer(event);if(!interactive()||!hitBody())return;
    state.grabbed=true;touch.pointerId=event.pointerId;document.body.classList.add('is-drop-grabbed');
    if(pointOnPlane(worldPoint))touch.anchor.set(worldPoint.x-motion.position.x,worldPoint.y-motion.position.y);
    try{canvas.setPointerCapture(event.pointerId);}catch{}
  }
  function pointerUp(event){
    if(event?.pointerType==='touch')trail.touchDown=false;
    if(!state.grabbed)return;
    if(event?.pointerId!==undefined&&event.pointerId!==touch.pointerId)return;
    state.grabbed=false;touch.target.set(0,0);touch.wobble=Math.max(touch.wobble,.4);document.body.classList.remove('is-drop-grabbed');
    try{if(canvas.hasPointerCapture(touch.pointerId))canvas.releasePointerCapture(touch.pointerId);}catch{}
    touch.pointerId=-1;
  }
  function leave(){pointerValid=false;if(!state.grabbed){state.hovered=false;document.body.classList.remove('is-drop-hovered');}}
  window.addEventListener('pointermove',pointerMove,{passive:true});window.addEventListener('pointerdown',pointerDown,{passive:true});
  window.addEventListener('pointerup',pointerUp,{passive:true});window.addEventListener('pointercancel',pointerUp,{passive:true});
  canvas.addEventListener('pointerleave',leave,{passive:true});
  function updateTouch(dt,time){
    state.hovered=interactive()&&pointerValid&&hitBody();
    document.body.classList.toggle('is-drop-hovered',state.hovered);
    document.body.classList.toggle('is-drop-grabbed',state.grabbed);
    if(state.hovered){motion.worldToLocal(hitPoint);touch.direction.copy(hitPoint).normalize();}
    if(!interactive()&&state.grabbed)pointerUp();
    if(state.grabbed&&pointOnPlane(worldPoint)){
      touch.target.set(worldPoint.x-touch.anchor.x,worldPoint.y-3.35-touch.anchor.y);
      touch.target.x=clamp(touch.target.x,-2.4,2.4);touch.target.y=clamp(touch.target.y,-3.4,2.2);
    }else touch.target.set(0,0);
    if(interactive()&&state.hovered&&!state.grabbed)touch.velocity.addScaledVector(touch.pointerVelocity,dt*18*controls.touch);
    const spring=state.grabbed?68:controls.surfaceTension,drag=state.grabbed?12:controls.damping;
    touch.velocity.x+=((touch.target.x-touch.offset.x)*spring-touch.velocity.x*drag)*dt;
    touch.velocity.y+=((touch.target.y-touch.offset.y)*spring-touch.velocity.y*drag)*dt;
    touch.velocity.clampLength(0,14);touch.offset.addScaledVector(touch.velocity,dt);
    touch.offset.x=clamp(touch.offset.x,-2.7,2.7);touch.offset.y=clamp(touch.offset.y,-3.5,2.5);
    touch.pressure+=((state.hovered||state.grabbed?1:0)-touch.pressure)*(1-Math.exp(-dt*9));
    touch.wobble=Math.max(touch.wobble*Math.exp(-dt*2.9),Math.min(1,touch.velocity.length()*.11));touch.pointerVelocity.multiplyScalar(Math.exp(-dt*15));
    uniforms.touch.value.lerp(touch.direction,1-Math.exp(-dt*16)).normalize();uniforms.pressure.value=touch.pressure*(state.grabbed?1:.55)*controls.touch;uniforms.wobble.value=touch.wobble;uniforms.time.value=time;
  }
  // The trail lives only while the pointer could touch the drop; a finger
  // leaves one only while it is down.
  function updateTrail(dt){
    const T=trail;
    const live=interactive()&&(pointerValid||state.grabbed)&&(T.pointerType!=='touch'||T.touchDown||state.grabbed)&&pointOnPlane(T.hit);
    if(live){
      if(!T.primed){for(const point of T.points)point.copy(T.hit);T.prev.copy(T.hit);T.acc=0;T.primed=true;}
      T.acc+=dt;let ticks=0;
      while(T.acc>=1/60&&ticks<4){T.acc-=1/60;ticks++;}
      if(ticks>=4)T.acc=0;
      for(let tick=1;tick<=ticks;tick++){
        for(let i=T.points.length-1;i>0;i--)T.points[i].copy(T.points[i-1]);
        T.points[0].lerpVectors(T.prev,T.hit,tick/ticks);
      }
      T.points[0].copy(T.hit);T.prev.copy(T.hit);
    }else if(T.amount<.005)T.primed=false;
    const target=live?1:0;
    T.amount+=(target-T.amount)*(1-Math.exp(-dt*(target>T.amount?10:4)));
  }
  // The trail's spheres, tapering along the tail, kept above the water and
  // faded out beyond TRAIL REACH of the drop so a far pointer leaves none.
  function layTrail(surface){
    const look=droplet.look,out=droplet.trail;
    if(trail.amount<=.005||!motion.visible){out.count=0;return;}
    const reach=Math.max(.1,look.trailReach)*R;
    for(let i=0;i<DROPLET_TRAIL;i++){
      const point=trail.points[i],r=R*(.12-.008*i)/.55*Math.max(0,look.trailSize);
      const gate=1-smooth((point.distanceTo(motion.position)-reach*.55)/(reach*.45));
      out.points[i].set(point.x,Math.max(point.y,surface+r),point.z);
      out.radii[i]=r;out.weights[i]=clamp(trail.amount*look.trail*gate,0,2);
    }
    out.count=DROPLET_TRAIL;
  }
  const splashMaterial=new THREE.MeshPhysicalMaterial({...physical,roughness:.04,thickness:.45,depthWrite:false});if(environment)splashMaterial.envMap=environment;
  const splashGeometry=new THREE.SphereGeometry(1,14,10);
  const drops=Array.from({length:mobile?22:38},()=>{
    const mesh=new THREE.Mesh(splashGeometry,splashMaterial);mesh.visible=false;mesh.renderOrder=8;effects.add(mesh);
    return {mesh,velocity:new THREE.Vector3(),age:99,life:1,radius:.06};
  });
  const crownSegments=64,crownLevels=6,crownGeometry=new THREE.BufferGeometry();
  const crownPositions=new Float32Array((crownSegments+1)*crownLevels*3),crownIndices=[];
  for(let row=0;row<crownLevels-1;row++)for(let i=0;i<crownSegments;i++){const a=row*(crownSegments+1)+i,b=a+crownSegments+1;crownIndices.push(a,b,a+1,b,b+1,a+1);}
  crownGeometry.setAttribute('position',new THREE.BufferAttribute(crownPositions,3));crownGeometry.setIndex(crownIndices);
  const crownMaterial=new THREE.MeshPhysicalMaterial({...physical,roughness:.035,thickness:.13,depthWrite:false,side:THREE.DoubleSide});if(environment)crownMaterial.envMap=environment;
  const crown=new THREE.Mesh(crownGeometry,crownMaterial);crown.visible=false;crown.renderOrder=8;crown.frustumCulled=false;effects.add(crown);
  const jetGeometry=new THREE.LatheGeometry([new THREE.Vector2(.32,0),new THREE.Vector2(.23,.14),new THREE.Vector2(.12,.48),new THREE.Vector2(.085,.78),new THREE.Vector2(.12,.93),new THREE.Vector2(.075,1),new THREE.Vector2(0,1.03)],32);
  const jetMaterial=crownMaterial.clone();
  const jet=new THREE.Mesh(jetGeometry,jetMaterial);jet.visible=false;jet.renderOrder=8;effects.add(jet);
  const impactState={age:99,x:0,z:0,strength:0,water:0,jetEmitted:true};
  let lastTime=0;
  function splash(x,z,strength=1){
    strength*=controls.splash;if(strength<=.001)return;
    const water=Number(surfaceAt(x,z,lastTime))||0;
    impactState.age=0;impactState.x=x;impactState.z=z;impactState.water=water;impactState.strength=clamp(strength,.25,1.8);impactState.jetEmitted=false;
    state.impactCount++;emitRipple(x,z,strength*1.35);
    const count=Math.round(drops.length*clamp(strength,.35,1));
    for(let i=0;i<count;i++){
      const particle=drops[i],a=TAU*i/count+random(i+state.impactCount*29)*.22,speed=mix(1.45,4.0,random(i+77))*Math.sqrt(strength),r=mix(.035,.105,Math.pow(random(i+123),1.5));
      particle.mesh.position.set(x+Math.cos(a)*R*.45,water+.08,z+Math.sin(a)*R*.45);
      particle.velocity.set(Math.cos(a)*speed,mix(2.1,4.6,random(i+44))*Math.sqrt(strength),Math.sin(a)*speed);
      particle.radius=r;particle.age=0;particle.life=1.65;particle.mesh.scale.setScalar(r);particle.mesh.visible=true;
    }
  }
  const upAxis=new THREE.Vector3(0,1,0);
  function updateSplash(dt,time){
    const S=impactState;S.age+=dt;const age=S.age;crown.visible=age<.85&&!reducedMotion;
    if(crown.visible){
      crown.position.set(S.x,S.water+.008,S.z);
      const life=clamp(age/.85,0,1),rise=Math.sin(Math.pow(life,.65)*Math.PI),base=R*(.38+life*.88),height=rise*R*.55*S.strength;
      for(let row=0;row<crownLevels;row++){
        const v=row/(crownLevels-1);
        for(let i=0;i<=crownSegments;i++){
          const angle=TAU*i/crownSegments,crest=1+Math.sin(angle*11+.3)*.17+Math.sin(angle*7)*.08,radius=base+v*v*R*.18+Math.sin(v*Math.PI)*R*.035,j=(row*(crownSegments+1)+i)*3;
          crownPositions[j]=Math.cos(angle)*radius;crownPositions[j+1]=height*v*crest;crownPositions[j+2]=Math.sin(angle)*radius;
        }
      }
      crownGeometry.attributes.position.needsUpdate=true;crownGeometry.computeVertexNormals();crownMaterial.opacity=1-smooth(range(age,.50,.85));
    }
    jet.visible=age>.23&&age<1.1&&!reducedMotion;
    if(jet.visible){const t=range(age,.23,1.1),h=Math.sin(t*Math.PI)*R*.8*S.strength;jet.position.set(S.x,S.water,S.z);jet.scale.set(.68+Math.sin(t*Math.PI)*.35,h,.68+Math.sin(t*Math.PI)*.35);jetMaterial.opacity=1-smooth(range(age,.75,1.1));}
    if(age>.4&&!S.jetEmitted){S.jetEmitted=true;emitRipple(S.x,S.z,S.strength*.6);}
    for(const particle of drops){
      if(!particle.mesh.visible)continue;
      particle.age+=dt;particle.velocity.y-=9.81*dt;particle.velocity.x*=Math.exp(-dt*.16);particle.velocity.z*=Math.exp(-dt*.16);particle.mesh.position.addScaledVector(particle.velocity,dt);
      const stretch=clamp(particle.velocity.length()*.11,0,.42),r=particle.radius;particle.mesh.scale.set(r/Math.sqrt(1+stretch),r*(1+stretch),r/Math.sqrt(1+stretch));
      particle.mesh.quaternion.setFromUnitVectors(upAxis,temp.copy(particle.velocity).normalize());
      const y=Number(surfaceAt(particle.mesh.position.x,particle.mesh.position.z,time))||0;
      if(particle.mesh.position.y<y||particle.age>particle.life){if(particle.mesh.position.y<y)emitRipple(particle.mesh.position.x,particle.mesh.position.z,r*2.5);particle.mesh.visible=false;}
    }
  }
  const focus=new THREE.Vector3();
  let previousProgress=0;
  function update({dt=1/60,time=0,progress=0,intro=1,enabled=true,interactionEnabled=true,scrollVelocity=0}={}){
    dt=clamp(dt,0,.04);lastTime=time;
    const p=clamp(progress,0,1);state.enabled=enabled;state.interactionEnabled=interactionEnabled;state.progress=p;state.intro=clamp(intro,0,1);updateTouch(dt,time);updateTrail(dt);
    const pose=liquidPose(p,R),surface=Number(surfaceAt(touch.offset.x,0,time))||0;
    // No rise out of the water and no fade-in: the drop rests where the
    // scroll story starts, and only the scroll and the pointer move it.
    const touchFade=1-smooth(range(p,.05,.32)),residual=Math.sin(time*9.5)*touch.wobble*.055;
    motion.position.set(touch.offset.x*touchFade,surface+pose.y+touch.offset.y*touchFade,0);motion.position.y+=Math.sin(time*.58)*.022*(1-p);
    motion.rotation.set(touch.velocity.y*.007,Math.sin(time*.13)*.04,-touch.velocity.x*.014);
    const velocityStretch=clamp(Math.abs(touch.velocity.y)*.016+Math.abs(scrollVelocity)*.005,0,.14)*(1-p);
    motion.scale.set(pose.sx/Math.sqrt(1+residual+velocityStretch),pose.sy*(1+residual+velocityStretch),pose.sz/Math.sqrt(1+residual+velocityStretch));
    motion.visible=enabled&&pose.opacity>.005;state.phase=state.grabbed?'held':p<.005?'rest':pose.phase;
    let impact=0;if(enabled&&p>=.48&&previousProgress<.48){splash(motion.position.x,0,1+Math.min(.3,Math.abs(scrollVelocity)*.025));impact=1;touch.wobble=.8;}
    const bottom=motion.position.y-R*motion.scale.y;
    if(interactive()&&bottom<surface+.03){
      if(!touch.submerged){splash(motion.position.x,0,.75);touch.submerged=true;touch.dipTime=0;impact=.5;}
      touch.dipTime-=dt;if(touch.dipTime<=0){touch.dipTime=.16;emitRipple(motion.position.x,0,.25+clamp(surface-bottom,0,.8));}
    }else touch.submerged=false;
    updateSplash(dt,time);effects.visible=enabled;
    root.visible=enabled&&(motion.visible||crown.visible||jet.visible||drops.some(particle=>particle.mesh.visible));
    uniforms.wave.value=reducedMotion?0:controls.wave*.133333*(1+touch.wobble*1.5);
    layTrail(surface);
    droplet.frame({dt,time,opacity:pose.opacity,pressure:uniforms.pressure.value,wobble:uniforms.wobble.value,wave:uniforms.wave.value,touch:uniforms.touch.value,visible:motion.visible,reducedMotion});
    focus.copy(motion.position);root.localToWorld(focus);previousProgress=p;
    const envelope=reducedMotion?0:Math.max(impact,clamp(impactState.strength,0,1)*Math.exp(-impactState.age*3.8));
    return {impact:envelope,dive:smooth(range(p,.78,1)),focus};
  }
  // The flow and touch settings, and the droplet's look (see DROPLET_LOOK).
  function configure(options={}){
    for(const key of ['loopSpeed','wave','touch','splash'])if(Number.isFinite(options[key]))controls[key]=clamp(options[key],0,key==='loopSpeed'?3:2);
    droplet.configure(options);
  }
  // The page's mirror pass draws the drop without refraction, see-through.
  function setMirror(on){droplet.setMirror(on);}
  function dispose(){
    state.assetStatus='disposed';document.body.classList.remove('is-drop-hovered','is-drop-grabbed');window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerdown',pointerDown);window.removeEventListener('pointerup',pointerUp);window.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('pointerleave',leave);
    droplet.dispose();
    const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();
  }
  return {root,state,ready,update,dispose,configure,setMirror,controls,body,droplet,splash};
}
