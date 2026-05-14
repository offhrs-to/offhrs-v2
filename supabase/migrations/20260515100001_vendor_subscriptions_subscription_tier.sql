-- Tier for SaaS partner billing (mirrors Stripe price; enforced in app for Lite session cap).
ALTER TABLE vendor_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'pro'
  CHECK (subscription_tier IN ('lite', 'pro'));

COMMENT ON COLUMN vendor_subscriptions.subscription_tier IS 'lite: capped workshop creates per Stripe billing period; pro: unlimited.';
