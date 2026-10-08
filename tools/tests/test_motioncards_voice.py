"""Voice-over inside MotionCards packages (motioncards/lib/voice.py, voiceover/).

The voice is part of the card: packaged as voice/<QID>.opus, checked by the validator, embedded in the
compiled entry and handed to the host over the card's MessageChannel. These tests cover the contract and
every way a tampered or wrong voice must be refused. The browser test (MOTIONCARDS_BROWSER_TESTS=1)
proves the real sandboxed card hands over exactly the packaged bytes.
"""
import hashlib, json, os, shutil, tempfile, unittest, zipfile
from pathlib import Path
from motioncards.lib.core import adapt_exports
from motioncards.lib.package import scaffold_workspace, build_package, validate_package
from motioncards.lib.compiler import compile_scene
from motioncards.lib.voice import validate_voice, ogg_opus_duration_ms
from tools.tests.test_motioncards_publisher import q, env, fetcher
from tools.motioncards.publish import apply_package, load_state

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "voiceover" / "samples" / "ch10" / "Q000009379.opus"
SAMPLE_TRACK = json.loads((ROOT / "voiceover" / "samples" / "ch10" / "Q000009379.track.json").read_text())
QID = "Q000000001"


def workspace(root: Path, voice=True, duration=8000):
    b = adapt_exports([env([q(QID)])]); ws = root / "ws"
    scaffold_workspace(b, ws, "VOICE", 1, [QID], None, duration)
    p = ws / "scenes" / f"{QID}.scene.json"; s = json.loads(p.read_text()); s["takeaway"] = "A focused takeaway."; p.write_text(json.dumps(s))
    if voice:
        (ws / "voice").mkdir(); shutil.copy(SAMPLE, ws / "voice" / f"{QID}.opus")
        (ws / "voice" / f"{QID}.track.json").write_text(json.dumps({**SAMPLE_TRACK, "qid": QID}))
    return b, ws


def rewrite(src: Path, dst: Path, change):
    with zipfile.ZipFile(src) as z: files = {n: z.read(n) for n in z.namelist()}
    change(files)
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        for n, d in sorted(files.items()): z.writestr(n, d)
    return dst


class VoicePackage(unittest.TestCase):
    def test_voice_is_packaged_checksummed_and_embedded(self):
        with tempfile.TemporaryDirectory() as td:
            b, ws = workspace(Path(td)); out = Path(td) / "MCARDS_VOICE_r1.zip"
            build_package(b, ws, out, require_voice=True); m = validate_package(out)
            v = m["animations"][0]["voice"]; data = SAMPLE.read_bytes()
            self.assertEqual(v["path"], f"voice/{QID}.opus"); self.assertEqual(v["sha256"], hashlib.sha256(data).hexdigest())
            self.assertEqual(v["bytes"], len(data)); self.assertEqual(v["mime"], "audio/ogg; codecs=opus"); self.assertEqual(len(v["cues"]), 3)
            with zipfile.ZipFile(out) as z:
                self.assertEqual(z.read(v["path"]), data)
                entry = z.read(f"entries/{QID}.html").decode()
            self.assertIn('id="kafu-voice"', entry); self.assertIn(v["sha256"], entry)
            self.assertNotIn("media-src", entry)  # the card never plays media itself

    def test_voice_is_required_by_default_in_the_cli_path(self):
        with tempfile.TemporaryDirectory() as td:
            b, ws = workspace(Path(td), voice=False)
            with self.assertRaisesRegex(ValueError, "voice_missing"): build_package(b, ws, Path(td) / "MCARDS_VOICE_r1.zip", require_voice=True)
            build_package(b, ws, Path(td) / "MCARDS_VOICE_r1.zip")          # explicit silent re-packaging still works
            self.assertNotIn("voice", validate_package(Path(td) / "MCARDS_VOICE_r1.zip")["animations"][0])

    def test_tampered_or_wrong_voice_is_refused(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td); b, ws = workspace(root); good = root / "MCARDS_VOICE_r1.zip"; build_package(b, ws, good, require_voice=True)
            vp = f"voice/{QID}.opus"
            def manifest(files, f):
                m = json.loads(files["motioncards-manifest.json"]); f(m["animations"][0]); files["motioncards-manifest.json"] = json.dumps(m).encode()
            cases = {
                "manifest_voice_mismatch": lambda fs: fs.__setitem__(vp, fs[vp][:-1] + bytes([fs[vp][-1] ^ 1])),     # one byte changed
                "voice_not_ogg_opus": lambda fs: fs.__setitem__(vp, b"RIFF" + fs[vp][4:]),
                "manifest_asset_missing": lambda fs: fs.pop(vp),
                "unapproved_package_files": lambda fs: fs.__setitem__("voice/Q000000002.opus", fs[vp]),
                "manifest_voice_path_invalid": lambda fs: manifest(fs, lambda r: r["voice"].__setitem__("path", "entries/x.opus")),
                "voice_track_longer_than_card": lambda fs: manifest(fs, lambda r: r["voice"].__setitem__("track_ms", 99999)),
                "voice_cue_timing_invalid": lambda fs: manifest(fs, lambda r: r["voice"]["cues"].__setitem__(0, {"t_ms": 9000, "end_ms": 9100, "text": "x"})),
                "compiled_entry_scene_mismatch": lambda fs: manifest(fs, lambda r: r.pop("voice")),                    # voice stripped but entry still has it
            }
            for err, change in cases.items():
                with self.subTest(err):
                    with self.assertRaisesRegex(ValueError, err): validate_package(rewrite(good, root / f"MCARDS_VOICE_r9.zip", change))

    def test_voice_checks(self):
        data = SAMPLE.read_bytes(); track = {"track_ms": SAMPLE_TRACK["track_ms"], "cues": SAMPLE_TRACK["cues"]}
        self.assertLessEqual(abs(ogg_opus_duration_ms(data) - SAMPLE_TRACK["track_ms"]), 120)
        with self.assertRaisesRegex(ValueError, "voice_too_large"): validate_voice(data * 6, track, 8000)
        with self.assertRaisesRegex(ValueError, "voice_track_length_mismatch"): validate_voice(data, {**track, "track_ms": 3000}, 8000)
        with self.assertRaisesRegex(ValueError, "voice_track_longer_than_card|voice_track_length_mismatch"): validate_voice(data, track, 6000)
        with self.assertRaisesRegex(ValueError, "voice_requires_schema_v2"):
            compile_scene({"schema_version": 1, "qid": QID, "duration_ms": 8000, "takeaway": "T.",
                           "layers": [{"type": "label", "text": "x", "x": 1, "y": 1}]}, voice=data)

    def test_publisher_index_carries_voice_for_host_verification(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td); b, ws = workspace(root); out = root / "MCARDS_VOICE_r1.zip"; build_package(b, ws, out, require_voice=True)
            site = root / "site"; apply_package(out, root / "state.json", site, fetcher([q(QID)]))
            rec = json.loads((site / "indexes" / "BOOK" / "v1" / "index.json").read_text())["animations"][QID]
            self.assertEqual(rec["voice"], {"mime": "audio/ogg; codecs=opus", "bytes": SAMPLE.stat().st_size,
                                            "sha256": hashlib.sha256(SAMPLE.read_bytes()).hexdigest(), "track_ms": SAMPLE_TRACK["track_ms"]})


@unittest.skipUnless(os.environ.get("MOTIONCARDS_BROWSER_TESTS") == "1", "set MOTIONCARDS_BROWSER_TESTS=1")
class VoiceHandOverBrowser(unittest.TestCase):
    APP = "https://kafu.blsmohamme97.workers.dev"; CARDS = "https://kafu-motioncards.blsmohamme97.workers.dev"
    HOST = """<!doctype html><meta charset=utf-8><body><iframe sandbox="allow-scripts"></iframe><script>
const qid='%s',channel='0123456789abcdef0123456789abcdef0123',frame=document.querySelector('iframe');window.got=[];
addEventListener('message',ev=>{const m=ev.data;if(ev.source!==frame.contentWindow||!m||m.type!=='kafu-motioncards-ready'||m.channel_id!==channel)return;
 const c=new MessageChannel();c.port1.onmessage=async e=>{const x=e.data;if(x.type==='voice'){const d=await crypto.subtle.digest('SHA-256',x.data);
   x.digest=[...new Uint8Array(d)].map(v=>v.toString(16).padStart(2,'0')).join('');x.len=x.data.byteLength;delete x.data;}window.got.push(x);};
 c.port1.start();frame.contentWindow.postMessage({type:'connect',protocol:1,channel_id:channel,qid},'*',[c.port2]);});
frame.src='%s#'+channel;</script>"""

    def test_card_hands_its_exact_voice_bytes_to_the_host_after_ready(self):
        from playwright.sync_api import sync_playwright
        with tempfile.TemporaryDirectory() as td:
            b, ws = workspace(Path(td)); scene = json.loads((ws / "scenes" / f"{QID}.scene.json").read_text())
        data = SAMPLE.read_bytes(); html = compile_scene(scene, voice=data); entry = self.CARDS + f"/{QID}.html"
        with sync_playwright() as p:
            exe = os.environ.get("MOTIONCARDS_CHROMIUM"); br = p.chromium.launch(**({"executable_path": exe} if exe else {}))
            ctx = br.new_context()
            ctx.route(self.APP + "/host", lambda r: r.fulfill(status=200, content_type="text/html", body=self.HOST % (QID, entry)))
            ctx.route(entry, lambda r: r.fulfill(status=200, content_type="text/html", body=html,
                      headers={"Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src 'none'; connect-src 'none'; sandbox allow-scripts"}))
            pg = ctx.new_page(); pg.goto(self.APP + "/host"); pg.wait_for_function("window.got.length>=2", timeout=8000)
            got = pg.evaluate("window.got"); br.close()
        self.assertEqual([g["type"] for g in got[:2]], ["ready", "voice"])
        self.assertEqual(got[1]["len"], len(data)); self.assertEqual(got[1]["digest"], hashlib.sha256(data).hexdigest())
        self.assertEqual(got[1]["sha256"], hashlib.sha256(data).hexdigest()); self.assertEqual(got[1]["mime"], "audio/ogg; codecs=opus")


if __name__ == "__main__":
    unittest.main()
