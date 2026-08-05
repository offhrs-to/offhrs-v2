-- Optional unit / suite for venue addresses.
-- Kept separate from location / location_address so geocoding uses the street pin only.

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS location_unit text;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS location_unit text;

COMMENT ON COLUMN public.vendor_profiles.location_unit IS
  'Optional unit/suite for the studio address. Not sent to geocoders; display-only.';
COMMENT ON COLUMN public.events.location_unit IS
  'Optional unit/suite for the workshop venue. Not sent to geocoders; display-only.';

-- Match column-level SELECT grants from 20260728200000_vendor_profiles_column_grants.sql
GRANT SELECT (location_unit) ON public.vendor_profiles TO anon, authenticated;
