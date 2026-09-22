/** Optional live controls; omitted configuration preserves the original studies. */
export const WATERSHED_FLOW_DEFAULTS = Object.freeze({
  count: 1, width: .065, brightness: 1, speed: 1, glow: .65,
  color: '#dcecf4', mist: .6
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
  let disposed = false, previousTime = null, motionTime = 0, flowTravel = 0;
  const pointAt = (curve, t) => curve.getPointAt(clamp(t));
  const tangentAt = (curve, t) => curve.getTangentAt(clamp(t));
  const widths = (channel, t) => Math.max(1, channel.widthAt(clamp(t)));
  const commonFragment = /* glsl */`
    uniform float uTime, uFlowTravel, uReveal, uConfluence;
    uniform float uFlowCount, uFlowWidth, uFlowBrightness, uFlowSpeed, uFlowGlow, uMist;
    uniform vec3 uFlowColor;
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
      for (let column = 0; column <= columns; column++) {
        const lane = column / columns * 2 - 1;
        ribbonPosition.push(center.x + nx * width * lane, refined ? 3.6 : 2.2, center.z + nz * width * lane);
        ribbonFlow.push(lane, t * length + flowOffset, t, refined ? 0 : pathIndex * 4.713 + .9);
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
    const material = shader(refined ? 'Ice silver · continuous river current' : 'River-bound electric blue filaments', /* glsl */`
      attribute vec4 aFlow; attribute vec2 aEnds;
      varying vec4 vFlow; varying vec2 vEnds;
      void main(){ vFlow=aFlow; vEnds=aEnds; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
    `, commonFragment + (refined ? /* glsl */`
      varying vec4 vFlow; varying vec2 vEnds;
      void main() {
        if(uFlowCount < .5 || uFlowBrightness <= .0) discard;
        float lane=vFlow.x, distance=vFlow.y;
        float strength=0., sharp=0.;
        // The crest leads downstream; its long, soft tail points back to its
        // source. All reaches share the same world-distance clock, so light
        // never reverses or restarts when it crosses a confluence.
        float advect=distance-uFlowTravel;
        for(int i=0; i<5; i++) {
          float f=float(i);
          if(f >= uFlowCount) break;
          float center=(f-(uFlowCount-1.)*.5)*.27;
          float d=abs(lane-center);
          float aa=max(fwidth(lane),.0015);
          float width=max(uFlowWidth,aa*1.30);
          // A pixel-aware Gaussian keeps distant diagonal crests continuous.
          float sigma=max(width*.42,aa*.68);
          float core=exp(-.5*d*d/max(sigma*sigma,.000001));
          float shoulder=exp(-d*d/max(width*width*4.5,.0001));
          float halo=exp(-d*d/max(width*width*20.,.0001));
          float phase=fract(advect/1080.+f*.13);
          float phaseAA=max(fwidth(advect/1080.)*.8,.001);
          float trail=smoothstep(.04,.72,phase);
          float front=1.-smoothstep(.74-phaseAA,.83+phaseAA,phase);
          float packet=trail*front;
          float head=exp(-pow((phase-.735)/.072,2.));
          float energy=.17+packet*.77+head*.22;
          strength+=core*energy*.80+(shoulder*.16+halo*.07)*uFlowGlow*(.12+packet*.88);
          sharp+=core*(.30+packet*.70);
        }
        float ends=vEnds.x*vEnds.y;
        float edge=1.-smoothstep(.86,.99,abs(lane));
        strength*=ends*edge*uReveal*uFlowBrightness;
        if(strength<.001) discard;
        vec3 color=mix(uFlowColor*.82,vec3(.96,.985,1.),clamp(sharp*.66,0.,.72));
        gl_FragColor=vec4(color,min(strength,.98));
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
    `));
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
          ${refined ? 'alpha*=uFlowBrightness*uFlowGlow*.32*step(.5,uFlowCount);' : ''}
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
