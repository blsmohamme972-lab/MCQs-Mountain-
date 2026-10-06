CREATE TABLE IF NOT EXISTS motioncards_groups (
  group_key TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  part_total INTEGER NOT NULL CHECK(part_total BETWEEN 1 AND 100),
  status TEXT NOT NULL CHECK(status IN ('waiting','ready','running','published','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 10),
  lease_token TEXT,
  lease_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  error_summary TEXT,
  published_digest TEXT
);
CREATE INDEX IF NOT EXISTS motioncards_groups_ready ON motioncards_groups(status,created_at);

CREATE TABLE IF NOT EXISTS motioncards_queue (
  job_id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_key TEXT NOT NULL REFERENCES motioncards_groups(group_key),
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
CREATE INDEX IF NOT EXISTS motioncards_queue_group ON motioncards_queue(group_key,part_index);

CREATE TABLE IF NOT EXISTS motioncards_publications (
  group_key TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  package_sha256 TEXT NOT NULL,
  animations INTEGER NOT NULL CHECK(animations >= 0),
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);
