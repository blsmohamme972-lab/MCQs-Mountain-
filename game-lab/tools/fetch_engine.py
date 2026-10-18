"""Fetch the lab's pinned game-engine builds into game-lab/vendor/ (git-ignored).

Same idea as tools/vendor_frontend.py for the app: every file is pinned to a version, the npm tarball is checked
against the registry's sha512 integrity, and the extracted file against a SHA-256 in tools/engine-lock.json.
No install scripts run and nothing is committed. Usage: python3 game-lab/tools/fetch_engine.py [--only phaser|pixi.js]
"""
from __future__ import annotations
import base64
import hashlib
import io
import json
import re
import sys
import tarfile
import urllib.request
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
LOCK = LAB / "tools" / "engine-lock.json"


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def fetch(url: str, limit: int = 64 * 1024 * 1024) -> bytes:
    if not url.startswith("https://registry.npmjs.org/"):
        raise ValueError("Engine tarballs come from the npm registry only: " + url)
    with urllib.request.urlopen(url, timeout=120) as r:
        raw = r.read(limit + 1)
    if len(raw) > limit:
        raise ValueError("Tarball too large: " + url)
    return raw


def check_integrity(raw: bytes, integrity: str) -> None:
    algo, _, b64 = integrity.partition("-")
    if algo != "sha512" or base64.b64encode(hashlib.sha512(raw).digest()).decode() != b64:
        raise ValueError("Tarball integrity mismatch")


def main(argv: list[str]) -> int:
    only = argv[argv.index("--only") + 1] if "--only" in argv else None
    lock = json.loads(LOCK.read_text())
    tarballs: dict[str, bytes] = {}
    for item in lock["files"]:
        if only and item["package"] != only:
            continue
        if not re.fullmatch(r"vendor/[A-Za-z0-9_.-]+", item["path"]):
            raise ValueError("Unsafe vendor path: " + item["path"])
        if not item["tarball"].endswith("/-/" + item["package"].split("/")[-1] + "-" + item["version"] + ".tgz"):
            raise ValueError("Tarball URL does not match the pinned version: " + item["tarball"])
        target = LAB / item["path"]
        if target.exists() and sha256(target.read_bytes()) == item["sha256"]:
            print("[engine] ok", item["path"])
            continue
        raw = tarballs.get(item["tarball"])
        if raw is None:
            raw = fetch(item["tarball"])
            check_integrity(raw, item["integrity"])
            tarballs[item["tarball"]] = raw
        with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tar:
            member = tar.extractfile(item["member"])
            if member is None:
                raise ValueError("Missing in tarball: " + item["member"])
            data = member.read()
        actual = sha256(data)
        if actual != item["sha256"]:
            raise ValueError("SHA-256 mismatch for " + item["path"] + ": " + actual)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        print("[engine] fetched", item["path"], len(data), "bytes", actual)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
