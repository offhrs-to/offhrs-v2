import 'server-only'

import {
  formatPartnerMonthlyPriceLabel,
  PARTNER_PLAN_MONTHLY_CAD,
  PARTNER_TRIAL_DAYS,
  type PartnerPlanTier,
} from '@/lib/partner-pricing'

export { PARTNER_TRIAL_DAYS }

/**
 * Max concurrently active (non-archived) workshops for Lite vendors.
 * Archived workshops do not count, so vendors can free a slot by archiving.
 */
export const LITE_MAX_WORKSHOP_SESSIONS_PER_BILLING_PERIOD = 4

export type PartnerSubscriptionTier = PartnerPlanTier

export type PartnerCheckoutPlan = PartnerSubscriptionTier

/** Pro price id: prefer STRIPE_PRO_PRICE_ID, then legacy env names. */
export function getStripeProPriceId(): string {
  const id =
    process.env.STRIPE_PRO_PRICE_ID?.trim() ||
    process.env.STRIPE_STANDARD_PRO_ID?.trim() ||
    process.env.STRIPE_STANDARD_PRICE_ID?.trim() ||
    ''
  return id
}

export function getStripeLitePriceId(): string {
  return process.env.STRIPE_LITE_PRICE_ID?.trim() ?? ''
}

export function stripePriceIdForCheckoutPlan(plan: PartnerCheckoutPlan): string {
  const lite = getStripeLitePriceId()
  const pro = getStripeProPriceId()
  if (plan === 'lite') {
    if (!lite) throw new Error('STRIPE_LITE_PRICE_ID is not configured')
    return lite
  }
  if (!pro) throw new Error('STRIPE_PRO_PRICE_ID (or legacy STRIPE_STANDARD_PRO_ID / STRIPE_STANDARD_PRICE_ID) is not configured')
  return pro
}

export function subscriptionTierFromStripePriceId(priceId: string | null | undefined): PartnerSubscriptionTier {
  if (!priceId) return 'pro'
  if (priceId === getStripeLitePriceId()) return 'lite'
  return 'pro'
}

export function monthlyAmountLabelForTier(tier: PartnerSubscriptionTier): string {
  return formatPartnerMonthlyPriceLabel(tier)
}

export function monthlyCadForTier(tier: PartnerSubscriptionTier): number {
  return PARTNER_PLAN_MONTHLY_CAD[tier]
}
