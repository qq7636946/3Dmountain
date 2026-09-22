/** Curved, open card helix adapted from slide.js, sharing the Logo scene camera. */
export const LOGO_CARD_DEFAULTS={
  enabled:1,radius:.94,size:.9,gap:.12,spacing:.78,pitch:.18,
  turns:1,phase:40,tiltX:-8,tiltZ:-7,offsetY:-.02,
  tailTaper:.18,tailDepth:.18,wave:.035,autoSpeed:0,
  opacity:1,tintStrength:.94,saturation:.08,contrast:1.08,brightness:1,
  mobileScale:.68
};
const ARTWORK=[
  ['loose-sketches.jpg','Loose Sketches'],['imagination.jpg','Imagination'],
  ['swank-flat.jpg','SWANK'],['watch-reference.jpg','DFZ Watch'],
  ['style-reference.jpg','Style — 2026'],['novaglam.jpg','Novaglam'],
  ['headphones.jpg','Every Note'],['editorial.jpg','Selected Work']
];
const STRIP_ORDER=[0,1,3,7,2,5,4,6];
export function createLogoCards(THREE,{config,renderer}){
  const group=new THREE.Group();group.name='logo-slide-card-helix';group.visible=false;
  const geometry=new THREE.PlaneGeometry(1,1,48,4),meshes=[],textures=[];
  const fallbackCanvas=document.createElement('canvas');fallbackCanvas.width=2;fallbackCanvas.height=2;
  const context=fallbackCanvas.getContext('2d');context.fillStyle='#becfe0';context.fillRect(0,0,2,2);
  const placeholder=new THREE.CanvasTexture(fallbackCanvas);placeholder.colorSpace=THREE.SRGBColorSpace;
  const vertexShader=/* glsl */`
    uniform float uRadius,uArc,uHeight,uPitch,uWave,uAngle,uPathAngle,uRadiusSlope,uDepthSlope;
    varying vec2 vUv;varying vec3 vWorld;
    float pathY(float a){return -uPitch*a+uWave*sin(a*1.6);}
    void main(){
      vUv=uv;
      float a=(uv.x-.5)*uArc;
      float radius=uRadius+uRadiusSlope*a;
      vec3 p=vec3(sin(a)*radius,(uv.y-.5)*uHeight+pathY(uPathAngle+a)-pathY(uPathAngle),cos(a)*radius-uRadius);
      float c=cos(uAngle),s=sin(uAngle);
      p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
      p.z+=uDepthSlope*a;
      vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;
      gl_Position=projectionMatrix*viewMatrix*world;
    }
  `;
  const fragmentShader=/* glsl */`
    uniform sampler2D uTexture;
    uniform vec2 uCrop;
    uniform vec3 uPaper,uInk;
    uniform float uOpacity,uTintStrength,uSaturation,uContrast,uBrightness;
    varying vec2 vUv;varying vec3 vWorld;
    void main(){
      vec2 q=abs(vUv-.5)-vec2(.484);
      float sdf=length(max(q,0.))+min(max(q.x,q.y),0.)-.016;
      float aa=max(fwidth(sdf),.0005),coverage=1.-smoothstep(-aa,aa,sdf);
      if(coverage*uOpacity<.003)discard;
      vec2 faceUV=vec2(gl_FrontFacing?vUv.x:1.-vUv.x,vUv.y);
      vec3 original=texture2D(uTexture,(faceUV-.5)*uCrop+.5).rgb;
      float lum=dot(original,vec3(.2126,.7152,.0722));
      float tone=clamp((pow(max(lum,0.),.78)-.5)*uContrast+.5,0.,1.);
      vec3 silver=mix(uInk,uPaper,tone);
      vec3 desaturated=mix(vec3(lum),original,uSaturation);
      vec3 color=mix(desaturated,silver,uTintStrength)*uBrightness;
      vec3 N=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
      color*=.92+.08*abs(N.z);
      float border=1.-smoothstep(aa,aa*2.5,-sdf);
      color=mix(color,uPaper*.9,border*.35);
      gl_FragColor=vec4(color,uOpacity*coverage);
    }
  `;
  for(let index=0;index<ARTWORK.length;index++){
    const uniforms={uTexture:{value:placeholder},uCrop:{value:new THREE.Vector2(1,1)},uPaper:{value:new THREE.Color()},uInk:{value:new THREE.Color()},uOpacity:{value:0},uTintStrength:{value:1},uSaturation:{value:0},uContrast:{value:1},uBrightness:{value:1}};
    for(const name of ['Radius','Arc','Height','Pitch','Wave','Angle','PathAngle','RadiusSlope','DepthSlope'])uniforms['u'+name]={value:0};
    const material=new THREE.ShaderMaterial({name:'Silver-blue card · '+ARTWORK[index][1],uniforms,vertexShader,fragmentShader,side:THREE.DoubleSide,transparent:true,depthWrite:true});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=ARTWORK[index][1];mesh.frustumCulled=false;
    mesh.userData.slot=STRIP_ORDER.indexOf(index);mesh.userData.aspect=1.46;
    // Draw the cards before the glass; their depth keeps foreground cards in front.
    mesh.renderOrder=4;group.add(mesh);meshes.push(mesh);
  }
  const loader=new THREE.TextureLoader();
  const ready=Promise.all(ARTWORK.map(([file],index)=>new Promise(resolve=>{
    loader.load('./slide-assets/'+file,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      textures.push(texture);meshes[index].material.uniforms.uTexture.value=texture;
      meshes[index].userData.aspect=texture.image.width/texture.image.height;resolve(true);
    },undefined,error=>{console.warn('Logo card image unavailable:',file,error);resolve(false)});
  })));
  const rotation=new THREE.Euler(),orientation=new THREE.Quaternion();
  let lastTime=null,autoAngle=0;
  function update({progress=0,reveal=1,exit=0,time=0,reducedMotion=false,palette,mobile=false}={}){
    const C=config,dt=lastTime===null?0:Math.min(.05,Math.max(0,time-lastTime));lastTime=time;
    // Optional autoplay is integrated: changing its speed cannot jump the card positions.
    if(!reducedMotion)autoAngle=(autoAngle+dt*C.autoSpeed)%(Math.PI*2);
    const fade=reveal*(1-exit)*C.opacity;
    group.visible=C.enabled>.5&&fade>.001;
    if(!group.visible)return;
    const fit=mobile?C.mobileScale:1;group.scale.setScalar(fit);
    rotation.set(THREE.MathUtils.degToRad(C.tiltX),0,THREE.MathUtils.degToRad(C.tiltZ));orientation.setFromEuler(rotation);
    const phase=THREE.MathUtils.degToRad(C.phase),spin=phase-progress*C.turns*Math.PI*2;
    const centering=C.pitch*(phase-Math.PI*C.turns)+C.offsetY;
    const arc=C.spacing*(1-C.gap)*C.size;
    for(const mesh of meshes){
      const slot=mesh.userData.slot,frac=slot/(meshes.length-1);
      const radius=C.radius*(1-C.tailTaper+frac*C.tailTaper),pathAngle=(slot-(meshes.length-1)/2)*C.spacing+spin,angle=pathAngle+autoAngle;
      mesh.position.set(Math.sin(angle)*radius,-C.pitch*pathAngle+C.wave*Math.sin(pathAngle*1.6),Math.cos(angle)*radius-C.tailDepth*(1-frac));
      mesh.position.applyQuaternion(orientation);mesh.position.y+=centering;mesh.quaternion.copy(orientation);
      const u=mesh.material.uniforms;
      const values={Radius:radius,Arc:arc,Height:radius*arc/1.46,Pitch:C.pitch,Wave:C.wave,Angle:angle,PathAngle:pathAngle,RadiusSlope:C.radius*C.tailTaper/((meshes.length-1)*C.spacing),DepthSlope:C.tailDepth/((meshes.length-1)*C.spacing),Opacity:fade,TintStrength:C.tintStrength,Saturation:C.saturation,Contrast:C.contrast,Brightness:C.brightness};
      for(const [key,value] of Object.entries(values))u['u'+key].value=value;
      const aspect=mesh.userData.aspect;u.uCrop.value.set(Math.min(1,1.46/aspect),Math.min(1,aspect/1.46));
      if(palette){u.uPaper.value.set(palette.horizon);u.uInk.value.set(palette.ink);}
    }
  }
  return {group,meshes,ready,update,dispose(){geometry.dispose();placeholder.dispose();textures.forEach(t=>t.dispose());meshes.forEach(m=>m.material.dispose());}};
}
