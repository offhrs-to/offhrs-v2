const NOMINATIM_HEADERS = { 'User-Agent': 'Offhrs-Mobile-App' };

/** GTA bounding box (min_lon, min_lat, max_lon, max_lat) – Mississauga to Oshawa, lake to Newmarket */
const TORONTO_VIEWBOX = '-79.95,43.4,-78.7,44.15';

export type AddressSuggestion = { display: string; lat: number; lng: number };

/**
 * Fetch address suggestions for autocomplete, restricted to Canada and the GTA viewbox.
 * Call with debounced input (e.g. 300ms). Returns up to 3 suggestions.
 */
export async function fetchAddressSuggestions(
  query: string
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `format=json&q=${encodeURIComponent(trimmed)}&` +
    `countrycodes=ca&viewbox=${TORONTO_VIEWBOX}&bounded=1&` +
    `limit=3&addressdetails=0`;
  const response = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter((item: { lat?: string; lon?: string; display_name?: string }) => item.lat != null && item.lon != null && item.display_name)
    .map((item: { lat: string; lon: string; display_name: string }) => ({
      display: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));
}

/**
 * Geocode an address using Nominatim (OpenStreetMap).
 * Returns { lat, lng } as numbers or null if empty/online/virtual or no result.
 */
export async function geocodeAddress(
  location: string
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = location.trim();
  if (!trimmed) return null;
  if (
    trimmed.toLowerCase().includes('online') ||
    trimmed.toLowerCase().includes('virtual')
  ) {
    return null;
  }

  const queries = new Set<string>([trimmed]);
  if (!trimmed.toLowerCase().includes('canada')) {
    queries.add(`${trimmed}, Canada`);
  }

  for (const q of queries) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'ca');
    url.searchParams.set('q', q);
    const response = await fetch(url.toString(), { headers: NOMINATIM_HEADERS });
    if (!response.ok) continue;
    const data = await response.json();
    if (!data?.length) continue;
    const first = data[0];
    const lat = first.lat;
    const lon = first.lon;
    if (lat == null || lon == null) continue;
    return { lat: Number(lat), lng: Number(lon) };
  }

  return null;
}

type NominatimReverse = {
  address?: { postcode?: string; country_code?: string };
};

/**
 * Reverse geocode coordinates; returns Canadian postal code in A1A 1A1 form when available.
 */
export async function reverseGeocodeCanadianPostal(
  lat: number,
  lng: number
): Promise<string | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(String(lat))}` +
    `&lon=${encodeURIComponent(String(lng))}&addressdetails=1`;
  const response = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!response.ok) return null;
  const data = (await response.json()) as NominatimReverse;
  const raw = data.address?.postcode?.trim();
  if (!raw || data.address?.country_code?.toLowerCase() !== 'ca') return null;
  const compact = raw.replace(/\s|-/g, '').toUpperCase();
  if (compact.length < 6) return null;
  const head = compact.slice(0, 6);
  if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(head))
    return null;
  return `${head.slice(0, 3)} ${head.slice(3)}`;
}

