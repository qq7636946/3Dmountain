/** Exact LOGO geometry construction shared by the worker and its main-thread fallback. */
export function buildLogoGeometry(THREE, utils, input) {
  const logoShapes = input.shapes.map(json => new THREE.Shape().fromJSON(json));
  const blueShapes = (input.blueShapes || []).map(json => new THREE.Shape().fromJSON(json));
  const config = input.config;
  if (!logoShapes.length) throw new Error('Logo geometry requires at least one filled shape.');
  const box = new THREE.Box2();
  for (const shape of [...logoShapes, ...blueShapes]) {
    for (const point of shape.extractPoints(48).shape) box.expandByPoint(point);
  }
  const size = box.getSize(new THREE.Vector2());
  const span = (input.wordmark ? size.y : Math.max(size.x, size.y)) || 1;
  const extrude = shapes => new THREE.ExtrudeGeometry(shapes, {
    depth: span * .06,
    curveSegments: Math.max(8, Math.round(config.curveSegments * (input.wordmark ? .5 : 1))),
    bevelEnabled: true,
    bevelThickness: config.bevel * span,
    bevelSize: Math.min(.0045, config.bevelSize) * span,
    bevelOffset: 0,
    bevelSegments: Math.round(config.bevelSegments)
  });
  let geometry;
  if (blueShapes.length) {
    const parts = [extrude(logoShapes), extrude(blueShapes)].map(part => {
      const plain = part.index ? part.toNonIndexed() : part;
      if (plain !== part) part.dispose();
      plain.clearGroups();
      return plain;
    });
    try { geometry = utils.mergeGeometries(parts, true); }
    finally { parts.forEach(part => part.dispose()); }
    if (!geometry) throw new Error('Logo geometry parts could not be merged.');
  } else geometry = extrude(logoShapes);
  if (geometry.index) {
    const indexed = geometry;
    geometry = indexed.toNonIndexed();
    indexed.dispose();
  }
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position') geometry.deleteAttribute(name);
  }
  geometry.scale(1, -1, 1);
  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const value = positions[i + 3 + k];
      positions[i + 3 + k] = positions[i + 6 + k];
      positions[i + 6 + k] = value;
    }
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  geometry.boundingBox.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);
  const scale = 1 / Math.max(1e-6, geometry.boundingBox.max.y - geometry.boundingBox.min.y);
  geometry.scale(scale, scale, scale * config.depth);
  geometry.computeVertexNormals();
  const beforeCrease = geometry;
  geometry = utils.toCreasedNormals(geometry, Math.PI / 3);
  if (geometry !== beforeCrease) beforeCrease.dispose();
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const uv = new Float32Array(position.count * 2);
  for (let face = 0; face < position.count; face += 3) {
    const nx = Math.abs(normal.getX(face)), ny = Math.abs(normal.getY(face)), nz = Math.abs(normal.getZ(face));
    for (let vertex = face; vertex < face + 3; vertex++) {
      const x = position.getX(vertex) * 2.4, y = position.getY(vertex) * 2.4, z = position.getZ(vertex) * 2.4;
      uv[vertex * 2] = nz >= nx && nz >= ny ? x : nx >= ny ? y : x;
      uv[vertex * 2 + 1] = nz >= nx && nz >= ny ? y : z;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.computeBoundingBox();
  const aspect = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
  const blueGroup = blueShapes.length ? geometry.groups.find(group => group.materialIndex === 1) : null;
  let blueBox = null;
  if (blueGroup) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let vertex = blueGroup.start; vertex < blueGroup.start + blueGroup.count; vertex++) {
      const x = position.getX(vertex), y = position.getY(vertex);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    blueBox = new THREE.Vector4(x0 * 2.4, x1 * 2.4, y0 * 2.4, y1 * 2.4);
  }
  return { geometry, edgeGeometry: new THREE.EdgesGeometry(geometry, 28), aspect, blueBox, hasBlueGroup: Boolean(blueGroup) };
}

function packAttribute(attribute) {
  return { array: attribute.array, itemSize: attribute.itemSize, normalized: attribute.normalized,
    usage: attribute.usage, gpuType: attribute.gpuType };
}
function packGeometry(geometry) {
  return {
    attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, packAttribute(attribute)])),
    index: geometry.index ? packAttribute(geometry.index) : null,
    groups: geometry.groups.map(group => ({ ...group })),
    drawRange: { ...geometry.drawRange },
    boundingBox: geometry.boundingBox ? { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() } : null,
    boundingSphere: geometry.boundingSphere ? { center: geometry.boundingSphere.center.toArray(), radius: geometry.boundingSphere.radius } : null
  };
}
export function packLogoGeometry(result) {
  return { geometry: packGeometry(result.geometry), edgeGeometry: packGeometry(result.edgeGeometry),
    aspect: result.aspect, blueBox: result.blueBox ? result.blueBox.toArray() : null, hasBlueGroup: result.hasBlueGroup };
}
export function logoGeometryTransfers(result) {
  const buffers = new Set();
  for (const geometry of [result.geometry, result.edgeGeometry]) {
    for (const attribute of Object.values(geometry.attributes)) buffers.add(attribute.array.buffer);
    if (geometry.index) buffers.add(geometry.index.array.buffer);
  }
  return [...buffers];
}
function unpackGeometry(THREE, packed) {
  const geometry = new THREE.BufferGeometry();
  const attribute = data => {
    const result = new THREE.BufferAttribute(data.array, data.itemSize, data.normalized);
    result.setUsage(data.usage);
    if (data.gpuType !== undefined) result.gpuType = data.gpuType;
    return result;
  };
  for (const [name, data] of Object.entries(packed.attributes)) geometry.setAttribute(name, attribute(data));
  if (packed.index) geometry.setIndex(attribute(packed.index));
  for (const group of packed.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.setDrawRange(packed.drawRange.start, packed.drawRange.count);
  if (packed.boundingBox) geometry.boundingBox = new THREE.Box3(new THREE.Vector3().fromArray(packed.boundingBox.min), new THREE.Vector3().fromArray(packed.boundingBox.max));
  if (packed.boundingSphere) geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3().fromArray(packed.boundingSphere.center), packed.boundingSphere.radius);
  return geometry;
}
export function unpackLogoGeometry(THREE, packed) {
  return { geometry: unpackGeometry(THREE, packed.geometry), edgeGeometry: unpackGeometry(THREE, packed.edgeGeometry),
    aspect: packed.aspect, blueBox: packed.blueBox ? new THREE.Vector4().fromArray(packed.blueBox) : null, hasBlueGroup: packed.hasBlueGroup };
}
