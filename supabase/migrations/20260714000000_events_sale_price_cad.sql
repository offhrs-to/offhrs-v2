-- Optional sale ticket price (CAD). When set and lower than price_cad, customers pay this amount.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS sale_price_cad numeric(10, 2);

COMMENT ON COLUMN public.events.sale_price_cad IS
  'Optional reduced ticket price in CAD. When set and less than price_cad, checkout and payouts use this amount.';
