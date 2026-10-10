import sys
sys.path.insert(0, __file__.rsplit("/scenes/", 1)[0])
from kit import *

QID = "Q000009325"
TAKEAWAY = ("The lateral cord (C5–C7) gives off the musculocutaneous nerve; axillary, radial, "
            "thoracodorsal and the subscapular nerves arise from the posterior cord.")


def make():
    sc = Scene()
    backdrop(sc)

    # --- spine (vertebrae) the roots emerge from
    verts = " ".join(rr(8, 64 + 48 * i, 40, 38, 11) + " " + rr(44, 76 + 48 * i, 14, 14, 6) for i in range(6))
    clav = ("M 70 78 C 120 58 165 82 225 72 C 275 64 325 56 385 70 C 392 72 392 82 385 84 "
            "C 325 72 275 80 225 90 C 165 100 120 78 70 92 C 62 94 62 80 70 78 Z")
    sc.add(path(clav, "url(#bone)", BONE_LINE, 2), sc.appear(0, 1))
    sc.add(path(verts, "url(#boneV)", BONE_LINE, 2))
    sc.text("Clavicle", 385, 62, 14, SOFT, "end", -1, 1, 2000, 0.4, 600)

    # --- nerve geometry ----------------------------------------------------------
    Y = dict(c5=107, c6=155, c7=203, c8=251, t1=299)
    c5 = P(48, Y["c5"]).C(90, 107, 105, 125, 135, 131)
    c6 = P(48, Y["c6"]).C(90, 155, 105, 137, 135, 131)
    c7 = P(48, Y["c7"]).C(90, 203, 110, 203, 135, 203)
    c8 = P(48, Y["c8"]).C(90, 251, 105, 269, 135, 275)
    t1 = P(48, Y["t1"]).C(90, 299, 105, 281, 135, 275)
    up_ant = P(135, 131).C(190, 131, 215, 150, 255, 150)
    mid_ant = P(135, 203).C(190, 203, 215, 160, 255, 150)
    up_post = P(135, 131).C(185, 131, 210, 215, 255, 225)
    mid_post = P(135, 203).C(190, 203, 215, 225, 255, 225)
    low_post = P(135, 275).C(190, 275, 215, 235, 255, 225)
    low_ant = P(135, 275).C(190, 275, 215, 300, 255, 300)
    lat = P(255, 150).L(335, 150)
    post = P(255, 225).L(335, 225)
    med = P(255, 300).L(335, 300)
    mc = P(335, 150).C(375, 150, 390, 100, 440, 100)
    lroot = P(335, 150).C(380, 150, 392, 180, 415, 180)
    mroot = P(335, 300).C(380, 300, 392, 180, 415, 180)
    median = P(415, 180).L(440, 180)
    radial = P(335, 225).C(385, 225, 400, 210, 440, 210)
    axil = P(335, 225).C(385, 225, 400, 236, 440, 236)
    usub = P(335, 225).C(370, 225, 385, 262, 440, 262)
    thor = P(335, 225).C(365, 225, 380, 288, 440, 288)
    uln = P(335, 300).C(385, 300, 410, 335, 440, 335)

    join = lambda *ps: " ".join(p.d for p in ps)
    A = join(c5, c6, c7, c8, t1, up_ant, mid_ant, up_post, mid_post, low_post, low_ant,
             lroot, mroot, median, radial, axil, uln)
    B = join(lat, post, med)
    C = join(usub, thor)
    for d, w, t0 in ((A, 4.5, 500), (B, 9, 900), (C, 2.6, 1100)):
        sc.add(tube(d, w), sc.appear(t0, 700))

    # focus: dim everything except the lateral-cord route
    sc.add(rect(0, 0, 640, 440, "url(#bg)", "none", 3, 0), [(2000, S(0)), (2700, S(0.66))])
    sc.add(tube(mc.d, 4.5), sc.appear(500, 700))

    # gold label pill for the answer
    sc.add(rect(444, 74, 188, 36, GOLD, "#fff3bf", 2, 18), sc.appear(4300, 500))

    # --- glow routes (signal climbing the lateral route) -----------------------
    def chain(*ps):
        pts = list(ps[0].pts)
        for p in ps[1:]:
            pts += p.pts[1:]
        return pts
    sc.route("a", chain(c5, up_ant, lat, mc))
    sc.route("b", chain(c6, up_ant, lat, mc))
    sc.route("c", chain(c7, mid_ant, lat, mc))
    sc.glow("a", 2200, 4300, GOLD, 4.5)
    sc.glow("b", 2350, 4450, GOLD, 4.5)
    sc.glow("c", 2500, 4600, GOLD, 4.5)
    sc.ring(440, 100, 4450, 1000, GOLD, 40)
    sc.ring(440, 100, 4900, 1000, GOLD, 40)

    # --- text (custom renderer; time-driven opacity) ---------------------------
    sc.text("Brachial plexus", 330, 36, 24, INK, "middle", -1, 1)
    for lbl, key in (("C5", "c5"), ("C6", "c6"), ("C7", "c7"), ("C8", "c8"), ("T1", "t1")):
        sc.text(lbl, 64, Y[key] - 8, 15, SOFT, "start", 300, 400, 2000, 0.5, 600)
    for txt, x in (("Roots", 88), ("Divisions", 195), ("Cords", 295), ("Branches", 387)):
        sc.text(txt, x, 398, 16, SOFT, "middle", 1300, 500, 2000, 0.45, 600)
    sc.text("Lateral cord", 295, 139, 17, SOFT, "middle", 900, 500, 2000, 0, 700)
    sc.text("Lateral cord", 295, 139, 17, GOLD, "middle", 2000, 500, -1, 1, 800)
    sc.text("Posterior cord", 295, 214, 17, SOFT, "middle", 1000, 500, 2000, 0.5, 700)
    sc.text("Medial cord", 295, 289, 17, SOFT, "middle", 1100, 500, 2000, 0.5, 700)
    for txt, y, t0 in (("Median", 185, 1500), ("Radial", 215, 1600), ("Axillary", 241, 1700),
                       ("Upper subscapular", 267, 1800), ("Thoracodorsal", 293, 1900), ("Ulnar", 340, 2000)):
        sc.text(txt, 450, y + 2, 19, SOFT, "start", t0, 500, 2000, 0.55, 600)
    sc.text("Musculocutaneous", 538, 98, 18, "#3b2b05", "middle", 4400, 400, -1, 1, 800)
    sc.text("from the lateral cord", 538, 138, 17, GOLD, "middle", 5200, 600, -1, 1, 600)
    return sc.build(QID, TAKEAWAY)


if __name__ == "__main__":
    print(len(json.dumps(make())))
