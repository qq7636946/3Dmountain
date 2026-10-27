# Preview render of the .blend (approximate material) — proves the scene opens and renders in Blender.
# blender -b highland-world.blend --python render_preview.py -- <camera name> <out.png>
import bpy, sys
cam, out = (sys.argv[sys.argv.index('--') + 1:] + ['Cam_paths', 'preview.png'])[:2]
sc = bpy.context.scene
for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try: sc.render.engine = engine; break
    except TypeError: pass
sc.camera = bpy.data.objects[cam]
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1718, 820, 50
sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else sc.view_settings.view_transform
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('rendered', cam, out, sc.render.engine)
