import { createConfluenceEffects } from './water-confluence-fx.js?v=river-polish-1';
export { WATERSHED_FLOW_DEFAULTS } from './water-confluence-fx.js?v=river-polish-1';

export const WATERSHED_TERRAIN_DEFAULTS = Object.freeze({height:1,ridge:1,relief:1});

/** One continuous alpine watershed; every tributary drains into the same trunk. */
export function createCanyonWatershed(THREE, {curve,widthAt,createRiver,rockMaterial,rockDark,rockPale,boulderGeometry,flowConfig=null,terrainConfig=null,lite=typeof innerWidth==='number'&&innerWidth<760,shoreDetail=false,mainOverlap=null}) {
  // shoreDetail (opt-in): sharper aretes, finer drainage, baked crease tone and a per-vertex
  // shore attribute on every river. Omitted, every line below behaves exactly as before.
  const detail=!!shoreDetail;
  const group=new THREE.Group(); group.name='Alpine watershed · five sources, one current';
  const rivers=[],ownedGeometries=[],ownedMaterials=[];
  const refined=flowConfig!==null;
  const terrainSettings={...WATERSHED_TERRAIN_DEFAULTS};
  const terrainNumber=(key,min,max)=>{const value=Number(terrainConfig?.[key]??WATERSHED_TERRAIN_DEFAULTS[key]);return Math.max(min,Math.min(max,Number.isFinite(value)?value:WATERSHED_TERRAIN_DEFAULTS[key]));};
  const readTerrainSettings=()=>({height:terrainNumber('height',.5,1.8),ridge:terrainNumber('ridge',0,2),relief:terrainNumber('relief',0,2)});
  Object.assign(terrainSettings,readTerrainSettings());
  const lerp=THREE.MathUtils.lerp, clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=(a,b,x)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u);};
  const fract=x=>x-Math.floor(x),hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7+81.73)*43758.5453);
  function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);return lerp(lerp(hash(ix,iy),hash(ix+1,iy),ux),lerp(hash(ix,iy+1),hash(ix+1,iy+1),ux),uy);}
  const fbm=(x,y)=>noise(x,y)*.57+noise(x*2.07+13,y*2.07)*.28+noise(x*4.13,y*4.13+19)*.15;
  const v=(x,z)=>new THREE.Vector3(x,0,z);
  function path(points){const c=new THREE.CatmullRomCurve3(points.map(p=>v(...p)),false,'centripetal');c.arcLengthDivisions=1800;c.updateArcLengths();return c;}
  const downstream=path(refined
    ?[[-42,-1880],[-58,-2135],[25,-2380],[100,-2670],[-80,-2950],[-170,-3290],[-70,-3650],[90,-4130],[-80,-4690],[30,-5400],[-160,-6100],[-540,-6600],[-1120,-6890],[-1660,-7420],[-2090,-8370],[-2590,-9650]]
    :[[-42,-1880],[-70,-2110],[25,-2380],[100,-2670],[-80,-2950],[-170,-3290],[-70,-3650],[90,-4130],[-80,-4690],[30,-5400],[-160,-6300],[-260,-7800]]);
  const upstream=path([[-300,5500],[-80,3600],[-165,1700],[-235,1130],[-150,640],[-30,270],[0,0]]);
  // The first downstream row must share the original river's full width.
  // A 57 -> 124 unit jump at the old boundary left a visible triangular notch.
  const trunkWidth=z=>refined
    ?lerp(widthAt(1),90,smooth(-1880,-2700,z))+60*smooth(-2700,-3900,z)
    :(z>=-1880?57:lerp(124,90,smooth(-1880,-2700,z))+60*smooth(-2700,-3900,z));
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
    const river=createRiver(THREE,c,width,{lengthSegments:lite?560:960,widthSegments:lite?8:12,bankOverlap:refined?1.34:1.12});
    river.mesh.name=`Alpine tributary ${k+1} → main river`;group.add(river.mesh);rivers.push(river);
    const rows=Array.from({length:801},(_,i)=>{const p=c.getPointAt(i/800);return{x:p.x,z:p.z,width:width(i/800),nx:-c.getTangentAt(i/800).z};});
    descriptors.push({curve:c,widthAt:width,rows,joinZ:joinZ[k],main:false});
  }
  const extensions=[
    createRiver(THREE,upstream,()=>57,{lengthSegments:lite?400:750,widthSegments:lite?8:12,bankOverlap:refined?1.26:1.08}),
    createRiver(THREE,downstream,t=>trunkWidth(downstream.getPointAt(t).z),{lengthSegments:refined?(lite?880:1440):(lite?680:1120),widthSegments:lite?12:16,bankOverlap:refined?1.22:1.08})
  ];
  // Weld both extension boundaries to the exact authored main-river edge.
  // Adjacent Catmull-Rom splines need not have the same endpoint tangent.
  if(refined){
    for(const [extension,t,atStart] of [[extensions[0],0,false],[extensions[1],1,true]]){
      const geometry=extension.mesh.geometry,p=geometry.attributes.position,cells=geometry.attributes.aCell;
      const columns=extension.mesh.userData.journeyRiver.widthSegments+1,rows=p.count/columns;
      const point=curve.getPointAt(t),tangent=curve.getTangentAt(t),halfWidth=widthAt(t)*(detail&&mainOverlap?mainOverlap:1.08);
      const row=atStart?0:rows-1,horizontal=Math.hypot(tangent.x,tangent.z)||1;
      for(let j=0;j<columns;j++){
        const offset=(j/(columns-1)*2-1)*halfWidth,index=row*columns+j;
        p.setXYZ(index,point.x-tangent.z/horizontal*offset,0,point.z+tangent.x/horizontal*offset);
      }
      const sharedCell=Math.max(curve.getLength()/(lite?420:720),halfWidth*2/(lite?20:32));
      for(let r=0;r<12;r++)for(let j=0;j<columns;j++){
        const index=(atStart?r:rows-1-r)*columns+j;
        cells.setX(index,lerp(sharedCell,cells.getX(index),smooth(0,11,r)));
      }
      p.needsUpdate=true;cells.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
    }
  }
  extensions.forEach((r,i)=>{r.mesh.name=i?'The joined river beyond the confluence':'Original river upstream';group.add(r.mesh);});
  const peaks=[[-2650,500,710,590],[-1390,-230,830,460],[470,-250,720,350],[1530,-320,860,470],[-2580,-1530,1130,750],[-1180,-1310,960,380],[470,-1220,1040,370],[1450,-1740,1130,400],[-1060,-2740,1150,650],[720,-2910,1290,520],[2280,-3250,1350,780],[-2440,-3820,1550,850],[-710,-4250,1460,740],[970,-4600,1720,750],[2720,-5600,1450,1080],[-1790,-5790,1840,1100],[460,-6370,1660,1000],[-5200,-9000,2500,1750],[-2700,-9000,2650,1550],[-520,-9800,2900,1700],[1940,-9400,2700,1650],[4560,-9900,2850,1800],[6500,-8500,2400,1900]];
  const massifs=peaks.map(([x,z,height,radius],i)=>{
    const angle=-.58+(hash(i+7,18)-.5)*.75;
    const heightScale=z>-4600?.53:z>-7000?.60:.76;
    return{x,z,height:height*heightScale,radius:radius*1.14,c:Math.cos(angle),s:Math.sin(angle),length:1.65+hash(i,24)*.75,width:.88+hash(i,31)*.34,bend:hash(i,41)*6.28,skew:(hash(i,63)-.5)*.34};
  });
  // Elongated, offset shoulders carry the skyline. A bounded smooth maximum
  // joins neighbouring mountain bodies without either cone cusps or needles.
  const smoothMax=(a,b,k)=>{const h=Math.max(0,k-Math.abs(a-b))/k;return Math.max(a,b)+h*h*k*.25;};
  function massifSample(x,z){
    const wx=x+(noise(x*.0009,z*.0008)-.5)*170,wz=z+(noise(x*.0009+71,z*.0008)-.5)*145;
    let mass=48;
    for(const p of massifs){
      const dx=(wx-p.x)/p.radius,dz=(wz-p.z)/p.radius;
      if(Math.abs(dx)>4.3||Math.abs(dz)>4.3)continue;
      const along=dx*p.c+dz*p.s,across=-dx*p.s+dz*p.c;
      const spine=across+p.skew*along+.12*Math.sin(along*2.6+p.bend);
      const distance=Math.hypot(along/p.length,spine/p.width);
      const crown=p.height*.79*Math.exp(-Math.pow(distance,1.72)*1.12);
      const shoulderDistance=Math.hypot((along-.46)/1.28,(spine+.28)/.91);
      const shoulder=p.height*.40*Math.exp(-Math.pow(shoulderDistance,1.7)*1.38);
      mass=smoothMax(mass,Math.max(crown,shoulder),44);
    }
    const ridge=1-Math.abs(noise(wx*.0021,wz*.0016)*2-1);
    const shoulder=1-Math.abs(noise(wx*.0048+18,wz*.0036-7)*2-1);
    // Long drainage creases erode the same landform instead of placing spikes
    // on it. Their shortest scale stays above the terrain's sample spacing.
    const drainage=noise(wx*.0068+noise(wx*.0016,wz*.0015)*2.6,wz*.0022-14);
    const gullies=Math.pow(1-Math.abs(drainage*2-1),5.5);
    const strata=Math.sin(mass*.026+wx*.0046+wz*.0022+(noise(wx*.003,wz*.003)-.5)*2.1);
    if(detail){
      // Macro detail: knife-edge aretes ride the existing ridges; a finer drainage
      // net and faint scree benches break the long smooth flanks. All three stay in
      // the ridge/relief channels, so the live terrain sliders keep scaling them.
      const arete=Math.pow(1-Math.abs(noise(wx*.0062+5,wz*.0051-3)*2-1),3.2);
      const fine=noise(wx*.0105+noise(wx*.0031+8,wz*.0029)*1.6,wz*.0046+3);
      const rills=Math.pow(1-Math.abs(fine*2-1),7);
      const bench=Math.sin(mass*.06+wx*.0021-wz*.0013)*smooth(260,900,mass);
      return [mass*.86,mass*ridge*.13+shoulder*57+Math.pow(ridge,4)*mass*.08+arete*mass*.075*smooth(180,700,mass),
        strata*(6+shoulder*5)-gullies*(18+mass*.075)-rills*(7+mass*.035)+bench*6];
    }
    return [mass*.86,mass*ridge*.13+shoulder*57,strata*(6+shoulder*5)-gullies*(18+mass*.075)];
  }
  // Match the original canyon's outer banks while keeping its navigable floor clear.
  function originalBank(x,z,row){const side=x<row.x?-1:1,d=Math.max(0,Math.abs(x-row.x)-row.nx*row.width),t=row.t,u=Math.pow(clamp(d/250),1/1.47);
    const canyon=smooth(.025,.17,t)*(1-smooth(.65,.91,t)),buttress=noise(t*24+13,side*19+65),ravine=Math.pow(noise(t*47+38,side*11+14),1.5),broad=fbm(x*.017+side*5,z*.014);
    const shoulder=18+canyon*(32+buttress*42),ridges=Math.pow(Math.abs(Math.sin(t*42+side*2.7+broad*3.3)),.52),cliffHeight=shoulder*(.34+buttress*.50+ravine*.52+broad*.14),cliffStart=4+24*noise(t*39,side*7+30),cliff=smooth(cliffStart,cliffStart+11+broad*20,d);
    const highland=smooth(58+buttress*35,235,d)*(Math.pow(ridges,1.8)*(26+broad*117)+broad*48)*(.40+canyon*.60),teeth=(noise(t*118+7,u*18+side*18)-.5)*(5+cliff*10)*smooth(2,16,d),shelf=Math.sin(d*.08+broad*4)*(2+ravine*5)*smooth(14,55,d);
    return{distance:d,height:-.9+(Math.min(d,8)*.16+cliffHeight*cliff+highland+teeth+shelf)*(1-smooth(.89,1,t)*.58)};
  }
  function channelsAt(z){const channels=[mainAt(z)];for(const d of descriptors)if(z>=d.joinZ-12&&z<=5500)channels.push(lookup(d.rows,z));return channels;}
  // Distance to the actual centreline segments, including their width gradient.
  // A same-Z approximation moves banks across the ribbon on diagonal bends.
  const channelTables=[mainRows,upstreamRows,downstreamRows,...descriptors.map(d=>d.rows)];
  function channelDistance(x,z,rows){
    if(z>rows[0].z+160||z<rows.at(-1).z-160)return Infinity;
    let lo=0,hi=rows.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].z>z)lo=mid;else hi=mid;}
    const near=rows[lo],approx=Math.abs(x-near.x)*Math.max(.2,near.nx??1)-near.width;
    if(approx>220)return approx;
    let result=Infinity;
    for(let i=Math.max(0,lo-28);i<Math.min(rows.length-1,lo+29);i++){
      const a=rows[i],b=rows[i+1],dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1));
      result=Math.min(result,Math.hypot(x-a.x-dx*t,z-a.z-dz*t)-lerp(a.width,b.width,t));
    }
    return result;
  }
  function riverDistance(x,z){let d=Infinity;for(const rows of channelTables)d=Math.min(d,channelDistance(x,z,rows));return d;}
  function makeHeightSample(x,z,channels=channelsAt(z)){
    let distance=Infinity,tributaryDistance=Infinity;for(let k=0;k<channels.length;k++){const c=channels[k],d=Math.abs(x-c.x)*Math.max(.25,c.nx??1)-c.width-4;distance=Math.min(distance,d);if(k>0)tributaryDistance=Math.min(tributaryDistance,d);}
    if(refined)distance=riverDistance(x,z);
    const shape=massifSample(x,z),mass=Math.max(24,shape[0]+shape[1]+shape[2]),detail=fbm(x*.013,z*.012),bankWarp=noise(x*.004+11,z*.005);
    const talus=smooth(24,80,distance)*(1-smooth(118,225,distance))*(13+detail*18);
    const brokenShoulder=smooth(45,170,distance)*smooth(70,450,mass)*(detail-.43)*22;
    const bank=refined?-10+smooth(-9,16,distance)*(15+detail*5):-7+smooth(-8,28,distance)*(12+detail*12);
    const massBlend=refined?smooth(16,390+bankWarp*65,distance):smooth(8,365+bankWarp*65,distance);
    let support=0,supportMix=0;
    if(z<=0&&z>=-1880){const r=lookup(mainRows,z),original=originalBank(x,z,r),endFade=smooth(0,90,-z)*(1-smooth(1770,1880,-z));
      // A buried interior lets the original detailed cliffs remain authoritative.
      support=lerp(-9,original.height-3,smooth(195,245,original.distance));
      supportMix=(1-smooth(245,390,original.distance))*endFade*smooth(0,95,tributaryDistance);
    }
    // The refined trunk turns behind a massif before its final buried reach.
    // The closing ridge is curved in world space, never a straight Z dam.
    const ridgeStart=refined?-8650-Math.sin(x*.0017)*165:-7000;
    const ridgeEnd=refined?-9500-Math.sin(x*.0017)*165:-8100;
    return [...shape,bank,massBlend,talus,brokenShoulder,support,supportMix,smooth(ridgeStart,ridgeEnd,z)];
  }
  function heightFromSample(samples,offset=0){
    const mass=Math.max(24,(samples[offset]+samples[offset+1]*terrainSettings.ridge+samples[offset+2]*terrainSettings.relief)*terrainSettings.height);
    const hillside=samples[offset+3]+samples[offset+4]*mass+samples[offset+5]+samples[offset+6]*terrainSettings.relief;
    // The riverbed and close canyon support never scale with the mountains.
    return lerp(lerp(hillside,samples[offset+7],samples[offset+8]),mass,samples[offset+9]);
  }
  function sampleHeight(x,z,channels=channelsAt(z)){return heightFromSample(makeHeightSample(x,z,channels));}
  const xs=[],zs=[];
  const spacing=lite?36:24;
  for(let x=-9000;x< -3200;x+=140)xs.push(x);for(let x=-3200;x<3200;x+=refined&&Math.abs(x)<330?(lite?18:12):spacing)xs.push(x);xs.push(3200);for(let x=3340;x<=9000;x+=140)xs.push(x);
  for(let z=4800;z>1800;z-=120)zs.push(z);for(let z=1800;z>-7000;z-=refined&&z<80&&z>-1970?(lite?18:12):spacing)zs.push(z);zs.push(-7000);for(let z=-7120;z>=-12000;z-=120)zs.push(z);
  const positions=new Float32Array(xs.length*zs.length*3),colors=new Float32Array(positions.length),indices=[];
  // Store noise/carving once. Slider updates only evaluate this short expression
  // and refresh the same geometry buffers, rather than rebuilding the scene.
  const heightSamples=terrainConfig?new Float64Array(xs.length*zs.length*10):null;
  const dark=rockDark??new THREE.Color('#526676'),pale=rockPale??new THREE.Color('#a0acb4'),summit=new THREE.Color('#b7c4cd'),color=new THREE.Color();
  let maxHeight=0;
  for(let i=0;i<zs.length;i++){const z=zs[i],channels=channelsAt(z);for(let j=0;j<xs.length;j++){const x=xs[j],sample=makeHeightSample(x,z,channels),y=heightFromSample(sample),n=fbm(x*.009+51,z*.009),o=(i*xs.length+j)*3;positions.set([x,y,z],o);if(heightSamples)heightSamples.set(sample,(i*xs.length+j)*10);maxHeight=Math.max(maxHeight,y);
    color.copy(dark).multiplyScalar(.73).lerp(pale,.16+n*.39+smooth(190,1200,y)*.10);color.lerp(summit,smooth(1000,2300,y)*(.07+n*.12));
    const wet=1-smooth(.3,18,y);color.multiplyScalar(1-wet*.27);colors.set([color.r,color.g,color.b],o);
    if(i<zs.length-1&&j<xs.length-1){const a=i*xs.length+j,b=a+xs.length;if((i+j)%2)indices.push(a,a+1,b+1,a,b+1,b);else indices.push(a,a+1,b,b,a+1,b+1);}
  }}
  const baseColors=detail?colors.slice():null;
  function bakeCreases(){
    // Grid curvature → tone: drainage creases darken, crests lift. Recomputed after slider edits.
    if(!detail)return;
    const W=xs.length;
    for(let i=0;i<zs.length;i++)for(let j=0;j<W;j++){
      const k=i*W+j,y=positions[k*3+1];
      const jw=Math.max(0,j-1),je=Math.min(W-1,j+1),iN=Math.max(0,i-1),iS=Math.min(zs.length-1,i+1);
      const hx=Math.max(1,(xs[je]-xs[jw])*.5),hz=Math.max(1,(zs[iN]-zs[iS])*.5);
      const cx=((positions[(i*W+jw)*3+1]+positions[(i*W+je)*3+1])*.5-y)/hx;
      const cz=((positions[(iN*W+j)*3+1]+positions[(iS*W+j)*3+1])*.5-y)/hz;
      const shade=1-Math.max(-.14,Math.min(.30,(cx+cz)*.55));
      colors[k*3]=baseColors[k*3]*shade;colors[k*3+1]=baseColors[k*3+1]*shade;colors[k*3+2]=baseColors[k*3+2]*shade;
    }
  }
  bakeCreases();
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();ownedGeometries.push(geo);
  const terrain=new THREE.Mesh(geo,rockMaterial);terrain.name='Interlocking alpine massifs and carved confluences';terrain.castShadow=true;terrain.receiveShadow=true;group.add(terrain);

  const flowPaths=[{curve,widthAt},...descriptors,{curve:upstream,widthAt:()=>57},{curve:downstream,widthAt:t=>trunkWidth(downstream.getPointAt(t).z)}];
  if(refined){
    const upstreamLength=upstream.getLength(),mainLength=curve.getLength(),downstreamLength=downstream.getLength();
    Object.assign(flowPaths[0],{flowOffset:upstreamLength,flowStartFade:0,flowEndFade:0});
    Object.assign(flowPaths[5],{flowOffset:0,flowStartFade:100,flowEndFade:0});
    Object.assign(flowPaths[6],{flowOffset:upstreamLength+mainLength,flowStartFade:0,flowEndFade:280});
    for(let k=0;k<4;k++){
      let lo=0,hi=1;for(let i=0;i<30;i++){const mid=(lo+hi)*.5;if(downstream.getPointAt(mid).z>joinZ[k])lo=mid;else hi=mid;}
      Object.assign(flowPaths[k+1],{flowOffset:upstreamLength+mainLength+downstreamLength*(lo+hi)*.5-descriptors[k].curve.getLength(),flowStartFade:100,flowEndFade:58});
    }
  }
  // Broken slabs sit on the actual sampled bank. They do not enter the
  // original first-person reach, whose authored boulders remain untouched.
  let slabGeometry=boulderGeometry;
  if(!slabGeometry){
    slabGeometry=new THREE.IcosahedronGeometry(1,1);
    const p=slabGeometry.attributes.position,c=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),rough=.82+noise(x*5+19,z*5+y*2)*.25;
      p.setXYZ(i,x*rough,y*rough,z*rough);color.copy(dark).lerp(pale,.19+noise(x*3+5,z*4)*.34);c.set([color.r,color.g,color.b],i*3);
    }
    slabGeometry.setAttribute('color',new THREE.BufferAttribute(c,3));slabGeometry.computeVertexNormals();ownedGeometries.push(slabGeometry);
  }
  const bankPaths=flowPaths.slice(1),slabCount=lite?144:288;
  const slabs=new THREE.InstancedMesh(slabGeometry,rockMaterial,slabCount),dummy=new THREE.Object3D(),slabSamples=[];
  for(let i=0;i<slabCount;i++){
    const d=bankPaths[i%bankPaths.length],t=.08+hash(i,82)*.84,p=d.curve.getPointAt(t),tangent=d.curve.getTangentAt(t),side=i%2?1:-1;
    const large=i%7===0,size=(large?17:4)+Math.pow(hash(i,46),1.7)*(large?23:13);
    const offset=d.widthAt(t)+size*.92+6+hash(i,37)*(large?91:17),norm=Math.hypot(tangent.x,tangent.z)||1;
    const x=p.x-tangent.z/norm*offset*side,z=p.z+tangent.x/norm*offset*side,sample=makeHeightSample(x,z),y=heightFromSample(sample);
    dummy.position.set(x,y-size*.22,z);dummy.rotation.set((hash(i,17)-.5)*.42,Math.atan2(tangent.x,tangent.z)+(hash(i,26)-.5)*1.1,(hash(i,51)-.5)*.32);
    dummy.scale.set(size*(1.12+hash(i,36)*.55),size*(.35+hash(i,40)*.40),size*(.76+hash(i,44)*.7));dummy.updateMatrix();slabs.setMatrixAt(i,dummy.matrix);if(terrainConfig)slabSamples.push({sample,burial:size*.22,matrix:dummy.matrix.clone()});
  }
  slabs.instanceMatrix.needsUpdate=true;slabs.name='Eroded bank slabs and craggy shoulders';slabs.castShadow=true;slabs.receiveShadow=true;group.add(slabs);
  if(detail){
    // Water side of every bank: (bed height, inward distance to the bank, wall height),
    // read from the same terrain grid the banks were built from.
    const gridHeight=(x,z)=>{
      let a=0,b=xs.length-1;if(x<=xs[0])b=1;else if(x>=xs[b])a=b-1;else while(b-a>1){const m=(a+b)>>1;if(xs[m]>x)b=m;else a=m;}
      let c=0,d=zs.length-1;if(z>=zs[0])d=1;else if(z<=zs[d])c=d-1;else while(d-c>1){const m=(c+d)>>1;if(zs[m]<z)d=m;else c=m;}
      const u=clamp((x-xs[a])/(xs[b]-xs[a])),w=clamp((z-zs[c])/(zs[d]-zs[c])),W=xs.length,h=(i,j)=>positions[(i*W+j)*3+1];
      return lerp(lerp(h(c,a),h(c,b),u),lerp(h(d,a),h(d,b),u),w);
    };
    const bake=(river,width,overlap)=>{
      const g=river.mesh.geometry,p=g.attributes.position,uv=g.attributes.uv,info=river.mesh.userData.journeyRiver,columns=info.widthSegments+1,rows=p.count/columns;
      const data=new Float32Array(p.count*3);
      for(let r=0;r<rows;r++){
        const a=r*columns,b=a+columns-1,dx=p.getX(b)-p.getX(a),dz=p.getZ(b)-p.getZ(a),len=Math.hypot(dx,dz)||1,wv=width(uv.getY(a));
        for(let c=0;c<columns;c++){
          const i=a+c,lane=uv.getX(i)*2-1,side=lane<0?-1:1,x=p.getX(i),z=p.getZ(i);
          data[i*3]=Math.min(gridHeight(x,z),2.5);
          data[i*3+1]=wv*(1-Math.abs(lane)*overlap);
          data[i*3+2]=Math.max(0,gridHeight(x+dx/len*side*(wv+70),z+dz/len*side*(wv+70)));
        }
      }
      g.setAttribute('aShore',new THREE.BufferAttribute(data,3));
    };
    rivers.forEach((r,k)=>bake(r,descriptors[k].widthAt,refined?1.34:1.12));
    bake(extensions[0],()=>57,refined?1.26:1.08);
    bake(extensions[1],t=>trunkWidth(downstream.getPointAt(t).z),refined?1.22:1.08);
  }
  const joins=joinZ.map(z=>v(mainAt(z).x,z));
  const effects=createConfluenceEffects(THREE,{paths:flowPaths,sampleHeight,lite,joins,flowConfig});group.add(effects.group);
  let drawCalls=0;group.traverse(o=>{if(o.isMesh||o.isPoints)drawCalls++;});
  const riverVertices=[...rivers,...extensions].reduce((sum,r)=>sum+r.mesh.geometry.attributes.position.count,0);
  const bounds=new THREE.Box3().setFromObject(terrain),stats={tributaryCount:4,riverCount:5,terrainVertices:positions.length/3,terrainTriangles:indices.length/3,riverVertices,ownedSurfaceVertices:positions.length/3+riverVertices+(effects.stats.ribbonVertices||0),bankSlabs:slabCount,maxHeight,confluenceCount:4,lite,sharedWaterMaterial:[...rivers,...extensions].every(r=>r.mesh.material===rivers[0].mesh.material),drawCalls,effects:effects.stats};
  const terrainBounds={min:bounds.min,max:bounds.max,center:bounds.getCenter(new THREE.Vector3()),size:bounds.getSize(new THREE.Vector3())};
  Object.assign(stats,{terrainSettings,terrainRevision:0,terrainUpdatePending:false,liveTerrainControls:!!terrainConfig});
  let disposed=false,pendingTerrain=null,pendingSince=0;
  let appliedTerrainKey=JSON.stringify(terrainSettings),pendingTerrainKey=appliedTerrainKey;
  function syncTerrain(force=false){
    if(disposed||!terrainConfig)return false;
    const next=readTerrainSettings(),key=JSON.stringify(next),now=performance.now();
    if(key===appliedTerrainKey){pendingTerrain=null;pendingTerrainKey=key;stats.terrainUpdatePending=false;return false;}
    if(key!==pendingTerrainKey){pendingTerrain=next;pendingTerrainKey=key;pendingSince=now;stats.terrainUpdatePending=true;}
    // Coalesce pointer drags. One settled edit updates normals and shadows once.
    if(!force&&now-pendingSince<80)return false;
    const started=performance.now();Object.assign(terrainSettings,pendingTerrain||next);
    maxHeight=0;
    for(let i=0;i<positions.length/3;i++){const y=heightFromSample(heightSamples,i*10);positions[i*3+1]=y;maxHeight=Math.max(maxHeight,y);}
    geo.attributes.position.needsUpdate=true;if(detail){bakeCreases();geo.attributes.color.needsUpdate=true;}geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
    for(let i=0;i<slabSamples.length;i++){const slab=slabSamples[i];slab.matrix.elements[13]=heightFromSample(slab.sample)-slab.burial;slabs.setMatrixAt(i,slab.matrix);}
    slabs.instanceMatrix.needsUpdate=true;slabs.computeBoundingBox?.();slabs.computeBoundingSphere?.();
    bounds.copy(geo.boundingBox);terrainBounds.center.copy(bounds.getCenter(dummy.position));bounds.getSize(terrainBounds.size);
    stats.maxHeight=maxHeight;stats.terrainRevision++;stats.lastTerrainUpdateMs=performance.now()-started;stats.terrainUpdatePending=false;
    appliedTerrainKey=key;pendingTerrain=null;return true;
  }
  return {group,rivers,stats,bounds:terrainBounds,descriptors,downstream,sampleHeight,mainAt,effects,flowPaths,riverDistance,syncTerrain,
    update(time,reveal=0,confluence=0,reduced=false){if(disposed)return false;const changed=syncTerrain();effects.update(time,reveal,confluence,reduced);for(const r of [...rivers,...extensions])r.update(time);return changed;},
    dispose(){if(disposed)return;disposed=true;effects.dispose();for(const r of [...rivers,...extensions])r.dispose?.();for(const g of ownedGeometries)g.dispose();for(const m of ownedMaterials)m.dispose();group.clear();}
  };
}
