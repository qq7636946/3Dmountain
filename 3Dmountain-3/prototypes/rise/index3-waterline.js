import { waterlineGLSL } from '../drop-gorge/ocean/dg-ocean.js?v=19-sea2';
import { lensDrops, lensSplashGLSL } from '../drop-gorge/lens-splash.js';

const clamp01 = value => Math.max(0, Math.min(1, value));
const lerp = (a, b, weight) => a + (b - a) * weight;
export function smoothstep(start, end, value) {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

export function crossingHeight(progress, airHeight, joinHeight, joinTangent) {
  const t = clamp01(progress);
  const t2 = t * t;
  const t3 = t2 * t;
  // Match the existing descent's tangent at the joint and start at rest in air.
  const tangent = Math.max(3 * (joinHeight - airHeight), Math.min(0, joinTangent));
  return airHeight * (1 - 3 * t2 + 2 * t3) + joinHeight * (3 * t2 - 2 * t3)
    + tangent * (t3 - t2);
}

export function sampleWaterline(height) {
  const depth = -height;
  const immersion = smoothstep(-0.8, 1.2, depth);
  return {
    height, immersion,
    proximity: smoothstep(-0.72, -0.14, depth) * (1 - smoothstep(0.19, 0.72, depth)),
    oceanOpacity: smoothstep(-0.86, -0.53, depth),
    blend: smoothstep(-0.54, 0.70, depth),
    fullyUnder: depth >= 0.86,
    ceilingLook: smoothstep(-0.36, 0.9, depth)
  };
}

export function advanceAtHeight(height) {
  return 1.5 * smoothstep(-0.46, 4.4, -height);
}

export function underwaterPitch(depth) {
  return lerp(0.32, 0.18, smoothstep(3.9, 11.0, depth));
}

// Intersect each row of the actual canyon banks with the river. The underwater
// walls are authored in metres, facing the horizontal heading of the entry shot.
export function canyonWaterEdges(THREE, canyon) {
  const origin = canyon.camera.getWorldPosition(new THREE.Vector3());
  const forward = canyon.camera.getWorldDirection(new THREE.Vector3());
  forward.y = 0; forward.normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const level = canyon.river.mesh.getWorldPosition(b).y;
  const edges = [[], []];
  for (const bank of canyon.scene.children) {
    const rim = bank.userData.rim;
    if (!rim?.columns || !bank.geometry?.attributes.position) continue;
    const pos = bank.geometry.attributes.position;
    bank.updateWorldMatrix(true, false);
    for (let row = 0; row < rim.rows; row++) {
      const first = row * rim.columns;
      a.fromBufferAttribute(pos, first).applyMatrix4(bank.matrixWorld);
      const z = (a.x - origin.x) * -forward.x + (a.z - origin.z) * -forward.z;
      if (z < -136 || z > 26) continue;
      for (let i = 1; i < rim.columns; i++) {
        b.fromBufferAttribute(pos, first + i).applyMatrix4(bank.matrixWorld);
        if (a.y <= level && b.y > level) {
          a.lerp(b, (level - a.y) / (b.y - a.y)).sub(origin);
          const x = a.dot(right);
          edges[x < 0 ? 0 : 1].push({ x, z: -a.dot(forward) });
          break;
        }
        a.copy(b);
      }
    }
  }
  for (const edge of edges) edge.sort((a, b) => a.z - b.z);
  return edges.every(e => e.length > 1) ? edges : null;
}

function makeFilmPass(THREE, ShaderPass, ocean) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      tWave: { value: ocean.surfaceTex || ocean.u.tOcN.value },
      uView: { value: new THREE.Matrix3() },
      uLens: { value: new THREE.Vector4() },
      uFilm: { value: new THREE.Vector3() },
      uDrops: { value: lensDrops.map(() => new THREE.Vector4()) },
      uRun: { value: lensDrops.map(() => 0) },
      uBeads: { value: 0 }
    },
    depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform sampler2D tDiffuse, tWave;
      uniform mat3 uView;
      uniform vec4 uLens;
      uniform vec3 uFilm; // central eye height, clock, proximity
      uniform float uBeads;
      ${waterlineGLSL}
      ${lensSplashGLSL}
      void main() {
        vec3 viewRay = vec3((2.0 * vUv - 1.0 + uLens.zw) * uLens.xy, -1.0);
        vec3 ray = normalize(uView * viewRay);
        float line = waterPortDistance(uFilm.x, ray, uView[1], uLens.y, length(viewRay), uFilm.y);
        float aspect = uLens.x / uLens.y;
        float under = max(-line, 0.0);
        float lip = exp(-abs(line) * 110.0) * uFilm.z;
        float film = exp(-abs(line) * 26.0) * uFilm.z;
        float x = vUv.x * aspect;
        float wobble = sin(x * 23.0 + uFilm.y * 1.3);
        vec2 bend = vec2(0.0024 * wobble, -0.033 + 0.006 * sin(x * 10.0 - uFilm.y)) * film;
        vec2 uv = clamp(vUv + bend, 0.001, 0.999);
        vec3 color = texture2D(tDiffuse, uv).rgb;
        if (film > 0.002) {
          float wave = texture2D(tWave, vec2(x * 1.8 + uFilm.y * 0.011, 0.19 / (0.075 + under))).b;
          vec2 reflectedUV = vUv + vec2((wave - 0.5) * 0.024, 0.018 + 1.72 * under + wave * 0.012);
          vec3 bank = texture2D(tDiffuse, clamp(reflectedUV, 0.001, 0.999)).rgb;
          color = mix(color, bank * vec3(0.69,0.85,0.95), smoothstep(-0.014,0.014,-line) * film);
          color += vec3(0.64,0.83,0.95) * lip * (0.12 + 0.25 * smoothstep(0.43,0.67,wave));
        }
        if (uBeads > 0.001 && line > -0.012) {
          vec4 beads = vec4(0.0);
          addLensSplash(beads, tDiffuse, vUv, aspect);
          float dry = smoothstep(-0.012,0.008,line);
          color = color * (1.0 - beads.a * dry) + beads.rgb * dry;
        }
        gl_FragColor = vec4(color, 1.0);
      }`
  });
  const pass = new ShaderPass(material);
  pass.enabled = false;
  return pass;
}

export function createWaterlineView({ THREE, ShaderPass, composer, renderer, canyon, ocean, lite }) {
  const { scene, camera } = canyon;
  const surface = canyon.river.mesh;
  const sky = canyon.alpineAtmosphere?.uniforms;
  const pass = makeFilmPass(THREE, ShaderPass, ocean);
  const film = pass.uniforms;
  const outputIndex = composer.passes.findIndex(p => p.uniforms?.toneMappingExposure);
  composer.insertPass(pass, outputIndex < 0 ? composer.passes.length : outputIndex);

  const fogTint = new THREE.Color('#47728d'), ambientTint = new THREE.Color('#9abfd0');
  const sun = new THREE.Vector3(-0.46,0.64,-0.62).normalize();
  const sunColor = new THREE.Color('#fff0d9'), sunLocal = sun.clone();
  const eye = new THREE.Vector3(), orientation = new THREE.Quaternion();
  const dryCamera = camera.clone(false);
  const forward = new THREE.Vector3(), origin = new THREE.Vector3();
  const rotation = new THREE.Matrix3(), localAxes = new THREE.Matrix3();
  const savedFog = new THREE.Color(), savedBackground = new THREE.Color();
  const skyColors = [sky?.zenith, sky?.uMid, sky?.horizon, sky?.uFogColor].filter(Boolean)
    .map(uniform => ({ uniform, original: new THREE.Color() }));
  const lights = scene.children.filter(light => light.isLight).map(light => ({
    light, color: new THREE.Color(), intensity: 0
  }));
  const currents = [];
  canyon.followLights?.group.traverse(object => {
    const brightness = object.material?.uniforms?.uBright;
    if (brightness) currents.push({ brightness, value: 0 });
  });
  const bloom = composer.passes.find(p => typeof p.strength === 'number' && p.renderTargetsHorizontal);
  let basePitch = 0, frames = 0;

  function readAirFrame() {
    if (canyon.alpineAtmosphere?.sunDirection) sun.copy(canyon.alpineAtmosphere.sunDirection).normalize();
    if (sky?.uSunCol) sunColor.copy(sky.uSunCol.value);
    camera.getWorldDirection(forward);
    basePitch = Math.asin(Math.max(-1, Math.min(1, forward.y)));
    forward.y = 0;
    forward.normalize();
    localAxes.set(-forward.z, 0, forward.x, 0, 1, 0, -forward.x, 0, -forward.z);
    sunLocal.copy(sun).applyMatrix3(localAxes);
  }

  function render({ sample, time, reduced, splashAt }, draw) {
    const { height, immersion, proximity, ceilingLook } = sample;
    const fog = scene.fog, fogDensity = fog.density, environment = scene.environmentIntensity;
    const exposure = renderer.toneMappingExposure, fov = camera.fov;
    const bloomEnabled = bloom?.enabled, bloomStrength = bloom?.strength;
    eye.copy(camera.position); orientation.copy(camera.quaternion);
    dryCamera.copy(camera, false);
    savedFog.copy(fog.color); savedBackground.copy(scene.background);
    readAirFrame();
    surface.getWorldPosition(origin);
    // The dry part sees out through the top of the housing. Sample it above the
    // crest so a second cut through the river mesh cannot appear above the lip.
    const bevel = Math.max(0, 0.18 - Math.abs(height - 0.95));
    const dryHeight = Math.max(height, 0.95) + bevel * bevel / 0.72;
    camera.position.y = origin.y + dryHeight;
    camera.position.addScaledVector(forward, advanceAtHeight(height));
    camera.rotateX((underwaterPitch(-height) - basePitch) * ceilingLook);
    camera.fov = fov * (1 - 0.14 * smoothstep(0.9, 3.4, -height));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    sample.pitch = lerp(basePitch, underwaterPitch(-height), ceilingLook);
    sample.fov = camera.fov;
    sample.worldY = origin.y + height;
    const haze = 0.35 * immersion;
    fog.density = lerp(fogDensity, lite ? 0.05 : 0.056, haze * haze);
    fog.color.lerp(fogTint, haze); scene.background.lerp(fogTint, haze);
    for (const { uniform, original } of skyColors) {
      original.copy(uniform.value);
      uniform.value.lerp(fogTint, haze);
    }
    for (const state of lights) {
      const light = state.light;
      state.color.copy(light.color); state.intensity = light.intensity;
      light.intensity *= lerp(1, light.isHemisphereLight ? 0.78 : 0.72, haze);
      light.color.lerp(ambientTint, 0.35 * haze);
    }
    scene.environmentIntensity = environment * lerp(1, 0.59, haze);
    renderer.toneMappingExposure = exposure * lerp(1, 0.87, haze);
    if (bloomEnabled) bloom.strength = bloomStrength * (1 - haze);
    for (const current of currents) {
      current.value = current.brightness.value;
      current.brightness.value *= 1 - smoothstep(-1.68, -0.10, -height);
    }

    rotation.setFromMatrix4(camera.matrixWorld);
    film.uView.value.multiplyMatrices(localAxes, rotation);
    const proj = camera.projectionMatrix.elements;
    film.uLens.value.set(1 / proj[0], 1 / proj[5], proj[8], proj[9]);
    film.uFilm.value.set(height, reduced ? 0 : time, proximity);
    const age = time - splashAt;
    const splash = !reduced && age >= 0 && age < 1.05 ? 1 - smoothstep(0.64, 1.05, age) : 0;
    film.uBeads.value = splash * (1 - smoothstep(1.08, 2.2, height));
    if (film.uBeads.value > 0.001) {
      for (let i = 0; i < lensDrops.length; i++) {
        const [x, y, radius] = lensDrops[i];
        const t = Math.max(0, age - (i % 6) * 0.014);
        const slide = (0.045 + 1.8 * radius) * t * t;
        film.uDrops.value[i].set(x, y - slide, radius, film.uBeads.value * smoothstep(0, 0.052, t));
        film.uRun.value[i] = slide;
      }
    }
    pass.enabled = proximity > 0.0001 || film.uBeads.value > 0.001;
    try {
      const result = draw();
      frames++;
      return result;
    } finally {
      pass.enabled = false;
      camera.position.copy(eye); camera.quaternion.copy(orientation); camera.fov = fov;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      fog.density = fogDensity; fog.color.copy(savedFog); scene.background.copy(savedBackground);
      for (const { uniform, original } of skyColors) uniform.value.copy(original);
      for (const state of lights) { state.light.intensity = state.intensity; state.light.color.copy(state.color); }
      scene.environmentIntensity = environment; renderer.toneMappingExposure = exposure;
      if (bloomEnabled) bloom.strength = bloomStrength;
      for (const current of currents) current.brightness.value = current.value;
    }
  }

  async function warm() {
    readAirFrame();
    const filmScene = new THREE.Scene(), geometry = new THREE.PlaneGeometry(2, 2);
    filmScene.add(new THREE.Mesh(geometry, pass.material));
    try {
      // The water normal belongs to a second WebGL context. Upload its copy now
      // rather than allocating it when the lens first touches the crest.
      renderer.initTexture(film.tWave.value);
      await renderer.compileAsync(filmScene, new THREE.Camera());
      // Allocate the composer's actual render-target variants while the deep
      // scene covers the canyon, before a gesture can expose the split frame.
      render({ sample: sampleWaterline(-0.12), time: 0, reduced: true, splashAt: -100 }, () => composer.render(0));
    }
    finally { geometry.dispose(); }
  }
  function toUnderwater(world, out) {
    const y = world.y - surface.getWorldPosition(origin).y;
    return out.copy(world).sub(camera.position).setY(y).applyMatrix3(localAxes);
  }
  return { render, warm, toUnderwater, dryCamera, sunLocal, sunColor, get basePitch() { return basePitch; }, get frames() { return frames; } };
}

