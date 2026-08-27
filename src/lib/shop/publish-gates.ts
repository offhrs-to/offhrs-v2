/**
 * Marketplace seller readiness + publish gates (Phase 1).
 * Checkout/labels are Phase 2–3; this only unlocks catalog publish.
 */

export type MarketplaceQaStatus =
  | 'not_started'
  | 'pending_review'
  | 'approved'
  | 'rejected'

export type VendorMarketplaceShipFields = {
  ship_from_name: string | null
  ship_from_line1: string | null
  ship_from_city: string | null
  ship_from_province: string | null
  ship_from_postal_code: string | null
  ship_from_country: string | null
  canada_ship_attested_at: string | null
  marketplace_qa_status: MarketplaceQaStatus | string | null
}

const CA_POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i

export function isCanadianPostalCode(raw: string | null | undefined): boolean {
  return Boolean(raw && CA_POSTAL.test(raw.trim()))
}

export function hasCompleteShipFrom(v: VendorMarketplaceShipFields): boolean {
  const country = (v.ship_from_country ?? 'CA').trim().toUpperCase()
  if (country !== 'CA') return false
  return Boolean(
    v.ship_from_name?.trim() &&
      v.ship_from_line1?.trim() &&
      v.ship_from_city?.trim() &&
      v.ship_from_province?.trim() &&
      isCanadianPostalCode(v.ship_from_postal_code)
  )
}

export function hasCanadaShipAttestation(v: VendorMarketplaceShipFields): boolean {
  return Boolean(v.canada_ship_attested_at)
}

export function isMarketplaceQaApproved(v: VendorMarketplaceShipFields): boolean {
  return v.marketplace_qa_status === 'approved'
}

/** Reasons a product cannot move to `published`. Empty = ok. */
export function marketplacePublishBlockers(v: VendorMarketplaceShipFields): string[] {
  const blockers: string[] = []
  if (!hasCompleteShipFrom(v)) {
    blockers.push('Add a complete Canada ship-from address in Marketplace shipping settings.')
  }
  if (!hasCanadaShipAttestation(v)) {
    blockers.push('Confirm the Canada-only shipping attestation.')
  }
  if (!isMarketplaceQaApproved(v)) {
    if (v.marketplace_qa_status === 'rejected') {
      blockers.push('Seller review was not approved. Contact support before publishing.')
    } else {
      blockers.push('Seller review is pending — you can save drafts until approved.')
    }
  }
  return blockers
}

export function canPublishShopProducts(v: VendorMarketplaceShipFields): boolean {
  return marketplacePublishBlockers(v).length === 0
}
