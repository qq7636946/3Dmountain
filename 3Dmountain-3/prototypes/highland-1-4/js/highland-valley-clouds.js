/* Thin, depth-tested valley cloud banks, one instanced draw; no full-screen ray march. */
export function createValleyClouds(THREE, { lite = false } = {}) {
  const group = new THREE.Group(); group.name = 'alpine-valley-clouds';
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index; geometry.attributes = base.attributes;
  const positions = [
    [-3200,900,-2100,1800,220],[-1600,1050,-1100,2300,240],[300,900,-700,1700,220],
    [2100,1150,-1800,1900,260],[3000,1200,400,2200,290],[-2700,1200,1300,2000,320],
    [-900,1300,2000,2600,300],[1600,1150,1300,1900,260],[2800,1450,2300,2100,250],
    [-1700,160,-700,1400,160],[1400,210,-900,1400,180],[-1600,230,-2200,1100,170],
    [1300,260,-2300,1100,180],[200,210,800,1400,140],[-3100,580,7100,2200,300],
    [500,520,4300,1400,220]
  ];
  const selected = lite ? positions.filter((_,i) => i % 2 === 0) : positions;
  geometry.instanceCount = selected.length;
  geometry.setAttribute('aCloud',new THREE.InstancedBufferAttribute(new Float32Array(selected.flatMap(p=>p.slice(0,4))),4));
  geometry.setAttribute('aShape',new THREE.InstancedBufferAttribute(new Float32Array(selected.flatMap((p,i)=>[p[4],i*3.17])),2));
  const uniforms = { uTime:{value:0}, uFade:{value:0}, uRight:{value:new THREE.Vector3(1,0,0)},uUp:{value:new THREE.Vector3(0,1,0)},uHaze:{value:new THREE.Color('#b8c8d3')},uFog:{value:.0001} };
  const material = new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,uniforms,
    vertexShader:`attribute vec4 aCloud; attribute vec2 aShape; uniform vec3 uRight,uUp; uniform float uTime;
      varying vec2 vUv; varying float vSeed,vDistance;
      void main(){vUv=uv;vSeed=aShape.y;
        vec3 center=aCloud.xyz; center.x+=sin(uTime*.018+aShape.y)*60.; center.z+=cos(uTime*.012+aShape.y)*30.;
        vec3 world=center+uRight*position.x*aCloud.w+uUp*position.y*aShape.x;
        vec4 view=modelViewMatrix*vec4(world,1.);vDistance=-view.z;gl_Position=projectionMatrix*view;}`,
    fragmentShader:`uniform float uTime,uFade,uFog;uniform vec3 uHaze; varying vec2 vUv; varying float vSeed,vDistance;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      float fbm(vec2 p){return noise(p)*.57+noise(p*2.03+7.1)*.28+noise(p*4.13+3.3)*.15;}
      void main(){vec2 p=vUv*2.-1.;vec2 flow=vec2(uTime*.009,vSeed);
        float n=fbm(vUv*vec2(5.5,3.5)+flow);
        float body=1.-smoothstep(.24,1.,length(p*vec2(.95,1.15))+(.5-n)*.58);
        float wisps=smoothstep(.24,.68,fbm(vUv*vec2(9.,4.)+flow*.8+5.));
        float a=body*mix(.25,.86,wisps)*uFade*smoothstep(80.,550.,vDistance);
        if(a<.008)discard;
        vec3 col=mix(vec3(.48,.59,.68),vec3(.94,.95,.94),smoothstep(.12,.86,vUv.y*.5+n*.6));
        float fog=1.-exp(-uFog*uFog*vDistance*vDistance); col=mix(col,uHaze,fog);
        gl_FragColor=vec4(col,a*.66);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh = new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=24;
  mesh.onBeforeRender=(_,scene,camera)=>{uniforms.uRight.value.setFromMatrixColumn(camera.matrixWorld,0);uniforms.uUp.value.setFromMatrixColumn(camera.matrixWorld,1);if(scene.fog){uniforms.uHaze.value.copy(scene.fog.color);uniforms.uFog.value=scene.fog.density}};
  group.add(mesh);
  return {group,update(q,time,reduced){uniforms.uTime.value=reduced?0:time;uniforms.uFade.value=THREE.MathUtils.smoothstep(q,3.6,8.2)*.95;},dispose(){geometry.dispose();material.dispose()}};
}
