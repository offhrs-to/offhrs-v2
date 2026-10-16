import { SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS, SHOP_SNAD_RETURN_DAYS } from '@/lib/shop/fees'
import { CURRENT_POLICY_VERSION } from '@/lib/legal-acceptances-client'

export const SHOP_SUPPORT_EMAIL = 'hello@offhrs.app'
export const SHOP_TERMS_OF_USE_URL = 'https://offhrs.app/terms/terms-of-use'
export const SHOP_SELLER_ADDENDUM_URL = 'https://offhrs.app/terms/marketplace-seller-addendum'

export type SellerDisclosureAddress = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country?: string | null
}

/** Prefer ship-from (fulfillment address) over freeform location for buyer-facing identity. */
export function formatSellerDisclosureAddress(parts: {
  shipFrom?: SellerDisclosureAddress | null
  locationAddress?: string | null
}): string | null {
  const s = parts.shipFrom
  if (s?.line1?.trim() && s.city?.trim() && s.province?.trim() && s.postal_code?.trim()) {
    const cityLine = [s.city.trim(), s.province.trim(), s.postal_code.trim().toUpperCase()]
      .filter(Boolean)
      .join(', ')
    return [s.line1.trim(), s.line2?.trim() || null, cityLine, (s.country?.trim() || 'CA').toUpperCase()]
      .filter(Boolean)
      .join('\n')
  }
  const loc = parts.locationAddress?.trim()
  return loc || null
}

export function shopCancelReturnDisclosure(params: {
  fulfillmentType: 'ship' | 'pickup'
  buyerRemorseReturns: boolean
  snadDays?: number
}): string {
  const snad = params.snadDays ?? SHOP_SNAD_RETURN_DAYS
  const cancel =
    params.fulfillmentType === 'pickup'
      ? 'You may cancel for a full refund before pickup is completed, when permitted by the platform.'
      : 'You may cancel for a full refund before the carrier First Scan (when the label can still be voided). After First Scan, cancellation of the paid order is generally blocked.'
  const remorse = params.buyerRemorseReturns
    ? "Buyer's-remorse returns may be available as disclosed by the seller."
    : "This listing does not accept buyer's-remorse returns."
  const snadLine = `Damaged or significantly not-as-described goods: report within ${snad} days of delivery or pickup via Profile → Orders or ${SHOP_SUPPORT_EMAIL}.`
  return `${cancel} ${remorse} ${snadLine}`
}

export function shopDeliveryDisclosure(params: {
  fulfillmentType: 'ship' | 'pickup'
  shipByDays?: number | null
  madeToOrder?: boolean
  pickupHours?: string | null
}): string {
  if (params.fulfillmentType === 'pickup') {
    const hours = params.pickupHours?.trim()
    return hours
      ? `Local pickup. Coordinate with the seller. Hours: ${hours}`
      : 'Local pickup. Coordinate timing with the seller in Profile → Orders.'
  }
  const days = params.shipByDays ?? SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS
  const mto = params.madeToOrder ? ' (made-to-order window as disclosed at checkout)' : ''
  return `Ships within Canada via Canada Post. Seller ships within ${days} business days of payment${mto}. Carrier delivery estimates are not guaranteed.`
}

export function currentShopTermsVersion(): string {
  return CURRENT_POLICY_VERSION
}
