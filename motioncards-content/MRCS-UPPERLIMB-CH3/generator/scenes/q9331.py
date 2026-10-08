import sys
sys.path.insert(0, __file__.rsplit("/scenes/", 1)[0])
from kit import *
import math

QID = "Q000009331"
TAKEAWAY = ("Carpal tunnel syndrome is compression of the median nerve beneath the transverse carpal "
            "ligament, causing radial 3½ digit paraesthesia and thenar wasting.")

AMB = "#f29a3a"
AMB_D = "#5a2a0c"
AMB_L = "#ffd9a0"


# ------------------------------------------------------------------ small geometry helpers
def f(v):
    s = ("%.1f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def ell(cx, cy, rx, ry, ox=0, oy=0, rot=0):
    """closed ellipse path, optionally re-centred on (ox,oy) so a layer can scale about that pivot."""
    x, y = cx - ox, cy - oy
    if rot:
        c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        ax, ay, bx, by = x - rx * c, y - rx * s, x + rx * c, y + rx * s
    else:
        ax, ay, bx, by = x - rx, y, x + rx, y
    return (f"M {f(ax)} {f(ay)} A {f(rx)} {f(ry)} {f(rot)} 1 0 {f(bx)} {f(by)} "
            f"A {f(rx)} {f(ry)} {f(rot)} 1 0 {f(ax)} {f(ay)} Z")


def cub(p0, p1, p2, p3, u):
    a, b, c, d = (1 - u) ** 3, 3 * (1 - u) ** 2 * u, 3 * (1 - u) * u ** 2, u ** 3
    return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])


def y_on(p0, p1, p2, p3, x):
    best = None
    for i in range(401):
        px, py = cub(p0, p1, p2, p3, i / 400)
        if best is None or abs(px - x) < best[0]:
            best = (abs(px - x), py)
    return best[1]


def taper(b, t, rb, rt):
    """digit: tapered capsule from base b to tip t."""
    dx, dy = t[0] - b[0], t[1] - b[1]
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    p1 = (b[0] + nx * rb, b[1] + ny * rb)
    p2 = (t[0] + nx * rt, t[1] + ny * rt)
    p3 = (t[0] - nx * rt, t[1] - ny * rt)
    p4 = (b[0] - nx * rb, b[1] - ny * rb)
    return (f"M {f(p1[0])} {f(p1[1])} L {f(p2[0])} {f(p2[1])} A {f(rt)} {f(rt)} 0 0 0 {f(p3[0])} {f(p3[1])} "
            f"L {f(p4[0])} {f(p4[1])} A {f(rb)} {f(rb)} 0 0 0 {f(p1[0])} {f(p1[1])} Z")


def half_taper(b, t, rb, rt):
    """radial (n side) half of a digit."""
    dx, dy = t[0] - b[0], t[1] - b[1]
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    p1 = (b[0] + nx * rb, b[1] + ny * rb)
    p2 = (t[0] + nx * rt, t[1] + ny * rt)
    ap = (t[0] + ux * rt, t[1] + uy * rt)
    return (f"M {f(b[0])} {f(b[1])} L {f(p1[0])} {f(p1[1])} L {f(p2[0])} {f(p2[1])} "
            f"A {f(rt)} {f(rt)} 0 0 0 {f(ap[0])} {f(ap[1])} Z")


def crease(b, t, frac, rad, bow=2.0):
    ux, uy = t[0] - b[0], t[1] - b[1]
    L = math.hypot(ux, uy)
    ux, uy = ux / L, uy / L
    nx, ny = -uy, ux
    cx, cy = b[0] + (t[0] - b[0]) * frac, b[1] + (t[1] - b[1]) * frac
    a = (cx + nx * rad, cy + ny * rad)
    c = (cx - nx * rad, cy - ny * rad)
    m = (cx + ux * bow, cy + uy * bow)
    return f"M {f(a[0])} {f(a[1])} Q {f(m[0])} {f(m[1])} {f(c[0])} {f(c[1])}"


def plen(pts):
    return sum(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts)))


def poly_of(d, n=10):
    t = d.replace(",", " ").split()
    pts, i, cur = [], 0, None
    while i < len(t):
        c = t[i]
        if c == "M":
            cur = (float(t[i + 1]), float(t[i + 2])); pts.append(cur); i += 3
        elif c == "L":
            cur = (float(t[i + 1]), float(t[i + 2])); pts.append(cur); i += 3
        elif c == "C":
            p1, p2, p3 = [(float(t[i + 1 + 2 * k]), float(t[i + 2 + 2 * k])) for k in range(3)]
            for j in range(1, n + 1):
                pts.append(cub(cur, p1, p2, p3, j / n))
            cur = p3; i += 7
        else:
            i += 1
    return pts


def inside(pg, x, y):
    c = False
    j = len(pg) - 1
    for i in range(len(pg)):
        if (pg[i][1] > y) != (pg[j][1] > y) and x < (pg[j][0] - pg[i][0]) * (y - pg[i][1]) / (pg[j][1] - pg[i][1]) + pg[i][0]:
            c = not c
        j = i
    return c


def make():
    sc = Scene()
    backdrop(sc)
    sc.extra_defs = (
        '<linearGradient id="tiss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a5b61"/><stop offset="1" stop-color="#1f383f"/></linearGradient>'
        '<linearGradient id="tendG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f1e6"/><stop offset="1" stop-color="#c3b79f"/></linearGradient>'
        '<linearGradient id="ligG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6faf7"/><stop offset="1" stop-color="#a9bcba"/></linearGradient>'
        '<linearGradient id="boneD" gradientUnits="userSpaceOnUse" x1="40" y1="140" x2="360" y2="340"><stop offset="0" stop-color="#eee4c8"/><stop offset=".55" stop-color="#d2c5a0"/><stop offset="1" stop-color="#8a7a58"/></linearGradient>'
        '<radialGradient id="nerveG" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fff3bf"/><stop offset=".55" stop-color="#f3c04c"/><stop offset="1" stop-color="#c58e1e"/></radialGradient>'
        '<radialGradient id="nerveA" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffe3a1"/><stop offset=".5" stop-color="#f08a24"/><stop offset="1" stop-color="#a8481a"/></radialGradient>'
        '<radialGradient id="glowA"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="#ffa347" stop-opacity=".55"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="skinH" gradientUnits="userSpaceOnUse" x1="440" y1="90" x2="590" y2="440"><stop offset="0" stop-color="#e6bda3"/><stop offset="1" stop-color="#b17f69"/></linearGradient>'
        '<radialGradient id="thenG" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#efc9b1"/><stop offset="1" stop-color="#bb856e"/></radialGradient>'
    )

    # =====================================================================================
    # LEFT PANEL : carpal tunnel cross-section (palmar side up, radial side on the right)
    # =====================================================================================
    tissue = ("M 200 100 C 252 100, 300 102, 340 116 C 370 128, 380 160, 380 210 C 378 262, 372 312, 344 346 "
              "C 316 374, 262 380, 200 380 C 138 380, 84 374, 56 346 C 28 312, 22 262, 20 210 "
              "C 20 160, 30 128, 60 116 C 100 102, 150 100, 200 100 Z")
    sc.add(path(tissue, "url(#tiss)", "#5f8a90", 2))

    # carpal tunnel lumen (darker); top edge hides under the ligament, bottom edge under the bones
    lumen = "M 120 194 C 165 126, 285 126, 330 190 L 330 284 L 120 284 Z"
    sc.add(path(lumen, "rgba(12,22,26,.62)", "none", 1))

    # --- tendons (9) : coordinates -> layer authored about the swelling pivot -------------
    PX, PY = 227, 272
    tendons = [
        (153, 250, 18.5, 15, 0), (190, 250, 18.5, 15, 0), (227, 250, 18.5, 15, 0), (264, 250, 18.5, 15, 0),   # FDP x4
        (298, 249, 15, 14, 0),                                                                                  # FPL
        (172, 221, 18, 15, 0), (209, 205, 18.5, 15, 0), (246, 203, 18.5, 15, 0), (283, 219, 18, 15, 0),       # FDS x4
    ]
    tend_d = " ".join(ell(cx, cy, rx, ry, PX, PY, rot) for cx, cy, rx, ry, rot in tendons)
    burs_d = " ".join(ell(cx, cy, rx + 5, ry + 5, PX, PY, rot) for cx, cy, rx, ry, rot in tendons)
    hi = []
    for cx, cy, rx, ry, rot in tendons:
        x, y = cx - PX, cy - PY
        hi.append(f"M {f(x - rx * .62)} {f(y - ry * .1)} Q {f(x - rx * .45)} {f(y - ry * .72)} {f(x + rx * .25)} {f(y - ry * .7)}")
    hi_d = " ".join(hi)

    SW1 = 1.22                 # final swelling scale
    t_sw = [(0, S(1, PX, PY, s=1)), (2900, S(1, PX, PY, s=1)), (3500, S(1, PX, PY, s=1.12)), (4500, S(1, PX, PY, s=SW1))]
    sc.add(path(burs_d, "rgba(255,150,172,.40)", "none", 1), [(0, S(.35, PX, PY, s=1)), (2900, S(.35, PX, PY, s=1)),
                                                              (3500, S(.85, PX, PY, s=1.12)), (4500, S(1, PX, PY, s=SW1))])
    sc.add(path(tend_d, "url(#tendG)", "#7d6a4e", 1.8), t_sw)
    sc.add(path(hi_d, "none", "rgba(255,255,255,.8)", 2.2), t_sw)

    # --- transverse carpal ligament (flexor retinaculum) --------------------------------------
    bt = ((121, 186), (165, 130), (285, 130), (329, 188))      # top edge
    bb = ((329, 204), (285, 148), (165, 148), (121, 202))      # bottom edge
    band = (f"M {bt[0][0]} {bt[0][1]} C {bt[1][0]} {bt[1][1]} {bt[2][0]} {bt[2][1]} {bt[3][0]} {bt[3][1]} "
            f"L {bb[0][0]} {bb[0][1]} C {bb[1][0]} {bb[1][1]} {bb[2][0]} {bb[2][1]} {bb[3][0]} {bb[3][1]} Z")
    fib = []
    for k in (1 / 3, 2 / 3):
        pa = [(bt[i][0] + (bb[3 - i][0] - bt[i][0]) * k, bt[i][1] + (bb[3 - i][1] - bt[i][1]) * k) for i in range(4)]
        fib.append(f"M {f(pa[0][0])} {f(pa[0][1])} C {f(pa[1][0])} {f(pa[1][1])} {f(pa[2][0])} {f(pa[2][1])} {f(pa[3][0])} {f(pa[3][1])}")
    BX, BY = 225, 190      # band authored about its chord mid-point so it can lift & stretch as the tunnel swells

    def rel(d):
        out, isx = [], True
        for tk in d.split():
            try:
                out.append(f(float(tk) - (BX if isx else BY)))
                isx = not isx
            except ValueError:
                out.append(tk)
                isx = True
        return " ".join(out)
    band_r, fib_r = rel(band), rel(" ".join(fib))
    b_kf = [(0, S(1, BX, BY, s=1)), (2900, S(1, BX, BY, s=1)), (3500, S(1, BX, BY - 2, s=1.025)), (4500, S(1, BX, BY - 5, s=1.05))]
    sc.add(path(band_r, "url(#ligG)", "#6f8d8f", 2), b_kf)
    sc.add(path(fib_r, "none", "rgba(110,140,142,.75)", 1.3), b_kf)

    # --- carpal bones: hamate (with hook), capitate, trapezoid, trapezium (with ridge) ---------------
    hamate = ("M 64 280 C 78 262, 100 232, 110 206 C 113 196, 117 188, 122 186 C 127 186, 130 192, 131 202 "
              "C 133 216, 134 230, 134 242 C 143 248, 152 256, 158 266 C 160 296, 160 322, 158 342 "
              "C 130 338, 98 328, 78 306 C 68 295, 62 288, 64 280 Z")
    capit = "M 164 268 C 184 278, 216 280, 238 268 C 244 290, 246 320, 240 344 C 226 352, 190 352, 166 344 C 160 320, 160 290, 164 268 Z"
    trapd = "M 246 266 C 260 262, 282 260, 296 264 C 304 284, 304 306, 298 326 C 284 336, 262 340, 248 338 C 242 316, 242 288, 246 266 Z"
    trapm = ("M 304 270 C 306 258, 309 250, 313 244 C 313 230, 316 216, 320 204 C 322 198, 327 195, 330 197 "
             "C 334 201, 335 208, 336 218 C 338 228, 340 236, 340 244 C 354 250, 364 260, 366 276 "
             "C 366 298, 352 320, 332 334 C 318 342, 304 336, 300 322 C 298 304, 298 284, 304 270 Z")
    bones = " ".join((hamate, capit, trapd, trapm))
    sc.add(path(bones, "rgba(0,0,0,.35)", "none", 1), [(0, S(1, 3, 5))])
    sc.add(path(bones, "url(#boneD)", BONE_LINE, 2))
    rim = ("M 70 276 C 82 260, 98 236, 107 214 M 114 236 C 114 222, 116 208, 119 198 M 170 274 C 188 284, 216 286, 234 276 "
           "M 252 270 C 266 267, 282 266, 294 269 M 317 238 C 317 226, 319 214, 322 205 M 318 252 C 328 256, 346 258, 358 264")
    sc.add(path(rim, "none", "rgba(255,255,255,.65)", 2))

    import random
    rnd = random.Random(931)
    polys = [poly_of(d) for d in (hamate, capit, trapd, trapm)]
    dots = []
    for pg in polys:
        xs, ys = [p[0] for p in pg], [p[1] for p in pg]
        n = 0
        while n < 11:
            x, y = rnd.uniform(min(xs), max(xs)), rnd.uniform(min(ys), max(ys))
            if inside(pg, x, y) and min(math.hypot(x - q[0], y - q[1]) for q in pg) > 9 and y > 262:
                dots.append(f"M {f(x)} {f(y)} l 0.01 0")
                n += 1
    sc.add(path(" ".join(dots), "none", "rgba(120,102,66,.28)", 3.4))

    # --- median nerve : round (calm, gold) -> flattened (compressed, amber) ----------------------
    NX = 258
    U = y_on(bb[3], bb[2], bb[1], bb[0], NX)          # underside of the ligament at the nerve
    UB = U - 5                                           # ... after the ligament has bowed up
    NCY = U + 14.2
    FCY = UB + 10.5
    print("ligament underside at nerve", round(U, 1), "round nerve y", round(NCY, 1), "flat nerve y", round(FCY, 1))
    nr = 13.6
    fasc = " ".join(f"M {f(NX + dx)} {f(NCY + dy)} l 0.01 0" for dx, dy in
                    ((-6, -4), (0, -6.2), (6, -3.6), (-4, 3.4), (2, 3.2), (6.5, 3.8)))
    sc.add(path(ell(NX, NCY, nr, nr), "url(#nerveG)", GOLD_D, 2.6), [(0, S(1)), (3000, S(1)), (4300, S(0))])
    sc.add(path(fasc, "none", "rgba(112,78,10,.7)", 3.6), [(0, S(1)), (3000, S(1)), (4300, S(0))])
    ffasc = " ".join(f"M {f(NX + dx)} {f(FCY)} l 0.01 0" for dx in (-17, -9, -1, 7, 15))
    sc.add(path(ell(NX, FCY, 30, 7.4), "url(#nerveA)", AMB_D, 2.4), [(3000, S(0)), (4300, S(1))])
    sc.add(path(ffasc, "none", "rgba(90,40,10,.75)", 3.0), [(3000, S(0)), (4300, S(1))])

    # --- pressure arrows (one layer, both arrows squeeze in together) --------------------------------
    ar = ("M -4 -52 L 4 -52 L 4 -26 L 11 -26 L 0 -10 L -11 -26 L -4 -26 Z "
          "M -4 52 L 4 52 L 4 26 L 11 26 L 0 10 L -11 26 L -4 26 Z")
    ACY = FCY
    a_kf = [(3300, S(0, NX, ACY, s=1.35)), (3800, S(1, NX, ACY, s=1.0)), (4300, S(1, NX, ACY, s=.8)),
            (4800, S(1, NX, ACY, s=1.0)), (5300, S(1, NX, ACY, s=.82)), (5800, S(1, NX, ACY, s=1.0))]
    sc.add(path(ar, RED, "#fff1ee", 1.6), a_kf)

    sc.add(path("M 152 98 L 152 163", "none", "rgba(232,244,244,.75)", 1.8), [(1000, S(0)), (1500, S(1))])
    # leader for the nerve label (gold) -> appears with the label
    sc.add(path(f"M 300 70 L {NX + 6} {f(UB - 2)}", "none", GOLD, 2.2), [(4700, S(0)), (5100, S(1))])

    # =====================================================================================
    # RIGHT PANEL : palmar view of the left hand
    # =====================================================================================
    D = {
        "little": ((466, 238), (458, 168), 12.5, 10.2),
        "ring": ((488, 232), (481, 124), 13, 10.5),
        "middle": ((514, 228), (514, 106), 13.5, 11),
        "index": ((541, 232), (549, 122), 13, 10.5),
        "thumb": ((553, 284), (598, 214), 15, 11.5),
    }
    palm = ("M 452 236 C 448 270, 452 304, 464 334 C 466 342, 464 350, 462 356 L 457 444 L 561 444 L 556 356 "
            "C 554 348, 553 340, 557 332 C 566 304, 568 270, 565 244 L 563 232 C 540 220, 480 220, 452 236 Z")
    hand = palm + " " + " ".join(taper(*D[k]) for k in ("little", "ring", "middle", "index", "thumb"))
    sc.add(path(hand, "#3b241c", "#3b241c", 3.6))
    sc.add(path(hand, "url(#skinH)", "none", 1))
    cr = []
    for k in ("little", "ring", "middle", "index"):
        b, t = D[k][0], D[k][1]
        cr += [crease(b, t, .45, 8), crease(b, t, .72, 7)]
    cr.append(crease(D["thumb"][0], D["thumb"][1], .6, 9))
    cr += ["M 560 248 C 546 266, 530 296, 524 334", "M 457 252 C 480 244, 520 242, 560 252", "M 463 356 C 490 361, 524 361, 555 355"]
    cr.append("M 488 134 L 488 232")        # split line of the ring finger
    sc.add(path(" ".join(cr), "none", "rgba(70,34,24,.42)", 1.5))

    # tingling overlay on the radial 3 1/2 digits
    tint = " ".join((taper(*D["thumb"]), taper(*D["index"]), taper(*D["middle"]), half_taper(*D["ring"])))
    ti = [(5000, S(0))]
    for t, o in ((5400, .46), (5800, .14), (6200, .5), (6600, .18), (7000, .46), (7400, .26)):
        ti.append((t, S(o)))
    sc.add(path(tint, "rgba(255,160,50,1)", "none", 1), ti)

    # thenar eminence (atrophies)
    THX, THY = 543, 300
    th = ("M -6 -50 C 18 -50, 32 -20, 30 10 C 28 38, 14 54, -8 54 C -26 52, -30 24, -28 -6 C -26 -30, -20 -50, -6 -50 Z")
    th_big = ("M -7 -54 C 21 -54, 36 -22, 34 10 C 32 41, 16 59, -9 59 C -30 57, -34 26, -32 -6 C -30 -33, -22 -54, -7 -54 Z")
    sc.add(path(th_big, "rgba(60,26,20,.55)", "none", 1), [(5800, S(0, THX, THY)), (6800, S(1, THX, THY))])
    sc.add(path(th, "url(#thenG)", "rgba(110,64,50,.45)", 1.3),
           [(0, S(1, THX, THY, s=1)), (5700, S(1, THX, THY, s=1)), (6300, S(.9, THX, THY, s=.86)), (7100, S(.75, THX, THY, s=.66))])
    sc.add(path(th, "none", "rgba(255,255,255,.5)", 1.4), [(5700, S(0, THX, THY)), (6100, S(.7, THX, THY))])

    # median nerve in the hand/forearm
    trunk = P(506, 444).C(505, 410, 508, 372, 510, 338).L(510, 300)
    mid = P(510, 300).C(512, 270, 514, 240, 514, 214).L(514, 108)
    idx = P(510, 300).C(520, 264, 536, 244, 542, 226).C(546, 200, 548, 150, 549, 126)
    rng = P(510, 300).C(502, 272, 496, 246, 494, 226).L(488, 128)
    thb = P(510, 300).C(524, 298, 540, 292, 553, 282).C(568, 262, 584, 240, 598, 216)
    rec = P(526, 291).C(535, 299, 544, 305, 552, 307)
    sc.add(tube(trunk.d, 6.5))
    br = " ".join(p.d for p in (mid, idx, rng, thb, rec))
    sc.add(path(br, "none", GOLD_D, 6.2))
    sc.add(path(br, "none", GOLD, 3.2))
    sc.add(path(" ".join(p.d for p in (mid, idx, rng, thb)), "none", "#4d3a10", 3.6), [(4400, S(0)), (5300, S(.6))])

    # leader from the "Thenar wasting" label to the eminence
    sc.add(path("M 594 368 L 572 340", "none", "#ffc982", 2), [(6300, S(0)), (6700, S(1))])

    # section plane bar + link into the left panel
    sc.add(path("M 442 318 L 574 318 M 438 318 L 392 318 M 402 310 L 391 318 L 402 326", "none", CYAN, 3))

    # =====================================================================================
    # glows / signal pulses / rings
    # =====================================================================================
    def chain(*ps):
        pts = list(ps[0].pts)
        for p in ps[1:]:
            pts += p.pts[1:]
        return pts

    R = {"m": chain(trunk, mid), "i": chain(trunk, idx), "r": chain(trunk, rng), "t": chain(trunk, thb)}
    for k, pts in R.items():
        sc.route("n" + k, pts)
    # phase 1: calm signal climbs the nerve (two sweeps), reaching all four radial digits
    PER = 1500.0
    for k in R:
        sc.flow("n" + k, 0, 3000, "url(#glowR)", 1, 1 / PER, 13)
        sc.flow("n" + k, 0, 3000, "#fffbe6", 1, 1 / PER, 3.2)
    # section: the same signal passes the cut plane -> pulse on the nerve cross-section
    Ltr = plen(R["m"])
    # distance along route to y=318
    dist = 0
    for i in range(1, len(R["m"])):
        a, b = R["m"][i - 1], R["m"][i]
        if b[1] <= 318 <= a[1]:
            dist += (a[1] - 318) / (a[1] - b[1]) * math.hypot(b[0] - a[0], b[1] - a[1])
            break
        dist += math.hypot(b[0] - a[0], b[1] - a[1])
    tc = dist / Ltr * PER
    print("cut-plane pass at", round(tc), "ms")
    for k in (0, 1):
        sc.ring(NX, NCY, int(tc + k * PER), 800, GOLD_L, 38)

    # phase 2: compression - the signal now dies at the wrist (amber, proximal only)
    prox = [p for p in trunk.pts if p[1] >= 322] + [(509.6, 322)]
    sc.route("prox", prox)
    sc.flow("prox", 3400, 8000, "url(#glowA)", 2, 1 / 1100.0, 12)
    sc.flow("prox", 3400, 8000, AMB_L, 2, 1 / 1100.0, 3)
    for t0, rm in ((4500, 30), (4950, 24), (5300, 20), (5900, 22), (6700, 18)):
        sc.ring(NX, FCY, t0, 700, AMB, rm)
    for t0 in (4600, 5200, 5900):
        sc.ring(510, 320, t0, 700, AMB, 24)

    # amber glow tracing the squeezed nerve (stays lit)
    cx_, cy_, rx_, ry_ = NX, FCY, 33.5, 11.5
    loop = [(cx_ + rx_ * math.cos(a), cy_ + ry_ * math.sin(a)) for a in [-math.pi / 2 + i * 2 * math.pi / 32 for i in range(33)]]
    sc.route("fn", loop)
    sc.glow("fn", 4300, 5100, AMB, 3.2)

    # the ligament tightens: amber stress glow along its (bowed) mid-line
    bm = []
    for i in range(0, 21):
        u = i / 20
        ax, ay = cub(bt[0], bt[1], bt[2], bt[3], u)
        bx_, by_ = cub(bb[3], bb[2], bb[1], bb[0], u)
        mx, my = (ax + bx_) / 2, (ay + by_) / 2
        bm.append((BX + (mx - BX) * 1.05, BY - 5 + (my - BY) * 1.05))
    sc.route("band", bm)
    sc.glow("band", 3900, 4800, "#ffcf8a", 2.6)

    # phase 3: pins-and-needles sparkles running along the radial 3 1/2 digits
    for k, nm in (("thumb", "st"), ("index", "si"), ("middle", "sm"), ("ring", "sr")):
        b, t = D[k][0], D[k][1]
        off = 5.5 if k == "ring" else 0
        sc.route(nm, [(b[0] + off, b[1]), (t[0] + off, t[1])])
        sc.flow(nm, 5200, 8000, "#fff2c4", 4, .0011, 2.6)
        sc.flow(nm, 5400, 8000, "#ffb347", 3, .0016, 2.0)
    sc.ring(552, 307, 5900, 800, AMB, 28)
    sc.ring(552, 307, 6600, 800, AMB, 28)

    # =====================================================================================
    # text
    # =====================================================================================
    sc.text("Carpal tunnel", 24, 36, 24, INK, "start", -1, 1)
    sc.text("Signal passes freely", 200, 414, 18, SOFT, "middle", 300, 500, 3000, 0, 600)
    sc.text("Swollen tendons squeeze the nerve", 200, 414, 18, "#ffc982", "middle", 3400, 600, -1, 1, 700)
    sc.text("Transverse carpal ligament", 20, 92, 19, INK, "start", 1000, 600, -1, 1, 700)
    sc.text("Median nerve", 396, 66, 20, GOLD, "end", 4700, 500, -1, 1, 800)
    sc.text("Radial 3½ digits", 528, 74, 19, "#ffc982", "middle", 5300, 600, -1, 1, 700)
    sc.text("Thenar", 600, 386, 19, "#ffc982", "middle", 6300, 600, -1, 1, 700)
    sc.text("wasting", 600, 408, 19, "#ffc982", "middle", 6300, 600, -1, 1, 700)
    return sc.build(QID, TAKEAWAY)


if __name__ == "__main__":
    print(len(json.dumps(make())))
