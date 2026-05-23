import type { SupabaseClient } from '@supabase/supabase-js'

const LEVEL_THRESHOLDS: Record<string, number> = {
  Novice: 8,
  Intermediate: 16,
  Advanced: 24,
  Expert: 32,
  Master: Infinity,
}

const LEVELS = ['Novice', 'Intermediate', 'Advanced', 'Expert', 'Master'] as const

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
  duration_weeks: number | null
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

async function awardExperiencePoints(
  db: SupabaseClient,
  userId: string,
  event: EventRow
): Promise<void> {
  const pointsToAdd = Math.max(1, event.duration_weeks ?? 1)
  const eventCategory = event.category?.trim() || null

  if (eventCategory) {
    const { data: catRow } = await db
      .from('profile_category_experience')
      .select('experience_points, expertise_level')
      .eq('user_id', userId)
      .eq('category', eventCategory)
      .maybeSingle()

    const currentPoints = catRow?.experience_points ?? 0
    const newPoints = currentPoints + pointsToAdd
    const currentLevel = (catRow?.expertise_level as (typeof LEVELS)[number]) || 'Novice'
    const currentIndex = LEVELS.indexOf(currentLevel)
    const nextLevel = LEVELS[Math.min(currentIndex + 1, LEVELS.length - 1)]!
    const threshold = LEVEL_THRESHOLDS[currentLevel] ?? 8
    const newLevel = newPoints >= threshold ? nextLevel : currentLevel

    await db.from('profile_category_experience').upsert(
      {
        user_id: userId,
        category: eventCategory,
        expertise_level: newLevel,
        experience_points: newPoints,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,category' }
    )
  }

  const { data: profile } = await db
    .from('profiles')
    .select('experience_points, expertise_level')
    .eq('id', userId)
    .single()

  const currentPoints = profile?.experience_points ?? 0
  const newPoints = currentPoints + pointsToAdd
  const currentLevel = profile?.expertise_level || 'Novice'
  const currentIndex = LEVELS.indexOf(currentLevel as (typeof LEVELS)[number])
  const nextLevel = LEVELS[Math.min(Math.max(currentIndex, 0) + 1, LEVELS.length - 1)]!
  const threshold = LEVEL_THRESHOLDS[currentLevel] ?? 8
  const newLevel = newPoints >= threshold ? nextLevel : currentLevel

  await db
    .from('profiles')
    .update({
      experience_points: newPoints,
      expertise_level: newLevel,
    })
    .eq('id', userId)
}

/**
 * Mark a booking as attended and award XP after the workshop session has ended.
 * Idempotent when status is already `attended`.
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
    return { credited: false, skipped: 'already_attended' }
  }

  const { data: event, error: eventError } = await admin
    .from('events')
    .select('date, duration_minutes, duration_weeks, category, booking_status')
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

  await awardExperiencePoints(admin, booking.user_id!, event)
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
      'id, user_id, event_id, status, session_starts_at, refunded_at, events ( date, duration_minutes, duration_weeks, category, booking_status )'
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
