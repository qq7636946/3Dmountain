"""Memory-only, resident low-resolution logo preview service (localhost:8789).

Run with the project Python runtime. No Blender process or model-file write is
performed. The precise Blender build remains a separate explicit operation.
"""
import argparse
import base64
import hashlib
import json
import math
import os
import struct
import sys
import time
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
DEPS = Path(os.environ.get('LOGO_SDF_DEPS', str(Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData/Local'))) / 'FinnovationLogoModel/python-deps')))
sys.path.insert(0, str(DEPS))
import numpy as np
import shapely
from shapely.geometry import Polygon
from skimage.measure import marching_cubes

DEFAULTS = {'radius': .020, 'segments': 24, 'profile': .5, 'angleLimit': 28,
            'clamp': 1, 'weightedNormals': 1, 'normalWeight': 50, 'smooth': 1}
RANGES = {'radius': (0, .045), 'segments': (1, 24), 'profile': (.15, 1),
          'angleLimit': (1, 89), 'clamp': (0, 1), 'weightedNormals': (0, 1),
          'normalWeight': (1, 100), 'smooth': (0, 1)}
INTEGERS = {'segments', 'clamp', 'weightedNormals', 'normalWeight', 'smooth'}
RESOLUTIONS = (160, 176, 192, 208, 224)
HALF_DEPTH = .074


def parameters(raw):
    if not isinstance(raw, dict):
        raise ValueError('預覽參數必須是 JSON 物件。')
    unknown = set(raw) - set(DEFAULTS)
    if unknown:
        raise ValueError('不支援的參數：' + ', '.join(sorted(unknown)))
    result = dict(DEFAULTS)
    for key, value in raw.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError(key + ' 必須是有限數字。')
        if not RANGES[key][0] <= value <= RANGES[key][1]:
            raise ValueError(key + ' 超出可用範圍。')
        if key in INTEGERS and value != int(value):
            raise ValueError(key + ' 必須是整數。')
        result[key] = int(value) if key in INTEGERS else float(value)
    return result


class Preview:
    def __init__(self, outline=None):
        source = Path(outline) if outline else ROOT / 'prototypes/index1-5/assets/logo/logo3d-outline.json'
        self.outline = json.loads(source.read_text(encoding='utf8'))
        self.distance = {}
        self.cache = OrderedDict()
        for resolution in RESOLUTIONS:
            self.distance[resolution] = self.prepare(resolution)

    def prepare(self, resolution):
        result = []
        step = 1. / resolution
        pad = max(step * 3., .005)
        for part in self.outline['parts']:
            polygon = Polygon(part['outer'], part.get('holes', []))
            if not polygon.is_valid or polygon.is_empty:
                raise ValueError('Invalid logo outline: ' + part['name'])
            x0, z0, x1, z1 = polygon.bounds
            x0 -= pad
            x1 += pad
            z0 -= pad
            z1 += pad
            xs = np.linspace(x0, x1, math.ceil((x1 - x0) / step) + 1, dtype=np.float32)
            zs = np.linspace(z0, z1, math.ceil((z1 - z0) / step) + 1, dtype=np.float32)
            depths = np.linspace(-HALF_DEPTH - pad, HALF_DEPTH + pad, math.ceil((2 * HALF_DEPTH + 2 * pad) / step) + 1, dtype=np.float32)
            xx, zz = np.meshgrid(xs, zs)
            shapely.prepare(polygon)
            inside = shapely.contains_xy(polygon, xx, zz)
            distance = np.asarray(shapely.distance(polygon.boundary, shapely.points(xx, zz)), dtype=np.float32)
            distance[inside] *= -1
            result.append({'name': part['name'], 'distance': distance,
                           'depths': depths, 'origin': (x0, -HALF_DEPTH - pad, z0),
                           'spacing': (float(zs[1] - zs[0]), float(depths[1] - depths[0]), float(xs[1] - xs[0]))})
        return result

    def generate(self, raw):
        started = time.perf_counter()
        values = parameters(raw)
        key = json.dumps(values, sort_keys=True, separators=(',', ':'))
        if key in self.cache:
            previous = self.cache.pop(key)
            self.cache[key] = previous
            return {**previous, 'cacheHit': True, 'elapsedMs': round((time.perf_counter() - started) * 1000., 2)}
        resolution = min(RESOLUTIONS, key=lambda r: abs(r - (160. + (values['segments'] - 1) * 64. / 23.)))
        radius, profile = values['radius'], values['profile']
        power = 1.1 + .9 * (profile - .15) / .35 if profile <= .5 else 2. * 32. ** ((profile - .5) / .5)
        if abs(profile - .5) < 1e-8:
            power = 2.
        parts = []
        triangle_count = 0
        for template in self.distance[resolution]:
            distance = template['distance']
            depths = template['depths']
            field = np.empty((distance.shape[0], len(depths), distance.shape[1]), dtype=np.float32)
            if radius <= 0:
                for i, depth in enumerate(depths):
                    field[:, i, :] = np.maximum(distance, abs(float(depth)) - HALF_DEPTH)
            else:
                qx = distance + radius
                positive_x = np.maximum(qx, 0)
                for i, depth in enumerate(depths):
                    qy = abs(float(depth)) - (HALF_DEPTH - radius)
                    positive_y = max(qy, 0.)
                    if power == 2.:
                        outer = np.hypot(positive_x, positive_y)
                    else:
                        scale = np.maximum(positive_x, positive_y)
                        safe = np.maximum(scale, np.float32(1e-20))
                        outer = scale * (np.power(positive_x / safe, power) + np.power(positive_y / safe, power)) ** (1. / power)
                    field[:, i, :] = outer + np.minimum(np.maximum(qx, qy), 0) - radius
            vertices, faces, _normals, _values = marching_cubes(field, level=0., spacing=template['spacing'], gradient_direction='ascent', allow_degenerate=False, method='lewiner')
            del field, _normals, _values
            # Array axes are SVG-height/depth/width. glTF is X/height/-depth.
            origin = template['origin']
            vertices = np.asarray(vertices[:, (2, 0, 1)], dtype=np.float32)
            vertices += np.asarray((origin[0], origin[2], origin[1]), dtype=np.float32)
            vertices[:, 2] *= -1.
            faces = np.asarray(faces, dtype=np.int32)
            triangles = vertices[faces]
            volume = np.einsum('ij,ij->i', triangles[:, 0], np.cross(triangles[:, 1], triangles[:, 2])).sum(dtype=np.float64) / 6.
            if volume < 0:
                faces = faces[:, (0, 2, 1)].copy()
                triangles = vertices[faces]
            face_normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
            areas = np.maximum(np.linalg.norm(face_normals, axis=1), np.float32(1e-20))
            if not values['smooth']:
                vertices = np.asarray(triangles.reshape((-1, 3)), dtype=np.float32)
                normals = np.repeat(face_normals / areas[:, None], 3, axis=0).astype(np.float32)
                indices = None
            else:
                if values['weightedNormals']:
                    # Similar optical intent to weighted normals: larger faces
                    # dominate, while exact planar cap normals remain planar.
                    weight = (areas / areas.max()) ** (values['normalWeight'] / 100.)
                    contribution = face_normals * weight[:, None]
                else:
                    contribution = face_normals / areas[:, None]
                repeated = np.repeat(contribution, 3, axis=0)
                flat_indices = faces.ravel()
                normals = np.stack([np.bincount(flat_indices, weights=repeated[:, axis], minlength=len(vertices)) for axis in range(3)], axis=1).astype(np.float32)
                normals /= np.maximum(np.linalg.norm(normals, axis=1)[:, None], np.float32(1e-20))
                if values['weightedNormals']:
                    caps = np.abs(np.abs(vertices[:, 2]) - HALF_DEPTH) < 1e-6
                    normals[caps] = 0
                    normals[caps, 2] = np.sign(vertices[caps, 2])
                indices = faces.astype(np.uint16 if len(vertices) < 65536 else np.uint32)
            parts.append({'name': template['name'], 'positions': vertices, 'normals': normals, 'indices': indices})
            triangle_count += len(faces)
        glb = make_glb(parts)
        value = {'ok': True, 'preview': True, 'revision': 'preview-' + hashlib.sha256(key.encode()).hexdigest()[:16],
                 'parameters': values, 'glb': base64.b64encode(glb).decode('ascii'),
                 'triangles': triangle_count, 'resolution': resolution}
        self.cache[key] = value
        while len(self.cache) > 32:
            self.cache.popitem(last=False)
        return {**value, 'cacheHit': False, 'elapsedMs': round((time.perf_counter() - started) * 1000., 2)}


def make_glb(parts):
    binary = bytearray()
    document = {'asset': {'version': '2.0', 'generator': 'FinnovationMemorySDFPreview'},
                'scene': 0, 'scenes': [{'nodes': list(range(len(parts)))}],
                'nodes': [], 'meshes': [], 'bufferViews': [], 'accessors': []}

    def accessor(array, kind, component, target, bounds=False):
        array = np.ascontiguousarray(array)
        offset = len(binary)
        payload = array.tobytes()
        binary.extend(payload)
        binary.extend(b'\0' * ((-len(binary)) % 4))
        view = len(document['bufferViews'])
        document['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(payload), 'target': target})
        entry = {'bufferView': view, 'byteOffset': 0, 'componentType': component,
                 'count': int(array.shape[0]), 'type': kind}
        if bounds:
            entry['min'] = array.min(axis=0).tolist()
            entry['max'] = array.max(axis=0).tolist()
        index = len(document['accessors'])
        document['accessors'].append(entry)
        return index

    for index, part in enumerate(parts):
        position = accessor(part['positions'], 'VEC3', 5126, 34962, True)
        normal = accessor(part['normals'], 'VEC3', 5126, 34962)
        primitive = {'attributes': {'POSITION': position, 'NORMAL': normal}, 'mode': 4}
        if part['indices'] is not None:
            indices = part['indices']
            primitive['indices'] = accessor(indices.reshape(-1), 'SCALAR', 5123 if indices.dtype == np.uint16 else 5125, 34963)
        document['meshes'].append({'name': part['name'], 'primitives': [primitive]})
        document['nodes'].append({'name': part['name'], 'mesh': index})
    document['buffers'] = [{'byteLength': len(binary)}]
    encoded = json.dumps(document, separators=(',', ':'), allow_nan=False).encode('utf8')
    encoded += b' ' * ((-len(encoded)) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    return struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(binary), 0x004E4942) + binary


PREVIEW = None


class Handler(BaseHTTPRequestHandler):
    server_version = 'FinnovationPreview/1'

    def allowed_origin(self):
        origin = self.headers.get('Origin')
        if not origin:
            return True
        try:
            parsed = urlsplit(origin)
            return parsed.scheme in ('http', 'https') and parsed.hostname in ('127.0.0.1', 'localhost') and not parsed.username and not parsed.password
        except ValueError:
            return False

    def request_allowed(self):
        try:
            host = urlsplit('http://' + self.headers.get('Host', '')).hostname
        except ValueError:
            host = None
        return host in ('127.0.0.1', 'localhost') and self.allowed_origin()

    def reply(self, status, value):
        payload = json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Vary', 'Origin')
        if self.headers.get('Origin') and self.allowed_origin():
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def do_OPTIONS(self):
        return self.reply(200 if self.request_allowed() else 403, {'ok': self.request_allowed()})

    def do_GET(self):
        if not self.request_allowed():
            return self.reply(403, {'ok': False, 'error': '只接受本機網站的預覽請求。'})
        if urlsplit(self.path).path != '/status':
            return self.reply(404, {'ok': False, 'error': '找不到此介面。'})
        return self.reply(200, {'ready': True, 'preview': True, 'memoryOnly': True, 'cacheEntries': len(PREVIEW.cache), 'cacheLimit': 32, 'resolutions': RESOLUTIONS})

    def do_POST(self):
        if not self.request_allowed():
            # Drain only a small declared body so ordinary rejected requests
            # receive a clean HTTP 403 rather than a TCP reset on Windows.
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if 0 < length <= 16384 and not self.headers.get('Transfer-Encoding'):
                    self.rfile.read(length)
            except (ValueError, OSError):
                pass
            return self.reply(403, {'ok': False, 'error': '只接受本機網站的預覽請求。'})
        if urlsplit(self.path).path != '/preview':
            return self.reply(404, {'ok': False, 'error': '找不到此介面。'})
        try:
            if self.headers.get('Transfer-Encoding'):
                raise ValueError('不支援串流請求。')
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 16384 or self.headers.get_content_type() != 'application/json':
                raise ValueError('請傳送 16 KB 以內的 JSON 參數。')
            value = json.loads(self.rfile.read(length).decode('utf8'))
            return self.reply(200, PREVIEW.generate(value))
        except (ValueError, UnicodeError) as error:
            return self.reply(422, {'ok': False, 'error': str(error)[:800]})
        except Exception as error:
            print('PREVIEW_ERROR', repr(error), flush=True)
            return self.reply(500, {'ok': False, 'error': '預覽產生失敗：' + str(error)[:400]})


def main():
    global PREVIEW
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--benchmark', action='store_true')
    parser.add_argument('--outline')
    args = parser.parse_args()
    warmed = time.perf_counter()
    PREVIEW = Preview(args.outline)
    print('PREVIEW_READY', json.dumps({'warmupMs': round((time.perf_counter() - warmed) * 1000., 2)}), flush=True)
    if args.benchmark:
        cases = [dict(DEFAULTS, radius=.014, profile=.5, segments=14),
                 dict(DEFAULTS, radius=.045, profile=.5, segments=24),
                 dict(DEFAULTS, radius=.045, profile=1, segments=24),
                 dict(DEFAULTS, radius=.014, profile=.5, segments=14, smooth=0),
                 dict(DEFAULTS, radius=.014, profile=.5, segments=14)]
        for case in cases:
            result = PREVIEW.generate(case)
            print('PREVIEW_BENCHMARK', json.dumps({k: v for k, v in result.items() if k != 'glb'}), flush=True)
        return
    print('Memory-only logo preview at http://127.0.0.1:8789', flush=True)
    HTTPServer(('127.0.0.1', 8789), Handler).serve_forever()


if __name__ == '__main__':
    main()
