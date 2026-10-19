"""Download the fantasy-world art packs (D28) listed in tools/worlds-lock.json into game-lab/assets-test/src/worlds/
(git-ignored) and unpack them. TEST ONLY: nothing downloaded here may be committed or copied into app/ (D15, D22).

Each pack is a free itch.io download. The request mirrors itch.io's own page script (extern.min.js): the page's
csrf_token, POST <page>/download_url (the "No thanks, just take me to the downloads" link), then POST
/<slug>/file/<upload_id>?source=game_download (plus the page's own options) for a signed file URL. No payment, no
login. A file whose SHA-256 differs from the lock is refused; zip members that would land outside the pack's folder
are skipped.

Usage: python3 game-lab/tools/fetch_worlds.py [name ...]   (all packs when no name is given)
"""
from __future__ import annotations
import hashlib
import http.cookiejar
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
LOCK = json.loads((LAB / "tools" / "worlds-lock.json").read_text())
OUT = LAB / "assets-test" / "src" / "worlds"
UA = [("User-Agent", "Mozilla/5.0 (Kafu game-lab asset fetch)")]


def fetch(page: str, upload: str) -> bytes:
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    op.addheaders = UA
    html = op.open(page).read().decode("utf8", "replace")
    csrf = re.search(r'name="csrf_token" value="([^"]+)"', html).group(1)
    r = json.loads(op.open(page + "/download_url", urllib.parse.urlencode({"csrf_token": csrf}).encode()).read())
    if not r.get("url"):
        raise SystemExit(f"{page}: no free download page ({r})")
    dh = op.open(r["url"]).read().decode("utf8", "replace")
    m = re.search(r"init_GameDownload\([^,]+,\s*(\{.*?\})\);", dh)
    opts = json.loads(m.group(1)) if m else {}
    slug = opts.get("game", {}).get("slug") or page.rstrip("/").split("/")[3]
    csrf = (re.search(r'name="csrf_token" value="([^"]+)"', dh) or re.search(r'name="csrf_token" value="([^"]+)"', html)).group(1)
    for m in re.finditer(r'data-upload_id="(\d+)".*?<strong[^>]*class="name"[^>]*>([^<]+)</strong>', dh, re.S):
        if m.group(2).strip() != upload:
            continue
        q = {"source": "game_download"}
        if opts.get("show_download_lightbox"):
            q.update(after_download_lightbox="1", as_props="1")
        if opts.get("key"):
            q["key"] = opts["key"]
        host = page.split("/")[2]
        f = json.loads(op.open(f"https://{host}/{slug}/file/{m.group(1)}?" + urllib.parse.urlencode(q),
                               urllib.parse.urlencode({"csrf_token": csrf}).encode()).read())
        if not f.get("url"):
            raise SystemExit(f"{page}: no file URL ({f})")
        return op.open(f["url"]).read()
    raise SystemExit(f"{page}: upload {upload} not found")


def unpack(zpath: Path, into: Path) -> int:
    n = 0
    root = into.resolve()
    with zipfile.ZipFile(zpath) as zf:
        for m in zf.infolist():
            p = (into / m.filename).resolve()
            if m.is_dir() or m.filename.startswith("__MACOSX") or root not in p.parents:
                continue
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(zf.read(m))
            n += 1
    return n


def main(names: list[str]) -> None:
    for pack in LOCK["packs"]:
        if names and pack["name"] not in names:
            continue
        d = OUT / pack["name"]
        z = d / pack["upload"]
        if not (z.exists() and hashlib.sha256(z.read_bytes()).hexdigest() == pack["sha256"]):
            raw = fetch(pack["page"], pack["upload"])
            h = hashlib.sha256(raw).hexdigest()
            if h != pack["sha256"]:
                raise SystemExit(f"{pack['name']}: SHA-256 {h} does not match the lock")
            d.mkdir(parents=True, exist_ok=True)
            z.write_bytes(raw)
            time.sleep(2)   # be gentle with itch.io (it rate-limits bursts)
        n = unpack(z, d / "x")
        print(f"[worlds] {pack['name']}: {pack['upload']} ok, {n} files")


if __name__ == "__main__":
    main(sys.argv[1:])
