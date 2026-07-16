import { getTorontoYmd, normalizeCalendarYmd } from '@/lib/workshop-timezone'

export type WorkshopSalePriceFields = {
  price_cad?: number | string | null
  sale_price_cad?: number | string | null
  sale_starts_on?: string | null
  sale_ends_on?: string | null
}

/**
 * True when today (America/Toronto) falls within the optional sale date window.
 * Missing start = already started; missing end = no end date.
 */
export function isSaleDateWindowActive(
  event: Pick<WorkshopSalePriceFields, 'sale_starts_on' | 'sale_ends_on'>,
  now: Date = new Date()
): boolean {
  const today = getTorontoYmd(now)
  const start = event.sale_starts_on?.trim().slice(0, 10) || null
  const end = event.sale_ends_on?.trim().slice(0, 10) || null
  if (start && today < start) return false
  if (end && today > end) return false
  return true
}

/**
 * Effective ticket subtotal in CAD for checkout / payouts.
 * Uses sale_price_cad when it is a valid discount below the list price and the sale window is active.
 */
export function effectiveWorkshopPriceCad(
  event: WorkshopSalePriceFields,
  now: Date = new Date()
): number {
  const base = Number(event.price_cad ?? 0)
  const list = Number.isFinite(base) && base >= 0 ? base : 0
  if (event.sale_price_cad == null || event.sale_price_cad === '') return list
  if (!isSaleDateWindowActive(event, now)) return list
  const sale = Number(event.sale_price_cad)
  if (!Number.isFinite(sale) || sale < 0) return list
  if (sale < list) return sale
  return list
}

/** True when a sale price is active (strictly below list price) and within the sale window. */
export function workshopHasActiveSale(
  event: WorkshopSalePriceFields,
  now: Date = new Date()
): boolean {
  const base = Number(event.price_cad ?? 0)
  if (!Number.isFinite(base) || base <= 0) return false
  if (event.sale_price_cad == null || event.sale_price_cad === '') return false
  if (!isSaleDateWindowActive(event, now)) return false
  const sale = Number(event.sale_price_cad)
  return Number.isFinite(sale) && sale >= 0 && sale < base
}

/** Normalize / validate sale_price_cad against list price for partner create/update. */
export function normalizeSalePriceCad(
  priceCad: number,
  salePriceCad: number | null | undefined
): number | null {
  if (salePriceCad == null) return null
  if (!Number.isFinite(salePriceCad) || salePriceCad < 0) return null
  if (priceCad <= 0) return null
  if (salePriceCad >= priceCad) {
    throw new Error('Sale price must be less than the regular price.')
  }
  return salePriceCad
}

/**
 * Normalize partner sale window. When a sale price is set, an end date is required.
 * Returns nulls when there is no sale.
 */
export function normalizeSaleDateWindow(opts: {
  hasSalePrice: boolean
  saleStartsOn?: string | null
  saleEndsOn?: string | null
}): { sale_starts_on: string | null; sale_ends_on: string | null } {
  if (!opts.hasSalePrice) {
    return { sale_starts_on: null, sale_ends_on: null }
  }
  const start = normalizeCalendarYmd(opts.saleStartsOn)
  const end = normalizeCalendarYmd(opts.saleEndsOn)
  if (!end) {
    throw new Error('Choose when the sale ends.')
  }
  if (start && start > end) {
    throw new Error('Sale start date must be on or before the end date.')
  }
  return { sale_starts_on: start, sale_ends_on: end }
}
