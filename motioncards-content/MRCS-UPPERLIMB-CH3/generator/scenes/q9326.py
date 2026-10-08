import sys, math
sys.path.insert(0, __file__.rsplit("/scenes/", 1)[0])
from kit import *

QID = "Q000009326"
TAKEAWAY = ("The long thoracic nerve (C5–C7) supplies serratus anterior, which holds the scapula against "
            "the chest wall; a lesion leaves the scapula unanchored: winged scapula.")

SX = 200            # x of the spine (posterior view; patient's right = viewer's right)
VY0, VP = 46, 26    # first vertebra top, vertebra pitch


# ----------------------------------------------------------------- helpers
def lp(cmds, ox=0, oy=0):
    """local path string: cmds = [('M',x,y), ('C',x1,y1,x2,y2,x3,y3), ('L',x,y), ('Z',)] in spine-relative u,y;
    coordinates are emitted relative to origin (ox,oy) (given in u,y) so layers can pivot about it."""
    out = []
    for c in cmds:
        k, a = c[0], c[1:]
        if k == "Z":
            out.append("Z")
            continue
        v = []
        for i in range(0, len(a), 2):
            v += [round(a[i] - ox, 1), round(a[i + 1] - oy, 1)]
        out.append(k + " " + " ".join(f"{n:g}" for n in v))
    return " ".join(out)


def unit(v):
    n = math.hypot(*v) or 1
    return (v[0] / n, v[1] / n)


def add2(a, b, k=1.0):
    return (a[0] + b[0] * k, a[1] + b[1] * k)


# ----------------------------------------------------------------- rib cage geometry (spine-relative u)
UE = {1: 136, 2: 150, 3: 185, 4: 212, 5: 232, 6: 246, 7: 254, 8: 256, 9: 250, 10: 240}
DROP = {1: 26, 2: 26, 3: 32, 4: 36, 5: 40, 6: 44, 7: 46, 8: 48, 9: 50, 10: 52}


def rib_ys(k):
    return 108 + 26 * k


def rib_end(k):
    return (UE[k], rib_ys(k) + DROP[k])


def rib_path(k, side=1, w=1.0):
    ys = rib_ys(k)
    W = UE[k] * w
    ye = ys + DROP[k] * (0.9 if w < 1 else 1)
    p0 = (SX + side * 14, ys)
    p1 = (SX + side * (14 + 0.35 * (W - 14)), ys - 7)
    p2 = (SX + side * (W - 36), ye - 0.62 * DROP[k])
    p3 = (SX + side * W, ye)
    return (f"M {p0[0]:g} {p0[1]:g} C {p1[0]:.1f} {p1[1]:.1f} {p2[0]:.1f} {p2[1]:.1f} {p3[0]:.1f} {p3[1]:.1f}")


# ----------------------------------------------------------------- scapula (design coords u,y; pivot near superior-lateral)
SH = 8   # lateral shift of the scapula design
PIV = (164 + SH, 180)


def shx(cmds, dx=SH):
    out = []
    for c in cmds:
        if c[0] == "Z":
            out.append(c)
        else:
            out.append((c[0],) + tuple(v + (dx if i % 2 == 0 else 0) for i, v in enumerate(c[1:])))
    return out


SCAP = shx([("M", 58, 150), ("C", 82, 152, 112, 158, 140, 167), ("C", 150, 170, 156, 172, 162, 176),
            ("C", 169, 174, 179, 182, 180, 196), ("C", 182, 210, 179, 226, 173, 238),
            ("C", 170, 245, 166, 251, 160, 258), ("C", 146, 276, 118, 300, 82, 322),
            ("C", 70, 327, 64, 324, 62, 319), ("C", 56, 274, 54, 224, 55, 200),
            ("C", 56, 184, 56, 164, 58, 150), ("Z",)])
RIDGE = shx([("M", 56, 196), ("C", 90, 188, 120, 180, 150, 168), ("C", 170, 158, 192, 146, 212, 146),
             ("C", 220, 147, 222, 156, 216, 162), ("C", 200, 172, 186, 178, 172, 188),
             ("C", 150, 200, 100, 206, 56, 208), ("Z",)])
# thick medial-border flange (visible underside edge when the border lifts)
EDGE = shx([("M", 58, 150), ("C", 56, 164, 56, 184, 55, 200), ("C", 54, 224, 56, 274, 62, 319),
            ("C", 64, 324, 70, 327, 82, 322), ("C", 72, 322, 68, 320, 66, 316),
            ("C", 62, 272, 62, 224, 63, 200), ("C", 64, 184, 64, 166, 66, 152), ("Z",)])

WING_ROT, WING_SCALE = 7.5, 1.06


def scap_pose(o=1, wing=0.0):
    r = round(WING_ROT * wing, 3)
    s = round(1 + (WING_SCALE - 1) * wing, 4)
    return S(o, SX + PIV[0], PIV[1], r, s)


def wing_xy(u, y):
    """design point -> absolute point after the wing pose."""
    dx, dy = u - PIV[0], y - PIV[1]
    a = math.radians(WING_ROT)
    xr = (dx * math.cos(a) - dy * math.sin(a)) * WING_SCALE
    yr = (dx * math.sin(a) + dy * math.cos(a)) * WING_SCALE
    return (SX + PIV[0] + xr, PIV[1] + yr)


# ----------------------------------------------------------------- serratus anterior geometry
MPIV = (60, 250)    # contraction pivot (medial attachment, hidden under scapula)
TEETH = [3, 4, 5, 6, 7, 8]
ATT = {k: (68, 180 + (k - 3) * 24) for k in TEETH}
TIP = {k: (UE[k] - 3, rib_end(k)[1]) for k in TEETH}
DIR = {k: unit((TIP[k][0] - ATT[k][0], TIP[k][1] - ATT[k][1])) for k in TEETH}


def serratus_cmds():
    N = {}
    N[2] = (TIP[3][0] - 46, TIP[3][1] - 36)
    for k in TEETH[:-1]:
        mid = ((TIP[k][0] + TIP[k + 1][0]) / 2, (TIP[k][1] + TIP[k + 1][1]) / 2)
        dd = unit((DIR[k][0] + DIR[k + 1][0], DIR[k][1] + DIR[k + 1][1]))
        N[k] = (mid[0] - dd[0] * 40, mid[1] - dd[1] * 40)
    N[8] = (TIP[8][0] - 20, TIP[8][1] + 26)
    cmds = [("M", 58, 152), ("C", 90, 156, 112, 170, N[2][0], N[2][1])]
    L = 46
    for k in TEETH:
        a, b, d = N[k - 1], N[k], DIR[k]
        cmds.append(("C", a[0] + d[0] * L, a[1] + d[1] * L, b[0] + d[0] * L, b[1] + d[1] * L, b[0], b[1]))
    cmds += [("C", 190, 376, 120, 350, 72, 332), ("L", 56, 318), ("Z",)]
    return cmds


def fibre_curves():
    out = []
    for k in TEETH:
        a, t, d = ATT[k], TIP[k], DIR[k]
        pr = (-d[1], d[0])
        for off in (-10, 0, 10):
            s0 = (a[0], a[1] + off * 0.35)
            e = (t[0] - d[0] * 10 + pr[0] * off, t[1] - d[1] * 10 + pr[1] * off)
            v = (e[0] - s0[0], e[1] - s0[1])
            out.append((s0, (s0[0] + v[0] * 0.35 + pr[0] * 5, s0[1] + v[1] * 0.35 + pr[1] * 5),
                        (s0[0] + v[0] * 0.7 - pr[0] * 4, s0[1] + v[1] * 0.7 - pr[1] * 4), e))
    return out


def fibre_cmds():
    cmds = []
    for s0, c1, c2, e in fibre_curves():
        cmds += [("M",) + s0, ("C", c1[0], c1[1], c2[0], c2[1], e[0], e[1])]
    return cmds


def sample_outline(cmds, n=12):
    pts, cur = [], None
    for c in cmds:
        if c[0] == "M":
            cur = (c[1], c[2])
            pts.append(cur)
        elif c[0] == "C":
            seg = bez(cur, (c[1], c[2]), (c[3], c[4]), (c[5], c[6]), n)
            pts += seg[1:]
            cur = (c[5], c[6])
    return pts


def inside(pt, poly):
    x, y = pt
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi:
            c = not c
        j = i
    return c


def ghost_fibres():
    """parts of the fibres that run deep to the scapula (drawn faintly on top of the bone)."""
    poly = sample_outline(SCAP)
    segs = []
    for s0, c1, c2, e in fibre_curves():
        pts = bez(s0, c1, c2, e, 36)
        run = []
        for p in pts + [None]:
            if p is not None and inside(p, poly):
                run.append(p)
            else:
                if len(run) >= 4:
                    idx = sorted(set(round(i * (len(run) - 1) / 5) for i in range(6)))
                    q = [run[i] for i in idx]
                    segs.append("M " + " L ".join(f"{a:.0f} {b:.0f}" for a, b in q))
                run = []
    return " ".join(segs)


# ----------------------------------------------------------------- extra defs
EXTRA = (
    '<linearGradient id="chestG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a343f"/><stop offset="1" stop-color="#1e1f2a"/></linearGradient>'
    '<linearGradient id="muscD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a7480"/><stop offset="1" stop-color="#4f414b"/></linearGradient>'
    '<linearGradient id="fadeB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c2127" stop-opacity="0"/><stop offset=".55" stop-color="#0b1f25" stop-opacity=".94"/><stop offset="1" stop-color="#0a1b21"/></linearGradient>'
)


def make():
    sc = Scene()
    sc.extra_defs = EXTRA
    backdrop(sc)
    X = lambda u: SX + u

    # --- context: soft torso silhouette, chest wall, ribs, spine --------------------
    skin = lp([("M", -SX, 440), ("L", -SX, 160), ("C", -SX, 128, -170, 112, -120, 102),
               ("C", -80, 92, -40, 82, -22, 56), ("L", 22, 56), ("C", 40, 82, 90, 92, 150, 102),
               ("C", 215, 113, 258, 128, 266, 175), ("L", 268, 440), ("Z",)])
    sc.add(path(skin, "url(#skinF)", "none", 1), [(0, S(0.8, SX, 0))])
    cw = [("M", 10, 118)] + [("L",) + rib_end(k) for k in range(1, 11)] + [("L", 238, 440), ("L", 10, 440), ("Z",)]
    sc.add(path(lp(cw), "url(#chestG)", "none", 1), [(0, S(1, SX, 0))])
    LW = 0.72
    cwl = [("M", -10, 118)] + [("L", -UE[k] * LW, rib_ys(k) + DROP[k] * 0.9) for k in range(1, 11)] + [("L", -UE[10] * LW, 440), ("L", -10, 440), ("Z",)]
    sc.add(path(lp(cwl), "url(#chestG)", "none", 1), [(0, S(0.5, SX, 0))])
    sc.add(path(" ".join(rib_path(k, -1, LW) for k in range(1, 11)), "none", "#b9ad90", 6.5), [(0, S(0.26))])

    ribs = " ".join(rib_path(k) for k in range(1, 11))
    sc.add(path(ribs, "none", BONE_LINE, 10))
    sc.add(path(ribs, "none", "url(#bone)", 7.2), [(0, S(0.92))])
    sc.add(path(ribs, "none", "#fffaf0", 1.4), [(0, S(0.5, 0, -1.8))])

    nv = 15
    stubs, bodies, ridge_ = [], [], []
    for i in range(nv):
        y = VY0 + VP * i
        stubs.append(f"M {SX-34} {y+3} h 20 v 7 h -20 z M {SX+14} {y+3} h 20 v 7 h -20 z")
        bodies.append(rr(SX - 14, y, 28, 21, 8))
        ridge_.append(f"M {SX} {y+5} L {SX} {y+16}")
    sc.add(path(" ".join(stubs), "url(#bone)", BONE_LINE, 1.5))
    sc.add(path(" ".join(bodies), "url(#boneV)", BONE_LINE, 1.6))
    sc.add(path(" ".join(ridge_), "none", "#fff7e0", 6), [(0, S(0.75))])

    # --- serratus anterior (sheet + digitations), pivot at its medial attachment ---------------------
    sd = lp(serratus_cmds(), *MPIV)
    fd = lp(fibre_cmds(), *MPIV)
    mx, my = SX + MPIV[0], MPIV[1]
    kf_m = [(500, S(0, mx, my, 0, 1)), (1100, S(1, mx, my, 0, 1)), (3200, S(1, mx, my, 0, 1)),
            (3600, S(1, mx, my, 0, 0.93)), (4100, S(1, mx, my, 0, 1))]
    sc.add(path(sd, "url(#musc)", "#7a2630", 2), kf_m)
    sc.add(path(sd, "#ffc0ac", "none", 1), [(3200, S(0, mx, my, 0, 1)), (3600, S(0.6, mx, my, 0, 0.93)), (4100, S(0, mx, my, 0, 1))])
    sc.add(path(sd, "url(#muscD)", "none", 1), [(4750, S(0, mx, my)), (5600, S(0.88, mx, my))])
    sc.add(path(fd, "none", "#8c2a36", 1.3), [(500, S(0, mx, my, 0, 1)), (1100, S(0.8, mx, my, 0, 1)), (3200, S(0.8, mx, my, 0, 1)),
                                               (3600, S(0.8, mx, my, 0, 0.93)), (4100, S(0.8, mx, my, 0, 1))])

    # --- long thoracic nerve ------------------------------------------------------------------
    r1 = P(X(32), 62).C(X(52), 62, X(70), 80, X(88), 100)
    r2 = P(X(32), 90).C(X(54), 92, X(72), 98, X(88), 100)
    r3 = P(X(32), 118).C(X(54), 116, X(72), 108, X(88), 100)
    c1 = P(X(88), 100).C(X(122), 100, X(156), 106, X(170), 134)
    c2 = P(X(170), 134).C(X(184), 158, X(200), 182, X(204), 214)
    c3 = P(X(204), 214).C(X(205), 240, X(211), 268, X(216), 298)
    c4 = P(X(216), 298).C(X(227), 330, X(232), 360, X(234), 400)
    main = " ".join(p.d for p in (c1, c2, c3, c4))
    allpts = c3.pts + c4.pts[1:]

    def near_y(y):
        return min(allpts, key=lambda p: abs(p[1] - y))
    twigs = {}
    for k in (5, 6, 7, 8):
        nx, ny = near_y(TIP[k][1] - 4)
        d = DIR[k]
        e = (nx - d[0] * 40, ny - d[1] * 40 + 2)
        twigs[k] = P(nx, ny).C(nx - d[0] * 12, ny - d[1] * 12 + 6, nx - d[0] * 26, ny - d[1] * 26 + 4, e[0], e[1])
    thin = " ".join([r1.d, r2.d, r3.d] + [t.d for t in twigs.values()])
    for l in tube(main, 6.5):
        sc.add(l, sc.appear(1200, 600))
    sc.add(path(thin, "none", GOLD_D, 4.8), sc.appear(1200, 600))
    sc.add(path(thin, "none", GOLD, 2.4), sc.appear(1200, 600))

    def chain(*lists):
        pts = list(lists[0])
        for l in lists[1:]:
            pts += l[1:]
        return pts
    ya, yb = 142, 182
    c2a = [p for p in c2.pts if p[1] <= ya]
    c2b = [p for p in c2.pts if p[1] >= yb]
    sc.route("a", chain(r1.pts, c1.pts, c2a))
    sc.route("b", chain(r2.pts, c1.pts, c2a))
    sc.route("c", chain(r3.pts, c1.pts, c2a))
    rB = chain(c2b, c3.pts, c4.pts)
    sc.route("B", rB)

    def alen(pts, upto_y):
        d = 0
        for i in range(1, len(pts)):
            if pts[i][1] > upto_y:
                break
            d += math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        return d
    totB = alen(rB, 1e9)
    tB0, tB1 = 2900, 3750
    sc.glow("a", 1900, 2650, GOLD, 4.5)
    sc.glow("b", 2000, 2750, GOLD, 4.5)
    sc.glow("c", 2100, 2850, GOLD, 4.5)
    sc.glow("B", tB0, tB1, GOLD, 5)
    for k, tw in twigs.items():
        sc.route(f"t{k}", tw)
        ts = tB0 + (tB1 - tB0) * alen(rB, tw.pts[0][1]) / totB
        sc.glow(f"t{k}", int(ts), int(ts) + 260, GOLD, 2.6)

    # --- scapula: shadow, body, ridge, edge flange ------------------------------------------------
    ox, oy = PIV
    body = lp(SCAP, ox, oy)
    ridge = lp(RIDGE, ox, oy)
    edge = lp(EDGE, ox, oy)
    T0, T1 = 5300, 6700

    kfs = [(0, scap_pose(1, 0)), (T0, scap_pose(1, 0))] + ease((T0, scap_pose(1, 0)), (T1, scap_pose(1, 1)), 4)[1:]
    sx_, sy_ = SX + PIV[0], PIV[1]
    sc.add(path(body, "#05090c", "none", 1), [(0, S(0.3, sx_ + 2, sy_ + 3, 0, 1)), (T0, S(0.3, sx_ + 2, sy_ + 3, 0, 1)),
                                               (T1, S(0.3, sx_ - 15, sy_ + 10, 7, 1.05))])
    sc.add(path(body, "#05090c", "none", 1), [(T0, S(0, sx_ + 2, sy_ + 3, 0, 1)), (T1, S(0.42, sx_ - 7, sy_ + 5, 5, 1.03))])
    sc.add(path(body, "url(#bone)", BONE_LINE, 2), kfs)
    sc.add(path(ridge, "url(#bone)", BONE_LINE, 2), kfs)
    sc.add(path(edge, "#6f6246", "none", 1), ease((T0, S(0, sx_, sy_, 0, 1)), (T1, S(0.95, sx_, sy_, WING_ROT, WING_SCALE)), 4))
    # the muscle passes deep to the scapula: faint ghost fibres on top of the bone, fading as the bone lifts away
    sc.add(path(ghost_fibres(), "none", "#b03a45", 1.6),
           [(1100, S(0, SX, 0)), (1800, S(0.4, SX, 0)), (T0, S(0.4, SX, 0)), (T1 - 400, S(0, SX, 0))])

    # faint outline of where the scapula used to lie flat (shows the displacement)
    sc.add(path(body, "none", "#cfe6e4", 1.6), [(6000, S(0, sx_, sy_, 0, 1)), (6800, S(0.5, sx_, sy_, 0, 1))])

    # --- injury mark on the nerve ----------------------------------------------------------------
    lx, ly = near_y(250)
    sc.add(circle(lx, ly, 24, RED, "none"), [(4300, S(0)), (4600, S(0.4))])
    star = []
    for i in range(16):
        rad = 19 if i % 2 == 0 else 8
        ang = math.radians(-90 + i * 22.5 + 11)
        star.append(f"{lx + rad * math.cos(ang):.1f} {ly + rad * math.sin(ang):.1f}")
    sc.add(path("M " + " L ".join(star) + " Z", "#ff5b4e", "#fff3bf", 1.8), [(4300, S(0)), (4600, S(1))])
    sc.ring(lx, ly, 4350, 900, RED, 44)
    sc.ring(lx, ly, 4900, 900, RED, 44)
    lesion_pts = [p for p in rB if p[1] >= ly]
    sc.route("D", lesion_pts)
    sc.glow("D", 4650, 4700, "#2a2220", 8)
    sc.glow("D", 4700, 4750, "#2a2220", 3.4)
    for k in twigs:
        sc.glow(f"t{k}", 4720, 4760, "#2a2220", 3.4)

    # --- emphasis: gold rim on the winged scapula, ring at the lifted inferior angle, label ----------
    sc.add(path(body, "none", GOLD, 3.2), [(6500, scap_pose(0, 1)), (7000, scap_pose(1, 1))])
    ia = wing_xy(62 + SH, 319)
    tip = wing_xy(222 + SH, 154)
    sc.ring(ia[0], ia[1], 6600, 1100, GOLD, 38)
    sc.ring(ia[0], ia[1], 6900, 900, GOLD, 38)
    sc.add(rect(424, 86, 172, 38, GOLD, "#fff3bf", 2, 19), sc.appear(6700, 300))
    sc.add(path(f"M 470 124 L {tip[0]+4:.0f} {tip[1]-6:.0f}", "none", GOLD, 2.6), sc.appear(6700, 300))

    # --- bottom fade, text ---------------------------------------------------------------------
    sc.add(rect(0, 372, 640, 68, "url(#fadeB)", "none", 1, 0))
    sc.text("Right scapula \u00b7 posterior view", 320, 30, 22, INK, "middle", -1, 1)
    sc.text("Serratus anterior", X(262), 316, 19, "#ffd9cf", "start", 1200, 500, -1, 1, 800)
    sc.text("C5\u2013C7", X(40), 52, 17, SOFT, "start", 1500, 500, 3000, 0.55, 700)
    sc.text("Long thoracic nerve", X(232), 214, 19, GOLD, "start", 2950, 500, -1, 1, 800)
    sc.text("Nerve intact: muscle holds the scapula flat", 320, 424, 17, INK, "middle", 3300, 500, 4500, 0, 700)
    sc.text("Nerve lesion: scapula is unanchored", 320, 424, 17, "#ffb4aa", "middle", 5000, 500, -1, 1, 700)
    sc.text("Winged scapula", 510, 112, 19, "#3b2b05", "middle", 6780, 300, -1, 1, 800)
    return sc.build(QID, TAKEAWAY)


if __name__ == "__main__":
    print(len(json.dumps(make())))
