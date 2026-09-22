import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

/** Extrudes the actual brand paths, independent of the SVG document's empty canvas. */
export async function createGlassLogo(THREE, { url = './logo.svg', environment = null } = {}) {
  const source = await new SVGLoader().loadAsync(url);
  const shapes = source.paths.flatMap(path => SVGLoader.createShapes(path));
  if (!shapes.length) throw new Error('The logo SVG contains no filled paths.');

  const outline = new THREE.ShapeGeometry(shapes, 96);
  outline.computeBoundingBox();
  const bounds = outline.boundingBox.clone();
  outline.dispose();
  const sourceHeight = bounds.max.y - bounds.min.y;
  const bevel = 0.048;
  const depth = 0.32;
  const scale = (5 - bevel * 2) / sourceHeight;

  const optical = {
    color: 0xf2f3ff,
    metalness: 0,
    roughness: 0.065,
    transmission: 1,
    thickness: 0.68,
    ior: 1.52,
    dispersion: 0.035,
    attenuationColor: new THREE.Color(0xdce0ff),
    attenuationDistance: 8,
    clearcoat: 1,
    clearcoatRoughness: 0.045,
    specularIntensity: 1,
    envMapIntensity: 2.25,
    envMap: environment,
  };
  const face = new THREE.MeshPhysicalMaterial(optical);
  face.name = 'Logo · optical crystal';
  const edge = new THREE.MeshPhysicalMaterial({
    ...optical,
    color: 0xdaddff,
    roughness: 0.08,
    thickness: 0.85,
    attenuationDistance: 4.5,
    envMapIntensity: 2.55,
  });
  edge.name = 'Logo · polished bevel';
  // A shallow optical polish bends broad reflections without changing the SVG edge.
  // Object-space coordinates make the glass surface stable while the logo turns.
  for (const [material, strength] of [[face, 0.095], [edge, 0.025]]) {
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCrystalPosition; varying vec3 vCrystalAxisX; varying vec3 vCrystalAxisY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCrystalPosition = position; vCrystalAxisX = normalize(normalMatrix * vec3(1.0,0.0,0.0)); vCrystalAxisY = normalize(normalMatrix * vec3(0.0,1.0,0.0));');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCrystalPosition; varying vec3 vCrystalAxisX; varying vec3 vCrystalAxisY;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec3 cp = vCrystalPosition;
          float polishX = sin(cp.y * 2.1 + cp.x * 1.2) + 0.28 * sin(cp.y * 5.2 - cp.x * 2.0);
          float polishY = cos(cp.x * 2.5 - cp.y * 1.4) + 0.20 * cos(cp.y * 4.6 + cp.x * 1.6);
          normal = normalize(normal + ${strength.toFixed(3)} * (vCrystalAxisX * polishX + vCrystalAxisY * polishY));
        `)
        .replace('#include <opaque_fragment>', `
          #ifdef USE_ENVMAP
            // The opaque scene is intentionally black. Let the studio behind the
            // object contribute transmitted light as well as reflected light.
            vec3 throughGlass = getIBLRadiance(-geometryViewDir, normal, 0.18);
            outgoingLight += throughGlass * vec3(0.28, 0.29, 0.34);
          #endif
          #include <opaque_fragment>
        `);
    };
    material.customProgramCacheKey = () => `crystal-polish-${strength}`;
  }
  const materials = [face, edge];
  const geometries = [];
  const group = new THREE.Group();
  group.name = 'Original SVG · glass logo';

  for (const [index, shape] of shapes.entries()) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth / scale,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: bevel / scale,
      bevelSize: bevel / scale,
      bevelSegments: 5,
      curveSegments: 96,
      material: 0,
      extrudeMaterial: 1,
    });
    geometry.scale(scale, scale, scale);
    // A rotation, rather than a negative scale, keeps triangle winding correct.
    geometry.rotateX(Math.PI);
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.name = `Brand path ${index + 1}`;
    group.add(mesh);
    geometries.push(geometry);
  }

  const actualBounds = new THREE.Box3().setFromObject(group);
  const center = actualBounds.getCenter(new THREE.Vector3());
  for (const geometry of geometries) {
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
  group.userData.logo = {
    source: url,
    pathCount: source.paths.length,
    shapeCount: shapes.length,
    height: actualBounds.max.y - actualBounds.min.y,
    width: actualBounds.max.x - actualBounds.min.x,
    depth: depth + bevel * 2,
  };

  return {
    group,
    materials,
    geometries,
    dispose() {
      group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}


