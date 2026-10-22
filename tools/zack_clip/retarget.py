"""Retarget Mixamo clips onto GirlRig and bake one action.
blender -b girl.blend -P retarget.py -- typing.fbx disbelief.fbx out.blend"""
import sys

import bpy
from mathutils import Quaternion, Vector

TYPING, DISBELIEF, OUT = sys.argv[sys.argv.index("--") + 1:][:3]
N = 300                 # 10 s at 30 fps
CUT, BLEND = 188, 12    # our frame where disbelief starts, crossfade length
DIS_START = 4           # disbelief clip frame used at CUT

sc = bpy.context.scene
sc.render.fps = 30
dst = bpy.data.objects["GirlRig"]
names = [b.name for b in dst.data.bones]


def rot(m):
    return m.to_3x3().normalized().to_quaternion()


dst_rest = {b.name: rot(b.matrix_local) for b in dst.data.bones}
dst_hip_rest = dst.data.bones["mixamorig:Hips"].head_local.copy()
dst_foot = min(dst.data.bones[n].head_local.z for n in ("mixamorig:LeftFoot", "mixamorig:RightFoot"))
dst_hip_h = dst_hip_rest.z - dst_foot


def sample(path, frames):
    """Per clip frame: {bone: world rotation of the retargeted dst bone}, hip target location."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    src = [o for o in bpy.data.objects if o not in before and o.type == "ARMATURE"][0]
    mw = src.matrix_world
    src_rest = {n: rot(mw @ src.data.bones[n].matrix_local) for n in names}
    q = {}
    for n in names:
        dy = dst_rest[n] @ Vector((0, 1, 0))
        sy = src_rest[n] @ Vector((0, 1, 0))
        q[n] = dy.rotation_difference(sy)
    hip_rest = mw @ src.data.bones["mixamorig:Hips"].head_local
    foot = min((mw @ src.data.bones[n].head_local).z for n in ("mixamorig:LeftFoot", "mixamorig:RightFoot"))
    k = dst_hip_h / (hip_rest.z - foot)
    out = []
    for f in frames:
        sc.frame_set(f)
        rots = {n: rot(mw @ src.pose.bones[n].matrix) @ src_rest[n].inverted() @ q[n] @ dst_rest[n] for n in names}
        hip = mw @ src.pose.bones["mixamorig:Hips"].head
        out.append((rots, dst_hip_rest + (hip - hip_rest) * k))
    act = src.animation_data.action
    for o in [o for o in bpy.data.objects if o not in before]:
        bpy.data.objects.remove(o)
    bpy.data.actions.remove(act)
    return out


typ = sample(TYPING, range(1, N + 1))
dis = sample(DISBELIEF, range(DIS_START, DIS_START + N - CUT + 1))
# keep disbelief seated at the same height as typing
off = typ[CUT - 1][1] - dis[0][1]
off.x = off.y = 0

frames = []
for i in range(N):
    f = i + 1
    t_r, t_h = typ[i]
    if f < CUT:
        frames.append((t_r, t_h))
        continue
    d_r, d_h = dis[f - CUT]
    d_h = d_h + off
    a = min(1.0, (f - CUT) / BLEND)
    a = a * a * (3 - 2 * a)
    if a >= 1:
        frames.append((d_r, d_h))
    else:
        frames.append(({n: t_r[n].slerp(d_r[n], a) for n in names}, t_h.lerp(d_h, a)))

# world rotations -> matrix_basis, parent first
parents = {b.name: (b.parent.name if b.parent else None) for b in dst.data.bones}
order = [b.name for b in dst.data.bones]  # bones are stored parent-first
act = bpy.data.actions.new("GirlAnim")
dst.animation_data_create().action = act
curves = {}
for n in order:
    dst.pose.bones[n].rotation_mode = "QUATERNION"
    curves[n] = [act.fcurves.new(f'pose.bones["{n}"].rotation_quaternion', index=i, action_group=n) for i in range(4)]
hipc = [act.fcurves.new('pose.bones["mixamorig:Hips"].location', index=i, action_group="mixamorig:Hips") for i in range(3)]
vals = {n: [] for n in order}
prev = {}
hloc = []
for f, (wr, hp) in enumerate(frames, start=1):
    for n in order:
        p = parents[n]
        if p:
            b = dst_rest[n].inverted() @ dst_rest[p] @ wr[p].inverted() @ wr[n]
        else:
            b = dst_rest[n].inverted() @ wr[n]
        if n in prev:
            b.make_compatible(prev[n])
        prev[n] = b
        vals[n].append((f, b))
    hloc.append((f, dst_rest["mixamorig:Hips"].inverted() @ (hp - dst_hip_rest)))
for n in order:
    for i in range(4):
        fc = curves[n][i]
        fc.keyframe_points.add(len(vals[n]))
        fc.keyframe_points.foreach_set("co", [x for f, q in vals[n] for x in (f, q[i])])
        fc.update()
for i in range(3):
    hipc[i].keyframe_points.add(len(hloc))
    hipc[i].keyframe_points.foreach_set("co", [x for f, v in hloc for x in (f, v[i])])
    hipc[i].update()

sc.frame_start, sc.frame_end = 1, N
for f in (1, 100, CUT, 230, 300):
    sc.frame_set(f)
    pb = dst.pose.bones
    print(f, "hips", tuple(round(x, 3) for x in pb["mixamorig:Hips"].head),
          "lhand", tuple(round(x, 3) for x in pb["mixamorig:LeftHand"].head),
          "lfoot", tuple(round(x, 3) for x in pb["mixamorig:LeftFoot"].head),
          "head", tuple(round(x, 3) for x in pb["mixamorig:Head"].head))
bpy.ops.wm.save_as_mainfile(filepath=OUT)
