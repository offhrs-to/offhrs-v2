import type { SupabaseClient } from '@supabase/supabase-js'
import {
  partnerPlanIncludesMarketplace,
  partnerPlanIncludesShopifySync,
  partnerPlanIncludesWorkshops,
  type PartnerPlanTier,
} from '@/lib/partner-pricing'

/** Stripe subscription statuses that unlock partner entitlements. */
export const NATIVE_PARTNER_SUB_STATUSES = ['trialing', 'active', 'past_due'] as const

export type NativePartnerSubStatus = (typeof NATIVE_PARTNER_SUB_STATUSES)[number]

export function isNativePartnerSubscriptionStatus(
  status: string | null | undefined
): status is NativePartnerSubStatus {
  return status === 'trialing' || status === 'active' || status === 'past_due'
}

export type VendorSubscriptionEntitlement = {
  subscription_tier: PartnerPlanTier | string
  status: string
}

async function loadActiveVendorSubscription(
  admin: SupabaseClient,
  vendorId: string
): Promise<VendorSubscriptionEntitlement | null> {
  const { data } = await admin
    .from('vendor_subscriptions')
    .select('subscription_tier, status')
    .eq('vendor_id', vendorId)
    .in('status', [...NATIVE_PARTNER_SUB_STATUSES])
    .in('subscription_tier', ['lite', 'pro', 'full'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.subscription_tier) return null
  return {
    subscription_tier: data.subscription_tier,
    status: data.status,
  }
}

/**
 * True when the vendor has an active Lite, Pro, or Full License Stripe subscription.
 * Shopify Sync alone / Marketplace-only Free do not count.
 */
export async function vendorHasNativePartnerPlan(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  return Boolean(await loadActiveVendorSubscription(admin, vendorId))
}

/** Active Stripe tier, if any. */
export async function getVendorNativeSubscriptionTier(
  admin: SupabaseClient,
  vendorId: string
): Promise<PartnerPlanTier | null> {
  const row = await loadActiveVendorSubscription(admin, vendorId)
  if (!row) return null
  const tier = row.subscription_tier
  if (tier === 'lite' || tier === 'pro' || tier === 'full') return tier
  return null
}

/** Workshops dashboard (Lite / Pro / Full). */
export async function vendorHasWorkshopPlan(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  const tier = await getVendorNativeSubscriptionTier(admin, vendorId)
  return partnerPlanIncludesWorkshops(tier)
}

/** Marketplace included with Pro / Full (not Lite). */
export async function vendorHasMarketplaceStripeEntitlement(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  const tier = await getVendorNativeSubscriptionTier(admin, vendorId)
  return partnerPlanIncludesMarketplace(tier)
}

/** Full License comps Shopify Sync (no separate Shopify App charge required). */
export async function vendorHasFullLicensePlan(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  const tier = await getVendorNativeSubscriptionTier(admin, vendorId)
  return partnerPlanIncludesShopifySync(tier)
}

/** Dashboard routes available without Lite/Pro/Full (Shopify Sync–only surface). */
export function isSyncOnlyAllowedDashboardPath(pathname: string): boolean {
  if (pathname === '/partners/dashboard' || pathname === '/partners/dashboard/') return true
  if (pathname.startsWith('/partners/dashboard/settings')) return true
  if (pathname.startsWith('/partners/dashboard/faq')) return true
  return false
}

/**
 * Marketplace-free vendors (no workshop plan): Overview, Marketplace, Settings, FAQ.
 * Sync-only without Marketplace still uses {@link isSyncOnlyAllowedDashboardPath}.
 */
export function isMarketplaceOnlyAllowedDashboardPath(pathname: string): boolean {
  if (isSyncOnlyAllowedDashboardPath(pathname)) return true
  if (pathname.startsWith('/partners/dashboard/marketplace')) return true
  return false
}

export function isMarketplaceDashboardPath(pathname: string): boolean {
  return pathname.startsWith('/partners/dashboard/marketplace')
}

/** Routes that require a workshop plan (Lite/Pro/Full). */
export function isNativeOnlyDashboardPath(pathname: string): boolean {
  return (
    pathname.startsWith('/partners/dashboard/sessions') ||
    pathname.startsWith('/partners/dashboard/calendar') ||
    pathname.startsWith('/partners/dashboard/bookings') ||
    pathname.startsWith('/partners/dashboard/clients') ||
    pathname.startsWith('/partners/dashboard/payouts')
  )
}
