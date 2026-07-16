import { geocodeAddress } from '@/lib/geocode'

export type EventCoordinates = { lat: number | null; lng: number | null }

export function normalizeLocationForMatch(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[,.]/g, '')
}

function locationsLikelySame(eventLocation: string, vendorAddress: string): boolean {
  const a = normalizeLocationForMatch(eventLocation)
  const b = normalizeLocationForMatch(vendorAddress)
  if (!a || !b) return false
  if (a === b) return true
  return a.includes(b) || b.includes(a)
}

/**
 * Resolve map pin coordinates for an event from Places (preferred), vendor profile pin, or geocoding.
 */
export async function resolveEventCoordinates(params: {
  location: string | null | undefined
  locationType?: 'in_person' | 'virtual'
  clientLat?: number | null
  clientLng?: number | null
  vendorProfileAddress?: string | null
  vendorProfileLat?: number | null
  vendorProfileLng?: number | null
}): Promise<EventCoordinates> {
  if (params.locationType === 'virtual') {
    return { lat: null, lng: null }
  }

  const loc = (params.location ?? '').trim()
  if (!loc) {
    const vlat = params.vendorProfileLat
    const vlng = params.vendorProfileLng
    if (
      vlat != null &&
      vlng != null &&
      Number.isFinite(vlat) &&
      Number.isFinite(vlng)
    ) {
      return { lat: vlat, lng: vlng }
    }
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

  const vlat = params.vendorProfileLat
  const vlng = params.vendorProfileLng
  const vaddr = (params.vendorProfileAddress ?? '').trim()
  const vendorPinOk =
    vlat != null && vlng != null && Number.isFinite(vlat) && Number.isFinite(vlng)

  if (vendorPinOk && (!vaddr || !loc || locationsLikelySame(loc, vaddr))) {
    return { lat: vlat, lng: vlng }
  }

  const geocoded = await geocodeAddress(loc)
  if (geocoded) {
    const lat = parseFloat(geocoded.lat)
    const lng = parseFloat(geocoded.lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
  }

  // Last resort: studio pin even if address strings differ slightly (Places vs typed).
  if (vendorPinOk) {
    return { lat: vlat, lng: vlng }
  }

  return { lat: null, lng: null }
}
