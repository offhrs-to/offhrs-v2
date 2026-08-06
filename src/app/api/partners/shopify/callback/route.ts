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
  type ShopifyAccessTokenResult,
} from '@/lib/shopify/admin-client'
import { upsertShopifyPendingInstall } from '@/lib/shopify/pending-install'
import { shopifyBillingAllowsSync } from '@/lib/shopify/billing'
import {
  ensureShopifyWebhooks,
  syncShopifyWorkshopsForShop,
  upsertVendorShopifyShop,
  loadShopifyShopForVendor,
} from '@/lib/shopify/sync-workshops'

function settingsRedirect(base: string, query: string): NextResponse {
  return NextResponse.redirect(`${base}/partners/dashboard/settings?${query}`)
}

async function finalizeShopLink(opts: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>
  base: string
  vendorId: string
  shop: string
  tokens: ShopifyAccessTokenResult
}): Promise<NextResponse> {
  const { admin, base, vendorId, shop, tokens } = opts

  const { data: existingShop } = await admin
    .from('vendor_shopify_shops')
    .select('vendor_id')
    .eq('shop_domain', shop)
    .maybeSingle()
  if (existingShop && existingShop.vendor_id !== vendorId) {
    return settingsRedirect(base, 'shopify_error=shop_already_linked')
  }

  await upsertVendorShopifyShop(admin, {
    vendorId,
    shopDomain: shop,
    accessToken: tokens.access_token,
    scope: tokens.scope,
    expiresIn: tokens.expires_in,
    refreshToken: tokens.refresh_token,
    refreshTokenExpiresIn: tokens.refresh_token_expires_in,
  })

  await ensureShopifyWebhooks({
    shop,
    accessToken: tokens.access_token,
    callbackBaseUrl: base,
  }).catch((e) => console.error('[shopify] webhook register', e))

  const shopRow = await loadShopifyShopForVendor(admin, vendorId)
  if (
    shopRow &&
    shopifyBillingAllowsSync({
      billingStatus: shopRow.billing_status,
      shopDomain: shopRow.shop_domain,
    })
  ) {
    await syncShopifyWorkshopsForShop(admin, shopRow).catch((e) =>
      console.error('[shopify] initial sync', e)
    )
  }

  await admin.from('shopify_pending_installs').delete().eq('shop_domain', shop)

  return settingsRedirect(base, 'shopify_connected=1')
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

  let tokens: ShopifyAccessTokenResult
  try {
    tokens = await exchangeShopifyAccessToken({
      shop,
      clientId,
      clientSecret,
      code,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth_failed'
    console.error('[shopify] token exchange', e)
    return settingsRedirect(base, `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`)
  }

  const admin = createAdminClient()
  if (!admin) return settingsRedirect(base, 'shopify_error=server')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let vendorId: string | null = null
  if (user) {
    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    vendorId = vendor?.id ?? null
  }

  // Prefer state vendorId when it matches the signed-in vendor.
  if (payload.vendorId && vendorId && payload.vendorId !== vendorId) {
    return settingsRedirect(base, 'shopify_error=vendor_mismatch')
  }
  if (payload.vendorId && vendorId === payload.vendorId) {
    try {
      return await finalizeShopLink({ admin, base, vendorId, shop, tokens })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'oauth_failed'
      console.error('[shopify] callback link', e)
      return settingsRedirect(base, `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`)
    }
  }

  if (vendorId) {
    try {
      return await finalizeShopLink({ admin, base, vendorId, shop, tokens })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'oauth_failed'
      console.error('[shopify] callback link', e)
      return settingsRedirect(base, `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`)
    }
  }

  // Not signed in: keep tokens pending, then send merchant to partner login to claim.
  try {
    // If this shop is already linked, refresh tokens on the existing row and ask them to sign in.
    const { data: existingShop } = await admin
      .from('vendor_shopify_shops')
      .select('vendor_id')
      .eq('shop_domain', shop)
      .maybeSingle()

    if (existingShop?.vendor_id) {
      await upsertVendorShopifyShop(admin, {
        vendorId: existingShop.vendor_id,
        shopDomain: shop,
        accessToken: tokens.access_token,
        scope: tokens.scope,
        expiresIn: tokens.expires_in,
        refreshToken: tokens.refresh_token,
        refreshTokenExpiresIn: tokens.refresh_token_expires_in,
      })
      await ensureShopifyWebhooks({
        shop,
        accessToken: tokens.access_token,
        callbackBaseUrl: base,
      }).catch((e) => console.error('[shopify] webhook register', e))

      const login = new URL(`${base}/partners/login`)
      login.searchParams.set('next', '/partners/dashboard/settings')
      return NextResponse.redirect(login.toString())
    }

    const { claimToken } = await upsertShopifyPendingInstall(admin, { shopDomain: shop, tokens })
    const login = new URL(`${base}/partners/login`)
    login.searchParams.set(
      'next',
      `/api/partners/shopify/claim?token=${encodeURIComponent(claimToken)}`
    )
    return NextResponse.redirect(login.toString())
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth_failed'
    console.error('[shopify] pending install', e)
    return settingsRedirect(base, `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`)
  }
}
