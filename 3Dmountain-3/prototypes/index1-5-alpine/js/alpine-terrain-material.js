/* Alpine terrain material — index1-5-alpine, 2026-10-23.
   Replaces the highland rock shader on the watershed terrain and the canyon rock (banks, boulders,
   shore rocks, far range). Everything is driven by slope, drainage, shelter and exposure:
     · fall-line gullies: an erosion filter (Gabor stripes whose phase runs ACROSS the local fall
       line, each octave bent by the one above it) shades and bumps every slope with gullies and
       ribs that run downhill — never a contour, never a height band;
     · rock: generated fracture-plate normals (images/alpine/rock-*.webp, triplanar) over the slate
       photo's mineral grain, darker in the gullies, lighter on the ribs;
     · scree: talus aprons where the baked erosion found the foot of steep ground (aAlpine.z),
       generated stone normals, debris chutes down the fall line;
     · snow: held where the ground is gentle enough (incl. the gullies' own relief), in hollows and
       drainage lines, in couloirs on steep faces, more on the shaded aspect; wind-ripple normals up
       close, blue-grey shade colour in hollows; the snow line is broken by noise and shelter;
     · glacier and moraine: firn/ice in the high drainage hollows (aAlpine.y = wide drained area),
       grey rubble along their margins;
     · dry grass and dark forest/scrub patches on gentle low ground and sheltered valley floors.
   Uniforms are shared by every material this installs and refreshed from ALPINE_TERRAIN before
   each draw (material.onBeforeRender), so the panel's dials act live. */
import { ALPINE_TERRAIN } from './alpine-terrain-params.js';

let THREE_ = null;
const U = {
  uSnow: { value: 1 }, uSnowLine: { value: 430 }, uSnowFade: { value: 380 }, uSnowCos: { value: .68 },
  uWind: { value: 1 }, uGlacier: { value: 1 }, uRockTone: { value: 1 }, uRockDetail: { value: 1 }, uRockScale: { value: 1 }, uCliffRelief: { value: 1 },
  uGully: { value: 1 }, uScree: { value: 1 }, uGrass: { value: 1 }, uForest: { value: 1 }, uPlantLine: { value: 300 },
  uAlpDebug: { value: 0 },
  uSnowColor: { value: null }, uSnowShade: { value: null }, uRockColor: { value: null }, uRockColor2: { value: null },
  uScreeColor: { value: null }, uGrassColor: { value: null }, uForestColor: { value: null }
};
const COLOR_KEYS = [['uSnowColor', 'snowColor'], ['uSnowShade', 'snowShade'], ['uRockColor', 'rockColor'], ['uRockColor2', 'rockColor2'],
  ['uScreeColor', 'screeColor'], ['uGrassColor', 'grassColor'], ['uForestColor', 'forestColor']];
const NUM_KEYS = [['uSnow', 'snow', 0, 2], ['uSnowLine', 'snowLine', -500, 3000], ['uSnowFade', 'snowFade', 20, 2000], ['uWind', 'windRipple', 0, 2],
  ['uGlacier', 'glacier', 0, 2], ['uRockTone', 'rockTone', .2, 2.5], ['uRockDetail', 'rockDetail', 0, 2], ['uRockScale', 'rockScale', .25, 4], ['uCliffRelief', 'cliffRelief', 0, 2.5],
  ['uGully', 'gully', 0, 2], ['uScree', 'scree', 0, 2], ['uGrass', 'grass', 0, 2], ['uForest', 'forest', 0, 2], ['uPlantLine', 'plantLine', -500, 2000]];
let lastSync = -1;
export function syncAlpineUniforms(force = false) {
  const now = typeof performance === 'object' ? performance.now() : 0;
  if (!force && Math.abs(now - lastSync) < 4) return;    // once per frame is plenty
  lastSync = now;
  const A = ALPINE_TERRAIN;
  for (const [u, key, lo, hi] of NUM_KEYS) { const v = Number(A[key]); if (Number.isFinite(v)) U[u].value = Math.max(lo, Math.min(hi, v)); }
  U.uAlpDebug.value = Number(A.debug) || 0;   // look-dev only: 1 normals, 2 snow/rough/wet, 3 albedo
  const slope = Number(A.snowSlope); U.uSnowCos.value = Math.cos((Number.isFinite(slope) ? Math.max(5, Math.min(85, slope)) : 47) * Math.PI / 180);
  for (const [u, key] of COLOR_KEYS) { const c = A[key]; if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) && U[u].value.__hex !== c) { U[u].value.set(c); U[u].value.__hex = c; } }
}
export const ALPINE_TERRAIN_UNIFORMS = U;

const VERT_COMMON = `#include <common>
      attribute float terrainAO;
      #ifdef ALP_MESH
        attribute vec4 aAlpine;
      #endif
      varying vec3 tWorld; varying vec3 tNormal; varying float tAO; varying vec4 tAlp;
      #ifdef ALP_BANK
        // Canyon walls: outward-only rock relief (buttresses, ribs, runnels) from the real eroded
        // terrain's height (erosion tile, blue channel), side projections stretched down the slope.
        uniform sampler2D alpineErosion; uniform float uCliffRelief;
        float alpBankH(vec3 p,vec3 n){
          vec3 w=pow(abs(n),vec3(4.));w/=max(dot(w,vec3(1.)),1e-4);
          float h=textureLod(alpineErosion,vec2(p.z,p.y*.62)/64.,0.).b*w.x+textureLod(alpineErosion,p.xz/64.,0.).b*w.y+textureLod(alpineErosion,vec2(p.x,p.y*.62)/64.,0.).b*w.z;
          float f=textureLod(alpineErosion,vec2(p.z,p.y*.7)/21.+.37,0.).b*w.x+textureLod(alpineErosion,p.xz/21.+.37,0.).b*w.y+textureLod(alpineErosion,vec2(p.x,p.y*.7)/21.+.37,0.).b*w.z;
          return clamp(h*.72+f*.28-.28,0.,1.);
        }
      #endif`;
const VERT_BEGIN = `#include <begin_vertex>
      vec4 localRock=vec4(position,1.); vec3 localNormal=normal;
      #ifdef USE_INSTANCING
        localRock=instanceMatrix*localRock;
        mat3 mi=mat3(instanceMatrix);
        localNormal=mi*(localNormal/max(vec3(dot(mi[0],mi[0]),dot(mi[1],mi[1]),dot(mi[2],mi[2])),vec3(.000001)));
      #endif
      tWorld=(modelMatrix*localRock).xyz; tNormal=normalize(mat3(modelMatrix)*localNormal); tAO=terrainAO;
      #ifdef ALP_MESH
        tAlp=aAlpine;
      #else
        tAlp=vec4(0.);
      #endif
      #ifdef ALP_BANK
      {
        // Walls only: never at the waterline (the shore foam and the bed stay put), never on the flat
        // rim that hands over to the watershed ground.
        float amp=6.*uCliffRelief*smoothstep(3.,14.,tWorld.y)*(1.-smoothstep(.62,.9,tNormal.y));
        if(amp>.001){
          vec3 wn=tNormal,t1=normalize(cross(wn,abs(wn.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.))),t2=cross(wn,t1);
          float e=1.6,h0=alpBankH(tWorld,wn),h1=alpBankH(tWorld+t1*e,wn),h2=alpBankH(tWorld+t2*e,wn);
          vec3 p0=wn*h0*amp,p1=t1*e+wn*h1*amp,p2=t2*e+wn*h2*amp;
          vec3 nn=normalize(cross(p1-p0,p2-p0));if(dot(nn,wn)<0.)nn=-nn;
          transformed+=normal*h0*amp;
          tWorld+=p0;tNormal=nn;
        }
      }
      #endif`;
const FRAG_COMMON = `#include <common>
      uniform sampler2D rockDetail, grassColor, grassNormal, alpineRock, alpineScree, alpineSnow, alpineErosion;
      uniform float uAlpDebug;
      uniform float uSnow,uSnowLine,uSnowFade,uSnowCos,uWind,uGlacier,uRockTone,uRockDetail,uRockScale,uGully,uScree,uGrass,uForest,uPlantLine;
      uniform vec3 uSnowColor,uSnowShade,uRockColor,uRockColor2,uScreeColor,uGrassColor,uForestColor;
      varying vec3 tWorld; varying vec3 tNormal; varying float tAO; varying vec4 tAlp;
      float aLuma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
      float aH(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      vec2 aH2(vec2 p){float n=aH(p);return vec2(n,aH(p+n*19.19+7.3));}
      float aNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
        return mix(mix(aH(i),aH(i+vec2(1,0)),u.x),mix(aH(i+vec2(0,1)),aH(i+vec2(1,1)),u.x),u.y);}
      float aFbm(vec2 p){float s=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<3;i++){s+=a*aNoise(p);p=r*p*2.03+11.7;a*=.5;}return s/.875;}
      vec3 aTriW(vec3 n){vec3 w=pow(abs(n),vec3(5.));return w/max(dot(w,vec3(1.)),1e-4);}
      // Triplanar normal map (R,G = tangent normal), applied as a world-space perturbation of n.
      vec3 aTriMix(vec3 a,vec3 b,vec3 c,vec3 n,vec3 w,float k,out float cav){
        cav=a.z*w.x+b.z*w.y+c.z*w.z;
        vec2 ax=(a.xy*2.-1.)*k,bx=(b.xy*2.-1.)*k,cx=(c.xy*2.-1.)*k;
        vec3 d=vec3(0.,ax.y,ax.x)*w.x+vec3(bx.x,0.,bx.y)*w.y+vec3(cx.x,cx.y,0.)*w.z;
        return normalize(n+d-n*dot(n,d));
      }
      vec3 aTriN(sampler2D t,vec3 p,vec3 n,vec3 w,float k,out float cav){
        vec3 a=texture2D(t,p.zy).xyz,b=texture2D(t,p.xz).xyz,c=texture2D(t,p.xy).xyz;
        return aTriMix(a,b,c,n,w,k,cav);
      }
      // Side projections stretched down the slope (y × vs): plates, joints and flutes run down cliffs.
      vec3 aTriNv(sampler2D t,vec3 p,vec3 n,vec3 w,float k,float vs,out float cav){
        vec3 a=texture2D(t,vec2(p.z,p.y*vs)).xyz,b=texture2D(t,p.xz).xyz,c=texture2D(t,vec2(p.x,p.y*vs)).xyz;
        return aTriMix(a,b,c,n,w,k,cav);
      }
      // Erosion filter (after Clay John / IQ): stripes whose phase runs along dir (across the fall
      // line), so crests and grooves run downhill. Returns (height -1..1, d/dp).
      vec3 aGully(vec2 p,vec2 dir){
        vec2 ip=floor(p),fp=fract(p);vec3 va=vec3(0.);float wt=0.;
        for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){
          vec2 o=vec2(float(i),float(j)),h=aH2(ip+o)*.6+.2,pp=fp-o-h;
          float w=exp(-dot(pp,pp)*2.2),ph=dot(pp,dir)*6.2831853;
          va+=vec3(cos(ph),-sin(ph)*dir*6.2831853)*w;wt+=w;
        }
        return va/wt;
      }
      vec3 alpAlbedo; float alpRough, alpSnow, alpWet;
      vec3 alpN;`;

const FRAG_MAP = `
      vec3 N0=normalize(tNormal);
      vec3 P=tWorld;
      float foot=length(fwidth(P));
      float camD=length(cameraPosition-P);
      vec3 W=aTriW(N0);
      // ---- fall-line gullies -------------------------------------------------------------
      // Uphill gradient of the ground (dimensionless); the stripes are laid across its normal.
      vec2 grad=-N0.xz/max(N0.y,.18);
      float steepT=length(grad);
      float gullyH=0.,gullyF=0.;vec2 gullyD=vec2(0.);
      #ifndef ALP_PROP
      {
        float amp=1.,ampSum=0.,ampF=0.;vec2 g=grad;
        float depth=.19*uGully*smoothstep(.10,.55,steepT);
        #ifdef ALP_LITE
          const int GO=3;
        #else
          const int GO=5;
        #endif
        float L=290.;
        for(int o=0;o<GO;o++){
          // The coarse octaves stay on far from the lens (a few pixels wide is still a gully from the air).
          float fade=1.-smoothstep(L*.11,L*.26,foot);
          if(fade>.001&&depth>.0001){
            vec2 dn=normalize(g+vec2(1e-5,0.)),dir=vec2(dn.y,-dn.x);
            vec3 e=aGully(P.xz/L+float(o)*7.31,dir);
            gullyH+=e.x*amp*fade;if(o>=2)gullyF+=e.x*amp*fade;
            vec2 d=e.yz*depth*amp*fade;
            gullyD+=d; g+=d*1.1;      // the next octave bends down the slope this one carved
          }
          ampSum+=amp;if(o>=2)ampF+=amp;amp*=.55;L*=.41;
        }
        gullyH/=ampSum*.6;gullyF/=max(ampF*.6,1e-3);
      }
      #endif
      vec3 dW=vec3(gullyD.x,0.,gullyD.y);
      vec3 Ng=normalize(N0-(dW-N0*dot(N0,dW)));
      // Drainage, talus and convexity from the baked erosion (terrain mesh only; 0 elsewhere).
      float flowN=tAlp.x,flowW=tAlp.y,screeG=tAlp.z,ribG=tAlp.w;
      float concave=clamp(-ribG*.8+(1.-tAO)*1.6,0.,1.);
      // Large-scale, non-banded variety (the y term is tiny: no contour rings).
      float macro=aFbm(P.xz*.00135+vec2(3.3,8.1)+P.y*.00025);
      float geo=aFbm(mat2(.8,.6,-.6,.8)*P.xz*.0046+vec2(1.7,4.4)+P.y*.0006);
      float patchN=aFbm(P.xz*.011+vec2(5.1,2.9));
      // Light side: the scene's sun, in world space (shaded aspects keep more snow).
      float sunny=.5;
      #if NUM_DIR_LIGHTS > 0
        vec3 sunW=normalize(transpose(mat3(viewMatrix))*directionalLights[0].direction);
        sunny=clamp(dot(normalize(vec3(Ng.x,0.,Ng.z)+1e-5),normalize(vec3(sunW.x,0.,sunW.z)+1e-5))*.5+.5,0.,1.)*smoothstep(.98,.6,Ng.y)+.5*smoothstep(.6,.98,Ng.y);
      #endif
      // ---- rock ------------------------------------------------------------------------------
      float photoMean=max(aLuma(texture2D(rockDetail,vec2(.5),10.).rgb),.04);
      vec3 Rp=vec3(dot(P,vec3(.72,.34,.60)),dot(P,vec3(-.49,.86,.12)),dot(P,vec3(-.47,-.37,.80)));
      float grain=1.;
      {
        float g1=clamp(aLuma(texture2D(rockDetail,Rp.zy/(15.5*uRockScale)).rgb*W.x+texture2D(rockDetail,Rp.xz/(15.5*uRockScale)).rgb*W.y+texture2D(rockDetail,Rp.xy/(15.5*uRockScale)).rgb*W.z)/photoMean,.45,1.7);
        grain=mix(1.,pow(g1,.7),.32*(1.-smoothstep(1.,8.,foot)));
      }
      vec3 rock=mix(uRockColor,uRockColor2,smoothstep(.32,.72,geo));
      rock=mix(rock,rock*vec3(1.06,1.03,.98)*1.18,smoothstep(.62,.85,macro)*.35);   // paler granite masses
      rock*=uRockTone*grain;
      rock*=mix(.6,1.24,smoothstep(-.6,.6,gullyH))*mix(1.,.85,clamp(flowN*1.4,0.,1.));
      rock*=1.+clamp(ribG,0.,1.)*.10;
      // Rock relief: the real eroded terrain's own normals (rugged buttresses and runnels), then
      // generated fracture plates at two sizes, the side projections stretched down the slope.
      vec3 Nr=Ng;float cav=1.,cav2=1.,cavE=1.;
      float rk=uRockDetail;
      #ifdef ALP_PROP
        rk*=.35;
      #endif
      {
        float sE=105.*uRockScale;
        Nr=aTriNv(alpineErosion,P/sE+vec3(.21,.0,.57),Nr,W,1.25*rk*(1.-smoothstep(sE*.03,sE*.08,foot))*(1.-smoothstep(.85,.97,N0.y)*.6),.6,cavE);
        float s2=30.*uRockScale;
        Nr=aTriNv(alpineRock,Rp/s2+vec3(.37,.11,.73),Nr,W,.7*rk*(1.-smoothstep(s2*.03,s2*.09,foot)),.5,cav2);
        #ifndef ALP_LITE
        float s1=7.5*uRockScale;
        Nr=aTriNv(alpineRock,P/s1,Nr,W,.85*rk*(1.-smoothstep(s1*.03,s1*.09,foot)),.6,cav);
        #endif
      }
      rock*=mix(1.,cav*cav2,.22*min(rk,1.2))*mix(1.,.6+.8*cavE,.6*min(rk,1.2)*(1.-smoothstep(3.,9.,foot)));
      // ---- scree / talus ----------------------------------------------------------------------
      float screeM=0.;
      {
        float window=smoothstep(.55,.72,Ng.y)*(1.-smoothstep(.93,.99,Ng.y));
        float s=screeG*1.25+concave*.25+(patchN-.5)*.6;
        #ifndef ALP_MESH
          s=(patchN-.35)*.7*smoothstep(.6,.8,N0.y)*(1.-smoothstep(25.,60.,P.y));
        #endif
        screeM=clamp(uScree*smoothstep(.25,.6,s)*window,0.,1.);
      }
      float scav=1.;
      vec3 Ns=aTriN(alpineScree,P/(4.2*uRockScale),Ng,W,.85*(1.-smoothstep(.3,1.2,foot))*step(.01,screeM),scav);
      vec3 scree=uScreeColor*(.86+.28*geo)*mix(1.,scav,.55)*mix(.9,1.05,smoothstep(-.5,.5,gullyH))*grain;
      // ---- plants (low ground) -----------------------------------------------------------------
      float plantY=uPlantLine+(macro-.5)*260.+(sunny-.5)*90.;
      float low=1.-smoothstep(plantY-110.,plantY+110.,P.y);
      float gentle=smoothstep(.66,.86,Ng.y);
      float outcrop=aFbm(P.xz*.0042+vec2(7.7,1.1));
      float grassM=clamp(uGrass*low*gentle*smoothstep(.3,.55,outcrop+.12-screeM*.4+concave*.1),0.,1.);
      // forest and scrub: patches on the valley floors and the sheltered lower slopes
      float clumps=aFbm(P.xz*.0068+vec2(4.2,1.3))*.72+aNoise(P.xz*.034+vec2(9.1,6.2))*.28;
      float floorBias=clamp(flowW*1.2+concave*.6+(1.-smoothstep(30.,150.,P.y))*.7,0.,1.);
      float forestM=clamp(uForest*(1.-smoothstep(plantY-240.,plantY-40.,P.y))*smoothstep(.76,.9,Ng.y)
        *smoothstep(.5,.6,clumps+floorBias*.3-(sunny-.5)*.1),0.,1.);
      vec3 grassC=uGrassColor*(.84+.32*geo)*mix(vec3(1.),vec3(.88,.93,.8),smoothstep(.5,.85,macro));
      {float gm=max(aLuma(texture2D(grassColor,vec2(.5),10.).rgb),.04);
        float gd=clamp(aLuma(texture2D(grassColor,P.xz/9.).rgb)/gm,.6,1.45);grassC*=mix(1.,gd,1.-smoothstep(1.,4.,foot));}
      float canopy=aNoise(P.xz*.33)*.55+aNoise(P.xz*1.1)*.45;
      vec3 forestC=uForestColor*(.72+.45*mix(.5,canopy,1.-smoothstep(.5,3.,foot)))*(.9+.2*geo);
      // ---- snow, glacier, moraine -----------------------------------------------------------------
      float snowM=0.,glacM=0.,moraM=0.;vec3 snowC=uSnowColor;vec3 Nsn=Ng;
      #ifndef ALP_PROP
      {
        float lineY=uSnowLine-(uSnow-1.)*260.+(macro-.5)*uSnowFade*.85-(1.-sunny)*90.;
        float alt=smoothstep(lineY,lineY+uSnowFade,P.y);
        float high=smoothstep(lineY+uSnowFade*.8,lineY+uSnowFade*2.4,P.y);
        // Snow holds where the ground (with its gullies and ribs) is gentle enough, in hollows and
        // drainage lines; on steeper faces only in the couloirs; wind strips the ribs.
        float support=Ng.y+concave*.12+flowN*.07-max(ribG,0.)*.06-gullyH*.05;
        float hold=smoothstep(uSnowCos-.05,uSnowCos+.05,support);
        // couloirs: the FINE gullies (≤ 50 units) hold snow down steep faces — flutes, not drips
        float couloir=smoothstep(.2,.55,-gullyF)*smoothstep(.12,.32,Ng.y)*(1.-hold)*smoothstep(.0,.35,alt-.3);
        float cover=alt*min(uSnow,1.)*max(hold,couloir);
        cover=max(cover,high*min(uSnow,1.)*smoothstep(.12,.30,Ng.y+concave*.1)*smoothstep(-.5,.1,.15+gullyF*.35-max(gullyH,0.)*.4));
        cover+=alt*max(uSnow-1.,0.)*.6*smoothstep(.15,.4,Ng.y);
        snowM=smoothstep(.42,.56,cover+(aNoise(P.xz*.021)-.5)*.10);
        // glacier tongues: the wide drainage hollows, from a little below the snow line
        float gAlt=smoothstep(lineY-300.,lineY+40.,P.y);
        glacM=uGlacier*smoothstep(.40,.60,flowW)*gAlt*smoothstep(.70,.90,N0.y);
        moraM=uGlacier*smoothstep(.26,.38,flowW)*(1.-smoothstep(.40,.56,flowW))*gAlt*smoothstep(.62,.85,N0.y)*(1.-snowM*.6);
        // shade colour in hollows and on the steep / shaded side; wind ripples up close
        float shade=clamp(concave*.7+(1.-Ng.y)*.55+(1.-sunny)*.25-max(ribG,0.)*.2-gullyH*.15,0.,1.);
        snowC=mix(uSnowColor,uSnowShade,shade*.62);
        vec3 Nb=normalize(mix(N0,Ng,.6));
        float cs=1.;
        if(uWind>0.){
          mat2 wr=mat2(.83,-.56,.56,.83);
          vec3 t=texture2D(alpineSnow,wr*P.xz/5.5).xyz;vec3 t2=texture2D(alpineSnow,wr*P.xz/23.+.31).xyz;
          float f1=1.-smoothstep(.25,.9,foot),f2=1.-smoothstep(.8,3.5,foot);
          vec2 d=((t.xy*2.-1.)*f1+(t2.xy*2.-1.)*.6*f2)*.55*uWind;
          vec2 dw=transpose(wr)*d;
          vec3 dd=vec3(dw.x,0.,dw.y);Nb=normalize(Nb+dd-Nb*dot(Nb,dd));cs=mix(1.,t.z,.25*uWind*f1);
        }
        Nsn=Nb;snowC*=cs;
        vec3 iceC=mix(uSnowColor*.9,uSnowShade,.5)*(.92+.12*smoothstep(-.4,.4,gullyH));
        snowC=mix(snowC,iceC,glacM*(1.-smoothstep(lineY+80.,lineY+uSnowFade,P.y))*.75);
        snowM=max(snowM,glacM*.92);
      }
      #endif
      // ---- compose ---------------------------------------------------------------------------------
      vec3 col=mix(rock,scree,screeM);
      col=mix(col,uScreeColor*(.8+.3*geo)*mix(1.,scav,.4),moraM);
      col=mix(col,grassC,grassM*(1.-moraM));
      col=mix(col,forestC,forestM*(1.-moraM));
      col=mix(col,snowC,snowM);
      col*=mix(1.,tAO,.85*(1.-snowM*.6));
      alpWet=1.-smoothstep(.4,5.,P.y);
      col*=mix(1.,.45,alpWet);
      col=mix(col,vec3(.03,.028,.02),(1.-smoothstep(-.6,1.5,P.y))*.5);
      alpAlbedo=col;alpSnow=snowM;
      alpRough=mix(.90,.94,screeM);alpRough=mix(alpRough,.95,grassM);alpRough=mix(alpRough,.97,forestM);
      alpRough=mix(alpRough,mix(.74,.5,glacM),snowM);alpRough=mix(alpRough,.32,alpWet*(1.-forestM));
      // normals: rock / scree / plants / snow
      vec3 Nf=mix(Nr,Ns,screeM);
      {
        vec3 gn=texture2D(grassNormal,P.xz/9.).xyz*2.-1.;vec3 gd=vec3(gn.x,0.,gn.y)*.35*(1.-smoothstep(1.,3.,foot));
        vec3 Nv=normalize(Ng+gd-Ng*dot(Ng,gd));
        Nf=normalize(mix(Nf,Nv,max(grassM,forestM)));
      }
      alpN=normalize(mix(Nf,Nsn,snowM));
      #if !defined(ALP_MESH) && !defined(ALP_PROP)
        // Canyon banks seen from the air: their saw-toothed rim relief calms toward the ground's own
        // light (silhouette unchanged), so the rims do not read as crumpled shards beside the rivers.
        alpN=normalize(mix(alpN,vec3(0.,1.,0.),.45*smoothstep(1.2,4.,foot)*smoothstep(.2,.6,N0.y)));
      #endif
      diffuseColor.rgb*=alpAlbedo;
    `;

const FRAG_ROUGH = `
      float roughnessFactor=alpRough;
    `;
const FRAG_NORMAL = `
      normal=normalize(mat3(viewMatrix)*alpN);
      // Specular anti-aliasing: normal variance under the pixel raises the roughness.
      vec3 nDx=dFdx(normal),nDy=dFdy(normal);
      roughnessFactor=clamp(roughnessFactor+min(.25,.5*(dot(nDx,nDx)+dot(nDy,nDy))),mix(.3,.62,1.-alpWet),1.);
    `;

function compile(shader, maps, { mesh, prop, lite }) {
  for (const [name, value] of Object.entries(maps)) shader.uniforms[name] = { value };
  for (const [name, u] of Object.entries(U)) shader.uniforms[name] = u;
  const defs = (mesh ? '#define ALP_MESH\n' : '') + (prop ? '#define ALP_PROP\n' : '') + (!mesh && !prop ? '#define ALP_BANK\n' : '') + (lite ? '#define ALP_LITE\n' : '');
  const swapV = (a, b) => { if (!shader.vertexShader.includes(a)) throw Error('alpine terrain vertex anchor: ' + a); shader.vertexShader = shader.vertexShader.replace(a, b); };
  const swapF = (a, b) => { if (!shader.fragmentShader.includes(a)) throw Error('alpine terrain fragment anchor: ' + a); shader.fragmentShader = shader.fragmentShader.replace(a, b); };
  shader.vertexShader = defs + shader.vertexShader;
  shader.fragmentShader = defs + shader.fragmentShader;
  swapV('#include <common>', VERT_COMMON);
  swapV('#include <begin_vertex>', VERT_BEGIN);
  swapF('#include <common>', FRAG_COMMON);
  swapF('#include <map_fragment>', FRAG_MAP);
  swapF('#include <roughnessmap_fragment>', FRAG_ROUGH);
  swapF('#include <normal_fragment_maps>', FRAG_NORMAL);
  swapF('#include <dithering_fragment>', `#include <dithering_fragment>
      if(uAlpDebug>.5)gl_FragColor=vec4(uAlpDebug<1.5?alpN*.5+.5:uAlpDebug<2.5?vec3(alpSnow,alpRough,alpWet):alpAlbedo*2.,1.);`);
}

/** Installs the alpine material on the canyon rock (props) and the watershed terrain (mesh). */
export function installAlpineTerrain(THREE, { rockMaterial, terrainMaterial, lite = false, maps }) {
  THREE_ = THREE;
  for (const [u] of COLOR_KEYS) if (!U[u].value) U[u].value = new THREE.Color();
  syncAlpineUniforms(true);
  const sync = () => syncAlpineUniforms();
  for (const material of [rockMaterial, terrainMaterial].filter(Boolean)) {
    const mesh = material === terrainMaterial;
    material.color.set(0xffffff); material.vertexColors = false; material.metalness = 0; material.roughness = .94;
    // The canyon rock material also draws the instanced shore stones: under USE_INSTANCING they take
    // the reduced 'prop' path (no gullies, a third of the fracture relief), which keeps them from
    // sparkling under the camera light; the bank walls themselves get the full rock.
    material.onBeforeCompile = shader => compile(shader, maps, { mesh, prop: !mesh && !!shader.instancing, lite });
    material.customProgramCacheKey = () => 'alpine-terrain-v1' + (mesh ? '-mesh' : '-rock') + (lite ? '-lite' : '');
    material.defaultAttributeValues = { ...material.defaultAttributeValues, terrainAO: [1] };
    material.onBeforeRender = sync;
    material.userData.alpineTerrain = true; material.needsUpdate = true;
  }
  if (typeof window === 'object') window.__ALPINE_TERRAIN__ = ALPINE_TERRAIN;
  return { uniforms: U, sync: syncAlpineUniforms, dispose() {} };
}
