/** Partner SaaS display pricing (CAD). Stripe Price IDs must match in Dashboard + env. */

export const PARTNER_TRIAL_DAYS = 30

export const PARTNER_TRIAL_LABEL = '30-day free trial'
export const PARTNER_TRIAL_LABEL_LONG = '30-day free trial included'

export const PARTNER_PLAN_MONTHLY_CAD = {
  lite: 29,
  pro: 49,
} as const

export type PartnerPlanTier = keyof typeof PARTNER_PLAN_MONTHLY_CAD

export function formatPartnerMonthlyAmount(tier: PartnerPlanTier): string {
  return `$${PARTNER_PLAN_MONTHLY_CAD[tier]}`
}

export function formatPartnerMonthlyPriceLabel(tier: PartnerPlanTier): string {
  return `$${PARTNER_PLAN_MONTHLY_CAD[tier]} CAD/month`
}

export function formatPartnerPlansFromLine(): string {
  return `${formatPartnerMonthlyPriceLabel('lite')} (Lite) or ${formatPartnerMonthlyPriceLabel('pro')} (Pro)`
}
