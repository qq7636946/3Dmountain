/* =====================================================================
   index1-6 · LOGO 收尾 Logo Seal — STUB of world-logo-mark.js (Interface A), 2026-10-24.
   A placeholder so the block works before the material specialist delivers: LOGO 1 (images/logo.svg) extruded
   with a rounded bevel, a MeshPhysicalMaterial that reads as clear water-glass. world-logo-build.cjs ships the real
   world-logo-mark.js instead when that file exists. Same exports as the real one:
     MARK_DEFAULTS, MARK_ROWS, createLogoMark({ THREE, SVGLoader, svgUrl, renderer, look })
   ===================================================================== */
export const MARK_DEFAULTS = {
  "depth": 0.16, "bevel": 0.07, "bevelSegments": 8, "transmission": 0.92, "thickness": 0.9, "ior": 1.35, "roughness": 0.06,
  "clearcoat": 1, "attenuation": "#a9c6e0", "attenuationDistance": 1.6, "envIntensity": 1.3, "yawOffset": 0
};
export const MARK_ROWS = [
  ['厚度（÷ 高度）', 'depth', .02, .5, .005], ['圓角大小（÷ 高度）', 'bevel', .005, .2, .002], ['圓角段數（重建幾何）', 'bevelSegments', 2, 16, 1],
  ['透光度', 'transmission', 0, 1, .01], ['折射厚度', 'thickness', 0, 3, .02], ['折射率', 'ior', 1, 2, .01], ['粗糙度', 'roughness', 0, .5, .005],
  ['清漆', 'clearcoat', 0, 1, .01], ['吸收色（淡藍灰）', 'attenuation'], ['吸收距離', 'attenuationDistance', .2, 6, .05],
  ['環境反射強度', 'envIntensity', 0, 4, .05]
];

export async function createLogoMark({ THREE, SVGLoader, svgUrl, renderer, look }) {
  const text = await fetch(svgUrl).then(r => { if (!r.ok) throw new Error('logo.svg ' + r.status); return r.text(); });
  const data = new SVGLoader().parse(text);
  const shapes = data.paths.flatMap(path => SVGLoader.createShapes(path));
  const flat = new THREE.ShapeGeometry(shapes, 12); flat.computeBoundingBox();
  const box = flat.boundingBox, H = box.max.y - box.min.y; flat.dispose();
  const centre = box.getCenter(new THREE.Vector3());
  const group = new THREE.Group(), pivot = new THREE.Group(); group.add(pivot);
  const material = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, color: 0xffffff, metalness: 0, transparent: false });
  let mesh = null, envMap = null, current = { ...MARK_DEFAULTS, ...look }, builtKey = '';
  function geometry() {
    const key = [current.depth, current.bevel, current.bevelSegments].join('|');
    if (key === builtKey) return; builtKey = key;
    mesh?.geometry.dispose();
    const bevel = current.bevel * H;
    const g = new THREE.ExtrudeGeometry(shapes, { depth: current.depth * H, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: 0, bevelSegments: Math.round(current.bevelSegments), curveSegments: 20 });
    g.translate(-centre.x, -centre.y, -(current.depth * H) / 2);
    g.scale(1 / H, -1 / H, 1 / H);          // svg y runs down; the height is normalised to 1; the front faces +Z
    if (!mesh) { mesh = new THREE.Mesh(g, material); pivot.add(mesh); } else mesh.geometry = g;
  }
  function apply() {
    const c = current;
    Object.assign(material, { transmission: c.transmission, thickness: c.thickness, ior: c.ior, roughness: c.roughness, clearcoat: c.clearcoat, clearcoatRoughness: .04, attenuationDistance: c.attenuationDistance, envMapIntensity: c.envIntensity });
    material.attenuationColor.set(c.attenuation);
    material.envMap = envMap; material.needsUpdate = true;
    geometry();
  }
  apply();
  let yaw = 0;
  return {
    group,
    setLook(next) { current = { ...current, ...next }; apply(); },
    setEnvironment(texture) { envMap = texture || null; apply(); },
    update({ yaw: y = 0 } = {}) { yaw = y; pivot.rotation.y = y + (current.yawOffset || 0); },
    dispose() { mesh?.geometry.dispose(); material.dispose(); }
  };
}
