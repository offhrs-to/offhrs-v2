-- Vendor-level strict cancellation policy: paid bookings are non-refundable after purchase.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS strict_no_refund boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendor_profiles.strict_no_refund IS
  'When true, paid workshop bookings for this vendor are non-refundable after purchase.';
