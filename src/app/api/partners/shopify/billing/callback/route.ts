import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
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
  loadShopifyShopForVendor,
  syncShopifyWorkshopsForShop,
} from '@/lib/shopify/sync-workshops'

function settingsRedirect(base: string, query: string): NextResponse {
  return NextResponse.redirect(`${base}/partners/dashboard/settings?${query}`)
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
  const shopRow = await loadShopifyShopForVendor(opts.admin, opts.vendorId)
  if (shopRow) {
    await syncShopifyWorkshopsForShop(opts.admin, shopRow).catch((e) =>
      console.error('[shopify] post-billing sync', e)
    )
  }
}

/**
 * Welcome / return URL after merchant selects App Pricing plan (or Billing API charge).
 * App Pricing appends `plan_handle` + `shop`.
 */
export async function GET(request: NextRequest) {
  const base = shopifyOAuthAppBase(request)
  const planHandle = request.nextUrl.searchParams.get('plan_handle')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const login = new URL(`${base}/partners/login`)
    const next = `/api/partners/shopify/billing/callback${request.nextUrl.search}`
    login.searchParams.set('next', next)
    return NextResponse.redirect(login.toString())
  }

  const admin = createAdminClient()
  if (!admin) return settingsRedirect(base, 'shopify_error=server')

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!vendor) return settingsRedirect(base, 'shopify_error=vendor_required')

  const shop = await loadShopifyShopForVendor(admin, vendor.id)
  if (!shop) return settingsRedirect(base, 'shopify_error=not_connected')

  try {
    const accessToken = await getValidShopAccessToken(admin, shop)

    // App Pricing welcome redirect: plan_handle=offhrs-sync
    if (isShopifySyncPlanHandle(planHandle)) {
      const refreshed = await refreshShopifyBillingFromAdmin({
        admin,
        shopId: shop.id,
        vendorId: vendor.id,
        shopDomain: shop.shop_domain,
        accessToken,
      })
      // During trial / App Pricing, Admin may briefly lag — still treat known plan as entitled.
      if (refreshed !== 'active') {
        await persistShopifyBillingStatus(admin, shop.id, {
          billingStatus: 'active',
          appSubscriptionGid: shop.app_subscription_gid ?? null,
        })
        await ensureVendorActiveForShopifySync(admin, vendor.id)
      }
      await activateSyncAfterBilling({
        admin,
        base,
        vendorId: vendor.id,
        shopDomain: shop.shop_domain,
        accessToken,
      })
      return settingsRedirect(base, 'shopify_billing=active')
    }

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
          await activateSyncAfterBilling({
            admin,
            base,
            vendorId: vendor.id,
            shopDomain: shop.shop_domain,
            accessToken,
          })
          return settingsRedirect(base, 'shopify_billing=active')
        }
        if (status === 'declined') {
          return settingsRedirect(base, 'shopify_billing=declined')
        }
      }
    }

    const refreshed = await refreshShopifyBillingFromAdmin({
      admin,
      shopId: shop.id,
      vendorId: vendor.id,
      shopDomain: shop.shop_domain,
      accessToken,
    })

    if (refreshed === 'active') {
      await activateSyncAfterBilling({
        admin,
        base,
        vendorId: vendor.id,
        shopDomain: shop.shop_domain,
        accessToken,
      })
      return settingsRedirect(base, 'shopify_billing=active')
    }

    return settingsRedirect(base, `shopify_billing=${encodeURIComponent(refreshed)}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'billing_callback_failed'
    console.error('[shopify] billing callback', e)
    return settingsRedirect(base, `shopify_error=${encodeURIComponent(msg.slice(0, 120))}`)
  }
}
