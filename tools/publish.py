#!/usr/bin/env python3
"""Build production chapter packs from one validated Kafu book package/release.

This tool is deliberately deterministic and local-file based. GitHub Actions supplies
content.sqlite and the package ZIP(s), then uploads the updated DB and generated packs.

Usage:
    python publish.py --db content.sqlite --out dist/content BOOK_v1.zip [parts...]

Stable-ID rules:
  1. Exact fingerprint match in the same book -> reuse ID.
  2. Exact chapter_id + source_number match, if unique -> reuse ID.
  3. Same local_id with stem similarity >= 0.80 -> reuse ID.
  4. Ambiguous candidate -> stop; never guess identity.
  5. Otherwise allocate a new Q######### ID.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import sys
import unicodedata
import zipfile
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

VISIBLE_STATUSES = {"source_verified", "medical_verified"}


def norm(text: Any) -> str:
    text = unicodedata.normalize("NFKC", str(text or "")).lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def fingerprint(q: dict[str, Any]) -> str:
    payload = {
        "stem": norm(q.get("stem")),
        "options": [norm(x) for x in (q.get("options") or [])],
        "type": q.get("type"),
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def read_jsonl(raw: bytes) -> list[dict[str, Any]]:
    out = []
    for n, line in enumerate(raw.decode("utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except Exception as exc:
            raise ValueError(f"questions.jsonl line {n}: {exc}") from exc
        if not isinstance(obj, dict):
            raise ValueError(f"questions.jsonl line {n}: expected object")
        out.append(obj)
    return out


def load_release(paths: list[Path]):
    packages = []
    for path in paths:
        with zipfile.ZipFile(path) as zf:
            book = json.loads(zf.read("book.json").decode("utf-8"))
            questions = read_jsonl(zf.read("questions.jsonl"))
            audit = json.loads(zf.read("audit.json").decode("utf-8")) if "audit.json" in zf.namelist() else None
            images = {
                name: zf.read(name)
                for name in zf.namelist()
                if name.startswith("images/") and not name.endswith("/")
            }
            cover = zf.read("cover.webp") if "cover.webp" in zf.namelist() else None
            packages.append((path, book, questions, audit, images, cover))

    packages.sort(key=lambda x: (x[1].get("part") or {}).get("index", 1))
    base = packages[0][1]
    book_id = base["book_id"]
    version = int(base["version"])

    questions: list[dict[str, Any]] = []
    images: dict[str, bytes] = {}
    audit_by_id: dict[int, dict[str, Any]] = {}
    cover = None

    for path, book, qs, audit, imgs, cov in packages:
        if book.get("book_id") != book_id or int(book.get("version")) != version:
            raise ValueError(f"{path.name}: release identity mismatch")
        questions.extend(qs)
        for name, data in imgs.items():
            if name in images and images[name] != data:
                raise ValueError(f"conflicting image bytes for {name}")
            images[name] = data
        if cov is not None:
            if cover is not None and cover != cov:
                raise ValueError("multiple different covers in release")
            cover = cov
        if audit:
            for row in audit.get("results") or []:
                lid = row.get("local_id")
                if isinstance(lid, int):
                    if lid in audit_by_id:
                        raise ValueError(f"duplicate audit local_id {lid}")
                    audit_by_id[lid] = row

    questions.sort(key=lambda q: int(q["local_id"]))
    return base, questions, audit_by_id, images, cover


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS books (
  book_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS id_map (
  book_id TEXT NOT NULL,
  local_id INTEGER NOT NULL,
  permanent_id TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  chapter_id TEXT,
  source_number TEXT,
  stem_norm TEXT NOT NULL,
  first_version INTEGER NOT NULL,
  last_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY(book_id, local_id)
);
CREATE INDEX IF NOT EXISTS idx_idmap_book_fp ON id_map(book_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_idmap_book_source ON id_map(book_id, chapter_id, source_number);
CREATE TABLE IF NOT EXISTS questions (
  permanent_id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  local_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  question_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_questions_book ON questions(book_id, local_id);
CREATE TABLE IF NOT EXISTS published_packages (
  sha256 TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    row = conn.execute("SELECT value FROM meta WHERE key='next_question_id'").fetchone()
    if row is None:
        max_id = 0
        for (pid,) in conn.execute("SELECT permanent_id FROM id_map"):
            m = re.fullmatch(r"Q(\d{9})", pid)
            if m:
                max_id = max(max_id, int(m.group(1)))
        conn.execute("INSERT INTO meta(key,value) VALUES('next_question_id',?)", (str(max_id + 1),))


def allocate_id(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT value FROM meta WHERE key='next_question_id'").fetchone()
    n = int(row[0])
    if n > 999_999_999:
        raise RuntimeError("permanent question ID space exhausted")
    pid = f"Q{n:09d}"
    conn.execute("UPDATE meta SET value=? WHERE key='next_question_id'", (str(n + 1),))
    return pid


def existing_rows(conn: sqlite3.Connection, book_id: str) -> list[dict[str, Any]]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM id_map WHERE book_id=?", (book_id,)).fetchall()
    return [dict(r) for r in rows]


def choose_existing(q: dict[str, Any], rows: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, str]:
    fp = fingerprint(q)
    chapter = str(q.get("chapter_id", ""))
    source_number = str(q.get("source_number", ""))
    lid = int(q["local_id"])
    stem = norm(q.get("stem"))

    exact_fp = [r for r in rows if r["fingerprint"] == fp]
    if len(exact_fp) == 1:
        return exact_fp[0], "fingerprint"
    if len(exact_fp) > 1:
        raise ValueError(f"local_id {lid}: ambiguous fingerprint mapping")

    by_source = [
        r for r in rows
        if (r.get("chapter_id") or "") == chapter
        and (r.get("source_number") or "") == source_number
        and source_number
    ]
    if len(by_source) == 1:
        return by_source[0], "source_number"
    if len(by_source) > 1:
        raise ValueError(f"local_id {lid}: ambiguous chapter/source_number mapping")

    same_local = [r for r in rows if int(r["local_id"]) == lid]
    if len(same_local) == 1:
        ratio = SequenceMatcher(None, stem, same_local[0].get("stem_norm") or "").ratio()
        if ratio >= 0.80:
            return same_local[0], "local_id_similarity"

    return None, "new"


def audit_status(q: dict[str, Any], audit_by_id: dict[int, dict[str, Any]]) -> str:
    """Future audit warnings and parser flags stay visible; only explicit moderation can hold."""
    if q.get("status") == "medical_verified":
        return "medical_verified"
    audit = audit_by_id.get(int(q["local_id"]))
    if audit and audit.get("level") == "mismatch":
        raise ValueError(f"local_id {q['local_id']}: audit mismatch must be removed before publish")
    return "source_verified"


def warning_reasons(q: dict[str, Any], audit_by_id: dict[int, dict[str, Any]]) -> list[str]:
    reasons: list[str] = []
    audit = audit_by_id.get(int(q["local_id"]))
    if audit and audit.get("level") in {"warning", "unverifiable"}:
        detail = str(audit.get("detail") or audit.get("level"))
        reasons.append(f"audit {audit.get('level')}: {detail}")
    if str(q.get("flag") or "").strip():
        reasons.append(f"parser flag: {str(q['flag']).strip()}")
    return reasons


def replace_image_names(q: dict[str, Any], permanent_id: str) -> tuple[dict[str, Any], dict[str, str]]:
    q2 = json.loads(json.dumps(q, ensure_ascii=False))
    mapping = {}
    for field, exp in (("images", False), ("explanation_images", True)):
        new = []
        for idx, old in enumerate(q2.get(field) or [], 1):
            suffix = f"_e{idx}" if exp else f"_{idx}"
            new_name = f"{permanent_id}{suffix}.webp"
            mapping[old] = new_name
            new.append(new_name)
        q2[field] = new
    return q2, mapping


def write_image_zip(path: Path, members: dict[str, bytes]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED) as zf:
        for name in sorted(members):
            zf.writestr(name, members[name])


def safe_slug(value: Any) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "-", str(value)).strip("-") or "chapter"


SPECIALTY_COLORS = [
    "#16606A", "#7A3B52", "#A8323E", "#6B6E3C",
    "#4A5F8A", "#795548", "#4E6B50", "#705A8A",
]


def specialty_color(name: str) -> str:
    digest = hashlib.sha256(name.encode("utf-8")).digest()
    return SPECIALTY_COLORS[digest[0] % len(SPECIALTY_COLORS)]


def route_shard(permanent_id: str) -> str:
    # Q000001234 -> Q000001.json; at most 1,000 question routes per file.
    if not re.fullmatch(r"Q\d{9}", permanent_id):
        raise ValueError(f"invalid permanent id for route: {permanent_id}")
    return permanent_id[:7]


def rebuild_question_routes(conn: sqlite3.Connection, out: Path, base_url: str) -> None:
    routes_dir = out / "routes"
    if routes_dir.exists():
        for old in routes_dir.glob("Q*.json"):
            old.unlink()
    routes_dir.mkdir(parents=True, exist_ok=True)

    shards: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    rows = conn.execute(
        "SELECT permanent_id, book_id, question_json FROM questions "
        "WHERE status IN ('source_verified','medical_verified') ORDER BY permanent_id"
    ).fetchall()
    for row in rows:
        q = json.loads(row["question_json"])
        pid = row["permanent_id"]
        shards[route_shard(pid)][pid] = {
            "book_id": row["book_id"],
            "chapter_id": q.get("chapter_id"),
        }

    for shard, mapping in shards.items():
        payload = {"schema": 1, "routes": mapping}
        (routes_dir / f"{shard}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )


def load_catalog(path: Path) -> dict[str, Any]:
    if path.exists():
        obj = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(obj, dict):
            return obj
    return {
        "schema": 1,
        "updated_at": None,
        "fields": [],
        "specialties": [],
        "books": [],
        "removed_books": [],
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("packages", nargs="+")
    ap.add_argument("--db", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--base-url", default="")
    ap.add_argument("--allow-version-reuse", action="store_true", help="Admin rollback/moderation only")
    ap.add_argument("--decisions", help="JSON permanent-ID map: approved or rejected")
    args = ap.parse_args(argv)
    decisions = json.loads(Path(args.decisions).read_text()) if args.decisions else {}
    if not isinstance(decisions, dict) or any(k not in {"approved", "rejected"} for k in decisions.values()):
        raise ValueError("Invalid moderation decisions")

    paths = [Path(x) for x in args.packages]
    book, questions, audits, image_bytes, cover = load_release(paths)
    book_id = book["book_id"]
    version = int(book["version"])
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    init_db(conn)
    conn.commit()

    current_book = conn.execute("SELECT version FROM books WHERE book_id=?", (book_id,)).fetchone()
    if current_book and version <= int(current_book[0]) and not args.allow_version_reuse:
        raise ValueError(f"{book_id}: incoming version {version} must be greater than published version {current_book[0]}")

    old_rows = existing_rows(conn, book_id)
    matched_old_pids: set[str] = set()
    report = {"kept": [], "edited": [], "new": [], "retired": [], "held": [], "held_details": [],
              "warnings": [], "skipped": []}
    chapter_questions: dict[str, list[dict[str, Any]]] = defaultdict(list)
    chapter_images: dict[str, dict[str, bytes]] = defaultdict(dict)

    try:
        conn.execute("BEGIN IMMEDIATE")
        for q in questions:
            audit = audits.get(int(q["local_id"]))
            if audit and audit.get("level") == "mismatch":
                report["skipped"].append({
                    "local_id": int(q["local_id"]),
                    "source_number": str(q.get("source_number", "")),
                    "source_page": q.get("source_page"),
                    "reason": "audit mismatch reached publisher",
                })
                continue
            selected, reason = choose_existing(q, old_rows)
            fp = fingerprint(q)
            if selected:
                pid = selected["permanent_id"]
                if pid in matched_old_pids:
                    raise ValueError(f"local_id {q['local_id']}: permanent ID {pid} matched twice")
                matched_old_pids.add(pid)
                if selected["fingerprint"] == fp:
                    report["kept"].append(pid)
                else:
                    report["edited"].append(pid)
            else:
                pid = allocate_id(conn)
                report["new"].append(pid)

            status = audit_status(q, audits)
            if pid in decisions:
                status = "source_verified" if decisions[pid] == "approved" else "held"
            if status == "held":
                report["held"].append(pid)
                report["held_details"].append({"qid": pid, "book_id": book_id, "source_page": q.get("source_page")})

            reasons = warning_reasons(q, audits)
            if reasons:
                report["warnings"].append({
                    "qid": pid,
                    "local_id": int(q["local_id"]),
                    "source_number": str(q.get("source_number", "")),
                    "source_page": q.get("source_page"),
                    "reasons": reasons,
                })

            q2, img_map = replace_image_names(q, pid)
            q2["id"] = pid
            q2["book_id"] = book_id
            q2["status"] = status
            q2["version"] = version

            chapter = str(q.get("chapter_id"))
            if status in VISIBLE_STATUSES:
                chapter_questions[chapter].append(q2)
                for old_name, new_name in img_map.items():
                    key = old_name if old_name.startswith("images/") else f"images/{old_name}"
                    if key not in image_bytes:
                        raise ValueError(f"local_id {q['local_id']}: missing image bytes {key}")
                    chapter_images[chapter][new_name] = image_bytes[key]

            conn.execute(
                """INSERT INTO id_map(book_id,local_id,permanent_id,fingerprint,chapter_id,source_number,stem_norm,first_version,last_version,status)
                   VALUES(?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(book_id,local_id) DO UPDATE SET
                     permanent_id=excluded.permanent_id,
                     fingerprint=excluded.fingerprint,
                     chapter_id=excluded.chapter_id,
                     source_number=excluded.source_number,
                     stem_norm=excluded.stem_norm,
                     last_version=excluded.last_version,
                     status=excluded.status""",
                (book_id, int(q["local_id"]), pid, fp, chapter, str(q.get("source_number", "")), norm(q.get("stem")),
                 int(selected["first_version"]) if selected else version, version, status),
            )
            conn.execute(
                """INSERT INTO questions(permanent_id,book_id,local_id,version,status,question_json,updated_at)
                   VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)
                   ON CONFLICT(permanent_id) DO UPDATE SET
                     local_id=excluded.local_id, version=excluded.version, status=excluded.status,
                     question_json=excluded.question_json, updated_at=CURRENT_TIMESTAMP""",
                (pid, book_id, int(q["local_id"]), version, status, json.dumps(q2, ensure_ascii=False, separators=(",", ":"))),
            )

        for old in old_rows:
            if old["permanent_id"] not in matched_old_pids:
                report["retired"].append(old["permanent_id"])
                conn.execute("UPDATE id_map SET status='retired', last_version=? WHERE permanent_id=?", (version, old["permanent_id"]))
                conn.execute("UPDATE questions SET status='retired', version=?, updated_at=CURRENT_TIMESTAMP WHERE permanent_id=?", (version, old["permanent_id"]))

        conn.execute(
            """INSERT INTO books(book_id,version,title,metadata_json,updated_at)
               VALUES(?,?,?,?,CURRENT_TIMESTAMP)
               ON CONFLICT(book_id) DO UPDATE SET version=excluded.version,title=excluded.title,
               metadata_json=excluded.metadata_json,updated_at=CURRENT_TIMESTAMP""",
            (book_id, version, book.get("title", book_id), json.dumps(book, ensure_ascii=False, separators=(",", ":"))),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise

    book_dir = out / "books" / book_id / f"v{version}"
    packs_dir = out / "packs" / book_id / f"v{version}"
    covers_dir = out / "covers"
    book_dir.mkdir(parents=True, exist_ok=True)
    packs_dir.mkdir(parents=True, exist_ok=True)
    covers_dir.mkdir(parents=True, exist_ok=True)

    if cover:
        (covers_dir / f"{book_id}-v{version}.webp").write_bytes(cover)

    chapter_index = []
    for chapter_meta in book.get("chapters") or []:
        chapter_id = str(chapter_meta.get("id"))
        qs = chapter_questions.get(chapter_id, [])
        text_payload = {
            "schema": 1,
            "book_id": book_id,
            "chapter_id": chapter_meta.get("id"),
            "version": version,
            "questions": qs,
        }
        raw = (json.dumps(text_payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
        text_hash = hashlib.sha256(raw).hexdigest()[:12]
        text_name = f"chapter-{safe_slug(chapter_id)}.v{version}.{text_hash}.json"
        (packs_dir / text_name).write_bytes(raw)

        image_name = None
        if chapter_images.get(chapter_id):
            temp = packs_dir / f"chapter-{safe_slug(chapter_id)}.images.v{version}.zip"
            write_image_zip(temp, chapter_images[chapter_id])
            image_hash = hashlib.sha256(temp.read_bytes()).hexdigest()[:12]
            image_name = f"chapter-{safe_slug(chapter_id)}.images.v{version}.{image_hash}.zip"
            temp.rename(packs_dir / image_name)

        base = args.base_url.rstrip("/")
        rel_text = f"/packs/{book_id}/v{version}/{text_name}"
        rel_img = f"/packs/{book_id}/v{version}/{image_name}" if image_name else None
        chapter_index.append({
            "id": chapter_meta.get("id"),
            "title": chapter_meta.get("title", f"Chapter {chapter_id}"),
            "questions": len(qs),
            "qids": [q["id"] for q in qs],
            "url": base + rel_text if base else rel_text,
            "image_url": (base + rel_img) if base and rel_img else rel_img,
            "bytes": len(raw),
        })

    book_index = {
        "schema": 1,
        "book_id": book_id,
        "version": version,
        "title": book.get("title", book_id),
        "authors": book.get("authors") or [],
        "field": book.get("field"),
        "specialty": book.get("specialty"),
        "collection_type": book.get("collection_type"),
        "language": book.get("language"),
        "question_count": sum(x["questions"] for x in chapter_index),
        "cover_url": (args.base_url.rstrip("/") + f"/covers/{book_id}-v{version}.webp") if args.base_url and cover else (f"/covers/{book_id}-v{version}.webp" if cover else None),
        "chapters": chapter_index,
    }
    index_path = book_dir / "index.json"
    index_path.write_text(json.dumps(book_index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    catalog_path = out / "catalog.json"
    catalog = load_catalog(catalog_path)
    books = [b for b in (catalog.get("books") or []) if b.get("id") != book_id]
    catalog_book = {
        "id": book_id,
        "title": book.get("title", book_id),
        "authors": book.get("authors") or [],
        "field": book.get("field"),
        "specialty": book.get("specialty"),
        "collection_type": book.get("collection_type"),
        "version": version,
        "questions": book_index["question_count"],
        "cover_url": book_index["cover_url"],
        "index_url": (args.base_url.rstrip("/") + f"/books/{book_id}/v{version}/index.json") if args.base_url else f"/books/{book_id}/v{version}/index.json",
        "chapters": chapter_index,
    }
    books.append(catalog_book)
    books.sort(key=lambda b: (b.get("field") or "", b.get("specialty") or "", b.get("title") or ""))
    catalog["books"] = books

    # The app reads fields/specialties directly from catalog.json. Generate them
    # from active books so publishing one real book never produces an empty Library.
    field_ids = sorted({b.get("field") for b in books if b.get("field")})
    default_titles = {
        "medicine": {"en": "Medicine", "ar": "الطب"},
        "pharmacy": {"en": "Pharmacy", "ar": "الصيدلة"},
        "dentistry": {"en": "Dentistry", "ar": "طب الأسنان"},
    }
    catalog["fields"] = [
        {"id": fid, "title": default_titles.get(fid, {"en": fid.title(), "ar": fid})}
        for fid in field_ids
    ]
    specialty_pairs = sorted({
        (b.get("specialty"), b.get("field"))
        for b in books if b.get("specialty") and b.get("field")
    })
    catalog["specialties"] = [
        {"id": spec, "field": field, "color": specialty_color(spec)}
        for spec, field in specialty_pairs
    ]

    catalog["removed_books"] = [x for x in (catalog.get("removed_books") or []) if x != book_id]
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Deep-link routing is sharded by permanent ID prefix, so startapp=Q#########
    # resolves with one tiny static request even at very large question counts.
    rebuild_question_routes(conn, out, args.base_url)

    report_path = out / f"publish-report-{book_id}-v{version}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "book_id": book_id,
        "version": version,
        "visible_questions": sum(len(x) for x in chapter_questions.values()),
        "held": len(report["held"]),
        "warnings": len(report["warnings"]),
        "skipped": len(report["skipped"]),
        "kept": len(report["kept"]),
        "edited": len(report["edited"]),
        "new": len(report["new"]),
        "retired": len(report["retired"]),
        "catalog": str(catalog_path),
        "report": str(report_path),
    }, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
