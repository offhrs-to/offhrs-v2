-- Shopify Sync plan ($39 CAD/mo via Billing API). Sync runs only while billing_status = active
-- (or an allowlisted/comped shop in app config).

ALTER TABLE public.vendor_shopify_shops
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS app_subscription_gid text,
  ADD COLUMN IF NOT EXISTS billing_confirmed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vendor_shopify_shops_billing_status_check'
  ) THEN
    ALTER TABLE public.vendor_shopify_shops
      ADD CONSTRAINT vendor_shopify_shops_billing_status_check
      CHECK (billing_status IN ('none', 'pending', 'active', 'cancelled', 'declined', 'expired', 'frozen'));
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_shopify_shops.billing_status IS
  'Shopify App subscription for Sync plan: none|pending|active|cancelled|declined|expired|frozen.';
COMMENT ON COLUMN public.vendor_shopify_shops.app_subscription_gid IS
  'GraphQL GID of the app subscription (gid://shopify/AppSubscription/…).';
COMMENT ON COLUMN public.vendor_shopify_shops.billing_confirmed_at IS
  'When billing_status last became active.';
