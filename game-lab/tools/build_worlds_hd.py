"""Build the HD tier's fantasy worlds (D28) from the packs fetched by tools/fetch_worlds.py into
game-lab/assets-test/build-hd/worlds/<world>/ (git-ignored) and their description, worlds.json, next to kit.json.

Each world is a stack of horizontally seamless parallax layers taken from one scene of a pack (its own ground layer is
left out: the climb's cliffs are the ground). Every layer is cropped to the rows it actually paints, scaled (the sky
small, it is soft anyway; the far layers at 0.75; the nearest at 1) and saved as WebP, so a world is a few hundred KB
to download and about 10-16 MB of GPU memory. The game loads only the current world and the next one.

Usage: python3 game-lab/tools/build_worlds_hd.py
"""
from __future__ import annotations
import json
import shutil
from pathlib import Path
from PIL import Image

LAB = Path(__file__).resolve().parents[1]
SRC = LAB / "assets-test" / "src" / "worlds"
OUT = LAB / "assets-test" / "build-hd" / "worlds"
FRAME_H = 1080   # every scene is drawn in a 1920 x 1080 frame

# A layer: (file, parallax factor x, scale). The factor is how fast it follows the camera (0 = fixed, 1 = with the
# world); the sky is fixed and stretched to the screen. 'over' marks a layer drawn in front of the path (snow).
WORLDS = [
    {"id": "magicforest", "name": "Magic forest", "pack": "cartoonforest", "dir": "PNG/Cartoon_Forest_BG_04/Layers",
     "layers": [("Sky.png", 0, 0.25), ("BG_Decor.png", 0.12, 0.75), ("Middle_Decor.png", 0.25, 0.75), ("Foreground.png", 0.45, 1)],
     "fx": "fireflies", "lit": "night"},
    {"id": "purpleforest", "name": "Purple forest", "pack": "fairytale", "dir": "_PNG/2",
     "layers": [("7.png", 0, 0.25), ("6.png", 0.06, 0.75), ("5.png", 0.12, 0.75), ("4.png", 0.22, 0.75), ("3.png", 0.36, 0.85), ("2.png", 0.5, 0.75)],
     "fx": "sparkles", "lit": "dusk"},
    {"id": "snowforest", "name": "Snow forest", "pack": "winter", "dir": "PNG/BG_01/Layers",
     "layers": [("Sky.png", 0, 0.25), ("BG.png", 0.1, 0.75), ("Middle.png", 0.25, 0.75), ("Foreground.png", 0.45, 1)],
     "fx": "snow", "lit": "day"},
    # the scene's gingerbread castle is left out (too childish, and it loomed behind the climber): stars over clouds
    {"id": "skycastle", "name": "Starry clouds", "pack": "parallax2d", "dir": "platformer_background_2/Layers",
     "layers": [("layer09_Sky.png", 0, 0.25), ("layer08_Stars_1.png", 0.02, 0.75), ("layer07_Stars_2.png", 0.03, 0.75), ("layer06_Stars_3.png", 0.04, 0.75),
                ("layer03_Clouds_3.png", 0.16, 0.75), ("layer02_Clouds_2.png", 0.26, 0.75), ("layer01_Clouds_1.png", 0.4, 1)],
     "fx": "stars", "lit": "night"},
]


def build() -> dict:
    out = {"frameH": FRAME_H, "worlds": []}
    total = 0
    for w in WORLDS:
        d = OUT / w["id"]
        shutil.rmtree(d, ignore_errors=True)   # no stale layers from an earlier build
        d.mkdir(parents=True)
        layers = []
        for i, (fn, par, sc) in enumerate(w["layers"]):
            im = Image.open(SRC / w["pack"] / "x" / w["dir"] / fn).convert("RGBA")
            W, H = im.size
            top, bottom = (0, H) if par == 0 else (im.getbbox() or (0, 0, W, H))[1::2]
            if par:
                im = im.crop((0, top, W, bottom))      # full width (it tiles sideways), only the painted rows
            tw, th = max(4, round(im.width * sc)), max(4, round(im.height * sc))
            im = im.resize((tw, th), Image.LANCZOS)
            name = f"{i}.webp"
            im.save(d / name, "WEBP", quality=82, method=6) if par else im.convert("RGB").save(d / name, "WEBP", quality=80, method=6)
            size = (d / name).stat().st_size
            total += size
            layers.append({"file": f"worlds/{w['id']}/{name}", "w": tw, "h": th, "top": top, "rows": bottom - top, "par": par, "scale": sc, "bytes": size})
        # the colour under the nearest layer's bottom edge, to fill the screen below it
        near = Image.open(d / layers[-1]["file"].split("/")[-1]).convert("RGBA")
        row = [p for p in (near.getpixel((x, near.height - 2)) for x in range(0, near.width, 7)) if p[3] > 200] or [(40, 40, 40, 255)]
        fill = "#%02x%02x%02x" % tuple(sum(p[c] for p in row) // len(row) for c in range(3))
        out["worlds"].append({k: w[k] for k in ("id", "name", "fx", "lit")} | {"fill": fill, "layers": layers,
                              "bytes": sum(l["bytes"] for l in layers), "gpuMB": round(sum(l["w"] * l["h"] * 4 for l in layers) / 1e6, 1)})
        print(f"[worlds] {w['id']}: {len(layers)} layers, {out['worlds'][-1]['bytes'] // 1024} KB, GPU {out['worlds'][-1]['gpuMB']} MB")
    (OUT.parent / "worlds.json").write_text(json.dumps(out, indent=1))
    print(f"[worlds] total {total // 1024} KB")
    return out


if __name__ == "__main__":
    build()
