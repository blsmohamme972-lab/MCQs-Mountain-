import json
import tempfile
import unittest
import zipfile
from pathlib import Path

import fitz

from tools import package_batch
from tools.parsers.simple_numbered_mcq import parse_pdf


def make_pdf(path: Path, *, second_answer: bool = True) -> None:
    doc = fitz.open()
    page = doc.new_page()
    text = """Chapter: Cardiology
1. Which synthetic option is correct?
A. Alpha
B. Beta
C. Gamma
Answer: B
Explanation: Beta is designated by this synthetic source.
2. Which second synthetic option is correct?
A. One
B. Two
C. Three
"""
    if second_answer:
        text += "Answer: C\n"
    page.insert_text((72, 72), text, fontsize=11)
    doc.save(path)
    doc.close()


class ParserBatchTests(unittest.TestCase):
    def test_parser_preserves_order_and_skips_unproved_answer(self):
        with tempfile.TemporaryDirectory() as td:
            pdf = Path(td) / "source.pdf"
            make_pdf(pdf, second_answer=False)
            parsed = parse_pdf(pdf)
            self.assertEqual([q["local_id"] for q in parsed["questions"]], [1])
            self.assertEqual(parsed["questions"][0]["answer"], "B")
            self.assertEqual(parsed["questions"][0]["source_page"], 1)
            self.assertEqual(parsed["skipped"][0]["local_id"], 2)
            self.assertIn("could not prove", parsed["skipped"][0]["reason"])

    def test_package_batch_builds_audits_and_validates_real_zip(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            pdf = root / "source.pdf"
            make_pdf(pdf)
            metadata = root / "metadata.json"
            metadata.write_text(json.dumps({
                "book_id": "BATCH-TEST",
                "title": "Batch Test",
                "authors": ["Kafu Test"],
                "edition": "1st",
                "field": "medicine",
                "specialty": "Cardiology",
                "collection_type": "textbook",
                "language": "en",
                "version": 1,
                "license_note": "Synthetic CI fixture",
            }), encoding="utf-8")
            package = package_batch.build(pdf, "simple_numbered_mcq", metadata, root / "out")
            self.assertTrue(package.exists())
            with zipfile.ZipFile(package) as zf:
                self.assertEqual(
                    set(zf.namelist()),
                    {"book.json", "questions.jsonl", "cover.webp", "audit.json", "report.md"},
                )
                book = json.loads(zf.read("book.json"))
                audit = json.loads(zf.read("audit.json"))
                rows = [json.loads(x) for x in zf.read("questions.jsonl").decode().splitlines()]
            self.assertEqual(book["expected_count"], 2)
            self.assertEqual([q["answer"] for q in rows], ["B", "C"])
            self.assertEqual(audit["mismatch_count"], 0)
            self.assertTrue(all(x["level"] == "match" for x in audit["results"]))


if __name__ == "__main__":
    unittest.main()
