import { isRegistrationClosedForSession } from '@/lib/workshop-registration-closed';
import { effectiveWorkshopPriceCad } from '@/lib/workshop-ticket-price';

/** Mirrored Shopify listing — book on Shopify storefront, not in-app Stripe. */
export function workshopBooksOnShopify(e: {
  listing_source?: string | null;
  shopify_product_id?: string | null;
}): boolean {
  if (e.listing_source === 'shopify') return true;
  return e.shopify_product_id != null && String(e.shopify_product_id).length > 0;
}

/** Partner-hosted (SaaS) listing — book in-app with Stripe, not only external link. */
export function workshopIsSaasVendorEvent(e: {
  vendor_profile_id?: string | null;
  listing_source?: string | null;
  shopify_product_id?: string | null;
}): boolean {
  if (workshopBooksOnShopify(e)) return false;
  return e.vendor_profile_id != null && String(e.vendor_profile_id).length > 0;
}

/** Published SaaS / Shopify session with no remaining spots (hide book / grey out). */
export function workshopEventIsFull(e: {
  vendor_profile_id?: string | null;
  listing_source?: string | null;
  shopify_product_id?: string | null;
  booking_status?: string | null;
  available_slots?: number | null;
  registration_closed?: boolean | null;
  date_iso?: string | null;
  workshop_series?: string | null;
  series_occurrences?: unknown;
  partner_series_meta?: unknown;
}): boolean {
  if (!workshopIsSaasVendorEvent(e) && !workshopBooksOnShopify(e)) return false;
  if (isRegistrationClosedForSession(e, e.date_iso)) return true;
  if (e.booking_status === 'fully_booked') return true;
  const slots = e.available_slots;
  return slots != null && slots <= 0;
}

/** Price line for cards and quick view (CAD for SaaS/Shopify, legacy `price` otherwise). Prefer sale when active. */
export function workshopDisplayPrice(e: {
  price_cad?: number | null;
  sale_price_cad?: number | null;
  price?: number | string | null;
  vendor_profile_id?: string | null;
  listing_source?: string | null;
  shopify_product_id?: string | null;
}): string | null {
  if (workshopIsSaasVendorEvent(e) || workshopBooksOnShopify(e)) {
    const n = effectiveWorkshopPriceCad(e);
    if (!Number.isNaN(n)) {
      if (n <= 0) return 'Free';
      return `$${n.toFixed(2)}`;
    }
  }
  if (e.price == null) return null;
  const s = typeof e.price === 'string' ? e.price.replace(/^\$/, '').trim() : String(e.price);
  if (s === '' || Number.isNaN(Number(s))) return null;
  return `$${s}`;
}

function formatSpotsAvailable(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return n === 1 ? '1 spot available' : `${n} spots available`;
}

/** Primary book CTA label (quick view, browse cards, event cards). */
export function workshopBookButtonLabel(e: {
  vendor_profile_id?: string | null;
  listing_source?: string | null;
  shopify_product_id?: string | null;
  booking_status?: string | null;
  available_slots?: number | null;
  registration_closed?: boolean | null;
  date_iso?: string | null;
  workshop_series?: string | null;
  series_occurrences?: unknown;
  partner_series_meta?: unknown;
}): string {
  if (isRegistrationClosedForSession(e, e.date_iso)) return 'Registration closed';
  if (workshopEventIsFull(e)) return 'Full';
  if (workshopBooksOnShopify(e)) {
    const slots = e.available_slots;
    if (slots != null && Number.isFinite(Number(slots))) {
      return `Book on Shopify - ${formatSpotsAvailable(Number(slots))}`;
    }
    return 'Book on Shopify';
  }
  if (!workshopIsSaasVendorEvent(e)) return 'Book on site';
  const slots = e.available_slots;
  if (slots != null && Number.isFinite(Number(slots))) {
    return `Book - ${formatSpotsAvailable(Number(slots))}`;
  }
  return 'Book';
}
