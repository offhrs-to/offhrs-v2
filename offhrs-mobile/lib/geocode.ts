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

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}`,
    {
      headers: { 'User-Agent': 'Offhrs-Mobile-App' },
    }
  );
  if (!response.ok) return null;
  const data = await response.json();
  if (!data?.length) return null;
  const first = data[0];
  const lat = first.lat;
  const lon = first.lon;
  if (lat == null || lon == null) return null;
  return { lat: Number(lat), lng: Number(lon) };
}
