-- Recorded vendor clickwrap assent (signup, re-accept, Marketplace shipping, Shopify Connect).

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id         uuid REFERENCES public.vendor_profiles(id) ON DELETE SET NULL,
  document_key      text NOT NULL,
  document_version  text NOT NULL,
  context           text NOT NULL
                      CHECK (context IN (
                        'partner_signup',
                        'partner_reaccept',
                        'marketplace_shipping',
                        'shopify_connect'
                      )),
  ip_address        text,
  user_agent        text,
  accepted_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_doc_version
  ON public.legal_acceptances (user_id, document_key, document_version);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_vendor_id
  ON public.legal_acceptances (vendor_id)
  WHERE vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_accepted_at
  ON public.legal_acceptances (accepted_at DESC);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_acceptances: service role all" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances: service role all"
  ON public.legal_acceptances FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.legal_acceptances IS
  'Clickwrap assent log for partner Terms (document version = POLICY_LAST_UPDATED at accept time).';
