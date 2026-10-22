"""Lincoln portrait card: clean-shaven 1860 (Hesler) and the same face with the 1861 beard grown in.
python3 lincoln_portrait.py <photos_dir> <out_dir> [test]
Writes portrait_####.png for timeline frames 1..300 (doodle draw-on, beard growth) and beard_mask.png."""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

SRC, OUT = sys.argv[1], sys.argv[2]
TEST = len(sys.argv) > 3
os.makedirs(OUT, exist_ok=True)

# feature points (pixels in the 1280-px originals): left eye, right eye, mouth centre
HES_PTS = np.array([(602, 620), (705, 615), (670, 740)], float)
BRD_PTS = np.array([(640, 405), (760, 408), (705, 555)], float)
# beard outline in the 1861 photo (sideburn, jaw, chin, other jaw)
BRD_POLY = [(548, 400), (556, 470), (580, 540), (615, 600), (660, 640), (712, 652), (760, 628), (790, 575),
            (800, 505), (796, 430)]
CROP = (330, 300, 1010, 1180)          # card crop in Hesler pixels (portrait 680x880)
SEPIA_DARK, SEPIA_LIGHT = (38, 26, 16), (236, 220, 188)
DOODLE = (149, 166)                    # chalk outline draws on (shot 4)
GROW = (237, 259)                      # beard grows (shot 6)


def affine(src, dst):
    """3-point affine mapping dst->src coordinates (for PIL's inverse transform)."""
    a = np.hstack([dst, np.ones((3, 1))])
    cx = np.linalg.solve(a, src[:, 0])
    cy = np.linalg.solve(a, src[:, 1])
    return tuple(cx) + tuple(cy)


def tone(im):
    g = ImageOps.autocontrast(im.convert("L"), cutoff=1)
    return ImageOps.colorize(g, SEPIA_DARK, SEPIA_LIGHT)


hes = Image.open(os.path.join(SRC, "hesler_1860.jpg")).convert("RGB")
brd = Image.open(os.path.join(SRC, "beard_1861.jpg")).convert("RGB")
# warp the 1861 photo onto the 1860 face
warp = brd.transform(hes.size, Image.AFFINE, affine(BRD_PTS, HES_PTS), resample=Image.BICUBIC)
# beard mask: dark pixels inside the beard outline, softened
poly_mask = Image.new("L", brd.size, 0)
ImageDraw.Draw(poly_mask).polygon(BRD_POLY, fill=255)
lum = np.asarray(brd.convert("L"), float)
dark = np.clip((175 - lum) / 60, 0, 1) * 255
bm = Image.fromarray(dark.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
bm = ImageChops.multiply(bm, poly_mask.filter(ImageFilter.GaussianBlur(10)))
bm = bm.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3))
beard_mask = bm.transform(hes.size, Image.AFFINE, affine(BRD_PTS, HES_PTS), resample=Image.BICUBIC)
poly_h = [tuple(np.linalg.solve(np.array([[*affine(BRD_PTS, HES_PTS)[:2]], [*affine(BRD_PTS, HES_PTS)[3:5]]]),
                                np.array(p) - np.array([affine(BRD_PTS, HES_PTS)[2], affine(BRD_PTS, HES_PTS)[5]])))
          for p in BRD_POLY]

# match the warped beard photo's tone to the 1860 print in the face area
h_t, w_t = tone(hes), tone(warp)
ha = np.asarray(hes.convert("L"), float)
wa = np.asarray(warp.convert("L"), float)
box = (slice(560, 860), slice(520, 820))
k = ha[box].std() / max(wa[box].std(), 1)
wa2 = np.clip((wa - wa[box].mean()) * k + ha[box].mean() - 35, 0, 255)
w_t = ImageOps.colorize(Image.fromarray(wa2.astype(np.uint8)), SEPIA_DARK, SEPIA_LIGHT)
h_t = ImageOps.colorize(hes.convert("L"), SEPIA_DARK, SEPIA_LIGHT)


def card(img):
    c = img.crop(CROP)
    # a soft printed vignette and an oval mat like an 1860 carte-de-visite
    w, h = c.size
    y, x = np.mgrid[0:h, 0:w]
    r = np.sqrt(((x - w / 2) / (w * 0.47)) ** 2 + ((y - h * 0.47) / (h * 0.47)) ** 2)
    v = np.clip(1.15 - 0.55 * r ** 2.2, 0.35, 1)[..., None]
    a = np.asarray(c, float) * v
    paper = np.array(SEPIA_LIGHT, float) * 0.97
    mat = np.clip((r - 0.98) * 25, 0, 1)[..., None]
    a = a * (1 - mat) + paper * mat
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


grow_order = np.zeros(hes.size[::-1], float)
yy = np.mgrid[0:hes.size[1], 0:hes.size[0]][0]
top = min(p[1] for p in poly_h)
bot = max(p[1] for p in poly_h)
rng = np.random.default_rng(3)
noise = np.asarray(Image.fromarray((rng.random((hes.size[1] // 8, hes.size[0] // 8)) * 255).astype(np.uint8))
                   .resize(hes.size, Image.BICUBIC), float) / 255
grow_order = (yy - top) / (bot - top) + (noise - 0.5) * 0.12   # 0 at sideburns -> 1 at beard tip
bmask = np.asarray(beard_mask, float) / 255
bmask *= np.clip((yy - 672) / 40, 0, 1)                # keep the beard below the cheekbones
xx = np.mgrid[0:hes.size[1], 0:hes.size[0]][1]
lip = np.clip((np.abs(xx - 668) - 55) / 20, 0, 1) + np.clip((yy - 760) / 14, 0, 1)
bmask *= np.clip(lip, 0, 1)                             # Lincoln never wore a moustache: keep the lips clean


fine = np.asarray(Image.fromarray((rng.random((hes.size[1] // 2, hes.size[0] // 2)) * 255).astype(np.uint8))
                  .resize(hes.size, Image.BILINEAR), float) / 255


def catmull(pts, n=24):
    """Smooth closed-ends Catmull-Rom through the outline points."""
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = (np.array(q, float) for q in p[i - 1:i + 3])
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(np.array(pts[-1], float))
    return out


SPLINE = catmull([(x - CROP[0], y - CROP[1]) for x, y in poly_h[2:-2]])   # jaw line only, both ends on the face
CUT6 = 232                                     # first frame of shot 6 (whip-in)


def chalk(c, amount, alpha):
    """Draw the first `amount` (0..1) of the beard outline as a chalk stroke with rough edges."""
    if amount <= 0 or alpha <= 0:
        return c
    seg = np.cumsum([0] + [np.linalg.norm(b - a) for a, b in zip(SPLINE, SPLINE[1:])])
    L = seg[-1] * amount
    pts = [tuple(p) for p, d in zip(SPLINE, seg) if d <= L]
    if len(pts) < 2:
        return c
    m = Image.new("L", c.size, 0)
    d = ImageDraw.Draw(m)
    jr = np.random.default_rng(int(amount * 50))         # a little line boil
    pts = [(x + jr.normal(0, 0.8), y + jr.normal(0, 0.8)) for x, y in pts]
    d.line(pts, fill=255, width=8, joint="curve")
    r = 4
    for q in (pts[0], pts[-1]):
        d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=255)
    tex = np.asarray(m, float) / 255
    grain = np.random.default_rng(7).random(tex.shape)
    tex = tex * np.clip(0.35 + 0.75 * grain, 0, 1) * alpha * 0.9            # dry chalk: broken grain
    m = Image.fromarray((tex * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    return Image.composite(Image.new("RGB", c.size, (250, 248, 238)), c, m)


def frame_image(f):
    img = h_t.copy()
    if f >= GROW[0]:
        t = min(1.0, (f - GROW[0]) / (GROW[1] - GROW[0]))
        t = t * t * (3 - 2 * t)
        # stubble appears everywhere first, then fills in and lengthens toward the beard tip
        dens = np.clip((t * 1.3 - fine * 0.22 - grow_order * 0.3) / 0.35, 0, 1)   # soft fill, no speckle
        m = Image.fromarray((bmask * dens * 255).astype(np.uint8))
        img = Image.composite(w_t, img, m)
    c = card(img)
    if DOODLE[0] <= f < CUT6:
        t = min(1.0, (f - DOODLE[0]) / (DOODLE[1] - DOODLE[0]))
        c = chalk(c, 1 - (1 - t) ** 2, 1.0)
    elif f >= CUT6:                                        # the doodle becomes the beard
        fade = 1.0 - np.clip((f - GROW[0] - 2) / 12, 0, 1)
        c = chalk(c, 1.0, fade)
    return c


if TEST:
    for f in (160, 236, 242, 246, 250, 258):
        frame_image(f).save(os.path.join(OUT, f"test_{f}.png"))
else:
    last = None
    for f in range(1, 301):
        key = f if (DOODLE[0] <= f <= DOODLE[1] or GROW[0] <= f <= GROW[1]) else None
        if key is None and last is not None and not (DOODLE[1] < f < GROW[0] and last == "doodle"):
            pass
        frame_image(f).save(os.path.join(OUT, f"portrait_{f:04d}.png"))
    json.dump({"crop": CROP, "poly": poly_h}, open(os.path.join(OUT, "portrait.json"), "w"))
