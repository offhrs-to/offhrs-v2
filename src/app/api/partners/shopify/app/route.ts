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
 * Shopify App URL entry (App Store / Admin “Open app”).
 *
 * After install, Shopify sends merchants here with ?shop=&hmac=&host=&timestamp=
 * (not an OAuth code). We verify HMAC and start OAuth immediately (App Store 2.3.2),
 * even if the merchant is not signed into offhrs yet. Partner linking happens in
 * the OAuth callback / claim step.
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

  // Optional: if already signed in as a vendor, bake vendorId into state for a
  // one-step link after authorize. Never block OAuth on login.
  let vendorId: string | undefined
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const admin = createAdminClient()
      if (admin) {
        const { data: vendor } = await admin
          .from('vendor_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()
        if (vendor?.id) vendorId = vendor.id
      }
    }
  } catch {
    // Ignore session lookup failures — still start OAuth.
  }

  const redirectUri = `${base}/api/partners/shopify/callback`
  const state = signOAuthState({
    ...(vendorId ? { vendorId } : {}),
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
