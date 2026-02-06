import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/event-redirect-counts
 * Returns how many users were redirected (booked) from the app to each event.
 * Uses service role to count rows in bookings per event_id.
 * Expired events remain in Supabase; this count includes them.
 */
export async function GET() {
  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured with SUPABASE_SERVICE_ROLE_KEY' },
      { status: 503 }
    )
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('event_id')

  if (error) {
    console.error('Event redirect counts error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = String(row.event_id)
    counts[id] = (counts[id] ?? 0) + 1
  }

  return NextResponse.json({ counts })
}
