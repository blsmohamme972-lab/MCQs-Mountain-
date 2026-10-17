"""The reel's plan: every time, camera pose, scroll, tap and text, computed from the captured app geometry.

Nothing here is tuned per lesson: the same beats work for any question because every position comes from
geometry.json (the real app) and every length from the lesson itself. Times are seconds, positions CSS px.
Phone model: app viewport 390x844 starts at (14, 61) inside a 418x940 phone whose transform origin is (209, 470).
"""
from __future__ import annotations

W, H = 1080, 1920
FULL = {"x": 540, "y": 1150, "s": 1.30, "rx": 0, "ry": 0, "rz": 0}
TEXT_BAND_BOTTOM = 640          # headlines live above this line (a scrim keeps them readable over the phone)
SAFE_BOTTOM = 1560              # Instagram's caption and buttons cover the area below


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


def build(geo: dict, lesson_ms: int, cfg: dict, qid: str, channel: str, origin: str) -> tuple[dict, dict]:
    tx = cfg["text"]
    rate = float(cfg.get("rate", 1.1))
    q, lead, home, pl = geo["question"], geo["leaders"], geo["home"], geo["player"]
    qmax = max(0, q["height"] - 844)
    psy = pl["sy"]                                        # the player is shown at the scroll the app left it
    card_v = view(q["card"], qmax)
    play_v = view(q["play"] or q["card"], qmax)
    tab = home["tabs"]["leaders"]

    # ---------------------------------------------------------------- beats (120 bpm: 0.5 s grid)
    PH_IN, PH_LAND = 1.55, 2.35
    SCROLL0, SCROLL1 = 2.65, 3.70
    CARD_FOCUS = (3.35, 4.15)
    TO_HOME = 5.15
    TAP_LEAD = 6.00
    LEAD_IN = 6.12
    PODIUM = (6.40, 7.10)
    UP0, UP1 = 7.55, 8.75
    DOWN0, DOWN1 = 9.05, 9.95
    COUNT = (9.95, 10.75) if geo.get("students_now") else None
    BACK = (COUNT[1] if COUNT else 10.0)
    TAP_PLAY = BACK + 0.62
    PLAYER_IN = TAP_PLAY + 0.22
    L0 = PLAYER_IN + 0.22
    L1 = L0 + lesson_ms / 1000 / rate
    END0 = L1 + 0.10
    END1 = END0 + 4.0
    T = END1

    # ---------------------------------------------------------------- screens
    up_to = min(900, max(0, lead["height"] - 844))
    seg = []
    seg.append({"screen": "question", "t0": PH_IN - 0.2, "t1": TO_HOME + 0.45,
                "scroll": [{"t": 0, "y": 0}, {"t": SCROLL0, "y": 0}, {"t": SCROLL1, "y": qmax, "ease": "ios"}],
                "pulse0": SCROLL1, "pulse1": TO_HOME})
    seg.append({"screen": "home", "t0": TO_HOME, "t1": LEAD_IN + 0.25, "in": {"type": "whip", "dur": 0.45},
                "scroll": [{"t": 0, "y": 0}]})
    lead_keys = [{"t": 0, "y": 0}, {"t": UP0, "y": 0}, {"t": UP1, "y": up_to, "ease": "ios"}, {"t": DOWN0, "y": up_to},
                 {"t": DOWN1, "y": 0, "ease": "ios"}]
    seg.append({"screen": "leaders", "t0": LEAD_IN, "t1": BACK + 0.45, "in": {"type": "fade", "dur": 0.22}, "scroll": lead_keys})
    seg.append({"screen": "question", "t0": BACK, "t1": PLAYER_IN + 0.2, "in": {"type": "whip", "dur": 0.45},
                "scroll": [{"t": 0, "y": qmax}], "pulse0": BACK + 0.3, "pulse1": TAP_PLAY})
    seg.append({"screen": "player", "t0": PLAYER_IN, "t1": END0 + 0.4, "in": {"type": "fade", "dur": 0.2},
                "scroll": [{"t": 0, "y": psy}]})

    # ---------------------------------------------------------------- camera (phone pose)
    hidden = {"x": 540, "y": 2500, "s": 1.05, "rx": 38, "ry": -30, "rz": 9}
    card_pose = focus(card_v, 0.80, (540, 1180), smax=2.5)
    home_pose = dict(FULL, y=1010, s=1.22)
    names_pod = [n for n in lead["arabic_names"] if n["y"] < 700]
    pod_rect = union([dict(r, h=r["h"] + 60, y=r["y"] - 150) for r in names_pod]) if names_pod else lead["hero"][0]
    pod_rect = {"x": 16, "y": pod_rect["y"], "w": 358, "h": pod_rect["h"]}
    rows_in_view = [n for n in lead["arabic_names"] if up_to + 80 <= n["y"] <= up_to + 700]
    list_rect = union([view(n, up_to) for n in rows_in_view[:4]]) if rows_in_view else {"x": 16, "y": 200, "w": 358, "h": 400}
    list_rect = {"x": 16, "y": list_rect["y"] - 20, "w": 358, "h": list_rect["h"] + 40}
    player_rect = view(union([pl["stage"], {"x": pl["range"]["x"], "y": pl["range"]["y"], "w": pl["range"]["w"], "h": pl["range"]["h"]}]), psy)
    lesson_pose = focus(player_rect, 0.985, (540, 1010), smax=2.95)
    phone = [at(hidden, 0, "lin"), at(hidden, PH_IN, "lin"),
             at(FULL, PH_LAND, "out5"), at(FULL, CARD_FOCUS[0], "io"),
             at(card_pose, CARD_FOCUS[1], "io"), at(card_pose, TO_HOME - 0.05, "lin", s=card_pose["s"] * 1.03),
             at(home_pose, TO_HOME + 0.5, "io"), at(home_pose, LEAD_IN + 0.1, "lin"),
             at(focus(view(pod_rect, 0), 0.92, (540, 1120), smax=2.6), PODIUM[1], "io"),
             at(focus(view(pod_rect, 0), 0.92, (540, 1120), smax=2.6), UP0 - 0.05, "lin"),
             at(dict(FULL, y=1150, s=1.55), UP0 + 0.45, "io"),
             at(focus(list_rect, 0.92, (540, 1120), smax=2.6), UP1, "io"),
             at(focus(list_rect, 0.92, (540, 1120), smax=2.6), DOWN0, "lin"),
             at(dict(FULL, y=1120, s=1.45), DOWN1, "io")]
    if COUNT:
        cnt = view(lead["now"][0], 0)
        phone += [at(focus(cnt, 0.9, (540, 1120), smax=2.6), COUNT[0] + 0.45, "io"), at(focus(cnt, 0.9, (540, 1120), smax=2.6), COUNT[1], "lin")]
    phone += [at(focus(card_v, 0.86, (540, 1150), smax=2.6), BACK + 0.45, "io"), at(focus(card_v, 0.86, (540, 1150), smax=2.6), PLAYER_IN, "lin"),
              at(lesson_pose, L0 + 0.5, "io"), at(lesson_pose, L1, "lin", s=lesson_pose["s"] * 1.025),
              at(dict(FULL, y=1150, s=1.0), END0 + 0.4, "io")]

    # ---------------------------------------------------------------- finger (viewport coords) and taps
    swipe_x = 300
    finger = [{"t": 0, "x": swipe_x, "y": 700, "o": 0},
              {"t": SCROLL0 - 0.12, "x": swipe_x, "y": 720, "o": 0}, {"t": SCROLL0 + 0.02, "x": swipe_x, "y": 660, "o": 1, "ease": "lin"},
              {"t": SCROLL0 + 0.32, "x": swipe_x, "y": 330, "o": 1, "ease": "io"}, {"t": SCROLL0 + 0.45, "x": swipe_x, "y": 290, "o": 0, "ease": "lin"},
              {"t": TAP_LEAD - 0.55, "x": tab["x"] + tab["w"] / 2 + 60, "y": tab["y"] - 110, "o": 0},
              {"t": TAP_LEAD - 0.05, "x": tab["x"] + tab["w"] / 2, "y": tab["y"] + tab["h"] / 2 - 6, "o": 1, "ease": "out"},
              {"t": TAP_LEAD + 0.3, "x": tab["x"] + tab["w"] / 2, "y": tab["y"] + tab["h"] / 2 - 6, "o": 1, "ease": "lin"},
              {"t": TAP_LEAD + 0.6, "x": tab["x"] + tab["w"] / 2 + 40, "y": tab["y"] - 60, "o": 0, "ease": "io"},
              {"t": UP0 - 0.12, "x": swipe_x, "y": 720, "o": 0}, {"t": UP0 + 0.02, "x": swipe_x, "y": 660, "o": 1, "ease": "lin"},
              {"t": UP0 + 0.32, "x": swipe_x, "y": 330, "o": 1, "ease": "io"}, {"t": UP0 + 0.45, "x": swipe_x, "y": 290, "o": 0, "ease": "lin"},
              {"t": DOWN0 - 0.12, "x": swipe_x, "y": 250, "o": 0}, {"t": DOWN0 + 0.02, "x": swipe_x, "y": 310, "o": 1, "ease": "lin"},
              {"t": DOWN0 + 0.32, "x": swipe_x, "y": 640, "o": 1, "ease": "io"}, {"t": DOWN0 + 0.45, "x": swipe_x, "y": 680, "o": 0, "ease": "lin"},
              {"t": TAP_PLAY - 0.5, "x": play_v["x"] + play_v["w"] / 2 + 70, "y": play_v["y"] + play_v["h"] / 2 + 90, "o": 0},
              {"t": TAP_PLAY - 0.05, "x": play_v["x"] + play_v["w"] / 2, "y": play_v["y"] + play_v["h"] / 2, "o": 1, "ease": "out"},
              {"t": TAP_PLAY + 0.3, "x": play_v["x"] + play_v["w"] / 2, "y": play_v["y"] + play_v["h"] / 2, "o": 1, "ease": "lin"},
              {"t": TAP_PLAY + 0.6, "x": play_v["x"] + play_v["w"] / 2 + 50, "y": play_v["y"] + play_v["h"] / 2 + 70, "o": 0, "ease": "io"},
              {"t": T, "x": 300, "y": 700, "o": 0}]
    taps = [TAP_LEAD, TAP_PLAY]

    # name highlights on the board (page coords; they scroll with it)
    pod_names = [dict(n, t0=PODIUM[0] + 0.2 + 0.12 * i, t1=UP0 + 0.2) for i, n in enumerate(names_pod[:3])]
    list_names = [dict(n, t0=UP1 - 0.25 + 0.12 * i, t1=DOWN0 + 0.15) for i, n in enumerate(rows_in_view[:4])]
    screens = {}
    for name in ("home", "leaders", "question", "player"):
        g = geo[name]
        screens[name] = {"content": f"cap/{name}_content.png", "fixed0": f"cap/{name}_fixed0.png", "fixedN": f"cap/{name}_fixedN.png",
                         "height": g["height"], "bg": g["bg"]}
    screens["leaders"]["highlights"] = pod_names + list_names
    play_c = {"x": q["play"]["x"] + q["play"]["w"] / 2, "y": q["play"]["y"] + q["play"]["h"] / 2} if q.get("play") else None
    if play_c:
        screens["question"]["pulse"] = play_c

    # ---------------------------------------------------------------- texts
    G, S = "#ffd54a", "#cdd1f6"
    texts = [
        {"id": "every", "t0": 2.05, "t1": TO_HOME, "y": 212, "rows": [{"text": tx["every_en"], "size": 124, "hl": tx["every_hl"]}]},
        {"id": "video", "t0": 3.45, "t1": TO_HOME, "y": 352, "stagger": 0.06,
         "rows": [{"text": tx["video_en"], "size": 82, "hl": tx["video_hl"]}]},
        {"id": "video_ar", "t0": 3.80, "t1": TO_HOME, "y": 462, "rows": [{"text": tx["video_ar"], "ar": True, "size": 60, "color": S, "hl": tx["video_ar_hl"]}]},
        {"id": "leagues", "t0": LEAD_IN + 0.2, "t1": BACK, "y": 212, "rows": [{"text": tx["leagues_en"], "size": 116, "hl": tx["leagues_hl"]}]},
        {"id": "leagues_ar", "t0": LEAD_IN + 0.55, "t1": BACK, "y": 356, "rows": [{"text": tx["leagues_ar"], "ar": True, "size": 58, "color": S}]},
        {"id": "watch", "t0": BACK + 0.15, "t1": L0 + 0.2, "y": 212, "rows": [{"text": tx["watch_en"], "size": 112, "hl": tx["watch_hl"]}]},
        {"id": "watch_ar", "t0": BACK + 0.35, "t1": L0 + 0.2, "y": 352, "rows": [{"text": tx["watch_ar"], "ar": True, "size": 58, "color": S}]},
        {"id": "lesson", "t0": L0 + 0.35, "t1": END0, "y": 212, "stagger": 0.05,
         "rows": [{"text": tx["lesson_en"], "size": 70, "hl": tx["lesson_hl"]}, {"text": tx["lesson_ar"], "ar": True, "size": 50, "color": S, "mt": 14}]},
    ]
    if COUNT:
        texts.append({"id": "count", "t0": COUNT[0] + 0.1, "t1": COUNT[1], "y": 212,
                      "rows": [{"text": tx["count_en"].format(n=f"{geo['students_now']:,}"), "size": 96, "hl": [f"{geo['students_now']:,}"]}]})
        for x in texts:
            if x["id"].startswith("leagues"):
                x["t1"] = COUNT[0]
    scrim = [[2.0, TO_HOME + 0.1], [LEAD_IN + 0.1, END0]]

    reel = {"t": {"flag_out": [1.30, 1.75], "phone_in": PH_IN, "brand": [PH_LAND - 0.2, END0], "end": [END0, END1], "total": T},
            "text": {k: tx[k] for k in ("intro_ar", "intro_en", "end_iraqi", "end_tag", "end_free", "end_send")},
            "screens": screens, "segments": seg, "phone": phone, "finger": finger, "taps": taps, "texts": texts, "scrim": scrim,
            "flagbg": None, "flashes": [[0.05, 0.22, 0.38]],
            "lesson": {"screen": "player", "qid": qid, "channel": channel, "src": f"{origin}/{qid}.html#{channel}", "t0": L0, "rate": rate,
                       "duration_ms": lesson_ms, "stage": pl["stage"], "output": pl["output"], "range": pl["range"], "colors": pl["colors"]},
            "end": {"phones": [{"screen": "leaders", "scroll": 0, "x": 330, "y": 1075, "s": 0.62, "ry": 16, "rz": -7},
                               {"screen": "question", "scroll": qmax, "x": 750, "y": 1075, "s": 0.62, "ry": -16, "rz": 7}]}}
    cues = {"T": T, "boom": 0.05, "flag_out": 1.30, "phone_in": PH_IN, "land": PH_LAND, "texts": [x["t0"] for x in texts],
            "swipes": [SCROLL0, UP0, DOWN0], "whips": [TO_HOME, BACK], "taps": taps, "play": PLAYER_IN, "lesson": [L0, L1],
            "highlights": [h["t0"] for h in pod_names + list_names], "end": END0}
    return reel, cues
