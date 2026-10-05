/** Partner SaaS display pricing (CAD). Stripe Price IDs must match in Dashboard + env. */

export const PARTNER_TRIAL_DAYS = 30

export const PARTNER_TRIAL_LABEL = '30-day free trial'
export const PARTNER_TRIAL_LABEL_LONG = '30-day free trial included'

/**
 * Stripe-billed partner plans (workshops / Full License).
 * Marketplace-only Free and Shopify Sync–only bill separately (no Stripe / Shopify App Billing).
 */
export const PARTNER_PLAN_MONTHLY_CAD = {
  lite: 29,
  pro: 39,
  full: 59,
} as const

export type PartnerPlanTier = keyof typeof PARTNER_PLAN_MONTHLY_CAD

/** Artist Marketplace platform fee (bps). See src/lib/shop/fees.ts */
export { SHOP_PLATFORM_FEE_BPS } from '@/lib/shop/fees'

/** Free Artist Marketplace (no monthly SaaS fee; 5% + Stripe on goods). */
export const MARKETPLACE_FREE_MONTHLY_CAD = 0
export const MARKETPLACE_FREE_PLAN_NAME = 'Marketplace Only'

/** Standalone Shopify Sync plan — Shopify App Pricing (handle: offhrs-sync), not Stripe. */
export const SHOPIFY_SYNC_MONTHLY_CAD = 29
export const SHOPIFY_SYNC_PLAN_NAME = 'Shopify Sync'
/** Must match Partners → public plan “Internal plan handle”. */
export const SHOPIFY_SYNC_PLAN_HANDLE = 'offhrs-sync'
export const SHOPIFY_SYNC_TRIAL_DAYS = PARTNER_TRIAL_DAYS
export const SHOPIFY_SYNC_PLAN_LABEL = `$${SHOPIFY_SYNC_MONTHLY_CAD} CAD/month`
export const SHOPIFY_SYNC_PLAN_LABEL_WITH_TRIAL = `${SHOPIFY_SYNC_PLAN_LABEL} · ${PARTNER_TRIAL_LABEL}`

export const FULL_LICENSE_PLAN_NAME = 'Full License'

export function formatPartnerMonthlyAmount(tier: PartnerPlanTier): string {
  return `$${PARTNER_PLAN_MONTHLY_CAD[tier]}`
}

export function formatPartnerMonthlyPriceLabel(tier: PartnerPlanTier): string {
  return `$${PARTNER_PLAN_MONTHLY_CAD[tier]} CAD/month`
}

export function formatPartnerPlansFromLine(): string {
  return (
    `${formatPartnerMonthlyPriceLabel('lite')} (Lite), ` +
    `${formatPartnerMonthlyPriceLabel('pro')} (Pro), or ` +
    `${formatPartnerMonthlyPriceLabel('full')} (Full License)`
  )
}

/** Display order for marketing / signup. */
export const PARTNER_PLAN_DISPLAY_ORDER: PartnerPlanTier[] = ['lite', 'pro', 'full']

export function partnerPlanIncludesMarketplace(tier: PartnerPlanTier | string | null | undefined): boolean {
  return tier === 'pro' || tier === 'full'
}

export function partnerPlanIncludesShopifySync(tier: PartnerPlanTier | string | null | undefined): boolean {
  return tier === 'full'
}

export function partnerPlanIncludesWorkshops(tier: PartnerPlanTier | string | null | undefined): boolean {
  return tier === 'lite' || tier === 'pro' || tier === 'full'
}
