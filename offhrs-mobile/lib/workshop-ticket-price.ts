/**
 * Effective ticket subtotal in CAD for display sorting / free checks.
 * Checkout amounts come from the booking API (same rule server-side).
 */

function torontoYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export type WorkshopSalePriceFields = {
  price_cad?: number | string | null;
  sale_price_cad?: number | string | null;
  sale_starts_on?: string | null;
  sale_ends_on?: string | null;
};

export function isSaleDateWindowActive(
  event: Pick<WorkshopSalePriceFields, 'sale_starts_on' | 'sale_ends_on'>,
  now: Date = new Date()
): boolean {
  const today = torontoYmd(now);
  const start = event.sale_starts_on?.trim().slice(0, 10) || null;
  const end = event.sale_ends_on?.trim().slice(0, 10) || null;
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

export function effectiveWorkshopPriceCad(
  event: WorkshopSalePriceFields,
  now: Date = new Date()
): number {
  const base = Number(event.price_cad ?? 0);
  const list = Number.isFinite(base) && base >= 0 ? base : 0;
  if (event.sale_price_cad == null || event.sale_price_cad === '') return list;
  if (!isSaleDateWindowActive(event, now)) return list;
  const sale = Number(event.sale_price_cad);
  if (!Number.isFinite(sale) || sale < 0) return list;
  if (sale < list) return sale;
  return list;
}

/** True when a sale price is active (strictly below list price) and within the sale window. */
export function workshopHasActiveSale(
  event: WorkshopSalePriceFields,
  now: Date = new Date()
): boolean {
  const base = Number(event.price_cad ?? 0);
  if (!Number.isFinite(base) || base <= 0) return false;
  if (event.sale_price_cad == null || event.sale_price_cad === '') return false;
  if (!isSaleDateWindowActive(event, now)) return false;
  const sale = Number(event.sale_price_cad);
  return Number.isFinite(sale) && sale >= 0 && sale < base;
}
