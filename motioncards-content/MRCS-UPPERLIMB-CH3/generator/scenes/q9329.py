import sys, math, re
sys.path.insert(0, __file__.rsplit("/scenes/", 1)[0])
from kit import *

QID = "Q000009329"
TAKEAWAY = ("Flexor carpi ulnaris (with the medial half of flexor digitorum profundus) is supplied by the "
            "ulnar nerve; the other anterior forearm muscles listed are median-supplied.")

KY, CY0 = 1.3, 252.0       # vertical stretch of the whole drawing (about the forearm axis y=242)
PX, PY = 402, 242          # wrist pivot in design coordinates (hand rotates about this point)
DEV = 11                    # ulnar deviation, degrees (clockwise on screen = towards the little finger)
MC_CYAN = "#5fd0d6"
CY_D = "#0d4a50"
CY_L = "#d8fbfd"
TENDON = "#f1e5c0"


# ------------------------------------------------------------------ helpers
def YT(y):
    return CY0 + (y - 242.0) * KY


def f1(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def pt(x, y):
    return f"{f1(x)} {f1(y)}"


_NUM = re.compile(r"(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)")


def tf(d):
    """apply YT to every absolute 'x y' pair of an M/L/C/Q path string."""
    return _NUM.sub(lambda m: f"{m.group(1)} {f1(YT(float(m.group(2))))}", d)


def bzp(p, u):
    a = (1 - u) ** 3
    b = 3 * (1 - u) ** 2 * u
    c = 3 * (1 - u) * u ** 2
    d = u ** 3
    return (a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0],
            a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1])


def bzd(p, u):
    a = 3 * (1 - u) ** 2
    b = 6 * (1 - u) * u
    c = 3 * u ** 2
    return (a * (p[1][0] - p[0][0]) + b * (p[2][0] - p[1][0]) + c * (p[3][0] - p[2][0]),
            a * (p[1][1] - p[0][1]) + b * (p[2][1] - p[1][1]) + c * (p[3][1] - p[2][1]))


class Spindle:
    """A muscle belly: bezier centre line + width profile -> outline / fibres / highlight (design coords)."""

    def __init__(self, p0, p1, p2, p3, wmax, a=0.7, wmin=2.5, expo=0.85):
        self.p = (p0, p1, p2, p3)
        self.wmax, self.a, self.wmin, self.expo = wmax, a, wmin, expo

    def w(self, u):
        return self.wmin + (self.wmax - self.wmin) * max(0.0, math.sin(math.pi * (u ** self.a))) ** self.expo

    def at(self, u, f=0.0):
        x, y = bzp(self.p, u)
        dx, dy = bzd(self.p, u)
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        w = self.w(u)
        return (x + nx * w * f, YT(y + ny * w * f))

    def outline(self, n=16):
        top = [self.at(i / n, -1) for i in range(n + 1)]
        bot = [self.at(i / n, 1) for i in range(n, -1, -1)]
        return "M " + " L ".join(pt(*q) for q in top + bot) + " Z"

    def line(self, f, n=6, u0=0.1, u1=0.9):
        q = [self.at(u0 + (u1 - u0) * i / n, f) for i in range(n + 1)]
        return "M " + " L ".join(pt(*z) for z in q)

    def fibres(self, fs=(-0.62, -0.3, 0.0, 0.3, 0.62), n=6, u0=0.1, u1=0.9):
        return " ".join(self.line(f, n, u0, u1) for f in fs)

    def mid(self, n=10, u0=0.0, u1=1.0):
        return [self.at(u0 + (u1 - u0) * i / n, 0) for i in range(n + 1)]


class Pen:
    """path builder writing coordinates relative to a pivot (for layers that rotate about the wrist)."""

    def __init__(self, ox, oy):
        self.ox, self.oy, self.d = ox, YT(oy), []

    def _p(self, x, y):
        return pt(x - self.ox, YT(y) - self.oy)

    def M(self, x, y):
        self.d.append("M " + self._p(x, y)); return self

    def L(self, x, y):
        self.d.append("L " + self._p(x, y)); return self

    def C(self, a, b, c, d, e, f):
        self.d.append("C " + " ".join((self._p(a, b), self._p(c, d), self._p(e, f)))); return self

    def Q(self, a, b, c, d):
        self.d.append("Q " + self._p(a, b) + " " + self._p(c, d)); return self

    def Z(self):
        self.d.append("Z"); return self

    def __str__(self):
        return " ".join(self.d)


def bar(pen, p, q, w0, w1):
    """tapered bone with rounded ends (one quadratic cap per end)."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    L = math.hypot(dx, dy) or 1
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    k = 2.0
    pen.M(p[0] + nx * w0, p[1] + ny * w0)
    pen.L(q[0] + nx * w1, q[1] + ny * w1)
    pen.Q(q[0] + ux * w1 * k, q[1] + uy * w1 * k, q[0] - nx * w1, q[1] - ny * w1)
    pen.L(p[0] - nx * w0, p[1] - ny * w0)
    pen.Q(p[0] - ux * w0 * k, p[1] - uy * w0 * k, p[0] + nx * w0, p[1] + ny * w0)
    pen.Z()


def lerp2(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def nerve(x0, y0, segs):
    """kit.P path through bezier segments given in design coordinates."""
    p = P(x0, YT(y0))
    for (a, b, c, d, e, f) in segs:
        p.C(a, YT(b), c, YT(d), e, YT(f))
    return p


# ------------------------------------------------------------------ scene
def make():
    sc = Scene()
    backdrop(sc)

    sc.extra_defs = (
        '<linearGradient id="skW" gradientUnits="userSpaceOnUse" x1="0" y1="130" x2="0" y2="380">'
        '<stop offset="0" stop-color="#527880"/><stop offset="1" stop-color="#2f4f58"/></linearGradient>'
        '<linearGradient id="skH" gradientUnits="userSpaceOnUse" x1="0" y1="-122" x2="0" y2="128">'
        '<stop offset="0" stop-color="#527880"/><stop offset="1" stop-color="#2f4f58"/></linearGradient>'
        '<linearGradient id="muscD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cf6a62"/>'
        '<stop offset="1" stop-color="#8a2f37"/></linearGradient>'
        '<linearGradient id="muscHot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffbe72"/>'
        '<stop offset=".5" stop-color="#ff8a4c"/><stop offset="1" stop-color="#d9482f"/></linearGradient>'
        '<linearGradient id="cyT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4cc3d0" stop-opacity=".9"/>'
        '<stop offset="1" stop-color="#1f7686" stop-opacity=".9"/></linearGradient>'
    )

    # ===================================================== forearm skin + hand skin (static / rotating)
    skin = "M 0 160 C 120 166 262 186 414 206 L 414 279 C 272 303 120 326 0 330 Z"
    sc.add(path(tf(skin), "url(#skW)", "#6a9ca5", 1.6))

    def rot_kfs(first=None, o=1):
        rest = S(o, PX, YT(PY), 0)
        a = [(0, rest)] if first is None else first
        a += [(3500, rest), (3750, S(o, PX, YT(PY), 1.4)), (4250, S(o, PX, YT(PY), DEV * 0.86)),
              (4550, S(o, PX, YT(PY), DEV))]
        return a

    O = (PX, PY)
    hp = Pen(*O)
    hp.M(372, 206).L(398, 205).C(420, 193, 456, 194, 482, 202).L(500, 205).L(500, 283)
    hp.C(470, 296, 432, 294, 398, 278).L(372, 279).Z()
    hp.M(410, 205).C(436, 190, 468, 180, 494, 175).Q(510, 171, 509, 183).C(505, 194, 490, 202, 476, 210).L(430, 224).Z()
    fingers = [(214, (594, 207)), (235, (608, 237)), (256, (600, 264)), (275, (578, 292))]
    for by, (tx, ty) in fingers:
        hw0 = 9.5 if by < 270 else 8.5
        hw1 = 7 if by < 270 else 6
        hp.M(494, by - hw0).L(tx, ty - hw1).Q(tx + hw1 * 1.4, ty, tx, ty + hw1).L(494, by + hw0).Z()
    sc.add(path(str(hp), "url(#skH)", "none", 1), rot_kfs())

    # ===================================================== bones (faint)
    hum = ("M 0 212 L 36 214 C 50 214 56 202 66 196 C 72 192 80 193 83 200 C 86 207 94 205 104 208 "
           "C 116 214 116 232 106 240 C 114 248 114 262 106 270 C 100 278 95 282 92 289 C 90 299 74 303 66 296 "
           "C 58 290 48 270 36 268 L 0 272 Z")
    sc.add(path(tf(hum), "url(#bone)", BONE_LINE, 1.5), [(0, S(0.42))])

    radius = ("M 122 210 C 131 208 134 212 137 217 C 160 214 205 217 250 222 C 300 228 345 220 374 212 "
              "L 391 207 Q 399 207 400 216 L 399 246 L 374 250 C 345 246 300 240 250 237 C 205 234 160 231 137 230 "
              "C 134 236 131 240 122 239 C 113 239 113 210 122 210 Z")
    ulna = ("M 112 263 C 112 252 124 250 136 254 C 160 259 200 263 250 265 C 300 267 350 267 384 265 "
            "Q 394 262 399 268 Q 403 274 396 279 L 380 279 C 340 277 300 277 250 277 C 200 277 150 286 136 296 "
            "C 126 305 111 302 108 290 C 106 280 108 270 112 263 Z")
    sc.add(path(tf(radius + " " + ulna), "url(#bone)", BONE_LINE, 1.5), [(0, S(0.42))])

    bp = Pen(*O)
    pts = [(406, 228), (414, 221), (430, 222), (443, 229), (445, 246), (440, 259), (424, 265), (410, 262), (405, 250)]
    bp.M(*pts[0])
    for q in pts[1:]:
        bp.L(*q)
    bp.Z()
    bp.M(419, 222).L(421, 264).M(406, 243).L(444, 241)
    mcs = [((430, 214), (463, 199), 4.4, 3.6), ((446, 229), (497, 215), 4.4, 3.6), ((446, 241), (497, 235), 4.4, 3.6),
           ((446, 251), (497, 256), 4.4, 3.6), ((444, 259), (494, 275), 4.0, 3.4)]
    for p, q, w0, w1 in mcs:
        bar(bp, p, q, w0, w1)
    bases = [(500, 214), (500, 235), (500, 256), (498, 275)]
    tips = [(588, 207), (602, 237), (594, 264), (574, 289)]
    for b0, t0 in zip(bases, tips):
        for (a0, a1, w0, w1) in ((0.03, 0.40, 3.3, 2.9), (0.45, 0.70, 2.9, 2.5), (0.75, 1.0, 2.5, 2.0)):
            bar(bp, lerp2(b0, t0, a0), lerp2(b0, t0, a1), w0, w1)
    bar(bp, (468, 198), (486, 189), 3.6, 3.0)
    bar(bp, (490, 186), (504, 180), 3.0, 2.4)
    sc.add(path(str(bp), "url(#bone)", BONE_LINE, 1.1), rot_kfs(o=0.72))

    # ===================================================== muscles (fade in together 0.6-1.3 s)
    T0, TF = 600, 700
    ap = lambda: sc.appear(T0, TF)
    fade = lambda o: [(T0, S(0)), (T0 + TF, S(o))]

    BR = Spindle((20, 184), (140, 185), (250, 198), (375, 212), 12, 0.55, 3)
    PT = Spindle((92, 282), (125, 248), (190, 212), (252, 200), 16, 0.6, 3)
    FCR = Spindle((100, 280), (140, 244), (215, 236), (318, 229), 15, 0.55, 2.5)
    PL = Spindle((108, 278), (140, 266), (195, 262), (235, 255), 10, 0.6, 2)
    FDS = Spindle((120, 274), (175, 278), (250, 276), (332, 258), 21, 0.66, 3)
    FCU = Spindle((88, 300), (150, 302), (240, 294), (312, 279), 14, 0.62, 3)
    FCUh = Spindle((88, 300), (150, 299), (240, 290), (312, 279), 21, 0.58, 3)

    MUS_LINE = "#6b2a30"
    sc.add(path(BR.outline(), "url(#muscP)", "#3a2630", 1.3), fade(0.66))
    tint = lambda m: sc.add(path(m.outline(), "url(#cyT)", "#a9eef2", 1.3), [(5500, S(0)), (6100, S(1))])
    sc.add(path(FDS.outline(), "url(#muscD)", MUS_LINE, 1.4), ap())
    tint(FDS)
    sc.add(path(FCU.outline(), "url(#musc)", MUS_LINE, 1.4), ap())
    sc.add(path(FDS.fibres(n=7) + " " + FCU.fibres(n=7), "none", "#7d2c33", 1.0), fade(0.6))
    for m in (FCR, PT, PL):
        sc.add(path(m.outline(), "url(#musc)", MUS_LINE, 1.4), ap())
        tint(m)
    fib = PT.fibres(fs=(-0.6, -0.2, 0.2, 0.6), n=5) + " " + FCR.fibres(fs=(-0.6, -0.2, 0.2, 0.6), n=5) + " " \
        + PL.fibres(fs=(-0.4, 0.4), n=4)
    sc.add(path(fib, "none", "#8c3138", 1.0), fade(0.55))
    hl = " ".join(m.line(-0.58, 6, 0.16, 0.82) for m in (PT, FCR, PL, FCU))
    sc.add(path(hl, "none", "#ffc7bb", 2.0), fade(0.5))
    sh = " ".join(m.line(0.8, 6, 0.14, 0.86) for m in (PT, FCR, PL, FCU))
    sc.add(path(sh, "none", "#4a151c", 3.0), fade(0.28))

    # tendons (proximal to the wrist) and their continuation into the hand
    tend = tf("M 304 233 C 335 231 370 229 404 226 "                                   # FCR
              "M 232 256 C 280 252 340 247 404 240 "                                   # PL
              "M 320 258 C 350 254 380 242 404 233 M 326 262 C 355 259 385 252 404 245 "
              "M 326 264 C 355 264 385 261 404 257 M 322 266 C 350 270 380 270 404 268 "   # FDS slips
              "M 306 280 C 340 278 375 274 410 271 "                                   # FCU
              "M 244 204 L 260 197")                                                    # PT insertion
    sc.add(path(tend, "none", TENDON, 3.0), ap())

    dp = Pen(*O)
    for (y0, y1) in ((233, 214), (245, 235), (257, 256), (268, 275)):
        dp.M(398, y0).C(430, y0, 470, (y0 + y1) / 2, 500, y1).L(540, y1 - (y1 - 214) * 0.04)
    dp.M(398, 270).C(410, 271, 420, 270, 436, 266)
    dkf = rot_kfs([(T0, S(0, PX, YT(PY), 0)), (T0 + TF, S(1, PX, YT(PY), 0))])
    sc.add(path(str(dp), "none", TENDON, 2.2), dkf)

    # ===================================================== FCU contracted (lights up, belly thickens)
    TA, TB = 3000, 3700
    sc.add(path(FCUh.outline(), "none", "#ffd37a", 9), [(TA, S(0)), (TB, S(0.38))])
    sc.add(path(FCUh.outline(), "url(#muscHot)", "#ffe9a8", 2.2), [(TA, S(0)), (TB, S(1))])
    sc.add(path(FCUh.fibres(n=7) + " " + FCUh.line(-0.62, 6, 0.16, 0.82), "none", "#a63a1c", 1.1),
           [(TA, S(0)), (TB, S(0.7))])

    # ===================================================== nerves
    med = nerve(4, 243, [(60, 244, 120, 253, 190, 258), (250, 262, 330, 262, 398, 246)])
    uln = nerve(4, 308, [(44, 311, 84, 311, 116, 299), (150, 289, 190, 282, 238, 280), (292, 278, 345, 272, 396, 265)])
    for lay in tube(med.d, 6.2, (CY_D, MC_CYAN, CY_L)):
        sc.add(lay, sc.appear(1400, 500))
    for lay in tube(uln.d, 6.2):
        sc.add(lay, sc.appear(1400, 500))

    sc.route("med", med)
    sc.route("uln", uln)
    sc.route("fcu", FCU.mid(12, 0.1, 1.0))
    sc.glow("med", 2200, 3700, MC_CYAN, 4.4)
    sc.glow("uln", 2200, 3500, GOLD, 4.4)
    sc.glow("fcu", 2650, 3500, GOLD, 3.4)
    sc.route("ten", nerve(306, 280, [(340, 278, 375, 274, 404, 272)]))
    sc.glow("ten", 3450, 3900, GOLD, 3.2)
    sc.ring(140, YT(300), 2600, 800, GOLD, 30)
    sc.ring(236, YT(292), 5300, 1000, GOLD, 42)

    # direction cue: the hand swings towards the ulnar (little-finger) side
    sc.add(path("M 625 248 C 631 262 631 278 624 294 M 616 288 L 624 295 L 631 285", "none", GOLD, 3.2),
           [(3600, S(0)), (4100, S(1))])

    # ===================================================== leaders + labels
    sc.add(rect(164, 378, 232, 36, GOLD, "#fff3bf", 2, 18), sc.appear(4900, 350))
    sc.add(path("M 262 378 L 262 326", "none", GOLD, 2), [(4900, S(1))])
    sc.add(path("M 64 386 L 64 346", "none", GOLD, 2), [(2100, S(1))])
    sc.add(path("M 40 138 L 40 250", "none", MC_CYAN, 2), [(2100, S(1))])

    sc.text("Anterior forearm, palm up", 320, 36, 24, INK, "middle", -1, 1)
    sc.text("Median nerve", 14, 128, 18, MC_CYAN, "start", 2100, 400, -1, 1, 800)
    sc.text("Ulnar nerve", 64, 403, 19, GOLD, "middle", 2100, 400, -1, 1, 800)
    sc.text("Flexor carpi ulnaris", 280, 403, 20, "#3b2b05", "middle", 5150, 350, -1, 1, 800)

    sc.text("Supplied by the median nerve", 626, 66, 18, MC_CYAN, "end", 5700, 500, -1, 1, 800)
    for i, nm in enumerate(("Pronator teres", "Flexor carpi radialis", "Palmaris longus", "Flexor digitorum superficialis")):
        sc.text(nm, 626, 88 + 19 * i, 17, MC_CYAN, "end", 5900 + 130 * i, 400, -1, 1, 600)
    return sc.build(QID, TAKEAWAY)


if __name__ == "__main__":
    d = make()
    print(len(d["layers"]), len(d["custom_renderer"]))
