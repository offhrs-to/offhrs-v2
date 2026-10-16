-- Ontario internet-sale disclosures: record Terms version at purchase time.

ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS terms_version text;

COMMENT ON COLUMN public.shop_orders.terms_version IS
  'POLICY_LAST_UPDATED (or equivalent) at the time the buyer paid — used for consumer disclosure / audit.';
