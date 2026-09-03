-- Artist Marketplace Phase 4: disputes, clawbacks, SNAD claims.

ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS stripe_dispute_id text,
  ADD COLUMN IF NOT EXISTS stripe_dispute_status text,
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS dispute_amount_cad numeric(10, 2),
  ADD COLUMN IF NOT EXISTS dispute_clawback_cad numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_clawback_status text NOT NULL DEFAULT 'none'
    CHECK (dispute_clawback_status IN ('none', 'pending', 'debited', 'failed')),
  ADD COLUMN IF NOT EXISTS clawback_failure_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_orders_stripe_dispute_id
  ON public.shop_orders (stripe_dispute_id)
  WHERE stripe_dispute_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.shop_order_claims (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  buyer_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason            text NOT NULL
                      CHECK (reason IN ('damaged', 'snad', 'other')),
  description       text NOT NULL DEFAULT '',
  photo_urls        text[] NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'seller_responded', 'resolved', 'rejected')),
  seller_response   text,
  admin_notes       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_order_claims_order_id ON public.shop_order_claims (order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_claims_status ON public.shop_order_claims (status);
CREATE INDEX IF NOT EXISTS idx_shop_order_claims_buyer ON public.shop_order_claims (buyer_user_id);

CREATE OR REPLACE FUNCTION public.update_shop_order_claims_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_order_claims_updated_at ON public.shop_order_claims;
CREATE TRIGGER trg_shop_order_claims_updated_at
  BEFORE UPDATE ON public.shop_order_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_shop_order_claims_updated_at();

ALTER TABLE public.shop_order_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_order_claims: buyer select own" ON public.shop_order_claims;
CREATE POLICY "shop_order_claims: buyer select own"
  ON public.shop_order_claims FOR SELECT
  USING (auth.uid() = buyer_user_id);

DROP POLICY IF EXISTS "shop_order_claims: buyer insert own" ON public.shop_order_claims;
CREATE POLICY "shop_order_claims: buyer insert own"
  ON public.shop_order_claims FOR INSERT
  WITH CHECK (auth.uid() = buyer_user_id);

DROP POLICY IF EXISTS "shop_order_claims: service role all" ON public.shop_order_claims;
CREATE POLICY "shop_order_claims: service role all"
  ON public.shop_order_claims FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT, INSERT ON public.shop_order_claims TO authenticated;

COMMENT ON TABLE public.shop_order_claims IS
  'Lean SNAD/damaged claims (14-day). Not a full returns portal.';

NOTIFY pgrst, 'reload schema';
