import unittest
from unittest.mock import patch
from tools.http_client import HttpStepError
from tools.motioncards import smoke

class MotionCardsSmokeTests(unittest.TestCase):
    def test_missing_index_is_valid_only_when_affected_card_is_removed(self):
        meta={"state_sha256":"a"*64}
        removed={"book_id":"BOOK","book_version":1,"qid":"Q000000001","active":False}
        active={**removed,"active":True}
        err=HttpStepError("motioncards.smoke.index.Q000000001","GET","https://example.com/index.json",404)
        with patch.object(smoke,"request_json",side_effect=err):
            self.assertEqual(smoke.load_index("https://example.com",meta,removed),{"animations":{}})
        with patch.object(smoke,"request_json",side_effect=err):
            with self.assertRaises(HttpStepError):
                smoke.load_index("https://example.com",meta,active)

if __name__=="__main__":
    unittest.main()
