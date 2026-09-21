import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { signOAuthState } from '@/lib/oauth-state'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import { getChannelRequestUser } from '@/lib/shopify/channel-auth'
import {
  normalizeShopDomain,
  shopifyApiKey,
  shopifyAuthorizeUrl,
  shopifyOauthScopes,
} from '@/lib/shopify/admin-client'
import { loadShopifyShopByDomain } from '@/lib/shopify/sync-workshops'
import { shopifyPopupDoneUrl } from '@/lib/shopify/channel-home'
import { loadShopifyPendingByShopDomain } from '@/lib/shopify/pending-install'
import { claimPendingInstallForVendor } from '@/lib/shopify/claim-pending-install'

/**
 * Start Shopify OAuth for AccountConnection (re)connect from a signed-in partner.
 * If this shop is already linked to the signed-in partner, skip OAuth and close the popup.
 * If a pending install exists from App Store OAuth, claim it instead of re-authorizing.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    shop?: string
    host?: string
    popup?: boolean
  }
  const shop = normalizeShopDomain(body.shop)
  if (!shop) {
    return NextResponse.json({ error: 'Missing shop' }, { status: 400 })
  }

  const clientId = shopifyApiKey()
  if (!clientId) {
    return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 })
  }

  const user = await getChannelRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Sign in to offhrs first.' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, business_name')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!vendor) {
    return NextResponse.json({ error: 'Partner account required.' }, { status: 403 })
  }

  const existing = await loadShopifyShopByDomain(admin, shop)
  if (existing && existing.vendor_id !== vendor.id) {
    return NextResponse.json(
      { error: 'This shop is already linked to another offhrs account.' },
      { status: 409 }
    )
  }

  const host = typeof body.host === 'string' ? body.host : undefined
  const popup = body.popup !== false
  const base = shopifyOAuthAppBase(request)

  // Already linked to this partner — only need the session cookie in the Admin iframe.
  if (existing && existing.vendor_id === vendor.id) {
    if (popup) {
      return NextResponse.json({
        doneUrl: shopifyPopupDoneUrl(request, {
          shop,
          host,
          query: 'shopify_connected=1',
        }),
      })
    }
    return NextResponse.json({ alreadyLinked: true })
  }

  // App Store install already stored offline tokens — claim without a second OAuth.
  const pending = await loadShopifyPendingByShopDomain(admin, shop)
  if (pending) {
    const result = await claimPendingInstallForVendor({
      admin,
      vendorId: vendor.id,
      businessName: vendor.business_name,
      shopDomain: shop,
      callbackBaseUrl: base,
      pending,
    })
    if (result.claimed) {
      if (popup) {
        return NextResponse.json({
          doneUrl: shopifyPopupDoneUrl(request, {
            shop,
            host,
            query: 'shopify_connected=1',
          }),
        })
      }
      return NextResponse.json({ alreadyLinked: true })
    }
    if (result.reason === 'shop_already_linked') {
      return NextResponse.json(
        { error: 'This shop is already linked to another offhrs account.' },
        { status: 409 }
      )
    }
  }

  const redirectUri = `${base}/api/partners/shopify/callback`
  const state = signOAuthState({
    vendorId: vendor.id,
    provider: 'shopify',
    shop,
    ...(host ? { host } : {}),
    popup,
    exp: Date.now() + 15 * 60 * 1000,
  })

  const authorizeUrl = shopifyAuthorizeUrl({
    shop,
    clientId,
    scopes: shopifyOauthScopes(),
    redirectUri,
    state,
  })

  return NextResponse.json({ authorizeUrl })
}
