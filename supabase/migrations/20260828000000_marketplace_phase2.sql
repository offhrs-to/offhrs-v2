-- Artist Marketplace Phase 2: shop orders (checkout + buyer order history).

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  vendor_id                       uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE RESTRICT,
  product_id                      uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE RESTRICT,

  status                          text NOT NULL DEFAULT 'paid_awaiting_fulfillment'
    CHECK (status IN (
      'paid_awaiting_fulfillment',
      'label_purchased',
      'shipped',
      'completed',
      'cancelled',
      'refunded',
      'disputed'
    )),

  fulfillment_type                text NOT NULL
    CHECK (fulfillment_type IN ('ship', 'pickup')),

  buyer_name                      text NOT NULL,
  buyer_email                     text NOT NULL,

  ship_to_name                    text,
  ship_to_line1                   text,
  ship_to_line2                   text,
  ship_to_city                    text,
  ship_to_province                text,
  ship_to_postal_code             text,
  ship_to_country                 text NOT NULL DEFAULT 'CA',

  product_title                   text NOT NULL,
  product_price_cad               numeric(10, 2) NOT NULL,
  quantity                        integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),

  item_subtotal_cad               numeric(10, 2) NOT NULL,
  shipping_collected_cad          numeric(10, 2) NOT NULL DEFAULT 0,
  tax_cad                         numeric(10, 2) NOT NULL DEFAULT 0,
  total_cad                       numeric(10, 2) NOT NULL,

  platform_fee_cents              integer NOT NULL DEFAULT 0,
  estimated_stripe_fee_cents      integer NOT NULL DEFAULT 0,
  postage_held                    boolean NOT NULL DEFAULT true,

  shippo_shipment_id              text,
  shippo_rate_id                  text,
  shippo_rate_amount_cad          numeric(10, 2),
  shippo_carrier                  text,
  shippo_service_level            text,
  shippo_estimated_days           integer,

  requires_signature              boolean NOT NULL DEFAULT false,
  requires_insurance              boolean NOT NULL DEFAULT false,
  ship_by_business_days           integer NOT NULL DEFAULT 5,

  stripe_payment_intent_id        text NOT NULL,
  stripe_tax_calculation_id       text,

  paid_at                         timestamptz,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT shop_orders_stripe_pi_unique UNIQUE (stripe_payment_intent_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_orders_user_id ON public.shop_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_vendor_id ON public.shop_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_product_id ON public.shop_orders (product_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON public.shop_orders (status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_paid_at ON public.shop_orders (paid_at DESC);

CREATE OR REPLACE FUNCTION public.update_shop_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_orders_updated_at ON public.shop_orders;
CREATE TRIGGER trg_shop_orders_updated_at
  BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_shop_orders_updated_at();

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_orders: buyer select own" ON public.shop_orders;
CREATE POLICY "shop_orders: buyer select own"
  ON public.shop_orders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shop_orders: vendor select own" ON public.shop_orders;
CREATE POLICY "shop_orders: vendor select own"
  ON public.shop_orders FOR SELECT
  USING (
    vendor_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "shop_orders: service role all" ON public.shop_orders;
CREATE POLICY "shop_orders: service role all"
  ON public.shop_orders FOR ALL
  USING (auth.role() = 'service_role');

GRANT SELECT ON public.shop_orders TO authenticated;

NOTIFY pgrst, 'reload schema';
