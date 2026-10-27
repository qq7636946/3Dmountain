/* index1-5 · 水字登場 — the liquid letters' water entrance.
 * Source of the generated prototypes/index1-5-morning-20261026/js/letters-water-fx.js (copied by
 * letters-entrance-build.cjs; edit here, then run node prototypes/index1-5-morning-20261026/build.cjs).
 *
 * The letters climb their helix out of the sea (it lies at the page's sea level,
 * and every letter starts below it). Each is born as WATER:
 *   DROP (default, ?letterfx=drop): the letter leaves the sea as a drop — the
 *     surface heaves, a jet of water necks under it and pinches off (a droplet or
 *     two falling back), a crown of spray jumps round the place it left and a ring
 *     runs out on the real sea; drawn into a tear by its speed, the drop then takes
 *     the letter's shape as it climbs — its middle first, the strokes flowing out,
 *     holes opening, an i's dot pinching free, the soft surface-tension edges
 *     sharpening to the cut glyph — a ripple runs across the face, a glint sweeps
 *     it, and the letter's own liquid-glass mesh carries on into the word.
 *   CONDENSE (?letterfx=condense): spray leaps out of the sea and lands on the
 *     letter's strokes; each landing spreads as a pool along the stroke until the
 *     pools meet and the letter is whole.
 *   OFF (?letterfx=off): the original.
 * The shape is a signed distance field — the letter's own baked glyph field,
 * extruded and rounded, blended with the drop and smooth-unioned with the jet and
 * the droplets — ray-marched inside a box that rides the letter's own pose, lit with
 * the wordmark glass's own uniforms (same backdrop capture, studio cube, sky/sea,
 * sun) and depth-tested against the sea; no extra passes. Scroll says where the
 * shape should be and a spring carries it there, so it settles like a liquid when
 * the wheel stops and runs backward when the page scrolls back; the sea events are
 * read off the letter's real height above the water, so they replay in reverse.
 * Reduced motion: no entrance effect (the original fade). */

export const LETTER_FX_DEFAULTS = {
  /* The letters' own timing on the chapter's clock (0–1): when the first sets off
     from the deep, how far behind it the last one does, and how long each takes
     to reach its place. The word sets just after the last is home. (Design values
     of the original helix; index1-5's main sets its own rhythm.) */
  riseStart: .035, riseStagger: .31, riseLength: .44,
  /* 0 off (original), 1 drop → letter, 2 condense. */
  fxMode: 1,
  /* Along each letter's own flight (0 its start, 1 home in the word; it leaves
     the sea at about .46): the drop turns into the letter between SHAPE START
     and SHAPE END. */
  fxShapeStart: .5, fxShapeEnd: .82,
  /* The drop's size (× the letter's half-height); the jet under it as it leaves
     the sea (its length, × the drop's radius); the crown of spray (how many
     droplets, how high); the heave of the surface; the ring on the sea. */
  fxBlob: .95, fxNeck: 1.7, fxDroplets: 5, fxCrown: 1, fxMound: .45, fxSplash: 1,
  /* Liquid: MELT is the width of the necks between merging water (smooth union),
     ROUND the soft surface-tension edge while it is still liquid, WOBBLE the
     surface trembling, TAIL how far its speed draws it out into a tear. */
  fxMelt: .14, fxRound: .05, fxWobble: .009, fxTail: .3,
  /* The drop's own optics while it is water: LENS how much harder it bends what
     is behind it, RIM the dark band inside its edge, WINDOWS the studio's
     softboxes caught on it. */
  fxLens: 1.3, fxRim: .38, fxWindows: 2.2,
  /* The spring that carries the shape after the scroll: SPRING its speed (1/s),
     BOUNCE its overshoot (0 = none). */
  fxSpring: 11, fxBounce: .42,
  /* As it sets: RIPPLE across its face, GLINT sweeping it, CAUSTIC the focused
     light inside the drop, DYE the brand blue blooming into the F's stroke. */
  fxRipple: .9, fxGlint: 1.3, fxCaustic: .55, fxDye: 1
};

const FX_VERTEX = /* glsl */`
  uniform vec3 uFxBox;
  varying vec3 vFxLocal,vFxCam;
  void main(){
    vFxLocal=position*uFxBox;
    vFxCam=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz;
    gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(vFxLocal,1.);
  }
`;

const fxFragment = (steps, glacier = '') => /* glsl */`
  #define FX_STEPS ${steps}
  ${glacier ? '#define FX_GLACIER' : ''}
  #define FX_N 8
  uniform mat4 modelMatrix,projectionMatrix;
  uniform sampler2D uFxGlyph;
  uniform float uFxTile,uFxDepth,uFxPix,uFxTime,uFxAlpha;
  uniform vec3 uFxBox,uFxCenter,uFxUp;
  /* x formed 0–1, y edge rounding, z melt (smooth-union width), w wobble */
  uniform vec4 uFxShape;
  /* the drop: xyz centre, w radius; its tear: xyz tail end, w tail radius */
  uniform vec4 uFxBlob,uFxTail;
  /* the jet under it: xyz its foot (under the sea), w radius; the heave: xyz centre, w size */
  uniform vec4 uFxNeck,uFxMound;
  /* growth seeds: xy, w reach (<=0 off); droplets: xyz, w radius (<=0 off) */
  uniform vec4 uFxSeed[FX_N],uFxDrop[FX_N];
  /* ripple radius, ripple amount, glint position, glint strength */
  uniform vec4 uFxWave;
  /* x blue dye, y caustic, z flow-front softness, w liquid (1 while it is still water) */
  uniform vec4 uFxLook;
  /* DROP: x how far the drop has turned into the letter (<0: CONDENSE instead),
     y how much sooner its middle turns than its ends, z the letter's reach */
  uniform vec4 uFxMorph;
  /* the drop's own optics: x extra lens, y dark rim band, z studio windows */
  uniform vec3 uFxLens;
  uniform sampler2D uBackdrop;
  uniform samplerCube uEnv;
  uniform mat4 uProjView;
  uniform vec3 uTint,uShadeColor,uSSSColor,uSkyTop,uSkyLow,uSeaNear,uSeaFar,uSunDir,uSunCol;
  uniform float uIorA,uIorDelta,uSceneDepth,uSceneMix,uReflStr,uFresnelPow,uReflFloor,uEnvRough,uEnvSky,uEnvStudio,uSunSpec,uSunPow,uSunDisc,uRim,uRimPow,uRough,uShade,uSSS,uGraze,uSpecCap,uOpacity;
  uniform vec3 uBlueA,uBlueB;
  uniform vec4 uBlueBox;
  uniform float uBlueDensity,uBlueGlow,uBlueMirror;
  varying vec3 vFxLocal,vFxCam;
  ${glacier}

  float fxSmin(float a,float b,float k){float h=max(k-abs(a-b),0.)/max(k,1e-5);return min(a,b)-h*h*k*.25;}
  float fxSmax(float a,float b,float k){return -fxSmin(-a,-b,k);}
  /* x: the letter (with its blue stroke), y: the blue stroke alone — in wordmark
     heights, negative inside; outside the baked tile the distance to it is added. */
  vec2 fxField(vec2 p){
    vec2 q=p*uFxTile+.5;
    vec2 f=textureLod(uFxGlyph,clamp(q,vec2(.002),vec2(.998)),0.).rg;
    float away=length(max(abs(q-.5)-.498,0.))/uFxTile;
    return vec2(min(f.x,f.y),f.y)+away;
  }
  /* The glyph extruded to the glass's depth, every edge rounded by R. */
  float fxGlyph(vec3 p,float r){
    float d2=fxField(p.xy).x;
    vec2 w=vec2(d2+r,abs(p.z)-uFxDepth+r);
    return min(max(w.x,w.y),0.)+length(max(w,0.))-r;
  }
  float fxCapsule(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);return length(pa-ba*h)-r;}
  float fxMap(vec3 p){
    float d=1e3;
    if(uFxMorph.x>=0.){
      /* DROP: the drop's own field, turning into the letter's — middle first */
      float b=1e3;
      if(uFxBlob.w>0.){
        b=length(p-uFxBlob.xyz)-uFxBlob.w;
        if(uFxTail.w>0.)b=fxSmin(b,length(p-uFxTail.xyz)-uFxTail.w,uFxBlob.w*1.2);
      }
      float m=clamp(uFxMorph.x*(1.+uFxMorph.y)-uFxMorph.y*length(p.xy)/uFxMorph.z,0.,1.);
      if(m<=0.)d=b;
      else{float g=fxGlyph(p,uFxShape.y);d=m>=1.?g:mix(b,g,m);}
    }else{
      /* CONDENSE: the letter where the landed water has spread so far: a rounded flow front */
      float reach=1e3;
      for(int i=0;i<FX_N;i++){vec4 s=uFxSeed[i];if(s.w>0.)reach=min(reach,length(p.xy-s.xy)-s.w);}
      if(reach<1e2)d=fxSmax(fxGlyph(p,uFxShape.y),reach,uFxLook.z);
    }
    /* the jet it pulls out of the sea, and the sea heaving where it leaves */
    if(uFxNeck.w>0.)d=fxSmin(d,fxCapsule(p,uFxBlob.xyz,uFxNeck.xyz,uFxNeck.w),uFxNeck.w*2.2+.03);
    if(uFxMound.w>0.){
      vec3 q=p-uFxMound.xyz;float yv=dot(q,uFxUp);
      vec2 e=vec2(length(q-uFxUp*yv),yv),rr=vec2(uFxMound.w*2.4,uFxMound.w*.55);
      float k0=length(e/rr),k1=length(e/(rr*rr));
      d=fxSmin(d,k0*(k0-1.)/max(k1,1e-5),uFxMound.w*.9);
    }
    for(int i=0;i<FX_N;i++){vec4 q=uFxDrop[i];if(q.w>0.)d=fxSmin(d,length(p-q.xyz)-q.w,uFxShape.z*.85);}
    if(uFxShape.w>0.)d+=uFxShape.w*sin(p.x*11.+uFxTime*3.1)*sin(p.y*9.-uFxTime*2.4+p.z*6.)*sin(p.z*13.+p.x*4.+uFxTime*2.7);
    return d;
  }
  vec2 fxBoxHit(vec3 ro,vec3 rd,vec3 b){
    vec3 m=1./rd,n=m*ro,k=abs(m)*b,t1=-n-k,t2=-n+k;
    return vec2(max(max(t1.x,t1.y),t1.z),min(min(t2.x,t2.y),t2.z));
  }
  vec3 fxNormal(vec3 p,float e){
    vec2 h=vec2(1.,-1.);
    return normalize(h.xyy*fxMap(p+h.xyy*e)+h.yyx*fxMap(p+h.yyx*e)+h.yxy*fxMap(p+h.yxy*e)+h.xxx*fxMap(p+h.xxx*e));
  }
  vec2 fxScreen(vec3 w){vec4 c=uProjView*vec4(w,1.);return c.xy/max(c.w,.001)*.5+.5;}
  vec3 fxWorldEnv(vec3 R){
    float h=clamp(R.y,-1.,1.);
    vec3 sky=mix(uSkyLow,uSkyTop,pow(max(h,0.),.55));
    vec3 sea=mix(uSeaNear,uSeaFar,pow(max(-h,0.),.45));
    return mix(sea,sky,smoothstep(-.02,.02,h))+uSunCol*pow(max(dot(R,uSunDir),0.),900.)*uSunDisc;
  }
  void main(){
    vec3 ro=vFxCam,rd=normalize(vFxLocal-vFxCam);
    vec2 tb=fxBoxHit(ro,rd,uFxBox);
    float t=max(tb.x,0.),tEnd=tb.y;
    if(tEnd<=t)discard;
    float best=1e9,tBest=t;bool hit=false;
    for(int i=0;i<FX_STEPS;i++){
      float d=fxMap(ro+rd*t),px=t*uFxPix;
      float a=d/px;if(a<best){best=a;tBest=t;}
      if(d<px*.25){hit=true;tBest=t;break;}
      t+=max(d*.8,px*.35);
      if(t>tEnd)break;
    }
    /* a ray that passes within a pixel of the water still covers part of it */
    float cover=hit?1.:clamp(1.-best,0.,1.);
    if(cover<.02)discard;
    vec3 p=ro+rd*tBest;
    vec3 n=fxNormal(p,max(tBest*uFxPix*.8,.0035));
    vec2 f=fxField(p.xy);
    float formed=smoothstep(.55,1.,uFxShape.x);
    float e=.006;
    vec2 g=vec2(fxField(p.xy+vec2(e,0.)).x-fxField(p.xy-vec2(e,0.)).x,fxField(p.xy+vec2(0.,e)).x-fxField(p.xy-vec2(0.,e)).x);
    g/=max(length(g),1e-5);
    /* the same lens the letter's glass has along its outline, as it sets */
    if(formed>0.&&abs(n.z)>.5){
      float lensK=1.;
      #ifdef FX_GLACIER
      lensK=uGlOn>.5?uGlLens:1.;
      #endif
      float lens=pow(1.-smoothstep(0.,.105,max(0.,-f.x)),1.15)*.62*lensK*smoothstep(.6,.95,abs(n.z))*formed;
      n=normalize(n+vec3(g,0.)*lens);
    }
    /* the ripple running out across the face as it sets */
    if(uFxWave.y>1e-4&&abs(n.z)>.45){
      float rr=length(p.xy),dr=rr-uFxWave.x;
      vec2 dir=p.xy/max(rr,1e-4);
      n=normalize(n+vec3(dir*sin(dr*44.)*exp(-dr*dr*55.)*uFxWave.y,0.));
    }
    vec3 Pw=(modelMatrix*vec4(p,1.)).xyz;
    vec3 N=normalize(mat3(modelMatrix)*n);
    vec3 V=normalize(Pw-cameraPosition);
    float NdV=clamp(dot(N,-V),0.,1.);
    /* the brand blue: dyed into the F's stroke, blooming in as the water takes the shape */
    float onBlue=(1.-smoothstep(-.004,.014,f.y))*uFxLook.x;
    vec2 bq=((p.xy+uFxCenter.xy)*2.4-uBlueBox.xz)/max(uBlueBox.yw-uBlueBox.xz,vec2(1e-4));
    vec3 bBlue=mix(uBlueB,uBlueA,smoothstep(.1,.95,.42*bq.x+.58*bq.y));
    vec3 tint=mix(uTint,mix(uTint,bBlue,uBlueDensity),onBlue);
    /* refraction of the page behind, as the wordmark glass does it, with a little more
       spread — and, while it is still a drop, the strong lens of a ball of water */
    float liquid=uFxLook.w;
    float bend=uSceneDepth*(1.+liquid*uFxLens.x);
    vec3 rA=refract(V,N,1./uIorA),rB=refract(V,N,1./(uIorA+max(uIorDelta,.004)*3.));
    vec2 uvA=fxScreen(Pw+rA*bend),uvB=fxScreen(Pw+rB*bend);
    vec3 through=vec3(texture2D(uBackdrop,clamp(uvA,vec2(.001),vec2(.999))).r,
      texture2D(uBackdrop,clamp(mix(uvA,uvB,.5),vec2(.001),vec2(.999))).g,
      texture2D(uBackdrop,clamp(uvB,vec2(.001),vec2(.999))).b)*tint;
    #ifdef FX_GLACIER
    /* the glacier body the letter's glass has (logo-look-build.cjs): as a drop by the view alone, as a letter by its outline */
    glBrand=onBlue;
    float gInner=max(0.,-f.x),gFace=smoothstep(.6,.95,abs(n.z));
    vec3 gOut=mat3(modelMatrix)*vec3(g,0.);
    vec3 gObj=vec3((p.xy+uFxCenter.xy)*2.4,p.z*2.4);
    through=mix(glacierBody(through,NdV,-1.,-1.,gObj),glacierBody(through,NdV,gInner,gFace,gObj),formed);
    #endif
    vec3 lit=tint*(.6+.4*max(0.,dot(N,normalize(vec3(-.32,1.,.45)))));
    vec3 color=mix(lit,through,uSceneMix);
    color=mix(color,tint*.85,uRough*.35);
    color+=uSSSColor*min(pow(1.-NdV,3.1)*uSSS,uSpecCap*.55);
    color=mix(color,color*uShadeColor,pow(1.-NdV,1.5)*uShade);
    color+=bBlue*uBlueGlow*(.45+.55*NdV)*onBlue;
    float fres=clamp(uReflFloor+(1.-uReflFloor)*pow(1.-NdV,uFresnelPow),0.,1.);
    float grazeFade=smoothstep(0.,uGraze,NdV);
    vec3 R=reflect(V,N);
    vec3 env=fxWorldEnv(R)*uEnvSky+textureLod(uEnv,R,uEnvRough*8.).rgb*uEnvStudio*(1.+liquid*uFxLens.z);
    env*=mix(vec3(1.),bBlue/max(max(bBlue.r,max(bBlue.g,bBlue.b)),1e-3),uBlueMirror*onBlue);
    color=mix(color,env,fres*grazeFade);
    vec3 spec=env*max(uReflStr-1.,0.)*fres*grazeFade;
    spec+=vec3(.94,.97,1.)*pow(1.-NdV,uRimPow)*uRim*grazeFade;
    vec3 H=normalize(uSunDir-V);
    spec+=uSunCol*pow(max(dot(N,H),0.),uSunPow)*uSunSpec*grazeFade;
    spec+=uSunCol*pow(max(dot(N,H),0.),uSunPow*.18)*uSunSpec*.13*grazeFade;
    /* water, not glass, while it is still a drop: the studio key caught high on the
       near side, and the light it focuses glowing low on the far side */
    vec3 key=normalize(vec3(-.38,.62,.68));
    spec+=vec3(1.,.995,.98)*pow(max(dot(R,key),0.),42.)*.9*liquid;
    /* the dark band a drop shows just inside its rim, where it bends in the far dark water */
    float edge=1.-NdV;
    color*=1.-liquid*uFxLens.y*smoothstep(.12,.6,edge)*(1.-.55*smoothstep(.82,1.,edge));
    spec+=env*liquid*uFxLens.z*.25*pow(edge,3.);
    vec3 focus=normalize(-key-V*1.35);
    color+=mix(vec3(1.),tint,.4)*pow(max(dot(N,focus),0.),7.)*uFxLook.y*liquid;
    #ifdef FX_GLACIER
    color=mix(glacierSurface(color,N,V,NdV,R,gObj,-1.,-1.,vec3(0.)),glacierSurface(color,N,V,NdV,R,gObj,gInner,gFace,gOut),formed);
    #endif
    color*=exp(-vec3(.085,.027,.012)*pow(1.-NdV,1.6));
    color+=min(spec,vec3(uSpecCap));
    /* the glint that crosses it as it sets */
    if(uFxWave.w>.001){float fb=(p.x*.8+p.y*.6)-uFxWave.z,gl=exp(-fb*fb/.005),sh=exp(-fb*fb/.04);color=color*(1.-.28*uFxWave.w*(sh-gl))+vec3(.95,.98,1.)*uFxWave.w*gl*(.45+.55*pow(1.-NdV,2.));}
    /* where the water really is, so the sea hides what is still under it */
    vec4 clip=projectionMatrix*viewMatrix*vec4(Pw,1.);
    gl_FragDepth=clamp(clip.z/clip.w*.5+.5,0.,1.);
    gl_FragColor=vec4(color,cover*uFxAlpha*uOpacity);
  }
`;

export function createLetterWaterFx(THREE, { group, glassMaterial, blueMaterial, config, lite = false, seaLevel = () => 0, onSplash = null }) {
  const N = 8, STEPS = lite ? 30 : 46;
  const box = new THREE.BoxGeometry(2, 2, 2);
  const shared = { uFxPix: { value: .001 }, uFxTime: { value: 0 } };
  const blueDefaults = {
    uBlueA: { value: new THREE.Color('#00a0e9') }, uBlueB: { value: new THREE.Color('#0068b7') },
    uBlueBox: { value: new THREE.Vector4(-1, 1, -1, 1) }, uBlueDensity: { value: 0 }, uBlueGlow: { value: 0 }, uBlueMirror: { value: 0 }
  };
  const viewport = new THREE.Vector4();
  const fragmentShader = fxFragment(STEPS, glassMaterial.userData?.glacierGlsl || '');
  let items = [], last = 0, dt = 1 / 60, now = 0, sea = 0, splashes = 0;
  const clamp01 = x => Math.min(1, Math.max(0, x));
  const ease = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), vel = new THREE.Vector3();
  const world = new THREE.Matrix4(), wpos = new THREE.Vector3(), wquat = new THREE.Quaternion(), wscl = new THREE.Vector3();
  const up = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), foot = new THREE.Vector3(), tmp = new THREE.Vector3();
  const setPix = (renderer, scene, camera) => {
    renderer.getCurrentViewport(viewport);
    shared.uFxPix.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov || 40) * .5) / Math.max(1, viewport.w);
  };

  /* Where the water lands on a letter (CONDENSE): spread over its face — the
     centroids of the front cap's triangles, farthest-point sampled. */
  function seedsOf(letter) {
    const g = letter.geometry, P = g.attributes.position.array, Nn = g.attributes.normal?.array;
    const c = letter.center, points = [];
    for (const range of g.groups) for (let v = range.start; v < range.start + range.count; v += 3) {
      if (Nn && (Nn[v * 3 + 2] < .95 || Nn[v * 3 + 5] < .95 || Nn[v * 3 + 8] < .95)) continue;
      const ax = P[v * 3], ay = P[v * 3 + 1], bx = P[v * 3 + 3], by = P[v * 3 + 4], cx = P[v * 3 + 6], cy = P[v * 3 + 7];
      const area = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
      if (area < 1e-5) continue;
      points.push({ x: (ax + bx + cx) / 3 - c.x, y: (ay + by + cy) / 3 - c.y, area });
    }
    if (!points.length) return [{ x: 0, y: 0 }];
    const total = points.reduce((s, p) => s + p.area, 0);
    const count = Math.max(3, Math.min(6, Math.round(total * 40)));
    const chosen = [points.reduce((a, b) => (b.y - b.x * .2 < a.y - a.x * .2 ? b : a))];
    while (chosen.length < count) {
      let far = null, farD = -1;
      for (const p of points) {
        let d = Infinity;
        for (const q of chosen) d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y));
        if (d > farD) { farD = d; far = p; }
      }
      if (!far || farD < .05) break;
      chosen.push(far);
    }
    return chosen.sort((a, b) => a.y - b.y || a.x - b.x).map(p => ({ x: p.x, y: p.y }));
  }

  function make(letter, depth) {
    const own = {
      uFxGlyph: { value: letter.map }, uFxTile: { value: .5 / letter.tile }, uFxDepth: { value: depth },
      uFxAlpha: { value: 0 }, uFxBox: { value: new THREE.Vector3(1, 1, 1) }, uFxCenter: { value: letter.center },
      uFxUp: { value: new THREE.Vector3(0, 1, 0) },
      uFxShape: { value: new THREE.Vector4() }, uFxBlob: { value: new THREE.Vector4() }, uFxTail: { value: new THREE.Vector4() },
      uFxNeck: { value: new THREE.Vector4() }, uFxMound: { value: new THREE.Vector4() },
      uFxSeed: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
      uFxDrop: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
      uFxWave: letter.uniforms.uFxWave ?? { value: new THREE.Vector4() },
      uFxLook: { value: new THREE.Vector4() }, uFxMorph: { value: new THREE.Vector4(-1, 0, 1, 0) }, uFxLens: { value: new THREE.Vector3() }
    };
    const material = new THREE.ShaderMaterial({
      name: 'Logo letter ' + (letter.index + 1) + ' · water entrance',
      uniforms: { ...blueDefaults, ...(blueMaterial?.uniforms ?? {}), ...glassMaterial.uniforms, ...shared, ...own },
      vertexShader: FX_VERTEX, fragmentShader, transparent: true, depthWrite: false, depthTest: true
    });
    const mesh = new THREE.Mesh(box, material);
    mesh.name = 'Logo letter ' + (letter.index + 1) + ' · water';
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false;
    mesh.onBeforeRender = setPix;
    group.add(mesh);
    return {
      mesh, material, uniforms: own, depth, seeds: seedsOf(letter), blue: Boolean(letter.blueMaterial),
      state: { live: false, su: 0, sv: 0, seen: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rip: 99, formed: false, h: null }
    };
  }

  function build(letters, { depth }) {
    clear();
    for (const letter of letters) { letter.fx = make(letter, depth); items.push(letter); }
  }
  function clear() {
    for (const letter of items) { letter.fx?.mesh.removeFromParent(); letter.fx?.material.dispose(); letter.fx = null; }
    items = [];
  }
  function begin() {
    const t = performance.now() / 1000;
    dt = last ? Math.min(.05, Math.max(0, t - last)) : 1 / 60; last = t; now = t;
    shared.uFxTime.value = t % 1000;
    sea = typeof seaLevel === 'function' ? seaLevel() : seaLevel;
    group.updateWorldMatrix(true, false);
    for (const letter of items) if (letter.fx) letter.fx.mesh.visible = false;
  }

  /* One letter, this frame: U its flight (0–1), POSE its matrix in the letters'
     group (origin at the letter's centre), ALPHA its fade. Returns how much of the
     letter's own glass mesh to show (the water hands over to it as it sets). */
  function letter(item, u, pose, alpha, reducedMotion) {
    const P = item.fx;
    if (!P) return 1;
    const C = config, mode = Math.round(C.fxMode ?? 1), s = P.state, U = P.uniforms, wave = U.uFxWave.value;
    if (mode <= 0 || reducedMotion) { s.live = false; s.seen = false; s.h = null; wave.set(0, 0, 0, 0); return 1; }
    /* the spring: scroll says where, the water gets there in its own time */
    if (!s.live || Math.abs(u - s.su) > .45) { s.su = u; s.sv = 0; }
    const w = Math.max(1, C.fxSpring), z = THREE.MathUtils.clamp(1 - C.fxBounce, .12, 1.5);
    for (let rest = dt; rest > 1e-5; rest -= 1 / 120) {
      const h = Math.min(rest, 1 / 120);
      s.sv += (w * w * (u - s.su) - 2 * z * w * s.sv) * h; s.su += s.sv * h;
    }
    s.live = true;
    const su = s.su, energy = Math.min(1, Math.abs(s.sv) * 1.4);
    /* its speed, in its own frame, for the tear */
    pose.decompose(pos, quat, scl);
    if (s.seen && dt > 1e-4) vel.copy(pos).sub(s.pos).divideScalar(dt).applyQuaternion(quat.invert()).divideScalar(Math.max(1e-4, scl.x));
    else vel.set(0, 0, 0);
    s.pos.copy(pos); s.seen = true;
    s.vel.lerp(vel, 1 - Math.exp(-dt * 9));
    /* how high above the sea it is, in its own units, and which way is up for it */
    world.multiplyMatrices(group.matrixWorld, pose).decompose(wpos, wquat, wscl);
    const unit = Math.max(1e-4, wscl.x), h = (wpos.y - sea) / unit;
    up.set(0, 1, 0).applyQuaternion(wquat.invert());
    e1.set(1, 0, 0).addScaledVector(up, -up.x); if (e1.lengthSq() < 1e-4) e1.set(0, 0, 1).addScaledVector(up, -up.z); e1.normalize();
    e2.crossVectors(up, e1);
    foot.copy(up).multiplyScalar(-h);
    U.uFxUp.value.copy(up);
    const half = item.half, size = Math.max(half.x, half.y), R0 = C.fxBlob * size;
    const reachAll = Math.hypot(half.x, half.y) + .12;
    /* the sea, struck as it leaves (and again if it is scrolled back in) */
    if (s.h !== null && Math.sign(h) !== Math.sign(s.h) && Math.abs(h - s.h) < 2 && onSplash && C.fxSplash > 0 && ++splashes)
      onSplash(wpos.x, sea, wpos.z, C.fxSplash * (h > s.h ? 1 : .6) * (.55 + Math.min(.6, R0 * unit)));
    s.h = h;
    const k = ease(su, C.fxShapeStart, Math.max(C.fxShapeStart + .05, C.fxShapeEnd));
    const seeds = U.uFxSeed.value, drops = U.uFxDrop.value;
    for (let i = 0; i < N; i++) { seeds[i].set(0, 0, 0, 0); drops[i].set(0, 0, 0, 0); }
    let bx = half.x + .05, by = half.y + .05, bz = P.depth + .05;
    const grow = (x, y, zz, r) => { bx = Math.max(bx, Math.abs(x) + r + .04); by = Math.max(by, Math.abs(y) + r + .04); bz = Math.max(bz, Math.abs(zz) + r + .04); };
    const growV = (v, r) => grow(v.x, v.y, v.z, r);
    const R = mode === 2 ? size * .5 : R0;
    let slot = 0;
    U.uFxTail.value.set(0, 0, 0, 0); U.uFxNeck.value.set(0, 0, 0, 0); U.uFxMound.value.set(0, 0, 0, 0); U.uFxBlob.value.set(0, 0, 0, 0);
    /* The sea as it lets go: the surface heaves under it, a jet necks and pinches
       off (a droplet left to fall back), a crown of spray jumps and falls. All of
       it read off H, so scrolled back it plays in reverse. */
    const neckTop = R * Math.max(.2, C.fxNeck);
    if (mode !== 2 && h > -R * 1.2 && h < neckTop && C.fxNeck > 0) {
      const thin = clamp01((h + R) / (neckTop + R));
      tmp.copy(foot).addScaledVector(up, -R * .6);
      U.uFxNeck.value.set(tmp.x, tmp.y, tmp.z, R * .5 * Math.pow(1 - thin, .7));
      growV(tmp, R * .5);
    }
    if (mode !== 2 && h > neckTop && h < neckTop + R * 3) {
      /* what the pinch leaves behind falls back into the sea */
      const fall = (h - neckTop) / (R * 3);
      for (let i = 0; i < 2 && slot < N; i++, slot++) {
        tmp.copy(foot).addScaledVector(up, neckTop * (.42 - .14 * i) * (1 - fall * fall * 1.6) - R * .2 * fall).addScaledVector(e1, R * .12 * (i ? -1 : 1) * fall);
        const r = R * (.2 - .07 * i) * (1 - ease(fall, .7, 1));
        if (r > 1e-4) { drops[slot].set(tmp.x, tmp.y, tmp.z, r); growV(tmp, r); }
      }
    }
    const crown = Math.min(N - slot, Math.round(C.fxDroplets));
    const c = (h + R * .6) / (R * 3.2);
    if (crown > 0 && c > 0 && c < 1 && C.fxCrown > 0) {
      for (let i = 0; i < crown; i++, slot++) {
        const th = i / crown * Math.PI * 2 + item.index * 1.7 + hash(i * 4.1 + item.index) * .8;
        const jump = (.7 + .5 * hash(i * 2.3 + item.index * 3.1)) * C.fxCrown;
        const cc = clamp01(c * (1.1 - .2 * hash(i * 6.7)));
        tmp.copy(foot).addScaledVector(e1, Math.cos(th) * R * (1.05 + 1.5 * cc)).addScaledVector(e2, Math.sin(th) * R * (1.05 + 1.5 * cc))
          .addScaledVector(up, 4 * cc * (1 - cc) * R * 1.5 * jump - R * .15);
        const r = R * (.13 + .08 * hash(i * 8.9 + item.index)) * Math.pow(Math.sin(Math.PI * cc), .4);
        if (r > 1e-4) { drops[slot].set(tmp.x, tmp.y, tmp.z, r); growV(tmp, r); }
      }
    }
    if (C.fxMound > 0 && h > -R * 1.5 && h < R * 2.6) {
      const heave = Math.sin(Math.PI * clamp01((h + R * 1.5) / (R * 4.1)));
      const m = R * C.fxMound * heave;
      if (m > 1e-3) { tmp.copy(foot).addScaledVector(up, -m * .42); U.uFxMound.value.set(tmp.x, tmp.y, tmp.z, m); grow(tmp.x, tmp.y, tmp.z, m * 2.5); }
    }
    if (mode === 2) {
      /* CONDENSE: spray leaps out of the sea with the letter and rides along with it, a
         loose cloud round where it will be; then each droplet runs onto its own stroke
         and spreads there as a pool, until the pools meet. */
      U.uFxMorph.value.set(-1, 0, 1, 0);
      const list = P.seeds, n = Math.min(list.length, N - slot);
      const out = clamp01((h + R) / (R * 2.2));
      for (let i = 0; i < n; i++, slot++) {
        const a = list[i], d0 = i / n * .3, fly = ease(k, d0, d0 + .4), r = (.075 + .03 * hash(i * 7.1 + item.index)) * Math.min(1.2, size / .35);
        const th = i * 2.39996 + item.index * 1.7 + (1 - fly) * 1.4 * (i % 2 ? 1 : -1) + now * .45 * (1 - fly);
        const far = size * (1.15 + .45 * hash(i * 3.3 + item.index * 5.1)) * (1 - fly) * (.55 + .45 * out);
        const x = a.x * (.35 + .65 * fly) + Math.cos(th) * far;
        const y = a.y * (.35 + .65 * fly) + Math.sin(th) * far * .8 - (1 - out) * R * 1.4;
        const zz = (hash(i * 9.7 + item.index) - .5) * far * .7;
        const rr = r * ease(out, 0, .6) * (1 - ease(k, .86, .99));
        if (rr > 1e-4) { drops[slot].set(x, y, zz, rr); grow(x, y, zz, rr); }
        if (fly >= .92) seeds[i].set(a.x, a.y, 0, r * .9 + Math.pow(ease(k, d0 + .38, 1), 1.25) * reachAll);
      }
      if (k >= .999) seeds[0].set(0, 0, 0, 10);
    } else {
      /* DROP: the drop itself, drawn into a tear by its speed, turning into the letter */
      U.uFxBlob.value.set(0, 0, 0, R0);
      U.uFxMorph.value.set(k, .5, reachAll, 0);
      grow(0, 0, 0, R0);
      const sp = s.vel.length();
      if (sp > 1e-3 && C.fxTail > 0 && k < 1 && h > neckTop) {
        const len = Math.min(R0 * .9, sp * C.fxTail * .09) * (1 - k);
        const tx = -s.vel.x / sp * len, ty = -s.vel.y / sp * len, tz = -s.vel.z / sp * len;
        U.uFxTail.value.set(tx, ty, tz, R0 * .42);
        grow(tx, ty, tz, R0 * .5);
      }
    }
    /* the moment it sets: a ripple out across its face, a glint across it */
    const formedNow = k >= .97;
    if (formedNow && !s.formed) s.rip = 0;
    s.formed = formedNow;
    s.rip = Math.min(99, s.rip + dt);
    const ring = s.rip, glide = clamp01(ring / .6);
    wave.set(.04 + ring * .7, C.fxRipple * .32 * Math.exp(-ring * 2.4) * ease(ring, 0, .06) * (ring < 3 ? 1 : 0),
      THREE.MathUtils.lerp(-reachAll, reachAll, glide), glide < 1 ? C.fxGlint * Math.sin(Math.PI * glide) : 0);
    const meshShare = ease(k, .9, .99);
    const water = (1 - ease(k, .96, 1)) * alpha;
    /* still deep under the sea, which is opaque: nothing to draw */
    if (water < .002 || h < -(R * 1.6 + Math.max(bx, by, bz) + .3)) return meshShare;
    U.uFxShape.value.set(k, THREE.MathUtils.lerp(C.fxRound, .01, ease(k, .5, 1)), THREE.MathUtils.lerp(C.fxMelt, .006, ease(k, .6, 1)),
      C.fxWobble * (1 - ease(k, .75, 1)) * (.45 + energy));
    U.uFxLook.value.set(P.blue ? (C.fxDye > 0 ? THREE.MathUtils.lerp(1 - C.fxDye, 1, ease(k, .35, .95)) : 1) : 0, C.fxCaustic,
      THREE.MathUtils.lerp(.1, .012, ease(k, .7, 1)), 1 - ease(k, .55, 1));
    U.uFxLens.value.set(C.fxLens, C.fxRim, C.fxWindows);
    U.uFxAlpha.value = water;
    U.uFxBox.value.set(bx, by, bz);
    P.mesh.matrix.copy(pose); P.mesh.matrixWorldNeedsUpdate = true;
    P.mesh.visible = true;
    return meshShare;
  }

  return {
    build, clear, begin, letter,
    get items() { return items; }, get splashes() { return splashes; },
    dispose() { clear(); box.dispose(); }
  };
}
