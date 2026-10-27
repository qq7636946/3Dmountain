/* =============================================================================================
   FLOW · clouds — a raymarched cumulus layer (the sea of cloud the drop starts above and falls
   through). Tileable Perlin-Worley 3D noise generated on the GPU, marched at half resolution,
   lit by the sun (Beer-Lambert + powder + two-lobe phase) and the sky. Output: rgb = in-scattered
   light, a = transmittance; the post pass does world * a + rgb.
   ============================================================================================= */
import * as THREE from 'three';

const FS_VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const NOISE_FRAG = /* glsl */`
uniform float uZ;
varying vec2 vUv;
vec3 hash33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float worley(vec3 x, float F) {
  vec3 p = x * F, i = floor(p), f = fract(p);
  float md = 9.;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int l = -1; l <= 1; l++) {
    vec3 g = vec3(float(l), float(j), float(k));
    vec3 c = mod(i + g, F);
    vec3 r = g + hash33(c + 7.1) - f;
    md = min(md, dot(r, r));
  }
  return 1. - clamp(sqrt(md), 0., 1.);
}
vec3 grad3(vec3 c) { vec3 h = hash33(c + 1.7) * 2. - 1.; return normalize(h + 1e-4); }
float perlin(vec3 x, float F) {
  vec3 p = x * F, i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float n000 = dot(grad3(mod(i, F)), f);
  float n100 = dot(grad3(mod(i + vec3(1, 0, 0), F)), f - vec3(1, 0, 0));
  float n010 = dot(grad3(mod(i + vec3(0, 1, 0), F)), f - vec3(0, 1, 0));
  float n110 = dot(grad3(mod(i + vec3(1, 1, 0), F)), f - vec3(1, 1, 0));
  float n001 = dot(grad3(mod(i + vec3(0, 0, 1), F)), f - vec3(0, 0, 1));
  float n101 = dot(grad3(mod(i + vec3(1, 0, 1), F)), f - vec3(1, 0, 1));
  float n011 = dot(grad3(mod(i + vec3(0, 1, 1), F)), f - vec3(0, 1, 1));
  float n111 = dot(grad3(mod(i + vec3(1, 1, 1), F)), f - vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
void main() {
  vec3 x = vec3(vUv, uZ);
  float pf = perlin(x, 4.) * .55 + perlin(x, 8.) * .28 + perlin(x, 16.) * .17;
  pf = clamp(pf * .9 + .5, 0., 1.);
  float w1 = worley(x, 4.) * .625 + worley(x, 8.) * .25 + worley(x, 16.) * .125;
  float w2 = worley(x, 8.) * .625 + worley(x, 16.) * .25 + worley(x, 32.) * .125;
  float w3 = worley(x, 16.) * .625 + worley(x, 32.) * .25 + worley(x, 64.) * .125;
  float pw = clamp((pf - (w1 - 1.)) / (1. - (w1 - 1.)), 0., 1.);
  gl_FragColor = vec4(pw, w1, w2, w3);
}
`;

const MARCH_FRAG = /* glsl */`
precision highp sampler3D;
uniform sampler3D tNoise;
uniform sampler2D tDepth;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCamPos, uSunDir, uSunColor, uSkyTop, uSkyLow, uHaze;
uniform float uBase, uTop, uCoverage, uDensity, uTime, uSteps, uHazeK, uScale, uOn, uClear, uFar;
uniform vec4 uHole;
varying vec2 vUv;
float remap(float v, float a, float b, float c, float d) { return c + (v - a) * (d - c) / (b - a); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
float density(vec3 p, bool fine) {
  float y = (p.y - uBase) / (uTop - uBase);
  if (y <= 0. || y >= 1.) return 0.;
  vec3 wind = vec3(uTime * 6., 0., uTime * 2.5);
  vec4 n = textureLod(tNoise, (p + wind) / uScale, 0.);
  float cov2 = textureLod(tNoise, vec3((p.xz + wind.xz * .5) / (uScale * 7.), .31), 0.).r;
  float cov = clamp(uCoverage + (cov2 - .5) * .7, 0., 1.);
  /* A clear pocket around the camera, and a clear column under it (x, z, inner, outer radius). */
  if (uClear > 0.) cov *= smoothstep(uClear * .45, uClear, length(p - uCamPos));
  if (uHole.w > 0.) cov *= smoothstep(uHole.z, uHole.w, length(p.xz - uHole.xy));
  /* Only the clouds near the camera (a broken layer round the drop, clear air beyond). */
  if (uFar > 0.) cov *= 1. - smoothstep(uFar * .45, uFar, length(p.xz - uCamPos.xz));
  float low = n.g * .625 + n.b * .25 + n.a * .125;
  float shape = remap(n.r, -(1. - low), 1., 0., 1.);
  float hg = smoothstep(0., .14, y) * (1. - smoothstep(.38 + .45 * cov2, 1., y));
  float c = remap(shape * hg, 1. - cov, 1., 0., 1.);
  c = clamp(c, 0., 1.) * cov;
  if (c <= 0.) return 0.;
  if (fine) {
    vec4 dn = textureLod(tNoise, (p + wind * 1.6) / (uScale * .12), 0.);
    float hf = dn.g * .625 + dn.b * .25 + dn.a * .125;
    hf = mix(hf, 1. - hf, clamp(y * 3.5, 0., 1.));
    c = remap(c, hf * .5, 1., 0., 1.);
  }
  return max(c, 0.) * uDensity;
}
float hg(float c, float g) { float g2 = g * g; return (1. - g2) / (4. * 3.14159 * pow(1. + g2 - 2. * g * c, 1.5)); }
void main() {
  if (uOn < .5) { gl_FragColor = vec4(0., 0., 0., 1.); return; }
  vec4 v = uInvProj * vec4(vUv * 2. - 1., 1., 1.); v.xyz /= v.w;
  vec3 dv = normalize(v.xyz);
  vec3 dir = normalize((uCamWorld * vec4(dv, 0.)).xyz);
  float sceneD = texture(tDepth, vUv).r / max(-dv.z, 1e-4);
  float t0, t1;
  if (abs(dir.y) < 1e-5) { if (uCamPos.y < uBase || uCamPos.y > uTop) { gl_FragColor = vec4(0., 0., 0., 1.); return; } t0 = 0.; t1 = 40000.; }
  else {
    float a = (uBase - uCamPos.y) / dir.y, b = (uTop - uCamPos.y) / dir.y;
    t0 = max(min(a, b), 0.); t1 = max(a, b);
  }
  t1 = min(t1, min(sceneD, 42000.));
  /* Nothing to march beyond the far falloff: shorter steps where the clouds are. */
  if (uFar > 0.) t1 = min(t1, uFar / max(length(dir.xz), .02));
  if (t1 <= t0) { gl_FragColor = vec4(0., 0., 0., 1.); return; }
  float N = uSteps;
  float dt = clamp((t1 - t0) / N, 4., 520.);
  float t = t0 + dt * ign(gl_FragCoord.xy);
  float T = 1.;
  vec3 S = vec3(0.);
  float cosT = dot(dir, uSunDir);
  float phase = mix(hg(cosT, .62), hg(cosT, -.22), .32) * 4.;
  float tHit = -1.;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= N || t > t1 || T < .015) break;
    vec3 p = uCamPos + dir * t;
    bool fine = t < 9000.;
    float d = density(p, fine);
    if (d > .002) {
      if (tHit < 0.) tHit = t;
      float od = 0., ls = 26.;
      vec3 lp = p;
      for (int k = 0; k < 5; k++) { lp += uSunDir * ls; od += density(lp, false) * ls; ls *= 1.75; }
      float sig = .045;
      float lightT = exp(-od * sig) * .85 + exp(-od * sig * .25) * .15;
      float powder = 1. - exp(-d * sig * 220.);
      float y = (p.y - uBase) / (uTop - uBase);
      vec3 amb = mix(uSkyLow, uSkyTop, smoothstep(0., 1., y));
      /* Sunlit shell much brighter than the shaded side; dark-ish bases. */
      vec3 lum = uSunColor * lightT * phase * mix(.45, 1., powder) * 4.2 + amb * (.22 + .5 * y);
      float a = exp(-d * sig * dt);
      S += T * (1. - a) * lum;
      T *= a;
    }
    t += dt;
  }
  if (tHit > 0.) {
    float hz = 1. - exp(-tHit * uHazeK);
    S = mix(S, uHaze * (1. - T), hz);
  }
  gl_FragColor = vec4(S, T);
}
`;

export function createClouds(renderer, { quality = 1 } = {}) {
  const N = 64;
  const noiseRT = new THREE.WebGL3DRenderTarget(N, N, N, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false });
  const nt = noiseRT.texture;
  nt.wrapS = nt.wrapT = nt.wrapR = THREE.RepeatWrapping;
  nt.minFilter = nt.magFilter = THREE.LinearFilter;
  nt.generateMipmaps = false;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const genMat = new THREE.ShaderMaterial({ uniforms: { uZ: { value: 0 } }, vertexShader: FS_VERT, fragmentShader: NOISE_FRAG, depthTest: false, depthWrite: false });
  quad.material = genMat;
  const prev = renderer.getRenderTarget();
  for (let z = 0; z < N; z++) { genMat.uniforms.uZ.value = (z + .5) / N; renderer.setRenderTarget(noiseRT, z); renderer.render(qScene, qCam); }
  renderer.setRenderTarget(prev);
  genMat.dispose();

  const marchMat = new THREE.ShaderMaterial({
    uniforms: {
      tNoise: { value: nt }, tDepth: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() },
      uSkyTop: { value: new THREE.Color() }, uSkyLow: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() },
      uBase: { value: 1450 }, uTop: { value: 1880 }, uCoverage: { value: .58 }, uDensity: { value: 1 }, uTime: { value: 0 },
      uSteps: { value: quality > .6 ? 64 : 32 }, uHazeK: { value: .00006 }, uScale: { value: 2600 }, uOn: { value: 1 },
      uClear: { value: 0 }, uHole: { value: new THREE.Vector4() }, uFar: { value: 0 }
    },
    vertexShader: FS_VERT, fragmentShader: MARCH_FRAG, depthTest: false, depthWrite: false
  });
  return {
    noise: nt,
    material: marchMat,
    render(target, camera, depthTex, S, time) {
      const u = marchMat.uniforms;
      u.tDepth.value = depthTex;
      u.uInvProj.value.copy(camera.projectionMatrixInverse);
      u.uCamWorld.value.copy(camera.matrixWorld);
      u.uCamPos.value.copy(camera.position);
      u.uTime.value = time;
      u.uOn.value = S.clouds > .001 ? 1 : 0;
      u.uDensity.value = S.clouds;
      if (S.cloudCoverage !== undefined) u.uCoverage.value = S.cloudCoverage;
      u.uClear.value = S.cloudClear || 0;
      u.uFar.value = S.cloudFar || 0;
      if (S.cloudBase !== undefined) { u.uBase.value = S.cloudBase; u.uTop.value = S.cloudTop; u.uScale.value = S.cloudScale; }
      if (S.cloudHole > .001) u.uHole.value.set(camera.position.x, camera.position.z, S.holeR0 * S.cloudHole, S.holeR1 * S.cloudHole);
      else u.uHole.value.set(0, 0, 0, 0);
      quad.material = marchMat;
      renderer.setRenderTarget(target);
      renderer.render(qScene, qCam);
    },
    setLight({ sunDir, sunColor, skyTop, skyLow, haze }) {
      const u = marchMat.uniforms;
      u.uSunDir.value.copy(sunDir); u.uSunColor.value.copy(sunColor);
      u.uSkyTop.value.copy(skyTop); u.uSkyLow.value.copy(skyLow); u.uHaze.value.copy(haze);
    }
  };
}
