import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  persistShopifyBillingStatus,
  shopifyAppPricingPlansUrl,
  shopifyBillingAllowsSync,
} from '@/lib/shopify/billing'
import { loadShopifyShopForVendor } from '@/lib/shopify/sync-workshops'
import { SHOPIFY_SYNC_PLAN_LABEL_WITH_TRIAL } from '@/lib/partner-pricing'

/**
 * Start Shopify Sync via App Pricing plan selection page.
 * Merchants pick/approve the `offhrs-sync` plan in Shopify Admin.
 */
export async function POST() {
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
    const confirmationUrl = shopifyAppPricingPlansUrl(shop.shop_domain)
    await persistShopifyBillingStatus(admin, shop.id, {
      billingStatus: 'pending',
      appSubscriptionGid: shop.app_subscription_gid ?? null,
    })

    return NextResponse.json({
      confirmation_url: confirmationUrl,
      billing_status: 'pending',
      plan: SHOPIFY_SYNC_PLAN_LABEL_WITH_TRIAL,
      pricing: 'app_pricing',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Subscribe failed'
    console.error('[shopify] subscribe', e)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
