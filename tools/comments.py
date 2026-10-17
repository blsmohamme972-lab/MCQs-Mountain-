#!/usr/bin/env python3
"""Kafu question comments: validate, pack and publish COMMENTS_<BOOK-ID>_r<N>.zip.

A pack holds one file, comments.json. It adds or replaces the comments of the questions it lists
(an empty list removes that question's comments); questions it does not list keep theirs, so a
book can be covered chapter by chapter. Every author is one of the Kafu characters, the Leaders
personas in app/modules/leaders-core.js, and the app labels each comment as written by one.

Published files (in the content tree served by kafu-content-1):
  comments/<BOOK-ID>.json                           index: revision, totals, one entry per shard
  packs/_comments/<BOOK-ID>/<Q0000xx>.<sha12>.json  up to 100 questions' comments, immutable
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import subprocess
import sys
import unicodedata
import zipfile
import zlib
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LEADERS_CORE = ROOT / "app/modules/leaders-core.js"
FILENAME = re.compile(r"^COMMENTS_([A-Z0-9][A-Z0-9-]{0,127})_r([1-9]\d{0,5})\.zip$", re.I)
BOOK_ID = re.compile(r"^[A-Z0-9][A-Z0-9-]{0,127}$")
QID = re.compile(r"^Q\d{9}$")
KINDS = ("note", "tip", "mnemonic", "clinical", "exam")
MEMBER = "comments.json"
FORMAT = "kafu-comments"
MAX_ZIP = 2 * 1024 * 1024
MAX_JSON = 16 * 1024 * 1024
MAX_QUESTIONS = 5000
MAX_TOP = 12          # comments under one question
MAX_REPLIES = 6       # replies under one comment
MAX_TOTAL = 40000     # comments and replies in one pack
TEXT_MIN, TEXT_MAX = 2, 600
LINK = re.compile(r"(?i)(?:https?://|www\.|\bt\.me/|\btelegram\.me/)")
BIDI_CONTROLS = set("‪‫‬‭‮⁦⁧⁨⁩")
MAX_ERRORS = 50
KEEP_SNAPSHOTS = 20   # revisions per book that /comments-restore can bring back

SCHEMA = """
CREATE TABLE IF NOT EXISTS question_comments (
  qid TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  comments_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS question_comments_book ON question_comments(book_id);
CREATE TABLE IF NOT EXISTS comment_uploads (
  book_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  questions INTEGER NOT NULL,
  comments INTEGER NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(book_id, revision)
);
-- The whole book's comments right after each upload, so any kept revision can be restored exactly.
CREATE TABLE IF NOT EXISTS comment_snapshots (
  book_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  state BLOB NOT NULL,
  questions INTEGER NOT NULL,
  comments INTEGER NOT NULL,
  PRIMARY KEY(book_id, revision)
);
-- Which revision students see now (after an upload, a restore or a clear).
CREATE TABLE IF NOT EXISTS comment_books (
  book_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('upload','restore','clear'))
);
"""


class PackError(ValueError):
    """A comment pack that must not be published, with every problem found (capped)."""

    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else list(problems)
        shown = self.problems[:15]
        more = len(self.problems) - len(shown)
        super().__init__("; ".join(shown) + (f"; and {more} more" if more > 0 else ""))


@dataclass(frozen=True)
class Pack:
    book_id: str
    revision: int
    questions: dict[str, list[dict[str, Any]]]
    sha256: str

    @property
    def comments(self) -> int:
        return count_comments(self.questions)


def personas(path: Path = LEADERS_CORE) -> list[str]:
    """The Leaders persona names, read from the same file the app uses."""
    text = path.read_text(encoding="utf-8")
    match = re.search(r"const NAMES=\[(.*?)\];", text, re.S)
    if not match:
        raise RuntimeError("Leaders persona list (const NAMES) not found in leaders-core.js")
    names = re.findall(r"'([^'\\]*)'", match.group(1))
    if len(names) < 10 or len(set(names)) != len(names):
        raise RuntimeError("Leaders persona list is empty or has duplicates")
    return names


def people(path: Path = LEADERS_CORE) -> list[dict[str, Any]]:
    """Each persona as the app shows it (picture, tag, role), computed by leaders-core.js itself."""
    script = "const L=require(process.argv[1]);process.stdout.write(JSON.stringify(L.people()))"
    out = subprocess.run(["node", "-e", script, str(path)], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def persona_table() -> str:
    rows = ["| Author (copy exactly) | | Training |", "|---|---|---|"]
    for p in people():
        rows.append(f"| `{p['name']}` | {'woman' if p['woman'] else 'man'} | {p['line']}, {p['city']} |")
    return "\n".join(rows)


def count_comments(questions: dict[str, list[dict[str, Any]]]) -> int:
    return sum(1 + len(c.get("replies") or []) for comments in questions.values() for c in comments)


def _no_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in out:
            raise ValueError(f"duplicate JSON key {key!r}")
        out[key] = value
    return out


def _no_constants(value: str) -> Any:
    raise ValueError(f"JSON constant {value} is not allowed")


def loads(raw: bytes) -> Any:
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise PackError(f"{MEMBER} is not UTF-8: {exc}") from exc
    try:
        return json.loads(text, object_pairs_hook=_no_duplicate_keys, parse_constant=_no_constants)
    except ValueError as exc:
        raise PackError(f"{MEMBER} is not valid JSON: {exc}") from exc


def clean_text(value: Any, where: str, problems: list[str]) -> str | None:
    if not isinstance(value, str):
        problems.append(f"{where}.text must be a string")
        return None
    text = unicodedata.normalize("NFC", value).replace("\r\n", "\n").replace("\r", "\n")
    text = "\n".join(re.sub(r"[ \t ]+", " ", line).strip() for line in text.split("\n"))
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    bad = sorted({f"U+{ord(c):04X}" for c in text
                  if (unicodedata.category(c) == "Cc" and c != "\n") or c in BIDI_CONTROLS})
    if bad:
        problems.append(f"{where}.text has control characters {', '.join(bad[:5])}")
        return None
    if not TEXT_MIN <= len(text) <= TEXT_MAX:
        problems.append(f"{where}.text must be {TEXT_MIN}–{TEXT_MAX} characters (has {len(text)})")
        return None
    if LINK.search(text):
        problems.append(f"{where}.text must not contain links")
        return None
    return text


def clean_comment(value: Any, where: str, names: set[str], problems: list[str], reply: bool) -> dict[str, Any] | None:
    allowed = {"author", "text", "kind"} if reply else {"author", "text", "kind", "replies"}
    if not isinstance(value, dict):
        problems.append(f"{where} must be an object")
        return None
    unknown = sorted(set(value) - allowed)
    if unknown:
        problems.append(f"{where} has unknown field(s) {', '.join(unknown)}"
                        + (" (replies cannot have replies)" if reply and "replies" in unknown else ""))
        return None
    author = value.get("author")
    if not isinstance(author, str) or unicodedata.normalize("NFC", author) not in names:
        problems.append(f"{where}.author {author!r} is not a Kafu character (see `python tools/comments.py personas`)")
        return None
    text = clean_text(value.get("text"), where, problems)
    if text is None:
        return None
    out: dict[str, Any] = {"author": unicodedata.normalize("NFC", author), "text": text}
    kind = value.get("kind", "note")
    if kind not in KINDS:
        problems.append(f"{where}.kind must be one of {', '.join(KINDS)}")
        return None
    if kind != "note":
        out["kind"] = kind
    if not reply and "replies" in value:
        replies = value["replies"]
        if not isinstance(replies, list) or len(replies) > MAX_REPLIES:
            problems.append(f"{where}.replies must be a list of at most {MAX_REPLIES}")
            return None
        cleaned = [clean_comment(r, f"{where}.replies[{i}]", names, problems, True) for i, r in enumerate(replies)]
        if any(r is None for r in cleaned):
            return None
        if cleaned:
            out["replies"] = cleaned
    return out


def validate_document(doc: Any, names: list[str] | set[str]) -> tuple[str, int, dict[str, list[dict[str, Any]]]]:
    """Return (book_id, revision, questions) with cleaned text, or raise PackError listing every problem."""
    names = set(names)
    problems: list[str] = []
    if not isinstance(doc, dict):
        raise PackError(f"{MEMBER} must be a JSON object")
    unknown = sorted(set(doc) - {"schema", "format", "book_id", "revision", "questions"})
    if unknown:
        problems.append(f"unknown top-level field(s) {', '.join(unknown)}")
    if doc.get("schema") != 1:
        problems.append("schema must be 1")
    if doc.get("format") != FORMAT:
        problems.append(f"format must be {FORMAT!r}")
    book_id = doc.get("book_id")
    if not isinstance(book_id, str) or not BOOK_ID.fullmatch(book_id):
        problems.append("book_id must be an upper-case Kafu book ID")
    revision = doc.get("revision")
    if type(revision) is not int or not 1 <= revision <= 999999:
        problems.append("revision must be a whole number from 1")
    questions = doc.get("questions")
    if not isinstance(questions, dict) or not questions:
        problems.append("questions must be a non-empty object of QID: [comments]")
        raise PackError(problems)
    if len(questions) > MAX_QUESTIONS:
        problems.append(f"at most {MAX_QUESTIONS} questions per pack")
    out: dict[str, list[dict[str, Any]]] = {}
    for qid, comments in questions.items():
        if len(problems) >= MAX_ERRORS:
            break
        if not QID.fullmatch(qid):
            problems.append(f"{qid!r} is not a Kafu question ID (Q#########)")
            continue
        where = f"questions.{qid}"
        if not isinstance(comments, list) or len(comments) > MAX_TOP:
            problems.append(f"{where} must be a list of at most {MAX_TOP} comments ([] removes them)")
            continue
        cleaned = [clean_comment(c, f"{where}[{i}]", names, problems, False) for i, c in enumerate(comments)]
        if any(c is None for c in cleaned):
            continue
        seen: set[str] = set()
        for i, c in enumerate(cleaned):
            for j, item in enumerate([c, *(c.get("replies") or [])]):
                key = item["text"].casefold()
                if key in seen:
                    problems.append(f"{where}[{i}]{'' if j == 0 else f'.replies[{j - 1}]'} repeats another comment's text")
                seen.add(key)
        out[qid] = cleaned
    if not problems and count_comments(out) > MAX_TOTAL:
        problems.append(f"at most {MAX_TOTAL} comments and replies per pack")
    if problems:
        raise PackError(problems)
    return book_id, revision, out


def read_package(path: Path, names: list[str] | None = None) -> Pack:
    path = Path(path)
    match = FILENAME.fullmatch(path.name)
    if not match:
        raise PackError("filename must be COMMENTS_BOOK-ID_rN.zip")
    size = path.stat().st_size
    if not 0 < size <= MAX_ZIP:
        raise PackError(f"ZIP must be 1 byte to {MAX_ZIP // (1024 * 1024)} MB")
    if not zipfile.is_zipfile(path):
        raise PackError("not a ZIP file")
    with zipfile.ZipFile(path) as zf:
        infos = zf.infolist()
        if [i.filename for i in infos] != [MEMBER]:
            raise PackError(f"the ZIP must contain only {MEMBER} (found: {', '.join(i.filename for i in infos[:5]) or 'nothing'})")
        info = infos[0]
        if info.flag_bits & 0x1:
            raise PackError("encrypted ZIP members are not allowed")
        if info.file_size > MAX_JSON:
            raise PackError(f"{MEMBER} is larger than {MAX_JSON // (1024 * 1024)} MB")
        if zf.testzip():
            raise PackError("corrupt ZIP member")
        raw = zf.read(info)
    if len(raw) > MAX_JSON:
        raise PackError(f"{MEMBER} is larger than {MAX_JSON // (1024 * 1024)} MB")
    book_id, revision, questions = validate_document(loads(raw), names or personas())
    if book_id != match.group(1).upper() or revision != int(match.group(2)):
        raise PackError(f"filename says {match.group(1).upper()} r{match.group(2)} but {MEMBER} says {book_id} r{revision}")
    return Pack(book_id, revision, questions, hashlib.sha256(path.read_bytes()).hexdigest())


def write_package(doc: Any, out_dir: Path, names: list[str] | None = None) -> Path:
    """Validate a comments document and write its ZIP; the same input always gives the same bytes."""
    book_id, revision, questions = validate_document(doc, names or personas())
    clean = {"schema": 1, "format": FORMAT, "book_id": book_id, "revision": revision, "questions": questions}
    raw = (json.dumps(clean, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"COMMENTS_{book_id}_r{revision}.zip"
    info = zipfile.ZipInfo(MEMBER, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    temp = target.with_suffix(".zip.tmp")
    with zipfile.ZipFile(temp, "w") as zf:
        zf.writestr(info, raw, compresslevel=9)
    temp.replace(target)
    if target.stat().st_size > MAX_ZIP:
        target.unlink()
        raise PackError(f"the ZIP would be larger than {MAX_ZIP // (1024 * 1024)} MB; split the comments into two revisions")
    return target


def book_qids_from_catalog(catalog: dict[str, Any], book_id: str) -> set[str]:
    book = next((b for b in catalog.get("books") or [] if b.get("id") == book_id), None)
    if not book:
        raise PackError(f"book {book_id} is not published")
    return {qid for chapter in book.get("chapters") or [] for qid in chapter.get("qids") or []}


def book_qids_from_exports(exports: list[dict[str, Any]], book_id: str) -> set[str]:
    qids: set[str] = set()
    for export in exports:
        if export.get("export_type") != "kafu_mcq_text_export":
            raise PackError("--export must be a Kafu MCQ text export (Copy MCQs for AI)")
        if (export.get("book") or {}).get("id") != book_id:
            raise PackError(f"the export is for {(export.get('book') or {}).get('id')!r}, not {book_id}")
        qids.update(q.get("id") for q in export.get("questions") or [] if isinstance(q, dict))
    return qids


def check_qids(questions: dict[str, Any], visible: set[str], book_id: str) -> None:
    unknown = sorted(q for q in questions if q not in visible)
    if unknown:
        raise PackError(f"{len(unknown)} question(s) are not in the published book {book_id}: "
                        + ", ".join(unknown[:10]) + (" …" if len(unknown) > 10 else ""))


def _connect(db: Path) -> sqlite3.Connection:
    db.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db)
    conn.executescript(SCHEMA)
    return conn


def book_totals(conn: sqlite3.Connection, book_id: str, visible: set[str] | None = None) -> tuple[int, int]:
    rows = conn.execute("SELECT qid,comments_json FROM question_comments WHERE book_id=?", (book_id,)).fetchall()
    rows = [(q, json.loads(c)) for q, c in rows if visible is None or q in visible]
    return len(rows), count_comments(dict(rows))


def _current(conn: sqlite3.Connection, book_id: str) -> tuple[int, str] | None:
    row = conn.execute("SELECT revision,source FROM comment_books WHERE book_id=?", (book_id,)).fetchone()
    return (row[0], row[1]) if row else None


def _set_current(conn: sqlite3.Connection, book_id: str, revision: int, source: str) -> None:
    conn.execute("INSERT INTO comment_books(book_id,revision,source) VALUES(?,?,?) ON CONFLICT(book_id) DO UPDATE SET "
                 "revision=excluded.revision,source=excluded.source", (book_id, revision, source))


def _snapshot(conn: sqlite3.Connection, book_id: str, revision: int) -> None:
    state = {q: json.loads(c) for q, c in conn.execute(
        "SELECT qid,comments_json FROM question_comments WHERE book_id=? ORDER BY qid", (book_id,))}
    raw = zlib.compress(json.dumps(state, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9)
    conn.execute("INSERT OR REPLACE INTO comment_snapshots(book_id,revision,state,questions,comments) VALUES(?,?,?,?,?)",
                 (book_id, revision, raw, len(state), count_comments(state)))
    conn.execute("DELETE FROM comment_snapshots WHERE book_id=? AND revision NOT IN "
                 "(SELECT revision FROM comment_snapshots WHERE book_id=? ORDER BY revision DESC LIMIT ?)",
                 (book_id, book_id, KEEP_SNAPSHOTS))


def kept_revisions(conn: sqlite3.Connection, book_id: str) -> list[int]:
    return [r for (r,) in conn.execute("SELECT revision FROM comment_snapshots WHERE book_id=? ORDER BY revision", (book_id,))]


def rebuild(conn: sqlite3.Connection, root: Path, book_id: str, visible: set[str]) -> dict[str, Any]:
    """Write the book's index and shards from the database; questions no longer published are left out."""
    shards: dict[str, dict[str, Any]] = defaultdict(dict)
    for qid, raw in conn.execute("SELECT qid,comments_json FROM question_comments WHERE book_id=? ORDER BY qid", (book_id,)):
        if qid in visible:
            shards[qid[:7]][qid] = json.loads(raw)
    revision = (_current(conn, book_id) or (0, ""))[0]
    shard_dir = root / "packs" / "_comments" / book_id
    index_path = root / "comments" / f"{book_id}.json"
    entries: dict[str, Any] = {}
    for key in sorted(shards):
        payload = {"schema": 1, "book_id": book_id, "shard": key, "questions": shards[key]}
        raw = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
        digest = hashlib.sha256(raw).hexdigest()
        name = f"{key}.{digest[:12]}.json"
        shard_dir.mkdir(parents=True, exist_ok=True)
        (shard_dir / name).write_bytes(raw)
        entries[key] = {"url": f"/packs/_comments/{book_id}/{name}", "sha256": digest,
                        "questions": len(shards[key]), "comments": count_comments(shards[key])}
    keep = {Path(e["url"]).name for e in entries.values()}
    if shard_dir.exists():
        for old in shard_dir.iterdir():
            if old.is_file() and old.name not in keep:
                old.unlink()
        if not keep:
            shard_dir.rmdir()
    questions = sum(e["questions"] for e in entries.values())
    comments = sum(e["comments"] for e in entries.values())
    if entries:
        index = {"schema": 1, "book_id": book_id, "revision": revision, "questions": questions,
                 "comments": comments, "shards": entries}
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    elif index_path.exists():
        index_path.unlink()
    return {"book_questions": questions, "book_comments": comments, "shards": len(entries)}


def _catalog_qids(root: Path, book_id: str) -> set[str]:
    return book_qids_from_catalog(json.loads((root / "catalog.json").read_text(encoding="utf-8")), book_id)


def publish(db: Path, root: Path, package: Path, names: list[str] | None = None) -> dict[str, Any]:
    pack = read_package(package, names)
    visible = _catalog_qids(root, pack.book_id)
    check_qids(pack.questions, visible, pack.book_id)
    conn = _connect(db)
    try:
        summary = {"book_id": pack.book_id, "revision": pack.revision,
                   "questions": sum(1 for c in pack.questions.values() if c),
                   "cleared": sum(1 for c in pack.questions.values() if not c), "comments": pack.comments}
        same = conn.execute("SELECT revision FROM comment_uploads WHERE book_id=? AND sha256=?",
                            (pack.book_id, pack.sha256)).fetchone()
        if same:
            if _current(conn, pack.book_id) != (same[0], "upload"):
                raise PackError(f"COMMENTS_{pack.book_id}_r{same[0]} was published before and students now see another "
                                f"version; to bring it back use /comments-restore {pack.book_id} r{same[0]}")
            q, c = book_totals(conn, pack.book_id, visible)
            return {**summary, "duplicate": True, "book_questions": q, "book_comments": c}
        last = conn.execute("SELECT MAX(revision) FROM comment_uploads WHERE book_id=?", (pack.book_id,)).fetchone()[0]
        if last is not None and pack.revision <= last:
            raise PackError(f"COMMENTS_{pack.book_id}_r{pack.revision} is not newer than the published r{last}; "
                            f"send it again as COMMENTS_{pack.book_id}_r{last + 1}.zip")
        with conn:
            for qid, comments in pack.questions.items():
                if comments:
                    conn.execute(
                        "INSERT INTO question_comments(qid,book_id,revision,comments_json) VALUES(?,?,?,?) "
                        "ON CONFLICT(qid) DO UPDATE SET book_id=excluded.book_id,revision=excluded.revision,"
                        "comments_json=excluded.comments_json,updated_at=CURRENT_TIMESTAMP",
                        (qid, pack.book_id, pack.revision, json.dumps(comments, ensure_ascii=False, separators=(",", ":"))))
                else:
                    conn.execute("DELETE FROM question_comments WHERE qid=? AND book_id=?", (qid, pack.book_id))
            conn.execute("INSERT INTO comment_uploads(book_id,revision,sha256,questions,comments) VALUES(?,?,?,?,?)",
                         (pack.book_id, pack.revision, pack.sha256, summary["questions"], pack.comments))
            _snapshot(conn, pack.book_id, pack.revision)
            _set_current(conn, pack.book_id, pack.revision, "upload")
        return {**summary, "duplicate": False, **rebuild(conn, root, pack.book_id, visible)}
    finally:
        conn.close()


def restore(db: Path, root: Path, book_id: str, revision: int) -> dict[str, Any]:
    """Bring back a book's comments exactly as students saw them right after upload r<revision>."""
    if not BOOK_ID.fullmatch(book_id) or type(revision) is not int or revision < 1:
        raise PackError("invalid book ID or revision")
    visible = _catalog_qids(root, book_id)
    conn = _connect(db)
    try:
        row = conn.execute("SELECT state FROM comment_snapshots WHERE book_id=? AND revision=?", (book_id, revision)).fetchone()
        if not row:
            kept = kept_revisions(conn, book_id)
            raise PackError(f"r{revision} of {book_id} cannot be restored; kept revisions: "
                            + (", ".join(f"r{r}" for r in kept) if kept else "none"))
        state = json.loads(zlib.decompress(row[0]).decode("utf-8"))
        with conn:
            conn.execute("DELETE FROM question_comments WHERE book_id=?", (book_id,))
            for qid, comments in state.items():
                conn.execute("INSERT INTO question_comments(qid,book_id,revision,comments_json) VALUES(?,?,?,?)",
                             (qid, book_id, revision, json.dumps(comments, ensure_ascii=False, separators=(",", ":"))))
            _set_current(conn, book_id, revision, "restore")
        return {"book_id": book_id, "revision": revision, **rebuild(conn, root, book_id, visible)}
    finally:
        conn.close()


def clear(db: Path, root: Path, book_id: str) -> dict[str, Any]:
    """Take every comment of a book away from students; kept revisions can still be restored."""
    if not BOOK_ID.fullmatch(book_id):
        raise PackError("invalid book ID")
    conn = _connect(db)
    try:
        with conn:
            removed = conn.execute("DELETE FROM question_comments WHERE book_id=?", (book_id,)).rowcount
            current = _current(conn, book_id)
            if current:
                _set_current(conn, book_id, current[0], "clear")
        catalog_path = root / "catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.exists() else {}
        visible = {q for b in catalog.get("books") or [] if b.get("id") == book_id
                   for ch in b.get("chapters") or [] for q in ch.get("qids") or []}
        return {"book_id": book_id, "removed_questions": removed, **rebuild(conn, root, book_id, visible)}
    finally:
        conn.close()


def _load_catalog(value: str) -> dict[str, Any]:
    if value.startswith("https://"):
        try:
            from tools.http_client import request_json
        except ModuleNotFoundError:
            from http_client import request_json
        return request_json(value, step="comments.catalog")
    return json.loads(Path(value).read_text(encoding="utf-8"))


def _check_against(pack_book: str, questions: dict[str, Any], args: argparse.Namespace) -> str:
    if args.catalog:
        check_qids(questions, book_qids_from_catalog(_load_catalog(args.catalog), pack_book), pack_book)
        return "; every question is in the published book"
    if args.export:
        exports = [json.loads(Path(p).read_text(encoding="utf-8")) for p in args.export]
        check_qids(questions, book_qids_from_exports(exports, pack_book), pack_book)
        return "; every question is in the export"
    return " (questions not checked against the book: add --catalog or --export)"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("personas", help="list the Kafu characters who can write comments")
    p.add_argument("--json", action="store_true", help="with pictures, tags and roles (needs node)")
    p.add_argument("--markdown", action="store_true", help="the table in docs/COMMENTS_PROMPT.md (needs node)")
    for name in ("validate", "pack"):
        p = sub.add_parser(name)
        p.add_argument("source", type=Path, help="COMMENTS_*.zip" if name == "validate" else "comments.json")
        if name == "pack":
            p.add_argument("--out", type=Path, required=True)
        p.add_argument("--catalog", help="catalog.json path or https URL to check the QIDs")
        p.add_argument("--export", action="append", help="Kafu MCQ export JSON to check the QIDs (repeat for parts)")
    p = sub.add_parser("publish")
    p.add_argument("--db", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--package", type=Path, required=True)
    p = sub.add_parser("restore")
    p.add_argument("--db", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--book-id", required=True)
    p.add_argument("--revision", type=int, required=True)
    p = sub.add_parser("clear")
    p.add_argument("--db", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--book-id", required=True)
    args = ap.parse_args(argv)
    try:
        if args.cmd == "personas":
            if args.markdown:
                print(persona_table())
            else:
                print(json.dumps(people(), ensure_ascii=False, indent=1) if args.json else "\n".join(personas()))
        elif args.cmd == "validate":
            pack = read_package(args.source)
            note = _check_against(pack.book_id, pack.questions, args)
            print(f"OK {args.source.name}: {pack.comments} comments on {len(pack.questions)} questions{note}")
        elif args.cmd == "pack":
            doc = loads(args.source.read_bytes())
            book_id, _, questions = validate_document(doc, personas())
            note = _check_against(book_id, questions, args)
            target = write_package(doc, args.out)
            pack = read_package(target)
            print(f"OK {target}: {pack.comments} comments on {len(pack.questions)} questions, {target.stat().st_size} bytes{note}")
        elif args.cmd == "publish":
            print(json.dumps(publish(args.db, args.out, args.package), ensure_ascii=False))
        elif args.cmd == "restore":
            print(json.dumps(restore(args.db, args.out, args.book_id.upper(), args.revision), ensure_ascii=False))
        else:
            print(json.dumps(clear(args.db, args.out, args.book_id.upper()), ensure_ascii=False))
    except PackError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
