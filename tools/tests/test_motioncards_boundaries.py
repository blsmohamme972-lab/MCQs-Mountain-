import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RUNTIME=[
    ROOT/"app/modules/motioncards-core.js",
    ROOT/"app/modules/motioncards-player.js",
    ROOT/"app/modules/motioncards.css",
    ROOT/"worker/motioncards-queue.mjs",
    ROOT/"motioncards-worker/worker.mjs",
    ROOT/"motioncards/lib/core.py",
    ROOT/"motioncards/lib/compiler.py",
    ROOT/"motioncards/lib/package.py",
    ROOT/"tools/motioncards/publish.py",
    ROOT/"tools/motioncards/queue_worker.py",
]
PROTECTED=ROOT/"Animations and illustrations"

class MotionCardsBoundaryTests(unittest.TestCase):
    def test_runtime_has_no_legacy_or_dnagens_dependency(self):
        forbidden=["Animations and illustrations","MedicalMotion","medical-motion","DNAgens","dnagens"]
        for path in RUNTIME:
            text=path.read_text(encoding="utf-8")
            for token in forbidden:
                self.assertNotIn(token,text,f"{path} must not reference protected legacy runtime {token}")

    def test_fixed_motioncards_namespaces(self):
        manifest=(ROOT/"app/modules/manifest.json").read_text()
        self.assertIn("modules/motioncards-core.js",manifest)
        self.assertIn("modules/motioncards-player.js",manifest)
        self.assertIn("modules/motioncards.css",manifest)
        css=(ROOT/"app/modules/motioncards.css").read_text()
        for selector in [x for x in css.split("{")[:-1] if x.strip().startswith(".")]:
            for piece in selector.split(","):
                piece=piece.strip()
                if piece.startswith("."):
                    self.assertTrue(piece.startswith(".kafu-motioncards-") or piece.startswith(".sr-only"),piece)
        player=(ROOT/"app/modules/motioncards-player.js").read_text()
        self.assertIn('ACTIONS["motioncards-open"]',player)
        self.assertIn("KafuMotionCards", (ROOT/"app/modules/motioncards-core.js").read_text())

    def test_protected_legacy_tree_still_exists_and_motioncards_does_not_import_it(self):
        self.assertTrue(PROTECTED.is_dir())
        self.assertTrue((PROTECTED/"AGENTS.md").is_file())
        for path in (ROOT/"motioncards").rglob("*"):
            if path.is_file() and path.suffix in {".py",".js",".mjs",".cjs"}:
                text=path.read_text(encoding="utf-8")
                self.assertNotIn("Animations and illustrations",text)
                self.assertNotIn("MedicalMotion",text)

if __name__=="__main__":unittest.main()
