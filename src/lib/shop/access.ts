import type { SupabaseClient } from '@supabase/supabase-js'
import {
  vendorHasMarketplaceStripeEntitlement,
  vendorHasNativePartnerPlan,
} from '@/lib/partner-access'

export type VendorMarketplaceAccessRow = {
  id: string
  marketplace_enabled: boolean | null
}

/**
 * Marketplace access:
 * - Pro / Full License Stripe (auto-included), or
 * - Free Marketplace enroll (`marketplace_enabled` + `marketplace_plan = free`).
 * Lite does **not** include Marketplace (even if old included flags remain).
 */
export async function vendorHasMarketplaceAccess(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  if (await vendorHasMarketplaceStripeEntitlement(admin, vendorId)) return true

  const { data } = await admin
    .from('vendor_profiles')
    .select('marketplace_enabled, marketplace_plan')
    .eq('id', vendorId)
    .maybeSingle()

  return Boolean(data?.marketplace_enabled && data.marketplace_plan === 'free')
}

/** Ensure Pro/Full vendors have marketplace flags when they first use the tab. */
export async function ensureMarketplaceIncludedFlags(
  admin: SupabaseClient,
  vendorId: string
): Promise<void> {
  const included = await vendorHasMarketplaceStripeEntitlement(admin, vendorId)
  if (!included) return

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

/** @deprecated Prefer vendorHasMarketplaceStripeEntitlement — kept for call-site clarity. */
export async function vendorNativePlanIncludesMarketplace(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  return vendorHasMarketplaceStripeEntitlement(admin, vendorId)
}

/** True if vendor has any Stripe workshop plan (Lite/Pro/Full). */
export async function vendorHasWorkshopOrFullPlan(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  return vendorHasNativePartnerPlan(admin, vendorId)
}
