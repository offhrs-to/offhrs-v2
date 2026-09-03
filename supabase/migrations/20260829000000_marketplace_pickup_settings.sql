-- Marketplace: vendor pickup location + hours for local pickup checkout.

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS shop_pickup_line1 text,
  ADD COLUMN IF NOT EXISTS shop_pickup_line2 text,
  ADD COLUMN IF NOT EXISTS shop_pickup_city text,
  ADD COLUMN IF NOT EXISTS shop_pickup_province text,
  ADD COLUMN IF NOT EXISTS shop_pickup_postal_code text,
  ADD COLUMN IF NOT EXISTS shop_pickup_hours text;

COMMENT ON COLUMN public.vendor_profiles.shop_pickup_hours IS
  'Human-readable pickup hours shown to buyers (e.g. Sat 10am–2pm).';

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
  location_unit,
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
  shop_pickup_line1,
  shop_pickup_line2,
  shop_pickup_city,
  shop_pickup_province,
  shop_pickup_postal_code,
  shop_pickup_hours,
  created_at
) ON public.vendor_profiles TO anon, authenticated;
