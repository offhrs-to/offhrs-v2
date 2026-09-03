-- Artist Marketplace Phase 3: labels, tracking, SLA, APV ledger columns.

ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS shippo_transaction_id text,
  ADD COLUMN IF NOT EXISTS shippo_label_url text,
  ADD COLUMN IF NOT EXISTS shippo_label_cost_cad numeric(10, 2),
  ADD COLUMN IF NOT EXISTS shippo_label_fee_cad numeric(10, 2),
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS tracking_status text,
  ADD COLUMN IF NOT EXISTS first_scan_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS label_purchased_at timestamptz,
  ADD COLUMN IF NOT EXISTS dropoff_receipt_at timestamptz,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS stripe_tax_transaction_id text,
  ADD COLUMN IF NOT EXISTS seller_notes text,
  ADD COLUMN IF NOT EXISTS buyer_confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_shipped_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS day3_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS apv_adjustment_cad numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS apv_clawback_status text NOT NULL DEFAULT 'none'
    CHECK (apv_clawback_status IN ('none', 'pending', 'debited', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_orders_shippo_transaction_id
  ON public.shop_orders (shippo_transaction_id)
  WHERE shippo_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shop_orders_tracking_number
  ON public.shop_orders (tracking_number)
  WHERE tracking_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shop_orders_sla
  ON public.shop_orders (status, paid_at)
  WHERE fulfillment_type = 'ship';

COMMENT ON COLUMN public.shop_orders.postage_held IS
  'Buyer-paid shipping is reserved for platform Shippo labels, not seller GMV.';
COMMENT ON COLUMN public.shop_orders.first_scan_at IS
  'Carrier First Scan (in-transit). Pre-scan cancel/refund allowed; post-scan blocked.';
COMMENT ON COLUMN public.shop_orders.apv_adjustment_cad IS
  'Carrier/Shippo extra postage due (positive = more than quoted).';

NOTIFY pgrst, 'reload schema';
