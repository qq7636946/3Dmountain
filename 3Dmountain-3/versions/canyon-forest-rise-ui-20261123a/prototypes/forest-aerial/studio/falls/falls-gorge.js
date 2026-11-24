/* RISE FALLS · the gorge's rock (team FT, 2026-11-23). docs/falls/BRIEF-20261123.md, docs/falls/FT.md
   Called by falls/index.js (team FW) only where html[data-rise-falls] is set:
     createFallsGorge(renderer, atlas, studio, shape) -> { group, update(frame), setArrival(k), dispose(), stats }
   What it draws (ONE mesh, one opaque program, no texture of its own: it reads the land's rock and moss tiles):
     · the wall, from just under the land's cut edge at the rim down to under the pool: a hard cap bed on the rim line and softer beds
       stepping back under it (never inside the rim line, so the falling sheet clears it), at the outlet a chute the fourth river runs down;
       along the dry rim a low rock kerb so the land does not end in a knife edge;
     · rocks along the dry rim (the side toward the lens and the two shoulders where the curtain ends), mossy on top;
     · a plain floor under the pool (only seen with the water off).
   Light: the page's sun (atlas.uniforms.uSun) with the gorge's own shadow worked out from the shape (the rim's far side hides the sun: the
   wall the lens sees stands in shade), the land's sky fill, cloud-bank shadows, valley air, vignette and the arrival's grey -> colour.
   ?fallsRocks=0 = no rim rocks. Nothing here runs each frame. */
import * as THREE from 'three';
import { loadDetailTexture } from '../valley-detail/valley-detail.js?v=s24';
import { HIGHLAND_GLSL } from '../studio-highland-ecology.js?v=weather1-bank1-fast1';   /* (unchanged stamp: not a falls file) */

const VERT = `
  attribute vec4 aData;   /* x: 0 wall, 1 rim rock, 2 floor · y: how much of a lip this piece of rim is · z: depth 0 (rim) .. 1 (foot) · w: moss (rocks) / dry kerb (wall) */
  varying vec3 vW, vN; varying vec4 vData;
  void main(){
    vData=aData; vN=mat3(modelMatrix)*normal; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz;
    gl_Position=projectionMatrix*viewMatrix*w;
  }`;

const FRAG = shape => {
  const f = v => { const s = (+v).toFixed(5); return s.includes('.') ? s : s + '.0'; };
  /* director 2026-11-24: the base frame (scale 1); uFallsSize carries the opening (a built shape's frame is already scaled) */
  const F0 = shape.frame, px = shape.params?.sx || 1, py = shape.params?.sy || 1, F = { ...F0, a: F0.a / px, bFar: F0.bFar / py, bNear: F0.bNear / py };
  return `
  uniform sampler2D tRockAlb, tRockNrm, tMossAlb;
  uniform sampler2D tVD; uniform vec4 uGD, uBounds;   /* LAKE SHELF (2026-11-24): the land's erosion detail on the bowl's walls · strength, tiles, relief, moss */
  uniform vec3 uSun, uRockBaseGain, uRockLayerGain, uMeadowBase, uMeadowMoss, uLatticeGround;
  uniform vec4 uView;
  uniform vec2 uFallsSize;
  uniform float uFallsDrop;
  uniform float uTime, uSunIntensity, uStrataStrength, uStudioMist, uAirWhite, uDist, uVig, uLattice, uGrassSat;
  varying vec3 vW, vN; varying vec4 vData;
  float forestHash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float forestNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(forestHash(i),forestHash(i+vec2(1.0,0.0)),f.x),mix(forestHash(i+vec2(0.0,1.0)),forestHash(i+vec2(1.0,1.0)),f.x),f.y); }
  float stFbm2(vec2 p){ return forestNoise(p)*0.67+forestNoise(mat2(0.80,-0.60,0.60,0.80)*p*2.04+vec2(7.3,4.1))*0.33; }
  ${HIGHLAND_GLSL}
  vec3 fgSat(vec3 c,float s){ float l=dot(c,vec3(0.2126,0.7152,0.0722)); return max(vec3(0.0),mix(vec3(l),c,s)); }
  /* does a point inside the gorge see the sun? Walk toward it in the frame of the shape: out through the far arc (an ellipse) or, on the
     lens's side of the widest line, through a side wall; lit when the ray is above the rim there. No loop. */
  float fgSunShadow(vec3 P){
    vec2 d=P.xz-vec2(${f(F.origin[0])},${f(F.origin[1])});
    vec2 q=vec2(dot(d,vec2(${f(F.right[0])},${f(F.right[1])})),dot(d,vec2(${f(F.far[0])},${f(F.far[1])})));
    vec2 sd=vec2(dot(uSun.xz,vec2(${f(F.right[0])},${f(F.right[1])})),dot(uSun.xz,vec2(${f(F.far[0])},${f(F.far[1])})));
    float hl=max(length(sd),1e-4); sd/=hl; float rise=uSun.y/hl;
    vec2 e=vec2(${f(F.a)}*uFallsSize.x,(sd.y>0.0?${f(F.bFar)}:${f(F.bNear)})*uFallsSize.y);
    vec2 qa=q/e, da=sd/e;
    float a=dot(da,da), b=dot(qa,da), c=dot(qa,qa)-1.0, disc=b*b-a*c;
    float s=disc>0.0?(-b+sqrt(disc))/a:0.0;
    float side=abs(sd.x)>1e-4?(sign(sd.x)*${f(F.a)}*uFallsSize.x-q.x)/sd.x:1e3;
    if(q.y+sd.y*side<0.0||disc<=0.0) s=min(max(side,0.0),s>0.0?s:1e3);
    return smoothstep(-0.16,0.05,P.y+max(s,0.0)*rise-${f(shape.waterY)});
  }
  void main(){
    vec3 N=normalize(vN), V=normalize(cameraPosition-vW), L=normalize(uSun);
    float kind=vData.x, lip=vData.y, deep=vData.z;
    float isWall=step(kind,0.5), isRock=step(0.5,kind)*step(kind,1.5), isFloor=step(1.5,kind);
    /* the land's rock (Rock051): three projections, the same scale as the land's cliffs */
    vec3 tw=pow(max(abs(N),0.001),vec3(3.8)); tw/=tw.x+tw.y+tw.z;
    float rs=mix(1.45,3.6,isRock);   /* director: finer tiling (about 2x the detail density) */
    vec2 ux=vW.zy*rs, uy=vW.xz*rs, uz=vW.xy*rs;
    vec4 alb=texture2D(tRockAlb,ux)*tw.x+texture2D(tRockAlb,uy)*tw.y+texture2D(tRockAlb,uz)*tw.z;
    vec4 nx=texture2D(tRockNrm,ux), ny=texture2D(tRockNrm,uy), nz=texture2D(tRockNrm,uz);
    vec2 px=nx.rg*2.0-1.0, py=ny.rg*2.0-1.0, pz=nz.rg*2.0-1.0;
    vec3 Nr=normalize(vec3(N.x,px.y,px.x*sign(N.x))*tw.x+vec3(py.x,N.y,-py.y*sign(N.y))*tw.y+vec3(pz.x*sign(N.z),pz.y,N.z)*tw.z+N*1.4);   /* redo-g3: softer micro relief */
    float disp=nx.b*tw.x+ny.b*tw.y+nz.b*tw.z, ao=nx.a*tw.x+ny.a*tw.y+nz.a*tw.z;
    /* beds: level layers that thicken and pinch out along the wall, each its own tone, a dark parting under each, the shade of the bed above */
    float along=dot(vW.xz,vec2(0.78,0.61));
    float joint=forestNoise(vec2(along*2.1+vW.z*0.9,vW.y*3.7)*2.9);
    float col0=vW.y*7.4+dot(vW.xz,vec2(0.21,-0.13))+0.55*forestNoise(vW.xz*0.55+3.1);
    col0+=0.26*sin(col0*1.55+forestNoise(vW.xz*0.8)*2.6)+(joint-0.5)*0.24+(disp-0.5)*0.30;
    float bed=floor(col0), seed=forestHash(vec2(bed,7.4)), inBed=fract(col0);
    float lens=forestNoise(vW.xz*1.75+vec2(11.3,bed*3.17));
    float halfBed=mix(0.07,0.24,seed)*mix(0.35,1.15,smoothstep(0.22,0.76,lens));
    float off=inBed-mix(0.40,0.60,seed), blur=0.05+min(fwidth(col0),0.15);
    float wallFace=(1.0-smoothstep(0.55,0.92,abs(N.y)))*isWall;
    float band=wallFace*clamp(uStrataStrength,0.0,1.4)*0.42;
    float ledge=(1.0-smoothstep(halfBed*0.5,halfBed+blur,abs(off)))*band;
    float parting=(1.0-smoothstep(0.0,0.035+blur,abs(off+halfBed)))*band*(0.3+0.7*smoothstep(0.32,0.69,joint));
    float underLedge=smoothstep(0.55,1.0,inBed)*band;                                    /* just under the bed above */
    float cracks=smoothstep(0.62,0.80,forestNoise(vec2(along*13.0+bed*5.3,vW.y*2.1)))*band;   /* upright joints, offset from bed to bed */
    float stain=smoothstep(0.42,0.85,forestNoise(vec2(along*7.0+vW.z*3.0,vW.y*0.9+2.0)))*wallFace;   /* seep streaks down the face */
    vec3 weathered=fgSat(alb.rgb,mix(0.42,0.14,isWall))*0.55+vec3(0.071,0.080,0.084)*(0.42+0.80*ao);   /* redo-g2: grey cliffs, not brown */
    /* ft-g4: the beds read from the lens: wider spread of tone from bed to bed, every other bed darker */
    weathered*=mix(1.0,mix(0.56,1.30,forestHash(vec2(bed,3.1)))*mix(0.84,1.12,step(0.5,fract(bed*0.5))),band);
    vec3 basalt=weathered*vec3(0.56,0.63,0.70);
    /* darker and wetter toward the pool and behind the falling water */
    float wet=clamp(max(lip*(0.45+0.55*deep),smoothstep(0.55,1.0,deep)),0.0,1.0)*isWall;
    float basaltW=clamp(0.58*isWall+0.36*deep+0.30*wet+(1.0-disp)*0.22+parting*0.25+0.50*isRock,0.0,0.94);   /* redo-g1: darker grey basalt cliffs, as in the picture */
    vec3 rock=mix(weathered,basalt,basaltW)*uRockBaseGain*(1.0-0.28*deep*isRock);   /* rocks: z = how dark (the near shore's blocks) */
    vec3 fresh=mix(vec3(0.30,0.325,0.34),vec3(0.57,0.56,0.51),smoothstep(0.22,0.78,lens+0.25*(joint-0.5)))*(0.36+dot(alb.rgb,vec3(0.2126,0.7152,0.0722))*1.2+disp*0.6)*uRockLayerGain;
    rock=mix(rock,mix(rock*1.25,fresh,0.55),ledge*(0.30+0.5*lens)*(1.0-0.6*wet));
    rock*=(1.0-parting*0.30)*(1.0-underLedge*0.22)*(1.0-cracks*0.18)*(1.0-stain*0.12)*(1.0-wet*0.22);   /* redo-g3: lower micro-contrast */
    /* director: fine grain, small fractures and lichen speckle at ~3x the beds' frequency (soft, mip-safe value noise) */
    float fineA=forestNoise(vec2(along*31.0,vW.y*27.0)), fineB=forestNoise(vW.xz*41.0+vW.y*13.0);
    rock*=0.88+0.18*fineA*(1.0-0.5*min(1.0,fwidth(along)*30.0));
    rock*=1.0-0.20*smoothstep(0.70,0.86,fineB)*(1.0-wet*0.5);
    rock=mix(rock,rock*vec3(1.10,1.12,0.98),smoothstep(0.62,0.80,forestNoise(vW.xz*19.0+vec2(bed,1.3)))*0.35*(1.0-wet));
    /* ft-g8: lush highland moss on horizontal stepped canyon terraces & rim crowns, contrasting against dark craggy vertical basalt faces */
    vec4 mossT=texture2D(tMossAlb,mat2(0.54,-0.84,0.84,0.54)*vW.xz*0.51+vec2(0.41,0.77));
    float mossLum=dot(mossT.rgb,vec3(0.2126,0.7152,0.0722));
    vec3 moss=fgSat(mossLum*mix(uMeadowBase/0.12,uMeadowMoss/0.11,0.55)*mix(vec3(1.0),clamp(mossT.rgb/max(0.005,mossLum),0.63,1.45),0.23),clamp(uGrassSat,0.2,2.0))*0.82;
    float fuzz=(forestNoise(vW.xz*9.0)-0.5)*0.26+(joint-0.5)*0.18;
    float up=smoothstep(0.28,0.70,Nr.y*0.50+N.y*0.50+fuzz);
    float terraceMoss=up*(1.0-smoothstep(0.30,0.70,deep))*(1.0-lip)*0.80;
    float rimDrape=(1.0-smoothstep(0.015,0.12+0.26*forestNoise(vec2(along*5.5,3.7)),deep))*(1.0-lip)*wallFace*0.92;   /* redo-g3: moss and grass spill further over the edge, unevenly */
    float ledgeCling=smoothstep(0.58,0.86,forestNoise(vec2(along*4.4,vW.y*5.2+bed)))*(1.0-smoothstep(0.06,0.42,deep))*(1.0-lip)*0.34*wallFace;   /* redo-g1: dark rock faces, moss only in a few ledges near the top */
    float wallMoss=terraceMoss+vData.w*(0.48+0.52*smoothstep(0.28,0.68,forestNoise(vW.xz*3.6)+fuzz))*0.92+rimDrape+ledgeCling;
    float rockMoss=smoothstep(0.30,0.78,Nr.y*0.6+N.y*0.4+fuzz*0.7+vData.w*0.26)*(0.44+0.56*vData.w);
    float mossAmt=clamp(mix(wallMoss*(1.0-wet),rockMoss,isRock)*(1.0-isFloor),0.0,0.93);
    /* the page's daylight; moss takes the land's turf fill, rock the land's cliff fill */
    vec3 sunKey=vec3(2.12,1.99,1.72)*clamp(uSunIntensity,0.25,2.0), skyFill=vec3(0.16,0.24,0.35), bounce=vec3(0.065,0.077,0.085);
    float open=mix(1.0,0.46,smoothstep(0.0,1.0,deep)*isWall)*mix(1.0,0.5,isFloor);   /* less sky is seen from deep in the gorge */
    float sunVis=mix(1.0,fgSunShadow(vW),step(vW.y,${f(shape.waterY + 0.02)}))*stCloudVisibility3(vW);
    /* ft-g10: let upward-facing mid-cliff mossy terraces catch soft rim skylight/sunlight so multi-tier green shelves read crisply across the gorge */
    float lit=clamp(dot(Nr,L),0.0,1.0)*mix(sunVis,max(sunVis,0.48),up*(1.0-lip)*0.65);
    float crevice=mix(0.74,clamp(smoothstep(0.04,0.78,disp)*0.52+ao*0.48,0.24,1.0),0.45);   /* redo-g3: softer */
    vec3 rockAmb=mix(vec3(0.27,0.30,0.33),vec3(0.40,0.44,0.47),max(0.0,Nr.y))+bounce*0.48;
    vec3 colRock=rock*(rockAmb*(0.58+0.42*crevice)*open+sunKey*0.80*lit*(0.56+0.44*crevice));
    colRock+=rock*vec3(0.10,0.17,0.18)*smoothstep(0.35,1.0,deep)*isWall*(0.6-0.4*N.y);   /* the bright water below lights the foot of the wall */
    colRock/=1.0+max(0.0,dot(colRock,vec3(0.2126,0.7152,0.0722))-0.26)*0.93;
    vec3 turfAmb=skyFill*(0.44+0.56*max(0.0,Nr.y))+bounce*(0.30+0.70*(1.0-max(0.0,Nr.y)));
    vec3 colMoss=moss*(turfAmb*open+sunKey*lit*0.92);
    vec3 col=mix(colRock,colMoss,mossAmt);
    /* LAKE SHELF (2026-11-24, Crater Lake reference): the walls of the bowl carry the land's erosion (valley-detail's picture, same placing):
       seen from above on a steep wall it stretches into chutes running down to the water, lit by the sun; a few green tongues between them.
       The same gullies run on under the water (falls-water.js). ?lakeShelf=0 = as before. */
    if(uGD.x>.001){
      vec2 guv=clamp((vW.xz-uBounds.xy)*uBounds.zw,0.,1.)*uGD.y;
      vec4 g1=texture2D(tVD,guv), g2=texture2D(tVD,mat2(.8,-.6,.6,.8)*guv*2.31+vec2(.37,.11));
      vec2 gn=(g1.rg-.5)*2.+(g2.rg-.5)*.9;
      vec3 Ng=normalize(Nr+vec3(gn.x,0.,gn.y)*uGD.z);
      float gShade=(max(dot(Ng,L),0.)*sunVis+.34)/(max(dot(Nr,L),0.)*sunVis+.34);
      float gStreak=1.+((g1.b-.5)*1.2+(g2.b-.5)*.5)*.55;
      float gk=uGD.x*(1.-isFloor)*(1.-.5*isRock);
      col*=mix(1.,clamp(gShade*gStreak,.55,1.55),gk);
      float tongue=smoothstep(.56,.74,g1.a*.7+g2.a*.3)*wallFace*(1.-smoothstep(.25,.8,deep))*(1.-wet)*uGD.w;
      col=mix(col,colMoss*(.8+.4*gShade),clamp(tongue,0.,.7)*gk);
    }
    vec3 H=normalize(V+L);
    float rough=mix(0.62,0.40,wet);
    col+=vec3(0.46,0.52,0.58)*pow(max(dot(Nr,H),0.0),mix(36.0,12.0,rough))*(1.0-rough*0.68)*lit*crevice*mix(0.24,0.5,wet)*(1.0-mossAmt)*clamp(uSunIntensity,0.4,1.8);
    col+=vec3(0.20,0.30,0.44)*pow(1.0-clamp(dot(Nr,V),0.18,1.0),4.0)*wet*crevice*0.20*open;
    col=col/(1.0+col*0.20);
    /* redo-g3: the gorge's own haze and spray: lighter, lower-contrast rock the deeper it stands (mist tint near the pool) */
    float below=clamp((${f(shape.waterY)}-vW.y)/max(uFallsDrop>0.01?uFallsDrop:${f(shape.waterY - shape.poolY)},0.2),0.0,1.0);   /* redo-g5: follows the depth slider */
    vec3 hazeC=mix(vec3(0.30,0.37,0.40),vec3(0.44,0.51,0.54),below)*clamp(uSunIntensity,0.6,1.4);
    col=mix(col,hazeC,clamp(0.06+0.34*below,0.0,0.40)*(isWall+isFloor+isRock*0.40*below)*(1.0-0.55*mossAmt));   /* director: darker, less milky end walls (the target's dark rock) */   /* moss on the rim and the near bank keeps its green */
    /* the land's air, arrival, vignette */
    if(uStudioMist>0.002){
      float farA=smoothstep(uDist*0.61,uDist*2.35,length(cameraPosition-vW));
      float oblique=1.0-smoothstep(0.52,0.96,abs(V.y));
      vec3 air=mix(mix(vec3(0.32,0.44,0.62),vec3(0.86,0.90,0.95),pow(max(dot(-V,L),0.0),2.0)*0.60),vec3(0.86,0.90,0.94),uAirWhite);
      col=mix(col,air,clamp(farA*(0.28+0.66*oblique)*0.64*uStudioMist,0.0,0.74));
    }
    col=stValleyAir(col,vec3(vW.x,max(vW.y,0.105),vW.z),cameraPosition);
    float life=smoothstep(0.0,0.11,uArrival*1.36-0.27);
    col=mix(vec3(dot(col,vec3(0.2126,0.7152,0.0722))*0.88+0.008),col,life);
    vec2 sc=(gl_FragCoord.xy-uView.xy)/uView.zw-0.5;
    col*=1.0-uVig*smoothstep(0.5,1.9,dot(sc,sc)*4.0);
    col=mix(col,uLatticeGround,clamp(uLattice,0.0,1.0));
    gl_FragColor=vec4(col,1.0);
    #include <colorspace_fragment>
  }`;
};

/* a seeded generator, so the rock is the same on every visit */
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function buildGeometry(shape, { columns, rocks: rockCount, rocksOn, groups = 10, lean = false, groundAt = null }) {
  const fn = shape.fn, N = shape.outline.length;
  const pos = [], nor = [], dat = [], idx = [];
  const rand = rng(90417);
  const wave = (i, k, n) => Math.sin(i / columns * Math.PI * 2 * n + k * 1.7);
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  /* ---- the wall (redo-g1: one sheer horseshoe wall; beds step back behind the curtain, the dry end cliffs stand nearly upright with a little talus at the foot) ---- */
  const beds = [0.07, 0.18, 0.30, 0.39, 0.54, 0.66, 0.75, 0.88, 0.95];
  const back = [0, 0.045, 0.025, 0.085, 0.045, 0.110, 0.060, 0.130, 0.085, 0.145];
  /* redo-g1: the dry cliffs' beds jut out and in a little (layered rock read from the lens), a little talus toward the foot; no terraces */
  const shelfOut = [0, 0.012, -0.010, 0.016, -0.006, 0.020, 0.004, 0.030, 0.050, 0.080];
  const outIdx = fn.rimIndex(shape.outlet.angle);
  /* redo-g2: the left river's notch (shape.inlet) gets a chute too; the curtain's rock ledges (shape.ledges) sit on the bed planes */
  const inIdx = shape.inlet ? fn.rimIndex(shape.inlet.angle) : -99, mouths = [outIdx, inIdx];
  const mouthDist = at => Math.min(...mouths.map(m => { const d = Math.abs(((at % N) + N) % N - m); return Math.min(d, N - d); }));
  const ledgePlane = (shape.ledges || []).map(L => beds.findIndex(v => Math.abs(v - L.depthTop) < .011));
  const sizeK = Math.min(1.1, Math.max(.6, Math.sqrt((shape.params?.sx || 1) * (shape.params?.sy || 1)) * 1.05));   /* director */
  const cols = [];
  for (let i = 0; i < columns; i++) {
    const at = i * N / columns, deg = fn.rimAngle(at), p = fn.rimPoint(deg), p0 = fn.rimPoint(fn.rimAngle(at - .25)), p1 = fn.rimPoint(fn.rimAngle(at + .25));
    let tx = p1[0] - p0[0], tz = p1[1] - p0[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    let nx = tz, nz = -tx; if (fn.gorgeSd(p[0] + nx * .05, p[1] + nz * .05) < 0) { nx = -nx; nz = -nz; }   /* outward */
    const dIdx = mouthDist(at);
    const chute = 1 - Math.min(1, Math.max(0, (dIdx - .9) / 1.9)), ch = chute * chute * (3 - 2 * chute);
    const lip = fn.lipWeight(deg * Math.PI / 180), dry = (1 - lip) * (1 - ch), shore = fn.dipWeight ? fn.dipWeight(deg * Math.PI / 180) : 0;
    /* smooth craggy buttress modulation clamped safely so terraces never pinch into sharp teeth */
    const buttress = Math.min(1.12, Math.max(0.62, 0.86 + 0.18 * wave(i, 3, 7) + 0.12 * wave(i, 8, 13) + 0.08 * wave(i, 12, 23)));
    const terraceW = dry * (1 - 0.66 * shore);
    /* redo-g3: past the curtain's two ends the side walls on the lens's half become sloping mossy banks (only a short end cliff stays) */
    const endD = deg > 180 ? deg - 180 : (deg < 0 ? -deg : 0), rampT = Math.min(1, Math.max(0, (endD - 9) / 24)), ramp = rampT * rampT * (3 - 2 * rampT);
    /* lush mossy cliff crown along the dry amphitheater ridge & promontory headlands, low gentle lip on the near shore */
    const ridgeRise = dry * (1 - shore) * (0.042 + 0.038 * Math.max(0, 0.5 + 0.5 * wave(i, 2, 5) + 0.30 * wave(i, 6, 17)));
    const shoreKerb = dry * shore * (0.012 + 0.028 * Math.max(0, 0.5 + 0.5 * wave(i, 2, 7) + 0.28 * wave(i, 5, 19)));
    cols.push({ p, nx, nz, top: fn.rimY(deg), lip, ch, dry, shore, buttress, terraceW, kerb: ridgeRise + shoreKerb, ramp, led: fn.ledgeAt ? fn.ledgeAt(deg) : { w: 0, i: -1 } });
  }
  const foot = shape.poolY - .12, rows = [];
  /* each row: share of the height (0 rim .. 1 foot) and its bed; two rows close together at every bedding plane make the stepped ledge */
  /* redo-g4: the dry rim's mossy shoulder is a rounded convex edge (shape.lipProfile.dryRadius): crown -> three arc rows -> the arc's end, then the wall */
  rows.push({ t: 0, bed: -2 }, { t: 0, bed: -1 }, { t: 0, bed: -3, arc: 1 }, { t: 0, bed: -3, arc: 2 }, { t: 0, bed: -3, arc: 3 }, { t: 0, bed: 0, end: true });
  for (let b = 0; b < beds.length; b++) rows.push({ t: beds[b] - .012, bed: b, plane: b }, { t: beds[b] + .012, bed: b + 1, plane: b });
  rows.push({ t: 1, bed: beds.length }, { t: 1.12, bed: 99 });
  const R = rows.length, LP = shape.lipProfile || { radius: 0, dryRadius: 0 };
  for (let j = 0; j < R; j++) for (let i = 0; i < columns; i++) {
    const c = cols[i], row = rows[j];
    /* the crown (where the land's edge is) and the brink's radius: generous over the water, a small mossy shoulder on the dry rim, none in the chutes */
    /* over the water the LAND rounds the brink (shape.lipProfile, in rimTop); the rock's top sits just under the water's drawdown there */
    const crownIn = (.026 + .014 * wave(i, 4, 9)) * c.dry, crownY = c.top + c.kerb * .90 - .04 * c.lip;
    const r = LP.dryRadius * (1 - c.lip) * (1 - c.ch);
    const top2 = crownY - r, H = top2 - foot;
    let t = row.t, inset, y, kerb = 0;
    if (row.plane !== undefined) t += .018 * wave(i, row.plane, 3) + .010 * wave(i, row.plane + 4, 7);   /* geological strata gently undulate */
    if (row.bed === -2) { inset = -.135 * c.dry - .060 * (1 - c.dry); y = c.top - .008; kerb = c.dry * .65; }   /* tucked gently into outer mossy slope */
    else if (row.bed === -1) { inset = crownIn; y = crownY; kerb = c.dry; }   /* the crown: flush with the land's edge over the water, a mossy cushion on the dry rim */
    else if (row.arc) { const th = row.arc * Math.PI / 8; inset = crownIn + r * Math.sin(th); y = crownY - r * (1 - Math.cos(th)); kerb = c.dry; }   /* redo-g4: the rounded brink */
    else if (row.bed === 99) { inset = .36 + .52 * c.terraceW * c.buttress; y = shape.floorY; }         /* talus apron under the pool */
    else {
      const b = row.bed;
      /* broken basalt faces: craggy rock blocks stepping out on dry tiered shelves, clean undercut beds behind wet waterfalls */
      const block = Math.floor(i / columns * (37 + b * 6) + hash(b, 1.7) * 9), blocky = (hash(block, b * 3.1) - .5) * .042;
      const rough = .018 * wave(i, b * 3 + 1, 11) + .012 * wave(i, b * 5 + 2, 23) + .007 * wave(i, b + 7, 47) + blocky;
      const wetInset = b ? -(back[b] + Math.max(0, rough + .024)) : -Math.max(0, -rough) * .4 - .015 * c.lip;
      const dryShelf = shelfOut[b] * c.buttress + rough * 0.8;
      inset = wetInset * (1 - c.terraceW) + dryShelf * c.terraceW;
      /* redo-g2: a rock ledge across the curtain: the bed under its plane juts out to the ledge's front (a slab the falling water breaks on) */
      /* redo-g4: a ledge is a real TIER: from its plane down to the pool the face stands forward at the ledge's front (leaning back a little toward
         the foot), so the step is rock all the way down, never a slab hanging in front of the curtain */
      if (c.led.w > 0 && c.led.i >= 0 && ledgePlane[c.led.i] >= 0 && b >= ledgePlane[c.led.i] + 1) { const L = shape.ledges[c.led.i], k = Math.min(1, Math.max(0, (t - L.depthTop) / Math.max(.05, 1 - L.depthTop))); inset = inset * (1 - c.led.w) + Math.max(inset, L.out * (0.86 + 0.14 * wave(i, 7, 29)) * (1 - .55 * k)) * c.led.w; }
      /* near shore keeps a smooth sloping ramp down into the pool */
      const slope = Math.max(c.shore, c.ramp);
      if (slope > 0.01 && b > 0) inset += slope * c.dry * (0.40 * t + 0.10 * Math.sin(t * Math.PI));
      y = top2 - H * t;
      if (row.end) { inset = crownIn + r; kerb = c.dry; }   /* redo-g4: the arc's end (tangent straight down) */
      else inset += (crownIn + r) * Math.max(0, 1 - t / .30);   /* redo-g4: below the brink the face leans back to the plain wall */
    }
    /* the outlet: the rock runs down as a chute instead of a wall, reaching the pool 0.55 inside the rim */
    if (c.ch > 0 && row.bed > -1) {
      const run = .62 * Math.pow(Math.min(1.12, t), 1.15) - .02, e = Math.min(1, Math.max(0, run / .55)), fall = e * e * (3 - 2 * e);
      const bedY = Math.max(shape.floorY, c.top - (c.top - shape.poolY) * fall - .05 - .12 * e) - (row.arc ? 0 : 0);   /* a little under FW's cascade (outlet.path) */
      inset = inset * (1 - c.ch) + c.ch * run; y = y * (1 - c.ch) + c.ch * bedY;
    }
    pos.push(c.p[0] - c.nx * inset, y, c.p[1] - c.nz * inset);
    nor.push(0, 0, 0); dat.push(0, c.lip, Math.min(1, Math.max(0, t)), kerb);
  }
  for (let j = 0; j < R - 1; j++) for (let i = 0; i < columns; i++) {
    const a = j * columns + i, b = j * columns + (i + 1) % columns, c = a + columns, d = b + columns;
    idx.push(a, b, c, b, d, c);
  }
  const wallVerts = pos.length / 3;
  /* ---- the floor (a shallow dish under the pool) ---- */
  const fBase = pos.length / 3, fCols = 48, rings = [0, .45, .8, .97];
  for (let r = 0; r < rings.length; r++) for (let i = 0; i < fCols; i++) {
    const p = fn.rimPoint(i * 360 / fCols, rings[r]);   /* scaled about the shape's origin */
    pos.push(p[0], shape.floorY + .22 * rings[r] * rings[r], p[1]);
    nor.push(0, 1, 0); dat.push(2, 0, 1, 0);
  }
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < fCols; i++) {
    const a = fBase + r * fCols + i, b = fBase + r * fCols + (i + 1) % fCols, c = a + fCols, d = b + fCols;
    idx.push(a, c, b, b, c, d);
  }
  const smoothVerts = pos.length / 3;
  /* ---- rocks along the dry rim: smoothly shaded organic mossy boulders (indexed sphere, no flat low-poly origami slabs!) ---- */
  let rockTris = 0, rockN = 0;
  if (rocksOn) {
    const sph = new THREE.SphereGeometry(1, 8, 5), sp = sph.getAttribute('position'), si = sph.getIndex();
    const base0 = [], baseIdx = [];
    for (let i = 0; i < sp.count; i++) base0.push([sp.getX(i), sp.getY(i), sp.getZ(i)]);
    for (let i = 0; i < si.count; i++) baseIdx.push(si.getX(i));
    sph.dispose();
    const dry0 = fn.rimIndex(shape.lipArc.to - 1), dry1 = fn.rimIndex(shape.lipArc.from + 1) + N;     /* the dry rim, along the outline */
    const place = (at, size, outMax, dark = 0, mossy = -1) => {   /* dark 0..1: the near shore's basalt outcrops; mossy: moss amount */
      if (mouthDist(at) < 2.6 + size * 8) return;                                          /* the two rivers' mouths stay open water */
      const deg = fn.rimAngle(at), p = fn.rimPoint(deg), q = fn.rimPoint(fn.rimAngle(at + .2));
      let tx = q[0] - p[0], tz = q[1] - p[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      let nx = tz, nz = -tx; if (fn.gorgeSd(p[0] + nx * .05, p[1] + nz * .05) < 0) { nx = -nx; nz = -nz; }
      const out = -.010 + rand() * outMax + size * .32;
      const x = p[0] + nx * out + tx * (rand() - .5) * .08, z = p[1] + nz * out + tz * (rand() - .5) * .08;
      placeAt(x, z, size, dark, mossy);
    };
    /* redo-g1: one rock at a plate point (the rim's rocks above, the outflow ravine's banks below) */
    const placeAt = (x, z, size, dark = 0, mossy = -1) => {
      size *= sizeK;                                                                       /* director: rocks follow the opening's size */
      const sdHere = fn.gorgeSd(x, z);
      if (sdHere < size * .45) return;                                                    /* never hanging over the hole */
      if (mouthDist(fn.rimIndex(((fn.gorgeField(x, z)[1] * 180 / Math.PI) + 360) % 360)) < 3.2 && sdHere < .6) return;   /* director: the rivers' mouths and the inlet notch stay clear (the floating rock) */
      const surface = shape.waterY - fn.troughDrop(x, z);
      let g0 = groundAt ? groundAt(x, z) : surface; if (sdHere < .55) g0 = Math.min(g0, surface + .012);   /* director: near the rim never above the land's water level */
      const y = g0 - size * (groundAt ? .36 : .24);   /* a third sunk in */
      const sx = size * (.85 + .75 * rand()), sy = size * (.42 + .38 * rand()) * (1 - .14 * dark), sz = size * (.75 + .65 * rand()), turn = rand() * Math.PI * 2, lean = (rand() - .5) * .35;
      const c = Math.cos(turn), s = Math.sin(turn), seed = rand() * 100, moss = mossy >= 0 ? mossy : .40 + .55 * rand();
      const base = pos.length / 3;
      for (const [vx, vy, vz] of base0) {
        const big = size > .12 ? 1 : 0;
        const bump = 1 + (.22 + .08 * big) * Math.sin(vx * (2.9 - .9 * big) + seed) * Math.cos(vz * (2.5 - .8 * big) + seed * 1.3) + .16 * Math.sin(vy * 3.8 + seed * .7 + vx * 2.1);
        const softY = vy < 0 ? vy * .48 : vy * .90;
        let px = vx * bump * sx, py = softY * (0.85 + .15 * bump) * sy + sy * .12, pz = vz * bump * sz;
        if (big && py > sy * .74) py = sy * .74 + (py - sy * .74) * .55;   /* redo-g5: a weathered, slightly flattened crown on the big boulders */
        px += lean * py;
        pos.push(x + px * c - pz * s, y + py, z + px * s + pz * c); nor.push(0, 0, 0); dat.push(1, 0, dark, moss);
      }
      for (let i = 0; i < baseIdx.length; i++) idx.push(base + baseIdx[i]);
      rockTris += baseIdx.length / 3; rockN++;
    };
    for (let k = 0; k < rockCount; k++) {
      const e = (k + rand() * .9) / rockCount, at = dry0 + (dry1 - dry0) * e;
      const shoulder = Math.max(0, 1 - Math.min(e, 1 - e) * 9), nearOut = Math.max(0, 1 - Math.abs(((at % N) + N) % N - outIdx) / 3.4);
      const u = rand(), size = (u < .64 ? .016 + .018 * rand() : u < .94 ? .032 + .028 * rand() : .058 + .038 * rand()) * (1 + .35 * shoulder + .35 * nearOut);
      place(at, size, .04 + .12 * rand());
    }
    /* the two shoulders where the curtain ends: low natural mossy rocks tucked onto the cliff shoulders */
    for (let k = 0; k < Math.round(rockCount / 18); k++) { place(dry0 + rand() * 2.4, .055 + rand() * .040, .06, .45, .55); place(dry1 - rand() * 2.4, .055 + rand() * .040, .06, .45, .55); }
    /* redo-g1: no headlands between falls any more (one continuous curtain): no rocks on the far arc */
    /* ft-g7: natural mossy coastal outcrops along the gentle near shore (smooth rounded boulders nestled into the slope) */
    /* redo-g5: the near bank (the picture's foreground rim): a few BIG dark mossy boulders at the pool's edge, each with one or two smaller ones
       beside it; no field of small mossy blobs */
    const nB = lean ? 8 : 12;
    for (let g = 0; g < nB; g++) {
      const at0 = fn.rimIndex(216 + (g + .2 + rand() * .6) / nB * 108);
      place(at0, .17 + .09 * rand(), .04, .78 + .14 * rand(), .22 + .16 * rand());   /* darker, moss on the crown only */
      for (let k = 0, m = 1 + Math.floor(rand() * 2); k < m; k++) place(at0 + (rand() > .5 ? 1 : -1) * (.6 + .7 * rand()), .07 + .05 * rand(), .10, .58 + .25 * rand(), .45 + .35 * rand());
    }
    /* redo-g1/g2: the two ravines (the fourth river's outflow, the left river's notch): dark blocks on both banks of their last reach */
    const ravine = (o, keep, off0) => {
      if (!o || !Array.isArray(o.path)) return;
      const op = o.path, o0 = Math.max(1, o.start - 4), o1 = Math.max(o0 + 1, o.cross);
      for (let i = o0; i < o1; i++) {
        const a = op[i - 1], b = op[i]; let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        for (const side of [-1, 1]) if (rand() < keep) {
          const off = off0 + .14 * rand();
          placeAt(b[0] - tz * side * off + tx * (rand() - .5) * .1, b[1] + tx * side * off + tz * (rand() - .5) * .1, .045 + .06 * rand(), .55 + .35 * rand(), .30 + .45 * rand());
        }
      }
    };
    /* redo-g6: low dark rocks and mossy islets in the plateau water behind the brink (shape.bandRocks: they follow the opening sliders) */
    for (const b of shape.bandRocks || []) if (!b.kind) placeAt(b.x, b.z, b.r * .8, .78 + .14 * rand(), .22 + .2 * rand());   /* director: no flat mossy islets (they read pasted on), smaller low rocks */
    ravine(shape.outlet, lean ? .4 : .62, .20);
    ravine(shape.inlet, lean ? .4 : .62, .16);
    /* redo-g2: the near bank is hummocky, rocky and mossy (the picture): dark mossy rocks scattered over it, not only along the rim line */
    for (let k = 0; k < (lean ? 3 : 6); k++) {   /* redo-g5: only a handful left (was 36) */
      const at = fn.rimIndex(214 + 112 * rand()), p = fn.rimPoint(fn.rimAngle(at)), out = .14 + 1.0 * rand() * rand();
      const dx = p[0] - shape.centre[0], dz = p[1] - shape.centre[1], dl = Math.hypot(dx, dz) || 1;
      placeAt(p[0] + dx / dl * out, p[1] + dz / dl * out, .035 + .075 * rand() * rand(), .28 + .30 * rand(), .60 + .35 * rand());
    }
  }
  /* normals: the wall and floor smooth (shared corners), the rocks faceted */
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aData', new THREE.Float32BufferAttribute(dat, 4));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const o = shape.frame.origin;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(o[0], -.6, o[1]), 6);
  return { geometry: g, triangles: idx.length / 3, rockTris, rocks: rockN, wallTris: (R - 1) * columns * 2, wallVerts, smoothVerts };
}

export async function createFallsGorge(renderer, atlas, studio, shape) {
  if (!shape || !shape.fn) throw new Error('falls-gorge: the shape (ft-v2 or later) is needed');
  const Q = new URLSearchParams(location.search);
  const quality = window.__FLOW2_QUALITY__, light = !!quality && (quality.start === 'medium' || quality.start === 'low' || +quality.rank < 2);
  const coarse = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (error) { return false; } })();
  const lean = light || coarse;
  const buildOpts = { columns: lean ? 192 : 320, rocks: lean ? 22 : 44, groups: lean ? 12 : 22, lean, rocksOn: Q.get('fallsRocks') !== '0' };
  /* redo-g4: the land's height at a plate point, for the rocks outside the rim: the atlas's own height picture (the same formula as the land),
     carved toward the water level near the rim as the land is (falls basin), lowered with the troughs / near shore / lip rise. */
  const makeGround = sh => {
    const U = atlas.uniforms, img = U?.tCanopy?.value?.image;
    if (!img || !img.data || !U.uBounds || !U.uYRange || !U.uRelief || !sh?.fn) return null;
    const W = img.width, Hh = img.height, d = img.data, b = U.uBounds.value, YR = U.uYRange.value, rel = U.uRelief.value;
    const k = d instanceof Uint8Array || d instanceof Uint8ClampedArray ? 1 / 255 : d instanceof Uint16Array ? 1 / 65535 : 1;
    const ss = (a, c, v) => { const t = Math.min(1, Math.max(0, (v - a) / (c - a))); return t * t * (3 - 2 * t); };
    const tex = (x, z) => {
      const fu = Math.min(W - 1.001, Math.max(0, (x - b.x) * b.z * W - .5)), fv = Math.min(Hh - 1.001, Math.max(0, (z - b.y) * b.w * Hh - .5));
      const i = Math.floor(fu), j = Math.floor(fv), a = fu - i, e = fv - j, at = (ii, jj) => d[(jj * W + ii) * 4] * k;
      return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - e) + (at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a) * e;
    };
    return (x, z) => {
      const nat = Math.max(.105, .105 + (YR.x + tex(x, z) * YR.y - .105) * rel);
      const g = sh.fn.gorgeField(x, z), lip = sh.fn.lipWeight(g[1]), reach = sh.fn.bandReachAt ? sh.fn.bandReachAt(g[1]) : .3;
      const shelf = (lip > .5 ? .09 : .25) + reach * .72, c = 1 - ss(shelf, shelf + (lip > .5 ? 1.35 : 1.95), g[0]), w = c * c * (3 - 2 * c) * .96 + c * .04;
      return nat + (.105 - nat) * w - sh.fn.troughDrop(x, z);
    };
  };
  let built = buildGeometry(shape, { ...buildOpts, groundAt: makeGround(shape) });
  /* the land's own tiles (already on the GPU): no new texture */
  let land = null; atlas.terrain.traverse(o => { if (!land && o.isMesh && o.material?.uniforms?.tRockAlb) land = o.material.uniforms; });
  if (!land) throw new Error('falls-gorge: the land has no rock tiles (studio PBR layer not applied)');
  const A = atlas.uniforms, S = studio.uniforms;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tRockAlb: land.tRockAlb, tRockNrm: land.tRockNrm, tMossAlb: land.tMossAlb,
      uSun: A.uSun, uTime: A.uTime, uView: A.uView, uVig: A.uVig, uLattice: A.uLattice, uLatticeGround: A.uLatticeGround, uDist: A.uDist,
      uSunIntensity: S.uSunIntensity, uStrataStrength: S.uStrataStrength, uStudioMist: S.uStudioMist, uAirWhite: S.uAirWhite,
      uRockBaseGain: S.uRockBaseGain, uRockLayerGain: S.uRockLayerGain, uMeadowBase: S.uMeadowBase, uMeadowMoss: S.uMeadowMoss, uGrassSat: S.uGrassSat,
      uBiomeContrast: S.uBiomeContrast, uCavityDepth: S.uCavityDepth, uCloudStrength: S.uCloudStrength, uBankShadow: S.uBankShadow, uMistColor: S.uMistColor,
      uValleyMist: S.uValleyMist, uMistHeight: S.uMistHeight, uArrival: S.uArrival, uArrivalMap: S.uArrivalMap,
      uFallsSize: S.uFallsSize || { value: new THREE.Vector2(1, 1) },
      tVD: { value: null }, uBounds: land.uBounds || A.uBounds || { value: new THREE.Vector4(0, 0, 1, 1) },
      uGD: { value: new THREE.Vector4(new URLSearchParams(location.search).get('lakeShelf') === '0' ? 0 : 1.2, 3, 1.4, .8) },
      uFallsDrop: S.uFallsDrop || { value: shape.waterY - shape.poolY }
    },
    vertexShader: VERT, fragmentShader: FRAG(shape), toneMapped: false
  });
  material.userData.handlesArrival = true;   /* the grey -> colour of the arrival is in the program (the land's own uniform) */
  if (material.uniforms.uGD.value.x > 0) loadDetailTexture(renderer).then(t => { material.uniforms.tVD.value = t; }).catch(() => { material.uniforms.uGD.value.x = 0; });
  /* redo-g5: the land's live trough / dip follow the opening's drop (studio uniform uFallsDrop): set it now and on every slider rebuild */
  const setDrop = sh => { if (S.uFallsDrop && sh && Number.isFinite(sh.waterY - sh.poolY)) S.uFallsDrop.value = sh.waterY - sh.poolY; };
  setDrop(shape);
  const mesh = new THREE.Mesh(built.geometry, material);
  mesh.name = 'Rise falls gorge rock'; mesh.renderOrder = 1; mesh.frustumCulled = false;
  mesh.onBeforeRender = r => { r.getCurrentViewport(A.uView.value); };
  const group = new THREE.Group(); group.name = 'Rise falls gorge'; group.add(mesh);
  const stats = { version: 'dir1', triangles: built.triangles, wall: built.wallTris, rocks: built.rocks, rockTriangles: built.rockTris, draws: 1, textures: 0 };
  return {
    group, mesh, stats,
    rebuild(nextShape) {
      if (!nextShape || !nextShape.fn) return;
      setDrop(nextShape);
      const next = buildGeometry(nextShape, { ...buildOpts, groundAt: makeGround(nextShape) });
      const old = mesh.geometry;
      mesh.geometry = next.geometry;
      built = next;
      old?.dispose();
      stats.triangles = next.triangles; stats.wall = next.wallTris; stats.rocks = next.rocks; stats.rockTriangles = next.rockTris;
    },
    update() { },
    setArrival() { },   /* follows studio.uniforms.uArrival by itself */
    dispose() { group.removeFromParent(); mesh.geometry?.dispose(); material.dispose(); }
  };
}
