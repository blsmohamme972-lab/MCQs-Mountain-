"""The reel's plan: every time, camera pose, scroll, tap and text, computed from the captured app geometry.

Nothing here is tuned per lesson: the same beats work for any question because every position comes from
geometry.json (the real app) and every length from the lesson itself. Times are seconds, positions CSS px.
Phone model: app viewport 390x844 starts at (14, 61) inside a 418x940 phone whose transform origin is (209, 470).

Story of the reel (retention first: every few seconds something new, an open question until the answer, and a
reason to stay after it):
  flag + IRAQI BOARD -> the Board books slam in -> they fall into the phone -> the real MCQ scrolls to its video
  card ("Every MCQ / with a video explanation") -> Leaders (Arabic names) -> back, tap play -> the real lesson,
  with headlines timed to the lesson's own clock (try first / did you get it? / the trick / remember) -> end card.
"""
from __future__ import annotations

W, H = 1080, 1920
FULL = {"x": 540, "y": 1150, "s": 1.30, "rx": 0, "ry": 0, "rz": 0}


def focus(rect: dict, fill: float, target=(540, 1150), smin=1.0, smax=2.95) -> dict:
    """Pose that puts the centre of a viewport rect at `target`, the rect `fill` of the frame wide."""
    s = max(smin, min(smax, fill * W / rect["w"]))
    cx, cy = rect["x"] + rect["w"] / 2, rect["y"] + rect["h"] / 2
    return {"x": target[0] - s * (14 + cx - 209), "y": target[1] - s * (61 + cy - 470), "s": s, "rx": 0, "ry": 0, "rz": 0}


def at(pose: dict, t: float, ease: str = "io", **over) -> dict:
    k = dict(pose); k.update(over); k["t"] = t; k["ease"] = ease
    return k


def view(rect: dict, scroll: float) -> dict:
    return {"x": rect["x"], "y": rect["y"] - scroll, "w": rect["w"], "h": rect["h"]}


def union(rects: list) -> dict:
    x0 = min(r["x"] for r in rects); y0 = min(r["y"] for r in rects)
    x1 = max(r["x"] + r["w"] for r in rects); y1 = max(r["y"] + r["h"] for r in rects)
    return {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}


def build(geo: dict, lesson_ms: int, cfg: dict, qid: str, channel: str, origin: str, marks: dict) -> tuple[dict, dict]:
    tx = cfg["text"]
    rate = float(cfg.get("rate", 1.1))
    q, lead, home, pl = geo["question"], geo["leaders"], geo["home"], geo["player"]
    qmax = max(0, q["height"] - 844)
    psy = pl["sy"]
    card_v = view(q["card"], qmax)
    play_v = view(q["play"] or q["card"], qmax)
    tab = home["tabs"]["leaders"]

    # ---------------------------------------------------------------- beats (120 bpm: 0.5 s grid)
    COVERS0 = 1.30                                   # the first book lands
    STEP = 0.25
    covers = []
    import random
    rnd = random.Random(7)
    for i, c in enumerate(geo["covers"]):            # the word's size is measured in the page (it must fit the frame)
        covers.append({"file": c["file"], "word": c["word"], "t": COVERS0 + STEP * i,
                       "rot": rnd.uniform(-7, 7), "dx": rnd.uniform(-150, 150), "dy": rnd.uniform(-60, 40)})
    LAST = covers[-1]["t"]
    COLLAPSE = (LAST + 0.30, LAST + 0.78)           # the deck falls into the phone
    PH_IN = COLLAPSE[0] - 0.15
    PH_LAND = COLLAPSE[1] + 0.12
    D = PH_LAND - 2.35                               # everything after the landing keeps its rhythm
    SCROLL0, SCROLL1 = 2.65 + D, 3.70 + D
    CARD_FOCUS = (3.35 + D, 4.15 + D)
    TO_HOME = 5.25 + D
    TAP_LEAD = 6.10 + D
    LEAD_IN = 6.22 + D
    PODIUM = (6.50 + D, 7.20 + D)
    UP0, UP1 = 7.65 + D, 8.85 + D
    DOWN0, DOWN1 = 9.15 + D, 10.05 + D
    COUNT = (DOWN1, DOWN1 + 0.8) if geo.get("students_now") else None
    BACK = (COUNT[1] if COUNT else DOWN1) + 0.05
    TAP_PLAY = BACK + 0.62
    PLAYER_IN = TAP_PLAY + 0.22
    L0 = PLAYER_IN + 0.22
    L1 = L0 + lesson_ms / 1000 / rate
    END0 = L1 + 0.10
    END1 = END0 + 4.0
    T = END1
    lt = lambda ms: L0 + ms / 1000 / rate           # lesson clock -> reel clock

    # ---------------------------------------------------------------- screens
    up_to = min(900, max(0, lead["height"] - 844))
    seg = [{"screen": "question", "t0": PH_IN - 0.2, "t1": TO_HOME + 0.45,
            "scroll": [{"t": 0, "y": 0}, {"t": SCROLL0, "y": 0}, {"t": SCROLL1, "y": qmax, "ease": "ios"}],
            "pulse0": SCROLL1, "pulse1": TO_HOME},
           {"screen": "home", "t0": TO_HOME, "t1": LEAD_IN + 0.25, "in": {"type": "whip", "dur": 0.45}, "scroll": [{"t": 0, "y": 0}]},
           {"screen": "leaders", "t0": LEAD_IN, "t1": BACK + 0.45, "in": {"type": "fade", "dur": 0.22},
            "scroll": [{"t": 0, "y": 0}, {"t": UP0, "y": 0}, {"t": UP1, "y": up_to, "ease": "ios"}, {"t": DOWN0, "y": up_to},
                       {"t": DOWN1, "y": 0, "ease": "ios"}]},
           {"screen": "question", "t0": BACK, "t1": PLAYER_IN + 0.2, "in": {"type": "whip", "dur": 0.45},
            "scroll": [{"t": 0, "y": qmax}], "pulse0": BACK + 0.3, "pulse1": TAP_PLAY},
           {"screen": "player", "t0": PLAYER_IN, "t1": END0 + 0.4, "in": {"type": "fade", "dur": 0.2}, "scroll": [{"t": 0, "y": psy}]}]

    # ---------------------------------------------------------------- camera (phone pose)
    hidden = {"x": 540, "y": 2300, "s": 0.9, "rx": 32, "ry": -24, "rz": 7}
    card_pose = focus(card_v, 0.80, (540, 1180), smax=2.5)
    home_pose = dict(FULL, y=1010, s=1.22)
    names_pod = [n for n in lead["arabic_names"] if n["y"] < 700]
    pod_rect = union([dict(r, h=r["h"] + 60, y=r["y"] - 150) for r in names_pod]) if names_pod else lead["hero"][0]
    pod_rect = {"x": 16, "y": pod_rect["y"], "w": 358, "h": pod_rect["h"]}
    rows_in_view = [n for n in lead["arabic_names"] if up_to + 80 <= n["y"] <= up_to + 700]
    list_rect = union([view(n, up_to) for n in rows_in_view[:4]]) if rows_in_view else {"x": 16, "y": 200, "w": 358, "h": 400}
    list_rect = {"x": 16, "y": list_rect["y"] - 20, "w": 358, "h": list_rect["h"] + 40}
    player_rect = view(union([pl["stage"], pl["range"]]), psy)
    lesson_pose = focus(player_rect, 0.985, (540, 1010), smax=2.95)
    pod_pose = focus(view(pod_rect, 0), 0.92, (540, 1120), smax=2.6)
    list_pose = focus(list_rect, 0.92, (540, 1120), smax=2.6)
    back_pose = focus(card_v, 0.86, (540, 1150), smax=2.6)
    phone = [at(hidden, 0, "lin"), at(hidden, PH_IN, "lin"),
             at(FULL, PH_LAND, "out5"), at(FULL, CARD_FOCUS[0], "io"),
             at(card_pose, CARD_FOCUS[1], "io"), at(card_pose, TO_HOME - 0.05, "lin", s=card_pose["s"] * 1.03),
             at(home_pose, TO_HOME + 0.5, "io"), at(home_pose, LEAD_IN + 0.1, "lin"),
             at(pod_pose, PODIUM[1], "io"), at(pod_pose, UP0 - 0.05, "lin", s=pod_pose["s"] * 1.02),
             at(dict(FULL, y=1150, s=1.55), UP0 + 0.45, "io"),
             at(list_pose, UP1, "io"), at(list_pose, DOWN0, "lin", s=list_pose["s"] * 1.02),
             at(dict(FULL, y=1120, s=1.45), DOWN1, "io")]
    if COUNT:
        cp = focus(view(lead["now"][0], 0), 0.9, (540, 1120), smax=2.6)
        phone += [at(cp, COUNT[0] + 0.45, "io"), at(cp, COUNT[1], "lin")]
    phone += [at(back_pose, BACK + 0.45, "io"), at(back_pose, PLAYER_IN, "lin", s=back_pose["s"] * 1.02),
              at(lesson_pose, L0 + 0.5, "io"), at(lesson_pose, L1, "lin", s=lesson_pose["s"] * 1.025),
              at(dict(FULL, y=1150, s=1.0), END0 + 0.4, "io")]

    # ---------------------------------------------------------------- finger (viewport coords) and taps
    sx = 300
    def swipe(t, y0, y1):
        return [{"t": t - 0.12, "x": sx, "y": y0 + (30 if y1 < y0 else -30), "o": 0}, {"t": t + 0.02, "x": sx, "y": y0, "o": 1, "ease": "lin"},
                {"t": t + 0.32, "x": sx, "y": y1, "o": 1, "ease": "io"}, {"t": t + 0.45, "x": sx, "y": y1 + (-30 if y1 < y0 else 30), "o": 0, "ease": "lin"}]
    def tap_at(t, r, dx=60, dy=-110):
        cx, cy = r["x"] + r["w"] / 2, r["y"] + r["h"] / 2
        return [{"t": t - 0.55, "x": cx + dx, "y": cy + dy, "o": 0}, {"t": t - 0.05, "x": cx, "y": cy, "o": 1, "ease": "out"},
                {"t": t + 0.3, "x": cx, "y": cy, "o": 1, "ease": "lin"}, {"t": t + 0.6, "x": cx + dx * 0.7, "y": cy + dy * 0.6, "o": 0, "ease": "io"}]
    tab_r = dict(tab, y=tab["y"] - 6)
    finger = ([{"t": 0, "x": sx, "y": 700, "o": 0}] + swipe(SCROLL0, 660, 330) + tap_at(TAP_LEAD, tab_r) + swipe(UP0, 660, 330)
              + swipe(DOWN0, 310, 640) + tap_at(TAP_PLAY, play_v, 70, 90) + [{"t": T, "x": sx, "y": 700, "o": 0}])
    taps = [TAP_LEAD, TAP_PLAY]

    pod_names = [dict(n, t0=PODIUM[0] + 0.2 + 0.12 * i, t1=UP0 + 0.2) for i, n in enumerate(names_pod[:3])]
    list_names = [dict(n, t0=UP1 - 0.25 + 0.12 * i, t1=DOWN0 + 0.15) for i, n in enumerate(rows_in_view[:4])]
    screens = {}
    for name in ("home", "leaders", "question", "player"):
        g = geo[name]
        screens[name] = {"content": f"cap/{name}_content.png", "fixed0": f"cap/{name}_fixed0.png", "fixedN": f"cap/{name}_fixedN.png",
                         "height": g["height"], "bg": g["bg"]}
    screens["leaders"]["highlights"] = pod_names + list_names
    if q.get("play"):
        screens["question"]["pulse"] = {"x": q["play"]["x"] + q["play"]["w"] / 2, "y": q["play"]["y"] + q["play"]["h"] / 2}

    # ---------------------------------------------------------------- texts
    S = "#cdd1f6"
    def head(i, t0, t1, en, hl, ar, size=112, ar_size=58, y=212):
        """English headline with its Arabic line under it, in one block (a two-line headline pushes the Arabic down)."""
        return [{"id": i, "t0": t0, "t1": t1, "y": y,
                 "rows": [{"text": en, "size": size, "hl": hl}, {"text": ar, "ar": True, "size": ar_size, "color": S, "mt": 14}]}]
    texts = []
    texts += head("books", COVERS0 + 0.05, COLLAPSE[0] + 0.2, tx["books_en"], tx["books_hl"], tx["books_ar"], size=96, ar_size=56)
    texts += [{"id": "every", "t0": PH_LAND - 0.25, "t1": TO_HOME, "y": 212, "rows": [{"text": tx["every_en"], "size": 124, "hl": tx["every_hl"]}]},
              {"id": "video", "t0": 3.45 + D, "t1": TO_HOME, "y": 352, "stagger": 0.06, "rows": [{"text": tx["video_en"], "size": 82, "hl": tx["video_hl"]}]},
              {"id": "video_ar", "t0": 3.80 + D, "t1": TO_HOME, "y": 462,
               "rows": [{"text": tx["video_ar"], "ar": True, "size": 60, "color": S, "hl": tx["video_ar_hl"]}]}]
    texts += head("leagues", LEAD_IN + 0.2, COUNT[0] if COUNT else BACK, tx["leagues_en"], tx["leagues_hl"], tx["leagues_ar"], size=116)
    if COUNT:
        texts.append({"id": "count", "t0": COUNT[0] + 0.1, "t1": COUNT[1], "y": 212,
                      "rows": [{"text": tx["count_en"].format(n=f"{geo['students_now']:,}"), "size": 96, "hl": [f"{geo['students_now']:,}"]}]})
    texts += head("watch", BACK + 0.15, L0 + 0.2, tx["watch_en"], tx["watch_hl"], tx["watch_ar"], size=112)
    # during the lesson: headlines on the lesson's own clock
    a_t = lt(marks["answer"]) if marks.get("answer") else None
    st_t = lt(marks["story"]) if marks.get("story") else None
    rm_t = lt(marks["remember"]) if marks.get("remember") else None
    beats = [("try", L0 + 0.35, a_t or st_t or rm_t or END0)]
    if a_t:
        beats.append(("got", a_t + 0.15, st_t or rm_t or END0))
    if st_t:
        beats.append(("trick", st_t - 0.2, rm_t or END0))
    if rm_t:
        beats.append(("remember", rm_t, END0))
    for key, t0, t1 in beats:
        if t1 - t0 > 1.0:
            texts += head(key, t0, t1, tx[f"{key}_en"], tx[f"{key}_hl"], tx[f"{key}_ar"], size=84, ar_size=54, y=206)
    scrim = [[COVERS0, COLLAPSE[0] + 0.25], [PH_LAND - 0.3, TO_HOME + 0.1], [LEAD_IN + 0.1, END0]]

    reel = {"t": {"flag_out": [COLLAPSE[0], COLLAPSE[1]], "phone_in": PH_IN, "brand": [PH_LAND - 0.2, END0], "end": [END0, END1], "total": T},
            "montage": {"covers0": COVERS0, "collapse": list(COLLAPSE), "toY": 1150 - (440 + 672 / 2)},
            "covers": covers,
            "text": {k: tx[k] for k in ("intro_ar", "intro_en", "end_iraqi", "end_tag", "end_tag_ar", "end_free_ar", "end_free_en",
                                        "end_send_ar", "mcq_word")},
            "screens": screens, "segments": seg, "phone": phone, "finger": finger, "taps": taps, "texts": texts, "scrim": scrim,
            "flagbg": None, "flashes": [[0.05, 0.22, 0.38], [COLLAPSE[1] - 0.02, 0.18, 0.22], [END0 - 0.02, 0.22, 0.2]],
            "lesson": {"screen": "player", "qid": qid, "channel": channel, "src": f"{origin}/{qid}.html#{channel}", "t0": L0, "rate": rate,
                       "duration_ms": lesson_ms, "stage": pl["stage"], "output": pl["output"], "range": pl["range"], "colors": pl["colors"],
                       "sy": psy},
            "end": {"phones": [{"screen": "leaders", "scroll": 0, "x": 345, "y": 1062, "s": 0.50, "ry": 16, "rz": -7},
                               {"screen": "question", "scroll": qmax, "x": 735, "y": 1062, "s": 0.50, "ry": -16, "rz": 7}]}}
    cues = {"T": T, "boom": 0.05, "covers": [c["t"] for c in covers], "collapse": COLLAPSE[0], "phone_in": PH_IN, "land": PH_LAND,
            "texts": [x["t0"] for x in texts], "swipes": [SCROLL0, UP0, DOWN0], "whips": [TO_HOME, BACK],
            "taps": taps, "play": PLAYER_IN, "lesson": [L0, L1], "answer": a_t,
            "highlights": [h["t0"] for h in pod_names + list_names], "end": END0}
    return reel, cues
