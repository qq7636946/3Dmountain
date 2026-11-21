import*as THREE from"three";const VERSION=new URL(import.meta.url).searchParams.get("v")||"bm-1",LEVEL=.105,MAXLINES=24,VERT=`
  attribute vec2 aSide; attribute vec4 aA, aB; attribute float aCurv;
  uniform float uPixel,uLift,uHalfTrunk,uHalfTrib,uWeave,uWeaveLen,uHeads[${MAXLINES}],uStops[${MAXLINES}],uRelief,uMeetR,uLakeSoft;
  uniform sampler2D tWater,tCanopy; uniform vec4 uBounds; uniform vec2 uYRange;
  varying float vSide,vS,vHead,vKind,vK,vSeed,vHalf,vPxW,vLen,vJoin,vStop;
  varying vec2 vUv; varying vec3 vWorld;
  void main(){
    vec3 p=position; float kind=aB.x;
    vec2 uv=(p.xz-uBounds.xy)*uBounds.zw;
    float lk=0.;
    if(kind<.5){
      /* a trunk weaves a little inside its river (the distance to the shore at this point: G = sqrt(d / 56 px)) */
      vec3 wt=texture2D(tWater,uv).rgb;
      lk=smoothstep(.35,.8,wt.b);                              /* in the lake (the glow widens there: so must the ribbon) */
      float hw=wt.g*wt.g*56.*14./1494.;
      float lake=1.-smoothstep(.25,.7,wt.b);
      p.xz+=aSide*sin(aA.y*6.2832/uWeaveLen+aB.z*9.)*uWeave*min(hw,.09)*lake;
    }else{
      /* a tributary lies on the ground (the relief the land is drawn with) */
      vec3 c=texture2D(tCanopy,uv).rgb; float ground=uYRange.x+c.r*uYRange.y;
      p.y=max(.105+(ground-.105)*uRelief,.105);
    }
    p.y+=uLift;
    float d=distance(cameraPosition,p), pxw=uPixel*d;
    float hpx=kind>.5?uHalfTrib:uHalfTrunk*(1.+.5*uLakeSoft*lk);
    /* on the inside of a bend the ribbon must not reach past the bend's centre (it would fold over itself and the added light would show the
       fold as a fan of streaks): aCurv = the curvature toward this vertex's side (1 / radius, world units) */
    float off=hpx*pxw; if(aCurv>1e-3)off=min(off,.8/aCurv);
    p.xz+=aSide*aA.x*off;
    vSide=aA.x*off/max(hpx*pxw,1e-6); vS=aA.y; vLen=aA.z; vJoin=aA.w; vKind=kind; vK=aB.y; vSeed=aB.z; vHalf=hpx; vPxW=pxw;
    int line=int(aB.w+.5);
    vHead=uHeads[line];
    vStop=uStops[line];
    if(vStop>0.)vJoin=vStop;
    vUv=(p.xz-uBounds.xy)*uBounds.zw; vWorld=p;
    gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
  }`,FRAG=`
  precision highp float;
  uniform sampler2D tWater;
  uniform float uTime,uBright,uCoreW,uInnerW,uHaloW,uWideW,uCoreI,uInnerI,uHaloI,uWideI,uLandHalo,uPulse,uSpacing,uSpeed,uHeadLen,uHeadI,uTribI,uTribW,uGlint,uFadeIn,uShimmer,
    uMeet,uMeetI,uMeetR,uLakeSoft,uTribPulse,uVary;
  uniform vec3 uColCore,uColInner,uColHalo,uColWide;
  uniform vec4 uEmph;
  #ifdef STUDIO_CURRENT
  uniform float uFilaments,uSparkDensity,uSoftClip,uPacketLength;
  uniform vec4 uRouteFocus;
  #endif
  varying float vSide,vS,vHead,vKind,vK,vSeed,vHalf,vPxW,vLen,vJoin,vStop;
  varying vec2 vUv; varying vec3 vWorld;
  float bh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){
    if(vStop>0. && vS>=vStop)discard;
    float ahead=vHead-vS;                                  /* world units behind the head (> 0 = lit) */
    float px=max(vPxW,1e-6);
    float trib=step(.5,vKind);
    /* the head is a ROUND cap: ahead of it every layer falls off by its own width (r = the distance to the head's point in px), so no straight
       cut runs across the wide halo (four heads nearing the lake's centre left a polygon of unlit water between their cuts) */
    float an=min(ahead+(1.-trib)*step(vJoin-.005,vHead)*1e3,0.)/px;   /* a trunk whose head has reached the centre has no head cap (the centre's cap below) */
    if(an<-110.)discard;
    /* a trunk runs on past the lake's centre (vJoin = the centre's place on it) and ends there in a round cap: the four caps share one middle,
       so where the four meet their light is one round pool (THE MEETING), with no square, seam or cut */
    float past=(1.-trib)*max(vS-vJoin,0.)/px;
    float front=1.;
    vec3 wt=texture2D(tWater,vUv).rgb;
    float water=smoothstep(.25,.6,wt.r), lake=smoothstep(.35,.8,wt.b)*(1.-trib);
    /* in the lake the light spreads: the core thins, the glow widens, and the last stretch to the centre melts into the pool */
    float toEnd=mix(vJoin,vLen,trib)-vS, melt=(1.-trib)*(1.-smoothstep(.05,.9,toEnd))*uMeet;   /* to the lake's centre (trunk) / the junction (tributary); smoothstep edges always rising */
    float x=abs(vSide)*vHalf;                               /* css px from the line */
    float r=sqrt(x*x+an*an+past*past);                       /* \u2026 and from the head's cap / the centre's cap */
    float wscale=mix(1.,uTribW,trib)*(1.+lake*uLakeSoft*.5);
    float xc=r/(uCoreW*wscale), xi=r/(uInnerW*wscale);
    float core=exp(-min(xc*xc,60.));
    float inner=exp(-min(xi*xi,60.));
    float halo=exp(-r/(uHaloW*wscale));
    float wide=exp(-r/(uWideW*wscale));
    float edge=1.-smoothstep(.6,1.,abs(vSide));              /* the ribbon's own edge never shows */
    /* packets of light carried downstream: a bright front, a long soft tail (two trains, their own spacing) */
    float t=vS-uTime*uSpeed;
    float ph=fract(t/uSpacing+vSeed*7.13), ph2=fract(t/(uSpacing*.41)+vSeed*3.71+.37);
    float pk=pow(ph,10.)+.32*pow(ph,2.4)+.4*pow(ph2,16.);
    float flow=1.+uPulse*(pk-.28)*mix(1.,uTribPulse,trib);
    /* a tributary is its travelling light: short comets running down the valley to the trunk over a barely-there thread (never a white road) */
    float tt=vS-uTime*uSpeed*1.25, q1=fract(tt/(uSpacing*.55)+vSeed*5.3), q2=fract(tt/(uSpacing*.31)+vSeed*2.9+.5);
    flow=mix(flow,.07+uPulse*uTribPulse*(pow(q1,7.)*1.7+pow(q2,12.)*.8),trib);
    #ifdef STUDIO_CURRENT
    // Smooth asymmetric packets: a rounded crest and a long trailing wake.
    // Increasing vS follows the authored source-to-confluence river path.
    float packetPhase=fract(t/uSpacing+vSeed*1.37)-.5;
    float packetWidth=mix(.15,.052,step(0.,packetPhase))*uPacketLength;
    float packet=exp(-pow(packetPhase/max(.015,packetWidth),2.));
    float echoPhase=fract((vS-uTime*uSpeed*.92)/(uSpacing*.79)+vSeed*3.12)-.5;
    float echo=exp(-pow(echoPhase/max(.02,.075*uPacketLength),2.))*.28;
    flow=mix(.60+uPulse*(packet+echo)*1.22,.055+uPulse*uTribPulse*(packet+echo)*.9,trib);
    #endif
    /* the light is never even along the river: slow swells of brightness (it reads as light on water, not a ruled line) */
    float vary=1.-uVary*(.5-.5*sin(vS*2.3+vSeed*17.)*sin(vS*.83+vSeed*5.));
    /* the light trembles on the moving water */
    float shim=1.+uShimmer*(.5*sin(vS*173.-uTime*7.3+vSeed*40.)+.5*sin(vS*61.+uTime*4.1+vSeed*13.))*.5;
    #ifdef STUDIO_CURRENT
    shim=1.+uShimmer*(sin(vS*21.-uTime*.7+vSeed*9.)+sin(vS*8.+uTime*.4+vSeed*3.))*.25;
    #endif
    /* the head: the brightest point, a round flare that leads the beam */
    float hs=ahead/px, hb=max(hs,0.);                         /* px behind the head (signed / behind only) */
    float done=smoothstep(mix(vJoin,vLen,trib)-.35,mix(vJoin,vLen,trib)-.02,vHead);   /* the head has arrived (the trunk at the centre, a tributary at its junction): it retires */
    float behind=step(0.,hs);                                 /* nothing of the hot line exists ahead of the head: only its round flare */
    float headK=exp(-hb/uHeadLen)*(1.-done)*behind;
    float flare=exp(-(hs*hs+x*x)/(uHeadLen*uHeadLen*.5))*(1.-done)*mix(1.,.45,trib);
    float fade=smoothstep(0.,uFadeIn*(1.+trib*1.4),vS)*front;
    /* the step's field at FOUR PATHS is the brightest, the others stand back (uEmph per trunk) */
    vec4 kk=vec4(equal(vec4(floor(vK+.5)),vec4(0.,1.,2.,3.)));
    float em=dot(uEmph,kk);
    #ifdef STUDIO_CURRENT
    em*=1.+.4*dot(uRouteFocus,kk);
    #endif
    /* a tributary's light is gone just before its junction (it merges); a trunk's light gathers at the centre instead: the meeting */
    float endFade=mix(1.,smoothstep(0.,.06,toEnd),trib);
    if(vStop>0.)endFade*=1.-smoothstep(vStop-.055,vStop,vS);
    float meetK=(1.-trib)*uMeet*uMeetI*exp(-max(toEnd,0.)/max(uMeetR,.05));
    float amp=uBright*em*mix(1.,uTribI,trib)*fade*vary*endFade;
    float body=flow*shim;
    /* into the lake the hot core gives way over the last stretch to the centre: the light gathers as a glow there (the pool), not a crossing of lines */
    float coreK=(1.-.45*lake)*mix(1.,smoothstep(.0,1.15,toEnd),lake)*(1.-.85*melt);
    coreK*=mix(1.,.6,trib);
    core*=behind;                                            /* the hot line ends at its head; the flare rounds it */ inner*=mix(behind,1.,step(vJoin-.005,vHead)*(1.-trib));
    vec3 col=uColCore*core*uCoreI*body*coreK*(1.+headK*uHeadI)
            +uColInner*inner*uInnerI*body*(1.-.4*melt)*(1.+headK*uHeadI*.6+meetK*.6)
            +uColHalo*halo*uHaloI*mix(uLandHalo,1.,max(water,trib*.8))*mix(.7+.3*flow,flow*1.5,trib)*(1.+headK*uHeadI*.5+meetK*.9)
            +uColWide*wide*uWideI*mix(.0,1.,water)*(.65+.35*flow)*(1.+.3*lake+meetK*1.2);
    col+=uColCore*flare*uHeadI*.9;
    #ifdef STUDIO_CURRENT
    // Two fine, slowly braiding reflections remain inside the existing ribbon.
    // No extra geometry, shadow pass, or renderer is needed for the fine currents.
    float signedX=vSide*vHalf;
    float braid=sin(vS*2.1-uTime*.18+vSeed*9.)*2.1*wscale;
    float fineW=max(.38,fwidth(signedX)*.6);
    float hair=exp(-pow((signedX-braid)/fineW,2.))+
               exp(-pow((signedX+braid*1.45+1.4*wscale)/fineW,2.))*.45;
    col+=uColInner*hair*uFilaments*(.14+.86*packet)*water*behind*coreK*(1.-trib)*.38;
    #endif
    /* glints on the water beside the beam: small points that twinkle as the surface turns */
    if(uGlint>0.){
      #ifdef STUDIO_CURRENT
      vec2 g=vWorld.xz*38., cell=floor(g), f=fract(g)-.5;
      float h=bh(cell+vSeed), tw=.5+.5*sin(uTime*(.55+.6*h)+h*61.);
      float aa=max(.025,length(fwidth(g))*.3);
      float dotShape=1.-smoothstep(.055,.23+aa,length(f));
      float gl=step(1.-uSparkDensity,h)*dotShape*pow(tw,5.)*water*wide*(1.-core);
      col+=uColInner*gl*uGlint*1.6;
      #else
      vec2 g=vWorld.xz*95.; vec2 cell=floor(g), f=fract(g)-.5;
      float h=bh(cell+vSeed);
      float tw=.5+.5*sin(uTime*(2.3+4.1*h)+h*61.);
      float gl=step(.9,h)*(1.-smoothstep(0.,.3,length(f)))*pow(tw,8.)*water*wide*(1.-core);
      col+=uColInner*gl*uGlint*2.2;
      #endif
    }
    vec3 c=col*amp*edge;
    /* never take light away: a negative or NaN value here darkened the water ahead of the heads (D3D; seen at journey 12.45) */
    if(!(c.r+c.g+c.b>=0.)||!(c.r+c.g+c.b<1e4))c=vec3(0.);
    #ifdef STUDIO_CURRENT
    float peak=max(c.r,max(c.g,c.b));
    c*=(1.-exp(-peak/max(.2,uSoftClip)))*max(.2,uSoftClip)/max(peak,.00001);
    #endif
    gl_FragColor=vec4(max(c,vec3(0.)),0.);
  }`;function resample(pts,step){const out=[pts[0]];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let j=1;j<=n;j++)out.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n])}return out}function smoothLine(pts,w){if(w<1)return pts;const out=pts.map((p,i)=>{let x=0,z=0,n=0;for(let j=Math.max(0,i-w);j<=Math.min(pts.length-1,i+w);j++)x+=pts[j][0],z+=pts[j][1],n++;return[x/n,z/n]});return out[0]=pts[0],out[out.length-1]=pts[pts.length-1],out}const lengths=pts=>{const c=[0];for(let i=1;i<pts.length;i++)c.push(c[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return c};function firstOutlineCrossing(trunk,outlines,bounds){const{pts,cum}=trunk,cross=(ax,az,bx,bz)=>ax*bz-az*bx;for(let i=1;i<pts.length;i++){const[x,z]=pts[i-1],[nx,nz]=pts[i];if(Math.max(x,nx)<bounds.minX||Math.min(x,nx)>bounds.maxX||Math.max(z,nz)<bounds.minZ||Math.min(z,nz)>bounds.maxZ)continue;const dx=nx-x,dz=nz-z;let first=1/0;for(const ring of outlines)for(let j=0;j<ring.length;j++){const[rx,rz]=ring[j],[tx,tz]=ring[(j+1)%ring.length],ex=tx-rx,ez=tz-rz,denom=cross(dx,dz,ex,ez);if(Math.abs(denom)<1e-8)continue;const along=cross(rx-x,rz-z,ex,ez)/denom,across=cross(rx-x,rz-z,dx,dz)/denom;along>=0&&along<=1&&across>=0&&across<=1&&(first=Math.min(first,along))}if(Number.isFinite(first))return cum[i-1]+first*(cum[i]-cum[i-1])}return 0}const PERF_H=typeof document<"u"&&document.documentElement.hasAttribute("data-rise-studio-pbr")&&new URLSearchParams(location.search).get("perf")!=="0";let perfHKey="",perfH=0;const canvasHeight=renderer=>{if(!PERF_H)return renderer?.domElement?.clientHeight||innerHeight||900;const key=innerWidth+"x"+innerHeight;return(key!==perfHKey||!perfH)&&(perfHKey=key,perfH=renderer?.domElement?.clientHeight||innerHeight||900),perfH};export async function createRiverBeams(renderer,options={}){const Q=new URLSearchParams(location.search),reduced=!!options.reducedMotion,atlas=options.atlas||{},PAN=window.__FLOW2_AERIAL_PAN__||null,DEFAULTS={on:1,bright:1,coreWidth:1.2,innerWidth:3.4,halo:1,haloWidth:8,wide:1.5,wideWidth:24,landHalo:.3,speed:1,spacing:.9,pulse:1,shimmer:.5,glint:1,headLen:22,head:1.2,vary:.35,tribs:Q.get("beamTribs")==="0"?0:1,tribBright:.5,tribWidth:.55,tribPulse:1.4,weave:.35,weaveLen:2.2,smooth:.2,colour:"#d9f1ff",glow:"#4d9dff",lead:.55,active:1.55,others:.55,meet:1,meetSize:.55,lakeSoft:.6,meander:1,tilt:Q.get("tilt")==="0"?0:6,tiltFrom:.42},tune=options.tune||{};if(options.refined){const studioDefaults={bright:.98,coreWidth:.95,innerWidth:2.8,halo:.82,haloWidth:10,wide:.75,wideWidth:24,landHalo:.06,speed:.85,spacing:2.5,pulse:1.3,shimmer:.12,glint:1,headLen:18,head:.7,vary:.18,tribBright:.4,tribWidth:.48,tribPulse:1,weave:.18,colour:"#e3f7ff",glow:"#68bded",meet:.65,lakeSoft:.5,filaments:1.1,sparkDensity:.24,softClip:1.45,packetLength:1};for(const key in studioDefaults)tune[key]===void 0&&(tune[key]=studioDefaults[key])}for(const k in DEFAULTS)tune[k]===void 0&&(tune[k]=DEFAULTS[k]);PAN&&PAN.td&&(tune.pan=PAN.tune),options.panel!==!1&&window.__FLOW2_PANEL__?.add({id:"riverbeams",title:"\u6CB3\u6D41\u5149\u675F",key:"g",tune,rows:[["\u5149\u675F\uFF081 \u958B / 0 \u95DC\uFF09","on",0,1,1],["\u6574\u9AD4\u4EAE\u5EA6","bright",0,3,.01],["\u2014 \u5149\u7684\u8CEA\u611F \u2014"],["\u6838\u5FC3\u7C97\u7D30\uFF08px\uFF09","coreWidth",.4,4,.05],["\u5167\u5149\u7C97\u7D30\uFF08px\uFF09","innerWidth",1,10,.1],["\u5149\u6688\u5F37\u5EA6","halo",0,3,.01],["\u5149\u6688\u5BEC\u5EA6\uFF08px\uFF09","haloWidth",2,30,.5],["\u6C34\u9762\u4E0A\u7684\u5149\uFF08\u53EA\u5728\u6C34\u4E0A\uFF09","wide",0,3,.01],["\u6C34\u9762\u5149\u5BEC\u5EA6\uFF08px\uFF09","wideWidth",4,60,.5],["\u5CB8\u4E0A\u4E5F\u6709\u5149\u6688\uFF080\uFF1D\u53EA\u5728\u6C34\u4E0A\uFF09","landHalo",0,1,.01],["\u6838\u5FC3\u984F\u8272","colour","color"],["\u5149\u6688\u984F\u8272","glow","color"],["\u2014 \u6D41\u52D5 \u2014"],["\u6D41\u901F","speed",0,4,.01],["\u5149\u5718\u9593\u8DDD\uFF08\u4E16\u754C\u55AE\u4F4D\uFF09","spacing",.2,3,.01],["\u5149\u5718\u5F37\u5EA6","pulse",0,3,.01],["\u6C34\u9762\u986B\u52D5","shimmer",0,2,.01],["\u6C34\u9762\u9583\u5149","glint",0,3,.01],["\u4EAE\u6697\u8D77\u4F0F\uFF08\u4E0D\u50CF\u4E00\u689D\u756B\u7684\u7DDA\uFF09","vary",0,1,.01],["\u5149\u982D\u4EAE\u5EA6","head",0,4,.01],["\u5149\u982D\u9577\u5EA6\uFF08px\uFF09","headLen",4,120,1],["\u5728\u6CB3\u9053\u5167\u5DE6\u53F3\u64FA\u52D5","weave",0,1.5,.01],["\u64FA\u52D5\u7684\u6CE2\u9577","weaveLen",.3,5,.05],["\u5149\u982D\u9818\u5148\u93E1\u982D\uFF08\u4E16\u754C\u55AE\u4F4D\uFF09","lead",0,2,.01],["\u2014 \u652F\u6D41 \u2014"],["\u652F\u6D41\uFF081 \u958B / 0 \u95DC\uFF09","tribs",0,1,1],["\u652F\u6D41\u873F\u8712\uFF08\u91CD\u65B0\u6574\u7406\u5F8C\u751F\u6548\uFF09","meander",0,3,.05],["\u652F\u6D41\u4EAE\u5EA6\uFF08\xD7 \u4E3B\u6D41\uFF09","tribBright",0,1.5,.01],["\u652F\u6D41\u7C97\u7D30\uFF08\xD7 \u4E3B\u6D41\uFF09","tribWidth",.3,1.2,.01],["\u652F\u6D41\u4E0A\u7684\u6D41\u5149","tribPulse",0,3,.01],["\u2014 \u6E56\u5FC3\u6703\u5408 \u2014"],["\u6703\u5408\u5149","meet",0,3,.01],["\u6703\u5408\u5149\u5927\u5C0F\uFF08\u4E16\u754C\u55AE\u4F4D\uFF09","meetSize",.1,1.5,.01],["\u5165\u6E56\u5F8C\u5149\u6563\u958B","lakeSoft",0,2,.01],["\u2014 \u756B\u9762\u4E0A\u4E0B\u666F\u6DF1\uFF08\u79FB\u8EF8\uFF09\u2014"],["\u4E0A\u4E0B\u6A21\u7CCA\uFF08px\uFF0C0\uFF1D\u95DC\uFF09","tilt",0,20,.5],["\u6E05\u695A\u7684\u4E2D\u9593\u5E36\uFF08\u8D8A\u5927\u8D8A\u5BEC\uFF09","tiltFrom",0,.9,.01],["\u2014 FOUR PATHS \u2014"],["\u76EE\u524D\u9805\u76EE\u90A3\u4E00\u689D\uFF08\u500D\uFF09","active",1,3,.01],["\u5176\u4ED6\u4E09\u689D\uFF08\u500D\uFF09","others",0,1,.01],...tune.pan?[["\u2014 \u93E1\u982D\uFF1A\u6CBF\u6CB3\u5F80\u4E0B\uFF08\u4FEF\u8996\uFF09\u2014"],["\u958B\u59CB\uFF08\u65C5\u7A0B\u6642\u9418\uFF1B\u8F49\u5834\u843D\u5728 8.96\uFF09","pan.from",8.5,9.6,.01],["\u7D50\u675F\uFF08\u5347\u5230\u6E56\u4E0A\uFF1BFOUR PATHS 9.66\uFF09","pan.to",9.3,10.18,.01],["\u6CBF\u6CB3\u7684\u90E8\u5206\uFF08\u5176\u9918\u662F\u5347\u8D77\uFF09","pan.rise",.2,.95,.01],["\u6CBF\u6CB3\u8D77\u9EDE\uFF080\uFF1D\u6E90\u982D\uFF0C1\uFF1D\u6E56\u5FC3\uFF09","pan.q0",0,.9,.01],["\u6CBF\u6CB3\u7D42\u9EDE","pan.q1",.1,1,.01],["\u6CBF\u6CB3\u6642\u7684\u93E1\u982D\u8DDD\u96E2\uFF08\u5C0F\uFF1D\u8FD1\uFF09","pan.zoom",.2,1.2,.01],["\u6E56\u4E0A\u7684\u93E1\u982D\u8DDD\u96E2","pan.zoomEnd",.5,1.6,.01],["\u4FEF\u89D2\uFF080\uFF1D\u6B63\u4E0A\u65B9\uFF09","pan.tilt",1.5,30,.1],["\u5DE6\u53F3\u50BE\u659C","pan.lean",-20,20,.5],["\u6CBF\u6CB3\u6642\u7684\u65B9\u5411\uFF08\u5EA6\uFF1B\u6CB3\u6C34\u5F80\u4E0B\u6D41\uFF09","pan.turn",-180,180,1],["\u6E56\u4E0A\u7684\u65B9\u5411\uFF08\u5EA6\uFF09","pan.endTurn",-180,180,1],["\u6CB3\u6D41\u504F\u53F3\uFF08\u4E16\u754C\u55AE\u4F4D\uFF09","pan.offset",-1.5,1.5,.01],["\u93E1\u982D\u8DEF\u7DDA\u5E73\u6ED1","pan.smooth",0,1.5,.01]]:[]]});const bounds=atlas.uniforms?.uBounds?.value||new THREE.Vector4(-7,-3.917,1/14,1/7.834),toWorld=(u,v)=>[bounds.x+u/bounds.z,bounds.y+v/bounds.w];let w2=window.__FLOW2_WATER_FLOW__?.data||null;if(!w2){const r=await fetch(new URL("./original/w2-streamlines.json?v="+VERSION,import.meta.url).href);r.ok&&(w2=await r.json())}const tribFile=await fetch(new URL("./flow2-river-beams.json?v="+VERSION,import.meta.url).href).then(r=>r.ok?r.json():null).catch(()=>null),lake=atlas.lake?.center?[atlas.lake.center.x,atlas.lake.center.z]:w2?toWorld(w2.centre[0],w2.centre[1]):[.12,-.06],trunks=[];for(let k=0;k<4;k++){let pts=null;const r=w2?.rivers?.find(x=>x.k===k);r?.current?.pts?.length>1?pts=r.current.pts.map(([u,v])=>toWorld(u,v)):atlas.rivers?.[k]?.points?.length>1&&(pts=atlas.rivers[k].points.slice().reverse().map(p=>[p.x,p.z])),pts&&(pts.push(lake.slice()),trunks.push({k,raw:pts}))}if(!trunks.length)return null;const P=[],S=[],A=[],B=[],C=[],I=[];let vcount=0;const lines=[];function ribbon(pts,kind,k,seed,join,tail=0){if(tail>0){const a=pts[pts.length-2],b=pts[pts.length-1],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,n2=Math.ceil(tail/.02);for(let i=1;i<=n2;i++)pts.push([b[0]+(b[0]-a[0])/l*tail*i/n2,b[1]+(b[1]-a[1])/l*tail*i/n2])}const cum=lengths(pts),L=cum[cum.length-1],n=pts.length,base=vcount,li=lines.length;for(let i=0;i<n;i++){const a=pts[Math.max(i-1,0)],b=pts[Math.min(i+1,n-1)];let tx=b[0]-a[0],tz=b[1]-a[1];const len=Math.hypot(tx,tz)||1;tx/=len,tz/=len;let kap=0;if(i>0&&i<n-1){const p0=pts[i-1],p1=pts[i],p2=pts[i+1],ax=p1[0]-p0[0],az=p1[1]-p0[1],bx=p2[0]-p1[0],bz=p2[1]-p1[1],la=Math.hypot(ax,az)||1,lb=Math.hypot(bx,bz)||1;kap=(ax/la*bz/lb-az/la*bx/lb)/(.5*(la+lb))}for(let side=-1;side<=1;side+=2)P.push(pts[i][0],LEVEL,pts[i][1]),S.push(-tz,tx),A.push(side,cum[i],L,join),B.push(kind,k,seed,li),C.push(kap*side);if(i<n-1){const v=base+i*2;I.push(v,v+2,v+1,v+1,v+2,v+3)}}return vcount+=n*2,lines.push({kind,k,L,join,pts,cum}),li}const smoothW=()=>Math.max(0,Math.round((+tune.smooth||0)/.02));for(const T of trunks){T.pts=smoothLine(resample(T.raw,.02),smoothW());const Lc=lengths(T.pts).pop();T.line=ribbon(T.pts.slice(),0,T.k,.17+T.k*.23,Lc,.5),T.L=Lc,T.cum=lengths(T.pts)}const tribs=[];for(const[i,t]of(tribFile?.tributaries||[]).entries()){const T=trunks.find(x=>x.k===t.trunk);if(!T||!t.uv||t.uv.length<2||lines.length>=MAXLINES)continue;let pts=t.uv.map(([u,v])=>toWorld(u,v));const end=pts[pts.length-1];let bi=0,bd=1/0;T.pts.forEach((p,j)=>{const d=Math.hypot(p[0]-end[0],p[1]-end[1]);d<bd&&(bd=d,bi=j)}),pts.push(T.pts[bi].slice()),pts=smoothLine(resample(pts,.02),2);{const c=lengths(pts),Lt=c[c.length-1],amp=.011*(+tune.meander||0),ph=i*1.7;pts=pts.map((p,j)=>{if(j===0||j===pts.length-1)return p;const a=pts[j-1],b=pts[j+1];let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz)||1,s=c[j],env=Math.min(1,s/.15,(Lt-s)/.25),o=amp*env*(Math.sin(s/.07+ph)*.65+Math.sin(s/.031+ph*2.3)*.35);return[p[0]-tz/l*o,p[1]+tx/l*o]})}const li=ribbon(pts,1,T.k,.51+i*.137,T.cum[bi]);tribs.push({line:li,trunk:T,join:T.cum[bi],L:lines[li].L})}const geometry=new THREE.BufferGeometry;geometry.setAttribute("position",new THREE.Float32BufferAttribute(P,3)),geometry.setAttribute("aSide",new THREE.Float32BufferAttribute(S,2)),geometry.setAttribute("aA",new THREE.Float32BufferAttribute(A,4)),geometry.setAttribute("aB",new THREE.Float32BufferAttribute(B,4)),geometry.setAttribute("aCurv",new THREE.Float32BufferAttribute(C,1)),geometry.setIndex(vcount>65535?new THREE.Uint32BufferAttribute(I,1):new THREE.Uint16BufferAttribute(I,1)),geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,LEVEL,0),12);const trunkIndexCount=trunks.reduce((n,T)=>n+(lines[T.line].pts.length-1)*6,0),U=atlas.uniforms||{},blank=new THREE.DataTexture(new Uint8Array([255,0,0,255]),1,1);blank.needsUpdate=!0;const flat=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);flat.needsUpdate=!0;const heads=new Float32Array(MAXLINES),stops=new Float32Array(MAXLINES),uniforms={tWater:U.tWater?.value?U.tWater:{value:blank},tCanopy:U.tCanopy?.value?U.tCanopy:{value:flat},uBounds:U.uBounds||{value:bounds},uYRange:U.uYRange||{value:new THREE.Vector2(.038,.752)},uRelief:U.uRelief||{value:1.1},uPixel:{value:3e-4},uLift:{value:.012},uHalfTrunk:{value:64},uHalfTrib:{value:40},uWeave:{value:.55},uWeaveLen:{value:1.6},uHeads:{value:heads},uStops:{value:stops},uTime:{value:0},uBright:{value:1},uCoreW:{value:1.25},uInnerW:{value:3.4},uHaloW:{value:8},uWideW:{value:22},uCoreI:{value:3.2},uInnerI:{value:1.1},uHaloI:{value:.34},uWideI:{value:.2},uLandHalo:{value:.35},uPulse:{value:1},uSpacing:{value:.9},uSpeed:{value:.35},uHeadLen:{value:26},uHeadI:{value:1.4},uTribI:{value:.55},uTribW:{value:.62},uGlint:{value:1},uFadeIn:{value:.35},uShimmer:{value:.5},uColCore:{value:new THREE.Color},uColInner:{value:new THREE.Color},uColHalo:{value:new THREE.Color},uColWide:{value:new THREE.Color},uEmph:{value:new THREE.Vector4(1,1,1,1)},uMeet:{value:0},uMeetI:{value:1},uMeetR:{value:.55},uLakeSoft:{value:1},uTribPulse:{value:1.4},uVary:{value:.35},uFilaments:{value:1.1},uSparkDensity:{value:.24},uSoftClip:{value:1.45},uPacketLength:{value:1},uRouteFocus:{value:new THREE.Vector4}},material=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,uniforms,transparent:!0,depthTest:!0,depthWrite:!1,side:THREE.DoubleSide,toneMapped:!1,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor});options.refined&&(material.defines.STUDIO_CURRENT=1,uniforms.uCoreI.value=1.8,uniforms.uInnerI.value=.85);const mesh=new THREE.Mesh(geometry,material);mesh.name="Flow2 river beams (BEAM)",mesh.frustumCulled=!1,mesh.renderOrder=9;const group=new THREE.Group;group.name="Flow2 river beams",group.add(mesh);const state={stage:"ready",version:VERSION,trunks:trunks.length,tribs:tribs.length,vertices:vcount,triangles:I.length/3,grow:0,follow:0,heads:[],tier:2},clamp01=v=>Math.min(1,Math.max(0,v));function growth(clock){const W=PAN&&PAN.td&&typeof PAN.walk=="function"?PAN.walk(clock):null,fk=W?Math.round(+PAN.tune.river||0):-1,F=trunks.find(T=>T.k===fk);if(!W||!F)return{share:.35+.65*clamp01((clock-8.96)/.6999999999999993),follow:-1};const path=PAN.riverPath&&PAN.riverPath(),S2=PAN.state;let s=W.q*F.L;if(path&&Number.isFinite(S2.x)){const pr=path.pts[Math.min(path.pts.length-1,Math.max(0,Math.round(W.q*(path.pts.length-1))))];let bi=0,bd=1/0;F.pts.forEach((p,j)=>{const d=(p[0]-pr[0])**2+(p[1]-pr[1])**2;d<bd&&(bd=d,bi=j)}),s=F.cum[bi]}const lead=(+tune.lead||0)*(1-W.e),share=Math.min(1,(s+lead)/F.L+(1-(s+lead)/F.L)*W.e);return{share:W.u>=1?1:share,follow:fk}}const emph=[1,1,1,1];let time=reduced?4.2:0,tier=2,stopAtLogo=!1;const col=new THREE.Color,glow=new THREE.Color,api={group,tune,state,uniforms,heads,trunks,tribs,lines,setFocus(focus){focus?.isVector4&&(uniforms.uRouteFocus.value=focus)},setLogoOutline(outlines){const points=outlines.flat(),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),bounds2={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};stopAtLogo=points.length>0;for(const trunk of trunks)stops[trunk.line]=firstOutlineCrossing(trunk,outlines,bounds2)},headPoint(k){const T=trunks.find(x=>x.k===k);if(!T)return null;const s=heads[T.line];let i=0;for(;i<T.cum.length-1&&T.cum[i]<s;)i++;return T.pts[i]},labelPoint(k){const T=trunks.find(x=>x.k===k);if(!T)return null;if(T.anchorS===void 0){const a=atlas.anchors?.[k];let bi=T.pts.length-1;if(a){let bd=1/0;T.pts.forEach((p,j)=>{const d=(p[0]-a.x)**2+(p[1]-a.z)**2;d<bd&&(bd=d,bi=j)})}T.anchorS=T.cum[bi]}const s=Math.min(heads[T.line]-.06,T.anchorS);if(s<.25)return null;let i=0;for(;i<T.cum.length-1&&T.cum[i]<s;)i++;return T.pts[i]},setTier(rank){tier=rank},update(frame={}){const q=window.__FLOW2_QUALITY__;q&&Number.isFinite(+q.rank)&&(tier=+q.rank),state.tier=tier;const on=+tune.on>=.5;if(group.visible=on,!on)return;const dt=Math.min(Math.max(+frame.dt||0,0),.05),camera=frame.camera||atlas.camera,clock=Number.isFinite(+frame.clock)?+frame.clock:9.66;reduced||(time+=dt),uniforms.uTime.value=time;const h=canvasHeight(renderer);camera&&(uniforms.uPixel.value=2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/Math.max(1,h));const followsRoute=Number.isFinite(frame.routeProgress),G=followsRoute?{share:clamp01(frame.routeProgress),follow:-1}:reduced?{share:1,follow:-1}:growth(clock);state.grow=+G.share.toFixed(3),state.follow=G.follow;for(const T of trunks)heads[T.line]=Math.min(1,G.share)*(stops[T.line]||T.L);for(const t of tribs){const trunkHead=heads[t.trunk.line];heads[t.line]=+tune.tribs>=.5?Math.max(-1,t.L-(t.join-trunkHead)*1.15):-1}state.heads=trunks.map(T=>+(heads[T.line]/(stops[T.line]||T.L)).toFixed(3)),uniforms.uMeet.value=stopAtLogo?0:Math.min(1,Math.max(0,(G.share-.955)/.045));const active=Number.isInteger(frame.state?.active)?frame.state.active:-1,ease=reduced?1:1-Math.exp(-dt*3.2);for(let k=0;k<4;k++){const want=active<0?1:active===k?+tune.active:+tune.others;emph[k]+=(want-emph[k])*ease}uniforms.uEmph.value.fromArray(emph);const LD=window.__FLOW2_LAKE_DIVE__,ldt=LD&&LD.state&&Number.isFinite(+LD.state.t)?+LD.state.t:0,dive=Math.min(1,Math.max(0,+(atlas.zoom||0),ldt));state.dive=+dive.toFixed(3);const upright=innerWidth<innerHeight*.85;state.upright=upright,state.tilt=upright?0:+tune.tilt;const arrivalFade=followsRoute?THREE.MathUtils.smoothstep(G.share,0,.15):1;uniforms.uBright.value=+tune.bright*arrivalFade*(1-.85*Math.min(1,dive/.45))*(upright?1-.35*Math.min(1,Math.max(0,(G.share-.8)/.2)):1),uniforms.uCoreW.value=+tune.coreWidth,uniforms.uInnerW.value=+tune.innerWidth,uniforms.uHaloW.value=+tune.haloWidth,uniforms.uWideW.value=+tune.wideWidth,uniforms.uHaloI.value=.4*+tune.halo,uniforms.uWideI.value=tier>0?.2*+tune.wide:0,uniforms.uMeetI.value=+tune.meet*(1-Math.min(1,dive/.2))*(innerWidth<innerHeight*.85?.45:1),uniforms.uMeetR.value=Math.max(.05,+tune.meetSize),uniforms.uLakeSoft.value=+tune.lakeSoft,uniforms.uTribPulse.value=+tune.tribPulse,uniforms.uVary.value=+tune.vary,uniforms.uLandHalo.value=+tune.landHalo,uniforms.uPulse.value=+tune.pulse,uniforms.uSpacing.value=Math.max(.05,+tune.spacing),uniforms.uSpeed.value=.35*+tune.speed,uniforms.uHeadLen.value=Math.max(2,+tune.headLen),uniforms.uHeadI.value=+tune.head,uniforms.uTribI.value=+tune.tribBright,uniforms.uTribW.value=+tune.tribWidth,uniforms.uGlint.value=tier>1?+tune.glint:0,uniforms.uShimmer.value=reduced?0:+tune.shimmer,uniforms.uWeave.value=+tune.weave,uniforms.uWeaveLen.value=Math.max(.2,+tune.weaveLen),options.refined&&(uniforms.uFilaments.value=Math.max(0,+tune.filaments||0),uniforms.uSparkDensity.value=THREE.MathUtils.clamp(+tune.sparkDensity||0,0,.7),uniforms.uSoftClip.value=Math.max(.2,+tune.softClip||1.45),uniforms.uPacketLength.value=Math.max(.3,+tune.packetLength||1)),uniforms.uHalfTrunk.value=Math.max(12,2.7*Math.max(+tune.wideWidth||0,(+tune.haloWidth||0)*2.4)),uniforms.uHalfTrib.value=uniforms.uHalfTrunk.value*Math.max(.3,+tune.tribWidth),col.set(tune.colour),glow.set(tune.glow),uniforms.uColCore.value.copy(col),uniforms.uColInner.value.copy(col).lerp(glow,.35),uniforms.uColHalo.value.copy(glow),uniforms.uColWide.value.copy(glow).lerp(col,.15),geometry.setDrawRange(0,tier>0&&+tune.tribs>=.5?I.length:trunkIndexCount)},dispose(){geometry.dispose(),material.dispose(),blank.dispose(),flat.dispose(),group.removeFromParent()}},W2=window.__FLOW2_WATER_FLOW__;return options.suppressFlowCurrent!==!1&&W2?.tune&&Q.get("wflowCurrent")!=="1"&&(state.w2Current=W2.tune.current,W2.tune.current=0),window.__FLOW2_RIVER_BEAMS__=api,api.update({dt:0,clock:9.66}),api}