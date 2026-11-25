/* layer-opacity.js — one opacity dial for a whole group of meshes (2026-11-24, client: 「這都要可以調透明度」 on 河流光束 / 中央 LOGO / 湖心匯集光).
   Shader materials get one shared uniform multiplied into the alpha they write (their own main() runs first, unchanged): with the normal or the
   additive blend (both weigh the colour by its alpha) that is the layer's opacity; a custom blend that ignores alpha gets its colour scaled too.
   Built-in materials get .opacity × the dial. Materials added later (a rebuilt mesh) are picked up on the next set(). */
import * as THREE from 'three';

export function layerOpacity(getRoot, start = 1) {
  const u = { value: start }, done = new WeakSet(), base = new WeakMap();
  const patch = m => {
    if (!m || done.has(m)) return; done.add(m);
    if (m.isShaderMaterial && m.fragmentShader && /void\s+main\s*\(\s*\)/.test(m.fragmentShader)) {
      const usesAlpha = m.blending === THREE.NormalBlending || m.blending === THREE.AdditiveBlending;
      m.uniforms.uLayerOpacity = u;
      m.fragmentShader = m.fragmentShader.replace(/void\s+main\s*\(\s*\)/, 'void lyrMain()') +
        `\nuniform float uLayerOpacity;\nvoid main() { lyrMain(); ${usesAlpha ? 'gl_FragColor.a *= uLayerOpacity;' : 'gl_FragColor *= uLayerOpacity;'} }\n`;
      if (!m.transparent && u.value < 1) m.transparent = true;
      m.needsUpdate = true;
    } else if (m.isMaterial) {
      base.set(m, m.opacity); m.transparent = true; m.needsUpdate = true;
    }
  };
  const each = fn => { const r = getRoot(); r?.traverse?.(o => { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m && fn(m)); }); };
  const set = k => {
    u.value = Math.max(0, Math.min(1, +k));
    each(m => { patch(m); if (!m.isShaderMaterial && base.has(m)) m.opacity = base.get(m) * u.value; });
  };
  return { set, get value() { return u.value; } };
}
