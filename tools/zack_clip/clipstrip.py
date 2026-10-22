"""Render a strip of N frames of one Mixamo clip on the girl.
blender -b girl.blend -P clipstrip.py -- clip.fbx out_prefix N"""
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mixamo import bake, sample  # noqa: E402

clip, prefix, n = sys.argv[sys.argv.index("--") + 1:][:3]
sc = bpy.context.scene
rig = bpy.data.objects["GirlRig"]
frames, length = sample(rig, clip)
bake(rig, frames)
print("CLIP", os.path.basename(clip), "frames", length)
cd = bpy.data.cameras.new("C")
cam = bpy.data.objects.new("C", cd)
sc.collection.objects.link(cam)
cam.location = Vector((0.9, -1.9, 1.0))
cam.rotation_euler = (Vector((0, -0.1, 0.6)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cd.lens = 30
sc.camera = cam
ld = bpy.data.lights.new("K", "SUN")
ld.energy = 3
lo = bpy.data.objects.new("K", ld)
lo.rotation_euler = (0.8, 0.2, -0.5)
sc.collection.objects.link(lo)
sc.world = bpy.data.worlds.new("W")
sc.world.color = (0.3, 0.3, 0.35)
sc.render.engine = "CYCLES"
sc.cycles.samples = 3
sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 180, 320
for i in range(int(n)):
    f = 1 + round(i * (length - 1) / (int(n) - 1))
    sc.frame_set(f)
    sc.render.filepath = f"{prefix}_{i:02d}.png"
    bpy.ops.render.render(write_still=True)
