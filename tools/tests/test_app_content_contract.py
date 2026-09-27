#!/usr/bin/env python3
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLISH = ROOT / "tools" / "publish.py"
APP = ROOT / "app" / "index.html"

WEBP_STUB = (
    b"RIFF" + (30).to_bytes(4, "little") + b"WEBP" +
    b"VP8X" + b"\x0a\x00\x00\x00" + b"\x00\x00\x00\x00" +
    (599).to_bytes(3, "little") + (399).to_bytes(3, "little")
)

def package(path: Path):
    q = {
        "local_id": 1,
        "chapter_id": 1,
        "topic": "ECG",
        "type": "sba",
        "source_number": "1",
        "lead_in": "",
        "stem": "Which finding is shown in this sample tracing?",
        "options": ["Finding one", "Finding two", "Finding three"],
        "answer": "A",
        "answer_source": "book_key",
        "explanation": "This is a fixture explanation.",
        "images": ["L0001_1.webp"],
        "explanation_images": ["L0001_e1.webp"],
        "group_id": None,
        "no_shuffle": False,
        "source_page": 1,
        "flag": "",
    }
    raw = (json.dumps(q, separators=(",", ":")) + "\n").encode()
    audit = {
        "schema": 1,
        "questions_sha256": hashlib.sha256(raw).hexdigest(),
        "pdf_sha256": "0" * 64,
        "scanned": False,
        "mismatch_count": 0,
        "results": [{"local_id": 1, "source_page": 1, "level": "match", "score": 1.0, "detail": "ok"}],
    }
    book = {
        "schema": 1,
        "book_id": "CONTRACT-BOOK",
        "title": "Contract Book",
        "authors": ["Kafu"],
        "edition": "1st",
        "field": "medicine",
        "specialty": "Cardiology",
        "collection_type": "textbook",
        "language": "en",
        "version": 1,
        "expected_count": 1,
        "part": {"index": 1, "total": 1},
        "id_range": [1, 1],
        "chapters": [{"id": 1, "title": "Chapter One"}],
        "skipped": [],
        "license_note": "fixture",
    }
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("book.json", json.dumps(book))
        zf.writestr("questions.jsonl", raw)
        zf.writestr("audit.json", json.dumps(audit))
        zf.writestr("report.md", "fixture\n")
        zf.writestr("images/L0001_1.webp", WEBP_STUB)
        zf.writestr("images/L0001_e1.webp", WEBP_STUB)
        zf.writestr("cover.webp", WEBP_STUB)

class AppContentContractTests(unittest.TestCase):
    def test_app_points_at_content_worker_and_supports_offline_images(self):
        html = APP.read_text(encoding="utf-8")
        self.assertIn('CONTENT_BASE: "https://kafu-content-1.blsmohamme97.workers.dev"', html)
        self.assertIn('indexedDB.open("medmcq", 2)', html)
        self.assertIn('createObjectStore("images")', html)
        self.assertIn("fflate@0.8.3/umd/index.js", html)
        self.assertIn("unzipSync", html)
        self.assertIn("resolveQuestionRoute", html)
        self.assertIn("explanation_images", html)
        self.assertIn("catalogUsable(c)", html)
        self.assertIn('catalog_source", "sample"', html)

    def test_library_falls_back_for_empty_or_broken_catalogs(self):
        script = r"""
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(process.argv[1], "utf8");
const start = html.indexOf("function normalizeCatalog(catalog) {");
const end = html.indexOf("async function fetchPack(", start);
if (start < 0 || end < 0) throw new Error("Catalog functions missing");
const code = html.slice(start, end);
const sample = { fields: [{id:"medicine"}], specialties:[{id:"Sample"}],
  books:[{id:"SAMPLE", title:"Sample", specialty:"Sample",
    chapters:[{id:1,title:"Chapter"}]}], removed_books:[] };
const published = { fields:[{id:"medicine"}], specialties:[{id:"Cardiology"}],
  books:[{id:"REAL", title:"Published", specialty:"Cardiology",
    chapters:[{id:1,title:"Chapter",url:"https://example.test/chapter.json"}]}],
  removed_books:[] };
async function check(label, remote, cached, expected, cacheError=false) {
  const ctx = {
    CONFIG:{CONTENT_BASE:"https://example.test"},
    SAMPLE:{catalog:sample},
    DB:{
      put:async()=>{},
      get:async()=>{if(cacheError) throw new Error("bad database"); return cached;}
    },
    fetch:async()=>{if(remote === null) throw new Error("offline");
      return {ok:true,json:async()=>structuredClone(remote)};},
  };
  vm.createContext(ctx);
  vm.runInContext(code + "\nthis.load = loadCatalog;", ctx);
  const result = await ctx.load();
  if (result.books[0]?.id !== expected)
    throw new Error(label + ": expected " + expected + ", got " + result.books[0]?.id);
}
(async()=>{
  await check("empty live", {...published,books:[]}, null, "SAMPLE");
  await check("broken live", {...published,specialties:[]}, null, "SAMPLE");
  await check("valid live", published, null, "REAL");
  await check("cached live", null, published, "REAL");
  await check("broken cache", null, {...published,books:[null]}, "SAMPLE");
  await check("cache read failure", null, null, "SAMPLE", true);
})().catch(e=>{console.error(e);process.exit(1)});
"""
        p = subprocess.run(["node", "-e", script, str(APP)], text=True, capture_output=True)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)

    def test_generated_fixture_images_have_image_frames(self):
        generator = ROOT / "tools" / "fixtures" / "generate_fixtures.py"
        with tempfile.TemporaryDirectory() as td:
            p = subprocess.run([sys.executable, str(generator), "--out", td],
                               text=True, capture_output=True)
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
            fixture = Path(td) / "KAFU-FIXTURE-ALLTYPES_v2.zip"
            with zipfile.ZipFile(fixture) as zf:
                question = zf.read("images/L0001_1.webp")
                explanation = zf.read("images/L0004_e1.webp")
                cover = zf.read("cover.webp")
            for data in (question, explanation, cover):
                self.assertEqual(data[:4], b"RIFF")
                self.assertEqual(data[8:12], b"WEBP")
                self.assertGreater(len(data), 100)
                self.assertEqual(data[12:16], b"VP8 ")
                self.assertEqual(int.from_bytes(data[16:20], "little") + 20, len(data))
            self.assertNotEqual(question, explanation)

    def test_publisher_output_matches_app_contract(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            z = root / "book.zip"
            db = root / "content.sqlite"
            out = root / "content"
            package(z)
            p = subprocess.run(
                [sys.executable, str(PUBLISH), "--db", str(db), "--out", str(out),
                 "--base-url", "https://content.example", str(z)],
                text=True, capture_output=True,
            )
            self.assertEqual(p.returncode, 0, p.stdout + "\n" + p.stderr)

            catalog = json.loads((out / "catalog.json").read_text())
            self.assertEqual(catalog["books"][0]["id"], "CONTRACT-BOOK")
            self.assertEqual(catalog["specialties"][0]["id"], "Cardiology")
            ch = catalog["books"][0]["chapters"][0]
            self.assertEqual(ch["qids"], ["Q000000001"])
            self.assertTrue(ch["url"].startswith("https://content.example/"))
            self.assertTrue(ch["image_url"].startswith("https://content.example/"))

            pack = json.loads(next((out / "packs" / "CONTRACT-BOOK" / "v1").glob("*.json")).read_text())
            q = pack["questions"][0]
            self.assertEqual(q["id"], "Q000000001")
            self.assertEqual(q["images"], ["Q000000001_1.webp"])
            self.assertEqual(q["explanation_images"], ["Q000000001_e1.webp"])
            self.assertEqual(q["source_page"], 1)

            image_zip = next((out / "packs" / "CONTRACT-BOOK" / "v1").glob("*.zip"))
            with zipfile.ZipFile(image_zip) as zf:
                self.assertEqual(
                    sorted(zf.namelist()),
                    ["Q000000001_1.webp", "Q000000001_e1.webp"],
                )

            route = json.loads((out / "routes" / "Q000000.json").read_text())
            self.assertEqual(
                route["routes"]["Q000000001"],
                {"book_id": "CONTRACT-BOOK", "chapter_id": 1},
            )

if __name__ == "__main__":
    unittest.main()
