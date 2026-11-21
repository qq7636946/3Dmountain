import*as THREE from"three";export const OPENING_PORTAL_DEFAULTS={on:1,reveal:.22,start:.52,cut:.88,distance:70,near:200,far:420,plate:235,haze:1,hazeNear:25,hazeFar:260,motionIn:.14,behind:12,portalFix:1,fixSteps:36,fixRefine:7,fixJump:.25,fixFill:2,fixPush:3,portalDebug:0},OPENING_PORTAL_ROWS=[["\u4E00\u93E1\u5230\u5E95 \u958B\u95DC","openingPortal","on",0,1,1],["\u5CFD\u8C37\u53E3 \u51FA\u73FE\uFF08\u4EA4\u63A5\u9032\u5EA6\uFF09","openingPortal","reveal",0,.6,.01],["\u93E1\u982D \u98DB\u5411\u5C71\u53E3\uFF08\u4EA4\u63A5\u9032\u5EA6\uFF09","openingPortal","start",.2,.85,.01],["\u5207\u63DB\u9EDE\uFF08\u4EA4\u63A5\u9032\u5EA6\uFF09","openingPortal","cut",.5,.98,.01],["\u5C71\u53E3 \u8DDD\u96E2\u5B57\u6A19","openingPortal","distance",20,200,1],["\u5C71\u53E3 \u9060\u666F\u677F\u8DDD\u96E2","openingPortal","plate",120,320,1],["\u5C71\u53E3 \u7A7A\u6C23\u900F\u8996","openingPortal","haze",0,1.5,.01],["\u5C71\u53E3 \u9727\u8D77\u9EDE","openingPortal","hazeNear",0,120,1],["\u5C71\u53E3 \u9727\u6EFF","openingPortal","hazeFar",40,400,1],["\u5207\u63DB\u5F8C \u52D5\u614B\u6A21\u7CCA\u6DE1\u5165","openingPortal","motionIn",.02,.4,.01],["\u5361\u7247 \u62CD\u651D\u9EDE\u5F8C\u9000","openingPortal","behind",0,40,.5],["\u5361\u7247 \u4FEE\u88DC\u7834\u6D1E\uFF081\uFF1D\u9010\u50CF\u7D20\u65B0\u7248\u30010\uFF1D\u820A\u7248\u683C\u5B50\u5361\uFF09","openingPortal","portalFix",0,1,1],["\u5361\u7247 \u53D6\u6A23\u6B65\u6578","openingPortal","fixSteps",12,64,1],["\u5361\u7247 \u526A\u5F71\u7CBE\u4FEE\u6B21\u6578","openingPortal","fixRefine",2,9,1],["\u5361\u7247 \u6DF1\u5EA6\u65B7\u5C64\u9580\u6ABB\uFF08\u8DDD\u96E2\u6BD4\u4F8B\uFF09","openingPortal","fixJump",.08,.8,.01],["\u5361\u7247 \u88DC\u6D1E\u67D4\u5316\uFF08mip \u7D1A\uFF09","openingPortal","fixFill",0,5,.1],["\u5361\u7247 \u88DC\u6D1E\u53D6\u8272\u9000\u8B93\uFF08\u683C\uFF09","openingPortal","fixPush",0,12,.5],["\u5361\u7247 \u9664\u932F\u986F\u793A\uFF08\u6D0B\u7D05\uFF1D\u88DC\u51FA\u4F86\u7684\u50CF\u7D20\uFF09","openingPortal","portalDebug",0,2,1]];const clamp01=x=>Math.min(1,Math.max(0,x)),Y=new THREE.Vector3(0,1,0),smooth=x=>{const t=clamp01(x);return t*t*(3-2*t)},VERT=`
  uniform sampler2D uDepth;
  uniform mat4 uProjInv, uCamWorld, uPlace;
  uniform vec2 uStep;
  uniform vec3 uDist; // x near (real geometry), y far (beyond = plate), z plate distance
  varying vec2 vUv;
  varying float vPlate, vStretch, vDist, vCanyonY;
  varying vec3 vWorld;
  vec3 viewAt(vec2 uv){ float d=texture2D(uDepth,uv).r; vec4 v=uProjInv*vec4(uv*2.-1.,d*2.-1.,1.); return v.xyz/v.w; }
  void main(){
    vUv=uv;
    vec3 v=viewAt(uv);
    float len=length(v);
    float plate=step(uDist.y,len);
    vPlate=plate;
    float L=plate>.5?uDist.z:min(len,uDist.x);
    vec3 pv=v/len*L;
    /* a triangle that spans a depth jump (a ridge against the sky) is a rubber sheet seen from anywhere but the bake pose */
    float zx=length(viewAt(uv+vec2(uStep.x,0.))),zy=length(viewAt(uv+vec2(0.,uStep.y)));
    float zx2=length(viewAt(uv-vec2(uStep.x,0.))),zy2=length(viewAt(uv-vec2(0.,uStep.y)));
    float m=max(max(abs(zx-len),abs(zy-len)),max(abs(zx2-len),abs(zy2-len)));
    vStretch=plate>.5?0.:step(.1*min(len,uDist.x)+2.,m);
    vec4 wc=uCamWorld*vec4(v,1.);
    vCanyonY=plate>.5?99.:wc.y;
    vec4 w=uPlace*uCamWorld*vec4(pv,1.);
    vWorld=w.xyz;
    vDist=length(w.xyz-cameraPosition);
    vec4 mv=viewMatrix*w;
    gl_Position=projectionMatrix*mv;
    /* the card's river always wins the depth test against the live lake's crests (depth only; nothing moves on screen) */
    if(vCanyonY<.35){ vec4 c2=projectionMatrix*vec4(mv.xyz*(1.-1.2/max(length(mv.xyz),1.3)),1.); gl_Position.z=c2.z/c2.w*gl_Position.w; }
  }
`,FRAG=`
  uniform sampler2D uColor;
  uniform float uOn,uPlateAlpha,uStretchKeep,uEdge,uHaze,uWater,uBandGain,uDebug;
  uniform vec2 uHazeRange;
  varying vec2 vUv;
  varying float vPlate, vStretch, vDist, vCanyonY;
  varying vec3 vWorld;
  float portalHash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    float n=portalHash(gl_FragCoord.xy);
    float seam=max(step(.01,vStretch),step(.01,vPlate)*step(vPlate,.99));
    float water=1.-smoothstep(.35,1.,vCanyonY);
    if(water>.5&&uWater<=n) discard;
    if(uDebug>.5){ /* review only: stretched (rubber-sheet) triangles magenta, far/plate transitions cyan */
      if(step(.01,vStretch)>.5){ gl_FragColor=vec4(1.,0.,1.,1.); return; }
      if(seam>.5){ gl_FragColor=vec4(0.,1.,1.,1.); return; }
    }
    vec3 dir=normalize(vWorld-cameraPosition);
    vec3 sky=montisVeil(montisEnv(dir,.02,uBandGain,0.),dir);
    float k=uOn*(1.-uHaze*smoothstep(uHazeRange.x,uHazeRange.y,vDist));
    k*=mix(1.,uPlateAlpha,smoothstep(0.,.5,vPlate));
    vec2 e=min(vUv,1.-vUv);
    k*=mix(1.,smoothstep(0.,.12,min(e.x,e.y)),uEdge);
    /* rubber-sheet triangles at ridges: drawn as the sky behind them until the camera is almost at the bake pose */
    k*=mix(1.,uStretchKeep,seam);
    gl_FragColor=vec4(mix(sky,texture2D(uColor,vUv).rgb,clamp(k,0.,1.)),1.);
  }
`,VERT_FIX=`
  varying vec3 vRay;
  void main(){
    gl_Position=vec4(position.xy,0.,1.);
    vec4 p=inverse(projectionMatrix)*vec4(position.xy,1.,1.);
    vRay=(inverse(viewMatrix)*vec4(p.xyz/p.w,1.)).xyz-cameraPosition;
  }
`,FRAG_FIX=`
  uniform sampler2D uColor,uDepth;
  uniform mat4 uWorldToBake,uMeshWorld,uCamWorld;
  uniform vec2 uTan,uTex,uZAB,uHazeRange;
  uniform vec3 uDist;       // x near (real geometry), y far (beyond = plate), z plate distance
  uniform vec4 uFix;        // x steps, y jump, z fill mip, w fill push (texels)
  uniform float uOn,uPlateAlpha,uEdge,uHaze,uWater,uBandGain,uDebug,uRefine;
  uniform mat4 projectionMatrix;
  varying vec3 vRay;
  vec3 fxO,fxD; float fxT0,fxT1,fxW0,fxW1;
  float portalHash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  /* t along the ray for the screen-space fraction s of the clipped segment (1/w is linear in screen space) */
  float fxT(float s){
    float dw=fxW1-fxW0, w=1./mix(1./fxW0,1./fxW1,s);
    return fxT0+(fxT1-fxT0)*(abs(dw)>1e-4?(w-fxW0)/dw:s);
  }
  vec2 fxUv(vec3 P){ float z=max(-P.z,1e-3); return clamp(.5+.5*P.xy/(z*uTan),vec2(3e-4),vec2(.9997)); }
  /* what the bake stored at uv: view depth, true radial distance, and the distance the card puts it at */
  void fxTexel(vec2 uv,out float zs,out float len,out float deff){
    float nd=textureLod(uDepth,uv,0.).r*2.-1.;
    zs=uZAB.y/(nd+uZAB.x);
    vec2 q=(uv*2.-1.)*uTan;
    len=zs*sqrt(1.+dot(q,q));
    deff=len>uDist.y?uDist.z:min(len,uDist.x);
  }
  /* > 0: the ray is behind the baked surface at t */
  float fxProbe(float t,out vec2 uv,out float zs,out float len,out float deff){
    vec3 P=fxO+fxD*t;
    uv=fxUv(P);
    fxTexel(uv,zs,len,deff);
    return length(P)-deff;
  }
  void fxClip(float a0,float a1,inout float t0,inout float t1){
    if(abs(a1)<1e-7){ if(a0<0.) t1=-1.; return; }
    float t=-a0/a1;
    if(a1>0.) t0=max(t0,t); else t1=min(t1,t);
  }
  /* bilinear colour from the four texels around uv that lie at the hit's own depth (no sky fringe on a dark wall) */
  vec3 fxColour(vec2 uv,float zref){
    vec2 st=uv*uTex-.5, f=fract(st); ivec2 i0=ivec2(floor(st)), mx=ivec2(uTex)-1;
    vec3 c=vec3(0.); float ws=0.;
    for(int j=0;j<2;j++) for(int i=0;i<2;i++){
      ivec2 p=clamp(i0+ivec2(i,j),ivec2(0),mx);
      float w=(i==0?1.-f.x:f.x)*(j==0?1.-f.y:f.y);
      float zz=uZAB.y/(texelFetch(uDepth,p,0).r*2.-1.+uZAB.x);
      w*=step(abs(zz-zref),uFix.y*.6*zref+.3);
      c+=w*texelFetch(uColor,p,0).rgb; ws+=w;
    }
    vec3 res=texelFetch(uColor,clamp(ivec2(uv*uTex),ivec2(0),mx),0).rgb;
    if(ws>=1e-3) res=c/ws;
    return res;
  }
  void fxNone(){ if(uDebug>1.5){ gl_FragColor=vec4(0.,.55,.1,1.); gl_FragDepth=1.; return; } discard; }
  void main(){
    vec3 rw=normalize(vRay);
    fxO=(uWorldToBake*vec4(cameraPosition,1.)).xyz;
    fxD=normalize(mat3(uWorldToBake)*rw);
    /* the part of the ray that lies inside the baked frame (and inside the sphere the card's far plate sits on) */
    float t0=0.,t1=1e9;
    fxClip(uTan.x*-fxO.z-fxO.x, uTan.x*-fxD.z-fxD.x, t0,t1);
    fxClip(uTan.x*-fxO.z+fxO.x, uTan.x*-fxD.z+fxD.x, t0,t1);
    fxClip(uTan.y*-fxO.z-fxO.y, uTan.y*-fxD.z-fxD.y, t0,t1);
    fxClip(uTan.y*-fxO.z+fxO.y, uTan.y*-fxD.z+fxD.y, t0,t1);
    fxClip(-fxO.z-.3, -fxD.z, t0,t1);
    float R=uDist.z*1.01, bd=dot(fxO,fxD), disc=bd*bd-(dot(fxO,fxO)-R*R);
    if(disc<0.){ fxNone(); return; }
    t0=max(t0,-bd-sqrt(disc)); t1=min(t1,-bd+sqrt(disc));
    if(t1<=t0+1e-4){ fxNone(); return; }
    vec3 p0=fxO+fxD*t0, p1=fxO+fxD*t1;
    fxT0=t0; fxT1=t1; fxW0=max(-p0.z,1e-3); fxW1=max(-p1.z,1e-3);
    /* coarse walk: the last sample in front of the surface and the first behind it bracket the hit */
    float sLo=0.,sHi=-1.; bool front=false; int N=int(uFix.x);
    for(int k=0;k<=72;k++){
      if(k>N) break;
      float s=float(k)/float(N);
      vec2 uv; float zs,len,de;
      float g=fxProbe(fxT(s),uv,zs,len,de);
      if(g<0.){ front=true; sLo=s; }
      else if(front){ sHi=s; break; }
    }
    if(sHi<0.){ fxNone(); return; }
    for(int i=0;i<10;i++){
      if(float(i)>=uRefine) break;
      float sm=.5*(sLo+sHi);
      vec2 uv; float zs,len,de;
      if(fxProbe(fxT(sm),uv,zs,len,de)<0.) sLo=sm; else sHi=sm;
    }
    vec2 uvA,uvB; float zsA,lenA,deA,zsB,lenB,deB;
    float tB=fxT(sHi);
    fxProbe(fxT(sLo),uvA,zsA,lenA,deA);
    fxProbe(tB,uvB,zsB,lenB,deB);
    bool jump=abs(deA-deB)>uFix.y*min(deA,deB);
    vec2 uvH; float zsH,lenH; vec3 Pb; vec3 col;
    if(!jump){
      /* a real hit on a continuous surface */
      uvH=uvB; zsH=zsB; lenH=lenB; Pb=fxO+fxD*tB;
      col=fxColour(uvB,zsB);
    }else{
      /* the ray slips behind a foreground edge: show the background beside it, taken a little clear of the edge and softened */
      vec2 dv=(uvB-uvA)*uTex; float dl=length(dv);
      uvH=clamp(uvA-(dl>1e-6?dv/dl:vec2(0.))*uFix.w/uTex,vec2(3e-4),vec2(.9997));
      float deH; fxTexel(uvH,zsH,lenH,deH);
      float b2=dot(fxO,fxD), c2=dot(fxO,fxO)-deH*deH;
      Pb=fxO+fxD*max(-b2+sqrt(max(b2*b2-c2,0.)),0.);
      col=textureLod(uColor,uvH,uFix.z).rgb;
    }
    float plate=lenH>uDist.y?1.:0.;
    vec4 wp=uMeshWorld*vec4(Pb,1.);
    float vDist=length(wp.xyz-cameraPosition);
    /* the canyon's own height of the surface this pixel shows: the waterline, per pixel */
    float cy=(uCamWorld*vec4(vec3((uvH*2.-1.)*uTan*zsH,-zsH),1.)).y;
    float water=1.-smoothstep(.35,1.,cy);
    if(water>.5&&uWater<=portalHash(gl_FragCoord.xy)) discard;
    vec3 sky=montisVeil(montisEnv(rw,.02,uBandGain,0.),rw);
    float k=uOn*(1.-uHaze*smoothstep(uHazeRange.x,uHazeRange.y,vDist));
    k*=mix(1.,uPlateAlpha,plate);
    vec2 e=min(uvH,1.-uvH);
    k*=mix(1.,smoothstep(0.,.12,min(e.x,e.y)),uEdge);
    gl_FragColor=vec4(mix(sky,col,clamp(k,0.,1.)),1.);
    if(uDebug>.5&&jump) gl_FragColor=vec4(1.,0.,1.,1.);
    /* depth of the surface; the card's river wins against the live lake's crests, as the grid card did */
    vec3 wq=wp.xyz;
    if(cy<.35){ vec3 m=wq-cameraPosition; wq=cameraPosition+m*(1.-1.2/max(length(m),1.3)); }
    vec4 cl=projectionMatrix*(viewMatrix*vec4(wq,1.));
    gl_FragDepth=clamp(cl.z/cl.w*.5+.5-3e-6,0.,1.);
  }
`;export function createOpeningPortal({renderer,scene,config,envUniforms,veilUniforms,envGlsl,bandGain,sea,seaMaterial,riverUniforms}){const ROOM=["uEnvZenith","uEnvUpper","uEnvField","uEnvHorizon","uEnvLower","uEnvFloor","uEnvInk","uEnvGlow","uEnvCoreDir"],seaU=seaMaterial.uniforms,own={};for(const k of[...ROOM,"uEnvCore","uEnvSunTint","uEnvRangeA","uVeil","uShore"])own[k]={value:seaU[k].value.clone()};own.uShore.value.w=0;let seaOwned=!1;const riverCoreDir=new THREE.Vector3;function seaRoom(r,theta){if(r<=0){if(seaOwned){for(const k of Object.keys(own))seaU[k]=k==="uVeil"?veilUniforms.uVeil:k==="uShore"?riverUniforms.uShore:envUniforms[k];seaU.uRiverSurface.value=0,seaOwned=!1}return}if(!seaOwned){for(const k of Object.keys(own))seaU[k]=own[k];seaOwned=!0}for(const k of ROOM)k!=="uEnvCoreDir"&&own[k].value.lerpVectors(envUniforms[k].value,riverUniforms[k].value,r);riverCoreDir.copy(riverUniforms.uEnvCoreDir.value).applyAxisAngle(Y,theta),own.uEnvCoreDir.value.copy(envUniforms.uEnvCoreDir.value).lerp(riverCoreDir,r).normalize(),own.uEnvCore.value.lerpVectors(envUniforms.uEnvCore.value,riverUniforms.uEnvCore.value,r),own.uEnvSunTint.value.copy(envUniforms.uEnvSunTint.value).multiplyScalar(1-r),own.uEnvRangeA.value.copy(envUniforms.uEnvRangeA.value),own.uEnvRangeA.value.x*=1-r,own.uVeil.value.lerpVectors(veilUniforms.uVeil.value,riverUniforms.uVeil.value,r),own.uShore.value.set(riverUniforms.uShore.value.x,riverUniforms.uShore.value.y,riverUniforms.uShore.value.z,0),seaU.uRiverSurface.value=r}const C=()=>config.openingPortal;let rt=null,gridKey="",mesh=null,geometry=null,quad=null;const uniforms=Object.assign({uDepth:{value:null},uColor:{value:null},uWater:{value:0},uVeilOn:{value:1},uBandGain:bandGain,uProjInv:{value:new THREE.Matrix4},uCamWorld:{value:new THREE.Matrix4},uPlace:{value:new THREE.Matrix4},uStep:{value:new THREE.Vector2},uDist:{value:new THREE.Vector3(200,420,235)},uOn:{value:0},uPlateAlpha:{value:0},uStretchKeep:{value:0},uEdge:{value:1},uHaze:{value:1},uHazeRange:{value:new THREE.Vector2(25,170)},uDebug:{value:0},uWorldToBake:{value:new THREE.Matrix4},uMeshWorld:{value:new THREE.Matrix4},uTan:{value:new THREE.Vector2(1,1)},uTex:{value:new THREE.Vector2(2,2)},uZAB:{value:new THREE.Vector2(-1,-.2)},uFix:{value:new THREE.Vector4(36,.25,2,3)},uRefine:{value:7}},envUniforms,veilUniforms),material=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:envGlsl+FRAG,fog:!1,toneMapped:!1,side:THREE.DoubleSide,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4,uniforms}),fixMaterial=new THREE.ShaderMaterial({vertexShader:VERT_FIX,fragmentShader:envGlsl+FRAG_FIX,fog:!1,toneMapped:!1,side:THREE.DoubleSide,uniforms}),DEBUG_URL=/[?&]portal=debug/.test(location.search),fixOn=()=>C().portalFix>.5,bake={ready:!1,aspect:0,key:"",theta:0,theta0:0,Po:new THREE.Vector3,Qo:new THREE.Quaternion,fov:64,sunDirO:new THREE.Vector3(0,.3,-1).normalize()},state={s:0,flying:!1,riverness:0,motionIn:1,active:!1,h:0},startPos=new THREE.Vector3,startQuat=new THREE.Quaternion,tmpQ=new THREE.Quaternion,yQ=new THREE.Quaternion,fc=new THREE.Vector3,fo=new THREE.Vector3,Pc=new THREE.Vector3,tmp=new THREE.Vector3;let dirty=!0;const compiledV={fix:!1,old:!1},compilingV={fix:!1,old:!1},variant=()=>fixOn()?"fix":"old";function ensureTargets(w,h){if(rt&&rt.width===w&&rt.height===h)return;rt?.dispose();const depth=new THREE.DepthTexture(w,h,THREE.FloatType);depth.minFilter=depth.magFilter=THREE.NearestFilter,rt=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,depthBuffer:!0,depthTexture:depth}),rt.texture.magFilter=THREE.LinearFilter,rt.texture.minFilter=THREE.LinearMipmapLinearFilter,rt.texture.generateMipmaps=!0,uniforms.uDepth.value=depth,uniforms.uColor.value=rt.texture,uniforms.uTex.value.set(w,h)}function ensureGrid(w,h){const gx=Math.max(32,Math.round(w/4)),gy=Math.max(24,Math.round(h/4)),key=gx+"x"+gy;key!==gridKey&&(gridKey=key,geometry?.dispose(),geometry=new THREE.PlaneGeometry(1,1,gx,gy),uniforms.uStep.value.set(1/gx,1/gy),mesh?mesh.geometry=geometry:(mesh=new THREE.Mesh(geometry,material),mesh.name="opening-portal-card",mesh.frustumCulled=!1,mesh.visible=!1,mesh.renderOrder=2,scene.add(mesh)))}function ensureQuad(){quad||(quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),fixMaterial),quad.name="opening-portal-card-raymarch",quad.frustumCulled=!1,quad.visible=!1,quad.renderOrder=2,scene.add(quad))}function notchAzimuth(){const W=config.openingWorld||{},half=(W.rangeWidth??40)*.5*Math.PI/180;return(W.rangeAzimuth??5)*Math.PI/180+Math.atan((2*.296-1)*Math.tan(half))}const WIDE=1.45,bakeCam=new THREE.PerspectiveCamera;function render({canyon,pose}){const t0=performance.now(),dpr=Math.min(renderer.getPixelRatio(),1.25),scale=Math.min(WIDE*.85*dpr,2400/Math.max(1,innerWidth),2400/Math.max(1,innerHeight)),w=Math.max(2,Math.round(innerWidth*scale)),h=Math.max(2,Math.round(innerHeight*scale));ensureTargets(w,h),fixOn()?ensureQuad():ensureGrid(innerWidth*WIDE,innerHeight*WIDE),pose();const cam=canyon.camera;cam.updateMatrixWorld(),cam.updateProjectionMatrix(),bakeCam.copy(cam),bakeCam.fov=2*Math.atan(Math.tan(cam.fov*Math.PI/360)*WIDE)*180/Math.PI,cam.getWorldDirection(fc),fc.y=0,fc.normalize(),bakeCam.position.addScaledVector(fc,-C().behind),bakeCam.updateProjectionMatrix(),bakeCam.updateMatrixWorld();const prev=renderer.getRenderTarget(),auto=renderer.autoClear;renderer.setRenderTarget(rt),renderer.autoClear=!0,renderer.clear(!0,!0,!0),renderer.render(canyon.scene,bakeCam),renderer.setRenderTarget(prev),renderer.autoClear=auto;const U=uniforms;U.uProjInv.value.copy(bakeCam.projectionMatrixInverse),U.uCamWorld.value.copy(bakeCam.matrixWorld),cam.getWorldPosition(Pc),cam.getWorldDirection(fc),fc.y=0,fc.normalize();const az=notchAzimuth();fo.set(Math.sin(az),0,-Math.cos(az));const theta=Math.atan2(fo.x,fo.z)-Math.atan2(fc.x,fc.z),R=new THREE.Matrix4().makeRotationY(theta),camC=config.camera,back=Math.abs(camC.z-config.drop.z)+C().distance;bake.Po.set(camC.x,Pc.y,camC.z).addScaledVector(fo,back),tmp.copy(Pc).applyMatrix4(R),U.uPlace.value.copy(R).setPosition(bake.Po.x-tmp.x,0,bake.Po.z-tmp.z),U.uMeshWorld.value.multiplyMatrices(U.uPlace.value,U.uCamWorld.value),U.uWorldToBake.value.copy(U.uMeshWorld.value).invert();{const pe=bakeCam.projectionMatrix.elements;U.uTan.value.set(1/pe[0],1/pe[5]),U.uZAB.value.set(pe[10],pe[14]),U.uTex.value.set(rt.width,rt.height)}yQ.setFromAxisAngle(Y,theta),bake.theta=theta,bake.theta0=az,bake.Qo.copy(yQ).multiply(cam.getWorldQuaternion(tmpQ)),bake.fov=cam.fov;let sun=null;canyon.scene.traverse(o=>{!sun&&o.isDirectionalLight&&(sun=o)}),sun&&bake.sunDirO.copy(sun.position).sub(sun.target.position).normalize().applyQuaternion(yQ),bake.aspect=innerWidth/Math.max(1,innerHeight),bake.key=keyOf(),dirty=!1,bake.ms=performance.now()-t0,ensureCompiled()}function ensureCompiled(){const v=variant(),node=v==="fix"?quad:mesh;if(!node)return;if(compiledV[v]){bake.ready=!0;return}if(compilingV[v]||!bake.key)return;compilingV[v]=!0;const vis=node.visible;node.visible=!0;const prevT=renderer.getRenderTarget();renderer.setRenderTarget(rt);let job=null;try{job=renderer.compileAsync?renderer.compileAsync(node,bakeCam,scene):(renderer.compile(node,bakeCam,scene),null)}catch{job=null}renderer.setRenderTarget(prevT),node.visible=vis,Promise.resolve(job).catch(()=>{}).then(()=>{compiledV[v]=!0,compilingV[v]=!1,bake.ready=!0})}const keyOf=()=>{const P=C(),W=config.openingWorld||{};return[P.cut,P.distance,P.behind,W.rangeAzimuth,W.rangeWidth,config.camera.z,config.drop.z].join("|")},wanted=()=>C().on>.5&&!compiledPending()&&(dirty||!bake.ready&&!bake.key||bake.key!==keyOf()||Math.abs(bake.aspect-innerWidth/Math.max(1,innerHeight))>.002),compiledPending=()=>!!bake.key&&(compilingV.fix||compilingV.old||!bake.ready),ready=()=>bake.ready&&compiledV[variant()];function mix(handoff,reducedMotion){return!ready()||reducedMotion||C().on<.5?null:handoff>=C().cut?1:0}function update({camera,handoff,reducedMotion}){const P=C(),U=uniforms,fix=fixOn();if(state.h=handoff,bake.key&&(fix?ensureQuad():mesh||ensureGrid(innerWidth*WIDE,innerHeight*WIDE),ensureCompiled()),state.active=ready()&&!reducedMotion&&P.on>.5,!state.active)return state.s=0,state.flying=!1,state.riverness=0,state.motionIn=1,mesh&&(mesh.visible=!1),quad&&(quad.visible=!1),seaRoom(0,0),sea.scale.x=1,sea.rotation.y=0,state;const s=clamp01((handoff-P.start)/Math.max(.02,P.cut-P.start));state.s=s,state.riverness=smooth((s-.25)/.7),state.motionIn=handoff<=P.cut?0:smooth((handoff-P.cut)/Math.max(.01,P.motionIn));const on=smooth((handoff-P.reveal)/Math.max(.02,P.start-P.reveal)),shown=on>.001&&handoff<P.cut+1e-4;if(mesh&&(mesh.visible=shown&&!fix),quad&&(quad.visible=shown&&fix),state.flying=s>0&&handoff<P.cut,s>0){const e=2*s*s-s*s*s,eo=smooth(s/.8);startPos.copy(camera.position),startQuat.copy(camera.quaternion),camera.position.lerpVectors(startPos,bake.Po,e),camera.quaternion.slerpQuaternions(startQuat,bake.Qo,eo),camera.fov=THREE.MathUtils.lerp(camera.fov,bake.fov,eo),camera.updateProjectionMatrix(),camera.updateMatrixWorld()}const r=state.riverness;return seaRoom(handoff<P.cut?r:0,bake.theta),state.flying?(sea.position.set(camera.position.x,-.9*r,camera.position.z),sea.rotation.y=-bake.theta0*r,sea.scale.x=1+.55*r,sea.updateMatrixWorld()):(sea.scale.x=1,sea.rotation.y=0),U.uOn.value=on,U.uPlateAlpha.value=smooth((s-.5)/.45),U.uStretchKeep.value=smooth((s-.8)/.18),U.uWater.value=smooth((s-.93)/.04),U.uEdge.value=1,U.uHaze.value=P.haze*(1-smooth((s-.62)/.34)),U.uHazeRange.value.set(P.hazeNear,P.hazeFar),U.uDist.value.set(P.near,P.far,P.plate),U.uDebug.value=Math.max(P.portalDebug||0,DEBUG_URL?1:0),U.uFix.value.set(Math.round(P.fixSteps*(innerWidth<760?.75:1)),P.fixJump,P.fixFill,P.fixPush),U.uRefine.value=P.fixRefine,state}const api={render,update,mix,fxMix:m=>state.active?smooth(state.s):m,wanted,state,bake,set dirty(v){dirty=!!v},get dirty(){return dirty},get mesh(){return fixOn()?quad:mesh},get uniforms(){return uniforms}};try{window.__OPENING_PORTAL__=api}catch{}return api}