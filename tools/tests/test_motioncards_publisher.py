import json,tempfile,unittest,zipfile
from pathlib import Path
from motioncards.lib.core import adapt_exports,publisher_fingerprint,content_hash
from motioncards.lib.package import scaffold_workspace,build_package
from tools.motioncards.publish import apply_package,load_state,plan_packages,apply_management

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

def make(root:Path,package_id,revision,qs,selected,replace=False,variant=None):
    b=adapt_exports([env(qs)]);ws=root/(package_id+str(revision));out=root/f"MCARDS_{package_id}_r{revision}.zip"
    scaffold_workspace(b,ws,package_id,revision,selected,None,6000)
    for p in (ws/"scenes").glob("*.json"):
        s=json.loads(p.read_text());s["takeaway"]="A focused takeaway."
        if variant:s.setdefault("layers",[]).append({"type":"text","text":variant,"x":20,"y":20,"size":16})
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
            self.assertFalse(first["duplicate"]);self.assertTrue(second["duplicate"]);self.assertFalse(second["changed"])
            self.assertEqual(second["package_sha256"],first["package_sha256"])
            changed=root/"changed.zip"
            with zipfile.ZipFile(a) as src,zipfile.ZipFile(changed,"w") as dst:
                for info in src.infolist():
                    raw=src.read(info.filename)
                    if info.filename=="validation-report.json":raw=b'{"status":"PASS","changed":true}'
                    dst.writestr(info.filename,raw)
            with self.assertRaisesRegex(ValueError,"package_revision_conflict"):apply_package(changed,state,site,fetcher(qs))

    def test_replace_requires_intent_confirmation_and_preserves_unrelated_qid(self):
        qs=[q("Q000000001"),q("Q000000002")]
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);state=root/"state.json";site=root/"site"
            apply_package(make(root,"A",1,qs,["Q000000001","Q000000002"]),state,site,fetcher(qs))
            with self.assertRaisesRegex(ValueError,"replace_requires"):apply_package(make(root,"B",1,qs,["Q000000001"]),state,site,fetcher(qs))
            replacement=make(root,"B",2,qs,["Q000000001"],True)
            with self.assertRaisesRegex(ValueError,"confirmation_required"):apply_package(replacement,state,site,fetcher(qs))
            plan=plan_packages([replacement],state,fetcher(qs));self.assertEqual(len(plan["replacements"]),1)
            auth={plan["replacements"][0]["qid"]:plan["replacements"][0]}
            apply_package(replacement,state,site,fetcher(qs),auth)
            data=load_state(state)
            self.assertEqual(data["animations"]["BOOK|1|Q000000001"]["package_id"],"B")
            self.assertEqual(data["animations"]["BOOK|1|Q000000002"]["package_id"],"A")
            self.assertEqual(len(data["history"]["BOOK|1|Q000000001"]),2)

    def test_remove_restore_is_card_scoped_and_revalidates_source(self):
        qs=[q("Q000000001"),q("Q000000002"),q("Q000000003")]
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);state=root/"state.json";site=root/"site"
            first=make(root,"A",1,qs,["Q000000001","Q000000002"])
            apply_package(first,state,site,fetcher(qs))
            apply_package(make(root,"C",1,qs,["Q000000003"]),state,site,fetcher(qs))
            before=load_state(state);q1=before["animations"]["BOOK|1|Q000000001"];old_digest=q1["entry_sha256"]
            removed=apply_management({"operation_id":"remove-1","kind":"remove","book_id":"BOOK","book_version":1,"chapter_id":1,"qid":"Q000000001","expected_active_digest":old_digest},state,site,fetcher(qs))
            self.assertTrue(removed["changed"]);mid=load_state(state)
            self.assertNotIn("BOOK|1|Q000000001",mid["animations"]);self.assertIn("BOOK|1|Q000000002",mid["animations"]);self.assertIn("BOOK|1|Q000000003",mid["animations"])
            idx=json.loads((site/"indexes/BOOK/v1/index.json").read_text());self.assertNotIn("Q000000001",idx["animations"])
            restored=apply_management({"operation_id":"restore-1","kind":"restore","book_id":"BOOK","book_version":1,"chapter_id":1,"qid":"Q000000001","expected_active_digest":"","target_digest":old_digest},state,site,fetcher(qs))
            self.assertTrue(restored["changed"]);after=load_state(state)
            self.assertEqual(after["animations"]["BOOK|1|Q000000001"]["entry_sha256"],old_digest)
            self.assertIn("BOOK|1|Q000000002",after["animations"]);self.assertIn("BOOK|1|Q000000003",after["animations"])
            self.assertTrue(apply_management({"operation_id":"restore-1","kind":"restore","book_id":"BOOK","book_version":1,"chapter_id":1,"qid":"Q000000001","expected_active_digest":"","target_digest":old_digest},state,site,fetcher(qs))["duplicate"])

    def test_stale_replacement_authorization_cannot_overwrite_newer_active_card(self):
        qs=[q("Q000000001")]
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);state=root/"state.json";site=root/"site"
            apply_package(make(root,"A",1,qs,["Q000000001"]),state,site,fetcher(qs))
            stale_zip=make(root,"B",2,qs,["Q000000001"],True);stale_plan=plan_packages([stale_zip],state,fetcher(qs))
            fresh_zip=make(root,"C",3,qs,["Q000000001"],True);fresh_plan=plan_packages([fresh_zip],state,fetcher(qs))
            apply_package(fresh_zip,state,site,fetcher(qs),{fresh_plan["replacements"][0]["qid"]:fresh_plan["replacements"][0]})
            with self.assertRaisesRegex(ValueError,"confirmation_stale"):
                apply_package(stale_zip,state,site,fetcher(qs),{stale_plan["replacements"][0]["qid"]:stale_plan["replacements"][0]})

    def test_duplicate_recovery_snapshot_tracks_current_durable_state_not_old_zip(self):
        qs=[q("Q000000001")]
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);state=root/"state.json";site=root/"site"
            original=make(root,"A",1,qs,["Q000000001"])
            first=apply_package(original,state,site,fetcher(qs))
            old_digest=first["affected"][0]["entry_sha256"]

            apply_management({"operation_id":"remove-a","kind":"remove","book_id":"BOOK","book_version":1,"chapter_id":1,
                              "qid":"Q000000001","expected_active_digest":old_digest},state,site,fetcher(qs))
            removed=apply_package(original,state,site,fetcher(qs))
            self.assertTrue(removed["duplicate"])
            self.assertFalse(removed["reconciliation"][0]["card"]["active"])
            self.assertEqual(removed["reconciliation"][0]["card"]["entry_sha256"],old_digest)
            self.assertGreaterEqual(len(removed["reconciliation"][0]["versions"]),1)

            apply_management({"operation_id":"restore-a","kind":"restore","book_id":"BOOK","book_version":1,"chapter_id":1,
                              "qid":"Q000000001","expected_active_digest":"","target_digest":old_digest},state,site,fetcher(qs))
            replacement=make(root,"B",2,qs,["Q000000001"],True)
            plan=plan_packages([replacement],state,fetcher(qs))
            auth={plan["replacements"][0]["qid"]:plan["replacements"][0]}
            apply_package(replacement,state,site,fetcher(qs),auth)

            duplicate_old=apply_package(original,state,site,fetcher(qs))
            snap=duplicate_old["reconciliation"][0]
            self.assertTrue(snap["card"]["active"])
            self.assertEqual(snap["card"]["package_id"],"B")
            self.assertEqual(snap["card"]["package_revision"],2)
            # Package revision/URL identity can change even when deterministic scene bytes are identical.
            self.assertEqual({x["package_id"] for x in snap["versions"]},{"A","B"})

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

    def test_old_versions_are_pruned_but_recent_ones_stay_restorable(self):
        from tools.motioncards.publish import KEEP_PREVIOUS
        qs=[q("Q000000001"),q("Q000000002")]
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);state=root/"state.json";site=root/"site"
            apply_package(make(root,"KEEP",1,qs,["Q000000002"]),state,site,fetcher(qs))       # an unrelated live card
            for rev in range(1,7):                                                               # six uploads of one card
                z=make(root,"A",rev,qs,["Q000000001"],replace=rev>1,variant=f"Revision {rev}")
                auth={x["qid"]:x for x in plan_packages([z],state,fetcher(qs))["replacements"]}
                result=apply_package(z,state,site,fetcher(qs),auth)
            files=sorted(p.relative_to(site).as_posix() for p in (site/"assets").rglob("*.html"))
            self.assertEqual(len([f for f in files if f.startswith("assets/A/")]),KEEP_PREVIOUS+1)
            self.assertTrue(any(f.startswith("assets/KEEP/r1/") for f in files))                 # never touch other live cards
            self.assertEqual(sorted(d.name for d in (site/"assets/A").iterdir()),["r4","r5","r6"])  # empty folders removed
            self.assertEqual(len(result["pruned"]),1)
            data=load_state(state);hist=data["history"]["BOOK|1|Q000000001"]
            self.assertEqual([r["package_revision"] for r in hist],[4,5,6])
            for r in list(data["animations"].values())+hist:                                     # every record still has its file
                self.assertTrue((site/r["entry_url"].split(".dev/",1)[1]).is_file())
            old=next(r for r in hist if r["package_revision"]==4)
            active=data["animations"]["BOOK|1|Q000000001"]["entry_sha256"]
            restored=apply_management({"operation_id":"r-4","kind":"restore","book_id":"BOOK","book_version":1,"chapter_id":1,"qid":"Q000000001",
                                       "expected_active_digest":active,"target_digest":old["entry_sha256"]},state,site,fetcher(qs))
            self.assertTrue(restored["changed"]);self.assertEqual(load_state(state)["animations"]["BOOK|1|Q000000001"]["package_revision"],4)
            self.assertTrue((site/"assets/A/r4").is_dir())

    def test_failed_publish_deletes_nothing(self):
        qs=[q("Q000000001")]
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);state=root/"state.json";site=root/"site"
            for rev in range(1,5):
                z=make(root,"A",rev,qs,["Q000000001"],replace=rev>1)
                apply_package(z,state,site,fetcher(qs),{x["qid"]:x for x in plan_packages([z],state,fetcher(qs))["replacements"]})
            before=sorted(p.relative_to(site).as_posix() for p in site.rglob("*") if p.is_file())
            z=make(root,"A",5,qs,["Q000000001"],replace=True)
            with self.assertRaisesRegex(ValueError,"confirmation_required"):apply_package(z,state,site,fetcher(qs))
            self.assertEqual(before,sorted(p.relative_to(site).as_posix() for p in site.rglob("*") if p.is_file()))

if __name__=="__main__":unittest.main()
