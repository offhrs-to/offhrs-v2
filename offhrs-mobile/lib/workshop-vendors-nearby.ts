import { haversineKm } from '@/lib/distance';
import { getCategoryMasterImageSource } from '@/lib/category-master-images';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';

export type VendorNearbyRow = {
  vendor_id: string;
  name: string;
  distanceKm: number;
  image_url: string | null;
  category: string | null;
};

/**
 * Aggregate upcoming events by vendor; distance = min haversine to anchor among events with coords.
 */
export function buildVendorNearbyList(
  events: WorkshopEventRow[],
  vendorNames: Record<string, string>,
  anchor: { lat: number; lng: number }
): VendorNearbyRow[] {
  const byVendor = new Map<
    string,
    { minKm: number; image_url: string | null; category: string | null }
  >();

  for (const e of events) {
    if (!e.vendor_id || e.lat == null || e.lng == null) continue;
    if (Number.isNaN(Number(e.lat)) || Number.isNaN(Number(e.lng))) continue;
    const km = haversineKm(anchor.lat, anchor.lng, Number(e.lat), Number(e.lng));
    const prev = byVendor.get(e.vendor_id);
    if (!prev) {
      byVendor.set(e.vendor_id, {
        minKm: km,
        image_url: e.image_url,
        category: e.category,
      });
    } else {
      if (km < prev.minKm) prev.minKm = km;
      if (!prev.image_url && e.image_url) {
        prev.image_url = e.image_url;
        prev.category = e.category;
      }
    }
  }

  const rows: VendorNearbyRow[] = [];
  for (const [vendor_id, v] of byVendor) {
    rows.push({
      vendor_id,
      name: vendorNames[vendor_id] ?? 'Vendor',
      distanceKm: v.minKm,
      image_url: v.image_url,
      category: v.category,
    });
  }
  rows.sort((a, b) => a.distanceKm - b.distanceKm);
  return rows;
}

export function getVendorThumbSource(row: VendorNearbyRow): { uri: string } | number {
  if (row.image_url) return { uri: row.image_url };
  return getCategoryMasterImageSource(row.category);
}
