import*as THREE from"three";const VERSION=new URL(import.meta.url).searchParams.get("v")||"w2-1";export const FLOW_UNITS_PER_SECOND=.6;const PX_TO_WORLD=14/1494,LEVEL=.105,VERT=`
  attribute vec2 aSide; attribute vec4 aFlow, aLine; attribute vec3 aExt;
  uniform float uPixel,uLift,uTwist,uTwistR,uSense,uStreakW,uSoftW,uCurrentW,uEddyW,uWander;
  uniform vec3 uCentre; uniform vec4 uBounds;
  varying float vSide,vT,vS,vR,vSeed,vKind,vTotal,vEndR,vK,vLake;
  varying vec2 vUv;
  void main(){
    vec3 p=position; vec2 sd=aSide;
    /* the confluence's turn: the lines are wound a little more (or less) round the centre */
    vec2 q=p.xz-uCentre.xz; float r=length(q);
    float g=1.-smoothstep(0.,uTwistR,r); g*=g;
    float ang=uTwist*g*uSense, c=cos(ang), s=sin(ang);
    mat2 R=mat2(c,s,-s,c);
    q=R*q; sd=R*sd; p.xz=uCentre.xz+q; p.y=${LEVEL.toFixed(3)}+uLift;
    float kind=aExt.y;
    float px=kind>2.5?uCurrentW:kind>1.5?uEddyW:kind>.5?uSoftW:uStreakW;
    px*=aLine.y;
    float d=distance(cameraPosition,p);
    /* a thread does not run like a ruled line beside its neighbours: its path wanders a few pixels from side to side (still, not swaying) */
    float wander=kind<1.5?(sin(aFlow.y*2.1+aLine.x*40.)+.6*sin(aFlow.y*5.3+aLine.x*17.))*uWander:0.;
    p.xz+=sd*(aFlow.x*px+wander)*uPixel*d;
    vSide=aFlow.x; vT=aFlow.y; vS=aFlow.z; vR=r; vSeed=aLine.x; vK=aLine.z; vTotal=aLine.w; vEndR=aExt.x; vKind=kind; vLake=aExt.z;
    vUv=(p.xz-uBounds.xy)*uBounds.zw;
    gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
  }`,FRAG=`
  precision highp float;
  uniform sampler2D tWater,tGrow;
  uniform float uFlow,uGrow,uAmount,uStreak,uSoft,uCurrent,uPulse,uEddy,uVig,uHasGrow,uFoam,uFleck,uLakeIn,uLakeOut,uReach,uStreakReach;
  uniform vec4 uEmph,uView;
  varying float vSide,vT,vS,vR,vSeed,vKind,vTotal,vEndR,vK,vLake;
  varying vec2 vUv;
  float hash(float n){return fract(sin(n*12.9898)*43758.5453);}
  /* one train of marks carried with the water: every mark has its own length, place in its cell and strength; some cells are empty.
     x = the place inside the mark (0 tail \u2026 1 head) */
  float train(float t,float P,float seed,float lenMin,float lenMax,float amount,out float strength,out float x){
    float q=t/P+seed*31.7, n=floor(q), f=q-n;
    float h=hash(n*1.37+seed*91.3), h2=hash(n*2.11+seed*57.9+3.), h3=hash(n*.73+seed*13.1+7.);
    float L=mix(lenMin,lenMax,h2), o=h3*(1.-L); x=(f-o)/L;
    strength=.45+.55*h2;
    return step(0.,x)*step(x,1.)*(1.-smoothstep(amount-.12,amount+.02,h));
  }
  void main(){
    /* where the water is, and where it has arrived */
    float wm=smoothstep(.3,.62,texture2D(tWater,vUv).r);
    float wet=mix(1.,smoothstep(0.,.06,uGrow*3.-texture2D(tGrow,vUv).r),uHasGrow);
    /* the lake stays calm: everything dies away softly before the lake's middle (nothing round the centre) */
    float here=wm*wet*smoothstep(uLakeIn,uLakeOut,vR);
    if(here<.004)discard;
    float as=abs(vSide);
    float begin=smoothstep(0.,.5,vT), finish=1.-smoothstep(vTotal-.45,vTotal,vT);
    float t=vT-uFlow;
    vec3 col=vec3(0.); float alpha=0.;
    if(vKind>2.5){
      /* a luminous current: the canyon's beam drawn fine \u2014 a hair of light, a faint skirt, soft packets of light gliding down with the water;
         it ends softly as it enters the lake */
      float a=1.-as, core=pow(a,9.), glow=pow(a,2.6);
      float ph=fract(t/(3.4+vSeed*1.3)+vSeed*5.), ph2=fract(t/(2.3+vSeed*.6)+vSeed*9.+.37);
      float pulse=.34+uPulse*(.74*pow(ph,5.)+.30*pow(ph,1.7)+.22*pow(ph2,3.));
      float e=dot(uEmph,clamp(1.-abs(vK-vec4(0.,1.,2.,3.)),0.,1.));
      float k=uCurrent*e*begin*here*(1.-smoothstep(uReach*.15,uReach,vLake));
      col=(vec3(.86,.95,1.)*core*.95+vec3(.26,.58,1.)*glow*.20)*pulse*k;
      alpha=clamp((core*.34+glow*.04)*pulse*k,0.,.42);
    }else if(vKind>1.5){
      /* a small eddy in the lee of a point (off by default) */
      float st,x; float m=train(t,.9,vSeed,.3,.6,1.2,st,x);
      float a=1.-as, prof=a*a*(3.-2.*a);
      alpha=m*sin(3.14159*clamp(x,0.,1.))*st*prof*begin*finish*uEddy*.3*wm*wet;
      col=vec3(.80,.90,.97)*alpha;
    }else if(vKind>.5){
      /* soft light: a broad faint band carried down */
      float st,x; float m=train(t,5.2,vSeed,.35,.7,uAmount*.9,st,x);
      float a=1.-as, prof=a*a;
      float reach=1.-smoothstep(uStreakReach*.2,uStreakReach,vLake);
      float hump=sin(3.14159*clamp(x,0.,1.)); hump*=hump;
      alpha=m*hump*st*prof*begin*finish*reach*uSoft*.05*(.5+vS)*here;
      col=vec3(.62,.82,1.)*alpha*1.3; alpha*=.4;
    }else{
      /* threads and flecks: a long fine thread drawn out by the current (pointed at both ends, never a ruled dash) and small flecks of foam
         drifting with it; brighter and whiter where the water runs fast */
      float s1,x1,s2,x2;
      float m1=train(t,3.6,vSeed,.24,.66,uAmount*.6,s1,x1);
      float m2=train(t+11.,.62,vSeed+.37,.035,.085,uAmount*.36,s2,x2);
      float fast=smoothstep(.5,.92,vS);
      float reach=1.-smoothstep(uStreakReach*mix(.15,.5,vEndR),uStreakReach*mix(.45,1.,vEndR),vLake);
      /* the thread: its width swells from nothing to full and back; its strength rises slowly from the tail and falls quickly at the head */
      float w1=pow(sin(3.14159*clamp(x1,0.,1.)),.7);
      float p1=clamp(1.-as/max(w1*.62,.02),0.,1.);
      float body=smoothstep(0.,.55,x1)*(1.-smoothstep(.8,1.,x1));
      float thread=m1*s1*p1*body*.62;
      /* the fleck: a small soft dot */
      float w2=sin(3.14159*clamp(x2,0.,1.));
      float p2=clamp(1.-as/max(w2*(.55+.45*s2),.02),0.,1.);
      float fleck=m2*s2*p2*w2*(.55+.75*fast*uFoam)*uFleck;
      float m=max(thread,fleck);
      alpha=m*begin*finish*reach*uStreak*(.26+.5*vS)*here*(vK<-.5?.6:1.);
      col=mix(vec3(.66,.82,.96),vec3(.93,.97,1.),max(fast,step(thread,fleck)*.5))*alpha;
      alpha*=.6;
    }
    vec2 sc=(gl_FragCoord.xy-uView.xy)/uView.zw-.5;
    float vig=1.-uVig*smoothstep(.5,1.9,dot(sc,sc)*4.);
    if(alpha<.002&&dot(col,vec3(1.))<.003)discard;
    gl_FragColor=vec4(col*vig,alpha);
  }`;function mulberry(seed){let a=seed>>>0;return()=>{a|=0,a=a+1831565813|0;let t=Math.imul(a^a>>>15,1|a);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}const PERF_H=typeof document<"u"&&document.documentElement.hasAttribute("data-rise-studio-pbr")&&new URLSearchParams(location.search).get("perf")!=="0";let perfHKey="",perfH=0;const canvasHeight=renderer=>{if(!PERF_H)return renderer?.domElement?.clientHeight||innerHeight||900;const key=innerWidth+"x"+innerHeight;return(key!==perfHKey||!perfH)&&(perfHKey=key,perfH=renderer?.domElement?.clientHeight||innerHeight||900),perfH};export async function createForestFlow(renderer,options={}){const reduced=!!options.reducedMotion,atlas=options.atlas||{},DEFAULTS={on:1,speed:1,amount:.8,streak:1,streakWidth:1.5,wander:2.2,fleck:1,foam:1,soft:1,softWidth:8,current:1,currentWidth:3.2,pulse:1,active:1.7,others:.62,reach:.9,streakReach:1.5,lakeOut:1.5,eddy:0,lift:.012},tune=options.tune||{};for(const k in DEFAULTS)Number.isFinite(+tune[k])||(tune[k]=DEFAULTS[k]);options.panel!==!1&&window.__FLOW2_PANEL__?.add({id:"forestflow",title:"\u4FEF\u8996\u6C34\u6D41",key:"u",tune,rows:[["\u6C34\u6D41\uFF081 \u958B / 0 \u95DC\uFF09","on",0,1,1],["\u6D41\u901F","speed",0,2.5,.01],["\u2014 \u6D41\u7DDA\uFF08\u7D30\u7D72\u8207\u767D\u6CAB\uFF09\u2014"],["\u6D41\u7DDA\u6578\u91CF","amount",0,1.6,.01],["\u6D41\u7DDA\u4EAE\u5EA6","streak",0,2.5,.01],["\u6D41\u7DDA\u7C97\u7D30\uFF08px\uFF09","streakWidth",.6,4,.05],["\u6D41\u7DDA\u5DE6\u53F3\u6E38\u79FB\uFF08px\uFF09","wander",0,6,.1],["\u767D\u6CAB\u9EDE","fleck",0,2,.01],["\u6025\u6D41\u8655\u66F4\u767D","foam",0,2,.01],["\u67D4\u5149\u5E36\u4EAE\u5EA6","soft",0,3,.01],["\u67D4\u5149\u5E36\u5BEC\u5EA6\uFF08px\uFF09","softWidth",3,24,.5],["\u2014 \u56DB\u9053\u5149\u6D41\uFF08\u5EF6\u7E8C\u5CFD\u8C37\u7684\u56DB\u689D\u5149\u675F\uFF09\u2014"],["\u5149\u6D41\u4EAE\u5EA6","current",0,3,.01],["\u5149\u6D41\u7C97\u7D30\uFF08px\uFF09","currentWidth",1.5,10,.1],["\u6D41\u5149\u8108\u885D","pulse",0,2.5,.01],["\u76EE\u524D\u9805\u76EE\u90A3\u4E00\u689D\uFF08\u500D\uFF09","active",1,3,.01],["\u5176\u4ED6\u4E09\u689D\uFF08\u500D\uFF09","others",0,1,.01],["\u2014 \u5165\u6E56\uFF08\u6E56\u9762\u4FDD\u6301\u5E73\u975C\uFF09\u2014"],["\u5149\u6D41\u5165\u6E56\u5F8C\u5EF6\u4F38\u591A\u9060","reach",.1,2.5,.01],["\u6D41\u7DDA\u5165\u6E56\u5F8C\u5EF6\u4F38\u591A\u9060","streakReach",.1,3,.01],["\u6E56\u5FC3\u6DE8\u7A7A\u534A\u5F91","lakeOut",.6,3,.01],["\u6CB3\u53E3\u5C0F\u6E26\uFF080 \u95DC\uFF09","eddy",0,1,.01],["\u96E2\u6C34\u9762\u9AD8\u5EA6","lift",0,.06,.001]]});const state={stage:"loading",tier:2,version:VERSION,lines:0,vertices:0,triangles:0,active:-1,flow:0},response=await fetch(new URL("./original/w2-streamlines.json?v="+VERSION,import.meta.url).href);if(!response.ok)throw new Error("w2-streamlines.json "+response.status);const data=await response.json(),bounds=atlas.uniforms?.uBounds?.value||new THREE.Vector4(-7,-3.917,1/14,1/7.834),toWorld=(u,v)=>[bounds.x+u/bounds.z,bounds.y+v/bounds.w],centre=toWorld(data.centre[0],data.centre[1]),P=[],S=[],F=[],Ln=[],E=[],I=[],rand=mulberry(20261116);let vcount=0;function ribbon(pts,kind,k,widthScale,endR,seed){const n=pts.length;if(n<2)return;const total=pts[n-1][2],base=vcount;for(let i=0;i<n;i++){const a=pts[Math.max(i-1,0)],b=pts[Math.min(i+1,n-1)];let tx=b[0]-a[0],tz=b[1]-a[1];const len=Math.hypot(tx,tz)||1;tx/=len,tz/=len;const p=pts[i],r=Math.hypot(p[0]-centre[0],p[1]-centre[1]);for(let side=-1;side<=1;side+=2)P.push(p[0],LEVEL,p[1]),S.push(-tz,tx),F.push(side,p[2],p[3],r),Ln.push(seed,widthScale,k,total),E.push(endR,kind,p[4]||0);if(i<n-1){const v=base+i*2;I.push(v,v+2,v+1,v+1,v+2,v+3)}}vcount+=n*2,state.lines++}const line=entry=>entry.pts.map(([u,v,t,s,l])=>{const w=toWorld(u,v);return[w[0],w[1],t*PX_TO_WORLD,s,(l||0)*PX_TO_WORLD]});for(const r of data.rivers)ribbon(line(r.current),3,r.k,1,0,.13+r.k*.21);const mediumRest=[],highRest=[];for(const r of data.rivers)r.lines.forEach((l,i)=>{const pts=line(l),seed=rand(),endR=rand(),w=.8+.5*rand();(i%2===0?mediumRest:highRest).push(()=>ribbon(pts,0,r.k,w,endR,seed)),i%3===1&&highRest.push(()=>ribbon(pts,1,r.k,.8+.5*rand(),rand(),rand()))});(data.lake_lines||[]).forEach((l,i)=>{const pts=line(l),seed=rand(),endR=rand(),w=.8+.4*rand();(i%2===0?mediumRest:highRest).push(()=>ribbon(pts,0,-1,w,endR,seed))});for(const e of data.eddies||[]){const c=toWorld(e.uv[0],e.uv[1]),R0=e.radius_px*PX_TO_WORLD,turns=1.55,n=44;for(let arm=0;arm<2;arm++){const pts=[];let tw=0,prev=null;for(let i=0;i<n;i++){const f=i/(n-1),ang=arm*Math.PI+e.turn*f*turns*Math.PI*2,rr=R0*(1-.74*f),p=[c[0]+Math.cos(ang)*rr,c[1]+Math.sin(ang)*rr];prev&&(tw+=Math.hypot(p[0]-prev[0],p[1]-prev[1])/.16),pts.push([p[0],p[1],tw,.25,0]),prev=p}highRest.push(()=>ribbon(pts,2,-1,1,0,rand()))}}const currentsIndexCount=I.length;mediumRest.forEach(make=>make());const mediumIndexCount=I.length;highRest.forEach(make=>make());const geometry=new THREE.BufferGeometry;geometry.setAttribute("position",new THREE.Float32BufferAttribute(P,3)),geometry.setAttribute("aSide",new THREE.Float32BufferAttribute(S,2)),geometry.setAttribute("aFlow",new THREE.Float32BufferAttribute(F,4)),geometry.setAttribute("aLine",new THREE.Float32BufferAttribute(Ln,4)),geometry.setAttribute("aExt",new THREE.Float32BufferAttribute(E,3)),geometry.setIndex(vcount>65535?new THREE.Uint32BufferAttribute(I,1):new THREE.Uint16BufferAttribute(I,1)),geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,LEVEL,0),9),state.vertices=vcount,state.triangles=I.length/3;const U=atlas.uniforms||{},blank=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);blank.needsUpdate=!0;const uniforms={tWater:U.tWater?.value?U.tWater:{value:blank},tGrow:U.tGrow?.value?U.tGrow:{value:blank},uHasGrow:{value:U.tGrow?.value?1:0},uGrow:U.uGrow||{value:1},uBounds:U.uBounds||{value:bounds},uView:U.uView||{value:new THREE.Vector4(0,0,1,1)},uVig:U.uVig||{value:0},uCentre:{value:new THREE.Vector3(centre[0],LEVEL,centre[1])},uSense:{value:data.sense||1},uTwist:{value:0},uTwistR:{value:1.05},uPixel:{value:.001},uLift:{value:tune.lift},uFlow:{value:0},uAmount:{value:1},uStreak:{value:1},uSoft:{value:1},uCurrent:{value:1},uPulse:{value:1},uEddy:{value:0},uFoam:{value:1},uFleck:{value:1},uLakeIn:{value:.8},uLakeOut:{value:1.5},uReach:{value:.9},uStreakReach:{value:1.5},uWander:{value:2.2},uEmph:{value:new THREE.Vector4(1,1,1,1)},uStreakW:{value:1.5},uSoftW:{value:9},uCurrentW:{value:5.5},uEddyW:{value:1.3}},material=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,uniforms,transparent:!0,depthTest:!0,depthWrite:!1,side:THREE.DoubleSide,toneMapped:!1,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor}),mesh=new THREE.Mesh(geometry,material);mesh.name="Forest water flow (W2)",mesh.frustumCulled=!1,mesh.renderOrder=8;const group=new THREE.Group;group.name="Flow2 water flow",group.add(mesh);const emph=[1,1,1,1];let flow=reduced?7.3:0,tier=2;const api={group,tune,state,uniforms,data,setTier(rank){tier=rank},update(frame={}){const q=window.__FLOW2_QUALITY__;q&&Number.isFinite(+q.rank)&&(tier=+q.rank),state.tier=tier;const on=tier>0&&tune.on>=.5;if(group.visible=on,!on)return;const dt=Math.min(Math.max(+frame.dt||0,0),.05),camera=frame.camera||atlas.camera;reduced||(flow+=dt*FLOW_UNITS_PER_SECOND*tune.speed),uniforms.uFlow.value=flow,state.flow=flow;const h=canvasHeight(renderer);camera&&(uniforms.uPixel.value=2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/Math.max(1,h));const active=Number.isInteger(frame.state?.active)?frame.state.active:-1;state.active=active;const ease=reduced?1:1-Math.exp(-dt*3.2);for(let k=0;k<4;k++){const want=active<0?1:active===k?tune.active:tune.others;emph[k]+=(want-emph[k])*ease}uniforms.uEmph.value.fromArray(emph);const medium=tier<2;uniforms.uAmount.value=tune.amount*(medium?.8:1),uniforms.uStreak.value=tune.streak,uniforms.uSoft.value=tune.soft,uniforms.uCurrent.value=tune.current,uniforms.uPulse.value=tune.pulse,uniforms.uEddy.value=tune.eddy,uniforms.uFoam.value=tune.foam,uniforms.uLift.value=tune.lift,uniforms.uLakeIn.value=tune.lakeOut*.55,uniforms.uLakeOut.value=tune.lakeOut,uniforms.uReach.value=tune.reach,uniforms.uStreakReach.value=tune.streakReach,uniforms.uWander.value=tune.wander,uniforms.uFleck.value=tune.fleck,uniforms.uStreakW.value=tune.streakWidth,uniforms.uSoftW.value=tune.softWidth,uniforms.uCurrentW.value=tune.currentWidth,uniforms.uEddyW.value=tune.streakWidth*.9,geometry.setDrawRange(0,medium?mediumIndexCount:I.length)},dispose(){geometry.dispose(),material.dispose(),blank.dispose(),group.removeFromParent()}};return state.stage="ready",state.currentsIndexCount=currentsIndexCount,state.mediumIndexCount=mediumIndexCount,window.__FLOW2_WATER_FLOW__={tune,state,uniforms,unitsPerSecond:FLOW_UNITS_PER_SECOND,data},api.update({dt:0}),api}