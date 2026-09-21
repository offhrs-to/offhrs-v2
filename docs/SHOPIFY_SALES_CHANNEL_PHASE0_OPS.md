# Shopify Sales Channel — Phase 0 ops checklist

Human / Partner Dashboard steps that run **in parallel** with Phase 1 engineering. Engineering artifacts for this phase live in the repo; several items still need you in the Shopify Partner Dashboard.

**Related**

- Plan: [`SHOPIFY_SALES_CHANNEL_PLAN.md`](./SHOPIFY_SALES_CHANNEL_PLAN.md)
- Listing draft: [`SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md`](./SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md)
- Nav icon (upload): [`../public/shopify/offhrs-channel-nav-icon.svg`](../public/shopify/offhrs-channel-nav-icon.svg)

**Do not resubmit the app until Phases 1–3 are done.** Phase 0 prepares the packet so resubmit isn’t blocked later.

---

## 1. Partner Dashboard — emergency contact

1. Open [Partner account settings](https://partners.shopify.com) → **Settings** / **Partner account**.
2. Add an **emergency developer contact** (phone + email that reaches someone who can fix production).
3. Prefer a shared ops inbox (e.g. `support@offhrs.app`) plus a personal backup.

**Done when**

- [ ] Emergency contact saved and verified

---

## 2. Upload 16×16 sales channel nav icon

Shopify requires a **16×16 SVG** navigation icon for Sales Channels (requirement 5.7.18).

1. File ready in repo: `public/shopify/offhrs-channel-nav-icon.svg` (sage `#5D755D` mark).
2. Partner Dashboard → your **offhrs** app → **Distribution** / **App setup** / Sales channel branding (exact label varies) → upload the SVG.
3. If the UI only appears after the app is declared a sales channel, upload during **Phase 1 deploy** — keep the file ready either way.
4. Optional: also keep a copy under `extensions/channel-config/` when Phase 1 generates the extension (channel spec `icon = "…"`).

**Done when**

- [ ] SVG uploaded in Partner Dashboard **or** staged for Phase 1 deploy checklist
- [ ] Icon still legible at 16×16 in Admin sidebar preview

---

## 3. Category intent — Sales Channel (do not flip until deploy)

1. In App Store listing settings, plan category = **Sales Channel**.
2. **Do not** change category and resubmit while the app is still a non-embedded tag-sync tool — that will fail again.
3. Flip category + listing copy when Phase 1 `channel_config` is deployed and Admin shell installs as a channel.

**Done when**

- [ ] Owner acknowledges: category change happens with Phase 1+ go-live, not before

---

## 4. Scopes to request / plan for Phase 1 TOML

**Today (`shopify.app.toml`):** `read_products,read_inventory`

**Target for sales channel (Phase 1 deploy — do not ship to production merchants until Admin shell is ready):**

| Scope | Why |
|---|---|
| `read_products` | Keep (product + metafield reads for session parsing) |
| `read_inventory` | Keep (seats / availability) |
| `read_product_listings` | **Required** for Contextual Product Feeds |
| `read_publications` | Publish/unpublish webhooks & publication state (confirm in Phase 2) |
| Unauthenticated / storefront scopes as required to create a **storefront access token** for cart-permalink attribution (Phase 3) | Order attribution |

**Partner Dashboard steps**

1. Note any scopes that need **protected / requested** approval for public apps.
2. Prefer updating scopes via `shopify.app.toml` + `shopify app deploy` in Phase 1 (not ad-hoc Dashboard edits that drift from git).
3. Expect merchants to **re-approve** OAuth when scopes expand.

**Done when**

- [ ] Team agrees target scope set above
- [ ] No production scope bump until Phase 1 Admin shell is installable on a dev store

---

## 5. Listing copy — draft ready

1. Open [`SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md`](./SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md).
2. Review subtitle, intro, bullets, pricing ($29 CAD / 30-day trial), **0% commission** claim (confirm still true).
3. Do **not** paste into live listing until Phase 1+ behavior matches (publish → offhrs → Shopify checkout).
4. Update `/partners/shopify-sync` marketing page in a later phase to match (tag → publish language).

**Done when**

- [ ] Founder signed off on listing draft wording
- [ ] Commission / fee disclosure confirmed accurate

---

## 6. Year-one merchant onboarding plan (review expectation)

Shopify expects sales channels to onboard **several hundred merchants in the first year** after launch. Write a short plan you can paste into review notes:

| Field | Your answer |
|---|---|
| Geography focus | e.g. Greater Toronto / Canada workshop studios |
| Ideal merchant | Shopify-using studios with dated workshop products |
| Acquisition | App Store + offhrs partner outreach + existing Sync waitlist |
| Year-1 target installs | **[fill: e.g. 200–400]** |
| Support capacity | Email `support@offhrs.app` · SLA note |
| Why cart permalinks | Guests book on Shopify checkout; offhrs is discovery only |

**Done when**

- [ ] Numbers + channels filled above (even if aspirational)
- [ ] Same blurb copied into listing draft “Review notes”

---

## 7. Test credentials stub (fill in Phase 4)

Prepare placeholders now so Phase 4 is fast:

| Item | Value |
|---|---|
| Partner development store | `[fill].myshopify.com` |
| Staff login for reviewers | `[fill]` |
| offhrs partner test account | `[fill]` / password or magic link notes |
| Demo workshop product handle | `[fill]` |
| MFA / 2FA notes | `[fill or “disabled for review account”]` |

**Done when**

- [ ] Table reserved; values filled before screencast / resubmit

---

## 8. Engineering already done this phase (repo)

- [x] Phase plan: `docs/SHOPIFY_SALES_CHANNEL_PLAN.md`
- [x] Listing draft: `docs/SHOPIFY_SALES_CHANNEL_LISTING_DRAFT.md`
- [x] Nav icon SVG: `public/shopify/offhrs-channel-nav-icon.svg`
- [x] This ops checklist

---

## Exit criteria — Phase 0

Phase 0 is **complete for engineering** when the three artifacts above exist.  
Phase 0 is **complete for ops** when sections **1, 5, 6** are checked (2–4 can finish at Phase 1 deploy; 7 at Phase 4).

**Next:** Start **Phase 1** — `channel_config` + `embedded = true` + Admin AccountConnection shell.
