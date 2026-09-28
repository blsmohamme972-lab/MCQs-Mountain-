import unittest
from tools.security_check import scan_text, scan_repository

class SecurityTests(unittest.TestCase):
    def test_scanner_reports_location_not_value(self):
        fake = "gh" + "p_" + "Z" * 36
        findings = scan_text("test.md", "hello\n" + fake)
        self.assertEqual(findings, [("test.md", 2, "credential-format")])
        self.assertNotIn(fake, repr(findings))

    def test_unsafe_logging_detected(self):
        self.assertTrue(scan_text("bad.py", 'import os\nprint(os.environ["BOT_TOKEN"])'))
        self.assertTrue(scan_text(".github/workflows/bad.yml", "run: set -x"))
        self.assertFalse(scan_text("safe.py", 'print("token_len=40")'))

    def test_tracked_repository_contains_no_literal_credentials_or_unsafe_logging(self):
        self.assertEqual(scan_repository(), [], "Security findings contain paths/lines only; never copy matched values")
