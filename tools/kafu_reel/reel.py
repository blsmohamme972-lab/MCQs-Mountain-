#!/usr/bin/env python3
"""Kafu reel: one command turns a published lesson into a finished 9:16 Instagram reel.

  ~/.venvs/kafu-voice/bin/python tools/kafu_reel/reel.py make --zip MCARDS_<PKG>.zip --qid Q000000257 --out work/reels/Q257

It captures the real app (live), plans every beat from the app's own geometry, renders the real lesson card frame by
frame, mixes the lesson voice with music and effects, and runs the quality gate. Read tools/kafu_reel/README.md.
"""
from __future__ import annotations
import argparse
import json
import shutil
import sys
import time
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import capture as cap        # noqa: E402
import timeline as tl        # noqa: E402
import render as rd          # noqa: E402

CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


def load_lesson(zip_path: Path, qid: str) -> dict:
    with zipfile.ZipFile(zip_path) as z:
        names = set(z.namelist())
        need = [f"scenes/{qid}.scene.json", f"source/questions/{qid}.json", f"voice/{qid}.opus"]
        miss = [n for n in need if n not in names]
        if miss:
            raise SystemExit(f"{zip_path.name} has no {', '.join(miss)} (wrong --qid or not a lesson package)")
        scene = json.loads(z.read(need[0]))
        q = json.loads(z.read(need[1]))["question"]
        voice = z.read(need[2])
    opts = q["options"]
    key = "ABCDEFGH".index(str(q["answer"]).strip().upper())
    return {"scene": scene, "question": q, "voice": voice, "answer_text": opts[key], "stem": q["stem"],
            "book": q["book_id"], "chapter": int(q["chapter_id"]), "number": int(str(q["source_number"]).strip())}


def lesson_marks(scene: dict) -> dict:
    """The lesson's own clock (ms): question, answer reveal, first story line, the 'Remember' line."""
    import re
    m = re.search(r"const L = (\{.*?\});\n", scene.get("script", ""), re.S)
    if not m:
        raise SystemExit("this lesson's player script has no timeline (L); update tools/kafu_reel for the new lesson format")
    L = json.loads(m.group(1))
    intro, cues = L.get("intro") or {}, L.get("cues") or []
    a = intro.get("a") or {}
    rem = next((c for c in cues if str(c.get("text", "")).lower().startswith("remember")), cues[-1] if cues else None)
    return {"question": (intro.get("q") or {}).get("t", 0), "answer": (a.get("words") or [[a.get("t", 0)]])[0][0],
            "story": cues[0]["t"] if cues else None, "remember": rem["t"] if rem else None}


def sample_times(reel: dict, cues: dict) -> dict:
    """Labelled moments every check looks at (stills and the QA sheet use the same list)."""
    c, L0, L1 = cues, cues["lesson"][0], cues["lesson"][1]
    t = {"a_flag": 0.6, "b_books": c["covers"][2] + 0.12, "c_books": c["covers"][-1] + 0.15, "d_fall": c["collapse"] + 0.3,
         "e_every": c["land"] + 0.5, "f_card": c["swipes"][0] + 1.6, "g_home": c["taps"][0] - 0.05, "h_podium": c["highlights"][0] + 0.5,
         "i_list": c["swipes"][1] + 1.35, "j_tap": c["taps"][1] - 0.05, "k_try": L0 + 4.0}
    if c.get("answer"):
        t["l_got"] = c["answer"] + 1.2
    t.update({"m_story": L0 + (L1 - L0) * 0.6, "n_last": L1 - 1.5, "o_end": c["end"] + 2.5})
    return t


def config(path: Path | None) -> dict:
    cfg = json.loads((HERE / "config.default.json").read_text())
    if path:
        user = json.loads(path.read_text())
        cfg["text"].update(user.pop("text", {}))
        cfg.update(user)
    return cfg


def plan(out: Path, lesson: dict, cfg: dict, qid: str) -> tuple[dict, dict, str]:
    geo = json.loads((out / "cap" / "geometry.json").read_text())
    reel, cues = tl.build(geo, int(lesson["scene"]["duration_ms"]), cfg, qid, rd.CHANNEL, rd.ORIGIN, lesson_marks(lesson["scene"]))
    (out / "reel_data.js").write_text("window.REEL=" + json.dumps(reel, ensure_ascii=False) + ";")
    (out / "plan.json").write_text(json.dumps({"cues": cues, "t": reel["t"]}, indent=1))
    html = rd.compile_lesson(lesson["scene"])
    return reel, cues, html


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("make", "capture", "stills", "build"):
        s = sub.add_parser(name)
        s.add_argument("--zip", required=True, type=Path); s.add_argument("--qid", required=True)
        s.add_argument("--out", required=True, type=Path); s.add_argument("--config", type=Path)
        s.add_argument("--students-now", type=int, help="ONLY a real number from the admin page; never invent one")
        s.add_argument("--chromium", default=CHROMIUM)
    a = ap.parse_args()
    out = a.out.resolve(); out.mkdir(parents=True, exist_ok=True)
    lesson = load_lesson(a.zip, a.qid)
    cfg = config(a.config)
    if a.students_now is not None:
        cfg["students_now"] = a.students_now
    if a.cmd in ("make", "capture"):
        t0 = time.time()
        cap.capture(out / "cap", lesson["book"], lesson["chapter"], lesson["number"], lesson["stem"], lesson["answer_text"],
                    cfg.get("students_now"), a.chromium, cfg["covers"])
        print(f"capture OK ({time.time() - t0:.0f} s)")
        if a.cmd == "capture":
            return
    reel, cues, html = plan(out, lesson, cfg, a.qid)
    if a.cmd == "stills":
        times = sample_times(reel, cues)
        rd.stills(out, a.qid, html, times, out, a.chromium)
        print("stills OK:", out)
        return
    import audio as au   # noqa: E402
    import qa            # noqa: E402
    mix = au.mix(lesson["voice"], cues, cfg, out)
    t0 = time.time()
    layout = rd.video_parallel(out, a.qid, html, cues["T"], mix, out / f"reel_{a.qid}.mp4", a.chromium)
    print(f"render OK ({time.time() - t0:.0f} s)")
    report = qa.check(out, out / f"reel_{a.qid}.mp4", reel, cues, layout)
    print(json.dumps(report, ensure_ascii=False, indent=1))
    if not report["pass"]:
        raise SystemExit("QA FAILED: do not send this reel. Fix the failures listed above.")


if __name__ == "__main__":
    main()
