/**
 * Geocode an address using Nominatim (OpenStreetMap).
 * Returns { lat, lng } as strings or null if empty/online/virtual or no result.
 */
export async function geocodeAddress(
  location: string
): Promise<{ lat: string; lng: string } | null> {
  const trimmed = location.trim()
  if (!trimmed) return null
  if (
    trimmed.toLowerCase().includes('online') ||
    trimmed.toLowerCase().includes('virtual')
  ) {
    return null
  }

  const queries = new Set<string>([trimmed])
  const lower = trimmed.toLowerCase()
  if (!lower.includes('canada')) {
    queries.add(`${trimmed}, Canada`)
  }

  for (const q of queries) {
    const result = await nominatimSearch(q)
    if (result) return result
  }

  return null
}

async function nominatimSearch(query: string): Promise<{ lat: string; lng: string } | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'ca')
  url.searchParams.set('q', query)

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Offhrs-App' },
  })
  if (!response.ok) return null
  const data = await response.json()
  if (!data?.length) return null
  const first = data[0]
  const lat = first.lat
  const lon = first.lon
  if (lat == null || lon == null) return null
  return { lat: String(lat), lng: String(lon) }
}
