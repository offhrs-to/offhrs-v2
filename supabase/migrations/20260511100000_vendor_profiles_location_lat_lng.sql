-- Venue coordinates from partner onboarding (Google Places, etc.)
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS location_lat  double precision,
  ADD COLUMN IF NOT EXISTS location_lng  double precision;

COMMENT ON COLUMN public.vendor_profiles.location_lat IS 'Latitude from venue geocode (e.g. Google Places).';
COMMENT ON COLUMN public.vendor_profiles.location_lng IS 'Longitude from venue geocode (e.g. Google Places).';
