import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSeriesOccurrences, type SeriesOccurrence } from '@/lib/workshop-series'

/**
 * Reconcile events.available_slots (and multi-week series_occurrences) from the
 * actual count of active, non-refunded bookings. Used to repair drift caused by:
 *   - Account deletion (CASCADE delete bypasses app slot logic)
 *   - Stripe refunds applied before the refunded status existed in DB
 *   - Direct SQL fixes, webhook retries, etc.
 *
 * Safe to call on every partner page load — it never decrements below the real
 * active booking count and only flips fully_booked → published when slots open.
 */

const ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending', 'booked', 'pending_confirmation']

type EventRow = {
  id: string | number
  max_attendees: number | null
  available_slots: number | null
  booking_status: string | null
  workshop_series: string | null
  series_occurrences: unknown
}

type BookingRow = {
  event_id: string | number | null
  status: string | null
  refunded_at: string | null
  session_starts_at: string | null
}

function isoMinute(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 16)
}

export async function reconcileVendorEventSlots(
  admin: SupabaseClient,
  vendorId: string
): Promise<{ reconciled: number }> {
  const { data: events, error: eventsError } = await admin
    .from('events')
    .select('id, max_attendees, available_slots, booking_status, workshop_series, series_occurrences')
    .eq('vendor_profile_id', vendorId)
    .neq('booking_status', 'archived')

  if (eventsError || !events?.length) return { reconciled: 0 }

  const eventIds = (events as EventRow[]).map((e) => e.id)

  const { data: bookings, error: bookingsError } = await admin
    .from('bookings')
    .select('event_id, status, refunded_at, session_starts_at')
    .in('event_id', eventIds)
    .in('status', ACTIVE_BOOKING_STATUSES)
    .is('refunded_at', null)

  if (bookingsError) {
    console.error('reconcileVendorEventSlots bookings error:', bookingsError)
    return { reconciled: 0 }
  }

  const bookingsByEvent = new Map<string, BookingRow[]>()
  for (const b of (bookings ?? []) as BookingRow[]) {
    if (b.event_id == null) continue
    const key = String(b.event_id)
    const list = bookingsByEvent.get(key) ?? []
    list.push(b)
    bookingsByEvent.set(key, list)
  }

  let reconciled = 0

  for (const ev of events as EventRow[]) {
    const key = String(ev.id)
    const eventBookings = bookingsByEvent.get(key) ?? []
    const series = parseSeriesOccurrences({
      workshop_series: ev.workshop_series,
      series_occurrences: ev.series_occurrences,
    })

    if (series.length > 0) {
      const bookingsByStart = new Map<string, number>()
      for (const b of eventBookings) {
        const minuteKey = isoMinute(b.session_starts_at)
        if (!minuteKey) continue
        bookingsByStart.set(minuteKey, (bookingsByStart.get(minuteKey) ?? 0) + 1)
      }
      const nextSeries: SeriesOccurrence[] = series.map((o) => {
        const minuteKey = isoMinute(o.start)
        const filled = minuteKey ? bookingsByStart.get(minuteKey) ?? 0 : 0
        const max = o.max_attendees ?? 0
        const next = Math.max(0, max - filled)
        return { ...o, available_slots: next }
      })
      const totalAvail = nextSeries.reduce((sum, o) => sum + o.available_slots, 0)
      const allFull = nextSeries.length > 0 && nextSeries.every((o) => o.available_slots <= 0)
      const nextStatus =
        allFull
          ? ev.booking_status === 'published' || ev.booking_status === 'fully_booked'
            ? 'fully_booked'
            : ev.booking_status
          : ev.booking_status === 'fully_booked'
            ? 'published'
            : ev.booking_status

      const changed =
        JSON.stringify(nextSeries) !== JSON.stringify(series) ||
        ev.available_slots !== totalAvail ||
        ev.booking_status !== nextStatus

      if (changed) {
        const { error: updateError } = await admin
          .from('events')
          .update({
            series_occurrences: nextSeries,
            available_slots: totalAvail,
            booking_status: nextStatus,
          })
          .eq('id', ev.id)
        if (updateError) {
          console.error('reconcileVendorEventSlots series update error:', ev.id, updateError)
          continue
        }
        reconciled += 1
      }
      continue
    }

    const max = ev.max_attendees ?? 0
    if (max <= 0) continue
    const filled = eventBookings.length
    const nextSlots = Math.max(0, max - filled)
    const nextStatus =
      nextSlots <= 0
        ? ev.booking_status === 'published' || ev.booking_status === 'fully_booked'
          ? 'fully_booked'
          : ev.booking_status
        : ev.booking_status === 'fully_booked'
          ? 'published'
          : ev.booking_status

    if (ev.available_slots === nextSlots && ev.booking_status === nextStatus) continue

    const { error: updateError } = await admin
      .from('events')
      .update({ available_slots: nextSlots, booking_status: nextStatus })
      .eq('id', ev.id)
    if (updateError) {
      console.error('reconcileVendorEventSlots update error:', ev.id, updateError)
      continue
    }
    reconciled += 1
  }

  return { reconciled }
}

/** Reconcile every vendor that has bookings tied to the given event IDs. */
export async function reconcileEventsByIds(
  admin: SupabaseClient,
  eventIds: Array<string | number>
): Promise<void> {
  if (!eventIds.length) return
  const { data: events } = await admin
    .from('events')
    .select('vendor_profile_id')
    .in('id', eventIds)
  const vendorIds = Array.from(
    new Set(
      (events ?? [])
        .map((e: { vendor_profile_id: string | null }) => e.vendor_profile_id)
        .filter((v): v is string => Boolean(v))
    )
  )
  for (const vendorId of vendorIds) {
    await reconcileVendorEventSlots(admin, vendorId)
  }
}
