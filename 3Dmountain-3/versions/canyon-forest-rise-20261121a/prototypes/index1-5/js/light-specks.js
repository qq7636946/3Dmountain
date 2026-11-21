import*as THREE from"three";export const LIGHT_SPECK_DEFAULTS=Object.freeze({enabled:1,count:640,size:.92,glow:1.65,opacity:.72,speed:.52,air:.035,height:1,scrollGlow:.75,color:"#7ccaff",rise:1,riseSpeed:1,waterGlow:.9,soft:1}),LIGHT_SPECK_ROWS=[["\u986F\u793A\u6C34\u9762\u6D6E\u5149","lightSpecks","enabled",0,1,1],["\u6D6E\u5149\u6578\u91CF\uFF08\u624B\u6A5F\u81EA\u52D5\u6E1B\u91CF\uFF09","lightSpecks","count",0,2e3,10],["\u5149\u9EDE\u5927\u5C0F","lightSpecks","size",.3,2.4,.01],["\u767C\u5149\u5F37\u5EA6","lightSpecks","glow",0,3,.01],["\u900F\u660E\u5EA6","lightSpecks","opacity",0,1.5,.01],["\u6F02\u6D6E\uFF0F\u9583\u720D\u901F\u5EA6","lightSpecks","speed",0,2,.01],["\u7A7A\u4E2D\u5FAE\u5149\u6BD4\u4F8B","lightSpecks","air",0,.65,.01],["\u6D6E\u5347\u9AD8\u5EA6","lightSpecks","height",.2,2,.01],["\u6C34\u9762\u6D6E\u5347\u5E45\u5EA6","lightSpecks","rise",0,1.8,.01],["\u6D6E\u5347\u5FAA\u74B0\u901F\u5EA6","lightSpecks","riseSpeed",.2,2,.01],["\u6C34\u4E0B\u85CD\u5149\uFF0F\u8D77\u9EDE\u53CD\u5149","lightSpecks","waterGlow",0,1.5,.01],["\u6372\u52D5\u5149\u611F\uFF08\u505C\u4E0B\u67D4\u548C\u6536\u675F\uFF09","lightSpecks","scrollGlow",0,1.5,.01],["\u5149\u9EDE\u67D4\u9806\uFF080 \u539F\u672C\uFF0F1 \u7D72\u6ED1\uFF09","lightSpecks","soft",0,2,.01],["\u6D6E\u5149\u8272\u5F69","lightSpecks","color"]];const VERTEX=`
attribute vec4 aSpeck;
attribute float aLayer;
uniform float uSpeckTime,uSpeckSize,uSpeckSpeed,uAir,uHeight,uMode,uPixel,uRise,uRiseSpeed,uSoft,uCentre;
uniform vec3 uSpeckFlow;
uniform vec4 uSpeckView;
varying float vLight,vAlpha,vFlow,vLayer,vLife,vScale;
varying vec3 vK,vAmp;
/* WATER_FIELD */
void main(){
 float t=uSpeckTime*uSpeckSpeed,r=fract(aSpeck.w*7.137);
 float isAir=step(1.-uAir,fract(aSpeck.w*3.713));
 float life=fract(t*(.13+.13*r)*uRiseSpeed+aSpeck.w+aSpeck.y*.43);
 float born=smoothstep(0.,.10,life),expire=1.-smoothstep(.64,1.,life);
 float depth=5.*pow(24.,aSpeck.z);
 vec3 base;
 if(uMode<.5){base=vec3(aSpeck.x*depth*.70,0.,13.-depth);}
 else {depth=.65*pow(78.,aSpeck.z);base=vec3(aSpeck.x*uSpeckView.x*uSpeckView.y*depth*1.12,0.,-depth);}
 /* WATER_CONTACT */
 vec3 p=base;
 float lift=(.40+2.6*r)*pow(life,.83)*uHeight*uRise;
 if(aLayer<.5){
  p.y+=.045+lift;
  p.x+=sin(life*3.8+aSpeck.w*31.)*(.035+.14*r)*born;
  p.z+=sin(life*2.3+aSpeck.y*16.)*.065*born;
  if(isAir>.5){p.y=1.1+aSpeck.y*12.*uHeight+sin(t*.23+aSpeck.w*31.)*.1;}
 }else{p.y+=.045;}
 vFlow=uSpeckFlow.x;vLayer=aLayer;vLife=life;
 float shimmer=.68+.32*pow(.5+.5*sin(t*(.6+r*.7)+aSpeck.w*53.),2.);
 vLight=shimmer*(.62+.38*fract(aSpeck.w*19.13));
 vec4 mv=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*mv;
 if(uMode<.5)gl_Position.y-=uSpeckView.w*gl_Position.w*(1.-isAir);
 float z=max(.5,-mv.z),perspective=pow(12./z,.22);
 float dia=mix(7.+6.*r*r,35.+34.*r,aLayer)*perspective*uSpeckSize;
 if(aLayer>.5)dia*=.8+.35*smoothstep(0.,.3,life);
 float px=clamp(dia*uPixel,2.*uPixel,92.*uPixel);
 /* Silky: a glint is a band-limited gaussian, never narrower than the pixel grid. A core smaller than a pixel falls between pixels, so it steps and
    flickers as it drifts; held above that it slides smoothly at sub-pixel speeds. Its light is nearly conserved as it widens: a tiny speck reads softer
    and dimmer rather than bigger. On a high-DPR screen the floors are not reached and nothing changes. The sprite grows to hold the tails. */
 float R2=.25*px*px,sft=max(uSoft,.001),sprite=aLayer<.5&&uSoft>.001?max(px,11.):px;
 gl_PointSize=sprite;
 vScale=px/sprite;
 vK=vec3(min(40.,R2/(1.3225*sft*sft)),min(14.,R2/(2.56*sft*sft)),min(5.8,R2/(5.76*sft*sft)));
 vAmp=pow(vK/vec3(40.,14.,5.8),vec3(.8));
 vec2 uv=gl_Position.xy/max(gl_Position.w,.001)*.5+.5;
 float centre=exp(-pow((uv.x-.5)/.24,4.))*exp(-pow((uv.y-.27)/.16,4.));
 float mark=exp(-dot((uv-vec2(.5,.62))/vec2(.18,.22),(uv-vec2(.5,.62))/vec2(.18,.22)));
 vAlpha=(1.-.64*centre*uCentre)*(1.-.38*mark)*(1.-.88*smoothstep(.82,.98,uv.y));
 vAlpha*=smoothstep(.45,1.3,z)*(1.-smoothstep(95.,160.,z))*mix(1.,.3,smoothstep(8.,75.,z));
 vAlpha*=mix(born*expire,1.,isAir);
 if(aLayer>.5)vAlpha*=1.-isAir;
}
`,FRAGMENT=`
uniform vec3 uSpeckColor;
uniform float uSpeckOpacity,uSpeckGlow,uSpeckDisplay,uWaterGlow;
varying float vLight,vAlpha,vFlow,vLayer,vLife,vScale;
varying vec3 vK,vAmp;
vec3 displayRGB(vec3 c){c=clamp(c,0.,1.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){
 vec2 q=gl_PointCoord*2.-1.,p=q/vScale;
 p.y/=mix(1.+.28*vFlow,.17,vLayer);
 float r2=dot(p,p),edge=vLayer<.5?dot(q,q):r2;if(edge>1.)discard;
 vec3 col;
 if(vLayer<.5){
  float core=exp(-r2*vK.x)*vAmp.x,shoulder=exp(-r2*vK.y)*vAmp.y,halo=exp(-r2*vK.z)*vAmp.z;
  col=mix(uSpeckColor,vec3(1.),.68)*core*2.9+uSpeckColor*(shoulder*.7+halo*.32);
 }else{
  float radius=.16+.61*smoothstep(0.,.28,vLife);
  float ring=exp(-pow((sqrt(r2)-radius)/.065,2.))*(1.-smoothstep(.12,.4,vLife));
  float pulse=.55+.45*(1.-smoothstep(.05,.45,vLife));
  col=uSpeckColor*(exp(-r2*13.)*.32+exp(-r2*4.)*.10+ring*.18)*pulse*uWaterGlow;
 }
 col*=uSpeckGlow*vLight*(1.+.26*vFlow);
 if(uSpeckDisplay>.5)col=displayRGB(col);
 float a=vAlpha*uSpeckOpacity*(1.-smoothstep(.62,1.,edge));
 gl_FragColor=vec4(col,a);
}
`,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));export function createLightSpecks({points=null,scene=null,getConfig=()=>null,mode="opening",small=!1,reducedMotion=!1,surface=null}={}){const phoneBudget=small&&!!globalThis.document?.documentElement?.matches?.('[data-look="index1-5"]:not([data-opening-refinement])'),N=phoneBudget?320:small?1e3:2200,layersPerSpeck=phoneBudget?1:2,seeds=new Float32Array(N*layersPerSpeck*4),pos=new Float32Array(N*layersPerSpeck*3),layers=new Float32Array(N*layersPerSpeck);let seed=81673;const random=()=>(seed=seed*16807%2147483647,seed/2147483647);for(let i=0;i<N;i++){const s=[random()*2-1,random(),random(),random()];for(let k=0;k<layersPerSpeck;k++)seeds.set(s,(i*layersPerSpeck+k)*4),layers[i*layersPerSpeck+k]=k}const geometry=new THREE.BufferGeometry;geometry.setAttribute("position",new THREE.BufferAttribute(pos,3)),geometry.setAttribute("aSpeck",new THREE.BufferAttribute(seeds,4)),geometry.setAttribute("aLayer",new THREE.BufferAttribute(layers,1)),geometry.setDrawRange(0,0);const waterRise={value:new THREE.Vector4},waterColor={value:new THREE.Color},uniforms={...surface?.uniforms||{},uTime:{value:0},uOpacity:{value:1},uSize:{value:1},uSpeed:{value:1},uColor:{value:new THREE.Color},uTransition:{value:0},uSoft:{value:1},uCentre:{value:1},uSpeckTime:{value:0},uSpeckSize:{value:1},uSpeckSpeed:{value:1},uAir:{value:.035},uHeight:{value:1},uMode:{value:mode==="lake"?1:0},uPixel:{value:1},uRise:{value:1},uRiseSpeed:{value:1},uWaterGlow:{value:.65},uSpeckView:{value:new THREE.Vector4(.35,1.6,2.5,0)},uSpeckFlow:{value:new THREE.Vector3},uSpeckColor:waterColor,uSpeckOpacity:{value:.72},uSpeckGlow:{value:1.4},uSpeckDisplay:{value:mode==="lake"?1:0}};surface?.material&&(surface.material.uniforms.uWaterRise=waterRise,surface.material.uniforms.uWaterRiseColor=waterColor);const waterContact=surface?.glsl?`
 vec3 wn;vec2 wf;float lost,fold,slope;
 vec3 wd=seaField(base.xz,.08,wn,wf,lost,fold);wd.y=roundCrest(wd.y,slope);
 vec2 local=base.xz-cameraPosition.xz;
 float hem=smoothstep(.9,3.42,length(local))*(1.-smoothstep(.5232,.6632,abs(atan(local.x,-local.y))));
 base+=wd*hem;
 `:"",vertexShader=VERTEX.replace("/* WATER_FIELD */",surface?.glsl||"").replace("/* WATER_CONTACT */",waterContact),material=new THREE.ShaderMaterial({name:"Water-born rising light",vertexShader,fragmentShader:FRAGMENT,uniforms,transparent:!0,depthWrite:!1,depthTest:!0,blending:THREE.AdditiveBlending,toneMapped:!1});points?(points.geometry.dispose(),points.material.dispose(),points.geometry=geometry,points.material=material):(points=new THREE.Points(geometry,material),scene?.add(points)),points.name=mode==="lake"?"lakeLightSpecks":"openingLightSpecks",points.frustumCulled=!1,points.renderOrder=mode==="lake"?22:4;const size=new THREE.Vector2,baseColor=new THREE.Color,settings={...LIGHT_SPECK_DEFAULTS};let lastCount=-1,lastTime=NaN,lastProgress=NaN,flowEnergy=0;points.onBeforeRender=r=>{r.getDrawingBufferSize(size);const target=r.getRenderTarget();uniforms.uPixel.value=(target?Math.min(size.y,target.height):size.y)/Math.max(1,globalThis.innerHeight||900)};function update({time=0,camera=null,width=globalThis.innerWidth||1440,height=globalThis.innerHeight||900,screenDown=0,opacity=1,progress=globalThis.__MONTIS_STUDY__?.journey?.progress||0}={}){const C=Object.assign(settings,LIGHT_SPECK_DEFAULTS,getConfig()),D=globalThis.__SCENE_DAYLIGHT__,elapsed=time-lastTime,delta=progress-lastProgress,dt=Number.isFinite(elapsed)&&elapsed>0?Math.min(elapsed,.08):0,target=!reducedMotion&&dt>0&&elapsed<.2&&Number.isFinite(delta)&&Math.abs(delta)<.45?clamp(Math.abs(delta)/dt*.65,0,1):0;flowEnergy+=(target-flowEnergy)*(1-Math.exp(-dt*(target>flowEnergy?10:5))),(reducedMotion||!Number.isFinite(lastTime)||elapsed>.2)&&(flowEnergy=0),lastTime=time,lastProgress=progress,uniforms.uSpeckFlow.value.set(flowEnergy*clamp(C.scrollGlow,0,1.5),progress,Math.sign(delta)||1);const visible=C.enabled>.5&&C.opacity>0&&opacity>.001,count=phoneBudget&&!visible?0:Math.min(N,Math.round(clamp(C.count,0,2200)*(phoneBudget?.22:small?.48:1)*(mode==="lake"?.8:1)));count!==lastCount&&(geometry.setDrawRange(0,count*layersPerSpeck),lastCount=count),points.visible=visible&&count>0,uniforms.uSpeckTime.value=reducedMotion?0:time,uniforms.uSoft.value=clamp(+C.soft,0,2),uniforms.uCentre.value=Number.isFinite(+C.centre)?clamp(+C.centre,0,1):1,uniforms.uSpeckSize.value=C.size*(mode==="lake"?1.35:1),uniforms.uSpeckSpeed.value=C.speed,uniforms.uAir.value=C.air,uniforms.uHeight.value=C.height,uniforms.uRise.value=clamp(C.rise,0,1.8),uniforms.uRiseSpeed.value=clamp(C.riseSpeed,.2,2),uniforms.uWaterGlow.value=clamp(C.waterGlow,0,1.5),uniforms.uSpeckOpacity.value=C.opacity*opacity*(mode==="lake"?.8:1),uniforms.uSpeckGlow.value=C.glow*(1+(D?.night||0)*.12),baseColor.set(C.color),D?.enabled&&baseColor.lerp(D.sunColor,.04*(1-D.night)),waterColor.value.copy(baseColor),waterRise.value.set(C.enabled>.5?C.waterGlow*C.opacity*opacity:0,reducedMotion?0:time,flowEnergy,1),uniforms.uSpeckView.value.set(Math.tan((camera?.fov||40)*Math.PI/360),width/Math.max(1,height),camera?.position.y||.35,2*screenDown/Math.max(1,height))}function dispose(){points.removeFromParent(),geometry.dispose(),material.dispose(),waterRise.value.x=0}return{points,update,dispose,get state(){return{count:Math.max(0,Math.min(N,lastCount)),phoneBudget,capacity:N,layers:layersPerSpeck,sprites:geometry.drawRange.count,visible:points.visible,flowEnergy,surfaceBound:!!surface?.glsl,rise:uniforms.uRise.value,waterGlow:waterRise.value.x}}}}