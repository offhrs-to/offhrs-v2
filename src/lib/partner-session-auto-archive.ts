import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isWorkshopSessionEnded,
  creditWorkshopAttendanceForBooking,
} from '@/lib/workshop-attendance-credit'
import { parseSeriesOccurrences } from '@/lib/workshop-series'
import { scheduleVendorSessionCalendarSync } from '@/lib/vendor-calendar-sync'

type EventRow = {
  id: number | string
  date: string | null
  duration_minutes: number | null
  booking_status: string | null
  workshop_series: string | null
  series_occurrences: unknown
}

/**
 * Last session start for auto-archive: multi-week uses the latest occurrence;
 * one-day uses `events.date`.
 */
export function resolveWorkshopLastSessionStart(row: EventRow): string | null {
  const series = parseSeriesOccurrences({
    workshop_series: row.workshop_series,
    series_occurrences: row.series_occurrences,
  })
  if (series.length > 0) {
    let latest: string | null = null
    let latestMs = -Infinity
    for (const occ of series) {
      const t = new Date(occ.start).getTime()
      if (!Number.isFinite(t)) continue
      if (t >= latestMs) {
        latestMs = t
        latest = occ.start
      }
    }
    return latest
  }
  return row.date?.trim() || null
}

export function isPartnerWorkshopFullyEnded(
  row: EventRow,
  nowMs: number = Date.now()
): boolean {
  const start = resolveWorkshopLastSessionStart(row)
  if (!start) return false
  return isWorkshopSessionEnded(null, start, row.duration_minutes, nowMs)
}

/**
 * Soft-archive published/fully_booked workshops whose last session has ended.
 * Does **not** refund — past guests should already be `attended` (we credit
 * any leftover confirmed bookings first). Manual archive still refunds
 * upcoming active bookings via {@link archivePartnerSession}.
 */
export async function archiveEndedPartnerSessions(
  admin: SupabaseClient,
  vendorId: string,
  nowMs: number = Date.now()
): Promise<{ archived: number }> {
  const { data: events, error } = await admin
    .from('events')
    .select('id, date, duration_minutes, booking_status, workshop_series, series_occurrences')
    .eq('vendor_profile_id', vendorId)
    .in('booking_status', ['published', 'fully_booked'])

  if (error || !events?.length) {
    if (error) console.error('archiveEndedPartnerSessions fetch:', error.message)
    return { archived: 0 }
  }

  let archived = 0

  for (const row of events as EventRow[]) {
    if (!isPartnerWorkshopFullyEnded(row, nowMs)) continue

    const eventId = row.id

    const { data: leftover } = await admin
      .from('bookings')
      .select('id')
      .eq('event_id', eventId)
      .in('status', ['confirmed', 'booked'])
      .is('refunded_at', null)

    for (const b of leftover ?? []) {
      try {
        await creditWorkshopAttendanceForBooking(admin, String(b.id))
      } catch (err) {
        console.error('archiveEndedPartnerSessions attendance:', b.id, err)
      }
    }

    const { data: updated, error: upErr } = await admin
      .from('events')
      .update({ booking_status: 'archived' })
      .eq('id', eventId)
      .eq('vendor_profile_id', vendorId)
      .in('booking_status', ['published', 'fully_booked'])
      .select('id')
      .maybeSingle()

    if (upErr) {
      console.error('archiveEndedPartnerSessions update:', eventId, upErr.message)
      continue
    }
    if (!updated) continue

    archived += 1
    scheduleVendorSessionCalendarSync(admin, vendorId, String(eventId))
  }

  return { archived }
}
