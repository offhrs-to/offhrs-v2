import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifyOAuthState } from '@/lib/oauth-state'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import { shopifyChannelRedirect, redirectToShopifyAdminApp } from '@/lib/shopify/channel-home'
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
import { bootstrapOffhrsChannelFeeds } from '@/lib/shopify/bootstrap-channel'

async function finalizeShopLink(opts: {
  request: NextRequest
  admin: NonNullable<ReturnType<typeof createAdminClient>>
  base: string
  vendorId: string
  shop: string
  host?: string
  tokens: ShopifyAccessTokenResult
  popup?: boolean
}): Promise<NextResponse> {
  const { request, admin, base, vendorId, shop, host, tokens, popup } = opts

  const { data: existingShop } = await admin
    .from('vendor_shopify_shops')
    .select('vendor_id')
    .eq('shop_domain', shop)
    .maybeSingle()
  if (existingShop && existingShop.vendor_id !== vendorId) {
    return shopifyChannelRedirect(request, {
      shop,
      host,
      popup,
      query: 'shopify_error=shop_already_linked',
    })
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

  await admin.from('shopify_pending_installs').delete().eq('shop_domain', shop)

  // Close the connect popup immediately — webhooks/bootstrap can finish in the background.
  if (popup) {
    void (async () => {
      try {
        await ensureShopifyWebhooks({
          shop,
          accessToken: tokens.access_token,
          callbackBaseUrl: base,
        })
        const shopRow = await loadShopifyShopForVendor(admin, vendorId)
        if (!shopRow) return
        const { data: vendor } = await admin
          .from('vendor_profiles')
          .select('business_name')
          .eq('id', vendorId)
          .maybeSingle()
        const billingOk = shopifyBillingAllowsSync({
          billingStatus: shopRow.billing_status,
          shopDomain: shopRow.shop_domain,
        })
        await bootstrapOffhrsChannelFeeds(admin, shopRow, {
          accountName: vendor?.business_name,
          triggerFullSync: billingOk,
        })
        if (billingOk) {
          await syncShopifyWorkshopsForShop(admin, shopRow)
        }
      } catch (e) {
        console.error('[shopify] post-link background setup', e)
      }
    })()

    return shopifyChannelRedirect(request, {
      shop,
      host,
      popup: true,
      query: 'shopify_connected=1',
    })
  }

  await ensureShopifyWebhooks({
    shop,
    accessToken: tokens.access_token,
    callbackBaseUrl: base,
  }).catch((e) => console.error('[shopify] webhook register', e))

  const shopRow = await loadShopifyShopForVendor(admin, vendorId)
  if (shopRow) {
    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('id', vendorId)
      .maybeSingle()

    const billingOk = shopifyBillingAllowsSync({
      billingStatus: shopRow.billing_status,
      shopDomain: shopRow.shop_domain,
    })

    await bootstrapOffhrsChannelFeeds(admin, shopRow, {
      accountName: vendor?.business_name,
      triggerFullSync: billingOk,
    }).catch((e) => console.error('[shopify] channel bootstrap', e))

    if (billingOk) {
      await syncShopifyWorkshopsForShop(admin, shopRow).catch((e) =>
        console.error('[shopify] initial sync', e)
      )
    }
  }

  // Always return into Shopify Admin (automated install check + 2.3.3).
  return redirectToShopifyAdminApp(request, {
    shop,
    host,
    query: 'shopify_connected=1',
    apiKey: shopifyApiKey(),
  })
}

export async function GET(request: NextRequest) {
  const base = shopifyOAuthAppBase(request)
  const clientId = shopifyApiKey()
  const clientSecret = shopifyApiSecret()
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/shopify?shopify_error=not_configured`)
  }

  const url = new URL(request.url)
  const err = url.searchParams.get('error')
  if (err) {
    return NextResponse.redirect(
      `${base}/shopify?shopify_error=${encodeURIComponent(err)}`
    )
  }

  if (!verifyShopifyOAuthHmac(url.searchParams, clientSecret)) {
    return NextResponse.redirect(`${base}/shopify?shopify_error=invalid_hmac`)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const shop = normalizeShopDomain(url.searchParams.get('shop'))
  if (!code || !state || !shop) {
    return NextResponse.redirect(`${base}/shopify?shopify_error=missing_params`)
  }

  const payload = verifyOAuthState(state)
  if (!payload || payload.provider !== 'shopify' || payload.shop !== shop) {
    return NextResponse.redirect(`${base}/shopify?shopify_error=invalid_state`)
  }
  const host = payload.host
  const popup = Boolean(payload.popup)

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
    return shopifyChannelRedirect(request, {
      shop,
      host,
      popup,
      query: `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`,
    })
  }

  const admin = createAdminClient()
  if (!admin) {
    return shopifyChannelRedirect(request, {
      shop,
      host,
      popup,
      query: 'shopify_error=server',
    })
  }

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

  if (payload.vendorId && vendorId && payload.vendorId !== vendorId) {
    return shopifyChannelRedirect(request, {
      shop,
      host,
      popup,
      query: 'shopify_error=vendor_mismatch',
    })
  }
  if (payload.vendorId && vendorId === payload.vendorId) {
    try {
      return await finalizeShopLink({
        request,
        admin,
        base,
        vendorId,
        shop,
        host,
        tokens,
        popup,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'oauth_failed'
      console.error('[shopify] callback link', e)
      return shopifyChannelRedirect(request, {
        shop,
        host,
        popup,
        query: `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`,
      })
    }
  }

  if (vendorId) {
    try {
      return await finalizeShopLink({
        request,
        admin,
        base,
        vendorId,
        shop,
        host,
        tokens,
        popup,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'oauth_failed'
      console.error('[shopify] callback link', e)
      return shopifyChannelRedirect(request, {
        shop,
        host,
        popup,
        query: `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`,
      })
    }
  }

  // Not signed in: persist tokens, then land in Admin. Partner login happens via
  // AccountConnection popup (sales-channel flow) — never redirect to /partners/login here.
  try {
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

      return redirectToShopifyAdminApp(request, {
        shop,
        host,
        popup,
        query: 'shopify_connected=1',
        apiKey: shopifyApiKey(),
      })
    }

    await upsertShopifyPendingInstall(admin, { shopDomain: shop, tokens })
    await ensureShopifyWebhooks({
      shop,
      accessToken: tokens.access_token,
      callbackBaseUrl: base,
    }).catch((e) => console.error('[shopify] webhook register', e))

    return redirectToShopifyAdminApp(request, {
      shop,
      host,
      popup,
      query: 'shopify_installed=1',
      apiKey: shopifyApiKey(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth_failed'
    console.error('[shopify] pending install', e)
    return redirectToShopifyAdminApp(request, {
      shop,
      host,
      popup,
      query: `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`,
      apiKey: shopifyApiKey(),
    })
  }
}
