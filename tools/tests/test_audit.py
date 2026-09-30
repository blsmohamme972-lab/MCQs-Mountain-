import contextlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

import fitz

from tools import audit


class AuditTests(unittest.TestCase):
    def run_audit(self, texts, question, *, zipped=False):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            pdf = root / "source.pdf"
            with fitz.open() as doc:
                for text in texts:
                    page = doc.new_page()
                    if text:
                        page.insert_text((72, 72), text, fontsize=11)
                doc.save(pdf)
            raw = (json.dumps(question, ensure_ascii=False) + "\n").encode()
            source = root / ("package.zip" if zipped else "questions.jsonl")
            if zipped:
                with zipfile.ZipFile(source, "w") as zf:
                    zf.writestr("questions.jsonl", raw)
            else:
                source.write_bytes(raw)
            output = root / "audit.json"
            with contextlib.redirect_stdout(io.StringIO()):
                code = audit.main(["audit.py", str(pdf), str(source), "--output", str(output)])
            payload = json.loads(output.read_text())
            self.assertEqual(payload["questions_sha256"], audit.sha256_bytes(raw))
            self.assertEqual(payload["pdf_sha256"], audit.sha256_bytes(pdf.read_bytes()))
            self.assertEqual(payload["audit_tool_version"], 2)
            return code, payload

    def question(self, **changes):
        row = {"local_id": 1, "source_page": 1, "stem": "Select the synthetic option.",
               "options": ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]}
        row.update(changes)
        return row

    def result(self, texts, question, **kwargs):
        code, payload = self.run_audit(texts, question, **kwargs)
        return code, payload["results"][0]

    def test_legacy_single_page_and_zip_input(self):
        text = "Select the synthetic option.\nAlpha\nBeta\nGamma\nDelta\nEpsilon"
        for zipped in (False, True):
            with self.subTest(zipped=zipped):
                code, result = self.result([text], self.question(), zipped=zipped)
                self.assertEqual((code, result["level"], result["score"]), (0, "match", 1.0))
                self.assertEqual(result["source_pages"], [1])

    def test_continuation_options_match_only_when_declared(self):
        texts = ["Select the synthetic option.\nAlpha", "Beta\nGamma\nDelta\nEpsilon"]
        _, before = self.result(texts, self.question())
        self.assertEqual(before["level"], "warning")
        _, after = self.result(texts, self.question(source_pages=[1, 2]))
        self.assertEqual((after["level"], after["score"]), ("match", 1.0))
        self.assertEqual(after["source_pages"], [1, 2])

    def test_stem_and_option_can_cross_page_boundary(self):
        question = self.question(stem="Which marker identifies the synthetic condition?",
                                 options=["Alpha beta", "Gamma", "Delta", "Epsilon", "Zeta"],
                                 source_pages=[1, 2, 3])
        texts = ["Which marker identifies", "the synthetic condition?\nAlpha",
                 "beta\nGamma\nDelta\nEpsilon\nZeta"]
        _, result = self.result(texts, question)
        self.assertEqual((result["level"], result["score"]), ("match", 1.0))

    def test_only_explicit_pages_are_searched(self):
        texts = ["Unrelated introduction", "Select the synthetic option.\nAlpha\nBeta\nGamma\nDelta\nEpsilon",
                 "Unrelated appendix"]
        code, result = self.result(texts, self.question(source_pages=[1, 3]))
        self.assertEqual((code, result["level"]), (1, "mismatch"))

    def test_duplicate_pages_read_in_pdf_order(self):
        texts = ["Select the synthetic", "option.\nAlpha\nBeta\nGamma\nDelta\nEpsilon"]
        _, result = self.result(texts, self.question(source_pages=[2, 1, 2]))
        self.assertEqual(result["level"], "match")
        self.assertEqual(result["source_pages"], [1, 2])

    def test_invalid_start_page_remains_mismatch(self):
        for page in (0, -1, 2, "1", 1.0, True, None):
            with self.subTest(page=page):
                code, payload = self.run_audit(["Alpha"], self.question(source_page=page, source_pages=[1]))
                self.assertEqual(code, 1)
                self.assertEqual(payload["mismatch_count"], 1)
                self.assertEqual(payload["results"][0]["level"], "mismatch")

    def test_invalid_page_list_cannot_fall_back_or_drop_bad_entries(self):
        for pages in ([], None, "1", 1, [0], [-1], [1, 3], [1, "2"], [1, 2.0],
                      [1, True], [1, None], [2]):
            with self.subTest(pages=pages):
                code, result = self.result(["Select the synthetic option.\nAlpha\nBeta\nGamma\nDelta\nEpsilon",
                                            "Continuation"], self.question(source_pages=pages))
                self.assertEqual((code, result["level"]), (1, "mismatch"))

    def test_blank_declared_page_stays_unverifiable(self):
        for texts in (["", ""], ["Select the synthetic option.\nAlpha\nBeta\nGamma\nDelta\nEpsilon", ""]):
            with self.subTest(texts=texts):
                _, result = self.result(texts, self.question(source_pages=[1, 2]))
                self.assertEqual(result["level"], "unverifiable")
                self.assertIsNone(result["stem_check"])
                self.assertIsNone(result["options_check"])

    def test_eighty_percent_threshold_is_unchanged(self):
        for count, expected in ((5, "match"), (4, "match"), (3, "warning"), (0, "warning")):
            with self.subTest(count=count):
                text = "Select the synthetic option.\n" + "\n".join(self.question()["options"][:count])
                _, result = self.result([text], self.question())
                self.assertEqual(result["level"], expected)
                self.assertEqual(result["options_check"], count >= 4)
                self.assertEqual(result["score"], round(0.65 + count / 5 * 0.35, 3))

    def test_missing_stem_cannot_become_match(self):
        _, result = self.result(["Other question\nAlpha\nBeta\nGamma\nDelta\nEpsilon"], self.question())
        self.assertEqual(result["level"], "warning")
        self.assertFalse(result["stem_check"])
        self.assertEqual(result["score"], 0.35)

    def test_real_mismatch_still_fails(self):
        code, result = self.result(["Unrelated source text", "Another unrelated page"],
                                   self.question(source_pages=[1, 2]))
        self.assertEqual((code, result["level"], result["score"]), (1, "mismatch", 0.0))

    def test_script_digits_and_charges_are_equivalent(self):
        for plain, formatted in (("H2", "H₂"), ("Na+", "Na⁺"), ("HCO3-", "HCO₃⁻"),
                                 ("Ca2+", "Ca²⁺"), ("10^9", "10^⁹"), ("H2+", "H₂₊"),
                                 ("Cl-", "Cl₋")):
            with self.subTest(plain=plain):
                self.assertEqual(audit.norm(plain), audit.norm(formatted))
                self.assertTrue(audit.contains_fragment(audit.norm(plain), formatted))
                self.assertTrue(audit.contains_fragment(audit.norm(formatted), plain))

    def test_normalization_keeps_numbers_charge_signs_and_inequalities(self):
        for left, right in (("H₂", "H₃"), ("Na⁺", "Na⁻"), ("Ca²⁺", "Ca³⁺"),
                            ("60", "600"), ("≥5", "≤5"), ("Na⁺", "Na")):
            with self.subTest(left=left):
                self.assertNotEqual(audit.norm(left), audit.norm(right))

    def test_chemical_typography_matches_real_pdf_extraction(self):
        question = self.question(stem="Which synthetic chemical label?",
                                 options=["H₂ receptor", "Na⁺ transporter", "Ca²⁺ channel", "Cl⁻ ion", "HCO₃⁻ buffer"])
        text = "Which synthetic chemical label?\nH2 receptor\nNa+ transporter\nCa2+ channel\nCl- ion\nHCO3- buffer"
        _, result = self.result([text], question)
        self.assertEqual((result["level"], result["score"]), ("match", 1.0))

    def test_changed_chemical_values_remain_mismatch(self):
        question = self.question(stem="H₂", options=["Na⁺", "Ca²⁺", "H₂ receptor", "Cl⁻", "HCO₃⁻"])
        code, result = self.result(["H3\nNa-\nCa3+\nH3 receptor\nCl+\nHCO4+"], question)
        self.assertEqual((code, result["level"]), (1, "mismatch"))


if __name__ == "__main__":
    unittest.main()
