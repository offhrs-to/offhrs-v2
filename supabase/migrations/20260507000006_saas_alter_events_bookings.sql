-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: extend events and bookings for SaaS booking engine
-- Additive columns only — existing rows/queries are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── events ───────────────────────────────────────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS vendor_profile_id  uuid REFERENCES vendor_profiles(id),
  ADD COLUMN IF NOT EXISTS cal_event_type_id  text,
  ADD COLUMN IF NOT EXISTS max_attendees      integer,
  ADD COLUMN IF NOT EXISTS available_slots    integer,
  ADD COLUMN IF NOT EXISTS price_cad          numeric(10, 2),
  ADD COLUMN IF NOT EXISTS duration_minutes   integer,
  ADD COLUMN IF NOT EXISTS booking_status     text NOT NULL DEFAULT 'published'
                           CHECK (booking_status IN ('published','draft','fully_booked','archived'));

CREATE INDEX IF NOT EXISTS idx_events_vendor_profile_id ON events(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_events_booking_status ON events(booking_status);

-- ── bookings ─────────────────────────────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cal_booking_uid          text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_id         text,
  ADD COLUMN IF NOT EXISTS amount_cad               numeric(10, 2),
  ADD COLUMN IF NOT EXISTS stripe_fee_cad           numeric(10, 2),
  ADD COLUMN IF NOT EXISTS net_vendor_cad           numeric(10, 2),
  ADD COLUMN IF NOT EXISTS refunded_at              timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason      text,
  ADD COLUMN IF NOT EXISTS ics_sent                 boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bookings_cal_booking_uid ON bookings(cal_booking_uid);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent ON bookings(stripe_payment_intent_id);
