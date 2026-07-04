ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS instagram_handle text;

COMMENT ON COLUMN public.vendor_profiles.instagram_handle IS
  'Instagram username (no @) shown on the vendor profile page in the mobile app.';
