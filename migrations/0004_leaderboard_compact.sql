-- Score summaries and compact lifetime deduplication. Backfill once at migration.
CREATE TABLE leaderboard_summary (
  user_key TEXT PRIMARY KEY REFERENCES leaderboard_users(user_key) ON DELETE CASCADE,
  total_score INTEGER NOT NULL DEFAULT 0,
  week_key TEXT NOT NULL,
  weekly_score INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
CREATE INDEX leaderboard_total_rank ON leaderboard_summary(hidden,total_score DESC,user_key);
CREATE INDEX leaderboard_week_rank ON leaderboard_summary(week_key,hidden,weekly_score DESC,user_key);
WITH latest AS (
  SELECT user_key,MAX(week_key) week_key FROM leaderboard_answers GROUP BY user_key
)
INSERT INTO leaderboard_summary
SELECT u.user_key,SUM(a.correct),l.week_key,
  SUM(CASE WHEN a.week_key=l.week_key THEN a.correct ELSE 0 END),u.hidden
FROM leaderboard_users u JOIN leaderboard_answers a USING(user_key)
JOIN latest l ON l.user_key=u.user_key GROUP BY u.user_key;

CREATE TABLE leaderboard_attempt_buckets (
  user_key TEXT NOT NULL REFERENCES leaderboard_users(user_key) ON DELETE CASCADE,
  bucket INTEGER NOT NULL,
  attempted TEXT NOT NULL CHECK(json_valid(attempted)),
  score_delta INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  week_key TEXT NOT NULL,
  PRIMARY KEY(user_key,bucket)
) WITHOUT ROWID;
INSERT INTO leaderboard_attempt_buckets(user_key,bucket,attempted,week_key)
SELECT user_key,CAST(substr(qid,2) AS INTEGER)/4096,
  json_group_array(CAST(substr(qid,2) AS INTEGER)%4096),MAX(week_key)
FROM leaderboard_answers GROUP BY user_key,CAST(substr(qid,2) AS INTEGER)/4096;
-- Retain historical rows during staged deployment. New Worker writes only compact buckets.

CREATE TRIGGER leaderboard_bucket_insert AFTER INSERT ON leaderboard_attempt_buckets BEGIN
  INSERT INTO leaderboard_summary(user_key,total_score,week_key,weekly_score,hidden)
  VALUES(NEW.user_key,NEW.score_delta,NEW.week_key,NEW.score_delta,
    (SELECT hidden FROM leaderboard_users WHERE user_key=NEW.user_key))
  ON CONFLICT(user_key) DO UPDATE SET total_score=total_score+NEW.score_delta,
    weekly_score=CASE WHEN week_key=NEW.week_key THEN weekly_score+NEW.score_delta ELSE NEW.score_delta END,
    week_key=NEW.week_key;
END;
CREATE TRIGGER leaderboard_bucket_update AFTER UPDATE ON leaderboard_attempt_buckets BEGIN
  INSERT INTO leaderboard_summary(user_key,total_score,week_key,weekly_score,hidden)
  VALUES(NEW.user_key,NEW.score_delta,NEW.week_key,NEW.score_delta,
    (SELECT hidden FROM leaderboard_users WHERE user_key=NEW.user_key))
  ON CONFLICT(user_key) DO UPDATE SET total_score=total_score+NEW.score_delta,
    weekly_score=CASE WHEN week_key=NEW.week_key THEN weekly_score+NEW.score_delta ELSE NEW.score_delta END,
    week_key=NEW.week_key;
END;
CREATE TABLE leaderboard_snapshots (
  period_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  refreshed_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TRIGGER leaderboard_privacy_update AFTER UPDATE OF hidden ON leaderboard_users
WHEN OLD.hidden != NEW.hidden BEGIN
  UPDATE leaderboard_summary SET hidden=NEW.hidden WHERE user_key=NEW.user_key;
  DELETE FROM leaderboard_snapshots;
END;

-- During version staging the previous Worker can still receive answers. Feed
-- those into the compact ledger too, and ignore retries already seen there.
CREATE TRIGGER leaderboard_legacy_dedupe BEFORE INSERT ON leaderboard_answers
WHEN EXISTS(SELECT 1 FROM leaderboard_attempt_buckets b,json_each(b.attempted) j
  WHERE b.user_key=NEW.user_key AND b.bucket=CAST(substr(NEW.qid,2) AS INTEGER)/4096
  AND j.value=CAST(substr(NEW.qid,2) AS INTEGER)%4096)
BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER leaderboard_legacy_insert AFTER INSERT ON leaderboard_answers BEGIN
  INSERT INTO leaderboard_attempt_buckets(user_key,bucket,attempted,score_delta,accepted_count,week_key)
  VALUES(NEW.user_key,CAST(substr(NEW.qid,2) AS INTEGER)/4096,
    json_array(CAST(substr(NEW.qid,2) AS INTEGER)%4096),NEW.correct,1,NEW.week_key)
  ON CONFLICT(user_key,bucket) DO UPDATE SET
    attempted=json_insert(attempted,'$[#]',CAST(substr(NEW.qid,2) AS INTEGER)%4096),
    score_delta=NEW.correct,accepted_count=1,week_key=NEW.week_key;
END;
