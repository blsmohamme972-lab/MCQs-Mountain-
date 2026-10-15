#!/usr/bin/env python3
"""Checks that must pass before the next stage starts (Head Department). Exit code 0 only when everything is OK.

  preflight.py export FILE            the app export passes the project's own adapt_exports (integrity rows, content hash,
                                      fingerprint, book identity) and every question has a key that resolves
  preflight.py images PREFIX [--fast] every question of the packages PREFIX-* has exactly one image in Drive named
                                      <QID>.png, and (without --fast) each opens and is landscape 3:2 of at least 1200 px
  preflight.py zips DIR PREFIX        every MCARDS_<PKG>_r1.zip in DIR passes validate_package, is at most
                                      max_package_zip_mb, and holds exactly its package's QIDs; lists packages still missing
  preflight.py coverage DIR PREFIX    the merged parts in DIR pass validate_package, are at most merge_part_mb, and
                                      together hold every question of PREFIX exactly once; prints byte size and sha256

The project code is read from KAFU_MOUNTAIN (default: the repository this folder is in). Point it at an up-to-date
checkout of main so the checks are the same as the bot's.
"""
import hashlib
import io
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import watch  # noqa: E402

MOUNTAIN = Path(os.environ.get("KAFU_MOUNTAIN", HERE.parent))
sys.path.insert(0, str(MOUNTAIN))
CONFIG = watch.CONFIG
NAME_RE = re.compile(r"^Q\d{9}\.png$")


def pkgs(prefix):
    pk = {k: v for k, v in watch.packages().items() if k.startswith(prefix + "-")}
    if not pk:
        sys.exit(f"no packages {prefix}-* in {watch.QUEUE}")
    return pk


def check_export(path):
    from motioncards.lib import core
    try:
        env = json.loads(Path(path).read_text())
        ad = core.adapt_exports([env])
    except Exception as e:  # noqa: BLE001
        print(f"FAIL export rejected by adapt_exports: {e} (ask the owner for the full app export, with question_integrity)")
        return False
    bad = []
    for q in ad.questions:
        try:
            core.resolve_answer(q)
        except Exception as e:  # noqa: BLE001
            bad.append(f"{q.get('id')}: {e}")
    nums = [q.get("source_number") for q in env["questions"]]
    print(f"export OK: {len(ad.questions)} questions, integrity rows {len(ad.integrity)}, "
          f"book {ad.book.get('id') if isinstance(ad.book, dict) else ''}, numbers {nums[0]}..{nums[-1]}")
    if len(set(map(str, nums))) != len(nums):
        bad.append("duplicate source_number")
    for b in bad:
        print("FAIL", b)
    return not bad


def check_images(prefix, fast):
    every = []
    watch.list_drive(CONFIG["drive_folder_id"], every=every)
    by = {}
    for name, fid in every:
        stem = os.path.splitext(name)[0].strip().upper()
        by.setdefault(stem[:10], []).append((name, fid))
    bad, total = [], 0
    for pkg, q in pkgs(prefix).items():
        for it in q["items"]:
            total += 1
            qid = it["qid"].upper()
            have = by.get(qid, [])
            exact = [x for x in have if NAME_RE.match(x[0]) and x[0][:10].upper() == qid]
            if not have:
                bad.append(f"Q{it.get('number')} {qid}: missing")
            elif len(have) > 1:
                bad.append(f"Q{it.get('number')} {qid}: {len(have)} files {[n for n, _ in have]} (keep one, named {qid}.png)")
            elif not exact:
                bad.append(f"Q{it.get('number')} {qid}: wrong name {have[0][0]!r} (must be {qid}.png)")
            elif not fast:
                from PIL import Image
                try:
                    im = Image.open(io.BytesIO(watch.download(have[0][1])))
                    im.load()
                    w = watch.image_warning(im)
                    if w:
                        bad.append(f"Q{it.get('number')} {qid}: {im.size[0]}x{im.size[1]}{w}")
                except Exception as e:  # noqa: BLE001
                    bad.append(f"Q{it.get('number')} {qid}: does not open ({type(e).__name__})")
    for b in bad:
        print("FAIL", b)
    print(f"images: {total - len(bad)}/{total} OK" + ("" if fast else " (opened and measured)") +
          f"; Drive lists {len(every)} file(s)")
    return not bad


def check_zips(d, prefix):
    from motioncards.lib import package as P
    cap = CONFIG["max_package_zip_mb"] * 1024 * 1024
    bad, done = [], 0
    pk = pkgs(prefix)
    for pkg, q in pk.items():
        f = Path(d) / f"MCARDS_{pkg}_r1.zip"
        if not f.exists():
            bad.append(f"{pkg}: no ZIP yet")
            continue
        try:
            m = P.validate_package(f)
        except Exception as e:  # noqa: BLE001
            bad.append(f"{pkg}: validate failed {e}")
            continue
        want = {it["qid"] for it in q["items"]}
        got = {a["qid"] for a in m["animations"]}
        if got != want:
            bad.append(f"{pkg}: lessons {sorted(got)} != package {sorted(want)} (missing {sorted(want - got)})")
        elif f.stat().st_size > cap:
            bad.append(f"{pkg}: {f.stat().st_size} B is over {CONFIG['max_package_zip_mb']} MB")
        else:
            done += 1
    for b in bad:
        print("FAIL", b)
    print(f"zips: {done}/{len(pk)} packages OK")
    return not bad


def check_coverage(d, prefix):
    from motioncards.lib import package as P
    cap = CONFIG["merge_part_mb"] * 1024 * 1024
    want = [it["qid"] for q in pkgs(prefix).values() for it in q["items"]]
    seen, bad = [], []
    for f in sorted(Path(d).glob("MCARDS_*_r1.zip")):
        m = P.validate_package(f)
        qs = [a["qid"] for a in m["animations"]]
        seen += qs
        size = f.stat().st_size
        sha = hashlib.sha256(f.read_bytes()).hexdigest()
        print(f"{f.name}  {size} bytes  {len(qs)} lessons  sha256 {sha}")
        if size > cap:
            bad.append(f"{f.name}: over {CONFIG['merge_part_mb']} MB")
    dup = sorted({q for q in seen if seen.count(q) > 1})
    miss = sorted(set(want) - set(seen))
    extra = sorted(set(seen) - set(want))
    for label, xs in (("twice", dup), ("missing", miss), ("not in this chapter", extra)):
        if xs:
            bad.append(f"{label}: {xs}")
    for b in bad:
        print("FAIL", b)
    print(f"coverage: {len(set(seen) & set(want))}/{len(want)} questions, each once: {not dup}")
    return not bad


def main(a):
    if not a:
        sys.exit(__doc__)
    cmd = a[0]
    if cmd == "export":
        ok = check_export(a[1])
    elif cmd == "images":
        ok = check_images(a[1], "--fast" in a)
    elif cmd == "zips":
        ok = check_zips(a[1], a[2])
    elif cmd == "coverage":
        ok = check_coverage(a[1], a[2])
    else:
        sys.exit(__doc__)
    print("PREFLIGHT", cmd, "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
