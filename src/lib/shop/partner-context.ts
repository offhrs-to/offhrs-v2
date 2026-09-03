import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ensureMarketplaceIncludedFlags,
  vendorHasMarketplaceAccess,
} from '@/lib/shop/access'
import { createAdminClient } from '@/lib/supabase/admin'

export const MARKETPLACE_VENDOR_SELECT =
  'id, user_id, business_name, marketplace_enabled, ship_from_name, ship_from_line1, ship_from_line2, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country, ship_from_phone, canada_ship_attested_at, marketplace_qa_status, shop_pickup_enabled'

export async function resolveMarketplaceVendor(userId: string) {
  const admin = createAdminClient()
  if (!admin) return { admin: null, vendor: null, error: 'Server error' as const }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select(MARKETPLACE_VENDOR_SELECT)
    .eq('user_id', userId)
    .maybeSingle()

  if (!vendor) return { admin, vendor: null, error: 'Vendor not found' as const }

  await ensureMarketplaceIncludedFlags(admin, vendor.id)

  const hasAccess = await vendorHasMarketplaceAccess(admin, vendor.id)
  if (!hasAccess) return { admin, vendor: null, error: 'Marketplace access required' as const }

  const { data: refreshed } = await admin
    .from('vendor_profiles')
    .select(MARKETPLACE_VENDOR_SELECT)
    .eq('id', vendor.id)
    .single()

  return { admin, vendor: refreshed ?? vendor, error: null }
}

export async function loadVendorShopOrder(
  admin: SupabaseClient,
  vendorId: string,
  orderId: string
) {
  return admin.from('shop_orders').select('*').eq('id', orderId).eq('vendor_id', vendorId).maybeSingle()
}
