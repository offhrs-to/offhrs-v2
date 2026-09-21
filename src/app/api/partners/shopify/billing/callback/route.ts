import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { shopifyApiKey, normalizeShopDomain } from '@/lib/shopify/admin-client'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import {
  shopifyAdminEmbeddedAppUrl,
  shopifyChannelRedirect,
} from '@/lib/shopify/channel-home'
import {
  ensureVendorActiveForShopifySync,
  fetchAppSubscriptionById,
  isShopifySyncPlanHandle,
  mapShopifySubscriptionStatus,
  persistShopifyBillingStatus,
  refreshShopifyBillingFromAdmin,
} from '@/lib/shopify/billing'
import {
  ensureShopifyWebhooks,
  getValidShopAccessToken,
  loadShopifyShopByDomain,
  syncPublishedChannelProductsForShop,
} from '@/lib/shopify/sync-workshops'
import { bootstrapOffhrsChannelFeeds } from '@/lib/shopify/bootstrap-channel'

/**
 * After billing approval Shopify redirects here top-level — often without a partner
 * session cookie (connect happened in a popup). Resolve the shop from `shop=` and
 * the offline token; do not require Supabase login.
 */
function billingReturnRedirect(request: NextRequest, shopDomain: string, query: string): NextResponse {
  const apiKey = shopifyApiKey()
  if (apiKey) {
    // Land back inside Admin so the embedded channel home reloads with session tokens.
    const adminUrl = shopifyAdminEmbeddedAppUrl(shopDomain, apiKey)
    // Stash status on our app URL via a short hop when Admin strip loses query params:
    // Admin will load application_url; channel home refreshes pending→active from Shopify.
    return NextResponse.redirect(adminUrl)
  }
  const host = request.nextUrl.searchParams.get('host')
  return shopifyChannelRedirect(request, { shop: shopDomain, host, query })
}

async function activateSyncAfterBilling(opts: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>
  base: string
  vendorId: string
  shopDomain: string
  accessToken: string
}): Promise<void> {
  await ensureVendorActiveForShopifySync(opts.admin, opts.vendorId)
  await ensureShopifyWebhooks({
    shop: opts.shopDomain,
    accessToken: opts.accessToken,
    callbackBaseUrl: opts.base,
  }).catch((e) => console.error('[shopify] webhook register', e))
  const shopRow = await loadShopifyShopByDomain(opts.admin, opts.shopDomain)
  if (shopRow) {
    const { data: vendor } = await opts.admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('id', opts.vendorId)
      .maybeSingle()
    await bootstrapOffhrsChannelFeeds(opts.admin, shopRow, {
      accountName: vendor?.business_name,
      triggerFullSync: true,
    }).catch((e) => console.error('[shopify] channel bootstrap', e))
    const fresh = await loadShopifyShopByDomain(opts.admin, opts.shopDomain)
    if (fresh?.shopify_channel_gid) {
      await syncPublishedChannelProductsForShop(opts.admin, fresh).catch((e) =>
        console.error('[shopify] post-billing sync', e)
      )
    }
  }
}

/**
 * Return URL after merchant accepts/declines Billing API charge (or App Pricing plan).
 * Billing API appends charge_id; App Pricing may append plan_handle + shop.
 */
export async function GET(request: NextRequest) {
  const base = shopifyOAuthAppBase(request)
  const planHandle = request.nextUrl.searchParams.get('plan_handle')
  const chargeId = request.nextUrl.searchParams.get('charge_id')
  const shopParam =
    normalizeShopDomain(request.nextUrl.searchParams.get('shop')) ??
    normalizeShopDomain(request.nextUrl.searchParams.get('shop_domain'))

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.redirect(`${base}/shopify?shopify_error=server`)
  }

  if (!shopParam) {
    return NextResponse.redirect(`${base}/shopify?shopify_error=missing_shop`)
  }

  const shop = await loadShopifyShopByDomain(admin, shopParam)
  if (!shop) {
    return NextResponse.redirect(
      `${base}/shopify?shop=${encodeURIComponent(shopParam)}&shopify_error=not_connected`
    )
  }

  try {
    const accessToken = await getValidShopAccessToken(admin, shop)

    const redirectActive = () => {
      void activateSyncAfterBilling({
        admin,
        base,
        vendorId: shop.vendor_id,
        shopDomain: shop.shop_domain,
        accessToken,
      }).catch((e) => console.error('[shopify] post-billing activate', e))
      return billingReturnRedirect(request, shop.shop_domain, 'shopify_billing=active')
    }

    // App Pricing welcome redirect: plan_handle=offhrs-sync
    if (isShopifySyncPlanHandle(planHandle)) {
      const refreshed = await refreshShopifyBillingFromAdmin({
        admin,
        shopId: shop.id,
        vendorId: shop.vendor_id,
        shopDomain: shop.shop_domain,
        accessToken,
      })
      if (refreshed !== 'active') {
        await persistShopifyBillingStatus(admin, shop.id, {
          billingStatus: 'active',
          appSubscriptionGid: shop.app_subscription_gid ?? null,
        })
        await ensureVendorActiveForShopifySync(admin, shop.vendor_id)
      }
      return redirectActive()
    }

    // Billing API return: prefer stored subscription GID, else refresh from Admin.
    if (shop.app_subscription_gid) {
      const sub = await fetchAppSubscriptionById({
        shop: shop.shop_domain,
        accessToken,
        subscriptionGid: shop.app_subscription_gid,
      })
      if (sub) {
        const status = mapShopifySubscriptionStatus(sub.status)
        await persistShopifyBillingStatus(admin, shop.id, {
          billingStatus: status,
          appSubscriptionGid: sub.id,
        })
        if (status === 'active') {
          return redirectActive()
        }
        if (status === 'declined') {
          return billingReturnRedirect(request, shop.shop_domain, 'shopify_billing=declined')
        }
      }
    }

    const refreshed = await refreshShopifyBillingFromAdmin({
      admin,
      shopId: shop.id,
      vendorId: shop.vendor_id,
      shopDomain: shop.shop_domain,
      accessToken,
    })

    if (refreshed === 'active') {
      return redirectActive()
    }

    // Merchant just approved; Admin list can lag — charge_id means they completed the confirm page.
    if (chargeId && (refreshed === 'pending' || refreshed === 'none')) {
      await persistShopifyBillingStatus(admin, shop.id, {
        billingStatus: 'active',
        appSubscriptionGid: shop.app_subscription_gid ?? null,
      })
      await ensureVendorActiveForShopifySync(admin, shop.vendor_id)
      return redirectActive()
    }

    if (chargeId) {
      await persistShopifyBillingStatus(admin, shop.id, {
        billingStatus: refreshed === 'none' ? 'declined' : refreshed,
        appSubscriptionGid: shop.app_subscription_gid ?? null,
      })
      return billingReturnRedirect(
        request,
        shop.shop_domain,
        `shopify_billing=${encodeURIComponent(refreshed === 'none' ? 'declined' : refreshed)}`
      )
    }

    return billingReturnRedirect(
      request,
      shop.shop_domain,
      `shopify_billing=${encodeURIComponent(refreshed)}`
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'billing_callback_failed'
    console.error('[shopify] billing callback', e)
    return billingReturnRedirect(
      request,
      shop.shop_domain,
      `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`
    )
  }
}
