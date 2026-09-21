-- Phase 3: storefront access token for cart-permalink order attribution.
ALTER TABLE public.vendor_shopify_shops
  ADD COLUMN IF NOT EXISTS storefront_access_token_encrypted text;

COMMENT ON COLUMN public.vendor_shopify_shops.storefront_access_token_encrypted IS
  'Encrypted Storefront access token for cart permalink attribution to the offhrs sales channel.';
