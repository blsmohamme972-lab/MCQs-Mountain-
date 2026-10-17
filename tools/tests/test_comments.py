import hashlib
import json
import sqlite3
import subprocess
import tempfile
import unittest
import zipfile
from datetime import timedelta
from pathlib import Path

from tools import comments as C
from tools.content_admin import remove_book

ROOT = Path(__file__).resolve().parents[2]
NAMES = C.personas()
A, B, D = NAMES[0], NAMES[3], NAMES[10]
QIDS = ["Q000000101", "Q000000102", "Q000001250"]


def doc(questions=None, book="TEST-BOOK", revision=1):
    return {"schema": 1, "format": "kafu-comments", "book_id": book, "revision": revision,
            "questions": questions if questions is not None else {
                QIDS[0]: [{"author": A, "text": "Fixture comment one.", "kind": "tip",
                           "replies": [{"author": B, "text": "Fixture reply one."}]}],
                QIDS[2]: [{"author": D, "text": "Fixture comment two."}],
            }}


def zip_with(path, members):
    with zipfile.ZipFile(path, "w") as zf:
        for name, data in members.items():
            zf.writestr(name, data)
    return path


def content_tree(root, qids=QIDS, book="TEST-BOOK"):
    root.mkdir(parents=True, exist_ok=True)
    catalog = {"schema": 1, "books": [{"id": book, "version": 1, "chapters": [
        {"id": 1, "qids": qids[:2]}, {"id": 2, "qids": qids[2:]}]}], "removed_books": []}
    (root / "catalog.json").write_text(json.dumps(catalog))
    return root


class PersonaTests(unittest.TestCase):
    def test_python_reads_the_same_personas_the_app_uses(self):
        people = C.people()
        self.assertEqual([p["name"] for p in people], NAMES)
        self.assertTrue(all(p["tag"] and p["initials"] and len(p["gradient"]) == 2 for p in people))
        self.assertEqual(sum(1 for p in people if p["photo"]), 47)

    def test_writing_guide_lists_the_current_personas(self):
        text = (ROOT / "docs/COMMENTS_PROMPT.md").read_text(encoding="utf-8")
        table = text.split("<!-- personas:begin -->\n", 1)[1].split("\n<!-- personas:end -->", 1)[0]
        self.assertEqual(table, C.persona_table(), "regenerate with: python tools/comments.py personas --markdown")


class PackageTests(unittest.TestCase):
    def test_pack_round_trip_is_deterministic_and_cleans_text(self):
        source = doc({QIDS[0]: [{"author": A, "text": "  Fixture\r\n\r\n\r\n\r\nline   two   "}]})
        with tempfile.TemporaryDirectory() as td:
            first = C.write_package(source, Path(td) / "a", NAMES)
            second = C.write_package(source, Path(td) / "b", NAMES)
            self.assertEqual(first.name, "COMMENTS_TEST-BOOK_r1.zip")
            self.assertEqual(first.read_bytes(), second.read_bytes())
            pack = C.read_package(first, NAMES)
        first_comment = pack.questions[QIDS[0]][0]
        self.assertEqual({k: first_comment[k] for k in ("author", "text")}, {"author": A, "text": "Fixture\n\nline two"})
        self.assertEqual(set(first_comment), {"author", "text", "at", "likes", "react"})
        self.assertEqual((pack.book_id, pack.revision, pack.comments), ("TEST-BOOK", 1, 1))

    def test_every_problem_is_reported(self):
        bad = doc({
            "Q12": [],
            QIDS[0]: [{"author": "Somebody", "text": "Fixture text."}],
            QIDS[1]: [{"author": A, "text": "x"}],
            QIDS[2]: [{"author": A, "text": "See https://example.com now"}],
            "Q000000300": [{"author": A, "text": "Fixture text.", "kind": "joke"}],
            "Q000000301": [{"author": A, "text": "Fixture text.", "auther": A}],
            "Q000000302": [{"author": A, "text": "Fixture text.", "replies": [{"author": B, "text": "Nested.", "replies": []}]}],
            "Q000000303": [{"author": A, "text": "Same words."}, {"author": B, "text": "same words."}],
            "Q000000304": [{"author": A, "text": "Hidden ‮ mark"}],
            "Q000000305": [{"author": A, "text": "y" * 601}],
        })
        with self.assertRaises(C.PackError) as caught:
            C.validate_document(bad, NAMES)
        text = " | ".join(caught.exception.problems)
        for needle in ["'Q12' is not a Kafu question ID", "is not a Kafu character", "must be 2–600 characters",
                       "must not contain links", "kind must be one of", "unknown field(s) auther",
                       "replies cannot have replies", "repeats another comment's text", "control characters U+202E",
                       "(has 601)"]:
            self.assertIn(needle, text)

    def test_document_shape_is_strict(self):
        for broken, needle in [
            ({**doc(), "schema": 2}, "schema must be 1"),
            ({**doc(), "format": "other"}, "format must be"),
            ({**doc(), "book_id": "lower"}, "book_id"),
            ({**doc(), "revision": True}, "revision"),
            ({**doc(), "extra": 1}, "unknown top-level"),
            (doc({}), "non-empty"),
            (doc({QIDS[0]: [{"author": A, "text": f"Fixture {i}."} for i in range(13)]}), "at most 12"),
            (doc({QIDS[0]: [{"author": A, "text": "Fixture.", "replies": [{"author": B, "text": f"R {i}."} for i in range(7)]}]}), "at most 6"),
        ]:
            with self.subTest(needle=needle), self.assertRaisesRegex(C.PackError, needle):
                C.validate_document(broken, NAMES)

    def test_zip_container_is_strict(self):
        good = json.dumps(doc()).encode()
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            cases = [
                (zip_with(td / "COMMENTS_TEST-BOOK_r1.zip", {"comments.json": good, "extra.txt": b"x"}), "contain only"),
                (zip_with(td / "comments-test.zip", {"comments.json": good}), "filename must be"),
                (zip_with(td / "COMMENTS_OTHER_r1.zip", {"comments.json": good}), "filename says OTHER r1"),
                (zip_with(td / "COMMENTS_TEST-BOOK_r2.zip", {"comments.json": good}), "filename says TEST-BOOK r2"),
                (zip_with(td / "COMMENTS_TEST-BOOK_r3.zip", {"comments.json": b'{"schema":1,"schema":1}'}), "duplicate JSON key"),
                (zip_with(td / "COMMENTS_TEST-BOOK_r4.zip", {"comments.json": b"\xff\xfe"}), "not UTF-8"),
                (zip_with(td / "COMMENTS_TEST-BOOK_r5.zip", {"comments.json": b'{"a": NaN}'}), "not valid JSON"),
            ]
            (td / "COMMENTS_TEST-BOOK_r6.zip").write_bytes(b"not a zip")
            cases.append((td / "COMMENTS_TEST-BOOK_r6.zip", "not a ZIP"))
            for path, needle in cases:
                with self.subTest(path=path.name), self.assertRaisesRegex(C.PackError, needle):
                    C.read_package(path, NAMES)

    def test_cli_pack_checks_questions_against_an_export(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            (td / "comments.json").write_text(json.dumps(doc()), encoding="utf-8")
            export = {"export_type": "kafu_mcq_text_export", "book": {"id": "TEST-BOOK"}, "questions": [{"id": q} for q in QIDS[:2]]}
            (td / "export.json").write_text(json.dumps(export))
            run = lambda *a: subprocess.run(["python3", "tools/comments.py", *a], cwd=ROOT, capture_output=True, text=True)
            missing = run("pack", str(td / "comments.json"), "--out", str(td / "out"), "--export", str(td / "export.json"))
            self.assertEqual(missing.returncode, 1)
            self.assertIn("Q000001250", missing.stderr)
            self.assertFalse((td / "out").exists())
            export["questions"].append({"id": QIDS[2]})
            (td / "export.json").write_text(json.dumps(export))
            ok = run("pack", str(td / "comments.json"), "--out", str(td / "out"), "--export", str(td / "export.json"))
            self.assertEqual(ok.returncode, 0, ok.stderr)
            self.assertIn("3 comments on 2 questions", ok.stdout)
            again = run("validate", str(td / "out/COMMENTS_TEST-BOOK_r1.zip"))
            self.assertEqual(again.returncode, 0, again.stderr)


NOW = "2026-10-17T12:00:00Z"


class ActivityTests(unittest.TestCase):
    """Posting times, likes and reactions: kept when given, filled by pack otherwise."""

    def thread(self, **extra):
        return doc({QIDS[0]: [{"author": A, "text": "Fixture comment.", **extra,
                               "replies": [{"author": B, "text": "Fixture reply one."}, {"author": D, "text": "Fixture reply two."}]},
                              {"author": D, "text": "Fixture comment two.", "kind": "mnemonic"}],
                    QIDS[1]: [{"author": B, "text": f"Fixture note {i}."} for i in range(12)]})

    def test_given_values_are_kept_and_checked(self):
        given = {"at": "2026-10-01T08:30:00Z", "likes": 0, "react": ["❤", "🤓"]}
        _, _, questions = C.validate_document(self.thread(**given), NAMES)
        self.assertEqual({k: questions[QIDS[0]][0][k] for k in given}, {**given, "react": ["❤️", "🤓"]})
        filled = C.fill_activity("TEST-BOOK", questions, C.pack_time(NOW))
        self.assertEqual({k: filled[QIDS[0]][0][k] for k in given}, {**given, "react": ["❤️", "🤓"]})
        for extra, needle in [({"at": "2026-10-17 10:00"}, "at must be"), ({"at": "2026-10-17T10:00:00"}, "at must be"),
                              ({"at": "2026-10-17T10:00:00.000Z"}, "at must be"), ({"at": "2019-12-31T10:00:00Z"}, "at must be"),
                              ({"at": "2026-02-30T10:00:00Z"}, "at must be"), ({"likes": 21}, "likes must be"),
                              ({"likes": -1}, "likes must be"), ({"likes": True}, "likes must be"), ({"likes": 3.0}, "likes must be"),
                              ({"react": []}, "react must"), ({"react": ["👍", "🔥", "💯", "🤓"]}, "react must"),
                              ({"react": ["👍", "👍"]}, "react must"), ({"react": ["🤡"]}, "react must"), ({"react": "👍"}, "react must")]:
            with self.subTest(extra=extra), self.assertRaisesRegex(C.PackError, needle):
                C.validate_document(self.thread(**extra), NAMES)
        late = self.thread(at="2026-10-10T08:00:00Z")
        late["questions"][QIDS[0]][0]["replies"][1]["at"] = "2026-10-09T08:00:00Z"
        with self.assertRaisesRegex(C.PackError, r"replies\[1\]\.at is earlier"):
            C.validate_document(late, NAMES)

    def test_pack_fills_every_comment_the_same_way_each_time(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            first = C.write_package(self.thread(), td / "a", NAMES, NOW)
            second = C.write_package(self.thread(), td / "b", NAMES, NOW)
            later = C.write_package(self.thread(), td / "c", NAMES, "2026-10-18T12:00:00Z")
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertNotEqual(first.read_bytes(), later.read_bytes())
            pack, moved = C.read_package(first, NAMES), C.read_package(later, NAMES)
        now = C.pack_time(NOW)
        for qid, comments in pack.questions.items():
            for i, comment in enumerate(comments):
                at = C.parse_at(comment["at"])
                self.assertTrue(now - timedelta(days=75) <= at <= now - timedelta(minutes=45), comment["at"])
                self.assertEqual(moved.questions[qid][i]["likes"], comment["likes"])
                self.assertEqual(C.parse_at(moved.questions[qid][i]["at"]) - at, timedelta(days=1))
                previous = at
                for item in [comment, *comment.get("replies", [])]:
                    self.assertTrue(1 <= item["likes"] <= C.LIKES_MAX)
                    size = len(item["react"])
                    self.assertTrue(size == 1 if item["likes"] < 5 else 1 <= size <= 2 if item["likes"] < 12 else 2 <= size <= 3)
                    self.assertTrue(set(item["react"]) <= set(C.REACTIONS))
                    self.assertTrue(previous <= C.parse_at(item["at"]) <= now - timedelta(minutes=1))
                    previous = C.parse_at(item["at"])
        likes = [c["likes"] for c in pack.questions[QIDS[1]]]
        self.assertGreater(len(set(likes)), 3, "likes vary between comments")

    def test_editing_one_comment_keeps_the_others(self):
        source = self.thread()
        before = C.fill_activity("TEST-BOOK", C.validate_document(source, NAMES)[2], C.pack_time(NOW))
        source["questions"][QIDS[1]][5]["text"] = "Fixture note five, edited."
        after = C.fill_activity("TEST-BOOK", C.validate_document(source, NAMES)[2], C.pack_time(NOW))
        self.assertEqual(before[QIDS[0]], after[QIDS[0]])
        self.assertEqual([c for i, c in enumerate(before[QIDS[1]]) if i != 5], [c for i, c in enumerate(after[QIDS[1]]) if i != 5])

    def test_replies_fit_between_a_recent_comment_and_now(self):
        source = self.thread(at="2026-10-17T11:58:00Z")
        source["questions"][QIDS[1]][0]["replies"] = [{"author": A, "text": "Fixture reply.", "at": "2026-10-17T11:00:00Z"}]
        filled = C.fill_activity("TEST-BOOK", C.validate_document(source, NAMES)[2], C.pack_time(NOW))
        self.assertEqual([r["at"] for r in filled[QIDS[0]][0]["replies"]], ["2026-10-17T11:58:00Z", "2026-10-17T11:58:00Z"])
        self.assertLessEqual(filled[QIDS[1]][0]["at"], "2026-10-17T11:00:00Z", "a comment is never after its replies")

    def test_reactions_and_likes_fit_what_a_comment_says(self):
        cases = {"Fixture: why is the loop stronger?": "question", "شكراً دكتورة 🙏": "thanks", "Saved it, thanks guys": "thanks",
                 "آني چنت ناسية النسب لحد ما حفظتها 😂": "funny", "مو بالضبط، الـ PCT استثناء": "correction",
                 "ما چنت أعرف هالمعلومة": "wow", "Fixture pearl for the ward.": "clinical"}
        for text, expected in cases.items():
            self.assertEqual(C.tone({"text": text, "kind": "clinical"}), expected, text)
        self.assertEqual(C.tone({"text": "Plain fixture note."}), "note")
        questions = {f"Q00000{i:04d}": [{"author": A, "text": text, "kind": "clinical",
                                         "replies": [{"author": B, "text": f"شكراً {i}"}, {"author": D, "text": f"Fixture {i}: but why?"}]}]
                     for i, text in enumerate(list(cases) * 6)}
        filled = C.fill_activity("TEST-BOOK", C.validate_document(doc(questions), NAMES)[2], C.pack_time(NOW))
        for comments in filled.values():
            for item in [comments[0], *comments[0]["replies"]]:
                pool = C.TONES[C.tone(item)][0]
                own = [e for e in C.REACTIONS if e in item["text"].replace("😂", "🤣")][:1]
                self.assertTrue(set(item["react"]) <= set(pool) | set(own), item)
                self.assertIn(own[0] if own else pool[0], item["react"], "the fitting emoji is always there")
                low, high, _ = C.TONES[C.tone(item)][1]
                self.assertTrue(1 <= item["likes"] <= high, item)
        asking = [c[0]["replies"][1]["react"] for c in filled.values()]
        self.assertTrue(all("🤔" in r for r in asking), "a question gets 🤔")
        thanks = [r["likes"] for c in filled.values() for r in c[0]["replies"][:1]]
        clinical = [c[0]["likes"] for c in filled.values() if C.tone(c[0]) == "clinical"]
        self.assertLess(sum(thanks) / len(thanks), sum(clinical) / len(clinical), "a thank-you gets fewer likes than a pearl")
        self.assertEqual(filled["Q000000001"][0]["react"][0], "🙏", "the emoji a comment uses comes first")

    def test_old_packs_without_activity_still_publish(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            old = zip_with(td / "COMMENTS_TEST-BOOK_r1.zip", {"comments.json": json.dumps(doc(), ensure_ascii=False).encode()})
            self.assertNotIn("likes", json.dumps(C.read_package(old, NAMES).questions))
            summary = C.publish(td / "state.sqlite", content_tree(td / "content"), old, NAMES)
        self.assertEqual(summary["comments"], 3)

    def test_cli_pack_takes_now(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            (td / "comments.json").write_text(json.dumps(self.thread()), encoding="utf-8")
            run = lambda *a: subprocess.run(["python3", "tools/comments.py", "pack", str(td / "comments.json"), *a],
                                            cwd=ROOT, capture_output=True, text=True)
            ok = run("--out", str(td / "a"), "--now", NOW)
            self.assertEqual(ok.returncode, 0, ok.stderr)
            self.assertEqual((td / "a/COMMENTS_TEST-BOOK_r1.zip").read_bytes(),
                             C.write_package(self.thread(), td / "b", NAMES, NOW).read_bytes())
            bad = run("--out", str(td / "c"), "--now", "yesterday")
            self.assertEqual(bad.returncode, 1)
            self.assertIn("--now must be", bad.stderr)


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.tmp = Path(self.td.name)
        self.root = content_tree(self.tmp / "content")
        self.db = self.tmp / "state/content.sqlite"

    def tearDown(self):
        self.td.cleanup()

    def pack(self, source):
        return C.write_package(source, self.tmp / f"in-{source['revision']}", NAMES)

    def index(self):
        return json.loads((self.root / "comments/TEST-BOOK.json").read_text())

    def test_publish_writes_verified_shards_and_an_index(self):
        result = C.publish(self.db, self.root, self.pack(doc()), NAMES)
        self.assertEqual({k: result[k] for k in ["questions", "comments", "book_questions", "book_comments", "shards", "duplicate"]},
                         {"questions": 2, "comments": 3, "book_questions": 2, "book_comments": 3, "shards": 2, "duplicate": False})
        index = self.index()
        self.assertEqual((index["revision"], index["questions"], index["comments"]), (1, 2, 3))
        self.assertEqual(sorted(index["shards"]), ["Q000000", "Q000001"])
        for key, entry in index["shards"].items():
            raw = (self.root / entry["url"].lstrip("/")).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), entry["sha256"])
            self.assertTrue(entry["url"].startswith(f"/packs/_comments/TEST-BOOK/{key}.{entry['sha256'][:12]}"))
            shard = json.loads(raw)
            self.assertEqual((shard["book_id"], shard["shard"]), ("TEST-BOOK", key))
            self.assertTrue(all(q.startswith(key) for q in shard["questions"]))

    def test_later_revisions_replace_listed_questions_only(self):
        C.publish(self.db, self.root, self.pack(doc()), NAMES)
        second = doc({QIDS[0]: [], QIDS[1]: [{"author": B, "text": "Fixture comment three."}]}, revision=2)
        result = C.publish(self.db, self.root, self.pack(second), NAMES)
        self.assertEqual((result["questions"], result["cleared"], result["book_questions"], result["book_comments"]), (1, 1, 2, 2))
        shards = {}
        for entry in self.index()["shards"].values():
            shards.update(json.loads((self.root / entry["url"].lstrip("/")).read_bytes())["questions"])
        self.assertEqual(sorted(shards), [QIDS[1], QIDS[2]])
        self.assertEqual(self.index()["revision"], 2)
        files = sorted(p.name for p in (self.root / "packs/_comments/TEST-BOOK").iterdir())
        self.assertEqual(files, sorted(e["url"].rsplit("/", 1)[1] for e in self.index()["shards"].values()))

    def test_duplicates_are_no_ops_and_old_revisions_are_refused(self):
        first = self.pack(doc())
        C.publish(self.db, self.root, first, NAMES)
        self.assertTrue(C.publish(self.db, self.root, first, NAMES)["duplicate"])
        C.publish(self.db, self.root, self.pack(doc({QIDS[1]: [{"author": A, "text": "Fixture four."}]}, revision=3)), NAMES)
        with self.assertRaisesRegex(C.PackError, "not newer than the published r3; send it again as COMMENTS_TEST-BOOK_r4.zip"):
            C.publish(self.db, self.root, self.pack(doc({QIDS[1]: []}, revision=2)), NAMES)

    def test_unknown_questions_and_unpublished_books_are_refused(self):
        with self.assertRaisesRegex(C.PackError, "1 question\\(s\\) are not in the published book TEST-BOOK: Q000000999"):
            C.publish(self.db, self.root, self.pack(doc({"Q000000999": [{"author": A, "text": "Fixture."}]})), NAMES)
        with self.assertRaisesRegex(C.PackError, "book OTHER is not published"):
            C.publish(self.db, self.root, self.pack(doc(book="OTHER")), NAMES)
        self.assertFalse((self.root / "comments").exists())

    def test_retired_questions_drop_out_and_clear_removes_everything(self):
        C.publish(self.db, self.root, self.pack(doc()), NAMES)
        content_tree(self.root, QIDS[:2])  # the book was republished without QIDS[2]
        C.publish(self.db, self.root, self.pack(doc({QIDS[1]: [{"author": A, "text": "Fixture five."}]}, revision=2)), NAMES)
        self.assertEqual(self.index()["questions"], 2)
        result = C.clear(self.db, self.root, "TEST-BOOK")
        self.assertEqual((result["removed_questions"], result["book_comments"]), (3, 0))
        self.assertFalse((self.root / "comments/TEST-BOOK.json").exists())
        self.assertFalse((self.root / "packs/_comments/TEST-BOOK").exists())

    def shard_questions(self):
        out = {}
        for entry in self.index()["shards"].values():
            out.update(json.loads((self.root / entry["url"].lstrip("/")).read_bytes())["questions"])
        return out

    def test_restore_brings_back_exactly_what_a_revision_showed(self):
        r1 = self.pack(doc())
        C.publish(self.db, self.root, r1, NAMES)
        after_r1 = self.shard_questions()
        C.publish(self.db, self.root, self.pack(doc({QIDS[0]: [], QIDS[1]: [{"author": B, "text": "Fixture six."}]}, revision=2)), NAMES)
        self.assertNotEqual(self.shard_questions(), after_r1)
        result = C.restore(self.db, self.root, "TEST-BOOK", 1)
        self.assertEqual((result["revision"], result["book_questions"], result["book_comments"]), (1, 2, 3))
        self.assertEqual(self.shard_questions(), after_r1)
        self.assertEqual(self.index()["revision"], 1)
        # After a clear, a kept revision still comes back; new uploads still number after the newest one.
        C.clear(self.db, self.root, "TEST-BOOK")
        self.assertFalse((self.root / "comments/TEST-BOOK.json").exists())
        C.restore(self.db, self.root, "TEST-BOOK", 2)
        self.assertEqual(sorted(self.shard_questions()), [QIDS[1], QIDS[2]])
        with self.assertRaisesRegex(C.PackError, "send it again as COMMENTS_TEST-BOOK_r3.zip"):
            C.publish(self.db, self.root, self.pack(doc({QIDS[1]: []}, revision=2)), NAMES)
        with self.assertRaisesRegex(C.PackError, "/comments-restore TEST-BOOK r1"):
            C.publish(self.db, self.root, r1, NAMES)

    def test_restore_refuses_unknown_revisions_and_unpublished_books_and_keeps_twenty(self):
        with self.assertRaisesRegex(C.PackError, "kept revisions: none"):
            C.restore(self.db, self.root, "TEST-BOOK", 1)
        for revision in range(1, C.KEEP_SNAPSHOTS + 3):
            C.publish(self.db, self.root, self.pack(doc({QIDS[0]: [{"author": A, "text": f"Fixture {revision}."}]}, revision=revision)), NAMES)
        with sqlite3.connect(self.db) as conn:
            self.assertEqual(C.kept_revisions(conn, "TEST-BOOK"), list(range(3, C.KEEP_SNAPSHOTS + 3)))
        with self.assertRaisesRegex(C.PackError, "r2 of TEST-BOOK cannot be restored; kept revisions: r3, r4"):
            C.restore(self.db, self.root, "TEST-BOOK", 2)
        C.restore(self.db, self.root, "TEST-BOOK", 3)
        self.assertEqual(self.shard_questions()[QIDS[0]][0]["text"], "Fixture 3.")
        with self.assertRaisesRegex(C.PackError, "book OTHER is not published"):
            C.restore(self.db, self.root, "OTHER", 3)

    def test_removing_a_book_removes_its_comments(self):
        C.publish(self.db, self.root, self.pack(doc()), NAMES)
        with sqlite3.connect(self.db) as conn:
            conn.executescript("CREATE TABLE questions(book_id TEXT,status TEXT);CREATE TABLE id_map(book_id TEXT,status TEXT);")
        remove_book(self.root, "TEST-BOOK")
        self.assertFalse((self.root / "comments/TEST-BOOK.json").exists())
        self.assertFalse((self.root / "packs/_comments/TEST-BOOK").exists())
        subprocess.run(["python3", "tools/queue_admin.py", "remove", "--root", str(self.root), "--db", str(self.db),
                        "--book-id", "TEST-BOOK"], cwd=ROOT, check=True, capture_output=True)
        with sqlite3.connect(self.db) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM question_comments").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
