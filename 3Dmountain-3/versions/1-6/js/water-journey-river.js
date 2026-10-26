/**
 * Continuous world-space river for the canyon journey.
 *
 * createJourneyRiver(THREE, curve, widthAt, { material, lite, lengthSegments,
 *   widthSegments, bankOverlap })
 *
 * curve: horizontal CatmullRomCurve3 (getPointAt/getTangentAt).
 * widthAt(u): river HALF width, in scene units.
 * material: pass the existing seaMaterial to retain the opening water exactly.
 * The supplied material and its uniforms remain caller-owned and untouched.
 * Update the shared uSeaTime from the main frame loop; update(time) intentionally
 * does not write it a second time. No Water.js reflection target is required:
 * seaMaterial uses the existing analytic environment in world coordinates.
 */
export function createJourneyRiver(THREE, curve, widthAt, options = {}) {
  const lengthSegments = Math.max(8, Math.floor(options.lengthSegments ?? (options.lite ? 420 : 720)));
  const widthSegments = Math.max(4, Math.floor(options.widthSegments ?? (options.lite ? 20 : 32)));
  const overlap = Math.max(1, options.bankOverlap ?? 1.08);
  const rowSize = widthSegments + 1;
  const vertexCount = (lengthSegments + 1) * rowSize;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const cells = new Float32Array(vertexCount);
  const indexCount = lengthSegments * widthSegments * 6;
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  const centers = [];
  const halfWidths = [];

  for (let row = 0; row <= lengthSegments; row++) {
    const u = row / lengthSegments;
    centers.push(curve.getPointAt(u));
    halfWidths.push(Math.max(.25, widthAt(u)) * overlap);
  }

  for (let row = 0; row <= lengthSegments; row++) {
    const u = row / lengthSegments;
    const center = centers[row];
    const tangent = curve.getTangentAt(u);
    const horizontalLength = Math.hypot(tangent.x, tangent.z) || 1;
    const sideX = -tangent.z / horizontalLength;
    const sideZ = tangent.x / horizontalLength;
    const halfWidth = halfWidths[row];
    const previous = centers[Math.max(0, row - 1)];
    const next = centers[Math.min(lengthSegments, row + 1)];
    const neighbors = row === 0 || row === lengthSegments ? 1 : 2;
    const alongSpacing = previous.distanceTo(next) / neighbors;
    const acrossSpacing = 2 * halfWidth / widthSegments;
    // The original Gerstner shader uses aCell for wavelength filtering. This
    // actual mesh spacing preserves long mirror folds and suppresses only
    // wavelengths that the river mesh cannot resolve.
    const cellSize = Math.max(alongSpacing, acrossSpacing);

    for (let column = 0; column <= widthSegments; column++) {
      const v = column / widthSegments;
      const offset = (2 * v - 1) * halfWidth;
      const index = row * rowSize + column;
      positions[index * 3] = center.x + sideX * offset;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = center.z + sideZ * offset;
      normals[index * 3 + 1] = 1;
      uvs[index * 2] = v;
      uvs[index * 2 + 1] = u;
      cells[index] = cellSize;
    }
  }

  let cursor = 0;
  for (let row = 0; row < lengthSegments; row++) {
    for (let column = 0; column < widthSegments; column++) {
      const a = row * rowSize + column;
      const b = a + rowSize;
      // Upward facing winding for side=(-tangent.z,0,tangent.x).
      indices[cursor++] = a;
      indices[cursor++] = a + 1;
      indices[cursor++] = b;
      indices[cursor++] = a + 1;
      indices[cursor++] = b + 1;
      indices[cursor++] = b;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('aCell', new THREE.BufferAttribute(cells, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const ownsMaterial = !options.material;
  const material = options.material ?? new THREE.MeshStandardMaterial({
    color: 0xc1dfe7,
    metalness: .82,
    roughness: .16
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'journey-continuous-river';
  // Vertex waves displace the supplied geometry, so its static bounds must
  // not cull the bank edges during a low-altitude camera bank.
  mesh.frustumCulled = false;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  mesh.renderOrder = 1;
  mesh.userData.journeyRiver = { lengthSegments, widthSegments, halfWidth: true };

  return {
    mesh,
    update(_time) {
      // The original sea shader is already animated by the parent's clock.
      // Geometry stays fixed in the world, preventing camera-relative sliding.
    },
    dispose() {
      geometry.dispose();
      if (ownsMaterial) material.dispose();
    }
  };
}
