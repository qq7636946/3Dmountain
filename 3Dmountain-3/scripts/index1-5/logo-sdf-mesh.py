"""Generate a closed rounded extrusion from the normalized logo SVG polygons.

External Python (NumPy, Shapely and scikit-image), not Blender's interpreter.
Usage: python logo-sdf-mesh.py --params settings.json --out mesh.npz --deps DIR
The NPZ uses Blender coordinates: X horizontal, Y depth, Z SVG vertical.
"""
import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOCAL_DEPS = Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData/Local'))) / 'FinnovationLogoModel/python-deps'


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--params', help='JSON file; omit to read stdin')
    parser.add_argument('--out', required=True, help='Output NPZ file')
    parser.add_argument('--outline', default=str(ROOT / 'prototypes/index1-5/assets/logo/logo3d-outline.json'))
    default_deps = LOCAL_DEPS if LOCAL_DEPS.is_dir() else ROOT / '.qa/logo-model-runtime/pythondeps'
    parser.add_argument('--deps', default=os.environ.get('LOGO_SDF_DEPS', str(default_deps)))
    parser.add_argument('--resolution', type=int, help='Global-height samples; default 320 + 16*segments')
    return parser.parse_args()


def main():
    args = arguments()
    if args.deps:
        sys.path.insert(0, args.deps)
    import numpy as np
    import shapely
    from shapely.geometry import Polygon
    from skimage.measure import marching_cubes

    started = time.perf_counter()
    parameters = json.loads(Path(args.params).read_text(encoding='utf-8-sig')) if args.params else json.load(sys.stdin)
    if not isinstance(parameters, dict):
        raise ValueError('Parameters must be an object')
    radius = float(parameters.get('radius', .020))
    profile = float(parameters.get('profile', .5))
    segments = int(parameters.get('segments', 24))
    thickness = float(parameters.get('thickness', .148))
    if not all(math.isfinite(v) for v in (radius, profile, thickness)):
        raise ValueError('Model parameters must be finite')
    if not 0 < radius <= .045 or not .15 <= profile <= 1 or not 1 <= segments <= 24 or not .02 <= thickness <= .6:
        raise ValueError('Model parameters are outside their supported ranges; radius 0 uses the original mesh')
    # The caller normally uses fixed .148 thickness and keeps live depth scaling.
    radius = min(radius, thickness * .499)
    resolution = min(900, max(240, args.resolution)) if args.resolution else 320 + segments * 16
    step = 1.0 / resolution
    power = 1.1 + .9 * (profile - .15) / .35 if profile <= .5 else 2.0 * (32.0 ** ((profile - .5) / .5))
    if abs(profile - .5) < 1e-8:
        power = 2.0
    half = thickness * .5
    pad = max(step * 3, .005)
    source = json.loads(Path(args.outline).read_text(encoding='utf8'))
    arrays = {}
    report = {'algorithm': 'svg-sdf-roundover-v1', 'radius': radius, 'profile': profile,
              'profilePower': power, 'segments': segments, 'resolution': resolution,
              'thickness': thickness, 'parts': []}

    for index, part in enumerate(source['parts']):
        part_started = time.perf_counter()
        polygon = Polygon(part['outer'], part.get('holes', []))
        if not polygon.is_valid or polygon.is_empty:
            raise ValueError('Invalid supplied outline: ' + part['name'])
        x0, z0, x1, z1 = polygon.bounds
        x0, x1, z0, z1 = x0 - pad, x1 + pad, z0 - pad, z1 + pad
        xs = np.linspace(x0, x1, int(math.ceil((x1 - x0) / step)) + 1, dtype=np.float32)
        zs = np.linspace(z0, z1, int(math.ceil((z1 - z0) / step)) + 1, dtype=np.float32)
        depths = np.linspace(-half - pad, half + pad, int(math.ceil((thickness + 2 * pad) / step)) + 1, dtype=np.float32)
        xx, zz = np.meshgrid(xs, zs)
        shapely.prepare(polygon)
        inside = shapely.contains_xy(polygon, xx, zz)
        points = shapely.points(xx, zz)
        distance = np.asarray(shapely.distance(polygon.boundary, points), dtype=np.float32)
        del points
        distance[inside] *= -1
        qx = distance + np.float32(radius)
        positive_x = np.maximum(qx, 0)
        # Slice along depth to avoid several full-volume broadcast temporaries.
        field = np.empty((len(zs), len(depths), len(xs)), dtype=np.float32)
        for d, depth in enumerate(depths):
            qy = float(abs(depth) - (half - radius))
            positive_y = max(qy, 0.)
            if power == 2:
                outer = np.hypot(positive_x, positive_y)
            else:
                # Stable Lp norm, including the nearly square power-64 case.
                scale = np.maximum(positive_x, positive_y)
                safe = np.maximum(scale, np.float32(1e-20))
                outer = scale * (np.power(positive_x / safe, power) + np.power(positive_y / safe, power)) ** (1. / power)
            field[:, d, :] = outer + np.minimum(np.maximum(qx, qy), 0) - radius
        del xx, zz, distance, inside, qx, positive_x
        if field.min() >= 0 or field.max() <= 0:
            raise ValueError('No closed surface for ' + part['name'])
        spacing = (float(zs[1] - zs[0]), float(depths[1] - depths[0]), float(xs[1] - xs[0]))
        vertices, faces, _normals, _values = marching_cubes(field, level=0., spacing=spacing,
                                                          gradient_direction='ascent',
                                                          allow_degenerate=False, method='lewiner')
        del field, _normals, _values
        # marching-cubes array axes Z/Y/X become Blender X/Y/Z.
        vertices = np.asarray(vertices[:, (2, 1, 0)], dtype=np.float32)
        vertices += np.asarray((x0, -half - pad, z0), dtype=np.float32)
        faces = np.asarray(faces, dtype=np.int32)
        a, b, c = (vertices[faces[:, k]] for k in range(3))
        signed_volume = float(np.einsum('ij,ij->i', a, np.cross(b, c)).sum(dtype=np.float64) / 6.)
        if signed_volume < 0:
            faces = faces[:, (0, 2, 1)].copy()
            signed_volume *= -1
        normals = np.zeros_like(vertices)
        triangles = vertices[faces]
        face_normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        for k in range(3):
            np.add.at(normals, faces[:, k], face_normals)
        lengths = np.linalg.norm(normals, axis=1)
        normals /= np.maximum(lengths[:, None], np.float32(1e-20))
        prefix = f'part{index}'
        arrays[prefix + '_vertices'] = vertices
        arrays[prefix + '_faces'] = faces
        arrays[prefix + '_normals'] = normals
        item = {'name': part['name'], 'prefix': prefix, 'vertices': len(vertices),
                'triangles': len(faces), 'signedVolume': signed_volume,
                'seconds': round(time.perf_counter() - part_started, 3)}
        report['parts'].append(item)
        del vertices, faces, normals, triangles, face_normals, a, b, c
    report['seconds'] = round(time.perf_counter() - started, 3)
    arrays['metadata'] = np.asarray(json.dumps(report, ensure_ascii=False))
    destination = Path(args.out)
    destination.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(destination, **arrays)
    destination.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({'ok': True, **report}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
