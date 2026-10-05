-- Allow Full License Stripe tier alongside lite/pro.
ALTER TABLE public.vendor_subscriptions
  DROP CONSTRAINT IF EXISTS vendor_subscriptions_subscription_tier_check;

ALTER TABLE public.vendor_subscriptions
  ADD CONSTRAINT vendor_subscriptions_subscription_tier_check
  CHECK (subscription_tier IS NULL OR subscription_tier IN ('lite', 'pro', 'full'));
