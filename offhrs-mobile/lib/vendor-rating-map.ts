import { supabase } from '@/lib/supabase';

export type VendorRatingSummary = { avg: number; count: number };

const CHUNK = 100;

/**
 * Average rating and review count per vendor from vendor_reviews.
 */
export async function fetchVendorRatingMap(vendorIds: string[]): Promise<Record<string, VendorRatingSummary>> {
  const unique = [...new Set(vendorIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const sums = new Map<string, { sum: number; count: number }>();

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('vendor_reviews')
      .select('vendor_id, rating')
      .in('vendor_id', chunk);
    if (error || !data) continue;
    for (const row of data) {
      const vid = row.vendor_id as string;
      const rating = Number(row.rating);
      if (!vid || Number.isNaN(rating)) continue;
      const prev = sums.get(vid) ?? { sum: 0, count: 0 };
      prev.sum += rating;
      prev.count += 1;
      sums.set(vid, prev);
    }
  }

  const out: Record<string, VendorRatingSummary> = {};
  for (const [vid, { sum, count }] of sums) {
    out[vid] = { avg: Math.round((sum / count) * 10) / 10, count };
  }
  return out;
}
