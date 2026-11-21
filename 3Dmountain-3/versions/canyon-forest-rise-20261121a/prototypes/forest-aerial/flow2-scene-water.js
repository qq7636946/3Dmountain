import*as THREE from"three";export const VERSION="w1-6";const RIVER=[[.3,.0012,0,0],[.15,.0011,1.7,0],[.105,9e-4,3.9,0],[.072,6e-4,5.2,0],[.05,4e-4,.8,0]],LAKE=[[.26,.0013,6,0],[.17,8e-4,-26,2.3],[.11,5e-4,38,4.1],[.074,35e-5,-8,1.2]],glslList=list=>list.map(t=>`vec4(${t.map(v=>(+v).toFixed(4)).join(",")})`).join(","),WAVES=`
  uniform float uW1Time; uniform vec4 uW1Wave;
  const vec4 W1R[${RIVER.length}]=vec4[${RIVER.length}](${glslList(RIVER)});
  const vec4 W1L[${LAKE.length}]=vec4[${LAKE.length}](${glslList(LAKE)});
  /* height and slope (d height / d world xz) of this module's waves at a point. phi = the way to the lake's centre through the water,
     dir = downstream (unit), spd = how fast the water runs here (W2's field, 0\u20261), grp = three slow group weights, px = world size of a
     pixel (0 in the vertex shader: a train finer than a pixel is not drawn) */
  float w1Waves(float phi,vec2 xz,float lakeN,float spd,vec3 grp,vec2 dir,float px,out vec2 slope){
    float h=0.; slope=vec2(0.);
    phi+=(grp.b-.5)*.10+(grp.r-.5)*.05;                                  /* crests wobble */
    float riv=(1.-lakeN)*mix(.35,1.2,smoothstep(.05,.6,spd))*uW1Wave.z;
    for(int i=0;i<W1_NR;i++){
      vec4 w=W1R[i]; float lam=w.x*uW1Wave.y, k=6.2831853/lam;
      float a=w.y*riv*mix(.15,1.85,smoothstep(.28,.72,grp[i%3]))*(1.-smoothstep(.3,.8,px/lam));
      float ph=k*(phi+.085*sqrt(w.x/.15)*uW1Time)+w.z;
      h+=a*sin(ph); slope-=a*k*cos(ph)*dir;
    }
    float lak=lakeN*uW1Wave.w;
    for(int i=0;i<W1_NL;i++){
      vec4 w=W1L[i]; float lam=w.x*uW1Wave.y, k=6.2831853/lam, an=radians(w.z-14.); vec2 D=vec2(cos(an),sin(an));
      float a=w.y*lak*mix(.15,1.85,smoothstep(.28,.72,grp[(i+1)%3]))*(1.-smoothstep(.3,.8,px/lam));
      float ph=k*(dot(xz,D)+(grp.g-.5)*.05-.045*sqrt(w.x/.17)*uW1Time)+w.w;
      h+=a*sin(ph); slope+=a*k*cos(ph)*D;
    }
    return h;
  }`,VERT=`
  attribute float aPhi; attribute vec3 aFlow;
  uniform sampler2D tWater,tGrow,tDetail,tWaves,tW2Flow; uniform vec4 uBounds; uniform float uGrow; uniform vec2 uW1Flow;
  varying vec3 vW1World; varying vec4 vW1F; varying vec2 vW1Flat;
  ${WAVES}
  void main(){
    vec3 p=position; vec2 uv=(p.xz-uBounds.xy)*uBounds.zw;
    vec3 wt=texture2D(tWater,uv).rgb;
    float edgeN=texture2D(tDetail,uv*vec2(6.,3.36)+.2).b-.5;
    float wet=smoothstep(0.,.06,uGrow*3.-texture2D(tGrow,uv).r+edgeN*.03);
    float gate=smoothstep(.03,.7,clamp(wt.g*wt.g*4.,0.,1.))*smoothstep(.3,.8,wt.r)*wet;
    vec3 grp=texture2D(tWaves,p.xz*.13+vec2(.006,-.004)*uW1Time).rgb;
    float spd=mix(.5,length(texture2D(tW2Flow,uv).rg*2.-1.),uW1Flow.x);
    vec2 sl; float h=w1Waves(aPhi,p.xz,wt.b,spd,grp,aFlow.xy,0.,sl)*gate*uW1Wave.x;
    p.y=.1055+h;
    vW1Flat=position.xz; vW1F=vec4(aPhi,aFlow);
    vec4 w=modelMatrix*vec4(p,1.); vW1World=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;
  }`,HAZE=`
  uniform float uHaze,uDist;
  vec3 forestHaze(vec3 col,vec3 world){
    float far=clamp((length(cameraPosition-world)-uDist)/uDist*5.,0.,1.);
    float low=1.-smoothstep(.12,.8,world.y);
    return mix(col,vec3(.63,.73,.77),far*(.3+.7*low)*uHaze*.6);
  }`,FRAG=`
  uniform sampler2D tPlate,tWater,tFlow,tGrow,tDetail,tWaves,tRefl,tW2Flow; uniform mat4 uReflMat;
  uniform vec4 uBounds,uView; uniform vec3 uSun; uniform float uGrow,uVig,uTime,uWater;
  uniform float uRvSpeed,uRvWave,uRvRefl,uRvSun,uRvFoam,uRvBed,uRvFine; uniform vec3 uRvDeep,uRvSky;
  uniform vec4 uW1A,uW1B; uniform vec2 uW1Flow;
  varying vec3 vW1World; varying vec4 vW1F; varying vec2 vW1Flat;
  ${WAVES}
  ${HAZE}
  /*AIR*/
  void main(){
    vec2 wq=vW1Flat, uv=(wq-uBounds.xy)*uBounds.zw;
    vec3 wt=texture2D(tWater,uv).rgb;
    float wm=wt.r, shore=wt.g, lakeN=wt.b, sh2=shore*shore, shoreN=clamp(sh2*4.,0.,1.);
    float body=smoothstep(.2,.7,wm), rim=smoothstep(.02,.3,wm)*(1.-body)*uW1B.z;
    /* the spreading: the same front as the land's */
    vec3 gw=texture2D(tGrow,uv).rgb;
    float edgeN=texture2D(tDetail,uv*vec2(6.,3.36)+.2).b-.5;
    float wetF=uGrow*3.-gw.r+edgeN*.03, wet=smoothstep(0.,.06,wetF);
    float W=uWater*wet, RW=uW1A.x*W*body;
    float alpha=(RW+(1.-RW)*rim*.4*wet*uW1A.x);
    if(alpha<.004)discard;
    float shade=0.;
    #ifdef FOREST_AIR
    shade=forestAirShadow(wq);
    #endif

    /* this module's waves: exact slopes of the trains the vertices carry (and the finer ones) */
    float px=length(fwidth(wq));
    vec2 dir=vW1F.yz/max(length(vW1F.yz),1e-4);
    vec3 grp=texture2D(tWaves,wq*.13+vec2(.006,-.004)*uW1Time).rgb;
    float spd2=mix(.5,length(texture2D(tW2Flow,uv).rg*2.-1.),uW1Flow.x);
    vec2 ws; float wh=w1Waves(vW1F.x,wq,lakeN,spd2,grp,dir,px,ws);
    float gate=smoothstep(.03,.7,shoreN)*wet;
    ws*=gate; wh*=gate;

    /* ---- the scene's water (FOREST_RIVER) ---- */
    vec3 fl=texture2D(tFlow,uv).rgb;
    vec2 F=fl.rg*2.-1.;
    float fs=length(F); vec2 fw=fs>1e-3?F/fs:vec2(0.);
    float spd=clamp(fs*1.6+.3,.3,1.)*(1.-lakeN);
    float ph0=uTime*uRvSpeed*.42;
    float a1=fract(ph0),a2=fract(ph0+.5),b1=1.-abs(2.*a1-1.),b2=1.-b1;
    float Lc=.26*spd;
    vec2 o1=fw*(a1-.5)*Lc,o2=fw*(a2-.5)*Lc;
    vec2 n1=texture2D(tWaves,(wq-o1)*7.3).rg-.5,n2=texture2D(tWaves,(wq-o2)*7.3+.41).rg-.5;
    vec2 m1=texture2D(tWaves,(wq-o1*1.7)*16.2+.2).rg-.5,m2=texture2D(tWaves,(wq-o2*1.7)*16.2+.63).rg-.5;
    float bn=inversesqrt(b1*b1+b2*b2);
    vec2 f1=texture2D(tWaves,(wq-o1*2.6)*37.+.13).rg-.5,f2=texture2D(tWaves,(wq-o2*2.6)*37.+.71).rg-.5;
    vec2 flowS=((n1*b1+n2*b2)+(m1*b1+m2*b2)*.65+(f1*b1+f2*b2)*.55*uRvFine)*bn;
    mat2 rr1=mat2(.8,-.6,.6,.8);
    vec2 l1=texture2D(tWaves,wq*4.1+vec2(.86,.5)*uTime*.05*uRvSpeed).rg-.5;
    vec2 l2=(texture2D(tWaves,rr1*wq*9.7+vec2(-.4,.9)*uTime*.08*uRvSpeed).rg-.5)*rr1;
    vec2 l3=texture2D(tWaves,wq*21.+vec2(.3,-.7)*uTime*.12*uRvSpeed).rg-.5;
    #ifdef W1_FINE
    vec2 g1=texture2D(tWaves,(wq-o1*3.4)*71.+.37).rg-.5,g2=texture2D(tWaves,(wq-o2*3.4)*71.+.91).rg-.5;
    flowS+=(g1*b1+g2*b2)*.38*uRvFine*bn;
    vec2 l4=(texture2D(tWaves,rr1*wq*47.+vec2(-.6,.4)*uTime*.2*uRvSpeed).rg-.5)*rr1*uRvFine, l5=(texture2D(tWaves,wq*83.+vec2(.5,.5)*uTime*.26*uRvSpeed).rg-.5)*uRvFine;
    #else
    vec2 l4=vec2(0.),l5=vec2(0.);
    #endif
    vec2 sl=mix(flowS*(.75+.6*spd),l1*.8+l2*.7+l3*.45+l4*.38+l5*.26,lakeN)*8.*.085*uRvWave*mix(.45,1.,smoothstep(0.,.5,shoreN));
    sl+=ws*uW1A.y;                                                       /* + this module's waves */
    vec3 Nw=normalize(vec3(-sl.x,1.,-sl.y)), Vw=normalize(cameraPosition-vW1World);
    float ndv=clamp(dot(Nw,Vw),0.,1.);
    float depth=1.-(1.-clamp(smoothstep(.04,1.,sh2)*(lakeN*.95+.6*(1.-lakeN)),0.,1.))*uRvBed;
    vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;
    vec3 bodyC=mix(bed*vec3(.80,.95,1.),uRvDeep,depth*mix(.88,1.,1.-uRvBed));
    float bank=1.-smoothstep(.0,.42,shoreN), chan=smoothstep(.45,1.,sh2)*(1.-lakeN*.6);
    bodyC=mix(bodyC,uRvDeep*vec3(1.35,1.75,1.7)+vec3(.012,.03,.03),bank*.55*uRvFine/1.2);
    bodyC*=1.-chan*.22;
    /* + the relief you read from above: faces turned to the sun a little lighter, the others darker (this module's waves only) */
    bodyC*=1.+clamp(dot(-ws,normalize(uSun.xz))*1.6*uW1A.z,-.25,.3);
    vec3 Rw=reflect(-Vw,Nw);
    vec3 skyw=mix(uRvSky,uRvSky*vec3(.55,.70,.95),smoothstep(.15,1.,Rw.y));
    vec4 rp=uReflMat*vec4(wq.x,.105,wq.y,1.); vec4 rf=texture2D(tRefl,rp.xy/rp.w+sl*.05);
    vec3 mir=mix(skyw,rf.rgb*.9,clamp(rf.a,0.,1.));
    float fr=clamp((mix(.08,.24,uRvBed)+.76*pow(1.-ndv,3.))*uRvRefl+.32*rf.a*uRvRefl,0.,.94);
    vec3 wc=mix(bodyC,mir,fr);
    vec3 Hs=normalize(Vw+uSun); float nh=max(dot(Nw,Hs),0.);
    wc+=vec3(1.,.96,.88)*(pow(nh,320.)*2.2+pow(nh,60.)*.12+pow(nh,20.)*.03)*uRvSun*(1.-shade)*(1.-rf.a*.6);
    float th=texture2D(tWaves,vec2(dot(wq,vec2(-fw.y,fw.x))*58.,dot(wq,fw)*5.-ph0*1.6*spd)).b*b1+texture2D(tWaves,vec2(dot(wq,vec2(-fw.y,fw.x))*58.+.5,dot(wq,fw)*5.-(ph0+.5)*1.6*spd)).b*b2;
    wc+=vec3(.55,.70,.86)*smoothstep(.62,.86,th)*.16*spd*(1.-lakeN)*smoothstep(.1,.5,shoreN)*uRvFine;
    float riffN=texture2D(tWaves,(wq-o1*1.3)*11.).b*b1+texture2D(tWaves,(wq-o2*1.3)*11.+.5).b*b2;
    float riff=smoothstep(.58,.9,riffN)*spd*smoothstep(.1,.5,shoreN);
    float lapL=smoothstep(0.,.05,shoreN)*(1.-smoothstep(.05,.18,shoreN+(texture2D(tWaves,wq*6.+vec2(uTime*.02,0.)).b-.5)*.12+wh*uW1B.x));
    lapL*=smoothstep(.35,.7,texture2D(tWaves,wq*29.+vec2(uTime*.05,-uTime*.03)).b);
    float narrow=(1.-lakeN)*smoothstep(.55,.95,spd)*(1.-smoothstep(.3,.8,sh2));
    float wwt=texture2D(tWaves,vec2(dot(wq,vec2(-fw.y,fw.x))*90.,dot(wq,fw)*14.-ph0*2.2*spd)).b;
    riff=max(riff,smoothstep(.62,.9,wwt)*narrow);
    /* + a little foam where the current runs into a point or a bank */
    riff=max(riff,smoothstep(.5,.8,riffN+vW1F.w*.25)*vW1F.w*uW1B.y);
    wc=mix(wc,vec3(.86,.92,.94),clamp(riff*.32+lapL*.09,0.,1.)*uRvFoam);
    /* ---- end of the scene's water ---- */

    vec3 col=wc;
    /* the water's bright head while it spreads (the land draws the same band under it) */
    col+=vec3(.75,.98,1.)*wm*exp(-pow((wetF-.02)/.03,2.))*step(uGrow,.998)*.5;
    /* the wet line on the bank: dark, a little blue */
    col=mix(vec3(.010,.018,.026),col,RW/max(alpha,1e-4));
    #ifdef FOREST_AIR
    col=forestAir(col,wq);
    #endif
    col=forestHaze(col,vW1World);
    vec2 sc=(gl_FragCoord.xy-uView.xy)/uView.zw-.5;
    col*=1.-uVig*smoothstep(.5,1.9,dot(sc,sc)*4.);
    gl_FragColor=vec4(col,alpha);
    #include <colorspace_fragment>
  }`;function waterGeometry(field,bounds,nx,grow){const{w:FW,h:FH,phi,cover,hit}=field,x0=bounds.min.x,z0=bounds.min.z,sx=bounds.max.x-bounds.min.x,sz=bounds.max.z-bounds.min.z,nz=Math.round(nx*sz/sx),at=(a,u,v)=>{const x=Math.min(FW-1.001,Math.max(0,u*FW-.5)),y=Math.min(FH-1.001,Math.max(0,v*FH-.5)),i=x|0,j=y|0,fx=x-i,fy=y-j,o=j*FW+i;return(a[o]*(1-fx)+a[o+1]*fx)*(1-fy)+(a[o+FW]*(1-fx)+a[o+FW+1]*fx)*fy};let use=new Uint8Array(nx*nz);for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)at(cover,(i+.5)/nx,(j+.5)/nz)>6&&(use[j*nx+i]=1);for(let pass=0;pass<grow;pass++){const next=use.slice();for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){if(use[j*nx+i])continue;const a=Math.max(0,i-1),b=Math.min(nx-1,i+1),c=Math.max(0,j-1),d=Math.min(nz-1,j+1);use[c*nx+a]|use[c*nx+i]|use[c*nx+b]|use[j*nx+a]|use[j*nx+b]|use[d*nx+a]|use[d*nx+i]|use[d*nx+b]&&(next[j*nx+i]=1)}use=next}let cells=0;for(let i=0;i<use.length;i++)cells+=use[i];const id=new Int32Array((nx+1)*(nz+1)).fill(-1),index=new Uint32Array(cells*6),P=new Float32Array(cells*4*3),A=new Float32Array(cells*4),F=new Float32Array(cells*4*3);let n=0,q=0;const e=1/FW,ev=1/FH,vertex=(i,j)=>{const key=j*(nx+1)+i;if(id[key]>=0)return id[key];const u=i/nx,v=j/nz,gx=at(phi,u+e,v)-at(phi,u-e,v),gz=at(phi,u,v+ev)-at(phi,u,v-ev),l=Math.hypot(gx,gz)||1;return P[n*3]=x0+u*sx,P[n*3+1]=0,P[n*3+2]=z0+v*sz,A[n]=at(phi,u,v),F[n*3]=-gx/l,F[n*3+1]=-gz/l,F[n*3+2]=at(hit,u,v)/255,id[key]=n++};for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){if(!use[j*nx+i])continue;const a=vertex(i,j),b=vertex(i+1,j),c=vertex(i,j+1),d=vertex(i+1,j+1);index[q++]=a,index[q++]=c,index[q++]=b,index[q++]=b,index[q++]=c,index[q++]=d}const g=new THREE.BufferGeometry;return g.setAttribute("position",new THREE.BufferAttribute(P.slice(0,n*3),3)),g.setAttribute("aPhi",new THREE.BufferAttribute(A.slice(0,n),1)),g.setAttribute("aFlow",new THREE.BufferAttribute(F.slice(0,n*3),3)),g.setIndex(new THREE.BufferAttribute(index,1)),g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.105,0),Math.hypot(sx,sz)/2+.5),g.boundingBox=new THREE.Box3(new THREE.Vector3(x0,.08,z0),new THREE.Vector3(x0+sx,.14,z0+sz)),{geometry:g,cells,vertices:n}}export async function createForestWater(renderer,options={}){const atlas=options.atlas||{},U=atlas.uniforms,reduced=!!options.reducedMotion,Q=new URLSearchParams(location.search),QL=window.__FLOW2_QUALITY__,start=QL?.start||"high";if(start==="low"||!U?.tWater?.value||!U?.tWaves?.value||!U?.tDetail?.value||!U?.tFlow?.value||!U?.uRvDeep||!atlas.bounds)return null;const AIR=(a=>a&&a.inMaterial&&typeof a.glsl=="string"&&a.uniforms?a:null)(options.shared||window.__FLOW2_FOREST_AIR__),DEFAULTS={on:Q.get("wsurf")==="1"?1:0,height:2,length:1,speed:1,river:1,lake:1,chop:1,relief:1,lap:1,points:.5,wetline:.5},tune=options.tune||{};for(const k in DEFAULTS)tune[k]===void 0&&(tune[k]=DEFAULTS[k]);options.panel!==!1&&window.__FLOW2_PANEL__?.add({id:"forestwsurf",title:"\u4FEF\u8996\u6C34\u9762",key:"n",tune,rows:[["\u7ACB\u9AD4\u6C34\u9762\uFF080\uFF1D\u539F\u672C\u7684\u6C34\uFF09","on",0,1,.01],["\u2014 \u6CE2\u6D6A\uFF08\u90FD\u5F88\u8F15\uFF1B\u6C34\u8272\u8207\u5012\u5F71\u5728\u300C\u68EE\u6797\u6C34\u6D41\u300D\uFF09\u2014"],["\u6CB3\u6D41\u7684\u9806\u6D41\u7D30\u6D6A","river",0,3,.01],["\u6E56\u9762\u7684\u5FAE\u6D6A","lake",0,3,.01],["\u6D41\u52D5\u901F\u5EA6","speed",0,3,.01],["\u6D6A\u9577","length",.5,2.5,.01],["\u9802\u9EDE\u8D77\u4F0F\u7684\u9AD8\u5EA6\uFF08\u500D\uFF09","height",0,6,.01],["\u6CE2\u9762\u5C0D\u5012\u5F71\u8207\u9583\u5149\u7684\u5F71\u97FF","chop",0,3,.01],["\u8FCE\u5149\u9762\u7684\u660E\u6697\uFF08\u7ACB\u9AD4\u611F\uFF09","relief",0,3,.01],["\u2014 \u5CB8\u908A \u2014"],["\u62CD\u5CB8\u6C34\u7DDA\u96A8\u6D6A\u8D77\u4F0F","lap",0,3,.01],["\u5CAC\u89D2\u7684\u767D\u6CAB","points",0,2,.01],["\u5CB8\u908A\u6FD5\u7DDA","wetline",0,2,.01]]});const c01=v=>Math.min(1,Math.max(0,+v||0)),state={stage:"loading",version:VERSION,tier:start,cells:0,vertices:0,buildMs:0,flow:"not loaded"},file=name=>new URL("./original/"+name+"?v="+VERSION,import.meta.url).href,OPT=document.documentElement.hasAttribute("data-flow2-opt")&&Q.get("aerialopt")!=="0",group=new THREE.Group;group.name="Forest water surface";let built=null,material=null,flowMap=null,uniforms=null,making=null;async function make(){const flowFile=(async()=>{try{let t;if(typeof createImageBitmap=="function"){const image=await new THREE.ImageBitmapLoader().setOptions({premultiplyAlpha:"none",colorSpaceConversion:"none"}).loadAsync(file("w2-flow.png"));t=new THREE.Texture(image),t.needsUpdate=!0}else t=await new THREE.TextureLoader().loadAsync(file("w2-flow.png"));return t.flipY=!1,t.colorSpace=THREE.NoColorSpace,t.generateMipmaps=!1,t.minFilter=t.magFilter=THREE.LinearFilter,t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping,t}catch{return null}})(),[head,buffer,flowMap0]=await Promise.all([fetch(file("w1-field.json")).then(r=>r.json()),fetch(file("w1-field.bin")).then(r=>r.arrayBuffer()),flowFile]);flowMap=flowMap0,state.flow=flowMap?"w2-flow.png":"none (one strength everywhere)";const t0=performance.now(),n=head.w*head.h;if(buffer.byteLength<n*5)throw new Error("w1-field.bin is not the expected size");const raw=new Uint16Array(buffer,0,n),phi=new Float32Array(n);for(let i=0;i<n;i++)phi[i]=raw[i]/65535*head.phiMax;const field={w:head.w,h:head.h,phi,cover:new Uint8Array(buffer,n*2,n),hit:new Uint8Array(buffer,n*3,n)},high=start==="high";if(built=waterGeometry(field,atlas.bounds,high?1e3:560,high?2:1),state.cells=built.cells,state.vertices=built.vertices,state.buildMs=Math.round(performance.now()-t0),flowMap&&renderer.initTexture)try{renderer.initTexture(flowMap)}catch{}uniforms={tPlate:U.tPlate,tWater:U.tWater,tFlow:U.tFlow,tGrow:U.tGrow,tDetail:U.tDetail,tWaves:U.tWaves,tRefl:U.tRefl,uReflMat:U.uReflMat,uBounds:U.uBounds,uView:U.uView,uSun:U.uSun,uGrow:U.uGrow,uVig:U.uVig,uHaze:U.uHaze,uDist:U.uDist,uTime:U.uTime,uWater:U.uWater,uRvSpeed:U.uRvSpeed,uRvWave:U.uRvWave,uRvRefl:U.uRvRefl,uRvSun:U.uRvSun,uRvFoam:U.uRvFoam,uRvBed:U.uRvBed,uRvFine:U.uRvFine,uRvDeep:U.uRvDeep,uRvSky:U.uRvSky,tW2Flow:{value:flowMap},uW1Flow:{value:new THREE.Vector2(flowMap?1:0,0)},uW1Time:{value:0},uW1Wave:{value:new THREE.Vector4(1,1,1,1)},uW1A:{value:new THREE.Vector4(0,1,1,0)},uW1B:{value:new THREE.Vector4(1,.5,.5,0)}},AIR&&Object.assign(uniforms,AIR.uniforms);const defs=v=>`#define W1_NR ${v?3:high?RIVER.length:3}
#define W1_NL ${v?2:high?LAKE.length:2}
`;material=new THREE.ShaderMaterial({uniforms,vertexShader:defs(!0)+VERT,fragmentShader:defs(!1)+(AIR?FRAG.replace("/*AIR*/",AIR.glsl):FRAG),defines:Object.assign({},AIR?{FOREST_AIR:1}:{},high?{W1_FINE:1}:{}),transparent:!0,depthTest:!0,depthWrite:!1,toneMapped:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-900});const mesh=new THREE.Mesh(built.geometry,material);mesh.name="Forest water surface (W1)",mesh.frustumCulled=!1,mesh.renderOrder=4,group.add(mesh),state.stage="ready"}let clock=reduced?7.3:0;const lazy=()=>{making||(state.stage="making",making=make().then(async()=>{const r=renderer;if(r.compileAsync&&atlas.scene&&atlas.camera){const tiny=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType}),was=r.getRenderTarget();let p=null;try{r.setRenderTarget(tiny),p=r.compileAsync(group,atlas.camera,atlas.scene)}catch{p=null}finally{r.setRenderTarget(was)}try{await p}catch{}tiny.dispose()}api.material=material,state.ready=!0}).catch(error=>{state.stage="failed: "+(error?.message||error),console.warn("Flow forest water surface: not made",error)}))};OPT&&!(c01(tune.on)>.003)?state.stage="deferred: made when \u7ACB\u9AD4\u6C34\u9762 is turned up (tune.on > 0)":(await make(),state.ready=!0);const api={group,tune,state,material,version:VERSION,update(frame={}){const rank=Number.isFinite(+QL?.rank)?+QL.rank:2,on=c01(tune.on)*c01(atlas.tune?.rv??1);if(state.tier=rank,group.visible=rank>0&&on>.003,!!group.visible){if(!state.ready){group.visible=!1,lazy();return}reduced||(clock+=Math.min(.05,Math.max(0,+frame.dt||0))*tune.speed),uniforms.uW1Time.value=clock,uniforms.uW1Wave.value.set(tune.height,tune.length,tune.river,tune.lake),uniforms.uW1A.value.set(on,tune.chop,tune.relief,0),uniforms.uW1B.value.set(tune.lap*3,tune.points,tune.wetline,0)}},dispose(){built?.geometry.dispose(),material?.dispose(),flowMap?.dispose(),flowMap?.image?.close?.()}};return api}