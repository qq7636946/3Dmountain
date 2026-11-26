import * as THREE from 'three';

/* Flow2 · the view from above: THE FLOW MADE VISIBLE (water team W2, 2026-11-16). Doc: docs/flow2/flow2-water-flow-20261116.md
   Client: 「俯視圖的水…太像一張圖了 沒什麼流動匯集感覺 要有流動匯集感覺」 — the four rivers must be seen to RUN to the lake.
   Client, on the first version (the inflows wound round the lake's centre): 「水流這樣太誇張了拉 我只是要原本那樣在流動一點 你把它變漩渦」 —
   so THE RULE HERE IS RESTRAINT: the approved calm navy water, only alive. No whirlpool, nothing round the lake's centre, the lake stays calm;
   few, fine, slow marks. Anything stronger belongs behind a dial that is 0 by default.

   The data (original/w2_flow_field.py -> original/w2-streamlines.json): a flow field for the whole water — a potential flow down the four
   rivers (speed ~ 1 / width: faster in the narrows) that drifts slowly and nearly straight to the lake's middle — and its STREAMLINES from each
   river's far end toward the lake's middle, each point with its travel time. Everything drawn here lies ALONG those lines and moves with that
   time, so what the eye follows is the water's real course and speed.

   What is drawn (ONE mesh, one draw call, ribbons a few pixels wide on the water plane, depth-tested: trees and banks hide them):
   · THE FOUR CURRENTS  one fine luminous line per river — the canyon's four beams of light continued (a hair of white-blue light, a faint
                        azure skirt, soft packets of light gliding down with the water) — along each river's middle streamline with a slow
                        weave, ending softly as it enters the lake. The field that is active at FOUR PATHS is the brightest.
   · THREADS AND FLECKS on 18 streamlines per river (equal flux apart: close together where the water is fast) and 30 short ones in the
                        lake's bays: long fine threads drawn out by the current (pointed at both ends, each on its own slightly wandering
                        path) and small flecks of foam; every mark has its own length, place and strength; whiter where the water is fast.
   · SOFT LIGHT         broad, very faint bands of light carried down the same lines.
   · (EDDIES            small inward spirals beside the mouths: built, but OFF by default — dial 「河口小渦」.)
   Where the picture has no water (original/d1-water.png) or the water has not arrived yet (the spreading: uGrow / tGrow) nothing is drawn;
   everything fades out before the lake's middle (dial 「湖心淨空半徑」).

   Tiers (window.__FLOW2_QUALITY__.rank): 2 = everything; 1 = the currents + about half the threads, no soft bands; 0 = nothing.
   Reduce motion: the same picture, still. ?wflow=0 (in flow2-forest-atlas.js) leaves the module out.
   Dials: panel 「俯視水流」 key U (registered here); live at window.__FLOW2_WATER_FLOW__ = { tune, state, uniforms }. */

const VERSION = new URL(import.meta.url).searchParams.get('v') || 'w2-1';
export const FLOW_UNITS_PER_SECOND = .6;      /* world units per second at field speed 1 and the speed dial at 1 (W1 uses the same number) */
const PX_TO_WORLD = 14 / 1494;
const LEVEL = .105;

const VERT = /* glsl */`
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
  }`;

const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tWater,tGrow;
  uniform float uFlow,uGrow,uAmount,uStreak,uSoft,uCurrent,uPulse,uEddy,uVig,uHasGrow,uFoam,uFleck,uLakeIn,uLakeOut,uReach,uStreakReach,uRoute;
  uniform vec4 uEmph,uView;
  varying float vSide,vT,vS,vR,vSeed,vKind,vTotal,vEndR,vK,vLake;
  varying vec2 vUv;
  float hash(float n){return fract(sin(n*12.9898)*43758.5453);}
  /* one train of marks carried with the water: every mark has its own length, place in its cell and strength; some cells are empty.
     x = the place inside the mark (0 tail … 1 head) */
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
    /* ROUTE (2026-11-25, -ui page: 「俯視水流也是進場後跟個光幕一起路徑進去」): the flow comes in along each river from its source with the light
       curtain's growth, a soft front; uRoute 1 = all of it (every other page) */
    if(uRoute<.999){ float rh=uRoute*1.12, rx=vT/max(vTotal,.001); here*=1.-smoothstep(rh-.12,rh,rx); }
    if(here<.004)discard;
    float as=abs(vSide);
    float begin=smoothstep(0.,.5,vT), finish=1.-smoothstep(vTotal-.45,vTotal,vT);
    float t=vT-uFlow;
    vec3 col=vec3(0.); float alpha=0.;
    if(vKind>2.5){
      /* a luminous current: the canyon's beam drawn fine — a hair of light, a faint skirt, soft packets of light gliding down with the water;
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
  }`;

function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* PERF (2026-11-21, rise page; ?perf=0 = as before): the canvas's CSS height was read from the DOM on every frame, which made the browser
   recalculate style in mid-frame; it only changes with the window, so it is read once per window size */
const PERF_H = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-rise-studio-pbr') && new URLSearchParams(location.search).get('perf') !== '0';
let perfHKey = '', perfH = 0;
const canvasHeight = renderer => {
  if (!PERF_H) return renderer?.domElement?.clientHeight || innerHeight || 900;
  const key = innerWidth + 'x' + innerHeight;
  if (key !== perfHKey || !perfH) { perfHKey = key; perfH = renderer?.domElement?.clientHeight || innerHeight || 900; }
  return perfH;
};
export async function createForestFlow(renderer, options = {}) {
  const reduced = !!options.reducedMotion, atlas = options.atlas || {};
  const DEFAULTS = { on: 1, speed: 1, amount: .8, streak: 1, streakWidth: 1.5, wander: 2.2, fleck: 1, foam: 1, soft: 1, softWidth: 8, current: 1, currentWidth: 3.2, pulse: 1, active: 1.7, others: .62,
    reach: .9, streakReach: 1.5, lakeOut: 1.5, eddy: 0, lift: .012 };
  const tune = options.tune || {};
  for (const k in DEFAULTS) if (!Number.isFinite(+tune[k])) tune[k] = DEFAULTS[k];
  if (options.panel !== false) window.__FLOW2_PANEL__?.add({ id: 'forestflow', title: '俯視水流', key: 'u', tune, rows: [
    ['水流（1 開 / 0 關）', 'on', 0, 1, 1], ['流速', 'speed', 0, 2.5, .01],
    ['— 流線（細絲與白沫）—'], ['流線數量', 'amount', 0, 1.6, .01], ['流線亮度', 'streak', 0, 2.5, .01], ['流線粗細（px）', 'streakWidth', .6, 4, .05], ['流線左右游移（px）', 'wander', 0, 6, .1],
    ['白沫點', 'fleck', 0, 2, .01], ['急流處更白', 'foam', 0, 2, .01], ['柔光帶亮度', 'soft', 0, 3, .01], ['柔光帶寬度（px）', 'softWidth', 3, 24, .5],
    ['— 四道光流（延續峽谷的四條光束）—'], ['光流亮度', 'current', 0, 3, .01], ['光流粗細（px）', 'currentWidth', 1.5, 10, .1], ['流光脈衝', 'pulse', 0, 2.5, .01],
    ['目前項目那一條（倍）', 'active', 1, 3, .01], ['其他三條（倍）', 'others', 0, 1, .01],
    ['— 入湖（湖面保持平靜）—'], ['光流入湖後延伸多遠', 'reach', .1, 2.5, .01], ['流線入湖後延伸多遠', 'streakReach', .1, 3, .01], ['湖心淨空半徑', 'lakeOut', .6, 3, .01],
    ['河口小渦（0 關）', 'eddy', 0, 1, .01], ['離水面高度', 'lift', 0, .06, .001]
  ] });
  const state = { stage: 'loading', tier: 2, version: VERSION, lines: 0, vertices: 0, triangles: 0, active: -1, flow: 0 };

  const jsonCache = typeof window === 'object' ? (window.__FOREST_JSON_CACHE__ ||= {}) : null;
  const streamHref = new URL('./original/w2-streamlines.json?v=' + VERSION, import.meta.url).href;
  const data = await (jsonCache
    ? (jsonCache['w2-streamlines.json'] ||= fetch(streamHref).then(r => { if (!r.ok) throw new Error('w2-streamlines.json ' + r.status); return r.json(); }))
    : fetch(streamHref).then(r => { if (!r.ok) throw new Error('w2-streamlines.json ' + r.status); return r.json(); }));
  const bounds = atlas.uniforms?.uBounds?.value || new THREE.Vector4(-7, -3.917, 1 / 14, 1 / 7.834);
  const toWorld = (u, v) => [bounds.x + u / bounds.z, bounds.y + v / bounds.w];
  const centre = toWorld(data.centre[0], data.centre[1]);

  /* ---------------------------------------------------------------- the ribbons */
  const P = [], S = [], F = [], Ln = [], E = [], I = [];
  const rand = mulberry(20261116);
  let vcount = 0;
  /* pts: [[x, z, tw, s]] in world units (tw = distance travelled at unit speed); kind 0 streak · 1 soft band · 2 eddy · 3 current */
  function ribbon(pts, kind, k, widthScale, endR, seed) {   /* endR: a 0…1 number of the line's own (how far into the lake it is drawn) */
    const n = pts.length; if (n < 2) return;
    const total = pts[n - 1][2], base = vcount;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const len = Math.hypot(tx, tz) || 1; tx /= len; tz /= len;
      const p = pts[i], r = Math.hypot(p[0] - centre[0], p[1] - centre[1]);
      for (let side = -1; side <= 1; side += 2) {
        P.push(p[0], LEVEL, p[1]); S.push(-tz, tx); F.push(side, p[2], p[3], r); Ln.push(seed, widthScale, k, total); E.push(endR, kind, p[4] || 0);
      }
      if (i < n - 1) { const v = base + i * 2; I.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
    }
    vcount += n * 2; state.lines++;
  }
  const line = entry => entry.pts.map(([u, v, t, s, l]) => { const w = toWorld(u, v); return [w[0], w[1], t * PX_TO_WORLD, s, (l || 0) * PX_TO_WORLD]; });
  /* draw order = index order: the currents first (always), then the streaks every tier has, then the rest (high tier only) */
  for (const r of data.rivers) ribbon(line(r.current), 3, r.k, 1, 0, .13 + r.k * .21);
  const mediumRest = [], highRest = [];
  for (const r of data.rivers) r.lines.forEach((l, i) => {
    const pts = line(l), seed = rand(), endR = rand(), w = .8 + .5 * rand();
    (i % 2 === 0 ? mediumRest : highRest).push(() => ribbon(pts, 0, r.k, w, endR, seed));
    if (i % 3 === 1) highRest.push(() => ribbon(pts, 1, r.k, .8 + .5 * rand(), rand(), rand()));
  });
  (data.lake_lines || []).forEach((l, i) => {
    const pts = line(l), seed = rand(), endR = rand(), w = .8 + .4 * rand();
    (i % 2 === 0 ? mediumRest : highRest).push(() => ribbon(pts, 0, -1, w, endR, seed));
  });
  for (const e of data.eddies || []) {
    const c = toWorld(e.uv[0], e.uv[1]), R0 = e.radius_px * PX_TO_WORLD, turns = 1.55, n = 44;
    for (let arm = 0; arm < 2; arm++) {
      const pts = []; let tw = 0, prev = null;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1), ang = arm * Math.PI + e.turn * f * turns * Math.PI * 2, rr = R0 * (1 - .74 * f);
        const p = [c[0] + Math.cos(ang) * rr, c[1] + Math.sin(ang) * rr];
        if (prev) tw += Math.hypot(p[0] - prev[0], p[1] - prev[1]) / .16;
        pts.push([p[0], p[1], tw, .25, 0]); prev = p;
      }
      highRest.push(() => ribbon(pts, 2, -1, 1, 0, rand()));
    }
  }
  const currentsIndexCount = I.length;
  mediumRest.forEach(make => make()); const mediumIndexCount = I.length;
  highRest.forEach(make => make());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(S, 2));
  geometry.setAttribute('aFlow', new THREE.Float32BufferAttribute(F, 4)); geometry.setAttribute('aLine', new THREE.Float32BufferAttribute(Ln, 4));
  geometry.setAttribute('aExt', new THREE.Float32BufferAttribute(E, 3)); geometry.setIndex(vcount > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, LEVEL, 0), 9);
  state.vertices = vcount; state.triangles = I.length / 3;

  const U = atlas.uniforms || {};
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blank.needsUpdate = true;
  const uniforms = {
    tWater: U.tWater?.value ? U.tWater : { value: blank }, tGrow: U.tGrow?.value ? U.tGrow : { value: blank }, uHasGrow: { value: U.tGrow?.value ? 1 : 0 },
    uGrow: U.uGrow || { value: 1 }, uBounds: U.uBounds || { value: bounds }, uView: U.uView || { value: new THREE.Vector4(0, 0, 1, 1) }, uVig: U.uVig || { value: 0 },
    uCentre: { value: new THREE.Vector3(centre[0], LEVEL, centre[1]) }, uSense: { value: data.sense || 1 }, uTwist: { value: 0 }, uTwistR: { value: 1.05 },   /* uTwist stays 0: the first version's winding round the centre is gone (client: no whirlpool) */
    uPixel: { value: .001 }, uLift: { value: tune.lift }, uFlow: { value: 0 }, uRoute: { value: 1 }, uAmount: { value: 1 }, uStreak: { value: 1 }, uSoft: { value: 1 }, uCurrent: { value: 1 }, uPulse: { value: 1 },
    uEddy: { value: 0 }, uFoam: { value: 1 }, uFleck: { value: 1 }, uLakeIn: { value: .8 }, uLakeOut: { value: 1.5 }, uReach: { value: .9 }, uStreakReach: { value: 1.5 }, uWander: { value: 2.2 }, uEmph: { value: new THREE.Vector4(1, 1, 1, 1) },
    uStreakW: { value: 1.5 }, uSoftW: { value: 9 }, uCurrentW: { value: 5.5 }, uEddyW: { value: 1.3 }
  };
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'Forest water flow (W2)'; mesh.frustumCulled = false; mesh.renderOrder = 8;
  const group = new THREE.Group(); group.name = 'Flow2 water flow'; group.add(mesh);

  const emph = [1, 1, 1, 1]; let flow = reduced ? 7.3 : 0, tier = 2;
  const api = {
    group, tune, state, uniforms, data,
    setTier(rank) { tier = rank; },
    /* frame = what atlas.onUpdate hands over: { dt, camera, state: { active } } */
    update(frame = {}) {
      const q = window.__FLOW2_QUALITY__; if (q && Number.isFinite(+q.rank)) tier = +q.rank;
      state.tier = tier;
      const on = tier > 0 && tune.on >= .5;
      group.visible = on; if (!on) return;
      const dt = Math.min(Math.max(+frame.dt || 0, 0), .05), camera = frame.camera || atlas.camera;
      if (!reduced) flow += dt * FLOW_UNITS_PER_SECOND * tune.speed;
      uniforms.uFlow.value = flow; state.flow = flow;
      const h = canvasHeight(renderer);
      if (camera) uniforms.uPixel.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * .5)) / Math.max(1, h);
      const active = Number.isInteger(frame.state?.active) ? frame.state.active : -1; state.active = active;
      const ease = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
      for (let k = 0; k < 4; k++) { const want = active < 0 ? 1 : active === k ? tune.active : tune.others; emph[k] += (want - emph[k]) * ease; }
      uniforms.uEmph.value.fromArray(emph);
      const medium = tier < 2;
      uniforms.uAmount.value = tune.amount * (medium ? .8 : 1); uniforms.uStreak.value = tune.streak; uniforms.uSoft.value = tune.soft; uniforms.uCurrent.value = tune.current;
      uniforms.uPulse.value = tune.pulse; uniforms.uEddy.value = tune.eddy; uniforms.uFoam.value = tune.foam; uniforms.uLift.value = tune.lift; uniforms.uLakeIn.value = tune.lakeOut * .55; uniforms.uLakeOut.value = tune.lakeOut;
      uniforms.uReach.value = tune.reach; uniforms.uStreakReach.value = tune.streakReach; uniforms.uWander.value = tune.wander; uniforms.uFleck.value = tune.fleck;
      uniforms.uStreakW.value = tune.streakWidth; uniforms.uSoftW.value = tune.softWidth; uniforms.uCurrentW.value = tune.currentWidth; uniforms.uEddyW.value = tune.streakWidth * .9;
      geometry.setDrawRange(0, medium ? mediumIndexCount : I.length);
    },
    setRoute(v) { uniforms.uRoute.value = Math.max(0, Math.min(1, +v)); },   /* ROUTE: 0 … 1 along each river (1 = all) */
    dispose() { geometry.dispose(); material.dispose(); blank.dispose(); group.removeFromParent(); }
  };
  state.stage = 'ready'; state.currentsIndexCount = currentsIndexCount; state.mediumIndexCount = mediumIndexCount;
  window.__FLOW2_WATER_FLOW__ = { tune, state, uniforms, unitsPerSecond: FLOW_UNITS_PER_SECOND, data };
  api.update({ dt: 0 });
  return api;
}
