import io
import unittest
import urllib.error
from unittest.mock import patch

from tools import http_client


class _Response:
    status = 200
    def __init__(self, body=b'{"ok":true}'):
        self.body = body
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self):
        return self.body


class HttpClientTests(unittest.TestCase):
    def test_sets_kafu_user_agent(self):
        seen = {}
        def fake(req, timeout=0):
            seen["ua"] = req.get_header("User-agent")
            seen["method"] = req.get_method()
            return _Response()
        with patch("urllib.request.urlopen", side_effect=fake):
            data = http_client.request_json("https://example.test/x", step="test", method="GET")
        self.assertEqual(data, {"ok": True})
        self.assertEqual(seen["ua"], "kafu-drain/1.0")
        self.assertEqual(seen["method"], "GET")

    def test_error_has_safe_context_and_redacts_bot_token(self):
        err = urllib.error.HTTPError(
            "https://api.telegram.org/botSECRET/sendDocument",
            403,
            "Forbidden",
            {},
            io.BytesIO(b"error 1010 blocked"),
        )
        with patch("urllib.request.urlopen", side_effect=err):
            with self.assertRaises(http_client.HttpStepError) as ctx:
                http_client.request_bytes(
                    "https://api.telegram.org/botSECRET/sendDocument",
                    step="telegram.sendReport",
                    method="POST",
                    data=b"x",
                )
        message = str(ctx.exception)
        self.assertIn("step=telegram.sendReport", message)
        self.assertIn("status=403", message)
        self.assertIn("path=/bot<redacted>/sendDocument", message)
        self.assertNotIn("SECRET", message)


if __name__ == "__main__":
    unittest.main()
