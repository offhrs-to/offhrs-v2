/** Rounded coordinate bucket for map pin deduplication (~11 m at Toronto latitudes). */
export function mapPinCoordKey(lat: number, lng: number): string {
  return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
}

export type MapPinKeyInput = {
  id?: number;
  vendor_profile_id?: string | null;
  vendor_id?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/**
 * Stable dedupe key: one pin per vendor per physical location.
 * Vendors sharing a building stay distinct; multi-location vendors get multiple pins.
 */
export function workshopMapPinDedupeKey(input: MapPinKeyInput): string | null {
  const lat = input.lat != null ? Number(input.lat) : null;
  const lng = input.lng != null ? Number(input.lng) : null;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const coord = mapPinCoordKey(lat, lng);
  const profile = input.vendor_profile_id?.trim();
  if (profile) return `p:${profile}@${coord}`;
  const vendor = input.vendor_id?.trim();
  if (vendor) return `v:${vendor}@${coord}`;
  if (input.id != null) return `e:${input.id}@${coord}`;
  return `pin:${coord}`;
}
