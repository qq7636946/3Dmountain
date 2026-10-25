/* Mobile runtime compatibility for index1-5 only. No input or layout patches. */
const fs = require('fs'), path = require('path');
const once = (source, anchor, replacement, label) => {
  const usesCrlf = !source.includes(anchor) && anchor.includes('\n');
  const selected = usesCrlf ? anchor.replace(/\n/g, '\r\n') : anchor;
  if (source.split(selected).length !== 2) throw Error('mobile runtime ' + label + ': unexpected anchor count');
  return source.replace(selected, () => usesCrlf ? replacement.replace(/\n/g, '\r\n') : replacement);
};
function patchQueue(source) {
  if (source.includes('/* MOBILE_WORLD_QUEUE_RECOVERY */')) return source;
  return once(source, `const idle = (fn, busy) => new Promise(resolve => {
  const go = () => (window.requestIdleCallback || (f => setTimeout(f, 40)))(() => { if (busy?.()) { setTimeout(go, 120); return; } resolve(fn()); }, { timeout: 1500 });`,
    `/* MOBILE_WORLD_QUEUE_RECOVERY */
const idle = (fn, busy) => new Promise((resolve, reject) => {
  const go = () => (window.requestIdleCallback || (f => setTimeout(f, 40)))(() => {
    if (busy?.()) { setTimeout(go, 120); return; }
    try { resolve(fn()); } catch (error) { reject(error); }
  }, { timeout: 1500 });`, 'preparation queue recovery');
}
function patchWorld(source) {
  source = patchQueue(source);
  if (source.includes('/* MOBILE_WORLD_IMAGE_FALLBACK */')) return source;
  source = once(source, "import * as THREE from 'three';", "import * as THREE from 'three';\nimport { loadWorldImage } from './world-image-source.js';   /* MOBILE_WORLD_IMAGE_FALLBACK */", 'image import');
  source = once(source, `  const bitmap = url => fetch(url).then(r => r.ok ? r.blob() : Promise.reject(new Error(r.status + ' ' + url)))
    .then(blob => createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))`,
    `  const bitmap = url => loadWorldImage(url)`, 'image decoding');
  source = once(source, `  const makeTexture = (image, setup) => {
    if (!image) return null;
    try { const t = new THREE.Texture(image); t.flipY = false; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; setup?.(t); t.needsUpdate = true; return t; }
    catch (error) { console.warn('World epilogue: texture unavailable', error); return null; }
  };`,
    `  const makeTexture = (source, setup) => {
    if (!source) return null;
    const { image, flipY } = source;
    if (disposed) { image.close?.(); return null; }
    let t;
    try { t = new THREE.Texture(image); t.flipY = flipY; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; setup?.(t); t.needsUpdate = true; return t; }
    catch (error) { t?.dispose(); image.close?.(); console.warn('World epilogue: texture unavailable', error); return null; }
  };`, 'image orientation');
  source = once(source, `if (disposed || !renderer) { for (const t of [tone, roi, clouds, photo]) t?.dispose(); return; }`,
    `if (disposed || !renderer) { for (const t of [tone, roi, clouds, photo]) { t?.image?.close?.(); t?.dispose(); } return; }`, 'cancelled image cleanup');
  return source;
}
module.exports = ({ main, drops, letters, glass, html, extra = {}, journey }) => {
  if (!extra['finnovation-world.js']) throw Error('mobile runtime: world module is missing');
  return { main, drops, letters, glass, html, journey, extra: {
    'finnovation-world.js': patchWorld(extra['finnovation-world.js']),
    'world-image-source.js': fs.readFileSync(path.join(__dirname, 'world-image-source.js'), 'utf8')
  } };
};
module.exports.patchWorld = patchWorld;
module.exports.patchQueue = patchQueue;
