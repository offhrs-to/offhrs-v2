# Artist Marketplace — tax + Ontario launch (Nov 2026)

CPA direction implemented in product code. This file separates **done in engineering** vs **founder / ops**.

## Policy (CPA)

| Flow | Collect tax? | Who remits? |
|------|----------------|-------------|
| Lite/Pro SaaS | Yes (HST on subscription) | offhrs |
| Workshops | Only if vendor GST/HST-registered | Vendor (Connect) |
| Marketplace | **All sales** | Registered → vendor (Connect); **unregistered → offhrs** |
| 3% platform fee | No separate HST on the fee | — |
| Tax code | `txcd_99999999` (or `STRIPE_SHOP_GOODS_TAX_CODE`) | — |
| Geography (launch) | **Ontario buyers only** | Expand later |

## Done in code (Agent)

1. **Marketplace tax on all sales**
   - `calculateShopOrderTax` always runs Stripe Tax.
   - Registered: calculation + commit on **Connect**; tax stays in transfer (vendor remits).
   - Unregistered: calculation + commit on **platform** Stripe account; tax cents added to `application_fee_amount` so offhrs retains funds to remit.
   - PI metadata `tax_remitter=vendor|platform`; confirm + refund reverse use that flag.
2. **Ontario-only buyers**
   - Rates + checkout reject non-ON ship-to (province + postal FSA K/L/M/N/P).
   - Pickup allowed only if seller pickup address is Ontario.
   - Mobile Shop UI: Ontario-only copy; province fixed to ON at checkout.
3. **Copy / terms / FAQ / Settings** updated for the new remittance split + Ontario launch.
4. Default goods tax code fallback set to `txcd_99999999`.

Key files: `src/lib/stripe-shop-tax.ts`, `src/lib/shop/checkout-pricing.ts`, `src/lib/shop/marketplace-launch-scope.ts`, `src/app/api/shop/rates/route.ts`, `src/app/api/shop/checkout/**`, `offhrs-mobile/app/shop*`.

## You need to do (Founder / ops)

1. **Deploy** this commit to Vercel Production (and ship a mobile build if Shop is app-only).
2. **Stripe Tax — platform account (offhrs)**
   - Dashboard → Tax: confirm **Canada GST/HST** registration is **active** on the **platform** account (not only Connect).
   - First unregistered Marketplace sale will try to activate settings via API; if Stripe requires manual setup, complete head office + CA registration in Dashboard before launch.
3. **Stripe Tax — connected accounts**
   - Registered sellers still need Connect Tax ready (existing flow when they save GST/HST settings).
4. **Env**
   - Optional: set `STRIPE_SHOP_GOODS_TAX_CODE=txcd_99999999` explicitly in Vercel (code default already matches).
5. **Smoke test** — follow **§ Smoke checklist (founder)** below.
6. **Counsel**
   - Seller Addendum / FAQ wording updated to match CPA; ask counsel for a quick OK before scaling GMV.
7. **Accounting**
   - Process to remit GST/HST collected on **platform** for unregistered Marketplace sales each period (CRA return).
8. **Later**
   - Expand ship-to beyond Ontario (remove/relax `marketplace-launch-scope`).
   - PST review by province/item when expanding.

## Smoke checklist (founder)

Assumes D1–D4 (seller setup + published product) already passed. Use **tiny $** items. Prefer production API (`https://offhrs.app`) + smoke/TestFlight build that includes Ontario checkout lock + vendor Shop tab.

### 0 — Preflight (before any money)

1. Vercel **offhrs-v2** Production = Ready with this tax/Ontario code.
2. Stripe (platform) → **Tax**: Canada GST/HST registration **active**.
3. Stripe → Settings → **Emails**: turn off customer receipts if anything still doubles Marketplace emails.
4. Shippo (`hello@offhrs.app`, same account as Vercel `SHIPPO_API_KEY`):
   - Billing → Invoices → clear any unpaid / re-attempt charge.
   - Valid default card; no dispute hold.
   - If dashboard still shows **“Labels cannot be purchased…”**, contact Shippo support to lift the purchase hold **before** F Path 1 (rates can work while label buy is blocked).
5. Two seller modes ready (or toggle one seller between them):
   - **Registered** — Settings → GST/HST on.
   - **Unregistered** — GST/HST off (for platform-remit path).

### E — Browse + checkout UX

| Step | What to do | Pass if |
|------|------------|---------|
| **E1** | Open product in Shop | Listing shows as expected |
| **E2** | Tap **by {vendor}** | Opens vendor profile on **Shop**; **Workshops \| Shop** segment with counts; Shop lists published products |
| **E3a** | Checkout → type street address | Suggestions appear; pick one → city / postal fill; province stays **ON** |
| **E3b** | Non-ON postal (e.g. `V6B 1A1`) on rates or checkout | Error: Ontario only |
| **E3c** | ON postal (e.g. `M5V 2T6`) | Rates return |
| **E3d** | Pay registered-seller item | Tax line at payment; Stripe PI metadata `tax_remitter=vendor`; tax in Connect |
| **E3e** | Pay unregistered-seller item | Tax line at payment; `tax_remitter=platform`; application fee includes tax; Tax txn on **platform** |
| **E4** | One email only | Branded `notifications@offhrs.app` only (no Stripe “Receipt from offhrs” for Marketplace) |
| **E5** | Profile → Orders | Shows **Purchased {date}** |

Place **three** tiny paid orders if you can: (1) ship → F Path 1, (2) ship → F Path 2 cancel, (3) optional pickup → Email seller.

### F — Fulfill / cancel / refund

| Path | What to do | Pass if |
|------|------------|---------|
| **F1** | Seller dashboard → order → **Print label** (one live label) | Label URL; tracking after First Scan; buyer/seller emails as designed. **Blocked until Shippo billing/hold cleared.** |
| **F2** | Buyer Profile → Orders → **Cancel order** (pre–First Scan) | Stripe refund + transfer reverse; inventory qty += order qty; buyer “Cancellation confirmed”; seller “Buyer cancelled order”; if `tax_remitter=platform`, Tax reversal on platform |
| **F3** | (Optional) seller Refund on another pre-scan order, or pickup **Email seller** | Same money/restock rules; contact path works |

### G — Workshops control (regression)

| Step | Pass if |
|------|---------|
| Book workshop with **unregistered** vendor | **No** GST/HST on ticket (Marketplace-all-sales tax must not leak here) |
| Book workshop with **registered** vendor | Tax collected; vendor remits via Connect |

### Money model reminders (don’t re-debug these)

- Buyer shipping was collected into the **platform fee** so offhrs can pay Shippo for the label.
- F1 Shippo errors that say labels can’t be purchased are **Shippo account billing/hold**, not offhrs label code, if rates already worked.
- Marketplace tax is on **all** sales now (not “registered only”). Remitter is the only split.

## Not changed

- Workshop tax model (registered-only, vendor remits).
- SaaS HST on Lite/Pro.
- 3% fee calculation base (item subtotal ex-tax, ex-shipping).
