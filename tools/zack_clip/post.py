"""Captions (Zack D Films style), vignette and a simple sound bed.
python3 post.py <font.ttf> <frames_dir> <out_dir>"""
import os
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT, FR, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
FPS, N = 30, 300
WHITE, YELLOW, RED = (255, 255, 255), (255, 214, 0), (255, 40, 40)
CAPS = [  # (start, end, text, color, size factor)
    (6, 40, "SHE WAS", WHITE, 1.0),
    (41, 75, "100% SURE", YELLOW, 1.15),
    (76, 110, "ABOUT HER", WHITE, 1.0),
    (111, 140, "ANSWER...", WHITE, 1.0),
    (141, 171, "SO SHE HIT SUBMIT", WHITE, 0.85),
    (172, 200, "WRONG!", RED, 1.5, 0.84),
    (201, 245, "IT WAS THE", WHITE, 1.0, 0.84),
    (246, 300, "RADIAL NERVE", YELLOW, 1.1, 0.82),
]


def font(px):
    f = ImageFont.truetype(FONT, px)
    f.set_variation_by_name("Black")
    return f


def pop(k):
    """scale over the first frames of a caption: 0.55 -> 1.12 -> 1.0"""
    if k >= 6:
        return 1.0
    return [0.55, 0.85, 1.08, 1.12, 1.06, 1.02][k]


ONLY = [int(x) for x in sys.argv[4].split(",")] if len(sys.argv) > 4 else None
vign = None
for f in (ONLY or range(1, N + 1)):
    im = Image.open(os.path.join(FR, f"f_{f:04d}.png")).convert("RGB")
    W, H = im.size
    if vign is None:
        y, x = np.mgrid[0:H, 0:W]
        r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
        vign = np.clip(1 - 0.35 * np.clip(r - 0.6, 0, None) ** 1.5, 0, 1)[..., None]
    a = (np.asarray(im).astype(np.float32) * vign).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(a)
    for s, e, text, col, sz, *yp in CAPS:
        if s <= f <= e:
            px = int(W * 0.105 * sz * pop(f - s))
            ft = font(px)
            d = ImageDraw.Draw(im)
            lines = [text] if d.textlength(text, font=ft) < W * 0.9 else text.rsplit(" ", 1)
            y0 = int(H * (yp[0] if yp else 0.66)) - len(lines) * px // 2
            for i, ln in enumerate(lines):
                tw = d.textlength(ln, font=ft)
                d.text(((W - tw) / 2, y0 + i * int(px * 1.05)), ln, font=ft, fill=col,
                       stroke_width=max(3, px // 9), stroke_fill=(0, 0, 0))
    im.save(os.path.join(OUT, f"c_{f:04d}.png"))

if ONLY:
    sys.exit(0)
# ------------------------------------------------------------- sound
SR = 44100
audio = np.zeros(int(SR * N / FPS) + SR)
rng = np.random.default_rng(3)


def at(frame):
    return int((frame - 1) / FPS * SR)


def add(sig, frame, gain=1.0):
    i = at(frame)
    audio[i:i + len(sig)] += sig[:len(audio) - i] * gain


def click(ms=25):
    n = int(SR * ms / 1000)
    return rng.normal(size=n) * np.exp(-np.linspace(0, 8, n))


t = 20.0
while t < 130:  # keyboard
    add(click(), int(t), 0.18)
    t += rng.uniform(2.0, 4.5)
add(click(60), 150, 0.5)  # submit
n = int(SR * 0.7)
tt = np.arange(n) / SR
buzz = np.sign(np.sin(2 * np.pi * 110 * tt)) * 0.5 + np.sign(np.sin(2 * np.pi * 116 * tt)) * 0.5
add(buzz * np.minimum(1, (0.7 - tt) * 8) * 0.25, 172)  # wrong buzzer
n = int(SR * 1.2)
tt = np.arange(n) / SR
boom = np.sin(2 * np.pi * (60 - 30 * tt) * tt) * np.exp(-tt * 3) * 0.6
whoosh = np.convolve(rng.normal(size=n), np.ones(40) / 40, "same") * np.exp(-((tt - 0.25) / 0.15) ** 2) * 2.5
add(boom + whoosh, 194)
audio = np.clip(audio, -1, 1)
with wave.open(os.path.join(OUT, "sfx.wav"), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((audio * 32000).astype(np.int16).tobytes())
