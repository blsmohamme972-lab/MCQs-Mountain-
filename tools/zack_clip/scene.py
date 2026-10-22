"""Set, lights, laptop screen, face keys and camera for the test clip.
blender -b girl_anim.blend -P scene.py -- <polyhaven_assets> <screen_dir> <out.blend>"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Quaternion, Vector

ASSETS, SCREENS, OUT = sys.argv[sys.argv.index("--") + 1:][:3]
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, 300
sc.render.fps = 30
WRONG = 172          # screen turns red
SHOCK = 188          # disbelief motion starts

girl = bpy.data.objects["Girl"]
rig = bpy.data.objects["GirlRig"]
FACE_OBJS = [o for o in bpy.data.objects if o.type == "MESH" and o.data.shape_keys]


def link(ob):
    sc.collection.objects.link(ob)
    return ob


def import_gltf(name):
    d = os.path.join(ASSETS, name)
    f = [x for x in os.listdir(d) if x.endswith(".gltf")][0]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(d, f))
    new = [o for o in bpy.data.objects if o not in before]
    root = link(bpy.data.objects.new(name + "_root", None))
    for o in new:
        if o.parent is None:
            o.parent = root
    return root, [o for o in new if o.type == "MESH"]


def bbox(objs):
    bpy.context.view_layer.update()
    pts = np.array([o.matrix_world @ Vector(c) for o in objs for c in o.bound_box])
    return pts.min(0), pts.max(0)


def ray_down(objs, x, y, z=3.0):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, *_ = sc.ray_cast(dg, Vector((x, y, z)), Vector((0, 0, -1)))
    return loc.z if hit else None


# ------------------------------------------------------------- measure girl while typing
sc.frame_set(100)
dg = bpy.context.evaluated_depsgraph_get()
cos = []
for o in (girl, bpy.data.objects["suit"]):
    ev = o.evaluated_get(dg)
    cos.append(np.array([v.co[:] for v in ev.to_mesh().vertices]))
    ev.to_mesh_clear()
co = np.concatenate(cos)
pb = rig.pose.bones
hips = rig.matrix_world @ pb["mixamorig:Hips"].head
wrist = (rig.matrix_world @ pb["mixamorig:LeftHand"].head + rig.matrix_world @ pb["mixamorig:RightHand"].head) / 2
seat = co[(abs(co[:, 0]) < 0.12) & (abs(co[:, 1] - hips.y) < 0.08), 2].min()
thigh = co[(abs(co[:, 0]) < 0.25) & (co[:, 1] < -0.15) & (co[:, 1] > -0.32) & (co[:, 2] < 0.56), 2].max()
cs = cos[1]
belly = cs[(abs(cs[:, 0]) < 0.1) & (cs[:, 2] > 0.6) & (cs[:, 2] < 0.8), 1].min()
print("hips", hips, "wrist", wrist, "seat", seat, "thigh top", thigh, "belly y", belly)

# ------------------------------------------------------------- laptop (faces the girl: screen away from her)
LAP_S = 0.5
lap, lap_meshes = import_gltf("classic_laptop")
lap.scale = (0.66, 0.55, LAP_S)
lap.rotation_euler = (0, 0, math.pi)
lo, hi = bbox([o for o in lap_meshes if o.name.startswith("classic_laptop") and "screen" not in o.name and "stand" not in o.name])
base_h = hi[2] - lo[2]
desk_top = wrist.z - 0.02 - base_h
lap_front = wrist.y + 0.05
lap.location = (wrist.x, lap_front - hi[1], desk_top - lo[2])

# ------------------------------------------------------------- desk
desk, desk_meshes = import_gltf("SchoolDesk_01")
top0 = ray_down(desk_meshes, 0, 0)
lo, hi = bbox(desk_meshes)
sz = desk_top / top0
desk.scale = (1.0, 0.95, sz)
lo, hi = bbox(desk_meshes)
desk.location = (wrist.x, min(belly - 0.04, lap_front + 0.04) - hi[1], 0)
print("desk top", desk_top, "underside clearance vs thigh", desk_top - 0.03 - thigh)

# ------------------------------------------------------------- chair: seat under her, backrest behind
chair, chair_meshes = import_gltf("SchoolChair_01")
s0 = ray_down(chair_meshes, 0, 0)
lo, hi = bbox(chair_meshes)
pts = np.array([o.matrix_world @ v.co for o in chair_meshes for v in o.data.vertices])
back_y = pts[pts[:, 2] > s0 + 0.15, 1].mean()
chair.rotation_euler = (0, 0, 0 if back_y > 0 else math.pi)
k = seat / s0
chair.scale = (k,) * 3
chair.location = (hips.x, hips.y + 0.07, 0)

# ------------------------------------------------------------- props
lamp, lamp_m = import_gltf("desk_lamp_arm_01")
lamp.scale = (0.45,) * 3
lamp.rotation_euler = (0, 0, math.radians(-60))
dlo, dhi = bbox(desk_meshes)
lamp.location = (dhi[0] - 0.07, dlo[1] + 0.09, desk_top + 0.005)
plant, _ = import_gltf("potted_plant_01")
plant.scale = (0.8,) * 3
plant.location = (-1.0, 0.75, 0)

# ------------------------------------------------------------- room
def plane(name, size, loc, rot, color, rough=0.8):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bm.loops.layers.uv.new("UV")
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2, calc_uvs=True)
    bm.to_mesh(me)
    ob = link(bpy.data.objects.new(name, me))
    ob.location, ob.rotation_euler = loc, rot
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    me.materials.append(m)
    return ob


plane("Floor", 8, (0, 0, 0), (0, 0, 0), (0.42, 0.27, 0.16), 0.5)
plane("WallBack", 8, (0, 1.4, 0), (math.pi / 2, 0, 0), (0.55, 0.72, 0.85))
plane("WallSide", 8, (-1.6, 0, 0), (math.pi / 2, 0, math.pi / 2), (0.93, 0.83, 0.62))
plane("WallFront", 8, (0, -2.6, 0), (math.pi / 2, 0, 0), (0.93, 0.83, 0.62))
plane("WallRight", 8, (2.2, 0, 0), (math.pi / 2, 0, math.pi / 2), (0.55, 0.72, 0.85))
# a poster on the back wall
poster = plane("Poster", 0.5, (0.55, 1.39, 1.25), (math.pi / 2, 0, 0), (0.95, 0.45, 0.2), 0.6)
pm = poster.data.materials[0].node_tree
ptex = pm.nodes.new("ShaderNodeTexImage")
ptex.image = bpy.data.images.load(os.path.join(SCREENS, "poster.png"))
pm.links.new(ptex.outputs["Color"], pm.nodes["Principled BSDF"].inputs["Base Color"])
poster.scale = (1.0, 1.4, 1.0)

world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
wn = world.node_tree
env = wn.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(ASSETS, "hdri", "white_home_studio.hdr"))
wn.links.new(env.outputs["Color"], wn.nodes["Background"].inputs["Color"])
wn.nodes["Background"].inputs["Strength"].default_value = 0.25


def light(name, kind, loc, rot, energy, color, size=1.0):
    ld = bpy.data.lights.new(name, kind)
    ld.energy, ld.color = energy, color
    if kind == "AREA":
        ld.size = size
    ob = link(bpy.data.objects.new(name, ld))
    ob.location, ob.rotation_euler = loc, rot
    return ob


def aim(ob, target):
    ob.rotation_euler = (Vector(target) - ob.location).to_track_quat("-Z", "Y").to_euler()


key = light("Key", "AREA", (-1.2, -1.3, 1.9), (0, 0, 0), 110, (1.0, 0.9, 0.8), 1.2)
aim(key, (0, -0.1, 0.8))
rim = light("Rim", "AREA", (0.9, 1.1, 1.7), (0, 0, 0), 120, (0.7, 0.8, 1.0), 0.8)
aim(rim, (0, 0, 0.9))
fill = light("Fill", "AREA", (1.4, -1.6, 1.2), (0, 0, 0), 25, (0.85, 0.9, 1.0), 1.5)
aim(fill, (0, 0, 0.8))

# ------------------------------------------------------------- laptop display: our own plane on the lid
scr_obj = [o for o in lap_meshes if "screen" in o.name][0]
mi = [i for i, m in enumerate(scr_obj.data.materials) if m and m.name.startswith("classic_laptop_screen")]
bpy.context.view_layer.update()
mw = scr_obj.matrix_world
polys = [p for p in scr_obj.data.polygons if p.material_index in mi]
n = sum((mw.to_3x3() @ p.normal * p.area for p in polys), Vector()).normalized()
vs = np.array([mw @ scr_obj.data.vertices[v].co for p in polys for v in p.vertices])
c = Vector(vs.mean(0))
xa = Vector((1, 0, 0))
ya = n.cross(xa).normalized()
if ya.z < 0:
    ya = -ya
xa = ya.cross(n).normalized()
uu = (vs - np.array(c)) @ np.array(xa)
vv = (vs - np.array(c)) @ np.array(ya)
w2, h2 = (uu.max() - uu.min()) / 2 * 0.97, (vv.max() - vv.min()) / 2 * 0.97
cc = c + xa * (uu.max() + uu.min()) / 2 + ya * (vv.max() + vv.min()) / 2 + n * 0.003
if (Vector((wrist.x, wrist.y, wrist.z + 0.3)) - cc).dot(n) < 0:
    n = -n
    cc = c + xa * (uu.max() + uu.min()) / 2 + ya * (vv.max() + vv.min()) / 2 + n * 0.003
xa = ya.cross(n).normalized()
corners = [cc - xa * w2 - ya * h2, cc + xa * w2 - ya * h2, cc + xa * w2 + ya * h2, cc - xa * w2 + ya * h2]
me = bpy.data.meshes.new("Display")
me.from_pydata([tuple(p) for p in corners], [], [(0, 1, 2, 3)])
uvl = me.uv_layers.new(name="UV")
uvl.data.foreach_set("uv", [0, 0, 1, 0, 1, 1, 0, 1])
disp = link(bpy.data.objects.new("Display", me))
dm = bpy.data.materials.new("Display")
dm.use_nodes = True
nt = dm.node_tree
for nd in list(nt.nodes):
    if nd.type != "OUTPUT_MATERIAL":
        nt.nodes.remove(nd)
tex = nt.nodes.new("ShaderNodeTexImage")
img = bpy.data.images.load(os.path.join(SCREENS, "screen_0001.png"))
img.source = "SEQUENCE"
tex.image = img
tex.image_user.frame_duration = 300
tex.image_user.frame_start = 1
tex.image_user.use_auto_refresh = True
em = nt.nodes.new("ShaderNodeEmission")
em.inputs["Strength"].default_value = 1.6
nt.links.new(tex.outputs["Color"], em.inputs["Color"])
nt.links.new(em.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
me.materials.append(dm)
print("display at", cc, "normal", n, "size", w2 * 2, h2 * 2)

# keep her eyes on the laptop while typing: the Mixamo clip turns the head away
act = rig.animation_data.action
hb = rig.pose.bones["mixamorig:Head"]
hcurves = [act.fcurves.find('pose.bones["mixamorig:Head"].rotation_quaternion', index=i) for i in range(4)]
rest_rot = rig.data.bones["mixamorig:Head"].matrix_local.to_quaternion()
face_local = rest_rot.inverted() @ Vector((0, -1, 0))
aim_pt = cc + Vector((0, 0, 0.10))
new = []
for f in range(1, SHOCK + 1):
    sc.frame_set(f)
    m = rig.matrix_world @ hb.matrix
    mr = m.to_quaternion()
    fwd = mr @ face_local
    eye = m @ Vector((0, 0.09, 0))  # roughly between the eyes
    c = fwd.rotation_difference(aim_pt - eye)
    w = 1.0 if f < SHOCK - 18 else max(0.0, (SHOCK - f) / 18)
    c = Quaternion().slerp(c, w * 0.9)
    b = hb.rotation_quaternion.copy()
    new.append((f, b @ (mr.inverted() @ c @ mr)))
for f, q in new:
    for i in range(4):
        hcurves[i].keyframe_points[f - 1].co.y = q[i]
for fc in hcurves:
    fc.update()

# glow from the screen onto her face: white-blue while typing, red after WRONG
glow = light("ScreenGlow", "AREA", tuple(cc + n * 0.05), (0, 0, 0), 25, (0.75, 0.85, 1.0), 0.3)
aim(glow, (hips.x, hips.y, hips.z + 0.45))
gd = glow.data
for f, col, e in ((WRONG - 1, (0.75, 0.85, 1.0), 25), (WRONG, (1.0, 0.12, 0.1), 70), (WRONG + 4, (1.0, 0.12, 0.1), 30),
                  (WRONG + 8, (1.0, 0.12, 0.1), 70), (WRONG + 14, (1.0, 0.15, 0.12), 45)):
    gd.color, gd.energy = col, e
    gd.keyframe_insert("color", frame=f)
    gd.keyframe_insert("energy", frame=f)

# ------------------------------------------------------------- face
def face(frame, **vals):
    for ob in FACE_OBJS:
        kb = ob.data.shape_keys.key_blocks
        for nme, v in vals.items():
            if nme in kb:
                kb[nme].value = v
                kb[nme].keyframe_insert("value", frame=frame)


ALL = ["eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
       "eyeWideLeft", "eyeWideRight", "mouthSmileLeft", "mouthSmileRight", "mouthFunnel", "browDownLeft",
       "browDownRight", "mouthPressLeft", "mouthPressRight", "eyeLookDownLeft", "eyeLookDownRight",
       "mouthStretchLeft", "mouthStretchRight"]
face(1, **{k: 0.0 for k in ALL})
typing = dict(eyeLookDownLeft=1.0, eyeLookDownRight=1.0, browDownLeft=0.25, browDownRight=0.25, mouthPressLeft=0.3, mouthPressRight=0.3,
              mouthSmileLeft=0.15, mouthSmileRight=0.15)
face(10, **typing)
face(140, **typing)
face(150, mouthSmileLeft=0.45, mouthSmileRight=0.45, browDownLeft=0.0, browDownRight=0.0)  # confident click
face(WRONG, mouthSmileLeft=0.45, mouthSmileRight=0.45, eyeWideLeft=0.0, eyeWideRight=0.0, jawOpen=0.0,
     browInnerUp=0.0, browOuterUpLeft=0.0, browOuterUpRight=0.0)
face(WRONG + 5, eyeLookDownLeft=0.0, eyeLookDownRight=0.0, mouthSmileLeft=0.0, mouthSmileRight=0.0, eyeWideLeft=0.9, eyeWideRight=0.9,
     browInnerUp=0.7, browOuterUpLeft=0.6, browOuterUpRight=0.6, mouthPressLeft=0.0, mouthPressRight=0.0)
face(SHOCK + 12, jawOpen=0.3, mouthFunnel=0.6, browInnerUp=1.0, browOuterUpLeft=0.9, browOuterUpRight=0.9,
     eyeWideLeft=1.0, eyeWideRight=1.0)
face(270, jawOpen=0.25, mouthFunnel=0.5, browInnerUp=1.0)
face(300, jawOpen=0.3, mouthFunnel=0.55, browInnerUp=1.0)
for b in (45, 118, 205):        # blinks
    face(b - 2, eyeBlinkLeft=0.0, eyeBlinkRight=0.0)
    face(b, eyeBlinkLeft=1.0, eyeBlinkRight=1.0)
    face(b + 3, eyeBlinkLeft=0.0, eyeBlinkRight=0.0)

# ------------------------------------------------------------- camera
cd = bpy.data.cameras.new("Cam")
cam = link(bpy.data.objects.new("Cam", cd))
sc.camera = cam
cd.dof.use_dof = True
cd.dof.aperture_fstop = 2.8
cd.sensor_width = 36

headp = hips + Vector((0, -0.08, 0.5))
H = lambda dx=0, dy=0, dz=0: tuple(headp + Vector((dx, dy, dz)))  # noqa: E731
S = tuple(cc)
# (start, end, cam from, cam to, look from, look to, lens from, lens to, ease)
SHOTS = [
    (1, 75, (-0.95, -1.25, 1.05), (-0.68, -0.95, 0.98), H(0, -0.1, -0.12), H(0, -0.1, -0.08), 30, 36, "inout"),
    (76, 140, (0.42, 0.55, 1.12), (0.28, 0.2, 1.0), S, S, 35, 45, "inout"),
    (141, 171, (-0.34, -0.66, 0.80), (-0.28, -0.58, 0.82), H(0.05, -0.15, 0.0), H(0.05, -0.15, 0.0), 40, 50, "inout"),
    (172, 195, (0.32, 0.3, 1.0), (0.2, 0.0, 0.88), S, S, 30, 55, "crash"),
    (196, 300, (0.05, -1.75, 1.1), (0.0, -0.95, 1.05), H(0, 0, -0.05), H(0, 0, 0.02), 26, 40, "crash"),
]


def ease(t, kind):
    if kind == "crash":
        return 1 - (1 - t) ** 4
    return t * t * (3 - 2 * t)


rng = np.random.default_rng(7)
noise = rng.normal(size=(301, 3))
for s, e, p0, p1, l0, l1, f0, f1, kind in SHOTS:
    for f in range(s, e + 1):
        t = ease((f - s) / max(1, e - s), kind)
        p = Vector(p0).lerp(Vector(p1), t)
        look = Vector(l0).lerp(Vector(l1), t)
        shake = 0.0
        if f >= WRONG and f < WRONG + 14:
            shake = 0.012 * (1 - (f - WRONG) / 14)
        if SHOCK + 8 <= f < SHOCK + 30:
            shake = 0.015 * (1 - (f - SHOCK - 8) / 22)
        p += Vector(noise[f]) * shake
        cam.location = p
        cam.rotation_euler = (look - p).to_track_quat("-Z", "Y").to_euler()
        cd.lens = f0 + (f1 - f0) * t
        cd.dof.focus_distance = (look - p).length
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        cd.keyframe_insert("lens", frame=f)
        cd.dof.keyframe_insert("focus_distance", frame=f)
for fc in list(cam.animation_data.action.fcurves) + list(cd.animation_data.action.fcurves):
    for kp in fc.keyframe_points:
        kp.interpolation = "LINEAR"

# ------------------------------------------------------------- render settings
sc.render.engine = "CYCLES"
sc.cycles.samples = 10
sc.cycles.use_denoising = True
sc.cycles.denoiser = "OPENIMAGEDENOISE"
sc.cycles.max_bounces = 4
sc.render.resolution_x, sc.render.resolution_y = 540, 960
sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Punchy"
sc.view_settings.exposure = -0.45
sc.cycles.samples = 8
sc.render.resolution_percentage = 80
sc.render.image_settings.file_format = "PNG"
bpy.ops.wm.save_as_mainfile(filepath=OUT)
