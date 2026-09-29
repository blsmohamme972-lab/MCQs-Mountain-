-- Per-question community discussion. Additive-only; independent of study progress.
CREATE TABLE IF NOT EXISTS comment_users (
  user_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  banned INTEGER NOT NULL DEFAULT 0 CHECK(banned IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comment_threads (
  qid TEXT PRIMARY KEY CHECK(qid GLOB 'Q[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  book_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS comment_threads_book ON comment_threads(book_id,qid);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qid TEXT NOT NULL REFERENCES comment_threads(qid) ON DELETE CASCADE,
  author_key TEXT NOT NULL REFERENCES comment_users(user_key) ON DELETE RESTRICT,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  body TEXT,
  client_nonce TEXT,
  status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden_pending','hidden','deleted')),
  helpful_count INTEGER NOT NULL DEFAULT 0 CHECK(helpful_count>=0),
  report_count INTEGER NOT NULL DEFAULT 0 CHECK(report_count>=0),
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(author_key,client_nonce)
);
CREATE INDEX IF NOT EXISTS comments_thread_top_newest ON comments(qid,parent_id,status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS comments_thread_top_helpful ON comments(qid,parent_id,status,verified DESC,pinned DESC,helpful_count DESC,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS comments_parent ON comments(parent_id,status,created_at,id);
CREATE INDEX IF NOT EXISTS comments_author_rate ON comments(author_key,created_at DESC);
CREATE INDEX IF NOT EXISTS comments_author_status ON comments(author_key,status,created_at DESC);

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_key TEXT NOT NULL REFERENCES comment_users(user_key) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(comment_id,user_key)
);
CREATE INDEX IF NOT EXISTS comment_votes_user_rate ON comment_votes(user_key,created_at DESC);

CREATE TABLE IF NOT EXISTS comment_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  qid TEXT NOT NULL,
  reporter_key TEXT NOT NULL REFERENCES comment_users(user_key) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(comment_id,reporter_key)
);
CREATE INDEX IF NOT EXISTS comment_reports_comment ON comment_reports(comment_id,status,created_at);
CREATE INDEX IF NOT EXISTS comment_reports_reporter_rate ON comment_reports(reporter_key,created_at DESC);
CREATE INDEX IF NOT EXISTS comment_reports_queue ON comment_reports(status,created_at,id);
CREATE INDEX IF NOT EXISTS comment_reports_qid ON comment_reports(qid,status,created_at);
