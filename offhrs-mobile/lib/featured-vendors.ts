import { haversineKm } from '@/lib/distance';
import { supabase } from '@/lib/supabase';

const FEATURED_DAYS = 30;
export const FEATURED_VENDORS_CAP = 10;

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'] as const;

export type FeaturedVendorItem = {
  vendorProfileId: string;
  /** Legacy `vendors.id` when resolvable; otherwise null (navigate via profile id). */
  legacyVendorId: string | null;
  businessName: string;
  imageUrl: string | null;
  /** Primary category for image fallback. */
  primaryCategory: string | null;
  /** Display string for signup categories. */
  categoriesLine: string | null;
  distanceKm: number | null;
};

type ProfileRow = {
  id: string;
  business_name: string | null;
  category: string[] | null;
  default_workshop_image_url: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
};

function formatCategoriesLine(cats: string[] | null | undefined): string | null {
  if (!cats || cats.length === 0) return null;
  const cleaned = cats.map((c) => String(c).trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  return cleaned.join(' · ');
}

/**
 * Active partners created in the last 30 days (newest first), capped at 10.
 * Distance is from the consumer's saved location to the vendor studio coords.
 */
export async function fetchFeaturedVendors(
  userAnchor?: { lat: number; lng: number } | null
): Promise<FeaturedVendorItem[]> {
  const since = new Date();
  since.setDate(since.getDate() - FEATURED_DAYS);
  const sinceIso = since.toISOString();

  const { data, error } = await supabase
    .from('vendor_profiles')
    .select(
      'id, business_name, category, default_workshop_image_url, location_lat, location_lng, created_at'
    )
    .in('status', [...ACTIVE_STATUSES])
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(FEATURED_VENDORS_CAP);

  if (error) {
    if (__DEV__) console.warn('fetchFeaturedVendors', error.message);
    throw error;
  }

  const rows = (data ?? []) as ProfileRow[];
  if (rows.length === 0) return [];

  const names = [
    ...new Set(rows.map((r) => r.business_name?.trim()).filter((n): n is string => Boolean(n))),
  ];

  const legacyByName = new Map<string, string>();
  if (names.length > 0) {
    await Promise.all(
      names.map(async (name) => {
        const { data: row } = await supabase
          .from('vendors')
          .select('id, name')
          .ilike('name', name)
          .limit(1)
          .maybeSingle();
        if (row?.id) {
          legacyByName.set(name.toLowerCase(), String(row.id));
        }
      })
    );
  }

  return rows.map((r) => {
    const name = r.business_name?.trim() || 'Partner studio';
    const cats = Array.isArray(r.category) ? r.category : null;
    let distanceKm: number | null = null;
    if (
      userAnchor &&
      r.location_lat != null &&
      r.location_lng != null &&
      Number.isFinite(Number(r.location_lat)) &&
      Number.isFinite(Number(r.location_lng))
    ) {
      distanceKm = haversineKm(
        userAnchor.lat,
        userAnchor.lng,
        Number(r.location_lat),
        Number(r.location_lng)
      );
    }
    return {
      vendorProfileId: r.id,
      legacyVendorId: legacyByName.get(name.toLowerCase()) ?? null,
      businessName: name,
      imageUrl: r.default_workshop_image_url?.trim() || null,
      primaryCategory: cats?.[0] ?? null,
      categoriesLine: formatCategoriesLine(cats),
      distanceKm:
        distanceKm != null && Number.isFinite(distanceKm)
          ? Math.round(distanceKm * 10) / 10
          : null,
    };
  });
}

export function featuredVendorHref(item: FeaturedVendorItem): string {
  const routeId = item.legacyVendorId ?? item.vendorProfileId;
  return `/vendors/${routeId}?vendorProfileId=${encodeURIComponent(item.vendorProfileId)}`;
}
