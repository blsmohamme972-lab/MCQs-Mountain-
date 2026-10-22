"""Download Poly Haven glTF models (1k) and one HDRI. python3 ph_get.py <outdir> <hdri> <model>..."""
import json
import os
import sys
import urllib.request

UA = {"User-Agent": "KafuClip/1.0"}


def get(url, path=None):
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=120).read()
    if path:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "wb").write(data)
    return data


out, hdri, models = sys.argv[1], sys.argv[2], sys.argv[3:]
for m in models:
    files = json.loads(get(f"https://api.polyhaven.com/files/{m}"))
    g = files["gltf"]["1k"]["gltf"]
    d = os.path.join(out, m)
    get(g["url"], os.path.join(d, os.path.basename(g["url"])))
    for rel, inc in g.get("include", {}).items():
        get(inc["url"], os.path.join(d, rel))
    print("model", m)
files = json.loads(get(f"https://api.polyhaven.com/files/{hdri}"))
h = files["hdri"]["1k"]["hdr"]["url"]
get(h, os.path.join(out, "hdri", hdri + ".hdr"))
print("hdri", hdri)
