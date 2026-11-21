import*as THREE from"three";import{ShaderPass}from"three/addons/postprocessing/ShaderPass.js";export const FORWARD_TRANSITION_DEFAULTS={length:1.12,blur:.48,dispersion:.0035,light:.11,fov:12,zoom:1.75},CANYON_MOTION_DEFAULTS={blur:.26,sensitivity:1.15,response:12,decay:8,dispersion:8e-4};const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{const t=clamp(x);return t*t*(3-2*t)};export function createForwardTransition({config,flowConfig=CANYON_MOTION_DEFAULTS,lite=!1}){const pass=new ShaderPass({defines:{FLIGHT_SAMPLES:lite?10:16},uniforms:{tDiffuse:{value:null},uFocus:{value:new THREE.Vector2(.5,.5)},uStrength:{value:0},uDispersion:{value:0},uLight:{value:0},uAspect:{value:1}},vertexShader:`varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,fragmentShader:`precision highp float;
      uniform sampler2D tDiffuse;
      uniform vec2 uFocus;
      uniform float uStrength, uDispersion, uLight, uAspect;
      varying vec2 vUv;
      vec2 safeUV(vec2 p) { return clamp(p, vec2(.001), vec2(.999)); }
      void main() {
        vec2 ray = vUv - uFocus;
        float radius = length(ray * vec2(uAspect, 1.));
        float edge = smoothstep(.025, .72, radius);
        vec2 travel = ray * uStrength * (.28 + .72 * edge);
        vec3 color = vec3(0.);
        float total = 0.;
        for (int i = 0; i < FLIGHT_SAMPLES; i++) {
          float t = float(i) / float(FLIGHT_SAMPLES - 1);
          float weight = 1. - .65 * t;
          color += texture2D(tDiffuse, safeUV(vUv - travel * t)).rgb * weight;
          total += weight;
        }
        color /= total;
        // Small spectral fringes follow the same optical axis as the motion.
        vec2 middle = vUv - travel * .35;
        vec2 split = ray * uDispersion * edge;
        vec3 base = texture2D(tDiffuse, safeUV(middle)).rgb;
        color.r += (texture2D(tDiffuse, safeUV(middle + split)).r - base.r) * .65;
        color.b += (texture2D(tDiffuse, safeUV(middle - split)).b - base.b) * .65;
        color *= 1. + uLight * (1. - .45 * edge);
        gl_FragColor = vec4(max(color, vec3(0.)), 1.);
      }`});pass.enabled=!1;const state={progress:0,envelope:0,strength:0,direction:1,transitionStrength:0,flowStrength:0,flowMovement:0,flowDirection:1};let movement=0,flowMovement=0;function update({progress,velocity=0,centerX=.5,centerY=.5,mix=0,aspect=1,dt=1/60,reducedMotion=!1,enabled=!0,flowAmount=0,flowVelocity=0,flowCenterX=.5,flowCenterY=.54}){const t=clamp(progress),delta=THREE.MathUtils.clamp(dt,0,.18),speed=smooth(Math.abs(velocity)/1.15);movement+=(speed-movement)*(1-Math.exp(-delta*12));const envelope=smooth((t-.06)/.44)*(1-smooth((t-.7)/.29));Math.abs(velocity)>.015&&(state.direction=Math.sign(velocity)),state.progress=t,state.envelope=envelope;const amplitude=enabled&&!reducedMotion?envelope*movement:0,flowTarget=Math.sign(flowVelocity)*smooth(Math.abs(flowVelocity)*flowConfig.sensitivity),accelerating=Math.abs(flowTarget)>Math.abs(flowMovement)||flowTarget*flowMovement<0,response=Math.max(.01,accelerating?flowConfig.response:flowConfig.decay);flowMovement+=(flowTarget-flowMovement)*(1-Math.exp(-delta*response)),Math.abs(flowMovement)<1e-5&&(flowMovement=0);const flowAmplitude=enabled&&!reducedMotion?clamp(flowAmount)*flowMovement:0;state.transitionStrength=amplitude*config.blur,state.flowStrength=Math.abs(flowAmplitude)*flowConfig.blur,state.flowMovement=Math.abs(flowMovement),Math.abs(flowMovement)>1e-4&&(state.flowDirection=Math.sign(flowMovement));const signedStrength=state.transitionStrength*state.direction+flowAmplitude*flowConfig.blur;state.strength=Math.abs(signedStrength);const dispersion=amplitude*config.dispersion+Math.abs(flowAmplitude)*flowConfig.dispersion;pass.enabled=Math.max(state.strength,dispersion,amplitude*config.light)>2e-4;const u=pass.uniforms,blend=smooth(mix),flowWeight=state.flowStrength/Math.max(1e-6,state.transitionStrength+state.flowStrength),flowX=THREE.MathUtils.clamp(flowCenterX,.15,.85),flowY=THREE.MathUtils.clamp(flowCenterY,.15,.85);u.uFocus.value.set(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.clamp(centerX,.15,.85),flowX,blend),flowX,flowWeight),THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.clamp(centerY,.15,.85),flowY,blend),flowY,flowWeight)),u.uStrength.value=signedStrength,u.uDispersion.value=dispersion,u.uLight.value=amplitude*config.light,u.uAspect.value=aspect}return{pass,state,update,dispose:()=>pass.dispose()}}export const CANYON_DEPTH_MOTION_DEFAULTS={depthBlur:1,shutter:.012,maxStreak:56,wallBlur:.6,specGain:1.4,specThreshold:1.3,specLength:1.9,flowBoost:.55,motes:.7,moteTrail:.55,fovBreath:2.2,pitch:.55,chatter:.06,speedRef:380};const clampSigned=(x,m)=>Math.max(-m,Math.min(m,x));export function createCanyonDepthMotion({config,lite=!1}){const C=()=>({...CANYON_DEPTH_MOTION_DEFAULTS,...config||{}}),MAX_SAMPLES=lite?7:14,SPEC_SAMPLES=lite?0:6,pass=new ShaderPass({defines:{MAX_SAMPLES,SPEC_SAMPLES},uniforms:{tDiffuse:{value:null},tDepth:{value:null},uInvProj:{value:new THREE.Matrix4},uProj:{value:new THREE.Matrix4},uViewToWorld:{value:new THREE.Matrix4},uShift:{value:new THREE.Vector3},uNearFar:{value:new THREE.Vector2(.1,1e3)},uResolution:{value:new THREE.Vector2(1,1)},uMaxPx:{value:48},uWallBlur:{value:.6},uSpec:{value:new THREE.Vector3(1.25,0,1.9)}},vertexShader:`varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,fragmentShader:`precision highp float;
      uniform sampler2D tDiffuse, tDepth;
      uniform mat4 uInvProj, uProj, uViewToWorld;
      uniform vec3 uShift, uSpec;
      uniform vec2 uNearFar, uResolution;
      uniform float uMaxPx, uWallBlur;
      varying vec2 vUv;
      float linearZ(float d) {
        float n = uNearFar.x, f = uNearFar.y;
        return (n * f) / (f - (f - n) * d);
      }
      vec3 viewPos(vec2 uv, float d) {
        vec4 p = uInvProj * vec4(uv * 2. - 1., d * 2. - 1., 1.);
        return p.xyz / p.w;
      }
      vec2 safeUV(vec2 p) { return clamp(p, vec2(.5) / uResolution, 1. - vec2(.5) / uResolution); }
      void main() {
        vec4 src = texture2D(tDiffuse, vUv);
        float d = texture2D(tDepth, vUv).x;
        if (d >= .99999) { gl_FragColor = src; return; }
        vec3 vp = viewPos(vUv, d);
        // Where this point sat when the shutter opened.
        vec3 q = vp + uShift;
        q.z = min(q.z, -uNearFar.x * 1.5);
        vec4 c = uProj * vec4(q, 1.);
        vec2 m = vUv - (c.xy / c.w * .5 + .5);
        // Rock above the waterline keeps a share of its edge: the eye should
        // feel the water rushing, not lose the canyon walls.
        float wy = (uViewToWorld * vec4(vp, 1.)).y;
        m *= mix(1., uWallBlur, smoothstep(1.2, 8., wy));
        float len = length(m * uResolution);
        if (len > uMaxPx) { m *= uMaxPx / len; len = uMaxPx; }
        if (len < .75) { gl_FragColor = src; return; }
        float zc = -vp.z;
        // Interleaved-gradient jitter trades the banding of few taps for fine grain.
        float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) - .5;
        int n = int(clamp(ceil(len / 2.5), 2., float(MAX_SAMPLES)));
        vec3 acc = src.rgb;
        float wsum = 1.;
        for (int i = 0; i < MAX_SAMPLES; i++) {
          if (i >= n) break;
          float t = (float(i) + .5 + jitter) / float(n) - .5;
          vec2 suv = safeUV(vUv + m * t);
          float sd = textureLod(tDepth, suv, 0.).x;
          float zs = sd >= .99999 ? 1e6 : linearZ(sd);
          // Farther scenery only bleeds in where its own (shorter) streak reaches.
          float reach = len * zc / zs;
          float w = zs <= zc * 1.08 ? 1. : clamp(reach / (abs(t) * len + 1.), 0., 1.);
          acc += textureLod(tDiffuse, suv, 0.).rgb * w;
          wsum += w;
        }
        vec3 color = acc / wsum;
      #if SPEC_SAMPLES > 0
        if (uSpec.y > 0.) {
          // Glints on the water are drawn out further along the travel than
          // the surface they ride on: the eye reads them as speed, not blur.
          float water = 1. - smoothstep(.45, 1.6, wy);
          if (water > 0.) {
            vec3 hi = vec3(0.);
            for (int i = 0; i < SPEC_SAMPLES; i++) {
              float t = (float(i) + .5 + jitter) / float(SPEC_SAMPLES) - .5;
              vec3 s = textureLod(tDiffuse, safeUV(vUv + m * t * uSpec.z), 0.).rgb;
              hi += max(s - uSpec.x, 0.);
            }
            float fade = smoothstep(1.5, 10., len);
            color += hi / float(SPEC_SAMPLES) * uSpec.y * water * fade;
          }
        }
      #endif
        gl_FragColor = vec4(color, src.a);
      }`});pass.enabled=!1;const state={speed:0,envelope:0,lean:0,shift:0,maxPx:0,active:!1},velocity=new THREE.Vector3,smoothVelocity=new THREE.Vector3,lastPosition=new THREE.Vector3,shiftWorld=new THREE.Vector3,forward=new THREE.Vector3,size=new THREE.Vector2;let hasLast=!1,depthTexture=null;function setDepth(texture){depthTexture=texture||null}function measure({camera,amount=0,dt=1/60,reducedMotion=!1}){const cfg=C(),delta=THREE.MathUtils.clamp(dt,0,.18),position=camera.position;hasLast&&delta>1e-5?(velocity.copy(position).sub(lastPosition).divideScalar(delta),position.distanceTo(lastPosition)>60&&velocity.set(0,0,0)):velocity.set(0,0,0),lastPosition.copy(position),hasLast=!0;const gate=reducedMotion?0:clamp(amount);velocity.multiplyScalar(gate);const accelerating=velocity.lengthSq()>smoothVelocity.lengthSq(),response=Math.max(.01,accelerating?cfg.response??12:cfg.decay??8);smoothVelocity.lerp(velocity,1-Math.exp(-delta*response)),smoothVelocity.lengthSq()<1e-4&&smoothVelocity.set(0,0,0);const speed=smoothVelocity.length()*(cfg.sensitivity??1.15)/1.15;state.speed=speed,state.envelope=smooth(speed/Math.max(1,cfg.speedRef))*THREE.MathUtils.smoothstep(speed,2,10),camera.getWorldDirection(forward),state.lean=speed>1e-4?clampSigned(smoothVelocity.dot(forward)/Math.max(1,cfg.speedRef),1):0;const knee=THREE.MathUtils.smoothstep(speed,2,10);return shiftWorld.copy(smoothVelocity).multiplyScalar(knee*cfg.shutter*cfg.depthBlur*(cfg.sensitivity??1.15)/1.15),shiftWorld.length()>8&&shiftWorld.setLength(8),state.shift=shiftWorld.length(),state}function apply({camera,renderer}){const cfg=C();if(state.active=!!depthTexture&&state.shift>.001&&cfg.depthBlur>0,pass.enabled=state.active,!state.active)return state;renderer.getDrawingBufferSize(size);const ratio=renderer.getPixelRatio();state.maxPx=cfg.maxStreak*Math.max(.45,size.x/ratio/1440)*ratio,camera.updateMatrixWorld();const u=pass.uniforms;return u.tDepth.value=depthTexture,u.uProj.value.copy(camera.projectionMatrix),u.uInvProj.value.copy(camera.projectionMatrixInverse),u.uViewToWorld.value.copy(camera.matrixWorld),u.uShift.value.copy(shiftWorld).transformDirection(camera.matrixWorldInverse).multiplyScalar(state.shift),u.uNearFar.value.set(camera.near,camera.far),u.uResolution.value.copy(size),u.uMaxPx.value=state.maxPx,u.uWallBlur.value=cfg.wallBlur,u.uSpec.value.set(cfg.specThreshold,lite?0:cfg.specGain*state.envelope,cfg.specLength),state}function warm(renderer){const target=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType}),previous=renderer.getRenderTarget();try{renderer.setRenderTarget(target),pass.fsQuad.render(renderer)}finally{renderer.setRenderTarget(previous),target.dispose()}}let overlay=null;function setOverlay(fn){overlay=fn||null}const renderBlur=pass.render.bind(pass);pass.render=(renderer,writeBuffer,readBuffer,deltaTime,maskActive)=>{if(renderBlur(renderer,writeBuffer,readBuffer,deltaTime,maskActive),!overlay)return;const autoClear=renderer.autoClear;renderer.autoClear=!1,renderer.setRenderTarget(pass.renderToScreen?null:writeBuffer);try{overlay(renderer,pass.uniforms.tDepth.value)}finally{renderer.autoClear=autoClear}};function reset(){hasLast=!1,smoothVelocity.set(0,0,0),shiftWorld.set(0,0,0),state.shift=0,state.envelope=0,state.lean=0}return{pass,state,measure,apply,setDepth,setOverlay,warm,reset,shiftWorld,dispose:()=>pass.dispose()}}export function createCanyonSpeedMotes({curve,widthAt,lite=!1}){const count=lite?48:120,span=64,behind=6,quad=new THREE.InstancedBufferGeometry;quad.setAttribute("corner",new THREE.Float32BufferAttribute([-1,0,1,0,1,1,-1,1],2)),quad.setAttribute("position",new THREE.Float32BufferAttribute(new Array(12).fill(0),3)),quad.setIndex([0,1,2,0,2,3]);const positions=new Float32Array(count*4),seeds=[];let r=1234567;const rand=()=>(r=r*16807%2147483647)/2147483647;for(let i=0;i<count;i++){const h=rand();seeds.push({along:rand()*span,lateral:(rand()*2-1)*.5,height:.12+1.7*h*h*h,size:.55+rand()*.9})}const aPos=new THREE.InstancedBufferAttribute(positions,4);aPos.setUsage(THREE.DynamicDrawUsage),quad.setAttribute("aPos",aPos),quad.instanceCount=count;const material=new THREE.ShaderMaterial({uniforms:{uShift:{value:new THREE.Vector3},uResolution:{value:new THREE.Vector2(1,1)},uOpacity:{value:0},uWidth:{value:1.7},uTrail:{value:.55},uColor:{value:new THREE.Color(.62,.72,.86)},tDepth:{value:null},uNearFar:{value:new THREE.Vector2(.1,1e3)}},vertexShader:`attribute vec2 corner; attribute vec4 aPos;
      uniform vec3 uShift; uniform vec2 uResolution; uniform float uOpacity, uWidth, uTrail;
      varying float vAlpha, vDepth; varying vec2 vCorner;
      void main() {
        vec4 c1 = projectionMatrix * viewMatrix * vec4(aPos.xyz, 1.);
        vec4 c0 = projectionMatrix * viewMatrix * vec4(aPos.xyz + uShift * uTrail, 1.);
        vCorner = corner; vAlpha = 0.; vDepth = c1.w;
        if (c1.w < .6 || c0.w < .6 || uOpacity <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
        vec2 halfRes = .5 * uResolution;
        vec2 s1 = c1.xy / c1.w * halfRes, s0 = c0.xy / c0.w * halfRes;
        vec2 d = s1 - s0; float L = length(d);
        float cap = uResolution.y * .3;
        if (L > cap) { d *= cap / L; s0 = s1 - d; L = cap; }
        vec2 dir = L > .001 ? d / L : vec2(0., 1.);
        float w = uWidth * aPos.w * clamp(8. / c1.w, .6, 3.) * uResolution.y / 900.;
        vec2 nrm = vec2(dir.y, -dir.x); // keeps the quad counter-clockwise
        vec2 p = mix(s0, s1, corner.y) + nrm * corner.x * w + dir * (corner.y * 2. - 1.) * w;
        gl_Position = vec4(p / halfRes * c1.w, c1.z, c1.w);
        float nearFade = smoothstep(.8, 2.4, c1.w), farFade = 1. - smoothstep(34., 58., c1.w);
        vAlpha = uOpacity * nearFade * farFade * clamp(14. * w / (L + 2. * w), .55, 1.);
      }`,fragmentShader:`uniform vec3 uColor; uniform sampler2D tDepth; uniform vec2 uResolution, uNearFar;
      varying float vAlpha, vDepth; varying vec2 vCorner;
      void main() {
        // Drawn after the blur, so the scene depth does the occlusion by hand.
        float d = texture2D(tDepth, gl_FragCoord.xy / uResolution).x;
        float sceneZ = d >= .99999 ? 1e6 : (uNearFar.x * uNearFar.y) / (uNearFar.y - (uNearFar.y - uNearFar.x) * d);
        float across = 1. - vCorner.x * vCorner.x;
        float a = vAlpha * across * across * mix(.12, 1., vCorner.y * vCorner.y)
          * (1. - smoothstep(-.2, .6, vDepth - sceneZ));
        if (a < .002) discard;
        gl_FragColor = vec4(uColor * a, a);
      }`,transparent:!0,depthWrite:!1,depthTest:!1,fog:!1,side:THREE.DoubleSide,premultipliedAlpha:!0}),mesh=new THREE.Mesh(quad,material);mesh.name="canyon-speed-motes",mesh.frustumCulled=!1,mesh.renderOrder=30,mesh.visible=!1;const scene=new THREE.Scene;scene.add(mesh);const pathLength=curve.getLength(),point=new THREE.Vector3,tangent=new THREE.Vector3;function update({arc,shiftWorld,envelope=0,amount=1,gain=1,trail=.55,renderer,reducedMotion=!1}){const opacity=reducedMotion?0:clamp(amount)*envelope*gain;if(material.uniforms.uOpacity.value=opacity,mesh.visible=opacity>.002,!mesh.visible)return;const s=arc*pathLength;for(let i=0;i<count;i++){const seed=seeds[i],a=((seed.along-s)%span+span)%span-behind,u=Math.min(1,Math.max(0,(s+a)/pathLength));curve.getPointAt(u,point),curve.getTangentAt(u,tangent);const hl=Math.hypot(tangent.x,tangent.z)||1,side=widthAt(u)*seed.lateral;positions[i*4]=point.x-tangent.z/hl*side,positions[i*4+1]=seed.height,positions[i*4+2]=point.z+tangent.x/hl*side,positions[i*4+3]=seed.size}aPos.needsUpdate=!0,material.uniforms.uShift.value.copy(shiftWorld),material.uniforms.uTrail.value=trail,renderer.getDrawingBufferSize(material.uniforms.uResolution.value)}function render(renderer,camera,depthTexture){!mesh.visible||!depthTexture||(material.uniforms.tDepth.value=depthTexture,material.uniforms.uNearFar.value.set(camera.near,camera.far),renderer.render(scene,camera))}function warm(renderer,camera){const target=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType}),previous=renderer.getRenderTarget();mesh.visible=!0;try{renderer.setRenderTarget(target),renderer.compile(scene,camera)}finally{mesh.visible=!1,renderer.setRenderTarget(previous),target.dispose()}}return{mesh,scene,update,render,warm,count,dispose:()=>{quad.dispose(),material.dispose()}}}