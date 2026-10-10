import sys, math
sys.path.insert(0, __file__.rsplit("/scenes/", 1)[0])
from kit import *

QID = "Q000009332"
TAKEAWAY = ("The internal thoracic (mammary) artery is the main arterial supply of the breast, "
            "with contributions from axillary branches and intercostal perforators.")

ART_P = ("#5a1411", "#e2443a", "#ffb0a2")      # primary artery tube colours
ART_S = ("#5e1f20", "#d4605a", "#f2b5ac")      # secondary (thinner, paler)
NIP = (338, 248)


def chain(*ps):
    pts = list(ps[0].pts)
    for p in ps[1:]:
        pts += p.pts[1:]
    return pts


def breast_outline():
    d = ("M 464 240 C 464 174 414 122 340 122 C 282 122 236 140 214 176 "
         "C 202 198 204 222 206 244 C 210 310 266 358 336 358 C 414 358 464 308 464 240 Z")
    segs = [((464, 240), (464, 174), (414, 122), (340, 122)),
            ((340, 122), (282, 122), (236, 140), (214, 176)),
            ((214, 176), (202, 198), (204, 222), (206, 244)),
            ((206, 244), (210, 310), (266, 358), (336, 358)),
            ((336, 358), (414, 358), (464, 308), (464, 240))]
    poly = []
    for sg in segs:
        poly += bez(*sg, n=18)[:-1]
    return d, poly


def ray_dist(poly, ox, oy, ang):
    dx, dy = math.cos(ang), math.sin(ang)
    best = 1e9
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        ex, ey = x2 - x1, y2 - y1
        den = dx * ey - dy * ex
        if abs(den) < 1e-9:
            continue
        t = ((x1 - ox) * ey - (y1 - oy) * ex) / den
        u = ((x1 - ox) * dy - (y1 - oy) * dx) / den
        if t > 0 and 0 <= u <= 1 and t < best:
            best = t
    return best


def clavicle_d():
    """S-curved clavicle polygon: rises laterally, thicker at the sternal end."""
    cl = (bez((556, 84), (500, 80), (440, 62), (340, 68), n=12)
          + bez((340, 68), (240, 74), (140, 58), (40, 54), n=12)[1:])
    n = len(cl)
    up, lo = [], []
    for i, (x, y) in enumerate(cl):
        u = i / (n - 1)
        h = 5.0 + 4.5 * (1 - u) ** 1.5 + (2.5 if u < 0.05 else 0)
        up.append((x, y - h))
        lo.append((x, y + h * 1.05))
    pts = up + lo[::-1]
    return "M " + " L ".join(f"{x:.0f} {y:.0f}" for x, y in pts) + " Z", [(x, y - 3) for x, y in cl]


def make():
    sc = Scene()
    backdrop(sc)

    sc.extra_defs = (
        '<linearGradient id="ribB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cdbf99" stop-opacity="0"/>'
        '<stop offset=".5" stop-color="#d8cba7"/><stop offset="1" stop-color="#efe6cc"/></linearGradient>'
        '<linearGradient id="ribO" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d7f5f" stop-opacity="0"/>'
        '<stop offset=".5" stop-color="#8d7f5f"/><stop offset="1" stop-color="#8d7f5f"/></linearGradient>'
        '<linearGradient id="ribS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffaf0" stop-opacity="0"/>'
        '<stop offset=".5" stop-color="#fffaf0" stop-opacity=".5"/><stop offset="1" stop-color="#fffaf0" stop-opacity=".62"/></linearGradient>'
        '<radialGradient id="brG" cx=".42" cy=".36" r=".78"><stop offset="0" stop-color="#f7dcc6"/>'
        '<stop offset=".6" stop-color="#e3b399"/><stop offset="1" stop-color="#c0856a"/></radialGradient>'
        '<linearGradient id="warmM" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ff6a45" stop-opacity=".66"/>'
        '<stop offset=".5" stop-color="#ff7a52" stop-opacity=".3"/><stop offset="1" stop-color="#ff8a60" stop-opacity="0"/></linearGradient>'
        '<linearGradient id="warmL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9a6a" stop-opacity=".42"/>'
        '<stop offset=".5" stop-color="#ff9a6a" stop-opacity=".16"/><stop offset=".8" stop-color="#ff9a6a" stop-opacity="0"/></linearGradient>'
    )

    # ------------------------------------------------------------ skeleton
    clav, cl_mid = clavicle_d()
    sc.add(path(clav, "url(#bone)", BONE_LINE, 2))
    sc.add(path("M " + " L ".join(f"{x:.0f} {y-4:.0f}" for x, y in cl_mid[1:-2]), "none", "#fffaf0", 1.6), [(0, S(0.55))])

    # ribs 1-6 (rib 1 short) + costal cartilages
    ribs, carts = [], []
    ribs.append("M 518 100 C 470 98 440 108 400 130")
    carts.append("M 551 104 C 540 103 530 101 518 100")
    spec = [(148, 80, 206), (190, 60, 250), (232, 48, 292), (272, 36, 332), (310, 26, 368)]
    for ys, xl, yl in spec:
        L = 498 - xl
        ribs.append(f"M 498 {ys-9} C {498-0.4*L:.0f} {ys-17} {xl+0.4*L:.0f} {yl-14} {xl} {yl}")
        carts.append(f"M 552 {ys} C 536 {ys-1} 518 {ys-5} 498 {ys-9}")
    rd, cd = " ".join(ribs), " ".join(carts)
    sc.add(tube(rd, 12, ("url(#ribO)", "url(#ribB)", "url(#ribS)")))
    sc.add(path(cd, "none", "#6f827e", 13.2))
    sc.add(path(cd, "none", "#c3d3cd", 10))

    # sternum
    stern = ("M 546 94 Q 558 84 568 93 Q 573 96 578 93 Q 588 84 600 94 L 596 134 Q 594 146 592 150 "
             "L 590 330 Q 586 346 572 372 Q 558 346 554 330 L 552 150 Q 550 146 548 134 Z")
    sc.add(path(stern, "url(#bone)", BONE_LINE, 2))
    sc.add(path("M 553 148 L 591 148 M 554 214 L 590 214 M 554 262 L 590 262 M 555 304 L 589 304 "
                "M 563 100 Q 560 200 562 320", "none", "#a99870", 1.4))

    # ------------------------------------------------------------ breast (semi-transparent)
    bd, poly = breast_outline()
    sc.add(path(bd, "url(#brG)", "#b3785f", 2), [(0, S(0.86))])
    # glandular texture: radiating ducts + lobules
    ducts, lob = [], []
    nx, ny = NIP
    N = 16
    for k in range(N):
        a = 2 * math.pi * k / N + 0.13 * math.sin(k * 2.3)
        rm = ray_dist(poly, nx, ny, a) * 0.86
        r0 = 28
        ca = a + 0.16 * (1 if k % 2 else -1)
        rmid = (r0 + rm) * 0.5
        x0, y0 = nx + r0 * math.cos(a), ny + r0 * math.sin(a)
        xc, yc = nx + rmid * math.cos(ca), ny + rmid * math.sin(ca)
        x1, y1 = nx + rm * math.cos(a), ny + rm * math.sin(a)
        ducts.append(f"M {x0:.0f} {y0:.0f} Q {xc:.0f} {yc:.0f} {x1:.0f} {y1:.0f}")
        for f, sgn in ((0.55, 1), (0.72, -1)):
            r = r0 + (rm - r0) * f
            bx, by = nx + r * math.cos(a + 0.05 * sgn), ny + r * math.sin(a + 0.05 * sgn)
            ex, ey = nx + (r + 22) * math.cos(a + 0.2 * sgn), ny + (r + 22) * math.sin(a + 0.2 * sgn)
            ducts.append(f"M {bx:.0f} {by:.0f} L {ex:.0f} {ey:.0f}")
        for f in (0.7, 0.9):
            r = r0 + (rm - r0) * f
            for off in (-0.1, 0.1):
                px, py = nx + r * math.cos(a + off), ny + r * math.sin(a + off)
                lob.append(f"M {px-3:.0f} {py:.0f} a3 2.4 0 1 0 6 0 a3 2.4 0 1 0 -6 0")
    sc.add(path(" ".join(ducts), "none", "#a8685a", 1.3), [(0, S(0.5))])
    half = len(lob) // 2
    for chunk in (lob[:half], lob[half:]):
        sc.add(path(" ".join(chunk), "#c98a78", "none", 1), [(0, S(0.45))])
    # areola, nipple, highlights / inframammary shading
    sc.add(circle(nx, ny, 25, "#cd8f7e", "#a8665a", 1.5), [(0, S(0.88))])
    sc.add(circle(nx, ny, 9, "#b0675a", "#8a4a42", 1.5), [(0, S(0.95))])
    sc.add(path("M 250 160 Q 290 136 340 132", "none", "#fff6ec", 6), [(0, S(0.24))])
    sc.add(path("M 218 298 C 242 336 286 354 336 354 C 400 354 450 326 460 270", "none", "#8a5a48", 4), [(0, S(0.4))])

    # warm tint where supplied
    sc.add(path(bd, "url(#warmM)", "none", 2), [(3500, S(0)), (4600, S(1))])
    sc.add(path(bd, "url(#warmL)", "none", 2), [(5500, S(0)), (6500, S(1))])

    # ------------------------------------------------------------ arteries
    SUB = (P(564, 106).C(556, 100, 548, 97, 538, 97).C(500, 97, 480, 100, 440, 102)
           .C(380, 106, 320, 110, 260, 108).C(210, 106, 170, 104, 150, 105).C(100, 108, 50, 114, 0, 124))
    ITA = (P(538, 98).C(535, 125, 532, 150, 531, 172).C(530, 200, 530, 230, 529, 254)
           .C(528, 280, 526, 310, 523, 341))
    P2 = P(531, 169).C(512, 167, 490, 165, 470, 163).C(446, 161, 420, 162, 396, 170)
    P3 = P(530, 211).C(512, 211, 490, 214, 470, 218).C(446, 222, 418, 228, 388, 238)
    P4 = P(529, 252).C(512, 254, 490, 258, 470, 262).C(446, 268, 420, 278, 392, 292)
    T = [P(446, 161).C(430, 150, 410, 140, 384, 136),
         P(396, 170).C(376, 176, 360, 190, 346, 206),
         P(396, 170).C(380, 160, 360, 152, 340, 150),
         P(446, 222).C(430, 210, 412, 204, 392, 202),
         P(388, 238).C(376, 242, 368, 246, 364, 248),
         P(446, 268).C(440, 284, 430, 300, 412, 316),
         P(392, 292).C(376, 300, 362, 312, 346, 322),
         P(392, 292).C(380, 282, 368, 274, 352, 268)]
    # lateral thoracic (from the axillary artery, arriving at the upper lateral side)
    LT = P(150, 105).C(136, 130, 142, 168, 176, 192).C(192, 204, 206, 212, 222, 218)
    LTa = P(222, 218).C(246, 206, 270, 190, 294, 176)
    LTb = P(222, 218).C(246, 226, 264, 228, 282, 232)
    # intercostal (lateral cutaneous) perforators from the posterior / lateral side
    I1 = P(120, 326).C(160, 328, 200, 318, 234, 304).C(252, 296, 268, 288, 286, 282)
    I2 = P(120, 268).C(160, 270, 196, 264, 230, 262).C(246, 260, 262, 262, 280, 262)

    # primary: subclavian trunk + internal thoracic + perforators + fan
    sc.add(tube(SUB.d, 7, ART_P), sc.appear(800, 700))
    sc.add(tube(ITA.d, 10, ART_P), sc.appear(900, 700))
    sc.add(tube(" ".join(p.d for p in (P2, P3, P4)), 5, ART_P), sc.appear(1500, 600))
    sc.add(path(" ".join(t.d for t in T), "none", "#e2594e", 2.2), sc.appear(1900, 600))
    # secondary: lateral thoracic (axillary branch) + intercostal perforators
    sc.add(tube(" ".join(p.d for p in (LT, LTa, LTb)), 3.6, ART_S), [(4900, S(0)), (5400, S(1))])
    sc.add(tube(" ".join(p.d for p in (I1, I2)), 2.8, ART_S), [(5000, S(0)), (5500, S(1))])

    # ------------------------------------------------------------ label plates
    sc.add(path("M 504 374 L 522 346", "none", GOLD, 2), sc.appear(4350, 300))
    sc.add(rect(280, 374, 242, 34, GOLD, GOLD_L, 2, 17), sc.appear(4250, 300))
    sc.add(rect(116, 374, 150, 34, RED, "#ffd6cf", 2, 17), sc.appear(4650, 300))
    sc.add(rect(8, 128, 108, 50, "#0c1f25", "none", 2, 10), [(5600, S(0)), (6100, S(0.78))])
    sc.add(rect(8, 282, 108, 50, "#0c1f25", "none", 2, 10), [(5800, S(0)), (6300, S(0.78))])

    # ------------------------------------------------------------ motion routes
    sc.route("it", chain(P(556, 102).C(550, 99, 545, 97, 538, 98), ITA))
    sc.route("p2", chain(P2, T[1]))
    sc.route("p3", chain(P3, T[4]))
    sc.route("p4", chain(P4, T[6]))
    sc.route("p4b", chain(P4, T[7]))
    sc.route("lt", chain(P(230, 106).C(200, 106, 170, 104, 150, 105), LT, LTb))
    sc.route("lt3", chain(LT, LTa))
    sc.route("i1", I1)
    sc.route("i2", I2)

    # blood streams down the internal thoracic artery
    sc.flow("it", 2300, 8000, "#ffd5cb", 9, 0.00058, 3.6)
    sc.glow("it", 2800, 3900, "#ff6b5e", 6)
    # perforators fire as the pulse passes their origins, then supply the medial breast
    for r, t0 in (("p2", 3150), ("p3", 3330), ("p4", 3500)):
        sc.glow(r, t0, t0 + 700, "#ff8f7f", 3)
        sc.flow(r, t0, 8000, "#ffd5cb", 4, 0.0005, 2.9)
    sc.flow("p4b", 3600, 8000, "#ffd5cb", 3, 0.0005, 2.6)
    for y, t0 in ((169, 3150), (211, 3330), (252, 3500)):
        sc.ring(530, y, t0, 700, "#ffb3a6", 20)
    # primary emphasis
    sc.ring(531, 190, 4300, 1000, GOLD, 40)
    sc.ring(531, 190, 4800, 1000, GOLD, 40)
    # weaker secondary routes
    sc.glow("lt", 5300, 6100, "#c65a52", 3)
    sc.flow("lt", 5500, 8000, "#e9aaa3", 4, 0.00032, 2.4)
    sc.flow("lt3", 5700, 8000, "#e9aaa3", 2, 0.00032, 2.2)
    sc.glow("i1", 5500, 6200, "#c65a52", 2.4)
    sc.glow("i2", 5600, 6300, "#c65a52", 2.4)
    sc.flow("i1", 5800, 8000, "#e9aaa3", 3, 0.00032, 2.2)
    sc.flow("i2", 5900, 8000, "#e9aaa3", 3, 0.00032, 2.2)

    # ------------------------------------------------------------ text
    sc.text("Blood supply of the breast", 320, 36, 24, INK, "middle", -1, 1)
    sc.text("Clavicle", 40, 92, 15, SOFT, "start", -1, 1, 2000, 0.7, 600)
    sc.text("Sternum", 574, 398, 15, SOFT, "middle", -1, 1, 2000, 0.7, 600)
    sc.text("Internal thoracic artery", 401, 397, 18, "#3b2b05", "middle", 4250, 300, -1, 1, 800)
    sc.text("primary supply", 191, 397, 17, "#2b0a08", "middle", 4650, 300, -1, 1, 800)
    GREY = "#b4c2c4"
    sc.text("Axillary", 16, 148, 16, GREY, "start", 5800, 500, -1, 1, 600)
    sc.text("branches", 16, 168, 16, GREY, "start", 5800, 500, -1, 1, 600)
    sc.text("Intercostal", 16, 302, 16, GREY, "start", 6000, 500, -1, 1, 600)
    sc.text("perforators", 16, 322, 16, GREY, "start", 6000, 500, -1, 1, 600)
    return sc.build(QID, TAKEAWAY)


if __name__ == "__main__":
    print(len(json.dumps(make())))
