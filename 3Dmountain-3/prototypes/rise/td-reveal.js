/* RISE-TD · REVEAL — the 渲染 step (2026-11-20). index1-5-canyon-forest-rise.html only; built to .qa/index1-5/rise-td/CONTRACT.md v1.
   Client storyboard, frames 3 → 4: the black-and-white survey land is RENDERED into the colour view from above, and back again going up.

   What it draws (one full-screen pass, a pure function of f.reveal — so the way back is the same numbers going down):
   · a FRONT that travels over the land. Style 0 (墨染, default): the four rivers and the lake ring light first, and the colour spreads from the
     water and from the lake outward up the slopes, the ridges last. Style 1 (掃描): a scan from screen-left to screen-right. Style 2 (方格):
     the same spreading, resolved cell by cell like a renderer's buckets. Style 3: a plain crossfade (also used with reduced motion).
   · at the front: a thin line of light, the survey lines flaring as it passes, the water flashing as it lights;
   · behind the front: first an under-painting (cool, low in colour — a first render pass), then the full colour; the survey lines stand back
     to `gridKeep` of what LOOK draws.
   The front is anchored to the LAND, not the screen: each pixel's ray is met with a ground plane (f.camera), so it holds while the camera settles.

   The lines (client UPDATE 1: 「轉到定位後 3Dline就退掉」): this module draws no grid of its own. The lines it keeps and flares are the ones in
   LOOK's picture (taken out of it with a small min-filter), so they follow TD-LEAD's line amount by themselves; the few marks drawn here
   (the flare, the cell edges of style 2) are multiplied by that amount too (f.lines if given, else f.grid). Lines at 0 = nothing of them.

   The start (client UPDATE 2): not pure black and white but the valley drained to a cool steel grey — that picture is LOOK's (`look`), and reveal = 0
   is `look` itself, whatever its tone. Nothing here assumes a neutral grey: the lines are found by a min-filter, the clouds by brightness only.

   Exact ends: reveal = 0 → `look` unchanged; reveal = 1 → `source` unchanged when gridKeep = 0 or LOOK has no lines left.

   API (contract §4):  createReveal({ THREE, renderer, width, height, dpr, lite, quality, base }) →
     { tune, rows, warm(), update(f), resize(w, h, dpr), dispose(), state, setRivers(data) }      window.__RISE_TD_REVEAL__ = the last one made (debugging).
   Cost: three tiny passes for the water map (1/4 and 1/8 size) + one full-screen pass (source 1 read, look 9 reads, water map ≤ 2). */

const DEFAULTS = {
  style: 0,           // 0 墨染 from the water · 1 掃描 left → right · 2 方格 buckets · 3 crossfade
  edge: .2,           // softness (width) of the front, as a share of the whole travel
  gridKeep: 0,        // share of LOOK's lines that stays behind the front (they still follow TD-LEAD's line amount)
  lineFlare: 1.3,     // the lines brighten as the front passes
  glow: .85,          // the thin line of light at the front
  glowTint: .75,      // 0 white … 1 the rivers' cyan
  primer: .6,         // the under-painting between B&W and colour (0 = straight to colour)
  river: .6,          // how much the water leads (style 0, 2)
  radial: .4,         // how much the lake leads (outward from the ring)
  noise: .22,         // raggedness of the front
  noiseScale: 2.4,    // size of that raggedness (per world unit)
  riverGlow: .6,      // the water flashes as it lights
  riverLight: .5,     // v2: light along the four rivers and round the lake, on as the colour arrives (needs the land's river lines; let go with f.fade)
  riverThreshold: .13,// what counts as water in the colour picture (blue over red)
  tileSize: .7,       // style 2: cell size, world units
  scanAngle: 0,       // style 1: 0 = left → right, degrees
  cloudKeep: .6,      // LOOK's clouds kept behind the front (let go by reveal = 1)
  lineWidth: 2.2,     // px: widest line that still counts as a line
  groundY: .2, cx: .0846, cz: -.1112, reach: 7.5,   // the ground plane, the lake's centre, how far the land reaches (world units)
  debug: 0            // 1 the front's field · 2 the water map · 3 the lines found in LOOK
};
const ROWS = [
  { key: 'style', label: '渲染方式（0 墨染・1 掃描・2 方格・3 淡入）', min: 0, max: 3, step: 1 },
  { key: 'edge', label: '前緣柔和度', min: .03, max: .7, step: .01 },
  { key: 'gridKeep', label: '前緣後方保留的格線', min: 0, max: 1, step: .01 },
  { key: 'lineFlare', label: '前緣經過時格線發亮', min: 0, max: 3, step: .05 },
  { key: 'glow', label: '前緣光線', min: 0, max: 2, step: .05 },
  { key: 'glowTint', label: '光線顏色（0 白・1 水藍）', min: 0, max: 1, step: .01 },
  { key: 'primer', label: '底色階段（先冷灰再上色）', min: 0, max: 1, step: .01 },
  { key: 'river', label: '河流先亮', min: 0, max: 1, step: .01 },
  { key: 'radial', label: '由湖心向外', min: 0, max: 1, step: .01 },
  { key: 'noise', label: '前緣不規則', min: 0, max: 1, step: .01 },
  { key: 'noiseScale', label: '不規則的大小', min: .3, max: 5, step: .05 },
  { key: 'riverGlow', label: '河流點亮的閃光', min: 0, max: 2, step: .05 },
  { key: 'riverLight', label: '上色時河流的藍光', min: 0, max: 2, step: .05 },
  { key: 'riverThreshold', label: '河流判定（藍色門檻）', min: .04, max: .4, step: .005 },
  { key: 'tileSize', label: '方格大小（方式 2）', min: .25, max: 2, step: .05 },
  { key: 'scanAngle', label: '掃描方向（度，方式 1）', min: -180, max: 180, step: 1 },
  { key: 'cloudKeep', label: '前緣後方保留的雲', min: 0, max: 1, step: .01 },
  { key: 'lineWidth', label: '格線粗細上限（px）', min: 1, max: 5, step: .1 },
  { key: 'groundY', label: '地面高度', min: -.2, max: .8, step: .01 },
  { key: 'reach', label: '擴散範圍', min: 3, max: 14, step: .1 }
];

const VERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const WATER = `
  float rvWater(vec3 c,float th){return smoothstep(th,th+.18,c.b-c.r)*smoothstep(.3,.62,c.b);}`;
const FRAG_MASK = `precision highp float;varying vec2 vUv;uniform sampler2D tSource;uniform vec2 uPx;uniform float uTh;${WATER}
  void main(){float w=0.;
    w+=rvWater(texture2D(tSource,vUv+uPx*vec2(-1.,-1.)).rgb,uTh);w+=rvWater(texture2D(tSource,vUv+uPx*vec2(1.,-1.)).rgb,uTh);
    w+=rvWater(texture2D(tSource,vUv+uPx*vec2(-1.,1.)).rgb,uTh);w+=rvWater(texture2D(tSource,vUv+uPx*vec2(1.,1.)).rgb,uTh);
    gl_FragColor=vec4(w*.25);}`;
const FRAG_BLUR = `precision highp float;varying vec2 vUv;uniform sampler2D tMap;uniform vec2 uDir;
  void main(){float a=texture2D(tMap,vUv).r*.16;
    for(int i=1;i<=6;i++){float k=float(i);float g=exp(-k*k/14.)*.16;a+=(texture2D(tMap,vUv+uDir*k).r+texture2D(tMap,vUv-uDir*k).r)*g;}
    gl_FragColor=vec4(a);}`;
const FRAG = `precision highp float;varying vec2 vUv;
  uniform sampler2D tSource,tLook,tProx,tRiver;
  uniform vec4 uMap;   /* the river map: min x, min z, 1/width, 1/depth (world) */
  uniform vec4 uG;     /* has river map, river light × fade, water height, - */
  uniform vec2 uPx;uniform float uReveal,uLines,uTime,uPlane;
  uniform mat4 uInvVP,uVP;uniform vec3 uCam;
  uniform vec4 uA;   /* style, edge, gridKeep, lineFlare */
  uniform vec4 uB;   /* glow, glowTint, primer, riverGlow */
  uniform vec4 uC;   /* river, radial, noise, noiseScale */
  uniform vec4 uD;   /* tileSize, scan cos, scan sin, cloudKeep */
  uniform vec4 uE;   /* groundY, cx, cz, 1/reach */
  uniform vec4 uF;   /* lineWidth px, riverThreshold, debug, aspect */
  ${WATER}
  float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),f.x),f.y);}
  float fbm(vec2 p){return n2(p)*.5+n2(p*2.07+13.1)*.3+n2(p*4.3+5.7)*.2;}
  float prox(vec2 uv){return clamp(pow(texture2D(tProx,clamp(uv,0.,1.)).r*8.,.35),0.,1.);}
  /* the ground under a pixel: its ray met with the plane y = groundY (far away where the ray never comes down) */
  vec2 ground(vec2 uv,float y){
    if(uPlane<.5)return vec2((uv.x-.5)*uF.w,uv.y-.5)*12.+uE.yz;
    vec4 q=uInvVP*vec4(uv*2.-1.,1.,1.);vec3 d=normalize(q.xyz/q.w-uCam);
    float t=d.y<-1e-4?min((y-uCam.y)/d.y,80.):80.;
    return uCam.xz+d.xz*t;
  }
  /* the land's own rivers (a small map made once from their centre lines): r = near the water, wide · g = the water's line itself */
  vec2 rivers(vec2 g){return uG.x>.5&&uPlane>.5?texture2D(tRiver,(g-uMap.xy)*uMap.zw).rg:vec2(0.);}
  float field(vec2 g,float px){
    float r=length(g-uE.yz)*uE.w*2.;r=r/(1.+r);   /* never quite flat, so far ground and foreground still resolve in order */
    float wr=uC.y,wp=uC.x;
    float f=(r*wr+(1.-px)*wp)/max(wr+wp,1e-3);
    if(wr+wp<1e-3)f=.5;
    return pow(f,1.7);   /* evens the travel: as much land resolves in the first half as in the second */
  }
  void main(){
    vec4 S=texture2D(tSource,vUv);
    vec4 L=texture2D(tLook,vUv);
    if(uReveal<=0.){gl_FragColor=vec4(L.rgb,1.);return;}
    float style=uA.x,e=uA.y;
    vec2 g=ground(vUv,uE.x);
    vec2 rv=rivers(ground(vUv,uG.z));
    float pxl=max(prox(vUv)*(1.-uG.x),rv.r);
    float a,f=0.,cellEdge=0.;
    if(style>2.5){a=uReveal;}
    else{
      if(style>1.5){
        /* buckets: the field is read at the centre of the pixel's ground cell */
        vec2 c=(floor(g/uD.x)+.5)*uD.x;
        float pc=pxl;
        if(uG.x>.5)pc=rivers(c).r;
        else if(uPlane>.5){vec4 pj=uVP*vec4(c.x,uE.x,c.y,1.);if(pj.w>0.)pc=prox(pj.xy/pj.w*.5+.5);}
        f=field(c,pc);
        f=clamp((f+(h2(floor(g/uD.x))-.5)*uC.z*.5+.25*uC.z)/(1.+.5*uC.z),0.,1.);
        vec2 q=g/uD.x;vec2 w=fwidth(q);vec2 d=abs(fract(q)-.5);
        cellEdge=max(smoothstep(.5-w.x*1.5,.5,d.x),smoothstep(.5-w.y*1.5,.5,d.y))*(1.-smoothstep(.15,.45,max(w.x,w.y)));
      }else{
        if(style>.5){vec2 p=vec2((vUv.x-.5)*uF.w,vUv.y-.5);float ext=.5*(abs(uD.y)*uF.w+abs(uD.z));f=clamp(dot(p,uD.yz)/(2.*ext)+.5,0.,1.);f=clamp(f-pxl*uC.x*.12,0.,1.);}
        else f=field(g,pxl);
        float n=mix(fbm(g*uC.w),fbm(vec2(vUv.x*uF.w,vUv.y)*11.),.3);   /* part of it fixed to the screen: fine everywhere, also where the ground is very near or very far */
        f=clamp((f+(n-.5)*uC.z*.6+.3*uC.z)/(1.+.6*uC.z),0.,1.);
      }
      a=clamp((uReveal*(1.+e)-f)/e,0.,1.);
    }
    if(uF.z>.5){vec3 dbg=uF.z<1.5?vec3(f):uF.z<2.5?vec3(pxl):vec3(0.);
      if(uF.z<2.5){gl_FragColor=vec4(dbg,1.);return;}}
    if(a<=0.){gl_FragColor=vec4(L.rgb,1.);return;}
    if(a>=1.&&uA.z*uLines<=0.&&uG.y*uG.x<=0.&&uReveal>=1.){gl_FragColor=vec4(S.rgb,1.);return;}
    /* LOOK without its thin bright lines: the darkest of a small ring (a min-filter); what it took away = the lines */
    vec3 er=L.rgb;float el=luma(er);vec2 r=uPx*uF.x;
    for(int i=0;i<8;i++){float an=float(i)*.7853982+.3;vec3 c=textureLod(tLook,vUv+vec2(cos(an),sin(an))*r*(mod(float(i),2.)<.5?1.:.6),0.).rgb;float l=luma(c);if(l<el){el=l;er=c;}}
    vec3 lines=max(L.rgb-er,0.);
    if(uF.z>2.5){gl_FragColor=vec4(lines*3.,1.);return;}
    float lS=luma(S.rgb);
    /* where the front is very wide on the screen (flat field: far ground, near foreground) its light would fill whole areas: thin it there */
    float thin=style>2.5?0.:smoothstep(.0015,.01,fwidth(a));
    float peak=pow(4.*a*(1.-a),1.5)*mix(.25,1.,thin);
    float p1=smoothstep(0.,.5,a),p2=smoothstep(.3,1.,a);
    /* the under-painting: the colour picture low in colour, cool, a little dark — as a first pass */
    vec3 primer=mix(vec3(lS),S.rgb,.3)*vec3(.80,.93,1.06)*.92;
    vec3 col=mix(er,primer,p1*uB.z);
    col=mix(col,S.rgb,p2);
    /* LOOK's clouds stay a while behind the front, then let go */
    vec3 cloud=vec3(max(el-lS-.14,0.))*uD.w*(1.-smoothstep(.75,1.,uReveal))*p2;
    col+=cloud;
    /* the lines: whole ahead, gridKeep behind, flaring as the front passes */
    vec3 tint=mix(vec3(1.),vec3(.55,.86,1.),uB.y);
    float keep=mix(1.,uA.z*smoothstep(0.,.25,uLines),smoothstep(.15,.85,a));
    col+=lines*(keep+uA.w*peak*uLines)*mix(vec3(1.),tint,peak);
    /* the line of light at the very front */
    float core=exp(-pow((a-.1)/.075,2.))*smoothstep(0.,.04,a)*(1.-a)*thin;
    col+=tint*core*uB.x*.42;
    /* the water flashes as it lights */
    float wm=rvWater(S.rgb,uF.y);
    col+=S.rgb*wm*peak*uB.w*.8+tint*pxl*pxl*peak*uB.w*.04;
    /* v2: the rivers' light comes on WITH the colour (a line of light on the water, a soft halo), less where the picture's own light is already bright */
    col+=mix(vec3(.5,.8,1.),vec3(.86,.96,1.),rv.g)*(rv.g+.22*rv.r*rv.r*rv.g)*uG.y*(smoothstep(.2,.75,a)+peak*.8)*(1.-smoothstep(.35,.8,lS));
    /* style 2: the cells' edges while their cell resolves */
    col+=tint*cellEdge*peak*uLines*.5;
    gl_FragColor=vec4(col,1.);
  }`;

export function createReveal({ THREE, renderer, width = 4, height = 4, dpr = 1, lite = false, quality = 'high', base } = {}) {
  if (!THREE) throw new Error('td-reveal: THREE is required');
  const tune = { ...DEFAULTS };
  const state = { stage: 'made', frames: 0, drew: '', plane: 0, w: 0, h: 0 };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const mk = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const V4 = () => new THREE.Vector4(), V2 = () => new THREE.Vector2();
  const maskMat = mk(FRAG_MASK, { tSource: { value: null }, uPx: { value: V2() }, uTh: { value: .13 } });
  const blurMat = mk(FRAG_BLUR, { tMap: { value: null }, uDir: { value: V2() } });
  const U = { tSource: { value: null }, tLook: { value: null }, tProx: { value: null }, uPx: { value: V2() }, uReveal: { value: 0 }, uLines: { value: 1 }, uTime: { value: 0 }, uPlane: { value: 0 },
    uInvVP: { value: new THREE.Matrix4() }, uVP: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() },
    tRiver: { value: null }, uMap: { value: V4() }, uG: { value: V4() }, uA: { value: V4() }, uB: { value: V4() }, uC: { value: V4() }, uD: { value: V4() }, uE: { value: V4() }, uF: { value: V4() } };
  const mat = mk(FRAG, U);
  mat.extensions = { derivatives: true };
  const mesh = new THREE.Mesh(geometry, mat); mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rt = (w, h) => new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  let M = rt(4, 4), A = rt(4, 4), B = rt(4, 4), W = 0, H = 0, disposed = false;
  function resize(w, h, d = dpr) {
    dpr = d; W = Math.max(4, Math.round(w * d)); H = Math.max(4, Math.round(h * d)); state.w = W; state.h = H;
    const div = lite || quality === 'low' ? 6 : 4;
    M.setSize(Math.ceil(W / div), Math.ceil(H / div)); A.setSize(Math.ceil(W / div / 2), Math.ceil(H / div / 2)); B.setSize(A.width, A.height);
  }
  resize(width, height, dpr);
  /* v2 · the land's rivers as a small map (512², made once on a 2D canvas, uploaded at once — never on a reveal frame).
     setRivers({ rivers: [[[x, z], …], …], lake: { x, z, r } }) hands them over; without a call the view's own lines are picked up when it is ready
     (window.__FLOW2_FOREST_ATLAS__.scene.rivers / .lake, read only). No rivers = the water is found in the colour picture as in v1. */
  const MAP = { x: -8, z: -8, w: 16, d: 16, n: 512 };
  let riverTex = null, poll = 0;
  function setRivers(data) {
    if (disposed || !data || !Array.isArray(data.rivers) || !data.rivers.length || typeof document === 'undefined') return false;
    const c = document.createElement('canvas'); c.width = c.height = MAP.n; const g = c.getContext('2d'), k = MAP.n / MAP.w;
    g.fillStyle = '#000'; g.fillRect(0, 0, MAP.n, MAP.n); g.globalCompositeOperation = 'lighter'; g.lineCap = g.lineJoin = 'round';
    const path = () => { for (const line of data.rivers) { g.beginPath(); line.forEach((q, i) => { const X = (q[0] - MAP.x) * k, Y = (q[1] - MAP.z) * k; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); } };
    for (const [w, a] of [[3.4, .1], [2.4, .12], [1.6, .16], [1, .2], [.55, .22], [.25, .2]]) { g.strokeStyle = `rgba(255,0,0,${a})`; g.lineWidth = w * k; path(); }
    for (const [w, a] of [[.13, .2], [.07, .38], [.035, .6]]) { g.strokeStyle = `rgba(0,255,0,${a})`; g.lineWidth = w * k; path(); }
    const L = data.lake;
    if (L && Number.isFinite(+L.x) && Number.isFinite(+L.z)) {
      const X = (L.x - MAP.x) * k, Y = (L.z - MAP.z) * k, R = Math.max(.2, +L.r || .8) * k;
      const grad = g.createRadialGradient(X, Y, R * .5, X, Y, R * 3.2); grad.addColorStop(0, 'rgba(255,0,0,1)'); grad.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = grad; g.beginPath(); g.arc(X, Y, R * 3.2, 0, 7); g.fill();
      for (const [w, a] of [[.2, .2], [.1, .35], [.05, .5]]) { g.strokeStyle = `rgba(0,255,0,${a})`; g.lineWidth = w * k; g.beginPath(); g.arc(X, Y, R, 0, 7); g.stroke(); }
    }
    g.globalCompositeOperation = 'source-over'; g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeRect(0, 0, MAP.n, MAP.n);   /* an empty rim: nothing outside the map */
    riverTex?.dispose();
    riverTex = new THREE.CanvasTexture(c); riverTex.colorSpace = THREE.NoColorSpace; riverTex.flipY = false; riverTex.generateMipmaps = true;
    riverTex.minFilter = THREE.LinearMipmapLinearFilter; riverTex.magFilter = THREE.LinearFilter; riverTex.wrapS = riverTex.wrapT = THREE.ClampToEdgeWrapping;
    try { renderer?.initTexture?.(riverTex); } catch (error) { }
    U.tRiver.value = riverTex; U.uMap.value.set(MAP.x, MAP.z, 1 / MAP.w, 1 / MAP.d); state.rivers = data.rivers.length;
    if (data.lake) { tune.cx = +data.lake.x; tune.cz = +data.lake.z; }
    return true;
  }
  function pickRivers() {
    try {
      const A = window.__FLOW2_FOREST_ATLAS__?.scene; if (!A?.rivers?.length) return false;
      const lake = A.lake?.center ? { x: A.lake.center.x, z: A.lake.center.z, r: A.lake.radius } : null;
      return setRivers({ rivers: A.rivers.map(r => r.points.map(q => [q.x, q.z])), lake });
    } catch (error) { return false; }
  }
  const draw = (r, material, target) => { mesh.material = material; r.setRenderTarget(target); r.render(scene, cam); };
  const num = (v, d) => Number.isFinite(+v) ? +v : d;
  function update(f) {
    if (disposed || !f) return;
    const r = f.renderer || renderer, source = f.source, look = f.look || f.source;
    if (!r || !source) return;
    const reveal = Math.min(1, Math.max(0, num(f.reveal, num(f.progress, 0))));
    const lines = Math.min(1, Math.max(0, num(f.lines, num(f.grid, 1))));
    const T = tune, style = f.reduced ? 3 : Math.round(num(T.style, 0));
    if (f.width && f.height && (Math.round(f.width * (f.dpr || dpr)) !== W || Math.round(f.height * (f.dpr || dpr)) !== H)) resize(f.width, f.height, f.dpr || dpr);
    const auto = r.autoClear; r.autoClear = false;
    try {
      /* the water map: where the rivers and the ring are in the colour picture, spread wide — only while the front is on its way */
      const hasMap = riverTex ? 1 : 0;
      const needMap = !hasMap && reveal > 0 && reveal < 1 && style < 3 && (T.river > 0 || T.riverGlow > 0 || T.debug === 2);
      if (needMap) {
        maskMat.uniforms.tSource.value = source; maskMat.uniforms.uPx.value.set(1 / W, 1 / H); maskMat.uniforms.uTh.value = T.riverThreshold; draw(r, maskMat, M);
        blurMat.uniforms.tMap.value = M.texture; blurMat.uniforms.uDir.value.set(3 / M.width, 0); draw(r, blurMat, A);
        blurMat.uniforms.tMap.value = A.texture; blurMat.uniforms.uDir.value.set(0, 2.4 / A.height); draw(r, blurMat, B);
      }
      U.tSource.value = source; U.tLook.value = look; U.tProx.value = B.texture;
      U.uPx.value.set(1 / W, 1 / H); U.uReveal.value = reveal; U.uLines.value = lines; U.uTime.value = num(f.time, 0);
      const c = f.camera, plane = c && c.isPerspectiveCamera && f.scene !== 'canyon' ? 1 : 0;
      U.uPlane.value = plane; state.plane = plane;
      if (plane) {
        U.uVP.value.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse); U.uInvVP.value.copy(U.uVP.value).invert();
        U.uCam.value.setFromMatrixPosition(c.matrixWorld);
      }
      const an = num(T.scanAngle, 0) * Math.PI / 180;
      U.uA.value.set(style, Math.max(.01, T.edge), T.gridKeep, T.lineFlare);
      U.uB.value.set(T.glow, T.glowTint, T.primer, T.riverGlow);
      U.uG.value.set(hasMap, Math.max(0, T.riverLight) * Math.min(1, Math.max(0, num(f.fade, 1))), .105, 0);
      U.uC.value.set(needMap || hasMap || style === 1 ? T.river : 0, T.radial, T.noise, T.noiseScale);
      U.uD.value.set(Math.max(.05, T.tileSize), Math.cos(an), Math.sin(an), T.cloudKeep);
      U.uE.value.set(T.groundY, T.cx, T.cz, 1 / Math.max(.1, T.reach));
      U.uF.value.set(T.lineWidth * (f.dpr || dpr), T.riverThreshold, T.debug, W / H);
      draw(r, mat, f.target || null);
      if (!state.frames) { state.source = { colorSpace: source.colorSpace, type: source.type, format: source.format }; state.target = f.target ? 'render target' : 'canvas'; state.firstMs = 0; }
      state.frames++; state.drew = reveal <= 0 ? 'look' : reveal >= 1 ? 'colour' : 'front'; state.reveal = reveal; state.lines = lines; state.stage = 'drawing';
    } finally { r.autoClear = auto; }
  }
  /* v2 · everything of the first use, before the transition (TD-LEAD: a 72 ms frame on the first reveal frame). three.js keeps one program per
     OUTPUT too: a material drawn into a render target and the same material drawn to the canvas are two programs. v1 compiled only the
     render-target one, and the page draws the final picture to the canvas — that compile fell on the first reveal frame. Now both are compiled
     here (in parallel, awaited), then each is really used once: the small passes into their own targets, the final pass into a target and to
     the canvas through an empty scissor (no pixel is written). The rivers' map is made and uploaded here or as soon as the view is ready. */
  async function warm() {
    const r = renderer; if (!r || disposed) return;
    const s = new THREE.Scene(), tiny = rt(8, 8);
    for (const m of [maskMat, blurMat, mat]) { const o = new THREE.Mesh(geometry, m); o.frustumCulled = false; s.add(o); }
    const before = r.getRenderTarget(), auto = r.autoClear; let jobs = [];
    try {
      if (r.compileAsync) { r.setRenderTarget(tiny); jobs.push(r.compileAsync(s, cam)); r.setRenderTarget(null); jobs.push(r.compileAsync(s, cam)); }
      else { r.setRenderTarget(tiny); r.compile(s, cam); r.setRenderTarget(null); r.compile(s, cam); }
    } finally { r.setRenderTarget(before); }
    try { await Promise.all(jobs); } catch (error) { state.warmError = String(error?.message || error); }
    if (disposed) { tiny.dispose(); return; }
    if (!riverTex && !pickRivers() && typeof window !== 'undefined' && !poll) {
      let tries = 0; poll = setInterval(() => { if (disposed || riverTex || pickRivers() || ++tries > 600) { clearInterval(poll); poll = 0; } }, 250);
    }
    const sc = new THREE.Vector4(), test = r.getScissorTest(); r.getScissor(sc);
    try {
      r.autoClear = false;
      U.tSource.value = tiny.texture; U.tLook.value = tiny.texture; U.tProx.value = B.texture; U.uReveal.value = .5; U.uPlane.value = 0; U.uA.value.set(0, .2, 0, 1); U.uF.value.set(2, .13, 0, 1);
      maskMat.uniforms.tSource.value = tiny.texture; draw(r, maskMat, M); blurMat.uniforms.tMap.value = M.texture; draw(r, blurMat, A); blurMat.uniforms.tMap.value = A.texture; draw(r, blurMat, B);
      const tiny2 = rt(8, 8); draw(r, mat, tiny2); tiny2.dispose();
      r.setRenderTarget(null); r.setScissorTest(true); r.setScissor(0, 0, 0, 0); mesh.material = mat; r.render(scene, cam);
    } catch (error) { state.warmError = String(error?.message || error); }
    finally { r.setScissor(sc); r.setScissorTest(test); r.autoClear = auto; r.setRenderTarget(before); tiny.dispose(); U.tSource.value = U.tLook.value = null; }
    state.stage = 'warm'; state.warmed = 2;
  }
  function dispose() { if (disposed) return; disposed = true; state.stage = 'off'; if (poll) clearInterval(poll); riverTex?.dispose(); for (const o of [M, A, B, maskMat, blurMat, mat, geometry]) o.dispose(); }
  const api = { tune, rows: ROWS, state, warm, update, resize, dispose, setRivers };
  if (typeof window !== 'undefined') window.__RISE_TD_REVEAL__ = api;
  return api;
}
export default createReveal;
