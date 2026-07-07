CREATE TABLE IF NOT EXISTS ranks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'student',
  ending TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ranks_mode_score ON ranks (mode, score DESC);
