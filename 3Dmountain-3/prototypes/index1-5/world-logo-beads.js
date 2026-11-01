/* world-logo-beads.js — the closing LOGO as a body of water beads (2026-11-01, after the particle figures of igloo.inc; written from scratch).
   Tens of thousands of lit round beads sit on the mark's real surface (sampled from its baked mesh, by area, so its slab and bevels hold) and live on the GPU:
   two float textures (position, velocity), a spring back home, a slow divergence-free flow, the visitor's pointer pushing and dragging them, lag when the mark
   turns, a few falling off as drops. As the wave passes they gather out of a spray (scroll both ways). Drawn as points shaded as small spheres.
   Mounted under the glass mesh, so size, yaw and the lake's waterline and mirror apply. The glass does not draw meanwhile, which also drops its transmission pass.
   Dials: bead* in MARK_DEFAULTS (world-logo-mark.js); beads 0 brings the glass back. Reduced motion: the beads rest at home. */

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };
const hex = (THREE, c, v, d) => c.set(typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d).convertLinearToSRGB();

/* area-weighted points on the mesh: x y z seed | normal | brand, along */
function sampleSurface(geometry, count) {
  const P = geometry.attributes.position, N = geometry.attributes.normal, B = geometry.attributes.aBrand, I = geometry.index;
  const tris = I ? I.count / 3 : P.count / 3, cdf = new Float64Array(tris);
  const v = i => (I ? I.getX(i) : i);
  let sum = 0;
  for (let t = 0; t < tris; t++) {
    const a = v(t * 3), b = v(t * 3 + 1), c = v(t * 3 + 2);
    const ux = P.getX(b) - P.getX(a), uy = P.getY(b) - P.getY(a), uz = P.getZ(b) - P.getZ(a), wx = P.getX(c) - P.getX(a), wy = P.getY(c) - P.getY(a), wz = P.getZ(c) - P.getZ(a);
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    sum += Math.sqrt(cx * cx + cy * cy + cz * cz); cdf[t] = sum;
  }
  let seed = 1234567;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let z = Math.imul(seed ^ (seed >>> 15), 1 | seed); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  const home = new Float32Array(count * 4), nor = new Float32Array(count * 3), brand = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const pick = rnd() * sum; let lo = 0, hi = tris - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < pick) lo = m + 1; else hi = m; }
    const a = v(lo * 3), b = v(lo * 3 + 1), c = v(lo * 3 + 2);
    let r1 = rnd(), r2 = rnd(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; } const r0 = 1 - r1 - r2;
    home[i * 4] = P.getX(a) * r0 + P.getX(b) * r1 + P.getX(c) * r2;
    home[i * 4 + 1] = P.getY(a) * r0 + P.getY(b) * r1 + P.getY(c) * r2;
    home[i * 4 + 2] = P.getZ(a) * r0 + P.getZ(b) * r1 + P.getZ(c) * r2;
    home[i * 4 + 3] = rnd();
    if (N) { nor[i * 3] = N.getX(a) * r0 + N.getX(b) * r1 + N.getX(c) * r2; nor[i * 3 + 1] = N.getY(a) * r0 + N.getY(b) * r1 + N.getY(c) * r2; nor[i * 3 + 2] = N.getZ(a) * r0 + N.getZ(b) * r1 + N.getZ(c) * r2; }
    if (B) { brand[i * 2] = B.getX(a) * r0 + B.getX(b) * r1 + B.getX(c) * r2; brand[i * 2 + 1] = B.getY(a) * r0 + B.getY(b) * r1 + B.getY(c) * r2; }
  }
  return { home, nor, brand };
}

const SIM_VERTEX = /* glsl */ `void main() { gl_Position = vec4(position.xy, 0., 1.); }`;
/* shared by both passes: how far this bead has gathered, and its drop's moment */
const SIM_COMMON = /* glsl */ `
uniform sampler2D tPos, tVel, tHome;
uniform vec2 uRes;
uniform vec4 uA;     // dt, time, spring, damping this frame
uniform vec4 uF;     // flow amount, flow scale, flow speed, gather
uniform vec4 uD;     // drip share, drip speed, the height below which beads may fall, 0
float gathered(float s) { float k = fract(s * 57.31); return smoothstep(k * .55, k * .55 + .45, uF.w); }
float dropping(float s, float y) { return step(1. - uD.x, fract(s * 57.31)) * gathered(s) * step(y, uD.z); }
float dropPhase(float s) { return fract(uA.y * uD.y * (.6 + .8 * s) + s * 91.); }`;
const VELOCITY = /* glsl */ `precision highp float;${SIM_COMMON}
uniform vec4 uM;     // pointer (mark's space) xyz, strength
uniform vec4 uMV;    // pointer velocity xyz, radius
uniform vec3 uK;     // push, drag, turn lag × turn speed
/* each axis ignores its own coordinate: a flow that neither gathers nor spreads */
vec3 flow(vec3 p, float t) { return vec3(sin(p.y * 1.3 + t) + sin(p.z * 2.1 - t * .7), sin(p.z * 1.7 + t * .8) + sin(p.x * 2.3 + t * .5), sin(p.x * 1.9 - t * .6) + sin(p.y * 2.7 + t * .9)); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 p = texture2D(tPos, uv).xyz; vec3 v = texture2D(tVel, uv).xyz; vec4 h = texture2D(tHome, uv);
  float s = h.w, s2 = fract(s * 57.31), s3 = fract(s * 113.7), g = gathered(s);
  vec3 out_ = normalize(vec3(h.xy, 0.) + vec3(s3 - .5, s - .5, 0.) * .6 + 1e-4);
  vec3 away = h.xyz + out_ * (.25 + .7 * s) + vec3(0., -.35 - .5 * s2, (s3 - .5) * .9);
  vec3 target = mix(away, h.xyz, g);
  float ph = dropPhase(s); target.y -= dropping(s, h.y) * ph * ph * 1.7;
  vec3 acc = (target - p) * uA.z * (.7 + .6 * s3);
  acc += flow(h.xyz * uF.y + s * 6., uA.y * uF.z) * uF.x * (1. + (1. - g) * 6.);
  acc.xz += vec2(p.z, -p.x) * uK.z;
  vec3 d = p - uM.xyz; d.z *= .35;
  float k = exp(-dot(d, d) / (uMV.w * uMV.w)) * uM.w;
  acc += normalize(d + 1e-4) * k * uK.x + uMV.xyz * k * uK.y;
  gl_FragColor = vec4((v + acc * uA.x) * uA.w, 1.);
}`;
const POSITION = /* glsl */ `precision highp float;${SIM_COMMON}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 p = texture2D(tPos, uv).xyz; vec3 v = texture2D(tVel, uv).xyz; vec4 h = texture2D(tHome, uv);
  float s = h.w, drop = dropping(s, h.y), ph = dropPhase(s);
  p += v * uA.x;
  if (drop > .5 && ph < .02) p = h.xyz;   // back on the mark, unseen, for its next fall
  float w = mix(1., smoothstep(.02, .07, ph) * (1. - smoothstep(.82, 1., ph)), drop) * mix(.45, 1., gathered(s));
  gl_FragColor = vec4(p, w);
}`;
const COPY = /* glsl */ `precision highp float; uniform sampler2D tHome; uniform vec2 uRes; void main() { gl_FragColor = vec4(texture2D(tHome, gl_FragCoord.xy / uRes).xyz, 1.); }`;
const ZERO = /* glsl */ `precision highp float; void main() { gl_FragColor = vec4(0.); }`;

const BEAD_VERTEX = /* glsl */ `#include <clipping_planes_pars_vertex>
uniform sampler2D tPos; uniform float uSize, uViewH, uWater;
attribute vec2 aRef; attribute vec3 aNor; attribute vec3 aBead;
varying vec3 vN; varying vec3 vBead;
void main() {
  vec4 P = texture2D(tPos, aRef);
  vec4 mvPosition = modelViewMatrix * vec4(P.xyz, 1.);
  #include <clipping_planes_vertex>
  gl_Position = projectionMatrix * mvPosition;
  if (P.y < uWater) gl_Position = vec4(2., 2., 2., 1.);   // under the lake: off the frame (a point size of 0 still draws on some GPUs)
  gl_PointSize = max(uSize * length(modelMatrix[0].xyz) * P.w * (.72 + .56 * fract(aBead.z * 17.3)) * projectionMatrix[1][1] * uViewH * .5 / -mvPosition.z, 1.5 * step(.02, P.w));
  vN = normalMatrix * aNor; vBead = aBead;
}`;
const BEAD_FRAGMENT = /* glsl */ `precision highp float;
#include <clipping_planes_pars_fragment>
uniform vec3 uDeep, uMid, uLight, uBlue, uBlueDeep; uniform vec3 uShade;   // specular, edge shade, face follow
uniform float uShade2;
varying vec3 vN; varying vec3 vBead;
void main() {
  vec4 diffuseColor = vec4(1.);   // three's clipping chunk writes its edge here when alpha to coverage is on
  #include <clipping_planes_fragment>
  vec2 c = gl_PointCoord * 2. - 1.; c.y = -c.y;
  float r2 = dot(c, c); if (r2 > 1.) discard;
  vec3 n = vec3(c, sqrt(1. - r2));
  vec3 N = normalize(n + normalize(vN) * uShade.z);
  vec3 L = normalize(vec3(-.32, .82, .46));
  float d = dot(N, L) * .5 + .5; d *= d;
  vec3 col = mix(uDeep, uMid, smoothstep(.05, .5, d)); col = mix(col, uLight, smoothstep(.5, .98, d));
  col = mix(col, mix(uBlue, uBlueDeep, clamp(vBead.y, 0., 1.)) * (.55 + .95 * d), step(.5, vBead.x));
  col *= 1. - uShade.y * r2 * sqrt(r2);                                                   // each bead rounds off darker at its edge, as the wet grains do
  col += pow(max(dot(N, normalize(L + vec3(0., 0., 1.))), 0.), 70.) * uShade.x;           // a wet point of light
  col += uLight * uShade2 * smoothstep(.15, .85, -c.y) * smoothstep(.1, .75, r2) * (1. - smoothstep(.75, 1., r2));   // the light a drop gathers on its far side
  col *= .9 + .2 * fract(vBead.z * 31.7);                                                 // fixed per bead: never flickers
  gl_FragColor = vec4(col, diffuseColor.a * smoothstep(1., .78, r2));                                      // alpha to coverage: a clean round edge
}`;

export function createLogoBeads({ THREE, host, renderer, small = false, reducedMotion = false, look = () => ({}) }) {
  const side = small ? 96 : 156, count = side * side;
  const { home, nor, brand } = sampleSurface(host.geometry, count);
  const homeTex = new THREE.DataTexture(home, side, side, THREE.RGBAFormat, THREE.FloatType);
  homeTex.minFilter = homeTex.magFilter = THREE.NearestFilter; homeTex.needsUpdate = true;
  const type = renderer.extensions.has('EXT_color_buffer_float') ? THREE.FloatType : THREE.HalfFloatType;
  const makeRT = () => new THREE.WebGLRenderTarget(side, side, { type, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
  const pos = [makeRT(), makeRT()], vel = [makeRT(), makeRT()];
  let front = 0;

  /* ---- the simulation ---- */
  const simScene = new THREE.Scene(), simCam = new THREE.Camera();
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const quad = new THREE.Mesh(tri); quad.frustumCulled = false; simScene.add(quad);
  const res = { value: new THREE.Vector2(side, side) }, uA = { value: new THREE.Vector4() }, uF = { value: new THREE.Vector4() }, uD = { value: new THREE.Vector4() }, tH = { value: homeTex };
  const pass = (fragmentShader, extra = {}) => new THREE.ShaderMaterial({ vertexShader: SIM_VERTEX, fragmentShader, depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false, uniforms: { uRes: res, uA, uF, uD, tHome: tH, tPos: { value: null }, tVel: { value: null }, ...extra } });
  const velMat = pass(VELOCITY, { uM: { value: new THREE.Vector4() }, uMV: { value: new THREE.Vector4() }, uK: { value: new THREE.Vector3() } }), posMat = pass(POSITION), copyMat = pass(COPY), zeroMat = pass(ZERO);
  const run = (material, target) => {
    const prev = renderer.getRenderTarget(), auto = renderer.autoClear;
    quad.material = material; renderer.autoClear = false;
    renderer.setRenderTarget(target); renderer.render(simScene, simCam);
    renderer.setRenderTarget(prev); renderer.autoClear = auto;
  };
  const reset = () => { for (const i of [0, 1]) { run(copyMat, pos[i]); run(zeroMat, vel[i]); } };
  reset();

  /* ---- the drawing ---- */
  const geometry = new THREE.BufferGeometry(), ref = new Float32Array(count * 2), bead = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    ref[i * 2] = ((i % side) + .5) / side; ref[i * 2 + 1] = (Math.floor(i / side) + .5) / side;
    bead[i * 3] = brand[i * 2]; bead[i * 3 + 1] = brand[i * 2 + 1]; bead[i * 3 + 2] = home[i * 4 + 3];
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));   // three wants one; the place comes from tPos
  geometry.setAttribute('aRef', new THREE.BufferAttribute(ref, 2));
  geometry.setAttribute('aNor', new THREE.BufferAttribute(nor, 3));
  geometry.setAttribute('aBead', new THREE.BufferAttribute(bead, 3));
  host.geometry.computeBoundingBox(); host.geometry.computeBoundingSphere();
  geometry.boundingBox = host.geometry.boundingBox.clone(); geometry.boundingSphere = host.geometry.boundingSphere.clone();   // the lake measures the mark: the same size as the glass
  const U = {
    uWater: { value: -1e3 }, tPos: { value: pos[0].texture }, uSize: { value: .0115 }, uViewH: { value: 900 }, uShade: { value: new THREE.Vector3(.9, .42, .9) }, uShade2: { value: .3 },
    uDeep: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uLight: { value: new THREE.Color() }, uBlue: { value: new THREE.Color() }, uBlueDeep: { value: new THREE.Color() }
  };
  const material = new THREE.ShaderMaterial({ vertexShader: BEAD_VERTEX, fragmentShader: BEAD_FRAGMENT, uniforms: U, clipping: true, depthTest: true, depthWrite: true, transparent: false, alphaToCoverage: true, toneMapped: false });
  const points = new THREE.Points(geometry, material);
  points.name = 'logo-mark beads'; points.frustumCulled = false; points.renderOrder = 5;
  host.add(points);

  /* ---- each frame ---- */
  const raycaster = new THREE.Ray(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), inv = new THREE.Matrix4(), hit = new THREE.Vector3(), mouse = new THREE.Vector3(), mouseLast = new THREE.Vector3(), mouseVel = new THREE.Vector3(), step = new THREE.Vector3(), size = new THREE.Vector2();
  let last = -1, lastYaw = 0, mouseOn = 0, seeded = false;
  const box = host.geometry.boundingBox, dropLine = box.min.y + (box.max.y - box.min.y) * .24;   // the ring's lower rim
  function update({ time = 0, yaw = 0, gather = 1, pointer = null, camera = null } = {}) {
    const L = look(), on = num(L.beads, 1) > .5;
    points.visible = on;
    host.material.visible = !on || num(L.beadGlass, 0) > .5;
    if (!on) return;
    renderer.getDrawingBufferSize(size); U.uViewH.value = size.y;
    /* the lake's surface (world y = 0) in the mark's space; turning does not change a height */
    points.updateWorldMatrix(true, false);
    U.uWater.value = -points.matrixWorld.elements[13] / Math.max(1e-4, points.matrixWorld.elements[5] || 1);
    U.uSize.value = num(L.beadSize, .0115);
    U.uShade.value.set(num(L.beadSpec, 1.25), num(L.beadEdge, .55), num(L.beadFace, .9)); U.uShade2.value = num(L.beadCaustic, .3);
    hex(THREE, U.uDeep.value, L.beadDeep, '#2c4f76'); hex(THREE, U.uMid.value, L.beadMid, '#8fb3d2'); hex(THREE, U.uLight.value, L.beadLight, '#eef8ff');
    hex(THREE, U.uBlue.value, L.beadBlue, '#1d8fe8'); hex(THREE, U.uBlueDeep.value, L.beadBlueDeep, '#0a56a8');
    if (reducedMotion) return;
    const dt = last < 0 ? 1 / 60 : clamp(time - last, 1 / 240, 1 / 24); last = time;
    /* the pointer, on the plane through the mark's middle */
    let want = 0;
    if (pointer && camera && pointer.at > 0) {
      inv.copy(points.matrixWorld).invert();
      raycaster.origin.setFromMatrixPosition(camera.matrixWorld);
      raycaster.direction.set(pointer.x, pointer.y, .5).unproject(camera).sub(raycaster.origin).normalize();
      raycaster.applyMatrix4(inv);
      if (raycaster.intersectPlane(plane, hit) && hit.length() < 3) {
        if (!seeded) { mouse.copy(hit); mouseLast.copy(hit); seeded = true; }
        mouse.lerp(hit, 1 - Math.exp(-dt * 16));
        want = performance.now() - pointer.at < 900 ? 1 : .22;
      }
    }
    mouseOn += (want - mouseOn) * (1 - Math.exp(-dt * 7));
    step.copy(mouse).sub(mouseLast).divideScalar(dt).clampLength(0, 6); mouseLast.copy(mouse);
    mouseVel.lerp(step, 1 - Math.exp(-dt * 18));
    const yawVel = clamp((yaw - lastYaw) / dt, -8, 8); lastYaw = yaw;
    uA.value.set(dt, time, num(L.beadSpring, 26), Math.pow(clamp(num(L.beadDamp, .9), .5, .995), dt * 60));
    uF.value.set(num(L.beadFlow, .05), num(L.beadFlowScale, 3.2), num(L.beadFlowSpeed, .12), clamp(gather));
    uD.value.set(num(L.beadDrip, .03), num(L.beadDripSpeed, .07), dropLine, 0);
    const V = velMat.uniforms;
    V.uM.value.set(mouse.x, mouse.y, mouse.z, mouseOn); V.uMV.value.set(mouseVel.x, mouseVel.y, mouseVel.z, num(L.beadRadius, .2));
    V.uK.value.set(num(L.beadPush, 3.4), num(L.beadDrag, 1.5), num(L.beadLag, .9) * yawVel);
    const back = 1 - front;
    V.tPos.value = pos[front].texture; V.tVel.value = vel[front].texture; run(velMat, vel[back]);
    posMat.uniforms.tPos.value = pos[front].texture; posMat.uniforms.tVel.value = vel[back].texture; run(posMat, pos[back]);
    front = back; U.tPos.value = pos[front].texture;
  }
  return {
    points, update, reset, count,
    dispose() {
      points.removeFromParent(); geometry.dispose(); material.dispose(); homeTex.dispose(); tri.dispose();
      for (const m of [velMat, posMat, copyMat, zeroMat]) m.dispose();
      for (const t of [...pos, ...vel]) t.dispose();
      host.material.visible = true;
    }
  };
}
