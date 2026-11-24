/* RISE FALLS · the air (team FW, 2026-11-23). Made by ./index.js; brief docs/falls/BRIEF-20261123.md, report docs/falls/FW.md.
   ONE soft cloud that rises from the foot of the falls and drifts with the wind: not sprites, not layers. One box round the cloud, one draw
   call; each pixel of it walks its ray through the box in a few steps (10 at the top tier, 6 medium, 4 low / phones) and adds up a density
   that is known everywhere:
       density = (how close to the foot of the falling water, wider the higher it is) x (thick at the pool, thinning upward, a taller plume
                 over the far middle) x (only inside the gorge below the rim) - billows (one smooth noise, rising and drifting with the clock)
   The foot's distance, the rim's distance and the fall's fullness are read from the gorge's small field picture (made by index.js from the
   contract), the billows from the shared 128-px noise picture: two or three texture reads per step, no loop over the outline.
   Empty air is strode over (the field says how far the nearest foot is), so the steps are spent inside the cloud.
   A ray ends where it meets the plateau (worked out exactly: one read where the ray crosses the plateau's level) or goes into the rock of
   the far wall: the near rim hides what is behind it, as rock should.
   Colour: the view's own cloud colours and brightness (panel 「雲霧顏色」), so it is the same air as the cloud banks.
   The camera may fly into it (the dive): while the lens is inside the box the back faces are drawn instead, no depth test. */
import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec3 vWorld;
  void main(){
    vec4 wp=modelMatrix*vec4(position,1.);
    vWorld=wp.xyz;
    gl_Position=projectionMatrix*viewMatrix*wp;
  }`;

const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tNoise,tField;
  uniform vec4 uFieldRect,uLevels,uPlume;          /* uLevels: plateau water, pool, drop, throw · uPlume: x, z, radius, how much taller */
  uniform vec3 uBoxMin,uBoxMax,uSun,uLit,uShadeC;
  uniform vec2 uWind,uTone,uRight;
  uniform float uTime,uAmount,uSteps,uFace,uLitOn,uLife,uRise,uDensity,uReach,uTop,uFall,uBillow,uWisp,uBright,uPlumeK,uSide;
  varying vec3 vWorld;
  uniform sampler2D tArrive; uniform vec4 uBounds; uniform float uArrival,uArrivalMap;
  /* how far the land's own colour front has passed this place (studio-highland-ecology.js stArrivalColor: the same field, the same numbers):
     below 0 the place is still grey stone, .11 and more it is in full colour */
  float fallsLead(vec2 xz){
    if(uArrival>=.9999)return 1.;
    float f=mix(.23+length(xz*vec2(1.,1.35))*.065,textureLod(tArrive,clamp((xz-uBounds.xy)*uBounds.zw,0.,1.),0.).a,uArrivalMap);
    return uArrival*1.36-f;
  }
  vec4 fieldAt(vec2 xz){ return textureLod(tField,(xz-uFieldRect.xy)*uFieldRect.zw,0.); }   /* explicit level: these reads sit inside the walk's loop */
  /* the plume: centred in front of the far curtain, 1.6x longer along the curtain than across it */
  float plumeAt(vec2 xz){ vec2 pd=xz-uPlume.xy; vec2 q=vec2(dot(pd,uRight)/1.6,dot(pd,vec2(-uRight.y,uRight.x))); return exp(-dot(q,q)/(uPlume.z*uPlume.z)); }
  float reachAt(float hn,float plume){ return (.16+.20*clamp(hn,0.,1.5)+.30*plume)*uReach; }   /* redo-w1: narrow along the sides, wide in the middle */
  float density(vec3 p,out float hn,out vec4 F){
    float h=p.y-uLevels.y; hn=h/uLevels.z;
    float over=max(p.y-uLevels.x,0.);
    F=fieldAt(p.xz-uWind*over*.55);                                           /* above the rim the cloud leans with the wind */
    float open=1.-smoothstep(-.05,.07,F.g-over*1.5);                          /* below the rim: only inside the gorge */
    float plume=plumeAt(p.xz);
    float reach=reachAt(hn,plume);
    float tall=1.+uPlume.w*plume;
    /* densest at the foot and thinning fast upward, so the streaks of the fall show through its upper two thirds (no top to trace) */
    float hz=max(hn,0.)*uFall/tall;
    float prof=(1.-smoothstep(.6*uTop,uTop,hn/tall))*exp(-pow(hz,1.6));
    /* a few soft wisps carried up past the far rim: only where the billows are high (below), never a layer, gone before the box's top */
    float wisp=uWisp*smoothstep(.80,1.04,hn)*exp(-max(hn-1.,0.)*2.2)*(1.-smoothstep(1.28,1.55,hn))*(.45+.55*plume);
    /* redo-w2: a band of spray along the whole foot, and the picture's ONE big plume: a body of its own in the middle of the pool (not only
       near the foot), long along the curtain */
    float wide=plumeAt((p.xz-uPlume.xy)*.70+uPlume.xy);   /* redo-w6: narrower: the curtain's outer thirds stay clear */   /* redo-w5: the spray along the foot is thinner at the curtain's two sides (the picture: the sides stay visible) */
    float env=((.30+.70*F.b)*exp(-F.r/reach)*(1.-smoothstep(1.9*reach,3.2*reach,F.r))*.55*mix(uSide,1.,wide)+plume*uPlumeK)*open;
    if(env*(prof+wisp)<.004)return 0.;
    float tr=uTime*uRise;
    /* fw-3: stronger sculpted cloud puffs with a clearer billow slice across the lens */
    vec2 qa=p.xz*.46+vec2(h*.36,-h*.22)-vec2(.36,-.22)*tr*.17+uWind*uTime*.022;
    vec2 qb=p.xz*1.12+vec2(-h*.48,h*.58)-vec2(-.48,.58)*tr*.24+uWind*uTime*.038;
    float n3=textureLod(tNoise,vec2(dot(p.xz,uRight)*.72+uTime*.012,h*1.10-tr*.10),0.).a;
    float n=textureLod(tNoise,qa,0.).a*.34+textureLod(tNoise,qb,0.).a*.22+n3*.44;
    /* the billows shape the cloud, they never leave a puff of their own: the density stays under its envelope and fades with it */
    float body=env*prof;
    return body*(uBillow+(1.95-uBillow)*smoothstep(.30+.22*(.16-uBillow),.78,n+body*.26))+env*wisp*smoothstep(.50,.84,n);
  }
  void main(){
    if(uAmount<.002||(uFace>0.)!=gl_FrontFacing)discard;                      /* not there yet (the entrance): nothing is walked */
    vec3 ro=cameraPosition, rd=normalize(vWorld-cameraPosition);
    vec3 inv=1./rd, t0=(uBoxMin-ro)*inv, t1=(uBoxMax-ro)*inv, tmin=min(t0,t1), tmax=max(t0,t1);
    float tn=max(max(tmin.x,tmin.y),max(tmin.z,0.)), tf=min(tmax.x,min(tmax.y,tmax.z));
    /* where the ray comes down to the land's level round the gorge (the plateau's water level, lower where FT dips the near shore and the
       river's trough: the field's fourth value): outside the rim it has met the land */
    if(rd.y<-1e-4){
      float tw=(uLevels.x-ro.y)/rd.y;
      if(tw>0.&&tw<tf){
        vec4 Fw=fieldAt(ro.xz+rd.xz*tw);
        if(Fw.a>.004){ tw=(uLevels.x-Fw.a-ro.y)/rd.y; Fw=fieldAt(ro.xz+rd.xz*tw); }
        if(Fw.g>.0&&tw<tf)tf=tw;
      }
    }
    if(tf<=tn)discard;
    float fine=2.5/uSteps;
    float jit=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    float t=tn+jit*fine, T=1.; vec3 acc=vec3(0.);
    for(int i=0;i<14;i++){
      if(float(i)>=uSteps+2.||t>=tf)break;
      vec3 p=ro+rd*t;
      float hn; vec4 F; float d=density(p,hn,F);
      if(p.y<uLevels.x-F.a-.03&&F.g>.05)break;                               /* into the far wall: rock */
      /* far from the foot: stride on (the cloud only narrows as the ray comes down); inside it the steps shorten toward the foot */
      float stepLen=max(max(fine*.55,F.r*.42),(F.r-3.2*reachAt(hn,1.))*.8);
      stepLen=mix(stepLen,fine*.85,smoothstep(.04,.25,plumeAt(p.xz)));   /* inside the plume the steps stay short */
      stepLen=min(stepLen,max(tf-t,.02));
      if(d>.003){
        float a=1.-exp(-d*uDensity*stepLen);
        a*=smoothstep(.10,.75,t);                                            /* the lens flies through it softly */
        float light=.46+.28*clamp(hn,0.,1.3);
        if(uLitOn>.5){ float h2; vec4 F2; light+=(d-density(p+uSun*.21,h2,F2))*2.35; }   /* stronger volumetric puff shading */
        /* the cloud banks' colours, slightly cooler in the shadowed undersides so billowy puffs stand out in front of the white curtain */
        vec3 c=mix(uShadeC*vec3(.74,.80,.84),uLit,clamp((light-.5)*uTone.y*1.35+.5,0.,1.))*min(uTone.x,1.)*uBright;
        acc+=T*a*c; T*=1.-a;
        if(T<.03)break;
      }
      t+=stepLen;
    }
    float alpha=(1.-T)*uAmount;
    if(alpha<.004)discard;
    vec3 col=acc/max(1.-T,1e-4);
    col=mix(vec3(dot(col,vec3(.2126,.7152,.0722))),col,smoothstep(0.,.11,fallsLead(uPlume.xy)));
    gl_FragColor=vec4(col*alpha,alpha);
  }`;

/* redo-w3 · THE PLUME'S BILLOWS: the picture's mist is a bright, lobed, rolling cloud in the middle of the pool, not a fog sheet. On top of the
   marched cloud (which keeps the soft spray along the whole foot), a few dozen soft puffs, one instanced draw: each is a lobed ball (its edge
   and its inside from the shared noise picture, turning slowly), lit as a ball by the sun (bright tops, grey undersides), rising, swelling and
   thinning over a long loop, drifting toward the lens; sorted far to near every frame (premultiplied "over"); the bottom fades where it meets
   the pool, the whole puff where the lens comes close (the dive). */
const PUFF_VERT = /* glsl */`
  attribute vec4 aBase;    /* x, y, z of the puff's start · its size (world) */
  attribute vec4 aSeed;    /* phase of its loop · lobe seed · spin · how far it rises */
  uniform float uTime,uLoop,uRiseH,uSwell;
  uniform vec2 uDrift;
  uniform vec3 uSunW;
  varying vec2 vUv; varying vec4 vS; varying vec3 vSunV; varying float vY,vLife,vNear;
  void main(){
    float life=fract(uTime/uLoop+aSeed.x);
    vLife=life; vS=aSeed; vUv=position.xy*2.;
    vec3 c=aBase.xyz+vec3(uDrift.x,0.,uDrift.y)*life+vec3(0.,uRiseH*aSeed.w*(life*.85+.15*life*life),0.);
    float size=aBase.w*(.62+uSwell*life);
    vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]), up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
    vec3 wp=c+(right*position.x+up*position.y)*size;
    vY=wp.y;
    vSunV=normalize((viewMatrix*vec4(uSunW,0.)).xyz);
    vec4 mv=viewMatrix*vec4(wp,1.);
    vNear=-mv.z;
    gl_Position=projectionMatrix*mv;
  }`;
const PUFF_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tNoise;
  uniform float uTime,uAmountP,uPoolY,uBrightP,uOpacity;
  uniform vec2 uFadeY;   /* redo-w4: the plume thins out between these heights (above the lip it dissolves into the air) */
  uniform vec3 uLit,uShadeC;
  uniform vec2 uTone;
  varying vec2 vUv; varying vec4 vS; varying vec3 vSunV; varying float vY,vLife,vNear;
  void main(){
    float d=length(vUv);
    if(d>1.)discard;
    float ang=atan(vUv.y,vUv.x), spin=uTime*.05*(vS.z-.5);
    /* lobed edge: a few big lobes and finer ones, turning slowly */
    float lob=texture2D(tNoise,vec2(ang*.159+spin+vS.y,vS.y*3.1)).a;
    float lob2=texture2D(tNoise,vec2(ang*.477-spin*1.7+vS.y*2.,vS.y*5.3+.4)).r;
    float rim=.66+.11*(lob-.5)*2.+.04*(lob2-.5)*2.;   /* redo-w4: gentle lobes */
    float inside=texture2D(tNoise,vUv*.32+vS.yz*7.+vec2(spin,-vLife*.12)).a;
    float body=smoothstep(rim+.10,rim-.78,d);   /* redo-w4: no outline: the density falls off over most of the radius */
    body*=body*(3.-2.*body)*(.80+.20*inside);
    /* lit as a ball: the side toward the sun bright, the far side grey-blue */
    vec3 n=normalize(vec3(vUv*.95+(vec2(lob,inside)-.5)*.35,sqrt(max(0.,1.-d*d))+.25));
    float light=clamp(dot(n,vSunV)*.62+.52+(inside-.5)*.3,0.,1.2);
    vec3 col=mix(uShadeC*vec3(.86,.90,.93),uLit,clamp((light-.45)*uTone.y*.95+.55,0.,1.))*min(uTone.x,1.)*uBrightP;
    /* the loop: in softly, out thinner; the bottom fades into the pool; gone when the lens is close */
    float env=smoothstep(0.,.18,vLife)*(1.-smoothstep(.62,1.,vLife));
    float a=body*env*uOpacity*uAmountP*smoothstep(uPoolY-.02,uPoolY+.20,vY)*(1.-smoothstep(uFadeY.x,uFadeY.y,vY))*smoothstep(.6,2.2,vNear);
    if(a<.003)discard;
    gl_FragColor=vec4(col*a,a);
  }`;

function createPlumePuffs(THREE, shared, uniformsCloud, place) {
  const U = shared.uniforms;
  const COUNT = 40;
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.attributes.position);
  const base = new Float32Array(COUNT * 4), seed = new Float32Array(COUNT * 4);
  const aBase = new THREE.InstancedBufferAttribute(base, 4), aSeed = new THREE.InstancedBufferAttribute(seed, 4);
  aBase.setUsage(THREE.DynamicDrawUsage); aSeed.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aBase', aBase); geo.setAttribute('aSeed', aSeed); geo.instanceCount = COUNT;
  let rnd = 1234567;
  const r = () => { rnd = (Math.imul(rnd ^ (rnd >>> 15), 2246822507) + 0x9E3779B9) >>> 0; rnd ^= rnd >>> 13; return (Math.imul(rnd, 3266489909) >>> 0) / 4294967296; };
  const puffs = [];
  function lay(p) {
    puffs.length = 0;
    for (let i = 0; i < COUNT; i++) {
      /* a disc elongated along the curtain, denser in the middle; bigger puffs low and in the middle */
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * (.25 + .75 * r());
      const along = Math.cos(a) * rr * p.len, across = Math.sin(a) * rr * p.wid;
      const x = p.cx + p.right[0] * along + p.far[0] * across, z = p.cz + p.right[1] * along + p.far[1] * across;
      const mid = 1 - rr;
      puffs.push({ x, y: p.y0 + r() * p.h0, z, size: p.size * (.55 + .55 * r()) * (.8 + .4 * mid), seed: [r(), r(), r(), .45 + .75 * r() * (.5 + .5 * mid)] });
    }
  }
  lay(place);
  const material = new THREE.ShaderMaterial({
    name: 'Rise falls plume billows', vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG,
    uniforms: {
      tNoise: U.tNoise, uTime: U.uTime, uLoop: { value: 14 }, uRiseH: { value: place.rise }, uSwell: { value: .85 }, uDrift: { value: new THREE.Vector2(place.drift[0], place.drift[1]) },
      uSunW: U.uSun, uAmountP: { value: 1 }, uPoolY: { value: place.poolY }, uFadeY: { value: new THREE.Vector2(place.fade[0], place.fade[1]) }, uBrightP: { value: .92 }, uOpacity: { value: .55 },
      uLit: uniformsCloud.uLit, uShadeC: uniformsCloud.uShadeC, uTone: uniformsCloud.uTone
    },
    transparent: true, depthTest: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor
  });
  material.userData.handlesArrival = true;
  const mesh = new THREE.Mesh(geo, material); mesh.name = 'Rise falls plume billows (instanced puffs)'; mesh.frustumCulled = false; mesh.renderOrder = 19;
  const order = puffs.map((_, i) => i), depth = new Float32Array(COUNT), tmp = new THREE.Vector3();
  let lastKey = '';
  function sort(camera) {
    if (!camera) return;
    const e = camera.matrixWorldInverse.elements;
    for (let i = 0; i < COUNT; i++) { const p = puffs[i]; depth[i] = e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14]; }   /* view z (more negative = farther) */
    order.sort((a, b) => depth[a] - depth[b]);
    const key = order.join(','); if (key === lastKey) return; lastKey = key;
    order.forEach((i, k) => { const p = puffs[i]; base.set([p.x, p.y, p.z, p.size], k * 4); seed.set(p.seed, k * 4); });
    aBase.needsUpdate = true; aSeed.needsUpdate = true; void tmp;
  }
  return {
    mesh, material,
    relay(p) { lay(p); lastKey = ''; material.uniforms.uRiseH.value = p.rise; material.uniforms.uPoolY.value = p.poolY; material.uniforms.uDrift.value.set(p.drift[0], p.drift[1]); material.uniforms.uFadeY.value.set(p.fade[0], p.fade[1]); },
    setCount(n) { geo.instanceCount = Math.max(0, Math.min(COUNT, n | 0)); },
    update(camera, { amount = 1, opacity = .55, bright = .92, loop = 14 } = {}) {
      sort(camera);
      material.uniforms.uAmountP.value = amount; material.uniforms.uOpacity.value = opacity; material.uniforms.uBrightP.value = bright; material.uniforms.uLoop.value = Math.max(3, loop);
      mesh.visible = amount * opacity > .002;
    },
    dispose() { geo.dispose(); quad.dispose(); material.dispose(); }
  };
}

export function createFallsMist(shared) {
  const { tune, studio } = shared, U = shared.uniforms;
  const group = new THREE.Group(); group.name = 'Rise falls mist';
  const TOP = 1.6;                                    /* the cloud is gone at this many drops above the pool (at its tallest) */
  const PLUME_IN = .62;                               /* redo-w2: the plume's middle, this far in front of the far curtain's foot */
  function computeBounds(G, S) {
    const H = G.H;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, cx = 0, cz = 0, cw = 0;
    for (const q of G.feet) { const w = q.flow * q.end; if (w < .05) continue; x0 = Math.min(x0, q.fx); x1 = Math.max(x1, q.fx); z0 = Math.min(z0, q.fz); z1 = Math.max(z1, q.fz); cx += q.fx * w; cz += q.fz * w; cw += w; }
    if (!Number.isFinite(x0)) { x0 = G.rect[0]; x1 = G.rect[2]; z0 = G.rect[1]; z1 = G.rect[3]; cx = S.centre[0]; cz = S.centre[1]; cw = 1; }
    const R = 1.45;
    const min = new THREE.Vector3(Math.max(x0 - R, G.rect[0]), S.poolY, Math.max(z0 - R, G.rect[1]));
    const max = new THREE.Vector3(Math.min(x1 + R, G.rect[2]), S.poolY + H * TOP, Math.min(z1 + R, G.rect[3]));
    const frame = S.frame;
    let px = cx / cw, pz = cz / cw;
    if (frame?.far) { let best = null, bd = -Infinity; for (const q of G.feet) { const d = (q.fx - S.centre[0]) * frame.far[0] + (q.fz - S.centre[1]) * frame.far[1]; if (d > bd) { bd = d; best = q; } } if (best) { px = best.fx - frame.far[0] * PLUME_IN; pz = best.fz - frame.far[1] * PLUME_IN; } }
    const plume = new THREE.Vector4(px, pz, Math.max(.6, (x1 - x0 + z1 - z0) * .11), .45);
    const size = new THREE.Vector3().subVectors(max, min);
    const geo = new THREE.BoxGeometry(Math.max(.1, size.x), Math.max(.1, size.y), Math.max(.1, size.z));
    geo.translate((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    return { min, max, plume, geo };
  }
  const init = computeBounds(shared.G, shared.S);
  const { min, max, plume } = init;
  const clouds = studio?.mistGroup?.material?.uniforms;      /* the cloud banks' own colours, live */
  const frame = shared.S.frame;
  const wind = frame?.far && frame?.right ? new THREE.Vector2(-frame.far[0] * .55 - frame.right[0] * .83, -frame.far[1] * .55 - frame.right[1] * .83) : new THREE.Vector2(-.9, .42);   /* toward the lens and the left of the frame */
  const uniforms = {
    tNoise: U.tNoise, tField: U.tField, uFieldRect: U.uFieldRect, uLevels: U.uLevels, uTime: U.uTime, uSun: U.uSun, uLife: U.uLife,
    tArrive: U.tArrive, uBounds: U.uBounds, uArrival: U.uArrival, uArrivalMap: U.uArrivalMap,
    uBoxMin: { value: min }, uBoxMax: { value: max }, uWind: { value: wind }, uPlume: { value: plume },
    uRight: { value: frame?.right ? new THREE.Vector2(frame.right[0], frame.right[1]).normalize() : new THREE.Vector2(.79, .61) },
    uLit: clouds?.uCloudLit || { value: new THREE.Vector3(1, 1, 1) }, uShadeC: clouds?.uCloudShade || { value: new THREE.Vector3(.75, .81, .85) },
    uTone: clouds?.uCloudTone || { value: new THREE.Vector2(1.1, .9) },
    uAmount: { value: 1 }, uSteps: { value: 10 }, uFace: { value: 1 }, uLitOn: { value: 1 }, uRise: { value: 1 }, uDensity: { value: 2.6 }, uReach: { value: 1 }, uTop: { value: TOP }, uFall: { value: 3.6 }, uBillow: { value: .16 },
    uWisp: { value: .22 }, uBright: { value: .84 }, uPlumeK: { value: .9 }, uSide: { value: .4 }
  };
  const material = new THREE.ShaderMaterial({
    name: 'Rise falls mist', vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    forceSinglePass: true,   /* three draws a see-through double-sided mesh twice (back faces, then front, each time as "front-facing"): the cloud must be walked once */
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor
  });
  material.userData.handlesArrival = true;
  const mesh = new THREE.Mesh(init.geo, material); mesh.name = 'Rise falls mist (one marched cloud)'; mesh.frustumCulled = false; mesh.renderOrder = 18;
  group.add(mesh);
  /* redo-w3: the plume's billows (?fallsPuffs=0 = the marched cloud alone) */
  const placeOf = (G, S, pv) => { const fr = S.frame || { right: [.79, .61], far: [.61, -.79] }, H = Math.min(1.25, Math.max(.6, G.H));   /* sliders: the billows keep a sane size at any depth */ return { cx: pv.x, cz: pv.y, right: fr.right, far: fr.far, len: pv.z * 1.10, wid: pv.z * .85, y0: S.poolY + .06, h0: H * .34, size: H * 1.05, rise: H * 1.15, poolY: S.poolY, drift: [-fr.far[0] * .62, -fr.far[1] * .62], fade: [S.poolY + H * 1.0, S.poolY + H * 1.75] };   /* redo-w4: bigger, its top spills over the lip and drifts out over the pool */   /* concentrated in the middle, tall (the picture's plume) */ };
  const puffsOn = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('fallsPuffs') === '0');
  const puffs = puffsOn ? createPlumePuffs(THREE, shared, uniforms, placeOf(shared.G, shared.S, plume)) : null;
  if (puffs) group.add(puffs.mesh);
  let amount = 1;
  return {
    group, uniforms, box: { min, max },
    rebuild(G, S) {
      const next = computeBounds(G, S);
      min.copy(next.min); max.copy(next.max); plume.copy(next.plume);
      puffs?.relay(placeOf(G, S, plume));
      const old = mesh.geometry; mesh.geometry = next.geo; old?.dispose();
    },
    setAmount(k) { amount = Math.min(1, Math.max(0, +k || 0)); uniforms.uAmount.value = Math.min(1, amount * Math.max(0, +tune.mist || 0)); },
    setQuality({ steps = 10, lit = true } = {}) { uniforms.uSteps.value = Math.min(12, Math.max(3, steps)); uniforms.uLitOn.value = lit ? 1 : 0; puffs?.setCount(steps >= 9 ? 40 : steps >= 6 ? 28 : 18); },
    apply() { },
    update(frame, { camera, dive = 0 } = {}) {
      /* redo-w5: as the lens dives in, the plume thins (it stacked with the dive's own centre light into a blown-out white) */
      const diveK = 1 - .6 * Math.min(1, Math.max(0, (dive - .02) / .3));
      uniforms.uAmount.value = Math.min(1, amount * Math.max(0, +tune.mist || 0)) * diveK;
      uniforms.uDensity.value = 3 * Math.max(.2, +tune.mist || 0);
      uniforms.uRise.value = +tune.mistRise || 0;
      uniforms.uFall.value = 2.9 / Math.max(.3, +tune.mistHeight || 1); uniforms.uReach.value = Math.max(.3, +tune.mistReach || 1);
      uniforms.uBillow.value = Math.min(.6, Math.max(0, +tune.mistSoft || 0));
      uniforms.uWisp.value = Math.max(0, Number.isFinite(+tune.mistWisp) ? +tune.mistWisp : .22);
      uniforms.uPlume.value.w = Math.max(0, Number.isFinite(+tune.mistPlume) ? +tune.mistPlume : .45);
      uniforms.uBright.value = Math.max(0, Number.isFinite(+tune.mistBright) ? +tune.mistBright : .84);
      uniforms.uPlumeK.value = Math.max(0, Number.isFinite(+tune.mistBody) ? +tune.mistBody : .9);
      uniforms.uSide.value = Math.max(0, Number.isFinite(+tune.mistSides) ? +tune.mistSides : .4);
      const p = camera?.position;
      const inside = !!p && p.x > min.x - .06 && p.x < max.x + .06 && p.y > min.y - .06 && p.y < max.y + .06 && p.z > min.z - .06 && p.z < max.z + .06;
      uniforms.uFace.value = inside ? -1 : 1;
      if (material.depthTest === inside) material.depthTest = !inside;
      const nb = (v, d) => Number.isFinite(+v) ? +v : d;
      puffs?.update(camera, { amount: amount * amount * diveK, opacity:   /* redo-w5: the billows come in after the water has (no cloud in an empty gorge at mid-arrival) */ Math.max(0, nb(tune.mistPuffs, .55)), bright: Math.max(0, nb(tune.mistPuffBright, .92)), loop: 14 / Math.max(.2, nb(tune.mistRise, 1)) });
    },
    stats() { return { drawCalls: puffs ? 2 : 1, triangles: 12 + (puffs ? puffs.mesh.geometry.instanceCount * 2 : 0), steps: uniforms.uSteps.value, puffs: puffs ? puffs.mesh.geometry.instanceCount : 0 }; },
    dispose() { mesh.geometry?.dispose(); material.dispose(); puffs?.dispose(); group.removeFromParent(); }
  };
}
