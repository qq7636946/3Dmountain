/* index1-5: continuous blue currents carried by the existing river.
   Geometry is baked once; only six uniforms change each frame. The world-space
   strands never slide with the camera, and rock/water retain their depth test. */
export function createFollowLightLines(THREE, { curve, widthAt, continuation = null, lite = false } = {}) {
  const group = new THREE.Group(); group.name = 'index1-5 first-person blue currents';
  const mainLength = curve.getLength();
  const continuationLength = continuation?.curve?.getLength() || 0;
  const length = mainLength + continuationLength, rows = Math.ceil(length / (lite ? 5 : 3));
  const mainChannel = { curve, widthAt };
  const lanes = [-9, -3.8, .6, 4.4, 9.6], ribbons = [];
  const common = {
    uTime: { value: 0 }, uTail: { value: -40 }, uHead: { value: length + 70 },
    uBright: { value: 0 }, uFog: { value: .00172 }, uPixel: { value: 0 }
  };
  const vertexShader = /* glsl */`
    attribute vec3 aSide; attribute vec2 aFlow;
    uniform float uPixel;
    varying float vSide, vS, vDepth;
    void main(){
      float d=distance(cameraPosition,position);
      vec3 p=position+aSide*aFlow.x*max(.18,d*uPixel);
      vSide=aFlow.x;vS=aFlow.y;vDepth=d;
      gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
    }`;
  const fragmentShader = /* glsl */`
    uniform float uTime,uTail,uHead,uBright,uFog,uSeed;
    varying float vSide,vS,vDepth;
    void main(){
      float a=clamp(1.-abs(vSide),0.,1.);
      float win=smoothstep(uTail,uTail+28.,vS)*(1.-smoothstep(uHead-46.,uHead,vS));
      float k=uBright*win*exp(-uFog*uFog*vDepth*vDepth*.8);
      if(k<.0001)discard;
      float ph=fract(vS/(110.+uSeed*52.)-uTime*1.12+uSeed);
      float pulse=.62+1.65*pow(ph,16.)+.26*pow(ph,3.);
      float core=pow(a,14.),glow=pow(a,3.2),haze=a*a;
      vec3 c=(vec3(.90,.97,1.)*core*3.0+vec3(.22,.58,1.)*(glow*.95+haze*.17))*pulse*k;
      float alpha=clamp((glow*.60+haze*.16)*k,0.,.62);
      gl_FragColor=vec4(c,alpha);
    }`;
  for (let lane = 0; lane < lanes.length; lane++) {
    const positions = new Float32Array((rows + 1) * 6), sides = new Float32Array(positions.length);
    const flow = new Float32Array((rows + 1) * 4), indices = new Uint16Array(rows * 6);
    for (let i = 0; i <= rows; i++) {
      // One distance coordinate spans both pieces of the real river. Weave,
      // light packets and ribbon triangles carry straight across their join.
      const s = i / rows * length, downstream = continuationLength > 0 && s > mainLength;
      const channel = downstream ? continuation : mainChannel;
      const t = downstream ? (s - mainLength) / continuationLength : Math.min(1, s / mainLength);
      const p = channel.curve.getPointAt(t), tangent = channel.curve.getTangentAt(t);
      const h = Math.hypot(tangent.x, tangent.z) || 1, nx = -tangent.z / h, nz = tangent.x / h;
      const weave = lanes[lane] * (.75 + .3 * Math.sin(s * .0042 + 1.1))
        + 2.7 * Math.sin(s * .0067 + lane * 1.7) + 1.1 * Math.sin(s * .021 + lane * 2.3);
      const offset = THREE.MathUtils.clamp(weave, -channel.widthAt(t) * .68, channel.widthAt(t) * .68);
      const y = 1.40 + .12 * lane + .15 * Math.sin(s * .017 + lane);
      for (let k = 0; k < 2; k++) {
        const v = i * 2 + k;
        positions.set([p.x + nx * offset, y, p.z + nz * offset], v * 3);
        sides.set([nx, 0, nz], v * 3); flow.set([k ? 1 : -1, s], v * 2);
      }
      if (i < rows) { const v = i * 2; indices.set([v,v+2,v+1,v+1,v+2,v+3], i * 6); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aSide',new THREE.BufferAttribute(sides,3));
    geometry.setAttribute('aFlow',new THREE.BufferAttribute(flow,2)); geometry.setIndex(new THREE.BufferAttribute(indices,1));
    const uniforms = { ...common, uSeed: { value: lane * .37 }, uPixel: { value: 0 }, uBright: { value: 0 } };
    const material = new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,
      transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor});
    const mesh = new THREE.Mesh(geometry,material);mesh.name=`follow-current-${lane}`;
    mesh.frustumCulled=false;mesh.renderOrder=5;group.add(mesh);ribbons.push(mesh);
  }
  const sm = (a,b,x) => THREE.MathUtils.smoothstep(x,a,b);
  return {
    group, stats: { strands: lanes.length, vertices: (rows + 1) * 2 * lanes.length, drawCalls: lanes.length },
    update(route,time,reduced,reveal,camera,fogDensity,viewportH) {
      // Cover the complete river even before the camera lifts. A window ending
      // 340 units ahead left all five strands visibly cut across open water.
      // Distance fog now softens the far reach; the confluence keeps its fade.
      const gain = sm(.005,.07,route) * (1-sm(.14,.62,reveal));
      common.uTime.value=reduced?0:time;common.uFog.value=fogDensity;
      const pixel=2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/Math.max(1,viewportH);
      ribbons.forEach((mesh,k)=>{
        mesh.material.uniforms.uBright.value=gain*[.64,.88,1.08,.82,.60][k]*(lite?.85:1);
        mesh.material.uniforms.uPixel.value=pixel*(k===2?4.2:3.1)*(lite?.80:1);
      });
      // Keep visible with zero intensity at route=0 so the startup warm-up
      // compiles the shader before the first scroll into the canyon.
      group.visible=reveal<.64;
    },
    dispose(){group.removeFromParent();ribbons.forEach(mesh=>{mesh.geometry.dispose();mesh.material.dispose();});}
  };
}
