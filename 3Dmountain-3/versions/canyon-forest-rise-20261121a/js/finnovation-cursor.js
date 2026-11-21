import*as THREE from"three";import{ShaderPass}from"three/addons/postprocessing/ShaderPass.js";import{FullScreenQuad}from"three/addons/postprocessing/Pass.js";export const CURSOR_DEFAULTS=Object.freeze({radius:.052,strength:1,refraction:1,relief:1,persistence:1,curl:1,ripple:1,rippleSpeed:1,vortex:1,specular:1,dispersion:1});export function createFinnovationCursor({renderer,reducedMotion=!1,isBlocked=()=>!1,strength=1,config={}}={}){if(!renderer)throw new Error("createFinnovationCursor requires a renderer");for(const[key,value]of Object.entries(CURSOR_DEFAULTS))config[key]==null&&(config[key]=key==="strength"?strength:value);const control=(key,low,high)=>{const value=Number(config[key]);return Math.min(high,Math.max(low,Number.isFinite(value)?value:CURSOR_DEFAULTS[key]))},media=matchMedia("(hover: hover) and (pointer: fine)"),motion=matchMedia("(prefers-reduced-motion: reduce)"),point=new THREE.Vector2(.5,.5),previous=point.clone(),velocity=new THREE.Vector2,simulationSize=new THREE.Vector2,rippleSize=new THREE.Vector2,clearColor=new THREE.Color;let width=innerWidth,height=innerHeight,aspect=width/height,hasPoint=!1,pending=!1,disposed=!1,dirty=!0,lastMove=0,remaining=0,time=0,headSpeed=0;const eligible=()=>!disposed&&media.matches&&!motion.matches&&!reducedMotion&&!document.hidden&&!isBlocked(),interactive='a,button,input,textarea,select,[contenteditable="true"],dialog[open],[role="button"],.lil-gui',makeTarget=()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:!1,stencilBuffer:!1});let read=makeTarget(),write=makeTarget(),rippleRead=makeTarget(),rippleWrite=makeTarget();const segmentGLSL=`
      float segmentDistance2(vec2 uv,vec2 a,vec2 b,float aspect){
        vec2 A=vec2(a.x*aspect,a.y),B=vec2(b.x*aspect,b.y),Q=vec2(uv.x*aspect,uv.y)-A,AB=B-A;
        float along=clamp(dot(Q,AB)/max(.000001,dot(AB,AB)),0.,1.);
        vec2 d=Q-AB*along;return dot(d,d);
      }`,simulation=new THREE.ShaderMaterial({depthTest:!1,depthWrite:!1,toneMapped:!1,uniforms:{tField:{value:read.texture},uPixel:{value:simulationSize},uPoint:{value:point},uPrevious:{value:previous},uVelocity:{value:velocity},uAspect:{value:aspect},uDelta:{value:1/60},uTime:{value:0},uSplat:{value:0},uRadius:{value:CURSOR_DEFAULTS.radius},uPersistence:{value:CURSOR_DEFAULTS.persistence},uCurl:{value:CURSOR_DEFAULTS.curl},uVortex:{value:CURSOR_DEFAULTS.vortex}},vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`precision highp float;
      varying vec2 vUv;
      uniform sampler2D tField;
      uniform vec2 uPixel,uPoint,uPrevious,uVelocity;
      uniform float uAspect,uDelta,uTime,uSplat,uRadius,uPersistence,uCurl,uVortex;
      ${segmentGLSL}
      // Vorticity (texel units) of the velocity stored in xy.
      float vort(vec2 uv){
        float l=texture2D(tField,uv-vec2(uPixel.x,0.)).y,r=texture2D(tField,uv+vec2(uPixel.x,0.)).y;
        float b=texture2D(tField,uv-vec2(0.,uPixel.y)).x,t=texture2D(tField,uv+vec2(0.,uPixel.y)).x;
        return (r-l)-(t-b);
      }
      void main(){
        vec4 f=texture2D(tField,vUv);
        // Divergence-free curl adds a gentle fold to the moving wake.
        vec2 p=vec2(vUv.x*uAspect,vUv.y)*19.;
        vec2 curl=vec2(sin(p.x+uTime*.37)*cos(p.y-uTime*.21),
          -cos(p.x+uTime*.37)*sin(p.y-uTime*.21));
        vec2 back=clamp(vUv-(f.xy+curl*vec2(.018/uAspect,.018)*f.z*uCurl)*uDelta,0.,1.);
        vec4 next=texture2D(tField,back);
        vec4 n1=texture2D(tField,back+vec2(uPixel.x,0.)),n2=texture2D(tField,back-vec2(uPixel.x,0.));
        vec4 n3=texture2D(tField,back+vec2(0.,uPixel.y)),n4=texture2D(tField,back-vec2(0.,uPixel.y));
        // Far less explicit diffusion than before: the bilinear fetch already
        // blurs; an extra 12 % a frame is what turned the wake into a smear.
        next.xy=mix(next.xy,(n1.xy+n2.xy+n3.xy+n4.xy)*.25,min(.05,uDelta*1.6));
        next.z=mix(next.z,(n1.z+n2.z+n3.z+n4.z)*.25,min(.025,uDelta*.8));
        // Vorticity confinement: pushes the shear back into the eddies the
        // advection keeps trying to dissolve, so the wake curls crisply.
        float w=vort(vUv);
        vec2 g=vec2(abs(vort(vUv+vec2(uPixel.x,0.)))-abs(vort(vUv-vec2(uPixel.x,0.))),
                    abs(vort(vUv+vec2(0.,uPixel.y)))-abs(vort(vUv-vec2(0.,uPixel.y))));
        vec2 N=g/(length(g)+1e-5);
        next.xy+=vec2(N.y,-N.x)*w*uVortex*9.*uDelta*step(.0005,f.z);
        next.xy*=exp(-3.1*uDelta/uPersistence);
        next.z*=exp(-2.8*uDelta/uPersistence);
        float splat=exp(-segmentDistance2(vUv,uPrevious,uPoint,uAspect)/(uRadius*uRadius))*uSplat;
        next.xy+=uVelocity*splat*.28;
        next.xy=clamp(next.xy,vec2(-.28),vec2(.28));
        next.z=min(1.,next.z+splat*.7);
        gl_FragColor=vec4(next.xyz,1.);
      }`}),ripple=new THREE.ShaderMaterial({depthTest:!1,depthWrite:!1,toneMapped:!1,uniforms:{tRipple:{value:rippleRead.texture},uPixel:{value:rippleSize},uPoint:{value:new THREE.Vector2},uPrevious:{value:new THREE.Vector2},uAspect:{value:aspect},uK:{value:.4},uDamp:{value:.985},uSource:{value:0},uRadius:{value:.02}},vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`precision highp float;
      varying vec2 vUv;
      uniform sampler2D tRipple;
      uniform vec2 uPixel,uPoint,uPrevious;
      uniform float uAspect,uK,uDamp,uSource,uRadius;
      ${segmentGLSL}
      void main(){
        vec2 s=texture2D(tRipple,vUv).xy;
        float sum=texture2D(tRipple,vUv+vec2(uPixel.x,0.)).x+texture2D(tRipple,vUv-vec2(uPixel.x,0.)).x
                 +texture2D(tRipple,vUv+vec2(0.,uPixel.y)).x+texture2D(tRipple,vUv-vec2(0.,uPixel.y)).x;
        // Leapfrog wave equation: stable for k \u2264 .5 on this 4-neighbour stencil.
        float h=(2.*s.x-s.y+uK*(sum-4.*s.x))*uDamp;
        // A touch of viscosity: the grid's shortest waves (a 2-texel comb that
        // reads as scratches) die first, the visible rings keep travelling.
        h=mix(h,sum*.25,.07);
        // The stroke presses a trough into the surface; rings run out from it.
        h-=uSource*exp(-segmentDistance2(vUv,uPrevious,uPoint,uAspect)/(uRadius*uRadius));
        gl_FragColor=vec4(clamp(h,-1.,1.),s.x,0.,1.);
      }`}),quad=new FullScreenQuad(simulation),rippleQuad=new FullScreenQuad(ripple),pass=new ShaderPass({uniforms:{tDiffuse:{value:null},tField:{value:null},tRipple:{value:null},uPixel:{value:simulationSize.clone()},uRipplePixel:{value:rippleSize.clone()},uAspect:{value:aspect},uStrength:{value:strength},uRefraction:{value:CURSOR_DEFAULTS.refraction},uRelief:{value:CURSOR_DEFAULTS.relief},uRipple:{value:CURSOR_DEFAULTS.ripple},uSpecular:{value:CURSOR_DEFAULTS.specular},uDispersion:{value:CURSOR_DEFAULTS.dispersion}},vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse,tField,tRipple;
      uniform vec2 uPixel,uRipplePixel;
      uniform float uAspect,uStrength,uRefraction,uRelief,uRipple,uSpecular,uDispersion;
      void main(){
        vec3 field=texture2D(tField,vUv).xyz;
        float left=texture2D(tField,vUv-vec2(uPixel.x,0.)).z;
        float right=texture2D(tField,vUv+vec2(uPixel.x,0.)).z;
        float down=texture2D(tField,vUv-vec2(0.,uPixel.y)).z;
        float up=texture2D(tField,vUv+vec2(0.,uPixel.y)).z;
        vec2 wake=vec2(right-left,up-down);
        // Ripple surface: slope for refraction, curvature for caustics.
        float hc=texture2D(tRipple,vUv).x;
        float hl=texture2D(tRipple,vUv-vec2(uRipplePixel.x,0.)).x,hr=texture2D(tRipple,vUv+vec2(uRipplePixel.x,0.)).x;
        float hd=texture2D(tRipple,vUv-vec2(0.,uRipplePixel.y)).x,hu=texture2D(tRipple,vUv+vec2(0.,uRipplePixel.y)).x;
        vec2 slope=vec2(hr-hl,hu-hd)*uRipple;
        float curvature=(hl+hr+hd+hu-4.*hc)*uRipple;
        vec2 normal=wake+slope*1.6;
        vec2 offset=(wake*vec2(.034/uAspect,.034)+slope*vec2(.030/uAspect,.030)+field.xy*.032)*uStrength*uRefraction;
        // A thin spectral split only where the surface is steep: the edge of a
        // lens, never a rainbow smear across the wake.
        float steep=clamp(length(normal)*5.,0.,1.);
        float split=.16*steep*uDispersion;
        vec3 color;
        color.r=texture2D(tDiffuse,clamp(vUv+offset*(1.+split),vec2(.001),vec2(.999))).r;
        color.g=texture2D(tDiffuse,clamp(vUv+offset,vec2(.001),vec2(.999))).g;
        color.b=texture2D(tDiffuse,clamp(vUv+offset*(1.-split),vec2(.001),vec2(.999))).b;
        float luma=dot(color,vec3(.2126,.7152,.0722));
        // Paired light and shade keep a transparent wake legible on pale water.
        float relief=clamp(dot(normal,normalize(vec2(-.6,.8)))*3.5,-1.,1.);
        color+=vec3(.52,.74,1.)*max(relief,0.)*.20*uStrength*uRelief;
        color*=1.-max(-relief,0.)*mix(.07,.22,smoothstep(.35,.75,luma))*uStrength*uRelief;
        // Soft-box highlight: a studio window up and to the left, reflected by
        // the tilted surface. Measured against the flat surface, so still water
        // gains nothing and only crests and wake shoulders catch it.
        vec3 n=normalize(vec3(-normal*5.,1.));
        vec3 H=normalize(normalize(vec3(-.34,.52,.78))+vec3(0.,0.,1.));
        float spec=max(0.,pow(max(dot(n,H),0.),44.)-pow(H.z,44.));
        color+=vec3(.93,.97,1.)*spec*1.35*uSpecular*uStrength;
        // Converging crests focus light: a faint caustic lift in the troughs' rims.
        color+=vec3(.78,.9,1.)*clamp(-curvature*9.,0.,1.)*.16*uSpecular*uStrength;
        color=mix(color,color*vec3(.983,.993,1.015),min(1.,field.z*.35*uStrength*uRelief));
        gl_FragColor=vec4(color,1.);
      }`});pass.enabled=!1,pass.material.toneMapped=!1;function reset(){hasPoint=!1,pending=!1,remaining=0,velocity.set(0,0),headSpeed=0,pass.enabled=!1,dirty=!0}function move(event){if(event.pointerType!=="mouse"||!eligible()||event.target.closest?.(interactive)){event.pointerType!=="mouse"||!eligible()?reset():hasPoint=!1;return}const now=performance.now(),x=event.clientX/width,y=1-event.clientY/height;if(!hasPoint){point.set(x,y),previous.copy(point),lastMove=now,hasPoint=!0;return}pending||previous.copy(point);const dt=Math.max(1/240,(now-lastMove)/1e3);velocity.set((x-point.x)/dt,(y-point.y)/dt).clampLength(0,1.5);const distance=Math.hypot((x-point.x)*aspect,y-point.y);point.set(x,y),lastMove=now,distance>2e-4&&(pending=!0,remaining=3.2)}function leave(event){event.relatedTarget||reset()}const abort=new AbortController,listen=(target,name,callback,options={})=>target.addEventListener(name,callback,{passive:!0,signal:abort.signal,...options});listen(window,"pointermove",move),listen(document,"pointerout",leave),listen(window,"blur",reset),listen(document,"visibilitychange",reset),listen(document,"pointercancel",reset),listen(document,"pointerdown",event=>{event.pointerType!=="mouse"&&reset()}),listen(media,"change",reset),listen(motion,"change",reset);function resize(w=innerWidth,h=innerHeight){width=Math.max(1,w),height=Math.max(1,h),aspect=width/height;const simH=Math.max(72,Math.min(180,Math.round(height/5))),simW=Math.max(72,Math.min(360,Math.round(simH*aspect)));read.setSize(simW,simH),write.setSize(simW,simH),simulationSize.set(1/simW,1/simH);const rH=Math.max(120,Math.min(340,Math.round(height/2.6))),rW=Math.max(120,Math.min(640,Math.round(rH*aspect)));rippleRead.setSize(rW,rH),rippleWrite.setSize(rW,rH),rippleSize.set(1/rW,1/rH),simulation.uniforms.uAspect.value=aspect,ripple.uniforms.uAspect.value=aspect,pass.uniforms.uAspect.value=aspect,pass.uniforms.uPixel.value.copy(simulationSize),pass.uniforms.uRipplePixel.value.copy(rippleSize),reset()}function update(delta=1/60,elapsed){if(disposed)return;if(!eligible()){reset();return}const effectStrength=control("strength",0,2),persistence=control("persistence",.25,3),radius=control("radius",.008,.16),rippleAmount=control("ripple",0,2);if(simulation.uniforms.uRadius.value=radius,simulation.uniforms.uPersistence.value=persistence,simulation.uniforms.uCurl.value=control("curl",0,3),simulation.uniforms.uVortex.value=control("vortex",0,3),pass.uniforms.uStrength.value=effectStrength,pass.uniforms.uRefraction.value=control("refraction",0,2),pass.uniforms.uRelief.value=control("relief",0,2),pass.uniforms.uRipple.value=rippleAmount,pass.uniforms.uSpecular.value=control("specular",0,2),pass.uniforms.uDispersion.value=control("dispersion",0,2),effectStrength===0){reset();return}if(remaining<=0){pass.enabled=!1;return}const dt=Math.min(.05,Math.max(0,delta));time=Number.isFinite(elapsed)?elapsed:time+dt;const oldTarget=renderer.getRenderTarget(),oldAutoClear=renderer.autoClear,oldAlpha=renderer.getClearAlpha();renderer.getClearColor(clearColor),renderer.autoClear=!1;try{if(dirty){renderer.setClearColor(0,0);for(const target of[read,write,rippleRead,rippleWrite])renderer.setRenderTarget(target),renderer.clear();dirty=!1}const splat=pending?Math.min(1,velocity.length()*1.2+.15):0;simulation.uniforms.tField.value=read.texture,simulation.uniforms.uDelta.value=dt,simulation.uniforms.uTime.value=time,simulation.uniforms.uSplat.value=splat,renderer.setRenderTarget(write),quad.render(renderer);let temp=read;read=write,write=temp;const speed=control("rippleSpeed",.3,1.25),steps=Math.max(1,Math.min(4,Math.round(dt*120)));headSpeed+=(velocity.length()*(pending?1:0)-headSpeed)*Math.min(1,dt*18),ripple.uniforms.uK.value=Math.min(.48,.4*speed*speed),ripple.uniforms.uDamp.value=Math.pow(.978,1/Math.max(.25,persistence)),ripple.uniforms.uRadius.value=radius*.42;const press=pending&&rippleAmount>0?Math.min(.22,.05+headSpeed*.14):0;for(let s=0;s<steps;s++)ripple.uniforms.tRipple.value=rippleRead.texture,ripple.uniforms.uPrevious.value.lerpVectors(previous,point,s/steps),ripple.uniforms.uPoint.value.lerpVectors(previous,point,(s+1)/steps),ripple.uniforms.uSource.value=press*(steps>1?1.6/steps:1),renderer.setRenderTarget(rippleWrite),rippleQuad.render(renderer),temp=rippleRead,rippleRead=rippleWrite,rippleWrite=temp;pass.uniforms.tField.value=read.texture,pass.uniforms.tRipple.value=rippleRead.texture,pass.enabled=!0,pending=!1,previous.copy(point),remaining-=dt/persistence}finally{renderer.setRenderTarget(oldTarget),renderer.setClearColor(clearColor,oldAlpha),renderer.autoClear=oldAutoClear}}return resize(),{pass,update,resize,config,get active(){return pass.enabled},dispose(){disposed||(reset(),disposed=!0,abort.abort(),read.dispose(),write.dispose(),rippleRead.dispose(),rippleWrite.dispose(),simulation.dispose(),ripple.dispose(),quad.dispose(),rippleQuad.dispose(),pass.dispose())}}}