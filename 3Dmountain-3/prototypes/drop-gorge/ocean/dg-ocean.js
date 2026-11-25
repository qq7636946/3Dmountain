/* OCEAN · CEIL (2026-11-18 evening). The look just under the water for index1-5-canyon-forest.html, behind ?ocean=1 only.
   Client: 「下去的海浪感覺海底下的質感要如圖一模一樣，觀看影片往下時候的質感」 (reference: .qa/index1-5/ocean/ref/).
   Loaded by dg-scene.js ONLY when ?ocean=1 is in the address (dynamic import): without the switch this file is never fetched.

   What it gives dg-scene.js (the scene keeps the ownership of its materials; this file is text + one texture + numbers):
     · the surface seen from below: the plane y = uSurfY, one ray per pixel in the ground pass. Three reads of one baked slope map
       (ocean-surface-n.webp, our own FFT wave field, bake_surface.py) at three scales, drifting; the real refraction at the water/air
       boundary (n = 1.33): where the wave's slope lets the ray out, the sky and the low sun show (the glints, white → warm gold round
       the sun); everywhere else TOTAL INTERNAL REFLECTION mirrors the deep water (the dark teal between the glints). The edge of a glint
       is the critical angle itself (one pixel of anti-aliasing), so the glints are crisp. Red is absorbed first along the light's path:
       far glints turn cool.
     · god rays: a fan under the sun's hotspot in the screen pass (two noise reads: wide shafts + thin ones, warm at the top, slow drift).
     · the grade: teal-cyan under the surface → blue-navy below (measured on the video), every layer's haze reads it through bgAt.
   Dials: scene.ocean.u (uniform objects), or ?ocPitch= ?ocSlope= ?ocCell= ?ocFade= ?ocGlint= ?ocSun= ?ocMirror= ?ocDeep= ?ocOpenK= ?ocBand=
   ?ocSwell= ?ocFine= ?ocRays= ?ocGlow= ?ocHotX= ?ocHotY= ?ocOpen= (multipliers / values). */

const Q = new URLSearchParams(location.search);
const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };

export const VERSION = '6';

// The dome of the lens intersects a small travelling swell. Both halves of the
// split shot use this signed viewport distance, including the projected pitch.
export const waterlineGLSL = /* glsl */`
float waterPortDistance(float height, vec3 ray, vec3 cameraUp, float tanHalfFov, float rayLength, float time) {
  float x = ray.x;
  float ripple = 0.012 * sin(x * 5.7 + time * 0.76)
               + 0.005 * sin(x * 12.2 - time * 1.02)
               + 0.0018 * sin(x * 29.0 + time * 1.34);
  float slope = 1.56 * tanHalfFov * (cameraUp.y - ray.y * dot(ray,cameraUp)) / rayLength;
  return (height + 0.78 * ray.y + 0.025 - ripple) / max(0.16, slope);
}
`;

// Re-use the same world-space source for the window, the volume and the bed.
export const riseLightGLSL = /* glsl */`
uniform vec3 uRiseLightDir, uRiseWave;
uniform vec2 uRiseWindow;
uniform float uRiseSunAmount, uRiseFogDensity;
vec2 lightSlope() { return uRiseLightDir.xz / uRiseLightDir.y; }
float lightFootprint(vec2 worldXZ, vec2 radius) {
  vec2 p = (worldXZ - uRiseWindow) / radius;
  return exp(-dot(p, p)) * uRiseSunAmount;
}
float riverbedHeight(vec2 p) { return -17.8 + 0.025 * p.y; }
float riverbedDistance(vec3 eye, vec3 ray) {
  float above = eye.y - riverbedHeight(eye.xz);
  float toward = 0.025 * ray.z - ray.y;
  return toward > 0.001 && above > 0.0 ? above / toward : 1e5;
}
`;

// Integrate three feathered, tapered beams through the visible water segment.
// Closest approach gives the local width of each cone without ray marching.
export const waterShaftsGLSL = /* glsl */`
uniform float uRiseRayStrength, uRiseRayTime, uRiseRayFan, uRiseRaySoftness, uRiseRayDepth;

float coneLight(vec2 foot, vec2 direction, vec2 aperture, vec2 tilt,
                vec2 radius, vec2 depth, float reach) {
  vec2 p = foot - aperture - tilt * depth.x;
  vec2 v = direction - tilt * depth.y;
  vec2 start = p / radius, travel = v / radius;
  float hit = clamp(-dot(start, travel) / max(dot(travel, travel), 1e-4), 0.0, reach);
  float metres = max(0.0, depth.x + depth.y * hit);
  float widen = 1.0 + 0.082 * metres * uRiseRayFan;
  start /= widen;
  travel /= widen;
  float speed = max(length(travel), 0.001);
  vec2 axis = travel / speed;
  float q = dot(start, axis);
  float chord = (smoothstep(-1.8, 1.8, q + speed * reach) - smoothstep(-1.8, 1.8, q)) / speed;
  float side = max(0.0, dot(start, start) - q * q) / uRiseRaySoftness;
  float softEdge = exp(-side) * 0.82 + 0.18 * exp(-side * 0.27);
  float scatter = smoothstep(0.15, 2.75, metres) * (1.0 - smoothstep(uRiseRayDepth * 0.672, uRiseRayDepth, metres));
  return scatter * softEdge * (chord / (0.80 + chord)) * exp(-hit * uRiseFogDensity);
}

float waterShafts(vec3 eye, vec3 ray) {
  const float range = 45.0;
  float enter = clamp(eye.y / max(-ray.y, 0.001), 0.0, range);
  float leave = ray.y > 0.001 ? clamp(-eye.y / ray.y, 0.0, range) : range;
  float bed = riverbedDistance(eye, ray);
  float reach = max(0.0, min(leave, bed) - enter);
  if (reach < 0.001 || uRiseRayStrength <= 0.0) return 0.0;
  vec2 slope = lightSlope();
  vec2 direction = ray.xz - ray.y * slope;
  vec2 start = eye.xz - eye.y * slope + direction * enter - uRiseWindow;
  vec2 depth = vec2(-(eye.y + enter * ray.y), -ray.y);
  vec3 wave = uRiseWave;
  float left = coneLight(start, direction, vec2(-1.52, 1.35),
    vec2(-0.147 * uRiseRayFan + 0.038 * wave.x, 0.022), vec2(0.34 - 0.066 * wave.x, 1.54), depth, reach);
  float mid = coneLight(start, direction, vec2(-0.24, 0.06),
    vec2(0.012 + 0.045 * wave.y, -0.018), vec2(0.46 - 0.085 * wave.y, 1.72), depth, reach);
  float right = coneLight(start, direction, vec2(1.22, -1.04),
    vec2(0.161 * uRiseRayFan + 0.036 * wave.z, -0.039), vec2(0.31 - 0.056 * wave.z, 1.37), depth, reach);

  // Two noise frequencies break up the cones with moving filaments. The
  // coordinate follows the refracted footprint rather than the viewport.
  float across = start.x + direction.x * clamp(-dot(start, direction) / max(dot(direction, direction), 0.002), 0.0, reach);
  float broad = texture2D(tNoise, vec2(across * 0.19 - uRiseRayTime * 0.011, 0.41)).r;
  float fine = texture2D(tNoise, vec2(across * 0.67 + uRiseRayTime * 0.020, 0.18)).r;
  float strands = 0.72 + 0.57 * smoothstep(0.29, 0.71, broad * 0.68 + fine * 0.32);
  vec3 weights = vec3(1.10, 1.34, 1.07) * (1.0 + 0.41 * wave);
  float angle = max(0.0, dot(ray, uRiseLightDir));
  return dot(vec3(left, mid, right), weights) * strands * (0.52 + 0.48 * angle * angle)
    * exp(-max(-eye.y, 0.0) * uRiseFogDensity * 0.57) * uRiseSunAmount * uRiseRayStrength;
}
`;

const riverbedGLSL = /* glsl */`
uniform sampler2D tCaus;
uniform float uRiseBedRippleSize, uRiseCausticStrength, uRiseCausticTime, uRiseCausticReach, uRiseCausticSoftness;
uniform vec3 uRiseCausticColor;

vec3 riverbedLight(vec3 bed, float reach, float shelf, vec3 water) {
  float time = uRiseCausticTime;
  vec2 opening = bed.xz - bed.y * lightSlope();
  vec2 p = opening * vec2(0.104, 0.078) / uRiseBedRippleSize;
  // Refract the coordinates with broad swell and a smaller, crossing ripple.
  vec2 slow = texture2D(tOcN, p * 0.47 + vec2(-time * 0.009, time * 0.014)).rg - 0.5;
  vec2 ripple = texture2D(tOcF, p.yx * 1.18 + vec2(time * 0.026, -time * 0.018)).gr - 0.5;
  vec2 warp = slow * 0.16 + ripple * 0.070;
  float a = texture2D(tCaus, p + warp + vec2(time * 0.012, time * 0.006)).r;
  vec2 crossed = mat2(0.87, 0.493, -0.493, 0.87) * p * 1.27 - warp * 0.74;
  float b = texture2D(tCaus, crossed + vec2(0.37 - time * 0.009, time * 0.012)).g;
  float grain = texture2D(tNoise, bed.xz * vec2(0.47, 0.72)).r;
  vec3 stone = mix(vec3(0.008, 0.022, 0.041), vec3(0.026, 0.056, 0.085), grain);
  float pool = lightFootprint(opening, vec2(8.8, 18.9) * uRiseCausticReach);
  float softness = 0.20 * (uRiseCausticSoftness - 1.0);
  float lace = 0.15 * a + 0.96 * smoothstep(0.32 - softness, 0.90, a) * mix(0.48, 1.0, smoothstep(0.20, 0.70, b))
             + 0.31 * smoothstep(0.37 - softness, 0.93, b) + 1.42 * a * b;
  float glints = smoothstep(0.29, 0.64, a * b) * (0.70 + 0.30 * grain);
  float pulse = 0.86 + 0.30 * smoothstep(0.24, 0.72, slow.r + 0.5);
  float gain = pool * pulse * uRiseCausticStrength;
  vec3 lit = stone + uRiseCausticColor * lace * (0.43 + 1.59 * pool) * gain;
  lit += vec3(0.85, 0.95, 0.99) * glints * gain * 0.29;
  vec3 transmission = exp(-reach * uRiseFogDensity * vec3(1.85, 1.16, 0.88));
  return mix(water, lit, shelf * transmission);
}
`;

const RISE_CONTROLS = [
  ['水面透光', [
    ['透光區亮度', 'windowStrength', 'uRiseWindowStrength', 1, 0, 2.2, 0.05],
    ['透光區大小', 'windowSize', 'uRiseWindowSize', 1, 0.45, 2.0, 0.05],
    ['光源左右位置', 'windowOffset', 'uRiseWindowOffset', 0, -10, 10, 0.1],
    ['光源遠近', 'windowDistance', 'uRiseWindowDistance', 20.2, 16, 32, 0.1],
    ['水面波紋大小', 'surfaceRippleSize', 'uRiseSurfaceRippleSize', 1, 0.30, 4, 0.01],
    ['水面波紋速度', 'surfaceSpeed', 'uRiseSurfaceSpeed', 1, 0, 2.5, 0.05],
    ['水面波紋起伏', 'surfaceChop', 'uRiseSurfaceChop', 1, 0.30, 1.8, 0.05],
    ['透光區顏色', 'windowColor', 'uRiseWindowColor', '#cae3ee', 'color']
  ]],
  ['放射光束', [
    ['光束強度', 'rays', 'uRiseRayStrength', 0.36, 0, 0.9, 0.01],
    ['光束動態速度', 'raySpeed', 'uRiseRaySpeed', 1, 0, 2.5, 0.05],
    ['光束張角', 'rayFan', 'uRiseRayFan', 1, 0.35, 1.8, 0.05],
    ['光束柔邊', 'raySoftness', 'uRiseRaySoftness', 1, 0.45, 2.0, 0.05],
    ['光束下照深度', 'rayDepth', 'uRiseRayDepth', 17.4, 7, 24, 0.1],
    ['光束顏色', 'rayColor', 'uRiseRayColor', '#c4e1f6', 'color']
  ]],
  ['河床焦散', [
    ['河床波紋大小', 'bedRippleSize', 'uRiseBedRippleSize', 1, 0.30, 4, 0.01],
    ['焦散亮度', 'causticStrength', 'uRiseCausticStrength', 1, 0, 2.2, 0.05],
    ['焦散流速', 'causticSpeed', 'uRiseCausticSpeed', 1, 0, 2.5, 0.05],
    ['焦散聚光範圍', 'causticReach', 'uRiseCausticReach', 1, 0.4, 2.1, 0.05],
    ['焦散柔邊', 'causticSoftness', 'uRiseCausticSoftness', 1, 0.45, 2.0, 0.05],
    ['焦散顏色', 'causticColor', 'uRiseCausticColor', '#c0e3f8', 'color']
  ]],
  ['水色與岩壁', [
    ['水下底色亮度', 'ambientBrightness', 'uBgGain', 0.84, 0.40, 1.60, 0.01],
    ['水下霧濃度', 'fogDensity', 'uRiseFogDensity', 0.023, 0.008, 0.065, 0.001],
    ['水下主色', 'waterColor', 'uBgMid', '#315f89', 'color'],
    ['深水暗部色', 'deepColor', 'uBgLow', '#061933', 'color'],
    ['岩壁可見度（0 關）', 'rockOpacity', 'uRiseRockOpacity', 1, 0, 1, 0.05],
    ['岩壁紋理起伏', 'rockDetail', 'uRiseRockDetail', 1, 0.3, 1.8, 0.05],
    ['岩壁顏色', 'rockColor', 'uRockTint', '#8da3aa', 'color']
  ]],
  ['海底影片融合', [
    ['海景影片融合', 'seaVideoMix', 'uSeaVidMix', 0.86, 0, 1, 0.01],
    ['影片色彩保留', 'seaVideoColor', 'uSeaVidColor', 0.50, 0, 1, 0.01],
    ['影片亮度', 'seaVideoGain', 'uSeaVidGain', 0.96, 0.3, 1.8, 0.02]
  ]]
];

export function createRiseLighting(THREE, dials, lightDirection, grade, hasBanks, hasSeaVideo = false) {
  const uniforms = {
    ...grade, uRiseLightDir: lightDirection, uRiseSunAmount: { value: 1 },
    uRiseWindow: { value: new THREE.Vector2() }, uRiseWave: { value: new THREE.Vector3() },
    uRiseSurfaceTime: { value: 0 }, uRiseRayTime: { value: 0 }, uRiseCausticTime: { value: 0 },
    uSeaVidReady: { value: 0 }, uSeaVidAspect: { value: 16 / 9 }, uSeaVidShift: { value: 0 }, uSeaVidRockMul: { value: 1 }
  };
  const rows = [];
  for (const [heading, controls] of RISE_CONTROLS) {
    if (heading === '海底影片融合' && !hasSeaVideo) continue;
    rows.push([heading]);
    for (const [label, key, name, start, ...limits] of controls) {
      if (limits[0] === 'color') {
        const color = (uniforms[name] ||= { value: new THREE.Color(start) }).value;
        Object.defineProperty(dials, key, {
          enumerable: true, get: () => '#' + color.getHexString(),
          set: value => { if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) color.set(value); }
        });
      } else {
        const [min, max] = limits;
        const initial = THREE.MathUtils.clamp(dials[key] ?? start, min, max);
        const uniform = uniforms[name] ||= { value: initial };
        uniform.value = initial;
        Object.defineProperty(dials, key, {
          enumerable: true, get: () => uniform.value,
          set: value => { uniform.value = THREE.MathUtils.clamp(Number.isFinite(value) ? value : initial, min, max); }
        });
      }
      if (hasBanks || !key.startsWith('rock')) rows.push([label, key, ...limits]);
    }
  }
  if (!hasSeaVideo) {
    uniforms.uSeaVidMix ||= { value: 0 };
    uniforms.uSeaVidColor ||= { value: 0.5 };
    uniforms.uSeaVidGain ||= { value: 1 };
  }

  let previousTime = null;
  const waveAt = (x, z, t) => 0.52 * Math.sin(x * 0.56 + z * 0.27 - t * 1.88)
    + 0.31 * Math.sin(-x * 0.29 + z * 0.49 - t * 2.42 + 1.4)
    + 0.17 * Math.sin(x * 0.83 - z * 0.21 + t * 1.31);
  function update(time, moving, sunY) {
    // Integrating the speed keeps the phase continuous while dragging a slider.
    const dt = moving && previousTime !== null ? Math.max(0, time - previousTime) : 0;
    previousTime = moving ? time : null;
    uniforms.uRiseSurfaceTime.value += dt * uniforms.uRiseSurfaceSpeed.value;
    uniforms.uRiseRayTime.value += dt * uniforms.uRiseRaySpeed.value;
    uniforms.uRiseCausticTime.value += dt * uniforms.uRiseCausticSpeed.value;
    const origin = uniforms.uRiseWindow.value;
    origin.set(11 * lightDirection.value.x / lightDirection.value.y + uniforms.uRiseWindowOffset.value,
      -uniforms.uRiseWindowDistance.value);
    const t = uniforms.uRiseRayTime.value;
    uniforms.uRiseWave.value.set(waveAt(origin.x - 1.52, origin.y + 1.35, t),
      waveAt(origin.x - 0.24, origin.y + 0.06, t), waveAt(origin.x + 1.22, origin.y - 1.04, t));
    uniforms.uRiseSunAmount.value = THREE.MathUtils.smoothstep(sunY, 0.025, 0.20);
  }
  return { uniforms, update, rows };
}

// Generate the two tileable cellular fields on the GPU once. Mipmaps keep
// thin caustic lines stable at distance. The animated warp stays per fragment.
export function bakeRiseCaustics(THREE, renderer) {
  const size = 256;
  const target = new THREE.WebGLRenderTarget(size, size, {
    wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, depthBuffer: false,
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      vec2 jitter(vec2 cell) {
        vec3 p = fract(cell.xyx * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yzx + 33.33);
        return fract((p.xx + p.yz) * p.zy);
      }
      float veins(vec2 p, float period, float seed) {
        vec2 whole = floor(p), local = fract(p);
        float near = 9.0, next = 9.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 stepToCell = vec2(float(x), float(y));
            vec2 sampleAt = 0.18 + 0.64 * jitter(mod(whole + stepToCell, period) + seed);
            vec2 d = stepToCell + sampleAt - local;
            float d2 = dot(d, d);
            next = min(next, max(near, d2));
            near = min(near, d2);
          }
        }
        return exp(-(sqrt(next) - sqrt(near)) * 7.0);
      }
      void main() {
        vec2 uv = gl_FragCoord.xy / ${size.toFixed(1)};
        gl_FragColor = vec4(veins(uv * 7.0, 7.0, 8.71), veins(uv * 6.0, 6.0, 24.35), 0.0, 1.0);
      }
    `
  });
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, new THREE.Camera());
  } finally {
    renderer.setRenderTarget(previous);
    material.dispose();
    geometry.dispose();
  }
  return target;
}

/* the grade (sRGB hex). TEAL = the video's water (measured on its settled frames, between the glints); ABOVE = the same brightness in the
   canyon's own above-water colours (cool steel blue: river ≈ rgb 55,75,110, sky ≈ 110,135,175, slate rock).
   ?ocTone= 0 … 1 mixes them: 0 = the teal, 1 = fully the above-water palette; default 0.5 (client 11-18: 「色調調過去跟水上像一點點 折衷」) */
export const TONE = Math.min(1, Math.max(0, num('ocTone', 0.5)));
export const RISE_TONE = Math.min(1, Math.max(0, num('ocTone', 0.70)));
const TEAL = { reef: '#b4c0c2', top: '#2c7a8c', mid: '#226a80', low: '#021c2c', abyss: '#021420', glow: '#e9f3f4',
  key: '#d2f0f2', sky: '#5aa6ba', ground: '#0c2a40', rockTint: '#8fb0b6', mossTint: '#8fb08c', deep: '#2c5f76' };
const ABOVE = { reef: '#b6bcc8', top: '#44709e', mid: '#375f92', low: '#07183a', abyss: '#05102a', glow: '#e9eef6',
  key: '#dde7ee', sky: '#7d97b2', ground: '#17222f', rockTint: '#8da3aa', mossTint: '#93ae84', deep: '#3d5a86' };
const mixHex = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t).toString(16).padStart(2, '0')).join('');
const paletteAt = tone => Object.fromEntries(Object.keys(TEAL).map(k => [k, mixHex(TEAL[k], ABOVE[k], tone)]));
export const PALETTE = paletteAt(TONE);
export const RISE_PALETTE = paletteAt(RISE_TONE);
const mix3 = (a, b) => a.map((v, i) => +(v * (1 - TONE) + b[i] * TONE).toFixed(3));
const SKY = mix3([0.19, 0.40, 0.58], [0.26, 0.37, 0.6]), RAYCOOL = mix3([0.46, 0.72, 0.9], [0.6, 0.7, 0.96]);   /* a cool glint far from the sun (linear); the rays' cool part (sRGB sum) */

/* the numbers the shaders read */
export function makeUniforms(THREE, tNoise) {
  return {
    tOcN: { value: tNoise }, tOcF: { value: tNoise },
    /* x = the ceiling's own upward look (rad: the descent looks level, the video looks up at the surface), y = wave slope gain,
       z = cell scale, w = how fast the ceiling fades into the water along the line of sight */
    uOcA: { value: new THREE.Vector4(num('ocPitch', 0.4), 0.36 * num('ocSlope', 1), 0.72 * num('ocCell', 1), num('ocFade', 2.0)) },
    /* x = glint gain, y = gold gain round the hotspot, z = the mirror's (TIR) brightness, w = fade with the lens depth (per metre below 3 m) */
    uOcB: { value: new THREE.Vector4(num('ocGlint', 1), num('ocSun', 1), num('ocMirror', 1), num('ocDeep', 0.06)) },
    /* x = how much of the surface opens (bias on Snell's k: the bright fraction), y = the diagonal band of glints through the hotspot,
       z = the swell (large slow light/dark), w = the fine flecks */
    uOcC: { value: new THREE.Vector4(num('ocOpenK', 0), num('ocBand', 1), num('ocSwell', 1), num('ocFine', 1)) },
    /* x = sun sparkle gain (the tiny hard flecks), y = how fast the flecks thin out away from the hotspot, z = ripple lines in the gaps, w = fine wavelets' slope */
    uOcD: { value: new THREE.Vector4(num('ocSpark', 1), num('ocSparkR', 1), num('ocLines', 1), num('ocWavelet', 1)) },
    uOcSky: { value: new THREE.Color().setRGB(SKY[0], SKY[1], SKY[2]) },     /* linear: a glint far from the sun, sRGB (120,170,200) */
    uOcSunCol: { value: new THREE.Color().setRGB(1.0, 0.76, 0.45) },    /* linear: a glint at the hotspot, sRGB (255,246,232) */
    uOcDeep: { value: new THREE.Color(PALETTE.deep) },                    /* the water the underside mirrors (between the glints) */
    /* the screen pass: xy = the hotspot on the screen (shares, y up), z = rays strength, w = glow round the hotspot */
    /* set each frame from s.ceil (the hand-over after the crossing): x = the ceiling's presence, y = softness (mip bias: dim AND soft at first) */
    uOcK: { value: new THREE.Vector4(1, 0, 0, 0) },
    uOcRay: { value: new THREE.Vector4(num('ocHotX', 0.74), num('ocHotY', 0.8), 0.36 * num('ocRays', 1), 0.16 * num('ocGlow', 1)) }
  };
}

/* the surface map (RG = slope, B = height) */
export const loadFine = (THREE, renderer) => loadSurface(THREE, renderer, './ocean-fine-n.webp');   /* the rounded fine wavelets (bake_fine.py) */
export function loadSurface(THREE, renderer, file = './ocean-surface-n.webp') {
  return new Promise(res => new THREE.TextureLoader().load(new URL(file + '?v=' + VERSION, import.meta.url).href, t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); res(t);
  }, undefined, () => res(null)));
}

export const riseCeilFS = /* glsl */`
  uniform sampler2D tOcN, tOcF, tSeaVid;
  uniform vec3 uCamPos, uCamR, uCamU, uCamF;
  uniform float uTanH, uSurfY;
  uniform float uRiseWindowStrength, uRiseWindowSize, uRiseSurfaceRippleSize, uRiseSurfaceTime, uRiseSurfaceChop;
  uniform float uSeaVidReady, uSeaVidMix, uSeaVidColor, uSeaVidGain, uSeaVidAspect, uSeaVidShift;
  uniform vec3 uRiseWindowColor;
  uniform vec2 uRiseOptics, uRiseClip;
  uniform vec4 uOcA, uOcB, uOcK;
  ${waterlineGLSL}
  ${riseLightGLSL}
  ${riverbedGLSL}

  vec3 throughSurface(vec3 eye, vec3 ray, vec3 water) {
    float reach = max(-eye.y, 0.30) / ray.y;
    vec2 surface = eye.xz + ray.xz * reach;
    float fade = exp(-reach * uRiseFogDensity * 0.72)
               * smoothstep(0.025, 0.18, ray.y) * uOcK.x;
    if (fade < 0.002) return water;

    float time = uRiseSurfaceTime;
    vec2 p = surface * (uOcA.z / uRiseSurfaceRippleSize);
    vec3 swell = texture2D(tOcN, p * vec2(0.135, 0.19) + vec2(time * 0.005, time * 0.016)).rgb;
    vec3 ripples = texture2D(tOcF, (mat2(0.89, 0.46, -0.46, 0.89) * p) * 0.79
                           + vec2(-time * 0.024, time * 0.014), 0.20 + uOcK.y * 0.32).rgb;
    vec2 slope = ((swell.rg - 0.5) * 1.18 + (ripples.rg - 0.5) * 0.88) * uRiseSurfaceChop;
    vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
    float cosIn = clamp(dot(ray, normal), 0.0, 1.0);
    float critical = 1.0 - 1.777 * (1.0 - cosIn * cosIn);
    float edge = 0.018 + 0.84 * fwidth(critical);
    float snell = smoothstep(-edge, edge, critical);
    float facet = smoothstep(0.49, 0.72, swell.b * 0.37 + ripples.b * 0.63);
    float glisten = smoothstep(0.62, 0.83, abs(slope.x * 0.49 + slope.y) * 1.85 + ripples.b * 0.70);
    float window = lightFootprint(surface + slope * 2.7, vec2(5.4, 4.7) * uRiseWindowSize) * uRiseWindowStrength;
    float pulse = 0.91 + 0.11 * uRiseWave.y;

    vec3 reflected = vec3(0.011, 0.032, 0.061)
      + water * (0.30 + 0.41 * swell.b)
      + vec3(0.10, 0.19, 0.29) * glisten * (0.31 + window * 0.47);
    vec3 sky = vec3(0.23, 0.38, 0.57) * (0.58 + 0.39 * ripples.b + 0.23 * facet);
    float highlight = (0.60 + 0.42 * facet + 0.38 * glisten) * window * pulse;
    vec3 transmitted = (sky + uRiseWindowColor * highlight) * uOcB.x;
    reflected += uRiseWindowColor * vec3(0.41, 0.47, 0.53) * window * (0.40 + 0.60 * facet) * pulse;
    // The rippled facets start transmitting at slightly different angles around the bright core.
    float microTransmission = 0.43 * min(1.0, window) * smoothstep(-0.39, 0.06, critical);
    float through = snell + (1.0 - snell) * microTransmission;
    return mix(water, mix(reflected, transmitted, through * 0.98), clamp(fade, 0.0, 1.0));
  }

  void main() {
    vec2 ndc = gl_FragCoord.xy / uRes * 2.0 - 1.0;
    ndc.y += uRiseOptics.y;
    vec2 lens = ndc * vec2(uRes.x / uRes.y, 1.0) * uTanH;
    float rayLength = length(vec3(lens, 1.0));
    vec3 ray = (uCamF + uCamR * lens.x + uCamU * lens.y) / rayLength;
    vec3 eye = uCamPos - vec3(0.0, uSurfY, 0.0);
    gl_FragDepth = 1.0;
    if (eye.y > -0.84 && waterPortDistance(eye.y, ray, uCamU, uTanH, rayLength, uTime) > 0.018) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec3 color = bgAt(gl_FragCoord.xy);
    float bedT = riverbedDistance(eye, ray);
    if (bedT < 112.0) {
      vec3 bed = eye + ray * bedT;
      float shelf = smoothstep(3.4, 8.0, -bed.z)
                   * smoothstep(0.0, 1.5, eye.y - riverbedHeight(eye.xz))
                   * (1.0 - smoothstep(67.0, 112.0, bedT));
      color = riverbedLight(bed, bedT, shelf, color);
      if (bed.z < -5.5) {
        // Write the shelf depth for the real rocks and particles drawn after it.
        float viewZ = max(uRiseClip.x, bedT * dot(ray, uCamF));
        gl_FragDepth = clamp(uRiseClip.y * (1.0 - uRiseClip.x / viewZ) / (uRiseClip.y - uRiseClip.x), 0.0, 1.0);
      }
    } else if (ray.y > 0.025) {
      color = throughSurface(eye, ray, color);
    }
    /* sea2.mp4 Act-1 fusion: aspect-matched real underwater ocean & coral reef graded into Finnovation's ocean palette,
       layered with live 3D caustics & surface highlights, fading smoothly into deep blue as the lens ascends toward the canyon. */
    if (uSeaVidReady > 0.001 && uSeaVidMix > 0.001) {
      float depthFade = smoothstep(-1.4, -7.8, eye.y);
      float vMix = uSeaVidReady * uSeaVidMix * depthFade;
      if (vMix > 0.001) {
        vec2 scr = gl_FragCoord.xy / uRes;
        float scrAsp = uRes.x / max(uRes.y, 1.0);
        vec2 cover = scrAsp > uSeaVidAspect ? vec2(1.0, uSeaVidAspect / scrAsp) : vec2(scrAsp / uSeaVidAspect, 1.0);
        vec2 vUv = (scr - 0.5) * cover * 0.92 + 0.5;
        vUv.y = clamp(vUv.y + uSeaVidShift, 0.004, 0.996);
        vec2 wRip = (texture2D(tOcF, scr * vec2(1.5, 1.1) + vec2(uRiseSurfaceTime * 0.015, -uRiseSurfaceTime * 0.010)).rg - 0.5) * 0.0042;
        vec3 raw = texture2D(tSeaVid, clamp(vUv + wRip, 0.002, 0.998)).rgb;
        vec3 vLin = raw * (raw * (raw * 0.305306011 + 0.682171111) + 0.012522878);
        float vl = dot(vLin, vec3(0.2126, 0.7152, 0.0722));
        vec3 oceanTint = mix(uBgLow * 1.12, mix(uBgMid * 1.12, uRiseWindowColor * 0.95, smoothstep(0.46, 0.94, scr.y)), smoothstep(0.0, 0.72, pow(max(vl, 0.0), 0.78)));
        vec3 coolGrade = oceanTint * (0.46 + 1.48 * vl);
        vec3 reefNatural = vLin * mix(vec3(0.74, 0.93, 1.08), vec3(0.84, 0.97, 1.05), smoothstep(0.42, 0.85, scr.y));
        vec3 fused = mix(coolGrade, reefNatural, uSeaVidColor) * uSeaVidGain;
        float reefZone = 1.0 - smoothstep(0.36, 0.62, scr.y);
        float causNet = texture2D(tCaus, vUv * vec2(2.6, 1.9) + vec2(uRiseCausticTime * 0.014, uRiseCausticTime * 0.008)).r
                      * texture2D(tCaus, vUv * vec2(3.3, 2.5) + vec2(-uRiseCausticTime * 0.011, uRiseCausticTime * 0.013) + 0.31).g;
        fused += uRiseCausticColor * smoothstep(0.18, 0.75, causNet) * reefZone * (0.14 + 0.36 * vl) * uRiseCausticStrength * 0.42;
        float topZone = smoothstep(0.55, 0.95, scr.y);
        vec3 procLift = max(color - uBgMid * 0.55, vec3(0.0));
        fused += procLift * topZone * 0.22;
        float titleZone = (1.0 - smoothstep(0.06, 0.42, scr.y)) * exp(-pow((scr.x - 0.5) / 0.36, 2.0));
        float topNavVeil = smoothstep(0.86, 1.0, scr.y) * exp(-pow((scr.x - 0.5) / 0.28, 2.0)) * 0.18;
        fused = mix(fused, uBgLow * 0.85 + uBgMid * 0.14, 0.14 * (1.0 - scr.y) + 0.34 * titleZone);
        fused = mix(fused, uBgMid * 0.72, topNavVeil);
        color = mix(color, fused, vMix);
      }
    }
    gl_FragColor = vec4(toSRGB(color), 1.0);
  }
`;

/* ---- the ground pass: replaces dg-scene's ceilFS (same header: bgAt, toSRGB, uRes, uTime come from COMMON_UW) */
export const ceilFS = /* glsl */`
  uniform sampler2D tOcN, tOcF; uniform vec3 uCamPos, uCamR, uCamU, uCamF, uOcSky, uOcSunCol, uOcDeep; uniform float uTanH, uSurfY, uCeil, uOcOver; uniform vec4 uOcA, uOcB, uOcC, uOcD, uOcRay, uOcK;
  void main(){
    vec2 fc = gl_FragCoord.xy, uv = fc / uRes; vec3 base = bgAt(fc);
    vec2 ndc = uv * 2.0 - 1.0; float asp = uRes.x / uRes.y;
    vec3 rd0 = normalize(uCamF + uCamR * (ndc.x * uTanH * asp) + uCamU * (ndc.y * uTanH));
    /* the ceiling's own look: the ray turned up about the lens's right axis (the descent looks level; the video looks up) */
    float ca = cos(uOcA.x), sa = sin(uOcA.x);
    vec3 rd = rd0 * ca + cross(uCamR, rd0) * sa + uCamR * dot(uCamR, rd0) * (1.0 - ca);
    vec3 col = base;
    if (rd.y > 0.012) {
      float h = max(uSurfY - uCamPos.y, 0.8), t = h / rd.y;
      vec2 p = (uCamPos.xz + rd.xz * t) * uOcA.z;
      /* the field streams away from the lens (toward the horizon, −z), every scale at its own speed, so the cells re-form all the time:
         a, b = the chop · c = ripples · d, e = fine wavelets (centimetres: the flecks and slivers) · the swell = very large and slow */
      vec2 a = texture2D(tOcN, p * 0.075 + vec2(uTime * 0.0021, uTime * 0.0135), -0.7 + uOcK.y).rg - 0.5;
      vec2 b = texture2D(tOcN, p * 0.19 + vec2(-uTime * 0.0105, uTime * 0.057) + 0.37, -0.7 + uOcK.y).rg - 0.5;
      vec3 c = texture2D(tOcN, p.yx * 0.6 + vec2(uTime * 0.27, -uTime * 0.031) + 0.71, -1.0 + uOcK.y).grb - vec3(0.5, 0.5, 0.0);
      vec2 d = texture2D(tOcF, p * 1.5 + vec2(-uTime * 0.06, uTime * 0.47) + 0.19, -0.6 + uOcK.y).rg - 0.5;
      vec2 e = texture2D(tOcF, p.yx * 3.6 + vec2(uTime * 1.05, uTime * 0.11) + 0.53, -0.6 + uOcK.y).gr - 0.5;
      float swell = texture2D(tOcN, p * 0.021 + vec2(uTime * 0.0012, uTime * 0.0042) + 0.13).b;
      swell = smoothstep(0.3, 0.7, swell);
      vec2 sf = (d * 0.62 + e * 0.5) * 5.0 * uOcA.y * uOcD.w;                 /* the wavelets' slope */
      vec2 sm = c.xy * 0.8 * uOcC.w * 5.0 * uOcA.y;                            /* the ripples' slope */
      vec2 s = (a * 1.1 + b * 0.85) * 5.0 * uOcA.y + sm + sf;
      vec3 n = normalize(vec3(-s.x, -1.0, -s.y));            /* the surface's normal on the water side */
      /* the sun's hotspot: distances in screen WIDTHS (the same at every window shape). hc = the hot core, wz = the warm zone,
         bloom = its halo, band = the broad diagonal of glints through the hotspot (the far left is darker and sparser) */
      vec2 hg = vec2(uv.x - uOcRay.x, (uv.y - uOcRay.y) / asp); float hd = dot(hg, hg);
      float hc = exp(-hd / 0.0035), wz = exp(-hd / 0.02), bloom = exp(-hd / 0.045);
      vec2 ax = normalize(vec2(-1.0, -0.2)); float al = dot(hg, ax), ac = dot(hg, vec2(-ax.y, ax.x));
      float band = exp(-ac * ac / 0.012) * exp(-max(al, 0.0) * max(al, 0.0) / 0.3) * exp(-min(al, 0.0) * min(al, 0.0) / 0.05);
      float ci = max(-dot(rd, n), 0.0);
      float k = 1.0 - 1.7689 * (1.0 - ci * ci)                /* Snell, water → air (1.33²): k > 0 = the ray leaves the water */
              + uOcC.x + 0.1 + (0.16 * band + 0.22 * wz + 0.55 * hc) * uOcC.y + (swell - 0.5) * 0.3 * uOcC.z;
      float open = smoothstep(0.0, fwidth(k) * 1.1 + 0.003, k);   /* a hard, one-pixel edge at the critical angle */
      /* the sun's sparkle: a facet shows the sun itself where its slope is the one that bends the sun to the lens — flat facets at the
         hotspot, steeper (rarer) ones away from it: many tiny hard flecks that thin out with distance */
      vec2 sq = s - hg * vec2(5.0, 5.0 * asp) * uOcD.y; float spark = smoothstep(0.36, 0.44, exp(-dot(sq, sq) / 0.05)) * uOcD.x;
      float lit = max(open, spark);
      float ct = sqrt(max(k, 0.0));
      float core = smoothstep(0.0, 0.2, k);                   /* a glint is brightest in its middle … */
      float fleck = 0.7 + 0.6 * c.z;                          /* … and carries the ripples' own light */
      vec3 gl = mix(uOcSky * (0.62 + 0.95 * core) * (0.85 + 0.4 * band), uOcSunCol * (0.66 + 0.42 * core) * uOcB.y, wz) * fleck * uOcB.x;
      gl *= 1.0 - (0.02 + 0.98 * pow(1.0 - min(ct * 2.2, 1.0), 5.0)) * (1.0 - spark);   /* Fresnel: the rim of a glint is darker */
      gl = mix(gl, vec3(1.1, 0.94, 0.7) * uOcB.x * uOcB.y, max(spark * (0.35 + 0.65 * wz), hc * core));   /* the sun itself: white-gold */
      /* the mirror (total internal reflection): the water below — lighter on the swell's faces and where a wave nearly opens; the
         wavelets draw fine blue-grey ripple lines in it and catch soft second highlights */
      vec3 Rr = reflect(rd, n); float rl = dot(sf + sm * 0.7, vec2(0.33, 0.94));
      vec3 mirror = uOcDeep * (0.2 + 1.3 * swell * uOcC.z + 0.5 * smoothstep(-0.98, -0.2, Rr.y) + 0.9 * smoothstep(-0.4, 0.0, k)) * uOcB.z;
      mirror *= 1.0 + uOcD.z * (0.55 * smoothstep(-0.3, 0.3, rl) - 0.3);
      mirror += uOcSky * uOcD.z * 0.16 * smoothstep(0.16, 0.42, rl) * (0.4 + 0.6 * swell);
      mirror = mix(mirror, vec3(0.18, 0.135, 0.09) * (0.7 + 0.6 * swell), bloom * 0.55);   /* the bloom round the sun: the gaps lift, warm grey */
      vec3 surf = mix(mirror, gl, lit);
      /* the light's way through the water: red goes first (far glints turn cool), the far ceiling melts into the water's own colour */
      float q = max(t / h - 2.1, 0.0) * uOcA.w + max(h - 3.0, 0.0) * uOcB.w;
      vec3 ext = exp(-q * mix(vec3(1.9, 1.0, 0.86), vec3(1.0), wz));
      col = mix(base, surf, ext * smoothstep(0.012, 0.09, rd.y) * uOcK.x);   /* uOcK.x: the ceiling's presence (from s.ceil, set by dg-scene each frame) */
    }
    gl_FragColor = vec4(toSRGB(col), uOcOver);   /* uOcOver: 1 in the ground pass; the open-water veil's opacity in its second pass */
  }`;

/* ---- the screen pass: replaces raysAt's line (needs tNoise, uTime, uRayK from dg-scene's outMat). Colours here are sRGB-encoded sums. */
export const raysFS = /* glsl */`
  uniform vec4 uOcRay;
  vec3 ocRays(vec2 uv, float asp){
    vec2 hot = uOcRay.xy, o = vec2(hot.x + 0.035, 1.18);                 /* the fan's apex: just above the frame, over the hotspot — the shafts converge on it */
    float below = hot.y - uv.y;
    vec2 d = (uv - o) * vec2(asp, 1.0); float ang = atan(d.x, -d.y);
    /* several soft shafts of different widths: two noise reads at different scales, neither one leading, drifting slowly opposite ways */
    float w1 = texture2D(tNoise, vec2(ang * 0.8 + uTime * 0.0042, 0.21)).r, w2 = texture2D(tNoise, vec2(ang * 2.1 - uTime * 0.0075, 0.63)).r;
    float sh = smoothstep(0.38, 0.62, w1) * (0.3 + 0.95 * smoothstep(0.34, 0.7, w2)) + 0.4 * smoothstep(0.5, 0.74, w2) + 0.25 * smoothstep(0.2, 0.36, w1 * w2);
    sh = min(sh, 1.15);
    float m = smoothstep(0.0, 0.26, below) * exp(-max(0.46 - uv.y, 0.0) * 5.0) * exp(-pow((ang + 0.04) / 0.4, 2.0));
    vec3 warm = vec3(1.0, 0.87, 0.6), cool = vec3(${RAYCOOL.map(v => v.toFixed(3)).join(', ')});     /* warm-neutral at the top, cool blue lower down */
    vec3 c = mix(warm, cool, smoothstep(0.28, 0.78, below)) * sh * m * uOcRay.z;
    /* the hotspot's own soft warm glow (the light scattered on its way in): a tight core in a wide, faint halo */
    vec2 g = vec2(uv.x - hot.x, (uv.y - hot.y) / asp); float gd = dot(g, g);
    c += vec3(1.0, 0.92, 0.76) * uOcRay.w * (exp(-gd / 0.0025) * 1.3 + exp(-gd / 0.02) * 0.55);
    return c;
  }`;
