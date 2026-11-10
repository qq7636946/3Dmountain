import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const FORWARD_TRANSITION_DEFAULTS = {
  length: 1.12,
  blur: .48,
  dispersion: .0035,
  light: .11,
  fov: 12,
  zoom: 1.75
};

// Shared with the live tuner. Velocity is measured in journey-clock units / s.
export const CANYON_MOTION_DEFAULTS = {
  blur: .26,
  sensitivity: 1.15,
  response: 12,
  decay: 8,
  dispersion: .0008
};

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };

// The composited world is sampled before bloom; HTML remains perfectly sharp.
export function createForwardTransition({ config, flowConfig = CANYON_MOTION_DEFAULTS, lite = false }) {
  const pass = new ShaderPass({
    defines: { FLIGHT_SAMPLES: lite ? 10 : 16 },
    uniforms: {
      tDiffuse: { value: null },
      uFocus: { value: new THREE.Vector2(.5, .5) },
      uStrength: { value: 0 },
      uDispersion: { value: 0 },
      uLight: { value: 0 },
      uAspect: { value: 1 }
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `precision highp float;
      uniform sampler2D tDiffuse;
      uniform vec2 uFocus;
      uniform float uStrength, uDispersion, uLight, uAspect;
      varying vec2 vUv;
      vec2 safeUV(vec2 p) { return clamp(p, vec2(.001), vec2(.999)); }
      void main() {
        vec2 ray = vUv - uFocus;
        float radius = length(ray * vec2(uAspect, 1.));
        float edge = smoothstep(.025, .72, radius);
        vec2 travel = ray * uStrength * (.28 + .72 * edge);
        vec3 color = vec3(0.);
        float total = 0.;
        for (int i = 0; i < FLIGHT_SAMPLES; i++) {
          float t = float(i) / float(FLIGHT_SAMPLES - 1);
          float weight = 1. - .65 * t;
          color += texture2D(tDiffuse, safeUV(vUv - travel * t)).rgb * weight;
          total += weight;
        }
        color /= total;
        // Small spectral fringes follow the same optical axis as the motion.
        vec2 middle = vUv - travel * .35;
        vec2 split = ray * uDispersion * edge;
        vec3 base = texture2D(tDiffuse, safeUV(middle)).rgb;
        color.r += (texture2D(tDiffuse, safeUV(middle + split)).r - base.r) * .65;
        color.b += (texture2D(tDiffuse, safeUV(middle - split)).b - base.b) * .65;
        color *= 1. + uLight * (1. - .45 * edge);
        gl_FragColor = vec4(max(color, vec3(0.)), 1.);
      }`
  });
  pass.enabled = false;
  const state = {
    progress: 0, envelope: 0, strength: 0, direction: 1,
    transitionStrength: 0, flowStrength: 0, flowMovement: 0, flowDirection: 1
  };
  let movement = 0;
  let flowMovement = 0;
  function update({ progress, velocity = 0, centerX = .5, centerY = .5,
    mix = 0, aspect = 1, dt = 1 / 60, reducedMotion = false, enabled = true,
    flowAmount = 0, flowVelocity = 0, flowCenterX = .5, flowCenterY = .54 }) {
    const t = clamp(progress);
    const delta = THREE.MathUtils.clamp(dt, 0, .18);
    // Settles to a clear view when scrolling pauses; no independent timeline.
    const speed = smooth(Math.abs(velocity) / 1.15);
    movement += (speed - movement) * (1 - Math.exp(-delta * 12));
    const envelope = smooth((t - .06) / .44) * (1 - smooth((t - .70) / .29));
    if (Math.abs(velocity) > .015) state.direction = Math.sign(velocity);
    state.progress = t;
    state.envelope = envelope;
    const amplitude = enabled && !reducedMotion ? envelope * movement : 0;

    // Signed response passes through zero before reversing, instead of
    // snapping the optical streaks when scrolling changes direction.
    const flowTarget = Math.sign(flowVelocity) * smooth(Math.abs(flowVelocity) * flowConfig.sensitivity);
    const accelerating = Math.abs(flowTarget) > Math.abs(flowMovement) || flowTarget * flowMovement < 0;
    const response = Math.max(.01, accelerating ? flowConfig.response : flowConfig.decay);
    flowMovement += (flowTarget - flowMovement) * (1 - Math.exp(-delta * response));
    if (Math.abs(flowMovement) < .00001) flowMovement = 0;
    const flowAmplitude = enabled && !reducedMotion ? clamp(flowAmount) * flowMovement : 0;
    state.transitionStrength = amplitude * config.blur;
    state.flowStrength = Math.abs(flowAmplitude) * flowConfig.blur;
    state.flowMovement = Math.abs(flowMovement);
    if (Math.abs(flowMovement) > .0001) state.flowDirection = Math.sign(flowMovement);
    const signedStrength = state.transitionStrength * state.direction + flowAmplitude * flowConfig.blur;
    state.strength = Math.abs(signedStrength);

    const dispersion = amplitude * config.dispersion + Math.abs(flowAmplitude) * flowConfig.dispersion;
    pass.enabled = Math.max(state.strength, dispersion, amplitude * config.light) > .0002;
    const u = pass.uniforms;
    const blend = smooth(mix);
    const flowWeight = state.flowStrength / Math.max(.000001, state.transitionStrength + state.flowStrength);
    const flowX = THREE.MathUtils.clamp(flowCenterX, .15, .85);
    const flowY = THREE.MathUtils.clamp(flowCenterY, .15, .85);
    // Track the projected river vanishing point with the same shader as the
    // logo sweep, so entering the canyon adds no second postprocessing pass.
    u.uFocus.value.set(
      THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.clamp(centerX, .15, .85), flowX, blend), flowX, flowWeight),
      THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.clamp(centerY, .15, .85), flowY, blend), flowY, flowWeight));
    u.uStrength.value = signedStrength;
    u.uDispersion.value = dispersion;
    u.uLight.value = amplitude * config.light;
    u.uAspect.value = aspect;
  }
  return { pass, state, update, dispose: () => pass.dispose() };
}

/* ------------------------------------------------------------------------
   Depth-aware canyon motion (opt-in: only pages that call
   createCanyonDepthMotion / createCanyonSpeedMotes get it;
   createForwardTransition above is unchanged).

   The canyon is static and its camera is a pure function of scroll, so the
   motion of every pixel is exact once depth is known: the pixel's point is
   reconstructed from the scene depth, placed in front of the camera as it
   stood at shutter-open (position - velocity x shutter) and re-projected.
   Translation only: the path's slow yaw is left out on purpose, so parallax
   alone decides the streak -- the water under the lens smears hard, the
   boulders less, the far peaks and the sky stay sharp.
   ------------------------------------------------------------------------ */
export const CANYON_DEPTH_MOTION_DEFAULTS = {
  depthBlur: 1,          // master for the depth-aware streaks
  shutter: .012,         // seconds of camera travel folded into one frame
  maxStreak: 56,         // longest streak, px at a 1440-wide frame (scaled with it)
  wallBlur: .6,          // share of the streak kept by rock above the waterline
  specGain: 1.4,         // extra highlight streaks on the water
  specThreshold: 1.3,    // linear radiance above which a pixel counts as a glint
  specLength: 1.9,       // highlight streak length relative to the blur
  flowBoost: .55,        // extra sea clock per clock unit scrolled (river runs faster)
  motes: .7,             // spray / glint motes skimming past the lens
  moteTrail: .55,        // mote streak length relative to the shutter
  fovBreath: 2.2,        // degrees of FOV added at full speed
  pitch: .55,            // degrees the nose leans into forward travel
  chatter: .06,          // degrees of skim vibration at full speed
  speedRef: 380          // camera speed (units / s) that counts as full speed
};

const clampSigned = (x, m) => Math.max(-m, Math.min(m, x));

export function createCanyonDepthMotion({ config, lite = false }) {
  const C = () => ({ ...CANYON_DEPTH_MOTION_DEFAULTS, ...(config || {}) });
  const MAX_SAMPLES = lite ? 7 : 14;
  const SPEC_SAMPLES = lite ? 0 : 6;
  const pass = new ShaderPass({
    defines: { MAX_SAMPLES, SPEC_SAMPLES },
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      uInvProj: { value: new THREE.Matrix4() },
      uProj: { value: new THREE.Matrix4() },
      uViewToWorld: { value: new THREE.Matrix4() },
      uShift: { value: new THREE.Vector3() },
      uNearFar: { value: new THREE.Vector2(.1, 1000) },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMaxPx: { value: 48 },
      uWallBlur: { value: .6 },
      uSpec: { value: new THREE.Vector3(1.25, 0, 1.9) }
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `precision highp float;
      uniform sampler2D tDiffuse, tDepth;
      uniform mat4 uInvProj, uProj, uViewToWorld;
      uniform vec3 uShift, uSpec;
      uniform vec2 uNearFar, uResolution;
      uniform float uMaxPx, uWallBlur;
      varying vec2 vUv;
      float linearZ(float d) {
        float n = uNearFar.x, f = uNearFar.y;
        return (n * f) / (f - (f - n) * d);
      }
      vec3 viewPos(vec2 uv, float d) {
        vec4 p = uInvProj * vec4(uv * 2. - 1., d * 2. - 1., 1.);
        return p.xyz / p.w;
      }
      vec2 safeUV(vec2 p) { return clamp(p, vec2(.5) / uResolution, 1. - vec2(.5) / uResolution); }
      void main() {
        vec4 src = texture2D(tDiffuse, vUv);
        float d = texture2D(tDepth, vUv).x;
        if (d >= .99999) { gl_FragColor = src; return; }
        vec3 vp = viewPos(vUv, d);
        // Where this point sat when the shutter opened.
        vec3 q = vp + uShift;
        q.z = min(q.z, -uNearFar.x * 1.5);
        vec4 c = uProj * vec4(q, 1.);
        vec2 m = vUv - (c.xy / c.w * .5 + .5);
        // Rock above the waterline keeps a share of its edge: the eye should
        // feel the water rushing, not lose the canyon walls.
        float wy = (uViewToWorld * vec4(vp, 1.)).y;
        m *= mix(1., uWallBlur, smoothstep(1.2, 8., wy));
        float len = length(m * uResolution);
        if (len > uMaxPx) { m *= uMaxPx / len; len = uMaxPx; }
        if (len < .75) { gl_FragColor = src; return; }
        float zc = -vp.z;
        // Interleaved-gradient jitter trades the banding of few taps for fine grain.
        float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) - .5;
        int n = int(clamp(ceil(len / 2.5), 2., float(MAX_SAMPLES)));
        vec3 acc = src.rgb;
        float wsum = 1.;
        for (int i = 0; i < MAX_SAMPLES; i++) {
          if (i >= n) break;
          float t = (float(i) + .5 + jitter) / float(n) - .5;
          vec2 suv = safeUV(vUv + m * t);
          float sd = textureLod(tDepth, suv, 0.).x;
          float zs = sd >= .99999 ? 1e6 : linearZ(sd);
          // Farther scenery only bleeds in where its own (shorter) streak reaches.
          float reach = len * zc / zs;
          float w = zs <= zc * 1.08 ? 1. : clamp(reach / (abs(t) * len + 1.), 0., 1.);
          acc += textureLod(tDiffuse, suv, 0.).rgb * w;
          wsum += w;
        }
        vec3 color = acc / wsum;
      #if SPEC_SAMPLES > 0
        if (uSpec.y > 0.) {
          // Glints on the water are drawn out further along the travel than
          // the surface they ride on: the eye reads them as speed, not blur.
          float water = 1. - smoothstep(.45, 1.6, wy);
          if (water > 0.) {
            vec3 hi = vec3(0.);
            for (int i = 0; i < SPEC_SAMPLES; i++) {
              float t = (float(i) + .5 + jitter) / float(SPEC_SAMPLES) - .5;
              vec3 s = textureLod(tDiffuse, safeUV(vUv + m * t * uSpec.z), 0.).rgb;
              hi += max(s - uSpec.x, 0.);
            }
            float fade = smoothstep(1.5, 10., len);
            color += hi / float(SPEC_SAMPLES) * uSpec.y * water * fade;
          }
        }
      #endif
        gl_FragColor = vec4(color, src.a);
      }`
  });
  pass.enabled = false;
  const state = { speed: 0, envelope: 0, lean: 0, shift: 0, maxPx: 0, active: false };
  const velocity = new THREE.Vector3();
  const smoothVelocity = new THREE.Vector3();
  const lastPosition = new THREE.Vector3();
  const shiftWorld = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const size = new THREE.Vector2();
  let hasLast = false;
  let depthTexture = null;

  function setDepth(texture) { depthTexture = texture || null; }

  /* camera: canyon.camera straight after canyon.update() (before any
     display-only lean); amount: 0..1 first-person gate. */
  function measure({ camera, amount = 0, dt = 1 / 60, reducedMotion = false }) {
    const cfg = C();
    const delta = THREE.MathUtils.clamp(dt, 0, .18);
    const position = camera.position;
    if (hasLast && delta > 1e-5) {
      velocity.copy(position).sub(lastPosition).divideScalar(delta);
      // A jump (navigation, a stop click) is not travel.
      if (position.distanceTo(lastPosition) > 60) velocity.set(0, 0, 0);
    } else velocity.set(0, 0, 0);
    lastPosition.copy(position); hasLast = true;
    const gate = reducedMotion ? 0 : clamp(amount);
    velocity.multiplyScalar(gate);
    const accelerating = velocity.lengthSq() > smoothVelocity.lengthSq();
    const response = Math.max(.01, accelerating ? (cfg.response ?? 12) : (cfg.decay ?? 8));
    smoothVelocity.lerp(velocity, 1 - Math.exp(-delta * response));
    if (smoothVelocity.lengthSq() < 1e-4) smoothVelocity.set(0, 0, 0);
    const speed = smoothVelocity.length() * (cfg.sensitivity ?? 1.15) / 1.15;
    state.speed = speed;
    state.envelope = smooth(speed / Math.max(1, cfg.speedRef)) * THREE.MathUtils.smoothstep(speed, 2, 10);
    camera.getWorldDirection(forward);
    state.lean = speed > 1e-4 ? clampSigned(smoothVelocity.dot(forward) / Math.max(1, cfg.speedRef), 1) : 0;
    // Shutter-open camera = position - v * shutter: the scene sits that much ahead of it.
    // The soft knee lands the last creep of the scroll follower on an exactly
    // sharp frame instead of an endless sub-pixel smear.
    const knee = THREE.MathUtils.smoothstep(speed, 2, 10);
    shiftWorld.copy(smoothVelocity).multiplyScalar(knee * cfg.shutter * cfg.depthBlur * (cfg.sensitivity ?? 1.15) / 1.15);
    if (shiftWorld.length() > 8) shiftWorld.setLength(8);
    state.shift = shiftWorld.length();
    return state;
  }

  /* Called with the final (display) camera, right before the frame renders. */
  function apply({ camera, renderer }) {
    const cfg = C();
    state.active = !!depthTexture && state.shift > 1e-3 && cfg.depthBlur > 0;
    pass.enabled = state.active;
    if (!state.active) return state;
    renderer.getDrawingBufferSize(size);
    const ratio = renderer.getPixelRatio();
    state.maxPx = cfg.maxStreak * Math.max(.45, size.x / ratio / 1440) * ratio;
    camera.updateMatrixWorld();
    const u = pass.uniforms;
    u.tDepth.value = depthTexture;
    u.uProj.value.copy(camera.projectionMatrix);
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uViewToWorld.value.copy(camera.matrixWorld);
    u.uShift.value.copy(shiftWorld).transformDirection(camera.matrixWorldInverse).multiplyScalar(state.shift);
    u.uNearFar.value.set(camera.near, camera.far);
    u.uResolution.value.copy(size);
    u.uMaxPx.value = state.maxPx;
    u.uWallBlur.value = cfg.wallBlur;
    u.uSpec.value.set(cfg.specThreshold, lite ? 0 : cfg.specGain * state.envelope, cfg.specLength);
    return state;
  }
  /* Compile the program at load, never on the first scrolled frame. */
  function warm(renderer) {
    // Same kind of target as the composer's, so the program key matches.
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    const previous = renderer.getRenderTarget();
    try { renderer.setRenderTarget(target); pass.fsQuad.render(renderer); }
    finally { renderer.setRenderTarget(previous); target.dispose(); }
  }
  /* Things that are already drawn as streaks (the motes) go on after the
     blur, so they are not smeared a second time. */
  let overlay = null;
  function setOverlay(fn) { overlay = fn || null; }
  const renderBlur = pass.render.bind(pass);
  pass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
    renderBlur(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    if (!overlay) return;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(pass.renderToScreen ? null : writeBuffer);
    try { overlay(renderer, pass.uniforms.tDepth.value); } finally { renderer.autoClear = autoClear; }
  };
  function reset() { hasLast = false; smoothVelocity.set(0, 0, 0); shiftWorld.set(0, 0, 0); state.shift = 0; state.envelope = 0; state.lean = 0; }
  return { pass, state, measure, apply, setDepth, setOverlay, warm, reset, shiftWorld, dispose: () => pass.dispose() };
}

/* Spray and glint motes skimming the water just ahead of the lens. They sit
   at fixed arc positions along the river (a wrapped band that travels with
   the camera's arc), so they are a pure function of scroll: they stream past
   going forward, stream back going backward and stop when you stop. Each is
   drawn as a streak from where it was at shutter-open to where it is now,
   with the same shutter as the depth blur, and fades out when still.
   Blended over, not added: the canyon water is already near white, so fine
   spray reads as a cool grey filament on the bright sheet and a pale one
   against rock -- the way real spray reads against a mirror. */
export function createCanyonSpeedMotes({ curve, widthAt, lite = false }) {
  const count = lite ? 48 : 120;
  const span = 64, behind = 6;
  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute('corner', new THREE.Float32BufferAttribute([-1, 0, 1, 0, 1, 1, -1, 1], 2));
  quad.setAttribute('position', new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const positions = new Float32Array(count * 4);
  const seeds = [];
  let r = 1234567;
  const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    const h = rand();
    seeds.push({ along: rand() * span, lateral: (rand() * 2 - 1) * .5, height: .12 + 1.7 * h * h * h, size: .55 + rand() * .9 });
  }
  const aPos = new THREE.InstancedBufferAttribute(positions, 4);
  aPos.setUsage(THREE.DynamicDrawUsage);
  quad.setAttribute('aPos', aPos);
  quad.instanceCount = count;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uShift: { value: new THREE.Vector3() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uOpacity: { value: 0 },
      uWidth: { value: 1.7 },
      uTrail: { value: .55 },
      uColor: { value: new THREE.Color(.62, .72, .86) },
      tDepth: { value: null },
      uNearFar: { value: new THREE.Vector2(.1, 1000) }
    },
    vertexShader: `attribute vec2 corner; attribute vec4 aPos;
      uniform vec3 uShift; uniform vec2 uResolution; uniform float uOpacity, uWidth, uTrail;
      varying float vAlpha, vDepth; varying vec2 vCorner;
      void main() {
        vec4 c1 = projectionMatrix * viewMatrix * vec4(aPos.xyz, 1.);
        vec4 c0 = projectionMatrix * viewMatrix * vec4(aPos.xyz + uShift * uTrail, 1.);
        vCorner = corner; vAlpha = 0.; vDepth = c1.w;
        if (c1.w < .6 || c0.w < .6 || uOpacity <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
        vec2 halfRes = .5 * uResolution;
        vec2 s1 = c1.xy / c1.w * halfRes, s0 = c0.xy / c0.w * halfRes;
        vec2 d = s1 - s0; float L = length(d);
        float cap = uResolution.y * .3;
        if (L > cap) { d *= cap / L; s0 = s1 - d; L = cap; }
        vec2 dir = L > .001 ? d / L : vec2(0., 1.);
        float w = uWidth * aPos.w * clamp(8. / c1.w, .6, 3.) * uResolution.y / 900.;
        vec2 nrm = vec2(dir.y, -dir.x); // keeps the quad counter-clockwise
        vec2 p = mix(s0, s1, corner.y) + nrm * corner.x * w + dir * (corner.y * 2. - 1.) * w;
        gl_Position = vec4(p / halfRes * c1.w, c1.z, c1.w);
        float nearFade = smoothstep(.8, 2.4, c1.w), farFade = 1. - smoothstep(34., 58., c1.w);
        vAlpha = uOpacity * nearFade * farFade * clamp(14. * w / (L + 2. * w), .55, 1.);
      }`,
    fragmentShader: `uniform vec3 uColor; uniform sampler2D tDepth; uniform vec2 uResolution, uNearFar;
      varying float vAlpha, vDepth; varying vec2 vCorner;
      void main() {
        // Drawn after the blur, so the scene depth does the occlusion by hand.
        float d = texture2D(tDepth, gl_FragCoord.xy / uResolution).x;
        float sceneZ = d >= .99999 ? 1e6 : (uNearFar.x * uNearFar.y) / (uNearFar.y - (uNearFar.y - uNearFar.x) * d);
        float across = 1. - vCorner.x * vCorner.x;
        float a = vAlpha * across * across * mix(.12, 1., vCorner.y * vCorner.y)
          * (1. - smoothstep(-.2, .6, vDepth - sceneZ));
        if (a < .002) discard;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    side: THREE.DoubleSide,
    premultipliedAlpha: true
  });
  const mesh = new THREE.Mesh(quad, material);
  mesh.name = 'canyon-speed-motes';
  mesh.frustumCulled = false;
  mesh.renderOrder = 30;
  mesh.visible = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const pathLength = curve.getLength();
  const point = new THREE.Vector3(), tangent = new THREE.Vector3();
  /* arc: the camera's position along the curve (0..1 of its length). */
  function update({ arc, shiftWorld, envelope = 0, amount = 1, gain = 1, trail = .55, renderer, reducedMotion = false }) {
    const opacity = reducedMotion ? 0 : clamp(amount) * envelope * gain;
    material.uniforms.uOpacity.value = opacity;
    mesh.visible = opacity > .002;
    if (!mesh.visible) return;
    const s = arc * pathLength;
    for (let i = 0; i < count; i++) {
      const seed = seeds[i];
      const a = ((seed.along - s) % span + span) % span - behind;
      const u = Math.min(1, Math.max(0, (s + a) / pathLength));
      curve.getPointAt(u, point);
      curve.getTangentAt(u, tangent);
      const hl = Math.hypot(tangent.x, tangent.z) || 1;
      const side = widthAt(u) * seed.lateral;
      positions[i * 4] = point.x - tangent.z / hl * side;
      positions[i * 4 + 1] = seed.height;
      positions[i * 4 + 2] = point.z + tangent.x / hl * side;
      positions[i * 4 + 3] = seed.size;
    }
    aPos.needsUpdate = true;
    material.uniforms.uShift.value.copy(shiftWorld);
    material.uniforms.uTrail.value = trail;
    renderer.getDrawingBufferSize(material.uniforms.uResolution.value);
  }
  /* Overlay for createCanyonDepthMotion().setOverlay(). */
  function render(renderer, camera, depthTexture) {
    if (!mesh.visible || !depthTexture) return;
    material.uniforms.tDepth.value = depthTexture;
    material.uniforms.uNearFar.value.set(camera.near, camera.far);
    renderer.render(scene, camera);
  }
  function warm(renderer, camera) {
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    const previous = renderer.getRenderTarget();
    mesh.visible = true;
    try { renderer.setRenderTarget(target); renderer.compile(scene, camera); }
    finally { mesh.visible = false; renderer.setRenderTarget(previous); target.dispose(); }
  }
  return { mesh, scene, update, render, warm, count, dispose: () => { quad.dispose(); material.dispose(); } };
}
