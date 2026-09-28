from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]

class NightReportTests(unittest.TestCase):
    def test_report_has_required_morning_sections(self):
        text = (ROOT / "docs" / "reports" / "NIGHT_1.md").read_text(encoding="utf-8")
        for heading in [
            "Done / merged",
            "Left open / skipped",
            "Phone test list",
            "Human steps",
            "Free-tier estimate",
            "Before the first real book / 20–50 student pilot",
        ]:
            self.assertIn(heading, text)
        for pr in ["PR #12", "PR #13", "PR #14", "PR #15", "PR #16", "PR #17", "PR #18", "PR #19", "PR #20", "PR #21", "PR #22"]:
            self.assertIn(pr, text)
        self.assertIn("docs/ROTATE_SECRETS.md", text)
        self.assertIn("Weekly Kafu D1 Backup", text)
        self.assertIn("KAFU-UPLOAD-TEST", text)
        progress = (ROOT / "PROGRESS.md").read_text(encoding="utf-8")
        self.assertIn("merged PR #23", progress)

if __name__ == "__main__":
    unittest.main()
