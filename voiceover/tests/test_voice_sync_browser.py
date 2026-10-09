"""Real-browser test of app/modules/motioncards-voice.js with a real Opus track.

Drives the controller the way motioncards-player.js would (anchor clock + requestAnimationFrame)
and checks Golden rule 7: picture time and voice time stay within 60 ms through play, seek and pause.
Needs playwright + Chromium (run voiceover/bootstrap.sh, or set MOTIONCARDS_CHROMIUM) and a sample track (voiceover/samples/*.opus).
"""
import base64, importlib.util, json, os, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
SAMPLE = next(iter(sorted((HERE / "samples").rglob("*.opus"))), None)

PAGE = """<!doctype html><meta charset=utf-8><body><script>%s</script><script>
const bytes=Uint8Array.from(atob('%s'),c=>c.charCodeAt(0)).buffer;
const V=KafuMotionCards.voice; const v=V.create(bytes); let anchor=0, playing=false, t=0, log=[];
function frame(now){ if(!playing) return; t=v.clock(now-anchor); anchor=now-t; requestAnimationFrame(frame); }
window.api={
  supported:()=>V.supported(),
  play:()=>{ v.play(t); playing=true; anchor=performance.now()-t; requestAnimationFrame(frame); },
  pause:()=>{ playing=false; v.pause(t); },
  seek:(ms)=>{ t=ms; anchor=performance.now()-t; v.seek(ms,playing); },
  state:()=>({t, audio: document.querySelector('audio')?.currentTime ?? window.__a.currentTime*1000 }),
};
</script>"""

@unittest.skipUnless(SAMPLE, "no sample track")
class VoiceSyncBrowser(unittest.TestCase):
    def test_sync_through_play_seek_pause(self):
        from playwright.sync_api import sync_playwright
        js = (HERE.parent / "app" / "modules" / "motioncards-voice.js").read_text()
        # expose the audio element so the test can read its clock
        js = js.replace('const a=(opts.audio||(()=>root.document.createElement("audio")))();',
                        'const a=(opts.audio||(()=>root.document.createElement("audio")))();root.__a=a;')
        html = PAGE % (js, base64.b64encode(SAMPLE.read_bytes()).decode())
        spec = importlib.util.spec_from_file_location("voiceover_tool", HERE / "voiceover.py")
        V = importlib.util.module_from_spec(spec); spec.loader.exec_module(V)
        exe = V.chromium()   # MOTIONCARDS_CHROMIUM, else the Chromium `voiceover.py setup` found
        with sync_playwright() as p:
            b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"], **({"executable_path": exe} if exe else {}))
            pg = b.new_page(); pg.set_content(html)
            self.assertTrue(pg.evaluate("api.supported()"), "Chromium must report Ogg Opus support")
            pg.evaluate("api.play()"); pg.wait_for_timeout(1500)
            s = pg.evaluate("({t:api.state().t, a:window.__a.currentTime*1000})")
            self.assertGreater(s["a"], 1000, f"audio did not advance: {s}")
            self.assertLess(abs(s["t"] - s["a"]), 60, f"picture/voice drift while playing: {s}")
            pg.evaluate("api.seek(5000)"); pg.wait_for_timeout(600)
            s = pg.evaluate("({t:api.state().t, a:window.__a.currentTime*1000})")
            self.assertTrue(5000 <= s["a"] <= 6000, f"seek did not move the voice: {s}")
            self.assertLess(abs(s["t"] - s["a"]), 60, f"drift after seek: {s}")
            pg.evaluate("api.pause()"); a1 = pg.evaluate("window.__a.currentTime"); pg.wait_for_timeout(400)
            self.assertEqual(a1, pg.evaluate("window.__a.currentTime"), "voice kept playing after pause")
            b.close()

if __name__ == "__main__":
    unittest.main()
