"""Pack the engine-spike textures (D24) from Pixel Frog's "Treasure Hunters" (CC0) into game-lab/assets-test/spike/.

Both spike scenes (spike/phaser, spike/pixi) load exactly these files, so the engines are compared on identical
textures. Source: a clone of the pack, for example the GitHub mirror MarcialBot/Uppy-Bat at commit
e8098cdd1a0981edda7dad7a4a6afd8aeb4ed421 (folder "Treasure Hunters"). Needs Pillow. Output is git-ignored.
Usage: python3 game-lab/spike/build_spike_assets.py "<path to Treasure Hunters folder>"
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "assets-test" / "spike"


def strip(frames: list[Path], name: str) -> dict:
    imgs = [Image.open(f).convert("RGBA") for f in frames]
    w, h = imgs[0].size
    sheet = Image.new("RGBA", (w * len(imgs), h))
    for i, im in enumerate(imgs):
        sheet.paste(im, (i * w, 0))
    sheet.save(OUT / name, optimize=True)
    return {"file": name, "frameWidth": w, "frameHeight": h, "frames": len(imgs)}


def main(src: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    hero = src / "Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword"
    bg = src / "Palm Tree Island/Sprites/Background"
    m = {"hero": strip(sorted((hero / "01-Idle").glob("*.png")) + sorted((hero / "02-Run").glob("*.png")), "hero.png"),
         "coin": strip(sorted((src / "Pirate Treasure/Sprites/Gold Coin").glob("*.png")), "coin.png")}
    m["hero"]["idle"] = [0, 4]
    m["hero"]["run"] = [5, 10]
    # Layer 1: sky (BG image over a sky colour), tileable horizontally.
    sky = Image.open(bg / "BG Image.png").convert("RGBA")
    sky.save(OUT / "l1-sky.png", optimize=True)
    # Layer 2: big clouds. Layer 3: small clouds spread over a 448 px strip.
    Image.open(bg / "Big Clouds.png").convert("RGBA").save(OUT / "l2-clouds.png", optimize=True)
    small = Image.new("RGBA", (448, 48))
    for i, x in enumerate((10, 160, 300)):
        c = Image.open(bg / f"Small Cloud {i + 1}.png").convert("RGBA")
        small.paste(c, (x, 4 + 4 * i), c)
    small.save(OUT / "l3-small-clouds.png", optimize=True)
    # Layer 4: back palm trees repeated on a 256 px strip.
    palms = Image.new("RGBA", (256, 64))
    for x, f in ((0, "Back Palm Tree Regular 01.png"), (90, "Back Palm Tree Left 01.png"), (170, "Back Palm Tree Right 01.png")):
        p = Image.open(src / "Palm Tree Island/Sprites/Back Palm Trees" / f).convert("RGBA")
        palms.paste(p, (x, 64 - p.size[1]), p)
    palms.save(OUT / "l4-palms.png", optimize=True)
    # Layer 5: ground, the top-middle grass tile of the terrain sheet repeated with its fill below.
    ter = Image.open(src / "Palm Tree Island/Sprites/Terrain/Terrain (32x32).png").convert("RGBA")
    top, mid = ter.crop((32, 0, 64, 32)), ter.crop((32, 32, 64, 64))
    ground = Image.new("RGBA", (128, 64))
    for x in range(0, 128, 32):
        ground.paste(top, (x, 0))
        ground.paste(mid, (x, 32))
    ground.save(OUT / "l5-ground.png", optimize=True)
    # Particle: a 6x6 soft dot.
    dot = Image.new("RGBA", (6, 6))
    for y in range(6):
        for x in range(6):
            d = ((x - 2.5) ** 2 + (y - 2.5) ** 2) ** 0.5
            if d < 3:
                dot.putpixel((x, y), (255, 236, 150, int(255 * (1 - d / 3))))
    dot.save(OUT / "spark.png", optimize=True)
    m["layers"] = [{"file": "l1-sky.png", "factor": 0.0}, {"file": "l2-clouds.png", "factor": 0.08},
                   {"file": "l3-small-clouds.png", "factor": 0.18}, {"file": "l4-palms.png", "factor": 0.45},
                   {"file": "l5-ground.png", "factor": 1.0}]
    (OUT / "manifest.json").write_text(json.dumps(m, indent=1))
    print("spike assets in", OUT)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
