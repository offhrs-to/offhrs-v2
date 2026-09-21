import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { shopifyBillingAllowsSync } from '@/lib/shopify/billing'
import { bootstrapOffhrsChannelFeeds } from '@/lib/shopify/bootstrap-channel'
import {
  loadShopifyShopForVendor,
  syncPublishedChannelProductsForShop,
  syncShopifyWorkshopsForShop,
} from '@/lib/shopify/sync-workshops'

/** Manual / full product sync for the connected shop. Requires active Sync billing. */
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
    return NextResponse.json({ error: 'Shopify not connected' }, { status: 404 })
  }

  if (
    !shopifyBillingAllowsSync({
      billingStatus: shop.billing_status,
      shopDomain: shop.shop_domain,
    })
  ) {
    return NextResponse.json(
      {
        error:
          'Shopify Sync plan required. Open Shopify Admin → Sales channels → offhrs to start the trial, then try again.',
        billing_status: shop.billing_status ?? 'none',
      },
      { status: 402 }
    )
  }

  try {
    // Prefer publish-to-channel sync; tag pull only when channel is not connected yet.
    if (shop.shopify_channel_gid) {
      await bootstrapOffhrsChannelFeeds(admin, shop, {
        accountName: null,
        triggerFullSync: false,
      }).catch(() => undefined)
      const published = await syncPublishedChannelProductsForShop(admin, shop)
      return NextResponse.json({
        success: true,
        ...published,
        source: 'published_channel',
      })
    }

    const result = await syncShopifyWorkshopsForShop(admin, shop)
    return NextResponse.json({ success: true, ...result, source: 'legacy_tag' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    console.error('[shopify] sync', e)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
