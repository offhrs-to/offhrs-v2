import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  cancelRepeatingDaysOccurrence,
  patchRepeatingDaysOccurrence,
} from '@/lib/partner-series-occurrence-mutation'
import { syncVendorSessionToExternalCalendars } from '@/lib/vendor-calendar-sync'
import { findOccurrenceIndexByStart, parseSeriesOccurrences } from '@/lib/workshop-series'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  occurrence_start: z.string().min(1),
  start: z.string().optional(),
  max_attendees: z.number().int().min(1).max(500).optional(),
})

const deleteSchema = z.object({
  occurrence_start: z.string().min(1),
})

type Params = { params: Promise<{ id: string }> }

async function getVendorAndSession(userId: string, sessionId: string) {
  const admin = createAdminClient()
  if (!admin) return { admin: null, vendor: null, session: null }

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!vendor) return { admin, vendor: null, session: null }

  const { data: session } = await admin
    .from('events')
    .select('*')
    .eq('id', sessionId)
    .eq('vendor_profile_id', vendor.id)
    .single()

  return { admin, vendor, session }
}

async function migrateBookingSessionStarts(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  eventId: string,
  migrations: Array<{ from: string; to: string }>
) {
  const { data: rows } = await admin
    .from('bookings')
    .select('id, session_starts_at')
    .eq('event_id', eventId)
    .is('refunded_at', null)

  for (const row of rows ?? []) {
    for (const { from, to } of migrations) {
      const stub = parseSeriesOccurrences({
        workshop_series: 'multi_week',
        series_occurrences: [{ start: from, max_attendees: 1, available_slots: 1 }],
      })
      const idx = findOccurrenceIndexByStart(stub, String(row.session_starts_at ?? ''))
      if (idx >= 0) {
        await admin.from('bookings').update({ session_starts_at: to }).eq('id', row.id)
        break
      }
    }
  }
}

// PATCH /api/partners/sessions/[id]/occurrences — edit one Repeating days session
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, session } = await getVendorAndSession(user.id, id)
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const raw = await request.json()
    const parsed = patchSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    if (!parsed.data.start && parsed.data.max_attendees === undefined) {
      return NextResponse.json({ error: 'Provide a new date/time and/or max spots.' }, { status: 400 })
    }

    const { data: bookingRows } = await admin
      .from('bookings')
      .select('session_starts_at, refunded_at')
      .eq('event_id', id)

    const result = patchRepeatingDaysOccurrence(
      session as Parameters<typeof patchRepeatingDaysOccurrence>[0],
      bookingRows ?? [],
      parsed.data
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    if (result.bookingSessionMigrations.length > 0) {
      await migrateBookingSessionStarts(admin, id, result.bookingSessionMigrations)
    }

    const { data: updated, error } = await admin
      .from('events')
      .update(result.update)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    void syncVendorSessionToExternalCalendars(admin, vendor.id, id).catch((e) =>
      console.error('[occurrences] calendar sync', e)
    )

    return NextResponse.json({
      session: updated ? { ...updated, status: updated.booking_status } : null,
    })
  } catch (err) {
    console.error('Occurrence patch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/partners/sessions/[id]/occurrences — cancel one Repeating days session
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { admin, vendor, session } = await getVendorAndSession(user.id, id)
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const raw = await request.json().catch(() => ({}))
    const parsed = deleteSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { data: bookingRows } = await admin
      .from('bookings')
      .select('session_starts_at, refunded_at')
      .eq('event_id', id)

    const result = cancelRepeatingDaysOccurrence(
      session as Parameters<typeof cancelRepeatingDaysOccurrence>[0],
      bookingRows ?? [],
      parsed.data.occurrence_start
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }

    const { data: updated, error } = await admin
      .from('events')
      .update(result.update)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    void syncVendorSessionToExternalCalendars(admin, vendor.id, id).catch((e) =>
      console.error('[occurrences] calendar sync', e)
    )

    return NextResponse.json({
      session: updated ? { ...updated, status: updated.booking_status } : null,
    })
  } catch (err) {
    console.error('Occurrence cancel error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
