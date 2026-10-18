"""Download the lab's TEST-ONLY art and audio (D22) into game-lab/assets-test/ (git-ignored), then build the game's
atlases and sounds into game-lab/assets-test/build/ (light tier) and build-hd/ (HD tier, tools/build_assets_hd.py).

Every file is listed in tools/assets-lock.json or tools/assets-hd-lock.json with a URL pinned to an exact commit and a SHA-256; a file whose hash
does not match is refused. The register of authors and licences is game-lab/ASSETS.md. Nothing downloaded here may be
committed or copied into app/ (D15, D22).

Usage: python3 game-lab/tools/fetch_assets.py            download (skips files already present and correct), then build
       python3 game-lab/tools/fetch_assets.py --no-build download only
Needs: Python 3.9+ with Pillow (pip install pillow) for the build step, and ffmpeg for the sound step.
"""
from __future__ import annotations
import hashlib
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
LOCKS = [LAB / "tools" / "assets-lock.json", LAB / "tools" / "assets-hd-lock.json"]  # light tier, HD tier
OUT = LAB / "assets-test"
ALLOWED = ("https://raw.githubusercontent.com/",)


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def fetch(url: str, limit: int = 32 * 1024 * 1024) -> bytes:
    if not url.startswith(ALLOWED):
        raise ValueError("Asset URL host not allowed: " + url)
    if not re.search(r"/[0-9a-f]{40}/", url):
        raise ValueError("Asset URL is not pinned to a commit: " + url)
    parts = urllib.parse.urlsplit(url)
    safe = urllib.parse.urlunsplit(parts._replace(path=urllib.parse.quote(urllib.parse.unquote(parts.path))))
    with urllib.request.urlopen(safe, timeout=120) as r:
        raw = r.read(limit + 1)
    if len(raw) > limit:
        raise ValueError("Asset too large: " + url)
    return raw


def download() -> int:
    items = [it for p in LOCKS for it in json.loads(p.read_text())["files"]]
    n = 0
    for item in items:
        rel = item["path"]
        if not re.fullmatch(r"src/[A-Za-z0-9_. ()/-]+", rel) or ".." in rel:
            raise ValueError("Unsafe asset path: " + rel)
        target = OUT / rel
        if target.exists() and sha256(target.read_bytes()) == item["sha256"]:
            continue
        raw = fetch(item["url"])
        actual = sha256(raw)
        if actual != item["sha256"]:
            raise ValueError("SHA-256 mismatch for " + rel + ": " + actual)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        n += 1
    print("[assets]", len(items), "files ok,", n, "downloaded")
    return 0


def main(argv: list[str]) -> int:
    download()
    if "--no-build" not in argv:
        subprocess.run([sys.executable, str(LAB / "tools" / "build_assets.py")], check=True)
        subprocess.run([sys.executable, str(LAB / "tools" / "build_assets_hd.py")], check=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
