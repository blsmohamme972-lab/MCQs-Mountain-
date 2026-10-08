import sys, math
sys.path.insert(0, __file__.rsplit("/scenes/", 1)[0])
from kit import *

QID = "Q000009330"
TAKEAWAY = ("The ulnar nerve passes behind the medial epicondyle; elbow dislocation can injure it, "
            "and because it supplies the interossei, finger abduction and adduction weaken.")

# ---------------------------------------------------------------------------
# Geometry is authored in a "design" frame (long forearm), then warped (forearm shaft shortened)
# and scaled onto the 640x440 stage by T().
SC = 1.30
X0 = 40.0
YC0, YC1 = 245.0, 236.0


def W(x):
    if x <= 250:
        return x
    if x <= 395:
        return 250 + (x - 250) * (45.0 / 145.0)
    return x - 100


def T(x, y):
    return (SC * (W(x) - X0), SC * (y - YC0) + YC1)


class Pth:
    def __init__(s):
        s.c = []

    def M(s, x, y):
        s.c.append(("M", [(x, y)])); return s

    def L(s, x, y):
        s.c.append(("L", [(x, y)])); return s

    def C(s, a, b, c, d, e, f):
        s.c.append(("C", [(a, b), (c, d), (e, f)])); return s

    def Q(s, a, b, c, d):
        s.c.append(("Q", [(a, b), (c, d)])); return s

    def Z(s):
        s.c.append(("Z", [])); return s

    def map(s, f):
        o = Pth()
        for k, pts in s.c:
            o.c.append((k, [f(x, y) for x, y in pts]))
        return o

    def xf(s, ang=0.0, tx=0.0, ty=0.0, sc=1.0):
        ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        return s.map(lambda x, y: ((x * ca - y * sa) * sc + tx, (x * sa + y * ca) * sc + ty))

    def __add__(s, o):
        r = Pth(); r.c = s.c + o.c; return r

    def d(s):
        out = []
        for k, pts in s.c:
            out.append(k + "".join(" %g %g" % (round(x, 1), round(y, 1)) for x, y in pts))
        return " ".join(out)


def parse(d):
    t = d.replace(",", " ").split()
    p, i, cmd = Pth(), 0, None
    n = {"M": 1, "L": 1, "C": 3, "Q": 2, "Z": 0}
    while i < len(t):
        if t[i] in n:
            cmd = t[i]; i += 1
            if cmd == "Z":
                p.c.append(("Z", [])); continue
        pts = []
        for _ in range(n[cmd]):
            pts.append((float(t[i]), float(t[i + 1]))); i += 2
        p.c.append((cmd, pts))
        if cmd == "M":
            cmd = "L"
    return p


def TP(d):
    """design path string -> stage path string"""
    return parse(d).map(T).d()


def ell(cx, cy, rx, ry, ang=0):
    k = 0.5523
    p = (Pth().M(rx, 0).C(rx, k * ry, k * rx, ry, 0, ry).C(-k * rx, ry, -rx, k * ry, -rx, 0)
         .C(-rx, -k * ry, -k * rx, -ry, 0, -ry).C(k * rx, -ry, rx, -k * ry, rx, 0).Z())
    return p.xf(ang, cx, cy)


def phal(x0, x1, w0, wm, w1):
    L_ = x1 - x0
    return (Pth().M(x0, -w0).C(x0 + .3 * L_, -wm, x1 - .3 * L_, -wm, x1, -w1)
            .C(x1 + .9 * w1, -w1, x1 + .9 * w1, w1, x1, w1)
            .C(x1 - .3 * L_, wm, x0 + .3 * L_, wm, x0, w0)
            .C(x0 - .9 * w0, w0, x0 - .9 * w0, -w0, x0, -w0).Z())


def finger(lens, we, x_start=8):
    """phalanges in a local frame: MCP joint at the origin, finger pointing +x"""
    p = Pth(); x = x_start
    for i, L_ in enumerate(lens):
        last = i == len(lens) - 1
        w1 = we * (0.76 if last else 1.0)
        p = p + phal(x, x + L_, we, we * .68, w1)
        x += L_ + .7 * (w1 + we) + 2.4
    return p, x


# ----------------------------------------------------------------------- anatomy (design frame)
WR = (432, 247)                    # wrist pivot for forearm bones
PIV_X = 528
HEAD = {"little": 200, "ring": 222, "middle": 244, "index": 266}
BASE = {"little": 212, "ring": 229, "middle": 245, "index": 261}
FING = {  # lens, half width, fan angle, limp angle
    "index": ((26, 15, 13), 5.6, 17, 4.5),
    "middle": ((29, 17, 14), 5.9, 0, 0),
    "ring": ((26, 16, 13), 5.4, -13, -4.5),
    "little": ((20, 11, 11), 4.7, -30, -10),
}

HUM = ("M 41 227 L 96 228 C 118 228 134 224 146 216 C 152 208 158 198 168 193 "
       "C 176 189 188 191 194 199 C 199 206 200 214 208 219 C 220 224 230 232 231 246 "
       "C 232 258 228 264 226 270 C 222 278 212 281 204 280 C 198 290 184 292 175 284 "
       "C 166 276 150 266 128 261 L 96 259 L 41 259 Z")
HUM_LINES = ("M 112 231 C 126 230 140 226 150 219 M 112 256 C 128 257 142 262 152 270 "
             "M 124 244 C 124 237 134 233 142 234 C 150 235 154 240 153 246 C 152 252 144 255 136 254 C 128 253 124 249 124 244 "
             "M 200 209 C 204 216 208 219 214 221 M 148 224 C 162 227 184 227 206 225")
ULNA = ("M 170 244 C 168 233 174 224 185 221 C 196 218 206 223 216 226 L 395 224 "
        "C 410 224 424 221 436 219 C 444 219 448 228 444 236 C 440 244 428 246 414 245 "
        "L 240 252 C 230 257 220 262 206 263 C 188 264 172 256 170 244 Z "
        "M 190 232 C 203 228 216 237 215 250 M 181 247 C 181 241 185 236 190 232")
GHOST_FORE = ("M 236 226 L 216 226 C 206 223 196 218 185 221 C 174 224 168 233 170 244 C 172 256 188 264 206 263 "
              "C 220 262 230 257 240 252")
RADIUS = ("M 205 270 C 204 262 214 258 226 259 C 238 260 245 264 246 270 C 247 276 256 275 270 272 "
          "L 395 257 C 410 253 424 249 440 249 C 448 251 449 268 442 273 C 428 277 410 276 395 274 "
          "L 270 283 C 256 286 240 286 228 282 C 214 280 206 276 205 270 Z "
          "M 212 268 C 212 263 220 262 228 263 C 236 264 240 267 238 271 C 236 275 226 276 218 275 C 213 274 212 271 212 268 Z")
def _skin():
    d = ("M 41 204 L 110 206 C 136 206 150 188 176 183 C 198 180 212 198 228 210 L 330 213 L 400 214 "
         "C 418 214 436 200 470 193 L 530 189 ")
    for y in (200, 222, 244, 266):
        d += "Q 546 %g 546 %g Q 546 %g 533 %g " % (y - 11, y, y + 11, y + 11)
    d += ("L 528 287 C 536 292 543 306 550 321 Q 558 330 554 336 Q 548 342 539 340 C 528 334 510 322 496 314 "
          "C 480 306 462 300 450 292 L 430 287 L 400 289 L 240 297 C 220 299 206 303 190 303 "
          "C 176 305 150 282 120 275 L 41 275 Z")
    return d


SKIN = _skin()

# nerve (one P chain so that route points can be sampled)
GR = (176, 217)
nerve = P(44, 208).C(70, 209, 90, 211, 118, 212).C(140, 213, 158, 217, GR[0], GR[1])
K_GROOVE = len(nerve.pts)
nerve.C(196, 217, 206, 220, 226, 221).C(290, 223, 350, 224, 396, 224)
nerve.C(412, 224, 426, 220, 444, 214).C(456, 210, 470, 210, 482, 214)
bus = P(482, 214).C(490, 232, 490, 262, 480, 294)


def mc_y(name, x):
    return BASE[name] + (HEAD[name] - BASE[name]) * (x - 462) / 59.0


def spindle(xa, xb, fa, fb, hmax):
    yc = lambda x: (fa(x) + fb(x)) / 2.0
    xm = (xa + xb) / 2.0
    p = (Pth().M(xa, yc(xa)).Q(xm - 6, yc(xm) - 1.6 * hmax, xb, yc(xb))
         .Q(xm + 6, yc(xm) + 1.6 * hmax, xa, yc(xa)).Z())
    return p, yc


slip_p = Pth(); fib = []; slip_c = []
for a, b in (("little", "ring"), ("ring", "middle"), ("middle", "index")):
    sp, yc = spindle(474, 521, lambda x, a=a: mc_y(a, x), lambda x, b=b: mc_y(b, x), 7.4)
    slip_p = slip_p + sp
    slip_c.append(yc)
    f = "M 478 %g L 518 %g" % (round(yc(478), 1), round(yc(518), 1))
    for k in range(5):
        x = 484 + k * 7.4
        f += " M %g %g L %g %g M %g %g L %g %g" % (x, yc(x), x + 5, yc(x + 5) - 4.6, x, yc(x), x + 5, yc(x + 5) + 4.6)
    fib.append(f)
fdi = Pth().M(468, 277).Q(488, 268, 518, 272).Q(508, 288, 490, 295).Q(476, 294, 468, 277).Z()
slip_p = slip_p + fdi
fib.append("M 471 278 L 514 275 M 480 287 L 498 277 M 487 292 L 506 281 M 478 281 L 496 273")
SLIP_D = slip_p.d()
FIB_D = " ".join(fib)
TWIG_D = ""

mcs = Pth()
for n in ("little", "ring", "middle", "index"):
    (xb, yb), xh, yh = (462, BASE[n]), 521, HEAD[n]
    mcs = mcs + phal(0, math.hypot(xh - xb, yh - yb), 5.8, 4.0, 5.6).xf(math.degrees(math.atan2(yh - yb, xh - xb)), xb, yb)
mcs = mcs + phal(0, 52, 6.4, 4.4, 5.8).xf(31, 446, 272)
carp = (ell(437, 226, 8.5, 7.5, 10) + ell(437, 244, 8.5, 9, 0) + ell(441, 262, 7.5, 10, -22)
        + ell(432, 213, 4.5, 4.2) + ell(456, 220, 8.5, 9.5) + ell(458, 240, 8.5, 9)
        + ell(457, 257, 7.5, 8) + ell(453, 273, 8, 8, 20))
thumb_p, _ = finger((22, 17), 5.8, 9)
THUMB_D = thumb_p.xf(31, 493, 299.5).map(T).d()
mid_p, _ = finger(FING["middle"][0], FING["middle"][1])
MID_D = mid_p.xf(0, PIV_X, HEAD["middle"]).map(T).d()


def build2(sc, qid, takeaway):
    """kit.Scene.build but drops layers invisible for their whole span (fade-out holds at 0)."""
    layers = []
    for base, kfs in sc.items:
        for i, (t, st) in enumerate(kfs):
            if i + 1 < len(kfs):
                t2, st2 = kfs[i + 1]
                if t2 == t:
                    continue
                l = dict(base, start_ms=t, end_ms=t2, **{"from": st, "to": st2})
            elif t < DUR:
                l = dict(base, start_ms=t, end_ms=DUR, **{"from": st, "to": st})
            else:
                continue
            if l["from"].get("opacity", 1) == 0 and l["to"].get("opacity", 1) == 0:
                continue
            layers.append(l)
    assert 1 <= len(layers) <= 80, (qid, "layers", len(layers))
    custom = sc._custom()
    assert len(custom) <= 12000, (qid, "custom_renderer", len(custom))
    assert 0 < len(takeaway) <= 240
    return {"schema_version": 1, "qid": qid, "duration_ms": DUR, "takeaway": takeaway,
            "layers": layers, "custom_renderer": custom}


def make():
    sc = Scene()
    backdrop(sc)
    sc.extra_defs = (
        '<linearGradient id="boneH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdbf99"/>'
        '<stop offset=".45" stop-color="#e6dbbd"/><stop offset="1" stop-color="#9c8c62"/></linearGradient>'
        '<linearGradient id="boneF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d3c59f"/>'
        '<stop offset=".2" stop-color="#fbf6e6"/><stop offset=".55" stop-color="#eee4c9"/>'
        '<stop offset="1" stop-color="#b5a67e"/></linearGradient>'
        '<linearGradient id="fadeL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#10292f" stop-opacity=".95"/>'
        '<stop offset="1" stop-color="#10292f" stop-opacity="0"/></linearGradient>')

    sc.add(path(TP(SKIN), "url(#skinF)", "#4f747c", 1.6), [(0, S(0.62))])
    sc.add(path(TP(HUM), "url(#boneH)", "#85774f", 2))
    sc.add(path(TP(HUM_LINES), "none", "#8f8160", 1.4), [(0, S(0.85))])

    # forearm bones (ulna + radius): path authored about the wrist so rotation/scale there slides the
    # elbow end up/back while the hand stays put
    wrw = W(WR[0])
    forearm = parse(ULNA + " " + RADIUS).map(lambda x, y: (W(x) - wrw, y - WR[1])).d()
    px, py = T(*WR)
    rest = S(1, px, py, 0, SC)
    dis = S(1, px - 12, py, 3.0, SC * 1.10)
    kf = [(0, rest), (4300, rest)] + ease((4300, rest), (5100, dis), 3)[1:]
    sc.add(path(forearm, "url(#boneF)", "#6f6247", 1.9), kf)

    sc.add(path(parse(carp.d()).map(T).d(), "url(#boneV)", BONE_LINE, 1.6))
    sc.add(path(parse(mcs.d()).map(T).d() + " " + THUMB_D + " " + MID_D, "url(#boneV)", BONE_LINE, 1.6))

    # interossei
    sc.add(path(TP(SLIP_D), "url(#musc)", "#7d2c35", 1.5))
    sc.add(path(TP(FIB_D), "none", "#6a1f2b", 1.1), [(0, S(0.85))])

    # moving fingers
    for n in ("index", "ring", "little"):
        lens, we, fan, limp = FING[n]
        fp, _ = finger(lens, we)
        fx, fy = T(PIV_X, HEAD[n])
        mk = lambda a, fx=fx, fy=fy: S(1, fx, fy, a, SC)
        sgn = 1 if fan > 0 else -1
        kfs = [(0, mk(0)), (2400, mk(0))]
        kfs += ease((2400, mk(0)), (3000, mk(fan)), 3)[1:]
        kfs += [(3600, mk(fan))]
        kfs += ease((3600, mk(fan)), (4200, mk(0)), 3)[1:]
        kfs += [(4700, mk(0)), (5400, mk(limp)), (6000, mk(limp)),
                (6350, mk(limp + sgn * 2.6)), (6800, mk(limp - sgn * 2.6)), (7250, mk(limp))]
        sc.add(path(fp.d(), "url(#boneV)", BONE_LINE, 1.5), kfs)

    # ghost of the pre-dislocation position of the proximal forearm bones
    sc.add(path(TP(GHOST_FORE), "none", "#f1e7c6", 1.6), [(4300, S(0)), (4900, S(0.55))])

    # nerve
    sc.add(tube(TP(nerve.d), 6.4))
    sc.add(tube(TP(bus.d), 3.4)[:2])

    # soft fade where the limb leaves the frame
    sc.add(rect(0, 174, 46, 112, "url(#fadeL)", "none", 3, 0))

    # slips light up while healthy
    sc.add(path(TP(SLIP_D), "rgba(255,238,150,.72)", "#fff3bf", 1.8),
           [(2250, S(0)), (2650, S(0.95)), (4200, S(0.95)), (4700, S(0))])
    # injury at the groove
    inj = P(148, 214).C(160, 216, 168, 217, GR[0], GR[1]).C(190, 217, 200, 219, 214, 220)
    sc.add(path(TP(inj.d), "none", RED, 8), [(4700, S(0)), (5100, S(0.95))])
    # distal nerve goes grey
    sc.add(path(TP("M 230 221 C 290 223 350 224 396 224 C 412 224 426 220 444 214 C 456 210 470 210 482 214 "
                   "C 490 232 490 262 480 294"), "none", "#34484a", 7.4), [(5100, S(0)), (5600, S(0.9))])
    # interossei go dark
    sc.add(path(TP(SLIP_D), "url(#muscP)", "#2b2030", 1.5), [(4800, S(0)), (5400, S(0.93))])
    # ghost of the commanded fan position
    gh = Pth()
    for n in ("index", "ring", "little"):
        lens, we, fan, limp = FING[n]
        tot = 8 + sum(lens) + 2 * (.7 * (0.76 * we + we) + 2.4) + 5
        cap = (Pth().M(4, -we - 2.4).L(tot - 7, -we - 2.4).C(tot + 1, -we - 2.4, tot + 1, we + 2.4, tot - 7, we + 2.4)
               .L(4, we + 2.4).C(-2, we + 2.4, -2, -we - 2.4, 4, -we - 2.4).Z())
        fx, fy = T(PIV_X, HEAD[n])
        gh = gh + cap.xf(fan, fx, fy, SC)
    sc.add(path(gh.d(), "none", "#f3c04c", 1.8), [(5900, S(0)), (6400, S(0.6))])
    # leader for 'Interossei'
    lx, ly = T(486, 214)
    sc.add(path("M %g %g C %g %g %g %g %g %g" % (lx - 6, ly - 50, lx - 8, ly - 36, lx - 2, ly - 14, lx + 2, ly - 4),
                "none", SOFT, 1.6), [(2300, S(0.9))])

    # custom renderer: glows, pulses, rings, texts
    mp = [T(*p) for p in nerve.pts]
    full = mp + [T(*p) for p in bus.pts[1:]]
    sc.route("main", full)
    sc.route("prox", mp[:K_GROOVE])
    sc.glow("prox", 1200, 1650, GOLD, 4.5)
    sc.flow("main", 1200, 4400, "rgba(255,226,140,.2)", 1, 1 / 1200.0, 20)
    sc.flow("main", 1200, 4400, "rgba(255,226,140,.45)", 1, 1 / 1200.0, 12)
    sc.flow("main", 1200, 4400, "#fffbe6", 1, 1 / 1200.0, 4.6)
    sc.glow("prox", 5200, 5700, GOLD, 4.5)
    sc.glow("prox", 6300, 6800, GOLD, 4.5)
    gx, gy = T(*GR)
    sc.ring(gx, gy, 1600, 900, GOLD, 30)
    for k, yc in enumerate(slip_c):
        sx, sy = T(497, yc(497))
        sc.ring(sx, sy, 2250 + 130 * k, 800, GOLD, 26)
    sx, sy = T(492, 283)
    sc.ring(sx, sy, 2640, 800, GOLD, 30)
    sc.ring(gx, gy, 4750, 900, RED, 38)
    sc.ring(gx, gy, 5700, 900, RED, 34)
    sc.ring(gx, gy, 6800, 900, RED, 34)

    sc.text("Healthy elbow", 320, 34, 24, INK, "middle", -1, 1, 3900, 0, 700)
    sc.text("Posterior elbow dislocation", 320, 34, 24, "#ffb0a6", "middle", 4400, 500, -1, 1, 700)
    bx, by = T(176, 192)
    sc.text("Medial epicondyle", bx - 2, by - 16, 18, SOFT, "end", 700, 500, -1, 1, 600)
    sc.text("Ulnar nerve", 318, 184, 22, GOLD, "middle", 1400, 500, -1, 1, 800)
    sc.text("Interossei", lx - 6, ly - 56, 21, "#ffa99d", "middle", 2300, 500, -1, 1, 800)
    sc.text("Forearm slides backward", 190, 346, 18, "#ffb0a6", "middle", 4800, 500, -1, 1, 600)
    sc.text("Weak abduction + adduction", 440, 396, 21, "#ff9488", "middle", 6300, 600, -1, 1, 800)
    return build2(sc, QID, TAKEAWAY)


if __name__ == "__main__":
    print(len(json.dumps(make())))
