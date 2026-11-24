import * as THREE from 'three';

// Larger stones break the waterline in scattered deposits. The smaller ones
// are resolved by the scan relief in the terrain, including below the water.
/* RISE FALLS (team FT, 2026-11-23): `falls` = the module falls/falls-shape.js where html[data-rise-falls] is set, else null / undefined and
   nothing below changes. With it the lake-shore deposits lie along the gorge's rim instead (the lake is gone), and no stone is left
   standing over the hole or in the lowered trough of the fourth river. */
function deposits(atlas,falls) {
  const water=atlas.uniforms.tWater.value.image;
  const ground=atlas.uniforms.tCanopy.value.image;
  if (!water.data || !ground.data) return [];
  const bounds=atlas.uniforms.uBounds.value, range=atlas.uniforms.uYRange.value;
  let state=23017;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296;};
  const texel=(x,z)=>{
    const u=THREE.MathUtils.clamp(Math.floor((x-bounds.x)*bounds.z*water.width),0,water.width-1);
    const v=THREE.MathUtils.clamp(Math.floor((z-bounds.y)*bounds.w*water.height),0,water.height-1);
    return (v*water.width+u)*4;
  };
  const result=[];
  function deposit(cx,cz,angle,lake) {
    const count=5+Math.floor(random()*14), length=0.055+random()*0.16;
    const dx=Math.cos(angle), dz=Math.sin(angle);
    for (let i=0;i<count;i++) {
      const along=(random()+random()-1)*length, across=(random()+random()-1)*0.056;
      const x=cx+dx*along-dz*across, z=cz+dz*along+dx*across, k=texel(x,z);
      const w=water.data, creek=!lake && w[k+3]>240;
      if (falls && falls.gorgeSd(x,z)<0.02) continue;
      if (!(falls && lake) && ((!lake && w[k]<62) || (w[k]>100 && w[k+1]>130))) continue;
      const bed=(creek ? Math.max(0,Math.min(w[k+2]/255*range.y,range.x+ground.data[k]/255*range.y-0.105)) : 0)-(falls ? falls.troughDrop(x,z)/Math.max(0.2,atlas.uniforms.uRelief.value) : 0);   /* RISE FALLS: stones go down with the lowered land */
      const radius=0.006+0.019*random()**2+(i===0 ? 0.010 : 0);
      result.push({anchor:[x,bed,z,creek?1:0],shape:[radius,radius*(0.32+0.46*random()),radius*(0.57+0.42*random()),angle+(random()-0.5)*2.1],
        grain:[random(),random(),random(),0.22+0.20*random()]});
    }
  }
  for (let i=0;i<26;i++) {
    const a=(i+random()*0.80)*2*Math.PI/26;
    const bends=0.085*Math.sin(3*a+0.7)+0.055*Math.cos(5*a-1.2)+0.035*Math.sin(7*a+2.4);
    const r=0.908+(random()-0.5)*0.056-bends;
    if (falls) {   /* along the rim, a little outside it; the tangent from two rim points */
      if (falls.lipWeight && falls.lipWeight(a)>0.15) continue;   /* redo (2026-11-23 evening): the lip is clean water, stones only along the dry rim */
      const deg=a*180/Math.PI, out=1.012+random()*0.022, [x,z]=falls.rimPoint(deg,out), [x1,z1]=falls.rimPoint(deg+1,out);
      deposit(x,z,Math.atan2(z1-z,x1-x),true);
    } else
    deposit(0.122+1.66*r*Math.cos(a),-0.056+1.42*r*Math.sin(a),a+Math.PI/2,true);
  }
  // Shallow pixels of the authored water field also cover the main channel
  // and the sloping tributaries. The depth gradient gives each deposit a bank tangent.
  const maxTrials=7500;
  for (let i=0,groups=0;i<maxTrials && groups<74;i++) {
    const x=bounds.x+random()/bounds.z, z=bounds.y+random()/bounds.w;
    const k=texel(x,z), w=water.data;
    if (w[k]<88 || w[k+1]<12 || w[k+1]>108 || (w[k+3]>0 && w[k+3]<241)) continue;
    if (falls ? falls.gorgeSd(x,z)<0.05 : Math.hypot((x-0.122)/1.66,(z+0.056)/1.42)<1.12) continue;
    const gx=w[texel(x+0.02,z)+1]-w[texel(x-0.02,z)+1];
    const gz=w[texel(x,z+0.02)+1]-w[texel(x,z-0.02)+1];
    deposit(x,z,Math.atan2(gz,gx)+Math.PI/2,false);
    groups++;
  }
  return result;
}

export function createShoreCobbles(atlas,studio,scanColor,outerStones=[],falls=null) {
  const stones=deposits(atlas,falls).concat(outerStones);
  const geometry=new THREE.InstancedBufferGeometry(), positions=[], indices=[];
  // A rounded shoulder over a lower angular skirt, with a split, off-centre crown.
  const sides=8;
  for (const [height,radius,shift] of [[0,0.72,0], [0.31,1,0.12], [0.75,0.77,-0.03], [0.95,0.34,0.04]]) {
    for (let j=0;j<sides;j++) {
      const angle=j*2*Math.PI/sides+shift;
      const edge=radius*(1+0.13*Math.sin(angle*3.0+height));
      positions.push(edge*Math.cos(angle)+height*0.15,height+radius*0.045*Math.sin(angle*2.0),edge*Math.sin(angle));
    }
  }
  for (let ring=0;ring<3;ring++) for (let j=0;j<sides;j++) {
    const a=ring*sides+j,b=ring*sides+(j+1)%sides;
    indices.push(a,a+sides,b,b,a+sides,b+sides);
  }
  for (let j=1;j<sides-1;j++) indices.push(3*sides,3*sides+j+1,3*sides+j);
  geometry.setIndex(indices);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  for (const [key,name] of [['anchor','aAnchor'],['shape','aShape'],['grain','aGrain']]) {
    geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(stones.flatMap(stone=>stone[key])),4));
  }
  geometry.instanceCount=stones.length;
  const U=atlas.uniforms;
  const material=new THREE.ShaderMaterial({
    uniforms:{
      tScan:{value:scanColor},tCanopy:U.tCanopy,uBounds:U.uBounds,uRelief:U.uRelief,uSun:U.uSun,
      uYRange:U.uYRange,uTributaries:studio.uTributaries,uArrival:studio.uArrival,uLattice:U.uLattice,
      uMist:studio.uValleyMist,uSunStrength:studio.uSunIntensity,uShoreWet:studio.uShoreWet
    },
    vertexShader:`
      attribute vec4 aAnchor,aShape,aGrain;
      uniform sampler2D tCanopy;
      uniform vec4 uBounds;
      uniform vec2 uYRange;
      uniform vec3 uSun;
      uniform float uRelief,uTributaries,uShoreWet,uLattice;
      varying vec3 vN,vW;
      varying vec2 vUv;
      varying vec4 vStone;
      void main() {
        float c=cos(aShape.w),s=sin(aShape.w);
        mat2 rot=mat2(c,s,-s,c);
        vec3 p=position*aShape.xyz;
        p.x+=(aGrain.z-0.5)*0.48*p.y;
        p.y-=aShape.y*aGrain.w;
        vW=vec3(aAnchor.x,0.105+aAnchor.y*uRelief,aAnchor.z);
        vW.xz+=rot*p.xz; vW.y+=p.y;
        vec3 n=normal/aShape.xyz;
        n.y-=(aGrain.z-0.5)*0.48*n.x;
        n.xz=rot*n.xz; vN=normalize(n);
        vUv=aGrain.xy+position.xz*0.030+position.y*0.011;
        vec2 uv=(aAnchor.xz-uBounds.xy)*uBounds.zw;
        vec2 sunXZ=normalize(uSun.xz+vec2(0.00001));
        float ahead=0.105+(uYRange.x+texture2D(tCanopy,uv+sunXZ*0.36*uBounds.zw).r*uYRange.y-0.105)*uRelief;
        float shade=smoothstep(0.0,0.15,ahead-vW.y-0.36*uSun.y/max(length(uSun.xz),0.02));
        vStone=vec4(position.y,aGrain.z,texture2D(tCanopy,uv).a,1.0-0.77*shade);
        gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.0);
        if(aAnchor.w>uTributaries || uShoreWet<=0.0 || uLattice>0.35) gl_Position=vec4(2.0,2.0,2.0,1.0);
      }`,
    fragmentShader:`
      uniform sampler2D tScan;
      uniform float uArrival,uMist,uSunStrength;
      uniform vec3 uSun;
      varying vec3 vN,vW;
      varying vec2 vUv;
      varying vec4 vStone;
      void main() {
        vec3 normal=normalize(vN),eye=normalize(cameraPosition-vW);
        vec2 tile=(fract(vUv)*0.875+0.0625)*vec2(0.5,1.0)+vec2(0.5,0.0);
        vec4 sampleRock=textureGrad(tScan,tile,dFdx(vUv)*vec2(0.4375,0.875),dFdy(vUv)*vec2(0.4375,0.875));
        float cap=smoothstep(0.27,0.85,vStone.x);
        float key=max(dot(normal,uSun),0.0)*vStone.w*uSunStrength;
        vec3 body=mix(sampleRock.rgb,vec3(dot(sampleRock.rgb,vec3(0.21,0.72,0.07))),0.45);
        vec3 col=(body+vec3(0.025))*mix(vec3(0.65,0.79,0.83),vec3(1.08,1.05,0.98),cap);
        col*=vec3(0.18,0.24,0.29)*(0.75+0.45*cap)+vec3(1.23,1.16,1.05)*key;
        col+=vec3(0.22,0.26,0.29)*pow(max(dot(normal,normalize(eye+uSun)),0.0),28.0)*(1.0-sampleRock.a)*key;
        col=mix(col,vec3(0.39,0.48,0.57),clamp(uMist*length(cameraPosition-vW)*0.055,0.0,0.35));
        col=mix(vec3(dot(col,vec3(0.2126,0.7152,0.0722))),col,smoothstep(vStone.z,vStone.z+0.11,uArrival*1.36));
        gl_FragColor=vec4(col,1.0);
        #include <colorspace_fragment>
      }`
  });
  material.userData.handlesArrival=true;
  const mesh=new THREE.Mesh(geometry,material);
  mesh.frustumCulled=false;
  // The shadow follows the local water datum and the live key direction.
  // A short, soft footprint grounds each cap in the surrounding scanned bed.
  const quad=new THREE.PlaneGeometry(2,2);
  const footprints=new THREE.InstancedBufferGeometry();
  footprints.setIndex(quad.index);
  footprints.setAttribute('position',quad.getAttribute('position'));
  for (const key of ['aAnchor','aShape']) footprints.setAttribute(key,geometry.getAttribute(key));
  footprints.instanceCount=stones.length;
  const contact=new THREE.ShaderMaterial({
    uniforms:material.uniforms,transparent:true,depthWrite:false,
    vertexShader:`
      attribute vec4 aAnchor,aShape;
      uniform float uRelief,uTributaries,uLattice;
      uniform vec3 uSun;
      varying vec2 vFoot;
      void main() {
        vFoot=position.xy;
        float a=aShape.w;
        vec2 offset=mat2(cos(a),sin(a),-sin(a),cos(a))*(vFoot*aShape.xz)*1.54;
        offset-=uSun.xz*aShape.y*0.35/max(0.30,uSun.y);
        vec3 w=vec3(aAnchor.x+offset.x,0.106+aAnchor.y*uRelief,aAnchor.z+offset.y);
        gl_Position=projectionMatrix*viewMatrix*vec4(w,1.0);
        if(aAnchor.w>uTributaries || uLattice>0.35) gl_Position=vec4(2.0,2.0,2.0,1.0);
      }`,
    fragmentShader:`
      varying vec2 vFoot;
      void main() {
        float opacity=(1.0-smoothstep(0.07,1.0,dot(vFoot,vFoot)))*0.38;
        if(opacity<0.003) discard;
        gl_FragColor=vec4(0.032,0.044,0.048,opacity);
        #include <colorspace_fragment>
      }`,
    side:THREE.DoubleSide,forceSinglePass:true
  });
  contact.userData.handlesArrival=true;
  /* redo-s5 (RISE FALLS): the stones were laid along the default rim; when the opening sliders move the rim, any stone the rim moved past (or that
     now lies in the hole) is hidden, so nothing floats or sinks. Live field (uFallsSize) against the default one. */
  if (falls && falls.LIVE_GORGE_FIELD_GLSL && falls.GORGE_SD_GLSL && studio.uFallsSize) {
    material.uniforms.uFallsSize=studio.uFallsSize;
    const NL=String.fromCharCode(10), head='uniform vec2 uFallsSize;'+NL+falls.GORGE_SD_GLSL+NL+falls.LIVE_GORGE_FIELD_GLSL+NL+'bool fallsMoved(vec2 p){float l=fallsGorgeField(p).x;return l<0.03||abs(l-fallsGorgeSd(p))>0.04;}'+NL;
    for (const m of [material,contact]) m.vertexShader=m.vertexShader.replace('void main() {',head+'void main() {').replace('gl_Position=vec4(2.0,2.0,2.0,1.0);','gl_Position=vec4(2.0,2.0,2.0,1.0); if(fallsMoved(aAnchor.xz)) gl_Position=vec4(2.0,2.0,2.0,1.0);');
  }
  const shadows=new THREE.Mesh(footprints,contact);
  shadows.frustumCulled=false;
  const group=new THREE.Group();
  group.name='Exposed shore cobbles';
  group.add(mesh,shadows);
  group.userData.stoneCount=stones.length;
  return group;
}
