/**
 * Haversine distance between two points in km.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Default radius for map / nearby studio geo queries (covers GTA from Toronto). */
export const WORKSHOP_GEO_RADIUS_KM = 120;

/**
 * Cap on geo-filtered event rows (coords + bbox), not date-ordered global listings.
 * Must be high enough that session-heavy studios (many one-day rows at one pin) do not
 * crowd out other vendors — PostgREST returns max ~1000 per request, so the fetch paginates.
 */
export const WORKSHOP_GEO_EVENTS_CAP = 5000;

export function bboxAround(
  lat: number,
  lng: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusKm / 111;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngDelta = radiusKm / (111 * Math.max(0.2, Math.abs(cosLat)));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

