-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening: api_usage_counters
-- Persistent daily quota counters for costly endpoints (e.g. Stripe Tax calls),
-- since the in-memory rate limiter resets per serverless instance and can't
-- enforce a true daily cap across instances. Backend-only (service role).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_usage_counters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key  text NOT NULL, -- e.g. "book-quote:ip:1.2.3.4" or "book-quote:user:<uuid>"
  day         date NOT NULL,
  count       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_key, day)
);

ALTER TABLE api_usage_counters ENABLE ROW LEVEL SECURITY;

-- Backend-only; no anon/authenticated access.
DROP POLICY IF EXISTS "api_usage_counters: service role all" ON api_usage_counters;
CREATE POLICY "api_usage_counters: service role all"
  ON api_usage_counters FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_api_usage_counters_day ON api_usage_counters(day);

-- Atomically increments a daily counter and returns the new count.
-- Used by the app to enforce daily quotas without a read-then-write race.
CREATE OR REPLACE FUNCTION increment_api_usage_counter(p_bucket_key text, p_day date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO api_usage_counters (bucket_key, day, count)
  VALUES (p_bucket_key, p_day, 1)
  ON CONFLICT (bucket_key, day)
  DO UPDATE SET count = api_usage_counters.count + 1, updated_at = now()
  RETURNING count INTO new_count;

  RETURN new_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_api_usage_counter(text, date) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION increment_api_usage_counter(text, date) TO service_role;

-- Housekeeping: old counters aren't needed after a couple of days.
CREATE OR REPLACE FUNCTION prune_api_usage_counters()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM api_usage_counters WHERE day < (CURRENT_DATE - INTERVAL '7 days');
$$;

REVOKE EXECUTE ON FUNCTION prune_api_usage_counters() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION prune_api_usage_counters() TO service_role;
