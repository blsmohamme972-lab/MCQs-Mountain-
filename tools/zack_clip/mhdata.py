"""Pure-data readers for MakeHuman CC0 files (OBJ, .target(.gz), .mhclo).
No MakeHuman/MPFB code is used; only their data files are parsed."""
import gzip
import numpy as np


def read_obj(path):
    v, vt, faces, fuv, fgrp = [], [], [], [], []
    groups = {}
    grp = None
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("v "):
                v.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                vt.append([float(x) for x in line.split()[1:3]])
            elif line.startswith("g "):
                grp = line.split(None, 1)[1].strip()
            elif line.startswith("f "):
                ids, uvs = [], []
                for tok in line.split()[1:]:
                    p = tok.split("/")
                    ids.append(int(p[0]) - 1)
                    uvs.append(int(p[1]) - 1 if len(p) > 1 and p[1] else -1)
                faces.append(ids)
                fuv.append(uvs)
                fgrp.append(grp)
                groups.setdefault(grp, set()).update(ids)
    return dict(v=np.array(v), vt=np.array(vt) if vt else None, faces=faces,
                fuv=fuv, fgrp=fgrp, groups=groups)


def read_target(path):
    op = gzip.open if path.endswith(".gz") else open
    idx, d = [], []
    with op(path, "rt") as fh:
        for line in fh:
            p = line.split()
            if len(p) == 4 and not line.startswith("#"):
                idx.append(int(p[0]))
                d.append([float(x) for x in p[1:]])
    return np.array(idx, dtype=int), np.array(d)


def ranges(tokens):
    out, toks, i = [], [t for t in tokens if t], 0
    while i < len(toks):
        if i + 2 < len(toks) and toks[i + 1] == "-":
            out.extend(range(int(toks[i]), int(toks[i + 2]) + 1))
            i += 3
        else:
            out.append(int(toks[i]))
            i += 1
    return out


def read_mhclo(path):
    info = dict(scale={}, refs=[], delete=[], obj=None, material=None)
    mode = None
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            p = s.split()
            head = p[0]
            if head[0].isalpha():
                if head in ("x_scale", "y_scale", "z_scale"):
                    info["scale"][head[0]] = (int(p[1]), int(p[2]), float(p[3]))
                elif head == "obj_file":
                    info["obj"] = p[1]
                elif head == "material":
                    info["material"] = p[1]
                elif head == "verts":
                    mode = "verts"
                elif head == "delete_verts":
                    mode = "delete"
                    info["delete"].extend(ranges(p[1:]))
                continue
            if mode == "verts":
                if len(p) >= 9:
                    info["refs"].append(([int(x) for x in p[0:3]],
                                         [float(x) for x in p[3:6]],
                                         [float(x) for x in p[6:9]]))
                else:
                    info["refs"].append(([int(p[0])] * 3, [1.0, 0, 0], [0.0] * 3))
            elif mode == "delete":
                info["delete"].extend(ranges(p))
    return info


def fit_proxy(clo, V):
    """V: morphed base verts in MakeHuman space. Returns fitted proxy verts (MH space)."""
    sc = np.ones(3)
    for ax, k in enumerate("xyz"):
        if k in clo["scale"]:
            a, b, ref = clo["scale"][k]
            sc[ax] = abs(V[a, ax] - V[b, ax]) / ref
    idx = np.array([r[0] for r in clo["refs"]])
    w = np.array([r[1] for r in clo["refs"]])
    off = np.array([r[2] for r in clo["refs"]])
    return (V[idx] * w[:, :, None]).sum(1) + off * sc, idx, w


def to_blender(a):
    a = np.asarray(a, dtype=float)
    return np.stack([a[..., 0], -a[..., 2], a[..., 1]], -1) * 0.1
