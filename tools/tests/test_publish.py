#!/usr/bin/env python3
import hashlib
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLISH = ROOT / "tools" / "publish.py"
RELEASE = ROOT / "tools" / "validate_release.py"


def make_package(path: Path, version: int, stem: str, source_number: str = "1"):
    q = {
        "local_id": 1,
        "chapter_id": 1,
        "topic": "",
        "type": "sba",
        "source_number": source_number,
        "lead_in": "",
        "stem": stem,
        "options": ["A one", "B two", "C three"],
        "answer": "A",
        "answer_source": "book_key",
        "explanation": "Explanation",
        "images": [],
        "explanation_images": [],
        "group_id": None,
        "no_shuffle": False,
        "source_page": 1,
        "flag": "",
    }
    raw = (json.dumps(q, separators=(",", ":")) + "\n").encode()
    audit = {
        "schema": 1,
        "questions_sha256": hashlib.sha256(raw).hexdigest(),
        "pdf_sha256": "0" * 64,
        "scanned": False,
        "mismatch_count": 0,
        "results": [{"local_id": 1, "source_page": 1, "level": "match", "score": 1.0, "detail": "ok"}],
    }
    book = {
        "schema": 1,
        "book_id": "TEST-BOOK",
        "title": "Test Book",
        "authors": ["Test"],
        "edition": "1st",
        "field": "medicine",
        "specialty": "Cardiology",
        "collection_type": "textbook",
        "language": "en",
        "version": version,
        "expected_count": 1,
        "part": {"index": 1, "total": 1},
        "id_range": [1, 1],
        "chapters": [{"id": 1, "title": "Chapter"}],
        "skipped": [],
        "license_note": "test fixture",
    }
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("book.json", json.dumps(book))
        zf.writestr("questions.jsonl", raw)
        zf.writestr("audit.json", json.dumps(audit))
        zf.writestr("report.md", "fixture\n")


class PublishingTests(unittest.TestCase):
    def run_cmd(self, *args):
        p = subprocess.run([sys.executable, *map(str, args)], text=True, capture_output=True)
        if p.returncode:
            self.fail(f"command failed ({p.returncode})\nSTDOUT:\n{p.stdout}\nSTDERR:\n{p.stderr}")
        return p

    def test_publish_reuses_id_for_edited_question(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            db = root / "content.sqlite"
            out = root / "content"
            p1 = root / "v1.zip"
            p2 = root / "v2.zip"
            make_package(p1, 1, "Original test stem")
            make_package(p2, 2, "Original test stem with a small correction")

            self.run_cmd(PUBLISH, "--db", db, "--out", out, p1)
            with sqlite3.connect(db) as conn:
                first = conn.execute("select permanent_id from id_map where book_id='TEST-BOOK' and local_id=1").fetchone()[0]

            self.run_cmd(PUBLISH, "--db", db, "--out", out, p2)
            with sqlite3.connect(db) as conn:
                second = conn.execute("select permanent_id from id_map where book_id='TEST-BOOK' and local_id=1").fetchone()[0]

            self.assertEqual(first, "Q000000001")
            self.assertEqual(second, first)

    def test_release_validator_accepts_complete_single_part(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "book.zip"
            make_package(p, 1, "Test")
            result = self.run_cmd(RELEASE, p)
            self.assertIn("RESULT: PASS", result.stdout)


if __name__ == "__main__":
    unittest.main()
