-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: vendor_payouts
-- Synced from Stripe payout webhook events for vendor payout history.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_payouts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         uuid NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  stripe_payout_id  text UNIQUE NOT NULL,
  amount_cad        numeric(10, 2) NOT NULL,
  arrival_date      date NOT NULL,
  status            text NOT NULL
                    CHECK (status IN ('pending','paid','failed','canceled')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vendor_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_payouts: owner read" ON vendor_payouts;
CREATE POLICY "vendor_payouts: owner read"
  ON vendor_payouts FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vendor_payouts: service role all" ON vendor_payouts;
CREATE POLICY "vendor_payouts: service role all"
  ON vendor_payouts FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor_id ON vendor_payouts(vendor_id);
