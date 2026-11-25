/* RISE FALLS · the water (team FW, 2026-11-23). Made by ./index.js; brief docs/falls/BRIEF-20261123.md, report docs/falls/FW.md.
   Three meshes, three draw calls, two small programs, no file of their own (one shared 128-px noise picture and the gorge's field picture):
     · THE POOL     a flat sheet at poolY under the whole gorge (opaque, depth-tested: FT's rock stands in it). Churned white at the foot of the
                    falls, foam laced over pale turquoise and carried outward, clear teal toward the lens; the rivers' light gathers in it as a soft glow.
     · THE CURTAIN  one ribbon along every lip chain of the contract: a short apron on the plateau, the glassy green-teal crest bending over the
                    rim, then the sheet falling (a parabola: it has shot out a little when it meets the pool). White streaks slide down at ONE steady
                    speed; fuller where a river arrives (the lips' flow), thinner between, thinning to nothing at the chain's two ends.
     · THE STREAM   the fourth river's water down its ravine (the contract's outlet.path), the curtain's own program lying down.
   The entrance: uLife (grey → colour with the land) and uPour (the sheet comes over the lip and runs down; foam only once it has landed).
   Light direction and strength, the clock: the view's own uniforms. No sparkle anywhere: every pattern is a smooth noise, mip-mapped. */
import * as THREE from 'three';
import { loadDetailTexture } from '../valley-detail/valley-detail.js?v=s24';

const LIFT = .006;      /* above the plateau water / the path's level */
const APRON = .56;      /* fw-3: wider smooth plateau approach so water glides organically to the rounded lip */

const WATER_VERT = /* glsl */`
  attribute vec4 aA;   /* u along the lip (world units) · distance fallen (world units) · how full (0..1) · fade at the chain's ends */
  attribute vec4 aB;   /* profile place (-1 apron … 0 the rim … 1 the pool) · 0 curtain / 1 stream · across the stream (-1..1) · stream sense (-1 out of the pool, 1 into it) */
  attribute vec2 aRim; /* the rim point this column of the sheet hangs from (x, z) */
  varying vec4 vA, vB; varying vec3 vWorld, vN; varying vec2 vRim;
  void main(){
    vA=aA; vB=aB; vN=normal; vRim=aRim;
    vec4 wp=modelMatrix*vec4(position,1.);
    vWorld=wp.xyz;
    gl_Position=projectionMatrix*viewMatrix*wp;
  }`;

const WATER_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tNoise;
  uniform float uTime,uSpeed,uLife,uPour,uSunI,uLightOn;
  uniform vec4 uLevels,uLightU,uLightI,uLook;      /* uLook: how far down the columns stay glass · how much of the sheet is white strands · how light the water between them is · how solid it is */
  uniform vec4 uCols;                              /* redo-w1: column width (world) · fine streak scale · relief of the columns · how much the foot is veiled */
  uniform vec4 uTex;                               /* redo-w3: froth · scallop depth · far-middle glass · lip band brightness */
  uniform vec4 uLedgeA,uLedgeB,uLedgeS,uLedgeK;    /* redo-w3: up to four rock ledges across the fall: u from · u to · where (share of the drop) · strength */
  uniform vec4 uVeilU;                             /* redo-w5: the veil is fullest round the curtain's middle: centre u · half width · how much at the sides · - */
  uniform vec4 uSoft;                              /* redo-w4 (softness): noise blur (mip bias) · groove darkness · spray veil over the lower curtain · glow of the white water */
  uniform vec3 uSun,uTeal,uTealDeep,uPale,uWhite,uShade,uRiver,uLightCore,uLightHalo;
  varying vec4 vA, vB; varying vec3 vWorld, vN; varying vec2 vRim;
  uniform sampler2D tArrive; uniform vec4 uBounds; uniform float uArrival,uArrivalMap;
  /* how far the land's own colour front has passed this place (studio-highland-ecology.js stArrivalColor: the same field, the same numbers):
     below 0 the place is still grey stone, .11 and more it is in full colour */
  float fallsLead(vec2 xz){
    if(uArrival>=.9999)return 1.;
    float f=mix(.23+length(xz*vec2(1.,1.35))*.065,textureLod(tArrive,clamp((xz-uBounds.xy)*uBounds.zw,0.,1.),0.).a,uArrivalMap);
    return uArrival*1.36-f;
  }
  vec4 tn(vec2 p){ return texture2D(tNoise,p,uSoft.x); }   /* redo-w4: every pattern a little out of focus, like the photo at this distance */
  float h11(float x){ return fract(sin(x*91.3458+17.13)*47453.5453); }
  float ridge(float n){ return 1.-abs(2.*n-1.); }
  void main(){
    float u=vA.x, fall=vA.y, flow=vA.z, endK=vA.w, sRaw=vB.x, kind=vB.y, s=max(sRaw,0.);
    float t=uTime*uSpeed, vs=fall-t*mix(1.,1.7*(vB.w<0.?-1.:1.),kind);   /* the streaks slide down at one steady speed; rapids faster: the fourth river's OUT of the pool, the left river's in */
    float onSheet=smoothstep(-.02,.05,sRaw)*(1.-kind);
    /* redo-w3 · THE LEDGES: where the fall lands on a rock step it breaks into white churn and starts again below (the stepped look) */
    vec4 inU=smoothstep(uLedgeA-.12,uLedgeA+.12,vec4(u))*(1.-smoothstep(uLedgeB-.12,uLedgeB+.12,vec4(u)))*uLedgeK*onSheet;
    float lj=(tn(vec2(u*.55+.17,.83)).g-.5)*.07;                      /* the ledge's edge is not a ruled line */
    vec4 dl=vec4(s)-uLedgeS-lj;
    float ledgeHit=dot(exp(-dl*dl/(.062*.062)),inU);                                  /* the churn band */
    float ledgeBelow=dot(step(0.,dl)*exp(-max(dl,0.)/.16),inU);                       /* just below: thinner water again */
    float ledgeShade=dot(smoothstep(-.07,-.01,dl)*(1.-step(0.,dl)),inU);             /* just above: the step's shadow behind thin water */
    float restart=dot(step(0.,dl),inU);                                               /* the columns are new below a ledge */
    /* redo-w1 · THE COLUMNS: rounded columns of irregular width along the lip; each has its own fullness and its own point where its glass
       turns white; dark teal grooves part them while they are still glass */
    float warp=(tn(vec2(u*.061+.13,.21)).r-.5)*3.6+(tn(vec2(u*.19+.5,.63)).g-.5)*1.6+restart*1.37;
    float cu=u/uCols.x+warp, ci=floor(cu), cf=fract(cu);
    float r1=h11(ci), r2=h11(ci+31.7), r3=h11(ci+77.1);
    float edge=min(cf,1.-cf);
    float seam=(1.-smoothstep(0.,.16+.20*r2,edge))*onSheet*(.35+.65*r1);   /* redo-w4: wide, soft grooves */
    float bulge=sin(cf*3.14159265);
    float slope=cos(cf*3.14159265)*onSheet;
    /* fine streaks inside the columns: long, thin, sliding down; the third is the bodies of water the eye follows down */
    float f1=tn(vec2(u*uCols.y+.11,vs*.085)).r;
    float f2=tn(vec2(u*uCols.y*1.7+.37,vs*.13+.41)).g;
    float f3=tn(vec2(u*uCols.y*.42+.71,vs*.045+.23)).a;
    float sub=tn(vec2(u*uCols.y*.9+.53,fall*.012+.37)).g;     /* sub-columns: bundles inside a column, running the whole height */
    float f4=tn(vec2(u*uCols.y*3.1+.29,vs*.21+.17)).r, f5=tn(vec2(u*uCols.y*6.3+.83,vs*.34+.61)).g;   /* director: finer strands (about 3x the density) */
    float streak=f1*.22+f2*.16+f3*.20+sub*.12+f4*.17+f5*.13;
    /* redo-w3 · froth: short, round-ish, tumbling (not streaks), for the crests, the breaks and the white water's texture */
    float fr1=tn(vec2(u*uCols.y*2.6+.2,vs*.55)).r, fr2=tn(vec2(u*uCols.y*5.3+.6,vs*1.1+.3)).g;
    float froth=fr1*.62+fr2*.38;
    float broad=tn(vec2(u*.22,fall*.02-t*.01)).b;
    float full=clamp(flow*(.80+.30*r1)+(broad-.5)*.18,.2,1.2);
    /* light: each column is round, so one side of it takes the sun and the other falls into shade */
    vec3 N=normalize(vN), V=normalize(cameraPosition-vWorld);
    vec3 T=normalize(vec3(-N.z,0.,N.x)+vec3(1e-5,0.,0.));
    vec3 Nl=normalize(N+T*slope*uCols.z);
    float wrap=clamp(dot(Nl,uSun)*.55+.45,0.,1.);
    float sunK=clamp(uSunI/1.8,.4,1.2);
    /* redo-w3 · the far middle, seen face on, shows more of the translucent teal glass, darker */
    float faceOn=smoothstep(.72,.97,dot(normalize(N.xz+vec2(1e-5)),normalize(V.xz+vec2(1e-5))))*onSheet*uTex.z;
    /* redo-w3 · scalloped tops: the water bows over the lip further at each column's middle, so the lip line and the crest are scalloped */
    float scal=(1.-bulge)*(.45+.55*r2)*uTex.y*onSheet;
    float sl=sRaw-scal;
    /* the glass: green-teal water bending over the lip, a bright band right on the bend, fine white threads already in it */
    vec3 glass=mix(uTealDeep,uTeal,clamp(.28+.46*wrap*(.55+.45*bulge)+.42*(streak-.5)+.18*s-.22*faceOn,0.,1.));
    glass*=1.-.16*faceOn;
    float thread=smoothstep(.60,.78,f2*.55+f1*.45)*smoothstep(.0,.06,sl);
    glass=mix(glass,mix(uPale,uWhite,.5),thread*(.62-.25*faceOn));
    float lipLine=exp(-pow((sl+.01)/.075,2.))*(1.-kind);   /* redo-w4: no bright line: a soft lift where the water bends */
    glass=mix(glass,mix(uPale,uWhite,.45),clamp(lipLine*(.70+.30*wrap)*.32*uTex.w,0.,1.));
    /* the apron: the plateau's water spreading flat to the lip, light teal as it shallows; riffles: broken lines across the flow, white flecks */
    float nearLip=smoothstep(-.9,-.02,sRaw);
    vec2 rq=vec2(u*.75+(tn(vec2(u*.31,fall*.9)).r-.5)*.5,fall*2.4-t*.22);
    float rl=pow(ridge(tn(rq).r),5.)*.75+pow(ridge(tn(rq*vec2(1.9,1.7)+.37).g),6.)*.55;
    float rmask=smoothstep(.30,.70,tn(vec2(u*.42+.6,fall*.6-t*.05)).b);
    float riffle=clamp(rl*(.35+.65*rmask),0.,1.)*nearLip*(1.-.85*smoothstep(-.32,-.04,sRaw));   /* redo-w5: smooth, glassy tongue where it speeds up to the brink */
    float tone=tn(vec2(u*.9+.4,fall*1.3-t*.12)).a;
    /* redo-w6: the whole band behind the crest is the picture's bright teal water sliding to the edge: light teal, smooth, fast streaks toward
       the brink (faster and deeper-toned as it rolls over), a few riffles and flecks only far from the edge */
    float sOut=-min(sRaw,0.)*${APRON.toFixed(3)};
    float fast=tn(vec2(u*2.4+.21,fall*.55-t*.95)).r*.55+tn(vec2(u*5.1+.6,fall*1.1-t*1.6)).g*.45;
    float lane=tn(vec2(u*.55+.4,fall*.18-t*.25)).b;                                   /* broad lanes of faster / slower water */
    /* redo-w7 · A NATURAL BAND (client 「這一區也要做的自然一點」): shallow river water on a rocky plateau, not a ring. Everything from world / lip
       coordinates, so it follows the opening sliders. Irregular shoreline (wider where the rivers feed in: the lips' fullness), islets of moss and
       rock with foam round them, deeper teal channels and lighter greyer shallows, foam lines running to the brink */
    vec2 wq=vWorld.xz;
    float shA=tn(wq*1.1+vec2(.31,.77)).a, shB=tn(wq*3.4+vec2(.13,.52)).r, shC=tn(wq*8.8+vec2(.71,.29)).g;   /* director: finer shoreline noise */
    float feed=smoothstep(.85,.99,flow);                                             /* where a river arrives */
    float bandW0=vB.w>0.?vB.w:.45;
    float edgeW=bandW0*(.46+.50*shA+.30*(shB-.5)+.16*(shC-.5))*(1.+.45*feed);
    /* director: shallow -> transparent: the water thins out over the last ~45 % of its width (depth fade), no line, no halo */
    float shore=1.-smoothstep(edgeW*.48,edgeW*.86,sOut+(shC-.5)*.05);   /* director fix2: narrower, the outer half fades out */
    float isl=tn(wq*2.1+vec2(.47,.13)).g*.68+shC*.32;
    float awayL=smoothstep(.07,.15,sOut)*smoothstep(.02,.10,edgeW-sOut);              /* islets out on the band, not on the brink nor at the shore */
    float islet=0.;   /* director: no painted islets (they read pasted on) */
    float isleFoam=smoothstep(.60,.70,isl)*(1.-islet)*awayL;
    float chan=tn(vec2(u*.32+.21,fall*.10-t*.03)).b;                                  /* channels along the flow */
    float deepK=clamp(shore*smoothstep(.0,.12,edgeW-sOut)*(.25+.75*chan)*(1.-.6*isleFoam),0.,1.);
    vec3 shallow=mix(uPale*.86,vec3(.56,.63,.60),.40)*(.92+.12*tone);                 /* lighter, greyer over shallows */
    vec3 deepC=mix(uTeal,uTealDeep,.22)*(.95+.10*tone);
    vec3 river=mix(shallow,deepC,deepK*.85);
    river=mix(river,mix(uPale,uWhite,.30),smoothstep(.18,0.,sOut)*(.55+.45*lane));    /* bright as it speeds over the brink */
    river*=.86+.26*fast;
    /* foam: riffles across the flow out on the band, white lines running to the brink, thicker where a river feeds in, rings round islets */
    float fline=pow(ridge(tn(vec2(u*1.35+(shB-.5)*.6,fall*.30-t*.55)).r),5.)*(.35+.65*feed)*smoothstep(.30,.02,sOut);
    float foamB=clamp(riffle*.30*smoothstep(.08,.28,sOut)*(1.-deepK*.5)*shore+fline*.55+isleFoam*.20+smoothstep(.70,.95,fast)*.16,0.,1.);   /* director: no foam ring at the shore (the halo), fewer flecks */
    river=mix(river,uWhite*.95,foamB);
    river=mix(vec3(.030,.052,.046),river,smoothstep(.10,.85,shore));   /* director fix2: the edge goes DARK (wet ground), never lighter: no halo */
    vec3 rock=mix(vec3(.17,.19,.18),vec3(.24,.31,.19),smoothstep(.35,.75,tn(wq*7.3).r))*(.85+.3*smoothstep(.71,.80,isl));
    river=mix(river,rock,islet);
    glass=mix(river,glass,smoothstep(-.12,.09,sl));   /* redo-w4: the approach melts into the glassy top */
    /* redo-w5 · the convex crest: smooth glass that catches the sky on its rounded top and darkens as it turns down */
    float crestK=smoothstep(.40,.95,N.y)*smoothstep(-.06,.03,sRaw)*(1.-kind);
    float sky=pow(1.-max(dot(N,V),0.),2.2);
    float spec=pow(max(dot(reflect(-V,N),uSun),0.),18.);
    glass=mix(glass,mix(uPale,uWhite,.25),clamp(crestK*(.12+.30*sky)+spec*.12*crestK,0.,.34));   /* director: a quieter crest (no thick pale tube) */
    /* where the water is white: thin white streaks on the glass at the lip, more and wider lower down, all white near the foot; each column
       whitens from its middle outward, the grooves stay dark teal longest; some columns start white at the lip; less of it in the far middle */
    float onset=uLook.x*(.30*r3*r3+.16*faceOn)*(1.2-.4*full)+.08;   /* redo-w5: white only once the water has turned down */
    float amt=clamp((sl-onset)*1.55/max(uLook.x,.3)+uLook.y*.55+(full-.85)*.35-.14*faceOn-.42*ledgeBelow,0.,1.);
    float colN=bulge*.26+streak*.86-.10+(f3-.5)*.10;
    float white=smoothstep(1.-amt-.30,1.-amt+.30,colN)*smoothstep(-.02,.06,sl);   /* redo-w4: feathered */
    /* the froth cap where each column breaks over the lip, the churn on the ledges */
    float cap=exp(-pow((sl-.04)/.05,2.))*smoothstep(.30,.95,froth+(full-.8)*.3)*(.55+.45*bulge)*onSheet*.6;
    float churn=clamp(ledgeHit*(.30+1.15*froth),0.,1.);
    white=max(white,max(cap*uTex.x,churn));
    /* the outflow's rapids: mostly white, standing waves across, blue between the breaking water */
    /* the rapids: continuous tumbling white water, brighter where it is steeper, never in bands */
    /* director: the texture in world units across AND along (aA.x carries the across offset in world units): no stretched / smeared bands */
    float ax=u+500.;
    float tumble=tn(vec2(ax*2.6+.3,vs*1.9)).a*.45+tn(vec2(ax*5.4+.7,vs*3.8+.2)).r*.35+tn(vec2(ax*11.+.1,vs*7.6+.5)).g*.20;
    float steep=smoothstep(.24,.44,sRaw);
    white=mix(white,clamp((.10+.62*steep)+.50*(tumble-.5)+.30*steep*tumble-.20*abs(vB.z),0.,1.),kind);
    /* the white water: blue-white, lit on the sun's side of each column, frothy; the grooves between them dark teal */
    float lightK=clamp(.24+.52*wrap+.14*(streak-.5)+.12*bulge+(f2-.5)*.08+(froth-.5)*.16*uTex.x,0.,1.)*min(sunK,1.);   /* redo-w4: lower micro-contrast */
    vec3 lit=mix(uShade,uWhite,lightK);
    vec3 gap=mix(glass,uShade*.86,clamp(uLook.z+.35*s,0.,1.));
    vec3 col=mix(mix(glass,gap,smoothstep(.15,.6,s)),lit,white);
    col=mix(col,mix(mix(uTealDeep,uTeal,.55+.35*tumble),lit,white),kind*(1.-smoothstep(.45,.7,sRaw)));   /* director: calm reaches of the rapids are teal water */
    col*=1.-uSoft.y*seam*(1.-.45*white);
    col*=1.-.30*ledgeShade*(1.-white);
    /* redo-w4 · glow: white water a little brighter than its surroundings, and THE SPRAY VEIL: over the lower ~60% of the curtain a soft
       sheet of mist slides down and drifts, so the columns melt into a glowing white haze at the foot and into the plume */
    col+=white*uSoft.w*.07*vec3(.95,.98,1.);
    float vn=tn(vec2(u*.32+.17,fall*.22-t*.16)).a*.6+tn(vec2(u*.8+.5,fall*.5-t*.30)).b*.4;
    float veil=smoothstep(.32,.98,s)*(.50+.50*vn)*uSoft.z*onSheet*mix(uVeilU.z,1.,exp(-pow((u-uVeilU.x)/max(uVeilU.y,.1),2.)));
    col=mix(col,mix(uShade,uWhite,.78+.18*vn)*1.03,clamp(veil,0.,.9));
    /* the foot: the sheet goes into its own spray */
    float foot=smoothstep(.60,1.0,s)*(1.-kind);
    col=mix(col,mix(uShade,uWhite,.78+.2*froth),foot*uCols.w);
    /* opaque water, a little see-through only in the glassy grooves and where it shreds into spray */
    float a=mix(.90,1.,white);
    a*=1.-(1.-uLook.w)*.65*seam*(1.-white);
    a*=1.-foot*.30;
    a=max(a,clamp(veil,0.,.9)*endK);
    a*=mix(.80,1.,smoothstep(.25,.70,full));
    /* the apron feathers into the plateau water with no edge */
    float glaze=max(shore,islet);   /* redo-w7: the band's irregular, soft shoreline (the moss shows where it pulls in) */
    a*=endK*mix(glaze,1.,smoothstep(-.10,.02,sRaw));
    a=mix(a,a*(1.-smoothstep(.20,1.,abs(vB.z)+(tumble-.5)*.35)),kind);   /* director: broken, soft rapid edges */   /* redo-w5: the rapids' edges dissolve */
    /* the entrance: the water comes over each stretch of the lip as the land's colour reaches that stretch of the rim, and runs down */
    float lead=fallsLead(vRim);
    float front=(lead-.03)*5.2-.14;
    float run=1.-smoothstep(front-.20,front,mix(s,(fall+.4)/(uLevels.z*2.2),kind));
    a*=run;
    col=mix(col,uWhite,(1.-smoothstep(0.,.16,front-s))*step(.001,run)*.35*(1.-kind));
    /* the river's light runs down with the water */
    if(uLightOn>.001){
      vec4 du=vec4(u)-uLightU;
      float w=.048+.090*s;
      vec4 coreL=exp(-du*du/(w*w)), halo=exp(-abs(du)/(w*4.2));
      float pk=fract((fall-uTime*uSpeed*1.1)/(uLevels.z*.62));
      float packet=.50+.85*exp(-pow((pk-.5)/.2,2.));
      float lc=dot(coreL,uLightI), lh=dot(halo,uLightI);
      col=mix(col,uLightHalo*.95+.06,clamp(lh*.20*uLightOn,0.,.4)*(1.-.7*foot));
      col+=uLightCore*lc*packet*.26*uLightOn*(1.-.9*foot);
      a=max(a,min(1.,lh*.4*uLightOn)*run*endK*smoothstep(-.6,0.,sRaw));
    }
    col=mix(vec3(dot(col,vec3(.2126,.7152,.0722))),col,smoothstep(0.,.11,lead));
    if(a<.004)discard;
    gl_FragColor=vec4(min(col,vec3(1.00))*a,a);
  }`;

const POOL_VERT = /* glsl */`
  attribute vec2 aDir;
  varying vec3 vWorld; varying vec2 vDir;
  void main(){
    vDir=aDir;
    vec4 wp=modelMatrix*vec4(position,1.);
    vWorld=wp.xyz;
    gl_Position=projectionMatrix*viewMatrix*wp;
  }`;

const POOL_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tNoise,tField;
  uniform vec4 uFieldRect,uLevels,uLightI,uFootX,uFootZ;
  uniform float uTime,uSpeed,uLife,uPour,uSunI,uFoam,uDrift,uLightOn,uDive;
  uniform vec3 uSun,uPoolDeep,uPoolTeal,uPoolPale,uWhite,uShade,uSky,uLightCore,uLightHalo;
  uniform vec2 uGather,uOutlet;
  uniform vec4 uFan,uOutAxis;   /* redo-w3: the fan's focus behind the far curtain (x, z) and its axis toward the lens · the outlet's axis into the pool */
  uniform vec4 uSoftP;   /* redo-w4: noise blur (mip bias) · shore haze · foam patches (0 lines … 1 patches) · - */
  uniform sampler2D tVD; uniform vec4 uShelf; uniform vec3 uShelfShallow,uShelfMid,uShelfDeep;   /* LAKE SHELF (2026-11-24): on · width · relief · tiles */
  varying vec3 vWorld; varying vec2 vDir;
  uniform sampler2D tArrive; uniform vec4 uBounds; uniform float uArrival,uArrivalMap;
  /* how far the land's own colour front has passed this place (studio-highland-ecology.js stArrivalColor: the same field, the same numbers):
     below 0 the place is still grey stone, .11 and more it is in full colour */
  float fallsLead(vec2 xz){
    if(uArrival>=.9999)return 1.;
    float f=mix(.23+length(xz*vec2(1.,1.35))*.065,textureLod(tArrive,clamp((xz-uBounds.xy)*uBounds.zw,0.,1.),0.).a,uArrivalMap);
    return uArrival*1.36-f;
  }
  vec4 tn(vec2 p){ return texture2D(tNoise,p,uSoftP.x); }
  /* choppy aerated whitewater lace close to the falls and outlet */
  float lace(vec2 p){
    vec4 n=tn(p*.30);
    vec4 m=tn(p*.70+n.rg*.16);
    float a=1.-abs(2.*m.r-1.), b=1.-abs(2.*m.g-1.);
    float lines=max(a*a*a,b*b*b*.9), blobs=smoothstep(.42,.86,m.a*.7+n.a*.3);   /* redo-w4: soft patches rather than a net of lines */
    return mix(lines,blobs,uSoftP.z)*(.55+.45*n.b);
  }
  float ridge(float n){ return 1.-abs(2.*n-1.); }
  float seg(vec2 p,vec2 a,vec2 b,out float h){ vec2 pa=p-a, ba=b-a; h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-5),0.,1.); return length(pa-ba*h); }
  void main(){
    vec2 xz=vWorld.xz;
    vec4 F=texture2D(tField,(xz-uFieldRect.xy)*uFieldRect.zw);
    float dFoot=F.r, sd=F.g, fl=F.b;
    float landed=smoothstep(.72,1.,uPour);
    float near=dFoot/max(.66+.34*fl,.05);
    /* fw-6: calm serene emerald-teal basin with crisp plunge-pool foam halos tightly clustered around the 3 discrete waterfall impact bases */
    vec2 dir=vDir/max(length(vDir),1e-4);
    float reach=exp(-near*1.9);   /* director fix2: the foam stays at the falls' foot (the pool is small at the default opening) */
    float outProx=exp(-length(xz-uOutlet)*2.6);                            /* lively whitewater rapids streaming into the SW lower-left river mouth */
    float adv=uDrift*(.12+.26*max(reach,outProx*.8))*3.4;
    float ph=fract(uTime*.15), ph2=fract(uTime*.15+.5), xf=abs(1.-2.*ph);
    vec2 p1=xz-dir*(adv*ph), p2=xz-dir*(adv*ph2)+vec2(3.71,2.29);
    /* redo-w3 · STREAKS drawn out from the foot of the falls toward the lens: a fan of lines from a point behind the far curtain (polar
       coordinates round it, so every streak runs straight away from the falls), sliding outward; toward the outlet they bend into lines
       converging on its mouth, sliding into it */
    float tt=uTime*uDrift;
    vec2 fr=xz-uFan.xy; float fth=atan(dot(fr,vec2(-uFan.w,uFan.z)),dot(fr,uFan.zw))+(tn(xz*.33+.2).r-.5)*.045, frr=length(fr);   /* wavering, not ruled */
    float sA=tn(vec2(fth*3.8+.13,frr*.10-tt*.040)).r, sB=tn(vec2(fth*8.1+.71,frr*.19-tt*.066+.4)).g;
    float fanS=(pow(ridge(sA),mix(6.,2.4,uSoftP.z))*.70+pow(ridge(sB),mix(8.,3.2,uSoftP.z))*.42)*smoothstep(.28,.70,tn(vec2(fth*1.3+.5,frr*.32-tt*.05)).b);   /* broken into lengths */
    vec2 orr=xz-uOutlet; float ord=length(orr), oth=atan(dot(orr,vec2(-uOutAxis.y,uOutAxis.x)),dot(orr,uOutAxis.xy))+(tn(xz*.41+.6).g-.5)*.12;
    float oS=pow(ridge(tn(vec2(oth*2.4+.37,ord*.20+tt*.085)).b),6.)*.9+pow(ridge(tn(vec2(oth*5.+.1,ord*.36+tt*.12)).r),8.)*.5;
    float st=mix(fanS,oS*smoothstep(.18,.65,ord),smoothstep(.30,.65,outProx));   /* no star where the lines would meet */
    float lc=mix(lace(p1),lace(p2),xf);
    float soft=tn(xz*.36-dir*uTime*.035).a;
    float chop=tn(p1*1.10).b*(1.-xf)+tn(p2*1.10).b*xf;
    float calm=1.-clamp(reach*1.35+outProx*.55,0.,1.);
    float outward=clamp(.04+smoothstep(.06,.60,reach)+outProx*.80,0.,1.)*(.45+.55*soft);   /* redo-w4: the streaks die out before the calm front */
    float churn=clamp(smoothstep(.40,.88,reach)+outProx*.55,0.,1.);
    float shoreLap=(1.-smoothstep(.02,.20,-sd))*smoothstep(.38,.76,lc*.55+soft*.45)*(.24+.76*outProx);
    float net=smoothstep(.46,.74,lc)*.55*smoothstep(.35,.85,reach)*smoothstep(.25,.75,soft);   /* a net of foam near the falls only: the front stays calm and clear */
    float foam=(st*outward*.16*smoothstep(.35,.9,reach)+smoothstep(.30,.62,lc)*churn*.95+shoreLap*.30+net*.30)*landed*uFoam;   /* director: no marbled streaks over the pool */
    /* broken turbulent boil right under each discrete waterfall impact */
    float swell=tn(xz*.20+vec2(.3,.7)).b;
    float boil=(1.-smoothstep(.0,.46+.62*swell,dFoot/max(.56+.44*fl,.05)+(lc-.42)*.46+(soft-.5)*.32))*landed;   /* redo-w3: heavier, wider churn at the foot */
    boil*=.62+.38*smoothstep(.18,.58,lc+(soft-.5)*.45);
    /* serene deep emerald-teal mirror across the central & near basin; turquoise-aqua glow around waterfall plunges */
    float milk=clamp(reach*.82+foam*.18+outProx*.20,0.,1.)*landed;
    vec3 body=mix(uPoolDeep,uPoolTeal,clamp(.22+milk*.78+(soft-.5)*.10+(chop-.5)*.08,0.,1.));
    body=mix(body,uPoolPale,clamp(milk*milk*.36+boil*.28+smoothstep(.60,.88,chop)*.14*outward,0.,1.));
    body=mix(body,uPoolDeep*1.08,.24*calm);
    /* LAKE SHELF (2026-11-24, client: Crater Lake 「湖泊周圍這種銜接感都可以參考」): clear water over a drowned slope. A bright shallow shelf
       along the shore turns blue and then deep navy toward the middle, and the land's own erosion relief (the same detail picture at the same
       place as valley-detail.js on the land) runs on under the water, lit by the sun and fading into the blue with depth: land and lake are one
       surface. The falls' foot keeps its white water. ?lakeShelf=0 = the pool as before. */
    float shelfK=0.;
    if(uShelf.x>.001){
      float inn=max(0.,-sd), dep=smoothstep(0.,uShelf.y,inn);
      /* the shore distance's gradient (outward: the floor rises that way), from screen derivatives (no extra taps) */
      vec2 dxz=dFdx(xz), dyz=dFdy(xz); float dsx=dFdx(sd), dsy=dFdy(sd), det=dxz.x*dyz.y-dxz.y*dyz.x;
      vec2 sg=abs(det)>1e-12?vec2(dsx*dyz.y-dsy*dxz.y,dsy*dxz.x-dsx*dyz.x)/det:vec2(0.);
      sg/=max(1.,length(sg));
      vec2 vuv=clamp((xz-uBounds.xy)*uBounds.zw,0.,1.)*uShelf.w;
      vec4 d1=texture2D(tVD,vuv), d2=texture2D(tVD,mat2(.8,-.6,.6,.8)*vuv*2.31+vec2(.37,.11));
      vec2 nd=(d1.rg-.5)*2.+(d2.rg-.5)*.9;
      float slopeK=2.4*(1.-dep)*(1.-dep);
      vec3 Nf=normalize(vec3(-sg.x*slopeK+nd.x*uShelf.z,1.,-sg.y*slopeK+nd.y*uShelf.z));
      vec3 Ls=normalize(uSun);
      float relief=(max(dot(Nf,Ls),0.)+.32)/(max(Ls.y,0.)+.32);
      float seen=.12+.88*(1.-pow(dep,.8));   /* the floor fades into the blue with depth */
      vec3 w=mix(uShelfShallow,uShelfMid,smoothstep(0.,.42,dep));
      w=mix(w,uShelfDeep,smoothstep(.32,1.,dep));
      w*=mix(1.,clamp(relief,.45,1.7),seen*.85)*(1.+(d1.b-.5)*.3*seen);
      w=mix(w,w*vec3(1.06,1.03,.94)+vec3(.035,.032,.02),(1.-smoothstep(0.,.12,inn))*.8);   /* the last hand-width: sand and pebble through very clear water */
      shelfK=uShelf.x*(1.-clamp(milk*1.15+boil*.8,0.,1.));
      body=mix(body,w,shelfK);
    }
    /* lively choppy water normals + soft sky reflection */
    vec3 V=normalize(cameraPosition-vWorld);
    vec2 rip=(tn(p1*.95).rg-.5)*(1.-xf)+(tn(p2*.95).rg-.5)*xf;
    vec2 rip2=(tn(xz*2.4-dir*uTime*.05).rg-.5)*.09;
    vec3 N=normalize(vec3(rip.x*.14+rip2.x*.6,1.,rip.y*.14+rip2.y*.6));
    float fres=(.015+.07*pow(1.-max(dot(N,V),0.),4.))*(1.-.18*calm);   /* director fix2: almost no sky in the pool */
    float sheen=pow(max(dot(reflect(-V,N),uSun),0.),48.)*.11*clamp(uSunI/1.8,.4,1.2)*(1.-.55*calm);
    vec3 col=body*(.82+.24*clamp(uSunI/1.8,.4,1.2))+uSky*fres+vec3(1.,.98,.94)*sheen*(1.-foam);
    vec3 fcol=mix(uShade,uWhite,.52+.32*soft);
    col=mix(col,fcol,clamp(foam*.78,0.,1.));
    col=mix(col,mix(uShade,uWhite,.72+.2*soft),clamp(boil,0.,1.)*.9);
    /* soft subtle ambient darkening right under overhanging walls (gentle, never a hard bowl rim) */
    col*=1.-.04*(1.-smoothstep(.0,.10,-sd))*(1.-boil)*(1.-shoreLap);
    /* redo-w4: the shore dissolves: foam and haze along the rocks, no crisp edge */
    float shoreHaze=(1.-smoothstep(-.02,.34,-sd))*(.55+.45*soft)*uSoftP.y;
    col=mix(col,mix(uShade,uWhite,.62+.2*soft),clamp(shoreHaze,0.,.75)*.55);
    col*=1.-.22*(1.-.85*shelfK)*(1.-smoothstep(.0,.07,-sd+(soft-.5)*.04));   /* director: the water darkens against the rock (no hard pale line); LAKE SHELF: bright shallows instead */
    /* the rivers' light, gathered: soft quiet glow in the pool */
    if(uLightOn>.001){
      float glow=0., all=0.;
      for(int k=0;k<4;k++){
        float I=uLightI[k]; if(I<.002)continue;
        float h; float d=seg(xz,vec2(uFootX[k],uFootZ[k]),uGather,h);
        float breathe=.78+.22*sin(h*5.-uTime*.7+float(k)*1.7);
        glow+=I*exp(-d/(.20+.16*h))*(1.-.45*h)*breathe;
        all+=I;
      }
      float gd=length(xz-uGather);
      float meet=all*.25*exp(-gd*gd/.55)*(.9+.1*sin(uTime*.6));
      col+=(uLightHalo*(glow*.13+meet*.12)+uLightCore*(glow*.03+meet*.04))*uLightOn*(1.-.85*uDive);
    }
    col=mix(vec3(dot(col,vec3(.2126,.7152,.0722))),col,smoothstep(0.,.11,fallsLead(xz)));
    gl_FragColor=vec4(col,1.);
  }`;

const SHELF_Q = new URLSearchParams(location.search), SHELF_N = (k, d) => { const v = SHELF_Q.get(k); return v != null && v !== '' && Number.isFinite(+v) ? +v : d; };
export function createFallsWater(shared) {
  let G = shared.G, S = shared.S, H = G.H;
  const { tune, atlas, studio } = shared;
  const group = new THREE.Group(); group.name = 'Rise falls water';

  /* redo-w5 · THE CREST: more rows where the water bends over the brink. The plateau water dips as it speeds up toward the lip (drawdown DD,
     steepest at the lip), the sheet leaves the brink at that same slope and falls on an outward parabola: one smooth convex arc from flat
     to vertical, no corner. */
  const PROFILE = [-1, -.84, -.70, -.56, -.44, -.34, -.26, -.19, -.14, -.10, -.07, -.045, -.025, -.01, 0, .02, .045, .075, .11, .15, .20, .26, .33, .42, .52, .63, .75, .86, .96, 1.05];
  /* redo-w5b: no drawdown below the rim (it bared the rock's lip as a dark line): the water rides a little ABOVE the brink as it bows over it */
  const DD = 0, DD_RUN = .5, LEAVE = 0, BOW = .010;
  const bowAt = k => BOW * (k <= 0 ? smooth(-.22, 0, k) : 1 - smooth(.02, .16, k));
  let ledgeGeo = [];   /* redo-w3: the ledges the curtain must clear (u from / to, profile place, how far the rock juts) */
  function buildCurtainGeo(g, s) {
    const h = g.H, P = [], Nn = [], A = [], B = [], I = [], Rm = [];
    let base = 0;
    /* redo-w3: the lip is not level (shape redo-s2 rimTop: the rim's top per outline index); each column hangs from its own height */
    const RT = Array.isArray(s.rimTop) && s.rimTop.length === s.outline.length ? s.rimTop : null, nO = s.outline.length;
    const LR = Number.isFinite(+s.lipProfile?.radius) ? +s.lipProfile.radius : 0;   /* redo-w5: the rock's rounded brink */
    const topAt = f => { if (!RT) return s.waterY; const i = Math.floor(f), e = f - i, a = RT[((i % nO) + nO) % nO], b = RT[(((i + 1) % nO) + nO) % nO]; return Math.max(s.waterY - .18, Math.min(s.waterY + .12, a + (b - a) * e)); };
    /* redo-w6: the apron lies ON the land's own water surface (shape redo-s4: the plateau water rolls down over the brink's quarter round), so it
       covers the whole band behind the crest, the roll included; the band's width per rim point (bandReach) sets where it feathers out */
    const landY = (x, z) => { try { const d = +s.fn.troughDrop(x, z); return Number.isFinite(d) ? s.waterY - d : null; } catch (e) { return null; } };
    const BR = Array.isArray(s.bandReach) && s.bandReach.length === nO ? s.bandReach : null;
    const reachAt = f => { if (!BR) return .45; const i = Math.floor(f), e = f - i, a = BR[((i % nO) + nO) % nO], b = BR[(((i + 1) % nO) + nO) % nO]; return Math.max(.12, a + (b - a) * e); };
    const overhang = Number.isFinite(+s.lipProfile?.overhang) ? +s.lipProfile.overhang : LR;
    for (const C of g.chains) {
      const cols = C.samples.length, rows = PROFILE.length;
      for (const q of C.samples) for (const k of PROFILE) {
        const top = topAt(q.f), hq = top - s.poolY;
        if (k <= 0) {
          const x = q.x + q.nx * k * APRON, z = q.z + q.nz * k * APRON, e = .012;
          let y = landY(x, z); if (y == null) y = top; y = Math.max(y, top);
          /* the land's slope here (toward the brink), for the normal */
          const yo = landY(x - q.nx * e, z - q.nz * e) ?? y, yi = landY(x + q.nx * e, z + q.nz * e) ?? y, slope = Math.min(1.4, Math.max(0, (yo - yi) / (2 * e))), nl = Math.hypot(slope, 1);   /* capped near the curtain's own start (~50 deg) */
          P.push(x, y + LIFT * 1.4, z); Nn.push(q.nx * slope / nl, 1 / nl, q.nz * slope / nl);
          A.push(q.u, k * APRON, q.flow, q.end); B.push(k, 0, 0, reachAt(q.f)); Rm.push(q.x, q.z);
        } else {
          const rib = (.5 + .5 * Math.sin(q.u * 4.8 + Math.sin(q.u * 1.7) * 1.6)) * .026 * smooth(0, .24, k) * q.end;
          let push = 0;   /* over a ledge the sheet below it stands out past the rock's front: the water lands on the step and spills off its edge */
          for (const L of ledgeGeo) { const w = smooth(L.u0 - .12, L.u0 + .04, q.u) * (1 - smooth(L.u1 - .04, L.u1 + .12, q.u)); if (w <= 0) continue; const need = Math.max(0, L.out + .05 - g.throwD * (1.30 * L.at - .30 * L.at * L.at)); push = Math.max(push, need * w * smooth(L.at - .05, L.at + .03, k)); }
          /* redo-w6: the water comes off the land's roll already heading down (about 50 deg), then the outward parabola */
          const a1 = (overhang > 0 ? LEAVE : 1.2) * g.throwD * 1.30, b2 = Math.max(.05, hq - DD - a1);
          const drop = DD + a1 * k + b2 * k * k, yRel = LIFT * 1.4 * (1 - k) - drop + (overhang > 0 ? bowAt(k) : 0);
          let off = g.throwD * (1.30 * k - .30 * k * k) + rib + push;
          /* redo-w5: follow GORGE's rounded brink (redo-s4 lipProfile: a quarter round of radius r inside the rim line): stay just outside it */
          if (overhang > 0 && LR > 0 && yRel > -LR) { const dy = LR + Math.min(0, yRel); off = Math.max(off, Math.sqrt(Math.max(0, LR * LR - dy * dy)) + .014); }
          P.push(q.x + q.nx * off, top + yRel, q.z + q.nz * off);
          const dOff = Math.max(.02, g.throwD * (1.30 - .60 * k)), dDrop = a1 + 2 * b2 * k;
          const nx = q.nx * dDrop, ny = dOff, nz = q.nz * dDrop, l = Math.hypot(nx, ny, nz);
          Nn.push(nx / l, ny / l, nz / l);
          A.push(q.u, drop, q.flow, q.end); B.push(k, 0, 0, 0); Rm.push(q.x, q.z);
        }
      }
      for (let c = 0; c < cols - 1; c++) for (let r = 0; r < rows - 1; r++) { const v = base + c * rows + r; I.push(v, v + rows, v + 1, v + 1, v + rows, v + rows + 1); }
      base += cols * rows;
    }
    const curtainTris = I.length / 3;
    /* the rivers' rapids: the fourth river runs OUT of the pool down its ravine (the picture), the left river comes IN through its low notch */
    for (const [o, sense, up] of [[g.outlet, -1, 1.1], [g.inlet, 1, 1.25]]) {   /* director: the left river's water shows up its trench */
      if (!o) continue;
      const landed = (o.pts.find(p => p[4] > o.dCross && p[2] <= s.poolY + .012) || o.pts[o.pts.length - 1])[4];
      const d0 = Math.max(0, o.dCross - up), d1 = Math.min(landed + .5, o.length);   /* redo-w3: the rapids run on up the ravine */
      const raw = o.pts.filter(p => p[4] >= d0 && p[4] <= d1), ACROSS = [-1, -.5, 0, .5, 1], rows = ACROSS.length;
      if (raw.length < 2) continue;
      /* redo-w5: no staircase: the height runs as a smooth upper envelope of the path (never under the land it follows) */
      const env = raw.map((p, i) => Math.max(p[2], raw[Math.max(0, i - 1)][2] * .5 + p[2] * .5, raw[Math.min(raw.length - 1, i + 1)][2] * .5 + p[2] * .5));
      const pts = raw.map((p, i) => { let sum = 0, w = 0; for (let k = -2; k <= 2; k++) { const j = Math.min(raw.length - 1, Math.max(0, i + k)), g = 3 - Math.abs(k); sum += env[j] * g; w += g; } return [p[0], p[1], Math.max(p[2], sum / w), p[3], p[4]]; });
      pts.forEach((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[2] - a[2], tz = b[1] - a[1]; const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
        const hl = Math.hypot(tx, tz) || 1, sx = -tz / hl, sz = tx / hl;
        const nx = -tx * ty / hl, ny = hl, nz = -tz * ty / hl;
        const slope = clamp01(-ty * 1.6), fall = p[4] - o.dCross;
        const end = smooth(d0, d0 + .80, p[4]) * (1 - smooth(landed + .06, d1, p[4]));
        for (const k of ACROSS) {
          P.push(p[0] + sx * k * o.width * .50, p[2] + LIFT * 2.5, p[1] + sz * k * o.width * .50); Nn.push(nx, ny, nz);   /* director: narrower: it stays in its channel */   /* redo-w3: wider rapids */
          A.push(-500 + k * o.width * .50, fall, .8, end); B.push(.2 + .55 * slope, 1, k, sense); Rm.push(p[0], p[1]);
        }
      });
      for (let c = 0; c < pts.length - 1; c++) for (let r = 0; r < rows - 1; r++) { const v = base + c * rows + r; I.push(v, v + rows, v + 1, v + 1, v + rows, v + rows + 1); }
      base += pts.length * rows;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    geo.setAttribute('aA', new THREE.Float32BufferAttribute(A, 4)); geo.setAttribute('aB', new THREE.Float32BufferAttribute(B, 4)); geo.setAttribute('aRim', new THREE.Float32BufferAttribute(Rm, 2));
    geo.setIndex(base > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(s.centre[0], (s.waterY + s.poolY) / 2, s.centre[1]), 11);
    return { geo, tris: I.length / 3, curtainTris, verts: base };
  }
  function buildPoolGeo(g, s) {
    const o = g.outlet, sdFn = g.sd;
    const [x0, z0, x1, z1] = g.rect, STEP = .085, nx = Math.ceil((x1 - x0) / STEP), nz = Math.ceil((z1 - z0) / STEP);
    const near = (() => { const f = s.frame?.far; if (f) return [-f[0], -f[1]]; if (o) { const dx = o.mouth[0] - s.centre[0], dz = o.mouth[1] - s.centre[1], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; } return [0, 1]; })();
    const pp = [], pd = [], pi = [], id = new Int32Array((nx + 1) * (nz + 1)).fill(-1), inside = new Uint8Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) inside[j * (nx + 1) + i] = sdFn(x0 + i * STEP, z0 + j * STEP) < .6 ? 1 : 0;
    const vert = (i, j) => {
      const key = j * (nx + 1) + i; if (id[key] >= 0) return id[key];
      const x = x0 + i * STEP, z = z0 + j * STEP;
      /* redo-w3: a fan from a point well behind the far curtain toward the lens (the gradient of the foot's distance spun round the curtain's
         two ends and the foam drew rings there), turned toward the outlet's mouth near it */
      const fx = s.centre[0] - near[0] * 4.2, fz = s.centre[1] - near[1] * 4.2;
      let dx = x - fx, dz = z - fz; let dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      if (o) { const mx = o.mouth[0] - x, mz = o.mouth[1] - z, md = Math.hypot(mx, mz) || 1, k = Math.exp(-md / .9) * .85; dx = dx * (1 - k) + mx / md * k; dz = dz * (1 - k) + mz / md * k; }
      dl = Math.hypot(dx, dz) || 1;
      id[key] = pp.length / 3; pp.push(x, s.poolY, z); pd.push(dx / dl, dz / dl);
      return id[key];
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * (nx + 1) + i; if (!(inside[k] || inside[k + 1] || inside[k + nx + 1] || inside[k + nx + 2])) continue;
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1); pi.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); geo.setAttribute('aDir', new THREE.Float32BufferAttribute(pd, 2));
    geo.setIndex(pp.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(pi, 1) : new THREE.Uint16BufferAttribute(pi, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(s.centre[0], s.poolY, s.centre[1]), 11);
    return { geo, tris: pi.length / 3, verts: pp.length / 3, near };
  }

  let wBuilt = buildCurtainGeo(G, S);
  let pBuilt = buildPoolGeo(G, S);

  const col = hex => new THREE.Color(hex);
  const U = shared.uniforms;
  const lightUniforms = {
    uLightOn: { value: 1 }, uLightU: { value: new THREE.Vector4(-1e4, -1e4, -1e4, -1e4) }, uLightI: { value: new THREE.Vector4() },
    uLightCore: { value: col('#e3f7ff') }, uLightHalo: { value: col('#68bded') }
  };
  const waterUniforms = {
    tNoise: U.tNoise, uTime: U.uTime, uSun: U.uSun, uSunI: U.uSunI, uLife: U.uLife, uPour: U.uPour, uLevels: U.uLevels,
    tArrive: U.tArrive, uBounds: U.uBounds, uArrival: U.uArrival, uArrivalMap: U.uArrivalMap,
    uSpeed: { value: .9 }, uLook: { value: new THREE.Vector4(1, .62, .4, .55) }, uCols: { value: new THREE.Vector4(.15, 4.2, .9, .55) }, uTex: { value: new THREE.Vector4(1, .035, 1, 1) }, uSoft: { value: new THREE.Vector4(1.2, .10, .7, 1) }, uVeilU: { value: new THREE.Vector4(0, 2, .4, 0) },
    uLedgeA: { value: new THREE.Vector4(-1e4, -1e4, -1e4, -1e4) }, uLedgeB: { value: new THREE.Vector4(-1e4, -1e4, -1e4, -1e4) }, uLedgeS: { value: new THREE.Vector4(2, 2, 2, 2) }, uLedgeK: { value: new THREE.Vector4() }, uTeal: { value: col(tune.teal) }, uTealDeep: { value: col(tune.tealDeep) }, uPale: { value: col(tune.pale) },
    uWhite: { value: col(tune.white) }, uShade: { value: col(tune.shade) }, uRiver: { value: col('#264468') }, ...lightUniforms
  };
  const waterMat = new THREE.ShaderMaterial({
    name: 'Rise falls curtain', vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: waterUniforms,
    transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, forceSinglePass: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor
  });
  waterMat.userData.handlesArrival = true;
  const curtain = new THREE.Mesh(wBuilt.geo, waterMat); curtain.name = 'Rise falls curtain and stream'; curtain.frustumCulled = false; curtain.renderOrder = 4;

  const o0 = G.outlet;
  const poolUniforms = {
    tNoise: U.tNoise, tField: U.tField, uFieldRect: U.uFieldRect, uTime: U.uTime, uSun: U.uSun, uSunI: U.uSunI, uLife: U.uLife, uPour: U.uPour, uLevels: U.uLevels,
    tArrive: U.tArrive, uBounds: U.uBounds, uArrival: U.uArrival, uArrivalMap: U.uArrivalMap,
    uSpeed: waterUniforms.uSpeed, uFoam: { value: 1 }, uDrift: { value: 1 }, uDive: { value: 0 },
    uPoolDeep: { value: col(tune.poolDeep) }, uPoolTeal: { value: col(tune.poolTeal) }, uPoolPale: { value: col(tune.poolPale) },
    uWhite: waterUniforms.uWhite, uShade: waterUniforms.uShade, uSky: { value: col('#9db7d2') },
    uFootX: { value: new THREE.Vector4() }, uFootZ: { value: new THREE.Vector4() }, uGather: { value: new THREE.Vector2(S.centre[0], S.centre[1]) },
    uOutlet: { value: new THREE.Vector2(o0 ? o0.mouth[0] : S.centre[0], o0 ? o0.mouth[1] : S.centre[1]) }, uFan: { value: new THREE.Vector4() }, uOutAxis: { value: new THREE.Vector4(0, -1, 0, 0) }, uSoftP: { value: new THREE.Vector4(1.2, .6, .7, 0) },
    uLightOn: lightUniforms.uLightOn, uLightI: lightUniforms.uLightI, uLightCore: lightUniforms.uLightCore, uLightHalo: lightUniforms.uLightHalo,
    /* LAKE SHELF: ?lakeShelf=0 off · ?shelfW (width, plate units) · ?shelfRelief · ?shelfTiles (3 = the land's detail placing) · colours ?shelfShallow= ?shelfMid= ?shelfDeep= (hex, no #) */
    tVD: { value: null },
    uShelf: { value: new THREE.Vector4(SHELF_Q.get('lakeShelf') === '0' ? 0 : SHELF_N('lakeShelf', 1), SHELF_N('shelfW', .75), SHELF_N('shelfRelief', 1.4), SHELF_N('shelfTiles', 3)) },
    uShelfShallow: { value: col('#' + (SHELF_Q.get('shelfShallow') || '86e0e4')) }, uShelfMid: { value: col('#' + (SHELF_Q.get('shelfMid') || '2a9cc4')) }, uShelfDeep: { value: col('#' + (SHELF_Q.get('shelfDeep') || '0d3d6e')) }
  };
  if (poolUniforms.uShelf.value.x > 0) loadDetailTexture(shared.renderer).then(t => { poolUniforms.tVD.value = t; }).catch(() => { poolUniforms.uShelf.value.x = 0; });
  const poolMat = new THREE.ShaderMaterial({ name: 'Rise falls pool', vertexShader: POOL_VERT, fragmentShader: POOL_FRAG, uniforms: poolUniforms,
    transparent: false, depthTest: true, depthWrite: true, side: THREE.DoubleSide, toneMapped: false });
  poolMat.userData.handlesArrival = true;
  const pool = new THREE.Mesh(pBuilt.geo, poolMat); pool.name = 'Rise falls pool'; pool.frustumCulled = false; pool.renderOrder = 3;
  group.add(pool, curtain);

  poolUniforms.uGather.value.set(S.centre[0] - pBuilt.near[0] * .45, S.centre[1] - pBuilt.near[1] * .45);
  setFan(pBuilt, S, G);

  /* redo-w3: the pool's streaks: a fan from behind the far curtain toward the lens (the same focus as the flow field), lines converging on the outlet */
  function setFan(pb, s, g) {
    const n = pb.near, fx = s.centre[0] - n[0] * 4.2, fz = s.centre[1] - n[1] * 4.2;
    poolUniforms.uFan.value.set(fx, fz, n[0], n[1]);
    const o = g.outlet; if (o) { const dx = s.centre[0] - o.mouth[0], dz = s.centre[1] - o.mouth[1], l = Math.hypot(dx, dz) || 1; poolUniforms.uOutAxis.value.set(dx / l, dz / l, 0, 0); }
  }
  const beamColour = () => { const b = typeof window !== 'undefined' ? window.__FLOW2_RIVER_BEAMS__ : null; return b?.uniforms?.uColCore ? b.uniforms : null; };
  const api = {
    group, uniforms: { water: waterUniforms, pool: poolUniforms },
    rebuild(nextG, nextS) {
      G = nextG; S = nextS; H = G.H;
      const nw = buildCurtainGeo(G, S), np = buildPoolGeo(G, S);
      const ow = curtain.geometry, op = pool.geometry;
      curtain.geometry = nw.geo; pool.geometry = np.geo;
      wBuilt = nw; pBuilt = np;
      ow?.dispose(); op?.dispose();
      const o = G.outlet;
      poolUniforms.uOutlet.value.set(o ? o.mouth[0] : S.centre[0], o ? o.mouth[1] : S.centre[1]);
      poolUniforms.uGather.value.set(S.centre[0] - np.near[0] * .45, S.centre[1] - np.near[1] * .45);
      setFan(np, S, G);
    },
    setLights(lights) {
      lights.forEach((L, k) => {
        lightUniforms.uLightU.value.setComponent(k, L.on ? L.u : -1e4);
        if (L.foot) { poolUniforms.uFootX.value.setComponent(k, L.foot[0]); poolUniforms.uFootZ.value.setComponent(k, L.foot[1]); }
      });
    },
    /* the rock ledges across the fall (index.js reads them from the shape and turns their rim angles into u along the lip) */
    setLedges(list = []) {
      const key = JSON.stringify(list.map(l => [l.u0, l.u1, l.at, l.out]));
      if (key !== api._ledgeKey) { api._ledgeKey = key; ledgeGeo = list.map(l => ({ ...l })); const nw = buildCurtainGeo(G, S), ow = curtain.geometry; curtain.geometry = nw.geo; wBuilt = nw; ow?.dispose(); }
      for (let k = 0; k < 4; k++) {
        const l = list[k];
        waterUniforms.uLedgeA.value.setComponent(k, l ? l.u0 : -1e4); waterUniforms.uLedgeB.value.setComponent(k, l ? l.u1 : -1e4);
        waterUniforms.uLedgeS.value.setComponent(k, l ? l.at : 2); waterUniforms.uLedgeK.value.setComponent(k, l ? l.k : 0);
      }
    },
    setQuality() { },
    apply() {
      waterUniforms.uTeal.value.set(tune.teal); waterUniforms.uTealDeep.value.set(tune.tealDeep); waterUniforms.uPale.value.set(tune.pale);
      waterUniforms.uWhite.value.set(tune.white); waterUniforms.uShade.value.set(tune.shade);
      waterUniforms.uLook.value.set(Math.max(.3, +tune.crest || 1), clamp01(+tune.cover), clamp01(+tune.gapLight), clamp01(+tune.gapSolid));
      const num = (v, d) => Number.isFinite(+v) ? +v : d;
      waterUniforms.uCols.value.set(Math.max(.04, num(tune.columnWidth, .15)), Math.max(.5, num(tune.streakScale, 4.2)), Math.max(0, num(tune.relief, .9)), clamp01(num(tune.footVeil, .55)));
      { const C = G.chains[0]; if (C) waterUniforms.uVeilU.value.set(C.u0 + C.length * .5, C.length * .21, clamp01(num(tune.veilSides, .4)), 0); }
      waterUniforms.uSoft.value.set(num(tune.soft, 1.2), Math.max(0, num(tune.groove, .10)), Math.max(0, num(tune.veil, .7)), Math.max(0, num(tune.glow, 1)));
      poolUniforms.uSoftP.value.set(num(tune.soft, 1.2), Math.max(0, num(tune.shoreHaze, .6)), clamp01(num(tune.foamSoft, .7)), 0);
      waterUniforms.uTex.value.set(Math.max(0, num(tune.froth, 1)), Math.max(0, num(tune.scallop, .035)), Math.max(0, num(tune.glassMid, 1)), Math.max(0, num(tune.lipBright, 1)));
      poolUniforms.uPoolDeep.value.set(tune.poolDeep); poolUniforms.uPoolTeal.value.set(tune.poolTeal); poolUniforms.uPoolPale.value.set(tune.poolPale);
    },
    update(frame, { lights, dive = 0 } = {}) {
      waterUniforms.uSpeed.value = .9 * (+tune.speed || 0) * Math.sqrt(Math.max(.2, H) / 1.35);
      poolUniforms.uFoam.value = +tune.foam || 0; poolUniforms.uDrift.value = +tune.drift || 0; poolUniforms.uDive.value = dive;
      lightUniforms.uLightOn.value = +tune.light || 0;
      if (lights) lights.forEach((L, k) => lightUniforms.uLightI.value.setComponent(k, L.k || 0));
      const sw = studio?.uniforms?.uWaterShallow?.value; if (sw) waterUniforms.uRiver.value.copy(sw);
      const bc = beamColour(); if (bc) { lightUniforms.uLightCore.value.copy(bc.uColCore.value); lightUniforms.uLightHalo.value.copy(bc.uColHalo.value); }
    },
    stats() { return { drawCalls: 2, triangles: wBuilt.tris + pBuilt.tris, curtain: wBuilt.curtainTris, stream: wBuilt.tris - wBuilt.curtainTris, pool: pBuilt.tris, vertices: wBuilt.verts + pBuilt.verts }; },
    dispose() { curtain.geometry?.dispose(); pool.geometry?.dispose(); waterMat.dispose(); poolMat.dispose(); group.removeFromParent(); }
  };
  return api;
}
function clamp01(v) { return Math.min(1, Math.max(0, v)); }
function smooth(a, b, v) { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
