"""Paper textures for the Lincoln clip.
python3 lincoln_letters.py <font_dir> <out_dir>
- girl/girl_####.png  her letter; 'Lincoln' is written stroke-front by stroke-front during WRITE (shot 2)
- nib.json            nib tip in paper UV per frame (u right, v up), for the pen
- reply.png           Lincoln's reply of 19 Oct 1860 (his real words)
- envelope.png        addressed to Grace
- bulb.png, sparkle.png  2D pop graphics for post"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FD, OUT = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(OUT, "girl"), exist_ok=True)
W, H = 1536, 2016                     # 0.16 x 0.21 m sheet
WRITE = (76, 118)                     # frames in which 'Lincoln' is written
rng = np.random.default_rng(5)


def font(name, size, var=None):
    f = ImageFont.truetype(os.path.join(FD, name), size)
    if var:
        f.set_variation_by_name(var)
    return f


def paper(w, h, base=(236, 226, 203)):
    a = np.ones((h, w, 3)) * np.array(base, float)
    n = rng.normal(0, 1, (h // 4, w // 4))
    n = np.asarray(Image.fromarray(((n - n.min()) / np.ptp(n) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), float)
    a += (n[..., None] - 128) * 0.06
    y, x = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([x, y, w - x, h - y]) / (0.08 * w)
    a *= (0.86 + 0.14 * np.clip(edge, 0, 1))[..., None]          # foxed edges
    for _ in range(14):                                         # soft round age spots
        cx, cy, r = rng.integers(0, w), rng.integers(0, h), rng.integers(8, 34)
        a *= (1 - 0.05 * np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2.0 * r * r)))[..., None]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


INK_G = (28, 32, 58)
hand = font("HomemadeApple-Regular.ttf", 120)
hand_s = font("HomemadeApple-Regular.ttf", 74)


def girl_base():
    im = paper(W, H)
    d = ImageDraw.Draw(im)
    d.text((W - 90 - d.textlength("N Y Westfield Chatauque Co", font=hand_s), 120), "N Y Westfield Chatauque Co", font=hand_s, fill=INK_G)
    d.text((W - 90 - d.textlength("Oct 15. 1860", font=hand_s), 250), "Oct 15. 1860", font=hand_s, fill=INK_G)
    d.text((110, 470), "Hon A B", font=hand, fill=INK_G)
    return im, 110 + d.textlength("Hon A B ", font=hand)


base, x0 = girl_base()
word = Image.new("L", (W, H), 0)
ImageDraw.Draw(word).text((x0, 470), "Lincoln", font=hand, fill=255)
wa = np.asarray(word, float) / 255
cols = np.nonzero(wa.max(0) > 0.3)[0]
xa, xb = cols.min(), cols.max()
ink = Image.new("RGB", (W, H), INK_G)
nib, prev_y = {}, None
for f in range(1, 301):
    t = np.clip((f - WRITE[0]) / (WRITE[1] - WRITE[0]), 0, 1)
    xr = xa + (xb - xa) * t
    m = np.clip((xr - np.arange(W)) / 6.0, 0, 1)[None, :] * wa      # soft 6 px writing front
    im = Image.composite(ink, base, Image.fromarray((m * 255).astype(np.uint8)))
    im.save(os.path.join(OUT, "girl", f"girl_{f:04d}.png"))
    # nib follows the ink at the writing front: pick the inked row nearest the previous nib height
    c = int(min(max(xr, xa), xb))
    rows = np.nonzero(wa[:, max(c - 3, 0):c + 3].max(1) > 0.5)[0]
    if len(rows):
        y = rows[np.argmin(abs(rows - prev_y))] if prev_y is not None else rows.mean()
        prev_y = y if prev_y is None else prev_y * 0.5 + y * 0.5
    elif prev_y is None:
        prev_y = 560
    lift = 0.0 if WRITE[0] <= f <= WRITE[1] else 0.004            # metres above paper when not writing
    nib[f] = (float(xr / W), float(1 - prev_y / H), lift)
json.dump(nib, open(os.path.join(OUT, "nib.json"), "w"))

# ---------------------------------------------------------------- Lincoln's reply (real text, 19 Oct 1860)
INK_L = (62, 40, 28)
lf = font("PinyonScript-Regular.ttf", 84)
lf_big = font("PinyonScript-Regular.ttf", 104)
rep = paper(W, H, base=(234, 223, 198))
d = ImageDraw.Draw(rep)
y = 110
d.text((W - 90 - d.textlength("Springfield, Ills. Oct 19. 1860", font=lf), y), "Springfield, Ills. Oct 19. 1860", font=lf, fill=INK_L)
y += 150
for line in ["Miss. Grace Bedell", "My dear little Miss.", "    Your very agreeable letter",
             "of the 15th. is received.", "    I regret the necessity of saying",
             "I have no daughters..."]:
    d.text((110, y), line, font=lf, fill=INK_L)
    y += 108
y += 40
key = ["    As to the whiskers, having", "never worn any, do you not think", "people would call it a piece of",
       "silly affection if I were to", "begin it now?"]
rows = {}
for line in key:
    d.text((100, y), line, font=lf_big, fill=INK_L)
    rows[line.strip()] = y
    y += 132
y += 40
d.text((560, y), "Your very sincere well-wisher", font=lf, fill=INK_L)
d.text((900, y + 120), "A. Lincoln.", font=lf_big, fill=INK_L)
rep = rep.filter(ImageFilter.GaussianBlur(0.6))
rep.save(os.path.join(OUT, "reply.png"))
lay = {"silly_v": 1 - (rows["silly affection if I were to"] + 60) / H, "whiskers_v": 1 - (rows["As to the whiskers, having"] + 60) / H,
       "sign_v": 1 - (y + 180) / H}
json.dump(lay, open(os.path.join(OUT, "reply.json"), "w"))

# ---------------------------------------------------------------- envelope
ew, eh = 1400, 820
env = paper(ew, eh, base=(226, 212, 182))
d = ImageDraw.Draw(env)
ef = font("PinyonScript-Regular.ttf", 88)
for i, line in enumerate(["Miss. Grace Bedell", "Westfield", "Chautauqua Co.  New York"]):
    d.text((300 + i * 60, 330 + i * 120), line, font=ef, fill=INK_L)
d.ellipse([90, 90, 370, 370], outline=(70, 50, 60), width=8)
d.text((140, 205), "SPRINGFIELD", font=font("EBGaramond.ttf", 34, "Bold"), fill=(70, 50, 60))
d.rectangle([1150, 70, 1310, 270], fill=(150, 60, 45))
d.text((1205, 110), "3", font=font("EBGaramond.ttf", 110, "Bold"), fill=(235, 215, 190))
env.save(os.path.join(OUT, "envelope.png"))

# ---------------------------------------------------------------- pop graphics
S = 512
b = Image.new("RGBA", (S, S), (0, 0, 0, 0))
g = Image.new("L", (S, S), 0)
ImageDraw.Draw(g).ellipse([96, 40, 416, 360], fill=255)
glow = Image.new("RGBA", (S, S), (255, 214, 90, 0))
glow.putalpha(g.filter(ImageFilter.GaussianBlur(40)).point(lambda v: int(v * 0.8)))
b = Image.alpha_composite(b, glow)
d = ImageDraw.Draw(b)
d.ellipse([136, 80, 376, 320], fill=(255, 236, 140, 255), outline=(255, 250, 220, 255), width=6)
d.polygon([(196, 290), (316, 290), (296, 370), (216, 370)], fill=(255, 236, 140, 255))
for i in range(4):
    d.rounded_rectangle([206, 372 + i * 26, 306, 392 + i * 26], 8, fill=(150, 150, 160, 255) if i % 2 == 0 else (110, 110, 120, 255))
d.ellipse([180, 120, 240, 180], fill=(255, 255, 245, 255))
d.line([(226, 290), (226, 230), (246, 205), (266, 230), (286, 205), (286, 290)], fill=(230, 150, 40, 255), width=7, joint="curve")
b.save(os.path.join(OUT, "bulb.png"))
sp = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
d = ImageDraw.Draw(sp)
for ang in (0, 70, 140, 210, 280):
    a = np.radians(ang - 90)
    d.line([128 + 50 * np.cos(a), 128 + 50 * np.sin(a), 128 + 115 * np.cos(a), 128 + 115 * np.sin(a)], fill=(255, 250, 235, 255), width=14)
sp.save(os.path.join(OUT, "sparkle.png"))
print("ok", len(nib), "nib frames; write cols", xa, xb)
