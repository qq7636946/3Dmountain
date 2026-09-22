import * as THREE from 'three';

/* The MONTIS water droplet, ported from index4-5.html.
   One raymarched signed-distance surface: the drop (a sphere carrying the
   water hero's touch dent, ring, oscillation and wobble) and the pointer's
   trail, fused by the Codrops demo's exponential smooth-min. It wears
   physical glass (refraction, environment) and is coloured like the demo:
   the demo's noise highlight read off the reflection, screened over the
   water body and the refracted scene, composited in display values and
   sent back through this page's post chain (colour key, ACES filmic,
   sRGB) so it reaches the screen as intended. */

export const DROPLET_TRAIL = 15;
export const DROPLET_LOOK = {
  clarity: .6, water: 1, body: 1, smooth: 7, sheen: 1, contrast: 7, match: 1, ink: 1,
  noiseScale: 2, noiseSpeed: 2, trail: 1, trailSize: 1, trailReach: 3.2, steps: 40,
  bodyColor: '#3d5f78', glowColor: '#26313a', sheenColor: '#6a6a6a'
};

const GLSL_PARS = /* glsl */`
#define DROPLET_TRAIL 15
#define DROPLET_MAX_STEPS 64
uniform mat4 uLocal;
uniform float uLocalScale;
uniform float uRadius;
uniform float uFlipY;
uniform vec3 uTouchDir;
uniform float uPressure;
uniform float uWobble;
uniform float uWave;
uniform float uShapeTime;
uniform float uLip;
uniform float uK;
uniform vec4 uTrail[DROPLET_TRAIL];
uniform float uTrailW[DROPLET_TRAIL];
uniform int uTrailCount;
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;
uniform int uMaxSteps;
uniform float uPixelAngle;
uniform mat3 uNoiseView;
uniform float uNoiseTime;
uniform float uNoiseScale;
uniform float uContrast;
uniform float uSheen;
uniform float uSheenGain;
uniform float uMatch;
uniform float uInk;
uniform float uClarity;
uniform float uExposure;
uniform vec3 uTint0;
uniform vec3 uTint1;
uniform vec3 uBody;
uniform vec3 uKeyDodge;
uniform float uKeyMix;
uniform float uKeyContrast;
uniform float uKeySat;
varying vec3 vDropletWorld;
#ifndef USE_TRANSMISSION
uniform mat4 projectionMatrix;
#endif
/* The water hero's own surface motion, as a radius factor, for a
   direction in the drop's local frame (its old vertex deformation). */
float dropletShape(vec3 n){
  float t=uShapeTime;
  float d=length(n-uTouchDir);
  float dent=exp(-d*d/.34)*(-.19*uPressure);
  float ring=sin(d*15.-t*8.4)*exp(-d*2.7)*uPressure*.016;
  float osc=sin(n.x*4.6+n.y*2.1+t*3.2)*.52+sin(n.z*5.1-n.y*3.4-t*2.7)*.31+sin(n.y*6.3+t*3.8)*.17;
  float residual=(sin(dot(n,uTouchDir)*4.7-t*9.5)+.43*sin(n.y*6.8+t*7.1)+.30*sin(n.x*5.4-t*11.3))*uWobble*.033;
  return 1.+osc*uWave+dent+ring+residual;
}
/* The drop in its own frame (place, turn, squash, and the mirror's flip,
   all undone by uLocal), brought back to world lengths by its smallest
   scale and damped by uLip for its moving skin. The trail spheres join it
   in the same log-sum-exp, which stays a safe bound to march. */
float dropletMap(vec3 p){
  vec3 q=(uLocal*vec4(p,1.)).xyz;
  float len=length(q);
  float body=(len-uRadius*dropletShape(q/max(len,1e-5)))*uLocalScale*uLip;
  if(uTrailCount<=0)return body;
  float h=exp(-uK*body);
  for(int i=0;i<DROPLET_TRAIL;i++){
    if(i>=uTrailCount)break;
    if(uTrailW[i]<.002)continue;
    h+=uTrailW[i]*exp(-uK*(length(p-uTrail[i].xyz)-uTrail[i].w));
  }
  return -log(max(h,1e-30))/uK;
}
vec3 dropletNormal(vec3 p,float e){
  const vec2 k=vec2(1.,-1.);
  return normalize(
    k.xyy*dropletMap(p+k.xyy*e)+k.yyx*dropletMap(p+k.yyx*e)
    +k.yxy*dropletMap(p+k.yxy*e)+k.xxx*dropletMap(p+k.xxx*e));
}
/* The demo's value noise, with a hash periodic in 256 so the phase wraps
   without a seam. */
float dropletRnd(vec3 p){
  p=mod(p,256.);
  return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453123);
}
float dropletNoise(vec3 p){
  vec3 i=floor(p);
  vec3 f=fract(p);
  float a000=dropletRnd(i);
  float a100=dropletRnd(i+vec3(1.,0.,0.));
  float a010=dropletRnd(i+vec3(0.,1.,0.));
  float a110=dropletRnd(i+vec3(1.,1.,0.));
  float a001=dropletRnd(i+vec3(0.,0.,1.));
  float a101=dropletRnd(i+vec3(1.,0.,1.));
  float a011=dropletRnd(i+vec3(0.,1.,1.));
  float a111=dropletRnd(i+vec3(1.,1.,1.));
  vec3 u=f*f*(3.-2.*f);
  float k0=a000;
  float k1=a100-a000;
  float k2=a010-a000;
  float k3=a001-a000;
  float k4=a000-a100-a010+a110;
  float k5=a000-a010-a001+a011;
  float k6=a000-a100-a001+a101;
  float k7=-a000+a100+a010-a110+a001-a101-a011+a111;
  return k0+k1*u.x+k2*u.y+k3*u.z+k4*u.x*u.y+k5*u.y*u.z+k6*u.z*u.x+k7*u.x*u.y*u.z;
}
/* The demo's highlight, a display value: its noise on the reflection of a
   straight-on view, in the main camera's axes, in its two tints. In the
   mirror the normal is flipped back, so the reflection wears the drop's
   own pattern. */
vec3 dropletHighlight(vec3 nWorld){
  vec3 n=normalize(uNoiseView*vec3(nWorld.x,nWorld.y*uFlipY,nWorld.z));
  vec3 r=reflect(vec3(0.,0.,-1.),n);
  float a=dropletNoise(r*uNoiseScale+uNoiseTime);
  float b=dropletNoise(r*uNoiseScale-uNoiseTime);
  vec3 c=(uTint0*a+uTint1*b)*2.3;
  return pow(max(c,vec3(0.)),vec3(uContrast))*uSheen;
}
/* The page's colour key (its keyPass), forward and back: dodge, contrast
   about .5, saturation about Rec.601 luma. Each step inverts exactly. */
vec3 dropletKey(vec3 c){
  vec3 dodged=min(c/max(vec3(1.)-uKeyDodge,vec3(1e-3)),vec3(1.));
  c=mix(c,dodged,uKeyMix);
  c=(c-.5)*uKeyContrast+.5;
  float l=dot(c,vec3(.299,.587,.114));
  return max(mix(vec3(l),c,uKeySat),0.);
}
vec3 dropletKeyInverse(vec3 t){
  float l=dot(t,vec3(.299,.587,.114));
  vec3 c2=vec3(l)+(t-vec3(l))/max(uKeySat,1e-3);
  vec3 c1=(c2-.5)/max(uKeyContrast,1e-3)+.5;
  vec3 k=max(vec3(1.)-uKeyDodge,vec3(1e-3));
  vec3 knee=k*(1.-uKeyMix)+uKeyMix;
  vec3 low=c1/((1.-uKeyMix)+uKeyMix/k);
  vec3 high=(c1-uKeyMix)/max(1.-uKeyMix,1e-3);
  return max(mix(low,high,step(knee,c1)),vec3(0.));
}
const mat3 dropletAcesInput=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777));
const mat3 dropletAcesOutput=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602));
const mat3 dropletAcesOutputInverse=mat3(vec3(0.643038249,0.059268690,0.005961901),vec3(0.311186752,0.931436487,0.063929016),vec3(0.045775457,0.009294916,0.930118384));
const mat3 dropletAcesInputInverse=mat3(vec3(1.764740972,-0.147027852,-0.036336830),vec3(-0.675777678,1.160251512,-0.162436437),vec3(-0.088963294,-0.013223660,1.198773267));
/* What the page will show for a linear colour: colour key, exposure, ACES
   filmic, sRGB. */
vec3 dropletTone(vec3 lin){
  vec3 c=dropletAcesInput*(dropletKey(max(lin,vec3(0.)))*uExposure/.6);
  c=(c*(c+.0245786)-.000090537)/(c*(.983729*c+.4329510)+.238081);
  c=clamp(dropletAcesOutput*c,0.,1.);
  return mix(pow(c,vec3(.41666))*1.055-vec3(.055),c*12.92,vec3(lessThanEqual(c,vec3(.0031308))));
}
float dropletFitInverse(float y){
  y=clamp(y,0.,.9);
  float A=1.-.983729*y;
  float B=.0245786-.432951*y;
  float C=-(.000090537+.238081*y);
  return (-B+sqrt(max(B*B-4.*A*C,0.)))/(2.*A);
}
vec3 dropletAcesInverse(vec3 l){
  vec3 u=dropletAcesOutputInverse*l;
  /* The highlight cap, taken off all three channels together so a bright
     colour keeps its hue. */
  float top=max(u.r,max(u.g,u.b));
  if(top>.9)u*=.9/top;
  return dropletAcesInputInverse*vec3(dropletFitInverse(u.r),dropletFitInverse(u.g),dropletFitInverse(u.b));
}
/* The light that the page turns into a display colour. Colours ACES cannot
   reach from real light are darkened in linear light, which keeps their
   hue; black always is reachable, so the search always lands. */
vec3 dropletUntone(vec3 display){
  vec3 d=clamp(display,0.,1.);
  vec3 l=mix(pow(d*.9478672986+vec3(.0521327014),vec3(2.4)),d*.0773993808,vec3(lessThanEqual(d,vec3(.04045))));
  vec3 w=dropletAcesInverse(l);
  if(min(w.r,min(w.g,w.b))<0.){
    float lo=0.;
    float hi=1.;
    for(int i=0;i<8;i++){
      float k=.5*(lo+hi);
      vec3 t=dropletAcesInverse(l*k);
      if(min(t.r,min(t.g,t.b))>=0.)lo=k;
      else hi=k;
    }
    w=dropletAcesInverse(l*lo);
  }
  return dropletKeyInverse(max(w,vec3(0.))*.6/max(uExposure,1e-3));
}
/* The droplet's colour and alpha. Main pass: the refracted scene as it
   would be seen, the water body laid over it by CLARITY, the highlight
   screened on top, all taken back to light (MATCH 0 is the plain glass
   look, darkened by INK). Mirror pass: nothing is refracted there, so the
   body and highlight are written with a see-through alpha, and the water
   lays them over its own sky. */
vec4 dropletColour(vec3 glass,vec3 nWorld){
  vec3 v=dropletHighlight(nWorld);
  vec3 vc=min(v,vec3(1.));
#ifdef DROPLET_MIRROR
  vec3 shown=vec3(1.)-(vec3(1.)-uBody)*(vec3(1.)-vc);
  float alpha=clamp(1.-clamp(uClarity,0.,1.)*(1.-max(vc.r,max(vc.g,vc.b))),0.,1.);
  return vec4(dropletUntone(shown),alpha);
#else
  vec3 lifted=glass*(1.-uInk)+(pow(vc,vec3(2.2))+max(v-1.,vec3(0.)))*uSheenGain;
  vec3 water=mix(uBody,dropletTone(glass),clamp(uClarity,0.,1.));
  vec3 shown=vec3(1.)-(vec3(1.)-water)*(vec3(1.)-vc);
  return vec4(mix(lifted,dropletUntone(shown),uMatch),1.);
#endif
}
`;

const GLSL_MARCH = /* glsl */`
vec3 dropletRo=cameraPosition;
vec3 dropletRd=normalize(vDropletWorld-cameraPosition);
vec3 dropletInv=1./dropletRd;
vec3 dropletT0=(uBoxMin-dropletRo)*dropletInv;
vec3 dropletT1=(uBoxMax-dropletRo)*dropletInv;
float dropletNear=max(max(min(dropletT0.x,dropletT1.x),min(dropletT0.y,dropletT1.y)),min(dropletT0.z,dropletT1.z));
float dropletFar=min(min(max(dropletT0.x,dropletT1.x),max(dropletT0.y,dropletT1.y)),max(dropletT0.z,dropletT1.z));
if(dropletFar<=max(dropletNear,0.))discard;
float dropletT=max(dropletNear,0.);
float dropletBest=1e9;
float dropletBestT=dropletT;
bool dropletHit=false;
for(int i=0;i<DROPLET_MAX_STEPS;i++){
  if(i>=uMaxSteps)break;
  float dropletD=dropletMap(dropletRo+dropletRd*dropletT);
  float dropletPx=max(dropletT*uPixelAngle,1e-4);
  float dropletMiss=dropletD/(uLip*dropletPx);
  if(dropletMiss<dropletBest){
    dropletBest=dropletMiss;
    dropletBestT=dropletT;
  }
  if(dropletD<dropletPx*.35){
    dropletHit=true;
    break;
  }
  dropletT+=dropletD;
  if(dropletT>dropletFar)break;
}
/* A ray that passes within about a pixel of the surface is its soft
   edge, measured in true distance (uLip undone) so the edge stays one
   pixel wide however hard the skin is moving. */
float dropletCoverage=1.;
if(!dropletHit){
  if(dropletBest>1.2)discard;
  dropletT=dropletBestT;
  dropletCoverage=clamp(1.2-dropletBest,0.,1.);
}
vec3 dropletPos=dropletRo+dropletRd*dropletT;
vec4 dropletClip=projectionMatrix*viewMatrix*vec4(dropletPos,1.);
if(dropletClip.w<=0.||dropletClip.z<-dropletClip.w||dropletClip.z>dropletClip.w)discard;
gl_FragDepth=.5*dropletClip.z/dropletClip.w+.5;
vec3 dropletNormalWorld=dropletNormal(dropletPos,max(dropletT*uPixelAngle*.5,.0015));
vec3 dropletNormalView=normalize((viewMatrix*vec4(dropletNormalWorld,0.)).xyz);
rmWorldPosition=dropletPos;
rmViewPosition=-(viewMatrix*vec4(dropletPos,1.)).xyz;
#include <clipping_planes_fragment>
`;

function patchMaterial(material, uniforms, cacheKey) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const anchors = [
      [shader.vertexShader, '#include <common>'],
      [shader.vertexShader, '#include <project_vertex>'],
      [shader.fragmentShader, 'varying vec3 vViewPosition;'],
      [shader.fragmentShader, '#include <transmission_pars_fragment>'],
      [shader.fragmentShader, 'void main() {'],
      [shader.fragmentShader, '#include <clipping_planes_fragment>'],
      [shader.fragmentShader, '#include <normal_fragment_maps>'],
      [shader.fragmentShader, '#include <opaque_fragment>']
    ];
    for (const [source, anchor] of anchors) {
      if (!source.includes(anchor)) console.error('Water droplet shader anchor missing:', anchor);
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDropletWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDropletWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    /* Every chunk after these reads the marched point instead of the box
       face: the view position for lights and environment, the world
       position for the refraction. */
    shader.fragmentShader = shader.fragmentShader
      .replace('varying vec3 vViewPosition;', 'varying vec3 vViewPosition;\nvec3 rmViewPosition;\n#define vViewPosition rmViewPosition')
      .replace('#include <transmission_pars_fragment>', '#include <transmission_pars_fragment>\nvec3 rmWorldPosition;\n#define vWorldPosition rmWorldPosition')
      .replace('void main() {', GLSL_PARS + '\nvoid main() {')
      .replace('#include <clipping_planes_fragment>', GLSL_MARCH)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=dropletNormalView;\nnonPerturbedNormal=dropletNormalView;')
      .replace('#include <opaque_fragment>',
        'vec4 dropletOut=dropletColour(outgoingLight,dropletNormalWorld);\n' +
        'outgoingLight=dropletOut.rgb;\n' +
        'diffuseColor.a*=dropletCoverage*dropletOut.a;\n' +
        /* The refraction's alpha carries whatever the opaque layers wrote
           into the transmission target; the droplet's own colour is final. */
        '#ifdef USE_TRANSMISSION\nmaterial.transmissionAlpha=1.;\n#endif\n' +
        '#include <opaque_fragment>');
  };
  material.customProgramCacheKey = () => cacheKey;
}

const hexToDisplay = (hex) => {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0;
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};

/* radius: the drop's local radius (its motion group scales it).
   colourKey: the page's keyPass, read live at every draw.
   physical: MeshPhysicalMaterial parameters for the glass. */
export function createDroplet({ radius = 1.35, environment = null, colourKey = null, lite = false, physical = {} } = {}) {
  const uniforms = {
    uLocal: { value: new THREE.Matrix4() },
    uLocalScale: { value: 1 },
    uRadius: { value: radius },
    uFlipY: { value: 1 },
    uTouchDir: { value: new THREE.Vector3(0, 0, 1) },
    uPressure: { value: 0 },
    uWobble: { value: 0 },
    uWave: { value: 0 },
    uShapeTime: { value: 0 },
    uLip: { value: 1 },
    uK: { value: 3 },
    uTrail: { value: Array.from({ length: DROPLET_TRAIL }, () => new THREE.Vector4()) },
    uTrailW: { value: new Array(DROPLET_TRAIL).fill(0) },
    uTrailCount: { value: 0 },
    uBoxMin: { value: new THREE.Vector3(-1, -1, -1) },
    uBoxMax: { value: new THREE.Vector3(1, 1, 1) },
    uMaxSteps: { value: 40 },
    uPixelAngle: { value: .001 },
    uNoiseView: { value: new THREE.Matrix3() },
    uNoiseTime: { value: 0 },
    uNoiseScale: { value: 2 },
    uContrast: { value: 7 },
    uSheen: { value: 1 },
    uSheenGain: { value: 1 },
    uMatch: { value: 1 },
    uInk: { value: 1 },
    uClarity: { value: .6 },
    uExposure: { value: 1 },
    uTint0: { value: new THREE.Vector3(.1765, .1255, .2275) },
    uTint1: { value: new THREE.Vector3(.4118, .4118, .4157) },
    uBody: { value: new THREE.Vector3() },
    uKeyDodge: { value: new THREE.Vector3() },
    uKeyMix: { value: 0 },
    uKeyContrast: { value: 1 },
    uKeySat: { value: 1 }
  };
  const glass = {
    color: 0xffffff, metalness: 0, roughness: .012, transmission: 1, ior: 1.333, thickness: 2.6,
    attenuationColor: new THREE.Color(0xffffff), attenuationDistance: Infinity, specularIntensity: 1,
    envMapIntensity: .88, clearcoat: 0, transparent: true,
    ...physical,
    /* Back faces start the march: the ray comes from the camera, so the
       coverage is the same, and a flipped mirror render or a camera near
       the box cannot lose the entry face. Not DoubleSide, which three
       would draw again into the transmission target. */
    side: THREE.BackSide
  };
  const baseTransmission = glass.transmission;
  const baseThickness = glass.thickness;
  const material = new THREE.MeshPhysicalMaterial(glass);
  const mirrorMaterial = new THREE.MeshPhysicalMaterial({ ...glass, transmission: 0 });
  if (environment) { material.envMap = environment; mirrorMaterial.envMap = environment; }
  mirrorMaterial.defines = { ...(mirrorMaterial.defines || {}), DROPLET_MIRROR: '' };
  patchMaterial(material, uniforms, 'montis-water-droplet-sdf-v1');
  patchMaterial(mirrorMaterial, uniforms, 'montis-water-droplet-sdf-mirror-v1');

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.name = 'codrops-water-droplet';
  mesh.renderOrder = 6;
  mesh.raycast = () => {};

  const look = { ...DROPLET_LOOK };
  /* Filled by the owner in its root's space: centres, radii, weights. */
  const trail = {
    points: Array.from({ length: DROPLET_TRAIL }, () => new THREE.Vector3()),
    weights: new Float32Array(DROPLET_TRAIL),
    radii: new Float32Array(DROPLET_TRAIL),
    count: 0
  };
  let motion = null, root = null, noisePhase = 0;
  const touchLocal = new THREE.Vector3(0, 0, 1);

  function apply() {
    const match = THREE.MathUtils.clamp(look.match, 0, 1);
    const ink = THREE.MathUtils.clamp(look.ink, 0, 1);
    const clarity = THREE.MathUtils.clamp(look.clarity, 0, 1);
    /* Refraction only when the glass reaches the screen, in either look:
       weight (1-MATCH)(1-INK) in the glass look, MATCH*CLARITY in the
       water. Otherwise the extra opaque render it costs is switched off. */
    const glassShows = (1 - match) * (1 - ink) > .001 || match * clarity > .001;
    material.transmission = glassShows ? Math.max(.001, baseTransmission) : 0;
    uniforms.uClarity.value = clarity;
    uniforms.uMatch.value = match;
    uniforms.uInk.value = ink;
    uniforms.uSheen.value = Math.max(0, look.sheen);
    uniforms.uContrast.value = Math.max(1, look.contrast);
    uniforms.uNoiseScale.value = Math.max(.01, look.noiseScale);
    uniforms.uMaxSteps.value = Math.round(THREE.MathUtils.clamp(look.steps * (lite ? .7 : 1), 8, 64));
    /* WATER 0 is the demo's purple and grey on a black body. */
    const water = THREE.MathUtils.clamp(look.water, 0, 1);
    const glow = hexToDisplay(look.glowColor), sheen = hexToDisplay(look.sheenColor), body = hexToDisplay(look.bodyColor);
    const bodyAmount = water * THREE.MathUtils.clamp(look.body, 0, 1);
    uniforms.uTint0.value.set(.1765 + (glow[0] - .1765) * water, .1255 + (glow[1] - .1255) * water, .2275 + (glow[2] - .2275) * water);
    uniforms.uTint1.value.set(.4118 + (sheen[0] - .4118) * water, .4118 + (sheen[1] - .4118) * water, .4157 + (sheen[2] - .4157) * water);
    uniforms.uBody.value.set(body[0] * bodyAmount, body[1] * bodyAmount, body[2] * bodyAmount);
  }
  function configure(options = {}) {
    for (const key of Object.keys(DROPLET_LOOK)) {
      const value = options[key];
      if (typeof DROPLET_LOOK[key] === 'string') { if (typeof value === 'string') look[key] = value; }
      else if (Number.isFinite(value)) look[key] = value;
    }
    apply();
  }
  apply();

  /* motionObject: the group that carries the drop's place, turn and
     squash, at the drop's radius. rootObject: the space the box and the
     trail are laid out in. */
  function attach(motionObject, rootObject) { motion = motionObject; root = rootObject; }

  /* Once a frame, after the drop's motion group has its place and squash:
     shape inputs, the noise clock, opacity, and the proxy box around the
     drop and trail, in the root's space so a flipped root flips it too. */
  function frame({ dt = 1 / 60, time = 0, opacity = 1, pressure = 0, wobble = 0, wave = 0, touch = null, visible = true, reducedMotion = false } = {}) {
    material.opacity = mirrorMaterial.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    mesh.visible = Boolean(motion) && visible && material.opacity > .005;
    if (touch) touchLocal.copy(touch).normalize();
    uniforms.uPressure.value = pressure;
    uniforms.uWobble.value = wobble;
    uniforms.uWave.value = wave;
    uniforms.uShapeTime.value = time;
    /* The steepest the skin can lean, bounded term by term, so the march
       never steps through it. */
    uniforms.uLip.value = 1 / (1 + .95 * Math.abs(pressure) + .35 * Math.abs(wobble) + 6.5 * Math.abs(wave));
    noisePhase = (noisePhase + dt * look.noiseSpeed * (reducedMotion ? 0 : 1)) % 256;
    uniforms.uNoiseTime.value = noisePhase;
    if (!mesh.visible) return;
    const s = motion.scale;
    const smax = Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z));
    const k = Math.max(.5, look.smooth) * .55 / Math.max(1e-3, radius * smax);
    uniforms.uK.value = k;
    const swell = .2 + Math.abs(wave) * 1.1 + .03 * Math.abs(pressure) + .07 * Math.abs(wobble);
    const half = radius * smax * (1 + swell);
    const c = motion.position;
    let minX = c.x - half, maxX = c.x + half;
    let minY = c.y - half, maxY = c.y + half;
    let minZ = c.z - half, maxZ = c.z + half;
    let active = 1, heaviest = 1;
    for (let i = 0; i < trail.count; i++) {
      const w = trail.weights[i];
      if (w < .002) continue;
      const p = trail.points[i], r = trail.radii[i];
      minX = Math.min(minX, p.x - r); maxX = Math.max(maxX, p.x + r);
      minY = Math.min(minY, p.y - r); maxY = Math.max(maxY, p.y + r);
      minZ = Math.min(minZ, p.z - r); maxZ = Math.max(maxZ, p.z + r);
      active++; heaviest = Math.max(heaviest, w);
    }
    /* The most the smooth-min can swell the union past its parts. */
    const pad = (Math.log(Math.max(2, active)) + Math.log(heaviest)) / k + .06;
    minX -= pad; minY -= pad; minZ -= pad; maxX += pad; maxY += pad; maxZ += pad;
    mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    const side = Math.max(maxX - minX, maxY - minY, maxZ - minZ) + .1;
    mesh.scale.setScalar(side);
    /* three scales the refraction by the mesh's size; the drop's body was
       its motion group's size, and the box is larger. */
    material.thickness = baseThickness * smax / side;
  }

  const scale = new THREE.Vector3(), point = new THREE.Vector3();
  /* At draw time, from the matrices of this very render, so the main pass
     and the page's flipped mirror pass both get the drop where they see it. */
  mesh.onBeforeRender = (r, _scene, cam) => {
    if (!motion) return;
    const mw = motion.matrixWorld;
    uniforms.uLocal.value.copy(mw).invert();
    scale.setFromMatrixScale(mw);
    uniforms.uLocalScale.value = Math.max(1e-4, Math.min(scale.x, scale.y, scale.z));
    uniforms.uFlipY.value = mw.determinant() < 0 ? -1 : 1;
    uniforms.uTouchDir.value.copy(touchLocal);
    const rw = root ? root.matrixWorld : null;
    const rootScale = rw ? Math.cbrt(Math.abs(rw.determinant())) : 1;
    let count = 0;
    for (let i = 0; i < trail.count; i++) {
      point.copy(trail.points[i]);
      if (rw) point.applyMatrix4(rw);
      uniforms.uTrail.value[i].set(point.x, point.y, point.z, trail.radii[i] * rootScale);
      uniforms.uTrailW.value[i] = trail.weights[i];
      count = i + 1;
    }
    uniforms.uTrailCount.value = count;
    const e = mesh.matrixWorld.elements;
    const hx = .5 * (Math.abs(e[0]) + Math.abs(e[4]) + Math.abs(e[8]));
    const hy = .5 * (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9]));
    const hz = .5 * (Math.abs(e[2]) + Math.abs(e[6]) + Math.abs(e[10]));
    uniforms.uBoxMin.value.set(e[12] - hx, e[13] - hy, e[14] - hz);
    uniforms.uBoxMax.value.set(e[12] + hx, e[13] + hy, e[14] + hz);
    const target = r.getRenderTarget();
    const height = target ? target.height : r.domElement.height;
    uniforms.uPixelAngle.value = 2 / Math.max(1e-4, Math.abs(cam.projectionMatrix.elements[5])) / Math.max(1, height);
    uniforms.uNoiseView.value.setFromMatrix4(cam.matrixWorldInverse);
    uniforms.uExposure.value = r.toneMappingExposure;
    uniforms.uSheenGain.value = 1 / Math.max(.2, r.toneMappingExposure);
    const key = colourKey && colourKey.enabled !== false ? colourKey.uniforms : null;
    if (key) {
      const d = key.uDodge.value;
      uniforms.uKeyDodge.value.set(d.x, d.y, d.z);
      uniforms.uKeyMix.value = key.uMix.value;
      uniforms.uKeyContrast.value = key.uContrast.value;
      uniforms.uKeySat.value = key.uSat.value;
    } else {
      uniforms.uKeyDodge.value.set(0, 0, 0);
      uniforms.uKeyMix.value = 0;
      uniforms.uKeyContrast.value = 1;
      uniforms.uKeySat.value = 1;
    }
  };

  /* The page's mirror pass swaps in the material with no refraction. */
  function setMirror(on) { mesh.material = on ? mirrorMaterial : material; }

  function dispose() {
    mesh.geometry.dispose();
    material.dispose();
    mirrorMaterial.dispose();
  }

  return { mesh, material, mirrorMaterial, uniforms, look, trail, configure, attach, frame, setMirror, dispose };
}
