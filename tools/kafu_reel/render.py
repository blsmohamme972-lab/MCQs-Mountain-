"""Render the reel page frame by frame in Chromium (deterministic: every frame is computed from t alone).

The page and every asset are served from a loopback origin through request routing, and the lesson card is the real
compiled MotionCards entry, seeked to the exact millisecond of each frame through the host protocol (like the app).
"""
from __future__ import annotations
import json
import mimetypes
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = Path(__file__).resolve().parent / "template"
ORIGIN = "http://127.0.0.1:8768"
CHANNEL = "a1b2c3d4e5f60718293a4b5c6d7e8f901234"
FPS = 30


def compile_lesson(scene: dict) -> str:
    sys.path.insert(0, str(ROOT))
    from motioncards.lib.compiler import compile_scene, validate_scene
    validate_scene(scene, str(scene["qid"]), int(scene["duration_ms"]))
    return compile_scene(scene, [ORIGIN], preview=True)


def entry_csp() -> str:
    sys.path.insert(0, str(ROOT))
    from motioncards.lib.render import ENTRY_CSP
    return ENTRY_CSP.replace("http://127.0.0.1:8767", ORIGIN)


def _router(work: Path, qid: str, lesson_html: str, blocked: list):
    csp = entry_csp()

    def route(r):
        url = r.request.url.split("#")[0].split("?")[0]
        if not url.startswith(ORIGIN + "/"):
            blocked.append(url); r.abort(); return
        rel = url[len(ORIGIN) + 1:]
        if rel == f"{qid}.html":
            r.fulfill(status=200, content_type="text/html", headers={"Content-Security-Policy": csp}, body=lesson_html); return
        for base in (work, TEMPLATE):
            f = base / rel
            if f.is_file():
                ct = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
                if f.suffix == ".woff2":
                    ct = "font/woff2"
                r.fulfill(status=200, content_type=ct, body=f.read_bytes()); return
        blocked.append(url); r.abort()
    return route


# The lesson card stays in the page's process. Out of process (Chromium's default for sandboxed frames) it starts at
# 0x0 until the page's next frame tells it its size, so it sometimes measured its text before it had a layout and
# failed (getExtentOfChar), and its pixels could lag the page by a frame. The sandbox itself is unchanged.
ARGS = ["--force-color-profile=srgb", "--disable-features=IsolateSandboxedIframes"]


def open_page(p, work: Path, qid: str, lesson_html: str, chromium: str | None, tries: int = 3):
    for attempt in range(1, tries + 1):
        br = p.chromium.launch(executable_path=chromium, args=ARGS) if chromium else p.chromium.launch(args=ARGS)
        ctx = br.new_context(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        blocked: list = []
        errors: list = []
        card: list = []
        ctx.route("**/*", _router(work, qid, lesson_html, blocked))
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: card.append(m.text) if "motioncards error" in m.text else None)
        pg.goto(ORIGIN + "/reel.html")
        layout = pg.evaluate("window.ready")
        pg.wait_for_function("window.lessonReady===true||window.lessonErrors.length>0", timeout=20000)
        if not pg.evaluate("window.lessonErrors.length") and not errors:
            return br, pg, layout, blocked, errors
        br.close()
        why = (card or errors or ["no message"])[0]
        if attempt == tries:
            raise RuntimeError(f"the lesson card failed to load {tries} times: {why}")
        print(f"lesson card failed to load (try {attempt}): {why}; retrying", file=sys.stderr)


def warm(pg, t: float) -> None:
    """Draw t once and throw the picture away: after a jump in time the card's frame is painted fresh, not stale."""
    frame(pg, t)
    pg.screenshot(type="jpeg", quality=30)


def frame(pg, t: float) -> None:
    ms = pg.evaluate("t=>render(t)", t)
    if ms is not None:
        pg.evaluate("ms=>lessonSeek(ms)", int(ms))


def stills(work: Path, qid: str, lesson_html: str, times: dict, out: Path, chromium: str | None = None) -> dict:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        br, pg, layout, blocked, errors = open_page(p, work, qid, lesson_html, chromium)
        for name, t in times.items():
            warm(pg, t)
            frame(pg, t)
            pg.screenshot(path=str(out / f"still_{name}.jpg"), type="jpeg", quality=85)
        br.close()
    if blocked:
        raise RuntimeError("blocked requests: " + ", ".join(blocked[:3]))
    return layout


def _chunk(args) -> str:
    """One worker: render frames [a, b) to a video-only file (independent GOP, same settings as every chunk)."""
    work, qid, lesson_html, a, b, path, chromium = args
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        br, pg, layout, blocked, errors = open_page(p, Path(work), qid, lesson_html, chromium)
        enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                                "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
                                "-r", str(FPS), "-g", str(FPS * 2), str(path)], stdin=subprocess.PIPE)
        warm(pg, a / FPS)
        for i in range(a, b):
            frame(pg, i / FPS)
            enc.stdin.write(pg.screenshot(type="jpeg", quality=95))
        enc.stdin.close()
        if enc.wait() != 0:
            raise RuntimeError("ffmpeg failed on a chunk")
        if errors or blocked:
            raise RuntimeError(f"page errors {errors[:2]} blocked {blocked[:2]}")
        br.close()
    return str(path)


def video_parallel(work: Path, qid: str, lesson_html: str, total: float, audio: Path, out: Path, chromium: str | None = None,
                   workers: int = 0) -> dict:
    """Render in parallel chunks (one Chromium per CPU core), then join them without re-encoding and add the sound."""
    import os
    from concurrent.futures import ProcessPoolExecutor
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:                       # one quick open first: layout facts and an early failure
        br, pg, layout, blocked, errors = open_page(p, work, qid, lesson_html, chromium)
        br.close()
    n = int(round(total * FPS))
    k = workers or max(1, min(6, (os.cpu_count() or 2)))
    edges = [round(n * i / k) for i in range(k + 1)]
    parts = [work / f"_chunk{i}.mp4" for i in range(k)]
    jobs = [(str(work), qid, lesson_html, edges[i], edges[i + 1], str(parts[i]), chromium) for i in range(k)]
    import multiprocessing
    with ProcessPoolExecutor(max_workers=k, mp_context=multiprocessing.get_context("spawn")) as ex:
        list(ex.map(_chunk, jobs))
    lst = work / "_chunks.txt"
    lst.write_text("".join(f"file '{x.name}'\n" for x in parts))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-i", str(audio), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}", "-movflags", "+faststart", str(out)], check=True)
    for x in parts + [lst]:
        x.unlink(missing_ok=True)
    return layout


def video(work: Path, qid: str, lesson_html: str, total: float, audio: Path, out: Path, chromium: str | None = None,
          progress=None) -> dict:
    from playwright.sync_api import sync_playwright
    n = int(round(total * FPS))
    with sync_playwright() as p:
        br, pg, layout, blocked, errors = open_page(p, work, qid, lesson_html, chromium)
        enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                                "-i", str(audio), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
                                "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", str(FPS), "-g", str(FPS * 2), "-c:a", "aac", "-b:a", "192k",
                                "-t", f"{total:.3f}", "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
        for i in range(n):
            frame(pg, i / FPS)
            enc.stdin.write(pg.screenshot(type="jpeg", quality=95))
            if progress and i % 150 == 0:
                progress(i, n)
        enc.stdin.close()
        if enc.wait() != 0:
            raise RuntimeError("ffmpeg failed to encode the reel")
        if errors:
            raise RuntimeError("page errors during render: " + "; ".join(errors[:3]))
        br.close()
    if blocked:
        raise RuntimeError("blocked requests: " + ", ".join(blocked[:3]))
    return layout
