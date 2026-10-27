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
   2026-10-24 rock pass (docs/index1-5-rock-20261024.md): jointMix 1 (default) replaces the fracture-plate mosaic on
   the walls with steep joint sets, flutes, grain, vertical water streaks and a matte wall foot; jointMix 0 (or ?rock=old)
   runs the original plate code unchanged.
   Uniforms are shared by every material this installs and refreshed from ALPINE_TERRAIN before
   each draw (material.onBeforeRender), so the panel's dials act live. */
import { ALPINE_TERRAIN } from './alpine-terrain-params.js';

let THREE_ = null;
const U = {
  uSnow: { value: 1 }, uSnowLine: { value: 430 }, uSnowFade: { value: 380 }, uSnowCos: { value: .68 },
  uWind: { value: 1 }, uGlacier: { value: 1 }, uRockTone: { value: 1 }, uRockDetail: { value: 1 }, uRockScale: { value: 1 }, uCliffRelief: { value: 1 }, uErosionShade: { value: 1 },
  uGully: { value: 1 }, uScree: { value: 1 }, uGrass: { value: 1 }, uForest: { value: 1 }, uPlantLine: { value: 300 },
  uAlpDebug: { value: 0 },
  // 2026-10-24 rock pass: steep joints instead of fracture plates (jointMix 0 = the old plates exactly)
  uJointMix: { value: 1 }, uJointAmt: { value: 1 }, uJointDensity: { value: 1 }, uJointSteep: { value: .85 }, uRockFlute: { value: 1 }, uRockStain: { value: 1 }, uWetMatte: { value: 1 },
  uRockStainColor: { value: null },
  uSnowGully: { value: 1 }, uSnowBright: { value: 1 },
  uTuftAmount: { value: 1 }, uTuftHeight: { value: 2 }, uTuftVar: { value: 1 }, uTuftDry: { value: .4 }, uTuftWind: { value: 1 },
  uCanyonGrass: { value: 1 }, uCanyonCos: { value: .77 }, uLedgeGrass: { value: 1 }, uRiverMoss: { value: 1 }, uMossColor: { value: null },
  uGrassCos: { value: .81 }, uGrassRange: { value: .55 }, uGrassPatch: { value: 1 }, uGrassScale: { value: 1 }, uGrassDetail: { value: 1 }, uGrassShadeColor: { value: null },
  uValleyTone: { value: 1 }, uValleyShadow: { value: 1 }, uValleyContrast: { value: 1 }, uValleyReach: { value: 1 }, uValleyBlend: { value: 1 },
  uValleyFloorColor: { value: null }, uValleyMidColor: { value: null }, uValleyUpperColor: { value: null },
  uSnowColor: { value: null }, uSnowShade: { value: null }, uRockColor: { value: null }, uRockColor2: { value: null },
  uScreeColor: { value: null }, uGrassColor: { value: null }, uForestColor: { value: null }
};
const COLOR_KEYS = [['uSnowColor', 'snowColor'], ['uSnowShade', 'snowShade'], ['uRockColor', 'rockColor'], ['uRockColor2', 'rockColor2'],
  ['uScreeColor', 'screeColor'], ['uGrassColor', 'grassColor'], ['uForestColor', 'forestColor'],
  ['uRockStainColor', 'rockStainColor'], ['uGrassShadeColor', 'grassShadeColor'], ['uMossColor', 'mossColor'], ['uValleyFloorColor', 'valleyFloorColor'], ['uValleyMidColor', 'valleyMidColor'], ['uValleyUpperColor', 'valleyUpperColor']];
const NUM_KEYS = [['uSnow', 'snow', 0, 2], ['uSnowLine', 'snowLine', -500, 3000], ['uSnowFade', 'snowFade', 20, 2000], ['uWind', 'windRipple', 0, 2],
  ['uGlacier', 'glacier', 0, 2], ['uRockTone', 'rockTone', .2, 2.5], ['uRockDetail', 'rockDetail', 0, 2], ['uRockScale', 'rockScale', .25, 4], ['uCliffRelief', 'cliffRelief', 0, 2.5], ['uErosionShade', 'erosionShade', 0, 2],
  ['uJointMix', 'jointMix', 0, 1], ['uJointAmt', 'jointAmt', 0, 2], ['uJointDensity', 'jointDensity', .3, 3], ['uJointSteep', 'jointSteep', 0, 1],
  ['uRockFlute', 'rockFlute', 0, 2], ['uRockStain', 'rockStain', 0, 2], ['uWetMatte', 'wetMatte', 0, 1],
  ['uTuftAmount', 'tuftAmount', 0, 2], ['uTuftHeight', 'tuftHeight', .2, 4], ['uTuftVar', 'tuftVariation', 0, 2], ['uTuftDry', 'tuftDry', 0, 1], ['uTuftWind', 'tuftWind', 0, 3],
  ['uCanyonGrass', 'canyonGrass', 0, 2], ['uLedgeGrass', 'ledgeGrass', 0, 2], ['uRiverMoss', 'riverMoss', 0, 2],
  ['uGrassRange', 'grassRange', 0, 1.2], ['uGrassPatch', 'grassPatch', 0, 2], ['uGrassScale', 'grassScale', .2, 5], ['uGrassDetail', 'grassDetail', 0, 2],
  ['uSnowGully', 'snowGully', 0, 2], ['uSnowBright', 'snowBright', .3, 2], ['uValleyTone', 'valleyTone', 0, 2], ['uValleyShadow', 'valleyShadow', 0, 2],
  ['uValleyContrast', 'valleyContrast', 0, 3], ['uValleyReach', 'valleyReach', .2, 4], ['uValleyBlend', 'valleyBlend', .2, 5],
  ['uGully', 'gully', 0, 2], ['uScree', 'scree', 0, 2], ['uGrass', 'grass', 0, 2], ['uForest', 'forest', 0, 2], ['uPlantLine', 'plantLine', -500, 2000]];
let lastSync = -1;
export function syncAlpineUniforms(force = false) {
  const now = typeof performance === 'object' ? performance.now() : 0;
  if (!force && Math.abs(now - lastSync) < 4) return;    // once per frame is plenty
  lastSync = now;
  const A = ALPINE_TERRAIN;
  for (const [u, key, lo, hi] of NUM_KEYS) { const v = Number(A[key]); if (Number.isFinite(v)) U[u].value = Math.max(lo, Math.min(hi, v)); }
  U.uAlpDebug.value = Number(A.debug) || 0;   // look-dev only: 1 normals, 2 snow/rough/wet, 3 albedo
  const cg = Number(A.canyonGrassSlope); U.uCanyonCos.value = Math.cos((Number.isFinite(cg) ? Math.max(5, Math.min(80, cg)) : 40) * Math.PI / 180);
  const gs = Number(A.grassSlope); U.uGrassCos.value = Math.cos((Number.isFinite(gs) ? Math.max(5, Math.min(80, gs)) : 36) * Math.PI / 180);
  const slope = Number(A.snowSlope); U.uSnowCos.value = Math.cos((Number.isFinite(slope) ? Math.max(5, Math.min(85, slope)) : 47) * Math.PI / 180);
  for (const [u, key] of COLOR_KEYS) { const c = A[key]; if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) && U[u].value.__hex !== c) { U[u].value.set(c); U[u].value.__hex = c; } }
}
export const ALPINE_TERRAIN_UNIFORMS = U;
// the loaded detail maps (set by installAlpineTerrain; the canyon tufts read the erosion tile and their atlas)
let MAPS = null;
export const alpineMaps = () => MAPS;

/* Shared GLSL (the bank shader and the canyon tuft cards evaluate the very same functions, so the tufts
   stand exactly where the turf is). */
export const ALP_NOISE_GLSL = `
      float aH(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      vec2 aH2(vec2 p){float n=aH(p);return vec2(n,aH(p+n*19.19+7.3));}
      float aNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
        return mix(mix(aH(i),aH(i+vec2(1,0)),u.x),mix(aH(i+vec2(0,1)),aH(i+vec2(1,1)),u.x),u.y);}`;
// needs: uniform sampler2D alpineErosion; uniform float uCliffRelief;
export const ALP_BANK_GLSL = `
        float alpBankH(vec3 p,vec3 n){
          vec3 w=pow(abs(n),vec3(4.));w/=max(dot(w,vec3(1.)),1e-4);
          float h=textureLod(alpineErosion,vec2(p.z,p.y*.62)/64.,0.).b*w.x+textureLod(alpineErosion,p.xz/64.,0.).b*w.y+textureLod(alpineErosion,vec2(p.x,p.y*.62)/64.,0.).b*w.z;
          float f=textureLod(alpineErosion,vec2(p.z,p.y*.7)/21.+.37,0.).b*w.x+textureLod(alpineErosion,p.xz/21.+.37,0.).b*w.y+textureLod(alpineErosion,vec2(p.x,p.y*.7)/21.+.37,0.).b*w.z;
          return clamp(h*.72+f*.28-.28,0.,1.);
        }
        // The canyon wall's outward relief at p (n = the wall's own normal): (relief normal, outward offset).
        // Walls only: never at the waterline, never on the flat rim that hands over to the watershed ground.
        vec4 alpBankDisp(vec3 p,vec3 n){
          float amp=6.*uCliffRelief*smoothstep(3.,14.,p.y)*(1.-smoothstep(.62,.9,n.y));
          if(amp<=.001)return vec4(n,0.);
          vec3 t1=normalize(cross(n,abs(n.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.))),t2=cross(n,t1);
          float e=1.6,h0=alpBankH(p,n),h1=alpBankH(p+t1*e,n),h2=alpBankH(p+t2*e,n);
          vec3 p0=n*h0*amp,p1=t1*e+n*h1*amp,p2=t2*e+n*h2*amp;
          vec3 nn=normalize(cross(p1-p0,p2-p0));if(dot(nn,n)<0.)nn=-nn;
          return vec4(nn,h0*amp);
        }`;
// needs: ALP_NOISE_GLSL; uniform float uCanyonCos, uLedgeGrass, uGrassPatch, uCanyonGrass;
// Canyon turf: broad gentle ground (wall tops, benches, toe slopes, rims) and the upward-facing ledges of a
// steep wall's relief. baseUp: the wall's own slope; reliefUp / ngUp: its relief normal; extra: local terms.
// Returns (field, gentle share, tuft noise); turf where field > .36.
export const ALP_CANYON_GLSL = `
      vec3 alpCanyonField(vec3 P,float baseUp,float reliefUp,float broadUp,float ngUp,float extra,float yLo){
        // the slope dial alone decides where broad turf can hold; steeper than it is wall (ledges only)
        float wall=1.-smoothstep(uCanyonCos-.2,uCanyonCos,baseUp);
        float gentleC=smoothstep(uCanyonCos-.04,uCanyonCos+.05,broadUp)*smoothstep(uCanyonCos-.08,uCanyonCos+.03,baseUp);
        float ledge=uLedgeGrass*wall*smoothstep(.1,.28,reliefUp-baseUp)*smoothstep(.55,.72,ngUp);
        float tuft=aNoise(P.xz*.11+vec2(2.3,7.1))*.45+aNoise(P.xz*.37+vec2(5.9,1.3))*.25+aNoise(P.xz*1.3+vec2(1.1,8.7))*.1+aNoise(P.xz*.035)*.2;
        float field=max(gentleC*(tuft+.1+extra-.12*uGrassPatch),ledge*(tuft+.05-.12*uGrassPatch))*uCanyonGrass*smoothstep(yLo,yLo+9.,P.y+(tuft-.5)*12.);
        field-=smoothstep(.55,.75,aNoise(P.xz*.05+vec2(6.2,3.4)))*.25*gentleC;   // holes in the broad turf
        // broken into clumps and tongues (3-10 units) with rock showing between them, never a band
        field*=1.-.8*gentleC*smoothstep(.4,.66,aNoise(P.xz*.13+P.y*.07+vec2(1.9,6.6))*.65+aNoise(P.xz*.41+vec2(7.3,2.8))*.35);
        return vec3(field,gentleC,tuft);
      }`;

/* Steep joint sets and vertical water streaks (2026-10-24, replaces the fracture-plate mosaic on the canyon walls).
   needs: ALP_NOISE_GLSL.
   aJoint: one set of joint planes (normal gd = horizontal unit part + a lean in y, mean spacing sp). On a face the
   planes cut lines that run DOWN it: the stripe field's phase gradient must lie across the fall line (align) and
   across the face (gl), else the set switches itself off there, so nothing ever runs along a contour. The lines wander,
   come and go over 30-60 units (they are fractures, not a grid), and fade out before they get denser than the pixels.
   Returns (normal push in world space, groove darkness).
   aStreak: columns 2-8 units wide that run down the face for tens of units (dark varnish, pale bleaching). */
const ALP_JOINT_GLSL = `
      vec4 aJoint(vec3 P,vec3 N0,vec3 gd,float sp,float seed,float hw,float depth,float panel,float foot){
        vec3 gT=gd-N0*dot(gd,N0);float gl=length(gT);
        float spE=sp/max(gl,.05);
        float w=smoothstep(.2,.5,gl)*(1.-smoothstep(spE*.05,spE*.14,foot));
        if(w<.004)return vec4(0.);
        gT/=gl;
        vec3 up=vec3(0.,1.,0.)-N0*N0.y;float ul=length(up);
        if(ul>.03)w*=1.-smoothstep(.3,.65,abs(dot(gT,up/ul)));
        if(w<.004)return vec4(0.);
        float x=dot(P,gd)/sp;
        x+=(aNoise(vec2(x*.3+seed,P.y*.011+seed*1.7))-.5)*1.5;
        float c0=floor(x),f=x-c0;
        float hwE=max(hw,foot*1.1),amp=w*hw/hwE;
        float g=0.,dd=0.,pres0=0.,pos0=.5;
        for(int k=0;k<2;k++){
          float c=k==0?c0:(f<.5?c0-1.:c0+1.);
          float pos=.5+(aH(vec2(c,seed))-.5)*.5;
          float yy=P.y*(1./55.)+aH(vec2(c+.5,seed+3.))*9.;
          float al=mix(aH(vec2(c*1.37+seed,floor(yy))),aH(vec2(c*1.37+seed,floor(yy)+1.)),smoothstep(0.,1.,fract(yy)));
          float d=(x-c-pos)*sp;
          float pr=smoothstep(.32,.58,al);
          if(k==0){pres0=pr;pos0=pos;}
          float gk=pr*exp(-d*d/(hwE*hwE));
          if(gk>g){g=gk;dd=d;}
        }
        // the block between two joints leans a little (catches the light on its own): a step in the tilt across each
        // joint that is really there, so a long flat face breaks into vertical panels with crisp edges
        float tl=aH(vec2(c0-1.,seed+11.))-.5,tr=aH(vec2(c0,seed+11.))-.5;
        float sw=max(.3,foot*1.2)/sp;
        float tilt=mix(tl,mix(tl,tr,pres0),smoothstep(pos0-sw,pos0+sw,f));
        // d(height)/d(distance) of a groove of this depth, along the face (gl = how fast the planes cross it)
        float slope=2.*dd/(hwE*hwE)*g*depth*amp*gl;
        return vec4(gT*(tilt*panel*w-slope),g*amp);
      }
      // fine rock grain: value noise (stretched down the face by 1/vs), its gradient as a normal push, its value as tone
      vec3 aGrain(vec3 P,vec3 W,float s,float vs,out float tone){
        float e=.4;tone=0.;vec3 d=vec3(0.);
        if(W.x>.02){vec2 q=vec2(P.z/s,P.y*vs/s);float h=aNoise(q),hx=aNoise(q+vec2(e,0.)),hy=aNoise(q+vec2(0.,e));
          tone+=h*W.x;d+=vec3(0.,(hy-h)*vs,hx-h)/e*W.x;}
        if(W.z>.02){vec2 q=vec2(P.x/s,P.y*vs/s);float h=aNoise(q),hx=aNoise(q+vec2(e,0.)),hy=aNoise(q+vec2(0.,e));
          tone+=h*W.z;d+=vec3(hx-h,(hy-h)*vs,0.)/e*W.z;}
        if(W.y>.02){vec2 q=P.xz/s;float h=aNoise(q),hx=aNoise(q+vec2(e,0.)),hy=aNoise(q+vec2(0.,e));
          tone+=h*W.y;d+=vec3(hx-h,0.,hy-h)/e*W.y;}
        return d;
      }
      vec2 aStreak(vec2 uv){
        float cx=uv.x/4.2+(aNoise(vec2(uv.x*.02+3.1,uv.y*.01))-.5)*1.3;
        float colN=aNoise(vec2(cx,4.1)),segN=aNoise(vec2(cx*.47+11.,uv.y/60.)),fineN=aNoise(vec2(cx*3.1,uv.y/12.));
        float dark=smoothstep(.42,.64,colN)*smoothstep(.3,.58,segN)*(.65+.7*fineN);
        float pale=smoothstep(.62,.82,aNoise(vec2(cx*.8+5.,2.2)))*smoothstep(.42,.74,aNoise(vec2(cx*.4+3.,uv.y/80.+7.)));
        return vec2(dark,pale);
      }`;

const VERT_COMMON = `#include <common>
      attribute float terrainAO;
      #ifdef ALP_MESH
        attribute vec4 aAlpine;
        attribute vec2 aAlpine2;
      #endif
      varying vec3 tWorld; varying vec3 tNormal; varying float tAO; varying vec4 tAlp; varying vec2 tAlp2; varying float tBaseUp;
      #ifdef ALP_BANK
        // Canyon walls: outward-only rock relief (buttresses, ribs, runnels) from the real eroded
        // terrain's height (erosion tile, blue channel), side projections stretched down the slope.
        uniform sampler2D alpineErosion; uniform float uCliffRelief;
${ALP_BANK_GLSL}
      #endif`;
const VERT_BEGIN = `#include <begin_vertex>
      vec4 localRock=vec4(position,1.); vec3 localNormal=normal;
      #ifdef USE_INSTANCING
        localRock=instanceMatrix*localRock;
        mat3 mi=mat3(instanceMatrix);
        localNormal=mi*(localNormal/max(vec3(dot(mi[0],mi[0]),dot(mi[1],mi[1]),dot(mi[2],mi[2])),vec3(.000001)));
      #endif
      tWorld=(modelMatrix*localRock).xyz; tNormal=normalize(mat3(modelMatrix)*localNormal); tAO=terrainAO; tBaseUp=tNormal.y;
      #ifdef ALP_MESH
        tAlp=aAlpine;tAlp2=aAlpine2;
      #else
        // canyon rock: the river IS the local valley floor, so height above the water is its place
        // in the local relief (banks rise ~250 above it)
        tAlp=vec4(0.);tAlp2=vec2(clamp(tWorld.y/250.,0.,1.),.45*pow(1.-clamp(tWorld.y/250.,0.,1.),1.6));
      #endif
      #ifdef ALP_BANK
      {
        // Walls only: never at the waterline (the shore foam and the bed stay put), never on the flat
        // rim that hands over to the watershed ground.
        vec4 bd=alpBankDisp(tWorld,tNormal);
        transformed+=normal*bd.w;tWorld+=tNormal*bd.w;tNormal=bd.xyz;
      }
      #endif`;
const FRAG_COMMON = `#include <common>
      uniform sampler2D rockDetail, grassColor, grassNormal, alpineRock, alpineScree, alpineSnow, alpineErosion;
      uniform float uAlpDebug, uErosionShade, uSnowGully, uSnowBright, uValleyTone, uValleyShadow, uValleyContrast, uValleyReach, uValleyBlend;
      uniform vec3 uValleyFloorColor, uValleyMidColor, uValleyUpperColor, uGrassShadeColor;
      uniform float uGrassCos, uGrassRange, uGrassPatch, uGrassScale, uGrassDetail, uCanyonGrass, uCanyonCos, uLedgeGrass, uRiverMoss;
      uniform vec3 uMossColor,uRockStainColor;
      uniform float uJointMix,uJointAmt,uJointDensity,uJointSteep,uRockFlute,uRockStain,uWetMatte;
      uniform float uSnow,uSnowLine,uSnowFade,uSnowCos,uWind,uGlacier,uRockTone,uRockDetail,uRockScale,uGully,uScree,uGrass,uForest,uPlantLine;
      uniform vec3 uSnowColor,uSnowShade,uRockColor,uRockColor2,uScreeColor,uGrassColor,uForestColor;
      varying vec3 tWorld; varying vec3 tNormal; varying float tAO; varying vec4 tAlp; varying vec2 tAlp2; varying float tBaseUp;
      float aLuma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
${ALP_NOISE_GLSL}
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
      // triplanar colour fetch (photo detail on steep ground without stretching)
      vec3 aTriC(sampler2D t,vec3 p,vec3 w){return texture2D(t,p.zy).rgb*w.x+texture2D(t,p.xz).rgb*w.y+texture2D(t,p.xy).rgb*w.z;}
      #ifdef ALP_BANK
        #define GRASS_VT 0.
      #else
        #define GRASS_VT .55
      #endif
      vec3 aGully(vec2 p,vec2 dir){
        vec2 ip=floor(p),fp=fract(p);vec3 va=vec3(0.);float wt=0.;
        for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){
          vec2 o=vec2(float(i),float(j)),h=aH2(ip+o)*.6+.2,pp=fp-o-h;
          float w=exp(-dot(pp,pp)*2.2),ph=dot(pp,dir)*6.2831853;
          va+=vec3(cos(ph),-sin(ph)*dir*6.2831853)*w;wt+=w;
        }
        return va/wt;
      }
${ALP_JOINT_GLSL}
${ALP_CANYON_GLSL}
      vec3 alpAlbedo; float alpRough, alpSnow, alpWet, alpGrass, alpField;
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
      // ---- the real eroded terrain from the air ---------------------------------------------------
      // The same terrain as the baked detail (erosion tile: R,G normal, B height) at 520 and 205 units,
      // the side projections stretched down the slope: a dendritic gully net, spurs and serrated ribs
      // on every face the aerial sees. eroH < 0 in its gullies, > 0 on its ribs (snow, rock tone).
      float eroH=0.;
      #ifndef ALP_PROP
      {
        float cA=.5,cB=.5,slopeK=smoothstep(.06,.32,steepT)*uErosionShade;
        float kA=(1.-smoothstep(16.,40.,foot))*slopeK,kB=(1.-smoothstep(6.,15.,foot))*slopeK;
        Ng=aTriNv(alpineErosion,P/520.+vec3(.63,0.,.29),Ng,W,2.3*kA,.7,cA);
        Ng=aTriNv(alpineErosion,P/205.+vec3(.11,0.,.83),Ng,W,1.9*kB,.7,cB);
        eroH=(cA-.5)*kA+(cB-.5)*kB*.85;
      }
      #endif
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
      float rockFlatL=max(aLuma(rock)*uRockTone,.002);   // the rock's flat albedo, before its relief shading
      rock=mix(rock,rock*vec3(1.06,1.03,.98)*1.18,smoothstep(.62,.85,macro)*.35);   // paler granite masses
      rock*=uRockTone*grain;
      rock*=mix(.6,1.24,smoothstep(-.6,.6,gullyH))*mix(1.,.85,clamp(flowN*1.4,0.,1.));
      rock*=1.+clamp(ribG,0.,1.)*.10;
      rock*=mix(.66,1.2,smoothstep(-.13,.13,eroH));
      // Rock relief: the real eroded terrain's own normals (rugged buttresses and runnels), then
      // (jointMix 0 = the original look) generated fracture plates at three sizes, the side projections
      // stretched down the slope; (jointMix 1 = the 2026-10-24 look) steep joint sets, flutes and water streaks
      // that all run DOWN the face: no polygons, no contours.
      vec3 Nr=Ng;float cav=1.,cav2=1.,cavE=1.;
      float rk=uRockDetail;
      #ifdef ALP_PROP
        rk*=.35;
      #endif
      float pk=1.-uJointMix;   // the old plates' share (1 = exactly the original)
      {
        float sE=105.*uRockScale;
        Nr=aTriNv(alpineErosion,P/sE+vec3(.21,.0,.57),Nr,W,1.25*rk*(1.-smoothstep(sE*.03,sE*.08,foot))*(1.-smoothstep(.85,.97,N0.y)*.6),.6,cavE);
        if(pk>.001){
          float s3=118.*uRockScale;float cav3=1.;
          Nr=aTriNv(alpineRock,Rp/s3+vec3(.71,.23,.09),Nr,W,.75*rk*pk*(1.-smoothstep(s3*.04,s3*.1,foot)),.5,cav3);
          rock*=mix(1.,.8+.4*cav3,.5*pk*(1.-smoothstep(s3*.04,s3*.1,foot)));
          float s2=30.*uRockScale;
          Nr=aTriNv(alpineRock,Rp/s2+vec3(.37,.11,.73),Nr,W,.7*rk*pk*(1.-smoothstep(s2*.03,s2*.09,foot)),.5,cav2);
          #ifndef ALP_LITE
          float s1=7.5*uRockScale;
          Nr=aTriNv(alpineRock,P/s1,Nr,W,.85*rk*pk*(1.-smoothstep(s1*.03,s1*.09,foot)),.6,cav);
          #endif
        }
      }
      rock*=mix(1.,cav*cav2,.22*min(rk,1.2)*pk)*mix(1.,.6+.8*cavE,.6*min(rk,1.2)*(1.-smoothstep(3.,9.,foot)));
      vec3 rockVar=vec3(1.);   // water streaks / varnish: applied at compose, so the turf keeps its own relief shading
      if(uJointMix>.001){
        float jm=uJointMix;
        float wallK=1.-smoothstep(.6,.9,N0.y);   // steep faces only
        #ifdef ALP_MESH
          // the watershed ground (the mountains seen from the air keep their approved look): only its sheer faces,
          // and only within ~100 units of the lens
          wallK=(1.-smoothstep(.5,.78,N0.y))*(1.-smoothstep(.08,.2,foot));
        #endif
        #ifdef ALP_PROP
          wallK=.5;
        #endif
        // grain: the stone's own fine unevenness, stretched down the face (the photo grain alone reads as plaster up close)
        {
          float gk=jm*rk*(1.-smoothstep(.15,.9,foot))*(.45+.55*wallK);
          if(gk>.01){
            float t1=.5,t2=.5;
            vec3 g1=aGrain(P,W,.9*uRockScale,.45,t1);
            #ifndef ALP_LITE
            vec3 g2=aGrain(P+vec3(7.3,3.1,5.7),W,3.1*uRockScale,.4,t2);
            g1=g1*.8+g2*.7*(1.-smoothstep(.5,1.6,foot));
            rock*=1.+(t1-.5)*.5*gk+(t2-.5)*.45*gk;
            #else
            rock*=1.+(t1-.5)*.34*gk;
            #endif
            Nr=normalize(Nr+(g1-Nr*dot(Nr,g1))*.3*gk);
          }
        }
        // flutes: the eroded terrain's own gullies and ribs stretched 3-5x down the face (buttresses, grooves)
        float fl=uRockFlute*jm*wallK;
        if(fl>.002){
          float cM=.5,cF=.5,cG=.5;
          float sM=150.*uRockScale;
          Nr=aTriNv(alpineErosion,P/sM+vec3(.57,0.,.13),Nr,W,2.2*fl*(1.-smoothstep(sM*.02,sM*.06,foot)),.3,cM);
          float s41=41.*uRockScale;
          Nr=aTriNv(alpineErosion,P/s41+vec3(.83,0.,.41),Nr,W,1.6*fl*(1.-smoothstep(s41*.03,s41*.08,foot)),.4,cF);
          rock*=mix(1.,.62+.76*cM,.5*fl*(1.-smoothstep(sM*.02,sM*.06,foot)))*mix(1.,.62+.76*cF,.45*fl*(1.-smoothstep(s41*.03,s41*.08,foot)));
          #ifndef ALP_LITE
          float s13=13.*uRockScale;
          Nr=aTriNv(alpineErosion,P/s13+vec3(.29,0.,.71),Nr,W,1.2*fl*(1.-smoothstep(s13*.03,s13*.08,foot)),.3,cG);
          rock*=mix(1.,.62+.76*cG,.34*fl*(1.-smoothstep(s13*.03,s13*.08,foot)));
          #endif
        }
        #if !defined(ALP_PROP) && !defined(ALP_MESH)
        // steep joint sets (canyon walls only, never the mountain ground seen from the air), ~60 degrees apart so a wall always meets one across its grain
        float jk=uJointAmt*jm*(1.-smoothstep(.3,.58,N0.y))*(1.-smoothstep(.13,.42,foot));   // joints: sheer faces, near the lens; never scratches on slopes seen from the air
        if(jk>.002){
          float lean=(1.-uJointSteep)*.7+.04,sc=uRockScale/max(uJointDensity,.05);
          vec4 j1=aJoint(P,N0,vec3(.913,lean,.408),15.*sc,1.3,.38,.24,.5,foot);
          vec4 j2=aJoint(P,N0,vec3(.060,-lean*.8,.998),8.5*sc,4.7,.36,.30,.4,foot);
          vec3 jp=j1.xyz+j2.xyz;float jg=1.-(1.-j1.w)*(1.-j2.w);
          #ifndef ALP_LITE
          vec4 j3=aJoint(P,N0,vec3(-.832,lean*.5,.555),3.8*sc,8.9,.2,.16,.25,foot);
          jp+=j3.xyz;jg=1.-(1.-jg)*(1.-j3.w);
          #endif
          Nr=normalize(Nr+jp*jk*2.2);
          rock*=1.-.34*jg*min(jk,1.3);
        }
        // water streaks and rock varnish: vertical columns, steep faces, not from far above
        float sk=uRockStain*jm*(1.-smoothstep(.5,.8,N0.y))*(1.-smoothstep(.5,2.2,foot));
        if(sk>.003){
          vec2 sA=aStreak(vec2(P.z,P.y)),sB=aStreak(vec2(P.x,P.y));
          vec2 st=mix(sB,sA,W.x/max(W.x+W.z,.001));
          vec3 sh=uRockStainColor/max(aLuma(uRockStainColor),.01);
          rockVar*=mix(vec3(1.),sh*.6,clamp(st.x*sk*.9,0.,1.));
          rockVar*=mix(vec3(1.),vec3(1.2,1.18,1.12),clamp(st.y*sk*.45,0.,1.));
        }
        #endif
      }
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
      // Alpine meadows: gentle ground low in its OWN valley (tAlp2.x: 0 floor → 1 crest), thinning with
      // steepness and up toward the rock and the snow, broken by scree, ribs and outcrops; never on the
      // wet shore. No absolute-height band: the only height term is the (noisy) snow line above.
      float vtG=clamp(tAlp2.x,0.,1.);
      float snowLineG=uSnowLine-(uSnow-1.)*260.+(macro-.5)*uSnowFade*.85;
      // the meadow follows the ground's broad slope (fine relief would speckle it into dots)
      float slopeOK=smoothstep(uGrassCos-.035,uGrassCos+.05,normalize(mix(N0,Ng,.35)).y);
      float rangeOK=1.-smoothstep(uGrassRange-.14,uGrassRange+.10,vtG+(patchN-.5)*.28);
      float belowSnow=1.-smoothstep(snowLineG-340.,snowLineG-60.,P.y);
      float breakup=aFbm(P.xz*.0042+vec2(7.7,1.1))*.62+aNoise(P.xz*.021+vec2(3.1,9.4))*.3+aNoise(P.xz*.06+vec2(1.7,5.2))*.08;
      float thr=.08+.2*uGrassPatch;
      float patchK=smoothstep(thr-.1,thr+.1,breakup+.12-screeM*.55-max(eroH,0.)*1.2-max(ribG,0.)*.3+concave*.12+flowW*.18-max(gullyH,0.)*.08);
      float grassM=clamp(uGrass*slopeOK*rangeOK*belowSnow*patchK*smoothstep(2.,7.,P.y),0.,1.);
      float mossM=0.,soilM=0.,lumR=1.,dmy=1.;vec3 chromR=vec3(1.),Nturf=Ng,mossC=uMossColor;
      #ifndef ALP_MESH
        grassM=0.;
      #endif
      #ifdef ALP_BANK
      {
        // Canyon flight. tBaseUp is the wall's own slope before its rock relief: broad gentle ground (wall
        // tops, benches, toe slopes, the rims seen from the river) carries turf; inside a sheer wall only the
        // upward-facing ledges of its relief do (the local normal turns up while the wall stays steep), so
        // the grass sits in tufts and strips on the ledges and never runs down the rock face.
        float broadUp=normalize(mix(N0,Ng,.4)).y;
        vec3 cf=alpCanyonField(P,tBaseUp,N0.y,broadUp,Ng.y,-max(eroH,0.)*1.5-screeM*.4+concave*.2,3.5);
        float gentleC=cf.y,tuft=cf.z,field=cf.x*belowSnow;alpField=cf.x;
        // The photo's own clumps, soil and stones at first-person distance (2.4- and 9-unit tiles, triplanar:
        // no stretching on steep ground). lumR: its local brightness around 1 (dark gaps < 1 < lit tufts).
        {
          vec3 gmC=max(texture2D(grassColor,vec2(.5),10.).rgb,vec3(.01));
          float f9=1.-smoothstep(.45,1.3,foot);
          vec3 r9=mix(vec3(1.),aTriC(grassColor,P/(9.*uGrassScale)+vec3(.71,.29,.13),W)/gmC,f9),r2=vec3(1.);
          // the turf drapes over the rock's own relief (its facets and runnels light the turf too)
          Nturf=aTriN(grassNormal,P/(9.*uGrassScale)+vec3(.71,.29,.13),normalize(mix(Ng,Nr,.7)),W,.75*uGrassDetail*f9,dmy);
          #ifndef ALP_LITE
            float f2=1.-smoothstep(.12,.36,foot);
            r2=mix(vec3(1.),aTriC(grassColor,P/(2.4*uGrassScale)+vec3(.31,.17,.62),W)/gmC,f2);
            Nturf=aTriN(grassNormal,P/(2.4*uGrassScale)+vec3(.31,.17,.62),Nturf,W,1.15*uGrassDetail*f2,dmy);
          #endif
          lumR=clamp(aLuma(r2)*aLuma(r9),.3,2.2);chromR=(r2*r9)/max(lumR,.01);
        }
        // a fringed edge: the clumps themselves reach out over the rock (or stop short of it)
        float fringe=(lumR-1.)*.42+(aNoise(P.xz*.9+P.y*.5+vec2(4.4,2.2))-.5)*.14;
        field+=fringe*smoothstep(0.,.18,field);
        float fa=fwidth(field)*.8+.01;
        grassM=smoothstep(.36-fa,.36+fa,field);
        // a darker soil line just outside the turf
        soilM=(1.-grassM)*smoothstep(.25,.35,field)*.75;
        // damp moss: the rock a little above the water line, steep rock too (moss clings), in crisp tongues
        // a thin damp band (moss on the shelves and the wall's foot, not blobs up a sheer face)
        float damp=smoothstep(2.4,3.2,P.y)*(1.-smoothstep(3.8,6.,P.y+(tuft-.5)*4.));
        // patchy: tongues and pads along the foot with bare rock between (3-12 units), never a continuous band
        damp*=smoothstep(.45,.62,aNoise(P.xz*.11+vec2(8.4,1.6))*.7+aNoise(P.xz*.37+vec2(2.2,5.1))*.3);
        float mfield=uRiverMoss*damp*smoothstep(.28,.55,Ng.y)*(tuft+concave*.3-max(eroH,0.)*.8+.12+(lumR-1.)*.35);
        float ma=fwidth(mfield)*.8+.01;
        mossM=smoothstep(.42-ma,.42+ma,mfield);
        #ifndef OPAQUE
          // the see-through 'atmospheric far range' card shares this material: no turf painted on the haze
          grassM=0.;mossM=0.;soilM=0.;
        #endif
      }
      #endif
      // forest and scrub: patches on the valley floors and the sheltered lower slopes
      float clumps=aFbm(P.xz*.0068+vec2(4.2,1.3))*.72+aNoise(P.xz*.034+vec2(9.1,6.2))*.28;
      float floorBias=clamp(flowW*1.2+concave*.6+(1.-vtG)*.55,0.,1.);
      float forestM=clamp(uForest*(1.-smoothstep(plantY-240.,plantY-40.,P.y))*smoothstep(.76,.9,Ng.y)
        *smoothstep(.5,.6,clumps+floorBias*.3-(sunny-.5)*.1),0.,1.);
      // Meadow colour: the photo's own colour variation (grass, soil, stones) around its mean, on a tint
      // that sits in the valley's light — green-gold on the sunny, upper ground, cooler in shade and low.
      // Two turned scales multiplied (no visible repeat) plus a broad one for the aerial patches.
      vec3 grassC,gRatio=vec3(1.);vec2 gNrm=vec2(0.);
      {
        vec3 gm=max(texture2D(grassColor,vec2(.5),10.).rgb,vec3(.01));
        float sunLit=clamp(sunny*.75+vtG*.45-.1,0.,1.);
        vec3 gTint=mix(uGrassShadeColor,uGrassColor,sunLit)*(.9+.2*geo);
        #ifdef ALP_BANK
          gTint=mix(mix(uMossColor,gTint,.45),gTint,smoothstep(8.,70.,P.y+(geo-.5)*30.));
          gTint=mix(gTint,vec3(aLuma(gTint)),.22);   // canyon turf in full sun: no lime
        #endif
        float sA=7.*uGrassScale,sB=31.*uGrassScale;
        vec2 uA=P.xz/sA,uB=mat2(.8,-.6,.6,.8)*P.xz/sB+vec2(.37,.11),uC=mat2(.6,.8,-.8,.6)*P.xz/(140.*uGrassScale)+vec2(.71,.29);
        vec3 rB=clamp(texture2D(grassColor,uB).rgb/gm,.35,2.2),rC=clamp(texture2D(grassColor,uC).rgb/gm,.35,2.2);
        #ifdef ALP_LITE
          vec3 ratio=sqrt(rB*rC);
        #else
          vec3 rA=clamp(texture2D(grassColor,uA).rgb/gm,.35,2.2);
          vec3 ratio=pow(rA*rB*rC,vec3(1./2.2));
        #endif
        #ifdef ALP_BANK
          ratio=pow(ratio,vec3(1.5));   // the photo's own variation reads up close in the canyon
        #endif
        grassC=gTint*mix(vec3(1.),ratio,clamp(uGrassDetail,0.,2.));gRatio=ratio;
        #ifdef ALP_BANK
          // seen from 20-200 units the photo is mip-averaged: tussock and soil variation at that scale
          grassC*=mix(.74,1.2,aNoise(P.xz*.07+vec2(3.3,1.9)))*mix(.86,1.12,aNoise(P.xz*.23+vec2(8.1,4.4)))*mix(.9,1.06,aNoise(P.xz*.8));
        #endif
        #ifdef ALP_BANK
        {
          // First person: the turf's albedo follows the rock's (it can never glow against shaded rock); its
          // hue is the dials' tint, desaturated, varied between dark moss, olive and dry straw; dark soil
          // between the clumps.
          float refL=aLuma(mix(uRockColor,uRockColor2,.5))*uRockTone;
          vec3 hue=mix(gTint,vec3(aLuma(gTint)),.35);hue/=max(aLuma(hue),.005);
          vec3 straw=vec3(.56,.47,.29),olive=vec3(.37,.38,.22),dmoss=vec3(.21,.22,.13);
          float pv=aNoise(P.xz*.09+vec2(1.3,7.7))*.6+aNoise(P.xz*.31+vec2(5.5,2.1))*.4;
          vec3 pal=mix(dmoss,olive,smoothstep(.25,.5,pv));
          pal=mix(pal,straw,smoothstep(.55,.8,pv)*smoothstep(10.,40.,P.y));
          pal=mix(dmoss,pal,smoothstep(5.,25.,P.y));
          vec3 cc=mix(mix(pal/max(aLuma(pal),.005),hue,.4),vec3(1.),.22);   // muted alpine turf, still reading as grass against the rock
          // the photo's dark gaps between the clumps, deepened (the detail dial sets how much)
          float cavT=clamp(pow(lumR,1.7*clamp(uGrassDetail,0.,2.)),.18,1.7);
          // ...and carries the rock's relief shading (cavities, runnels, facet tone), so it sits IN the wall
          float relief=clamp(pow(aLuma(rock)/rockFlatL,.85),.35,1.6);
          grassC=cc*refL*1.1*mix(.62,1.08,pv)*cavT*mix(vec3(1.),chromR,.55)*relief;
          mossC=uMossColor/max(aLuma(uMossColor),.005)*refL*.4*(.75+.5*pv)*clamp(pow(lumR,1.5),.25,1.6)*relief;
        }
        #endif
        float fA=1.-smoothstep(.12*sA,.32*sA,foot),fB=1.-smoothstep(.12*sB,.32*sB,foot);
        vec2 nB=texture2D(grassNormal,uB).xy*2.-1.;nB=transpose(mat2(.8,-.6,.6,.8))*nB;
        #ifdef ALP_LITE
          gNrm=nB*fB*.7;
        #else
          vec2 nA=texture2D(grassNormal,uA).xy*2.-1.;
          gNrm=nA*fA+nB*fB*.6;
        #endif
        gNrm*=.55*uGrassDetail;
        #ifdef ALP_BANK
        #endif
      }
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
        float support=Ng.y+uSnowGully*(concave*.12+flowN*.07-gullyH*.05-eroH*1.1)-max(ribG,0.)*.06;
        float hold=smoothstep(uSnowCos-.05,uSnowCos+.05,support);
        // couloirs: the FINE gullies (≤ 50 units) hold snow down steep faces — flutes, not drips
        float couloir=min(1.,uSnowGully)*smoothstep(.2,.55,-gullyF*max(uSnowGully,.01))*smoothstep(.12,.32,Ng.y)*(1.-hold)*smoothstep(.0,.35,alt-.3);
        float cover=alt*min(uSnow,1.)*max(hold,couloir);
        cover=max(cover,.86*high*min(uSnow,1.)*smoothstep(.16,.34,Ng.y+concave*.1*uSnowGully)*smoothstep(-.5,.1,.08+uSnowGully*(gullyF*.35-eroH*1.4)-max(gullyH,0.)*.45));
        cover+=alt*max(uSnow-1.,0.)*.6*smoothstep(.15,.4,Ng.y);
        // a crisp edge (snow lies or it does not), antialiased by the pixel footprint of the field
        float cv=cover+(aNoise(P.xz*.021)-.5)*.10,aa=fwidth(cv)*.8+.012;
        snowM=smoothstep(.49-aa,.49+aa,cv);
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
        Nsn=Nb;snowC*=cs*uSnowBright;
        vec3 iceC=mix(uSnowColor*.9,uSnowShade,.5)*(.92+.12*smoothstep(-.4,.4,gullyH));
        snowC=mix(snowC,iceC,glacM*(1.-smoothstep(lineY+80.,lineY+uSnowFade,P.y))*.75);
        snowM=max(snowM,glacM*.92);
      }
      #endif
      // ---- compose ---------------------------------------------------------------------------------
      vec3 col=mix(rock*rockVar,scree,screeM);
      col=mix(col,uScreeColor*(.8+.3*geo)*mix(1.,scav,.4),moraM);
      col=mix(col,col*vec3(.42,.38,.33),soilM);
      col=mix(col,grassC,grassM*(1.-moraM));
      col=mix(col,mossC,mossM);
      col=mix(col,forestC,forestM*(1.-moraM));
      // ---- valley tonal layers: floor (dark, cool) → mid slope → upper slope / ridge (light) ----------
      // By the ground's place in its own local relief (tAlp2.x), so every valley has its gradation at
      // whatever height it lies; '#808080' is neutral. Valley shade darkens deep and enclosed ground.
      {
        float vt=pow(clamp(tAlp2.x,0.,1.),uValleyReach);
        float bw=.5/max(uValleyBlend,.05);
        float lowMid=smoothstep(.25-bw*.5,.25+bw*.5,vt),midUp=smoothstep(.72-bw*.5,.72+bw*.5,vt);
        vec3 vTint=mix(mix(uValleyFloorColor,uValleyMidColor,lowMid),uValleyUpperColor,midUp)/.2158;
        vTint=max(vec3(0.),vec3(1.)+(vTint-vec3(1.))*uValleyContrast);
        col*=mix(vec3(1.),vTint,clamp(uValleyTone,0.,2.)*(1.-snowM*.75)*(1.-grassM*GRASS_VT));
        col*=1.-clamp(uValleyShadow*tAlp2.y*.5,0.,.85)*(1.-snowM*.5);
      }
      col=mix(col,snowC,snowM);
      col*=mix(1.,tAO,.85*(1.-snowM*.6));
      alpWet=1.-smoothstep(.4,5.,P.y);
      col*=mix(1.,.45,alpWet);
      col=mix(col,vec3(.03,.028,.02),(1.-smoothstep(-.6,1.5,P.y))*.5);
      alpAlbedo=col;alpSnow=snowM;alpGrass=grassM;
      alpRough=mix(.90,.94,screeM);alpRough=mix(alpRough,.95,grassM);alpRough=mix(alpRough,.97,forestM);
      alpRough=mix(alpRough,mix(.74,.5,glacM),snowM);
      // the wet rock at the wall foot: a satin sheen in the original look, matte stone (wetMatte) in the joint look
      alpRough=mix(alpRough,mix(.32,.64,uWetMatte*uJointMix),alpWet*(1.-forestM));
      // normals: rock / scree / plants / snow
      vec3 Nf=mix(Nr,Ns,screeM);
      {
        vec3 gd=vec3(gNrm.x,0.,gNrm.y);
        vec3 Nv=normalize(Ng+gd-Ng*dot(Ng,gd));
        #ifdef ALP_BANK
          Nv=Nturf;   // the canyon turf's triplanar photo normal (2.4 + 9 units) catches the sun
        #endif
        Nf=normalize(mix(Nf,Nv,max(max(grassM,forestM),mossM*.8)));
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
      float wetM=uWetMatte*uJointMix;   // 0 = the original (foil-like glints at the wall foot)
      roughnessFactor=clamp(roughnessFactor+min(.25+.2*wetM,.5*(dot(nDx,nDx)+dot(nDy,nDy))),mix(mix(.3,.56,wetM),.62,1.-alpWet),1.);
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
      if(uAlpDebug>.5)gl_FragColor=vec4(uAlpDebug<1.5?alpN*.5+.5:uAlpDebug<2.5?vec3(alpSnow,alpRough,alpWet):uAlpDebug<3.5?alpAlbedo*2.:uAlpDebug<6.5?vec3(alpGrass,alpSnow,0.):vec3(tBaseUp,alpGrass,alpField),1.);`);
}

/** Installs the alpine material on the canyon rock (props) and the watershed terrain (mesh). */
export function installAlpineTerrain(THREE, { rockMaterial, terrainMaterial, lite = false, maps }) {
  THREE_ = THREE; MAPS = maps;
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
    material.customProgramCacheKey = () => 'alpine-terrain-v2' + (mesh ? '-mesh' : '-rock') + (lite ? '-lite' : '');
    material.defaultAttributeValues = { ...material.defaultAttributeValues, terrainAO: [1] };
    material.onBeforeRender = sync;
    material.userData.alpineTerrain = true; material.needsUpdate = true;
  }
  if (typeof window === 'object') window.__ALPINE_TERRAIN__ = ALPINE_TERRAIN;
  return { uniforms: U, sync: syncAlpineUniforms, dispose() {} };
}
