/** Partner-hosted (SaaS) listing — book in-app with Stripe, not only external link. */
export function workshopIsSaasVendorEvent(e: { vendor_profile_id?: string | null }): boolean {
  return e.vendor_profile_id != null && String(e.vendor_profile_id).length > 0;
}

/** Published SaaS session with no remaining spots (hide book / grey out). */
export function workshopEventIsFull(e: {
  vendor_profile_id?: string | null;
  booking_status?: string | null;
  available_slots?: number | null;
}): boolean {
  if (!workshopIsSaasVendorEvent(e)) return false;
  if (e.booking_status === 'fully_booked') return true;
  const slots = e.available_slots;
  return slots != null && slots <= 0;
}

/** Price line for cards and quick view (CAD for SaaS, legacy `price` otherwise). */
export function workshopDisplayPrice(e: {
  price_cad?: number | null;
  price?: number | string | null;
  vendor_profile_id?: string | null;
}): string | null {
  if (workshopIsSaasVendorEvent(e)) {
    const n = e.price_cad != null ? Number(e.price_cad) : NaN;
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
