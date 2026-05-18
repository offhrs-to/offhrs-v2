import { geocodeAddress } from '@/lib/geocode'

export type EventCoordinates = { lat: number | null; lng: number | null }

/**
 * Resolve map pin coordinates for an event from Places (preferred) or geocoding the address string.
 */
export async function resolveEventCoordinates(params: {
  location: string | null | undefined
  locationType?: 'in_person' | 'virtual'
  clientLat?: number | null
  clientLng?: number | null
}): Promise<EventCoordinates> {
  if (params.locationType === 'virtual') {
    return { lat: null, lng: null }
  }

  const loc = (params.location ?? '').trim()
  if (!loc) {
    return { lat: null, lng: null }
  }

  const clat = params.clientLat
  const clng = params.clientLng
  if (
    clat != null &&
    clng != null &&
    Number.isFinite(clat) &&
    Number.isFinite(clng)
  ) {
    return { lat: clat, lng: clng }
  }

  const geocoded = await geocodeAddress(loc)
  if (!geocoded) {
    return { lat: null, lng: null }
  }

  const lat = parseFloat(geocoded.lat)
  const lng = parseFloat(geocoded.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: null, lng: null }
  }

  return { lat, lng }
}
