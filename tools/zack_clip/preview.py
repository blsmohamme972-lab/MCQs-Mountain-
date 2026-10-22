"""Quick still of a .blend: blender -b file.blend -P preview.py -- out.png [frame] [cam x y z] [target x y z] [lens]"""
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
out = a[0]
frame = int(a[1]) if len(a) > 1 else 1
sc = bpy.context.scene
sc.frame_set(frame)
cam_loc = Vector([float(x) for x in a[2:5]]) if len(a) > 4 else Vector((0.4, -2.2, 1.1))
tgt = Vector([float(x) for x in a[5:8]]) if len(a) > 7 else Vector((0, 0, 0.75))
lens = float(a[8]) if len(a) > 8 else 35
if sc.camera is None or len(a) > 4:
    cd = bpy.data.cameras.new("PrevCam")
    cam = bpy.data.objects.new("PrevCam", cd)
    sc.collection.objects.link(cam)
    cam.location = cam_loc
    cam.rotation_euler = (tgt - cam_loc).to_track_quat("-Z", "Y").to_euler()
    cd.lens = lens
    sc.camera = cam
if not any(o.type == "LIGHT" for o in sc.objects):
    ld = bpy.data.lights.new("Key", "SUN")
    ld.energy = 3
    lo = bpy.data.objects.new("Key", ld)
    lo.rotation_euler = (0.9, 0.2, 0.6)
    sc.collection.objects.link(lo)
    if sc.world is None:
        sc.world = bpy.data.worlds.new("W")
    sc.world.color = (0.4, 0.4, 0.45)
sc.render.engine = "CYCLES"
sc.cycles.samples = 4
sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 360, 640
sc.render.resolution_percentage = 100
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
