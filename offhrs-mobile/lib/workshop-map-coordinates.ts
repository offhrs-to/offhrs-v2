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
 * When `events.lat`/`lng` are missing, fall back to the vendor profile pin from onboarding.
 * Prefer address match when both strings exist; otherwise still use the studio pin so
 * partner workshops appear on the map when geocoding never populated event coords.
 */
export async function enrichWorkshopEventsWithMapCoordinates(
  events: WorkshopEventRow[]
): Promise<WorkshopEventRow[]> {
  const needsProfile = events.filter(
    (e) => !workshopHasMapCoordinates(e) && e.vendor_profile_id?.trim()
  );
  if (needsProfile.length === 0) return events;

  const profileIds = [
    ...new Set(needsProfile.map((e) => e.vendor_profile_id!.trim())),
  ];

  const { data: profiles } = await supabase
    .from('vendor_profiles')
    .select('id, location_address, location_lat, location_lng')
    .in('id', profileIds);

  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        address: (p.location_address ?? '').trim(),
        lat: p.location_lat != null ? Number(p.location_lat) : null,
        lng: p.location_lng != null ? Number(p.location_lng) : null,
      },
    ])
  );

  return events.map((e) => {
    if (workshopHasMapCoordinates(e) || !e.vendor_profile_id) return e;
    const profile = byId.get(e.vendor_profile_id.trim());
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

/** One pin per physical location (multi-session listings share the same coordinates). */
export function dedupeWorkshopMapMarkerEvents(events: WorkshopEventRow[]): WorkshopEventRow[] {
  const seen = new Set<string>();
  const out: WorkshopEventRow[] = [];
  for (const e of events) {
    if (!workshopHasMapCoordinates(e)) continue;
    const key = `${Number(e.lat).toFixed(4)},${Number(e.lng).toFixed(4)}`;
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
