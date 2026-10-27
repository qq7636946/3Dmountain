/* =====================================================================
   index1-5 · LOGO 收尾 Logo Seal — STUB of world-logo-scene.js (Interface B), 2026-10-24.
   A placeholder so the block works before the scene specialist delivers: a dusk lake drawn by one full-screen shader
   (gradient sky, warm low sun top-left, two far ridges in haze, rippled water reflecting the sky, a glint column), the
   mark's anchor above the middle, and a PMREM environment for the mark's glass. world-logo-build.cjs ships the real
   world-logo-scene.js instead when that file exists. Same exports as the real one:
     LAKE_DEFAULTS, LAKE_ROWS, createLakeScene({ THREE, renderer, width, height, palette, assetBase, small, reducedMotion })
   Colours are written as display values (like the world's own shaders).
   ===================================================================== */
export const LAKE_DEFAULTS = {
  "sunX": 0.17, "sunY": 0.2, "sunGlow": 1, "horizon": 0.42, "skyTop": "#2f4684", "skyMid": "#7389c0", "skyLow": "#bcc1d8",
  "water": "#27486b", "waterFar": "#8e9cc2", "ripple": 1, "sparkle": 1, "vignette": 0.45, "mountains": 1, "markY": 0.38, "markSize": 1
};
export const LAKE_ROWS = [
  ['太陽 水平位置', 'sunX', 0, 1, .005], ['太陽 高度（由上）', 'sunY', 0, .6, .005], ['太陽 光暈', 'sunGlow', 0, 3, .05], ['地平線 高度（由上）', 'horizon', .25, .7, .005],
  ['天空 頂色', 'skyTop'], ['天空 中段', 'skyMid'], ['天空 近地平線', 'skyLow'], ['湖水 近處', 'water'], ['湖水 遠處', 'waterFar'],
  ['漣漪', 'ripple', 0, 3, .05], ['閃點', 'sparkle', 0, 3, .05], ['暗角', 'vignette', 0, 1.5, .02], ['遠山 濃淡', 'mountains', 0, 1.5, .02],
  ['符號 高度（由上）', 'markY', .1, .7, .005], ['符號 大小倍率', 'markSize', .4, 2, .01]
];

const FRAGMENT = /* glsl */ `
uniform vec2 uRes, uSun;
uniform float uTime, uHorizon, uRipple, uSparkle, uVignette, uMount, uGlow, uReduced;
uniform vec3 uTop, uMid, uLow, uWater, uWaterFar;
varying vec2 vUv;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
vec3 sky(vec2 uv, float hz, float asp) {
  float t = clamp((uv.y - hz) / (1.0 - hz), 0.0, 1.0);
  vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.42, t)); c = mix(c, uTop, smoothstep(0.28, 1.0, t));
  vec2 d = (uv - uSun) * vec2(asp, 1.0); float r = length(d);
  c += vec3(1.0, 0.8, 0.6) * (exp(-r * r * 46.0) * 0.5 + exp(-r * 3.4) * 0.2 + exp(-r * 14.0) * 0.18) * uGlow;
  return c;
}
void main() {
  float asp = uRes.x / uRes.y, hz = 1.0 - uHorizon, tm = uTime * (1.0 - uReduced);
  vec2 uv = vUv; vec3 col;
  float ridgeA = hz + (0.03 + 0.1 * pow(fbm(vec2(uv.x * asp * 1.6 + 4.0, 2.0)), 1.6)) * uMount;
  float ridgeB = hz + (0.012 + 0.055 * fbm(vec2(uv.x * asp * 3.1 + 9.0, 5.0))) * uMount;
  if (uv.y > hz) {
    col = sky(uv, hz, asp);
    vec3 far = mix(col, uWaterFar, 0.55), near = mix(col, uWater, 0.55);
    col = mix(col, far, smoothstep(ridgeA + 0.004, ridgeA - 0.004, uv.y) * 0.55 * min(uMount, 1.0));
    col = mix(col, near, smoothstep(ridgeB + 0.003, ridgeB - 0.003, uv.y) * 0.7 * min(uMount, 1.0));
    col = mix(col, uLow, exp(-(uv.y - hz) * 22.0) * 0.5);
  } else {
    float d = (hz - uv.y) / hz;
    vec2 q = vec2(uv.x * asp * mix(6.0, 26.0, d), pow(d, 0.6) * 38.0);
    float w = (vn(q + vec2(tm * 0.25, tm * 0.12)) - 0.5) + 0.5 * (vn(q * 2.1 - vec2(tm * 0.3, 0.0)) - 0.5);
    vec2 ruv = vec2(uv.x + w * 0.012 * uRipple * (0.3 + d), 2.0 * hz - uv.y);
    vec3 refl = sky(ruv, hz, asp);
    col = mix(refl * 0.8, uWater, smoothstep(0.0, 0.85, d) * 0.72);
    col = mix(col, uWaterFar, exp(-d * 9.0) * 0.4);
    float lane = exp(-pow((uv.x - uSun.x) * asp * 1.8, 2.0));
    float g = pow(clamp(vn(q * vec2(1.0, 1.6) + vec2(tm * 0.5, 0.0)) * 1.25 - 0.1, 0.0, 1.0), 5.0) * lane * (1.0 - smoothstep(0.0, 0.9, d)) * uSparkle;
    col += vec3(1.0, 0.86, 0.66) * g * 0.9;
  }
  vec2 vc = (uv - 0.5) * vec2(asp * 0.7, 1.0);
  col *= 1.0 - uVignette * smoothstep(0.35, 1.1, length(vc));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function createLakeScene({ THREE, renderer, width, height, palette, assetBase, small, reducedMotion }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, width / height, .1, 50);
  const markAnchor = new THREE.Object3D(); scene.add(markAnchor);
  const col = hex => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);
  let look = { ...LAKE_DEFAULTS };
  const uniforms = {
    uRes: { value: new THREE.Vector2(width, height) }, uSun: { value: new THREE.Vector2(look.sunX, 1 - look.sunY) }, uTime: { value: 0 },
    uHorizon: { value: look.horizon }, uRipple: { value: 1 }, uSparkle: { value: 1 }, uVignette: { value: .45 }, uMount: { value: 1 }, uGlow: { value: 1 }, uReduced: { value: reducedMotion ? 1 : 0 },
    uTop: { value: col(look.skyTop) }, uMid: { value: col(look.skyMid) }, uLow: { value: col(look.skyLow) }, uWater: { value: col(look.water) }, uWaterFar: { value: col(look.waterFar) }
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAGMENT, uniforms, depthTest: false, depthWrite: false
  }));
  quad.frustumCulled = false; quad.renderOrder = -10; scene.add(quad);

  // the environment the glass reflects/refracts: the same sky as an equirect gradient, through PMREM
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, look.skyTop); grad.addColorStop(.38, look.skyMid); grad.addColorStop(.5, look.skyLow); grad.addColorStop(.52, look.water); grad.addColorStop(1, '#0d1b2c');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
  const sun = g.createRadialGradient(64, 40, 0, 64, 40, 30); sun.addColorStop(0, 'rgba(255,236,206,1)'); sun.addColorStop(1, 'rgba(255,200,150,0)');
  g.fillStyle = sun; g.fillRect(0, 0, 256, 128);
  const equirect = new THREE.CanvasTexture(canvas); equirect.mapping = THREE.EquirectangularReflectionMapping; equirect.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(equirect); pmrem.dispose(); equirect.dispose();
  const environment = target.texture;

  let aspect = width / height, rise = 1, baseY = 0, visibleH = 3;
  function frame() {
    // the camera looks along -Z from z; the anchor sits at the screen fraction markY from the top, the mark is ~1/3 of the height
    const portrait = aspect < .9, z = portrait ? 6 / Math.min(1, aspect * 1.25) : 6;
    camera.position.set(0, 0, z); camera.lookAt(0, 0, 0); camera.aspect = aspect; camera.updateProjectionMatrix();
    visibleH = 2 * z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    baseY = (.5 - look.markY) * visibleH; markAnchor.position.set(0, baseY - (1 - rise) * .45 * visibleH, 0); markAnchor.visible = rise > .005;
    markAnchor.scale.setScalar(look.markSize * (portrait ? .8 : 1));
    uniforms.uRes.value.set(width, height);
  }
  function apply() {
    uniforms.uSun.value.set(look.sunX, 1 - look.sunY); uniforms.uHorizon.value = look.horizon; uniforms.uRipple.value = look.ripple; uniforms.uSparkle.value = look.sparkle;
    uniforms.uVignette.value = look.vignette; uniforms.uMount.value = look.mountains; uniforms.uGlow.value = look.sunGlow;
    uniforms.uTop.value.setStyle(look.skyTop, THREE.LinearSRGBColorSpace); uniforms.uMid.value.setStyle(look.skyMid, THREE.LinearSRGBColorSpace); uniforms.uLow.value.setStyle(look.skyLow, THREE.LinearSRGBColorSpace);
    uniforms.uWater.value.setStyle(look.water, THREE.LinearSRGBColorSpace); uniforms.uWaterFar.value.setStyle(look.waterFar, THREE.LinearSRGBColorSpace);
    frame();
  }
  apply();
  return {
    scene, camera, markAnchor, environment,
    // rise 0 = under the water (not shown) … 1 = in place; the stub has no waterline to cut the mark at, it just slides up (the real scene masks it)
    update({ time = 0, rise: r = 1 } = {}) { uniforms.uTime.value = time; if (r !== rise) { rise = r; frame(); } },
    setSize(w, h) { width = w; height = h; aspect = w / h; frame(); },
    setLook(next) { look = { ...look, ...next }; apply(); },
    dispose() { quad.geometry.dispose(); quad.material.dispose(); target.dispose(); }
  };
}
