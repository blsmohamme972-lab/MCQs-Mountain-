from pathlib import Path
import unittest

# Conservative shared free-tier launch model. This intentionally includes non-Community traffic.
WORKER_LIMIT=100_000
D1_READ_LIMIT=5_000_000
D1_WRITE_LIMIT=100_000
SAFETY_FRACTION=.70

ACTIVE_COMMENTERS=1_000
EXISTING_FIXED_REQUESTS=2_000
LEADERBOARD_REQ_PER_USER=10.0
COMMENTS_REQ_PER_USER=5.5

# Indexed D1 writes count index maintenance too, so these are deliberately amplified.
COMMENTS_PER_USER=.6
HELPFUL_PER_USER=1.0
OTHER_MUTATIONS_PER_USER=.1
COMMENT_WRITE_ROWS=7
HELPFUL_WRITE_ROWS=7
OTHER_WRITE_ROWS=6
PROFILE_WRITE_ROWS=2

THREAD_READS_PER_USER=3.8
D1_ROWS_PER_THREAD_READ=140
OTHER_READ_ROWS_PER_USER=80

class CommentsBudgetTests(unittest.TestCase):
    def test_launch_worker_requests_keep_thirty_percent_headroom(self):
        projected=EXISTING_FIXED_REQUESTS+ACTIVE_COMMENTERS*(LEADERBOARD_REQ_PER_USER+COMMENTS_REQ_PER_USER)
        self.assertEqual(projected,17_500)
        self.assertLessEqual(projected,WORKER_LIMIT*SAFETY_FRACTION)

    def test_launch_d1_reads_keep_thirty_percent_headroom(self):
        projected=ACTIVE_COMMENTERS*(THREAD_READS_PER_USER*D1_ROWS_PER_THREAD_READ+OTHER_READ_ROWS_PER_USER)
        self.assertEqual(projected,612_000)
        self.assertLessEqual(projected,D1_READ_LIMIT*SAFETY_FRACTION)

    def test_launch_d1_writes_include_index_amplification(self):
        projected=ACTIVE_COMMENTERS*(
            COMMENTS_PER_USER*COMMENT_WRITE_ROWS+
            HELPFUL_PER_USER*HELPFUL_WRITE_ROWS+
            OTHER_MUTATIONS_PER_USER*OTHER_WRITE_ROWS+
            PROFILE_WRITE_ROWS
        )
        self.assertEqual(projected,13_800)
        self.assertLessEqual(projected,D1_WRITE_LIMIT*SAFETY_FRACTION)

    def test_heavy_ten_thousand_new_comments_identifies_write_bottleneck(self):
        comments=10_000*COMMENT_WRITE_ROWS
        helpful=20_000*HELPFUL_WRITE_ROWS
        reports_and_profiles=12_000
        projected=comments+helpful+reports_and_profiles
        self.assertGreater(projected,D1_WRITE_LIMIT*SAFETY_FRACTION)
        self.assertGreater(projected,D1_WRITE_LIMIT)

if __name__=="__main__":
    unittest.main()
