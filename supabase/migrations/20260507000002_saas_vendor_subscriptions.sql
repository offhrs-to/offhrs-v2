-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: vendor_subscriptions
-- Mirrors Stripe subscription state for each vendor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id               uuid NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  stripe_subscription_id  text UNIQUE NOT NULL,
  stripe_price_id         text NOT NULL,
  status                  text NOT NULL
                          CHECK (status IN ('trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired')),
  trial_start             timestamptz,
  trial_end               timestamptz,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_vendor_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_subscriptions_updated_at
  BEFORE UPDATE ON vendor_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_vendor_subscriptions_updated_at();

ALTER TABLE vendor_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_subscriptions: owner read"
  ON vendor_subscriptions FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "vendor_subscriptions: service role all"
  ON vendor_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_vendor_subscriptions_vendor_id ON vendor_subscriptions(vendor_id);
CREATE INDEX idx_vendor_subscriptions_stripe_id ON vendor_subscriptions(stripe_subscription_id);
