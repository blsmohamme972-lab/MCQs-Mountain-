import subprocess
import tempfile
import unittest
from pathlib import Path
from tools.build_frontend import build
ROOT=Path(__file__).resolve().parents[2]

class ServiceWorkerBuildTests(unittest.TestCase):
    def test_worker_is_versioned_and_valid_without_touching_original_source(self):
        with tempfile.TemporaryDirectory() as td:
            out=Path(td)/"app";build(ROOT/"app",out,"a"*40)
            sw=(out/"sw.js").read_text();self.assertIn("const VERSION='"+"a"*40+"'",sw)
            self.assertNotIn("__KAFU_SW_VERSION__",sw)
            result=subprocess.run(["node","--check",str(out/"sw.js")],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertTrue((out/"icons/kafu.svg").is_file())
            build(out,out,"b"*40);self.assertIn("const VERSION='"+"b"*40+"'",(out/"sw.js").read_text())
