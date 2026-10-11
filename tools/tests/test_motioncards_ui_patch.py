import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PLAYER = ROOT / "app/modules/motioncards-player.js"
CSS = ROOT / "app/modules/motioncards.css"


class MotionCardsUiPatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.player = PLAYER.read_text(encoding="utf-8")
        cls.css = CSS.read_text(encoding="utf-8")

    def test_lesson_slot_sits_below_the_mcq(self):
        self.assertIn('const ex=section.querySelector(".explain");if(ex)return ex;', self.player)
        self.assertIn("if(anchor.nextElementSibling!==slot)anchor.after(slot);", self.player)
        self.assertIn("aspect-ratio: 16 / 9", self.css)
        self.assertNotIn("kafu-motioncards-trigger", self.player + self.css)

    def test_player_dom_keeps_status_before_controls_and_final_after_controls(self):
        self.assertIn('class="kafu-motioncards-status"', self.player)
        self.assertLess(self.player.index('class="kafu-motioncards-error"'), self.player.index('class="kafu-motioncards-loading"'))
        self.assertLess(self.player.index('class="kafu-motioncards-loading"'), self.player.index('class="kafu-motioncards-controls"'))
        self.assertLess(self.player.index('class="kafu-motioncards-controls"'), self.player.index('class="kafu-motioncards-final-slot"'))
        self.assertIn('output data-motioncards-host="time" aria-live="off"', self.player)

    def test_presentation_preserves_hidden_state_and_stable_takeaway_geometry(self):
        for selector in (
            ".kafu-motioncards-loading[hidden]",
            ".kafu-motioncards-error[hidden]",
            ".kafu-motioncards-final[hidden]",
        ):
            self.assertIn(selector, self.css)
        self.assertRegex(self.css, r"\.kafu-motioncards-stage\s*\{[^}]*block-size:\s*clamp")
        self.assertIn(".kafu-motioncards-final:not([hidden])", self.css)
        self.assertIn("kafu-motioncards-note-in", self.css)
        self.assertIn("@media (prefers-reduced-motion: reduce)", self.css)

    def test_range_presentation_mirror_does_not_change_protocol(self):
        self.assertIn('active.range.style.setProperty("--kafu-motioncards-progress"', self.player)
        self.assertIn("aria-valuetext", self.player)
        self.assertEqual(self.player.count('type="range"'), 1)
        self.assertIn('step="50"', self.player)


if __name__ == "__main__":
    unittest.main()
