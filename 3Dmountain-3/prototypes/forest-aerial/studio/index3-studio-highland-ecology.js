import * as THREE from 'three';
import { BANKS } from './studio-clouds.js?v=look1';

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

const f3 = v => (+v).toFixed(3);
const f5 = v => (+v).toFixed(5);
const BANK_C = BANKS.map(b => `vec4(${f3(b[0])},${f3(b[1])},${f3(b[2])},${f3(b[6])})`).join(',');
const BANK_IR = BANKS.map(b => `vec4(${f5(1 / b[3])},${f5(1 / b[4])},${f5(1 / b[5])},${f3(b[7])})`).join(',');
const BANK_PH = BANKS.map((_, i) => `vec2(${f5(Math.cos(i * 2.731))},${f5(Math.sin(i * 2.731))})`).join(',');

export const HIGHLAND_GLSL = `
  uniform float uBiomeContrast, uCavityDepth, uCloudStrength;
  uniform vec4 uBankShadow;   /* xyz: direction to the sun, w: how dark the cloud banks' shadows are (0 = none) */
  uniform vec3 uMistColor;
  const vec4 ST_BANK_C[${BANKS.length}] = vec4[${BANKS.length}](${BANK_C});
  const vec4 ST_BANK_IR[${BANKS.length}] = vec4[${BANKS.length}](${BANK_IR});
  const vec2 ST_BANK_PH[${BANKS.length}] = vec2[${BANKS.length}](${BANK_PH});
  float stBkHash(vec2 p){vec3 h=fract(p.xyx*vec3(0.1031,0.11369,0.13787));h+=dot(h,h.yzx+19.19);return fract((h.x+h.y)*h.z);}
  float stBkNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(stBkHash(i),stBkHash(i+vec2(1,0)),f.x),mix(stBkHash(i+vec2(0,1)),stBkHash(i+1.0),f.x),f.y);}
  float stBkField(vec2 p){mat2 rot=mat2(0.8,-0.6,0.6,0.8);float b=stBkNoise(p);p=rot*p*2.13+3.71;float c=stBkNoise(p);p=rot*p*2.06+7.27;return b*0.50+c*0.29+stBkNoise(p)*0.15+stBkNoise(rot*p*2.11)*0.06;}

  // 2026-11-21 (client: 「雲霧反射出來的影子在山谷上也要做出」): the shadow of the cloud banks actually drawn by studio-clouds.js.
  // From the ground point, go toward the sun; where that line crosses a bank, its chord and the same billow field as the cloud
  // give the density. Banks drift and the billows move with the same clocks as the clouds, so the shadows follow them.
  float stBankShadow(vec3 P) {
    if (uBankShadow.w < 0.001 || uBankShadow.y < 0.02) return 1.0;
    vec3 L = uBankShadow.xyz;
    vec2 wind = vec2(-0.021, 0.010) * uTime;
    float sT = sin(uTime * 0.019), cT = cos(uTime * 0.019);
    float dens = 0.0;
    int bankN = (uBankShadow.w >= 0.0) ? ${BANKS.length} : 0;
    for (int i = 0; i < bankN; i++) {
      vec4 cs = ST_BANK_C[i], ir = ST_BANK_IR[i];
      vec2 ph = ST_BANK_PH[i];
      float drift = sT * ph.x + cT * ph.y;
      vec3 c = cs.xyz + vec3(0.55, 0.0, -0.26) * drift;
      vec3 e = (P - c) * ir.xyz, d = L * ir.xyz;
      float t = -dot(e, d) / dot(d, d);
      if (t <= 0.0) continue;
      vec3 cl = e + t * d;
      float chord = 1.0 - dot(cl, cl);
      if (chord <= 0.0) continue;
      float sx = float(i) * 2.731;
      vec3 S = P + L * t;
      vec2 q = S.xz * vec2(1.07, 1.42) + S.y * vec2(0.42, -0.28) + wind + sx;
      float billows = smoothstep(0.32, 0.69, stBkField(q) + chord * 0.22 - 0.12);
      dens += chord * smoothstep(0.0, 0.35, chord) * billows * cs.w * mix(0.45, 1.0, ir.w);
    }
    return 1.0 - uBankShadow.w * (1.0 - exp(-dens * 2.2));
  }
  uniform float uValleyMist, uMistHeight, uArrival, uArrivalMap;

  // Broad shadows move in world space. Both rock/grass and water use this
  // visibility on their DIRECT sunlight; skylight stays available in shadow.
  float stCloudNoiseVis(vec2 p) {
    if (uCloudStrength < 0.001) return 1.0;
    vec2 q = p * 0.095 + vec2(uTime * 0.0018, -uTime * 0.0011);
    float cover = stFbm2(q + vec2(4.8, -2.3));
    return 1.0 - uCloudStrength * smoothstep(0.34, 0.66, cover);
  }
  // water (and reflections) sit at the water line; the land passes its own height (stCloudVisibility3)
  float stCloudVisibility(vec2 p) { return stCloudNoiseVis(p) * stBankShadow(vec3(p.x, 0.105, p.y)); }
  float stCloudVisibility3(vec3 P) { return stCloudNoiseVis(P.xz) * stBankShadow(P); }

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
    return mix(color, uMistColor, fog);
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
