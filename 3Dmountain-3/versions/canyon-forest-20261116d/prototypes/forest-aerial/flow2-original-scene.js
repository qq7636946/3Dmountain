import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* Flow2 · the forest view's picture (third team, D1, 2026-11-15). Doc: docs/flow2/flow2-td3-picture-20261115.md
   The client's own plate (original/forest-four-rivers.png) draped on the relief model, the SAME picture made finer and alive:
   · fineness    a 2x plate (d1-plate-2x.jpg: Lanczos + crown-scale detail taken from the plate's own forest + unsharp) and a
                 ground-fixed detail tile (d1-detail.png) one octave finer: nothing here moves, so nothing crawls;
   · living water the lake and the four rivers flow: streaks drawn ALONG the flow (d1-streak.jpg, a line-integral convolution
                 of noise along d1-flow.png) slide down each river into the lake (two-phase advection), a slow swirl in the
                 lake, sparkle where the plate's water is bright, foam where a river enters; d1-water.png says where water is;
   · camera      pass 2: a real perspective lens (see THE LENS below): GPT's framing at rest (the client confirmed it), a slow
                 glide, a rise on arrival, a sink-and-tilt between the two chapters, a lean toward the step's river, a drag that
                 turns the land; the picture's edge can never show;
   · air         clouds, mist and cloud shadows belong to D2 (flow2-scene-air.js): when window.__FLOW2_FOREST_AIR__ exists its
                 shadow function is compiled into this material; without it GPT's four mist planes and shadow noise stay.
   Everything is keyed on the WORLD position (plate uv = (world.xz - bounds.min) / size), so any relief model with the same
   footprint works (M's new terrain-original.glb drops in). All maps: bake script .qa/index1-5/flow2-td3/D1/bake_plate.py.
   Dials: panel 「森林水流」 (key O) = the tune object below.
   Switches: ?forestfine=0 (GPT's plain picture) · ?forestwater=0 · ?forestplate=1 (the 1494-px plate) · quality tier
   (window.__FLOW2_QUALITY__.start): high = 2x plate, medium = the 1494 plate + all effects, low = the plain picture.
   No file from ../assets/ is used. */
const VERSION = 'td3-d1-28';
const PLATE = [1494, 836];
const NOISE = `
  float forestHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float forestNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(forestHash(i),forestHash(i+vec2(1.,0.)),f.x),mix(forestHash(i+vec2(0.,1.)),forestHash(i+vec2(1.)),f.x),f.y);}
  float forestFbm(vec2 p){float v=0.;float a=.5;for(int i=0;i<4;i++){v+=a*forestNoise(p);p=p*2.03+vec2(17.2,9.4);a*=.5;}return v;}
`;
const GROWN = `(.26+.26*gw.r+.52*pow(gw.g,.8))/1.04`;      /* when the growth reaches a place: 0 at the lake's shore … 1 on the far hills */
const VERT = `
  varying vec3 vForestWorld;
  #ifdef FOREST_RELIEF
  uniform sampler2D tCanopy,tGrow; uniform vec4 uBounds; uniform vec2 uYRange; uniform float uCanopy,uRelief,uGrow;
  #endif
  void main(){
    vec3 p=position;
    #ifdef FOREST_RELIEF
    /* the surface: M's ground (R) + the canopy above it (G x 0.12), flat on the water; the canopy rises where the growth has arrived */
    vec2 uv=(p.xz-uBounds.xy)*uBounds.zw;
    vec3 c=texture2D(tCanopy,uv).rgb;
    float grown=1.;
    #ifdef FOREST_GROW
    vec3 gw=texture2D(tGrow,uv).rgb;
    grown=smoothstep(0.,.16,uGrow*1.2-${GROWN});
    #endif
    float ground=uYRange.x+c.r*uYRange.y;
    p.y=max(.105+(ground-.105)*uRelief+c.g*.12*uCanopy*grown,.105);
    #endif
    vec4 w=modelMatrix*vec4(p,1.); vForestWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;
  }`;
/* a dense flat grid over the plate's footprint (x east, z south); the vertex shader lifts it */
function reliefGrid(nx, nz, width, depth) {
  const position = new Float32Array((nx + 1) * (nz + 1) * 3), index = new Uint32Array(nx * nz * 6);
  let p = 0, q = 0;
  for (let j = 0; j <= nz; j++) { const z = -depth / 2 + depth * j / nz; for (let i = 0; i <= nx; i++) { position[p++] = -width / 2 + width * i / nx; position[p++] = 0; position[p++] = z; } }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; index[q++] = a; index[q++] = c; index[q++] = b; index[q++] = b; index[q++] = c; index[q++] = d; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3)); geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .4, 0), Math.hypot(width, depth) / 2 + 1);
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-width / 2, 0, -depth / 2), new THREE.Vector3(width / 2, 1, depth / 2));
  return geometry;
}
/* lead (2026-11-15, the client: 「水可以做成3D嗎 還有山谷這些」): air between the lens and the land. Nothing at the point the lens looks at,
   more where the land is farther; the valley floors keep it, the ridges stand out of it. From straight above it is not there at all. */
const HAZE = `
  uniform float uLattice; uniform vec3 uLatticeGround;   /* AFTER (2026-11-16): 0 = the view, 1 = the dark ground the 3D lines are drawn on */
  uniform float uHaze,uDist;
  vec3 forestHaze(vec3 col,vec3 world){
    float far=clamp((length(cameraPosition-world)-uDist)/uDist*5.,0.,1.);
    float low=1.-smoothstep(.12,.8,world.y);
    return mix(col,vec3(.63,.73,.77),far*(.3+.7*low)*uHaze*.6);
  }`;
const FRAG = `
  uniform sampler2D tPlate,tWater,tFlow,tStreak,tDetail,tCanopy,tGrow;
  uniform float uTime,uWater,uRiver,uStreak,uSwirl,uGlint,uFoam,uWet,uDetail,uVig,uCloud,uGrow,uLight,uSheen,uGrowGlow;
  uniform vec4 uBounds,uEmph,uView; uniform vec3 uLake,uSun;
  uniform float uLand; uniform vec4 uLandA,uLandB;   /* D1 LAND (2026-11-16): see "D1 LAND" below */
  varying vec3 vForestWorld;
  const vec2 PX=vec2(${PLATE[0]}.,${PLATE[1]}.);
  ${NOISE}
  ${HAZE}
  #ifdef FOREST_WATER3D
  /* THE WATER AS A SURFACE (lead, 2026-11-15). Waves with real slopes (a tile baked here: original/lead-waves.jpg), so the water answers
     the lens: the bed seen through it bends, deep water is darker, the sky and the banks stand mirrored in it (longer as the lens sinks),
     small facets catch the sun. ?water3d=0 = the painted water of pass 1. */
  uniform sampler2D tWaves; uniform vec2 uYRange; uniform float uRelief,uCanopy,uW3,uW3Wave,uW3Refl,uW3Deep;
  float forestTop(vec2 p){
    vec3 c=texture2D(tCanopy,(p-uBounds.xy)*uBounds.zw).rgb;
    return max((uYRange.x+c.r*uYRange.y-.105)*uRelief+c.g*.12*uCanopy,0.);
  }
  #endif
  #ifdef FOREST_RIVER
  /* THE RIVERS AND THE LAKE AS THREE.JS WATER (lead, 2026-11-15; client: 「河流部分要three.js 跟前面一樣的河流感覺，沒有流動的感覺」): the same kind
     of water as the valley before it — deep blue body, glossy, mirroring, moving — not the picture's painted water. The rivers FLOW (the wave
     pattern is carried down each river along the flow map, two phases), the lake moves in the wind; the 3D banks and trees stand mirrored in
     it (FOREST_MIRROR: a planar reflection drawn each frame), the sky elsewhere; the sun on the waves; white water where a river runs fast and a
     lap line on the shores. ?river3=0 = the earlier water. */
  uniform float uRv,uRvSpeed,uRvWave,uRvRefl,uRvSun,uRvFoam,uRvBed,uRvFine; uniform vec3 uRvDeep,uRvSky;
  uniform vec3 uRvShallow; uniform vec4 uRvLook;   /* D2: shallow colour; (clear shallows, -, rapids gain, sun-path gain) */
  #ifdef FOREST_LOGO
  uniform sampler2D tLogo; uniform vec4 uLogoC,uLogoD,uLogoF,uLogoG; uniform vec3 uLogoRing,uLogoBlade;
  #endif
  #ifdef FOREST_LAKEVIDEO
  /* THE LAKE VIDEO (F1, 2026-11-16): media/logo.mp4 — uLakeVid = (centre x, z, the video's height in world units, strength × shown),
     uLakeVid2 = (turn, aspect, ripple relief, ripple light) */
  uniform sampler2D tLakeVid; uniform vec4 uLakeVid,uLakeVid2;
  #endif
  #ifdef FOREST_MIRROR
  uniform sampler2D tRefl; uniform mat4 uReflMat; uniform float uMirror;
  #endif
  #endif
  /*AIR*/
  void main(){
    #ifdef FOREST_MIRROR
    if(uMirror>.5&&vForestWorld.y<.1072)discard;            /* the mirror shows what stands above the water */
    #endif
    vec2 uv=(vForestWorld.xz-uBounds.xy)*uBounds.zw;
    vec3 col=texture2D(tPlate,uv).rgb;                       /* linear */
    vec3 wt=texture2D(tWater,uv).rgb;
    float wm=wt.r, shore=wt.g, lakeN=wt.b;
    float L=dot(col,vec3(.2126,.7152,.0722));
    /* 0 · the spreading (arrival): how far the water (wet) and the growth (grown) have come at this place */
    vec3 plate0=col; float grown=1., wet=1.;
    #ifdef FOREST_GROW
    vec3 gw=texture2D(tGrow,uv).rgb;
    float edgeN=texture2D(tDetail,uv*vec2(6.,3.36)+.2).b-.5;
    grown=smoothstep(0.,.10,uGrow*1.2-${GROWN}+edgeN*.09);
    wet=smoothstep(0.,.06,uGrow*3.-gw.r+edgeN*.03);
    #endif

    /* 1 · ground-fixed micro detail: one octave under the plate's own grain */
    #ifdef FOREST_DETAIL
    float gr=col.g/max(col.r,1e-3), gb=col.g/max(col.b,1e-3);
    float forest=smoothstep(1.1,1.5,gr)*smoothstep(1.2,1.8,gb)*(1.-wm);
    float crown=texture2D(tDetail,uv*vec2(11.,6.155)).r-.5;
    float speck=texture2D(tDetail,uv*vec2(3.64,2.037)+.37).g-.5;
    float pale=smoothstep(.28,.6,L)*(1.-forest)*(1.-wm);
    col*=1.+crown*uDetail*.95*forest*smoothstep(.0,.05,L)+speck*uDetail*.5*pale;
    #endif
    /* the crowns answer the plate's own sun a little: the canopy's slope toward the sun, from the height map (two taps, 1.25 plate px apart) */
    #ifdef FOREST_LIGHT
    vec2 sd=normalize(uSun.xz)/PX*1.25;
    col*=1.+clamp((texture2D(tCanopy,uv-sd).g-texture2D(tCanopy,uv+sd).g)*uLight*3.2,-.35,.35)*(1.-wm)*grown;
    #endif

    /* D1 LAND (2026-11-16, client: 「照我給你的圖你在繼續修細」 + a photoreal target of this very view). The bake's land made richer with no new
       geometry, texture or program: (1) a canopy of many crowns where the bake shows vegetation, each a lit dome with dark gaps between them
       (depth), deep emerald to olive, a few sunlit lime tops; (2) the bright lime flats that stay clearings become textured olive-to-lime grass;
       (3) the rock terraces get dark risers between their strata and moss on the flat ledges; (4) the ground's own relief answers the sun.
       uLandA = (crowns, crown size, clearings, strata), uLandB = (moss, relief shade, tree light, -). ?land=old = none. */
    float landOn=uLand;
    #ifdef FOREST_MIRROR
    landOn*=1.-step(.5,uMirror);   /* not in the mirror's own pass (the reflected banks are small and blurred) */
    #endif
    if(landOn>.001){
      float landK=landOn*(1.-smoothstep(.02,.35,wm))*grown;
      vec3 cB=col; float Lb=dot(cB,vec3(.2126,.7152,.0722));
      float mxB=max(cB.r,max(cB.g,cB.b)), mnB=min(cB.r,min(cB.g,cB.b)), satB=(mxB-mnB)/max(mxB,1e-4);
      float veg=smoothstep(.015,.12,(cB.g-max(cB.r,cB.b))/max(mxB,1e-4));
      float meadow=veg*smoothstep(.06,.20,Lb)*smoothstep(.55,.85,cB.r/max(cB.g,1e-4));
      float rockB=(1.-smoothstep(.12,.30,satB))*(1.-veg);
      vec2 eG=1.6/PX; float hC=texture2D(tCanopy,uv).r;
      float hx=texture2D(tCanopy,uv+vec2(eG.x,0.)).r-texture2D(tCanopy,uv-vec2(eG.x,0.)).r, hz=texture2D(tCanopy,uv+vec2(0.,eG.y)).r-texture2D(tCanopy,uv-vec2(0.,eG.y)).r;
      vec3 gN=normalize(vec3(-hx*9.,1.,-hz*9.)), sunN=normalize(uSun);
      float litG=clamp(dot(gN,sunN),0.,1.);
      /* (1) crowns on a jittered grid in world space — worked out only where crowns are drawn */
      float field=forestFbm(vForestWorld.xz*.85+3.7);
      float cover=veg*smoothstep(.56,.74,field+(1.-meadow)*.20+smoothstep(.1,.35,texture2D(tCanopy,uv).g)*.3);
      float crownK=cover*landK*clamp(uLandA.x,0.,1.5)*.92;
      if(crownK>.002){
      vec2 cp=vForestWorld.xz*(9.5/max(uLandA.y,.3)); cp+=vec2(forestNoise(vForestWorld.xz*2.3),forestNoise(vForestWorld.xz*2.3+9.1))*.9;   /* no visible grid */
      vec2 ci=floor(cp), cf=fract(cp);
      float best=8.,best2=8.,bh=0.; vec2 bo=vec2(0.);
      for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
        vec2 g=vec2(float(i),float(j));
        vec2 o=g+vec2(forestHash(ci+g),forestHash(ci+g+17.3))*.8+.1-cf;
        float d=length(o)/(.30+.42*forestHash(ci+g+41.7));
        if(d<best){best2=best;best=d;bo=o/(.30+.42*forestHash(ci+g+41.7));bh=forestHash(ci+g+5.1);}else if(d<best2)best2=d;
      }
      float dome=sqrt(max(0.,1.-min(best,1.)*min(best,1.)));
      /* leaf clusters inside the crown: a finer bump field, so a crown is never a smooth ball */
      float lc=forestNoise(vForestWorld.xz*58.+bh*9.)-.5, lc2=forestNoise(vForestWorld.xz*121.+bh*5.)-.5;
      vec3 cN=normalize(vec3(-bo.x*.85+lc*.9,dome+.25,-bo.y*.85+lc2*.9));
      float clit=.50+1.02*clamp(dot(cN,sunN),0.,1.);
      float gap=smoothstep(.80,1.10,best)*smoothstep(0.,.25,best2-best+.05);
      /* the crown's colour: the bake's own green at this place (its hue variety), drawn toward emerald / olive, a few sunlit lime tops */
      vec3 own=cB/max(Lb,1e-3)*.092;
      vec3 crownC=mix(own,mix(vec3(.040,.095,.040),vec3(.080,.115,.040),smoothstep(.2,.8,bh)),.55);
      crownC=mix(crownC,vec3(.17,.25,.06),smoothstep(.91,.99,bh)*smoothstep(.75,1.25,clit));
      crownC=mix(crownC*clit*(.86+.24*dome),vec3(.010,.022,.012),gap*.62);
      col=mix(col,crownC,crownK);
      }
      /* (2) the clearings that stay: textured grass, olive to lime, shaded by the ground */
      float tuft=forestNoise(vForestWorld.xz*95.)*.6+forestNoise(vForestWorld.xz*31.)*.4;
      vec3 grass=mix(cB*vec3(.66,.80,.54),cB*vec3(.98,1.04,.80),tuft)*(.84+.36*litG);
      col=mix(col,grass,meadow*(1.-cover)*landK*clamp(uLandA.z,0.,1.5));
      /* (3) the rock terraces: dark risers between the strata, moss on the flat ledges */
      /* warm grey stone (the bake's stone leans lavender under the page's blue grade) */
      float rk=rockB*landK*clamp(uLandA.w,0.,2.);
      col=mix(col,vec3(dot(col,vec3(.2126,.7152,.0722)))*vec3(1.06,1.01,.90),.55*min(rk,1.));
      float band=fract(hC*38.+forestNoise(vForestWorld.xz*6.)*.35);
      float riser=smoothstep(.70,.98,band)*(1.-smoothstep(.98,1.,band));
      float lip=smoothstep(.0,.06,band)*(1.-smoothstep(.06,.20,band));
      col*=1.-riser*rk*.55;
      col*=1.+lip*rk*.30*(.5+litG);
      float ledge=smoothstep(.84,.97,gN.y)*smoothstep(.40,.60,forestNoise(vForestWorld.xz*22.)*.7+forestNoise(vForestWorld.xz*7.)*.3);
      col=mix(col,vec3(.046,.072,.028)*(.7+.6*litG),ledge*rockB*.70*landK*uLandB.x);
      /* (4) the ground answers the sun (the bake's own light is soft) */
      col*=mix(1.,.62+.62*litG,.6*landK*uLandB.y);
    }

    /* 2 · living water */
    #ifdef FOREST_WATER
    float W=uWater*wet;                                      /* no flow, no light where the water has not arrived yet */
    vec3 fl=texture2D(tFlow,uv).rgb;
    vec2 F=fl.rg*2.-1.;                                      /* plate-pixel direction x speed, toward the lake */
    float nz=texture2D(tDetail,uv*vec2(2.2,1.231)+.13).b;
    float ph=uTime*.16+nz*1.7;
    float p1=fract(ph), p2=fract(ph+.5);
    float w1=1.-abs(2.*p1-1.), w2=1.-w1;
    vec2 d=F/PX*46.;
    vec3 s1=texture2D(tStreak,uv-d*(p1-.5)).rgb, s2=texture2D(tStreak,uv-d*(p2-.5)).rgb;
    float nrm=inversesqrt(w1*w1+w2*w2);
    float fineS=.10+((s1.r-.10)*w1+(s2.r-.10)*w2)*nrm;
    float broad=.40+((s1.g-.40)*w1+(s2.g-.40)*w2)*nrm;
    float spark=s1.b*w1+s2.b*w2;
    float sh2=shore*shore, shoreN=clamp(sh2*4.,0.,1.);       /* shore is sqrt-coded: sh2 = 1 at 56 plate px, shoreN = 1 at 14 px */
    float riv=wm*(1.-lakeN), lak=wm*lakeN;
    vec4 idw=clamp(1.-abs(fl.b*4.-vec4(1.,2.,3.,4.))*2.5,0.,1.)*(1.-lakeN);
    float e=dot(uEmph,idw);
    vec2 q=(uv-uLake.xy)*vec2(1.,PX.y/PX.x);
    float rr=length(q)/uLake.z, ang=atan(q.y,q.x);
    /* the rivers: present along their whole length, strongest where they run into the lake */
    float toLake=1.-smoothstep(.10,.46,length(q));
    float pres=uRiver*(.78+.55*toLake)*(1.+e*1.1);
    float mid=mix(.5,1.,smoothstep(0.,.5,shoreN));
    /* the lake: calm at the shores and in lanes, finer in the open middle; the plate's own soft light on the water stays */
    float lane=smoothstep(.34,.62,texture2D(tDetail,uv*vec2(1.3,.727)+.61).b);
    float open=1.-smoothstep(.8,3.4,rr);
    float keep=1.-.85*smoothstep(.15,.40,L);
    float lakeB=lak*smoothstep(.08,.85,sh2)*mix(.15,1.,lane)*mix(.5,1.,open)*keep*.5;
    float lakeF=lak*smoothstep(.2,.9,sh2)*lane*open*keep*.22;
    float amtB=(riv*mid*pres+lakeB)*W, amtF=(riv*mid*pres+lakeF)*W;
    vec3 jade=vec3(.50,.93,.80), silver=vec3(.90,.97,1.);
    float fine=smoothstep(.16,.62,fineS);
    #ifdef FOREST_WATER3D
    float W3=uW3*W*wm;
    vec2 wp=vForestWorld.xz;
    vec2 fdir=F/max(length(F),1e-3);
    float gust=.3+.7*smoothstep(.36,.66,texture2D(tDetail,wp*.21+vec2(uTime*.006,-uTime*.004)).b);    /* wind in patches */
    mat2 r1=mat2(.8,-.6,.6,.8), r2=mat2(.6,.8,-.8,.6);
    vec2 sA=texture2D(tWaves,wp*1.7+vec2(.86,.5)*uTime*.030).rg-.5;
    vec2 sB=(texture2D(tWaves,r1*wp*3.9+vec2(-.3,.9)*uTime*.045).rg-.5)*r1;
    vec2 sC=(texture2D(tWaves,r2*wp*8.3+vec2(.7,-.4)*uTime*.070).rg-.5)*r2;
    vec2 lakeS=(sA*.9+sB*.75+sC*.6)*gust;
    vec2 rv1=texture2D(tWaves,wp*5.2-fdir*p1*.9).rg-.5, rv2=texture2D(tWaves,wp*5.2+.37-fdir*p2*.9).rg-.5;
    vec2 rivS=(rv1*w1+rv2*w2)*nrm*1.2+sC*.5;
    vec2 slope=mix(rivS,lakeS,lakeN)*8.*.075*uW3Wave*mix(.4,1.,smoothstep(0.,.6,shoreN));
    /* the bed through the surface: bent by the waves; deep water darker and bluer; a net of light on the shallows */
    vec2 ruv=uv+slope*26./PX*smoothstep(0.,.5,shoreN);
    col=mix(col,texture2D(tPlate,ruv).rgb,clamp(W3,0.,1.)*smoothstep(.3,.7,texture2D(tWater,ruv).r));
    col*=mix(vec3(1.),vec3(.66,.82,.90),clamp(uW3Deep*W3*smoothstep(.1,1.,sh2)*.85,0.,1.));
    float net=smoothstep(.56,.8,texture2D(tWaves,wp*6.1+slope*2.+vec2(uTime*.018,uTime*.011)).b);
    col+=vec3(.85,1.,.86)*net*.10*W3*smoothstep(.04,.2,shoreN)*(1.-smoothstep(.1,.6,sh2));
    #endif
    /* the pale braided bed of a river reads as shallow water */
    col=mix(col,col*vec3(.74,.95,.93),uWet*W*riv*smoothstep(.3,.62,L));
    /* the body of the flow, both ways; a river's own light; then the light streaks: jade, silver on the crests */
    col*=1.+(broad-.40)*.26*amtB*uStreak*mix(1.,.38,smoothstep(.2,.55,L));
    col+=jade*riv*mid*pres*(.016+.06*broad)*W*uStreak;
    col+=mix(jade,silver,fine)*fine*.20*amtF*uStreak*mix(1.,.6,smoothstep(.3,.6,L));
    /* the lake: a slow spiral toward the middle */
    float sw=sin(ang*3.-log(rr+.25)*4.2-uTime*.07+nz*2.);
    col*=1.+sw*.05*lak*uSwirl*W*smoothstep(.15,.6,rr)*(1.-smoothstep(1.8,3.4,rr))*keep;
    /* sparkle where the plate's water is bright; foam where a river enters; a breath of light at the shore */
    float shade=0.;
    #ifdef FOREST_AIR
    shade=forestAirShadow(vForestWorld.xz);
    #endif
    float spk=smoothstep(.26,.7,spark);
    col+=silver*spk*smoothstep(.13,.36,L)*.34*wm*smoothstep(.15,.6,shoreN)*uGlint*W*(1.-shade);
    float mouth=4.*lakeN*(1.-lakeN)*wm;
    float foam=smoothstep(.34,.8,fineS*1.5+broad*.55)*mouth;
    col=mix(col,vec3(.80,.90,.86),foam*.24*uFoam*W);
    col+=silver*wm*(1.-smoothstep(.03,.22,shoreN))*smoothstep(.45,.8,broad)*.035*W;
    /* a soft sheen that answers the lens: the sun's mirror on the water only */
    vec3 Hh=normalize(normalize(cameraPosition-vForestWorld)+uSun);
    col+=silver*pow(max(Hh.y,0.),26.)*uSheen*wm*W*(1.-shade);
    #ifdef FOREST_WATER3D
    vec3 N3=normalize(vec3(-slope.x,1.,-slope.y));
    vec3 V3=normalize(cameraPosition-vForestWorld);
    vec3 R3=reflect(-V3,N3);
    float fres=(.10+.90*pow(1.-clamp(dot(N3,V3),0.,1.),1.5))*uW3Refl;      /* an artist's Fresnel: readable from above, strong from a low lens */
    vec3 sky3=mix(vec3(.60,.74,.84),vec3(.20,.40,.66),smoothstep(.25,1.,R3.y));
    /* the banks in the mirror: the mirrored ray climbs over the land's height (four looks along it) */
    vec2 rd=R3.xz/max(R3.y,.25);
    vec2 q1=wp+rd*.05,q2=wp+rd*.12,q3=wp+rd*.25,q4=wp+rd*.46;
    float k1=smoothstep(-.015,.02,forestTop(q1)-.05),k2=smoothstep(-.02,.03,forestTop(q2)-.12),k3=smoothstep(-.03,.04,forestTop(q3)-.25),k4=smoothstep(-.04,.05,forestTop(q4)-.46);
    float hit3=max(max(k1,k2),max(k3,k4));
    vec2 qh=mix(mix(mix(q4,q3,step(.5,k3)),q2,step(.5,k2)),q1,step(.5,k1));
    vec3 bank3=texture2D(tPlate,(qh-uBounds.xy)*uBounds.zw).rgb*.58;
    float in3=W3*smoothstep(.02,.22,shoreN);
    col=mix(col,mix(sky3,bank3,hit3),clamp(fres,0.,.85)*in3);
    /* small steep facets catch the sun: sparse, calm sparkles */
    vec2 mS=slope+((texture2D(tWaves,r1*wp*12.+vec2(.5,-.8)*uTime*.10).rg-.5)*r1+(texture2D(tWaves,wp*17.-vec2(.9,.3)*uTime*.12).rg-.5))*8.*.11*gust;
    vec3 Nm=normalize(vec3(-mS.x,1.,-mS.y));
    col+=vec3(1.,.97,.9)*pow(max(dot(reflect(-V3,Nm),uSun),0.),90.)*1.1*uGlint*in3*(1.-shade)*(1.-hit3*.8);
    /* the water laps on the shore */
    float lap=smoothstep(0.,.05,shoreN)*(1.-smoothstep(.05,.2,shoreN+(texture2D(tWaves,wp*6.+vec2(uTime*.02,0.)).b-.5)*.14));
    col=mix(col,vec3(.84,.91,.89),lap*.15*uFoam*W3);
    #endif
    #ifdef FOREST_RIVER
    {
      float RW=uRv*W*smoothstep(.2,.7,wm);
      vec2 wq=vForestWorld.xz;
      float fs=length(F); vec2 fw=fs>1e-3?F/fs:vec2(0.);
      float spd=clamp(fs*1.6+.3,.3,1.)*(1.-lakeN);
      /* the rivers: the wave pattern carried down the flow (two phases half a cycle apart, cross-faded) */
      float ph0=uTime*uRvSpeed*.42;
      float a1=fract(ph0),a2=fract(ph0+.5),b1=1.-abs(2.*a1-1.),b2=1.-b1;
      float Lc=.26*spd;
      vec2 o1=fw*(a1-.5)*Lc,o2=fw*(a2-.5)*Lc;
      vec2 n1=texture2D(tWaves,(wq-o1)*7.3).rg-.5,n2=texture2D(tWaves,(wq-o2)*7.3+.41).rg-.5;
      vec2 m1=texture2D(tWaves,(wq-o1*1.7)*16.2+.2).rg-.5,m2=texture2D(tWaves,(wq-o2*1.7)*16.2+.63).rg-.5;
      float bn=inversesqrt(b1*b1+b2*b2);
      vec2 f1=texture2D(tWaves,(wq-o1*2.6)*37.+.13).rg-.5,f2=texture2D(tWaves,(wq-o2*2.6)*37.+.71).rg-.5;
      vec2 g1=texture2D(tWaves,(wq-o1*3.4)*71.+.37).rg-.5,g2=texture2D(tWaves,(wq-o2*3.4)*71.+.91).rg-.5;
      vec2 flowS=((n1*b1+n2*b2)+(m1*b1+m2*b2)*.65+(f1*b1+f2*b2)*.55*uRvFine+(g1*b1+g2*b2)*.38*uRvFine)*bn;
      /* the lake: wind waves in two directions, drifting */
      mat2 rr1=mat2(.8,-.6,.6,.8);
      vec2 l1=texture2D(tWaves,wq*4.1+vec2(.86,.5)*uTime*.05*uRvSpeed).rg-.5;
      vec2 l2=(texture2D(tWaves,rr1*wq*9.7+vec2(-.4,.9)*uTime*.08*uRvSpeed).rg-.5)*rr1;
      vec2 l3=texture2D(tWaves,wq*21.+vec2(.3,-.7)*uTime*.12*uRvSpeed).rg-.5;
      vec2 l4=(texture2D(tWaves,rr1*wq*47.+vec2(-.6,.4)*uTime*.2*uRvSpeed).rg-.5)*rr1*uRvFine, l5=(texture2D(tWaves,wq*83.+vec2(.5,.5)*uTime*.26*uRvSpeed).rg-.5)*uRvFine;
      vec2 sl=mix(flowS*(.75+.6*spd),l1*.8+l2*.7+l3*.45+l4*.38+l5*.26,lakeN)*8.*.085*uRvWave*mix(.45,1.,smoothstep(0.,.5,shoreN));
      #ifdef FOREST_LOGO
      if(uLogoD.w>.5&&uLogoD.x>.001){
        vec2 rd=wq-uLogoC.xy; float rr=length(rd)/uLogoC.z;
        float ring=.7*sin(rr*52.-uTime*2.2)*exp(-rr*2.8)*smoothstep(.12,.24,rr)+.35*sin(rr*96.-uTime*3.5)*exp(-rr*5.5)*smoothstep(.10,.18,rr);
        sl+=rd/max(length(rd),1e-4)*ring*.085*uLogoG.z*uLogoD.x*smoothstep(.35,.85,lakeN);
      }
      #endif
      /* THE LAKE VIDEO (F1, 2026-11-16; client: 「這中間的湖泊你可以幫我影片 logo.mp4 融合進去嗎?」): the video is a pale water surface on which the
         mark is drawn by a wake. Only its RELIEF is taken — luminance minus its local mean (a coarse mip level) — so the wake's ridges and troughs
         appear in this navy lake: they tilt the water's normal (the mirror and the sun follow them) and lighten / darken the body a little. Read
         through the lake's own waves (bent like everything seen in water), faded out in a soft circle inside the lake. Four samples. */
      float lvHP=0.;
      #ifdef FOREST_LAKEVIDEO
      if(uLakeVid.w>.001){
        vec2 lv=(wq-uLakeVid.xy)/uLakeVid.z; float vc=cos(uLakeVid2.x),vs=sin(uLakeVid2.x); lv=mat2(vc,vs,-vs,vc)*lv;
        float lvM=uLakeVid.w*(1.-smoothstep(.30,.50,length(lv)))*smoothstep(.35,.85,lakeN);
        if(lvM>.001){
          vec2 vuv=vec2(.5+lv.x/uLakeVid2.y,.5-lv.y)+sl*.02;
          vec3 LW=vec3(.299,.587,.114);
          float L0=dot(texture2D(tLakeVid,vuv).rgb,LW);
          float Lx=dot(texture2D(tLakeVid,vuv+vec2(1.5/640.,0.)).rgb,LW), Ly=dot(texture2D(tLakeVid,vuv+vec2(0.,1.5/360.)).rgb,LW);
          float Lm=dot(texture2D(tLakeVid,vuv,5.).rgb,LW);
          lvHP=clamp(L0-Lm,-.35,.35)*lvM;
          vec2 gl=vec2(Lx-L0,-(Ly-L0));                                   /* the relief's slope, in the video's frame (y = south) */
          sl+=mat2(vc,-vs,vs,vc)*gl*14.*uLakeVid2.z*lvM;                  /* back to the world's frame */
        }
      }
      #endif
      vec3 Nw=normalize(vec3(-sl.x,1.,-sl.y)), Vw=normalize(cameraPosition-vForestWorld);
      float ndv=clamp(dot(Nw,Vw),0.,1.);
      /* the body: the picture's water as the shallow bed (bent by the waves), deep blue away from the shore */
      float depth=1.-(1.-clamp(smoothstep(.04,1.,sh2)*(lakeN*.95+.6*(1.-lakeN)),0.,1.))*uRvBed;   /* uRvBed: how much of the bed shows near the shores */
      vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;
      vec3 body=mix(bed*vec3(.80,.95,1.),uRvDeep,depth*mix(.88,1.,1.-uRvBed));
      /* the banks: a lighter teal band in the shallows, the channel deeper in the middle (client 01:25: 「河不夠精緻」) */
      float bank=1.-smoothstep(.0,mix(.42,.8,uRvLook.x),shoreN), chan=smoothstep(.45,1.,sh2)*(1.-lakeN*.6);
      body=mix(body,uRvDeep*vec3(1.35,1.75,1.7)+vec3(.012,.03,.03),bank*.55*uRvFine/1.2*(1.-uRvLook.x));
      /* D2: clear turquoise shallows — the water over the shelf takes the shallow colour, lit from below by the bed (sand and stone show
         through), a soft gradient into the deep teal of the middle; no extra texture read (the bed is the sample above) */
      float shal=pow(bank*bank*(3.-2.*bank),1.35)*mix(.62,1.,lakeN);      /* a gradient, not an outline; the rivers keep a deeper middle */
      vec3 shallowC=uRvShallow*(.78+.5*clamp(dot(bed,vec3(.30,.59,.11))*2.4,0.,1.2));
      shallowC=mix(shallowC,shallowC*vec3(1.18,1.08,.86)+vec3(.02,.016,.006),smoothstep(.55,1.,bank)*.45);   /* the last metre over sand, warmer */
      body=mix(body,shallowC,shal*uRvLook.x*.74);
      body*=1.-chan*.22;
      #ifdef FOREST_LAKEVIDEO
      body*=1.+lvHP*uLakeVid2.w; body+=max(lvHP,0.)*vec3(.30,.46,.60)*uLakeVid2.w*.5;   /* the wake's crests lighter, its troughs darker */
      #endif
      /* THE MARK IN THE LAKE (2026-11-16): the brand mark lies in the lake's bed and is seen through the water — the ring a deep trench, the
         blade a pale shallow in the brand's blue, a soft lift of the bed around them; bent by the same waves (it wobbles as water does), half
         covered by the reflection; only where the lake is; it surfaces as the spreading finishes (uLogoD.x) */
      float logoK=0.;
      #ifdef FOREST_LOGO
      if(uLogoD.x>.001){
        vec2 lq=(wq-uLogoC.xy)/uLogoC.z; float lc=cos(uLogoC.w),ls=sin(uLogoC.w); lq=mat2(lc,ls,-ls,lc)*lq;
        vec2 luv=lq+.5+sl*uLogoD.y*.06;
        float lakeOn=uLogoD.x*smoothstep(.35,.85,lakeN);
        if(uLogoD.w>.5){
          /* FLOAT (?lakeLogo=float, flow2-lake-float.js): the glass mark stands upright in the lake. Its reflection: a point of the mark at height h
             is seen in the water h / tan(e) in front of its foot (e = the lens's elevation seen from the foot), left and right as it is; broken by
             the waves and the rings. uLogoF = (the mark's right on the ground, tan e), uLogoG = (centre over the water, box, rings, reflection) */
          vec2 rd=wq-uLogoC.xy; vec2 rgt=uLogoF.xy, toCam=vec2(-rgt.y,rgt.x);
          float across=dot(rd,rgt), along=dot(rd,toCam)*sign(dot(cameraPosition.xz-uLogoC.xy,toCam));
          float hgt=along*uLogoF.z;                                   /* the height it mirrors */
          vec2 ruv=vec2(.5+across/uLogoG.y,.5-(hgt-uLogoG.x)/uLogoG.y)+sl*uLogoD.y*.2;
          if(along>0.&&ruv.x>0.&&ruv.y>0.&&ruv.x<1.&&ruv.y<1.){
            /* smeared toward the lens as a reflection on moving water is */
            vec3 rm=(texture2D(tLogo,ruv,1.6).rgb+texture2D(tLogo,ruv+vec2(0.,.035),2.).rgb*.8+texture2D(tLogo,ruv+vec2(0.,.075),2.4).rgb*.6)/2.4;
            float fade=lakeOn*uLogoG.w*(1.-smoothstep(.0,1.,hgt/(uLogoG.x*2.+1e-3))*.7)*(.75+.5*clamp(sl.y*6.+.5,0.,1.));
            body=mix(body,vec3(.66,.77,.86),rm.r*fade*.38); body=mix(body,uLogoBlade*1.1,rm.g*fade*.48);
            logoK=max(rm.r,rm.g)*fade*.6;
          }
        } else
        if(luv.x>0.&&luv.y>0.&&luv.x<1.&&luv.y<1.){
          vec3 lm=texture2D(tLogo,luv).rgb; float on=lakeOn;
          /* client 2026-11-16: 「藏水裡沒東西啊?? 只要單色影子就好」 — one dark shadow of the whole mark in the water, no shelf, no blue */
          float sil=max(lm.r,lm.g);
          body=mix(body,uLogoRing,sil*on*.86);
          logoK=sil*on;
        }
      }
      #endif
      /* the mirror: the 3D banks and trees, else the sky */
      vec3 Rw=reflect(-Vw,Nw);
      vec3 skyw=mix(uRvSky,uRvSky*vec3(.55,.70,.95),smoothstep(.15,1.,Rw.y));
      vec4 rf=vec4(0.);
      #ifdef FOREST_MIRROR
      vec4 rp=uReflMat*vec4(vForestWorld,1.); rf=texture2D(tRefl,rp.xy/rp.w+sl*.05);
      #endif
      vec3 mir=mix(skyw,rf.rgb*.9,clamp(rf.a,0.,1.));
      float fr=clamp((mix(.08,.24,uRvBed)+.76*pow(1.-ndv,3.))*uRvRefl+.32*rf.a*uRvRefl,0.,.94);
      #ifdef FOREST_LOGO
      fr*=1.-min(logoK,1.)*uLogoD.z;
      #endif
      vec3 wc=mix(body,mir,fr);
      #ifdef FOREST_LAKEVIDEO
      wc+=max(lvHP,0.)*vec3(.55,.68,.80)*uLakeVid2.w*.3;   /* F1: the wake's crests catch the light above the reflection too */
      #endif
      /* the sun on the waves: fine glints and a soft sheen */
      vec3 Hs=normalize(Vw+uSun); float nh=max(dot(Nw,Hs),0.);
      wc+=vec3(1.,.96,.88)*(pow(nh,320.)*2.2+pow(nh,60.)*.12*uRvLook.w+pow(nh,20.)*.03*uRvLook.w)*uRvSun*(1.-shade)*(1.-rf.a*.6);   /* D2: uRvLook.w widens the soft sun path, not the glints (nothing twinkles more) */
      /* the current's lines along the rivers (the canyon's water shows them): thin pale threads carried down the flow */
      float th=texture2D(tWaves,vec2(dot(wq,vec2(-fw.y,fw.x))*58.,dot(wq,fw)*5.-ph0*1.6*spd)).b*b1+texture2D(tWaves,vec2(dot(wq,vec2(-fw.y,fw.x))*58.+.5,dot(wq,fw)*5.-(ph0+.5)*1.6*spd)).b*b2;
      wc+=vec3(.55,.70,.86)*smoothstep(.62,.86,th)*.16*spd*(1.-lakeN)*smoothstep(.1,.5,shoreN)*uRvFine;
      /* white water: a fast river breaks a little; a lap line on the shores */
      float riff=smoothstep(.58,.9,texture2D(tWaves,(wq-o1*1.3)*11.).b*b1+texture2D(tWaves,(wq-o2*1.3)*11.+.5).b*b2)*spd*smoothstep(.1,.5,shoreN);
      float lapL=smoothstep(0.,.05,shoreN)*(1.-smoothstep(.05,.18,shoreN+(texture2D(tWaves,wq*6.+vec2(uTime*.02,0.)).b-.5)*.12));
      lapL*=smoothstep(.35,.7,texture2D(tWaves,wq*29.+vec2(uTime*.05,-uTime*.03)).b);   /* broken into bits of foam */
      /* white water: a river running fast in a narrow bed breaks into small streaks of foam carried down */
      float narrow=(1.-lakeN)*smoothstep(.55,.95,spd)*(1.-smoothstep(.3,.8,sh2));
      float wwt=texture2D(tWaves,vec2(dot(wq,vec2(-fw.y,fw.x))*90.,dot(wq,fw)*14.-ph0*2.2*spd)).b;
      riff=max(riff,smoothstep(.62,.9,wwt)*narrow);
      wc=mix(wc,vec3(.86,.92,.94),clamp(riff*.32*uRvLook.z+lapL*.09,0.,1.)*uRvFoam);   /* D2: uRvLook.z = white rapids where a river runs fast (1 = before) */
      col=mix(col,wc,RW);
    }
    #endif
    #endif

    /* the bare state of the same picture: grey-blue stone, a dark dry bed; then light at the water's head and young green at the growth's edge */
    #ifdef FOREST_GROW
    float lum0=dot(plate0,vec3(.2126,.7152,.0722));
    /* lead 2026-11-16 (client: 「蔓延沒感覺啊」): before the life arrives the land is dark ash and the beds are dry; the front is a soft band of
       glowing young green that runs out from the lake, and the water's head is bright */
    vec3 bare=mix((lum0*.30+.012)*vec3(.66,.62,.58),(lum0*.14+.006)*vec3(.50,.48,.46),wm);
    col=mix(bare,col,mix(grown,wet,wm));
    float fg=uGrow*1.2-${GROWN}+edgeN*.09;
    float band=exp(-pow((fg-.035)/.045,2.))*step(uGrow,.998);
    float wband=exp(-pow((uGrow*3.-gw.r+edgeN*.03-.02)/.03,2.))*step(uGrow,.998);
    col+=vec3(.62,.95,.22)*(1.-wm)*band*uGrowGlow+vec3(.75,.98,1.)*wm*wband*.5;
    #endif

    /* 3 · air (D2's clouds' shadow) or, without it, GPT's shadow noise */
    #ifdef FOREST_AIR
    col=forestAir(col,vForestWorld.xz);
    #else
    float cshadow=smoothstep(.48,.78,forestFbm(vForestWorld.xz*.34+vec2(uTime*.004,-uTime*.002)));
    col*=1.-cshadow*uCloud*.16;
    #endif

    col=forestHaze(col,vForestWorld);
    /* 4 · a gentle vignette */
    vec2 sc=(gl_FragCoord.xy-uView.xy)/uView.zw-.5;
    col*=1.-uVig*smoothstep(.5,1.9,dot(sc,sc)*4.);
    col=mix(col,uLatticeGround,clamp(uLattice,0.,1.));
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
  }`;

/* THE WHOLE MODEL'S TREES (lead, 2026-11-15; the client: 「用blender … 做出整個model 然後再進去網頁渲染，需要3D的素材部分拿 forest/」).
   Every crown of the picture is a tree (original/whole-trees.bin, 69,479; medium tier the first 25,000 = the forest's edges first), made from the
   client's asset atlas (original/whole-atlas.webp, from forest/a_forest_3_with_a_road_at_night_for_game, CC-BY 4.0 dasy444): broad crowns = layered
   cards of the atlas' crowns seen from above + a crossed side card; conifers = the asset's modelled pine (original/whole-trees.glb). Each fragment
   takes the picture's own colour at its place, the atlas gives the leaves, the card's height gives the shade inside the crown. ?foresttrees=m = M's
   5,000 low-poly trees, ?foresttrees=0 = none. */
const WTREE_VERT = `
  uniform sampler2D tCanopy,tGrow; uniform vec4 uBounds; uniform vec2 uYRange; uniform float uRelief,uGrow,uTree;
  varying vec3 vForestWorld,vTreeNormal; varying vec2 vTreeUv,vFootUv; varying float vTreeH; varying vec3 vTreeRnd;
  void main(){
    mat4 m=modelMatrix*instanceMatrix;
    /* each tree its own: a lean of a few degrees, its own light and warmth (lead 22:25: 「樹林的隨機性要大一點」) */
    float r1=fract(sin(float(gl_InstanceID)*12.9898+78.233)*43758.5453),r2=fract(r1*7.13+.31),r3=fract(r1*13.7+.77);
    vTreeRnd=vec3(r1,r2,r3);
    vec4 foot=m*vec4(0.,0.,0.,1.), w=m*vec4(position,1.);
    vec2 fuv=(foot.xz-uBounds.xy)*uBounds.zw;
    float grown=1.;
    #ifdef FOREST_GROW
    vec3 gw=texture2D(tGrow,fuv).rgb;
    grown=smoothstep(0.,.2,uGrow*1.2-${GROWN}-.03); grown=grown*(1.+.28*sin(3.14159*grown));
    #endif
    float ground=max(.105+(uYRange.x+texture2D(tCanopy,fuv).r*uYRange.y-.105)*uRelief,.105);
    vec3 off=w.xyz-foot.xyz; off.xz+=off.y*vec2(r1-.5,r2-.5)*.2;
    w.xyz=vec3(foot.x,ground-.004,foot.z)+off*grown*vec3(mix(1.,uTree,.4),uTree,mix(1.,uTree,.4));
    vForestWorld=w.xyz; vTreeUv=uv; vFootUv=fuv; vTreeH=position.y; vTreeNormal=normalize(mat3(m)*normal);
    gl_Position=projectionMatrix*viewMatrix*w;
  }`;
const WTREE_FRAG = `
  uniform sampler2D tPlate,tAtlas; uniform vec4 uBounds,uView; uniform vec3 uSun; uniform float uVig,uTreeTone,uLeaf;
  uniform float uLand; uniform vec4 uLandB;   /* D1 LAND: uLandB.z = how strongly the crowns take the sun (deeper shade inside, lit tops) */
  varying vec3 vForestWorld,vTreeNormal; varying vec2 vTreeUv,vFootUv; varying float vTreeH; varying vec3 vTreeRnd;
  ${HAZE}
  /*AIR*/
  void main(){
    vec4 tx=texture2D(tAtlas,vTreeUv);
    /* keep the crown whole when it is small on the screen (the atlas' mip levels thin the alpha) */
    vec2 dx=dFdx(vTreeUv*1024.),dy=dFdy(vTreeUv*1024.);
    float lod=.5*log2(max(max(dot(dx,dx),dot(dy,dy)),1.));
    if(tx.a*(1.+lod*.32)<.5)discard;
    vec3 n=normalize(vTreeNormal); if(!gl_FrontFacing)n=-n;
    /* a card seen from above shows the picture under it; a standing card takes the picture's colour of its own crown (no vertical streaks) */
    vec2 here=(vForestWorld.xz-uBounds.xy)*uBounds.zw;
    vec3 pl=texture2D(tPlate,mix(vFootUv,here,smoothstep(.5,.9,abs(n.y)))).rgb;
    float det=clamp(dot(tx.rgb,vec3(.2126,.7152,.0722))/.075,.3,1.9);
    float sun=.84+.30*clamp(dot(n,uSun),-1.,1.);
    float inside=mix(.52,1.,smoothstep(.12,.95,vTreeH));
    /* D1 LAND: crowns with real depth — the lit side brighter, the inside and the underside darker, so the forest reads as many crowns */
    float tl=uLand*uLandB.z;
    sun=mix(sun,.56+.74*clamp(dot(n,normalize(uSun)),0.,1.),tl);
    inside=mix(inside,mix(.30,1.08,smoothstep(.08,.98,vTreeH)),tl);
    vec3 col=pl*mix(1.,det,uLeaf)*sun*inside*uTreeTone*(.84+.32*vTreeRnd.z)*mix(vec3(1.06,1.03,.88),vec3(.92,1.,1.08),vTreeRnd.y);
    /* several greens (emerald, olive) and a few sunlit lime tops */
    col*=mix(vec3(1.),mix(vec3(.86,1.04,.92),vec3(1.06,1.02,.84),vTreeRnd.z),tl);
    col=mix(col,col*vec3(1.22,1.26,.78),tl*step(.86,vTreeRnd.x)*smoothstep(.55,.95,vTreeH)*clamp(dot(n,normalize(uSun))+.3,0.,1.));
    #ifdef FOREST_AIR
    col=forestAir(col,vForestWorld.xz);
    #endif
    col=forestHaze(col,vForestWorld);
    vec2 sc=(gl_FragCoord.xy-uView.xy)/uView.zw-.5;
    col*=1.-uVig*smoothstep(.5,1.9,dot(sc,sc)*4.);
    col=mix(col,uLatticeGround,clamp(uLattice,0.,1.));
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
  }`;
/* the client's moss-covered rocks (original/whole-rock.glb + .jpg) on the shores, gravel bars and bare rock; they belong to the bare land too */
const ROCK_VERT = `
  uniform sampler2D tCanopy; uniform vec4 uBounds; uniform vec2 uYRange; uniform float uRelief;
  varying vec3 vForestWorld,vRockNormal; varying vec2 vRockUv,vFootUv;
  void main(){
    mat4 m=modelMatrix*instanceMatrix;
    vec4 foot=m*vec4(0.,0.,0.,1.), w=m*vec4(position,1.);
    vec2 fuv=(foot.xz-uBounds.xy)*uBounds.zw;
    float ground=max(.105+(uYRange.x+texture2D(tCanopy,fuv).r*uYRange.y-.105)*uRelief,.105);
    w.y+=ground-foot.y-.006;
    vForestWorld=w.xyz; vRockUv=uv; vFootUv=fuv; vRockNormal=normalize(mat3(m)*normal);
    gl_Position=projectionMatrix*viewMatrix*w;
  }`;
const ROCK_FRAG = `
  uniform sampler2D tPlate,tRock; uniform vec4 uBounds,uView; uniform vec3 uSun; uniform float uVig,uRock;
  varying vec3 vForestWorld,vRockNormal; varying vec2 vRockUv,vFootUv;
  ${HAZE}
  /*AIR*/
  void main(){
    vec3 n=normalize(vRockNormal);
    vec3 tx=texture2D(tRock,vRockUv).rgb, pl=texture2D(tPlate,vFootUv).rgb;
    vec3 col=mix(tx,tx*pl/max(dot(pl,vec3(.33)),.05)*.33,.35)*(.55+.62*max(dot(n,uSun),0.))*uRock;
    #ifdef FOREST_AIR
    col=forestAir(col,vForestWorld.xz);
    #endif
    col=forestHaze(col,vForestWorld);
    vec2 sc=(gl_FragCoord.xy-uView.xy)/uView.zw-.5;
    col*=1.-uVig*smoothstep(.5,1.9,dot(sc,sc)*4.);
    col=mix(col,uLatticeGround,clamp(uLattice,0.,1.));
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
  }`;

/* a broad crown from the atlas: three crowns-from-above at rising heights, a crossed card of a crown from the side under them. Unit size:
   x, z in -0.5 … 0.5 (scaled by the crown width), y 0 … 1 (scaled by the height). UVs in the atlas, top-left origin (flipY = false). */
function broadCrown(top, side) {
  const P = [], N = [], U = [], I = [];
  const r = ([x0, y0, x1, y1]) => [x0 / 2048, y0 / 2048, x1 / 2048, y1 / 2048];
  const T = r(top), S = r(side);
  const quad = (a, b, c, d, n, uv) => { const k = P.length / 3; P.push(...a, ...b, ...c, ...d); N.push(...n, ...n, ...n, ...n); U.push(...uv); I.push(k, k + 1, k + 2, k, k + 2, k + 3); };
  [[.56, 1.0, 0], [.76, .84, 1.15], [.93, .6, 2.4]].forEach(([y, s, a]) => {
    const c = Math.cos(a) * s / 2, sn = Math.sin(a) * s / 2;
    quad([-c + sn, y, -sn - c], [c + sn, y, sn - c], [c - sn, y, sn + c], [-c - sn, y, -sn + c], [0, 1, 0], [T[0], T[1], T[2], T[1], T[2], T[3], T[0], T[3]]);
  });
  [0, Math.PI / 2].forEach(a => {
    const c = Math.cos(a) * .5, sn = Math.sin(a) * .5;
    quad([-c, 0, -sn], [c, 0, sn], [c, .98, sn], [-c, .98, -sn], [-sn * 2, 0, c * 2], [S[0], S[1], S[2], S[1], S[2], S[3], S[0], S[3]]);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  return g;
}

/* M's real trees (forest-trees.glb: six low-poly shapes, foot at the origin, height 1; forest-trees.json: 5,000 instances, most important first).
   They stand on this file's ground, grow with the spreading, carry the colour their crown has in the plate (and the plate itself on their
   tops, so they melt into it), M's grey shade for volume, a little of the plate's sun, D2's cloud shadow. They cast nothing. */
const TREE_VERT = `
  attribute vec4 color; attribute vec3 aTint;
  uniform sampler2D tCanopy,tGrow; uniform vec4 uBounds; uniform vec2 uYRange; uniform float uRelief,uGrow,uTree;
  varying vec3 vForestWorld,vTreeTint,vTreeNormal; varying float vTreeShade;
  void main(){
    mat4 m=modelMatrix*instanceMatrix;
    vec4 foot=m*vec4(0.,0.,0.,1.), w=m*vec4(position,1.);
    vec2 uv=(foot.xz-uBounds.xy)*uBounds.zw;
    float grown=1.;
    #ifdef FOREST_GROW
    vec3 gw=texture2D(tGrow,uv).rgb;
    grown=smoothstep(0.,.2,uGrow*1.2-${GROWN}-.03);
    #endif
    float ground=max(.105+(uYRange.x+texture2D(tCanopy,uv).r*uYRange.y-.105)*uRelief,.105);
    w.xyz=vec3(foot.x,ground,foot.z)+(w.xyz-foot.xyz)*grown*vec3(mix(1.,uTree,.5),uTree,mix(1.,uTree,.5));
    vForestWorld=w.xyz; vTreeTint=aTint; vTreeShade=color.r; vTreeNormal=normalize(mat3(m)*normal);
    gl_Position=projectionMatrix*viewMatrix*w;
  }`;
const TREE_FRAG = `
  uniform sampler2D tPlate; uniform vec4 uBounds,uView; uniform vec3 uSun; uniform float uVig,uTreeTone;
  varying vec3 vForestWorld,vTreeTint,vTreeNormal; varying float vTreeShade;
  ${HAZE}
  /*AIR*/
  void main(){
    vec3 n=normalize(vTreeNormal);
    vec3 col=vTreeTint*uTreeTone*mix(.62,1.,vTreeShade)*(.88+.30*dot(n,uSun));
    vec3 pl=texture2D(tPlate,(vForestWorld.xz-uBounds.xy)*uBounds.zw).rgb;
    col=mix(col,pl,smoothstep(.4,.9,n.y)*.6*step(pl.b*1.1,pl.g));
    #ifdef FOREST_AIR
    col=forestAir(col,vForestWorld.xz);
    #endif
    col=forestHaze(col,vForestWorld);
    vec2 sc=(gl_FragCoord.xy-uView.xy)/uView.zw-.5;
    col*=1.-uVig*smoothstep(.5,1.9,dot(sc,sc)*4.);
    col=mix(col,uLatticeGround,clamp(uLattice,0.,1.));
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
  }`;

export async function createForestScene(renderer, reducedMotion) {
  const Q = new URLSearchParams(location.search);
  const tier = window.__FLOW2_QUALITY__?.start || 'high';
  /* E2 QUALITY (2026-11-16, client: 「降畫質也不要這張圖」): the low tier no longer means the old flat photo plate. Every tier draws the same
     canyon-style bake on the relief grid with the three.js water; a lower tier only drops costly extras: low = the 4K bake, a lighter grid
     (360 × 200), no 3D trees (the bake carries its forest), no mirror; medium = the 4K bake, 500 × 280, the forest's edges as 3D trees.
     ?forestfine=0 still shows the old picture on purpose (comparison only). */
  const lowTier = tier === 'low';
  const fine = Q.get('forestfine') !== '0';
  const big = fine && tier === 'high' && Q.get('forestplate') !== '1' && renderer.capabilities.maxTextureSize >= 4096;
  const waterOn = fine && Q.get('forestwater') !== '0';
  const relief = fine && Q.get('forestrelief') !== '0', lightOn = relief && Q.get('forestlight') !== '0';
  const wholeTrees = relief && !lowTier && !/^(0|m)$/.test(Q.get('foresttrees') || '');
  const treeCount = !relief || wholeTrees || lowTier || Q.get('foresttrees') === '0' ? 0 : tier === 'high' ? 5000 : 2500;
  const water3d = relief && Q.get('water3d') !== '0';
  let bakeOn = fine && Q.get('forestbake') !== '0';
  const bakeFile = tier === 'high' && renderer.capabilities.maxTextureSize >= 8192 && Q.get('forestbake') !== '4k' ? 'whole-bake-8k.webp' : 'whole-bake-4k.webp';
  const river3 = water3d && Q.get('river3') !== '0';                                           /* lead: three.js water (see FOREST_RIVER) */
  const mirrorOn = river3 && Q.get('forestmirror') !== '0' && tier !== 'low';                 /* planar reflection of the 3D banks */      /* lead (2026-11-15): the water as a surface; ?water3d=0 = pass 1's painted water */
  const growOn = fine && !reducedMotion && Q.get('forestgrow') !== '0';
  const AIR = (a => a && typeof a.glsl === 'string' && a.uniforms ? a : null)(window.__FLOW2_FOREST_AIR__);
  const asset = name => new URL('./original/' + name + '?v=' + VERSION, import.meta.url).href;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#182b1c');
  const camera = new THREE.PerspectiveCamera(16, 1862 / 909, 1, 120);
  const DEG = Math.PI / 180, clamp = THREE.MathUtils.clamp;
  /* E2 STILL (2026-11-16, client: 「到山谷可以進場動畫一下就好就不要隨便動了」): the view enters once (the lens's rise with the scroll, the spreading)
     and then holds its composed pose: the idle glide is 0 (the dial stays in the panel). Scroll, drag and the four steps still move it.
     ?motion=old = the never-still glide of before. */
  const motionOld = Q.get('motion') === 'old';
  const tune = { water: 1, river: 1, streak: 1, swirl: 1, glint: 1, foam: 1, wet: .3, detail: big ? .32 : 1, vignette: .13, speed: 1,
    lens: 16, glide: motionOld ? 1 : 0, swoop: motionOld ? 1 : 0, arrive: 1, orbit: 1, focus: 1, follow: 4.5,
    canopy: 1.1, relief: 1.1, light: .3, sheen: .22, trees: 1.15, treeTone: 1.3, growTime: 8, growHold: NaN,
    /* D1 LAND (2026-11-16): the land of the target picture — canopy crowns, clearings, terraces and moss, relief light, crown depth (?land=old = 0) */
    land: Q.get('land') === 'old' ? 0 : 1, crowns: Q.get('crowns') === '1' ? 1 : 0 /* client 2026-11-16: 「這種圓形的很醜」 — the painted round crowns are off (?crowns=1 = on) */, crownSize: 1, clearings: 1, strata: 1, moss: 1, reliefShade: 1, treeLight: 1,
    w3: 1, w3wave: 1, w3refl: .85, w3deep: 1, haze: .6, leaf: .55, rock: 1,
    rv: 1, rvSpeed: 1, rvWave: 1, rvRefl: 1, rvSun: 1, rvFoam: 1, rvDeep: '#244c66', rvSky: '#b4c8d6', rvBed: 1, growGlow: .3, rvFine: 1,
    /* 視角 (2026-11-16, client: 「參數裡面可以幫我加入視角調整」): added to the lens's own motion; 0 / 1 = the confirmed composition */
    viewTilt: window.__FLOW2_LAKE_MARK__?.mode === 'float' ? +window.__FLOW2_LAKE_MARK__.viewTilt || 0 : 0, viewTurn: 0, viewSide: 0, viewZoom: 1, viewX: 0, viewZ: 0,
    /* the brand mark in the lake (2026-11-16, client: 「中間放著LOGO 藏在水裡的感覺」): a deep trench (the ring) and a pale shallow (the blade) in the
       lake's bed, seen through the moving water; it surfaces as the spreading finishes */
    logo: 1, logoSize: 1.15, logoTurn: 0, logoX: 0, logoZ: 0, logoWave: .55, logoClear: .7, logoRing: '#050f1c', logoBlade: '#56b6e6',
    /* the lake video (F1, 2026-11-16): strength, size (× the lake), turn, place, the wake's relief and light; lakeVidReplay: move it to replay */
    lakeVid: 1, lakeVidSize: 1, lakeVidTurn: 0, lakeVidX: 0, lakeVidZ: 0, lakeVidRelief: 1.4, lakeVidShade: 3.5, lakeVidReplay: 0 };
  if (bakeOn) { tune.detail = 0; tune.light = 0; Object.assign(tune, { rvDeep: '#1a3553', rvSky: '#4f6f92', rvRefl: .75, rvBed: .18, rvFoam: .9, rvWave: 1.25, growTime: 5.5, rvSpeed: 2.3, rvFine: 1.2 }); }   /* the canyon's navy water; a quicker, readable spreading */      /* the bake carries its own fine detail and light */
  /* D2 (2026-11-16, client's target picture: 「照我給你的圖你在繼續修細」): a clear turquoise lake — deep teal in the middle, light transparent
     shallows over the bed, a sunlit path — and white rapids where the rivers run fast. ?waterlook=old keeps the navy water of before. */
  Object.assign(tune, { rvShallow: '#3a9f9c', rvClear: 0, rvRapids: 1, rvSparkle: 1 });
  if (bakeOn && Q.get('waterlook') !== 'old') Object.assign(tune, { rvDeep: '#09415a', rvSky: '#78b2bf', rvRefl: .45, rvBed: .42, rvFoam: 1.15, rvClear: .82, rvRapids: 2.4, rvSparkle: 1.15 });
  if (wholeTrees) { tune.canopy = bakeOn ? 0 : .2; tune.trees = 1; tune.treeTone = 1.05; }
  else if (bakeOn) tune.canopy = 0;   /* E2 QUALITY: without 3D trees the bake's painted forest is the forest (no lifted crown bumps under it) */
  /* 整體顏色: the view's grade lives in flow2-forest-atlas.js (panel 「俯視色調」, key K); the same object is shown here as well */
  if (window.__FLOW2_FOREST_GRADE__) tune.grade = window.__FLOW2_FOREST_GRADE__;
  const logoOn = river3 && Q.get('forestlogo') !== '0';
  /* F1 (2026-11-16, client: 「藏在水裡的LOGO就拿掉」 + the lake video): the mark's shadow in the water only with ?lakeLogo=shadow; the lake shows
     media/logo.mp4 instead (not in the floating-mark version, not with ?lakeVideo=0) */
  const shadowMode = Q.get('lakeLogo') === 'shadow';
  const videoOn = river3 && Q.get('lakeVideo') === '1' && /* client 2026-11-16: 「湖心的影片拿掉好了」 — off; ?lakeVideo=1 brings it back */ !shadowMode && Q.get('lakeLogo') !== 'float' && window.__FLOW2_LAKE_MARK__?.mode !== 'float';
  /* the client's dials: panel 「森林水流」 (key O) of the page's shared panel; the values live in this object and are read every frame */
  if (fine) window.__FLOW2_PANEL__?.add({ id: 'forestwater', title: '森林水流', key: 'o', tune, rows: [
    ['— 視角 —'], ['俯角（負＝更從正上方，正＝更斜）', 'viewTilt', -8, 36, .5], ['方向旋轉（度）', 'viewTurn', -180, 180, 1], ['左右傾斜（度）', 'viewSide', -20, 20, .5],
    ['遠近（小＝近；太遠時自動限制，不露出邊界）', 'viewZoom', .4, 1.6, .01], ['畫面中心 東西', 'viewX', -3, 3, .01], ['畫面中心 南北', 'viewZ', -2, 2, .01],
    ...(tune.grade ? [['— 整體顏色（與「俯視色調」同一組）—'], ['亮度', 'grade.bright', .7, 1.4, .01], ['對比', 'grade.contrast', .6, 1.6, .01], ['飽和度', 'grade.sat', .5, 1.4, .01],
      ['冷暖（負＝冷）', 'grade.temp', -1, .6, .01], ['色相（度）', 'grade.hue', -25, 15, .5], ['黃綠收斂', 'grade.yellow', 0, 1, .01], ['暗部帶藍', 'grade.lift', 0, .25, .005], ['暗部顏色', 'grade.liftColor', 'color'],
      ['畫面下方壓暗', 'grade.shade', 0, 1, .01], ['色調統一（0＝原圖）', 'grade.on', 0, 1, .01]] : []),
    ...(logoOn && window.__FLOW2_LAKE_MARK__?.mode === 'float' && (tune.float = window.__FLOW2_LAKE_MARK__.tune) ? [['— 湖上直立 LOGO —'], ['大小', 'float.size', .6, 4, .01], ['泡進水裡的深度', 'float.sink', 0, .4, .005], ['上下浮動', 'float.bob', 0, .12, .005],
      ['往後仰（面向鏡頭）', 'float.lean', 0, 1, .01], ['輕微搖擺', 'float.sway', 0, 3, .01], ['升起時旋轉圈數', 'float.spin', 0, 3, .05], ['玻璃受光', 'float.glow', 0, 3, .01], ['漣漪', 'float.ripple', 0, 3, .01], ['倒影', 'float.reflect', 0, 2, .01]] : []),
    ...(videoOn ? [['— 湖心影片 —'], ['影片強度', 'lakeVid', 0, 2, .01], ['大小', 'lakeVidSize', .4, 2, .01], ['旋轉（度）', 'lakeVidTurn', -180, 180, 1],
      ['位置 東西', 'lakeVidX', -1.5, 1.5, .01], ['位置 南北', 'lakeVidZ', -1.2, 1.2, .01], ['波紋立體感（倒影、反光跟著動）', 'lakeVidRelief', 0, 4, .01],
      ['波紋明暗', 'lakeVidShade', 0, 8, .01], ['重播（拖一下）', 'lakeVidReplay', 0, 1, 1]] : []),
    ...(logoOn && shadowMode ? [['— 湖中 LOGO —'], ['LOGO 顯現程度', 'logo', 0, 1.5, .01], ['大小', 'logoSize', .4, 1.8, .01], ['旋轉（度）', 'logoTurn', -180, 180, 1],
      ['位置 東西', 'logoX', -1.5, 1.5, .01], ['位置 南北', 'logoZ', -1.2, 1.2, .01], ['隨波晃動', 'logoWave', 0, 2, .01], ['水面倒影讓開（越大越清楚）', 'logoClear', 0, 1, .01],
      ['影子顏色', 'logoRing', 'color']] : []),
    ['四條河的存在感', 'river', 0, 2.5, .01], ['流紋（亮線）', 'streak', 0, 2.5, .01], ['水的效果（總量）', 'water', 0, 2, .01],
    ['湖面旋流', 'swirl', 0, 3, .01], ['閃光', 'glint', 0, 3, .01], ['河口水沫', 'foam', 0, 3, .01], ['淺灘水色', 'wet', 0, 1, .01], ['流速', 'speed', 0, 3, .01],
    ['細節（樹冠、沙粒）', 'detail', 0, 2, .01], ['暗角', 'vignette', 0, .5, .01],
    ['— 鏡頭 —'], ['鏡頭視角（度；小＝平，大＝立體）', 'lens', 6, 30, .5], ['自動滑行', 'glide', 0, 2.5, .01], ['兩章之間的下沉與傾斜', 'swoop', 0, 1.6, .01],
    ['進場的上升', 'arrive', 0, 1.5, .01], ['拖曳時的轉動', 'orbit', 0, 2, .01], ['四步驟靠向河流', 'focus', 0, 2.5, .01], ['拖曳跟隨（越大越快）', 'follow', 1, 12, .1],
    ['— 地景細節（D1）—'], ['地景細節（總量，0＝原本）', 'land', 0, 1.5, .01], ['樹冠覆蓋', 'crowns', 0, 1.5, .01], ['樹冠大小', 'crownSize', .5, 2, .01], ['草地紋理', 'clearings', 0, 1.5, .01],
    ['岩層階梯', 'strata', 0, 2, .01], ['岩階苔蘚', 'moss', 0, 2, .01], ['地形受光', 'reliefShade', 0, 2, .01], ['立體樹明暗', 'treeLight', 0, 1.5, .01],
    ['— 立體與蔓延 —'], ['樹冠高度', 'canopy', 0, 3, .01], ['地形起伏', 'relief', .5, 2, .01], ['樹冠受光', 'light', 0, 1, .01], ['水面反光', 'sheen', 0, 1, .01], ['立體樹的高度', 'trees', 0, 2.5, .01], ['立體樹的明暗', 'treeTone', .5, 2.2, .01],
    ['蔓延時間（秒）', 'growTime', 2, 20, .1], ['蔓延前緣的新綠亮度', 'growGlow', 0, .8, .01], ['預覽：蔓延停在', 'growHold', 0, 1, .01, 'off0'],
    ['— 3D 水面與空氣 —'], ['3D 水面（總量）', 'w3', 0, 1.5, .01], ['波浪起伏', 'w3wave', 0, 3, .01], ['倒影（天空、岸邊）', 'w3refl', 0, 2.5, .01], ['水的深淺', 'w3deep', 0, 2, .01], ['遠近空氣感', 'haze', 0, 2.5, .01], ['樹葉細節（素材紋理）', 'leaf', 0, 1, .01], ['岸邊岩石亮度', 'rock', 0, 2, .01],
    ['— three.js 河流與湖 —'], ['河流水面（總量）', 'rv', 0, 1, .01], ['流速', 'rvSpeed', 0, 3, .01], ['波浪', 'rvWave', 0, 3, .01], ['倒影', 'rvRefl', 0, 2, .01],
    ['陽光反光', 'rvSun', 0, 3, .01], ['白浪與岸邊', 'rvFoam', 0, 2.5, .01], ['深水顏色', 'rvDeep', 'color'], ['天空倒影顏色', 'rvSky', 'color'], ['岸邊透出河床', 'rvBed', 0, 1, .01], ['細波紋與水流線', 'rvFine', 0, 2.5, .01],
    ['淺灘水色（土耳其藍）', 'rvShallow', 'color'], ['淺灘清澈度（0＝原本的深藍）', 'rvClear', 0, 1, .01], ['急流白浪', 'rvRapids', 0, 4, .01], ['陽光反光路徑', 'rvSparkle', 0, 3, .01]
  ] });
  const state = { x: 0, z: 0, rawX: 0, rawZ: 0, age: 0, wall: 0, lastPan: -1e3, idle: 1, clock: 8.96, view: 6, active: -1,
    pose: { fore: 9.8, side: 0, distance: 22, rest: 22, safe: 0 } };
  const raycaster = new THREE.Raycaster(), uv = new THREE.Vector2(), view4 = new THREE.Vector4();
  const target = new THREE.Vector3(), dir = new THREE.Vector3(), corner = new THREE.Vector3(), UP = new THREE.Vector3(0, .3, -1).normalize(), YAXIS = new THREE.Vector3(0, 1, 0);
  const footprint = { width: 14, depth: 14 * PLATE[1] / PLATE[0] };
  const limit = { x0: -6.92, x1: 6.92, z0: -footprint.depth / 2 + .08, z1: footprint.depth / 2 - .08 };
  const centre = new THREE.Vector3(0, .105, 0), lean = [0, 0, 0, 0];
  let focusPoints = null;
  const hooks = new Set();
  let width = innerWidth, height = innerHeight;
  const clamp01 = v => Math.min(1, Math.max(0, v)), smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  /* THE LENS (pass 2). A real perspective lens that looks at a point on the water and stands off it by a tilt from the vertical:
     `fore` (the lens stands south of the point: 9.8 deg = the confirmed composition) and `side` (east / west). North stays up, so a
     change of tilt is pure parallax: hills, crowns and clouds lean, the picture does not spin. What moves it:
     · the glide   slow, never still, calm (rests while a hand is on the picture);
     · the scroll  arriving from the canyon the lens RISES from a low oblique look over the lake into the composition (clock 7.9 → 8.96);
                   between WHERE VALUE CONNECTS (8.96) and FOUR PATHS (10.18) it sinks and tilts toward the horizon, then comes back;
     · the steps   at FOUR PATHS the lens leans toward the step's river (setActive);
     · the drag    the land turns under the hand: sideways = lean east / west, down = lower and more oblique, up = from above.
     The four corner rays must land on the plate: when they would not, the lens comes closer. So no pose can show the picture's edge. */
  function updateCamera() {
    const portrait = camera.aspect < .85, still = reducedMotion;
    const c = state.clock, t = clamp01((c - 8.96) / 1.22), s = t * t * (3 - 2 * t);
    const bell = still ? 0 : Math.pow(Math.sin(Math.PI * t), 2) * tune.swoop;
    const arrive = still ? 0 : (1 - smooth(7.9, 8.96, c)) * tune.arrive;
    const nx = state.x, nz = state.z, w = state.wall, g = still || portrait ? 0 : state.idle * tune.glide;
    let foc = 0, focSide = 0, focFore = 0, fx = 0, fz = 0;
    if (focusPoints && !still) for (let k = 0; k < 4; k++) {
      const e = lean[k] * tune.focus; if (e < 1e-4) continue; const p = focusPoints[k];
      foc += e; fx += (p.x - centre.x) * e; fz += (p.z - centre.z) * e; focSide += (p.x > centre.x ? -1 : 1) * e; focFore += (p.z < centre.z ? 1 : -.6) * e;
    }
    const EN = state.entry || null;   /* ENTRY (2026-11-16): offsets from the entrance module (flow2-aerial-entry.js) */
    const fore = clamp(9.8 + (+tune.viewTilt || 0) + (EN ? +EN.fore || 0 : 0) + 1.4 * s + 23 * bell + 30 * arrive + (nz < 0 ? -nz * 19 : -nz * 7.5) * tune.orbit + 2.4 * Math.sin(w * .083 + 2.1) * g + 3 * focFore, 1.5, 58);
    const side = clamp(nx * 12.5 * tune.orbit + (5 * Math.sin(w * .107) + 1.6 * Math.sin(w * .047 + 1.3)) * g
      + (still ? 0 : 5.5 * Math.sin(2 * Math.PI * t) * tune.swoop) - 7 * arrive + 3.6 * focSide + (+tune.viewSide || 0) + (EN ? +EN.side || 0 : 0), -30, 30);
    const factor = (1 - .40 * Math.min(1, bell)) * (1 - .45 * Math.min(1, arrive)) * (1 - .015 * s) * (1 - .07 * Math.min(1, foc))
      * (1 + .012 * Math.sin(w * .061 + .7) * g) * (1 - .2 * Math.max(0, -nz) * Math.min(1, tune.orbit));
    target.set(nx * .42 + .06 * Math.sin(w * .05 + .4) * g + fx * .15 + (portrait ? .65 : 0), .105,
      nz * .30 + .04 * Math.sin(w * .039) * g + fz * .15 - .5 * bell - .3 * arrive);
    target.x = clamp(target.x + (+tune.viewX || 0), limit.x0 + .4, limit.x1 - .4); target.z = clamp(target.z + (+tune.viewZ || 0), limit.z0 + .4, limit.z1 - .4);
    dir.set(Math.tan(side * DEG), 1, Math.tan(fore * DEG)).normalize();
    const turn = ((+tune.viewTurn || 0) + (EN ? +EN.turn || 0 : 0)) * DEG; if (turn) dir.applyAxisAngle(YAXIS, turn);
    const fov = clamp(tune.lens, 3, 40);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const rest = state.view / (2 * Math.tan(fov * DEG / 2));
    camera.up.copy(UP); if (turn) camera.up.applyAxisAngle(YAXIS, turn); camera.position.copy(target).add(dir); camera.lookAt(target);
    /* Turn the landscape to fit a portrait screen, so all four approaches to the lake stay in the view. */
    if (portrait) camera.rotateZ(Math.PI * .5);
    camera.updateMatrixWorld();
    let safe = Infinity;
    for (let i = 0; i < 4; i++) {
      corner.set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, .5).unproject(camera).sub(camera.position).normalize();
      if (corner.y > -1e-3) { safe = Math.min(safe, rest * .3); continue; }
      const k = -dir.y / corner.y, kx = dir.x + corner.x * k, kz = dir.z + corner.z * k;      /* where the ray lands, per unit of distance, from the target */
      if (kx > 1e-5) safe = Math.min(safe, (limit.x1 - target.x) / kx); else if (kx < -1e-5) safe = Math.min(safe, (limit.x0 - target.x) / kx);
      if (kz > 1e-5) safe = Math.min(safe, (limit.z1 - target.z) / kz); else if (kz < -1e-5) safe = Math.min(safe, (limit.z0 - target.z) / kz);
    }
    const distance = Math.max(2, Math.min(rest * factor * clamp(+tune.viewZoom || 1, .3, 3) * (EN && Number.isFinite(+EN.dist) ? clamp(+EN.dist, .3, 3) : 1), safe));
    camera.position.copy(target).addScaledVector(dir, distance); camera.updateMatrixWorld();
    /* AFTER: the lens flies straight down into the lake (setZoom 0 → 1): the aim slides to the lake's centre, the tilt goes to straight down,
       the distance shrinks to 6 %; the picture's edge cannot show on the way in (it only gets closer) */
    const zoom = clamp(+state.zoom || 0, 0, 1);
    if (zoom > 0) {
      const e = zoom * zoom * (3 - 2 * zoom);
      target.lerp(centre, e); dir.set(Math.tan(side * DEG) * (1 - e), 1, Math.tan(fore * DEG) * (1 - e)).normalize(); if (turn) dir.applyAxisAngle(YAXIS, turn);
      camera.position.copy(target).addScaledVector(dir, distance * (1 - .94 * e)); camera.lookAt(target);
      if (portrait) camera.rotateZ(Math.PI * .5);
      camera.updateMatrixWorld();
    }
    const P = state.pose; P.fore = fore; P.side = side; P.distance = distance; P.rest = rest; P.safe = safe;
  }
  function resize(w, h) {
    width = w; height = h; camera.aspect = w / h;
    /* GPT's framing, confirmed by the client: the central lake and all four approaching channels, north up.
       state.view = the height of the frame, in world units, at the point the lens looks at. */
    state.view = camera.aspect < .85 ? footprint.width * .87 : Math.min(footprint.depth * .91 * Math.sin(1.40), footprint.width * .90 / camera.aspect);
    camera.updateProjectionMatrix(); updateCamera();
  }
  updateCamera();

  /* ---------- files ---------- */
  const bitmaps = typeof createImageBitmap === 'function' ? new THREE.ImageBitmapLoader().setOptions({ premultiplyAlpha: 'none', colorSpaceConversion: 'none' }) : null;
  const textures = [];
  async function picture(name, { srgb = false, mips = true, repeat = false } = {}) {
    let t;
    if (bitmaps) { const image = await bitmaps.loadAsync(asset(name)); t = new THREE.Texture(image); t.needsUpdate = true; }
    else t = await new THREE.TextureLoader().loadAsync(asset(name));
    t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = mips; t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    if (mips) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.push(t); return t;
  }
  const manifestFile = fine ? fetch(asset('d1-manifest.json')).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null);
  /* with the canyon-style bake the 3D trees are exactly the bake's groves (whole_groves_web.py) */
  const treeList = bakeOn ? 'whole-trees-groves' : 'whole-trees';
  const wholeFiles = wholeTrees ? Promise.all([fetch(asset(treeList + '.json')).then(r => r.json()), fetch(asset(treeList + '.bin')).then(r => r.arrayBuffer()),
    new GLTFLoader().loadAsync(asset('whole-trees.glb')), picture('whole-atlas.webp', { srgb: true }),
    Q.get('forestrocks') !== '1' ? null :      /* off by default: at this size the rock reads as dark specks (2026-11-15 look check) */
    Promise.all([new GLTFLoader().loadAsync(asset('whole-rock.glb')), picture('whole-rock.jpg', { srgb: true })]).catch(() => null)]).catch(error => { console.warn('[forest] whole trees not loaded', error); return null; }) : null;
  const treeFiles = treeCount ? Promise.all([fetch(asset('forest-trees.json')).then(r => r.ok ? r.json() : null), new GLTFLoader().loadAsync(asset('forest-trees.glb'))]).catch(() => null) : null;
  const [model, map, waterMap, flowMap, streakMap, detailMap, manifest, canopyMap, growMap, treeData, wavesMap, whole] = await Promise.all([
    relief ? null : new GLTFLoader().loadAsync(asset('terrain-original.glb')),
    /* lead 2026-11-16 (client: 「好」 to the 8K bake): the whole model rendered from above in Blender (render_bake_full.py) is the plate now —
       8K on capable GPUs, 4K otherwise; ?forestbake=0 = the client's picture as before */
    /* E2 QUALITY: an 8K bake that does not load is tried at 4K; if that fails too the view fails (the page keeps its chapter) — never the photo */
    (bakeOn ? picture(bakeFile, { srgb: true }).catch(error => { if (bakeFile === 'whole-bake-4k.webp') throw error; console.warn('[forest] 8K bake not loaded, the 4K bake instead', error); return picture('whole-bake-4k.webp', { srgb: true }); })
      : picture(big ? 'd1-plate-2x.jpg' : 'forest-four-rivers.png', { srgb: true })),
    fine ? picture('d1-water.png', { mips: false }) : null,
    fine ? picture('d1-flow.png', { mips: false }) : null,
    waterOn ? picture('d1-streak.jpg') : null,
    fine ? picture('d1-detail.png', { repeat: true }) : null,
    manifestFile,
    relief ? picture('d1-canopy.png', { mips: false }) : null,
    growOn ? picture('d1-grow.png', { mips: false }) : null,
    treeFiles,
    water3d && waterOn ? picture('lead-waves.jpg', { repeat: true }) : null,
    wholeFiles
  ]);

  /* ---------- the land and the water: one material, keyed on the world position ---------- */
  const uniforms = {
    tPlate: { value: map }, tWater: { value: waterMap }, tFlow: { value: flowMap }, tStreak: { value: streakMap }, tDetail: { value: detailMap },
    uTime: { value: 0 }, uForestTime: { value: 0 }, uCloud: { value: .72 }, uBounds: { value: new THREE.Vector4(-7, -footprint.depth / 2, 1 / 14, 1 / footprint.depth) },
    uView: { value: new THREE.Vector4(0, 0, 1, 1) }, uEmph: { value: new THREE.Vector4() }, uLake: { value: new THREE.Vector3(.5234, .4809, .0586) },
    tCanopy: { value: canopyMap }, tGrow: { value: growMap }, uYRange: { value: new THREE.Vector2(.038, .79039 - .038) },
    uCanopy: { value: 1.1 }, uRelief: { value: 1.1 }, uTree: { value: 1.15 }, uTreeTone: { value: 1.3 }, uLight: { value: .3 }, uSheen: { value: .22 }, uGrow: { value: growOn ? 0 : 1 },
    uSun: { value: new THREE.Vector3(-.6881, .6001, -.408).normalize() },
    uRv: { value: 1 }, uRvSpeed: { value: 1 }, uRvWave: { value: 1 }, uRvRefl: { value: 1 }, uRvSun: { value: 1 }, uRvFoam: { value: 1 },
    uRvDeep: { value: new THREE.Color(tune.rvDeep) }, uRvShallow: { value: new THREE.Color(tune.rvShallow) }, uRvLook: { value: new THREE.Vector4(0, 0, 1, 1) }, uRvBed: { value: 1 }, uRvFine: { value: 1 }, uGrowGlow: { value: .3 }, uRvSky: { value: new THREE.Color(tune.rvSky) }, uMirror: { value: 0 }, uReflMat: { value: new THREE.Matrix4() }, tRefl: { value: null },
    tWaves: { value: wavesMap }, tAtlas: { value: whole?.[3] || null }, uLeaf: { value: .55 }, tRock: { value: whole?.[4]?.[1] || null }, uRock: { value: 1 }, uW3: { value: 1 }, uW3Wave: { value: 1 }, uW3Refl: { value: 1 }, uW3Deep: { value: 1 }, uHaze: { value: 1 }, uDist: { value: 22 },
    uLattice: { value: 0 }, uLatticeGround: { value: new THREE.Color('#05080f') },
    uLand: { value: 1 }, uLandA: { value: new THREE.Vector4(1, 1, 1, 1) }, uLandB: { value: new THREE.Vector4(1, 1, 1, 0) },   /* D1 LAND */
    uWater: { value: 1 }, uRiver: { value: 1 }, uStreak: { value: 1 }, uSwirl: { value: 1 }, uGlint: { value: 1 }, uFoam: { value: 1 }, uWet: { value: .3 }, uDetail: { value: 1 }, uVig: { value: .13 }
  };
  /* the mark (images/logo.svg, its two paths) drawn into a small picture: R the ring, G the blade, B a soft halo around both */
  function logoPicture() {
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    const ring = new Path2D('M674.5,331.88v29.29s-40.5,14.5-38.5,47.5,40.33,35.5,59.67,28.33,46.89-33.89,28.33-76.33c0,0-13.19-27.14-48.17-28.79v-15.21s44.44,3.5,58.28,42.67c13.83,39.17-7.44,82.49-55.94,85.99s-71.51-55.16-45.01-88.66c0,0,14-19.08,41.33-24.79Z');
    const blade = new Path2D('M674.5,292.42v23.5s-48.67,5.25-58,55.42c0,0-10.5-64.33,58-78.92Z');
    const layer = path => { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, N, N); g.setTransform(N / 180, 0, 0, N / 180, -579.5 * N / 180, -280 * N / 180); g.fillStyle = '#fff'; g.fill(path); return g.getImageData(0, 0, N, N).data; };
    const blur = (src, r, passes) => { let a = src, b = new Float32Array(N * N); for (let p = 0; p < passes; p++) { for (let y = 0; y < N; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * N + Math.min(N - 1, Math.max(0, x))]; for (let x = 0; x < N; x++) { b[y * N + x] = s / (2 * r + 1); s += a[y * N + Math.min(N - 1, x + r + 1)] - a[y * N + Math.max(0, x - r)]; } } const t = new Float32Array(N * N); for (let x = 0; x < N; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(N - 1, Math.max(0, y)) * N + x]; for (let y = 0; y < N; y++) { t[y * N + x] = s / (2 * r + 1); s += b[Math.min(N - 1, y + r + 1) * N + x] - b[Math.max(0, y - r) * N + x]; } } a = t; } return a; };
    const R = new Float32Array(N * N), G = new Float32Array(N * N), r0 = layer(ring); for (let i = 0; i < N * N; i++) R[i] = r0[i * 4 + 3] / 255; const g0 = layer(blade); for (let i = 0; i < N * N; i++) G[i] = g0[i * 4 + 3] / 255;
    const Rs = blur(R, 2, 2), Gs = blur(G, 2, 2), H = new Float32Array(N * N); for (let i = 0; i < N * N; i++) H[i] = Math.max(R[i], G[i]); const Hs = blur(H, 30, 3);
    const out = new Uint8Array(N * N * 4); for (let i = 0; i < N * N; i++) { out[i * 4] = Rs[i] * 255; out[i * 4 + 1] = Gs[i] * 255; out[i * 4 + 2] = Math.min(1, Hs[i] * 3.2) * 255; out[i * 4 + 3] = 255; }
    const t = new THREE.DataTexture(out, N, N, THREE.RGBAFormat); t.flipY = false; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; textures.push(t); return t;
  }
  /* THE LAKE VIDEO (F1, 2026-11-16). media/logo.mp4 (1280×720, 5 s) is loaded only when the view is near (the journey's clock past 7.6, or the
     spreading has begun), plays ONCE when the spreading is under way and then holds its last frame (one entrance, then nothing moves on its own);
     it plays again only on a new arrival (the spreading had run back to bare land — the cut's 20 s rule decides that) or with the panel's
     重播 dial. Cost: the shader reads a 640×360 copy of the video (a 2D canvas, copied only while the video plays, i.e. for 5 s; mipmapped, about
     1.2 MB on the GPU); one texture, four samples inside the lake's circle; no extra pass or target. */
  const lakeVid = (() => {
    if (!videoOn) return null;
    const W = 640, H = 360, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const g2 = canvas.getContext('2d', { alpha: false }); g2.fillStyle = '#9fb9cc'; g2.fillRect(0, 0, W, H);
    const tex = new THREE.CanvasTexture(canvas); tex.flipY = true; tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; textures.push(tex);
    const S = { stage: 'idle', armed: true, plays: 0, shown: 0, replay: 0, last: -1 };
    let video = null;
    const load = () => {
      if (video) return;
      video = document.createElement('video');
      Object.assign(video, { muted: true, playsInline: true, preload: 'auto', loop: false, crossOrigin: 'anonymous' });
      video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
      video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
      video.src = new URL('../../media/logo.mp4', import.meta.url).href;
      video.addEventListener('loadeddata', () => { S.stage = S.stage === 'loading' ? 'ready' : S.stage; copy(); });
      video.addEventListener('ended', () => { S.stage = 'held'; copy(); });
      video.addEventListener('error', () => { S.stage = 'failed'; });
      document.body.append(video); S.stage = 'loading';
    };
    const copy = () => { if (video && video.readyState >= 2) { g2.drawImage(video, 0, 0, W, H); tex.needsUpdate = true; S.last = video.currentTime; } };
    const play = () => { if (!video) return; try { video.currentTime = 0; } catch (error) { } S.plays++; S.stage = 'playing'; const p = video.play(); if (p && p.catch) p.catch(() => { S.stage = 'blocked'; }); };
    return {
      state: S, texture: tex,
      update(growth, clock, tune) {
        if (!video && (clock >= 7.6 || growth > .01)) load();
        if (!video) return 0;
        if (growth <= .02) S.armed = true;                                         /* back to bare land: the next arrival plays it again */
        if (S.armed && growth > .25 && video.readyState >= 2) { S.armed = false; if (reducedMotion) { try { video.currentTime = Math.max(0, (video.duration || 5.04) - .05); } catch (error) { } S.stage = 'held'; } else play(); }
        if (+tune.lakeVidReplay !== S.replay) { S.replay = +tune.lakeVidReplay; if (video.readyState >= 2) play(); }
        if (!video.paused && !video.ended && video.currentTime !== S.last) copy();  /* only while it plays */
        else if (reducedMotion && S.stage === 'held' && video.currentTime !== S.last && video.readyState >= 2) copy();
        S.shown = video.readyState >= 2 && S.last >= 0 ? smooth(.15, .5, growth) : 0;
        return S.shown;
      }
    };
  })();
  if (lakeVid) Object.assign(uniforms, { tLakeVid: { value: lakeVid.texture }, uLakeVid: { value: new THREE.Vector4(0, 0, 1.9, 0) }, uLakeVid2: { value: new THREE.Vector4(0, 16 / 9, 1, 1.6) } });
  if (logoOn) Object.assign(uniforms, { tLogo: { value: logoPicture() }, uLogoC: { value: new THREE.Vector4(0, 0, 1.6, 0) }, uLogoD: { value: new THREE.Vector4(0, .55, .45, 0) }, uLogoF: { value: new THREE.Vector4(1, 0, 1, 0) }, uLogoG: { value: new THREE.Vector4(.5, 1, 1, 1) }, uLogoRing: { value: new THREE.Color(tune.logoRing) }, uLogoBlade: { value: new THREE.Color(tune.logoBlade) } });
  let material;
  if (fine) {
    if (AIR) Object.assign(uniforms, AIR.uniforms);
    material = new THREE.ShaderMaterial({
      uniforms, vertexShader: VERT, fragmentShader: AIR ? FRAG.replace('/*AIR*/', AIR.glsl) : FRAG,
      defines: Object.assign({ FOREST_DETAIL: 1 }, waterOn ? { FOREST_WATER: 1 } : {}, AIR ? { FOREST_AIR: 1 } : {}, relief ? { FOREST_RELIEF: 1 } : {},
        lightOn ? { FOREST_LIGHT: 1 } : {}, growOn && growMap ? { FOREST_GROW: 1 } : {}, wavesMap ? { FOREST_WATER3D: 1 } : {}, wavesMap && river3 ? { FOREST_RIVER: 1 } : {}, wavesMap && mirrorOn ? { FOREST_MIRROR: 1 } : {}, wavesMap && river3 && logoOn ? { FOREST_LOGO: 1 } : {}, wavesMap && river3 && lakeVid ? { FOREST_LAKEVIDEO: 1 } : {}), toneMapped: false, side: THREE.DoubleSide
    });
    if (AIR) AIR.inMaterial = true;
  } else {
    material = new THREE.MeshBasicMaterial({ map });   /* the plain picture (low tier, ?forestfine=0) */
  }
  /* pass 2: the land is a dense grid of this file's own, lifted in the vertex shader by M's ground + canopy heights (crowns are real bumps);
     without it (low tier, ?forestfine=0, ?forestrelief=0) M's ground model is drawn as in pass 1 */
  let terrain;
  if (relief) {
    terrain = new THREE.Group();
    const grid = new THREE.Mesh(reliefGrid(tier === 'high' ? 1000 : lowTier ? 360 : 500, tier === 'high' ? 560 : lowTier ? 200 : 280, footprint.width, footprint.depth), material);
    grid.name = 'Forest relief grid'; grid.frustumCulled = false; terrain.add(grid);
  } else terrain = model.scene;
  terrain.name = 'Finnovation / four rivers and central lake';
  const metrics = { version: VERSION, tier, fine, plate2x: big, water: waterOn, air: !!AIR, meshes: 0, triangles: 0, texture: [map.image.width, map.image.height], source: relief ? 'relief grid + original/d1-canopy.png' : 'original/terrain-original.glb', relief, light: lightOn, grow: growOn };
  const beforeRender = r => { r.getCurrentViewport(view4); uniforms.uView.value.copy(view4); };
  terrain.traverse(object => {
    if (!object.isMesh) return;
    if (Array.isArray(object.material)) object.material.forEach(m => m.dispose()); else object.material?.dispose();
    object.material = material; if (fine) object.onBeforeRender = beforeRender;
    metrics.meshes++; metrics.triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
  });
  scene.add(terrain); terrain.updateMatrixWorld(true);
  const trees = new THREE.Group(); trees.name = 'Forest trees'; metrics.trees = 0;
  if (treeCount && treeData?.[0]?.data && treeData[1] && treeData[0].library?.every(l => l.crown_radius > 0)) {
    const [list, library] = treeData, stride = list.stride || 11, total = Math.min(treeCount, list.count || 0), data = list.data;
    const treeMaterial = new THREE.ShaderMaterial({
      uniforms, vertexShader: TREE_VERT, fragmentShader: AIR ? TREE_FRAG.replace('/*AIR*/', AIR.glsl) : TREE_FRAG,
      defines: Object.assign({}, AIR ? { FOREST_AIR: 1 } : {}, growOn && growMap ? { FOREST_GROW: 1 } : {}), toneMapped: false
    });
    const byType = list.library.map(() => []);
    for (let i = 0; i < total; i++) byType[data[i * stride + 6]]?.push(i);
    const matrix = new THREE.Matrix4(), place = new THREE.Vector3(), turn = new THREE.Quaternion(), grow3 = new THREE.Vector3(), upAxis = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
    list.library.forEach((entry, type) => {
      const source = library.scene.getObjectByName(entry.name), ids = byType[type];
      if (!source?.isMesh || !ids.length) return;
      const geometry = source.geometry.clone(), tints = new Float32Array(ids.length * 3);
      const mesh = new THREE.InstancedMesh(geometry, treeMaterial, ids.length);
      ids.forEach((i, n) => {
        const o = i * stride, wide = data[o + 4] / entry.crown_radius;
        matrix.compose(place.set(data[o], data[o + 1], data[o + 2]), turn.setFromAxisAngle(upAxis, data[o + 5]), grow3.set(wide, data[o + 3], wide));
        mesh.setMatrixAt(n, matrix);
        tint.setRGB(data[o + 7] / 255, data[o + 8] / 255, data[o + 9] / 255, THREE.SRGBColorSpace);
        tints[n * 3] = tint.r; tints[n * 3 + 1] = tint.g; tints[n * 3 + 2] = tint.b;
      });
      geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
      mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.name = entry.name; mesh.onBeforeRender = beforeRender;
      trees.add(mesh); metrics.trees += ids.length; metrics.triangles += ids.length * (geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3);
    });
  }
  if (whole) {
    const [head, buffer, library, atlasMap] = whole, total = Math.min(head.count, tier === 'high' ? head.count : head.medium || 25000);
    const q16 = new Uint16Array(buffer, 0, head.count * 5), kinds = new Uint8Array(buffer, head.count * 10, head.count), R = head.ranges;
    const dq = (v, k) => R[k][0] + v / 65535 * (R[k][1] - R[k][0]);
    let pine = null; library.scene.traverse(o => { if (o.isMesh && o.material?.name === 'Material' && /Pine/.test(o.name + (o.parent?.name || ''))) pine ||= o.geometry; });
    const pineRadius = 0.2106;
    const geos = [broadCrown(head.rects.crownA, head.rects.broadSide), broadCrown(head.rects.crownB, head.rects.broadSide), pine];
    const wMaterial = new THREE.ShaderMaterial({
      uniforms, vertexShader: WTREE_VERT, fragmentShader: AIR ? WTREE_FRAG.replace('/*AIR*/', AIR.glsl) : WTREE_FRAG,
      defines: Object.assign({}, AIR ? { FOREST_AIR: 1 } : {}, growOn && growMap ? { FOREST_GROW: 1 } : {}), toneMapped: false, side: THREE.DoubleSide
    });
    atlasMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const ids = [[], [], []]; for (let i = 0; i < total; i++) ids[kinds[i]]?.push(i);
    const matrix = new THREE.Matrix4(), place = new THREE.Vector3(), turn = new THREE.Quaternion(), size3 = new THREE.Vector3(), upAxis = new THREE.Vector3(0, 1, 0);
    ids.forEach((list, k) => {
      if (!geos[k] || !list.length) return;
      const mesh = new THREE.InstancedMesh(geos[k], wMaterial, list.length);
      list.forEach((i, n) => {
        const o = i * 5, x = dq(q16[o], 'x'), z = dq(q16[o + 1], 'z'), h = dq(q16[o + 2], 'h'), w = dq(q16[o + 3], 'w'), rot = dq(q16[o + 4], 'rot');
        const sx = (k === 2 ? w / (2 * pineRadius) : w) * ((i * 2654435761 >>> 0) % 2 ? -1 : 1);   /* half of them mirrored */
        matrix.compose(place.set(x, 0, z), turn.setFromAxisAngle(upAxis, rot), size3.set(sx, h, sx)); mesh.setMatrixAt(n, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.name = ['Whole broad A', 'Whole broad B', 'Whole pine'][k]; mesh.onBeforeRender = beforeRender;
      trees.add(mesh); metrics.trees += list.length; metrics.triangles += list.length * (geos[k].index ? geos[k].index.count : geos[k].attributes.position.count) / 3;
    });
    metrics.wholeTrees = total; metrics.treeSource = 'whole model (client asset atlas)';
    let rockGeo = null; whole[4]?.[0]?.scene.traverse(o => { if (o.isMesh) rockGeo ||= o.geometry; });
    if (rockGeo && head.rocks?.length) {
      const rockMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: ROCK_VERT, fragmentShader: AIR ? ROCK_FRAG.replace('/*AIR*/', AIR.glsl) : ROCK_FRAG, defines: AIR ? { FOREST_AIR: 1 } : {}, toneMapped: false });
      const rocks = new THREE.InstancedMesh(rockGeo, rockMaterial, head.rocks.length);
      head.rocks.forEach(([x, z, s, rot], n) => { matrix.compose(place.set(x, 0, z), turn.setFromAxisAngle(upAxis, rot), size3.set(s, s, s)); rocks.setMatrixAt(n, matrix); });
      rocks.instanceMatrix.needsUpdate = true; rocks.frustumCulled = false; rocks.name = 'Whole rocks'; rocks.onBeforeRender = beforeRender;
      trees.add(rocks); metrics.rocks = head.rocks.length;
    }
  }
  scene.add(trees);

  /* THE MIRROR (lead, 2026-11-15): before the land is drawn, the same scene is drawn from the lens mirrored in the water plane (y = 0.105) into a
     smaller target — land above the water and the trees nearest the shores (they come first in each tree list), no air — and the water reads it */
  if (mirrorOn && material.defines?.FOREST_MIRROR) {
    const scale = tier === 'high' ? .5 : .34, share = tier === 'high' ? .45 : .28;
    const reflRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    textures.push(reflRT); uniforms.tRefl.value = reflRT.texture;
    const mirrorCam = new THREE.PerspectiveCamera(); mirrorCam.matrixAutoUpdate = false; mirrorCam.matrixWorldAutoUpdate = false;
    const flip = new THREE.Matrix4().set(1, 0, 0, 0, 0, -1, 0, 2 * .105, 0, 0, 1, 0, 0, 0, 0, 1), bias = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute([0, -50, 0, 1e-4, -50, 0, 0, -50, 1e-4], 3));
    const probe = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
    probe.name = 'Forest mirror'; probe.frustumCulled = false; probe.renderOrder = -1e6;
    const clear = new THREE.Color(); let busy = false;
    probe.onBeforeRender = (r, sc, cam) => {
      if (busy || cam === mirrorCam || uniforms.uRv.value <= 0) return;
      busy = true;
      const target = r.getRenderTarget(), w = Math.max(4, Math.round((target ? target.width : r.domElement.width) * scale)), h = Math.max(4, Math.round((target ? target.height : r.domElement.height) * scale));
      if (reflRT.width !== w || reflRT.height !== h) reflRT.setSize(w, h);
      mirrorCam.projectionMatrix.copy(cam.projectionMatrix); mirrorCam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      mirrorCam.matrixWorld.multiplyMatrices(flip, cam.matrixWorld); mirrorCam.matrixWorldInverse.copy(mirrorCam.matrixWorld).invert();
      uniforms.uReflMat.value.multiplyMatrices(bias, cam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
      const hidden = []; for (const o of sc.children) if (o !== terrain && o !== trees && o.visible) { o.visible = false; hidden.push(o); }
      const counts = trees.children.map(m => m.isInstancedMesh ? m.count : 0);
      trees.children.forEach(m => { if (m.isInstancedMesh && m.name !== 'Whole rocks') m.count = Math.ceil(m.count * share); });
      const bg = sc.background, alpha = r.getClearAlpha(); r.getClearColor(clear); sc.background = null;
      /* the land must not read the target it is being drawn into (a WebGL feedback loop) */
      try { uniforms.tRefl.value = null; uniforms.uMirror.value = 1; r.setRenderTarget(reflRT); r.setClearColor(0x000000, 0); r.clear(); r.render(sc, mirrorCam); }
      finally {
        uniforms.tRefl.value = reflRT.texture; uniforms.uMirror.value = 0; r.setClearColor(clear, alpha); sc.background = bg; r.setRenderTarget(target);
        trees.children.forEach((m, i) => { if (m.isInstancedMesh) m.count = counts[i]; }); hidden.forEach(o => { o.visible = true; }); busy = false;
      }
    };
    scene.add(probe); metrics.mirror = scale + ' x, trees ' + share;
  }
  const bounds = relief ? new THREE.Box3(new THREE.Vector3(-footprint.width / 2, .038, -footprint.depth / 2), new THREE.Vector3(footprint.width / 2, .9, footprint.depth / 2)) : new THREE.Box3().setFromObject(terrain);
  const size = bounds.getSize(new THREE.Vector3());
  /* the plate covers the footprint exactly; M's relief keeps 14 x 7.834 centred on the origin */
  footprint.width = size.x; footprint.depth = size.z;
  uniforms.uBounds.value.set(bounds.min.x, bounds.min.z, 1 / size.x, 1 / size.z);
  limit.x0 = bounds.min.x + .08; limit.x1 = bounds.max.x - .08; limit.z0 = bounds.min.z + .08; limit.z1 = bounds.max.z - .08;
  const uvToWorld = (u, v, y = .135) => new THREE.Vector3(bounds.min.x + u * size.x, y, bounds.min.z + v * size.z);
  const screenWidth = width, screenHeight = height;
  resize(1862, 909);
  /* Image-space locations on the actual water (centre lines traced in the bake):
     NW = AI, NE = public equities, SE = pre-IPO, SW = derivatives. */
  const riverUVs = manifest?.rivers?.length === 4 ? manifest.rivers.map(r => r.anchor) : [[.33, .31], [.76, .26], [.70, .79], [.20, .60]];
  const anchors = riverUVs.map(([u, v]) => uvToWorld(u, v));
  const lakeUV = manifest?.lake?.center || [.5234, .4809];
  const lakeR = (manifest?.lake?.inscribed_radius_uv_of_width || .0586);
  uniforms.uLake.value.set(lakeUV[0], lakeUV[1], lakeR);
  const lake = { center: uvToWorld(lakeUV[0], lakeUV[1], .105), radius: lakeR * size.x, outer: manifest?.lake?.outer_units || 2.75, bays: manifest?.lake?.bays_units || 3.1, uv: lakeUV };
  const rivers = (manifest?.rivers || []).map((r, k) => ({ name: r.name, k, anchor: anchors[k], mouth: uvToWorld(r.mouth[0], r.mouth[1], .105), points: r.points.map(([u, v]) => uvToWorld(u, v, .105)), uvs: r.points }));
  centre.copy(lake.center); focusPoints = anchors;
  if (Array.isArray(manifest?.sun_toward_world)) uniforms.uSun.value.fromArray(manifest.sun_toward_world).normalize();
  metrics.riverUVs = riverUVs; metrics.lens = 'perspective';
  metrics.parts = []; terrain.traverse(o => { if (o.isMesh) metrics.parts.push(o.name); });
  if (renderer.initTexture) for (const t of textures) { try { renderer.initTexture(t); } catch (error) { /* uploaded at the first draw instead */ } }

  /* ---------- GPT's edge mist, only while D2's air module is not there ---------- */
  const clouds = new THREE.Group(); clouds.name = 'Forest legacy mist';
  if (!AIR) {
    const plane = new THREE.PlaneGeometry(1, 1);
    [[-.10, .30, 6.5, 4, .22], [1.12, .18, 5.5, 3.5, .18], [-.09, .91, 6.2, 3.8, .20], [1.13, .85, 5.8, 4, .16]].forEach(([u, v, w, h, alpha], i) => {
      raycaster.setFromCamera(uv.set(u * 2 - 1, 1 - v * 2), camera);
      const point = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.7), new THREE.Vector3());
      const cloudMaterial = new THREE.ShaderMaterial({
        uniforms: { time: uniforms.uForestTime, alpha: { value: alpha }, seed: { value: i * 3.7 + 1.3 } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec2 vUv;uniform float time,alpha,seed;${NOISE}
          void main(){vec2 p=vUv*3.1+vec2(seed+time*.004,seed*.8-time*.002);
            float edge=smoothstep(0.,.22,vUv.x)*smoothstep(0.,.22,1.-vUv.x)*smoothstep(0.,.22,vUv.y)*smoothstep(0.,.22,1.-vUv.y);
            float density=smoothstep(.34,.71,forestFbm(p))*edge*alpha;
            if(density<.002)discard;gl_FragColor=vec4(.83,.88,.82,density);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>}`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide
      });
      const cloud = new THREE.Mesh(plane, cloudMaterial); cloud.position.copy(point); cloud.scale.set(w, h, 1); cloud.quaternion.copy(camera.quaternion);
      cloud.userData = { x: point.x, phase: i * 1.6 }; cloud.renderOrder = 20; clouds.add(cloud);
    });
  }
  scene.add(clouds); resize(screenWidth, screenHeight);

  const emph = [0, 0, 0, 0];
  /* THE SPREADING (arrival). uGrow 0 = the bare stone picture, 1 = the finished one. Left alone it follows the journey: it starts when the
     visitor arrives at WHERE VALUE CONNECTS (clock 8.86) and runs back when they leave toward the canyon (clock < 8.5). arrive() / leave() /
     setGrowth(v) take it over (autoGrowth() gives it back). Reduce motion or ?forestgrow=0: the finished picture is simply there. */
  const grow = { value: growOn ? 0 : 1, target: growOn ? 0 : 1, manual: false };
  const api = {
    scene, camera, anchors, metrics, resize,
    /* added for the team: all optional */
    tune, uniforms, terrain, trees, bounds, lake, rivers, uvToWorld, version: VERSION, pose: state.pose,
    lakeVideo: lakeVid ? lakeVid.state : null,   /* F1: { stage: idle|loading|ready|playing|held|blocked|failed, plays, shown } */
    onUpdate(fn) { hooks.add(fn); return () => hooks.delete(fn); },
    /* AFTER (2026-11-16): 0 = the composed view, 1 = straight down into the lake's centre (see updateCamera) */
    /* ENTRY (2026-11-16): { fore, side, turn (degrees), dist (factor) } added to the lens; null = none */
    setEntry(pose) { state.entry = pose && typeof pose === 'object' ? { fore: +pose.fore || 0, side: +pose.side || 0, turn: +pose.turn || 0, dist: Number.isFinite(+pose.dist) ? +pose.dist : 1 } : null; updateCamera(); },
    setZoom(v) { state.zoom = clamp(+v || 0, 0, 1); updateCamera(); },
    get zoom() { return state.zoom || 0; },
    setActive(k) { state.active = Number.isInteger(k) && k >= 0 && k < 4 ? k : -1; },
    arrive() { if (growOn) { grow.manual = true; grow.value = 0; grow.target = 1; } },
    /* E2: the entrance and the exit as one pair for the transitions. enter(): the spreading plays from the bare stone (and the floating mark of
       ?lakeLogo=float rises with its end); leave(): it runs back (the mark sinks first); auto(): the journey's clock decides again (the default).
       phase: 'away' | 'entering' | 'still' | 'leaving'. Nothing moves by itself once phase is 'still'. */
    enter() { this.arrive(); window.__FLOW2_LAKE_MARK__?.auto?.(); },
    auto() { grow.manual = false; window.__FLOW2_LAKE_MARK__?.auto?.(); },
    get phase() { const v = uniforms.uGrow.value; if (!growOn) return 'still'; if (grow.target > v + 1e-3) return 'entering'; if (grow.target < v - 1e-3) return 'leaving'; return v > .999 ? 'still' : 'away'; },
    motion: { old: motionOld },
    leave() { if (growOn) { grow.manual = true; grow.target = 0; } },
    setGrowth(v) { if (growOn) { grow.manual = true; grow.value = grow.target = clamp(+v || 0, 0, 1); uniforms.uGrow.value = grow.value; } },
    autoGrowth() { grow.manual = false; },
    get growth() { return uniforms.uGrow.value; },
    settle(seconds) { state.age += seconds; state.wall += seconds; },
    update(clock, dt, { cloud = .72, drift = 1 } = {}) {
      const step = Math.min(dt, .05);
      state.clock = clock; state.age += step * drift * tune.speed; state.wall += step * drift;
      const blend = reducedMotion ? 1 : 1 - Math.exp(-step * tune.follow);
      state.x += (Math.tanh(state.rawX) - state.x) * blend; state.z += (Math.tanh(state.rawZ) - state.z) * blend;
      /* the idle drift rests while the hand is on the picture and comes back slowly */
      const resting = state.wall - state.lastPan < 1.4 ? 0 : 1;
      state.idle += (resting - state.idle) * (1 - Math.exp(-step * (resting ? .7 : 4)));
      if (growOn) {
        if (!grow.manual) { if (clock >= 8.86) grow.target = 1; else if (clock < 8.5) grow.target = 0; }
        const rate = grow.target > grow.value ? 1 / Math.max(.5, tune.growTime) : 1 / 2.2;
        grow.value = grow.target > grow.value ? Math.min(grow.target, grow.value + rate * step) : Math.max(grow.target, grow.value - rate * step);
        uniforms.uGrow.value = Number.isFinite(tune.growHold) && tune.growHold > 0 ? clamp(tune.growHold, 0, 1) : grow.value;
      }
      uniforms.uLand.value = clamp(+tune.land || 0, 0, 2); uniforms.uLandA.value.set(+tune.crowns || 0, +tune.crownSize || 1, +tune.clearings || 0, +tune.strata || 0); uniforms.uLandB.value.set(+tune.moss || 0, +tune.reliefShade || 0, +tune.treeLight || 0, 0);   /* D1 LAND */
      uniforms.uCanopy.value = tune.canopy; uniforms.uRelief.value = tune.relief; uniforms.uTree.value = tune.trees; uniforms.uTreeTone.value = tune.treeTone; uniforms.uLeaf.value = tune.leaf; uniforms.uRock.value = tune.rock;
      uniforms.uRv.value = tune.rv; uniforms.uRvSpeed.value = tune.rvSpeed; uniforms.uRvWave.value = tune.rvWave; uniforms.uRvRefl.value = tune.rvRefl; uniforms.uRvSun.value = tune.rvSun; uniforms.uRvFoam.value = tune.rvFoam;
      uniforms.uRvDeep.value.set(tune.rvDeep); uniforms.uRvShallow.value.set(tune.rvShallow); uniforms.uRvLook.value.set(+tune.rvClear || 0, 0, Number.isFinite(+tune.rvRapids) ? +tune.rvRapids : 1, Number.isFinite(+tune.rvSparkle) ? +tune.rvSparkle : 1); uniforms.uRvBed.value = tune.rvBed; uniforms.uRvFine.value = tune.rvFine; uniforms.uGrowGlow.value = tune.growGlow; uniforms.uRvSky.value.set(tune.rvSky); uniforms.uLight.value = tune.light; uniforms.uSheen.value = tune.sheen;
      uniforms.uW3.value = tune.w3; uniforms.uW3Wave.value = tune.w3wave; uniforms.uW3Refl.value = tune.w3refl; uniforms.uW3Deep.value = tune.w3deep;
      uniforms.uHaze.value = tune.haze; uniforms.uDist.value = state.pose.distance;
      if (uniforms.uLogoC) {
        const surf = growOn ? smooth(.3, .75, uniforms.uGrow.value) : 1;   /* it shows while the spreading runs (sooner than before: the client did not see it) */
        uniforms.uLogoC.value.set(lake.center.x + (+tune.logoX || 0), lake.center.z + (+tune.logoZ || 0), lake.radius * 1.9 * clamp(+tune.logoSize || 1, .2, 3), (+tune.logoTurn || 0) * DEG);
        uniforms.uLogoD.value.set((shadowMode ? clamp(+tune.logo || 0, 0, 2) : 0) * surf, +tune.logoWave || 0, clamp(+tune.logoClear || 0, 0, 1), 0);   /* F1: the shadow only with ?lakeLogo=shadow */
        const F = window.__FLOW2_LAKE_MARK__;   /* the floating version: the water shows the glass mark's shadow and reflection where it stands */
        if (F && F.mode === 'float' && F.pose) {
          const P = F.pose;
          uniforms.uLogoC.value.set(P.x, P.z, Math.max(.01, P.box), 0);
          uniforms.uLogoD.value.set(clamp(P.on, 0, 1), +tune.logoWave || 0, 0, 1);
          uniforms.uLogoF.value.set(P.rx, P.rz, P.tanE, 0);
          uniforms.uLogoG.value.set(P.cy, Math.max(.01, P.box), +F.tune.ripple || 0, +F.tune.reflect || 0);
        }
        uniforms.uLogoRing.value.set(tune.logoRing); uniforms.uLogoBlade.value.set(tune.logoBlade);
      }
      if (lakeVid) {   /* F1: the lake video — loads near the view, plays once with the spreading, then holds */
        const shown = lakeVid.update(uniforms.uGrow.value, clock, tune);
        uniforms.uLakeVid.value.set(lake.center.x + (+tune.lakeVidX || 0), lake.center.z + (+tune.lakeVidZ || 0), lake.radius * 2.3 * clamp(+tune.lakeVidSize || 1, .2, 3), clamp(+tune.lakeVid || 0, 0, 2) * shown);
        uniforms.uLakeVid2.value.set((+tune.lakeVidTurn || 0) * DEG, 16 / 9, +tune.lakeVidRelief || 0, +tune.lakeVidShade || 0);
      }
      const time = reducedMotion ? 0 : state.age;
      uniforms.uTime.value = time; uniforms.uForestTime.value = time; uniforms.uCloud.value = cloud;
      uniforms.uWater.value = tune.water; uniforms.uRiver.value = tune.river; uniforms.uStreak.value = tune.streak; uniforms.uSwirl.value = tune.swirl; uniforms.uGlint.value = tune.glint;
      uniforms.uFoam.value = tune.foam; uniforms.uWet.value = tune.wet; uniforms.uDetail.value = tune.detail; uniforms.uVig.value = tune.vignette;
      const ease = reducedMotion ? 1 : 1 - Math.exp(-step * 3.2);
      for (let k = 0; k < 4; k++) emph[k] += ((state.active === k ? 1 : 0) - emph[k]) * ease;
      uniforms.uEmph.value.fromArray(emph);
      const slow = reducedMotion ? 1 : 1 - Math.exp(-step * 1.5);
      for (let k = 0; k < 4; k++) lean[k] += ((state.active === k ? 1 : 0) - lean[k]) * slow;
      updateCamera();
      for (const c of clouds.children) { c.quaternion.copy(camera.quaternion); c.position.x = c.userData.x + (reducedMotion || !motionOld ? 0 : Math.sin(state.age * .021 + c.userData.phase) * .3); }
      if (hooks.size) { const frame = { clock, dt: step, time, camera, scene, uniforms, state }; for (const fn of hooks) fn(frame); }
    },
    pan(dx, dy) {
      /* about 40 % of the screen's height turns the land all the way; past that it resists */
      state.rawX = clamp(state.rawX - dx / height * 2.4, -1.7, 1.7);
      state.rawZ = clamp(state.rawZ - dy / height * 2.4, -1.7, 1.7);
      state.lastPan = state.wall;
    },
    reset() { state.rawX = state.rawZ = 0; },
    dispose() {
      const materials = new Set(), geometries = new Set();
      scene.traverse(o => { if (o.material) materials.add(o.material); if (o.geometry) geometries.add(o.geometry); });
      materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose()); textures.forEach(t => { t.dispose(); t.image?.close?.(); }); hooks.clear();
    }
  };
  return api;
}
