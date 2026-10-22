"""Grace Bedell writes to Lincoln: set, lights, props, face, cameras for the 10 s clip.
blender -b grace_anim.blend -P scene_lincoln.py -- <ph_lincoln> <ph_tables> <tex_dir> <portrait_dir> <calico.png> <out.blend> <post.json>"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import look  # noqa: E402

PH, PHT, TEX, POR, CALICO, OUT, POST = sys.argv[sys.argv.index("--") + 1:][:7]
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, 300
sc.render.fps = 30

# shot table (timeline frames, inclusive) — cut on the narration
SHOTS = dict(s1a=(1, 35), s1b=(36, 73), s2=(74, 124), s3=(125, 148), s4=(149, 174), s5=(175, 231), s6=(232, 270), s7=(271, 300))
GIRL_HIDDEN = ("s2", "s4", "s5", "s6")

girl = bpy.data.objects["Girl"]
rig = bpy.data.objects["GirlRig"]
GIRL_OBJS = [o for o in bpy.data.objects if o.parent == rig]
FACE_OBJS = [o for o in GIRL_OBJS if o.type == "MESH" and o.data.shape_keys]
pb = rig.pose.bones


def link(ob):
    sc.collection.objects.link(ob)
    return ob


def aim_rot(frm, to, up=Vector((0, 0, 1))):
    """Camera/object rotation looking from frm to to with an explicit up hint (safe near top-down)."""
    f = (Vector(to) - Vector(frm)).normalized()
    r = f.cross(up).normalized()
    u = r.cross(f).normalized()
    return Matrix((r, u, -f)).transposed().to_euler()


def import_gltf(folder, name):
    d = os.path.join(folder, name)
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
    p = np.array([o.matrix_world @ Vector(c) for o in objs for c in o.bound_box])
    return p.min(0), p.max(0)


def ray(origin, direction):
    bpy.context.view_layer.update()
    hit, loc, *_ = sc.ray_cast(bpy.context.evaluated_depsgraph_get(), Vector(origin), Vector(direction))
    return loc if hit else None


def mat(name, color, rough=0.6, tex=None, emit=None, emit_strength=0.0, bump=0.0, scale=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    if tex:
        im = nt.nodes.new("ShaderNodeTexImage")
        im.image = bpy.data.images.load(tex)
        nt.links.new(im.outputs["Color"], b.inputs["Base Color"])
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    if bump:
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 60 * scale
        bp = nt.nodes.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def box(name, size, loc, m, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    ob = link(bpy.data.objects.new(name, me))
    ob.location, ob.rotation_euler = loc, rot
    me.materials.append(m)
    return ob


def sheet(name, w, h, loc, yaw, image, seq=False, frames=300):
    """A paper plane lying on the table. UV u -> girl's right (-X), v -> away from her (-Y) at yaw 0."""
    me = bpy.data.meshes.new(name)
    vs = [(w / 2, h / 2, 0), (-w / 2, h / 2, 0), (-w / 2, -h / 2, 0), (w / 2, -h / 2, 0)]
    me.from_pydata(vs, [], [(0, 1, 2, 3)])
    me.uv_layers.new(name="UV").data.foreach_set("uv", [0, 0, 1, 0, 1, 1, 0, 1])
    ob = link(bpy.data.objects.new(name, me))
    ob.location = loc
    ob.rotation_euler = (0, 0, yaw)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.75
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(image)
    if seq:
        t.image.source = "SEQUENCE"
        t.image_user.frame_duration = frames
        t.image_user.frame_start = 1
        t.image_user.use_auto_refresh = True
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    me.materials.append(m)
    return ob


def key_hide(objs, hidden_frames):
    for o in objs:
        for f in range(1, 301):
            h = f in hidden_frames
            if f == 1 or h != (f - 1 in hidden_frames):
                o.hide_render = h
                o.keyframe_insert("hide_render", frame=f)
                o.hide_viewport = h
                o.keyframe_insert("hide_viewport", frame=f)


def frames_of(*names):
    s = set()
    for n in names:
        a, b = SHOTS[n]
        s.update(range(a, b + 1))
    return s


# ------------------------------------------------------------------ pen grip + younger proportions
_act = rig.animation_data.action
CURL = {"Index": 24, "Middle": 34, "Ring": 52, "Pinky": 58}
for bn in rig.pose.bones:
    for k, deg in CURL.items():
        if bn.name.startswith("mixamorig:RightHand" + k) and bn.name[-1] in "123":
            q = Quaternion((-1, 0, 0), math.radians(deg))
            cs = [_act.fcurves.find(f'pose.bones["{bn.name}"].rotation_quaternion', index=i) for i in range(4)]
            for j in range(len(cs[0].keyframe_points)):
                o = Quaternion([cs[i].keyframe_points[j].co.y for i in range(4)]) @ q
                for i in range(4):
                    cs[i].keyframe_points[j].co.y = o[i]
pb["mixamorig:Head"].scale = (1.12, 1.12, 1.12)
for ob in (girl,):                               # softer, younger skin
    sb = ob.data.materials[0].node_tree.nodes["Principled BSDF"]
    sb.inputs["Subsurface Weight"].default_value = 0.25
    sb.inputs["Subsurface Scale"].default_value = 0.008
eb = bpy.data.objects["eyes"].data.materials[0].node_tree.nodes["Principled BSDF"]
eb.inputs["Roughness"].default_value = 0.04       # wet eyes: catchlights from the lamp
eb.inputs["Specular IOR Level"].default_value = 0.8

# ------------------------------------------------------------------ measure Grace while writing
sc.frame_set(40)
dg = bpy.context.evaluated_depsgraph_get()
cos = []
for o in (girl, bpy.data.objects["suit"]):
    ev = o.evaluated_get(dg)
    cos.append(np.array([o.matrix_world @ v.co for v in ev.to_mesh().vertices]))
    ev.to_mesh_clear()
co = np.concatenate(cos)
hips = rig.matrix_world @ pb["mixamorig:Hips"].head
wr = rig.matrix_world @ pb["mixamorig:RightHand"].head
wl = rig.matrix_world @ pb["mixamorig:LeftHand"].head
wrist = (wr + wl) / 2
seat = co[(abs(co[:, 0]) < 0.12) & (abs(co[:, 1] - hips.y) < 0.08), 2].min()
thigh = co[(abs(co[:, 0]) < 0.25) & (co[:, 1] < -0.15) & (co[:, 1] > -0.32) & (co[:, 2] < 0.56), 2].max()
cs = cos[1]
belly = cs[(abs(cs[:, 0]) < 0.1) & (cs[:, 2] > 0.6) & (cs[:, 2] < 0.8), 1].min()
DT = wrist.z - 0.035
print("hips", hips, "wrists", wr, wl, "seat", seat, "thigh", thigh, "belly", belly, "DT", DT)

# ------------------------------------------------------------------ table and chair
table, table_m = import_gltf(PHT, "WoodenTable_01")
lo, hi = bbox(table_m)
table.scale = (0.62, 1.0, DT / hi[2])
lo, hi = bbox(table_m)
table.location = (0.0, belly - 0.05 - hi[1], 0)
lo, hi = bbox(table_m)
under = ray((0.0, hi[1] - 0.04, 0.2), (0, 0, 1))
print("table", lo, hi, "apron bottom near her", under.z if under else None, "thigh", thigh)

chair, chair_m = import_gltf(PH, "painted_wooden_chair_01")
chair.location = (50, 0, 0)
hits = [(y, ray((50, y, 2), (0, 0, -1))) for y in np.linspace(-0.2, 0.27, 12)]
hits = [(y, h.z) for y, h in hits if h is not None and h.z > 0.2]
s0 = float(np.median([z for _, z in hits]))
pts = np.array([o.matrix_world @ v.co for o in chair_m for v in o.data.vertices])
s0 = float(np.percentile([z for _, z in hits], 30))
back_y = pts[pts[:, 2] > s0 + 0.15, 1].mean()
print("chair seat", s0, "back y", back_y)
chair.rotation_euler = (0, 0, 0 if back_y > 0 else math.pi)
chair.scale = (seat / s0,) * 3
chair.location = (hips.x, hips.y + 0.06, 0)

# ------------------------------------------------------------------ props on the table
LETTER_C = Vector((wr.x + 0.04, wr.y - 0.06, DT + 0.0012))
letter = sheet("Letter", 0.16, 0.21, LETTER_C, math.radians(6), os.path.join(TEX, "girl", "girl_0001.png"), seq=True)
reply = sheet("Reply", 0.16, 0.21, LETTER_C + Vector((0, 0, 0.0003)), math.radians(2), os.path.join(TEX, "reply.png"))
envelope = sheet("Envelope", 0.15, 0.088, Vector((LETTER_C.x + 0.17, LETTER_C.y + 0.02, DT + 0.0011)), math.radians(-18),
                 os.path.join(TEX, "envelope.png"))
envelope.data.uv_layers["UV"].data.foreach_set("uv", [0, 0, 1, 0, 1, 1, 0, 1])

lamp, lamp_m = import_gltf(PH, "vintage_oil_lamp")
lamp.scale = (0.42,) * 3
LAMP_XY = (wl.x + 0.13, wl.y - 0.24)
lamp.location = (*LAMP_XY, DT)
for o in lamp_m:
    for ms in o.data.materials:
        if ms and "glass" in ms.name:
            nt = ms.node_tree
            for n in list(nt.nodes):
                if n.type != "OUTPUT_MATERIAL":
                    nt.nodes.remove(n)
            tr = nt.nodes.new("ShaderNodeBsdfTransparent")
            tr.inputs["Color"].default_value = (1.0, 0.93, 0.8, 1)
            gl = nt.nodes.new("ShaderNodeBsdfGlossy")
            gl.inputs["Roughness"].default_value = 0.05
            mx = nt.nodes.new("ShaderNodeMixShader")
            mx.inputs[0].default_value = 0.12
            nt.links.new(tr.outputs[0], mx.inputs[1])
            nt.links.new(gl.outputs[0], mx.inputs[2])
            nt.links.new(mx.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
        if ms and "flame" in ms.name:
            nt = ms.node_tree
            for n in list(nt.nodes):
                if n.type != "OUTPUT_MATERIAL":
                    nt.nodes.remove(n)
            em = nt.nodes.new("ShaderNodeEmission")
            em.inputs["Color"].default_value = (1.0, 0.55, 0.18, 1)
            em.inputs["Strength"].default_value = 60
            nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
flame_obj = [o for o in lamp_m if "flame" in o.name]
lo, hi = bbox(flame_obj or lamp_m)
FLAME = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2 if flame_obj else DT + 0.15))
print("flame at", FLAME)

frame, frame_m = import_gltf(PH, "standing_picture_frame_01")
frame.scale = (1.15,) * 3
CARD_XY = Vector((-0.50, LETTER_C.y - 0.33))   # far from the lamp: no lamp glass in front of the macro lens
frame.location = (CARD_XY.x, CARD_XY.y, DT)
art_o, art_poly = None, None
for o in frame_m:
    for i, ms in enumerate(o.data.materials):
        if ms and "artwork" in ms.name:
            art_o = o
            ms_art = ms
# turn the frame so the artwork faces Grace's eyes
bpy.context.view_layer.update()
polys = [p for p in art_o.data.polygons if art_o.data.materials[p.material_index] == ms_art]
nrm = sum((art_o.matrix_world.to_3x3() @ p.normal * p.area for p in polys), Vector()).normalized()
EYES40 = rig.matrix_world @ pb["mixamorig:Head"].head + Vector((0, -0.09, 0.07))
want = (EYES40 - Vector((CARD_XY.x, CARD_XY.y, DT + 0.12)))
want.z = 0
ang = math.atan2(want.y, want.x) - math.atan2(nrm.y, nrm.x)
frame.rotation_euler = (0, 0, ang)
bpy.context.view_layer.update()
cen = sum((art_o.matrix_world @ p.center for p in polys), Vector()) / len(polys)
CARD = cen
CARD_N = (art_o.matrix_world.to_3x3() @ polys[0].normal).normalized()
nt = ms_art.node_tree
bsdf_art = nt.nodes.get("Principled BSDF")
for n in [l.from_node for l in bsdf_art.inputs["Base Color"].links]:
    if n.type == "TEX_IMAGE":
        img = bpy.data.images.load(os.path.join(POR, "portrait_0001.png"))
        img.source = "SEQUENCE"
        n.image = img
        n.image_user.frame_duration = 300
        n.image_user.frame_start = 1
        n.image_user.use_auto_refresh = True
        print("artwork texture replaced", n.name)
b = nt.nodes.get("Principled BSDF")
if b:                                              # matte albumen print: no sky/window sheen over the photo
    for inp in ("Roughness", "Normal", "Metallic", "Specular IOR Level", "Coat Weight", "Sheen Weight"):
        if inp in b.inputs:
            for l in list(b.inputs[inp].links):
                nt.links.remove(l)
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Specular IOR Level"].default_value = 0.05
for o in frame_m:
    for ms in o.data.materials:
        if ms and "glass" in ms.name:
            o.data.materials[list(o.data.materials).index(ms)] = mat("FrameGlass", (1, 1, 1), 0.05)
            gm = o.data.materials[list(o.data.materials).index(bpy.data.materials["FrameGlass"])]
            gm.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.0
            gm.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 0.0
print("card", CARD, "normal", CARD_N)

candle, _ = import_gltf(PH, "wooden_candlestick")
candle.scale = (0.9,) * 3
candle.location = (-0.68, LETTER_C.y - 0.05, DT)
books, _ = import_gltf(PH, "book_encyclopedia_set_01")
books.scale = (0.55,) * 3
books.location = (0.48, -0.40, DT)
books.rotation_euler = (0, 0, math.radians(90))

# inkwell + pen (procedural)
ink_m = mat("InkGlass", (0.05, 0.05, 0.09), 0.08)
brass = mat("Brass", (0.75, 0.55, 0.25), 0.3)
brass.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
INKWELL = Vector((LETTER_C.x - 0.13, LETTER_C.y - 0.02, DT))
box("Inkwell", (0.045, 0.045, 0.04), INKWELL + Vector((0, 0, 0.02)), ink_m)
box("InkLid", (0.022, 0.022, 0.008), INKWELL + Vector((0, 0, 0.044)), brass)


def make_pen(name):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.0005, radius2=0.0035, depth=0.014,
                          matrix=Matrix.Translation((0, 0, 0.007)))
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.0042, radius2=0.0042, depth=0.016,
                          matrix=Matrix.Translation((0, 0, 0.022)))
    me_n = bpy.data.meshes.new(name + "_nib")
    bm.to_mesh(me_n)
    nib_o = link(bpy.data.objects.new(name, me_n))
    steel = mat(name + "Steel", (0.6, 0.6, 0.62), 0.2)
    steel.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
    me_n.materials.append(steel)
    bm2 = bmesh.new()
    bmesh.ops.create_cone(bm2, cap_ends=True, segments=16, radius1=0.0048, radius2=0.0036, depth=0.15,
                          matrix=Matrix.Translation((0, 0, 0.105)))
    me_h = bpy.data.meshes.new(name + "_holder")
    bm2.to_mesh(me_h)
    for p in me_h.polygons:
        p.use_smooth = True
    holder = link(bpy.data.objects.new(name + "_holder", me_h))
    me_h.materials.append(mat(name + "Lacquer", (0.015, 0.012, 0.012), 0.25))
    holder.parent = nib_o
    return nib_o


# pen in the girl's hand (shots with the girl): its tip under the right index fingertip
pen_hand = make_pen("PenHand")
sc.frame_set(40)
tip = rig.matrix_world @ pb["mixamorig:RightHandIndex3"].tail
nib_w = Vector((tip.x + 0.004, tip.y - 0.012, DT + 0.001))
axis = (Vector((-0.45, 0.55, 0.70))).normalized()           # toward her right shoulder, up
pen_hand.matrix_world = Matrix.Translation(nib_w) @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4()
bpy.context.view_layer.update()
mw = pen_hand.matrix_world.copy()
pen_hand.parent = rig
pen_hand.parent_type = "BONE"
pen_hand.parent_bone = "mixamorig:RightHand"
bpy.context.view_layer.update()
pen_hand.matrix_world = mw

# free pen for the macro (shot 2): follows the written ink
nib = json.load(open(os.path.join(TEX, "nib.json")))
pen_free = make_pen("PenFree")
yaw = letter.rotation_euler.z
ux = Matrix.Rotation(yaw, 3, "Z") @ Vector((-1, 0, 0))
vy = Matrix.Rotation(yaw, 3, "Z") @ Vector((0, -1, 0))


def uv_world(u, v, lift=0.0):
    return LETTER_C + ux * (u - 0.5) * 0.16 + vy * (v - 0.5) * 0.21 + Vector((0, 0, lift))


ema = None
for f in range(1, 301):
    u, v, lift = nib[str(f)]
    p = uv_world(u, v, lift + 0.0004)
    wig = 0.0015 * math.sin(f * 1.7)
    p += ux * wig * 0.3
    pen_free.location = p
    roll = math.radians(3 * math.sin(f * 0.5))
    pen_free.rotation_euler = (axis.to_track_quat("Z", "Y") @ Quaternion((0, 0, 1), roll)).to_euler()
    pen_free.keyframe_insert("location", frame=f)
    pen_free.keyframe_insert("rotation_euler", frame=f)

# ------------------------------------------------------------------ room
wall_m = mat("Plaster", (0.30, 0.26, 0.22), 0.9, bump=0.15, scale=0.3)
floor_m = mat("Floor", (0.16, 0.10, 0.06), 0.55, bump=0.2)
nt = floor_m.node_tree
wv = nt.nodes.new("ShaderNodeTexWave")
wv.wave_type = "BANDS"
wv.bands_direction = "X"
wv.inputs["Scale"].default_value = 4.0
wv.inputs["Distortion"].default_value = 6.0
cr = nt.nodes.new("ShaderNodeValToRGB")
cr.color_ramp.elements[0].color = (0.07, 0.04, 0.025, 1)
cr.color_ramp.elements[1].color = (0.20, 0.12, 0.07, 1)
nt.links.new(wv.outputs["Fac"], cr.inputs["Fac"])
nt.links.new(cr.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
RX, RYB, RYF, RH = 1.8, 1.5, -1.9, 2.6
box("Floor", (2 * RX + 0.2, RYB - RYF + 0.2, 0.02), (0, (RYB + RYF) / 2, -0.01), floor_m)
box("WallBack", (2 * RX, 0.05, RH), (0, RYB, RH / 2), wall_m)
box("WallFront", (2 * RX, 0.05, RH), (0, RYF, RH / 2), wall_m)
box("WallL", (0.05, RYB - RYF, RH), (RX, (RYB + RYF) / 2, RH / 2), wall_m)
box("WallR", (0.05, RYB - RYF, RH), (-RX, (RYB + RYF) / 2, RH / 2), wall_m)
box("Ceiling", (2 * RX, RYB - RYF, 0.05), (0, (RYB + RYF) / 2, RH), wall_m)
trim = mat("Trim", (0.12, 0.08, 0.05), 0.5)
box("Skirting", (2 * RX, 0.03, 0.14), (0, RYB - 0.04, 0.07), trim)


def window(name, center, normal_axis, w=0.8, h=1.0):
    """Four-pane window: wood frame, night sky plane outside (emissive)."""
    cx, cy, cz = center
    sky = mat(name + "Sky", (0, 0, 0), 1.0, emit=(0.10, 0.18, 0.42), emit_strength=2.2)
    if normal_axis == "Y":
        box(name + "Sky", (w, 0.01, h), (cx, cy + 0.04, cz), sky)
        for dx in (-w / 2, 0, w / 2):
            box(name + f"V{dx}", (0.045, 0.06, h + 0.04), (cx + dx, cy - 0.01, cz), trim)
        for dz in (-h / 2, 0, h / 2):
            box(name + f"H{dz}", (w + 0.04, 0.06, 0.045), (cx, cy - 0.01, cz + dz), trim)
        box(name + "Sill", (w + 0.16, 0.14, 0.04), (cx, cy - 0.06, cz - h / 2 - 0.03), trim)
    else:
        box(name + "Sky", (0.01, w, h), (cx + 0.04 * (1 if cx > 0 else -1), cy, cz), sky)
        for dy in (-w / 2, 0, w / 2):
            box(name + f"V{dy}", (0.06, 0.045, h + 0.04), (cx, cy + dy, cz), trim)
        for dz in (-h / 2, 0, h / 2):
            box(name + f"H{dz}", (0.06, w + 0.04, 0.045), (cx, cy, cz + dz), trim)


# cut the window openings by leaving the wall and placing the sky just in front of it
window("WinBack", (-0.85, RYB - 0.03, 1.35), "Y")
window("WinFront", (0.55, RYF + 0.03, 1.4), "Y")
bpy.data.objects["WinBackSky"].location.y = RYB - 0.04
bpy.data.objects["WinFrontSky"].location.y = RYF + 0.04

shelf, _ = import_gltf(PH, "wooden_bookshelf_worn")
shelf.location = (0.75, RYB - 0.32, 0)
shelf.rotation_euler = (0, 0, math.pi)
shelf_z, zc = [], 2.3                       # real shelf boards, found by casting down through the shelf
while True:
    h = ray((0.75 - 0.25, RYB - 0.32, zc), (0, 0, -1))
    if h is None or h.z < 0.01:
        break
    shelf_z.append(h.z)
    zc = h.z - 0.03
print("shelf boards", [round(z, 3) for z in shelf_z])
tops = shelf_z[2::2]                        # upper faces of the boards, below the crown
for i, (dx, dz) in enumerate([(dx, dz) for dz in tops for dx in (0.62, 0.08)]):
    bk, _ = import_gltf(PH, "book_encyclopedia_set_01")
    bk.location = (0.75 + dx, RYB - 0.32, dz)
    bk.rotation_euler = (0, 0, math.pi)
wheel, _ = import_gltf(PH, "spinning_wheel_01")
wheel.location = (-1.25, 0.75, 0)
wheel.rotation_euler = (0, 0, math.radians(35))
rock, _ = import_gltf(PH, "Rockingchair_01")
rock.location = (1.25, 0.2, 0)
rock.rotation_euler = (0, 0, math.radians(-120))
drawer, _ = import_gltf(PH, "vintage_wooden_drawer_01")
drawer.scale = (0.75,) * 3
drawer.location = (-1.22, RYF + 0.36, 0)
drawer.rotation_euler = (0, 0, math.pi)
clock, _ = import_gltf(PH, "mantel_clock_01")
clock.location = (-1.22, RYF + 0.36, 1.09 * 0.75)
jug, _ = import_gltf(PH, "jug_01")
jug.location = (-0.82, RYF + 0.36, 1.09 * 0.75)
pic, _ = import_gltf(PH, "hanging_picture_frame_02")
pic.location = (-0.15, RYB - 0.03, 1.55)
pic.rotation_euler = (0, 0, math.pi)

# ------------------------------------------------------------------ Grace's look: calico dress, brown hair
sm = bpy.data.objects["suit"].data.materials[0]
for n in sm.node_tree.nodes:
    if n.type == "TEX_IMAGE":
        n.image = bpy.data.images.load(CALICO)
        tc = sm.node_tree.nodes.new("ShaderNodeTexCoord")
        mp = sm.node_tree.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (3, 3, 3)
        sm.node_tree.links.new(tc.outputs["UV"], mp.inputs[0])
        sm.node_tree.links.new(mp.outputs[0], n.inputs[0])
hm = bpy.data.objects["hair"].data.materials[0]
hnt = hm.node_tree
hb = hnt.nodes["Principled BSDF"]
src = hb.inputs["Base Color"].links[0].from_socket
# ponytail01's own texture is already brown
hb.inputs["Roughness"].default_value = 0.6

# ------------------------------------------------------------------ lights
world = bpy.data.worlds.new("Night")
sc.world = world
world.use_nodes = True
wn = world.node_tree
env = wn.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(PH, "hdri", "rogland_moonlit_night.hdr"))
wn.links.new(env.outputs["Color"], wn.nodes["Background"].inputs["Color"])
wn.nodes["Background"].inputs["Strength"].default_value = 0.35


def light(name, kind, loc, energy, color, size=0.1, target=None):
    ld = bpy.data.lights.new(name, kind)
    ld.energy, ld.color = energy, color
    if kind == "AREA":
        ld.size = size
    else:
        ld.shadow_soft_size = size
    ob = link(bpy.data.objects.new(name, ld))
    ob.location = loc
    if target is not None:
        ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


lampL = light("LampKey", "POINT", FLAME + Vector((0, 0, 0.01)), 22, (1.0, 0.55, 0.22), 0.02)
flick = np.random.default_rng(11).normal(0, 1, 320)
flick = np.convolve(flick, np.ones(4) / 4, "same")
for f in range(1, 301):                       # baked flicker (drivers are off with --disable-autoexec)
    lampL.data.energy = 22 * (1 + 0.07 * flick[f] + 0.03 * math.sin(f * 1.3))
    lampL.data.keyframe_insert("energy", frame=f)
moon = light("MoonRim", "AREA", (-0.85, RYB - 0.25, 1.45), 70, (0.45, 0.6, 1.0), 0.9, target=EYES40)
moon2 = light("MoonFront", "AREA", (0.55, RYF + 0.3, 1.5), 25, (0.40, 0.55, 1.0), 0.9, target=(0, 0, 0.7))
bounce = light("LampBounce", "AREA", (FLAME.x - 0.1, FLAME.y + 0.05, DT + 0.02), 6, (1.0, 0.6, 0.3), 0.3,
               target=EYES40)
cardfill = light("CardFill", "AREA", (CARD_XY.x + 0.15, CARD_XY.y + 0.30, DT + 0.22), 9, (1.0, 0.68, 0.38), 0.25,
                 target=(CARD_XY.x, CARD_XY.y, DT + 0.11))
paperbounce = light("PaperBounce", "AREA", (LETTER_C.x - 0.05, LETTER_C.y + 0.05, DT + 0.03), 5, (1.0, 0.72, 0.45),
                    0.25, target=EYES40)          # warm light off the letter onto her face

# ------------------------------------------------------------------ head aim + face
act = rig.animation_data.action
hbone = pb["mixamorig:Head"]
hcurves = [act.fcurves.find('pose.bones["mixamorig:Head"].rotation_quaternion', index=i) for i in range(4)]
rest_rot = rig.data.bones["mixamorig:Head"].matrix_local.to_quaternion()
face_local = rest_rot.inverted() @ Vector((0, -1, 0))
UP_LEFT = None


def head_target(f, eyes):
    """Where Grace looks (world point) and how strongly the head turns to it."""
    if f <= SHOTS["s2"][1]:
        return uv_world(*nib[str(max(f, 76))][:2]) + Vector((0, 0, 0.02)), 0.9
    if f <= SHOTS["s3"][1]:                       # thinking: up and to her right, then back down with a smirk
        up = eyes + Vector((-0.40, -0.7, 0.28))
        t = np.clip((f - 136) / 6, 0, 1)
        return up.lerp(eyes + Vector((-0.12, -0.8, -0.06)), t), 0.8
    return CARD + Vector((0, 0, 0.0)), 0.85       # final: she looks at the portrait


new = []
for f in range(1, 301):
    sc.frame_set(f)
    m = rig.matrix_world @ hbone.matrix
    mr = m.to_3x3().normalized().to_quaternion()
    eye = m @ Vector((0, 0.09, 0))
    tgt, w = head_target(f, eye)
    c = (mr @ face_local).rotation_difference(tgt - eye)
    c = Quaternion().slerp(c, w)
    new.append((f, hbone.rotation_quaternion.copy() @ (mr.inverted() @ c @ mr)))
for f, q in new:
    for i in range(4):
        hcurves[i].keyframe_points[f - 1].co.y = q[i]
for fcv in hcurves:
    fcv.update()


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
       "eyeLookUpLeft", "eyeLookUpRight", "eyeLookOutRight", "eyeLookInLeft", "eyeLookOutLeft", "eyeLookInRight",
       "mouthPucker", "eyeSquintLeft", "eyeSquintRight", "cheekSquintLeft", "cheekSquintRight", "mouthDimpleLeft"]
face(1, **{k: 0.0 for k in ALL})
writing = dict(eyeLookDownLeft=0.45, eyeLookDownRight=0.45, browDownLeft=0.2, browDownRight=0.2,
               mouthPressLeft=0.25, mouthPressRight=0.25, mouthPucker=0.1)
face(2, **writing)
face(73, **writing)
# shot 3: thinking -> sly smirk
face(125, eyeLookDownLeft=0.0, eyeLookDownRight=0.0, eyeLookUpLeft=0.6, eyeLookUpRight=0.6, eyeLookOutRight=0.35,
     eyeLookInLeft=0.35, browInnerUp=0.35, mouthPucker=0.3, mouthPressLeft=0.2, mouthPressRight=0.2, browDownLeft=0, browDownRight=0)
face(135, eyeLookUpLeft=0.6, eyeLookUpRight=0.6, eyeLookOutRight=0.35, eyeLookInLeft=0.35, browInnerUp=0.35, mouthPucker=0.3,
     mouthSmileLeft=0.0, mouthSmileRight=0.0, eyeSquintLeft=0.0, eyeSquintRight=0.0, browOuterUpRight=0.0, cheekSquintLeft=0.0)
face(139, eyeLookUpLeft=0.0, eyeLookUpRight=0.0, eyeLookOutRight=0.0, eyeLookInLeft=0.0, browInnerUp=0.0, mouthPucker=0.0,
     eyeLookDownLeft=0.3, eyeLookDownRight=0.3, mouthSmileLeft=0.8, mouthSmileRight=0.3, eyeSquintLeft=0.4, eyeSquintRight=0.35,
     browOuterUpRight=0.4, cheekSquintLeft=0.35, browDownLeft=0.25, mouthPressLeft=0.0, mouthPressRight=0.0)
face(148, mouthSmileLeft=0.85, mouthSmileRight=0.35)
# shot 7: delighted, proud
face(271, mouthSmileLeft=0.3, mouthSmileRight=0.3, eyeLookDownLeft=0.2, eyeLookDownRight=0.2, eyeSquintLeft=0.0,
     eyeSquintRight=0.0, browOuterUpRight=0.0, cheekSquintLeft=0.0, browDownLeft=0.0, eyeWideLeft=0.0, eyeWideRight=0.0, jawOpen=0.0)
face(276, mouthSmileLeft=0.9, mouthSmileRight=0.9, eyeWideLeft=0.35, eyeWideRight=0.35, browInnerUp=0.35,
     browOuterUpLeft=0.35, browOuterUpRight=0.35, jawOpen=0.08, eyeSquintLeft=0.2, eyeSquintRight=0.2,
     cheekSquintLeft=0.3, cheekSquintRight=0.3)
face(300, mouthSmileLeft=0.95, mouthSmileRight=0.95, eyeWideLeft=0.15, eyeWideRight=0.15, eyeSquintLeft=0.4,
     eyeSquintRight=0.4, cheekSquintLeft=0.4, cheekSquintRight=0.4, jawOpen=0.1, browInnerUp=0.3)
for bl in (30, 287):
    face(bl - 2, eyeBlinkLeft=0.0, eyeBlinkRight=0.0)
    face(bl, eyeBlinkLeft=1.0, eyeBlinkRight=1.0)
    face(bl + 3, eyeBlinkLeft=0.0, eyeBlinkRight=0.0)

# ------------------------------------------------------------------ visibility per shot
key_hide(GIRL_OBJS + [pen_hand, bpy.data.objects["PenHand_holder"]], frames_of(*GIRL_HIDDEN))
key_hide([pen_free, bpy.data.objects["PenFree_holder"]], set(range(1, 301)) - frames_of("s2"))
key_hide([reply], set(range(1, 301)) - set(range(SHOTS["s5"][0], 301)))
key_hide([letter], set(range(SHOTS["s5"][0], 301)))
key_hide([envelope], set(range(1, SHOTS["s5"][0])))
# reply lands on the table at the start of shot 5
r0 = reply.location.copy()
for f, dz, yaw in ((SHOTS["s5"][0], 0.025, 8), (SHOTS["s5"][0] + 4, 0.002, 3), (SHOTS["s5"][0] + 6, 0.0, 2)):
    reply.location = r0 + Vector((0, 0, dz))
    reply.rotation_euler = (0, 0, math.radians(yaw))
    reply.keyframe_insert("location", frame=f)
    reply.keyframe_insert("rotation_euler", frame=f)

# ------------------------------------------------------------------ camera
cd = bpy.data.cameras.new("Cam")
cam = link(bpy.data.objects.new("Cam", cd))
sc.camera = cam
cd.sensor_width = 36
cd.sensor_fit = "AUTO"
cd.clip_start = 0.02
cd.dof.use_dof = True


def eyes_at(f):
    """Point between the eyes on the face surface (head centre + 8.5 cm along the face direction)."""
    sc.frame_set(f)
    m = rig.matrix_world @ hbone.matrix
    fwd = m.to_3x3().normalized().to_quaternion() @ face_local
    return m @ Vector((0, 0.09, 0)) + fwd * 0.085


def ease(t, kind):
    if kind == "out":
        return 1 - (1 - t) ** 3
    if kind == "whip":
        return 1 - (1 - t) ** 4
    return t * t * (3 - 2 * t)


reply_lay = json.load(open(os.path.join(TEX, "reply.json")))


def reply_uv(u, v):
    yaw2 = math.radians(2)
    ux2 = Matrix.Rotation(yaw2, 3, "Z") @ Vector((-1, 0, 0))
    vy2 = Matrix.Rotation(yaw2, 3, "Z") @ Vector((0, -1, 0))
    return r0 + ux2 * (u - 0.5) * 0.16 + vy2 * (v - 0.5) * 0.21


card_x = CARD_N.cross(Vector((0, 0, 1))).normalized()
card_up = card_x.cross(CARD_N).normalized()
pj = json.load(open(os.path.join(POR, "portrait.json")))
cx0, cy0, cx1, cy1 = pj["crop"]


def card_uv_world(u, v):
    """World point on the artwork for an image UV, via the art polygons' own UV layout."""
    me = art_o.data
    me.calc_loop_triangles()
    uvl = me.uv_layers.active.data
    for tri in me.loop_triangles:
        if me.materials[tri.material_index] != ms_art:
            continue
        a, b, c = (Vector(uvl[l].uv) for l in tri.loops)
        den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
        if abs(den) < 1e-12:
            continue
        w1 = ((b.y - c.y) * (u - c.x) + (c.x - b.x) * (v - c.y)) / den
        w2 = ((c.y - a.y) * (u - c.x) + (a.x - c.x) * (v - c.y)) / den
        w3 = 1 - w1 - w2
        if min(w1, w2, w3) >= -1e-4:
            pa, pb_, pc = (art_o.matrix_world @ me.vertices[me.loops[l].vertex_index].co for l in tri.loops)
            return pa * w1 + pb_ * w2 + pc * w3 + CARD_N * 0.001
    return None


def img_uv(x, y):
    return ((x - cx0) / (cx1 - cx0), 1 - (y - cy0) / (cy1 - cy0))


poly = pj["poly"]
tip = max(poly, key=lambda p: p[1])
mouth = (670, 740)
CHIN = card_uv_world(*img_uv(*tip)) or CARD
MOUTH = card_uv_world(*img_uv(*mouth)) or CARD
JAW_L = card_uv_world(*img_uv(*poly[0])) or CARD
JAW_R = card_uv_world(*img_uv(*poly[-1])) or CARD
FACE_C = (MOUTH + JAW_L + JAW_R + CHIN) / 4
print("chin", CHIN, "mouth", MOUTH, "face centre", FACE_C)
for ob in bpy.data.objects:
    if ob.type == "LIGHT":
        ob.visible_camera = False
hs = bpy.data.objects["hair"].modifiers.new("Smooth", "SUBSURF")
hs.levels, hs.render_levels = 0, 1
nib_ema = {}
e = None
for f in range(1, 301):
    u, v, _ = nib[str(f)]
    p = uv_world(u, v)
    e = p if e is None else e.lerp(p, 0.3)
    nib_ema[f] = e.copy()

cam_track = {}
for f in range(1, 301):
    eyes = eyes_at(f)
    if f <= SHOTS["s1a"][1]:
        a, b = SHOTS["s1a"]; t = ease((f - a) / (b - a), "inout")
        frm = Vector((-0.42, -1.82, 1.16)).lerp(Vector((-0.30, -1.30, 1.0)), t)
        to = Vector((0.08, -0.1, 0.78)).lerp(eyes + Vector((0.07, 0, -0.14)), t)
        lens, fs, up = 22 + 8 * t, 4.0, Vector((0, 0, 1))
    elif f <= SHOTS["s1b"][1]:
        a, b = SHOTS["s1b"]; t = ease((f - a) / (b - a), "inout")
        frm = Vector((-0.30, -0.74, 0.76)).lerp(Vector((-0.24, -0.63, 0.77)), t)
        to = eyes + Vector((0, 0, -0.04))
        lens, fs, up = 45 + 5 * t, 2.2, Vector((0, 0, 1))
    elif f <= SHOTS["s2"][1]:
        a, b = SHOTS["s2"]; t = ease((f - a) / (b - a), "inout")
        n = nib_ema[f]
        frm = n + (-vy * 0.16 + Vector((0, 0, 0.0))).lerp(-vy * 0.12, t) + Vector((0, 0, 0.17 - 0.03 * t)) - ux * 0.03
        to = n
        lens, fs, up = 60, 3.2, vy
    elif f <= SHOTS["s3"][1]:
        a, b = SHOTS["s3"]; t = ease((f - a) / (b - a), "inout")
        frm = Vector((-0.28, -0.74, 0.99)).lerp(Vector((-0.23, -0.66, 0.98)), t)
        to = eyes + Vector((0, 0, 0.035))              # headroom above her for the light-bulb pop
        lens, fs, up = 40 + 4 * t, 2.4, Vector((0, 0, 1))
    elif f <= SHOTS["s4"][1]:
        a, b = SHOTS["s4"]; t = ease((f - a) / (b - a), "inout")
        frm = (CARD + CARD_N * 0.40 + Vector((0, 0, 0.02))).lerp(FACE_C + CARD_N * 0.27, t)
        to = CARD.lerp(FACE_C, t)
        lens, fs, up = 55 + 10 * t, 2.8, Vector((0, 0, 1))
    elif f <= SHOTS["s5"][1]:
        a, b = SHOTS["s5"]; t = ease((f - a) / (b - a), "inout")
        top = reply_uv(0.36, reply_lay["whiskers_v"] + 0.04)
        bot = reply_uv(0.28, reply_lay["silly_v"])
        to = top.lerp(bot, t)
        frm = to + vy * (-0.10) + Vector((0, 0, 0.20 - 0.03 * t))
        lens, fs, up = 55, 5.6, vy
    elif f <= SHOTS["s6"][1]:
        a, b = SHOTS["s6"]
        if f < a + 6:
            t = ease((f - a) / 6, "whip")
            frm = (FACE_C + CARD_N * 0.50 - card_x * 0.13 + Vector((0, 0, 0.06))).lerp(FACE_C + CARD_N * 0.25, t)
        else:
            t = ease((f - a - 6) / (b - a - 6), "inout")
            frm = (FACE_C + CARD_N * 0.25).lerp(FACE_C + CARD_N * 0.22, t)
        to = FACE_C
        lens, fs, up = 65, 2.8, Vector((0, 0, 1))
    else:
        a, b = SHOTS["s7"]; t = ease((f - a) / (b - a), "inout")
        frm = Vector((-0.30, -0.80, 0.84)).lerp(Vector((-0.24, -0.69, 0.85)), t)
        to = eyes + Vector((0, 0, -0.035))
        lens, fs, up = 44 + 6 * t, 2.0, Vector((0, 0, 1))
    cam.location = frm
    cam.rotation_euler = aim_rot(frm, to, up)
    cd.lens = lens
    cd.dof.aperture_fstop = fs
    cd.dof.focus_distance = ((eyes if f in frames_of("s1b", "s3", "s7") else to) - frm).length
    for path in ("location", "rotation_euler"):
        cam.keyframe_insert(path, frame=f)
    cd.keyframe_insert("lens", frame=f)
    cd.dof.keyframe_insert("focus_distance", frame=f)
    cd.dof.keyframe_insert("aperture_fstop", frame=f)
    cam_track[f] = (frm, to)
for fcv in list(cam.animation_data.action.fcurves) + list(cd.animation_data.action.fcurves):
    for kp in fcv.keyframe_points:
        kp.interpolation = "LINEAR"

# ------------------------------------------------------------------ render + look
look.render_settings(sc, 540, 960, 80, 12)
look.compositor(sc, fog=(0.03, 0.07, 0.17), fog_amount=0.5, mist_start=0.8, mist_depth=4.0, glow=3.0)
EXPO = dict(s1a=0.0, s1b=-0.25, s2=-0.35, s3=-0.25, s4=-0.9, s5=-0.75, s6=-0.9, s7=-0.25)   # paper/photo macros run hot
for name, (a, b) in SHOTS.items():
    for f in (a, b):
        sc.view_settings.exposure = EXPO[name]
        sc.view_settings.keyframe_insert("exposure", frame=f)
for fcv in sc.animation_data.action.fcurves:
    for kp in fcv.keyframe_points:
        kp.interpolation = "CONSTANT"

# ------------------------------------------------------------------ 2D overlay anchors for post (screen UV, y up)
post = {"bulb": {}, "sparkle": {}}
for f in range(SHOTS["s3"][0], SHOTS["s3"][1] + 1):
    sc.frame_set(f)
    top = rig.matrix_world @ pb["mixamorig:Head"].tail
    p = world_to_camera_view(sc, cam, top + Vector((0.0, 0.0, 0.06)))
    post["bulb"][f] = (p.x, p.y)
for f in range(SHOTS["s6"][0], SHOTS["s6"][1] + 1):
    sc.frame_set(f)
    p = world_to_camera_view(sc, cam, CHIN)
    post["sparkle"][f] = (p.x, p.y)
json.dump(post, open(POST, "w"))
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved scene")
