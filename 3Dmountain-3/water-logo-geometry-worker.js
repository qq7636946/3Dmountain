import { Box2, Vector2, Vector3, Vector4, Shape, ExtrudeGeometry, BufferAttribute, EdgesGeometry } from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildLogoGeometry, packLogoGeometry, logoGeometryTransfers } from './water-logo-geometry.js';
const THREE = { Box2, Vector2, Vector3, Vector4, Shape, ExtrudeGeometry, BufferAttribute, EdgesGeometry };
const utils = { mergeGeometries, toCreasedNormals };
self.onmessage = ({ data }) => {
  const { id, input } = data;
  let result;
  try {
    result = buildLogoGeometry(THREE, utils, input);
    const packed = packLogoGeometry(result);
    self.postMessage({ id, ok: true, result: packed }, logoGeometryTransfers(packed));
  } catch (error) {
    self.postMessage({ id, ok: false, error: { name: error.name, message: error.message } });
  } finally {
    result?.geometry.dispose();
    result?.edgeGeometry.dispose();
  }
};
