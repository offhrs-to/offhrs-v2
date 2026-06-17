-- Partner attestation for GST/HST on workshop ticket sales (CRA small-supplier vs registered).

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS gst_hst_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gst_hst_registration_number text;

COMMENT ON COLUMN public.vendor_profiles.gst_hst_registered IS
  'When true, offhrs may calculate/collect GST/HST on workshop tickets via Stripe Tax on the Connect account.';
COMMENT ON COLUMN public.vendor_profiles.gst_hst_registration_number IS
  'CRA GST/HST program account number (9 digits + RT + 4 digits), required when gst_hst_registered is true.';
