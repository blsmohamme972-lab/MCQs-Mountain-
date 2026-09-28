import io
import os
import unittest
import urllib.error
import urllib.request
from contextlib import redirect_stdout
from unittest.mock import patch
from tools import http_client as h

class Response:
    status = 200
    headers = {}
    def __init__(self, body=b'{"ok":true}'): self.body = body
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self, n=-1): return self.body if n < 0 else self.body[:n]

class HttpClientTests(unittest.TestCase):
    def test_user_agent_cannot_be_overridden(self):
        def fake(req, timeout):
            self.assertEqual(req.get_header("User-agent"), h.USER_AGENT)
            return Response()
        with patch.object(h, "_open", side_effect=fake):
            self.assertEqual(h.request_json("https://example.test/x", step="test", headers={"user-agent":"bad"}), {"ok":True})

    def test_reflected_secrets_are_redacted_before_truncation(self):
        secret = "secret-for-redaction-" + "z" * 120
        body = ("a" * 170 + " Bearer " + secret + " token=" + secret).encode()
        error = urllib.error.HTTPError("https://example.test/x", 403, "Forbidden", {"server":"cloudflare","cf-ray":"safe-ray"}, io.BytesIO(body))
        output = io.StringIO()
        with patch.dict(os.environ, {"QUEUE_API_TOKEN":secret}), patch.object(h, "_open", side_effect=error), redirect_stdout(output):
            with self.assertRaises(h.HttpStepError) as ctx:
                h.request_bytes("https://example.test/x?signature=hidden", step="candidate.catalog", headers={"Authorization":"Bearer " + secret})
        self.assertNotIn(secret, str(ctx.exception) + output.getvalue())
        self.assertNotIn("secret-for-redaction", str(ctx.exception) + output.getvalue())
        self.assertNotIn("hidden", output.getvalue())
        self.assertIn("status=403", str(ctx.exception))
        self.assertIn("cf-ray='safe-ray'", output.getvalue())

    def test_bot_paths_and_queries_are_not_logged(self):
        host, path = h._safe_path("https://api.telegram.org/file/botPLACEHOLDER/documents/x.zip?secret=hidden")
        self.assertEqual(host, "api.telegram.org")
        self.assertEqual(path, "/file/bot<redacted>/documents/x.zip")

    def test_redirect_strips_credentials(self):
        request = urllib.request.Request("https://api.github.com/a", headers={"Authorization":"Bearer fake", "Cookie":"fake"})
        redirect = h._SafeRedirect().redirect_request(request, None, 302, "", {}, "https://release-assets.githubusercontent.com/a")
        self.assertIsNone(redirect.get_header("Authorization"))
        self.assertIsNone(redirect.get_header("Cookie"))

    def test_http_redirect_refused(self):
        request = urllib.request.Request("https://example.test/a")
        with self.assertRaises(urllib.error.URLError):
            h._SafeRedirect().redirect_request(request, None, 302, "", {}, "http://example.test/a")

    def test_download_limit_enforced_before_write(self):
        with patch.object(h, "_open", return_value=Response(b"123456")):
            with self.assertRaises(h.HttpStepError):
                h.request_bytes("https://example.test/x", step="download", max_bytes=5)

    def test_json_error_does_not_echo_payload(self):
        with patch.object(h, "_open", return_value=Response(b"not-json")):
            with self.assertRaisesRegex(h.HttpStepError, "invalid_json"):
                h.request_json("https://example.test/x", step="json")
