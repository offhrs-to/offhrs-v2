import type { SupabaseClient } from '@supabase/supabase-js'
import { vendorHasNativePartnerPlan } from '@/lib/partner-access'

export type VendorMarketplaceAccessRow = {
  id: string
  marketplace_enabled: boolean | null
}

/**
 * Lite/Pro always have Marketplace included.
 * Marketplace-free (and Sync + free) use marketplace_enabled.
 */
export async function vendorHasMarketplaceAccess(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  if (await vendorHasNativePartnerPlan(admin, vendorId)) return true

  const { data } = await admin
    .from('vendor_profiles')
    .select('marketplace_enabled')
    .eq('id', vendorId)
    .maybeSingle()

  return Boolean(data?.marketplace_enabled)
}

/** Ensure Lite/Pro vendors have marketplace flags set when they first use the tab. */
export async function ensureMarketplaceIncludedFlags(
  admin: SupabaseClient,
  vendorId: string
): Promise<void> {
  const hasNative = await vendorHasNativePartnerPlan(admin, vendorId)
  if (!hasNative) return

  const { data } = await admin
    .from('vendor_profiles')
    .select('marketplace_enabled, marketplace_plan, marketplace_qa_status')
    .eq('id', vendorId)
    .maybeSingle()

  if (!data) return

  const patch: Record<string, unknown> = {}
  if (!data.marketplace_enabled) patch.marketplace_enabled = true
  if (data.marketplace_plan !== 'included' && data.marketplace_plan !== 'free') {
    patch.marketplace_plan = 'included'
  }
  if (!data.marketplace_qa_status || data.marketplace_qa_status === 'not_started') {
    patch.marketplace_qa_status = 'pending_review'
  }
  if (!Object.keys(patch).length) return

  patch.updated_at = new Date().toISOString()
  if (!data.marketplace_enabled) {
    patch.marketplace_enrolled_at = new Date().toISOString()
  }

  await admin.from('vendor_profiles').update(patch).eq('id', vendorId)
}
