# Marketplace postage & APV ledger (Phase 0 design)

Design only — tables land with Phase 1–3 migrations. Aligns with
`docs/ARTIST_SHOP_MARKETPLACE_PLAN.md`.

## Goals

1. **Never** treat buyer-paid shipping as seller merchandise GMV or Connect “earnings.”
2. Track **postage collected** vs **label cost** vs **APV adjustments**.
3. Support clawbacks to sellers for dims shortfalls and lost disputes.

## Suggested columns (on `shop_orders` or child `shop_order_money`)

| Field | Meaning |
|-------|---------|
| `item_subtotal_cad` | Goods only |
| `shipping_collected_cad` | Buyer paid for ship (0 if pickup) |
| `tax_cad` | Stripe Tax |
| `platform_fee_cents` | 5% of item subtotal |
| `estimated_stripe_fee_cents` | Recoup amount |
| `shippo_rate_amount_cad` | Quoted rate at checkout |
| `shippo_label_cost_cad` | Actual postage when label bought |
| `shippo_label_fee_cad` | Shippo per-label API fee (platform COGS) |
| `apv_adjustment_cad` | Carrier adjustment (positive = more postage due) |
| `apv_clawback_status` | `none` / `pending` / `debited` / `failed` |
| `postage_held` | Boolean — shipping $ reserved for Shippo, not transferred as seller net |

## Transfer rules (Connect)

- Destination charge total = item + shipping + tax.
- `application_fee` = platform 5% (item) + Stripe fee estimate.
- Seller net should approximate: item − 5% − stripe fee (+/− tax remittance rules).
- Shipping collected → platform Shippo balance for label purchase (ledger, not vendor payout).

## APV

When Shippo/CP reports underpaid postage, record `apv_adjustment_cad` and debit seller Connect (or invoice). Vendor TOS already warrants accurate dims.

## Ops checklist (Phase 0 — human)

- [ ] Create Shippo account; enable Canada Post; store `SHIPPO_API_KEY` in Vercel
- [ ] Confirm Stripe Tax code for tangible goods (`STRIPE_SHOP_GOODS_TAX_CODE`)
- [ ] CRA / counsel: marketplace facilitator registration & remittance process
- [ ] Counsel review of live Terms + Marketplace Seller Addendum
