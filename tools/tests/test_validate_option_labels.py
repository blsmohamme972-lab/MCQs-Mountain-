#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("kafu_validate", ROOT / "tools" / "validate.py")
validate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validate)


class OptionLabelPrefixTests(unittest.TestCase):
    def _errors(self, first_option):
        q = {
            "local_id": 1,
            "chapter_id": 1,
            "topic": "",
            "type": "sba",
            "source_number": "1",
            "lead_in": "",
            "stem": "Which option is correct for this validation regression test?",
            "options": [first_option, "Urea breath test", "Histologic biopsy"],
            "answer": "B",
            "answer_source": "book_key",
            "explanation": "Source explanation.",
            "images": [],
            "explanation_images": [],
            "group_id": "",
            "no_shuffle": False,
            "source_page": 1,
            "flag": "",
        }
        rep = validate.Report("test")
        ctx = {"chapters": {1: "Chapter"}, "skipped": {}, "range": [1, 1], "part": {"index": 1, "total": 1}}
        validate.check_question(rep, q, ctx, set(), set())
        return rep.errors

    def test_medical_abbreviation_h_pylori_is_not_treated_as_option_label(self):
        self.assertFalse(any("option still starts with its label" in e for e in self._errors("H. pylori serology")))

    def test_actual_a_label_on_option_a_is_rejected(self):
        self.assertTrue(any("option still starts with its label" in e for e in self._errors("A. Aspirin")))


if __name__ == "__main__":
    unittest.main()
