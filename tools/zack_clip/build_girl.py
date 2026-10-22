"""Build an 11-year-old girl in Blender from MakeHuman CC0 data files only.
Usage: blender --factory-startup --disable-autoexec -b -P build_girl.py -- <mpfb_data> <assets> <faceunits> <out.blend>"""
import json
import os
import sys

import bmesh
import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mhdata import fit_proxy, read_mhclo, read_obj, read_target, to_blender  # noqa: E402

DATA, ASSETS, FU, OUT = sys.argv[sys.argv.index("--") + 1:][:4]
T = os.path.join(DATA, "targets", "macrodetails")

CHILD, YOUNG = 0.93, 0.07
RACE = dict(caucasian=0.6, asian=0.25, african=0.15)
TARGETS = [
    ("universal-female-child-averagemuscle-averageweight", CHILD),
    ("universal-female-young-averagemuscle-averageweight", YOUNG),
    ("proportions/female-child-averagemuscle-averageweight-idealproportions", 0.5 * CHILD),
]
for race, f in RACE.items():
    TARGETS += [(f"{race}-female-child", f * CHILD), (f"{race}-female-young", f * YOUNG)]

PROXIES = [  # (folder, name, material color fallback)
    ("eyes/high-poly", "eyes", None),
    ("eyebrows/eyebrow001", "eyebrows", None),
    ("eyelashes/eyelashes01", "eyelashes", None),
    ("teeth/teeth_base", "teeth", None),
    ("tongue/tongue01", "tongue", None),
    ("hair/ponytail01", "hair", None),
    ("clothes/female_casualsuit01", "suit", None),
    ("clothes/shoes01", "shoes", None),
]

# ---------------------------------------------------------------- morph
base = read_obj(os.path.join(DATA, "3dobjs", "base.obj"))
V = base["v"].copy()
for name, w in TARGETS:
    idx, d = read_target(os.path.join(T, name + ".target.gz"))
    if len(idx):
        V[idx] += w * d
HEIGHT_T = "height/female-child-averagemuscle-averageweight-maxheight"
body_ids = sorted(base["groups"]["body"])
hidx, hd = read_target(os.path.join(T, HEIGHT_T + ".target.gz"))
h0 = np.ptp(V[body_ids, 1])
Vt = V.copy(); Vt[hidx] += hd
hw = (14.0 - h0) / (np.ptp(Vt[body_ids, 1]) - h0)
print("height target weight", hw)
V[hidx] += hw * hd
VB = to_blender(V)
ground = VB[sorted(base["groups"]["body"]), 2].min()
VB[:, 2] -= ground
print("height m:", VB[body_ids, 2].max())

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)


def make_mesh(name, verts, faces, fuv, uvs):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(), [], faces)
    if uvs is not None:
        lay = me.uv_layers.new(name="UV")
        flat = [uvs[i] for f in fuv for i in f]
        lay.data.foreach_set("uv", np.array(flat).ravel())
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def material(name, tex=None, color=(0.8, 0.8, 0.8), rough=0.6, alpha=False, emit=None, hsv=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    if tex and os.path.exists(tex):
        im = nt.nodes.new("ShaderNodeTexImage")
        im.image = bpy.data.images.load(tex)
        if hsv:
            hs = nt.nodes.new("ShaderNodeHueSaturation")
            hs.inputs["Hue"].default_value, hs.inputs["Saturation"].default_value, hs.inputs["Value"].default_value = hsv
            nt.links.new(im.outputs["Color"], hs.inputs["Color"])
            nt.links.new(hs.outputs["Color"], bsdf.inputs["Base Color"])
        else:
            nt.links.new(im.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha:
            nt.links.new(im.outputs["Alpha"], bsdf.inputs["Alpha"])
            m.blend_method = "HASHED"
    return m


def mhmat_tex(folder, mat):
    path = os.path.join(folder, mat) if mat else None
    if not path or not os.path.exists(path):
        cands = [f for f in os.listdir(folder) if f.endswith(".mhmat")]
        if not cands:
            return None
        path = os.path.join(folder, cands[0])
    for line in open(path, encoding="utf-8", errors="replace"):
        if line.startswith("diffuseTexture"):
            return os.path.join(folder, line.split()[1])
    return None


# ---------------------------------------------------------------- body
bfaces = [f for f, g in zip(base["faces"], base["fgrp"]) if g == "body"]
bfuv = [f for f, g in zip(base["fuv"], base["fgrp"]) if g == "body"]
body = make_mesh("Girl", VB, bfaces, bfuv, base["vt"])
skin = mhmat_tex(os.path.join(ASSETS, "skins", "young_caucasian_female"), None)
body.data.materials.append(material("Skin", skin, rough=0.5))

# ---------------------------------------------------------------- rig
rig = json.load(open(os.path.join(DATA, "rigs", "standard", "rig.mixamo.json")))["bones"]


def locate(spec):
    s = spec["strategy"]
    if s == "CUBE":
        return VB[sorted(base["groups"][spec["cube_name"]])].mean(0)
    if s == "MEAN":
        return VB[spec["vertex_indices"]].mean(0)
    if s == "VERTEX":
        return VB[spec["vertex_index"]]
    raise ValueError(s)


arm_data = bpy.data.armatures.new("GirlRig")
arm = bpy.data.objects.new("GirlRig", arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for name, b in rig.items():
    eb = arm_data.edit_bones.new(name)
    eb.head = locate(b["head"])
    eb.tail = locate(b["tail"])
    eb.roll = b.get("roll", 0.0)
for name, b in rig.items():
    if b.get("parent"):
        arm_data.edit_bones[name].parent = arm_data.edit_bones[b["parent"]]
bpy.ops.object.mode_set(mode="OBJECT")

wjs = json.load(open(os.path.join(DATA, "rigs", "standard", "weights.mixamo.json")))["weights"]
bones = list(rig)
W = np.zeros((len(V), len(bones)), dtype=np.float32)
for j, bn in enumerate(bones):
    for vi, w in wjs.get(bn, []):
        W[vi, j] = w


BODY_W = np.nonzero(W[body_ids].sum(1) > 0)[0]
BODY_W = np.array(body_ids)[BODY_W]


def apply_weights(ob, Wm):
    co = np.array([v.co[:] for v in ob.data.vertices])
    for i in np.nonzero(Wm.sum(1) <= 1e-6)[0]:  # unweighted: copy nearest weighted body vertex
        j = BODY_W[np.argmin(((VB[BODY_W] - co[i]) ** 2).sum(1))]
        Wm[i] = W[j]
    s = Wm.sum(1, keepdims=True)
    Wm = np.where(s > 0, Wm / np.maximum(s, 1e-9), 0)
    for j, bn in enumerate(bones):
        nz = np.nonzero(Wm[:, j] > 1e-3)[0]
        if len(nz):
            vg = ob.vertex_groups.new(name=bn)
            for vi in nz:
                vg.add([int(vi)], float(Wm[vi, j]), "REPLACE")
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    ob.parent = arm


apply_weights(body, W)

# ---------------------------------------------------------------- face units
units = {}
fudir = os.path.join(FU, "targets", "faceunits")
for fn in sorted(os.listdir(fudir)):
    if fn.endswith(".target"):
        idx, d = read_target(os.path.join(fudir, fn))
        full = np.zeros_like(VB)
        full[idx] = to_blender(d)
        units[fn[:-7]] = full


def add_keys(ob, deltas_fn):
    basis = np.array([v.co[:] for v in ob.data.vertices])
    ob.shape_key_add(name="Basis")
    for n, full in units.items():
        dl = deltas_fn(full)
        if np.abs(dl).max() < 1e-6:
            continue
        k = ob.shape_key_add(name=n, from_mix=False)
        k.data.foreach_set("co", (basis + dl).ravel())


add_keys(body, lambda full: full)

# ---------------------------------------------------------------- proxies
deleted = set()
for folder, name, _ in PROXIES:
    fdir = os.path.join(ASSETS, folder)
    clo = read_mhclo(os.path.join(fdir, [f for f in os.listdir(fdir) if f.endswith(".mhclo")][0]))
    obj = read_obj(os.path.join(fdir, clo["obj"]))
    pv, idx, w = fit_proxy(clo, V)
    pb = to_blender(pv)
    pb[:, 2] -= ground
    if name in ("teeth", "tongue"):  # adult-sized: shrink and sit them deeper in the child's mouth
        cen = pb.mean(0)
        pb = cen + (pb - cen) * (0.88 if name == "teeth" else 0.85) + np.array([0, 0.005, -0.002 if name == "teeth" else -0.004])
    ob = make_mesh(name, pb, obj["faces"], obj["fuv"], obj["vt"])
    tex = mhmat_tex(fdir, clo["material"])
    if name == "eyes":
        tex = os.path.join(ASSETS, "eyes", "materials", "brown_eye.png")
    alpha = name in ("hair", "eyebrows", "eyelashes", "eyes")
    ob.data.materials.append(material(name, tex, rough={"eyes": 0.25, "hair": 0.85}.get(name, 0.5), alpha=alpha,
                                              hsv=(0.53, 0.55, 0.75) if name == "eyes" else None))
    apply_weights(ob, (W[idx] * w[:, :, None]).sum(1))
    if name in ("eyebrows", "eyelashes", "teeth", "tongue", "eyes"):
        add_keys(ob, lambda full: (full[idx] * w[:, :, None]).sum(1))
    deleted.update(clo["delete"])
    print(name, len(pb), "verts, delete", len(clo["delete"]))

# hide body under clothes, drop helper/joint verts
bm = bmesh.new()
bm.from_mesh(body.data)
bm.verts.ensure_lookup_table()
kill = [f for f in bm.faces if any(v.index in deleted for v in f.verts)]
bmesh.ops.delete(bm, geom=kill, context="FACES_ONLY")
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context="VERTS")
bm.to_mesh(body.data)
bm.free()
print("body verts", len(body.data.vertices))

bpy.ops.wm.save_as_mainfile(filepath=OUT)
