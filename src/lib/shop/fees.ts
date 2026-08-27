/**
 * Artist Marketplace platform fee (Phase 0 lock).
 * 5% of item subtotal (ex-tax, ex-shipping) + Stripe processing recouped separately.
 */
export const SHOP_PLATFORM_FEE_BPS = Number(
  process.env.SHOP_PLATFORM_FEE_BPS?.trim() || '500'
)

/** High-value threshold (CAD): auto signature + full insurance on labels. */
export const SHOP_HIGH_VALUE_INSURANCE_CAD = Number(
  process.env.SHOP_HIGH_VALUE_INSURANCE_CAD?.trim() || '250'
)

/** Default ship-by SLA in business days. */
export const SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS = 5

/** Day to send automated ship reminder (1-indexed business days after pay). */
export const SHOP_SHIP_REMINDER_BUSINESS_DAY = 3

/** Damaged / SNAD return window in calendar days from delivery. */
export const SHOP_SNAD_RETURN_DAYS = 14

export function shopPlatformFeeCents(itemSubtotalCents: number): number {
  if (!Number.isFinite(itemSubtotalCents) || itemSubtotalCents <= 0) return 0
  const bps = Number.isFinite(SHOP_PLATFORM_FEE_BPS) ? SHOP_PLATFORM_FEE_BPS : 500
  return Math.round((itemSubtotalCents * bps) / 10_000)
}
