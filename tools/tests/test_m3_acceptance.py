"""Synthetic M3 acceptance, entirely offline; no production calls or triggers."""
import importlib.util
import hashlib
import json
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from tools.tests.test_publish import make_package

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("drain_m3", ROOT / "tools/drain_queue.py")
drain = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(drain)

class M3Acceptance(unittest.TestCase):
    def cmd(self, *args, good=True):
        result = subprocess.run([sys.executable, *map(str,args)], cwd=ROOT, text=True, capture_output=True)
        if good: self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else: self.assertNotEqual(result.returncode, 0)
        return result

    def test_broken_zip_marks_failed_sends_repair_report_and_ends_red(self):
        item = {"kind":"publish", "group":{"group_key":"BROKEN_v1","book_id":"BROKEN","version":1,"part_total":1},
                "parts":[{"part_index":1,"filename":"BROKEN_v1.zip","telegram_file_id":"fixture","file_size":7}]}
        finished, messages, reports = [], [], []
        class Queue:
            def __init__(self): self.items = [item]
            def call(self, path, body=None):
                if path == "claim": return self.items.pop() if self.items else {"kind":"empty"}
                if path == "finish": finished.append(body)
                return {"ok":True}
            def notify(self, text): messages.append(text)
        def broken(file_id, target): target.write_bytes(b"not-zip")
        with patch.object(drain, "Queue", Queue), patch.object(drain, "telegram_file", side_effect=broken), \
             patch.object(drain, "send_report", side_effect=lambda p: reports.append(p.read_text())), \
             patch.object(drain, "candidate") as candidate:
            with self.assertRaisesRegex(RuntimeError, "1 queue job"):
                drain.main()
        candidate.assert_not_called()
        self.assertEqual(finished[0]["ok"], False)
        self.assertTrue(any("❌" in x for x in messages))
        self.assertIn("Kafu repair report", reports[0])
        self.assertIn("BROKEN_v1", reports[0])

    def test_server_mismatch_sanitizer_skips_only_bad_question(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            package = root / "mixed.zip"
            make_package(package, 1, "First source question")
            with zipfile.ZipFile(package) as zf:
                members = {name: zf.read(name) for name in zf.namelist()}
            q1 = json.loads(members["questions.jsonl"].decode().strip())
            q2 = dict(q1)
            q2.update({"local_id": 2, "source_number": "2", "stem": "Second source question", "source_page": 2})
            raw = (
                json.dumps(q1, separators=(",", ":")) + "\n" +
                json.dumps(q2, separators=(",", ":")) + "\n"
            ).encode()
            book = json.loads(members["book.json"])
            book["expected_count"] = 2
            book["id_range"] = [1, 2]
            audit = json.loads(members["audit.json"])
            audit["questions_sha256"] = hashlib.sha256(raw).hexdigest()
            audit["mismatch_count"] = 1
            audit["results"] = [
                {"local_id": 1, "source_page": 1, "level": "mismatch", "score": 0.1, "detail": "bad source match"},
                {"local_id": 2, "source_page": 2, "level": "match", "score": 1.0, "detail": "ok"},
            ]
            members["questions.jsonl"] = raw
            members["book.json"] = json.dumps(book).encode()
            members["audit.json"] = json.dumps(audit).encode()
            with zipfile.ZipFile(package, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                for name, data in members.items():
                    zf.writestr(name, data)

            skipped = drain.sanitize_audit_mismatches(package)
            self.assertEqual([x["local_id"] for x in skipped], [1])
            self.cmd("tools/validate.py", "--require-audit", package)
            self.cmd("tools/validate_release.py", package)
            with zipfile.ZipFile(package) as zf:
                questions = [json.loads(x) for x in zf.read("questions.jsonl").decode().splitlines() if x.strip()]
                sanitized_book = json.loads(zf.read("book.json"))
            self.assertEqual([q["local_id"] for q in questions], [2])
            self.assertEqual([x["local_id"] for x in sanitized_book["skipped"]], [1])

            out = root / "content"
            db = root / "content.sqlite"
            result = self.cmd("tools/publish.py", "--db", db, "--out", out, package)
            summary = json.loads(result.stdout[result.stdout.find("{"):])
            self.assertEqual(summary["visible_questions"], 1)

    def test_exact_zip_duplicate_and_distinct_zip(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); p=root/"TEST_v1.zip"; make_package(p,1,"Synthetic test")
            db=root/"state.sqlite"
            self.cmd("tools/package_state.py","record","--db",db,"--package",p,"--book-id","TEST-BOOK","--version",1)
            same=root/"same.zip"; shutil.copyfile(p,same)
            self.assertEqual(self.cmd("tools/package_state.py","check","--db",db,"--package",same).stdout.strip(),"yes")
            different=root/"different.zip"; make_package(different,2,"Changed")
            self.assertEqual(self.cmd("tools/package_state.py","check","--db",db,"--package",different).stdout.strip(),"no")

    def test_complete_two_part_package_and_missing_part(self):
        with tempfile.TemporaryDirectory() as td:
            self.cmd("tools/fixtures/generate_fixtures.py","--out",td)
            a=Path(td)/"KAFU-FIXTURE-MULTIPART_v1_part1of2.zip"
            b=Path(td)/"KAFU-FIXTURE-MULTIPART_v1_part2of2.zip"
            self.cmd("tools/validate.py","--require-audit",a,b)
            self.cmd("tools/validate_release.py",a,b)
            self.cmd("tools/validate_release.py",a,good=False)
            out=Path(td)/"content"; db=Path(td)/"content.sqlite"
            self.cmd("tools/publish.py","--db",db,"--out",out,a,b)
            book=json.loads((out/"catalog.json").read_text())["books"][0]
            self.assertEqual(book["questions"],4)

    def test_local_rollback_keeps_ids_and_remove_preserves_history(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); p1=root/"v1.zip"; p2=root/"v2.zip"; out=root/"content"; db=root/"content.sqlite"
            make_package(p1,1,"Original"); make_package(p2,2,"Original corrected")
            for p in [p1,p2]: self.cmd("tools/publish.py","--db",db,"--out",out,p)
            with sqlite3.connect(db) as conn: before=conn.execute("SELECT permanent_id FROM id_map").fetchall()
            self.cmd("tools/publish.py","--db",db,"--out",out,"--allow-version-reuse",p1)
            self.assertEqual(json.loads((out/"catalog.json").read_text())["books"][0]["version"],1)
            self.cmd("tools/queue_admin.py","remove","--root",out,"--db",db,"--book-id","TEST-BOOK")
            catalog=json.loads((out/"catalog.json").read_text())
            self.assertFalse(any(b["id"]=="TEST-BOOK" for b in catalog["books"]))
            self.assertIn("TEST-BOOK",catalog["removed_books"])
            with sqlite3.connect(db) as conn: self.assertEqual(conn.execute("SELECT permanent_id FROM id_map").fetchall(),before)
