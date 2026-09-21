# Shopify Sales Channel — Phase 4 notes

Harden + App Store resubmit packet. Engineering for Phases 1–3 is live; this phase is QA, review assets, and submission.

## What shipped in repo (Phase 4 hardening)

- Do not bind a non-offhrs channel when looking up connections (`channels.nodes[0]` removed)
- Channel status no longer returns partner email / business name unless the signed-in partner owns the shop
- Partners Settings billing flash copy updated (publish language, not tag-only)
- This checklist + listing / plan updates

## 6-panel merchant journey (dry-run)

Use partner development store `offhrs-sync-review.myshopify.com` (or your review store). Check each box on one clean pass.

| # | Panel | Pass when |
|---|---|---|
| 1 | Install | App opens under **Sales channels → offhrs** (embedded `/shopify`) |
| 2 | Connect | AccountConnection → sign in / claim → connected state without support email |
| 3 | Bill | Start trial → approve charge → plan shows active |
| 4 | Publish | Workshop product published to **offhrs**; Sync shows sessions |
| 5 | Appear | Session visible in **offhrs mobile** (or admin sync preview) |
| 6 | Book | **Book on Shopify** → cart (enter storefront password on dev stores) → checkout |

Also verify:

- [ ] Unpublish / delete product → session archived after sync / webhook (and editing while unpublished does not resurrect)
- [ ] Disconnect → Connect popup: login → Shopify approve → popup closes → connected again
- [ ] Uninstall app → reinstall via Apps (Sales channel link may 404 until reinstalled); OAuth breaks out of iframe (Firefox-safe)
- [ ] Terms / Privacy open in a **new** window from AccountConnection
- [ ] Order shows **offhrs** channel attribution after checkout (Phase 3 exit)
- [ ] Partners Settings shows status + Admin link only (no Start trial / Sync / Disconnect)

## GDPR / uninstall (code confirmed)

| Topic | Behavior |
|---|---|
| `app/uninstalled` | `channelDelete` (best effort) + `disconnectShopifyShopByDomain` (archive events, delete shop row) |
| `shop/redact` | Same disconnect wipe |
| `customers/data_request` | Acknowledged + logged (offhrs Sync does not store Shopify customer PII) |
| `customers/redact` | Acknowledged + logged (no customer rows to redact for Sync) |

Webhook registration: GraphQL topics including `APP_UNINSTALLED` + product feeds (see `ensureShopifyWebhooks`). Compliance topics are declared in `shopify.app.toml`.

## Screencast (English, 3–5 min)

Follow [`SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md`](./SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md) outline:

1. Install → Sales channels → offhrs  
2. Connect account  
3. Approve Shopify Sync billing  
4. Publish workshop (datetime on variant) → Sync  
5. Show listing in offhrs app  
6. Book on Shopify → cart → (optional) complete test checkout  
7. Optional: Disconnect  

Upload to Partner Dashboard listing + keep a local copy.

## Test credentials (fill before submit)

| Item | Value |
|---|---|
| Partner development store | `offhrs-sync-review.myshopify.com` (or `[fill]`) |
| Staff login for reviewers | `[fill]` |
| Storefront password (dev stores) | Online Store → Preferences → `[fill]` |
| offhrs partner test account | `[fill]` / password |
| Demo workshop product handle | `[fill]` |
| MFA / 2FA notes | `[fill or “disabled for review account”]` |

Paste the same block into App Store **Review notes**.

## Listing / Partner Dashboard ops

1. Paste listing copy from [`SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md`](./SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md) (Sales Channel category)
2. Confirm **0% commission** + **$29 CAD / 30-day trial** still accurate
3. Upload **16×16** nav icon if not already (`public/shopify/offhrs-channel-nav-icon.svg`)
4. Complete Phase 0 ops leftovers: emergency contact, year-one merchant targets
5. Resubmit when dry-run + screencast + credentials are ready (suspension window open as of 11 Sep 2026)

## Exit criteria

- [ ] One clean 6-panel dry-run on the review store  
- [ ] Screencast uploaded  
- [ ] Test credentials filled in review notes  
- [ ] Listing + category final  
- [ ] GDPR / uninstall spot-checked once  
- [ ] App Store resubmit sent  

**Next after submit:** Monitor review comments; keep Sync Lite/Pro Stripe paths untouched.
