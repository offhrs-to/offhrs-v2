-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: vendor_cal_tokens
-- Stores AES-256 encrypted Cal.com access/refresh tokens per vendor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_cal_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id)
);

ALTER TABLE vendor_cal_tokens ENABLE ROW LEVEL SECURITY;

-- Tokens are server-only; no client policies needed beyond service role
CREATE POLICY "vendor_cal_tokens: service role all"
  ON vendor_cal_tokens FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_vendor_cal_tokens_vendor_id ON vendor_cal_tokens(vendor_id);
CREATE INDEX idx_vendor_cal_tokens_expires_at ON vendor_cal_tokens(expires_at);
