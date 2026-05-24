import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Per-booking experience-point lifecycle.
 *
 * Flow:
 *   1. Booking confirmed (paid or free)   → awardXpForBooking()  → bookings.xp_awarded_at = now, xp_amount = N
 *   2. Booking refunded / cancelled       → clawBackXpForBooking() → xp_awarded_at = null, profile XP -= N
 *
 * Idempotent in both directions: awarding a booking that already has
 * xp_awarded_at set is a no-op; clawing back a booking whose xp_awarded_at
 * is null is a no-op.
 */

const LEVEL_THRESHOLDS: Record<string, number> = {
  Novice: 8,
  Intermediate: 16,
  Advanced: 24,
  Expert: 32,
  Master: Infinity,
}

const LEVELS = ['Novice', 'Intermediate', 'Advanced', 'Expert', 'Master'] as const
type Level = (typeof LEVELS)[number]

type EventForXp = {
  workshop_series?: string | null
  series_occurrences?: unknown
  partner_series_meta?: unknown
  duration_weeks?: number | null
  category?: string | null
  booking_status?: string | null
}

type BookingForXp = {
  id: string
  user_id: string | null
  event_id: number | string | null
  status: string | null
  refunded_at: string | null
  xp_awarded_at: string | null
  xp_amount: number | null
}

/**
 * Resolve how many XP a single booking should award.
 *
 *   - Multi-week cohort (weekly_same / weekly_custom)  → number of occurrences
 *   - Per-occurrence multi-week (daily_weekdays)       → 1 per booking (each
 *     occurrence is booked separately, so callers see one XP per session)
 *   - Single session                                   → 1
 *   - Legacy rows with events.duration_weeks set       → that value
 */
export function resolveXpAmountForEvent(event: EventForXp | null | undefined): number {
  if (!event) return 1

  if (event.workshop_series === 'multi_week') {
    const meta = (event.partner_series_meta ?? null) as { pattern?: string } | null
    const pattern = meta?.pattern
    if (pattern === 'weekly_same' || pattern === 'weekly_custom') {
      const occ = Array.isArray(event.series_occurrences) ? event.series_occurrences.length : 0
      if (occ > 0) return Math.max(1, occ)
    }
  }

  const weeks = event.duration_weeks ?? 0
  if (weeks > 0) return Math.max(1, weeks)

  return 1
}

function nextLevelFor(currentLevel: Level, newPoints: number): Level {
  const currentIndex = Math.max(0, LEVELS.indexOf(currentLevel))
  const nextLevel = LEVELS[Math.min(currentIndex + 1, LEVELS.length - 1)]!
  const threshold = LEVEL_THRESHOLDS[currentLevel] ?? 8
  return newPoints >= threshold ? nextLevel : currentLevel
}

function previousLevelFor(currentLevel: Level, newPoints: number): Level {
  // Walk down levels until newPoints meets the threshold of the level below us.
  let level = currentLevel
  // Walk down while we no longer meet the previous tier's threshold.
  while (true) {
    const idx = LEVELS.indexOf(level)
    if (idx <= 0) return 'Novice'
    const below = LEVELS[idx - 1]!
    const belowThreshold = LEVEL_THRESHOLDS[below] ?? 8
    if (newPoints >= belowThreshold) return level
    level = below
  }
}

async function adjustCategoryXp(
  db: SupabaseClient,
  userId: string,
  category: string,
  delta: number
): Promise<void> {
  const { data: catRow, error: selectError } = await db
    .from('profile_category_experience')
    .select('experience_points, expertise_level')
    .eq('user_id', userId)
    .eq('category', category)
    .maybeSingle()

  if (selectError) {
    throw new Error(
      `profile_category_experience select failed (user=${userId} cat=${category}): ${selectError.message}`
    )
  }

  const currentPoints = catRow?.experience_points ?? 0
  const newPoints = Math.max(0, currentPoints + delta)
  const currentLevel = ((catRow?.expertise_level as Level) || 'Novice')
  const newLevel = delta >= 0 ? nextLevelFor(currentLevel, newPoints) : previousLevelFor(currentLevel, newPoints)

  const { error: upsertError } = await db.from('profile_category_experience').upsert(
    {
      user_id: userId,
      category,
      expertise_level: newLevel,
      experience_points: newPoints,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,category' }
  )

  if (upsertError) {
    throw new Error(
      `profile_category_experience upsert failed (user=${userId} cat=${category}): ${upsertError.message}`
    )
  }
}

async function adjustProfileXp(
  db: SupabaseClient,
  userId: string,
  delta: number
): Promise<void> {
  const { data: profile, error: selectError } = await db
    .from('profiles')
    .select('experience_points, expertise_level')
    .eq('id', userId)
    .maybeSingle()

  if (selectError) {
    throw new Error(`profiles select failed (user=${userId}): ${selectError.message}`)
  }

  const currentPoints = profile?.experience_points ?? 0
  const newPoints = Math.max(0, currentPoints + delta)
  const currentLevel = (profile?.expertise_level as Level) || 'Novice'
  const newLevel = delta >= 0 ? nextLevelFor(currentLevel, newPoints) : previousLevelFor(currentLevel, newPoints)

  // Use upsert (rather than update) so missing profiles rows can still receive
  // XP. An update-only path silently no-ops when no row exists, which would
  // mask a missing handle_new_user trigger and leave bookings marked as
  // awarded without the user actually seeing the points.
  const { error: upsertError } = await db
    .from('profiles')
    .upsert(
      {
        id: userId,
        experience_points: newPoints,
        expertise_level: newLevel,
      },
      { onConflict: 'id' }
    )

  if (upsertError) {
    throw new Error(`profiles upsert failed (user=${userId}): ${upsertError.message}`)
  }
}

/**
 * Award XP for a single booking. Idempotent: skips if XP was already awarded
 * (`xp_awarded_at` is set) or if the booking has no user / has been refunded /
 * has been cancelled.
 */
export async function awardXpForBooking(
  admin: SupabaseClient,
  bookingId: string
): Promise<{ awarded: boolean; amount: number; skipped?: string }> {
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('id, user_id, event_id, status, refunded_at, xp_awarded_at, xp_amount')
    .eq('id', bookingId)
    .single<BookingForXp>()

  if (bookingError || !booking) {
    return { awarded: false, amount: 0, skipped: 'not_found' }
  }

  if (booking.xp_awarded_at) {
    return { awarded: false, amount: booking.xp_amount ?? 0, skipped: 'already_awarded' }
  }
  if (!booking.user_id) {
    return { awarded: false, amount: 0, skipped: 'no_user' }
  }
  if (booking.refunded_at) {
    return { awarded: false, amount: 0, skipped: 'refunded' }
  }
  if (booking.status === 'refunded' || booking.status === 'cancelled') {
    return { awarded: false, amount: 0, skipped: 'status' }
  }

  const { data: event, error: eventError } = await admin
    .from('events')
    .select(
      'workshop_series, series_occurrences, partner_series_meta, duration_weeks, category, booking_status'
    )
    .eq('id', booking.event_id as number | string)
    .single<EventForXp>()

  if (eventError || !event) {
    return { awarded: false, amount: 0, skipped: 'no_event' }
  }

  if (event.booking_status === 'archived') {
    return { awarded: false, amount: 0, skipped: 'event_archived' }
  }

  const amount = resolveXpAmountForEvent(event)
  const awardedAt = new Date().toISOString()

  // Mark first so concurrent awards (e.g. confirm + cron) don't double-credit.
  const { data: updated, error: updateError } = await admin
    .from('bookings')
    .update({ xp_awarded_at: awardedAt, xp_amount: amount })
    .eq('id', booking.id)
    .is('xp_awarded_at', null)
    .select('id')
    .maybeSingle()

  if (updateError) {
    throw new Error(`Failed to mark booking xp_awarded_at: ${updateError.message}`)
  }

  if (!updated) {
    // Another worker won the race.
    return { awarded: false, amount: 0, skipped: 'race' }
  }

  const category = event.category?.trim() || null

  try {
    if (category) {
      await adjustCategoryXp(admin, booking.user_id, category, amount)
    }
    await adjustProfileXp(admin, booking.user_id, amount)
  } catch (err) {
    // Roll back the booking marker so a retry can re-credit.
    await admin
      .from('bookings')
      .update({ xp_awarded_at: null, xp_amount: 0 })
      .eq('id', booking.id)
    throw err
  }

  return { awarded: true, amount }
}

/**
 * Claw back XP previously awarded for a booking. Idempotent: a no-op if the
 * booking never had XP awarded (or it was already clawed back).
 */
export async function clawBackXpForBooking(
  admin: SupabaseClient,
  bookingId: string
): Promise<{ clawedBack: boolean; amount: number; skipped?: string }> {
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('id, user_id, event_id, status, refunded_at, xp_awarded_at, xp_amount')
    .eq('id', bookingId)
    .single<BookingForXp>()

  if (bookingError || !booking) {
    return { clawedBack: false, amount: 0, skipped: 'not_found' }
  }

  if (!booking.xp_awarded_at) {
    return { clawedBack: false, amount: 0, skipped: 'not_awarded' }
  }
  if (!booking.user_id) {
    // Clear marker so future deletions don't keep looking valid.
    await admin
      .from('bookings')
      .update({ xp_awarded_at: null })
      .eq('id', booking.id)
    return { clawedBack: false, amount: 0, skipped: 'no_user' }
  }

  const amount = Math.max(0, booking.xp_amount ?? 0)

  // Clear the marker first so concurrent clawbacks don't double-deduct.
  const { data: updated, error: updateError } = await admin
    .from('bookings')
    .update({ xp_awarded_at: null })
    .eq('id', booking.id)
    .not('xp_awarded_at', 'is', null)
    .select('id')
    .maybeSingle()

  if (updateError) {
    throw new Error(`Failed to clear booking xp_awarded_at: ${updateError.message}`)
  }
  if (!updated) {
    return { clawedBack: false, amount: 0, skipped: 'race' }
  }
  if (amount <= 0) {
    return { clawedBack: false, amount: 0, skipped: 'zero_amount' }
  }

  // Best-effort: look up category from the event so we can decrement the
  // per-category bucket as well as the top-level profile XP.
  let category: string | null = null
  if (booking.event_id != null) {
    const { data: event } = await admin
      .from('events')
      .select('category')
      .eq('id', booking.event_id as number | string)
      .maybeSingle()
    category = (event?.category as string | null)?.trim() || null
  }

  try {
    if (category) {
      await adjustCategoryXp(admin, booking.user_id, category, -amount)
    }
    await adjustProfileXp(admin, booking.user_id, -amount)
  } catch (err) {
    // Restore marker so a retry can complete the clawback.
    await admin
      .from('bookings')
      .update({ xp_awarded_at: booking.xp_awarded_at })
      .eq('id', booking.id)
    throw err
  }

  return { clawedBack: true, amount }
}
