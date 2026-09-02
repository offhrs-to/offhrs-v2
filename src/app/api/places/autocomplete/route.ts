import { googlePlacesApiKey, fetchPlaceAutocomplete } from '@/lib/google-places'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    if (!googlePlacesApiKey()) {
      return NextResponse.json(
        { error: 'Address autocomplete is not configured', suggestions: [] },
        { status: 503 }
      )
    }

    const key = getRateLimitKey(request)
    const rl = consumeRateLimit(`places-autocomplete:${key}`, 60)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (q.length < 3) {
      return NextResponse.json({ suggestions: [] })
    }

    const suggestions = await fetchPlaceAutocomplete(q)
    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error('places autocomplete', err)
    const msg = err instanceof Error ? err.message : 'Autocomplete failed'
    return NextResponse.json({ error: msg, suggestions: [] }, { status: 500 })
  }
}
