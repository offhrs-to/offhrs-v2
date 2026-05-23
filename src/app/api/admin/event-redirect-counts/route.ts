import { verifyAdmin } from '@/app/api/admin/login/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/admin/event-redirect-counts
 * Returns how many users were redirected (clicked Book) per event, including guests.
 * Uses service role to count rows in event_redirects per event_id.
 * Requires admin session cookie or Authorization: Basic (set via POST /api/admin/login or in-page login).
 */
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured with SUPABASE_SERVICE_ROLE_KEY' },
      { status: 503 }
    )
  }

  const { data, error } = await supabase
    .from('event_redirects')
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

