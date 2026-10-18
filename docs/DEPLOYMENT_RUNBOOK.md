# offhrs deployment runbook — Marketplace + Shopify Sync + Terms

Single step-by-step for putting **Artist Marketplace** into production, finishing **Shopify Sales Channel** resubmission, shipping **Terms / pricing** updates, and closing compliance gaps.

**Legend**

| Tag | Who |
|-----|-----|
| **YOU** | Founder / ops (dashboards, counsel, money, App Store / Partner accounts) |
| **AGENT** | Engineering in Cursor (code, migrations drafts, deploy helpers once you approve) |
| **BOTH** | Needs a decision from you, then Agent implements |

**Source branch:** `cursor/artist-shop-marketplace-plan` (ahead of `main`; Marketplace Phases 1–4, Sales Channel Phases 1–4 engineering, Terms updates, Full License / 5-tier pricing are on this branch).

**Not legal or tax advice.** Counsel / CPA sign-offs stay on you.

---

## Current state (as of Oct 2026)

| Workstream | Code status | Production / ops status |
|------------|-------------|-------------------------|
| Marketplace Phases 1–4 | In repo on branch | Need prod migrations, live Shippo/Stripe env, web + mobile release |
| Terms formatting + Marketplace/Shopify policy rewrite | Committed + deployed to offhrs.app (`2f6201d`) | Counsel review still recommended; several **code** gaps remain (below) |
| 5-tier partner pricing (Lite $29 / Pro $39 / Full $59 / Marketplace free / Sync $29) | In repo | Stripe Price IDs + Supabase migration + Vercel env may still be Preview-only |
| Shopify Sales Channel conversion | Engineering Phases 1–4 in repo | Phase 0 ops leftovers + Phase 4 screencast / credentials / resubmit still **YOU**; suspension window open since 11 Sep 2026 |
| Listing metafields (`resolve-listing-metafields.ts`) | On branch, **not** on `origin/main` | Production Sync still limited until this branch is deployed |

---

## Recommended order (do not skip blockers)

```text
1. Decisions + counsel/CPA start          YOU
2. Compliance code (#1 deletion, #2 assent)  AGENT  ← do before scaling Marketplace buyers
3. Merge branch → main + prod migrations     BOTH
4. Vercel Production env (Stripe/Shippo/tier) YOU → Redeploy
5. Marketplace smoke (small $)               YOU
6. Mobile store build                        YOU (+ AGENT if build config)
7. Shopify dry-run + screencast + resubmit   YOU
8. Day-1 monitoring                          YOU
```

You can run Shopify resubmission prep **in parallel** with Marketplace go-live; do **not** flip live Shippo labels or push “Shop” App Store copy until counsel/CPA and the account-deletion fix are in a good place.

---

# PART 0 — Decisions you must make first

## 0.1 Counsel + CRA (blocking for “real money” Marketplace)

**YOU**

1. Engage Ontario counsel on Terms + [Marketplace Seller Addendum](https://offhrs.app/terms/marketplace-seller-addendum) (checklist: `docs/MARKETPLACE_PHASE0_OPS.md` §2).
2. Engage CPA / tax lawyer on GST/HST **platform operator** treatment for Marketplace (`docs/MARKETPLACE_PHASE0_OPS.md` §3). Ask:
   - Collect tax only for **unregistered** vendors, or for all?
   - Is the **3% platform fee** taxable to registered vendors?
   - Any BC/SK/MB/QC PST/QST platform duties?
3. Confirm Stripe Tax Canada registrations match that opinion.
4. Confirm goods tax code: usually `txcd_99999999` (General – Tangible Goods).

Until signed off: Preview / tiny smoke tests OK; delay scaling GMV and live label spend.

## 0.2 Product / policy decisions (blocking Agent work on refunds + tax code)

**YOU → tell AGENT**

| # | Issue | Options |
|---|--------|---------|
| A | Marketplace pre-scan refunds: who absorbs Stripe card fee? | **Decided (Oct 15, 2026): B — vendor bears**, same as workshops. |
| B | Marketplace tax for GST/HST-**registered** vendors | **Decided: collect at checkout only for registered vendors into their Connect account; vendor remits (same as workshops). Do not collect for unregistered vendors.** |
| C | Existing $49 Pro subscribers | **Decided: migrate all to $39.** No grandfathering. Founder believes there are no active Pro trials. |

**AGENT can start without A/B:** account deletion (#1) and vendor Terms assent (#2) below.

---

# PART 1 — Terms / compliance fixes still required

Terms **wording** for Marketplace + Shopify Sync is live. These are the remaining **product** gaps from the Oct 2026 review.

## 1.1 Account deletion blocked for Marketplace buyers — **AGENT (hybrid decided)**

**Bug (fixed in code):** `shop_orders.user_id` was `ON DELETE RESTRICT`. Buyer delete could wipe profile/saves then fail at `deleteUser`.

**Decision (Oct 16, 2026) — hybrid / market-standard:**

| Stage | Action |
|-------|--------|
| Not shipped yet (ship, pre–First Scan) | Refund, then anonymize |
| Awaiting pickup / in transit / 14-day claim window / open claim / dispute | **Block** with clear in-app message |
| Delivered or picked up and quiet | Anonymize PII; keep amounts / tax / Stripe IDs |

**AGENT status:**

1. [x] Migration `20261016000000_shop_orders_account_deletion_set_null.sql` — nullable `user_id` / `buyer_user_id`, `ON DELETE SET NULL`
2. [x] `src/lib/shop/account-deletion.ts` + `src/app/api/account/delete/route.ts` hybrid flow (anonymize **before** profile wipe)
3. [x] Privacy Policy Marketplace deletion wording updated

**YOU:** Apply the migration on production Supabase. Smoke-test: (a) delete with a completed quiet shop order, (b) confirm in-transit / claim-window delete returns the block message, (c) unshipped order refunds then deletes.

## 1.2 Vendor Terms acceptance (clickwrap) — **AGENT (implemented)**

**Gap (fixed in code):** Partner signup was browsewrap; clawback / indemnity need recorded assent.

**AGENT status:**

1. [x] Checkbox on `PartnerSignupWizard` (blocks Continue until checked); links to ToU, Privacy, DPA, Seller Addendum
2. [x] Server rejects signup without `accept_terms: true`; writes `legal_acceptances` rows (user, doc, `POLICY_LAST_UPDATED`, IP, UA, time) — migration `20261016010000_legal_acceptances.sql`
3. [x] Existing vendors without current version → redirect `/partners/accept-terms` from dashboard layout
4. [x] Marketplace shipping first attestation records Seller Addendum version; Shopify Connect bridge requires checkbox + logs `shopify_connect` assent

**YOU:** Apply the `legal_acceptances` migration on production. Smoke-test: throwaway signup (checkbox + DB rows); log in as an existing vendor and accept once; Connect from Shopify after checking the box.

## 1.3 Ontario internet-sale disclosures — **AGENT** ✅ code done (apply migration on prod)

**Done in code:** Buyer confirmation email + mobile checkout “Purchase details” include seller identity (name, ship-from/location address when set, website), itemized price/shipping/tax, delivery, cancel/return/SNAD, order id/date (email), support, Terms version + link. `shop_orders.terms_version` set at confirm (`20261016020000_shop_orders_terms_version.sql`). Product API returns `purchase_disclosures` for checkout UI.

**YOU:** Ask counsel whether home-based sellers may show a business mailing address instead of home address. Apply the Terms-version migration on prod with other Marketplace SQL.

## 1.4 Privacy / Meta / Google — **AGENT** ✅

**Done:** Cookie + Privacy policies aligned to **Meta Pixel only** (Meta Ads Manager / Instagram; no Google Analytics, no Google Ads tags, no Meta CAPI). Pixel loads only after Accept on the site cookie banner (`CookieConsentBanner` + `MetaPixel`). Dead `gtag` branch removed from workshop outbound.

**YOU:** None for this item (confirmed: Meta Ads Manager + Instagram only).

## 1.5 Refund fee + tax scope — **BOTH**

Decisions are in Part 0.2. Code collects Marketplace GST/HST only when `gst_hst_registered` is true, into the vendor Connect account (vendor remits, same as workshops). Pre-scan refunds keep the Stripe processing fee with the vendor. Shipping remains platform-held for Shippo. Counsel/CPA should still confirm before scaling GMV. **YOU** moves any live Pro subscription still on the $49 Price onto the $39 Price (Part 4).

---

# PART 2 — Ship code to production

## 2.1 Merge / deploy branch — **BOTH** ✅ code merged to `main`

**Done:** Fast-forward merge of `cursor/artist-shop-marketplace-plan` → `main` (includes Marketplace, Shopify Sync / Sales Channel, Terms, launch-readiness: deletion, clickwrap, Ontario disclosures, Meta consent).

**YOU / AGENT follow-up**

1. Confirm Vercel Production build green for **offhrs-v2**.
2. Spot-check: `/terms/marketplace-seller-addendum`, partners Marketplace nav, `/shopify` channel home.

**Do not** leave Marketplace / metafield Sync only on Preview if you expect production sellers (e.g. Depanneur-style metafields need `resolve-listing-metafields` on prod).

## 2.2 Supabase production migrations — **YOU** (AGENT can prepare SQL)

Apply in order on **production** (SQL Editor or `supabase db push` linked to prod). Skip any already applied.

### Marketplace

1. `20260826000000_marketplace_phase1.sql`
2. `20260828000000_marketplace_phase2.sql`
3. `20260829000000_marketplace_pickup_settings.sql`
4. `20260830000000_marketplace_phase3.sql`
5. `20260831000000_marketplace_phase4.sql`
6. Plus any later Marketplace / deletion / `legal_acceptances` migrations AGENT adds in Part 1

### Pricing

7. `20260921000000_partner_full_license_tier.sql` (`subscription_tier` includes `full`)

### Shopify Sales Channel

8. Phase 2 channel / feeds migration(s) from Sales Channel docs (if not already on prod) — confirm with AGENT before re-running.

**Verify:** Table Editor shows `shop_orders`, `shop_order_claims`; `vendor_subscriptions.subscription_tier` allows `full`.

---

# PART 3 — Marketplace production go-live

Detail mirrors `docs/MARKETPLACE_PHASE0_OPS.md` + `docs/MARKETPLACE_PREVIEW_ACCESS.md`. There is **no feature flag** — live = migrations + Production env + deploy + mobile → `https://offhrs.app`.

## 3.1 Vercel Production env — **YOU**

Project **offhrs-v2** → Settings → Environment Variables → **Production** → Redeploy.

| Variable | Production value |
|----------|------------------|
| `SHIPPO_API_KEY` | `shippo_live_…` (after CP approved) |
| `SHIPPO_WEBHOOK_SECRET` | long random; match Shippo webhook auth |
| `SHIPPO_CANADA_POST_CARRIER_ACCOUNT_ID` | optional pin |
| `STRIPE_SHOP_GOODS_TAX_CODE` | `txcd_99999999` (or CPA-approved) |
| `SHOP_PLATFORM_FEE_BPS` | `300` |
| `SHOP_HIGH_VALUE_INSURANCE_CAD` | `250` |
| `GOOGLE_MAPS_API_KEY` | server key, Places enabled |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | live |
| `CRON_SECRET` | same as other crons |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | live endpoint |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | if separate Connect endpoint |
| `STRIPE_LITE_PRICE_ID` | live $29 |
| `STRIPE_PRO_PRICE_ID` | live $39 |
| `STRIPE_FULL_PRICE_ID` | live $59 |
| `DISABLE_EXPENSIVE_ENDPOINTS` | `0` |

Never set `NEXT_PUBLIC_SHIPPO_*`.

## 3.2 Shippo live — **YOU**

1. Account + payment method.
2. Carriers → Canada Post → Activate (request Shippo approval for shared CP if API blocked).
3. Live API key → Vercel.
4. Webhook: `https://offhrs.app/api/webhooks/shippo` + Bearer secret.
5. UI smoke: CA→CA rates; don’t buy junk labels.

## 3.3 Stripe live Marketplace — **YOU**

1. Tax → Canada registrations per CPA.
2. Webhooks on `https://offhrs.app/api/webhooks/stripe` include:
   - existing workshop events
   - `charge.dispute.created` / `updated` / `closed`
3. Connect onboarding required for seller payouts.
4. Confirm shipping + tax stay in platform fee; seller net ≈ item − 3% (`docs/MARKETPLACE_POSTAGE_LEDGER.md`).

## 3.4 Crons — already in `vercel.json`

- `/api/cron/shop-sla-reminders` daily — needs `CRON_SECRET`.
- Optional: schedule `/api/cron/shop-clawbacks` later.

## 3.5 Seller + smoke — **YOU**

1. Real Pro/Full or Marketplace-only seller: shipping settings, QA approve, product with weight/dims, publish.
2. Small-$ buyer path: Shop → rates → PaymentSheet → Profile Orders + seller Orders → **Print label** (live postage) → tracking / email.
3. Optional: one pre-scan cancel/refund + void.
4. Kill switch if needed: `DISABLE_EXPENSIVE_ENDPOINTS=1` and/or unpublish products.

---

# PART 4 — Five-tier pricing ops

Full detail: `docs/PARTNER_PRICING_5_TIER_OPS.md`.

**YOU**

1. Stripe Live: Lite $29, Pro **$39** (new Price), Full License **$59** → copy Price IDs.
2. Set three Vercel Production Price ID vars → Redeploy.
3. Apply Full License Supabase migration (Part 2.2).
4. Confirm Shopify App Pricing still **$29 CAD / 30-day trial**, handle `offhrs-sync`.
5. Smoke: Marketplace-only, Lite (no Marketplace), Pro, Full (Marketplace + Sync without Shopify Sync charge), Sync-only.

**AGENT:** Fix any post-deploy entitlement bugs you report.

---

# PART 5 — Shopify Sales Channel resubmission

Engineering Phases 1–4 are in repo. Resubmit is blocked only by **ops + proof**, not more architecture. Guides: `docs/SHOPIFY_SALES_CHANNEL_PLAN.md`, `PHASE4.md`, `LISTING_DRAFT.md`, `PHASE0_OPS.md`.

## 5.1 Production / Partner deploy — **YOU** (+ AGENT if CLI fails)

1. From repo (Production app, **not** a new app): `shopify app deploy` so `channel_config`, scopes, embedded `/shopify` match git.
2. Prefer **not** overwriting production URLs mid-link if CLI asks.
3. Dev / review store: install → appears under **Sales channels → offhrs**.
4. Existing installs: **Approve new scopes** (incl. storefront / product listings as required).
5. Confirm channel home: Connect, billing, Publish, Sync, Terms/Privacy in new window.

## 5.2 Phase 0 leftovers — **YOU**

- [ ] Emergency developer contact in Partner settings  
- [ ] Upload 16×16 SVG (`public/shopify/offhrs-channel-nav-icon.svg`)  
- [ ] Listing category = **Sales Channel** (only when channel behavior is live)  
- [ ] Paste listing copy from `SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md`  
- [ ] Confirm **0% commission** + **$29 / trial** accurate  
- [ ] Year-one merchant onboarding numbers in review notes  

## 5.3 Dry-run (6-panel) — **YOU**

Store: `offhrs-sync-review.myshopify.com` (or your review store).

| # | Pass when |
|---|-----------|
| 1 | Install → Sales channels → offhrs |
| 2 | AccountConnection → connected |
| 3 | Start trial → charge approved |
| 4 | Publish workshop (parseable datetime) → Sync sessions |
| 5 | Listing visible on offhrs |
| 6 | Book on Shopify → cart → checkout; order attributes to **offhrs** |

Also: unpublish archives; disconnect/reconnect; uninstall wipe; Partners Settings is status-only (no Start trial / Sync / Disconnect).

**Datetime tip for vendors/reviewers:** variant Date option or `offhrs.starts_at` metafield — see listing draft. Branch metafield resolver must be on the environment under test.

## 5.4 Screencast + credentials + submit — **YOU**

1. Record English 3–5 min screencast (outline in listing draft).
2. Fill review credentials table (staff login, storefront password, offhrs partner, demo product, MFA notes).
3. Upload screencast; paste review notes.
4. **Resubmit** (suspension ended 11 Sep 2026).

**AGENT:** Fix review bounce comments; keep Lite/Pro Stripe paths untouched.

---

# PART 6 — Mobile App Store / Play release

**YOU**

1. Production EAS profile: `EXPO_PUBLIC_BOOK_API_BASE` / API base = `https://offhrs.app` (not Preview).
2. Live Stripe publishable key in production profile.
3. EAS production build → submit.
4. What’s New:

```text
• Shop marketplace — browse maker goods, checkout with Canada Post rates, and track orders under Profile → Orders
• Report damaged / not-as-described issues within 14 days of delivery
```

5. After approval: one tiny real purchase on TestFlight / production build.

**AGENT:** Build/config fixes if EAS fails; account-deletion must work in-app before store review if Apple re-checks 5.1.1(v).

Uncommitted local mobile UI tweaks (`offhrs-mobile/app/(tabs)/index.tsx`) are **not** required for Marketplace go-live — ship in a separate mobile commit if you want them.

---

# PART 7 — Day-1 ops checklist — **YOU**

- [ ] Shippo balance / label volume  
- [ ] Stripe live payments + Connect transfers  
- [ ] Shippo + Stripe dispute webhook logs  
- [ ] Know kill switch (`DISABLE_EXPENSIVE_ENDPOINTS` / unpublish)  
- [ ] Remittance calendar: who remits Marketplace tax each period  
- [ ] Watch Shopify App Store review inbox  

---

# Master checkbox — split by owner

## YOU (founder)

- [ ] Counsel on Terms / Addendum  
- [ ] CPA on Marketplace tax model  
- [x] Decide refund-fee policy (vendor bears Stripe fee) and $49→$39 Pro treatment (migrate all; no grandfathering)  
- [x] Approve account-deletion behavior for active orders (hybrid: refund unshipped / block live / anonymize quiet)  
- [ ] Apply Supabase production migrations  
- [ ] Set all Vercel Production env vars (Shippo, Stripe, tax, Price IDs, Maps, Resend, cron)  
- [ ] Shippo live + CP approval + webhook  
- [ ] Stripe Tax + dispute webhook events  
- [ ] Approve merge of `cursor/artist-shop-marketplace-plan` → production branch  
- [ ] Marketplace seller path + small-$ smoke (incl. live label)  
- [ ] Stripe Price IDs for Lite/Pro/Full + Shopify Sync $29 confirm  
- [ ] `shopify app deploy` + scope re-auth on review store  
- [ ] Phase 0 listing / icon / emergency contact / year-one numbers  
- [ ] 6-panel dry-run + screencast + credentials + **resubmit**  
- [ ] Mobile production build + store “What’s New”  
- [ ] Day-1 monitoring  

## AGENT (ask in Cursor)

- [x] Implement account deletion + migration (#1) — apply SQL on prod still YOU  
- [x] Implement vendor + existing-vendor Terms assent (#2) — apply `legal_acceptances` SQL on prod still YOU  
- [x] Ontario disclosure email/checkout (#3) — apply `terms_version` SQL on prod still YOU  
- [x] Privacy / analytics alignment (+ cookie consent) (#4)  
- [x] After your decision: refund-fee code/Terms align (vendor bears Stripe fee on pre-scan refunds)  
- [x] After CPA decision: tax collection branch — registered vendors only, Connect remittance (`gst_hst_registered`)  
- [x] PR / merge branch to `main` when you say go  
- [ ] Help with failed Vercel / EAS / `shopify app deploy`  
- [ ] Fix Shopify review bounce items  
- [ ] Any post-smoke Marketplace/Sync bugs  

---

## Related docs (detail)

| Topic | Doc |
|-------|-----|
| Marketplace ops (Shippo, counsel, CRA, tax code) | `docs/MARKETPLACE_PHASE0_OPS.md` |
| Preview / phase env matrix | `docs/MARKETPLACE_PREVIEW_ACCESS.md` |
| Postage / fee ledger | `docs/MARKETPLACE_POSTAGE_LEDGER.md` |
| Marketplace product plan | `docs/ARTIST_SHOP_MARKETPLACE_PLAN.md` |
| 5-tier pricing | `docs/PARTNER_PRICING_5_TIER_OPS.md` |
| Shopify conversion plan | `docs/SHOPIFY_SALES_CHANNEL_PLAN.md` |
| Shopify Phase 0 / 4 / listing | `docs/SHOPIFY_SALES_CHANNEL_PHASE0_OPS.md`, `PHASE4.md`, `LISTING_DRAFT.md` |

---

## Suggested next message to Agent

Pick one to start immediately:

1. **“Implement account deletion + vendor Terms assent”** (Part 1.1–1.2)  
2. **“Open a PR to merge marketplace branch to main”** (after you confirm migrations/env readiness)  
3. **“Walk me through Supabase + Vercel Marketplace env click-by-click”** (Part 2–3)  
4. **“Prep Shopify resubmit checklist for my review store”** (Part 5)  
