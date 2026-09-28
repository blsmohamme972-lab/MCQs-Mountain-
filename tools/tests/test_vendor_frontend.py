import hashlib
import unittest
from tools.vendor_frontend import verify

class VendorTests(unittest.TestCase):
    def test_pinned_integrity_and_no_unpinned_production(self):
        raw=b'synthetic';digest=hashlib.sha256(raw).hexdigest()
        self.assertEqual(verify(raw,digest),digest)
        with self.assertRaises(ValueError):verify(raw,'0'*64)
        with self.assertRaises(ValueError):verify(raw,None)
        self.assertEqual(verify(raw,None,True),digest)
