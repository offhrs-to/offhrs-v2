# Marketplace postage & APV ledger (Phase 0 design + Phase 4 economics)

Aligns with `docs/ARTIST_SHOP_MARKETPLACE_PLAN.md`.

## Goals

1. **Never** treat buyer-paid shipping as seller merchandise GMV or Connect “earnings.”
2. Track **postage collected** vs **label cost** vs **APV adjustments**.
3. Support clawbacks to sellers for dims shortfalls and lost disputes.
4. Hold **facilitator tax** on the platform (Stripe Tax remittance).

## Columns (on `shop_orders`)

| Field | Meaning |
|-------|---------|
| `item_subtotal_cad` | Goods only |
| `shipping_collected_cad` | Buyer paid for ship incl. handling (0 if pickup) |
| `shippo_rate_amount_cad` | Base Canada Post quote at checkout (ex-handling) |
| `tax_cad` | Stripe Tax |
| `platform_fee_cents` | 5% of item subtotal |
| `estimated_stripe_fee_cents` | Recoup amount |
| `shippo_label_cost_cad` | Actual postage when label bought |
| `shippo_label_fee_cad` | Shippo per-label API fee (platform COGS) |
| `apv_adjustment_cad` | Carrier adjustment (positive = more postage due) |
| `apv_clawback_status` | `none` / `pending` / `debited` / `failed` |
| `postage_held` | Boolean — shipping $ reserved for Shippo, not transferred as seller net |
| `dispute_*` / `dispute_clawback_*` | Phase 4 Stripe dispute + clawback ledger |

## Transfer rules (Connect) — Phase 4

Destination charge total = item + shipping + tax.

```
application_fee =
  platform 5% (item)
  + Stripe fee estimate   (omit when connected account pays Stripe fees)
  + shipping_collected    (postage + handling)
  + tax
```

Seller net ≈ **item − 5%** (− Stripe fee when platform pays processing).

Shipping collected funds platform Shippo label purchases. Tax stays with the platform for facilitator remittance.

## APV

When Shippo/CP reports underpaid postage, record `apv_adjustment_cad` and debit seller Connect (or invoice). Vendor TOS already warrants accurate dims.

## Ops checklist

- [ ] Create Shippo account; enable Canada Post; store `SHIPPO_API_KEY` in Vercel
- [ ] Confirm Stripe Tax code for tangible goods (`STRIPE_SHOP_GOODS_TAX_CODE`)
- [ ] CRA / counsel: marketplace facilitator registration & remittance process
- [ ] Counsel review of live Terms + Marketplace Seller Addendum
- [ ] Enable Stripe webhook events: `charge.dispute.created|updated|closed`
- [ ] New checkout smoke test: seller Connect balance excludes shipping + tax
