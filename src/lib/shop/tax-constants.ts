/**
 * Stripe Tax product code for tangible personal property (Artist Marketplace goods).
 * Override via STRIPE_SHOP_GOODS_TAX_CODE. Default is Stripe's general tangible goods code —
 * confirm in Stripe Tax dashboard before production remittance.
 *
 * @see https://stripe.com/docs/tax/tax-codes
 */
export const SHOP_GOODS_STRIPE_TAX_CODE =
  process.env.STRIPE_SHOP_GOODS_TAX_CODE?.trim() || 'txcd_99999999'

export { WORKSHOP_STRIPE_TAX_CODE } from '@/lib/stripe-tax-constants'
