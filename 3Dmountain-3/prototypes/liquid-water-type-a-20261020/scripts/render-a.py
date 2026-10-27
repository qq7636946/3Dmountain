"""Independent Cycles look-development stage. Does not edit the source model."""
import bpy
import json
import math
import time
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets" / "water-A.blend"))
scene = bpy.context.scene
for obj in list(scene.objects):
    if obj.type in {"LIGHT", "CAMERA"}:
        bpy.data.objects.remove(obj, do_unlink=True)

material = bpy.data.materials.new("Water / IOR 1.333 / no frosting")
material.use_nodes = True
nodes = material.node_tree.nodes
nodes.clear()
bsdf = nodes.new("ShaderNodeBsdfPrincipled")
output = nodes.new("ShaderNodeOutputMaterial")
material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
bsdf.inputs["Metallic"].default_value = 0
bsdf.inputs["Roughness"].default_value = 0.023
bsdf.inputs["IOR"].default_value = 1.333
bsdf.inputs["Transmission Weight"].default_value = 1
bsdf.inputs["Coat Weight"].default_value = 0
absorb = nodes.new("ShaderNodeVolumeAbsorption")
absorb.inputs["Color"].default_value = (0.73, 0.92, 1, 1)
absorb.inputs["Density"].default_value = 0.025
material.node_tree.links.new(absorb.outputs["Volume"], output.inputs["Volume"])
for obj in list(scene.objects):
    if obj.type == "MESH" and not obj.hide_render:
        obj.data.materials.clear()
        obj.data.materials.append(material)

def aim(obj, target=(0, 0, 1.3)):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

def light(name, location, power, width, height, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.shape = "RECTANGLE"
    data.size = width
    data.size_y = height
    data.color = color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    aim(obj)

light("Key / broad window", (-3.6, -4.0, 4.1), 650, 3.4, 4.8, (1, .97, .92))
light("Rim / tall cyan strip", (3.2, .4, 3.0), 450, .9, 4, (.79, .91, 1))
light("Top / silver edge", (-.3, 1.0, 5.7), 700, 3.5, 1.2, (1, 1, 1))

rows = [(-25, -.016), (2, -.016)]
rows += [(2 + 4 * math.sin(t * math.pi / 2 / 32),
          3.984 - 4 * math.cos(t * math.pi / 2 / 32)) for t in range(1, 33)]
rows += [(6, 20)]
vertices = [(x, y, z) for y, z in rows for x in (-25, 25)]
faces = [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(len(rows)-1)]
floor_mesh = bpy.data.meshes.new("Seamless cyclorama mesh")
floor_mesh.from_pydata(vertices, [], faces)
floor_mesh.update()
floor = bpy.data.objects.new("Neutral seamless cyclorama", floor_mesh)
scene.collection.objects.link(floor)
for polygon in floor_mesh.polygons:
    polygon.use_smooth = True
floor_material = bpy.data.materials.new("Warm silver-grey backdrop")
floor_material.use_nodes = True
floor_nodes = floor_material.node_tree.nodes
floor_nodes.clear()
floor_bsdf = floor_nodes.new("ShaderNodeBsdfPrincipled")
floor_output = floor_nodes.new("ShaderNodeOutputMaterial")
floor_material.node_tree.links.new(floor_bsdf.outputs["BSDF"], floor_output.inputs["Surface"])
floor_bsdf.inputs["Base Color"].default_value = (.32, .34, .36, 1)
floor_bsdf.inputs["Roughness"].default_value = .62
floor.data.materials.append(floor_material)

# Negative fill shapes the contour through actual reflections, not painted rims.
for name, location, scale in [
    ("Left negative fill", (-2.1, .2, 1.7), (1.1, 2.3, 1)),
    ("Right narrow negative fill", (2.4, -1.0, 1.8), (.45, 2.1, 1)),
]:
    bpy.ops.mesh.primitive_plane_add(size=2, location=location)
    flag = bpy.context.object
    flag.name = name
    flag.scale = scale
    aim(flag)
    flag.visible_camera = False
    flag.visible_shadow = False
    dark = bpy.data.materials.new(name)
    dark.use_nodes = True
    dark.node_tree.nodes.clear()
    dark_bsdf = dark.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    dark_output = dark.node_tree.nodes.new("ShaderNodeOutputMaterial")
    dark.node_tree.links.new(dark_bsdf.outputs["BSDF"], dark_output.inputs["Surface"])
    dark_bsdf.inputs["Base Color"].default_value = (.006, .009, .014, 1)
    dark_bsdf.inputs["Roughness"].default_value = 1
    flag.data.materials.append(dark)

world = bpy.data.worlds.new("Soft neutral studio")
world.use_nodes = True
world.node_tree.nodes.clear()
background = world.node_tree.nodes.new("ShaderNodeBackground")
world_output = world.node_tree.nodes.new("ShaderNodeOutputWorld")
world.node_tree.links.new(background.outputs["Background"], world_output.inputs["Surface"])
background.inputs["Color"].default_value = (.48, .53, .62, 1)
background.inputs["Strength"].default_value = .30
scene.world = world
camera_data = bpy.data.cameras.new("Product inspection camera")
camera = bpy.data.objects.new("Product inspection camera", camera_data)
scene.collection.objects.link(camera)
camera_data.lens = 60
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 16
scene.cycles.transmission_bounces = 12
scene.cycles.transparent_max_bounces = 12
scene.render.use_persistent_data = True
device = "CPU"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for item in prefs.devices:
        item.use = item.type == "OPTIX"
    if any(item.use for item in prefs.devices):
        scene.cycles.device = "GPU"
        device = "OPTIX"
except Exception as error:
    print("CPU fallback:", error)
scene.render.resolution_x = 900
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = 0
out = ROOT / "renders"
out.mkdir(exist_ok=True)
report = {"engine": "Cycles", "device": device, "samples": scene.cycles.samples,
          "note": "Independent A-only studio. Ray-traced transmission, no painted white rim. Not a web performance benchmark.",
          "frames": []}
for name, position in [
    ("A-three-quarter", (3.8, -6.6, 3.0)),
    ("A-front", (0, -7.3, 2.4)),
    ("A-side", (7.0, -1.6, 2.6)),
]:
    camera.location = position
    aim(camera)
    scene.render.filepath = str(out / (name + ".png"))
    start = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    report["frames"].append({"name": name, "seconds": round(time.perf_counter() - start, 3)})
camera.location = (3.8, -6.6, 3.0)
aim(camera)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets" / "water-A-studio.blend"))
(ROOT / "render-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report))
