import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* The sculpted range: "3 Mountain" by keremakgn on Sketchfab, CC BY 4.0.
   Three peaks on the back half of a one-unit tile, a flat plain on the
   front half, and a hard cut along every edge — so it is placed with the
   plain toward the lens and the base sunk below whatever surface it stands
   in, and only the peaks show. The licence asks for credit wherever the
   work is shown; the page prints CREDIT for that. */
export const MOUNTAIN_CREDIT = {
  title: '3 Mountain',
  url: 'https://sketchfab.com/3d-models/3-mountain-faef03ef9bca40c99e9f2b1780cda99d',
  author: 'keremakgn',
  authorUrl: 'https://sketchfab.com/keremakgn',
  license: 'CC BY 4.0',
  licenseUrl: 'http://creativecommons.org/licenses/by/4.0/'
};

/* Loads the asset once and hands back a unit template to stamp copies from.

   The file declares KHR_materials_pbrSpecularGlossiness as REQUIRED, and
   three's GLTFLoader dropped that extension years ago: it warns, then falls
   back to the glTF defaults — metalness 1, roughness 1, no colour map —
   which renders as black chrome. So the material is rebuilt here from the
   asset's own maps: its diffuse as the colour map, the occlusion the loader
   did keep as the ambient-occlusion map, and its glossiness turned into
   roughness. The specular-glossiness map is never fetched.

   `haze` is a fade toward a colour by view depth, eased off with altitude
   so a peak stays clearer than its foot — the one thing a mountain needs
   to sit inside a bright room rather than on top of it. Both scenes that
   use the asset paint their own sky, so this stays a material of its own
   rather than a scene fog. The uniforms are shared by every copy. */
export function loadMountainAsset(THREE, {
  manager,
  url = '3_mountain/scene.gltf',
  diffuse = '3_mountain/textures/material_0_diffuse.png',
  anisotropy = 8,
  roughness = .92,
  shadows = true,
  onMaterial
} = {}) {
  const haze = {
    uHazeColor: { value: new THREE.Color('#e6edf7') },
    uHazeNear: { value: 20 },
    uHazeFar: { value: 70 },
    uHazeAmount: { value: 0 },
    /* How much the fade lets go with height, and over what height. */
    uHazeLift: { value: .6 },
    uHazeLiftSpan: { value: 8 }
  };
  const materials = [];
  const meshes = [];

  const gltfLoader = new GLTFLoader(manager);
  const textureLoader = new THREE.TextureLoader(manager);
  const gltfReady = new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject));
  const mapReady = new Promise((resolve, reject) => textureLoader.load(diffuse, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    /* glTF texture coordinates are top-down; TextureLoader flips by default. */
    texture.flipY = false;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    resolve(texture);
  }, undefined, reject));

  return Promise.all([gltfReady, mapReady]).then(([gltf, map]) => {
    let triangles = 0;
    gltf.scene.traverse(child => {
      if (!child.isMesh) return;
      const source = Array.isArray(child.material) ? child.material[0] : child.material;
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map,
        aoMap: source.aoMap || null,
        aoMapIntensity: source.aoMapIntensity ?? 1,
        roughness,
        metalness: 0
      });
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, haze);
        shader.vertexShader = 'varying float vHazeDepth;\nvarying float vHazeHeight;\n' + shader.vertexShader
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHazeHeight=(modelMatrix*vec4(transformed,1.)).y;')
          .replace('#include <fog_vertex>', '#include <fog_vertex>\nvHazeDepth=-mvPosition.z;');
        shader.fragmentShader = 'uniform vec3 uHazeColor;\nuniform float uHazeNear,uHazeFar,uHazeAmount,uHazeLift,uHazeLiftSpan;\nvarying float vHazeDepth;\nvarying float vHazeHeight;\n' + shader.fragmentShader
          .replace('#include <fog_fragment>', `#include <fog_fragment>
      {
        float hazeDepth=smoothstep(uHazeNear,uHazeFar,vHazeDepth);
        float hazeLift=1.-uHazeLift*clamp(vHazeHeight/max(uHazeLiftSpan,1e-3),0.,1.);
        gl_FragColor.rgb=mix(gl_FragColor.rgb,uHazeColor,clamp(hazeDepth*hazeLift*uHazeAmount,0.,1.));
      }`);
      };
      material.customProgramCacheKey = () => 'water-mountain-haze-v1';
      if (onMaterial) onMaterial(material, child);
      if (source !== material) source.dispose();
      child.material = material;
      child.castShadow = shadows;
      child.receiveShadow = shadows;
      materials.push(material);
      meshes.push(child);
      triangles += child.geometry.index
        ? child.geometry.index.count / 3
        : child.geometry.attributes.position.count / 3;
    });

    /* One unit wide, centred on the tile, standing on y = 0. */
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const template = new THREE.Group();
    template.name = 'mountain-template';
    gltf.scene.position.set(-center.x, -box.min.y, -center.z);
    template.add(gltf.scene);
    template.scale.setScalar(1 / size.x);
    template.updateMatrixWorld(true);

    const asset = {
      template,
      materials,
      meshes,
      haze,
      triangles,
      map,
      /* The tile's proportions at unit width: depth along z, height of the
         tallest peak. */
      depth: size.z / size.x,
      height: size.y / size.x,
      credit: MOUNTAIN_CREDIT,
      /* A copy, `width` units wide, centred at (x, z) with its base at y.
         Geometry and materials are shared between copies. */
      place({ parent, x = 0, y = 0, z = 0, width = 1, rotation = 0, name = 'mountain' } = {}) {
        const copy = template.clone(true);
        copy.name = name;
        copy.scale.setScalar(width);
        copy.rotation.y = rotation;
        copy.position.set(x, y, z);
        if (parent) parent.add(copy);
        return copy;
      },
      dispose() {
        for (const mesh of meshes) mesh.geometry.dispose();
        for (const material of materials) material.dispose();
        map.dispose();
        for (const material of materials) if (material.aoMap) material.aoMap.dispose();
      }
    };
    return asset;
  });
}
