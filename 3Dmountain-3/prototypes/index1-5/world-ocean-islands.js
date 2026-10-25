/* Ocean islands: diffuse colour + normal/height atlases baked from the actual alpine valley.
   A single instanced draw. The coast shares the sea's wave field, light, clouds and frame grading. */
import * as THREE from 'three';
const ROWS = [
  [-.65, .29, .42, -.20, 0], [.98, -.48, .54, .22, 1],
  [2.16, .28, .52, -.15, 0], [3.32, -.48, .60, .32, 1],
  [4.50, .30, .55, -.25, 1], [5.78, -.42, .50, .10, 0]
];
export function createOceanIslands({ waterUniforms, gradeGlsl, viewGlsl, waterGlsl, small, reducedMotion, renderer }) {
  const geometry = new THREE.InstancedBufferGeometry(), plane = new THREE.PlaneGeometry(1, 1);
  geometry.index = plane.index;
  geometry.setAttribute('position', plane.attributes.position); geometry.setAttribute('uv', plane.attributes.uv);
  geometry.setAttribute('aPose', new THREE.InstancedBufferAttribute(new Float32Array(ROWS.flatMap(r => r.slice(0, 4))), 4));
  geometry.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(ROWS.map(r => r[4])), 1));
  geometry.instanceCount = ROWS.length;
  const blank = new THREE.DataTexture(new Uint8Array([128, 128, 0, 0]), 1, 1); blank.needsUpdate = true;
  const material = new THREE.ShaderMaterial({
    transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
    uniforms: { ...waterUniforms,
      uIsland: { value: blank }, uIslandForm: { value: blank }, uIslandOn: { value: 0 },
      uIslandLayout: { value: new THREE.Vector2(1, 1) }
    },
    vertexShader: `
      uniform vec2 uRes,uIslandLayout; uniform vec4 uView;
      attribute vec4 aPose; attribute float aTile;
      varying vec2 vUv,vWorld; varying vec3 vMap; varying float vTile;
      void main(){
        float c=cos(aPose.w),s=sin(aPose.w),size=aPose.z*uIslandLayout.y;
        vec2 q=position.xy*size;
        vWorld=aPose.xy*vec2(uIslandLayout.x,1.)+mat2(c,s,-s,c)*q;
        vec2 p=(vWorld-uView.xy)/uView.z;
        gl_Position=vec4(p*vec2(2.*uRes.y/uRes.x,2.),0.,1.);
        vUv=uv;vTile=aTile;vMap=vec3(c,s,size);
      }`,
    fragmentShader: `
      ${viewGlsl}
      ${waterGlsl}
      ${gradeGlsl}
      uniform sampler2D uIsland,uIslandForm; uniform float uIslandOn;
      varying vec2 vUv,vWorld; varying vec3 vMap; varying float vTile;
      vec2 atlasUv(vec2 uv){return vec2((clamp(uv.x,.002,.998)+vTile)*.5,clamp(uv.y,.002,.998));}
      float islandHeight(vec2 uv){return texture2D(uIslandForm,atlasUv(uv)).b;}
      float ridgeShadow(vec2 uv,float height,vec2 toSun){
        // Short height-field rays reveal the actual gullies under the moving sea's sun.
        // Keep a soft penumbra; there is no baked light direction when islands rotate.
        float shade=0.;
        for(int i=1;i<=4;i++){
          float stepSize=float(i)*.022;
          float blocker=islandHeight(uv+toSun*stepSize)-height-stepSize*uSun.z*1.85;
          shade=max(shade,smoothstep(.005,.035,blocker)*(1.-float(i)*.09));
        }
        return shade;
      }
      void main(){
        vec2 screenUv=gl_FragCoord.xy/uRes;
        float displacement,face,crest;
        float reach=waveMask(waveFront((gl_FragCoord.xy-.5*uRes)/uRes.y,displacement,face,crest));
        if(reach<.001||uIslandOn<.001)discard;
        // The passing transition bends the coast by the exact same world displacement as the sea beneath it.
        vec2 shift=-uWaveA.xy*displacement*.35*uView.z;
        vec2 world=vWorld+shift;
        vec2 uv=vUv+mat2(vMap.x,-vMap.y,vMap.y,vMap.x)*shift/vMap.z;
        vec2 at=atlasUv(uv);vec4 t=texture2D(uIsland,at);
        if(t.a<.003)discard;
        vec3 form=texture2D(uIslandForm,at).rgb;
        vec2 normalXY=(form.rg-.5)*2.;
        normalXY=mat2(vMap.x,vMap.y,-vMap.y,vMap.x)*normalXY;
        vec3 landN=normalize(vec3(normalXY,sqrt(max(.025,1.-dot(normalXY,normalXY)))));
        // Native alpine mineral colour and detailed erosion normals. Warm rock
        // ridges / cool sheltered gullies, with the same single sun as the sea.
        vec3 albedo=mix(t.rgb,vec3(dot(t.rgb,vec3(.3,.59,.11))),.12);
        vec3 key=mix(vec3(1.08,1.01,.91),uGlintCol,.30);
        float facing=max(dot(landN,uSun),0.);
        vec2 localSun=mat2(vMap.x,-vMap.y,vMap.y,vMap.x)*uSun.xy;
        float shelter=ridgeShadow(uv,form.b,localSun);
        vec3 rock=albedo*(uAmbientTint+key*facing*.82*uSunEnergy*(1.-shelter*.72));
        rock=mix(rock,uFarCol,.025*(1.-form.b));
        float distance=(t.a-.5)*48.;
        vec3 result;
        if(distance>10.){
          rock*=1.-oceanCloudShadow(world,uView.z)*.55;
          result=oceanFrame(rock,screenUv);
        }else{
          vec3 waterN;float d,shadow,swell;
          readOceanSurface(world,uView.z,waterN,d,shadow,swell);
          float coast=distance-swell*15.;
          float aa=max(.55,fwidth(distance)*1.05);
          float land=smoothstep(-aa,aa,coast);
          float wet=(1.-smoothstep(1.,8.,max(coast,0.)))*land;
          rock=mix(rock,rock*.82+uDeep*.05,wet*.68);
          rock*=1.-shadow*.55;
          rock=oceanFrame(rock,screenUv);
          // A depth continuum, with the actual swell still visible through the shallow water.
          float shallow=(1.-smoothstep(1.,23.,max(-distance,0.)))*(1.-land);
          vec3 water=mix(oceanBase(d),mix(uDeep,uLit,.64),shallow*.30);
          // A soft submerged rock shelf anchors the coast into the water.
          water*=1.-shelter*.16*shallow;
          float broken=texture2D(uNoise,world*3.4+vec2(uView.w*.002,0.)).b;
          vec2 inward=normalize(vec2(dFdx(distance),dFdy(distance))+vec2(.00001));
          float windward=.25+.75*max(dot(inward,uSeaWind),0.);
          float foam=(1.-smoothstep(1.,4.,abs(coast+1.4)))*smoothstep(-.055,.065,swell)
                    *smoothstep(.32,.59,broken)*windward*.40;
          water=mix(water,uFoam*.86,foam);
          water=finishOceanSurface(water,waterN,shadow,mix(1.,.62,shallow),world,uView.z,screenUv);
          result=mix(water,rock,land);
        }
        float alpha=smoothstep(.0,.13,t.a)*reach*uIslandOn;
        result=fiGrade(clamp(result,0.,1.));
        gl_FragColor=vec4(result*alpha,alpha);
      }`
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Six alpine valley islands · shared ocean shore'; mesh.frustumCulled = false; mesh.renderOrder = 4.5; mesh.visible = false;
  let disposed = false, textures = null, pending = null;
  function load() {
    if (pending) return pending;
    const loader = new THREE.TextureLoader();
    const suffix = small ? '-small.webp' : '.webp';
    pending = Promise.all(['valley-islands-albedo-v3', 'valley-islands-form-v3'].map(name =>
      loader.loadAsync(new URL('../assets/ocean/' + name + suffix, import.meta.url).href))).then(loaded => {
      if (disposed) { loaded.forEach(t => t.dispose()); return; }
      textures = loaded;
      for (const texture of textures) {
        texture.colorSpace = THREE.NoColorSpace; texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = small ? 1 : 2; renderer.initTexture(texture);
      }
      material.uniforms.uIsland.value = textures[0]; material.uniforms.uIslandForm.value = textures[1];
      material.uniforms.uIslandOn.value = 1;
    }).catch(error => { console.warn('Ocean island atlases could not load:', error); });
    return pending;
  }
  return { mesh, load,
    update({ visible, alpha, aspect }) {
      mesh.visible = visible && !!textures;
      material.uniforms.uIslandLayout.value.set(aspect / 1.6, Math.min(1, Math.max(.62, aspect / 1.5)));
      material.uniforms.uIslandOn.value = textures ? alpha : 0;
    },
    get state() { return { ready: !!textures, instances: ROWS.length, triangles: ROWS.length * 2, drawCalls: 1, textures: 2 }; },
    dispose() { disposed = true; textures?.forEach(t => t.dispose()); blank.dispose(); material.dispose(); geometry.dispose(); }
  };
}
