# Shopify Sales Channel — Phase 1 notes

## What shipped in repo

- `extensions/channel-config/` — `channel_config` extension + `offhrs-ca` specification (CA / CAD / EN+FR)
- `shopify.app.toml` — `embedded = true`, App URL `https://offhrs.app/shopify`, scopes include `read_product_listings`
- Embedded Admin UI — `/shopify` with App Bridge + Polaris `AccountConnection`, banners, billing CTA, terms, offhrs link
- Channel APIs — `/api/shopify/channel/{status,subscribe,disconnect}`
- OAuth / billing / claim return to `/shopify` (not Partners Settings as primary)
- Partners Settings copy demoted to “manage in Shopify Admin”
- Framing — CSP `frame-ancestors` allows Shopify Admin on `/shopify`

## What you must run (Partner / CLI)

1. Log in to Shopify CLI: `shopify auth login`
2. From repo root: `shopify app deploy` (registers channel_config + pushes toml)
3. Confirm Partner Dashboard App URL = `https://offhrs.app/shopify` and **embedded** is on
4. Install on a **dev store** → Sales channels → offhrs → Connect → Start trial
5. Upload 16×16 nav icon if not already (Phase 0)

## Exit criteria

- [ ] Appears under Sales channels after deploy
- [ ] AccountConnection connect / disconnect works without support email
- [ ] Billing approve / decline returns to `/shopify`
- [ ] Partners Settings no longer described as the primary control room

## Not in Phase 1 (Phase 2+)

- `channelCreate` + Contextual Product Feeds
- ResourceFeedback / publishing card counts
- Cart permalinks + storefront attribution
