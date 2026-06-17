-- Tracks when a partner explicitly saved Workshop sales tax in Settings (registered or not).

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS gst_hst_settings_confirmed_at timestamptz;

COMMENT ON COLUMN public.vendor_profiles.gst_hst_settings_confirmed_at IS
  'Set when the partner saves Workshop sales tax in Settings; null until first save.';

-- Partners who already saved a registration number are treated as confirmed.
UPDATE public.vendor_profiles
SET gst_hst_settings_confirmed_at = NOW()
WHERE gst_hst_settings_confirmed_at IS NULL
  AND gst_hst_registration_number IS NOT NULL;
