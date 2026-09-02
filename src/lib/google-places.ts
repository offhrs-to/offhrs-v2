import 'server-only'

/**
 * Google Places (legacy HTTP) helpers for Canada address autocomplete.
 * Prefers server key `GOOGLE_MAPS_API_KEY` (not referrer-restricted browser keys).
 * Falls back to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` if that is the only key set.
 */

export function googlePlacesApiKey(): string | null {
  const key =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAP_API?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ''
  return key || null
}

export type PlaceSuggestion = {
  place_id: string
  description: string
  main_text: string
  secondary_text: string
}

export type ParsedCanadianAddress = {
  line1: string
  line2: string | null
  city: string
  province: string
  postal_code: string
  formatted: string
}

type AutocompletePrediction = {
  place_id?: string
  description?: string
  structured_formatting?: {
    main_text?: string
    secondary_text?: string
  }
}

type AddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

function component(
  components: AddressComponent[],
  type: string,
  useShort = false
): string {
  const c = components.find((x) => x.types.includes(type))
  if (!c) return ''
  return (useShort ? c.short_name : c.long_name).trim()
}

export function parseGoogleAddressComponents(
  components: AddressComponent[],
  formattedAddress?: string | null
): ParsedCanadianAddress | null {
  const streetNumber = component(components, 'street_number')
  const route = component(components, 'route')
  const line1 = [streetNumber, route].filter(Boolean).join(' ').trim()
  const line2 =
    component(components, 'subpremise') ||
    component(components, 'premise') ||
    null
  const city =
    component(components, 'locality') ||
    component(components, 'postal_town') ||
    component(components, 'administrative_area_level_3') ||
    component(components, 'sublocality') ||
    ''
  const province = component(components, 'administrative_area_level_1', true).toUpperCase()
  const postalRaw = component(components, 'postal_code')
  const compact = postalRaw.replace(/[\s-]/g, '').toUpperCase()
  const postal_code =
    compact.length === 6 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : postalRaw

  if (!line1 && !city) return null

  return {
    line1: line1 || (formattedAddress?.split(',')[0]?.trim() ?? ''),
    line2: line2 || null,
    city,
    province,
    postal_code,
    formatted: formattedAddress?.trim() || [line1, city, province, postal_code].filter(Boolean).join(', '),
  }
}

export async function fetchPlaceAutocomplete(query: string): Promise<PlaceSuggestion[]> {
  const key = googlePlacesApiKey()
  if (!key) throw new Error('Google Maps API key is not configured')

  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
  url.searchParams.set('input', trimmed)
  url.searchParams.set('components', 'country:ca')
  url.searchParams.set('types', 'address')
  url.searchParams.set('language', 'en')
  url.searchParams.set('key', key)

  const res = await fetch(url.toString())
  const data = (await res.json()) as {
    status?: string
    error_message?: string
    predictions?: AutocompletePrediction[]
  }

  if (data.status === 'ZERO_RESULTS') return []
  if (data.status !== 'OK') {
    throw new Error(data.error_message || `Places autocomplete failed (${data.status ?? 'unknown'})`)
  }

  return (data.predictions ?? [])
    .filter((p) => p.place_id && p.description)
    .slice(0, 6)
    .map((p) => ({
      place_id: p.place_id!,
      description: p.description!,
      main_text: p.structured_formatting?.main_text ?? p.description!,
      secondary_text: p.structured_formatting?.secondary_text ?? '',
    }))
}

export async function fetchPlaceDetails(placeId: string): Promise<ParsedCanadianAddress | null> {
  const key = googlePlacesApiKey()
  if (!key) throw new Error('Google Maps API key is not configured')

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('fields', 'address_component,formatted_address')
  url.searchParams.set('language', 'en')
  url.searchParams.set('key', key)

  const res = await fetch(url.toString())
  const data = (await res.json()) as {
    status?: string
    error_message?: string
    result?: {
      address_components?: AddressComponent[]
      formatted_address?: string
    }
  }

  if (data.status !== 'OK' || !data.result?.address_components) {
    throw new Error(data.error_message || `Places details failed (${data.status ?? 'unknown'})`)
  }

  return parseGoogleAddressComponents(
    data.result.address_components,
    data.result.formatted_address
  )
}
