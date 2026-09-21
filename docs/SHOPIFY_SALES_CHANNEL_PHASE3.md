# Shopify Sales Channel — Phase 3 notes

## Goal

Guests tap **Book** on offhrs → Shopify cart (qty 1) → checkout → order attributes to the offhrs sales channel.

## What shipped in repo

- Migration `supabase/migrations/20260915120000_shopify_storefront_token.sql` — `storefront_access_token_encrypted` on `vendor_shopify_shops`
- `src/lib/shopify/cart-permalink.ts` — create/persist storefront token; build `/cart/{variantId}:1` permalinks with `access_token` + `source_name=channel:{handle}`; allow `offhrs.book_url` only when it stays on this shop’s cart/checkout
- Sync + bootstrap call `ensureStorefrontAccessToken`; upserts write cart permalinks into `events.external_link` (no product-page default)
- Connected sync preview uses the same resolver
- Conventions + Partners shopify-sync copy updated

## What you must run

1. **Apply migration** (Supabase prod / linked project):
   ```bash
   npx supabase db push
   ```
   or run the SQL in the dashboard.
2. **Deploy web** (`offhrs.app`) so sync uses the new book URLs.
3. **Deploy scopes** — `shopify app deploy` (adds `unauthenticated_read_product_listings`). Existing installs will **not** auto-prompt; use **Approve new scopes** on the channel home (or `/api/shopify/channel/reauth`).
4. **Re-sync** the channel so sessions get cart permalinks with `access_token`.

## Smoke test

1. Publish a workshop product to offhrs; Sync until the session shows on offhrs.
2. Open the Book CTA — URL should look like:
   `https://{shop}.myshopify.com/cart/{variantId}:1?access_token=…&source_name=channel:…`
3. Complete checkout on Shopify (test / real payment as appropriate).
4. In Admin → Orders / Analytics, confirm the order is attributed to the **offhrs** sales channel (not Online Store alone).

## Exit criteria

- [ ] Book → cart with correct variant + qty 1
- [ ] Checkout completes on Shopify
- [ ] Order shows channel attribution
- [ ] Off-Shopify `offhrs.book_url` values are ignored on sync

## Not in Phase 3 (Phase 4)

- Screencast, App Store packet, full 6-panel QA, resubmit
