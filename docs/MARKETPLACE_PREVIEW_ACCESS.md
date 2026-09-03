# Preview / Deployment Protection (Marketplace testing)

Preview URLs like `*-offhrs-projects.vercel.app` may redirect to **Vercel Login (SSO)** when Deployment Protection is on. That is not an app bug — anonymous requests never reach Next.js.

## Fix “Application error: a client-side exception has occurred”

This almost always means the **Preview build** did not have Supabase public env vars. The client bundle needs them at **build time**.

1. Vercel → **offhrs-v2** → **Settings** → **Environment Variables**
2. For each variable below, click it → ensure **Preview** is checked (not only Production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server routes / Partners dashboard)
   - `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_API_SECRET` (admin QA approve)
3. **Deployments** → latest preview → **⋯** → **Redeploy** (required after env changes)
4. Reload the preview URL — you should see the site (yellow banner disappears once env is set)

Copy values from Production if Preview rows are empty.

## Open preview for partner testing

1. Vercel → **offhrs-v2** → **Settings** → **Deployment Protection**
2. Set protection so **Preview** is open (e.g. “Only Production” protected, or disable Preview protection), **or**
3. From the deployment page click **Visit** while logged into the Vercel team (SSO unlocks the preview), then go to `/partners/login`
4. Optional: create a **Shareable Link** / protection bypass for QA without SSO

## After preview loads

1. `/partners/login` with your Lite/Pro test account  
2. Confirm **Marketplace** in the sidebar  
3. Complete Phase 1 shipping + product + QA steps (see plan checklist)

## Phase 2 (checkout + Shop tab)

1. Apply migration `20260828000000_marketplace_phase2.sql` in Supabase (creates `shop_orders`)
2. Preview env (in addition to Phase 1):
   - `SHIPPO_API_KEY` — live Canada Post rates (test key OK on preview)
   - `GOOGLE_MAPS_API_KEY` — Places autocomplete for shop checkout (server key; Places API enabled). Falls back to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` if set.
   - `STRIPE_SECRET_KEY` / Stripe publishable key in mobile build
   - `STRIPE_SHOP_GOODS_TAX_CODE` — tangible goods tax code (optional; has default)
3. Redeploy preview after env changes
4. **Mobile app** (EAS build or dev client with `EXPO_PUBLIC_BOOK_API_BASE` = preview URL):
   - New **Shop** tab between Bookings and Profile
   - Product detail → postal code → rates → checkout → PaymentSheet
   - **Profile → Orders** shows shop purchases (workshops stay under Bookings)
5. Seller still fulfills in Phase 3 (Print label) — orders land as `paid_awaiting_fulfillment`

## Phase 3 (labels + orders)

1. Apply migration `20260830000000_marketplace_phase3.sql` in Supabase (label/tracking/SLA/APV columns)
2. Preview env (in addition to Phase 2):
   - `SHIPPO_API_KEY` — required to print labels
   - `SHIPPO_WEBHOOK_SECRET` — optional; if set, Shippo must send `Authorization: Bearer <secret>` or `?token=`
   - `RESEND_API_KEY` — buyer/seller order emails
   - `CRON_SECRET` — Day-3 ship-by reminder cron (`/api/cron/shop-sla-reminders`)
3. In Shippo, point tracking webhooks at `https://<host>/api/webhooks/shippo`
4. Partner dashboard → **Marketplace → Orders**: Print label, confirm drop-off, mark picked up, refund pre-scan
5. Admin → **Shop orders**: retry label / refund
6. Mobile **Profile → Orders** shows status + tracking after First Scan

## Phase 4 (harden / launch)

1. Apply migration `20260831000000_marketplace_phase4.sql` (dispute columns + `shop_order_claims`)
2. Stripe Dashboard → webhook endpoint → enable `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`
3. Smoke-test **new** checkout: seller Connect payout should **exclude** shipping + tax (held in `application_fee`)
4. Admin → **Shop orders**: filters for disputed / APV clawback; resolve SNAD claims
5. Optional: `GET /api/cron/shop-clawbacks` with `Authorization: Bearer $CRON_SECRET` to retry pending clawbacks
6. App Store / Play “What’s New”: mention Shop tab + Profile Orders (ops)

## Store release notes (ops template)

```
• Shop marketplace — browse maker goods, checkout with Canada Post rates, and track orders under Profile → Orders
• Report damaged / not-as-described issues within 14 days of delivery
```
