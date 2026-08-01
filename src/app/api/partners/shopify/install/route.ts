import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { signOAuthState } from '@/lib/oauth-state'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import {
  normalizeShopDomain,
  shopifyApiKey,
  shopifyAuthorizeUrl,
  shopifyOauthScopes,
} from '@/lib/shopify/admin-client'

/**
 * Start Shopify OAuth. Query: `shop` = store.myshopify.com (or store name).
 * Redirects the partner browser to Shopify authorize.
 */
export async function GET(request: NextRequest) {
  const clientId = shopifyApiKey()
  if (!clientId) {
    return NextResponse.json({ error: 'Shopify OAuth is not configured' }, { status: 503 })
  }

  const shop = normalizeShopDomain(request.nextUrl.searchParams.get('shop'))
  if (!shop) {
    return NextResponse.json(
      { error: 'Valid shop domain required (e.g. your-store.myshopify.com)' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const base = shopifyOAuthAppBase(request)
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
