import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  normalizeShopDomain,
  shopDomainFromHostParam,
  shopifyApiKey,
  shopifyApiSecret,
  verifyShopifyOAuthHmac,
} from '@/lib/shopify/admin-client'
import { mintChannelShopCookieFromIdToken } from '@/lib/shopify/channel-session-cookie'
import { ShopifyChannelHome } from './ShopifyChannelHome'

export const metadata: Metadata = {
  title: 'offhrs',
  robots: { index: false, follow: false },
}

/**
 * Embedded Shopify Admin home (Sales Channel).
 * App URL in shopify.app.toml → https://offhrs.app/shopify
 *
 * When Shopify sends hmac (install / open), bootstrap OAuth via the existing app route.
 * When Shopify sends id_token, mint a partitioned channel cookie on this HTML response
 * so Sync/Disconnect work without waiting on App Bridge idToken() in the client.
 */
export default async function ShopifyAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const asString = (v: string | string[] | undefined) =>
    typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined

  const host = asString(params.host) ?? ''
  const shop =
    normalizeShopDomain(asString(params.shop)) ?? shopDomainFromHostParam(host) ?? ''
  const hmac = asString(params.hmac)
  const idToken = asString(params.id_token) ?? null
  const apiKey = shopifyApiKey() ?? ''
  const clientSecret = shopifyApiSecret()

  if (hmac && shop && clientSecret) {
    const sp = new URLSearchParams()
    for (const [key, raw] of Object.entries(params)) {
      const val = asString(raw)
      if (val != null) sp.set(key, val)
    }
    if (!sp.get('shop')) sp.set('shop', shop)
    if (verifyShopifyOAuthHmac(sp, clientSecret)) {
      redirect(`/api/partners/shopify/app?${sp.toString()}`)
    }
  }

  if (idToken && shop) {
    await mintChannelShopCookieFromIdToken({ idToken, shop }).catch(() => false)
  }

  return (
    <ShopifyChannelHome
      apiKey={apiKey}
      shop={shop}
      host={host}
      idTokenQuery={idToken}
      connectedQuery={asString(params.shopify_connected) ?? null}
      billingQuery={asString(params.shopify_billing) ?? null}
      errorQuery={asString(params.shopify_error) ?? null}
    />
  )
}
