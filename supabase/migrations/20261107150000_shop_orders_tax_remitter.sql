-- Who remits Marketplace GST/HST collected on the order (CPA Nov 2026).
-- platform = unregistered seller → offhrs remits; vendor = Connect / seller remits.

ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS tax_remitter text;

ALTER TABLE public.shop_orders
  DROP CONSTRAINT IF EXISTS shop_orders_tax_remitter_check;

ALTER TABLE public.shop_orders
  ADD CONSTRAINT shop_orders_tax_remitter_check
  CHECK (tax_remitter IS NULL OR tax_remitter IN ('vendor', 'platform'));

COMMENT ON COLUMN public.shop_orders.tax_remitter IS
  'Marketplace GST/HST remitter after collection: vendor (Connect) or platform (offhrs). Null on older orders until backfilled.';

CREATE INDEX IF NOT EXISTS idx_shop_orders_tax_remitter_paid_at
  ON public.shop_orders (tax_remitter, paid_at DESC)
  WHERE tax_remitter IS NOT NULL;
