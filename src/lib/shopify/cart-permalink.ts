import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/token-encryption'
import { shopifyAdminGraphql } from '@/lib/shopify/admin-client'

type Admin = SupabaseClient

type ShopTokenRow = {
  id: string
  shop_domain: string
  storefront_access_token_encrypted?: string | null
}

const STOREFRONT_TOKEN_CREATE = `
  mutation OffhrsStorefrontTokenCreate($input: StorefrontAccessTokenInput!) {
    storefrontAccessTokenCreate(input: $input) {
      storefrontAccessToken { accessToken title }
      userErrors { field message }
    }
  }
`

/**
 * Ensure a Storefront access token exists for cart-permalink attribution.
 * Token is created once via Admin API and stored encrypted on the shop row.
 */
export async function ensureStorefrontAccessToken(
  admin: Admin,
  shopRow: ShopTokenRow,
  adminAccessToken: string
): Promise<string | null> {
  if (shopRow.storefront_access_token_encrypted) {
    try {
      return decrypt(shopRow.storefront_access_token_encrypted)
    } catch {
      // Fall through and recreate
    }
  }

  const created = await shopifyAdminGraphql<{
    storefrontAccessTokenCreate: {
      storefrontAccessToken: { accessToken: string; title: string } | null
      userErrors: Array<{ field?: string[] | null; message: string }>
    }
  }>({
    shop: shopRow.shop_domain,
    accessToken: adminAccessToken,
    query: STOREFRONT_TOKEN_CREATE,
    variables: { input: { title: 'offhrs cart attribution' } },
  }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[shopify] storefrontAccessTokenCreate', msg)
    return null
  })

  if (!created) return null

  const errors = created.storefrontAccessTokenCreate?.userErrors ?? []
  const token = created.storefrontAccessTokenCreate?.storefrontAccessToken?.accessToken
  if (errors.length > 0 || !token) {
    console.error(
      '[shopify] storefrontAccessTokenCreate',
      errors.map((e) => e.message).join('; ') || 'no token'
    )
    return null
  }

  const encrypted = encrypt(token)
  const { error } = await admin
    .from('vendor_shopify_shops')
    .update({
      storefront_access_token_encrypted: encrypted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shopRow.id)
  if (error) {
    console.error('[shopify] persist storefront token', error.message)
  } else {
    shopRow.storefront_access_token_encrypted = encrypted
  }
  return token
}

/** True if URL is a Shopify cart/checkout link for this shop (myshopify host). */
export function isAllowedShopifyCheckoutUrl(raw: string, shopDomain: string): boolean {
  try {
    const u = new URL(raw.trim())
    const host = u.hostname.toLowerCase()
    const shop = shopDomain.toLowerCase().replace(/^https?:\/\//, '')
    if (host !== shop) return false
    const path = u.pathname.toLowerCase()
    return (
      path === '/cart' ||
      path.startsWith('/cart/') ||
      path.startsWith('/checkout') ||
      path.includes('/checkouts/')
    )
  } catch {
    return false
  }
}

/**
 * Build a sales-channel cart permalink (qty 1 seat) with storefront token + channel attribution.
 * Falls back to a plain cart URL if token/handle are missing.
 */
export function buildOffhrsCartPermalink(opts: {
  shopDomain: string
  variantId: string
  quantity?: number
  storefrontAccessToken?: string | null
  channelHandle?: string | null
}): string {
  const qty = Math.max(1, opts.quantity ?? 1)
  const base = `https://${opts.shopDomain}/cart/${opts.variantId}:${qty}`
  const params = new URLSearchParams()
  if (opts.storefrontAccessToken) {
    params.set('access_token', opts.storefrontAccessToken)
  }
  if (opts.channelHandle) {
    // Channel-created attribution definition handle (Shopify format).
    params.set('source_name', `channel:${opts.channelHandle}`)
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * Resolve the guest “Book on Shopify” URL for a synced workshop variant.
 * Prefer attributed cart permalink; allow book_url metafield only when it stays on Shopify checkout.
 */
export function resolveShopifyBookUrl(opts: {
  shopDomain: string
  variantId: string
  productMeta: Record<string, string>
  variantMeta: Record<string, string>
  storefrontAccessToken?: string | null
  channelHandle?: string | null
  bookUrlMetafieldKey?: string
}): string {
  const key = opts.bookUrlMetafieldKey ?? 'book_url'
  const override =
    opts.variantMeta[key]?.trim() || opts.productMeta[key]?.trim() || ''
  if (override && isAllowedShopifyCheckoutUrl(override, opts.shopDomain)) {
    return override
  }
  // Reject off-Shopify overrides (Phase 3 App Store requirement).
  return buildOffhrsCartPermalink({
    shopDomain: opts.shopDomain,
    variantId: opts.variantId,
    quantity: 1,
    storefrontAccessToken: opts.storefrontAccessToken,
    channelHandle: opts.channelHandle,
  })
}
