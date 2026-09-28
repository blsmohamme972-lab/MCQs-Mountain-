import unittest
from tools.smoke_live import check_app_html, check_book

class ReadOnlySmokeTests(unittest.TestCase):
    def test_expected_shell(self):
        self.assertTrue(check_app_html(b'<title>Kafu</title><script>ok</script>'))
        with self.assertRaises(ValueError): check_app_html(b'<title>Access denied</title>')

    def test_protected_content(self):
        book = {"id":"TEST", "version":1, "chapters":[{"id":1}]}
        self.assertEqual(check_book({"books":[book]}, "TEST"), book)
        with self.assertRaises(ValueError): check_book({"books":[]}, "TEST")
        with self.assertRaises(ValueError): check_book({"books":[book]}, "MISSING")
