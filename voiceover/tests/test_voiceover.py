"""Unit tests for the pure parts of voiceover.py (no model needed; numpy for the signal tests)."""
import importlib.util, unittest
from pathlib import Path
_spec = importlib.util.spec_from_file_location("voiceover_tool", Path(__file__).resolve().parents[1] / "voiceover.py")
V = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(V)

SCENE = {"qid": "Q000000001", "duration_ms": 8000, "layers": [
    {"type": "text", "text": "Title", "fixed": True},
    {"type": "text", "text": "2 · Second beat", "show": [2700, 5000]},
    {"type": "text", "text": "1 · First beat", "show": [0, 2700]},
    {"type": "text", "text": "3 · Third beat", "show": [5000, 8000]}]}


class Beats(unittest.TestCase):
    def test_beats_come_from_numbered_captions_in_time_order(self):
        b = V.beats_from_scene(SCENE)
        self.assertEqual([x["caption"] for x in b], ["First beat", "Second beat", "Third beat"])
        self.assertEqual([(x["start_ms"], x["end_ms"]) for x in b], [(0, 2700), (2700, 5000), (5000, 8000)])

    def test_draft_requires_captions(self):
        with self.assertRaises(ValueError): V.draft_doc({"qid": "Q1", "duration_ms": 8000, "layers": []})

    def test_windows_leave_lead_tail_and_end_hold(self):
        d = V.draft_doc(SCENE)
        self.assertEqual(V.window_ms(d, 0), 2700 - V.TAIL_MS - V.FIRST_LEAD_MS)
        self.assertEqual(V.window_ms(d, 1), 5000 - V.TAIL_MS - 2700 - V.LEAD_MS)
        self.assertEqual(V.window_ms(d, 2), 8000 - V.END_HOLD_MS - 5000 - V.LEAD_MS)
        self.assertTrue(all(V.max_words(d, i) >= 4 for i in range(3)))


class Text(unittest.TestCase):
    LEX = {"say": {"INR": "I N R", "NH₃": "ammonia"}, "ipa": {"en-us": {"ketoacidosis": "kˌiːtoʊˌæsɪdˈoʊsɪs"}}}

    def test_say_rewrites_whole_tokens_only(self):
        self.assertEqual(V.spoken_text("The INR rises; NH₃ builds; WINRAR", self.LEX), "The I N R rises; ammonia builds; WINRAR")

    def test_ipa_split_marks_dictionary_words(self):
        parts = V.ipa_split("Diabetic Ketoacidosis, again.", self.LEX["ipa"]["en-us"])
        self.assertEqual(parts, [("Diabetic ", False), ("kˌiːtoʊˌæsɪdˈoʊsɪs", True), (", again.", False)])

    def test_word_score_ignores_asr_spacing_and_repeats(self):
        self.assertEqual(V.word_score("Too little prothrombin.", "too little pro thrombin"), 1.0)
        self.assertEqual(V.word_score("The INR rises.", "The INR rises. The INR rises."), 1.0)
        self.assertLess(V.word_score("Ketoacidosis", "ketosidosis"), 0.95)


class Signal(unittest.TestCase):
    def test_onsets_and_trim(self):
        import numpy as np
        sr = 16000; x = np.zeros(sr * 3, np.float32)
        x[int(0.5 * sr):int(0.9 * sr)] = 0.3; x[int(1.7 * sr):int(2.2 * sr)] = 0.3
        on = V.speech_onsets(x, [{"t_ms": 500}, {"t_ms": 1650}], sr=sr)
        self.assertEqual(on[0], 0); self.assertEqual(on[1], 50)
        y = np.concatenate([np.zeros(V.SR // 5, np.float32), np.full(V.SR // 2, 0.2, np.float32)])
        self.assertLess(abs(len(V.trim_lead(y)) - (V.SR // 2 + V.SR * 8 // 1000)), V.SR // 200 + 1)

    def test_onset_ignores_the_previous_beats_tail(self):
        import numpy as np
        sr = 16000; x = np.zeros(sr * 3, np.float32)
        x[int(0.5 * sr):int(1.38 * sr)] = 0.3; x[int(1.5 * sr):int(2.0 * sr)] = 0.3   # line 1 ends 120 ms before line 2
        on = V.speech_onsets(x, [{"t_ms": 500, "end_ms": 1380}, {"t_ms": 1500, "end_ms": 2000}], sr=sr)
        self.assertEqual(on, [0, 0])

    def test_assign_words_to_nearest_beat(self):
        W = type("W", (), {})
        def w(s, e): o = W(); o.start, o.end = s, e; return o
        cues = [{"t_ms": 250, "end_ms": 1800}, {"t_ms": 2820, "end_ms": 4500}]
        g = V.assign_words([w(0.0, 0.4), w(2.2, 2.6), w(2.9, 3.2)], cues)
        self.assertEqual([len(x) for x in g], [1, 2])


if __name__ == "__main__":
    unittest.main()
