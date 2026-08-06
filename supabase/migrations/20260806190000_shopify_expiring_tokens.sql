-- Expiring offline Admin API tokens (Shopify Dec 2025+).
-- Store refresh token + expiry so Sync/webhooks can rotate before API calls.

ALTER TABLE public.vendor_shopify_shops
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted text,
  ADD COLUMN IF NOT EXISTS access_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at timestamptz;

COMMENT ON COLUMN public.vendor_shopify_shops.refresh_token_encrypted IS
  'Encrypted Shopify offline refresh token (expiring offline tokens).';
COMMENT ON COLUMN public.vendor_shopify_shops.access_token_expires_at IS
  'When access_token_encrypted expires; null = legacy non-expiring token.';
COMMENT ON COLUMN public.vendor_shopify_shops.refresh_token_expires_at IS
  'When the refresh token expires (~90 days from issue/refresh).';
