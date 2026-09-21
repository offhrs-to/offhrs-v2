import { NextRequest, NextResponse } from 'next/server'
import { normalizeShopDomain, shopDomainFromHostParam } from '@/lib/shopify/shop-domain'
import {
  extractShopifySessionToken,
  verifyShopifySessionToken,
} from '@/lib/shopify/session-token'
import { setChannelShopCookie } from '@/lib/shopify/channel-session-cookie'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Bootstrap sticky channel auth from a Shopify Admin ID token.
 * App Bridge may inject Authorization on this request even when the client
 * could not resolve shopify.idToken() explicitly.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { shop?: string; host?: string }
  const shop =
    normalizeShopDomain(body.shop) ??
    shopDomainFromHostParam(body.host) ??
    normalizeShopDomain(request.nextUrl.searchParams.get('shop')) ??
    shopDomainFromHostParam(request.nextUrl.searchParams.get('host'))

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop', reason: 'missing_shop' }, { status: 400 })
  }

  const token = extractShopifySessionToken(request)
  if (!token) {
    const res = NextResponse.json(
      {
        error: 'Open this app from Shopify Admin, or sign in to offhrs.',
        reason: 'missing_token',
      },
      { status: 401 }
    )
    res.headers.set('X-Shopify-Retry-Invalid-Session-Request', '1')
    return res
  }

  const session = verifyShopifySessionToken(token, { expectedShop: shop })
  if (!session) {
    const res = NextResponse.json(
      {
        error: 'Open this app from Shopify Admin, or sign in to offhrs.',
        reason: 'invalid_token',
      },
      { status: 401 }
    )
    res.headers.set('X-Shopify-Retry-Invalid-Session-Request', '1')
    return res
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const { data: shopRow } = await admin
    .from('vendor_shopify_shops')
    .select('shop_domain')
    .eq('shop_domain', session.shop)
    .maybeSingle()

  if (!shopRow) {
    return NextResponse.json(
      { error: 'Connect your offhrs account first.', reason: 'not_linked' },
      { status: 403 }
    )
  }

  const res = NextResponse.json({ ok: true, shop: session.shop })
  setChannelShopCookie(res, session.shop)
  return res
}
