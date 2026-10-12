"""Image lessons (motioncards/lib/lesson.py): spec checks and a scene that passes the real v2 validator."""
import json, shutil, subprocess, tempfile, unittest
from pathlib import Path
from motioncards.lib.lesson import check_lesson, build_scene, slim_image, _image_size
from motioncards.lib.compiler import validate_scene

QID = "Q000000001"
AVIF = b"\x00\x00\x00\x1cftypavif" + b"\x00" * 64            # header is what the asset check reads
SPEC = {"qid": QID, "image": "a.png", "takeaway": "PSC: beaded bile ducts.", "engine": "breeze",
        "voices": {"D": "doctor-man", "S": "student-woman"}, "names": {"D": "Doctor", "S": "Student"},
        "shots": [{"x": 800, "y": 450, "z": 1}, {"x": 1200, "y": 160, "z": 2.5, "spot": [1200, 160, 190]}],
        "lines": [{"who": "D", "text": "(clears throat) Good morning.", "shot": 0, "tag": "voice design"},
                  {"who": "S", "text": "So what happens to the ducts?", "shot": 1, "dir": "curious"}]}
TRACK = {"track_ms": 6400, "cues": [{"t_ms": 500, "end_ms": 2500, "text": "(clears throat) Good morning."},
                                    {"t_ms": 2950, "end_ms": 5800, "text": "So what happens to the ducts?"}]}


class Lessons(unittest.TestCase):
    def test_spec_defaults_and_errors_name_the_field(self):
        s = check_lesson(dict(SPEC), QID)
        self.assertEqual((s["gap_ms"], s["tempo"], s["lang"]), (450, 1.0, "en-us"))
        bad = [({**SPEC, "qid": "Q000000002"}, "qid must be"), ({**SPEC, "shots": []}, "shots must be"),
               ({**SPEC, "lines": [{"text": "x", "shot": 5}]}, r"lines\[0\].shot"), ({**SPEC, "colour": 1}, "unknown fields colour"),
               ({**SPEC, "shots": [{"x": 1, "y": 1, "z": 9}]}, r"shots\[0\].z"), ({**SPEC, "takeaway": "x" * 241}, "240")]
        for spec, msg in bad:
            with self.subTest(msg):
                with self.assertRaisesRegex(ValueError, msg): check_lesson(spec, QID)

    def test_scene_is_landscape_valid_and_lasts_past_the_voice(self):
        scene = build_scene(check_lesson(dict(SPEC), QID), QID, AVIF, 1600, 900, TRACK)
        self.assertEqual((scene["stage"]["width"], scene["stage"]["height"]), (960, 540))
        self.assertGreaterEqual(scene["duration_ms"], TRACK["track_ms"] + 300)
        self.assertTrue(scene["assets"]["img"].startswith("data:image/avif;base64,"))
        validate_scene(scene, QID, scene["duration_ms"])
        self.assertIn('"who":"S"', scene["script"]); self.assertIn("function render(t, api)", scene["script"])

    @unittest.skipUnless(shutil.which("ffmpeg"), "needs ffmpeg")
    def test_large_source_image_is_kept_as_a_same_size_webp(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp); png = d / "a.png"; lesson = d / f"{QID}.lesson.json"
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "nullsrc=s=800x450,geq=random(1)*255:random(1)*255:random(1)*255",
                            "-frames:v", "1", str(png)], check=True)
            self.assertGreater(png.stat().st_size, 400 * 1024)
            lesson.write_text(json.dumps(SPEC))
            out = slim_image(lesson, png)
            self.assertEqual((out.name, png.exists()), ("a.webp", False))
            self.assertEqual(json.loads(lesson.read_text())["image"], "a.webp")
            self.assertEqual(_image_size(out), (800, 450))
            self.assertIs(slim_image(lesson, out), out)


if __name__ == "__main__":
    unittest.main()
