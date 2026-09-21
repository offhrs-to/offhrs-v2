# Shopify Sales Channel — Phase 2 notes

## Goal

Replace tag-pull as the publish model with Shopify’s sales-channel publish + Contextual Product Feeds.

## What shipped in repo

- Migration `20260915000000_shopify_channel_connection.sql` — `shopify_channel_gid` / `shopify_channel_handle`
- `channelCreate` / `channelDelete` / `channelFullSync` — `src/lib/shopify/channel-connection.ts`
- Bootstrap after connect + billing — `bootstrapOffhrsChannelFeeds`
- Product feed webhook handling — `product_feeds/*` → Admin refetch + event upsert (no tag required)
- ResourceFeedback — missing session datetime → `REQUIRES_ACTION` in Admin
- Channel Admin **Publishing** section — count, products / bulk publications links, Sync button
- API — `POST /api/shopify/channel/sync`
- Scopes — `read_product_listings`, `write_resource_feedbacks` in `shopify.app.toml`
- Restored Phase 1 App URL / embedded after config-link reset

## What you must run

1. Apply migration (Supabase): `20260915000000_shopify_channel_connection.sql`
2. Deploy app code to production (`offhrs.app`)
3. `shopify app deploy` — pushes scopes + keeps channel_config
4. On the **dev store**, re-approve OAuth if prompted (new scopes)
5. Disconnect → Connect (or Sync published) so `channelCreate` runs
6. Publish a workshop product **to the offhrs channel** in Admin
7. Confirm it appears on offhrs with sessions/seats; unpublish archives it

## Exit criteria

- [ ] `channelCreate` succeeds (store needs a CA market / web presence — `expectsOnlineStoreParity`)
- [ ] Feed webhooks deliver; listings upsert without `offhrs_workshop` tag
- [ ] Missing datetime shows ResourceFeedback on the product
- [ ] Unpublish / delete removes listings from offhrs
- [ ] Publishing UI shows count + Admin deep links

## Fallback

Tagged `offhrs_workshop` full sync still runs as a safety net until feeds are proven in production.
