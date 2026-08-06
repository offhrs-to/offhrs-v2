-- Hold Shopify OAuth tokens until the merchant signs into an offhrs partner account.
-- App Store rule 2.3.2: OAuth must start immediately on install (before partner login).

CREATE TABLE IF NOT EXISTS public.shopify_pending_installs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain                 text NOT NULL,
  access_token_encrypted      text NOT NULL,
  refresh_token_encrypted     text,
  access_token_expires_at     timestamptz,
  refresh_token_expires_at    timestamptz,
  scope                       text,
  claim_token                 text NOT NULL,
  expires_at                  timestamptz NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_domain),
  UNIQUE (claim_token)
);

CREATE INDEX IF NOT EXISTS idx_shopify_pending_installs_expires_at
  ON public.shopify_pending_installs (expires_at);

COMMENT ON TABLE public.shopify_pending_installs IS
  'Short-lived Shopify offline tokens awaiting claim by a signed-in offhrs vendor after App Store install.';

ALTER TABLE public.shopify_pending_installs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopify_pending_installs: service role all" ON public.shopify_pending_installs;
CREATE POLICY "shopify_pending_installs: service role all"
  ON public.shopify_pending_installs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
