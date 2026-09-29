CREATE TABLE IF NOT EXISTS publish_warnings (
  book_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  qid TEXT NOT NULL,
  local_id INTEGER NOT NULL,
  source_page INTEGER,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(book_id,version,qid,reason)
);
CREATE INDEX IF NOT EXISTS publish_warnings_book ON publish_warnings(book_id,version,local_id);
