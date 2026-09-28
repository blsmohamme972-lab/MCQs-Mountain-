-- Additive. Old Workers ignore these tables; no personal study state is migrated.
CREATE TABLE IF NOT EXISTS question_reports (
  id TEXT PRIMARY KEY,
  qid TEXT NOT NULL,
  book_id TEXT NOT NULL,
  book_version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS question_reports_recent ON question_reports(created_at DESC);

-- Pseudonymous user keys exist only for abuse throttling; expired rows are pruned on submissions.
CREATE TABLE IF NOT EXISTS report_rate_limits (
  user_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS report_rate_expiry ON report_rate_limits(expires_at);
