// Use the same Three.js revision as the page, with its original triangle accumulation order.
import { BufferAttribute, BufferGeometry } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

self.onmessage = ({ data: { positions, indices } }) => {
  try {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const normals = geometry.attributes.normal.array;
    self.postMessage({
      result: {
        normals,
        boxMin: geometry.boundingBox.min.toArray(),
        boxMax: geometry.boundingBox.max.toArray(),
        sphereCenter: geometry.boundingSphere.center.toArray(),
        sphereRadius: geometry.boundingSphere.radius
      }
    }, [normals.buffer]);
  } catch {
    self.postMessage({ result: null });
  }
};
