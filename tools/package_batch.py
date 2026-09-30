#!/usr/bin/env python3
"""Build, source-audit and validate a Kafu ZIP from a PDF with a known parser.

No AI or network calls are used. A parser in tools/parsers/ is selected by name,
then the same audit.py / validate.py / validate_release.py gates used by Kafu run.

Example:
  python tools/package_batch.py SOURCE.pdf \
    --parser simple_numbered_mcq \
    --metadata book-metadata.json \
    --out-dir dist
"""
from __future__ import annotations

import argparse
import io
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

try:
    import fitz
except Exception:
    fitz = None
try:
    from PIL import Image
except Exception:
    Image = None

try:
    from tools.parsers import load_parser
except ModuleNotFoundError:
    from parsers import load_parser

ROOT = Path(__file__).resolve().parents[1]
MAX_PACKAGE = 19 * 1024 * 1024

REQUIRED_META = (
    "book_id", "title", "authors", "edition", "field", "specialty",
    "collection_type", "language", "version",
)

def run_checked(*args: str) -> str:
    proc = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError((proc.stdout + "\n" + proc.stderr).strip()[-5000:])
    return (proc.stdout + "\n" + proc.stderr).strip()

def load_metadata(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    missing = [key for key in REQUIRED_META if key not in data]
    if missing:
        raise ValueError("metadata missing: " + ", ".join(missing))
    if not isinstance(data["authors"], list):
        raise ValueError("metadata authors must be a list")
    if not isinstance(data["version"], int) or data["version"] < 1:
        raise ValueError("metadata version must be an integer >= 1")
    return data

def render_cover(pdf_path: Path) -> bytes:
    if fitz is None or Image is None:
        raise RuntimeError("PyMuPDF and Pillow are required to render cover.webp")
    doc = fitz.open(pdf_path)
    if not len(doc):
        raise ValueError("PDF has no pages")
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3), alpha=False)
    image = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    if image.width > 600:
        height = max(1, round(image.height * 600 / image.width))
        image = image.resize((600, height))
    for quality in (82, 72, 62, 52):
        out = io.BytesIO()
        image.save(out, "WEBP", quality=quality, method=6)
        if out.tell() <= 400_000:
            return out.getvalue()
    raise ValueError("first-page cover cannot be reduced below 400 KB")

def make_book(metadata: dict, parsed: dict) -> dict:
    questions = parsed["questions"]
    skipped = parsed.get("skipped") or []
    ids = [q["local_id"] for q in questions] + [s["local_id"] for s in skipped]
    if not ids:
        raise ValueError("parser produced no questions or skipped IDs")
    lo, hi = min(ids), max(ids)
    if sorted(set(ids)) != list(range(lo, hi + 1)):
        raise ValueError("parser local_id coverage has gaps")
    expected = metadata.get("expected_count")
    if expected is None:
        expected = hi - lo + 1
    if expected != hi - lo + 1:
        raise ValueError("metadata expected_count does not match parser local_id range")
    book = {
        "schema": 1,
        "book_id": metadata["book_id"],
        "title": metadata["title"],
        "subtitle": metadata.get("subtitle", ""),
        "authors": metadata["authors"],
        "edition": metadata["edition"],
        "year": metadata.get("year"),
        "publisher": metadata.get("publisher", ""),
        "field": metadata["field"],
        "specialty": metadata["specialty"],
        "branch": metadata.get("branch", ""),
        "collection_type": metadata["collection_type"],
        "language": metadata["language"],
        "version": metadata["version"],
        "expected_count": expected,
        "part": {"index": 1, "total": 1},
        "id_range": [lo, hi],
        "chapters": parsed["chapters"],
        "skipped": skipped,
        "license_note": metadata.get("license_note", ""),
    }
    return book

def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows),
        encoding="utf-8",
    )

def build(pdf_path: Path, parser_name: str, metadata_path: Path, out_dir: Path) -> Path:
    if pdf_path.suffix.lower() != ".pdf" or not pdf_path.is_file():
        raise ValueError("SOURCE must be an existing PDF")
    metadata = load_metadata(metadata_path)
    parser = load_parser(parser_name)
    parsed = parser(pdf_path)
    for key in ("questions", "chapters"):
        if not isinstance(parsed.get(key), list):
            raise ValueError(f"parser result missing list: {key}")
    book = make_book(metadata, parsed)

    out_dir.mkdir(parents=True, exist_ok=True)
    package = out_dir / f"{book['book_id']}_v{book['version']}.zip"
    for key in ("source_map", "image_map", "resources"):
        if key in parsed:
            (out_dir / (book["book_id"] + "-" + key + ".json")).write_text(
                json.dumps(parsed[key], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with tempfile.TemporaryDirectory(prefix="kafu-batch-") as td:
        work = Path(td)
        (work / "book.json").write_text(json.dumps(book, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        write_jsonl(work / "questions.jsonl", parsed["questions"])
        (work / "cover.webp").write_bytes(render_cover(pdf_path))
        images = parsed.get("images") or {}
        if images:
            (work / "images").mkdir()
            for name, data in sorted(images.items()):
                if Path(name).name != name:
                    raise ValueError("Parser returned unsafe image filename")
                (work / "images" / name).write_bytes(data)
        notes = parsed.get("notes") or []
        (work / "report.md").write_text(
            "# Kafu package batch report\n\n"
            f"- Parser: {parser_name}\n"
            f"- Questions: {len(parsed['questions'])}\n"
            f"- Skipped: {len(book['skipped'])}\n"
            + "".join(f"- {str(note)}\n" for note in notes),
            encoding="utf-8",
        )

        run_checked(
            sys.executable, "tools/audit.py", str(pdf_path), str(work / "questions.jsonl"),
            "--output", str(work / "audit.json"),
        )

        with zipfile.ZipFile(package, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for name in ("book.json", "questions.jsonl", "cover.webp", "audit.json", "report.md"):
                zf.write(work / name, arcname=name)
            for name in sorted(images):
                zf.write(work / "images" / name, arcname="images/" + name)

    if package.stat().st_size > MAX_PACKAGE:
        package.unlink(missing_ok=True)
        raise ValueError("package exceeds 19 MB; split this layout into deterministic parts before publishing")

    validate = run_checked(sys.executable, "tools/validate.py", "--require-audit", str(package))
    release = run_checked(sys.executable, "tools/validate_release.py", str(package))
    print(validate)
    print(release)
    print(package)
    return package

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--parser", required=True)
    ap.add_argument("--metadata", required=True, type=Path)
    ap.add_argument("--out-dir", type=Path, default=Path("dist/packages"))
    args = ap.parse_args(argv)
    try:
        build(args.pdf, args.parser, args.metadata, args.out_dir)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

