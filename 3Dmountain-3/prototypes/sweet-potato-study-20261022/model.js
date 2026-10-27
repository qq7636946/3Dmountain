import * as THREE from 'three';

const V=(x,y,z=0)=>new THREE.Vector3(x,y,z);
// Photo coordinates anchor the front composition. Depth is an inferred reconstruction.
const photo=(x,y,z=0)=>V((x-244)*.00778,(920-y)*.00778,z);
const smooth=(a,b,t)=>a+(b-a)*t*t*(3-2*t);
function tuberGeometry(profile){
  const radial=112,rows=180,positions=[],uv=[],indices=[];
  const shape=t=>{for(let i=1;i<profile.length;i++)if(t<=profile[i].t){const a=profile[i-1],b=profile[i],f=(t-a.t)/(b.t-a.t);return {r:THREE.MathUtils.lerp(a.radius,b.radius,f),cx:THREE.MathUtils.lerp(a.cx,b.cx,f)};}return {r:.052,cx:0};};
  for(let j=0;j<=rows;j++){
    const t=j/rows,y=t*4.1234,{r,cx}=shape(t);
    for(let i=0;i<=radial;i++){
      const u=i/radial,a=-Math.PI+u*Math.PI*2;
      const asym=1+.003*Math.sin(a*7-t*17)*Math.cos(a);
      const grain=.0014*Math.sin(a*61+t*107)*Math.sin(t*271+a*23);
      const rr=r*asym+grain*Math.sin(Math.PI*t);
      const x=cx+rr*Math.sin(a);
      positions.push(x,y,rr*Math.cos(a)*(.84+.05*t));
      // A single continuous UV cylinder. Two mirrored repeats form an exact
      // period around the circumference even when the source image is not tileable.
      uv.push(.35+u*2,t);
      if(i<radial&&j<rows){const k=j*(radial+1)+i;indices.push(k,k+1,k+radial+1,k+1,k+radial+2,k+radial+1);}
    }
  }
  // Close both ends with the SAME material, not differently coloured caps.
  for(const end of [0,rows]){
    const pole=positions.length/3,ring=end*(radial+1),s=shape(end/rows);
    positions.push(s.cx,end/rows*4.1234,0);uv.push(1.35,end/rows);
    for(let i=0;i<radial;i++)indices.push(...(end===0?[pole,ring+i+1,ring+i]:[pole,ring+i,ring+i+1]));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  // The UV seam duplicates vertices; explicitly weld their shading normals.
  const normals=g.attributes.normal;
  for(let j=0;j<=rows;j++){
    const a=j*(radial+1),b=a+radial,n=V().fromBufferAttribute(normals,a).add(V().fromBufferAttribute(normals,b)).normalize();
    normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);
  }
  g.userData={continuousSurface:true,radialSegments:radial,rows};return g;
}

function taperedTube(points,baseRadius,tipRadius,segments=36,sides=7){
  const curve=new THREE.CatmullRomCurve3(points),frames=curve.computeFrenetFrames(segments,false);
  const pos=[],uv=[],idx=[];
  for(let j=0;j<=segments;j++){
    const t=j/segments,p=curve.getPointAt(t),r=baseRadius*Math.pow(1-t,1.1)+tipRadius*t;
    for(let i=0;i<=sides;i++){
      const a=i/sides*Math.PI*2,q=p.clone().addScaledVector(frames.normals[j],Math.cos(a)*r).addScaledVector(frames.binormals[j],Math.sin(a)*r);
      pos.push(q.x,q.y,q.z);uv.push(i/sides,t);
      if(i<sides&&j<segments){const k=j*(sides+1)+i;idx.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

function leafOutline(texture){
  // Read alpha to build an actual blade silhouette; the source image is unchanged.
  const image=texture.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const {data}=ctx.getImageData(0,0,canvas.width,canvas.height),outline=[];
  for(let i=0;i<72;i++){
    const a=i/72*Math.PI*2,dx=Math.cos(a),dy=Math.sin(a);let last=0;
    for(let r=0;r<.9;r+=.001){
      const u=.5+dx*r,v=.48+dy*r,x=Math.round(u*(image.width-1)),y=Math.round((1-v)*(image.height-1));
      if(x<0||x>=image.width||y<0||y>=image.height)break;
      if(data[(y*image.width+x)*4+3]>190)last=r;
    }
    const r=Math.max(.005,last-.0015);outline.push([.5+dx*r,.48+dy*r]);
  }
  return outline;
}
function leafPoint(u,v,length,width,curl,variant){
  const x=(u-.5)*width,y=(v-.075)*length;
  const cup=Math.pow(Math.abs(u-.5)*2,1.55)*length*.12*Math.sin(Math.PI*v);
  const twist=(u-.5)*(v-.15)*length*(.12*Math.sin(variant*2.3));
  const ripple=Math.sin(v*18+variant)*Math.pow(Math.abs(u-.5)*2,3)*.018*length;
  return V(x,y,cup+curl*length*v*v+twist+ripple);
}
function makeLeafGeometry(length,width,curl,outline,variant){
  const rings=8,n=outline.length,positions=[],uv=[],indices=[],groups=[],thickness=.006*length+.002;
  const perSide=1+rings*n;
  for(let side=0;side<2;side++){
    const sign=side===0?1:-1,offset=side*perSide,start=indices.length;
    const add=(u,v)=>{const p=leafPoint(u,v,length,width,curl,variant);positions.push(p.x,p.y,p.z+sign*thickness/2);uv.push(u,v);};
    add(.5,.48);
    for(let r=1;r<=rings;r++)for(const [u,v] of outline)add(.5+(u-.5)*r/rings,.48+(v-.48)*r/rings);
    const face=(a,b,c)=>indices.push(...(side===0?[offset+a,offset+b,offset+c]:[offset+a,offset+c,offset+b]));
    for(let i=0;i<n;i++)face(0,1+i,1+(i+1)%n);
    for(let r=1;r<rings;r++)for(let i=0;i<n;i++){
      const a=1+(r-1)*n+i,b=1+(r-1)*n+(i+1)%n,c=1+r*n+i,d=1+r*n+(i+1)%n;
      face(a,c,b);face(b,c,d);
    }
    groups.push([start,indices.length-start,side]);
  }
  const start=indices.length,boundary=1+(rings-1)*n;
  // Duplicate edge vertices for crisp, thin rim normals, rather than averaging
  // the leaf's upper and lower surface into a thick inflated silhouette.
  for(let i=0;i<n;i++){
    const a=boundary+i,b=boundary+(i+1)%n,k=positions.length/3;
    for(const id of [a,a+perSide,b,b+perSide]){positions.push(...positions.slice(id*3,id*3+3));uv.push(...uv.slice(id*2,id*2+2));}
    indices.push(k,k+1,k+2,k+2,k+1,k+3);
  }
  groups.push([start,indices.length-start,2]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);for(const q of groups)g.addGroup(...q);g.computeVertexNormals();
  g.userData={closedLeaf:true,thickness,outlineVertices:n};return g;
}

export function createPotato({skin,leaf,normal,roughness,profile}){
  const model=new THREE.Group();model.name='Sweet potato / photo-reference reconstruction';
  skin.wrapS=THREE.MirroredRepeatWrapping;skin.needsUpdate=true;
  const skinMaterial=new THREE.MeshStandardMaterial({map:skin,normalMap:normal,normalScale:new THREE.Vector2(.13,.13),roughnessMap:roughness,roughness:.96,metalness:0,color:0xffffff});
  const body=new THREE.Mesh(tuberGeometry(profile),skinMaterial);body.name='Continuous closed tuber — unified PBR skin';body.castShadow=body.receiveShadow=true;model.add(body);
  const stemMat=new THREE.MeshStandardMaterial({color:'#75834c',roughness:.84});
  const rootMat=new THREE.MeshStandardMaterial({color:'#a48769',roughness:.96});
  const crownMat=new THREE.MeshStandardMaterial({color:'#785843',roughness:.93});
  function tube(name,points,r0,r1,mat,segments=36){const m=new THREE.Mesh(taperedTube(points,r0,r1,segments),mat);m.name=name;m.castShadow=m.receiveShadow=true;model.add(m);return m;}
  // The photo has a fine tapering taproot, not a blunt closed cylinder.
  const rootX=profile[0].cx;
  const rootPoints=[V(rootX,0,0),V(rootX-.008,-.18,.013),V(rootX+.07,-.39,.024),V(rootX+.11,-.63,-.01),V(rootX+.14,-.96,.02)];
  tube('Main root',rootPoints,.025,.0018,rootMat,48);
  for(let i=0;i<11;i++){
    const t=.11+i*.061,y=-t*.95,x=rootX+.01+t*.14,side=i%2?1:-1;
    tube('Fine root '+i,[V(x,y,.015),V(x+side*(.04+.018*Math.sin(i)),y-.055,.022),V(x+side*(.08+.03*Math.cos(i)),y-.13,.015)],.006*(1-t)+.001,.0007,rootMat,12);
  }
  const crown=photo(244,393,0);
  for(let i=0;i<7;i++){
    const a=i*2.399;
    tube('Crown fibre '+i,[crown.clone().add(V(Math.cos(a)*.06,-.05,Math.sin(a)*.05)),crown.clone().add(V(Math.cos(a)*.08,.09,Math.sin(a)*.07))],.026,.011,crownMat,8);
  }
  const stalks=[
    [[244,390],[256,278],[273,174],[272,82]],
    [[243,391],[215,290],[179,210],[155,173]],
    [[250,390],[271,301],[300,224],[321,159]],
    [[238,391],[218,331],[185,284],[164,268]],
    [[248,390],[267,351],[323,331],[373,326]],
    [[242,390],[238,320],[250,251],[250,186]],
    [[245,390],[276,326],[308,288],[347,276]]
  ];
  const stemSamples=[];
  stalks.forEach((pts,i)=>{const points=pts.map((p,j)=>photo(...p,Math.sin(i*2.7)*(.025+j*.15)));tube('Stem '+i,points,.022,.009,stemMat);stemSamples.push(...new THREE.CatmullRomCurve3(points).getPoints(80));});
  // [petiole base x/y, leaf tip x/y, width in photo pixels, depth, yaw, curl]
  const leaves=[
    [267,83,186,43,46,-.10,-.30,-.05],
    [278,66,320,28,27,-.04,.23,.03],
    [282,143,384,123,62,-.16,-.18,.06],
    [261,175,234,130,37,-.20,.35,.04],
    [219,188,198,124,51,.02,-.24,-.08],
    [194,197,161,151,39,-.13,.38,.05],
    [148,193,123,143,24,.04,.48,-.08],
    [147,226,77,246,38,.06,-.27,.03],
    [178,287,72,315,52,.04,.10,-.06],
    [203,261,155,260,31,-.10,.50,.04],
    [278,232,191,286,80,.17,-.15,-.04],
    [310,182,419,236,78,.03,.10,-.08],
    [310,171,362,151,35,-.11,-.18,.03],
    [301,248,348,255,37,-.12,.32,.02],
    [272,299,342,263,64,.23,-.12,-.06],
    [352,329,432,340,48,.12,-.10,.02],
    [334,351,408,402,60,.17,.20,-.06],
    [225,354,125,484,91,.42,-.12,-.02],
    [189,332,151,325,43,-.10,.40,.03],
    [183,350,124,373,49,.03,.15,.02]
  ];
  const outline=leafOutline(leaf),azimuth=[-.55,.65,.5,-.7,.32,-.9,.65,-.45,.55,-.95,.25,-.65,.8,-.65,.35,.7,-.45,.15,1,-.6];
  const leafTop=new THREE.MeshStandardMaterial({map:leaf,roughness:.85,metalness:0,color:0xffffff});
  const leafBack=leafTop.clone();leafBack.color.set(0xe5efca);leafBack.roughness=.97;
  const leafEdge=new THREE.MeshStandardMaterial({color:0x617531,roughness:.96});
  const veinMat=new THREE.MeshStandardMaterial({color:0x8e9b54,roughness:.91});
  leaves.forEach(([bx,by,tx,ty,w,z,yaw,curl],i)=>{
    const depth=z+Math.sin(i*2.399)*.46;
    const base=photo(bx,by,depth),tip=photo(tx,ty,depth),length=base.distanceTo(tip)/.9,width=w*.00778*1.28;
    const leafMesh=new THREE.Mesh(makeLeafGeometry(length,width,curl,outline,i),[leafTop,leafBack,leafEdge]);
    leafMesh.name='Leaf '+String(i+1).padStart(2,'0');leafMesh.position.copy(base);
    leafMesh.rotation.z=Math.atan2(-(tip.x-base.x),tip.y-base.y);leafMesh.rotateY(azimuth[i]);leafMesh.rotateX(Math.sin(i*2.1)*.26);
    leafMesh.castShadow=leafMesh.receiveShadow=true;model.add(leafMesh);
    leafMesh.userData={kind:'closed-leaf',inferredDepth:depth};
    // A small raised midrib follows the curved blade on its underside.
    const vein=[];
    for(let j=0;j<=16;j++){const v=.09+j/16*.85,p=leafPoint(.5+.012*Math.sin(v*5),v,length,width,curl,i);p.z-=.006*length+.002;vein.push(p);}
    const midrib=new THREE.Mesh(taperedTube(vein,.0055*length,.0008,24,5),veinMat);midrib.name='Leaf midrib '+(i+1);midrib.position.copy(base);midrib.quaternion.copy(leafMesh.quaternion);model.add(midrib);
    // Short petioles visibly meet the stems and then the base of each curved blade.
    const joint=stemSamples.reduce((best,p)=>p.distanceToSquared(base)<best.distanceToSquared(base)?p:best,stemSamples[0]).clone();
    const mid=base.clone().lerp(joint,.5).add(V(0,.025,-.015));
    tube('Leaf petiole '+(i+1),[joint,mid,base],.012,.007,stemMat,16);
  });
  // Two curling young shoots on the right, as in the reference.
  for(let k=0;k<2;k++){
    const pts=[photo(332+k*21,290-k*7,-.05),photo(347+k*21,270-k*7,-.03)];
    for(let j=0;j<30;j++){const a=j/29*Math.PI*2.2;pts.push(photo(355+k*23+Math.cos(a)*10*(1-j/38),277-k*7+Math.sin(a)*12*(1-j/38),-.02+j*.001));}
    tube('Curled shoot '+k,pts,.011,.003,stemMat,48);
  }
  return {model,body,leafCount:leaves.length,extraMaterials:[],extraTextures:[]};
}

export function makeMicroMaps(){
  const n=512,normal=new Uint8Array(n*n*4),rough=new Uint8Array(n*n*4);
  const hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
  function noise(u,v,period){
    const x=u*period,y=v*period,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const h=(a,b)=>hash((a%period+period)%period,(b%period+period)%period);
    return smooth(smooth(h(ix,iy),h(ix+1,iy),fx),smooth(h(ix,iy+1),h(ix+1,iy+1),fx),fy);
  }
  const h=(u,v)=>noise(u,v,32)*.55+noise(u,v,128)*.30+noise(u,v,256)*.15;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n,v=y/n,dx=(h(u+1/n,v)-h(u-1/n,v))*2,dy=(h(u,v+1/n)-h(u,v-1/n))*2;
    const q=V(-dx,-dy,1).normalize(),i=(y*n+x)*4;
    normal[i]=(q.x*.5+.5)*255;normal[i+1]=(q.y*.5+.5)*255;normal[i+2]=(q.z*.5+.5)*255;normal[i+3]=255;
    rough[i]=rough[i+1]=rough[i+2]=180+noise(u,v,16)*65;rough[i+3]=255;
  }
  function tex(data){const canvas=document.createElement('canvas');canvas.width=canvas.height=n;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.buffer),n,n),0,0);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;return t;}
  return {normal:tex(normal),roughness:tex(rough)};
}
