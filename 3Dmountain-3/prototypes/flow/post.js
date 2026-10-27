/* =============================================================================================
   FLOW · post — render targets and the passes after the world:
   world (MRT colour + depth) → clouds (half res) → composite (world·T + scatter) → drops
   (refracting the composite) → depth of field (half res) → final grade to the screen.
   ============================================================================================= */
import * as THREE from 'three';

const FS_VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const COMPOSE = /* glsl */`
uniform sampler2D tWorld, tClouds;
varying vec2 vUv;
void main() {
  vec3 w = texture(tWorld, vUv).rgb;
  vec4 c = texture(tClouds, vUv);
  gl_FragColor = vec4(w * c.a + c.rgb, 1.);
}
`;

const DOF = /* glsl */`
uniform sampler2D tColor, tDepth;
uniform vec2 uTexel;
uniform float uFocus, uAperture, uMaxR;
varying vec2 vUv;
float coc(float z) { return clamp(uAperture * abs(1. - uFocus / max(z, 1e-3)), 0., 1.); }
void main() {
  float c0 = coc(texture(tDepth, vUv).r);
  float R = c0 * uMaxR, lod = log2(max(1., R * 1.3));
  vec3 acc = textureLod(tColor, vUv, lod).rgb; float ws = 1.;
  if (c0 > .01) {
    for (int i = 0; i < 36; i++) {
      float fi = float(i) + .5;
      float r = sqrt(fi / 36.) * R;
      float a = fi * 2.39996;
      vec2 o = vec2(cos(a), sin(a)) * r * uTexel;
      vec2 uv = vUv + o;
      float cs = coc(texture(tDepth, uv).r) * uMaxR;
      float w = smoothstep(r - 1.5, r, cs + .5);
      acc += textureLod(tColor, uv, lod).rgb * w; ws += w;
    }
  }
  gl_FragColor = vec4(acc / ws, c0);
}
`;

const FINAL = /* glsl */`
uniform sampler2D tSharp, tBlur, tBubble;
uniform vec2 uRes;
uniform float uExposure, uContrast, uSat, uVignette, uGrain, uTime, uLeak, uFadeIn, uWarm, uFish, uCA, uFlash, uIris, uZoom;
uniform vec3 uLift, uIrisCol;
varying vec2 vUv;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
vec3 enc(vec3 l) { return mix(l * 12.92, 1.055 * pow(l, vec3(1. / 2.4)) - .055, step(.0031308, l)); }
vec3 spectrum(float t) { return clamp(vec3(abs(t * 6. - 3.) - 1., 2. - abs(t * 6. - 2.), 2. - abs(t * 6. - 4.)), 0., 1.); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
/* Passing through the drop: a fisheye (centre magnified, edges pulled in from beyond the frame,
   mirrored there) with a radial colour split. */
vec2 lens(vec2 uv, float k) {
  vec2 c = (uv - .5) * vec2(uRes.x / uRes.y, 1.);
  float r = length(c) / length(vec2(uRes.x / uRes.y, 1.) * .5);
  c *= (1. - .45 * k) + k * (1.1 * r * r + .5 * r * r * r * r);
  vec2 u = c / vec2(uRes.x / uRes.y, 1.) + .5;
  return 1. - abs(mod(u, 2.) - 1.);
}
vec3 layer(vec2 uv) {
  vec3 sharp = texture(tSharp, uv).rgb;
  vec4 bl = texture(tBlur, uv);
  vec3 c = mix(sharp, bl.rgb, smoothstep(.02, .2, bl.a));
  vec4 b = texture(tBubble, uv);
  return c * (1. - b.a) + b.rgb;
}
void main() {
  vec3 c;
  if (uZoom > .001) {
    /* Through the drop: a radial zoom blur toward the centre. */
    vec3 acc = vec3(0.); float ws = 0.;
    for (int i = 0; i < 12; i++) {
      float t = float(i) / 11., w = 1. - .7 * t;
      acc += layer(lens(.5 + (vUv - .5) * (1. - uZoom * .3 * t), uFish)) * w; ws += w;
    }
    c = acc / ws;
  } else if (uFish + uCA > .001) {
    float k = uFish, ca = uCA * .012 + uFish * .02;
    c = vec3(layer(lens(vUv, k * (1. + ca))).r, layer(lens(vUv, k)).g, layer(lens(vUv, k * (1. - ca))).b);
    vec2 e = (vUv - .5) * vec2(uRes.x / uRes.y, 1.);
    c = mix(c, vec3(layer(.5 + (vUv - .5) * (1. - ca * 1.5)).r, c.g, layer(.5 + (vUv - .5) * (1. + ca * 1.5)).b), smoothstep(.2, .9, length(e)) * (1. - step(.001, uFish)));
  } else c = layer(vUv);
  c = c * (1. + uFlash * 2.5) + uFlash * vec3(1.15, 1.16, 1.18);
  /* Light leak (the reference's lens flare): a prism arc round a light just off the lower-left
     corner, and the glare of that light. */
  if (uLeak > .001) {
    vec2 asp = vec2(uRes.x / uRes.y, 1.);
    float d = length((vUv - vec2(-.30, -.28)) * asp);
    float band = smoothstep(.66, .80, d) * (1. - smoothstep(.80, 1.02, d));
    vec3 prism = spectrum(clamp((d - .70) / .28, 0., 1.)) * band;
    prism *= (1. - smoothstep(.35, .85, vUv.y)) * (1. - smoothstep(.22, .55, vUv.x));
    float g = length((vUv - vec2(-.02, .06)) * asp);
    float glare = exp(-g * 3.2) * .9 + exp(-g * 9.) * .6;
    c += (prism * .8 + vec3(.9, .97, 1.) * glare * .6) * uLeak;
  }
  c *= uExposure;
  c = aces(c);
  c = mix(vec3(dot(c, vec3(.2126, .7152, .0722))), c, uSat);
  c = (c - .5) * uContrast + .5 + uLift;
  c *= mix(vec3(1.), vec3(1.035, 1., .955), uWarm);
  vec2 v = vUv - .5; v.x *= uRes.x / uRes.y;
  c *= 1. - uVignette * smoothstep(.35, 1.05, length(v));
  c = clamp(c, 0., 1.);
  c = enc(c);
  float g = hash(vUv * uRes + fract(uTime * 7.31) * 113.);
  c += (g - .5) * uGrain;
  /* Iris (the reference's vignette transition): the frame closes to a soft ellipse of light. */
  if (uIris > .001) {
    vec2 e = (vUv - .5) * vec2(uRes.x / uRes.y, 1.) * vec2(.72, 1.);
    float R = mix(1.25, -.08, uIris);
    float m = 1. - smoothstep(R - .30 - .25 * (1. - uIris), R, length(e));
    c = mix(uIrisCol, c + .06 * uIris * m, m);
  }
  c *= uFadeIn;
  gl_FragColor = vec4(c, 1.);
}
`;

export function createPost(renderer, { quality = 1 } = {}) {
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const hf = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const world = new THREE.WebGLRenderTarget(4, 4, { ...hf, count: 2 });
  world.textures[1].minFilter = world.textures[1].magFilter = THREE.NearestFilter;
  const clouds = new THREE.WebGLRenderTarget(4, 4, { ...hf, depthBuffer: false });
  const comp = new THREE.WebGLRenderTarget(4, 4, { ...hf, depthBuffer: false, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true });
  const bubble = new THREE.WebGLRenderTarget(4, 4, { ...hf, samples: quality > .6 ? 4 : 0 });
  const dof = new THREE.WebGLRenderTarget(4, 4, { ...hf, depthBuffer: false });
  const mk = (frag, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: FS_VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
  const composeMat = mk(COMPOSE, { tWorld: { value: world.textures[0] }, tClouds: { value: clouds.texture } });
  const dofMat = mk(DOF, { tColor: { value: comp.texture }, tDepth: { value: world.textures[1] }, uTexel: { value: new THREE.Vector2() }, uFocus: { value: 10 }, uAperture: { value: 0 }, uMaxR: { value: 17 } });
  const finalMat = mk(FINAL, {
    tSharp: { value: comp.texture }, tBlur: { value: dof.texture }, tBubble: { value: bubble.texture }, uRes: { value: new THREE.Vector2() },
    uExposure: { value: 1 }, uContrast: { value: 1.04 }, uSat: { value: 1 }, uVignette: { value: .25 }, uGrain: { value: .045 }, uTime: { value: 0 },
    uLeak: { value: 0 }, uFadeIn: { value: 0 }, uWarm: { value: .3 }, uLift: { value: new THREE.Vector3() },
    uFish: { value: 0 }, uCA: { value: 0 }, uFlash: { value: 0 }, uIris: { value: 0 }, uZoom: { value: 0 }, uIrisCol: { value: new THREE.Color(.06, .11, .115) }
  });
  let W = 4, H = 4;
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); };
  return {
    world, clouds, comp, bubble, dof, finalMat, dofMat,
    get size() { return new THREE.Vector2(W, H); },
    setSize(w, h) {
      W = w; H = h;
      world.setSize(w, h); comp.setSize(w, h); bubble.setSize(w, h);
      const hw = Math.max(2, Math.round(w / 2)), hh = Math.max(2, Math.round(h / 2));
      clouds.setSize(hw, hh); dof.setSize(hw, hh);
      dofMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
      finalMat.uniforms.uRes.value.set(w, h);
    },
    compose() { pass(composeMat, comp); },
    depthOfField(S) {
      dofMat.uniforms.uFocus.value = S.focus; dofMat.uniforms.uAperture.value = S.aperture;
      if (S.aperture > .001) pass(dofMat, dof);
      else { renderer.setRenderTarget(dof); renderer.setClearColor(0x000000, 0); renderer.clear(); }
    },
    final(S, time) {
      const u = finalMat.uniforms;
      u.uTime.value = time; u.uExposure.value = S.exposure; u.uContrast.value = S.contrast; u.uSat.value = S.sat;
      u.uVignette.value = S.vignette; u.uGrain.value = S.grain; u.uLeak.value = S.leak; u.uFadeIn.value = S.fadeIn; u.uWarm.value = S.warm;
      u.uFish.value = S.fish; u.uCA.value = S.ca; u.uFlash.value = S.flash; u.uIris.value = S.iris; u.uZoom.value = S.zoom || 0;
      pass(finalMat, null);
    }
  };
}
