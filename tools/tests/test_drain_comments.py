import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools import comments as C

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("drain_queue_comments", ROOT / "tools/drain_queue.py")
drain = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(drain)
NAMES = C.personas()


def job(**extra):
    return {"id": 7, "action": "publish", "book_id": "TEST-BOOK", "revision": 1, "telegram_file_id": "file-1",
            "filename": "COMMENTS_TEST-BOOK_r1.zip", "file_size": 0, **extra}


class FakeQueue:
    def __init__(self, items):
        self.items, self.finished, self.notified = list(items), [], []

    def call(self, name, body=None):
        if name == "claim":
            return self.items.pop(0) if self.items else {"kind": "empty"}
        if name == "finish":
            self.finished.append(body)
        return {"ok": True}

    def notify(self, text):
        self.notified.append(text)


class DrainCommentsTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        tmp = Path(self.td.name)
        self.source = C.write_package({"schema": 1, "format": "kafu-comments", "book_id": "TEST-BOOK", "revision": 1,
                                       "questions": {"Q000000101": [{"author": NAMES[0], "text": "Fixture comment."}]}},
                                      tmp / "src", NAMES)
        self.content = tmp / "work/build/content"
        self.content.mkdir(parents=True)
        (self.content / "catalog.json").write_text(json.dumps(
            {"books": [{"id": "TEST-BOOK", "chapters": [{"id": 1, "qids": ["Q000000101"]}]}]}))
        (tmp / "work/state").mkdir()
        self.state = tmp / "work/state"
        self.calls = []

    def tearDown(self):
        self.td.cleanup()

    def patches(self):
        def fetch(file_id, target, max_bytes):
            self.assertEqual(max_bytes, C.MAX_ZIP)
            target.write_bytes(self.source.read_bytes())
        return [patch.object(drain, "restore", return_value=(self.state, self.content)),
                patch.object(drain, "telegram_file", side_effect=fetch),
                patch.object(drain, "candidate", side_effect=lambda *a, **k: self.calls.append(("candidate", a[2], k))),
                patch.object(drain, "save_state", side_effect=lambda *a: self.calls.append(("save",))),
                patch.object(drain, "send_report", side_effect=lambda path: self.calls.append(("report", path.read_text())))]

    def run_main(self, items):
        queue = FakeQueue(items)
        ps = self.patches()
        for p in ps:
            p.start()
        try:
            with patch.object(drain, "Queue", return_value=queue):
                try:
                    drain.main()
                    error = None
                except RuntimeError as exc:
                    error = exc
        finally:
            for p in ps:
                p.stop()
        return queue, error

    def test_publish_smoke_tests_the_candidate_then_reports_counts(self):
        size = self.source.stat().st_size
        queue, error = self.run_main([{"kind": "comments", "job": job(file_size=size)}])
        self.assertIsNone(error)
        self.assertEqual(self.calls[0], ("candidate", "TEST-BOOK", {"comments_book": "TEST-BOOK"}))
        self.assertEqual(self.calls[1], ("save",))
        self.assertEqual(queue.finished, [{"kind": "comments", "id": 7, "ok": True, "action": "publish", "book_id": "TEST-BOOK",
                                           "revision": 1, "questions": 1, "comments": 1, "book_questions": 1, "book_comments": 1}])
        self.assertEqual(queue.notified, ["✅ COMMENTS_TEST-BOOK_r1 published: 1 comments on 1 questions. "
                                          "TEST-BOOK now has 1 comments on 1 questions."])
        self.assertTrue((self.content / "comments/TEST-BOOK.json").exists())

    def test_a_rejected_pack_fails_with_every_problem_in_the_report(self):
        size = self.source.stat().st_size
        (self.content / "catalog.json").write_text(json.dumps({"books": [{"id": "TEST-BOOK", "chapters": []}]}))
        queue, error = self.run_main([{"kind": "comments", "job": job(file_size=size)}])
        self.assertRegex(str(error), "1 queue job")
        self.assertEqual(queue.finished[0]["kind"], "comments")
        self.assertEqual(queue.finished[0]["id"], 7)
        self.assertFalse(queue.finished[0]["ok"])
        self.assertIn("not in the published book TEST-BOOK: Q000000101", queue.finished[0]["error"])
        self.assertEqual(queue.notified, ["❌ COMMENTS_TEST-BOOK_r1 failed. repair_report.md is attached."])
        report = next(c for c in self.calls if c[0] == "report")[1]
        self.assertIn("- 1 question(s) are not in the published book", report)
        self.assertNotIn(("save",), self.calls)

    def test_changed_telegram_size_and_clear_jobs(self):
        queue, error = self.run_main([{"kind": "comments", "job": job(file_size=1)},
                                      {"kind": "comments", "job": {"id": 8, "action": "clear", "book_id": "TEST-BOOK", "revision": None}}])
        self.assertRegex(str(error), "1 queue job")
        self.assertIn("Telegram file size changed", queue.finished[0]["error"])
        self.assertEqual(queue.finished[1]["ok"], True)
        self.assertEqual(queue.finished[1]["action"], "clear")
        self.assertEqual(queue.notified[-1], "🧹 Comments are off for TEST-BOOK.")


    def test_restore_jobs_bring_back_a_kept_revision(self):
        size = self.source.stat().st_size
        queue, error = self.run_main([{"kind": "comments", "job": job(file_size=size)},
                                      {"kind": "comments", "job": {"id": 8, "action": "clear", "book_id": "TEST-BOOK", "revision": None}},
                                      {"kind": "comments", "job": {"id": 9, "action": "restore", "book_id": "TEST-BOOK", "revision": 1}},
                                      {"kind": "comments", "job": {"id": 10, "action": "restore", "book_id": "TEST-BOOK", "revision": 4}}])
        self.assertRegex(str(error), "1 queue job")
        self.assertEqual(queue.finished[2], {"kind": "comments", "id": 9, "ok": True, "action": "restore", "book_id": "TEST-BOOK",
                                             "revision": 1, "questions": 0, "comments": 0, "book_questions": 1, "book_comments": 1})
        self.assertEqual(queue.notified[2], "↩️ Comments of TEST-BOOK restored to r1: 1 comments on 1 questions.")
        self.assertTrue((self.content / "comments/TEST-BOOK.json").exists())
        self.assertIn("r4 of TEST-BOOK cannot be restored; kept revisions: r1", queue.finished[3]["error"])
        self.assertEqual(queue.notified[3], "❌ comments-restore TEST-BOOK r4 failed. repair_report.md is attached.")


class VerifyCommentsTests(unittest.TestCase):
    def test_candidate_must_serve_the_exact_index_and_shards(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "catalog.json").write_text(json.dumps({"books": [{"id": "TEST-BOOK", "chapters": [{"id": 1, "qids": ["Q000000101"]}]}]}))
            pack = C.write_package({"schema": 1, "format": "kafu-comments", "book_id": "TEST-BOOK", "revision": 1,
                                    "questions": {"Q000000101": [{"author": NAMES[0], "text": "Fixture comment."}]}}, root / "in", NAMES)
            C.publish(root / "db.sqlite", root, pack, NAMES)
            files = {"/comments/TEST-BOOK.json": (root / "comments/TEST-BOOK.json").read_bytes()}
            entry = next(iter(json.loads(files["/comments/TEST-BOOK.json"])["shards"].values()))
            files[entry["url"]] = (root / entry["url"].lstrip("/")).read_bytes()

            def get(url, step, **_):
                path = url.removeprefix("https://preview.test")
                if path not in files:
                    raise drain.HttpStepError(step, "GET", url, 404)
                return files[path]
            with patch.object(drain, "request_bytes", side_effect=get), \
                 patch.object(drain, "request_json", side_effect=lambda url, step: json.loads(get(url, step))):
                drain.verify_comments("https://preview.test", root, "TEST-BOOK")
                files[entry["url"]] = b"changed"
                with self.assertRaisesRegex(RuntimeError, "shard mismatch"):
                    drain.verify_comments("https://preview.test", root, "TEST-BOOK")
                C.clear(root / "db.sqlite", root, "TEST-BOOK")
                with self.assertRaisesRegex(RuntimeError, "still serves comments"):
                    drain.verify_comments("https://preview.test", root, "TEST-BOOK")
                del files["/comments/TEST-BOOK.json"]
                drain.verify_comments("https://preview.test", root, "TEST-BOOK")


if __name__ == "__main__":
    unittest.main()
