import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  createShopifySyncSubscription,
  persistShopifyBillingStatus,
  shopifyBillingAllowsSync,
} from '@/lib/shopify/billing'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'
import {
  getValidShopAccessToken,
  loadShopifyShopForVendor,
} from '@/lib/shopify/sync-workshops'
import { SHOPIFY_SYNC_PLAN_LABEL_WITH_TRIAL } from '@/lib/partner-pricing'
import { NextRequest } from 'next/server'

/**
 * Start Shopify Sync via Billing API (appSubscriptionCreate → confirmation URL).
 * Merchants accept/decline the charge in Shopify Admin; return hits billing/callback.
 * Satisfies App Store 1.2.2 (accept, decline, re-request after uninstall/reinstall).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const shop = await loadShopifyShopForVendor(admin, vendor.id)
  if (!shop) {
    return NextResponse.json({ error: 'Connect Shopify before subscribing to Sync.' }, { status: 400 })
  }

  if (shopifyBillingAllowsSync({ billingStatus: shop.billing_status, shopDomain: shop.shop_domain })) {
    return NextResponse.json({
      already_active: true,
      billing_status: 'active',
      plan: SHOPIFY_SYNC_PLAN_LABEL_WITH_TRIAL,
    })
  }

  try {
    const accessToken = await getValidShopAccessToken(admin, shop)
    const base = shopifyOAuthAppBase(request)
    const returnUrl = `${base}/api/partners/shopify/billing/callback`

    const { confirmationUrl, subscriptionGid, test } = await createShopifySyncSubscription({
      shop: shop.shop_domain,
      accessToken,
      returnUrl,
    })

    await persistShopifyBillingStatus(admin, shop.id, {
      billingStatus: 'pending',
      appSubscriptionGid: subscriptionGid,
    })

    return NextResponse.json({
      confirmation_url: confirmationUrl,
      billing_status: 'pending',
      plan: SHOPIFY_SYNC_PLAN_LABEL_WITH_TRIAL,
      pricing: 'billing_api',
      test_charge: test,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Subscribe failed'
    console.error('[shopify] subscribe', e)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
