# Partner pricing — 5-tier ops checklist

Code already supports these plans. Complete the steps below in Stripe, Shopify, Supabase, and Vercel so production matches.

| # | Plan | Price (CAD/mo) | Billing | Entitlements |
|---|------|----------------|---------|--------------|
| 1 | **Marketplace Only** | $0 | None (fee on sales) | Marketplace only |
| 2 | **Lite** | $29 | Stripe | Workshops (max 4); **no** Marketplace; **no** Sync |
| 3 | **Shopify Sync** | $29 | Shopify App Pricing | Sync only |
| 4 | **Pro** | $39 | Stripe | Unlimited workshops + Marketplace; **no** Sync |
| 5 | **Full License** | $59 | Stripe | Pro + Marketplace + Sync (comps Sync; no separate Sync charge) |

Trial: **30 days** on Lite, Pro, Full License, and Shopify Sync.

---

## A. Supabase (database)

1. Open [Supabase](https://supabase.com) → your **production** project → **SQL Editor**.
2. Run the migration contents from:

   `supabase/migrations/20260921000000_partner_full_license_tier.sql`

   Or from the CLI (linked project):

   ```bash
   npx supabase db push
   ```

3. Confirm `vendor_subscriptions.subscription_tier` allows `'lite' | 'pro' | 'full'`.

---

## B. Stripe (Lite / Pro / Full)

Use the **same mode** as production (`sk_live_…` on Production Vercel). Do **not** mix test Price IDs with a live secret key.

### B1. Create / update Products & Prices

1. Stripe Dashboard → **Products** (Live mode toggle ON for production).
2. **Lite** — keep or create monthly recurring **$29 CAD**. Copy Price ID → `STRIPE_LITE_PRICE_ID`.
3. **Pro** — create a **new** monthly Price **$39 CAD** (do not edit the old $49 price in place if existing subscribers use it). Copy new Price ID → `STRIPE_PRO_PRICE_ID`.
4. **Full License** — create Product “offhrs Full License”, monthly recurring **$59 CAD**. Copy Price ID → `STRIPE_FULL_PRICE_ID`.
5. Ensure each Price is **recurring**, **month**, currency **CAD**, and tax behavior matches your other partner prices (usually `exclusive` with Stripe Tax).

### B2. Existing Pro subscribers on $49

- New checkouts will use the new $39 Price once env is updated.
- Existing $49 subscriptions keep their current Price until you migrate them in Stripe (Customer portal / Subscription update). Decide whether to move them to $39 manually or leave grandfathered.

### B3. Checkout metadata

Checkout already sends `plan: lite | pro | full` in session/subscription metadata. Webhooks map Price IDs via env. After changing Price IDs, smoke-test one trial checkout per plan.

---

## C. Vercel env (Production)

1. Vercel → **offhrs** (or your production project) → **Settings → Environment Variables** → **Production**.
2. Set / update:

   | Variable | Value |
   |----------|--------|
   | `STRIPE_LITE_PRICE_ID` | `price_…` ($29 Lite) |
   | `STRIPE_PRO_PRICE_ID` | `price_…` ($39 Pro) |
   | `STRIPE_FULL_PRICE_ID` | `price_…` ($59 Full) |

3. Keep `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and publishable keys aligned with Live mode.
4. **Redeploy** Production after saving env (Deployments → Redeploy latest, or push a commit).

Preview/local: mirror the same variable names with **test** Price IDs if you use test keys.

---

## D. Shopify Sync ($29) — App Pricing

Standalone Sync is unchanged at **$29 CAD/month**, handle `offhrs-sync`.

1. Partners Dashboard → your app → **Distribution** / **Pricing** (or App Store listing pricing).
2. Confirm public plan:
   - Handle: **`offhrs-sync`** (must match `SHOPIFY_SYNC_PLAN_HANDLE` in code)
   - Amount: **$29 CAD** / month
   - Trial: **30 days**
3. Full License partners do **not** need an active Shopify Sync charge; entitlement is granted from Stripe `subscription_tier = full`.
4. After any pricing change in Partners, reinstall or re-subscribe on a **dev store** and confirm channel home → Sync works.

No Shopify price change is required unless you previously set Sync to something other than $29.

---

## E. Marketplace Only (free)

No Stripe product. Flow:

1. Signup with marketplace intent (`/partners/signup?intent=marketplace`) or **Enable Marketplace** in the dashboard.
2. Sets `marketplace_enabled` + `marketplace_plan = free` (or `included` when they also have Pro/Full).
3. Fee: **5%** platform + Stripe on goods (unchanged).

Ops: ensure Marketplace QA / Connect onboarding still required before going live on Shop.

---

## F. Smoke tests (after deploy + migration)

1. **Marketplace Only** — signup → dashboard shows Marketplace; cannot create workshops.
2. **Lite** — checkout `?plan=lite` → trial → create ≤4 workshops; Marketplace gated off.
3. **Pro** — checkout `?plan=pro` → Marketplace available; Sync still requires Shopify charge **or** Full.
4. **Full** — checkout `?plan=full` → Marketplace + Sync allowed without Shopify Sync subscription.
5. **Shopify Sync only** — install channel → subscribe in Shopify → sync works; no Lite workshops.
6. Admin SaaS page — MRR includes Full at $59.

---

## G. Marketing / legal (already updated in repo)

- `/partners` pricing grid (5 cards)
- Partner FAQ (in-app + docs)
- Terms of use / service terms ($39 Pro, $59 Full, free Marketplace)
- `.env.example` documents `STRIPE_FULL_PRICE_ID`

---

## H. Order of operations (recommended)

1. Create Stripe $39 Pro + $59 Full prices (Live).
2. Apply Supabase migration.
3. Set Vercel Production env → redeploy.
4. Smoke-test checkouts on a real vendor (or your own) account.
5. Optionally migrate existing $49 Pro subscribers.
6. Confirm Shopify Sync plan still $29 / `offhrs-sync`.

When code is ready to ship, ask for a commit/push of the pricing branch if it is not already on Production.
