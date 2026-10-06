CREATE TABLE IF NOT EXISTS motioncards_groups (
  group_key TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  part_total INTEGER NOT NULL CHECK(part_total BETWEEN 1 AND 100),
  status TEXT NOT NULL CHECK(status IN ('waiting','ready','running','awaiting_confirmation','published','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 10),
  lease_token TEXT,
  lease_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  error_summary TEXT,
  published_digest TEXT,
  candidate_digest TEXT,
  replacement_targets_json TEXT,
  replacement_auth_json TEXT
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

CREATE TABLE IF NOT EXISTS motioncards_cards (
  qid TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  book_version INTEGER NOT NULL,
  chapter_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  package_id TEXT NOT NULL,
  package_revision INTEGER NOT NULL,
  entry_sha256 TEXT NOT NULL,
  entry_url TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS motioncards_cards_book ON motioncards_cards(book_id,book_version,active);

CREATE TABLE IF NOT EXISTS motioncards_card_versions (
  version_id INTEGER PRIMARY KEY AUTOINCREMENT,
  qid TEXT NOT NULL,
  book_id TEXT NOT NULL,
  book_version INTEGER NOT NULL,
  chapter_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  package_id TEXT NOT NULL,
  package_revision INTEGER NOT NULL,
  entry_sha256 TEXT NOT NULL,
  entry_url TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(qid,entry_sha256)
);
CREATE INDEX IF NOT EXISTS motioncards_card_versions_qid ON motioncards_card_versions(qid,version_id DESC);

CREATE TABLE IF NOT EXISTS motioncards_confirmations (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('replace','remove','restore')),
  qid TEXT,
  group_key TEXT,
  owner_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  candidate_digest TEXT,
  expected_active_digest TEXT,
  target_digest TEXT,
  targets_json TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS motioncards_confirmations_open ON motioncards_confirmations(expires_at,used_at);

CREATE TABLE IF NOT EXISTS motioncards_operations (
  operation_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('remove','restore')),
  qid TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ready','running','published','failed')),
  owner_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  expected_active_digest TEXT,
  target_digest TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  lease_token TEXT,
  lease_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  error_summary TEXT
);
CREATE INDEX IF NOT EXISTS motioncards_operations_ready ON motioncards_operations(status,created_at);
