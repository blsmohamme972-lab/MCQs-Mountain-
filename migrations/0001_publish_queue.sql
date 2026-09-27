CREATE TABLE IF NOT EXISTS publish_groups (
  group_key TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  part_total INTEGER NOT NULL CHECK(part_total BETWEEN 1 AND 100),
  status TEXT NOT NULL CHECK(status IN ('waiting','ready','running','published','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  force_republish INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at TEXT,
  finished_at TEXT,
  error_summary TEXT
);
CREATE INDEX IF NOT EXISTS publish_groups_ready ON publish_groups(status,created_at);

CREATE TABLE IF NOT EXISTS publish_queue (
  job_id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_key TEXT NOT NULL REFERENCES publish_groups(group_key),
  part_index INTEGER NOT NULL,
  part_total INTEGER NOT NULL,
  telegram_file_id TEXT NOT NULL,
  telegram_file_unique_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 19922944),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_key,part_index),
  UNIQUE(telegram_file_unique_id)
);
CREATE INDEX IF NOT EXISTS publish_queue_group ON publish_queue(group_key,part_index);

CREATE TABLE IF NOT EXISTS admin_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('remove','rollback','moderate')),
  book_id TEXT NOT NULL,
  version INTEGER,
  status TEXT NOT NULL CHECK(status IN ('ready','running','published','failed')) DEFAULT 'ready',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at TEXT,
  finished_at TEXT,
  error_summary TEXT
);
CREATE INDEX IF NOT EXISTS admin_jobs_ready ON admin_jobs(status,created_at);

CREATE TABLE IF NOT EXISTS published_books (
  book_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  questions INTEGER NOT NULL DEFAULT 0,
  chapters INTEGER NOT NULL DEFAULT 0,
  images INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  held INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(book_id,version)
);

CREATE TABLE IF NOT EXISTS flags (
  qid TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  source_page INTEGER,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
