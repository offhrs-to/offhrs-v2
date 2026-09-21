-- Phase 2: persist sales-channel connection for product feeds / channelFullSync.
ALTER TABLE public.vendor_shopify_shops
  ADD COLUMN IF NOT EXISTS shopify_channel_gid text,
  ADD COLUMN IF NOT EXISTS shopify_channel_handle text;

COMMENT ON COLUMN public.vendor_shopify_shops.shopify_channel_gid IS
  'Admin GraphQL Channel GID from channelCreate (offhrs-ca).';
COMMENT ON COLUMN public.vendor_shopify_shops.shopify_channel_handle IS
  'Channel connection handle (stable per vendor account).';
