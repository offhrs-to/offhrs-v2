import { verifyAdminCookie } from '@/app/api/admin/login/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeAddress } from '@/lib/geocode'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/admin/backfill-event-coordinates
 * Finds events with a location but null lat/lng, geocodes each, and updates the row.
 * Requires admin session cookie. Respects Nominatim usage policy with a short delay between requests.
 */
export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie')
  if (!verifyAdminCookie(cookieHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured with SUPABASE_SERVICE_ROLE_KEY' },
      { status: 503 }
    )
  }

  const { data: events, error: fetchError } = await supabase
    .from('events')
    .select('id, location')
    .not('location', 'is', null)
    .or('lat.is.null,lng.is.null')

  if (fetchError) {
    console.error('Backfill fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!events?.length) {
    return NextResponse.json({
      updated: 0,
      skipped: 0,
      failed: 0,
      message: 'No events with location and missing coordinates.',
    })
  }

  const results = { updated: 0, skipped: 0, failed: 0 }

  for (const event of events) {
    const location = (event.location ?? '').trim()
    if (!location) {
      results.skipped += 1
      continue
    }
    if (
      location.toLowerCase().includes('online') ||
      location.toLowerCase().includes('virtual')
    ) {
      results.skipped += 1
      continue
    }

    try {
      const coords = await geocodeAddress(location)
      if (!coords) {
        results.failed += 1
        continue
      }

      const { error: updateError } = await supabase
        .from('events')
        .update({
          lat: parseFloat(coords.lat),
          lng: parseFloat(coords.lng),
        })
        .eq('id', event.id)

      if (updateError) {
        console.error('Backfill update error for event', event.id, updateError)
        results.failed += 1
      } else {
        results.updated += 1
      }
    } catch (err) {
      console.error('Backfill geocode error for event', event.id, err)
      results.failed += 1
    }

    // Nominatim usage policy: max 1 request per second for bulk
    await new Promise((r) => setTimeout(r, 1100))
  }

  return NextResponse.json({
    ...results,
    message: `Backfill complete: ${results.updated} updated, ${results.skipped} skipped, ${results.failed} failed.`,
  })
}
