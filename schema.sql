CREATE TABLE IF NOT EXISTS visits (
  session_id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS visits_started_at ON visits(started_at);

CREATE TABLE IF NOT EXISTS team_comparisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  team_a_json TEXT NOT NULL,
  team_b_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS team_comparisons_created_at ON team_comparisons(created_at);
