import sys, math
sys.path.insert(0, __file__.rsplit("/scenes/", 1)[0])
from kit import *

QID = "Q000009328"
TAKEAWAY = ("The radial nerve winds around the humeral shaft in the spiral groove; a diaphyseal "
            "fracture can injure it and paralyse wrist extension, causing wrist drop.")

# ---------------------------------------------------------------- design space -> stage
SC, OX, OY = 1.28, -60.0, -18.0          # design coords (x,y) -> stage (SC*x+OX, SC*y+OY)


def T(p):
    return (round(SC * p[0] + OX, 1), round(SC * p[1] + OY, 1))


def G(st):
    d = dict(st)
    d["x"] = round(OX + SC * st.get("x", 0), 2)
    d["y"] = round(OY + SC * st.get("y", 0), 2)
    d["scale"] = SC
    return d


# ---------------------------------------------------------------- small geometry toolkit
def g(v):
    r = ("%.1f" % v).rstrip("0").rstrip(".")
    return "0" if r in ("-0", "") else r


def crb(pts, closed=False):
    """Catmull-Rom knots -> cubic segments (p1,c1,c2,p2)."""
    n = len(pts)
    out = []
    for i in range(n if closed else n - 1):
        p0 = pts[(i - 1) % n] if (closed or i > 0) else pts[i]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append((p1, c1, c2, p2))
    return out


def sd(segs):
    return "".join(" C " + " ".join(g(v) for v in (c1 + c2 + p2)) for p1, c1, c2, p2 in segs)


def mpath(p0, segs):
    return "M %s %s" % (g(p0[0]), g(p0[1])) + sd(segs)


def poly(pts, close=False):
    return "M " + " L ".join("%s %s" % (g(p[0]), g(p[1])) for p in pts) + (" Z" if close else "")


def samp(segs, n=8):
    pts = []
    for k, (p0, c1, c2, p3) in enumerate(segs):
        for i in range(0 if k == 0 else 1, n + 1):
            u = i / n
            a, b, c, d = (1 - u) ** 3, 3 * (1 - u) ** 2 * u, 3 * (1 - u) * u ** 2, u ** 3
            pts.append((a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
                        a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]))
    return pts


def offset_poly(pts, w, taper=0.0):
    L, R = [], []
    for i, (x, y) in enumerate(pts):
        u = i / max(len(pts) - 1, 1)
        wi = w * (taper + (1 - taper) * math.sin(math.pi * u) ** 0.6) if taper >= 0 else w
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n
        L.append((x + nx * wi / 2, y + ny * wi / 2))
        R.append((x - nx * wi / 2, y - ny * wi / 2))
    return poly(L + R[::-1], True)


def capsule(p1, p2, r):
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n * r, dx / n * r
    f = lambda x, y: "%d %d" % (round(x), round(y))
    r = round(r, 1)
    return ("M %s L %s A %g %g 0 0 0 %s L %s A %g %g 0 0 0 %s Z" % (
        f(p1[0] + nx, p1[1] + ny), f(p2[0] + nx, p2[1] + ny), r, r,
        f(p2[0] - nx, p2[1] - ny), f(p1[0] - nx, p1[1] - ny), r, r, f(p1[0] + nx, p1[1] + ny)))


def blob(cx, cy, r):
    r = round(r)
    return "M %d %d a %d %d 0 1 0 %d 0 a %d %d 0 1 0 %d 0 Z" % (round(cx) - r, round(cy), r, r, 2 * r, r, r, -2 * r)


def piv(px, py, deg, dx=0.0, dy=0.0):
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return px - (c * px - s * py) + dx, py - (s * px + c * py) + dy


def SP(o, px, py, deg, dx=0.0, dy=0.0):
    x, y = piv(px, py, deg, dx, dy)
    return S(o, round(x, 2), round(y, 2), round(deg, 3))


# forearm frame: a along the forearm, b toward the radial (dorsal / top) side
THD = -12.0
TH = math.radians(THD)
E0 = (230.0, 264.0)


def fw(a, b):
    return (E0[0] + a * math.cos(TH) + b * math.sin(TH), E0[1] + a * math.sin(TH) - b * math.cos(TH))


WR = fw(166, 0)
TF = 4400                      # fracture instant (ms)


def make():
    sc = Scene()

    def add(layer, kfs=None):
        """add a layer authored in design space (scaled to the stage)."""
        if kfs is None:
            kfs = [(0, S(1))]
        sc.add(layer, [(t, G(s)) for t, s in kfs])

    backdrop(sc)
    sc.extra_defs = (
        '<radialGradient id="spot" cx=".42" cy=".5" r=".62"><stop offset="0" stop-color="#2f6a72" stop-opacity=".55"/>'
        '<stop offset="1" stop-color="#2f6a72" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="hum" gradientUnits="userSpaceOnUse" x1="190" y1="0" x2="250" y2="0">'
        '<stop offset="0" stop-color="#a99870"/><stop offset=".2" stop-color="#d6c9a2"/>'
        '<stop offset=".45" stop-color="#faf4e2"/><stop offset=".72" stop-color="#d9cca6"/>'
        '<stop offset="1" stop-color="#9c8a62"/></linearGradient>'
        '<linearGradient id="scapG" gradientUnits="userSpaceOnUse" x1="96" y1="0" x2="176" y2="0">'
        '<stop offset="0" stop-color="#bfae88" stop-opacity="0"/><stop offset="1" stop-color="#e9dfc2" stop-opacity=".8"/></linearGradient>'
        '<linearGradient id="rootG" gradientUnits="userSpaceOnUse" x1="62" y1="0" x2="86" y2="0">'
        '<stop offset="0" stop-color="#f3c04c" stop-opacity="0"/><stop offset="1" stop-color="#f3c04c" stop-opacity=".85"/></linearGradient>'
    )
    sc.add(rect(0, 0, 640, 440, "url(#spot)", "none", 3, 0))

    # ------------------------------------------------------------- context: shoulder blade + brachial plexus roots
    scap = ("M 108 104 L 160 86 C 176 78 192 66 210 62 C 220 60 224 70 214 76 C 200 78 188 84 176 94 L 114 124 Z "
            "M 104 112 C 124 104 152 108 170 122 L 178 134 C 174 148 162 162 150 176 L 134 200 "
            "C 124 208 110 206 106 196 C 98 170 96 140 104 112 Z")
    add(path(scap, "url(#scapG)", "none", 1))
    roots = "M 62 126 C 74 132 80 148 86 160 M 62 160 L 86 160 M 62 194 C 74 188 80 172 86 160 M 62 142 C 72 146 80 154 86 160"
    add(path(roots, "none", "url(#rootG)", 2.4))

    # ------------------------------------------------------------- forearm (extensor side)
    def spindle(a0, a1, b0, b1, hmax, n=5):
        top, bot = [], []
        for i in range(n + 1):
            u = i / n
            h = hmax * math.sin(math.pi * (u ** 0.62)) ** 0.9
            a = a0 + (a1 - a0) * u
            b = b0 + (b1 - b0) * u
            top.append(fw(a, b + h))
            bot.append(fw(a, b - h))
        pl = top + bot[::-1]
        return mpath(pl[0], crb(pl, closed=True)) + " Z"

    def fibres(a0, a1, b0, b1, hmax, fr=(-.55, 0, .55), n=7):
        ds = []
        for f in fr:
            pts = []
            for i in range(1, n):
                u = i / n
                h = hmax * math.sin(math.pi * (u ** 0.62)) ** 0.9
                pts.append(fw(a0 + (a1 - a0) * u, b0 + (b1 - b0) * u + f * h))
            ds.append(poly(pts))
        return " ".join(ds)

    SP_TOP = (8, 128, 22, 12, 16)
    SP_MID = (14, 140, 4, 3, 19)
    SP_LOW = (6, 132, -16, -9, 13)
    sps = [SP_TOP, SP_MID, SP_LOW]

    rad_top = [fw(8, 24), fw(22, 21), fw(60, 17), fw(110, 14.5), fw(148, 15), fw(164, 19), fw(174, 15)]
    rad_bot = [fw(174, 6), fw(160, 3), fw(148, 6.5), fw(110, 8), fw(60, 10.5), fw(22, 12.5), fw(8, 15)]
    uln_top = [fw(10, -4), fw(16, -6), fw(40, -8.5), fw(100, -9), fw(150, -9), fw(168, -10), fw(176, -9)]
    uln_bot = [fw(176, -18), fw(164, -20), fw(100, -17), fw(40, -18), fw(20, -18), fw(10, -14)]
    bones_d = ""
    for pl in (rad_top + rad_bot, uln_top + uln_bot):
        bones_d += mpath(pl[0], crb(pl, closed=True)) + " Z "
    add(path(bones_d, "url(#boneV)", BONE_LINE, 1.4))

    musc_d = " ".join(spindle(*s) for s in sps)
    add(path(musc_d, "url(#musc)", "#7d2a30", 1.3))
    add(path(" ".join(fibres(*s) for s in sps), "none", "#8d2f33", 1.0), [(0, S(0.75))])
    tend = []
    for sp, tb in ((SP_TOP, 11), (SP_MID, 3), (SP_LOW, -6)):
        p0 = fw(sp[1] - 4, sp[3])
        p1 = fw(166, tb)
        pm = fw((sp[1] + 166) / 2, (sp[3] + tb) / 2)
        tend.append(poly([p0, pm, p1]))
    add(path(" ".join(tend), "none", "#dccfa6", 1.9))

    # muscles light up when the signal arrives / go limp when it is lost
    add(path(musc_d, "#ffb070", "none", 1),
        [(3250, S(0)), (3600, S(0.55)), (4350, S(0.55)), (4700, S(0))])
    add(path(musc_d, "url(#muscP)", "none", 1), [(6000, S(0)), (6800, S(0.8))])

    # ------------------------------------------------------------- hand (local frame, wrist at origin)
    k = 0.9
    P_ = lambda x, y: (x * k, y * k)
    caps = []
    for (a, b, r) in (((16, -17), (40, -32), 5), ((26, -12), (68, -17), 5), ((28, -2), (72, -5), 5),
                      ((28, 8), (68, 9), 4.8), ((26, 17), (58, 24), 4.4)):
        caps.append(capsule(P_(*a), P_(*b), r * k))
    fing = [
        [((42, -33), (60, -42), 4.6), ((61, -43), (76, -51), 4.0)],
        [((69, -17.5), (93, -20), 4.5), ((94, -20.2), (110, -22), 4.0), ((111, -22.2), (123, -23.5), 3.6)],
        [((73, -5.3), (99, -6), 4.6), ((100, -6.1), (118, -6.6), 4.1), ((119, -6.7), (133, -7), 3.7)],
        [((69, 9.5), (93, 11.5), 4.4), ((94, 11.7), (110, 13), 3.9), ((111, 13.2), (123, 14.5), 3.5)],
        [((59, 24.5), (76, 28.5), 3.9), ((77, 28.8), (88, 31.5), 3.5), ((89, 31.8), (99, 34), 3.2)],
    ]
    for f in fing:
        for (a, b, r) in f:
            caps.append(capsule(P_(*a), P_(*b), r * k))
    carp = [blob(*P_(8, -10), 7), blob(*P_(9, 0), 7), blob(*P_(9, 10), 7),
            blob(*P_(20, -12), 6.5), blob(*P_(21, -2), 6.8), blob(*P_(21, 8), 6.5)]
    hand_d = " ".join(carp + caps)

    wx, wy = round(WR[0], 2), round(WR[1], 2)
    H0 = S(1, wx, wy, THD)
    Hex = S(1, wx, wy, THD - 26)
    Hdr = S(1, wx, wy, THD + 60)
    Hov = S(1, wx, wy, THD + 66)
    hkf = [(0, H0), (3450, H0)] + ease((3450, H0), (4050, Hex), 3)[1:] + [(5900, Hex)] \
        + ease((5900, Hex), (6900, Hov), 4)[1:] + [(7400, Hdr)]
    add(path(hand_d, "url(#boneV)", BONE_LINE, 1.2), hkf)

    # ------------------------------------------------------------- nerve centreline
    N = [(84, 160), (110, 158), (138, 157), (166, 157), (186, 157.5),          # 0..4 outside the bone
         (205, 160.5),                                                         # 5 tucked under the left rim
         (213, 168), (221, 175), (232, 191), (243, 207),                       # 6..9 groove crossing (7 = break)
         (251, 218), (263, 225), fw(52, 25), fw(78, 22), fw(100, 17), fw(118, 12)]   # 10..15 lateral border / forearm
    NS = crb(N)
    add(tube(mpath(N[0], NS[:5]), 7))                     # behind the bone

    # ------------------------------------------------------------- humerus
    hp = [(196, 60), (216, 64), (234, 74), (248, 88), (252, 102), (246, 116), (238, 128), (237, 140),
          (240, 150), (241, 170), (242, 185), (243, 204), (246, 224), (252, 240), (259, 252), (258, 263),
          (250, 272), (243, 279), (235, 282), (228, 277), (220, 283), (209, 283), (200, 277), (193, 268),
          (191, 257), (197, 245), (201, 228), (202, 200), (201, 180), (200, 160), (198, 142), (193, 130),
          (180, 121), (166, 110), (159, 94), (164, 76), (178, 64)]
    IR, IL = hp.index((240, 150)), hp.index((202, 200))
    HS = crb(hp, closed=True)
    hum_d = mpath(hp[0], HS) + " Z"
    cutL, cutR = hp[IL], hp[IR]
    dx, dy = cutR[0] - cutL[0], cutR[1] - cutL[1]
    ln = math.hypot(dx, dy)
    px, py = -dy / ln, dx / ln
    offs = [0, 5, -5.5, 5.5, -5.5, 5.5, -5.5, 5.5, -5, 0]
    zz = [(cutL[0] + dx * i / 9 + px * offs[i], cutL[1] + dy * i / 9 + py * offs[i]) for i in range(10)]
    zl = " ".join("L %s %s" % (g(p[0]), g(p[1])) for p in zz[1:])
    zr = " ".join("L %s %s" % (g(p[0]), g(p[1])) for p in zz[-2::-1])
    prox_d = mpath(hp[0], HS[:IR]) + " " + zr + sd(HS[IL:]) + " Z"
    dist_d = "M %s %s " % (g(cutL[0]), g(cutL[1])) + zl + sd(HS[IR:IL]) + " Z"
    add(path(hum_d, "url(#hum)", BONE_LINE, 2), [(0, S(1)), (TF, S(1)), (TF + 10, S(0))])
    add(path(prox_d, "url(#hum)", BONE_LINE, 2), [(TF, S(1))])
    dpv = (230, 272)
    D0 = SP(1, dpv[0], dpv[1], 0)
    Dpk = SP(1, dpv[0], dpv[1], 7.5, 3, 10)
    Dfin = SP(1, dpv[0], dpv[1], 6, 2, 8)
    dkf = [(TF, D0), (TF + 130, Dpk), (TF + 520, Dfin)]
    add(path(dist_d, "url(#hum)", BONE_LINE, 2), dkf)

    # shading: neck crescent, head highlight, groove band (proximal static / distal moves with the fragment)
    add(path("M 168 108 C 184 124 214 126 240 124 L 240 130 C 214 134 182 132 166 114 Z", "#4a3d20", "none", 1),
        [(0, S(0.4))])
    add(path("M 170 96 C 170 80 180 68 196 64", "none", "#ffffff", 3.6), [(0, S(0.4))])
    add(path(offset_poly(samp(NS[5:8], 5), 18, 0.25), "#4a3d20", "none", 1), [(0, S(0.45))])
    gkf = [(0, SP(0.45, dpv[0], dpv[1], 0)), (TF, SP(0.45, dpv[0], dpv[1], 0)),
           (TF + 130, SP(0.45, dpv[0], dpv[1], 7.5, 3, 10)), (TF + 520, SP(0.45, dpv[0], dpv[1], 6, 2, 8))]
    add(path(offset_poly(samp(NS[7:9], 6), 18, 0.2), "#4a3d20", "none", 1), gkf)

    # haematoma filling the opened gap between the fragments
    cw, sw_ = math.cos(math.radians(6)), math.sin(math.radians(6))
    fx, fy = piv(dpv[0], dpv[1], 6, 2, 8)
    moved = [(cw * q[0] - sw_ * q[1] + fx, sw_ * q[0] + cw * q[1] + fy) for q in zz]
    quads = " ".join(poly([zz[i], zz[i + 1], moved[i + 1], moved[i]], True) for i in range(len(zz) - 1))
    add(path(quads, "#8a1c26", "none", 1), [(TF + 250, S(0)), (TF + 800, S(0.85))])

    # ------------------------------------------------------------- nerve in front of the bone
    add(tube(mpath(N[5], NS[5:]), 7))
    br = []
    for (a, b, a2, b2) in ((50, 24, 66, 10), (70, 22, 92, 6), (88, 20, 110, 2), (96, 17, 126, -8), (40, 26, 56, 17)):
        p0, p1 = fw(a, b), fw(a2, b2)
        pm = fw((a + a2) / 2, (b + b2) / 2 + 3)
        br.append("M %s %s Q %s %s %s %s" % tuple(g(v) for v in (p0 + pm + p1)))
    add(path(" ".join(br), "none", GOLD, 2.2))

    # ------------------------------------------------------------- signal
    pr = [T(p) for p in samp(NS[:7], 9)]
    sc.route("p", pr)
    sc.glow("p", 1500, 2450, GOLD, 6)
    sc.glow("p", 4950, 5850, GOLD, 6)

    d1 = samp(NS[7:10], 8)
    d2 = samp(NS[10:], 8)
    add(path(poly(d1), "none", "#fff7d0", 3.6), [(2450, S(0)), (2800, S(1)), (4300, S(1)), (4500, S(0))])
    add(path(poly(d2), "none", "#fff7d0", 3.6), [(2800, S(0)), (3300, S(1)), (4300, S(1)), (4500, S(0))])
    way = [N[7], N[9], N[11], N[13], N[15]]
    tms = [2450, 2800, 3000, 3250, 3500]
    kf = [(tms[0], S(0, *way[0])), (tms[0] + 120, S(1, *way[0]))]
    for t, pnt in zip(tms[1:], way[1:]):
        kf.append((t, S(1, round(pnt[0], 1), round(pnt[1], 1))))
    kf.append((tms[-1] + 160, S(0, *way[-1])))
    add(circle(0, 0, 11, "url(#glowR)"), kf)

    # lateral rim of the shaft rolls over the nerve (nerve wraps round the lateral border)
    ie = hp.index((242, 185))
    edge = [q for q in samp(HS[ie:ie + 2], 10) if 194 <= q[1] <= 220]
    m = len(edge)
    inner = [(q[0] - 9 * math.sin(math.pi * i / (m - 1)), q[1]) for i, q in enumerate(edge)]
    rim = poly(edge + inner[::-1], True)
    add(path(rim, "url(#hum)", BONE_LINE, 1.6), [(0, D0), (TF, D0), (TF + 130, Dpk), (TF + 520, Dfin)])

    il_ = hp.index((201, 180))
    ledge = [q for q in samp(HS[il_:il_ + 2], 10) if 146 <= q[1] <= 172]
    ml = len(ledge)
    linner = [(q[0] + 9 * math.sin(math.pi * i / (ml - 1)), q[1]) for i, q in enumerate(ledge)]
    add(path(poly(ledge + linner[::-1], True), "url(#hum)", BONE_LINE, 1.6))

    # ------------------------------------------------------------- injury at the break
    bx, by = N[7]
    cont = [q for q in samp(NS[6:8], 8) if math.hypot(q[0] - bx, q[1] - by) <= 15]
    add(path(poly(cont), "none", RED, 8.5), [(TF + 120, S(0)), (TF + 450, S(0.85))])
    rays = []
    for i in range(10):
        ang = math.radians(36 * i + 10)
        r1, r2 = 13, (24 if i % 2 == 0 else 19)
        rays.append("M %s %s L %s %s" % (g(bx + r1 * math.cos(ang)), g(by + r1 * math.sin(ang)),
                                         g(bx + r2 * math.cos(ang)), g(by + r2 * math.sin(ang))))
    add(path(" ".join(rays), "none", "#fff1d0", 2.4), [(TF, S(0)), (TF + 100, S(1)), (TF + 650, S(0))])
    bwx, bwy = T((bx, by))
    sc.ring(bwx, bwy, TF, 800, "#ffffff", 52)
    sc.ring(bwx, bwy, TF + 140, 1100, RED, 66)
    sc.ring(bwx, bwy, 5850, 1000, RED, 56)
    sc.ring(bwx, bwy, 6300, 1000, RED, 56)
    sc.ring(bwx, bwy, 6950, 1100, GOLD, 50)
    sc.ring(bwx, bwy, 7400, 1100, GOLD, 50)

    # leader to the groove
    add(path("M 182 207 L 210 168 M 213 168 a 3 3 0 1 0 -6 0 a 3 3 0 1 0 6 0", SOFT, SOFT, 1.5),
        [(900, S(0)), (1400, S(1))])
    # droop arc + arrowhead
    ar = []
    r0 = 128
    a_start, a_end = THD - 30, THD + 62
    for i in range(0, 16):
        ang = math.radians(a_start + (a_end - a_start) * i / 15)
        ar.append((WR[0] + r0 * math.cos(ang), WR[1] + r0 * math.sin(ang)))
    te = math.radians(a_end)
    tip = (WR[0] + r0 * math.cos(te), WR[1] + r0 * math.sin(te))
    tx, ty = -math.sin(te), math.cos(te)       # clockwise tangent
    nx_, ny_ = math.cos(te), math.sin(te)
    tip2 = (tip[0] + tx * 16, tip[1] + ty * 16)
    hd1 = (tip2[0] - tx * 14 - nx_ * 9, tip2[1] - ty * 14 - ny_ * 9)
    hd2 = (tip2[0] - tx * 14 + nx_ * 9, tip2[1] - ty * 14 + ny_ * 9)
    add(path(poly(ar) + " " + poly([hd1, tip2, hd2]), "none", "#ff8a7a", 2.6), [(6000, S(0)), (6700, S(0.8))])

    # ------------------------------------------------------------- text (stage coordinates)
    sc.text("Humeral shaft fracture", 24, 38, 24, INK, "start", -1, 1)
    sc.text("Spiral groove", 172, 256, 20, SOFT, "end", 900, 500, -1, 1, 700)
    sc.text("Radial nerve", 292, 236, 21, GOLD, "start", 2000, 500, -1, 1, 800)
    sc.text("Wrist drop", 318, 386, 24, "#ff8a7a", "start", 6300, 500, -1, 1, 800)
    return sc.build(QID, TAKEAWAY)


if __name__ == "__main__":
    print(len(json.dumps(make())))
