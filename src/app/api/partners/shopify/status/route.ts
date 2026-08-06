import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { shopifyBillingAllowsSync, isShopifySyncCompedShop } from '@/lib/shopify/billing'
import { SHOPIFY_SYNC_PLAN_LABEL, SHOPIFY_SYNC_MONTHLY_CAD } from '@/lib/partner-pricing'

/** Connection + Sync billing status for partner Settings UI. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const { data: shop } = await admin
    .from('vendor_shopify_shops')
    .select(
      'shop_domain, scope, sync_enabled, last_synced_at, installed_at, billing_status, billing_confirmed_at, app_subscription_gid'
    )
    .eq('vendor_id', vendor.id)
    .maybeSingle()

  if (!shop) {
    return NextResponse.json({
      connected: false,
      plan_label: SHOPIFY_SYNC_PLAN_LABEL,
      plan_amount_cad: SHOPIFY_SYNC_MONTHLY_CAD,
    })
  }

  const { count } = await admin
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_profile_id', vendor.id)
    .eq('listing_source', 'shopify')
    .neq('booking_status', 'archived')

  const billingActive = shopifyBillingAllowsSync({
    billingStatus: shop.billing_status,
    shopDomain: shop.shop_domain,
  })

  return NextResponse.json({
    connected: true,
    shop_domain: shop.shop_domain,
    scope: shop.scope,
    sync_enabled: shop.sync_enabled,
    last_synced_at: shop.last_synced_at,
    installed_at: shop.installed_at,
    synced_session_count: count ?? 0,
    billing_status: shop.billing_status ?? 'none',
    billing_active: billingActive,
    billing_confirmed_at: shop.billing_confirmed_at,
    billing_comped: isShopifySyncCompedShop(shop.shop_domain),
    plan_label: SHOPIFY_SYNC_PLAN_LABEL,
    plan_amount_cad: SHOPIFY_SYNC_MONTHLY_CAD,
  })
}
