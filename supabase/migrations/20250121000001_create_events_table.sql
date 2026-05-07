-- ─────────────────────────────────────────────────────────────────────────────
-- Baseline: create events table
-- The events table was hand-created in production and never had a migration.
-- This file recreates it for staging/fresh environments so subsequent
-- migrations that reference events(id) can run without errors.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS events (
  id                 BIGSERIAL PRIMARY KEY,
  title              TEXT NOT NULL,
  date               TIMESTAMPTZ,
  location           TEXT,
  category           TEXT,
  lat                DOUBLE PRECISION,
  lng                DOUBLE PRECISION,
  organizer          TEXT,
  price              TEXT,
  external_link      TEXT,
  is_multiple_dates  BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Public read access (same policy as production)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view events" ON events
  FOR SELECT USING (true);
