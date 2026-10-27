/**
 * Isolated A-study: water, not chrome, frosted glass, or tinted jelly.
 * Three.js r170. No production scene, camera, timeline, or asset is changed.
 *
 * Coordinates: a 2.6-unit-high letter stands at y=0, centred at x/z=0.
 * Thickness is a world-unit approximation of the measured 0.641-unit model depth.
 * This is Three.js screen-space transmission, not a path-traced caustics solver.
 */
export function createLiquidStudio(THREE, renderer, scene, { lite = false } = {}) {
  const oldEnvironment = scene.environment;
  const oldEnvironmentIntensity = scene.environmentIntensity;
  let disposed = false;
  const group = new THREE.Group();
  group.name = 'Liquid A — fixed studio illumination';
  scene.add(group);

  // A few discrete luminous panels, plus dark flags. Unlike a banded
  // equirectangular image, these do not create a stripe around every azimuth.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color().setRGB(0.012, 0.018, 0.023);
  const geometries = new Set();
  const materials = new Set();
  const target = new THREE.Vector3(0, 1.3, 0);
  const quad = new THREE.PlaneGeometry(1, 1);
  geometries.add(quad);

  function panel(name, position, size, rgb) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(...rgb),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    materials.add(mat);
    const mesh = new THREE.Mesh(quad, mat);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(size[0], size[1], 1);
    mesh.lookAt(target);
    studio.add(mesh);
    return mesh;
  }

  // Asymmetric widths give a broad silver shoulder on one side and a clean
  // fine cyan-white contour on the other. HDR values remain linear.
  panel('large key softbox', [-4.1, 4.6, 3.4], [2.5, 5.0], [13.0, 13.5, 14.0]);
  panel('narrow cool rim strip', [4.0, 2.2, -0.9], [0.72, 4.8], [8.0, 10.3, 12.0]);
  panel('front contour strip', [3.8, 2.5, 4.7], [0.9, 5.2], [8.5, 9.4, 10.0]);
  panel('ceiling diffuser', [0.5, 6.0, 0.0], [4.6, 2.2], [4.0, 4.3, 4.6]);
  panel('low rear bounce', [-1.0, 0.3, -5.0], [4.2, 1.0], [0.85, 1.0, 1.1]);
  panel('left negative fill', [-4.5, 1.5, 0.0], [2.1, 5.5], [0.003, 0.005, 0.008]);
  panel('front negative fill', [0.4, 1.6, 4.7], [2.4, 4.8], [0.004, 0.006, 0.009]);
  panel('rear negative fill', [1.5, 1.7, -5.2], [2.0, 4.5], [0.006, 0.009, 0.013]);
  panel('lower negative fill', [0.0, -3.0, 0.0], [10.0, 10.0], [0.025, 0.032, 0.039]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let environmentTarget;
  try {
    // PMREM fromScene captures an actual arrangement of flat luminous cards.
    // It is generated once, never every frame. Sigma is small enough that
    // reflections retain the large/narrow panel distinction.
    environmentTarget = pmrem.fromScene(studio, 0.012, 0.1, 60);
  } finally {
    pmrem.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const mat of materials) mat.dispose();
    studio.clear();
  }
  environmentTarget.texture.name = 'Liquid A — discrete softbox PMREM';
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 1;

  // These lights illuminate the integration engineer's matte floor/backdrop.
  // The large reflected panels themselves are supplied by the PMREM above.
  const key = new THREE.DirectionalLight('#ffffff', 2.15);
  key.name = 'fixed neutral key';
  key.position.set(-3.6, 5.4, 4.0);
  key.target.position.copy(target);
  const fill = new THREE.HemisphereLight('#dceaf0', '#777b80', 0.55);
  fill.name = 'subtle neutral studio fill';
  const rim = new THREE.DirectionalLight('#c7e8f4', 0.65);
  rim.name = 'pale cyan rear rim';
  rim.position.set(3.5, 2.8, -3.0);
  rim.target.position.copy(target);
  group.add(key, key.target, fill, rim, rim.target);

  const params = {
    ior: 1.333,
    roughness: 0.025,
    thickness: 0.64,
    rippleStrength: lite ? 0.0022 : 0.0035,
    rippleSpeed: 0.16,
  };
  const uniforms = {
    uLiquidStudioTime: { value: 0 },
    uLiquidStudioRipple: { value: params.rippleStrength },
  };
  const material = new THREE.MeshPhysicalMaterial({
    name: 'Clear water — IOR 1.333',
    color: '#ffffff',
    metalness: 0,
    roughness: params.roughness,
    transmission: 1,
    thickness: params.thickness,
    ior: params.ior,
    attenuationColor: new THREE.Color('#e9f7fc'),
    attenuationDistance: 18,
    specularIntensity: 1,
    specularColor: new THREE.Color('#ffffff'),
    envMapIntensity: 1,
    clearcoat: 0,
    sheen: 0,
    dispersion: 0,
    opacity: 1,
    transparent: false,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  material.userData.liquidStudy = {
    opticalModel: 'Three.js physical screen-space transmission',
    intendedHeight: 2.6,
    intendedDepth: 0.64,
    notes: 'No added rim emission, white sweep, bloom, or artificial caustic flecks.',
    uniforms,
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `
      uniform float uLiquidStudioTime;
      uniform float uLiquidStudioRipple;
    ` + shader.vertexShader.replace('#include <beginnormal_vertex>', `
      #include <beginnormal_vertex>
      // Small analytic height-gradient perturbation in object space. Project
      // it onto the surface tangent plane so the base normal remains valid.
      // Geometry/outline/holes and the shader's standard normal transform are
      // untouched. Low-frequency nonparallel waves avoid zebra corrugations.
      float liquidT = uLiquidStudioTime;
      vec3 liquidK1 = vec3(3.4, 4.7, 2.1);
      vec3 liquidK2 = vec3(-5.1, 2.8, 4.2);
      vec3 liquidK3 = vec3(7.7, -3.6, 2.4);
      vec3 liquidGradient =
          liquidK1 * cos(dot(position, liquidK1) + liquidT) * 0.55
        + liquidK2 * cos(dot(position, liquidK2) - liquidT * 0.71) * 0.29
        + liquidK3 * cos(dot(position, liquidK3) + liquidT * 0.43) * 0.16;
      vec3 liquidBaseNormal = normalize(objectNormal);
      vec3 liquidTangentGradient = liquidGradient
        - liquidBaseNormal * dot(liquidBaseNormal, liquidGradient);
      objectNormal = normalize(liquidBaseNormal
        - liquidTangentGradient * uLiquidStudioRipple);
    `);
  };
  material.customProgramCacheKey = () => 'liquid-A-studio-water-r170-v2';

  function update(time = 0) {
    if (disposed) return;
    uniforms.uLiquidStudioTime.value = Number.isFinite(time) ? time * params.rippleSpeed : 0;
    uniforms.uLiquidStudioRipple.value = Math.max(0, Math.min(0.012, params.rippleStrength));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    key.dispose();
    fill.dispose();
    rim.dispose();
    material.dispose();
    if (scene.environment === environmentTarget.texture) {
      scene.environment = oldEnvironment;
      scene.environmentIntensity = oldEnvironmentIntensity;
    }
    environmentTarget.dispose();
    group.clear();
  }

  return {
    material, group, params, update, dispose,
    environment: environmentTarget.texture,
    notes: {
      caustics: 'Not simulated; no baked glow is presented as a physical caustic.',
      transmission: 'Screen-space refraction cannot capture arbitrary off-screen or nested transparent objects.',
      scale: 'Material thickness 0.64 approximates measured depth 0.641; mesh is in 2.6-height world units without additional scale.',
    },
  };
}
