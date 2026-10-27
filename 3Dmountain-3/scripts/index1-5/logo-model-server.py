"""Local-only Blender modeling bridge for index1-5's logo parameter panel.

Run with Blender, not a normal Python interpreter:
  blender.exe --background --factory-startup --python scripts/index1-5/logo-model-server.py

The HTTP handler runs on Blender's main thread. Only bounded numeric modeling
parameters are accepted; clients cannot supply code, paths, or output names.
"""
import json
import math
import os
import tempfile
import time
import sys
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import bpy
import bmesh
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'prototypes/index1-5/assets/logo'
SOURCE = ASSETS / 'logo3d-blender-v1.blend'
MANIFEST = ASSETS / 'logo3d-current.json'
PYTHON = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
SDF_SCRIPT = Path(__file__).resolve().with_name('logo-sdf-mesh.py')
SDF_DEPS = Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData/Local'))) / 'FinnovationLogoModel/python-deps'
DEFAULTS = {'radius': .020, 'segments': 24, 'profile': .5, 'angleLimit': 28,
            'clamp': 1, 'weightedNormals': 1, 'normalWeight': 50, 'smooth': 1}
RANGES = {'radius': (0, .045), 'segments': (1, 24), 'profile': (.15, 1),
          'angleLimit': (1, 89), 'clamp': (0, 1), 'weightedNormals': (0, 1),
          'normalWeight': (1, 100), 'smooth': (0, 1)}
INTEGERS = {'segments', 'clamp', 'weightedNormals', 'normalWeight', 'smooth'}


class ModelError(ValueError):
    pass


def validate_parameters(value):
    if not isinstance(value, dict):
        raise ModelError('建模參數必須是 JSON 物件。')
    unknown = set(value) - set(DEFAULTS)
    if unknown:
        raise ModelError('含有不支援的建模欄位：' + ', '.join(sorted(unknown)))
    result = dict(DEFAULTS)
    for key, raw in value.items():
        if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
            raise ModelError(key + ' 必須是有限數字。')
        lo, hi = RANGES[key]
        if not lo <= raw <= hi:
            raise ModelError(f'{key} 必須介於 {lo} 與 {hi}。')
        if key in INTEGERS and raw != int(raw):
            raise ModelError(key + ' 必須是整數。')
        result[key] = int(raw) if key in INTEGERS else float(raw)
    return result


def current_manifest():
    try:
        value = json.loads(MANIFEST.read_text(encoding='utf8'))
        value['parameters'] = validate_parameters(value.get('parameters', {}))
        if value.get('asset') not in ('logo3d-blender-v1.glb', 'logo3d-tuned.glb'):
            raise ModelError('Unknown current asset')
        return value
    except (OSError, ValueError, TypeError):
        return {'asset': 'logo3d-blender-v1.glb', 'revision': 'blender-v1',
                'parameters': dict(DEFAULTS)}


def write_manifest(value):
    temporary = ASSETS / '.logo3d-current.json.tmp'
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf8')
    os.replace(temporary, MANIFEST)


def audit_objects(objects):
    deps = bpy.context.evaluated_depsgraph_get()
    results = []
    for obj in objects:
        evaluated = obj.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        bm = bmesh.new()
        try:
            mesh.calc_loop_triangles()
            bm.from_mesh(mesh)
            half_depth = max(abs(v.co.y) for v in bm.verts)
            inverted_caps = sum(
                all(abs(abs(v.co.y)-half_depth) < 2e-7 for v in f.verts)
                and abs(f.normal.y) > .99
                and f.normal.y * sum(v.co.y for v in f.verts) < 0
                for f in bm.faces)
            item = {'name': obj.name, 'vertices': len(mesh.vertices),
                    'triangles': len(mesh.loop_triangles),
                    'boundary_edges': sum(e.is_boundary for e in bm.edges),
                    'nonmanifold_edges': sum(not e.is_manifold for e in bm.edges),
                    'loose_edges': sum(e.is_wire for e in bm.edges),
                    'degenerate_faces': sum(f.calc_area() < 1e-12 for f in bm.faces),
                    'inverted_caps': inverted_caps,
                    'signed_volume': bm.calc_volume(signed=True),
                    'depth_levels': len({round(v.co.y, 6) for v in mesh.vertices})}
            baseline = float(obj.get('unbeveled_volume', item['signed_volume']))
            item['roundover_volume_change'] = (baseline-item['signed_volume']) / baseline
            item['roundover'] = dict(obj.get('roundover', {}))
            if any(item[k] for k in ('boundary_edges', 'nonmanifold_edges', 'loose_edges', 'degenerate_faces', 'inverted_caps')) or item['signed_volume'] <= 0:
                raise ModelError('此組參數在尖端產生無效網格，請降低倒角半徑或調整圓角輪廓。' + json.dumps(item, ensure_ascii=False))
            params = obj.get('model_parameters', {})
            if params.get('radius', 0) >= .003 and params.get('profile', .5) < .99 and (item['depth_levels'] < 4 or item['roundover_volume_change'] < 1e-6):
                raise ModelError('倒角未有效改變形體，已保留原模型；請調整倒角半徑或輪廓。')
            results.append(item)
        finally:
            bm.free()
            evaluated.to_mesh_clear()
    return {'source': 'logo3D.svg', 'software': bpy.app.version_string, 'parts': results}


def rounded_parts(parameters):
    if parameters['radius'] == 0:
        return {}, {'algorithm': 'unbeveled-original'}
    if not PYTHON.is_file() or not (SDF_DEPS / 'skimage').is_dir():
        raise ModelError('圓角建模執行環境未就緒，請先執行 setup-logo-model-runtime.ps1。')
    with tempfile.TemporaryDirectory(prefix='finnovation-roundover-') as temporary:
        folder = Path(temporary)
        settings, output = folder / 'parameters.json', folder / 'rounded.npz'
        settings.write_text(json.dumps(parameters), encoding='utf8')
        process = subprocess.run([str(PYTHON), str(SDF_SCRIPT), '--params', str(settings),
                                  '--out', str(output), '--deps', str(SDF_DEPS)],
                                 capture_output=True, text=True, encoding='utf8', timeout=45,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if process.returncode or not output.is_file():
            raise ModelError('圓角曲面重建失敗：' + process.stderr[-800:])
        with np.load(output, allow_pickle=False) as arrays:
            metadata = json.loads(str(arrays['metadata']))
            parts = {item['name']: (arrays[item['prefix']+'_vertices'].copy(), arrays[item['prefix']+'_faces'].copy()) for item in metadata['parts']}
        return parts, metadata


def build_model(parameters):
    parameters = validate_parameters(parameters)
    if not SOURCE.is_file():
        raise ModelError('找不到 Blender 原始模型 logo3d-blender-v1.blend。')
    # Always restart from the immutable authoring master, never from a previous
    # tuned result. This also releases data from the preceding build.
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    originals = bpy.data.collections.get('Editable bevel construction')
    if not originals:
        raise ModelError('Blender 原檔缺少可編輯的倒角建構集合。')
    sources = [bpy.data.objects.get(n) for n in ('logo_body_editable', 'logo_sail_editable')]
    if any(obj is None or obj.type != 'MESH' for obj in sources):
        raise ModelError('Blender 原檔缺少主體或葉片的原始網格。')
    # Only the new two export solids stay visible. The editable source objects
    # remain in the saved blend, with their parameterized modifiers intact.
    for obj in list(bpy.context.scene.objects):
        obj.select_set(False)
        if obj in sources or obj.type != 'MESH':
            continue
        bpy.data.objects.remove(obj, do_unlink=True)
    collection = bpy.data.collections.new('Tuned web export')
    bpy.context.scene.collection.children.link(collection)
    rounded, roundover = rounded_parts(parameters)
    result = []
    for source in sources:
        obj = source.copy()
        obj.name = source.name.replace('_editable', '')
        if obj.name in rounded:
            vertices, faces = rounded[obj.name]
            obj.data = bpy.data.meshes.new(obj.name+'_rounded_surface')
            obj.data.from_pydata(vertices.tolist(), [], faces.tolist())
            obj.data.update()
        else:
            obj.data = source.data.copy()
        collection.objects.link(obj)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.hide_set(False)
        for other in bpy.context.selected_objects:
            other.select_set(False)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        baseline_mesh = bmesh.new()
        try:
            baseline_mesh.from_mesh(source.data)
            obj['unbeveled_volume'] = baseline_mesh.calc_volume(signed=True)
        finally:
            baseline_mesh.free()
        for modifier in list(obj.modifiers):
            if modifier.type == 'BEVEL':
                obj.modifiers.remove(modifier)
        if parameters['radius'] > 0:
            # Simplify the sampled surface before evaluating optical normals.
            # Avoid planar dissolve: giant non-convex n-gons can open slivers.
            reduced = obj.modifiers.new('Rounded surface web topology', 'DECIMATE')
            reduced.decimate_type = 'COLLAPSE'
            reduced.ratio = .075
            reduced.use_collapse_triangulate = True
            bpy.ops.object.modifier_move_up(modifier=reduced.name)
            bpy.ops.object.modifier_apply(modifier=reduced.name)
        weighted = next((m for m in obj.modifiers if m.type == 'WEIGHTED_NORMAL'), None)
        if weighted:
            weighted.keep_sharp = True
            weighted.weight = parameters['normalWeight']
        if not parameters['weightedNormals']:
            for modifier in list(obj.modifiers):
                if modifier.type == 'WEIGHTED_NORMAL':
                    obj.modifiers.remove(modifier)
        bm = bmesh.new()
        try:
            bm.from_mesh(obj.data)
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
            bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-5)
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            bm.to_mesh(obj.data)
        finally:
            bm.free()
        for face in obj.data.polygons:
            face.use_smooth = bool(parameters['smooth'])
        obj['model_parameters'] = parameters
        obj['roundover'] = {k: v for k, v in roundover.items() if k != 'parts'}
        obj['source_svg'] = 'logo3D.svg'
        result.append(obj)
    originals.hide_render = originals.hide_viewport = True
    bpy.context.view_layer.update()
    audit = audit_objects(result)
    revision = str(time.time_ns())
    manifest = {'asset': 'logo3d-tuned.glb', 'revision': revision, 'parameters': parameters}
    # Every build is validated before any public asset changes. Staging files
    # live on the same volume as their destinations, so replace is atomic.
    stage = Path(tempfile.mkdtemp(prefix='.logo3d-build-', dir=str(ASSETS)))
    try:
        for obj in bpy.context.scene.objects:
            obj.select_set(False)
        for obj in result:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = result[0]
        bpy.ops.export_scene.gltf(filepath=str(stage / 'logo3d-tuned.glb'), export_format='GLB',
                                  use_selection=True, export_apply=True, export_yup=True,
                                  export_normals=True, export_tangents=False,
                                  export_materials='NONE', export_extras=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(stage / 'logo3d-tuned.blend'))
        (stage / 'logo3d-tuned-audit.json').write_text(json.dumps(audit, indent=2), encoding='utf8')
        for name in ('logo3d-tuned.glb', 'logo3d-tuned.blend', 'logo3d-tuned-audit.json'):
            os.replace(stage / name, ASSETS / name)
        write_manifest(manifest)
    finally:
        # Only known files in the fresh staging directory can be removed.
        for name in ('logo3d-tuned.glb', 'logo3d-tuned.blend', 'logo3d-tuned-audit.json', 'logo3d-tuned.blend1'):
            candidate = stage / name
            if candidate.is_file():
                candidate.unlink()
        try:
            stage.rmdir()
        except OSError:
            pass
    return {'ok': True, **manifest, 'audit': audit}


class Handler(BaseHTTPRequestHandler):
    server_version = 'FinnovationBlender/1'

    def allowed_origin(self):
        origin = self.headers.get('Origin')
        if not origin:
            return True
        try:
            parsed = urlsplit(origin)
            return parsed.scheme in ('http', 'https') and parsed.hostname in ('localhost', '127.0.0.1') and not parsed.username and not parsed.password
        except ValueError:
            return False

    def request_allowed(self):
        try:
            host = urlsplit('http://' + self.headers.get('Host', '')).hostname
        except ValueError:
            host = None
        return host in ('localhost', '127.0.0.1') and self.allowed_origin()

    def reply(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Vary', 'Origin')
        origin = self.headers.get('Origin')
        if origin and self.allowed_origin():
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        if not self.request_allowed():
            return self.reply(403, {'ok': False, 'error': '只接受本機網站的建模請求。'})
        return self.reply(200, {'ok': True})

    def do_GET(self):
        if not self.request_allowed():
            return self.reply(403, {'ok': False, 'error': '只接受本機網站的建模請求。'})
        if urlsplit(self.path).path != '/status':
            return self.reply(404, {'ok': False, 'error': '找不到此介面。'})
        return self.reply(200, {'ready': SOURCE.is_file(), 'blender': bpy.app.version_string,
                                **current_manifest(), 'defaults': DEFAULTS, 'ranges': RANGES})

    def do_POST(self):
        if not self.request_allowed():
            return self.reply(403, {'ok': False, 'error': '只接受本機網站的建模請求。'})
        endpoint = urlsplit(self.path).path
        if endpoint not in ('/build', '/reset'):
            return self.reply(404, {'ok': False, 'error': '找不到此介面。'})
        try:
            if self.headers.get('Transfer-Encoding'):
                raise ModelError('不支援串流請求。')
            length = int(self.headers.get('Content-Length', '0'))
            if length < 0 or length > 16384:
                raise ModelError('建模參數大小超過限制。')
            if length and self.headers.get_content_type() != 'application/json':
                raise ModelError('請以 application/json 傳送參數。')
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode('utf8')) if raw else {}
            if endpoint == '/reset':
                if payload not in ({}, None):
                    raise ModelError('還原請求不接受額外參數。')
                return self.reply(200, build_model(DEFAULTS))
            return self.reply(200, build_model(payload))
        except (ModelError, ValueError, UnicodeError) as error:
            return self.reply(422, {'ok': False, 'error': str(error)[:1400]})
        except Exception as error:
            print('LOGO_MODEL_ERROR', repr(error), flush=True)
            return self.reply(500, {'ok': False, 'error': 'Blender 建模失敗，原模型已保留。' + str(error)[:500]})


if __name__ == '__main__':
    print('FINNOVATION Blender model service on http://127.0.0.1:8788', flush=True)
    HTTPServer(('127.0.0.1', 8788), Handler).serve_forever()
