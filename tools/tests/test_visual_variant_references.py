"""Exact rasterization groups must include their checked-in reference hash."""
import ast
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class VisualVariantReferenceTests(unittest.TestCase):
    def test_every_variant_group_contains_its_reference(self):
        tree = ast.parse((ROOT / "tools/ui/check.py").read_text())
        value = next(node.value for node in tree.body
                     if isinstance(node, ast.Assign)
                     and any(isinstance(target, ast.Name) and target.id == "VISUAL_HASH_VARIANTS"
                             for target in node.targets))
        groups = ast.literal_eval(value)
        references = json.loads((ROOT / "tools/ui/visual-baselines.json").read_text())
        self.assertTrue(groups)
        for name, hashes in groups.items():
            with self.subTest(snapshot=name):
                self.assertIn(name, references)
                self.assertIn(references[name]["sha256"], hashes,
                              "Reference and candidate must both belong to the exact-hash group")
                self.assertTrue(all(len(h) == 64 and all(c in "0123456789abcdef" for c in h)
                                    for h in hashes))


if __name__ == "__main__":
    unittest.main()
