import sys
sys.path.insert(0, __file__.rsplit("/scenes/", 1)[0])
from kit import *

QID = "Q000009327"
TAKEAWAY = ("Subscapularis, the anterior rotator cuff muscle, internally rotates the humerus; "
            "weak internal rotation after shoulder injury points to its tendon.")

K, X0, Y0 = 1.15, 182.0, 56.0     # design -> stage scale / offset (design x=143,y=52 maps to X0,Y0)
MUSC_R = "url(#mR)"
TEND = "url(#tendG)"
SCAP = "url(#scapG)"


def T(x, y):
    return (X0 + K * (x - 143), Y0 + K * (y - 52))


def sh(pts):
    return [T(x, y) for x, y in pts]


HX = 10  # joint gap: humerus items are shifted laterally by this many design units


def hx(pts):
    return [(x + HX, y) for x, y in pts]


def f1(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def smooth(pts, closed=True, k=6.0):
    """Catmull-Rom -> cubic bezier path string through pts."""
    n = len(pts)
    d = f"M {f1(pts[0][0])} {f1(pts[0][1])}"
    segs = n if closed else n - 1
    for i in range(segs):
        p0 = pts[(i - 1) % n] if closed else pts[max(i - 1, 0)]
        p1 = pts[i % n]
        p2 = pts[(i + 1) % n] if closed else pts[i + 1]
        p3 = pts[(i + 2) % n] if closed else pts[min(i + 2, n - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / k, p1[1] + (p2[1] - p0[1]) / k)
        c2 = (p2[0] - (p3[0] - p1[0]) / k, p2[1] - (p3[1] - p1[1]) / k)
        d += f" C {f1(c1[0])} {f1(c1[1])} {f1(c2[0])} {f1(c2[1])} {f1(p2[0])} {f1(p2[1])}"
    return d + (" Z" if closed else "")


def poly(pts, close=True):
    d = "M " + " L ".join(f"{f1(x)} {f1(y)}" for x, y in pts)
    return d + (" Z" if close else "")


# ------------------------------------------------------------------ design coordinates (K/X0/Y0 map them to the stage)
SCAP_PTS = [(150, 112), (178, 102), (212, 107), (238, 119), (256, 133), (274, 149), (288, 160), (298, 184),
            (293, 214), (272, 242), (242, 272), (212, 300), (188, 312), (168, 303), (160, 272), (151, 228),
            (143, 182), (143, 140)]
BELLY = [(158, 124), (198, 125), (236, 141), (262, 167), (281, 187), (286, 207), (262, 235), (230, 270),
         (199, 298), (181, 300), (166, 270), (155, 220), (152, 160)]
TENDON = [(272, 183), (298, 189), (320, 192), (337, 193), (341, 202), (337, 211), (320, 213), (298, 213), (274, 209)]
CORACOID = [(234, 128), (242, 107), (260, 92), (286, 87), (309, 94), (323, 107), (316, 115), (300, 107),
            (282, 105), (268, 111), (260, 129), (248, 138)]
ACROMION = [(282, 100), (300, 80), (328, 70), (358, 72), (384, 82), (394, 97), (385, 109), (364, 101),
            (340, 99), (316, 102), (298, 108)]
CLAV = [(-40, 56), (30, 50), (110, 56), (190, 68), (260, 75), (318, 70), (336, 74), (338, 88), (318, 94),
        (262, 93), (196, 88), (116, 76), (30, 68), (-40, 74)]
GLENOID = [(289, 158), (298, 172), (299, 190), (296, 208), (287, 216), (280, 204), (279, 184), (281, 166)]

HUM0 = [(304, 164), (317, 149), (338, 145), (357, 153), (367, 171), (372, 192), (369, 212), (361, 230),
       (358, 248), (359, 264), (367, 277), (371, 291), (363, 302), (346, 306), (328, 306), (311, 300),
       (307, 288), (313, 274), (320, 260), (319, 242), (315, 224), (306, 208), (301, 186)]
LT = (319 + HX, 202)                         # lesser tubercle crest (insertion of subscapularis)
LT_PTS0 = [(318, 182), (327, 187), (332, 200), (330, 218), (324, 236), (319, 252), (314, 236), (311, 216), (312, 196)]
GT_PTS0 = [(353, 170), (365, 176), (372, 192), (370, 212), (364, 232), (358, 254), (351, 236), (347, 214), (346, 190)]
HUM, LT_PTS, GT_PTS = hx(HUM0), hx(LT_PTS0), hx(GT_PTS0)
ELB = T(338 + HX, 292)                       # elbow pivot (absolute)
L = 106.0                               # forearm + hand length (design units)
EPS = 0.52                              # sin(elevation) of the oblique view
TUB_SHIFT = -13.0 * K                   # sideways slide of tubercles at full internal rotation

ER, IR, STALL = -60.0, 68.0, -42.0


def arm_state(th):
    """forearm pose for internal-rotation angle th (deg; +ve = internal = swings to the LEFT = medial)."""
    s, c = math.sin(math.radians(th)), math.cos(math.radians(th))
    r = math.degrees(math.atan2(s, c * EPS))
    sc_ = math.hypot(s, c * EPS) * K
    return {"opacity": 1, "x": round(ELB[0], 1), "y": round(ELB[1], 1), "rotate": round(r, 2), "scale": round(sc_, 3)}


def tub_state(th):
    return {"opacity": 1, "x": round(TUB_SHIFT * (th - ER) / (IR - ER), 2), "y": 0}


def sweep(t0, t1, a, b, n, fn):
    out = []
    for i in range(n + 1):
        u = i / n
        e = u * u * (3 - 2 * u)
        out.append((int(round(t0 + (t1 - t0) * u)), fn(a + (b - a) * e)))
    return out


def motion(fn):
    k = [(0, fn(ER)), (2900, fn(ER))]
    k += sweep(2900, 4400, ER, IR, 4, fn)[1:]
    k += [(4900, fn(IR))]
    k += sweep(4900, 5600, IR, ER, 3, fn)[1:]
    k += [(6000, fn(ER))]
    k += sweep(6000, 7000, ER, STALL, 3, fn)[1:]
    k += [(7000, fn(STALL))]
    return k


def make():
    sc = Scene()
    backdrop(sc)

    sc.extra_defs = (
        '<radialGradient id="mR" cx=".4" cy=".34" r=".85"><stop offset="0" stop-color="#f4907f"/>'
        '<stop offset=".55" stop-color="#cf5a54"/><stop offset="1" stop-color="#8a2b33"/></radialGradient>'
        '<linearGradient id="tendG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffaf0"/>'
        '<stop offset="1" stop-color="#d6c6a4"/></linearGradient>'
        '<linearGradient id="scapG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3ead2"/>'
        '<stop offset=".55" stop-color="#d9cca8"/><stop offset="1" stop-color="#a99870"/></linearGradient>'
        '<radialGradient id="redG"><stop offset="0" stop-color="#ff5a4d" stop-opacity=".9"/>'
        '<stop offset=".5" stop-color="#ff5a4d" stop-opacity=".35"/><stop offset="1" stop-color="#ff5a4d" stop-opacity="0"/></radialGradient>'
    )

    # --- faint rotator-cuff context (behind everything): supraspinatus tendon over the head,
    #     infraspinatus / teres minor peeking out behind the head
    cuff = (smooth(sh(hx([(298, 128), (322, 116), (350, 118), (370, 138), (376, 164), (364, 170), (350, 146), (324, 139), (300, 146)])))
            + " " + smooth(sh(hx([(352, 182), (374, 176), (386, 192), (386, 216), (376, 238), (362, 232), (366, 208)]))))
    sc.add(path(cuff, "url(#musc)", "#e0a49c", 1.3), [(0, S(0.4))])

    # --- clavicle (faint) + acromion
    sc.add(path(smooth(sh(CLAV)), "url(#bone)", BONE_LINE, 1.6), [(0, S(0.35))])
    sc.add(path(smooth(sh(ACROMION)), "url(#bone)", BONE_LINE, 2))

    # --- scapula (anterior / costal surface)
    sc.add(path(smooth(sh(SCAP_PTS)), SCAP, BONE_LINE, 2.2))
    ridge = (smooth(sh([(152, 126), (148, 190), (156, 258), (172, 298)]), False)
             + " " + smooth(sh([(264, 236), (238, 268), (208, 296)]), False)
             + " " + smooth(sh([(160, 112), (200, 112), (240, 128)]), False))
    sc.add(path(ridge, "none", "#fffaf0", 2.2), [(0, S(0.55))])
    sc.add(path(smooth(sh(GLENOID)), "url(#bone)", BONE_LINE, 1.8))

    # --- humerus (head, tubercle region, shaft, distal end)
    sc.add(path(smooth(sh(HUM)), "url(#bone)", BONE_LINE, 2.2))
    # articular cartilage cap of the head (faces the glenoid) + sheen along the shaft
    cap = smooth(sh(hx([(304, 166), (316, 150), (336, 146), (350, 150), (336, 156), (322, 168), (316, 184), (308, 186)])))
    sc.add(path(cap, TEND, "#b8a87e", 1.2))
    sheen = smooth(sh(hx([(333, 252), (334, 270), (339, 290)])), False)
    sc.add(path(sheen, "none", "#fffdf4", 4), [(0, S(0.6))])

    # --- subscapularis: belly, fibres, tendon -------------------------------------------------
    sc.add(path(smooth(sh(BELLY)), MUSC_R, "#7d2a30", 2))
    starts = [(160, 130), (156, 158), (153, 188), (153, 218), (158, 244), (168, 270), (182, 289), (198, 297)]
    ends = [(284, 187), (285, 191), (285, 195), (285, 199), (285, 202), (285, 205), (284, 207), (283, 208)]
    routes = []
    fib = []
    for (sx, sy), (ex, ey) in zip(starts, ends):
        (sx, sy), (ex, ey) = T(sx, sy), T(ex, ey)
        p = P(sx, sy).C(sx + 55, sy + (ey - sy) * 0.10, ex - 60, ey - (ey - sy) * 0.30, ex, ey)
        routes.append(p)
        fib.append(p.d)
    sc.add(path(" ".join(fib), "none", "#7d2a30", 1.5), [(0, S(0.75))])
    bands = [smooth(sh([(196, 128), (206, 190), (196, 296)]), False), smooth(sh([(232, 146), (246, 205), (222, 276)]), False)]
    hi = [smooth(sh([(sx + 4, sy - 3), ((sx + ex) / 2 + 2, (sy + ey) / 2 - 5), (ex - 3, ey - 2)]), False)
          for (sx, sy), (ex, ey) in zip(starts[1:6:2], ends[1:6:2])]
    sc.add(path(" ".join(hi + bands), "none", "#ffb5a6", 1.1), [(0, S(0.5))])
    # coracoid sits in front of the upper lateral edge of the muscle
    sc.add(path(smooth(sh(CORACOID)), "url(#bone)", BONE_LINE, 2))
    # tendon crossing the front of the joint to the lesser tuberosity
    sc.add(path(smooth(sh(TENDON)), TEND, "#a99870", 1.6))
    sc.add(path(smooth(sh([(278, 192), (302, 197), (322, 201)]), False) + " " + smooth(sh([(277, 203), (300, 207), (318, 209)]), False),
                "none", "#ffffff", 1.8), [(0, S(0.7))])

    # --- injury: dull muscle (under the bone crests)
    sc.add(path(smooth(sh(BELLY)) + " " + smooth(sh(TENDON)), "#2b2230", "none", 1),
           [(5000, S(0)), (5700, S(0.5))])

    # --- moving: tubercle crests slide as the humerus rotates ------------------------------------------
    tub = smooth(sh(LT_PTS)) + " " + smooth(sh(GT_PTS))
    sc.add(path(tub, "url(#bone)", BONE_LINE, 2), motion(tub_state))

    # --- moving: forearm + hand bones (pivot at the elbow centre = local origin) ---------------------
    ulna = smooth([(-17, -12), (-6, -17), (4, -10), (5, 2), (3, 16), (2, 44), (0, 70), (-1, 83), (-10, 86),
                   (-10, 72), (-12, 42), (-14, 12)])
    radius = smooth([(8, -3), (17, -7), (23, 1), (19, 11), (15, 18), (15, 42), (17, 66), (22, 84), (11, 87),
                     (9, 70), (5, 42), (5, 17)])
    hand = []
    for x0, x1, y1, w in ((-8, -15, 111, 3.2), (-1, -5, 117, 3.4), (7, 6, 118, 3.4), (14, 17, 112, 3.2), (21, 29, 100, 3.0)):
        hand.append(poly([(x0 - w, 90), (x1 - w + 0.8, y1), (x1 + w - 0.8, y1), (x0 + w, 90)]))
        hand.append(poly([(x1 - w + 1, y1 + 2), (x1 * 1.12 - w + 1.6, y1 + 15), (x1 * 1.12 + w - 1.6, y1 + 15), (x1 + w - 1, y1 + 2)]))
    wrist = smooth([(-13, 85), (0, 82), (14, 85), (20, 92), (0, 96), (-12, 93)])
    bones = ulna + " " + radius + " " + wrist + " " + " ".join(hand)
    sc.add(path(bones, "url(#boneV)", BONE_LINE, 1.6), motion(arm_state))

    # --- direction arrow: internal rotation wraps medially across the front of the shaft ----------
    ax, ay = T(339 + HX, 250)
    w = 40 * K
    arc = f"M {f1(ax + w)} {f1(ay - 3)} C {f1(ax + w * .75)} {f1(ay + 24)} {f1(ax - w * .75)} {f1(ay + 24)} {f1(ax - w)} {f1(ay - 3)}"
    head = (f"M {f1(ax - w)} {f1(ay - 3)} L {f1(ax - w + 12)} {f1(ay - 9)} "
            f"M {f1(ax - w)} {f1(ay - 3)} L {f1(ax - w + 4)} {f1(ay + 10)}")
    akf = [(2700, S(0)), (3100, S(1)), (4400, S(1)), (4800, S(0))]
    sc.add(path(arc + " " + head, "none", "#2a1f06", 9), akf)
    sc.add(path(arc + " " + head, "none", "#ffd96a", 4.6), akf)

    # --- contraction highlights on the belly --------------------------------------------------------
    sc.add(path(" ".join(fib), "none", "#ffe7a8", 2.2), [(2500, S(0)), (2900, S(0.95)), (4300, S(0.95)), (4800, S(0))])
    sc.add(path(smooth(sh(BELLY)), "url(#glowR)", "none", 1),
           [(1000, S(0)), (1700, S(0.5)), (2400, S(0.2)), (3000, S(0.85)), (3600, S(0.35)), (4200, S(0.8)), (4800, S(0))])

    # --- injury: dull muscle, red tear, short stalled arrow --------------------------------------------
    TX, TY = T(314, 203)
    sc.add(circle(TX, TY, 36, "url(#redG)"), [(5000, S(0)), (5400, S(1))])
    tear = poly(sh(hx([(298, 181), (306, 191), (300, 198), (309, 205), (301, 213), (309, 226), (316, 225), (309, 213),
                    (316, 205), (307, 198), (315, 191), (307, 181)])))
    sc.add(path(tear, "#2a0b10", "#ff6a5c", 2.2), [(5000, S(0)), (5300, S(1))])
    stall = (f"M {f1(ax + w)} {f1(ay - 3)} C {f1(ax + w * .85)} {f1(ay + 12)} {f1(ax + w * .5)} {f1(ay + 20)} {f1(ax + 9)} {f1(ay + 21)}")
    stall_x = (f"M {f1(ax - 9)} {f1(ay + 11)} L {f1(ax + 5)} {f1(ay + 29)} M {f1(ax + 5)} {f1(ay + 11)} L {f1(ax - 9)} {f1(ay + 29)}")
    skf = [(6300, S(0)), (6800, S(1))]
    sc.add(path(stall + " " + stall_x, "none", "#2a0b10", 9), skf)
    sc.add(path(stall + " " + stall_x, "none", "#ff8f84", 4.6), skf)

    # --- leader from the label to the muscle ----------------------------------------------------------
    lx, ly = T(150, 214)
    sc.add(path(f"M 166 {f1(ly)} L {f1(lx + 14)} {f1(ly)} m -4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0", GOLD, GOLD, 2),
           [(2300, S(0)), (2800, S(1))])

    # --- routes for travelling activation sparks --------------------------------------------------
    LTX, LTY = T(*LT)
    for i, p in enumerate(routes):
        q = P(*p.cur)
        q.L(LTX - 14, LTY)
        sc.route(f"f{i}", list(p.pts) + q.pts[1:])
    for i in (2, 5):
        sc.route(f"a{i}", list(routes[i].pts) + [(TX - 9, TY - 2)])
    for i in range(8):
        sc.flow(f"f{i}", 2500, 4500, "#fff3bf", 2, 0.00055, 3)
    sc.flow("a2", 6000, 7600, "#ff9d92", 1, 0.0004, 3)
    sc.flow("a5", 6000, 7600, "#ff9d92", 1, 0.0004, 3)

    # --- rings ----------------------------------------------------------------------------------------
    cx, cy = T(215, 215)
    sc.ring(round(cx), round(cy), 1100, 1000, GOLD, 66)
    sc.ring(round(cx), round(cy), 2500, 1000, GOLD, 74)
    sc.ring(round(LTX), round(LTY), 4300, 900, GOLD, 36)
    sc.ring(round(TX), round(TY), 5000, 900, RED, 40)
    sc.ring(round(TX), round(TY), 5500, 900, RED, 40)

    # --- text -------------------------------------------------------------------------------------------
    sc.text("Left shoulder, front view", 320, 34, 22, INK, "middle", -1, 1)
    sc.text("Subscapularis", 14, round(ly) + 7, 21, GOLD, "start", 2300, 500, 5000, 0.7, 800)
    sc.text("Internal rotation", 268, 414, 22, "#fff3bf", "middle", 3000, 500, 4500, 0, 700)
    sc.text("Weak internal rotation", 268, 414, 24, "#ff9d92", "middle", 6200, 600, -1, 1, 800)
    return sc.build(QID, TAKEAWAY)


if __name__ == "__main__":
    print(len(json.dumps(make())))
