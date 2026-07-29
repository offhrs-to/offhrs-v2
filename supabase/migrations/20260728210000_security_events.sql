-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening: security_events
-- Persistent store for [SECURITY_EVENT] entries logged by
-- src/lib/security-monitor.ts (rate limits, bot-check failures, admin login
-- failures, kill-switch triggers, etc). Console logs on serverless platforms
-- disappear on redeploy/instance recycling and aren't searchable — this table
-- lets these events be queried after the fact. Backend-only (service role).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS security_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity   text NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),
  event_type text NOT NULL,
  route      text,
  ip_key     text,
  user_id    uuid,
  details    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Backend-only; no anon/authenticated access. Admin UI reads via the
-- service-role admin client, same as other admin-only tables.
DROP POLICY IF EXISTS "security_events: service role all" ON security_events;
CREATE POLICY "security_events: service role all"
  ON security_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
