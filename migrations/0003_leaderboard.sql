CREATE TABLE IF NOT EXISTS leaderboard_users (
  user_key TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  photo_url TEXT,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leaderboard_answers (
  user_key TEXT NOT NULL REFERENCES leaderboard_users(user_key) ON DELETE CASCADE,
  qid TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK(correct IN (0,1)),
  week_key TEXT NOT NULL,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_key,qid)
);
CREATE INDEX IF NOT EXISTS leaderboard_answers_week ON leaderboard_answers(week_key,user_key,correct);

CREATE TABLE IF NOT EXISTS leaderboard_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS leaderboard_flags_user ON leaderboard_flags(user_key,created_at);

CREATE TABLE IF NOT EXISTS leaderboard_rate (
  user_key TEXT NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_key,bucket)
);
