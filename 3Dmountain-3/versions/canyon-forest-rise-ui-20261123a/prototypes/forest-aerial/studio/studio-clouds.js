import * as THREE from 'three';

// Thin mist in the valley, with deeper banks of broken cloud above the flanks.
// Each entry is a world-space ellipsoid: centre, radii, optical thickness, cloud (1) or mist (0).
export const BANKS = [
  [ 2.4,1.06,-2.4, 3.4,0.12,1.9, 0.22,0], [-2.6,1.12,-2.6, 3.3,0.14,1.8, 0.22,0],
  [ 3.8,0.98, 1.8, 2.5,0.12,1.5, 0.17,0], [-3.4,0.97, 1.5, 2.8,0.14,1.6, 0.18,0],
  [-4.2,1.94,-2.5, 2.6,0.34,1.24,0.72,1], [-2.2,2.11,-3.4, 1.9,0.31,0.89,0.62,1],
  [ 3.9,2.26, 2.8, 2.3,0.39,1.13,0.78,1], [ 5.3,2.49, 2.0, 1.6,0.30,0.90,0.66,1],
  [ 5.3,2.18,-3.8, 2.9,0.32,1.00,0.65,1], [-5.1,2.22, 3.5, 2.2,0.37,1.13,0.66,1],
  [-3.1,1.78, 8.3, 4.6,0.42,1.85,0.74,1], [ 2.0,1.96, 9.2, 3.8,0.46,1.35,0.67,1],
  [ 2.8,1.94,-8.8, 4.8,0.39,1.52,0.72,1], [-2.8,1.61,-8.3, 3.4,0.35,1.64,0.67,1],
  [10.5,1.63, 1.1, 2.8,0.48,3.00,0.68,1], [-10.3,1.70,-0.7, 2.3,0.44,3.30,0.70,1]
];
const LEFT_BANK = 9;

const VERT = `
  attribute vec3 aCenter,aRadius,aStyle;
  attribute float aLeftBank;
  uniform float uTime,uCloudLayer,uStudioMist;
  uniform vec3 uLeftFog,uLeftFogOffset;
  varying vec3 vCenter,vRadius,vPlane,vStyle;
  void main() {
    vStyle=aStyle;
    vStyle.y*=mix(uStudioMist,uCloudLayer,aStyle.z);
    vStyle.y*=mix(1.0,uLeftFog.x,aLeftBank);
    vCenter=aCenter+aLeftBank*uLeftFogOffset+vec3(0.55,0.0,-0.26)*sin(uTime*0.019+aStyle.x);
    vRadius=aRadius*mix(vec3(1.0),uLeftFog.yzy,aLeftBank);
    vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
    vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
    // Project the ellipsoid onto the two axes of this lens. The fragment
    // shader intersects the actual volume, including in a low grazing view.
    vPlane=vCenter+2.8*(right*length(right*vRadius)*position.x + up*length(up*vRadius)*position.y);
    gl_Position=projectionMatrix*viewMatrix*vec4(vPlane,1.0);
    if(vStyle.y<0.001) gl_Position=vec4(2.,2.,2.,1.);
  }
`;

const FRAG = `
  uniform float uTime,uArrival,uLattice;
  uniform vec3 uCloudLit,uCloudShade;
  uniform vec2 uCloudTone;
  uniform sampler2D tCanopy,tWater;
  uniform vec4 uBounds;
  uniform vec2 uYRange;
  uniform float uRelief,uCanopy,uTributaries;
  uniform vec3 uSun;
  uniform mat4 projectionMatrix;
  varying vec3 vCenter,vRadius,vPlane,vStyle;
  float hash(vec2 p) {
    vec3 h=fract(p.xyx*vec3(0.1031,0.11369,0.13787));
    h+=dot(h,h.yzx+19.19);
    return fract((h.x+h.y)*h.z);
  }
  float noise2(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
  }
  float cloudField(vec2 p) {
    mat2 rot=mat2(0.8,-0.6,0.6,0.8);
    float broad=noise2(p); p=rot*p*2.13+3.71;
    float billow=noise2(p); p=rot*p*2.06+7.27;
    return broad*0.50+billow*0.29+noise2(p)*0.15+noise2(rot*p*2.11)*0.06;
  }
  void main() {
    if(uLattice>0.35) discard;
    vec3 eye=(cameraPosition-vCenter)/vRadius;
    vec3 ray=normalize(vPlane-cameraPosition), rd=ray/vRadius;
    float rr=dot(rd,rd), t=-dot(eye,rd)/rr;
    vec3 closest=eye+t*rd;
    float chord=1.0-dot(closest,closest);
    if(chord<=0.0) discard;
    float span=sqrt(chord/rr);
    float entry=max(0.0,t-span), exitT=t+span;
    if(exitT<=entry) discard;
    vec3 sampleW=cameraPosition+ray*mix(entry,exitT,0.30);
    vec3 local=(sampleW-vCenter)/vRadius;
    vec2 wind=vec2(-0.021,0.010)*uTime;
    vec2 q=sampleW.xz*vec2(1.07,1.42)+sampleW.y*vec2(0.42,-0.28)+wind+vStyle.x;
    float field=cloudField(q);
    float fringe=(noise2(q*4.9+field*2.7)*0.68+noise2(q*10.7)*0.32-0.50);
    float billows=smoothstep(0.32,0.69,field+chord*0.22-0.12+fringe*0.24);
    float feather=smoothstep(-.025,.66,chord+fringe*.23);
    float thickness=chord*feather*billows*vStyle.y;
    float alpha=1.0-exp(-thickness*mix(1.36,1.49,vStyle.z));
    // Soften terrain intersections using the height field already on the GPU.
    // Higher cloud banks never meet the core hills and skip these samples.
    vec2 terrainUV=(sampleW.xz-uBounds.xy)*uBounds.zw;
    if(sampleW.y<1.62 && all(greaterThan(terrainUV,vec2(0.0))) && all(lessThan(terrainUV,vec2(1.0)))) {
      vec2 fieldH=texture2D(tCanopy,terrainUV).rg;
      vec4 water=texture2D(tWater,terrainUV);
      float ground=.105+max(0.0,(uYRange.x+fieldH.r*uYRange.y-.105)*uRelief+fieldH.g*.12*uCanopy);
      float creekBed=.105+water.b*uYRange.y*uRelief;
      ground=mix(ground,min(ground,creekBed),water.a*uTributaries);
      float clearance=sampleW.y-ground;
      alpha*=smoothstep(-.025,.14+vRadius.y*.75,clearance);
    }
    alpha*=smoothstep(0.15,1.1,exitT);
    if(alpha<0.003) discard;
    vec3 face=normalize(local/vRadius);
    float sunward=cloudField(q+uSun.xz*0.27);
    float light=dot(face,normalize(uSun))*0.21 + (field-sunward)*1.20 + 0.50 + fringe*0.12;
    // 2026-11-21 (client: 「雲霧要白一點 或是開顏色調整參數」): lit / shade colours, brightness and contrast are uniforms;
    // their defaults are the old constants, so other pages look as before (the rise page sets its own in flow2-studio-pbr-view.js).
    vec3 color=mix(uCloudShade,uCloudLit,clamp((light-0.5)*uCloudTone.y+0.5,0.0,1.0))*uCloudTone.x;
    color=mix(vec3(dot(color,vec3(0.2126,0.7152,0.0722))),color,smoothstep(0.12,0.93,uArrival));
    vec4 clip=projectionMatrix*viewMatrix*vec4(sampleW,1.0);
    gl_FragDepth=clamp(clip.z/clip.w*0.5+0.5,0.0,1.0);
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
  }
`;

export function createStudioClouds(atlas,studio) {
  const quad=new THREE.PlaneGeometry(1,1);
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setIndex(quad.index);
  geometry.setAttribute('position',quad.getAttribute('position'));
  const attr=fn=>new THREE.InstancedBufferAttribute(new Float32Array(BANKS.flatMap(fn)),3);
  geometry.setAttribute('aCenter',attr(b=>b.slice(0,3)));
  geometry.setAttribute('aRadius',attr(b=>b.slice(3,6)));
  geometry.setAttribute('aStyle',attr((b,i)=>[i*2.731,b[6],b[7]]));
  geometry.setAttribute('aLeftBank',new THREE.InstancedBufferAttribute(Float32Array.from(BANKS, (_,i)=>i===LEFT_BANK?1:0),1));
  geometry.instanceCount=BANKS.length;
  const material=new THREE.ShaderMaterial({
    uniforms: {
      uTime: atlas.uniforms.uTime, uSun: atlas.uniforms.uSun, uLattice: atlas.uniforms.uLattice,
      tCanopy: atlas.uniforms.tCanopy, tWater: atlas.uniforms.tWater, uBounds: atlas.uniforms.uBounds,
      uYRange: atlas.uniforms.uYRange, uRelief: atlas.uniforms.uRelief, uCanopy: atlas.uniforms.uCanopy,
      uTributaries: studio.uTributaries,
      uStudioMist: studio.uStudioMist, uCloudLayer: studio.uCloudLayer, uArrival: studio.uArrival,
      uLeftFog: { value: new THREE.Vector3(1,1,1) }, uLeftFogOffset: { value: new THREE.Vector3() },
      uCloudLit: { value: new THREE.Vector3(0.94,0.93,0.88) }, uCloudShade: { value: new THREE.Vector3(0.36,0.43,0.49) },
      uCloudTone: { value: new THREE.Vector2(1,1) }
    },
    vertexShader: VERT,fragmentShader: FRAG,transparent: true,depthWrite: false
  });
  material.userData.handlesArrival=true;
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='Highland cloud banks and valley mist';
  mesh.renderOrder=58;
  mesh.frustumCulled=false;
  return mesh;
}
