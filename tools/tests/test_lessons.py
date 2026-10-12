"""Image lessons (motioncards/lib/lesson.py): spec checks and a scene that passes the real v2 validator."""
import unittest
from motioncards.lib.lesson import check_lesson, build_scene
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


if __name__ == "__main__":
    unittest.main()
