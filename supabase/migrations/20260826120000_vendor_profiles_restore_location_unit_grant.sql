-- Restore location_unit on vendor_profiles public SELECT grants.
-- 20260826000000 revoked all SELECT then re-granted without location_unit
-- (added in 20260805180000), which can break authenticated/anon reads.

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
  created_at
) ON public.vendor_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
