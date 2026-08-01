import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  loadShopifyShopForVendor,
  syncShopifyWorkshopsForShop,
} from '@/lib/shopify/sync-workshops'

/** Manual / full product sync for the connected shop. */
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

  try {
    const result = await syncShopifyWorkshopsForShop(admin, shop)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    console.error('[shopify] sync', e)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
