"""Quality gate. A reel is sent only when every check passes; each failure says what is wrong.

Checks: the file (1080x1920, 30 fps, H.264 high, yuv420p, AAC, faststart), audio and video lengths equal, loudness
-14 LUFS (+-1) with true peak <= -1 dBTP, the headlines fit their band, and a labelled contact sheet for the eye check.
"""
from __future__ import annotations
import json
import re
import subprocess
from pathlib import Path


def _probe(path: Path) -> dict:
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,duration"
                        ":format=duration,size", "-of", "json", str(path)], capture_output=True, text=True, check=True)
    return json.loads(p.stdout)


def _loudness(path: Path) -> tuple[float, float]:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    tail = p.stderr[p.stderr.rfind("Summary:"):]
    i = float(re.search(r"I:\s*(-?[\d.]+) LUFS", tail).group(1))
    tp = float(re.search(r"Peak:\s*(-?[\d.]+) dBFS", tail).group(1))
    return i, tp


def sheet(video: Path, times: list[tuple[str, float]], out: Path) -> Path:
    from PIL import Image, ImageDraw
    ims = []
    for label, t in times:
        f = out / "_qa_frame.jpg"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1", "-q:v", "3", str(f)], check=True)
        im = Image.open(f).resize((270, 480)); d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 270, 20], fill=(0, 0, 0)); d.text((4, 4), f"{t:5.1f}s {label}", fill=(255, 220, 0)); ims.append(im)
    cols = 6; rows = (len(ims) + cols - 1) // cols
    s = Image.new("RGB", (270 * cols, 480 * rows), (16, 16, 16))
    for i, im in enumerate(ims):
        s.paste(im, ((i % cols) * 270, (i // cols) * 480))
    target = out / "qa_sheet.jpg"; s.save(target, quality=86)
    (out / "_qa_frame.jpg").unlink(missing_ok=True)
    return target


def check(out: Path, video: Path, reel: dict, cues: dict, layout: dict) -> dict:
    fails, notes = [], []
    info = _probe(video)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    if (v["width"], v["height"]) != (1080, 1920): fails.append(f"video is {v['width']}x{v['height']}, not 1080x1920")
    if v["r_frame_rate"] != "30/1": fails.append(f"frame rate {v['r_frame_rate']}, not 30")
    if v["codec_name"] != "h264" or v.get("pix_fmt") != "yuv420p": fails.append("video must be H.264 yuv420p")
    if not a or a["codec_name"] != "aac": fails.append("audio must be AAC")
    T = cues["T"]
    vd, ad = float(v.get("duration", 0)), float(a.get("duration", 0)) if a else 0
    if abs(vd - T) > 0.1: fails.append(f"video lasts {vd:.2f}s, the plan {T:.2f}s")
    if abs(ad - vd) > 0.12: fails.append(f"audio {ad:.2f}s and video {vd:.2f}s differ")
    size = int(info["format"]["size"])
    if size > 300 * 1024 * 1024: fails.append("file over Instagram's 300 MB limit")
    if not 3 <= vd <= 900: fails.append("Instagram reels must be 3 s to 15 min")
    i, tp = _loudness(video)
    if not -15.0 <= i <= -13.0: fails.append(f"loudness {i} LUFS, must be -14 +-1")
    if tp > -1.0: fails.append(f"true peak {tp} dBTP, must be <= -1")
    with open(video, "rb") as f:
        head = f.read(64 * 1024)
    if head.find(b"moov") < 0 or (head.find(b"mdat") >= 0 and head.find(b"moov") > head.find(b"mdat")):
        fails.append("moov atom is not at the start (faststart)")
    for x in layout.get("texts", []):
        if x["bottom"] > 720: fails.append(f"headline '{x['id']}' runs to y={x['bottom']:.0f}, below the headline band")
    over = [x for x in layout.get("overflow", []) if x]
    if over: fails.append("text overflows its box: " + ", ".join(over))
    L0 = reel["lesson"]["t0"]; E = reel["t"]["end"][0]
    times = [("flag", 0.6), ("phone", 2.2), ("every", 3.0), ("video", 4.6), ("home", 5.9), ("podium", 7.3), ("list", 8.9),
             ("back", 10.5), ("tap", L0 - 0.3), ("lesson", L0 + 4), ("lesson", L0 + (E - L0) * 0.5), ("lesson", E - 2), ("end", E + 2.5), ("end", T - 0.2)]
    s = sheet(video, times, out)
    report = {"pass": not fails, "fails": fails, "video": str(video), "seconds": round(vd, 2), "size_mb": round(size / 2 ** 20, 1),
              "loudness_lufs": i, "true_peak_dbtp": tp, "sheet": str(s),
              "next": "Look at the sheet: flag, phone, every text readable, names highlighted, lesson playing, end card." if not fails else
                      "Do not send. Fix every failure, then run make again."}
    (out / "qa_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    return report
