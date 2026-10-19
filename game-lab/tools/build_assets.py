"""Build the game's textures and sounds from the downloaded TEST-ONLY packs (D22) into game-lab/assets-test/build/.

Input: game-lab/assets-test/src/ as filled by tools/fetch_assets.py (see ASSETS.md for every pack and licence).
Output (git-ignored): atlas.png + kit.json (every sprite frame, named, plus layout data), the parallax layer images,
two distant mountain ranges drawn here in flat pixel-art tones (original lab art), and the sounds re-encoded to MP3
(plays on Android and iOS).
Needs Pillow; the sound step needs ffmpeg with libmp3lame. Deterministic: the same input gives the same files.
"""
from __future__ import annotations
import json
import random
import shutil
import subprocess
from pathlib import Path
from PIL import Image

LAB = Path(__file__).resolve().parents[1]
SRC = LAB / "assets-test" / "src"
OUT = LAB / "assets-test" / "build"
TH = SRC / "treasure-hunters"
PA = SRC / "pixel-adventure"

FONT_ROWS = ["ABCDEFGHIJ", "KLMNOPQRST", "UVWXYZ", "0123456789", ".,:?!()+-"]


# Two glyphs redrawn for legibility at sign size (visual review V14): a plain 0 (the sheet's has a slash, so Q200
# read as Q288) and a square E (the sheet's rounded one read as a euro sign). Rows 1-8 of the 8 x 10 cell.
GLYPH_FIX = {"0": ["..####..", ".######.", ".##..##.", ".##..##.", ".##..##.", ".##..##.", ".######.", "..####.."],
             "E": [".######.", ".######.", ".##.....", ".#####..", ".#####..", ".##.....", ".######.", ".######."]}


def fix_glyph(g: Image.Image, ch: str) -> Image.Image:
    rows = GLYPH_FIX.get(ch)
    if not rows:
        return g
    g = g.convert("RGBA")
    ink = max((g.getpixel((x, y)) for x in range(g.width) for y in range(g.height)), key=lambda p: p[3])   # its colour
    out = Image.new("RGBA", g.size, (0, 0, 0, 0))
    for r, row in enumerate(rows):
        for c, v in enumerate(row):
            if v == "#":
                out.putpixel((c, r + 1), ink)
    return out


def img(p: Path) -> Image.Image:
    return Image.open(p).convert("RGBA")


def strip(p: Path, fw: int, fh: int) -> list[Image.Image]:
    s = img(p)
    return [s.crop((i * fw, 0, i * fw + fw, fh)) for i in range(s.width // fw)]


def files(d: Path, prefix: str, n: int, fmt: str = "{} {:02d}.png") -> list[Image.Image]:
    return [img(d / fmt.format(prefix, i)) for i in range(1, n + 1)]


def foot(frames: list[Image.Image]) -> dict:
    """Where the character's feet are inside its frame: bottom opaque row and horizontal centre of the opaque box."""
    box = frames[0].getbbox()
    return {"x": (box[0] + box[2]) / 2, "y": box[3], "top": box[1]}


class Atlas:
    """A small shelf packer: frames sorted by height, 1 px padding, power-of-two width."""

    def __init__(self, width: int = 1024) -> None:
        self.width, self.items, self.anims = width, [], {}

    def add(self, name: str, frames: list[Image.Image], fps: float = 0, loop: bool = True) -> None:
        names = []
        for i, f in enumerate(frames):
            n = f"{name}/{i}" if len(frames) > 1 or fps else name
            self.items.append((n, f))
            names.append(n)
        if fps:
            self.anims[name] = {"frames": names, "fps": fps, "loop": loop}

    def build(self, path: Path) -> dict:
        order = sorted(self.items, key=lambda it: (-it[1].height, it[0]))
        x = y = row = 0
        pos = {}
        for n, f in order:
            if x + f.width + 1 > self.width:
                x, y, row = 0, y + row + 1, 0
            pos[n] = (x, y, f.width, f.height)
            x += f.width + 1
            row = max(row, f.height)
        h = (y + row + 8) // 8 * 8
        sheet = Image.new("RGBA", (self.width, h))
        for n, f in order:
            sheet.paste(f, pos[n][:2])
        sheet.save(path, optimize=True)
        return {"image": path.name, "size": [self.width, h], "frames": {n: list(pos[n]) for n, _ in self.items}, "anims": self.anims}


def mountains(width: int, height: int, peaks: list, body: tuple, light: tuple, snow: tuple, seed: int) -> Image.Image:
    """A distant mountain range in flat pixel-art tones: broad peaks roughened with midpoint displacement, faces lit
    from the left (rising slopes light, falling slopes dark), snow above a jagged snow line. Tiles horizontally.
    Original lab art (registered in ASSETS.md), deterministic for a given seed."""
    rng = random.Random(seed)
    r = lambda: rng.random() - 0.5
    # Midpoint displacement on a closed loop of `width` samples, so the ridge wraps seamlessly.
    noise = [0.0] * width
    step, amp = width // 2, 30.0
    while step >= 1:
        for x in range(0, width, step * 2):
            noise[(x + step) % width] = (noise[x] + noise[(x + 2 * step) % width]) / 2 + r() * amp
        step //= 2
        amp *= 0.72
    hgt = []
    for x in range(width):
        h = 0.0
        for cx, ph, slope in peaks:
            for off in (-width, 0, width):
                h = max(h, ph - abs(x - cx - off) * slope)
        hgt.append(max(4.0, min(height - 2.0, h + noise[x] * 0.9)))
    out = Image.new("RGBA", (width, height))
    px = out.load()
    snow_line = height * 0.68
    for x in range(width):
        h = hgt[x]
        rising = hgt[(x + 6) % width] - hgt[(x - 6) % width] > 0
        face = light if rising else body
        top = int(height - h)
        for y in range(max(0, top), height):
            px[x, y] = (snow if height - y > snow_line + (noise[(x * 7) % width] * 0.4) else face) + (255,)
    return out


def build() -> None:
    if not TH.exists() or not PA.exists():
        raise SystemExit("Run tools/fetch_assets.py first (assets-test/src is missing).")
    OUT.mkdir(parents=True, exist_ok=True)
    a = Atlas()
    kit = {"heroes": {}}

    # Heroes. The captain from Treasure Hunters; four alternatives from Pixel Adventure (same artist).
    cap = TH / "Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword"
    idle = files(cap / "01-Idle", "Idle", 5)
    a.add("captain/idle", idle, 9)
    a.add("captain/run", files(cap / "02-Run", "Run", 6), 14)
    a.add("captain/jump", files(cap / "03-Jump", "Jump", 3), 12, False)
    a.add("captain/fall", files(cap / "04-Fall", "Fall", 1), 1)
    a.add("captain/land", files(cap / "05-Ground", "Ground", 2), 14, False)
    kit["heroes"]["captain"] = {"name": "Captain", "frame": [64, 40], "foot": foot(idle), "celebrate": "jump"}
    for key, folder in (("frog", "Ninja Frog"), ("pink", "Pink Man"), ("guy", "Virtual Guy"), ("mask", "Mask Dude")):
        d = PA / "Main Characters" / folder
        idle = strip(d / "Idle (32x32).png", 32, 32)
        a.add(f"{key}/idle", idle, 20)
        a.add(f"{key}/run", strip(d / "Run (32x32).png", 32, 32), 20)
        a.add(f"{key}/jump", strip(d / "Jump (32x32).png", 32, 32), 1)
        a.add(f"{key}/fall", strip(d / "Fall (32x32).png", 32, 32), 1)
        a.add(f"{key}/spin", strip(d / "Double Jump (32x32).png", 32, 32), 20)
        kit["heroes"][key] = {"name": folder, "frame": [32, 32], "foot": foot(idle), "celebrate": "spin"}

    # Effects and props.
    dust = TH / "Captain Clown Nose/Sprites/Dust Particles"
    a.add("dust/jump", files(dust, "Jump", 6), 16, False)
    a.add("dust/land", files(dust, "Fall", 5), 16, False)
    dia = TH / "Captain Clown Nose/Sprites/Dialogue"
    a.add("bubble/q-in", files(dia / "Interrogation", "Interrogation In", 3), 12, False)
    a.add("bubble/ex-in", files(dia / "Exclamation", "Exclamation In", 3), 12, False)
    tre = TH / "Pirate Treasure/Sprites"
    a.add("coin/gold", [img(tre / f"Gold Coin/{i:02d}.png") for i in range(1, 5)], 10)
    a.add("coin/silver", [img(tre / f"Silver Coin/{i:02d}.png") for i in range(1, 5)], 10)
    a.add("coin/fx", [img(tre / f"Coin Effect/{i:02d}.png") for i in range(1, 4)], 14, False)
    cp = PA / "Items/Checkpoints"
    a.add("start/idle", [img(cp / "Start/Start (Idle).png")])
    a.add("start/go", strip(cp / "Start/Start (Moving) (64x64).png", 64, 64), 20, False)
    a.add("end/idle", [img(cp / "End/End (Idle).png")])
    a.add("end/press", strip(cp / "End/End (Pressed) (64x64).png", 64, 64), 14, False)
    a.add("flag/out", strip(cp / "Checkpoint/Checkpoint (Flag Out) (64x64).png", 64, 64), 26, False)
    a.add("flag/idle", strip(cp / "Checkpoint/Checkpoint (Flag Idle)(64x64).png", 64, 64), 14)
    a.add("flag/pole", [img(cp / "Checkpoint/Checkpoint (No Flag).png")])
    plat = PA / "Traps/Platforms"
    a.add("lift/on", strip(plat / "Brown On (32x8).png", 32, 8), 16)
    a.add("lift/off", [img(plat / "Brown Off.png")])
    a.add("lift/chain", [img(plat / "Chain.png")])
    a.add("confetti", strip(PA / "Other/Confetti (16x16).png", 16, 16))
    a.add("puff", [img(PA / "Other/Dust Particle.png")])
    a.add("shadow", [img(PA / "Other/Shadow.png")])
    bg = TH / "Palm Tree Island/Sprites/Background"
    for size in ("Big", "Medium", "Small"):
        a.add(f"glint/{size.lower()}", files(bg, f"Water Reflect {size}", 4), 6)
    palms = TH / "Palm Tree Island/Sprites/Back Palm Trees"
    for kind in ("Regular", "Left", "Right"):
        a.add(f"palm/{kind.lower()}", files(palms, f"Back Palm Tree {kind}", 4), 7)
    fp = TH / "Palm Tree Island/Sprites/Front Palm Trees"
    a.add("fpalm/top", files(fp, "Front Palm Tree Top", 4), 7)
    a.add("fpalm/base", [img(fp / "Front Palm Bottom and Grass (32x32).png")])
    # The terrain sheet goes in whole; world.js bakes the pillars from its 32 px tiles once at load.
    terrain = img(TH / "Palm Tree Island/Sprites/Terrain/Terrain (32x32).png")
    a.add("terrain", [terrain])
    # Pixel font (8x10 glyphs), white and black.
    for col, f in (("w", "Text (White) (8x10).png"), ("b", "Text (Black) (8x10).png")):
        sheet = img(PA / "Menu/Text" / f)
        for r, chars in enumerate(FONT_ROWS):
            for c, ch in enumerate(chars):
                a.add(f"font-{col}/{ord(ch)}", [fix_glyph(sheet.crop((c * 8, r * 10, c * 8 + 8, r * 10 + 10)), ch)])
    atlas = a.build(OUT / "atlas.png")

    # Parallax layers (each its own image so it can tile).
    bgimg = img(bg / "BG Image.png")
    bgimg.save(OUT / "bg.png", optimize=True)
    img(bg / "Big Clouds.png").save(OUT / "clouds-big.png", optimize=True)
    small = Image.new("RGBA", (512, 48))
    for i, x in enumerate((24, 196, 360)):
        c = img(bg / f"Small Cloud {i + 1}.png")
        small.paste(c, (x, 6 + 3 * i), c)
    small.save(OUT / "clouds-small.png", optimize=True)
    sky = img(bg / "Additional Sky.png").getpixel((16, 16))[:3]
    water = img(bg / "Additional Water.png").getpixel((16, 16))[:3]
    mountains(512, 120, [(60, 92, 0.9), (122, 66, 1.1), (190, 72, 0.8), (300, 112, 0.85), (352, 80, 1.2), (430, 86, 0.8), (488, 60, 1.0)],
              (184, 166, 180), (203, 188, 195), (241, 231, 214), 7).save(OUT / "mtn-back.png", optimize=True)
    mountains(512, 90, [(30, 40, 1.0), (110, 60, 0.8), (170, 44, 1.1), (250, 50, 0.9), (360, 74, 0.75), (410, 52, 1.2), (480, 42, 1.0)],
              (146, 140, 176), (171, 164, 194), (234, 230, 226), 11).save(OUT / "mtn-front.png", optimize=True)

    sea = next(y for y in range(bgimg.height) if bgimg.getpixel((4, y))[:3] == water)
    # Night versions of every layer (dark mode): the same art shifted to moonlit blues, plus a star field.
    def nightify(im: Image.Image) -> Image.Image:
        r, g, b, a = im.split()
        r = r.point(lambda v: int(v * 0.30 + 12)); g = g.point(lambda v: int(v * 0.34 + 16)); b = b.point(lambda v: int(v * 0.52 + 42))
        return Image.merge("RGBA", (r, g, b, a))
    night_of = lambda c: (int(c[0] * 0.30 + 12), int(c[1] * 0.34 + 16), int(c[2] * 0.52 + 42))
    for name in ("bg", "clouds-big", "clouds-small", "mtn-back", "mtn-front"):
        nightify(img(OUT / f"{name}.png")).save(OUT / f"{name}-night.png", optimize=True)
    rng = random.Random(3)
    stars = Image.new("RGBA", (256, 112))
    for _ in range(46):
        x, y, k = rng.randrange(1, 255), rng.randrange(1, 111), rng.random()
        c = (255, 246, 222, int(120 + 135 * k))
        stars.putpixel((x, y), c)
        if k > 0.86:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                stars.putpixel((x + dx, y + dy), (255, 246, 222, 110))
    stars.save(OUT / "stars.png", optimize=True)
    kit.update({
        "atlas": atlas,
        "night": {"sky": "#%02x%02x%02x" % night_of(sky), "water": "#%02x%02x%02x" % night_of(water)},
        "colors": {"sky": "#%02x%02x%02x" % sky, "water": "#%02x%02x%02x" % water,
                   "height": bgimg.height, "sea": sea, "fill": "#%02x%02x%02x" % terrain.getpixel((48, 48))[:3]},
        "font": {"w": 8, "h": 10},
        "layers": {"bg": "bg.png", "cloudsBig": "clouds-big.png", "cloudsSmall": "clouds-small.png", "mtnBack": "mtn-back.png", "mtnFront": "mtn-front.png", "stars": "stars.png"},
    })

    # Sounds: everything under src/audio is listed in kit.sounds by its key; re-encoded to MP3 for iOS and Android.
    kit["sounds"] = {}
    audio_map = json.loads((LAB / "tools" / "assets-lock.json").read_text()).get("sounds", {})
    if audio_map and shutil.which("ffmpeg"):
        for key, rel in audio_map.items():
            src = SRC / rel
            dst = OUT / f"{key}.mp3"
            q = "4" if key != "music" else "6"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1" if key != "music" else "2",
                            "-codec:a", "libmp3lame", "-q:a", q, "-map_metadata", "-1", str(dst)], check=True)
            kit["sounds"][key] = dst.name
    (OUT / "kit.json").write_text(json.dumps(kit, separators=(",", ":")))
    total = sum(p.stat().st_size for p in OUT.iterdir())
    print("[build]", OUT, f"{total // 1024} KB", "atlas", atlas["size"])


if __name__ == "__main__":
    build()
