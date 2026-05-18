-- SaaS partner workshop bookings use status 'confirmed', guest name/email, optional user_id.
-- Without this, POST /api/book/confirm fails CHECK (status) after successful Stripe payment.

-- Allow SaaS booking statuses (keep legacy values for old rows).
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
      'booked',
      'attended',
      'pending_confirmation',
      'confirmed',
      'pending',
      'cancelled'
    )
  );

-- Mobile/web SaaS bookings always set user_id when logged in; web guest checkout may omit.
ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;

-- Legacy UNIQUE(user_id, event_id) blocks a second paid booking for the same workshop.
-- Idempotency is enforced via stripe_payment_intent_id on confirm.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_user_id_event_id_key;

-- Guest + vendor fields (idempotent with 20260518140000_bookings_tax_columns.sql).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendor_profiles(id),
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS subtotal_cad numeric(10, 2),
  ADD COLUMN IF NOT EXISTS tax_cad numeric(10, 2),
  ADD COLUMN IF NOT EXISTS total_cad numeric(10, 2),
  ADD COLUMN IF NOT EXISTS stripe_tax_calculation_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent_unique
  ON public.bookings(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
