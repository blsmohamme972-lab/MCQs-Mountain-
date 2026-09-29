#!/usr/bin/env python3
import hashlib
import io
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUBLISH = ROOT / "tools" / "publish.py"
RELEASE = ROOT / "tools" / "validate_release.py"


def make_package(path: Path, version: int, stem: str, source_number: str = "1",
                 audit_level: str = "match", flag: str = ""):
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
        "flag": flag,
    }
    raw = (json.dumps(q, separators=(",", ":")) + "\n").encode()
    audit = {
        "schema": 1,
        "questions_sha256": hashlib.sha256(raw).hexdigest(),
        "pdf_sha256": "0" * 64,
        "scanned": False,
        "mismatch_count": 1 if audit_level == "mismatch" else 0,
        "results": [{"local_id": 1, "source_page": 1, "level": audit_level, "score": 1.0, "detail": "fixture audit"}],
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
    cover = io.BytesIO()
    Image.new("RGB", (300, 400), "white").save(cover, "WEBP", quality=60)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("book.json", json.dumps(book))
        zf.writestr("cover.webp", cover.getvalue())
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


    def test_audit_warning_and_parser_flag_publish_without_hold(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            db = root / "content.sqlite"
            out = root / "content"
            package = root / "warning.zip"
            make_package(package, 1, "Warning fixture question", audit_level="warning", flag="book answer looks doubtful")
            result = self.run_cmd(PUBLISH, "--db", db, "--out", out, package)
            summary = json.loads(result.stdout[result.stdout.find("{"):])
            self.assertEqual(summary["visible_questions"], 1)
            self.assertEqual(summary["held"], 0)
            self.assertEqual(summary["warnings"], 1)
            report = json.loads(Path(summary["report"]).read_text())
            self.assertEqual(len(report["warnings"]), 1)
            self.assertIn("audit warning", report["warnings"][0]["reasons"][0])
            self.assertTrue(any("parser flag:" in x for x in report["warnings"][0]["reasons"]))
            with sqlite3.connect(db) as conn:
                status = conn.execute("SELECT status FROM questions WHERE permanent_id='Q000000001'").fetchone()[0]
            self.assertEqual(status, "source_verified")

    def test_existing_held_decision_stays_held_on_future_publish(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            db = root / "content.sqlite"
            out = root / "content"
            p1 = root / "v1.zip"
            p2 = root / "v2.zip"
            decisions = root / "decisions.json"
            make_package(p1, 1, "Held fixture")
            make_package(p2, 2, "Held fixture", audit_level="warning", flag="future warning")
            self.run_cmd(PUBLISH, "--db", db, "--out", out, p1)
            decisions.write_text(json.dumps({"Q000000001": "rejected"}))
            result = self.run_cmd(PUBLISH, "--db", db, "--out", out, "--decisions", decisions, p2)
            summary = json.loads(result.stdout[result.stdout.find("{"):])
            self.assertEqual(summary["held"], 1)
            self.assertEqual(summary["visible_questions"], 0)
            with sqlite3.connect(db) as conn:
                row = conn.execute("SELECT permanent_id,status FROM questions WHERE permanent_id='Q000000001'").fetchone()
            self.assertEqual(row, ("Q000000001", "held"))

    def test_warning_publish_preserves_permanent_id_for_saved_progress_keys(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            db = root / "content.sqlite"
            out = root / "content"
            p1 = root / "v1.zip"
            p2 = root / "v2.zip"
            make_package(p1, 1, "Stable progress fixture")
            make_package(p2, 2, "Stable progress fixture", audit_level="warning")
            self.run_cmd(PUBLISH, "--db", db, "--out", out, p1)
            with sqlite3.connect(db) as conn:
                before = conn.execute("SELECT permanent_id FROM id_map WHERE local_id=1").fetchone()[0]
            saved_progress = {"answers": {before: {"c": True}}, "fav": [before], "resume": {"q": before}}
            self.run_cmd(PUBLISH, "--db", db, "--out", out, p2)
            with sqlite3.connect(db) as conn:
                after = conn.execute("SELECT permanent_id FROM id_map WHERE local_id=1").fetchone()[0]
            self.assertEqual(after, before)
            self.assertIn(saved_progress["resume"]["q"], {after})
            self.assertTrue(set(saved_progress["answers"]).issubset({after}))
            self.assertTrue(set(saved_progress["fav"]).issubset({after}))


if __name__ == "__main__":
    unittest.main()
