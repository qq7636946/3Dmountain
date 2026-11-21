import{createLetterWaterFx,LETTER_FX_DEFAULTS}from"./letters-water-fx.js?v=i15-mw30beoi";export const LOGO_LETTER_DEFAULTS={...LETTER_FX_DEFAULTS,tint:"#f4f8fe",ink:"#4a6b9d",frost:.35,wall:.62,sheen:.6,glow:.5,iceEdge:.3,clear:.5,bend:1.25,cut:.09,bevel:.9,needles:.4,sparkle:.2,tone:.93,rimLight:.4,round:1,locked:.36,fused:0,overshoot:.5,lockFlash:.5,lockPulse:.1,fusePulse:.3,fuseGlint:1.1,fuseSwell:.035,flightArc:.3,flightTurn:26},ICE_GLSL=`
  uniform vec3 uIceSky,uIceHorizon,uIceGround,uIceInk,uIceTint,uIceBlueA,uIceBlueB;
  /* x: how much frost lies on the faces; y: how deep the walls go; z: the
     sheen; w: the glow from behind. */
  uniform vec4 uIceLook;
  /* x: the width of a face's cut edge, in wordmark heights; y: how steeply
     it turns; z: the ice's index against the water's; w: how clear it is. */
  uniform vec4 uIceCut;
  uniform float uIceRound;
  /* x: needles; y: sparkle; z: the frosted face's tone; w: the light along
     the outline. */
  uniform vec4 uIceGrain;
  /* x: where the setting word's band of light is, in wordmark heights along
     the word; y: how bright; z: how wide. */
  uniform vec3 uIceGlint;
  uniform sampler2D uIceNoise;
  /* Smooth noise through the letter, one channel to a scale: the faces lie
     in xy, the walls run along z, so z slides the lookup across the map. */
  float iceNoise(vec3 P,float scale,vec4 channel){
    return dot(texture2DLodEXT(uIceNoise,(P.xy+P.z*vec2(.618,.382))*scale,0.),channel);
  }
  /* The frost combed out along the letter's height, as it grows on a cold
     pane: the same map, read a ninth as fast upward as across. */
  float iceNeedle(vec3 P,float finer){
    vec2 q=vec2(P.x*3.4+P.z*1.3,P.y*.3+P.z*.11);
    float fineLine=texture2DLodEXT(uIceNoise,q*vec2(2.1,1.3)+.37,0.).g;
    return texture2DLodEXT(uIceNoise,q,0.).r*.6+mix(.5,1.-abs(2.*fineLine-1.),finer)*.4;
  }
  /* How the frost roughens a face, for whatever is bent through it. */
  vec2 iceBump(vec3 P){
    return (texture2DLodEXT(uIceNoise,(P.xy+P.z*vec2(.618,.382))*1.3+.21,0.).ba-.5)*uIceLook.x*.55;
  }
  /* The cut edge of a face. G is the way the outline faces there and RIM how
     far in from the outline the point is: within the cut's width the face
     turns outward, most steeply at the outline itself. What comes back is
     added to the face's normal, in the letter's plane. */
  vec2 iceCut(vec2 G,float rim){
    float band=1.-smoothstep(0.,uIceCut.x,rim);
    float t=clamp(rim/max(uIceCut.x,1e-4),0.,1.);
    /* ROUND (uIceRound 1): the face leans out by cos(90deg*t) from the outline (t=0) to the flat face (t=1), like the turn of a fillet.
       CHAMFER (0): the old steep cut, a squared falloff. */
    float profile=mix(band*band,cos(1.5707963*t),uIceRound);
    return G*profile*uIceCut.y;
  }
  /* A letter of cut ice at one point of its surface. P and NL are the point
     and its normal in the letter's own frame, in wordmark heights; N and V
     are the normal and the ray (toward the point) in the world \u2014 both
     normals with the cut already in them. KIND.x is how flat the surface is
     without the cut (1 a face, 0 a wall) and KIND.y is 1 on the brand's
     stroke. THROUGH is what lies behind the letter, as it is seen through
     it. RIM is how far in from the outline the point is, and PX the size of
     a pixel there \u2014 which decides how fine a frost can be drawn without it
     boiling as the letter moves. */
  vec3 iceShade(vec3 P,vec3 NL,vec3 N,vec3 V,vec2 kind,vec3 through,float rim,float px){
    float blue=kind.y;
    float face=smoothstep(.5,.9,kind.x);
    /* The turn of the edge, between wall and face: where a cut block of ice
       catches the light. */
    float edge=smoothstep(.1,.5,kind.x)*(1.-smoothstep(.7,.97,kind.x));
    float band=(1.-smoothstep(0.,uIceCut.x,rim))*face;
    float NdV=clamp(dot(N,-V),0.,1.);
    /* Frost, fixed to the letter: broad cloudy patches, the needles, a grain
       seen only from close to, and a scatter of crystals. */
    float fine=clamp(.022/max(px,1e-4)-.35,0.,1.),finer=clamp(.011/max(px,1e-4)-.35,0.,1.);
    float cloud=iceNoise(P,.27,vec4(1.,0.,0.,0.))*.58+iceNoise(P,.69,vec4(0.,1.,0.,0.))*.42;
    float streak=(mix(.5,iceNeedle(P,finer),fine)-.5)*uIceGrain.x;
    float grain=mix(.5,iceNoise(P,1.94,vec4(0.,0.,1.,0.)),fine);
    float crystal=smoothstep(.76,.9,iceNoise(P,6.5,vec4(0.,0.,0.,1.)))*finer;
    /* The room as a dome over the letter \u2014 sky above, the bright horizon to
       the sides, the pale sea below \u2014 and the key softbox, high and to the
       left of the lens. Scaled so that a face turned to the lens is lit at
       one: TONE is then its brightness against the room. */
    float up=N.y*.5+.5;
    vec3 dome=mix(uIceGround,uIceSky,smoothstep(.1,.9,up));
    dome=mix(dome,uIceHorizon,(1.-abs(N.y))*.55);
    vec3 keyDir=normalize(vec3(-.38,.62,.68));
    float keyN=dot(N,keyDir);
    float key=pow(clamp(keyN*.5+.5,0.,1.),2.);
    vec3 light=(dome*.8+vec3(1.,.99,.97)*key*.6)*.86;
    vec3 R=reflect(V,N);
    float fresnel=.04+.96*pow(1.-NdV,5.);
    float sheen=pow(max(dot(R,keyDir),0.),5.)*uIceLook.z;
    /* How thick the frost lies: heaviest along the cut edges, where the saw
       left it; thinner and patchy across the face; combed into needles.
       Where it thins the block is clear, and what is behind it shows. */
    vec3 frosted=mix(uIceTint,uIceInk,.06+.1*(1.-cloud))*uIceGrain.z*light;
    frosted*=1.+(.8*streak+.12*(grain-.5)+.1*(cloud-.5))*uIceLook.x*1.4;
    frosted+=vec3(1.)*(sheen*.16+crystal*uIceGrain.y*.5*(.3+.7*key));
    float see=clamp(uIceCut.w*(1.-.5*band)*(1.-.35*uIceLook.x)*(1.-1.6*streak),0.,1.);
    vec3 core=through*mix(vec3(1.),uIceTint*vec3(.86,.93,1.),.6);
    vec3 top=mix(frosted,core,see);
    /* Walls are clear ice \u2014 you look into the block \u2014 so they are deeper and
       bluer: darker where they turn down, and darker toward the far end. */
    float front=smoothstep(-.11,.11,P.z);
    vec3 deep=mix(uIceTint,uIceInk,uIceLook.y)*light*(.58+.46*up)*(.78+.5*front);
    deep=mix(deep,through*mix(vec3(1.),uIceInk*1.6,.6),uIceCut.w*.4);
    /* The brand's stroke is the same ice, dyed: light where the stroke is
       wide, deep toward its point, and glossier than the frost round it. */
    vec3 dye=mix(uIceBlueB,uIceBlueA,smoothstep(-.34,.3,P.y+P.x*.45));
    vec3 dyed=dye*(light*.92+.14+.24*streak+.3*band)+through*dye*.35*uIceCut.w+vec3(1.)*(sheen*.32+crystal*uIceGrain.y*.3);
    top=mix(top,dyed,blue);
    deep=mix(deep,dye*light*(.42+.35*up)*(.74+.5*front),blue);
    vec3 col=mix(deep,top,face);
    /* The light behind the mark, coming through the block: mostly at the
       walls and wherever the surface turns away. */
    col+=uIceHorizon*uIceLook.w*(.08+.2*(1.-face))*pow(1.-NdV,1.5)*(1.-.5*blue);
    /* The studio's windows, sharp on the clear walls and on the cut edges of
       the faces, strongest at a glancing angle. */
    vec3 studio=textureCubeLodEXT(uEnv,R,1.4).rgb;
    col+=studio*uEnvStudio*uIceLook.z*(.4+2.6*fresnel)*(1.-face+.6*band);
    /* The turn between wall and face, which is nearly white; the line of
       light along the outline itself, bright where the cut faces the key and
       all but gone where it faces away; and the shade just inside the cut,
       where the face goes flat again. */
    col=mix(col,mix(uIceTint,vec3(1.),.6)*(light*.5+.74),edge*min(1.,uIceLook.z*1.4)*(1.-.4*blue));
    float line=(1.-smoothstep(0.,uIceCut.x*mix(.42,.9,uIceRound),rim))*face;
    col+=vec3(.96,.98,1.)*line*uIceGrain.w*(.22+.6*smoothstep(-.2,.8,keyN))*(1.-.35*blue);
    float inner=smoothstep(uIceCut.x*.5,uIceCut.x*.95,rim)*(1.-smoothstep(uIceCut.x*.95,uIceCut.x*1.6,rim))*face;
    col*=1.-.15*inner*uIceGrain.w*(1.-uIceRound);
    vec3 H=normalize(uSunDir-V);
    col+=uSunCol*pow(max(dot(N,H),0.),80.)*.22*uIceLook.z;
    return col;
  }
`;const INF=1e20;function createGlyphBaker(size){const canvas=document.createElement("canvas");canvas.width=canvas.height=size;const context=canvas.getContext("2d",{willReadFrequently:!0}),count=size*size,outer=new Float64Array(count),inner=new Float64Array(count),smoothed=new Float32Array(count),f=new Float64Array(size),z=new Float64Array(size+1),v=new Uint16Array(size);function transform1d(grid,offset,stride){v[0]=0,z[0]=-INF,z[1]=INF,f[0]=grid[offset];for(let q=1,k=0,s=0;q<size;q++){f[q]=grid[offset+q*stride];const q2=q*q;do{const r=v[k];s=(f[q]-f[r]+q2-r*r)/(q-r)/2}while(s<=z[k]&&--k>-1);k++,v[k]=q,z[k]=s,z[k+1]=INF}for(let q=0,k=0;q<size;q++){for(;z[k+1]<q;)k++;const r=v[k],qr=q-r;grid[offset+q*stride]=f[r]+qr*qr}}const transform=grid=>{for(let x=0;x<size;x++)transform1d(grid,x,size);for(let y=0;y<size;y++)transform1d(grid,y*size,1)};function bake(shapes,cx,cy,extent,out,offset,stride){const scale=size/(2*extent);context.setTransform(1,0,0,1,0,0),context.clearRect(0,0,size,size),context.setTransform(scale,0,0,scale,size/2-cx*scale,size/2-cy*scale),context.beginPath();const trace=points=>{points.forEach((point,index)=>{index?context.lineTo(point.x,point.y):context.moveTo(point.x,point.y)}),context.closePath()};for(const shape of shapes){trace(shape.getPoints(20));for(const hole of shape.holes)trace(hole.getPoints(20))}context.fillStyle="#fff",context.fill("evenodd");const pixels=context.getImageData(0,0,size,size).data;for(let i=0;i<count;i++){const a=pixels[i*4+3]/255;outer[i]=a>=1?0:a<=0?INF:Math.pow(Math.max(0,.5-a),2),inner[i]=a>=1?INF:a<=0?0:Math.pow(Math.max(0,a-.5),2)}transform(outer),transform(inner);for(let i=0;i<count;i++)smoothed[i]=Math.sqrt(outer[i])-Math.sqrt(inner[i]);const texel=1/scale;for(let y=0;y<size;y++){const row=y*size,up=Math.min(size-1,y+1)*size,down=Math.max(0,y-1)*size,target=(size-1-y)*size;for(let x=0;x<size;x++){const l=Math.max(0,x-1),r=Math.min(size-1,x+1),value=(smoothed[row+x]*4+(smoothed[row+l]+smoothed[row+r]+smoothed[up+x]+smoothed[down+x])*2+smoothed[up+l]+smoothed[up+r]+smoothed[down+l]+smoothed[down+r])/16;out[(target+x)*stride+offset]=value*texel}}}return{bake,canvas}}function frostTexture(THREE,size=128,cells=16){let seed=49734321;const random=()=>(seed=seed*1664525+1013904223>>>0,seed/4294967296),lattice=new Float32Array(cells*cells*4);for(let i=0;i<lattice.length;i++)lattice[i]=random();const data=new Uint8Array(size*size*4),ease=t=>t*t*(3-2*t);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const fx=x/size*cells,fy=y/size*cells,ix=Math.floor(fx),iy=Math.floor(fy),tx=ease(fx-ix),ty=ease(fy-iy),x1=(ix+1)%cells,y1=(iy+1)%cells;for(let c=0;c<4;c++){const a=lattice[(iy*cells+ix)*4+c],b=lattice[(iy*cells+x1)*4+c],d=lattice[(y1*cells+ix)*4+c],e=lattice[(y1*cells+x1)*4+c];data[(y*size+x)*4+c]=Math.round(((a+(b-a)*tx)*(1-ty)+(d+(e-d)*tx)*ty)*255)}}const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);return texture.name="Logo letters \xB7 frost noise",texture.wrapS=texture.wrapT=THREE.RepeatWrapping,texture.minFilter=texture.magFilter=THREE.LinearFilter,texture.needsUpdate=!0,texture}export function createLogoLetters(THREE,{glassMaterial,blueMaterial,config,lite=!1,seaLevel=()=>0,onSplash=null}){const group=new THREE.Group;group.name="logo-letters",group.visible=!1;const GLYPH_SIZE=lite?160:256,fx=createLetterWaterFx(THREE,{group,glassMaterial,blueMaterial,config,lite,seaLevel,onSplash}),ice={uIceSky:{value:new THREE.Color("#92a8cd")},uIceHorizon:{value:new THREE.Color("#e6edf7")},uIceGround:{value:new THREE.Color("#c9d5e8")},uIceInk:{value:new THREE.Color(config.ink)},uIceTint:{value:new THREE.Color(config.tint)},uIceBlueA:{value:new THREE.Color("#00a0e9")},uIceBlueB:{value:new THREE.Color("#0068b7")},uIceLook:{value:new THREE.Vector4(config.frost,config.wall,config.sheen,config.glow)},uIceCut:{value:new THREE.Vector4(config.cut,config.bevel,config.bend,config.clear)},uIceRound:{value:config.round??1},uIceGrain:{value:new THREE.Vector4(config.needles,config.sparkle,config.tone,config.rimLight)},uIceGlint:{value:new THREE.Vector3(0,0,.5)},uIceNoise:{value:frostTexture(THREE)}};let letters=[],glyphs=[],slots=[],ready=!1,source=null,building=null,epoch=0,span=1;const state={assembled:!1,glass:!1,pulse:0};function letterMaterial(base,own){const mainAt="void main(){",fragmentEnd="gl_FragColor=vec4(color,uOpacity);",vertexAt=base.vertexShader.indexOf(mainAt),fragmentAt=base.fragmentShader.lastIndexOf(mainAt);if(vertexAt<0||fragmentAt<0||!base.fragmentShader.includes(fragmentEnd))throw new Error("Logo glass shader has changed; letters cannot be derived from it.");const vertexShader=base.vertexShader.slice(0,vertexAt)+`uniform vec3 uLetterCenter;
      varying vec3 vLetterP,vLetterN,vLetterX,vLetterY;
      `+mainAt+`
        vLetterP=position-uLetterCenter; vLetterN=normal;
        vLetterX=normalize(mat3(modelMatrix)*vec3(1.,0.,0.)); vLetterY=normalize(mat3(modelMatrix)*vec3(0.,1.,0.));`+base.vertexShader.slice(vertexAt+mainAt.length);let fragmentShader=(base.fragmentShader.slice(0,fragmentAt)+`uniform float uIce,uIceBlue,uLetterAlpha,uLetterTile;uniform vec4 uFxWave;
      uniform sampler2D uLetterGlyph;
      varying vec3 vLetterP,vLetterN,vLetterX,vLetterY;
`+ICE_GLSL+`
      float letterField(vec2 q){vec2 f=texture2DLodEXT(uLetterGlyph,q,0.).rg;return min(f.x,f.y);}
      `+base.fragmentShader.slice(fragmentAt)).replace(fragmentEnd,`float letterPx=length(fwidth(vLetterP.xy))*.7071;
        if(uIce>.001){
          vec3 nl=normalize(vLetterN);if(!gl_FrontFacing)nl=-nl;
          vec2 lq=vLetterP.xy*uLetterTile+.5,le=vec2(1.5/`+GLYPH_SIZE+`.,0.);
          vec2 lg=vec2(letterField(lq+le)-letterField(lq-le),letterField(lq+le.yx)-letterField(lq-le.yx));
          lg/=max(length(lg),1e-6);
          float lrim=max(-letterField(lq),0.);
          vec2 lcut=iceCut(lg,lrim)*smoothstep(.5,.9,abs(nl.z));
          color=mix(color,iceShade(vLetterP,normalize(nl+vec3(lcut,0.)),normalize(Ng+normalize(vLetterX)*lcut.x+normalize(vLetterY)*lcut.y),V,vec2(abs(nl.z),uIceBlue),mix(color,uIceHorizon,.45),lrim,letterPx),uIce);
        }
        if(uIceGlint.y>.001){float band=(vObj.x+vObj.y*.55)/2.4-uIceGlint.x;color+=vec3(.92,.96,1.)*uIceGlint.y*exp(-band*band/(uIceGlint.z*uIceGlint.z))*(.34+.66*pow(1.-NdV,2.));}
        if(uFxWave.w>.001){float fb=(vLetterP.x*.8+vLetterP.y*.6)-uFxWave.z,gl=exp(-fb*fb/.005),sh=exp(-fb*fb/.04);color=color*(1.-.28*uFxWave.w*(sh-gl))+vec3(.95,.98,1.)*uFxWave.w*gl*(.45+.55*pow(1.-NdV,2.));}
        gl_FragColor=vec4(color,uOpacity*uLetterAlpha);`);return fragmentShader=fragmentShader.replace("vec3 Ng=normalize(vNormal);if(!gl_FrontFacing)Ng=-Ng;",`vec3 Ng=normalize(vNormal);if(!gl_FrontFacing)Ng=-Ng;
        vec2 lq=vLetterP.xy*uLetterTile+.5,le=vec2(1.25/LIQUID_GLYPH_SIZE.,0.);
        float ld=max(0.,-letterField(lq));
        vec2 lg=vec2(letterField(lq+le)-letterField(lq-le),letterField(lq+le.yx)-letterField(lq-le.yx));
        lg/=max(length(lg),.00001);
        float lens=pow(1.-smoothstep(0.,.105,ld),1.15)*.62*(uGlOn>.5?uGlLens:1.)*smoothstep(.6,.95,abs(vLetterN.z));glInner=ld;glFace=smoothstep(.6,.95,abs(vLetterN.z));glOutW=vLetterX*lg.x+vLetterY*lg.y;
        Ng=normalize(Ng+(vLetterX*lg.x+vLetterY*lg.y)*lens);
        if(uFxWave.y>1e-4){float frr=length(vLetterP.xy),fdr=frr-uFxWave.x;vec2 fdir=vLetterP.xy/max(frr,1e-4);Ng=normalize(Ng+(vLetterX*fdir.x+vLetterY*fdir.y)*sin(fdr*44.)*exp(-fdr*fdr*55.)*uFxWave.y*smoothstep(.45,.9,abs(vLetterN.z)));}`.replace("LIQUID_GLYPH_SIZE",String(GLYPH_SIZE))),new THREE.ShaderMaterial({name:base.name+" \xB7 letter",uniforms:{...base.uniforms,...ice,...own},transparent:base.transparent,depthWrite:base.depthWrite,defines:{...base.defines},vertexShader,fragmentShader})}const box=new THREE.Box2,size2=new THREE.Vector2,boxOf=shapes=>{const out=new THREE.Box2;for(const shape of shapes)for(const point of shape.extractPoints(48).shape)out.expandByPoint(point);return out};function clear(){for(const letter of letters)letter.mesh.removeFromParent(),letter.edge.geometry.dispose(),letter.edge.material.dispose(),letter.material.dispose(),letter.blueMaterial?.dispose(),letter.map.dispose();fx.clear(),letters=[],glyphs=[],slots=[],ready=!1,source=null}function build({groups,blue=[],mesh,aspect,yieldTask=()=>Promise.resolve()}){const run=++epoch;return clear(),building=(async()=>{const geometry=mesh.geometry,position=geometry.attributes.position,edgeSource=mesh.children.find(child=>child.isLineSegments);if(!position||!edgeSource||!groups.length)return!1;const outlines=groups.map(shapes=>({shapes,box:boxOf(shapes)})).sort((a,b)=>a.box.min.x-b.box.min.x);box.makeEmpty();for(const outline of outlines)box.union(outline.box);const blueBox=blue.length?boxOf(blue):null;blueBox&&box.union(blueBox),box.getSize(size2);const scale=(aspect-1)/(size2.x-size2.y),bevel=(1/scale-size2.y)/2;if(!(scale>0)||!Number.isFinite(scale)||bevel<-.001*size2.y)return!1;const cx=(box.min.x+box.max.x)/2,cy=(box.min.y+box.max.y)/2;let blueOwner=-1;if(blueBox){const bx=(blueBox.min.x+blueBox.max.x)/2;blueOwner=outlines.findIndex(outline=>bx>=outline.box.min.x&&bx<=outline.box.max.x),blueOwner<0&&(blueOwner=outlines.reduce((best,outline,index)=>Math.abs((outline.box.min.x+outline.box.max.x)/2-bx)<Math.abs((outlines[best].box.min.x+outlines[best].box.max.x)/2-bx)?index:best,0))}const bounds=[];for(let i=0;i+1<outlines.length;i++){if(outlines[i+1].box.min.x-outlines[i].box.max.x<bevel*2)return!1;bounds.push(((outlines[i].box.max.x+outlines[i+1].box.min.x)/2-cx)*scale)}const glassRange=geometry.groups.find(g=>g.materialIndex===0)??{start:0,count:position.count},blueRange=blueBox?geometry.groups.find(g=>g.materialIndex===1):null;if(blueBox&&!blueRange)return!1;const runs=outlines.map(()=>({start:-1,count:0})),array=position.array;let owner=0;for(let vertex=glassRange.start,end=glassRange.start+glassRange.count;vertex<end;vertex+=3){const x=(array[vertex*3]+array[vertex*3+3]+array[vertex*3+6])/3;for(;owner<bounds.length&&x>bounds[owner];)owner++;if(owner>0&&x<bounds[owner-1])return!1;const runOf=runs[owner];if(runOf.start<0)runOf.start=vertex;else if(runOf.start+runOf.count!==vertex)return!1;runOf.count+=3}if(runs.some(runOf=>runOf.count===0))return!1;geometry.boundingBox||geometry.computeBoundingBox();const depth=geometry.boundingBox.max.z,edgeArray=edgeSource.geometry.attributes.position.array,edgeLists=outlines.map(()=>[]);for(let i=0;i<edgeArray.length;i+=6){const x=(edgeArray[i]+edgeArray[i+3])/2;let k=0;for(;k<bounds.length&&x>bounds[k];)k++;const list=edgeLists[k];for(let j=0;j<6;j++)list.push(edgeArray[i+j])}const baker=createGlyphBaker(GLYPH_SIZE),built=[];for(let index=0;index<outlines.length;index++){const outline=outlines[index],hasBlue=index===blueOwner,own=hasBlue?outline.box.clone().union(blueBox):outline.box,center=new THREE.Vector3(((own.min.x+own.max.x)/2-cx)*scale,-((own.min.y+own.max.y)/2-cy)*scale,0),half=new THREE.Vector2((own.max.x-own.min.x)/2*scale+bevel*scale,(own.max.y-own.min.y)/2*scale+bevel*scale),reach=Math.max(half.x,half.y),fit=Math.max(half.x,half.y*.82),tile=reach+.13,data=new Float32Array(GLYPH_SIZE*GLYPH_SIZE*2),ox=(own.min.x+own.max.x)/2,oy=(own.min.y+own.max.y)/2;baker.bake(outline.shapes,ox,oy,tile/scale,data,0,2),hasBlue&&baker.bake(blue,ox,oy,tile/scale,data,1,2);const half16=new Uint16Array(data.length);for(let i=0;i<data.length;i+=2)half16[i]=THREE.DataUtils.toHalfFloat(data[i]*scale-bevel*scale),half16[i+1]=THREE.DataUtils.toHalfFloat(hasBlue?data[i+1]*scale-bevel*scale:4);const map=new THREE.DataTexture(half16,GLYPH_SIZE,GLYPH_SIZE,THREE.RGFormat,THREE.HalfFloatType);map.name="Logo letter "+(index+1)+" \xB7 distance field",map.minFilter=map.magFilter=THREE.LinearFilter,map.needsUpdate=!0,map.onUpdate=()=>{map.image.data=null,map.onUpdate=null};const letterGeometry=new THREE.BufferGeometry;for(const name of Object.keys(geometry.attributes))letterGeometry.setAttribute(name,geometry.attributes[name]);letterGeometry.addGroup(runs[index].start,runs[index].count,0),hasBlue&&letterGeometry.addGroup(blueRange.start,blueRange.count,1),letterGeometry.boundingSphere=new THREE.Sphere(new THREE.Vector3,Math.max(aspect,1));const uniforms={uLetterCenter:{value:center},uIce:{value:1},uIceBlue:{value:0},uLetterAlpha:{value:1},uLetterGlyph:{value:map},uLetterTile:{value:.5/tile},uFxWave:{value:new THREE.Vector4}},material=letterMaterial(glassMaterial,uniforms),strokeMaterial=hasBlue?letterMaterial(blueMaterial,{...uniforms,uIceBlue:{value:1}}):null,letterMesh=new THREE.Mesh(letterGeometry,hasBlue?[material,strokeMaterial]:[material]);letterMesh.name="Logo letter "+(index+1),letterMesh.renderOrder=5,letterMesh.frustumCulled=!1,letterMesh.matrixAutoUpdate=!1,letterMesh.visible=!1;const edgeGeometry=new THREE.BufferGeometry;edgeGeometry.setAttribute("position",new THREE.Float32BufferAttribute(edgeLists[index],3));const edge=new THREE.LineSegments(edgeGeometry,new THREE.LineBasicMaterial({color:16777215,transparent:!0,opacity:0,depthWrite:!1}));if(edge.renderOrder=6,edge.frustumCulled=!1,letterMesh.add(edge),built.push({index,center,half,reach,fit,tile,map,mesh:letterMesh,edge,material,blueMaterial:strokeMaterial,uniforms,geometry:letterGeometry}),await yieldTask(),run!==epoch){for(const letter of built)letter.edge.geometry.dispose(),letter.edge.material.dispose(),letter.material.dispose(),letter.blueMaterial?.dispose(),letter.map.dispose();return!1}}letters=built,fx.build(letters,{depth});for(const letter of letters)group.add(letter.mesh);return glyphs=letters.map(letter=>({map:letter.map,tile:letter.tile,reach:letter.reach,fit:letter.fit,depth,round:.016,size:GLYPH_SIZE})),slots=letters.map(()=>new THREE.Vector3),source=mesh,ready=!0,span=aspect,!0})().catch(error=>(console.warn("Logo letters could not be built",error),!1)).finally(()=>{run===epoch&&(building=null)}),building}const tint=(uniform,value)=>{uniform.source===value&&typeof value!="object"||(uniform.value.set(value),uniform.source=value)},follow=(material,base)=>{material&&material.defines.SAMPLES!==base.defines.SAMPLES&&(material.defines.SAMPLES=base.defines.SAMPLES,material.needsUpdate=!0)};function sync({palette,blueA,blueB}){tint(ice.uIceTint,config.tint),tint(ice.uIceInk,config.ink),ice.uIceLook.value.set(config.frost,config.wall,config.sheen,config.glow),ice.uIceCut.value.set(Math.max(.004,config.cut),config.bevel,Math.max(1.001,config.bend),THREE.MathUtils.clamp(config.clear,0,1)),ice.uIceRound.value=THREE.MathUtils.clamp(config.round??1,0,1),ice.uIceGrain.value.set(config.needles,config.sparkle,config.tone,config.rimLight),palette&&(tint(ice.uIceSky,palette.top??"#92a8cd"),tint(ice.uIceHorizon,palette.horizon??"#e6edf7"),tint(ice.uIceGround,palette.lower??"#c9d5e8")),blueA&&tint(ice.uIceBlueA,blueA),blueB&&tint(ice.uIceBlueB,blueB);for(let i=0;i<letters.length;i++)follow(letters[i].material,glassMaterial),follow(letters[i].blueMaterial,blueMaterial)}const inverse=new THREE.Quaternion,identity=new THREE.Quaternion,from=new THREE.Vector3,to=new THREE.Vector3,place=new THREE.Vector3,turn=new THREE.Quaternion,scaling=new THREE.Vector3,pose=new THREE.Matrix4,pivot=new THREE.Matrix4,twist=new THREE.Quaternion,UPRIGHT=new THREE.Vector3(0,1,0),smooth=(x,a,b)=>THREE.MathUtils.smoothstep(x,a,b),easeOutCubic=e=>1-Math.pow(1-e,3),easeOutBack=(e,s)=>1+(s+1)*Math.pow(e-1,3)+s*Math.pow(e-1,2);function layout(spin,scale){for(let i=0;i<letters.length;i++)slots[i].copy(letters[i].center).multiplyScalar(scale).applyQuaternion(spin);return slots}const freeRecords=[];let freeFlightTime=null;const helixPoint=new THREE.Vector3,easeHelix=x=>{const t=Math.min(1,Math.max(0,x));return t*t*t*(t*(t*6-15)+10)};function update({on,deliveries,fuse=0,progress=0,time=0,flightSeconds=0,spin,scale=1,edge=.035,reducedMotion=!1}){const flightDelta=freeFlightTime===null?0:Math.max(0,time-freeFlightTime);freeFlightTime=time;const riseDone=config.riseStart+config.riseStagger+config.riseLength;if(config.freeHelix&&(fuse=smooth(progress,riseDone+.015,riseDone+.145)),fx.begin(),state.assembled=!1,state.glass=!1,state.pulse=0,state.landed=!1,!on||!ready){freeFlightTime=null;for(const record of freeRecords)record&&(record.flightClock=0);return group.visible=!1,ice.uIceGlint.value.y=0,state}group.visible=!0,inverse.copy(spin).invert();let home=0,landed=0;const last=Math.max(1,letters.length-1),breath=reducedMotion?1:1+config.fuseSwell*Math.sin(Math.PI*smooth(fuse,0,1));for(const letter of letters){let delivery=deliveries[letter.index];if(config.freeHelix){const start=config.riseStart+letter.index/last*config.riseStagger;delivery=freeRecords[letter.index]??={position:new THREE.Vector3,quaternion:new THREE.Quaternion};let raw=(progress-start)/Math.max(.05,config.riseLength);if(flightSeconds>0){const duration=Math.max(.05,flightSeconds),direction=progress>=start?1:-1;delivery.flightClock=reducedMotion?direction>0?duration*1.12:0:Math.max(0,Math.min(duration*1.12,(delivery.flightClock||0)+direction*flightDelta)),raw=delivery.flightClock/duration}const u=Math.min(1,Math.max(0,raw));delivery.stage=raw>0?1:0,delivery.snap=u,delivery.alpha=smooth(u,0,.12),delivery.lock=(raw-1)/.12,delivery.scale=scale}if(!delivery||delivery.stage===0){letter.mesh.visible=!1;continue}const snap=delivery.snap,eased=config.directedHelix?snap*snap*snap*(snap*(snap*6-15)+10):smooth(snap,0,1),travel=reducedMotion||config.directedHelix?eased:easeOutBack(eased,Math.max(0,config.overshoot)),settle=smooth(snap,0,.85);if(from.copy(delivery.position).applyQuaternion(inverse),to.copy(letter.center).multiplyScalar(scale*breath),place.lerpVectors(from,to,travel),turn.copy(inverse).multiply(delivery.quaternion).slerp(identity,settle),!reducedMotion&&snap<1){const aloft=Math.sin(Math.PI*eased);place.y+=config.flightArc*scale*aloft*(1-eased)*1.6,turn.multiply(twist.setFromAxisAngle(UPRIGHT,THREE.MathUtils.degToRad(config.flightTurn)*aloft*(letter.index%2?-1:1)))}let sized=THREE.MathUtils.lerp(delivery.scale,scale*breath,config.directedHelix?smooth(snap,.1,.95):travel);if(config.freeHelix){const rise=easeHelix(snap),fan=easeHelix((snap-.16)/.84),orbit=reducedMotion?0:.9*(1-easeHelix((snap-.28)/.72)),angle=.45+letter.index*.33-Math.PI*2*1.12*rise;helixPoint.set(Math.sin(angle)*orbit,-1.65*(1-rise),Math.cos(angle)*orbit*.5),reducedMotion&&(helixPoint.y*=.15),place.copy(helixPoint).applyQuaternion(inverse).addScaledVector(to,fan),turn.copy(inverse).multiply(twist.setFromAxisAngle(UPRIGHT,reducedMotion?0:angle*.28*(1-fan))).slerp(identity,fan),sized=scale*breath*THREE.MathUtils.lerp(.5,1,easeHelix(snap))}pose.compose(place,turn,scaling.setScalar(sized)),letter.mesh.matrix.copy(pose).multiply(pivot.makeTranslation(-letter.center.x,-letter.center.y,-letter.center.z)),letter.mesh.matrixWorldNeedsUpdate=!0;const fxMesh=fx.letter(letter,snap,pose,config.directedHelix?delivery.alpha:1,reducedMotion);if(letter.mesh.visible=(!config.directedHelix||delivery.alpha>.001)&&fxMesh>.001,config.directedHelix){const materials=Array.isArray(letter.mesh.material)?letter.mesh.material:[letter.mesh.material];for(const material of materials)material.depthWrite=delivery.alpha*fxMesh>=.999}const set=smooth(fuse*1.6-.6*letter.index/last,0,1),frost=THREE.MathUtils.lerp(THREE.MathUtils.lerp(1,config.locked,smooth(snap,.2,1)),config.fused,set);letter.uniforms.uIce.value=config.liquid?0:frost,letter.uniforms.uLetterAlpha.value=(config.directedHelix?delivery.alpha:1)*fxMesh;const lock=delivery.lock,flash=Math.exp(-lock*lock*(lock<0?1:.22)),setting=Math.sin(Math.PI*set);letter.edge.material.opacity=Math.min(1,THREE.MathUtils.lerp(edge,config.iceEdge,frost)+config.lockFlash*flash*smooth(snap,.55,1)+config.lockFlash*.5*setting),letter.edge.material.opacity*=(config.directedHelix?delivery.alpha:1)*fxMesh,state.pulse=Math.max(state.pulse,config.lockPulse*flash*smooth(snap,.6,1)),state.glass=!0,snap>=1&&set>=1&&home++,snap>=1&&landed++}state.pulse+=config.fusePulse*Math.sin(Math.PI*smooth(fuse,0,1));const reach=span/4.8+.75;return ice.uIceGlint.value.set(THREE.MathUtils.lerp(-reach,reach,smooth(fuse,.04,.96)),reducedMotion?0:config.fuseGlint*Math.sin(Math.PI*fuse),.42),state.assembled=home===letters.length&&config.fused<=.001,state.landed=letters.length>0&&landed===letters.length,state.assembled&&!config.liquid&&(group.visible=!1),state}return{group,ice,state,build,sync,layout,update,clear,glyphSize:GLYPH_SIZE,get ready(){return ready},get building(){return building},get source(){return source},get letters(){return letters},get glyphs(){return glyphs},get slots(){return slots},fx,dispose(){epoch++,clear(),fx.dispose(),ice.uIceNoise.value.dispose()}}}