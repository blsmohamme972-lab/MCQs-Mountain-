import re
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class MotionCardsRolloutGateTests(unittest.TestCase):
    def test_app_deploy_is_fail_closed_before_remote_migration(self):
        text=(ROOT/".github/workflows/deploy-app.yml").read_text(encoding="utf-8")
        self.assertIn("motioncards_rollout_authorized:",text)
        self.assertIn("MOTIONCARDS_ROLLOUT_ENABLED",text)
        gate=text.index("Gate MotionCards first production rollout")
        migrate=text.index("Apply D1 migrations")
        promote=text.index("Promote staged version to 100%")
        self.assertLess(gate,migrate)
        self.assertLess(gate,promote)
        self.assertIn("Do not treat a merge as production-neutral.",text)
        self.assertRegex(text,r'MOTIONCARDS_ROLLOUT_ENABLED.*!= "true"')
        self.assertRegex(text,r'MOTIONCARDS_ROLLOUT_AUTHORIZED.*!= "true"')

    def test_hourly_publisher_is_disabled_until_rollout_gate(self):
        text=(ROOT/".github/workflows/publish-motioncards-queue.yml").read_text(encoding="utf-8")
        self.assertIn('production_authorized:',text)
        self.assertIn("github.event_name == 'schedule' && vars.MOTIONCARDS_ROLLOUT_ENABLED == 'true'",text)
        self.assertIn("github.event_name == 'workflow_dispatch'",text)
        self.assertIn("inputs.production_authorized == true",text)
        self.assertIn("-f production_authorized=true",text)
        self.assertNotIn("MOTIONCARDS_ROLLOUT_ENABLED: true",text)

if __name__=="__main__":
    unittest.main()
