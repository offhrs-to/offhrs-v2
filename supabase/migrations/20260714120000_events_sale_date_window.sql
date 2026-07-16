-- Optional sale window (America/Toronto calendar dates, inclusive).
-- When set with sale_price_cad, the sale only applies on days within [sale_starts_on, sale_ends_on].
-- Null start = already started; null end = no end date (legacy / open-ended).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS sale_starts_on date,
  ADD COLUMN IF NOT EXISTS sale_ends_on date;

COMMENT ON COLUMN public.events.sale_starts_on IS
  'Inclusive start date (YYYY-MM-DD, America/Toronto) for sale_price_cad. NULL = sale already active.';

COMMENT ON COLUMN public.events.sale_ends_on IS
  'Inclusive end date (YYYY-MM-DD, America/Toronto) for sale_price_cad. NULL = no end date.';
