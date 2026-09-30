from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]

class CommentsDeployContractTests(unittest.TestCase):
    def test_migration_defaults_rollout_off(self):
        sql=(ROOT/"migrations/0004_question_comments.sql").read_text()
        self.assertIn("VALUES('enabled','0')",sql)
        self.assertNotIn("VALUES('enabled','1')",sql)

    def test_deploy_preserves_staged_safety_and_enables_last(self):
        workflow=(ROOT/".github/workflows/deploy-app.yml").read_text()
        ordered=[
            "Apply D1 migrations",
            "Upload staged Worker version",
            "Smoke exact staged Version URL",
            "Smoke staged Community while rollout is gated",
            "Promote staged version to 100%",
            "Verify production after promotion",
            "Enable and verify Community in production",
        ]
        positions=[workflow.index(x) for x in ordered]
        self.assertEqual(positions,sorted(positions))

    def test_authenticated_smoke_has_fail_closed_rollback_and_no_secret_logging(self):
        src=(ROOT/"tools/comments_deploy_smoke.py").read_text()
        self.assertIn('api(origin,"admin-setting",owner,{"enabled":False}',src)
        self.assertIn('api(origin,"moderate",b,{"comment_id":reply_id,"action":"verify","moderator":True},expect=403)',src)
        self.assertNotIn("print(token",src)
        self.assertNotIn("print(init_data",src)

if __name__=="__main__":
    unittest.main()
