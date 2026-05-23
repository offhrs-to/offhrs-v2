-- Workshop booking tax breakdown (Stripe Tax) + SaaS guest booking fields if missing.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendor_profiles(id),
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS subtotal_cad numeric(10, 2),
  ADD COLUMN IF NOT EXISTS tax_cad numeric(10, 2),
  ADD COLUMN IF NOT EXISTS total_cad numeric(10, 2),
  ADD COLUMN IF NOT EXISTS stripe_tax_calculation_id text;

COMMENT ON COLUMN public.bookings.subtotal_cad IS 'Pre-tax workshop price (CAD).';
COMMENT ON COLUMN public.bookings.tax_cad IS 'Tax collected via Stripe Tax (CAD).';
COMMENT ON COLUMN public.bookings.total_cad IS 'Total charged incl. tax (CAD).';
COMMENT ON COLUMN public.bookings.stripe_tax_calculation_id IS 'Stripe Tax Calculation id (vendor Connect account).';

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_tax_calculation_id
  ON public.bookings(stripe_tax_calculation_id)
  WHERE stripe_tax_calculation_id IS NOT NULL;
