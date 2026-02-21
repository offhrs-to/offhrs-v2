-- One row per visitor per day for unique daily visitor counts.
-- Filled by POST /api/record-visit (server uses service role).
CREATE TABLE IF NOT EXISTS daily_visits (
  visit_date DATE NOT NULL,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (visit_date, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_visits_visit_date ON daily_visits(visit_date);

ALTER TABLE daily_visits ENABLE ROW LEVEL SECURITY;

-- No public policies: only service role (API) can read/write.
-- Inserts/selects are done from Next.js API routes using createAdminClient().
