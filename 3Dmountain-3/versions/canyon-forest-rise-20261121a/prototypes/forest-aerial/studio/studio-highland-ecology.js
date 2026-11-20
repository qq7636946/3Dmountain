import * as THREE from 'three';

// Reuse the canyon's authored lake-to-ridge arrival field in the unused height
// alpha channel. Raw RGBA bytes preserve height precision (no canvas premultiply).
// Terrain stays within its existing 16 fragment samplers.
export function packArrivalField(atlas) {
  const height = atlas.uniforms.tCanopy?.value;
  const growth = atlas.uniforms.tGrow?.value;
  if (!height?.image || !growth?.image) return false;
  const { width, height: h } = height.image;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let pixels;
  if (height.image.data) pixels = new Uint8ClampedArray(height.image.data);
  else {
    ctx.drawImage(height.image, 0, 0, width, h);
    pixels = ctx.getImageData(0, 0, width, h).data;
  }
  ctx.clearRect(0, 0, width, h);
  ctx.drawImage(growth.image, 0, 0, width, h);
  const arrival = ctx.getImageData(0, 0, width, h).data;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i + 3] = Math.round(255 * (.26 + .26 * arrival[i] / 255 + .52 * Math.pow(arrival[i + 1] / 255, .8)) / 1.04);
  }
  const packed = new THREE.DataTexture(new Uint8Array(pixels.buffer), width, h, THREE.RGBAFormat);
  for (const key of ['flipY', 'wrapS', 'wrapT', 'minFilter', 'magFilter', 'generateMipmaps', 'anisotropy', 'colorSpace']) packed[key] = height[key];
  packed.name = 'Height + authored canyon arrival';
  packed.needsUpdate = true;
  atlas.scene.traverse(object => {
    for (const mat of [].concat(object.material || [])) {
      for (const uniform of Object.values(mat.uniforms || {})) if (uniform.value === height) uniform.value = packed;
    }
  });
  atlas.uniforms.tCanopy.value = packed;
  height.dispose();
  return true;
}

export const HIGHLAND_GLSL = `
  uniform float uBiomeContrast, uCavityDepth, uCloudStrength;
  uniform float uValleyMist, uMistHeight, uArrival, uArrivalMap;

  // Broad shadows move in world space. Both rock/grass and water use this
  // visibility on their DIRECT sunlight; skylight stays available in shadow.
  float stCloudVisibility(vec2 p) {
    if (uCloudStrength < 0.001) return 1.0;
    vec2 q = p * 0.095 + vec2(uTime * 0.0018, -uTime * 0.0011);
    float cover = stFbm2(q + vec2(4.8, -2.3));
    return 1.0 - uCloudStrength * smoothstep(0.34, 0.66, cover);
  }

  // Integrate an exponential density along the camera ray. The local height
  // gate keeps ridge crests clear even with a long aerial view distance.
  vec3 stValleyAir(vec3 color, vec3 world, vec3 eye) {
    if (uValleyMist < 0.001) return color;
    float falloff = 4.0 / max(uMistHeight, 0.08);
    float low = exp(-max(world.y - 0.105, 0.0) * falloff);
    float rise = max(eye.y - world.y, 0.0) * falloff;
    float integral = rise < 0.001 ? 1.0 : (1.0 - exp(-rise)) / rise;
    float path = min(length(eye - world), 80.0) * integral;
    float density = low * (0.28 + path * 0.55) * uValleyMist;
    float fog = min(0.48, 1.0 - exp(-density));
    return mix(color, vec3(0.39, 0.48, 0.57), fog);
  }

  vec3 stArrivalColor(vec3 color, vec2 p, float field) {
    if (uArrival >= 0.9999) return color;
    float outside = length(max(abs(p) - vec2(7.0, 3.917), 0.0));
    float fallback = 0.23 + length(p * vec2(1.0, 1.35)) * 0.065;
    float arrival = mix(fallback, field, uArrivalMap) + outside * 0.018;
    float edgeNoise = forestNoise(p * 3.1) * 0.025 + forestNoise(p * 0.83) * 0.04;
    float front = uArrival * 1.36 - arrival + edgeNoise;
    float life = smoothstep(0.0, 0.11, front);
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 stone = vec3(luminance * 0.88 + 0.008);
    float lip = exp(-pow((front - 0.045) / 0.029, 2.0));
    return mix(stone, color, life) + vec3(0.023, 0.027, 0.012) * lip;
  }
`;

// Apply the same spatial arrival to the existing light curtain, logo and mist.
// Only runs during entry; no extra geometry, render target or permanent pass.
export function bindAtmosphereArrival(atlas, uniforms) {
  const seen = new Set();
  atlas.scene.traverse(object => {
    for (const mat of [].concat(object.material || [])) {
      if (!mat.isShaderMaterial || seen.has(mat) || mat.userData.handlesArrival || mat.fragmentShader.includes('col=stArrivalColor(')) continue;
      seen.add(mat);
      const frag = mat.fragmentShader;
      if (!frag.includes('gl_FragColor')) continue;
      mat.uniforms.stArrival = uniforms.uArrival;
      mat.uniforms.stArrivalMap = uniforms.uArrivalMap;
      mat.uniforms.stArrivalHeight = atlas.uniforms.tCanopy;
      mat.uniforms.stArrivalBounds = atlas.uniforms.uBounds;
      mat.vertexShader = 'varying vec2 vStArrivalXZ;\n' + mat.vertexShader.replace(/}\s*$/, '\n vStArrivalXZ = (modelMatrix * vec4(position, 1.0)).xz;\n}');
      const header = `varying vec2 vStArrivalXZ;
        uniform sampler2D stArrivalHeight;
        uniform vec4 stArrivalBounds;
        uniform float stArrival, stArrivalMap;
      `;
      const color = `
        if (stArrival < 0.9999) {
          vec2 agUv = (vStArrivalXZ - stArrivalBounds.xy) * stArrivalBounds.zw;
          float agField = texture2D(stArrivalHeight, clamp(agUv, 0.0, 1.0)).a;
          agField = mix(0.23 + length(vStArrivalXZ) * 0.065, agField, stArrivalMap);
          float agLife = smoothstep(0.0, 0.11, stArrival * 1.36 - agField);
          float agLum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor.rgb = mix(vec3(agLum), gl_FragColor.rgb, agLife);
        }
      `;
      mat.fragmentShader = header + (frag.includes('#include <colorspace_fragment>')
        ? frag.replace('#include <colorspace_fragment>', color + '\n#include <colorspace_fragment>')
        : frag.replace(/}\s*$/, color + '\n}'));
      mat.needsUpdate = true;
    }
  });
}
