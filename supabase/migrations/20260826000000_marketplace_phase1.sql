-- Artist Marketplace Phase 1: vendor shop flags + shop_products + image storage.

-- ── vendor_profiles marketplace columns ─────────────────────────────────────
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS marketplace_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketplace_plan text
    CHECK (marketplace_plan IS NULL OR marketplace_plan IN ('free', 'included')),
  ADD COLUMN IF NOT EXISTS shop_status text NOT NULL DEFAULT 'off'
    CHECK (shop_status IN ('off', 'draft', 'live', 'paused')),
  ADD COLUMN IF NOT EXISTS marketplace_qa_status text NOT NULL DEFAULT 'not_started'
    CHECK (marketplace_qa_status IN ('not_started', 'pending_review', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS marketplace_qa_notes text,
  ADD COLUMN IF NOT EXISTS ship_from_name text,
  ADD COLUMN IF NOT EXISTS ship_from_line1 text,
  ADD COLUMN IF NOT EXISTS ship_from_line2 text,
  ADD COLUMN IF NOT EXISTS ship_from_city text,
  ADD COLUMN IF NOT EXISTS ship_from_province text,
  ADD COLUMN IF NOT EXISTS ship_from_postal_code text,
  ADD COLUMN IF NOT EXISTS ship_from_country text NOT NULL DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS ship_from_phone text,
  ADD COLUMN IF NOT EXISTS shipping_handling_fee_cad numeric(10, 2) NOT NULL DEFAULT 0
    CHECK (shipping_handling_fee_cad >= 0 AND shipping_handling_fee_cad <= 100),
  ADD COLUMN IF NOT EXISTS shop_pickup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_return_policy text,
  ADD COLUMN IF NOT EXISTS canada_ship_attested_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketplace_enrolled_at timestamptz;

COMMENT ON COLUMN public.vendor_profiles.marketplace_enabled IS
  'True when vendor may use Artist Marketplace (free plan enrolled, or Lite/Pro included).';
COMMENT ON COLUMN public.vendor_profiles.marketplace_plan IS
  'free = Marketplace-only $0 plan; included = Lite/Pro Marketplace entitlement.';
COMMENT ON COLUMN public.vendor_profiles.marketplace_qa_status IS
  'Manual seller QA before first live listing publish.';
COMMENT ON COLUMN public.vendor_profiles.canada_ship_attested_at IS
  'Seller attested Canada-only ship-from / fulfillment for Marketplace.';

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_marketplace_enabled
  ON public.vendor_profiles (marketplace_enabled)
  WHERE marketplace_enabled = true;

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_marketplace_qa
  ON public.vendor_profiles (marketplace_qa_status)
  WHERE marketplace_enabled = true;

-- Public SELECT grants: add non-sensitive shop discovery columns only.
REVOKE SELECT ON public.vendor_profiles FROM anon, authenticated;
GRANT SELECT (
  id,
  user_id,
  business_name,
  slug,
  bio,
  website_url,
  instagram_handle,
  category,
  location_address,
  location_lat,
  location_lng,
  default_workshop_image_url,
  refund_window_hours,
  strict_no_refund,
  status,
  first_session_created,
  marketplace_enabled,
  shop_status,
  shop_pickup_enabled,
  created_at
) ON public.vendor_profiles TO anon, authenticated;

-- ── shop_products ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_products (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                   uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  title                       text NOT NULL,
  description                 text,
  category                    text NOT NULL DEFAULT 'Other',
  price_cad                   numeric(10, 2) NOT NULL
                              CHECK (price_cad >= 0 AND price_cad <= 100000),
  quantity                    integer NOT NULL DEFAULT 1
                              CHECK (quantity >= 0 AND quantity <= 100000),
  weight_g                    integer NOT NULL
                              CHECK (weight_g >= 1 AND weight_g <= 30000),
  length_cm                   numeric(8, 2) NOT NULL
                              CHECK (length_cm >= 0.1 AND length_cm <= 200),
  width_cm                    numeric(8, 2) NOT NULL
                              CHECK (width_cm >= 0.1 AND width_cm <= 200),
  height_cm                   numeric(8, 2) NOT NULL
                              CHECK (height_cm >= 0.1 AND height_cm <= 200),
  fragile                     boolean NOT NULL DEFAULT false,
  pickup_available            boolean NOT NULL DEFAULT false,
  made_to_order               boolean NOT NULL DEFAULT false,
  ship_by_business_days       integer NOT NULL DEFAULT 5
                              CHECK (ship_by_business_days >= 1 AND ship_by_business_days <= 30),
  buyer_remorse_returns       boolean NOT NULL DEFAULT false,
  status                      text NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'published', 'archived')),
  image_urls                  text[] NOT NULL DEFAULT '{}',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_products_vendor_id ON public.shop_products (vendor_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_status ON public.shop_products (status);
CREATE INDEX IF NOT EXISTS idx_shop_products_vendor_status ON public.shop_products (vendor_id, status);

CREATE OR REPLACE FUNCTION public.update_shop_products_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_products_updated_at ON public.shop_products;
CREATE TRIGGER trg_shop_products_updated_at
  BEFORE UPDATE ON public.shop_products
  FOR EACH ROW EXECUTE FUNCTION public.update_shop_products_updated_at();

ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_products: owner select" ON public.shop_products;
CREATE POLICY "shop_products: owner select"
  ON public.shop_products FOR SELECT
  USING (
    vendor_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "shop_products: public published read" ON public.shop_products;
CREATE POLICY "shop_products: public published read"
  ON public.shop_products FOR SELECT
  USING (
    status = 'published'
    AND vendor_id IN (
      SELECT id FROM public.vendor_profiles
      WHERE marketplace_enabled = true
        AND shop_status = 'live'
        AND status IN ('trialing', 'active', 'past_due')
    )
  );

DROP POLICY IF EXISTS "shop_products: service role all" ON public.shop_products;
CREATE POLICY "shop_products: service role all"
  ON public.shop_products FOR ALL
  USING (auth.role() = 'service_role');

-- Writes go through service-role API routes; no authenticated INSERT/UPDATE/DELETE policies.

GRANT SELECT ON public.shop_products TO anon, authenticated;

-- ── Storage: shop product images ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('shop-product-images', 'shop-product-images', true, 2621440)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "shop_product_images_public_read" ON storage.objects;
CREATE POLICY "shop_product_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'shop-product-images');

NOTIFY pgrst, 'reload schema';
