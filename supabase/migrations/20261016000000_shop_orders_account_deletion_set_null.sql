-- Hybrid consumer account deletion for Marketplace buyers:
-- allow auth.users delete after PII anonymization; keep order financial rows.

ALTER TABLE public.shop_orders
  DROP CONSTRAINT IF EXISTS shop_orders_user_id_fkey;

ALTER TABLE public.shop_orders
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.shop_orders
  ADD CONSTRAINT shop_orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.shop_order_claims
  DROP CONSTRAINT IF EXISTS shop_order_claims_buyer_user_id_fkey;

ALTER TABLE public.shop_order_claims
  ALTER COLUMN buyer_user_id DROP NOT NULL;

ALTER TABLE public.shop_order_claims
  ADD CONSTRAINT shop_order_claims_buyer_user_id_fkey
  FOREIGN KEY (buyer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.shop_orders.user_id IS
  'Buyer auth user; NULL after account deletion anonymization. Financial columns retained for CRA.';

COMMENT ON COLUMN public.shop_order_claims.buyer_user_id IS
  'Buyer auth user; NULL after account deletion anonymization.';
