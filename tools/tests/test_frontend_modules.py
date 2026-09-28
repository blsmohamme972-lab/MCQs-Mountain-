"""Test the exact assembled HTML and pure frontend modules without production I/O."""
import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from tools.build_frontend import build, HEAD_BEGIN, INSTALL

ROOT=Path(__file__).resolve().parents[2]

class FrontendModulesTests(unittest.TestCase):
    def test_build_is_repeatable_and_inlines_modules_before_boot(self):
        with tempfile.TemporaryDirectory() as td:
            out=Path(td)/"app"
            result=build(ROOT/"app",out,"a"*40)
            html=(out/"index.html").read_text()
            self.assertEqual(html.count(HEAD_BEGIN),1)
            self.assertEqual(html.count(INSTALL),1)
            self.assertLess(html.index("KafuSyncCore"),html.index("(async function boot()"))
            self.assertEqual(result["commit"],"a"*40)
            before=html
            build(out,out,"a"*40)
            self.assertEqual((out/"index.html").read_text(),before)
            for number,script in enumerate(re.findall(r"<script(?:\s[^>]*)?>([\s\S]*?)</script>",html,re.I)):
                if not script.strip():continue
                target=Path(td)/f"script-{number}.js";target.write_text(script)
                result=subprocess.run(["node","--check",str(target)],capture_output=True,text=True)
                self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_module_unit_and_integration_tests(self):
        tests=sorted((ROOT/"tools/tests/js").glob("*.test.cjs"))
        self.assertTrue(tests)
        result=subprocess.run(["node","--test",*map(str,tests)],cwd=ROOT,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
