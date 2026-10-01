import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

SPEC = importlib.util.spec_from_file_location("validate_repeats", Path(__file__).resolve().parents[1] / "validate.py")
validate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validate)


class SourceRepeatTests(unittest.TestCase):
    def fixture(self, variant=False):
        q = dict(local_id=1, chapter_id=1, type="sba", source_number="1",
                 stem="Which of these options correctly answers this source question?",
                 options=["First choice", "Second choice", "Third choice"],
                 answer="B", answer_source="book_key", explanation="The source explains this answer.",
                 images=[], explanation_images=[], no_shuffle=False, source_page=10, flag="")
        later = copy.deepcopy(q)
        later.update(local_id=2, source_number="2", source_page=11)
        kind, target, field = ("source_variants", "variant_of", "source_variant_of") if variant else ("source_duplicates", "duplicate_of", "source_duplicate_of")
        later[field] = 1
        if variant:
            later["options"][0] = "A different distractor"
        book = dict(schema=1, book_id="TEST-SOURCE", title="Source test", authors=[], edition="1",
                    field="medicine", specialty="General Surgery", collection_type="textbook",
                    language="en", version=1, part=dict(index=1, total=1), id_range=[1, 2],
                    expected_count=2, chapters=[dict(id=1, title="Chapter")], skipped=[])
        book[kind] = [dict(local_id=2, **{target: 1}, reason="Separately printed source item")]
        return book, [q, later]

    def run_package(self, book, questions):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "TEST-SOURCE_v1.zip"
            with zipfile.ZipFile(path, "w") as z:
                z.writestr("book.json", json.dumps(book))
                z.writestr("questions.jsonl", "\n".join(json.dumps(q) for q in questions))
                z.writestr("report.md", "Test fixture")
                z.writestr("cover.webp", b"RIFF\x04\x00\x00\x00WEBP")
            return validate.validate_zip(path, False)[0]

    def test_declared_exact_source_repeat_passes(self):
        book, questions = self.fixture()
        rep = self.run_package(book, questions)
        self.assertEqual(rep.errors, [])
        self.assertFalse(any("same stem" in w for w in rep.warnings))

    def test_undeclared_duplicate_still_fails(self):
        book, questions = self.fixture()
        del book["source_duplicates"]
        del questions[1]["source_duplicate_of"]
        self.assertTrue(any("exact duplicate" in e for e in self.run_package(book, questions).errors))

    def test_invalid_provenance_fails(self):
        mutations = [
            lambda b, q: b.pop("source_duplicates"),
            lambda b, q: q[1].pop("source_duplicate_of"),
            lambda b, q: q[1].update(source_duplicate_of=99),
            lambda b, q: q[1].update(source_duplicate_of=2),
            lambda b, q: q[1].update(source_duplicate_of=True),
            lambda b, q: q[1].update(source_page=10),
            lambda b, q: q[1].update(answer="A"),
            lambda b, q: q[1].update(type="multi", answer=["A", "B"]),
            lambda b, q: q[1].update(answer_source="inline_marked"),
            lambda b, q: q[1].update(stem=q[1]["stem"] + " Changed."),
            lambda b, q: q[1]["options"].__setitem__(0, "Changed distractor"),
            lambda b, q: b["source_duplicates"][0].update(local_id=3),
            lambda b, q: b["source_duplicates"][0].update(reason=""),
            lambda b, q: b["source_duplicates"].append(copy.deepcopy(b["source_duplicates"][0])),
        ]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                book, questions = self.fixture()
                mutation(book, questions)
                self.assertTrue(self.run_package(book, questions).errors)

    def test_source_variant_requires_both_declarations_and_distinct_options(self):
        book, questions = self.fixture(variant=True)
        rep = self.run_package(book, questions)
        self.assertEqual(rep.errors, [])
        self.assertFalse(any("same stem" in w for w in rep.warnings))
        questions[1]["options"] = questions[0]["options"][:]
        self.assertTrue(self.run_package(book, questions).errors)

    def test_undeclared_variant_keeps_warning(self):
        book, questions = self.fixture(variant=True)
        del book["source_variants"]
        del questions[1]["source_variant_of"]
        rep = self.run_package(book, questions)
        self.assertEqual(rep.errors, [])
        self.assertTrue(any("same stem" in w for w in rep.warnings))

    def test_same_source_identity_is_not_a_variant(self):
        book, questions = self.fixture(variant=True)
        questions[1].update(source_page=10, source_number="1")
        self.assertTrue(self.run_package(book, questions).errors)

    def test_numeric_signs_remain_distinct(self):
        keys = [validate.option_key(text) for text in ["–70 mV", "–10 mV", "+10 mV", "+40 mV", "+70 mV"]]
        self.assertEqual(len(set(keys)), 5)
        self.assertEqual(validate.option_key("-70 mV"), validate.option_key("−70 mV"))
        self.assertEqual(validate.option_key("Osteochondroma"), validate.option_key("osteochondroma."))

    def test_suspended_hyphens_are_not_broken_words(self):
        for text in ["high- or low-velocity", "sex- or race-matched", "intra- and extrahepatic"]:
            self.assertIsNone(validate.BROKEN_HYPHEN_RE.search(text))
        self.assertIsNotNone(validate.BROKEN_HYPHEN_RE.search("hypo- thermia"))


if __name__ == "__main__":
    unittest.main()
