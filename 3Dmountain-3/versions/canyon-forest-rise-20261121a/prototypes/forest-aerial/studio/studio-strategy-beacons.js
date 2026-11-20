import * as THREE from 'three';

// Four strategy markers: one instanced draw for the soft walls/contact rings,
// one points draw for all sparks. Their arrival follows the river-light reveal.
export function createStrategyBeacons(atlas, studio, curtain, { reducedMotion = false } = {}) {
  const config = { enabled: true, particles: true, count: 24, height: .76, width: 1,
    brightness: 1.2, filaments: .85, halo: .9, particleSize: 1.16, particleBrightness: 1.55,
    speed: .7, color: '#b5e6ff' };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const positions = [], uv = [], kinds = [], indices = [];
  const sides = 48, rows = 8;
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= sides; col++) {
    const a = col / sides * Math.PI * 2;
    positions.push(Math.cos(a), row / rows, Math.sin(a));
    uv.push(col / sides, row / rows); kinds.push(0);
    if (row < rows && col < sides) {
      const k = row * (sides + 1) + col, next = k + sides + 1;
      indices.push(k, next, k + 1, next, next + 1, k + 1);
    }
  }
  const foot = positions.length / 3;
  positions.push(-1,0,-1, 1,0,-1, -1,0,1, 1,0,1);
  uv.push(0,0, 1,0, 0,1, 1,1); kinds.push(1,1,1,1);
  indices.push(foot,foot+2,foot+1, foot+1,foot+2,foot+3);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aFoot', new THREE.Float32BufferAttribute(kinds, 1));
  const sites = new THREE.InstancedBufferAttribute(new Float32Array(4 * 4), 4);
  geo.setAttribute('aSite', sites);
  geo.setAttribute('aIndex', new THREE.InstancedBufferAttribute(new Float32Array([0,1,2,3]), 1));
  geo.instanceCount = 4;
  const focus = new THREE.Vector4(), emitters = atlas.anchors.map(p => p.clone());
  emitters.push((curtain?.logo?.group.position || atlas.lake.center).clone());
  const shared = {
    uTime: atlas.uniforms.uTime, uArrival: studio.uniforms.uArrival,
    uProgress: curtain?.uniforms.uProgress || studio.uniforms.uArrival,
    uLattice: atlas.uniforms.uLattice,
    uTint: { value: new THREE.Color(config.color) }, uFocus: { value: focus },
    uShape: { value: new THREE.Vector2(config.width, config.height) },
    uSpeed: { value: reducedMotion ? 0 : config.speed },
    uStrength: { value: config.brightness }, uFilaments: { value: config.filaments }, uHalo: { value: config.halo }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: `
      attribute vec4 aSite; attribute float aFoot,aIndex;
      uniform vec2 uShape; uniform float uProgress,uArrival;
      uniform vec4 uFocus;
      varying vec2 vUv; varying vec3 vWorld,vLocal;
      varying float vFoot,vIndex,vShow,vFocus;
      void main(){
        vUv=uv; vFoot=aFoot; vIndex=aIndex; vLocal=position;
        vFocus=uFocus[int(aIndex)];
        vShow=smoothstep(.18+aIndex*.035,.75+aIndex*.025,uProgress)*smoothstep(.4,.82,uArrival);
        vec2 wallSpan=vec2(.17,.105)*uShape.x;
        float taper=.85+.15*sin(position.y*3.141593);
        vec2 d=position.xz*mix(wallSpan*taper,wallSpan*2.8,aFoot);
        mat2 turn=mat2(cos(aSite.w),sin(aSite.w),-sin(aSite.w),cos(aSite.w));
        d=turn*d;
        vWorld=vec3(aSite.x+d.x,aSite.y+.008+position.y*uShape.y*(.8+.2*vShow),aSite.z+d.y);
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
      }`,
    fragmentShader: `
      uniform float uTime,uSpeed,uStrength,uFilaments,uHalo,uLattice;
      uniform vec3 uTint;
      varying vec2 vUv; varying vec3 vWorld,vLocal;
      varying float vFoot,vIndex,vShow,vFocus;
      void main(){
        if(uLattice>.35 || vShow<.001) discard;
        float t=uTime*uSpeed, seed=vIndex*.273, alpha;
        if(vFoot>.5){
          float r=length(vLocal.xz), aa=max(.012,fwidth(r)*1.4);
          float ring=1.-smoothstep(aa,aa*2.2,abs(r-.36));
          float halo=exp(-r*r*8.0)*(1.-smoothstep(.7,1.,r));
          float p=fract(t*.105+seed), radius=.38+p*.49;
          float ripple=exp(-pow((r-radius)/max(.024,aa),2.))*sin(p*3.141593);
          alpha=(.21*halo+.20*ring+.09*ripple)*uHalo;
        }else{
          float y=vUv.y;
          vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
          float rim=pow(1.-abs(dot(n,normalize(cameraPosition-vWorld))),2.4);
          float top=pow(max(0.,1.-y),1.35)*(1.-smoothstep(.66,1.,y));
          float strand=fract(vUv.x*19.+sin(y*3.2+t*.15+seed)*.065+seed);
          float hair=exp(-pow((strand-.5)/.075,2.));
          float stream=fract(y*.61-t*.17+vUv.x*2.+seed);
          float glint=exp(-pow((stream-.5)/.115,2.));
          float sweep=exp(-pow((y-fract(t*.12+seed))/.075,2.));
          alpha=(.025+.12*rim+.14*exp(-y*10.)+uFilaments*(.21*hair*(.25+.75*glint)+.08*sweep))*top;
        }
        alpha*=vShow*uStrength*(1.+vFocus*.6);
        if(alpha<.003) discard;
        vec3 color=mix(uTint,vec3(.91,.98,1.),vFoot>.5?.52:.27);
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    forceSinglePass: true, depthTest: true, depthWrite: false, toneMapped: false
  });
  mat.userData.handlesArrival = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Four layered strategy light beacons'; mesh.frustumCulled = false; mesh.renderOrder = 15;

  // A bounded pool lets the count slider respond immediately without reallocating
  // geometry. Small devices draw fewer sparks, with the same four focal points.
  const pointPositions = [], seeds = [];
  const fract = x => x - Math.floor(x);
  for (let site = 0; site < 5; site++) for (let j = 0; j < (site < 4 ? 48 : 16); j++) {
    const i = site * 53 + j + 1;
    pointPositions.push(site,j,0);
    seeds.push(fract(j*.618034+site*.217),5.2+4.6*fract(i*.7549),Math.PI*2*fract(i*.56984),fract(i*.4231));
  }
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
  pointGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
  const pointMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uSites: { value: emitters }, uCount: { value: config.count },
      uDensity: { value: coarse ? .6 : 1 }, uSize: { value: config.particleSize },
      uBright: { value: config.particleBrightness }, uPixels: { value: innerHeight }, uDpr: { value: 1 } },
    vertexShader: `
      uniform vec3 uSites[5]; uniform vec4 uFocus;
      uniform vec2 uShape;
      uniform float uTime,uSpeed,uArrival,uProgress,uLattice,uCount,uDensity,uSize,uBright,uPixels,uDpr;
      attribute vec4 aSeed; varying float vAlpha,vHot;
      void main(){
        int site=int(position.x+.5); float lake=step(3.5,position.x);
        float count=mix(uCount,12.,lake)*uDensity;
        if(position.y>=count || uLattice>.35){vAlpha=0.;vHot=0.;gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;return;}
        float age=fract(uTime*uSpeed/aSeed.y+aSeed.x);
        float a=aSeed.z+age*(.30+.28*aSeed.w), distant=step(.72,aSeed.w);
        float radius=mix(.12+.12*aSeed.w,.31+.18*aSeed.w,distant)*uShape.x;
        radius=mix(radius,.65+.32*aSeed.w,lake);
        vec2 lateral=vec2(cos(a),sin(a))*(radius+.055*sin(age*3.141593));
        float rise=mix(uShape.y*(.64+.64*aSeed.w),.65+.3*aSeed.w,lake);
        vec3 p=uSites[site]+vec3(lateral.x,.025+age*rise,lateral.y);
        vec4 mv=viewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((.025+.027*aSeed.w)*uSize*uPixels*.5*projectionMatrix[1][1]/max(.01,-mv.z),2.2*uDpr,10.*uDpr);
        float reveal=smoothstep(.22,.8,uProgress)*smoothstep(.4,.82,uArrival);
        float life=smoothstep(0.,.16,age)*(1.-smoothstep(.64,1.,age));
        float twinkle=.82+.18*sin(uTime*uSpeed*.8+aSeed.z*2.);
        float focus=site<4?uFocus[site]:0.;
        vAlpha=life*reveal*twinkle*uBright*(.75+.38*aSeed.w)*mix(1.,.7,lake)*(1.+focus*.35);
        vHot=.3+.7*aSeed.w;
        if(mv.z>=0.)vAlpha=0.;
      }`,
    fragmentShader: `
      uniform vec3 uTint; varying float vAlpha,vHot;
      void main(){
        vec2 p=gl_PointCoord*2.-1.; float r2=dot(p,p);
        if(r2>1.)discard;
        float core=exp(-r2*22.), halo=exp(-r2*4.2)*(1.-smoothstep(.55,1.,r2));
        float alpha=(core*.82+halo*.48)*vAlpha;
        if(alpha<.004)discard;
        gl_FragColor=vec4(mix(uTint,vec3(1.),core*.8+vHot*.16),alpha);
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false, toneMapped: false
  });
  pointMat.userData.handlesArrival = true;
  const lights = new THREE.Points(pointGeo, pointMat), viewport = new THREE.Vector4();
  lights.name = 'Strategy sparks with soft round halos'; lights.frustumCulled = false; lights.renderOrder = 16;
  lights.onBeforeRender = renderer => {
    renderer.getCurrentViewport(viewport);
    pointMat.uniforms.uPixels.value = viewport.w;
    pointMat.uniforms.uDpr.value = viewport.w / Math.max(1, innerHeight);
  };
  mesh.add(lights); atlas.scene.add(mesh);
  let hovered = -1, selected = -1, previousTime = performance.now();
  const diagnostics = new URLSearchParams(location.search).get('motionqa') === '1' ? document.createElement('output') : null;
  if (diagnostics) { diagnostics.id = 'rise-beacons-qa'; diagnostics.hidden = true; document.body.append(diagnostics); }
  let diagnosticAt = 0;
  function apply() {
    shared.uShape.value.set(Math.max(.4,config.width),Math.max(.2,config.height));
    shared.uStrength.value = config.brightness;
    shared.uFilaments.value = config.filaments; shared.uHalo.value = config.halo;
    shared.uSpeed.value = reducedMotion ? 0 : config.speed;
    shared.uTint.value.set(config.color);
    pointMat.uniforms.uCount.value = THREE.MathUtils.clamp(Math.round(config.count),0,48);
    pointMat.uniforms.uSize.value = config.particleSize; pointMat.uniforms.uBright.value = config.particleBrightness;
    lights.visible = !!config.particles;
  }
  function sync() {
    atlas.anchors.forEach((p,i) => {
      const y = atlas.lake.center.y;
      if(sites.getX(i)!==Math.fround(p.x) || sites.getY(i)!==Math.fround(y) || sites.getZ(i)!==Math.fround(p.z)) {
        sites.setXYZW(i,p.x,y,p.z,Math.atan2(p.z-atlas.lake.center.z,p.x-atlas.lake.center.x)); sites.needsUpdate=true;
      }
      emitters[i].set(p.x,y,p.z);
    });
    emitters[4].copy(curtain?.logo?.group.position || atlas.lake.center);
    const now = performance.now(), k = 1-Math.exp(-Math.min(.1,(now-previousTime)/1000)*8);
    previousTime = now;
    for (let i=0;i<4;i++) focus.setComponent(i,THREE.MathUtils.lerp(focus.getComponent(i),i===hovered||i===selected?1:0,k));
    if(diagnostics && now-diagnosticAt>200){
      diagnostics.textContent=JSON.stringify({enabled:config.enabled,particles:config.particles,
        countPerSite:Math.ceil(pointMat.uniforms.uCount.value*pointMat.uniforms.uDensity.value),
        pool:pointGeo.attributes.position.count,drawCalls:2,reveal:shared.uProgress.value,
        focus:focus.toArray().map(x=>+x.toFixed(2)),time:shared.uTime.value}); diagnosticAt=now;
    }
  }
  apply(); sync();
  return { mesh, lights, config, apply, sync, focus,
    setHovered(index){hovered=index;}, setSelected(index){selected=index;},
    dispose(){mesh.removeFromParent();geo.dispose();mat.dispose();pointGeo.dispose();pointMat.dispose();diagnostics?.remove();}
  };
}
