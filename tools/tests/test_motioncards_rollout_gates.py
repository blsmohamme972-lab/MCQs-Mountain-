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

    def test_first_motioncards_service_bootstrap_is_first_publish_only_and_fail_closed(self):
        text=(ROOT/".github/workflows/publish-motioncards-queue.yml").read_text(encoding="utf-8")
        upload=text.index("Upload staged MotionCards Worker version")
        smoke=text.index("Smoke exact staged MotionCards version")
        segment=text[upload:smoke]
        self.assertIn("Worker that does not yet exist",segment)
        self.assertIn("inputs.initialize_state",segment)
        self.assertIn("status: 503",segment)
        self.assertIn("Bootstrapping empty MotionCards service for first publish only.",segment)
        self.assertIn("wrangler deploy --config motioncards-worker/wrangler.bootstrap.jsonc",segment)
        self.assertGreaterEqual(segment.count("wrangler versions upload"),1)
        self.assertNotIn("versions deploy",segment)

    def test_motioncards_browser_smoke_keeps_strict_sandbox_without_playwright_service_worker_hook(self):
        text=(ROOT/"tools/motioncards/browser_smoke.py").read_text(encoding="utf-8")
        self.assertIn('sandbox="allow-scripts"',text)
        self.assertNotIn('service_workers="block"',text)

    def test_motioncards_browser_smoke_retries_each_card_but_still_fails_closed(self):
        text=(ROOT/"tools/motioncards/browser_smoke.py").read_text(encoding="utf-8")
        self.assertIn('"--attempts",type=int,default=4',text)
        self.assertIn('"--retry-delay",type=float,default=5.0',text)
        self.assertIn('"motioncards_browser_smoke":"FAIL"',text)
        self.assertIn("sys.exit(1)",text)
        self.assertIn('card[\'qid\']',text)

    def test_motioncards_production_smoke_retries_after_promotion_but_still_fails_closed(self):
        text=(ROOT/".github/workflows/publish-motioncards-queue.yml").read_text(encoding="utf-8")
        promote=text.index("Promote staged MotionCards version to 100%")
        verify=text.index("Verify MotionCards production after promotion")
        activate=text.index("Advance durable active state pointer")
        segment=text[verify:activate]
        self.assertLess(promote,verify)
        self.assertIn("for attempt in $(seq 1 24)",segment)
        self.assertIn("sleep $(( attempt < 6 ? 3 : 8 ))",segment)
        self.assertIn('"$attempt" -eq 24',segment)
        self.assertIn("MotionCards production smoke did not converge after promotion.",segment)
        self.assertIn("exit 1",segment)
        self.assertLess(verify,activate)

    def test_ui_main_push_does_not_expect_production_sha_before_authorized_deploy(self):
        text=(ROOT/".github/workflows/ui.yml").read_text(encoding="utf-8")
        self.assertIn("Main journeys, offline persistence, budgets and approved screenshots",text)
        self.assertNotIn('python tools/ui/production_smoke.py --commit "$GITHUB_SHA"',text)

    def test_authorized_app_deploy_verifies_exact_production_sha_after_promotion(self):
        text=(ROOT/".github/workflows/deploy-app.yml").read_text(encoding="utf-8")
        promote=text.index("Promote staged version to 100%")
        exact=text.index('python tools/ui/production_smoke.py --commit "$GITHUB_SHA"')
        self.assertGreater(exact,promote)
        self.assertIn("Verify exact production UI SHA after promotion",text)

    def test_failed_deploy_cannot_report_exact_production_success(self):
        text=(ROOT/".github/workflows/deploy-app.yml").read_text(encoding="utf-8")
        exact=text.index("Verify exact production UI SHA after promotion")
        self.assertNotIn("if: always()",text[exact:])
        self.assertIn("Verify production after promotion",text)

if __name__=="__main__":
    unittest.main()
