import { googlePlacesApiKey, fetchPlaceDetails } from '@/lib/google-places'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    if (!googlePlacesApiKey()) {
      return NextResponse.json({ error: 'Address autocomplete is not configured' }, { status: 503 })
    }

    const key = getRateLimitKey(request)
    const rl = consumeRateLimit(`places-details:${key}`, 40)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const placeId = request.nextUrl.searchParams.get('place_id')?.trim() ?? ''
    if (!placeId || placeId.length > 300) {
      return NextResponse.json({ error: 'place_id required' }, { status: 400 })
    }

    const address = await fetchPlaceDetails(placeId)
    if (!address) {
      return NextResponse.json({ error: 'Could not parse address' }, { status: 422 })
    }

    return NextResponse.json({ address })
  } catch (err) {
    console.error('places details', err)
    const msg = err instanceof Error ? err.message : 'Place details failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
