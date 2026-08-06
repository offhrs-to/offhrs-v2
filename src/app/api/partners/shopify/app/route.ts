import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { signOAuthState } from '@/lib/oauth-state'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import {
  normalizeShopDomain,
  shopifyApiKey,
  shopifyApiSecret,
  shopifyAuthorizeUrl,
  shopifyOauthScopes,
  verifyShopifyOAuthHmac,
} from '@/lib/shopify/admin-client'

/**
 * Shopify App URL entry (custom distribution / "Open app").
 *
 * After install, Shopify sends merchants here with ?shop=&hmac=&host=&timestamp=
 * (not an OAuth code). We verify the HMAC, then start the legacy authorize →
 * /api/partners/shopify/callback flow so the access token is saved to offhrs.
 *
 * Set Shopify App URL to: https://offhrs.app/api/partners/shopify/app
 */
export async function GET(request: NextRequest) {
  const base = shopifyOAuthAppBase(request)
  const clientId = shopifyApiKey()
  const clientSecret = shopifyApiSecret()
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/partners/dashboard/settings?shopify_error=not_configured`)
  }

  const params = request.nextUrl.searchParams
  if (!verifyShopifyOAuthHmac(params, clientSecret)) {
    return NextResponse.redirect(`${base}/partners/dashboard/settings?shopify_error=invalid_hmac`)
  }

  const shop = normalizeShopDomain(params.get('shop'))
  if (!shop) {
    return NextResponse.redirect(`${base}/partners/dashboard/settings?shopify_error=missing_shop`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const login = new URL(`${base}/partners/login`)
    login.searchParams.set('shopify_shop', shop)
    login.searchParams.set('next', `/api/partners/shopify/install?shop=${encodeURIComponent(shop)}`)
    return NextResponse.redirect(login.toString())
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.redirect(`${base}/partners/dashboard/settings?shopify_error=server`)
  }

  const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()
  if (!vendor) {
    return NextResponse.redirect(`${base}/partners/login?shopify_error=vendor_required`)
  }

  const redirectUri = `${base}/api/partners/shopify/callback`
  const state = signOAuthState({
    vendorId: vendor.id,
    provider: 'shopify',
    shop,
    exp: Date.now() + 15 * 60 * 1000,
  })

  const url = shopifyAuthorizeUrl({
    shop,
    clientId,
    scopes: shopifyOauthScopes(),
    redirectUri,
    state,
  })
  return NextResponse.redirect(url)
}
