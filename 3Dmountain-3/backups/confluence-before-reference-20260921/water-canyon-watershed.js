/** One continuous alpine watershed; every tributary drains into the same trunk. */
export function createCanyonWatershed(THREE, {curve,widthAt,createRiver,rockMaterial,rockDark,rockPale}) {
  const group=new THREE.Group(); group.name='Alpine watershed · five sources, one current';
  const rivers=[],ownedGeometries=[],ownedMaterials=[];
  const lerp=THREE.MathUtils.lerp, clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=(a,b,x)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u);};
  const fract=x=>x-Math.floor(x),hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7+81.73)*43758.5453);
  function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);return lerp(lerp(hash(ix,iy),hash(ix+1,iy),ux),lerp(hash(ix,iy+1),hash(ix+1,iy+1),ux),uy);}
  const fbm=(x,y)=>noise(x,y)*.57+noise(x*2.07+13,y*2.07)*.28+noise(x*4.13,y*4.13+19)*.15;
  const v=(x,z)=>new THREE.Vector3(x,0,z);
  function path(points){const c=new THREE.CatmullRomCurve3(points.map(p=>v(...p)),false,'centripetal');c.arcLengthDivisions=1800;c.updateArcLengths();return c;}
  const downstream=path([[-42,-1880],[-70,-2110],[25,-2380],[100,-2670],[-80,-2950],[-170,-3290],[-70,-3650],[90,-4130],[-80,-4690],[30,-5400],[-160,-6300],[-260,-7800]]);
  const upstream=path([[-300,5500],[-80,3600],[-165,1700],[-235,1130],[-150,640],[-30,270],[0,0]]);
  const trunkWidth=z=>z>=-1880?57:lerp(124,90,smooth(-1880,-2700,z))+60*smooth(-2700,-3900,z);
  const mainRows=[];
  for(let i=0;i<=900;i++){const t=i/900,p=curve.getPointAt(t),n=curve.getTangentAt(t);mainRows.push({x:p.x,z:p.z,t,width:widthAt(t),nx:-n.z,nz:n.x});}
  function lookup(rows,z){if(z>=rows[0].z)return rows[0];if(z<=rows.at(-1).z)return rows.at(-1);let a=0,b=rows.length-1;while(b-a>1){const m=(a+b)>>1;if(rows[m].z>z)a=m;else b=m;}const u=(z-rows[a].z)/(rows[b].z-rows[a].z),o={};for(const k of Object.keys(rows[a]))o[k]=lerp(rows[a][k],rows[b][k],u);return o;}
  const downstreamRows=Array.from({length:901},(_,i)=>{const p=downstream.getPointAt(i/900);return{x:p.x,z:p.z,width:trunkWidth(p.z),nx:-downstream.getTangentAt(i/900).z};});
  const upstreamRows=Array.from({length:241},(_,i)=>{const p=upstream.getPointAt(i/240);return{x:p.x,z:p.z,width:57,nx:-upstream.getTangentAt(i/240).z};});
  function mainAt(z){return z>0?lookup(upstreamRows,z):z< -1880?lookup(downstreamRows,z):lookup(mainRows,z);}
  const joinZ=[-3290,-2380,-2670,-3650];
  const tributaryPoints=[
    [[-2270,1700],[-2140,800],[-1820,180],[-1980,-500],[-1670,-1040],[-1790,-1580],[-1410,-2060],[-1090,-2550],[-690,-2760],[-440,-3060]],
    [[-990,1700],[-1080,830],[-760,220],[-900,-380],[-700,-870],[-870,-1290],[-540,-1640],[-470,-1980],[-170,-2200]],
    [[1040,1700],[910,850],[1110,300],[820,-240],[990,-730],[770,-1160],[930,-1550],[580,-1910],[470,-2300],[240,-2510]],
    [[2370,1700],[2200,870],[1860,200],[2110,-420],[1770,-1000],[1990,-1510],[1550,-2060],[1190,-2330],[1090,-2870],[660,-3140],[370,-3480]]
  ];
  const descriptors=[];
  for(let k=0;k<4;k++){
    const end=mainAt(joinZ[k]),points=[[tributaryPoints[k][0][0]-160,5500],[tributaryPoints[k][0][0]+130,3500],...tributaryPoints[k],[end.x,joinZ[k]]],c=path(points);
    const width=t=>37+8*Math.sin(t*8+k)**2+12*smooth(.45,1,t);
    const river=createRiver(THREE,c,width,{lengthSegments:1400,widthSegments:20,bankOverlap:1.12});
    river.mesh.name=`Alpine tributary ${k+1} → main river`;group.add(river.mesh);rivers.push(river);
    const rows=Array.from({length:801},(_,i)=>{const p=c.getPointAt(i/800);return{x:p.x,z:p.z,width:width(i/800),nx:-c.getTangentAt(i/800).z};});
    descriptors.push({curve:c,widthAt:width,rows,joinZ:joinZ[k],main:false});
  }
  const extensions=[
    createRiver(THREE,upstream,()=>57,{lengthSegments:950,widthSegments:20}),
    createRiver(THREE,downstream,t=>trunkWidth(downstream.getPointAt(t).z),{lengthSegments:1400,widthSegments:32})
  ];
  extensions.forEach((r,i)=>{r.mesh.name=i?'The joined river beyond the confluence':'Original river upstream';group.add(r.mesh);});
  const peaks=[[-2650,500,710,590],[-1390,-230,830,460],[470,-250,720,350],[1530,-320,860,470],[-2580,-1530,1130,750],[-1180,-1310,960,380],[470,-1220,1040,370],[1450,-1740,1130,400],[-1060,-2740,1150,650],[720,-2910,1290,520],[2280,-3250,1350,780],[-2440,-3820,1550,850],[-710,-4250,1460,740],[970,-4600,1720,750],[2720,-5600,1450,1080],[-1790,-5790,1840,1100],[460,-6370,1660,1000],[-5200,-9000,2500,1750],[-2700,-9000,2650,1550],[-520,-9800,2900,1700],[1940,-9400,2700,1650],[4560,-9900,2850,1800],[6500,-8500,2400,1900]];
  // Broad asymmetric summits carry smaller ridges; high frequencies have
  // fixed world-space amplitude, avoiding needle-shaped procedural peaks.
  function massif(x,z){
    const wx=x+(noise(x*.0009,z*.0008)-.5)*150,wz=z+(noise(x*.0009+71,z*.0008)-.5)*130;
    let mass=65;
    for(const [px,pz,h,r]of peaks){const d=Math.hypot((wx-px)/(r*1.22),(wz-pz)/(r*.99));mass=Math.max(mass,h*.77*Math.exp(-Math.pow(d,1.04)));}
    const broadRidge=1-Math.abs(noise(wx*.0018,wz*.0017)*2-1);
    const shoulder=1-Math.abs(noise(wx*.0041+18,wz*.0042-7)*2-1);
    const fluting=(1-Math.abs(noise(wx*.009+41,wz*.009-14)*2-1))*.6+noise(wx*.019,wz*.018)*.4;
    return mass*(.78+broadRidge*.20)+shoulder*62+fluting*25;
  }
  // Match the original canyon's outer banks while keeping its navigable floor clear.
  function originalBank(x,z,row){const side=x<row.x?-1:1,d=Math.max(0,Math.abs(x-row.x)-row.nx*row.width),t=row.t,u=Math.pow(clamp(d/250),1/1.47);
    const canyon=smooth(.025,.17,t)*(1-smooth(.65,.91,t)),buttress=noise(t*24+13,side*19+65),ravine=Math.pow(noise(t*47+38,side*11+14),1.5),broad=fbm(x*.017+side*5,z*.014);
    const shoulder=18+canyon*(32+buttress*42),ridges=Math.pow(Math.abs(Math.sin(t*42+side*2.7+broad*3.3)),.52),cliffHeight=shoulder*(.34+buttress*.50+ravine*.52+broad*.14),cliffStart=4+24*noise(t*39,side*7+30),cliff=smooth(cliffStart,cliffStart+11+broad*20,d);
    const highland=smooth(58+buttress*35,235,d)*(Math.pow(ridges,1.8)*(26+broad*117)+broad*48)*(.40+canyon*.60),teeth=(noise(t*118+7,u*18+side*18)-.5)*(5+cliff*10)*smooth(2,16,d),shelf=Math.sin(d*.08+broad*4)*(2+ravine*5)*smooth(14,55,d);
    return{distance:d,height:-.9+(Math.min(d,8)*.16+cliffHeight*cliff+highland+teeth+shelf)*(1-smooth(.89,1,t)*.58)};
  }
  function channelsAt(z){const channels=[mainAt(z)];for(const d of descriptors)if(z>=d.joinZ-12&&z<=5500)channels.push(lookup(d.rows,z));return channels;}
  function sampleHeight(x,z,channels=channelsAt(z)){
    let distance=Infinity,tributaryDistance=Infinity;for(let k=0;k<channels.length;k++){const c=channels[k],d=Math.abs(x-c.x)*Math.max(.25,c.nx??1)-c.width-4;distance=Math.min(distance,d);if(k>0)tributaryDistance=Math.min(tributaryDistance,d);}
    const mass=massif(x,z),detail=fbm(x*.032,z*.027);
    let y=-7+smooth(-8,30,distance)*(13+detail*17)+smooth(8,340,distance)*mass;
    if(z<=0&&z>=-1880){const r=lookup(mainRows,z),original=originalBank(x,z,r),endFade=smooth(0,90,-z)*(1-smooth(1770,1880,-z));
      // A buried interior lets the original detailed cliffs remain authoritative.
      const support=lerp(-9,original.height-3,smooth(195,245,original.distance));
      y=lerp(y,support,(1-smooth(245,390,original.distance))*endFade*smooth(0,95,tributaryDistance));
    }
    // The far river disappears behind a closing ridge instead of cutting a slot through the horizon.
    y=lerp(y,mass,smooth(-7000,-8100,z));
    return y;
  }
  const xs=[],zs=[];
  for(let x=-9000;x< -3200;x+=140)xs.push(x);for(let x=-3200;x<=3200;x+=20)xs.push(x);for(let x=3340;x<=9000;x+=140)xs.push(x);
  for(let z=4800;z>1800;z-=120)zs.push(z);for(let z=1800;z>=-7000;z-=20)zs.push(z);for(let z=-7120;z>=-12000;z-=120)zs.push(z);
  const positions=new Float32Array(xs.length*zs.length*3),colors=new Float32Array(positions.length),indices=[];
  const dark=rockDark??new THREE.Color('#526676'),pale=rockPale??new THREE.Color('#a0acb4'),summit=new THREE.Color('#d1dbe1'),color=new THREE.Color();
  let maxHeight=0;
  for(let i=0;i<zs.length;i++){const z=zs[i],channels=channelsAt(z);for(let j=0;j<xs.length;j++){const x=xs[j],y=sampleHeight(x,z,channels),n=fbm(x*.009+51,z*.009),o=(i*xs.length+j)*3;positions.set([x,y,z],o);maxHeight=Math.max(maxHeight,y);
    color.copy(dark).multiplyScalar(.69).lerp(pale,.17+n*.46+smooth(190,1100,y)*.16);color.lerp(summit,smooth(680,1450,y)*(.23+n*.28));colors.set([color.r,color.g,color.b],o);
    if(i<zs.length-1&&j<xs.length-1){const a=i*xs.length+j,b=a+xs.length;indices.push(a,a+1,b,b,a+1,b+1);}
  }}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();ownedGeometries.push(geo);
  const terrain=new THREE.Mesh(geo,rockMaterial);terrain.name='Interlocking alpine massifs and carved confluences';terrain.castShadow=true;terrain.receiveShadow=true;group.add(terrain);

  // Quiet advected foam streaks make actual downstream travel legible from afar.
  // The original reflective water shader remains untouched beneath this layer.
  const flowUniforms={uTime:{value:0},uReveal:{value:0}};
  const flowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:flowUniforms,
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;vec3 p=position;p.y+=1.65;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float uTime,uReveal;varying vec2 vUv;
      void main(){float lane=(vUv.x-.5)*2.;float bend=sin(vUv.y*43.+lane*3.)*.11;float strand=exp(-pow((lane-bend)/.11,2.))+exp(-pow((lane+.43-bend*.7)/.065,2.))*.55+exp(-pow((lane-.43+bend*.6)/.08,2.))*.5;
      float pulse=pow(.5+.5*sin(vUv.y*116.-uTime*2.5+lane*5.),13.);float undertow=pow(.5+.5*sin(vUv.y*287.-uTime*5.6-lane*9.),19.);
      float alpha=(pulse*.54+undertow*.27)*strand*uReveal*smoothstep(0.,.015,vUv.y)*(1.-smoothstep(.985,1.,vUv.y));
      vec3 current=mix(vec3(.16,.31,.42),vec3(.83,.90,.96),smoothstep(.8,1.,pulse));
      gl_FragColor=vec4(current,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});ownedMaterials.push(flowMaterial);
  const flowPaths=[{curve,widthAt},...descriptors,{curve:upstream,widthAt:()=>57},{curve:downstream,widthAt:t=>trunkWidth(downstream.getPointAt(t).z)}];
  for(const d of flowPaths){const r=createRiver(THREE,d.curve,d.widthAt,{lengthSegments:500,widthSegments:8});const mesh=new THREE.Mesh(r.mesh.geometry,flowMaterial);mesh.name='Downstream surface current';mesh.renderOrder=2;mesh.frustumCulled=false;ownedGeometries.push(mesh.geometry);group.add(mesh);}
  const bounds=new THREE.Box3().setFromObject(terrain),stats={tributaryCount:4,riverCount:5,terrainVertices:positions.length/3,terrainTriangles:indices.length/3,maxHeight,confluenceCount:4,sharedWaterMaterial:rivers.every(r=>r.mesh.material===rivers[0].mesh.material),drawCalls:group.children.length};
  return {group,rivers,stats,bounds:{min:bounds.min,max:bounds.max,center:bounds.getCenter(new THREE.Vector3()),size:bounds.getSize(new THREE.Vector3())},descriptors,downstream,sampleHeight,mainAt,
    update(time,reveal=0){flowUniforms.uTime.value=time;flowUniforms.uReveal.value=smooth(.16,.55,reveal);for(const r of [...rivers,...extensions])r.update(time);},
    dispose(){for(const r of [...rivers,...extensions])r.dispose?.();for(const g of ownedGeometries)g.dispose();for(const m of ownedMaterials)m.dispose();}
  };
}
