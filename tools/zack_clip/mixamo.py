"""Mixamo FBX -> GirlRig retarget helpers (no add-on code; Blender's bundled FBX importer only)."""
import bpy
from mathutils import Vector


def rot(m):
    return m.to_3x3().normalized().to_quaternion()


def sample(dst, path, frames=None):
    """Retarget a clip onto dst. Returns (list of (world rotations per bone, hip target), clip length)."""
    sc = bpy.context.scene
    names = [b.name for b in dst.data.bones]
    dst_rest = {b.name: rot(b.matrix_local) for b in dst.data.bones}
    dst_hip_rest = dst.data.bones["mixamorig:Hips"].head_local.copy()
    dst_foot = min(dst.data.bones[n].head_local.z for n in ("mixamorig:LeftFoot", "mixamorig:RightFoot"))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    src = [o for o in bpy.data.objects if o not in before and o.type == "ARMATURE"][0]
    act = src.animation_data.action
    n_frames = int(act.frame_range[1])
    mw = src.matrix_world
    src_rest = {n: rot(mw @ src.data.bones[n].matrix_local) for n in names}
    q = {n: (dst_rest[n] @ Vector((0, 1, 0))).rotation_difference(src_rest[n] @ Vector((0, 1, 0))) for n in names}
    hip_rest = mw @ src.data.bones["mixamorig:Hips"].head_local
    foot = min((mw @ src.data.bones[n].head_local).z for n in ("mixamorig:LeftFoot", "mixamorig:RightFoot"))
    k = (dst_hip_rest.z - dst_foot) / (hip_rest.z - foot)
    out = []
    for f in (frames or range(1, n_frames + 1)):
        sc.frame_set(f)
        rots = {n: rot(mw @ src.pose.bones[n].matrix) @ src_rest[n].inverted() @ q[n] @ dst_rest[n] for n in names}
        hip = mw @ src.pose.bones["mixamorig:Hips"].head
        out.append((rots, dst_hip_rest + (hip - hip_rest) * k))
    for o in [o for o in bpy.data.objects if o not in before]:
        bpy.data.objects.remove(o)
    bpy.data.actions.remove(act)
    return out, n_frames


def blend(a, b, t):
    ra, ha = a
    rb, hb = b
    return {n: ra[n].slerp(rb[n], t) for n in ra}, ha.lerp(hb, t)


def bake(dst, frames, name="GirlAnim", start=1):
    """frames: list of (world rotations, hip target). Writes quaternion + hip location F-curves."""
    dst_rest = {b.name: rot(b.matrix_local) for b in dst.data.bones}
    hip_rest = dst.data.bones["mixamorig:Hips"].head_local.copy()
    parents = {b.name: (b.parent.name if b.parent else None) for b in dst.data.bones}
    order = [b.name for b in dst.data.bones]
    act = bpy.data.actions.new(name)
    dst.animation_data_create().action = act
    vals = {n: [] for n in order}
    prev = {}
    for i, (wr, _) in enumerate(frames):
        for n in order:
            p = parents[n]
            if p:
                b = dst_rest[n].inverted() @ dst_rest[p] @ wr[p].inverted() @ wr[n]
            else:
                b = dst_rest[n].inverted() @ wr[n]
            if n in prev:
                b.make_compatible(prev[n])
            prev[n] = b
            vals[n].append(b)
    for n in order:
        dst.pose.bones[n].rotation_mode = "QUATERNION"
        for i in range(4):
            fc = act.fcurves.new(f'pose.bones["{n}"].rotation_quaternion', index=i, action_group=n)
            fc.keyframe_points.add(len(frames))
            fc.keyframe_points.foreach_set("co", [x for j, q in enumerate(vals[n]) for x in (start + j, q[i])])
            fc.update()
    loc = [dst_rest["mixamorig:Hips"].inverted() @ (h - hip_rest) for _, h in frames]
    for i in range(3):
        fc = act.fcurves.new('pose.bones["mixamorig:Hips"].location', index=i, action_group="mixamorig:Hips")
        fc.keyframe_points.add(len(frames))
        fc.keyframe_points.foreach_set("co", [x for j, v in enumerate(loc) for x in (start + j, v[i])])
        fc.update()
    return act
