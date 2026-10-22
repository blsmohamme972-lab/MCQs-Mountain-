"""Bake the seated writing motion onto Grace: typing clip frames 1..300 -> timeline 1..300.
blender -b grace.blend -P anim_lincoln.py -- typing.fbx out.blend"""
import os, sys
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mixamo import bake, sample  # noqa: E402
clip, out = sys.argv[sys.argv.index("--") + 1:][:2]
sc = bpy.context.scene
sc.render.fps = 30
sc.frame_start, sc.frame_end = 1, 300
rig = bpy.data.objects["GirlRig"]
frames, n = sample(rig, clip, range(1, 301))
bake(rig, frames)
bpy.ops.wm.save_as_mainfile(filepath=out)
