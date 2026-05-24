import type { SupabaseClient } from '@supabase/supabase-js'
import { awardXpForBooking } from '@/lib/workshop-xp'

/**
 * Marks bookings as `attended` once the workshop session has ended, and
 * ensures XP has been awarded for them.
 *
 * As of the per-booking XP tracking migration, XP is normally awarded at
 * booking confirmation time (see `awardXpForBooking` wired into
 * `/api/book/confirm`). This module is responsible for:
 *
 *   1. Flipping the booking status to `attended` once the session ends.
 *   2. Acting as a safety net for legacy bookings that were confirmed before
 *      the new flow shipped — those rows have `xp_awarded_at IS NULL` and
 *      will be awarded XP here as a fallback.
 */

/** Statuses that count as a paid/confirmed booking eligible for auto-attendance after the session ends. */
const CREDITABLE_STATUSES = new Set(['confirmed', 'booked'])

type BookingRow = {
  id: string
  user_id: string | null
  event_id: number | string
  status: string
  session_starts_at: string | null
  refunded_at: string | null
}

type EventRow = {
  date: string | null
  duration_minutes: number | null
  category: string | null
  booking_status: string | null
}

export function resolveWorkshopSessionEnd(
  sessionStartsAt: string | null | undefined,
  eventDate: string | null | undefined,
  durationMinutes: number | null | undefined
): Date | null {
  const raw = sessionStartsAt?.trim() || eventDate?.trim()
  if (!raw) return null
  const start = new Date(raw)
  if (Number.isNaN(start.getTime())) return null
  const mins = Math.max(1, durationMinutes ?? 60)
  return new Date(start.getTime() + mins * 60 * 1000)
}

export function isWorkshopSessionEnded(
  sessionStartsAt: string | null | undefined,
  eventDate: string | null | undefined,
  durationMinutes: number | null | undefined,
  nowMs: number = Date.now()
): boolean {
  const end = resolveWorkshopSessionEnd(sessionStartsAt, eventDate, durationMinutes)
  return end != null && end.getTime() <= nowMs
}

function isBookingEligibleForCredit(booking: BookingRow, event: EventRow | null): string | null {
  if (!booking.user_id) return 'no_user'
  if (!CREDITABLE_STATUSES.has(booking.status)) return 'status'
  if (booking.refunded_at) return 'refunded'
  if (booking.status === 'refunded' || booking.status === 'cancelled') return 'status'
  if (!event) return 'no_event'
  if (event.booking_status === 'archived') return 'event_archived'
  if (
    !isWorkshopSessionEnded(booking.session_starts_at, event.date, event.duration_minutes)
  ) {
    return 'session_not_ended'
  }
  return null
}

/**
 * Mark a booking as attended once the workshop has ended, and ensure XP has
 * been awarded (legacy fallback). Idempotent when status is already `attended`.
 */
export async function creditWorkshopAttendanceForBooking(
  admin: SupabaseClient,
  bookingId: string
): Promise<{ credited: boolean; skipped?: string }> {
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('id, user_id, event_id, status, session_starts_at, refunded_at')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return { credited: false, skipped: 'not_found' }
  }

  if (booking.status === 'attended') {
    // Legacy bookings may have been marked attended before XP tracking existed.
    // The award helper is idempotent on xp_awarded_at so this is safe to re-run.
    try {
      await awardXpForBooking(admin, booking.id)
    } catch (err) {
      console.error('attendance-credit legacy XP award error:', booking.id, err)
    }
    return { credited: false, skipped: 'already_attended' }
  }

  const { data: event, error: eventError } = await admin
    .from('events')
    .select('date, duration_minutes, category, booking_status')
    .eq('id', booking.event_id)
    .single()

  if (eventError || !event) {
    return { credited: false, skipped: 'no_event' }
  }

  const skip = isBookingEligibleForCredit(booking, event)
  if (skip) {
    return { credited: false, skipped: skip }
  }

  const { error: updateError } = await admin
    .from('bookings')
    .update({ status: 'attended' })
    .eq('id', booking.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  // Award XP if not already done at confirmation time. Idempotent.
  try {
    await awardXpForBooking(admin, booking.id)
  } catch (err) {
    console.error('attendance-credit XP award error:', booking.id, err)
  }

  return { credited: true }
}

/** Credit all bookings whose workshop has ended and are still confirmed (not refunded). */
export async function creditDueWorkshopAttendances(
  admin: SupabaseClient,
  options?: { limit?: number }
): Promise<{ credited: number; skipped: number; errors: number }> {
  const limit = options?.limit ?? 200

  const { data: bookings, error: fetchError } = await admin
    .from('bookings')
    .select(
      'id, user_id, event_id, status, session_starts_at, refunded_at, events ( date, duration_minutes, category, booking_status )'
    )
    .in('status', ['confirmed', 'booked'])
    .is('refunded_at', null)
    .not('user_id', 'is', null)
    .limit(limit)

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  let credited = 0
  let skipped = 0
  let errors = 0

  for (const row of bookings ?? []) {
    const event = (row as { events?: EventRow | EventRow[] | null }).events
    const eventRow = Array.isArray(event) ? event[0] : event
    const skip = isBookingEligibleForCredit(row as BookingRow, eventRow ?? null)
    if (skip) {
      skipped++
      continue
    }
    try {
      const result = await creditWorkshopAttendanceForBooking(admin, row.id)
      if (result.credited) credited++
      else skipped++
    } catch (err) {
      console.error('creditWorkshopAttendanceForBooking error:', row.id, err)
      errors++
    }
  }

  return { credited, skipped, errors }
}
