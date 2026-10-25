/* index1-5 · 一鏡到底 Opening → valley in one camera move (2026-10-24, visual director; client 「這些都開始做吧」).
   The 2→3 cross-fade is replaced by a flight: after the wordmark the camera flies on over the lake toward the notch in the
   distant range, and the notch IS the canyon's first frame.
   How: once the valley is ready, the canyon is rendered ONCE from the exact pose its camera will have at the cut (colour +
   float depth). That frame becomes a 2.5-D card in the opening scene — a grid whose vertices sit at their real depth, so it
   has true parallax as the camera approaches — placed so its river lies on the opening sea and its axis runs through the
   range's notch. The opening camera flies onto that pose; at the cut the opening frame already IS the canyon frame, and
   the page swaps scenes on a single frame (journey.mix 0 → 1) with nothing to dissolve. Scroll-driven and reversible
   (everything is a function of the hand-off clock); reduced motion and "not baked yet" keep the old cross-fade.
   Near geometry is real 3-D; far terrain and sky form a back-plate that fades in only over the last part of the flight.
   Cost: one canyon render per bake (load / resize), then one 2.5-D grid draw while flying — cheaper than the dissolve,
   which rendered both scenes for the whole blend. Shipped by build.cjs as js/opening-portal.js.

   2026-10-24 portal fix (backlog A-32; client 「三項大的視覺改動…都處理」): the grid card tore at every depth jump — a
   triangle spanning wall and sky is a rubber sheet, and those cells were painted as the opening's sky, so walls came out
   with stair-step sky holes, bright rock fragments floated in the sky, banks broke and wall feet were saw-toothed.
   portalFix 1 (default) replaces the grid by a full-screen RAY-MARCH of the very same baked colour + depth: every pixel
   walks its own ray through the bake image (perspective-correct steps, binary refinement to sub-texel), so silhouettes are
   exact per pixel, the waterline is per pixel, and where a ray passes behind a foreground edge (the disocclusion the
   grid used to tear open) it is filled with the background beside that edge (a soft mip of it), never with sky.
   portalFix 0 = the previous grid card, unchanged (plus an optional debug view). ?portal=debug paints the synthesised
   pixels magenta (old: stretched triangles; new: filled disocclusions) and exposes window.__OPENING_PORTAL__. */
import * as THREE from 'three';

export const OPENING_PORTAL_DEFAULTS = {
  on: 1,
  reveal: .22,      // hand-off where the card begins to appear (behind the letters)
  start: .52,       // hand-off where the camera leaves the letters' dolly and heads for the notch
  cut: .88,         // hand-off of the cut: the opening frame equals the canyon frame here
  distance: 70,     // how far beyond the wordmark the canyon mouth opens (world units)
  near: 200,        // card geometry is real out to this distance from the cut pose …
  far: 420,         // … anything farther (distant peaks, sky) becomes the back-plate …
  plate: 235,       // … drawn at this distance, fading in over the last part of the flight
  haze: 1, hazeNear: 25, hazeFar: 260,
  motionIn: .14,    // after the cut the valley's speed blur / lean ease in over this much hand-off
  behind: 12,       // the card is shot from this far behind the cut pose
  /* 2026-10-24 portal fix */
  portalFix: 1,     // 1 = per-pixel ray-march card (no holes / stair steps), 0 = the previous grid card
  fixSteps: 36,     // ray-march samples per pixel (before the binary refinement); phones use fewer
  fixRefine: 7,     // binary refinement iterations (sub-texel silhouettes)
  fixJump: .25,     // a depth step bigger than this fraction of the distance is a silhouette, not a slope
  fixFill: 2,       // how soft (mip level) the background that fills a disocclusion is
  fixPush: 3,       // the fill is taken this many texels away from the silhouette (clear of its fringe)
  portalDebug: 0    // 1 = synthesised pixels in magenta (also ?portal=debug), 2 = also paint "no card here" green
};

export const OPENING_PORTAL_ROWS = [
  ['一鏡到底 開關', 'openingPortal', 'on', 0, 1, 1],
  ['峽谷口 出現（交接進度）', 'openingPortal', 'reveal', 0, .6, .01],
  ['鏡頭 飛向山口（交接進度）', 'openingPortal', 'start', .2, .85, .01],
  ['切換點（交接進度）', 'openingPortal', 'cut', .5, .98, .01],
  ['山口 距離字標', 'openingPortal', 'distance', 20, 200, 1],
  ['山口 遠景板距離', 'openingPortal', 'plate', 120, 320, 1],
  ['山口 空氣透視', 'openingPortal', 'haze', 0, 1.5, .01],
  ['山口 霧起點', 'openingPortal', 'hazeNear', 0, 120, 1], ['山口 霧滿', 'openingPortal', 'hazeFar', 40, 400, 1],
  ['切換後 動態模糊淡入', 'openingPortal', 'motionIn', .02, .4, .01], ['卡片 拍攝點後退', 'openingPortal', 'behind', 0, 40, .5],
  ['卡片 修補破洞（1＝逐像素新版、0＝舊版格子卡）', 'openingPortal', 'portalFix', 0, 1, 1],
  ['卡片 取樣步數', 'openingPortal', 'fixSteps', 12, 64, 1], ['卡片 剪影精修次數', 'openingPortal', 'fixRefine', 2, 9, 1],
  ['卡片 深度斷層門檻（距離比例）', 'openingPortal', 'fixJump', .08, .8, .01],
  ['卡片 補洞柔化（mip 級）', 'openingPortal', 'fixFill', 0, 5, .1], ['卡片 補洞取色退讓（格）', 'openingPortal', 'fixPush', 0, 12, .5],
  ['卡片 除錯顯示（洋紅＝補出來的像素）', 'openingPortal', 'portalDebug', 0, 2, 1]
];

const clamp01 = x => Math.min(1, Math.max(0, x));
const Y = new THREE.Vector3(0, 1, 0);
const smooth = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };

const VERT = /* glsl */`
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
`;
/* The card never cuts a hole in the sky: where it is hazy, far, not yet revealed or at its edges it shows exactly what the
   opening's backdrop would (the same montisEnv + veil), so it dissolves into the real sky and range behind it. */
const FRAG = /* glsl */`
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
`;

/* ---------------------------------------------------------------------------------------------------------------------
   portalFix 1: the card as a per-pixel ray-march (a full-screen triangle pair, no grid).
   Every pixel casts its ray, expresses it in the bake camera's space and walks it through the baked depth image: the walk
   is uniform in IMAGE space (perspective-correct, so a texel is never skipped far from the bake pose), the first sample
   where the ray is behind the surface (radial distance beyond the stored one) brackets the hit, and a binary search narrows
   the bracket to a fraction of a texel — silhouettes and the waterline are per pixel, not per 4-px cell.
   Where the bracket sits on a DEPTH JUMP (the ray slips behind a foreground edge: the disocclusion the grid tore open) it is
   not a hit: the pixel takes the background right beside that edge (a soft mip of it, a few texels clear of the fringe).
   Pixels whose ray never meets the card (it leaves the baked frame in front of everything, or starts behind a surface) are
   discarded, so the real backdrop and sea show. Hit colours are bilateral-filtered (only texels at the hit's own depth), so
   a dark wall gets no pale sky fringe. Depth is written per pixel, with the river's priority over the live lake kept. */
const VERT_FIX = /* glsl */`
  varying vec3 vRay;
  void main(){
    gl_Position=vec4(position.xy,0.,1.);
    vec4 p=inverse(projectionMatrix)*vec4(position.xy,1.,1.);
    vRay=(inverse(viewMatrix)*vec4(p.xyz/p.w,1.)).xyz-cameraPosition;
  }
`;
const FRAG_FIX = /* glsl */`
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
`;

export function createOpeningPortal({ renderer, scene, config, envUniforms, veilUniforms, envGlsl, bandGain, sea, seaMaterial, riverUniforms }) {
  /* The lake becomes the river on the way in: the opening sea gets its own copies of the room it mirrors and slides them
     onto the river's room (and the river's shading path, short of the bank effects that need the river's own mesh), so
     the floor the card cannot cover — between the camera and the bake pose — is already the canyon's water. */
  const ROOM = ['uEnvZenith', 'uEnvUpper', 'uEnvField', 'uEnvHorizon', 'uEnvLower', 'uEnvFloor', 'uEnvInk', 'uEnvGlow', 'uEnvCoreDir'];
  const seaU = seaMaterial.uniforms, own = {};
  for (const k of [...ROOM, 'uEnvCore', 'uEnvSunTint', 'uEnvRangeA', 'uVeil', 'uShore']) { own[k] = { value: seaU[k].value.clone() }; }
  own.uShore.value.w = 0;
  let seaOwned = false;
  const riverCoreDir = new THREE.Vector3();
  function seaRoom(r, theta) {
    if (r <= 0) { if (seaOwned) { for (const k of Object.keys(own)) seaU[k] = k === 'uVeil' ? veilUniforms.uVeil : k === 'uShore' ? riverUniforms.uShore : envUniforms[k]; seaU.uRiverSurface.value = 0; seaOwned = false; } return; }
    if (!seaOwned) { for (const k of Object.keys(own)) seaU[k] = own[k]; seaOwned = true; }
    for (const k of ROOM) if (k !== 'uEnvCoreDir') own[k].value.lerpVectors(envUniforms[k].value, riverUniforms[k].value, r);
    riverCoreDir.copy(riverUniforms.uEnvCoreDir.value).applyAxisAngle(Y, theta);
    own.uEnvCoreDir.value.copy(envUniforms.uEnvCoreDir.value).lerp(riverCoreDir, r).normalize();
    own.uEnvCore.value.lerpVectors(envUniforms.uEnvCore.value, riverUniforms.uEnvCore.value, r);
    own.uEnvSunTint.value.copy(envUniforms.uEnvSunTint.value).multiplyScalar(1 - r);
    own.uEnvRangeA.value.copy(envUniforms.uEnvRangeA.value); own.uEnvRangeA.value.x *= 1 - r;
    own.uVeil.value.lerpVectors(veilUniforms.uVeil.value, riverUniforms.uVeil.value, r);
    own.uShore.value.set(riverUniforms.uShore.value.x, riverUniforms.uShore.value.y, riverUniforms.uShore.value.z, 0);
    seaU.uRiverSurface.value = r;
  }
  const C = () => config.openingPortal;
  let rt = null, gridKey = '', mesh = null, geometry = null, quad = null;
  /* one uniform set for both cards (the grid card of portalFix 0 and the ray-march card of portalFix 1), so the bake and the
     per-frame fade write it once */
  const uniforms = Object.assign({
    uDepth: { value: null }, uColor: { value: null }, uWater: { value: 0 }, uVeilOn: { value: 1 }, uBandGain: bandGain,
    uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uPlace: { value: new THREE.Matrix4() },
    uStep: { value: new THREE.Vector2() }, uDist: { value: new THREE.Vector3(200, 420, 235) },
    uOn: { value: 0 }, uPlateAlpha: { value: 0 }, uStretchKeep: { value: 0 }, uEdge: { value: 1 }, uHaze: { value: 1 },
    uHazeRange: { value: new THREE.Vector2(25, 170) }, uDebug: { value: 0 },
    /* ray-march card */
    uWorldToBake: { value: new THREE.Matrix4() }, uMeshWorld: { value: new THREE.Matrix4() },
    uTan: { value: new THREE.Vector2(1, 1) }, uTex: { value: new THREE.Vector2(2, 2) }, uZAB: { value: new THREE.Vector2(-1, -.2) },
    uFix: { value: new THREE.Vector4(36, .25, 2, 3) }, uRefine: { value: 7 }
  }, envUniforms, veilUniforms);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: envGlsl + FRAG, fog: false, toneMapped: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, uniforms
  });
  const fixMaterial = new THREE.ShaderMaterial({
    vertexShader: VERT_FIX, fragmentShader: envGlsl + FRAG_FIX, fog: false, toneMapped: false, side: THREE.DoubleSide, uniforms
  });
  const DEBUG_URL = /[?&]portal=debug/.test(location.search);
  const fixOn = () => C().portalFix > .5;
  const bake = { ready: false, aspect: 0, key: '', theta: 0, theta0: 0, Po: new THREE.Vector3(), Qo: new THREE.Quaternion(), fov: 64, sunDirO: new THREE.Vector3(0, .3, -1).normalize() };
  const state = { s: 0, flying: false, riverness: 0, motionIn: 1, active: false, h: 0 };
  const startPos = new THREE.Vector3(), startQuat = new THREE.Quaternion(), tmpQ = new THREE.Quaternion(), yQ = new THREE.Quaternion();
  const fc = new THREE.Vector3(), fo = new THREE.Vector3(), Pc = new THREE.Vector3(), tmp = new THREE.Vector3();
  let dirty = true;
  const compiledV = { fix: false, old: false }, compilingV = { fix: false, old: false };
  const variant = () => fixOn() ? 'fix' : 'old';

  function ensureTargets(w, h) {
    if (rt && rt.width === w && rt.height === h) return;
    rt?.dispose();
    const depth = new THREE.DepthTexture(w, h, THREE.FloatType);
    depth.minFilter = depth.magFilter = THREE.NearestFilter;
    rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, depthTexture: depth });
    /* mipmaps: the ray-march card fills a disocclusion from a soft level of the background beside the edge */
    rt.texture.magFilter = THREE.LinearFilter; rt.texture.minFilter = THREE.LinearMipmapLinearFilter; rt.texture.generateMipmaps = true;
    uniforms.uDepth.value = depth; uniforms.uColor.value = rt.texture; uniforms.uTex.value.set(w, h);
  }
  function ensureGrid(w, h) {
    const gx = Math.max(32, Math.round(w / 4)), gy = Math.max(24, Math.round(h / 4)), key = gx + 'x' + gy;
    if (key === gridKey) return;
    gridKey = key;
    geometry?.dispose();
    geometry = new THREE.PlaneGeometry(1, 1, gx, gy);
    uniforms.uStep.value.set(1 / gx, 1 / gy);
    if (!mesh) { mesh = new THREE.Mesh(geometry, material); mesh.name = 'opening-portal-card'; mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2; scene.add(mesh); }
    else mesh.geometry = geometry;
  }
  function ensureQuad() {
    if (quad) return;
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fixMaterial);
    quad.name = 'opening-portal-card-raymarch'; quad.frustumCulled = false; quad.visible = false; quad.renderOrder = 2; scene.add(quad);
  }
  /* Where the range's notch lies, seen from the hero camera (the V between the left massif and the big peak in the band). */
  function notchAzimuth() {
    const W = config.openingWorld || {}, half = (W.rangeWidth ?? 40) * .5 * Math.PI / 180, u = .296;
    return (W.rangeAzimuth ?? 5) * Math.PI / 180 + Math.atan((2 * u - 1) * Math.tan(half));
  }
  /* canyon: the journey scene. pose(): puts canyon.camera (and the river) where they will be at the cut. */
  /* The card is baked WIDER than the frame (WIDE x the field of view): until the very cut the camera is still a little
     behind the bake pose and sees past the frame's own edges; at the cut the frame is the card's middle. */
  const WIDE = 1.45, bakeCam = new THREE.PerspectiveCamera();
  function render({ canyon, pose }) {
    const t0 = performance.now();
    const dpr = Math.min(renderer.getPixelRatio(), 1.25);
    const scale = Math.min(WIDE * .85 * dpr, 2400 / Math.max(1, innerWidth), 2400 / Math.max(1, innerHeight));
    const w = Math.max(2, Math.round(innerWidth * scale)), h = Math.max(2, Math.round(innerHeight * scale));
    ensureTargets(w, h);
    if (fixOn()) ensureQuad(); else ensureGrid(innerWidth * WIDE, innerHeight * WIDE);
    pose();
    const cam = canyon.camera;
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    bakeCam.copy(cam);
    bakeCam.fov = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * WIDE) * 180 / Math.PI;
    /* … and from a little BEHIND the cut pose: the card is real 2.5-D, so it stays right as the camera closes those last
       metres, and the water under the approaching camera is already in it (nothing of the lake shows at the cut) */
    cam.getWorldDirection(fc); fc.y = 0; fc.normalize();
    bakeCam.position.addScaledVector(fc, -C().behind);
    bakeCam.updateProjectionMatrix(); bakeCam.updateMatrixWorld();
    const prev = renderer.getRenderTarget(), auto = renderer.autoClear;
    renderer.setRenderTarget(rt); renderer.autoClear = true; renderer.clear(true, true, true);
    renderer.render(canyon.scene, bakeCam);
    renderer.setRenderTarget(prev); renderer.autoClear = auto;
    const U = uniforms;
    U.uProjInv.value.copy(bakeCam.projectionMatrixInverse); U.uCamWorld.value.copy(bakeCam.matrixWorld);
    /* place: yaw the canyon so its cut axis runs through the notch, and slide it so its camera lands beyond the wordmark;
       the river (y 0 in the canyon) stays on the opening sea (y 0) */
    cam.getWorldPosition(Pc); cam.getWorldDirection(fc); fc.y = 0; fc.normalize();
    const az = notchAzimuth(); fo.set(Math.sin(az), 0, -Math.cos(az));
    const theta = Math.atan2(fo.x, fo.z) - Math.atan2(fc.x, fc.z);
    const R = new THREE.Matrix4().makeRotationY(theta);
    const camC = config.camera, back = Math.abs(camC.z - config.drop.z) + C().distance;
    bake.Po.set(camC.x, Pc.y, camC.z).addScaledVector(fo, back);
    tmp.copy(Pc).applyMatrix4(R);
    U.uPlace.value.copy(R).setPosition(bake.Po.x - tmp.x, 0, bake.Po.z - tmp.z);
    /* the ray-march card works in the bake camera's own space: world <-> bake view, the frame's tangents, the depth mapping */
    U.uMeshWorld.value.multiplyMatrices(U.uPlace.value, U.uCamWorld.value); U.uWorldToBake.value.copy(U.uMeshWorld.value).invert();
    { const pe = bakeCam.projectionMatrix.elements; U.uTan.value.set(1 / pe[0], 1 / pe[5]); U.uZAB.value.set(pe[10], pe[14]); U.uTex.value.set(rt.width, rt.height); }
    yQ.setFromAxisAngle(Y, theta); bake.theta = theta; bake.theta0 = az;
    bake.Qo.copy(yQ).multiply(cam.getWorldQuaternion(tmpQ));
    bake.fov = cam.fov;
    let sun = null; canyon.scene.traverse(o => { if (!sun && o.isDirectionalLight) sun = o; });
    if (sun) bake.sunDirO.copy(sun.position).sub(sun.target.position).normalize().applyQuaternion(yQ);
    /* compile the card's program now (for a render-target pass, as the composer will draw it), not on its first visible frame */
    bake.aspect = innerWidth / Math.max(1, innerHeight); bake.key = keyOf(); dirty = false;
    bake.ms = performance.now() - t0;
    /* compile the card's program off the critical path (parallel compile where the GPU driver has it), for a render-target
       pass as the composer will draw it; until it is ready the page keeps its old cross-fade */
    ensureCompiled();
  }
  /* compile the program of the card that is in use (both are kept apart: flipping portalFix compiles the other one once) */
  function ensureCompiled() {
    const v = variant(), node = v === 'fix' ? quad : mesh;
    if (!node) return;
    if (compiledV[v]) { bake.ready = true; return; }
    if (compilingV[v] || !bake.key) return;
    compilingV[v] = true;
    const vis = node.visible; node.visible = true; const prevT = renderer.getRenderTarget(); renderer.setRenderTarget(rt);
    let job = null;
    try { job = renderer.compileAsync ? renderer.compileAsync(node, bakeCam, scene) : (renderer.compile(node, bakeCam, scene), null); } catch (e) { job = null; }
    renderer.setRenderTarget(prevT); node.visible = vis;
    Promise.resolve(job).catch(() => {}).then(() => { compiledV[v] = true; compilingV[v] = false; bake.ready = true; });
  }
  const keyOf = () => { const P = C(), W = config.openingWorld || {}; return [P.cut, P.distance, P.behind, W.rangeAzimuth, W.rangeWidth, config.camera.z, config.drop.z].join('|'); };
  const wanted = () => C().on > .5 && !(compiledPending()) && (dirty || (!bake.ready && !bake.key) || bake.key !== keyOf() || Math.abs(bake.aspect - innerWidth / Math.max(1, innerHeight)) > .002);
  const compiledPending = () => !!bake.key && (compilingV.fix || compilingV.old || !bake.ready);
  const ready = () => bake.ready && compiledV[variant()];

  /* null = use the page's own cross-fade */
  function mix(handoff, reducedMotion) {
    if (!ready() || reducedMotion || C().on < .5) return null;
    return handoff >= C().cut ? 1 : 0;
  }
  /* After updateJourneyCamera(): the opening camera, flown onto the cut pose. */
  function update({ camera, handoff, reducedMotion }) {
    const P = C(), U = uniforms, fix = fixOn();
    state.h = handoff;
    /* the card in use: portalFix 1 the ray-march quad, 0 the grid (made on demand when the dial is flipped) */
    if (bake.key) { if (fix) ensureQuad(); else if (!mesh) ensureGrid(innerWidth * WIDE, innerHeight * WIDE); ensureCompiled(); }
    state.active = ready() && !reducedMotion && P.on > .5;
    if (!state.active) { state.s = 0; state.flying = false; state.riverness = 0; state.motionIn = 1; if (mesh) mesh.visible = false; if (quad) quad.visible = false; seaRoom(0, 0); sea.scale.x = 1; sea.rotation.y = 0; return state; }
    const s = clamp01((handoff - P.start) / Math.max(.02, P.cut - P.start));
    state.s = s;
    state.riverness = smooth((s - .25) / .7);
    state.motionIn = handoff <= P.cut ? 0 : smooth((handoff - P.cut) / Math.max(.01, P.motionIn));
    const on = smooth((handoff - P.reveal) / Math.max(.02, P.start - P.reveal));
    const shown = on > .001 && handoff < P.cut + .0001;
    if (mesh) mesh.visible = shown && !fix;
    if (quad) quad.visible = shown && fix;
    state.flying = s > 0 && handoff < P.cut;
    if (s > 0) {
      /* from wherever the letters' dolly has the camera, onto the cut pose: zero speed at the start, the canyon's own speed
         at the cut (the ease 2s² − s³ ends with slope 1 over a stretch of ≈ distance) */
      const e = 2 * s * s - s * s * s, eo = smooth(s / .8);
      startPos.copy(camera.position); startQuat.copy(camera.quaternion);
      camera.position.lerpVectors(startPos, bake.Po, e);
      camera.quaternion.slerpQuaternions(startQuat, bake.Qo, eo);
      camera.fov = THREE.MathUtils.lerp(camera.fov, bake.fov, eo);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    }
    /* the floor: follows the flight, opens wide enough for the valley's lens, sinks a hair under the card's river */
    const r = state.riverness;
    seaRoom(handoff < P.cut ? r : 0, bake.theta);
    if (state.flying) {
      sea.position.set(camera.position.x, -.9 * r, camera.position.z);
      sea.rotation.y = -bake.theta0 * r; sea.scale.x = 1 + .55 * r;
      sea.updateMatrixWorld();
    } else { sea.scale.x = 1; sea.rotation.y = 0; }
    U.uOn.value = on;
    U.uPlateAlpha.value = smooth((s - .5) / .45);
    U.uStretchKeep.value = smooth((s - .8) / .18);
    U.uWater.value = smooth((s - .93) / .04);
    U.uEdge.value = 1;
    U.uHaze.value = P.haze * (1 - smooth((s - .62) / .34));
    U.uHazeRange.value.set(P.hazeNear, P.hazeFar);
    U.uDist.value.set(P.near, P.far, P.plate);
    U.uDebug.value = Math.max(P.portalDebug || 0, DEBUG_URL ? 1 : 0);
    U.uFix.value.set(Math.round(P.fixSteps * (innerWidth < 760 ? .75 : 1)), P.fixJump, P.fixFill, P.fixPush);
    U.uRefine.value = P.fixRefine;
    return state;
  }
  /* the radial zoom's focus follows the flight, not the scene swap */
  const fxMix = m => state.active ? smooth(state.s) : m;
  const api = { render, update, mix, fxMix, wanted, state, bake, set dirty(v) { dirty = !!v; }, get dirty() { return dirty; }, get mesh() { return fixOn() ? quad : mesh; }, get uniforms() { return uniforms; } };
  /* read-only handle for the QA tools (bake.ms, the active card, the debug view) */
  try { window.__OPENING_PORTAL__ = api; } catch (e) { /* not in a window */ }
  return api;
}
