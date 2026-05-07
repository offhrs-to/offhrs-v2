-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: webhook_events
-- Idempotency log for Stripe and Cal.com webhook deliveries.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL CHECK (source IN ('stripe', 'cal')),
  event_id     text UNIQUE NOT NULL,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL,
  processed_at timestamptz,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Webhook events are backend-only; no client access
CREATE POLICY "webhook_events: service role all"
  ON webhook_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_source_type ON webhook_events(source, event_type);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC);
