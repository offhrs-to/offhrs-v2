import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifyOAuthState } from '@/lib/oauth-state'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import {
  exchangeShopifyAccessToken,
  normalizeShopDomain,
  shopifyApiKey,
  shopifyApiSecret,
  verifyShopifyOAuthHmac,
} from '@/lib/shopify/admin-client'
import {
  ensureShopifyWebhooks,
  syncShopifyWorkshopsForShop,
  upsertVendorShopifyShop,
  loadShopifyShopForVendor,
} from '@/lib/shopify/sync-workshops'

function settingsRedirect(base: string, query: string): NextResponse {
  return NextResponse.redirect(`${base}/partners/dashboard/settings?${query}`)
}

export async function GET(request: NextRequest) {
  const base = shopifyOAuthAppBase(request)
  const clientId = shopifyApiKey()
  const clientSecret = shopifyApiSecret()
  if (!clientId || !clientSecret) {
    return settingsRedirect(base, 'shopify_error=not_configured')
  }

  const url = new URL(request.url)
  const err = url.searchParams.get('error')
  if (err) {
    return settingsRedirect(base, `shopify_error=${encodeURIComponent(err)}`)
  }

  if (!verifyShopifyOAuthHmac(url.searchParams, clientSecret)) {
    return settingsRedirect(base, 'shopify_error=invalid_hmac')
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const shop = normalizeShopDomain(url.searchParams.get('shop'))
  if (!code || !state || !shop) {
    return settingsRedirect(base, 'shopify_error=missing_params')
  }

  const payload = verifyOAuthState(state)
  if (!payload || payload.provider !== 'shopify' || payload.shop !== shop) {
    return settingsRedirect(base, 'shopify_error=invalid_state')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${base}/partners/login`)
  }

  const admin = createAdminClient()
  if (!admin) return settingsRedirect(base, 'shopify_error=server')

  const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()
  if (!vendor || vendor.id !== payload.vendorId) {
    return settingsRedirect(base, 'shopify_error=vendor_mismatch')
  }

  try {
    const tokens = await exchangeShopifyAccessToken({
      shop,
      clientId,
      clientSecret,
      code,
    })

    // Guard: shop already linked to a different vendor
    const { data: existingShop } = await admin
      .from('vendor_shopify_shops')
      .select('vendor_id')
      .eq('shop_domain', shop)
      .maybeSingle()
    if (existingShop && existingShop.vendor_id !== vendor.id) {
      return settingsRedirect(base, 'shopify_error=shop_already_linked')
    }

    await upsertVendorShopifyShop(admin, {
      vendorId: vendor.id,
      shopDomain: shop,
      accessToken: tokens.access_token,
      scope: tokens.scope,
    })

    await ensureShopifyWebhooks({
      shop,
      accessToken: tokens.access_token,
      callbackBaseUrl: base,
    }).catch((e) => console.error('[shopify] webhook register', e))

    const shopRow = await loadShopifyShopForVendor(admin, vendor.id)
    if (shopRow) {
      await syncShopifyWorkshopsForShop(admin, shopRow).catch((e) =>
        console.error('[shopify] initial sync', e)
      )
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth_failed'
    console.error('[shopify] callback', e)
    return settingsRedirect(base, `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`)
  }

  return settingsRedirect(base, 'shopify_connected=1')
}
