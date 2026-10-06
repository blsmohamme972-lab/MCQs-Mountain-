import io,json,tarfile,tempfile,unittest,urllib.error
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from tools.motioncards import state_store as s

def candidate(work:Path):
    release=work/"release";release.mkdir(parents=True,exist_ok=True)
    state={"schema":1,"packages":{},"animations":{},"history":{},"operations":{}}
    sha=s.state_digest(state)
    state_file=release/f"state-{sha}.json";state_file.write_text(json.dumps(state,sort_keys=True,indent=2)+"\n")
    site_src=work/"source-site";site_src.mkdir();(site_src/"build-info.json").write_text(json.dumps({"schema":1,"state_sha256":sha}))
    (site_src/"indexes").mkdir();(site_src/"indexes/x.json").write_text("{}")
    archive=release/f"site-{sha}.tar.gz";s._write_deterministic_site_archive(site_src,archive)
    meta={"schema":1,"state_sha256":sha,"tree_sha256":s.tree_digest(site_src),"state_file_sha256":s.sha256_file(state_file),"site_archive_sha256":s.sha256_file(archive)}
    (release/f"candidate-{sha}.json").write_text(json.dumps(meta))
    return sha,state,site_src

class MotionCardsStateStoreTests(unittest.TestCase):
    def test_release_lookup_auth_or_network_failure_is_not_treated_as_absent(self):
        with patch.object(s,"run",return_value=SimpleNamespace(returncode=1,stderr="HTTP 401 authentication required",stdout="")):
            with self.assertRaisesRegex(RuntimeError,"release_lookup_failed"):s.release_status()
        with patch.object(s,"run",return_value=SimpleNamespace(returncode=1,stderr="release not found",stdout="")):
            self.assertEqual(s.release_status(),"absent")
        with patch.object(s,"run",return_value=SimpleNamespace(returncode=1,stderr="HTTP 404 repository not found",stdout="")):
            with self.assertRaisesRegex(RuntimeError,"release_lookup_failed"):s.release_status()

    def test_safe_extract_rejects_links_and_traversal(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            for name,make in [
                ("link",lambda info:setattr(info,"type",tarfile.SYMTYPE)),
                ("traversal",lambda info:setattr(info,"name","../escape")),
            ]:
                path=root/(name+".tar.gz")
                with tarfile.open(path,"w:gz") as tar:
                    info=tarfile.TarInfo("safe");info.size=0;make(info);tar.addfile(info)
                with self.assertRaisesRegex(RuntimeError,"tar_"):s._safe_extract(path,root/("out-"+name))

    def test_bootstrap_503_is_allowed_only_for_owner_initial_recovery(self):
        class Bootstrap503(urllib.error.HTTPError):
            pass
        exc=urllib.error.HTTPError(s.PROD+"/build-info.json",503,"Service Unavailable",{"Retry-After":"60"},None)
        exc.fp=io.BytesIO(s.BOOTSTRAP_BODY)
        with patch("urllib.request.urlopen",side_effect=exc):
            self.assertEqual(s.live_state(allow_bootstrap=True),("bootstrap",""))
        exc2=urllib.error.HTTPError(s.PROD+"/build-info.json",503,"Service Unavailable",{"Retry-After":"60"},None)
        exc2.fp=io.BytesIO(s.BOOTSTRAP_BODY)
        with patch("urllib.request.urlopen",side_effect=exc2):
            with self.assertRaisesRegex(RuntimeError,"live_state_http_503"):s.live_state(allow_bootstrap=False)

    def test_bootstrap_503_does_not_override_existing_active_pointer(self):
        with tempfile.TemporaryDirectory() as td:
            work=Path(td)
            assets={"active.json"}
            with patch.object(s,"release_status",return_value="present"),patch.object(s,"release_assets",return_value=assets),\
                 patch.object(s,"live_state",side_effect=RuntimeError("motioncards_live_state_http_503")) as live:
                with self.assertRaisesRegex(RuntimeError,"live_state_http_503"):s.restore(work,True)
                live.assert_called_once_with(allow_bootstrap=False)

    def test_initial_promotion_without_active_pointer_recovers_verified_live_candidate(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td);seed=base/"seed";(seed/"release").mkdir(parents=True)
            sha,_,_=candidate(seed)
            assets={f"state-{sha}.json",f"site-{sha}.tar.gz",f"candidate-{sha}.json"}
            written=[]
            def fake_download(work,name):
                src=seed/"release"/name;dst=work/"release"/name
                if src.resolve()!=dst.resolve():dst.write_bytes(src.read_bytes())
                return dst
            with patch.object(s,"release_status",return_value="present"),patch.object(s,"release_assets",return_value=assets),\
                 patch.object(s,"live_state",return_value=("present",sha)),patch.object(s,"download_one",side_effect=fake_download),\
                 patch.object(s,"_write_active",side_effect=lambda work,state:written.append(state)):
                work=base/"restore";self.assertTrue(s.restore(work,False))
                self.assertEqual(written,[sha]);self.assertTrue((work/"state.json").is_file());self.assertTrue((work/"site/build-info.json").is_file())

    def test_unavailable_live_check_never_authorizes_old_pointer(self):
        with tempfile.TemporaryDirectory() as td:
            work=Path(td)
            with patch.object(s,"release_status",return_value="present"),patch.object(s,"live_state",side_effect=RuntimeError("motioncards_live_state_unavailable")):
                with self.assertRaisesRegex(RuntimeError,"live_state_unavailable"):s.restore(work,False)

    def test_unpromoted_initial_candidate_stays_inert_but_recovers_retry_base(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td);seed=base/"seed";(seed/"release").mkdir(parents=True)
            sha,_,_=candidate(seed);assets={f"state-{sha}.json",f"site-{sha}.tar.gz",f"candidate-{sha}.json"}
            def fake_download(work,name):
                src=seed/"release"/name;dst=work/"release"/name
                if src.resolve()!=dst.resolve():dst.write_bytes(src.read_bytes())
                return dst
            with patch.object(s,"release_status",return_value="present"),patch.object(s,"release_assets",return_value=assets),\
                 patch.object(s,"live_state",return_value=("absent","")),patch.object(s,"download_one",side_effect=fake_download):
                work=base/"restore";self.assertFalse(s.restore(work,False))
                self.assertFalse((work/"active.json").exists())
                self.assertEqual(json.loads((work/"state.json").read_text()),{"schema":1,"packages":{},"animations":{},"history":{},"operations":{}})
                self.assertFalse((work/"site/build-info.json").exists(),"unpromoted candidate must not become active locally")

    def test_multiple_unpromoted_initial_candidates_require_pending_pointer(self):
        with tempfile.TemporaryDirectory() as td:
            work=Path(td);a="a"*64;b="b"*64
            assets={f"candidate-{a}.json",f"state-{a}.json",f"site-{a}.tar.gz",f"candidate-{b}.json",f"state-{b}.json",f"site-{b}.tar.gz"}
            with patch.object(s,"release_status",return_value="present"),patch.object(s,"release_assets",return_value=assets),patch.object(s,"live_state",return_value=("absent","")):
                with self.assertRaisesRegex(RuntimeError,"initial_candidate_ambiguous"):s.restore(work,False)

    def test_candidate_upload_is_immutable_and_conflicts_on_different_remote_bytes(self):
        with tempfile.TemporaryDirectory() as td:
            work=Path(td);local=work/"state-a.json";local.write_bytes(b"new")
            def fake_run(*args,check=True):
                if args[:3]==("gh","release","download"):
                    dest=Path(args[args.index("--dir")+1]);dest.mkdir(parents=True,exist_ok=True);(dest/local.name).write_bytes(b"old")
                return SimpleNamespace(returncode=0,stderr="",stdout="")
            with patch.object(s,"run",side_effect=fake_run):
                with self.assertRaisesRegex(RuntimeError,"candidate_asset_conflict"):s.upload_immutable(work,local,{local.name})

if __name__=="__main__":unittest.main()
