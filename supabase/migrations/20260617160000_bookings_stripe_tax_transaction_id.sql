-- Stripe Tax Transaction id (committed on Connect account) for refund reversals.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_tax_transaction_id text;

COMMENT ON COLUMN public.bookings.stripe_tax_transaction_id IS
  'Stripe Tax Transaction id (tax_...) on vendor Connect account after commit; used for refund reversals.';
