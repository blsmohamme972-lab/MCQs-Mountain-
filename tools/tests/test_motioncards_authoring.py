import hashlib,json,tempfile,unittest,zipfile
from pathlib import Path
from motioncards.lib.core import adapt_exports,canonical_json,content_hash,publisher_fingerprint,resolve_answer,select_questions
from motioncards.lib.package import scaffold_workspace,build_package,validate_package,check_archive_structure
from motioncards.lib.spec import parse_package_filename

def question(qid,chapter=23,qtype="sba",answer="A",options=None):
    return {"id":qid,"book_id":"ANATOMY-MRCS-WOOD-BLACKBURN","version":2,"chapter_id":chapter,"type":qtype,
            "stem":"Stem "+qid,"lead_in":"","options":options or ["Alpha","Beta","Gamma"],"answer":answer,
            "explanation":"Explanation","images":[],"explanation_images":[],"status":"source_verified"}

def envelope(questions,scope_type="book",part=None):
    chapters=[{"id":23,"title":"Upper Limb","questions":30,"qids":[f"Q{n:09d}" for n in range(7341,7371)]}]
    ints=[]
    for q in questions:
        ints.append({"qid":q["id"],"publisher_fingerprint":publisher_fingerprint(q),"publisher_fingerprint_source":"recomputed_from_publish_py_fingerprint_v1",
                     "content_hash":content_hash(q),"content_hash_algorithm":"SHA-256","content_hash_canonicalization":"kafu-question-canonical-json-v1"})
    return {"export_type":"kafu_mcq_text_export","schema_version":1,"exported_at":"2026-10-06T00:00:00Z",
      "source":{"kind":"published","catalog_url":"https://kafu-content-1.blsmohamme97.workers.dev/catalog.json","catalog_sha256":"a"*64,
                "index_url":"https://kafu-content-1.blsmohamme97.workers.dev/books/ANATOMY-MRCS-WOOD-BLACKBURN/v2/index.json","index_sha256":"b"*64,"snapshot_pinned":True},
      "scope":{"type":scope_type,"book_id":"ANATOMY-MRCS-WOOD-BLACKBURN","book_version":2,"chapter_id":None,"chapter_title":"Whole book"},
      "book":{"id":"ANATOMY-MRCS-WOOD-BLACKBURN","title":"Anatomy Questions for the MRCS","version":2,"questions":209,"chapters":chapters},
      "chapters":chapters,"expected_question_count":209,"exported_question_count":len(questions),"part":part,"questions":questions,
      "export_metadata":{"question_integrity":ints}}

class MotionCardsAuthoringTests(unittest.TestCase):
    def test_golden_canonical_matches_js_export_core(self):
        root=Path(__file__).resolve().parents[2]
        vectors=json.loads((root/"motioncards/golden/canonical-v1.json").read_text())["vectors"]
        for v in vectors:
            self.assertEqual(publisher_fingerprint(v["question"]),v["publisher_fingerprint"])
            self.assertEqual(content_hash(v["question"]),v["content_hash"])

    def test_exact_scope_boundary_bug_uses_30_supplied_records_not_209(self):
        qs=[question(f"Q{n:09d}") for n in range(7341,7371)]
        b=adapt_exports([envelope(qs)])
        self.assertEqual(len(b.questions),30)
        self.assertEqual(b.effective_scope["type"],"chapter")
        self.assertEqual(b.effective_scope["chapter_id"],23)
        self.assertEqual(b.effective_scope["qids"][0],"Q000007341")
        self.assertEqual(b.effective_scope["qids"][-1],"Q000007370")
        self.assertEqual(b.warnings[0]["code"],"scope_label_mismatch")

    def test_part_count_is_part_semantics_not_aggregate(self):
        qs=[question(f"Q{n:09d}") for n in range(7341,7346)]
        e=envelope(qs,part={"index":1,"count":2,"total_question_count":30,"question_count":5,"included_qids":[q["id"] for q in qs]})
        b=adapt_exports([e]);self.assertEqual(len(b.questions),5)

    def test_duplicate_or_snapshot_conflict_rejected(self):
        q=question("Q000007341");e=envelope([q])
        with self.assertRaisesRegex(ValueError,"duplicate_qid"):adapt_exports([e,e])
        e2=json.loads(json.dumps(e));e2["source"]["catalog_sha256"]="c"*64
        with self.assertRaisesRegex(ValueError,"inconsistent_export_snapshots"):adapt_exports([e,e2])

    def test_answer_resolution_before_shuffle(self):
        self.assertEqual(resolve_answer(question("Q000007341",qtype="sba",answer="B"))["statements"],["Beta"])
        self.assertEqual(resolve_answer(question("Q000007342",qtype="emq",answer="C"))["statements"],["Gamma"])
        self.assertEqual(resolve_answer(question("Q000007343",qtype="multi",answer=["A","C"]))["statements"],["Alpha","Gamma"])
        mtf=question("Q000007344",qtype="mtf",answer=["T","F"],options=["One","Two"])
        self.assertEqual(resolve_answer(mtf)["statements"],["One — True","Two — False"])
        with self.assertRaisesRegex(ValueError,"unsupported"):resolve_answer(question("Q000007345",qtype="free",answer="A"))

    def test_changed_answer_changes_content_hash_not_publisher_fingerprint(self):
        a=question("Q000007341",answer="A");b={**a,"answer":"B"}
        self.assertEqual(publisher_fingerprint(a),publisher_fingerprint(b))
        self.assertNotEqual(content_hash(a),content_hash(b))

    def test_selection_count_duration_and_explicit_block(self):
        qs=[question(f"Q{n:09d}") for n in range(7341,7344)];b=adapt_exports([envelope(qs)])
        selected=select_questions(b,None,2,8000);self.assertEqual([x["qid"] for x in selected],["Q000007341","Q000007342"])
        with self.assertRaisesRegex(ValueError,"count_qid_conflict"):select_questions(b,["Q000007341"],2,8000)
        with self.assertRaisesRegex(ValueError,"duration_missing"):select_questions(b,["Q000007341"],None,None)
        with self.assertRaisesRegex(ValueError,"unavailable"):select_questions(b,["Q000009999"],None,8000)
        img={**qs[0],"images":["figure.webp"]};e=envelope([img]);e["chapters"][0]["qids"]=[img["id"]];e["chapters"][0]["questions"]=1;e["book"]["chapters"]=e["chapters"];e["export_metadata"]["question_integrity"][0].update(content_hash=content_hash(img),publisher_fingerprint=publisher_fingerprint(img))
        with self.assertRaisesRegex(ValueError,"source_image_bytes_not_inspected"):select_questions(adapt_exports([e]),[img["id"]],None,8000)

    def test_package_contains_only_selected_questions_and_source_derived_answer(self):
        qs=[question(f"Q{n:09d}") for n in range(7341,7344)];b=adapt_exports([envelope(qs)])
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);ws=root/"ws";out=root/"MCARDS_DEMO_r1.zip"
            scaffold_workspace(b,ws,"DEMO",1,["Q000007341","Q000007343"],None,8000)
            for p in (ws/"scenes").glob("*.json"):
                data=json.loads(p.read_text());data["takeaway"]="Focused visual relationship.";p.write_text(json.dumps(data))
            build_package(b,ws,out);m=validate_package(out)
            self.assertEqual(m["selection"]["qids"],["Q000007341","Q000007343"])
            self.assertEqual(m["animations"][0]["final_panel"]["correct_answer_statements"],["Alpha"])
            with zipfile.ZipFile(out) as z:
                names=z.namelist()
                self.assertNotIn("source/questions/Q000007342.json",names)
                self.assertNotIn("input/raw-export-001.json",names)

    def test_zip_name_is_disjoint_from_book_parser_shape(self):
        self.assertEqual(parse_package_filename("MCARDS_UPPER-LIMB_r2.zip")["group_key"],"UPPER-LIMB_r2")
        self.assertIsNone(parse_package_filename("BOOK_v2.zip"))
        self.assertIsNone(parse_package_filename("MCARDS_X_r1_part3of2.zip"))

    def test_zip_traversal_collision_and_forbidden_host_files_rejected(self):
        def make(name):
            td=tempfile.TemporaryDirectory();path=Path(td.name)/"x.zip"
            with zipfile.ZipFile(path,"w") as z:z.writestr(name,b"x")
            return td,path
        for name,reason in [("../x","traversal"),("entries\\..\\x","traversal"),("_worker.js","hosting"),("_headers","hosting")]:
            td,path=make(name)
            with td,self.assertRaises(ValueError):check_archive_structure(path)
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/"x.zip"
            with zipfile.ZipFile(path,"w") as z:
                z.writestr("entries/A.html",b"x");z.writestr("entries/a.html",b"y")
            with self.assertRaisesRegex(ValueError,"collision"):check_archive_structure(path)

if __name__=="__main__":unittest.main()
