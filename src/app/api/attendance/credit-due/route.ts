import { createAdminClient } from '@/lib/supabase/admin'
import { creditWorkshopAttendanceForBooking, isWorkshopSessionEnded } from '@/lib/workshop-attendance-credit'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/attendance/credit-due
 * Credits the signed-in user's past workshops that are confirmed and not refunded.
 * Called from the mobile profile (and web) so XP updates without waiting for cron.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  let user = (await supabase.auth.getUser()).data.user

  const bearerToken = request.headers.get('authorization')?.startsWith('Bearer ')
    ? request.headers.get('authorization')!.slice(7).trim()
    : null

  if (!user && bearerToken) {
    const bearerClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
    )
    user = (await bearerClient.auth.getUser()).data.user ?? null
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  const { data: bookings, error: fetchError } = await admin
    .from('bookings')
    .select(
      'id, status, session_starts_at, refunded_at, events ( date, duration_minutes, booking_status )'
    )
    .eq('user_id', user.id)
    .in('status', ['confirmed', 'booked'])
    .is('refunded_at', null)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let credited = 0
  for (const row of bookings ?? []) {
    const eventRaw = (row as { events?: { date: string | null; duration_minutes: number | null; booking_status: string | null } | { date: string | null; duration_minutes: number | null; booking_status: string | null }[] | null }).events
    const event = Array.isArray(eventRaw) ? eventRaw[0] : eventRaw
    if (!event || event.booking_status === 'archived') continue
    if (
      !isWorkshopSessionEnded(row.session_starts_at, event.date, event.duration_minutes)
    ) {
      continue
    }
    try {
      const result = await creditWorkshopAttendanceForBooking(admin, row.id)
      if (result.credited) credited++
    } catch (err) {
      console.error('credit-due booking error:', row.id, err)
    }
  }

  return NextResponse.json({ credited })
}
