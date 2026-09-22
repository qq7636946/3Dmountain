/** Optical glass adapted from index.html: spectral scene refraction, cast relief,
 * world/studio reflections, and restrained frozen inclusions. */
export const REFERENCE_LOGO_GLASS = {
  iorA:1.52, iorDelta:.16, iridescence:.12, sceneDepth:3.05,
  normalScale:.32, uvScale:.9500000000000001, sceneMix:.68, reflectionStrength:1.55,
  fresnelPower:2.7, reflectFloor:.2, envRoughness:.06, tint:'#dfe8f2',
  mirrorSea:.62, envSky:.88, envStudio:.26, sunSpec:.7, sunPow:320,
  sunDisc:1.1, samples:8, frostBlur:.006, iridPatch:.1,
  tiles:0, swell:1.2000000000000002, grain:.14, reliefScale:1,
  bubble:.14, bubbleScale:26, bubbleSize:.26, cloud:.11,
  frost:.16, frostFine:.14, frostScale:78, rim:.15, rimPow:5.5,
  rough:.065, shade:.78, shadeColor:'#26303f', sss:.09,
  sssColor:'#e2ecf8', graze:.12, specCap:.95
};
const NOISE_GLSL = /* glsl */`
  float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  vec3 hash33(vec3 p){
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
  }
  float noise2(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x), mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), f.x), f.y);
  }
  float fbm2(vec2 p){
    float v = 0., a = .5;
    for (int i = 0; i < 5; i++) { v += a * noise2(p); p = p * 2.03 + vec2(17.1, 9.7); a *= .5; }
    return v;
  }
  float hash31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
  float noise3(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1., 0., 0.)), f.x), mix(hash31(i + vec3(0., 1., 0.)), hash31(i + vec3(1., 1., 0.)), f.x), f.y),
      mix(mix(hash31(i + vec3(0., 0., 1.)), hash31(i + vec3(1., 0., 1.)), f.x), mix(hash31(i + vec3(0., 1., 1.)), hash31(i + vec3(1., 1., 1.)), f.x), f.y),
      f.z);
  }
  vec2 voronoi3(vec3 p){
    vec3 i = floor(p), f = fract(p);
    float f1 = 8., f2 = 8.;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 o = hash33(i + g);
      vec3 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
    return vec2(sqrt(f1), sqrt(f2));
  }
  /* The seed point of the nearest voronoi cell, for per-cell values. */
  vec3 voronoiCell(vec3 p){
    vec3 i = floor(p), f = fract(p);
    float f1 = 8.; vec3 id = vec3(0.);
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 o = hash33(i + g);
      vec3 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f1 = d; id = i + g + o; }
    }
    return id;
  }
`;


export function createReferenceLogoGlass(THREE, {renderer, config}) {
  const RK=config;
function jsHash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function jsNoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(jsHash(ix, iy, iz), jsHash(ix + 1, iy, iz), fx), l(jsHash(ix, iy + 1, iz), jsHash(ix + 1, iy + 1, iz), fx), fy),
    l(l(jsHash(ix, iy, iz + 1), jsHash(ix + 1, iy, iz + 1), fx), l(jsHash(ix, iy + 1, iz + 1), jsHash(ix + 1, iy + 1, iz + 1), fx), fy),
    fz);
}

function jsFbm(x, y, z, oct = 4) {
  let v = 0, a = .5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * jsNoise(x * f + 3.1, y * f + 7.7, z * f + 1.3); f *= 2.02; a *= .5; }
  return v;
}

function wavelengthRGB(l) {
  let r = 0, g = 0, b = 0;
  if (l < 440) { r = -(l - 440) / 60; b = 1; }
  else if (l < 490) { g = (l - 440) / 50; b = 1; }
  else if (l < 510) { g = 1; b = -(l - 510) / 20; }
  else if (l < 580) { r = (l - 510) / 70; g = 1; }
  else if (l < 645) { r = 1; g = -(l - 645) / 65; }
  else { r = 1; }
  let f = 1;
  if (l < 420) f = .3 + .7 * (l - 380) / 40; else if (l > 680) f = .3 + .7 * (700 - l) / 20;
  return [r * f, g * f, b * f];
}

function spectrumTexture() {
  const w = 1024, data = new Uint8Array(w * 2 * 4);
  for (let i = 0; i < w; i++) {
    const x = i / (w - 1);
    const c = wavelengthRGB(380 + x * 320);
    data[i * 4] = c[0] * 255; data[i * 4 + 1] = c[1] * 255; data[i * 4 + 2] = c[2] * 255; data[i * 4 + 3] = 255;
    /* Thin film: a soft hue cycle, pale, brightest at grazing angles. */
    const o = (w + i) * 4, ph = x * 4.2 + 1.2;
    data[o] = (.66 + .2 * Math.cos(ph)) * 255;
    data[o + 1] = (.76 + .18 * Math.cos(ph + 2.1)) * 255;
    data[o + 2] = (.86 + .14 * Math.cos(ph + 4.2)) * 255;
    data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, 2);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

function stoneNormalTexture(size = 512) {
  /* How many times the pattern repeats across the map: bigger is a
     finer, busier relief, smaller is broad slabs. */
  const tiles = Math.max(1, Math.round(6 * RK.reliefScale));
  const hash2 = (x, y, k) => { const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
  const h = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const px = i / size * tiles, py = j / size * tiles;
    const ix = Math.floor(px), iy = Math.floor(py);
    let f1 = 9, f2 = 9;
    for (let gy = -1; gy <= 1; gy++) for (let gx = -1; gx <= 1; gx++) {
      const cx = ((ix + gx) % tiles + tiles) % tiles, cy = ((iy + gy) % tiles + tiles) % tiles;
      const dx = ix + gx + hash2(cx, cy, 1) - px, dy = iy + gy + hash2(cx, cy, 2) - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const bevel = Math.min(1, (f2 - f1) / .09);
    const grain = jsFbm(px * 5.3, py * 5.3, 1.7, 3) - .5;
    const swell = jsFbm(px * .55, py * .55, 2.9, 3) - .5;
    h[j * size + i] = bevel * (.7 + .3 * hash2(ix, iy, 3)) * .8 * RK.tiles + grain * RK.grain + (jsNoise(px * 1.7, py * 1.7, 4.2) - .5) * .2 + swell * RK.swell;
  }
  const data = new Uint8Array(size * size * 4), k = 2.4 * size / 64;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const l = h[j * size + ((i - 1 + size) % size)], r = h[j * size + ((i + 1) % size)];
    const u = h[((j - 1 + size) % size) * size + i], d = h[((j + 1) % size) * size + i];
    let nx = -(r - l) * k, ny = -(d - u) * k, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const o = (j * size + i) * 4;
    data[o] = (nx * .5 + .5) * 255; data[o + 1] = (ny * .5 + .5) * 255; data[o + 2] = (nz * .5 + .5) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function studioScene() {
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x070708, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, lum) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(lum * .96, lum, lum * 1.06), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m);
  };
  panel(7, 4.5, -6, 6, 5, 5.0);     /* key: a big softbox, high and left */
  panel(1.6, 9, 9, 1, -3, 4.0);     /* rim: a tall strip on the right */
  panel(3.5, 3.5, -9, -1.5, -1, 1.2); /* fill */
  panel(10, 1.2, 0.5, 9.5, -2, 2.5);  /* a strip overhead */
  panel(9, .6, 0, -1.2, 10, .9);     /* a low band behind the camera */
  panel(14, 14, 0, -11.5, 0, .06);   /* floor bounce */
  return sc;
}

  const spectrum=spectrumTexture();
  let normalMap=stoneNormalTexture();
  const cube=new THREE.WebGLCubeRenderTarget(256,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const room=studioScene(),captureCamera=new THREE.CubeCamera(.1,100,cube);
  const previousTone=renderer.toneMapping,previousTarget=renderer.getRenderTarget();
  try{renderer.toneMapping=THREE.NoToneMapping;captureCamera.update(renderer,room);}
  finally{renderer.toneMapping=previousTone;renderer.setRenderTarget(previousTarget);}
  room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  const target=new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType,depthBuffer:true});
  target.texture.name='Logo refraction backdrop';
  const floatKeys={uIorA:'iorA',uIorDelta:'iorDelta',uIrid:'iridescence',uSceneDepth:'sceneDepth',uNormalScale:'normalScale',uUvScale:'uvScale',uSceneMix:'sceneMix',uReflStr:'reflectionStrength',uFresnelPow:'fresnelPower',uReflFloor:'reflectFloor',uEnvRough:'envRoughness',uEnvSky:'envSky',uEnvStudio:'envStudio',uSunSpec:'sunSpec',uSunPow:'sunPow',uSunDisc:'sunDisc',uFrostBlur:'frostBlur',uIridPatch:'iridPatch',uBubble:'bubble',uBubbleScale:'bubbleScale',uBubbleSize:'bubbleSize',uCloud:'cloud',uFrost:'frost',uFrostFine:'frostFine',uFrostScale:'frostScale',uRim:'rim',uRimPow:'rimPow',uRough:'rough',uShade:'shade',uSSS:'sss',uGraze:'graze',uSpecCap:'specCap'};
  const uniforms={
    uBackdrop:{value:target.texture},uSpectrum:{value:spectrum},uNormalMap:{value:normalMap},uEnv:{value:cube.texture},
    uProjView:{value:new THREE.Matrix4()},uCam:{value:new THREE.Vector3()},uOpacity:{value:1},
    uTint:{value:new THREE.Color(config.tint)},uShadeColor:{value:new THREE.Color(config.shadeColor)},uSSSColor:{value:new THREE.Color(config.sssColor)},
    uSkyTop:{value:new THREE.Color()},uSkyLow:{value:new THREE.Color()},uSeaNear:{value:new THREE.Color()},uSeaFar:{value:new THREE.Color()},
    uSunDir:{value:new THREE.Vector3(-.35,.28,-.9).normalize()},uSunCol:{value:new THREE.Color('#ffffff')}
  };
  for(const [uniform,key] of Object.entries(floatKeys))uniforms[uniform]={value:config[key]};
  const material=new THREE.ShaderMaterial({
    name:'Logo · index optical glass',uniforms,transparent:true,depthWrite:true,
    defines:{SAMPLES:Math.round(config.samples)},
    vertexShader:/* glsl */`
      varying vec3 vWorld,vNormal,vObj;
      varying vec2 vUv;
      void main(){
        vObj=position*2.4; vUv=uv;
        vec4 w=modelMatrix*vec4(position,1.);
        vWorld=w.xyz; vNormal=mat3(modelMatrix)*normal;
        gl_Position=projectionMatrix*viewMatrix*w;
      }
    `,
    fragmentShader:NOISE_GLSL+/* glsl */`
      uniform sampler2D uBackdrop,uSpectrum,uNormalMap;
      uniform samplerCube uEnv;
      uniform mat4 uProjView;
      uniform vec3 uCam,uTint,uShadeColor,uSSSColor,uSkyTop,uSkyLow,uSeaNear,uSeaFar,uSunDir,uSunCol;
      uniform float uIorA,uIorDelta,uIrid,uSceneDepth,uNormalScale,uUvScale,uSceneMix,uReflStr,uFresnelPow,uReflFloor,uEnvRough,uEnvSky,uEnvStudio,uSunSpec,uSunPow,uSunDisc;
      uniform float uFrostBlur,uIridPatch,uBubble,uBubbleScale,uBubbleSize,uCloud,uFrost,uFrostFine,uFrostScale,uRim,uRimPow,uRough,uShade,uSSS,uGraze,uSpecCap,uOpacity;
      varying vec3 vWorld,vNormal,vObj;
      varying vec2 vUv;
      vec3 perturb(vec3 P,vec3 N,vec3 mapN,vec2 uv){
        vec3 q0=dFdx(P),q1=dFdy(P);vec2 st0=dFdx(uv),st1=dFdy(uv);
        vec3 q1perp=cross(q1,N),q0perp=cross(N,q0);
        vec3 T=q1perp*st0.x+q0perp*st1.x,B=q1perp*st0.y+q0perp*st1.y;
        float det=max(dot(T,T),dot(B,B));float sc=det==0.?0.:inversesqrt(det);
        return normalize(T*(mapN.x*sc)+B*(mapN.y*sc)+N*mapN.z);
      }
      vec2 toScreen(vec3 p){vec4 c=uProjView*vec4(p,1.);return c.xy/max(c.w,.001)*.5+.5;}
      vec3 worldEnv(vec3 R){
        float h=clamp(R.y,-1.,1.);
        vec3 sky=mix(uSkyLow,uSkyTop,pow(max(h,0.),.55));
        vec3 sea=mix(uSeaNear,uSeaFar,pow(max(-h,0.),.45));
        return mix(sea,sky,smoothstep(-.02,.02,h))+uSunCol*pow(max(dot(R,uSunDir),0.),900.)*uSunDisc;
      }
      void main(){
        vec2 uv=vUv*uUvScale;
        vec3 Ng=normalize(vNormal);if(!gl_FrontFacing)Ng=-Ng;
        vec3 mapN=texture2D(uNormalMap,uv).xyz*2.-1.;mapN.xy*=uNormalScale;
        vec3 N=perturb(vWorld,Ng,mapN,uv),V=normalize(vWorld-uCam);
        vec3 rA=refract(V,N,1./uIorA),rB=refract(V,N,1./(uIorA+uIorDelta));
        vec2 uvA=toScreen(vWorld+rA*uSceneDepth),uvB=toScreen(vWorld+rB*uSceneDepth);
        float jit=fract(52.9829189*fract(.06711056*gl_FragCoord.x+.00583715*gl_FragCoord.y));
        float stp=1./float(SAMPLES),n=jit*stp;vec3 acc=vec3(0.),wsum=vec3(0.);
        for(int i=0;i<SAMPLES;i++){
          vec3 w=texture2D(uSpectrum,vec2(1.-n,.25)).rgb;
          float h1=fract(sin(dot(gl_FragCoord.xy+float(i)*13.7,vec2(12.9898,78.233)))*43758.5453);
          float h2=fract(sin(dot(gl_FragCoord.xy+float(i)*7.3,vec2(39.3468,11.135)))*24634.6345);
          float a=h1*6.28318,rad=sqrt(h2)*uFrostBlur*(.35+.65*uRough);
          vec2 scat=vec2(cos(a),sin(a))*rad;
          acc+=texture2D(uBackdrop,clamp(mix(uvA,uvB,n)+scat,vec2(.001),vec2(.999))).rgb*w;wsum+=w;n+=stp;
        }
        vec3 through=acc/max(wsum,vec3(.001))*uTint;
        float patchNoise=noise3(vec3(vObj.xy*5.2,1.7))*.7+noise3(vec3(vObj.xy*13.1,4.3))*.3;
        vec3 film2=texture2D(uSpectrum,vec2(patchNoise,.75)).rgb;
        through=mix(through,through*film2*1.25,uIridPatch);
        vec3 lit=uTint*(.6+.4*max(0.,dot(N,normalize(vec3(-.32,1.,.45)))));
        vec3 color=mix(lit,through,uSceneMix);
        color=mix(color,uTint*.85,uRough*.35);
        float NdV=clamp(dot(N,-V),0.,1.);
        color+=uSSSColor*min(pow(1.-NdV,3.1)*uSSS,uSpecCap*.55);
        color=mix(color,color*uShadeColor,pow(1.-NdV,1.5)*uShade);
        float veil=noise3(vObj*2.1)*.6+noise3(vObj*5.3+9.)*.4;
        color=mix(color,uTint*.72,smoothstep(.34,.88,veil)*uCloud);
        float drift=smoothstep(.36,.74,noise3(vObj*3.4+21.));
        if(uBubble>.001&&drift>.002){
          vec2 cellv=voronoi3(vObj*uBubbleScale);
          float core=1.-smoothstep(0.,uBubbleSize,cellv.x);
          float shell=smoothstep(uBubbleSize*.55,uBubbleSize,cellv.x)*(1.-smoothstep(uBubbleSize,uBubbleSize*1.5,cellv.x));
          color+=(vec3(.9,.95,1.)*core*core*.55+vec3(1.)*shell*.3)*uBubble*drift;
          color=mix(color,color*.78,core*core*.35*uBubble*drift);
        }
        float grainF=noise3(vObj*34.)*.55+noise3(vObj*71.+5.)*.45;
        color=mix(color,uTint*1.12,smoothstep(.55,.95,grainF)*uFrost);
        float crust=noise3(vObj*uFrostScale)*.6+noise3(vObj*uFrostScale*2.1+13.)*.4;
        color=mix(color,uTint*1.16,smoothstep(.52,.88,crust)*uFrostFine);
        float fres=clamp(uReflFloor+(1.-uReflFloor)*pow(1.-NdV,uFresnelPow),0.,1.);
        float grazeFade=smoothstep(0.,uGraze,NdV);
        vec3 R=reflect(V,N);
        vec3 envRoom=textureCubeLodEXT(uEnv,R,mix(uEnvRough*8.,5.5,uRough)).rgb;
        vec3 env=worldEnv(R)*uEnvSky+envRoom*uEnvStudio;
        vec3 film=texture2D(uSpectrum,vec2(NdV,.75)).rgb;
        float iriMask=pow(1.-NdV,3.)*(.65+.35*noise3(vObj*11.));
        vec3 mirror=env*mix(vec3(1.),film,clamp(uIrid*iriMask,0.,1.));
        color=mix(color,mirror,fres*grazeFade);
        vec3 spec=mirror*max(uReflStr-1.,0.)*fres*grazeFade;
        spec+=vec3(.94,.97,1.)*pow(1.-NdV,uRimPow)*uRim*grazeFade;
        vec3 H=normalize(uSunDir-V);
        spec+=uSunCol*pow(max(dot(N,H),0.),uSunPow)*uSunSpec*grazeFade;
        color+=min(spec,vec3(uSpecCap));
        gl_FragColor=vec4(color,uOpacity);
      }
    `
  });
  let reliefKey=[config.tiles,config.swell,config.grain,config.reliefScale].join('|'),pendingKey=reliefKey,rebakeAt=0;
  function update({palette,opacity=1}={}){
    for(const [uniform,key] of Object.entries(floatKeys))uniforms[uniform].value=config[key];
    for(const [uniform,key] of [['uTint','tint'],['uShadeColor','shadeColor'],['uSSSColor','sssColor']])uniforms[uniform].value.set(config[key]);
    uniforms.uOpacity.value=opacity;
    if(palette){
      uniforms.uSkyTop.value.set(palette.top);uniforms.uSkyLow.value.set(palette.horizon);
      uniforms.uSeaNear.value.set(palette.lower).multiplyScalar(config.mirrorSea);
      uniforms.uSeaFar.value.set(palette.ink).multiplyScalar(config.mirrorSea);
    }
    const samples=THREE.MathUtils.clamp(Math.round(config.samples),4,12);
    if(material.defines.SAMPLES!==samples){material.defines.SAMPLES=samples;material.needsUpdate=true;}
    const key=[config.tiles,config.swell,config.grain,config.reliefScale].join('|');
    if(key!==pendingKey){pendingKey=key;rebakeAt=performance.now()+220;}
    if(key!==reliefKey&&performance.now()>=rebakeAt){
      const old=normalMap;normalMap=stoneNormalTexture();uniforms.uNormalMap.value=normalMap;old.dispose();reliefKey=key;
    }
  }
  function capture(scene,camera,logoSpin){
    camera.updateMatrixWorld();uniforms.uCam.value.copy(camera.position);
    uniforms.uProjView.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    const previous=renderer.getRenderTarget(),visible=logoSpin.visible;
    try{logoSpin.visible=false;renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);}
    finally{logoSpin.visible=visible;renderer.setRenderTarget(previous);}
  }
  function resize(width,height,dpr=1){
    const scale=Math.min(1.15,dpr)*Math.min(1,1440/width);
    target.setSize(Math.max(2,Math.round(width*scale)),Math.max(2,Math.round(height*scale)));
  }
  return {material,uniforms,target,update,capture,resize,dispose(){normalMap.dispose();spectrum.dispose();cube.dispose();target.dispose();material.dispose();}};
}
