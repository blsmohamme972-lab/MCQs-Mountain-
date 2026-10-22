"""Laptop screen image sequence: python3 screens.py <font.ttf> <outdir>"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

FONT, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
W, H = 640, 400
TYPED = "B. Median nerve. 100% sure!"
TYPE_START, TYPE_END, SUBMIT, WRONG = 20, 130, 150, 172


def font(size, var="Bold"):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(var)
    return f


F_SM, F_MD, F_BIG, F_HUGE = font(20, "SemiBold"), font(26), font(34, "ExtraBold"), font(96, "Black")


def quiz(f):
    im = Image.new("RGB", (W, H), (246, 248, 252))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 46], fill=(40, 90, 200))
    d.text((18, 11), "Anatomy quiz  ·  Q 17/20", font=F_SM, fill="white")
    d.text((24, 66), "Wrist drop is caused by injury to", font=F_MD, fill=(25, 25, 35))
    d.text((24, 98), "which nerve?", font=F_MD, fill=(25, 25, 35))
    for i, opt in enumerate(["A. Ulnar", "B. Median", "C. Radial", "D. Axillary"]):
        y = 140 + i * 42
        sel = i == 1 and f >= TYPE_END
        d.rounded_rectangle([24, y, 300, y + 34], 8, fill=(255, 225, 120) if sel else (228, 233, 243))
        d.text((38, y + 5), opt, font=F_SM, fill=(25, 25, 35))
    d.text((330, 140), "Your answer:", font=F_SM, fill=(90, 90, 110))
    d.rounded_rectangle([326, 168, 620, 300], 8, outline=(40, 90, 200), width=3, fill="white")
    n = max(0, min(len(TYPED), int((f - TYPE_START) / (TYPE_END - TYPE_START) * len(TYPED))))
    text = TYPED[:n] + ("|" if (f // 8) % 2 == 0 and f < SUBMIT else "")
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        if d.textlength(cur + " " + w, font=F_SM) > 270 and cur:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    lines.append(cur)
    for i, ln in enumerate(lines):
        d.text((338, 178 + i * 28), ln, font=F_SM, fill=(25, 25, 35))
    press = SUBMIT <= f < SUBMIT + 6
    col = (20, 150, 70) if not press else (10, 100, 45)
    if f >= SUBMIT + 6:
        col = (120, 130, 140)
    d.rounded_rectangle([420, 320, 620, 372], 12, fill=col)
    d.text((452, 330), "SUBMIT" if f < SUBMIT + 6 else "Checking...", font=F_MD if f < SUBMIT + 6 else F_SM, fill="white")
    return im


def wrong(f):
    k = f - WRONG
    flash = k < 12 and (k // 3) % 2 == 0
    im = Image.new("RGB", (W, H), (255, 70, 70) if flash else (215, 30, 40))
    d = ImageDraw.Draw(im)
    cx, cy, r = W // 2, 120, 62
    d.line([cx - r, cy - r, cx + r, cy + r], fill="white", width=22)
    d.line([cx - r, cy + r, cx + r, cy - r], fill="white", width=22)
    tw = d.textlength("WRONG", font=F_HUGE)
    d.text(((W - tw) / 2, 195), "WRONG", font=F_HUGE, fill="white")
    msg = "Correct answer: C. Radial nerve"
    d.text(((W - d.textlength(msg, font=F_MD)) / 2, 330), msg, font=F_MD, fill=(255, 235, 235))
    return im


po = Image.new("RGB", (400, 560), (250, 120, 60))
pd = ImageDraw.Draw(po)
for i, (t, sz) in enumerate([("KEEP", 70), ("CALM", 70), ("AND", 40), ("STUDY", 70), ("ANATOMY", 58)]):
    ft = font(sz, "Black")
    pd.text(((400 - pd.textlength(t, font=ft)) / 2, 60 + i * 92), t, font=ft, fill="white")
po.save(os.path.join(OUT, "poster.png"))

for f in range(1, 301):
    (quiz(f) if f < WRONG else wrong(f)).save(os.path.join(OUT, f"screen_{f:04d}.png"))
