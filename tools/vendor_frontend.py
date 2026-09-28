"""Fetch only version-and-hash-pinned public frontend assets at build time.

No lifecycle scripts, optimizer, WASM, runtime CDN, or credentials are used.
An unpinned bootstrap is permitted on a PR only; production builds refuse it.
"""
from __future__ import annotations
import hashlib
import json
import os
import re
from pathlib import Path
try:
    from tools.http_client import request_bytes
except ModuleNotFoundError:
    from http_client import request_bytes

ROOT=Path(__file__).resolve().parents[1]


def verify(raw: bytes, expected: str | None, bootstrap: bool=False) -> str:
    actual=hashlib.sha256(raw).hexdigest()
    if expected is None:
        if not bootstrap: raise ValueError("Unpinned frontend dependency refused")
    elif not re.fullmatch(r"[a-f0-9]{64}",expected) or actual!=expected:
        raise ValueError("Frontend dependency digest mismatch")
    return actual


def install(root: Path=ROOT, bootstrap: bool=False):
    lock=json.loads((root/"tools/vendor-lock.json").read_text())
    for item in lock["files"]:
        name=item["path"]
        if not re.fullmatch(r"vendor/[A-Za-z0-9_.-]+",name): raise ValueError("Unsafe vendor path")
        url=item["url"]
        if not url.startswith("https://cdn.jsdelivr.net/npm/"+item["package"]+"@"+item["version"]+"/"):
            raise ValueError("Vendor URL does not match pinned package version")
        target=root/"app"/name
        if target.exists() and item["sha256"]:
            try: verify(target.read_bytes(),item["sha256"]); continue
            except ValueError: pass
        raw=request_bytes(url,step="build.vendor."+item["package"],max_bytes=2*1024*1024)
        actual=verify(raw,item["sha256"],bootstrap)
        print("[vendor-hash]",name,actual,"bytes",len(raw))
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(raw)

if __name__=="__main__":
    install(bootstrap=os.environ.get("GITHUB_EVENT_NAME")=="pull_request")
