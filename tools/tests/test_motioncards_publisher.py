import json,tempfile,unittest,zipfile
from pathlib import Path
from motioncards.lib.core import adapt_exports,publisher_fingerprint,content_hash
from motioncards.lib.package import scaffold_workspace,build_package
from tools.motioncards.publish import apply_package,load_state

def q(qid):
    return {"id":qid,"book_id":"BOOK","version":1,"chapter_id":1,"type":"sba","stem":"Question "+qid,
            "options":["Correct","Wrong"],"answer":"A","explanation":"Why","images":[],"explanation_images":[]}
def env(qs):
    chapter={"id":1,"title":"One","questions":len(qs),"qids":[x["id"] for x in qs],"url":"https://kafu-content-1.blsmohamme97.workers.dev/packs/book/v1/chapter.json"}
    ints=[{"qid":x["id"],"publisher_fingerprint":publisher_fingerprint(x),"publisher_fingerprint_source":"recomputed_from_publish_py_fingerprint_v1",
           "content_hash":content_hash(x),"content_hash_algorithm":"SHA-256","content_hash_canonicalization":"kafu-question-canonical-json-v1"} for x in qs]
    return {"export_type":"kafu_mcq_text_export","schema_version":1,"source":{"kind":"published","catalog_url":"https://kafu-content-1.blsmohamme97.workers.dev/catalog.json","catalog_sha256":"a"*64,"snapshot_pinned":True},
            "scope":{"type":"book","book_id":"BOOK","book_version":1},"book":{"id":"BOOK","title":"Book","version":1,"questions":len(qs),"chapters":[chapter]},"chapters":[chapter],
            "expected_question_count":len(qs),"exported_question_count":len(qs),"questions":qs,"export_metadata":{"question_integrity":ints}}

def fetcher(qs):
    chapter={"id":1,"title":"One","questions":len(qs),"qids":[x["id"] for x in qs],"url":"https://kafu-content-1.blsmohamme97.workers.dev/packs/book/v1/chapter.json"}
    catalog={"books":[{"id":"BOOK","version":1,"questions":len(qs),"chapters":[chapter]}]}
    pack={"schema":1,"book_id":"BOOK","version":1,"chapter_id":1,"questions":qs}
    def get(url,step):
        if url.endswith("/catalog.json"):return catalog
        if url.endswith("/chapter.json"):return pack
        raise AssertionError(url)
    return get

def make(root:Path,package_id,revision,qs,selected,replace=False):
    b=adapt_exports([env(qs)]);ws=root/(package_id+str(revision));out=root/f"MCARDS_{package_id}_r{revision}.zip"
    scaffold_workspace(b,ws,package_id,revision,selected,None,6000)
    for p in (ws/"scenes").glob("*.json"):
        s=json.loads(p.read_text());s["takeaway"]="A focused takeaway."
        if replace:s["replace"]=True
        p.write_text(json.dumps(s))
    build_package(b,ws,out);return out

class MotioncardsPublisherTests(unittest.TestCase):
    def test_two_sequential_uploads_preserve_both_batches_and_indexes(self):
        qs=[q("Q000000001"),q("Q000000002")]
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);state=root/"state.json";site=root/"site"
            a=make(root,"A",1,qs,["Q000000001"]);b=make(root,"B",1,qs,["Q000000002"])
            apply_package(a,state,site,fetcher(qs));apply_package(b,state,site,fetcher(qs))
            data=load_state(state);self.assertEqual(len(data["packages"]),2);self.assertEqual(len(data["animations"]),2)
            idx=json.loads((site/"indexes/BOOK/v1/index.json").read_text())
            self.assertEqual(set(idx["animations"]),{"Q000000001","Q000000002"})
            self.assertTrue((site/"assets/A/r1").is_dir() and (site/"assets/B/r1").is_dir())

    def test_identical_package_is_noop_but_same_revision_changed_payload_conflicts(self):
        qs=[q("Q000000001")]
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);state=root/"state.json";site=root/"site";a=make(root,"A",1,qs,[qs[0]["id"]])
            first=apply_package(a,state,site,fetcher(qs));second=apply_package(a,state,site,fetcher(qs))
            self.assertFalse(first["duplicate"]);self.assertTrue(second["duplicate"])
            changed=root/"changed.zip"
            with zipfile.ZipFile(a) as src,zipfile.ZipFile(changed,"w") as dst:
                for info in src.infolist():
                    raw=src.read(info.filename)
                    if info.filename=="validation-report.json":raw=b'{"status":"PASS","changed":true}'
                    dst.writestr(info.filename,raw)
            with self.assertRaisesRegex(ValueError,"package_revision_conflict"):apply_package(changed,state,site,fetcher(qs))

    def test_replace_requires_intent_and_preserves_unrelated_qid(self):
        qs=[q("Q000000001"),q("Q000000002")]
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);state=root/"state.json";site=root/"site"
            apply_package(make(root,"A",1,qs,["Q000000001","Q000000002"]),state,site,fetcher(qs))
            with self.assertRaisesRegex(ValueError,"replace_requires"):apply_package(make(root,"B",1,qs,["Q000000001"]),state,site,fetcher(qs))
            apply_package(make(root,"B",2,qs,["Q000000001"],True),state,site,fetcher(qs))
            data=load_state(state)
            self.assertEqual(data["animations"]["BOOK|1|Q000000001"]["package_id"],"B")
            self.assertEqual(data["animations"]["BOOK|1|Q000000002"]["package_id"],"A")

    def test_source_mismatch_fails_before_mutating_state_or_site(self):
        original=q("Q000000001")
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);state=root/"state.json";site=root/"site";z=make(root,"A",1,[original],[original["id"]])
            changed={**original,"answer":"B"}
            with self.assertRaisesRegex(ValueError,"published_content_hash_mismatch"):apply_package(z,state,site,fetcher([changed]))
            self.assertFalse(state.exists());self.assertFalse((site/"assets").exists())

    def test_stale_book_version_rejected_without_catalog_hash_overreach(self):
        source=q("Q000000001")
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);z=make(root,"A",1,[source],[source["id"]])
            def stale(url,step):
                if url.endswith("catalog.json"):return {"books":[{"id":"BOOK","version":2,"questions":1,"chapters":[]}]}
                raise AssertionError
            with self.assertRaisesRegex(ValueError,"version_stale"):apply_package(z,root/"state.json",root/"site",stale)

if __name__=="__main__":unittest.main()
