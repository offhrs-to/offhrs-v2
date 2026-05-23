-- ─────────────────────────────────────────────────────────────────────────────
-- Remove Cal.com integration schema (first-party booking only).
-- Safe on fresh or existing DB: IF EXISTS guards.
-- ─────────────────────────────────────────────────────────────────────────────

-- Encrypted tokens table (depends on vendor_profiles)
DROP TABLE IF EXISTS public.vendor_cal_tokens;

-- Bookings: Cal booking reference + redundant index from original migration
DROP INDEX IF EXISTS public.idx_bookings_cal_booking_uid;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS cal_booking_uid;

-- Events: Cal event type mirror
ALTER TABLE public.events DROP COLUMN IF EXISTS cal_event_type_id;

-- Vendor profiles: managed user id + onboarding flag
ALTER TABLE public.vendor_profiles DROP COLUMN IF EXISTS cal_user_id;
ALTER TABLE public.vendor_profiles DROP COLUMN IF EXISTS cal_connected;
