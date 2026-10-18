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
    "night": {"sky": ["#070b22", "#141c46", "#2a2f66", "#4b3d78"], "far": "#2c3566", "farLit": "#3e4a85", "snow": "#7f8fc4",
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


def smooth(h: np.ndarray, k: int, wrap: bool = True) -> np.ndarray:
    k = max(3, k | 1)
    ext = np.concatenate([h[-k:], h, h[:k]]) if wrap else np.concatenate([np.full(k, h[0]), h, np.full(k, h[-1])])
    return np.convolve(ext, np.ones(k) / k, mode="same")[k:-k]


def mountain_layer(width, height, top, amp, prof, base, lit, fog, snow=None, snow_line=0.0, seed=0, fog_from=0.45, wrap=True, S=1.0):
    """A painted range in the flat "atmospheric" style: every mountain has a spine running down from its apex, the
    face right of it is lit (light from the right) and the face left of it is in shade, with soft reflected light in
    the valleys, optional snow caps (lit and shaded), a rim of light on the lit ridges and fog rising from the bottom.
    Sizes are in texture pixels (S pixels per world unit). Returns (RGBA image, ridge row per column)."""
    W = width
    h = top + amp * (1 - prof)
    yy = np.arange(height, dtype=np.float32)[:, None]
    xx = np.arange(W, dtype=np.float32)[None, :]
    hs = smooth(h, int(W / 160), wrap)
    R = max(6, int(W / 36))
    ext = np.concatenate([hs[-R:], hs, hs[:R]]) if wrap else np.concatenate([np.full(R, 1e9), hs, np.full(R, 1e9)])
    win = np.lib.stride_tricks.sliding_window_view(ext, 2 * R + 1)
    apex = np.nonzero(hs <= win.min(1) + 1e-6)[0]
    rng = np.random.default_rng(seed)
    lean = rng.uniform(-0.55, -0.05, len(apex))           # spines lean to the lower left, light falls from the right
    # nearest apex for every column (with wrap)
    d = np.abs(np.arange(W)[:, None] - apex[None, :])
    if wrap:
        d = np.minimum(d, W - d)
    near = np.argmin(d, 1)
    ax, ay, al = apex[near].astype(np.float32), hs[apex[near]], lean[near]
    dx = xx - ax[None, :]
    if wrap:
        dx = (dx + W / 2) % W - W / 2
    spine = (yy - ay[None, :]) * al[None, :]
    side = np.clip((dx - spine) / (1.5 * S) + 0.5, 0, 1)    # 1 = lit face, 0 = shaded face (anti-aliased)
    reach = np.clip(np.abs(dx - spine) / (amp * 0.9 + 1), 0, 1)
    shade_v = 0.08 + 0.22 * reach                              # reflected light grows toward the valley
    lit_v = 1.0 - 0.18 * reach                                 # the lit face dims away from the spine
    k = side * lit_v + (1 - side) * shade_v
    col = base[None, None, :] + (lit - base)[None, None, :] * k[..., None]
    depth = yy - h[None, :]
    if snow is not None:
        jag = smooth(ridge(W, [(17, 6), (41, 3), (97, 1.5)], seed + 3), 3, wrap)[None, :] * S
        line = top + amp * snow_line
        cap = (h[None, :] < line) & (depth < (26 * S + jag + (line - h[None, :]) * 0.55))
        sn = snow[None, None, :] * (0.78 + 0.22 * k)[..., None] + np.array([0, 4, 14], np.float32) * (1 - side)[..., None]
        col = np.where(cap[..., None], sn, col)
    rim = np.clip(1 - depth / (2.2 * S), 0, 1) * (depth >= 0) * side
    col = col + rim[..., None] * 30
    col = col * (1.04 - 0.08 * np.clip(depth / (amp + 1), 0, 1))[..., None]
    t = np.clip((yy / height - fog_from) / (1 - fog_from), 0, 1) ** 1.4
    col = col * (1 - t[..., None] * 0.85) + fog[None, None, :] * (t[..., None] * 0.85)
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


def bottom_colour(im: Image.Image) -> str:
    a = np.asarray(im.convert("RGBA"))[-2]
    c = a[a[:, 3] > 200][:, :3].mean(0)
    return "#%02x%02x%02x" % tuple(int(v) for v in c)


def cloud_sea(W: int, H: int, top: tuple, under: tuple, seed: int) -> Image.Image:
    """A sea of clouds seen from above, tiling horizontally: rows of round billows, lit on top, blue underneath,
    fading out toward the bottom."""
    rng = np.random.default_rng(seed)
    im = Image.new("RGBA", (W, H))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    field = np.zeros((H, W), np.float32)
    for row in range(3):
        n = 9 + row * 5
        base_y = H * (0.3 + row * 0.12)
        for k in range(n):
            cx = (k + rng.uniform(-0.35, 0.35)) * W / n
            r = rng.uniform(0.16, 0.3) * H * (1 + row * 0.2)
            cy = base_y + rng.uniform(-0.05, 0.06) * H
            for ox in (-W, 0, W):
                dx = xx - (cx + ox)
                if np.abs(cx + ox - W / 2) > W / 2 + r * 2:
                    continue
                field = np.maximum(field, 1 - ((dx / (r * 1.8)) ** 2 + ((yy - cy) / (r * 0.75)) ** 2))
    inside = np.clip(field * 5, 0, 1)
    # light from above: the higher in a billow, the brighter; soft, like a painted cloud bank
    lightk = np.clip(field * 1.3 + (0.5 - yy / H) * 0.6, 0, 1)
    lightk = np.asarray(Image.fromarray((lightk * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
    col = np.array(under, np.float32)[None, None, :] * (1 - lightk[..., None]) + np.array(top, np.float32)[None, None, :] * lightk[..., None]
    fade = np.clip(1 - (yy / H - 0.55) / 0.45, 0, 1)
    a = inside * fade
    return Image.fromarray(np.dstack([np.clip(col, 0, 255), a[..., None] * 255]).astype(np.uint8), "RGBA")


def build_layers(kitpal: dict) -> dict:
    """Painted parallax layers for day and night, at 2 texture px per world unit for the near layers (sharp on 2x
    screens) and 1 for the hazy far range."""
    sizes = {}
    pine = img(BGE / "treePine.png")
    for tod, P in PAL.items():
        C = {k: (rgb(v) if isinstance(v, str) else v) for k, v in P.items()}
        g = gradient(512, P["sky"])
        sky = Image.fromarray(np.repeat(g[:, None, :], 4, 1).astype(np.uint8), "RGB")
        sizes[f"sky-{tod}.webp"] = save_webp(sky, f"sky-{tod}.webp")
        # Far snowy range: 2048 x 300 units at 1 px per unit (it is hazy, softness is right there).
        W = 2048
        prof = 0.6 * peaks(W, 4, 1.6, 11) + 0.4 * peaks(W, 7, 1.3, 12) + 0.04 * ridge(W, [(17, 1), (37, 0.5)], 13)
        prof = (prof - prof.min()) / (prof.max() - prof.min())
        far, _ = mountain_layer(W, 600, 80, 340, prof, C["far"], C["farLit"], C["haze"], C["snow"], 0.42, seed=14, fog_from=0.3, S=2)
        sizes[f"far-{tod}.webp"] = save_webp(far, f"far-{tod}.webp")
        # The landmark peak (not tiling), 1100 x 760 units at 1.6 px per unit.
        S = 1.6
        PW, PH = int(1100 * S), int(760 * S)
        x = np.linspace(-1, 1, PW)
        pp = np.clip(1 - np.abs(x) ** 1.15, 0, 1) ** 1.25 + 0.02 * ridge(PW, [(7, 1), (17, 0.4)], 21)
        pp += 0.18 * np.clip(1 - np.abs(x + 0.45) * 3.2, 0, 1) + 0.14 * np.clip(1 - np.abs(x - 0.5) * 3.6, 0, 1)
        pp = (pp - pp.min()) / (pp.max() - pp.min())
        peak, _ = mountain_layer(PW, PH, 30 * S, PH - 60 * S, pp, C["peak"], C["peakLit"], C["haze"], C["snow"], 0.36, seed=22, fog_from=0.35, wrap=False, S=S)
        a = np.asarray(peak).copy()
        edge = np.clip(np.minimum(np.arange(PW), PW - 1 - np.arange(PW)) / (90 * S), 0, 1)
        a[..., 3] = (a[..., 3] * edge[None, :]).astype(np.uint8)
        sizes[f"peak-{tod}.webp"] = save_webp(Image.fromarray(a, "RGBA"), f"peak-{tod}.webp")
        # Sea of clouds below the far peaks: 1024 x 160 units at 2 px per unit.
        cs = cloud_sea(2048, 320, (255, 255, 255) if tod == "day" else (150, 160, 210), (196, 214, 236) if tod == "day" else (56, 62, 118), 61)
        sizes[f"cloudsea-{tod}.webp"] = save_webp(cs, f"cloudsea-{tod}.webp")
        # Mid range with a forest line: 1024 x 420 units at 2 px per unit.
        W, S = 2048, 2
        prof = 0.55 * peaks(W, 3, 1.2, 31) + 0.45 * peaks(W, 6, 1.1, 32) + 0.05 * ridge(W, [(19, 1), (41, 0.4)], 33)
        prof = (prof - prof.min()) / (prof.max() - prof.min())
        mid, mh = mountain_layer(W, 840, 60, 400, prof, C["mid"], C["midLit"], C["fog"], None, seed=34, fog_from=0.5, S=S)
        trees = Image.new("RGBA", mid.size)
        stamp_trees(trees, mh + 240, pine, C["forestMid"], 14, (0.22, 0.36), 35, sink=26)
        mid = Image.alpha_composite(mid, trees)
        a = np.asarray(mid).astype(np.float32)
        t = np.clip((np.arange(840) / 840 - 0.55) / 0.45, 0, 1)[:, None, None] ** 1.2
        a[..., :3] = a[..., :3] * (1 - t * 0.7) + C["fog"][None, None, :] * (t * 0.7)
        mid = Image.fromarray(a.astype(np.uint8), "RGBA")
        sizes[f"mid-{tod}.webp"] = save_webp(mid, f"mid-{tod}.webp")
        # Near hills with forest clumps: 1024 x 360 units at 2 px per unit.
        prof = 0.5 + 0.5 * ridge(W, [(2, 0.6), (5, 0.3), (9, 0.12)], 41) / 1.02
        near, nh = mountain_layer(W, 720, 140, 280, prof, C["near"], C["nearLit"], C["fog"], None, seed=42, fog_from=0.55, S=S)
        trees = Image.new("RGBA", near.size)
        stamp_trees(trees, nh, pine, C["forestNear"], 22, (0.4, 0.66), 43, sink=64, clump=-0.3)
        near = Image.alpha_composite(near, trees)
        sizes[f"near-{tod}.webp"] = save_webp(near, f"near-{tod}.webp")
        kitpal[tod] = dict(P, nearBottom=bottom_colour(near), midBottom=bottom_colour(mid))
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


def wave1d(n: int, terms: list, seed: int) -> np.ndarray:
    """Smooth 1-D noise over n samples (not periodic): a few sines with random phases."""
    rng = np.random.default_rng(seed)
    t = np.arange(n) / n
    v = np.zeros(n, np.float32)
    for f, a in terms:
        v += a * np.sin(2 * math.pi * f * t + rng.uniform(0, 6.3))
    return v


CLIFF_SANDSTONE = ["#c88d5c", "#b47d52", "#a06c47", "#bd8758", "#a8744c", "#c2905f"]
CLIFF_STONE = ["#a6a097", "#938d86", "#857f79", "#9c968e", "#8c867f"]


def cliff(wu: float, seed: int, colours: list, S: int = 2, hu: int = 600, margin: int = 14, green: bool = True) -> Image.Image:
    """One cliff column under a ledge, drawn as a single painted shape (the game shows it at 1/S scale):
    a rocky silhouette that widens toward the base, uneven wavy strata, cracks and grain, a dark band of ambient
    occlusion under the grass lip, a warm rim of light on the sunny right edge, shade on the left, moss and hanging
    vines near the top, and a fade to transparent at the bottom (the valley haze shows through)."""
    rng = np.random.default_rng(seed)
    W, H, M = int((wu + 2 * margin) * S), hu * S, margin * S
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    t = yy[:, 0] / H
    pin = np.clip(1 - yy[:, 0] / (26 * S), 0, 1) ** 2         # edges pinned to the lip width near the top
    xl = M - t ** 1.25 * M * 0.9 + wave1d(H, [(2, 4), (5, 3), (11, 1.6), (29, 0.8)], seed + 1) * S
    xr = W - M + t ** 1.25 * M * 0.9 + wave1d(H, [(2, 4), (6, 3), (13, 1.6), (31, 0.8)], seed + 2) * S
    xl = xl * (1 - pin) + M * pin
    xr = xr * (1 - pin) + (W - M) * pin
    alpha = np.clip(xx - xl[:, None] + 1, 0, 1) * np.clip(xr[:, None] - xx + 1, 0, 1)
    # strata: bands of uneven thickness whose boundaries wave and tilt
    bounds, y = [], -rng.uniform(0, 20) * S
    while y < H + 60 * S:
        y += rng.choice([rng.uniform(7, 16), rng.uniform(16, 34), rng.uniform(34, 62)]) * S
        bounds.append(y)
    bounds = np.array(bounds, np.float32)
    warp = (wave1d(W, [(1, 5), (3, 3), (7, 1.5)], seed + 3) * S)[None, :] + (xx - W / 2) * rng.uniform(-0.04, 0.04)
    u = yy + warp
    idx = np.searchsorted(bounds, u)
    lo = np.where(idx > 0, bounds[np.maximum(idx - 1, 0)], u - 20 * S)
    hi = bounds[np.minimum(idx, len(bounds) - 1)]
    frac = np.clip((u - lo) / np.maximum(1, hi - lo), 0, 1)
    pal = np.array([rgb(c) for c in colours])
    pick = rng.integers(0, len(pal), len(bounds) + 1)
    hue = rng.uniform([0.9, 0.92, 0.9], [1.08, 1.05, 1.04], (len(bounds) + 1, 3))
    bright = rng.uniform(0.88, 1.08, len(bounds) + 1)
    band = pal[pick[idx]] * hue[idx] * bright[idx][..., None]
    band = band * (1.07 - 0.14 * frac[..., None])
    band = band * (1 - 0.28 * np.clip((frac - 0.86) / 0.14, 0, 1))[..., None]
    grain = (np.sin(xx * 0.9 + yy * 0.37) * np.sin(xx * 0.23 - yy * 1.1) + np.sin(xx * 2.3 + yy * 1.7) * 0.5) * 0.018
    col = band * (1 + grain[..., None])
    # outcrops: some band tops stick out as a lit lip with a soft shadow under it
    out_b = rng.random(len(bounds) + 1) < 0.3
    du = u - lo
    lip = out_b[idx] & (du >= 0) & (du < 2.2 * S)
    sh = out_b[idx] & (du >= 2.2 * S) & (du < 9 * S)
    col = np.where(lip[..., None], col * 1.16, col)
    col = col * (1 - 0.3 * sh * np.clip(1 - (du - 2.2 * S) / (6.8 * S), 0, 1))[..., None]
    # rounded column: the face turns from shade (left) to the sun (right)
    across = np.clip((xx - xl[:, None]) / np.maximum(1, (xr - xl)[:, None]), 0, 1)
    col = col * (0.74 + 0.3 * across ** 0.8)[..., None]
    # depth: darker and cooler further down
    tt = t[:, None, None]
    col = col * (1 - 0.32 * tt ** 0.9) + np.array([70, 80, 105], np.float32) * (0.22 * tt)
    # ambient occlusion under the lip, shade on the left edge, rim light on the right edge
    col = col * (1 - 0.55 * np.exp(-yy / (12 * S)))[..., None]
    dl = xx - xl[:, None]
    dr = xr[:, None] - xx
    col = col * (1 - 0.32 * np.exp(-dl / (9 * S)))[..., None]
    col = col + np.array([255, 214, 160], np.float32) * (0.32 * np.exp(-dr / (2.2 * S)) * (1 - tt[..., 0] * 1.2).clip(0, 1))[..., None]
    im = Image.fromarray(np.dstack([np.clip(col, 0, 255), alpha[..., None] * 255]).astype(np.uint8), "RGBA")
    d = ImageDraw.Draw(im)
    # cracks: short jagged dark lines inside bands
    for _ in range(int(W * H / (11000 * S * S))):
        x0, y0 = rng.uniform(M + 4 * S, W - M - 4 * S), rng.uniform(20 * S, H * 0.7)
        pts = [(x0, y0)]
        for _ in range(rng.integers(2, 5)):
            x0 += rng.uniform(-4, 4) * S
            y0 += rng.uniform(4, 10) * S
            pts.append((x0, y0))
        d.line(pts, fill=(58, 32, 22, 210), width=int(1.5 * S))
    if green:
        # moss: patches hanging under the lip, thinning downward
        for _ in range(int(wu / 9)):
            x0 = rng.uniform(M, W - M)
            ln = rng.uniform(6, 26) * S
            w = rng.uniform(5, 14) * S
            d.ellipse([x0 - w, -w * 0.4, x0 + w, ln], fill=(92, 142, 62, 210))
            d.ellipse([x0 - w * 0.6, ln * 0.3, x0 + w * 0.6, ln * 1.25], fill=(78, 126, 54, 190))
        # vines with small leaves
        for _ in range(max(1, int(wu / 60))):
            x0 = rng.uniform(M + 8 * S, W - M - 8 * S)
            ln, ph = rng.uniform(40, 150) * S, rng.uniform(0, 6)
            pts = [(x0 + math.sin(ph + k * 0.25) * 4 * S, k * 4 * S) for k in range(int(ln / (4 * S)))]
            d.line(pts, fill=(46, 92, 48, 255), width=max(2, int(1.5 * S)), joint="curve")
            for k, (px, py) in enumerate(pts[2::3]):
                sd = 1 if k % 2 else -1
                d.ellipse([px + sd * 2 * S - 3 * S, py - 2 * S, px + sd * 2 * S + 3 * S, py + 2 * S], fill=(70, 130, 60, 255))
    a = np.asarray(im).astype(np.float32)
    fade = np.clip((1 - t) / 0.38, 0, 1) ** 1.3
    a[..., 3] *= fade[:, None]
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def textures() -> dict:
    sizes = {}
    # Cliff columns (2 px per unit): two ledge variants, the wide start ledge, the summit, a stair step.
    for name, wu, seed, cols, green in (("cliff-a", 170, 101, CLIFF_SANDSTONE, True), ("cliff-b", 170, 102, CLIFF_SANDSTONE, True),
                                        ("cliff-wide", 440, 103, CLIFF_SANDSTONE, True), ("cliff-summit", 330, 104, CLIFF_SANDSTONE, True),
                                        ("cliff-step", 36, 105, CLIFF_STONE, False)):
        sizes[name + ".webp"] = save_webp(cliff(wu, seed, cols, margin=14 if wu > 60 else 6, green=green), name + ".webp", quality=84, method=6)
    # Waterfall: bright streaks with foam edges, seamless top to bottom (64 x 256, 2 px per unit).
    rng = np.random.default_rng(5)
    w, h = 64, 256
    yy = np.arange(h)[:, None] / h * 2 * math.pi
    xx = np.arange(w)[None, :]
    v = np.zeros((h, w), np.float32)
    for k in range(16):
        fx, ph, f = rng.uniform(4, w - 4), rng.uniform(0, 6.3), int(rng.integers(1, 4))
        band = np.exp(-((xx - fx) ** 2) / (2 * rng.uniform(0.8, 2.5) ** 2))
        v += band * np.clip(0.4 + 0.8 * np.sin(f * yy + ph), 0, 1)
    v = np.clip(v / 1.6, 0, 1)
    edge = np.clip(np.minimum(xx, w - 1 - xx) / 6, 0, 1)
    rim = np.exp(-np.minimum(xx, w - 1 - xx) / 3.0)
    body = 0.55 + 0.45 * v
    col = np.dstack([150 + 105 * body + 40 * rim, 200 + 55 * body, 235 + 20 * body, (130 + 125 * np.maximum(v, rim * 0.9)) * edge])
    sizes["waterfall.webp"] = save_webp(Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), "RGBA"), "waterfall.webp")
    # Foreground: a low band of grass blades and leaves, pre-blurred (no blur filter at run time), 640 x 220.
    fg = Image.new("RGBA", (640, 220))
    d = ImageDraw.Draw(fg)
    rng = np.random.default_rng(9)
    for k in range(70):
        x0 = rng.uniform(0, 640)
        hgt = rng.uniform(60, 200) * (1.0 if (x0 < 200 or x0 > 470) else 0.45)
        lean = rng.uniform(-40, 40)
        w2 = rng.uniform(8, 18)
        col2 = (int(rng.uniform(18, 34)), int(rng.uniform(44, 70)), int(rng.uniform(34, 50)), 255)
        d.polygon([(x0 - w2, 220), (x0 + w2, 220), (x0 + lean, 220 - hgt)], fill=col2)
    for k in range(10):
        cx, cy, r = rng.uniform(0, 640), rng.uniform(150, 230), rng.uniform(26, 48)
        if 220 < cx < 440:
            continue
        d.ellipse([cx - r * 1.6, cy - r * 0.7, cx + r * 1.6, cy + r * 0.7], fill=(22, 52, 40, 255))
    fg = fg.filter(ImageFilter.GaussianBlur(3.2))
    sizes["fg.webp"] = save_webp(fg, "fg.webp")
    # Foreground bushes in the world (closer than the path, so blurred): dark leafy clumps, 520 x 260.
    fb = Image.new("RGBA", (520, 260))
    for k, (n, x0, sc) in enumerate((("bush1", 0, 1.3), ("bush3", 150, 1.6), ("bush2", 300, 1.2), ("bush4", 380, 1.0))):
        b = img(BGE / f"{n}.png")
        b = b.resize((int(b.width * sc), int(b.height * sc)), Image.LANCZOS)
        a2 = np.asarray(b)[..., 3]
        sil = np.dstack([np.full_like(a2, 34), np.full_like(a2, 70 + k * 6), np.full_like(a2, 48), a2]).astype(np.uint8)
        fb.alpha_composite(Image.fromarray(sil, "RGBA"), (x0, 260 - b.height))
    fb = fb.filter(ImageFilter.GaussianBlur(4))
    sizes["fgbush.webp"] = save_webp(fb, "fgbush.webp")
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
    out.update(props2())
    return out


def props2() -> dict:
    """Hand-made props drawn at 2 px per world unit: the checkpoint post and its pennant (furled and three waving
    frames), the lift's gondola and pulley, the summit cairn, a soft band for fog, the spill of a waterfall."""
    out = {}
    # wooden post, 6 x 80 units
    im = Image.new("RGBA", (16, 164))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([3, 6, 12, 163], 3, fill=(112, 70, 42, 255))
    d.rectangle([5, 8, 7, 160], fill=(150, 100, 64, 255))
    d.ellipse([1, 0, 14, 12], fill=(218, 170, 74, 255))
    d.ellipse([4, 2, 9, 7], fill=(250, 220, 130, 255))
    out["ui/pole"] = im
    # pennant: a long triangle with a wave, green with a light stripe (38 x 24 units)
    for k in range(3):
        im = Image.new("RGBA", (80, 52))
        d = ImageDraw.Draw(im)
        top, bot = [], []
        for i in range(41):
            x = i * 2
            amp = 3.2 * (x / 80)
            off = math.sin(x / 13 + k * 2.1) * amp
            half = 22 * (1 - x / 84)
            top.append((x, 26 - half + off))
            bot.append((x, 26 + half + off))
        d.polygon(top + bot[::-1], fill=(54, 168, 98, 255))
        d.line([(p[0], (p[1] + q[1]) / 2 - 3) for p, q in zip(top, bot)][:34], fill=(132, 214, 160, 255), width=3)
        d.line(top, fill=(36, 120, 70, 255), width=1)
        out[f"ui/pen{k}"] = im
    for k in range(3):   # the summit pennant, gold
        im = Image.new("RGBA", (80, 52))
        d = ImageDraw.Draw(im)
        top, bot = [], []
        for i in range(41):
            x = i * 2
            off = math.sin(x / 13 + k * 2.1) * 3.2 * (x / 80)
            half = 22 * (1 - x / 84)
            top.append((x, 26 - half + off))
            bot.append((x, 26 + half + off))
        d.polygon(top + bot[::-1], fill=(242, 184, 40, 255))
        d.line([(p[0], (p[1] + q[1]) / 2 - 3) for p, q in zip(top, bot)][:34], fill=(255, 230, 140, 255), width=3)
        d.line(top, fill=(196, 132, 20, 255), width=1)
        out[f"ui/gold{k}"] = im
    # rope for the lift: twisted strands, tiles vertically (4 x 16 units)
    im = Image.new("RGBA", (8, 32))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 7, 31], fill=(104, 72, 44, 255))
    for y0 in range(-8, 40, 8):
        d.line([(0, y0), (7, y0 + 6)], fill=(170, 128, 82, 255), width=2)
        d.line([(0, y0 + 3), (7, y0 + 9)], fill=(76, 50, 30, 255), width=1)
    d.line([(0, 0), (0, 31)], fill=(60, 40, 24, 255), width=1)
    out["ui/rope"] = im
    im = Image.new("RGBA", (22, 50))
    d = ImageDraw.Draw(im)
    d.polygon([(2, 2), (14, 4), (12, 48), (6, 44)], fill=(54, 168, 98, 255))
    d.line([(6, 6), (9, 40)], fill=(132, 214, 160, 255), width=2)
    out["ui/penDown"] = im
    # gondola: a plank deck with posts and a rope rail, 76 x 44 units
    im = Image.new("RGBA", (152, 88))
    d = ImageDraw.Draw(im)
    wood, dark, light = (150, 98, 58, 255), (96, 60, 36, 255), (190, 132, 82, 255)
    for x in (6, 138):
        d.rounded_rectangle([x, 4, x + 8, 70], 3, fill=dark)
        d.rectangle([x + 2, 6, x + 4, 66], fill=wood)
        d.ellipse([x - 2, 0, x + 10, 12], fill=(120, 120, 128, 255))
        d.ellipse([x + 1, 3, x + 7, 9], fill=(60, 60, 66, 255))
    d.line([(14, 30), (76, 36), (138, 30)], fill=(196, 160, 104, 255), width=4, joint="curve")
    d.rounded_rectangle([0, 62, 151, 86], 6, fill=dark)
    for i in range(6):
        x0 = 4 + i * 24.3
        d.rounded_rectangle([x0, 64, x0 + 22, 80], 3, fill=wood)
        d.line([(x0 + 3, 67), (x0 + 19, 67)], fill=light, width=2)
    d.rectangle([0, 80, 151, 86], fill=(80, 50, 30, 255))
    out["ui/gondola"] = im
    # pulley wheel, 28 x 28 units
    im = Image.new("RGBA", (56, 56))
    d = ImageDraw.Draw(im)
    d.ellipse([1, 1, 54, 54], fill=(70, 66, 72, 255))
    d.ellipse([7, 7, 48, 48], fill=(128, 122, 130, 255))
    for k in range(6):
        ang = k * math.pi / 3
        d.line([(28, 28), (28 + math.cos(ang) * 20, 28 + math.sin(ang) * 20)], fill=(70, 66, 72, 255), width=4)
    d.ellipse([21, 21, 35, 35], fill=(196, 160, 90, 255))
    out["ui/pulley"] = im
    # summit cairn: rounded stones, lit from the upper right, with contact shadows (120 x 96 units)
    W, H = 240, 192
    im = Image.new("RGBA", (W, H))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    acc = np.zeros((H, W, 4), np.float32)
    stones = [(58, 160, 54, 32, (196, 184, 166)), (128, 166, 62, 28, (184, 174, 160)), (190, 162, 46, 30, (204, 192, 172)),
              (92, 118, 50, 28, (208, 196, 178)), (156, 116, 46, 28, (190, 180, 166)), (124, 76, 40, 24, (206, 196, 182)), (126, 42, 26, 18, (216, 206, 190))]
    for cx, cy, rx, ry, c in stones:
        dx, dy = (xx - cx) / rx, (yy - cy) / ry
        r2 = dx * dx + dy * dy
        inside = np.clip((1 - r2) * 18, 0, 1)
        light = np.clip(0.82 + 0.32 * (dx * 0.55 - dy * 0.75) - 0.18 * r2, 0.5, 1.15)
        colr = np.array(c, np.float32)[None, None, :] * light[..., None]
        edge = np.clip((r2 - 0.82) / 0.18, 0, 1)
        colr = colr * (1 - 0.35 * edge[..., None])
        m = inside[..., None]
        acc[..., :3] = acc[..., :3] * (1 - m) + colr * m
        acc[..., 3] = np.maximum(acc[..., 3], inside)
    out["ui/cairn"] = Image.fromarray(np.dstack([np.clip(acc[..., :3], 0, 255), acc[..., 3:] * 255]).astype(np.uint8), "RGBA")
    # soft band for fog layers (alpha 0 -> 1 -> 0)
    v = np.sin(np.linspace(0, math.pi, 128)) ** 1.5
    out["fx/band"] = Image.fromarray(np.dstack([np.full((128, 8), 255)] * 3 + [np.repeat(v[:, None], 8, 1) * 255]).astype(np.uint8), "RGBA")
    # waterfall spill over a lip: a white foamy bulge
    im = Image.new("RGBA", (72, 40))
    d = ImageDraw.Draw(im)
    for k in range(9):
        x = 8 + k * 7
        d.ellipse([x - 9, 8 + (k % 3) * 3, x + 9, 30 + (k % 2) * 4], fill=(236, 248, 255, 230))
    out["fx/spill"] = im.filter(ImageFilter.GaussianBlur(1.2))
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


def strip_sheet() -> tuple[dict, int]:
    """The few small pictures the Strip mode draws on its Canvas 2D strip (hero poses, coins, the summit flag), in one
    small sheet so the strip never has to draw from (and upload) the 2048 px atlas."""
    items = [("idle", img(TOON / "Poses HD" / "character_femaleAdventurer_idle.png").resize((72, 96), Image.LANCZOS)),
             ("jump", img(TOON / "Poses HD" / "character_femaleAdventurer_jump.png").resize((72, 96), Image.LANCZOS)),
             ("cheer", img(TOON / "Poses HD" / "character_femaleAdventurer_cheer0.png").resize((72, 96), Image.LANCZOS)),
             ("coinGold", img(RED / "Items" / "coinGold.png").resize((40, 40), Image.LANCZOS)),
             ("coinSilver", img(RED / "Items" / "coinSilver.png").resize((40, 40), Image.LANCZOS)),
             ("flag", img(RED / "Items" / "flagYellow1.png").resize((48, 48), Image.LANCZOS))]
    W = sum(im.width + 2 for _, im in items)
    sheet, frames, x = Image.new("RGBA", (W, 96)), {}, 0
    for n, im in items:
        sheet.paste(im, (x, 0))
        frames[n] = [x, 0, im.width, im.height]
        x += im.width + 2
    return {"image": "strip.webp", "frames": frames}, save_webp(sheet, "strip.webp")


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
    kitpal = {}
    sizes.update(build_layers(kitpal))
    sizes.update(textures())
    strip, ssize = strip_sheet()
    sizes["strip.webp"] = ssize
    snd = sounds()
    dims = {k: list(Image.open(OUT / (k + ".webp")).size) for k in ("waterfall", "fg", "fgbush", "cliff-a", "cliff-b", "cliff-wide", "cliff-summit", "cliff-step")}
    kit = {"atlas": atlas, "rig": RIG, "palette": kitpal, "strip": strip, "dims": dims,
           "layers": {k: {"day": f"{k}-day.webp", "night": f"{k}-night.webp"} for k in ("sky", "far", "peak", "cloudsea", "mid", "near")},
           "textures": {k: k + ".webp" for k in ("waterfall", "fg", "fgbush", "cliff-a", "cliff-b", "cliff-wide", "cliff-summit", "cliff-step")},
           "sizes": sizes, "sounds": snd}
    (OUT / "kit.json").write_text(json.dumps(kit, separators=(",", ":")))
    art = sum(sizes.values())
    print(f"[build-hd] {OUT} art {art / 1024:.0f} KB (atlas {asize / 1024:.0f} KB {atlas['size']}), sound {sum(snd.values()) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
