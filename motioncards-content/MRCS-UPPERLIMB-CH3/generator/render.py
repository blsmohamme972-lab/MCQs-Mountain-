#!/usr/bin/env python3
"""Preview one scene and write a contact sheet of frames (needs node + Playwright + ImageMagick montage).

usage: python generator/render.py q9327 [times=0,1500,3000,4500,6000,8000] [WxH=760x600]
Output: generator/out/<QID>_sheet.png (git-ignored)."""
import importlib, json, os, random, shutil, subprocess, sys, tempfile, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); CONTENT = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(CONTENT))
sys.path.insert(0, os.path.join(HERE, "scenes")); sys.path.insert(0, REPO)
from motioncards.lib.compiler import validate_scene, compile_scene
scene = importlib.import_module(sys.argv[1]).make(); qid = scene["qid"]
times = sys.argv[2] if len(sys.argv) > 2 else "0,1500,3000,4500,6000,8000"
w, h = (sys.argv[3] if len(sys.argv) > 3 else "760x600").split("x")
validate_scene(scene, qid, 8000); compile_scene(scene, ["http://127.0.0.1:8799"], preview=True)
print(f"scene ok: {len(scene['layers'])} layers, custom_renderer {len(scene['custom_renderer'])} chars")
out = os.path.join(HERE, "out"); os.makedirs(out, exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    ws = os.path.join(tmp, "ws")
    subprocess.run([sys.executable, "-I", os.path.join(REPO, "tools", "motioncards.py"), "scaffold",
                    os.path.join(CONTENT, "source", "MRCS-PARTA-550-2E_chapter-3.json"), "--out", ws,
                    "--package-id", "PREVIEW", "--revision", "1", "--qids", qid, "--duration-ms", "8000"], check=True, capture_output=True)
    with open(os.path.join(ws, "scenes", f"{qid}.scene.json"), "w", encoding="utf-8") as f:
        json.dump(scene, f, ensure_ascii=False)
    port = random.randint(20000, 40000)
    srv = subprocess.Popen([sys.executable, "-I", os.path.join(REPO, "tools", "motioncards.py"), "preview", "--workspace", ws, "--port", str(port)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(40):
            try: urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1); break
            except Exception: time.sleep(0.25)
        r = subprocess.run(["node", os.path.join(HERE, "shoot2.js"), str(port), out, w, h, times, qid], capture_output=True, text=True)
        print(r.stdout.strip() or "no page errors", r.stderr.strip()[-400:])
    finally:
        srv.terminate(); srv.wait()
files = [os.path.join(out, f"{qid}_t{t}.png") for t in times.split(",")]
sheet = os.path.join(out, f"{qid}_sheet.png")
subprocess.run(["montage", *files, "-tile", f"{min(3, len(files))}x", "-geometry", "620x+4+4", "-background", "#222", sheet], check=True)
print("sheet:", sheet)
