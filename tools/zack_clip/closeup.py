import sys, bpy
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]
sc = bpy.context.scene
f = int(a[1]); sc.frame_set(f)
rig = bpy.data.objects["GirlRig"]
head = rig.matrix_world @ rig.pose.bones["mixamorig:Head"].head
cam = sc.camera
cam.animation_data_clear(); cam.data.animation_data_clear()
off = Vector([float(x) for x in a[2:5]])
cam.location = head + off
tgt = head + Vector((0, -0.07, 0.06))
cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = float(a[5]); cam.data.dof.use_dof = False
sc.render.resolution_percentage = int(a[6]) if len(a) > 6 else 50; sc.cycles.samples = 8
if len(a) > 8: bpy.data.objects[a[8]].hide_render = True
if len(a) > 7 and a[7] == "noglow": bpy.data.objects["ScreenGlow"].data.animation_data_clear(); bpy.data.objects["ScreenGlow"].data.energy = 0
sc.render.filepath = a[0]
bpy.ops.render.render(write_still=True)
