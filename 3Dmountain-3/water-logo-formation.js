import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

/** Exact SVG artwork and deterministic, area-uniform particle destinations.
 * Local coordinates are centred on actual paths, +Y up, +Z toward camera.
 * Caller owns placement of group and calls update(reveal, time, reduced).
 */
export async function createLogoFormation(THREE, { url = './logo.svg', particleCount = 6000 } = {}) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load brand mark (${response.status})`);
  const document = new SVGLoader().parse(await response.text());
  const pieces = [];
  const bounds = new THREE.Box3();
  for (const path of document.paths) {
    if (path.userData?.style?.fill === 'none') continue;
    for (const shape of SVGLoader.createShapes(path)) {
      const geometry = new THREE.ShapeGeometry(shape, 64);
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox);
      pieces.push(geometry);
    }
  }
  if (!pieces.length || bounds.isEmpty()) throw new Error('Brand SVG has no filled paths');
  const center = bounds.getCenter(new THREE.Vector3());
  const artworkSize = bounds.getSize(new THREE.Vector3());
  const height = 3.5;
  const scale = height / artworkSize.y;
  const width = artworkSize.x * scale;
  let vertexCount = 0;
  for (const piece of pieces) vertexCount += piece.index ? piece.index.count : piece.attributes.position.count;
  const vertices = new Float32Array(vertexCount * 3);
  let offset = 0;
  for (const piece of pieces) {
    const attribute = piece.attributes.position;
    const count = piece.index ? piece.index.count : attribute.count;
    // Flip the SVG Y axis, restoring front-facing triangle winding afterward.
    for (let triangle = 0; triangle < count; triangle += 3) {
      for (const corner of [0, 2, 1]) {
        const index = piece.index ? piece.index.getX(triangle + corner) : triangle + corner;
        vertices[offset++] = (attribute.getX(index) - center.x) * scale;
        vertices[offset++] = (center.y - attribute.getY(index)) * scale;
        vertices[offset++] = 0;
      }
    }
    piece.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Sampling filled triangles preserves holes and ignores the empty viewBox.
  const triangleCount = vertices.length / 9;
  const areas = new Float64Array(triangleCount);
  let totalArea = 0;
  for (let i = 0; i < triangleCount; i++) {
    const k = i * 9;
    const abx = vertices[k + 3] - vertices[k];
    const aby = vertices[k + 4] - vertices[k + 1];
    const acx = vertices[k + 6] - vertices[k];
    const acy = vertices[k + 7] - vertices[k + 1];
    totalArea += Math.abs(abx * acy - aby * acx) * .5;
    areas[i] = totalArea;
  }
  if (totalArea <= 0) {
    geometry.dispose();
    throw new Error('Brand SVG has no triangulated area');
  }
  const count = Math.max(0, Math.floor(Number.isFinite(particleCount) ? particleCount : 6000));
  const targets = new Float32Array(count * 3);
  let seed = 0x68b4a91d;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const area = ((i + random()) / count) * totalArea;
    let lo = 0, hi = triangleCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (areas[mid] < area) lo = mid + 1;
      else hi = mid;
    }
    const k = lo * 9;
    const root = Math.sqrt(random());
    const a = 1 - root, b = root * (1 - random()), c = 1 - a - b;
    targets[i * 3] = vertices[k] * a + vertices[k + 3] * b + vertices[k + 6] * c;
    targets[i * 3 + 1] = vertices[k + 1] * a + vertices[k + 4] * b + vertices[k + 7] * c;
    targets[i * 3 + 2] = 0;
  }
  // Shuffle triangle-order correlation: each incoming river fills the whole mark.
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    for (let axis = 0; axis < 3; axis++) {
      const value = targets[i * 3 + axis];
      targets[i * 3 + axis] = targets[j * 3 + axis];
      targets[j * 3 + axis] = value;
    }
  }

  const material = new THREE.ShaderMaterial({
    name: 'Montis liquid silver identity',
    uniforms: {
      uReveal: { value: 0 }, uTime: { value: 0 },
      uSize: { value: new THREE.Vector2(width, height) }
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vMark;
      uniform vec2 uSize;
      void main() {
        vMark = position.xy / uSize + .5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vMark;
      uniform float uReveal;
      uniform float uTime;
      void main() {
        // Light moves inside the mark; its accurate silhouette never deforms.
        float diagonal = vMark.x * .54 + vMark.y * .84;
        float fold = .5 + .5 * sin(diagonal * 7.2 - .46);
        float glint = pow(max(0.0, sin(diagonal * 10.1 + .65)), 16.0);
        float satin = .5 + .5 * sin(diagonal * 24.0 + uTime * .12);
        vec3 shade = mix(vec3(.025, .075, .12), vec3(.67, .79, .86),
          pow(smoothstep(.04, .91, fold), 1.65));
        shade += vec3(.10, .13, .15) * glint;
        shade += vec3(.014, .020, .022) * satin;
        shade += vec3(.016, .029, .040) * smoothstep(.18, .97, vMark.y);
        gl_FragColor = vec4(shade, uReveal);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'logo.svg / exact filled vector';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  const group = new THREE.Group();
  group.name = 'Five rivers — brand formation';
  group.add(mesh);
  group.visible = false;
  return {
    group, mesh, meshes: [mesh], targets, width, height,
    update(reveal, time = 0, reduced = false) {
      const amount = THREE.MathUtils.clamp(Number.isFinite(reveal) ? reveal : 0, 0, 1);
      group.visible = amount > .0001;
      material.uniforms.uReveal.value = amount;
      material.uniforms.uTime.value = reduced ? 0 : time;
    },
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
    }
  };
}
