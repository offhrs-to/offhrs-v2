-- Shopify workshop feed: Shopify products + inventory are the source of truth.
-- offhrs mirrors tagged workshops into events for discovery; guests book on Shopify.

CREATE TABLE IF NOT EXISTS public.vendor_shopify_shops (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                 uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  shop_domain               text NOT NULL,
  access_token_encrypted    text NOT NULL,
  scope                     text,
  sync_enabled              boolean NOT NULL DEFAULT true,
  last_synced_at            timestamptz,
  installed_at              timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_domain),
  UNIQUE (vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_shopify_shops_vendor_id
  ON public.vendor_shopify_shops (vendor_id);

-- If an older draft of this migration created inventory_sync_enabled, add sync_enabled.
ALTER TABLE public.vendor_shopify_shops
  ADD COLUMN IF NOT EXISTS sync_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

COMMENT ON TABLE public.vendor_shopify_shops IS
  'Shopify Admin app installs linked to an offhrs vendor. One shop per vendor for MVP. Shopify is source of truth for tagged workshop products.';
COMMENT ON COLUMN public.vendor_shopify_shops.sync_enabled IS
  'When true, tagged shopify products (offhrs_workshop) are pulled into events and inventory webhooks update available_slots.';
COMMENT ON COLUMN public.vendor_shopify_shops.last_synced_at IS
  'Last successful full or manual product sync.';

ALTER TABLE public.vendor_shopify_shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_shopify_shops: service role all" ON public.vendor_shopify_shops;
CREATE POLICY "vendor_shopify_shops: service role all"
  ON public.vendor_shopify_shops FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Events: Shopify-sourced listing metadata
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS listing_source text NOT NULL DEFAULT 'offhrs',
  ADD COLUMN IF NOT EXISTS shopify_product_id text,
  ADD COLUMN IF NOT EXISTS shopify_variant_id text,
  ADD COLUMN IF NOT EXISTS shopify_inventory_item_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_listing_source_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_listing_source_check
      CHECK (listing_source IN ('offhrs', 'shopify'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS events_shopify_variant_id_uidx
  ON public.events (shopify_variant_id)
  WHERE shopify_variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_shopify_inventory_item_id
  ON public.events (shopify_inventory_item_id)
  WHERE shopify_inventory_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_listing_source
  ON public.events (listing_source)
  WHERE listing_source = 'shopify';

COMMENT ON COLUMN public.events.listing_source IS
  'offhrs = native Stripe-bookable workshop; shopify = mirrored from Shopify (Book redirects to external_link).';
COMMENT ON COLUMN public.events.shopify_product_id IS
  'Shopify product id (numeric string) when listing_source = shopify.';
COMMENT ON COLUMN public.events.shopify_variant_id IS
  'Shopify variant id (numeric string). Unique when set; one offhrs event per variant/session.';
COMMENT ON COLUMN public.events.shopify_inventory_item_id IS
  'Shopify inventory_item id for inventory_levels/update webhooks.';

-- Allow shopify in webhook idempotency log
ALTER TABLE public.webhook_events DROP CONSTRAINT IF EXISTS webhook_events_source_check;
ALTER TABLE public.webhook_events
  ADD CONSTRAINT webhook_events_source_check
  CHECK (source IN ('stripe', 'cal', 'shopify'));
