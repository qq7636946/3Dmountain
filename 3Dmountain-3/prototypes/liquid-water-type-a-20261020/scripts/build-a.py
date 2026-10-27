"""Build one original, closed water-sculpture A; no existing project is edited.

Run: blender --background --python scripts/build-a.py
Coordinates in exported glTF: X across, Y up, Z front/back, base Y=0.
The source outline is original and is not derived from a commercial typeface.
"""
import bpy
import bmesh
import json
import math
import struct
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# CCW outside; the triangular counter has opposite winding. The open lower
# counter between the two legs belongs to the outside contour, not a filled face.
OUTSIDE = [
    (-1.02, 0.00), (-0.61, 0.00), (-0.403, 0.69),
    (0.405, 0.69), (0.614, 0.00), (1.02, 0.00),
    (0.29, 2.48), (-0.27, 2.48),
]
COUNTER = [(-0.282, 1.09), (0.282, 1.09), (0.013, 2.035)]

def area(points):
    return sum(a[0] * b[1] - b[0] * a[1]
               for a, b in zip(points, points[1:] + points[:1])) / 2

def rounded_contour(points, radii, steps=7):
    """Quadratic fillets keep intentional readable strokes and a real counter."""
    result = []
    for i, corner in enumerate(points):
        current = Vector(corner)
        before = Vector(points[i - 1]) - current
        after = Vector(points[(i + 1) % len(points)]) - current
        radius = min(radii[i], before.length * .27, after.length * .27)
        entry = current + before.normalized() * radius
        leave = current + after.normalized() * radius
        for step in range(steps + 1):
            t = step / steps
            q = (1-t)**2 * entry + 2*(1-t)*t*current + t*t*leave
            result.append((q.x, q.y))
    return result

outer = rounded_contour(OUTSIDE, [.12, .10, .10, .10, .10, .13, .15, .15])
inner = rounded_contour(COUNTER, [.08, .08, .13])
if area(outer) < 0:
    outer.reverse()
if area(inner) > 0:
    inner.reverse()

curve = bpy.data.curves.new("A_original_outline", "CURVE")
curve.dimensions = "2D"
curve.resolution_u = 12
curve.fill_mode = "BOTH"
curve.extrude = .145
curve.bevel_depth = .108
curve.bevel_resolution = 6
for points in (outer, inner):
    spline = curve.splines.new("POLY")
    spline.points.add(len(points)-1)
    for point, xy in zip(spline.points, points):
        point.co = (*xy, 0, 1)
    spline.use_cyclic_u = True

letter = bpy.data.objects.new("Water_A", curve)
bpy.context.collection.objects.link(letter)
bpy.context.view_layer.objects.active = letter
letter.select_set(True)
bpy.ops.object.convert(target="MESH")

# Isotropic remesh closes the junctions of filled caps and curved side walls.
remesh = letter.modifiers.new("Sealed_isotropic_water_surface", "REMESH")
remesh.mode = "VOXEL"
remesh.voxel_size = .016
remesh.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth = letter.modifiers.new("Surface_tension_relaxation", "SMOOTH")
smooth.factor = .55
smooth.iterations = 5
bpy.ops.object.modifier_apply(modifier=smooth.name)

segments = [(Vector(a), Vector(b)) for points in (outer, inner)
            for a, b in zip(points, points[1:] + points[:1])]
def boundary_distance(x, y):
    p = Vector((x, y))
    nearest = 10
    for a, b in segments:
        edge = b-a
        t = max(0, min(1, (p-a).dot(edge) / max(edge.length_squared, 1e-9)))
        nearest = min(nearest, (p-(a+edge*t)).length)
    return nearest

# Sculpt real geometry, not fake highlights: a softly inflated front/back,
# subtle longitudinal surface-tension folds, and an asymmetric meniscus.
for vertex in letter.data.vertices:
    x, y, z = vertex.co
    distance = boundary_distance(x, y)
    cap = math.tanh(z * 13)
    swell = .072 * (1 - math.exp(-max(distance, 0) * 9))
    fold = .013 * math.sin(5.4*y + 3.9*x) + .007 * math.sin(9*x - 2.7*y)
    vertex.co.x += .009 * math.sin(4.6*y + z*4) + .004 * math.sin(10.2*y-z*6)
    vertex.co.y += .008 * math.sin(x*5.3 + z*4.2) + .004 * math.sin(y*11+x*4)
    vertex.co.z += cap * swell + fold

# Normalize the finished geometry to 2.6 units tall and Y=0. A glTF axis
# conversion is applied only at export so Three.js receives Y-up positions.
min_y = min(v.co.y for v in letter.data.vertices)
max_y = max(v.co.y for v in letter.data.vertices)
min_x = min(v.co.x for v in letter.data.vertices)
max_x = max(v.co.x for v in letter.data.vertices)
scale = 2.6 / (max_y-min_y)
for vertex in letter.data.vertices:
    vertex.co.x = (vertex.co.x - (min_x+max_x)/2) * scale
    vertex.co.y = (vertex.co.y-min_y) * scale
    vertex.co.z *= scale

tri = letter.modifiers.new("Web_triangles", "TRIANGULATE")
bpy.ops.object.modifier_apply(modifier=tri.name)
if len(letter.data.polygons) > 50000:
    decimate = letter.modifiers.new("Web_surface_budget", "DECIMATE")
    decimate.ratio = 48000 / len(letter.data.polygons)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
for poly in letter.data.polygons:
    poly.use_smooth = True

material = bpy.data.materials.new("Clear_Water_IOR_1_333")
material.use_nodes = True
material.node_tree.nodes.clear()
principled = material.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
output = material.node_tree.nodes.new("ShaderNodeOutputMaterial")
material.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
principled.inputs["Base Color"].default_value = (.985, .995, 1.0, 1)
principled.inputs["Metallic"].default_value = 0
principled.inputs["Roughness"].default_value = .035
principled.inputs["IOR"].default_value = 1.333
principled.inputs["Transmission Weight"].default_value = 1.0
principled.inputs["Coat Weight"].default_value = 0
material.diffuse_color = (.985, .995, 1.0, 1)
letter.data.materials.clear()
letter.data.materials.append(material)
letter["design"] = "Original rounded A; true upper counter, open lower counter, real asymmetric water surface."
letter["units"] = "2.6 total height; bottom Y 0; X centered; front/back Z."
letter["material_note"] = "Web renderer supplies calibrated studio, real transmission, thickness and IOR. No baked white rims."

def inspect(obj):
    mesh = obj.data
    # The decimator moves extrema by tiny amounts; pin export dimensions again.
    bottom = min(v.co.y for v in mesh.vertices)
    height = max(v.co.y for v in mesh.vertices)-bottom
    center = (min(v.co.x for v in mesh.vertices)+max(v.co.x for v in mesh.vertices))/2
    for vertex in mesh.vertices:
        vertex.co.x -= center
        vertex.co.y = (vertex.co.y-bottom)*2.6/height
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    volume = bm.calc_volume(signed=True)
    if volume < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        volume = -volume
    mesh.calc_loop_triangles()
    values = {
        "vertices": len(mesh.vertices),
        "triangles": len(mesh.loop_triangles),
        "non_manifold_edges": sum(not e.is_manifold for e in bm.edges),
        "boundary_edges": sum(e.is_boundary for e in bm.edges),
        "loose_vertices": sum(not v.link_edges for v in bm.verts),
        "degenerate_faces": sum(f.calc_area() < 1e-10 for f in bm.faces),
        "signed_volume_after_normals": volume,
        "bounds": {
            axis: [min(v.co[i] for v in mesh.vertices), max(v.co[i] for v in mesh.vertices)]
            for i, axis in enumerate("xyz")
        },
        "finite_coordinates": all(math.isfinite(c) for v in mesh.vertices for c in v.co),
        "euler_characteristic": len(bm.verts)-len(bm.edges)+len(bm.faces),
    }
    bm.free()
    # True geometry ray tests: the upper counter and open legs must pass
    # through; a crossbar ray must hit. Three coordinates test more than a
    # front-facing thumbnail can.
    bpy.context.view_layer.update()
    ray = Vector((0, 0, -1))
    checks = {}
    for name, xy in [("upper_counter", (0, 1.52)), ("between_legs", (0, .25)),
                     ("crossbar", (0, .83))]:
        hit, _, _, _ = obj.ray_cast(Vector((xy[0], xy[1], 3)), ray)
        checks[name] = bool(hit)
    values["ray_hits"] = checks
    assert values["finite_coordinates"]
    assert values["non_manifold_edges"] == 0, values
    assert values["degenerate_faces"] == 0, values
    assert values["euler_characteristic"] == 0, "A must be one closed genus-one water solid."
    assert not checks["upper_counter"] and not checks["between_legs"] and checks["crossbar"], checks
    return values

report = {
    "source": "Original independent outline; no font file or source-site geometry copied.",
    "letter": "A only; N/F/W and full alphabet require user visual approval.",
    "blender": bpy.app.version_string,
    "water_ior": 1.333,
    "high": inspect(letter),
}

lod = letter.copy()
lod.data = letter.data.copy()
lod.name = "Water_A_LOD"
bpy.context.collection.objects.link(lod)
letter.select_set(False)
lod.select_set(True)
bpy.context.view_layer.objects.active = lod
decimate = lod.modifiers.new("Mobile_surface_budget", "DECIMATE")
decimate.ratio = min(1.0, 15500 / len(lod.data.polygons))
bpy.ops.object.modifier_apply(modifier=decimate.name)
report["mobile"] = inspect(lod)

# glTF exporter rotates Z-up Blender coordinates into Y-up. Authoring coordinates
# above deliberately match the website, therefore a +90 degree X pre-rotation
# maps (x,y,z) to Blender (x,-z,y), then exporter restores (x,y,z).
def export(obj, name):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.rotation_euler.x = math.pi/2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bpy.ops.export_scene.gltf(
        filepath=str(ASSETS/name), export_format="GLB",
        use_selection=True, export_yup=True, export_apply=True,
        export_materials="EXPORT", export_extras=True,
    )
    # Preserve the conventional Z-up orientation in .blend for the CGI stage.
    # Exported GLB remains Y-up; the report bounds describe exported coordinates.
    report["high" if obj is letter else "mobile"]["glb_bytes"] = (ASSETS/name).stat().st_size

export(letter, "water-A.glb")
export(lod, "water-A-mobile.glb")
lod.hide_render = True
lod.hide_set(True)
bpy.ops.object.select_all(action="DESELECT")
letter.select_set(True)
bpy.context.view_layer.objects.active = letter
bpy.context.scene.unit_settings.system = "METRIC"
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS/"water-A.blend"))
for quality, name in (("high", "water-A.glb"), ("mobile", "water-A-mobile.glb")):
    data = (ASSETS/name).read_bytes()
    assert data[:4] == b"glTF" and struct.unpack_from("<I", data, 8)[0] == len(data)
    report[quality]["glb_bytes"] = len(data)
(ROOT/"model-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print("WATER_A_REPORT", json.dumps(report))
