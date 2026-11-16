/* Flow2 · the forest view's AIR (2026-11-15). Loaded by prototypes/index1-5-flow/flow2-forest-atlas.js only.
   Pass 1 (third team, D2): three thin lit sheets + low mist + the clouds' shadow map. Pass 2 (AIR2, same evening; client:
   「你看一下人家的海鷗 跟雲層還有精細感」 = thick, soft, white-grey cloud banks drifting low over the land in several layers):
   - FINE PASS (same evening, client: 「整體細節還是不太夠 雲朵太假太濃 所有精細度還要再加5倍」): thin, mostly see-through air at the frame's
     edges and corners, never a blanket. Layers at real heights above the land (y = water 0.105, land top ≈ 1): a low VEIL 1.25 (threads drawn
     out along the wind), small PUFFS 2.0 (a soft relief lit from the plate's sun, upper left; at most ~74 % opaque), WISPS 3.0 (threads), a
     faint high veil 4.4 (off by default: dial 「高空薄紗」). Four noise octaves eat every rim (billows, wisps, threads, the finest breakup), drawn
     at FULL resolution (dial `res`). The lens tilts, so the layers slide over each other and over the land (parallax); one wind moves them all.
   - WHERE THE CLOUDS STAND is fixed in the world but laid out for the lens at REST (fore 9.8°, the confirmed composition): six banks and a
     ramp along the frame's edges, three islands riding the wind along the top and bottom; kept open in the ground plane: the lake, the four
     labels, the four rivers' mouths (a small map painted here once); kept off on the screen: the title block, the four labels (followed live),
     the logo, the buttons, the two side rails, the drag hint. Cover and keep are worked out per vertex of a dense grid, so the clear middle
     costs almost nothing; the rim round the interface wobbles with the cloud's own noise (never a straight cut).
   - Drawn into a target of this module's own and laid over the scene by ONE full-screen quad in `group` (premultiplied; the atlas's darker
     lower half is lifted back for the clouds: `lift`). GPU: ≈ 0.25 ms for the layers + shadow map at 2820 × 1395 (timer query, 2026-11-15).
   - THE SHADOW MAP (512 × 328, world x/z, every second frame) holds the same puffs and threads seen from the sun (shift × `reach`), plus the
     birds' small soft shadows (flow2-scene-birds.js writes window.__FLOW2_FOREST_AIR__.spots). The land material reads it through
     window.__FLOW2_FOREST_AIR__.glsl (forestAirShadow / forestAir: unchanged interface); without that, a multiply sheet lays it on.
   Nothing here is loaded from anywhere: one noise picture is baked on the graphics card at load (tileable, mip-mapped) and only read
   afterwards, so nothing crawls or flickers. Reduce motion: the air stands still.
   Tiers (window.__FLOW2_QUALITY__.rank): 2 high = all layers, full resolution; 1 medium = no high veil, 0.7 resolution, map every third
   frame; 0 low = nothing (the plain picture).
   Interface (unchanged): createForestAir(renderer, { reducedMotion, atlas, shared, tune }) → { group, tune, state, uniforms, shared, warm(r),
   setTier(rank), setView(w, h), update(dt), render(r), dispose() }. Dials: panel 「森林雲霧」 (key A, rows in flow2-forest-atlas.js). */
import * as THREE from 'three';

const BAKE = `varying vec2 vUv;
  vec2 h22(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
  float worley(vec2 uv,float per,float seed){ vec2 p=uv*per,i=floor(p),f=fract(p); float d=1.;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y)); vec2 o=h22(mod(i+g,per)+seed); vec2 r=g+o-f; d=min(d,dot(r,r)); }
    return 1.-clamp(sqrt(d),0.,1.); }
  float grad(vec2 i,vec2 f,vec2 o,float per,float seed){ return dot(h22(mod(i+o,per)+seed)*2.-1.,f-o); }
  float gnoise(vec2 uv,float per,float seed){ vec2 p=uv*per,i=floor(p),f=fract(p); vec2 u=f*f*f*(f*(f*6.-15.)+10.);
    return mix(mix(grad(i,f,vec2(0.,0.),per,seed),grad(i,f,vec2(1.,0.),per,seed),u.x),mix(grad(i,f,vec2(0.,1.),per,seed),grad(i,f,vec2(1.,1.),per,seed),u.x),u.y); }
  void main(){
    float P=.5+.9*(gnoise(vUv,4.,1.)*.55+gnoise(vUv,8.,2.)*.28+gnoise(vUv,16.,3.)*.17);
    float W=worley(vUv,4.,11.)*.6+worley(vUv,8.,12.)*.27+worley(vUv,16.,13.)*.13;
    float R=clamp(W*.62+P*.62-.12,0.,1.);                                              /* the clouds' body: billows on a slow swell */
    float G=worley(vUv,8.,21.)*.55+worley(vUv,16.,22.)*.3+worley(vUv,32.,23.)*.15;     /* what eats the rim */
    float B=worley(vUv,16.,31.)*.5+worley(vUv,32.,32.)*.3+worley(vUv,64.,33.)*.2;      /* fine wisps */
    float A=.5+1.1*(gnoise(vUv,3.,41.)*.5+gnoise(vUv,6.,42.)*.27+gnoise(vUv,12.,43.)*.15+gnoise(vUv,24.,44.)*.08);   /* smooth: the mist, the warp */
    gl_FragColor=vec4(R,G,B,clamp(A,0.,1.)); }`;

/* the clouds: where they may stand (cover) and their density (shared by the layers and the shadow map: the shadow belongs to its cloud).
   Layer i: uAirL[i] = (scale per world unit, wind factor, erosion, warp), uAirS[i] = (height, thickness, amount, cover shift) */
const CLOUD = `
  uniform sampler2D uAirNoise, uAirClear; uniform mat4 uAirRestVP;
  uniform vec4 uAirBox, uAirEye, uAirFrame, uAirBank[6], uAirIsle[3], uAirL[4], uAirS[4];
  uniform vec2 uAirWind, uAirSunXZ; uniform float uAirTime, uAirCover;
  float airCover(vec3 p){
    vec4 c=uAirRestVP*vec4(p,1.); vec2 n=c.xy/max(c.w,.001), asp=vec2(uAirEye.w,1.);
    float f=uAirFrame.w;                                                               /* the thin scatter inside */
    for(int i=0;i<6;i++){ vec2 d=(n-uAirBank[i].xy)*asp/uAirBank[i].z; f+=uAirBank[i].w*exp(-dot(d,d)); }
    vec2 e=abs(n);
    f+=max(smoothstep(uAirFrame.x,1.2,e.x),smoothstep(uAirFrame.x+.1,1.25,e.y)*.8)*uAirFrame.y;   /* the frame's edges (rest lens) */
    for(int i=0;i<3;i++){ vec2 d=(p.xz-uAirIsle[i].xy)/uAirIsle[i].z; f+=uAirIsle[i].w*exp(-dot(d,d)); }   /* islands drifting over the forest (world) */
    vec2 t=(n-vec2(0.,-.56))*asp/vec2(1.05,.5); f*=.12+.88*smoothstep(.62,1.12,length(t));      /* the title block stays open */
    vec2 g=uAirEye.xz+(p.xz-uAirEye.xz)*((uAirEye.y-.3)/max(uAirEye.y-p.y,.5));                 /* the ground point below it, as the rest lens sees it */
    float open=texture2D(uAirClear,(g-uAirBox.xy)*uAirBox.zw).r;
    return clamp(f*uAirCover,0.,1.)*(1.-open);
  }
  vec2 airQ(vec3 p,vec4 L,vec2 seed){ return (p.xz-uAirWind*uAirTime*L.y)*L.x+seed; }
  vec2 airWarp(vec2 q){ return vec2(texture2D(uAirNoise,q*.43+vec2(.17,.53)).a,texture2D(uAirNoise,q*.39+vec2(.61,.29)).a)-.5; }
  float airBase(float b,float cov){ return clamp((b-(1.-cov))/max(cov,.12),0.,1.); }
  float airDens(vec2 q,float cov,float ero){
    float d=airBase(texture2D(uAirNoise,q).r,cov);
    float e=texture2D(uAirNoise,q*2.63+vec2(uAirTime*.001,-uAirTime*.0006)).g;
    float w=texture2D(uAirNoise,q*5.9-vec2(uAirTime*.0008,0.)).b;
    float f=texture2D(uAirNoise,mat2(.8,.6,-.6,.8)*q*12.7+vec2(.31,.77)).b;          /* the finest breakup, turned so no grid lines up */
    float k=((1.-e)*.62+(1.-w)*.42+(1.-f)*.3)*ero;
    return clamp((d-k*(1.-d*.45))/max(1.-k*.4,.2),0.,1.);                             /* the rim eaten into billows, wisps and threads */
  }
  /* coordinates along / across the wind, stretched: veils and wisps drawn out by the wind */
  vec2 airFiber(vec3 p,vec4 L,vec2 stretch,vec2 seed){ vec2 wd=normalize(uAirWind+vec2(1e-5,0.)), r=p.xz-uAirWind*uAirTime*L.y;
    return vec2(dot(r,wd),dot(r,vec2(-wd.y,wd.x)))*L.x*stretch+seed; }`;

/* what the scene's own material may add (window.__FLOW2_FOREST_AIR__.glsl): one read of the map (unchanged since pass 1) */
export const AIR_GLSL = `
  uniform sampler2D uAirShadowMap; uniform vec4 uAirRect; uniform vec3 uAirShadow;
  float forestAirShadow(vec2 xz){ return texture2D(uAirShadowMap,(xz-uAirRect.xy)*uAirRect.zw).r; }
  vec3 forestAir(vec3 c,vec2 xz){ return c*mix(vec3(1.),vec3(.56,.63,.72),forestAirShadow(xz)*uAirShadow.x); }`;

const VERT_SCREEN = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
const VERT_WORLD = 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }';

/* places of the screen the clouds keep clear of (the page's interface): centre x, y (screen shares, y from the top), half width, half height;
   uAirKeepW = (soft margin in screen heights, strength) */
const KEEP_N = 10;
const KEEP_S = `uniform vec2 uAirRes; uniform vec4 uAirKeep[${KEEP_N}]; uniform vec2 uAirKeepW[${KEEP_N}]; uniform float uAirKeepAll;
  /* rounded boxes (corner radius 0.8 × the short half side), their rim wobbled by the cloud's own world-fixed warp (off): the clouds
     retreat from the interface along soft, irregular edges, never along a straight line */
  float airKeepS(vec2 s){ vec2 asp=vec2(uAirRes.x/uAirRes.y,1.); float k=0.;
    for(int i=0;i<${KEEP_N};i++){ vec4 b=uAirKeep[i]; if(b.z<=0.) continue;
      vec2 h=b.zw*asp; float r=min(h.x,h.y)*.8; vec2 d=abs(s-b.xy)*asp-h+r;
      float dist=length(max(d,0.))+min(max(d.x,d.y),0.)-r;
      k=max(k,(1.-smoothstep(-.02,uAirKeepW[i].x,dist))*uAirKeepW[i].y); }
    return 1.-k*uAirKeepAll; }
`;
const KEEP = KEEP_S + `
  float airKeepAt(vec2 off){ vec2 s=gl_FragCoord.xy/uAirRes; s.y=1.-s.y; return airKeepS(s+off); }
  float airKeep(){ return airKeepAt(vec2(0.)); }`;

/* the layers' vertex shader: where clouds may stand (cover) and how far the interface keeps them off (keep), both per vertex of a dense grid */
const VERT_LAYER = `varying vec3 vW; varying float vCov, vKeep; ${CLOUD} ${KEEP_S}
  void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vCov=airCover(vW); gl_Position=projectionMatrix*viewMatrix*w;
    vec2 s=gl_Position.xy/max(gl_Position.w,1e-4)*.5+.5; s.y=1.-s.y; vKeep=airKeepS(s); }`;

export function createForestAir(renderer, options = {}) {
  const reduced = !!options.reducedMotion, atlas = options.atlas || {}, shared = options.shared || { uniforms: {} };
  const land = options.rect || { x: -7, z: -3.917, w: 14, d: 7.834 };            // the plate's footprint (world x / z)
  const M = 1.6, box = { x: land.x - M, z: land.z - M, w: land.w + 2 * M, d: land.d + 2 * M };   // the shadow map reaches past the frame
  const DEFAULTS = { clouds: 1, banks: 1, billows: 1, high: 0, mist: 1, inner: 1, thick: 1, height: 1, erosion: 1, bright: 1, shadeCol: '#b2bfcc',
    shadow: 1, strength: .4, reach: .55, wind: 1, windAngle: -14, sunAngle: 149, keepUI: 1, lift: 1, res: 1, isles: 1 };
  const tune = options.tune || {};
  for (const k in DEFAULTS) if (typeof DEFAULTS[k] === 'string' ? typeof tune[k] !== 'string' : !Number.isFinite(+tune[k])) tune[k] = DEFAULTS[k];   // the caller's object (the panel's dials) stays the live one
  const state = { stage: 'new', tier: 2, bakeMs: 0, map: '', sheets: 0, cloudRT: '', version: 'air2-fine-2' };
  const camera = options.camera || atlas.camera;

  /* ---------------------------------------------------------------- where the clouds keep open, in the ground plane (painted once) */
  const CW = 256, CH = Math.round(256 * box.d / box.w), clearPix = new Uint8Array(CW * CH * 4);
  function paintClear() {
    const lake = atlas.lake?.center ? [atlas.lake.center.x, atlas.lake.center.z] : [.12, -.056];
    const spots = [[lake[0], lake[1], 3.0, 1.75, 1.15]];                                  // x, z, radius x, radius z, weight: the lake (wide east-west)
    (atlas.anchors || []).forEach(a => spots.push([a.x, a.z, 1.05, .95, 1.1]));         // the four points and their labels
    (atlas.rivers || []).forEach(r => {
      if (r.mouth) spots.push([r.mouth.x, r.mouth.z, .9, .9, 1]);                       // the mouths
      const P = r.points || [], n = P.length;                                          // the last third of each river, lightly
      for (let i = Math.floor(n * .62); i < n; i += Math.max(1, Math.round(n / 14))) spots.push([P[i].x, P[i].z, .55, .55, .55]);
    });
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
      const x = box.x + (i + .5) / CW * box.w, z = box.z + (j + .5) / CH * box.d; let s = 0;
      for (const [sx, sz, rx, rz, w] of spots) { const dx = (x - sx) / rx, dz = (z - sz) / rz; s += w * Math.exp(-(dx * dx + dz * dz)); }
      const t = Math.min(1, Math.max(0, (s - .12) / .7)), o = (j * CW + i) * 4;
      clearPix[o] = 255 * t * t * (3 - 2 * t); clearPix[o + 3] = 255;
    }
  }
  paintClear();
  const clearTex = new THREE.DataTexture(clearPix, CW, CH, THREE.RGBAFormat, THREE.UnsignedByteType);
  clearTex.minFilter = clearTex.magFilter = THREE.LinearFilter; clearTex.wrapS = clearTex.wrapT = THREE.ClampToEdgeWrapping; clearTex.needsUpdate = true;

  /* ---------------------------------------------------------------- the noise picture (baked once), the shadow map, the clouds' own target */
  const NS = options.noiseSize || 1024;
  const noise = new THREE.WebGLRenderTarget(NS, NS, { type: THREE.UnsignedByteType, depthBuffer: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true });
  noise.texture.name = 'forest air: noise';
  const FW = 512, FH = Math.round(512 * box.d / box.w);
  const field = new THREE.WebGLRenderTarget(FW, FH, { type: THREE.UnsignedByteType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  field.texture.name = 'forest air: shadow map'; state.map = FW + ' × ' + FH;
  const cloudRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  cloudRT.texture.name = 'forest air: clouds';
  const v4 = () => new THREE.Vector4();
  /* the rest frame: six banks (rest-lens NDC x, y up; radius in frame heights; weight) — upper left, upper right, lower left, lower right, the
     left edge, the top edge (where the client's confirmed picture already had its white mist, now thick) */
  /* the layers' look: thread stretch (along, across the wind), noise seed, most opacity a layer reaches, cover shift, colour */
  const LAY = [{ stretch: [.45, 1.5], seed: [.21, .63], maxA: .36, shift: -.04, col: '#f1f5f6' }, { stretch: [1, 1], seed: [0, 0], maxA: .74, shift: 0, col: '#ffffff' },
    { stretch: [.4, 1.6], seed: [.37, .71], maxA: .34, shift: -.05, col: '#f6f8f9' }, { stretch: [.5, 1.3], seed: [.53, .19], maxA: .16, shift: .05, col: '#f6f8f9' }];
  /* three cloud islands (world x, z, radius, weight): two along the top of the frame, one along the bottom; they ride the wind east, thin out
     over the labels and under the title and gather again past them (the cover's clear places do that) */
  const ISLES = [[-2.3, -2.55, .7, .55], [2.3, -2.75, .65, .5], [-2.6, 2.75, .7, .52]];
  const BANKS = [[-.9, .52, .5, 1], [1.0, .92, .52, .95], [-.98, -.96, .55, 1], [1.02, -.9, .5, .92], [-1.12, -.12, .38, .45], [.32, 1.2, .36, .45]];
  const U = {
    uAirNoise: { value: noise.texture }, uAirClear: { value: clearTex },
    uAirBox: { value: new THREE.Vector4(box.x, box.z, 1 / box.w, 1 / box.d) },
    uAirRestVP: { value: new THREE.Matrix4() }, uAirEye: { value: new THREE.Vector4(0, 24.8, 4.3, 2) },
    uAirFrame: { value: new THREE.Vector4(.72, .5, 1, .15) },                         // edge ramp start, edge weight, (unused), inner scatter
    uAirBank: { value: BANKS.map(b => new THREE.Vector4(...b)) }, uAirIsle: { value: [v4(), v4(), v4()] },
    uAirL: { value: [v4(), v4(), v4(), v4()] }, uAirS: { value: [v4(), v4(), v4(), v4()] },
    uAirWind: { value: new THREE.Vector2() }, uAirSunXZ: { value: new THREE.Vector2() },
    uAirTime: { value: 0 }, uAirCover: { value: 1 },
    uAirRes: { value: new THREE.Vector2(1, 1) },
    uAirKeep: { value: Array.from({ length: KEEP_N }, v4) }, uAirKeepW: { value: Array.from({ length: KEEP_N }, () => new THREE.Vector2()) }, uAirKeepAll: { value: 1 },
    uAirSpot: { value: Array.from({ length: 8 }, v4) },
    uAirSun: { value: new THREE.Vector2(-.86, -.51) }                                  // toward the sun on the ground (x east, z south): upper left
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null), screenScene = new THREE.Scene(), screenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quad.frustumCulled = false; screenScene.add(quad);
  const bakeMat = new THREE.ShaderMaterial({ vertexShader: VERT_SCREEN, fragmentShader: BAKE, depthTest: false, depthWrite: false });
  /* the shadow map: per ground point, the clouds that stand between it and the sun (each layer at its height, the shift × reach) + the birds */
  const fieldMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uReach: { value: tune.reach }, uSpots: { value: 0 }, uMaxA: { value: new THREE.Vector4() }, uShiftL: { value: new THREE.Vector4() },
      uSt0: { value: new THREE.Vector2(...LAY[0].stretch) }, uSt2: { value: new THREE.Vector2(...LAY[2].stretch) }, uSeed0: { value: new THREE.Vector2(...LAY[0].seed) }, uSeed2: { value: new THREE.Vector2(...LAY[2].seed) } },
    vertexShader: VERT_SCREEN, depthTest: false, depthWrite: false,
    fragmentShader: `varying vec2 vUv; uniform float uReach, uSpots; uniform vec4 uAirSpot[8], uMaxA, uShiftL; uniform vec2 uSt0, uSt2, uSeed0, uSeed2; ${CLOUD}
      vec3 lift(vec2 g,float h){ vec3 p=vec3(g.x,h,g.y); p.xz+=uAirSunXZ*(h-.35)*uReach; return p; }
      float puffA(vec2 g){ vec4 L=uAirL[1], S=uAirS[1]; if(S.z<.01) return 0.; vec3 p=lift(g,S.x);
        float cov=clamp(airCover(p)*S.w,0.,1.)*S.z; if(cov<.02) return 0.;
        vec2 q=airQ(p,L,vec2(0.)); q+=airWarp(q)*L.w; return uMaxA.y*(1.-exp(-airDens(q,cov,L.z*(1.4-.6*cov))*S.y)); }
      float fibA(vec2 g,vec4 L,vec4 S,vec2 st,vec2 seed,float shift,float maxA){ if(S.z<.01) return 0.; vec3 p=lift(g,S.x);
        float cov=clamp(airCover(p)*S.w+shift,0.,1.)*S.z; if(cov<.02) return 0.;
        vec2 q=airFiber(p,L,st,seed); q+=airWarp(q*.5)*L.w; return maxA*(1.-exp(-airDens(q,cov,L.z*(1.4-.6*cov))*S.y)); }
      void main(){ vec2 g=uAirBox.xy+vUv/uAirBox.zw;
        float lit=(1.-puffA(g))*(1.-fibA(g,uAirL[0],uAirS[0],uSt0,uSeed0,uShiftL.x,uMaxA.x)*.6)*(1.-fibA(g,uAirL[2],uAirS[2],uSt2,uSeed2,uShiftL.z,uMaxA.z)*.7);
        float sh=1.-lit, b=0.;
        if(uSpots>.5) for(int i=0;i<8;i++){ vec4 s=uAirSpot[i]; if(s.w<=0.) continue;
          vec2 c=s.xz-uAirSunXZ*(s.y-.4); vec2 d=(g-c)/s.w; b=max(b,exp(-dot(d,d))); }
        gl_FragColor=vec4(max(sh,b*.42),sh,b,1.); }`
  });
  fieldMat.toneMapped = bakeMat.toneMapped = false;
  shared.uniforms.uAirShadowMap = shared.uniforms.uAirShadowMap || { value: null };
  shared.uniforms.uAirRect = shared.uniforms.uAirRect || { value: null };
  shared.uniforms.uAirShadow = shared.uniforms.uAirShadow || { value: null };
  shared.uniforms.uAirShadowMap.value = field.texture;
  shared.uniforms.uAirRect.value = U.uAirBox.value;
  shared.uniforms.uAirShadow.value = new THREE.Vector3(tune.strength, 0, 0);
  const glsl = shared.glsl || AIR_GLSL; shared.glsl = glsl;

  /* ---------------------------------------------------------------- the layers (drawn into cloudRT, lowest first, premultiplied) */
  const cloudScene = new THREE.Scene(); cloudScene.name = 'Forest air: layers';
  /* each layer is a dense grid (34 × 30 world units, 0.33-unit cells): where the clouds may stand is worked out per vertex (it changes slowly),
     so the clear middle of the frame costs almost nothing per pixel */
  const sheetGeo = y => { const g = new THREE.PlaneGeometry(34, 30, 104, 92); g.rotateX(-Math.PI / 2); g.translate(0, y, 4); return g; };
  const premul = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide };
  const layers = [];
  const layer = (index, order, fragmentShader, extra = {}) => {
    const material = new THREE.ShaderMaterial({ ...premul, uniforms: { ...U, ...extra }, defines: { AIR_LAYER: index }, vertexShader: VERT_LAYER, fragmentShader });
    material.toneMapped = false;
    const mesh = new THREE.Mesh(sheetGeo(1), material); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.matrixAutoUpdate = false;
    cloudScene.add(mesh); layers[index] = mesh; return mesh;
  };
  /* 0 low veil, 2 wisps, 3 high veil: thin threads drawn out along the wind, mostly see-through */
  const FIBRE = `varying vec3 vW; varying float vCov, vKeep; uniform vec3 uCol; uniform vec2 uStretch, uSeed; uniform float uMaxA, uShift; ${CLOUD} ${KEEP}
    void main(){ vec4 L=uAirL[AIR_LAYER], S=uAirS[AIR_LAYER];
      float cov=clamp(vCov*S.w+uShift,0.,1.)*S.z; if(cov<.02) discard;
      vec2 q=airFiber(vW,L,uStretch,uSeed), w=airWarp(q*.5); q+=w*L.w;
      float keep=clamp(vKeep+(w.x+w.y)*.35*(1.-vKeep)*vKeep*4.,0.,1.); if(keep<.01) discard;   /* the rim round the interface wobbles with the cloud */
      cov*=mix(1.,keep,.5);
      float d=airDens(q,cov,L.z*(1.4-.6*cov)); if(d<.003) discard;
      float a=uMaxA*(1.-exp(-d*S.y))*smoothstep(0.,.7,keep); if(a<.002) discard;
      gl_FragColor=vec4(uCol*(.9+.1*d)*a,a); }`;
  /* 1 · small puffs: a soft relief lit from the upper left, bright on the sun side, a cool grey behind, never opaque */
  const PUFF = `varying vec3 vW; varying float vCov, vKeep; uniform vec3 uSunCol, uShadeCol; uniform float uBright, uRelief, uMaxA; ${CLOUD} ${KEEP}
    float airTop(vec2 q,float cov,float ero){ float d=airBase(texture2D(uAirNoise,q).r,cov);
      float e=texture2D(uAirNoise,q*2.63+vec2(uAirTime*.001,-uAirTime*.0006)).g; float k=(1.-e)*.62*ero;
      d=clamp((d-k*(1.-d*.45))/max(1.-k*.4,.2),0.,1.); return d+(e-.55)*.3*smoothstep(.1,.6,d); }
    void main(){ vec4 L=uAirL[1], S=uAirS[1];
      float cov=clamp(vCov*S.w,0.,1.)*S.z; if(cov<.02) discard;
      vec2 q=airQ(vW,L,vec2(0.)), w=airWarp(q); q+=w*L.w;
      float keep=clamp(vKeep+(w.x+w.y)*.35*(1.-vKeep)*vKeep*4.,0.,1.); if(keep<.01) discard;
      cov*=mix(1.,keep,.5);
      float ero=L.z*(1.4-.6*cov), d=airDens(q,cov,ero); if(d<.003) discard;
      vec2 dq=normalize(uAirSunXZ)*L.x; float T=uRelief, tanE=1./max(length(uAirSunXZ),.2);
      float h0=airTop(q,cov,ero), h1=airTop(q+dq*.035,cov,ero), h2=airTop(q+dq*.09,cov,ero);   /* three reliefs: here, one and two steps toward the sun */
      float occ=max(0.,(h1-h0)*T-.035*tanE)+max(0.,(h2-h0)*T-.09*tanE);
      float sun=exp(-occ*14.), slope=clamp((h0-h1)*T/.035,-1.2,1.2);
      float light=.5+.34*clamp(.6+.4*slope,0.,1.2)*sun+.14*d;
      vec3 col=mix(uShadeCol,uSunCol*uBright,clamp(light,0.,1.05));
      float a=uMaxA*(1.-exp(-d*S.y))*smoothstep(0.,.7,keep); if(a<.002) discard;
      gl_FragColor=vec4(col*a,a); }`;
  const fib = i => ({ uCol: { value: new THREE.Color(LAY[i].col) }, uStretch: { value: new THREE.Vector2(...LAY[i].stretch) }, uSeed: { value: new THREE.Vector2(...LAY[i].seed) }, uMaxA: { value: LAY[i].maxA }, uShift: { value: LAY[i].shift } });
  layer(0, 1, FIBRE, fib(0));
  layer(1, 2, PUFF, { uSunCol: { value: new THREE.Color('#fffdf8') }, uShadeCol: { value: new THREE.Color(tune.shadeCol) }, uBright: { value: 1 }, uRelief: { value: .45 }, uMaxA: { value: LAY[1].maxA } });
  layer(2, 3, FIBRE, fib(2));
  layer(3, 4, FIBRE, fib(3));
  state.sheets = layers.length;

  /* ---------------------------------------------------------------- what goes into the forest scene: the clouds laid over it, the shadow sheet */
  const group = new THREE.Group(); group.name = 'Forest air';
  const compMat = new THREE.ShaderMaterial({ ...premul, side: THREE.FrontSide, uniforms: { tAirClouds: { value: cloudRT.texture }, uLift: { value: tune.lift } }, vertexShader: VERT_SCREEN,
    /* the atlas's composite darkens the lower half for the title (up to 40 %, in display space): the clouds are lifted by as much so they stay white */
    fragmentShader: `varying vec2 vUv; uniform sampler2D tAirClouds; uniform float uLift;
      void main(){ vec4 c=texture2D(tAirClouds,vUv); float sh=smoothstep(.44,1.,1.-vUv.y)*.40*uLift;
        gl_FragColor=vec4(c.rgb*pow(1./(1.-sh),2.2),c.a); }` });
  compMat.toneMapped = false;
  const comp = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat); comp.frustumCulled = false; comp.renderOrder = 60; comp.name = 'Forest air: clouds over the scene'; group.add(comp);
  const shadeGeo = (() => { const g = new THREE.BufferGeometry(), x0 = box.x, x1 = box.x + box.w, z0 = box.z, z1 = box.z + box.d, y = .14;
    g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], 3)); g.setIndex([0, 2, 1, 0, 3, 2]); return g; })();
  const shadeMat = new THREE.ShaderMaterial({ vertexShader: VERT_WORLD, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uAirShadowMap: shared.uniforms.uAirShadowMap, uAirRect: shared.uniforms.uAirRect, uAirShadow: shared.uniforms.uAirShadow },
    fragmentShader: `varying vec3 vW; ${glsl} void main(){ gl_FragColor=vec4(forestAir(vec3(1.),vW.xz),1.); }`,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  const shade = new THREE.Mesh(shadeGeo, shadeMat); shade.frustumCulled = false; shade.renderOrder = 30; group.add(shade);

  /* ---------------------------------------------------------------- per frame */
  const restCam = new THREE.PerspectiveCamera(16, 2, 1, 120), restT = new THREE.Vector3(), restDir = new THREE.Vector3(), anchorP = new THREE.Vector3();
  let restKey = '', viewW = 1, viewH = 1;
  /* the lens at rest for this screen (the scene's composition: fore 9.8°, north up, distance = pose.rest) */
  function restLens() {
    if (!camera) return;
    const rest = +atlas.pose?.rest || 25, key = camera.aspect.toFixed(4) + '|' + camera.fov + '|' + rest.toFixed(3);
    if (key === restKey) return; restKey = key;
    restCam.fov = camera.fov; restCam.aspect = camera.aspect; restCam.near = camera.near; restCam.far = camera.far; restCam.updateProjectionMatrix();
    const portrait = camera.aspect < .85; restT.set(portrait ? .65 : 0, .105, 0); restDir.set(0, 1, Math.tan(9.8 * Math.PI / 180)).normalize();
    restCam.position.copy(restT).addScaledVector(restDir, rest); restCam.up.set(0, .3, -1).normalize(); restCam.lookAt(restT);
    if (portrait) restCam.rotateZ(Math.PI * .5);
    restCam.updateMatrixWorld(true);
    U.uAirRestVP.value.multiplyMatrices(restCam.projectionMatrix, restCam.matrixWorldInverse);
    U.uAirEye.value.set(restCam.position.x, restCam.position.y, restCam.position.z, camera.aspect);
  }
  /* the screen places kept clear (CSS px of the 1880 × 930 layout; labels followed live) */
  function keepUI() {
    const W = innerWidth || 1880, H = innerHeight || 930, K = U.uAirKeep.value, KW = U.uAirKeepW.value; let n = 0;
    const box = (cx, cy, hw, hh, soft, strength) => { if (n >= KEEP_N) return; K[n].set(cx / W, cy / H, hw / W, hh / H); KW[n].set(soft, strength); n++; };
    box(W / 2, H - 218, 400, 128, .09, .97);                                          // the title block
    box(122, 68, 92, 34, .1, .82);                                                    // the logo
    box(W - 160, 66, 150, 28, .1, .8);                                                // sound / menu
    box(112, H * .5, 92, 150, .1, .72);                                               // the chapter rail (left)
    box(W - 100, H * .484, 92, 172, .1, .72);                                         // the time / step column (right)
    box(W / 2, 114, 140, 14, .05, .55);                                               // the drag hint
    if (camera && atlas.anchors) atlas.anchors.forEach((a, k) => {                    // the four labels (same placement as the atlas's)
      anchorP.copy(a).project(camera);
      let x = (anchorP.x * .5 + .5) * W, y = (.5 - anchorP.y * .5) * H;
      x = Math.max(52, Math.min(W - 52, x)); y = Math.max(145, Math.min(H * .87, y));
      const side = W >= 760 ? (k === 1 ? -1 : 1) : (k === 0 || k === 3 ? 1 : -1);
      box(x + side * 88, y, 122, 36, .08, .9);
    });
    for (let i = n; i < KEEP_N; i++) K[i].set(0, 0, 0, 0);
  }
  /* the layer table: height, thickness, amount, cover factor; scale, wind, erosion, warp */
  function layersFromTune(tier) {
    const H = Math.max(.3, tune.height), th = Math.max(0, tune.thick), ero = Math.max(0, tune.erosion), on = tier > 0;
    const set = (i, h, scale, wind, er, warp, thick, amount, cover) => { U.uAirS.value[i].set(h, thick, amount, cover); U.uAirL.value[i].set(scale, wind, er * ero, warp); };
    set(0, 1.25, .16, .7, .7, .35, 1.6, on ? .9 * tune.mist : 0, .8);                       // low veil
    set(1, .105 + 1.9 * H, .3, 1, .5, .25, 2.6, on ? tune.banks : 0, .66);                    // small puffs
    set(2, .105 + 2.9 * H, .22, 1.2, .65, .3, 1.4, on ? tune.billows : 0, .62);              // wisps
    set(3, .105 + 4.3 * H, .09, 1.45, .55, .35, 1.2, on && tier > 1 ? tune.high : 0, .7);    // high veil
    for (let i = 0; i < 4; i++) {
      const m = layers[i], maxA = Math.min(.95, LAY[i].maxA * th);
      m.material.uniforms.uMaxA.value = maxA; fieldMat.uniforms.uMaxA.value.setComponent(i, maxA); fieldMat.uniforms.uShiftL.value.setComponent(i, LAY[i].shift);
      m.matrix.makeTranslation(0, U.uAirS.value[i].x - 1, 0); m.matrixWorld.copy(m.matrix); m.visible = U.uAirS.value[i].z > .005;
    }
  }

  let age = reduced ? 40 : 0, frame = 0, baked = false, tier = 2, spotsOn = false;
  const clearColor = new THREE.Color();
  function target(r, rt, fn) {
    const prev = r.getRenderTarget(), tone = r.toneMapping, auto = r.autoClear, alpha = r.getClearAlpha(); r.getClearColor(clearColor);
    try { r.toneMapping = THREE.NoToneMapping; r.autoClear = true; r.setClearColor(0x000000, 0); r.setRenderTarget(rt); fn(); }
    finally { r.setRenderTarget(prev); r.toneMapping = tone; r.autoClear = auto; r.setClearColor(clearColor, alpha); }
  }
  function bake(r) { if (baked) return; const t = performance.now(); quad.material = bakeMat; target(r, noise, () => r.render(screenScene, screenCam)); baked = true; state.bakeMs = +(performance.now() - t).toFixed(1); }
  function drawMap(r) { quad.material = fieldMat; target(r, field, () => r.render(screenScene, screenCam)); }
  function drawClouds(r) {
    if (!camera) return;
    const s = Math.min(1, Math.max(.25, tune.res * (tier > 1 ? 1 : .7))), w = Math.max(4, Math.round(viewW * s)), h = Math.max(4, Math.round(viewH * s));
    if (cloudRT.width !== w || cloudRT.height !== h) { cloudRT.setSize(w, h); state.cloudRT = w + ' × ' + h; }
    U.uAirRes.value.set(w, h);
    target(r, cloudRT, () => r.render(cloudScene, camera));
  }
  function readSpots() {
    const src = shared.spots, S = U.uAirSpot.value; spotsOn = false;
    for (let i = 0; i < 8; i++) {
      const o = i * 4;
      if (src && src.length >= o + 4 && src[o + 3] > 0) { S[i].set(src[o], src[o + 1], src[o + 2], src[o + 3]); spotsOn = true; } else S[i].set(0, 0, 0, 0);
    }
    fieldMat.uniforms.uSpots.value = spotsOn ? 1 : 0;
  }

  const api = {
    group, tune, state, uniforms: U, shared, layers, cloudScene,
    /* once, while the page prepares (never during a transition): the noise picture, the first map, the programs of every layer */
    warm(r) {
      bake(r); restLens(); keepUI(); api.update(0); drawMap(r);
      const vis = layers.map(m => m.visible); layers.forEach(m => { m.visible = true; });
      viewW = Math.max(viewW, 64); viewH = Math.max(viewH, 64); drawClouds(r);
      layers.forEach((m, i) => { m.visible = vis[i]; });
      state.stage = 'ready';
    },
    setTier(rank) { tier = rank; state.tier = rank; },
    setView(w, h) { viewW = w; viewH = h; },
    /* each frame, before the scene is drawn */
    update(dt, { drift = 1 } = {}) {
      if (!reduced) age += Math.min(dt, .05) * drift;
      const wa = tune.windAngle * Math.PI / 180, ws = .042 * tune.wind;
      U.uAirTime.value = age; U.uAirWind.value.set(Math.cos(wa) * ws, -Math.sin(wa) * ws);
      /* the islands ride the same wind (their cloud's noise moves with them); one that has left the land comes back on the far side */
      ISLES.forEach(([x, z, r, w], i) => { const span = box.w + 2 * r, dx = ((x - box.x + r + U.uAirWind.value.x * age) % span + span) % span + box.x - r;
        const spanZ = box.d + 2 * r, dz = ((z - box.z + r + U.uAirWind.value.y * age) % spanZ + spanZ) % spanZ + box.z - r;
        U.uAirIsle.value[i].set(dx, dz, r, w * tune.isles); });
      U.uAirCover.value = tune.clouds; U.uAirFrame.value.w = .15 * tune.inner; U.uAirKeepAll.value = Math.min(1, Math.max(0, tune.keepUI));
      const sunY = Math.min(.95, Math.max(.2, atlas.uniforms?.uSun?.value?.y ?? .6)), lean = Math.sqrt(1 - sunY * sunY) / sunY, a = tune.sunAngle * Math.PI / 180;
      U.uAirSun.value.set(Math.cos(a), -Math.sin(a)); U.uAirSunXZ.value.set(Math.cos(a) * lean, -Math.sin(a) * lean);
      fieldMat.uniforms.uReach.value = tune.reach; compMat.uniforms.uLift.value = tune.lift;
      { const u = layers[1].material.uniforms; u.uBright.value = tune.bright; u.uShadeCol.value.set(tune.shadeCol); }
      shared.uniforms.uAirShadow.value.x = tune.strength * tune.shadow;
      restLens(); keepUI(); layersFromTune(tier);
      const on = tier > 0;
      group.visible = on;
      comp.visible = on && layers.some(m => m.visible);
      shade.visible = on && !shared.inMaterial && tune.shadow > .01;
      if (!on) shared.uniforms.uAirShadow.value.x = 0;
    },
    /* each frame, with the renderer free (not inside another draw): the shadow map, then the clouds into their own target */
    render(r) {
      if (tier <= 0 || !baked) return;
      readSpots();
      if (frame++ % (tier > 1 ? 2 : 3) === 0) drawMap(r);                      // the shadow map: every second frame (third at medium)
      if (comp.visible) drawClouds(r);
    },
    dispose() {
      group.removeFromParent(); group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
      cloudScene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
      quad.geometry.dispose(); bakeMat.dispose(); fieldMat.dispose(); noise.dispose(); field.dispose(); cloudRT.dispose(); clearTex.dispose();
      shared.uniforms.uAirShadowMap.value = null; state.stage = 'off';
    }
  };
  return api;
}
