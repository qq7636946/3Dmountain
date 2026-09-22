export const LOGO_PARTICLE_DEFAULTS = Object.freeze({
  enabled: 1,
  radius: 0.72,
  height: 1.72,
  turns: 2.15,
  spread: 0.085,
  size: 5.8,
  large: 12.4,
  opacity: 1.08,
  travel: 0.92,
  rise: 0.78,
  fadeAt: 0.88,
  phase: 18,
  tiltX: -7,
  tiltZ: -5,
  glow: 0.78,
  twinkle: 0.16,
  mobileAmount: 0.66,
  color: '#416b91',
  core: '#f4f9ff'
});

const PARTICLE_COUNT = 1500;
const BAND_COUNT = 5;

function fract(value) {
  return value - Math.floor(value);
}

function hash(index, salt) {
  return fract(Math.sin((index + 1) * (12.9898 + salt * 17.371)) * 43758.5453123);
}

export function createLogoParticleHelix(THREE, { renderer, config = {} } = {}) {
  const supplied = { ...config };
  Object.assign(config, LOGO_PARTICLE_DEFAULTS, supplied);
  const settings = config;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const seeds = new Float32Array(PARTICLE_COUNT * 4);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const tones = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const band = i % BAND_COUNT;
    const laneIndex = Math.floor(i / BAND_COUNT);
    const laneCount = Math.ceil(PARTICLE_COUNT / BAND_COUNT);
    const along = Math.min(0.9999, (laneIndex + hash(i, 0.37) * 0.8) / laneCount);
    const bandPhase = (band / BAND_COUNT - 0.5) * 0.34;
    const radial = hash(i, 1.13) * 2 - 1;
    const drift = hash(i, 2.71) * 2 - 1;
    const rare = hash(i, 4.19);

    seeds[i * 4] = along;
    seeds[i * 4 + 1] = bandPhase;
    seeds[i * 4 + 2] = radial;
    seeds[i * 4 + 3] = drift;
    sizes[i] = rare > 0.94 ? 1 : Math.pow(hash(i, 5.83), 2.15);
    tones[i] = hash(i, 7.21);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aTone', new THREE.BufferAttribute(tones, 1));
  geometry.setDrawRange(0, PARTICLE_COUNT);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3.5);

  const uniforms = {
    uProgress: { value: 0 },
    uVisibility: { value: 0 },
    uTime: { value: 0 },
    uRadius: { value: settings.radius },
    uHeight: { value: settings.height },
    uTurns: { value: settings.turns },
    uSpread: { value: settings.spread },
    uBaseSize: { value: settings.size },
    uLargeSize: { value: settings.large },
    uTravel: { value: settings.travel },
    uRise: { value: settings.rise },
    uPhase: { value: THREE.MathUtils.degToRad(settings.phase) },
    uGlow: { value: settings.glow },
    uTwinkle: { value: settings.twinkle },
    uPixelRatio: { value: Math.min(2, renderer?.getPixelRatio?.() || 1) },
    uColor: { value: new THREE.Color(settings.color) },
    uCore: { value: new THREE.Color(settings.core) }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      attribute float aSize;
      attribute float aTone;
      uniform float uProgress;
      uniform float uVisibility;
      uniform float uTime;
      uniform float uRadius;
      uniform float uHeight;
      uniform float uTurns;
      uniform float uSpread;
      uniform float uBaseSize;
      uniform float uLargeSize;
      uniform float uTravel;
      uniform float uRise;
      uniform float uPhase;
      uniform float uTwinkle;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vTone;
      varying float vSizeMix;

      float ease(float x) {
        x = clamp(x, 0.0, 1.0);
        return x * x * (3.0 - 2.0 * x);
      }

      void main() {
        float along = aSeed.x;
        float riseHead = clamp(uProgress / max(0.08, uRise), 0.0, 1.0);
        float formed = ease((riseHead - along + 0.075) / 0.15);
        float tau = 6.28318530718;
        float theta = uPhase + along * uTurns * tau + aSeed.y;
        theta -= uProgress * uTravel * tau;
        theta += sin(along * 17.0 + aSeed.w * 4.0) * 0.025;

        float radius = uRadius + aSeed.z * uSpread;
        radius += sin(along * 29.0 + aSeed.w * 7.0) * uSpread * 0.18;
        float finalY = (along - 0.5) * uHeight + aSeed.w * uSpread * 0.28;
        float gatherY = -uHeight * 0.59 - (1.0 - formed) * (0.18 + abs(aSeed.w) * 0.16);
        float gatherR = mix(0.18, radius, formed);

        vec3 transformed = vec3(
          cos(theta) * gatherR,
          mix(gatherY, finalY, formed),
          sin(theta) * gatherR
        );

        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        float perspective = clamp(12.0 / max(1.0, -mvPosition.z), 0.72, 1.55);
        float sizeMix = smoothstep(0.86, 1.0, aSize);
        float pointSize = mix(uBaseSize, uLargeSize, sizeMix) * uPixelRatio * perspective;
        gl_PointSize = max(1.0, pointSize);
        gl_Position = projectionMatrix * mvPosition;

        float leadingSoftness = 1.0 - smoothstep(riseHead + 0.02, riseHead + 0.17, along);
        float twinkle = 1.0 + sin(uTime * 1.8 + along * 41.0 + aSeed.w * 9.0) * uTwinkle;
        vAlpha = formed * leadingSoftness * uVisibility * twinkle;
        vTone = aTone;
        vSizeMix = sizeMix;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform vec3 uCore;
      uniform float uGlow;
      varying float vAlpha;
      varying float vTone;
      varying float vSizeMix;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float dist = length(centered) * 2.0;
        float softDisc = 1.0 - smoothstep(0.22, 1.0, dist);
        float pinCore = 1.0 - smoothstep(0.0, 0.26, dist);
        float halo = (1.0 - smoothstep(0.0, 1.0, dist)) * uGlow;
        float alpha = (softDisc * 0.72 + pinCore * 0.58 + halo * 0.28) * vAlpha;
        alpha *= mix(0.84, 1.18, vSizeMix);
        if (alpha < 0.005) discard;

        vec3 cool = mix(uColor, uCore, 0.18 + vTone * 0.30);
        vec3 color = mix(cool, uCore, clamp(pinCore * 0.74 + vSizeMix * 0.48, 0.0, 1.0));
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'Logo particle helix';
  points.frustumCulled = false;
  points.renderOrder = 7;

  const group = new THREE.Group();
  group.name = 'Logo particle helix root';
  group.add(points);
  group.visible = false;

  function update({ progress = 0, visibility = 0, time = 0, reducedMotion = false, mobile = false, pixelRatio } = {}) {
    const enabled = Number(settings.enabled) > 0.5;
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const fadeStart = THREE.MathUtils.clamp(Number(settings.fadeAt) || 0.88, 0.6, 0.99);
    const exit = THREE.MathUtils.smoothstep(p, fadeStart, 1);
    const alpha = Math.max(0, visibility) * (1 - exit) * (Number(settings.opacity) || 0);
    group.visible = enabled && alpha > 0.001;
    if (!group.visible) return;

    group.rotation.x = THREE.MathUtils.degToRad(Number(settings.tiltX) || 0);
    group.rotation.z = THREE.MathUtils.degToRad(Number(settings.tiltZ) || 0);
    uniforms.uProgress.value = p;
    uniforms.uVisibility.value = alpha;
    uniforms.uTime.value = reducedMotion ? 0 : time;
    uniforms.uRadius.value = Number(settings.radius) || 0;
    uniforms.uHeight.value = Number(settings.height) || 0;
    uniforms.uTurns.value = Number(settings.turns) || 0;
    uniforms.uSpread.value = Number(settings.spread) || 0;
    uniforms.uBaseSize.value = Number(settings.size) || 1;
    uniforms.uLargeSize.value = Number(settings.large) || uniforms.uBaseSize.value;
    uniforms.uTravel.value = (Number(settings.travel) || 0) * (reducedMotion ? 0.45 : 1);
    uniforms.uRise.value = Math.max(0.08, Number(settings.rise) || 0.78);
    uniforms.uPhase.value = THREE.MathUtils.degToRad(Number(settings.phase) || 0);
    uniforms.uGlow.value = Number(settings.glow) || 0;
    uniforms.uTwinkle.value = reducedMotion ? 0 : Number(settings.twinkle) || 0;
    uniforms.uPixelRatio.value = Math.min(2, pixelRatio || renderer?.getPixelRatio?.() || 1);
    uniforms.uColor.value.set(settings.color || LOGO_PARTICLE_DEFAULTS.color);
    uniforms.uCore.value.set(settings.core || LOGO_PARTICLE_DEFAULTS.core);
    const amount = mobile ? THREE.MathUtils.clamp(Number(settings.mobileAmount) || 0.66, 0.25, 1) : 1;
    geometry.setDrawRange(0, Math.floor(PARTICLE_COUNT * amount));
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { group, points, material, settings, update, dispose };
}
