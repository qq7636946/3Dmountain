/* lake-logo-video.js — SNAPSHOT (2026-11-24 ~13:50) of prototypes/valley-261124/lake-logo-video-261124.js; video path rewritten. Off by default. */
/* lake-logo-video-261124.js — Seamless 3D Optical Water-Sculpted Logo Video Compositor
   Isolated strictly to 261124.html (prototypes/valley-261124/).
   - Plays ../../media/logo.mp4 (1280x720 H.264 overhead water-vortex emblem) directly on the central alpine lake.
   - Uses a dual-ring local-contrast (DoG) optical water-relief filter immune to the footage's diagonal sun ramp:
       * Extracts deep sculpted 3D vortex shadow troughs -> graded to glacial sapphire-indigo
       * Extracts gleaming 360-degree foaming wave crests -> graded to sunlit ice-white with aerated glacial-teal shoulders
       * Dissolves calm flat background water to alpha=0 so our live 3D alpine lake flows right into the vortex (ZERO sticker border!)
   - Strictly masked inside the analytical stLakeBasinR lake contour so dry shore cliffs & rocks stay untouched.
   - Exposes full 3D perspective angle (yaw / tilt / roll / scale / stretchY / offset) and optical filter controls. */
import * as THREE from 'three';

const LAKE_CENTER = new THREE.Vector3(0.122, 0.105, -0.056);

export const DEFAULT_LAKE_LOGO_VIDEO = {
  enabled: false,
  yaw: 323.4,           /* degrees: aligns emblem upright with settled 323.44 deg camera azimuth */
  tilt: 0.0,            /* degrees: 0 = physically flush on lake surface; + tilts gently toward camera */
  roll: 0.0,            /* degrees: in-plane spin fine-tune */
  scale: 2.62,          /* world units diameter on central lake */
  stretchY: 1.38,       /* perspective foreshortening balance along camera sightline (63.8 deg tilt) */
  offsetX: 0.02,        /* world X offset from lake center */
  offsetZ: -0.04,       /* world Z offset from lake center (centered cleanly in widest basin) */
  height: 0.009,        /* slight lift above lake datum 0.105 to prevent z-fighting */
  opacity: 0.96,        /* overall optical integration opacity */
  filterStrength: 0.92, /* 0 = natural cool-graded footage, 1 = full alpine glacial water sculpture */
  contrast: 1.32,       /* sculptural depth of vortex shadow troughs & foam crests */
  brightness: 1.08,     /* overall tonal gain */
  glow: 0.42,           /* crisp sunlit specular lift on highest curling foam crests */
  feather: 0.36,        /* soft outer radial fade margin (keeps full top wave curl intact) */
  speed: 1.0,           /* video playback speed */
  tintDeep: '#041426',  /* deep vortex trough glacial navy */
  tintMid: '#124a61',   /* aerated glacial teal shoulder */
  tintFoam: '#e4f6ff',  /* sunlit crest foam ice-white */
  clipBeams: true,      /* gracefully stop the 4 river energy beams at the vortex outer rim */
  clipRadius: 0.68      /* world radius where river beams feed into the vortex */
};

const VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  precision highp float;

  uniform sampler2D tVideo;
  uniform float uTime;
  uniform float uReady;
  uniform float uArrival;
  uniform float uLattice;
  uniform float uVideoAspect;
  uniform float uOpacity;
  uniform float uFilterStrength;
  uniform float uContrast;
  uniform float uBrightness;
  uniform float uGlow;
  uniform float uFeather;
  uniform float uZoom;
  uniform vec2  uUvCenter;
  uniform vec3  uTintDeep;
  uniform vec3  uTintMid;
  uniform vec3  uTintFoam;
  uniform vec3  uSun;
  uniform float uSunIntensity;

  varying vec2 vUv;
  varying vec3 vWorld;

  float lvHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lvNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(lvHash(i), lvHash(i + vec2(1.0, 0.0)), f.x),
      mix(lvHash(i + vec2(0.0, 1.0)), lvHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  /* Exact same analytical central lake contour as terrain-pbr-261124.js (prevents bleed onto shore rocks!) */
  float lvLakeBasinR(vec2 p) {
    vec2 q = (p - vec2(0.122, -0.056)) / vec2(1.66, 1.42);
    float r = length(q);
    float ang = atan(q.y, q.x);
    float wobble = 0.085 * sin(ang * 3.0 + 0.7) + 0.055 * cos(ang * 5.0 - 1.2) + 0.035 * sin(ang * 7.0 + 2.4);
    float cove = (lvNoise(p * 1.45 + vec2(3.7, -2.1)) - 0.5) * 0.055;
    return r + wobble + cove;
  }

  float lvLuma(vec2 uv) {
    vec3 c = texture2D(tVideo, clamp(uv, vec2(0.002), vec2(0.998))).rgb;
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  void main() {
    if (uReady < 0.5 || uOpacity < 0.003 || uLattice > 0.35) discard;

    /* Early-out outside circular disc & outside central lake basin before any video taps */
    float r = length((vUv - 0.5) * 2.0);
    if (r > 1.0) discard;

    float lr = lvLakeBasinR(vWorld.xz);
    float lakeMask = 1.0 - smoothstep(0.76, 0.94, lr);
    if (lakeMask < 0.002) discard;

    /* Subtle animated micro-wave warp harmonizing video ripples with the live alpine lake */
    float n1 = lvNoise(vWorld.xz * 4.6 + vec2(uTime * 0.22, -uTime * 0.16)) - 0.5;
    float n2 = lvNoise(vWorld.xz * 9.2 - vec2(uTime * 0.18, uTime * 0.25)) - 0.5;
    vec2 waveWarp = vec2(n1, n2) * 0.0038 * smoothstep(0.15, 0.85, r);

    /* Aspect-corrected centered UV mapping (keeps full 360-deg emblem & top curl intact inside disc) */
    float invAsp = 1.0 / max(uVideoAspect, 0.5);
    vec2 centered = (vUv - 0.5) * uZoom;
    vec2 vidUv = vec2(uUvCenter.x + centered.x * invAsp, uUvCenter.y + centered.y) + waveWarp;
    if (vidUv.x < 0.002 || vidUv.x > 0.998 || vidUv.y < 0.002 || vidUv.y > 0.998) discard;

    vec3 rawRgb = texture2D(tVideo, vidUv).rgb;
    float vidLuma = dot(rawRgb, vec3(0.2126, 0.7152, 0.0722));
    float vidSat = max(rawRgb.r, max(rawRgb.g, rawRgb.b)) - min(rawRgb.r, min(rawRgb.g, rawRgb.b));

    /* Dual-ring pixel-isotropic local background estimation (100% immune to diagonal sun ramp & calm inner pool!) */
    vec2 r1 = vec2(0.042 * invAsp, 0.042);
    vec2 r2 = vec2(0.135 * invAsp, 0.135);

    /* 6-tap medium ripple ring */
    float midBg = (
      lvLuma(vidUv + vec2( r1.x,  0.0)) +
      lvLuma(vidUv + vec2(-r1.x,  0.0)) +
      lvLuma(vidUv + vec2( r1.x * 0.5,  r1.y * 0.866)) +
      lvLuma(vidUv + vec2(-r1.x * 0.5,  r1.y * 0.866)) +
      lvLuma(vidUv + vec2( r1.x * 0.5, -r1.y * 0.866)) +
      lvLuma(vidUv + vec2(-r1.x * 0.5, -r1.y * 0.866))
    ) * 0.166667;

    /* 8-tap wide sculptural ring (captures full width of the 3D carved vortex shadow wall!) */
    float wideBg = (
      lvLuma(vidUv + vec2( r2.x,  0.0)) +
      lvLuma(vidUv + vec2(-r2.x,  0.0)) +
      lvLuma(vidUv + vec2( 0.0,   r2.y)) +
      lvLuma(vidUv + vec2( 0.0,  -r2.y)) +
      lvLuma(vidUv + vec2( r2.x * 0.707,  r2.y * 0.707)) +
      lvLuma(vidUv + vec2(-r2.x * 0.707,  r2.y * 0.707)) +
      lvLuma(vidUv + vec2( r2.x * 0.707, -r2.y * 0.707)) +
      lvLuma(vidUv + vec2(-r2.x * 0.707, -r2.y * 0.707))
    ) * 0.125;

    float localBg = midBg * 0.35 + wideBg * 0.65;
    float relief = (vidLuma - localBg) * 2.55 * uContrast;
    float ripple = clamp((vidLuma - midBg) * 3.4 * uContrast, -0.45, 0.55);

    /* Balanced 360-degree crest foam + carved vortex trough shadow extraction */
    float foamLocal = smoothstep(0.010, 0.145, (vidLuma - localBg) * (0.78 + 0.22 * uContrast));
    float foamAbs = smoothstep(0.75, 0.94, vidLuma) * smoothstep(0.27, 0.09, vidSat) * smoothstep(-0.02, 0.12, vidLuma - wideBg);
    float crest = clamp(max(foamLocal * 0.96, foamAbs * 1.15), 0.0, 1.0);
    float shadow = smoothstep(0.04, 0.52, -relief);

    /* Alpine glacial water optical filter (linear RGB):
       deep sapphire vortex trough -> aerated glacial-teal ripple shoulders -> gleaming ice-white foam crests */
    vec3 filtered = mix(uTintMid * 0.42, uTintDeep, shadow * 0.90);
    float ripLit = clamp(ripple, 0.0, 1.0);
    filtered = mix(filtered, uTintMid * 1.45, ripLit * 0.68);
    filtered = mix(filtered, uTintFoam, crest * 0.92);

    /* Crisp sunlit specular sparkle & icy sheen on highest curling wave crests */
    float sunGain = clamp(uSunIntensity * 0.62, 0.55, 1.45);
    filtered += (uTintFoam * 0.88 + vec3(0.12, 0.22, 0.28)) * pow(crest, 1.85) * uGlow * sunGain;

    /* Natural cool-graded footage path for smooth uFilterStrength blending */
    vec3 vidLin = pow(max(rawRgb, vec3(0.0)), vec3(2.2));
    vec3 rawGraded = vidLin * vec3(0.18, 0.42, 0.54) * (0.72 + crest * 1.35) * (1.0 - shadow * 0.58);
    vec3 col = mix(rawGraded, filtered, clamp(uFilterStrength, 0.0, 1.0)) * uBrightness;

    /* Organic ripple-broken outer feather (keeps 100% of the top wave curl & bottom rim intact!) */
    float edgeWobble = (n1 * 0.055 + n2 * 0.028);
    float innerStop = clamp(0.97 - uFeather, 0.35, 0.86);
    float radMask = 1.0 - smoothstep(innerStop, 0.985, r + edgeWobble);

    /* Signal-driven optical alpha: ONLY sculpted wave troughs, aerated ripples & white crests appear
       while calm surrounding video water dissolves cleanly to 0 -> 100% ZERO circular sticker! */
    float signalMask = clamp(crest * 1.18 + shadow * 0.94 + abs(ripple) * 0.48, 0.0, 1.0);

    /* Respect opening arrival animation & monochrome-to-color handoff */
    float arriveA = smoothstep(0.22, 0.92, uArrival);
    float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(gray), col, smoothstep(0.12, 0.93, uArrival));

    float alpha = clamp(radMask * signalMask * lakeMask * uOpacity * arriveA, 0.0, 0.98);
    if (alpha < 0.004) discard;

    /* Gentle filmic rolloff preserving sparkling ice-white foam detail */
    col = col / (1.0 + col * 0.14);

    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

export function createLakeLogoVideo(atlas, studio, options = {}) {
  const cfg = { ...DEFAULT_LAKE_LOGO_VIDEO, ...(options.config || {}) };
  const videoUrl = new URL('../../../../media/logo.mp4', import.meta.url).href;

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = 'none';
  video.playbackRate = Math.max(0.05, +cfg.speed || 1.0);
  let srcAssigned = false;
  const ensureLoaded = () => {
    if (srcAssigned) return;
    srcAssigned = true;
    video.preload = 'auto';
    video.src = videoUrl;
    video.load();
  };

  const texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;

  const uniforms = {
    tVideo: { value: texture },
    uTime: atlas.uniforms.uTime,
    uReady: { value: 0.0 },
    uArrival: studio.uniforms.uArrival,
    uLattice: atlas.uniforms.uLattice || { value: 0.0 },
    uVideoAspect: { value: 1280 / 720 },
    uOpacity: { value: cfg.opacity },
    uFilterStrength: { value: cfg.filterStrength },
    uContrast: { value: cfg.contrast },
    uBrightness: { value: cfg.brightness },
    uGlow: { value: cfg.glow },
    uFeather: { value: cfg.feather },
    uZoom: { value: 1.04 },
    uUvCenter: { value: new THREE.Vector2(0.454, 0.502) },
    uTintDeep: { value: new THREE.Color(cfg.tintDeep) },
    uTintMid: { value: new THREE.Color(cfg.tintMid) },
    uTintFoam: { value: new THREE.Color(cfg.tintFoam) },
    uSun: atlas.uniforms.uSun,
    uSunIntensity: studio.uniforms.uSunIntensity
  };

  let ready = false;
  const markReady = () => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      uniforms.uVideoAspect.value = video.videoWidth / video.videoHeight;
      ready = true;
      uniforms.uReady.value = 1.0;
    }
  };
  const tryPlay = () => {
    if (!cfg.enabled) return;
    ensureLoaded();
    if (options.reducedMotion) return;
    if (video.paused) video.play().catch(() => {});
  };
  video.addEventListener('loadedmetadata', () => {
    markReady();
    if (options.reducedMotion) {
      try { video.currentTime = 1.6; } catch {}
    } else {
      tryPlay();
    }
  });
  video.addEventListener('loadeddata', () => { markReady(); tryPlay(); });
  video.addEventListener('canplay', () => { markReady(); tryPlay(); });
  const unlockPlay = () => { tryPlay(); };
  window.addEventListener('pointerdown', unlockPlay, { passive: true });
  window.addEventListener('keydown', unlockPlay, { passive: true });
  tryPlay();

  const geometry = new THREE.PlaneGeometry(1, 1, 20, 20);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  material.userData.handlesArrival = true;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Lake Logo Video Plane';
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;

  const pivot = new THREE.Group();
  pivot.name = 'Lake Logo Video Pivot';
  pivot.add(mesh);

  const group = new THREE.Group();
  group.name = 'Lake Logo Video Group';
  group.add(pivot);

  const center = atlas.lake?.center ? atlas.lake.center.clone() : LAKE_CENTER.clone();

  function apply() {
    const on = !!cfg.enabled;
    group.visible = on;

    const s = Math.max(0.4, +cfg.scale || 2.62);
    const sy = Math.max(0.5, +cfg.stretchY || 1.38);
    const tiltRad = THREE.MathUtils.degToRad(+cfg.tilt || 0);
    /* Auto-lift cleanly when tilted so the lower edge never dips below the lake water plane (0.105) */
    const tiltLift = 0.5 * s * sy * Math.abs(Math.sin(tiltRad));

    group.position.set(
      center.x + (+cfg.offsetX || 0),
      0.105 + Math.max(0.002, +cfg.height || 0.009) + tiltLift,
      center.z + (+cfg.offsetZ || 0)
    );
    group.rotation.set(0, THREE.MathUtils.degToRad(+cfg.yaw || 0), 0);
    pivot.rotation.set(-Math.PI * 0.5 + tiltRad, 0, THREE.MathUtils.degToRad(+cfg.roll || 0));
    mesh.scale.set(s, s * sy, 1);

    uniforms.uOpacity.value = THREE.MathUtils.clamp(+cfg.opacity || 0, 0, 1);
    uniforms.uFilterStrength.value = THREE.MathUtils.clamp(+cfg.filterStrength || 0, 0, 1);
    uniforms.uContrast.value = THREE.MathUtils.clamp(+cfg.contrast || 1, 0.3, 3.0);
    uniforms.uBrightness.value = THREE.MathUtils.clamp(+cfg.brightness || 1, 0.2, 2.5);
    uniforms.uGlow.value = THREE.MathUtils.clamp(+cfg.glow || 0, 0, 2.0);
    uniforms.uFeather.value = THREE.MathUtils.clamp(+cfg.feather || 0.36, 0.1, 0.92);
    uniforms.uTintDeep.value.set(cfg.tintDeep || '#041426');
    uniforms.uTintMid.value.set(cfg.tintMid || '#124a61');
    uniforms.uTintFoam.value.set(cfg.tintFoam || '#e4f6ff');

    const spd = THREE.MathUtils.clamp(+cfg.speed, 0, 2.5);
    if (on) ensureLoaded();
    if (on && !options.reducedMotion && spd > 0.01) {
      video.playbackRate = spd;
      if (video.paused) video.play().catch(() => {});
    } else if (!video.paused) {
      video.pause();
    }
  }

  /* Generate an elliptical XZ outline matching the outer vortex rim so river energy beams feed cleanly into it */
  function getBeamOutline() {
    if (!cfg.enabled || !cfg.clipBeams) return [];
    const rx = Math.max(0.15, +cfg.clipRadius || 0.68);
    const rz = rx * Math.max(0.6, +cfg.stretchY || 1.38) * 0.90;
    const yaw = THREE.MathUtils.degToRad(+cfg.yaw || 0);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cx = center.x + (+cfg.offsetX || 0);
    const cz = center.z + (+cfg.offsetZ || 0);
    const ring = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const lx = Math.cos(a) * rx;
      const lz = Math.sin(a) * rz;
      const wx = cx + lx * cy + lz * sy;
      const wz = cz - lx * sy + lz * cy;
      ring.push([wx, wz]);
    }
    return [ring];
  }

  function update() {
    if (!ready && video.readyState >= 2) markReady();
    if (ready && cfg.enabled && !options.reducedMotion && (+cfg.speed || 0) > 0.01 && video.paused) {
      video.play().catch(() => {});
    }
    if (ready && video.readyState >= 2) texture.needsUpdate = true;
  }

  apply();

  return {
    config: cfg,
    group,
    mesh,
    video,
    texture,
    uniforms,
    apply,
    update,
    getBeamOutline,
    dispose() {
      window.removeEventListener('pointerdown', unlockPlay);
      window.removeEventListener('keydown', unlockPlay);
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch {}
      atlas.scene.remove(group);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    }
  };
}
