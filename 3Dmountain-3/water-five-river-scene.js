import { createConfluenceMaterial } from './water-confluence-material.js?v=silver-blue-1';
import { createRiverLandscape } from './water-five-river-landscape.js?v=silver-blue-1';

const ease=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10)};
export function createFiveRiverScene(THREE,{lite=false}={}){
  const scene=new THREE.Scene();scene.name='Five independent mountain rivers';scene.background=new THREE.Color('#b5c7d7');
  const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,320);
  // The same daylight atmosphere as the opening water and first-person canyon.
  // Screen-space placement avoids a finite ground-plane edge during the orbit.
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
    depthWrite:false,depthTest:false,
    uniforms:{uTop:{value:new THREE.Color('#c4d2df')},uHorizon:{value:new THREE.Color('#b5c7d7')},uBottom:{value:new THREE.Color('#718b9f')}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}',
    fragmentShader:`varying vec2 vUv;uniform vec3 uTop,uHorizon,uBottom;
      void main(){vec3 top=uTop,horizon=uHorizon,bottom=uBottom;
      vec3 c=mix(bottom,horizon,smoothstep(.02,.56,vUv.y));c=mix(c,top,smoothstep(.56,1.,vUv.y));
      float softbox=exp(-dot((vUv-vec2(.48,.62))*vec2(3.1,2.2),(vUv-vec2(.48,.62))*vec2(3.1,2.2)));
      c+=vec3(.013,.018,.023)*softbox;gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  }));backdrop.frustumCulled=false;backdrop.renderOrder=-100;scene.add(backdrop);
  const landscape=createRiverLandscape(THREE,{lite});scene.add(landscape.group);
  const a=new THREE.Vector3(),b=new THREE.Vector3();
  const streamPoint=(i,t,out)=>landscape.riverPoint(i,t,out);
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
        const w=.38+.065*Math.sin(t*11+i);
        for(let k=0;k<=r.across;k++){const u=k/r.across,offset=(u*2-1)*w,id=(j*(r.across+1)+k)*3;array[id]=a.x+nx*offset;array[id+1]=a.y+ny*offset;if(!r.banksReady)r.bankLift[id/3]=Math.max(0,landscape.heightAt(array[id],array[id+1])+.07-a.z);array[id+2]=a.z+r.bankLift[id/3]+Math.sin(u*Math.PI)*.035;}
      }r.banksReady=true;r.mesh.geometry.attributes.position.needsUpdate=true;
    });
  }
  shapeRivers();
  function update(progress,time=0,reduced=false){
    const p=8+Math.max(0,Math.min(1,progress))*5.8;
    const focus=ease(10.5025,10.8925,p)+ease(11.2175,11.6075,p)+ease(11.9325,12.3225,p)+ease(12.6475,13.0375,p);
    const focusStrength=ease(9.85,10.10,p)*(1-ease(13.5,13.8,p));
    for(let i=0;i<rivers.length;i++){
      const u=rivers[i].mesh.material.uniforms;
      u.uTime.value=reduced?0:time;
      u.uFocus.value=focusStrength*Math.exp(-Math.pow((i-focus)*1.5,2));
      u.uOpacity.value=1;u.uMerge.value=0;
    }
    const lens=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2);
    const fit=Math.max(1,44/(2*lens*camera.aspect*50));
    const drift=(ease(8.0,13.6,p)-.5)*2.2;
    camera.position.set(drift,-38*fit,24*fit);
    camera.up.set(0,0,1);camera.lookAt(0,4,1.8);camera.updateProjectionMatrix();
    landscape.update(1,time,reduced);
  }
  function resize(w,h){camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix()}
  function dispose(){landscape.dispose();for(const r of rivers){r.mesh.geometry.dispose();r.mesh.material.dispose()}backdrop.geometry.dispose();backdrop.material.dispose()}
  update(0);
  return{scene,camera,rivers,landscape,update,resize,dispose,chapter:'五河流動',stats:{riverCount:5,trees:0,particles:0,terrain:landscape.stats}};
}
