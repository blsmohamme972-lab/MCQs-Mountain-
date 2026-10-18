"""Build the HD tier's art and sound (D26) from the downloaded TEST-ONLY Kenney packs into game-lab/assets-test/build-hd/.

Input: game-lab/assets-test/src/kenney/ as filled by tools/fetch_assets.py (tools/assets-hd-lock.json, ASSETS.md).
Output (git-ignored):
  atlas.webp + kit.json   every sprite (the hero's body parts for the code rig, props, tiles, particles), packed
                          into one 2048 x 2048 atlas, plus the rig's joint positions and the palettes
  sky-*.webp, far-*, peak-*, mid-*, near-*   painted parallax layers, day and night (original lab art, drawn here)
  dirt.webp stone.webp waterfall.webp fg.webp  tiling and foreground textures
  *.mp3                   sound effects and one music loop, re-encoded (plays on Android and iOS)
The painted layers are generated with a fixed seed, so the same input always gives the same files.
Needs Pillow and numpy; the sound step needs ffmpeg with libmp3lame.
"""
from __future__ import annotations
import json
import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

LAB = Path(__file__).resolve().parents[1]
SRC = LAB / "assets-test" / "src" / "kenney"
OUT = LAB / "assets-test" / "build-hd"
TOON = SRC / "Toon Characters Pack 1" / "Female adventurer" / "PNG"
RED = SRC / "Platformer Pack Redux" / "PNG"
BGE = SRC / "Background Elements Redux" / "PNG" / "Retina"
PART = SRC / "Particle Pack" / "PNG (Transparent)"
PUFF = SRC / "Smoke Particles" / "PNG" / "White puff"
AUD = SRC / "audio"
WEBP = {"quality": 86, "method": 6}

# Palettes (hex). Day: late-afternoon light from the right; night: moonlight, cool violet haze.
PAL = {
    "day": {"sky": ["#2f7fd0", "#7fbdea", "#cfe6f2", "#ffe2bf"], "far": "#9cbfe0", "farLit": "#c4dcf0", "snow": "#f4f8fc",
            "peak": "#7fa3cc", "peakLit": "#b4cde6", "mid": "#5f8fbb", "midLit": "#86afd2", "forestMid": "#4c7f9c",
            "near": "#3f7a66", "nearLit": "#5c9a72", "forestNear": "#2f6656", "haze": "#ffe9cf", "fog": "#d8ecf6",
            "colFog": "#6f8ea3"},
    "night": {"sky": ["#070b22", "#141c46", "#2a2f66", "#4b3d78"], "far": "#2c3566", "farLit": "#3e4a85", "snow": "#9fb0e0",
              "peak": "#262e5c", "peakLit": "#3a4782", "mid": "#1f2650", "midLit": "#2e3a70", "forestMid": "#1a2147",
              "near": "#16203f", "nearLit": "#203058", "forestNear": "#111a35", "haze": "#4a3f78", "fog": "#2a2f60",
              "colFog": "#1c2246"},
}


def rgb(h: str) -> np.ndarray:
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)


def img(p: Path) -> Image.Image:
    return Image.open(p).convert("RGBA")


def save_webp(im: Image.Image, name: str, **kw) -> int:
    path = OUT / name
    im.save(path, "WEBP", **(kw or WEBP))
    return path.stat().st_size


# ---------- 1-D periodic noise (seamless horizontally) ----------
def ridge(width: int, octaves: list, seed: int) -> np.ndarray:
    """Sum of sines at whole-number frequencies over the width, so the strip tiles without a seam."""
    rng = np.random.default_rng(seed)
    x = np.arange(width) / width * 2 * math.pi
    y = np.zeros(width, np.float32)
    for f, a in octaves:
        y += a * np.sin(f * x + rng.uniform(0, 2 * math.pi))
    return y


def peaks(width: int, freq: int, sharp: float, seed: int) -> np.ndarray:
    """Pointed mountain profile: |sin| folded so the tops are sharp and the valleys round."""
    rng = np.random.default_rng(seed)
    x = np.arange(width) / width * 2 * math.pi
    base = 1 - np.abs(np.sin(freq * x / 2 + rng.uniform(0, math.pi)))
    return base ** sharp


def mountain_layer(width, height, top, amp, prof, base, lit, fog, snow=None, snow_line=0.0, seed=0, fog_from=0.45):
    """A painted range: a lit and a shaded face per slope (light from the right), optional snow caps,
    a soft rim of light on the ridge, and fog rising from the bottom. Returns an RGBA strip."""
    h = top + amp * (1 - prof)  # ridge row per column (y grows downward)
    yy = np.arange(height, dtype=np.float32)[:, None]
    inside = yy >= h[None, :]
    # Facets from the large-scale slope only (a wrapped box blur first), so small ripples do not make stripes.
    k = 41
    hs = np.convolve(np.concatenate([h[-k:], h, h[:k]]), np.ones(k) / k, mode="same")[k:-k]
    slope = np.gradient(hs)
    # The face turned to the light (light from the right): the ground rising to the right faces away and is in shade.
    face = np.tanh(-slope * 2.2)
    # Facet boundaries lean as they go down, like real ridges.
    rng = np.random.default_rng(seed + 7)
    lean = np.clip((yy - h[None, :]) / max(1, amp * 1.3), 0, 1)
    shift = (lean * 18).astype(int)
    idx = (np.arange(width)[None, :] + shift) % width
    f = face[idx]
    col = base[None, None, :] + (lit - base)[None, None, :] * (0.5 + 0.5 * f)[..., None]
    if snow is not None:
        depth = yy - h[None, :]
        jag = ridge(width, [(17, 6), (41, 3), (97, 1.5)], seed + 3)[None, :]
        cap = (h[None, :] < top + amp * snow_line) & (depth < 26 + jag + (top + amp * snow_line - h[None, :]) * 0.55)
        sn = snow[None, None, :] * (0.86 + 0.14 * (0.5 + 0.5 * f))[..., None]
        col = np.where(cap[..., None], sn, col)
    # Rim light on the ridge line, then fog from the bottom.
    rim = np.clip(1 - (yy - h[None, :]) / 3.0, 0, 1) * inside
    col = col + rim[..., None] * 26
    t = np.clip((yy / height - fog_from) / (1 - fog_from), 0, 1) ** 1.4
    col = col * (1 - t[..., None] * 0.85) + fog[None, None, :] * (t[..., None] * 0.85)
    # Anti-aliased edge.
    a = np.clip(yy - h[None, :] + 1, 0, 1)
    out = np.dstack([np.clip(col, 0, 255), (a * 255)[..., None]]).astype(np.uint8)
    return Image.fromarray(out, "RGBA"), h


def stamp_trees(layer: Image.Image, h: np.ndarray, tree: Image.Image, color: np.ndarray, every: int, scale: tuple, seed: int,
                sink: int = 6, clump: float = -1.0) -> None:
    """Plant tinted tree silhouettes along a ridge (a forest line), wrapping at the edges so the strip still tiles."""
    rng = np.random.default_rng(seed)
    w = layer.width
    dens = ridge(w, [(5, 1), (11, 0.5)], seed + 1)
    x = 0
    while x < w:
        if dens[int(x) % w] < clump:
            x += every
            continue
        s = rng.uniform(*scale)
        t = tree.resize((max(2, int(tree.width * s)), max(2, int(tree.height * s))), Image.LANCZOS)
        ta = np.asarray(t)[..., 3]
        shade = color * rng.uniform(0.9, 1.08)
        sil = np.dstack([np.broadcast_to(shade, ta.shape + (3,)), ta[..., None]]).astype(np.uint8)
        im = Image.fromarray(sil, "RGBA")
        y = int(h[int(x) % w]) - t.height + sink + int(rng.uniform(0, 8))
        for ox in (int(x) - t.width // 2, int(x) - t.width // 2 - w):
            layer.alpha_composite(im, (ox, max(0, y))) if ox > -t.width else None
        x += every * rng.uniform(0.5, 1.3)


def gradient(height: int, stops: list) -> np.ndarray:
    ys = np.linspace(0, 1, height)
    pos = np.linspace(0, 1, len(stops))
    cols = np.array([rgb(c) for c in stops])
    return np.stack([np.interp(ys, pos, cols[:, k]) for k in range(3)], 1)


def build_layers() -> dict:
    """Painted parallax layers for day and night. Sizes are in texture pixels; the game shows them at 1 px per CSS px."""
    sizes = {}
    pine = img(BGE / "treePine.png")
    for tod, P in PAL.items():
        C = {k: (rgb(v) if isinstance(v, str) else v) for k, v in P.items()}
        # Sky: a 4 x 512 gradient, stretched by the game.
        g = gradient(512, P["sky"])
        sky = Image.fromarray(np.repeat(g[:, None, :], 4, 1).astype(np.uint8), "RGB")
        sizes[f"sky-{tod}.webp"] = save_webp(sky, f"sky-{tod}.webp")
        # Far snowy range.
        W = 2048
        prof = 0.6 * peaks(W, 7, 1.6, 11) + 0.4 * peaks(W, 13, 1.3, 12) + 0.06 * ridge(W, [(31, 1), (67, 0.5)], 13)
        prof = (prof - prof.min()) / (prof.max() - prof.min())
        far, _ = mountain_layer(W, 300, 40, 170, prof, C["far"], C["farLit"], C["haze"], C["snow"], 0.42, seed=14, fog_from=0.25)
        sizes[f"far-{tod}.webp"] = save_webp(far, f"far-{tod}.webp")
        # The landmark peak: one big mountain (not tiling), the summit the climber is heading for.
        PW, PH = 1100, 760
        x = np.linspace(-1, 1, PW)
        pp = np.clip(1 - np.abs(x) ** 1.15, 0, 1) ** 1.25 + 0.03 * ridge(PW, [(7, 1), (17, 0.4)], 21)
        pp += 0.18 * np.clip(1 - np.abs(x + 0.45) * 3.2, 0, 1) + 0.14 * np.clip(1 - np.abs(x - 0.5) * 3.6, 0, 1)
        pp = np.clip(pp, 0, None)
        pp = (pp - pp.min()) / (pp.max() - pp.min())
        peak, ph = mountain_layer(PW, PH, 30, PH - 60, pp, C["peak"], C["peakLit"], C["haze"], C["snow"], 0.36, seed=22, fog_from=0.35)
        # fade the sides to nothing so the peak sits in the range without a hard edge
        a = np.asarray(peak).copy()
        edge = np.clip(np.minimum(np.arange(PW), PW - 1 - np.arange(PW)) / 90, 0, 1)
        a[..., 3] = (a[..., 3] * edge[None, :]).astype(np.uint8)
        peak = Image.fromarray(a, "RGBA")
        sizes[f"peak-{tod}.webp"] = save_webp(peak, f"peak-{tod}.webp")
        # Mid range with a forest line.
        prof = 0.55 * peaks(W, 5, 1.2, 31) + 0.45 * peaks(W, 11, 1.1, 32) + 0.08 * ridge(W, [(29, 1), (71, 0.4)], 33)
        prof = (prof - prof.min()) / (prof.max() - prof.min())
        mid, mh = mountain_layer(W, 420, 30, 200, prof, C["mid"], C["midLit"], C["fog"], None, seed=34, fog_from=0.5)
        trees = Image.new("RGBA", mid.size)
        stamp_trees(trees, mh + 120, pine, C["forestMid"], 8, (0.12, 0.2), 35, sink=14)
        mid = Image.alpha_composite(mid, trees)
        fogm = gradient(420, [P["fog"], P["fog"]])
        a = np.asarray(mid).astype(np.float32)
        t = np.clip((np.arange(420) / 420 - 0.55) / 0.45, 0, 1)[:, None, None] ** 1.2
        a[..., :3] = a[..., :3] * (1 - t * 0.7) + fogm[:, None, :] * (t * 0.7)
        mid = Image.fromarray(a.astype(np.uint8), "RGBA")
        sizes[f"mid-{tod}.webp"] = save_webp(mid, f"mid-{tod}.webp")
        # Near hills: rolling, with a dense forest edge (closest background layer).
        prof = 0.5 + 0.5 * ridge(W, [(3, 0.6), (7, 0.3), (13, 0.12)], 41) / 1.02
        near, nh = mountain_layer(W, 360, 70, 140, prof, C["near"], C["nearLit"], C["fog"], None, seed=42, fog_from=0.6)
        trees = Image.new("RGBA", near.size)
        stamp_trees(trees, nh, pine, C["forestNear"], 13, (0.2, 0.34), 43, sink=34, clump=-0.3)
        near = Image.alpha_composite(near, trees)
        sizes[f"near-{tod}.webp"] = save_webp(near, f"near-{tod}.webp")
    return sizes


def periodic(n: int, terms: list, seed: int) -> np.ndarray:
    """2-D noise that tiles: a sum of waves with whole-number frequencies in x and y."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n] / n * 2 * math.pi
    v = np.zeros((n, n), np.float32)
    for fx, fy, a in terms:
        for _ in range(3):
            v += a * np.sin(fx * xx * rng.choice([-1, 1]) + fy * yy * rng.choice([-1, 1]) + rng.uniform(0, 6.3))
    return v


def rock(n: int, band_cols: list, seed: int) -> Image.Image:
    """Layered rock: wavy horizontal strata, darker seams between them, a grain of small stones."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    warp = periodic(n, [(1, 0, 2.2), (2, 1, 1.0), (3, 0, 0.6)], seed)
    strata = (yy + warp) / n * 8                     # 8 bands per tile (a multiple of the 4 colours), so it tiles
    band = np.floor(strata) % len(band_cols)
    frac = strata - np.floor(strata)
    cols = np.array([rgb(c) for c in band_cols])
    col = cols[band.astype(int)]
    # a soft light at the top of each band and a dark seam at its bottom
    col = col * (1.06 - 0.16 * frac[..., None])
    seam = np.clip((frac - 0.9) / 0.1, 0, 1)
    col = col * (1 - 0.35 * seam[..., None])
    grain = periodic(n, [(9, 7, 1), (13, 17, 0.7), (23, 19, 0.5), (31, 29, 0.4)], seed + 1)
    col = col * (1 + 0.012 * grain[..., None])
    # short vertical joints in alternate bands, like bedded sandstone
    jx = (xx + 37 * band) % 64
    joint = (jx < 1.6) & (band % 2 == 0) & (frac > 0.12) & (frac < 0.88)
    col = np.where(joint[..., None], col * 0.78, col)
    return Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def textures() -> dict:
    sizes = {}
    # Rock for the cliff columns: painted strata, seamless both ways (256 x 256), warm sandstone.
    sizes["dirt.webp"] = save_webp(rock(256, ["#c98f5e", "#b07a50", "#9a6743", "#b8845a"], 51), "dirt.webp")
    sizes["stone.webp"] = save_webp(rock(256, ["#a9a39b", "#8f8a83", "#7e7a74", "#9d978f"], 52), "stone.webp")
    # Waterfall: vertical streaks, seamless top to bottom (64 x 256).
    rng = np.random.default_rng(5)
    w, h = 64, 256
    yy = np.arange(h)[:, None] / h * 2 * math.pi
    xx = np.arange(w)[None, :]
    v = np.zeros((h, w), np.float32)
    for k in range(10):
        fx, ph, f = rng.uniform(0, w), rng.uniform(0, 6.3), int(rng.integers(1, 4))
        band = np.exp(-((xx - fx) ** 2) / (2 * rng.uniform(1.5, 4) ** 2))
        v += band * (0.5 + 0.5 * np.sin(f * yy + ph))
    v = v / v.max()
    edge = np.clip(np.minimum(xx, w - 1 - xx) / 10, 0, 1)
    col = np.dstack([180 + 75 * v, 220 + 35 * v, 245 + 10 * v, (150 + 105 * v) * edge]).clip(0, 255).astype(np.uint8)
    sizes["waterfall.webp"] = save_webp(Image.fromarray(col, "RGBA"), "waterfall.webp")
    # Foreground: a low band of grass blades and leaves, pre-blurred (no blur filter at run time), 640 x 220.
    fg = Image.new("RGBA", (640, 220))
    d = ImageDraw.Draw(fg)
    rng = np.random.default_rng(9)
    for k in range(70):
        x0 = rng.uniform(0, 640)
        hgt = rng.uniform(60, 200) * (1.0 if (x0 < 200 or x0 > 470) else 0.45)
        lean = rng.uniform(-40, 40)
        w = rng.uniform(8, 18)
        col = (int(rng.uniform(18, 34)), int(rng.uniform(44, 70)), int(rng.uniform(34, 50)), 255)
        d.polygon([(x0 - w, 220), (x0 + w, 220), (x0 + lean, 220 - hgt)], fill=col)
    for k in range(10):
        cx, cy, r = rng.uniform(0, 640), rng.uniform(150, 230), rng.uniform(26, 48)
        if 220 < cx < 440:
            continue
        d.ellipse([cx - r * 1.6, cy - r * 0.7, cx + r * 1.6, cy + r * 0.7], fill=(22, 52, 40, 255))
    fg = fg.filter(ImageFilter.GaussianBlur(3.2))
    sizes["fg.webp"] = save_webp(fg, "fg.webp")
    return sizes


# ---------- atlas ----------
class Packer:
    """Shelf packer for one atlas page: tallest first, 2 px padding with edge pixels extruded (no bleeding)."""

    def __init__(self, size: int = 2048) -> None:
        self.size, self.items = size, []

    def add(self, name: str, im: Image.Image) -> None:
        self.items.append((name, im))

    def build(self) -> tuple[Image.Image, dict]:
        page = Image.new("RGBA", (self.size, self.size))
        frames, x, y, row = {}, 0, 0, 0
        for name, im in sorted(self.items, key=lambda t: -t[1].height):
            w, h = im.size
            if x + w + 4 > self.size:
                x, y, row = 0, y + row + 4, 0
            if y + h + 4 > self.size:
                raise SystemExit("atlas full at " + name)
            # extrude 2 px so linear filtering never samples a neighbour
            ext = Image.new("RGBA", (w + 4, h + 4))
            ext.paste(im.resize((w + 4, h + 4), Image.NEAREST), (0, 0))
            ext.paste(im, (2, 2))
            page.paste(ext, (x, y))
            frames[name] = [x + 2, y + 2, w, h]
            x += w + 4
            row = max(row, h)
        used = y + row + 4
        return page, frames, used


def eyelids(head: Image.Image, mode: str) -> Image.Image:
    """Bake a closed-eye head from the open one: skin over the eyes and a lash line (blink), or happy arcs."""
    out = head.copy()
    d = ImageDraw.Draw(out)
    skin, lash = (255, 215, 177, 255), (120, 70, 56, 255)
    for (x0, x1, y0, y1) in ((27, 44, 39, 57), (61, 78, 43, 57)):
        d.ellipse([x0 - 1, y0 - 1, x1 + 1, y1 + 1], fill=skin)
        cy = (y0 + y1) / 2 + 2
        if mode == "blink":
            d.arc([x0, cy - 5, x1, cy + 5], 15, 165, fill=lash, width=3)
        else:
            d.arc([x0 + 1, cy - 4, x1 - 1, cy + 10], 200, 340, fill=lash, width=4)
    return out


def book() -> Image.Image:
    im = Image.new("RGBA", (64, 46))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([2, 4, 62, 44], 6, fill=(70, 86, 170, 255))
    d.rounded_rectangle([6, 2, 31, 40], 4, fill=(250, 246, 234, 255))
    d.rounded_rectangle([33, 2, 58, 40], 4, fill=(250, 246, 234, 255))
    for k in range(5):
        d.line([10, 10 + k * 6, 27, 10 + k * 6], fill=(170, 170, 190, 255), width=2)
        d.line([37, 10 + k * 6, 54, 10 + k * 6], fill=(170, 170, 190, 255), width=2)
    d.line([32, 3, 32, 41], fill=(200, 196, 186, 255), width=2)
    return im


def radial(size: int, power: float = 2.0, color=(255, 255, 255)) -> Image.Image:
    yy, xx = np.mgrid[0:size, 0:size]
    r = np.sqrt((xx - size / 2 + 0.5) ** 2 + (yy - size / 2 + 0.5) ** 2) / (size / 2)
    a = np.clip(1 - r, 0, 1) ** power
    return Image.fromarray(np.dstack([np.full_like(a, c) for c in color] + [a * 255]).astype(np.uint8), "RGBA")


def shapes() -> dict:
    out = {}
    out["fx/glow"] = radial(128, 2.2)
    out["fx/soft"] = radial(64, 1.2)
    out["fx/shadow"] = radial(96, 1.5, (20, 24, 40)).resize((96, 32))
    # Light ray: a long soft wedge (additive).
    yy, xx = np.mgrid[0:256, 0:64]
    a = np.clip(1 - np.abs(xx - 31.5) / (6 + yy * 0.1), 0, 1) * (1 - yy / 256) ** 0.6
    out["fx/ray"] = Image.fromarray(np.dstack([np.full_like(a, 255)] * 3 + [a * 200]).astype(np.uint8), "RGBA")
    # Vignette: clear centre, soft dark corners (stretched over the screen).
    yy, xx = np.mgrid[0:128, 0:128]
    r = np.sqrt(((xx - 63.5) / 64) ** 2 + ((yy - 63.5) / 64) ** 2)
    v = np.clip((r - 0.55) / 0.6, 0, 1) ** 1.6
    out["fx/vignette"] = Image.fromarray(np.dstack([np.zeros_like(v)] * 3 + [v * 255]).astype(np.uint8), "RGBA")
    out["fx/vgrad"] = Image.fromarray(np.dstack([np.full((128, 8), 255)] * 3 + [np.repeat(np.linspace(0, 255, 128)[:, None], 8, 1)]).astype(np.uint8), "RGBA")
    conf = Image.new("RGBA", (12, 18))
    ImageDraw.Draw(conf).rounded_rectangle([0, 0, 11, 17], 3, fill=(255, 255, 255, 255))
    out["fx/confetti"] = conf
    leaf = Image.new("RGBA", (28, 16))
    ImageDraw.Draw(leaf).ellipse([0, 2, 27, 13], fill=(255, 255, 255, 255))
    ImageDraw.Draw(leaf).line([2, 8, 26, 8], fill=(220, 220, 220, 255), width=2)
    out["fx/leaf"] = leaf
    # A bird in three wing positions (dark silhouette, tinted by the game).
    for k, lift in enumerate((-10, 0, 9)):
        b = Image.new("RGBA", (44, 26))
        d = ImageDraw.Draw(b)
        d.line([(3, 13 + lift * 0.6), (14, 13 + lift * 0.2), (22, 15)], fill=(40, 44, 60, 255), width=4, joint="curve")
        d.line([(41, 13 + lift * 0.6), (30, 13 + lift * 0.2), (22, 15)], fill=(40, 44, 60, 255), width=4, joint="curve")
        d.ellipse([18, 12, 27, 19], fill=(40, 44, 60, 255))
        out[f"fx/bird{k}"] = b
    # Badges for the question signs: tick (correct) and flag (saved for review), drawn once.
    for kind, col in (("ok", (47, 158, 87)), ("flag", (227, 150, 44))):
        b = Image.new("RGBA", (64, 64))
        d = ImageDraw.Draw(b)
        d.ellipse([2, 2, 61, 61], fill=(255, 255, 255, 255))
        d.ellipse([6, 6, 57, 57], fill=col + (255,))
        if kind == "ok":
            d.line([(18, 33), (28, 43), (46, 22)], fill=(255, 255, 255, 255), width=8, joint="curve")
        else:
            d.line([(23, 17), (23, 48)], fill=(255, 255, 255, 255), width=6)
            d.polygon([(25, 17), (45, 23), (25, 31)], fill=(255, 255, 255, 255))
        out[f"ui/{kind}"] = b
    out["ui/plate"] = plate()
    return out


def plate() -> Image.Image:
    """A blank wooden sign board (the number is drawn by the game)."""
    im = Image.new("RGBA", (120, 120))
    d = ImageDraw.Draw(im)
    d.rectangle([54, 50, 66, 119], fill=(122, 74, 46, 255))
    d.rectangle([58, 50, 62, 119], fill=(146, 92, 58, 255))
    d.rounded_rectangle([4, 6, 116, 70], 12, fill=(122, 74, 46, 255))
    d.rounded_rectangle([9, 10, 111, 64], 9, fill=(214, 160, 96, 255))
    d.rounded_rectangle([9, 10, 111, 34], 9, fill=(226, 176, 112, 255))
    return im


def build_atlas() -> tuple[dict, int]:
    pk = Packer()
    for n in "arm back body bodyBack hand head headBack headFocus headShock leg legBend".split():
        pk.add("hero/" + n, img(TOON / "Parts HD" / f"{n}.png"))
    head = img(TOON / "Parts HD" / "head.png")
    pk.add("hero/headBlink", eyelids(head, "blink"))
    pk.add("hero/headHappy", eyelids(head, "happy"))
    pk.add("hero/book", book())
    for n in ("idle", "jump", "cheer0"):
        p = img(TOON / "Poses HD" / f"character_femaleAdventurer_{n}.png")
        pk.add("icon/" + n.rstrip("0"), p.resize((96, 128), Image.LANCZOS))
    for n in "grassMid grassLeft grassRight grassHalf_mid grassHalf_left grassHalf_right".split():
        pk.add("tile/" + n, img(RED / "Ground" / "Grass" / f"{n}.png"))
    for n in "stoneHalf_mid stoneHalf_left stoneHalf_right stoneMid".split():
        pk.add("tile/" + n, img(RED / "Ground" / "Stone" / f"{n}.png"))
    for n in "chain sign bush rock grass plantPurple fence torch1 torch2 bridgeA".split():
        pk.add("prop/" + n, img(RED / "Tiles" / f"{n}.png"))
    for n in "coinGold coinSilver flagGreen1 flagGreen2 flagGreen_down flagYellow1 flagYellow2 star".split():
        pk.add("item/" + n, img(RED / "Items" / f"{n}.png"))
    for n in "treePine treeSmall_green1 treeSmall_green2 treeSmall_green3 tree treeLong bush1 bush2 bush3 bush4 cloud1 cloud2 cloud3 cloud5 cloud6 cloud8 moon moonFull fence towerAlt".split():
        im = img(BGE / f"{n}.png")
        if n.startswith("cloud") or n in ("towerAlt",):
            im = im.resize((im.width * 3 // 4, im.height * 3 // 4), Image.LANCZOS)
        pk.add("bg/" + n, im)
    for n in "light_01 light_02 star_06 spark_05 circle_05 smoke_04 magic_05".split():
        im = img(PART / f"{n}.png")
        pk.add("fx/" + n, im.resize((im.width // 4, im.height // 4), Image.LANCZOS))
    for i, k in enumerate((0, 4, 8, 12, 16, 20, 24)):
        im = img(PUFF / f"whitePuff{k:02d}.png")
        pk.add(f"fx/puff{i}", im.resize((im.width // 4, im.height // 4), Image.LANCZOS))
    for n, im in shapes().items():
        pk.add(n, im)
    page, frames, used = pk.build()
    h = 1 << (used - 1).bit_length()
    page = page.crop((0, 0, 2048, min(2048, h)))
    size = save_webp(page, "atlas.webp", quality=90, method=6)
    return {"image": "atlas.webp", "size": list(page.size), "frames": frames}, size


# The hero rig: joints in the Kenney pose space (192 x 256, feet at 96, 256), measured against the idle pose.
RIG = {
    "feet": [96, 256],
    "parts": {
        "back": {"at": [99, 150], "anchor": [50, 85]},
        "body": {"at": [95, 231], "anchor": [37, 88]},
        "head": {"at": [99, 164], "anchor": [53, 84]},
        "armR": {"at": [139, 167], "anchor": [20, 6]}, "handR": {"at": [5, 46], "anchor": [15, 4]},
        "armL": {"at": [51, 167], "anchor": [20, 6]}, "handL": {"at": [-10, 46], "anchor": [15, 4]},
        "legR": {"at": [116, 200], "anchor": [18, 4]}, "legL": {"at": [78, 200], "anchor": [18, 4]},
        "book": {"anchor": [32, 30]},
    },
}

SOUNDS = {
    "music": "Music Loops/Loops/Flowing Rocks.ogg",
    "coin": "Interface Sounds/Audio/glass_002.ogg", "coin2": "Interface Sounds/Audio/glass_004.ogg",
    "jump": "Interface Sounds/Audio/pluck_001.ogg", "land": "Impact Sounds/Audio/footstep_grass_000.ogg",
    "step": "Impact Sounds/Audio/footstep_grass_002.ogg", "lift": "Impact Sounds/Audio/impactMetal_light_002.ogg",
    "tap": "Interface Sounds/Audio/click_002.ogg", "correct": "Interface Sounds/Audio/confirmation_001.ogg",
    "soft": "Interface Sounds/Audio/drop_002.ogg", "cheer": "Music Jingles/Audio (Pizzicato)/jingles-pizzicato_04.ogg",
    "flag": "Interface Sounds/Audio/maximize_006.ogg",
}


def sounds() -> dict:
    sizes = {}
    if not shutil.which("ffmpeg"):
        print("[build-hd] ffmpeg missing: no sounds")
        return sizes
    for key, rel in SOUNDS.items():
        dst = OUT / f"{key}.mp3"
        q = ["-b:a", "96k", "-ac", "2"] if key == "music" else ["-q:a", "5", "-ac", "1"]
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(AUD / rel), *q, "-codec:a", "libmp3lame",
                        "-map_metadata", "-1", str(dst)], check=True)
        sizes[dst.name] = dst.stat().st_size
    return sizes


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    atlas, asize = build_atlas()
    sizes = {"atlas.webp": asize}
    sizes.update(build_layers())
    sizes.update(textures())
    snd = sounds()
    kit = {"atlas": atlas, "rig": RIG, "palette": PAL,
           "layers": {k: {"day": f"{k}-day.webp", "night": f"{k}-night.webp"} for k in ("sky", "far", "peak", "mid", "near")},
           "textures": {"dirt": "dirt.webp", "stone": "stone.webp", "waterfall": "waterfall.webp", "fg": "fg.webp"},
           "sizes": sizes, "sounds": snd}
    (OUT / "kit.json").write_text(json.dumps(kit, separators=(",", ":")))
    art = sum(sizes.values())
    print(f"[build-hd] {OUT} art {art / 1024:.0f} KB (atlas {asize / 1024:.0f} KB {atlas['size']}), sound {sum(snd.values()) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
