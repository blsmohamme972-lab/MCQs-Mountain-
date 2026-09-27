#!/usr/bin/env python3
"""Validate a complete single- or multipart MCQ book release.

Usage:
    python validate_release.py BOOK_v1.zip [BOOK_v1_part2of3.zip ...]

Exit code 0 = PASS, 1 = FAIL.
"""

from __future__ import annotations
import json
import sys
import zipfile
from pathlib import Path


def fail(msg: str, errors: list[str]) -> None:
    errors.append(msg)


def read_json(zf: zipfile.ZipFile, name: str):
    try:
        return json.loads(zf.read(name).decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"{name}: {exc}") from exc


def read_jsonl(zf: zipfile.ZipFile, name: str):
    out = []
    for n, raw in enumerate(zf.read(name).decode("utf-8").splitlines(), 1):
        if not raw.strip():
            continue
        try:
            out.append(json.loads(raw))
        except Exception as exc:
            raise ValueError(f"{name} line {n}: {exc}") from exc
    return out


def load_package(path: Path):
    with zipfile.ZipFile(path) as zf:
        book = read_json(zf, "book.json")
        questions = read_jsonl(zf, "questions.jsonl")
        audit = read_json(zf, "audit.json") if "audit.json" in zf.namelist() else None
        return book, questions, audit


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: python validate_release.py BOOK.zip [more parts...]")
        return 1

    errors: list[str] = []
    packages = []

    for raw in argv[1:]:
        path = Path(raw)
        try:
            book, questions, audit = load_package(path)
            packages.append((path, book, questions, audit))
        except Exception as exc:
            fail(f"{path.name}: {exc}", errors)

    if errors:
        for e in errors:
            print("ERROR:", e)
        print(f"RESULT: FAIL ({len(errors)} errors)")
        return 1

    first = packages[0][1]
    identity = {
        "book_id": first.get("book_id"),
        "version": first.get("version"),
        "title": first.get("title"),
        "expected_count": first.get("expected_count"),
    }

    parts: dict[int, tuple] = {}
    seen_ids: dict[int, str] = {}
    skipped_ids: dict[int, str] = {}

    for path, book, questions, audit in packages:
        for key, value in identity.items():
            if book.get(key) != value:
                fail(f"{path.name}: {key} differs ({book.get(key)!r} != {value!r})", errors)

        part = book.get("part") or {}
        idx = part.get("index")
        total = part.get("total")
        if not isinstance(idx, int) or not isinstance(total, int) or idx < 1 or total < 1 or idx > total:
            fail(f"{path.name}: invalid part metadata", errors)
            continue
        if idx in parts:
            fail(f"{path.name}: duplicate part index {idx}", errors)
        parts[idx] = (path, book, questions, audit)

        id_range = book.get("id_range")
        if not (isinstance(id_range, list) and len(id_range) == 2 and all(isinstance(x, int) for x in id_range)):
            fail(f"{path.name}: invalid id_range", errors)

        local_ids = []
        for q in questions:
            lid = q.get("local_id")
            if not isinstance(lid, int):
                fail(f"{path.name}: question with invalid local_id {lid!r}", errors)
                continue
            local_ids.append(lid)
            if lid in seen_ids:
                fail(f"{path.name}: local_id {lid} already appears in {seen_ids[lid]}", errors)
            seen_ids[lid] = path.name

        for s in book.get("skipped") or []:
            lid = s.get("local_id") if isinstance(s, dict) else None
            if not isinstance(lid, int):
                fail(f"{path.name}: invalid skipped local_id {lid!r}", errors)
                continue
            if lid in skipped_ids:
                fail(f"{path.name}: skipped local_id {lid} duplicated", errors)
            if lid in seen_ids:
                fail(f"{path.name}: local_id {lid} appears in questions and skipped", errors)
            skipped_ids[lid] = path.name

        if audit is not None:
            results = audit.get("results")
            if not isinstance(results, list):
                fail(f"{path.name}: audit.results must be a list", errors)
            else:
                audit_ids = [r.get("local_id") for r in results if isinstance(r, dict)]
                if len(audit_ids) != len(set(audit_ids)):
                    fail(f"{path.name}: duplicate local_id in audit results", errors)
                qids = {q.get("local_id") for q in questions}
                if set(audit_ids) != qids:
                    missing = sorted(qids - set(audit_ids))
                    extra = sorted(set(audit_ids) - qids)
                    if missing:
                        fail(f"{path.name}: audit missing local_ids {missing[:20]}", errors)
                    if extra:
                        fail(f"{path.name}: audit has unknown local_ids {extra[:20]}", errors)
                mismatches = [r.get("local_id") for r in results if isinstance(r, dict) and r.get("level") == "mismatch"]
                if mismatches:
                    fail(f"{path.name}: audit contains mismatches {mismatches[:20]}", errors)

    totals = {p[1].get("part", {}).get("total") for p in packages}
    if len(totals) != 1:
        fail(f"part.total differs across packages: {sorted(totals)}", errors)
    else:
        total = next(iter(totals))
        if isinstance(total, int):
            expected_parts = set(range(1, total + 1))
            missing_parts = sorted(expected_parts - set(parts))
            extra_parts = sorted(set(parts) - expected_parts)
            if missing_parts:
                fail(f"missing parts: {missing_parts}", errors)
            if extra_parts:
                fail(f"unexpected part indexes: {extra_parts}", errors)

    ranges = []
    for idx, (_, book, _, _) in sorted(parts.items()):
        r = book.get("id_range")
        if isinstance(r, list) and len(r) == 2 and all(isinstance(x, int) for x in r):
            ranges.append((r[0], r[1], idx))
    ranges.sort()
    for (a1, a2, ai), (b1, b2, bi) in zip(ranges, ranges[1:]):
        if b1 <= a2:
            fail(f"part {bi} id_range overlaps part {ai}", errors)
        elif b1 != a2 + 1:
            fail(f"gap between part {ai} ending {a2} and part {bi} starting {b1}", errors)

    if ranges:
        lo, hi = ranges[0][0], ranges[-1][1]
        present = set(seen_ids) | set(skipped_ids)
        missing = [i for i in range(lo, hi + 1) if i not in present]
        if missing:
            fail(f"release has missing local_ids: {missing[:30]}{'...' if len(missing) > 30 else ''}", errors)

    expected_count = identity["expected_count"]
    if isinstance(expected_count, int):
        actual = len(seen_ids) + len(skipped_ids)
        if actual != expected_count:
            fail(f"questions + skipped = {actual}, expected_count = {expected_count}", errors)

    if errors:
        for e in errors:
            print("ERROR:", e)
        print(f"RESULT: FAIL ({len(errors)} errors)")
        return 1

    print(f"Book: {identity['book_id']} v{identity['version']}")
    print(f"Parts: {len(parts)}")
    print(f"Questions: {len(seen_ids)}")
    print(f"Skipped: {len(skipped_ids)}")
    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
