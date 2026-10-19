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
from PIL import Image, ImageChops

LAB = Path(__file__).resolve().parents[1]
SRC = LAB / "assets-test" / "src" / "worlds"
OUT = LAB / "assets-test" / "build-hd" / "worlds"
FRAME_H = 1080   # every scene is drawn in a 1920 x 1080 frame

# zoom: how tall the scene's frame is drawn, in screens (forests fill the screen; open skies show more of the scene).
# A layer: (file, parallax factor x, scale). The factor is how fast it follows the camera (0 = fixed, 1 = with the
# world); the sky is fixed and stretched to the screen. fx: the world's particles; lit: its light (a 'day' world is
# dimmed at night); rock, plant: the cliffs' tint; lip: the cliff tops' tiles (grass if absent); mist: the cloud
# bank's colour below the path (white if absent).
WORLDS = [
    {"id": "magicforest", "name": "Magic forest", "pack": "cartoonforest", "dir": "PNG/Cartoon_Forest_BG_04/Layers",
     "layers": [("Sky.png", 0, 0.25), ("BG_Decor.png", 0.12, 0.75), ("Middle_Decor.png", 0.25, 0.75), ("Foreground.png", 0.45, 1)],
     "fx": "fireflies", "lit": "night", "zoom": 1.05, "rock": "#b98f86", "plant": "#c9b27a"},
    {"id": "purpleforest", "name": "Purple forest", "pack": "fairytale", "dir": "_PNG/2",
     "layers": [("7.png", 0, 0.25), ("6.png", 0.06, 0.75), ("5.png", 0.12, 0.75), ("4.png", 0.22, 0.75), ("3.png", 0.36, 0.85), ("2.png", 0.5, 0.75)],
     "fx": "sparkles", "lit": "dusk", "zoom": 1.05, "rock": "#b49ac4", "plant": "#c8a6e0", "mist": "#e2d0f2"},
    {"id": "snowforest", "name": "Snow forest", "pack": "winter", "dir": "PNG/BG_01/Layers",
     "layers": [("Sky.png", 0, 0.25), ("BG.png", 0.1, 0.75), ("Middle.png", 0.25, 0.75), ("Foreground.png", 0.45, 1)],
     "fx": "snow", "lit": "day", "zoom": 0.8, "rock": "#dfe9f6", "plant": "#ffffff", "lip": "snow"},
    # the scene's gingerbread castle is left out (too childish, and it loomed behind the climber): stars over clouds
    {"id": "skycastle", "name": "Starry clouds", "pack": "parallax2d", "dir": "platformer_background_2/Layers",
     "layers": [("layer09_Sky.png", 0, 0.25), ("layer08_Stars_1.png", 0.02, 0.75), ("layer07_Stars_2.png", 0.03, 0.75), ("layer06_Stars_3.png", 0.04, 0.75),
                ("layer03_Clouds_3.png", 0.16, 0.75), ("layer02_Clouds_2.png", 0.26, 0.75), ("layer01_Clouds_1.png", 0.4, 1)],
     "fx": "stars", "lit": "night", "zoom": 0.8, "rock": "#9aa4d0", "plant": "#a6b4dc"},
    # composed here (compose_volcano) from LudicArts' volcano pack: its painted mountains, lit from below by a lava
    # lake, with dead trees, rocks and crystals in front (CC BY 3.0: credit LudicArts.com)
    {"id": "volcano", "name": "Volcano", "pack": "volcano", "compose": "volcano",
     "layers": [("sky", 0, 0.25), ("mountains", 0.05, 0.5), ("lava", 0.16, 0.5), ("props", 0.32, 0.75)],
     "fx": "embers", "lit": "dusk", "zoom": 1.0, "rock": "#d6a088", "plant": "#c09a6a", "fill": "#7a1e0c", "mist": "#a8706a", "lip": "stone", "credit": "LudicArts.com"},
    # composed (compose_ice) from LudicArts' ice forest pack: its mountains at night under a painted aurora, ice
    # blocks, snowy trees and bushes, blue crystals (CC BY 4.0: credit LudicArts.com)
    {"id": "ice", "name": "Ice kingdom", "pack": "iceforest", "compose": "ice",
     "layers": [("sky", 0, 0.25), ("mountains", 0.05, 0.5), ("props", 0.3, 0.75)],
     "fx": "snow", "lit": "night", "zoom": 1.0, "rock": "#cfe0ff", "plant": "#e4f0ff", "fill": "#24365e", "mist": "#b8c8ff", "lip": "snow", "credit": "LudicArts.com"},
]


def _grad(w: int, h: int, stops: list[tuple[float, tuple]]) -> Image.Image:
    """A vertical gradient (RGBA) through (position 0..1, colour) stops."""
    col = Image.new("RGBA", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if a <= t <= b:
                k = (t - a) / max(1e-6, b - a)
                col.putpixel((0, y), tuple(round(ca[c] + (cb[c] - ca[c]) * k) for c in range(len(ca))))
                break
    return col.resize((w, h))


def _aurora(w: int, h: int) -> Image.Image:
    """Soft aurora curtains (green to teal, a touch of violet at the top) over a transparent frame, seamless sideways."""
    import math
    a = Image.new("RGBA", (w, h))
    px = a.load()
    for x in range(w):
        u = x / w * 2 * math.pi
        for band, (amp, base, thick, col) in enumerate([(0.05, 0.17, 0.06, (90, 255, 170)), (0.035, 0.25, 0.04, (70, 220, 230))]):
            amp, thick = amp * h, thick * h
            yc = h * base + amp * math.sin(u * (2 + band) + band) + 0.3 * amp * math.sin(u * 7 + band * 2)
            for y in range(max(0, int(yc - thick * 2.2)), min(h, int(yc + thick * 0.5))):
                d = (yc - y) / thick          # 0 at the curtain's foot, rising above it
                k = (math.exp(-d * 1.1) if d >= 0 else max(0.0, 1 + d * 2)) * (0.55 + 0.45 * math.sin(u * 11 + band * 3) ** 2)
                r, g, b, al = px[x, y]
                c = col if d < 1.3 else (150, 120, 255)
                na = min(255, al + int(160 * k))
                px[x, y] = (max(r, c[0]), max(g, c[1]), max(b, c[2]), na)
    return a


def compose_ice(src: Path) -> dict:
    """The ice kingdom's layers at frame size (the mountains 3840 wide, mirrored so they tile)."""
    img = src / "_pack"
    obj = lambda n: Image.open(img / n).convert("RGBA")
    bg = Image.open(img / "Background.png").convert("RGBA")
    h = round(bg.width * 9 / 16)
    bg = bg.crop((0, 0, bg.width, h)).resize((1920, 1080), Image.LANCZOS)
    wide = Image.new("RGBA", (3840, 1080)); wide.paste(bg, (0, 0)); wide.paste(bg.transpose(Image.FLIP_LEFT_RIGHT), (1920, 0))
    # night: multiply by moonlight blue, then the aurora's light on top
    wide = ImageChops.multiply(wide, Image.new("RGBA", wide.size, (96, 120, 190, 255)))
    au = _aurora(3840 // 4, 1080 // 4).resize((3840, 1080), Image.BILINEAR)
    glow = Image.new("RGBA", wide.size, (0, 0, 0, 255)); glow.alpha_composite(au)
    wide = ImageChops.screen(wide, glow.point(lambda v: int(v * 0.55)))
    wide.putalpha(255)
    props = Image.new("RGBA", (1920, 1080))
    def put(im, x, foot, sc):
        im = im.crop(im.getbbox()); im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
        props.alpha_composite(im, (x, foot - im.height))
        return foot - im.height
    # (a crystal stands on each ice block: its foot sinks a little into the block's snow)
    for n, x, foot, sc in [("Obj02.png", 30, 600, 0.55), ("37.png", 380, 610, 0.7), ("Obj10.png", 410, None, 0.7), ("Obj03.png", 600, 604, 1.2),
                           ("Obj02.png", 860, 596, 0.45), ("Obj07.png", 1120, 606, 0.8), ("38.png", 1450, 610, 0.65), ("Obj10.png", 1478, None, 0.55),
                           ("Obj05.png", 1700, 604, 1.2)]:
        top = put(obj(n), x, top + 14 if foot is None else foot, sc)
    # moonlit props
    props = Image.merge("RGBA", (*ImageChops.multiply(props.convert("RGB"), Image.new("RGB", props.size, (150, 170, 230))).split(), props.split()[3]))
    sky = _grad(64, 1080, [(0, (8, 14, 40, 255)), (0.6, (22, 44, 86, 255)), (1, (40, 70, 120, 255))])
    return {"sky": sky, "mountains": wide, "props": props}


def compose_volcano(src: Path) -> dict:
    """The volcano's layers at frame size (1920 x 1080 frame units; the mountains are 3840 wide, mirrored so they tile)."""
    img = src / "images"
    tile = lambda n: Image.open(img / f"Tile_{n}.png").convert("RGBA")
    # the painted mountains, cropped to 16:9, made seamless (the picture and its mirror), lit red-orange from below
    bg = Image.open(img / "Background.png").convert("RGBA")
    h = round(bg.width * 9 / 16)
    bg = bg.crop((0, (bg.height - h) // 2, bg.width, (bg.height - h) // 2 + h)).resize((1920, 1080), Image.LANCZOS)
    wide = Image.new("RGBA", (3840, 1080)); wide.paste(bg, (0, 0)); wide.paste(bg.transpose(Image.FLIP_LEFT_RIGHT), (1920, 0))
    glow = _grad(3840, 1080, [(0, (0, 0, 0, 255)), (0.3, (40, 8, 20, 255)), (0.62, (210, 70, 30, 255)), (1, (255, 120, 40, 255))])
    wide = ImageChops.screen(wide, glow)
    # the lava lake: the pack's glowing lava surface along a line, deep orange to dark red below it
    lava = Image.new("RGBA", (1920, 1080))
    surf = tile(27).resize((128, 128), Image.LANCZOS)
    y0 = 470
    lava.paste(_grad(1920, 1080 - y0 - 100, [(0, (255, 140, 20, 255)), (0.35, (214, 70, 18, 255)), (1, (122, 30, 12, 255))]), (0, y0 + 100))
    for x in range(0, 1920, 128):
        lava.alpha_composite(surf, (x, y0))
    # props standing in the lava (none crosses the strip's edges, so it tiles)
    props = Image.new("RGBA", (1920, 1080))
    def put(n, x, foot, sc):
        t = tile(n); t = t.crop(t.getbbox()); t = t.resize((max(1, round(t.width * sc)), max(1, round(t.height * sc))), Image.LANCZOS)
        props.alpha_composite(t, (x, foot - t.height))
    for n, x, foot, sc in [(33, 40, 570, 0.95), (20, 300, 584, 0.8), (35, 470, 576, 0.75), (19, 640, 588, 0.75), (40, 900, 574, 1.0),
                           (21, 1080, 586, 0.8), (36, 1290, 578, 0.7), (34, 1430, 572, 0.9), (20, 1700, 588, 0.6)]:
        put(n, x, foot, sc)
    sky = _grad(64, 1080, [(0, (40, 22, 70, 255)), (0.55, (96, 40, 92, 255)), (1, (190, 70, 50, 255))])
    return {"sky": sky, "mountains": wide, "lava": lava, "props": props}


def build() -> dict:
    out = {"frameH": FRAME_H, "worlds": []}
    total = 0
    for w in WORLDS:
        d = OUT / w["id"]
        shutil.rmtree(d, ignore_errors=True)   # no stale layers from an earlier build
        d.mkdir(parents=True)
        layers = []
        made = globals()["compose_" + w["compose"]](SRC / w["pack"] / "x") if w.get("compose") else {}
        for i, (fn, par, sc) in enumerate(w["layers"]):
            im = made[fn] if made else Image.open(SRC / w["pack"] / "x" / w["dir"] / fn).convert("RGBA")
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
        fill = w.get("fill") or "#%02x%02x%02x" % tuple(sum(p[c] for p in row) // len(row) for c in range(3))
        out["worlds"].append({k: w[k] for k in ("id", "name", "fx", "lit", "zoom", "rock", "plant", "mist", "lip", "credit") if k in w} | {"fill": fill, "layers": layers,
                              "bytes": sum(l["bytes"] for l in layers), "gpuMB": round(sum(l["w"] * l["h"] * 4 for l in layers) / 1e6, 1)})
        print(f"[worlds] {w['id']}: {len(layers)} layers, {out['worlds'][-1]['bytes'] // 1024} KB, GPU {out['worlds'][-1]['gpuMB']} MB")
    (OUT.parent / "worlds.json").write_text(json.dumps(out, indent=1))
    print(f"[worlds] total {total // 1024} KB")
    return out


if __name__ == "__main__":
    build()
