-- Workshop discovery: optional Canadian postal code and coordinates (synced across devices).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;

COMMENT ON COLUMN public.profiles.postal_code IS 'Canadian postal code (normalized A1A 1A1), optional; used with coordinates for nearby workshop ordering.';
COMMENT ON COLUMN public.profiles.location_lat IS 'Approximate latitude from device GPS or geocoded postal code; optional.';
COMMENT ON COLUMN public.profiles.location_lng IS 'Approximate longitude from device GPS or geocoded postal code; optional.';
