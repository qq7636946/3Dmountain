/** Optional live controls; omitted configuration preserves the original studies. */
export const WATERSHED_FLOW_DEFAULTS = Object.freeze({
  count: 1, width: .065, brightness: 1, speed: 1, glow: .65,
  color: '#dcecf4', mist: .6,
  // Light-line shaping (read only when a page passes flowConfig; pages that
  // omit it keep the original seven blue filaments untouched):
  // core = crispness of the white-hot centre, halo = width of the soft
  // falloff that spills over the water, pulse = travelling comet packets,
  // sparkle = sun glints riding the current, join = extra light where rivers
  // meet, meander = how much the strands braid, depth = fade into valley haze.
  core: .6, halo: .7, pulse: .85, sparkle: .5, join: 1, meander: .6, depth: .75
});

/** Locally bounded, terrain-occluded light carried by the five actual rivers. */
export function createConfluenceEffects(THREE, { paths = [], sampleHeight = () => 0, lite = false, joins = [], flowConfig = null } = {}) {
  const group = new THREE.Group();
  group.name = 'Five currents · luminous filaments and valley atmosphere';
  const geometries = [], materials = [], textures = [];
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const fract = x => x - Math.floor(x);
  const random = n => fract(Math.sin(n * 127.1 + 51.713) * 43758.5453);
  const channels = paths.filter(p => p?.curve && typeof p.widthAt === 'function');
  const refined = flowConfig !== null;
  const flowValue = (key, min, max) => {
    const value = Number(flowConfig?.[key] ?? WATERSHED_FLOW_DEFAULTS[key]);
    return clamp(Number.isFinite(value) ? value : WATERSHED_FLOW_DEFAULTS[key], min, max);
  };
  const flowColor = new THREE.Color(WATERSHED_FLOW_DEFAULTS.color);
  let lastFlowColor = null;
  const uniforms = {
    uTime: { value: 0 }, uFlowTravel: { value: 0 }, uReveal: { value: 0 }, uConfluence: { value: 0 },
    uCurveMap: { value: null }, uCurveRows: { value: Math.max(1, channels.length) },
    uCurveSamples: { value: lite ? 192 : 384 },
    uFlowCount: { value: 1 }, uFlowWidth: { value: .065 },
    uFlowBrightness: { value: 1 }, uFlowSpeed: { value: 1 },
    uFlowGlow: { value: .65 }, uFlowColor: { value: flowColor }, uMist: { value: .6 }
  };
  if (refined) Object.assign(uniforms, {
    uFlowCore: { value: WATERSHED_FLOW_DEFAULTS.core }, uFlowHalo: { value: WATERSHED_FLOW_DEFAULTS.halo },
    uFlowPulse: { value: WATERSHED_FLOW_DEFAULTS.pulse }, uFlowSparkle: { value: WATERSHED_FLOW_DEFAULTS.sparkle },
    uFlowJoin: { value: WATERSHED_FLOW_DEFAULTS.join }, uFlowMeander: { value: WATERSHED_FLOW_DEFAULTS.meander },
    uFlowDepth: { value: WATERSHED_FLOW_DEFAULTS.depth }
  });
  let disposed = false, previousTime = null, motionTime = 0, flowTravel = 0;
  const pointAt = (curve, t) => curve.getPointAt(clamp(t));
  const tangentAt = (curve, t) => curve.getTangentAt(clamp(t));
  const widths = (channel, t) => Math.max(1, channel.widthAt(clamp(t)));
  const commonFragment = /* glsl */`
    uniform float uTime, uFlowTravel, uReveal, uConfluence;
    uniform float uFlowCount, uFlowWidth, uFlowBrightness, uFlowSpeed, uFlowGlow, uMist;
    uniform vec3 uFlowColor;${refined ? `
    uniform float uFlowCore, uFlowHalo, uFlowPulse, uFlowSparkle, uFlowJoin, uFlowMeander, uFlowDepth;` : ''}
    float hash21(vec2 p) { p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float noise21(vec2 p) {
      vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.)),f.x),f.y);
    }
  `;
  function geometryWith(attributes, indices) {
    const geometry = new THREE.BufferGeometry();
    for (const [name, [data, size]] of Object.entries(attributes)) geometry.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
    if (indices) geometry.setIndex(indices);
    geometry.computeBoundingSphere(); geometries.push(geometry); return geometry;
  }
  function shader(name, vertexShader, fragmentShader, extra = {}) {
    const material = new THREE.ShaderMaterial({
      name, uniforms, vertexShader, fragmentShader, transparent: true,
      depthTest: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, toneMapped: false, ...extra
    });
    materials.push(material); return material;
  }

  // A shared strip mesh follows each river's real arc length and half-width.
  // Only thin strands emit: the spaces between them retain the original water.
  const ribbonPosition = [], ribbonFlow = [], ribbonEnds = [], ribbonIndex = [];
  const lengths = channels.map(p => Math.max(1, p.curve.getLength()));
  let ribbonVertexCount = 0;
  channels.forEach((channel, pathIndex) => {
    const length = lengths[pathIndex];
    // A drainage-wide distance makes the moving crest continuous at seams.
    // Tributaries use the trunk distance at their mouth as the phase anchor.
    const flowOffset = refined && Number.isFinite(channel.flowOffset) ? channel.flowOffset : 0;
    const startFade = refined ? Math.max(0, channel.flowStartFade ?? 56) : 0;
    const endFade = refined ? Math.max(0, channel.flowEndFade ?? 56) : 0;
    const rows = Math.round(clamp(length / (lite ? 26 : 17), 100, lite ? 460 : 760));
    const columns = lite ? 4 : 8, first = ribbonVertexCount;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows, center = pointAt(channel.curve, t), tangent = tangentAt(channel.curve, t);
      const horizontal = Math.hypot(tangent.x, tangent.z) || 1;
      const nx = -tangent.z / horizontal, nz = tangent.x / horizontal, width = widths(channel, t) * .93;
      // Refined only: how close this cross-section sits to a confluence, so
      // the light can gather and swell where two currents merge.
      let joinGlow = 0;
      if (refined) for (const j of joins) {
        const reach = Math.max(120, width * 2.6), dx = center.x - j.x, dz = center.z - j.z;
        joinGlow = Math.max(joinGlow, Math.exp(-(dx * dx + dz * dz) / (reach * reach)));
      }
      for (let column = 0; column <= columns; column++) {
        const lane = column / columns * 2 - 1;
        ribbonPosition.push(center.x + nx * width * lane, refined ? 3.6 : 2.2, center.z + nz * width * lane);
        ribbonFlow.push(lane, t * length + flowOffset, t, refined ? joinGlow : pathIndex * 4.713 + .9);
        ribbonEnds.push(startFade > 0 ? smooth(0, startFade, t * length) : 1,
          endFade > 0 ? smooth(0, endFade, (1 - t) * length) : 1);
        ribbonVertexCount++;
      }
      if (row < rows) for (let column = 0; column < columns; column++) {
        const a = first + row * (columns + 1) + column, b = a + columns + 1;
        ribbonIndex.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  });
  if (ribbonVertexCount) {
    const geometry = geometryWith({ position: [ribbonPosition, 3], aFlow: [ribbonFlow, 4], aEnds: [ribbonEnds, 2] }, ribbonIndex);
    const refinedVertex = /* glsl */`
      attribute vec4 aFlow; attribute vec2 aEnds;
      varying vec4 vFlow; varying vec2 vEnds;
      #include <fog_pars_vertex>
      void main(){
        vFlow=aFlow; vEnds=aEnds;
        vec4 mvPosition=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }
    `;
    const originalVertex = /* glsl */`
      attribute vec4 aFlow; attribute vec2 aEnds;
      varying vec4 vFlow; varying vec2 vEnds;
      void main(){ vFlow=aFlow; vEnds=aEnds; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
    `;
    const material = shader(refined ? 'Ice silver · continuous river current' : 'River-bound electric blue filaments', refined ? refinedVertex : originalVertex, commonFragment + (refined ? /* glsl */`
      varying vec4 vFlow; varying vec2 vEnds;
      #include <fog_pars_fragment>
      float hash11(float n){ return fract(sin(n*127.1+51.713)*43758.5453); }
      float bell(float d,float s){ return exp(-.5*d*d/(s*s)); }
      // One layer of sun glints: a sparse random point per (distance, lane)
      // cell, drifting a little slower than the light. Point size never drops
      // under a pixel; sub-pixel points dim by the square root of their
      // coverage, so they read as a single catching pixel rather than vanish.
      float glints(float distance,float lane,float cellLength,float laneCells,float density,float seed){
        vec2 g=vec2((distance-uFlowTravel*.45)/cellLength,(lane+1.)*laneCells);
        vec2 id=floor(g), fr=fract(g);
        float r=hash21(id+seed);
        vec2 at=vec2(hash21(id+seed+3.1),hash21(id+seed+7.7))*.7+.15;
        vec2 px=vec2(length(vec2(dFdx(g.x),dFdy(g.x))),length(vec2(dFdx(g.y),dFdy(g.y))));
        vec2 size=max(vec2(.05,.09),px*.75);
        vec2 q=(fr-at)/size;
        float twinkle=pow(.5+.5*sin(uTime*(1.6+3.2*r)+r*61.),8.);
        float cover=sqrt((.05/size.x)*(.09/size.y));
        // Cells smaller than ~3 px would shimmer: fade that layer out.
        float resolved=1.-smoothstep(.22,.40,max(px.x,px.y));
        return exp(-dot(q,q))*twinkle*step(1.-density,r)*cover*resolved;
      }
      void main() {
        if(uFlowCount < .5 || uFlowBrightness <= .0) discard;
        float lane=vFlow.x, distance=vFlow.y, join=clamp(vFlow.w,0.,1.)*uFlowJoin;
        // Screen-space footprint of one pixel in lane units / world metres.
        // Gradient length, not fwidth: fwidth's L1 sum over-widens diagonal reaches.
        float aa=max(length(vec2(dFdx(lane),dFdy(lane))),.0015), along=max(length(vec2(dFdx(distance),dFdy(distance))),.001);
        float n=uFlowCount, pulse=clamp(uFlowPulse,0.,1.5), steady=clamp(pulse,0.,1.);
        float spread=min(.27,.95/n);
        float w=max(uFlowWidth,.004);
        vec3 white=vec3(.97,.985,1.);
        vec3 haloTint=uFlowColor*vec3(.80,.90,1.04);
        vec3 line=vec3(0.), glow=vec3(0.);
        float haloSum=0., packetSum=0., heads=0.;
        for(int i=0; i<5; i++) {
          float f=float(i);
          if(f >= n) break;
          float h1=hash11(f*7.13+1.7), h2=hash11(f*3.71+9.2), h3=hash11(f*5.29+4.4);
          // Strands braid slowly around their lane; the phase is world
          // distance, so the weave is continuous across every confluence and
          // the strands draw together as two rivers meet.
          float center=(f-(n-1.)*.5)*spread*(1.-.35*clamp(join,0.,1.));
          center+=uFlowMeander*(.065*sin(distance*.0092+f*2.4+h1*3.)+.025*sin(distance*.023-f*1.7+1.3));
          float d=abs(lane-center);
          // Comet packets: every strand has its own speed and spacing, so
          // they overtake one another. All share the drainage-wide distance
          // clock, so nothing reverses or restarts at a confluence.
          float adv=(distance-uFlowTravel*(.80+.40*h1))/(520.+340.*h2)+h3;
          float ph=fract(adv), phAA=max(fwidth(adv)*1.25,.002);
          const float H=.86;
          float L=.34+.26*h2;
          float tail=pow(clamp(1.-(H-ph)/L,0.,1.),2.2);
          float front=1.-smoothstep(H,H+.028+phAA,ph);
          float packet=mix(tail,front,step(H,ph));
          float head=bell(ph-H+.006,.011+phAA)*step(.001,pulse);
          float energy=mix(.62,.28+packet*.95,steady)+head*.85*pulse;
          // Tapered: the light is widest in the bright body of a packet,
          // thins to a thread in its tail and rounds off at its head.
          float sw=w*mix(1.,mix(.58,1.14,packet),steady);
          // Core stays crisp at any distance: never thinner than a pixel,
          // and its energy is conserved when the pixel floor widens it.
          float coreSigma=sw*mix(.50,.20,clamp(uFlowCore,0.,1.));
          float coreS=max(coreSigma,aa*.50);
          float keep=mix(1.,coreSigma/coreS,.5);
          float core=bell(d,coreS)*keep;
          float shoulder=bell(d,max(sw*.60,aa*.9));
          // Soft optical falloff (Lorentzian squared), not a band: a long,
          // faint reach over the water instead of a hard edge.
          float hw=max(sw*1.1+uFlowHalo*.09,aa*2.);
          float x=d/hw, halo=1./((1.+x*x)*(1.+x*x));
          line+=white*core*energy*(.95+.5*uFlowCore)+uFlowColor*shoulder*energy*.11;
          glow+=haloTint*halo*(.05+.24*packet*steady+head*.3*pulse);
          heads+=head*core;
          haloSum+=halo*(.35+.65*packet); packetSum+=packet;
        }
        // Light spilling onto the water itself: a broad, faint sheen that
        // brightens as packets pass and pools where currents join.
        float sheen=exp(-lane*lane*2.4)*(.025+.06*min(packetSum,1.)*steady+.15*join);
        glow=glow*uFlowGlow*(.5+.6*uFlowHalo)+haloTint*sheen*uFlowGlow*uFlowHalo;
        // Pulse heads run hot enough to catch the bloom pass: a travelling
        // point of light rather than a brighter stretch of tape.
        line+=vec3(1.,.995,.985)*heads*pulse*1.35;
        #ifndef FLOW_LITE
        // Sun glints riding the current: a fine layer for close reaches and a
        // coarse, sparser one that still resolves from the aerial height.
        float sparkle=glints(distance,lane,34.,4.5,.58,17.3)+glints(distance,lane,150.,2.2,.45,41.9)*.9;
        line+=white*sparkle*uFlowSparkle*3.*clamp(haloSum*2.+.2,0.,1.);
        #endif
        // Confluences gather light.
        line*=1.+join*.40; glow*=1.+join*.75;
        float ends=vEnds.x*vEnds.y;
        // Lines fade just short of the bank; the halo fades earlier so the
        // flat light never meets the rock in a hard, occluded seam.
        float edgeLine=1.-smoothstep(.84,.98,abs(lane));
        float edgeSoft=1.-smoothstep(.40,.96,abs(lane));
        vec3 emission=(line*edgeLine+glow*edgeSoft)*ends*uReveal*uFlowBrightness;
        // Distant reaches sink into the valley haze instead of reading as
        // bright tape at the horizon.
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogAmount=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
          #else
            float fogAmount=smoothstep(fogNear,fogFar,vFogDepth);
          #endif
          emission*=1.-clamp(fogAmount*1.35,0.,1.)*uFlowDepth;
        #endif
        if(max(emission.r,max(emission.g,emission.b))<.0015) discard;
        gl_FragColor=vec4(emission,1.);
        #include <colorspace_fragment>
      }
    ` : /* glsl */`
      varying vec4 vFlow;
      void main() {
        float lane=vFlow.x, distance=vFlow.y, seed=vFlow.w;
        float core=0., shoulder=0., halo=0.;
        float advect=distance-uTime*(43.+seed*.45);
        // Seven slightly wandering streamlets. World-space waves stay equally
        // fine on the short original river and the much longer tributaries.
        for(int i=0;i<7;i++) {
          float f=float(i), phase=f*1.713+seed;
          float center=(f-3.)*.225;
          center+=sin(distance*.0081+phase)*.055+sin(distance*.021-phase*.7)*.018;
          float d=abs(lane-center);
          float aa=max(fwidth(lane)*.62,.0018);
          float fineWidth=.0045+.0028*sin(phase)*sin(phase);
          float line=1.-smoothstep(fineWidth,fineWidth+aa,d);
          float bright=pow(.5+.5*sin(advect*.028+phase*2.),9.);
          float broken=mix(.17,1.,smoothstep(.25,.70,noise21(vec2(advect*.008+phase,phase))));
          core+=line*(.26+bright*.74)*broken;
          shoulder+=exp(-d*d/.00065)*(.24+bright*.48)*broken;
          halo+=exp(-d*d/.0064)*(.12+bright*.17)*broken;
        }
        float ends=smoothstep(0.,.009,vFlow.z)*(1.-smoothstep(.985,1.,vFlow.z));
        float edge=1.-smoothstep(.86,.99,abs(lane));
        float strength=(core*.78+shoulder*.39+halo*.20)*ends*edge*uReveal;
        if(strength<.003) discard;
        vec3 blue=vec3(.018,.225,.94);
        vec3 cyan=vec3(.13,.74,1.15);
        vec3 white=vec3(.73,.95,1.08);
        vec3 color=mix(blue,cyan,clamp(shoulder*.85,0.,.7));
        color=mix(color,white,clamp(core*.70,0.,.89));
        gl_FragColor=vec4(color,min(strength,.94));
        #include <colorspace_fragment>
      }
    `), refined ? {
      // The refined current reads the scene's own fog so far reaches recede.
      uniforms: { ...uniforms, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) }, fog: true,
      defines: lite ? { FLOW_LITE: '' } : {}
    } : {});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = refined ? 'Continuous ice currents · adjustable 0 to 5 per valley' : 'Seven narrow blue currents per valley'; mesh.renderOrder = 4; group.add(mesh);
  }

  // GPU particles sample the same curves, keeping every square in its channel.
  const samples = uniforms.uCurveSamples.value;
  const curveData = new Float32Array(samples * Math.max(1, channels.length) * 4);
  channels.forEach((channel, index) => {
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1), p = pointAt(channel.curve, t), offset = (index * samples + i) * 4;
      curveData.set([p.x, 5.2, p.z, widths(channel, t)], offset);
    }
  });
  const curveTexture = new THREE.DataTexture(curveData, samples, Math.max(1, channels.length), THREE.RGBAFormat, THREE.FloatType);
  curveTexture.minFilter = THREE.NearestFilter; curveTexture.magFilter = THREE.NearestFilter;
  curveTexture.generateMipmaps = false; curveTexture.needsUpdate = true;
  textures.push(curveTexture); uniforms.uCurveMap.value = curveTexture;
  const particlePositions = [], particleFlows = [], particlePaths = [], particleRates = [];
  const particlesPerPath = refined ? 0 : lite ? 13 : 25;
  channels.forEach((channel, pathIndex) => {
    for (let i = 0; i < particlesPerPath; i++) {
      const seed = (pathIndex + 1) * 93.47 + i * 8.371, t = (i + random(seed)) / particlesPerPath;
      const p = pointAt(channel.curve, t);
      particlePositions.push(p.x, 6, p.z);
      particleFlows.push(t, random(seed + 8), (random(seed + 19) * 2 - 1) * .74, 1.9 + random(seed + 35) * 2.8);
      particlePaths.push(pathIndex); particleRates.push((24 + random(seed + 27) * 24) / lengths[pathIndex]);
    }
  });
  if (particlePaths.length) {
    const geometry = geometryWith({ position: [particlePositions, 3], aFlow: [particleFlows, 4], aPath: [particlePaths, 1], aRate: [particleRates, 1] });
    const material = shader('Sparse square glints advected on each river', /* glsl */`
      uniform float uTime,uReveal,uCurveRows,uCurveSamples;
      uniform sampler2D uCurveMap;
      attribute vec4 aFlow; attribute float aPath,aRate;
      varying float vAlpha,vSeed;
      vec4 sampleCurve(float t) {
        float sampleIndex=clamp(t,0.,1.)*(uCurveSamples-1.);
        float low=floor(sampleIndex), row=(aPath+.5)/uCurveRows;
        vec4 a=texture2D(uCurveMap,vec2((low+.5)/uCurveSamples,row));
        vec4 b=texture2D(uCurveMap,vec2((min(low+1.,uCurveSamples-1.)+.5)/uCurveSamples,row));
        return mix(a,b,fract(sampleIndex));
      }
      void main() {
        float t=fract(aFlow.x+uTime*aRate), dt=1./(uCurveSamples-1.);
        vec4 c=sampleCurve(t); vec3 tangent=sampleCurve(min(1.,t+dt)).xyz-sampleCurve(max(0.,t-dt)).xyz;
        vec2 normal=normalize(vec2(-tangent.z,tangent.x));
        vec3 p=c.xyz; p.xz+=normal*c.w*aFlow.z;
        p.y+=2.+sin(t*49.+aFlow.y*16.)*1.2;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(aFlow.w*2300./max(240.,-mv.z),1.1,4.8);
        float twinkle=.35+.65*pow(.5+.5*sin(uTime*2.7+aFlow.y*39.),5.);
        vAlpha=uReveal*twinkle*smoothstep(0.,.015,t)*(1.-smoothstep(.985,1.,t));vSeed=aFlow.y;
      }
    `, /* glsl */`
      varying float vAlpha,vSeed;
      void main(){
        vec2 p=abs(gl_PointCoord-.5);float edge=1.-smoothstep(.30,.50,max(p.x,p.y));
        gl_FragColor=vec4(mix(vec3(.055,.45,1.),vec3(.65,.93,1.),vSeed),edge*vAlpha*.86);
        #include <colorspace_fragment>
      }
    `);
    const points = new THREE.Points(geometry, material);
    points.name = 'Sparse tiny downstream square particles'; points.frustumCulled = false; points.renderOrder = 6; group.add(points);
  }

  const sourceChannels = channels.length >= 6 ? [channels[5], ...channels.slice(1, 5)] : channels.slice(0, 5);
  const sourcePoints = sourceChannels.map((channel, index) => {
    const t = index === 0 ? .58 : .46 + index * .035, p = pointAt(channel.curve, t);
    return { x: p.x, y: 2.3, z: p.z, seed: index * 2.37, width: widths(channel, t) };
  });

  // Small low-lying fog islands are actual world planes with terrain occlusion.
  // They sit in sheltered pockets, never as a screen-space veil over the title.
  const mistPatches = [];
  channels.slice(1, 5).forEach((channel, index) => {
    const t = .57 + index * .039, p = pointAt(channel.curve, t), tangent = tangentAt(channel.curve, t);
    const normalLength = Math.hypot(tangent.x, tangent.z) || 1;
    const bankSide = index % 2 ? -1 : 1, offset = widths(channel, t) * .81;
    const x = p.x - tangent.z / normalLength * offset * bankSide;
    const z = p.z + tangent.x / normalLength * offset * bankSide;
    mistPatches.push({ x, y: Math.max(9, sampleHeight(x, z) + 5), z, rx: 88 + index * 11, rz: 154 + index * 15, seed: index + 1, opacity: .115 });
  });
  const joinPatches = joins.map((p, index) => ({ x: p.x, y: 2.7, z: p.z, rx: 76 + index * 7, rz: 116 + index * 9, seed: index + 2, opacity: .53 }));
  sourcePoints.forEach((p, index) => joinPatches.push({ ...p, rx: 19, rz: 33, seed: index + 9, opacity: .39 }));
  function patchMesh(patches, mist) {
    if (!patches.length) return;
    const positions = [], uv = [], info = [], indices = [];
    for (let i = 0; i < patches.length; i++) {
      const p = patches[i];
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        positions.push(p.x + p.rx * x, p.y, p.z + p.rz * z);
        uv.push(x, z); info.push(p.seed, p.opacity);
      }
      const k = i * 4; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
    const geometry = geometryWith({ position: [positions, 3], aPatchUv: [uv, 2], aInfo: [info, 2] }, indices);
    const material = shader(mist ? 'Sheltered blue valley mist' : 'Local confluence radiance', /* glsl */`
      attribute vec2 aPatchUv,aInfo; varying vec2 vPatch,vInfo;
      void main(){vPatch=aPatchUv;vInfo=aInfo;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `, commonFragment + /* glsl */`
      varying vec2 vPatch,vInfo;
      void main(){
        float r=dot(vPatch,vPatch), mask=1.-smoothstep(.25,1.,r);
        float turbulence=noise21(vPatch*3.3+vec2(uTime*.037+vInfo.x,-uTime*.026));
        ${mist ? `
          float alpha=mask*(.25+turbulence*.75)*vInfo.y*uReveal;
          vec3 color=${refined ? 'mix(uFlowColor,vec3(.60,.67,.73),.42)' : 'vec3(.17,.34,.59)'};
          ${refined ? 'alpha*=uMist;' : ''}
        ` : `
          float bloom=exp(-r*5.5), center=exp(-r*43.);
          float pulse=.84+.16*sin(uTime*1.7+vInfo.x*3.1);
          float alpha=(bloom*.48+center*.34)*mask*(.78+turbulence*.22)*vInfo.y*uReveal*pulse;
          alpha*=vInfo.x<8. ? mix(.65,1.,uConfluence) : 1.;
          vec3 color=${refined ? 'mix(uFlowColor*.72,vec3(.86,.93,.98),center)' : 'mix(vec3(.018,.26,.91),vec3(.40,.86,1.14),center)'};
          ${refined ? 'alpha*=uFlowBrightness*uFlowGlow*.32*step(.5,uFlowCount)*(vInfo.x<8. ? uFlowJoin : 1.);' : ''}
        `}
        if(alpha<.002)discard;gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }
    `, mist ? { blending: THREE.NormalBlending } : {});
    const mesh = new THREE.Mesh(geometry, material); mesh.name = mist ? 'Four sheltered ground mist pockets' : 'Four joins and five quiet source halos';
    mesh.renderOrder = mist ? 7 : 5; group.add(mesh);
  }
  patchMesh(mistPatches, true); patchMesh(joinPatches, false);

  // Grounded, very small faceted source markers share a single instanced draw.
  let markerMaterial = null;
  if (sourcePoints.length) {
    const geometry = new THREE.OctahedronGeometry(1, 0); geometries.push(geometry);
    markerMaterial = new THREE.MeshBasicMaterial({ color: refined ? flowColor : 0x47bdff, transparent: true, opacity: 0, depthTest: true, depthWrite: false, toneMapped: false });
    materials.push(markerMaterial);
    const markers = new THREE.InstancedMesh(geometry, markerMaterial, sourcePoints.length);
    const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), axis = new THREE.Vector3(0, 1, 0);
    sourcePoints.forEach((p, index) => {
      quaternion.setFromAxisAngle(axis, index * 1.23);
      matrix.compose(new THREE.Vector3(p.x, 10.5, p.z), quaternion, new THREE.Vector3(3.7, 9.4, 3.7));
      markers.setMatrixAt(index, matrix);
    });
    markers.instanceMatrix.needsUpdate = true; markers.name = 'Five small grounded luminous source crystals'; markers.renderOrder = 5; group.add(markers);
  }
  const stats = {
    riverPaths: channels.length, ribbonVertices: ribbonVertexCount, ribbonTriangles: ribbonIndex.length / 3,
    strandsPerRiver: refined ? 1 : 7, liveFlowControls: refined,
    downstreamPackets: refined, flowWorldSpeed: refined ? 340 : 0, phaseContinuous: refined && channels.every(p => Number.isFinite(p.flowOffset)), particles: particlePaths.length, mistPockets: mistPatches.length,
    confluencePatches: joins.length, sourceMarkers: sourcePoints.length, drawCalls: group.children.length,
    depthTest: true, depthWrite: false, boundedWorldSpace: true
  };
  group.visible = false;
  return {
    group, stats, flowConfig, uniforms,
    update(time = 0, reveal = 0, confluence = 0, reduced = false) {
      if (disposed) return;
      const currentTime = Number.isFinite(time) ? time : 0;
      const delta = previousTime === null ? 0 : clamp(currentTime - previousTime, 0, .12);
      if (!reduced) {
        motionTime += delta;
        // Integrate speed: moving the live slider must not jump the crest.
        if (refined) flowTravel += delta * 340 * flowValue('speed', 0, 2.5);
      }
      previousTime = currentTime;
      if (refined) {
        uniforms.uFlowCount.value = Math.round(flowValue('count', 0, 5));
        uniforms.uFlowWidth.value = flowValue('width', .005, .20);
        uniforms.uFlowBrightness.value = flowValue('brightness', 0, 2);
        uniforms.uFlowSpeed.value = flowValue('speed', 0, 2.5);
        uniforms.uFlowGlow.value = flowValue('glow', 0, 1.5);
        uniforms.uMist.value = flowValue('mist', 0, 1.5);
        uniforms.uFlowCore.value = flowValue('core', 0, 1);
        uniforms.uFlowHalo.value = flowValue('halo', 0, 1.5);
        uniforms.uFlowPulse.value = flowValue('pulse', 0, 1.5);
        uniforms.uFlowSparkle.value = flowValue('sparkle', 0, 1.5);
        uniforms.uFlowJoin.value = flowValue('join', 0, 2);
        uniforms.uFlowMeander.value = flowValue('meander', 0, 1.5);
        uniforms.uFlowDepth.value = flowValue('depth', 0, 1);
        const color = flowConfig.color ?? WATERSHED_FLOW_DEFAULTS.color;
        if (color !== lastFlowColor) { flowColor.set(color); lastFlowColor = color; }
        stats.strandsPerRiver = uniforms.uFlowCount.value;
      }
      uniforms.uTime.value = motionTime;
      uniforms.uFlowTravel.value = flowTravel;
      uniforms.uReveal.value = smooth(.16, .62, reveal);
      uniforms.uConfluence.value = smooth(.02, .90, confluence);
      group.visible = uniforms.uReveal.value > .001;
      if (markerMaterial) {
        if (refined) markerMaterial.color.copy(flowColor);
        markerMaterial.opacity = uniforms.uReveal.value * (refined ?
          .18 * uniforms.uFlowBrightness.value * uniforms.uFlowGlow.value * (uniforms.uFlowCount.value > 0 ? 1 : 0) : .68);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      group.clear();
    }
  };
}
