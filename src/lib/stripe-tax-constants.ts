/** Stripe product tax code — override via STRIPE_WORKSHOP_TAX_CODE (general services default). */
export const WORKSHOP_STRIPE_TAX_CODE =
  process.env.STRIPE_WORKSHOP_TAX_CODE?.trim() || 'txcd_20030000'
