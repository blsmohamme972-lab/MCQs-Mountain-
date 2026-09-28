from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]

class OwnerDocsTests(unittest.TestCase):
    def test_admin_documents_every_bot_command_and_failure_path(self):
        text = (ROOT / "docs" / "ADMIN.md").read_text(encoding="utf-8")
        for token in [
            "/help", "/status", "/queue", "/books", "/flags",
            "/flags approve-all BOOK-ID CONFIRM", "/hold Q000000001 PAGE",
            "/retry BOOK-ID_vN", "/clear BOOK-ID_vN", "/republish BOOK-ID_vN",
            "/rollback BOOK-ID VERSION", "/remove BOOK-ID",
            "When you see ❌",
        ]:
            self.assertIn(token, text)
        self.assertIn("GITHUB_TOKEN", text)
        self.assertIn("DISPATCH_TOKEN", text)

    def test_handoff_mentions_protected_book_and_real_book_launch_gate(self):
        text = (ROOT / "HANDOFF.md").read_text(encoding="utf-8")
        self.assertIn("KAFU-UPLOAD-TEST", text)
        self.assertIn("docs/CONTENT_TEAM.md", text)
        self.assertIn("docs/ADMIN.md", text)
        self.assertIn("20–50 student pilot", text)
        self.assertIn("PR #20", text)

    def test_progress_records_task10_merge_and_task11_checkpoint(self):
        text = (ROOT / "PROGRESS.md").read_text(encoding="utf-8")
        self.assertIn("merged PR #21", text)
        self.assertIn("Owner docs implemented", text)

if __name__ == "__main__":
    unittest.main()
