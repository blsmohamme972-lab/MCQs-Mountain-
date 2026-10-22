"""Captions (Zack D style), pop graphics, grain, sound bed + narration -> MP4.
python3 post_lincoln.py <frames_dir> <out_dir> <vo.wav> <post.json> <tex_dir> <font_dir> [frames,csv]"""
import json
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FR, OUT, VO, POSTJ, TEX, FD = sys.argv[1:7]
ONLY = [int(x) for x in sys.argv[7].split(",")] if len(sys.argv) > 7 else None
os.makedirs(OUT, exist_ok=True)
FPS, N, VO_START = 30, 300, 0.15
# caption chunks: (narration time of the first word in the tightened VO, text)
CAPS = [(0.00, "In 1860,"), (1.06, "an 11-year-old girl"), (2.34, "wrote to"), (3.08, "Abraham Lincoln."),
        (4.22, "Her advice?"), (4.88, "Grow a beard."), (5.78, "He replied:"), (6.18, "wouldn't people"),
        (6.62, "call it silly?"), (7.74, "Then he grew"), (8.50, "one anyway.")]
BULB_F, SPARK_F = 140, 258
CAP_Y = {"Her advice?": 0.86}                      # keep her smirk clear
post = json.load(open(POSTJ))
bulb = Image.open(os.path.join(TEX, "bulb.png")).convert("RGBA")
spark = Image.open(os.path.join(TEX, "sparkle.png")).convert("RGBA")
POP = [0.55, 0.85, 1.08, 1.12, 1.06, 1.02, 1.0]


def cap_at(f):
    t = (f - 1) / FPS - VO_START
    cur = None
    for i, (s, txt) in enumerate(CAPS):
        if t >= s - 0.03:
            cur = (txt, int(round((t - s) * FPS)))
    return cur


def font(px):
    f = ImageFont.truetype(os.path.join(FD, "Nunito.ttf"), px)
    f.set_variation_by_name("ExtraBold")
    return f


grain_rng = np.random.default_rng(9)
vign = None
for f in (ONLY or range(1, N + 1)):
    im = Image.open(os.path.join(FR, f"f_{f:04d}.png")).convert("RGB")
    W, H = 720, 1280
    im = im.resize((W, H), Image.LANCZOS)
    if vign is None:
        y, x = np.mgrid[0:H, 0:W]
        r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
        vign = np.clip(1 - 0.38 * np.clip(r - 0.55, 0, None) ** 1.6, 0, 1)[..., None]
    a = np.asarray(im, np.float32) * vign + grain_rng.normal(0, 2.4, (H, W, 1))
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8)).convert("RGBA")
    # pop graphics
    if BULB_F <= f and str(f) in post["bulb"]:
        k = f - BULB_F
        s = POP[min(k, len(POP) - 1)] * 0.24 * W
        x, y = post["bulb"][str(f)]
        g = bulb.resize((int(s), int(s)), Image.LANCZOS)
        cx = int(min(max(x * W + 0.06 * W, s / 2 + 20), W - s / 2 - 20))
        cy = int(min(max((1 - y) * H - s * 0.55, 0.15 * H), 0.30 * H))       # above her head, never off-frame
        im.alpha_composite(g, (int(cx - s / 2), int(cy - s / 2)))
    if SPARK_F <= f < SPARK_F + 10 and str(f) in post["sparkle"]:
        k = f - SPARK_F
        s = [0.6, 1.0, 1.1, 1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8][k] * 0.24 * W
        alpha = 1.0 if k < 6 else 1 - (k - 5) / 5
        x, y = post["sparkle"][str(f)]
        g = spark.resize((int(s), int(s)), Image.LANCZOS)
        g.putalpha(g.getchannel("A").point(lambda v: int(v * alpha)))
        im.alpha_composite(g, (int(x * W - s / 2), int((1 - y) * H - s / 2)))
    c = cap_at(f)
    if c:
        txt, k = c
        px = int(W * 0.066 * (1.0 if k >= 3 else [0.86, 0.95, 1.02][k]))
        ft = font(px)
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        tw = d.textlength(txt, font=ft)
        x0, y0 = (W - tw) / 2, H * CAP_Y.get(txt, 0.78) - px * 0.6
        sh = Image.new("L", (W, H), 0)
        ImageDraw.Draw(sh).text((x0 + 2, y0 + 4), txt, font=ft, fill=170, stroke_width=5, stroke_fill=170)
        sh = sh.filter(ImageFilter.GaussianBlur(5))
        im.paste((0, 0, 0), (0, 0), sh)
        d.text((x0, y0), txt, font=ft, fill=(255, 255, 255, 255), stroke_width=3, stroke_fill=(16, 18, 26, 255))
        im.alpha_composite(layer)
    im.convert("RGB").save(os.path.join(OUT, f"c_{f:04d}.png"))
if ONLY:
    sys.exit(0)

# ------------------------------------------------------------------ sound
SR = 48000
T = N / FPS
mix = np.zeros(int(SR * T) + SR)
rng = np.random.default_rng(4)


def at(sec):
    return int(sec * SR)


def add(sig, sec, gain=1.0):
    i = at(sec)
    n = min(len(sig), len(mix) - i)
    mix[i:i + n] += sig[:n] * gain


def lp(x, k):
    return np.convolve(x, np.ones(k) / k, "same")


tt = np.arange(at(T)) / SR
# music bed: soft minor pad (A2 E3 A3 C4) with slow swell, then lift to C major for the payoff
pad = np.zeros_like(tt)
for fq, g in ((110, 0.5), (164.8, 0.35), (220, 0.3), (261.6, 0.22)):
    pad += g * np.sin(2 * np.pi * fq * tt + 0.3 * np.sin(2 * np.pi * 0.2 * tt))
lift = np.clip((tt - 7.7) / 0.6, 0, 1)
for fq, g in ((130.8, 0.4), (196, 0.3), (329.6, 0.22)):
    pad += lift * g * np.sin(2 * np.pi * fq * tt)
env = np.clip(tt / 0.8, 0, 1) * np.clip((T - tt) / 0.4, 0, 1)
pluck = np.zeros_like(tt)
for i, beat in enumerate(np.arange(0.2, T, 0.5)):              # light plucked pulse, 120 bpm
    n = int(SR * 0.35)
    fq = [440, 523.3, 659.3, 523.3][i % 4] * (1.0 if beat < 7.7 else 1.12246)
    k = np.arange(n) / SR
    s = np.sin(2 * np.pi * fq * k) * np.exp(-k * 9)
    i0 = at(beat)
    pluck[i0:i0 + n] += s[:len(pluck) - i0]
mix[:len(tt)] += (pad * 0.05 + pluck * 0.035) * env
# room tone
mix[:len(tt)] += lp(rng.normal(0, 1, len(tt)), 200) * 0.02
# pen scratches while 'Lincoln' is written (frames 76-118) and while she writes in shot 1
for f0, f1, g in ((2, 72, 0.05), (76, 118, 0.12)):
    for fr in range(f0, f1, 2):
        n = int(SR * 0.05)
        s = rng.normal(0, 1, n) * np.hanning(n)
        s = s - lp(s, 6)                                       # scratchy high-pass
        add(s, (fr - 1) / FPS, g * (0.6 + 0.4 * rng.random()))
# chalk squeak on the doodle (149-166)
n = int(SR * 0.55)
k = np.arange(n) / SR
add(np.sin(2 * np.pi * (1800 + 300 * np.sin(2 * np.pi * 7 * k)) * k) * np.hanning(n) * 0.05
    + (rng.normal(0, 1, n) - lp(rng.normal(0, 1, n), 4)) * np.hanning(n) * 0.04, (149 - 1) / FPS)
# bulb 'ting' and sparkle 'ding'
for f, fq, g in ((BULB_F, 1568, 0.16), (SPARK_F, 2093, 0.14)):
    n = int(SR * 0.9)
    k = np.arange(n) / SR
    add((np.sin(2 * np.pi * fq * k) + 0.4 * np.sin(2 * np.pi * fq * 2.01 * k)) * np.exp(-k * 5), (f - 1) / FPS, g)
# paper flop (reply lands, 175)
n = int(SR * 0.25)
add(lp(rng.normal(0, 1, n), 30) * np.exp(-np.arange(n) / SR * 18) * 3.5, (175 - 1) / FPS, 0.5)
# whoosh into the payoff (232)
n = int(SR * 0.45)
k = np.arange(n) / SR
add(lp(rng.normal(0, 1, n), 12) * np.exp(-((k - 0.18) / 0.09) ** 2) * 2.0, (232 - 1) / FPS - 0.12, 0.6)
# narration
with wave.open(VO) as w:
    sr = w.getframerate()
    vo = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    if w.getnchannels() > 1:
        vo = vo.reshape(-1, w.getnchannels()).mean(1)
if sr != SR:
    vo = np.interp(np.arange(int(len(vo) * SR / sr)) / SR, np.arange(len(vo)) / sr, vo)
vo = vo / max(1e-6, np.abs(vo).max()) * 0.85
add(vo, VO_START, 1.0)
mix = mix[:at(T)]
mix = np.tanh(mix * 1.1) * 0.95
with wave.open(os.path.join(OUT, "mix.wav"), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32000).astype(np.int16).tobytes())
mp4 = os.path.join(OUT, "lincoln_beard.mp4")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(OUT, "c_%04d.png"),
                "-i", os.path.join(OUT, "mix.wav"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "slow",
                "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", mp4], check=True)
print("wrote", mp4)
