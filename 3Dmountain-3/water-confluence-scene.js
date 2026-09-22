import { createConfluenceMaterial } from './water-confluence-material.js?v=silver-blue-1';
import { createRiverLandscape } from './water-five-river-landscape.js?v=silver-blue-1';
import { createLogoFormation } from './water-logo-formation.js?v=silver-blue-1';

const ease=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10)};
const fract=x=>x-Math.floor(x);
export function createConfluenceScene(THREE,{lite=false}={}){
  const scene=new THREE.Scene();scene.name='Five mountain rivers · One identity';scene.background=new THREE.Color('#b5c7d7');
  const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,320);
  // One daylight atmosphere follows the opening water through to the mark.
  // Screen-space placement avoids a finite ground-plane edge during the orbit.
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
    depthWrite:false,depthTest:false,
    uniforms:{uGather:{value:0},uTop:{value:new THREE.Color('#c4d2df')},uHorizon:{value:new THREE.Color('#b5c7d7')},uBottom:{value:new THREE.Color('#718b9f')},uEndTop:{value:new THREE.Color('#a6bacb')},uEndHorizon:{value:new THREE.Color('#819bb1')},uEndBottom:{value:new THREE.Color('#405c72')}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float uGather;uniform vec3 uTop,uHorizon,uBottom,uEndTop,uEndHorizon,uEndBottom;
      void main(){vec3 top=mix(uTop,uEndTop,uGather),horizon=mix(uHorizon,uEndHorizon,uGather),bottom=mix(uBottom,uEndBottom,uGather);
      vec3 c=mix(bottom,horizon,smoothstep(.02,.56,vUv.y));c=mix(c,top,smoothstep(.56,1.,vUv.y));
      float softbox=exp(-dot((vUv-vec2(.48,.62))*vec2(3.1,2.2),(vUv-vec2(.48,.62))*vec2(3.1,2.2)));
      c+=vec3(.013,.018,.023)*softbox;gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  }));backdrop.frustumCulled=false;backdrop.renderOrder=-100;scene.add(backdrop);
  const landscape=createRiverLandscape(THREE,{lite});scene.add(landscape.group);
  let merge=0,collapse=0,logoMorph=0,logo=null,lastShape=-1,lastP=8;
  const a=new THREE.Vector3(),b=new THREE.Vector3();
  function streamPoint(i,t,out){
    landscape.riverPoint(i,t,out);
    const x=out.x,y=out.y,z=out.z;
    const angle=i*Math.PI*2/5+.38+t*1.9;
    const radius=(8.8*Math.pow(1-t,.83)+.08)*(1-collapse*.76);
    return out.set(THREE.MathUtils.lerp(x,Math.cos(angle)*radius,merge),THREE.MathUtils.lerp(y,Math.sin(angle)*radius*.82+.70,merge),THREE.MathUtils.lerp(z,Math.sin(angle)*.25*(1-t),merge)+Math.sin(merge*Math.PI)*2.4);
  }
  const rivers=[];
  for(let i=0;i<5;i++){
    const segments=lite?250:420,across=8,positions=new Float32Array((segments+1)*(across+1)*3),uvs=new Float32Array((segments+1)*(across+1)*2),indices=[];
    for(let j=0;j<=segments;j++)for(let k=0;k<=across;k++){const id=j*(across+1)+k;uvs[id*2]=k/across;uvs[id*2+1]=j/segments;if(j<segments&&k<across){const q=id+across+1;indices.push(id,id+1,q,id+1,q+1,q)}}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(indices);
    const material=createConfluenceMaterial(THREE,{index:i});material.side=THREE.DoubleSide;
    const mesh=new THREE.Mesh(geometry,material);mesh.name='Independent watercourse '+(i+1);mesh.frustumCulled=false;scene.add(mesh);rivers.push({mesh,segments,across,bankLift:new Float32Array((segments+1)*(across+1)),banksReady:false});
  }
  function shapeRivers(){
    rivers.forEach((r,i)=>{const array=r.mesh.geometry.attributes.position.array;
      for(let j=0;j<=r.segments;j++){
        const t=j/r.segments;streamPoint(i,t,a);streamPoint(i,Math.min(1,t+.001),b);if(t===1){streamPoint(i,t-.001,b);b.sub(a).multiplyScalar(-1)}else b.sub(a);
        const n=Math.max(.0001,Math.hypot(b.x,b.y)),nx=-b.y/n,ny=b.x/n;
        const w=(.38+.065*Math.sin(t*11+i))*(1-collapse*.60);
        for(let k=0;k<=r.across;k++){const u=k/r.across,offset=(u*2-1)*w,id=(j*(r.across+1)+k)*3;array[id]=a.x+nx*offset;array[id+1]=a.y+ny*offset;if(!r.banksReady)r.bankLift[id/3]=Math.max(0,landscape.heightAt(array[id],array[id+1])+.07-a.z);array[id+2]=a.z+r.bankLift[id/3]*(1-merge)+Math.sin(u*Math.PI)*.035;}
      }r.banksReady=true;r.mesh.geometry.attributes.position.needsUpdate=true;
    });
  }
  shapeRivers();
  const count=lite?3600:7200,positions=new Float32Array(count*3),sizes=new Float32Array(count),phases=new Float32Array(count);
  for(let i=0;i<count;i++){sizes[i]=.6+fract(Math.sin(i*127.1+3)*43758.54)*.7;phases[i]=fract(Math.sin(i*311.7+9)*31457.97)}
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));particleGeo.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));particleGeo.setAttribute('aPhase',new THREE.BufferAttribute(phases,1));
  const particleMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.NormalBlending,uniforms:{uOpacity:{value:0},uDpr:{value:Math.min(devicePixelRatio,1.65)}},vertexShader:'attribute float aSize,aPhase;uniform float uDpr;varying float vTone;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*uDpr*1.7*sqrt(15./max(2.,-mv.z)),.7,3.4);vTone=aPhase;gl_Position=projectionMatrix*mv;}',fragmentShader:'uniform float uOpacity;varying float vTone;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float a=pow(1.-r*r,1.4)*uOpacity;gl_FragColor=vec4(mix(vec3(.10,.25,.35),vec3(.58,.74,.83),vTone),a);}'});
  const particles=new THREE.Points(particleGeo,particleMaterial);particles.frustumCulled=false;particles.renderOrder=5;particles.visible=false;scene.add(particles);
  const ready=createLogoFormation(THREE,{url:'./logo.svg',particleCount:count}).then(result=>{logo=result;logo.group.position.y=.70;scene.add(logo.group);return result});
  function update(progress,time=0,reduced=false){
    const p=8+Math.max(0,Math.min(1,progress))*10;lastP=p;
    merge=ease(13.82,15.12,p);collapse=ease(15.05,16.25,p);logoMorph=ease(15.12,16.62,p);
    const shape=merge+collapse*2;if(Math.abs(shape-lastShape)>.000002){shapeRivers();lastShape=shape}
    const focus=ease(10.5025,10.8925,p)+ease(11.2175,11.6075,p)+ease(11.9325,12.3225,p)+ease(12.6475,13.0375,p);
    const focusStrength=ease(9.85,10.10,p)*(1-ease(13.5,13.85,p));
    const tail=1-ease(15.75,16.65,p);
    rivers.forEach((r,i)=>{const u=r.mesh.material.uniforms;u.uTime.value=reduced?0:time;u.uFocus.value=focusStrength*Math.exp(-Math.pow((i-focus)*1.5,2));u.uMerge.value=merge;u.uOpacity.value=tail;r.mesh.material.depthTest=merge<.012;r.mesh.visible=tail>.001});
    // Read all five valleys from an oblique mountain view. Only after the
    // rivers gather does the camera turn to face the logo's XY plane.
    const lens=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2);
    const fit=Math.max(1,44/(2*lens*camera.aspect*50));
    const endZ=Math.max(11.3/(2*lens),5.8/(2*lens*camera.aspect)),settle=ease(13.82,16.85,p);
    const drift=(ease(8.0,13.6,p)-.5)*2.2;
    camera.position.set(drift*(1-settle),THREE.MathUtils.lerp(-38*fit,.2,settle),THREE.MathUtils.lerp(24*fit,endZ,settle));
    camera.up.set(0,settle,1-settle).normalize();camera.lookAt(0,THREE.MathUtils.lerp(4,.2,settle),1.8*(1-settle));camera.updateProjectionMatrix();
    landscape.update(1-ease(13.82,14.98,p),time,reduced);
    backdrop.material.uniforms.uGather.value=ease(13.82,17.12,p);
    const particleFade=ease(14.50,15.1,p)*(1-ease(16.6,17.10,p));particles.visible=!!logo&&particleFade>.001;particleMaterial.uniforms.uOpacity.value=particleFade*.85;
    if(particles.visible){
      for(let j=0;j<count;j++){
        const i=j%5,t=fract(phases[j]+(reduced?0:time*.04*(1-logoMorph))),delay=phases[j]*.12,m=ease(delay,1,logoMorph);
        streamPoint(i,t,a);const j3=j*3,targetX=logo.targets[j3],targetY=logo.targets[j3+1]+.70,targetZ=logo.targets[j3+2];
        const turn=Math.sin(m*Math.PI)*.18;positions[j3]=THREE.MathUtils.lerp(a.x,targetX,m)+Math.sin(phases[j]*19)*turn;positions[j3+1]=THREE.MathUtils.lerp(a.y,targetY,m)+Math.cos(phases[j]*17)*turn;positions[j3+2]=THREE.MathUtils.lerp(a.z,targetZ,m)+Math.sin(phases[j]*23)*turn;
      }particleGeo.attributes.position.needsUpdate=true;
    }
    if(logo)logo.update(ease(15.88,17.12,p),time,reduced);
  }
  function resize(w,h){camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();particleMaterial.uniforms.uDpr.value=Math.min(devicePixelRatio,1.65)}
  function dispose(){landscape.dispose();for(const r of rivers){r.mesh.geometry.dispose();r.mesh.material.dispose()}particleGeo.dispose();particleMaterial.dispose();backdrop.geometry.dispose();backdrop.material.dispose();logo?.dispose()}
  update(0);return{scene,camera,rivers,landscape,update,resize,ready,dispose,get logo(){return logo},get chapter(){return lastP<13.82?'五河流動':lastP<16.8?'匯流成形':'FINNOVATION'},stats:{riverCount:5,trees:0,particles:count,terrain:landscape.stats}};
}
