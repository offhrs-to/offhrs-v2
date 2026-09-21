# Shopify Sync → Sales Channel conversion plan

> **Status:** PHASE 2 IN PROGRESS — channelCreate + product feeds + ResourceFeedback + Publishing UI in repo; apply migration + redeploy + re-auth scopes.  
> **Product promise (non-negotiable):** Vendors list workshops on offhrs **without re-entering product content** in the Partners dashboard. Shopify remains source of truth for titles, variants/dates, inventory, and checkout.  
> **Docs:** [`SHOPIFY_SALES_CHANNEL_PHASE0_OPS.md`](./SHOPIFY_SALES_CHANNEL_PHASE0_OPS.md) · [`SHOPIFY_SALES_CHANNEL_PHASE1.md`](./SHOPIFY_SALES_CHANNEL_PHASE1.md) · [`SHOPIFY_SALES_CHANNEL_PHASE2.md`](./SHOPIFY_SALES_CHANNEL_PHASE2.md) · [`SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md`](./SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md)

| Question | Answer |
|---|---|
| Keep App Store + current discovery model? | **Must become a Sales Channel** (4.5.1 / 1.1.6) |
| Keep “no Partners workshop forms”? | **Yes** — publish from Shopify Admin instead of tag + Sync in Settings |
| Full offhrs consumer rewrite? | **No** |
| Estimated focused effort | **~3–5 weeks** to review-ready MVP |

**Verdict:** Execute Phases 1–3 in order; run Phase 0 listing/ops in parallel; Phase 4 is QA + App Store packet + resubmit.

---

## Hard constraints

1. **No Partners catalog entry** — merchants do not type workshop title/price/date/seats into Partners for Sync listings.
2. **Shopify checkout for synced workshops** — no Stripe / offhrs checkout for `listing_source = shopify`.
3. **Reuse existing sync core** — prefer adapting `src/lib/shopify/sync-workshops.ts` over a greenfield importer.
4. **Cart-permalink channel** — not a Buy SDK / channel-hosted checkout (lowest complexity; no PPA addendum).
5. **Lite/Pro Stripe billing stays separate** — Sync charges stay on Shopify Billing API only.

---

## What stays vs moves

| Job | Today | After |
|---|---|---|
| Create workshop content | Shopify product + variants | Same |
| “List this on offhrs” | Tag `offhrs_workshop` + Sync now | **Publish to offhrs channel** |
| Connect shop ↔ partner | Partners Settings claim | **AccountConnection in Shopify Admin** |
| Sync billing | `appSubscriptionCreate` $29 CAD | Same |
| Guest discovery | offhrs app | Same |
| Guest pays | Product page URL | **Cart permalink + attribution** |
| Studio address / map pin | Partners profile | Same (Partners stays nameplate) |

---

## Phased delivery

### Phase 0 — Ops + listing prep (parallel, 1–2 days)

Partner Dashboard / App Store packet scaffolding so engineering isn’t blocked at the end.

See **[`SHOPIFY_SALES_CHANNEL_PHASE0_OPS.md`](./SHOPIFY_SALES_CHANNEL_PHASE0_OPS.md)** for the human checklist.

- [x] Recategorize intent documented: Sales Channel (flip with Phase 1 deploy — not before)
- [x] 16×16 SVG nav icon in repo (`public/shopify/offhrs-channel-nav-icon.svg`) — upload in Partner Dashboard
- [x] Draft listing copy + screencast outline (`SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md`)
- [x] Target scopes documented (`read_product_listings` + keep products/inventory; publications / storefront token in Phases 2–3)
- [ ] Emergency developer contact in Partner Dashboard *(ops)*
- [ ] Founder sign-off on listing fees/commission + year-one onboarding numbers *(ops)*

### Phase 1 — Declare channel + Admin shell (4–7 days)

Make the app a real embedded sales channel home. Billing/OAuth keep working.

- [x] Add `channel_config` extension + CA/CAD specification (`extensions/channel-config/`, handle `offhrs-ca`)
- [x] Set `embedded = true` + App URL `/shopify` in `shopify.app.toml` *(Partner deploy still required)*
- [x] Embedded Admin home with App Bridge + Polaris **AccountConnection**, banners, terms, offhrs link
- [x] Post-install / OAuth / billing / claim → `/shopify` (not Partners Settings as primary)
- [x] Channel APIs for status / subscribe / disconnect from Admin
- [x] Partners Settings demoted to “manage in Shopify Admin” helper
- [ ] `shopify app deploy` + install on a **dev store** (Partner login)

**Exit criteria:** Install on a dev store → see offhrs under Sales channels → connect partner account → approve Sync charge → disconnect without support. See [`SHOPIFY_SALES_CHANNEL_PHASE1.md`](./SHOPIFY_SALES_CHANNEL_PHASE1.md).

### Phase 2 — Publish + product feeds (1–2 weeks)

Replace tag-pull with Shopify’s publish model. **Largest risk phase.**

- [x] `channelCreate` after account connect (`bootstrapOffhrsChannelFeeds`)
- [x] Subscribe to Contextual Product Feeds; full + incremental sync handlers
- [x] Map published products → existing event upsert path (Admin refetch for metafields)
- [x] **ResourceFeedback** for missing datetime
- [x] Publishing section in Admin: count + bulk editor / products links + Sync
- [x] Deprecate tag-as-publish gate on feed path (tag remains legacy fallback)
- [ ] Apply DB migration + `shopify app deploy` + re-auth scopes on a dev store
- [ ] Prove end-to-end: publish → appears on offhrs; unpublish → archived

**Exit criteria:** Merchant publishes a workshop product in Admin → it appears on offhrs with correct sessions/seats **without** Partners form entry. Unpublish / delete / inventory updates stay in sync. See [`SHOPIFY_SALES_CHANNEL_PHASE2.md`](./SHOPIFY_SALES_CHANNEL_PHASE2.md).

### Phase 3 — Checkout attribution (2–4 days)

Satisfy sales-channel checkout rules.

- [x] Build cart permalinks with correct variant qty
- [x] Attach **storefront access token** (order attributes to offhrs channel)
- [x] Replace `resolveBookUrl` product-page default
- [x] Remove or hard-restrict `offhrs.book_url` so it cannot leave Shopify checkout
- [x] Mobile/web “Book on Shopify” uses new URLs (`events.external_link` after re-sync)

**Exit criteria:** Guest taps Book → lands in Shopify cart with item → checkout completes → order shows sales-channel attribution in Admin reports. See [`SHOPIFY_SALES_CHANNEL_PHASE3.md`](./SHOPIFY_SALES_CHANNEL_PHASE3.md).

### Phase 4 — Harden + resubmit (3–5 days)

- [x] End-to-end QA checklist (6-panel merchant journey) documented
- [x] Screencast outline + credentials stub in listing draft / Phase 4 notes
- [x] Confirm GDPR webhooks + `app/uninstalled` wipe sync data (code path verified)
- [x] Harden: no non-offhrs channel bind; status PII gated to owning partner session
- [ ] Record screencast + fill test credentials
- [ ] One clean dry-run on review store (incl. order attribution)
- [ ] Resubmit after suspension window (open as of 11 Sep 2026)

**Exit criteria:** Review packet complete; one clean dry-run on a partner development store; submit. See [`SHOPIFY_SALES_CHANNEL_PHASE4.md`](./SHOPIFY_SALES_CHANNEL_PHASE4.md).

---

## Suggested calendar (focused)

| Week | Focus |
|---|---|
| Week 1 | Phase 0 + Phase 1 (channel flag + Admin shell + billing in Admin) |
| Week 2–3 | Phase 2 (feeds + sync cutover) |
| Week 4 | Phase 3 + Phase 4 (checkout attribution, QA, screencast, resubmit) |

Part-time or first-time feeds work: add **+1–2 weeks** buffer on Phase 2.

---

## Primary files / areas

| Area | Touch |
|---|---|
| Config | `shopify.app.toml`, new `extensions/channel-config/` |
| Admin UI (new) | Embedded app routes (App Bridge + Polaris) — net-new vs Partners |
| Sync core | `src/lib/shopify/sync-workshops.ts`, conventions, webhooks |
| Billing (reuse) | `src/lib/shopify/billing.ts`, subscribe + billing callback |
| Book URLs | `resolveBookUrl`, `workshop-outbound`, mobile book CTA |
| Partners Settings | Demote Shopify control room (`SettingsClient.tsx`) |
| Listing / docs | App Store copy; `/partners/shopify-sync` guide update |

---

## Checklist

- [x] Phase 0 (engineering): Icon + listing draft + scopes plan + ops checklist in repo
- [ ] Phase 0 (ops): Emergency contact, listing/commission sign-off, year-one targets, icon upload
- [x] Phase 1 (engineering): `channel_config` + embedded `/shopify` Admin shell + AccountConnection + billing/disconnect APIs
- [x] Phase 1 (deploy): `shopify app deploy` + verify on a dev store
- [x] Phase 2 (engineering): channelCreate + product feeds + ResourceFeedback + Publishing UI
- [x] Phase 2 (deploy): migration + scopes redeploy + publish smoke test
- [x] Phase 3 (engineering): Cart permalinks + storefront attribution + kill unsafe `book_url`
- [x] Phase 3 (ops): storefront-token migration + re-sync + Book → cart smoke (attribution confirm still recommended)
- [x] Phase 4 (engineering): QA packet + uninstall/GDPR confirm + channel/status harden
- [ ] Phase 4 (ops): screencast + credentials + dry-run + resubmit

---

## Success criteria

- App listed / submitted as **Sales Channel**
- Merchants publish from Shopify; **zero** workshop re-entry in Partners for Sync
- Guests discover on offhrs and complete purchase on **Shopify checkout** with channel attribution
- Sync still billed via **Shopify Billing API** ($29 CAD / trial)
- Disconnect, uninstall, and GDPR redact still clear synced listings
- Review screencast matches live behavior

---

## Must-not-forget

`channel_config` deploy · `embedded=true` · App Bridge session tokens · AccountConnection always visible · publish count + bulk editor · ResourceFeedback · cart permalink not product page · storefront access token · no off-Shopify `book_url` · 16×16 nav icon · terms in new window · commission/fee disclosure ($39, 0% if true) · screencast + test login · Partners Settings demotion · don’t break Lite/Pro Stripe paths · hundreds-of-merchants narrative for review notes
