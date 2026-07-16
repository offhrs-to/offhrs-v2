import { supabase } from '@/lib/supabase';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';
import { workshopSessionKey } from '@/lib/workshops-events-query';

export function workshopHasMapCoordinates(
  e: Pick<WorkshopEventRow, 'lat' | 'lng'>
): boolean {
  return (
    e.lat != null &&
    e.lng != null &&
    !Number.isNaN(Number(e.lat)) &&
    !Number.isNaN(Number(e.lng))
  );
}

function normalizeLocationForMatch(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[,.]/g, '');
}

function locationsLikelySame(eventLocation: string, vendorAddress: string): boolean {
  const a = normalizeLocationForMatch(eventLocation);
  const b = normalizeLocationForMatch(vendorAddress);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

/**
 * When `events.lat`/`lng` are missing:
 * 1) Copy coords from another loaded event with the same `vendor_id` (legacy studios).
 * 2) Fall back to the SaaS vendor profile pin from onboarding.
 */
export async function enrichWorkshopEventsWithMapCoordinates(
  events: WorkshopEventRow[]
): Promise<WorkshopEventRow[]> {
  const coordsByVendorId = new Map<string, { lat: number; lng: number }>();
  for (const e of events) {
    if (!workshopHasMapCoordinates(e) || !e.vendor_id?.trim()) continue;
    const id = e.vendor_id.trim();
    if (!coordsByVendorId.has(id)) {
      coordsByVendorId.set(id, { lat: Number(e.lat), lng: Number(e.lng) });
    }
  }

  const needsCoords = events.filter((e) => !workshopHasMapCoordinates(e));
  if (needsCoords.length === 0) return events;

  // Legacy vendors: if this batch has no sibling with coords, pull one from DB.
  const missingVendorIds = [
    ...new Set(
      needsCoords
        .map((e) => e.vendor_id?.trim())
        .filter((id): id is string => !!id && !coordsByVendorId.has(id))
    ),
  ];
  if (missingVendorIds.length > 0) {
    const { data: siblingRows } = await supabase
      .from('events')
      .select('vendor_id, lat, lng')
      .in('vendor_id', missingVendorIds)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .limit(Math.min(500, missingVendorIds.length * 3));
    for (const row of siblingRows ?? []) {
      const id = row.vendor_id?.trim();
      if (!id || coordsByVendorId.has(id)) continue;
      const lat = row.lat != null ? Number(row.lat) : null;
      const lng = row.lng != null ? Number(row.lng) : null;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      coordsByVendorId.set(id, { lat, lng });
    }
  }

  const needsProfile = needsCoords.filter((e) => e.vendor_profile_id?.trim());
  const profileIds = [
    ...new Set(needsProfile.map((e) => e.vendor_profile_id!.trim())),
  ];

  const byProfileId = new Map<
    string,
    { address: string; lat: number | null; lng: number | null }
  >();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('vendor_profiles')
      .select('id, location_address, location_lat, location_lng')
      .in('id', profileIds);

    for (const p of profiles ?? []) {
      byProfileId.set(p.id, {
        address: (p.location_address ?? '').trim(),
        lat: p.location_lat != null ? Number(p.location_lat) : null,
        lng: p.location_lng != null ? Number(p.location_lng) : null,
      });
    }
  }

  return events.map((e) => {
    if (workshopHasMapCoordinates(e)) return e;

    if (e.vendor_id?.trim()) {
      const sibling = coordsByVendorId.get(e.vendor_id.trim());
      if (sibling) return { ...e, lat: sibling.lat, lng: sibling.lng };
    }

    if (!e.vendor_profile_id) return e;
    const profile = byProfileId.get(e.vendor_profile_id.trim());
    if (
      profile?.lat == null ||
      profile?.lng == null ||
      !Number.isFinite(profile.lat) ||
      !Number.isFinite(profile.lng)
    ) {
      return e;
    }
    const eventLoc = (e.location ?? '').trim();
    // If both addresses exist and clearly differ, do not override (different venue).
    if (
      eventLoc &&
      profile.address &&
      !locationsLikelySame(eventLoc, profile.address)
    ) {
      return e;
    }
    return { ...e, lat: profile.lat, lng: profile.lng };
  });
}

/** One marker per studio when possible; fall back to lat/lng for unlinked listings. */
export function dedupeWorkshopMapMarkerEvents(events: WorkshopEventRow[]): WorkshopEventRow[] {
  const seen = new Set<string>();
  const out: WorkshopEventRow[] = [];
  for (const e of events) {
    if (!workshopHasMapCoordinates(e)) continue;
    const studio = e.vendor_profile_id?.trim() || e.vendor_id?.trim();
    const key = studio
      ? `s:${studio}`
      : `${Number(e.lat).toFixed(4)},${Number(e.lng).toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export function workshopMapMarkerKey(e: WorkshopEventRow): string {
  if (!workshopHasMapCoordinates(e)) return workshopSessionKey(e);
  return `${e.id}:${Number(e.lat).toFixed(4)},${Number(e.lng).toFixed(4)}`;
}
