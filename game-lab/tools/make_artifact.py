"""Build the phone copy of v2 (both tiers) as a claude.ai Artifact folder: the page without its document wrapper,
Google Fonts Fredoka and Nunito, the engine and filters from cdnjs with Subresource Integrity hashes of the npm files
(jsDelivr as the fallback), and the code, art and sound as supporting files under assets/.

The repo files stay the source of truth: this only copies and rewrites LAB_CONFIG. Run after fetch_engine.py and
fetch_assets.py. Usage: python3 game-lab/tools/make_artifact.py <out-dir>
Then publish <out-dir>/index.html with its files (the script prints the file map as JSON).
"""
from __future__ import annotations
import base64
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
V2 = LAB / "v2"
LOCK = json.loads((LAB / "tools" / "engine-lock.json").read_text())
CDN = {
    "pixi.js": ("https://cdnjs.cloudflare.com/ajax/libs/pixi.js/{v}/pixi.min.js", "https://cdn.jsdelivr.net/npm/pixi.js@{v}/dist/pixi.min.js"),
    "pixi-filters": ("https://cdnjs.cloudflare.com/ajax/libs/pixi-filters/{v}/pixi-filters.js", "https://cdn.jsdelivr.net/npm/pixi-filters@{v}/dist/pixi-filters.js"),
}
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800&display=swap">')


def engine(pkg: str) -> dict:
    item = next(i for i in LOCK["files"] if i["package"] == pkg)
    raw = (LAB / item["path"]).read_bytes()
    if hashlib.sha256(raw).hexdigest() != item["sha256"]:
        raise SystemExit("vendor file does not match its lock: " + item["path"])
    sri = "sha384-" + base64.b64encode(hashlib.sha384(raw).digest()).decode()
    a, b = CDN[pkg]
    return {"src": a.format(v=item["version"]), "integrity": sri, "fallback": b.format(v=item["version"])}


def main(out: Path) -> None:
    if out.exists():
        shutil.rmtree(out)
    (out / "assets" / "light").mkdir(parents=True)
    html = (V2 / "index.html").read_text()
    head = html[html.index("<style>"):html.index("</style>") + len("</style>")]
    body = html[html.index("<body>") + len("<body>"):html.index("</body>")]
    pixi, filters = engine("pixi.js"), engine("pixi-filters")
    cfg = {
        "light": {"scripts": [pixi, "world.js"], "assetBase": "assets/light/"},
        "hd": {"scripts": [pixi, filters, "world-hd.js"], "assetBase": "assets/"},
        "soundBase": "assets/",
    }
    old = re.search(r"window\.LAB_CONFIG = \{.*?\n\};", body, re.S).group(0)
    sounds = re.search(r"sounds: (\{.*?\})", old).group(1)
    new = "window.LAB_CONFIG = " + json.dumps(cfg, indent=1)[:-2] + ",\n \"sounds\": " + sounds + "\n};"
    body = body.replace(old, new)
    title = "<title>MCQs Mountain</title>"
    meta = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="claude:viewport-fit-sides" content="cover">'
    (out / "index.html").write_text(title + "\n" + meta + "\n" + FONTS + "\n" + head + "\n" + body.strip() + "\n")
    files = {}
    for n in ("questions.js", "app.js", "world.js", "world-hd.js"):
        shutil.copy(V2 / n, out / n)
        files[n] = str(out / n)
    for src, dst in ((LAB / "assets-test" / "build-hd", "assets"), (LAB / "assets-test" / "build", "assets/light")):
        for f in sorted(src.rglob("*")):   # the HD worlds (D28) live in a subfolder, worlds/<id>/
            if f.is_file():
                rel = f.relative_to(src).as_posix()
                (out / dst / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy(f, out / dst / rel)
                files[f"{dst}/{rel}"] = str(out / dst / rel)
    total = sum(Path(p).stat().st_size for p in files.values())
    print(json.dumps({"page": str(out / "index.html"), "files": files, "bytes": total}, indent=1))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
