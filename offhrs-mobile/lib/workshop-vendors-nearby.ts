import { bboxAround, haversineKm, WORKSHOP_GEO_EVENTS_CAP, WORKSHOP_GEO_RADIUS_KM } from '@/lib/distance';
import { getCategoryMasterImageSource } from '@/lib/category-master-images';
import { CONSUMER_BOOKING_STATUS_OR, isEventVisibleToConsumers } from '@/lib/consumer-event-visibility';
import { supabase } from '@/lib/supabase';
import {
  WORKSHOP_EVENTS_UPCOMING_OR,
  type WorkshopEventRow,
} from '@/lib/workshops-events-query';

export type VendorNearbyRow = {
  vendor_id: string;
  name: string;
  distanceKm: number;
  image_url: string | null;
  category: string | null;
};

/** @deprecated Use WORKSHOP_GEO_RADIUS_KM from `@/lib/distance`. */
export const NEARBY_STUDIOS_RADIUS_KM = WORKSHOP_GEO_RADIUS_KM;

/** @deprecated Use WORKSHOP_GEO_EVENTS_CAP from `@/lib/distance`. */
export const NEARBY_STUDIOS_EVENTS_CAP = WORKSHOP_GEO_EVENTS_CAP;

export { bboxAround };

/** Slim select for nearby aggregation only. */
const NEARBY_EVENT_SELECT =
  'id, title, date, location, image_url, category, lat, lng, vendor_id, vendor_profile_id, organizer, recurrence, booking_status, registration_closed, workshop_series';

type NearbyEventDbRow = {
  id: number;
  title: string | null;
  date: string | null;
  location: string | null;
  image_url: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  vendor_id: string | null;
  vendor_profile_id: string | null;
  organizer: string | null;
  recurrence: string | null;
  booking_status: string | null;
  registration_closed?: boolean | null;
  workshop_series?: string | null;
};

function isUpcomingNearby(row: NearbyEventDbRow, nowIso: string): boolean {
  if (row.recurrence === 'daily' || row.recurrence === 'weekly') return true;
  if (row.workshop_series === 'multi_week') return true;
  if (!row.date) return true;
  return row.date >= nowIso;
}

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

/**
 * Fetch nearby studios by geographic bbox + required coordinates.
 * Avoids the date-ordered global fetch cap that can hide closer vendors with later dates.
 * Paginates past PostgREST's ~1000-row response cap so session-heavy studios don't crowd others out.
 */
export async function fetchNearbyVendorRows(
  anchor: { lat: number; lng: number },
  options?: { radiusKm?: number; eventsCap?: number }
): Promise<VendorNearbyRow[]> {
  const radiusKm = options?.radiusKm ?? WORKSHOP_GEO_RADIUS_KM;
  const eventsCap = options?.eventsCap ?? WORKSHOP_GEO_EVENTS_CAP;
  const nowIso = new Date().toISOString();
  const box = bboxAround(anchor.lat, anchor.lng, radiusKm);
  const batch = 1000;
  const combined: NearbyEventDbRow[] = [];

  for (let offset = 0; offset < eventsCap; offset += batch) {
    const take = Math.min(batch, eventsCap - offset);
    const { data, error } = await supabase
      .from('events')
      .select(NEARBY_EVENT_SELECT)
      .not('vendor_id', 'is', null)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .gte('lat', box.minLat)
      .lte('lat', box.maxLat)
      .gte('lng', box.minLng)
      .lte('lng', box.maxLng)
      .or(WORKSHOP_EVENTS_UPCOMING_OR(nowIso))
      .or(CONSUMER_BOOKING_STATUS_OR)
      .order('date', { ascending: true, nullsFirst: false })
      .range(offset, offset + take - 1);

    if (error) {
      if (__DEV__) console.warn('fetchNearbyVendorRows', error.message);
      throw error;
    }
    if (!data?.length) break;
    combined.push(...(data as NearbyEventDbRow[]));
    if (data.length < take) break;
  }

  const rows = combined.filter(
    (r) =>
      isEventVisibleToConsumers(r) &&
      isUpcomingNearby(r, nowIso) &&
      r.vendor_id != null &&
      r.lat != null &&
      r.lng != null &&
      !Number.isNaN(Number(r.lat)) &&
      !Number.isNaN(Number(r.lng))
  );

  const byVendor = new Map<
    string,
    { minKm: number; image_url: string | null; category: string | null; organizer: string | null }
  >();

  for (const r of rows) {
    const vendorId = String(r.vendor_id);
    const km = haversineKm(anchor.lat, anchor.lng, Number(r.lat), Number(r.lng));
    if (km > radiusKm) continue;
    const prev = byVendor.get(vendorId);
    if (!prev) {
      byVendor.set(vendorId, {
        minKm: km,
        image_url: r.image_url,
        category: r.category,
        organizer: r.organizer,
      });
    } else if (km < prev.minKm) {
      prev.minKm = km;
      if (!prev.image_url && r.image_url) {
        prev.image_url = r.image_url;
        prev.category = r.category;
      }
      if (!prev.organizer && r.organizer) prev.organizer = r.organizer;
    } else {
      if (!prev.image_url && r.image_url) {
        prev.image_url = r.image_url;
        prev.category = r.category;
      }
      if (!prev.organizer && r.organizer) prev.organizer = r.organizer;
    }
  }

  const vendorIds = [...byVendor.keys()];
  const nameById: Record<string, string> = {};
  if (vendorIds.length > 0) {
    const { data: vendors } = await supabase.from('vendors').select('id, name').in('id', vendorIds);
    for (const v of vendors ?? []) {
      if (v.id && v.name) nameById[v.id] = v.name;
    }
  }

  const out: VendorNearbyRow[] = [];
  for (const [vendor_id, v] of byVendor) {
    out.push({
      vendor_id,
      name: nameById[vendor_id] ?? v.organizer?.trim() ?? 'Vendor',
      distanceKm: v.minKm,
      image_url: v.image_url,
      category: v.category,
    });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out;
}

export function getVendorThumbSource(row: VendorNearbyRow): { uri: string } | number {
  if (row.image_url) return { uri: row.image_url };
  return getCategoryMasterImageSource(row.category);
}
