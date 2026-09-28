from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parents[2]

class DesignStyleTests(unittest.TestCase):
    def test_arcade_clean_contract_and_gallery_are_progress_safe(self):
        tokens=(ROOT/"app/design/tokens.css").read_text()
        docs=(ROOT/"docs/DESIGN_STYLE.md").read_text()
        gallery=(ROOT/"app/design/gallery.js").read_text()
        manifest=json.loads((ROOT/"app/modules/manifest.json").read_text())
        for token in [
            "--brand-primary","--brand-accent-a","--brand-accent-b","--brand-secondary",
            "--color-success","--color-danger","--color-error","--color-warning",
            "--outline-width","--shadow-depth","--pressed-offset",
            "--font-display","--font-reading","--font-pixel","--tap-target"
        ]:
            self.assertIn(token,tokens)
        self.assertIn(":root[data-theme='dark']",tokens)
        self.assertIn("prefers-reduced-motion:reduce",tokens)
        self.assertIn("--color-primary-hover:var(--color-primary-strong)",tokens)
        self.assertIn("## RULES FOR ALL DESIGN PROMPTS",docs)
        self.assertIn("design/gallery.js",manifest["scripts"])
        self.assertIn("design/gallery.css",manifest["styles"])
        self.assertNotIn("DB.",gallery)
        self.assertNotIn("localStorage",gallery)
        self.assertNotIn("CloudStorage",gallery)

    def test_shipped_font_payload_is_bounded(self):
        vendor=ROOT/"app/vendor"
        fonts=sorted(vendor.glob("*.woff2"))
        names={p.name for p in fonts}
        expected={
            "fredoka-latin-600.woff2",
            "nunito-latin-400.woff2",
            "nunito-latin-700.woff2",
            "pixelify-sans-latin-500.woff2",
        }
        self.assertEqual(names,expected)
        self.assertLessEqual(sum(p.stat().st_size for p in fonts),100*1024)

if __name__=="__main__":
    unittest.main()
