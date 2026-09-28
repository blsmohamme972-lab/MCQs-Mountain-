import importlib.util
import json
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("drain_queue", ROOT / "tools/drain_queue.py")
queue_script = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(queue_script)


class Step3Tests(unittest.TestCase):
    def test_migration_and_three_ready_jobs_claim_in_order(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        db.executescript((ROOT / "migrations/0001_publish_queue.sql").read_text())
        for i in range(3):
            key = f"BOOK-{2-i}_v1"
            db.execute("INSERT INTO publish_groups(group_key,book_id,version,part_total,status,created_at) VALUES(?,?,1,1,'ready',?)",
                       (key, f"BOOK-{2-i}", "2026-09-27 00:00:00"))
            db.execute("INSERT INTO publish_queue(group_key,part_index,part_total,telegram_file_id,telegram_file_unique_id,filename,file_size) VALUES(?,1,1,?,?,?,10)",
                       (key, f"file{i}", f"unique{i}", f"BOOK-{i}_v1.zip"))
        seen = []
        for _ in range(3):
            row = db.execute("UPDATE publish_groups SET status='running' WHERE group_key=(SELECT g.group_key FROM publish_groups g JOIN publish_queue q ON q.group_key=g.group_key WHERE g.status='ready' GROUP BY g.group_key ORDER BY MIN(q.job_id) LIMIT 1) AND status='ready' RETURNING group_key").fetchone()
            seen.append(row["group_key"])
            db.execute("UPDATE publish_groups SET status='published' WHERE group_key=?", (row["group_key"],))
        self.assertEqual(seen, ["BOOK-2_v1", "BOOK-1_v1", "BOOK-0_v1"])

    def test_image_decoder_rejects_header_only_webp(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.zip"
            with zipfile.ZipFile(path, "w") as zf:
                zf.writestr("cover.webp", b"RIFF" + (30).to_bytes(4, "little") + b"WEBPVP8X" + bytes(18))
                zf.writestr("images/L0001_1.webp", b"RIFF" + (30).to_bytes(4, "little") + b"WEBPVP8X" + bytes(18))
            with self.assertRaisesRegex(ValueError, "Broken image"):
                queue_script.image_count_and_validate([path])

    def test_current_fixture_images_decode(self):
        generator = ROOT / "tools/fixtures/generate_fixtures.py"
        with tempfile.TemporaryDirectory() as tmp:
            queue_script.run("python", str(generator), "--out", tmp)
            path = Path(tmp) / "KAFU-FIXTURE-ALLTYPES_v2.zip"
            self.assertEqual(queue_script.image_count_and_validate([path]), 2)

    def test_drain_continues_after_failed_book(self):
        jobs = [
            {"kind": "publish", "group": {"group_key": f"BOOK-{i}_v1", "book_id": f"BOOK-{i}", "version": 1}, "parts": []}
            for i in range(3)
        ]
        class FakeQueue:
            def __init__(self):
                self.jobs = list(jobs)
                self.finished = []
                self.notified = []
            def call(self, name, body=None):
                if name == "claim": return self.jobs.pop(0) if self.jobs else {"kind": "empty"}
                if name == "finish": self.finished.append(body)
                if name == "notify": self.notified.append(body["text"])
                return {"ok": True}
            def notify(self, text): self.notified.append(text)
        queue = FakeQueue()
        def publish(item, root, queue):
            if item["group"]["book_id"] == "BOOK-1": raise ValueError("bad image")
            return {"book_id": item["group"]["book_id"], "version": 1,
                    "questions": 4, "chapters": 1, "images": 2, "skipped": 0, "held": 0}
        with patch.object(queue_script, "Queue", return_value=queue), \
             patch.object(queue_script, "process_publish", side_effect=publish), \
             patch.object(queue_script, "send_report"):
            with self.assertRaisesRegex(RuntimeError, "1 queue job"):
                queue_script.main()
        self.assertEqual([x["group_key"] for x in queue.finished], [f"BOOK-{i}_v1" for i in range(3)])
        self.assertEqual([x["ok"] for x in queue.finished], [True, False, True])


if __name__ == "__main__":
    unittest.main()
