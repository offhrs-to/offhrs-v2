import { compareWorkshopEventsByStart } from '@/lib/workshop-event-sort';
import { workshopIsSaasVendorEvent } from '@/lib/workshop-event-utils';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';

export type WorkshopPriceSort = 'default' | 'price_high' | 'price_low';

/** Numeric CAD price for sorting; `null` when unknown or unparseable. */
export function workshopSortPriceCad(e: {
  price_cad?: number | null;
  price?: number | string | null;
  vendor_profile_id?: string | null;
}): number | null {
  if (workshopIsSaasVendorEvent(e)) {
    const n = e.price_cad != null ? Number(e.price_cad) : NaN;
    if (!Number.isNaN(n)) return n;
    return null;
  }
  if (e.price == null) return null;
  if (typeof e.price === 'number' && !Number.isNaN(e.price)) return e.price;
  const cleaned = String(e.price).replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

export function sortWorkshopGroupsByPrice(
  groups: WorkshopEventRow[][],
  priceSort: WorkshopPriceSort
): WorkshopEventRow[][] {
  const sorted = [...groups];
  if (priceSort === 'default') {
    sorted.sort((a, b) => compareWorkshopEventsByStart(a[0]!, b[0]!));
    return sorted;
  }

  sorted.sort((a, b) => {
    const pa = workshopSortPriceCad(a[0]!);
    const pb = workshopSortPriceCad(b[0]!);
    const aUnknown = pa == null;
    const bUnknown = pb == null;
    if (aUnknown && bUnknown) return compareWorkshopEventsByStart(a[0]!, b[0]!);
    if (aUnknown) return 1;
    if (bUnknown) return -1;
    const diff = priceSort === 'price_high' ? pb! - pa! : pa! - pb!;
    if (diff !== 0) return diff;
    return compareWorkshopEventsByStart(a[0]!, b[0]!);
  });

  return sorted;
}
