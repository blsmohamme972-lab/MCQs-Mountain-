#!/usr/bin/env python3
"""Rebuild the package: scaffold -> write scenes from generator/scenes/*.py -> package -> validate.

usage (from the repo root):
  python motioncards-content/MRCS-UPPERLIMB-CH3/generator/build.py [--revision 2] [--out dist/MCARDS_MRCS-UPPERLIMB-CH3_r2.zip]
Also refreshes ../scenes/*.scene.json so the committed scene JSON matches the generator."""
import argparse, importlib, json, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); CONTENT = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(CONTENT))
sys.path.insert(0, os.path.join(HERE, "scenes")); sys.path.insert(0, REPO)
from motioncards.lib.compiler import validate_scene, compile_scene
ap = argparse.ArgumentParser(); ap.add_argument("--revision", type=int, default=2); ap.add_argument("--out")
a = ap.parse_args()
out = os.path.abspath(a.out or os.path.join(REPO, "dist", f"MCARDS_MRCS-UPPERLIMB-CH3_r{a.revision}.zip"))
src = os.path.join(CONTENT, "source", "MRCS-PARTA-550-2E_chapter-3.json")
mods = [f"q{n}" for n in range(9325, 9333)]
run = lambda *x: subprocess.run([sys.executable, "-I", os.path.join(REPO, "tools", "motioncards.py"), *x], check=True, capture_output=True, text=True).stdout
with tempfile.TemporaryDirectory() as tmp:
    ws = os.path.join(tmp, "ws")
    run("scaffold", src, "--out", ws, "--package-id", "MRCS-UPPERLIMB-CH3", "--revision", str(a.revision), "--count", "8", "--duration-ms", "8000")
    for m in mods:
        sc = importlib.import_module(m).make(); qid = sc["qid"]
        validate_scene(sc, qid, 8000); compile_scene(sc, ["https://kafu.blsmohamme97.workers.dev"])
        for d in (os.path.join(ws, "scenes"), os.path.join(CONTENT, "scenes")):
            with open(os.path.join(d, f"{qid}.scene.json"), "w", encoding="utf-8") as f:
                json.dump(sc, f, indent=1, ensure_ascii=False)
        print(qid, len(sc["layers"]), "layers,", len(sc["custom_renderer"]), "custom chars")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    print(run("package", src, "--workspace", ws, "--out", out)); print(run("validate", out))
