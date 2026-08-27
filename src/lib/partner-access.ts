import type { SupabaseClient } from '@supabase/supabase-js'

/** Lite/Pro Stripe subscription statuses that unlock the full partner dashboard. */
export const NATIVE_PARTNER_SUB_STATUSES = ['trialing', 'active', 'past_due'] as const

export type NativePartnerSubStatus = (typeof NATIVE_PARTNER_SUB_STATUSES)[number]

export function isNativePartnerSubscriptionStatus(
  status: string | null | undefined
): status is NativePartnerSubStatus {
  return (
    status === 'trialing' || status === 'active' || status === 'past_due'
  )
}

/**
 * True when the vendor has an active Lite or Pro Stripe subscription.
 * Shopify Sync alone does not count — Sync-only partners get a thinner dashboard.
 */
export async function vendorHasNativePartnerPlan(
  admin: SupabaseClient,
  vendorId: string
): Promise<boolean> {
  const { data } = await admin
    .from('vendor_subscriptions')
    .select('subscription_tier, status')
    .eq('vendor_id', vendorId)
    .in('status', [...NATIVE_PARTNER_SUB_STATUSES])
    .in('subscription_tier', ['lite', 'pro'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Boolean(data)
}

/** Dashboard routes available without Lite/Pro (Shopify Sync–only surface). */
export function isSyncOnlyAllowedDashboardPath(pathname: string): boolean {
  if (pathname === '/partners/dashboard' || pathname === '/partners/dashboard/') return true
  if (pathname.startsWith('/partners/dashboard/settings')) return true
  if (pathname.startsWith('/partners/dashboard/faq')) return true
  return false
}

/**
 * Marketplace-free vendors (no Lite/Pro): Overview, Marketplace, Settings, FAQ.
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

/** Routes that require Lite/Pro — Sync-only / Marketplace-only vendors are redirected away. */
export function isNativeOnlyDashboardPath(pathname: string): boolean {
  return (
    pathname.startsWith('/partners/dashboard/sessions') ||
    pathname.startsWith('/partners/dashboard/calendar') ||
    pathname.startsWith('/partners/dashboard/bookings') ||
    pathname.startsWith('/partners/dashboard/clients') ||
    pathname.startsWith('/partners/dashboard/payouts')
  )
}
