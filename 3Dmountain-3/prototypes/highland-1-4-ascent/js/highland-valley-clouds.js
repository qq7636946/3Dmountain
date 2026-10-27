/* Valley cloud, one instanced draw; no full-screen ray march, no depth texture.
   Ascent look-dev 2026-10-23 (reference: everest.suraj.work), second pass after the client saw the horizontal
   sheets as flat white slabs: now only a few soft camera-facing banks, each lit as a volume (the billows toward
   the sun shade the ones behind them, the crowns catch the light, the base melts into the valley haze).
   - valley banks: in the side glens (placed from the height field), clear of the canyon, confluence and trunk glen
   - the far sea of cloud: wide banks beyond the bay (the bay and the near sea stay open)
   role 0 = aerial only (the reveal q < 2.8 and the final rise q > 7.4); role 1 = also kept, sparse, in the low flight;
   role 2 = the far sea of cloud (aerial only, denser). */
export function createValleyClouds(THREE, { lite = false } = {}) {
  const group = new THREE.Group(); group.name = 'alpine-valley-clouds';
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index; geometry.attributes = base.attributes;
  // x, y (centre), z, width, height, role
  const banks = [
    // side glens: north-west (path A), north-east (path C), the eastern loch (path D), the west
    [-1600, 110, -2800, 1300, 420, 0], [-1200, 100, -2400, 1050, 360, 1], [1400, 110, -3000, 1300, 420, 0],
    [2000, 120, -3400, 1150, 400, 0], [1400, 95, -1400, 1150, 360, 1], [-1600, 135, -1600, 1000, 340, 0],
    [-1150, 90, -220, 1100, 340, 0], [1600, 100, -180, 1000, 330, 0],
    // the sea of cloud toward the northern horizon
    [-2700, 110, 3500, 2200, 420, 2], [-1100, 90, 4300, 1800, 360, 2], [2600, 100, 3800, 2400, 420, 2], [900, 80, 4800, 1700, 340, 2],
    [-500, 90, 6400, 3200, 520, 2], [-3600, 140, 6900, 2800, 520, 2], [3300, 130, 7300, 3000, 540, 2], [1400, 120, 8600, 3400, 560, 2]
  ];
  const use = lite ? banks.filter((_, i) => i % 2 === 0) : banks;
  geometry.instanceCount = use.length;
  geometry.setAttribute('aCloud', new THREE.InstancedBufferAttribute(new Float32Array(use.flatMap(p => p.slice(0, 4))), 4));
  geometry.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(use.flatMap((p, i) => [p[4], i * 3.17 + 1.3, p[5]])), 3));
  const uniforms = { uTime: { value: 0 }, uFade: { value: 0 }, uLow: { value: 0 }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) },
    uHaze: { value: new THREE.Color('#b8c8d3') }, uFog: { value: .0001 }, uSun: { value: new THREE.Vector2(.6, .8) } };
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, uniforms,
    vertexShader: `attribute vec4 aCloud; attribute vec3 aShape; uniform vec3 uRight,uUp; uniform float uTime,uFade,uLow;
      varying vec2 vUv; varying float vSeed,vDistance,vFade,vFar;
      void main(){vUv=uv;vSeed=aShape.y;vFar=step(1.5,aShape.z);vFade=aShape.z>.5&&aShape.z<1.5?max(uFade,uLow):uFade;
        vec3 center=aCloud.xyz; center.x+=sin(uTime*.018+aShape.y)*35.; center.z+=cos(uTime*.012+aShape.y)*20.;
        vec3 world=center+uRight*position.x*aCloud.w+uUp*position.y*aShape.x;
        vec4 view=modelViewMatrix*vec4(world,1.);vDistance=-view.z;
        gl_Position=vFade<.003?vec4(0.,0.,2.,1.):projectionMatrix*view;}`,
    fragmentShader: `uniform float uTime,uFog;uniform vec3 uHaze;uniform vec2 uSun; varying vec2 vUv; varying float vSeed,vDistance,vFade,vFar;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      float fbm(vec2 p){return noise(p)*.5+noise(p*2.03+7.1)*.27+noise(p*4.13+3.3)*.15+noise(p*8.37+1.9)*.08;}
      // the bank's density: billows on a broad dome, densest low in the middle, frayed at the rim
      float dens(vec2 uv){vec2 f=vec2(uTime*.004,vSeed);vec2 p=uv*2.-1.;
        float n=fbm(uv*vec2(4.4,2.3)+f),m=fbm(uv*vec2(11.,5.6)+f*1.4+5.);
        float r=length(p*vec2(1.,1.45)+vec2(0.,.22));
        return (n-.5)*1.15+(m-.5)*.42+.52-r*.86;}
      void main(){vec2 p=vUv*2.-1.;
        float d=dens(vUv);
        // soft rim, a base that melts away (no cut line where it meets the valley floor)
        float a=smoothstep(-.05,.62,d)*smoothstep(-1.,-.15,p.y+(d-.2)*.6)*vFade*smoothstep(80.,550.,vDistance);
        if(a<.006)discard;
        // self-shadowing: more cloud toward the sun means this billow sits in its neighbour's shade
        float toward=dens(vUv+uSun*vec2(.045,.08));
        float light=clamp(.62+(d-toward)*3.2+p.y*.22,0.,1.);
        vec3 col=mix(vec3(.60,.67,.78),vec3(.985,.98,.97),light);
        float fog=1.-exp(-uFog*uFog*vDistance*vDistance); col=mix(col,uHaze,fog*.85);
        gl_FragColor=vec4(col,a*mix(.62,.80,vFar));   // valley banks lighter than the far sea of cloud
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = 24;
  let sun = null; const sunDir = new THREE.Vector3();
  mesh.onBeforeRender = (_, scene, camera) => {
    uniforms.uRight.value.setFromMatrixColumn(camera.matrixWorld, 0); uniforms.uUp.value.setFromMatrixColumn(camera.matrixWorld, 1);
    if (scene.fog) { uniforms.uHaze.value.copy(scene.fog.color); uniforms.uFog.value = scene.fog.density; }
    sun = sun || scene.children.find(o => o.isDirectionalLight) || null;
    if (sun) {   // the sun's direction on screen, for the billows' shading
      sunDir.subVectors(sun.position, sun.target.position).transformDirection(camera.matrixWorldInverse);
      const l = Math.hypot(sunDir.x, sunDir.y) || 1; uniforms.uSun.value.set(sunDir.x / l, sunDir.y / l);
    }
  };
  group.add(mesh);
  const S = THREE.MathUtils.smoothstep;
  return { group, update(q, time, reduced) {
    uniforms.uTime.value = reduced ? 0 : time;
    // full in the high reveal and the final rise over the bay; in the low flight only the role-1 banks, sparse
    uniforms.uFade.value = S(q, 7.0, 8.25);   // R4 route: no high reveal any more; the banks come in as the camera rises
    uniforms.uLow.value = .32 * S(q, 1.2, 1.6);
    group.visible = uniforms.uFade.value > .003 || uniforms.uLow.value > .003;
  }, dispose() { geometry.dispose(); material.dispose(); } };
}
