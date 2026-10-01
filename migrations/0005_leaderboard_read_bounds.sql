-- Additive: JSON ledgers, summaries and historical answer rows stay intact.
ALTER TABLE leaderboard_attempt_buckets ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
-- Old Worker versions do not know revision. Advance it on their writes too.
-- Restrict the summary trigger so the revision-only compatibility update
-- cannot award the same delta twice.
DROP TRIGGER leaderboard_bucket_update;
CREATE TRIGGER leaderboard_bucket_update AFTER UPDATE OF attempted,score_delta,accepted_count,week_key ON leaderboard_attempt_buckets BEGIN
  INSERT INTO leaderboard_summary(user_key,total_score,week_key,weekly_score,hidden)
  VALUES(NEW.user_key,NEW.score_delta,NEW.week_key,NEW.score_delta,
    (SELECT hidden FROM leaderboard_users WHERE user_key=NEW.user_key))
  ON CONFLICT(user_key) DO UPDATE SET total_score=total_score+NEW.score_delta,
    weekly_score=CASE WHEN week_key=NEW.week_key THEN weekly_score+NEW.score_delta ELSE NEW.score_delta END,
    week_key=NEW.week_key;
END;
CREATE TRIGGER leaderboard_bucket_revision AFTER UPDATE OF attempted ON leaderboard_attempt_buckets
WHEN NEW.revision=OLD.revision BEGIN
  UPDATE leaderboard_attempt_buckets SET revision=revision+1
  WHERE user_key=NEW.user_key AND bucket=NEW.bucket;
END;
-- One bounded counter write per submission; no question IDs or student IDs.
CREATE TABLE leaderboard_submission_usage (
  day TEXT PRIMARY KEY,
  submissions INTEGER NOT NULL,
  measured_submissions INTEGER NOT NULL,
  rows_read INTEGER NOT NULL,
  rows_written INTEGER NOT NULL,
  max_rows_read INTEGER NOT NULL
) WITHOUT ROWID;
