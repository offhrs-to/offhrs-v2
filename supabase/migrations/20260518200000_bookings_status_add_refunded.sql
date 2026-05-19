-- Mobile/partner refunds set bookings.status = 'refunded'.
-- Without this value, UPDATE fails and partner dashboard stays out of sync.

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
      'booked',
      'attended',
      'pending_confirmation',
      'confirmed',
      'pending',
      'cancelled',
      'refunded'
    )
  );
