-- Question comment packs (COMMENTS_<BOOK-ID>_rN.zip) and owner restore/clear requests. The publisher
-- (tools/drain_queue.py) claims them after books and admin jobs, in order; comments themselves live in the content state.
CREATE TABLE IF NOT EXISTS comment_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL CHECK(action IN ('publish','restore','clear')),
  book_id TEXT NOT NULL,
  revision INTEGER CHECK(revision IS NULL OR revision >= 1),
  telegram_file_id TEXT,
  telegram_file_unique_id TEXT,
  filename TEXT,
  file_size INTEGER CHECK(file_size IS NULL OR file_size BETWEEN 1 AND 2097152),
  status TEXT NOT NULL CHECK(status IN ('ready','running','published','failed')) DEFAULT 'ready',
  attempts INTEGER NOT NULL DEFAULT 0,
  questions INTEGER,
  comments INTEGER,
  book_questions INTEGER,
  book_comments INTEGER,
  error_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at TEXT,
  finished_at TEXT,
  CHECK((action='publish' AND revision IS NOT NULL AND telegram_file_id IS NOT NULL AND telegram_file_unique_id IS NOT NULL AND filename IS NOT NULL AND file_size IS NOT NULL)
     OR (action='restore' AND revision IS NOT NULL AND telegram_file_id IS NULL)
     OR (action='clear' AND revision IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS comment_jobs_revision ON comment_jobs(book_id,revision) WHERE action='publish';
CREATE INDEX IF NOT EXISTS comment_jobs_ready ON comment_jobs(status,id);
